import { AGREEMENTS, type CollectorProfile } from './api/types.ts';
import type { Route } from './nav.tsx';

/**
 * Where a restored collector picks up: the first onboarding step they had not
 * finished. `src/App.tsx` opens the stack on it.
 *
 * Not simply `home`. `Register` overwrites the profile with an empty one, so
 * always opening there would destroy the state persistence just restored — but
 * always opening on `home` strands anyone killed mid-onboarding, because `home`
 * links to the task hall and the training and not to the agreements, and their
 * claim would then be refused by a gate they had no button to satisfy.
 *
 * The four checks are `mustBeEligible`'s ladder in the same order, and yes they
 * are stated twice. The mock's copy is the gate and this one is the signpost;
 * they answer different questions and only one of them is enforcement. Each
 * onboarding screen already pushes the next, so naming the step is the whole
 * job.
 *
 * It lives in its own file so it can be tested: `App.tsx` reaches React Native
 * through thirteen screens, and vitest loads none of them. The `Route` import is
 * type-only and erased, so nothing here pulls in `nav.tsx` at runtime.
 */
export function resume(me: CollectorProfile | null): Route {
  if (me === null) return { name: 'register' };
  const accepted = AGREEMENTS.every((a) =>
    me.agreements.some((x) => x.agreementId === a.id && x.version === a.version),
  );
  if (!accepted) return { name: 'agreements' };
  if (!me.trainingDone) return { name: 'training' };
  if (!me.examPassed) return { name: 'exam' };
  return { name: 'home' };
}
