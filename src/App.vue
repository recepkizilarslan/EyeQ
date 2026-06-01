<script setup>
import AppHeader from './components/AppHeader.vue'
import CompatibilityGate from './components/CompatibilityGate.vue'
import { useI18n } from './composables/useI18n.js'
import { useCapabilities } from './composables/capabilities.js'

const { t } = useI18n()
// If the browser/device can't run a test, reject app-wide right here — the
// user sees it on the home page without having to open a test.
const caps = useCapabilities()
</script>

<template>
  <AppHeader />
  <main class="container">
    <CompatibilityGate v-if="!caps.supported" />
    <RouterView v-else v-slot="{ Component, route }">
      <Transition name="fade">
        <component :is="Component" :key="route.path" />
      </Transition>
    </RouterView>
  </main>
  <footer class="app-footer">{{ t('footer') }}</footer>
</template>
