// Runs every *-check.mjs in this folder and sums the results.
//
//   npm run check
//
// These live in the repo on purpose. An earlier version of this harness
// lived in a temp directory and was lost wholesale when the session that
// made it ended, taking 27 suites with it.
import { readdirSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const only = process.argv[2]
const suites = readdirSync(here)
  .filter((f) => f.endsWith('-check.mjs'))
  .filter((f) => !only || f.includes(only))
  .sort()

if (suites.length === 0) {
  console.log(only ? `no suite matching "${only}"` : 'no suites found')
  process.exit(1)
}

let pass = 0
let fail = 0
for (const suite of suites) {
  const run = spawnSync(
    process.execPath,
    [
      '--experimental-strip-types',
      '--no-warnings',
      '--import',
      pathToFileURL(join(here, 'hook.mjs')).href,
      join(here, suite),
    ],
    { encoding: 'utf8' },
  )
  const out = `${run.stdout ?? ''}${run.stderr ?? ''}`
  const lines = out.split('\n')
  const p = lines.filter((l) => l.startsWith('PASS')).length
  const f = lines.filter((l) => l.startsWith('FAIL')).length
  pass += p
  fail += f
  const name = suite.replace('-check.mjs', '')
  if (f > 0 || p === 0) {
    console.log(`${name}: ${p} pass, ${f} FAIL`)
    for (const l of lines) {
      if (l.startsWith('FAIL') || /Error|error/.test(l)) console.log(`  ${l.trim()}`)
    }
  } else {
    console.log(`${name}: ${p} pass`)
  }
}

console.log(`\nTOTAL ${pass} pass, ${fail} fail across ${suites.length} suites`)
process.exit(fail > 0 || pass === 0 ? 1 : 0)
