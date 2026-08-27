import type { Href, Router } from 'expo-router';

export type BackNavigation = Pick<Router, 'back' | 'canGoBack' | 'replace'>;

export function goBackOrReplace(router: BackNavigation, fallback: Href) {
  if (router.canGoBack()) {
    router.back();
    return;
  }
  router.replace(fallback);
}
