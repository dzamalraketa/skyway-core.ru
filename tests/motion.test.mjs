import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../js/core.js',import.meta.url),'utf8');
function setup(reduce=false,width=390,height=844) {
 const events=new Map(), frames=new Map(), media=new Map();
 let id=0,draws=0;
 const calls=[];
 const context={};
 for(const key of ['clearRect','setTransform','fillRect','strokeRect','drawImage','beginPath','moveTo','lineTo','stroke'])context[key]=(...args)=>{
  for(const value of args) if(typeof value==='number') assert.ok(Number.isFinite(value),`${key} received a non-finite coordinate`);
  if(key==='fillRect')draws++;
  calls.push({key,args,fillStyle:context.fillStyle,strokeStyle:context.strokeStyle,alpha:context.globalAlpha});
 };
 context.createRadialGradient=(...args)=>{
  for(const value of args) assert.ok(Number.isFinite(value),'createRadialGradient received a non-finite value');
  return {addColorStop(){}};
 };
 const canvas={getContext:()=>context};
 const on=(name,handler,options)=>{if(!events.has(name))events.set(name,[]);events.get(name).push({handler,options});};
 const document={hidden:false,addEventListener:on,getElementById:id=>id==='coreField'?canvas:null,querySelector:()=>null,querySelectorAll:()=>[],createElement:()=>({getContext:()=>context})};
 const sandbox={document,innerWidth:width,innerHeight:height,devicePixelRatio:3,scrollY:0,Element:class{},matchMedia:query=>{
  if(!media.has(query))media.set(query,{matches:query.includes('reduced')?reduce:true,addEventListener:(name,handler)=>on(query+name,handler)});
  return media.get(query);
 },requestAnimationFrame:fn=>{frames.set(++id,fn);return id;},cancelAnimationFrame:id=>frames.delete(id),setTimeout,clearTimeout,addEventListener:on};
 sandbox.window=sandbox;
 vm.runInNewContext(source,sandbox);
 events.get('DOMContentLoaded')[0].handler();
 const emit=(name,event={})=>events.get(name)?.forEach(item=>item.handler(event));
 const frame=now=>{const current=[...frames.values()];frames.clear();current.forEach(fn=>fn(now));};
 // Calls made while running fn (e.g. one animation frame).
 const record=fn=>{const from=calls.length;fn();return calls.slice(from);};
 return {events,frames,document,sandbox,emit,frame,record,calls,draws:()=>draws};
}
// Bright packet heads/trails use this colour; ambient sparks never do.
const isPacket=c=>c.key==='fillRect'&&/210,255,240/.test(c.fillStyle);
// The pointer focus glow is drawn as a 250x250 halo.
const isFocusGlow=c=>c.key==='drawImage'&&c.args[3]===250&&c.args[4]===250;
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
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

test('quick tap leaves a lingering afterglow after touchend that fades out',()=>{
 const app=setup();
 app.frame(1000);
 app.emit('pointerdown',{clientX:180,clientY:300,pointerType:'touch',target:null});
 app.emit('touchend',{});
 app.emit('pointerup',{pointerType:'touch'});
 // Released before any frame ran: the afterglow must still flash on the following frames.
 const first=app.record(()=>app.frame(1033));
 const glow=first.find(isFocusGlow);
 assert.ok(glow,'tap afterglow halo is drawn after release');
 assert.equal(glow.args[1],180-125);assert.equal(glow.args[2],300-125);
 assert.ok(glow.alpha>.25,`quick tap flashes visibly (alpha ${glow.alpha})`);
 assert.ok(first.some(isPacket),'tap injects packets');
 let t=1033,peak=glow.alpha,later=0;
 for(let i=0;i<8;i++){t+=33;const g=app.record(()=>app.frame(t)).find(isFocusGlow);if(g){peak=Math.max(peak,g.alpha);later=g.alpha;}}
 assert.ok(later>0,'afterglow still visible ~0.3s after release');
 assert.ok(later<peak,'afterglow is fading');
 for(let i=0;i<40;i++){t+=33;app.frame(t);}
 assert.ok(!app.record(()=>app.frame(t+33)).some(isFocusGlow),'afterglow is gone once hold expires');
});
test('scrolling triggers signal activity and keeps the loop alive',()=>{
 const app=setup();
 app.frame(1000);
 const idle=app.record(()=>app.frame(1033)).filter(isPacket).length;
 app.sandbox.scrollY=220;app.emit('scroll');
 assert.equal(app.frames.size,1);
 const after=app.record(()=>app.frame(1066));
 // Only the idle ambient packet exists before; scroll adds a multi-route cascade.
 assert.ok(after.filter(isPacket).length>idle,'scroll injects packets');
 // Diagnostic diamond pulse is drawn with path segments around the injection point.
 assert.ok(after.some(c=>c.key==='strokeRect'&&/175,255,235/.test(c.strokeStyle)),'scroll emits a diagnostic pulse');
 // Successive scroll signals land in different places.
 const pulseOrigins=new Set();
 for(let i=1;i<=4;i++){
  app.sandbox.scrollY=220+i*160;app.emit('scroll');
  const c=app.record(()=>app.frame(1066+i*33)).filter(c=>c.key==='drawImage'&&c.alpha>.6);
  for(const g of c)pulseOrigins.add(Math.round(g.args[2]));
 }
 assert.ok(pulseOrigins.size>1,'scroll signals do not stack on one point');
});
test('scroll under reduced motion never starts animation',()=>{
 const app=setup(true);
 app.sandbox.scrollY=400;app.emit('scroll');
 assert.equal(app.frames.size,0);
});
test('mobile URL-bar resize preserves active packets with finite coordinates; rotation resets',async()=>{
 const app=setup(false,390,844);
 app.frame(1000);
 app.emit('pointerdown',{clientX:200,clientY:420,pointerType:'touch',target:null});
 app.emit('touchend',{});
 app.frame(1033);
 // URL bar collapses: same width, height grows by 90px.
 app.sandbox.innerHeight=934;app.emit('resize');
 await wait(160);
 const kept=app.record(()=>app.frame(1066));
 assert.ok(kept.some(isPacket),'packets survive URL-bar resize');
 for(const c of kept)for(const v of c.args)if(typeof v==='number')assert.ok(Number.isFinite(v));
 // URL bar expands again by a sub-threshold delta, repeatedly.
 for(const h of [844,900,844]){app.sandbox.innerHeight=h;app.emit('resize');await wait(160);}
 assert.ok(app.record(()=>app.frame(1099)).some(isPacket),'packets survive repeated URL-bar toggles');
 assert.equal(app.frames.size,1);
 // Orientation change is a real layout change: state resets.
 app.sandbox.innerWidth=844;app.sandbox.innerHeight=390;app.emit('resize');
 await wait(160);
 assert.ok(!app.record(()=>app.frame(1132)).some(isPacket),'rotation clears stale packets');
});
test('identical resize skips canvas reallocation and redraw',async()=>{
 const app=setup();
 const before=app.calls.length;
 app.emit('resize');
 await wait(160);
 assert.equal(app.calls.length,before,'no redraw when the viewport size is unchanged');
 app.sandbox.innerHeight=800;app.emit('resize');
 await wait(160);
 assert.ok(app.calls.some((c,i)=>i>=before&&c.key==='setTransform'),'real size change still rebuilds the field');
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
