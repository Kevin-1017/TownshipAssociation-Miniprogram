/// <reference types="vite/client" />

/**
 * 自定义环境变量的类型声明。
 * 只有 VITE_ 前缀的变量才会被注入到客户端代码 —— 密钥一律不加 VITE_ 前缀,
 * 或者干脆不要放在 .env 里提交进仓库。
 */
interface ImportMetaEnv {
  /** 'true' | 'false'。注意是字符串,不是布尔 */
  readonly VITE_USE_MOCK: string
  /** 后端 API 前缀,如 https://api.xxx.org/api/v1 */
  readonly VITE_API_BASE_URL: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
