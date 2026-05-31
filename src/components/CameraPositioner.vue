<script setup>
import { ref, computed, onBeforeUnmount, watch } from 'vue'
import { useI18n } from '../composables/useI18n.js'
import { useFaceTracker } from '../composables/useFaceTracker.js'

const props = defineProps({
  targetCm: { type: Number, required: true },
  toleranceCm: { type: Number, default: 15 },
  holdMs: { type: Number, default: 1500 },
  graceMs: { type: Number, default: 1500 },
  compact: { type: Boolean, default: false },
})
const emit = defineEmits(['locked', 'lost', 'regained'])

const { t } = useI18n()
const tracker = useFaceTracker()
const {
  status,
  errorKind,
  faceDetected,
  distanceCm,
  eyes,
  centered,
  focalCalibrated,
} = tracker

const videoRef = ref(null)
const locked = ref(false)
const lost = ref(false)
const holdRemaining = ref(props.holdMs)

let timer = null
let holdStart = null
let outStart = null

const distOk = computed(
  () => distanceCm.value != null && Math.abs(distanceCm.value - props.targetCm) <= props.toleranceCm,
)
const inPosition = computed(() => faceDetected.value && centered.value && distOk.value)

const ringState = computed(() => {
  if (lost.value) return 'lost'
  if (inPosition.value) return 'ok'
  return 'seek'
})

const hint = computed(() => {
  if (!faceDetected.value) return t('camNoFace')
  if (!centered.value) return t('camCenter')
  if (distanceCm.value == null) return t('camCenter')
  if (distanceCm.value > props.targetCm + props.toleranceCm) return t('camComeCloser')
  if (distanceCm.value < props.targetCm - props.toleranceCm) return t('camMoveBack')
  if (!locked.value) return t('camHold')
  return t('camInPosition')
})

function evaluate() {
  const now = performance.now()
  const ip = inPosition.value
  if (!locked.value) {
    if (ip) {
      if (holdStart == null) holdStart = now
      holdRemaining.value = Math.max(0, props.holdMs - (now - holdStart))
      if (now - holdStart >= props.holdMs) {
        locked.value = true
        emit('locked', distanceCm.value)
      }
    } else {
      holdStart = null
      holdRemaining.value = props.holdMs
    }
  } else {
    if (!ip) {
      if (outStart == null) outStart = now
      if (!lost.value && now - outStart >= props.graceMs) {
        lost.value = true
        emit('lost')
      }
    } else {
      outStart = null
      if (lost.value) {
        lost.value = false
        emit('regained')
      }
    }
  }
}

async function begin() {
  await tracker.start(videoRef.value)
  if (status.value === 'ready' && !timer) {
    timer = setInterval(evaluate, 100)
  }
}

function retry() {
  tracker.stop()
  begin()
}

onBeforeUnmount(() => {
  if (timer) clearInterval(timer)
  tracker.stop()
})

watch(status, (s) => {
  if (s === 'error' && timer) {
    clearInterval(timer)
    timer = null
  }
})

// ---- one-time focal calibration sub-flow ----
const showCalib = ref(false)
const calibInput = ref('')
const calibMsg = ref('')

function doCalibrate() {
  const cm = parseFloat(calibInput.value)
  if (!cm || cm < 20 || cm > 300) {
    calibMsg.value = t('camCalibFail')
    return
  }
  const ok = tracker.calibrateAt(cm)
  calibMsg.value = ok ? t('camCalibSaved') : t('camCalibFail')
  if (ok) setTimeout(() => (showCalib.value = false), 900)
}

const countdownSec = computed(() => Math.ceil(holdRemaining.value / 1000))

// One box per eye. Coords are original (unmirrored); the video is shown
// mirrored, so displayed x is (1 - x) and the box with the larger displayed x
// sits on the screen's right = the user's right eye (mirror view).
const eyeBoxes = computed(() => {
  const e = eyes.value
  if (!e) return null
  const w = e.ipd * 0.95
  const h = e.ipd * 0.6
  const mk = (pt, label) => ({
    label,
    style: {
      left: (1 - pt.x) * 100 + '%',
      top: pt.y * 100 + '%',
      width: w * 100 + '%',
      height: h * 100 + '%',
    },
  })
  const lDisp = 1 - e.l.x
  const rDisp = 1 - e.r.x
  return [
    mk(e.l, lDisp >= rDisp ? t('eyeRight') : t('eyeLeft')),
    mk(e.r, rDisp > lDisp ? t('eyeRight') : t('eyeLeft')),
  ]
})
</script>

