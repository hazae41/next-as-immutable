import { Parent } from "@/libs/rpc"
import { Result } from "@hazae41/result"

/**
 * Return the unsafe page to crawlers because we want to be indexed as fast as possible, we don't care about security, and we don't know which APIs they support
 */
if (navigator.userAgent.match(/(bot|spider)/) == null) {

  if (parent !== window) {
    const timeout = AbortSignal.timeout(100)

    const result = await Result.runAndWrap(() => Parent.requestOrThrow<[string]>({
      method: "csp_get"
    }, timeout))

    /**
     * HTTPSec feature detected
     */

    if (result.isOk()) {

      /**
       * Update policy to allow other scripts and workers to run
       */

      const [policy] = result.getOrThrow()

      const selfsrc = policy.match(/'([^']*)'/)?.[1]
      const expected = `script-src '${selfsrc}' INJECT_SOURCES; worker-src 'self';`

      if (policy !== expected) {
        const timeout = AbortSignal.timeout(100)

        await Parent.requestOrThrow<void>({
          method: "csp_set",
          params: [expected]
        }, timeout)

        location.reload()
      }

      /**
       * Check HTML integrity to ensure visible content is not tampered with
       */

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

      const timeout = AbortSignal.timeout(100)

      await Parent.requestOrThrow<void>({
        method: "html_show"
      }, timeout)
    }
  }
}