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
 * Inject magic script into all .html files
 */

const magic = fs.readFileSync("./scripts/magic.min.mjs", "utf8")

for (const pathname of walkSync(`./out`)) {
  const filename = path.basename(pathname)

  if (!filename.endsWith(".html"))
    continue

  const begin = fs.readFileSync(pathname, "utf8")
    .replaceAll("<head>", `<head><script type="module">${magic}</script>`)

  const inter = begin
    .replaceAll("INJECT_HASH", "DUMMY_HASH")
    .replaceAll("/>", ">")
    .replaceAll("\n", "")
    .replaceAll("\r", "")
    .replaceAll(" ", "")
    .toLowerCase()

  const hash = crypto.createHash("sha256").update(inter).digest("hex")

  const final = begin.replaceAll("INJECT_HASH", hash)

  fs.writeFileSync(pathname, final, "utf8")
}

/**
 * Find files to cache and compute their hash
 */

const files = new Array()

for (const pathname of walkSync(`./out`)) {
  if (pathname === `out/service_worker.latest.js`)
    continue

  const relative = path.relative(`./out`, pathname)

  const text = fs.readFileSync(pathname)
  const hash = crypto.createHash("sha256").update(text).digest("base64")

  files.push([`/${relative}`, `sha256-${hash}`])
}

/**
 * Inject `files` into the service-worker and version it
 */

const original = fs.readFileSync(`./out/service_worker.latest.js`, "utf8")
const replaced = original.replaceAll("FILES", JSON.stringify(files))

const version = crypto.createHash("sha256").update(replaced).digest("hex").slice(0, 6)

fs.writeFileSync(`./out/service_worker.latest.js`, replaced, "utf8")
fs.writeFileSync(`./out/service_worker.${version}.js`, replaced, "utf8")