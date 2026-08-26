// public/js/main.js - Frontend HIDROSYS v3.0
// Comunicación real con API REST + PostgreSQL

const API = window.location.protocol === 'file:' ? 'http://127.0.0.1:3000' : '';

// ============================================================
// TOASTS
// ============================================================
function toast(message, type = 'info', duration = 4000) {
    const container = document.getElementById('toast-container');
    if (!container) return;
    const icons = { success:'✅', warning:'⚠️', error:'❌', info:'ℹ️' };
    const el = document.createElement('div');
    el.className = `toast ${type}`;
    el.innerHTML = `<span class="toast-icon">${icons[type]||'ℹ️'}</span><span style="flex:1">${message}</span><span class="toast-close" onclick="this.parentElement.remove()">✕</span>`;
    container.appendChild(el);
    requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add('show')));
    if (duration > 0) setTimeout(() => { el.classList.remove('show'); setTimeout(() => el.remove(), 400); }, duration);
}

// ============================================================
// UTILIDADES
// ============================================================
function escapeHtml(str) {
    return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}

// ============================================================
// API HELPER
// ============================================================
async function api(method, path, body = null) {
    const opts = {
        method,
        headers: {
            'Content-Type': 'application/json',
            'x-session-token': localStorage.getItem('hs_token') || '',
        },
    };
    if (body) opts.body = JSON.stringify(body);
    const res = await fetch(`${API}/api${path}`, opts);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
    return data;
}

// ============================================================
// INIT
// ============================================================
document.addEventListener('DOMContentLoaded', () => {
    // Hora del chat
    const now = new Date();
    const el = document.getElementById('wa-init-time');
    if (el) el.textContent = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;

    setupNavigation();
    checkDBStatus();
    checkSession();                // ← Verifica sesión (muestra/oculta admin nav)
    navigateTo('dashboard');       // ← Aterriza en inicio público por defecto
    setupBookingForm();
    setupPaymentForm();
    setupSurveyForm();
    setupLeadForm();
    setupWABot();
    setupVoiceInput();
    setupRecorder();
    initDarkMode();                // ← Inicializa modo oscuro desde localStorage

    // Date min
    const dateInput = document.getElementById('bk-date');
    if (dateInput) dateInput.min = new Date().toISOString().split('T')[0];
});

// ============================================================
// DARK MODE TOGGLE
// ============================================================
function initDarkMode() {
    const saved = localStorage.getItem('hs_dark_mode');
    // Si el usuario ya lo tenía activado o prefiere oscuro (sistema), lo activamos
    const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    const isDark = saved === 'dark' || (saved === null && prefersDark);
    if (isDark) {
        applyDark(true);
    } else {
        applyDark(false);
    }
}

function applyDark(enabled) {
    const html   = document.documentElement;
    const icon   = document.getElementById('dm-icon');
    const label  = document.getElementById('dm-label');

    if (enabled) {
        html.setAttribute('data-theme', 'dark');
        if (icon)  icon.textContent  = '🌙';
        if (label) label.textContent = 'Oscuro';
    } else {
        html.removeAttribute('data-theme');
        if (icon)  icon.textContent  = '☀️';
        if (label) label.textContent = 'Claro';
    }
}

window.toggleDarkMode = function () {
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    const newDark = !isDark;
    applyDark(newDark);
    localStorage.setItem('hs_dark_mode', newDark ? 'dark' : 'light');

    // Micro-feedback al usuario
    toast(
        newDark ? '🌙 Modo Oscuro activado' : '☀️ Modo Claro activado',
        'info',
        2500
    );
};

// ============================================================
// NAVEGACIÓN Y PERFILES (Provincia del Cañar)
// ============================================================
const CANAR_GEOGRAPHY = {
    "Azogues": ["Azogues", "Cojitambo", "Guapán", "Javier Loyola", "Luis Cordero", "Pindilig", "Rivera", "San Miguel", "Taday"],
    "Biblián": ["Biblián", "Nazón", "San Francisco de Sageo", "Turupamba"],
    "Cañar": ["Cañar", "General Morales", "Gualleturo", "Honorato Vásquez", "Ingapirca", "Juncal", "San Antonio"],
    "La Troncal": ["La Troncal", "Manuel de J. Calle", "Pancho Negro"],
    "El Tambo": ["El Tambo"],
    "Déleg": ["Déleg", "Solano"],
    "Suscal": ["Suscal"]
};

window.updateParishes = function(cantonVal) {
    const parishSelect = document.getElementById('bk-parish');
    if (!parishSelect) return;
    parishSelect.innerHTML = '<option value="">— Seleccione Parroquia —</option>';
    
    if (!cantonVal || !CANAR_GEOGRAPHY[cantonVal]) {
        return;
    }
    
    CANAR_GEOGRAPHY[cantonVal].forEach(p => {
        const opt = document.createElement('option');
        opt.value = p;
        opt.textContent = p;
        parishSelect.appendChild(opt);
    });
    compileLocation();
};

window.compileLocation = function() {
    const canton = document.getElementById('bk-canton').value;
    const parish = document.getElementById('bk-parish').value;
    const zoneInput = document.getElementById('bk-zone');
    if (zoneInput) {
        zoneInput.value = (canton && parish) ? `${canton} - ${parish}` : '';
    }
};

// ============================================================
// AUTENTICACIÓN Y CONTROL DE ACCESO
// ============================================================

// Mostrar / ocultar contraseña en el campo de login
window.togglePasswordVisibility = function() {
    const input = document.getElementById('login-password');
    if (!input) return;
    input.type = input.type === 'password' ? 'text' : 'password';
};

// Aplica la vista según el rol del usuario autenticado
function applyRole(role, name) {
    const adminNav       = document.getElementById('nav-group-admin');
    const loginBtn       = document.getElementById('login-btn');
    const userBadge      = document.getElementById('user-badge');
    const profileSel     = document.getElementById('profile-select-wrap');
    const sidebarInfo    = document.getElementById('sidebar-user-info');
    const sidebarName    = document.getElementById('sidebar-user-name');

    if (role === 'admin') {
        if (adminNav)    adminNav.style.display = 'block';
        if (loginBtn)    loginBtn.style.display = 'none';
        if (userBadge) {
            userBadge.style.display = 'flex';
            const nameEl = userBadge.querySelector('#user-badge-name');
            if (nameEl) nameEl.textContent = name || 'Admin';
        }
        if (sidebarInfo) sidebarInfo.style.display = 'block';
        if (sidebarName) sidebarName.textContent = name || 'Admin';
        if (profileSel)  profileSel.style.display = 'none';
    } else {
        if (adminNav)    adminNav.style.display = 'none';
        if (loginBtn)    loginBtn.style.display = 'flex';
        if (userBadge)   userBadge.style.display = 'none';
        if (sidebarInfo) sidebarInfo.style.display = 'none';
        if (profileSel)  profileSel.style.display = 'none';
    }
}

// Verificar sesión activa al cargar la página
async function checkSession() {
    const token = localStorage.getItem('hs_token');
    if (!token) { applyRole('public'); return; }
    try {
        const data = await api('GET', '/me');
        applyRole(data.role, data.name);
    } catch {
        // Token inválido o expirado
        localStorage.removeItem('hs_token');
        applyRole('public');
    }
}

// Mostrar modal de login
window.openLoginModal = function() {
    document.getElementById('login-modal-overlay').classList.add('open');
    setTimeout(() => document.getElementById('login-username').focus(), 200);
};

// Cerrar modal de login
window.closeLoginModal = function() {
    document.getElementById('login-modal-overlay').classList.remove('open');
    document.getElementById('login-error').style.display = 'none';
    document.getElementById('login-form').reset();
};

// Cerrar modal al presionar Escape
document.addEventListener('keydown', e => {
    if (e.key === 'Escape') closeLoginModal();
});

