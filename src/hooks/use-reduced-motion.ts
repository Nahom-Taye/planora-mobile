import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

export function useReducedMotion() {
  const [reducedMotion, setReducedMotion] = useState<boolean | null>(null);

  useEffect(() => {
    let mounted = true;
    const updatePreference = (value: boolean) => {
      if (mounted) setReducedMotion(value);
    };
    void AccessibilityInfo.isReduceMotionEnabled().then(
      updatePreference,
      () => updatePreference(false),
    );
    const subscription = AccessibilityInfo.addEventListener(
      'reduceMotionChanged',
      updatePreference,
    );
    return () => {
      mounted = false;
      subscription.remove();
    };
  }, []);

  return reducedMotion;
}
