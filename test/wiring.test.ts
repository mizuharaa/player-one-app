import { createElement, type ReactElement } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import TestRenderer, { act, type ReactTestRenderer } from 'react-test-renderer';

vi.mock('react-native', async () => (await import('./native-stubs.ts')).reactNative);
vi.mock('react-native-safe-area-context', async () => (await import('./native-stubs.ts')).safeArea);
vi.mock('expo-file-system', async () => (await import('./native-stubs.ts')).expoFileSystem);
vi.mock('expo-secure-store', async () => (await import('./native-stubs.ts')).expoSecureStore);

/**
 * The api `App` puts in front of its screens, read back out.
 *
 * React 19 builds no test instance for a context provider, so there is no way
 * to ask the rendered tree what `ApiProvider` was given. This wraps the real
 * one, records the value, and renders it unchanged — the app's own wiring, not
 * a substitute for it.
 */
const provided = vi.hoisted(() => ({ api: [] as unknown[] }));
vi.mock('../src/api/context.tsx', async (original) => {
  const actual = await original<typeof import('../src/api/context.tsx')>();
  return {
    ...actual,
    ApiProvider: (props: { value: unknown; children?: unknown }) => {
      provided.api.push(props.value);
      return createElement(actual.ApiProvider, props as never);
    },
  };
});

import { App } from '../src/App.tsx';
import { ApiProvider } from '../src/api/context.tsx';
import { NO_ROUTE, NO_SERVER, localOnly } from '../src/api/local.ts';
import { MockCollectorApi } from '../src/api/mock.ts';
import { MESSAGES } from '../src/i18n.ts';
import { NavProvider } from '../src/nav.tsx';
import { SessionProvider } from '../src/session.tsx';
import { Register } from '../src/screens/Register.tsx';
import { SessionCreate } from '../src/screens/SessionCreate.tsx';
import { Home } from '../src/screens/Home.tsx';
import { LoadFailed } from '../src/ui.tsx';
import type { CollectorApi } from '../src/api/types.ts';

/**
 * The wiring, asserted where the app ships it rather than where a test rebuilds it.
 *
 * Every test below renders a component this repo actually mounts — `App` itself,
 * or a screen with the providers `App` puts around it — because the defect these
 * exist for is a *default* being wrong, and a hand-built `localOnly(new
 * MockCollectorApi())` in a test cannot notice that `App.tsx` stopped calling it.
 * `src/api/local.ts` was fully covered by `no-server.test.ts` and the one line
 * that decides whether the app uses it was not, so replacing that line with
 * `const local = store` left the whole suite green and the mock's invented
 * income back on a collector's screen.
 *
 * `test/native-stubs.ts` is what makes rendering possible at all in node.
 */

// React's "act() is legal here" flag. Without it every render logs a warning.
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const vi_ = MESSAGES.vi;

beforeEach(() => {
  // Both builds are chosen by an env var read at boot; the default is neither set.
  vi.stubEnv('EXPO_PUBLIC_MOCK_DATA', '');
  provided.api.length = 0;
});

afterEach(() => {
  vi.unstubAllEnvs();
});

/** Mount, and let the boot effect and every query settle before looking. */
async function render(node: ReactElement): Promise<ReactTestRenderer> {
  let renderer: ReactTestRenderer | null = null;
  await act(async () => {
    renderer = TestRenderer.create(node);
  });
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
  if (renderer === null) throw new Error('render produced nothing');
  return renderer;
}

/** The api the running app handed its screens. */
function bootedApi(): CollectorApi {
  const api = provided.api.at(-1);
  if (api === undefined) throw new Error('the app mounted no ApiProvider');
  return api as CollectorApi;
}

/** Every string the tree would put in front of a collector, in one haystack. */
const shown = (renderer: ReactTestRenderer): string => JSON.stringify(renderer.toJSON());

/** A screen as `App` mounts it: an api, a session, a navigator. */
const screen = (
  api: CollectorApi,
  Screen: () => ReactElement | null,
  session: { token: string; phone: string } | null = null,
): ReactElement =>
  createElement(
    ApiProvider,
    { value: api },
    createElement(
      SessionProvider,
      { value: { session, signIn: async () => {}, signOut: () => {} } },
      createElement(
        QueryClientProvider,
        { client: new QueryClient({ defaultOptions: { queries: { retry: false } } }) },
          createElement(NavProvider, {
          initial: { name: 'home' },
          children: createElement(Screen),
        }),
      ),
    ),
  );

