/// <reference types="node" />
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { MockCollectorApi } from '../src/api/mock.ts';
import { PAYOUT_PERIOD_STATUSES, VERIFY_STATUSES } from '../src/api/types.ts';
import { LOCALES, MESSAGES, type MessageKey } from '../src/i18n.ts';
import { periodStatusKey, periodStatusTone, PERIOD_STATUS_KEY, VERIFY_RESULT_TEXT, VERIFY_STATUS_KEY } from '../src/services/payout/status.ts';

/**
 * The payout territory's hard rules, pinned by reading the code — the same
 * way `test/device.test.ts` scans the device seams for "record" and "delete".
 * No test here renders a screen (there is no RN test renderer in this repo);
 * each one reads the files under src/screens/payout and src/services/payout
 * and asserts what must not be in them.
 */

const TERRITORY = ['src/screens/payout', 'src/services/payout'];

/** Repo-relative path → absolute, by string, so no URL object meets two URL types. */
const REPO = join(dirname(fileURLToPath(import.meta.url)), '..');
const fromRepo = (relative: string): string => join(REPO, relative);

interface SourceFile {
  path: string;
  /** The file with comments and string literals removed — what actually runs. */
  code: string;
  raw: string;
}

const stripComments = (source: string): string =>
  source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/.*$/gm, '$1');

/** Also blanks string contents, so a word inside a message key is not an identifier. */
const stripStrings = (source: string): string =>
  source.replace(/'(?:[^'\\\n]|\\.)*'/g, "''").replace(/"(?:[^"\\\n]|\\.)*"/g, '""');

function territory(): SourceFile[] {
  const files: SourceFile[] = [];
  for (const dir of TERRITORY) {
    const abs = fromRepo(dir);
    for (const name of readdirSync(abs)) {
      if (!/\.tsx?$/.test(name)) continue;
      const raw = readFileSync(join(abs, name), 'utf8');
      files.push({ path: `${dir}/${name}`, raw, code: stripStrings(stripComments(raw)) });
    }
  }
  return files;
}

const FILES = territory();

describe('the payout territory exists and is what is scanned', () => {
  it('holds the four screens and the services', () => {
    const names = FILES.map((f) => f.path);
    expect(names).toContain('src/screens/payout/Payout.tsx');
    expect(names).toContain('src/screens/payout/PayoutDeclare.tsx');
    expect(names).toContain('src/screens/payout/PayoutResult.tsx');
    expect(names).toContain('src/screens/payout/PayoutIncome.tsx');
    expect(names).toContain('src/services/payout/declare.ts');
    expect(names).toContain('src/services/payout/validate.ts');
    expect(names).toContain('src/services/payout/status.ts');
  });
});

