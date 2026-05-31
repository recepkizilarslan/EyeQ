<script setup>
import { ref } from 'vue'
import { useI18n } from '../composables/useI18n.js'
import CameraPositioner from './CameraPositioner.vue'

defineProps({
  targetCm: { type: Number, required: true },
  toleranceCm: { type: Number, default: 15 },
  holdMs: { type: Number, default: 1500 },
  graceMs: { type: Number, default: 1500 },
})
const emit = defineEmits(['locked'])

const { t } = useI18n()

const phase = ref('positioning') // positioning | testing
const paused = ref(false)

function onLocked(distanceCm) {
  phase.value = 'testing'
  paused.value = false
  emit('locked', distanceCm)
}
</script>

<template>
  <div class="gate" :class="{ relative: phase === 'testing' }">
    <template v-if="phase === 'positioning'">
      <div class="progress">{{ t('camGateTitle') }}</div>
      <div class="stage-instr"><slot name="intro" /></div>
    </template>

    <CameraPositioner
      :class="{ pip: phase === 'testing' }"
      :compact="phase === 'testing'"
      :target-cm="targetCm"
      :tolerance-cm="toleranceCm"
      :hold-ms="holdMs"
      :grace-ms="graceMs"
      @locked="onLocked"
      @lost="paused = true"
      @regained="paused = false"
    />

    <template v-if="phase === 'testing'">
      <div :class="{ blocked: paused }"><slot /></div>
      <div v-if="paused" class="pause-veil">
        <div class="pause-card">
          <b>{{ t('camLostTitle') }}</b>
          <span>{{ t('camLostText') }}</span>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.gate.relative { position: relative; }
.pip { position: absolute; top: 12px; right: 12px; z-index: 5; }
.blocked { filter: blur(3px); pointer-events: none; opacity: .5; }

.pause-veil {
  position: absolute; inset: 0; display: flex; align-items: center; justify-content: center;
  background: rgba(244, 241, 234, 0.78); backdrop-filter: blur(2px); border-radius: 18px; z-index: 8;
}
.pause-card {
  display: flex; flex-direction: column; gap: 6px; text-align: center;
  background: var(--panel); border: 1px solid var(--bad); border-radius: 14px;
  padding: 18px 22px; box-shadow: var(--shadow-lg); font-family: var(--sans); max-width: 80%;
}
.pause-card b { color: var(--bad); font-size: 1.05rem; }
.pause-card span { font-size: .85rem; color: var(--ink-soft); }

@media (max-width: 560px) {
  .pip { position: static; margin: 0 auto 12px; }
}
</style>
