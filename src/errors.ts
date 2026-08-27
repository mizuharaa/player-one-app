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
};

/** The generic sentence an unknown code becomes. */
export const GENERIC_ERROR: MessageKey = 'common.actionFailed';

/** A bare code, as the device seams hand them out. */
export const codeKey = (code: string): MessageKey => ERRORS[code] ?? GENERIC_ERROR;

/** A rejected promise, as react-query hands them to a screen. */
export const errorKey = (error: unknown): MessageKey =>
  codeKey(error instanceof Error ? error.message : '');
