"use client";

import { useMemo } from "react";
import { useI18n } from "@/components/lang-provider";
import { Globe, type GlobeArc, type GlobeMarker } from "@/components/ui/globe";

// Préfectures (démonstration) et Bruxelles, d'où vient le droit de l'UE. En métropole les
// points sont trop proches pour être tous étiquetés : une seule étiquette par zone éloignée.
const buildMarkers = (labels: { france: string; guyane: string; reunion: string }): GlobeMarker[] => [
  { id: "paris", location: [48.8566, 2.3522], label: labels.france },
  { id: "lyon", location: [45.764, 4.8357] },
  { id: "marseille", location: [43.2965, 5.3698] },
  { id: "lille", location: [50.6292, 3.0573] },
  { id: "bordeaux", location: [44.8378, -0.5792] },
  { id: "strasbourg", location: [48.5734, 7.7521] },
  { id: "rennes", location: [48.1173, -1.6778] },
  { id: "bruxelles", location: [50.8503, 4.3517] },
  { id: "cayenne", location: [4.9224, -52.3135], label: labels.guyane },
  { id: "saint-denis", location: [-20.8789, 55.4481], label: labels.reunion },
];

// Pas d'arcs entre villes de métropole (trop courts, ils faisaient un nœud) :
// seulement les liaisons longues, Paris → outre-mer.
const ARCS: GlobeArc[] = [
  { id: "jo-cayenne", from: [48.8566, 2.3522], to: [4.9224, -52.3135] },
  { id: "jo-reunion", from: [48.8566, 2.3522], to: [-20.8789, 55.4481] },
];

// Angle qui place la longitude de Paris face à la caméra (formule de cobe).
const FRANCE_PHI = Math.PI - ((2.35 * Math.PI) / 180 - Math.PI / 2);

export function FranceGlobe({ className = "" }: { className?: string }) {
  const { t } = useI18n();
  const markers = useMemo(
    () => buildMarkers({ france: t("landing.globe.france"), guyane: t("landing.globe.guyane"), reunion: t("landing.globe.reunion") }),
    [t],
  );
  return (
    <Globe
      markers={markers}
      arcs={ARCS}
      phi={FRANCE_PHI}
      theta={0.32}
      speed={0.0002}
      scale={1}
      mapSamples={40000}
      mapBrightness={5}
      markerSize={0.016}
      arcWidth={0.7}
      arcHeight={0.28}
      className={className}
    />
  );
}
