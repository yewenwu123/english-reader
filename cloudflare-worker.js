const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json; charset=utf-8',
    },
  });
}

function parseGoogleResult(data) {
  if (!Array.isArray(data) || !Array.isArray(data[0])) return null;

  const translated = data[0]
    .map(part => Array.isArray(part) ? part[0] : '')
    .filter(Boolean)
    .join('')
    .trim();

  return translated || null;
}

export default {
  async fetch(request) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    const url = new URL(request.url);
    if (url.pathname !== '/translate') {
      return json({ error: 'Not found' }, 404);
    }

    const text = url.searchParams.get('q') || '';
    const source = url.searchParams.get('sl') || 'auto';
    const target = url.searchParams.get('tl') || 'zh-CN';

    if (!text.trim()) {
      return json({ error: 'Missing q' }, 400);
    }

    const googleParams = new URLSearchParams({
      client: 'gtx',
      dt: 't',
      sl: source,
      tl: target,
      q: text,
    });

    try {
      const response = await fetch(
        'https://translate.googleapis.com/translate_a/single?' + googleParams.toString(),
        {
          headers: {
            'User-Agent': 'Mozilla/5.0',
          },
        },
      );

      if (!response.ok) {
        return json({ error: 'Google translation failed' }, 502);
      }

      const translation = parseGoogleResult(await response.json());
      if (!translation) {
        return json({ error: 'Empty translation' }, 502);
      }

      return json({ translation });
    } catch (error) {
      return json({ error: 'Google translation failed' }, 502);
    }
  },
};
