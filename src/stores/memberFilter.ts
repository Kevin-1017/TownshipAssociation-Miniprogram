import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { industryLabel } from '@/constants/industry'
import type { MemberMapPoint } from '@/types/member'

/**
 * 成员筛选条件 —— 全项目最值得讲的一个 store。
 *
 * 为什么它该进 Pinia:它在**地图页**和**乡贤列表页**都要用,且必须一致 ——
 * 在地图上筛了「深圳市 / 互联网」,切到底部「乡贤」tab,列表应该还是这批人。
 * 这是真实的跨页面共享状态,不是「为了用 Pinia 而用」。
 *
 * 对比:当前选中的某个成员、弹窗开合、表单草稿,这些都是单页面内的临时状态,
 * 该留在组件里的 ref,不要往这里塞。判断标准见 docs/ARCHITECTURE.md。
 */
export const useMemberFilterStore = defineStore('memberFilter', () => {
  const province = ref<string>('')
  const city = ref<string>('')
  const industry = ref<string>('')
  const keyword = ref<string>('')

  const isActive = computed(
    () => !!(province.value || city.value || industry.value || keyword.value),
  )

  /** 显示在筛选按钮上的文案,多个条件用 · 连接 */
  const label = computed(() => {
    const parts: string[] = []
    if (city.value) parts.push(city.value.replace('市', ''))
    else if (province.value) parts.push(province.value.replace(/省$|市$/, ''))
    if (industry.value) parts.push(industryLabel(industry.value))
    if (keyword.value) parts.push(`“${keyword.value}”`)
    return parts.join(' · ')
  })

  /** 前端过滤 mock 数据。后端就绪后页面应改用接口参数查询,而不是继续本地过滤 */
  function apply(list: MemberMapPoint[]): MemberMapPoint[] {
    return list.filter((m) => {
      if (province.value && m.province !== province.value) return false
      if (city.value && m.city !== city.value) return false
      if (industry.value && m.industry !== industry.value) return false
      if (keyword.value) {
        const kw = keyword.value.trim().toLowerCase()
        if (kw && !`${m.name}${m.city}${m.industry}`.toLowerCase().includes(kw)) return false
      }
      return true
    })
  }

  /** 选省时清空市,避免出现「广东省 + 上海市」这种矛盾组合 */
  function setProvince(v: string) {
    province.value = v
    city.value = ''
  }
  function setCity(v: string) {
    city.value = v
  }
  function setIndustry(v: string) {
    industry.value = v
  }
  function setKeyword(v: string) {
    keyword.value = v
  }

  function reset() {
    province.value = ''
    city.value = ''
    industry.value = ''
    keyword.value = ''
  }

  return {
    province,
    city,
    industry,
    keyword,
    isActive,
    label,
    apply,
    setProvince,
    setCity,
    setIndustry,
    setKeyword,
    reset,
  }
})
