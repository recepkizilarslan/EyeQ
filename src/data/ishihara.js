// Ishihara-style plate generation (procedural).
// NOTE: educational approximation, not a clinically validated plate set.

export const ISH_PLATES = [
  { num: '12', fig: ['#e8896b', '#e0a35a', '#d98c4f'], bg: ['#9caa6a', '#b5b46e', '#8ca05c'] },
  { num: '8',  fig: ['#d98c4f', '#e0a35a', '#cf7a44'], bg: ['#a3b06d', '#8ca05c', '#b5b46e'] },
  { num: '6',  fig: ['#cf7a44', '#e8896b', '#d98c4f'], bg: ['#9caa6a', '#aeb87a', '#869c58'] },
  { num: '29', fig: ['#e0a35a', '#d98c4f', '#e8896b'], bg: ['#8ca05c', '#9caa6a', '#b5b46e'] },
  { num: '5',  fig: ['#d98c4f', '#cf7a44', '#e0a35a'], bg: ['#aeb87a', '#869c58', '#9caa6a'] },
  { num: '3',  fig: ['#e8896b', '#d98c4f', '#cf7a44'], bg: ['#8ca05c', '#b5b46e', '#9caa6a'] },
]

export const ANSWER_POOL = ['3', '5', '6', '8', '12', '29', '15', '21', '42', '74']

const DIGIT = {
  '0': ['01110', '10001', '10011', '10101', '11001', '10001', '01110'],
  '1': ['00100', '01100', '00100', '00100', '00100', '00100', '01110'],
  '2': ['01110', '10001', '00001', '00110', '01000', '10000', '11111'],
  '3': ['11110', '00001', '00001', '01110', '00001', '00001', '11110'],
  '4': ['00010', '00110', '01010', '10010', '11111', '00010', '00010'],
  '5': ['11111', '10000', '11110', '00001', '00001', '10001', '01110'],
  '6': ['00110', '01000', '10000', '11110', '10001', '10001', '01110'],
  '7': ['11111', '00001', '00010', '00100', '01000', '01000', '01000'],
  '8': ['01110', '10001', '10001', '01110', '10001', '10001', '01110'],
  '9': ['01110', '10001', '10001', '01111', '00001', '00010', '01100'],
}

function digitMask(numStr, cols, rows) {
  const mask = Array.from({ length: rows }, () => new Array(cols).fill(false))
  const chars = numStr.split('')
  const dw = 5, dh = 7, gap = 1
  const totalW = chars.length * dw + (chars.length - 1) * gap
  const s = Math.max(1, Math.min(Math.floor(cols / (totalW + 4)), Math.floor(rows / (dh + 4))))
  const offX = Math.floor((cols - totalW * s) / 2)
  const offY = Math.floor((rows - dh * s) / 2)
  chars.forEach((ch, ci) => {
    const pat = DIGIT[ch]
    if (!pat) return
    const cOffX = offX + ci * (dw + gap) * s
    for (let y = 0; y < dh; y++) {
      for (let x = 0; x < dw; x++) {
        if (pat[y][x] === '1') {
          for (let yy = 0; yy < s; yy++) {
            for (let xx = 0; xx < s; xx++) {
              const gx = cOffX + x * s + xx
              const gy = offY + y * s + yy
              if (gy >= 0 && gy < rows && gx >= 0 && gx < cols) mask[gy][gx] = true
            }
          }
        }
      }
    }
  })
  return mask
}

export function drawPlate(canvas, plate, size = 280) {
  const dpr = window.devicePixelRatio || 1
  canvas.width = size * dpr
  canvas.height = size * dpr
  canvas.style.width = size + 'px'
  canvas.style.height = size + 'px'
  const ctx = canvas.getContext('2d')
  ctx.scale(dpr, dpr)
  ctx.fillStyle = '#f3ede0'
  ctx.fillRect(0, 0, size, size)

  const R = size / 2
  const cx = R, cy = R
  const cols = 42, rows = 42
  const mask = digitMask(plate.num, cols, rows)
  const dots = []

  for (let i = 0; i < 2600; i++) {
    const x = Math.random() * size
    const y = Math.random() * size
    const dx = x - cx, dy = y - cy
    if (Math.sqrt(dx * dx + dy * dy) > R - 6) continue
    const r = 3 + Math.random() * 5
    let ok = true
    for (const d of dots) {
      const a = d.x - x, b = d.y - y
      if (Math.sqrt(a * a + b * b) < (d.r + r) * 0.95) { ok = false; break }
    }
    if (!ok) continue
    const gx = Math.floor((x / size) * cols)
    const gy = Math.floor((y / size) * rows)
    const inFig = mask[gy] && mask[gy][gx]
    const pal = inFig ? plate.fig : plate.bg
    dots.push({ x, y, r, col: pal[Math.floor(Math.random() * pal.length)] })
  }

  for (const d of dots) {
    ctx.beginPath()
    ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2)
    ctx.fillStyle = d.col
    ctx.fill()
  }
}

// build N unique options including the correct answer, shuffled
export function buildOptions(correct, pool = ANSWER_POOL, n = 6) {
  const opts = new Set([correct])
  let guard = 0
  while (opts.size < n && guard++ < 200) {
    opts.add(pool[Math.floor(Math.random() * pool.length)])
  }
  return [...opts].sort(() => Math.random() - 0.5)
}