<template>
  <div class="cam" :class="{ compact }">
    <!-- video element stays mounted (v-show) so it exists when we attach the stream -->
    <div class="frame" :class="ringState" v-show="status === 'loading' || status === 'ready'">
      <video ref="videoRef" class="vid" playsinline muted></video>

      <div v-if="status === 'ready'" class="overlay">
        <div
          v-for="(box, i) in eyeBoxes"
          :key="i"
          class="eye-box"
          :class="distOk ? 'ok' : 'bad'"
          :style="box.style"
        >
          <span class="corner tl"></span>
          <span class="corner tr"></span>
          <span class="corner bl"></span>
          <span class="corner br"></span>
          <span class="eye-label">{{ box.label }}</span>
        </div>
        <div v-if="!locked && inPosition" class="count">{{ countdownSec }}</div>
      </div>

      <div v-if="status === 'loading'" class="veil">{{ t('camLoading') }}</div>
    </div>

    <!-- start gate -->
    <div v-if="status === 'idle'" class="panel">
      <button class="btn btn-primary" @click="begin">{{ t('camStart') }}</button>
      <p class="privacy">{{ t('camPrivacy') }}</p>
    </div>

    <!-- error -->
    <div v-else-if="status === 'error'" class="panel err">
      <p>
        {{
          errorKind === 'permission'
            ? t('camErrPermission')
            : errorKind === 'nocamera'
              ? t('camErrNocamera')
              : errorKind === 'insecure'
                ? t('camErrInsecure')
                : t('camErrLoad')
        }}
      </p>
      <button class="btn btn-ghost" @click="retry">{{ t('camRetry') }}</button>
    </div>

    <!-- live readout -->
    <div v-else-if="status === 'ready'" class="panel">
      <div class="readout">
        <span class="dist" :class="ringState">
          {{ distanceCm != null ? distanceCm : '–' }}<small> cm</small>
        </span>
        <span class="target">{{ t('camTarget') }}: {{ targetCm }} cm</span>
      </div>
      <div class="hint" :class="ringState">{{ hint }}</div>

      <div v-if="lost" class="lost-note">{{ t('camLostText') }}</div>

      <div class="calib-row">
        <span v-if="!focalCalibrated" class="uncal">{{ t('camUncalibrated') }}</span>
        <button class="link" @click="showCalib = !showCalib">
          {{ focalCalibrated ? t('camCalibReset') : t('camCalibrate') }}
        </button>
      </div>

      <div v-if="showCalib" class="calib-box">
        <p>{{ t('camCalibText') }}</p>
        <label>
          {{ t('camCalibField') }}
          <input v-model="calibInput" type="number" min="20" max="300" inputmode="numeric" />
        </label>
        <div class="calib-actions">
          <button class="btn btn-primary sm" @click="doCalibrate">{{ t('camCalibCapture') }}</button>
          <button class="btn btn-ghost sm" @click="showCalib = false">{{ t('camCalibCancel') }}</button>
          <button
            v-if="focalCalibrated"
            class="link"
            @click="tracker.clearCalibration(); calibMsg = ''"
          >
            {{ t('camCalibReset') }}
          </button>
        </div>
        <p v-if="calibMsg" class="calib-msg">{{ calibMsg }}</p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.cam { display: flex; flex-direction: column; align-items: center; gap: 12px; }
