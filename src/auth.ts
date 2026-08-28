import * as SecureStore from 'expo-secure-store';

/**
 * The collector's token, and the only place it lives.
 *
 * `expo-secure-store` and not the JSON store in `src/api/persist.ts`: that file
 * is ordinary application state in the document directory, readable by anything
 * with the phone in its hand and by any backup that copies the directory.
 * SecureStore puts the value in the Android keystore-backed shared preferences
 * instead. Expo Go carries the module, so this needs no native build.
 *
 * The token is the whole identity. **The collector id appears in no path, no
 * query and no body** — every collector route is `/api/me/…` and the server
 * reads the id out of the token. So losing this value is signing out, and
 * clearing it is the only sign-out there is.
 *
 * A shared phone is normal in this pilot, which is why `clear()` takes the
 * money with it: see `src/api/cache.ts`.
 */
const TOKEN_KEY = 'playerone.collector.token';

/** The phone number the token was issued to, so the app can say who is signed in. */
const PHONE_KEY = 'playerone.collector.phone';

export interface Session {
  token: string;
  phone: string;
}

export async function readSession(): Promise<Session | null> {
  try {
    const token = await SecureStore.getItemAsync(TOKEN_KEY);
    const phone = await SecureStore.getItemAsync(PHONE_KEY);
    if (token === null || phone === null) return null;
    return { token, phone };
  } catch {
    // A keystore that will not open is indistinguishable from no session, and
    // the safe reading of "we cannot prove who this is" is nobody.
    return null;
  }
}

export async function writeSession(session: Session): Promise<void> {
  await SecureStore.setItemAsync(TOKEN_KEY, session.token);
  await SecureStore.setItemAsync(PHONE_KEY, session.phone);
}

export async function clearSession(): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(TOKEN_KEY);
    await SecureStore.deleteItemAsync(PHONE_KEY);
  } catch {
    // Nothing useful to tell a collector who is already being signed out.
  }
}
