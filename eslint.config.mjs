import pluginVue from 'eslint-plugin-vue'
import vueParser from 'vue-eslint-parser'
import tseslint from 'typescript-eslint'

/**
 * ESLint 扁平配置(ESLint 9)。
 *
 * 教学项目的规则取向:**宽松起步**。
 * 一上来就堆一堆风格规则,学生第一天就被满屏红波浪线劝退,
 * 而且会把「跑 lint」变成「想办法让 lint 闭嘴」。
 * 这里只留两类规则:
 *   1. 真 bug 类(未定义变量、疑似赋值当比较、vue 模板里的错误用法)
 *   2. 本项目特有约定(小程序页面文件名就是 index.vue / list.vue,
 *      所以必须关掉 vue/multi-word-component-names)
 *
 * 代码风格交给 Prettier,不在这里重复管辖。
 */
export default [
  {
    ignores: [
      'dist/**',
      'node_modules/**',
      'unpackage/**',
      'src/static/**',
      // 必须写 **/*.d.ts —— 单写 '*.d.ts' 只匹配项目根目录那一层
      '**/*.d.ts',
    ],
  },

  // 顺序:typescript-eslint 在前,plugin-vue 在后。
  // 反过来会让 tseslint 抢走 .vue 的顶层 parser,
  // 于是 <template> 报 "Parsing error: '>' expected"。
  ...tseslint.configs.recommended,
  ...pluginVue.configs['flat/essential'],

  {
    files: ['**/*.vue'],
    languageOptions: {
      // ★ 顶层 parser 必须是 vue-eslint-parser(负责拆 <template> / <script>),
      //   typescript-eslint 只能挂在它下面的 parserOptions.parser 当子 parser。
      parser: vueParser,
      parserOptions: {
        parser: tseslint.parser,
        extraFileExtensions: ['.vue'],
        sourceType: 'module',
      },
    },
  },

  {
    rules: {
      // ── SFC 结构:块顺序与宏顺序 ────────────────────────────
      // 本项目约定 <script> → <template> → <style>(与 Vue 官方默认相反)。
      // 理由:先读逻辑再读结构,滚动时"这个组件做什么"在最上面。
      // 本条可 autofix,eslint --fix 会自动重排块。
      // 注:eslint-plugin-vue v10 里叫 vue/block-order,
      //     旧名 vue/component-tags-order 已移除,写了会在启动时直接 TypeError。
      'vue/block-order': ['error', { order: ['script', 'template', 'style'] }],
      // script setup 内部第一层必须是 defineProps / defineEmits —— 组件接口先行。
      // 更细的 refs→computed→方法→watch→生命周期→defineExpose 顺序(声明先于使用,
      // 方法排在 watch 前)无法用规则表达,由 docs/DEVELOPMENT.md 与 vue-sfc-spec skill 约束。
      'vue/define-macros-order': [
        'error',
        { order: ['defineOptions', 'defineProps', 'defineEmits', 'defineSlots'] },
      ],

      // ── 其余规则 ──────────────────────────────────────────
      // uni-app 页面约定:pages/xxx/index.vue、list.vue、detail.vue
      'vue/multi-word-component-names': 'off',
      // 小程序页面样式需要全局生效的能力,不强求
      'vue/no-v-html': 'warn',

      // 允许 catch(e) 后不处理(小程序里吞掉异常再 toast 是常见写法)
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrors: 'none',
        },
      ],
      // mock 层与生成脚本会大量用 any,先不禁,但保留警告可见性
      '@typescript-eslint/no-explicit-any': 'warn',
    },
  },

  {
    files: ['scripts/**/*.mjs'],
    rules: {
      'no-undef': 'off',
    },
  },
]
