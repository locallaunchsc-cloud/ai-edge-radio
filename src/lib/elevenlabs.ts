import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";

export function createClient(apiKey: string) {
  return new ElevenLabsClient({ apiKey });
}

export async function streamToDataUri(
  stream: ReadableStream<Uint8Array> | AsyncIterable<Uint8Array>
): Promise<string> {
  const chunks: Uint8Array[] = [];
  if (Symbol.asyncIterator in Object(stream)) {
    for await (const chunk of stream as AsyncIterable<Uint8Array>) {
      chunks.push(chunk);
    }
  } else {
    const reader = (stream as ReadableStream<Uint8Array>).getReader();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) chunks.push(value);
    }
  }
  const totalLength = chunks.reduce((acc, c) => acc + c.length, 0);
  const merged = new Uint8Array(totalLength);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.length;
  }
  const base64 = btoa(String.fromCharCode(...merged));
  return "data:audio/mpeg;base64," + base64;
}
