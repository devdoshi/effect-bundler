import * as BunBundle from "./bun/BunBundle.ts"
import {
  Hydration,
  HydrationScript,
  NoHydration,
  renderToStringAsync,
  ssr,
} from "solid-js/web"
import { App } from "./App.tsx"
import { ClientBundle } from "./dev.ts"

export const SsrApp = BunBundle.ssr({
  render: async (req, resolve) => {
    const comp = () => (
      <Document
        server={{
          url: req.url,
          resolve,
        }}
      >
        <App serverUrl={req.url} />
      </Document>
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

    return new Response(html, {
      headers: {
        "Content-Type": "text/html",
      },
    })
  },
  config: ClientBundle.config,
})

export default SsrApp

function Document(props: {
  children: any
  server: {
    url: string;
    resolve: (url: string) => string,
  }
}) {
  const docType = ssr("<!DOCTYPE html>") as unknown as any
  const jsUrl = props.server.resolve("client.tsx")
  const cssUrl = props.server.resolve("app.css")

  return (
    <NoHydration>
      {docType}

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

