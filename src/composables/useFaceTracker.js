import { ref, computed, shallowRef } from 'vue'
import { capabilities } from './capabilities.js'

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
const MP_GESTURE_MODEL =
  'https://storage.googleapis.com/mediapipe-models/gesture_recognizer/gesture_recognizer/float16/1/gesture_recognizer.task'
const GESTURE_MIN_SCORE = 0.5 // confidence threshold for thumb up/down

const LEFT_IRIS = 468
const RIGHT_IRIS = 473
const IPD_MM = 63 // average adult inter-pupillary distance
const DEFAULT_FOV_DEG = 60 // typical webcam horizontal FOV (fallback only)
const EMA_ALPHA = 0.35 // distance smoothing
const CENTER_TOL = 0.18 // normalized offset allowed from frame center
const EYE_CLOSED_BLINK = 0.5 // blendshape score above which an eye counts as closed/covered

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
  const gesture = ref(null) // 'thumb_up' | 'thumb_down' | null (raw, unfiltered)
  const hand = ref(null) // 'left' | 'right' | null — which hand answers (user's real hand)
  // Bounding boxes of every detected hand, normalized original (unmirrored)
  // coords: [{ xMin, yMin, xMax, yMax, hand }]. Used to draw hand frames and to
  // confirm a hand is physically over the eye that must be covered.
  const handBoxes = ref([])
  // Eyelid-blink blendshape scores (0..1). "Left"/"Right" follow the subject's
  // own anatomy (ARKit convention), matching the LEFT_IRIS/RIGHT_IRIS landmarks.
  // Covering an eye with the hand reads as closed because the open eye is hidden.
  const blinkL = ref(0)
  const blinkR = ref(0)
  const focalRatio = ref(storedFocalRatio())

  const focalCalibrated = computed(() => focalRatio.value !== null)
  const eyeClosedL = computed(() => blinkL.value >= EYE_CLOSED_BLINK)
  const eyeClosedR = computed(() => blinkR.value >= EYE_CLOSED_BLINK)
  const centered = computed(
    () => Math.abs(offsetX.value) <= CENTER_TOL && Math.abs(offsetY.value) <= CENTER_TOL,
  )

  const landmarker = shallowRef(null)
  const gestureRecognizer = shallowRef(null)
  let stream = null
  let videoEl = null
  let rafId = null
  let useVFC = false
  let running = false
  let lastIpdPx = 0
  let emaCm = null
  let visionMod = null // cached @mediapipe/tasks-vision module
  let fileset = null // cached wasm fileset (shared by both models)
  let gesturesOn = false

  async function loadVision() {
    if (!visionMod) visionMod = await import(/* @vite-ignore */ MP_BUNDLE)
    if (!fileset) fileset = await visionMod.FilesetResolver.forVisionTasks(MP_WASM)
    return visionMod
  }

  async function loadModel() {
    if (landmarker.value) return
    const vision = await loadVision()
    landmarker.value = await vision.FaceLandmarker.createFromOptions(fileset, {
      baseOptions: { modelAssetPath: MP_MODEL, delegate: 'GPU' },
      runningMode: 'VIDEO',
      numFaces: 1,
      outputFaceBlendshapes: true, // needed for eyeBlinkLeft/Right (eye-cover check)
      outputFacialTransformationMatrixes: false,
    })
  }

  // Lazy-load the hand gesture model (separate CDN download) the first time
  // an answer-by-gesture phase needs it.
  async function enableGestures() {
    if (!gestureRecognizer.value) {
      const vision = await loadVision()
      gestureRecognizer.value = await vision.GestureRecognizer.createFromOptions(fileset, {
        baseOptions: { modelAssetPath: MP_GESTURE_MODEL, delegate: 'GPU' },
        runningMode: 'VIDEO',
        numHands: 2, // one hand can cover the eye while the other answers 👍/👎
      })
    }
    gesturesOn = true
  }

  function disableGestures() {
    gesturesOn = false
    gesture.value = null
    hand.value = null
    handBoxes.value = []
  }

  // Translate MediaPipe handedness to the user's real hand. It labels assuming a
  // selfie-mirrored input; we feed the raw (unmirrored) frame, so swap.
  function realHand(handedArr) {
    const h = handedArr && handedArr[0]
    return h ? (h.categoryName === 'Right' ? 'left' : 'right') : null
  }

  function detectGesture(ts) {
    if (!gesturesOn || !gestureRecognizer.value) return
    try {
      const res = gestureRecognizer.value.recognizeForVideo(videoEl, ts)
      const lms = (res && res.landmarks) || []

      // Bounding box + handedness for every detected hand.
      const boxes = []
      for (let i = 0; i < lms.length; i++) {
        const pts = lms[i]
        if (!pts || !pts.length) continue
        let xMin = 1,
          yMin = 1,
          xMax = 0,
          yMax = 0
        for (const p of pts) {
          if (p.x < xMin) xMin = p.x
          if (p.x > xMax) xMax = p.x
          if (p.y < yMin) yMin = p.y
          if (p.y > yMax) yMax = p.y
        }
        boxes.push({ xMin, yMin, xMax, yMax, hand: realHand(res.handedness && res.handedness[i]) })
      }
      handBoxes.value = boxes

      // Answer = first hand showing a thumb up/down.
      const gs = (res && res.gestures) || []
      let g = null
      let gHand = null
      for (let i = 0; i < gs.length; i++) {
        const top = gs[i] && gs[i][0]
        if (
          top &&
          top.score >= GESTURE_MIN_SCORE &&
          (top.categoryName === 'Thumb_Up' || top.categoryName === 'Thumb_Down')
        ) {
          g = top.categoryName === 'Thumb_Up' ? 'thumb_up' : 'thumb_down'
          gHand = boxes[i] ? boxes[i].hand : null
          break
        }
      }
      gesture.value = g
      hand.value = g ? gHand : boxes[0] ? boxes[0].hand : null
    } catch {
      /* transient frame errors are ignored */
    }
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
      blinkL.value = 0 // no face -> can't confirm a covered eye
      blinkR.value = 0
      return
    }
    faceDetected.value = true

    const bs = res.faceBlendshapes && res.faceBlendshapes[0]
    if (bs && bs.categories) {
      for (const c of bs.categories) {
        if (c.categoryName === 'eyeBlinkLeft') blinkL.value = c.score
        else if (c.categoryName === 'eyeBlinkRight') blinkR.value = c.score
      }
    }
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
    detectGesture(ts)
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
    // Static capability check (secure context + getUserMedia API) lives in
    // capabilities.js; runtime permission / no-device errors are caught below.
    if (!capabilities.secureContext || !capabilities.camera) {
      status.value = 'error'
      errorKind.value = capabilities.secureContext ? 'nocamera' : 'insecure'
      return
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
    if (rafId != null) {
      if (useVFC && videoEl && typeof videoEl.cancelVideoFrameCallback === 'function') {
        videoEl.cancelVideoFrameCallback(rafId)
      } else if (!useVFC) {
        cancelAnimationFrame(rafId)
      }
    }
    rafId = null
    stopStream()
    if (videoEl) videoEl.srcObject = null
    faceDetected.value = false
    eyes.value = null
    distanceCm.value = null
    gesture.value = null
    hand.value = null
    handBoxes.value = []
    gesturesOn = false
    blinkL.value = 0
    blinkR.value = 0
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
    gesture,
    hand,
    handBoxes,
    eyeClosedL,
    eyeClosedR,
    centered,
    focalCalibrated,
    CENTER_TOL,
    start,
    stop,
    enableGestures,
    disableGestures,
    calibrateAt,
    clearCalibration,
  }
}
