import { ref } from 'vue'
import { useI18n } from './useI18n.js'
import { capabilities } from './capabilities.js'

// Voice layer built on the browser Web Speech API — no bundle/CDN cost.
//   - speak(text): text-to-speech for spoken UI prompts (works almost everywhere)
//   - recognition: speech-to-text so the user can say the number/letter/yes-no
//     (best in Chrome/Edge; needs microphone permission)
// State is module-level so the whole app shares one mute setting and one
// recognizer (only one test runs at a time).

const { lang } = useI18n()

// Feature detection lives in capabilities.js — these just read from it.
const SR = capabilities.SpeechRecognition
const recognitionSupported = capabilities.stt
const ttsSupported = capabilities.tts

const MUTE_KEY = 'vc_tts_muted'
const muted = ref(localStorage.getItem(MUTE_KEY) === '1')

const listening = ref(false)
const lastHeard = ref('')
const recogError = ref('') // last SpeechRecognition error code ('' = none)
// True once the platform reports at least one installed TTS voice. Some
// devices support the API but ship no voices, so speak() stays silent — this
// lets the UI warn the user instead of leaving them wondering.
const ttsReady = ref(false)

function langTag() {
  return lang.value === 'tr' ? 'tr-TR' : 'en-US'
}

// Available TTS voices load asynchronously; cache them and refresh on change.
let voices = []
function loadVoices() {
  if (!ttsSupported) return
  voices = window.speechSynthesis.getVoices() || []
  ttsReady.value = voices.length > 0
}
if (ttsSupported) {
  loadVoices()
  // getVoices() is empty until this fires on most browsers (esp. Chrome).
  window.speechSynthesis.addEventListener('voiceschanged', loadVoices)
}
function pickVoice(tag) {
  if (!voices.length) loadVoices()
  const lower = tag.toLowerCase()
  const prefix = lower.split('-')[0]
  return (
    voices.find((v) => v.lang && v.lang.toLowerCase() === lower) ||
    voices.find((v) => v.lang && v.lang.toLowerCase().startsWith(prefix)) ||
    null
  )
}

// Some browsers (notably Chrome) refuse the very first speak() until the page
// has seen a user gesture. Fire a silent utterance on the first interaction so
// real prompts later are not swallowed.
let ttsUnlocked = false
function unlockTts() {
  if (ttsUnlocked || !ttsSupported) return
  ttsUnlocked = true
  try {
    window.speechSynthesis.resume()
    const u = new SpeechSynthesisUtterance(' ')
    u.volume = 0
    window.speechSynthesis.speak(u)
  } catch {
    /* ignore */
  }
}
if (typeof window !== 'undefined' && ttsSupported) {
  window.addEventListener('pointerdown', unlockTts, { once: true })
  window.addEventListener('keydown', unlockTts, { once: true })
  window.addEventListener('touchstart', unlockTts, { once: true })
}

function setMuted(v) {
  muted.value = !!v
  localStorage.setItem(MUTE_KEY, v ? '1' : '0')
  if (v && ttsSupported) window.speechSynthesis.cancel()
}
function toggleMute() {
  setMuted(!muted.value)
}

function speak(text) {
  // Silent-skip reasons are logged so "no voice" is diagnosable from the
  // console instead of being a mystery. Most common cause: muted is stuck on
  // (it persists in localStorage and gates TTS but NOT the microphone, so the
  // mic can keep working while every spoken prompt is swallowed).
  if (!text) return
  if (muted.value) {
    console.debug('[useSpeech] speak skipped — muted is ON (vc_tts_muted)')
    return
  }
  if (!ttsSupported) return
  try {
    const synth = window.speechSynthesis
    synth.cancel()
    synth.resume() // undo any stuck "paused" state
    const u = new SpeechSynthesisUtterance(String(text))
    const tag = langTag()
    const v = pickVoice(tag)
    if (v) u.voice = v // a concrete voice is more reliable than lang alone
    u.lang = tag
    u.rate = 1
    u.volume = 1
    // Chrome can silently drop a speak() issued in the same tick as cancel();
    // defer it a beat so the queue clears first.
    setTimeout(() => {
      try {
        synth.speak(u)
      } catch {
        /* ignore */
      }
    }, 60)
  } catch {
    /* speech synthesis can throw on some platforms; ignore */
  }
}

