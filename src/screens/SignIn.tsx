import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { API_BASE_URL } from '../api/config.ts';
import { requestSignInCode, verifySignInCode } from '../api/http.ts';
import { errorKey } from '../errors.ts';
import { useT } from '../locale.tsx';
import { useSession } from '../session.tsx';
import { Body, Button, Card, Field, Note, Screen } from '../ui.tsx';

/**
 * Sign in with a phone number and a six-digit code.
 *
 * Two steps in one screen rather than two screens, because the second step is
 * meaningless without the first and Android's Back between them would send a
 * collector out of the app. `sent` is the step.
 *
 * The server answers `POST /auth/collector/request-code` with 204 whether or
 * not the number is enrolled — it refuses to say who exists — so this screen
 * refuses to say either. "A code has been sent" is what an unknown number sees
 * too, and the failure surfaces at the code step as one sentence covering a
 * wrong number, a wrong code, an expired code and too many tries. That is the
 * server's own choice of four-into-one and the app does not unpick it.
 *
 * Nothing here is stored in `src/api/persist.ts`. The token goes to
 * `expo-secure-store` via `src/auth.ts`; the typed code goes nowhere at all.
 */
export function SignIn() {
  const tt = useT();
  const { signIn } = useSession();
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [sent, setSent] = useState(false);
  const [missing, setMissing] = useState(false);

  const baseUrl = API_BASE_URL ?? '';

  const request = useMutation({
    mutationFn: () => requestSignInCode(baseUrl, phone.trim()),
    onSuccess: () => setSent(true),
  });

  const verify = useMutation({
    mutationFn: async () => {
      const token = await verifySignInCode(baseUrl, phone.trim(), code.trim());
      await signIn({ token, phone: phone.trim() });
    },
  });

  return (
    <Screen title={tt('signin.title')}>
      <Body muted>{tt('signin.intro')}</Body>
      <Card>
        <Field
          label={tt('signin.phone')}
          value={phone}
          onChangeText={(v) => {
            setPhone(v);
            setMissing(false);
          }}
          keyboardType="phone-pad"
          autoComplete="tel"
          editable={!sent}
        />
        {!sent ? (
          <>
            {missing ? <Note text={tt('signin.phoneMissing')} /> : null}
            {request.isError ? <Note text={tt(errorKey(request.error))} /> : null}
            <Button
              label={request.isPending ? tt('signin.sending') : tt('signin.sendCode')}
              disabled={request.isPending}
              onPress={() => {
                if (phone.trim() === '') {
                  setMissing(true);
                  return;
                }
                request.mutate();
              }}
            />
          </>
        ) : (
          <>
            <Note text={tt('signin.codeSent')} />
            <Field
              label={tt('signin.code')}
              value={code}
              onChangeText={(v) => {
                setCode(v);
                setMissing(false);
              }}
              keyboardType="number-pad"
              autoComplete="sms-otp"
            />
            {missing ? <Note text={tt('signin.codeMissing')} /> : null}
            {verify.isError ? <Note text={tt(errorKey(verify.error))} /> : null}
            <Button
              label={verify.isPending ? tt('signin.verifying') : tt('signin.verify')}
              disabled={verify.isPending}
              onPress={() => {
                if (code.trim() === '') {
                  setMissing(true);
                  return;
                }
                verify.mutate();
              }}
            />
            {/*
              A mistyped number is the commonest reason the code never arrives,
              and without this the only way back is killing the app.
            */}
            <Button
              label={tt('signin.changePhone')}
              kind="ghost"
              onPress={() => {
                setSent(false);
                setCode('');
                request.reset();
                verify.reset();
              }}
            />
          </>
        )}
      </Card>
      <Body muted>{tt('signin.shared')}</Body>
    </Screen>
  );
}
