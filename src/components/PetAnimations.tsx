import { useEffect, useRef, useState, useCallback } from 'react';
import { WoofButton } from '@/components/WoofButton';
import { isDemoMode } from '@/lib/authRouting';
import './PetAnimations.css';

function applyPawPrintSurface(pawprint: HTMLElement, img: HTMLImageElement) {
  pawprint.classList.add('pet-paw-print');
  pawprint.style.background = 'transparent';
  img.style.backgroundColor = 'transparent';
}

interface AnimationConfig {
  minInterval: number; // in milliseconds
  maxInterval: number; // in milliseconds
  enabled: boolean;
}

const DEFAULT_CONFIG: AnimationConfig = {
  minInterval: 10 * 60 * 1000, // 10 minutes
  maxInterval: 20 * 60 * 1000, // 20 minutes
  enabled: true,
};

// Check if we're in development mode
const isDevMode = (): boolean => {
  return import.meta.env.DEV || isDemoMode();
};

export function PetAnimations({ config = DEFAULT_CONFIG }: { config?: Partial<AnimationConfig> }) {
  const [isVisible, setIsVisible] = useState(true); // Always show button for manual triggering
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const animationContainerRef = useRef<HTMLDivElement>(null);
  const animationIdRef = useRef<number>(0);
  const activePawprintsRef = useRef<Set<string>>(new Set());
  const walkingPawprintsRef = useRef<Array<{ id: string; element: HTMLElement }>>([]);
  const walkingAnimationRef = useRef<number | null>(null);

  const finalConfig = { ...DEFAULT_CONFIG, ...config };

  // Generate random interval between min and max
  const getRandomInterval = useCallback(() => {
    const { minInterval, maxInterval } = finalConfig;
    return Math.floor(Math.random() * (maxInterval - minInterval + 1)) + minInterval;
  }, [finalConfig]);

  // Create walking dog paw print animation
  const createWalkingDogAnimation = useCallback(() => {
    if (!animationContainerRef.current) return;
    
    // Only allow one walking animation at a time
    if (walkingAnimationRef.current !== null) {
      return;
    }

    const container = animationContainerRef.current;
    const maxPawprints = 8;
    let stepCount = 0;
    let currentX = -100;
    let currentY = window.innerHeight * 0.3 + (Math.random() * window.innerHeight * 0.4);
    let isLeftPaw = Math.random() > 0.5;
    const stepInterval = 200 + Math.random() * 150;

    const pathVariation = () => ({
      x: Math.random() * 40 - 20,
      y: Math.random() * 30 - 15,
      rotation: (Math.random() * 20 - 10) * (Math.PI / 180),
      scale: 0.8 + Math.random() * 0.4,
    });

    const createPawprint = () => {
      if (walkingPawprintsRef.current.length >= maxPawprints) {
        const oldest = walkingPawprintsRef.current.shift();
        if (oldest) {
          oldest.element.style.transition = 'opacity 0.5s ease-out';
          oldest.element.style.opacity = '0';
          setTimeout(() => {
            if (oldest.element.parentNode) {
              oldest.element.remove();
            }
          }, 500);
        }
      }

      const variation = pathVariation();
      isLeftPaw = !isLeftPaw;
      const stepX = currentX + 60 + variation.x;
      const stepY = currentY + variation.y;
      
      // Update current position for next step
      currentX = stepX;
      currentY += variation.y * 0.3; // Slight drift in Y direction

      const pawW = 40 * variation.scale;
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const drawX = Math.max(0, Math.min(stepX, vw - pawW));
      const drawY = Math.max(0, Math.min(stepY, vh - pawW));

      // Create paw print element
      const id = `walking-paw-${Date.now()}-${stepCount++}`;
      const pawprint = document.createElement('div');
      pawprint.id = id;
      pawprint.style.position = 'fixed';
      pawprint.style.left = `${drawX}px`;
      pawprint.style.top = `${drawY}px`;
      pawprint.style.width = `${pawW}px`;
      pawprint.style.height = `${pawW}px`;
      pawprint.style.pointerEvents = 'none';
      pawprint.style.zIndex = '9999';
      pawprint.style.opacity = '0.7';
      pawprint.style.transform = `rotate(${variation.rotation}rad)`;
      pawprint.style.transition = 'opacity 0.3s ease-in';
      pawprint.style.transformOrigin = 'center center';
      
      // Create image element using the uploaded asset
      const img = document.createElement('img');
      img.src = '/stock-vector-one-single-paw-print.webp';
      img.alt = 'Paw print';
      img.style.width = '100%';
      img.style.height = '100%';
      img.style.objectFit = 'contain';
      img.style.filter = 'drop-shadow(0 2px 4px rgba(0,0,0,0.2))';
      applyPawPrintSurface(pawprint, img);
      
      // Handle imfage load error
      img.addEventListener('error', () => {
        console.warn('[PetAnimations] Failed to load paw print image');
        // Fallback: create a simple SVG paw print
        pawprint.innerHTML = `
          <svg width="100%" height="100%" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
            <circle cx="30" cy="30" r="12" fill="currentColor" opacity="0.6"/>
            <circle cx="70" cy="30" r="12" fill="currentColor" opacity="0.6"/>
            <circle cx="30" cy="70" r="12" fill="currentColor" opacity="0.6"/>
            <circle cx="70" cy="70" r="12" fill="currentColor" opacity="0.6"/>
            <ellipse cx="50" cy="50" rx="20" ry="25" fill="currentColor" opacity="0.6"/>
          </svg>
        `;
        pawprint.style.color = '#666';
      });

      pawprint.appendChild(img);
      container.appendChild(pawprint);
      
      // Add to tracking array
      walkingPawprintsRef.current.push({ id, element: pawprint });
    };

    const scheduleNextStep = (isFirstStep = false) => {
      if (!isFirstStep && walkingAnimationRef.current === null) return;

      createPawprint();

      if (currentX <= window.innerWidth + 100) {
        const timeoutId = setTimeout(() => {
          scheduleNextStep(false);
        }, stepInterval);
        walkingAnimationRef.current = timeoutId as any;
      } else {
        walkingPawprintsRef.current.forEach(({ element }) => {
          element.style.transition = 'opacity 0.5s ease-out';
          element.style.opacity = '0';
          setTimeout(() => {
            if (element.parentNode) {
              element.remove();
            }
          }, 500);
        });
        walkingPawprintsRef.current = [];
        walkingAnimationRef.current = null;
      }
    };

    scheduleNextStep(true);

    setTimeout(() => {
      if (walkingAnimationRef.current !== null) {
        clearTimeout(walkingAnimationRef.current as any);
        walkingAnimationRef.current = null;
        walkingPawprintsRef.current.forEach(({ element }) => {
          element.style.transition = 'opacity 0.5s ease-out';
          element.style.opacity = '0';
          setTimeout(() => {
            if (element.parentNode) {
              element.remove();
            }
          }, 500);
        });
        walkingPawprintsRef.current = [];
      }
    }, 15000);
  }, []);

  // Create pawprint animation - alternating left/right with curved path
  const createPawprintAnimation = useCallback(() => {
    if (!animationContainerRef.current) return;
    
    // Only allow one pawprint animation sequence at a time
    if (activePawprintsRef.current.size > 0) {
      return;
    }

    const container = animationContainerRef.current;

    const startX = -50;
    const endX = window.innerWidth + 50;
    const startY = window.innerHeight * 0.3;
    const endY = window.innerHeight * 0.7;

    const controlPoint1X = window.innerWidth * 0.3;
    const controlPoint1Y = window.innerHeight * 0.2;
    const controlPoint2X = window.innerWidth * 0.7;
    const controlPoint2Y = window.innerHeight * 0.8;

    const pawprintCount = 12;
    const stepInterval = 800;
    const fadeOutDelay = 8000;

    let isLeftPaw = Math.random() > 0.5;

    // Helper function to calculate position on bezier curve
    const getBezierPoint = (t: number) => {
      const mt = 1 - t;
      const x = mt * mt * mt * startX + 
                3 * mt * mt * t * controlPoint1X + 
                3 * mt * t * t * controlPoint2X + 
                t * t * t * endX;
      const y = mt * mt * mt * startY + 
                3 * mt * mt * t * controlPoint1Y + 
                3 * mt * t * t * controlPoint2Y + 
                t * t * t * endY;
      return { x, y };
    };
    
    // Helper function to calculate tangent (derivative) of bezier curve at point t
    // This gives us the direction the curve is heading at that point
    const getBezierTangent = (t: number) => {
      const mt = 1 - t;
      // Derivative of cubic bezier
      const dx = 3 * mt * mt * (controlPoint1X - startX) + 
                 6 * mt * t * (controlPoint2X - controlPoint1X) + 
                 3 * t * t * (endX - controlPoint2X);
      const dy = 3 * mt * mt * (controlPoint1Y - startY) + 
                 6 * mt * t * (controlPoint2Y - controlPoint1Y) + 
                 3 * t * t * (endY - controlPoint2Y);
      return { dx, dy };
    };
    
    // Helper function to calculate angle from tangent vector (in degrees)
    const getAngleFromTangent = (dx: number, dy: number) => {
      return Math.atan2(dy, dx) * (180 / Math.PI);
    };
    
    for (let i = 0; i < pawprintCount; i++) {
      const id = `pawprint-${Date.now()}-${animationIdRef.current++}-${i}`;
      activePawprintsRef.current.add(id);

      const progress = i / (pawprintCount - 1);
      
      // Calculate current position on curved path
      const currentPos = getBezierPoint(progress);

      // tangent / angle from curve direction
      const tangent = getBezierTangent(progress);
      const angle = getAngleFromTangent(tangent.dx, tangent.dy);

      isLeftPaw = !isLeftPaw;
      const offsetX = isLeftPaw ? -30 : 30;
      const offsetY = isLeftPaw ? -10 : 10;

      const maxX = window.innerWidth - 52;
      const minX = 8;
      const maxY = window.innerHeight - 52;
      const minY = 8;
      const vx = Math.max(minX, Math.min(currentPos.x + offsetX, maxX));
      const vy = Math.max(minY, Math.min(currentPos.y + offsetY, maxY));

      // Create pawprint element
      const pawprint = document.createElement('div');
      pawprint.className = 'pawprint-walking';
      pawprint.id = id;
      pawprint.style.position = 'fixed';
      pawprint.style.left = '0';
      pawprint.style.top = '0';
      pawprint.style.width = '50px';
      pawprint.style.height = '50px';
      pawprint.style.pointerEvents = 'none';
      pawprint.style.zIndex = '9999';
      pawprint.style.opacity = '0';
      pawprint.style.transition = 'opacity 0.3s ease-in';
      // Use transform for position and rotation - GPU accelerated
      pawprint.style.transform = `translate(${vx}px, ${vy}px) rotate(${angle}deg)`;
      pawprint.style.transformOrigin = 'center center';
      pawprint.style.willChange = 'transform, opacity'; // GPU acceleration hint
      
      // Use pawprint.webp image
      const img = document.createElement('img');
      img.src = '/pawprint.webp';
      img.alt = 'Paw print';
      img.style.width = '100%';
      img.style.height = '100%';
      img.style.objectFit = 'contain';
      img.style.filter = 'drop-shadow(0 2px 4px rgba(0,0,0,0.2))';
      applyPawPrintSurface(pawprint, img);

      // Handle image load error - fallback to SVG
      img.addEventListener('error', () => {
        console.warn('[PetAnimations] Failed to load paw print image');
        // Fallback: create a simple SVG paw print
        pawprint.innerHTML = `
          <svg width="100%" height="100%" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
            <circle cx="30" cy="30" r="12" fill="currentColor" opacity="0.6"/>
            <circle cx="70" cy="30" r="12" fill="currentColor" opacity="0.6"/>
            <circle cx="30" cy="70" r="12" fill="currentColor" opacity="0.6"/>
            <circle cx="70" cy="70" r="12" fill="currentColor" opacity="0.6"/>
            <ellipse cx="50" cy="50" rx="20" ry="25" fill="currentColor" opacity="0.6"/>
          </svg>
        `;
        pawprint.style.color = '#666';
      });

      pawprint.appendChild(img);
      container.appendChild(pawprint);

      setTimeout(() => {
        pawprint.style.opacity = '0.8';
      }, i * stepInterval);

      setTimeout(() => {
        pawprint.style.transition = 'opacity 1s ease-out';
        pawprint.style.opacity = '0';
        setTimeout(() => {
          if (pawprint.parentNode) {
            pawprint.remove();
          }
          activePawprintsRef.current.delete(id);
        }, 1000);
      }, i * stepInterval + fadeOutDelay);
    }
  }, []);

  // Quick navigation-triggered animation (kept intentionally short).
  const createQuickWalkingDogAnimation = useCallback(() => {
    if (!animationContainerRef.current) return;

    if (walkingAnimationRef.current !== null) return;

    const container = animationContainerRef.current;
    const maxPawprints = 4;
    let stepCount = 0;
    let currentX = -100;
    let currentY = window.innerHeight * 0.35 + (Math.random() * window.innerHeight * 0.25);
    let isLeftPaw = Math.random() > 0.5;

    const stepInterval = 80 + Math.random() * 70;

    const pathVariation = () => ({
      x: Math.random() * 30 - 15,
      y: Math.random() * 20 - 10,
      rotation: (Math.random() * 18 - 9) * (Math.PI / 180),
      scale: 0.9 + Math.random() * 0.2,
    });

    const createPawprint = () => {
      if (!animationContainerRef.current) return;

      if (walkingPawprintsRef.current.length >= maxPawprints) {
        const oldest = walkingPawprintsRef.current.shift();
        if (oldest) {
          oldest.element.style.transition = 'opacity 0.25s ease-out';
          oldest.element.style.opacity = '0';
          setTimeout(() => {
            if (oldest.element.parentNode) oldest.element.remove();
          }, 250);
        }
      }

      const variation = pathVariation();
      isLeftPaw = !isLeftPaw;

      const stepX = currentX + 60 + variation.x;
      const stepY = currentY + variation.y;

      currentX = stepX;
      currentY += variation.y * 0.25;

      const pawW = 38 * variation.scale;
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const drawX = Math.max(0, Math.min(stepX, vw - pawW));
      const drawY = Math.max(0, Math.min(stepY, vh - pawW));

      const id = `walking-paw-quick-${Date.now()}-${stepCount++}`;
      const pawprint = document.createElement('div');
      pawprint.id = id;
      pawprint.style.position = 'fixed';
      pawprint.style.left = `${drawX}px`;
      pawprint.style.top = `${drawY}px`;
      pawprint.style.width = `${pawW}px`;
      pawprint.style.height = `${pawW}px`;
      pawprint.style.pointerEvents = 'none';
      pawprint.style.zIndex = '9999';
      pawprint.style.opacity = '0.75';
      pawprint.style.transform = `rotate(${variation.rotation}rad)`;
      pawprint.style.transition = 'opacity 0.18s ease-in';
      pawprint.style.transformOrigin = 'center center';

      const img = document.createElement('img');
      img.src = '/stock-vector-one-single-paw-print.webp';
      img.alt = 'Paw print';
      img.style.width = '100%';
      img.style.height = '100%';
      img.style.objectFit = 'contain';
      img.style.filter = 'drop-shadow(0 2px 4px rgba(0,0,0,0.2))';
      applyPawPrintSurface(pawprint, img);

      img.addEventListener('error', () => {
        pawprint.innerHTML = `
          <svg width="100%" height="100%" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
            <circle cx="30" cy="30" r="10" fill="currentColor" opacity="0.6"/>
            <circle cx="70" cy="30" r="10" fill="currentColor" opacity="0.6"/>
            <circle cx="30" cy="70" r="10" fill="currentColor" opacity="0.6"/>
            <circle cx="70" cy="70" r="10" fill="currentColor" opacity="0.6"/>
            <ellipse cx="50" cy="50" rx="18" ry="22" fill="currentColor" opacity="0.6"/>
          </svg>
        `;
        pawprint.style.color = '#666';
      });

      pawprint.appendChild(img);
      container.appendChild(pawprint);

      walkingPawprintsRef.current.push({ id, element: pawprint });
    };

    const scheduleNextStep = (isFirstStep = false) => {
      if (!isFirstStep && walkingAnimationRef.current === null) return;

      createPawprint();

      if (currentX <= window.innerWidth + 80) {
        const timeoutId = setTimeout(() => scheduleNextStep(false), stepInterval);
        walkingAnimationRef.current = timeoutId as any;
      } else {
        walkingPawprintsRef.current.forEach(({ element }) => {
          element.style.transition = 'opacity 0.25s ease-out';
          element.style.opacity = '0';
          setTimeout(() => {
            if (element.parentNode) element.remove();
          }, 250);
        });
        walkingPawprintsRef.current = [];
        walkingAnimationRef.current = null;
      }
    };

    scheduleNextStep(true);

    setTimeout(() => {
      if (walkingAnimationRef.current !== null) {
        clearTimeout(walkingAnimationRef.current as any);
        walkingAnimationRef.current = null;

        walkingPawprintsRef.current.forEach(({ element }) => {
          element.style.transition = 'opacity 0.25s ease-out';
          element.style.opacity = '0';
          setTimeout(() => {
            if (element.parentNode) element.remove();
          }, 250);
        });
        walkingPawprintsRef.current = [];
      }
    }, 3000);
  }, []);

  // Trigger random animation - ensures only one of each type
  const triggerRandomAnimation = useCallback(() => {
    if (!finalConfig.enabled) return;

    const animations = [createWalkingDogAnimation, createPawprintAnimation];
    const randomAnimation = animations[Math.floor(Math.random() * animations.length)];
    
    // Trigger the selected animation (only one of each type allowed)
    randomAnimation();
  }, [createWalkingDogAnimation, createPawprintAnimation, finalConfig.enabled]);

  // Trigger a short animation when navigation happens.
  const triggerQuickAnimation = useCallback(() => {
    if (!finalConfig.enabled) return;
    createQuickWalkingDogAnimation();
  }, [createQuickWalkingDogAnimation, finalConfig.enabled]);

  useEffect(() => {
    const handler = () => triggerQuickAnimation();
    window.addEventListener('pet-quick-trigger', handler);
    return () => window.removeEventListener('pet-quick-trigger', handler);
  }, [triggerQuickAnimation]);

  // Set up random interval
  useEffect(() => {
    if (!finalConfig.enabled) return;

    const scheduleNext = () => {
      if (intervalRef.current) {
        clearTimeout(intervalRef.current);
      }

      const interval = getRandomInterval();
      intervalRef.current = setTimeout(() => {
        triggerRandomAnimation();
        scheduleNext(); // Schedule next animation
      }, interval);
    };

    // Start first animation after initial delay
    const initialDelay = getRandomInterval();
    intervalRef.current = setTimeout(() => {
      triggerRandomAnimation();
      scheduleNext();
    }, initialDelay);

    return () => {
      if (intervalRef.current) {
        clearTimeout(intervalRef.current);
      }
      // Clean up walking animation on unmount
      if (walkingAnimationRef.current !== null) {
        clearTimeout(walkingAnimationRef.current as any);
        walkingAnimationRef.current = null;
      }
      // Clean up all walking paw prints
      walkingPawprintsRef.current.forEach(({ element }) => {
        if (element.parentNode) {
          element.remove();
        }
      });
      walkingPawprintsRef.current = [];
    };
  }, [finalConfig.enabled, getRandomInterval, triggerRandomAnimation]);

  // Manual trigger handler
  const handleManualTrigger = useCallback(() => {
    triggerRandomAnimation();
  }, [triggerRandomAnimation]);

  return (
    <>
      {/* Animation container - fixed position, pointer-events-none so it doesn't block interactions */}
      <div
        ref={animationContainerRef}
        className="pet-animations-container"
        style={{
          position: 'fixed',
          inset: 0,
          maxWidth: '100%',
          pointerEvents: 'none',
          zIndex: 9998, // Below modals but above most content
        }}
      />

      {/* Manual Woof: animated control + paw triggers (desktop) */}
      {isVisible && (
        <div className="pointer-events-auto fixed bottom-4 right-4 z-[9999] hidden md:block max-w-[calc(100vw-2rem)]">
          <WoofButton onWoof={handleManualTrigger} />
        </div>
      )}
    </>
  );
}
