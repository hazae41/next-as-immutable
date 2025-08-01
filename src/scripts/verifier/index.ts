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