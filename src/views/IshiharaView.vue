<script setup>
import { ref, reactive, nextTick } from 'vue'
import { useI18n } from '../composables/useI18n.js'
import { ISH_PLATES, drawPlate, buildOptions } from '../data/ishihara.js'
import ResultScreen from '../components/ResultScreen.vue'
import TestGate from '../components/TestGate.vue'

const { t } = useI18n()

const TARGET_CM = 75

const idx = ref(0)
const finished = ref(false)
const options = ref([])
const canvasEl = ref(null)
const state = reactive({ correct: 0, answers: [] })

const total = ISH_PLATES.length

async function renderPlate() {
  await nextTick()
  if (canvasEl.value) drawPlate(canvasEl.value, ISH_PLATES[idx.value])
  options.value = buildOptions(ISH_PLATES[idx.value].num)
}

function answer(val) {
  const plate = ISH_PLATES[idx.value]
  const correct = val === plate.num
  if (correct) state.correct++
  state.answers.push({ num: plate.num, given: val, correct })
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
    <TestGate v-if="!finished" :target-cm="TARGET_CM" @locked="renderPlate">
      <template #intro>{{ t('ishInstr') }}</template>

      <div class="progress">{{ t('plate') }} {{ idx + 1 }} {{ t('of') }} {{ total }}</div>
      <div class="plate-wrap">
        <canvas ref="canvasEl" class="plate"></canvas>
      </div>
      <div class="opt-grid">
        <button v-for="o in options" :key="o" @click="answer(o)">{{ o }}</button>
      </div>
      <div class="btn-row">
        <button class="btn btn-ghost" @click="answer(null)">{{ t('cantSee') }}</button>
      </div>
    </TestGate>

    <ResultScreen v-else :status="pass() ? 'ok' : 'warn'" :badge="pass() ? t('ishOk') : t('ishWarn')" @again="restart">
      <div class="result-detail">{{ pass() ? t('ishOkD') : t('ishWarnD') }}</div>
      <div class="result-detail"><b>{{ t('score') }}: {{ state.correct }}/{{ total }}</b></div>
      <div class="result-list">
        <div v-for="(a, i) in state.answers" :key="i">
          <span>{{ t('plate') }} {{ i + 1 }} — {{ a.num }}</span>
          <span :style="{ color: a.correct ? 'var(--ok)' : 'var(--bad)' }">
            {{ a.given ?? '—' }} {{ a.correct ? '✓' : '✕' }}
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
