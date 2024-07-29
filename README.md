# Next.js as Immutable

Create [immutable](https://github.com/hazae41/immutable) Next.js webapps that are secure and resilient.

```bash
npm i -D @hazae41/next-as-immutable
```

[**Node Package 📦**](https://www.npmjs.com/package/@hazae41/next-as-immutable)

## Examples

Here is a list of immutable Next.js webapps

- https://dstorage.hazae41.me/v0 / https://github.com/hazae41/dstorage

## Setup

Install [`@hazae41/immutable`](https://github.com/hazae41/immutable)

```bash
npm i @hazae41/immutable
```

Install `@hazae41/next-as-immutable` as `devDependencies`

```bash
npm i -D @hazae41/next-as-immutable
```

Modify your `package.json` to add `node ./scripts/build.mjs` in order to postprocess each production build

```json
"scripts": {
  "dev": "next dev",
  "build": "next build && node ./scripts/build.mjs",
  "start": "npx serve --config ../serve.json ./out",
  "lint": "next lint"
},
```

Modify your `next.config.js` to build your service-worker

```js
const path = require("path")
const TerserPlugin = require("terser-webpack-plugin")
const { NextAsImmutable, withImmutable } = require("@hazae41/next-as-immutable")

async function compileServiceWorker(wpconfig) {
  await NextAsImmutable.compile({
    /**
     * Just for logs
     */
    name: "service_worker",

    /**
     * DNTUYKWYD
     */
    devtool: false,
    target: "webworker",
    mode: wpconfig.mode,
    resolve: wpconfig.resolve,
    resolveLoader: wpconfig.resolveLoader,
    module: wpconfig.module,
    plugins: wpconfig.plugins,

    /**
     * Your service-worker source code
     */
    entry: "./src/mods/scripts/service_worker/index.ts",

    output: {
      /**
       * DNTUYKWYD
       */
      path: path.join(process.cwd(), ".webpack"),

      /**
       * You can rename it or put it in a subfolder (always keep `.latest.js` e.g. `./v1/sw.latest.js`)
       */
      filename: "./service_worker.latest.js"
    },

    /**
     * You MAY disable this
     */
    optimization: {
      minimize: true,
      minimizer: [new TerserPlugin()]
    }
  })
}

module.exports = withImmutable({
  compiles: function* (wpconfig) {
    yield compileServiceWorker(wpconfig)
  }
})

```

Create a `./serve.json` file with this content

```json
{
  "headers": [
    {
      "source": "**/*",
      "headers": [
        {
          "key": "Cache-Control",
          "value": "public, max-age=31536000, immutable"
        }
      ]
    }
  ]
}
```

Create a `./public/start.html` file with this content

```html
<!DOCTYPE html>
<html>

<head>
  <title>Loading...</title>
  <script type="module">
    try {
      const latestScriptUrl = new URL(`/service_worker.latest.js`, location.href)
      const latestScriptRes = await fetch(latestScriptUrl, { cache: "reload" })

      if (!latestScriptRes.ok)
        throw new Error(`Failed to fetch latest service-worker`)
      if (latestScriptRes.headers.get("cache-control") !== "public, max-age=31536000, immutable")
        throw new Error(`Wrong Cache-Control header for latest service-worker`)

      const { pathname } = latestScriptUrl

      const filename = pathname.split("/").at(-1)
      const basename = filename.split(".").at(0)

      const latestHashBytes = new Uint8Array(await crypto.subtle.digest("SHA-256", await latestScriptRes.arrayBuffer()))
      const latestHashRawHex = Array.from(latestHashBytes).map(b => b.toString(16).padStart(2, "0")).join("")
      const latestVersion = latestHashRawHex.slice(0, 6)

      const latestVersionScriptPath = `${basename}.${latestVersion}.js`
      const latestVersionScriptUrl = new URL(latestVersionScriptPath, latestScriptUrl)

      localStorage.setItem("service_worker.current.version", JSON.stringify(latestVersion))

      await navigator.serviceWorker.register(latestVersionScriptUrl, { updateViaCache: "all" })
      await navigator.serviceWorker.ready

      location.reload()
    } catch (e) {
      console.error(e)

      alert(`Failed to load the latest version of the webapp.`)

      return
    }
  </script>
</head>

</html>
```

Create a `./scripts/build.mjs` file with this content

```tsx
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
  if (pathname === `./out/start.html`)
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
  if (pathname === `./out/service_worker.latest.js`)
    continue

  const dirname = path.dirname(pathname)
  const filename = path.basename(pathname)

  if (fs.existsSync(`./${dirname}/_${filename}`))
    continue
  if (filename.endsWith(".html") && fs.existsSync(`./${dirname}/_${filename.slice(0, -5)}/index.html`))
    continue
  if (!filename.endsWith(".html") && fs.existsSync(`./${dirname}/_${filename}/index`))
    continue

  const text = fs.readFileSync(pathname)
  const hash = crypto.createHash("sha256").update(text).digest("hex")

  const relative = path.relative(`./out`, pathname)

  files.push([`/${relative}`, hash])
}

/**
 * Inject `files` into the service-worker and version it
 */

const original = fs.readFileSync(`./out/service_worker.latest.js`, "utf8")
const replaced = original.replaceAll("FILES", JSON.stringify(files))

const version = crypto.createHash("sha256").update(replaced).digest("hex").slice(0, 6)

fs.writeFileSync(`./out/service_worker.latest.js`, replaced, "utf8")
fs.writeFileSync(`./out/service_worker.${version}.js`, replaced, "utf8")
```

Add this glue code to your service-worker

```tsx
import { Immutable } from "@hazae41/immutable"

declare const self: ServiceWorkerGlobalScope

self.addEventListener("install", (event) => {
  /**
   * Auto-activate as the update was already accepted
   */
  self.skipWaiting()
})

/**
 * Declare global template
 */
declare const FILES: [string, string][]

/**
 * Only cache on production
 */
if (process.env.NODE_ENV === "production") {
  const cache = new Immutable.Cache(new Map(FILES))

  self.addEventListener("activate", (event) => {
    /**
     * Uncache previous version
     */
    event.waitUntil(cache.uncache())

    /**
     * Precache current version
     */
    event.waitUntil(cache.precache())
  })

  /**
   * Respond with cache
   */
  self.addEventListener("fetch", (event) => cache.handle(event))
}
```

Use `Immutable.register(pathOrUrl)` to register your service-worker in your code

e.g. If you were doing this

```tsx
await navigator.serviceWorker.register("/service_worker.js")
```

You now have to do this (always use `.latest.js`)

```tsx
await Immutable.register("/service_worker.latest.js")
```

You can use the returned async function to update your app

```tsx
navigator.serviceWorker.addEventListener("controllerchange", () => location.reload())

const update = await Immutable.register("/service_worker.latest.js")

if (update != null) {
  /**
   * Update available
   */
  button.onclick = async () => await update()
  return
}

await navigator.serviceWorker.ready
```

You now have an immutable but updatable Next.js app!