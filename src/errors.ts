import type { MessageKey } from './i18n.ts';

/**
 * The machine's refusal, in the collector's language.
 *
 * The server and the device both answer in short English identifiers —
 * `already_bound`, `exam_not_passed`, `configure_failed`. Those are a protocol,
 * not a sentence, and LOC-01 makes the collector app Vietnamese. Three screens
 * had each grown their own habit: `TaskDetail` mapped its five claim codes,
 * `Devices` printed `error.message` straight onto the card, and `Provisioning`
 * printed the transport's reason string. This is the one map, so a code added
 * on either seam has one place to be translated and one place to be found.
 *
 * Anything unrecognised falls back to a generic sentence. Never to the code
 * itself: a Vietnamese collector reading `serial_empty` learns nothing, and an
 * identifier on screen is a support call. The map covers the codes that can
 * reach a screen today; the fallback — not the map's completeness — is what
 * guarantees no identifier is ever rendered.
 */
const ERRORS: Record<string, MessageKey> = {
  // src/api/mock.ts, ApiError codes.
  not_registered: 'common.needRegister',
  missing_fields: 'register.missing',
  agreements_incomplete: 'detail.needAgreements',
  training_incomplete: 'detail.needTraining',
  exam_not_passed: 'detail.needExam',
  task_not_found: 'detail.notFound',
  task_at_capacity: 'detail.full',
  already_claimed: 'detail.claimed',
  serial_empty: 'devices.serialEmpty',
  already_bound: 'devices.alreadyBound',
  // src/device/transport.ts: configureWifi's reason, and requestIp's result
  // codes, which mirror EgoLowBle's IP_RESULT_* values.
  empty_ssid: 'prov.ssidEmpty',
  not_configured: 'prov.notConfigured',
  configuring: 'prov.configuring',
  configure_failed: 'prov.configureFailed',
  // src/api/http.ts. The server's own refusals never reach here: its 409 bodies
  // carry `constraint` values like `upload_foreign_session` and its 400s carry
  // raw validation output, and both are internal names a collector must never
  // read. The HTTP client converts them to the short codes below before they
  // leave it, and anything it did not convert still lands on the generic
  // sentence rather than on screen as an identifier.
  network: 'common.loadFailed',
  // src/api/local.ts: a method with no route behind it. It reaches a screen as
  // a rejected query, where `LoadFailed` says it without offering a retry, and
  // as a rejected mutation, where this sentence is what the collector reads.
  no_server: 'common.noServer',
  // The fourth state: connected to a server that has no route for this yet.
  // Same behaviour as `no_server` — no retry, never an empty list — and a
  // different sentence, because the collector's Wi-Fi is not the problem.
  no_route: 'common.noRoute',
  unauthorized: 'signin.expired',
  bad_code: 'signin.badCode',
  rate_limited: 'common.rateLimited',
};

/** The generic sentence an unknown code becomes. */
export const GENERIC_ERROR: MessageKey = 'common.actionFailed';

/** A bare code, as the device seams hand them out. */
export const codeKey = (code: string): MessageKey => ERRORS[code] ?? GENERIC_ERROR;

/** A rejected promise, as react-query hands them to a screen. */
export const errorKey = (error: unknown): MessageKey =>
  codeKey(error instanceof Error ? error.message : '');
