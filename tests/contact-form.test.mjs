import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const source = readFileSync(new URL('../js/main.js', import.meta.url), 'utf8');
function setup(fetch) {
  const handlers = {};
  const submit = {innerHTML: 'Отправить', disabled: false};
  const status = {hidden: true, dataset: {}};
  const fallback = {hidden: true};
  const elements = Object.fromEntries(Object.entries({name:' Тест ',phone:' @test ',business:' Сервис ',message:'',trap_field:''}).map(([key,value]) => [key,{value, setCustomValidity(message){this.error=message;}}]));
  const form = {
    elements, resetCalled:false,
    querySelector: () => submit,
    addEventListener: (name, fn) => {handlers[name]=fn;},
    setAttribute() {},
    reportValidity: () => !Object.values(elements).some(el=>el.error),
    reset(){this.resetCalled=true;}
  };
  const nodes = {contactForm:form, formStatus:status, formFallback:fallback};
  const context = vm.createContext({document:{addEventListener(){}, getElementById:id=>nodes[id]}, fetch, AbortController, setTimeout, clearTimeout, console});
  vm.runInContext(source, context);
  vm.runInContext('initContactForm()', context);
  return {form, submit, status, fallback, send:() => handlers.submit({preventDefault(){}})};
}
test('network failure preserves all fields and displays persistent fallback', async () => {
  const ui=setup(async()=>{throw new Error('Offline');});
  await ui.send();
  assert.equal(ui.form.resetCalled,false);
  assert.equal(ui.form.elements.phone.value,' @test ');
  assert.equal(ui.fallback.hidden,false);
  assert.equal(ui.status.dataset.type,'error');
  assert.equal(ui.submit.disabled,false);
});
test('HTTP failure is not shown as success', async () => {
  const ui=setup(async()=>({ok:false,status:500}));
  await ui.send();
  assert.equal(ui.form.resetCalled,false);
  assert.equal(ui.status.dataset.type,'error');
});
test('confirmed response resets fields; submitted contact is trimmed', async () => {
  const ui=setup(async(_url, init)=>{
    assert.equal(JSON.parse(init.body).phone,'@test');
    return {ok:true};
  });
  await ui.send();
  assert.equal(ui.form.resetCalled,true);
  assert.equal(ui.status.dataset.type,'success');
  assert.equal(ui.fallback.hidden,true);
});
test('blank input and repeated clicks do not create duplicate requests', async () => {
  let count=0, resolve;
  const ui=setup(()=>{count++;return new Promise(r=>{resolve=r;});});
  ui.form.elements.name.value='   ';
  await ui.send();
  assert.equal(count,0);
  ui.form.elements.name.value='Тест';
  const pending=ui.send();
  await ui.send();
  assert.equal(count,1);
  resolve({ok:true});
  await pending;
});
