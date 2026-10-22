"use client";

// Le globe des agents au travail : il tourne, et les connexions entre préfectures,
// Bruxelles et l'outre-mer changent toutes les 1,2 s pendant que la requête tourne.
import { useEffect, useMemo, useState } from "react";
import { Globe, type GlobeArc, type GlobeMarker } from "@/components/ui/globe";

const POINTS: Array<{ id: string; location: [number, number] }> = [
  { id: "paris", location: [48.8566, 2.3522] },
  { id: "lyon", location: [45.764, 4.8357] },
  { id: "marseille", location: [43.2965, 5.3698] },
  { id: "lille", location: [50.6292, 3.0573] },
  { id: "bordeaux", location: [44.8378, -0.5792] },
  { id: "strasbourg", location: [48.5734, 7.7521] },
  { id: "rennes", location: [48.1173, -1.6778] },
  { id: "bruxelles", location: [50.8503, 4.3517] },
  { id: "cayenne", location: [4.9224, -52.3135] },
  { id: "pointe-a-pitre", location: [16.2411, -61.5331] },
  { id: "saint-denis", location: [-20.8789, 55.4481] },
  { id: "mamoudzou", location: [-12.7806, 45.2279] },
];

const MARKERS: GlobeMarker[] = POINTS.map((p) => ({ id: p.id, location: p.location }));

// Paires longues uniquement : en métropole les arcs seraient trop courts pour se voir.
const FAR = ["cayenne", "pointe-a-pitre", "saint-denis", "mamoudzou", "bruxelles"];

function randomArcs(tick: number): GlobeArc[] {
  const near = POINTS.filter((p) => !FAR.includes(p.id));
  const far = POINTS.filter((p) => FAR.includes(p.id));
  return Array.from({ length: 3 }, (_, i) => {
    const a = near[(tick * 3 + i * 5) % near.length];
    const b = far[(tick * 2 + i * 3) % far.length];
    return { id: `a${tick}-${i}`, from: a.location, to: b.location };
  });
}

const FRANCE_PHI = Math.PI - ((2.35 * Math.PI) / 180 - Math.PI / 2);

export function LoadingGlobe({ className = "" }: { className?: string }) {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setTick((t) => t + 1), 1200);
    return () => clearInterval(timer);
  }, []);
  const arcs = useMemo(() => randomArcs(tick), [tick]);

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
