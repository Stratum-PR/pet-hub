import {
  useRef,
  useCallback,
  useEffect,
  type CSSProperties,
  type PointerEvent,
  type ReactNode,
} from 'react';
import './BorderGlow.css';

function parseHSL(hslStr: string): { h: number; s: number; l: number } {
  const match = hslStr.match(/([\d.]+)\s*([\d.]+)%?\s*([\d.]+)%?/);
  if (!match) return { h: 40, s: 80, l: 80 };
  return { h: parseFloat(match[1]), s: parseFloat(match[2]), l: parseFloat(match[3]) };
}

function buildGlowVars(glowColor: string, intensity: number): Record<string, string> {
  const { h, s, l } = parseHSL(glowColor);
  const base = `${h}deg ${s}% ${l}%`;
  const opacities = [100, 60, 50, 40, 30, 20, 10];
  const keys = ['', '-60', '-50', '-40', '-30', '-20', '-10'];
  const vars: Record<string, string> = {};
  for (let i = 0; i < opacities.length; i++) {
    vars[`--glow-color${keys[i]}`] = `hsl(${base} / ${Math.min(opacities[i] * intensity, 100)}%)`;
  }
  return vars;
}

const GRADIENT_POSITIONS = [
  '80% 55%',
  '69% 34%',
  '8% 6%',
  '41% 38%',
  '86% 85%',
  '82% 18%',
  '51% 4%',
];
const GRADIENT_KEYS = [
  '--gradient-one',
  '--gradient-two',
  '--gradient-three',
  '--gradient-four',
  '--gradient-five',
  '--gradient-six',
  '--gradient-seven',
];
const COLOR_MAP = [0, 1, 2, 0, 1, 2, 1];

function buildGradientVars(colors: string[]): Record<string, string> {
  const vars: Record<string, string> = {};
  for (let i = 0; i < 7; i++) {
    const c = colors[Math.min(COLOR_MAP[i], colors.length - 1)];
    vars[GRADIENT_KEYS[i]] = `radial-gradient(at ${GRADIENT_POSITIONS[i]}, ${c} 0px, transparent 50%)`;
  }
  vars['--gradient-base'] = `linear-gradient(${colors[0]} 0 100%)`;
  return vars;
}

function easeOutCubic(x: number) {
  return 1 - Math.pow(1 - x, 3);
}
function easeInCubic(x: number) {
  return x * x * x;
}

type AnimateValueArgs = {
  start?: number;
  end?: number;
  duration?: number;
  delay?: number;
  ease?: (x: number) => number;
  onUpdate: (v: number) => void;
  onEnd?: () => void;
};

function animateValue({
  start = 0,
  end = 100,
  duration = 1000,
  delay = 0,
  ease = easeOutCubic,
  onUpdate,
  onEnd,
}: AnimateValueArgs) {
  const t0 = performance.now() + delay;
  let raf = 0;
  let cancelled = false;
  function tick() {
    if (cancelled) return;
    const elapsed = performance.now() - t0;
    const t = Math.min(elapsed / duration, 1);
    onUpdate(start + (end - start) * ease(t));
    if (t < 1) raf = requestAnimationFrame(tick);
    else if (onEnd && !cancelled) onEnd();
  }
  const timeout = window.setTimeout(() => {
    if (!cancelled) raf = requestAnimationFrame(tick);
  }, delay);
  return () => {
    cancelled = true;
    clearTimeout(timeout);
    cancelAnimationFrame(raf);
  };
}

export type BorderGlowProps = {
  children: ReactNode;
  className?: string;
  edgeSensitivity?: number;
  /** Space-separated HSL components, e.g. `"280 65 58"` (same shape as `--primary` without `hsl()`) */
  glowColor?: string;
  backgroundColor?: string;
  borderRadius?: number;
  glowRadius?: number;
  glowIntensity?: number;
  coneSpread?: number;
  animated?: boolean;
  colors?: string[];
  fillOpacity?: number;
  /** While the pointer is over the card, run a full 360° glow sweep on a loop (respects reduced motion). */
  rotateGlowOnHover?: boolean;
  /** Milliseconds for one full rotation while hovered */
  hoverRotationDurationMs?: number;
};

