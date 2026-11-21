import WebSocket, { WebSocketServer } from "ws";
import { HttpsProxyAgent } from "https-proxy-agent";
import express from "express";
import { GoogleGenAI } from "@google/genai";
import { starterSearch } from "./shelf.js";
import { resolve } from "node:path";
const app = express();
const model =
  process.env.GEMINI_LIVE_MODEL ||
  "gemini-2.5-flash-native-audio-preview-12-2025";
app.use("/api", (req, res, next) => {
  res.set("Cache-Control", "no-store");
  if (
    req.headers.origin &&
    new URL(req.headers.origin).host !== req.headers.host
  )
    return res.sendStatus(403);
  next();
});
app.post("/api/live", async (req, res) => {
  try {
    if (!process.env.GEMINI_API_KEY) throw Error();
    const ai = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: { apiVersion: "v1alpha" },
    });
    const token = await ai.authTokens.create({
      config: {
        uses: 1,
        lockAdditionalFields: [],
        liveConnectConstraints: { model },
      },
    });
    res.json({ token: token.name, model });
  } catch {
    res.status(503).json({
      error:
        "Voice connection unavailable. Check the Gemini key and Live API access.",
    });
  }
});
app.get("/api/search", async (req, res) => {
  const q = String(req.query.q || "")
    .trim()
    .slice(0, 300);
  if (!q) return res.status(400).json({ error: "Enter a search topic." });
  const local = () =>
    res.json({
      videos: starterSearch(q),
      source: "Starter shelf",
      notice:
        "Searching the starter shelf. Add YOUTUBE_API_KEY for full YouTube search.",
    });
  if (!process.env.YOUTUBE_API_KEY) return local();
  try {
    const params = new URLSearchParams({
      part: "snippet",
      q,
      type: "video",
      maxResults: "3",
      videoEmbeddable: "true",
      videoSyndicated: "true",
    });
    const response = await fetch(
      "https://www.googleapis.com/youtube/v3/search?" + params,
      {
        headers: { "X-Goog-Api-Key": process.env.YOUTUBE_API_KEY },
        signal: AbortSignal.timeout(12000),
      },
    );
    if (!response.ok) throw Error();
    const data = await response.json();
    res.json({
      source: "YouTube",
      videos: data.items.map(({ id, snippet: s }) => ({
        id: id.videoId,
        title: s.title,
        channel: s.channelTitle,
        image: s.thumbnails.high.url,
        topic: "YouTube",
      })),
    });
  } catch {
    res.status(502).json({
      error:
        "YouTube search is unavailable. Check the search key, quota and network.",
    });
  }
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
