import type { AccountGateway } from './account-gateway.ts';
import type { AuthStateEvent } from './auth-state.ts';
import { mapAuthError } from './auth-error-mapper.ts';

export const startupTimeoutMs = 1500;
export const requestTimeoutMs = 6000;
export const operationTimeoutMs = 45000;
export const lockTimeoutMs = 45000;

export function withDeadline<T>(work: Promise<T>, milliseconds: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Account service timeout.')), milliseconds);
    work.then(resolve, reject).finally(() => clearTimeout(timer));
  });
}

export class SingleFlight {
  private active = false;

  get isActive() { return this.active; }

  async run<T>(work: () => Promise<T>): Promise<T | null> {
    if (this.active) return null;
    this.active = true;
    try {
      return await work();
    } finally {
      this.active = false;
    }
  }
}

export function startAccountLifecycle(
  gateway: AccountGateway | null,
  dispatch: (event: AuthStateEvent) => void,
  timeout = startupTimeoutMs,
) {
  if (!gateway) {
    dispatch({ type: 'configuration_unavailable' });
    return () => undefined;
  }
  let active = true;
  const unsubscribe = gateway.subscribe((change) => {
    if (active) dispatch({ type: 'changed', change });
  });
  const fail = (error: unknown) => {
    if (active) dispatch({ type: 'failed', message: mapAuthError(error).message });
  };
  const startupTimer = setTimeout(() => fail({ status: 503 }), timeout);
  void gateway.restoreSession().then((session) => {
    if (active) dispatch({ type: 'restored', session });
  }).catch(fail).finally(() => clearTimeout(startupTimer));
  void gateway.checkReadiness().catch(fail);
  return () => {
    active = false;
    clearTimeout(startupTimer);
    unsubscribe();
  };
}

export function createAccountTransport(fetcher: typeof fetch, online: () => Promise<boolean>) {
  let blockedUntil = 0;
  let refreshAfter = 0;
  let rateLimitedUntil = 0;
  let refreshFailure: Response | null = null;
  const boundedFetch: typeof fetch = async (input, init) => {
    if (!(await withDeadline(online(), requestTimeoutMs))) throw new Error('Device offline.');
    if (Date.now() < rateLimitedUntil) throw new Error('Account rate limit reached.');
    if (Date.now() < blockedUntil) throw new Error('Account network unavailable.');
    const url = String(input);
    if (url.includes('grant_type=refresh_token')) {
      if (Date.now() < refreshAfter) {
        if (refreshFailure) return refreshFailure.clone();
        throw new Error('Account network retry cooldown.');
      }
      refreshAfter = Date.now() + 35000;
      refreshFailure = null;
    }
    const controller = new AbortController();
    const abort = () => controller.abort();
    init?.signal?.addEventListener('abort', abort, { once: true });
    if (init?.signal?.aborted) controller.abort();
    try {
      const response = await withDeadline((async () => {
        const result = await fetcher(input, { ...init, signal: controller.signal });
        const body = await result.text();
        return new Response(result.status === 204 || result.status === 205 || result.status === 304 ? null : body, {
          status: result.status, statusText: result.statusText, headers: result.headers,
        });
      })(), requestTimeoutMs);
      if (response.status === 429) {
        const seconds = Number(response.headers.get('Retry-After'));
        rateLimitedUntil = Date.now() + Math.max(60000, Number.isFinite(seconds) ? seconds * 1000 : 0);
        if (url.includes('grant_type=refresh_token')) throw new Error('Account rate limit reached.');
      }
      if (url.includes('grant_type=refresh_token')) {
        if (response.ok) refreshAfter = 0;
        else if (response.status >= 500) refreshFailure = response.clone();
      }
      return response;
    } catch {
      if (Date.now() < rateLimitedUntil) throw new Error('Account rate limit reached.');
      blockedUntil = Date.now() + 10000;
      throw new Error('Account network unavailable.');
    } finally {
      controller.abort();
      init?.signal?.removeEventListener('abort', abort);
    }
  };
  return boundedFetch;
}

export class RefreshSchedule {
  private timer: ReturnType<typeof setTimeout> | null = null;
  private active = false;
  private failures = 0;
  private running = false;

  constructor(private readonly refresh: () => Promise<unknown>, private readonly interval = 60000) {}

  start() {
    if (this.active) return;
    this.active = true;
    this.failures = 0;
    this.schedule(0);
  }

  stop() {
    this.active = false;
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
  }

  private schedule(delay: number) {
    if (!this.active || this.failures >= 2 || this.timer) return;
    this.timer = setTimeout(() => {
      this.timer = null;
      void this.tick();
    }, delay);
  }

  private async tick() {
    if (this.running || !this.active) return;
    this.running = true;
    try {
      const session = await this.refresh();
      this.failures = 0;
      if (session === null) this.stop();
    } catch {
      this.failures += 1;
    } finally {
      this.running = false;
      this.schedule(this.interval);
    }
  }
}
