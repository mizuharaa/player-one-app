/**
 * The collector app's view of the platform, and the seam the mock fills.
 *
 * Two invariants from the engineering brief are load-bearing in these shapes
 * and deliberately impossible to violate through them:
 *
 * - **The client never sends a duration or an amount.** No input type here
 *   carries minutes or money. Effective minutes and amounts arrive from the
 *   server as strings, already computed and already rounded (`quantise` in
 *   `packages/api/src/money.ts` is the only rounding site in the system).
 * - **The app never starts or stops recording.** There is no method for it,
 *   here or on `DeviceTransport`. Recording is the device's own affair.
 */

/**
 * APP-02's six agreements, versioned. Acceptance names the version it saw.
 *
 * These six identifiers are NOT the app's to choose. They are the closed set
 * in the server's `collector_agreements_name_check` CHECK constraint
 * (`packages/store/src/schema.ts`), which is what actually rejects an unknown
 * agreement; the app is the client of that constraint. Keep them byte-equal —
 * `test/mock-api.test.ts` pins the list, so a rename here fails loudly instead
 * of failing at the first real POST.
 */
export const AGREEMENTS = [
  { id: 'user', version: '1.0' },
  { id: 'privacy', version: '1.0' },
  { id: 'data_collection', version: '1.0' },
  { id: 'commercial_use', version: '1.0' },
  { id: 'manual_review', version: '1.0' },
  { id: 'offline_settlement', version: '1.0' },
] as const;

export type AgreementId = (typeof AGREEMENTS)[number]['id'];

export interface AgreementAcceptance {
  agreementId: AgreementId;
  /** The version the collector was shown, not "whatever is current now". */
  version: string;
  acceptedAt: string;
}

export interface CollectorProfile {
  id: string;
  name: string;
  phone: string;
  agreements: AgreementAcceptance[];
  trainingDone: boolean;
  /** APP-05: no exam pass, no task claiming. The server enforces it too. */
  examPassed: boolean;
}

export type Scenario = 'home' | 'office' | 'shop' | 'warehouse';

export interface Task {
  id: string;
  title: string;
  scenario: Scenario;
  /** Display only. The server computes every payment. */
  unitPriceVndPerMinute: string;
  targetMinutes: number;
  claimedMinutes: number;
  maxClaimants: number;
  claimants: number;
  instructions: string;
  privacyNotice: string;
  paymentRule: string;
}

export interface Claim {
  id: string;
  taskId: string;
  claimedAt: string;
}

export interface BoundDevice {
  serial: string;
  boundAt: string;
}

/** APP-17b: both declarations are required booleans, never defaulted. */
export interface SessionInput {
  taskId: string;
  deviceSerial: string;
  scenario: Scenario;
  othersInFrame: boolean;
  sensitiveInfo: boolean;
}

export interface CollectionSession extends SessionInput {
  id: string;
  collectorId: string;
  createdAt: string;
}

/** APP-23's six states, verbatim. */
export const EPISODE_STATES = [
  'pending_upload',
  'uploading',
  'uploaded',
  'under_review',
  'review_passed',
  'review_failed',
] as const;

export type EpisodeState = (typeof EPISODE_STATES)[number];

export interface EpisodeUpload {
  episodeId: string;
  sessionId: string;
  sizeBytes: number;
  state: EpisodeState;
  /** APP-27: a failed review names its reason, in the collector's language. */
  rejectReason?: string;
}

export interface IncomeEntry {
  episodeId: string;
  /** Server-computed. `null` until the server has anything to say. */
  effectiveMinutes: string | null;
  amountVnd: string | null;
  /** APP-34: estimated is never presented as confirmed. */
  kind: 'estimated' | 'confirmed';
  settlementState: string | null;
}

/**
 * Payout — where a collector's money goes, and what the server has paid.
 *
 * Shapes follow the platform's `payout_accounts` contract (payout brief §2.1)
 * column for column, with one deliberate omission: **there is no full account
 * number anywhere in a response type.** The number is typed once, in
 * `PayoutAccountInput`, travels to `POST /api/payout/accounts`, and comes back
 * as `accountNoLast4`. Nothing the app can read after submit holds it, so
 * nothing the app could persist would hold it either.
 */
export const PAYOUT_METHODS = ['WALLET', 'BANK_ACCOUNT', 'BANK_CARD'] as const;
export type PayoutMethod = (typeof PAYOUT_METHODS)[number];

/** `payout_accounts.verify_status`, verbatim. Assigned by the server, never the app. */
export const VERIFY_STATUSES = [
  'unverified',
  'verified',
  'name_mismatch',
  'no_wallet',
  'locked',
  'kyc_limit',
  'error',
] as const;
export type VerifyStatus = (typeof VERIFY_STATUSES)[number];

