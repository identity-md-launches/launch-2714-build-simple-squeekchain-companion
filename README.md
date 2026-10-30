# Squeek Peek

A small, independent Squeekchain companion on Ethereum Sepolia. The dashboard reads SqueekCore directly and gives Squeektoshi a cozy little corner of the internet.

## Run and rebuild

Use Node.js 22.12 or later and npm. From the repository root:

```sh
npm ci
npm run dev
```

To check and produce the static site:

```sh
npm run typecheck
npm test
npm run build
npm run preview
```

Open the local URL printed by Vite. The complete production website is `dist/index.html` plus the other files in `dist/`. Vite uses `base: './'`; navigation uses page anchors. The export also works under a gateway subpath, without rewrite rules. Serve it over HTTP(S), rather than opening the HTML as a local file.

The IdentityMD publishing plane publishes the submitted export after review and supplies its public address. The export is ready for that handoff; publication and the final URL are outside this build step.

## What it does

- Reads completed Squeek blocks, certified rounds, cumulative work, settlement pause status, and next-block progress.
- Refreshes every 30 seconds while the page is visible. Refresh also works manually; automatic updates can be paused and resumed.
- Shows the latest 12 certified rounds, including certified rounds with zero work. Filter for rounds with work or expand the six-row preview.
- Links to the published contract and project documentation, explains Squeekchain, and copies the complete SqueekCore address.
- Distinguishes a fresh RPC read from recent settlement. A settlement backlog is shown near the totals, with the last certified round’s scheduled end time.
- Uses placeholders during the first read. Failed subsequent reads retain explicitly labeled previous totals. Reloading clears that in-memory snapshot.

The hamster is an original SVG illustration, not a live camera or activity indicator. No wallet connection, signing, transactions, credentials, or backend are needed.

## Data and provenance

The published Sepolia proxy is `0x74665dAecA35A2303e767E76a2FF1FB6F93e119f`, chain ID `11155111`.

The app pins the [published deployment record](https://docs.squeekchain.com/assets/deployments/sepolia.json) in `src/deployment.json` and the [official SqueekCore ABI](https://docs.squeekchain.com/assets/abi/SqueekCore.json) in `src/core-abi.json`. Integration semantics come from the [SqueekCore reference](https://docs.squeekchain.com/developers/core/) and [official quickstart](https://docs.squeekchain.com/developers/quickstart/). Basic project information comes from the [project docs](https://docs.squeekchain.com/) and [Squeektoshi page](https://docs.squeekchain.com/system/squeektoshi/).

`src/core.ts` reads the following public Sepolia providers, listed in the [chain registry](https://chainid.network/chains.json), in order:

1. `https://ethereum-sepolia-rpc.publicnode.com`
2. `https://sepolia.gateway.tenderly.co`

Each refresh checks the chain and pins every contract read to one mined Ethereum block. It validates SqueekCore V3’s implementation address, runtime bytecode hash and storage-layout digest against the published record, checks round configuration and height/progress invariants, and verifies the history endpoint against the state totals. A changed contract identity stops the read and asks the visitor to consult the official docs. Updating to a new deployment requires reviewing the published record and ABI and rebuilding.

Totals remain `bigint`; they are not rounded through JavaScript floating-point numbers. One Squeek block is one billion block units. Completed blocks per round are calculated from the difference between cumulative completed-block counts, preserving fractional carry. The app does not divide all-time work by current difficulty. Missing checkpoints inside a fully certified span are zero-work rounds; uncertified rounds remain unknown.

These are mined reads, not finality guarantees. Reorganizations, public-provider availability and future contract upgrades can affect readings. The dashboard shows ledger state, not the hamster’s current physical activity. Round-end times are scheduled UTC times, not transaction settlement times.

## Validation performed

The final source passed:

| Check | Actual result |
| --- | --- |
| `npm run typecheck` | Passed |
| `npm test` | 19 tests passed |
| `npm run build` | Production export generated successfully |
| Chromium browser validation | 18 checks passed |
| Pinned `taste@1` probe | 16 of 16 checks passed |
| Axe WCAG A/AA checks, 390 and 1440 widths | No violations or outstanding incomplete checks |
| Live Sepolia reads | Both configured public providers returned matching Squeek height 13,095 and 12 history rows |

The browser checks exercise the production export at a nested gateway path, using deterministic RPC responses for loading, errors, retry, fallback, changed identity, paused settlement, zero totals and maximum uint64 values. They also check navigation, clipboard, filter clearing, expansion, auto-refresh timers, 320/390/820/1440 layouts, 200% text sizing, RTL reflow, reduced motion, fonts and share assets. Real live reads were checked separately; test fixtures are never imported into the application.

Live observation on 2026-10-30 at 09:52 UTC, Ethereum block `12025899`: height **13,095**, certified round **1,973**, cumulative work **148,986**, progress **60.4%**, and current round **2,511**. The certified frontier had not advanced recently; the page accurately shows this backlog instead of claiming live hamster movement.

The browser validation can be rerun with an externally installed Playwright module:

```sh
npm run build
npm run test:browser -- /absolute/path/to/playwright/index.mjs
npm run check:live
```

Use the browser installation’s normal configuration. Browser test output and screenshots go only to disposable `test/scratch/browser/`. The pinned probe’s invocation and the full six-domain review are recorded in [artifacts/validation.md](artifacts/validation.md).

Safari/WebKit could not be run because that browser executable was unavailable. Manual screen-reader speech, a native browser zoom control, and mobile hardware were not tested. Chromium reflow and 200% text sizing were tested. Automated checks are worker reports, not independent certification.

## Source and design

- `src/App.tsx`: dashboard, round history and explanatory content.
- `src/core.ts`: read-only RPC, identity checks and exact ledger arithmetic.
- `src/useDashboard.ts`: polling, cancellation and retained-data states.
- `src/styles.css`: tokens, components and responsive layouts.
- `src/assets/hamster-wheel.svg` and `public/favicon.svg`: original vector artwork.
- [DESIGN.md](DESIGN.md): final implemented design system and responsive behavior.

`public/og-image.png` is the real 1200 × 630 share image, copied into `dist/` by the build. To regenerate it after changing the artwork, build once, then run `node scripts/generate-share.mjs /absolute/path/to/playwright/index.mjs`, then build again. It uses the site’s bundled font and illustration.

## Submission budget and attribution

The submission limit is 8,388,608 bytes. [artifacts/bundle-budget.json](artifacts/bundle-budget.json) records the measured source/export total. The explicit ignore-path budget in `.gitignore` is limited to dependency directories (`**/node_modules/`), Vite caches (`**/.vite/`), and disposable checks (`test/scratch/`). Their contribution to the submitted bundle is zero bytes. Source, lockfile, complete `dist/`, local fonts, licenses and required images remain included. No dependency archive or registry mirror is shipped.

Design review follows Jakub Krehel’s [Better Interface](https://github.com/jakubkrehel/skills/tree/267330e1adfc66a718fb65fa6918c1f06d0a689e/skills/better-interface) (MIT), with documentation guidance adapted from Paul Bakaus’s [Impeccable](https://github.com/pbakaus/impeccable/blob/9d715cc4f5564a990ca8345abfdd5df6dc9b41c8/skill/reference/document.md) (Apache-2.0). Their supplied notices and licenses are retained in `licenses/Better-Interface.txt`. Runtime library and Nunito Sans font licenses are in `public/licenses/` and the production export.
