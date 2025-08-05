import { Future } from "@hazae41/future";
import { RpcRequest, RpcRequestPreinit, RpcResponse, RpcResponseInit } from "@hazae41/jsonrpc";

export namespace Parent {

  export async function requestOrThrow<T>(init: RpcRequestPreinit, signal: AbortSignal): Promise<T> {
    const { id = crypto.randomUUID(), method, params } = init

    const future = new Future<RpcResponse<T>>()

    const onMessage = (event: MessageEvent<RpcResponseInit<T>>) => {
      if (event.source !== parent)
        return
      const init = event.data

      if (init.id !== id)
        return
      const response = RpcResponse.from(init)

      future.resolve(response)
    }

    const onError = (event: MessageEvent<any>) => {
      if (event.source !== parent)
        return
      future.reject(new Error())
    }

    const onAbort = () => {
      future.reject(signal.reason)
    }

    try {
      addEventListener("message", onMessage)
      addEventListener("messageerror", onError)
      signal.addEventListener("abort", onAbort)

      const request = new RpcRequest(id, method, params)

      parent.postMessage(request, "*")

      const response = await future.promise

      return response.getOrThrow()
    } finally {
      removeEventListener("message", onMessage)
      removeEventListener("messageerror", onError)
      signal.removeEventListener("abort", onAbort)
    }
  }

}