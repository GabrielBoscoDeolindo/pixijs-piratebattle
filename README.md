# Pirate Battle

Pirate Battle is a small top-down naval shooter built for the React + PixiJS
game developer challenge. React owns the screens and HUD; PixiJS renders and
updates the arena. The game runs entirely in the browser, including the mocked
ranking and match-history API.

**Live demo:** [pixijs-piratebattle.vercel.app](https://pixijs-piratebattle.vercel.app/)

## Running locally

Requirements: Node.js 20 or newer and npm. There are no environment variables
or private services.

```bash
npm ci
npm run dev
```

Vite prints the local URL in the terminal. The first page load registers the
MSW service worker, so ranking and history work in development and in the
production build.

## Commands

```bash
npm run dev              # development server with HMR
npm run typecheck        # strict TypeScript check
npm run lint             # ESLint
npm run build            # type-check and build dist/
npm run preview          # serve the production build locally
npm run test:e2e         # desktop and mobile Chromium suites
npm run test:e2e:ui      # Playwright UI mode
npm run test:e2e:update  # replace visual baselines intentionally
npm run test:e2e:report  # open the last HTML report
```

Install Chromium once before the first E2E run:

```bash
npx playwright install chromium
```

## Controls

| Action | Keyboard | Touch |
| --- | --- | --- |
| Sail forward | `W` or `Arrow Up` | Auto-sail toggle |
| Turn | `A` / `D` or arrow keys | Left/right buttons |
| Front cannon | `Space` | Front-fire button |
| Left broadside | `Q` | Left-fire button |
| Right broadside | `E` | Right-fire button |
| Pause | `Escape` or pause button | Pause button |

Keyboard and touch states are combined, so movement, rotation and firing can
happen at the same time. On mobile, tapping auto-sail keeps the ship moving;
the player only needs to hold a turn direction while using the other hand for
weapons. Mobile is designed primarily for landscape. Portrait still works and
shows an orientation hint.

## What is implemented

- frame-rate-independent movement, rotation, cooldowns and spawning;
- front cannon and three-projectile broadsides;
- Chaser and Shooter enemies with island avoidance;
- polygon island collision for ships and projectiles;
- timed matches, death ending, pause, focus-loss pause and clean restart;
- health bars, score, timer, FPS, p95 frame time and entity count;
- touch controls and short-landscape layouts;
- sound effects, ambience, damage feedback, explosions and screen shake;
- persistent options and last completed result;
- paginated ranking and history through Axios, TanStack Query and MSW;
- recoverable and idempotent pending match submission;
- deterministic Playwright coverage on desktop and mobile Chromium.

## Gameplay configuration

The Options screen exposes:

- session duration: 60–180 seconds;
- enemy spawn interval: 2–15 seconds;
- sound enabled and volume.

Options are stored in `localStorage`. A match receives a configuration snapshot
when it starts, so changing settings cannot alter a match already in progress.
The rest of the balance values live in `src/game/config.ts`: health, damage,
movement, weapon cooldowns, projectile lifetime, Shooter range, spawn weights,
spawn points and island geometry.

## Mock API

MSW handles these browser-local endpoints:

```text
GET  /api/ranking
GET  /api/matches
POST /api/matches
```

Confirmed matches and pending submissions are persisted locally. `POST` is
idempotent by `matchId`, which lets the client retry a timeout without creating
duplicates. Ranking entries are compared only against matches played with the
same duration and spawn interval.

Available scenarios:

```text
success, empty, slow, variableLatency, outOfOrder, offline, timeout,
rankingError, historyError, http400, http500,
submitTimeoutAfterCommit, submitUnavailable
```

Select a scenario from DevTools and reload the relevant screen:

```js
localStorage.setItem('pirate-battle:mock-scenario:v1', 'offline');
sessionStorage.clear();
location.reload();
```

Restore the normal behavior with:

```js
localStorage.removeItem('pirate-battle:mock-scenario:v1');
sessionStorage.clear();
location.reload();
```

To reset every local fixture, option and saved result, clear the site's storage
in DevTools and reload.

## Tests and reports

The E2E suite covers gameplay, lifecycle, options, asset-loading failure,
ranking/history states, retries, idempotency, touch input and visual regression.
It uses a deterministic clock and seeded spawning while still running the real
simulation, collision and rendering code.

The HTML report is versioned at `playwright-report/index.html`. Failure traces,
screenshots and videos are written to the ignored `test-results/` directory.
Visual baselines live next to `tests/e2e/visual.spec.ts`.

## Assets

Only assets loaded by the game are included in the final repository:

```text
assets/
├── audio/   # ambience, combat and UI sounds
├── game/    # ships, water, islands, projectiles and effects
├── ui/      # menu, HUD and touch controls
└── mockServiceWorker.js
```

The artwork and audio are a selected subset of the files supplied with the
challenge. I did not add external art, audio or fonts.

## Production build and deployment

```bash
npm run build
npm run preview
```

The deployable output is `dist/`. On Netlify, use `npm run build` as the build
command and `dist` as the publish directory. The public deployment must not use
visitor-password or team-login protection. After publishing, verify the game in
an anonymous window and refresh both the home page and the data screens.

The implementation notes, trade-offs, performance procedure and development
journal are in [ARCHITECTURE.md](ARCHITECTURE.md).
