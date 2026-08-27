import { useQuery } from '@tanstack/react-query';
import { useApi } from '../api/context.tsx';
import { useNav } from '../nav.tsx';
import { useT } from '../locale.tsx';
import { useTheme } from '../theme.tsx';
import { Body, CardLink, ListScreen, LoadFailed, Row, Tag, Title } from '../ui.tsx';

/** APP-08: type, unit price, target, progress, claimable state. */
export function TaskHall() {
  const api = useApi();
  const nav = useNav();
  const tt = useT();
  const theme = useTheme();
  const tasks = useQuery({ queryKey: ['tasks'], queryFn: () => api.tasks() });

  // A failed read used to draw the same empty hall as a hall with no tasks in
  // it, and the collector's reading of an empty hall is "there is no work
  // today" — they close the app. It is a different screen now.
  if (tasks.isError) {
    return <LoadFailed title={tt('hall.title')} onRetry={() => void tasks.refetch()} />;
  }

  return (
    <ListScreen
      title={tt('hall.title')}
      data={tasks.data ?? []}
      keyOf={(task) => task.id}
      empty={
        <Body muted>{tt(tasks.data === undefined ? 'common.loading' : 'hall.empty')}</Body>
      }
      renderItem={(task) => {
        const full = task.claimants >= task.maxClaimants;
        return (
          <CardLink
            label={task.title}
            hint={full ? tt('hall.full') : tt('hall.open')}
            onPress={() => nav.push({ name: 'taskDetail', taskId: task.id })}
          >
            <Title>{task.title}</Title>
            <Body muted>{tt(`scenario.${task.scenario}`)}</Body>
            <Row label={tt('hall.perMinute')} value={task.unitPriceVndPerMinute} />
            <Row
              label={tt('hall.progress')}
              value={`${task.claimedMinutes}/${task.targetMinutes} ${tt('detail.minutes')}`}
            />
            <Row label={tt('hall.slots')} value={`${task.claimants}/${task.maxClaimants}`} />
            {full ? (
              <Tag label={tt('hall.full')} fg={theme.color.verdict.reject.fg} bg={theme.color.verdict.reject.bg} />
            ) : (
              <Tag label={tt('hall.open')} fg={theme.color.verdict.pass.fg} bg={theme.color.verdict.pass.bg} />
            )}
          </CardLink>
        );
      }}
    />
  );
}
