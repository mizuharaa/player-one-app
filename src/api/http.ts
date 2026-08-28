import { ApiError } from './mock.ts';
import type { UploadQueue } from '../upload/queue.ts';
import type { PartBody, PartSource } from '../upload/worker.ts';
import type {
  AgreementId,
  BoundDevice,
  Claim,
  CollectionSession,
  CollectorApi,
  CollectorProfile,
  EpisodeState,
  EpisodeUpload,
  IncomeEntry,
  LocalisedText,
  SessionInput,
  Task,
} from './types.ts';

/**
 * The app's HTTP client for the platform API.
 *
 * ## What actually exists on the server, as of 2026-08-28
 *
 * Very little of `CollectorApi` does. Three sibling branches in the platform
 * repo carry the collector surface and **none of them has been merged into the
 * other two**, so there is no single deployable that serves all of it:
 *
 * - `feat/collector-auth` (234e879) — `POST /auth/collector/request-code`,
 *   `POST /auth/collector/verify`, and `GET /api/me` returning nothing but a
 *   role and a collector id. Its own comment says "Nothing else lives there
 *   yet."
 * - `feat/collector-money-api` (6de9467) — `GET /api/me/income` and
 *   `GET /api/me/episodes`. **Landed**, so those two screens are wired below.
 * - `feat/path-a-upload` (6f76635) — the three upload routes, driven by
 *   `src/upload/`, not from here.
 *
 * There is no route for registration, the six agreements, training, the exam,
 * the task hall, claiming, device binding or session creation. Thirteen of the
 * sixteen methods below therefore delegate to `fallback`, which is the same
 * `MockCollectorApi` the app ran on before. That delegation is listed method by
 * method rather than hidden behind a proxy, so "which of these is real" is
 * answered by reading the file, and moving one to the server is deleting one
 * line.
 *
 * ## The collector id
 *
 * It is in the token and nowhere else. It appears in no path, no query and no
 * body — every collector route is under `/api/me/`, and the server reads the id
 * out of the bearer token. Nothing in this file ever sends one.
 *
 * ## What must never reach a screen
 *
 * The server's refusals carry internal names: `constraint` values like
 * `upload_foreign_session`, raw zod `detail`, `expected_episode_id`,
 * `mismatches[].cloud_sha256`, storage `key`s and `ingest_id`s. None of them is
 * returned from here. Every failure leaves this file as an `ApiError` holding a
 * short app-side code, and `src/errors.ts` turns codes into Vietnamese
 * sentences and unknown codes into a generic one — an identifier can never be
 * rendered.
 */

/** Read once at module load; `src/api/config.ts` explains the switch. */
export interface HttpConfig {
  baseUrl: string;
  /** The bearer token, or null when signed out. Read per request, never cached. */
  token: () => string | null;
  /** Called on the first 401. Wipes the token and the cached money figures. */
  onUnauthorized: () => void;
}

const join = (baseUrl: string, path: string): string =>
  `${baseUrl.replace(/\/+$/, '')}${path}`;

/**
 * One request, one place where a status becomes an app-side code.
 *
 * `network` is its own code rather than a generic failure because the app tells
 * "we could not ask" apart from "the answer was no" on every screen already
 * (`LoadFailed` versus a `Note`), and a collector on a Vietnamese mobile
 * network hits the first one far more often than the second.
 */
export async function apiFetch(
  config: HttpConfig,
  path: string,
  init: RequestInit = {},
): Promise<Response> {
  const token = config.token();
  const headers = new Headers(init.headers);
  if (token !== null) headers.set('authorization', `Bearer ${token}`);
  if (init.body !== undefined && !headers.has('content-type')) {
    headers.set('content-type', 'application/json');
  }

  let response: Response;
  try {
    response = await fetch(join(config.baseUrl, path), { ...init, headers });
  } catch {
    // DNS, no route, TLS, aeroplane mode, a captive portal that resets the
    // connection. All of them are "we could not ask", and none of them is a
    // reason to sign anybody out.
    throw new ApiError('network');
  }

  if (response.status === 401) {
    // The 30-day token is spent, or the collector's token epoch was bumped
    // server-side. Both mean sign in again, and both mean the money figures on
    // this phone belong to somebody who is no longer proven to be here.
    config.onUnauthorized();
    throw new ApiError('unauthorized');
  }
  if (response.status === 403) throw new ApiError('forbidden');
  return response;
}

