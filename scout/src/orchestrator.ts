// URL → identité légale → 6 sous-agents en parallèle → synthèse.
import Anthropic from "@anthropic-ai/sdk";
import { type Evidence, Ledger, type Pod, PODS } from "./evidence.js";
import { type Identity, resolveIdentity } from "./identity.js";
import { type PodRun, runPod, synthesize, type Synthesis } from "./agents.js";
import { sourceStatus } from "./sources/catalog.js";

export interface Analysis {
  generated_at: string;
  identity: Omit<Identity, "homepage">;
  pods: PodRun[];
  synthesis: Synthesis | null;
  evidence: Evidence[];
  sources: ReturnType<typeof sourceStatus>;
  errors: string[];
  duration_s: number;
}

export interface Options {
  pods?: Pod[];
  /** Sans LLM : seulement l'identité et les registres (aucune clé requise). */
  collectOnly?: boolean;
  log?: (scope: string, msg: string) => void;
}

export async function analyse(input: string, options: Options = {}): Promise<Analysis> {
  const started = Date.now();
  const log = options.log ?? (() => {});
  const ledger = new Ledger();
  const errors: string[] = [];

  const identity = await resolveIdentity(input, ledger, (msg) => log("identité", msg));
  let pods: PodRun[] = [];
  let synthesis: Synthesis | null = null;

  if (!options.collectOnly) {
    const client = new Anthropic();
    const settled = await Promise.allSettled(
      (options.pods ?? [...PODS]).map((pod) => runPod(client, pod, identity, ledger, (p, msg) => log(p, msg))),
    );
    pods = settled.flatMap((s, i) => {
      if (s.status === "fulfilled") return [s.value];
      errors.push(`${(options.pods ?? PODS)[i]} : ${s.reason instanceof Error ? s.reason.message : String(s.reason)}`);
      return [];
    });
    if (pods.length) {
      log("synthèse", "Rédaction de la note de comité et du bear case");
      synthesis = await synthesize(client, identity, pods, ledger.all()).catch((error) => {
        errors.push(`synthèse : ${error instanceof Error ? error.message : String(error)}`);
        return null;
      });
    }
  }

  const { homepage: _homepage, ...publicIdentity } = identity;
  return {
    generated_at: new Date().toISOString(),
    identity: publicIdentity,
    pods,
    synthesis,
    evidence: ledger.all(),
    sources: sourceStatus(),
    errors,
    duration_s: Math.round((Date.now() - started) / 1000),
  };
}
