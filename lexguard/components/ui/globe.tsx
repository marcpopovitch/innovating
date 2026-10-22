"use client";

// Globe interactif (cobe v2) : marqueurs et arcs, glisser pour tourner,
// étiquettes positionnées par CSS Anchor Positioning (fournies par cobe).
import createGlobe from "cobe";
import { useCallback, useEffect, useRef } from "react";

export interface GlobeMarker {
  id: string;
  location: [number, number];
  label?: string;
}

export interface GlobeArc {
  id: string;
  from: [number, number];
  to: [number, number];
  label?: string;
}

interface GlobeProps {
  markers?: GlobeMarker[];
  arcs?: GlobeArc[];
  className?: string;
  markerColor?: [number, number, number];
  baseColor?: [number, number, number];
  arcColor?: [number, number, number];
  glowColor?: [number, number, number];
  dark?: number;
  mapBrightness?: number;
  markerSize?: number;
  markerElevation?: number;
  arcWidth?: number;
  arcHeight?: number;
  speed?: number;
  phi?: number;
  theta?: number;
  diffuse?: number;
  mapSamples?: number;
  scale?: number;
}

const labelBase = {
  position: "absolute",
  bottom: "anchor(top)",
  left: "anchor(center)",
  translate: "-50% 0",
  marginBottom: 8,
  padding: "2px 7px",
  borderRadius: 6,
  fontFamily: "var(--font-geist-mono), monospace",
  fontSize: "0.62rem",
  letterSpacing: "0.06em",
  textTransform: "uppercase",
  whiteSpace: "nowrap",
  pointerEvents: "none",
  transition: "opacity 0.8s, filter 0.8s",
} as const;