/** A JSON GET that either yields the parsed body or throws an `ApiError`. */
async function getJson<T>(config: HttpConfig, path: string): Promise<T> {
  const response = await apiFetch(config, path, { method: 'GET' });
  if (!response.ok) throw new ApiError('server_error');
  try {
    return (await response.json()) as T;
  } catch {
    throw new ApiError('server_error');
  }
}

/* ------------------------------------------------------------------ */
/* Sign-in. Not part of `CollectorApi`: there is no collector yet, so   */
/* there is nothing for a collector-scoped client to be.                */
/* ------------------------------------------------------------------ */

/**
 * `POST /auth/collector/request-code`. Always 204 whether or not the number is
 * enrolled — the server deliberately refuses to say, so neither does the app.
 *
 * The one status worth telling apart is 429: the server sends `retry_after` in
 * seconds and the app says "wait" rather than "wrong". Its `constraint` and
 * `reason` fields both read `sign_in_rate_limited`, which is an internal name
 * and is dropped here.
 */
export async function requestSignInCode(
  baseUrl: string,
  phone: string,
): Promise<void> {
  const config: HttpConfig = { baseUrl, token: () => null, onUnauthorized: () => {} };
  const response = await apiFetch(config, '/auth/collector/request-code', {
    method: 'POST',
    body: JSON.stringify({ phone }),
  });
  if (response.status === 204) return;
  if (response.status === 429) throw new ApiError('rate_limited');
  throw new ApiError('server_error');
}

/**
 * `POST /auth/collector/verify`. 200 carries `{ token }` and nothing else — no
 * id, no name, no expiry. The token is a 30-day one.
 *
 * A wrong number, a wrong code, an expired code and too many attempts all come
 * back as one 401 body, on purpose. The app does not try to tell them apart
 * either; one sentence covers all four.
 */
export async function verifySignInCode(
  baseUrl: string,
  phone: string,
  code: string,
): Promise<string> {
  const config: HttpConfig = { baseUrl, token: () => null, onUnauthorized: () => {} };
  let response: Response;
  try {
    response = await apiFetch(config, '/auth/collector/verify', {
      method: 'POST',
      body: JSON.stringify({ phone, code }),
    });
  } catch (error) {
    // `apiFetch` calls `onUnauthorized` on a 401, which is meaningless here —
    // there is no session to wipe — and rethrows `unauthorized`. On the verify
    // route a 401 is simply a bad code.
    if (error instanceof ApiError && error.code === 'unauthorized') {
      throw new ApiError('bad_code');
    }
    throw error;
  }
  if (response.status === 429) throw new ApiError('rate_limited');
  if (!response.ok) throw new ApiError('server_error');
  const body = (await response.json()) as { token?: unknown };
  if (typeof body.token !== 'string' || body.token === '') throw new ApiError('server_error');
  return body.token;
}

/* ------------------------------------------------------------------ */
/* The wire shapes, verbatim from the server's own field names.         */
/* ------------------------------------------------------------------ */

interface WireStateText {
  en?: unknown;
  vi?: unknown;
}

interface WireIncomeEpisode {
  episode_id?: unknown;
  effective_minutes?: unknown;
  amount?: unknown;
  confirmed?: unknown;
  state?: unknown;
  state_text?: WireStateText;
}

interface WireEpisode {
  episode_id?: unknown;
  state?: unknown;
  state_text?: WireStateText;
  size_bytes?: unknown;
  reasons?: unknown;
}

const text = (value: WireStateText | undefined): LocalisedText | undefined => {
  if (value === undefined) return undefined;
  const vi = typeof value.vi === 'string' ? value.vi : undefined;
  const en = typeof value.en === 'string' ? value.en : undefined;
  if (vi === undefined && en === undefined) return undefined;
  return { vi: vi ?? en ?? '', en: en ?? vi ?? '' };
};

const str = (value: unknown): string | null => (typeof value === 'string' ? value : null);

/**
 * The server's collector-facing state vocabulary, folded onto APP-23's six.
 *
 * The two sets are not the same size and never will be: APP-23 describes where
 * an episode is between the phone and the review lane, and the server's set
 * (`packages/api/src/me.ts`) describes where it is between the review lane and
 * a payment. Folding is lossy, and that is exactly why nothing on screen reads
 * the fold: `state_text` from the server is what the collector is shown, and
 * this mapping only picks the colour of the pill behind it. If a state the app
 * has never heard of appears, the sentence still arrives and is still true.
 */
