import { useEffect, useRef, useCallback, useState } from 'react';
import { useTheme } from 'next-themes';
import { BorderGlow } from '@/components/BorderGlow';
import { WoofButton } from '@/components/WoofButton';
import { petPawSvgHtml } from '@/lib/petPawGeometry';
import './PetAnimations.css';

/**
 * PetAnimations
 *
 * **Manual Woof** (Woof button): Random straight path on-screen → off-screen with alternating lateral
 * stagger (zigzag along the centerline); first four steps only add paws, then sliding window of four.
 * Each print uses a short scale/opacity “stamp” pop-in.
 *
 * **Ambient** (long random timer): Scheduled walk along a **random** cubic, or multi-paw Bézier burst.
 *
 * Trail graphic: `petPawSvgHtml`, black/white by theme, opacity 0.5.
 */
const PAW_TILT_A_DEG = 80;
const PAW_TILT_B_DEG = 84;

const WALKING_BASE_PX = 28;

/** Manual Woof — steps along random line; after four paws, each step drops the oldest. */
const WOOF_PAW_COUNT = 14;
const WOOF_STEP_MS = 400;
/** Paws 0..3 accumulate; from paw index 4 onward we keep four on screen by removing the oldest. */
const WOOF_SLIDING_START_INDEX = 4;
/** Half-width of zigzag: paws alternate ± this distance perpendicular to the walk line. */
const WOOF_STAGGER_PX = 12;

/** Ambient walking — same rhythm as Woof; only the Bézier control points change. */
const AMBIENT_WALK_PAW_COUNT = 12;
const AMBIENT_WALK_STEP_MS = 480;
const AMBIENT_MAX_VISIBLE = 10;

const BEZIER_BURST_COUNT = 6;
const BEZIER_PAW_PX = 32;
const BEZIER_STEP_INTERVAL_MS = 1250;
const BEZIER_FADE_OUT_DELAY_MS = 3200;

function cubicBezierPoint(
  t: number,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  x3: number,
  y3: number
) {
  const mt = 1 - t;
  const x =
    mt * mt * mt * x0 + 3 * mt * mt * t * x1 + 3 * mt * t * t * x2 + t * t * t * x3;
  const y =
    mt * mt * mt * y0 + 3 * mt * mt * t * y1 + 3 * mt * t * t * y2 + t * t * t * y3;
  return { x, y };
}

/**
 * Parameter `t` uniform in [0,1] ≠ equal distance along a cubic. Returns `t` samples
 * so consecutive points are equally spaced by arc length.
 */
function arcLengthParameterTimes(
  count: number,
  getPoint: (t: number) => { x: number; y: number },
  samples = 400
): number[] {
  if (count <= 0) return [];
  if (count === 1) return [0.5];
  const dt = 1 / samples;
  const cum: number[] = [0];
  let prev = getPoint(0);
  for (let i = 1; i <= samples; i++) {
    const p = getPoint(i * dt);
    cum.push(cum[i - 1] + Math.hypot(p.x - prev.x, p.y - prev.y));
    prev = p;
  }
  const total = cum[samples];
  if (total < 1e-6) {
    return Array.from({ length: count }, (_, k) => (k / (count - 1)) * (1 - 1e-6));
  }
  const ts: number[] = [];
  for (let k = 0; k < count; k++) {
    const target = (k / (count - 1)) * total;
    let lo = 0;
    let hi = samples;
    while (lo < hi - 1) {
      const mid = (lo + hi) >> 1;
      if (cum[mid] < target) lo = mid;
      else hi = mid;
    }
    const lenLo = cum[lo];
    const lenHi = cum[hi];
    const f = lenHi - lenLo < 1e-9 ? 0 : (target - lenLo) / (lenHi - lenLo);
    ts.push((lo + f) * dt);
  }
  return ts;
}

function linePoint(t: number, x0: number, y0: number, x1: number, y1: number) {
  return {
    x: x0 + t * (x1 - x0),
    y: y0 + t * (y1 - y0),
  };
}

