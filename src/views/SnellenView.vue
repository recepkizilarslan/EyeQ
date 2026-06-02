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

// null = not chosen yet, true = with glasses/contacts, false = without
const corrected = ref(null)

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
  corrected.value = null
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
  anyMissing.value ? t('snWarn') : bothGood.value ? t('snOk') : t('resultTitle'),
)
const correctionLabel = computed(() =>
  corrected.value === true
    ? t('correctedLabel')
    : corrected.value === false
      ? t('uncorrectedLabel')
      : null,
)
</script>

<template>
  <section class="hero"><h1>{{ t('tests.snellen.name') }}</h1></section>

  <div class="test-panel">
    <!-- Step 0: choose corrected / uncorrected before camera starts -->
    <div v-if="corrected === null" class="correction-gate">
      <p class="correction-prompt">{{ t('correctionPrompt') }}</p>
      <p class="glasses-hint">{{ t('glassesSnellen') }}</p>
      <div class="btn-row">
        <button class="btn btn-primary" @click="corrected = true">{{ t('correctionYes') }}</button>
        <button class="btn btn-ghost" @click="corrected = false">{{ t('correctionNo') }}</button>
      </div>
    </div>

    <template v-else-if="!finished">
      <TestGate
        :target-cm="TARGET_CM"
        :cover-eye="coverEye"
        :question="t('snQ')"
        :yes-label="t('gSeen')"
        :no-label="t('cantSee')"
        @locked="measuredCm = $event || measuredCm"
        @answer="respond"
      >
        <template #intro>
          <span>{{ t('snCamIntro') }}</span>
          <span class="glasses-note">{{ t('glassesSnellen') }}</span>
        </template>

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
      <!-- Correction type badge -->
      <div v-if="correctionLabel" class="correction-badge">
        {{ corrected ? '👓' : '🚫' }} {{ correctionLabel }}
      </div>
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

/* Correction gate shown before the camera starts */
.correction-gate {
  display: flex; flex-direction: column; align-items: center;
  gap: 16px; padding: 28px 16px; text-align: center;
}
.correction-prompt {
  font-family: var(--sans); font-size: 1.05rem; font-weight: 700; color: var(--ink);
}
.glasses-hint {
  font-family: var(--sans); font-size: .85rem; color: var(--ink-soft);
  max-width: 50ch; line-height: 1.5;
}

/* Correction badge shown on result screen */
.correction-badge {
  display: inline-block;
  font-family: var(--sans); font-size: .85rem; font-weight: 600;
  background: #eef3f8; color: var(--accent-deep);
  border: 1px solid #c5d8ee; border-radius: 999px;
  padding: 6px 16px; margin-bottom: 14px;
}
</style>
