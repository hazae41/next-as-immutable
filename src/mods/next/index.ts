import { Nullable } from "@hazae41/option"
import crypto from "crypto"
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
  const basename = path.basename(wpconfig.output.filename, ".js")

  fs.mkdirSync(`./public/${dirname}/${basename}.js`, { recursive: true })

  fs.copyFileSync(`./.webpack/${dirname}/${basename}.js`, `./public/${dirname}/${basename}.js`)
}

export async function compileAndVersion(wpconfig: Configuration) {
  if (typeof wpconfig.output !== "object")
    throw new Error("output is required to be an object")
  if (typeof wpconfig.output.filename !== "string")
    throw new Error("output.filename is required to be a string")
  if (!wpconfig.output.filename.endsWith(".latest.js"))
    throw new Error("output.filename is required to end with .latest.js")

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
  const basename = path.basename(wpconfig.output.filename, ".latest.js")

  fs.mkdirSync(`./public/${dirname}`, { recursive: true })

  fs.copyFileSync(`./.webpack/${dirname}/${basename}.latest.js`, `./public/${dirname}/${basename}.latest.js`)

  const content = fs.readFileSync(`./.webpack/${dirname}/${basename}.latest.js`)
  const version = crypto.createHash("sha256").update(content).digest("hex").slice(0, 6)

  fs.copyFileSync(`./.webpack/${dirname}/${basename}.latest.js`, `./public/${dirname}/${basename}.${version}.js`)
}

export async function compileAndVersionAsMacro(wpconfig: Configuration) {
  if (typeof wpconfig.output !== "object")
    throw new Error("output is required to be an object")
  if (typeof wpconfig.output.filename !== "string")
    throw new Error("output.filename is required to be a string")
  if (!wpconfig.output.filename.endsWith(".latest.js"))
    throw new Error("output.filename is required to end with .latest.js")

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
  const basename = path.basename(wpconfig.output.filename, ".latest.js")

  fs.mkdirSync(`./public/${dirname}`, { recursive: true })

  fs.copyFileSync(`./.webpack/${dirname}/${basename}.latest.js`, `./public/${dirname}/${basename}.latest.js`)

  const content = fs.readFileSync(`./.webpack/${dirname}/${basename}.latest.js`)
  const version = crypto.createHash("sha256").update(content).digest("hex").slice(0, 6)

  /**
   * Development
   */
  fs.copyFileSync(`./.webpack/${dirname}/${basename}.latest.js`, `./public/${dirname}/${basename}.${version}.js`)

  /**
   * Production
   */
  fs.copyFileSync(`./.webpack/${dirname}/${basename}.latest.js`, `./public/${dirname}/${basename}.${version}.macro.js`)
}

export interface ImmutableConfig {
  compiles(wpconfig: Configuration): Generator<Promise<void>>
}

export function withImmutable(config: NextConfig & ImmutableConfig): NextConfig {
  const { compiles, ...defaults } = config

  const memory = { promise: Promise.resolve() }

  return {
    ...defaults,

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