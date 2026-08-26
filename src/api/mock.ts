import type {
  AgreementId,
  BankCode,
  BoundDevice,
  Claim,
  CollectionSession,
  CollectorApi,
  CollectorProfile,
  EpisodeUpload,
  IncomeEntry,
  IncomePeriod,
  PayoutAccount,
  PayoutAccountInput,
  SessionInput,
  Task,
} from './types.ts';
import { AGREEMENTS } from './types.ts';

/**
 * In-memory server. It mirrors the server-side gates (APP-02, APP-05, APP-10,
 * APP-15) so the UI can be exercised honestly, but the real enforcement is the
 * server's — this object is for development and tests, and every rule it
 * checks exists on the server too.
 *
 * The seed deliberately contains other collectors' presence: a task already at
 * claimant capacity, episodes from two different sessions, income both
 * estimated and confirmed. Single-actor fixtures hid a real payment bug once.
 */

/** APP-04's exam is a mechanism shell; PaXini owes the content (D-item). */
export const EXAM_QUESTION_COUNT = 3;

export class ApiError extends Error {
  constructor(readonly code: string) {
    super(code);
  }
}

let seq = 0;
const id = (prefix: string): string => `${prefix}-${(++seq).toString().padStart(4, '0')}`;

/**
 * The mock's ZaloPay: what Verify Account would answer for a given phone,
 * account or card. Every `verify_status` the contract allows is reachable
 * from here, so a screen can be developed against each outcome without a
 * disbursement contract, credentials, or a network.
 *
 * Phones not listed have no wallet (ZaloPay -101) unless they are the
 * registered collector's own phone, which is seeded as a wallet in their
 * registered name — the default happy path for whoever registers.
 */
type WalletState = 'ok' | 'locked' | 'kyc_limit' | 'unverified';
const ZALOPAY_WALLETS: Record<string, { name: string; state: WalletState }> = {
  '0903000009': { name: 'Nguyễn Văn B', state: 'ok' },
  '0903001011': { name: 'Phạm Văn L', state: 'locked' },
  '0903000406': { name: 'Hoàng Thị K', state: 'kyc_limit' },
  '0903001103': { name: 'Đỗ Văn U', state: 'unverified' },
};
const ZALOPAY_BANK_ACCOUNTS: Record<string, string> = {
  '0071000123456': 'Nguyễn Văn A',
  '19036789012345': 'Trần Thị B',
};
const ZALOPAY_BANK_CARDS: Record<string, string> = {
  '9704366612345678': 'Nguyễn Văn A',
};
/** The server's cached `get-bank-code` list. The app never carries one of its own. */
const BANK_CODES: BankCode[] = [
  { code: 'VCB', name: 'Vietcombank' },
  { code: 'TCB', name: 'Techcombank' },
  { code: 'ACB', name: 'ACB' },
  { code: 'MB', name: 'MB Bank' },
  { code: 'VPB', name: 'VPBank' },
];
/** The URLs ZaloPay returns with -101 and -406. Real ones come from the response; these only need to be openable. */
const ONBOARDING_URL = 'https://zalopay.mock/onboarding';
const REFORM_URL = 'https://zalopay.mock/reform';

/**
 * The server's name rule, mirrored (payout brief, Agent B item 5): strip
 * diacritics, case-fold, collapse whitespace, compare token SETS — Vietnamese
 * name order varies by form. Exact set match verifies; anything else is a
 * mismatch that keeps BOTH names. This lives in the mock because it is the
 * server's decision; no screen or service in the app compares names.
 */
const nameTokens = (name: string): Set<string> =>
  new Set(
    name
      .normalize('NFD')
      .replace(/\p{M}/gu, '')
      .replace(/đ/g, 'd')
      .replace(/Đ/g, 'D')
      .toLowerCase()
      .split(/\s+/)
      .filter((token) => token !== ''),
  );
const sameName = (a: string, b: string): boolean => {
  const ta = nameTokens(a);
  const tb = nameTokens(b);
  return ta.size === tb.size && [...ta].every((token) => tb.has(token));
};

