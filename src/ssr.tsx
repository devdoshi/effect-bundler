import {
  Headers,
  HttpApp,
  HttpServerRequest,
  HttpServerResponse,
} from "@effect/platform"
import { fileURLToPath } from "bun"
import * as NPath from "node:path"
import { Cache, Data, Effect } from "effect"
import { createContext, useContext } from "solid-js"
import {
  Hydration,
  HydrationScript,
  NoHydration,
  renderToStringAsync,
} from "solid-js/web"
import { ErrorBoundary, ssr } from "solid-js/web"
import { App } from "./App.tsx"

export async function renderRequest(
  req: Request,
  resolve = (url: string) => url,
) {
  try {
    const ctx = {
      ...ServerContext.defaultValue,

      url: req.url,
      resolve,
    }

    const comp = () => (
      <ServerRoot
        context={ctx}
      >
        <App serverUrl={req.url} />
      </ServerRoot>
    )

    const html = await renderToStringAsync(comp, {
      timeoutMs: 4000,
    })

    if (html.includes("SSR_NOT_FOUND")) {
      return new Response(html, {
        status: 404,
        headers: {
          "Content-Type": "text/html",
        },
      })
    }

    if (ctx._response) {
      return ctx._response
    }

    return new Response(html, {
      headers: {
        "Content-Type": "text/html",
      },
    })
  } catch (err: any) {
    if (err.cause instanceof Response) {
      return err.cause
    }

    throw err
  }
}

class SsrError extends Data.TaggedError("SsrError")<{
  message: string
  cause: unknown
}> { }

export const SsrApp: HttpApp.Default<SsrError> = Effect.gen(function* () {
  const req = yield* HttpServerRequest.HttpServerRequest
  const fetchReq = req.source as Request
  const output = yield* Effect.tryPromise({
    try: () =>
      renderRequest(
        fetchReq,
        (url) => {
          const path = url.startsWith("file://") ? fileURLToPath(url) : url
          const sourceBase = process.cwd()
          const publicBase = "/.bundle"
          // TODO: use real artifacts
          const artifacts = {
            "client.tsx": "client.js"
          }
          const sourcePath = NPath.relative(sourceBase, path)
          const publicPath = artifacts[sourcePath]

          return NPath.join(publicBase, publicPath || path)
        }
      ),
    catch: (e) =>
      new SsrError({
        message: "Failed to render server-side",
        cause: e,
      }),
  })

  return yield* HttpServerResponse.raw(output.body, {
    status: output.status,
    statusText: output.statusText,
    headers: Headers.fromInput(output.headers as any),
  })
})

const docType = ssr("<!DOCTYPE html>")

const ServerContext = createContext({
  _response: null as Response | null,
  url: "/",
  resolve: (url: string) => url as string | undefined,
  setResponse(res: Response) {
    this._response = res
  },
})

export const useServer = () => useContext(ServerContext)


function Document(props: {
  children: any
}) {
  const server = useServer()
  const jsUrl = server.resolve("client.tsx")
  const cssUrl = server.resolve("app.css")

  return (
    <NoHydration>
      {docType as unknown as any}

      <html lang="en">
        <head>
          <meta charset="utf-8" />
          <meta
            name="viewport"
            content="width=device-width, initial-scale=1"
          />
          <title>solid-deno</title>

          <link rel="stylesheet" href={cssUrl} />
        </head>

        <body>
          <Hydration>
            {props.children}
          </Hydration>
        </body>

        <HydrationScript />
        <script type="module" src={jsUrl}></script>
      </html>
    </NoHydration>
  )
}

export default function ServerRoot(props: {
  children?: any
  context?: typeof ServerContext.defaultValue
}) {
  return (
    <ErrorBoundary
      fallback={(error) => {
        if (error.cause instanceof Response) {
          throw error
        }

        return (
          <code>
            <pre>{error?.message || JSON.stringify(error, undefined, 2)}</pre>
          </code>
        )
      }}
    >
      <ServerContext.Provider
        value={props.context ?? ServerContext.defaultValue}
      >
        <Document>
          {props.children}
        </Document>
      </ServerContext.Provider>
    </ErrorBoundary>
  )
}
