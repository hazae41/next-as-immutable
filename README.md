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

Install `@hazae41/immutable`

```bash
npm i @hazae41/immutable
```

Install `@hazae41/next-as-immutable` and `@hazae41/saumon` as `devDependencies`

```bash
npm i -D @hazae41/next-as-immutable
```

```bash
npm i -D @hazae41/saumon
```

Modify your `next.config.js` to build and hash your service-worker

```js
const TerserPlugin = require("terser-webpack-plugin")
const path = require("path")
const { NextAsImmutable, withImmutable } = require("@hazae41/next-as-immutable")
const fs = require("fs")

function* walkSync(directory) {
  const files = fs.readdirSync(directory, { withFileTypes: true }).sort((a, b) => a.name > b.name ? 1 : -1)

  for (const file of files) {
    if (file.isDirectory()) {
      yield* walkSync(path.join(directory, file.name))
    } else {
      yield path.join(directory, file.name)
    }
  }
}

async function compileServiceWorker(wpconfig) {
  await NextAsImmutable.compileAndVersionAsMacro({
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
       * You can rename it or put it in a subfolder (always keep `.latest.js`)
       * e.g. `"./v1/sw.latest.js"`
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
  /**
   * Recommended
   */
  output: "export",

  compiles: function* (wpconfig) {
    for (const absolute of walkSync("./public")) {
      const filename = path.basename(absolute)

      /**
       * You should modify this if you renamed your service-worker
       */
      if (filename.startsWith("service_worker."))
        fs.rmSync(absolute, { force: true })

      continue
    }

    yield compileServiceWorker(wpconfig)
  }
})

```

Modify your `package.json` to add `saumon build -r ./out` in order to postprocess each production build

```json
"scripts": {
  "dev": "next dev",
  "build": "next build && saumon build -r ./out",
  "start": "npx serve@latest out",
  "lint": "next lint"
},
```

Add this glue code to your service-worker

```tsx
import { Immutable } from "@hazae41/immutable"

/**
 * Declare global macro
 */
declare function $raw$<T>(script: string): T

/**
 * Only cache on production
 */
if (process.env.NODE_ENV === "production") {
  /**
   * Use $raw$ to avoid minifiers from mangling the code
   */
  const files = $raw$<[string, string][]>(`$run$(async () => {
    const fs = await import("fs")
    const path = await import("path")
    const crypto = await import("crypto")
  
    function* walkSync(dir) {
      const files = fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name > b.name ? 1 : -1)
  
      for (const file of files) {
        if (file.isDirectory()) {
          yield* walkSync(path.join(dir, file.name))
        } else {
          yield path.join(dir, file.name)
        }
      }
    }
  
    const files = new Array()
  
    for (const absolute of walkSync("./out")) {
      const filename = path.basename(absolute)
  
      /**
       * Do not cache saumon files
       */
      if (filename.endsWith(".saumon.js"))
        continue
      
      /**
       * Do not cache service-workers
       */
      if (filename.startsWith("service_worker."))
        continue

      /**
       * Do not cache bootpages
       */
      if (filename.endsWith(".html") && !filename.startsWith("_"))
        continue
  
      const text = fs.readFileSync(absolute)
      const hash = crypto.createHash("sha256").update(text).digest("hex")
  
      const relative = path.relative("./out", absolute)
  
      files.push([\`/\${relative}\`, hash])
    }
  
    return files
  }, { space: 0 })`)

  const cache = new Immutable.Cache(new Map(files))

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

Rename all your `pages` with a `_` before (e.g. `./pages/example/posts.tsx` -> `./pages/example/_posts.tsx`)

And create a `.html` file with the original page name and same folder structure in `public` (e.g. `./pages/example/posts.tsx` -> `./public/example/posts.html`) with the following content

```html
<!DOCTYPE html>
<html>
<head>
    <title>Loading...</title>
    <script type="module">
        const latestScriptUrl = new URL(`/service_worker.latest.js`, location.href)
        const latestScriptRes = await fetch(latestScriptUrl, { cache: "reload" })

        if (!latestScriptRes.ok)
          throw new Error(`Failed to fetch latest service-worker`)

        const { pathname } = latestScriptUrl 

        const filename = pathname.split("/").at(-1)
        const basename = filename.split(".").at(0)

        const latestHashBytes = new Uint8Array(await crypto.subtle.digest("SHA-256", await latestScriptRes.arrayBuffer()))
        const latestHashRawHex = Array.from(latestHashBytes).map(b => b.toString(16).padStart(2, "0")).join("")
        const latestVersion = latestHashRawHex.slice(0, 6)

        const latestVersionScriptPath = `${basename}.${latestVersion}.js`
        const latestVersionScriptUrl = new URL(latestVersionScriptPath, latestScriptUrl)

        await navigator.serviceWorker.register(latestVersionScriptUrl, { updateViaCache: "all" })
        await navigator.serviceWorker.ready

        location.reload()
    </script>
</html>
```

I recommend using a virtual path (e.g. hash-based routing) to avoid creating a bootpage for each page

e.g. Not `https://example.com/example/posts` but `https://example.com/#/example/posts`

Use `Immutable.register()` to register your service-worker in your code

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