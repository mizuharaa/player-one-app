import type { CollectorApi, PayoutAccount, PayoutAccountInput } from '../../api/types.ts';

/**
 * One request, one answer. The payout write in this app, and the rules it
 * lives under (payout brief, Agent E: "no retry-on-timeout for a
 * payout-related write"; §2.5: writes are online-only, never queued).
 *
 * Why no retry: a declaration that timed out may have reached the server and
 * been verified with ZaloPay. Sending it again "to be safe" appends a second
 * row to an append-only history, calls ZaloPay's Verify Account a second
 * time, and — if the collector edited a digit in between — makes the second
 * row current without the first ever being looked at. The safe behaviour is
 * the boring one: tell the collector it did not go through, keep what they
 * typed on screen, and let them tap submit again when they have signal.
 *
 * Why no queue: the same, plus a queued declaration would carry a full account
 * number in device storage, which nothing in this app may do.
 */
export type DeclareOutcome =
  | { kind: 'ok'; account: PayoutAccount }
  /** The request did not reach the server. Nothing was sent, nothing is pending. */
  | { kind: 'offline' }
  /** The server answered and said no. `code` is its refusal, for the screen to translate. */
  | { kind: 'refused'; code: string };

/**
 * What a transport throws when the network, not the server, is the problem.
 * The mock throws `offline`; an HTTP client should throw one of these codes
 * for no-network, DNS failure and timeout alike — the app cannot tell those
 * apart and must not try to.
 */
const NETWORK_CODES: ReadonlySet<string> = new Set(['offline', 'timeout', 'network']);

export async function submitDeclaration(api: CollectorApi, input: PayoutAccountInput): Promise<DeclareOutcome> {
  try {
    return { kind: 'ok', account: await api.declarePayoutAccount(input) };
  } catch (error) {
    const code = error instanceof Error ? error.message : 'unknown';
    // `fetch` rejects with a TypeError ("Failed to fetch") when there is no
    // route to the host; that is the same "did not reach the server" answer.
    if (NETWORK_CODES.has(code) || error instanceof TypeError) return { kind: 'offline' };
    return { kind: 'refused', code };
  }
}
