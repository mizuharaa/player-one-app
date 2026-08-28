import { useEffect, useState, type ComponentType } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import type { MockCollectorApi } from './api/mock.ts';
import { loadApi } from './api/persist.ts';
import { resume } from './resume.ts';
import { ApiProvider } from './api/context.tsx';
import { LocaleProvider } from './locale.tsx';
import { NavProvider, useNav, type Route, type RouteName } from './nav.tsx';
import { ThemeProvider } from './theme.tsx';
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

const queryClient = new QueryClient();

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
 * ponytail: still not the product's storage. Restoring a profile is not signing
 * in — there is no token, no session, and nothing to sign in to, so "the phone
 * still has this collector's file" is what stands in for auth. Upgrade path, in
 * order: replace `MockCollectorApi` with the HTTP client once the server's
 * collector endpoints and auth exist, which makes the restored profile a
 * cached identity rather than the identity; move the upload queue to
 * `expo-sqlite` when the Kotlin foreground service writes it too; move the
 * transfer itself into that TurboModule so it survives kill and Doze. The
 * `CollectorApi` interface is the seam all three land behind, and no screen
 * changes. Until then the queue on screen is still a demo — it survives a
 * restart, but nothing moves bytes.
 */
export function App() {
  const [boot, setBoot] = useState<{ api: MockCollectorApi; start: Route } | null>(null);

  useEffect(() => {
    void (async () => {
      const api = await loadApi();
      setBoot({ api, start: resume(await api.profile()) });
    })();
  }, []);

  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <LocaleProvider>
          {boot === null ? null : (
            <ApiProvider value={boot.api}>
              <QueryClientProvider client={queryClient}>
                <NavProvider initial={boot.start}>
                  <Current />
                </NavProvider>
              </QueryClientProvider>
            </ApiProvider>
          )}
        </LocaleProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