/** One row of `GET /api/payout/bank-codes` — the server's cache of ZaloPay's list. */
export interface BankCode {
  code: string;
  name: string;
}

/** The declaration. The only place a full account or card number is typed. */
export type PayoutAccountInput =
  | { method: 'WALLET'; phone: string; declaredName: string }
  | { method: 'BANK_ACCOUNT'; bankCode: string; accountNo: string; declaredName: string }
  | { method: 'BANK_CARD'; bankCode: string; cardNo: string; declaredName: string };

export interface PayoutAccount {
  id: string;
  method: PayoutMethod;
  /** WALLET only. */
  phone: string | null;
  /** BANK_* only. Display name comes from `payoutBankCodes()`, not from here. */
  bankCode: string | null;
  /** BANK_* only. Display only; the full value lives in the server's secrets store. */
  accountNoLast4: string | null;
  /** What the collector typed. The server never rewrites it to ZaloPay's. */
  declaredName: string;
  /** What ZaloPay returned, when it returned one. */
  verifiedName: string | null;
  verifyStatus: VerifyStatus;
  verifiedAt: string | null;
  /** `no_wallet` (ZaloPay -101): the page where this phone creates a wallet. */
  onboardingUrl: string | null;
  /** `kyc_limit` (ZaloPay -406): the page where this wallet raises its limit. */
  reformUrl: string | null;
}

/**
 * The collector-facing status of one period's bill. Assigned by the server,
 * which alone knows whether a payout attempt is terminal — `paid` means a
 * `payout_attempt` reached `succeeded` (or a finance operator marked it paid
 * manually with a reference), never anything earlier. `on_hold` is a risk
 * hold: the collector sees a neutral "under review" and no reason, by design.
 */
export const PAYOUT_PERIOD_STATUSES = ['pending_review', 'approved', 'paid', 'on_hold'] as const;
export type PayoutPeriodStatus = (typeof PAYOUT_PERIOD_STATUSES)[number];

/** One row of `GET /api/payout/income`. Every figure is a server string, rendered as received. */
export interface IncomePeriod {
  periodStart: string;
  periodEnd: string;
  validMinutes: string;
  grossVnd: string;
  /** PIT withholding. Rate and threshold are a finance decision (brief §0.7 item 4); until then the server sends 0. */
  withheldVnd: string;
  netVnd: string;
  status: PayoutPeriodStatus;
  paidAt: string | null;
}

/**
 * The typed client every screen talks to. The mock below implements it today;
 * the real HTTP client implements it when the server side exists.
 *
 * ponytail: mock implementation only — the real client lands with auth and
 * the server endpoints (a sibling workstream owns the server gates).
 */
export interface CollectorApi {
  profile(): Promise<CollectorProfile | null>;
  register(name: string, phone: string): Promise<CollectorProfile>;
  /** APP-02: all six at once, each acceptance naming the version shown. */
  acceptAgreements(
    acceptances: { agreementId: AgreementId; version: string }[],
  ): Promise<CollectorProfile>;
  completeTraining(): Promise<CollectorProfile>;
  submitExam(answers: boolean[]): Promise<{ passed: boolean }>;
  tasks(): Promise<Task[]>;
  task(id: string): Promise<Task>;
  claimTask(taskId: string): Promise<Claim>;
  myClaims(): Promise<Claim[]>;
  boundDevices(): Promise<BoundDevice[]>;
  bindDevice(serial: string): Promise<BoundDevice>;
  createSession(input: SessionInput): Promise<CollectionSession>;
  sessions(): Promise<CollectionSession[]>;
  episodes(): Promise<EpisodeUpload[]>;
  /**
   * APP-25: the ONLY code path that starts an upload. Called from the
   * confirmation step the collector explicitly taps through — never from an
   * effect, a timer, or a network-state listener.
   */
  confirmUpload(episodeId: string): Promise<EpisodeUpload>;
  income(): Promise<IncomeEntry[]>;

  /** GET /api/payout/bank-codes. Never hardcoded in the app: the server caches ZaloPay's list. */
  payoutBankCodes(): Promise<BankCode[]>;
  /** The collector's current payout account, or null before the first declaration. */
  payoutAccount(): Promise<PayoutAccount | null>;
  /**
   * POST /api/payout/accounts. The server calls ZaloPay's Verify Account and
   * returns the outcome. Online-only: the caller sends it once and shows the
   * answer, or shows "connect to submit". It is never queued and never retried
   * — see `src/services/payout/declare.ts`.
   */
  declarePayoutAccount(input: PayoutAccountInput): Promise<PayoutAccount>;
  /** GET /api/payout/income: one row per settlement period, server-computed. */
  payoutIncome(): Promise<IncomePeriod[]>;
}
