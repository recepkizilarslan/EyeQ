import { ref } from 'vue'
import { useI18n } from './useI18n.js'

// Voice layer built on the browser Web Speech API — no bundle/CDN cost.
//   - speak(text): text-to-speech for spoken UI prompts (works almost everywhere)
//   - recognition: speech-to-text so the user can say the number/letter/yes-no
//     (best in Chrome/Edge; needs microphone permission)
// State is module-level so the whole app shares one mute setting and one
// recognizer (only one test runs at a time).

const { lang } = useI18n()

const SR = typeof window !== 'undefined' && (window.SpeechRecognition || window.webkitSpeechRecognition)
const recognitionSupported = !!SR
const ttsSupported = typeof window !== 'undefined' && 'speechSynthesis' in window

const MUTE_KEY = 'vc_tts_muted'
const muted = ref(localStorage.getItem(MUTE_KEY) === '1')

const listening = ref(false)
const lastHeard = ref('')

function langTag() {
  return lang.value === 'tr' ? 'tr-TR' : 'en-US'
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
  if (!text || muted.value || !ttsSupported) return
  try {
    window.speechSynthesis.cancel()
    const u = new SpeechSynthesisUtterance(String(text))
    u.lang = langTag()
    u.rate = 1
    window.speechSynthesis.speak(u)
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
    const AC = window.AudioContext || window.webkitAudioContext
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
  recog.onresult = (e) => {
    const r = e.results[e.results.length - 1]
    if (!r) return
    const alts = []
    for (let i = 0; i < r.length; i++) alts.push(r[i].transcript)
    lastHeard.value = alts[0] || ''
    if (resultCb) resultCb(alts)
  }
  // The recognizer stops itself periodically; restart while we still want it.
  recog.onend = () => {
    listening.value = false
    if (wantListen) {
      try {
        recog.start()
        listening.value = true
      } catch {
        /* already starting; ignore */
      }
    }
  }
  recog.onerror = () => {
    /* transient (no-speech, network); onend handles the restart */
  }
  return recog
}

function startListening(cb) {
  if (!recognitionSupported) return
  resultCb = cb
  wantListen = true
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
    muted,
    setMuted,
    toggleMute,
    speak,
    beep,
    listening,
    lastHeard,
    startListening,
    stopListening,
  }
}
