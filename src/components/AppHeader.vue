<script setup>
import { useRoute } from 'vue-router'
import { computed } from 'vue'
import { useI18n } from '../composables/useI18n.js'
import LangToggle from './LangToggle.vue'

const route = useRoute()
const { t } = useI18n()
const showBack = computed(() => route.name !== 'home')
</script>

<template>
  <header class="app-header">
    <RouterLink class="brand" to="/">
      <span class="dot"></span>
      <span>EyeQ</span>
    </RouterLink>
    <div class="head-right">
      <RouterLink v-if="showBack" class="back-link" to="/">{{ t('backHub') }}</RouterLink>
      <LangToggle />
    </div>
  </header>
</template>