// Procesar formulario de login
window.submitLogin = async function(e) {
    e.preventDefault();
    const username = document.getElementById('login-username').value.trim();
    const password = document.getElementById('login-password').value;
    const errorEl  = document.getElementById('login-error');
    const btnEl    = document.getElementById('login-submit-btn');

    btnEl.disabled = true;
    btnEl.textContent = 'Verificando...';
    errorEl.style.display = 'none';

    try {
        const data = await fetch(`${API}/api/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password }),
        }).then(r => r.json());

        if (data.error) throw new Error(data.error);

        localStorage.setItem('hs_token', data.token);
        closeLoginModal();
        applyRole(data.role, data.name);
        navigateTo('admin-dashboard');
        toast(`✅ ¡Bienvenido, ${data.name}!`, 'success');
    } catch (err) {
        errorEl.textContent = err.message || 'Error al iniciar sesión.';
        errorEl.style.display = 'block';
    } finally {
        btnEl.disabled = false;
        btnEl.textContent = 'Ingresar';
    }
};

// Cerrar sesión
window.logout = async function() {
    try {
        await api('POST', '/logout');
    } catch { /* ignorar */ }
    localStorage.removeItem('hs_token');
    applyRole('public');
    navigateTo('dashboard');
    toast('Sesión cerrada correctamente.', 'info');
};

// Mantener compatibilidad con el selector anterior (ya no se usa visualmente)
window.switchProfile = function(profile) {
    const adminNav = document.getElementById('nav-group-admin');
    if (profile === 'admin') {
        if (adminNav) adminNav.style.display = 'block';
        navigateTo('admin-dashboard');
    } else {
        if (adminNav) adminNav.style.display = 'none';
        navigateTo('dashboard');
    }
};

const PAGE_TITLES = {
    'dashboard':           ['Inicio', 'Sistemas y Soluciones de Agua Potable y Gas'],
    'admin-dashboard':     ['Métricas del Negocio', 'Resumen de facturación, citas y clientes'],
    'booking':             ['Agendar Visita', 'Registre una nueva cita técnica'],
    'payments':            ['Reportar Pago', 'Reporte su transferencia bancaria'],
    'survey':              ['Calificar Servicio', 'Evalúe el desempeño del técnico'],
    'leads':               ['Proyectos Grandes', 'Cotizaciones para constructoras'],
    'catalog':             ['Catálogo de Productos', 'Equipos y materiales hidráulicos'],
    'admin-appointments':  ['Gestión de Citas', 'Panel del administrador'],
    'admin-technicians':   ['Gestión de Técnicos', 'Configuración de técnicos, cobertura y WhatsApp oficial'],
    'admin-clients':       ['Clientes Activos', 'Base de datos de clientes'],
    'admin-leads':         ['Prospectos', 'Solicitudes de proyectos'],
    'admin-surveys':       ['Satisfacción', 'Encuestas de calidad del servicio'],
    'admin-wa':            ['Vincular WhatsApp / QR', 'Sincronización corporativa en vivo (+593968245633)'],
};

function navigateTo(pageId) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));

    const page = document.getElementById(`page-${pageId}`);
    if (page) page.classList.add('active');

    const navBtn = document.querySelector(`.nav-item[data-page="${pageId}"]`);
    if (navBtn) navBtn.classList.add('active');

    const titles = PAGE_TITLES[pageId] || ['HIDROSYS', ''];
    document.getElementById('topbar-title').textContent = titles[0];
    document.getElementById('topbar-sub').textContent   = titles[1];

    // Cargar datos según la página
    const loaders = {
        'book':               () => { resetCedulaLookup(); wzGo(1); },
        'admin-dashboard':    loadDashboard,
        'catalog':            loadProducts,
        'admin-appointments': loadAppointments,
        'admin-technicians':  loadAdminTechnicians,
        'admin-clients':      loadClients,
        'admin-leads':        loadLeads,
        'admin-surveys':      loadSurveys,
        'admin-wa':           loadAdminWAStatus,
        'payments':           loadPaymentDropdown,
        'survey':             loadSurveyDropdown,
    };
    if (loaders[pageId]) loaders[pageId]();
}

function setupNavigation() {
    document.querySelectorAll('.nav-item[data-page]').forEach(btn => {
        btn.addEventListener('click', () => {
            navigateTo(btn.dataset.page);
            document.querySelector('.sidebar')?.classList.remove('open');
        });
    });

    // Hamburguesa en móviles
    const toggleBtn = document.getElementById('sidebar-toggle');
    const sidebar = document.querySelector('.sidebar');
    if (toggleBtn && sidebar) {
        toggleBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            sidebar.classList.toggle('open');
        });
        
        // Cerrar al hacer clic fuera del sidebar
        document.addEventListener('click', (e) => {
            if (!sidebar.contains(e.target) && e.target !== toggleBtn) {
                sidebar.classList.remove('open');
            }
        });
    }
}

// ============================================================
// SALUD DE LA DB
// ============================================================
async function checkDBStatus() {
    const badge = document.getElementById('db-status-badge');
    try {
        const data = await api('GET', '/health');
        badge.innerHTML = `<div class="db-dot"></div><span>PostgreSQL · ${data.pg_version}</span>`;
        badge.className = 'db-status';
    } catch {
        badge.innerHTML = `<div class="db-dot"></div><span>DB Sin conexión</span>`;
        badge.className = 'db-status error';
        toast('⚠️ No se puede conectar a PostgreSQL. Verifica el servidor.', 'warning', 8000);
    }
}

// ============================================================
// ============================================================
// DASHBOARD
// ============================================================
async function loadDashboard() {
    try {
        const stats = await api('GET', '/stats');

        const elTotal = document.getElementById('stat-total');
        if (elTotal) elTotal.textContent = stats.totalCitas;
        const elPending = document.getElementById('stat-pending');
        if (elPending) elPending.textContent = stats.citasPendientes;
        const elConfirmed = document.getElementById('stat-confirmed');
        if (elConfirmed) elConfirmed.textContent = stats.citasConfirmadas;
        const elRevenue = document.getElementById('stat-revenue');
        if (elRevenue) elRevenue.textContent = `$${stats.ingresosMes.toFixed(2)}`;
        const elClients = document.getElementById('stat-clients');
        if (elClients) elClients.textContent = stats.totalClientes;
        const elLeads = document.getElementById('stat-leads');
        if (elLeads) elLeads.textContent = stats.leadsNuevos;

        // Badge en sidebar
        const leadsB = document.getElementById('leads-badge');
        if (leadsB) { leadsB.textContent = stats.leadsNuevos; leadsB.style.display = stats.leadsNuevos > 0 ? 'inline' : 'none'; }

        // Gráfico de zonas
        const zonesEl = document.getElementById('zones-chart');
        if (zonesEl && stats.citasPorZona) {
            const max = Math.max(...stats.citasPorZona.map(z => z.count), 1);
            zonesEl.innerHTML = stats.citasPorZona.map(z => `
                <div>
                    <div style="display:flex;justify-content:space-between;font-size:0.8rem;margin-bottom:3px;">
                        <span style="font-weight:600;">${z.zone || 'Sin zona'}</span>
                        <span style="color:var(--gray-500);">${z.count} cita${z.count != 1 ? 's' : ''}</span>
                    </div>
                    <div style="background:var(--gray-100);border-radius:4px;height:8px;overflow:hidden;">
                        <div style="width:${(z.count/max*100)}%;background:linear-gradient(90deg,var(--blue-600),var(--blue-400));height:100%;border-radius:4px;transition:width 0.8s ease;"></div>
                    </div>
                </div>
            `).join('') || '<p style="color:var(--gray-400);font-size:0.875rem;">Sin datos de zonas.</p>';
        }

        // Últimas citas
        const apts = await api('GET', '/appointments?limit=5');
        const tbody = document.getElementById('recent-apts-body');
        if (tbody) {
            tbody.innerHTML = apts.length ? apts.map(a => `
                <tr>
                    <td><strong>${a.client_name}</strong><br><small style="color:var(--gray-400);">${a.client_phone}</small></td>
                    <td>${a.service_type?.replace(/^[^\s]+ /,'') || a.service_type}</td>
                    <td>${formatDate(a.apt_date)}</td>
                    <td>${statusBadge(a.status)}</td>
                </tr>
            `).join('') : '<tr class="empty-row"><td colspan="4">Sin citas registradas.</td></tr>';
        }
    } catch (err) {
        console.warn('Dashboard notice:', err.message);
    }
}

// ============================================================
// CANAL SELECTOR (Formulario vs WhatsApp)
// ============================================================
function selectChannel(ch) {
    const formCard = document.getElementById('ch-form-card');
    const waCard   = document.getElementById('ch-wa-card');
    const formSec  = document.getElementById('booking-form-section');
    const waSec    = document.getElementById('booking-wa-section');

    if (ch === 'form') {
        formCard.className = 'channel-card active-form';
        waCard.className   = 'channel-card';
        formSec.style.display = 'block';
        waSec.style.display   = 'none';
    } else {
        waCard.className   = 'channel-card active-whatsapp';
        formCard.className = 'channel-card';
        waSec.style.display   = 'block';
        formSec.style.display = 'none';
    }
}

// ============================================================
// WIZARD DE PASOS
// ============================================================
let wzCurrentStep = 1;

function wzNext(from) {
    if (!wzValidate(from)) return;
    if (from === 3) buildSummary();
    wzGo(from + 1);
}
function wzBack(from) { wzGo(from - 1); }

function wzGo(step) {
    document.querySelectorAll('.wz-step').forEach(el => {
        const s = parseInt(el.dataset.wz);
        el.classList.remove('active', 'done');
        if (s < step) el.classList.add('done');
        else if (s === step) el.classList.add('active');
    });
    document.querySelectorAll('.wz-panel').forEach(p => p.classList.remove('active'));
    document.getElementById(`wz-${step}`)?.classList.add('active');
    wzCurrentStep = step;
    // BUG FIX 2: Reinforce date minimum every time step 3 is shown
    if (step === 3) {
        const dateInput = document.getElementById('bk-date');
        if (dateInput) {
            const today = new Date().toISOString().split('T')[0];
            dateInput.min = today;
            if (dateInput.value && dateInput.value < today) dateInput.value = '';
        }
    }
}

function wzValidate(step) {
    if (step === 1) {
        if (!document.getElementById('bk-name').value.trim()) { toast('Ingrese su nombre completo.', 'warning'); return false; }
        if (!document.getElementById('bk-phone').value.trim()) { toast('Ingrese su número de celular.', 'warning'); return false; }
        if (!document.getElementById('bk-address').value.trim()) { toast('Ingrese su dirección.', 'warning'); return false; }
    }
    if (step === 2) {
        if (!document.getElementById('bk-zone').value) { toast('Seleccione una zona geográfica.', 'warning'); return false; }
        if (!document.getElementById('bk-service').value) { toast('Seleccione el tipo de servicio.', 'warning'); return false; }
    }
    if (step === 3) {
        const dateEl = document.getElementById('bk-date');
        if (!dateEl || !dateEl.value) { toast('⚠️ Seleccione la fecha de la cita.', 'warning'); return false; }
        // REQ 2: Rechazar fechas pasadas en la validación
        const today = new Date().toISOString().split('T')[0];
        if (dateEl.value < today) {
            toast('❌ No puedes agendar en una fecha pasada. Selecciona una fecha válida.', 'error', 4000);
            dateEl.value = ''; return false;
        }
    }
    return true;
}

function pickZone(el, zone) {
    document.querySelectorAll('.zone-card').forEach(c => c.classList.remove('selected'));
    el.classList.add('selected');
    document.getElementById('bk-zone').value = zone;
}

function buildSummary() {
    const name    = document.getElementById('bk-name').value;
    const phone   = document.getElementById('bk-phone').value;
    const email   = document.getElementById('bk-email').value;
    const address = document.getElementById('bk-address').value;
    const zone    = document.getElementById('bk-zone').value;
    const service = document.getElementById('bk-service').value;
    const date    = document.getElementById('bk-date').value;
    const time    = document.getElementById('bk-time').value;
    const payment = document.getElementById('bk-payment').value;
    const amount  = payment.includes('Anticipo') ? '$7.50' : '$15.00';

    document.getElementById('booking-summary').innerHTML = `
        <div style="font-family:'Outfit',sans-serif;font-weight:700;color:var(--blue-800);font-size:1rem;margin-bottom:12px;">📋 Resumen de su Solicitud</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px 20px;font-size:0.875rem;">
            <div><span style="color:var(--gray-500);">Nombre:</span> <strong>${name}</strong></div>
            <div><span style="color:var(--gray-500);">Teléfono:</span> <strong>${phone}</strong></div>
            ${email ? `<div><span style="color:var(--gray-500);">Correo:</span> ${email}</div>` : ''}
            <div class="col-2"><span style="color:var(--gray-500);">Dirección:</span> ${address}</div>
            <div><span style="color:var(--gray-500);">Zona:</span> <strong>${zone}</strong></div>
            <div><span style="color:var(--gray-500);">Servicio:</span> <strong>${service}</strong></div>
            <div><span style="color:var(--gray-500);">Fecha:</span> <strong>${formatDate(date)}</strong></div>
            <div><span style="color:var(--gray-500);">Hora:</span> <strong>${time}</strong></div>
            <div class="col-2" style="background:var(--blue-100);padding:10px;border-radius:6px;margin-top:4px;">
                💳 <strong>Pago:</strong> ${payment} — <strong style="color:var(--green);font-size:1.05rem;">${amount}</strong>
            </div>
        </div>
    `;
}

function setupBookingForm() {
    const form = document.getElementById('booking-form');
    if (!form) return;
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = form.querySelector('[type="submit"]');
        btn.disabled = true; btn.textContent = '⏳ Guardando...';
        try {
            let uploadedAudioUrl = null;
            if (globalAudioBlob) {
                try {
                    const base64Audio = await new Promise((resolve) => {
                        const reader = new FileReader();
                        reader.onloadend = () => resolve(reader.result);
                        reader.readAsDataURL(globalAudioBlob);
                    });
                    const uploadRes = await api('POST', '/upload-audio', { audioBase64: base64Audio });
                    if (uploadRes && uploadRes.url) {
                        uploadedAudioUrl = uploadRes.url;
                    }
                } catch (audioErr) {
                    console.warn('Nota de voz no subida:', audioErr.message);
                }
            }

            const data = {
                clientName:  document.getElementById('bk-name').value.trim(),
                clientPhone: document.getElementById('bk-phone').value.trim(),
                clientEmail: document.getElementById('bk-email').value.trim(),
                address:     document.getElementById('bk-address').value.trim(),
                zone:        document.getElementById('bk-zone').value,
                serviceType: document.getElementById('bk-service').value,
                aptDate:     document.getElementById('bk-date').value,
                aptTime:     document.getElementById('bk-time').value,
                paymentMode: document.getElementById('bk-payment').value,
                notes:       document.getElementById('bk-notes').value.trim(),
                channel:     'Formulario',
                audioUrl:    uploadedAudioUrl,
                cedula:      currentCedulaLookup || document.getElementById('bk-cedula-input')?.value.trim() || null
            };

            const cleanPhone = data.clientPhone.replace(/\D/g, '');
            if (!/^09\d{8}$/.test(cleanPhone) && !/^5939\d{8}$/.test(cleanPhone) && cleanPhone.length !== 10) {
                toast('⚠️ El número de celular debe contener 10 dígitos numéricos (ej. 0987654321).', 'warning');
                btn.disabled = false; btn.textContent = '✅ Confirmar y Registrar Cita';
                return;
            }
            if (data.clientName.length < 3) {
                toast('⚠️ Por favor ingrese su nombre y apellido completo (mínimo 3 letras).', 'warning');
                btn.disabled = false; btn.textContent = '✅ Confirmar y Registrar Cita';
                return;
            }
            if (data.clientEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.clientEmail)) {
                toast('⚠️ Por favor ingrese un correo electrónico válido (ej. usuario@correo.com).', 'warning');
                btn.disabled = false; btn.textContent = '✅ Confirmar y Registrar Cita';
                return;
            }
            const bankList = `*Cuentas Oficiales para Transferencia (HIDROSYS EC):*
1. *B. Pichincha* (Cte): 2201948332
2. *B. Guayaquil* (Aho): 10482938
3. *Produbanco* (Cte): 0209384729
4. *B. Pacífico* (Aho): 72938472
5. *Coop. JEP* (Aho): 829384201
6. *Coop. MEGO* (Aho): 938482932
7. *Alianza del Valle* (Aho): 384729221
8. *B. Bolivariano* (Cte): 048293847`;

            const created = await api('POST', '/appointments', data);
            toast(`✅ ¡Cita pre-agendada en la base de datos! ID: ${created.id}`, 'success', 5000);
            
            try {
                sendWAMsg('system', `*HIDROSYS – Cita Registrada (Pre-agendada)* 💧\n\nHola *${data.clientName}*, tu cita quedó pre-agendada para el *${formatDate(data.aptDate)}* a las *${data.aptTime}* (${data.zone}).\n\n⚠️ *IMPORTANTE:* Tu turno está *Pre-agendado* y solo se confirmará una vez que realices la transferencia por el valor de tu servicio y reportes tu comprobante.\n\n${bankList}\n\n*Titular:* HIDROSYS EC. (RUC: 1793000000001)\n\nUna vez reportado, procederemos a asignarte un técnico y confirmar tu turno.`);
            } catch (e) {
                console.warn('Aviso WA UI:', e.message);
            }
            
            form.reset();
            resetCedulaLookup();
            discardAudio();
            const bkCanton = document.getElementById('bk-canton');
            if (bkCanton) bkCanton.value = '';
            const bkParish = document.getElementById('bk-parish');
            if (bkParish) bkParish.innerHTML = '<option value="">— Seleccione Parroquia —</option>';
            wzGo(1);

            // Continuidad del Flujo Web: Redirección automática a la pestaña "Reportar Pago"
            navigateTo('payments');
            prefillPaymentForApt(created);
            try { loadDashboard(); } catch (e) {}
        } catch (err) {
            toast(`Error al registrar: ${err.message}`, 'error');
        } finally {
            btn.disabled = false; btn.textContent = '✅ Confirmar y Registrar Cita';
        }
    });
}

// ============================================================
// VALIDACIÓN DE CLIENTE POR CÉDULA Y CÓDIGO OTP POR WHATSAPP
// ============================================================
let currentCedulaLookup = null;

async function requestCedulaOtp() {
    const input = document.getElementById('bk-cedula-input');
    const btn = document.getElementById('btn-request-otp');
    const feedback = document.getElementById('cedula-feedback-msg');
    const cedula = input ? input.value.trim() : '';

    if (!cedula || cedula.length < 5) {
        feedback.textContent = '⚠️ Ingrese un número de cédula válido (mínimo 5 dígitos).';
        feedback.style.color = 'var(--red)';
        return;
    }

    try {
        btn.disabled = true;
        btn.innerHTML = '<span>⏳</span> Enviando código...';
        feedback.textContent = 'Consultando registro y enviando código a WhatsApp...';
        feedback.style.color = 'var(--blue-600)';

        // Re-habilitar botón de verificación inmediatamente
        const verifyBtn = document.getElementById('btn-verify-otp');
        if (verifyBtn) {
            verifyBtn.disabled = false;
            verifyBtn.innerHTML = '<span>✅</span> Confirmar Identidad';
        }

        const res = await api('POST', '/clients/lookup-cedula', { cedula });

        if (res.found) {
            currentCedulaLookup = cedula;
            document.getElementById('cedula-step-2').style.display = 'block';
            document.getElementById('cedula-masked-phone-text').innerHTML = `📲 Código enviado al WhatsApp terminado en <strong>${res.maskedPhone}</strong>`;
            feedback.innerHTML = `✅ ¡Cliente reconocido: <strong>${res.clientName}</strong>! Ingrese el código de 4 dígitos enviado a su WhatsApp.`;
            feedback.style.color = 'var(--green)';
            
            const otpInput = document.getElementById('bk-otp-input');
            if (otpInput) {
                otpInput.value = '';
                otpInput.disabled = false;
                setTimeout(() => otpInput.focus(), 150);
            }
            if (verifyBtn) {
                verifyBtn.disabled = false;
                verifyBtn.innerHTML = '<span>✅</span> Confirmar Identidad';
            }
        } else {
            feedback.textContent = 'ℹ️ Esta cédula no registra servicios previos en Hidrosys. Por favor complete los campos abajo como nuevo cliente.';
            feedback.style.color = 'var(--blue-700)';
        }
    } catch (err) {
        feedback.textContent = `❌ Error: ${err.message}`;
        feedback.style.color = 'var(--red)';
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<span>📲</span> Enviar Código a mi WhatsApp';
    }
}

async function verifyCedulaOtp() {
    const otpInput = document.getElementById('bk-otp-input');
    const btn = document.getElementById('btn-verify-otp');
    const feedback = document.getElementById('cedula-feedback-msg');
    const otp = otpInput ? otpInput.value.trim() : '';

    if (!otp || otp.length !== 4) {
        feedback.textContent = '⚠️ Ingrese el código de seguridad de 4 dígitos.';
        feedback.style.color = 'var(--red)';
        if (btn) { btn.disabled = false; btn.innerHTML = '<span>✅</span> Confirmar Identidad'; }
        if (otpInput) otpInput.focus();
        return;
    }

    try {
        if (btn) {
            btn.disabled = true;
            btn.innerHTML = '<span>⏳</span> Verificando...';
        }

        const res = await api('POST', '/clients/verify-otp', { cedula: currentCedulaLookup, otp });

        if (res.success && res.client) {
            const c = res.client;
            document.getElementById('bk-name').value = c.name || '';
            document.getElementById('bk-phone').value = c.phone || '';
            document.getElementById('bk-email').value = c.email || '';
            document.getElementById('bk-address').value = c.address || '';

            // Cantón y Parroquia si viene en zone
            if (c.zone && c.zone.includes('-')) {
                const parts = c.zone.split('-').map(p => p.trim());
                const cantonSelect = document.getElementById('bk-canton');
                if (cantonSelect) {
                    cantonSelect.value = parts[0];
                    updateParishes(parts[0]);
                    const parishSelect = document.getElementById('bk-parish');
                    if (parishSelect) parishSelect.value = parts[1];
                }
            }

            feedback.innerHTML = `🎉 <strong>¡Identidad confirmada con éxito!</strong> Bienvenido/a <strong>${c.name}</strong>. Tus datos han sido autocompletados.`;
            feedback.style.color = 'var(--green)';
            toast(`✅ Bienvenido/a ${c.name}, datos autocompletados.`, 'success');

            if (btn) {
                btn.disabled = false;
                btn.innerHTML = '<span>✅</span> Confirmado';
            }

            // Avanzar automáticamente
            setTimeout(() => wzNext(1), 1200);
        } else {
            feedback.textContent = res.error || 'Código incorrecto. Intente de nuevo.';
            feedback.style.color = 'var(--red)';
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = '<span>✅</span> Confirmar Identidad';
            }
        }
    } catch (err) {
        const msg = err.message || '';
        if (msg.includes('3 intentos') || msg.includes('bloquead') || msg.includes('agotado')) {
            // Usuario bloqueado por superar 3 intentos fallidos
            feedback.innerHTML = `🔒 <strong>Verificación bloqueada:</strong> ${msg} <button type="button" class="btn btn-sm btn-primary" onclick="requestCedulaOtp()" style="margin-left:8px;padding:4px 10px;font-size:0.78rem;font-weight:700;">🔄 Solicitar Nuevo Código</button>`;
            feedback.style.color = 'var(--red)';
            if (btn) {
                btn.disabled = true;
                btn.innerHTML = '<span>🔒</span> Bloqueado';
            }
            if (otpInput) otpInput.value = '';
        } else if (msg.includes('expirado') || msg.includes('No hay código')) {
            feedback.innerHTML = `⏰ <strong>Código expirado o no encontrado:</strong> ${msg} <button type="button" class="btn btn-sm btn-primary" onclick="requestCedulaOtp()" style="margin-left:8px;padding:4px 10px;font-size:0.78rem;font-weight:700;">🔄 Solicitar Nuevo Código</button>`;
            feedback.style.color = 'var(--red)';
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = '<span>✅</span> Confirmar Identidad';
            }
        } else {
            // Intento fallido pero aún quedan intentos (1 o 2)
            feedback.textContent = `❌ ${msg}`;
            feedback.style.color = 'var(--red)';
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = '<span>✅</span> Confirmar Identidad';
            }
            if (otpInput) {
                otpInput.focus();
                otpInput.select();
            }
        }
    }
}

function resetCedulaLookup() {
    currentCedulaLookup = null;
    const step1 = document.getElementById('cedula-step-1');
    if (step1) step1.style.display = 'flex';
    const step2 = document.getElementById('cedula-step-2');
    if (step2) step2.style.display = 'none';
    const input = document.getElementById('bk-cedula-input');
    if (input) input.value = '';
    const otpInput = document.getElementById('bk-otp-input');
    if (otpInput) otpInput.value = '';
    const feedback = document.getElementById('cedula-feedback-msg');
    if (feedback) feedback.textContent = '';
    const reqBtn = document.getElementById('btn-request-otp');
    if (reqBtn) {
        reqBtn.disabled = false;
        reqBtn.innerHTML = '<span>📲</span> Enviar Código a mi WhatsApp';
    }
    const verifyBtn = document.getElementById('btn-verify-otp');
    if (verifyBtn) {
        verifyBtn.disabled = false;
        verifyBtn.innerHTML = '<span>✅</span> Confirmar Identidad';
    }
}


// ============================================================
// GRABADORA DE AUDIO WEB
// ============================================================
let mediaRecorder;
let audioChunks = [];
let globalAudioBlob = null;
let recordingInterval;
let recordingSeconds = 0;

async function toggleRecording() {
    const btn = document.getElementById('btn-record');
    const status = document.getElementById('recording-status');
    const playback = document.getElementById('audio-playback');
    const discardBtn = document.getElementById('btn-discard-audio');

    if (mediaRecorder && mediaRecorder.state === 'recording') {
        // Detener grabación
        mediaRecorder.stop();
        clearInterval(recordingInterval);
        btn.textContent = '🎤 Grabar';
        btn.style.background = 'var(--blue-600)';
        status.textContent = 'Procesando...';
    } else {
        // Iniciar grabación
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            mediaRecorder = new MediaRecorder(stream);
            audioChunks = [];
            
            mediaRecorder.ondataavailable = e => {
                if (e.data.size > 0) audioChunks.push(e.data);
            };
            
            mediaRecorder.onstop = () => {
                globalAudioBlob = new Blob(audioChunks, { type: 'audio/webm' });
                const audioUrl = URL.createObjectURL(globalAudioBlob);
                playback.src = audioUrl;
                playback.style.display = 'block';
                discardBtn.style.display = 'inline-block';
                status.textContent = 'Audio guardado';
                btn.style.display = 'none'; // Ocultar botón de grabar
                
                // Detener todas las pistas para apagar el micrófono
                stream.getTracks().forEach(track => track.stop());
            };
            
            mediaRecorder.start();
            btn.textContent = '⏹️ Detener';
            btn.style.background = 'var(--red)';
            
            recordingSeconds = 0;
            status.textContent = '00:00';
            recordingInterval = setInterval(() => {
                recordingSeconds++;
                const m = String(Math.floor(recordingSeconds / 60)).padStart(2, '0');
                const s = String(recordingSeconds % 60).padStart(2, '0');
                status.textContent = `${m}:${s} 🔴`;
            }, 1000);
            
        } catch (err) {
            alert('No se pudo acceder al micrófono. Por favor, revisa los permisos.');
        }
    }
}

function discardAudio() {
    globalAudioBlob = null;
    audioChunks = [];
    const pb = document.getElementById('audio-playback');
    if (pb) { pb.style.display = 'none'; pb.src = ''; }
    const btnDisc = document.getElementById('btn-discard-audio');
    if (btnDisc) btnDisc.style.display = 'none';
    const btnRec = document.getElementById('btn-record');
    if (btnRec) {
        btnRec.style.display = 'inline-block';
        btnRec.textContent = '🎤 Grabar';
        btnRec.style.background = 'var(--blue-600)';
    }
    const recStat = document.getElementById('recording-status');
    if (recStat) recStat.textContent = '00:00';
}

// ============================================================
// PAGOS Y CONTINUIDAD DE FLUJO WEB
// ============================================================
window.prefillPaymentForApt = async function(apt) {
    if (!apt) return;
    const sel = document.getElementById('pay-apt-select');
    if (sel && apt.id) {
        sel.innerHTML = `<option value="${apt.id}">Cita #${apt.id} – ${apt.service_type || 'Visita Técnica'} (${formatDate(apt.apt_date)} ${apt.apt_time || ''}) – ${apt.client_name}</option>`;
        sel.value = apt.id;
    }

    const banner = document.getElementById('pay-prefill-banner');
    if (banner) {
        banner.style.display = 'block';
        banner.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:12px;">
                <div>
                    <h4 style="color:var(--blue-900); font-weight:800; margin:0 0 6px 0; font-size:1.05rem; display:flex; align-items:center; gap:6px;">
                        <span>🎉</span> ¡Cita #${apt.id} pre-agendada con éxito!
                    </h4>
                    <p style="font-size:0.85rem; color:var(--blue-800); margin:0; line-height:1.5;">
                        Hola <strong>${apt.client_name}</strong>, tu visita de <strong>${apt.service_type}</strong> para el <strong>${formatDate(apt.apt_date)}</strong> (${apt.zone}) quedó registrada.<br>
                        Para confirmar tu turno, selecciona abajo la entidad bancaria donde realizaste tu transferencia e ingresa el número de comprobante.
                    </p>
                </div>
                <button type="button" onclick="document.getElementById('pay-prefill-banner').style.display='none'" style="background:none; border:none; font-size:1.2rem; cursor:pointer; color:var(--gray-500); padding:2px 6px;" title="Cerrar aviso">✕</button>
            </div>
        `;
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
};

window.lookupPendingPaymentApts = async function() {
    const input = document.getElementById('pay-search-input');
    const feedback = document.getElementById('pay-search-feedback');
    const q = input ? input.value.trim() : '';
    if (!q) {
        if (feedback) { feedback.textContent = '⚠️ Ingrese su número de cédula o celular registrado.'; feedback.style.color = 'var(--red)'; }
        return;
    }

    try {
        if (feedback) { feedback.textContent = '🔍 Buscando citas pendientes de pago...'; feedback.style.color = 'var(--blue-600)'; }
        const apts = await api('GET', `/appointments/pending-payment?q=${encodeURIComponent(q)}`);
        const sel = document.getElementById('pay-apt-select');

        if (apts && apts.length) {
            sel.innerHTML = apts.map(a => `<option value="${a.id}">Cita #${a.id} – ${a.service_type} (${formatDate(a.apt_date)} ${a.apt_time || ''}) – ${a.client_name}</option>`).join('');
            sel.value = apts[0].id;
            if (feedback) {
                feedback.textContent = `✅ ¡Encontrada(s) ${apts.length} cita(s) pendiente(s)! Cita #${apts[0].id} seleccionada abajo para reportar su pago.`;
                feedback.style.color = 'var(--green)';
            }
        } else {
            sel.innerHTML = '<option value="">Sin citas pendientes de pago encontradas</option>';
            if (feedback) {
                feedback.textContent = 'ℹ️ No se encontraron citas pendientes de pago para este número de cédula o teléfono.';
                feedback.style.color = 'var(--blue-800)';
            }
        }
    } catch (err) {
        if (feedback) { feedback.textContent = `❌ Error: ${err.message}`; feedback.style.color = 'var(--red)'; }
    }
};