/** Smallest t>0 where ray from inside the viewport first hits an edge (dx,dy unit). */
function rayExitTFromInside(sx: number, sy: number, dx: number, dy: number, vw: number, vh: number): number {
  let tMin = Infinity;
  const hit = (t: number) => {
    if (t > 1e-4 && Number.isFinite(t)) tMin = Math.min(tMin, t);
  };
  if (dx > 1e-6) hit((vw - sx) / dx);
  if (dx < -1e-6) hit((0 - sx) / dx);
  if (dy > 1e-6) hit((vh - sy) / dy);
  if (dy < -1e-6) hit((0 - sy) / dy);
  if (!Number.isFinite(tMin)) {
    const h = Math.hypot(dx, dy) || 1;
    tMin = (vw + vh) / h;
  }
  return tMin;
}

/** Start on-screen; end along same ray past the viewport edge (straight walk off-screen). */
function randomWoofWalkLine(vw: number, vh: number) {
  const pad = Math.max(40, Math.min(vw, vh) * 0.05);
  const innerW = Math.max(24, vw - 2 * pad);
  const innerH = Math.max(24, vh - 2 * pad);
  const sx = pad + Math.random() * innerW;
  const sy = pad + Math.random() * innerH;
  const angle = Math.random() * Math.PI * 2;
  const dx = Math.cos(angle);
  const dy = Math.sin(angle);
  const tEdge = rayExitTFromInside(sx, sy, dx, dy, vw, vh);
  const past = 100 + Math.random() * 80;
  const x1 = sx + dx * (tEdge + past);
  const y1 = sy + dy * (tEdge + past);
  return { x0: sx, y0: sy, x1, y1 };
}

/** Random ambient walking path: always crosses the screen. */
function randomWalkBezierControl(vw: number, vh: number) {
  const r = () => Math.random();
  const flip = r() < 0.12;
  const x0 = flip ? vw + 72 : -72;
  const x3 = flip ? -72 : vw + 72;
  const y0 = vh * (0.2 + r() * 0.55);
  const y3 = vh * (0.2 + r() * 0.55);
  return {
    x0,
    y0,
    x1: vw * (0.1 + r() * 0.35),
    y1: vh * (0.1 + r() * 0.4),
    x2: vw * (0.45 + r() * 0.4),
    y2: vh * (0.35 + r() * 0.5),
    x3,
    y3,
  };
}

function mountTrailPawGraphic(pawprint: HTMLElement) {
  pawprint.classList.add('pet-paw-print');
  pawprint.style.background = 'transparent';
  pawprint.innerHTML = petPawSvgHtml();
  const night = document.documentElement.classList.contains('dark');
  pawprint.style.color = night ? '#ffffff' : '#000000';
}

function pawTiltDeg(useTiltA: boolean): number {
  return useTiltA ? PAW_TILT_A_DEG : PAW_TILT_B_DEG;
}

interface AnimationConfig {
  minInterval: number;
  maxInterval: number;
  enabled: boolean;
}

const DEFAULT_CONFIG: AnimationConfig = {
  minInterval: 10 * 60 * 1000,
  maxInterval: 20 * 60 * 1000,
  enabled: true,
};

