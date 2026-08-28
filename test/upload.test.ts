import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { closeSync, mkdtempSync, openSync, readSync, rmSync, writeFileSync } from 'node:fs';
import { createServer, type Server } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { apiFetch, type HttpConfig } from '../src/api/http.ts';
import { restoreQueue, UploadQueue } from '../src/upload/queue.ts';
import type { Delivery, PartSource, QueuedDelivery } from '../src/upload/worker.ts';

/**
 * The upload worker, over real HTTP, moving real bytes off a real file.
 *
 * **No platform server was reachable while this was written, and this is not
 * one.** The three collector branches have never been merged into one another,
 * nothing was listening on 8080, and the platform repo is off limits to this
 * one. What runs below is a stub that implements the wire contract of
 * `packages/api/src/collector-upload.ts` at 6f76635 — the plan shape, 1-indexed
 * parts with an exclusive `end`, `held_parts` for what it already holds,
 * presigned-style urls that take a bare `PUT`, a `/complete` that ignores its
 * body and re-hashes what it assembled — and nothing beyond it. It proves the
 * client's half of the conversation and it proves nothing about the server's.
 *
 * The numbers it prints are therefore loopback numbers: they measure the
 * worker's overhead and its resume arithmetic, not a phone on a Vietnamese
 * mobile network.
 */

/** 8 MiB here rather than the server's 64 MiB, so the test is four parts and fast. */
const PART = 8 * 1024 * 1024;
const SIZE = 32 * 1024 * 1024;

interface Stub {
  server: Server;
  baseUrl: string;
  /** Every part this store holds, per file. */
  held: Map<string, Map<number, Buffer>>;
  /** Every `PUT` it has been sent, as `path#part`. Duplicates would show here. */
  puts: string[];
  completed: { verified: boolean } | null;
  /** The declared digest the stub verifies the assembled object against. */
  sha256: string;
}

const readBody = async (req: import('node:http').IncomingMessage): Promise<Buffer> => {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks);
};

function plan(stub: Stub, relativePath: string, bytes: number, force = false) {
  const held = stub.held.get(relativePath) ?? new Map<number, Buffer>();
  const parts: unknown[] = [];
  const heldParts: number[] = [];
  for (let start = 0, n = 1; start < bytes; start += PART, n += 1) {
    const end = Math.min(start + PART, bytes);
    // A part counts as held only at the planned size — the server's own rule.
    if (!force && held.get(n)?.length === end - start) {
      heldParts.push(n);
      continue;
    }
    parts.push({
      part_number: n,
      start,
      end,
      bytes: end - start,
      url: `${stub.baseUrl}/store?path=${encodeURIComponent(relativePath)}&part=${n}`,
    });
  }
  return {
    relative_path: relativePath,
    key: `episodes/ep/ingest/${relativePath}`,
    bytes,
    sha256: stub.sha256,
    done: parts.length === 0 && heldParts.length > 0,
    upload_id: 's3-multipart-id',
    held_parts: heldParts,
    parts,
  };
}

async function startStub(relativePath: string, bytes: number, sha256: string): Promise<Stub> {
  const stub: Stub = {
    server: undefined as unknown as Server,
    baseUrl: '',
    held: new Map(),
    puts: [],
    completed: null,
    sha256,
  };

  stub.server = createServer((req, res) => {
    void (async () => {
      const url = new URL(req.url ?? '/', 'http://127.0.0.1');
      const send = (status: number, body: unknown) => {
        res.writeHead(status, { 'content-type': 'application/json' });
        res.end(JSON.stringify(body));
      };

      // The presigned url. A bare PUT, and the stub refuses one that arrives
      // with an Authorization header — S3 rejects a presigned request that
      // carries a second credential, and this is the cheapest way to keep the
      // client from ever growing one.
      if (req.method === 'PUT' && url.pathname === '/store') {
        if (req.headers.authorization !== undefined) {
          send(403, { error: 'presigned url carried a second credential' });
          return;
        }
        const path = url.searchParams.get('path') ?? '';
        const part = Number(url.searchParams.get('part'));
        stub.puts.push(`${path}#${part}`);
        const body = await readBody(req);
        const file = stub.held.get(path) ?? new Map<number, Buffer>();
        file.set(part, body);
        stub.held.set(path, file);
        res.writeHead(200);
        res.end();
        return;
      }

      if (req.method === 'POST' && url.pathname === '/api/me/uploads') {
        await readBody(req);
        send(200, {
          upload_id: 'srv-1',
          replayed: false,
          part_size: PART,
          expires_in_s: 3600,
          files: [plan(stub, relativePath, bytes)],
        });
        return;
      }

      if (req.method === 'GET' && url.pathname.startsWith('/api/me/uploads/')) {
        send(200, {
          upload_id: 'srv-1',
          state: 'registered',
          part_size: PART,
          expires_in_s: 3600,
          files: [plan(stub, relativePath, bytes)],
        });
        return;
      }

      if (req.method === 'POST' && url.pathname.endsWith('/complete')) {
        await readBody(req);
        const file = stub.held.get(relativePath) ?? new Map<number, Buffer>();
        const assembled = Buffer.concat(
          [...file.keys()].sort((a, b) => a - b).map((n) => file.get(n) as Buffer),
        );
        // The server downloads every object back and re-hashes it. So does this.
        const verified =
          assembled.length === bytes && createHash('sha256').update(assembled).digest('hex') === sha256;
        stub.completed = { verified };
        if (!verified) {
          send(409, {
            error: 'refused',
            constraint: 'upload_checksum_mismatch',
            mismatches: [{ relative_path: relativePath, expected_sha256: sha256, cloud_sha256: null }],
          });
          return;
        }
        send(200, { upload_id: 'srv-1', state: 'verified', verification_state: 'verified' });
        return;
      }

      send(404, { error: 'no such route' });
    })();
  });

  await new Promise<void>((resolve) => stub.server.listen(0, '127.0.0.1', resolve));
  const address = stub.server.address();
  const port = typeof address === 'object' && address !== null ? address.port : 0;
  stub.baseUrl = `http://127.0.0.1:${port}`;
  return stub;
}

