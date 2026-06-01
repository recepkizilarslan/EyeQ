// Single source of truth for browser / device capability detection.
//
// Every test in EyeQ leans on the same stack: a camera (MediaPipe face tracking
// over getUserMedia), speech recognition (the user answers hands-free by voice)
// and speech synthesis (spoken prompts) — all in a secure context, with WebGL2
// and WebAssembly for the MediaPipe models. Detection used to be scattered
// across useSpeech and useFaceTracker; it now lives here ONLY, so the rules and
// the "this browser isn't supported" decision are defined in exactly one place.

function detectWebGL2() {
  if (typeof document === 'undefined') return false
  try {
    return !!document.createElement('canvas').getContext('webgl2')
  } catch {
    return false
  }
}

// Best-effort browser name — used only for the rejection message, never for the
// support decision itself (that comes from real feature detection below, which
// already catches e.g. Firefox/Brave lacking speech recognition).
function detectBrowser(ua) {
  if (/Edg\//.test(ua)) return 'edge'
  if (/OPR\//.test(ua) || /Opera/.test(ua)) return 'opera'
  if (/SamsungBrowser/.test(ua)) return 'samsung'
  if (/Firefox\//.test(ua) || /FxiOS/.test(ua)) return 'firefox'
  if (/CriOS/.test(ua) || /Chrome\//.test(ua)) return 'chrome'
  if (/Safari\//.test(ua) && /Version\//.test(ua)) return 'safari'
  return 'other'
}

class Capabilities {
  constructor() {
    const w = typeof window !== 'undefined' ? window : {}
    const nav = typeof navigator !== 'undefined' ? navigator : {}
    const ua = nav.userAgent || ''

    // Constructors are exposed too, so callers build on these instead of
    // re-sniffing window.* themselves.
    this.SpeechRecognition = w.SpeechRecognition || w.webkitSpeechRecognition || null
    this.AudioContext = w.AudioContext || w.webkitAudioContext || null

    this.secureContext = !!w.isSecureContext
    this.camera = !!(nav.mediaDevices && nav.mediaDevices.getUserMedia)
    this.stt = !!this.SpeechRecognition
    this.tts = typeof w.speechSynthesis !== 'undefined'
    this.webgl2 = detectWebGL2()
    this.wasm = typeof WebAssembly === 'object'

    this.browser = detectBrowser(ua)
    this.mobile = /Mobi|Android|iPhone|iPad|iPod/i.test(ua)
  }

  // Hard requirements for running any test, in display order. Tests are fully
  // hands-free, so speech IN and OUT are both mandatory — there is no button
  // fallback. `graphics` = WebGL2 + WASM, both needed by the MediaPipe models.
  get requirements() {
    return [
      { key: 'secure', ok: this.secureContext },
      { key: 'camera', ok: this.camera },
      { key: 'mic', ok: this.stt },
      { key: 'voice', ok: this.tts },
      { key: 'graphics', ok: this.webgl2 && this.wasm },
    ]
  }

  // i18n keys of the requirements that are NOT met (empty array => good to go).
  get missing() {
    return this.requirements.filter((r) => !r.ok).map((r) => r.key)
  }

  get supported() {
    return this.missing.length === 0
  }
}

// One shared instance: capabilities are fixed for the page's lifetime.
export const capabilities = new Capabilities()

export function useCapabilities() {
  return capabilities
}
