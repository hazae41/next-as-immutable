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

const verifier = fs.readFileSync("./.webpack/verifier.js", "utf8")

for (const pathname of walkSync(`./out`)) {
  const filename = path.basename(pathname)

  if (!filename.endsWith(".html"))
    continue

  const document = new DOMParser().parseFromString(fs.readFileSync(pathname, "utf8"), "text/html")

  const scripts = document.querySelectorAll("script")

  const sources = new Array()

  for (const script of scripts) {
    if (script.src) {
      const text = fs.readFileSync(path.join("./out", script.src), "utf8")
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

  const begin = new XMLSerializer().serializeToString(document)
    .replaceAll("<head>", `<head><script type="module">${verifier.replaceAll("INJECT_SOURCES", sources.join(" "))}</script>`)

  const inter = begin
    .replaceAll("INJECT_HASH", "DUMMY_HASH")
    .replaceAll("/>", ">")
    .replaceAll("\n", "")
    .replaceAll("\r", "")
    .replaceAll(" ", "")
    .toLowerCase()

  const hash = crypto.createHash("sha256").update(inter).digest("hex")

  const final = begin.replaceAll("INJECT_HASH", hash)

  fs.writeFileSync(pathname, final, "utf8")
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