/* SKYWAY signal field: circuit paths carry packets; touch injects a signal. */
(() => {
    'use strict';
    document.addEventListener('DOMContentLoaded', () => {
        const canvas = document.getElementById('coreField');
        const ctx = canvas?.getContext('2d', { alpha: true });
        if (!ctx) return;
        const reduced = matchMedia('(prefers-reduced-motion: reduce)');
        const coarse = matchMedia('(pointer: coarse)');
        const sections = [...document.querySelectorAll('[data-field-mode]')];
        const pointer = { x: -1000, y: -1000, active: false, strength: 0 };
        const packets = [];
        let width = 0, height = 0, routes = [], elapsed = 0, raf = 0, last = 0;
        let lastTouchSignal = -1, sectionIndex = 0, activeRoute = -1;
        // Reused texture keeps the interaction inexpensive on phones.
        const glow = document.createElement('canvas');
        glow.width = glow.height = 192;
        const gc = glow.getContext('2d');
        if (!gc) return;
        const gradient = gc.createRadialGradient(96, 96, 0, 96, 96, 96);
        gradient.addColorStop(0, 'rgba(124,224,213,.24)');
        gradient.addColorStop(.25, 'rgba(70,170,160,.1)');
        gradient.addColorStop(1, 'rgba(70,170,160,0)');
        gc.fillStyle = gradient;
        gc.fillRect(0, 0, 192, 192);

        function resize() {
            width = innerWidth; height = innerHeight;
            const dpr = Math.min(devicePixelRatio || 1, 1.5);
            canvas.width = Math.round(width * dpr);
            canvas.height = Math.round(height * dpr);
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
            const count = width < 700 ? 7 : 8;
            routes = Array.from({length: count}, (_, i) => {
                const y = height * ((i + .4) / count);
                const direction = i % 2 ? 1 : -1;
                const bend = Math.min(64, width * .12) * direction;
                const x = width * (.16 + (i % 3) * .075);
                const x2 = width * (.62 + (i % 2) * .1);
                const points = [
                    {x:-60,y}, {x,y}, {x:x+Math.abs(bend),y:y+bend},
                    {x:x2,y:y+bend}, {x:x2+Math.abs(bend),y}, {x:width+60,y}
                ];
                let length = 0;
                const segments = points.slice(1).map((point,j) => {
                    const from = points[j];
                    const size = Math.hypot(point.x-from.x,point.y-from.y);
                    const segment = {from,to:point,start:length,length:size};
                    length += size;
                    return segment;
                });
                return {points,segments,length};
            });
            packets.length = 0;
            draw(0);
        }
        function pointAt(route, position) {
            const distance = Math.max(0,Math.min(1,position))*route.length;
            const segment = route.segments.find(s => distance <= s.start+s.length) || route.segments.at(-1);
            const t = Math.max(0,Math.min(1,(distance-segment.start)/segment.length));
            return {x:segment.from.x+(segment.to.x-segment.from.x)*t,y:segment.from.y+(segment.to.y-segment.from.y)*t};
        }
        function nearest(x,y) {
            let best = {distance: Infinity, index: 0, position: .5};
            routes.forEach((route,index) => route.segments.forEach(segment => {
                const dx=segment.to.x-segment.from.x,dy=segment.to.y-segment.from.y;
                const t=Math.max(0,Math.min(1,((x-segment.from.x)*dx+(y-segment.from.y)*dy)/(segment.length**2)));
                const distance=Math.hypot(x-segment.from.x-dx*t,y-segment.from.y-dy*t);
                if(distance<best.distance) best={distance,index,position:(segment.start+t*segment.length)/route.length};
            }));
            return best;
        }
        function trace(route) {
            ctx.beginPath();
            route.points.forEach((p,i) => i ? ctx.lineTo(p.x,p.y) : ctx.moveTo(p.x,p.y));
            ctx.stroke();
        }
        function spark(route, position, alpha, direction=1, bright=false) {
            for(let tail=6;tail>=0;tail--) {
                const u=position-tail*.004*direction;
                if(u<0 || u>1) continue;
                const p=pointAt(route,u);
                ctx.fillStyle=`rgba(${bright?'200,255,236':'124,224,213'},${alpha*(1-tail/7)})`;
                ctx.fillRect(p.x-(tail?1:2),p.y-(tail?1:2),tail?2:4,tail?2:4);
            }
        }
        function draw(dt) {
            ctx.clearRect(0,0,width,height);
            pointer.strength += ((pointer.active ? 1 : 0)-pointer.strength)*Math.min(1,dt*8);
            const focus=pointer.strength>.015 ? nearest(pointer.x,pointer.y) : null;
            const mobile=width<700;
            routes.forEach((route,index) => {
                const selected = focus?.index===index;
                const highlight=selected ? pointer.strength*.3 : index===activeRoute ? .16 : 0;
                ctx.strokeStyle=`rgba(124,224,213,${(mobile ? .13 : .085)+highlight})`;
                ctx.lineWidth=selected ? 1.5 : 1;
                trace(route);
                route.points.slice(1,-1).forEach(p => {
                    ctx.fillStyle=`rgba(124,224,213,${.22+highlight})`;
                    ctx.fillRect(p.x-2,p.y-2,4,4);
                    ctx.strokeStyle=`rgba(124,224,213,${.12+highlight})`;
                    ctx.strokeRect(p.x-5,p.y-5,10,10);
                });
                if(!reduced.matches) {
                    const position=(elapsed*(index % 2 ? .037 : .029)+index*.193+sectionIndex*.08)%1;
                    spark(route,index%2 ? 1-position : position,.55,index%2 ? -1 : 1);
                }
            });
            if(focus) {
                ctx.globalAlpha=pointer.strength;
                ctx.drawImage(glow,pointer.x-125,pointer.y-125,250,250);
                const p=pointAt(routes[focus.index],focus.position);
                ctx.strokeStyle=`rgba(175,255,230,${pointer.strength*.65})`;
                ctx.beginPath(); ctx.moveTo(pointer.x,pointer.y);ctx.lineTo(p.x,p.y);ctx.stroke();
                ctx.strokeRect(p.x-7,p.y-7,14,14);
                ctx.globalAlpha=1;
            }
            for(let i=packets.length-1;i>=0;i--) {
                const packet=packets[i];
                const age=elapsed-packet.born;
                const position=packet.position+age*packet.direction*.36;
                if(age>2.3 || position<0 || position>1) {packets.splice(i,1);continue;}
                spark(routes[packet.route],position,Math.min(1,(2.3-age)*2),packet.direction,true);
            }
        }
        function animate(now) {
            if(document.hidden || reduced.matches) {raf=0;return;}
            if(!last || now-last >= (coarse.matches ? 40 : 32)) {
                const dt=last ? Math.min(.08,(now-last)/1000) : .033;
                last=now;elapsed+=dt;draw(dt);
            }
            raf=requestAnimationFrame(animate);
        }
        function start() {
            if(!raf && !document.hidden && !reduced.matches) {last=0;raf=requestAnimationFrame(animate);}
        }
        function inject(x,y) {
            if(reduced.matches || !routes.length) return;
            const hit=nearest(x,y);
            for(const direction of [-1,1]) packets.push({route:hit.index,position:hit.position,direction,born:elapsed});
            if(packets.length>24) packets.splice(0,packets.length-24);
        }
        function move(x,y) {pointer.x=x;pointer.y=y;pointer.active=true;}
        function ignore(target) {return target instanceof Element && target.closest('input,textarea,select,.chat-widget,.mobile-menu');}
        // Passive listeners observe touches; they never capture or cancel page scrolling.
        addEventListener('pointermove',e => {if(!reduced.matches && !ignore(e.target)) move(e.clientX,e.clientY);},{passive:true});
        addEventListener('pointerdown',e => {
            if(ignore(e.target)) return;
            move(e.clientX,e.clientY);inject(e.clientX,e.clientY);
        },{passive:true});
        addEventListener('touchmove',e => {
            if(reduced.matches || ignore(e.target)) return;
            const t=e.touches[0];if(!t)return;
            move(t.clientX,t.clientY);
            if(elapsed-lastTouchSignal>.18) {inject(t.clientX,t.clientY);lastTouchSignal=elapsed;}
        },{passive:true});
        addEventListener('touchend',()=>{pointer.active=false;},{passive:true});
        addEventListener('pointerup',e=>{if(e.pointerType==='touch')pointer.active=false;},{passive:true});
        addEventListener('pointercancel',()=>{pointer.active=false;},{passive:true});
        document.addEventListener('pointerleave',()=>{pointer.active=false;});
        addEventListener('blur',()=>{pointer.active=false;});
        let resizeTimer;
        addEventListener('resize',()=>{clearTimeout(resizeTimer);resizeTimer=setTimeout(resize,120);},{passive:true});
        addEventListener('scroll',()=>{
            let best=Infinity;
            sections.forEach((section,index)=>{
                const rect=section.getBoundingClientRect();
                const distance=Math.abs(rect.top+Math.min(rect.height,height)/2-height/2);
                if(distance<best){best=distance;sectionIndex=index;}
            });
        },{passive:true});
        document.querySelectorAll('.service-card').forEach((card,index)=>{
            const select=()=>{activeRoute=index%routes.length;};
            const reset=()=>{activeRoute=-1;};
            card.addEventListener('pointerenter',select);card.addEventListener('pointerleave',reset);
            card.addEventListener('focusin',select);card.addEventListener('focusout',reset);
        });
        document.addEventListener('skyway:signal',e=>{
            activeRoute=(Number(e.detail?.step)||0)%routes.length;
            inject(width*.75,height*.4);
        });
        document.addEventListener('visibilitychange',()=>{
            if(document.hidden){cancelAnimationFrame(raf);raf=0;pointer.active=false;}
            else start();
        });
        reduced.addEventListener('change',()=>{
            cancelAnimationFrame(raf);raf=0;pointer.active=false;pointer.strength=0;packets.length=0;
            draw(0);start();
        });
        const moduleNames = { WEB: 'Сайт', BOOKING: 'Бронирование и запись', STORE: 'Интернет-магазин', CRM: 'Кастомная CRM', AI: 'ИИ-агент / менеджер / админ-панель', AUTO: 'Автоматизация', TELEGRAM: 'Уведомления в Telegram', SEO: 'SEO' };
        function setRequest(raw) {
            const text = (raw || '').trim().slice(0, 500);
            if (!text) return;
            const lower = text.toLocaleLowerCase('ru');
            const detected = [];
            const patterns = [
                ['STORE', /магазин|товар|заказ|e-commerce|shop/],
                ['BOOKING', /брон|отел|гостиниц|запис|booking/],
                ['WEB', /сайт|лендинг|web|страниц|витрин/],
                ['CRM', /crm|црм|клиент|лид|заявк/],
                ['AI', /(^|\W)ai(\W|$)|ии|искусствен|бот|ассистент|агент|менеджер|админ/],
                ['AUTO', /автомат|интеграц|процесс/],
                ['TELEGRAM', /telegram|телеграм|уведомлен/],
                ['SEO', /seo|поиск|продвижен/]
            ];
            for (const [key, pattern] of patterns) if (pattern.test(lower)) detected.push(key);
            if (!detected.length) detected.push('WEB');
            if (detected.includes('STORE') || detected.includes('BOOKING')) detected.unshift('WEB');
            const unique = [...new Set(detected)];
            const modules = document.getElementById('planModules');
            if (!modules) return;
            modules.replaceChildren();
            for (const key of unique) {
                const item = document.createElement('span');
                item.className = 'core-plan-module';
                item.textContent = moduleNames[key];
                modules.appendChild(item);
            }
            document.getElementById('planStatus').textContent = 'ЧЕРНОВИК ГОТОВ';
        }
        window.skywayCore = { setRequest };
        const terminalInput = document.getElementById('terminalInput');
        const sendBtn = document.querySelector('.terminal-send-btn');
        sendBtn?.addEventListener('click', () => setRequest(terminalInput?.value), true);
        terminalInput?.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey) setRequest(terminalInput.value); }, true);
        document.querySelectorAll('.terminal-quick-btn').forEach(btn => btn.addEventListener('click', () => setRequest(btn.dataset.message), true));
        resize();
        start();
    });
})();
