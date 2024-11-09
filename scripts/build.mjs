import crypto from "crypto"
import fs from "fs"
import path from "path"

export function* walkSync(dir) {
  const files = fs.readdirSync(dir, { withFileTypes: true })

  for (const file of files) {
    if (file.isDirectory()) {
      yield* walkSync(path.join(dir, file.name))
    } else {
      yield path.join(dir, file.name)
    }
  }
}

/**
 * Replace all .html files by start.html
 */

for (const pathname of walkSync(`./out`)) {
  if (pathname === `out/start.html`)
    continue

  const dirname = path.dirname(pathname)
  const filename = path.basename(pathname)

  if (!filename.endsWith(".html"))
    continue

  fs.copyFileSync(pathname, `./${dirname}/_${filename}`)
  fs.copyFileSync(`./out/start.html`, pathname)
}

fs.rmSync(`./out/start.html`)

/**
 * Find files to cache and compute their hash
 */

const files = new Array()

for (const pathname of walkSync(`./out`)) {
  if (pathname === `out/service_worker.js`)
    continue

  const dirname = path.dirname(pathname)
  const filename = path.basename(pathname)

  if (fs.existsSync(`./${dirname}/_${filename}`))
    continue
  if (filename.endsWith(".html") && fs.existsSync(`./${dirname}/_${filename.slice(0, -5)}/index.html`))
    continue
  if (!filename.endsWith(".html") && fs.existsSync(`./${dirname}/_${filename}/index`))
    continue

  const relative = path.relative(`./out`, pathname)

  const text = fs.readFileSync(pathname)
  const hash = crypto.createHash("sha256").update(text).digest("hex")

  files.push([`/${relative}`, hash])
}

/**
 * Inject `files` into the service-worker and version it
 */

const original = fs.readFileSync(`./out/service_worker.js`, "utf8")
const replaced = original.replaceAll("FILES", JSON.stringify(files))

const version = crypto.createHash("sha256").update(replaced).digest("hex").slice(0, 6)

fs.writeFileSync(`./out/service_worker.js`, replaced, "utf8")
fs.writeFileSync(`./out/service_worker.latest.js`, replaced, "utf8")
fs.writeFileSync(`./out/service_worker.${version}.js`, replaced, "utf8")