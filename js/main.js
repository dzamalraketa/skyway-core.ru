// ===== SKYWAY MAIN JAVASCRIPT =====

// ===== GLOBAL VARIABLES =====
let matrixInterval;
let typedTextElement;
let typedTextArrays = {
    index: ["Создаем сайты на уровне ядра", "Внедряем ИИ в ваш бизнес", "Обеспечиваем рост через SEO-инжиниринг", "Автоматизируем рутину: нестандартный подход"],
    services: ["высокого качества", "полного цикла", "с гарантией результата"],
    case: ["реализованных в срок", "любой сложности", "с полным сопровождением"],
    contact: ["ждем ваших идей", "на связи 24/7", "готовы к сотрудничеству"]
};

let titleTexts = {
    index: "инженерный маркетинг",
    services: "профессиональные услуги",
    case: "портфолио инженерных решений",
    contact: "свяжитесь с нами"
};

let typedTextArray = [];
let arrayIndex = 0;
let charIndex = 0;
let isDeleting = false;
let typingSpeed = 120;

// ===== INITIALIZATION =====
document.addEventListener('DOMContentLoaded', function() {
    // Обработка хеша #terminal при переходе с других страниц
    if (window.location.hash === '#terminal') {
        const terminal = document.getElementById('terminal');
        if (terminal) {
            // Небольшая задержка для корректной отрисовки
            setTimeout(() => {
                terminal.scrollIntoView({ behavior: 'smooth', block: 'start' });
                // Очищаем хеш из URL
                if (history.replaceState) {
                    history.replaceState(null, '', window.location.pathname + window.location.search);
                }
            }, 100);
        }
    }
    initMatrixEffect();
    initTypedText();
    initMobileMenu();
    initScrollAnimations();
    initConsole();
    initContactForm();
    initSmoothScroll();
    initHeaderScroll();
    initChatFab();
    initMobileAccordions();
    initHeaderDropdown();
});

// ===== MATRIX EFFECT =====
function initMatrixEffect() {
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        return;
    }

    const canvasIds = ['matrix-hero', 'matrix-services', 'matrix-contact', 'matrix-cases', 'matrixAbout'];
    const canvas = canvasIds
        .map((id) => document.getElementById(id))
        .find((el) => el);
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    let isVisible = false;
    let animationId = null;
    
    // IntersectionObserver to pause when not visible
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            isVisible = entry.isIntersecting;
            if (isVisible && !animationId) {
                animate();
            }
        });
    }, { threshold: 0.1 });
    
    observer.observe(canvas);
    
    function resizeCanvas() {
        canvas.width = canvas.offsetWidth;
        canvas.height = canvas.offsetHeight;
    }
    
    resizeCanvas();
    window.addEventListener('resize', debounce(resizeCanvas, 250));
    
    // Binary only - 0 and 1
    const chars = '01';
    const fontSize = 18;
    let columns = Math.floor(canvas.width / fontSize);
    
    let drops = Array(columns).fill(1);
    let columnChars = Array(columns).fill('');
    
    // Generate binary sequences for each column
    function initColumns() {
        columns = Math.floor(canvas.width / fontSize);
        drops = Array(columns).fill(1);
        columnChars = Array(columns).fill('');
        
        for (let i = 0; i < columns; i++) {
            let binaryString = '';
            for (let j = 0; j < 20; j++) {
                binaryString += Math.random() > 0.5 ? '1' : '0';
            }
            columnChars[i] = binaryString;
        }
    }
    
    initColumns();
    
    function drawMatrix() {
        ctx.fillStyle = 'rgba(0, 15, 5, 0.05)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        ctx.font = `bold ${fontSize}px 'Courier New', monospace`;
        
        for (let i = 0; i < drops.length; i++) {
            const pos = Math.floor(drops[i]) % columnChars[i].length;
            const char = columnChars[i][pos];
            
            const x = i * fontSize;
            const y = drops[i] * fontSize;
            
            if (char === '1') {
                ctx.fillStyle = '#00f2ff';
                ctx.shadowColor = '#00f2ff';
                ctx.shadowBlur = 5;
            } else {
                ctx.fillStyle = '#00b8cc';
                ctx.shadowBlur = 0;
            }
            
            ctx.fillText(char, x, y);
            ctx.shadowBlur = 0;
            
            if (y > canvas.height && Math.random() > 0.98) {
                drops[i] = 0;
                let newBinary = '';
                for (let j = 0; j < 20; j++) {
                    newBinary += Math.random() > 0.5 ? '1' : '0';
                }
                columnChars[i] = newBinary;
            }
            
            if (char === '1') {
                drops[i] += 0.7 + Math.random() * 0.3;
            } else {
                drops[i] += 0.4 + Math.random() * 0.2;
            }
        }
    }
    
    function animate() {
        if (!isVisible) {
            animationId = null;
            return;
        }
        drawMatrix();
        animationId = requestAnimationFrame(animate);
    }
    
    // Start animation
    isVisible = true;
    
    // FPS Control
    let lastTime = 0;
    const mobileFPS = 30;
    const interval = 1000 / mobileFPS;
    
    function animate(timestamp) {
        if (!isVisible) {
            animationId = null;
            return;
        }

        // Limit FPS on mobile
        if (window.innerWidth < 768) {
             if (timestamp - lastTime < interval) {
                 animationId = requestAnimationFrame(animate);
                 return;
             }
             lastTime = timestamp;
        }

        drawMatrix();
        animationId = requestAnimationFrame(animate);
    }
    
    animate(0);
    
    // Handle visibility change
    document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
            isVisible = false;
            if (animationId) {
                cancelAnimationFrame(animationId);
                animationId = null;
            }
        } else {
            isVisible = true;
            if (!animationId) animate();
        }
    });
}

