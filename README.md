# player-one-app

The **collector-facing mobile app** for Player One — VNG PT Lab's ego-camera
data-collection platform. React Native 0.82, Vietnamese-first.

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

Initial code arrives from the platform repo's `feat/collector-app` branch (built
2026-08-25); device transport is a mock behind an interface until the PaXini
file-offload protocol and an ARM test device exist.
