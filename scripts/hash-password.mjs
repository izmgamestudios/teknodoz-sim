// Usage:
//   node scripts/hash-password.mjs            -> reads password from stdin, prints ADMIN_PASSWORD_HASH line
//   node scripts/hash-password.mjs --generate [--length N] -> creates a random password (default 16 chars) and prints both
import { randomInt } from 'node:crypto'
import { hashPassword } from '../server/auth.mjs'

const CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%^&*-_=+'

let password
if (process.argv.includes('--generate')) {
  const i = process.argv.indexOf('--length')
  const length = i > 0 ? Number(process.argv[i + 1]) : 16
  if (!Number.isInteger(length) || length < 12 || length > 128) {
    console.error('--length must be an integer between 12 and 128.')
    process.exit(1)
  }
  password = Array.from({ length }, () => CHARS[randomInt(CHARS.length)]).join('')
  console.log(`PASSWORD=${password}`)
} else {
  const chunks = []
  for await (const c of process.stdin) chunks.push(c)
  password = Buffer.concat(chunks).toString().replace(/\r?\n$/, '')
  if (password.length < 12) {
    console.error('Password must be at least 12 characters.')
    process.exit(1)
  }
}
console.log(`ADMIN_PASSWORD_HASH=${hashPassword(password)}`)
