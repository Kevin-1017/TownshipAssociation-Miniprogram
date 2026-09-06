export default {
  extends: ['@commitlint/config-conventional'],
  rules: {
    // 允许中文 subject —— 团队以学生为主,强要英文只会逼人写 Chinglish 或绕过校验
    'subject-case': [0],
    'header-max-length': [2, 'always', 72],
    'type-enum': [
      2,
      'always',
      [
        'feat', // 新功能
        'fix', // 修 bug
        'docs', // 文档
        'style', // 格式(不改逻辑)
        'refactor', // 重构
        'perf', // 性能
        'test', // 测试
        'chore', // 构建/工具链
        'revert', // 回滚
      ],
    ],
  },
}