export class MockCollectorApi implements CollectorApi {
  private me: CollectorProfile | null = null;
  private claims: Claim[] = [];
  private devices: BoundDevice[] = [];
  private sessionRows: CollectionSession[] = [];
  private episodeRows: EpisodeUpload[];
  private taskRows: Task[];
  private incomeRows: IncomeEntry[];
  /** Append-only, like the table: the last row is the current account. */
  private payoutAccountRows: PayoutAccount[] = [];
  private incomePeriodRows: IncomePeriod[];
  /**
   * The transport's view of the network. `offline` makes every payout call
   * fail the way a dead radio does, so the "connect to submit" path and the
   * cached income path can be exercised — and so a test can prove nothing is
   * queued or retried while it is off.
   */
  private network: 'online' | 'offline' = 'online';
  /** How many times a declaration reached the transport, online or not. */
  private declareAttemptCount = 0;

  constructor() {
    this.taskRows = [
      {
        id: 'task-cook',
        title: 'Nấu ăn tại nhà',
        scenario: 'home',
        unitPriceVndPerMinute: '1200',
        targetMinutes: 3000,
        claimedMinutes: 420,
        maxClaimants: 5,
        claimants: 2,
        instructions:
          'Đeo thiết bị khi chuẩn bị bữa ăn hằng ngày. Ghi lại thao tác tự nhiên, không diễn.',
        privacyNotice: 'Không quay người khác khi chưa được đồng ý. Che thông tin cá nhân trên giấy tờ.',
        paymentRule: 'Trả theo phút hiệu quả đã duyệt.',
      },
      {
        id: 'task-office',
        title: 'Làm việc văn phòng',
        scenario: 'office',
        unitPriceVndPerMinute: '1000',
        targetMinutes: 6000,
        claimedMinutes: 5800,
        // Seeded FULL by other collectors: APP-10's cap is visible in the hall.
        maxClaimants: 2,
        claimants: 2,
        instructions: 'Thao tác bàn phím, giấy tờ, họp nhóm. Tránh màn hình chứa dữ liệu nội bộ.',
        privacyNotice: 'Cần sự đồng ý của đồng nghiệp xuất hiện trong khung hình.',
        paymentRule: 'Trả theo phút hiệu quả đã duyệt.',
      },
      {
        id: 'task-warehouse',
        title: 'Sắp xếp kho hàng',
        scenario: 'warehouse',
        unitPriceVndPerMinute: '1500',
        targetMinutes: 9000,
        claimedMinutes: 0,
        maxClaimants: 8,
        claimants: 0,
        instructions: 'Bốc xếp, dán nhãn, kiểm kê. Giữ thiết bị chắc chắn khi cúi người.',
        privacyNotice: 'Cần giấy phép của quản lý kho trước khi ghi hình.',
        paymentRule: 'Trả theo phút hiệu quả đã duyệt.',
      },
    ];
    // Two sessions' worth of episodes, spread over the six APP-23 states.
    this.episodeRows = [
      { episodeId: 'ego1-20260821-0715', sessionId: 'ses-0001', sizeBytes: 2_147_483_648, state: 'pending_upload' },
      { episodeId: 'ego1-20260821-0902', sessionId: 'ses-0001', sizeBytes: 1_610_612_736, state: 'pending_upload' },
      { episodeId: 'ego1-20260820-1830', sessionId: 'ses-0002', sizeBytes: 3_221_225_472, state: 'under_review' },
      { episodeId: 'ego1-20260819-1120', sessionId: 'ses-0002', sizeBytes: 2_684_354_560, state: 'review_passed' },
      {
        episodeId: 'ego1-20260819-0640',
        sessionId: 'ses-0002',
        sizeBytes: 1_073_741_824,
        state: 'review_failed',
        rejectReason: 'Ống kính bị che trong phần lớn thời lượng.',
      },
    ];
    this.incomeRows = [
      // Confirmed: a verdict exists, the server wrote the settlement row.
      // `pending_settlement` and not `pending_review`: both are legal values
      // of `settlements.settlement_state`, but the verdict path writes this
      // one (`packages/api/src/review.ts:777`), and a settlement that reached
      // the collector's income screen is by definition past review.
      {
        episodeId: 'ego1-20260819-1120',
        effectiveMinutes: '41.5',
        amountVnd: '49800',
        kind: 'confirmed',
        settlementState: 'pending_settlement',
      },
      { episodeId: 'ego1-20260819-0640', effectiveMinutes: '0', amountVnd: '0', kind: 'confirmed', settlementState: null },
      // Estimated: uploaded but not yet decided. Server's estimate, not ours.
      { episodeId: 'ego1-20260820-1830', effectiveMinutes: '52', amountVnd: '62400', kind: 'estimated', settlementState: null },
    ];
    // One row per settlement period, every figure a server string. The cycle
    // length is the brief's [ASSUMED] 7 days; the app renders whatever dates
    // arrive. `withheldVnd` is '0' on every row because the PIT rate is an
    // open finance decision (brief §0.7 item 4), not because it is free — the
    // column is shown so the day it stops being 0 is visible, not surprising.
    // The `on_hold` period carries no reason field at all: the type has none,
    // so the screen cannot show one.
    this.incomePeriodRows = [
      {
        periodStart: '2026-08-18',
        periodEnd: '2026-08-24',
        validMinutes: '318.5',
        grossVnd: '382200',
        withheldVnd: '0',
        netVnd: '382200',
        status: 'pending_review',
        paidAt: null,
      },
      {
        periodStart: '2026-08-11',
        periodEnd: '2026-08-17',
        validMinutes: '402',
        grossVnd: '482400',
        withheldVnd: '0',
        netVnd: '482400',
        status: 'approved',
        paidAt: null,
      },
      {
        periodStart: '2026-08-04',
        periodEnd: '2026-08-10',
        validMinutes: '96',
        grossVnd: '115200',
        withheldVnd: '0',
        netVnd: '115200',
        status: 'on_hold',
        paidAt: null,
      },
      {
        periodStart: '2026-07-28',
        periodEnd: '2026-08-03',
        validMinutes: '455',
        grossVnd: '546000',
        withheldVnd: '0',
        netVnd: '546000',
        status: 'paid',
        paidAt: '2026-08-06T09:12:00+07:00',
      },
    ];
  }

