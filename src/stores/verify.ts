import { defineStore } from 'pinia'
import { ref } from 'vue'

/** 临时 store:仅用于验证 Pinia 装配成功,步骤 12 后删除 */
export const useVerifyStore = defineStore('verify', () => {
  const count = ref(0)
  const increment = () => count.value++
  return { count, increment }
})
