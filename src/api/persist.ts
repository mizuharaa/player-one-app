import { File, Paths } from 'expo-file-system';
import { MockCollectorApi, type MockState } from './mock.ts';

/**
 * The mock's durable store: one JSON file in the app's document directory.
 *
 * NFR-03 (no data loss on task claiming, collection-session creation or episode
 * binding) and NFR-04 (upload state recoverable after the app exits or is
 * killed) are the whole requirement here, and the whole state is one small
 * object, so one file is the whole answer. `File.write` is **synchronous**,
 * which is what makes NFR-03 true rather than likely: the write has landed
 * before the mutation that caused it returns, so there is no window in which
 * the app can die holding a claim it never recorded.
 *
 * ponytail: a file, not SQLite and not MMKV. PRODUCT.md names both, and both
 * are right the day this state is a queue of thousands of rows written from a
 * background service under contention. Today it is one collector's profile, a
 * handful of claims and five episodes, rewritten whole on a tap: a database
 * here would be a schema, a migration story and a native module bought with no
 * row to spend them on. Move to `expo-sqlite` when the upload queue is written
 * by the Kotlin foreground service (`DEVICE_DEPS.md`) rather than by this
 * process, because that is when two writers exist and a whole-file rewrite
 * stops being safe.
 *
 * The document directory is the deliberate choice over the cache directory:
 * Android reclaims the cache under storage pressure, and NFR-04 asks for state
 * that a kill cannot take, which includes a kill for being in the way.
 */
const file = new File(Paths.document, 'player-one-state.json');

/**
 * The app's api, with whatever the last run left behind.
 *
 * A file that will not parse is discarded rather than surfaced. A collector
 * cannot act on "your saved state is corrupt", and the alternative is an app
 * that crashes on every launch until it is reinstalled — the one failure worse
 * than losing a scaffold's demo data. Real collector data would deserve a
 * quarantine copy and a report; a mock's does not.
 */
export async function loadApi(): Promise<MockCollectorApi> {
  let restored: MockState | undefined;
  try {
    if (file.exists) restored = JSON.parse(await file.text()) as MockState;
    else file.create({ intermediates: true });
  } catch {
    restored = undefined;
  }

  return new MockCollectorApi(restored, (state) => {
    try {
      file.write(JSON.stringify(state));
    } catch {
      // A full disk or a revoked directory. The in-memory state is still
      // correct for this run, and throwing here would turn a save failure into
      // a failed claim — losing the thing the save was protecting.
    }
  });
}
