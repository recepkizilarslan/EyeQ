<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { useI18n } from '../composables/useI18n.js'
import { useSpeech } from '../composables/useSpeech.js'
import CameraPositioner from './CameraPositioner.vue'

// Single test engine: it owns camera positioning, the 👍/👎 yes-no answering
// (gesture + on-screen buttons), and the optional "cover one eye" verification.
// The test itself runs full-screen on a clean white field with the webcam as a
// small picture-in-picture in the bottom-left. Whenever a rule is broken — the
// user leaves position, or drops the hand that should cover an eye — the camera
// takes over the whole screen so they can fix it, then the test returns.
// Views only supply the stimulus (default slot) and turn features on via props.
const props = defineProps({
  targetCm: { type: Number, required: true },
  toleranceCm: { type: Number, default: 15 },
  holdMs: { type: Number, default: 1500 },
  graceMs: { type: Number, default: 1500 },
  question: { type: String, default: '' },
  yesLabel: { type: String, default: '' },
  noLabel: { type: String, default: '' },
  coverEye: { type: String, default: '' }, // '' | 'left' | 'right'
  voiceMode: { type: String, default: 'yesno' }, // 'yesno' | 'number' | 'letter'
  expected: { type: [String, Number], default: '' }, // the number/letter to match in speech
})
const emit = defineEmits(['locked', 'answer'])

const { t } = useI18n()
const {
  speak,
  beep,
  muted,
  toggleMute,
  ttsSupported,
  ttsReady,
  recognitionSupported,
  startListening,
  stopListening,
  listening,
  lastHeard,
  recogError,
} = useSpeech()

const phase = ref('positioning') // positioning | testing
const paused = ref(false) // position lost
const covered = ref(false) // camera-confirmed a hand is over the required eye

const coverViolation = computed(
  () => phase.value === 'testing' && !!props.coverEye && !covered.value,
)

// The camera fills the screen while positioning, after losing position, or while
// a required eye is uncovered. Otherwise it collapses to the corner PiP and the
// test takes the full white screen.
const fullscreen = computed(
  () => phase.value === 'positioning' || paused.value || coverViolation.value,
)

const yesText = computed(() => props.yesLabel || t('gSeen'))
const noText = computed(() => props.noLabel || t('gUnseen'))

// Answering is open only while testing, in position, and (if required) the
// correct eye is verified covered.
const answering = computed(
  () => phase.value === 'testing' && !paused.value && !coverViolation.value,
)

const coverInstr = computed(() =>
  props.coverEye === 'right' ? t('coverRight') : props.coverEye === 'left' ? t('coverLeft') : '',
)

function onLocked(distanceCm) {
  phase.value = 'testing'
  paused.value = false
  emit('locked', distanceCm)
  beep('ok') // distance is set — confirmation sound
}

function answer(seen) {
  if (!answering.value) return
  emit('answer', seen)
}

// Spoken positioning guidance: read the camera's instruction key aloud as it
// changes (move closer / back / center / hold still).
const GUIDE_MSG = {
  noface: 'camNoFace',
  center: 'camCenter',
  closer: 'camComeCloser',
  back: 'camMoveBack',
  hold: 'camHold',
}
function onGuide(key) {
  const k = GUIDE_MSG[key]
  if (k) speak(t(k))
}

// ── Voice ──────────────────────────────────────────────────────────────────
// The user speaks the answer: a number (Ishihara), a letter (Snellen/Contrast)
// or yes/no (Amsler). Recognition runs only while answering is open. For
// number/letter modes ANY recognized value is a valid answer and advances the
// test (correct if it equals the stimulus, wrong otherwise); only a wholly
// unintelligible utterance is ignored. TTS reads the prompt aloud on each new
// stimulus and announces position/cover issues.

const NEG = [
  'hayır', 'görmedim', 'göremiyorum', 'yok', 'okuyamıyorum', 'hiçbir şey', 'bir şey yok',
  'no', 'nope', 'cannot', "can't", 'cant', 'can not', 'nothing', 'none',
]
const POS = [
  'evet', 'gördüm', 'görüyorum', 'okuyabiliyorum', 'var',
  'yes', 'yeah', 'yep', 'i can', 'i see', 'seen', 'readable',
]
// Generous homophone lists per letter — Turkish letter names ("ce", "de", …)
// and English ones plus common mis-transcriptions — since single letters are
// the hardest thing for speech-to-text to get exactly right.
const LETTER_ALIAS = {
  C: ['c', 'ce', 'se', 'see', 'sea', 'si', 'cee'],
  D: ['d', 'de', 'dee', 'di'],
  E: ['e', 'ee', 'i', 'ie'],
  F: ['f', 'fe', 'ef', 'eff', 'efe'],
  L: ['l', 'le', 'el', 'ell'],
  O: ['o', 'oh', 'ow', 'zero'],
  P: ['p', 'pe', 'pee', 'pi'],
  T: ['t', 'te', 'tee', 'ti'],
  Z: ['z', 'ze', 'zet', 'zee', 'zed', 'zeta'],
  H: ['h', 'he', 'ha', 'haş', 'aitch', 'ache'],
  N: ['n', 'ne', 'en', 'an', 'na'],
  R: ['r', 're', 'ar', 'are', 'er'],
}
// Reverse lookup: any spoken token -> the letter it stands for. Lets us detect
// which letter the user said, even when it's the WRONG one.
const LETTER_FROM_TOKEN = {}
for (const [letter, aliases] of Object.entries(LETTER_ALIAS)) {
  for (const a of aliases) if (!(a in LETTER_FROM_TOKEN)) LETTER_FROM_TOKEN[a] = letter
}

