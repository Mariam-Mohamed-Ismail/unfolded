import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'

/**
 * The project's first Vite config, and it exists for one reason: the solution
 * recorder (F2) runs in the browser, and a browser cannot write into src/.
 * So the dev server lends it two routes.
 *
 * Everything else is still Vite's defaults — root is the repo root, public/
 * is served at /, index.html is the entry point.
 *
 * Plain JS rather than TS on purpose: it uses node builtins, the project has
 * no @types/node, and tsconfig only covers src/ — so a .ts config would be
 * nothing but editor errors in a file the build never type-checks.
 */

const here = dirname(fileURLToPath(import.meta.url))
const DIR = resolve(here, 'src/game/solutions')
const REL = 'src/game/solutions'
/**
 * Room ids are short and lowercase ("1a", "2c"). Anything else is refused
 * rather than sanitised, so this endpoint can only ever name a file inside
 * the one directory — no separators, no dots, no traversal.
 */
const ROOM = /^[0-9a-z]{1,16}$/
/** A solution is a few KB; this is only here so a stream cannot run away. */
const MAX_BODY = 1 << 20

/**
 * Pretty, but with one event per line. Plain `JSON.stringify(x, null, 2)`
 * puts every element of every `[step, action, down]` triple on its own line,
 * which turns a five-second recording into a few thousand lines of diff.
 */
function format(sol) {
  const events = Array.isArray(sol.events) ? sol.events : []
  const rest = { ...sol }
  delete rest.events
  const head = JSON.stringify(rest, null, 2).replace(/\s*\}$/, '')
  const body = events.map((e) => `    ${JSON.stringify(e)}`).join(',\n')
  return `${head},\n  "events": [\n${body}${body ? '\n' : ''}  ]\n}\n`
}

function readBody(req) {
  return new Promise((done, fail) => {
    const chunks = []
    let size = 0
    req.on('data', (c) => {
      size += c.length
      if (size > MAX_BODY) {
        fail(new Error('body too large'))
        return
      }
      chunks.push(c)
    })
    req.on('end', () => done(Buffer.concat(chunks).toString('utf8')))
    req.on('error', () => fail(new Error('read failed')))
  })
}

/**
 * Recorded solutions, read and written over HTTP in dev only.
 *
 * @returns {import('vite').Plugin}
 */
function solutions() {
  return {
    name: 'unfolded-solutions',
    // Dev only. A built copy has no server, and F2 falls back to a download.
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/__solutions', (req, res, next) => {
        const room = (req.url ?? '').replace(/^\/+/, '').replace(/\?.*$/, '')
        if (!ROOM.test(room)) {
          res.statusCode = 400
          res.end('bad room id')
          return
        }
        const file = join(DIR, `${room}.json`)

        if (req.method === 'GET') {
          if (!existsSync(file)) {
            res.statusCode = 404
            res.end('no recording')
            return
          }
          res.setHeader('content-type', 'application/json')
          res.end(readFileSync(file, 'utf8'))
          return
        }

        if (req.method === 'POST') {
          readBody(req).then(
            (body) => {
              try {
                // Parsed and re-written, so a malformed POST cannot leave a
                // broken file behind and the result reads well in a diff.
                const sol = JSON.parse(body)
                if (sol.room !== room) throw new Error('room mismatch')
                mkdirSync(DIR, { recursive: true })
                writeFileSync(file, format(sol), 'utf8')
                server.config.logger.info(
                  `  solution recorded  ${REL}/${room}.json`,
                )
                res.setHeader('content-type', 'application/json')
                res.end(JSON.stringify({ path: `${REL}/${room}.json` }))
              } catch (err) {
                res.statusCode = 400
                res.end(err.message)
              }
            },
            (err) => {
              res.statusCode = 400
              res.end(err.message)
            },
          )
          return
        }

        next()
      })
    },
  }
}

export default defineConfig({
  plugins: [solutions()],
  server: {
    watch: {
      // Writing a recording must never reload the page in the middle of a
      // session. The files are fetched, not imported, so nothing needs to
      // know when they change.
      ignored: ['**/src/game/solutions/**'],
    },
  },
})