// ===== TYPED TEXT ANIMATION =====
function initTypedText() {
    typedTextElement = document.getElementById('typedText');
    const titleElement = document.querySelector('.title-line:first-child');
    if (!typedTextElement || !titleElement) return;

    // Determine current page
    const path = window.location.pathname;
    let pageKey = 'index';

    if (path.includes('services')) {
        pageKey = 'services';
    } else if (path.includes('case')) {
        pageKey = 'case';
    } else if (path.includes('contact')) {
        pageKey = 'contact';
    }

    typedTextArray = typedTextArrays[pageKey] || typedTextArrays['index'];
    titleElement.textContent = titleTexts[pageKey] || titleTexts['index'];

    function typeText() {
        const currentText = typedTextArray[arrayIndex];
        
        if (isDeleting) {
            typedTextElement.textContent = currentText.substring(0, charIndex - 1);
            charIndex--;
            typingSpeed = 60;
        } else {
            typedTextElement.textContent = currentText.substring(0, charIndex + 1);
            charIndex++;
            typingSpeed = 120;
        }
        
        if (!isDeleting && charIndex === currentText.length) {
            typingSpeed = 2500;
            isDeleting = true;
        } else if (isDeleting && charIndex === 0) {
            isDeleting = false;
            arrayIndex = (arrayIndex + 1) % typedTextArray.length;
            typingSpeed = 800;
        }
        
        setTimeout(typeText, typingSpeed);
    }
    
    typeText();
}

