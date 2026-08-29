import { afterEach, describe, expect, it, vi } from 'vitest';
import { HttpCollectorApi, requestSignInCode, verifySignInCode } from '../src/api/http.ts';
import { NO_ROUTE, localOnly } from '../src/api/local.ts';
import { ApiError, MockCollectorApi } from '../src/api/mock.ts';
import type { CollectorApi } from '../src/api/types.ts';

/**
 * The HTTP client against the server's real response shapes.
 *
 * The bodies below are copied from the platform repo's own route files —
 * `packages/api/src/me.ts` on `feat/collector-money-api` and
 * `packages/api/src/credentials.ts` on `feat/collector-auth` — field name for
 * field name. That is the point of the test: the two repositories agree on
 * `effective_minutes` and `state_text` by a literal on each side of a boundary,
 * exactly as the six agreement identifiers already do, and a rename on either
 * side has to fail here rather than at the first real request from a phone.
 *
 * There is no server to run: the three collector branches have never been
 * merged into one another, so no single deployable serves auth and money and
 * uploads together. `fetch` is stubbed.
 */

const BASE = 'https://api.invalid';

function stubFetch(handler: (url: string, init: RequestInit) => Response) {
  const calls: { url: string; init: RequestInit }[] = [];
  vi.stubGlobal('fetch', async (url: string, init: RequestInit = {}) => {
    calls.push({ url, init });
    return handler(url, init);
  });
  return calls;
}

const json = (status: number, body: unknown): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });

/**
 * `fallback` defaults to what `src/App.tsx` actually builds: `localOnly` over
 * the phone's store. It used to be a bare `MockCollectorApi` here, which is the
 * `EXPO_PUBLIC_MOCK_DATA=1` wiring — so every test in this file was exercising
 * a build no collector gets, and the seeded rows it merged in were invented.
 * The two merge tests below opt back into that build on purpose, because seeded
 * rows are the only way to have a local list to merge at all.
 */
