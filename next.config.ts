import { NextSidebuild, withNextSidebuild } from "@hazae41/next-sidebuild";
import type { NextConfig } from "next";
import fs from "node:fs";
import path from "node:path";
import { Configuration } from "webpack";

async function compileServiceWorker(wpconfig: any) {
  const config = {
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
      filename: "./service_worker.latest.js",

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
  } satisfies Configuration

  await NextSidebuild.compile(config)

  const dirname = path.dirname(config.output.filename)
  const basename = path.basename(config.output.filename)

  fs.mkdirSync(`./public/${dirname}`, { recursive: true })

  fs.copyFileSync(`./.webpack/${dirname}/${basename}`, `./public/${dirname}/${basename}`)
}

async function compileBuilder(wpconfig: any) {
  const config = {
    /**
     * Name of your script for display on logs
     */
    name: "builder",

    /**
     * Use "webworker" for in-worker scripts or "web" for in-page scripts
     */
    target: "node",

    /**
     * Your script source code path
     */
    entry: "./src/scripts/builder/index.ts",

    output: {
      /**
       * Output file relative to `./out`
       */
      filename: "./builder.js",

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
  } satisfies Configuration

  await NextSidebuild.compile(config)
}

async function compileVerifier(wpconfig: any) {
  const config = {
    /**
     * Name of your script for display on logs
     */
    name: "verifier",

    /**
     * Use "webworker" for in-worker scripts or "web" for in-page scripts
     */
    target: "webworker",

    /**
     * Your script source code path
     */
    entry: "./src/scripts/verifier/index.ts",

    output: {
      /**
       * Output file relative to `./out`
       */
      filename: "./verifier.js",

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
  } satisfies Configuration

  await NextSidebuild.compile(config)
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
    yield compileBuilder(wpconfig);
    yield compileVerifier(wpconfig);
  },

  async headers() {
    if (process.env.NODE_ENV !== "production")
      return []
    return [
      {
        source: "/:path*",
        headers: [
          /**
           * Recommended in order to be fetchable from other origins
           */
          {
            "key": "Access-Control-Allow-Origin",
            "value": "*"
          },
          /**
           * Recommended in order to be embeddable in other origins
           */
          {
            key: "Allow-CSP-From",
            value: "*"
          },
          /**
           * Recommended to get almost immutable caching
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