async function loadPaymentDropdown() {
    const sel = document.getElementById('pay-apt-select');
    if (!sel) return;
    if (sel.options.length <= 1) {
        sel.innerHTML = '<option value="">— Ingrese su Cédula o Celular arriba para cargar su cita —</option>';
    }
}

function setupPaymentForm() {
    loadPaymentDropdown();
    let selectedBank = '';

    document.querySelectorAll('.bank-card').forEach(card => {
        card.addEventListener('click', () => {
            document.querySelectorAll('.bank-card').forEach(c => c.classList.remove('selected'));
            card.classList.add('selected');
            selectedBank = card.dataset.bank;
        });
    });

    const fileInput = document.getElementById('pay-file');
    const uploadArea = document.getElementById('file-upload-area');
    fileInput?.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            uploadArea.classList.add('has-file');
            uploadArea.querySelector('.file-upload-text').innerHTML = `✅ <strong>${file.name}</strong><br><small>${(file.size/1024).toFixed(1)} KB</small>`;
        }
    });

    const form = document.getElementById('payment-form');
    if (!form) return;
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const aptId    = document.getElementById('pay-apt-select').value;
        const receiptNo = document.getElementById('pay-receipt-no').value.trim();
        if (!aptId)      { toast('Selecciona una cita o busca primero con tu cédula/celular.', 'warning'); return; }
        if (!selectedBank) { toast('Selecciona el banco.', 'warning'); return; }
        if (!receiptNo)  { toast('Ingresa el número de transferencia.', 'warning'); return; }

        try {
            // IMPORTANTE: Siempre guardar la imagen como base64 en la DB.
            // Render.com borra los archivos del servidor al reiniciar,
            // así que guardar solo la ruta del archivo causaría que la imagen
            // desaparezca. El base64 persiste en PostgreSQL indefinidamente.
            let uploadedReceiptUrl = '';
            const file = fileInput?.files?.[0];
            if (file) {
                // Validar tamaño máximo (2MB)
                if (file.size > 2 * 1024 * 1024) {
                    toast('⚠️ La imagen es demasiado grande (máx. 2MB). Usa una imagen más pequeña o no la adjuntes.', 'warning', 6000);
                } else {
                    try {
                        // Convertir a base64 y guardar directamente en DB
                        uploadedReceiptUrl = await new Promise((resolve, reject) => {
                            const reader = new FileReader();
                            reader.onload = () => resolve(reader.result);
                            reader.onerror = reject;
                            reader.readAsDataURL(file);
                        });
                    } catch (imgErr) {
                        console.warn('Error leyendo imagen de comprobante:', imgErr.message);
                    }
                }
            }

            await api('PUT', `/appointments/${aptId}`, {
                bank: selectedBank, receiptNo,
                receiptImg: uploadedReceiptUrl || '',
                status: 'Reportado',
                paymentStatus: 'Pendiente de Validación'
            });
            toast('✅ Reporte de pago enviado con éxito. Notificación enviada a tu WhatsApp.', 'success', 6000);
            try {
                sendWAMsg('system', `*HIDROSYS – Pago Reportado desde Web* 📝\nHemos registrado tu transferencia *Nº ${receiptNo}* en *${selectedBank}* para la cita *#${aptId}*.\n\nUn asesor validará y confirmará tu cita en breve.`);
            } catch (e) {}
            form.reset();
            const banner = document.getElementById('pay-prefill-banner');
            if (banner) banner.style.display = 'none';
            uploadArea?.classList.remove('has-file');
            if (uploadArea) uploadArea.querySelector('.file-upload-text').innerHTML = 'Clic para subir imagen<br><small>JPG, PNG, PDF</small>';
            document.querySelectorAll('.bank-card').forEach(c => c.classList.remove('selected'));
            selectedBank = '';
            loadPaymentDropdown();
        } catch (err) {
            toast(`Error: ${err.message}`, 'error');
        }
    });
}

// ============================================================
// ENCUESTAS Y CONSULTA DE CALIFICACIÓN
// ============================================================
window.lookupCompletedSurveys = async function() {
    const input = document.getElementById('survey-search-input');
    const feedback = document.getElementById('survey-search-feedback');
    const q = input ? input.value.trim() : '';
    if (!q) {
        if (feedback) { feedback.textContent = '⚠️ Ingrese su número de cédula o celular registrado.'; feedback.style.color = 'var(--red)'; }
        return;
    }

    try {
        if (feedback) { feedback.textContent = '🔍 Buscando visitas completadas pendientes de calificar...'; feedback.style.color = 'var(--blue-600)'; }
        const apts = await api('GET', `/appointments/pending-survey?q=${encodeURIComponent(q)}`);
        const sel = document.getElementById('survey-apt-select');

        if (apts && apts.length) {
            sel.innerHTML = apts.map(a => `<option value="${a.id}" data-tech="${a.tech_name || 'Técnico Hidrosys'}" data-service="${a.service_type}" data-date="${a.apt_date}">Visita #${a.id} – ${a.service_type} (${formatDate(a.apt_date)}) – Técnico: ${a.tech_name || 'Hidrosys'}</option>`).join('');
            sel.value = apts[0].id;
            sel.dispatchEvent(new Event('change'));
            if (feedback) {
                feedback.textContent = `✅ ¡Encontrada(s) ${apts.length} visita(s) completada(s)! Visita #${apts[0].id} seleccionada abajo.`;
                feedback.style.color = 'var(--green)';
            }
        } else {
            sel.innerHTML = '<option value="">Sin visitas completadas pendientes de calificar</option>';
            const infoEl = document.getElementById('survey-apt-info');
            if (infoEl) infoEl.innerHTML = '';
            if (feedback) {
                feedback.textContent = 'ℹ️ No hay visitas finalizadas pendientes de calificar para esta cédula o teléfono.';
                feedback.style.color = 'var(--blue-800)';
            }
        }
    } catch (err) {
        if (feedback) { feedback.textContent = `❌ Error: ${err.message}`; feedback.style.color = 'var(--red)'; }
    }
};

async function loadSurveyDropdown() {
    const sel = document.getElementById('survey-apt-select');
    if (!sel) return;
    if (sel.options.length <= 1) {
        sel.innerHTML = '<option value="">— Ingrese su Cédula o Celular arriba para cargar su visita finalizada —</option>';
    }
}

function setupSurveyForm() {
    loadSurveyDropdown();
    let selectedRating = 0;
    let recordedSeconds = 0;

    document.getElementById('survey-apt-select')?.addEventListener('change', (e) => {
        const opt = e.target.selectedOptions[0];
        const infoEl = document.getElementById('survey-apt-info');
        if (opt && opt.value && infoEl) {
            infoEl.innerHTML = `
                <div style="background:var(--blue-50);border:1px solid var(--blue-100);border-radius:var(--radius-sm);padding:12px 16px;font-size:0.875rem;">
                    <strong>🔧 ${opt.dataset.service || ''}</strong><br>
                    Técnico: ${opt.dataset.tech || 'N/A'} · Fecha: ${formatDate(opt.dataset.date || '')}
                </div>`;
        } else if (infoEl) infoEl.innerHTML = '';
    });

    document.querySelectorAll('.emoji-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.emoji-btn').forEach(b => b.classList.remove('selected'));
            btn.classList.add('selected');
            selectedRating = parseInt(btn.dataset.rating);
        });
    });

    document.getElementById('view-report-btn')?.addEventListener('click', () => {
        const id = document.getElementById('survey-apt-select').value;
        if (id) showTechReport(id);
        else toast('Selecciona una cita primero.', 'warning');
    });

    const form = document.getElementById('survey-form');
    if (!form) return;
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const aptId = document.getElementById('survey-apt-select').value;
        if (!aptId) { toast('Selecciona una cita.', 'warning'); return; }
        if (!selectedRating) { toast('Selecciona una calificación con los emojis.', 'warning'); return; }
        try {
            await api('POST', '/surveys', {
                appointmentId: parseInt(aptId),
                rating: selectedRating,
                comment: document.getElementById('survey-comment').value.trim(),
                audioDuration: recordedSeconds > 0 ? `00:${String(recordedSeconds).padStart(2,'0')}` : null,
            });
            toast('¡Gracias por tu evaluación! Ha sido registrada.', 'success');
            form.reset();
            document.querySelectorAll('.emoji-btn').forEach(b => b.classList.remove('selected'));
            selectedRating = 0; recordedSeconds = 0;
            loadSurveyDropdown();
        } catch (err) {
            toast(`Error al guardar encuesta: ${err.message}`, 'error');
        }
    });
}

// ============================================================
// LEADS
// ============================================================
function setupLeadForm() {
    const form = document.getElementById('lead-form');
    if (!form) return;
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        try {
            await api('POST', '/leads', {
                name:    document.getElementById('ld-name').value.trim(),
                phone:   document.getElementById('ld-phone').value.trim(),
                email:   document.getElementById('ld-email').value.trim(),
                address: document.getElementById('ld-address').value.trim(),
                details: document.getElementById('ld-details').value.trim(),
            });
            toast('¡Solicitud registrada! Un asesor lo contactará en 24h.', 'success');
            form.reset();
            loadDashboard();
        } catch (err) {
            toast(`Error: ${err.message}`, 'error');
        }
    });
}

// ============================================================
// CATÁLOGO
// ============================================================
async function loadProducts() {
    const container = document.getElementById('catalog-grid');
    if (!container) return;
    const q   = document.getElementById('cat-search')?.value || '';
    const cat = document.getElementById('cat-category')?.value || '';
    try {
        const products = await api('GET', `/products?q=${encodeURIComponent(q)}&category=${encodeURIComponent(cat)}`);
        container.innerHTML = products.length ? products.map(p => `
            <div style="background:white;border:1px solid var(--gray-200);border-radius:var(--radius-md);padding:18px;box-shadow:var(--shadow-xs);transition:var(--transition);"
                 onmouseover="this.style.boxShadow='var(--shadow-md)';this.style.transform='translateY(-2px)'"
                 onmouseout="this.style.boxShadow='var(--shadow-xs)';this.style.transform='translateY(0)'">
                <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px;">
                    <span style="font-size:2rem;">${p.icon}</span>
                    <span class="badge badge-blue">${p.category}</span>
                </div>
                <h4 style="font-family:'Outfit',sans-serif;font-weight:700;font-size:0.95rem;margin-bottom:5px;">${p.name}</h4>
                <p style="font-size:0.78rem;color:var(--gray-500);margin-bottom:8px;line-height:1.4;">${p.description}</p>
                <div style="font-size:0.72rem;background:var(--gray-50);padding:6px 8px;border-radius:5px;border:1px solid var(--gray-100);color:var(--gray-600);margin-bottom:10px;">${p.specs}</div>
                <div style="display:flex;justify-content:space-between;align-items:center;">
                    <span style="font-family:'Outfit',sans-serif;font-weight:800;font-size:1.15rem;color:var(--green);">$${parseFloat(p.price).toFixed(2)}</span>
                    <span style="font-size:0.72rem;color:var(--gray-400);">Stock: ${p.stock}</span>
                </div>
            </div>
        `).join('') : '<div style="grid-column:1/-1;text-align:center;padding:40px;color:var(--gray-400);">No se encontraron productos.</div>';
    } catch (err) {
        toast(`Error al cargar catálogo: ${err.message}`, 'error');
    }
}

// ============================================================
// ADMIN: CITAS
// ============================================================
// Caché de comprobantes: guarda los datos de cada cita por ID para
// evitar pasar base64 gigantes dentro de atributos onclick de HTML
const receiptsCache = new Map();

async function loadAppointments() {
    const container = document.getElementById('apt-cards-container');
    if (!container) return;
    const status = document.getElementById('apt-status-filter')?.value || '';
    const zone   = document.getElementById('apt-zone-filter')?.value || '';
    const q      = document.getElementById('apt-search')?.value || '';
    try {
        const apts = await api('GET', `/appointments?status=${encodeURIComponent(status)}&zone=${encodeURIComponent(zone)}&q=${encodeURIComponent(q)}`);
        apts.sort((a,b) => b.id - a.id);
        const techs = await api('GET', '/technicians');

        if (!apts || apts.length === 0) {
            container.innerHTML = `
                <div style="grid-column:1/-1;">
                    <div style="background:linear-gradient(135deg,#f8fafc,#f1f5f9);border:1px solid #e2e8f0;border-radius:16px;padding:48px 32px;text-align:center;">
                        <div style="font-size:3.5rem;margin-bottom:16px;">📅</div>
                        <h3 style="font-family:'Outfit',sans-serif;font-size:1.4rem;font-weight:800;color:var(--gray-800);margin-bottom:8px;">No hay citas registradas</h3>
                        <p style="color:var(--gray-600);max-width:480px;margin:0 auto 24px;line-height:1.6;font-size:0.9rem;">No se encontraron citas que coincidan con los filtros seleccionados, o aún no hay agendamientos en el sistema.</p>
                        <div style="display:flex;gap:12px;justify-content:center;flex-wrap:wrap;">
                            <button class="btn btn-primary" onclick="navigateTo('booking')">Ir al Agendamiento</button>
                        </div>
                    </div>
                </div>
            `;
        } else {
            // Limpiar caché anterior y rellenar con datos frescos
            receiptsCache.clear();
            apts.forEach(a => {
                if (a.receipt_img || a.bank || a.receipt_no) {
                    receiptsCache.set(a.id, {
                        img: a.receipt_img || '',
                        bank: a.bank || '',
                        receiptNo: a.receipt_no || '',
                        clientName: a.client_name || ''
                    });
                }
            });

            container.innerHTML = apts.map(a => {
                const steps = ['Pre-agendado','Pagado','Confirmado','Conf. Cliente','Terminado'];
                const idx   = steps.findIndex(s => s.toLowerCase().includes(a.status?.toLowerCase().slice(0,6) || ''));
                const tlHtml = steps.map((s,i) => `<div class="tl-step ${i < idx ? 'past' : i === idx ? 'now' : ''}">${s}</div>`).join('');

                const stripeClass = a.status === 'Terminado' ? 'stripe-done' :
                                   (a.status?.includes('Confirmado') ? 'stripe-confirmed' :
                                   (a.receipt_no ? 'stripe-confirmed' : 'stripe-pre'));

                // REQ 3 & REQ 4: Técnicos ordenados por zona y detección de colisiones de horario en tiempo real
                const apZoneBase = (a.zone || '').split(' - ')[0].trim().toLowerCase();
                const aDateStr = a.apt_date ? a.apt_date.split('T')[0] : '';
                const aHourBlock = String(a.apt_time || '').slice(0, 2);

                const sortedTechs = [...techs].sort((t1, t2) => {
                    const in1 = t1.zone && (t1.zone.toLowerCase().includes(apZoneBase) || t1.zone === 'Toda la Provincia') ? 1 : 0;
                    const in2 = t2.zone && (t2.zone.toLowerCase().includes(apZoneBase) || t2.zone === 'Toda la Provincia') ? 1 : 0;
                    return in2 - in1;
                });
                const techOptions = `<option value="">— Asignar técnico —</option>` +
                    sortedTechs.map(t => {
                        const isBusy = (apts || []).some(other => 
                            other.id !== a.id && 
                            other.tech_id === t.id && 
                            other.apt_date && other.apt_date.split('T')[0] === aDateStr &&
                            String(other.apt_time || '').slice(0, 2) === aHourBlock &&
                            ['Confirmado', 'Conf. Cliente', 'Reportado', 'Pre-agendado'].includes(other.status)
                        );
                        const inZone = t.zone && (t.zone.toLowerCase().includes(apZoneBase) || t.zone === 'Toda la Provincia');
                        
                        let label;
                        if (isBusy && a.tech_id != t.id) {
                            label = `🚫 ${t.name} (${t.zone}) – ❌ OCUPADO a las ${String(a.apt_time||'').slice(0,5)}`;
                        } else if (inZone) {
                            label = `📍 ${t.avatar || '👨‍🔧'} ${t.name} (${t.zone})`;
                        } else {
                            label = `⚠️ ${t.name} (${t.zone}) – fuera de zona`;
                        }
                        return `<option value="${t.id}" ${a.tech_id == t.id ? 'selected' : ''}>${label}</option>`;
                    }).join('');

                return `
                    <div class="apt-card" id="apt-card-${a.id}">
                        <div class="apt-card-stripe ${stripeClass}"></div>
                        <div class="apt-card-body">
                            <div class="status-timeline">${tlHtml}</div>
                            <div class="apt-card-top">
                                <div>
                                    ${statusBadge(a.status)}
                                    ${a.survey_completed ? '<span class="badge badge-green" style="margin-left:4px;">Encuesta ✓</span>' : ''}
                                    <div class="apt-service" style="margin-top:5px;">${a.service_type}</div>
                                </div>
                                <div class="apt-price">$${parseFloat(a.payment_amount||0).toFixed(2)}</div>
                            </div>
                            <div class="apt-info">
                                <p>👤 <strong>${a.client_name}</strong> · ${a.client_phone}</p>
                                <p>📍 ${a.address} · <strong style="color:var(--blue-700);">${a.zone}</strong></p>
                                <p>📅 ${formatDate(a.apt_date)} ⏰ ${String(a.apt_time||'').slice(0,5)}</p>
                                ${a.channel === 'WhatsApp' ? '<p>💬 <strong>Canal:</strong> WhatsApp Bot</p>' : ''}
                                ${a.notes ? `<p style="font-style:italic;color:var(--gray-500);">"${a.notes}"</p>` : ''}
                                ${a.receipt_no || a.status === 'Reportado' || a.bank ? `
                                    <div style="background:var(--blue-50,#eff6ff);border:1px solid var(--blue-200,#bfdbfe);border-radius:6px;padding:8px 10px;margin-top:6px;font-size:0.78rem;">
                                        <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:4px;">
                                            <span>🏦 <strong>Banco:</strong> ${a.bank || 'Reportado'} · <strong>Nº Comprobante:</strong> ${a.receipt_no || 'Pendiente de Validar'}</span>
                                            <span class="badge ${payBadgeClass(a.payment_status)}">${a.payment_status || 'Pendiente de Validación'}</span>
                                        </div>
                                        ${a.receipt_img ? `
                                            <div style="margin-top:6px;padding-top:6px;border-top:1px dashed var(--blue-200,#bfdbfe);display:flex;align-items:center;gap:8px;">
                                                <button type="button" class="btn btn-xs btn-outline" onclick="openReceiptModal(${a.id})" style="font-size:0.75rem;padding:3px 10px;border-color:var(--blue-500);color:var(--blue-800);background:#fff;font-weight:700;display:inline-flex;align-items:center;gap:5px;box-shadow:0 1px 3px rgba(0,0,0,0.08);cursor:pointer;border-radius:6px;">
                                                    <span>🖼️</span> Ver Comprobante Adjunto
                                                </button>
                                            </div>
                                        ` : ''}
                                    </div>` : `<p style="font-size:0.78rem;color:var(--gray-400);">Sin reporte de pago.</p>`}
                                ${a.audio_url ? `
                                    <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:6px;padding:6px 10px;margin-top:6px;">
                                        <div style="font-size:0.72rem;font-weight:700;color:#166534;margin-bottom:4px;display:flex;align-items:center;gap:4px;">
                                            <span>🎙️</span> Nota de voz del cliente:
                                        </div>
                                        <audio controls src="${a.audio_url}" style="width:100%;height:30px;"></audio>
                                    </div>
                                ` : ''}
                            </div>
                            <div style="margin-top:12px;">
                                <label style="font-size:0.75rem;font-weight:600;color:var(--gray-500);display:block;margin-bottom:4px;">Técnico Asignado:</label>
                                <select class="form-control" style="font-size:0.82rem;padding:7px 10px;"
                                        onchange="assignTech(${a.id}, this.value)" ${a.status === 'Terminado' ? 'disabled' : ''}>
                                    ${techOptions}
                                </select>
                            </div>
                            <!-- Barra de Acciones Rápidas WhatsApp (1 Clic) -->
                            <div style="margin-top:12px; padding-top:10px; border-top:1px dashed var(--gray-200); display:flex; gap:6px; flex-wrap:wrap; align-items:center;">
                                <span style="font-size:0.72rem; font-weight:700; color:var(--gray-500);">📲 WhatsApp Rápido:</span>
                                <button class="btn btn-xs btn-outline" onclick="sendQuickWAMsg(${a.id}, 'on_the_way')" style="font-size:0.7rem; padding:3px 8px; border-radius:12px;" title="Avisar que el técnico va en camino">🚚 En Camino</button>
                                <button class="btn btn-xs btn-outline" onclick="sendQuickWAMsg(${a.id}, 'reminder')" style="font-size:0.7rem; padding:3px 8px; border-radius:12px;" title="Enviar recordatorio de cita">⏰ Recordatorio</button>
                                <button class="btn btn-xs btn-outline" onclick="sendQuickWAMsg(${a.id}, 'done')" style="font-size:0.7rem; padding:3px 8px; border-radius:12px;" title="Avisar que el trabajo finalizó">🏁 Concluido</button>
                                <button class="btn btn-xs btn-outline" onclick="openQuoterForApt(${a.id})" style="font-size:0.7rem; padding:3px 8px; border-radius:12px; border-color:var(--blue-300); color:var(--blue-700);" title="Crear proforma para esta cita">📄 Proforma</button>
                            </div>
                        </div>
                        <div class="apt-card-footer">
                            ${(a.status === 'Reportado' || (a.receipt_no && a.receipt_no !== 'null' && a.receipt_no !== '')) && a.status !== 'Confirmado' && a.status !== 'Conf. Cliente' && a.status !== 'Terminado' && a.payment_status !== 'Pagado' && a.payment_status !== 'Aprobado' ? `<button class="btn btn-success btn-xs" style="background:#10b981;color:white;font-weight:700;box-shadow:0 2px 4px rgba(16,185,129,0.25);" onclick="approvePayment(${a.id},'${a.tech_id||''}')">✅ Aprobar Pago</button>` : ''}
                            ${a.status !== 'Terminado' ? `<button class="btn btn-ghost btn-xs" onclick="finishApt(${a.id})">🏁 Finalizar</button>` : ''}
                            <button class="btn btn-ghost btn-xs" onclick="showTechReport(${a.id})">📄 Informe</button>
                            <button class="btn btn-xs" style="background:var(--red-bg);color:var(--red);border:none;" onclick="deleteApt(${a.id})">🗑️</button>
                        </div>
                    </div>
                `;
            }).join('');
        }

        // Botón de filtro
        document.getElementById('apt-filter-btn')?.addEventListener('click', loadAppointments);
    } catch (err) {
        toast(`Error al cargar citas: ${err.message}`, 'error');
    }
}

