import fs from 'node:fs/promises'
import path from 'node:path'

export async function ensureDir(dirPath) {
  await fs.mkdir(dirPath, { recursive: true })
}

export async function readText(filePath) {
  return fs.readFile(filePath, 'utf8')
}

export async function readJson(filePath) {
  return JSON.parse(await readText(filePath))
}

export async function writeText(filePath, content) {
  await ensureDir(path.dirname(filePath))
  await fs.writeFile(filePath, content, 'utf8')
}

export async function writeJson(filePath, value) {
  await writeText(filePath, `${JSON.stringify(value, null, 2)}\n`)
}

export async function fileExists(filePath) {
  try {
    await fs.access(filePath)
    return true
  } catch {
    return false
  }
}

export function absoluteFrom(baseDir, maybeRelative) {
  if (!maybeRelative) return maybeRelative
  if (path.isAbsolute(maybeRelative)) return maybeRelative
  return path.resolve(baseDir, maybeRelative)
}
