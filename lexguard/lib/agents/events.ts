import { db } from "../db";
import type { AgentEvent, AgentName } from "../types";

/** Écrit une étape d'agent : l'interface la lit en direct via SSE. */
export async function emit(analysisId: string, agent: AgentName, type: AgentEvent["type"], message: string, data?: unknown) {
  const client = await db();
  await client.query("insert into events (analysis_id, agent, type, message, data) values ($1, $2, $3, $4, $5)", [
    analysisId,
    agent,
    type,
    message,
    data === undefined ? null : JSON.stringify(data),
  ]);
}
