<script setup>
import { computed } from 'vue'
import { useI18n } from '../composables/useI18n.js'
import { useCalibration } from '../composables/useCalibration.js'

const { t } = useI18n()
const { calibPx, calibrated, setCalibPx, MIN_PX, MAX_PX } = useCalibration()

const cardWidthPx = computed(() => calibPx.value + 'px')

const tests = [
  { id: 'ishihara', to: '/ishihara', color: '#d35400', bg: '#fdf0e6' },
  { id: 'snellen', to: '/snellen', color: '#2563a8', bg: '#e9f2fb' },
  { id: 'amsler', to: '/amsler', color: '#7d3c98', bg: '#f3eaf8' },
  { id: 'contrast', to: '/contrast', color: '#566573', bg: '#eceff1' },
]

const icons = {
  ishihara: '<circle cx="12" cy="12" r="9"/><circle cx="9" cy="10" r="1.4" fill="currentColor"/><circle cx="14" cy="9" r="1" fill="currentColor"/><circle cx="12" cy="14" r="1.6" fill="currentColor"/><circle cx="15" cy="14" r="1" fill="currentColor"/>',
  snellen: '<path d="M4 6h16M7 6v12M17 6v12M9 18h6"/>',
  amsler: '<rect x="4" y="4" width="16" height="16" rx="1"/><path d="M9 4v16M14 4v16M4 9h16M4 14h16"/><circle cx="12" cy="12" r="1.2" fill="currentColor"/>',
  contrast: '<circle cx="12" cy="12" r="9"/><path d="M12 3a9 9 0 0 0 0 18z" fill="currentColor"/>',
}

function onSlider(e) {
  setCalibPx(e.target.value)
}
</script>

<template>
  <section class="hero">
    <h1>{{ t('heroTitle') }}</h1>
    <p>{{ t('heroSub') }}</p>
  </section>

  <div class="disclaimer">
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <path d="M12 9v4M12 17h.01M10.3 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.7 3.86a2 2 0 0 0-3.42 0z" />
    </svg>
    <span>{{ t('disclaimer') }}</span>
  </div>

  <div class="calib">
    <h3>{{ t('calibTitle') }}</h3>
    <p>{{ t('calibText') }}</p>
    <div class="card-ref" :style="{ width: cardWidthPx }">
      <span>{{ t('calibCard') }}</span>
    </div>
    <input type="range" :min="MIN_PX" :max="MAX_PX" :value="calibPx" @input="onSlider" />
    <div class="val">
      {{ t('calibScale') }}: <b>{{ calibPx }}</b> px
      <span v-if="calibrated" class="saved">· {{ t('calibSaved') }}</span>
    </div>
  </div>

  <div class="section-label">{{ t('chooseTest') }}</div>
  <div class="grid">
    <RouterLink v-for="tst in tests" :key="tst.id" class="test-card" :to="tst.to">
      <div class="ic" :style="{ background: tst.bg, color: tst.color }">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" :stroke="tst.color" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" v-html="icons[tst.id]"></svg>
      </div>
      <h2>{{ t(`tests.${tst.id}.name`) }}</h2>
      <p>{{ t(`tests.${tst.id}.desc`) }}</p>
      <span class="arrow">→</span>
    </RouterLink>
  </div>
</template>

<style scoped>
.calib {
  margin: 22px 0;
  padding: 18px;
  background: var(--panel);
  border: 1px solid var(--line);
  border-radius: var(--radius);
  box-shadow: var(--shadow);
}
.calib h3 { font-family: var(--sans); font-size: .95rem; margin-bottom: 6px; }
.calib p { font-size: .85rem; color: var(--ink-soft); font-family: var(--sans); margin-bottom: 12px; }
.card-ref {
  height: 180px; max-height: 180px; aspect-ratio: 85.6 / 53.98;
  border: 2px dashed var(--accent); border-radius: 10px;
  display: flex; align-items: center; justify-content: center;
  color: var(--accent); font-family: var(--sans); font-size: .8rem;
  background: repeating-linear-gradient(45deg, #fff, #fff 8px, #f0f6fc 8px, #f0f6fc 16px);
  transition: width .1s;
}
.calib input[type=range] { width: 100%; margin-top: 14px; accent-color: var(--accent); }
.calib .val { font-family: var(--sans); font-size: .8rem; color: var(--ink-soft); margin-top: 6px; }
.calib .saved { color: var(--ok); }

.section-label { font-family: var(--sans); font-size: .95rem; font-weight: 600; color: var(--ink); margin: 26px 0 4px; }
.grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 16px; margin-top: 8px; }
.test-card {
  background: var(--panel); border: 1px solid var(--line); border-radius: var(--radius);
  padding: 22px; box-shadow: var(--shadow); text-decoration: none; color: var(--ink);
  transition: transform .18s ease, box-shadow .18s ease; position: relative; overflow: hidden; display: block;
}
.test-card:hover { transform: translateY(-4px); box-shadow: var(--shadow-lg); }
.test-card .ic { width: 46px; height: 46px; border-radius: 12px; display: flex; align-items: center; justify-content: center; margin-bottom: 14px; }
.test-card h2 { font-size: 1.15rem; margin-bottom: 6px; }
.test-card p { font-size: .85rem; color: var(--ink-soft); font-family: var(--sans); }
.test-card .arrow { position: absolute; bottom: 18px; right: 18px; color: var(--accent); font-size: 1.2rem; opacity: .5; transition: .18s; font-family: var(--sans); }
.test-card:hover .arrow { opacity: 1; transform: translateX(3px); }
</style>
