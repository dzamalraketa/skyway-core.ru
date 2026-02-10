const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export default {
  async fetch(request, env) {
    // Обработка предварительного запроса браузера
    if (request.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

    try {
      const { message } = await request.json();
      const apiKey = env.GEMINI_API_KEY; // Берется из настроек Cloudflare

      if (!apiKey) {
        return new Response(JSON.stringify({ error: "Ключ API не настроен в Variables" }), { status: 500, headers: corsHeaders });
      }

      const response = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [{ text: `Ты — Агент Смит из Матрицы. Твой стиль: холодный, философский, циничный. Ты называешь собеседника мистер Андерсон. Отвечай кратко. Сообщение: ${message}` }]
          }]
        })
      });

      const data = await response.json();
      const reply = data.candidates?.[0]?.content?.parts?.[0]?.text || "Матрица блокирует сигнал...";

      return new Response(JSON.stringify({ content: reply }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    } catch (err) {
      return new Response(JSON.stringify({ error: "Ошибка сервера: " + err.message }), {
        status: 500,
        headers: corsHeaders
      });
    }
  }
};
