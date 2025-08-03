import { Future } from "@hazae41/future";
import { RpcRequest, RpcRequestPreinit, RpcResponse, RpcResponseInit } from "@hazae41/jsonrpc";

export async function requestOrThrow<T>(target: Window, init: RpcRequestPreinit, signal: AbortSignal): Promise<T> {
  const { id = crypto.randomUUID(), method, params } = init

  const future = new Future<RpcResponse<T>>()

  const onMessage = (event: MessageEvent<RpcResponseInit<T>>) => {
    if (event.origin !== target.origin)
      return
    const init = event.data

    if (init.id !== id)
      return
    const response = RpcResponse.from(init)

    future.resolve(response)
  }

  const onError = (event: MessageEvent<any>) => {
    if (event.origin !== target.origin)
      return
    future.reject(new Error())
  }

  const onAbort = () => {
    future.reject(signal.reason)
  }

  try {
    target.addEventListener("message", onMessage)
    target.addEventListener("messageerror", onError)
    signal.addEventListener("abort", onAbort)

    const request = new RpcRequest(id, method, params)

    target.postMessage(request, target.origin)

    const response = await future.promise

    return response.getOrThrow()
  } finally {
    target.removeEventListener("message", onMessage)
    target.removeEventListener("messageerror", onError)
    signal.removeEventListener("abort", onAbort)
  }
}