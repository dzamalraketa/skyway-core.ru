import {test} from 'node:test';
import assert from 'node:assert/strict';
import worker from '../worker-leads-proxy/src/index.mjs';
let ip = 0;
function request(method, data, origin = 'https://skyway-core.ru') {
  return new Request('https://example.test/', {method, headers: {Origin: origin, 'Content-Type': 'application/json', 'CF-Connecting-IP': String(++ip)}, ...(data === undefined ? {} : {body: JSON.stringify(data)})});
}
const data = {name: 'Тест', phone: '@test', business: 'Тест', message: ''};
test('browser preflight accepts both production origins and JSON header', async () => {
  for (const origin of ['https://skyway-core.ru', 'https://www.skyway-core.ru']) {
    const res = await worker.fetch(request('OPTIONS', undefined, origin), {});
    assert.equal(res.status, 204);
    assert.equal(res.headers.get('Access-Control-Allow-Origin'), origin);
    assert.equal(res.headers.get('Access-Control-Allow-Headers'), 'Content-Type');
  }
});
test('foreign origins cannot send leads', async () => {
  const res = await worker.fetch(request('POST', data, 'https://other.test'), {});
  assert.equal(res.status, 403);
  assert.equal(res.headers.get('Access-Control-Allow-Origin'), null);
});
test('invalid fields and missing setup do not report success', async () => {
  assert.equal((await worker.fetch(request('POST', {...data, name: ' '}), {})).status, 400);
  assert.equal((await worker.fetch(request('POST', data), {})).status, 503);
});
test('success requires confirmed delivery; Telegram errors remain failures', async () => {
  const original = globalThis.fetch;
  const env = {TELEGRAM_BOT_TOKEN: 'test-only', TELEGRAM_CHAT_ID: 'test-only'};
  try {
    globalThis.fetch = async (_url, init) => {
      const sent = JSON.parse(init.body);
      assert.match(sent.text, /Контакт: @test/);
      assert.equal(sent.parse_mode, undefined);
      return Response.json({ok: true});
    };
    assert.equal((await worker.fetch(request('POST', data), env)).status, 200);
    globalThis.fetch = async () => Response.json({ok: false}, {status: 400});
    assert.equal((await worker.fetch(request('POST', data), env)).status, 502);
    globalThis.fetch = async () => {throw new Error('Offline');};
    assert.equal((await worker.fetch(request('POST', data), env)).status, 502);
  } finally {globalThis.fetch = original;}
});
