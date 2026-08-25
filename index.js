// Expo Go / Metro entry. `registerRootComponent` is `AppRegistry.registerComponent`
// plus the name Expo's own runtime expects, so the app root does not have to know
// which of the two started it. `expo prebuild` generates a native project that
// loads this same file.
import { registerRootComponent } from 'expo';
import { App } from './src/App.tsx';

registerRootComponent(App);
