# Next.js as Immutable

An [immutable](https://github.com/hazae41/immutable) Next.js webapp starter

```bash
git clone https://github.com/hazae41/next-as-immutable.git
```

## Examples

Here is a list of immutable Next.js webapps

- https://wallet.brume.money / https://github.com/brumewallet/wallet

## Migrate

You can migrate an existing Next.js webapp by following these steps

Install [`@hazae41/immutable`](https://github.com/hazae41/immutable)

```bash
npm i @hazae41/immutable
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

Modify your `next.config.js` to use exported build, immutable build ID, and immutable Cache-Control headers

```js
module.exports = {
  /**
   * Recommended in order to output the webapp as HTML
   */
  output: "export",

  /**
   * Recommended in order to get deterministic build ID
   */
  generateBuildId() {
    return "immutable"
  },

  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          /**
           * Recommended in order to be embedded with strong restrictions
           */
          {
            key: "Allow-CSP-From",
            value: "*"
          },
          /**
           * Mandatory in order to get almost immutable caching
           */
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          }
        ]
      }
    ]
  },

  async rewrites() {
    return {
      beforeFiles: [
        /**
         * Recommended in order to keep a good SEO
         */
        {
          source: "/",
          has: [
            {
              type: "header",
              key: "user-agent",
              value: ".*(bot|spider).*"
            }
          ],
          destination: "/_index"
        }
      ]
    }
  }
}
```

Create a `./serve.json` file with this content

```json
{
  "headers": [
    {
      "source": "**/*",
      "headers": [
        {
          "key": "Allow-CSP-From",
          "value": "*"
        },
        {
          "key": "Cache-Control",
          "value": "public, max-age=31536000, immutable"
        }
      ]
    }
  ],
  "rewrites": [
    {
      "source": "/",
      "headers": {
        "user-agent": ".*(bot|spider).*"
      },
      "destination": "/_index.html"
    }
  ]
}
```

You can build your service-worker with [NextSidebuild](https://github.com/hazae41/next-sidebuild)

Just name your service-worker like `<name>.js` and put it in the `./public` folder

Add this glue code to your service-worker

```tsx
import { Immutable } from "@hazae41/immutable"

declare const self: ServiceWorkerGlobalScope

self.addEventListener("install", () => {
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

Create a `./public/start.html` file with this content

```html
<!DOCTYPE html>
<html>

<head>
  <style>
    html {
      height: 100%;
      width: 100%;
    }

    body {
      height: 100%;
      width: 100%;
      display: flex;
      justify-content: center;
      align-items: center;
      overflow: hidden;
    }

    @media (prefers-color-scheme: dark) {
      body {
        background-color: #000;
      }
    }
  </style>
  <script type="module">
    try {
      const latestScriptUrl = new URL(`/service_worker.latest.js`, location.href)
      const latestScriptRes = await fetch(latestScriptUrl, { cache: "reload" })

      if (!latestScriptRes.ok)
        throw new Error(`Failed to fetch latest service-worker`)

      const cache = latestScriptRes.headers.get("cache-control")

      if (!cache?.includes("immutable"))
        alert("This webapp is not distributed as immutable. Use it at your own risk.")

      const ttl = cache?.split(",").map(s => s.trim()).find(s => s.startsWith("max-age="))?.split("=").at(-1)

      if (ttl !== "31536000")
        alert("This webapp is distributed with a time-to-live of less than 1 year. Use it at your own risk.")

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
    } catch (error) {
      console.error(error)

      alert(`An error occurred when loading this website. Please try again later.`)
    }
  </script>
</head>

<body>
  <img style="width: 100px; height: 100px;" src="/favicon.png" alt="favicon" />
</body>

</html>
```

And put your webapp icon in `./public/favicon.png`

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
