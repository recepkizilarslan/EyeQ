<script setup>
import { ref, reactive, computed } from 'vue'
import { useI18n } from '../composables/useI18n.js'
import { useCalibration } from '../composables/useCalibration.js'
import { SN_LINES, letterHeightPx, randomLetter } from '../data/snellen.js'
import ResultScreen from '../components/ResultScreen.vue'
import TestGate from '../components/TestGate.vue'

const { t } = useI18n()
const { pxPerMM } = useCalibration()

const TARGET_CM = 100 // where we ask the user to sit; actual distance is measured

const EYES = ['right', 'left'] // eye being tested (covering the other one)
const eyeIdx = ref(0)
const testEye = computed(() => EYES[eyeIdx.value])
const coverEye = computed(() => (testEye.value === 'right' ? 'left' : 'right'))

const measuredCm = ref(TARGET_CM)
const idx = ref(0)
const finished = ref(false)
const current = ref(randomLetter())
// smallest readable line index per eye (-1 = none)
const results = reactive({ right: -1, left: -1 })

const total = SN_LINES.length
const line = computed(() => SN_LINES[idx.value])
const letterPx = computed(() =>
  Math.max(8, Math.round(letterHeightPx(line.value.denom, pxPerMM.value, measuredCm.value / 100))),
)
const stageHeight = computed(() => Math.max(letterPx.value + 30, 90) + 'px')

function nextLetter() {
  current.value = randomLetter()
}

function nextEye() {
  if (eyeIdx.value < EYES.length - 1) {
    eyeIdx.value++
    idx.value = 0
    nextLetter()
  } else {
    finished.value = true
  }
}

// seen = the user can read the current line on the eye being tested.
function respond(seen) {
  if (seen) {
    results[testEye.value] = idx.value
    if (idx.value < total - 1) {
      idx.value++
      nextLetter()
    } else {
      nextEye()
    }
  } else {
    nextEye()
  }
}

function restart() {
  eyeIdx.value = 0
  idx.value = 0
  finished.value = false
  results.right = -1
  results.left = -1
  nextLetter()
}

function eyeLineLabel(eye) {
  const b = results[eye]
  return b >= 0 ? `${SN_LINES[b].snellen} (${SN_LINES[b].us})` : `< ${SN_LINES[0].snellen}`
}
const bothGood = computed(() => results.right >= 4 && results.left >= 4) // 6/12 or better
const anyMissing = computed(() => results.right < 0 || results.left < 0)
const resultStatus = computed(() => (anyMissing.value ? 'warn' : bothGood.value ? 'ok' : 'neutral'))
const resultBadge = computed(() =>
  anyMissing.value ? t('ishWarn') : bothGood.value ? t('ishOk') : t('resultTitle'),
)
</script>

<template>
  <section class="hero"><h1>{{ t('tests.snellen.name') }}</h1></section>

  <div class="test-panel">
    <template v-if="!finished">
      <TestGate
        :target-cm="TARGET_CM"
        :cover-eye="coverEye"
        :question="t('snQ')"
        voice-mode="letter"
        :expected="current"
        @locked="measuredCm = $event || measuredCm"
        @answer="respond"
      >
        <template #intro>{{ t('snCamIntro') }}</template>

        <div class="progress">
          {{ testEye === 'right' ? t('testingRightEye') : t('testingLeftEye') }} ·
          {{ t('line') }} {{ idx + 1 }} {{ t('of') }} {{ total }} · {{ line.snellen }} ({{ line.us }})
          · {{ t('snCamMeasured') }}: {{ measuredCm }} cm
        </div>

        <div class="stage" :style="{ height: stageHeight }">
          <span class="snellen-letter" :style="{ fontSize: letterPx + 'px' }">{{ current }}</span>
        </div>
      </TestGate>
    </template>

    <ResultScreen v-else :status="resultStatus" :badge="resultBadge" @again="restart">
      <div class="result-list">
        <div>
          <span>{{ t('eyeRight') }}</span>
          <span><b>{{ eyeLineLabel('right') }}</b></span>
        </div>
        <div>
          <span>{{ t('eyeLeft') }}</span>
          <span><b>{{ eyeLineLabel('left') }}</b></span>
        </div>
      </div>
      <div class="result-detail">{{ t('snNote') }}</div>
    </ResultScreen>
  </div>
</template>

<style scoped>
.stage { display: flex; align-items: center; justify-content: center; }
.snellen-letter { font-family: var(--mono); font-weight: bold; color: #111; line-height: 1; user-select: none; }
</style>