function numWords(n, l) {
  const out = []
  if (l === 'tr') {
    const ones = ['sıfır', 'bir', 'iki', 'üç', 'dört', 'beş', 'altı', 'yedi', 'sekiz', 'dokuz']
    const tens = ['', 'on', 'yirmi', 'otuz', 'kırk', 'elli', 'altmış', 'yetmiş', 'seksen', 'doksan']
    if (n < 10) out.push(ones[n])
    else if (n < 100) out.push((tens[Math.floor(n / 10)] + (n % 10 ? ' ' + ones[n % 10] : '')).trim())
  } else {
    const ones = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine']
    const teens = ['ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen']
    const tens = ['', 'ten', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety']
    if (n < 10) out.push(ones[n])
    else if (n < 20) out.push(teens[n - 10])
    else if (n < 100) out.push((tens[Math.floor(n / 10)] + (n % 10 ? ' ' + ones[n % 10] : '')).trim())
  }
  return out.filter(Boolean)
}

function isNeg(norm) {
  return NEG.some((w) => norm.includes(w))
}

// Which number did the user say? Digits win; otherwise scan spelled-out forms
// (longest first so "yirmi dokuz" beats "yirmi"). Returns a string or null.
function spokenNumber(text) {
  const padded = ' ' + text.toLowerCase().replace(/\s+/g, ' ').trim() + ' '
  const dm = padded.match(/\d+/)
  if (dm) return dm[0]
  const entries = []
  for (let n = 0; n <= 99; n++) {
    for (const w of [...numWords(n, 'tr'), ...numWords(n, 'en')]) entries.push({ n: String(n), w })
  }
  entries.sort((a, b) => b.w.length - a.w.length)
  for (const e of entries) if (padded.includes(' ' + e.w + ' ')) return e.n
  return null
}

// Which letter did the user say? First recognized token wins. Returns the
// uppercase letter or null.
function spokenLetter(text) {
  const tokens = text.toLowerCase().split(/[\s,.;]+/).filter(Boolean)
  for (const tok of tokens) if (LETTER_FROM_TOKEN[tok]) return LETTER_FROM_TOKEN[tok]
  return null
}

function matchYesNo(text) {
  const norm = text.toLowerCase().trim()
  if (isNeg(norm)) return false
  if (POS.some((w) => norm.includes(w))) return true
  return undefined
}

// For number/letter modes: ANY recognized number/letter is a valid answer and
// advances the test — correct (true) if it equals the expected stimulus, wrong
// (false) otherwise. Only a totally unintelligible utterance is ignored
// (undefined → keep listening). A negative ("göremiyorum") is a wrong answer.
function matchNumber(text, expected) {
  const norm = text.toLowerCase().trim()
  if (isNeg(norm)) return false
  const said = spokenNumber(text)
  if (said == null) return undefined
  return said === String(expected)
}

function matchLetter(text, expected) {
  const norm = text.toLowerCase().trim()
  if (isNeg(norm)) return false
  const said = spokenLetter(text)
  if (said == null) return undefined
  return said === String(expected).toUpperCase()
}

function matchSpeech(text) {
  if (props.voiceMode === 'number') return matchNumber(text, props.expected)
  if (props.voiceMode === 'letter') return matchLetter(text, props.expected)
  return matchYesNo(text)
}

// Interim results fire many times for one spoken word; we de-duplicate by the
// matched transcript so the lingering repeats of the same utterance don't
// register twice — while a genuinely different word is accepted immediately, so
// fast answers are never dropped.
let lastVoiceAnswer = 0
let lastMatchText = ''
function resetVoiceDedup() {
  lastVoiceAnswer = 0
  lastMatchText = ''
}
function handleHeard(alts) {
  if (!answering.value) return
  let res
  let matchText = ''
  for (const a of alts) {
    const m = matchSpeech(a)
    if (m === true) {
      res = true
      matchText = a
      break
    }
    if (m === false && res === undefined) {
      res = false
      matchText = a
    }
  }
  if (res === undefined) return
  const norm = matchText.toLowerCase().trim()
  const now = performance.now()
  // Same word still being finalized → ignore. Different word → take it.
  if (norm && norm === lastMatchText && now - lastVoiceAnswer < 2000) return
  if (now - lastVoiceAnswer < 350) return // guard rapid interim flips
  lastVoiceAnswer = now
  lastMatchText = norm
  answer(res)
}

const promptText = computed(() => {
  if (props.voiceMode === 'number') return t('vSayNumber')
  if (props.voiceMode === 'letter') return t('vSayLetter')
  return props.question
})

function speakPrompt() {
  speak(promptText.value)
}

let listenStartTimer = null

watch(answering, (on) => {
  if (on) {
    resetVoiceDedup() // new window — accept the first answer immediately
    speakPrompt()
    // Delay STT start: wait for the TTS prompt to finish before listening,
    // otherwise the mic picks up the spoken prompt as an answer.
    if (recognitionSupported) {
      if (listenStartTimer) clearTimeout(listenStartTimer)
      listenStartTimer = setTimeout(() => {
        if (answering.value) startListening(handleHeard)
        listenStartTimer = null
      }, 600)
    }
  } else {
    if (listenStartTimer) {
      clearTimeout(listenStartTimer)
      listenStartTimer = null
    }
    if (recognitionSupported) stopListening()
  }
})
// Re-prompt aloud when the stimulus changes mid-test (next letter/plate).
// Also clear the dedup memory: the previous item's answer must not block an
// identical spoken answer on the new item (e.g. two plates both read "5").
watch(
  () => props.expected,
  () => {
    resetVoiceDedup()
    if (answering.value) {
      stopListening()
      speakPrompt()
      // Restart listening after the prompt finishes
      if (recognitionSupported) {
        if (listenStartTimer) clearTimeout(listenStartTimer)
        listenStartTimer = setTimeout(() => {
          if (answering.value) startListening(handleHeard)
          listenStartTimer = null
        }, 600)
      }
    }
  },
)
watch(coverViolation, (v) => {
  if (v) speak(coverInstr.value)
})
watch(paused, (v) => {
  if (v) speak(t('camLostText'))
})
// Confirmation sound the moment the required eye becomes covered.
watch(covered, (v, prev) => {
  if (v && !prev && props.coverEye) beep('ok')
})

// Human-readable voice status shown in the test field so a silent failure
// (denied mic, no network for the speech service) is visible, not a mystery.
const voiceStatus = computed(() => {
  if (!recognitionSupported) return ''
  const err = recogError.value
  if (err === 'not-allowed' || err === 'service-not-allowed') return t('vMicDenied')
  if (err === 'network') return t('vMicNetwork')
  if (listening.value) return t('vListening')
  return t('vMicStarting')
})

// Watchdog: while answering is open the recognizer must be listening. If it
// quietly stopped (and the error isn't a fatal permission denial), restart it.
let watchdog = null
watch(
  answering,
  (on) => {
    if (on && !watchdog) {
      watchdog = setInterval(() => {
        if (
          answering.value &&
          recognitionSupported &&
          !listening.value &&
          recogError.value !== 'not-allowed' &&
          recogError.value !== 'service-not-allowed'
        ) {
          startListening(handleHeard)
        }
      }, 1500)
    } else if (!on && watchdog) {
      clearInterval(watchdog)
      watchdog = null
    }
  },
)

// Spoken intro on entering positioning: announce the target distance.
function speakIntro() {
  speak(`${t('vSit')} ${props.targetCm} ${t('vCm')}.`)
}
onMounted(() => {
  if (phase.value === 'positioning') speakIntro()
})

onUnmounted(() => {
  stopListening()
  if (listenStartTimer) clearTimeout(listenStartTimer)
  if (watchdog) clearInterval(watchdog)
})
</script>

<template>
  <div class="gate">
    <!-- full-screen white test field; camera PiP floats over it -->
    <div v-if="phase === 'testing'" class="test-fs">
      <div v-if="ttsSupported || recognitionSupported" class="voice-bar">
        <button v-if="ttsSupported" class="voice-btn" type="button" @click="toggleMute">
          {{ muted ? '🔇' : '🔊' }} {{ muted ? t('vUnmute') : t('vMute') }}
        </button>
        <span
          v-if="recognitionSupported && answering"
          class="mic"
          :class="{ on: listening, err: !!recogError && recogError !== 'no-speech' }"
        >🎤 <span>{{ voiceStatus }}</span></span>
        <span v-if="recognitionSupported && lastHeard" class="heard">“{{ lastHeard }}”</span>
        <span v-if="ttsSupported && !ttsReady" class="tts-warn">⚠️ {{ t('vNoVoiceOutput') }}</span>
      </div>

      <div class="test-body">
        <slot />

        <div class="yn-question">{{ question }}</div>

        <!-- Voice-only answering. Buttons remain ONLY as a fallback where the
             browser has no speech recognition, so the test is never a dead end. -->
        <template v-if="recognitionSupported">
          <div class="yn-hint">🎤 {{ t('vHint') }}</div>
        </template>
        <template v-else>
          <div class="yn-row">
            <button class="btn btn-yes" :disabled="!answering" @click="answer(true)">
              👍 {{ yesText }}
            </button>
            <button class="btn btn-no" :disabled="!answering" @click="answer(false)">
              👎 {{ noText }}
            </button>
          </div>
          <div class="yn-hint no-voice">{{ t('vNoVoice') }}</div>
        </template>
      </div>
    </div>

    <div class="cam-layer" :class="fullscreen ? 'fs' : 'pip'">
      <div v-if="fullscreen" class="cam-head">
        <template v-if="paused">
          <b class="lost-title">{{ t('camLostTitle') }}</b>
          <span class="lost-text">{{ t('camLostText') }}</span>
        </template>
        <template v-else-if="coverViolation">
          <b class="lost-title">{{ coverInstr }}</b>
          <span class="lost-text">{{ t('coverWaiting') }}</span>
        </template>
        <template v-else>
          <div class="progress">{{ t('camGateTitle') }}</div>
          <div class="stage-instr"><slot name="intro" /></div>
        </template>
      </div>

      <CameraPositioner
        :fullscreen="fullscreen"
        :compact="!fullscreen"
        :cover-eye="phase === 'testing' && !paused ? coverEye : ''"
        :target-cm="targetCm"
        :tolerance-cm="toleranceCm"
        :hold-ms="holdMs"
        :grace-ms="graceMs"
        @locked="onLocked"
        @lost="paused = true"
        @regained="paused = false"
        @guide="onGuide"
        @cover="covered = $event"
      />
    </div>
  </div>
</template>

<style scoped>
.gate {
  position: relative;
}

/* full-screen white test field */
.test-fs {
  position: fixed;
  inset: 0;
  z-index: 60;
  background: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  overflow: auto;
}
.test-body {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  text-align: center;
  max-width: 760px;
  width: 100%;
}

/* voice controls float over the white test field, top-right */
.voice-bar {
  position: absolute;
  top: 16px;
  right: 16px;
  z-index: 2;
  display: flex;
  align-items: center;
  gap: 10px;
  font-family: var(--sans);
}
.voice-btn {
  border: 1px solid #d4dde6;
  background: #f4f7fa;
  color: #2a3b4d;
  border-radius: 999px;
  padding: 6px 14px;
  font-size: 0.85rem;
  font-weight: 600;
  cursor: pointer;
}
.voice-btn:hover {
  background: #e9eff5;
}
.mic {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 0.85rem;
  color: #8a98a6;
}
.mic.on {
  color: #1a8f4c;
}
.mic.err {
  color: #c0392b;
}
.mic.on::before {
  content: '';
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #1a8f4c;
  animation: mic-pulse 1.1s ease-in-out infinite;
}
@keyframes mic-pulse {
  0%,
  100% {
    opacity: 0.35;
  }
  50% {
    opacity: 1;
  }
}
.heard {
  font-size: 0.85rem;
  color: #5a6b7b;
  font-style: italic;
  max-width: 220px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.no-voice {
  color: #b06a00;
}
.tts-warn {
  font-size: 0.8rem;
  color: #b06a00;
  max-width: 240px;
}

.cam-layer.fs {
  position: fixed;
  inset: 0;
  z-index: 100;
  background: #0d141b;
  animation: fs-in 0.2s ease;
}
.cam-layer.pip {
  position: fixed;
  left: 16px;
  bottom: 16px;
  z-index: 70;
  animation: pip-in 0.28s ease;
}
@keyframes fs-in {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}
@keyframes pip-in {
  from {
    opacity: 0;
    transform: translateY(10px) scale(0.94);
  }
  to {
    opacity: 1;
    transform: none;
  }
}

.cam-head {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  z-index: 4;
  display: flex;
  flex-direction: column;
  gap: 8px;
  align-items: center;
  text-align: center;
  padding: 24px 20px 40px;
  font-family: var(--sans);
  background: linear-gradient(to bottom, rgba(0, 0, 0, 0.6), transparent);
  pointer-events: none;
}
.cam-head > * {
  max-width: 460px;
}
.progress {
  font-size: 0.8rem;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: #9ec3ec;
}
.stage-instr {
  font-size: 0.92rem;
  color: #e6eef6;
}
.lost-title {
  color: #ff8a8a;
  font-size: 1.15rem;
}
.lost-text {
  font-size: 0.9rem;
  color: #e6eef6;
}
</style>
