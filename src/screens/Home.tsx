import { useQuery } from '@tanstack/react-query';
import { useApi } from '../api/context.tsx';
import { useNav, type Route } from '../nav.tsx';
import { useLocale, useT } from '../locale.tsx';
import type { MessageKey } from '../i18n.ts';
import { useSession } from '../session.tsx';
import { Button, Note, Row, Screen } from '../ui.tsx';

/**
 * The hub. Every screen is one tap from here, and the two gates that shape
 * the collector's day (exam, device) are stated rather than discovered.
 */
export function Home() {
  const api = useApi();
  const nav = useNav();
  const tt = useT();
  const { locale, setLocale } = useLocale();
  const { session, signOut } = useSession();

  const profile = useQuery({ queryKey: ['profile'], queryFn: () => api.profile() });
  const devices = useQuery({ queryKey: ['devices'], queryFn: () => api.boundDevices() });

  const noDevice = (devices.data ?? []).length === 0;

  const links: { key: MessageKey; route: Route; disabled?: boolean }[] = [
    { key: 'home.tasks', route: { name: 'taskHall' } },
    { key: 'home.myTasks', route: { name: 'myTasks' } },
    { key: 'home.devices', route: { name: 'devices' } },
    { key: 'home.session', route: { name: 'sessionCreate' } },
    { key: 'home.uploads', route: { name: 'uploads' } },
    { key: 'home.income', route: { name: 'income' } },
    { key: 'home.training', route: { name: 'training' } },
    // Wi-Fi provisioning was reachable only by going to Devices first and
    // finding the button at the bottom of it — a screen a collector visits
    // once, to bind, and has no reason to open again when the camera later
    // will not reach the network. The gate is the same one Devices applies:
    // nothing to configure until something is bound. Unknown counts as none,
    // which is the safe direction, and `home.gateDevice` above says why the
    // button is grey.
    { key: 'devices.provision', route: { name: 'provisioning' }, disabled: noDevice },
  ];

  return (
    <Screen title={tt('app.name')}>
      {profile.data !== undefined && profile.data !== null && !profile.data.examPassed ? (
        <Note text={tt('home.gateExam')} />
      ) : null}
      {devices.data !== undefined && devices.data.length === 0 ? (
        <Note text={tt('home.gateDevice')} />
      ) : null}
      {links.map((l) => (
        <Button
          key={l.key}
          kind="ghost"
          label={tt(l.key)}
          disabled={l.disabled}
          onPress={() => nav.push(l.route)}
        />
      ))}
      <Button
        kind="ghost"
        label={tt('common.language')}
        onPress={() => setLocale(locale === 'vi' ? 'en' : 'vi')}
      />
      {/*
        Signing out is only on the screen when there is a session to end — the
        mock build has none. It says whose session it is first: a shared phone
        is normal in this pilot, and the collector about to record needs to see
        that the app still thinks it is the previous one.
      */}
      {session !== null ? (
        <>
          <Row label={tt('signin.signedInAs')} value={session.phone} />
          <Button kind="ghost" label={tt('signin.signOut')} onPress={signOut} />
        </>
      ) : null}
    </Screen>
  );
}
