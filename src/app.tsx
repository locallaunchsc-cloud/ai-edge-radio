import { useState, useRef } from "react";
import { useAgent } from "agents/react";
import type { RadioState } from "./agents/radio";

function Visualizer() {
  return (
    <div className="visualizer">
      {Array.from({ length: 7 }).map((_, i) => (
        <div key={i} className="bar" />
      ))}
    </div>
  );
}

function ProgressBar({ current, total }: { current: number; total: number }) {
  const pct = total > 0 ? ((current + 1) / total) * 100 : 0;
  return (
    <div className="progress-bar">
      <div className="fill" style={{ width: `${pct}%` }} />
    </div>
  );
}

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

  const isLoading = ["fetching", "scripting", "generating"].includes(radioState.status);
  const audioReadyCount = radioState.segments.filter((s) => s.audioUrl).length;

  return (
    <div className="container">
      <header>
        <div className="logo-icon">📻</div>
        <h1>AI Edge Radio</h1>
        <p className="subtitle">Turn any website or topic into a live AI radio show</p>
      </header>

      <div className="input-section">
        <div className="mode-toggle">
          <button className={mode === "url" ? "active" : ""} onClick={() => setMode("url")}>
            URL
          </button>
          <button className={mode === "topic" ? "active" : ""} onClick={() => setMode("topic")}>
            Topic
          </button>
        </div>
        {mode === "url" ? (
          <input
            type="text"
            placeholder="Paste a URL (blog, news, docs...)"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleGenerate()}
          />
        ) : (
          <input
            type="text"
            placeholder="Enter a topic (AI news, crypto, sports...)"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleGenerate()}
          />
        )}
        <div className="actions">
          <button
            className="generate-btn"
            onClick={handleGenerate}
            disabled={isLoading}
          >
            {isLoading ? "Generating..." : "Generate Show"}
          </button>
          <button className="reset-btn" onClick={handleReset}>
            Reset
          </button>
        </div>
      </div>

      <div className={`status-bar${isLoading ? " loading" : ""}`}>
        {statusText[radioState.status] || radioState.status}
      </div>

      {isLoading && <Visualizer />}

      {radioState.error && <div className="error">{radioState.error}</div>}

      {radioState.segments.length > 0 && (
        <div className="segments">
          <h2>Show Segments ({audioReadyCount}/{radioState.segments.length} ready)</h2>

          {isPlaying && <ProgressBar current={currentSegment} total={radioState.segments.length} />}

          {radioState.segments.map((seg, i) => (
            <div
              key={i}
              className={"segment" + (i === currentSegment && isPlaying ? " playing" : "")}
            >
              <div className="segment-role">{seg.role.toUpperCase()}</div>
              <div className="segment-title">{seg.title}</div>
              <div className="segment-script">{seg.script}</div>
              {seg.audioUrl && <span className="audio-ready">Audio ready</span>}
            </div>
          ))}

          {radioState.status === "ready" && (
            <>
              {isPlaying && <Visualizer />}
              <button className="play-btn" onClick={playAll} disabled={isPlaying}>
                {isPlaying ? `Playing segment ${currentSegment + 1}/${radioState.segments.length}...` : "▶ Play All"}
              </button>
            </>
          )}
        </div>
      )}

      <audio ref={audioRef} />

      <footer>
        <p>
          Built with <a href="https://developers.cloudflare.com/workers/" target="_blank" rel="noopener">Cloudflare Workers</a> + <a href="https://developers.cloudflare.com/agents/" target="_blank" rel="noopener">Agents</a> + <a href="https://elevenlabs.io" target="_blank" rel="noopener">ElevenLabs</a> for ElevenHacks
        </p>
      </footer>
    </div>
  );
}