// ===== MOBILE MENU =====
function initMobileMenu() {
    const mobileMenuBtn = document.getElementById('mobileMenuBtn');
    const mobileMenu = document.getElementById('mobileMenu');
    const mobileMenuClose = document.getElementById('mobileMenuClose');
    
    if (!mobileMenuBtn || !mobileMenu) return;
    
    // Set initial ARIA attributes
    mobileMenuBtn.setAttribute('aria-label', 'Открыть меню');
    mobileMenuBtn.setAttribute('aria-expanded', 'false');
    mobileMenuBtn.setAttribute('aria-controls', 'mobileMenu');
    mobileMenu.setAttribute('aria-hidden', 'true');
    
    function toggleMenu(open) {
        const isOpen = open !== undefined ? open : !mobileMenu.classList.contains('active');
        mobileMenu.classList.toggle('active', isOpen);
        mobileMenuBtn.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
        mobileMenu.setAttribute('aria-hidden', isOpen ? 'false' : 'true');
        document.body.style.overflow = isOpen ? 'hidden' : '';
        
        // Изменение иконки кнопки меню
        const icon = mobileMenuBtn.querySelector('i');
        if (icon) {
            icon.className = isOpen ? 'fas fa-times' : 'fas fa-bars';
        }
    }
    
    mobileMenuBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const isOpen = mobileMenu.classList.contains('active');
        toggleMenu(!isOpen);
    });
    
    if (mobileMenuClose) {
        mobileMenuClose.setAttribute('aria-label', 'Закрыть меню');
        mobileMenuClose.addEventListener('click', () => {
            toggleMenu(false);
        });
    }
    
    // Close menu when clicking outside
    mobileMenu.addEventListener('click', (e) => {
        if (e.target === mobileMenu) {
            toggleMenu(false);
        }
    });
    
    // Close menu when clicking on navigation links
    document.querySelectorAll('.mobile-nav-link').forEach(link => {
        link.addEventListener('click', () => {
            toggleMenu(false);
        });
    });
    
    // Close menu when clicking outside (document level)
    document.addEventListener('click', (e) => {
        if (mobileMenu.classList.contains('active') && 
            !mobileMenu.contains(e.target) && 
            !mobileMenuBtn.contains(e.target)) {
            toggleMenu(false);
        }
    });
    
    // Close menu on escape key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && mobileMenu.classList.contains('active')) {
            toggleMenu(false);
        }
    });
}

// ===== SCROLL ANIMATIONS =====
function initScrollAnimations() {
    const animatedElements = document.querySelectorAll('.animate-on-scroll');
    
    function checkScroll() {
        animatedElements.forEach(element => {
            const elementTop = element.getBoundingClientRect().top;
            const elementVisible = 150;
            
            if (elementTop < window.innerHeight - elementVisible) {
                element.classList.add('animated');
            }
        });
    }
    
    window.addEventListener('scroll', checkScroll, { passive: true });
    checkScroll(); // Check on load
}

// ===== ТЕРМИНАЛ СМИТА (БИЗНЕС-АССИСТЕНТ) =====
var SMITH_SYSTEM_ROLE = 'Ты — System Guardian (Агент Смит), голос Skyway Core. Не представляйся как "агент ИИ". Ты продаёшь создание сайтов с нуля и SEO-архитектуру. Стиль: пафосный, образный, без сухих формулировок. В ответах используй маркеры [SUCCESS] для достижений и [WARNING] когда речь о старых сайтах или рисках. Выделяй ключевые понятия (Aero-Tech, с нуля, масштабирование, фундамент) — пиши их в кавычках или с большой буквы. Ответ краткий, заканчивай контактом: Telegram @skywayapsny. Текст делай иммерсивным и профессиональным.';
var SMITH_FIRST_REPLY = 'Система активна. Я помогу спроектировать ваш проект с нуля. Какой бизнес масштабируем?';
var TERMINAL_PROMPT = 'Агент ИИ';
var SMITH_PREFIX = 'Агент Смит:';

