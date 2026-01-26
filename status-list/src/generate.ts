import fs from 'node:fs'
import path from 'node:path'

const id = process.env.LIST_ID || '1'
const sizeBits = Number(process.env.LIST_SIZE_BITS || 1024 * 8) // 8192 bits default

const bytesLen = Math.ceil(sizeBits / 8)
const buf = Buffer.alloc(bytesLen)
const encoded = buf.toString('base64')

const outDir = path.resolve(process.cwd(), 'data')
fs.mkdirSync(outDir, { recursive: true })

const outPath = path.join(outDir, `${id}.json`)
const payload = {
  statusPurpose: 'revocation',
  bitstringLength: sizeBits,
  encodedList: encoded
}

fs.writeFileSync(outPath, JSON.stringify(payload, null, 2))
console.log(`[status-list] wrote ${outPath} (${sizeBits} bits)`) 