describe('what the shipped App hands its screens', () => {
  it('refuses the mock’s invented rows on the default build', async () => {
    // The rule `src/api/local.ts` exists to enforce, read off the running app:
    // whatever `App` puts in the api context is what every screen will ask.
    await render(createElement(App));
    const api = bootedApi();

    const income = await api.income().catch((e: unknown) => e);
    expect((income as Error).message).toBe(NO_SERVER);
    // The exact row a collector was shown before `localOnly` existed. It is a
    // number a person can believe, and nobody sent it.
    expect(JSON.stringify(income)).not.toContain('62400');
    expect(await api.tasks().catch((e: unknown) => (e as Error).message)).toBe(NO_SERVER);
    expect(await api.boundDevices().catch((e: unknown) => (e as Error).message)).toBe(NO_SERVER);
    // The collector's own onboarding record still answers — it is on this phone.
    expect(await api.profile()).toBeNull();
  });

  it('puts the seed back under EXPO_PUBLIC_MOCK_DATA=1, and only then', async () => {
    vi.stubEnv('EXPO_PUBLIC_MOCK_DATA', '1');
    await render(createElement(App));
    const api = bootedApi();

    const income = await api.income();
    expect(income.length).toBeGreaterThan(0);
    expect(JSON.stringify(income)).toContain('62400');
  });

  it('does not retry an answer that will not change', async () => {
    // `no_server` and `no_route` are answers, not lost packets. Retrying them
    // three times over seven seconds only holds the screen on "Đang tải…".
    const renderer = await render(createElement(App));
    const client = renderer.root.findByType(QueryClientProvider).props.client as QueryClient;
    const retry = client.getDefaultOptions().queries?.retry;
    if (typeof retry !== 'function') throw new Error('the app stopped deciding its own retries');

    expect(retry(0, new Error(NO_SERVER))).toBe(false);
    expect(retry(0, new Error(NO_ROUTE))).toBe(false);
    expect(retry(0, new Error('network'))).toBe(true);
  });
});

describe('a read that produced nothing says which nothing it was', () => {
  const failed = (error: unknown) =>
    screen(localOnly(new MockCollectorApi()), () =>
      createElement(LoadFailed, { title: 'x', error, onRetry: () => {} }),
    );

  it('offers no retry for a build with no server, because the sentence would not change', async () => {
    const text = shown(await render(failed(new Error(NO_SERVER))));
    expect(text).toContain(vi_['common.noServer']);
    expect(text).not.toContain(vi_['common.retry']);
    expect(text).not.toContain(vi_['common.loadFailed']);
  });

  it('tells a server with no route apart from no server at all', async () => {
    const text = shown(await render(failed(new Error(NO_ROUTE))));
    expect(text).toContain(vi_['common.noRoute']);
    expect(text).not.toContain(vi_['common.noServer']);
    expect(text).not.toContain(vi_['common.retry']);
  });

  it('still offers a retry when the read simply failed', async () => {
    const text = shown(await render(failed(new Error('network'))));
    expect(text).toContain(vi_['common.loadFailed']);
    expect(text).toContain(vi_['common.retry']);
    expect(text).not.toContain(vi_['common.noServer']);
  });
});

describe('the session screen keeps the part that is its own', () => {
  it('states why the pickers are empty instead of ordering work already done', async () => {
    const text = shown(await render(screen(localOnly(new MockCollectorApi()), SessionCreate)));

    // "Claim a task first" and "bind a device first" are instructions, and an
    // instruction is a claim about the collector's own record.
    expect(text).not.toContain(vi_['session.needClaim']);
    expect(text).not.toContain(vi_['session.needDevice']);
    expect(text).toContain(vi_['common.noServer']);
    // PRV-02 and the two APP-17b declarations are this screen's own and survive.
    expect(text).toContain(vi_['session.privacyAvoid']);
    expect(text).toContain(vi_['session.othersTitle']);
  });
});

describe('the home screen', () => {
  it('says why Wi-Fi configuration is greyed out, rather than only greying it', async () => {
    // `boundDevices` rejects, so `devices.data` is undefined, so the "no device
    // bound" note is guarded off — and the provisioning button greys with no
    // sentence anywhere. State carried by styling alone is what this app does
    // not ship.
    const text = shown(await render(screen(localOnly(new MockCollectorApi()), Home)));

    expect(text).toContain(vi_['home.gateDeviceUnknown']);
    // Not the sentence that claims nothing is bound: nobody knows that.
    expect(text).not.toContain(vi_['home.gateDevice']);
  });
});

describe('registration, for someone who has already proved their number', () => {
  const SESSION = { token: 'tok-abc', phone: '0903000001' };

  it('explains why it is still asking, and shows the number it has', async () => {
    const text = shown(
      await render(screen(localOnly(new MockCollectorApi()), Register, SESSION)),
    );

    expect(text).toContain(vi_['register.signedIn']);
    expect(text).toContain('0903000001');
  });

  it('is standing text, not a live region a screen reader is interrupted at', async () => {
    // `Note` sets accessibilityLiveRegion="polite" for what the machine says
    // after an action. This paragraph is present on mount, so it belongs in
    // reading order — the rule `SessionCreate`'s privacy card already follows.
    const renderer = await render(screen(localOnly(new MockCollectorApi()), Register, SESSION));
    const announced = renderer.root
      .findAll((node) => node.props['accessibilityLiveRegion'] === 'polite')
      .map((node) => JSON.stringify(node.props));

    expect(announced.join(' ')).not.toContain(vi_['register.signedIn']);
  });

  it('says none of it to a collector who is not signed in', async () => {
    const text = shown(await render(screen(localOnly(new MockCollectorApi()), Register)));
    expect(text).not.toContain(vi_['register.signedIn']);
  });
});
