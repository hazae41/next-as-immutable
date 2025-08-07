import { getOrWaitActiveServiceWorkerOrThrow } from "@/libs/service_worker";
import "@/styles/globals.css";

import { Immutable } from "@hazae41/immutable";
import type { AppProps } from "next/app";
import { useEffect, useState } from "react";

async function register() {
  navigator.serviceWorker.addEventListener("controllerchange", () => location.reload())

  const { registration, update } = await Immutable.register("/service_worker.latest.js")

  await getOrWaitActiveServiceWorkerOrThrow(registration)

  registration.addEventListener("updatefound", () => alert(`An update of ${location.origin} is being installed. If you did not expect this, please contact admins and stop using this website (${location.origin}), as it may be under attack.`), {})

  if (update == null)
    return
  if (!confirm(`An update of ${location.origin} is available. Do you want to update now?`))
    return

  await update()
}

export default function App({ Component, pageProps }: AppProps) {
  const [ready, setReady] = useState(false)

  useEffect(() => {
    register().then(() => setReady(true)).catch(console.error)
  }, [])

  if (!ready)
    return null

  return <Component {...pageProps} />
}
