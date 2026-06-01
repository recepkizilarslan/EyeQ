<script setup>
import { ref, reactive, computed } from 'vue'
import { useI18n } from '../composables/useI18n.js'
import { randomLetter } from '../data/snellen.js'
import ResultScreen from '../components/ResultScreen.vue'
import TestGate from '../components/TestGate.vue'

const { t } = useI18n()

const TARGET_CM = 60

const CO_LEVELS = [0.55, 0.42, 0.30, 0.22, 0.15, 0.10, 0.06, 0.035]

const idx = ref(0)
const finished = ref(false)
const current = ref(randomLetter())
const state = reactive({ lastReadable: -1 })

const total = CO_LEVELS.length

const letterColor = computed(() => {
  const grey = Math.round(255 * (1 - CO_LEVELS[idx.value]))
  const hex = grey.toString(16).padStart(2, '0')
  return `#${hex}${hex}${hex}`
})

function nextLetter() {
  current.value = randomLetter()
}

function respond(seen) {
  if (seen) {
    state.lastReadable = idx.value
    if (idx.value < total - 1) {
      idx.value++
      nextLetter()
    } else {
      finished.value = true
    }
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
const good = computed(() => best.value >= 4)
const levelLabel = computed(() => (best.value < 0 ? '—' : `${best.value + 1}/${total}`))
</script>

<template>
  <section class="hero"><h1>{{ t('tests.contrast.name') }}</h1></section>

  <div class="test-panel">
    <TestGate
      v-if="!finished"
      :target-cm="TARGET_CM"
      :question="t('coQ')"
      :yes-label="t('gSeen')"
      :no-label="t('cantSee')"
      @answer="respond"
    >
      <template #intro>{{ t('coInstr') }}</template>

      <div class="progress">{{ t('level') }} {{ idx + 1 }} {{ t('of') }} {{ total }}</div>
      <div class="contrast-stage">
        <span class="co-letter" :style="{ color: letterColor }">{{ current }}</span>
      </div>
    </TestGate>

    <ResultScreen v-else :status="good ? 'ok' : 'neutral'" :badge="good ? t('coOk') : t('coWarn')" @again="restart">
      <div class="result-detail">{{ t('coD') }} <b>{{ levelLabel }}</b></div>
      <div class="result-detail">{{ t('coNote') }}</div>
    </ResultScreen>
  </div>
</template>

<style scoped>
.contrast-stage { display: flex; align-items: center; justify-content: center; height: 220px; background: #fff; border-radius: 12px; box-shadow: var(--shadow); }
.co-letter { font-family: var(--mono); font-weight: bold; font-size: 90px; }
.opt-grid { margin-top: 18px; }
</style>
