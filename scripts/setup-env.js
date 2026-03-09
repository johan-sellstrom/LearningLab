#!/usr/bin/env node
/*
 * Cross-platform helper to create local `.env` files from `example.env`.
 *
 * Why:
 * - Lab docs used `cp issuer/example.env issuer/.env`, which fails on Windows
 *   without a Unix-like shell.
 * - This keeps setup identical across macOS/Windows/Linux/Codespaces.
 *
 * Usage:
 *   node scripts/setup-env.js            # creates missing .env files
 *   node scripts/setup-env.js --force    # overwrites existing .env files
 *   node scripts/setup-env.js --quiet
 */

const fs = require('node:fs/promises')
const path = require('node:path')

const args = new Set(process.argv.slice(2))
const FORCE = args.has('--force')
const QUIET = args.has('--quiet')
const HELP = args.has('-h') || args.has('--help')

if (HELP) {
  console.log(`setup-env.js

Creates local .env files from example.env templates.

Options:
  --force   Overwrite existing .env files
  --quiet   Reduce output
  -h, --help`)
  process.exit(0)
}

const ROOT = path.resolve(__dirname, '..')

const targets = [
  { src: 'issuer/example.env', dest: 'issuer/.env' },
  { src: 'verifier/example.env', dest: 'verifier/.env' }
]

async function exists(p) {
  try {
    await fs.access(p)
    return true
  } catch {
    return false
  }
}

async function ensureEnv({ src, dest }) {
  const absSrc = path.join(ROOT, src)
  const absDest = path.join(ROOT, dest)

  if (!(await exists(absSrc))) {
    throw new Error(`Missing template file: ${src}`)
  }

  const destExists = await exists(absDest)
  if (destExists && !FORCE) {
    if (!QUIET) console.log(`[setup-env] keeping existing ${dest}`)
    return
  }

  await fs.copyFile(absSrc, absDest)
  if (!QUIET) console.log(`[setup-env] wrote ${dest}`)
}

async function main() {
  for (const t of targets) await ensureEnv(t)
}

main().catch((err) => {
  console.error('[setup-env] FAILED:', err?.message || err)
  process.exitCode = 1
})

