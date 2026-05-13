/**
 * OrganicLoader — 32 blobby, real-estate-themed SVG loaders.
 *
 * Sourced from a Claude Design handoff bundle (2026-05-13). The original
 * 200×200 SVGs are kept faithful to the design; what's React-y is just the
 * thin wrapper. Two public exports:
 *
 *   <OrganicLoader id={1..32} size={px} />
 *       Render a specific loader by id. Useful when you want a stable,
 *       contextual loader (e.g. property search → id 22 "map pin drop").
 *
 *   <RotatingOrganicLoader category? size? />
 *       Picks a random loader on mount, à la Anthropic's site. Pass
 *       `category="realestate"` to scope to the real-estate themed subset
 *       (ids 21-32) — fits property/search/skip-trace contexts. Default
 *       category "all" pulls from the full pool.
 *
 * Color theming uses `currentColor` for the "ink" so the loader inverts
 * cleanly between light and dark surfaces (set `text-foreground` on a
 * parent, or pass an explicit `inkColor` prop). The cyan accent stays
 * constant — it's the brand color.
 *
 * Animations are all CSS keyframes injected once via a <style> tag scoped
 * by an ID prefix; the same file mounted twice won't double-inject.
 */
import { useId, useMemo } from 'react';
import { cn } from '@/lib/utils';

const CYAN = '#00c4c8';

type LoaderCategory = 'all' | 'generic' | 'realestate';

interface OrganicLoaderProps {
  /** 1-32; selects a specific loader */
  id: number;
  /** Pixel size. Default 96. Scales the 200×200 viewBox uniformly. */
  size?: number;
  /** Ink color. Defaults to currentColor so the loader theme-inverts. */
  inkColor?: string;
  /** Cyan accent color. Defaults to the brand cyan #00c4c8. */
  accentColor?: string;
  className?: string;
  'aria-label'?: string;
}

interface RotatingOrganicLoaderProps extends Omit<OrganicLoaderProps, 'id'> {
  /** Scope the rotation to a subset. Default "all". */
  category?: LoaderCategory;
}

const REALESTATE_IDS = [21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32];
const GENERIC_IDS = Array.from({ length: 20 }, (_, i) => i + 1);
const ALL_IDS = [...GENERIC_IDS, ...REALESTATE_IDS];

function poolFor(category: LoaderCategory): number[] {
  if (category === 'realestate') return REALESTATE_IDS;
  if (category === 'generic') return GENERIC_IDS;
  return ALL_IDS;
}

/* -------------------------------------------------------------------------- */
/*  Shared CSS keyframes — injected once per page                             */
/* -------------------------------------------------------------------------- */