.frame {
  position: relative; width: 260px; aspect-ratio: 4 / 3;
  border-radius: 16px; overflow: hidden; border: 3px solid var(--line);
  background: #0d141b; transition: border-color .2s;
}
.cam.compact .frame { width: 150px; }
.frame.ok { border-color: var(--ok); }
.frame.seek { border-color: var(--warn-line); }
.frame.lost { border-color: var(--bad); }
.vid { width: 100%; height: 100%; object-fit: cover; transform: scaleX(-1); display: block; }
.overlay { position: absolute; inset: 0; pointer-events: none; }
.eye-box {
  position: absolute; transform: translate(-50%, -50%);
  border: 1.5px solid currentColor; border-radius: 6px;
  transition: left .08s linear, top .08s linear, width .12s linear, height .12s linear, color .2s;
}
.eye-box.ok { color: var(--ok); }
.eye-box.bad { color: var(--bad); }
.corner { position: absolute; width: 8px; height: 8px; border: 2px solid currentColor; }
.corner.tl { top: -2px; left: -2px; border-right: none; border-bottom: none; border-radius: 6px 0 0 0; }
.corner.tr { top: -2px; right: -2px; border-left: none; border-bottom: none; border-radius: 0 6px 0 0; }
.corner.bl { bottom: -2px; left: -2px; border-right: none; border-top: none; border-radius: 0 0 0 6px; }
.corner.br { bottom: -2px; right: -2px; border-left: none; border-top: none; border-radius: 0 0 6px 0; }
.eye-label {
  position: absolute; top: -16px; left: 50%; transform: translateX(-50%);
  font-family: var(--sans); font-size: .6rem; font-weight: 700; line-height: 1;
  color: #fff; padding: 2px 5px; border-radius: 4px; white-space: nowrap;
}
.eye-box.ok .eye-label { background: var(--ok); }
.eye-box.bad .eye-label { background: var(--bad); }
.count {
  position: absolute; inset: 0; display: flex; align-items: center; justify-content: center;
  font-family: var(--sans); font-size: 3rem; font-weight: 800; color: #fff;
  text-shadow: 0 2px 8px rgba(0,0,0,.6);
}
.veil {
  position: absolute; inset: 0; display: flex; align-items: center; justify-content: center;
  color: #cfe0f0; font-family: var(--sans); font-size: .82rem; text-align: center; padding: 12px;
}
.panel { width: 100%; max-width: 340px; text-align: center; font-family: var(--sans); }
.panel.err p { color: var(--bad); font-size: .88rem; margin-bottom: 10px; }
.privacy { font-size: .76rem; color: var(--ink-soft); margin-top: 8px; }
.readout { display: flex; align-items: baseline; justify-content: center; gap: 14px; }
.dist { font-size: 1.8rem; font-weight: 800; color: var(--ink-soft); }
.dist small { font-size: .9rem; font-weight: 600; }
.dist.ok { color: var(--ok); }
.dist.lost { color: var(--bad); }
.target { font-size: .82rem; color: var(--ink-soft); }
.hint { margin-top: 6px; font-size: .9rem; font-weight: 600; color: var(--warn-ink); }
.hint.ok { color: var(--ok); }
.hint.lost { color: var(--bad); }
.lost-note { margin-top: 6px; font-size: .82rem; color: var(--bad); }
.calib-row { margin-top: 10px; display: flex; gap: 8px; align-items: center; justify-content: center; flex-wrap: wrap; }
.uncal { font-size: .76rem; color: var(--warn-ink); }
.link { background: none; border: none; color: var(--accent); font-family: var(--sans); font-size: .78rem; font-weight: 600; cursor: pointer; text-decoration: underline; padding: 0; }
.calib-box {
  margin-top: 10px; padding: 12px; border: 1px solid var(--line); border-radius: 10px;
  background: var(--bg); text-align: left;
}
.calib-box p { font-size: .8rem; color: var(--ink-soft); margin-bottom: 8px; }
.calib-box label { font-size: .8rem; display: flex; flex-direction: column; gap: 4px; }
.calib-box input { padding: 8px 10px; border: 1px solid var(--line); border-radius: 8px; font-size: .9rem; max-width: 140px; }
.calib-actions { display: flex; gap: 8px; align-items: center; margin-top: 10px; flex-wrap: wrap; }
.btn.sm { padding: 8px 14px; font-size: .82rem; }
.calib-msg { margin-top: 8px; font-size: .8rem; color: var(--ok); }
</style>
