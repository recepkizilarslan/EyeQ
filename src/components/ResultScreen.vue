<script setup>
import { useI18n } from '../composables/useI18n.js'

const { t } = useI18n()

defineProps({
  status: { type: String, default: 'neutral' }, // 'ok' | 'warn' | 'neutral'
  badge: { type: String, required: true },
})
defineEmits(['again'])
</script>

<template>
  <div class="progress">{{ t('resultTitle') }}</div>
  <div class="result-badge" :class="status">
    <span>{{ status === 'ok' ? '✓' : status === 'warn' ? '!' : '•' }}</span>
    <span>{{ badge }}</span>
  </div>

  <slot />

  <div class="btn-row">
    <button class="btn btn-ghost" @click="$emit('again')">{{ t('again') }}</button>
    <RouterLink class="btn btn-primary" to="/">{{ t('backHome') }}</RouterLink>
  </div>
</template>