const KEYFRAMES_ID = 'organic-loader-keyframes-v1';
const KEYFRAMES_CSS = `
  @keyframes ol-breathe { 0%,100% { transform: scale(0.92); } 50% { transform: scale(1.08); } }
  @keyframes ol-meta-x-a { 0%,100% { transform: translateX(-28px); } 50% { transform: translateX(0); } }
  @keyframes ol-meta-x-b { 0%,100% { transform: translateX(28px); } 50% { transform: translateX(0); } }
  @keyframes ol-orbit { to { transform: rotate(360deg); } }
  @keyframes ol-spin-slow { to { transform: rotate(360deg); } }
  @keyframes ol-fall {
    0% { transform: translateY(-60px) scaleY(.7); }
    50% { transform: translateY(40px) scaleY(1.15); }
    80% { transform: translateY(40px) scaleY(.9); }
    100% { transform: translateY(-60px) scaleY(.7); }
  }
  @keyframes ol-puddle {
    0%,40% { transform: scaleX(.4); opacity: 0; }
    60% { transform: scaleX(1.1); opacity: 1; }
    100% { transform: scaleX(.4); opacity: 0; }
  }
  @keyframes ol-squish {
    0%,100% { transform: translateY(-20px) scale(1,1); }
    45% { transform: translateY(40px) scale(1.25,.75); }
    60% { transform: translateY(40px) scale(1.1,.9); }
  }
  @keyframes ol-splat {
    0% { transform: translate(0,0) scale(.4); opacity: 0; }
    30% { opacity: 1; }
    100% { transform: var(--ol-end) scale(1); opacity: 0; }
  }
  @keyframes ol-drip {
    0% { transform: translateY(-50px) scaleY(.6); }
    100% { transform: translateY(180px) scaleY(1.4); }
  }
  @keyframes ol-rise-a { 0%,100% { transform: translateY(40px) scale(1); } 50% { transform: translateY(-50px) scale(1.1); } }
  @keyframes ol-rise-b { 0%,100% { transform: translateY(-30px) scale(1); } 50% { transform: translateY(40px) scale(.9); } }
  @keyframes ol-rise-c { 0%,100% { transform: translateY(20px) scale(.9); } 50% { transform: translateY(-20px) scale(1.05); } }
  @keyframes ol-converge-a { 0%,100% { transform: translate(-40px,-25px); } 50% { transform: translate(0,0); } }
  @keyframes ol-converge-b { 0%,100% { transform: translate(40px,-25px); } 50% { transform: translate(0,0); } }
  @keyframes ol-converge-c { 0%,100% { transform: translate(0,45px); } 50% { transform: translate(0,0); } }
  @keyframes ol-ripple {
    0% { transform: scale(.2); opacity: 0; }
    20% { opacity: 1; }
    100% { transform: scale(1.4); opacity: 0; }
  }
  @keyframes ol-dash { 0% { stroke-dashoffset: 600; } 100% { stroke-dashoffset: 0; } }
  @keyframes ol-squig { 0%,100% { transform: translateX(-20px); } 50% { transform: translateX(20px); } }
  @keyframes ol-swing { 0%,100% { transform: rotate(-22deg); } 50% { transform: rotate(22deg); } }
  @keyframes ol-blink { 0%,60%,100% { opacity: 1; } 70%,90% { opacity: .25; } }
  @keyframes ol-pin-drop {
    0% { transform: translateY(-90px) scale(1,.85); }
    55% { transform: translateY(0) scale(1.15,.9); }
    70% { transform: translateY(0) scale(.95,1.05); }
    100% { transform: translateY(-90px) scale(1,.85); }
  }
  @keyframes ol-pin-ripple {
    0%,45% { transform: scale(.2); opacity: 0; }
    55% { opacity: 1; }
    100% { transform: scale(1.3); opacity: 0; }
  }
  @keyframes ol-stamp {
    0% { transform: translateY(-40px) scale(.7); }
    35% { transform: translateY(0) scale(1.1); }
    55% { transform: translateY(0) scale(1); }
    100% { transform: translateY(-40px) scale(.7); opacity: 1; }
  }
  @keyframes ol-stamp-splat {
    0%,30% { transform: scale(.2); opacity: 0; }
    45% { transform: scale(1); opacity: 1; }
    100% { transform: scale(1.3); opacity: 0; }
  }
  @keyframes ol-brick {
    0%,5% { transform: translateY(-50px); opacity: 0; }
    20%,95% { transform: translateY(0); opacity: 1; }
    100% { transform: translateY(0); opacity: 0; }
  }
  @keyframes ol-key-turn { 0%,100% { transform: rotate(0deg); } 45%,55% { transform: rotate(90deg); } }
  @keyframes ol-coin {
    0%,5% { transform: translateY(60px) scale(.6,1.2); opacity: 0; }
    20%,90% { transform: translateY(0) scale(1,1); opacity: 1; }
    100% { transform: translateY(0) scale(1,1); opacity: 0; }
  }
  @keyframes ol-ring-fill {
    0% { stroke-dashoffset: 440; }
    60% { stroke-dashoffset: 0; }
    100% { stroke-dashoffset: 0; opacity: 0; }
  }
  @keyframes ol-node-pulse { 0%,100% { transform: scale(1); } 50% { transform: scale(1.25); } }
  @keyframes ol-link-flow { 0% { stroke-dashoffset: 0; } 100% { stroke-dashoffset: -40; } }
  @keyframes ol-sign-swing { 0%,100% { transform: rotate(-14deg); } 50% { transform: rotate(14deg); } }

  /* Per-loader class hooks (transform-origins + animation bindings) */
  .ol .ol-blob { transform-origin: 50% 50%; animation: ol-breathe 2.2s cubic-bezier(.5,0,.5,1) infinite; }
  .ol .ol-meta-a { animation: ol-meta-x-a 1.6s ease-in-out infinite; }
  .ol .ol-meta-b { animation: ol-meta-x-b 1.6s ease-in-out infinite; }
  .ol .ol-ring { transform-origin: 100px 100px; animation: ol-orbit 2.4s linear infinite; }
  .ol .ol-drop { transform-origin: 50% 50%; animation: ol-fall 1.8s cubic-bezier(.55,.1,.5,.9) infinite; }
  .ol .ol-puddle { transform-origin: 100px 150px; animation: ol-puddle 1.8s ease-out infinite; }
  .ol .ol-ball { transform-origin: 100px 130px; animation: ol-squish 1.4s cubic-bezier(.5,0,.5,1) infinite; }
  .ol .ol-wave { transform-origin: 100px 100px; animation: ol-spin-slow 6s linear infinite; }
  .ol .ol-amoeba { transform-origin: 100px 100px; animation: ol-spin-slow 4s linear infinite; }
  .ol .ol-dot { transform-origin: 100px 100px; animation: ol-splat 1.8s ease-out infinite; }
  .ol .ol-drip-anim { animation: ol-drip 1.6s cubic-bezier(.6,.2,.7,.9) infinite; }
  .ol .ol-ringbump { transform-origin: 100px 100px; animation: ol-spin-slow 3s linear infinite; }
  .ol .ol-lava-a { animation: ol-rise-a 2.6s ease-in-out infinite; }
  .ol .ol-lava-b { animation: ol-rise-b 2.6s ease-in-out infinite; }
  .ol .ol-lava-c { animation: ol-rise-c 2.6s ease-in-out infinite; }
  .ol .ol-tend { transform-origin: 100px 100px; animation: ol-spin-slow 2.2s linear infinite; }
  .ol .ol-conv-a { animation: ol-converge-a 1.8s ease-in-out infinite; }
  .ol .ol-conv-b { animation: ol-converge-b 1.8s ease-in-out infinite; }
  .ol .ol-conv-c { animation: ol-converge-c 1.8s ease-in-out infinite; }
  .ol .ol-rip { transform-origin: 100px 100px; animation: ol-ripple 2.4s ease-out infinite; }
  .ol .ol-worm { animation: ol-dash 2.2s linear infinite; }
  .ol .ol-satring { transform-origin: 100px 100px; animation: ol-spin-slow 1.8s linear infinite; }
  .ol .ol-core { transform-origin: 100px 100px; animation: ol-breathe 2.4s ease-in-out infinite; }
  .ol .ol-squig { animation: ol-squig 1.8s ease-in-out infinite; }
  .ol .ol-halo { transform-origin: 100px 100px; animation: ol-ripple 2.4s ease-out infinite; }
  .ol .ol-arm { transform-origin: 100px 30px; animation: ol-swing 1.6s cubic-bezier(.5,0,.5,1) infinite; }
  .ol .ol-house { transform-origin: 100px 110px; animation: ol-breathe 2.4s ease-in-out infinite; }
  .ol .ol-window { animation: ol-blink 2.4s ease-in-out infinite; }
  .ol .ol-pin { transform-origin: 100px 130px; animation: ol-pin-drop 1.8s cubic-bezier(.5,0,.5,1) infinite; }
  .ol .ol-pin-ripple { transform-origin: 100px 155px; animation: ol-pin-ripple 1.8s ease-out infinite; }
  .ol .ol-sweep { transform-origin: 100px 100px; animation: ol-orbit 2.2s linear infinite; }
  .ol .ol-ping { transform-origin: 100px 100px; animation: ol-ripple 2.2s ease-out infinite; }
  .ol .ol-stamp { transform-origin: 100px 110px; animation: ol-stamp 1.8s cubic-bezier(.6,0,.4,1) infinite; }
  .ol .ol-stamp-splat { transform-origin: 100px 110px; animation: ol-stamp-splat 1.8s ease-out infinite; }
  .ol .ol-brick { animation: ol-brick 2.4s cubic-bezier(.4,1.4,.5,1) infinite; }
  .ol .ol-key { transform-origin: 70px 100px; animation: ol-key-turn 2.2s cubic-bezier(.6,0,.4,1) infinite; }
  .ol .ol-coin { animation: ol-coin 2.8s cubic-bezier(.4,1.3,.5,1) infinite; }
  .ol .ol-hot { animation: ol-ripple 2.4s ease-out infinite; }
  .ol .ol-ring-rot { transform-origin: 100px 100px; animation: ol-orbit 4s linear infinite; }
  .ol .ol-arc { animation: ol-ring-fill 2.4s cubic-bezier(.5,0,.5,1) infinite; }
  .ol .ol-mag { transform-origin: 100px 100px; animation: ol-spin-slow 2.4s linear infinite; }
  .ol .ol-node { animation: ol-node-pulse 1.8s ease-in-out infinite; }
  .ol .ol-link { animation: ol-link-flow 1.6s linear infinite; }
  .ol .ol-sign { transform-origin: 100px 70px; animation: ol-sign-swing 1.8s cubic-bezier(.5,0,.5,1) infinite; }

  @media (prefers-reduced-motion: reduce) {
    .ol * { animation-duration: 0.001ms !important; animation-iteration-count: 1 !important; }
  }
`;

