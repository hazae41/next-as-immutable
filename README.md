# Next.js as Immutable

An [immutable](https://github.com/hazae41/immutable) Next.js webapp starter

```bash
git clone https://github.com/hazae41/next-as-immutable.git
```

## Examples

Here is a list of immutable Next.js webapps

- https://wallet.brume.money / https://github.com/brumeproject/wallet

## Migrate

You can migrate an existing Next.js webapp by following these steps

Install [`@hazae41/immutable`](https://github.com/hazae41/immutable)

```bash
npm i @hazae41/immutable
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

const { registration, update } = await Immutable.register("/service_worker.latest.js")

if (update != null) {
  /**
   * Update available
   */
  button.onclick = async () => await update()
  return
}

await navigator.serviceWorker.ready
```

Create a `verifier.js` file with this content

```tsx
export { }

/**
 * Return the unsafe page to crawlers because we want to be indexed as fast as possible, we don't care about security, and we don't know which APIs they support
 */
if (navigator.userAgent.match(/(bot|spider)/) == null) {

  /**
   * Update CSP policy to allow the service worker
   */
  if (parent !== window) {
    parent.postMessage([{ method: "csp_get" }], "*")

    const policy = await new Promise(ok => addEventListener("message", ok, { once: true })).then((r: any) => r.data[0].result)

    const myself = policy.match(/'([^']*)'/)?.[1]

    if (policy !== `script-src '${myself}' INJECT_SOURCES; worker-src 'self';`) {
      parent.postMessage([{ method: "csp_set", params: [`script-src '${myself}' INJECT_SOURCES; worker-src 'self';`] }], "*")

      await new Promise(ok => addEventListener("message", ok, { once: true }))
    }
  }

  /**
   * Check HTML integrity by computing the hash of the HTML and comparing it to the precomputed value, this is safe because the integrity of this script has already been checked.
   */
  if (parent !== window) {
    const final = `<!DOCTYPE html>${document.documentElement.outerHTML}`

    const inter = final
      .replaceAll("INJECT_HASH", "DUMMY_HASH")
      .replaceAll("/>", ">")
      .replaceAll("\n", "")
      .replaceAll("\r", "")
      .replaceAll(" ", "")
      .toLowerCase()

    const hash = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(inter)))
    const hexa = hash.reduce((acc, byte) => acc + byte.toString(16).padStart(2, "0"), "")

    if (hexa !== "INJECT_HASH")
      throw new Error(`Invalid hash. Expected ${"INJECT_HASH"} but computed ${hexa}.`)

    parent.postMessage([{ method: "html_show" }], "*")
  }

  // NOOP
}
```

Create a `builder.js` file with this content

```tsx
import { walkSync } from "@/libs/walk";
import crypto from "crypto";
import fs from "fs";
import { JSDOM } from "jsdom";
import path from "path";

const { window } = new JSDOM(`<!DOCTYPE html><body></body>`);

globalThis.DOMParser = window.DOMParser
globalThis.XMLSerializer = window.XMLSerializer

/**
 * Inject magic script into all .html files
 */

const verifier = fs.readFileSync("./verifier.js", "utf8")

for (const pathname of walkSync(`./out`)) {
  const filename = path.basename(pathname)

  if (!filename.endsWith(".html"))
    continue

  const document = new DOMParser().parseFromString(fs.readFileSync(pathname, "utf8"), "text/html")

  const scripts = document.querySelectorAll("script")

  const sources = new Array()

  for (const script of scripts) {
    if (script.src) {
      const text = fs.readFileSync(path.join("./out", script.src), "utf8")
      const hash = crypto.createHash("sha256").update(text).digest("base64")

      script.setAttribute("integrity", `sha256-${hash}`)

      sources.push(`'sha256-${hash}'`);
    } else {
      const text = script.textContent || "";
      const hash = crypto.createHash("sha256").update(text).digest("base64");

      script.setAttribute("integrity", `sha256-${hash}`);

      sources.push(`'sha256-${hash}'`);
    }
  }

  const begin = new XMLSerializer().serializeToString(document)
    .replaceAll("<head>", `<head><script type="module">${verifier.replaceAll("INJECT_SOURCES", sources.join(" "))}</script>`)

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
  const filename = path.basename(pathname)

  if (filename === "service_worker.latest.js")
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
```

Modify your `package.json` to run your `builder.js` file in order to postprocess each production build

```json
"scripts": {
  "dev": "next dev",
  "build": "next build && node ./builder.js",
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
    if (process.env.NODE_ENV !== "production")
      return []
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
  ]
}
```


You now have an immutable but updatable Next.js app!
