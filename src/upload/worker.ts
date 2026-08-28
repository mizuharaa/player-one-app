/**
 * Path A delivery: getting an episode's files from this phone into the
 * platform's object store, and surviving being interrupted.
 *
 * Three server calls, from `packages/api/src/collector-upload.ts` on
 * `feat/path-a-upload` (6f76635):
 *
 * 1. `POST /api/me/uploads` registers the delivery and answers with a plan —
 *    one entry per file, each either already held, or a single presigned `PUT`
 *    url, or a list of 64 MiB parts each with its own presigned url.
 * 2. The phone `PUT`s the bytes **straight at those urls**. Media never passes
 *    through the API.
 * 3. `POST /api/me/uploads/:id/complete` assembles the multiparts, downloads
 *    every object back and re-hashes it. No request body at all.
 *
 * ## Where resume lives, and why it is not a list of part numbers here
 *
 * The server is the authority on what it already holds. `GET /api/me/uploads/:id`
 * re-plans a delivery: a part it holds at the planned size comes back in
 * `held_parts` and is **absent from `parts`**, so a plan is by construction a
 * list of what is still missing. Sending a part twice is therefore not
 * prevented by bookkeeping on the phone — it is prevented by never being asked
 * for.
 *
 * That leaves exactly one thing this phone must remember across a kill: the
 * delivery's `id`. It is a client-generated uuid and it is the server's primary
 * key and idempotency key, so re-posting it replays rather than starting a
 * second delivery. `src/upload/queue.ts` is what writes it down, in the same
 * document-directory JSON discipline `src/api/persist.ts` uses.
 *
 * ## What is deliberately not sent
 *
 * No ETags. `finishMultipart` on the server builds its part list from S3's own
 * `ListParts`, and its comment says why: an ETag is the store's receipt, and
 * routing it out through a phone and back adds a way for the assembly to name
 * something that was never stored. `/complete` ignores any body it is given.
 *
 * No sha256 computed here either. The digest in the plan is the ingest tool's,
 * over the whole file, and hashing multiple gigabytes in JavaScript on a phone
 * is not something this app will ever do.
 */

/** One file of an episode, as it sits on this phone. */
export interface DeliveryFile {
  /** The path the server plans against — no separators, no `.` or `..`. */
  relativePath: string;
  /** Where the bytes are on this phone. Opaque to the worker. */
  uri: string;
}

export interface Delivery {
  /**
   * A client-generated uuid. The server's `collector_uploads.id`: its primary
   * key, and the only idempotency there is. Generated once, persisted, and
   * never regenerated on a retry — a new one would register a second delivery
   * of the same episode.
   */
  id: string;
  /** The episode this delivers, so the Uploads screen can find its row. */
  episodeId: string;
  collectionSessionId: string;
  /**
   * The ingest `EpisodeRecord`, passed through to the server untouched.
   *
   * `unknown` on purpose. It is a 1.1.0 schema document produced by the ingest
   * engine reading a TF card — streams, timing, calibration, per-file sha256 —
   * and the app neither writes it nor reads it. Re-declaring its shape here
   * would be a second copy of a contract this repo cannot verify.
   */
  episode: unknown;
  files: DeliveryFile[];
  /** Every file's bytes added up, recorded when the delivery is queued. */
  totalBytes: number;
}

export type DeliveryState = 'queued' | 'sending' | 'delivered' | 'failed';

/** A delivery plus everything about it that has to survive a kill. */
export interface QueuedDelivery extends Delivery {
  state: DeliveryState;
  /** True once `POST /api/me/uploads` has succeeded at least once. */
  registered: boolean;
  /** Bytes this phone has actually PUT, across every attempt. */
  bytesSent: number;
  /** Milliseconds spent sending, across every attempt. */
  elapsedMs: number;
  /**
   * Why the last attempt stopped, as a short app-side code — never the
   * server's own `constraint` value or prose. `src/errors.ts` translates it.
   */
  lastError?: string;
}

/**
 * What one `PUT` carries.
 *
 * Not the DOM's `BodyInit`: React Native's own lib calls that type `BodyInit_`
 * and Node's is different again, so naming the four things this actually sends
 * is the portable spelling. A `Blob` is the one that matters — that is how
 * `expo-file-system` hands over a 64 MiB slice without the bytes passing
 * through JavaScript.
 */
export type PartBody = Blob | ArrayBuffer | ArrayBufferView | string;

/** Bytes `[start, end)` of one local file, in whatever form `fetch` can send. */
export interface PartSource {
  body(start: number, end: number): Promise<PartBody>;
}

export interface DeliveryDeps {
  /** An authenticated request to the platform API. `apiFetch` from `src/api/http.ts`. */
  api: (path: string, init?: RequestInit) => Promise<Response>;
  /**
   * A `PUT` at a presigned url.
   *
   * Separate from `api` and deliberately carrying **no** `Authorization`
   * header: a presigned S3 url is authenticated by its own signature, and an
   * extra `Authorization` header on the request makes S3 reject it. Nothing
   * else is signed either — no `Content-MD5`, no `x-amz-checksum-*`, no ACL —
   * so adding a header here is a way to break a working upload.
   */
  put: (url: string, body: PartBody) => Promise<void>;
  open: (uri: string) => PartSource;
  now: () => number;
  /** Called after every part lands, with the delivery's running byte total. */
  onProgress?: (bytesSent: number) => void;
}

