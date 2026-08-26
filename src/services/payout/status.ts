import type { PayoutAccount, PayoutPeriodStatus, VerifyStatus } from '../../api/types.ts';
import type { MessageKey } from '../../i18n.ts';

/**
 * Server states → what the collector reads, and what they can do about it.
 * Pure lookups, so the wording and the actions are pinned by tests without a
 * renderer. Every pill is a colour AND a word, never colour alone.
 */

/** The four pill tones a payout screen may use. Mapped to theme colours in the screen. */
export type Tone = 'pass' | 'partial' | 'info' | 'muted';

export const VERIFY_STATUS_KEY: Record<VerifyStatus, MessageKey> = {
  unverified: 'payout.verify.unverified',
  verified: 'payout.verify.verified',
  name_mismatch: 'payout.verify.name_mismatch',
  no_wallet: 'payout.verify.no_wallet',
  locked: 'payout.verify.locked',
  kyc_limit: 'payout.verify.kyc_limit',
  error: 'payout.verify.error',
};

/**
 * Only `verified` is green. Everything the collector can still fix is the
 * partial tone — a state, not a verdict on them. `error` is the system not
 * knowing, so it is muted rather than red: red would read as an accusation.
 */
export const VERIFY_STATUS_TONE: Record<VerifyStatus, Tone> = {
  unverified: 'partial',
  verified: 'pass',
  name_mismatch: 'partial',
  no_wallet: 'partial',
  locked: 'partial',
  kyc_limit: 'partial',
  error: 'muted',
};

/** The explanation shown on the result screen, per status. */
export const VERIFY_RESULT_TEXT: Record<VerifyStatus, { title: MessageKey; body: MessageKey }> = {
  verified: { title: 'payout.result.verifiedTitle', body: 'payout.result.verifiedBody' },
  name_mismatch: { title: 'payout.result.mismatchTitle', body: 'payout.result.mismatchBody' },
  no_wallet: { title: 'payout.result.noWalletTitle', body: 'payout.result.noWalletBody' },
  kyc_limit: { title: 'payout.result.kycTitle', body: 'payout.result.kycBody' },
  locked: { title: 'payout.result.lockedTitle', body: 'payout.result.lockedBody' },
  unverified: { title: 'payout.result.unverifiedTitle', body: 'payout.result.unverifiedBody' },
  error: { title: 'payout.result.errorTitle', body: 'payout.result.errorBody' },
};

/**
 * What the result screen offers, in order. `openOnboarding` and `openReform`
 * deep-link the URL ZaloPay returned; they are offered only when the server
 * actually passed one on, so a missing URL degrades to "declare again"
 * rather than a button that opens nothing.
 */
export type ResultAction = 'fixName' | 'openOnboarding' | 'openReform' | 'redeclare' | 'other';

export function resultActions(account: PayoutAccount): ResultAction[] {
  switch (account.verifyStatus) {
    case 'verified':
      return [];
    case 'name_mismatch':
      return ['fixName', 'other'];
    case 'no_wallet':
      return account.onboardingUrl !== null ? ['openOnboarding', 'redeclare'] : ['redeclare'];
    case 'kyc_limit':
      return account.reformUrl !== null ? ['openReform', 'redeclare'] : ['redeclare'];
    case 'locked':
      return ['other'];
    case 'unverified':
    case 'error':
      return ['redeclare'];
  }
}

/**
 * The period's status, in the words the brief fixes: "Chờ duyệt" /
 * "Đã duyệt, chờ chi trả" / "Đã chi trả", and a neutral "Đang xem xét" for
 * a hold. A value the server invents later maps to the neutral "in progress"
 * rather than to its raw name, and — the one rule that matters here — never
 * to "paid": nothing on this side can promote a status.
 */
export const PERIOD_STATUS_KEY: Record<PayoutPeriodStatus, MessageKey> = {
  pending_review: 'payout.status.pending_review',
  approved: 'payout.status.approved',
  paid: 'payout.status.paid',
  on_hold: 'payout.status.on_hold',
};

export const PERIOD_STATUS_TONE: Record<PayoutPeriodStatus, Tone> = {
  pending_review: 'muted',
  approved: 'info',
  paid: 'pass',
  // Neutral on purpose: a hold is "being looked at", not a warning colour.
  on_hold: 'muted',
};

const isPeriodStatus = (status: string): status is PayoutPeriodStatus => status in PERIOD_STATUS_KEY;

export const periodStatusKey = (status: string): MessageKey =>
  isPeriodStatus(status) ? PERIOD_STATUS_KEY[status] : 'payout.status.unknown';

export const periodStatusTone = (status: string): Tone =>
  isPeriodStatus(status) ? PERIOD_STATUS_TONE[status] : 'muted';
