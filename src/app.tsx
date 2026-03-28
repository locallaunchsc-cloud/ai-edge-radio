import { useState, useRef, useEffect } from "react";
import { useAgent } from "agents/react";
import type { RadioState } from "./agents/radio";

export function App() {
  const [url, setUrl] = useState("");
  const [topic, setTopic] = useState("");
  const [mode, setMode] = useState<"url" | "topic">("url");
  const [radioState, setRadioState] = useState<RadioState>({
    status: "idle",
    sourceUrl: "",
    topic: "",
    segments: [],
  });
  const [currentSegment, setCurrentSegment] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);

  const agent = useAgent({
    agent: "RadioAgent",
    onStateUpdate: (state: RadioState) => setRadioState(state),
  });

  const handleGenerate = () => {
    if (mode === "url" && url) {
      agent.stub.generateShow({ url });
    } else if (mode === "topic" && topic) {
      agent.stub.generateShow({ topic });
    }
  };

  const handleReset = () => {
    agent.stub.reset();
    setCurrentSegment(0);
    setIsPlaying(false);
  };

  const playAll = async () => {
    setIsPlaying(true);
    for (let i = 0; i < radioState.segments.length; i++) {
      const seg = radioState.segments[i];
      if (!seg.audioUrl) continue;
      setCurrentSegment(i);
      await new Promise<void>((resolve) => {
        const audio = audioRef.current!;
        audio.src = seg.audioUrl!;
        audio.onended = () => resolve();
        audio.play();
      });
    }
    setIsPlaying(false);
  };

  const statusText: Record<string, string> = {
    idle: "Ready to generate",
    fetching: "Fetching content...",
    scripting: "Writing show script with AI...",
    generating: "Generating voices with ElevenLabs...",
    ready: "Show ready! Hit play.",
    error: "Something went wrong",
  };

  return (
    <div className="container">
      <header>
        <h1>AI Edge Radio</h1>
        <p className="subtitle">Turn any website or topic into a live AI radio show</p>
      </header>

      <div className="input-section">
        <div className="mode-toggle">
          <button className={mode === "url" ? "active" : ""} onClick={() => setMode("url")}>URL</button>
          <button className={mode === "topic" ? "active" : ""} onClick={() => setMode("topic")}>Topic</button>
        </div>

        {mode === "url" ? (
          <input type="text" placeholder="Paste a URL (blog, news, docs...)" value={url} onChange={(e) => setUrl(e.target.value)} />
        ) : (
          <input type="text" placeholder="Enter a topic (AI news, crypto, sports...)" value={topic} onChange={(e) => setTopic(e.target.value)} />
        )}

        <div className="actions">
          <button className="generate-btn" onClick={handleGenerate} disabled={radioState.status !== "idle" && radioState.status !== "ready" && radioState.status !== "error"}>Generate Show</button>
          <button className="reset-btn" onClick={handleReset}>Reset</button>
        </div>
      </div>

      <div className="status">{statusText[radioState.status] || radioState.status}</div>
      {radioState.error && <div className="error">{radioState.error}</div>}

      {radioState.segments.length > 0 && (
        <div className="segments">
          <h2>Show Segments</h2>
          {radioState.segments.map((seg, i) => (
            <div key={i} className={"segment" + (i === currentSegment && isPlaying ? " playing" : "")}>
              <div className="segment-role">{seg.role.toUpperCase()}</div>
              <div className="segment-title">{seg.title}</div>
              <div className="segment-script">{seg.script}</div>
              {seg.audioUrl && <span className="audio-ready">Audio ready</span>}
            </div>
          ))}
          {radioState.status === "ready" && (
            <button className="play-btn" onClick={playAll} disabled={isPlaying}>{isPlaying ? "Playing..." : "Play All"}</button>
          )}
        </div>
      )}

      <audio ref={audioRef} />

      <footer>
        <p>Built with Cloudflare Workers + Agents + ElevenLabs for ElevenHacks</p>
      </footer>
    </div>
  );
}
