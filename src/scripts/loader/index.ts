import { Parent } from "@/libs/rpc"
import { Result } from "@hazae41/result"

/**
 * Return the unsafe page to crawlers because we want to be indexed as fast as possible, we don't care about security, and we don't know which APIs they support
 */
if (navigator.userAgent.match(/(bot|spider)/) == null) {

  /**
   * Check HTML integrity to ensure visible content is not tampered with
   */

  const final = `<!DOCTYPE html>${document.documentElement.outerHTML}`

  const inter = final
    .replaceAll("INJECT_HTML_HASH", "DUMMY_HASH")
    .replaceAll("/>", ">")
    .replaceAll("\n", "")
    .replaceAll("\r", "")
    .replaceAll(" ", "")
    .toLowerCase()

  const hash = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(inter)))
  const hexa = hash.reduce((acc, byte) => acc + byte.toString(16).padStart(2, "0"), "")

  if (hexa !== "INJECT_HTML_HASH")
    throw new Error(`Invalid hash. Expected ${"INJECT_HTML_HASH"} but computed ${hexa}.`)

  if (parent !== window) {

    const httpsec = await Result.runAndWrap(() => Parent.requestOrThrow<boolean>({
      method: "httpsec_ping"
    }, AbortSignal.timeout(100)))

    if (httpsec.isOk()) {

      /**
       * Define manifest
       */

      await Parent.requestOrThrow<boolean>({
        method: "manifest_set",
        params: ["INJECT_MANIFEST"]
      }, AbortSignal.timeout(100))

      /**
       * Update policy to allow other scripts and workers to run
       */

      const policy = await Parent.requestOrThrow<string>({
        method: "csp_get"
      }, AbortSignal.timeout(100))

      const mysource = policy.match(/'([^']*)'/)?.[1]

      const expected = `script-src '${mysource}' INJECT_SOURCES; worker-src 'self';`

      if (policy !== expected) {
        await Parent.requestOrThrow<void>({
          method: "csp_set",
          params: [expected]
        }, AbortSignal.timeout(100))

        throw new Error()
      }

      /**
       * Set the hash change listener to update the parent with the current hash
       */

      addEventListener("hashchange", () => {
        Parent.requestOrThrow<void>({
          method: "href_set",
          params: [location.href]
        }, AbortSignal.timeout(100)).catch(console.error)
      })

      /**
       * Ready to show the HTML page
       */

      await Parent.requestOrThrow<void>({
        method: "frame_show"
      }, AbortSignal.timeout(100))
    }
  }
}