function payBadgeClass(status) {
    if (!status) return 'badge-gray';
    if (status.toLowerCase().includes('pagado')) return 'badge-green';
    if (status.toLowerCase().includes('anticipo')) return 'badge-yellow';
    return 'badge-red';
}

async function assignTech(aptId, techId) {
    try {
        await api('PUT', `/appointments/${aptId}`, { techId: techId ? parseInt(techId) : null });
        if (techId) {
            toast('👷 Técnico asignado y orden de trabajo enviada a su WhatsApp.', 'success', 5000);
        } else {
            toast('Técnico desasignado de la cita.', 'info');
        }
        loadAppointments();
    } catch (err) {
        // REQ 4: Mostrar error de conflicto de horario claramente
        if (err.message && err.message.includes('Conflicto')) {
            toast(err.message, 'error', 8000);
        } else {
            toast(`Error al asignar técnico: ${err.message}`, 'error');
        }
        // Recargar para resetear el select al valor anterior
        setTimeout(() => loadAppointments(), 800);
    }
}

async function approvePayment(aptId, currentTechId) {
    const card = document.getElementById(`apt-card-${aptId}`);
    const techSel = card?.querySelector('select');
    const techId = techSel?.value || currentTechId;
    const finalTechId = techId ? parseInt(techId) : null;

    try {
        await api('PUT', `/appointments/${aptId}`, {
            paymentStatus: 'Pagado', status: 'Confirmado', techId: finalTechId,
        });
        toast('✅ Pago aprobado y cita confirmada exitosamente.', 'success', 4000);
        toast('💬 Notificaciones automáticas enviadas al cliente y al técnico por WhatsApp.', 'success', 6000);
        loadAppointments();
    } catch (err) { toast(`Error: ${err.message}`, 'error'); }
}

async function finishApt(aptId) {
    if (!confirm('¿Marcar esta visita como finalizada?')) return;
    try {
        await api('PUT', `/appointments/${aptId}`, { status: 'Terminado' });
        toast('Visita marcada como finalizada.', 'success');
        
        const isAdmin = document.getElementById('nav-group-admin')?.style.display !== 'none';
        if (!isAdmin) {
            sendWAMsg('system', '🎉 *HIDROSYS – Servicio Completado*\nNuestra visita técnica fue finalizada. ¿Cómo nos calificarías? Ingresa a la plataforma para dejar tu evaluación.');
        }
        loadAppointments();
        loadSurveyDropdown();
    } catch (err) { toast(`Error: ${err.message}`, 'error'); }
}

async function deleteApt(aptId) {
    if (!confirm('¿Eliminar esta cita? Esta acción no se puede deshacer.')) return;
    try {
        await api('DELETE', `/appointments/${aptId}`);
        toast('Cita eliminada.', 'info');
        loadAppointments();
    } catch (err) { toast(`Error: ${err.message}`, 'error'); }
}

// ============================================================
// ADMIN: CLIENTES (CRUD Y GESTIÓN CON CÉDULA)
// ============================================================
let allClientsCache = [];

async function loadClients() {
    const tbody = document.getElementById('clients-tbody');
    if (!tbody) return;
    const q = document.getElementById('cli-search')?.value || '';
    try {
        allClientsCache = await api('GET', `/clients?q=${encodeURIComponent(q)}`);
        tbody.innerHTML = allClientsCache.length ? allClientsCache.map(c => {
            const cleanCedula = c.cedula ? `<span class="badge badge-blue" style="font-family:monospace; font-size:0.8rem;">${c.cedula}</span>` : '<span style="color:var(--gray-400); font-size:0.75rem; font-style:italic;">Sin cédula</span>';
            const cleanPhone = (c.phone || '').replace(/\D/g, '');
            const waLink = cleanPhone ? `https://wa.me/${cleanPhone.startsWith('593') ? cleanPhone : '593' + cleanPhone.replace(/^0/, '')}` : '#';

            return `
                <tr>
                    <td>${cleanCedula}</td>
                    <td>
                        <strong style="color:var(--blue-900); cursor:pointer;" onclick="openClient360(${c.id}, '${c.phone}')" title="Ver ficha técnica 360°">
                            ${c.name}
                        </strong>
                    </td>
                    <td>
                        <div style="display:flex; align-items:center; gap:6px;">
                            <span>${c.phone}</span>
                            ${cleanPhone ? `<a href="${waLink}" target="_blank" class="badge badge-green" style="text-decoration:none; font-size:0.68rem; padding:1px 5px;" title="Chatear por WhatsApp">WA ↗</a>` : ''}
                        </div>
                    </td>
                    <td>${c.email || '<span style="color:var(--gray-400);">—</span>'}</td>
                    <td>${c.address || '<span style="color:var(--gray-400);">—</span>'}</td>
                    <td><strong style="color:var(--blue-700);">${c.zone || '—'}</strong></td>
                    <td style="text-align:center;"><span class="badge badge-blue">${c.total_appointments || 0}</span></td>
                    <td>${c.last_service_date ? formatDate(c.last_service_date) : '<span style="color:var(--gray-400);">—</span>'}</td>
                    <td style="text-align:center;">
                        <div style="display:flex; gap:4px; justify-content:center;">
                            <button class="btn btn-xs btn-outline" onclick="openClientModal(${c.id})" style="font-size:0.75rem; padding:3px 8px;" title="Editar cliente y cédula">✏️ Editar</button>
                            <button class="btn btn-ghost btn-xs" onclick="openClient360(${c.id}, '${c.phone}')" style="font-size:0.75rem; padding:3px 8px; border:1px solid var(--gray-300);" title="Ver historial 360°">🔍 Ficha</button>
                            <button class="btn btn-xs" onclick="deleteClient(${c.id})" style="background:var(--red-bg); color:var(--red); border:none; font-size:0.75rem; padding:3px 6px;" title="Eliminar cliente">🗑️</button>
                        </div>
                    </td>
                </tr>
            `;
        }).join('') : '<tr class="empty-row"><td colspan="9">Sin clientes registrados.</td></tr>';
    } catch (err) { toast(`Error: ${err.message}`, 'error'); }
}

window.openClientModal = function(id = null) {
    const modal = document.getElementById('modal-client');
    if (!modal) return;

    const titleEl = document.getElementById('modal-client-title');
    const idEl = document.getElementById('client-id');
    const cedulaEl = document.getElementById('client-cedula');
    const nameEl = document.getElementById('client-name');
    const phoneEl = document.getElementById('client-phone');
    const emailEl = document.getElementById('client-email');
    const addressEl = document.getElementById('client-address');
    const zoneEl = document.getElementById('client-zone');
    const notesEl = document.getElementById('client-notes');

    if (id) {
        const client = allClientsCache.find(c => c.id == id);
        if (client) {
            titleEl.textContent = `👥 Editar Cliente: ${client.name}`;
            idEl.value = client.id;
            cedulaEl.value = client.cedula || '';
            nameEl.value = client.name || '';
            phoneEl.value = client.phone || '';
            emailEl.value = client.email || '';
            addressEl.value = client.address || '';
            zoneEl.value = client.zone || '';
            notesEl.value = client.notes || '';
        }
    } else {
        titleEl.textContent = '➕ Registrar Nuevo Cliente';
        idEl.value = '';
        cedulaEl.value = '';
        nameEl.value = '';
        phoneEl.value = '';
        emailEl.value = '';
        addressEl.value = '';
        zoneEl.value = 'Azogues';
        notesEl.value = '';
    }

    modal.style.display = 'flex';
};

window.closeClientModal = function() {
    const modal = document.getElementById('modal-client');
    if (modal) modal.style.display = 'none';
};

window.saveClient = async function(e) {
    e.preventDefault();
    const btn = document.getElementById('btn-save-client');
    btn.disabled = true;
    btn.textContent = 'Guardando...';

    const id = document.getElementById('client-id').value;
    const data = {
        cedula:  document.getElementById('client-cedula').value.trim(),
        name:    document.getElementById('client-name').value.trim(),
        phone:   document.getElementById('client-phone').value.trim(),
        email:   document.getElementById('client-email').value.trim(),
        address: document.getElementById('client-address').value.trim(),
        zone:    document.getElementById('client-zone').value.trim(),
        notes:   document.getElementById('client-notes').value.trim(),
    };

    if (data.cedula && !/^\d{10}$/.test(data.cedula)) {
        toast('⚠️ La cédula debe contener exactamente 10 dígitos numéricos.', 'warning');
        btn.disabled = false; btn.textContent = '💾 Guardar Cliente';
        return;
    }
    const cleanPhone = data.phone.replace(/\D/g, '');
    if (!/^09\d{8}$/.test(cleanPhone) && !/^5939\d{8}$/.test(cleanPhone) && cleanPhone.length !== 10) {
        toast('⚠️ El celular WhatsApp debe tener 10 dígitos numéricos (ej. 0987654321).', 'warning');
        btn.disabled = false; btn.textContent = '💾 Guardar Cliente';
        return;
    }

    try {
        if (id) {
            await api('PUT', `/clients/${id}`, data);
            toast('✅ Cliente y cédula actualizados correctamente.', 'success');
        } else {
            await api('POST', '/clients', data);
            toast('✅ Nuevo cliente registrado en el sistema.', 'success');
        }
        closeClientModal();
        await loadClients();
    } catch (err) {
        toast(`Error: ${err.message}`, 'error');
    } finally {
        btn.disabled = false;
        btn.textContent = '💾 Guardar Cliente';
    }
};

window.deleteClient = async function(id) {
    const client = allClientsCache.find(c => c.id == id);
    const name = client ? client.name : 'este cliente';
    if (!confirm(`¿Eliminar a ${name}? Esta acción no se puede deshacer.`)) return;

    try {
        const res = await api('DELETE', `/clients/${id}`);
        toast(res.message || 'Cliente eliminado.', 'info');
        await loadClients();
    } catch (err) {
        toast(`Error: ${err.message}`, 'error');
    }
};

// ============================================================
// ADMIN: LEADS
// ============================================================
window.loadLeads = async function() {
    const container = document.getElementById('leads-cards-container');
    if (!container) return;
    try {
        const leads = await api('GET', '/leads');
        if (!leads || leads.length === 0) {
            container.innerHTML = `
                <div style="grid-column:1/-1;">
                    <div style="background:linear-gradient(135deg,#eff6ff,#dbeafe);border:1px solid #bfdbfe;border-radius:16px;padding:48px 32px;text-align:center;">
                        <div style="font-size:3.5rem;margin-bottom:16px;">🏗️</div>
                        <h3 style="font-family:'Outfit',sans-serif;font-size:1.4rem;font-weight:800;color:var(--blue-800);margin-bottom:8px;">Aún no tienes prospectos</h3>
                        <p style="color:var(--blue-600);max-width:480px;margin:0 auto 24px;line-height:1.6;font-size:0.9rem;">Los prospectos son clientes potenciales, constructoras o proyectos que contactan a Hidrosys mediante el formulario de "Proyectos Grandes". Aquí podrás verlos y convertirlos a clientes con un clic.</p>
                        <div style="display:flex;gap:12px;justify-content:center;flex-wrap:wrap;">
                            <button class="btn btn-primary" onclick="navigateTo('leads')" style="background:var(--blue-700);">Ir al Formulario</button>
                            <button class="btn btn-outline" onclick="seedSampleLead()" style="border-color:var(--blue-300);color:var(--blue-700);">➕ Agregar Datos de Prueba</button>
                        </div>
                    </div>
                </div>
            `;
            return;
        }

        container.innerHTML = leads.map(l => `
            <div class="card">
                <div class="card-header">
                    <span class="card-title">${l.name}</span>
                    ${statusBadge(l.status)}
                </div>
                <div class="card-body" style="font-size:0.875rem;">
                    <p>📧 ${l.email || '—'} · 📞 ${l.phone || '—'}</p>
                    <p style="margin-top:4px;">📍 ${l.address || '—'}</p>
                    <p style="margin:10px 0;font-style:italic;color:var(--gray-500);">"${l.details}"</p>
                    <p style="font-size:0.75rem;color:var(--gray-400);">📅 ${new Date(l.created_at).toLocaleDateString('es-EC')} · Fuente: ${l.source}</p>
                    <div style="margin-top:12px;display:flex;gap:8px;">
                        ${l.status !== 'Convertido' ? `<button class="btn btn-success btn-xs" onclick="convertLead(${l.id})">✅ Convertir a Cliente</button>` : '<span class="badge badge-green">Cliente Activo</span>'}
                    </div>
                </div>
            </div>
        `).join('');
    } catch (err) { toast(`Error: ${err.message}`, 'error'); }
}

window.seedSampleLead = async function() {
    try {
        await api('POST', '/leads', {
            name: 'Constructora Andina S.A. (Demo)',
            phone: '0987654321',
            email: 'proyectos@constructoraandina.ec',
            address: 'Av. España y Guayas, Azogues',
            details: 'Proyecto residencial de 120 viviendas. Necesitamos instalación de acometidas.',
        });
        toast('Prospecto de prueba agregado.', 'success');
        loadLeads();
    } catch (err) { toast(`Error: ${err.message}`, 'error'); }
};

async function convertLead(id) {
    try {
        await api('POST', `/leads/${id}/convert`);
        toast('Prospecto convertido a cliente activo.', 'success');
        loadLeads(); loadClients(); loadDashboard();
    } catch (err) { toast(`Error: ${err.message}`, 'error'); }
}

