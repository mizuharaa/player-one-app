import { View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useApi } from '../api/context.tsx';
import { useLocale, useT } from '../locale.tsx';
import { useTheme } from '../theme.tsx';
import { Body, ListScreen, LoadFailed, Row, Tag, Title } from '../ui.tsx';
import type { MessageKey } from '../i18n.ts';

/**
 * The five values `settlements.settlement_state` can hold
 * (`packages/store/src/schema.ts`), in the collector's language. The screen
 * used to print the raw column value, so a Vietnamese collector read
 * "bill_generated".
 *
 * A value outside the five stays visible rather than going silently blank —
 * a state the server invents later should be seen. It used to fall back to
 * itself, which put the identifier back on screen, so it falls back to a
 * Vietnamese sentence instead: the row is still there, still says the state is
 * one the app does not know, and still says it in the collector's language.
 */
const SETTLEMENT_STATES: Record<string, MessageKey> = {
  pending_review: 'settlement.pending_review',
  pending_settlement: 'settlement.pending_settlement',
  bill_generated: 'settlement.bill_generated',
  manually_paid: 'settlement.manually_paid',
  exception: 'settlement.exception',
};

const settlementLabel = (tt: (key: MessageKey) => string, state: string): string =>
  tt(SETTLEMENT_STATES[state] ?? 'common.unknownState');

/**
 * APP-33/34: per-episode effective minutes, amount and settlement state —
 * with estimated and confirmed visually unmistakable: confirmed sits in a
 * solid card with the pass verdict's colours; estimated is dashed, muted, and
 * labelled. Every figure is the server's; the app computes nothing, sums
 * nothing, rounds nothing.
 */
export function Income() {
  const api = useApi();
  const tt = useT();
  const { locale } = useLocale();
  const theme = useTheme();
  const income = useQuery({ queryKey: ['income'], queryFn: () => api.income() });

  // This is the screen where an empty list is worst: "no income yet" is a
  // statement about the collector's pay, and a failed read used to make it.
  if (income.isError) {
    return <LoadFailed title={tt('income.title')} onRetry={() => void income.refetch()} />;
  }

  return (
    <ListScreen
      title={tt('income.title')}
      data={income.data ?? []}
      keyOf={(entry) => entry.episodeId}
      empty={
        <Body muted>{tt(income.data === undefined ? 'common.loading' : 'income.empty')}</Body>
      }
      /*
        Every figure below is cached — react-query serves the last answer while
        it re-reads — and a money figure with no date on it is a lie the minute
        it goes stale. `dataUpdatedAt` is the moment the numbers on this screen
        were actually read from the server, so it is printed with them. It is
        zero before the first successful read, and then there are no figures to
        stamp.
      */
      header={
        income.dataUpdatedAt === 0 ? null : (
          <Row
            label={tt('income.fetchedAt')}
            value={new Date(income.dataUpdatedAt).toLocaleString()}
          />
        )
      }
      renderItem={(entry) => {
        const confirmed = entry.kind === 'confirmed';
        return (
          <View
            style={{
              backgroundColor: confirmed ? theme.color.card : theme.color.surface,
              borderWidth: 1,
              borderStyle: confirmed ? 'solid' : 'dashed',
              borderColor: confirmed ? theme.color.border : theme.color.borderStrong,
              borderRadius: theme.radius.base,
              padding: theme.space[4],
              gap: theme.space[2],
            }}
          >
            <Title>{entry.episodeId}</Title>
            {confirmed ? (
              <Tag label={tt('income.confirmed')} fg={theme.color.verdict.pass.fg} bg={theme.color.verdict.pass.bg} />
            ) : (
              <Tag label={tt('income.estimated')} fg={theme.color.mutedForeground} bg={theme.color.muted} />
            )}
            <Row label={tt('income.minutes')} value={entry.effectiveMinutes ?? '—'} />
            <Row label={tt('income.amount')} value={entry.amountVnd !== null ? `${entry.amountVnd} ₫` : '—'} />
            {/*
              `GET /api/me/income` sends the sentence with the state, in both
              of the app's languages, and its collector-facing vocabulary is a
              different and wider set than the five `settlement_state` values
              below. When the server wrote one, the server's sentence is what
              the collector reads; the map is what the mock still needs.
            */}
            {entry.settlementText !== undefined ? (
              <Row label={tt('income.settlement')} value={entry.settlementText[locale]} />
            ) : entry.settlementState !== null ? (
              <Row label={tt('income.settlement')} value={settlementLabel(tt, entry.settlementState)} />
            ) : null}
            {!confirmed ? <Body muted>{tt('income.estimatedHint')}</Body> : null}
          </View>
        );
      }}
    />
  );
}
