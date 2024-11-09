import "@/styles/globals.css";
import { Immutable } from "@hazae41/immutable";
import type { AppProps } from "next/app";
import { useEffect, useRef } from "react";

async function register() {
  navigator.serviceWorker.addEventListener("controllerchange", () => location.reload())

  const update = process.env.NODE_ENV === "production"
    ? await Immutable.register("/service_worker.latest.js")
    : void await navigator.serviceWorker.register("./service_worker.js")

  if (update != null && confirm("Update available, do you want to update now?")) {
    await update()
    return
  }

  await navigator.serviceWorker.ready
}

export default function App({ Component, pageProps }: AppProps) {
  const executed = useRef(false)

  useEffect(() => {
    if (executed.current)
      return
    executed.current = true

    register()
  }, [])

  return <Component {...pageProps} />;
}
