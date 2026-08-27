import { describe, expect, it } from 'vitest';
import {
  DEFAULT_LOCALE,
  LOCALES,
  MESSAGES,
  missingKeys,
  t,
  type MessageKey,
} from '../src/i18n.ts';
import { GENERIC_ERROR, codeKey, errorKey } from '../src/errors.ts';
import { MockCollectorApi } from '../src/api/mock.ts';
import { MockDeviceTransport } from '../src/device/transport.ts';

/**
 * The collector app's catalogue, held to the same standard as the console's
 * (packages/api/test/console.test.ts): every key in every locale, and the
 * second locale actually translated rather than pasted.
 */
describe('the collector message catalogue', () => {
  it('is Vietnamese first', () => {
    // LOC-01 is P0: the collector app is in Vietnamese. English rides along
    // at P2. If this ever flips, someone changed the product's audience.
    expect(DEFAULT_LOCALE).toBe('vi');
    expect(LOCALES[0]).toBe('vi');
  });

  it('holds every key in every locale', () => {
    for (const locale of LOCALES) expect(missingKeys(locale)).toEqual([]);
  });

  it('has actually been translated, not copied', () => {
    // `app.name` is the product name and `prov.rssi` a technical initialism,
    // the same in both languages. Everything else byte-identical means the
    // English was pasted in to pass the check above.
    const sameOnPurpose = new Set<MessageKey>(['app.name', 'prov.rssi']);
    const copied = (Object.keys(MESSAGES.vi) as MessageKey[]).filter(
      (key) => !sameOnPurpose.has(key) && MESSAGES.en[key] === MESSAGES.vi[key],
    );
    expect(copied).toEqual([]);
  });
});

/**
 * The catalogue has a second job: the server and the device answer in English
 * identifiers, and none of them may reach a Vietnamese collector's screen.
 * `Devices` printed `already_bound` and `serial_empty` verbatim, `Provisioning`
 * printed the transport's reason, `Income` printed the raw settlement column.
 *
 * These tests drive the two real seams rather than asserting against a copied
 * list of codes: a code only matters if something can actually raise it, and
 * the mocks raise exactly what the server and the SDK do.
 */
describe('the machine’s refusals, in the collector’s language', () => {
  /** What an identifier looks like. No sentence in either locale looks like one. */
  const IDENTIFIER = /^[a-z][a-z0-9_]*$/;

  const CODES = [
    // src/api/mock.ts
    'not_registered',
    'missing_fields',
    'agreements_incomplete',
    'training_incomplete',
    'exam_not_passed',
    'task_not_found',
    'task_at_capacity',
    'already_claimed',
    'serial_empty',
    'already_bound',
    // src/device/transport.ts
    'empty_ssid',
    'not_configured',
    'configuring',
    'configure_failed',
  ];

  it('has a translated sentence for every code that can reach a screen', () => {
    for (const code of CODES) {
      const key = codeKey(code);
      expect(key, code).not.toBe(GENERIC_ERROR);
      for (const locale of LOCALES) {
        const text = MESSAGES[locale][key];
        expect(text, `${code} in ${locale}`).toBeTruthy();
        expect(text, `${code} in ${locale}`).not.toMatch(IDENTIFIER);
      }
    }
  });

  it('falls back to a sentence for anything else, never to the code', () => {
    // A code the server grows next year, and every shape a rejection can take.
    expect(codeKey('collector_suspended')).toBe(GENERIC_ERROR);
    expect(errorKey(new Error('collector_suspended'))).toBe(GENERIC_ERROR);
    expect(errorKey('a bare string')).toBe(GENERIC_ERROR);
    expect(errorKey(undefined)).toBe(GENERIC_ERROR);
    for (const locale of LOCALES) {
      expect(MESSAGES[locale][GENERIC_ERROR]).toBeTruthy();
      expect(MESSAGES[locale][GENERIC_ERROR]).not.toMatch(IDENTIFIER);
    }
  });

  it('translates what the API seam actually throws at the binding screen', async () => {
    const api = new MockCollectorApi();
    await api.register('Nguyễn Văn A', '0903000001');
    await api.bindDevice('EGO1-PILOT-0007');

    const twice = await api.bindDevice('EGO1-PILOT-0007').catch((e: unknown) => e);
    expect((twice as Error).message).toBe('already_bound');
    expect(t('vi', errorKey(twice))).toBe('Thiết bị này đã được liên kết rồi.');

    const blank = await api.bindDevice('   ').catch((e: unknown) => e);
    expect((blank as Error).message).toBe('serial_empty');
    expect(t('vi', errorKey(blank))).toBe('Chưa nhập số sê-ri thiết bị.');
  });

  it('translates what the device seam actually reports at provisioning', async () => {
    const transport = new MockDeviceTransport();
    const found = await transport.scan(0);
    await transport.connect(found[0]!.deviceAddress);

    const wifi = await transport.configureWifi('', 'hunter2');
    expect(wifi.reason).toBe('empty_ssid');
    expect(t('vi', codeKey(wifi.reason!))).toBe('Chưa nhập tên Wi-Fi.');

    // requestIp answers with a result code and a free-text reason; the code is
    // the closed set, so the code is what the screen translates.
    const ip = await transport.requestIp();
    expect(ip.result).toBe('not_configured');
    expect(codeKey(ip.result)).toBe('prov.notConfigured');
  });
});
