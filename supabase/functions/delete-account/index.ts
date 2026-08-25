import { createClient } from 'npm:@supabase/supabase-js@2';

const responseHeaders = {
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Origin': '*',
  'Content-Type': 'application/json',
};

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response(null, { headers: responseHeaders, status: 204 });
  if (request.method !== 'POST') return response('Method not allowed', 405);
  const authorization = request.headers.get('Authorization');
  if (!authorization?.startsWith('Bearer ')) return response('Unauthorized', 401);
  const url = Deno.env.get('SUPABASE_URL');
  const publishableKey = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !publishableKey || !serviceRoleKey) return response('Unavailable', 503);
  const userClient = createClient(url, publishableKey, { global: { headers: { Authorization: authorization } } });
  const token = authorization.slice('Bearer '.length);
  const { data, error } = await userClient.auth.getUser(token);
  if (error || !data.user) return response('Unauthorized', 401);
  const admin = createClient(url, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const deletion = await admin.auth.admin.deleteUser(data.user.id);
  if (deletion.error) return response('Deletion failed', 502);
  return new Response(JSON.stringify({ deleted: true }), { headers: responseHeaders, status: 200 });
});

function response(message: string, status: number) {
  return new Response(JSON.stringify({ message }), { headers: responseHeaders, status });
}