// ============================================================
// ADMIN: GESTIÓN DE TÉCNICOS (CRUD Y CONFIGURACIÓN)
// ============================================================
let allAdminTechsCache = [];

async function loadAdminTechnicians() {
    const container = document.getElementById('tech-cards-container');
    if (!container) return;
    try {
        allAdminTechsCache = await api('GET', '/technicians?all=true');
        renderAdminTechnicians();
    } catch (err) {
        toast(`Error al cargar técnicos: ${err.message}`, 'error');
    }
}

function renderAdminTechnicians() {
    const container = document.getElementById('tech-cards-container');
    if (!container) return;

    const q = (document.getElementById('tech-search')?.value || '').toLowerCase().trim();
    const zone = document.getElementById('tech-zone-filter')?.value || 'all';
    const status = document.getElementById('tech-status-filter')?.value || 'all';

    let list = allAdminTechsCache;

    if (q) {
        list = list.filter(t => 
            (t.name || '').toLowerCase().includes(q) ||
            (t.specialty || '').toLowerCase().includes(q) ||
            (t.phone || '').toLowerCase().includes(q) ||
            (t.email || '').toLowerCase().includes(q)
        );
    }
    if (zone !== 'all') {
        list = list.filter(t => t.zone === zone || t.zone === 'Toda la Provincia');
    }
    if (status === 'active') {
        list = list.filter(t => t.active === true);
    } else if (status === 'inactive') {
        list = list.filter(t => t.active === false);
    }

    if (!list || list.length === 0) {
        container.innerHTML = `
            <div style="grid-column:1/-1;">
                <div style="background:var(--gray-50); border:1px solid var(--gray-200); border-radius:16px; padding:40px 24px; text-align:center;">
                    <div style="font-size:3rem; margin-bottom:12px;">👷</div>
                    <h3 style="font-family:'Outfit',sans-serif; font-size:1.2rem; font-weight:700; color:var(--gray-800); margin-bottom:6px;">No se encontraron técnicos</h3>
                    <p style="color:var(--gray-500); max-width:400px; margin:0 auto 18px; font-size:0.85rem;">Prueba cambiando los filtros o registra un nuevo técnico para el equipo de HIDROSYS.</p>
                    <button class="btn btn-primary btn-sm" onclick="openTechModal()">➕ Agregar Nuevo Técnico</button>
                </div>
            </div>
        `;
        return;
    }

    container.innerHTML = list.map(t => {
        const isActive = t.active !== false;
        const statusBadge = isActive 
            ? '<span class="badge badge-green">✓ Activo</span>' 
            : '<span class="badge badge-red">✕ Inactivo</span>';

        const cleanPhone = (t.phone || '').replace(/\D/g, '');
        const waLink = cleanPhone ? `https://wa.me/${cleanPhone.startsWith('593') ? cleanPhone : '593' + cleanPhone.replace(/^0/, '')}` : '#';

        return `
            <div class="card" style="padding:20px; border-radius:14px; position:relative; display:flex; flex-direction:column; justify-content:space-between; transition:var(--transition); ${!isActive ? 'opacity:0.65; border-style:dashed;' : ''}">
                <div>
                    <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:12px;">
                        <div style="display:flex; align-items:center; gap:12px;">
                            <div style="font-size:2.2rem; background:var(--blue-50); width:54px; height:54px; border-radius:12px; display:flex; align-items:center; justify-content:center; border:1px solid var(--blue-100);">
                                ${t.avatar || '👷'}
                            </div>
                            <div>
                                <h4 style="font-family:'Outfit',sans-serif; font-weight:700; font-size:1.05rem; color:var(--blue-900); margin:0 0 3px 0;">${t.name}</h4>
                                <div style="font-size:0.78rem; font-weight:600; color:var(--blue-700);">${t.specialty || 'Técnico Especialista'}</div>
                            </div>
                        </div>
                        <div>${statusBadge}</div>
                    </div>

                    <div style="background:var(--gray-50); padding:10px 12px; border-radius:8px; border:1px solid var(--gray-200); font-size:0.8rem; margin-bottom:14px; display:flex; flex-direction:column; gap:6px;">
                        <div>📍 <strong>Cantón / Cobertura:</strong> ${t.zone || 'Toda la Provincia'}</div>
                        <div style="display:flex; align-items:center; justify-content:space-between;">
                            <span>📱 <strong>WhatsApp:</strong> ${t.phone || 'No registrado'}</span>
                            ${cleanPhone ? `<a href="${waLink}" target="_blank" class="badge badge-green" style="text-decoration:none; font-size:0.7rem; padding:2px 6px;">Chat WA ↗</a>` : ''}
                        </div>
                        ${t.email ? `<div>✉️ <strong>Email:</strong> ${t.email}</div>` : ''}
                        <div>⭐ <strong>Calificación:</strong> ${parseFloat(t.rating || 5.0).toFixed(1)} / 5.0</div>
                    </div>
                </div>

                <div style="display:flex; justify-content:space-between; align-items:center; pt-2; border-top:1px dashed var(--gray-200); margin-top:6px; padding-top:10px;">
                    <button class="btn btn-xs ${isActive ? 'btn-outline' : 'btn-success'}" onclick="toggleTechActive(${t.id}, ${!isActive})" style="font-size:0.75rem; padding:4px 10px;">
                        ${isActive ? '⏸️ Pausar' : '▶️ Activar'}
                    </button>
                    <div style="display:flex; gap:6px;">
                        <button class="btn btn-xs btn-outline" onclick="openTechModal(${t.id})" style="font-size:0.75rem; padding:4px 10px;">✏️ Editar</button>
                        <button class="btn btn-xs" onclick="deleteTech(${t.id})" style="background:var(--red-bg); color:var(--red); border:none; font-size:0.75rem; padding:4px 8px;" title="Eliminar técnico">🗑️</button>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

window.openTechModal = function(id = null) {
    const modal = document.getElementById('modal-tech');
    if (!modal) return;

    const titleEl = document.getElementById('modal-tech-title');
    const idEl = document.getElementById('tech-id');
    const nameEl = document.getElementById('tech-name');
    const specEl = document.getElementById('tech-specialty');
    const zoneEl = document.getElementById('tech-zone');
    const phoneEl = document.getElementById('tech-phone');
    const emailEl = document.getElementById('tech-email');
    const avatarEl = document.getElementById('tech-avatar');
    const activeEl = document.getElementById('tech-active');

    if (id) {
        const tech = allAdminTechsCache.find(t => t.id == id);
        if (tech) {
            titleEl.textContent = `👷 Editar Técnico: ${tech.name}`;
            idEl.value = tech.id;
            nameEl.value = tech.name || '';
            specEl.value = tech.specialty || '';
            zoneEl.value = tech.zone || 'Azogues';
            phoneEl.value = tech.phone || '';
            emailEl.value = tech.email || '';
            avatarEl.value = tech.avatar || '👨‍💻';
            activeEl.checked = tech.active !== false;
        }
    } else {
        titleEl.textContent = '➕ Nuevo Técnico de HIDROSYS';
        idEl.value = '';
        nameEl.value = '';
        specEl.value = '';
        zoneEl.value = 'Azogues';
        phoneEl.value = '';
        emailEl.value = '';
        avatarEl.value = '👨‍💻';
        activeEl.checked = true;
    }

    modal.style.display = 'flex';
};

window.closeTechModal = function() {
    const modal = document.getElementById('modal-tech');
    if (modal) modal.style.display = 'none';
};

window.saveTech = async function(e) {
    e.preventDefault();
    const btn = document.getElementById('btn-save-tech');
    btn.disabled = true;
    btn.textContent = 'Guardando...';

    const id = document.getElementById('tech-id').value;
    const data = {
        name:      document.getElementById('tech-name').value.trim(),
        specialty: document.getElementById('tech-specialty').value.trim(),
        zone:      document.getElementById('tech-zone').value,
        phone:     document.getElementById('tech-phone').value.trim(),
        email:     document.getElementById('tech-email').value.trim(),
        avatar:    document.getElementById('tech-avatar').value,
        active:    document.getElementById('tech-active').checked
    };

    const cleanPhone = data.phone.replace(/\D/g, '');
    if (!/^09\d{8}$/.test(cleanPhone) && !/^5939\d{8}$/.test(cleanPhone) && cleanPhone.length !== 10) {
        toast('⚠️ El teléfono WhatsApp del técnico debe contener 10 dígitos (ej. 0987654321).', 'warning');
        btn.disabled = false; btn.textContent = '💾 Guardar Técnico';
        return;
    }

    try {
        if (id) {
            await api('PUT', `/technicians/${id}`, data);
            toast('✅ Datos del técnico actualizados correctamente.', 'success');
        } else {
            await api('POST', '/technicians', data);
            toast('✅ Nuevo técnico registrado en el sistema.', 'success');
        }
        closeTechModal();
        await loadAdminTechnicians();
        loadAppointments(); // Refrescar dropdowns de citas
    } catch (err) {
        toast(`Error: ${err.message}`, 'error');
    } finally {
        btn.disabled = false;
        btn.textContent = '💾 Guardar Técnico';
    }
};

window.toggleTechActive = async function(id, newStatus) {
    try {
        await api('PUT', `/technicians/${id}`, { active: newStatus });
        toast(newStatus ? '✅ Técnico reactivado.' : '⏸️ Técnico pausado/inactivo.', 'info');
        await loadAdminTechnicians();
        loadAppointments();
    } catch (err) {
        toast(`Error: ${err.message}`, 'error');
    }
};

window.deleteTech = async function(id) {
    const tech = allAdminTechsCache.find(t => t.id == id);
    const techName = tech ? tech.name : 'este técnico';
    if (!confirm(`¿Estás seguro de eliminar a ${techName}? Si tiene citas previas quedará marcado como inactivo para proteger el historial.`)) return;

    try {
        const res = await api('DELETE', `/technicians/${id}`);
        toast(res.message || 'Técnico procesado.', 'info');
        await loadAdminTechnicians();
        loadAppointments();
    } catch (err) {
        toast(`Error: ${err.message}`, 'error');
    }
};

// ============================================================
// ADMIN: ENCUESTAS
// ============================================================
// ============================================================
// ADMIN: ENCUESTAS & FILTRO POR TÉCNICO
// ============================================================
let allSurveysCache = [];

async function loadSurveys() {
    const container = document.getElementById('surveys-container');
    if (!container) return;
    try {
        allSurveysCache = await api('GET', '/surveys');
        
        // Poblar el dropdown de filtro con los técnicos disponibles
        const filterSelect = document.getElementById('survey-tech-filter');
        if (filterSelect) {
            const currentVal = filterSelect.value || 'all';
            const techNames = [...new Set(allSurveysCache.map(s => s.tech_name).filter(Boolean))].sort();
            filterSelect.innerHTML = `
                <option value="all">⭐ Todos los Técnicos (${allSurveysCache.length} encuestas)</option>
                ${techNames.map(t => `<option value="${t}">${t}</option>`).join('')}
            `;
            filterSelect.value = techNames.includes(currentVal) ? currentVal : 'all';
        }

        renderFilteredSurveys();
    } catch (err) { toast(`Error al cargar encuestas: ${err.message}`, 'error'); }
}

function filterSurveysByTech(techName) {
    renderFilteredSurveys(techName);
}

function renderFilteredSurveys(selectedTech = null) {
    const container = document.getElementById('surveys-container');
    if (!container) return;

    const filterVal = selectedTech || document.getElementById('survey-tech-filter')?.value || 'all';
    const emojis = { 1:'😡', 2:'🙁', 3:'😐', 4:'😊', 5:'😍' };
    const labels = { 1:'Pésimo', 2:'Malo', 3:'Regular', 4:'Bueno', 5:'Excelente' };

    const surveys = (filterVal === 'all') 
        ? allSurveysCache 
        : allSurveysCache.filter(s => (s.tech_name || 'Sin técnico asignado') === filterVal);

    if (!surveys || surveys.length === 0) {
        container.innerHTML = `
            <div style="grid-column:1/-1;">
                <div style="background:linear-gradient(135deg,#f0fdf4,#dcfce7);border:1px solid #bbf7d0;border-radius:16px;padding:48px 32px;text-align:center;">
                    <div style="font-size:3.5rem;margin-bottom:16px;">⭐</div>
                    <h3 style="font-family:'Outfit',sans-serif;font-size:1.4rem;font-weight:800;color:#166534;margin-bottom:8px;">No hay calificaciones para este filtro</h3>
                    <p style="color:#15803d;max-width:480px;margin:0 auto 24px;line-height:1.6;font-size:0.9rem;">No se encontraron encuestas registradas para el técnico seleccionado.</p>
                    <div style="display:flex;gap:12px;justify-content:center;flex-wrap:wrap;">
                        <button class="btn btn-primary" onclick="filterSurveysByTech('all'); document.getElementById('survey-tech-filter').value='all';" style="background:#166534;">Ver Todos los Técnicos</button>
                    </div>
                </div>
            </div>
        `;
        return;
    }

    // Agrupar calificaciones por técnico
    const techGroups = {};
    surveys.forEach(s => {
        const name = s.tech_name || 'Sin técnico asignado';
        if (!techGroups[name]) {
            techGroups[name] = { sum: 0, count: 0, items: [] };
        }
        techGroups[name].sum += s.rating;
        techGroups[name].count += 1;
        techGroups[name].items.push(s);
    });

    let html = `
        <!-- Panel resumen de técnicos con CSS dinámico y adaptado a Modo Oscuro -->
        <div class="survey-summary-box" style="grid-column:1/-1;">
            <div class="survey-summary-header">
                <span>📈 Calificación Promedio del Personal Técnico ${filterVal !== 'all' ? `(${filterVal})` : ''}</span>
            </div>
            <div style="display:flex; gap:16px; flex-wrap:wrap; padding:16px;">
    `;

    Object.entries(techGroups).forEach(([techName, data]) => {
        const avg = (data.sum / data.count).toFixed(2);
        let ratingColor = 'var(--gray-500)';
        if (avg >= 4.2) ratingColor = 'var(--green)';
        else if (avg >= 3.0) ratingColor = 'var(--yellow)';
        else if (avg > 0) ratingColor = 'var(--red)';

        html += `
            <div class="survey-tech-item">
                <div>
                    <div class="survey-tech-title">${techName}</div>
                    <div class="survey-tech-subtitle">${data.count} encuesta${data.count != 1 ? 's' : ''}</div>
                </div>
                <div style="font-family:'Outfit',sans-serif; font-weight:800; font-size:1.4rem; color:${ratingColor};">
                    ${avg} <span style="font-size:0.8rem; font-weight:500; color:var(--text-faint);">/ 5</span>
                </div>
            </div>
        `;
    });

    html += `
            </div>
        </div>
        <!-- Detalle de encuestas agrupadas -->
    `;

    Object.entries(techGroups).forEach(([techName, data]) => {
        html += `
            <div class="survey-group-title">
                Calificaciones para: ${techName} (${data.count})
            </div>
        `;

        data.items.forEach(s => {
            html += `
                <div class="card" style="margin-bottom:12px;">
                    <div class="card-header">
                        <div>
                            <span class="card-title">${s.client_name || 'Cliente'}</span>
                            <div style="font-size:0.78rem;color:var(--text-muted);">${s.service_type || 'Servicio Técnico'} · ${formatDate(s.apt_date || '')}</div>
                        </div>
                        <div style="font-size:1.5rem;" title="${labels[s.rating]||''}">${emojis[s.rating]||'⭐'}
                            <span style="font-size:0.85rem;font-family:'Outfit',sans-serif;font-weight:700;color:var(--text-primary); margin-left:4px;">${s.rating}/5</span>
                        </div>
                    </div>
                    <div class="card-body" style="font-size:0.875rem;">
                        <p class="survey-comment-text">"${s.comment || 'Sin comentarios adicionales.'}"</p>
                        ${s.audio_duration ? `
                            <div style="margin-top:10px;background:var(--blue-50);border:1px solid var(--blue-100);padding:8px 12px;border-radius:6px;font-size:0.8rem;color:var(--blue-800);">
                                🎙️ Nota de voz registrada · Duración: ${s.audio_duration}
                            </div>` : ''}
                        <p style="font-size:0.72rem;color:var(--text-faint);margin-top:8px;">${new Date(s.created_at).toLocaleDateString('es-EC')}</p>
                    </div>
                </div>
            `;
        });
    });

    container.innerHTML = html;
}

// ============================================================
// INFORME TÉCNICO
// ============================================================
async function showTechReport(aptId) {
    try {
        const apts = await api('GET', `/appointments?limit=100`);
        const a = apts.find(x => x.id == aptId);
        if (!a) { toast('No se encontró la cita.', 'warning'); return; }

        const modal = document.getElementById('report-modal');
        const content = document.getElementById('report-modal-content');
        content.innerHTML = `
            <div class="report-content">
                <div class="report-header">
                    <div>
                        <div style="font-family:'Outfit',sans-serif;font-size:1.3rem;font-weight:800;color:var(--blue-800);">HIDROSYS EC.</div>
                        <div style="font-size:0.75rem;color:#555;">Agua Potable · Gas · Conducción Hidráulica</div>
                        <div style="font-size:0.72rem;color:#888;">RUC: 1793000000001 · info@hidrosys.ec</div>
                    </div>
                    <div style="text-align:right;font-size:0.75rem;color:#555;">
                        <div style="font-weight:700;">INFORME TÉCNICO</div>
                        <div>N° ${String(a.id).padStart(4,'0')}-2026</div>
                        <div>Fecha: ${new Date().toLocaleDateString('es-EC')}</div>
                    </div>
                </div>

                <div class="report-section-title">DATOS DEL CLIENTE</div>
                <div class="report-grid-2">
                    <div><strong>Nombre:</strong> ${a.client_name}</div>
                    <div><strong>Teléfono:</strong> ${a.client_phone}</div>
                    <div class="col-2"><strong>Dirección:</strong> ${a.address}</div>
                    <div><strong>Zona:</strong> ${a.zone}</div>
                    <div><strong>Correo:</strong> ${a.client_email || '—'}</div>
                </div>

                <div class="report-section-title">DATOS DEL SERVICIO</div>
                <table class="report-table" style="width:100%;margin-bottom:16px;">
                    <tr><th>Servicio</th><th>Fecha</th><th>Hora</th><th>Técnico</th></tr>
                    <tr><td>${a.service_type}</td><td>${formatDate(a.apt_date)}</td><td>${String(a.apt_time||'').slice(0,5)}</td><td>${a.tech_name||'N/A'}</td></tr>
                </table>

                <div class="report-section-title">ESTADO Y PAGO</div>
                <div class="report-grid-2">
                    <div><strong>Estado:</strong> ${a.status}</div>
                    <div><strong>Monto:</strong> $${parseFloat(a.payment_amount||0).toFixed(2)}</div>
                    <div><strong>Modalidad:</strong> ${a.payment_mode || '—'}</div>
                    <div><strong>Pago:</strong> ${a.payment_status || 'Pendiente'}</div>
                    ${a.bank ? `<div><strong>Banco:</strong> ${a.bank}</div>` : ''}
                    ${a.receipt_no ? `<div><strong>N° Comprobante:</strong> ${a.receipt_no}</div>` : ''}
                    ${a.receipt_img ? `<div class="col-2"><strong>Comprobante de Pago:</strong> <a href="${a.receipt_img}" target="_blank" style="color:var(--blue-700);font-weight:600;text-decoration:underline;">🖼️ Ver Imagen del Comprobante</a></div>` : ''}
                </div>

                ${a.audio_url ? `
                    <div class="report-section-title">AUDIO DEL CLIENTE</div>
                    <div style="margin-bottom:14px;background:#f8fafc;padding:10px;border-radius:6px;border:1px solid #e2e8f0;">
                        <audio controls src="${a.audio_url}" style="width:100%;height:32px;"></audio>
                    </div>
                ` : ''}

                ${a.notes ? `<div class="report-section-title">OBSERVACIONES</div><p style="font-style:italic;font-size:0.875rem;">"${a.notes}"</p>` : ''}

                <div class="signature-row">
                    <div class="signature-block">Técnico Responsable<br><strong>${a.tech_name||'___________'}</strong></div>
                    <div class="signature-block">Cliente<br><strong>${a.client_name}</strong></div>
                    <div class="signature-block">Jefe de Servicio<br><strong>HIDROSYS EC.</strong></div>
                </div>

                <div style="text-align:center;font-size:0.68rem;color:#aaa;margin-top:24px;border-top:1px solid #eee;padding-top:10px;">
                    Documento generado por el Sistema de Gestión HIDROSYS EC. v3.0 · ${new Date().toLocaleString('es-EC')}
                </div>
            </div>
        `;
        modal.classList.add('open');
    } catch (err) { toast(`Error al generar informe: ${err.message}`, 'error'); }
}

window.openReceiptModal = function(aptId) {
    const modal = document.getElementById('receipt-modal');
    const body  = document.getElementById('receipt-modal-body');
    const title = document.getElementById('receipt-modal-title');
    const sub   = document.getElementById('receipt-modal-sub');
    const info  = document.getElementById('receipt-modal-info');
    const dlBtn = document.getElementById('receipt-modal-download');
    if (!modal || !body) return;

    // Obtener datos del caché (se pobló en loadAppointments)
    const cached = receiptsCache.get(Number(aptId)) || {};
    const rawSrc     = cached.img || '';
    const clientName = cached.clientName || '';
    const bank       = cached.bank || '';
    const receiptNo  = cached.receiptNo || '';

    if (title) title.textContent = `Comprobante — Cita #${aptId}`;
    if (sub)   sub.textContent   = `Cliente: ${clientName || 'Cliente'} · Banco: ${bank || 'No especificado'}`;
    if (info)  info.textContent  = `Nº de Transferencia: ${receiptNo || 'S/N'}`;

    if (rawSrc && rawSrc.startsWith('data:image')) {
        // Base64 — renderizar directamente (lo que guardamos desde el formulario)
        body.innerHTML = `
            <div style="display:flex; justify-content:center; align-items:center; min-height:220px;">
                <img src="${rawSrc}" alt="Comprobante de Pago" style="max-width:100%; max-height:65vh; border-radius:8px; box-shadow:0 4px 15px rgba(0,0,0,0.5); object-fit:contain;">
            </div>
        `;
        if (dlBtn) { dlBtn.href = rawSrc; dlBtn.download = `comprobante_cita_${aptId}.jpg`; dlBtn.style.display = 'inline-flex'; }
    } else if (rawSrc && (rawSrc.startsWith('/uploads/') || rawSrc.startsWith('http'))) {
        body.innerHTML = `
            <div style="display:flex; flex-direction:column; justify-content:center; align-items:center; min-height:220px; gap:12px;">
                <img src="${rawSrc}" alt="Comprobante de Pago" style="max-width:100%; max-height:65vh; border-radius:8px; box-shadow:0 4px 15px rgba(0,0,0,0.5); object-fit:contain;"
                     onerror="this.style.display='none'; document.getElementById('rct-fallback').style.display='block';">
                <div id="rct-fallback" style="display:none; color:white; font-size:0.9rem; text-align:center; padding:16px; background:rgba(255,255,255,0.1); border-radius:8px;">
                    ⚠️ No se pudo cargar la imagen.<br><small style="color:#cbd5e1;">Banco: ${bank} · Nº ${receiptNo}</small>
                </div>
            </div>
        `;
        if (dlBtn) { dlBtn.href = rawSrc; dlBtn.style.display = 'inline-flex'; }
    } else {
        // Sin imagen — mostrar solo los datos bancarios
        body.innerHTML = `
            <div style="padding:30px 15px; color:white; text-align:center;">
                <div style="font-size:2.8rem; margin-bottom:8px;">🧾</div>
                <h4 style="color:white; margin-bottom:6px;">Transferencia Registrada</h4>
                <p style="color:#94a3b8; font-size:0.85rem; margin-bottom:12px;">El cliente reportó el comprobante sin archivo adjunto.</p>
                <div style="background:rgba(255,255,255,0.1); padding:12px; border-radius:8px; display:inline-block; font-size:0.85rem;">
                    🏦 <strong>Banco:</strong> ${bank || 'N/A'}<br>
                    🔢 <strong>Nº Transferencia:</strong> ${receiptNo || 'N/A'}
                </div>
            </div>
        `;
        if (dlBtn) dlBtn.style.display = 'none';
    }

    modal.classList.add('open');
};

function closeModal(id) { document.getElementById(id)?.classList.remove('open'); }
document.addEventListener('click', e => { if (e.target.classList.contains('modal-backdrop')) closeModal(e.target.id); });

// ============================================================
// GRABADORA DE VOZ (Encuestas)
// ============================================================
function setupRecorder() {
    const btn   = document.getElementById('rec-btn');
    const timer = document.getElementById('rec-timer');
    const status = document.getElementById('rec-status');
    const waves = document.querySelectorAll('#wave-container .wave-bar');
    if (!btn) return;

    let interval = null, seconds = 0, recording = false;

    btn.addEventListener('click', () => {
        if (!recording) {
            recording = true;
            seconds = 0;
            btn.querySelector('span').textContent = '⏹ Detener';
            btn.classList.add('recording');
            status.textContent = 'Grabando...';
            waves.forEach(w => w.classList.add('animate'));
            interval = setInterval(() => {
                seconds++;
                timer.textContent = `00:${String(seconds).padStart(2,'0')}`;
                if (seconds >= 120) btn.click();
            }, 1000);
        } else {
            clearInterval(interval); recording = false;
            btn.querySelector('span').textContent = '🎙️ Grabar Audio';
            btn.classList.remove('recording');
            status.textContent = `Audio de ${seconds}s grabado ✓`;
            waves.forEach(w => w.classList.remove('animate'));
            toast(`Nota de voz grabada: ${seconds} segundos.`, 'success');
        }
    });
}

// ============================================================
// WHATSAPP DRAWER
// ============================================================
function toggleWADrawer() {
    window.open('https://wa.me/593968245633?text=Hola', '_blank');
}

let waMode = 'text';
function setWAMode(mode) {
    waMode = mode;
    document.querySelectorAll('.wa-pill').forEach(p => p.classList.remove('active'));
    document.getElementById(`wa-pill-${mode}`)?.classList.add('active');
    const input = document.getElementById('wa-input');
    if (input) input.placeholder = mode === 'voice' ? '🎙️ Toca el micrófono para hablar...' : 'Escribe un mensaje...';
}

function sendWAMsg(sender, text, hasConfirm = false, aptId = null) {
    const chat = document.getElementById('wa-chat');
    if (!chat) return;
    const now = new Date();
    const time = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;
    const formatted = text.replace(/\*(.*?)\*/g,'<strong>$1</strong>').replace(/\n/g,'<br>');

    const div = document.createElement('div');
    div.className = `wa-msg wa-msg-${sender === 'client' ? 'out' : 'in'}`;
    div.innerHTML = `
        <div class="wa-msg-text">${formatted}</div>
        ${hasConfirm && aptId ? `
            <div class="wa-msg-btns">
                <button class="wa-btn-confirm" data-id="${aptId}">✅ Confirmar Asistencia</button>
                <button class="wa-btn-reschedule">📅 Reagendar</button>
            </div>` : ''}
        <span class="wa-msg-time">${time}</span>
    `;

    div.querySelector('.wa-btn-confirm')?.addEventListener('click', async function() {
        this.disabled = true; this.textContent = '✓ Confirmado';
        this.style.background = '#128c7e';
        await api('PUT', `/appointments/${aptId}`, { status: 'Confirmado por Cliente' });
        toast('Cliente confirmó asistencia.', 'success');
        setTimeout(() => {
            sendWAMsg('client', '¡Confirmado! Estaré disponible en ese horario. ¡Gracias!');
            setTimeout(() => sendWAMsg('system', '¡Perfecto! Nuestro técnico llegará puntualmente. 👷'), 1200);
        }, 600);
    });

    div.querySelector('.wa-btn-reschedule')?.addEventListener('click', function() {
        this.disabled = true;
        sendWAMsg('client', 'Quisiera cambiar la fecha de mi cita.');
        setTimeout(() => sendWAMsg('system', 'Claro, un asesor le contactará para coordinar una nueva fecha conveniente.'), 1000);
    });

    chat.appendChild(div);
    chat.scrollTop = chat.scrollHeight;

    // Mostrar badge si el drawer está cerrado
    const drawer = document.getElementById('wa-drawer');
    if (drawer && !drawer.classList.contains('open') && sender !== 'client') {
        const badge = document.getElementById('wa-unread-badge');
        if (badge) {
            badge.style.display = 'flex';
            badge.textContent = parseInt(badge.textContent || 0) + 1;
        }
    }
}

// Bot de WhatsApp para agendamiento
let botActive = false, botStep = 0, botData = {};

const BOT_FLOW = [
    { field: 'clientName',  q: '👋 ¡Hola! Para agendar tu visita, necesito algunos datos.\n\n¿Cuál es tu *nombre completo*?' },
    { field: 'clientPhone', q: '¿Cuál es tu *número de celular* de contacto? (con código +593)' },
    { field: 'clientEmail', q: '¿Cuál es tu *correo electrónico*? (Escribe su correo o "no" para omitir)' },
    { field: 'address',     q: '¿Cuál es tu *dirección domiciliaria*? (calle y referencia)' },
    { field: 'canton',      q: '¿En qué cantón de la provincia del Cañar te encuentras?\n\n1️⃣ Azogues  2️⃣ Biblián  3️⃣ Cañar  4️⃣ La Troncal  5️⃣ El Tambo  6️⃣ Déleg  7️⃣ Suscal\n\nEscribe el número o el nombre del cantón.' },
    { field: 'parish',      q: '¿En qué *parroquia* de ese cantón te encuentras? (Escribe el nombre de la parroquia)' },
    { field: 'serviceType', q: '¿Qué servicio necesitas?\n\n1️⃣ Mantenimiento Preventivo\n2️⃣ Reparación de Fuga\n3️⃣ Instalación de Medidor\n4️⃣ Instalación de Gas\n5️⃣ Inspección General' },
    { field: 'aptDate',     q: '¿Cuál es la *fecha preferida* para la visita? (formato: AAAA-MM-DD, Ej: 2026-07-10)' },
    { field: 'aptTime',     q: '¿A qué *hora* prefieres? (09:00, 10:00, 11:00, 14:00, 15:00, 16:00)' },
];
const ZONE_MAP    = {
    '1':'Azogues','2':'Biblián','3':'Cañar','4':'La Troncal','5':'El Tambo','6':'Déleg','7':'Suscal',
    'azogues':'Azogues','biblián':'Biblián','cañar':'Cañar','la troncal':'La Troncal','el tambo':'El Tambo','déleg':'Déleg','suscal':'Suscal'
};
const SERVICE_MAP = {'1':'🔧 Mantenimiento Preventivo Red','2':'💧 Reparación de Fuga / Correctivo','3':'📟 Instalación de Medidor de Agua','4':'🔥 Acometida e Instalación de Gas','5':'🔍 Inspección Técnica General'};

function startWABot() {
    botActive = true; botStep = 0; botData = {};
    document.getElementById('wa-drawer').classList.add('open');
    document.getElementById('wa-captured-form').style.display = 'none';
    document.getElementById('wa-online-status').textContent = 'Bot activo...';
    setTimeout(() => { sendWAMsg('system', BOT_FLOW[0].q); botStep = 1; }, 800);
}

function processBotReply(text) {
    if (!botActive || botStep === 0) return;
    const q = BOT_FLOW[botStep - 1];
    let val = text.trim();
    if (q.field === 'canton') val = ZONE_MAP[text.toLowerCase().trim()] || val;
    if (q.field === 'serviceType') val = SERVICE_MAP[text.trim()] || val;
    
    botData[q.field] = val;
    
    if (q.field === 'clientEmail' && val.toLowerCase() === 'no') {
        botData[q.field] = '';
    }
    
    botStep++;

    if (botStep <= BOT_FLOW.length) {
        document.getElementById('wa-online-status').textContent = 'escribiendo...';
        setTimeout(() => {
            sendWAMsg('system', BOT_FLOW[botStep-1].q);
            document.getElementById('wa-online-status').textContent = 'Bot activo';
        }, 700);
    } else {
        botActive = false;
        document.getElementById('wa-online-status').textContent = 'en línea';
        botData.zone = `${botData.canton} - ${botData.parish}`;
        setTimeout(() => {
            sendWAMsg('system', `✅ *¡Datos completos!*\nNombre: *${botData.clientName}*\nUbicación: *${botData.zone}*\nServicio: *${botData.serviceType}*\nFecha: *${botData.aptDate}* · Hora: *${botData.aptTime}*\n\nRevisa el formulario en la plataforma y confirma tu cita.`);
            fillWACapturedForm(botData);
        }, 800);
    }
}

function fillWACapturedForm(data) {
    const fields = { 'wac-name': data.clientName, 'wac-phone': data.clientPhone, 'wac-address': data.address, 'wac-zone': data.zone, 'wac-service': data.serviceType, 'wac-date': data.aptDate, 'wac-time': data.aptTime };
    Object.entries(fields).forEach(([id, val]) => { const el = document.getElementById(id); if (el && val) { el.value = val; el.style.borderColor = 'var(--green)'; } });

    const formEl = document.getElementById('wa-captured-form');
    if (formEl) { formEl.style.display = 'block'; formEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); }

    // Eliminar event listeners anteriores
    const oldBtn = document.getElementById('wac-confirm-btn');
    const newBtn = oldBtn.cloneNode(true);
    oldBtn.parentNode.replaceChild(newBtn, oldBtn);

    newBtn.addEventListener('click', async () => {
        try {
            const created = await api('POST', '/appointments', { ...data, paymentMode: 'Tarifa Base Completa', channel: 'WhatsApp' });
            
            const bankList = `*Cuentas Oficiales para Transferencia (HIDROSYS EC):*
1. *B. Pichincha* (Cte): 2201948332
2. *B. Guayaquil* (Aho): 10482938
3. *Produbanco* (Cte): 0209384729
4. *B. Pacífico* (Aho): 72938472
5. *Coop. JEP* (Aho): 829384201
6. *Coop. MEGO* (Aho): 938482932
7. *Alianza del Valle* (Aho): 384729221
8. *B. Bolivariano* (Cte): 048293847`;

            toast(`¡Cita guardada en base de datos! ID: ${created.id}`, 'success', 6000);
            sendWAMsg('system', `*HIDROSYS – Cita Registrada (Pre-agendada)* 💧\n\nHola *${data.clientName}*, tu cita quedó pre-agendada para el *${formatDate(data.aptDate)}* a las *${data.aptTime}* (${data.zone}).\n\n⚠️ *IMPORTANTE:* Tu turno está *Pre-agendado* y solo se confirmará una vez que realices la transferencia por el valor de tu servicio y reportes tu comprobante.\n\n${bankList}\n\n*Titular:* HIDROSYS EC. (RUC: 1793000000001)\n\nUna vez reportado, procederemos a asignarte un técnico y confirmar tu turno.`);
            document.getElementById('wa-captured-form').style.display = 'none';
            loadDashboard();
        } catch (err) { toast(`Error: ${err.message}`, 'error'); }
    });
    toast('¡Datos del asistente cargados!', 'success');
}

// Envío de mensajes en WhatsApp
function setupWABot() {
    const sendBtn = document.getElementById('wa-send-btn');
    const input   = document.getElementById('wa-input');
    const openBtn = document.getElementById('wa-open-btn');

    openBtn?.addEventListener('click', () => window.open('https://wa.me/593968245633?text=Hola', '_blank'));

    const handleSend = () => {
        const text = input.value.trim();
        if (!text) return;
        sendWAMsg('client', text);
        input.value = '';

        const lower = text.toLowerCase();
        if ((lower === 'agendar' || lower.includes('cita') || lower.includes('visita')) && !botActive) {
            setTimeout(startWABot, 600);
        } else if (botActive) {
            setTimeout(() => processBotReply(text), 600);
        } else {
            setTimeout(() => sendWAMsg('system', '¡Entendido! Para agendar una visita técnica escribe *"agendar"* y te guiaré paso a paso. También puedes usar el modo de voz 🎙️'), 700);
        }
    };

    sendBtn?.addEventListener('click', handleSend);
    input?.addEventListener('keypress', e => { if (e.key === 'Enter') handleSend(); });
}

// ============================================================
// WEB SPEECH API (Voz Gratis - Chrome/Edge)
// ============================================================
function setupVoiceInput() {
    const micBtn    = document.getElementById('wa-mic-btn');
    const overlay   = document.getElementById('voice-overlay');
    const liveText  = document.getElementById('voice-live-text');
    const stopBtn   = document.getElementById('voice-stop-btn');

    if (!micBtn) return;

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
        micBtn.addEventListener('click', () => toast('Tu navegador no soporta voz. Usa Google Chrome o Edge.', 'error', 7000));
        return;
    }

    const rec = new SpeechRecognition();
    rec.lang = 'es-EC'; rec.continuous = true; rec.interimResults = true;
    let full = '';

    micBtn.addEventListener('click', () => {
        full = '';
        if (liveText) liveText.textContent = 'Habla ahora...';
        overlay?.classList.add('open');
        micBtn.classList.add('listening');
        try { rec.start(); } catch { rec.stop(); setTimeout(() => rec.start(), 300); }
    });

    stopBtn?.addEventListener('click', () => rec.stop());

    rec.onresult = e => {
        let interim = '', finalFull = '';
        for (let i = 0; i < e.results.length; i++) {
            if (e.results[i].isFinal) finalFull += e.results[i][0].transcript + ' ';
            else interim += e.results[i][0].transcript;
        }
        full = finalFull;
        if (liveText) liveText.textContent = (finalFull + interim).trim() || 'Escuchando...';
    };

    rec.onend = () => {
        micBtn.classList.remove('listening');
        overlay?.classList.remove('open');
        const finalText = full.trim();
        if (!finalText) { toast('No se detectó voz. Intenta de nuevo.', 'warning'); return; }
        sendWAMsg('client', `🎙️ "${finalText}"`);
        if (botActive && botStep > 0) setTimeout(() => processBotReply(finalText), 700);
        else setTimeout(() => sendWAMsg('system', `Audio recibido: *"${finalText}"*\n\nEscribe *"agendar"* para iniciar el agendamiento con el asistente.`), 700);
        full = '';
    };

    rec.onerror = e => {
        micBtn.classList.remove('listening');
        overlay?.classList.remove('open');
        if (e.error === 'not-allowed') toast('Permiso de micrófono denegado. Actívalo en la configuración del navegador.', 'error', 7000);
        else toast(`Error de audio: ${e.error}`, 'warning');
    };
}