export function BorderGlow({
  children,
  className = '',
  edgeSensitivity = 30,
  glowColor = '40 80 80',
  backgroundColor = '#060010',
  borderRadius = 28,
  glowRadius = 40,
  glowIntensity = 1.0,
  coneSpread = 25,
  animated = false,
  colors = ['#c084fc', '#f472b6', '#38bdf8'],
  fillOpacity = 0.5,
  rotateGlowOnHover = false,
  hoverRotationDurationMs = 2800,
}: BorderGlowProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const pointerInsideRef = useRef(false);
  const hoverSpinRafRef = useRef<number>(0);
  const hoverSpinEpochRef = useRef(0);

  const getCenterOfElement = useCallback((el: HTMLElement) => {
    const { width, height } = el.getBoundingClientRect();
    return [width / 2, height / 2] as const;
  }, []);

  const getEdgeProximity = useCallback(
    (el: HTMLElement, x: number, y: number) => {
      const [cx, cy] = getCenterOfElement(el);
      const dx = x - cx;
      const dy = y - cy;
      let kx = Infinity;
      let ky = Infinity;
      if (dx !== 0) kx = cx / Math.abs(dx);
      if (dy !== 0) ky = cy / Math.abs(dy);
      return Math.min(Math.max(1 / Math.min(kx, ky), 0), 1);
    },
    [getCenterOfElement]
  );

  const getCursorAngle = useCallback(
    (el: HTMLElement, x: number, y: number) => {
      const [cx, cy] = getCenterOfElement(el);
      const dx = x - cx;
      const dy = y - cy;
      if (dx === 0 && dy === 0) return 0;
      const radians = Math.atan2(dy, dx);
      let degrees = radians * (180 / Math.PI) + 90;
      if (degrees < 0) degrees += 360;
      return degrees;
    },
    [getCenterOfElement]
  );

  const stopHoverSpin = useCallback(() => {
    pointerInsideRef.current = false;
    if (hoverSpinRafRef.current) {
      cancelAnimationFrame(hoverSpinRafRef.current);
      hoverSpinRafRef.current = 0;
    }
    const card = cardRef.current;
    if (card) {
      card.classList.remove('border-glow-hover-spin');
      card.style.setProperty('--edge-proximity', '0');
    }
  }, []);

  const handlePointerMove = useCallback(
    (e: PointerEvent<HTMLDivElement>) => {
      const card = cardRef.current;
      if (!card) return;
      if (rotateGlowOnHover && pointerInsideRef.current) return;

      const rect = card.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      const edge = getEdgeProximity(card, x, y);
      const angle = getCursorAngle(card, x, y);

      card.style.setProperty('--edge-proximity', `${(edge * 100).toFixed(3)}`);
      card.style.setProperty('--cursor-angle', `${angle.toFixed(3)}deg`);
    },
    [getEdgeProximity, getCursorAngle, rotateGlowOnHover]
  );

  const handlePointerEnter = useCallback(() => {
    if (!rotateGlowOnHover) return;
    const card = cardRef.current;
    if (!card) return;

    pointerInsideRef.current = true;
    card.classList.add('border-glow-hover-spin');

    const reduced =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (reduced) {
      card.style.setProperty('--edge-proximity', '100');
      card.style.setProperty('--cursor-angle', '45deg');
      return;
    }

    hoverSpinEpochRef.current = performance.now();
    const duration = Math.max(400, hoverRotationDurationMs);

    const tick = () => {
      if (!pointerInsideRef.current || !cardRef.current) return;
      const c = cardRef.current;
      const elapsed = performance.now() - hoverSpinEpochRef.current;
      const angle = ((elapsed / duration) % 1) * 360;
      c.style.setProperty('--cursor-angle', `${angle.toFixed(2)}deg`);
      c.style.setProperty('--edge-proximity', '100');
      hoverSpinRafRef.current = requestAnimationFrame(tick);
    };
    hoverSpinRafRef.current = requestAnimationFrame(tick);
  }, [hoverRotationDurationMs, rotateGlowOnHover]);

  const handlePointerLeave = useCallback(() => {
    if (!rotateGlowOnHover) return;
    stopHoverSpin();
  }, [rotateGlowOnHover, stopHoverSpin]);

  useEffect(() => {
    if (!animated || !cardRef.current) return;
    const card = cardRef.current;
    const angleStart = 110;
    const angleEnd = 465;
    card.classList.add('sweep-active');
    card.style.setProperty('--cursor-angle', `${angleStart}deg`);

    const cancelFns = [
      animateValue({ duration: 500, onUpdate: (v) => card.style.setProperty('--edge-proximity', String(v)) }),
      animateValue({
        ease: easeInCubic,
        duration: 1500,
        end: 50,
        onUpdate: (v) => {
          card.style.setProperty('--cursor-angle', `${(angleEnd - angleStart) * (v / 100) + angleStart}deg`);
        },
      }),
      animateValue({
        ease: easeOutCubic,
        delay: 1500,
        duration: 2250,
        start: 50,
        end: 100,
        onUpdate: (v) => {
          card.style.setProperty('--cursor-angle', `${(angleEnd - angleStart) * (v / 100) + angleStart}deg`);
        },
      }),
      animateValue({
        ease: easeInCubic,
        delay: 2500,
        duration: 1500,
        start: 100,
        end: 0,
        onUpdate: (v) => card.style.setProperty('--edge-proximity', String(v)),
        onEnd: () => card.classList.remove('sweep-active'),
      }),
    ];

    return () => {
      cancelFns.forEach((fn) => fn());
      card.classList.remove('sweep-active');
    };
  }, [animated]);

  useEffect(() => () => stopHoverSpin(), [stopHoverSpin]);

  const glowVars = buildGlowVars(glowColor, glowIntensity);

  const style = {
    '--card-bg': backgroundColor,
    '--edge-sensitivity': edgeSensitivity,
    '--border-radius': `${borderRadius}px`,
    '--glow-padding': `${glowRadius}px`,
    '--cone-spread': coneSpread,
    '--fill-opacity': fillOpacity,
    ...glowVars,
    ...buildGradientVars(colors),
  } as CSSProperties;

  return (
    <div
      ref={cardRef}
      onPointerEnter={handlePointerEnter}
      onPointerLeave={handlePointerLeave}
      onPointerMove={handlePointerMove}
      className={`border-glow-card ${className}`}
      style={style}
    >
      <span className="edge-light" />
      <div className="border-glow-inner">{children}</div>
    </div>
  );
}