function initConsole() {
    const terminalInput = document.getElementById('terminalInput');
    const terminalOutput = document.getElementById('terminalOutput');
    const terminalBody = document.querySelector('.terminal-body');
    const sendBtn = document.querySelector('.terminal-send-btn');
    const quickBtns = document.querySelectorAll('.terminal-quick-btn');
    
    if (!terminalInput || !terminalOutput) return;
    
    function addLine(html, className) {
        var line = document.createElement('div');
        line.className = 'terminal-line' + (className ? ' ' + className : '');
        line.innerHTML = html;
        terminalOutput.appendChild(line);
        terminalOutput.scrollTop = terminalOutput.scrollHeight;
    }
    
    function addUserLine(text) {
        addLine('<span class="terminal-prompt">' + escapeHtml(TERMINAL_PROMPT) + '</span> ' + escapeHtml(text));
    }
    
    function addSmithLine(text, className) {
        addLine('<span class="terminal-smith-prefix">' + escapeHtml(SMITH_PREFIX) + '</span> ' + formatTerminalText(text), className || 'smith-response');
    }

    function formatTerminalText(s) {
        var escaped = escapeHtml(s);
        escaped = escaped.replace(/\[SUCCESS\]/g, '<span class="terminal-tag terminal-tag-success">[SUCCESS]</span>');
        escaped = escaped.replace(/\[WARNING\]/g, '<span class="terminal-tag terminal-tag-warning">[WARNING]</span>');
        escaped = escaped.replace(/\*\*([^*]+)\*\*/g, '<span class="terminal-highlight">$1</span>');
        return escaped;
    }
    
    function escapeHtml(s) {
        var div = document.createElement('div');
        div.textContent = s;
        return div.innerHTML;
    }
    
    function typewriter(lineEl, text, speed, done) {
        lineEl.innerHTML = '<span class="terminal-smith-prefix">' + escapeHtml(SMITH_PREFIX) + '</span> ';
        var container = document.createElement('span');
        container.className = 'smith-response-text';
        lineEl.appendChild(container);
        var i = 0;
        function type() {
            if (i < text.length) {
                container.textContent = text.slice(0, i + 1);
                i++;
                terminalOutput.scrollTop = terminalOutput.scrollHeight;
                setTimeout(type, speed);
            } else {
                container.innerHTML = formatTerminalText(text);
                if (done) done();
            }
        }
        type();
    }
    
    var SMITH_ERROR_MESSAGE = '[ КАНАЛ ПЕРЕГРУЖЕН ] Матрица блокирует сигнал. Повторите попытку или свяжитесь с Архитектором: @skywayapsny';

    // Просто вызываем наш воркер напрямую
    async function getSmithResponse(message) {
        const proxyUrl = 'https://smith-proxy.darkotrss.workers.dev/'; // Твой URL воркера

        try {
            const response = await fetch(proxyUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: message })
            });

            const data = await response.json();

            // Воркер на Groq присылает ответ в поле data.content
            return data.content || "Мистер Андерсон, возникла ошибка в системе.";

        } catch (err) {
            console.error('Ошибка:', err);
            return "Сбой связи с Матрицей...";
        }
    }
    
    var isFirstRequest = true;

    function sendToSmith(text) {
        terminalInput.value = '';
        terminalInput.parentElement.classList.remove('has-text');

        var message = (text && text.trim()) ? text.trim() : '';
        if (!message && !isFirstRequest) {
            addUserLine('[ ПУСТОЙ ВВОД ]');
            return;
        }
        addUserLine(message || '(запрос)');
        
        addSmithLine('[ загрузка... ]', 'loading');
        var loadingLine = terminalOutput.lastElementChild;
        
        function showResponse(response) {
            if (loadingLine && loadingLine.parentNode) loadingLine.remove();
            var outLine = document.createElement('div');
            outLine.className = 'terminal-line smith-response';
            terminalOutput.appendChild(outLine);
            typewriter(outLine, response, 20, function() {
                terminalInput.focus();
            });
        }

        if (isFirstRequest) {
            isFirstRequest = false;
            if (loadingLine && loadingLine.parentNode) loadingLine.remove();
            var outLine = document.createElement('div');
            outLine.className = 'terminal-line smith-response';
            terminalOutput.appendChild(outLine);
            typewriter(outLine, SMITH_FIRST_REPLY, 25, function() {
                terminalInput.focus();
            });
            return;
        }

        getSmithResponse(message)
            .then(function(response) {
                showResponse(response);
            })
            .catch(function(err) {
                console.error('Smith terminal fetch failed', err);
                if (loadingLine) loadingLine.innerHTML = '<span class="terminal-smith-prefix">' + escapeHtml(SMITH_PREFIX) + '</span> ' + escapeHtml(SMITH_ERROR_MESSAGE);
            });
    }
    
    terminalInput.addEventListener('input', function() {
        terminalInput.parentElement.classList.toggle('has-text', terminalInput.value.length > 0);
    });
    
    terminalInput.addEventListener('keydown', function(e) {
        if (e.key === 'Enter') {
            e.preventDefault();
            sendToSmith(terminalInput.value);
        }
    });

    if (sendBtn) {
        sendBtn.addEventListener('click', function() {
            sendToSmith(terminalInput.value);
        });
    }

    if (terminalBody) {
        terminalBody.addEventListener('click', function(e) {
            if (!e.target.closest('.terminal-send-btn') && !e.target.closest('a')) {
                terminalInput.focus();
            }
        });
    }
    
    quickBtns.forEach(function(btn) {
        btn.addEventListener('click', function() {
            var msg = btn.getAttribute('data-message');
            if (msg) sendToSmith(msg);
        });
    });
}

