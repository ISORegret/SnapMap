// Proxies an image URL and returns it with CORS headers so the app can use it for Share as image.
import { corsHeaders } from '../_shared/cors.ts';

const MAX_URL_LENGTH = 2048;
const ALLOWED_ORIGINS = ['https:', 'http:'];

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'GET') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const url = new URL(req.url);
  const imageUrl = url.searchParams.get('url');
  if (!imageUrl || imageUrl.length > MAX_URL_LENGTH) {
    return new Response(JSON.stringify({ error: 'Missing or invalid url parameter' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  let parsed: URL;
  try {
    parsed = new URL(imageUrl);
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid url' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
  if (!ALLOWED_ORIGINS.includes(parsed.protocol)) {
    return new Response(JSON.stringify({ error: 'Invalid url protocol' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const imageResponse = await fetch(imageUrl, {
      headers: { Accept: 'image/*' },
      redirect: 'follow',
    });
    if (!imageResponse.ok) {
      return new Response(
        JSON.stringify({ error: `Upstream returned ${imageResponse.status}` }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    const contentType = imageResponse.headers.get('Content-Type') || 'image/jpeg';
    const body = await imageResponse.arrayBuffer();
    return new Response(body, {
      headers: {
        ...corsHeaders,
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=86400',
      },
    });
  } catch (e) {
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : 'Fetch failed' }),
      { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