// Short confirmation tones (Web Audio) — a rising two-note "ok" or a single
// low "info" beep — to acknowledge that the distance / eye-cover is now set.
let audioCtx = null
function beep(kind = 'ok') {
  if (muted.value) return
  try {
    const AC = capabilities.AudioContext
    if (!AC) return
    audioCtx = audioCtx || new AC()
    const ctx = audioCtx
    if (ctx.state === 'suspended') ctx.resume()
    const now = ctx.currentTime
    const freqs = kind === 'ok' ? [660, 990] : [520]
    freqs.forEach((f, i) => {
      const o = ctx.createOscillator()
      const g = ctx.createGain()
      o.type = 'sine'
      o.frequency.value = f
      o.connect(g)
      g.connect(ctx.destination)
      const s = now + i * 0.13
      g.gain.setValueAtTime(0, s)
      g.gain.linearRampToValueAtTime(0.18, s + 0.02)
      g.gain.linearRampToValueAtTime(0, s + 0.12)
      o.start(s)
      o.stop(s + 0.13)
    })
  } catch {
    /* Web Audio can be unavailable/blocked; the spoken confirmation still plays */
  }
}

let recog = null
let resultCb = null
let wantListen = false

function ensureRecog() {
  if (recog || !recognitionSupported) return recog
  recog = new SR()
  recog.continuous = true
  // Interim results + more alternatives so short answers (a single letter or
  // number) register quickly instead of being dropped while we wait for a
  // "final" transcript.
  recog.interimResults = true
  recog.maxAlternatives = 6
  recog.onstart = () => {
    listening.value = true
    recogError.value = ''
  }
  recog.onresult = (e) => {
    recogError.value = ''
    // Gather every alternative across all results in this event (not just the
    // last entry) so a short answer isn't missed because it landed earlier.
    const alts = []
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const r = e.results[i]
      for (let j = 0; j < r.length; j++) alts.push(r[j].transcript)
    }
    if (!alts.length) return
    lastHeard.value = alts[0] || ''
    if (resultCb) resultCb(alts)
  }
  // The recognizer stops itself periodically (silence, ~60s cap); restart it
  // while we still want to listen. A small delay avoids the "already started"
  // throw when stop/start race.
  recog.onend = () => {
    listening.value = false
    if (wantListen) {
      setTimeout(() => {
        if (!wantListen) return
        try {
          recog.start()
          listening.value = true
        } catch {
          /* already starting; the next onend will retry */
        }
      }, 200)
    }
  }
  recog.onerror = (e) => {
    const err = (e && e.error) || 'unknown'
    recogError.value = err
    // Permission errors are fatal; everything else (no-speech, network,
    // aborted) is transient and onend restarts while wantListen is true.
    if (err === 'not-allowed' || err === 'service-not-allowed') {
      wantListen = false
      listening.value = false
    }
  }
  return recog
}

function startListening(cb) {
  if (!recognitionSupported) return
  resultCb = cb
  wantListen = true
  recogError.value = ''
  ensureRecog()
  recog.lang = langTag()
  try {
    recog.start()
    listening.value = true
  } catch {
    /* start() throws if already running; that's fine */
  }
}

function stopListening() {
  wantListen = false
  resultCb = null
  lastHeard.value = ''
  if (recog) {
    try {
      recog.stop()
    } catch {
      /* ignore */
    }
  }
  listening.value = false
}

export function useSpeech() {
  return {
    recognitionSupported,
    ttsSupported,
    ttsReady,
    muted,
    setMuted,
    toggleMute,
    speak,
    beep,
    listening,
    lastHeard,
    recogError,
    startListening,
    stopListening,
  }
}
