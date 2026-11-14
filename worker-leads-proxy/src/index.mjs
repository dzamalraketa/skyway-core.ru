// Deploy separately from GitHub Pages to the existing Cloudflare Worker `leads`.
const ORIGINS = new Set(['https://skyway-core.ru', 'https://www.skyway-core.ru', 'http://localhost:8080', 'http://127.0.0.1:8080']);
const buckets = new Map();

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';
    const headers = {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'Vary': 'Origin',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    };
    if (ORIGINS.has(origin)) headers['Access-Control-Allow-Origin'] = origin;
    const json = (body, status) => new Response(JSON.stringify(body), {status, headers});
    if (!ORIGINS.has(origin)) return json({error: 'Источник запрещён'}, 403);
    // Preflight must succeed before the browser can send JSON.
    if (request.method === 'OPTIONS') return new Response(null, {status: 204, headers});
    if (request.method !== 'POST') return json({error: 'Метод не поддерживается'}, 405);
    const now = Date.now();
    for (const [key, bucket] of buckets) if (bucket.reset <= now) buckets.delete(key);
    const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
    const bucket = buckets.get(ip) || {count: 0, reset: now + 60000};
    buckets.set(ip, bucket);
    if (++bucket.count > 5) return json({error: 'Повторите через минуту'}, 429);
    let data;
    try {
      const raw = await request.text();
      if (raw.length > 12000) return json({error: 'Заявка слишком длинная'}, 413);
      data = JSON.parse(raw);
      if (!data || typeof data !== 'object') throw new Error('Invalid payload');
    } catch {
      return json({error: 'Некорректный JSON'}, 400);
    }
    const limits = {name: 100, phone: 100, business: 200, message: 2000};
    for (const [field, limit] of Object.entries(limits)) {
      if (field === 'message' && data[field] == null) data[field] = '';
      if (typeof data[field] !== 'string' || data[field].length > limit || (field !== 'message' && !data[field].trim())) {
        return json({error: 'Проверьте поля заявки'}, 400);
      }
      data[field] = data[field].trim();
    }
    if (!env.TELEGRAM_BOT_TOKEN || !env.TELEGRAM_CHAT_ID) return json({error: 'Приём заявок не настроен'}, 503);
    try {
      const upstream = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({
          chat_id: env.TELEGRAM_CHAT_ID,
          text: `Заявка с сайта SKYWAY\nИмя: ${data.name}\nКонтакт: ${data.phone}\nСфера бизнеса: ${data.business}\nКомментарий: ${data.message || '—'}`
        }),
        signal: AbortSignal.timeout(8000)
      });
      const result = await upstream.json();
      if (!upstream.ok || result.ok !== true) throw new Error('Delivery failed');
      return json({ok: true}, 200);
    } catch {
      return json({error: 'Не удалось подтвердить доставку'}, 502);
    }
  }
};
