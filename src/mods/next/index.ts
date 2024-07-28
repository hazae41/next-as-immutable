import { Nullable } from "@hazae41/option"
import fs from "fs"
import { NextConfig } from "next"
import Log from "next/dist/build/output/log.js"
import { WebpackConfigContext } from "next/dist/server/config-shared.js"
import path from "path"
import { Configuration, Stats, webpack } from "webpack"

export async function compile(wpconfig: Configuration) {
  if (typeof wpconfig.output !== "object")
    throw new Error("output is required to be an object")
  if (typeof wpconfig.output.filename !== "string")
    throw new Error("output.filename is required to be a string")

  Log.wait(`compiling ${wpconfig.name}...`)

  const start = Date.now()

  const status = await new Promise<Nullable<Stats>>(ok => webpack(wpconfig).run((_, status) => ok(status)))

  if (status?.hasErrors()) {
    Log.error(`failed to compile ${wpconfig.name}`)
    Log.error(status.toString({ colors: true }))
    throw new Error(`Compilation failed`)
  }

  Log.ready(`compiled ${wpconfig.name} in ${Date.now() - start} ms`)

  const dirname = path.dirname(wpconfig.output.filename)
  const basename = path.basename(wpconfig.output.filename)

  fs.mkdirSync(`./public/${dirname}`, { recursive: true })

  fs.copyFileSync(`./.webpack/${dirname}/${basename}`, `./public/${dirname}/${basename}`)
}

export interface ImmutableConfig {
  compiles(wpconfig: Configuration): Generator<Promise<void>>
}

export function withImmutable(config: NextConfig & ImmutableConfig): NextConfig {
  const { compiles, ...defaults } = config

  const memory = { promise: Promise.resolve() }

  return {
    ...defaults,

    output: "export",

    generateBuildId() {
      return "immutable"
    },

    webpack(wpconfig: Configuration, wpoptions: WebpackConfigContext) {
      if (wpoptions.isServer)
        return wpconfig

      fs.rmSync("./.webpack", { force: true, recursive: true })

      memory.promise = Promise.all(compiles(wpconfig)).then(() => { })

      return wpconfig
    },

    exportPathMap: async (map) => {
      await memory.promise
      return map
    },

    /**
     * This should work on Vercel even with `output: "export"`
     */
    async headers() {
      if (process.env.NODE_ENV !== "production")
        return []

      return [
        {
          source: "/:path*",
          headers: [
            {
              key: "Cache-Control",
              value: "public, max-age=31536000, immutable",
            },
          ],
        },
      ]
    },
  }
}