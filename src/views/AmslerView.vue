<script setup>
import { ref, nextTick } from 'vue'
import { useI18n } from '../composables/useI18n.js'
import ResultScreen from '../components/ResultScreen.vue'
import TestGate from '../components/TestGate.vue'

const { t } = useI18n()

const TARGET_CM = 35 // Amsler is a near test (30-40 cm)

const finished = ref(false)
const distortion = ref(false)
const boxEl = ref(null)
const size = ref(Math.min(360, Math.floor(window.innerWidth * 0.8)))

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

function answer(hasDistortion) {
  distortion.value = hasDistortion
  finished.value = true
}

function restart() {
  finished.value = false
}
</script>

<template>
  <section class="hero"><h1>{{ t('tests.amsler.name') }}</h1></section>

  <div class="test-panel">
    <TestGate v-if="!finished" :target-cm="TARGET_CM" :tolerance-cm="10" @locked="drawGrid">
      <template #intro>{{ t('amInstr') }}</template>

      <div class="progress">{{ t('tests.amsler.name') }}</div>
      <div ref="boxEl" class="amsler-box" :style="{ width: size + 'px', height: size + 'px' }">
        <div class="fix"></div>
      </div>
      <div class="stage-instr question">{{ t('amQ') }}</div>
      <div class="amsler-opts">
        <button class="btn btn-ghost" @click="answer(false)">{{ t('amOpt1') }}</button>
        <button class="btn btn-ghost" @click="answer(true)">{{ t('amOpt2') }}</button>
        <button class="btn btn-ghost" @click="answer(true)">{{ t('amOpt3') }}</button>
        <button class="btn btn-ghost" @click="answer(true)">{{ t('amOpt4') }}</button>
      </div>
    </TestGate>

    <ResultScreen v-else :status="distortion ? 'warn' : 'ok'" :badge="distortion ? t('amWarn') : t('amOk')" @again="restart">
      <div class="result-detail">{{ distortion ? t('amWarnD') : t('amOkD') }}</div>
    </ResultScreen>
  </div>
</template>

<style scoped>
.amsler-box { display: inline-block; position: relative; background: #fff; box-shadow: var(--shadow); }
.amsler-box .fix { position: absolute; top: 50%; left: 50%; width: 8px; height: 8px; background: #000; border-radius: 50%; transform: translate(-50%, -50%); z-index: 2; }
.question { margin-top: 18px; font-weight: 600; color: var(--ink); }
.amsler-opts { display: flex; flex-direction: column; align-items: stretch; max-width: 340px; margin: 14px auto 0; gap: 10px; }
</style>
