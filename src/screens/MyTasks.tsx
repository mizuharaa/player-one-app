import { useQuery } from '@tanstack/react-query';
import { useApi } from '../api/context.tsx';
import { useNav } from '../nav.tsx';
import { useT } from '../locale.tsx';
import { Body, CardLink, ListScreen, LoadFailed, Row, Title } from '../ui.tsx';

/** APP-11: claimed tasks and their state. */
export function MyTasks() {
  const api = useApi();
  const nav = useNav();
  const tt = useT();
  const claims = useQuery({ queryKey: ['claims'], queryFn: () => api.myClaims() });
  const tasks = useQuery({ queryKey: ['tasks'], queryFn: () => api.tasks() });

  const titleOf = (taskId: string): string =>
    (tasks.data ?? []).find((t) => t.id === taskId)?.title ?? taskId;

  // Both reads, not just the claims: a failed `tasks` read leaves every row
  // titled with its raw task id, which is the same defect one layer down.
  // "You have claimed nothing" is a claim about the collector's own work and
  // must not be what a dead network looks like.
  const failed = [claims, tasks].find((q) => q.isError);
  if (failed !== undefined) {
    return (
      <LoadFailed
        title={tt('mine.title')}
        error={failed.error}
        onRetry={() => {
          void claims.refetch();
          void tasks.refetch();
        }}
      />
    );
  }

  return (
    <ListScreen
      title={tt('mine.title')}
      data={claims.data ?? []}
      keyOf={(claim) => claim.id}
      empty={
        <Body muted>
          {tt(claims.data === undefined || tasks.data === undefined ? 'common.loading' : 'mine.empty')}
        </Body>
      }
      renderItem={(claim) => (
        <CardLink
          label={titleOf(claim.taskId)}
          onPress={() => nav.push({ name: 'taskDetail', taskId: claim.taskId })}
        >
          <Title>{titleOf(claim.taskId)}</Title>
          <Row label={tt('mine.claimedAt')} value={new Date(claim.claimedAt).toLocaleString()} />
        </CardLink>
      )}
    />
  );
}
