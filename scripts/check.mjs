// Local self-check for dsh-galgame-generator: syntax-check both halves,
// verify the bundle manifest wiring, and print package info.
//   node scripts/check.mjs
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const lib = path.join(root, 'lib')

function ok(name) { console.log('  ✓', name) }
function fail(name, err) { console.error('  ✗', name, '—', err?.message || err); process.exitCode = 1 }

console.log('dsh-galgame-generator self-check')

// 1. host / client syntax
for (const f of ['index.js', 'client.js']) {
  const p = path.join(lib, f)
  try {
    execFileSync(process.execPath, ['--check', p], { stdio: 'pipe' })
    ok(`lib/${f} parses`)
  } catch (e) {
    fail(`lib/${f}`, e.stderr?.toString() || e)
  }
}

// 2. manifest wiring
try {
  const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'))
  const host = path.join(root, pkg.main || '')
  if (!fs.existsSync(host)) throw new Error(`main -> ${pkg.main} missing`)
  const clientRel = (pkg.exports?.['./client']?.default || '').replace(/^\.\//, '')
  const client = path.join(root, clientRel)
  if (!fs.existsSync(client)) throw new Error(`exports["./client"] -> ${clientRel} missing`)
  if (!pkg.dsh?.bundle?.patch) throw new Error('dsh.bundle.patch missing')
  if (!fs.existsSync(path.join(root, pkg.dsh.bundle.patch))) throw new Error(`patch ${pkg.dsh.bundle.patch} missing`)
  if (pkg.dsh?.client?.platform !== 'web') throw new Error('dsh.client.platform must be web')
  ok(`manifest wiring (${pkg.name}@${pkg.version})`)
} catch (e) {
  fail('manifest', e)
}

// 3. client bundle registers via __ModuleLoader__
try {
  const c = fs.readFileSync(path.join(lib, 'client.js'), 'utf8')
  if (!c.includes('window.__ModuleLoader__.load')) throw new Error('client.js must call window.__ModuleLoader__.load')
  if (!/id:\s*'dsh-galgame-generator'/.test(c)) throw new Error('bundle id mismatch')
  ok('client bundle registers via __ModuleLoader__')
} catch (e) {
  fail('client bundle', e)
}

// 4. host exports plugin shape
try {
  const h = fs.readFileSync(path.join(lib, 'index.js'), 'utf8')
  for (const token of ['export const name', 'export const inject', 'export function apply']) {
    if (!h.includes(token)) throw new Error(`missing ${token}`)
  }
  ok('host exports name/inject/apply')
} catch (e) {
  fail('host exports', e)
}

console.log(process.exitCode ? 'FAILED' : 'ALL OK')
