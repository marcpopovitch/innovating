"use client";

import { Globe, type GlobeArc, type GlobeMarker } from "@/components/ui/globe";

// Préfectures de région (démonstration) et Bruxelles, d'où vient le droit de l'UE.
const MARKERS: GlobeMarker[] = [
  { id: "paris", location: [48.8566, 2.3522], label: "Paris" },
  { id: "lyon", location: [45.764, 4.8357] },
  { id: "marseille", location: [43.2965, 5.3698], label: "Marseille" },
  { id: "lille", location: [50.6292, 3.0573] },
  { id: "bordeaux", location: [44.8378, -0.5792], label: "Bordeaux" },
  { id: "strasbourg", location: [48.5734, 7.7521] },
  { id: "rennes", location: [48.1173, -1.6778] },
  { id: "bruxelles", location: [50.8503, 4.3517], label: "Bruxelles" },
];

const ARCS: GlobeArc[] = [
  { id: "ue", from: [50.8503, 4.3517], to: [48.8566, 2.3522], label: "Droit UE" },
  { id: "jo-lyon", from: [48.8566, 2.3522], to: [45.764, 4.8357] },
  { id: "jo-marseille", from: [48.8566, 2.3522], to: [43.2965, 5.3698] },
  { id: "jo-bordeaux", from: [48.8566, 2.3522], to: [44.8378, -0.5792] },
  { id: "jo-rennes", from: [48.8566, 2.3522], to: [48.1173, -1.6778] },
  { id: "jo-strasbourg", from: [48.8566, 2.3522], to: [48.5734, 7.7521] },
];

// Angle qui place la longitude de Paris face à la caméra (formule de cobe).
const FRANCE_PHI = Math.PI - ((2.35 * Math.PI) / 180 - Math.PI / 2);

export function FranceGlobe({ className = "" }: { className?: string }) {
  return <Globe markers={MARKERS} arcs={ARCS} phi={FRANCE_PHI} theta={0.62} speed={0.0002} scale={1.35} className={className} />;
}
