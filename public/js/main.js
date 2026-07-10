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

    // Date min
    const dateInput = document.getElementById('bk-date');
    if (dateInput) dateInput.min = new Date().toISOString().split('T')[0];
});

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
    'admin-clients':       ['Clientes Activos', 'Base de datos de clientes'],
    'admin-leads':         ['Prospectos', 'Solicitudes de proyectos'],
    'admin-surveys':       ['Satisfacción', 'Encuestas de calidad del servicio'],
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
        'admin-dashboard':    loadDashboard,
        'catalog':            loadProducts,
        'admin-appointments': loadAppointments,
        'admin-clients':      loadClients,
        'admin-leads':        loadLeads,
        'admin-surveys':      loadSurveys,
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
// DASHBOARD
// ============================================================
async function loadDashboard() {
    try {
        const stats = await api('GET', '/stats');

        document.getElementById('stat-total').textContent     = stats.totalCitas;
        document.getElementById('stat-pending').textContent   = stats.citasPendientes;
        document.getElementById('stat-confirmed').textContent = stats.citasConfirmadas;
        document.getElementById('stat-revenue').textContent   = `$${stats.ingresosMes.toFixed(2)}`;
        document.getElementById('stat-clients').textContent   = stats.totalClientes;
        document.getElementById('stat-leads').textContent     = stats.leadsNuevos;

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
        toast(`Error al cargar el dashboard: ${err.message}`, 'error');
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
        if (!document.getElementById('bk-date').value) { toast('Seleccione la fecha de la cita.', 'warning'); return false; }
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
            };
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
            toast(`✅ ¡Cita pre-agendada en la base de datos! ID: ${created.id}`, 'success', 6000);
            sendWAMsg('system', `*HIDROSYS – Cita Registrada (Pre-agendada)* 💧\n\nHola *${data.clientName}*, tu cita quedó pre-agendada para el *${formatDate(data.aptDate)}* a las *${data.aptTime}* (${data.zone}).\n\n⚠️ *IMPORTANTE:* Tu turno está *Pre-agendado* y solo se confirmará una vez que realices la transferencia por el valor de tu servicio y reportes tu comprobante.\n\n${bankList}\n\n*Titular:* HIDROSYS EC. (RUC: 1793000000001)\n\nUna vez reportado, procederemos a asignarte un técnico y confirmar tu turno.`);
            form.reset();
            document.getElementById('bk-canton').value = '';
            document.getElementById('bk-parish').innerHTML = '<option value="">— Seleccione Parroquia —</option>';
            wzGo(1);
            loadPaymentDropdown();
            loadDashboard();
        } catch (err) {
            toast(`Error al registrar: ${err.message}`, 'error');
        } finally {
            btn.disabled = false; btn.textContent = '✅ Confirmar y Registrar Cita';
        }
    });
}

// ============================================================
// PAGOS
// ============================================================
async function loadPaymentDropdown() {
    const sel = document.getElementById('pay-apt-select');
    if (!sel) return;
    try {
        const apts = await api('GET', '/appointments?status=Pre-agendado');
        const pending = apts.filter(a => !a.receipt_no);
        sel.innerHTML = pending.length
            ? pending.map(a => `<option value="${a.id}">${a.service_type} – ${formatDate(a.apt_date)} – ${a.client_name}</option>`).join('')
            : '<option value="">Sin citas pendientes de pago</option>';
    } catch { sel.innerHTML = '<option value="">Error al cargar</option>'; }
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
        if (!aptId)      { toast('Selecciona una cita.', 'warning'); return; }
        if (!selectedBank) { toast('Selecciona el banco.', 'warning'); return; }
        if (!receiptNo)  { toast('Ingresa el número de transferencia.', 'warning'); return; }

        try {
            await api('PUT', `/appointments/${aptId}`, {
                bank: selectedBank, receiptNo,
                receiptImg: fileInput?.files[0]?.name || '',
            });
            toast('Reporte de pago enviado. El administrador lo validará pronto.', 'success');
            sendWAMsg('system', `*HIDROSYS – Pago Reportado* 📝\nHemos registrado tu transferencia *Nº ${receiptNo}* en *${selectedBank}*.\n\nUn asesor validará y confirmará tu cita en breve.`);
            form.reset();
            uploadArea?.classList.remove('has-file');
            if (uploadArea) uploadArea.querySelector('.file-upload-text').innerHTML = 'Clic para subir imagen<br><small>JPG, PNG, PDF</small>';
            document.querySelectorAll('.bank-card').forEach(c => c.classList.remove('selected'));
            selectedBank = '';
        } catch (err) {
            toast(`Error: ${err.message}`, 'error');
        }
    });
}

