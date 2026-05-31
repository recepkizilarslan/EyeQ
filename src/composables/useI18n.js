import { ref, computed } from 'vue'
import { messages } from '../data/messages.js'

const STORAGE_KEY = 'vc_lang'

function initialLang() {
  const stored = localStorage.getItem(STORAGE_KEY)
  if (stored === 'tr' || stored === 'en') return stored
  const nav = (navigator.language || 'tr').slice(0, 2)
  return nav === 'tr' ? 'tr' : 'en'
}

// module-level singletons -> shared reactive state across the app
const lang = ref(initialLang())
const dict = computed(() => messages[lang.value])

function setLang(l) {
  if (l !== 'tr' && l !== 'en') return
  lang.value = l
  localStorage.setItem(STORAGE_KEY, l)
  document.documentElement.lang = l
}

// resolve dotted keys e.g. t('tests.ishihara.name')
function t(key) {
  return key.split('.').reduce((o, k) => (o == null ? o : o[k]), dict.value) ?? key
}

document.documentElement.lang = lang.value

export function useI18n() {
  return { lang, dict, t, setLang }
}
