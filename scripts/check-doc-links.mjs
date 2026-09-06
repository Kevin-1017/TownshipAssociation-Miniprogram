import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'

const files = ['README.md', ...readdirSync('docs').map((f) => join('docs', f))]
let bad = 0
let total = 0

for (const f of files) {
  const text = readFileSync(f, 'utf8')
  // 只查相对链接,跳过 http(s) 与代码块内的示例
  for (const m of text.matchAll(/\]\((?!https?:|mailto:)([^)\s#]+)/g)) {
    const target = join(dirname(f), m[1])
    total++
    if (!existsSync(target)) {
      console.log(`❌ ${f} → ${m[1]}`)
      bad++
    }
  }
}
console.log(bad ? `\n${bad}/${total} 个链接失效` : `✅ ${total} 个相对链接全部有效`)
