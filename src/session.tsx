import { createContext, useContext } from 'react';
import type { Session } from './auth.ts';

/**
 * Who is signed in on this phone, and the two ways that changes.
 *
 * `App.tsx` owns the state and supplies both functions. `signIn` stores the
 * token in `expo-secure-store`; `signOut` deletes it AND clears the react-query
 * cache, which is where the money figures live. Those two must stay one action:
 * a shared phone is normal in this pilot, so the last collector's amounts must
 * not survive the next collector arriving.
 *
 * Against the mock (`EXPO_PUBLIC_API_URL` unset) `session` is always null and
 * neither function is ever called — there is nothing to sign in to.
 */
export interface SessionControl {
  session: Session | null;
  signIn: (session: Session) => Promise<void>;
  signOut: () => void;
}

const SessionContext = createContext<SessionControl>({
  session: null,
  signIn: async () => {},
  signOut: () => {},
});

export const SessionProvider = SessionContext.Provider;

export const useSession = (): SessionControl => useContext(SessionContext);