// ============================================================
// HELPERS
// ============================================================
function formatDate(dateStr) {
    if (!dateStr) return '—';
    const d = new Date(dateStr);
    const months = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
    return `${d.getUTCDate()} ${months[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

function statusBadge(status) {
    const map = {
        'Pre-agendado':          'badge-yellow',
        'Reportado':             'badge-purple',
        'Confirmado':            'badge-blue',
        'Confirmado por Cliente':'badge-green',
        'Terminado':             'badge-gray',
        'Nuevo':                 'badge-blue',
        'Convertido':            'badge-green',
    };
    return `<span class="badge ${map[status]||'badge-gray'}">${status||'—'}</span>`;
}

// ============================================================
// ADMIN WHATSAPP QR & CONEXIÓN EN VIVO
// ============================================================
let waPollInterval = null;

async function loadAdminWAStatus() {
    clearInterval(waPollInterval);
    await fetchAdminWAStatus();

    // Auto-refrescar cada 4 segundos mientras se esté en la pestaña admin-wa
    waPollInterval = setInterval(() => {
        const page = document.getElementById('page-admin-wa');
        if (page && page.classList.contains('active')) {
            fetchAdminWAStatus(true);
        } else {
            clearInterval(waPollInterval);
        }
    }, 4000);
}

async function fetchAdminWAStatus(silent = false) {
    const badge = document.getElementById('wa-panel-status-badge');
    const phoneEl = document.getElementById('wa-panel-phone');
    const detailEl = document.getElementById('wa-panel-detail');
    const navBadge = document.getElementById('wa-nav-badge');
    const qrLoading = document.getElementById('wa-qr-loading');
    const qrImg = document.getElementById('wa-qr-img');
    const qrSuccess = document.getElementById('wa-qr-success');

    try {
        const res = await fetch('/api/wa/status');
        const data = await res.json();

        if (!data.enabled) {
            if (badge) { badge.textContent = 'Deshabilitado'; badge.style.background = '#fee2e2'; badge.style.color = '#991b1b'; }
            if (detailEl) detailEl.textContent = 'El servicio de WhatsApp está apagado en el servidor';
            return;
        }

        if (data.connected) {
            if (badge) { badge.textContent = '🟢 CONECTADO'; badge.style.background = '#d1fae5'; badge.style.color = '#065f46'; }
            if (navBadge) { navBadge.textContent = 'Conectado'; navBadge.style.background = '#10B981'; }
            if (phoneEl) phoneEl.textContent = `+${data.phone || '593968245633'}`;
            if (detailEl) { detailEl.textContent = '✅ Sesión activa. Procesando citas y flujos en tiempo real.'; detailEl.style.color = '#10b981'; }

            if (qrLoading) qrLoading.style.display = 'none';
            if (qrImg) qrImg.style.display = 'none';
            if (qrSuccess) qrSuccess.style.display = 'flex';
        } else {
            if (badge) { badge.textContent = '🟡 ESPERANDO ESCANEO'; badge.style.background = '#fef3c7'; badge.style.color = '#92400e'; }
            if (navBadge) { navBadge.textContent = 'QR Listo'; navBadge.style.background = '#f59e0b'; }
            if (detailEl) { detailEl.textContent = '⚠️ Desconectado. Escanea el código QR de la derecha para vincular.'; detailEl.style.color = '#f59e0b'; }
            if (qrSuccess) qrSuccess.style.display = 'none';

            if (data.qr) {
                if (qrLoading) qrLoading.style.display = 'none';
                if (qrImg) {
                    const newUrl = `https://api.qrserver.com/v1/create-qr-code/?size=280x280&data=${encodeURIComponent(data.qr)}`;
                    if (qrImg.src !== newUrl) qrImg.src = newUrl;
                    qrImg.style.display = 'block';
                }
            } else {
                if (qrImg) qrImg.style.display = 'none';
                if (qrLoading) {
                    qrLoading.textContent = '⏳ Generando código QR en el servidor...';
                    qrLoading.style.display = 'block';
                }
            }
        }
    } catch (err) {
        if (!silent) console.error('Error cargando estado de WhatsApp:', err);
    }
}

