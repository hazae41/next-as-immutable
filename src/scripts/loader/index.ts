import { Parent } from "@/libs/rpc"
import { Result } from "@hazae41/result"

/**
 * Return the unsafe page to crawlers because we want to be indexed as fast as possible, we don't care about security, and we don't know which APIs they support
 */
if (navigator.userAgent.match(/(bot|spider)/) == null) {

  if (parent !== window) {

    const protocol = await Result.runAndWrap(() => Parent.requestOrThrow<string>({
      method: "knock_knock"
    }, AbortSignal.timeout(100)))

    if (protocol.getOrNull() === "httpsec") {

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

      /**
       * Update policy to allow other scripts and workers to run
       */

      const policy = await Parent.requestOrThrow<string>({
        method: "csp_get"
      }, undefined)

      const policy2 = `script-src '${policy.match(/'([^']*)'/)?.[1]}' INJECT_SOURCES; worker-src 'self';`

      if (policy !== policy2)
        Parent.requestOrThrow<void>({
          method: "csp_set",
          params: [policy2]
        }, undefined).catch(console.error)

      /**
       * Show the HTML page
       */

      Parent.requestOrThrow<void>({
        method: "frame_show"
      }, undefined).catch(console.error)

      /**
       * Set the hash change listener to update the current href
       */

      addEventListener("hashchange", () => {
        Parent.requestOrThrow<void>({
          method: "href_set",
          params: [location.href]
        }, undefined).catch(console.error)
      })

      /**
       * Update the current href
       */

      Parent.requestOrThrow<void>({
        method: "href_set",
        params: [location.href]
      }, undefined).catch(console.error)

      /**
       * Define webapp manifest
       */

      Parent.requestOrThrow<boolean>({
        method: "manifest_set",
        params: ["INJECT_MANIFEST"]
      }, undefined).catch(console.error)
    }
  }
}