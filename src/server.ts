import { routeAgentRequest } from "agents";
import { RadioAgent } from "./agents/radio";

export { RadioAgent };

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    // Route agent WebSocket and RPC requests
    const agentResponse = await routeAgentRequest(request, env);
    if (agentResponse) return agentResponse;

    // Serve static assets for everything else
    return env.ASSETS.fetch(request);
  },
} satisfies ExportedHandler<Env>;
