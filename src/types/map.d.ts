import type { MemberMapPoint } from './member'

/**
 * 传给 <map :markers> 的单个标记。
 *
 * 两条硬约束,踩过才知道:
 * 1. id 必须是 number。传字符串时 markertap 事件的 markerId 会取不到值。
 *    所以页面用数组下标当 id,再维护一张下标 → 成员的映射表反查。
 * 2. iconPath 必须是 PNG。JPG 不显示、SVG 表现异常,且用本地 /static 路径
 *    最稳(网络图要配域名白名单)。
 */
export interface MemberMarker {
  id: number
  latitude: number
  longitude: number
  title?: string
  iconPath: string
  width: number
  height: number
  /** true = 参与点聚合。成员密集区域会自动合并成带人数的气泡 */
  joinCluster?: boolean
  callout?: MarkerCallout
}

export interface MarkerCallout {
  content: string
  color?: string
  fontSize?: number
  borderRadius?: number
  bgColor?: string
  padding?: number
  /** BYCLICK = 点击才显示。ALWAYS 会让初始画面满屏气泡 */
  display?: 'BYCLICK' | 'ALWAYS' | 'BY_CLICK'
  textAlign?: 'left' | 'center' | 'right'
}

/** 地图视野档位:家乡 / 全国。将来加海外再加 'global' */
export type MapView = 'hometown' | 'nation'

export interface MapCenter {
  lat: number
  lng: number
}

/** markertap 事件的 detail。聚合点被点击时 markerId 不在映射表中 */
export interface MarkerTapDetail {
  markerId?: number
  marker?: { id: number }
}

/** 页面持有的成员点 + 其对应的下标 id */
export interface IndexedMember {
  index: number
  point: MemberMapPoint
}
