import { expect, it } from "bun:test"
import { Effect, Layer } from "effect"
import * as BunBundle from "./bun/BunBundle.ts"
import { App, ClientBuild, ClientBundle } from "./dev.ts"
import * as TestHttpClient from "./effect/TestHttpClient.ts"
import { effectFn } from "./test.ts"

const effect = effectFn(
  Layer.effect(
    ClientBundle,
    BunBundle.effect(ClientBuild.config),
  ),
)

const Client = TestHttpClient.make(App)

it("dev yo", () =>
  effect(function*() {
    const res = yield* Client.get("/yo")

    expect(res.status).toEqual(200)
    expect(yield* res.text).toEqual("yo")
  }))

it("dev error", () =>
  effect(function*() {
    const res = yield* Client.get("/error")

    expect(res.status).toEqual(500)
    expect(yield* res.json).toMatchObject({
      error: "Error",
      message: "custom error",
    })
  }))

it("dev random", () =>
  effect(function*() {
    const res = yield* Client.get("/random")

    expect(res.status)
      .toEqual(200)

    expect(yield* res.text)
      .toInclude(">Random<")
  }))

it("loads client bundle", () =>
  effect(function*() {
    const bundle = yield* ClientBundle
    const res = yield* Client.get(
      "/.bundle/" + bundle.artifacts[0].path,
    )

    expect(res.status)
      .toEqual(200)
  }))
