import { describe, expect, it } from 'vitest';
import { EXAM_QUESTION_COUNT, MockCollectorApi, type MockState } from '../src/api/mock.ts';
import { AGREEMENTS } from '../src/api/types.ts';
import { resume } from '../src/resume.ts';

/**
 * NFR-03 (no data loss on task claiming, collection-session creation or episode
 * binding) and NFR-04 (upload state recoverable after the app exits or is
 * killed).
 *
 * The app's store is one JSON file, so a restart is: whatever the last write
 * put on disk, parsed, handed to a new instance. `disk()` below is that file in
 * memory — same callback the real `src/api/persist.ts` passes, same string in
 * and out, same `JSON` round trip. What it does not test is the file API
 * itself; `expo-file-system` is a native module and vitest never loads one.
 */
function disk() {
  let written: string | null = null;
  let writes = 0;
  const onChange = (state: MockState) => {
    written = JSON.stringify(state);
    writes += 1;
  };
  return {
    writes: () => writes,
    /** A launch. The first one finds nothing written; later ones find the file. */
    launch: (): MockCollectorApi =>
      new MockCollectorApi(
        written === null ? undefined : (JSON.parse(written) as MockState),
        onChange,
      ),
  };
}

const PASSING = Array<boolean>(EXAM_QUESTION_COUNT).fill(true);
const ACCEPTANCES = AGREEMENTS.map((a) => ({ agreementId: a.id, version: a.version }));

describe('the app survives being killed (NFR-03)', () => {
  it('brings back onboarding, claims, devices and sessions', async () => {
    const store = disk();
    const first = store.launch();

    await first.register('Nguyễn Văn A', '0903000001');
    await first.acceptAgreements(ACCEPTANCES);
    await first.completeTraining();
    await first.submitExam(PASSING);
    await first.claimTask('task-warehouse');
    await first.bindDevice('EGO1-PILOT-0007');
    const created = await first.createSession({
      taskId: 'task-warehouse',
      deviceSerial: 'EGO1-PILOT-0007',
      scenario: 'warehouse',
      othersInFrame: true,
      sensitiveInfo: false,
    });

    // Killed here. Nothing is flushed on the way out — every write already
    // happened inside the mutation that caused it.
    const second = store.launch();

    const me = await second.profile();
    expect(me?.name).toBe('Nguyễn Văn A');
    expect(me?.agreements).toHaveLength(6);
    expect(me?.trainingDone).toBe(true);
    expect(me?.examPassed).toBe(true);
    expect((await second.myClaims()).map((c) => c.taskId)).toEqual(['task-warehouse']);
    expect((await second.boundDevices()).map((d) => d.serial)).toEqual(['EGO1-PILOT-0007']);
    // APP-17b's two declarations come back as answered, not as defaults.
    const session = (await second.sessions())[0];
    expect(session).toEqual(created);
    expect(session?.othersInFrame).toBe(true);
    expect(session?.sensitiveInfo).toBe(false);
  });

  it('restores the gates themselves, not just the lists', async () => {
    // A restored profile that is merely *displayed* would let a collector claim
    // the same task twice and re-accept agreements they already hold. The
    // restored state has to be the state the gates read.
    const store = disk();
    const first = store.launch();
    await first.register('Trần Thị B', '0903000002');
    await first.acceptAgreements(ACCEPTANCES);
    await first.completeTraining();
    await first.submitExam(PASSING);
    await first.claimTask('task-cook');

    const second = store.launch();
    await expect(second.claimTask('task-cook')).rejects.toThrow('already_claimed');
    // task-office was seeded full by other collectors; that survives too.
    await expect(second.claimTask('task-office')).rejects.toThrow('task_at_capacity');
    // And a relaunch is not a fresh eligibility bypass in the other direction:
    // the warehouse task is still claimable, so the gate passed on real state.
    expect((await second.claimTask('task-warehouse')).taskId).toBe('task-warehouse');
  });

  it('does not re-issue identifiers it has already handed out', async () => {
    // The id counter was a module-level `let`. A relaunch reset it to zero and
    // the next collector, claim and session got ids the last run had used.
    const store = disk();
    const first = store.launch();
    const me = await first.register('Lê Văn C', '0903000003');
    await first.acceptAgreements(ACCEPTANCES);
    await first.completeTraining();
    await first.submitExam(PASSING);
    const firstClaim = await first.claimTask('task-cook');

    const second = store.launch();
    const secondClaim = await second.claimTask('task-warehouse');
    expect(secondClaim.id).not.toBe(firstClaim.id);
    expect(secondClaim.id).not.toBe(me.id);
  });

  it('writes on every mutation, not once at the end', async () => {
    // The saves live inside the mock's own methods, so no screen can forget
    // one. If a mutation is added without a save, this count stops matching.
    const store = disk();
    const api = store.launch();
    expect(store.writes()).toBe(0);

    await api.register('Phạm Thị D', '0903000004');
    expect(store.writes()).toBe(1);
    await api.acceptAgreements(ACCEPTANCES);
    expect(store.writes()).toBe(2);
    await api.completeTraining();
    expect(store.writes()).toBe(3);
    await api.submitExam(PASSING);
    expect(store.writes()).toBe(4);
    await api.claimTask('task-cook');
    expect(store.writes()).toBe(5);
    await api.bindDevice('EGO1-PILOT-0007');
    expect(store.writes()).toBe(6);
    await api.createSession({
      taskId: 'task-cook',
      deviceSerial: 'EGO1-PILOT-0007',
      scenario: 'home',
      othersInFrame: false,
      sensitiveInfo: false,
    });
    expect(store.writes()).toBe(7);
    await api.confirmUpload('ego1-20260821-0715');
    expect(store.writes()).toBe(8);

    // Reads write nothing.
    await api.tasks();
    await api.episodes();
    await api.income();
    await api.profile();
    expect(store.writes()).toBe(8);
  });
});

