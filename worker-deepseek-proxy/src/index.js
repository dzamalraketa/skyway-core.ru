// Основная модель + fallback при перегрузке/квоте (503/429)
const GEMINI_MODELS = ['gemini-3.8-flash', 'gemini-2.5-flash'];
const GEMINI_API = 'https://generativelanguage.googleapis.com/v1beta/models/';

// Системный промпт: ИИ-консультант SKYWAY, серьёзный продажник
const SYSTEM_PROMPT = `Ты — ИИ-консультант рекламного агентства SKYWAY (skyway-core.ru). Общаешься с посетителями сайта в окне терминала. Твоя задача — помочь клиенту и довести его до заявки.

О КОМПАНИИ:
- SKYWAY создаёт ИИ-агентов и ИИ-менеджеров для продаж и поддержки, кастомные CRM, ИИ-админки, сайты и занимается SEO-продвижением
- ИИ-менеджер: ведёт диалог с клиентом, уточняет запрос, фиксирует заявку, передаёт менеджеру на нужном этапе
- ИИ-админка: управление агентом — диалоги, база знаний, настройки, контроль обращений
- CRM: проектируется под процессы клиента — этапы сделок, роли, история клиентов, интеграции с каналами
- Ориентиры цен: сайты от 15 000 ₽, ИИ-инструменты от 40 000 ₽, CRM от 75 000 ₽; SEO от 25 000 ₽/мес
- Контакты: форма на сайте (раздел Контакты), Telegram t.me/skywayapsny, WhatsApp +7 940 711-77-06

КАК РАБОТАТЬ С КЛИЕНТОМ:
1. Сначала выясни задачу: чем занимается бизнес, откуда приходят заявки, где теряются клиенты
2. Предложи конкретное решение SKYWAY под задачу и назови выгоду (ответы 24/7, не теряются заявки, дешевле найма менеджера)
3. Цены называй только вилкой «от ...» — точная смета считается после короткого брифа
4. Завершай ответ призывом к действию: оставить заявку в форме на сайте или написать в Telegram @skywayapsny
5. Если спрашивают то, чего нет в услугах — честно скажи и предложи обсудить с командой

СТИЛЬ:
- Деловой, вежливый, уверенный. Без шуток, без философии, без воды
- Отвечай кратко: 1-3 предложения. Это терминал, а не письмо
- Только русский язык
- Никаких списков, заголовков и разметки — обычный разговорный текст
- Не выдумывай факты о компании — опирайся только на описание выше`;

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

// Gemini: основная модель + fallback при перегрузке/квоте
async function askGemini(apiKey, message) {
  const payload = JSON.stringify({
    systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
    contents: [{ parts: [{ text: message }] }],
    generationConfig: { maxOutputTokens: 1024, temperature: 0.7 }
  });
  for (const model of GEMINI_MODELS) {
    const response = await fetch(`${GEMINI_API}${model}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      body: payload
    });
    const data = await response.json();
    // Ответ может быть разбит на несколько parts — склеиваем текстовые,
    // пропуская служебные thought-части
    const reply = (data.candidates?.[0]?.content?.parts || [])
      .filter(p => !p.thought && p.text)
      .map(p => p.text)
      .join('');
    if (reply) return reply;
    // На перегрузку/квоту переходим к следующей модели, остальные ошибки не маскируем
    if (![429, 500, 503].includes(data.error?.code)) return '';
  }
  return '';
}

// Grok (xAI): OpenAI-совместимый API
async function askGrok(apiKey, message, model) {
  const response = await fetch('https://api.x.ai/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: model || 'grok-3-mini',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: message }
      ],
      max_tokens: 1024,
      temperature: 0.7
    })
  });
  const data = await response.json();
  return data.choices?.[0]?.message?.content || '';
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

      let reply = '';

      // Приоритет: Grok (xAI), если задан ключ; иначе Gemini
      const grokKey = env.GROK_API_KEY || env.XAI_API_KEY;
      if (grokKey) reply = await askGrok(grokKey, message.trim(), env.GROK_MODEL);
      if (!reply && env.GEMINI_API_KEY) reply = await askGemini(env.GEMINI_API_KEY, message.trim());
      if (!reply && !grokKey && !env.GEMINI_API_KEY) {
        return jsonResponse({ error: 'Ключ API не настроен в Variables' }, 500, origin);
      }

      if (!reply) reply = 'Сервис временно недоступен. Напишите нам в Telegram @skywayapsny или оставьте заявку в форме ниже.';

      return jsonResponse({ content: reply }, 200, origin);
    } catch (err) {
      return jsonResponse({ error: 'Ошибка сервера' }, 500, origin);
    }
  }
};
