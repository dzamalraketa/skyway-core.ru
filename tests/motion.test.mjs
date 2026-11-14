import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../js/core.js',import.meta.url),'utf8');
function setup(reduce=false,width=390) {
 const events=new Map(), frames=new Map(), media=new Map();
 let id=0,draws=0;
 const context={};
 for(const key of ['clearRect','setTransform','fillRect','strokeRect','drawImage','beginPath','moveTo','lineTo','stroke'])context[key]=(...args)=>{
  for(const value of args) if(typeof value==='number') assert.ok(Number.isFinite(value),`${key} received a non-finite coordinate`);
  if(key==='fillRect')draws++;
 };
 context.createRadialGradient=()=>({addColorStop(){}});
 const canvas={getContext:()=>context};
 const on=(name,handler,options)=>{if(!events.has(name))events.set(name,[]);events.get(name).push({handler,options});};
 const document={hidden:false,addEventListener:on,getElementById:id=>id==='coreField'?canvas:null,querySelector:()=>null,querySelectorAll:()=>[],createElement:()=>({getContext:()=>context})};
 const sandbox={document,innerWidth:width,innerHeight:844,devicePixelRatio:3,Element:class{},matchMedia:query=>{
  if(!media.has(query))media.set(query,{matches:query.includes('reduced')?reduce:true,addEventListener:(name,handler)=>on(query+name,handler)});
  return media.get(query);
 },requestAnimationFrame:fn=>{frames.set(++id,fn);return id;},cancelAnimationFrame:id=>frames.delete(id),setTimeout,clearTimeout,addEventListener:on};
 sandbox.window=sandbox;
 vm.runInNewContext(source,sandbox);
 events.get('DOMContentLoaded')[0].handler();
 const emit=(name,event={})=>events.get(name)?.forEach(item=>item.handler(event));
 const frame=now=>{const current=[...frames.values()];frames.clear();current.forEach(fn=>fn(now));};
 return {events,frames,document,emit,frame,draws:()=>draws};
}
test('touch drag paints feedback without blocking scrolling; page hide cancels animation',()=>{
 const app=setup();
 for(const name of ['touchmove','touchend','pointerdown','pointermove'])assert.ok(app.events.get(name).every(e=>e.options.passive));
 const before=app.draws();
 app.emit('touchmove',{touches:[{clientX:150,clientY:220}],target:null,preventDefault(){throw new Error('Scroll was blocked');}});
 app.frame(1000);app.frame(1050);app.frame(1100);
 assert.ok(app.draws()>before);
 app.document.hidden=true;app.emit('visibilitychange');assert.equal(app.frames.size,0);
 app.document.hidden=false;app.emit('visibilitychange');assert.equal(app.frames.size,1);
});
test('reduced motion paints a static scene without an animation loop',()=>{
 const app=setup(true);
 assert.ok(app.draws()>0);assert.equal(app.frames.size,0);
 app.emit('pointerdown',{clientX:100,clientY:100,target:null});
 assert.equal(app.frames.size,0);
});
test('touch paths remain finite at phone and desktop dimensions over repeated gestures',()=>{
 for(const width of [320,390,1440]){
  const app=setup(false,width);
  for(let i=0;i<80;i++){
   app.emit('touchmove',{touches:[{clientX:(i*37)%width,clientY:(i*43)%844}],target:null});
   app.frame(i*50+1000);
  }
  assert.equal(app.frames.size,1);
 }
});

const mainSource=readFileSync(new URL('../js/main.js',import.meta.url),'utf8');
function setupJourney(reduce=false) {
 const node=()=>({dataset:{},attributes:{},hidden:false,textContent:'',listeners:{},classList:{toggle(){},add(){},remove(){}},setAttribute(k,v){this.attributes[k]=v;},addEventListener(k,v){this.listeners[k]=v;}});
 const stage=node(),toggle=node(),icon=node(),feed=node(),count=node(),label=node(),buttons=Array.from({length:4},node),dots=Array.from({length:4},node),box=node();
 toggle.querySelector=()=>icon;
 box.querySelector=s=>({'.core-diagram-stage':stage,'.core-flow-toggle':toggle,'.core-flow-count':count,'.engine-core-label':label}[s]);
 box.querySelectorAll=s=>s==='.core-flow-step'?buttons:dots;
 let observer,id=0;const timers=new Map(),events={};
 const document={hidden:false,querySelector:()=>box,getElementById:()=>feed,addEventListener:(k,v)=>{events[k]=v;},dispatchEvent(){}};
 const sandbox={document,matchMedia:()=>({matches:reduce,addEventListener(){}}),setTimeout:(fn,delay)=>{timers.set(++id,{fn,delay});return id;},clearTimeout:id=>timers.delete(id),CustomEvent:class{},IntersectionObserver:class{constructor(cb){observer=cb;}observe(){}}};
 sandbox.window=sandbox;
 vm.runInNewContext(mainSource+'\ninitCoreDiagram();',sandbox);
 return {document,events,timers,box,stage,toggle,feed,buttons,label,observe:visible=>observer([{isIntersecting:visible}])};
}
test('journey pauses outside viewport and manual taps select the correct lead stage',()=>{
 const app=setupJourney();
 assert.equal(app.timers.size,0);
 app.observe(true);assert.ok([...app.timers.values()].some(t=>t.delay===3200));
 app.observe(false);assert.equal(app.timers.size,0);
 app.observe(true);app.buttons[2].listeners.click();
 assert.equal(app.box.dataset.flowStep,'2');
 assert.equal(app.buttons[2].attributes['aria-pressed'],'true');
 assert.equal(app.label.textContent,'ЗАЯВКА');
 assert.match(app.feed.textContent,/CRM сохраняет/);
 assert.equal(app.feed.attributes['aria-live'],'polite');
 assert.ok(![...app.timers.values()].some(t=>t.delay===3200));
 app.stage.listeners.click();assert.equal(app.box.dataset.flowStep,'3');
 app.toggle.listeners.click();assert.ok([...app.timers.values()].some(t=>t.delay===3200));
 app.document.hidden=true;app.events.visibilitychange();
 assert.ok(![...app.timers.values()].some(t=>t.delay===3200));
});
test('reduced motion keeps manual journey navigation available without autoplay',()=>{
 const app=setupJourney(true);app.observe(true);
 assert.equal(app.timers.size,0);assert.equal(app.toggle.hidden,true);
 app.stage.listeners.click();assert.equal(app.box.dataset.flowStep,'1');assert.equal(app.timers.size,0);
});