async function restartWAConnection() {
    const btn = document.getElementById('btn-wa-restart');
    if (!confirm('¿Deseas reiniciar la conexión y generar un nuevo código QR de vinculación?')) return;

    try {
        if (btn) { btn.disabled = true; btn.innerHTML = '⏳ Generando nuevo QR...'; }
        const res = await api('POST', '/wa/restart');
        toast('🔄 Reiniciando bot. El nuevo código QR aparecerá en unos segundos.', 'info', 5000);
        setTimeout(() => {
            fetchAdminWAStatus();
            if (btn) { btn.disabled = false; btn.innerHTML = '<span>🔄</span> Reiniciar Conexión / Generar Nuevo QR'; }
        }, 3500);
    } catch (err) {
        toast(`Error al reiniciar: ${err.message}`, 'error');
        if (btn) { btn.disabled = false; btn.innerHTML = '<span>🔄</span> Reiniciar Conexión / Generar Nuevo QR'; }
    }
}

// ============================================================
// OFFLINE STATE DETECTION
// ============================================================
window.addEventListener('offline', () => {
    const banner = document.getElementById('offline-banner');
    if (banner) {
        banner.style.display = 'block';
        banner.className = 'offline-banner';
        banner.innerHTML = '<span>⚠️ Estás sin conexión a internet. El sistema está en modo lectura y los cambios no se guardarán hasta que te reconectes.</span>';
    }
    // Disable primary action buttons
    document.querySelectorAll('.btn-primary, .btn-success').forEach(btn => {
        if (!btn.id.includes('login') && !btn.id.includes('dark-mode')) {
            btn.disabled = true;
            btn.dataset.originalText = btn.textContent;
            btn.textContent = '❌ Sin conexión';
        }
    });
});

window.addEventListener('online', () => {
    const banner = document.getElementById('offline-banner');
    if (banner) {
        banner.className = 'offline-banner online';
        banner.innerHTML = '<span>✅ Conexión restablecida. Ya puedes continuar.</span>';
        setTimeout(() => {
            banner.style.display = 'none';
        }, 3000);
    }
    // Re-enable primary action buttons
    document.querySelectorAll('.btn-primary, .btn-success').forEach(btn => {
        if (btn.disabled && btn.textContent === '❌ Sin conexión') {
            btn.disabled = false;
            if (btn.dataset.originalText) {
                btn.textContent = btn.dataset.originalText;
            }
        }
    });
});

window.loadAdminWAStatus = loadAdminWAStatus;
window.fetchAdminWAStatus = fetchAdminWAStatus;
window.restartWAConnection = restartWAConnection;

// ============================================================
// 1. PLANTILLAS RÁPIDAS DE WHATSAPP EN 1 CLIC (DESPACHO TÉCNICO)
// ============================================================
async function sendQuickWAMsg(aptId, templateKey) {
    try {
        const apts = await api('GET', '/appointments?limit=100');
        const a = apts.find(x => x.id == aptId);
        if (!a) { toast('No se encontró la cita seleccionada.', 'warning'); return; }

        let cleanPhone = String(a.client_phone || '').replace(/\D/g, '');
        if (cleanPhone.startsWith('0')) cleanPhone = '593' + cleanPhone.substring(1);
        if (!cleanPhone.startsWith('593')) cleanPhone = '593' + cleanPhone;

        const techName = a.tech_name || 'Personal Técnico Asignado';
        const formattedDate = formatDate(a.apt_date);
        const formattedTime = String(a.apt_time || '').slice(0, 5);
        const amount = parseFloat(a.payment_amount || 0).toFixed(2);

        let msg = '';
        if (templateKey === 'on_the_way') {
            msg = `*HIDROSYS EC. - Técnico en Camino* 🚚\n\nEstimado/a *${a.client_name}*, le informamos que nuestro técnico especializado *${techName}* se encuentra en camino a su dirección:\n📍 *${a.address || 'Su domicilio registrado'}* (${a.zone || 'Cañar'})\n\n⏳ Tiempo estimado de llegada: *15 a 25 minutos*.\nPor favor asegúrese de que haya alguien disponible en la propiedad.\n\n_HIDROSYS EC. • Soluciones Hidráulicas_`;
        } else if (templateKey === 'reminder') {
            msg = `*HIDROSYS EC. - Recordatorio de Cita Técnica* ⏰\n\nEstimado/a *${a.client_name}*, le recordamos su servicio programado de *${a.service_type}*:\n📅 *Fecha:* ${formattedDate}\n⏰ *Hora:* ${formattedTime}\n📍 *Lugar:* ${a.address} (${a.zone})\n🛠️ *Técnico:* ${techName}\n\nSi necesita reprogramar o tiene alguna instrucción especial de acceso, por favor responda a este mensaje.\n\n_HIDROSYS EC. • Agua, Gas y Conducción Hidráulica_`;
        } else if (templateKey === 'done') {
            msg = `*HIDROSYS EC. - Servicio Técnico Concluido* 🏁\n\nEstimado/a *${a.client_name}*, le confirmamos que el trabajo de *${a.service_type}* ha finalizado satisfactoriamente.\n🛠️ *Técnico Responsable:* ${techName}\n💵 *Monto Total:* $${amount}\n\n¡Agradecemos su confianza en HIDROSYS EC.! En breve recibirá una breve encuesta para calificar la atención recibida. ⭐`;
        }

        const waUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(msg)}`;
        window.open(waUrl, '_blank');
        toast(`📲 Mensaje de WhatsApp preparado para ${a.client_name}`, 'success');
    } catch (err) {
        toast(`Error al generar mensaje de WhatsApp: ${err.message}`, 'error');
    }
}

// ============================================================
// 2. FICHA DEL CLIENTE 360° (HISTORIAL TÉCNICO Y EQUIPOS)
// ============================================================
async function openClient360(clientId, clientPhone) {
    try {
        const [clients, apts] = await Promise.all([
            api('GET', '/clients'),
            api('GET', '/appointments?limit=200')
        ]);

        const client = clients.find(c => c.id == clientId || (clientPhone && c.phone === clientPhone));
        if (!client) { toast('No se encontró información del cliente.', 'warning'); return; }

        // Filtrar citas de este cliente
        const clientApts = apts.filter(a => a.client_phone === client.phone || (client.name && a.client_name.toLowerCase() === client.name.toLowerCase()));
        clientApts.sort((a, b) => new Date(b.apt_date) - new Date(a.apt_date));

        const totalSpent = clientApts.reduce((acc, curr) => acc + (parseFloat(curr.payment_amount) || 0), 0);
        const totalVisits = clientApts.length;

        const modal = document.getElementById('client-360-modal');
        const content = document.getElementById('client-360-content');

        content.innerHTML = `
            <!-- Resumen Superior del Cliente -->
            <div style="display:grid; grid-template-columns: 1.2fr 1fr; gap:16px; margin-bottom:20px;">
                <div style="background:var(--gray-50); border:1px solid var(--gray-200); border-radius:10px; padding:16px;">
                    <div style="font-size:1.1rem; font-weight:800; color:var(--blue-800); margin-bottom:6px;">${client.name}</div>
                    <div style="font-size:0.84rem; color:var(--gray-600); line-height:1.6;">
                        <div>📞 <strong>Teléfono:</strong> <a href="https://wa.me/${client.phone.replace(/\D/g,'')}" target="_blank" style="color:var(--blue-600); text-decoration:none;">${client.phone}</a></div>
                        <div>📧 <strong>Correo:</strong> ${client.email || 'No registrado'}</div>
                        <div>📍 <strong>Dirección:</strong> ${client.address || '—'} (${client.zone || 'Cañar'})</div>
                    </div>
                </div>

                <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px;">
                    <div style="background:linear-gradient(135deg,#eff6ff,#dbeafe); border:1px solid #bfdbfe; border-radius:10px; padding:12px; text-align:center;">
                        <div style="font-size:0.75rem; font-weight:700; color:var(--blue-700); text-transform:uppercase;">Total Visitas</div>
                        <div style="font-size:1.6rem; font-weight:800; font-family:'Outfit',sans-serif; color:var(--blue-900); margin-top:2px;">${totalVisits}</div>
                    </div>
                    <div style="background:linear-gradient(135deg,#f0fdf4,#dcfce7); border:1px solid #bbf7d0; border-radius:10px; padding:12px; text-align:center;">
                        <div style="font-size:0.75rem; font-weight:700; color:#166534; text-transform:uppercase;">Facturación Acum.</div>
                        <div style="font-size:1.6rem; font-weight:800; font-family:'Outfit',sans-serif; color:#14532d; margin-top:2px;">$${totalSpent.toFixed(2)}</div>
                    </div>
                </div>
            </div>

            <!-- Notas Técnicas y Registro de Equipos -->
            <div style="background:#fffbeb; border:1.5px solid #fef3c7; border-radius:10px; padding:16px; margin-bottom:20px;">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                    <div style="font-weight:700; font-size:0.88rem; color:#92400e; display:flex; align-items:center; gap:6px;">
                        <span>⚙️</span> Ficha Técnica de Equipos & Instalaciones del Cliente
                    </div>
                    <button class="btn btn-primary btn-xs" onclick="saveClientTechNotes(${client.id})" style="background:#d97706; border-color:#d97706;">
                        💾 Guardar Notas Técnicas
                    </button>
                </div>
                <p style="font-size:0.75rem; color:#b45309; margin-bottom:8px;">
                    Anote detalles clave de los equipos para que cualquier técnico sepa qué bomba o presostato tiene antes de ir (ej: Bomba Pedrollo 1HP, Tanque Varem 100L, Presostato 30-50 PSI, Cisterna subterránea).
                </p>
                <textarea id="client-tech-notes-input" class="form-control" rows="3" placeholder="Escriba aquí los equipos instalados, marcas, calibres y observaciones técnicas del inmueble...">${client.notes || ''}</textarea>
            </div>

            <!-- Historial Cronológico de Citas -->
            <div>
                <div style="font-weight:800; font-size:0.92rem; color:var(--gray-800); margin-bottom:10px; text-transform:uppercase; letter-spacing:0.5px;">
                    📅 Historial de Visitas Técnicas (${clientApts.length})
                </div>
                ${clientApts.length ? `
                    <div class="table-wrapper" style="max-height:280px; overflow-y:auto; border:1px solid var(--gray-200); border-radius:8px;">
                        <table class="data-table" style="font-size:0.82rem;">
                            <thead>
                                <tr>
                                    <th>Fecha</th>
                                    <th>Servicio</th>
                                    <th>Técnico</th>
                                    <th>Estado</th>
                                    <th>Monto</th>
                                    <th>Acción</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${clientApts.map(a => `
                                    <tr>
                                        <td><strong>${formatDate(a.apt_date)}</strong> <span style="font-size:0.72rem; color:var(--gray-500);">${String(a.apt_time||'').slice(0,5)}</span></td>
                                        <td>${a.service_type}</td>
                                        <td>${a.tech_name || '—'}</td>
                                        <td>${statusBadge(a.status)}</td>
                                        <td><strong>$${parseFloat(a.payment_amount||0).toFixed(2)}</strong></td>
                                        <td>
                                            <button class="btn btn-ghost btn-xs" onclick="showTechReport(${a.id})" title="Ver informe técnico">📄 Informe</button>
                                        </td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                ` : `
                    <div style="text-align:center; padding:24px; background:var(--gray-50); border-radius:8px; color:var(--gray-500); font-size:0.85rem;">
                        No hay citas previas registradas para este cliente.
                    </div>
                `}
            </div>
        `;

        modal.classList.add('open');
    } catch (err) {
        toast(`Error al abrir ficha 360°: ${err.message}`, 'error');
    }
}

async function saveClientTechNotes(clientId) {
    const notes = document.getElementById('client-tech-notes-input')?.value;
    try {
        await api('PUT', `/clients/${clientId}`, { notes });
        toast('✅ Notas técnicas del cliente guardadas con éxito.', 'success');
        loadClients();
    } catch (err) {
        toast(`Error al guardar notas: ${err.message}`, 'error');
    }
}

// ============================================================
// 3. GENERADOR DE PROFORMAS / COTIZACIONES EXPRESS EN PDF
// ============================================================
let quoterItems = [];
let quoterCatalogCache = [];

async function openQuoterModal(clientPrefill = null) {
    try {
        if (!quoterCatalogCache.length) {
            quoterCatalogCache = await api('GET', '/products');
        }

        quoterItems = [];
        const nameInput = document.getElementById('quote-client-name');
        const phoneInput = document.getElementById('quote-client-phone');
        const zoneInput = document.getElementById('quote-client-zone');

        if (clientPrefill) {
            if (nameInput) nameInput.value = clientPrefill.name || '';
            if (phoneInput) phoneInput.value = clientPrefill.phone || '';
            if (zoneInput) zoneInput.value = clientPrefill.zone || '';
        } else {
            if (nameInput) nameInput.value = '';
            if (phoneInput) phoneInput.value = '';
            if (zoneInput) zoneInput.value = 'Azogues';
        }

        // Agregar 2 ítems por defecto
        addQuoterCustomItem('Kit de Mantenimiento & Calibración de Bomba', 1, 35.00);
        renderQuoterTable();
        calcQuoterTotals();

        document.getElementById('quoter-modal')?.classList.add('open');
    } catch (err) {
        toast(`Error al abrir cotizador: ${err.message}`, 'error');
    }
}

async function openQuoterForApt(aptId) {
    try {
        const apts = await api('GET', '/appointments?limit=100');
        const a = apts.find(x => x.id == aptId);
        if (a) {
            openQuoterModal({ name: a.client_name, phone: a.client_phone, zone: a.zone });
        } else {
            openQuoterModal();
        }
    } catch (err) { openQuoterModal(); }
}

