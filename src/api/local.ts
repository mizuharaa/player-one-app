import { ApiError } from './mock.ts';
import type { CollectorApi } from './types.ts';

/**
 * The app with no server behind it, telling the truth about that.
 *
 * Half of `CollectorApi` is the collector's own record of themselves — their
 * name and phone number, the six agreements they accepted, the training they
 * read, the exam they answered. A collector really did type and tap those, this
 * phone really did store them (`src/api/persist.ts`), and showing them back is
 * showing the collector their own data. Those five methods are delegated.
 *
 * The other half is the platform's record: what work is on offer, at what
 * price, which of it this collector holds, which camera is theirs, what footage
 * the platform has and what it owes them for it. None of that can be known
 * without asking the server, and every one of those answers is a number or a
 * record a collector would act on. Until a route exists, they refuse with
 * `no_server`, and the screen says the app is not connected to a server yet.
 *
 * The refusal is deliberately NOT an empty list. "You have claimed nothing",
 * "no episodes", "no income" are statements about the collector's own work, and
 * a collector who believes one stops looking for footage they recorded or pay
 * they earned. Not connected, connected-and-empty, and failed-to-read are three
 * different sentences on every screen below.
 *
 * `src/api/mock.ts` still exists and still holds its seed, because the seed is
 * the only way to exercise these layouts before the routes land. It is opt-in
 * now — `EXPO_PUBLIC_MOCK_DATA=1`, see `src/api/config.ts` — rather than what a
 * collector sees by default.
 */

/** The code every method with no route behind it rejects with. */
export const NO_SERVER = 'no_server';

/** Told apart from a failed read, which is a different sentence and offers a retry. */
export const isNoServer = (error: unknown): boolean =>
  error instanceof Error && error.message === NO_SERVER;

/**
 * @param local the phone's own store — `MockCollectorApi` restored from disk,
 *   used here only for the collector's own onboarding record.
 */
export function localOnly(local: CollectorApi): CollectorApi {
  const no = (): Promise<never> => Promise.reject(new ApiError(NO_SERVER));
  return {
    // The collector's own, typed on this phone and stored on this phone.
    profile: () => local.profile(),
    register: (name, phone) => local.register(name, phone),
    acceptAgreements: (acceptances) => local.acceptAgreements(acceptances),
    completeTraining: () => local.completeTraining(),
    submitExam: (answers) => local.submitExam(answers),
    // The platform's own. Nothing here may be invented.
    tasks: no,
    task: no,
    claimTask: no,
    myClaims: no,
    boundDevices: no,
    bindDevice: no,
    createSession: no,
    sessions: no,
    episodes: no,
    confirmUpload: no,
    income: no,
  };
}
