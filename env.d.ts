interface Env {
  AI: Ai;
  ELEVENLABS_API_KEY: string;
  AUDIO_BUCKET: R2Bucket;
  RadioAgent: DurableObjectNamespace;
  ASSETS: Fetcher;
}
