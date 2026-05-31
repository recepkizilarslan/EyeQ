<script setup>
import { ref, reactive, computed } from 'vue'
import { useI18n } from '../composables/useI18n.js'
import { useCalibration } from '../composables/useCalibration.js'
import { SN_LINES, letterHeightPx, randomLetter, buildLetterOptions } from '../data/snellen.js'
import ResultScreen from '../components/ResultScreen.vue'
import TestGate from '../components/TestGate.vue'

const { t } = useI18n()
const { pxPerMM, calibrated } = useCalibration()

const TARGET_CM = 100 // where we ask the user to sit; actual distance is measured

const measuredCm = ref(TARGET_CM)
const idx = ref(0)
const finished = ref(false)
const current = ref(randomLetter())
const options = ref(buildLetterOptions(current.value))
const state = reactive({ lastReadable: -1 })

const total = SN_LINES.length
const line = computed(() => SN_LINES[idx.value])
const letterPx = computed(() =>
  Math.max(8, Math.round(letterHeightPx(line.value.denom, pxPerMM.value, measuredCm.value / 100))),
)
const stageHeight = computed(() => Math.max(letterPx.value + 30, 90) + 'px')

function nextLetter() {
  current.value = randomLetter()
  options.value = buildLetterOptions(current.value)
}

function answer(val) {
  if (val === current.value) state.lastReadable = idx.value
  if (idx.value < total - 1) {
    idx.value++
    nextLetter()
  } else {
    finished.value = true
  }
}

function restart() {
  idx.value = 0
  finished.value = false
  state.lastReadable = -1
  nextLetter()
}

const best = computed(() => state.lastReadable)
const good = computed(() => best.value >= 4) // 6/12 or better
const resultLine = computed(() => (best.value >= 0 ? SN_LINES[best.value] : null))
const resultStatus = computed(() => (best.value < 0 ? 'warn' : good.value ? 'ok' : 'neutral'))
const resultBadge = computed(() => (best.value < 0 ? t('ishWarn') : good.value ? t('ishOk') : t('resultTitle')))
</script>

<template>
  <section class="hero"><h1>{{ t('tests.snellen.name') }}</h1></section>

  <div class="test-panel">
    <template v-if="!finished">
      <div v-if="!calibrated" class="calib-warn">
        {{ t('snNeedCalib') }} <RouterLink to="/">{{ t('snGoCalib') }}</RouterLink>
      </div>

      <TestGate :target-cm="TARGET_CM" @locked="measuredCm = $event || measuredCm">
        <template #intro>{{ t('snCamIntro') }}</template>

        <div class="progress">
          {{ t('line') }} {{ idx + 1 }} {{ t('of') }} {{ total }} · {{ line.snellen }} ({{ line.us }})
          · {{ t('snCamMeasured') }}: {{ measuredCm }} cm
        </div>

        <div class="stage" :style="{ height: stageHeight }">
          <span class="snellen-letter" :style="{ fontSize: letterPx + 'px' }">{{ current }}</span>
        </div>

        <div class="opt-grid">
          <button v-for="o in options" :key="o" @click="answer(o)">{{ o }}</button>
        </div>
        <div class="btn-row">
          <button class="btn btn-ghost" @click="answer(null)">{{ t('cantSee') }}</button>
        </div>
      </TestGate>
    </template>

    <ResultScreen v-else :status="resultStatus" :badge="resultBadge" @again="restart">
      <div v-if="best < 0" class="result-detail">
        {{ t('snWarnD') }} <b>&lt; {{ SN_LINES[0].snellen }}</b>
      </div>
      <div v-else class="result-detail">
        {{ good ? t('snOkD') : t('snWarnD') }} <b>{{ resultLine.snellen }} ({{ resultLine.us }})</b>
      </div>
      <div class="result-detail">{{ t('snNote') }}</div>
    </ResultScreen>
  </div>
</template>

<style scoped>
.stage { display: flex; align-items: center; justify-content: center; }
.snellen-letter { font-family: var(--mono); font-weight: bold; color: #111; line-height: 1; user-select: none; }
</style>