function ensureKeyframes() {
  if (typeof document === 'undefined') return;
  if (document.getElementById(KEYFRAMES_ID)) return;
  const tag = document.createElement('style');
  tag.id = KEYFRAMES_ID;
  tag.textContent = KEYFRAMES_CSS;
  document.head.appendChild(tag);
}

/* -------------------------------------------------------------------------- */
/*  Goo filter — extracted so each SVG references a per-instance unique id    */
/* -------------------------------------------------------------------------- */

function GooFilter({ id, stdDeviation = 6, matrix = '18 -7' }: { id: string; stdDeviation?: number; matrix?: string }) {
  return (
    <defs>
      <filter id={id}>
        <feGaussianBlur in="SourceGraphic" stdDeviation={stdDeviation} />
        <feColorMatrix values={`1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 ${matrix}`} />
      </filter>
    </defs>
  );
}

/* -------------------------------------------------------------------------- */
/*  Loader bodies — each returns the SVG inner content for an id              */
/* -------------------------------------------------------------------------- */

function LoaderBody({ id, ink, cyan, uid }: { id: number; ink: string; cyan: string; uid: string }) {
  switch (id) {
    case 1:
      return (
        <g className="ol-blob">
          <path fill={ink} d="M100,30 C140,30 170,60 170,100 C170,140 140,170 100,170 C60,170 30,140 30,100 C30,60 60,30 100,30 Z" />
          <circle cx="100" cy="100" r="22" fill={cyan} />
        </g>
      );
    case 2:
      return (
        <path fill={ink}>
          <animate
            attributeName="d"
            dur="3.2s"
            repeatCount="indefinite"
            values="M100,35 C145,35 165,70 165,105 C165,150 130,165 100,165 C70,165 35,150 35,105 C35,70 55,35 100,35 Z;M100,40 C150,30 170,80 160,115 C150,160 115,170 90,160 C55,150 30,120 40,85 C50,55 70,45 100,40 Z;M100,30 C135,40 170,55 165,100 C160,140 140,170 100,165 C60,160 30,135 35,95 C40,55 70,30 100,30 Z;M100,35 C145,35 165,70 165,105 C165,150 130,165 100,165 C70,165 35,150 35,105 C35,70 55,35 100,35 Z"
            calcMode="spline"
            keySplines="0.5 0 0.5 1; 0.5 0 0.5 1; 0.5 0 0.5 1"
          />
        </path>
      );
    case 3:
      return (
        <>
          <GooFilter id={`${uid}-3`} stdDeviation={6} />
          <g filter={`url(#${uid}-3)`}>
            <circle className="ol-meta-a" cx="100" cy="100" r="32" fill={ink} />
            <circle className="ol-meta-b" cx="100" cy="100" r="32" fill={cyan} />
          </g>
        </>
      );
    case 4:
      return (
        <>
          <GooFilter id={`${uid}-4`} stdDeviation={7} />
          <g filter={`url(#${uid}-4)`}>
            <circle cx="100" cy="100" r="26" fill={ink} />
            <g className="ol-ring">
              <circle cx="100" cy="50" r="16" fill={ink} />
              <circle cx="143" cy="125" r="16" fill={cyan} />
              <circle cx="57" cy="125" r="16" fill={ink} />
            </g>
          </g>
        </>
      );
    case 5:
      return (
        <>
          <GooFilter id={`${uid}-5`} stdDeviation={5} matrix="16 -6" />
          <g filter={`url(#${uid}-5)`}>
            <ellipse className="ol-drop" cx="100" cy="100" rx="18" ry="22" fill={ink} />
            <ellipse className="ol-puddle" cx="100" cy="150" rx="34" ry="6" fill={cyan} />
          </g>
        </>
      );
    case 6:
      return (
        <>
          <ellipse className="ol-ball" cx="100" cy="130" rx="28" ry="28" fill={ink} />
          <ellipse cx="100" cy="172" rx="34" ry="3" fill={cyan} opacity=".5" />
        </>
      );
    case 7:
      return (
        <g className="ol-wave">
          <path fill={ink} d="M100,40 C130,40 150,55 155,80 C160,105 145,115 150,140 C155,165 125,170 100,165 C75,170 45,165 50,140 C55,115 40,105 45,80 C50,55 70,40 100,40 Z" />
          <circle cx="100" cy="100" r="14" fill={cyan} />
        </g>
      );
    case 8:
      return (
        <g className="ol-amoeba">
          <path fill={cyan} d="M100,30 C135,32 168,55 165,95 C162,135 130,168 95,165 C55,162 30,130 35,90 C40,55 65,28 100,30 Z" />
          <path fill={ink} d="M100,55 C125,55 145,75 145,100 C145,125 125,145 100,145 C75,145 55,125 55,100 C55,75 75,55 100,55 Z" />
        </g>
      );
    case 9:
      return (
        <>
          <GooFilter id={`${uid}-9`} stdDeviation={4} matrix="14 -5" />
          <g filter={`url(#${uid}-9)`}>
            <circle cx="100" cy="100" r="14" fill={ink} />
            <circle className="ol-dot" cx="100" cy="100" r="8" fill={ink} style={{ '--ol-end': 'translate(50px,0)' } as React.CSSProperties} />
            <circle className="ol-dot" cx="100" cy="100" r="8" fill={cyan} style={{ '--ol-end': 'translate(-50px,0)', animationDelay: '.2s' } as React.CSSProperties} />
            <circle className="ol-dot" cx="100" cy="100" r="8" fill={ink} style={{ '--ol-end': 'translate(35px,-35px)', animationDelay: '.4s' } as React.CSSProperties} />
            <circle className="ol-dot" cx="100" cy="100" r="8" fill={ink} style={{ '--ol-end': 'translate(-35px,35px)', animationDelay: '.6s' } as React.CSSProperties} />
            <circle className="ol-dot" cx="100" cy="100" r="8" fill={cyan} style={{ '--ol-end': 'translate(35px,35px)', animationDelay: '.8s' } as React.CSSProperties} />
            <circle className="ol-dot" cx="100" cy="100" r="8" fill={ink} style={{ '--ol-end': 'translate(-35px,-35px)', animationDelay: '1s' } as React.CSSProperties} />
          </g>
        </>
      );
    case 10:
      return (
        <>
          <GooFilter id={`${uid}-10`} stdDeviation={5} matrix="16 -6" />
          <g filter={`url(#${uid}-10)`}>
            <ellipse className="ol-drip-anim" cx="100" cy="0" rx="10" ry="14" fill={ink} />
            <ellipse className="ol-drip-anim" cx="100" cy="0" rx="10" ry="14" fill={cyan} style={{ animationDelay: '-.55s' }} />
            <ellipse className="ol-drip-anim" cx="100" cy="0" rx="10" ry="14" fill={ink} style={{ animationDelay: '-1.1s' }} />
          </g>
        </>
      );
    case 11:
      return (
        <>
          <GooFilter id={`${uid}-11`} stdDeviation={5} matrix="16 -6" />
          <g filter={`url(#${uid}-11)`} className="ol-ringbump">
            <circle cx="100" cy="40" r="14" fill={ink} />
            <circle cx="142" cy="58" r="14" fill={ink} />
            <circle cx="160" cy="100" r="14" fill={ink} />
            <circle cx="142" cy="142" r="14" fill={ink} />
            <circle cx="100" cy="160" r="14" fill={cyan} />
            <circle cx="58" cy="142" r="14" fill={ink} />
            <circle cx="40" cy="100" r="14" fill={ink} />
            <circle cx="58" cy="58" r="14" fill={ink} />
          </g>
        </>
      );
    case 12:
      return (
        <>
          <GooFilter id={`${uid}-12`} stdDeviation={8} />
          <g filter={`url(#${uid}-12)`}>
            <circle className="ol-lava-a" cx="70" cy="100" r="22" fill={ink} />
            <circle className="ol-lava-b" cx="130" cy="100" r="22" fill={cyan} />
            <circle className="ol-lava-c" cx="100" cy="100" r="18" fill={ink} />
          </g>
        </>
      );
    case 13:
      return (
        <>
          <GooFilter id={`${uid}-13`} stdDeviation={7} />
          <g filter={`url(#${uid}-13)`}>
            <circle cx="100" cy="100" r="20" fill={ink} />
            <g className="ol-tend">
              <circle cx="100" cy="55" r="12" fill={ink} />
              <circle cx="145" cy="100" r="12" fill={ink} />
              <circle cx="100" cy="145" r="12" fill={ink} />
              <circle cx="55" cy="100" r="12" fill={cyan} />
            </g>
          </g>
        </>
      );
    case 14:
      return (
        <>
          <GooFilter id={`${uid}-14`} stdDeviation={7} />
          <g filter={`url(#${uid}-14)`}>
            <circle className="ol-conv-a" cx="100" cy="100" r="22" fill={ink} />
            <circle className="ol-conv-b" cx="100" cy="100" r="22" fill={ink} />
            <circle className="ol-conv-c" cx="100" cy="100" r="22" fill={cyan} />
          </g>
        </>
      );
    case 15:
      return (
        <>
          <path className="ol-rip" fill="none" stroke={ink} strokeWidth="3" d="M100,40 C140,42 158,72 158,100 C158,138 138,160 100,160 C62,160 42,138 42,100 C42,72 60,38 100,40 Z" />
          <path className="ol-rip" fill="none" stroke={cyan} strokeWidth="3" style={{ animationDelay: '.8s' }} d="M100,40 C140,42 158,72 158,100 C158,138 138,160 100,160 C62,160 42,138 42,100 C42,72 60,38 100,40 Z" />
          <path className="ol-rip" fill="none" stroke={ink} strokeWidth="3" style={{ animationDelay: '1.6s' }} d="M100,40 C140,42 158,72 158,100 C158,138 138,160 100,160 C62,160 42,138 42,100 C42,72 60,38 100,40 Z" />
          <circle cx="100" cy="100" r="10" fill={ink} />
        </>
      );
    case 16:
      return (
        <>
          <path className="ol-worm" fill="none" stroke={ink} strokeWidth="14" strokeLinecap="round" strokeDasharray="60 540" d="M40,100 C40,60 80,40 100,70 C120,100 80,130 100,150 C120,170 160,140 160,100" />
          <path className="ol-worm" fill="none" stroke={cyan} strokeWidth="14" strokeLinecap="round" strokeDasharray="30 570" style={{ animationDelay: '-1.1s' }} d="M40,100 C40,60 80,40 100,70 C120,100 80,130 100,150 C120,170 160,140 160,100" />
        </>
      );
    case 17:
      return (
        <>
          <GooFilter id={`${uid}-17`} stdDeviation={6} />
          <g filter={`url(#${uid}-17)`}>
            <circle className="ol-core" cx="100" cy="100" r="28" fill={ink} />
            <g className="ol-satring">
              <circle cx="160" cy="100" r="12" fill={cyan} />
            </g>
          </g>
        </>
      );
    case 18:
      return (
        <g className="ol-squig">
          <path fill="none" stroke={ink} strokeWidth="14" strokeLinecap="round" d="M40,100 Q70,60 100,100 T160,100" />
          <path fill="none" stroke={cyan} strokeWidth="6" strokeLinecap="round" d="M40,100 Q70,60 100,100 T160,100" />
        </g>
      );
    case 19:
      return (
        <>
          <circle className="ol-halo" cx="100" cy="100" r="60" fill="none" stroke={ink} strokeWidth="2" />
          <circle className="ol-halo" cx="100" cy="100" r="60" fill="none" stroke={cyan} strokeWidth="2" style={{ animationDelay: '1.2s' }} />
          <path className="ol-core" fill={ink} d="M100,60 C125,60 140,80 140,100 C140,125 120,140 100,140 C75,140 60,120 60,100 C60,80 75,60 100,60 Z" />
        </>
      );
    case 20:
      return (
        <>
          <GooFilter id={`${uid}-20`} stdDeviation={5} matrix="16 -6" />
          <g filter={`url(#${uid}-20)`}>
            <g className="ol-arm">
              <rect x="98" y="30" width="4" height="100" fill={ink} />
              <circle cx="100" cy="140" r="22" fill={ink} />
              <circle cx="100" cy="140" r="8" fill={cyan} />
            </g>
          </g>
        </>
      );
    case 21:
      return (
        <g className="ol-house">
          <path
            fill={ink}
            d="M100,40 Q112,30 126,46 L162,86 Q172,98 172,138 Q172,168 142,170 L58,170 Q28,168 28,138 Q28,98 38,86 L74,46 Q88,30 100,40 Z"
          />
          <rect className="ol-window" x="86" y="108" width="28" height="34" rx="6" fill={cyan} />
        </g>
      );
    case 22:
      return (
        <>
          <GooFilter id={`${uid}-22`} stdDeviation={4} matrix="16 -6" />
          <ellipse className="ol-pin-ripple" cx="100" cy="155" rx="34" ry="6" fill="none" stroke={cyan} strokeWidth="3" />
          <g filter={`url(#${uid}-22)`}>
            <g className="ol-pin">
              <path fill={ink} d="M100,70 C78,70 66,90 76,110 L100,148 L124,110 C134,90 122,70 100,70 Z" />
              <circle cx="100" cy="92" r="8" fill={cyan} />
            </g>
          </g>
        </>
      );
    case 23:
      return (
        <>
          <circle className="ol-ping" cx="100" cy="100" r="70" fill="none" stroke={ink} strokeWidth="2" />
          <circle className="ol-ping" cx="100" cy="100" r="70" fill="none" stroke={ink} strokeWidth="2" style={{ animationDelay: '1.1s' }} />
          <path
            fill={ink}
            d="M100,80 Q108,74 116,82 L132,98 Q138,104 138,120 Q138,134 122,134 L78,134 Q62,134 62,120 Q62,104 68,98 L84,82 Q92,74 100,80 Z"
          />
          <g className="ol-sweep">
            <path fill={cyan} opacity=".75" d="M100,100 L100,30 A70,70 0 0 1 165,82 Z" />
          </g>
        </>
      );
    case 24:
      return (
        <>
          <GooFilter id={`${uid}-24`} stdDeviation={5} matrix="16 -6" />
          <g className="ol-stamp-splat">
            <circle cx="100" cy="110" r="42" fill={cyan} opacity=".25" />
            <circle cx="62" cy="118" r="8" fill={cyan} />
            <circle cx="142" cy="100" r="6" fill={cyan} />
            <circle cx="120" cy="148" r="7" fill={cyan} />
            <circle cx="78" cy="86" r="5" fill={cyan} />
          </g>
          <g filter={`url(#${uid}-24)`}>
            <path
              className="ol-stamp"
              fill={ink}
              d="M70,90 Q80,76 100,78 Q120,76 130,90 Q140,100 134,118 Q124,140 100,140 Q76,140 66,118 Q60,100 70,90 Z"
            />
          </g>
        </>
      );
    case 25:
      return (
        <>
          {[
            { x: 50, y: 150, w: 50, d: '0s' },
            { x: 100, y: 150, w: 50, d: '0s' },
            { x: 40, y: 128, w: 50, d: '.25s' },
            { x: 90, y: 128, w: 50, d: '.25s' },
            { x: 140, y: 128, w: 20, d: '.25s' },
            { x: 60, y: 106, w: 50, d: '.5s' },
            { x: 110, y: 106, w: 40, d: '.5s' },
            { x: 50, y: 84, w: 50, d: '.75s' },
            { x: 100, y: 84, w: 40, d: '.75s' },
            { x: 70, y: 62, w: 60, d: '1s', cyan: true },
          ].map((b, i) => (
            <rect
              key={i}
              className="ol-brick"
              x={b.x}
              y={b.y}
              width={b.w}
              height="20"
              rx="8"
              fill={b.cyan ? cyan : ink}
              style={{ animationDelay: b.d }}
            />
          ))}
        </>
      );
    case 26:
      return (
        <>
          <GooFilter id={`${uid}-26`} stdDeviation={4} matrix="14 -5" />
          <circle cx="150" cy="100" r="10" fill="none" stroke={ink} strokeWidth="3" />
          <rect x="148" y="100" width="4" height="14" fill={ink} />
          <g filter={`url(#${uid}-26)`}>
            <g className="ol-key">
              <circle cx="60" cy="100" r="22" fill={ink} />
              <circle cx="60" cy="100" r="8" fill="#fff" />
              <rect x="80" y="92" width="62" height="16" rx="4" fill={ink} />
              <rect x="118" y="108" width="8" height="14" rx="2" fill={ink} />
              <rect x="104" y="108" width="8" height="14" rx="2" fill={ink} />
              <circle cx="60" cy="100" r="4" fill={cyan} />
            </g>
          </g>
        </>
      );
    case 27:
      return (
        <>
          {[160, 142, 124, 106, 88].map((cy, i) => (
            <ellipse
              key={cy}
              className="ol-coin"
              cx="100"
              cy={cy}
              rx="38"
              ry="9"
              fill={i === 4 ? cyan : ink}
              style={{ animationDelay: `${i * 0.35}s` }}
            />
          ))}
        </>
      );
    case 28: {
      const mapPath = 'M40,70 C30,50 60,30 90,40 C120,30 170,40 165,80 C175,110 160,140 130,150 C100,170 70,160 50,140 C30,120 40,90 40,70 Z';
      return (
        <>
          <path fill={ink} opacity=".08" d={mapPath} />
          <path fill="none" stroke={ink} strokeWidth="2" d={mapPath} />
          {[
            { cx: 75, cy: 80, d: '0s' },
            { cx: 135, cy: 95, d: '.8s' },
            { cx: 95, cy: 135, d: '1.6s' },
          ].map(({ cx, cy, d }) => (
            <circle
              key={`${cx}-${cy}`}
              className="ol-hot"
              cx={cx}
              cy={cy}
              r="14"
              fill={cyan}
              style={{ transformOrigin: `${cx}px ${cy}px`, animationDelay: d }}
            />
          ))}
          <circle cx="75" cy="80" r="4" fill={ink} />
          <circle cx="135" cy="95" r="4" fill={ink} />
          <circle cx="95" cy="135" r="4" fill={ink} />
        </>
      );
    }
    case 29:
      return (
        <>
          <circle cx="100" cy="100" r="70" fill="none" stroke={ink} strokeWidth="3" opacity=".15" />
          <g className="ol-ring-rot">
            <circle
              className="ol-arc"
              cx="100"
              cy="100"
              r="70"
              fill="none"
              stroke={ink}
              strokeWidth="14"
              strokeLinecap="round"
              strokeDasharray="440 440"
            />
          </g>
          <circle cx="100" cy="100" r="28" fill={cyan} />
        </>
      );
    case 30:
      return (
        <>
          <GooFilter id={`${uid}-30`} stdDeviation={5} matrix="16 -6" />
          <g filter={`url(#${uid}-30)`}>
            <g className="ol-core">
              <path
                fill={ink}
                d="M100,80 Q108,74 116,82 L130,96 Q136,102 136,116 Q136,128 122,128 L78,128 Q64,128 64,116 Q64,102 70,96 L84,82 Q92,74 100,80 Z"
              />
              <rect x="92" y="108" width="16" height="20" rx="3" fill={cyan} />
            </g>
            <g className="ol-mag">
              <circle cx="50" cy="100" r="18" fill="none" stroke={ink} strokeWidth="6" />
              <rect x="32" y="98" width="4" height="22" rx="2" fill={ink} transform="rotate(45 34 109)" />
            </g>
          </g>
        </>
      );
    case 31:
      return (
        <>
          <line className="ol-link" x1="100" y1="50" x2="50" y2="145" stroke={ink} strokeWidth="2" strokeDasharray="6 6" />
          <line className="ol-link" x1="50" y1="145" x2="150" y2="145" stroke={ink} strokeWidth="2" strokeDasharray="6 6" />
          <line className="ol-link" x1="150" y1="145" x2="100" y2="50" stroke={ink} strokeWidth="2" strokeDasharray="6 6" />
          <g className="ol-node" style={{ transformOrigin: '100px 50px' }}>
            <path
              fill={ink}
              d="M100,38 Q106,32 112,40 L122,52 Q126,56 126,66 Q126,74 116,74 L84,74 Q74,74 74,66 Q74,56 78,52 L88,40 Q94,32 100,38 Z"
            />
          </g>
          <g className="ol-node" style={{ transformOrigin: '50px 145px', animationDelay: '.6s' }}>
            <path
              fill={ink}
              d="M50,133 Q56,127 62,135 L72,147 Q76,151 76,161 Q76,169 66,169 L34,169 Q24,169 24,161 Q24,151 28,147 L38,135 Q44,127 50,133 Z"
            />
          </g>
          <g className="ol-node" style={{ transformOrigin: '150px 145px', animationDelay: '1.2s' }}>
            <path
              fill={cyan}
              d="M150,133 Q156,127 162,135 L172,147 Q176,151 176,161 Q176,169 166,169 L134,169 Q124,169 124,161 Q124,151 128,147 L138,135 Q144,127 150,133 Z"
            />
          </g>
        </>
      );
    case 32:
      return (
        <>
          <rect x="97" y="50" width="6" height="120" rx="3" fill={ink} />
          <rect x="78" y="166" width="44" height="6" rx="3" fill={ink} />
          <rect x="60" y="60" width="80" height="6" rx="3" fill={ink} />
          <g className="ol-sign">
            <path
              fill={ink}
              d="M70,72 Q70,68 74,68 L126,68 Q130,68 130,72 L130,118 Q130,128 100,128 Q70,128 70,118 Z"
            />
            <circle cx="100" cy="98" r="14" fill={cyan} />
          </g>
        </>
      );
    default:
      return null;
  }
}

