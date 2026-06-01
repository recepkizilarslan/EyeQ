<script setup>
import { ref, reactive, computed, nextTick } from 'vue'
import { useI18n } from '../composables/useI18n.js'
import ResultScreen from '../components/ResultScreen.vue'
import TestGate from '../components/TestGate.vue'

const { t } = useI18n()

const TARGET_CM = 35 // Amsler is a near test (30-40 cm)

const EYES = ['right', 'left'] // eye being tested (covering the other one)
const eyeIdx = ref(0)
const testEye = computed(() => EYES[eyeIdx.value])
const coverEye = computed(() => (testEye.value === 'right' ? 'left' : 'right'))

const finished = ref(false)
const boxEl = ref(null)
const size = ref(Math.min(360, Math.floor(window.innerWidth * 0.8)))
// distortion reported per eye (null = not tested yet)
const results = reactive({ right: null, left: null })

async function drawGrid() {
  await nextTick()
  const box = boxEl.value
  if (!box) return
  const old = box.querySelector('canvas')
  if (old) old.remove()
  const s = size.value
  const c = document.createElement('canvas')
  const dpr = window.devicePixelRatio || 1
  c.width = s * dpr
  c.height = s * dpr
  c.style.width = s + 'px'
  c.style.height = s + 'px'
  c.style.position = 'absolute'
  c.style.inset = '0'
  const ctx = c.getContext('2d')
  ctx.scale(dpr, dpr)
  ctx.strokeStyle = '#222'
  ctx.lineWidth = 1
  const step = s / 20
  for (let i = 0; i <= 20; i++) {
    ctx.beginPath(); ctx.moveTo(i * step, 0); ctx.lineTo(i * step, s); ctx.stroke()
    ctx.beginPath(); ctx.moveTo(0, i * step); ctx.lineTo(s, i * step); ctx.stroke()
  }
  box.insertBefore(c, box.firstChild)
}

// seen = the user notices distortion/waviness/gaps (the abnormal answer).
function respond(seen) {
  results[testEye.value] = seen
  if (eyeIdx.value < EYES.length - 1) {
    eyeIdx.value++
  } else {
    finished.value = true
  }
}

function restart() {
  eyeIdx.value = 0
  finished.value = false
  results.right = null
  results.left = null
}

const anyDistortion = computed(() => results.right === true || results.left === true)

function eyeAnswer(eye) {
  if (results[eye] === null) return '—'
  return results[eye] ? t('amDistYes') : t('amDistNo')
}
</script>

<template>
  <section class="hero"><h1>{{ t('tests.amsler.name') }}</h1></section>

  <div class="test-panel">
    <TestGate
      v-if="!finished"
      :target-cm="TARGET_CM"
      :tolerance-cm="10"
      :cover-eye="coverEye"
      :question="t('amQ2')"
      :yes-label="t('amDistYes')"
      :no-label="t('amDistNo')"
      @locked="drawGrid"
      @answer="respond"
    >
      <template #intro>
        <span>{{ t('amInstr') }}</span>
        <span class="glasses-note">{{ t('glassesAmsler') }}</span>
      </template>

      <div class="progress">
        {{ testEye === 'right' ? t('testingRightEye') : t('testingLeftEye') }}
      </div>
      <div ref="boxEl" class="amsler-box" :style="{ width: size + 'px', height: size + 'px' }">
        <div class="fix"></div>
      </div>
    </TestGate>

    <ResultScreen v-else :status="anyDistortion ? 'warn' : 'ok'" :badge="anyDistortion ? t('amWarn') : t('amOk')" @again="restart">
      <div class="result-list">
        <div>
          <span>{{ t('eyeRight') }}</span>
          <span :style="{ color: results.right ? 'var(--bad)' : 'var(--ok)' }">{{ eyeAnswer('right') }}</span>
        </div>
        <div>
          <span>{{ t('eyeLeft') }}</span>
          <span :style="{ color: results.left ? 'var(--bad)' : 'var(--ok)' }">{{ eyeAnswer('left') }}</span>
        </div>
      </div>
      <div class="result-detail">{{ anyDistortion ? t('amWarnD') : t('amOkD') }}</div>
    </ResultScreen>
  </div>
</template>

<style scoped>
.amsler-box { display: inline-block; position: relative; background: #fff; box-shadow: var(--shadow); }
.amsler-box .fix { position: absolute; top: 50%; left: 50%; width: 8px; height: 8px; background: #000; border-radius: 50%; transform: translate(-50%, -50%); z-index: 2; }
</style>
