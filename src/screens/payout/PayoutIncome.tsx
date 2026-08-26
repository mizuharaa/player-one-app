import { useQuery } from '@tanstack/react-query';
import { useApi } from '../../api/context.tsx';
import { useT } from '../../locale.tsx';
import { useTheme } from '../../theme.tsx';
import { Body, Button, Card, ListScreen, Note, Row, Tag, Title } from '../../ui.tsx';
import { periodStatusKey, periodStatusTone } from '../../services/payout/status.ts';
import { displayDate, toneColors } from './tone.ts';

/**
 * One card per settlement period: valid minutes, gross, withheld, net, and
 * where the money is. Every figure is printed as the string the server sent
 * — this file adds a currency sign and nothing else.
 *
 * Reads are cached and shown with the time they were fetched; when the
 * server cannot be reached the last statements stay on screen, labelled as
 * saved. The cache is React Query's in-memory one, so it lasts one process —
 * the same ceiling as everything else in this scaffold (`src/App.tsx`).
 *
 * A held period reads as a neutral "under review" and nothing more. The row
 * type carries no reason, so there is no reason to show.
 */
export function PayoutIncome() {
  const api = useApi();
  const tt = useT();
  const theme = useTheme();
  const income = useQuery({ queryKey: ['payoutIncome'], queryFn: () => api.payoutIncome() });

  const header = (
    <>
      <Note text={tt('payout.income.intro')} />
      {income.data !== undefined && income.dataUpdatedAt > 0 ? (
        <Body muted>{`${tt('payout.income.updatedAt')}: ${new Date(income.dataUpdatedAt).toLocaleString()}`}</Body>
      ) : null}
      {income.isError ? (
        <>
          <Note text={income.data !== undefined ? tt('payout.income.stale') : tt('common.loadFailed')} />
          <Button label={tt('common.retry')} kind="ghost" onPress={() => void income.refetch()} />
        </>
      ) : null}
    </>
  );

  return (
    <ListScreen
      title={tt('payout.income.title')}
      data={income.data ?? []}
      keyOf={(period) => period.periodStart}
      header={header}
      empty={income.data !== undefined ? <Body muted>{tt('payout.income.empty')}</Body> : null}
      renderItem={(period) => (
        <Card>
          <Title>{`${displayDate(period.periodStart)} – ${displayDate(period.periodEnd)}`}</Title>
          <Tag label={tt(periodStatusKey(period.status))} {...toneColors(theme, periodStatusTone(period.status))} />
          <Row label={tt('payout.income.validMinutes')} value={period.validMinutes} />
          <Row label={tt('payout.income.gross')} value={`${period.grossVnd} ₫`} />
          <Row label={tt('payout.income.withheld')} value={`${period.withheldVnd} ₫`} />
          <Row label={tt('payout.income.net')} value={`${period.netVnd} ₫`} />
          {period.paidAt !== null ? (
            <Row label={tt('payout.income.paidAt')} value={new Date(period.paidAt).toLocaleString()} />
          ) : null}
          {period.status === 'on_hold' ? <Body muted>{tt('payout.status.onHoldHint')}</Body> : null}
        </Card>
      )}
    />
  );
}
