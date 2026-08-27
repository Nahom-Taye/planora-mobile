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

export type DevelopmentDiagnostic = {
  errorClass: 'abort' | 'network' | 'range' | 'reference' | 'storage' | 'type' | 'other';
  projectFrames: string[];
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
    console.error('feature_failure', {
      ...diagnostic,
      technical: createDevelopmentDiagnostic(error),
    });
  }
  return diagnostic;
}

export function createDevelopmentDiagnostic(error: unknown): DevelopmentDiagnostic {
  if (!(error instanceof Error)) return { errorClass: 'other', projectFrames: [] };
  const errorClass = developmentErrorClass(error.name);
  const normalizedStack = (error.stack ?? '').replaceAll('\\', '/');
  const projectFrames = Array.from(
    normalizedStack.matchAll(/(?:^|\/)((?:app|src)\/[A-Za-z0-9_./()\[\]-]+:\d+(?::\d+)?)/gm),
    (match) => match[1],
  ).slice(0, 6);
  return { errorClass, projectFrames };
}

function diagnosticCategory(error: unknown): RedactedDiagnostic['category'] {
  if (!(error instanceof Error)) return 'unexpected';
  if (error.name === 'AbortError') return 'interrupted';
  if (error.name === 'NetworkError') return 'network';
  if (error.name === 'StorageError') return 'storage';
  if (error.name === 'TypeError' || error.name === 'ReferenceError' || error.name === 'RangeError') return 'render';
  return 'unexpected';
}

function developmentErrorClass(errorName: string): DevelopmentDiagnostic['errorClass'] {
  if (errorName === 'AbortError') return 'abort';
  if (errorName === 'NetworkError') return 'network';
  if (errorName === 'RangeError') return 'range';
  if (errorName === 'ReferenceError') return 'reference';
  if (errorName === 'StorageError') return 'storage';
  if (errorName === 'TypeError') return 'type';
  return 'other';
}
