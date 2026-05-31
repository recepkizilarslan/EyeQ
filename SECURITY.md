# Security Policy

## Reporting a vulnerability

If you think you have found a security vulnerability, please **do not open a public issue.** Instead, use GitHub's private reporting flow:

1. Go to the repo's **Security** tab.
2. Create a private security advisory via **Report a vulnerability**.

We will review and acknowledge your report as soon as possible and coordinate a fix with you.

## Data & privacy

EyeQ includes a few privacy-relevant design decisions:

- **Webcam video never leaves the device.** All face/distance processing happens locally in the browser; no video frame or image is uploaded to any server.
- **There is no server side.** The app is a static SPA; there is no backend, account, or session.
- **`localStorage`** only holds a few numeric/settings values: screen calibration (px/mm), the webcam focal ratio, and the selected language. No personal data or imagery is stored.
- **No analytics/telemetry.** There is no usage tracking.

## Network dependency

When the webcam-based positioning feature is **enabled**, the MediaPipe FaceLandmarker model and wasm files are **dynamically** downloaded from a CDN (jsdelivr / Google storage). This request is not made unless the camera feature is used. The base app bundle contains only `vue` + `vue-router`.

## Scope & disclaimer

> ⚠️ EyeQ is **not a medical diagnostic tool.** Results are an educational/awareness pre-screening; they cannot be used for clinical decisions. If you have any concern or symptom, consult an eye doctor.

The security scope is limited to the application itself (client code, dependencies, build/deploy pipeline).
