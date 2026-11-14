import { pathToFileURL } from 'node:url'
import { dirname, join } from 'node:path'

// Every `import 'phaser'` in the game resolves to the stub instead.
const STUB = pathToFileURL(
  join(dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), 'phaser-stub.mjs'),
).href

export async function resolve(specifier, context, next) {
  if (specifier === 'phaser') return { url: STUB, shortCircuit: true }
  return next(specifier, context)
}
