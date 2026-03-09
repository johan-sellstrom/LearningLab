#!/usr/bin/env node
/*
 * Fail fast if the wrong Node.js major version is used.
 *
 * We recommend Node.js 20.x for workshop consistency.
 * The project now supports modern Node majors (20+) by using the WASM-capable
 * @mattrglobal/bbs-signatures package.
 */

const major = Number(process.versions.node.split('.')[0] || 0)

if (process.env.SKIP_NODE_VERSION_CHECK === '1') {
  process.exit(0)
}

if (major < 20) {
  console.error('')
  console.error(`[node] Node.js 20+ is required for this lab. Detected: ${process.version}`)
  console.error('')
  console.error('Fix options:')
  console.error('- macOS (recommended):  ./scripts/bootstrap-mac.sh')
  console.error('- Windows (recommended): powershell -ExecutionPolicy Bypass -File .\\scripts\\bootstrap-windows.ps1')
  console.error('- Manual: macOS: brew install node@20 && brew link --overwrite --force node@20')
  console.error('- Manual: Windows: winget install -e --id OpenJS.NodeJS.20')
  console.error('- No local installs: use GitHub Codespaces / Dev Containers (.devcontainer/)')
  console.error('')
  console.error('If you are an instructor and know what you are doing, set SKIP_NODE_VERSION_CHECK=1.')
  process.exit(1)
}

if (major !== 20) {
  console.warn('')
  console.warn(`[node] Detected ${process.version}. Node.js 20.x is recommended for workshop parity.`)
  console.warn('')
}
