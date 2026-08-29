import { describe, expect, it } from 'vitest';
import { MockCollectorApi } from '../src/api/mock.ts';
import { NO_ROUTE, NO_SERVER, isNoServer, localOnly } from '../src/api/local.ts';
import { AGREEMENTS } from '../src/api/types.ts';
import { GENERIC_ERROR, codeKey } from '../src/errors.ts';
import { LOCALES, MESSAGES } from '../src/i18n.ts';

/**
 * The app must never show a number or a record it did not get from the server.
 *
 * `src/api/local.ts` is where that is decided, and the split is the point of
 * these tests: the collector's own onboarding record is theirs and is on this
 * phone, so it still answers; everything the platform owns refuses, and the
 * refusal is a named one so a screen can tell "there is no server" apart from
 * "the read failed" and from "the server says you have nothing".
 */

const ACCEPTANCES = AGREEMENTS.map((a) => ({ agreementId: a.id, version: a.version }));

describe('what a build with no server still knows', () => {
  it('lets a collector register, accept, train and sit the exam', async () => {
    // Daniel must be able to walk the whole onboarding flow with no server
    // running. None of it is invented: a person typed the name, tapped the six
    // agreements and answered the three questions, and the phone stored it.
    const api = localOnly(new MockCollectorApi());
    expect(await api.profile()).toBeNull();

    const me = await api.register('Nguyễn Văn A', '0903000001');
    expect(me.name).toBe('Nguyễn Văn A');

    const accepted = await api.acceptAgreements(ACCEPTANCES);
    expect(accepted.agreements).toHaveLength(6);

    expect((await api.completeTraining()).trainingDone).toBe(true);
    expect((await api.submitExam([true, true, true])).passed).toBe(true);
    expect((await api.profile())?.examPassed).toBe(true);
  });
});

describe('what it refuses to invent', () => {
  it('answers no_server for every record the platform owns', async () => {
    const api = localOnly(new MockCollectorApi());
    // Named one by one rather than reflected over the interface: a method added
    // to `CollectorApi` should have to be placed on one side of this split
    // deliberately, and a new one wired to the mock by habit fails here.
    const calls: [string, () => Promise<unknown>][] = [
      ['tasks', () => api.tasks()],
      ['task', () => api.task('task-cook')],
      ['claimTask', () => api.claimTask('task-cook')],
      ['myClaims', () => api.myClaims()],
      ['boundDevices', () => api.boundDevices()],
      ['bindDevice', () => api.bindDevice('EGO1-PILOT-0007')],
      [
        'createSession',
        () =>
          api.createSession({
            taskId: 'task-cook',
            deviceSerial: 'EGO1-PILOT-0007',
            scenario: 'home',
            othersInFrame: false,
            sensitiveInfo: false,
          }),
      ],
      ['sessions', () => api.sessions()],
      ['episodes', () => api.episodes()],
      ['confirmUpload', () => api.confirmUpload('ego1-20260821-0715')],
      ['income', () => api.income()],
    ];

    for (const [name, call] of calls) {
      const error = await call().catch((e: unknown) => e);
      // Not an empty list. "You have no income" and "you have claimed nothing"
      // are statements about the collector's own work, and a collector who
      // believes one stops looking for pay they earned.
      expect(isNoServer(error), name).toBe(true);
      expect((error as Error).message, name).toBe(NO_SERVER);
    }
  });

  it('says so in the collector’s language, never as the code', async () => {
    const key = codeKey(NO_SERVER);
    expect(key).not.toBe(GENERIC_ERROR);
    for (const locale of LOCALES) {
      const text = MESSAGES[locale][key];
      expect(text, locale).toBeTruthy();
      expect(text, locale).not.toMatch(/^[a-z][a-z0-9_]*$/);
    }
    // The four states are four different sentences, not one reused.
    expect(MESSAGES.vi['common.noServer']).not.toBe(MESSAGES.vi['common.loadFailed']);
    expect(MESSAGES.vi['common.noServer']).not.toBe(MESSAGES.vi['income.empty']);
    expect(MESSAGES.vi['common.noServer']).not.toBe(MESSAGES.vi['common.noRoute']);
    // And "connected, no route yet" never claims the connection is the problem.
    expect(codeKey(NO_ROUTE)).toBe('common.noRoute');
  });

  it('leaves the seed alone, for whoever asks for it', async () => {
    // The mock is not deleted and its rows are not thinned: with
    // EXPO_PUBLIC_MOCK_DATA=1 they are still the only way to see these layouts
    // holding data, and the gate tests in `mock-api.test.ts` still need them.
    const seeded = new MockCollectorApi();
    expect((await seeded.tasks()).length).toBeGreaterThan(0);
    expect((await seeded.income()).length).toBeGreaterThan(0);
  });
});
