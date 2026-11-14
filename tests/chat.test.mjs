import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../js/main.js',import.meta.url),'utf8');
class Node {
 constructor(){this.children=[];this.handlers={};this.attributes={};this.value='';this.classList={remove(){},toggle(){}};}
 set textContent(value){this.html=String(value).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');}
 get textContent(){return this.html||'';}
 set innerHTML(value){this.html=value;}
 get innerHTML(){return this.html||'';}
 appendChild(child){this.children.push(child);child.parentNode=this;return child;}
 remove(){this.parentNode.children=this.parentNode.children.filter(child=>child!==this);this.parentNode=null;}
 addEventListener(name,fn){this.handlers[name]=fn;}
 setAttribute(name,value){this.attributes[name]=value;}
}
function setup(fetch,greeting){
 const input=new Node(),output=new Node(),send=new Node();input.parentElement=new Node();
 const sandbox={document:{addEventListener(){},createElement:()=>new Node()},fetch,AbortController,setTimeout,clearTimeout,console:{error(){}},refs:{input,output,send,greeting}};
 sandbox.window={matchMedia:()=>({matches:true})};
 vm.runInNewContext(source+'\ninitChatBox(refs);',sandbox);
 return {input,output,send,write:message=>{input.value=message;send.handlers.click();},reply:()=>output.children.filter(node=>node.className==='terminal-line smith-response')};
}
const settle=()=>new Promise(resolve=>setImmediate(resolve));
test('first message renders one model reply and no extra scripted greeting; second includes real history',async()=>{
 const calls=[];const app=setup(async(_url,init)=>{calls.push(JSON.parse(init.body));return {ok:true,json:async()=>({content:calls.length===1?'Привет! Чем занимаетесь?':'Понял, нужен сайт.'})};});
 app.write('привет');await settle();
 assert.equal(app.output.children.length,2); // user + model; no injected greeting
 assert.equal(app.reply().length,1);assert.equal(calls[0].history.length,0);
 app.write('Нужен сайт');await settle();
 assert.equal(app.output.children.length,4);assert.equal(app.reply().length,2);
 assert.equal(calls[1].history[0].u,'привет');assert.equal(calls[1].history[0].b,'Привет! Чем занимаетесь?');
});
test('empty input produces no messages or requests',async()=>{
 let calls=0;const app=setup(async()=>{calls++;});app.write('   ');await settle();
 assert.equal(calls,0);assert.equal(app.output.children.length,0);
});
test('rapid repeated submit is ignored while waiting for the reply',async()=>{
 let resolve,calls=0;const app=setup(()=>{calls++;return new Promise(r=>{resolve=r;});});
 app.write('привет');app.write('ещё');assert.equal(calls,1);assert.equal(app.send.disabled,true);
 resolve({ok:true,json:async()=>({content:'Ответ'})});await settle();
 assert.equal(app.send.disabled,false);assert.equal(app.reply().length,1);
});
test('HTTP error produces one fallback message without contaminating conversation history',async()=>{
 const calls=[];const app=setup(async(_url,init)=>{calls.push(JSON.parse(init.body));return calls.length===1?{ok:false,status:503}:{ok:true,json:async()=>({content:'Работаю'})};});
 app.write('привет');await settle();assert.equal(app.reply().length,1);
 app.write('повтор');await settle();assert.equal(calls[1].history.length,0);assert.equal(app.reply().length,2);
});

test('widget provides its greeting context without inventing past turns, keeping actual user history intact',async()=>{
 const calls=[];const greeting='Здравствуйте, я Смит. Чем могу вам помочь?';
 const app=setup(async(_url,init)=>{calls.push(JSON.parse(init.body));return {ok:true,json:async()=>({content:'Расскажите о задаче.'})};},greeting);
 app.write('привет');await settle();
 assert.match(calls[0].message,/Не повторяйте приветствие/);
 assert.ok(calls[0].message.includes(greeting));assert.ok(calls[0].message.endsWith('привет'));
 assert.equal(calls[0].history.length,0);
 app.write('Нужен сайт');await settle();
 assert.ok(calls[1].message.endsWith('Нужен сайт'));assert.equal(calls[1].history[0].u,'привет');
 assert.equal(app.reply().length,2);
});

test('model greeting is not repeated after the opening; substantive first answers remain unchanged',async()=>{
 const calls=[];const greeting='Здравствуйте, я Смит. Чем могу вам помочь?';
 const app=setup(async(_url,init)=>{calls.push(JSON.parse(init.body));return {ok:true,json:async()=>({content:'Привет! Подскажите, с чем вам помочь?'})};},greeting);
 app.write('привет');await settle();app.write('Нужен сайт');await settle();
 assert.equal(calls[1].history[0].b,'Подскажите, с чем вам помочь?');
 const translations=[];
 const other=setup(async(_url,init)=>{translations.push(JSON.parse(init.body));return {ok:true,json:async()=>({content:'Привет!'})};},greeting);
 other.write('Переведи hello');await settle();other.write('Спасибо');await settle();
 assert.equal(translations[1].history[0].b,'Привет!');
});
