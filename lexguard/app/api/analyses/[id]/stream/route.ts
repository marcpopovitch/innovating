import { db } from "@/lib/db";
import type { AgentEvent } from "@/lib/types";

// Flux SSE des étapes des agents, relu depuis la table events (robuste aux reconnexions).
export async function GET(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const client = await db();
  const encoder = new TextEncoder();
  let lastId = Number(request.headers.get("last-event-id") ?? 0);

  const stream = new ReadableStream({
    async start(controller) {
      const started = Date.now();
      while (!request.signal.aborted && Date.now() - started < 15 * 60_000) {
        const { rows } = await client.query<AgentEvent>(
          "select id::int, analysis_id, ts, agent, type, message, data from events where analysis_id = $1 and id > $2 order by id limit 200",
          [id, lastId],
        );
        for (const event of rows) {
          lastId = event.id;
          controller.enqueue(encoder.encode(`id: ${event.id}\ndata: ${JSON.stringify(event)}\n\n`));
          if (event.type === "fin") {
            controller.close();
            return;
          }
        }
        await new Promise((r) => setTimeout(r, 500));
      }
      controller.close();
    },
  });
  return new Response(stream, { headers: { "content-type": "text/event-stream", "cache-control": "no-cache, no-transform", connection: "keep-alive" } });
}
