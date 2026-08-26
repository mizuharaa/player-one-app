import { useQuery } from '@tanstack/react-query';
import { useApi } from '../../api/context.tsx';
import type { PayoutAccount } from '../../api/types.ts';
import { useNav } from '../../nav.tsx';
import { useT } from '../../locale.tsx';
import { useTheme } from '../../theme.tsx';
import { Body, Button, Card, Note, Row, Screen, Tag, Title } from '../../ui.tsx';
import { VERIFY_STATUS_KEY, VERIFY_STATUS_TONE } from '../../services/payout/status.ts';
import { toneColors } from './tone.ts';

/**
 * The payout hub: the account the collector's money goes to, ZaloPay's
 * verdict on it, and the doors to declaring one and to the statements.
 *
 * Everything shown is the server's row. The bank's display name is looked up
 * from the server's bank list, not carried on the account and not hardcoded;
 * the account number is the last four digits the server chose to send.
 */
export function Payout() {
  const api = useApi();
  const nav = useNav();
  const tt = useT();
  const theme = useTheme();

  const account = useQuery({ queryKey: ['payoutAccount'], queryFn: () => api.payoutAccount() });
  const banks = useQuery({ queryKey: ['payoutBankCodes'], queryFn: () => api.payoutBankCodes() });

  if (account.isError) {
    return (
      <Screen title={tt('payout.title')}>
        <Note text={tt('common.loadFailed')} />
        <Button label={tt('common.retry')} onPress={() => void account.refetch()} />
      </Screen>
    );
  }
  if (account.data === undefined) {
    return (
      <Screen title={tt('payout.title')}>
        <Body muted>{tt('common.loading')}</Body>
      </Screen>
    );
  }

  const current = account.data;
  const bankName = (code: string): string => banks.data?.find((b) => b.code === code)?.name ?? code;
  const identifier = (a: PayoutAccount): string =>
    a.method === 'WALLET'
      ? (a.phone ?? '—')
      : `${bankName(a.bankCode ?? '')} · ${tt('payout.last4')} ${a.accountNoLast4 ?? '—'}`;

  return (
    <Screen title={tt('payout.title')}>
      <Body muted>{tt('payout.intro')}</Body>
      {current === null ? (
        <Card>
          <Body muted>{tt('payout.none')}</Body>
          <Button label={tt('payout.declare')} onPress={() => nav.push({ name: 'payoutDeclare' })} />
        </Card>
      ) : (
        <Card>
          <Title>{tt('payout.current')}</Title>
          <Tag label={tt(VERIFY_STATUS_KEY[current.verifyStatus])} {...toneColors(theme, VERIFY_STATUS_TONE[current.verifyStatus])} />
          <Row label={tt('payout.method')} value={tt(`payout.method.${current.method}`)} />
          <Row label={current.method === 'WALLET' ? tt('payout.phone') : tt('payout.bank')} value={identifier(current)} />
          <Row label={tt('payout.declaredName')} value={current.declaredName} />
          {current.verifiedName !== null ? <Row label={tt('payout.verifiedName')} value={current.verifiedName} /> : null}
          <Button label={tt('payout.viewResult')} kind="ghost" onPress={() => nav.push({ name: 'payoutResult' })} />
          <Button label={tt('payout.change')} kind="ghost" onPress={() => nav.push({ name: 'payoutDeclare' })} />
        </Card>
      )}
      <Button label={tt('payout.income')} kind="ghost" onPress={() => nav.push({ name: 'payoutIncome' })} />
    </Screen>
  );
}
