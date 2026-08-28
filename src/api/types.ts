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

/**
 * A sentence the server wrote in both of the app's languages.
 *
 * `GET /api/me/episodes` and `GET /api/me/income` return `state_text: {en, vi}`
 * alongside every state, and the sentence is the server's to write, not the
 * app's to compose: the collector-facing state vocabulary
 * (`uploaded | approved | not_paid | on_a_bill | action_needed | waiting_on_us |
 * on_hold | being_rechecked | paid | cannot_be_paid | unknown`) is a different
 * and larger set than APP-23's six upload states, and inventing a Vietnamese
 * sentence for it here would be a second source of truth for what a collector
 * is told about their own money. The app renders the server's sentence; the
 * `state` field below survives only to choose a colour.
 */
export interface LocalisedText {
  vi: string;
  en: string;
}

export interface EpisodeUpload {
  episodeId: string;
  /**
   * Optional: the mock knows which session produced an episode, and
   * `GET /api/me/episodes` does not return it. Nothing on screen uses it.
   */
  sessionId?: string;
  sizeBytes: number;
  state: EpisodeState;
  /** The server's own sentence for this state, when the server supplied one. */
  stateText?: LocalisedText;
  /** APP-27: a failed review names its reason, in the collector's language. */
  rejectReason?: string;
  /**
   * How far this phone has got sending the episode, when a delivery for it is
   * on the upload queue. Absent means no delivery is queued — which is what an
   * episode `uploading` with nothing to send looks like, and the screen says so
   * rather than spinning for ever.
   */
  delivery?: {
    sentBytes: number;
    totalBytes: number;
    /** The last attempt stopped. The bytes already sent are still the server's. */
    interrupted: boolean;
  };
}

export interface IncomeEntry {
  episodeId: string;
  /** Server-computed. `null` until the server has anything to say. */
  effectiveMinutes: string | null;
  amountVnd: string | null;
  /** APP-34: estimated is never presented as confirmed. */
  kind: 'estimated' | 'confirmed';
  settlementState: string | null;
  /** The server's own sentence for `settlementState`, when it supplied one. */
  settlementText?: LocalisedText;
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
}
