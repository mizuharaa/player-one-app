# player-one-app

The **collector-facing mobile app** for Player One — VNG PT Lab's ego-camera
data-collection platform. React Native 0.86 on Expo SDK 57, Vietnamese-first.

## What lives here vs. [player-one](https://github.com/mizuharaa/player-one)

| This repo (the app) | player-one (the platform/pipeline) |
|---|---|
| Registration + the six agreements | Ingest engine (reads TF cards, measures footage) |
| Training and exam gate | Episode store (Postgres, schema-enforced invariants) |
| Task hall, claiming, my tasks | Session resolver (footage → owner, audit-trailed) |
| Ego device binding + BLE provisioning | Review lane (footage → verdict → money) |
| Collection session creation (APP-16/17b) | Settlement, bills, back-office console |
| Upload states, manual upload confirmation | Cloud upload to GreenNode vStorage (Path C) |
| Income view (estimated vs confirmed) | Operator/reviewer auth, audit trail |

The split follows PRODUCT.md in the platform repo: the app ships to collectors'
phones on its own release cadence; the platform runs on VNG infrastructure.
The app talks to the platform only through its public API.

Hard rule inherited from the Engineering Brief: **the app never starts or stops
recording** — the Ego device records standalone; the app binds, declares, and uploads.

The code arrived from the platform repo's `feat/collector-app` branch (commit
`fd6b98e`, 2026-08-25) and now lives at the root of this repo. Device transport
is a mock behind an interface until the PaXini file-offload protocol and an ARM
test device exist. The design tokens are vendored copies, not a dependency —
`src/design/` says why and how to re-copy them.

---

## Run it on your phone

Expo Go. No Android Studio, no cable, no build. Put the phone and the laptop on
the **same Wi-Fi**, install Expo Go from the Play Store or the App Store, then:

```sh
git clone https://github.com/mizuharaa/player-one-app
cd player-one-app
npm install
npx expo start
```

Scan the QR code the terminal prints — with Expo Go's own scanner on Android,
with the Camera app on iOS. The app opens on the registration screen and every
screen is reachable from there, running against the in-memory mock. `r` in the
terminal reloads the phone, `j` opens the debugger, `Ctrl-C` stops the server.

Nothing here needs a native module that Expo Go does not already carry: the
device is mocked, so BLE and file transfer are not involved. The runtime
dependencies outside React itself are `react-native-safe-area-context` and
`expo-file-system` — the first is bundled into Expo Go, the second ships inside
the SDK Expo Go is built against, so neither needs a native build.

If the phone will not connect — guest Wi-Fi with client isolation, a VPN on
either end, or a Windows firewall prompt that got dismissed — `npx expo start
--tunnel` relays through Expo's servers instead. Slower, and both ends must be
online.

### Talk to the real server

```sh
EXPO_PUBLIC_API_URL=http://192.168.1.10:8080 npx expo start
```

The laptop's LAN address, not `localhost` — `localhost` on the phone is the
phone. The platform API listens on `PORT`, default 8080. Expo inlines
`EXPO_PUBLIC_*` into the bundle when Metro starts, so this is chosen by
restarting the dev server and by nothing inside the app: a toggle on a collector's
phone would let them point it at a machine that is not the platform.

With it set the app opens on a sign-in screen — phone number, then the six-digit
code the server sends. The token is a 30-day one and lives in
`expo-secure-store`, never in the JSON state file. A 401 wipes it, wipes every
cached money figure with it, and returns to sign-in; a shared phone is normal in
this pilot, so the sign-out button on the home screen does the same thing on
purpose.

**Which screens change:** Income and Uploads read the server. Everything else is
still the mock — see "Onboarding is still local" under the ceilings. Unset the
variable and the app is exactly what it was.

### The version delta, on purpose

PRODUCT.md in the platform repo says **React Native 0.82**. This repo pins
**React Native 0.86.2, React 19.2.3, Expo SDK 57**.

The reason is Expo Go itself: the copy on the store is a native binary compiled
against exactly one SDK, and it loads only the React Native that SDK ships with.
Pinning 0.82 would mean no preview at all. `npx expo install --check` is the
check that the three versions above are that pair.

