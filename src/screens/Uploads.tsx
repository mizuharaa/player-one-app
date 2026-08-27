import { useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { EpisodeState } from '../api/types.ts';
import { useApi } from '../api/context.tsx';
import { useT } from '../locale.tsx';
import { useTheme } from '../theme.tsx';
import type { NativeTheme } from '../design/native.ts';
import { Body, Button, Card, ListScreen, LoadFailed, Note, Row, Tag, Title } from '../ui.tsx';

/**
 * APP-23/24: every episode and its state. APP-25: the upload starts from an
 * explicit, in-your-face confirmation and from nowhere else. There is no
 * "upload all", no auto-retry that starts a fresh upload, no effect that
 * fires on network state. The collector decides what leaves their phone.
 */
const stateColors = (theme: NativeTheme, state: EpisodeState): { fg: string; bg: string } => {
  switch (state) {
    case 'review_passed':
      return theme.color.verdict.pass;
    case 'review_failed':
      return theme.color.verdict.reject;
    case 'under_review':
      return theme.color.verdict.partial;
    case 'uploading':
    case 'uploaded':
      return { fg: theme.color.tech[700], bg: theme.color.tech[100] };
    case 'pending_upload':
      return { fg: theme.color.mutedForeground, bg: theme.color.muted };
  }
};

const gb = (bytes: number): string => `${(bytes / 1024 ** 3).toFixed(1)} GB`;

export function Uploads() {
  const api = useApi();
  const tt = useT();
  const theme = useTheme();
  const queryClient = useQueryClient();
  /** The episode whose confirmation step is open. One at a time, on purpose. */
  const [confirming, setConfirming] = useState<string | null>(null);

  const episodes = useQuery({ queryKey: ['episodes'], queryFn: () => api.episodes() });

  const confirm = useMutation({
    mutationFn: (episodeId: string) => api.confirmUpload(episodeId),
    onSuccess: async () => {
      setConfirming(null);
      await queryClient.invalidateQueries({ queryKey: ['episodes'] });
    },
  });

  // An empty upload queue and a failed read of it are not the same thing: the
  // first says the phone is clear, the second says nothing is known, and a
  // collector who believes the first stops looking for footage they recorded.
  if (episodes.isError) {
    return <LoadFailed title={tt('uploads.title')} onRetry={() => void episodes.refetch()} />;
  }

  return (
    <ListScreen
      title={tt('uploads.title')}
      data={episodes.data ?? []}
      keyOf={(episode) => episode.episodeId}
      header={<Note text={tt('uploads.confirmBody')} />}
      empty={
        <Body muted>{tt(episodes.data === undefined ? 'common.loading' : 'uploads.empty')}</Body>
      }
      renderItem={(episode) => {
        const colors = stateColors(theme, episode.state);
        return (
          <Card>
            <Title>{episode.episodeId}</Title>
            <Row label={tt('uploads.size')} value={gb(episode.sizeBytes)} />
            <Tag label={tt(`state.${episode.state}`)} fg={colors.fg} bg={colors.bg} />
            {episode.rejectReason !== undefined ? (
              <Row label={tt('uploads.reason')} value={episode.rejectReason} />
            ) : null}
            {/*
              An episode enters `uploading` and stays there: no transfer worker
              exists yet, and the mock is right not to pretend otherwise
              (`src/api/mock.ts` says why). On screen that read as a hang — a
              pill saying "Đang tải lên" and nothing moving, for ever — so a
              collector waits, or taps, or worries the footage is stuck.
              An indeterminate spinner and a sentence are the honest pair:
              something IS in progress, nobody knows how far along, and the
              collector does not have to sit here for it. The spinner is
              decoration for a screen reader (the state pill and this sentence
              both already say it in words), and the state is never carried by
              the spinner alone.
            */}
            {episode.state === 'uploading' ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.space[3] }}>
                <ActivityIndicator accessible={false} color={theme.color.tech[500]} />
                <View style={{ flexShrink: 1 }}>
                  <Body muted>{tt('uploads.uploadingHint')}</Body>
                </View>
              </View>
            ) : null}
            {episode.state === 'pending_upload' && confirming !== episode.episodeId ? (
              <Button label={tt('uploads.upload')} onPress={() => setConfirming(episode.episodeId)} />
            ) : null}
            {confirming === episode.episodeId ? (
              <View style={{ gap: theme.space[2] }}>
                <Title>{tt('uploads.confirmTitle')}</Title>
                <Body muted>{tt('uploads.confirmBody')}</Body>
                <Button label={tt('uploads.upload')} onPress={() => confirm.mutate(episode.episodeId)} />
                <Button label={tt('common.cancel')} kind="ghost" onPress={() => setConfirming(null)} />
              </View>
            ) : null}
          </Card>
        );
      }}
    />
  );
}
