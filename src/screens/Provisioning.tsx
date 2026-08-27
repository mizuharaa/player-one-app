import { useState } from 'react';
import { useTransport } from '../device/transport-context.tsx';
import type { BleDevice } from '../device/transport.ts';
import { useT } from '../locale.tsx';
import { codeKey } from '../errors.ts';
import { useTheme } from '../theme.tsx';
import { Body, Button, Card, CardLink, Field, Note, Row, Screen, Tag, Title } from '../ui.tsx';

/**
 * The BLE provisioning flow, in the order the EgoLowBle stack requires:
 * scan → connect → send the phone's Wi-Fi → read back the device IP.
 *
 * The transport behind this screen is the mock; the real one is a Kotlin
 * TurboModule over EgoLowBle-1.1.5.aar and an ARM device (DEVICE_DEPS.md).
 * Nothing on this screen — or anywhere else — starts or stops recording.
 */
export function Provisioning() {
  const transport = useTransport();
  const tt = useT();
  const theme = useTheme();
  const [found, setFound] = useState<BleDevice[]>([]);
  const [connected, setConnected] = useState<string | null>(null);
  const [ssid, setSsid] = useState('');
  const [password, setPassword] = useState('');
  const [sent, setSent] = useState(false);
  const [ip, setIp] = useState<string | null>(null);
  /**
   * The device's own code, not a sentence — `empty_ssid`, or one of
   * EgoLowBle's IP_RESULT_* values. It used to be printed as it arrived,
   * appended to "Chưa đọc được IP", which was also the wrong sentence for a
   * Wi-Fi failure. `src/errors.ts` turns each code into its own.
   */
  const [failure, setFailure] = useState<string | null>(null);

  return (
    <Screen title={tt('prov.title')}>
      <Body muted>{tt('prov.hint')}</Body>

      <Button label={tt('prov.scan')} onPress={() => void transport.scan(5000).then(setFound)} />
      {found.map((d) => (
        <CardLink
          key={d.deviceAddress}
          label={d.deviceName}
          hint={connected === d.deviceAddress ? tt('prov.connected') : tt('prov.connect')}
          onPress={() =>
            void transport.connect(d.deviceAddress).then(() => setConnected(d.deviceAddress))
          }
        >
          <Title>{d.deviceName}</Title>
          <Row label={tt('prov.rssi')} value={`${d.rssi} dBm`} />
          {connected === d.deviceAddress ? (
            <Tag label={tt('prov.connected')} fg={theme.color.verdict.pass.fg} bg={theme.color.verdict.pass.bg} />
          ) : (
            <Body muted>{tt('prov.connect')}</Body>
          )}
        </CardLink>
      ))}

      {connected !== null ? (
        <Card>
          <Field label={tt('prov.ssid')} value={ssid} onChangeText={setSsid} />
          <Field label={tt('prov.password')} value={password} onChangeText={setPassword} secure />
          <Button
            label={sent ? tt('prov.sent') : tt('prov.send')}
            disabled={ssid.trim() === ''}
            onPress={() =>
              void transport.configureWifi(ssid, password).then((r) => {
                setSent(r.ok);
                setFailure(r.ok ? null : (r.reason ?? 'failed'));
              })
            }
          />
          <Button
            label={tt('prov.readIp')}
            kind="ghost"
            disabled={!sent}
            onPress={() =>
              void transport.requestIp().then((r) => {
                if (r.result === 'success') {
                  setIp(r.ip);
                  setFailure(null);
                } else {
                  setIp(null);
                  // The result code, not `r.reason`: the reason is free text
                  // from the firmware, the code is the closed set.
                  setFailure(r.result);
                }
              })
            }
          />
          {ip !== null ? <Row label={tt('prov.ip')} value={ip} /> : null}
          {failure !== null ? <Note text={tt(codeKey(failure))} /> : null}
        </Card>
      ) : null}
    </Screen>
  );
}
