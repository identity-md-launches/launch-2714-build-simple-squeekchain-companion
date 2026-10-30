# Squeek Peek design system

## Overview

Squeek Peek is a read-only dashboard for people curious about Squeekchain. Its visual idea is a cozy field notebook for one tiny hamster: sage panels, warm cream paper, rounded type and a bespoke wheel illustration. Real ledger values come before the story.

The main action is Refresh. Navigation, data filters and source controls use quieter treatments. The first 390px-wide screen contains the product name, Refresh, all three key totals and the wheel panel. The expanded desktop view puts totals across the page and pairs the wheel with basic project information.

The source of truth is `src/styles.css`; layout and component markup are in `src/App.tsx`. The implemented theme is light. There is no dark theme.

## Colors

The CSS uses consistent sRGB hex values. Semantic variables are declared in `src/styles.css:1`.

| Token or source value | Value | Use |
| --- | --- | --- |
| `--color-page` | `#f8f9f5` | Page background |
| `--color-surface` | `#fffefa` | Header, totals, table, selected filter |
| `--color-text` | `#303b30` | Primary text |
| `--color-muted` | `#687063` | Supporting text and metadata |
| `--color-border` | `#e2e5dc` | Structural outlines and separators |
| `--color-accent` | `#3e5739` | Refresh fill, active navigation, focus ring |
| `--color-accent-hover` | `#2f442b` | Refresh hover |
| `--color-sage` | `#e8eedf` | Wheel panel and block icon background |
| `--color-lilac` | `#eee8f3` | Round icon background |
| `--color-butter` | `#f5edcf` | Work icon background |
| `--color-warning-text` / `--color-warning-bg` | `#80511c` / `#fff1d9` | Connection and settlement-pause notices |
| `.about-card` | `#f3eddd` | Project introduction surface |
| Hero secondary text | `#5e6d51` | Wheel captions and explanation |
| About body text | `#675f4d` | Introduction paragraphs |
| Progress fill / track | `#607c48` / `#cdd8c1` | Settled block progress |

Measured WCAG contrast: primary text on surface **11.60:1**, muted text on surface **5.09:1**, muted text on page **4.86:1**, hero secondary text **4.69:1**, introduction body **5.41:1**, and Refresh text/fill **7.92:1**. The final rendered probe also passed its contrast checks. Status always includes text or an icon; color alone does not communicate a state.

## Typography

The locally bundled font is **Nunito Sans Variable** (`@fontsource-variable/nunito-sans`), followed by Nunito Sans, system-ui and sans-serif. The font is loaded in `src/main.tsx`. The production export contains its WOFF2 subsets; no font CDN is needed. The contract address uses the native `ui-monospace` stack.

| CSS token | Size at default root | Role |
| --- | --- | --- |
| `--text-small` | 13px | Captions, table headings, source metadata |
| `--text-label` | 14px | Buttons, desktop table values, supporting copy |
| `--text-body` | 16px | Body default, progress heading |
| `--text-title` | 20px | Section headings, wordmark, phone totals |
| `--text-subdisplay` | 28px | Phone headline and progress, tablet totals |
| `--text-display` | 40px | Desktop headline, totals and progress |

Weights are 400 for regular text, 700 for labels and emphasis, and 800 for the wordmark and prominent headings/numbers. Body line-height is 1.55; headings are generally 1.2; multi-line supporting copy uses 1.4–1.5. Headings balance their wrapping and prose uses `text-wrap: pretty`.

Display tracking ranges from −0.025em to −0.045em; body copy uses normal tracking. Changing values use tabular numbers. The full contract address and large totals wrap rather than being clipped or abbreviated. There are no uppercase kicker labels.

## Layout

The shared page/header/footer maximum width is 1250px, including 36px inline padding on desktop. Main top padding is 42px. The layout uses 20px grid gaps, 24px between totals and the story, 37px before history, and 8–16px within component groups. These are implemented values, not a separate universal spacing API.

The desktop metrics grid has three equal columns. The story uses a 1.95:1 wheel/introduction split. The wheel illustration and progress occupy two columns within one flat panel. The table spans the full content width.