function addQuoterCustomItem(name = '', qty = 1, price = 0) {
    quoterItems.push({
        id: Date.now() + Math.random(),
        description: name || 'Repuesto / Accesorio Hidráulico',
        quantity: qty,
        price: parseFloat(price) || 0
    });
    renderQuoterTable();
    calcQuoterTotals();
}

function addQuoterCatalogItem() {
    if (!quoterCatalogCache.length) {
        addQuoterCustomItem();
        return;
    }
    const p = quoterCatalogCache[Math.floor(Math.random() * quoterCatalogCache.length)] || quoterCatalogCache[0];
    quoterItems.push({
        id: Date.now() + Math.random(),
        description: `${p.name} (${p.category})`,
        quantity: 1,
        price: parseFloat(p.price) || 0
    });
    renderQuoterTable();
    calcQuoterTotals();
}

function removeQuoterItem(itemId) {
    quoterItems = quoterItems.filter(i => i.id != itemId);
    renderQuoterTable();
    calcQuoterTotals();
}

function updateQuoterItem(itemId, field, value) {
    const item = quoterItems.find(i => i.id == itemId);
    if (!item) return;
    if (field === 'description') item.description = value;
    if (field === 'quantity') item.quantity = Math.max(1, parseInt(value) || 1);
    if (field === 'price') item.price = Math.max(0, parseFloat(value) || 0);
    renderQuoterTable();
    calcQuoterTotals();
}

function renderQuoterTable() {
    const tbody = document.getElementById('quote-items-tbody');
    if (!tbody) return;

    if (!quoterItems.length) {
        tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding:16px; color:var(--gray-400);">No hay repuestos añadidos. Haga clic en "+ Ítem Personalizado" o "Desde Catálogo".</td></tr>`;
        return;
    }

    tbody.innerHTML = quoterItems.map(item => `
        <tr>
            <td>
                <input type="text" class="form-control form-control-sm" value="${item.description.replace(/"/g, '&quot;')}" oninput="updateQuoterItem(${item.id}, 'description', this.value)" style="font-size:0.82rem; padding:4px 8px;">
            </td>
            <td style="text-align:center;">
                <input type="number" class="form-control form-control-sm" value="${item.quantity}" min="1" oninput="updateQuoterItem(${item.id}, 'quantity', this.value)" style="font-size:0.82rem; padding:4px 6px; text-align:center; width:65px; margin:0 auto;">
            </td>
            <td style="text-align:right;">
                <input type="number" class="form-control form-control-sm" value="${item.price.toFixed(2)}" step="0.50" min="0" oninput="updateQuoterItem(${item.id}, 'price', this.value)" style="font-size:0.82rem; padding:4px 6px; text-align:right; width:85px; margin-left:auto;">
            </td>
            <td style="text-align:right; font-weight:700; color:var(--gray-800);">
                $${(item.quantity * item.price).toFixed(2)}
            </td>
            <td style="text-align:center;">
                <button class="btn btn-xs" style="background:var(--red-bg,#fee2e2); color:var(--red,#ef4444); border:none; padding:3px 7px;" onclick="removeQuoterItem(${item.id})" title="Eliminar ítem">🗑️</button>
            </td>
        </tr>
    `).join('');
}

function calcQuoterTotals() {
    const subtotalItems = quoterItems.reduce((acc, curr) => acc + (curr.quantity * curr.price), 0);
    const laborCost = parseFloat(document.getElementById('quote-labor-cost')?.value) || 0;
    const subtotalNeto = subtotalItems + laborCost;
    const iva = subtotalNeto * 0.15;
    const total = subtotalNeto + iva;

    const elSubItems = document.getElementById('quote-subtotal-items');
    const elSubLabor = document.getElementById('quote-subtotal-labor');
    const elIva = document.getElementById('quote-iva');
    const elTotal = document.getElementById('quote-total');

    if (elSubItems) elSubItems.textContent = `$${subtotalItems.toFixed(2)}`;
    if (elSubLabor) elSubLabor.textContent = `$${laborCost.toFixed(2)}`;
    if (elIva) elIva.textContent = `$${iva.toFixed(2)}`;
    if (elTotal) elTotal.textContent = `$${total.toFixed(2)}`;

    return { subtotalItems, laborCost, subtotalNeto, iva, total };
}

function printOfficialQuote() {
    const clientName = document.getElementById('quote-client-name')?.value || 'Cliente General';
    const clientPhone = document.getElementById('quote-client-phone')?.value || '—';
    const clientZone = document.getElementById('quote-client-zone')?.value || 'Cañar / Azogues';
    const laborDesc = document.getElementById('quote-labor-desc')?.value || 'Mano de obra técnica especializada';
    const totals = calcQuoterTotals();

    const quoteNo = `PRO-${new Date().getFullYear()}-${String(Math.floor(Math.random()*9000)+1000)}`;
    const today = new Date().toLocaleDateString('es-EC', { year:'numeric', month:'long', day:'numeric' });

    const printWin = window.open('', '_blank');
    printWin.document.write(`
        <!DOCTYPE html>
        <html lang="es">
        <head>
            <meta charset="UTF-8">
            <title>Proforma Oficial HIDROSYS EC - ${quoteNo}</title>
            <style>
                @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Outfit:wght@600;700;800&display=swap');
                body { font-family: 'Inter', sans-serif; color: #0f172a; padding: 40px 48px; margin: 0; font-size: 13px; line-height: 1.5; }
                .header-wrapper { display: flex; justify-content: space-between; align-items: center; border-bottom: 3px solid #0284c7; padding-bottom: 18px; margin-bottom: 24px; }
                .brand-flex { display: flex; align-items: center; gap: 16px; }
                .brand-logo { width: 62px; height: 62px; object-fit: contain; border-radius: 12px; }
                .brand-text h1 { font-family: 'Outfit', sans-serif; font-size: 24px; color: #0f172a; margin: 0; font-weight: 800; letter-spacing: -0.5px; }
                .brand-text p { margin: 2px 0; color: #64748b; font-size: 11.5px; font-weight: 500; }
                .quote-badge-box { text-align: right; background: #f0f9ff; border: 1.5px solid #bae6fd; border-radius: 10px; padding: 12px 18px; }
                .quote-badge-box h2 { font-family: 'Outfit', sans-serif; font-size: 16px; color: #0284c7; margin: 0 0 4px 0; font-weight: 800; }
                .quote-badge-box div { font-size: 11.5px; color: #334155; }
                
                .client-box { background: #f8fafc; border: 1.5px solid #e2e8f0; border-radius: 10px; padding: 16px 20px; margin-bottom: 24px; display: grid; grid-template-columns: 1.2fr 1fr; gap: 12px; }
                .client-box div { font-size: 12.5px; }
                .client-box strong { color: #1e293b; }
                
                table { width: 100%; border-collapse: collapse; margin-bottom: 24px; }
                th { background: #0f172a; color: white; padding: 10px 14px; text-align: left; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; font-family: 'Outfit', sans-serif; }
                td { padding: 11px 14px; border-bottom: 1px solid #e2e8f0; font-size: 12.5px; }
                tr:nth-child(even) td { background: #f8fafc; }
                
                .totals-container { display: flex; justify-content: flex-end; margin-bottom: 30px; }
                .totals-box { width: 300px; background: linear-gradient(135deg, #f0f9ff, #e0f2fe); border: 1.5px solid #7dd3fc; border-radius: 10px; padding: 14px 18px; }
                .totals-row { display: flex; justify-content: space-between; margin-bottom: 6px; font-size: 12.5px; color: #334155; }
                .totals-row.total { font-family: 'Outfit', sans-serif; font-size: 17px; font-weight: 800; color: #0369a1; border-top: 2px dashed #38bdf8; padding-top: 8px; margin-top: 8px; }
                
                .notes-box { font-size: 11px; color: #64748b; border-top: 1.5px solid #e2e8f0; padding-top: 16px; line-height: 1.6; }
                .notes-box strong { color: #0f172a; }
                .signature-area { margin-top: 36px; display: flex; justify-content: space-between; padding: 0 40px; }
                .sig-box { text-align: center; border-top: 1px solid #94a3b8; width: 200px; padding-top: 6px; font-size: 11px; color: #475569; }
            </style>
        </head>
        <body>
            <div class="header-wrapper">
                <div class="brand-flex">
                    <img src="/img/hidrosys_logo.png" alt="HIDROSYS EC" class="brand-logo" onerror="this.style.display='none'">
                    <div class="brand-text">
                        <h1>HIDROSYS EC.</h1>
                        <p>Sistemas, Equipos y Soluciones Hidráulicas &bull; RUC: 1793000000001</p>
                        <p>Azogues, Cañar, Ecuador &bull; Tel: +593 96 824 5633 &bull; info@hidrosys.ec</p>
                    </div>
                </div>
                <div class="quote-badge-box">
                    <h2>PROFORMA OFICIAL</h2>
                    <div><strong>N°:</strong> ${quoteNo}</div>
                    <div><strong>Fecha:</strong> ${today}</div>
                    <div><strong>Validez:</strong> 15 días calendario</div>
                </div>
            </div>

            <div class="client-box">
                <div><strong>Cliente / Empresa:</strong> ${clientName}</div>
                <div><strong>Teléfono WhatsApp:</strong> ${clientPhone}</div>
                <div><strong>Ubicación del Inmueble:</strong> ${clientZone}</div>
                <div><strong>Moneda de Facturación:</strong> Dólares Americanos (USD)</div>
            </div>

            <table>
                <thead>
                    <tr>
                        <th>Descripción del Repuesto / Servicio Técnico</th>
                        <th style="text-align:center; width:65px;">Cant.</th>
                        <th style="text-align:right; width:95px;">P. Unit</th>
                        <th style="text-align:right; width:95px;">Subtotal</th>
                    </tr>
                </thead>
                <tbody>
                    ${quoterItems.map(item => `
                        <tr>
                            <td><strong>${item.description}</strong></td>
                            <td style="text-align:center;">${item.quantity}</td>
                            <td style="text-align:right;">$${item.price.toFixed(2)}</td>
                            <td style="text-align:right; font-weight:700;">$${(item.quantity * item.price).toFixed(2)}</td>
                        </tr>
                    `).join('')}
                    <tr>
                        <td><strong>${laborDesc}</strong></td>
                        <td style="text-align:center;">1</td>
                        <td style="text-align:right;">$${totals.laborCost.toFixed(2)}</td>
                        <td style="text-align:right; font-weight:700;">$${totals.laborCost.toFixed(2)}</td>
                    </tr>
                </tbody>
            </table>

            <div class="totals-container">
                <div class="totals-box">
                    <div class="totals-row"><span>Subtotal Materiales:</span> <strong>$${totals.subtotalItems.toFixed(2)}</strong></div>
                    <div class="totals-row"><span>Mano de Obra Calificada:</span> <strong>$${totals.laborCost.toFixed(2)}</strong></div>
                    <div class="totals-row"><span>IVA Vigente (15%):</span> <strong>$${totals.iva.toFixed(2)}</strong></div>
                    <div class="totals-row total"><span>TOTAL GENERAL:</span> <span>$${totals.total.toFixed(2)}</span></div>
                </div>
            </div>

            <div class="notes-box">
                <strong>Términos & Condiciones Comerciales:</strong>
                <ul>
                    <li>Garantía de 1 año en equipos hidroneumáticos, bombas y accesorios suministrados.</li>
                    <li>Garantía de 6 meses en trabajos de instalación y mano de obra calificada.</li>
                    <li>Depósitos o transferencias a las cuentas oficiales de HIDROSYS EC. (Banco Pichincha / Guayaquil / Produbanco).</li>
                    <li>Para autorizar esta proforma, responda al WhatsApp corporativo: <strong>+593 96 824 5633</strong>.</li>
                </ul>
            </div>

            <div class="signature-area">
                <div class="sig-box">Departamento Técnico HIDROSYS</div>
                <div class="sig-box">Aceptación del Cliente</div>
            </div>

            <script>window.onload = function() { window.print(); };</script>
        </body>
        </html>
    `);
    printWin.document.close();
}

function sendQuoteViaWA() {
    const clientName = document.getElementById('quote-client-name')?.value || 'Cliente';
    let clientPhone = document.getElementById('quote-client-phone')?.value || '';
    const totals = calcQuoterTotals();

    cleanPhone = clientPhone.replace(/\D/g, '');
    if (cleanPhone.startsWith('0')) cleanPhone = '593' + cleanPhone.substring(1);
    if (!cleanPhone.startsWith('593')) cleanPhone = '593' + cleanPhone;

    let itemsText = quoterItems.map((item, idx) => `  ${idx+1}. ${item.description} (x${item.quantity}) - *$${(item.quantity * item.price).toFixed(2)}*`).join('\n');

    const msg = `*HIDROSYS EC. - Cotización Formal* 📄\n\nEstimado/a *${clientName}*, le enviamos el detalle de su cotización solicitada:\n\n*MATERIALES Y REPUESTOS:*\n${itemsText}\n\n🛠️ *Mano de Obra Especializada:* $${totals.laborCost.toFixed(2)}\n📊 *IVA (15%):* $${totals.iva.toFixed(2)}\n\n💰 *TOTAL A PAGAR:* *$${totals.total.toFixed(2)} USD*\n\n_Validez de proforma: 15 días. Garantía de servicio incluida._\n\n¿Desea que agendemos la instalación para esta semana?`;

    const waUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(msg)}`;
    window.open(waUrl, '_blank');
    toast('📲 Cotización enviada a WhatsApp.', 'success');
}

// ============================================================
// 4. EXPORTADOR A EXCEL / CSV EN 1 CLIC (REPORTES EMPRESARIALES)
// ============================================================
async function exportAppointmentsToCSV() {
    try {
        toast('Generando reporte Excel de Citas...', 'info');
        const apts = await api('GET', '/appointments?limit=1000');
        if (!apts.length) { toast('No hay citas para exportar.', 'warning'); return; }

        const todayStr = new Date().toISOString().slice(0, 10);
        const metaHeader = [
            `"HIDROSYS EC. - REPORTE OFICIAL DE VISITAS TÉCNICAS Y CITAS"`,
            `"Fecha de Generación: ${todayStr}"`,
            `"RUC: 1793000000001 - Azogues, Cañar, Ecuador"`,
            `""`
        ].join('\r\n');

        const headers = ['ID Cita', 'Fecha', 'Hora', 'Cliente', 'Telefono', 'Correo', 'Direccion', 'Canton_Zona', 'Servicio', 'Tecnico Asignado', 'Estado', 'Monto_USD', 'Estado_Pago', 'Banco', 'No_Comprobante', 'Canal_Origen', 'Notas'];

        const rows = apts.map(a => [
            a.id,
            formatDate(a.apt_date),
            String(a.apt_time || '').slice(0, 5),
            `"${(a.client_name || '').replace(/"/g, '""')}"`,
            `"${a.client_phone || ''}"`,
            `"${a.client_email || ''}"`,
            `"${(a.address || '').replace(/"/g, '""')}"`,
            `"${a.zone || ''}"`,
            `"${(a.service_type || '').replace(/"/g, '""')}"`,
            `"${(a.tech_name || 'Sin Asignar').replace(/"/g, '""')}"`,
            `"${a.status || ''}"`,
            parseFloat(a.payment_amount || 0).toFixed(2),
            `"${a.payment_status || ''}"`,
            `"${a.bank || ''}"`,
            `"${a.receipt_no || ''}"`,
            `"${a.channel || ''}"`,
            `"${(a.notes || '').replace(/"/g, '""')}"`
        ]);

        const csvContent = '\uFEFF' + metaHeader + '\r\n' + [headers.join(','), ...rows.map(r => r.join(','))].join('\r\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Reporte_Citas_Hidrosys_EC_${todayStr}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        toast('✅ Reporte Excel descargado exitosamente.', 'success');
    } catch (err) {
        toast(`Error al exportar citas: ${err.message}`, 'error');
    }
}

async function exportClientsToCSV() {
    try {
        toast('Generando directorio Excel de Clientes...', 'info');
        const clients = await api('GET', '/clients');
        if (!clients.length) { toast('No hay clientes para exportar.', 'warning'); return; }

        const todayStr = new Date().toISOString().slice(0, 10);
        const metaHeader = [
            `"HIDROSYS EC. - DIRECTORIO OFICIAL DE CLIENTES Y EQUIPOS"`,
            `"Fecha de Generación: ${todayStr}"`,
            `"RUC: 1793000000001 - Azogues, Cañar, Ecuador"`,
            `""`
        ].join('\r\n');

        const headers = ['ID Cliente', 'Cedula', 'Nombre', 'Telefono', 'Correo', 'Direccion', 'Canton_Zona', 'Total_Visitas', 'Ultimo_Servicio', 'Notas_Tecnicas_Equipos'];

        const rows = clients.map(c => [
            c.id,
            `"${c.cedula || ''}"`,
            `"${(c.name || '').replace(/"/g, '""')}"`,
            `"${c.phone || ''}"`,
            `"${c.email || ''}"`,
            `"${(c.address || '').replace(/"/g, '""')}"`,
            `"${c.zone || ''}"`,
            c.total_appointments || 0,
            c.last_service_date ? formatDate(c.last_service_date) : '—',
            `"${(c.notes || '').replace(/"/g, '""')}"`
        ]);

        const csvContent = '\uFEFF' + metaHeader + '\r\n' + [headers.join(','), ...rows.map(r => r.join(','))].join('\r\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Directorio_Clientes_Hidrosys_EC_${todayStr}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        toast('✅ Directorio de clientes descargado en Excel.', 'success');
    } catch (err) {
        toast(`Error al exportar clientes: ${err.message}`, 'error');
    }
}

// Exponer funciones globales
window.sendQuickWAMsg = sendQuickWAMsg;
window.openClient360 = openClient360;
window.saveClientTechNotes = saveClientTechNotes;
window.openQuoterModal = openQuoterModal;
window.openQuoterForApt = openQuoterForApt;
window.addQuoterCustomItem = addQuoterCustomItem;
window.addQuoterCatalogItem = addQuoterCatalogItem;
window.removeQuoterItem = removeQuoterItem;
window.updateQuoterItem = updateQuoterItem;
window.calcQuoterTotals = calcQuoterTotals;
window.printOfficialQuote = printOfficialQuote;
window.sendQuoteViaWA = sendQuoteViaWA;
window.exportAppointmentsToCSV = exportAppointmentsToCSV;
window.exportClientsToCSV = exportClientsToCSV;
window.requestCedulaOtp = requestCedulaOtp;
window.verifyCedulaOtp = verifyCedulaOtp;
window.resetCedulaLookup = resetCedulaLookup;
window.filterSurveysByTech = filterSurveysByTech;
window.prefillPaymentForApt = prefillPaymentForApt;
window.lookupPendingPaymentApts = lookupPendingPaymentApts;
window.lookupCompletedSurveys = lookupCompletedSurveys;


