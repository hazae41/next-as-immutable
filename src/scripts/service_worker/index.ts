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