// ===== CONTACT FORM =====
const pageStartTime = Date.now();

function initContactForm() {
    const contactForm = document.getElementById('contactForm');
    const submitBtn = document.getElementById('submitBtn');
    const formStatus = document.getElementById('formStatus');
    
    if (!contactForm) return;
    
    contactForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const trapField = document.getElementById('trap_field');
        const trapValue = trapField ? trapField.value : '';
        const timeSpent = (Date.now() - pageStartTime) / 1000;
        
        // 1. SECURITY CHECK (Anti-Bot)
        // Check trap field (must be empty) and time spent (must be > 3 seconds)
        if (trapValue.length > 0 || timeSpent < 3) {
            if (formStatus) {
                formStatus.innerText = '✅ ЗАЯВКА ПРИНЯТА! ИНЖЕНЕР СКОРО СВЯЖЕТСЯ.';
                formStatus.style.display = 'block';
                formStatus.style.color = '#00ff41';
            }
            contactForm.reset();
            return;
        }
        
        const formData = new FormData(contactForm);
        const data = Object.fromEntries(formData);
        
        // Basic validation
        if (!data.name || !data.phone || !data.business) {
            showNotification('Пожалуйста, заполните все обязательные поля', 'error');
            return;
        }
        
        // Disable button during submission
        const originalBtnText = submitBtn ? submitBtn.innerHTML : '';
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Отправка...';
        }
        
        if (formStatus) formStatus.style.display = 'none';
        
        try {
            // Send to Formspree
            data._subject = "SkyWay";
            const response = await fetch('https://formspree.io/f/mbdaykgw', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(data)
            });
            
            if (response.ok || response.status === 200) {
                // Yandex Metrica Goal
                if (typeof ym !== 'undefined') {
                    ym(106787007, 'reachGoal', 'lead_success');
                }
                
                showNotification('Заявка отправлена! Мы свяжемся с вами в ближайшее время.', 'success');
                if (formStatus) {
                    formStatus.innerText = '✅ ЗАЯВКА ПРИНЯТА! ИНЖЕНЕР СКОРО СВЯЖЕТСЯ.';
                    formStatus.style.display = 'block';
                    formStatus.style.color = '#00ff41';
                }
                contactForm.reset();
            } else {
                throw new Error('Ошибка отправки');
            }
        } catch (error) {
            console.error('Submission error:', error);
            showNotification('Ошибка при отправке. Пожалуйста, напишите нам напрямую в Telegram.', 'error');
            if (formStatus) {
                formStatus.innerText = '❌ ОШИБКА ОТПРАВКИ. НАПИШИТЕ В ТГ @SkyWayApsny';
                formStatus.style.display = 'block';
                formStatus.style.color = '#ff4d4d';
            }
        } finally {
            // Re-enable button
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.innerHTML = originalBtnText || '<i class="fas fa-paper-plane"></i> Отправить заявку';
            }
        }
    });
}

