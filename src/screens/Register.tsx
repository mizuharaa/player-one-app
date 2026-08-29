import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useApi } from '../api/context.tsx';
import { useNav } from '../nav.tsx';
import { useT } from '../locale.tsx';
import { useSession } from '../session.tsx';
import { Body, Button, Card, Field, Note, Row, Screen } from '../ui.tsx';

/** APP-01: register an account. Agreements follow immediately (APP-02). */
export function Register() {
  const api = useApi();
  const nav = useNav();
  const tt = useT();
  const { session } = useSession();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [missing, setMissing] = useState(false);

  const register = useMutation({
    mutationFn: () => api.register(name, phone),
    onSuccess: () => nav.push({ name: 'agreements' }),
    onError: () => setMissing(true),
  });

  return (
    <Screen title={tt('register.title')}>
      <Body muted>{tt('register.intro')}</Body>
      {/*
        A collector who has just proved their phone number is asked to register,
        which reads as the app having forgotten them. It has not: the token
        proves who they are, and the server holds nothing else about them yet —
        there is no route for a name, the six agreements, the training or the
        exam, so all four are recorded on this phone (`src/api/http.ts` lists
        which methods are delegated and why). Saying that here beats leaving a
        signed-in collector to guess. Their number is shown with it, so they can
        see the app has not lost the sign-in it is about to look like it lost.

        Plain `Body` inside a `Card`, not `Note`, for the reason the privacy
        card in `SessionCreate.tsx` gives: `Note` is a live region, for what the
        machine says after an action. This is standing text present on mount,
        and a screen reader should meet it in reading order rather than be
        interrupted at it.
      */}
      {session !== null ? (
        <Card>
          <Row label={tt('signin.signedInAs')} value={session.phone} />
          <Body>{tt('register.signedIn')}</Body>
        </Card>
      ) : null}
      <Card>
        <Field label={tt('register.name')} value={name} onChangeText={setName} />
        <Field label={tt('register.phone')} value={phone} onChangeText={setPhone} />
        {missing ? <Note text={tt('register.missing')} /> : null}
        <Button label={tt('register.submit')} onPress={() => register.mutate()} />
      </Card>
    </Screen>
  );
}