/** The Node end of `PartSource`: a ranged read, the same shape the phone's is. */
const nodeSource = (path: string): PartSource => ({
  body: async (start, end) => {
    const buffer = Buffer.alloc(end - start);
    const fd = openSync(path, 'r');
    try {
      readSync(fd, buffer, 0, end - start, start);
    } finally {
      closeSync(fd);
    }
    return buffer;
  },
});

let dir: string;
let source: string;
let digest: string;
let stub: Stub;

beforeEach(async () => {
  dir = mkdtempSync(join(tmpdir(), 'p1-upload-'));
  source = join(dir, 'camera_01.mp4');
  const bytes = randomBytes(SIZE);
  writeFileSync(source, bytes);
  digest = createHash('sha256').update(bytes).digest('hex');
  stub = await startStub('camera_01.mp4', SIZE, digest);
});

afterEach(async () => {
  await new Promise<void>((resolve) => stub.server.close(() => resolve()));
  rmSync(dir, { recursive: true, force: true });
});

const delivery = (): Delivery => ({
  id: randomUUID(),
  episodeId: 'ego1-20260821-0715',
  collectionSessionId: randomUUID(),
  episode: { schema_version: '1.1.0', episode_id: 'ego1-20260821-0715' },
  files: [{ relativePath: 'camera_01.mp4', uri: source }],
  totalBytes: SIZE,
});

const deps = () => {
  const config: HttpConfig = {
    baseUrl: stub.baseUrl,
    token: () => 'tok-abc',
    onUnauthorized: () => {},
  };
  return {
    api: (path: string, init?: RequestInit) => apiFetch(config, path, init),
    put: async (url: string, body: unknown) => {
      const response = await fetch(url, { method: 'PUT', body: body as BodyInit_ });
      if (!response.ok) throw new Error('part_rejected');
    },
    open: nodeSource,
    now: () => Date.now(),
  };
};

describe('one delivery, end to end', () => {
  it('registers, PUTs every part at its own url, and completes verified', async () => {
    const saved: QueuedDelivery[][] = [];
    const queue = new UploadQueue([], (items) => saved.push(items));
    queue.enqueue(delivery());

    const started = Date.now();
    await queue.run(deps());
    const elapsed = Date.now() - started;

    const [item] = queue.list();
    expect(item?.state).toBe('delivered');
    expect(item?.bytesSent).toBe(SIZE);
    expect(stub.completed).toEqual({ verified: true });
    // Four parts, 1-indexed, each sent exactly once.
    expect(stub.puts).toEqual([
      'camera_01.mp4#1',
      'camera_01.mp4#2',
      'camera_01.mp4#3',
      'camera_01.mp4#4',
    ]);

    // Real numbers, over loopback, so they measure the client and not a network.
    console.log(
      `[upload] ${SIZE} bytes in ${elapsed} ms over ${stub.puts.length} parts ` +
        `(${(SIZE / 1024 / 1024 / (elapsed / 1000)).toFixed(1)} MiB/s, loopback stub)`,
    );
  }, 60_000);

  it('writes the queue to disk on every step, not once at the end', async () => {
    // NFR-04. The saves live inside `UploadQueue`, so no caller can forget one.
    const saved: QueuedDelivery[][] = [];
    const queue = new UploadQueue([], (items) => saved.push(items));
    queue.enqueue(delivery());
    await queue.run(deps());

    // enqueue, sending, one per part, delivered.
    expect(saved.length).toBe(1 + 1 + 4 + 1);
    expect(saved.map((s) => s[0]?.bytesSent)).toEqual([
      0,
      0,
      PART,
      PART * 2,
      PART * 3,
      SIZE,
      SIZE,
    ]);
  }, 60_000);
});