const STATE_COLOURS: Record<string, EpisodeState> = {
  uploaded: 'uploaded',
  approved: 'review_passed',
  paid: 'review_passed',
  on_a_bill: 'review_passed',
  not_paid: 'review_passed',
  cannot_be_paid: 'review_failed',
  action_needed: 'under_review',
  waiting_on_us: 'under_review',
  on_hold: 'under_review',
  being_rechecked: 'under_review',
  unknown: 'under_review',
};

/**
 * The one field of `reasons[]` a collector may see.
 *
 * `reasons` comes back as `{ code, label }`. The `code` is an identifier from
 * `review_reason_codes` and is dropped here: a reason *code* on a collector's
 * screen is on the list of things that must never leak, and a Vietnamese
 * collector reading one learns nothing anyway. The `label` is the curated
 * collector-facing sentence for that code, which is what APP-27 asks for — a
 * failed review naming its reason in the collector's language.
 */
const reasonLabels = (reasons: unknown): string | undefined => {
  if (!Array.isArray(reasons)) return undefined;
  const labels = reasons
    .map((r) => (typeof r === 'object' && r !== null ? str((r as { label?: unknown }).label) : null))
    .filter((l): l is string => l !== null && l !== '');
  return labels.length === 0 ? undefined : labels.join(' · ');
};

/**
 * The three phone-shaped things the upload worker needs, supplied by
 * `src/upload/expo.ts`. Optional: a build with no queue simply never uploads.
 */
export interface UploadDriver {
  queue: UploadQueue;
  open: (uri: string) => PartSource;
  put: (url: string, body: PartBody) => Promise<void>;
}

export class HttpCollectorApi implements CollectorApi {
  /** One pass at a time. Two would race for the same delivery's parts. */
  private running = false;

  constructor(
    private readonly config: HttpConfig,
    /**
     * Everything the server has no route for, which today is most of it. The
     * mock the app already ran on, unchanged — see the file comment.
     */
    private readonly fallback: CollectorApi,
    private readonly uploads?: UploadDriver,
  ) {}

  /**
   * Carry on with deliveries the collector has already authorised.
   *
   * Called once at boot and again after each `confirmUpload`. This is not an
   * auto-upload and does not break APP-25: nothing reaches this queue that a
   * collector did not tap through the confirmation for, and the tap is what
   * authorises the episode rather than the individual attempt. A delivery
   * killed halfway is finished, not started.
   *
   * Not awaited by its callers. It runs for as long as gigabytes take, and no
   * screen waits on it — the Uploads screen reads the byte count out of the
   * queue on its next read.
   */
  resumeUploads(): void {
    const uploads = this.uploads;
    if (uploads === undefined || this.running) return;
    this.running = true;
    void uploads.queue
      .run({
        api: (path, init) => apiFetch(this.config, path, init),
        put: uploads.put,
        open: uploads.open,
        now: () => Date.now(),
      })
      .finally(() => {
        this.running = false;
      });
  }

  /* --- Real: GET /api/me/episodes -------------------------------- */

  /**
   * The local queue and the server's list, merged, server first.
   *
   * They are two different lists that overlap. The phone's queue is what this
   * collector has pulled off a device and not yet delivered — episodes the
   * server has never heard of, and the only ones `confirmUpload` can act on.
   * The server's list is every episode it holds, with where that episode is on
   * the way to being paid. Returning only the server's would make an episode
   * waiting on this phone vanish from the screen it is queued on, and a
   * collector who cannot see recorded footage assumes it is lost.
   *
   * Where both know an episode, the server wins: it is the one that has seen a
   * reviewer.
   */
  async episodes(): Promise<EpisodeUpload[]> {
    const [body, local] = await Promise.all([
      getJson<{ episodes?: unknown }>(this.config, '/api/me/episodes'),
      this.fallback.episodes(),
    ]);
    const rows = Array.isArray(body.episodes) ? (body.episodes as WireEpisode[]) : [];
    const fromServer = this.mapEpisodes(rows);
    const known = new Set(fromServer.map((e) => e.episodeId));
    const merged = [...fromServer, ...local.filter((e) => !known.has(e.episodeId))];
    return merged.map((episode) => {
      const queued = this.uploads?.queue.find(episode.episodeId);
      if (queued === undefined) return episode;
      return {
        ...episode,
        delivery: {
          sentBytes: queued.bytesSent,
          totalBytes: queued.totalBytes,
          interrupted: queued.state === 'failed',
        },
      };
    });
  }

