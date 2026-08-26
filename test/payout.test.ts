import { describe, expect, it } from 'vitest';
import { EXAM_QUESTION_COUNT, MockCollectorApi } from '../src/api/mock.ts';
import { AGREEMENTS, PAYOUT_PERIOD_STATUSES, VERIFY_STATUSES, type CollectorApi, type PayoutAccount } from '../src/api/types.ts';
import { submitDeclaration } from '../src/services/payout/declare.ts';
import { resultActions } from '../src/services/payout/status.ts';
import { checkDraft, EMPTY_DRAFT, normaliseVietnameseMobile } from '../src/services/payout/validate.ts';

/**
 * The payout seam, end to end through the mock: every account type declared,
 * every `verify_status` the contract allows reached and rendered into the
 * right shape, the one write in the app proven to send once and never
 * again on its own, and the account number proven to be gone after submit.
 * The mock is the server until the server exists, so these are the gates the
 * screens were built against.
 */

const PASSING = Array<boolean>(EXAM_QUESTION_COUNT).fill(true);

async function onboarded(name = 'Nguyễn Văn A', phone = '0903000001'): Promise<MockCollectorApi> {
  const api = new MockCollectorApi();
  await api.register(name, phone);
  await api.acceptAgreements(AGREEMENTS.map((a) => ({ agreementId: a.id, version: a.version })));
  await api.completeTraining();
  await api.submitExam(PASSING);
  return api;
}

