import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const entryPath = resolve('src/entry.ts')
const source = readFileSync(entryPath, 'utf8')

const failures = []

const requirePattern = (pattern, message) => {
  if (!pattern.test(source)) {
    failures.push(message)
  }
}

const rejectPattern = (pattern, message) => {
  if (pattern.test(source)) {
    failures.push(message)
  }
}

requirePattern(
  /let cachedScrollY = window\.scrollY/,
  'Entry scroll position should be cached once and reused by progress calculations.',
)

requirePattern(
  /let cachedViewportHeight = window\.innerHeight/,
  'Entry viewport height should be cached for progress bounds instead of rereading during calculations.',
)

requirePattern(
  /const refreshEntryViewportMetrics = \(\) => \{/,
  'Entry viewport metric refresh helper should keep scroll and viewport reads grouped.',
)

requirePattern(
  /cachedScrollY = window\.scrollY[\s\S]*queueProgress\(\)/,
  'Scroll listener should cache scrollY before queuing progress writes.',
)

rejectPattern(
  /const scrollY = window\.scrollY/,
  'Progress helpers should not read window.scrollY into local variables during their RAF work.',
)

rejectPattern(
  /const viewportHeight = window\.innerHeight/,
  'Progress bounds should use cached viewport height instead of reading innerHeight in the metrics RAF.',
)

rejectPattern(
  /viewportAnchor\s*=\s*\(\)\s*=>\s*window\.innerHeight/,
  'Section observer should not reread window.innerHeight for every observed entry.',
)

if (failures.length > 0) {
  console.error('Entry frame read/write patterns need review:')
  for (const failure of failures) {
    console.error(`  - ${failure}`)
  }
  process.exit(1)
}

console.log('Entry frame read/write patterns OK.')
