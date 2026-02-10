# Прокси Gemini для терминала (Cloudflare Workers)

Браузер не может вызывать Gemini API из‑за CORS. Этот Worker принимает запросы с сайта и дергает Gemini — ключ хранится только в Cloudflare.

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

6. **URL воркера** (например `https://smith-proxy.ВАШ-СУБДОМЕН.workers.dev`) пропиши в **index.html**:
   ```html
   <script>window.DEEPSEEK_PROXY_URL = 'https://smith-proxy.ВАШ-СУБДОМЕН.workers.dev';</script>
   ```

После этого терминал на сайте ходит в Worker, Worker — в Gemini. Ключ в браузере не светится.
