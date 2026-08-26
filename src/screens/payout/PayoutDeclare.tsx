import { useState } from 'react';
import { View } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useApi } from '../../api/context.tsx';
import type { PayoutAccount, PayoutAccountInput } from '../../api/types.ts';
import { PAYOUT_METHODS } from '../../api/types.ts';
import { useNav } from '../../nav.tsx';
import { useT } from '../../locale.tsx';
import { useTheme } from '../../theme.tsx';
import type { MessageKey } from '../../i18n.ts';
import { Body, Button, Card, Choice, Field, Note, Screen } from '../../ui.tsx';
import { submitDeclaration } from '../../services/payout/declare.ts';
import { checkDraft, EMPTY_DRAFT, type DeclareDraft, type DraftProblem } from '../../services/payout/validate.ts';

const PROBLEM_KEY: Record<DraftProblem, MessageKey> = {
  name: 'payout.invalid.name',
  phone: 'payout.invalid.phone',
  bank: 'payout.invalid.bank',
  number: 'payout.invalid.number',
};

/**
 * Declare where the money goes: pick a method, fill in its identifier and the
 * holder's name, submit once. The server verifies with ZaloPay and the result
 * screen shows what it said.
 *
 * The form is seeded from the current account — method, phone, bank and the
 * declared name — so "fix the name" and "change account" start from what the
 * collector already told us. It is never seeded with an account number,
 * because the app does not have one: the server sent back four digits.
 */
export function PayoutDeclare() {
  const api = useApi();
  const tt = useT();
  const account = useQuery({ queryKey: ['payoutAccount'], queryFn: () => api.payoutAccount() });

  // The form mounts once the current account is known (or known to be
  // unreadable), so its initial state is a plain value and needs no effect.
  if (!account.isFetched) {
    return (
      <Screen title={tt('payout.declare')}>
        <Body muted>{tt('common.loading')}</Body>
      </Screen>
    );
  }
  return <DeclareForm initial={account.data ?? null} />;
}

function draftFrom(account: PayoutAccount | null): DeclareDraft {
  if (account === null) return EMPTY_DRAFT;
  return {
    method: account.method,
    phone: account.phone ?? '',
    bankCode: account.bankCode ?? '',
    accountNumber: '',
    declaredName: account.declaredName,
  };
}

function DeclareForm({ initial }: { initial: PayoutAccount | null }) {
  const api = useApi();
  const nav = useNav();
  const tt = useT();
  const theme = useTheme();
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<DeclareDraft>(() => draftFrom(initial));
  const [problem, setProblem] = useState<DraftProblem | null>(null);

  const banks = useQuery({ queryKey: ['payoutBankCodes'], queryFn: () => api.payoutBankCodes() });

  // retry: false is React Query's default for mutations and is written out
  // anyway: this is the one write in the app whose retry policy is a rule,
  // and a reader should not have to know the library default to see it.
  const submit = useMutation({
    retry: false,
    mutationFn: (input: PayoutAccountInput) => submitDeclaration(api, input),
    onSuccess: async (outcome) => {
      if (outcome.kind !== 'ok') return;
      // The number has done its one job. It leaves component state here so
      // that nothing after this point — not the result screen, not a later
      // return to this one — has it to show or to keep.
      setDraft((d) => ({ ...d, accountNumber: '' }));
      await queryClient.invalidateQueries({ queryKey: ['payoutAccount'] });
      nav.push({ name: 'payoutResult' });
    },
  });

  const set = <K extends keyof DeclareDraft>(key: K, value: DeclareDraft[K]) => {
    setProblem(null);
    setDraft((d) => ({ ...d, [key]: value }));
  };

  const onSubmit = () => {
    const check = checkDraft(draft);
    if (!check.ok) {
      setProblem(check.problem);
      return;
    }
    submit.mutate(check.input);
  };

  const outcome = submit.data;
  const wallet = draft.method === 'WALLET';

  return (
    <Screen title={tt('payout.declare')}>
      <Card>
        <Body muted>{tt('payout.method')}</Body>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.space[2] }}>
          {PAYOUT_METHODS.map((m) => (
            <Choice
              key={m}
              label={tt(`payout.method.${m}`)}
              describedBy={tt('payout.method')}
              selected={draft.method === m}
              onPress={() => set('method', m)}
            />
          ))}
        </View>

        {wallet ? (
          <Field label={tt('payout.phone')} value={draft.phone} onChangeText={(v) => set('phone', v)} />
        ) : (
          <>
            <Body muted>{tt('payout.bank')}</Body>
            {banks.isError ? <Note text={tt('payout.banksFailed')} /> : null}
            {banks.data === undefined && !banks.isError ? <Body muted>{tt('payout.banksLoading')}</Body> : null}
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.space[2] }}>
              {(banks.data ?? []).map((b) => (
                <Choice
                  key={b.code}
                  label={b.name}
                  describedBy={tt('payout.bank')}
                  selected={draft.bankCode === b.code}
                  onPress={() => set('bankCode', b.code)}
                />
              ))}
            </View>
            <Field
              label={draft.method === 'BANK_ACCOUNT' ? tt('payout.accountNo') : tt('payout.cardNo')}
              value={draft.accountNumber}
              onChangeText={(v) => set('accountNumber', v)}
            />
          </>
        )}
        <Field label={tt('payout.holderName')} value={draft.declaredName} onChangeText={(v) => set('declaredName', v)} />

        <Body muted>{tt('payout.noStore')}</Body>

        {problem !== null ? <Note text={tt(PROBLEM_KEY[problem])} /> : null}
        {outcome?.kind === 'offline' ? <Note text={tt('payout.offline')} /> : null}
        {outcome?.kind === 'refused' ? <Note text={tt('payout.refused')} /> : null}
        {submit.isError ? <Note text={tt('common.actionFailed')} /> : null}

        <Button
          label={submit.isPending ? tt('payout.submitting') : tt('payout.submit')}
          disabled={submit.isPending}
          onPress={onSubmit}
        />
      </Card>
    </Screen>
  );
}