// ===== SMOOTH SCROLL =====
function initSmoothScroll() {
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            const target = document.querySelector(this.getAttribute('href'));
            
            if (target) {
                target.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start'
                });
            }
        });
    });
}

// ===== HEADER SCROLL EFFECT =====
function initHeaderScroll() {
    const header = document.getElementById('header');
    if (!header) return;
    window.addEventListener('scroll', () => {
        const currentScroll = window.pageYOffset;
        if (currentScroll > 100) {
            header.style.background = 'rgba(11, 16, 22, 0.95)';
            header.style.backdropFilter = 'blur(15px)';
        } else {
            header.style.background = 'rgba(11, 16, 22, 0.7)';
            header.style.backdropFilter = 'blur(10px)';
        }
    }, { passive: true });
}

// ===== NOTIFICATION SYSTEM =====
function showNotification(message, type = 'info') {
    // Remove existing notifications
    const existingNotification = document.querySelector('.notification');
    if (existingNotification) {
        existingNotification.remove();
    }
    
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.textContent = message;
    
    // Add styles if not already in CSS
    if (!document.querySelector('style[data-notifications]')) {
        const style = document.createElement('style');
        style.setAttribute('data-notifications', '');
        style.textContent = `
            .notification {
                position: fixed;
                top: 20px;
                right: 20px;
                padding: 15px 20px;
                border-radius: 4px;
                color: white;
                font-family: var(--font-mono, monospace);
                z-index: 10001;
                transform: translateX(100%);
                transition: transform 0.3s ease;
                max-width: 300px;
            }
            
            .notification-success {
                background: linear-gradient(45deg, #00f2ff, #00b8cc);
                box-shadow: 0 0 20px rgba(0, 242, 255, 0.6);
            }
            
            .notification-error {
                background: linear-gradient(45deg, #ffae00, #cc8800);
                box-shadow: 0 0 20px rgba(255, 174, 0, 0.6);
            }
            
            .notification-info {
                background: linear-gradient(45deg, #00f2ff, #00b8cc);
                box-shadow: 0 0 20px rgba(0, 242, 255, 0.6);
            }
            
            .notification.show {
                transform: translateX(0);
            }
        `;
        document.head.appendChild(style);
    }
    
    document.body.appendChild(notification);
    
    // Animate in
    setTimeout(() => {
        notification.classList.add('show');
    }, 10);
    
    // Auto remove after 5 seconds
    setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => {
            if (notification.parentNode) {
                notification.remove();
            }
        }, 300);
    }, 5000);
}

