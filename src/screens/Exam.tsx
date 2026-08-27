import { useState } from 'react';
import { Switch, View } from 'react-native';
import { useMutation, useQuery } from '@tanstack/react-query';
import { EXAM_QUESTION_COUNT } from '../api/mock.ts';
import { useApi } from '../api/context.tsx';
import { useNav } from '../nav.tsx';
import { useT } from '../locale.tsx';
import { useTheme } from '../theme.tsx';
import { Body, Button, Card, Note, Screen, Tag } from '../ui.tsx';

/**
 * APP-04: pass/fail recorded; APP-05's gate follows from the result. The
 * questions are a shell until PaXini's exam content arrives.
 */
export function Exam() {
  const api = useApi();
  const nav = useNav();
  const tt = useT();
  const theme = useTheme();
  const [answers, setAnswers] = useState<boolean[]>(Array(EXAM_QUESTION_COUNT).fill(false));
  const [result, setResult] = useState<'passed' | 'failed' | null>(null);

  const questions = [tt('exam.q1'), tt('exam.q2'), tt('exam.q3')];

  const submit = useMutation({
    mutationFn: () => api.submitExam(answers),
    onSuccess: ({ passed }) => setResult(passed ? 'passed' : 'failed'),
  });

  /**
   * A pass already on record. `submitExam` only ever sets `examPassed`, never
   * clears it, so a collector who passed before and is retaking is still
   * qualified while this attempt sits at "failed" — and telling them so is the
   * difference between a screen they can leave and a screen that looks like it
   * has taken their job away. A failed read leaves this false, which offers
   * one route out instead of two rather than claiming anything untrue.
   */
  const profile = useQuery({ queryKey: ['profile'], queryFn: () => api.profile() });
  const alreadyQualified =
    profile.data !== undefined && profile.data !== null && profile.data.examPassed;

  return (
    <Screen title={tt('exam.title')}>
      <Body muted>{tt('exam.intro')}</Body>
      {questions.map((q, i) => (
        <Card key={q}>
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: theme.space[3],
            }}
          >
            <View style={{ flexShrink: 1 }}>
              <Body>{q}</Body>
            </View>
            <Switch
              accessibilityLabel={q}
              value={answers[i] === true}
              onValueChange={(v) => setAnswers((a) => a.map((x, j) => (j === i ? v : x)))}
              thumbColor={theme.color.background}
              trackColor={{ false: theme.color.borderStrong, true: theme.color.sun[500] }}
            />
          </View>
        </Card>
      ))}
      {result === 'passed' ? (
        <Tag label={tt('exam.passed')} fg={theme.color.verdict.pass.fg} bg={theme.color.verdict.pass.bg} />
      ) : null}
      {result === 'failed' ? (
        <Tag label={tt('exam.failed')} fg={theme.color.verdict.reject.fg} bg={theme.color.verdict.reject.bg} />
      ) : null}
      {/*
        A failed attempt used to leave one control on the screen — Submit —
        and no route anywhere else. Retrying the same three switches produces
        the same refusal, so the collector taps it, gets the same red pill, and
        the exam is where the account ends. There is no persistence yet either
        (`src/App.tsx`), so a restart drops them at registration rather than
        back here; that is a separate and larger piece of work, and this screen
        is not the place to work around it.
        The way out is named instead: back to the training the exam is drawn
        from, the retry itself demoted to a secondary control, and — only for a
        collector who has already qualified — back to the home screen with
        their standing pass stated.
      */}
      {result === 'failed' ? (
        <>
          <Button label={tt('exam.review')} onPress={() => nav.push({ name: 'training' })} />
          <Button label={tt('exam.retry')} kind="ghost" onPress={() => submit.mutate()} />
          {alreadyQualified ? (
            <>
              <Note text={tt('exam.stillQualified')} />
              <Button label={tt('exam.home')} kind="ghost" onPress={() => nav.reset({ name: 'home' })} />
            </>
          ) : null}
        </>
      ) : result === 'passed' ? (
        <Button label={tt('home.tasks')} onPress={() => nav.reset({ name: 'home' })} />
      ) : (
        <Button label={tt('exam.submit')} onPress={() => submit.mutate()} />
      )}
    </Screen>
  );
}