  private mustProfile(): CollectorProfile {
    if (this.me === null) throw new ApiError('not_registered');
    return this.me;
  }

  /**
   * Every read hands out a copy.
   *
   * These used to return the live arrays and the live row objects, which is
   * not what an HTTP client does and is not safe: a screen could mutate the
   * "server", and a test could compare a list to itself and pass whatever
   * happened in between. One of them did exactly that — the manual-upload
   * regression held aliases of the very rows it was checking had not moved.
   */
  async profile(): Promise<CollectorProfile | null> {
    return this.me === null ? null : { ...this.me, agreements: this.me.agreements.map((a) => ({ ...a })) };
  }

  async register(name: string, phone: string): Promise<CollectorProfile> {
    if (name.trim() === '' || phone.trim() === '') throw new ApiError('missing_fields');
    this.me = { id: id('col'), name, phone, agreements: [], trainingDone: false, examPassed: false };
    return { ...this.me };
  }

  async acceptAgreements(
    acceptances: { agreementId: AgreementId; version: string }[],
  ): Promise<CollectorProfile> {
    const me = this.mustProfile();
    // APP-02: all six, each at the version currently presented. A stale or
    // partial acceptance is no acceptance.
    for (const a of AGREEMENTS) {
      const got = acceptances.find((x) => x.agreementId === a.id);
      if (got === undefined || got.version !== a.version) throw new ApiError('agreements_incomplete');
    }
    const acceptedAt = new Date().toISOString();
    me.agreements = acceptances.map((a) => ({ ...a, acceptedAt }));
    return { ...me, agreements: me.agreements.map((a) => ({ ...a })) };
  }

  async completeTraining(): Promise<CollectorProfile> {
    const me = this.mustProfile();
    me.trainingDone = true;
    return { ...me };
  }

  async submitExam(answers: boolean[]): Promise<{ passed: boolean }> {
    const me = this.mustProfile();
    // Mechanism only: the shell "passes" when every check is answered yes.
    // PaXini's real questions and grading replace this with the content drop.
    const passed = answers.length === EXAM_QUESTION_COUNT && answers.every(Boolean);
    if (passed) me.examPassed = true;
    return { passed };
  }

  async tasks(): Promise<Task[]> {
    return this.taskRows.map((t) => ({ ...t }));
  }

