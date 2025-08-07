import { Future } from "@hazae41/future"

export async function getOrWaitActiveServiceWorkerOrThrow(registration: ServiceWorkerRegistration) {
  const { active } = registration

  if (active != null)
    return active

  const { installing, waiting } = registration

  if (installing != null)
    return await getOrWaitServiceWorkerOrThrow(installing)
  if (waiting != null)
    return await getOrWaitServiceWorkerOrThrow(waiting)

  throw new Error(`Could not find service worker`)
}

export async function getOrWaitServiceWorkerOrThrow(worker: ServiceWorker) {
  if (worker.state === "activated")
    return worker

  const future = new Future<void>()

  const onStateChange = (event: Event) => {
    if (worker.state === "redundant")
      return void future.reject(new Error(`Service worker is redundant`))
    if (worker.state === "activated")
      return void future.resolve()
    return
  }

  const onError = (event: ErrorEvent) => {
    future.reject(event.error)
  }

  try {
    worker.addEventListener("statechange", onStateChange, { passive: true })
    worker.addEventListener("error", onError, { passive: true })

    await future.promise

    return worker
  } finally {
    worker.removeEventListener("statechange", onStateChange)
    worker.removeEventListener("error", onError)
  }
}