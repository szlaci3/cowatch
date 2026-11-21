import React, { useEffect, useRef } from "react";
let api;
function youtube() {
  if (window.YT?.Player) return Promise.resolve(window.YT);
  if (!api)
    api = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      const fail = () => {
        api = null;
        script.remove();
        reject(Error());
      };
      const timer = setTimeout(fail, 15000);
      window.onYouTubeIframeAPIReady = () => {
        clearTimeout(timer);
        resolve(window.YT);
      };
      script.onerror = () => {
        clearTimeout(timer);
        fail();
      };
      script.src = "https://www.youtube.com/iframe_api";
      document.head.appendChild(script);
    });
  return api;
}
export function Player({ video, onEnd, onError }) {
  const box = useRef(null),
    events = useRef();
  events.current = { onEnd, onError };
  useEffect(() => {
    let player,
      gone = false;
    youtube()
      .then((YT) => {
        if (gone) return;
        const el = document.createElement("div");
        box.current.appendChild(el);
        player = new YT.Player(el, {
          videoId: video.id,
          playerVars: { autoplay: 1, playsinline: 1, origin: location.origin },
          events: {
            onStateChange: (e) => {
              if (e.data === YT.PlayerState.ENDED) events.current.onEnd();
            },
            onError: () => events.current.onError(),
          },
        });
      })
      .catch(() => {
        if (!gone) events.current.onError();
      });
    return () => {
      gone = true;
      player?.destroy();
    };
  }, [video.id]);
  return <div className="player" ref={box} />;
}
