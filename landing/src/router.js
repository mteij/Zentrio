import { createRouter, createWebHistory } from 'vue-router'
import Home from './views/Home.vue'
import Releases from './views/Releases.vue'
import Tos from './views/Tos.vue'

const routes = [
  {
    path: '/',
    name: 'Home',
    component: Home
  },
  {
    path: '/releases',
    name: 'Releases',
    component: Releases
  },
  {
    path: '/tos',
    name: 'Tos',
    component: Tos
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

export default router