describe('declaring a ZaloPay wallet', () => {
  it('verifies the registered phone in the registered name, tolerating case, diacritics and order', async () => {
    // The server's name rule (brief, Agent B item 5): normalise, case-fold,
    // compare token sets. The collector typed their name without accents and
    // family-name last; ZaloPay holds it accented and family-name first.
    const api = await onboarded();
    const account = await api.declarePayoutAccount({ method: 'WALLET', phone: '0903000001', declaredName: 'van a NGUYEN' });
    expect(account.verifyStatus).toBe('verified');
    expect(account.verifiedName).toBe('Nguyễn Văn A');
    // The declared name is kept exactly as typed — never rewritten to ZaloPay's.
    expect(account.declaredName).toBe('van a NGUYEN');
    expect(account.verifiedAt).not.toBeNull();
    expect(account.phone).toBe('0903000001');
  });

  it('keeps BOTH names on a mismatch and rewrites neither', async () => {
    const api = await onboarded();
    const account = await api.declarePayoutAccount({ method: 'WALLET', phone: '0903000009', declaredName: 'Nguyễn Văn A' });
    expect(account.verifyStatus).toBe('name_mismatch');
    expect(account.declaredName).toBe('Nguyễn Văn A');
    expect(account.verifiedName).toBe('Nguyễn Văn B');
    // The screen offers a fix and an alternative, in that order; it does not accuse.
    expect(resultActions(account)).toEqual(['fixName', 'other']);
  });

  it('returns the onboarding page for a phone with no wallet (-101)', async () => {
    const api = await onboarded();
    const account = await api.declarePayoutAccount({ method: 'WALLET', phone: '0987654321', declaredName: 'Nguyễn Văn A' });
    expect(account.verifyStatus).toBe('no_wallet');
    expect(account.onboardingUrl).toMatch(/^https:\/\//);
    expect(account.reformUrl).toBeNull();
    expect(resultActions(account)).toEqual(['openOnboarding', 'redeclare']);
  });

  it('returns the reform page for a wallet at its KYC limit (-406)', async () => {
    const api = await onboarded();
    const account = await api.declarePayoutAccount({ method: 'WALLET', phone: '0903000406', declaredName: 'Hoàng Thị K' });
    expect(account.verifyStatus).toBe('kyc_limit');
    expect(account.reformUrl).toMatch(/^https:\/\//);
    expect(resultActions(account)).toEqual(['openReform', 'redeclare']);
  });

  it('reports a locked wallet (-1011) and an unverified one (-1103) as states, not errors', async () => {
    const api = await onboarded();
    const locked = await api.declarePayoutAccount({ method: 'WALLET', phone: '0903001011', declaredName: 'Phạm Văn L' });
    expect(locked.verifyStatus).toBe('locked');
    expect(resultActions(locked)).toEqual(['other']);

    const unverified = await api.declarePayoutAccount({ method: 'WALLET', phone: '0903001103', declaredName: 'Đỗ Văn U' });
    expect(unverified.verifyStatus).toBe('unverified');
    expect(resultActions(unverified)).toEqual(['redeclare']);
  });

  it('degrades a deep link to "declare again" when the server passed no URL', () => {
    const noUrl: PayoutAccount = {
      id: 'pa-x',
      method: 'WALLET',
      phone: '0987654321',
      bankCode: null,
      accountNoLast4: null,
      declaredName: 'Nguyễn Văn A',
      verifiedName: null,
      verifyStatus: 'no_wallet',
      verifiedAt: null,
      onboardingUrl: null,
      reformUrl: null,
    };
    expect(resultActions(noUrl)).toEqual(['redeclare']);
    expect(resultActions({ ...noUrl, verifyStatus: 'kyc_limit' })).toEqual(['redeclare']);
    expect(resultActions({ ...noUrl, verifyStatus: 'verified' })).toEqual([]);
  });
});

describe('declaring a bank account or card', () => {
  it('verifies an account the bank knows, and hands back four digits of it', async () => {
    const api = await onboarded();
    const account = await api.declarePayoutAccount({
      method: 'BANK_ACCOUNT',
      bankCode: 'VCB',
      accountNo: '0071000123456',
      declaredName: 'Nguyễn Văn A',
    });
    expect(account.verifyStatus).toBe('verified');
    expect(account.bankCode).toBe('VCB');
    expect(account.accountNoLast4).toBe('3456');
    expect(account.phone).toBeNull();
  });

  it('verifies a card the same way', async () => {
    const api = await onboarded();
    const account = await api.declarePayoutAccount({
      method: 'BANK_CARD',
      bankCode: 'TCB',
      cardNo: '9704366612345678',
      declaredName: 'nguyen van a',
    });
    expect(account.verifyStatus).toBe('verified');
    expect(account.accountNoLast4).toBe('5678');
  });

  it('reports an unknown account or an unknown bank as error, not as a name problem', async () => {
    const api = await onboarded();
    const unknownAccount = await api.declarePayoutAccount({
      method: 'BANK_ACCOUNT',
      bankCode: 'VCB',
      accountNo: '000000000000',
      declaredName: 'Nguyễn Văn A',
    });
    expect(unknownAccount.verifyStatus).toBe('error');
    expect(unknownAccount.verifiedName).toBeNull();

    const unknownBank = await api.declarePayoutAccount({
      method: 'BANK_ACCOUNT',
      bankCode: 'NOPE',
      accountNo: '0071000123456',
      declaredName: 'Nguyễn Văn A',
    });
    expect(unknownBank.verifyStatus).toBe('error');
    expect(resultActions(unknownBank)).toEqual(['redeclare']);
  });

  it('serves the bank list from the server, with a code and a name per row', async () => {
    const api = await onboarded();
    const banks = await api.payoutBankCodes();
    expect(banks.length).toBeGreaterThan(0);
    for (const bank of banks) {
      expect(bank.code).toMatch(/^[A-Z]+$/);
      expect(bank.name.trim()).not.toBe('');
    }
  });
});

describe('the account number never comes back', () => {
  it('is absent from the response, from every later read, and from every row the mock holds', async () => {
    const api = await onboarded();
    const fullNumber = '19036789012345';
    const declared = await api.declarePayoutAccount({
      method: 'BANK_ACCOUNT',
      bankCode: 'ACB',
      accountNo: fullNumber,
      declaredName: 'Trần Thị B',
    });
    // Not the response…
    expect(JSON.stringify(declared)).not.toContain(fullNumber);
    expect(Object.keys(declared)).not.toContain('accountNo');
    expect(Object.keys(declared)).not.toContain('cardNo');
    // …not a later read…
    expect(JSON.stringify(await api.payoutAccount())).not.toContain(fullNumber);
    // …and not anything the mock keeps in memory at all. The real server
    // keeps the full value in a secrets store; the app has no such place and
    // must not grow one.
    expect(JSON.stringify(api)).not.toContain(fullNumber);
    expect(declared.accountNoLast4).toBe('2345');
  });
});

describe('the declaration is one request, sent once (no queue, no retry)', () => {
  it('reports offline, sends nothing, and does not send later on its own', async () => {
    const api = await onboarded();
    api.setNetwork('offline');

    const outcome = await submitDeclaration(api, { method: 'WALLET', phone: '0903000001', declaredName: 'Nguyễn Văn A' });
    expect(outcome).toEqual({ kind: 'offline' });
    // Exactly one attempt reached the transport: no retry behind the answer.
    expect(api.declareAttempts).toBe(1);

    // The radio comes back. Nothing was queued, so nothing goes out.
    api.setNetwork('online');
    await new Promise((resolve) => setTimeout(resolve, 30));
    expect(api.declareAttempts).toBe(1);
    expect(await api.payoutAccount()).toBeNull();

    // Only the collector's next tap sends it.
    const again = await submitDeclaration(api, { method: 'WALLET', phone: '0903000001', declaredName: 'Nguyễn Văn A' });
    expect(again.kind).toBe('ok');
    expect(api.declareAttempts).toBe(2);
  });

  it('treats a transport TypeError (fetch with no route) as offline, and a server refusal as refused', async () => {
    const dead = {
      declarePayoutAccount: async () => {
        throw new TypeError('Failed to fetch');
      },
    } as unknown as CollectorApi;
    expect(await submitDeclaration(dead, { method: 'WALLET', phone: '0903000001', declaredName: 'x' })).toEqual({
      kind: 'offline',
    });

    // Not registered: the server said no. That is an answer, not a network gap.
    const api = new MockCollectorApi();
    expect(await submitDeclaration(api, { method: 'WALLET', phone: '0903000001', declaredName: 'x' })).toEqual({
      kind: 'refused',
      code: 'not_registered',
    });
    expect(api.declareAttempts).toBe(1);
  });

  it('keeps an append-only history and reads the latest as current', async () => {
    const api = await onboarded();
    expect(await api.payoutAccount()).toBeNull();
    await api.declarePayoutAccount({ method: 'WALLET', phone: '0903000001', declaredName: 'Nguyễn Văn A' });
    const second = await api.declarePayoutAccount({
      method: 'BANK_CARD',
      bankCode: 'MB',
      cardNo: '9704366612345678',
      declaredName: 'Nguyễn Văn A',
    });
    const current = await api.payoutAccount();
    expect(current?.id).toBe(second.id);
    expect(current?.method).toBe('BANK_CARD');
    // A copy, like every other read: writing to it moves nothing.
    current!.verifyStatus = 'error';
    expect((await api.payoutAccount())?.verifyStatus).toBe('verified');
  });
});

describe('the income statements', () => {
  it('arrive per period, every figure a server string, and only a paid row carries a paid time', async () => {
    const api = await onboarded();
    const periods = await api.payoutIncome();
    expect(periods.length).toBeGreaterThan(0);
    for (const period of periods) {
      for (const figure of [period.validMinutes, period.grossVnd, period.withheldVnd, period.netVnd]) {
        expect(typeof figure).toBe('string');
      }
      expect(PAYOUT_PERIOD_STATUSES).toContain(period.status);
      if (period.status === 'paid') expect(period.paidAt).not.toBeNull();
      else expect(period.paidAt).toBeNull();
    }
    // Every status the collector can see is seeded, including the hold.
    expect(new Set(periods.map((p) => p.status))).toEqual(new Set(PAYOUT_PERIOD_STATUSES));
  });

  it('carries no reason on a held period — there is no field for one', async () => {
    const api = await onboarded();
    const held = (await api.payoutIncome()).find((p) => p.status === 'on_hold');
    expect(held).toBeDefined();
    expect(Object.keys(held!).join()).not.toMatch(/reason|flag|risk|hold_?by|score/i);
  });

  it('is unreadable offline rather than silently empty', async () => {
    const api = await onboarded();
    api.setNetwork('offline');
    await expect(api.payoutIncome()).rejects.toThrow('offline');
    await expect(api.payoutAccount()).rejects.toThrow('offline');
  });
});

describe('client-side shape checks (UX only; the server decides)', () => {
  it('accepts Vietnamese mobiles in the forms people type them', () => {
    expect(normaliseVietnameseMobile('0903000001')).toBe('0903000001');
    expect(normaliseVietnameseMobile('+84 903 000 001')).toBe('0903000001');
    expect(normaliseVietnameseMobile('84903000001')).toBe('0903000001');
    expect(normaliseVietnameseMobile('090.300.0001')).toBe('0903000001');
    expect(normaliseVietnameseMobile('0353000001')).toBe('0353000001');
  });

  it('rejects what is not a Vietnamese mobile', () => {
    expect(normaliseVietnameseMobile('')).toBeNull();
    expect(normaliseVietnameseMobile('090300000')).toBeNull(); // nine digits
    expect(normaliseVietnameseMobile('09030000012')).toBeNull(); // eleven
    expect(normaliseVietnameseMobile('0123456789')).toBeNull(); // 01x is a landline/retired prefix
    expect(normaliseVietnameseMobile('0903 00000a')).toBeNull();
  });

  it('names the first field to fix, in the order the form shows them', () => {
    expect(checkDraft(EMPTY_DRAFT)).toEqual({ ok: false, problem: 'name' });
    expect(checkDraft({ ...EMPTY_DRAFT, declaredName: 'A' })).toEqual({ ok: false, problem: 'phone' });
    expect(checkDraft({ ...EMPTY_DRAFT, method: 'BANK_ACCOUNT', declaredName: 'A' })).toEqual({ ok: false, problem: 'bank' });
    expect(checkDraft({ ...EMPTY_DRAFT, method: 'BANK_ACCOUNT', declaredName: 'A', bankCode: 'VCB' })).toEqual({
      ok: false,
      problem: 'number',
    });
    expect(
      checkDraft({ ...EMPTY_DRAFT, method: 'BANK_ACCOUNT', declaredName: 'A', bankCode: 'VCB', accountNumber: '12ab' }),
    ).toEqual({ ok: false, problem: 'number' });

    expect(checkDraft({ ...EMPTY_DRAFT, declaredName: ' Nguyễn Văn A ', phone: '+84903000001' })).toEqual({
      ok: true,
      input: { method: 'WALLET', phone: '0903000001', declaredName: 'Nguyễn Văn A' },
    });
    expect(
      checkDraft({ ...EMPTY_DRAFT, method: 'BANK_CARD', declaredName: 'A', bankCode: 'TCB', accountNumber: '9704 3666 1234 5678' }),
    ).toEqual({ ok: true, input: { method: 'BANK_CARD', bankCode: 'TCB', cardNo: '9704366612345678', declaredName: 'A' } });
  });

  it('carries no bank list of its own — the form gets it from the server', async () => {
    // Every status reachable, every one rendered: pinned at the type level by
    // the Record<VerifyStatus, …> maps in status.ts, and here at the value
    // level so a status added to the contract is a failing test, not a blank.
    expect(VERIFY_STATUSES).toEqual(['unverified', 'verified', 'name_mismatch', 'no_wallet', 'locked', 'kyc_limit', 'error']);
    const api = await onboarded();
    const banks = await api.payoutBankCodes();
    expect(banks.map((b) => b.code)).toContain('VCB');
  });
});