describe('upload state is recoverable after a kill (NFR-04)', () => {
  it('comes back still uploading, because nothing moved the bytes', async () => {
    const store = disk();
    const first = store.launch();
    await first.register('Võ Văn E', '0903000005');
    const confirmed = await first.confirmUpload('ego1-20260821-0715');
    expect(confirmed.state).toBe('uploading');

    const second = store.launch();
    const episode = (await second.episodes()).find((e) => e.episodeId === 'ego1-20260821-0715');
    // `uploading` is the correct answer, and `uploaded` would be a lie: no
    // transfer worker exists, so no byte left the phone before the kill. A
    // demo timer used to flip this and was removed; a restart must not become
    // the new place that flip hides. APP-25 also survives — the confirmation
    // is spent, and a second one is still refused.
    expect(episode?.state).toBe('uploading');
    await expect(second.confirmUpload('ego1-20260821-0715')).rejects.toThrow('not_pending');

    // The episodes nobody confirmed are untouched by the restart.
    const states = (await second.episodes()).map((e) => e.state);
    expect(states).toEqual([
      'uploading',
      'pending_upload',
      'under_review',
      'review_passed',
      'review_failed',
    ]);
  });

  // Not tested here: the unreadable file. `src/api/persist.ts` discards a file that
  // will not parse and starts fresh, and that branch is one `JSON.parse` in a
  // `try`. Reaching it from here would mean importing `expo-file-system`, which
  // is a native module vitest cannot load — the same reason no test in this
  // repo renders a screen.
});

describe('a restored collector opens where they stopped', () => {
  it('sends a collector with no file to registration', () => {
    expect(resume(null)).toEqual({ name: 'register' });
  });

  it('walks the onboarding ladder one step at a time', async () => {
    // The reason this is not simply "profile, therefore home": `home` links to
    // the task hall and the training, and not to the agreements. A collector
    // killed after registering and before accepting would land there, claim a
    // task, be refused `agreements_incomplete`, and have no button on any
    // screen that leads to the agreements they are missing.
    const api = disk().launch();
    await api.register('Nguyễn Văn A', '0903000001');
    expect(resume(await api.profile())).toEqual({ name: 'agreements' });

    await api.acceptAgreements(AGREEMENTS.map((a) => ({ agreementId: a.id, version: a.version })));
    expect(resume(await api.profile())).toEqual({ name: 'training' });

    await api.completeTraining();
    expect(resume(await api.profile())).toEqual({ name: 'exam' });

    await api.submitExam([true, false, true]);
    expect(resume(await api.profile())).toEqual({ name: 'exam' });

    await api.submitExam(PASSING);
    expect(resume(await api.profile())).toEqual({ name: 'home' });
  });

  it('does not open on registration once a profile exists', async () => {
    // `Register` overwrites the profile with an empty one. Opening a restored
    // collector on it would destroy exactly the state that was just restored.
    const api = disk().launch();
    await api.register('Trần Thị B', '0903000002');
    const me = await api.profile();
    expect(resume(me).name).not.toBe('register');
  });

  it('sends a collector back to the agreements when their version went stale', () => {
    // Acceptance names the version it saw, and `mustBeEligible` refuses a stale
    // one. The signpost has to agree with the gate, or the app would open on
    // `home` for someone the server will not let claim anything.
    const stale = {
      id: 'col-0001',
      name: 'Lê Văn C',
      phone: '0903000003',
      agreements: AGREEMENTS.map((a) => ({
        agreementId: a.id,
        version: '0.9',
        acceptedAt: '2026-01-01T00:00:00.000Z',
      })),
      trainingDone: true,
      examPassed: true,
    };
    expect(resume(stale)).toEqual({ name: 'agreements' });
  });
});
