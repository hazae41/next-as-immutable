import { NextConfig } from "next"

export function withNextAsImmutable(config: NextConfig): NextConfig {
  const { ...defaults } = config

  return {
    ...defaults,

    output: "export",

    generateBuildId() {
      return "immutable"
    },

    /**
     * This should work on Vercel even with `output: "export"`
     */
    async headers() {
      const headers = defaults.headers != null
        ? await defaults.headers()
        : []

      if (process.env.NODE_ENV !== "production")
        return headers

      const immutable = {
        source: "/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          }
        ]
      }

      return [...headers, immutable]
    },
  }
}