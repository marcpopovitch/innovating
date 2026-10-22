// Mascotte brique qui court pendant qu'un sous-agent travaille — reprise de Zzz-web (BrickMascot),
// géométrie du Figma de la marque, en rouge uniquement. Foulée, dandinement et clignement vivent
// dans globals.css (`.brick-mascot*`) ; `idle` les arrête quand l'agent a fini.
import { useId } from "react";

const VIEW_W = 288;
const VIEW_H = 306;

type Rect = { x: number; y: number; w: number; h: number };

const STUDS: Rect[] = [
  { x: 44, y: 0, w: 76, h: 39.2486 },
  { x: 170, y: 0, w: 76, h: 39.2486 },
];
const LEGS: Rect[] = [
  { x: 62, y: 218.35, w: 39.2486, h: 76 },
  { x: 188, y: 218.35, w: 39.2486, h: 76 },
];
const BODY: Rect = { x: 0, y: 35.5691, w: 288, h: 186.431 };

const FROM = "#FD808B";
const TO = "#FF5468";

/** Rectangle rempli + ombre intérieure + liseré intérieur de 3 (comme le Figma). */
function Block({ r, fill, filter, stroke, strokeOpacity }: { r: Rect; fill: string; filter: string; stroke: string; strokeOpacity: number }) {
  return (
    <>
      <rect x={r.x} y={r.y} width={r.w} height={r.h} fill={fill} filter={filter} />
      <rect x={r.x + 1.5} y={r.y + 1.5} width={r.w - 3} height={r.h - 3} fill="none" stroke={stroke} strokeOpacity={strokeOpacity} strokeWidth={3} />
    </>
  );
}

export function BrickMascot({ size = 18, idle = false, className = "" }: { size?: number; idle?: boolean; className?: string }) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const id = (name: string) => `bm-${name}-${uid}`;
  const fillPart = `url(#${id("part")})`;
  const filter = `url(#${id("inner")})`;
  const stroke = `url(#${id("edge")})`;

  return (
    <svg
      viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
      width={(size * VIEW_W) / VIEW_H}
      height={size}
      className={`brick-mascot shrink-0 overflow-visible ${idle ? "brick-mascot--idle" : ""} ${className}`}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={id("body")} x1="255.5" y1="42.9283" x2="121.039" y2="105.066" gradientUnits="userSpaceOnUse">
          <stop stopColor={FROM} />
          <stop offset="1" stopColor={TO} />
        </linearGradient>
        <linearGradient id={id("part")} x1="0.95" y1="0.05" x2="0.3" y2="0.3">
          <stop stopColor={FROM} />
          <stop offset="1" stopColor={TO} />
        </linearGradient>
        <linearGradient id={id("edge")} x1="0" y1="0" x2="1" y2="1">
          <stop stopColor="#FFFFFF" />
          <stop offset="1" stopColor="#6F6F6F" />
        </linearGradient>
        <filter id={id("inner")} x="-10%" y="-10%" width="120%" height="120%" colorInterpolationFilters="sRGB">
          <feColorMatrix in="SourceAlpha" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0" result="hardAlpha" />
          <feMorphology radius="1" operator="dilate" in="SourceAlpha" result="spread" />
          <feOffset in="spread" dx="7" dy="9" />
          <feGaussianBlur stdDeviation="5.25" />
          <feComposite in2="hardAlpha" operator="arithmetic" k2="-1" k3="1" />
          <feColorMatrix type="matrix" values="0 0 0 0 0.992 0 0 0 0 0.502 0 0 0 0 0.545 0 0 0 1 0" />
          <feBlend mode="normal" in2="SourceGraphic" />
        </filter>
      </defs>

      <ellipse className="brick-mascot-shadow" cx={VIEW_W / 2} cy={VIEW_H - 6} rx={100} ry={6} fill="#ff2e2e" opacity={0.18} />

      <g className="brick-mascot-body">
        {LEGS.map((leg, i) => (
          <g key={`leg${i}`} className={i === 0 ? "brick-mascot-leg-a" : "brick-mascot-leg-b"}>
            <Block r={leg} fill={fillPart} filter={filter} stroke={stroke} strokeOpacity={0.44} />
          </g>
        ))}
        {STUDS.map((stud, i) => (
          <Block key={`stud${i}`} r={stud} fill={fillPart} filter={filter} stroke={stroke} strokeOpacity={0.44} />
        ))}
        <Block r={BODY} fill={`url(#${id("body")})`} filter={filter} stroke={stroke} strokeOpacity={0.18} />
        <g className="brick-mascot-eyes">
          <ellipse cx="86" cy="128.5" rx="23" ry="33.5" fill="white" />
          <ellipse cx="201" cy="128.5" rx="23" ry="33.5" fill="white" />
        </g>
      </g>
    </svg>
  );
}
