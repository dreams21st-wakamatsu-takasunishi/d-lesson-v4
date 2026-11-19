// Retired: all classroom account mutations now use the scoped D Support bridge.
const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'no-store',
};
Deno.serve(request => {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers });
  return new Response(JSON.stringify({
    error: '教室児童の登録と合言葉の管理は、Dサポートの「Dレッスン管理 → 児童・ログイン管理」で行ってください。',
  }), { status: request.method === 'POST' ? 410 : 405, headers });
});
