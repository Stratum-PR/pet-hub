import { useEffect, useRef, useState, useCallback } from 'react';
import { Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { isDemoMode } from '@/lib/authRouting';
import './PetAnimations.css';

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
  const [isVisible, setIsVisible] = useState(isDevMode());
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
    const maxPawprints = 8; // Maximum visible paw prints
    let stepCount = 0;
    let currentX = -100; // Start off-screen left
    let currentY = window.innerHeight * 0.3 + (Math.random() * window.innerHeight * 0.4); // Random vertical position (30-70% of screen)
    let isLeftPaw = Math.random() > 0.5; // Randomly start with left or right
    const stepInterval = 200 + Math.random() * 150; // 200-350ms between steps (natural walking rhythm)
    
    // Create a walking path with slight variation
    const pathVariation = () => ({
      x: Math.random() * 40 - 20, // -20 to +20px horizontal variation
      y: Math.random() * 30 - 15, // -15 to +15px vertical variation
      rotation: (Math.random() * 20 - 10) * (Math.PI / 180), // -10 to +10 degrees
      scale: 0.8 + Math.random() * 0.4, // 0.8 to 1.2 scale variation
    });

    const createPawprint = () => {

      // Limit visible paw prints
      if (walkingPawprintsRef.current.length >= maxPawprints) {
        // Remove oldest paw print
        const oldest = walkingPawprintsRef.current.shift();
        if (oldest) {
          // Fade out smoothly
          oldest.element.style.transition = 'opacity 0.5s ease-out';
          oldest.element.style.opacity = '0';
          setTimeout(() => {
            if (oldest.element.parentNode) {
              oldest.element.remove();
            }
          }, 500);
        }
      }

      // Get path variation for this step
      const variation = pathVariation();
      
      // Alternate left/right
      isLeftPaw = !isLeftPaw;
      
      // Calculate position with variation
      const stepX = currentX + 60 + variation.x; // Move forward ~60px with variation
      const stepY = currentY + variation.y;
      
      // Update current position for next step
      currentX = stepX;
      currentY += variation.y * 0.3; // Slight drift in Y direction
      
      // Create paw print element
      const id = `walking-paw-${Date.now()}-${stepCount++}`;
      const pawprint = document.createElement('div');
      pawprint.id = id;
      pawprint.style.position = 'fixed';
      pawprint.style.left = `${stepX}px`;
      pawprint.style.top = `${stepY}px`;
      pawprint.style.width = `${40 * variation.scale}px`;
      pawprint.style.height = `${40 * variation.scale}px`;
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
      
      // Handle image load error
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

    // Start animation loop using setTimeout for controlled step timing
    const scheduleNextStep = () => {
      if (walkingAnimationRef.current === null) return;
      
      createPawprint();
      
      if (currentX <= window.innerWidth + 100) {
        // Schedule next step after stepInterval
        const timeoutId = setTimeout(() => {
          scheduleNextStep();
        }, stepInterval);
        // Store timeout ID for cleanup
        walkingAnimationRef.current = timeoutId as any;
      } else {
        // Animation complete - clean up remaining paw prints
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

    // Start the animation
    scheduleNextStep();
    
    // Safety timeout - stop after 15 seconds max
    setTimeout(() => {
      if (walkingAnimationRef.current !== null) {
        clearTimeout(walkingAnimationRef.current as any);
        walkingAnimationRef.current = null;
        // Clean up remaining paw prints
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

  // Create pawprint animation using video - create multiple in a row (legacy)
  const createPawprintAnimation = useCallback(() => {
    if (!animationContainerRef.current) return;
    
    // Only allow one pawprint animation sequence at a time
    if (activePawprintsRef.current.size > 0) {
      return;
    }

    const container = animationContainerRef.current;
    
    // Random horizontal position (10% to 90% of screen width)
    const randomX = Math.random() * 80 + 10;
    
    // Random duration between 2-5 seconds for slow, noticeable motion
    const duration = Math.random() * 3000 + 2000; // 2000-5000ms
    
    // Create multiple pawprint videos in a row (3-5 pawprints)
    const pawprintCount = Math.floor(Math.random() * 3) + 3; // 3-5 pawprints
    const spacing = 80; // Vertical spacing between pawprints in pixels
    
    for (let i = 0; i < pawprintCount; i++) {
      const id = `pawprint-${Date.now()}-${animationIdRef.current++}-${i}`;
      activePawprintsRef.current.add(id);
      
      const pawprint = document.createElement('div');
      pawprint.className = 'pawprint-animation';
      pawprint.id = id;
      pawprint.style.left = `${randomX}%`;
      pawprint.style.bottom = `${i * spacing - 60}px`; // Start below viewport, spaced vertically
      pawprint.style.setProperty('--animation-duration', `${duration}ms`);
      pawprint.style.setProperty('--start-opacity', '0.9');
      pawprint.style.setProperty('--end-opacity', '0');

      // Use video element instead of SVG
      const video = document.createElement('video');
      video.src = '/pawprints (1).mp4';
      video.autoplay = true;
      video.loop = false;
      video.muted = true;
      video.playsInline = true;
      video.style.width = '64px';
      video.style.height = '64px';
      video.style.objectFit = 'contain';
      
      // Handle video end - keep the element for the CSS animation
      video.addEventListener('ended', () => {
        // Video ended, but keep the container for the float animation
      });
      
      // Handle video error - fallback to empty div
      video.addEventListener('error', (e) => {
        console.warn('[PetAnimations] Failed to load pawprint video:', e);
        // Remove video but keep container for animation
        video.remove();
      });

      pawprint.appendChild(video);
      container.appendChild(pawprint);

      // Clean up after animation completes
      setTimeout(() => {
        if (pawprint.parentNode) {
          pawprint.remove();
        }
        activePawprintsRef.current.delete(id);
      }, duration + 1000); // Give extra time for video to finish
    }
  }, []);


  // Trigger random animation - ensures only one of each type
  const triggerRandomAnimation = useCallback(() => {
    if (!finalConfig.enabled) return;

    const animations = [createWalkingDogAnimation, createPawprintAnimation];
    const randomAnimation = animations[Math.floor(Math.random() * animations.length)];
    
    // Trigger the selected animation (only one of each type allowed)
    randomAnimation();
  }, [createWalkingDogAnimation, createPawprintAnimation, finalConfig.enabled]);

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
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          pointerEvents: 'none',
          zIndex: 9998, // Below modals but above most content
        }}
      />

      {/* Manual trigger button - only visible in dev mode */}
      {isVisible && (
        <Button
          onClick={handleManualTrigger}
          variant="outline"
          size="icon"
          className="fixed bottom-4 left-4 z-[9999] h-12 w-12 rounded-full shadow-lg bg-background/80 backdrop-blur-sm hover:bg-background border-2 border-primary/20 hover:border-primary/40 transition-all"
          title="Trigger Pet Animation (Dev Mode)"
        >
          <Sparkles className="h-5 w-5 text-primary" />
        </Button>
      )}
    </>
  );
}
