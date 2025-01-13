import { NextSidebuild, withNextSidebuild } from "@hazae41/next-sidebuild";
import type { NextConfig } from "next";
import path from "node:path";

async function compileServiceWorker(wpconfig: any) {
  await NextSidebuild.compile({
    /**
     * Name of your script for display on logs
     */
    name: "service_worker",

    /**
     * Use "webworker" for in-worker scripts or "web" for in-page scripts
     */
    target: "webworker",

    /**
     * Your script source code path
     */
    entry: "./src/scripts/service_worker/index.ts",

    output: {
      /**
       * Output file relative to `./out`
       */
      filename: "./service_worker.js",

      /**
       * DNTUYKWYD
       */
      path: path.join(process.cwd(), ".webpack")
    },

    /**
     * Use same config as Next.js
     */
    mode: wpconfig.mode,
    resolve: wpconfig.resolve,
    resolveLoader: wpconfig.resolveLoader,
    module: wpconfig.module,
    plugins: wpconfig.plugins,

    /**
     * Configure minimizer
     */
    optimization: {
      minimize: true,
      minimizer: wpconfig.optimization.minimizer
    },

    /**
     * DNTUYKWYD
     */
    devtool: false,
  })
}

const nextConfig: NextConfig = withNextSidebuild({
  /* config options here */
  reactStrictMode: true,

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

  sidebuilds: function* (wpconfig: any) {
    yield compileServiceWorker(wpconfig);
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
  }
});

export default nextConfig;
