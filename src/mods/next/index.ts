import { Nullable } from "@hazae41/option"
import crypto from "crypto"
import fs from "fs"
import { walkSync } from "libs/fs/index.js"
import { NextConfig } from "next"
import Log from "next/dist/build/output/log.js"
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

  fs.mkdirSync(`./public/${dirname}`, { recursive: true })

  fs.copyFileSync(`./.webpack/${dirname}/${basename}.js`, `./public/${dirname}/${basename}.js`)

  const content = fs.readFileSync(`./.webpack/${dirname}/${basename}.js`)
  const version = crypto.createHash("sha256").update(content).digest("hex").slice(0, 6)

  fs.copyFileSync(`./.webpack/${dirname}/${basename}.js`, `./public/${dirname}/${basename}.${version}.h.js`)
}

export async function compileAndVersionAsMacro(wpconfig: Configuration) {
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

  fs.mkdirSync(`./public/${dirname}`, { recursive: true })

  fs.copyFileSync(`./.webpack/${dirname}/${basename}.js`, `./public/${dirname}/${basename}.js`)

  const content = fs.readFileSync(`./.webpack/${dirname}/${basename}.js`)
  const version = crypto.createHash("sha256").update(content).digest("hex").slice(0, 6)

  /**
   * Development
   */
  fs.copyFileSync(`./.webpack/${dirname}/${basename}.js`, `./public/${dirname}/${basename}.${version}.h.js`)

  /**
   * Production
   */
  fs.copyFileSync(`./.webpack/${dirname}/${basename}.js`, `./public/${dirname}/${basename}.${version}.h.macro.js`)
}

export interface ImmutableConfig {
  compiles(): Generator<Promise<void>>
}

export function withImmutable(config: NextConfig & ImmutableConfig) {
  let promise: Promise<void>

  return {
    ...config,
    webpack(wpconfig, wpoptions) {
      if (wpoptions.isServer)
        return wpconfig

      fs.rmSync("./.webpack", { force: true, recursive: true })

      for (const file of walkSync("./public")) {
        if (file.endsWith(".h.js"))
          fs.rmSync(file, { force: true })
        if (file.endsWith(".h.macro.js"))
          fs.rmSync(file, { force: true })
      }

      promise = Promise.all(config.compiles()).then(() => { })

      return wpconfig
    },
    exportPathMap: async (map) => {
      await promise
      return map
    },
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
  } satisfies NextConfig
}