/* -------------------------------------------------------------------------- */
/*  Public components                                                          */
/* -------------------------------------------------------------------------- */

export function OrganicLoader({
  id,
  size = 96,
  inkColor = 'currentColor',
  accentColor = CYAN,
  className,
  'aria-label': ariaLabel = 'Loading',
}: OrganicLoaderProps) {
  ensureKeyframes();
  const clamped = Math.max(1, Math.min(32, id | 0));
  // Stable per-instance id so filter URLs don't collide if multiple loaders
  // of the same type are rendered on the page at once. useId() is SSR-safe
  // and gives identical ids on server + client (no hydration mismatch).
  const reactId = useId();
  const uid = useMemo(() => `ol${reactId.replace(/[^a-zA-Z0-9]/g, '')}-${clamped}`, [reactId, clamped]);

  return (
    <span
      className={cn('inline-flex items-center justify-center ol', className)}
      role="status"
      aria-label={ariaLabel}
      style={{ width: size, height: size, color: inkColor }}
    >
      <svg width={size} height={size} viewBox="0 0 200 200" aria-hidden="true" style={{ display: 'block' }}>
        <LoaderBody id={clamped} ink={inkColor} cyan={accentColor} uid={uid} />
      </svg>
      <span className="sr-only">{ariaLabel}</span>
    </span>
  );
}

