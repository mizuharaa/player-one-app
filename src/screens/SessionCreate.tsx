import { useState } from 'react';
import { View } from 'react-native';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useApi } from '../api/context.tsx';
import { isNoServer } from '../api/local.ts';
import { useT } from '../locale.tsx';
import { useTheme } from '../theme.tsx';
import { Body, Button, Card, Choice, LoadFailed, Loading, Note, Row, Screen, Title } from '../ui.tsx';

/**
 * APP-16/17: one session binds task + collector + device + scenario, before
 * recording. APP-17b: the two declarations are explicit answers — no default,
 * no pre-ticked switch; unanswered means the session cannot be created.
 *
 * Nothing here sends a duration, an amount, or a start/stop — the session is
 * a binding, and recording happens on the device.
 */
function YesNo({
  question,
  value,
  onChange,
}: {
  question: string;
  value: boolean | null;
  onChange: (v: boolean) => void;
}) {
  const tt = useT();
  const theme = useTheme();
  return (
    <View style={{ gap: theme.space[2] }}>
      <Body>{question}</Body>
      <View style={{ flexDirection: 'row', gap: theme.space[3] }}>
        <Choice
          label={tt('session.yes')}
          describedBy={question}
          selected={value === true}
          onPress={() => onChange(true)}
        />
        <Choice
          label={tt('session.no')}
          describedBy={question}
          selected={value === false}
          onPress={() => onChange(false)}
        />
      </View>
    </View>
  );
}

