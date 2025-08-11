import { walkSync } from "@/libs/walk";
import crypto from "crypto";
import fs from "fs";
import { JSDOM } from "jsdom";
import path from "path";

const { window } = new JSDOM(`<!DOCTYPE html><body></body>`);

globalThis.DOMParser = window.DOMParser
globalThis.XMLSerializer = window.XMLSerializer

/**
 * Inject magic script into all .html files
 */

const loader = fs.readFileSync("./.webpack/loader.js", "utf8")

const manifest = fs.readFileSync("./out/manifest.json", "base64")

for (const pathname of walkSync(`./out`)) {
  const filename = path.basename(pathname)

  if (!filename.endsWith(".html"))
    continue

  const document = new DOMParser().parseFromString(fs.readFileSync(pathname, "utf8"), "text/html")

  const scripts = document.querySelectorAll("script")

  const sources = new Array()

  for (const script of scripts) {
    if (script.src) {
      const url = new URL(script.src, `file://${pathname}`)

      const text = fs.readFileSync(path.join("./out", url.pathname), "utf8")
      const hash = crypto.createHash("sha256").update(text).digest("base64")

      script.setAttribute("integrity", `sha256-${hash}`)

      sources.push(`'sha256-${hash}'`);
    } else {
      const text = script.textContent || "";
      const hash = crypto.createHash("sha256").update(text).digest("base64");

      script.setAttribute("integrity", `sha256-${hash}`);

      sources.push(`'sha256-${hash}'`);
    }
  }

  const script = loader
    .replaceAll("INJECT_MANIFEST", `data:application/json;base64,${manifest}`)
    .replaceAll("INJECT_SOURCES", sources.join(" "))

  const original = new XMLSerializer().serializeToString(document)

  const injected = original
    .replaceAll("<head>", `<head><script type="module">${script}</script>`)

  const dummy = injected
    .replaceAll("INJECT_HTML_HASH", "DUMMY_HASH")
    .replaceAll("/>", ">")
    .replaceAll("\n", "")
    .replaceAll("\r", "")
    .replaceAll(" ", "")
    .toLowerCase()

  const htmlh = crypto.createHash("sha256").update(dummy).digest("hex")

  const html2 = injected.replaceAll("INJECT_HTML_HASH", htmlh)
  const script2 = script.replaceAll("INJECT_HTML_HASH", htmlh)

  const relative = path.relative(`./out`, pathname)

  const scripth = crypto.createHash("sha256").update(script2).digest("base64")

  fs.writeFileSync(pathname, html2, "utf8")

  console.log(relative, scripth)
}

/**
 * Find files to cache and compute their hash
 */

const files = new Array()

for (const pathname of walkSync(`./out`)) {
  const filename = path.basename(pathname)

  if (filename === "service_worker.latest.js")
    continue

  const relative = path.relative(`./out`, pathname)

  const text = fs.readFileSync(pathname)
  const hash = crypto.createHash("sha256").update(text).digest("base64")

  files.push([`/${relative}`, `sha256-${hash}`])
}

/**
 * Inject `files` into the service-worker and version it
 */

const original = fs.readFileSync(`./out/service_worker.latest.js`, "utf8")
const replaced = original.replaceAll("FILES", JSON.stringify(files))

const version = crypto.createHash("sha256").update(replaced).digest("hex").slice(0, 6)

fs.writeFileSync(`./out/service_worker.latest.js`, replaced, "utf8")
fs.writeFileSync(`./out/service_worker.${version}.js`, replaced, "utf8")