import WebSocket, { WebSocketServer } from "ws";
import { HttpsProxyAgent } from "https-proxy-agent";
import express from "express";
import { handleApi } from "./api.mjs";
import { resolve } from "node:path";
const app = express();
app.use("/api", async (req, res) => {
  const url = new URL(req.originalUrl, req.protocol + "://" + req.get("host"));
  const origin = req.get("origin");
  // A local reverse proxy may terminate HTTPS before reaching Express.
  if (origin && new URL(origin).host !== url.host) return res.sendStatus(403);
  const result = await handleApi(new Request(url, { method: req.method }), {
    relay: true,
  });
  res
    .status(result.status)
    .set(Object.fromEntries(result.headers))
    .send(await result.text());
});
if (process.argv.includes("--production")) {
  app.use(express.static(resolve("dist")));
} else {
  const { createServer } = await import("vite");
  app.use(
    (await createServer({ server: { middlewareMode: true }, appType: "spa" }))
      .middlewares,
  );
}
const server = app.listen(Number(process.env.PORT || 5173), "0.0.0.0", () =>
  console.log("CoWatch listening on port", process.env.PORT || 5173),
);

// Keep the browser connection same-origin and use the cloud HTTPS proxy for egress.
const relay = new WebSocketServer({ noServer: true, maxPayload: 1024 * 1024 });
const livePath =
  "/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContentConstrained";
server.on("upgrade", (req, socket, head) => {
  const url = new URL(req.url, "http://localhost");
  if (
    url.pathname !== "/api/live-relay" + livePath ||
    !req.headers.origin ||
    new URL(req.headers.origin).host !== req.headers.host
  ) {
    socket.destroy();
    return;
  }
  const token = url.searchParams.get("access_token");
  if (!token?.startsWith("auth_tokens/")) {
    socket.destroy();
    return;
  }
  const proxy = process.env.HTTPS_PROXY || process.env.https_proxy;
  const remote = new WebSocket(
    "wss://generativelanguage.googleapis.com" +
      livePath +
      "?access_token=" +
      encodeURIComponent(token),
    {
      handshakeTimeout: 12000,
      agent: proxy ? new HttpsProxyAgent(proxy) : undefined,
    },
  );
  socket.on("error", () => remote.terminate());
  remote.on("error", () => socket.destroy());
  remote.once("open", () => {
    if (socket.destroyed) {
      remote.close();
      return;
    }
    relay.handleUpgrade(req, socket, head, (client) => {
      for (const [source, target] of [
        [client, remote],
        [remote, client],
      ]) {
        source.on("message", (data, binary) => {
          if (target.readyState === WebSocket.OPEN)
            target.send(data, { binary });
        });
        source.on("close", () => target.close());
        source.on("error", () => target.terminate());
      }
    });
  });
});