| Breakpoint | Implemented behavior |
| --- | --- |
| At or below 68rem (1088px) | Shorter header, wordmark subtitle hidden, tighter navigation, story ratio 1.7:1 |
| At or below 52rem (832px) | Navigation moves to its own row; story panels stack; padding becomes 24px; introduction temporarily uses a two-column internal layout |
| At or below 35rem (560px) | 20px page padding; vertical intro; compact totals; smaller wheel/progress; introduction returns to one column; table retains round/work/blocks columns; source controls wrap |

On phones, totals use `repeat(auto-fit, minmax(min(100%, 5.25rem), 1fr))`; the wheel contents use a corresponding 7rem minimum. At normal 320 and 390 widths, totals fit in three columns. At enlarged text sizes, the rem-based minimums reflow them into fewer columns. Navigation can wrap, and critical numeric values use `overflow-wrap: anywhere`.

Observed widths were 320, 390, 820 and 1440px. The final checks also exercised 200% root text sizing at 320px, RTL reflow, and reduced motion. Native browser zoom and mobile hardware remain unverified. On phones, the history table omits its time and redundant settlement-status columns; the latest certified round-end time remains visible near the summary when a backlog exists.

## Elevation & depth

The interface is flat. There are no shadows, gradient text, floating overlays or nested cards. White totals/table use thin structural outlines; the sage wheel and cream introduction use tonal separation. Borders inside panels separate related data rather than simulate elevation.

The header is not sticky, so it cannot cover anchored content. The skip link appears above the header when focused.

## Shapes

`--radius-card: 20px` defines the story and desktop metric panels. Phone metrics use 13px; the table uses 16px; buttons use 11px; filter buttons use 8px inside an 11px group. Progress and network labels are pill-shaped. The illustration’s soft circular wheel carries the main visual character.

Icons are inline SVGs from `src/icons.tsx`: one 1.7px rounded stroke style, `currentColor`, and `aria-hidden` for decoration. The original hamster illustration and favicon are local SVGs. The PNG share image is generated from that illustration and the site’s font.

## Components

- **`Metric`**, `src/App.tsx:16`: label, exact bigint value, supporting explanation and a colored decorative icon. Undefined data shows a named placeholder. Phone labels reserve equal vertical space to align values.
- **`.button.primary`**, `src/styles.css`: the single filled Refresh action. During a read it keeps its place, says “Refreshing…” and disables repeat activation. Secondary source controls use outlined, neutral styling.
- **`.segmented`**, `src/App.tsx`: a named group of native buttons with `aria-pressed`, switching all certified rounds and rounds with work. This is a button group, not a tabs widget.
- **`.wheel-card` / `.block-progress`**: one tonal illustration/progress panel. The progress value comes only from contract block units. Loading renders an empty, static track with a waiting description. The illustration does not animate or imply live physical movement.
- **History table**, `src/App.tsx:106`: native header scopes, a caption, newest-first rows, UTC round-end times on larger screens, and a six-row preview that expands to the 12-row read window. Quiet and initial-empty states explain what is known and offer a way back from the filter.
- **`.notice`**: a stable polite status region for connection errors and settlement pause. Failed refreshes label retained readings explicitly; initial failure leaves placeholders.
- **Source controls**, `src/App.tsx:127`: pause/resume, external explorer link, complete selectable address, copy confirmation, provider details and a native `details` disclosure.
- **`ExternalLink`**: a real anchor with an external icon and a screen-reader new-tab suffix. Navigation uses real same-page anchors.

Native controls provide Enter/Space behavior and natural tab order. Focus uses a visible 2px accent outline with 4px offset. Decorative icons do not enter the tab order. Motion is limited to 150ms background/press feedback inside `prefers-reduced-motion: no-preference`; reduced motion also disables smooth scrolling. There is no autoplay.

## Do’s and don’ts

- Start a new section with the shared shell, existing type tokens, and the same alignment edges.
- Keep the totals and Refresh before explanatory material on phones.
- Reuse the neutral secondary button for utility actions; preserve Refresh’s visual priority.
- Keep RPC freshness, certified settlement and physical hamster activity distinct in copy.
- Preserve exact values. Do not add random animation, fabricated history, shortened critical data or estimated block counts.
- Add another informational section using the existing heading/body scale and a simple tonal or outlined surface. Recheck 320px, 390px, enlarged text and the pinned design probe before exporting.

The design/review method is adapted from Better Interface (Jakub Krehel, MIT), with documentation guidance from Impeccable (Paul Bakaus, Apache-2.0). The supplied notices are retained in `licenses/Better-Interface.txt`.
