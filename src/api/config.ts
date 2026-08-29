/**
 * Which back end the app talks to, decided once at bundle time.
 *
 * `EXPO_PUBLIC_API_URL` unset — the default, and the state every existing
 * checkout is in — means no server at all. Set it to the platform API's origin
 * (`https://…`, or `http://192.168.x.x:3000` on a LAN) and the app talks to
 * that instead. No toggle inside the app, on purpose: one would let a collector
 * point their phone at a machine that is not the platform.
 *
 * Expo inlines `EXPO_PUBLIC_*` into the bundle when Metro starts, so changing
 * either variable here means restarting `npx expo start`.
 */
export const API_BASE_URL: string | null = process.env.EXPO_PUBLIC_API_URL ?? null;

/** True when this build talks to a server. */
export const usingServer = (): boolean => API_BASE_URL !== null && API_BASE_URL !== '';

/**
 * Whether the mock's seeded rows are allowed on screen. Off unless asked for.
 *
 * The mock seeds tasks, episodes and income — invented work at invented prices,
 * invented upload states, and an invented amount of money. That was what a
 * collector saw by default, and an invented figure on the income screen is one
 * a person can believe. The default is now `src/api/local.ts`: the collector's
 * own onboarding record, which is genuinely on this phone, and an honest "not
 * connected to a server yet" everywhere the answer belongs to the platform.
 *
 * `EXPO_PUBLIC_MOCK_DATA=1 npx expo start` puts the seed back, for exercising a
 * layout that has no route behind it yet. It is a bundle-time switch like the
 * one above, and for the same reason: nothing inside the app can turn it on.
 */
export const usingMockData = (): boolean => process.env.EXPO_PUBLIC_MOCK_DATA === '1';