  private taskRow(taskId: string): Task {
    const found = this.taskRows.find((t) => t.id === taskId);
    if (found === undefined) throw new ApiError('task_not_found');
    return found;
  }

  async task(taskId: string): Promise<Task> {
    return { ...this.taskRow(taskId) };
  }

  /**
   * The whole eligibility contract, in the order a collector meets it.
   *
   * APP-02 (all six agreements, at the version shown), APP-03/04 (training,
   * then the exam) and APP-05 (no exam pass, no claiming) are one gate, not
   * three optional ones. This mock previously checked the last of them only,
   * so registering and answering the exam yes was enough to claim a task —
   * an onboarding bypass the server will not honour, taught to every screen
   * developed against it.
   */
  private mustBeEligible(): CollectorProfile {
    const me = this.mustProfile();
    for (const a of AGREEMENTS) {
      const accepted = me.agreements.find((x) => x.agreementId === a.id);
      if (accepted === undefined || accepted.version !== a.version) {
        throw new ApiError('agreements_incomplete');
      }
    }
    if (!me.trainingDone) throw new ApiError('training_incomplete');
    if (!me.examPassed) throw new ApiError('exam_not_passed');
    return me;
  }

  async claimTask(taskId: string): Promise<Claim> {
    this.mustBeEligible();
    const task = this.taskRow(taskId);
    if (task.claimants >= task.maxClaimants) throw new ApiError('task_at_capacity');
    if (this.claims.some((c) => c.taskId === taskId)) throw new ApiError('already_claimed');
    task.claimants += 1;
    const claim: Claim = { id: id('claim'), taskId, claimedAt: new Date().toISOString() };
    this.claims.push(claim);
    return { ...claim };
  }

  async myClaims(): Promise<Claim[]> {
    return this.claims.map((c) => ({ ...c }));
  }

  async boundDevices(): Promise<BoundDevice[]> {
    return this.devices.map((d) => ({ ...d }));
  }

  async bindDevice(serial: string): Promise<BoundDevice> {
    this.mustProfile();
    const trimmed = serial.trim();
    if (trimmed === '') throw new ApiError('serial_empty');
    if (this.devices.some((d) => d.serial === trimmed)) throw new ApiError('already_bound');
    const device: BoundDevice = { serial: trimmed, boundAt: new Date().toISOString() };
    this.devices.push(device);
    return { ...device };
  }

  async createSession(input: SessionInput): Promise<CollectionSession> {
    const me = this.mustProfile();
    // APP-15: no device binding, no collection preparation.
    if (!this.devices.some((d) => d.serial === input.deviceSerial)) throw new ApiError('device_not_bound');
    if (!this.claims.some((c) => c.taskId === input.taskId)) throw new ApiError('task_not_claimed');
    const session: CollectionSession = {
      ...input,
      id: id('ses'),
      collectorId: me.id,
      createdAt: new Date().toISOString(),
    };
    this.sessionRows.push(session);
    return { ...session };
  }

  async sessions(): Promise<CollectionSession[]> {
    return this.sessionRows.map((s) => ({ ...s }));
  }

  async episodes(): Promise<EpisodeUpload[]> {
    return this.episodeRows.map((e) => ({ ...e }));
  }

  async confirmUpload(episodeId: string): Promise<EpisodeUpload> {
    this.mustProfile();
    const episode = this.episodeRows.find((e) => e.episodeId === episodeId);
    if (episode === undefined) throw new ApiError('episode_not_found');
    if (episode.state !== 'pending_upload') throw new ApiError('not_pending');
    // `uploading` is where it stops. A two-second timer used to flip it to
    // `uploaded` for demo effect: it moved no bytes, told React Query nothing,
    // so the screen sat on `uploading` anyway, and it put a state change in
    // the one class that must not have one. Removed. The transition out of
    // `uploading` belongs to the transfer worker that does not exist yet.
    episode.state = 'uploading';
    return { ...episode };
  }

  async income(): Promise<IncomeEntry[]> {
    return this.incomeRows.map((i) => ({ ...i }));
  }

  // ---- payout ------------------------------------------------------------

  /** Test and demo knob. There is no NetInfo in this scaffold; this is the network. */
  setNetwork(state: 'online' | 'offline'): void {
    this.network = state;
  }

