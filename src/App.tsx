import { useCallback, useEffect, useRef, useState, type ComponentType } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import type { CollectorApi } from './api/types.ts';
import { API_BASE_URL, usingMockData, usingServer } from './api/config.ts';
import { HttpCollectorApi } from './api/http.ts';
import { isNoServer, localOnly } from './api/local.ts';
import { loadApi } from './api/persist.ts';
import { clearSession, readSession, writeSession, type Session } from './auth.ts';
import { resume } from './resume.ts';
import { ApiProvider } from './api/context.tsx';
import { LocaleProvider } from './locale.tsx';
import { SessionProvider, type SessionControl } from './session.tsx';
import { NavProvider, useNav, type Route, type RouteName } from './nav.tsx';
import { ThemeProvider } from './theme.tsx';
import { expoSource, loadQueue, presignedPut } from './upload/expo.ts';
import { SignIn } from './screens/SignIn.tsx';
import { Agreements } from './screens/Agreements.tsx';
import { Devices } from './screens/Devices.tsx';
import { Exam } from './screens/Exam.tsx';
import { Home } from './screens/Home.tsx';
import { Income } from './screens/Income.tsx';
import { MyTasks } from './screens/MyTasks.tsx';
import { Provisioning } from './screens/Provisioning.tsx';
import { Register } from './screens/Register.tsx';
import { SessionCreate } from './screens/SessionCreate.tsx';
import { TaskDetail } from './screens/TaskDetail.tsx';
import { TaskHall } from './screens/TaskHall.tsx';
import { Training } from './screens/Training.tsx';
import { Uploads } from './screens/Uploads.tsx';

/**
 * Every route has a screen, checked by the compiler: a route added to `Route`
 * without a component here does not typecheck. That is the "every screen
 * reachable" guarantee in its cheapest enforceable form.
 */
const SCREENS: Record<RouteName, ComponentType> = {
  signIn: SignIn,
  register: Register,
  agreements: Agreements,
  training: Training,
  exam: Exam,
  home: Home,
  taskHall: TaskHall,
  taskDetail: TaskDetail,
  myTasks: MyTasks,
  devices: Devices,
  provisioning: Provisioning,
  sessionCreate: SessionCreate,
  uploads: Uploads,
  income: Income,
};

function Current() {
  const { route } = useNav();
  const Screen = SCREENS[route.name];
  return <Screen />;
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // "This build has no server" is an answer, not a lost packet. Retrying it
      // three times over seven seconds only delays the sentence that says so,
      // and leaves the screen on "Đang tải…" while it does. Everything else
      // keeps react-query's default three attempts.
      retry: (count, error) => !isNoServer(error) && count < 3,
    },
  },
});

/**
 * The app's state now outlives the process: `src/api/persist.ts` gives the mock
 * a JSON file in the document directory, written synchronously inside every
 * mutation, so registration, agreements, the exam result, claims, bound
 * devices, sessions and the upload queue all come back (NFR-03, NFR-04).
 *
 * Two consequences worth naming. Reading that file is I/O, so the api arrives
 * asynchronously and the app renders nothing until it does — a few milliseconds
 * behind Expo's splash screen, not a visible blank. And the opening screen is
 * no longer fixed: it is `resume()` in `src/resume.ts`, the first onboarding
 * step the restored collector had not finished.
 *
 * There are now two builds of the app, chosen by one environment variable at
 * bundle time (`src/api/config.ts`):
 *
 * - **`EXPO_PUBLIC_API_URL` unset — the default.** `MockCollectorApi`, exactly
 *   as before. No sign-in screen, no token, no network.
 * - **Set.** `HttpCollectorApi`, which serves `income()` and `episodes()` from
 *   the platform API and hands everything else to the same mock, because the
 *   server has no route for the rest yet. The app opens on sign-in, the token
 *   lives in `expo-secure-store` and never in the JSON file below, and a 401
 *   takes the token and every cached amount with it.
 *
 * ponytail: still not the product's storage. Onboarding — registration, the six
 * agreements, training, the exam, claiming, device binding, session creation —
 * is local to the phone in both builds, so the restored profile is still what
 * stands in for an account. It is no longer what stands in for *auth*: the
 * token is. Upgrade path, in order: point each delegated method in
 * `src/api/http.ts` at its route as that route lands; move the upload queue to
 * `expo-sqlite` when the Kotlin foreground service writes it too; move the
 * transfer itself into that TurboModule so it survives kill and Doze. The
 * `CollectorApi` interface is the seam all three land behind, and no screen
 * changes.
 */
