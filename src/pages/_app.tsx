import "@/styles/globals.css";

import { Immutable } from "@hazae41/immutable";
import type { AppProps } from "next/app";
import { useEffect, useState } from "react";

async function register() {
  navigator.serviceWorker.addEventListener("controllerchange", () => location.reload())

  const { update } = await Immutable.register("/service_worker.latest.js")

  if (update != null && confirm("An update is available. Do you want to update now?")) {
    await update()
    return
  }

  await navigator.serviceWorker.ready
}

export default function App({ Component, pageProps }: AppProps) {
  const [ready, setReady] = useState(false)

  useEffect(() => {
    register().then(() => setReady(true)).catch(console.error)
  }, [])

  if (!ready)
    return null

  return <>
    <div className="static" />
    <Component {...pageProps} />;
  </>
}