const client = (
  handler: (url: string, init: RequestInit) => Response,
  onUnauthorized: () => void = () => {},
  fallback: CollectorApi = localOnly(new MockCollectorApi()),
) => {
  const calls = stubFetch(handler);
  const api = new HttpCollectorApi(
    { baseUrl: BASE, token: () => 'tok-abc', onUnauthorized },
    fallback,
  );
  return { api, calls };
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('the collector id is in the token and nowhere else', () => {
  it('sends a bearer token and no identifier in the path or the query', async () => {
    const { api, calls } = client(() => json(200, { currency: 'VND', episodes: [] }));
    await api.income();

    expect(calls).toHaveLength(1);
    const call = calls[0];
    expect(call?.url).toBe('https://api.invalid/api/me/income');
    // No id, no phone, no collector anywhere in what goes out.
    expect(call?.url).not.toMatch(/col-|collector_id|phone/);
    expect(new Headers(call?.init.headers).get('authorization')).toBe('Bearer tok-abc');
    expect(call?.init.body).toBeUndefined();
  });
});

describe('GET /api/me/income', () => {
  const CONFIRMED = {
    episode_id: 'ego1-20260819-1120',
    task_name: 'Nấu ăn tại nhà',
    recorded_at: '20260819_112000',
    raw_minutes: '43.2000',
    effective_minutes: '41.5000',
    unit_price: '1200.0000',
    amount: '49800.0000',
    confirmed: true,
    state: 'not_paid',
    state_text: { en: 'Not paid yet', vi: 'Chưa thanh toán' },
    paid_at: null,
  };
  const ESTIMATED = {
    episode_id: 'ego1-20260820-1830',
    task_name: 'Làm việc văn phòng',
    recorded_at: '20260820_183000',
    raw_minutes: '55.0000',
    effective_minutes: null,
    unit_price: null,
    amount: null,
    confirmed: false,
    state: 'waiting_on_us',
    state_text: { en: 'Waiting on us', vi: 'Đang chờ chúng tôi xử lý' },
    paid_at: null,
  };

  it('carries money through as the strings the server sent', async () => {
    const { api } = client(() => json(200, { currency: 'VND', episodes: [CONFIRMED] }));
    const [entry] = await api.income();

    // Strings, not numbers. The client never computes a duration or an amount,
    // and parsing these would be the first step towards doing so — the server's
    // `quantise` is the only rounding site in the system.
    expect(entry?.effectiveMinutes).toBe('41.5000');
    expect(entry?.amountVnd).toBe('49800.0000');
    expect(typeof entry?.amountVnd).toBe('string');
  });

  it('calls an unconfirmed row estimated, and it has no figures at all', async () => {
    // APP-34: estimated is never presented as confirmed. On the server the
    // three money fields are null together, exactly when `confirmed` is false.
    const { api } = client(() => json(200, { currency: 'VND', episodes: [ESTIMATED] }));
    const [entry] = await api.income();

    expect(entry?.kind).toBe('estimated');
    expect(entry?.effectiveMinutes).toBeNull();
    expect(entry?.amountVnd).toBeNull();
  });

  it('keeps the server’s own sentence in both languages', async () => {
    const { api } = client(() => json(200, { currency: 'VND', episodes: [CONFIRMED] }));
    const [entry] = await api.income();

    expect(entry?.settlementText).toEqual({ en: 'Not paid yet', vi: 'Chưa thanh toán' });
  });
});

describe('GET /api/me/episodes', () => {
  const ROW = {
    episode_id: 'ego1-20260819-0640',
    recorded_at: '20260819_064000',
    state: 'cannot_be_paid',
    state_text: { en: 'Cannot be paid', vi: 'Không thể thanh toán' },
    size_bytes: '1073741824',
    reasons: [{ code: 'lens_obstructed', label: 'Ống kính bị che trong phần lớn thời lượng.' }],
  };

  it('reads the size out of a decimal string without losing a byte', async () => {
    const { api } = client(() => json(200, { episodes: [ROW] }));
    const found = (await api.episodes()).find((e) => e.episodeId === 'ego1-20260819-0640');
    expect(found?.sizeBytes).toBe(1_073_741_824);
  });

  it('shows the reason’s label and never its code', async () => {
    // The hard rule: a reason CODE on a collector's screen is a leak, and a
    // Vietnamese collector reading `lens_obstructed` learns nothing anyway.
    // The label is the curated collector-facing sentence APP-27 asks for.
    const { api } = client(() => json(200, { episodes: [ROW] }));
    const found = (await api.episodes()).find((e) => e.episodeId === 'ego1-20260819-0640');

    expect(found?.rejectReason).toBe('Ống kính bị che trong phần lớn thời lượng.');
    expect(JSON.stringify(found)).not.toContain('lens_obstructed');
  });

  it('stands the server’s list up alone when there is no local one', async () => {
    // The default build has no local episode list — the device offload that
    // would produce one is still a mock, so `localOnly` refuses — and that
    // refusal must not take the server's real list down with it. Drop the
    // catch in `episodes()` and this read fails outright, leaving a collector
    // told nothing about footage the server is holding.
    const { api } = client(() => json(200, { episodes: [ROW] }));
    const ids = (await api.episodes()).map((e) => e.episodeId);

    expect(ids).toEqual(['ego1-20260819-0640']);
  });

  it('keeps an episode the server has never heard of', async () => {
    // The local queue and the server's list are two lists that overlap. An
    // episode still waiting on this phone must not vanish from the screen it
    // is queued on, or a collector assumes the footage is lost. Seeded
    // fallback, i.e. the EXPO_PUBLIC_MOCK_DATA=1 build: it is the only one
    // with a local list.
    const { api } = client(() => json(200, { episodes: [ROW] }), () => {}, new MockCollectorApi());
    const ids = (await api.episodes()).map((e) => e.episodeId);

    expect(ids).toContain('ego1-20260819-0640');
    expect(ids).toContain('ego1-20260821-0715');
  });

  it('lets the server win where both know the episode', async () => {
    const { api } = client(
      () =>
        json(200, {
          episodes: [{ ...ROW, episode_id: 'ego1-20260821-0715', state: 'uploaded' }],
        }),
      () => {},
      new MockCollectorApi(),
    );
    const rows = (await api.episodes()).filter((e) => e.episodeId === 'ego1-20260821-0715');

    expect(rows).toHaveLength(1);
    expect(rows[0]?.state).toBe('uploaded');
  });

  it('does not throw away a state it has never seen', async () => {
    // The server's vocabulary is wider than APP-23's six and will grow. The
    // sentence still arrives and is still true; only the pill's colour is a
    // guess, and the colour is never the only thing carrying the state.
    const { api } = client(() =>
      json(200, {
        episodes: [{ ...ROW, state: 'some_state_invented_next_quarter' }],
      }),
    );
    const found = (await api.episodes()).find((e) => e.episodeId === 'ego1-20260819-0640');

    expect(found?.state).toBe('under_review');
    expect(found?.stateText?.vi).toBe('Không thể thanh toán');
  });
});

describe('a server that has no route for this is not a missing server', () => {
  it('re-labels every delegated refusal, and never says "not connected"', async () => {
    // The collector is signed in to a real server. `tasks`, `boundDevices`,
    // `createSession` and six more have no route on any merged branch, so the
    // fallback refuses them — but "the app is not connected to a server" is a
    // false sentence here and sends a collector to check their Wi-Fi.
    const { api } = client(() => json(200, { episodes: [] }));
    const calls: [string, () => Promise<unknown>][] = [
      ['tasks', () => api.tasks()],
      ['task', () => api.task('task-cook')],
      ['claimTask', () => api.claimTask('task-cook')],
      ['myClaims', () => api.myClaims()],
      ['boundDevices', () => api.boundDevices()],
      ['bindDevice', () => api.bindDevice('EGO1-PILOT-0007')],
      [
        'createSession',
        () =>
          api.createSession({
            taskId: 'task-cook',
            deviceSerial: 'EGO1-PILOT-0007',
            scenario: 'home',
            othersInFrame: false,
            sensitiveInfo: false,
          }),
      ],
      ['sessions', () => api.sessions()],
      ['confirmUpload', () => api.confirmUpload('ego1-20260821-0715')],
    ];

    for (const [name, call] of calls) {
      const error = await call().catch((e: unknown) => e);
      expect((error as Error).message, name).toBe(NO_ROUTE);
    }
  });

  it('leaves the collector’s own record alone — that one is answered', async () => {
    // The five onboarding methods are this phone's, not the platform's, and
    // wrapping them would turn a working screen into a refusal.
    const { api } = client(() => json(200, { episodes: [] }));
    expect(await api.profile()).toBeNull();
    expect((await api.register('Nguyễn Văn A', '0903000001')).name).toBe('Nguyễn Văn A');
  });
});

describe('a 401 signs the collector out', () => {
  it('fires the wipe once and reports it as a code, not as the server’s prose', async () => {
    let wiped = 0;
    const { api } = client(
      () => json(401, { error: 'collector token required' }),
      () => {
        wiped += 1;
      },
    );

    await expect(api.income()).rejects.toThrow(ApiError);
    expect(wiped).toBe(1);
    await expect(api.income()).rejects.toThrow('unauthorized');
    // The server's English sentence describes its own internals and never
    // reaches a screen; `src/errors.ts` turns `unauthorized` into Vietnamese.
    await api.income().catch((e: unknown) => {
      expect(String(e)).not.toContain('collector token required');
    });
  });

  it('does not sign anybody out because the network was down', async () => {
    let wiped = 0;
    const calls: string[] = [];
    vi.stubGlobal('fetch', async () => {
      calls.push('x');
      throw new TypeError('Network request failed');
    });
    const api = new HttpCollectorApi(
      {
        baseUrl: BASE,
        token: () => 'tok-abc',
        onUnauthorized: () => {
          wiped += 1;
        },
      },
      localOnly(new MockCollectorApi()),
    );

    await expect(api.income()).rejects.toThrow('network');
    expect(wiped).toBe(0);
  });
});

describe('sign-in', () => {
  it('asks for a code and treats 204 as sent, saying nothing about enrolment', async () => {
    const calls = stubFetch(() => new Response(null, { status: 204 }));
    await expect(requestSignInCode(BASE, '0903000001')).resolves.toBeUndefined();

    expect(calls[0]?.url).toBe('https://api.invalid/auth/collector/request-code');
    expect(calls[0]?.init.body).toBe(JSON.stringify({ phone: '0903000001' }));
  });

  it('turns a 429 into "wait", not into "wrong"', async () => {
    stubFetch(() =>
      json(429, {
        error: 'refused',
        constraint: 'sign_in_rate_limited',
        reason: 'sign_in_rate_limited',
        retry_after: 60,
      }),
    );
    await expect(requestSignInCode(BASE, '0903000001')).rejects.toThrow('rate_limited');
    // `sign_in_rate_limited` is an internal name and is dropped here.
    await requestSignInCode(BASE, '0903000001').catch((e: unknown) => {
      expect(String(e)).not.toContain('sign_in_rate_limited');
    });
  });

  it('returns the token from a verify, and nothing else is expected in the body', async () => {
    const calls = stubFetch(() => json(200, { token: 'v1.abc.def' }));
    await expect(verifySignInCode(BASE, '0903000001', '123456')).resolves.toBe('v1.abc.def');
    expect(calls[0]?.init.body).toBe(JSON.stringify({ phone: '0903000001', code: '123456' }));
  });

  it('reports one failure for a wrong number, a wrong code and an expired code', async () => {
    // The server deliberately answers all four with the same 401 body. The app
    // does not unpick it, and must not sign anything out on the way past.
    stubFetch(() => json(401, { error: 'credentials', reason: 'credentials' }));
    await expect(verifySignInCode(BASE, '0903000001', '000000')).rejects.toThrow('bad_code');
  });
});