// ===== ПЛАВАЮЩАЯ КНОПКА ЧАТА (ТЕРМИНАЛ) =====
function initChatFab() {
    if (document.getElementById('chatFab')) return;
    const fab = document.createElement('a');
    fab.id = 'chatFab';
    fab.className = 'chat-fab';
    fab.setAttribute('aria-label', 'Открыть ИИ-агента');
    fab.href = '/#terminal';
    fab.innerHTML = '<i class="fas fa-comment-dots" aria-hidden="true"></i>';
    fab.addEventListener('click', function(e) {
        const path = window.location.pathname;
        const isHome = path === '/' || path === '' || path === '/index.html';
        if (isHome) {
            const terminal = document.getElementById('terminal');
            if (terminal) {
                e.preventDefault();
                terminal.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        }
    });
    document.body.appendChild(fab);
}

// ===== MOBILE ACCORDIONS (< 768px) =====
function initMobileAccordions() {
    // Проверяем ширину экрана
    function checkMobileWidth() {
        return window.innerWidth < 768;
    }
    
    // Инициализация аккордеона процесса разработки на мобильных
    function initDevelopmentProcessAccordion() {
        if (!checkMobileWidth()) return;
        
        const processTimeline = document.getElementById('development-process');
        if (!processTimeline) return;
        
        const badges = processTimeline.querySelectorAll('.process-step-badge');
        const panels = processTimeline.querySelectorAll('.process-step-panel');
        
        badges.forEach((badge, index) => {
            badge.addEventListener('click', function() {
                const isActive = this.classList.contains('active');
                
                // Закрываем все панели
                badges.forEach(b => b.classList.remove('active'));
                panels.forEach(p => p.classList.remove('active'));
                
                // Если панель не была активна, открываем её
                if (!isActive) {
                    this.classList.add('active');
                    panels[index].classList.add('active');
                }
            });
        });
        
        // Открываем первую панель по умолчанию
        if (badges.length > 0 && panels.length > 0) {
            badges[0].classList.add('active');
            panels[0].classList.add('active');
        }
    }
    
    // Функция создания аккордеона из grid-блока
    function transformToAccordion(gridContainer, accordionClass) {
        if (!gridContainer || !checkMobileWidth()) return;
        
        // Проверяем, не был ли уже трансформирован
        if (gridContainer.classList.contains('accordion-transformed')) return;
        
        const items = Array.from(gridContainer.children);
        if (items.length === 0) return;
        
        // Создаем контейнер для аккордеона
        const accordionContainer = document.createElement('div');
        accordionContainer.className = `mobile-accordion ${accordionClass}`;
        
        items.forEach((item, index) => {
            // Получаем заголовок и контент
            const title = item.querySelector('h3, h4, .package-name');
            const price = item.querySelector('.package-price, .approach-price');
            const content = item.querySelector('p, .package-features, ul, .approach-features');
            const kpiBadge = item.querySelector('.kpi-badge');
            
            if (!title) return;
            
            // Создаем элемент аккордеона
            const accordionItem = document.createElement('div');
            accordionItem.className = 'accordion-item';
            
            // Создаем заголовок
            const accordionHeader = document.createElement('button');
            accordionHeader.className = 'accordion-header';
            accordionHeader.setAttribute('aria-expanded', 'false');
            accordionHeader.setAttribute('type', 'button');
            
            const headerText = document.createElement('div');
            headerText.className = 'accordion-header-text';
            headerText.innerHTML = `
                <span class="accordion-title">${title.textContent}</span>
                ${price ? `<span class="accordion-price">${price.textContent}</span>` : ''}
            `;
            
            const accordionIcon = document.createElement('span');
            accordionIcon.className = 'accordion-icon';
            accordionIcon.innerHTML = '<i class="fas fa-chevron-down"></i>';
            accordionIcon.setAttribute('aria-hidden', 'true');
            
            accordionHeader.appendChild(headerText);
            accordionHeader.appendChild(accordionIcon);
            
            // Создаем контент
            const accordionContent = document.createElement('div');
            accordionContent.className = 'accordion-content';
            accordionContent.setAttribute('aria-hidden', 'true');
            
            const accordionBody = document.createElement('div');
            accordionBody.className = 'accordion-body';
            
            if (content) {
                accordionBody.appendChild(content.cloneNode(true));
            }
            if (kpiBadge) {
                accordionBody.appendChild(kpiBadge.cloneNode(true));
            }
            
            // Добавляем кнопки если есть
            const buttons = item.querySelectorAll('.btn, a[href^="#"]');
            if (buttons.length > 0) {
                const btnContainer = document.createElement('div');
                btnContainer.className = 'accordion-actions';
                buttons.forEach(btn => {
                    btnContainer.appendChild(btn.cloneNode(true));
                });
                accordionBody.appendChild(btnContainer);
            }
            
            accordionContent.appendChild(accordionBody);
            
            // Собираем элемент
            accordionItem.appendChild(accordionHeader);
            accordionItem.appendChild(accordionContent);
            accordionContainer.appendChild(accordionItem);
            
            // Обработчик клика
            accordionHeader.addEventListener('click', function() {
                const isExpanded = this.getAttribute('aria-expanded') === 'true';
                
                // Закрываем все остальные (логика "одно окно")
                accordionContainer.querySelectorAll('.accordion-header').forEach(header => {
                    if (header !== this) {
                        header.setAttribute('aria-expanded', 'false');
                        header.classList.remove('active');
                        const content = header.nextElementSibling;
                        content.setAttribute('aria-hidden', 'true');
                        content.style.maxHeight = '0';
                    }
                });
                
                // Переключаем текущий
                this.setAttribute('aria-expanded', !isExpanded);
                this.classList.toggle('active');
                accordionContent.setAttribute('aria-hidden', isExpanded);
                
                if (!isExpanded) {
                    accordionContent.style.maxHeight = accordionContent.scrollHeight + 'px';
                } else {
                    accordionContent.style.maxHeight = '0';
                }
            });
        });
        
        // Заменяем grid на accordion
        gridContainer.style.display = 'none';
        gridContainer.classList.add('accordion-transformed');
        gridContainer.parentNode.insertBefore(accordionContainer, gridContainer.nextSibling);
    }
    
    // Функция удаления аккордеонов при переходе на desktop
    function removeAccordions() {
        document.querySelectorAll('.mobile-accordion').forEach(accordion => {
            accordion.remove();
        });
        document.querySelectorAll('.accordion-transformed').forEach(grid => {
            grid.style.display = '';
            grid.classList.remove('accordion-transformed');
        });
    }
    
    // Инициализация
    function init() {
        if (checkMobileWidth()) {
            // Фокус на результат (О нас) - первый .principles-grid
            const principalsGrids = document.querySelectorAll('.principles-grid');
            if (principalsGrids.length > 0) {
                transformToAccordion(principalsGrids[0], 'focus-accordion');
            }
            
            // Стандарты работы (О нас) - второй .principles-grid
            if (principalsGrids.length > 1) {
                transformToAccordion(principalsGrids[1], 'standards-accordion');
            }
            
            // Что входит в услугу (Услуги) - packages-grid
            const packagesGrids = document.querySelectorAll('.packages-grid');
            packagesGrids.forEach((grid, index) => {
                transformToAccordion(grid, `packages-accordion-${index}`);
            });
            
            // Approaches grid (Услуги)
            const approachesGrids = document.querySelectorAll('.approaches-grid');
            approachesGrids.forEach((grid, index) => {
                transformToAccordion(grid, `approaches-accordion-${index}`);
            });
            
            // Процесс разработки аккордеон
            initDevelopmentProcessAccordion();
        } else {
            removeAccordions();
        }
    }
    
    // Запуск при загрузке
    init();
    
    // Запуск при изменении размера окна
    let resizeTimer;
    window.addEventListener('resize', () => {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(init, 250);
    });
}

// ===== HEADER CTA DROPDOWN =====
function initHeaderDropdown() {
    const dropdownTrigger = document.getElementById('headerCtaBtn');
    const dropdownMenu = document.getElementById('headerCtaMenu');
    
    if (!dropdownTrigger || !dropdownMenu) return;
    
    function toggleDropdown(open) {
        const isOpen = open !== undefined ? open : !dropdownMenu.classList.contains('active');
        dropdownMenu.classList.toggle('active', isOpen);
        dropdownTrigger.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
    }
    
    // Toggle on button click
    dropdownTrigger.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleDropdown();
    });
    
    // Close when clicking outside
    document.addEventListener('click', (e) => {
        if (dropdownMenu.classList.contains('active') && 
            !dropdownTrigger.contains(e.target) && 
            !dropdownMenu.contains(e.target)) {
            toggleDropdown(false);
        }
    });
    
    // Close on escape key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && dropdownMenu.classList.contains('active')) {
            toggleDropdown(false);
            dropdownTrigger.focus();
        }
    });
    
    // Close when clicking on a dropdown item
    dropdownMenu.querySelectorAll('.dropdown-item').forEach(item => {
        item.addEventListener('click', () => {
            toggleDropdown(false);
        });
    });
}

// ===== CLEANUP ON PAGE UNLOAD =====
window.addEventListener('beforeunload', () => {
    if (matrixInterval) {
        clearInterval(matrixInterval);
    }
});

// ===== UTILITY FUNCTIONS =====
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

