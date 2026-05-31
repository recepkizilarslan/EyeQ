import { ref, computed, shallowRef } from 'vue'

// Webcam-based head-distance + centering tracker.
//
// Distance is estimated from the inter-pupillary distance (IPD): the pinhole
// model gives  distance = focalPx * IPD_real / IPD_px . focalPx is a webcam
// intrinsic we cannot know up front, so:
//   - if the user has run the one-time calibration we use the stored value;
//   - otherwise we fall back to an assumed field-of-view (rough, ~15-25% off).
// IPD_px comes from MediaPipe FaceLandmarker iris centers (landmarks 468/473).

const MP_VERSION = '0.10.18'
const MP_BUNDLE = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${MP_VERSION}/vision_bundle.mjs`
const MP_WASM = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${MP_VERSION}/wasm`
const MP_MODEL =
  'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task'

const LEFT_IRIS = 468
const RIGHT_IRIS = 473
const IPD_MM = 63 // average adult inter-pupillary distance
const DEFAULT_FOV_DEG = 60 // typical webcam horizontal FOV (fallback only)
const EMA_ALPHA = 0.35 // distance smoothing
const CENTER_TOL = 0.18 // normalized offset allowed from frame center

const CALIB_KEY = 'vc_cam_focal' // stored as focalPx / videoWidth (resolution independent)

function storedFocalRatio() {
  const v = parseFloat(localStorage.getItem(CALIB_KEY))
  return v && v > 0 ? v : null
}

function dist2d(a, b, w, h) {
  const dx = (a.x - b.x) * w
  const dy = (a.y - b.y) * h
  return Math.hypot(dx, dy)
}

export function useFaceTracker() {
  const status = ref('idle') // idle | loading | ready | error
  const errorKind = ref(null) // permission | nocamera | insecure | load
  const faceDetected = ref(false)
  const distanceCm = ref(null) // smoothed
  const offsetX = ref(0) // normalized (-0.5..0.5), 0 = centered
  const offsetY = ref(0)
  const eyes = ref(null) // { l: {x,y}, r: {x,y}, ipd } normalized, original (unmirrored) coords
  const focalRatio = ref(storedFocalRatio())

  const focalCalibrated = computed(() => focalRatio.value !== null)
  const centered = computed(
    () => Math.abs(offsetX.value) <= CENTER_TOL && Math.abs(offsetY.value) <= CENTER_TOL,
  )

  const landmarker = shallowRef(null)
  let stream = null
  let videoEl = null
  let rafId = null
  let useVFC = false
  let running = false
  let lastIpdPx = 0
  let emaCm = null

  async function loadModel() {
    if (landmarker.value) return
    const vision = await import(/* @vite-ignore */ MP_BUNDLE)
    const fileset = await vision.FilesetResolver.forVisionTasks(MP_WASM)
    landmarker.value = await vision.FaceLandmarker.createFromOptions(fileset, {
      baseOptions: { modelAssetPath: MP_MODEL, delegate: 'GPU' },
      runningMode: 'VIDEO',
      numFaces: 1,
      outputFaceBlendshapes: false,
      outputFacialTransformationMatrixes: false,
    })
  }

  function estimateDistance(ipdPx, videoWidth) {
    if (!ipdPx) return null
    const ratio = focalRatio.value
    const focalPx = ratio
      ? ratio * videoWidth
      : videoWidth / 2 / Math.tan((DEFAULT_FOV_DEG / 2) * (Math.PI / 180))
    return (focalPx * IPD_MM) / ipdPx / 10 // mm -> cm
  }

  function processResult(res, vw, vh) {
    const lm = res && res.faceLandmarks && res.faceLandmarks[0]
    if (!lm || !lm[RIGHT_IRIS]) {
      faceDetected.value = false
      eyes.value = null
      return
    }
    faceDetected.value = true
    const l = lm[LEFT_IRIS]
    const r = lm[RIGHT_IRIS]
    lastIpdPx = dist2d(l, r, vw, vh)

    const midX = (l.x + r.x) / 2
    const midY = (l.y + r.y) / 2
    offsetX.value = midX - 0.5
    offsetY.value = midY - 0.5

    const ipdNorm = Math.hypot(l.x - r.x, l.y - r.y)
    eyes.value = { l: { x: l.x, y: l.y }, r: { x: r.x, y: r.y }, ipd: ipdNorm }

    const cm = estimateDistance(lastIpdPx, vw)
    if (cm) {
      emaCm = emaCm == null ? cm : emaCm + EMA_ALPHA * (cm - emaCm)
      distanceCm.value = Math.round(emaCm)
    }
  }

  function tick(now) {
    if (!running || !videoEl || videoEl.readyState < 2) {
      if (running) schedule()
      return
    }
    const ts = now || performance.now()
    try {
      const res = landmarker.value.detectForVideo(videoEl, ts)
      processResult(res, videoEl.videoWidth, videoEl.videoHeight)
    } catch {
      /* transient frame errors are ignored */
    }
    if (running) schedule()
  }

  function schedule() {
    if (useVFC) rafId = videoEl.requestVideoFrameCallback((_, meta) => tick(meta.mediaTime * 1000))
    else rafId = requestAnimationFrame(tick)
  }

  async function start(targetVideoEl) {
    if (running) return
    videoEl = targetVideoEl
    status.value = 'loading'
    errorKind.value = null
    if (!navigator.mediaDevices || !window.isSecureContext) {
      // getUserMedia needs https or localhost
      if (!navigator.mediaDevices) {
        status.value = 'error'
        errorKind.value = 'insecure'
        return
      }
    }
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
        audio: false,
      })
    } catch (e) {
      status.value = 'error'
      errorKind.value = e && e.name === 'NotFoundError' ? 'nocamera' : 'permission'
      return
    }
    try {
      await loadModel()
    } catch {
      status.value = 'error'
      errorKind.value = 'load'
      stopStream()
      return
    }
    videoEl.srcObject = stream
    videoEl.muted = true
    videoEl.playsInline = true
    await videoEl.play().catch(() => {})
    useVFC = typeof videoEl.requestVideoFrameCallback === 'function'
    running = true
    status.value = 'ready'
    schedule()
  }

  function stopStream() {
    if (stream) {
      stream.getTracks().forEach((t) => t.stop())
      stream = null
    }
  }

  function stop() {
    running = false
    if (rafId != null && !useVFC) cancelAnimationFrame(rafId)
    rafId = null
    stopStream()
    if (videoEl) videoEl.srcObject = null
    faceDetected.value = false
    eyes.value = null
    distanceCm.value = null
    emaCm = null
    status.value = 'idle'
  }

  // One-time calibration: user is at a known real distance; pin focalPx from
  // the currently measured IPD in pixels. Returns true on success.
  function calibrateAt(knownCm) {
    if (!faceDetected.value || !lastIpdPx || !videoEl || !videoEl.videoWidth) return false
    const focalPx = (lastIpdPx * (knownCm * 10)) / IPD_MM
    const ratio = focalPx / videoEl.videoWidth
    focalRatio.value = ratio
    localStorage.setItem(CALIB_KEY, String(ratio))
    emaCm = null // reset smoothing so new scale takes effect immediately
    return true
  }

  function clearCalibration() {
    focalRatio.value = null
    localStorage.removeItem(CALIB_KEY)
    emaCm = null
  }

  return {
    status,
    errorKind,
    faceDetected,
    distanceCm,
    offsetX,
    offsetY,
    eyes,
    centered,
    focalCalibrated,
    CENTER_TOL,
    start,
    stop,
    calibrateAt,
    clearCalibration,
  }
}
