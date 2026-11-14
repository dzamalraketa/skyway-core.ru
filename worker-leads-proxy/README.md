# Обработчик заявок SKYWAY

GitHub Pages обслуживает HTML, CSS и JS. Заявки принимает отдельный Cloudflare Worker по адресу `https://leads.skywayapsny.workers.dev`.

При проверке 14.11.2026 действующий Worker вернул 405 на OPTIONS без заголовков CORS. Браузер блокирует отправку JSON до отправки самой заявки. Push в GitHub не обновляет этот Worker.

Здесь подготовлен отдельный обработчик с OPTIONS/CORS, проверкой полей и подтверждением доставки в Telegram. Это замена обработчика, а не копия его действующего исходного кода: старого исходника в репозитории нет. Перед заменой сохранить текущую версию Worker и проверить, что Telegram — нужный канал доставки.

В Cloudflare открыть существующий Worker `leads`, задать секреты `TELEGRAM_BOT_TOKEN` и `TELEGRAM_CHAT_ID`, затем развернуть `src/index.mjs`. Использовать существующего бота и нужный чат владельца сайта. Не записывать секреты в Git. При использовании Wrangler запускать команды из этой папки после входа в свой аккаунт.

Проверка без отправки сообщения:

```sh
curl -i -X OPTIONS https://leads.skywayapsny.workers.dev \
  -H 'Origin: https://skyway-core.ru' \
  -H 'Access-Control-Request-Method: POST' \
  -H 'Access-Control-Request-Headers: content-type'
```

Ожидается 204 с `Access-Control-Allow-Origin: https://skyway-core.ru`. После настройки проверить одну реальную заявку и её получение в Telegram. Автоматические тесты используют заглушку Telegram и сообщений не отправляют: `npm test` из корня сайта.
