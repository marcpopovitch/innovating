"use client";

// Le globe des agents au travail : il tourne, et chaque recherche des agents trace un arc
// vers la source qu'elle interroge (Paris pour les codes et la jurisprudence, Bruxelles
// pour le droit européen, l'outre-mer quand il est cité). Sans recherche lisible, des arcs
// d'ambiance changent toutes les 1,2 s.
import { useEffect, useMemo, useState } from "react";
import { Globe, type GlobeArc, type GlobeMarker } from "@/components/ui/globe";
import { sourcesOf } from "@/components/agent-sources";
import type { AgentEvent } from "@/lib/types";

type Point = [number, number];

const PLACES = {
  paris: [48.8566, 2.3522],
  lyon: [45.764, 4.8357],
  marseille: [43.2965, 5.3698],
  lille: [50.6292, 3.0573],
  bordeaux: [44.8378, -0.5792],
  strasbourg: [48.5734, 7.7521],
  rennes: [48.1173, -1.6778],
  bruxelles: [50.8503, 4.3517],
  luxembourg: [49.6116, 6.1319],
  cayenne: [4.9224, -52.3135],
  "pointe-a-pitre": [16.2411, -61.5331],
  "saint-denis": [-20.8789, 55.4481],
  mamoudzou: [-12.7806, 45.2279],
} satisfies Record<string, Point>;

const MARKERS: GlobeMarker[] = Object.entries(PLACES).map(([id, location]) => ({ id, location }));

// Points de départ : les préfectures de région, à tour de rôle.
const ORIGINS: Point[] = [PLACES.rennes, PLACES.bordeaux, PLACES.marseille, PLACES.lyon, PLACES.lille, PLACES.strasbourg];
// Destination de chaque source (cf. agent-sources). Paris est trop proche des préfectures
// pour qu'un arc se voie : les sources nationales partent de l'outre-mer vers Paris.
const OUTRE_MER: Point[] = [PLACES.cayenne, PLACES["pointe-a-pitre"], PLACES["saint-denis"], PLACES.mamoudzou];

function arcFor(event: AgentEvent, i: number): GlobeArc | null {
  const sources = sourcesOf(event.message);
  if (sources.length === 0) return null;
  const origin = ORIGINS[event.id % ORIGINS.length];
  const far = OUTRE_MER[event.id % OUTRE_MER.length];
  const source = sources[i % sources.length];
  const [from, to] =
    source === "ue" ? [origin, event.id % 3 === 0 ? PLACES.luxembourg : PLACES.bruxelles]
    : source === "outremer" ? [PLACES.paris, far]
    : [far, PLACES.paris];
  return { id: `e${event.id}`, from, to };
}

function ambientArcs(tick: number): GlobeArc[] {
  return Array.from({ length: 3 }, (_, i) => ({
    id: `a${tick}-${i}`,
    from: ORIGINS[(tick * 3 + i * 5) % ORIGINS.length],
    to: [...OUTRE_MER, PLACES.bruxelles][(tick * 2 + i * 3) % 5],
  }));
}

const FRANCE_PHI = Math.PI - ((2.35 * Math.PI) / 180 - Math.PI / 2);

export function LoadingGlobe({ events = [], className = "" }: { events?: AgentEvent[]; className?: string }) {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setTick((t) => t + 1), 1200);
    return () => clearInterval(timer);
  }, []);

  // Les 4 dernières recherches lisibles ; à défaut, l'ambiance.
  const research = useMemo(
    () =>
      events
        .map((e, i) => arcFor(e, i))
        .filter((a): a is GlobeArc => a !== null)
        .slice(-4),
    [events],
  );
  const arcs = useMemo(() => (research.length > 0 ? research : ambientArcs(tick)), [research, tick]);

  return (
    <Globe
      markers={MARKERS}
      arcs={arcs}
      liveArcs
      phi={FRANCE_PHI}
      theta={0.3}
      speed={0.004}
      mapSamples={24000}
      mapBrightness={5}
      markerSize={0.02}
      arcWidth={0.8}
      arcHeight={0.3}
      className={className}
    />
  );
}
