# Прокси Gemini для терминала (Cloudflare Workers)

Браузер не может вызывать Gemini API из‑за CORS. Этот Worker принимает запросы с сайта и дергает Gemini — ключ хранится только в Cloudflare.

Работает на `https://smit.skywayapsny.workers.dev/` (URL зашит в `js/main.js`, функция `getSmithResponse`).

## Шаги

1. **Аккаунт Cloudflare**  
   Зарегистрируйся на [dash.cloudflare.com](https://dash.cloudflare.com) (бесплатно).

2. **Установи Wrangler** (один раз):
   ```bash
   npm install -g wrangler
   wrangler login
   ```

3. **Ключ Gemini**  
   Возьми API-ключ в [Google AI Studio](https://aistudio.google.com/apikey).

4. **Деплой воркера** из папки `worker-deepseek-proxy`:
   ```bash
   cd worker-deepseek-proxy
   wrangler deploy
   ```

5. **Секрет в Cloudflare**:
   - Workers & Pages → ваш Worker → Settings → Variables.
   - Add variable: имя **GEMINI_API_KEY**, значение — ключ Gemini, включи "Encrypt" (Secret).
   - Либо через CLI: `wrangler secret put GEMINI_API_KEY`

## Защита воркера

В `src/index.js` уже встроены:
- Allowlist Origin (только `skyway-core.ru` и localhost для разработки)
- Лимит длины сообщения (1000 символов)
- Простой rate-limit: 10 запросов/мин на IP (в памяти изолята)

Для продакшн-уровня дополнительно включи в панели Cloudflare: **Security → Rate limiting rules** и **Bot Fight Mode** для `workers.dev` или кастомного роута.

## Модель

Используется `gemini-3.8-flash` (быстрые ответы, бесплатный тариф AI Studio). При выходе новой модели — поменять строку в `GEMINI_URL`.
