import { Agent, callable } from "agents";
import { createWorkersAI } from "workers-ai-provider";
import { generateText } from "ai";
import { createClient, streamToDataUri } from "../lib/elevenlabs";

export interface ShowSegment {
  role: "host" | "analyst" | "outro";
  title: string;
  script: string;
  audioUrl?: string;
}

export interface RadioState {
  status: "idle" | "fetching" | "scripting" | "generating" | "ready" | "error";
  sourceUrl: string;
  topic: string;
  segments: ShowSegment[];
  error?: string;
}

const HOST_VOICE_ID = "JBFqnCBsd6RMkjVDRZzb";
const ANALYST_VOICE_ID = "EXAVITQu4vr4xnSDxMaL";

export class RadioAgent extends Agent<Env, RadioState> {
  initialState: RadioState = {
    status: "idle",
    sourceUrl: "",
    topic: "",
    segments: [],
  };

  @callable()
  async generateShow(input: { url?: string; topic?: string }) {
    try {
      this.setState({
        ...this.state,
        status: "fetching",
        sourceUrl: input.url || "",
        topic: input.topic || "",
        segments: [],
        error: undefined,
      });

      let content = "";
      if (input.url) {
        const resp = await fetch(input.url);
        const html = await resp.text();
        content = html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").slice(0, 5000);
      } else if (input.topic) {
        content = "Topic: " + input.topic;
      }

      this.setState({ ...this.state, status: "scripting" });
      const workersai = createWorkersAI({ binding: this.env.AI });

      const { text: showScript } = await generateText({
        model: workersai("@cf/meta/llama-3.3-70b-instruct-fp8-fast"),
        system: "You are a radio show producer. Create a radio show script with exactly 3 segments. Output valid JSON array with objects having: role (host, analyst, or outro), title (short segment title), and script (2-3 sentences, natural conversational tone, under 50 words each).",
        prompt: "Create a radio show from this content:\n\n" + content,
      });

      let segments: ShowSegment[];
      try {
        const jsonMatch = showScript.match(/\[[\s\S]*\]/);
        segments = JSON.parse(jsonMatch ? jsonMatch[0] : showScript);
      } catch {
        segments = [
          { role: "host", title: "Welcome", script: "Welcome to AI Edge Radio! Let me tell you about something interesting we found today." },
          { role: "analyst", title: "Deep Dive", script: "Looking at the details here, there are some fascinating insights worth exploring." },
          { role: "outro", title: "Wrap Up", script: "That is all for now! Thanks for tuning in to AI Edge Radio. Stay curious!" },
        ];
      }

      this.setState({ ...this.state, status: "generating", segments });

      const client = createClient(this.env.ELEVENLABS_API_KEY);
      const updatedSegments = [...segments];

      for (let i = 0; i < segments.length; i++) {
        const seg = segments[i];
        const voiceId = seg.role === "analyst" ? ANALYST_VOICE_ID : HOST_VOICE_ID;
        const audio = await client.textToSpeech.convert(voiceId, {
          text: seg.script,
          modelId: "eleven_flash_v2_5",
          outputFormat: "mp3_44100_128",
        });
        const dataUri = await streamToDataUri(audio);
        updatedSegments[i] = { ...seg, audioUrl: dataUri };
        this.setState({ ...this.state, segments: updatedSegments });
      }

      this.setState({ ...this.state, status: "ready", segments: updatedSegments });
    } catch (err: any) {
      this.setState({ ...this.state, status: "error", error: err.message || "Unknown error" });
    }
  }

  @callable()
  async reset() {
    this.setState(this.initialState);
  }
}
