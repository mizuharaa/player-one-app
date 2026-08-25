import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { StatusBar, useColorScheme } from 'react-native';
import { nativeTheme, type NativeTheme } from './design/native.ts';

/**
 * The one place the design tokens enter the app. Every colour, radius and
 * spacing in a screen comes from `useTheme()` — a literal in a .tsx file is a
 * rejected diff, same rule as the console.
 */
const ThemeContext = createContext<NativeTheme>(nativeTheme('light'));

export function ThemeProvider({ children }: { children: ReactNode }) {
  const scheme = useColorScheme();
  const theme = useMemo(() => nativeTheme(scheme === 'dark' ? 'dark' : 'light'), [scheme]);
  return (
    <ThemeContext.Provider value={theme}>
      {/*
        Android draws edge-to-edge from target SDK 35, so the status bar is
        transparent and the only thing left to choose is the icon colour.
        Without this the clock and the battery are white on the light theme's
        white header — invisible, and the first thing seen on opening the app.
        `backgroundColor` is deliberately not set: it is a no-op under
        edge-to-edge and warns.
      */}
      <StatusBar barStyle={scheme === 'dark' ? 'light-content' : 'dark-content'} />
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = (): NativeTheme => useContext(ThemeContext);
