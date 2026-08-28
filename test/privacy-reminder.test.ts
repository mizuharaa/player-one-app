import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { LOCALES, MESSAGES } from '../src/i18n.ts';
import { MockCollectorApi } from '../src/api/mock.ts';
import { AGREEMENTS } from '../src/api/types.ts';

/**
 * PRV-02 and APP-20: the pre-collection reminder is displayed before each
 * session, verbatim from PaXini's PRD §14.2.
 *
 * "Verbatim" is the whole requirement, so the English is pinned character for
 * character rather than checked for keywords: a reminder someone tightened into
 * better prose is no longer the text legal signed off on. The Vietnamese is the
 * collector-facing one (LOC-01), so it is checked item by item against the same
 * list — a translation may choose its words, but it may not drop a category.
 */
const PRD_14_2 = {
  avoid:
    'Please try to avoid collecting ID cards, bank cards, passwords, screen sensitive information, children, medical privacy, detailed home addresses, and other content.',
  sensitive:
    'If sensitive information inevitably appears in real tasks, the backend will enter review and subsequent desensitization processing.',
};

describe('the pre-collection privacy reminder (PRV-02, APP-20)', () => {
  it('carries PaXini’s wording, not a rewrite of it', () => {
    expect(MESSAGES.en['session.privacyAvoid']).toBe(PRD_14_2.avoid);
    expect(MESSAGES.en['session.privacySensitive']).toBe(PRD_14_2.sensitive);
  });

  it('names every category PRV-02 lists, in Vietnamese', () => {
    // ID cards, bank cards, passwords, screen-sensitive information, children,
    // medical privacy, detailed home addresses.
    const vi = MESSAGES.vi['session.privacyAvoid'];
    for (const term of [
      'giấy tờ tùy thân',
      'thẻ ngân hàng',
      'mật khẩu',
      'trên màn hình',
      'trẻ em',
      'y tế',
      'địa chỉ nhà',
    ]) {
      expect(vi, term).toContain(term);
    }
    // And the second sentence's promise: it goes to review and is masked there.
    expect(MESSAGES.vi['session.privacySensitive']).toContain('duyệt');
  });

  it('exists in both locales and is nobody’s untranslated placeholder', () => {
    for (const locale of LOCALES) {
      for (const key of ['session.privacyTitle', 'session.privacyAvoid', 'session.privacySensitive'] as const) {
        expect(MESSAGES[locale][key].trim().length, `${key} in ${locale}`).toBeGreaterThan(10);
      }
    }
  });
});

/**
 * Where it appears. No test in this repo renders a screen — vitest never loads
 * React Native — so the ordering is read out of the source instead of out of an
 * accessibility tree. That is weaker than a render, and it is worth having: the
 * requirement is positional ("before each collection session"), and the failure
 * it guards against is someone moving the reminder below the button or off this
 * screen entirely, both of which are visible here.
 */
const SESSION_CREATE = readFileSync(
  // `.href`, not the URL object: `lib.dom` and `@types/node` each declare a
  // `URL` and the compiler will not accept one for the other.
  fileURLToPath(new URL('../src/screens/SessionCreate.tsx', import.meta.url).href),
  'utf8',
);

describe('the reminder is on the way in, not on the way out', () => {
  it('renders on the session-create screen, above the create button', () => {
    // Quoted, because the screen also holds `session.created` and a bare
    // `indexOf('session.create')` finds that first — measuring the wrong thing
    // and passing anyway.
    const at = (key: string) => SESSION_CREATE.indexOf(`'${key}'`);
    const avoid = at('session.privacyAvoid');
    const sensitive = at('session.privacySensitive');
    const declare = at('session.declare');
    const create = at('session.create');

    expect(avoid, 'session.privacyAvoid is not on this screen').toBeGreaterThan(-1);
    expect(sensitive, 'session.privacySensitive is not on this screen').toBeGreaterThan(-1);
    expect(create, 'the create button moved or was renamed').toBeGreaterThan(-1);
    // Both sentences, then the two APP-17b declarations they inform, then the
    // button that binds the session. One linear JSX return, so source order is
    // render order.
    expect(avoid).toBeLessThan(sensitive);
    expect(sensitive).toBeLessThan(declare);
    expect(declare).toBeLessThan(create);
  });

  it('is not carried by a live region', () => {
    // `Note` is `accessibilityLiveRegion="polite"` — the machine answering an
    // action. Standing text announced that way interrupts a screen reader
    // instead of being met in reading order, and would re-announce on every
    // re-render of this form.
    expect(SESSION_CREATE).not.toMatch(/Note\s+text=\{tt\('session\.privacy/);
  });
});

describe('the privacy surface stops at the reminder and the two flags', () => {
  it('adds no third declaration to the session', async () => {
    // The binding decision is "capture the two APP-17b flags and stop". A third
    // question here would be a privacy judgement the app is not allowed to make
    // and the platform has no column for.
    const api = new MockCollectorApi();
    await api.register('Nguyễn Văn A', '0903000001');
    await api.acceptAgreements(AGREEMENTS.map((a) => ({ agreementId: a.id, version: a.version })));
    await api.completeTraining();
    await api.submitExam([true, true, true]);
    await api.claimTask('task-warehouse');
    await api.bindDevice('EGO1-PILOT-0007');
    const session = await api.createSession({
      taskId: 'task-warehouse',
      deviceSerial: 'EGO1-PILOT-0007',
      scenario: 'warehouse',
      othersInFrame: true,
      sensitiveInfo: true,
    });
    expect(Object.keys(session).sort()).toEqual([
      'collectorId',
      'createdAt',
      'deviceSerial',
      'id',
      'othersInFrame',
      'scenario',
      'sensitiveInfo',
      'taskId',
    ]);
  });
});
