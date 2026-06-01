<script setup>
import { ref, reactive, computed, nextTick } from 'vue'
import { useI18n } from '../composables/useI18n.js'
import { ISH_PLATES, drawPlate } from '../data/ishihara.js'
import ResultScreen from '../components/ResultScreen.vue'
import TestGate from '../components/TestGate.vue'

const { t } = useI18n()

const TARGET_CM = 75

const idx = ref(0)
const finished = ref(false)
const canvasEl = ref(null)
const state = reactive({ correct: 0, answers: [] })

const total = ISH_PLATES.length
const plateNum = computed(() => ISH_PLATES[idx.value].num)

async function renderPlate() {
  await nextTick()
  if (canvasEl.value) drawPlate(canvasEl.value, ISH_PLATES[idx.value])
}

// seen = the user can make out the figure on this plate (normal response).
function respond(seen) {
  const plate = ISH_PLATES[idx.value]
  if (seen) state.correct++
  state.answers.push({ num: plate.num, seen })
  if (idx.value < total - 1) {
    idx.value++
    renderPlate()
  } else {
    finished.value = true
  }
}

function restart() {
  idx.value = 0
  finished.value = false
  state.correct = 0
  state.answers = []
}

const pass = () => state.correct >= Math.ceil(total * 0.75)
</script>

<template>
  <section class="hero"><h1>{{ t('tests.ishihara.name') }}</h1></section>

  <div class="test-panel">
    <TestGate
      v-if="!finished"
      :target-cm="TARGET_CM"
      :question="t('ishQ')"
      voice-mode="number"
      :expected="plateNum"
      @locked="renderPlate"
      @answer="respond"
    >
      <template #intro>
        <span>{{ t('ishInstr') }}</span>
        <span class="glasses-note">{{ t('glassesIshihara') }}</span>
      </template>

      <div class="progress">{{ t('plate') }} {{ idx + 1 }} {{ t('of') }} {{ total }}</div>
      <div class="plate-wrap">
        <canvas ref="canvasEl" class="plate"></canvas>
      </div>
    </TestGate>

    <ResultScreen v-else :status="pass() ? 'ok' : 'warn'" :badge="pass() ? t('ishOk') : t('ishWarn')" @again="restart">
      <div class="result-detail">{{ pass() ? t('ishOkD') : t('ishWarnD') }}</div>
      <div class="result-detail"><b>{{ t('score') }}: {{ state.correct }}/{{ total }}</b></div>
      <div class="result-list">
        <div v-for="(a, i) in state.answers" :key="i">
          <span>{{ t('plate') }} {{ i + 1 }} — {{ a.num }}</span>
          <span :style="{ color: a.seen ? 'var(--ok)' : 'var(--bad)' }">
            {{ a.seen ? t('gSeen') : t('gUnseen') }} {{ a.seen ? '✓' : '✕' }}
          </span>
        </div>
      </div>
    </ResultScreen>
  </div>
</template>

<style scoped>
.plate-wrap { display: flex; justify-content: center; margin: 8px 0 4px; }
.plate { border-radius: 50%; box-shadow: var(--shadow); max-width: 100%; }
</style>
