import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useApi } from '../api/context.tsx';
import { useNav } from '../nav.tsx';
import { useT } from '../locale.tsx';
import { errorKey } from '../errors.ts';
import { Body, Button, Card, Field, LoadFailed, Loading, Note, Row, Screen, Title } from '../ui.tsx';

/**
 * APP-14/18: bind by QR or typed serial; list what is bound. The QR path is a
 * mock scanner until the device work starts — VisionCamera needs a build with
 * native modules, which this machine cannot produce.
 */
const MOCK_QR_SERIAL = 'EGO1-PILOT-0007';

export function Devices() {
  const api = useApi();
  const nav = useNav();
  const tt = useT();
  const queryClient = useQueryClient();
  const [serial, setSerial] = useState('');

  const devices = useQuery({ queryKey: ['devices'], queryFn: () => api.boundDevices() });

  const bind = useMutation({
    mutationFn: (s: string) => api.bindDevice(s),
    onSuccess: async () => {
      setSerial('');
      await queryClient.invalidateQueries({ queryKey: ['devices'] });
    },
  });

  // A failed read of the bound-device list used to render as "no device bound
  // yet", which is a business answer to a question nobody could answer, and it
  // is the answer that sends a collector off to bind a device they already
  // have. Unknown state offers a retry instead (same rule as TaskDetail).
  //
  // Which camera belongs to which collector is the platform's record, not this
  // phone's, so a build with no server shows neither a list nor the form that
  // would write to one: binding here would record the pairing nowhere.
  if (devices.isError) {
    return (
      <LoadFailed
        title={tt('devices.title')}
        error={devices.error}
        onRetry={() => void devices.refetch()}
      />
    );
  }
  if (devices.data === undefined) return <Loading title={tt('devices.title')} />;

  return (
    <Screen title={tt('devices.title')}>
      {devices.data.length === 0 ? <Body muted>{tt('devices.empty')}</Body> : null}
      {devices.data.map((d) => (
        <Card key={d.serial}>
          <Title>{d.serial}</Title>
          <Row label={tt('devices.boundAt')} value={new Date(d.boundAt).toLocaleString()} />
        </Card>
      ))}
      <Card>
        <Button label={tt('devices.scanQr')} kind="ghost" onPress={() => setSerial(MOCK_QR_SERIAL)} />
        <Body muted>{tt('devices.qrMock')}</Body>
        <Field label={tt('devices.typed')} value={serial} onChangeText={setSerial} />
        <Button
          label={tt('devices.bind')}
          disabled={serial.trim() === ''}
          onPress={() => bind.mutate(serial)}
        />
        {/*
          The server's refusal, translated. This printed `bind.error.message`
          — so a Vietnamese collector who scanned the same camera twice read
          the string `already_bound`, and one who tapped Bind with an empty
          field read `serial_empty`. The codes are a protocol; `src/errors.ts`
          is where they become sentences.
        */}
        {bind.isError ? <Note text={tt(errorKey(bind.error))} /> : null}
      </Card>
      <Button
        label={tt('devices.provision')}
        kind="ghost"
        disabled={devices.data.length === 0}
        onPress={() => nav.push({ name: 'provisioning' })}
      />
    </Screen>
  );
}
