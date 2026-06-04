import { existsSync, readdirSync, rmdirSync, unlinkSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { dirname } from 'node:path'

const scriptDir = dirname(fileURLToPath(import.meta.url))
const siteRoot = resolve(scriptDir, '..')
const distRoot = resolve(siteRoot, 'dist')

if (!distRoot.startsWith(siteRoot)) {
  throw new Error(`Refuse to clean outside site root: ${distRoot}`)
}

if (existsSync(distRoot)) {
  removeTree(distRoot)
}

if (existsSync(distRoot)) {
  throw new Error(`failed to remove ${distRoot}`)
}

console.log(`cleaned ${distRoot}`)

function removeTree(target) {
  for (const entry of readdirSync(target, { withFileTypes: true })) {
    const entryPath = join(target, entry.name)
    if (entry.isDirectory()) {
      removeTree(entryPath)
      continue
    }
    unlinkSync(entryPath)
  }
  rmdirSync(target)
}
