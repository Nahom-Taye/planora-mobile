import type { AuthConfigurationState } from './auth-types.ts';

type PublicEnvironment = {
  EXPO_PUBLIC_SUPABASE_URL?: string;
  EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY?: string;
};

const placeholderFragments = [
  'your-project',
  'your-publishable',
  'replace-me',
  'example',
];

export function validateAuthConfiguration(
  environment: PublicEnvironment,
): AuthConfigurationState {
  const url = environment.EXPO_PUBLIC_SUPABASE_URL?.trim();
  const publishableKey =
    environment.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim();

  if (!url || !publishableKey) {
    return { status: 'unavailable', reason: 'missing' };
  }

  let parsedUrl: URL;

  try {
    parsedUrl = new URL(url);
  } catch {
    return { status: 'unavailable', reason: 'invalid' };
  }

  const normalized = `${url} ${publishableKey}`.toLowerCase();
  const hasPlaceholder = placeholderFragments.some((fragment) =>
    normalized.includes(fragment),
  );
  const validUrl =
    parsedUrl.protocol === 'https:' &&
    parsedUrl.hostname.endsWith('.supabase.co') &&
    !parsedUrl.username &&
    !parsedUrl.password;

  if (!validUrl || publishableKey.length < 20 || hasPlaceholder) {
    return { status: 'unavailable', reason: 'invalid' };
  }

  return {
    status: 'ready',
    configuration: { url, publishableKey },
  };
}

export function readAuthConfiguration() {
  return validateAuthConfiguration({
    EXPO_PUBLIC_SUPABASE_URL: process.env.EXPO_PUBLIC_SUPABASE_URL,
    EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY:
      process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  });
}
