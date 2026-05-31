<script setup>
import { useI18n } from '../composables/useI18n.js'
const { t } = useI18n()
</script>

<template>
  <section class="hero"><h1>404 — {{ t('notFound') }}</h1></section>
  <div class="test-panel">
    <div class="result-detail">{{ t('notFoundD') }}</div>
    <div class="btn-row">
      <RouterLink class="btn btn-primary" to="/">{{ t('backHome') }}</RouterLink>
    </div>
  </div>
</template>
