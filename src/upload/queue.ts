import { deliver, type Delivery, type DeliveryDeps, type QueuedDelivery } from './worker.ts';

/**
 * The upload queue: what this phone still owes the platform, in order.
 *
 * No file API here on purpose — the same split as `src/api/mock.ts` and
 * `src/api/persist.ts`. This class holds the rules and calls `onChange` after
 * every write; `src/upload/expo.ts` is what turns that into a file. It is the
 * split that lets the rules be tested at all, because vitest cannot load
 * `expo-file-system`.
 */
export class UploadQueue {
  constructor(
    private items: QueuedDelivery[],
    /**
     * Called after every write, with the queue to persist. Inside the mutation
     * rather than in a screen, so no caller can forget one — which is what
     * NFR-04 asks for.
     */
    private readonly onChange: (items: QueuedDelivery[]) => void = () => {},
  ) {}

  list(): QueuedDelivery[] {
    return this.items.map((i) => ({ ...i }));
  }

  find(episodeId: string): QueuedDelivery | undefined {
    const found = this.items.find((i) => i.episodeId === episodeId);
    return found === undefined ? undefined : { ...found };
  }

  /**
   * Put a delivery on the queue, or hand back the one already there.
   *
   * Never a second row for the same episode. The delivery id is the server's
   * idempotency key, so a fresh one would register a second delivery of footage
   * that is already half sent, and the phone would send every byte again.
   */
  enqueue(delivery: Delivery): QueuedDelivery {
    const existing = this.items.find((i) => i.episodeId === delivery.episodeId);
    if (existing !== undefined) return { ...existing };
    const item: QueuedDelivery = {
      ...delivery,
      state: 'queued',
      registered: false,
      bytesSent: 0,
      elapsedMs: 0,
    };
    this.items = [...this.items, item];
    this.onChange(this.list());
    return { ...item };
  }

  /**
   * One pass over everything not yet delivered.
   *
   * Serial, not parallel: these are gigabyte files on a mobile connection, and
   * two at once halves the speed of each while doubling the chance a
   * disconnection catches one mid-part. Every result is written before the next
   * delivery starts, so a kill loses at most the attempt in flight — and even
   * that loses no bytes, because the server keeps the parts it already took and
   * leaves them out of the next plan.
   */
  async run(deps: Omit<DeliveryDeps, 'onProgress'>): Promise<void> {
    for (const item of this.list()) {
      if (item.state === 'delivered' || item.state === 'sending') continue;
      this.replace({ ...item, state: 'sending' });
      const done = await deliver(
        {
          ...deps,
          onProgress: (bytesSent) => this.replace({ ...item, state: 'sending', bytesSent }),
        },
        item,
      );
      this.replace(done);
    }
  }

  private replace(item: QueuedDelivery): void {
    this.items = this.items.map((i) => (i.id === item.id ? item : i));
    this.onChange(this.list());
  }
}

/**
 * A queue read back from disk.
 *
 * A delivery the app died in the middle of comes back as `sending`, which no
 * process is doing. It becomes `failed` so the next pass picks it up, asks the
 * server what it already holds, and sends only the rest.
 */
export function restoreQueue(
  items: QueuedDelivery[],
  onChange: (items: QueuedDelivery[]) => void,
): UploadQueue {
  return new UploadQueue(
    items.map((i) => (i.state === 'sending' ? { ...i, state: 'failed' as const } : i)),
    onChange,
  );
}
