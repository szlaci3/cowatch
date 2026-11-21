import React, { useState, useRef, useEffect } from "react";
import { createRoot } from "react-dom/client";
import {
  AudioLines,
  Compass,
  History,
  Play,
  Mic,
  MicOff,
  Sparkles,
  ArrowUp,
  ArrowUpRight,
  Clapperboard,
  X,
  ChevronRight,
  MessageCircle,
} from "lucide-react";
import { shelf } from "./shelf";

import { Player } from "./player";
import "./style.css";
function Orb() {
  return (
    <div className="orbArea" aria-hidden="true">
      <div className="halo" />
      <svg viewBox="0 0 260 150">
        <defs>
          <linearGradient id="thread" x1="0" x2="1" y1=".2" y2=".8">
            <stop stopColor="#6da4ff" />
            <stop offset=".36" stopColor="#a59cff" />
            <stop offset=".65" stopColor="#f0b8ff" />
            <stop offset="1" stopColor="#9b70ff" />
          </linearGradient>
        </defs>
        {Array.from({ length: 78 }, (_, i) => {
          const t = i / 77;
          let pts = [];
          for (let n = 0; n <= 160; n++) {
            const a = (n * Math.PI) / 80,
              r =
                1 +
                0.16 * Math.sin(3 * a + 4 * t) +
                0.1 * Math.cos(2 * a - 3 * t);
            pts.push(
              [
                130 +
                  Math.cos(a) * r * (62 - 14 * Math.sin(t * Math.PI)) +
                  19 * Math.sin(5 * t + a),
                75 +
                  Math.sin(a) * r * (43 + 9 * Math.sin(4 * t)) +
                  14 * Math.cos(5 * t + a),
              ].join(","),
            );
          }
          return (
            <polyline
              key={i}
              points={pts.join(" ")}
              fill="none"
              stroke="url(#thread)"
              strokeWidth=".74"
              opacity=".78"
            />
          );
        })}
      </svg>
    </div>
  );
}
function App() {
  const [tab, setTab] = useState("Studio"),
    [videos, setVideos] = useState(shelf),
    [video, setVideo] = useState(null),
    [history, setHistory] = useState(() => {
      try {
        return JSON.parse(localStorage.cowatchHistory || "[]");
      } catch {
        return [];
      }
    }),
    [status, S] = useState("Offline"),
    [message, M] = useState(""),
    [input, I] = useState(""),
    [busy, B] = useState(false),
    [topic, T] = useState(""),
    [transcript, D] = useState(false),
    [lines, L] = useState([]);
  const voice = useRef(null),
    wanted = useRef(false),
    running = useRef(false),
    current = useRef(null),
    picks = useRef(shelf),
    log = useRef([]),
    seq = useRef(0);
  function add(role, text, fragment = false) {
    const arr = [...log.current],
      last = arr.at(-1);
    if (fragment && last?.role === role)
      arr[arr.length - 1] = { role, text: last.text + text };
    else arr.push({ role, text });
    log.current = arr.slice(-60);
    L(log.current);
  }
  async function search(q) {
    const request = ++seq.current;
    B(true);
    try {
      const r = await fetch("/api/search?q=" + encodeURIComponent(q)),
        d = await r.json();
      if (!r.ok) throw Error(d.error);
      if (request === seq.current) {
        picks.current = d.videos;
        setVideos(d.videos);
        T(q);
        setTab("Studio");
        M(d.notice || "");
        add(
          "Studio",
          "Search: " +
            q +
            ". Results: " +
            d.videos.map((v) => v.title).join(", "),
        );
      }
      return {
        videos: d.videos.map(({ id, title, channel }) => ({
          id,
          title,
          channel,
        })),
        source: d.source,
      };
    } catch (e) {
      M(e.message);
      throw e;
    } finally {
      if (request === seq.current) B(false);
    }
  }
  function play(v) {
    if (!v) return false;
    current.current = v;
    voice.current?.pause(true);
    setVideo(v);
    setTab("Studio");
    M("");
    add("Studio", "Selected " + v.title);
    setHistory((h) => {
      const list = [v, ...h.filter((x) => x.id !== v.id)].slice(0, 30);
      try {
        localStorage.cowatchHistory = JSON.stringify(list);
      } catch {}
      return list;
    });
    return true;
  }
  async function start(prompt = "Ask briefly what I feel like watching.") {
    if (running.current) return;
    running.current = true;
    wanted.current = true;
    S("Connecting");
    M("");
    try {
      const { connectVoice } = await import("./live");
      const connection = await connectVoice({
        context: JSON.stringify({
          conversation: log.current,
          picks: picks.current,
        }).slice(-12000),
        onText: (r, t) => add(r, t, true),
        onSearch: search,
        onPlay: (id) => play(picks.current.find((v) => v.id === id)),
        onClose: () => {
          voice.current = null;
          S("Offline");
          M("Voice session ended. Reconnect to continue the conversation.");
        },
      });
      voice.current = connection;
      S("Connected");
      if (current.current) connection.pause(true);
      else connection.say(prompt);
    } catch (e) {
      wanted.current = false;
      S("Offline");
      M(
        e.name === "NotAllowedError"
          ? "Microphone permission is needed for voice. You can also type below."
          : e.message || "Voice could not connect.",
      );
    } finally {
      running.current = false;
    }
  }
  function finish(reason) {
    const v = current.current;
    if (!v) return;
    current.current = null;
    setVideo(null);
    const note = reason + " " + v.title;
    add("Studio", note);
    const prompt =
      note +
      ". Resume our conversation, ask about my reaction before looking for the next video.";
    if (voice.current) {
      voice.current.pause(false);
      voice.current.say(prompt);
    } else if (wanted.current) start(prompt);
    M(
      reason === "Unable to play"
        ? "YouTube could not play this video here. Choose another or continue the conversation."
        : "What would you like to watch next?",
    );
  }
  function toggle() {
    if (voice.current) {
      wanted.current = false;
      voice.current.close();
      voice.current = null;
      S("Offline");
    } else start();
  }
  function submit(e) {
    e.preventDefault();
    const q = input.trim();
    if (!q) return;
    I("");
    add("You", q);
    if (voice.current && !current.current) voice.current.say(q);
    else search(q).catch(() => {});
  }
  useEffect(() => () => voice.current?.close(), []);
  const list = tab === "History" ? history : videos;
  return (
    <>
      <header>
        <div className="bar">
          <a className="brand" href="./">
            <span className="mark">
              <AudioLines />
            </span>
            CoWatch
          </a>
          <nav>
            {[
              ["Studio", Compass],
              ["History", History],
            ].map(([n, Icon]) => (
              <button
                className={tab === n ? "active" : ""}
                onClick={() => setTab(n)}
                key={n}
              >
                <Icon size={16} />
                {n === "Studio" ? "Discover" : n}
              </button>
            ))}
          </nav>
          <span className="session">
            <i />
            Session studio
          </span>
        </div>
      </header>
      <main>
        <div className="eyebrow">
          <span className="dash" /> WATCH SPACE
        </div>
        <h1>
          Discovery studio<span>.</span>
        </h1>
        <p className="sub">Find your next watch through conversation.</p>
        <section className="stage">
          <article className="screen">
            {video ? (
              <>
                <Player
                  video={video}
                  onEnd={() => finish("Finished")}
                  onError={() => finish("Unable to play")}
                />
                <button
                  className="back"
                  onClick={() => finish("Stopped watching")}
                >
                  <X size={14} /> Close player
                </button>
              </>
            ) : (
              <>
                <div className="cover" />
                <span className="feature">
                  <Clapperboard size={13} /> STUDIO SPOTLIGHT
                </span>
                <div className="covertext">
                  <span className="film">
                    <i /> NATURE FILM
                  </span>
                  <h2>Into the wild</h2>
                  <p>A cinematic escape into the natural world.</p>
                  <button className="watch" onClick={() => play(shelf[0])}>
                    <Play size={14} fill="currentColor" /> Watch now
                  </button>
                </div>
                <div className="covercredit">Costa Rica in 4K</div>
              </>
            )}
          </article>
          <aside>
            <div className="asideTop">
              <span>
                <Sparkles size={17} /> Voice companion
              </span>
              <small>
                <i className={status === "Connected" ? "online" : ""} />
                {video && status === "Connected"
                  ? "Paused"
                  : status === "Offline"
                    ? "Standby"
                    : status}
              </small>
            </div>
            <Orb />
            <div className="gemini">GEMINI LIVE</div>
            <h3>
              {video
                ? "Watching together"
                : status === "Connected"
                  ? "I’m listening"
                  : "Let’s find your next watch"}
            </h3>
            <p>
              {video
                ? "We’ll pick up when the video ends."
                : "Tell me what you’re in the mood for."}
            </p>
            <button
              className="talk"
              disabled={status === "Connecting"}
              onClick={toggle}
            >
              {status === "Connected" ? (
                <MicOff size={17} />
              ) : (
                <Mic size={17} />
              )}{" "}
              {status === "Connected"
                ? "End voice chat"
                : status === "Connecting"
                  ? "Connecting…"
                  : "Start talking"}
            </button>
            <form onSubmit={submit}>
              <input
                aria-label="Message or search topic"
                value={input}
                onChange={(e) => I(e.target.value)}
                placeholder="Or type a message…"
              />
              <button aria-label="Send message" disabled={!input.trim()}>
                <ArrowUp size={17} />
              </button>
            </form>
          </aside>
        </section>
        {message && (
          <div role="status" className="notice">
            {message}
            <button onClick={() => M("")} aria-label="Dismiss">
              <X size={15} />
            </button>
          </div>
        )}
        <section className="shelf">
          <div className="shelfhead">
            <div>
              <div className="eyebrow">
                <span className="dash" />{" "}
                {tab === "History" ? "YOUR SESSION" : "THE WATCHLIST"}
              </div>
              <h2>
                {tab === "History"
                  ? "Watch history"
                  : busy
                    ? "Finding videos…"
                    : topic
                      ? "Picks for “" + topic + "”"
                      : "On the radar"}
              </h2>
            </div>
            <button className="trans" onClick={() => D(true)}>
              <MessageCircle size={15} /> Conversation{" "}
              <ChevronRight size={14} />
            </button>
          </div>
          <div className="cards">
            {list.map((v) => (
              <button className="card" key={v.id} onClick={() => play(v)}>
                <div
                  className="thumb"
                  style={{
                    backgroundImage: "url(" + JSON.stringify(v.image) + ")",
                  }}
                >
                  <span>{v.topic}</span>
                  <b>
                    <Play size={13} fill="white" />
                  </b>
                </div>
                <div className="cardinfo">
                  <div>
                    <h4>{v.title}</h4>
                    <p>{v.channel}</p>
                  </div>
                  <ArrowUpRight size={16} />
                </div>
              </button>
            ))}
          </div>
          {!list.length && (
            <p>
              {tab === "History"
                ? "Videos you play will appear here."
                : "No matches. Try another topic."}
            </p>
          )}
        </section>
      </main>
      {transcript && (
        <dialog open aria-label="Conversation">
          <div className="dlg">
            <h3>Conversation</h3>
            <button onClick={() => D(false)} aria-label="Close conversation">
              <X />
            </button>
          </div>
          {lines.length ? (
            lines.map((l, i) => (
              <p key={i}>
                <strong>{l.role}</strong> {l.text}
              </p>
            ))
          ) : (
            <p>Start talking or send a message to begin.</p>
          )}
        </dialog>
      )}
    </>
  );
}
createRoot(document.getElementById("root")).render(<App />);
