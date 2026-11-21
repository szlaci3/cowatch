import { GoogleGenAI, Type } from "@google/genai";

export async function connectVoice({
  onText,
  onClose,
  onSearch,
  onPlay,
  context,
}) {
  const input = new AudioContext({ sampleRate: 16000 });
  const output = new AudioContext({ sampleRate: 24000 });
  let stream,
    session,
    node,
    quiet = false,
    closed = false,
    next = 0;
  const sources = new Set();
  function silence() {
    for (const src of sources) {
      try {
        src.stop();
      } catch {}
    }
    sources.clear();
    next = 0;
  }
  function close() {
    if (closed) return;
    closed = true;
    silence();
    stream?.getTracks().forEach((t) => t.stop());
    node?.disconnect();
    session?.close();
    input.close();
    output.close();
  }
  try {
    await Promise.all([input.resume(), output.resume()]);
    stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true },
      video: false,
    });
    const r = await fetch("/api/live", { method: "POST" }),
      data = await r.json();
    if (!r.ok) throw Error(data.error);
    const ai = new GoogleGenAI({
      apiKey: data.token,
      httpOptions: {
        apiVersion: "v1alpha",
        ...(data.relay ? { baseUrl: location.origin + "/api/live-relay" } : {}),
      },
    });
    const tool = (name, description, key) => ({
      name,
      description,
      parameters: {
        type: Type.OBJECT,
        properties: { [key]: { type: Type.STRING } },
        required: [key],
      },
    });
    session = await ai.live.connect({
      model: data.model,
      config: {
        responseModalities: ["AUDIO"],
        inputAudioTranscription: {},
        outputAudioTranscription: {},
        systemInstruction:
          "You are CoWatch, a friendly, concise voice companion for discovering YouTube videos. Ask about interests. Use searchVideos when the user wants suggestions. Recommend only returned videos, and acknowledge limited results. Use playVideo only on user selection. After playback ask for their reaction and tailor your next search. Prior conversation and shelf data: " +
          context,
        tools: [
          {
            functionDeclarations: [
              tool(
                "searchVideos",
                "Find up to three videos on a topic",
                "query",
              ),
              tool(
                "playVideo",
                "Play a current recommendation by YouTube ID",
                "id",
              ),
            ],
          },
        ],
      },
      callbacks: {
        onclose: () => {
          if (!closed) {
            close();
            onClose();
          }
        },
        onerror: () => {
          if (!closed) {
            close();
            onClose();
          }
        },
        onmessage: async (m) => {
          if (closed) return;
          const c = m.serverContent;
          if (c?.interrupted) silence();
          if (c?.inputTranscription?.text)
            onText("You", c.inputTranscription.text);
          if (c?.outputTranscription?.text)
            onText("Gemini", c.outputTranscription.text);
          for (const part of c?.modelTurn?.parts || []) {
            if (quiet || !part.inlineData?.data) continue;
            const bytes = Uint8Array.from(atob(part.inlineData.data), (v) =>
              v.charCodeAt(0),
            );
            const samples = new Int16Array(bytes.buffer),
              buf = output.createBuffer(1, samples.length, 24000);
            buf.copyToChannel(
              Float32Array.from(samples, (x) => x / 32768),
              0,
            );
            const src = output.createBufferSource();
            src.buffer = buf;
            src.connect(output.destination);
            sources.add(src);
            src.onended = () => sources.delete(src);
            next = Math.max(next, output.currentTime);
            src.start(next);
            next += buf.duration;
          }
          for (const f of m.toolCall?.functionCalls || []) {
            let response;
            try {
              response =
                f.name === "searchVideos"
                  ? await onSearch(f.args.query)
                  : { playing: onPlay(f.args.id) };
            } catch (e) {
              response = { error: e.message };
            }
            if (!closed)
              session.sendToolResponse({
                functionResponses: [{ id: f.id, name: f.name, response }],
              });
          }
        },
      },
    });
    await input.audioWorklet.addModule("/mic.js");
    node = new AudioWorkletNode(input, "microphone");
    input.createMediaStreamSource(stream).connect(node);
    node.connect(input.destination);
    node.port.onmessage = ({ data }) => {
      if (quiet || closed) return;
      session.sendRealtimeInput({
        audio: {
          data: btoa(String.fromCharCode(...new Uint8Array(data))),
          mimeType: "audio/pcm;rate=16000",
        },
      });
    };
    return {
      close,
      pause(value) {
        quiet = value;
        stream.getAudioTracks().forEach((t) => (t.enabled = !value));
        if (value) {
          silence();
          session.sendRealtimeInput({ audioStreamEnd: true });
        }
      },
      say(text) {
        session.sendClientContent({
          turns: [{ role: "user", parts: [{ text }] }],
          turnComplete: true,
        });
      },
    };
  } catch (error) {
    close();
    throw error;
  }
}