describe('resume', () => {
  it('does not send a part the server already holds', async () => {
    // Parts 1 and 2 land; the connection drops before part 3 and stays down.
    const queue = new UploadQueue([]);
    queue.enqueue(delivery());
    await queue.run({
      ...deps(),
      put: async (url: string, body: unknown) => {
        const part = Number(new URL(url).searchParams.get('part'));
        if (part >= 3) throw new Error('connection dropped');
        const response = await fetch(url, { method: 'PUT', body: body as BodyInit_ });
        if (!response.ok) throw new Error('part_rejected');
      },
    });

    const [interrupted] = queue.list();
    expect(interrupted?.state).toBe('failed');
    expect(interrupted?.bytesSent).toBe(PART * 2);
    expect(stub.completed).toBeNull();

    // The second attempt re-plans. The server reports parts 1 and 2 in
    // `held_parts` and leaves them out of `parts`, so the phone is never
    // offered them again — which is what makes "already sent is not re-sent"
    // true without this phone keeping a list.
    stub.puts.length = 0;
    await queue.run(deps());

    expect(stub.puts).toEqual(['camera_01.mp4#3', 'camera_01.mp4#4']);
    const [done] = queue.list();
    expect(done?.state).toBe('delivered');
    // The byte total is cumulative: 16 MiB before the drop, 16 MiB after, and
    // the 16 MiB that already landed is never counted or sent twice.
    expect(done?.bytesSent).toBe(SIZE);
    expect(stub.completed).toEqual({ verified: true });

    console.log(
      `[upload] resumed after ${PART * 2} bytes; re-sent ${SIZE - PART * 2} bytes, ` +
        `not ${SIZE} (loopback stub)`,
    );
  }, 60_000);

  it('survives the app being killed, through JSON, and finishes the delivery', async () => {
    // A kill is: whatever the last write put on disk, parsed, handed to a new
    // queue. Same round trip `test/persistence.test.ts` does for the mock.
    let disk = '[]';
    const first = new UploadQueue([], (items) => {
      disk = JSON.stringify(items);
    });
    first.enqueue(delivery());
    await first.run({
      ...deps(),
      put: async (url: string, body: unknown) => {
        const part = Number(new URL(url).searchParams.get('part'));
        if (part >= 2) throw new Error('killed');
        const response = await fetch(url, { method: 'PUT', body: body as BodyInit_ });
        if (!response.ok) throw new Error('part_rejected');
      },
    });

    // Killed here. Nothing is flushed on the way out.
    const second = restoreQueue(JSON.parse(disk) as QueuedDelivery[], () => {});
    const restored = second.list()[0];
    expect(restored?.id).toBe(first.list()[0]?.id);
    // The delivery id survives, which is what stops the next attempt
    // registering a SECOND delivery of the same episode and sending it whole.
    expect(restored?.registered).toBe(true);
    expect(restored?.bytesSent).toBe(PART);

    stub.puts.length = 0;
    await second.run(deps());

    expect(stub.puts).toEqual(['camera_01.mp4#2', 'camera_01.mp4#3', 'camera_01.mp4#4']);
    expect(second.list()[0]?.state).toBe('delivered');
    expect(stub.completed).toEqual({ verified: true });
  }, 60_000);

  it('turns a delivery caught mid-send into one the next pass picks up', () => {
    // `sending` on disk means the process died holding it; no process is doing
    // it now. Left alone, `run` skips it for ever.
    const stuck: QueuedDelivery = {
      ...delivery(),
      state: 'sending',
      registered: true,
      bytesSent: PART,
      elapsedMs: 100,
    };
    expect(restoreQueue([stuck], () => {}).list()[0]?.state).toBe('failed');
  });
});

describe('what the collector is told when it goes wrong', () => {
  it('never carries the server’s constraint name out of the worker', async () => {
    // The stub answers `/complete` with `upload_checksum_mismatch` and a
    // `cloud_sha256`. Both are internal forensics; neither may reach a screen.
    const queue = new UploadQueue([]);
    queue.enqueue(delivery());
    // Corrupt one part on the way in, so the read-back cannot match.
    await queue.run({
      ...deps(),
      put: async (url: string, body: unknown) => {
        const part = Number(new URL(url).searchParams.get('part'));
        const payload = part === 2 ? Buffer.alloc(PART) : (body as Buffer);
        const response = await fetch(url, { method: 'PUT', body: payload });
        if (!response.ok) throw new Error('part_rejected');
      },
    });

    const [item] = queue.list();
    expect(item?.state).toBe('failed');
    expect(item?.lastError).toBe('upload_damaged');
    const serialised = JSON.stringify(item);
    expect(serialised).not.toContain('upload_checksum_mismatch');
    expect(serialised).not.toContain('cloud_sha256');
    expect(serialised).not.toContain(digest);
  }, 60_000);

  it('refuses to invent a file the plan names and the phone does not have', async () => {
    const queue = new UploadQueue([]);
    queue.enqueue({ ...delivery(), files: [] });
    await queue.run(deps());

    const [item] = queue.list();
    expect(item?.state).toBe('failed');
    expect(item?.lastError).toBe('upload_missing_file');
    expect(stub.completed).toBeNull();
  }, 60_000);
});