This costs nothing later. `expo prebuild` reads the versions out of
`package.json` at the moment it runs, so the native build can move to whatever
PRODUCT.md settles on then; the delta lives in one file and is visible in one
command.

---

## The app itself

The Android app collectors use: register, accept the six agreements, train,
pass the exam, claim a task, bind and provision an Ego camera, declare a
session, confirm an upload, watch the income line. React Native 0.86,
TypeScript strict, Vietnamese first (LOC-01 is P0; English rides along at P2).

> Paths in code comments that start `packages/`, `docs/`, or name `PRODUCT.md`
> point at the **platform** repo, [mizuharaa/player-one](https://github.com/mizuharaa/player-one),
> not at anything here. The files were copied across unedited so the two can be
> diffed; the alternative was rewriting every comment and losing that.

### What this is, exactly

**A UI scaffold with two mocked seams. It runs on a phone through Expo Go;
it is not yet a native build.**

Read that literally before quoting progress from it:

| | State |
|---|---|
| Screens | All thirteen exist and are reachable; the route registry is `Record<RouteName, ComponentType>`, so a missing screen is a compile error. |
| Server | **Two builds, one environment variable.** Unset `EXPO_PUBLIC_API_URL` (the default) is `MockCollectorApi`, in memory, one process, no network. Set it and the app signs in for real and reads income and episode states from the platform API; everything else still comes from the mock, because the server has no route for it. See "Talk to the real server" below. |
| Device | `MockDeviceTransport` / `MockDeviceTransfer` — no BLE, no Wi-Fi, no file transfer. See `DEVICE_DEPS.md`. |
| Persistence | **One JSON file** in the document directory, written synchronously inside every mutation (`src/api/persist.ts`). Registration, agreements, the exam result, claims, bound devices, sessions and the upload queue survive a kill (NFR-03, NFR-04). Not a sync engine and not SQLite — see the ceilings below. |
| Native project | **None checked in.** `android/` is `expo prebuild` output and is gitignored; prebuild has never been run here. Metro and Babel use Expo's defaults, so there is no config file for either. |
| Launchable | **In Expo Go, yes** — `npm install && npx expo start`, scan the QR. See "Run it on your phone" above. **As an installable APK, not yet:** that needs `expo prebuild` plus the EgoLowBle TurboModule (`DEVICE_DEPS.md`). |

The typechecker and the unit tests also run here. Those cover the mock's gates
(APP-02, APP-05, APP-10, APP-15, APP-25), the BLE call order, the message
catalogue, the agreement-id contract with the server, restart survival
(NFR-03/04) and the pre-collection reminder's wording (PRV-02). Vitest never
loads React Native or Expo — the tests import `src/api/`, `src/device/` and
`src/resume.ts`, none of which reach a native module, which is why they stay
fast and need no native runtime. The one exception reads `SessionCreate.tsx` as
text to check where the reminder sits, because the requirement is positional and
there is still no renderer here.

```sh
npm install
npm run typecheck
npm test
```

### The Android floor

**minSdkVersion 28 — Android 9+.** PRODUCT.md fixes it, and `app.json` now
records it where prebuild will read it: the `expo-build-properties` plugin
writes `minSdkVersion: 28` into the generated `build.gradle`. That is still a
declaration, not a proof — it becomes real the first time prebuild runs and the
gradle file is read back. Expo Go ignores it (its own floor is whatever the
store build has), so nothing about the preview verifies the number.

### Rules this app must not break

Three of them are hard, and each is pinned by a test rather than a convention:

1. **The app never starts or stops recording.** There is no such method on
   `DeviceTransport`, and `test/device.test.ts` scans both device seams for the
   verbs. Recording is the camera's own affair.
2. **No code path deletes device media.** Rule 6's non-deviable half — no TF
   card is cleared, ever. Same test, same scan.
3. **The client never sends a duration or an amount, and never computes one.**
   Effective minutes and money arrive from the server as strings, already
   rounded by the single rounding site in the platform. No input type here
   carries either.

A fourth is structural: **uploads start only from an explicit tap.**
`confirmUpload` is the only transition out of `pending_upload` — no effect, no
timer, no network-state listener (APP-25, PRV-03: the collector decides what
leaves their phone).

### Layout

```
src/api/       CollectorApi (the typed seam) + the mock that fills it today,
               and persist.ts, the file the mock is restored from
src/device/    DeviceTransport (BLE provisioning) + DeviceTransfer (Path A)
src/screens/   one file per screen
src/ui.tsx     Screen, ListScreen, Card, CardLink, Choice, Button, Field, Tag, Note
src/nav.tsx    the typed stack, and Android's hardware Back
src/resume.ts  which screen a restored collector opens on
src/theme.tsx  the only door design tokens come through
src/design/    the tokens themselves, vendored from the platform repo
src/i18n.ts    every user-facing string, Vietnamese-based
test/          the mock's gates, the device seams, the catalogue, the contract,
               restart survival, and the pre-collection reminder
```

### Known ceilings

Every one of these is marked `ponytail:` at the place it bites:

- State persists to a file, not to a database (`src/api/persist.ts`). The whole
  store is rewritten on every tap, which is right for one collector's profile
  and five episodes and wrong the day the Kotlin foreground service is a second
  writer — that is when `expo-sqlite` earns its schema. There is still no
  background upload worker, so an episode that comes back `uploading` after a
  restart is telling the truth: no byte has moved.
- Hand-rolled navigation stack (`src/nav.tsx`). `@react-navigation` needs
  `react-native-screens`, which Expo Go does bundle, so the swap is no longer
  blocked — it is simply not done. The `Route` union and the
  `Record<RouteName, ComponentType>` registry survive it unchanged.
- QR device binding is a fixed serial; VisionCamera needs a native build
  (`src/screens/Devices.tsx`).
- Training and exam content is a shell. PaXini owes it.
- **Onboarding is still local, in both builds.** Registration, the six
  agreements, training, the exam, the task hall, claiming, device binding and
  session creation have no server route on any branch, so they still run against
  the mock even when the app is signed in. A signed-in collector is therefore
  asked to register, which reads oddly and is honest: the token proves who they
  are, and nothing on the server yet knows what they have agreed to. Each of
  those is one delegating line in `src/api/http.ts`, to be deleted as its route
  lands.
- Sign-in exists and is real (`src/screens/SignIn.tsx`, `src/auth.ts`), but only
  in the server build. The mock build has no sign-in screen and no token, and a
  returning collector still resumes at the first onboarding step they had not
  finished (`src/resume.ts`) because their file is still on the phone.
- Agreements show a title and a version, not a document. There is no body,
  effective date, or server-supplied current version, so the revision path
  cannot be exercised — consent here is a mechanism, not yet informed consent
  (`src/screens/Agreements.tsx`).
- Verdict status pills fail WCAG AA for normal text on the light theme —
  measured 3.06:1 (pass), 3.81:1 (partial), 3.43:1 (reject), and 3.80/4.28:1
  for partial and reject on dark. The values are `verdict.*.fg` in
  `packages/design`, shared with the back-office console, so the fix belongs
  in the token set for all three surfaces rather than forked here. The primary
  button was the same failure (white on `sun[500]`, 2.61:1) and *was* fixable
  in this app without forking, so it was: it now measures 7.19:1.
- One-column phone layout only. No tablet or foldable adaptation — none is
  specified, and the pilot is phones.
- Insets now come from `react-native-safe-area-context`, so the status bar,
  the gesture bar, the cutout and the landscape sides are all cleared
  (`src/ui.tsx`). Still unhandled: the keyboard inset, and predictive back,
  which wants platform navigation (`src/nav.tsx`).
- Expo Go is a preview, not the product. It cannot host the EgoLowBle
  TurboModule, a foreground upload service, or anything else in
  `DEVICE_DEPS.md`; those appear only in a prebuilt native app. What the phone
  shows is the UI and the mock, at real size, with real touch.
- The six agreement identifiers are pinned by a literal on each side of a
  repository boundary. A rename in this app fails a test here; a rename in the
  platform's `collector_agreements_name_check` cannot be seen from this repo at
  all. A published contract artifact or a cross-repo CI check is owed. Nothing
  can be written against the constraint today in any case — `collector_agreements`
  exists only in an unpushed working branch of the platform repo.
- No test renders a screen or drives navigation, so labels, focus and error
  announcements are asserted by reading the code, not the accessibility tree.
  That needs a React Native test renderer this project does not have.
