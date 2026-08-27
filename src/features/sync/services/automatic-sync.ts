export type AutomaticSyncReason = 'queue' | 'foreground' | 'reconnect' | 'settled';

export type AutomaticQueueState = {
  state: 'pending' | 'processing' | 'failed';
  errorCode: string | null;
  lastAttemptAt: string | null;
  nextAttemptAt: string | null;
};

type TimerHandle = ReturnType<typeof setTimeout>;

type AutomaticSyncDependencies = {
  canRun: () => boolean;
  run: (reason: AutomaticSyncReason) => Promise<void>;
  debounceMs?: number;
  schedule?: (callback: () => void, delay: number) => TimerHandle;
  cancel?: (handle: TimerHandle) => void;
};

export class AutomaticSyncCoordinator {
  private readonly canRun: () => boolean;
  private readonly runAttempt: (reason: AutomaticSyncReason) => Promise<void>;
  private readonly debounceMs: number;
  private readonly schedule: (callback: () => void, delay: number) => TimerHandle;
  private readonly cancel: (handle: TimerHandle) => void;
  private timer: TimerHandle | null = null;
  private active = false;
  private followUp: { reason: AutomaticSyncReason; delay: number } | null = null;
  private stopped = false;

  constructor(dependencies: AutomaticSyncDependencies) {
    this.canRun = dependencies.canRun;
    this.runAttempt = dependencies.run;
    this.debounceMs = dependencies.debounceMs ?? 1200;
    this.schedule = dependencies.schedule ?? setTimeout;
    this.cancel = dependencies.cancel ?? clearTimeout;
  }

  trigger(reason: AutomaticSyncReason) {
    const delay = reason === 'queue' || reason === 'settled' ? this.debounceMs : 0;
    this.triggerAfter(reason, delay);
  }

  triggerAfter(reason: AutomaticSyncReason, delay: number) {
    if (this.stopped || !this.canRun()) return;
    if (this.active) {
      const next = { reason, delay: Math.max(0, delay) };
      if (!this.followUp || next.delay < this.followUp.delay) this.followUp = next;
      return;
    }
    if (this.timer) this.cancel(this.timer);
    this.timer = this.schedule(() => {
      this.timer = null;
      void this.start(reason);
    }, Math.max(0, delay));
  }

  suspend() {
    this.followUp = null;
    if (this.timer) this.cancel(this.timer);
    this.timer = null;
  }

  stop() {
    this.stopped = true;
    this.followUp = null;
    if (this.timer) this.cancel(this.timer);
    this.timer = null;
  }

  private async start(reason: AutomaticSyncReason) {
    if (this.stopped || !this.canRun()) return;
    if (this.active) {
      this.followUp = {
        reason,
        delay: reason === 'queue' || reason === 'settled' ? this.debounceMs : 0,
      };
      return;
    }
    this.active = true;
    try {
      await this.runAttempt(reason);
    } finally {
      this.active = false;
      const followUp = this.followUp;
      this.followUp = null;
      if (followUp && !this.stopped && this.canRun()) {
        this.triggerAfter(followUp.reason, followUp.delay);
      }
    }
  }
}

export function automaticRetryDelay(
  changes: AutomaticQueueState[],
  now: number,
  debounceMs = 1200,
) {
  const delays = changes.flatMap((change) => {
    if (change.state === 'pending') return [debounceMs];
    if (change.state === 'failed' && change.errorCode !== 'conflict') {
      const retryAt = timestampOr(change.nextAttemptAt, now);
      return [Math.max(debounceMs, retryAt - now)];
    }
    if (change.state === 'processing') {
      const attemptedAt = timestampOr(change.lastAttemptAt, now);
      return [Math.max(debounceMs, attemptedAt + 300_000 - now)];
    }
    return [];
  });
  return delays.length ? Math.min(...delays) : null;
}

function timestampOr(value: string | null, fallback: number) {
  if (!value) return fallback;
  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) ? timestamp : fallback;
}
