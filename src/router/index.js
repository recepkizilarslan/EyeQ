import { createRouter, createWebHashHistory } from 'vue-router'
import HomeView from '../views/HomeView.vue'
import IshiharaView from '../views/IshiharaView.vue'
import SnellenView from '../views/SnellenView.vue'
import AmslerView from '../views/AmslerView.vue'
import ContrastView from '../views/ContrastView.vue'
import NotFoundView from '../views/NotFoundView.vue'

// Eager imports: the whole app is tiny (~10 KB of view code), so a single
// bundle is faster in practice than lazy chunks, and it avoids the known
// async-component + <Transition mode="out-in"> race that blanks the view.
const routes = [
  { path: '/', name: 'home', component: HomeView },
  { path: '/ishihara', name: 'ishihara', component: IshiharaView },
  { path: '/snellen', name: 'snellen', component: SnellenView },
  { path: '/amsler', name: 'amsler', component: AmslerView },
  { path: '/contrast', name: 'contrast', component: ContrastView },
  { path: '/:pathMatch(.*)*', name: 'notfound', component: NotFoundView },
]

const router = createRouter({
  history: createWebHashHistory(import.meta.env.BASE_URL),
  routes,
  scrollBehavior() {
    return { top: 0 }
  },
})

export default router