// ============================================================
// ENCUESTAS
// ============================================================
async function loadSurveyDropdown() {
    const sel = document.getElementById('survey-apt-select');
    if (!sel) return;
    try {
        const apts = await api('GET', '/appointments?status=Terminado');
        const done = apts.filter(a => !a.survey_completed);
        sel.innerHTML = done.length
            ? done.map(a => `<option value="${a.id}" data-tech="${a.tech_name||'N/A'}" data-service="${a.service_type}" data-date="${a.apt_date}">${a.service_type} – ${formatDate(a.apt_date)} – ${a.client_name}</option>`).join('')
            : '<option value="">Sin visitas pendientes de calificar</option>';
        sel.dispatchEvent(new Event('change'));
    } catch { sel.innerHTML = '<option value="">Error al cargar</option>'; }
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
async function loadAppointments() {
    const container = document.getElementById('apt-cards-container');
    if (!container) return;
    const status = document.getElementById('apt-status-filter')?.value || '';
    const zone   = document.getElementById('apt-zone-filter')?.value || '';
    const q      = document.getElementById('apt-search')?.value || '';
    try {
        const apts = await api('GET', `/appointments?status=${encodeURIComponent(status)}&zone=${encodeURIComponent(zone)}&q=${encodeURIComponent(q)}`);
        const techs = await api('GET', '/technicians');

        container.innerHTML = apts.length ? apts.map(a => {
            const steps = ['Pre-agendado','Pagado','Confirmado','Conf. Cliente','Terminado'];
            const idx   = steps.findIndex(s => s.toLowerCase().includes(a.status?.toLowerCase().slice(0,6) || ''));
            const tlHtml = steps.map((s,i) => `<div class="tl-step ${i < idx ? 'past' : i === idx ? 'now' : ''}">${s}</div>`).join('');

            const stripeClass = a.status === 'Terminado' ? 'stripe-done' :
                               (a.status?.includes('Confirmado') ? 'stripe-confirmed' :
                               (a.receipt_no ? 'stripe-confirmed' : 'stripe-pre'));

            const techOptions = `<option value="">— Asignar técnico —</option>` +
                techs.map(t => `<option value="${t.id}" ${a.tech_id == t.id ? 'selected' : ''}>${t.avatar} ${t.name} (${t.zone})</option>`).join('');

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
                            ${a.receipt_no ? `
                                <div style="background:var(--gray-50);border:1px solid var(--gray-200);border-radius:6px;padding:8px 10px;margin-top:6px;font-size:0.78rem;">
                                    🏦 ${a.bank} · Nº ${a.receipt_no}
                                    <span class="badge ${payBadgeClass(a.payment_status)}" style="margin-left:5px;">${a.payment_status}</span>
                                </div>` : `<p style="font-size:0.78rem;color:var(--gray-400);">Sin reporte de pago.</p>`}
                        </div>
                        <div style="margin-top:12px;">
                            <label style="font-size:0.75rem;font-weight:600;color:var(--gray-500);display:block;margin-bottom:4px;">Técnico Asignado:</label>
                            <select class="form-control" style="font-size:0.82rem;padding:7px 10px;"
                                    onchange="assignTech(${a.id}, this.value)" ${a.status === 'Terminado' ? 'disabled' : ''}>
                                ${techOptions}
                            </select>
                        </div>
                    </div>
                    <div class="apt-card-footer">
                        ${a.receipt_no && a.payment_status === 'Pendiente' ? `<button class="btn btn-success btn-xs" onclick="approvePayment(${a.id},'${a.tech_id||''}')">✅ Aprobar Pago</button>` : ''}
                        ${a.status !== 'Terminado' ? `<button class="btn btn-ghost btn-xs" onclick="finishApt(${a.id})">🏁 Finalizar</button>` : ''}
                        <button class="btn btn-ghost btn-xs" onclick="showTechReport(${a.id})">📄 Informe</button>
                        <button class="btn btn-xs" style="background:var(--red-bg);color:var(--red);border:none;" onclick="deleteApt(${a.id})">🗑️</button>
                    </div>
                </div>
            `;
        }).join('') : '<div style="grid-column:1/-1;text-align:center;padding:40px;color:var(--gray-400);">No se encontraron citas.</div>';

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
        toast('Técnico asignado.', 'success');
    } catch (err) { toast(`Error: ${err.message}`, 'error'); }
}

async function approvePayment(aptId, currentTechId) {
    const card = document.getElementById(`apt-card-${aptId}`);
    const techSel = card?.querySelector('select');
    const techId = techSel?.value || currentTechId;
    if (!techId) { toast('Asigna un técnico antes de aprobar el pago.', 'warning'); return; }

    try {
        await api('PUT', `/appointments/${aptId}`, {
            paymentStatus: 'Pagado', status: 'Confirmado', techId: parseInt(techId),
        });
        // Obtener nombre del técnico
        const techs = await api('GET', '/technicians');
        const tech = techs.find(t => t.id == techId) || { name: 'Técnico Hidrosys', avatar: '👷' };

        toast('✅ Pago aprobado y cita confirmada.', 'success');

        // Notificar al cliente por WhatsApp REAL (si el bot está conectado)
        try {
            const waRes = await fetch(`${API}/api/wa/notify/${aptId}`, { method: 'POST' });
            const waData = await waRes.json();
            if (waData.sent) {
                toast('💬 Notificación enviada al cliente por WhatsApp.', 'success', 5000);
            }
        } catch (waErr) {
            // Bot no disponible — no interrumpir el flujo
            console.warn('WhatsApp bot no disponible para notificación.');
        }

        // Mantener mensaje en el simulador interno también
        sendWAMsg('system', `*HIDROSYS – Cita Confirmada* ✅\nTu transferencia fue verificada. Tu cita está confirmada:\n🛠️ Técnico: *${tech.name}*\n\n¿Confirmas tu asistencia?`, true, aptId);
        loadAppointments();
    } catch (err) { toast(`Error: ${err.message}`, 'error'); }
}

async function finishApt(aptId) {
    if (!confirm('¿Marcar esta visita como finalizada?')) return;
    try {
        await api('PUT', `/appointments/${aptId}`, { status: 'Terminado' });
        toast('Visita marcada como finalizada.', 'success');
        sendWAMsg('system', '🎉 *HIDROSYS – Servicio Completado*\nNuestra visita técnica fue finalizada. ¿Cómo nos calificarías? Ingresa a la plataforma para dejar tu evaluación.');
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
// ADMIN: CLIENTES
// ============================================================
async function loadClients() {
    const tbody = document.getElementById('clients-tbody');
    if (!tbody) return;
    const q = document.getElementById('cli-search')?.value || '';
    try {
        const clients = await api('GET', `/clients?q=${encodeURIComponent(q)}`);
        tbody.innerHTML = clients.length ? clients.map(c => `
            <tr>
                <td><strong>${c.name}</strong></td>
                <td>${c.phone}</td>
                <td>${c.email || '—'}</td>
                <td>${c.address || '—'}</td>
                <td>${c.zone || '—'}</td>
                <td style="text-align:center;"><span class="badge badge-blue">${c.total_appointments||0}</span></td>
                <td>${c.last_service_date ? formatDate(c.last_service_date) : '—'}</td>
            </tr>
        `).join('') : '<tr class="empty-row"><td colspan="7">Sin clientes registrados.</td></tr>';
    } catch (err) { toast(`Error: ${err.message}`, 'error'); }
}

// ============================================================
// ADMIN: LEADS
// ============================================================
async function loadLeads() {
    const container = document.getElementById('leads-cards-container');
    if (!container) return;
    try {
        const leads = await api('GET', '/leads');
        container.innerHTML = leads.length ? leads.map(l => `
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
        `).join('') : '<div style="grid-column:1/-1;text-align:center;padding:40px;color:var(--gray-400);">Sin prospectos registrados.</div>';
    } catch (err) { toast(`Error: ${err.message}`, 'error'); }
}

async function convertLead(id) {
    try {
        await api('POST', `/leads/${id}/convert`);
        toast('Prospecto convertido a cliente activo.', 'success');
        loadLeads(); loadClients(); loadDashboard();
    } catch (err) { toast(`Error: ${err.message}`, 'error'); }
}

// ============================================================
// ADMIN: ENCUESTAS
// ============================================================
async function loadSurveys() {
    const container = document.getElementById('surveys-container');
    if (!container) return;
    try {
        const surveys = await api('GET', '/surveys');
        const emojis = { 1:'😡',2:'🙁',3:'😐',4:'😊',5:'😍' };
        const labels = { 1:'Pésimo',2:'Malo',3:'Regular',4:'Bueno',5:'Excelente' };
        
        if (!surveys.length) {
            container.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:40px;color:var(--gray-400);">Sin encuestas recibidas.</div>';
            return;
        }

        // Agrupar calificaciones por técnico
        const techGroups = {};
        surveys.forEach(s => {
            const name = s.tech_name || 'Sin técnico asignado';
            if (!techGroups[name]) {
                techGroups[name] = {
                    sum: 0,
                    count: 0,
                    items: []
                };
            }
            techGroups[name].sum += s.rating;
            techGroups[name].count += 1;
            techGroups[name].items.push(s);
        });

        let html = `
            <!-- Panel resumen de técnicos -->
            <div class="card" style="grid-column:1/-1; margin-bottom:16px; background:var(--blue-50); border-color:var(--blue-100);">
                <div class="card-header" style="background:var(--blue-100); border-bottom-color:var(--blue-100);">
                    <span class="card-title" style="color:var(--blue-800); font-weight:700;">📈 Calificación Promedio del Personal Técnico</span>
                </div>
                <div class="card-body" style="display:flex; gap:16px; flex-wrap:wrap; padding:16px;">
        `;

        Object.entries(techGroups).forEach(([techName, data]) => {
            const avg = (data.sum / data.count).toFixed(2);
            let ratingColor = 'var(--gray-500)';
            if (avg >= 4.2) ratingColor = 'var(--green)';
            else if (avg >= 3.0) ratingColor = 'var(--yellow)';
            else if (avg > 0) ratingColor = 'var(--red)';

            html += `
                <div style="background:white; border:1.5px solid var(--gray-200); border-radius:var(--radius-sm); padding:10px 16px; flex:1; min-width:220px; display:flex; align-items:center; justify-content:space-between; box-shadow:var(--shadow-xs);">
                    <div>
                        <div style="font-weight:700; font-size:0.875rem; color:var(--gray-900);">${techName}</div>
                        <div style="font-size:0.75rem; color:var(--gray-500); margin-top:2px;">${data.count} encuesta${data.count != 1 ? 's' : ''}</div>
                    </div>
                    <div style="font-family:'Outfit',sans-serif; font-weight:800; font-size:1.4rem; color:${ratingColor};">${avg} <span style="font-size:0.8rem; font-weight:500; color:var(--gray-400);">/ 5</span></div>
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
                <div style="grid-column:1/-1; margin-top:20px; margin-bottom:10px; font-family:'Outfit',sans-serif; font-weight:700; font-size:1.05rem; color:var(--blue-800); border-left:4px solid var(--blue-700); padding-left:10px;">
                    Calificaciones para: ${techName} (${data.count})
                </div>
            `;

            data.items.forEach(s => {
                html += `
                    <div class="card" style="margin-bottom:12px;">
                        <div class="card-header">
                            <div>
                                <span class="card-title">${s.client_name || 'Cliente'}</span>
                                <div style="font-size:0.78rem;color:var(--gray-500);">${s.service_type || ''} · ${formatDate(s.apt_date || '')}</div>
                            </div>
                            <div style="font-size:1.5rem;" title="${labels[s.rating]||''}">${emojis[s.rating]||'?'}
                                <span style="font-size:0.8rem;font-family:'Outfit',sans-serif;font-weight:700;color:var(--gray-700);">${s.rating}/5</span>
                            </div>
                        </div>
                        <div class="card-body" style="font-size:0.875rem;">
                            <p style="font-style:italic;color:var(--gray-600);">"${s.comment || 'Sin comentarios.'}"</p>
                            ${s.audio_duration ? `
                                <div style="margin-top:10px;background:var(--blue-50);border:1px solid var(--blue-100);padding:8px 12px;border-radius:6px;font-size:0.8rem;">
                                    🎙️ Nota de voz registrada · Duración: ${s.audio_duration}
                                </div>` : ''}
                            <p style="font-size:0.72rem;color:var(--gray-400);margin-top:8px;">${new Date(s.created_at).toLocaleDateString('es-EC')}</p>
                        </div>
                    </div>
                `;
            });
        });

        container.innerHTML = html;
    } catch (err) { toast(`Error: ${err.message}`, 'error'); }
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
                </div>

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
    document.getElementById('wa-drawer').classList.toggle('open');
    document.getElementById('wa-unread-badge').style.display = 'none';
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
    if (!document.getElementById('wa-drawer').classList.contains('open') && sender !== 'client') {
        const badge = document.getElementById('wa-unread-badge');
        badge.style.display = 'flex';
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

    openBtn?.addEventListener('click', () => document.getElementById('wa-drawer').classList.add('open'));

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
        'Confirmado':            'badge-blue',
        'Confirmado por Cliente':'badge-green',
        'Terminado':             'badge-gray',
        'Nuevo':                 'badge-blue',
        'Convertido':            'badge-green',
    };
    return `<span class="badge ${map[status]||'badge-gray'}">${status||'—'}</span>`;
}
