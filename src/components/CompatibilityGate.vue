<script setup>
import { useI18n } from '../composables/useI18n.js'
import { useCapabilities } from '../composables/capabilities.js'

// App-wide rejection screen. Shown on the home page (and every route) the
// moment a required capability is missing, so the user never has to enter a
// test to find out their browser/device can't run one. The support decision
// itself lives in capabilities.js — this component only renders it.
const { t } = useI18n()
const caps = useCapabilities()

const COMPAT_MSG = {
  secure: 'compatNeedSecure',
  camera: 'compatNeedCamera',
  mic: 'compatNeedMic',
  voice: 'compatNeedVoice',
  graphics: 'compatNeedGraphics',
}
</script>

<template>
  <div class="compat-block">
    <div class="compat-card">
      <h2>{{ t('compatTitle') }}</h2>
      <p>{{ t('compatIntro') }}</p>
      <ul class="compat-missing">
        <li v-for="key in caps.missing" :key="key">{{ t(COMPAT_MSG[key]) }}</li>
      </ul>
      <p class="compat-browsers">{{ t('compatBrowsers') }}</p>
    </div>
  </div>
</template>

<style scoped>
.compat-block {
  display: flex;
  justify-content: center;
  padding: 24px;
}
.compat-card {
  max-width: 540px;
  width: 100%;
  background: #fff7ed;
  border: 1px solid #f3c98b;
  border-radius: 14px;
  padding: 24px 26px;
  font-family: var(--sans);
  color: #5b4326;
  box-shadow: var(--shadow);
}
.compat-card h2 {
  margin: 0 0 10px;
  color: #b45309;
  font-size: 1.25rem;
}
.compat-card p {
  margin: 0 0 12px;
  line-height: 1.5;
}
.compat-missing {
  margin: 0 0 14px;
  padding-left: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.compat-missing li {
  padding-left: 24px;
  position: relative;
}
.compat-missing li::before {
  content: '⛔';
  position: absolute;
  left: 0;
}
.compat-browsers {
  font-size: 0.9rem;
  color: #7a5a30;
  border-top: 1px solid #f0d6ad;
  padding-top: 12px;
  margin-bottom: 0 !important;
}
</style>
