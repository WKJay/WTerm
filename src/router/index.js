import { createRouter, createWebHistory } from 'vue-router'
import terminal from '../components/terminal.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'home',
      component: terminal
    },
  ]
})

export default router
