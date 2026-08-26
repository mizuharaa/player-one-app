import type { PayoutAccountInput, PayoutMethod } from '../../api/types.ts';

/**
 * Shape checks on the declaration form, for UX only.
 *
 * Nothing here decides anything. A phone that passes is still a phone the
 * server will hand to ZaloPay's Verify Account; a phone that fails is one the
 * collector is told to look at again before the round trip. The server
 * validates independently and its answer wins. There is deliberately no bank
 * list, no name rule and no arithmetic in this file — the bank list is the
 * server's, the name comparison is the server's, and money never comes near
 * a declaration.
 */

/**
 * A Vietnamese mobile number as dialled domestically: ten digits, leading 0,
 * second digit 3/5/7/8/9 (the post-2018 numbering plan). Also accepted on
 * entry: the +84 / 84 international form, and spaces, dots, dashes and
 * brackets people type between groups.
 */
const VN_MOBILE = /^0[35789]\d{8}$/;

export function normaliseVietnameseMobile(raw: string): string | null {
  const digits = raw.replace(/[\s.()-]/g, '');
  let local = digits;
  if (digits.startsWith('+84')) local = `0${digits.slice(3)}`;
  else if (digits.startsWith('84') && digits.length === 11) local = `0${digits.slice(2)}`;
  return VN_MOBILE.test(local) ? local : null;
}

export const isVietnameseMobile = (raw: string): boolean => normaliseVietnameseMobile(raw) !== null;

/** Digits only, spaces allowed between groups. Length is left to the server and the bank. */
const ACCOUNT_OR_CARD = /^\d{6,19}$/;

export function normaliseAccountNumber(raw: string): string | null {
  const digits = raw.replace(/\s/g, '');
  return ACCOUNT_OR_CARD.test(digits) ? digits : null;
}

/** What the form holds while the collector types. One field per method's identifier. */
export interface DeclareDraft {
  method: PayoutMethod;
  phone: string;
  bankCode: string;
  /** Account number or card number, depending on `method`. Cleared after submit. */
  accountNumber: string;
  declaredName: string;
}

export const EMPTY_DRAFT: DeclareDraft = {
  method: 'WALLET',
  phone: '',
  bankCode: '',
  accountNumber: '',
  declaredName: '',
};

export type DraftProblem = 'name' | 'phone' | 'bank' | 'number';

export type DraftCheck = { ok: true; input: PayoutAccountInput } | { ok: false; problem: DraftProblem };

/** Turns a draft into the request, or names the first field to fix. */
export function checkDraft(draft: DeclareDraft): DraftCheck {
  const declaredName = draft.declaredName.trim();
  if (declaredName === '') return { ok: false, problem: 'name' };

  if (draft.method === 'WALLET') {
    const phone = normaliseVietnameseMobile(draft.phone);
    if (phone === null) return { ok: false, problem: 'phone' };
    return { ok: true, input: { method: 'WALLET', phone, declaredName } };
  }

  if (draft.bankCode.trim() === '') return { ok: false, problem: 'bank' };
  const number = normaliseAccountNumber(draft.accountNumber);
  if (number === null) return { ok: false, problem: 'number' };
  return draft.method === 'BANK_ACCOUNT'
    ? { ok: true, input: { method: 'BANK_ACCOUNT', bankCode: draft.bankCode, accountNo: number, declaredName } }
    : { ok: true, input: { method: 'BANK_CARD', bankCode: draft.bankCode, cardNo: number, declaredName } };
}
