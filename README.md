# CoWatch

A React discovery studio with a Gemini Live voice companion and an embedded YouTube player. The companion can search for videos, discuss its recommendations and play a selection. Microphone transmission and assistant audio pause during a video. The YouTube IFrame API's ended event returns control to the conversation. If the Live session expires during playback, CoWatch reconnects with the recent conversation and viewing context.

## Run

Use Node 24.5 or newer. Run these commands from the repository root.

```sh
npm ci
npm run dev
```

The default port is 5173. Set PORT to override it. For a production build, run `npm run build` followed by `npm start`. Use HTTPS or localhost for microphone access.

## Configuration

Set these in the server environment or an untracked .env file.

- GEMINI_API_KEY enables the Live API. The browser receives a single-use ephemeral token scoped to the Live model. The default model is gemini-2.5-flash-native-audio-preview-12-2025. GEMINI_LIVE_MODEL overrides it.
- YOUTUBE_API_KEY enables full YouTube search. Enable YouTube Data API v3 for the key's project. Searches request up to three embeddable, syndicated videos. Without a key, search matches topics in the bundled starter shelf.
- Allow the Gemini HTTPS and WebSocket service at generativelanguage.googleapis.com. Allow www.googleapis.com for server-side search, plus YouTube embed, thumbnail and media hosts for playback.

## Try a session

Choose **Start talking**, allow the microphone and ask for videos on a topic. Pick a returned title by voice or click its card. When the video finishes, discuss what you liked and ask for the next recommendation. The text field also searches when voice is offline. Watch history persists in the browser. Conversation text stays in memory and recent context is sent to Gemini on reconnect.

This prototype is intended for a personal development environment. Access to its API routes should be authenticated before sharing a paid key with a public audience.

## Artwork

The curated shelf uses editorial cover art. The bundled images are from [Wallpaper Bank](https://github.com/JaKooLit/Wallpaper-Bank/tree/c5e1780c29adca428dc4ca2d970bd1a6a09f18f3/wallpapers): Mountain, Fantasy - Mountain Lake, Space-Nebula and Fantasy-Japanese-Street. Search results use thumbnails supplied by YouTube.

## Deploy on Netlify

Import this GitHub repository into Netlify and select the `main` branch. Use the repository root as the base directory. The checked-in `netlify.toml` selects Node 24 for the build, runs `npm run build`, publishes `dist`, and bundles the API function.

In the Netlify project settings, add `GEMINI_API_KEY` and `YOUTUBE_API_KEY` with **Functions** scope for the desired deploy context. The former enables voice and the latter enables full YouTube search. Optionally set `GEMINI_LIVE_MODEL` in the same scope. Use the keys from their issuing services and keep these names server-side. The Codex cloud bindings are specific to that environment. Trigger a new deploy after changing variables.

On the deployed HTTPS site, search for a topic outside the starter shelf and check for YouTube results. Select **Start talking**, grant microphone access, choose a recommended video, and let it end to check the return to conversation. Netlify serves the short-lived token and search responses at the existing API paths. The browser streams audio directly to Gemini with the token. The local Node server still supports the proxy-backed WebSocket relay.

For a personal deployment, enable Netlify visitor access protection before sharing the site so visitors with access to the API routes are the people you intend to fund.
