import fs from 'node:fs'
import path from 'node:path'

const id = process.env.LIST_ID || '1'
const index = Number(process.env.BIT_INDEX || 0)

const filePath = path.resolve(process.cwd(), 'data', `${id}.json`)
if (!fs.existsSync(filePath)) {
  console.error('List not found. Run: pnpm --filter status-list generate')
  process.exit(1)
}

const data = JSON.parse(fs.readFileSync(filePath, 'utf8'))
const buf = Buffer.from(data.encodedList, 'base64')

const byteIndex = Math.floor(index / 8)
const bitOffset = index % 8
buf[byteIndex] ^= (1 << bitOffset)

data.encodedList = buf.toString('base64')
fs.writeFileSync(filePath, JSON.stringify(data, null, 2))
console.log(`[status-list] flipped bit ${index} in ${filePath}`)
