import { createRouter, createWebHistory } from 'vue-router'
import Home from './views/Home.vue'
import Releases from './views/Releases.vue'
import Tos from './views/Tos.vue'
import Privacy from './views/Privacy.vue'
import AccountDeletion from './views/AccountDeletion.vue'
import HostedWebRedirect from './views/HostedWebRedirect.vue'

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
  },
  {
    path: '/privacy',
    name: 'Privacy',
    component: Privacy
  },
  {
    path: '/account-deletion',
    name: 'AccountDeletion',
    component: AccountDeletion
  },
  {
    path: '/web',
    name: 'HostedWebRedirect',
    component: HostedWebRedirect
  },
  {
    path: '/:pathMatch(.*)*',
    redirect: '/'
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

export default router
