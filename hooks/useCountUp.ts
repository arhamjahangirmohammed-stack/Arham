/**
 * useCountUp hook
 *
 * Smoothly animates a number from 0 to target value
 */

import { useState, useEffect, useRef } from 'react';

/**
 * Easing function: ease-out cubic
 */
function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

/**
 * Hook for animating number values
 */
export function useCountUp(target: number, duration: number = 1000): number {
  const [value, setValue] = useState(0);
  const startTime = useRef<number | null>(null);
  const animationFrame = useRef<number | null>(null);

  useEffect(() => {
    startTime.current = null;
    const startValue = 0;

    const animate = (timestamp: number) => {
      if (!startTime.current) {
        startTime.current = timestamp;
      }

      const elapsed = timestamp - startTime.current;
      const progress = Math.min(elapsed / duration, 1);
      const easedProgress = easeOutCubic(progress);
      const currentValue = startValue + (target - startValue) * easedProgress;

      setValue(Math.round(currentValue));

      if (progress < 1) {
        animationFrame.current = requestAnimationFrame(animate);
      }
    };

    animationFrame.current = requestAnimationFrame(animate);

    return () => {
      if (animationFrame.current) {
        cancelAnimationFrame(animationFrame.current);
      }
    };
  }, [target, duration]);

  return value;
}

/**
 * Hook for animating multiple number values
 */
export function useCountUpMultiple(
  targets: number[],
  duration: number = 1000
): number[] {
  return targets.map((target) => useCountUp(target, duration));
}
