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
        const pointer = { x: -1000, y: -1000, active: false, strength: 0, hold: 0 };
        const packets = [];
        const pulses = [];
        let width = 0, height = 0, routes = [], elapsed = 0, raf = 0, last = 0;
        let lastTouchSignal = -1, sectionIndex = 0, activeRoute = -1;
        let scrollEnergy = 0, lastScrollY = 0, scrollDistance = 0, ambientPulse = -1;
        // Reused texture keeps the interaction inexpensive on phones.
        const glow = document.createElement('canvas');
        glow.width = glow.height = 192;
        const gc = glow.getContext('2d');
        if (!gc) return;
        const gradient = gc.createRadialGradient(96, 96, 0, 96, 96, 96);
        gradient.addColorStop(0, 'rgba(160,255,238,.32)');
        gradient.addColorStop(.32, 'rgba(124,224,213,.14)');
        gradient.addColorStop(1, 'rgba(70,170,160,0)');
        gc.fillStyle = gradient;
        gc.fillRect(0, 0, 192, 192);
        // Far "depth" lattice: prerendered once per resize, scrolled with parallax via a single drawImage.
        const depth = document.createElement('canvas');
        const dc = depth.getContext('2d');
        const GRID = 44, PERIOD = GRID * 4;
        let scrollInjects = 0;
        function buildDepth() {
            if (!dc) return;
            depth.width = Math.ceil(width);
            depth.height = Math.ceil(height + PERIOD);
            dc.clearRect(0, 0, depth.width, depth.height);
            const cx = width / 2;
            for (let gx = GRID / 2, col = 0; gx < width; gx += GRID, col++) {
                // Brighter toward the edges, quieter behind the centred text column.
                const edge = Math.min(1, Math.abs(gx - cx) / Math.max(1, cx));
                const base = .035 + edge * edge * .085;
                for (let gy = GRID / 2, row = 0; gy < height + PERIOD; gy += GRID, row++) {
                    const cell = (col * 7 + (row % 4) * 13) % 11; // periodic every 4 rows: seamless wrap
                    if (cell === 0) {
                        dc.fillStyle = `rgba(124,224,213,${(base * 1.6).toFixed(3)})`;
                        dc.fillRect(gx - 3, gy - .5, 7, 1);
                        dc.fillRect(gx - .5, gy - 3, 1, 7);
                    } else {
                        dc.fillStyle = `rgba(124,224,213,${(base * (cell % 3 ? .8 : 1.2)).toFixed(3)})`;
                        dc.fillRect(gx - .75, gy - .75, 1.5, 1.5);
                    }
                }
            }
        }

        function buildSegments(points) {
            let length = 0;
            const segments = points.slice(1).map((point, j) => {
                const from = points[j];
                const size = Math.max(1, Math.hypot(point.x - from.x, point.y - from.y));
                const segment = { from, to: point, start: length, length: size };
                length += size;
                return segment;
            });
            return { points, segments, length: Math.max(1, length) };
        }
        function resize(preserveState = false) {
            // CSS sizes the canvas to the large viewport (100lvh), so URL-bar collapse usually leaves it unchanged.
            const nextW = Math.max(1, canvas.clientWidth || innerWidth || 1);
            const nextH = Math.max(1, canvas.clientHeight || innerHeight || 1);
            if (preserveState && nextW === width && nextH === height) return;
            const urlBarResize = preserveState && width > 0 && Math.abs(nextW - width) < 4 && width < 700 && Math.abs(nextH - height) < 150;
            width = nextW; height = nextH;
            const dpr = Math.min(devicePixelRatio || 1, 1.5);
            canvas.width = Math.round(width * dpr);
            canvas.height = Math.round(height * dpr);
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
            const mobile = width < 700;
            const hCount = mobile ? 7 : 8;
            const hRoutes = Array.from({length: hCount}, (_, i) => {
                const y = height * ((i + .45) / hCount);
                const direction = i % 2 ? 1 : -1;
                const bend = (mobile ? Math.min(72, Math.max(28, width * .15)) : Math.min(64, width * .12)) * direction;
                const x = mobile ? width * (.11 + (i % 3) * .065) : width * (.16 + (i % 3) * .075);
                const x2 = mobile ? width * (.66 + (i % 2) * .11) : width * (.62 + (i % 2) * .1);
                return buildSegments([
                    {x:-60,y}, {x,y}, {x:x+Math.abs(bend),y:y+bend},
                    {x:x2,y:y+bend}, {x:x2+Math.abs(bend),y}, {x:width+60,y}
                ]);
            });
            const vPositions = mobile ? [.08, .92] : [.06, .94];
            const vRoutes = vPositions.map((rx, idx) => {
                const x = width * rx;
                const inward = idx === 0 ? 1 : -1;
                const step = Math.min(34, Math.max(16, width * (mobile ? .06 : .03))) * inward;
                const y1 = height * .22;
                const y2 = height * .52;
                const y3 = height * .76;
                return buildSegments([
                    {x, y:-50},
                    {x, y:y1},
                    {x:x+step, y:y1+Math.abs(step)},
                    {x:x+step, y:y2},
                    {x, y:y2+Math.abs(step)},
                    {x, y:y3},
                    {x:x+step*.7, y:y3+Math.abs(step)*.7},
                    {x, y:height+50}
                ]);
            });
            routes = [...hRoutes, ...vRoutes];
            buildDepth();
            if (!urlBarResize) {
                packets.length = 0;
                pulses.length = 0;
            } else {
                for (let i = packets.length - 1; i >= 0; i--) {
                    if (packets[i].route >= routes.length) packets[i].route %= routes.length;
                }
            }
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
            const step = (width < 700 ? 6 : 7) / Math.max(180, route.length);
            const trailPoints = [];
            for(let tail=8;tail>=0;tail--) {
                const u=position-tail*step*direction;
                if(u<0 || u>1) continue;
                const p=pointAt(route,u);
                trailPoints.push({x:p.x,y:p.y,tail});
            }
            if(!trailPoints.length) return;
            if(trailPoints.length>1) {
                ctx.beginPath();
                for(let i=trailPoints.length-1;i>=0;i--) {
                    const pt=trailPoints[i];
                    if(i===trailPoints.length-1) ctx.moveTo(pt.x,pt.y);
                    else ctx.lineTo(pt.x,pt.y);
                }
                ctx.strokeStyle=`rgba(${bright?'185,255,235':'124,224,213'},${(alpha*(bright?.52:.32)).toFixed(3)})`;
                ctx.lineWidth=bright?2.2:1.5;
                ctx.stroke();
            }
            for(const pt of trailPoints) {
                const fade=1-pt.tail/9;
                const size=pt.tail===0?(bright?5:4):(pt.tail<3?2.5:2);
                const half=size/2;
                ctx.fillStyle=`rgba(${bright?'210,255,240':'124,224,213'},${(alpha*fade).toFixed(3)})`;
                ctx.fillRect(pt.x-half,pt.y-half,size,size);
            }
            const head=trailPoints[trailPoints.length-1];
            if(head.tail===0 && (bright || (width<700 && alpha>.45))) {
                const halo=bright?56:38;
                const prevAlpha=ctx.globalAlpha;
                ctx.globalAlpha=Math.min(1,alpha*(bright?.75:.42));
                ctx.drawImage(glow,head.x-halo,head.y-halo,halo*2,halo*2);
                ctx.globalAlpha=prevAlpha;
            }
        }
        function draw(dt) {
            ctx.clearRect(0,0,width,height);
            if(dc) {
                // Far layer drifts slower than the page scroll: parallax depth behind the circuit routes.
                const shift=((lastScrollY*.18+(reduced.matches?0:elapsed*3))%PERIOD+PERIOD)%PERIOD;
                ctx.drawImage(depth,0,-shift,width,height+PERIOD);
            }
            scrollEnergy = Math.max(0, scrollEnergy - dt * 1.8);
            pointer.hold = Math.max(0, pointer.hold - dt);
            const targetStrength = pointer.active ? 1 : pointer.hold > 0 ? (pointer.hold / .42) * .85 : 0;
            // Fast attack even after release, so a quick tap still flashes before its afterglow fades.
            const rising = targetStrength > pointer.strength;
            pointer.strength += (targetStrength - pointer.strength) * Math.min(1, dt * (pointer.active || rising ? 14 : 6));
            const focus=pointer.strength>.015 ? nearest(pointer.x,pointer.y) : null;
            const mobile=width<700;
            const hCount=mobile?7:8;
            routes.forEach((route,index) => {
                const selected = focus?.index===index;
                const highlight=selected ? pointer.strength*.32 : index===activeRoute ? .18 : 0;
                const isVertical=index>=hCount;
                const baseAlpha=mobile ? (isVertical ? .15 : .14) : (isVertical ? .09 : .085);
                ctx.strokeStyle=`rgba(124,224,213,${(baseAlpha+highlight).toFixed(3)})`;
                ctx.lineWidth=selected ? 1.6 : 1;
                trace(route);
                const rawPos=!reduced.matches ? (elapsed*(index % 2 ? .039 : .031)+index*.193+sectionIndex*.08)%1 : -1;
                const ambientPos=rawPos>=0 ? (index%2 ? 1-rawPos : rawPos) : -1;
                const sparkPt=ambientPos>=0 ? pointAt(route,ambientPos) : null;
                route.points.slice(1,-1).forEach(p => {
                    let nodeBoost=highlight;
                    if(sparkPt) {
                        const d=Math.hypot(p.x-sparkPt.x,p.y-sparkPt.y);
                        if(d<46) nodeBoost+=(1-d/46)*.45;
                    }
                    if(focus) {
                        const dFocus=Math.hypot(p.x-pointer.x,p.y-pointer.y);
                        if(dFocus<90) nodeBoost+=(1-dFocus/90)*pointer.strength*.35;
                    }
                    ctx.fillStyle=`rgba(155,245,230,${Math.min(1,.24+nodeBoost).toFixed(3)})`;
                    ctx.fillRect(p.x-2,p.y-2,4,4);
                    ctx.strokeStyle=`rgba(124,224,213,${Math.min(1,.14+nodeBoost).toFixed(3)})`;
                    ctx.lineWidth=1;
                    const box=nodeBoost>.2?6:5;
                    ctx.strokeRect(p.x-box,p.y-box,box*2,box*2);
                });
                if(!reduced.matches) {
                    spark(route,ambientPos,mobile?.68:.58,index%2 ? -1 : 1);
                    if(mobile && index%2===0) {
                        const subPos=(elapsed*.053+index*.31+.45)%1;
                        spark(route,1-subPos,.44,-1);
                    }
                }
            });
            if(!reduced.matches && mobile && !pointer.active && pointer.hold<=0 && routes.length) {
                const period=2.4;
                const slot=Math.floor(elapsed/period);
                const routeIndex=(sectionIndex*2+slot)%routes.length;
                if(dt>0 && slot>ambientPulse) {
                    ambientPulse=slot;
                    const dir=slot%2?-1:1;
                    packets.push({route:routeIndex,position:dir>0?.12:.88,direction:dir,born:elapsed});
                    if(packets.length>28) packets.splice(0,packets.length-28);
                }
                const phase=(elapsed%period)/period;
                const pulseAlpha=Math.sin(phase*Math.PI)*.42;
                if(pulseAlpha>.02) {
                    const pts=routes[routeIndex].points;
                    const mid=pts[Math.floor(pts.length/2)];
                    const prevAlpha=ctx.globalAlpha;
                    ctx.globalAlpha=pulseAlpha;
                    ctx.drawImage(glow,mid.x-64,mid.y-64,128,128);
                    ctx.globalAlpha=prevAlpha;
                    ctx.strokeStyle=`rgba(124,224,213,${(pulseAlpha*.9).toFixed(3)})`;
                    ctx.lineWidth=1;
                    const r=6+phase*14;
                    ctx.strokeRect(mid.x-r,mid.y-r,r*2,r*2);
                }
            }
            if(focus) {
                ctx.globalAlpha=pointer.strength;
                ctx.drawImage(glow,pointer.x-125,pointer.y-125,250,250);
                const p=pointAt(routes[focus.index],focus.position);
                ctx.strokeStyle=`rgba(175,255,230,${(pointer.strength*.7).toFixed(3)})`;
                ctx.lineWidth=1.25;
                ctx.beginPath(); ctx.moveTo(pointer.x,pointer.y);ctx.lineTo(p.x,p.y);ctx.stroke();
                ctx.strokeRect(p.x-7,p.y-7,14,14);
                ctx.globalAlpha=1;
            }
            for(let i=pulses.length-1;i>=0;i--) {
                const p=pulses[i];
                const age=elapsed-p.born;
                if(age<0 || age>.85) {pulses.splice(i,1);continue;}
                const progress=age/.85;
                const fade=1-progress;
                const radius=10+progress*52;
                const prevAlpha=ctx.globalAlpha;
                ctx.globalAlpha=fade*.65;
                const halo=32+progress*48;
                ctx.drawImage(glow,p.x-halo,p.y-halo,halo*2,halo*2);
                ctx.globalAlpha=prevAlpha;
                ctx.strokeStyle=`rgba(175,255,235,${(fade*.72).toFixed(3)})`;
                ctx.lineWidth=1.4;
                ctx.strokeRect(p.x-radius*.72,p.y-radius*.72,radius*1.44,radius*1.44);
                ctx.beginPath();
                ctx.moveTo(p.x,p.y-radius);
                ctx.lineTo(p.x+radius,p.y);
                ctx.lineTo(p.x,p.y+radius);
                ctx.lineTo(p.x-radius,p.y);
                ctx.lineTo(p.x,p.y-radius);
                ctx.stroke();
                const relay=6+progress*18;
                ctx.strokeStyle=`rgba(124,224,213,${(fade*.8).toFixed(3)})`;
                ctx.lineWidth=1.2;
                ctx.strokeRect(p.nx-relay,p.ny-relay,relay*2,relay*2);
            }
            for(let i=packets.length-1;i>=0;i--) {
                const packet=packets[i];
                const route=routes[packet.route];
                if(!route) {packets.splice(i,1);continue;}
                const age=elapsed-packet.born;
                const position=packet.position+age*packet.direction*.4;
                if(age<0 || age>2.4 || position<0 || position>1) {packets.splice(i,1);continue;}
                const alpha=Math.min(1,(2.4-age)*2);
                spark(route,position,alpha,packet.direction,true);
                // Relay flash: a node briefly lights up as a packet passes through it.
                const head=pointAt(route,position);
                for(let n=1;n<route.points.length-1;n++) {
                    const node=route.points[n];
                    const d=Math.hypot(head.x-node.x,head.y-node.y);
                    if(d>=16) continue;
                    const k=1-d/16;
                    ctx.strokeStyle=`rgba(200,255,240,${(alpha*k*.85).toFixed(3)})`;
                    ctx.lineWidth=1.2;
                    const box=6+k*4;
                    ctx.strokeRect(node.x-box,node.y-box,box*2,box*2);
                }
            }
        }
        function animate(now) {
            if(document.hidden || reduced.matches) {raf=0;return;}
            if(!last || now-last >= (coarse.matches ? 26 : 22)) {
                const dt=last ? Math.min(.08,(now-last)/1000) : .033;
                last=now;elapsed+=dt*(1+scrollEnergy*1.4);draw(dt);
            }
            raf=requestAnimationFrame(animate);
        }
        function start() {
            if(!raf && !document.hidden && !reduced.matches) {last=0;raf=requestAnimationFrame(animate);}
        }
        function inject(x,y) {
            if(reduced.matches || !routes.length || !Number.isFinite(x) || !Number.isFinite(y)) return;
            const hit=nearest(x,y);
            activeRoute=hit.index;
            for(const direction of [-1,1]) packets.push({route:hit.index,position:hit.position,direction,born:elapsed});
            const coupled=(hit.index+1)%routes.length;
            packets.push({route:coupled,position:hit.position,direction:hit.index%2?-1:1,born:elapsed});
            if(packets.length>28) packets.splice(0,packets.length-28);
            const nodePoint=pointAt(routes[hit.index],hit.position);
            pulses.push({x,y,nx:nodePoint.x,ny:nodePoint.y,born:elapsed});
            if(pulses.length>12) pulses.splice(0,pulses.length-12);
        }
        function move(x,y) {
            if(!Number.isFinite(x) || !Number.isFinite(y)) return;
            pointer.x=x;pointer.y=y;pointer.active=true;pointer.hold=.42;
        }
        function ignore(target) {return target instanceof Element && target.closest('input,textarea,select,.chat-widget,.mobile-menu');}
        // Passive listeners observe touches; they never capture or cancel page scrolling.
        addEventListener('pointermove',e => {if(!reduced.matches && !ignore(e.target)) move(e.clientX,e.clientY);},{passive:true});
        addEventListener('pointerdown',e => {
            if(reduced.matches || ignore(e.target)) return;
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
        addEventListener('resize',()=>{clearTimeout(resizeTimer);resizeTimer=setTimeout(()=>resize(true),120);},{passive:true});
        addEventListener('scroll',()=>{
            const prevSection=sectionIndex;
            let best=Infinity;
            sections.forEach((section,index)=>{
                const rect=section.getBoundingClientRect();
                const distance=Math.abs(rect.top+Math.min(rect.height,height)/2-height/2);
                if(distance<best){best=distance;sectionIndex=index;}
            });
            const sy=window.scrollY || window.pageYOffset || 0;
            const dy=Math.abs(sy-lastScrollY);
            lastScrollY=sy;
            scrollEnergy=Math.min(1,scrollEnergy+Math.min(.5,dy/140));
            scrollDistance+=dy;
            if(scrollDistance>130 || (dy===0 && sectionIndex!==prevSection)) {
                scrollDistance=0;
                if(dy===0) scrollEnergy=Math.min(1,scrollEnergy+.35);
                // Alternate sides and walk the injection height so scroll signals don't stack in one spot.
                scrollInjects++;
                const side=(sectionIndex+scrollInjects)%2;
                inject(width*(side ? .82 : .18),height*(.26+((scrollInjects*.382)%1)*.48));
                start();
            }
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
            if(document.hidden){cancelAnimationFrame(raf);raf=0;pointer.active=false;pointer.hold=0;}
            else start();
        });
        reduced.addEventListener('change',()=>{
            cancelAnimationFrame(raf);raf=0;pointer.active=false;pointer.hold=0;pointer.strength=0;packets.length=0;pulses.length=0;scrollEnergy=0;
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
