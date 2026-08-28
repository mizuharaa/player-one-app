import { File, Paths } from 'expo-file-system';
import { restoreQueue, type UploadQueue } from './queue.ts';
import type { PartBody, PartSource, QueuedDelivery } from './worker.ts';

/**
 * The phone-shaped ends of the upload worker: the file the queue lives in, the
 * bytes it sends, and the request that sends them.
 *
 * NFR-04 asks for upload state that survives the app exiting or being killed.
 * The mechanism is the one `src/api/persist.ts` established: one JSON file in
 * the **document** directory — Android reclaims the cache under storage
 * pressure, and a kill for being in the way is still a kill — written
 * **synchronously** inside every mutation, so the write has landed before the
 * call that caused it returns.
 *
 * A separate file from `player-one-state.json`, not a field inside it, for one
 * reason: `loadApi` throws a state file it cannot parse away and starts fresh,
 * which is right for a scaffold's demo data and wrong for a half-delivered
 * episode. Losing this file loses the delivery ids, and losing a delivery id
 * means the next attempt registers a second delivery instead of resuming the
 * first.
 *
 * ponytail: still a whole-file rewrite, and still right for one collector's few
 * episodes. It stops being right the day the Kotlin foreground service in
 * DEVICE_DEPS.md is a second writer — that is when `expo-sqlite` earns its
 * schema, and the same day the transfer itself should move into that service so
 * it survives Doze instead of needing the app awake.
 */
const file = new File(Paths.document, 'player-one-uploads.json');

export async function loadQueue(): Promise<UploadQueue> {
  let restored: QueuedDelivery[] = [];
  try {
    if (file.exists) {
      const parsed: unknown = JSON.parse(await file.text());
      if (Array.isArray(parsed)) restored = parsed as QueuedDelivery[];
    } else {
      file.create({ intermediates: true });
    }
  } catch {
    restored = [];
  }
  return restoreQueue(restored, (items) => {
    try {
      file.write(JSON.stringify(items));
    } catch {
      // A full disk or a revoked directory. The queue in memory is still
      // correct for this run, and throwing here would turn a save failure into
      // a failed upload — losing the delivery the save was protecting.
    }
  });
}

/**
 * Bytes `[start, end)` of a file on this phone.
 *
 * `expo-file-system`'s `File` implements `Blob`, so `slice` hands back a body
 * `fetch` can send without the bytes passing through JavaScript. That matters:
 * a part is 64 MiB, and reading one into a JS array to send it would cost the
 * phone 64 MiB of heap per part.
 *
 * ponytail: unverified on a device. Nothing in this repo can run a real upload
 * yet — `test/upload.test.ts` measures the worker over real HTTP against a stub
 * server instead. If a device shows React Native's fetch copying the blob
 * rather than streaming it, the replacement is `File.createUploadTask`, which
 * uploads natively with progress, or the foreground service.
 */
export const expoSource = (uri: string): PartSource => {
  const source = new File(uri);
  return { body: async (start, end) => source.slice(start, end) };
};

/**
 * A `PUT` at a presigned url, with nothing added to it.
 *
 * No `Authorization` header — the url carries its own signature and a second
 * credential makes S3 reject the request. No `Content-Type` and no checksum
 * headers either: the server signed `PutObject`/`UploadPart` with none of them,
 * so an extra `x-amz-*` here is a signature mismatch waiting to happen.
 */
export async function presignedPut(url: string, body: PartBody): Promise<void> {
  const response = await fetch(url, { method: 'PUT', body: body as BodyInit_ });
  if (!response.ok) throw new Error('part_rejected');
}
