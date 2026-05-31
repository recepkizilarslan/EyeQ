# EyeQ

A browser-based, bilingual (TR / EN) **vision screening** app. A SPA built with Vite + Vue 3 (Composition API). Each test lives under its own route.

> ⚠️ **This is not a medical diagnostic tool.** Screen calibration, brightness and resolution all affect the results. If you have any concern or symptom, consult an eye doctor.

## Tests

| Route | Test | What it measures |
|-------|------|------------------|
| `/ishihara` | Color Blindness | Red–green color vision screening with Ishihara-style plates |
| `/snellen`  | Visual Acuity | Snellen-based letter test (scaled to the measured distance) |
| `/amsler`   | Amsler Grid | Macular / central vision distortion screening |
| `/contrast` | Contrast Sensitivity | Ability to read letters in faint gray tones |

Before it starts, each test sits behind a **webcam-based positioning** gate: the camera finds the face, estimates distance from the inter-pupillary distance (IPD), auto-starts the test once the correct distance/centering is reached, and pauses if you leave position during the test.

## Webcam distance measurement

- **MediaPipe FaceLandmarker** is used for eye landmarks; it is **lazy-loaded from a CDN only when the feature is enabled** (dynamic `import`), so the base bundle still contains only `vue` + `vue-router`.
- Distance is computed with a pinhole model as `distance = focal_px × IPD / IPD_px`. Because of two unknowns (the webcam's focal length and the person's IPD), the uncalibrated result is **approximate (~15–25%)**.
- **One-time calibration:** a capture is taken at a known distance and the focal ratio is written to `localStorage`. By the math, the personal IPD and focal length cancel out; after that, the measurement is very close to reality on that webcam. Head rotation and iris jitter are the main remaining error sources.
- All image processing happens in the browser; **video never leaves the device.** The camera requires `https` or `localhost` (a secure context).

## Architecture

```
src/
  main.js                 # entry point
  App.vue                 # layout + <RouterView> + transition animation
  router/index.js         # hash history router, route -> view mapping
  composables/
    useI18n.js            # reactive language state (synced to localStorage)
    useCalibration.js     # reactive px/mm screen calibration (synced to localStorage)
    useFaceTracker.js     # webcam + MediaPipe; distance from IPD + focal calibration
  data/
    messages.js           # TR/EN translation dictionary
    ishihara.js           # plate generation (pure functions, canvas drawing)
    snellen.js            # optotype + visual angle math
  components/
    AppHeader.vue, LangToggle.vue, ResultScreen.vue
    CameraPositioner.vue  # live camera UI: distance readout, eye boxes, calibration
    TestGate.vue          # positioning gate + pause veil + PiP (wraps the tests)
  views/
    HomeView, IshiharaView, SnellenView, AmslerView, ContrastView, NotFoundView
  styles/global.css       # design tokens (CSS variables)
```

**Design decisions**

- **Webcam positioning is mandatory:** every test runs behind the camera gate (`TestGate`), so there is no manual screen-distance setup on the home page. The camera is shown fullscreen while you position yourself, collapses to a small bottom-left picture-in-picture once you're in position, and returns to fullscreen if you leave position.
- **Calibration:** letter size for Snellen is computed from visual angle (5 arc-minutes). The px/mm screen scale uses a sensible default (`useCalibration.js`); the webcam supplies the viewing distance.
- **Hash history:** `createWebHashHistory` is used so static hosting (Cloudflare Pages) needs no server-side routing.
- **Eager route import:** the app is small, so a single bundle is faster than lazy chunks; it also avoids the async-component + `<Transition>` race condition.
- **Minimal dependencies:** the only runtime dependencies are `vue` and `vue-router`. MediaPipe is not part of the bundle — it is lazy-loaded from a CDN. Styling is plain scoped CSS.

## Development

```bash
npm install
npm run dev          # http://localhost:5173
npm run build        # produces dist/
npm run preview      # serve the build output locally
npm run lint         # ESLint (eslint-plugin-vue)
npm run format       # format with Prettier
```

## Code quality & CI

- **ESLint** (flat config, `eslint-plugin-vue`) + **Prettier** (`.prettierrc.json`).
- `.github/workflows/ci.yml`: runs `npm run lint` + `npm run build` on every PR and push to `main`.
- **Dependabot** (`.github/dependabot.yml`): scans npm and GitHub Actions dependencies weekly. `dependabot-auto-merge.yml` auto-merges minor/patch updates once CI passes (majors are manual). For this to work, **Settings → General → Allow auto-merge** must be enabled in the repo settings.

## Deploying to Cloudflare Pages

Because `vite.config.js` sets `base: './'` and the router uses hash history, the build runs on any static host with no server-side routing.

This repo includes `.github/workflows/deploy.yml`: on push to `main` it builds and publishes to Cloudflare Pages (project `eyeq`) via `wrangler pages deploy`. Set up once:

1. Create a Cloudflare API token (**My Profile → API Tokens**) with the **Cloudflare Pages: Edit** permission, and note your **Account ID** (Workers & Pages → Overview).
2. In the GitHub repo, add them as secrets (**Settings → Secrets and variables → Actions**): `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`.
3. Push to `main` — the first deploy auto-creates the `eyeq` Pages project and serves it at `https://eyeq.pages.dev`.

## License

MIT — see [LICENSE](LICENSE).

The Ishihara plates are procedurally generated **educational approximations**; they do not replace the clinically validated original plate set.
