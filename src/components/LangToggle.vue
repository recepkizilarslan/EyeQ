<script setup>
import { useI18n } from '../composables/useI18n.js'

const { lang, setLang } = useI18n()
</script>

<template>
  <div class="lang-toggle">
    <button :class="{ active: lang === 'tr' }" @click="setLang('tr')">TR</button>
    <button :class="{ active: lang === 'en' }" @click="setLang('en')">EN</button>
  </div>
</template>