export function SessionCreate() {
  const api = useApi();
  const tt = useT();
  const theme = useTheme();

  const claims = useQuery({ queryKey: ['claims'], queryFn: () => api.myClaims() });
  const tasks = useQuery({ queryKey: ['tasks'], queryFn: () => api.tasks() });
  const devices = useQuery({ queryKey: ['devices'], queryFn: () => api.boundDevices() });

  const [taskId, setTaskId] = useState<string | null>(null);
  const [deviceSerial, setDeviceSerial] = useState<string | null>(null);
  const [others, setOthers] = useState<boolean | null>(null);
  const [sensitive, setSensitive] = useState<boolean | null>(null);
  const [createdId, setCreatedId] = useState<string | null>(null);

  const claimedTasks = (tasks.data ?? []).filter((t) =>
    (claims.data ?? []).some((c) => c.taskId === t.id),
  );
  const task = claimedTasks.find((t) => t.id === taskId);
  const device = (devices.data ?? []).find((d) => d.serial === deviceSerial);

  const create = useMutation({
    mutationFn: () => {
      if (task === undefined || device === undefined || others === null || sensitive === null) {
        throw new Error('incomplete');
      }
      return api.createSession({
        taskId: task.id,
        deviceSerial: device.serial,
        scenario: task.scenario,
        othersInFrame: others,
        sensitiveInfo: sensitive,
      });
    },
    onSuccess: (session) => setCreatedId(session.id),
  });

  // Every gate on this screen is drawn from a list, so a failed read turns
  // into an instruction: no claims read becomes "Cần nhận một nhiệm vụ trước"
  // and no devices read becomes "Cần liên kết thiết bị trước" — telling a
  // collector to redo work they have already done. All three reads gate the
  // form, so all three are checked, and none of them answers while unknown.
  //
  // A build with no server is the exception, and it is why this screen does not
  // simply hand every failure to `LoadFailed`: the claimed task and the bound
  // device come from the platform and cannot be listed, but the pre-collection
  // reminder (PRV-02) and the two declarations (APP-17b) are this screen's own
  // and are the part a collector must be able to read. So the form stays,
  // stating why the two pickers are empty, and the button stays disabled
  // because there is still nothing to bind a session to.
  const noServer = [claims, tasks, devices].some((q) => isNoServer(q.error));
  const failed = [claims, tasks, devices].find((q) => q.isError && !isNoServer(q.error));
  if (failed !== undefined) {
    return (
      <LoadFailed
        title={tt('session.title')}
        error={failed.error}
        onRetry={() => {
          void claims.refetch();
          void tasks.refetch();
          void devices.refetch();
        }}
      />
    );
  }
  if (
    !noServer &&
    (claims.data === undefined || tasks.data === undefined || devices.data === undefined)
  ) {
    return <Loading title={tt('session.title')} />;
  }

  const pick = <T,>(
    items: T[],
    key: (x: T) => string,
    label: (x: T) => string,
    describedBy: string,
    selected: string | null,
    onPick: (k: string) => void,
  ) => (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.space[2] }}>
      {items.map((item) => (
        <Choice
          key={key(item)}
          label={label(item)}
          describedBy={describedBy}
          selected={selected === key(item)}
          onPress={() => onPick(key(item))}
        />
      ))}
    </View>
  );

  return (
    <Screen title={tt('session.title')}>
      <Body muted>{tt('session.intro')}</Body>

      <Card>
        <Title>{tt('session.task')}</Title>
        {/*
          "Claim a task first" is an instruction, and an instruction is a claim
          about the collector's own record. With no server nobody knows what
          they have claimed, so the screen says that instead of sending them to
          a task hall that is equally empty.
        */}
        {noServer ? (
          <Note text={tt('common.noServer')} />
        ) : claimedTasks.length === 0 ? (
          <Note text={tt('session.needClaim')} />
        ) : null}
        {pick(claimedTasks, (t) => t.id, (t) => t.title, tt('session.task'), taskId, setTaskId)}
        {task !== undefined ? (
          <Row label={tt('session.scenario')} value={tt(`scenario.${task.scenario}`)} />
        ) : null}
      </Card>

      <Card>
        <Title>{tt('session.device')}</Title>
        {noServer ? (
          <Note text={tt('common.noServer')} />
        ) : (devices.data ?? []).length === 0 ? (
          <Note text={tt('session.needDevice')} />
        ) : null}
        {pick(
          devices.data ?? [],
          (d) => d.serial,
          (d) => d.serial,
          tt('session.device'),
          deviceSerial,
          setDeviceSerial,
        )}
      </Card>

      {/*
        PRV-02 / APP-20: the pre-collection reminder, shown before each session
        because this screen is what "before each session" means — a session is
        bound here and nowhere else. It sits immediately above the two APP-17b
        declarations rather than at the top of the screen, so a collector reads
        what to avoid and then answers whether it may appear anyway.

        Plain `Body` inside a `Card`, not `Note`: `Note` is a live region, for
        the machine answering an action. This is standing text that a screen
        reader should meet in reading order, not have interrupted at it.
      */}
      <Card>
        <Title>{tt('session.privacyTitle')}</Title>
        {/*
          Neither sentence is `muted`. Every other screen's supporting line is,
          and `mutedForeground` is the right colour for a line a collector may
          skip. This is the one PaXini's PRD requires to be displayed, so it is
          drawn at the same contrast as the questions it governs.
        */}
        <Body>{tt('session.privacyAvoid')}</Body>
        <Body>{tt('session.privacySensitive')}</Body>
      </Card>

      <Card>
        <Title>{tt('session.declare')}</Title>
        <YesNo question={tt('session.othersTitle')} value={others} onChange={setOthers} />
        <YesNo question={tt('session.sensitiveTitle')} value={sensitive} onChange={setSensitive} />
        {others === null || sensitive === null ? <Note text={tt('session.needDeclarations')} /> : null}
      </Card>

      {createdId !== null ? (
        <Card>
          <Title>{tt('session.created')}</Title>
          <Row label={tt('session.id')} value={createdId} />
        </Card>
      ) : null}

      <Button
        label={tt('session.create')}
        disabled={
          task === undefined || device === undefined || others === null || sensitive === null
        }
        onPress={() => create.mutate()}
      />
      <Note text={tt('session.noRecord')} />
    </Screen>
  );
}
