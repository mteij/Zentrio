import { createRouter, createWebHistory } from 'vue-router'
import Home from './views/Home.vue'
import Releases from './views/Releases.vue'

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
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

export default router