# Contributing Guide

Thanks for your interest in contributing to EyeQ. This document outlines the development workflow and project conventions.

> ⚠️ EyeQ is **not a medical diagnostic tool**. No added feature should claim a clinical diagnosis; results must always be presented as an "educational/awareness pre-screening."

## Development environment

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # production build
npm run preview    # serve the build output locally
```

Webcam-based tests require a **secure context** (https or `localhost`) for camera access; since `npm run dev` serves over localhost, it works while developing locally.

## Code quality

Before opening a PR, make sure both pass (CI runs these too):

```bash
npm run lint       # ESLint (eslint-plugin-vue)
npm run build      # must complete without errors
```

Prettier is used for formatting:

```bash
npm run format        # auto-format
npm run format:check  # check only
```

## Conventions

- **Vue 3 Composition API**, with `<script setup>`. Component styles are `scoped`.
- **Keep dependencies minimal.** The only runtime dependencies are `vue` + `vue-router`. If a heavy library is needed (e.g. MediaPipe), do not add it to the bundle — instead **lazy-load it via a dynamic `import` from a CDN, only when the relevant feature is enabled** (see `src/composables/useFaceTracker.js`).
- **i18n:** every user-facing string goes into `src/data/messages.js` with both a `tr` and an `en` entry. Do not hard-code text in components.
- **Design tokens:** use the CSS variables in `src/styles/global.css` for color/spacing values.

## Adding a new test

1. Create a view under `src/views/` and add a route in `src/router/index.js`.
2. Wrap the test content in `TestGate` (webcam positioning gate + pause); pass an appropriate `target-cm` value.
3. Add the instruction and result strings to `messages.js` (tr + en).
4. Add it to the test card on the home page (`HomeView.vue`).

## Commit & PR

- Small, focused PRs are preferred.
- In the PR description, state **what** changed and **why**.
- CI (lint + build) must be green.

## License

By contributing, you agree that your contributions are released under the [MIT license](LICENSE).
