# AI Edge Radio

> Turn any website or topic into a live AI radio show — powered by Cloudflare Workers, Agents SDK, and ElevenLabs.

Built for **ElevenHacks Hackathon**.

## What it does

Paste a URL or type a topic, and AI Edge Radio will:

1. **Fetch & parse** the web content (or generate from topic)
2. **Write a radio show script** using Cloudflare Workers AI (Llama 3.3 70B)
3. **Generate realistic voice audio** with ElevenLabs text-to-speech
4. **Stream it back** as a multi-segment radio show with host + analyst voices

All running on the edge — no origin servers, no cold starts.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Runtime | Cloudflare Workers |
| Agent Framework | Cloudflare Agents SDK (Durable Objects) |
| AI Model | `@cf/meta/llama-3.3-70b-instruct-fp8-fast` via Workers AI |
| Voice Synthesis | ElevenLabs `eleven_flash_v2_5` |
| Frontend | React 19 + Vite |
| Storage | R2 (audio bucket) |

## Architecture

```
User Input (URL/Topic)
    |
    v
[Cloudflare Worker] --> [RadioAgent (Durable Object)]
                              |
                    +---------+---------+
                    |                   |
              [Workers AI]      [ElevenLabs API]
              Script Gen         Voice Synthesis
                    |                   |
                    +---------+---------+
                              |
                        [React Frontend]
                        Audio Playback
```

## How to Run

### Prerequisites
- Node.js 18+
- Cloudflare account with Workers AI enabled
- ElevenLabs API key

### Setup

```bash
git clone https://github.com/locallaunchsc-cloud/ai-edge-radio.git
cd ai-edge-radio
npm install
```

Create a `.env` file:
```
ELEVENLABS_API_KEY=your_key_here
```

### Development
```bash
npm run dev        # Vite dev server
npm run start      # Wrangler dev (Workers runtime)
```

### Deploy
```bash
npx wrangler secret put ELEVENLABS_API_KEY
npm run deploy
```

## Project Structure

```
src/
  agents/
    radio.ts        # RadioAgent - Durable Object handling show generation
  lib/
    elevenlabs.ts   # ElevenLabs client wrapper
  app.tsx           # React UI with visualizer + audio player
  client.tsx        # React entry point
  server.ts         # Cloudflare Worker entry
  styles.css        # Radio-themed dark UI
```

## Key Features

- **Two input modes**: URL scraping or free-form topic
- **Multi-voice shows**: Host voice (George) + Analyst voice (Sarah)
- **Real-time state updates**: Watch script generation and audio synthesis progress live via WebSocket
- **Audio visualizer**: Animated equalizer during playback
- **Edge-native**: Entire backend runs on Cloudflare's global network
- **Stateful agents**: Durable Objects maintain show state across requests

## License

MIT