describe('no money is computed on the phone', () => {
  // An amount-typed word anywhere in either operand of an arithmetic
  // operator. An operand runs from the operator to the nearest expression
  // boundary, so `Number(grossVnd) * 2` and `1 + a.netVnd` are both caught —
  // the naive "identifier next to operator" check missed both, once through
  // a closing paren and once through a member dot. `net` also catches
  // `network`, which is fine: nothing here may do arithmetic on that either.
  const MONEY = /gross|net|withheld|amount|vnd|minutes|total|sum|tax|price|fee|money|paid/i;
  const BOUNDARY = /[,;=:{}]/;
  const OPERATOR = /[-+*/%]/g;

  function arithmeticOnMoney(line: string): string | null {
    for (const op of line.matchAll(OPERATOR)) {
      const left = line.slice(0, op.index).split(BOUNDARY).at(-1) ?? '';
      const right = line.slice(op.index + 1).split(BOUNDARY)[0] ?? '';
      if (MONEY.test(left) || MONEY.test(right)) return `${left.trim()} ${op[0]} ${right.trim()}`;
    }
    return null;
  }

  it('has no arithmetic on an amount-typed value', () => {
    for (const file of FILES) {
      for (const line of file.code.split('\n')) {
        expect(arithmeticOnMoney(line), `${file.path}: ${line.trim()}`).toBeNull();
      }
    }
  });

  it('would catch the two shapes the previous check missed', () => {
    expect(arithmeticOnMoney('const x = Number(grossVnd) * 2;')).not.toBeNull();
    expect(arithmeticOnMoney('const y = 1 + a.netVnd;')).not.toBeNull();
    expect(arithmeticOnMoney('total += row.amountVnd;')).not.toBeNull();
    expect(arithmeticOnMoney("const label = `${period.grossVnd} ₫`;")).toBeNull();
    expect(arithmeticOnMoney('const count = a + b;')).toBeNull();
  });

  it('never parses a server figure into a number — the string is rendered as received', () => {
    for (const file of FILES) {
      expect(file.code, file.path).not.toMatch(/\bNumber\s*\(/);
      expect(file.code, file.path).not.toMatch(/\bparseInt\s*\(/);
      expect(file.code, file.path).not.toMatch(/\bparseFloat\s*\(/);
      expect(file.code, file.path).not.toMatch(/\bBigInt\s*\(/);
      expect(file.code, file.path).not.toMatch(/\.toFixed\s*\(/);
      expect(file.code, file.path).not.toMatch(/\bMath\./);
      expect(file.code, file.path).not.toMatch(/NumberFormat/);
    }
  });
});

describe('no account number reaches any persistence', () => {
  it('imports or names no storage API anywhere in the territory or the API seam', () => {
    const seam = ['src/api/types.ts', 'src/api/mock.ts'].map((path) => ({
      path,
      raw: readFileSync(fromRepo(path), 'utf8'),
    }));
    for (const file of [...FILES, ...seam]) {
      expect(file.raw, file.path).not.toMatch(
        /AsyncStorage|MMKV|SQLite|SecureStore|Keychain|localStorage|sessionStorage|IndexedDB|writeFile|FileSystem|expo-file-system|react-native-fs/,
      );
    }
  });

  it('types the full number in the request only — no response shape has a field for it', () => {
    const types = readFileSync(fromRepo('src/api/types.ts'), 'utf8');
    // The response interface, from its opening to its closing brace.
    const response = /export interface PayoutAccount \{[\s\S]*?\n\}/.exec(types)?.[0];
    expect(response).toBeDefined();
    expect(response).toContain('accountNoLast4');
    expect(response).not.toMatch(/\baccountNo\b/);
    expect(response).not.toMatch(/\bcardNo\b/);
  });

  it('clears the typed number from the form after a successful submit', () => {
    const declare = FILES.find((f) => f.path === 'src/screens/payout/PayoutDeclare.tsx')!;
    expect(declare.code).toMatch(/accountNumber:\s*''/);
    // And never seeds it from the server, which has only four digits to give.
    expect(declare.code).not.toMatch(/accountNumber:\s*\w+\.accountNoLast4/);
  });
});

describe('the payout write is online-only: no queue, no retry', () => {
  it('sets retry: false on the mutation and nowhere sets a retry count', () => {
    for (const file of FILES) {
      for (const match of file.code.matchAll(/\bretry\s*:\s*([^,\n}]+)/g)) {
        expect(match[1]!.trim(), `${file.path}: retry: ${match[1]}`).toBe('false');
      }
    }
    const declare = FILES.find((f) => f.path === 'src/screens/payout/PayoutDeclare.tsx')!;
    expect(declare.code).toMatch(/retry:\s*false/);
  });

  it('has no timer, queue or backoff in the territory', () => {
    for (const file of FILES) {
      expect(file.code, file.path).not.toMatch(/setTimeout|setInterval|requestIdleCallback/);
      expect(file.code, file.path).not.toMatch(/\b(?:queue|enqueue|dequeue|backoff|persistQueue|onlineManager)\b/i);
      // No network-state listener may fire a submit: submit is a tap.
      expect(file.code, file.path).not.toMatch(/NetInfo|addEventListener\(\s*'?(?:online|connectionChange)/);
    }
  });

  it('shows the offline state with a "connect and submit again" message in every locale', () => {
    for (const locale of LOCALES) {
      const text = MESSAGES[locale]['payout.offline'];
      expect(text.trim()).not.toBe('');
    }
    expect(MESSAGES.vi['payout.offline']).toMatch(/kết nối/i);
    expect(MESSAGES.vi['payout.offline']).toMatch(/không tự gửi lại/i);
    expect(MESSAGES.en['payout.offline']).toMatch(/will not be sent on its own/i);
  });
});

describe('the bank list comes from the server', () => {
  it('carries none of the server’s bank names or codes as literals', async () => {
    const banks = await new MockCollectorApi().payoutBankCodes();
    for (const file of FILES) {
      for (const bank of banks) {
        expect(file.raw, `${file.path} names ${bank.name}`).not.toContain(bank.name);
        expect(file.raw, `${file.path} carries code ${bank.code}`).not.toMatch(new RegExp(`['"\`]${bank.code}['"\`]`));
      }
    }
  });
});

describe('every string is Vietnamese first, and every key used exists', () => {
  it('references only keys the Vietnamese catalogue holds', () => {
    const known = new Set(Object.keys(MESSAGES.vi));
    for (const file of FILES) {
      for (const match of file.raw.matchAll(/'((?:payout|common|home)\.[\w.]+)'/g)) {
        expect(known.has(match[1]!), `${file.path} uses unknown key ${match[1]}`).toBe(true);
      }
    }
  });

  it('has a Vietnamese and an English string for every payout key, none blank, none pasted', () => {
    const keys = (Object.keys(MESSAGES.vi) as MessageKey[]).filter((k) => k.startsWith('payout.') || k === 'home.payout');
    expect(keys.length).toBeGreaterThan(60);
    for (const key of keys) {
      for (const locale of LOCALES) expect(MESSAGES[locale][key].trim(), `${locale} ${key}`).not.toBe('');
      expect(MESSAGES.en[key], key).not.toBe(MESSAGES.vi[key]);
    }
  });

  it('maps every verify status and every period status to a key with text in every locale', () => {
    for (const status of VERIFY_STATUSES) {
      for (const locale of LOCALES) {
        expect(MESSAGES[locale][VERIFY_STATUS_KEY[status]].trim()).not.toBe('');
        expect(MESSAGES[locale][VERIFY_RESULT_TEXT[status].title].trim()).not.toBe('');
        expect(MESSAGES[locale][VERIFY_RESULT_TEXT[status].body].trim()).not.toBe('');
      }
    }
    for (const status of PAYOUT_PERIOD_STATUSES) {
      for (const locale of LOCALES) expect(MESSAGES[locale][PERIOD_STATUS_KEY[status]].trim()).not.toBe('');
    }
  });
});

describe('the status vocabulary the brief fixes', () => {
  it('uses the exact Vietnamese wording', () => {
    expect(MESSAGES.vi[periodStatusKey('pending_review')]).toBe('Chờ duyệt');
    expect(MESSAGES.vi[periodStatusKey('approved')]).toBe('Đã duyệt, chờ chi trả');
    expect(MESSAGES.vi[periodStatusKey('paid')]).toBe('Đã chi trả');
    expect(MESSAGES.vi[periodStatusKey('on_hold')]).toBe('Đang xem xét');
  });

  it('never says "paid" for anything but the server’s terminal paid status', () => {
    // Attempt states a server might one day leak, and nonsense: none may
    // render as paid. "Paid" is the server's word for a terminal-succeeded
    // attempt, and nothing on this side can promote a status to it.
    for (const leaked of ['processing', 'submitted', 'pending_zlp', 'unknown', 'succeeded', 'manually_paid', '', 'PAID']) {
      const key = periodStatusKey(leaked);
      expect(key).toBe('payout.status.unknown');
      for (const locale of LOCALES) expect(MESSAGES[locale][key]).not.toBe(MESSAGES[locale]['payout.status.paid']);
      expect(periodStatusTone(leaked)).toBe('muted');
    }
  });

  it('renders a hold neutrally: muted tone, no reason text', () => {
    expect(periodStatusTone('on_hold')).toBe('muted');
    for (const locale of LOCALES) {
      const hint = MESSAGES[locale]['payout.status.onHoldHint'];
      // The hint says nothing about why. Words a reason would need are absent.
      expect(hint).not.toMatch(/gian lận|fraud|nghi ngờ|suspect|vi phạm|violat|flag|cờ|risk|rủi ro/i);
    }
    const income = FILES.find((f) => f.path === 'src/screens/payout/PayoutIncome.tsx')!;
    expect(income.code).not.toMatch(/reason|flag|risk/i);
  });

  it('shows the mismatch without accusing: both names, and a way to fix it', () => {
    for (const locale of LOCALES) {
      const body = MESSAGES[locale]['payout.result.mismatchBody'];
      expect(body).not.toMatch(/gian lận|fraud|giả|fake|sai tên|wrong name|lừa/i);
    }
    const result = FILES.find((f) => f.path === 'src/screens/payout/PayoutResult.tsx')!;
    expect(result.raw).toContain("'payout.declaredName'");
    expect(result.raw).toContain("'payout.verifiedName'");
    expect(result.raw).toContain("'payout.result.fixName'");
  });
});

describe('colour never carries a status alone', () => {
  it('renders every Tag with a translated label next to its tone', () => {
    for (const file of FILES) {
      for (const match of file.raw.matchAll(/<Tag\b[^>]*>/g)) {
        expect(match[0], `${file.path}: ${match[0]}`).toMatch(/label=\{tt\(/);
      }
    }
  });
});
