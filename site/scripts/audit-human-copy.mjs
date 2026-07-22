import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const scriptDir = dirname(fileURLToPath(import.meta.url))
const siteRoot = resolve(scriptDir, '..')
const projectRoot = resolve(siteRoot, '..')
const reportRoot = resolve(projectRoot, '.workspace', 'frontend-studio')
const reportPath = join(reportRoot, 'human-copy-audit.json')

const genericLabels = new Set(['总览', '章节', '内容', '继续', '更多', '其他'])
const forbiddenVisiblePhrases = [
  '作为AI',
  '作为一个AI',
  '由AI生成',
  '综上所述',
  '值得注意的是',
  '不可否认',
  '具有重要意义',
  '标志着重要',
  '证据工程',
  '思考过程',
  '用户要求',
  '以下是',
  '当然可以',
]
const forbiddenHeadingPatterns = [
  /^材料\s*[：:]/,
  /^范围\s*[：:]/,
  /核查对象/,
  /verification_record/i,
  /evidence\s+slice/i,
]

const failures = []
const warnings = []
const routes = []

const htmlFiles = readdirSync(siteRoot)
  .filter((file) => file.endsWith('.html'))
  .sort((a, b) => a.localeCompare(b))

for (const file of htmlFiles) {
  const source = readFileSync(join(siteRoot, file), 'utf8')
  if (!/<body\b[^>]*\bclass="[^"]*\bentry-page\b/.test(source)) continue

  const visibleText = stripNonVisibleMarkup(source)
  const phraseHits = forbiddenVisiblePhrases.filter((phrase) => visibleText.includes(phrase))
  if (phraseHits.length > 0) {
    failures.push(`${file}: public copy contains ${phraseHits.join(', ')}`)
  }
  if (/[—–]/.test(visibleText)) {
    failures.push(`${file}: public copy contains an em dash or en dash`)
  }

  const sections = []
  const ids = new Set()
  const labels = new Set()
  const sectionPattern = /<section\b(?=[^>]*\bclass="[^"]*\bentry-section\b[^"]*")[^>]*>[\s\S]*?<\/section>/g
  for (const sectionHtml of source.match(sectionPattern) || []) {
    const openTag = sectionHtml.match(/^<section\b[^>]*>/)?.[0] || ''
    const id = getAttribute(openTag, 'id')
    const label = decodeText(getAttribute(openTag, 'data-reading-label'))
    const heading = decodeText(sectionHtml.match(/<h2\b[^>]*>([\s\S]*?)<\/h2>/)?.[1] || '')

    if (!id) failures.push(`${file}: an article section is missing id`)
    if (!heading) failures.push(`${file}${id ? `#${id}` : ''}: section is missing h2`)
    if (!label) failures.push(`${file}${id ? `#${id}` : ''}: section is missing data-reading-label`)

    if (id && ids.has(id)) failures.push(`${file}: duplicate section id ${id}`)
    if (label && labels.has(label)) failures.push(`${file}: duplicate reading label ${label}`)
    ids.add(id)
    labels.add(label)

    const labelLength = Array.from(label).length
    if (label && (labelLength < 2 || labelLength > 8)) {
      failures.push(`${file}#${id}: reading label ${label} must be 2-8 characters`)
    }
    if (genericLabels.has(label)) {
      failures.push(`${file}#${id}: reading label ${label} is too generic`)
    }
    if (label && heading && looksMechanicallyTruncated(label, heading)) {
      failures.push(`${file}#${id}: reading label ${label} looks copied from the heading prefix`)
    }

    const headingHits = forbiddenHeadingPatterns.filter((pattern) => pattern.test(heading))
    if (headingHits.length > 0) {
      failures.push(`${file}#${id}: report-like heading ${heading}`)
    }

    sections.push({ id, label, heading })
  }

  if (sections.length === 0) failures.push(`${file}: entry page has no article sections`)
  routes.push({ file, sectionCount: sections.length, sections })
}

const report = {
  status: failures.length === 0 ? 'PASS' : 'FAIL',
  pages: routes.length,
  sections: routes.reduce((total, route) => total + route.sectionCount, 0),
  routes,
  warnings,
  failures,
}

mkdirSync(reportRoot, { recursive: true })
writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8')

console.log(`${report.status}: ${report.pages} pages, ${report.sections} sections`)
console.log(`warnings=${report.warnings.length} failures=${report.failures.length}`)
console.log(reportPath)

if (failures.length > 0) {
  console.error(failures.slice(0, 30).join('\n'))
  process.exitCode = 1
}

function getAttribute(tag, name) {
  const match = tag.match(new RegExp(`\\s${name}="([^"]*)"`))
  return match?.[1] || ''
}

function decodeText(value) {
  return String(value)
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
}

function stripNonVisibleMarkup(source) {
  return decodeText(
    source
      .replace(/<script\b[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style\b[\s\S]*?<\/style>/gi, ' '),
  )
}

function looksMechanicallyTruncated(label, heading) {
  const labelChinese = Array.from(label).filter((character) => /[\u4e00-\u9fff]/.test(character))
  if (labelChinese.length < 2 || labelChinese.length > 4 || labelChinese.length !== Array.from(label).length) {
    return false
  }
  const headingChinese = Array.from(heading).filter((character) => /[\u4e00-\u9fff]/.test(character))
  return headingChinese.slice(0, labelChinese.length).join('') === label
}
