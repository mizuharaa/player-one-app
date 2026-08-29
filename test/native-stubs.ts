import { Fragment, createElement, type ReactElement, type ReactNode } from 'react';

/**
 * The four native modules a screen drags in, small enough to render in node.
 *
 * vitest never loads a native module, which is why this repo had no screen-level
 * test at all: importing `src/App.tsx` reaches `react-native`, `expo-file-system`
 * and `expo-secure-store`, and none of the three parses outside Metro. Each one
 * below is replaced with the smallest thing that lets React build a tree.
 *
 * The components are plain strings, so `react-test-renderer` records them as
 * host elements and `toJSON()` is a searchable tree of the sentences a collector
 * would read. That is the assertion these tests make: the wiring the app ships
 * puts a particular sentence on a particular screen, or refuses to.
 *
 * ponytail: strings, not fakes of the real components. Nothing here asserts a
 * layout, a colour or a tap target — those are the design tokens' tests and a
 * device's job. Reach for a real renderer the day a test needs a measured one.
 */
export const reactNative = {
  View: 'View',
  Text: 'Text',
  Pressable: 'Pressable',
  ScrollView: 'ScrollView',
  TextInput: 'TextInput',
  Switch: 'Switch',
  ActivityIndicator: 'ActivityIndicator',
  StatusBar: 'StatusBar',
  useColorScheme: (): string => 'light',
  BackHandler: {
    addEventListener: () => ({ remove: () => {} }),
  },
  /**
   * `ListScreen` renders its rows through this, so a stub that dropped them
   * would make every list screen assert-proof. Header, rows, empty and footer,
   * in the order `FlatList` puts them.
   */
  FlatList: (props: {
    data?: unknown[];
    keyExtractor?: (item: unknown, index: number) => string;
    renderItem?: (info: { item: unknown; index: number }) => ReactNode;
    ListHeaderComponent?: ReactNode;
    ListFooterComponent?: ReactNode;
    ListEmptyComponent?: ReactNode;
  }): ReactElement => {
    const data = props.data ?? [];
    return createElement(
      'FlatList',
      null,
      props.ListHeaderComponent ?? null,
      ...data.map((item, index) =>
        createElement(
          Fragment,
          { key: props.keyExtractor?.(item, index) ?? String(index) },
          props.renderItem?.({ item, index }),
        ),
      ),
      data.length === 0 ? (props.ListEmptyComponent ?? null) : null,
      props.ListFooterComponent ?? null,
    );
  },
};

export const safeArea = {
  SafeAreaProvider: 'SafeAreaProvider',
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
};

/** No disk: every launch under test is a first launch. */
export const expoFileSystem = {
  Paths: { document: '/document' },
  File: class {
    readonly exists = false;
    create(): void {}
    write(): void {}
    async text(): Promise<string> {
      return '';
    }
  },
};

/** No keystore either, so `readSession()` answers "nobody" unless a test says otherwise. */
export const expoSecureStore = {
  getItemAsync: async (): Promise<string | null> => null,
  setItemAsync: async (): Promise<void> => {},
  deleteItemAsync: async (): Promise<void> => {},
};
