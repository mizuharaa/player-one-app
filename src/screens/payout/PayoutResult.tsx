import { Linking } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useApi } from '../../api/context.tsx';
import type { PayoutAccount } from '../../api/types.ts';
import { useNav } from '../../nav.tsx';
import { useT } from '../../locale.tsx';
import { useTheme } from '../../theme.tsx';
import { Body, Button, Card, Note, Row, Screen, Tag, Title } from '../../ui.tsx';
import {
  resultActions,
  VERIFY_RESULT_TEXT,
  VERIFY_STATUS_KEY,
  VERIFY_STATUS_TONE,
  type ResultAction,
} from '../../services/payout/status.ts';
import { SUPPORT_URL } from '../../services/payout/support.ts';
import { toneColors } from './tone.ts';

/**
 * ZaloPay's verdict on the declared account, as the server relayed it.
 *
 * - verified      green, and the name ZaloPay has on file.
 * - name_mismatch both names, side by side, and a way to fix it. It does
 *                 not say who is wrong: the collector may have typed a
 *                 middle name ZaloPay does not hold, or vice versa.
 * - no_wallet     the onboarding page ZaloPay returned, deep-linked.
 * - kyc_limit     the reform page ZaloPay returned, deep-linked.
 * - locked        plain words, and what happens to the money meanwhile.
 * Nothing on this screen is decided here; it renders the server's row.
 */
export function PayoutResult() {
  const api = useApi();
  const nav = useNav();
  const tt = useT();
  const theme = useTheme();
  const account = useQuery({ queryKey: ['payoutAccount'], queryFn: () => api.payoutAccount() });

  if (account.isError) {
    return (
      <Screen title={tt('payout.result.title')}>
        <Note text={tt('common.loadFailed')} />
        <Button label={tt('common.retry')} onPress={() => void account.refetch()} />
      </Screen>
    );
  }
  if (account.data === undefined) {
    return (
      <Screen title={tt('payout.result.title')}>
        <Body muted>{tt('common.loading')}</Body>
      </Screen>
    );
  }
  const current = account.data;
  if (current === null) {
    return (
      <Screen title={tt('payout.result.title')}>
        <Note text={tt('payout.result.none')} />
        <Button label={tt('payout.declare')} onPress={() => nav.push({ name: 'payoutDeclare' })} />
      </Screen>
    );
  }

  const text = VERIFY_RESULT_TEXT[current.verifyStatus];
  const verified = current.verifyStatus === 'verified';
  const mismatch = current.verifyStatus === 'name_mismatch';
  const support = current.verifyStatus === 'locked' ? SUPPORT_URL : null;

  return (
    <Screen title={tt('payout.result.title')}>
      <Card>
        <Tag label={tt(VERIFY_STATUS_KEY[current.verifyStatus])} {...toneColors(theme, VERIFY_STATUS_TONE[current.verifyStatus])} />
        <Title>{tt(text.title)}</Title>
        {verified && current.verifiedName !== null ? <Title>{current.verifiedName}</Title> : null}
        <Body>{tt(text.body)}</Body>
        {mismatch ? (
          <>
            <Row label={tt('payout.declaredName')} value={current.declaredName} />
            <Row label={tt('payout.verifiedName')} value={current.verifiedName ?? '—'} />
          </>
        ) : null}
        {current.verifiedAt !== null ? (
          <Row label={tt('payout.verifiedAt')} value={new Date(current.verifiedAt).toLocaleString()} />
        ) : null}
        {resultActions(current).map((action) => (
          <ActionButton key={action} action={action} account={current} />
        ))}
        {support !== null ? (
          <Button label={tt('payout.result.contact')} kind="ghost" onPress={() => void Linking.openURL(support)} />
        ) : null}
      </Card>
    </Screen>
  );
}

function ActionButton({ action, account }: { action: ResultAction; account: PayoutAccount }) {
  const nav = useNav();
  const tt = useT();
  switch (action) {
    case 'fixName':
      return <Button label={tt('payout.result.fixName')} onPress={() => nav.push({ name: 'payoutDeclare' })} />;
    case 'openOnboarding':
      return (
        <Button
          label={tt('payout.result.openOnboarding')}
          onPress={() => void Linking.openURL(account.onboardingUrl ?? '')}
        />
      );
    case 'openReform':
      return (
        <Button label={tt('payout.result.openReform')} onPress={() => void Linking.openURL(account.reformUrl ?? '')} />
      );
    case 'redeclare':
      return <Button label={tt('payout.result.redeclare')} onPress={() => nav.push({ name: 'payoutDeclare' })} />;
    case 'other':
      return (
        <Button label={tt('payout.result.other')} kind="ghost" onPress={() => nav.push({ name: 'payoutDeclare' })} />
      );
  }
}
