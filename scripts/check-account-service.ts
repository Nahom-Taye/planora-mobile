import { validateAuthConfiguration } from '../src/features/auth/services/auth-configuration.ts';
import { resolve4 } from 'node:dns/promises';

const result = validateAuthConfiguration(process.env);
console.log(JSON.stringify({ configuration: result.status }));
if (result.status === 'ready') {
  for (const [label, hostname] of [
    ['configured-project', new URL(result.configuration.url).hostname],
    ['control', 'supabase.com'],
  ]) {
    try {
      await resolve4(hostname);
      console.log(JSON.stringify({ dns: label, status: 'resolved' }));
    } catch (error) {
      console.log(JSON.stringify({ dns: label, status: (error as { code?: string }).code }));
    }
  }
  for (const endpoint of ['health', 'settings']) {
    try {
      const response = await fetch(`${result.configuration.url}/auth/v1/${endpoint}`, {
        headers: { apikey: result.configuration.publishableKey },
        signal: AbortSignal.timeout(8000),
      });
      const body = await response.json();
      console.log(JSON.stringify({
        endpoint,
        status: response.status,
        signupDisabled: body.disable_signup,
        emailEnabled: body.external?.email,
        emailAutoConfirm: body.mailer_autoconfirm,
      }));
    } catch (error) {
      const cause = error as { name?: string; cause?: { code?: string } };
      console.log(JSON.stringify({ endpoint, failure: cause.cause?.code ?? cause.name }));
    }
  }
}