  get declareAttempts(): number {
    return this.declareAttemptCount;
  }

  private mustBeOnline(): void {
    if (this.network === 'offline') throw new ApiError('offline');
  }

  async payoutBankCodes(): Promise<BankCode[]> {
    this.mustBeOnline();
    return BANK_CODES.map((b) => ({ ...b }));
  }

  async payoutAccount(): Promise<PayoutAccount | null> {
    this.mustBeOnline();
    const current = this.payoutAccountRows[this.payoutAccountRows.length - 1];
    return current === undefined ? null : { ...current };
  }

  /**
   * Verification-on-declare, as the server does it (payout brief, Agent B
   * item 5). The full account or card number is read once, to look the
   * account up and to take its last four digits, and is then dropped: the
   * stored row has `accountNoLast4` and nothing else of it, exactly like the
   * table (the real server keeps the full value in its secrets store, which
   * this mock does not model because the app must never see it again).
   */
  async declarePayoutAccount(input: PayoutAccountInput): Promise<PayoutAccount> {
    this.declareAttemptCount += 1;
    this.mustBeOnline();
    const me = this.mustProfile();
    const declaredName = input.declaredName.trim();
    if (declaredName === '') throw new ApiError('missing_fields');

    const base = {
      id: id('pa'),
      method: input.method,
      phone: null as string | null,
      bankCode: null as string | null,
      accountNoLast4: null as string | null,
      declaredName,
      verifiedName: null as string | null,
      verifiedAt: null as string | null,
      onboardingUrl: null as string | null,
      reformUrl: null as string | null,
    };
    const now = new Date().toISOString();
    const nameOutcome = (zaloPayName: string): PayoutAccount =>
      sameName(declaredName, zaloPayName)
        ? { ...base, verifiedName: zaloPayName, verifyStatus: 'verified', verifiedAt: now }
        : // The discrepancy is the signal: the declared name stays as typed.
          { ...base, verifiedName: zaloPayName, verifyStatus: 'name_mismatch', verifiedAt: now };

    let row: PayoutAccount;
    if (input.method === 'WALLET') {
      const phone = input.phone.trim();
      if (phone === '') throw new ApiError('missing_fields');
      base.phone = phone;
      const wallet =
        ZALOPAY_WALLETS[phone] ?? (phone === me.phone ? { name: me.name, state: 'ok' as const } : undefined);
      if (wallet === undefined) {
        // -101 USER_NOT_EXISTS: not a dead end — ZaloPay hands back the page to create one.
        row = { ...base, verifyStatus: 'no_wallet', verifiedAt: now, onboardingUrl: ONBOARDING_URL };
      } else if (wallet.state === 'locked') {
        row = { ...base, verifyStatus: 'locked', verifiedAt: now };
      } else if (wallet.state === 'kyc_limit') {
        row = { ...base, verifyStatus: 'kyc_limit', verifiedAt: now, reformUrl: REFORM_URL };
      } else if (wallet.state === 'unverified') {
        row = { ...base, verifyStatus: 'unverified', verifiedAt: now };
      } else {
        row = nameOutcome(wallet.name);
      }
    } else {
      const number = (input.method === 'BANK_ACCOUNT' ? input.accountNo : input.cardNo).trim();
      if (input.bankCode.trim() === '' || number === '') throw new ApiError('missing_fields');
      base.bankCode = input.bankCode;
      base.accountNoLast4 = number.slice(-4);
      const directory = input.method === 'BANK_ACCOUNT' ? ZALOPAY_BANK_ACCOUNTS : ZALOPAY_BANK_CARDS;
      const holder = directory[number];
      // -105 INVALID_BANK_CODE / -106 INVALID_BANK_INFO: nothing to compare against.
      row =
        !BANK_CODES.some((b) => b.code === input.bankCode) || holder === undefined
          ? { ...base, verifyStatus: 'error', verifiedAt: now }
          : nameOutcome(holder);
    }
    this.payoutAccountRows.push(row);
    return { ...row };
  }

  async payoutIncome(): Promise<IncomePeriod[]> {
    this.mustBeOnline();
    this.mustProfile();
    return this.incomePeriodRows.map((p) => ({ ...p }));
  }
}