export function Globe({
  markers = [],
  arcs = [],
  className = "",
  markerColor = [1, 0.18, 0.18],
  baseColor = [1, 1, 1],
  arcColor = [1, 0.18, 0.18],
  glowColor = [0.98, 0.97, 0.96],
  dark = 0,
  mapBrightness = 8,
  markerSize = 0.022,
  markerElevation = 0.01,
  arcWidth = 0.6,
  arcHeight = 0.2,
  speed = 0.0015,
  phi: initialPhi = -0.35,
  theta = 0.55,
  diffuse = 1.4,
  mapSamples = 16000,
  scale = 1,
}: GlobeProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pointer = useRef<{ x: number; y: number } | null>(null);
  const lastPointer = useRef<{ x: number; y: number; t: number } | null>(null);
  const drag = useRef({ phi: 0, theta: 0 });
  const velocity = useRef({ phi: 0, theta: 0 });
  const phiOffset = useRef(0);
  const thetaOffset = useRef(0);
  const paused = useRef(false);

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    pointer.current = { x: e.clientX, y: e.clientY };
    if (canvasRef.current) canvasRef.current.style.cursor = "grabbing";
    paused.current = true;
  }, []);

  const onPointerMove = useCallback((e: PointerEvent) => {
    if (!pointer.current) return;
    drag.current = { phi: (e.clientX - pointer.current.x) / 300, theta: (e.clientY - pointer.current.y) / 1000 };
    const now = Date.now();
    if (lastPointer.current) {
      const dt = Math.max(now - lastPointer.current.t, 1);
      const max = 0.15;
      velocity.current = {
        phi: Math.max(-max, Math.min(max, ((e.clientX - lastPointer.current.x) / dt) * 0.3)),
        theta: Math.max(-max, Math.min(max, ((e.clientY - lastPointer.current.y) / dt) * 0.08)),
      };
    }
    lastPointer.current = { x: e.clientX, y: e.clientY, t: now };
  }, []);

  const onPointerUp = useCallback(() => {
    if (pointer.current) {
      phiOffset.current += drag.current.phi;
      thetaOffset.current += drag.current.theta;
      drag.current = { phi: 0, theta: 0 };
      lastPointer.current = null;
    }
    pointer.current = null;
    if (canvasRef.current) canvasRef.current.style.cursor = "grab";
    paused.current = false;
  }, []);

  useEffect(() => {
    window.addEventListener("pointermove", onPointerMove, { passive: true });
    window.addEventListener("pointerup", onPointerUp, { passive: true });
    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
    };
  }, [onPointerMove, onPointerUp]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let globe: ReturnType<typeof createGlobe> | null = null;
    let frame = 0;
    let phi = initialPhi;
    let observer: ResizeObserver | null = null;

    const cobeMarkers = markers.map((m) => ({ location: m.location, size: markerSize, id: m.id }));
    const cobeArcs = arcs.map((a) => ({ from: a.from, to: a.to, id: a.id }));

    const init = () => {
      const width = canvas.offsetWidth;
      if (width === 0 || globe) return;
      globe = createGlobe(canvas, {
        devicePixelRatio: Math.min(window.devicePixelRatio || 1, 2),
        width,
        height: width,
        phi,
        theta,
        dark,
        diffuse,
        mapSamples,
        mapBrightness,
        baseColor,
        markerColor,
        glowColor,
        markerElevation,
        markers: cobeMarkers,
        arcs: cobeArcs,
        arcColor,
        arcWidth,
        arcHeight,
        opacity: 0.85,
        scale,
      });

      const animate = () => {
        if (!paused.current) {
          phi += speed;
          if (Math.abs(velocity.current.phi) > 0.0001 || Math.abs(velocity.current.theta) > 0.0001) {
            phiOffset.current += velocity.current.phi;
            thetaOffset.current += velocity.current.theta;
            velocity.current.phi *= 0.95;
            velocity.current.theta *= 0.95;
          }
          // Garde la France à l'écran : la rotation verticale revient doucement.
          if (thetaOffset.current < -0.4) thetaOffset.current += (-0.4 - thetaOffset.current) * 0.1;
          else if (thetaOffset.current > 0.4) thetaOffset.current += (0.4 - thetaOffset.current) * 0.1;
        }
        globe!.update({
          phi: phi + phiOffset.current + drag.current.phi,
          theta: theta + thetaOffset.current + drag.current.theta,
        });
        frame = requestAnimationFrame(animate);
      };
      animate();
      setTimeout(() => (canvas.style.opacity = "1"));
    };

    if (canvas.offsetWidth > 0) init();
    else {
      observer = new ResizeObserver((entries) => {
        if (entries[0]?.contentRect.width > 0) {
          observer?.disconnect();
          init();
        }
      });
      observer.observe(canvas);
    }

    return () => {
      observer?.disconnect();
      cancelAnimationFrame(frame);
      globe?.destroy();
    };
    // Les props sont des constantes de démonstration : on recrée le globe si elles changent.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [markers, arcs]);

  return (
    <div className={`relative aspect-square select-none ${className}`}>
      <canvas
        ref={canvasRef}
        onPointerDown={onPointerDown}
        style={{ width: "100%", height: "100%", cursor: "grab", opacity: 0, transition: "opacity 1.2s ease", borderRadius: "50%", touchAction: "none" }}
      />
      {markers.filter((m) => m.label).map((m) => (
        <div
          key={m.id}
          style={
            {
              ...labelBase,
              positionAnchor: `--cobe-${m.id}`,
              background: "#121111",
              color: "#fff",
              opacity: `var(--cobe-visible-${m.id}, 0)`,
              filter: `blur(calc((1 - var(--cobe-visible-${m.id}, 0)) * 8px))`,
            } as React.CSSProperties
          }
        >
          {m.label}
        </div>
      ))}
      {arcs
        .filter((a) => a.label)
        .map((a) => (
          <div
            key={a.id}
            style={
              {
                ...labelBase,
                positionAnchor: `--cobe-arc-${a.id}`,
                background: "#ff2e2e",
                color: "#fff",
                boxShadow: "0 4px 14px #ff2e2e52",
                opacity: `var(--cobe-visible-arc-${a.id}, 0)`,
                filter: `blur(calc((1 - var(--cobe-visible-arc-${a.id}, 0)) * 8px))`,
              } as React.CSSProperties
            }
          >
            {a.label}
          </div>
        ))}
    </div>
  );
}
