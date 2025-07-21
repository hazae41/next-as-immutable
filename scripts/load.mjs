await (async () => {
  try {
    /**
     * Return the unsafe page to crawlers because we want to be indexed as fast as possible, we don't care about security, and we don't know which APIs they support
     */
    if (navigator.userAgent.match(/(bot|spider)/) != null) {
      const html = atob("INJECT_PAGE")

      document.open()
      document.write(html)
      document.close()

      return
    }

    /**
     * Update HTTPSec policy to allow the service worker
     */
    if (parent !== window) {
      parent.postMessage([{ method: "httpsec_get" }], "*")

      const policy = await new Promise(ok => addEventListener("message", ok, { once: true })).then(r => r.data[0].result)

      const myself = policy.match(/'([^']*)'/)?.[1]

      if (policy !== `script-src '${myself}'; worker-src 'self';`) {
        parent.postMessage([{ method: "httpsec_set", params: [`script-src '${myself}'; worker-src 'self';`] }], "*")

        await new Promise(ok => addEventListener("message", ok, { once: true }))

        return
      }

      // PASS
    }

    /**
     * Check HTML integrity by computing the hash of the HTML and comparing it to the precomputed value, this is safe because the integrity of this script has already been checked.
     */
    {
      const final = `<!DOCTYPE html><html>${document.documentElement.innerHTML}</html>`

      const inter = final
        .replaceAll("INJECT_HASH", "DUMMY_HASH")
        .replaceAll("\n", "")
        .replaceAll("\r", "")
        .replaceAll(" ", "")

      const hash = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(inter)))
      const hexa = hash.reduce((acc, byte) => acc + byte.toString(16).padStart(2, "0"), "")

      if (hexa !== "INJECT_HASH")
        throw new Error(`Invalid hash. Expected ${"INJECT_HASH"} but computed ${hexa}.`)

      // PASS
    }

    const latestScriptUrl = new URL(`/service_worker.latest.js`, location.href)
    const latestScriptRes = await fetch(latestScriptUrl, { cache: "reload" })

    if (!latestScriptRes.ok)
      throw new Error(`Failed to fetch latest service-worker`, { cause: latestScriptRes.status })

    const cache = latestScriptRes.headers.get("cache-control")

    if (!cache?.includes("immutable"))
      alert("This website is not distributed as immutable. Use it at your own risk.")

    const ttl = cache?.split(",").map(s => s.trim()).find(s => s.startsWith("max-age="))?.split("=").at(-1)

    if (ttl !== "31536000")
      alert("This website is distributed with a time-to-live of less than 1 year. Use it at your own risk.")

    const { pathname } = latestScriptUrl

    const filename = pathname.split("/").at(-1)
    const basename = filename.split(".").at(0)

    const latestHashBytes = new Uint8Array(await crypto.subtle.digest("SHA-256", await latestScriptRes.arrayBuffer()))
    const latestHashRawHex = Array.from(latestHashBytes).map(b => b.toString(16).padStart(2, "0")).join("")
    const latestVersion = latestHashRawHex.slice(0, 6)

    const latestVersionScriptPath = `${basename}.${latestVersion}.js`
    const latestVersionScriptUrl = new URL(latestVersionScriptPath, latestScriptUrl)

    /**
     * Register the service worker (it will verify and cache all pages)
     */
    localStorage.setItem("service_worker.current.version", JSON.stringify(latestVersion))

    await navigator.serviceWorker.register(latestVersionScriptUrl.href, { updateViaCache: "all" })
    await navigator.serviceWorker.ready

    /**
     * Use the service worker version of this page
     */
    location.reload()
  } catch (error) {
    console.error(error)

    alert(`An error occurred when loading this website. Please try again later.`)

    return
  }
})()