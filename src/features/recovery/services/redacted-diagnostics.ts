export type RecoveryArea =
  | 'account'
  | 'authentication'
  | 'goals'
  | 'insights'
  | 'onboarding'
  | 'planner'
  | 'recovery'
  | 'reminders'
  | 'routines'
  | 'settings'
  | 'synchronization'
  | 'tasks'
  | 'today';

export type RedactedDiagnostic = {
  event: 'feature_failure';
  area: RecoveryArea;
  category: 'interrupted' | 'network' | 'render' | 'storage' | 'unexpected';
  occurredAt: string;
};

export function createRedactedDiagnostic(
  area: RecoveryArea,
  error: unknown,
  now: () => Date = () => new Date(),
): RedactedDiagnostic {
  return {
    event: 'feature_failure',
    area,
    category: diagnosticCategory(error),
    occurredAt: now().toISOString(),
  };
}

export function reportFeatureFailure(area: RecoveryArea, error: unknown) {
  const diagnostic = createRedactedDiagnostic(area, error);
  if (typeof __DEV__ !== 'undefined' && __DEV__) {
    console.error('feature_failure', diagnostic);
  }
  return diagnostic;
}

function diagnosticCategory(error: unknown): RedactedDiagnostic['category'] {
  if (!(error instanceof Error)) return 'unexpected';
  if (error.name === 'AbortError') return 'interrupted';
  if (error.name === 'NetworkError') return 'network';
  if (error.name === 'StorageError') return 'storage';
  if (error.name === 'TypeError' || error.name === 'ReferenceError') return 'render';
  return 'unexpected';
}
