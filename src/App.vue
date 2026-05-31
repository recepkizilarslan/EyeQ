<script setup>
import AppHeader from './components/AppHeader.vue'
import { useI18n } from './composables/useI18n.js'

const { t } = useI18n()
</script>

<template>
  <AppHeader />
  <main class="container">
    <RouterView v-slot="{ Component, route }">
      <Transition name="fade">
        <component :is="Component" :key="route.path" />
      </Transition>
    </RouterView>
  </main>
  <footer class="app-footer">{{ t('footer') }}</footer>
</template>
