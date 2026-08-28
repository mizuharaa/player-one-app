/**
 * Which back end the app talks to, decided once at bundle time.
 *
 * `EXPO_PUBLIC_API_URL` unset — the default, and the state every existing
 * checkout is in — means the in-memory mock, exactly as before. Set it to the
 * platform API's origin (`https://…`, or `http://192.168.x.x:3000` on a LAN)
 * and the app talks to that instead. No other switch exists, on purpose: a
 * toggle inside the app would let a collector point their phone at a machine
 * that is not the platform.
 *
 * Expo inlines `EXPO_PUBLIC_*` into the bundle when Metro starts, so changing
 * it means restarting `npx expo start`. That is the whole reason the mock is
 * the default: a running preview session keeps working untouched.
 */
export const API_BASE_URL: string | null = process.env.EXPO_PUBLIC_API_URL ?? null;

/** True when this build talks to a server rather than the mock. */
export const usingServer = (): boolean => API_BASE_URL !== null && API_BASE_URL !== '';
