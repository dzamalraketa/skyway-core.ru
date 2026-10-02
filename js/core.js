/* SKYWAY CORE FIELD: one lightweight canvas across the home page. */
(() => {
    'use strict';
    document.addEventListener('DOMContentLoaded', () => {
        const canvas = document.getElementById('coreField');
        if (!canvas) return;
        const ctx = canvas.getContext('2d', { alpha: true });
        if (!ctx) return;
        const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
        const coarsePointer = window.matchMedia('(pointer: coarse)');
        const sections = [...document.querySelectorAll('[data-field-mode]')];
        const pageMode = document.body.dataset.fieldMode || 'hero';
        const serviceCards = [...document.querySelectorAll('.service-card[data-service]')];
        const caseCards = [...document.querySelectorAll('.core-case-card')];
        const mechanism = document.querySelector('.core-hero-diagram');
        const pointer = { x: -1000, y: -1000, active: false, vx: 0, vy: 0, stamp: 0 };
        // На тач-устройствах курсора нет — эта точка медленно блуждает,
        // чтобы поверхность изгибалась и оставалась живой без мыши
        const autoFocus = { x: 0, y: 0, vx: 0, vy: 0 };
        const drift = { x: 0, y: 0 };
        const steps = 64;
        let springs = [];
        let width = 0, height = 0, dpr = 1, particles = [], mode = 'hero', hoverMode = null, hoverPoint = null;
        let lastFrame = 0, raf = 0, visible = !document.hidden, elapsed = 0, wave = .066, laneCount = 6;
        let lineGradient, isMobile = false;
        // A small cached light texture avoids rebuilding full-screen gradients every frame.
        const light = document.createElement('canvas');
        light.width = light.height = 256;
        const lightContext = light.getContext('2d');
        const lightGradient = lightContext.createRadialGradient(128, 128, 0, 128, 128, 128);
        lightGradient.addColorStop(0, 'rgba(70,175,167,.2)');
        lightGradient.addColorStop(.4, 'rgba(42,127,126,.09)');
        lightGradient.addColorStop(1, 'rgba(22,76,82,0)');
        lightContext.fillStyle = lightGradient;
        lightContext.fillRect(0, 0, 256, 256);

        function size() {
            width = innerWidth;
            height = innerHeight;
            dpr = Math.min(devicePixelRatio || 1, coarsePointer.matches ? 1.25 : 1.5);
            canvas.width = Math.round(width * dpr);
            canvas.height = Math.round(height * dpr);
            canvas.style.width = width + 'px';
            canvas.style.height = height + 'px';
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
            isMobile = width < 700;
            laneCount = isMobile ? 5 : 6;
            springs = Array.from({ length: laneCount }, () =>
                Array.from({ length: steps + 1 }, () => ({ x: 0, y: 0, vx: 0, vy: 0 })));
            const count = width < 700 ? 34 : 48;
            particles = Array.from({ length: count }, (_, i) => ({
                lane: i % laneCount, offset: (i * .61803398875) % 1,
                depth: .35 + (i % 7) / 10, seed: i * 2.39996, circuit: i % 8 === 0
            }));
            // На мобильных поверхность делаем заметно ярче — тонкие штрихи теряются на маленьком экране
            const boost = isMobile ? 2 : 1;
            lineGradient = ctx.createLinearGradient(0, 0, width, 0);
            lineGradient.addColorStop(0, `rgba(108,201,194,${.025 * boost})`);
            lineGradient.addColorStop(.34, `rgba(108,201,194,${.055 * boost})`);
            lineGradient.addColorStop(.72, `rgba(124,224,213,${Math.min(.34, .18 * boost)})`);
            lineGradient.addColorStop(1, `rgba(108,201,194,${.055 * boost})`);
            draw(true);
        }
        function restPoint(lane, u, time) {
            const bend = Math.sin(u * 5.2 + time * .13 + lane * .55) * wave;
            const detail = Math.sin(u * 9 - time * .075 + lane * .9) * .019;
            return {
                x: u * width + drift.x * (lane % 2 ? .45 : 1),
                y: height * (.12 + lane / (laneCount - 1) * .73 + (u - .5) * .22 + bend + detail) + drift.y
            };
        }
        function updatePhysics(dt, time, focus) {
            // Damped springs share movement with their neighbours. Small integration
            // steps keep the surface stable when a frame is delayed.
            const iterations = Math.ceil(dt / .012);
            const h = dt / iterations;
            const radius = Math.min(245, Math.max(165, width * .19));
            for (let pass = 0; pass < iterations; pass++) {
                for (let lane = 0; lane < laneCount; lane++) {
                    const row = springs[lane];
                    for (let i = 0; i <= steps; i++) {
                        const node = row[i];
                        const left = row[Math.max(0, i - 1)], right = row[Math.min(steps, i + 1)];
                        let fx = 0, fy = 0;
                        if (focus) {
                            const base = restPoint(lane, i / steps * 1.08 - .04, time);
                            const dx = base.x + node.x - focus.x;
                            const dy = base.y + node.y - focus.y;
                            const distance = Math.hypot(dx, dy);
                            if (distance < radius) {
                                const falloff = Math.pow(1 - distance / radius, 2);
                                const divisor = Math.max(distance, 16);
                                fx = (dx / divisor * 2100 + (focus.vx || 0) * 1.4) * falloff;
                                fy = (dy / divisor * 2100 + (focus.vy || 0) * 1.4) * falloff;
                            }
                        }
                        node.vx += (fx - node.x * 25 - node.vx * 8 + (left.x + right.x - node.x * 2) * 48) * h;
                        node.vy += (fy - node.y * 25 - node.vy * 8 + (left.y + right.y - node.y * 2) * 48) * h;
                    }
                    for (const node of row) {
                        node.x += node.vx * h;
                        node.y += node.vy * h;
                        const displacement = Math.hypot(node.x, node.y);
                        if (displacement > 72) {
                            node.x *= 72 / displacement;
                            node.y *= 72 / displacement;
                            node.vx *= .6;
                            node.vy *= .6;
                        }
                    }
                }
            }
            pointer.vx *= Math.exp(-dt * 12);
            pointer.vy *= Math.exp(-dt * 12);
        }
        function contourPoint(lane, u, time) {
            const point = restPoint(lane, u, time);
            if (reducedMotion.matches) return point;
            const position = Math.max(0, Math.min(steps, (u + .04) / 1.08 * steps));
            const index = Math.floor(position), blend = position - index;
            const a = springs[lane][index], b = springs[lane][Math.min(steps, index + 1)];
            point.x += a.x + (b.x - a.x) * blend;
            point.y += a.y + (b.y - a.y) * blend;
            return point;
        }
        function traceContour(lane, time, offset = 0) {
            ctx.beginPath();
            for (let step = 0; step <= steps; step++) {
                const p = contourPoint(lane, step / steps * 1.08 - .04, time);
                if (!step) ctx.moveTo(p.x, p.y + offset);
                else ctx.lineTo(p.x, p.y + offset);
            }
            ctx.stroke();
        }
        function draw(staticOnly = false, dt = 1 / 30) {
            ctx.clearRect(0, 0, width, height);
            const moving = !staticOnly && !reducedMotion.matches;
            const time = reducedMotion.matches ? 0 : elapsed;
            const activeMode = hoverMode || mode;
            const connected = ['business', 'enterprise', 'terminal', 'cases'].includes(activeMode);
            const desiredWave = activeMode === 'start' ? .035 : activeMode === 'terminal' ? .065 : connected ? .085 : .066;
            const ease = moving ? 1 - Math.exp(-dt * 1.1) : 1;
            wave += (desiredWave - wave) * ease;
            const focus = hoverPoint || (pointer.active ? pointer : (coarsePointer.matches ? autoFocus : null));
            if (coarsePointer.matches && !pointer.active && !hoverPoint && moving) {
                autoFocus.x = width * (.5 + .3 * Math.sin(time * .21));
                autoFocus.y = height * (.44 + .24 * Math.sin(time * .31 + 1.3));
            }
            drift.x += ((moving && focus ? (focus.x / width - .5) * 14 : 0) - drift.x) * ease;
            drift.y += ((moving && focus ? (focus.y / height - .5) * 10 : 0) - drift.y) * ease;
            if (moving) updatePhysics(dt, time, focus);

            // Wide, slowly moving light pools give depth without flashing behind the copy.
            const glowSize = Math.max(width * .8, height * .9);
            const gx = width * (.79 + Math.sin(time * .055) * .055);
            const gy = height * (.43 + Math.cos(time * .067) * .13);
            ctx.globalAlpha = .78;
            ctx.drawImage(light, gx - glowSize / 2, gy - glowSize / 2, glowSize, glowSize);
            ctx.globalAlpha = .32;
            ctx.drawImage(light, -glowSize * .45, height * (.74 + Math.sin(time * .04) * .08) - glowSize / 2, glowSize, glowSize);
            ctx.globalAlpha = 1;

            ctx.strokeStyle = lineGradient;
            ctx.lineWidth = isMobile ? 1.1 : .8;
            for (let lane = 0; lane < laneCount; lane++) {
                traceContour(lane, time);
                // A faint parallel line reads as a flowing surface, rather than a wire mesh.
                ctx.globalAlpha = isMobile ? .45 : .3;
                traceContour(lane, time, 15 + lane * 2);
                ctx.globalAlpha = 1;
            }
            for (const p of particles) {
                const u = (p.offset + time * .006 * p.depth) % 1;
                const point = contourPoint(p.lane, u, time);
                const edge = Math.min(1, u * 9, (1 - u) * 9);
                const alpha = Math.min(1, (.12 + p.depth * .18) * edge * (isMobile ? 1.5 : 1));
                ctx.fillStyle = `rgba(155,225,217,${alpha})`;
                ctx.beginPath();
                ctx.arc(point.x, point.y, (.55 + p.depth * .75) * (isMobile ? 1.4 : 1), 0, Math.PI * 2);
                ctx.fill();
                // A handful of bright square nodes make the moving surface read as a
                // quiet circuit network. They follow the same cursor-bent contours.
                if (p.circuit && alpha > .1) {
                    const next = contourPoint(p.lane, Math.min(.995, u + .008), time);
                    ctx.globalAlpha = Math.min(.72, alpha * 2.1);
                    ctx.strokeStyle = 'rgba(124,224,213,.72)';
                    ctx.lineWidth = .7;
                    ctx.beginPath();
                    ctx.moveTo(point.x, point.y);
                    ctx.lineTo(next.x, next.y);
                    ctx.stroke();
                    ctx.fillStyle = '#9af5e8';
                    ctx.shadowColor = '#6fe0d0';
                    ctx.shadowBlur = 7;
                    ctx.fillRect(point.x - 1.5, point.y - 1.5, 3, 3);
                    ctx.shadowBlur = 0;
                    ctx.globalAlpha = 1;
                }
            }
            // Only a few small signals move faster than the surface itself.
            const signals = width < 700 ? 3 : 3;
            for (let i = 0; i < signals; i++) {
                const u = (i * .31 + time * .021) % 1;
                const lane = (i * 2 + 1) % laneCount;
                const fade = Math.min(1, u * 12, (1 - u) * 12);
                for (let tail = 7; tail >= 0; tail--) {
                    const point = contourPoint(lane, Math.max(0, u - tail * .004), time);
                    ctx.fillStyle = `rgba(162,239,226,${(.42 - tail * .05) * fade * (isMobile ? 1.25 : 1)})`;
                    ctx.beginPath();
                    ctx.arc(point.x, point.y, (tail ? .85 : 1.5) * (isMobile ? 1.4 : 1), 0, Math.PI * 2);
                    ctx.fill();
                }
            }
        }
        function animate(now) {
            if (!visible || reducedMotion.matches) { raf = 0; return; }
            const interval = coarsePointer.matches ? 42 : 32;
            if (!lastFrame || now - lastFrame >= interval) {
                const dt = lastFrame ? Math.min((now - lastFrame) / 1000, .08) : 1 / 30;
                lastFrame = now;
                elapsed += dt;
                draw(false, dt);
            }
            raf = requestAnimationFrame(animate);
        }
        function ensureAnimation() {
            if (!raf && visible && !reducedMotion.matches) { lastFrame = 0; raf = requestAnimationFrame(animate); }
        }
        function updateSection() {
            let current = sections[0];
            const center = height * .48;
            let best = Infinity;
            for (const section of sections) {
                const r = section.getBoundingClientRect();
                const distance = center < r.top ? r.top - center : center > r.bottom ? center - r.bottom : 0;
                if (distance < best) { best = distance; current = section; }
            }
            mode = current ? current.dataset.fieldMode : pageMode;
            if (reducedMotion.matches) draw(true);
        }
        let resizeTimer;
        addEventListener('resize', () => { clearTimeout(resizeTimer); resizeTimer = setTimeout(() => { size(); updateSection(); }, 150); }, { passive: true });
        addEventListener('scroll', updateSection, { passive: true });
        addEventListener('pointermove', e => {
            if (reducedMotion.matches) return;
            const now = performance.now();
            const dt = Math.max(.016, (now - pointer.stamp) / 1000);
            pointer.vx = pointer.active ? Math.max(-900, Math.min(900, (e.clientX - pointer.x) / dt)) : 0;
            pointer.vy = pointer.active ? Math.max(-900, Math.min(900, (e.clientY - pointer.y) / dt)) : 0;
            pointer.x = e.clientX;
            pointer.y = e.clientY;
            pointer.stamp = now;
            pointer.active = true;
        }, { passive: true });
        document.addEventListener('pointerleave', () => { pointer.active = false; });
        // На тачах палец отпускают — точка касания перестаёт тянуть поверхность
        addEventListener('pointerup', e => { if (e.pointerType === 'touch') pointer.active = false; }, { passive: true });
        addEventListener('pointercancel', e => { if (e.pointerType === 'touch') pointer.active = false; }, { passive: true });
        addEventListener('blur', () => { pointer.active = false; });
        document.addEventListener('visibilitychange', () => { visible = !document.hidden; if (visible) ensureAnimation(); else { cancelAnimationFrame(raf); raf = 0; } });
        reducedMotion.addEventListener('change', () => { if (reducedMotion.matches) { cancelAnimationFrame(raf); raf = 0; draw(true); } else ensureAnimation(); });
        serviceCards.forEach(card => {
            card.addEventListener('pointerenter', () => { hoverMode = card.dataset.service === 'start' ? 'start' : card.dataset.service === 'business' ? 'business' : 'enterprise'; });
            card.addEventListener('pointerleave', () => { hoverMode = null; });
            card.addEventListener('focusin', () => { hoverMode = card.dataset.service === 'start' ? 'start' : card.dataset.service === 'business' ? 'business' : 'enterprise'; });
            card.addEventListener('focusout', () => { hoverMode = null; });
        });
        caseCards.forEach(card => {
            card.addEventListener('pointerenter', () => { const r = card.getBoundingClientRect(); hoverPoint = { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
            card.addEventListener('pointerleave', () => { hoverPoint = null; });
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
        if (mechanism && 'IntersectionObserver' in window) {
            let inView = true;
            const syncMechanism = () => mechanism.classList.toggle('is-idle', !inView || document.hidden);
            new IntersectionObserver(([entry]) => { inView = entry.isIntersecting; syncMechanism(); }, { rootMargin: '30px' }).observe(mechanism);
            document.addEventListener('visibilitychange', syncMechanism);
        }
        size();
        updateSection();
        ensureAnimation();
    });
})();