  private mapEpisodes(rows: WireEpisode[]): EpisodeUpload[] {
    return rows.flatMap((row) => {
      const episodeId = str(row.episode_id);
      if (episodeId === null) return [];
      const state = str(row.state) ?? 'unknown';
      // `size_bytes` is a decimal STRING of whole bytes, not a number. A
      // 3 GB episode is 3221225472, which survives Number exactly (well under
      // 2^53), so the screen's "x.y GB" is not lying about the size.
      const sizeBytes = Number(str(row.size_bytes) ?? '0');
      return [
        {
          episodeId,
          sizeBytes: Number.isFinite(sizeBytes) ? sizeBytes : 0,
          state: STATE_COLOURS[state] ?? 'under_review',
          stateText: text(row.state_text),
          rejectReason: reasonLabels(row.reasons),
        },
      ];
    });
  }

  /* --- Real: GET /api/me/income ---------------------------------- */

  async income(): Promise<IncomeEntry[]> {
    const body = await getJson<{ episodes?: unknown }>(this.config, '/api/me/income');
    const rows = Array.isArray(body.episodes) ? (body.episodes as WireIncomeEpisode[]) : [];
    return rows.flatMap((row) => {
      const episodeId = str(row.episode_id);
      if (episodeId === null) return [];
      // `effective_minutes` and `amount` are decimal strings and are null
      // together, exactly when `confirmed` is false. They are carried through as
      // strings and never parsed: the client never computes a duration or an
      // amount, and `Number('10000.0000')` would be the first step towards it.
      const confirmed = row.confirmed === true;
      return [
        {
          episodeId,
          effectiveMinutes: str(row.effective_minutes),
          amountVnd: str(row.amount),
          kind: confirmed ? ('confirmed' as const) : ('estimated' as const),
          settlementState: str(row.state),
          settlementText: text(row.state_text),
        },
      ];
    });
  }

  /* --- No server route yet: the mock answers ---------------------- */
  /* Delete a line here the day the matching route lands.             */

  profile(): Promise<CollectorProfile | null> {
    return this.fallback.profile();
  }
  register(name: string, phone: string): Promise<CollectorProfile> {
    return this.fallback.register(name, phone);
  }
  acceptAgreements(
    acceptances: { agreementId: AgreementId; version: string }[],
  ): Promise<CollectorProfile> {
    return this.fallback.acceptAgreements(acceptances);
  }
  completeTraining(): Promise<CollectorProfile> {
    return this.fallback.completeTraining();
  }
  submitExam(answers: boolean[]): Promise<{ passed: boolean }> {
    return this.fallback.submitExam(answers);
  }
  tasks(): Promise<Task[]> {
    return this.fallback.tasks();
  }
  task(id: string): Promise<Task> {
    return this.fallback.task(id);
  }
  claimTask(taskId: string): Promise<Claim> {
    return this.fallback.claimTask(taskId);
  }
  myClaims(): Promise<Claim[]> {
    return this.fallback.myClaims();
  }
  boundDevices(): Promise<BoundDevice[]> {
    return this.fallback.boundDevices();
  }
  bindDevice(serial: string): Promise<BoundDevice> {
    return this.fallback.bindDevice(serial);
  }
  createSession(input: SessionInput): Promise<CollectionSession> {
    return this.fallback.createSession(input);
  }
  sessions(): Promise<CollectionSession[]> {
    return this.fallback.sessions();
  }
  /**
   * APP-25's single authorised entry point. It stays on the local queue: the
   * server's `POST /api/me/uploads` registers a *delivery*, which needs a full
   * ingest `EpisodeRecord` and the file bytes, and neither exists on a phone
   * whose device transfer is still a mock. `src/upload/` is the worker that
   * does the delivery once they do.
   */
  async confirmUpload(episodeId: string): Promise<EpisodeUpload> {
    // The mock still owns the gate — one confirmation per episode, and only
    // from `pending_upload`. It throws before anything is queued if the
    // confirmation has already been spent.
    const episode = await this.fallback.confirmUpload(episodeId);
    // Nothing is enqueued here. A delivery needs the ingest `EpisodeRecord` and
    // the files themselves, and both arrive from the device offload step that
    // does not exist yet (`src/device/transfer.ts` is a mock). When one is on
    // the queue for this episode, the tap starts it; when there is not, the
    // Uploads screen says there is no file on this phone to send.
    this.resumeUploads();
    return episode;
  }
}
