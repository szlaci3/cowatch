import { GoogleGenAI } from "@google/genai";
import { starterSearch } from "./shelf.js";
const model =
  process.env.GEMINI_LIVE_MODEL ||
  "gemini-2.5-flash-native-audio-preview-12-2025";
export async function handleApi(request, { relay = false } = {}) {
  const url = new URL(request.url);
  const origin = request.headers.get("origin");
  if (origin && origin !== url.origin) return json({ error: "Forbidden" }, 403);
  if (url.pathname === "/api/live") {
    if (request.method !== "POST")
      return json({ error: "Use POST" }, 405, { Allow: "POST" });
    return issueToken(relay);
  }
  if (url.pathname === "/api/search") {
    if (request.method !== "GET")
      return json({ error: "Use GET" }, 405, { Allow: "GET" });
    return search(url.searchParams.get("q") || "");
  }
  return json({ error: "Unknown API route" }, 404);
}

function json(body, status = 200, headers = {}) {
  return Response.json(body, {
    status,
    headers: { "Cache-Control": "no-store", ...headers },
  });
}

async function issueToken(relay) {
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
    return json({ token: token.name, model, relay });
  } catch {
    return json(
      {
        error:
          "Voice connection unavailable. Check the Gemini key and Live API access.",
      },
      503,
    );
  }
}

async function search(query) {
  const q = query.trim().slice(0, 300);
  if (!q) return json({ error: "Enter a search topic." }, 400);
  const local = () =>
    json({
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
    return json({
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
    return json(
      {
        error:
          "YouTube search is unavailable. Check the search key, quota and network.",
      },
      502,
    );
  }
}