export function PetAnimations({ config = DEFAULT_CONFIG }: { config?: Partial<AnimationConfig> }) {
  const { resolvedTheme } = useTheme();
  const [glowColorTriplet, setGlowColorTriplet] = useState('262 83 58');

  useEffect(() => {
    const raw = getComputedStyle(document.documentElement).getPropertyValue('--primary').trim();
    if (raw) setGlowColorTriplet(raw.replace(/,/g, ' ').replace(/\s+/g, ' ').trim());
  }, [resolvedTheme]);

  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const animationContainerRef = useRef<HTMLDivElement>(null);
  const animationIdRef = useRef<number>(0);
  const activePawprintsRef = useRef<Set<string>>(new Set());
  const walkingPawprintsRef = useRef<Array<{ id: string; element: HTMLElement }>>([]);
  /** Legacy: recursive ambient walker removed; kept only so old cleanup clears if set. */
  const walkingAnimationRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const trailTimeoutsRef = useRef<number[]>([]);
  const trailRunIdRef = useRef(0);

  const finalConfig = { ...DEFAULT_CONFIG, ...config };

  const getRandomInterval = useCallback(() => {
    const { minInterval, maxInterval } = finalConfig;
    return Math.floor(Math.random() * (maxInterval - minInterval + 1)) + minInterval;
  }, [finalConfig]);

  const clearScheduledTrail = useCallback(() => {
    for (const id of trailTimeoutsRef.current) {
      clearTimeout(id);
    }
    trailTimeoutsRef.current = [];
    if (walkingAnimationRef.current !== null) {
      clearTimeout(walkingAnimationRef.current);
      walkingAnimationRef.current = null;
    }
  }, []);

  const fadeAndClearWalkingPaws = useCallback(() => {
    walkingPawprintsRef.current.forEach(({ element }) => {
      element.style.transition = 'opacity 0.45s ease-out';
      element.style.opacity = '0';
      setTimeout(() => {
        if (element.parentNode) element.remove();
      }, 450);
    });
    walkingPawprintsRef.current = [];
  }, []);

  /**
   * Schedule `pawCount` paws along a cubic at `stepMs` intervals (deterministic rhythm).
   * Arc-length–spaced samples on the centerline; each paw centered on the point.
   */
  const scheduleCenterlineTrail = useCallback(
    (args: {
      pawCount: number;
      stepMs: number;
      maxVisible: number;
      control: {
        x0: number;
        y0: number;
        x1: number;
        y1: number;
        x2: number;
        y2: number;
        x3: number;
        y3: number;
      };
    }) => {
      if (!animationContainerRef.current || !finalConfig.enabled) return;

      clearScheduledTrail();
      fadeAndClearWalkingPaws();
      trailRunIdRef.current += 1;
      const runId = trailRunIdRef.current;

      const container = animationContainerRef.current;
      const { pawCount, stepMs, maxVisible, control } = args;
      const { x0, y0, x1, y1, x2, y2, x3, y3 } = control;

      const getPoint = (t: number) => cubicBezierPoint(t, x0, y0, x1, y1, x2, y2, x3, y3);
      const ts = arcLengthParameterTimes(pawCount, getPoint);
      const pawW = WALKING_BASE_PX;
      let stepIdx = 0;

      const pushTimeout = (fn: () => void, ms: number) => {
        const tid = window.setTimeout(fn, ms);
        trailTimeoutsRef.current.push(tid);
      };

      for (let i = 0; i < pawCount; i++) {
        const delay = i * stepMs;
        pushTimeout(() => {
          if (trailRunIdRef.current !== runId) return;

          while (walkingPawprintsRef.current.length >= maxVisible) {
            const oldest = walkingPawprintsRef.current.shift();
            if (oldest) {
              oldest.element.style.transition = 'opacity 0.35s ease-out';
              oldest.element.style.opacity = '0';
              setTimeout(() => {
                if (oldest.element.parentNode) oldest.element.remove();
              }, 350);
            }
          }

          const t = ts[i] ?? i / Math.max(1, pawCount - 1);
          const pos = getPoint(t);
          const drawX = pos.x - pawW / 2;
          const drawY = pos.y - pawW / 2;
          const angleDeg = pawTiltDeg(i % 2 === 0);

          const id = `trail-paw-${Date.now()}-${stepIdx++}`;
          const pawprint = document.createElement('div');
          pawprint.id = id;
          pawprint.style.position = 'fixed';
          pawprint.style.left = `${drawX}px`;
          pawprint.style.top = `${drawY}px`;
          pawprint.style.width = `${pawW}px`;
          pawprint.style.height = `${pawW}px`;
          pawprint.style.pointerEvents = 'none';
          pawprint.style.zIndex = '9999';
          pawprint.style.opacity = '0.5';
          pawprint.style.transform = `rotate(${angleDeg}deg)`;
          pawprint.style.transition = 'opacity 0.3s ease-in';
          pawprint.style.transformOrigin = 'center center';

          mountTrailPawGraphic(pawprint);
          container.appendChild(pawprint);
          walkingPawprintsRef.current.push({ id, element: pawprint });
        }, delay);
      }

      const fadeAfterMs = (pawCount - 1) * stepMs + 2200;
      pushTimeout(() => {
        if (trailRunIdRef.current !== runId) return;
        fadeAndClearWalkingPaws();
      }, fadeAfterMs);
    },
    [clearScheduledTrail, fadeAndClearWalkingPaws, finalConfig.enabled]
  );

  /** Woof: straight line, sliding window of four paws after the first four placements. */
  const scheduleWoofLineTrail = useCallback(
    (args: {
      pawCount: number;
      stepMs: number;
      line: { x0: number; y0: number; x1: number; y1: number };
    }) => {
      if (!animationContainerRef.current || !finalConfig.enabled) return;

      clearScheduledTrail();
      fadeAndClearWalkingPaws();
      trailRunIdRef.current += 1;
      const runId = trailRunIdRef.current;

      const container = animationContainerRef.current;
      const { pawCount, stepMs, line } = args;
      const { x0, y0, x1, y1 } = line;

      const getPoint = (t: number) => linePoint(t, x0, y0, x1, y1);
      const ts = arcLengthParameterTimes(pawCount, getPoint);
      const pawW = WALKING_BASE_PX;
      let stepIdx = 0;

      const segDx = x1 - x0;
      const segDy = y1 - y0;
      const segLen = Math.hypot(segDx, segDy) || 1;
      const normX = -segDy / segLen;
      const normY = segDx / segLen;

      const pathAngleDeg = (Math.atan2(segDy, segDx) * 180) / Math.PI;
      /** Pad roughly perpendicular to travel; slight L/R offset matches alternating stagger side. */
      const pawRotationDeg = (i: number) => pathAngleDeg + 86 + (i % 2 === 0 ? -4 : 4);

      const reduceMotion =
        typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

      const pushTimeout = (fn: () => void, ms: number) => {
        const tid = window.setTimeout(fn, ms);
        trailTimeoutsRef.current.push(tid);
      };

      for (let i = 0; i < pawCount; i++) {
        const delay = i * stepMs;
        pushTimeout(() => {
          if (trailRunIdRef.current !== runId) return;

          if (i >= WOOF_SLIDING_START_INDEX) {
            const oldest = walkingPawprintsRef.current.shift();
            if (oldest) {
              oldest.element.style.transition = 'opacity 0.28s ease-out';
              oldest.element.style.opacity = '0';
              window.setTimeout(() => {
                if (oldest.element.parentNode) oldest.element.remove();
              }, 280);
            }
          }

          const t = ts[i] ?? i / Math.max(1, pawCount - 1);
          const pos = getPoint(t);
          const side = i % 2 === 0 ? 1 : -1;
          const cx = pos.x + normX * WOOF_STAGGER_PX * side;
          const cy = pos.y + normY * WOOF_STAGGER_PX * side;
          const drawX = cx - pawW / 2;
          const drawY = cy - pawW / 2;
          const angleDeg = pawRotationDeg(i);

          const id = `trail-paw-${Date.now()}-${stepIdx++}`;
          const pawprint = document.createElement('div');
          pawprint.id = id;
          pawprint.style.position = 'fixed';
          pawprint.style.left = `${drawX}px`;
          pawprint.style.top = `${drawY}px`;
          pawprint.style.width = `${pawW}px`;
          pawprint.style.height = `${pawW}px`;
          pawprint.style.pointerEvents = 'none';
          pawprint.style.zIndex = '9999';
          pawprint.style.transformOrigin = 'center center';

          mountTrailPawGraphic(pawprint);
          container.appendChild(pawprint);
          walkingPawprintsRef.current.push({ id, element: pawprint });

          if (reduceMotion) {
            pawprint.style.opacity = '0.5';
            pawprint.style.transform = `rotate(${angleDeg}deg) scale(1)`;
          } else {
            pawprint.style.opacity = '0';
            pawprint.style.transform = `rotate(${angleDeg}deg) scale(0.34)`;
            requestAnimationFrame(() => {
              requestAnimationFrame(() => {
                if (trailRunIdRef.current !== runId) return;
                pawprint.style.transition =
                  'transform 0.36s cubic-bezier(0.28, 1.32, 0.42, 1), opacity 0.24s ease-out';
                pawprint.style.transform = `rotate(${angleDeg}deg) scale(1)`;
                pawprint.style.opacity = '0.5';
              });
            });
          }
        }, delay);
      }

      const fadeAfterMs = (pawCount - 1) * stepMs + 2200;
      pushTimeout(() => {
        if (trailRunIdRef.current !== runId) return;
        fadeAndClearWalkingPaws();
      }, fadeAfterMs);
    },
    [clearScheduledTrail, fadeAndClearWalkingPaws, finalConfig.enabled]
  );

  const runWoofTrail = useCallback(() => {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    scheduleWoofLineTrail({
      pawCount: WOOF_PAW_COUNT,
      stepMs: WOOF_STEP_MS,
      line: randomWoofWalkLine(vw, vh),
    });
  }, [scheduleWoofLineTrail]);

  const runAmbientWalkingTrail = useCallback(() => {
    if (!animationContainerRef.current) return;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    scheduleCenterlineTrail({
      pawCount: AMBIENT_WALK_PAW_COUNT,
      stepMs: AMBIENT_WALK_STEP_MS,
      maxVisible: AMBIENT_MAX_VISIBLE,
      control: randomWalkBezierControl(vw, vh),
    });
  }, [scheduleCenterlineTrail]);

  const createPawprintBurst = useCallback(() => {
    if (!animationContainerRef.current) return;
    if (activePawprintsRef.current.size > 0) return;

    clearScheduledTrail();
    fadeAndClearWalkingPaws();

    const container = animationContainerRef.current;
    const startX = -50;
    const endX = window.innerWidth + 50;
    const startY = window.innerHeight * 0.3;
    const endY = window.innerHeight * 0.7;
    const controlPoint1X = window.innerWidth * 0.3;
    const controlPoint1Y = window.innerHeight * 0.2;
    const controlPoint2X = window.innerWidth * 0.7;
    const controlPoint2Y = window.innerHeight * 0.8;

    const getBezierPoint = (t: number) =>
      cubicBezierPoint(t, startX, startY, controlPoint1X, controlPoint1Y, controlPoint2X, controlPoint2Y, endX, endY);

    const pawprintCount = BEZIER_BURST_COUNT;
    const ts = arcLengthParameterTimes(pawprintCount, getBezierPoint);
    const half = BEZIER_PAW_PX / 2;
    let isLeftPaw = Math.random() > 0.5;

    for (let i = 0; i < pawprintCount; i++) {
      const id = `pawprint-${Date.now()}-${animationIdRef.current++}-${i}`;
      activePawprintsRef.current.add(id);

      const t = ts[i] ?? i / Math.max(1, pawprintCount - 1);
      const currentPos = getBezierPoint(t);
      isLeftPaw = !isLeftPaw;
      const vx = currentPos.x - half;
      const vy = currentPos.y - half;
      const angleDeg = pawTiltDeg(isLeftPaw);

      const pawprint = document.createElement('div');
      pawprint.className = 'pawprint-walking';
      pawprint.id = id;
      pawprint.style.position = 'fixed';
      pawprint.style.left = '0';
      pawprint.style.top = '0';
      pawprint.style.width = `${BEZIER_PAW_PX}px`;
      pawprint.style.height = `${BEZIER_PAW_PX}px`;
      pawprint.style.pointerEvents = 'none';
      pawprint.style.zIndex = '9999';
      pawprint.style.opacity = '0';
      pawprint.style.transition = 'opacity 0.3s ease-in';
      pawprint.style.transform = `translate(${vx}px, ${vy}px) rotate(${angleDeg}deg)`;
      pawprint.style.transformOrigin = 'center center';
      pawprint.style.willChange = 'transform, opacity';

      mountTrailPawGraphic(pawprint);
      container.appendChild(pawprint);

      const stepInterval = BEZIER_STEP_INTERVAL_MS;
      const fadeOutDelay = BEZIER_FADE_OUT_DELAY_MS;

      window.setTimeout(() => {
        pawprint.style.opacity = '0.5';
      }, i * stepInterval);

      window.setTimeout(() => {
        pawprint.style.transition = 'opacity 1s ease-out';
        pawprint.style.opacity = '0';
        window.setTimeout(() => {
          if (pawprint.parentNode) pawprint.remove();
          activePawprintsRef.current.delete(id);
        }, 1000);
      }, i * stepInterval + fadeOutDelay);
    }
  }, [clearScheduledTrail, fadeAndClearWalkingPaws]);

  const triggerRandomAnimation = useCallback(() => {
    if (!finalConfig.enabled) return;
    const roll = Math.random();
    if (roll < 0.55) {
      runAmbientWalkingTrail();
    } else {
      createPawprintBurst();
    }
  }, [createPawprintBurst, finalConfig.enabled, runAmbientWalkingTrail]);

  useEffect(() => {
    if (!finalConfig.enabled) return;

    const scheduleNext = () => {
      if (intervalRef.current) clearTimeout(intervalRef.current);
      const interval = getRandomInterval();
      intervalRef.current = setTimeout(() => {
        triggerRandomAnimation();
        scheduleNext();
      }, interval);
    };

    const initialDelay = getRandomInterval();
    intervalRef.current = setTimeout(() => {
      triggerRandomAnimation();
      scheduleNext();
    }, initialDelay);

    return () => {
      if (intervalRef.current) clearTimeout(intervalRef.current);
      clearScheduledTrail();
      if (walkingAnimationRef.current !== null) {
        clearTimeout(walkingAnimationRef.current);
        walkingAnimationRef.current = null;
      }
      walkingPawprintsRef.current.forEach(({ element }) => {
        if (element.parentNode) element.remove();
      });
      walkingPawprintsRef.current = [];
    };
  }, [clearScheduledTrail, finalConfig.enabled, getRandomInterval, triggerRandomAnimation]);

  const handleManualTrigger = useCallback(() => {
    runWoofTrail();
  }, [runWoofTrail]);

  return (
    <>
      <div
        ref={animationContainerRef}
        className="pet-animations-container"
        style={{
          position: 'fixed',
          inset: 0,
          maxWidth: '100%',
          pointerEvents: 'none',
          zIndex: 9998,
        }}
      />

      <div className="pointer-events-auto fixed bottom-4 right-4 z-[9999] hidden md:block max-w-[calc(100vw-2rem)]">
        <BorderGlow
          className="inline-grid w-max"
          edgeSensitivity={42}
          glowColor={glowColorTriplet}
          backgroundColor="hsl(var(--background) / 0.92)"
          borderRadius={9999}
          glowRadius={28}
          glowIntensity={0.95}
          coneSpread={22}
          fillOpacity={0.42}
          colors={
            resolvedTheme === 'dark'
              ? ['#a78bfa', '#f472b6', '#38bdf8']
              : ['#8b5cf6', '#e879a9', '#0ea5e9']
          }
          rotateGlowOnHover
        >
          <WoofButton onWoof={handleManualTrigger} />
        </BorderGlow>
      </div>
    </>
  );
}
