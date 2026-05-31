import { ref, computed } from 'vue'

const STORAGE_KEY = 'vc_calib'
const CARD_WIDTH_MM = 85.6 // ISO/IEC 7810 ID-1 card width
const DEFAULT_PX = 320
const MIN_PX = 120
const MAX_PX = 600

function initialPx() {
  const v = parseFloat(localStorage.getItem(STORAGE_KEY))
  return v && v >= MIN_PX && v <= MAX_PX ? v : DEFAULT_PX
}

// module-level singletons -> shared across pages
const calibPx = ref(initialPx())
const calibrated = ref(localStorage.getItem(STORAGE_KEY) !== null)

const pxPerMM = computed(() => calibPx.value / CARD_WIDTH_MM)

function setCalibPx(px) {
  const v = Math.min(MAX_PX, Math.max(MIN_PX, Number(px)))
  calibPx.value = v
  calibrated.value = true
  localStorage.setItem(STORAGE_KEY, String(v))
}

export function useCalibration() {
  return {
    calibPx,
    calibrated,
    pxPerMM,
    setCalibPx,
    CARD_WIDTH_MM,
    MIN_PX,
    MAX_PX,
  }
}