/**
 * Picks a random loader on mount. Each mount = a new loader, à la
 * Anthropic's site. Use this as the default in Suspense fallbacks and
 * route-level loading states where you want the "surprise" effect.
 */
export function RotatingOrganicLoader({ category = 'all', ...rest }: RotatingOrganicLoaderProps) {
  const id = useMemo(() => {
    const pool = poolFor(category);
    return pool[Math.floor(Math.random() * pool.length)];
  }, [category]);
  return <OrganicLoader id={id} {...rest} />;
}

/**
 * Full-page version — dark background with a centered rotating loader and
 * optional message. Drop-in replacement for the existing FullPageLoader
 * but with the organic loader as the centerpiece.
 */
export function OrganicFullPageLoader({
  message,
  category = 'all',
  size = 140,
}: {
  message?: string;
  category?: LoaderCategory;
  size?: number;
}) {
  return (
    <div
      className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-[#0A0A0A] text-white"
      role="status"
      aria-label={message || 'Loading'}
    >
      <div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-gradient-to-br from-primary/15 via-cyan-500/8 to-transparent rounded-full blur-[120px] animate-pulse pointer-events-none"
        style={{ animationDuration: '4s' }}
        aria-hidden="true"
      />
      <div className="relative z-10 flex flex-col items-center gap-6">
        <RotatingOrganicLoader category={category} size={size} />
        {message && (
          <p className="text-sm font-medium text-zinc-400 tracking-wide animate-pulse" style={{ animationDuration: '2s' }}>
            {message}
          </p>
        )}
      </div>
    </div>
  );
}