/** The shape of one entry of the server's plan. Field names are the server's. */
interface FilePlan {
  relative_path: string;
  bytes: number;
  done: boolean;
  put_url?: string;
  parts?: { part_number: number; start: number; end: number; bytes: number; url: string }[];
}

/**
 * The refusals `/uploads` can answer with, as short app-side codes.
 *
 * The server's `constraint` values are internal names — `upload_foreign_session`
 * says another collector's session exists, `upload_payload_too_large` names a
 * limit nobody on a phone can act on — and none of them may reach a screen.
 * They are folded here into the three things a collector can actually do
 * something about: wait, stop, or nothing at all.
 */
const REFUSALS: Record<string, string> = {
  upload_checksum_mismatch: 'upload_damaged',
  upload_already_complete: 'upload_done_already',
  upload_superseded: 'upload_done_already',
  upload_payload_too_large: 'upload_too_large',
  upload_unknown_session: 'upload_no_session',
  upload_foreign_session: 'upload_no_session',
};

async function refusalCode(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { constraint?: unknown };
    const constraint = typeof body.constraint === 'string' ? body.constraint : '';
    return REFUSALS[constraint] ?? 'upload_refused';
  } catch {
    return 'upload_refused';
  }
}

/** A failure that stops this attempt, holding a code and never server prose. */
export class DeliveryError extends Error {
  constructor(readonly code: string) {
    super(code);
  }
}

async function plan(deps: DeliveryDeps, item: QueuedDelivery): Promise<FilePlan[]> {
  // Registered already: ask what is still missing. Never registered: register.
  // Re-posting the same `id` would also replay and re-plan, but the GET is the
  // route written for this and it does not re-send the whole EpisodeRecord over
  // a mobile connection to learn one number.
  const response = item.registered
    ? await deps.api(`/api/me/uploads/${item.id}`, { method: 'GET' })
    : await deps.api('/api/me/uploads', {
        method: 'POST',
        body: JSON.stringify({
          id: item.id,
          collection_session_id: item.collectionSessionId,
          episode: item.episode,
        }),
      });

  if (response.status === 409) throw new DeliveryError(await refusalCode(response));
  if (!response.ok) throw new DeliveryError('upload_refused');

  const body = (await response.json()) as { files?: unknown };
  return Array.isArray(body.files) ? (body.files as FilePlan[]) : [];
}

/**
 * Send one delivery as far as it will go, and say what moved.
 *
 * Returns the item with its state, byte total and elapsed time updated. It
 * never throws: a caller persisting the result must be able to persist a
 * failure too, and an exception escaping here would lose the bytes that DID
 * land along with the reason they stopped.
 */
export async function deliver(
  deps: DeliveryDeps,
  item: QueuedDelivery,
): Promise<QueuedDelivery> {
  const started = deps.now();
  let sent = item.bytesSent;
  const stop = (state: DeliveryState, lastError?: string): QueuedDelivery => ({
    ...item,
    state,
    registered: state === 'queued' ? item.registered : true,
    bytesSent: sent,
    elapsedMs: item.elapsedMs + (deps.now() - started),
    ...(lastError === undefined ? {} : { lastError }),
  });

  try {
    const files = await plan(deps, item);
    const sources = new Map(item.files.map((f) => [f.relativePath, f.uri]));

    for (const file of files) {
      if (file.done) continue;
      const uri = sources.get(file.relative_path);
      // The plan names a file this phone does not have. It cannot be invented,
      // and completing without it would fail the server's read-back anyway.
      if (uri === undefined) return stop('failed', 'upload_missing_file');
      const source = deps.open(uri);

      if (file.put_url !== undefined) {
        // Small enough that the server did not multipart it: one whole object.
        await deps.put(file.put_url, await source.body(0, file.bytes));
        sent += file.bytes;
        deps.onProgress?.(sent);
        continue;
      }

      // Parts are 1-indexed and `end` is exclusive, so `bytes === end - start`.
      // Only the missing ones are here: anything the server already holds at
      // the planned size came back in `held_parts` and was left out of `parts`,
      // which is what makes "a part already sent is not re-sent" true without
      // this phone keeping a list.
      for (const part of file.parts ?? []) {
        await deps.put(part.url, await source.body(part.start, part.end));
        sent += part.bytes;
        deps.onProgress?.(sent);
      }
    }

    const done = await deps.api(`/api/me/uploads/${item.id}/complete`, { method: 'POST' });
    if (done.status === 409) {
      const code = await refusalCode(done);
      // A checksum mismatch is a retry path, not a verdict: the next attempt
      // re-plans, the server reports the delivery failed, every file is
      // re-planned with `force` and the bytes go again.
      return stop(code === 'upload_done_already' ? 'delivered' : 'failed', code);
    }
    if (!done.ok) return stop('failed', 'upload_refused');
    return stop('delivered');
  } catch (error) {
    if (error instanceof DeliveryError) return stop('failed', error.code);
    // A dropped connection mid-part. The bytes that landed are the server's
    // now, and the next attempt will not be offered them again.
    return stop('failed', 'network');
  }
}
