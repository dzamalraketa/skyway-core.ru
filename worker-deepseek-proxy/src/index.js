const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent';

// Разрешённые источники запросов (фронтенд сайта)
const ALLOWED_ORIGINS = [
  'https://skyway-core.ru',
  'https://www.skyway-core.ru',
  'http://localhost:4000',
  'http://127.0.0.1:4000',
  'http://localhost:8080',
  'http://127.0.0.1:8080',
];

const MAX_MESSAGE_LENGTH = 1000;
const RATE_LIMIT = 10;        // запросов
const RATE_WINDOW_MS = 60000; // в минуту на IP

// Простой rate-limit в памяти изолята (сбрасывается между изоляты,
// но защищает от очевидного флуда)
const rateBuckets = new Map();

function checkRateLimit(ip) {
  const now = Date.now();
  const bucket = rateBuckets.get(ip) || { count: 0, reset: now + RATE_WINDOW_MS };
  if (now > bucket.reset) {
    bucket.count = 0;
    bucket.reset = now + RATE_WINDOW_MS;
  }
  bucket.count++;
  rateBuckets.set(ip, bucket);
  return bucket.count <= RATE_LIMIT;
}

function corsHeaders(origin) {
  return {
    'Access-Control-Allow-Origin': ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0],
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Vary': 'Origin',
  };
}

function jsonResponse(body, status, origin) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(origin), 'Content-Type': 'application/json' },
  });
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';
    const headers = corsHeaders(origin);

    // Обработка предварительного запроса браузера
    if (request.method === 'OPTIONS') return new Response(null, { headers });

    if (request.method !== 'POST') {
      return jsonResponse({ error: 'Метод не поддерживается' }, 405, origin);
    }

    // Блокируем запросы не с сайта
    if (origin && !ALLOWED_ORIGINS.includes(origin)) {
      return jsonResponse({ error: 'Источник запрещён' }, 403, origin);
    }

    const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
    if (!checkRateLimit(ip)) {
      return jsonResponse({ error: 'Слишком много запросов. Повторите позже.' }, 429, origin);
    }

    try {
      const { message } = await request.json();

      if (typeof message !== 'string' || !message.trim() || message.length > MAX_MESSAGE_LENGTH) {
        return jsonResponse({ error: 'Некорректное сообщение' }, 400, origin);
      }

      const apiKey = env.GEMINI_API_KEY; // Берется из настроек Cloudflare

      if (!apiKey) {
        return jsonResponse({ error: 'Ключ API не настроен в Variables' }, 500, origin);
      }

      const response = await fetch(GEMINI_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
        body: JSON.stringify({
          contents: [{
            parts: [{ text: `Ты — Агент Смит из Матрицы. Твой стиль: холодный, философский, циничный. Ты называешь собеседника мистер Андерсон. Отвечай кратко. Сообщение: ${message.trim()}` }]
          }]
        })
      });

      const data = await response.json();
      const reply = data.candidates?.[0]?.content?.parts?.[0]?.text || 'Матрица блокирует сигнал...';

      return jsonResponse({ content: reply }, 200, origin);
    } catch (err) {
      return jsonResponse({ error: 'Ошибка сервера' }, 500, origin);
    }
  }
};
