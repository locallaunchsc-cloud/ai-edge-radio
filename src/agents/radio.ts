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

// George - warm, authoritative narrator voice
const HOST_VOICE_ID = "JBFqnCBsd6RMkjVDRZzb";
// Sarah - clear, professional analyst voice
const ANALYST_VOICE_ID = "EXAVITQu4vr4xnSDxMaL";

const SHOW_SYSTEM_PROMPT = `You are the lead producer for "AI Edge Radio", an energetic and insightful radio show that transforms web content into audio entertainment.

Create a radio show script with EXACTLY 3 segments as a JSON array. Each segment object must have:
- "role": one of "host", "analyst", or "outro"
- "title": a catchy short segment title (3-6 words)
- "script": the spoken dialogue (2-4 natural conversational sentences, 30-60 words each)

Rules:
1. Segment 1 (host): Energetic intro welcoming listeners, teasing what's coming
2. Segment 2 (analyst): Deep dive with insights, opinions, and interesting angles
3. Segment 3 (outro): Memorable wrap-up with a key takeaway

Tone: Professional but fun, like NPR meets a tech podcast. Use natural speech patterns—contractions, conversational flow, occasional humor.

Output ONLY the JSON array, no other text.`;

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<nav[\s\S]*?<\/nav>/gi, "")
    .replace(/<footer[\s\S]*?<\/footer>/gi, "")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

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
        const resp = await fetch(input.url, {
          headers: {
            "User-Agent": "Mozilla/5.0 (compatible; AIEdgeRadio/1.0)",
            Accept: "text/html,application/xhtml+xml",
          },
        });

        if (!resp.ok) {
          throw new Error(`Failed to fetch URL: ${resp.status} ${resp.statusText}`);
        }

        const html = await resp.text();
        content = stripHtml(html).slice(0, 6000);

        if (content.length < 50) {
          throw new Error("Could not extract enough content from the URL. Try a different page.");
        }
      } else if (input.topic) {
        content = `Topic: ${input.topic}. Create an engaging radio show about this topic with interesting facts, recent developments, and expert-level insights.`;
      } else {
        throw new Error("Please provide a URL or topic.");
      }

      // Generate script
      this.setState({ ...this.state, status: "scripting" });

      const workersai = createWorkersAI({ binding: this.env.AI });
      const { text: showScript } = await generateText({
        model: workersai("@cf/meta/llama-3.3-70b-instruct-fp8-fast"),
        system: SHOW_SYSTEM_PROMPT,
        prompt: `Create a radio show from this content:\n\n${content}`,
      });

      let segments: ShowSegment[];
      try {
        const jsonMatch = showScript.match(/\[[\s\S]*\]/);
        if (!jsonMatch) throw new Error("No JSON array found");
        segments = JSON.parse(jsonMatch[0]);

        // Validate structure
        if (!Array.isArray(segments) || segments.length < 2) {
          throw new Error("Invalid segment count");
        }

        segments = segments.slice(0, 3).map((seg, i) => ({
          role: (["host", "analyst", "outro"] as const)[i] || "host",
          title: seg.title || `Segment ${i + 1}`,
          script: seg.script || "",
        }));
      } catch {
        segments = [
          {
            role: "host",
            title: "Welcome to the Show",
            script:
              "Hey there, you're tuned into AI Edge Radio! We've got something really interesting lined up for you today. Stick around because you won't want to miss this one.",
          },
          {
            role: "analyst",
            title: "The Deep Dive",
            script:
              "So here's what caught our attention. There are some genuinely fascinating details worth unpacking here, and I think you'll find the implications pretty surprising.",
          },
          {
            role: "outro",
            title: "That's a Wrap",
            script:
              "And that's all for today's show! Thanks for tuning into AI Edge Radio. If you enjoyed this, share it with a friend. Until next time, stay curious!",
          },
        ];
      }

      // Generate audio
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
      this.setState({
        ...this.state,
        status: "error",
        error: err.message || "An unexpected error occurred",
      });
    }
  }

  @callable()
  async reset() {
    this.setState(this.initialState);
  }
}
