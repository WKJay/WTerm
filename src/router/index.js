import { createRouter, createWebHistory } from 'vue-router'
import terminal from '../components/terminal.vue'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      name: 'home',
      component: terminal
    },
  ]
})

export default router