export function App() {
  const [boot, setBoot] = useState<{ api: CollectorApi; start: Route } | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  /**
   * The live token, read fresh by every request.
   *
   * A ref and not the state above, because `HttpCollectorApi` is built once at
   * boot and would otherwise close over whatever token existed then — which is
   * `null`, so every request after signing in would go out unauthenticated.
   */
  const token = useRef<string | null>(null);

  /**
   * The token and every cached money figure leave together.
   *
   * `queryClient.clear()` is not tidiness. The income and episode caches hold
   * amounts and settlement states belonging to whoever was signed in, and a
   * shared phone is normal in this pilot: without this, the next collector to
   * open the app sees the last one's pay while their own request is in flight.
   * Changing `session` also remounts the navigation stack below, so the screen
   * they were on does not survive the handover either.
   */
  const signOut = useCallback(() => {
    token.current = null;
    setSession(null);
    void clearSession();
    queryClient.clear();
  }, []);

  const signIn = useCallback(async (next: Session) => {
    await writeSession(next);
    token.current = next.token;
    setSession(next);
  }, []);

  useEffect(() => {
    void (async () => {
      const store = await loadApi();
      const start = resume(await store.profile());
      // What the app is allowed to show when nothing can be asked. The mock's
      // seeded tasks, episodes and income are opt-in now; the default keeps the
      // collector's own onboarding record and refuses to invent the rest.
      const local = usingMockData() ? store : localOnly(store);
      if (!usingServer() || API_BASE_URL === null) {
        setBoot({ api: local, start });
        return;
      }
      const restored = await readSession();
      token.current = restored?.token ?? null;
      setSession(restored);
      const api = new HttpCollectorApi(
        {
          baseUrl: API_BASE_URL,
          token: () => token.current,
          // A 401 is the server saying this token is spent or revoked. There is
          // no refresh to try: it wipes and returns to sign-in.
          onUnauthorized: () => signOut(),
        },
        local,
        { queue: await loadQueue(), open: expoSource, put: presignedPut },
      );
      setBoot({ api, start });
      // Deliveries the collector already authorised and the app was killed in
      // the middle of. Finishing one is not starting one, so APP-25 is intact:
      // nothing reaches that queue without a tap through the confirmation, and
      // an episode with no delivery on the queue does nothing here.
      if (restored !== null) api.resumeUploads();
    })();
  }, [signOut]);

  const control: SessionControl = { session, signIn, signOut };
  // Signed out on a server build means the sign-in screen and nothing behind
  // it. On a mock build `usingServer()` is false and this is never true, so the
  // app opens exactly where it did before.
  const start: Route =
    usingServer() && session === null ? { name: 'signIn' } : (boot?.start ?? { name: 'register' });

  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <LocaleProvider>
          {boot === null ? null : (
            <ApiProvider value={boot.api}>
              <SessionProvider value={control}>
                <QueryClientProvider client={queryClient}>
                  {/*
                    Keyed on the session so signing in or out rebuilds the stack
                    from its first screen. Without the key the collector who
                    just signed out would still be four screens deep in the
                    previous collector's history.
                  */}
                  <NavProvider key={session?.token ?? 'signed-out'} initial={start}>
                    <Current />
                  </NavProvider>
                </QueryClientProvider>
              </SessionProvider>
            </ApiProvider>
          )}
        </LocaleProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
