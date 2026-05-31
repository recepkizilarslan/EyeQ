// Snellen visual acuity logic.
// Letter size is derived from visual angle so it scales with screen calibration.

export const SN_LETTERS = ['C', 'D', 'E', 'F', 'L', 'O', 'P', 'T', 'Z', 'H', 'N', 'R']

export const SN_LINES = [
  { denom: 60, snellen: '6/60', us: '20/200' },
  { denom: 36, snellen: '6/36', us: '20/120' },
  { denom: 24, snellen: '6/24', us: '20/80' },
  { denom: 18, snellen: '6/18', us: '20/60' },
  { denom: 12, snellen: '6/12', us: '20/40' },
  { denom: 9,  snellen: '6/9',  us: '20/30' },
  { denom: 6,  snellen: '6/6',  us: '20/20' },
]

export const SN_DIST_M = 1.5 // recommended viewing distance for this screen test

// A 6/denom optotype subtends (5 * denom/6) arc-minutes total at the test distance.
// height(mm) = 2 * D * tan(angle/2)  ->  px = height(mm) * pxPerMM
export function letterHeightPx(denom, pxPerMM, distM = SN_DIST_M) {
  const arcmin = 5 * (denom / 6)
  const rad = (arcmin / 60) * (Math.PI / 180)
  const heightMM = 2 * (distM * 1000) * Math.tan(rad / 2)
  return heightMM * pxPerMM
}

export function randomLetter() {
  return SN_LETTERS[Math.floor(Math.random() * SN_LETTERS.length)]
}

export function buildLetterOptions(correct, n = 6) {
  const opts = new Set([correct])
  let guard = 0
  while (opts.size < n && guard++ < 200) {
    opts.add(randomLetter())
  }
  return [...opts].sort(() => Math.random() - 0.5)
}
