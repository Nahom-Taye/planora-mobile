export type FieldErrors = Record<string, string>;

export function validateEmail(email: string) {
  const value = email.trim();
  if (!value) return 'Enter your email address.';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
    return 'Enter a complete email address.';
  }
  return null;
}

export function validatePassword(password: string) {
  if (!password) return 'Enter your password.';
  if (password.length < 8) return 'Use at least eight characters.';
  return null;
}

export function validateDisplayName(displayName: string) {
  const value = displayName.trim();
  if (!value) return 'Enter a display name.';
  if (value.length > 60) return 'Use 60 characters or fewer.';
  return null;
}

export function collectErrors(
  entries: [string, string | null][],
): FieldErrors {
  return Object.fromEntries(
    entries.filter((entry): entry is [string, string] => Boolean(entry[1])),
  );
}
