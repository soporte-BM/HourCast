/**
 * HourCast - Interactive Web Application Logic
 * Professional Hours Projection & Profit Margin Calculation (10% - 20%)
 */

document.addEventListener('DOMContentLoaded', () => {
    // --- APP STATE ---
    let state = {
        items: [],
        perfiles: [],
        modoMargen: 'costo', // 'costo' (Markup) or 'venta' (Profit Margin)
        margenGlobal: 15.0,  // Default margin % (10 - 20)
        unidadEscala: 1,     // Default to Pesos ($ CLP)
        valorUF: 38850.0,    // Valor de la UF en Pesos CLP
        currentUser: null,   // Active authenticated user (@bmining.cl)
        currentProjectionId: null,
        profesionalesLista: [
            { nombre: "Rodrigo Poblete", perfil: "Consultor Senior", tarifa: 1.8 },
            { nombre: "Catalina Olivares", perfil: "Ingeniero Especialista", tarifa: 0.7 },
            { nombre: "Juan Pedreros", perfil: "Ingeniero Senior", tarifa: 1.1 },
            { nombre: "Amilcar Chavez", perfil: "Ingeniero", tarifa: 0.5 },
            { nombre: "Daniel Mesa", perfil: "Arquitecto de Software", tarifa: 1.8 },
            { nombre: "Carlos Gutiérrez", perfil: "Senior Developer", tarifa: 1.3 },
            { nombre: "Andrea Morales", perfil: "Project Manager (PM)", tarifa: 1.5 }
        ]
    };

    // Chart instances
    let distChart = null;
    let compareChart = null;

    // --- DOM ELEMENTS ---
    const tbody = document.getElementById('projection-tbody');
    const projectNameInput = document.getElementById('project-name');
    const clientNameInput = document.getElementById('client-name');
    const unitScaleSelect = document.getElementById('unit-scale-select');
    const globalMarginSlider = document.getElementById('global-margin-slider');
    const globalMarginDisplay = document.getElementById('global-margin-display');

    // KPI Elements
    const kpiTotalHours = document.getElementById('kpi-total-hours');
    const kpiTotalCost = document.getElementById('kpi-total-cost');
    const kpiTotalUtility = document.getElementById('kpi-total-utility');
    const kpiTotalPrice = document.getElementById('kpi-total-price');
    const kpiMarginBadge = document.getElementById('kpi-margin-badge');
    const itemCountLabel = document.getElementById('item-count-label');

    // Buttons & Gatekeeper Containers
    const btnAddProfessional = document.getElementById('btn-add-professional');
    const btnAddProfessionalMobile = document.getElementById('btn-add-professional-mobile');
    const btnClearItems = document.getElementById('btn-clear-items');
    const btnSaveProjection = document.getElementById('btn-save-projection');
    const btnExportCsv = document.getElementById('btn-export-csv');

    // Gatekeeper & Workspace Containers
    const gatekeeperView = document.getElementById('gatekeeper-view');
    const appWorkspace = document.getElementById('app-workspace');
    // Modals
    const modalProfiles = document.getElementById('modal-profiles');
    const modalAuth = document.getElementById('modal-auth');
    const modalLogs = document.getElementById('modal-logs');
    const btnViewLogs = document.getElementById('btn-view-logs');
    const profileListContainer = document.getElementById('profile-list-container');
    const formAddProfile = document.getElementById('form-add-profile');

    // Auth DOM Elements
    const authUserContainer = document.getElementById('auth-user-container');
    const tabBtnLogin = document.getElementById('tab-btn-login');
    const formLogin = document.getElementById('form-login');

    // Gatekeeper Wall Auth Elements
    const gkTabLogin = document.getElementById('gk-tab-login');
    const gkFormLogin = document.getElementById('gk-form-login');

    // Preset buttons
    const presetBtns = document.querySelectorAll('.preset-btn');

    // UF Elements
    const ufValueInput = document.getElementById('uf-value-input');
    const ufDateBadge = document.getElementById('uf-date-badge');
    const btnRefreshUf = document.getElementById('btn-refresh-uf');

    // --- INITIALIZATION ---
    initApp();

    async function initApp() {
        await checkAuthSession();
        await fetchLiveUF();
        await loadPerfiles();
        initCharts();
        bindEvents();

        addInitialDefaultRows();
        render();
    }

    async function checkAuthSession() {
        try {
            const res = await fetch('/api/auth/me');
            const data = await res.json();
            if (data.status === 'success' && data.user) {
                state.currentUser = data.user;
            } else {
                state.currentUser = null;
            }
            renderAuthHeader();
        } catch (err) {
            console.log('Error al verificar sesión de usuario');
        }
    }

    // --- 5-MINUTE INACTIVITY SESSION TIMEOUT ---
    const INACTIVITY_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes (300,000 ms)
    let inactivityTimer = null;

    function resetInactivityTimer() {
        if (inactivityTimer) clearTimeout(inactivityTimer);
        
        if (state.currentUser) {
            inactivityTimer = setTimeout(async () => {
                try {
                    await fetch('/api/auth/logout', { method: 'POST' });
                } catch (err) {}
                state.currentUser = null;
                renderAuthHeader();
                showToast('Sesión cerrada por inactividad (5 minutos sin uso)', 'warning');
            }, INACTIVITY_TIMEOUT_MS);
        }
    }

    ['mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart', 'click'].forEach(evt => {
        window.addEventListener(evt, () => {
            if (state.currentUser) {
                resetInactivityTimer();
            }
        }, { passive: true });
    });

    function initThemeSystem() {
        const savedTheme = localStorage.getItem('proyectabm_theme') || 'dark';
        applyTheme(savedTheme);

        const btnToggle = document.getElementById('btn-theme-toggle');
        const dropdown = document.getElementById('theme-dropdown');
        const themeOptions = document.querySelectorAll('.theme-option');

        if (btnToggle && dropdown) {
            btnToggle.addEventListener('click', (e) => {
                e.stopPropagation();
                dropdown.classList.toggle('active');
            });

            document.addEventListener('click', () => {
                dropdown.classList.remove('active');
            });
        }

        themeOptions.forEach(opt => {
            opt.addEventListener('click', (e) => {
                e.stopPropagation();
                const selectedTheme = opt.getAttribute('data-theme');
                applyTheme(selectedTheme);
                if (dropdown) dropdown.classList.remove('active');
                const names = { dark: 'Oscuro', light: 'Claro', sepia: 'Sepia' };
                showToast(`Tema cambiado a ${names[selectedTheme] || selectedTheme}`, 'info');
            });
        });
    }

    function applyTheme(theme) {
        document.documentElement.setAttribute('data-theme', theme);
        localStorage.setItem('proyectabm_theme', theme);

        const label = document.getElementById('theme-label');
        const themeOptions = document.querySelectorAll('.theme-option');

        const names = { dark: 'Oscuro', light: 'Claro', sepia: 'Sepia' };

        if (label) {
            label.textContent = names[theme] || 'Oscuro';
        }

        themeOptions.forEach(opt => {
            if (opt.getAttribute('data-theme') === theme) {
                opt.classList.add('active');
            } else {
                opt.classList.remove('active');
            }
        });
    }

    // Initialize Theme Immediately on load
    initThemeSystem();

    function renderAuthHeader() {
        if (state.currentUser) {
            resetInactivityTimer();
            // Auto fetch UF live value upon successful login or session restore
            fetchLiveUF();

            // SHOW WORKSPACE & HIDE LOGIN WALL
            if (gatekeeperView) gatekeeperView.style.display = 'none';
            if (appWorkspace) appWorkspace.style.display = 'block';

            if (btnManageProfiles) btnManageProfiles.style.display = 'inline-flex';
            if (btnViewLogs) btnViewLogs.style.display = 'inline-flex';
            if (btnExportCsv) btnExportCsv.style.display = 'inline-flex';
            if (btnSaveProjection) btnSaveProjection.style.display = 'inline-flex';

            const btnHeaderLogout = document.getElementById('btn-logout');
            if (btnHeaderLogout) btnHeaderLogout.style.display = 'inline-flex';

            if (authUserContainer) {
                authUserContainer.innerHTML = `
                    <div class="user-badge" title="Usuario Institucional Autenticado">
                        <i class="fa-solid fa-user-check"></i>
                        <span><strong>${escapeHtml(state.currentUser.nombre)}</strong> (${escapeHtml(state.currentUser.email)})</span>
                    </div>
                `;
            }
        } else {
            if (inactivityTimer) clearTimeout(inactivityTimer);
            // HIDE WORKSPACE & SHOW LOGIN WALL (ACCESS CONTROL GATEKEEPER)
            if (gatekeeperView) gatekeeperView.style.display = 'block';
            if (appWorkspace) appWorkspace.style.display = 'none';

            const btnHeaderLogout = document.getElementById('btn-logout');
            if (btnHeaderLogout) btnHeaderLogout.style.display = 'none';

            if (btnManageProfiles) btnManageProfiles.style.display = 'inline-flex';
            if (btnViewLogs) btnViewLogs.style.display = 'none';
            if (btnExportCsv) btnExportCsv.style.display = 'none';
            if (btnSaveProjection) btnSaveProjection.style.display = 'none';

            if (authUserContainer) authUserContainer.innerHTML = '';
        }
    }

    async function loadAuditLogs() {
        const tbodyLogs = document.getElementById('audit-logs-tbody');
        if (!tbodyLogs) return;
        tbodyLogs.innerHTML = '<tr><td colspan="4" style="text-align:center; padding:1.5rem; color:var(--text-muted);">Cargando registro de auditoría...</td></tr>';
        try {
            const res = await fetch('/api/logs');
            const data = await res.json();
            if (data.status === 'success' && data.data && data.data.length > 0) {
                let html = '';
                data.data.forEach(log => {
                    let badgeClass = 'badge-cyan';
                    if (log.accion === 'INICIO_SESION') badgeClass = 'badge-emerald';
                    else if (log.accion === 'CIERRE_SESION') badgeClass = 'badge-amber';
                    else if (log.accion === 'GUARDAR_PROYECCION') badgeClass = 'badge-cyan';
                    else if (log.accion === 'CREAR_PERFIL' || log.accion === 'CARGA_MASIVA_EXCEL') badgeClass = 'badge-purple';

                    const dateStr = log.fecha_registro ? log.fecha_registro.replace('T', ' ').substring(0, 19) : '-';
                    html += `
                        <tr>
                            <td><span style="font-size:0.78rem; color:var(--text-muted);">${escapeHtml(dateStr)}</span></td>
                            <td><strong>${escapeHtml(log.usuario_nombre || 'Usuario')}</strong><br><span style="font-size:0.75rem; color:var(--text-dim);">${escapeHtml(log.usuario_email || '')}</span></td>
                            <td><span class="badge ${badgeClass}">${escapeHtml(log.accion)}</span></td>
                            <td><span style="font-size:0.82rem; color:var(--text-main);">${escapeHtml(log.detalles || '')}</span></td>
                        </tr>
                    `;
                });
                tbodyLogs.innerHTML = html;
            } else {
                tbodyLogs.innerHTML = '<tr><td colspan="4" style="text-align:center; padding:1.5rem; color:var(--text-muted);">No hay registros de auditoría aún.</td></tr>';
            }
        } catch (err) {
            tbodyLogs.innerHTML = '<tr><td colspan="4" style="text-align:center; color:var(--rose); padding:1.5rem;">Error al obtener el historial de auditoría.</td></tr>';
        }
    }

    async function fetchLiveUF() {
        if (ufDateBadge) {
            ufDateBadge.textContent = 'Obteniendo...';
            ufDateBadge.className = 'badge badge-cyan';
        }
        
        let fetched = false;

        // Try mindicador.cl API direct from browser
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 3000);
            const res = await fetch('https://mindicador.cl/api', {
                signal: controller.signal,
                headers: { 'Accept': 'application/json' }
            });
            clearTimeout(timeoutId);
            const data = await res.json();
            if (data && data.uf && data.uf.valor) {
                state.valorUF = parseFloat(data.uf.valor);
                const ufFecha = data.uf.fecha ? data.uf.fecha.substring(0, 10) : 'Hoy';
                if (ufValueInput) ufValueInput.value = state.valorUF.toFixed(2);
                if (ufDateBadge) {
                    ufDateBadge.textContent = `${ufFecha} (mindicador.cl)`;
                    ufDateBadge.className = 'badge badge-emerald';
                }
                showToast(`UF de mindicador.cl: $${state.valorUF.toLocaleString('es-CL', {minimumFractionDigits:2, maximumFractionDigits:2})} CLP`, 'success');
                fetched = true;
            }
        } catch (e) {
            console.log('Cliente fetch mindicador.cl bloqueado o no disponible');
        }

        // Try mindicador.cl/api/uf direct
        if (!fetched) {
            try {
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 3000);
                const res = await fetch('https://mindicador.cl/api/uf', {
                    signal: controller.signal,
                    headers: { 'Accept': 'application/json' }
                });
                clearTimeout(timeoutId);
                const data = await res.json();
                if (data && data.serie && data.serie.length > 0) {
                    const latest = data.serie[0];
                    state.valorUF = parseFloat(latest.valor);
                    const ufFecha = latest.fecha ? latest.fecha.substring(0, 10) : 'Hoy';
                    if (ufValueInput) ufValueInput.value = state.valorUF.toFixed(2);
                    if (ufDateBadge) {
                        ufDateBadge.textContent = `${ufFecha} (mindicador.cl)`;
                        ufDateBadge.className = 'badge badge-emerald';
                    }
                    showToast(`UF de mindicador.cl/api/uf: $${state.valorUF.toLocaleString('es-CL', {minimumFractionDigits:2, maximumFractionDigits:2})} CLP`, 'success');
                    fetched = true;
                }
            } catch (e) {
                console.log('Cliente fetch mindicador.cl/api/uf bloqueado');
            }
        }

        // Try Backend endpoint /api/uf
        if (!fetched) {
            try {
                const res = await fetch('/api/uf');
                const data = await res.json();
                if (data && data.valor) {
                    state.valorUF = parseFloat(data.valor);
                    if (ufValueInput) ufValueInput.value = state.valorUF.toFixed(2);
                    if (ufDateBadge) {
                        ufDateBadge.textContent = `${data.fecha || 'Hoy'} (${data.origen || 'Servidor'})`;
                        ufDateBadge.className = 'badge badge-cyan';
                    }
                    fetched = true;
                }
            } catch (err) {
                console.log('Backend /api/uf no disponible');
            }
        }

        if (!fetched) {
            if (ufValueInput && parseFloat(ufValueInput.value)) {
                state.valorUF = parseFloat(ufValueInput.value);
            } else {
                state.valorUF = 38850.00;
                if (ufValueInput) ufValueInput.value = (38850.00).toFixed(2);
            }
            if (ufDateBadge) {
                ufDateBadge.textContent = 'UF Manual Editable';
                ufDateBadge.className = 'badge badge-amber';
            }
        }

        render();
    }

    // --- API CALLS ---
    async function loadPerfiles() {
        try {
            const res = await fetch('/api/perfiles');
            const data = await res.json();
            if (data.status === 'success') {
                state.perfiles = data.data;
                renderProfilesModalList();
            }
        } catch (err) {
            showToast('Error al cargar perfiles de costo', 'error');
        }
    }

    function addInitialDefaultRows() {
        if (state.perfiles.length > 0) {
            const p1 = state.perfiles[0];
            state.items.push(createItemObject('Profesional 1', p1.id, p1.nombre, p1.tarifa_costo, 10));
        } else {
            state.items = [];
        }
    }

    function createItemObject(nombre, perfilId, perfilNombre, tarifa, horas) {
        return {
            uid: Date.now() + Math.random().toString(36).substr(2, 9),
            profesional: nombre,
            perfil_id: perfilId || '',
            perfil_nombre: perfilNombre || 'Personalizado',
            tarifa_costo: parseFloat(tarifa) || 1.0,
            horas: parseFloat(horas) || 0,
            costo_total: 0,
            margen_porcentaje: parseFloat(state.margenGlobal),
            monto_utilidad: 0,
            precio_venta: 0
        };
    }

    // --- CALCULATION ENGINE ---
    function recalculate() {
        let sumHours = 0;
        let sumCostUF = 0;
        let sumCost = 0;
        let sumUtilityUF = 0;
        let sumUtility = 0;
        let sumPriceUF = 0;
        let sumPrice = 0;

        if (ufValueInput && parseFloat(ufValueInput.value)) {
            state.valorUF = parseFloat(ufValueInput.value);
        }

        const currentUF = parseFloat(state.valorUF) || 38850.0;

        state.items.forEach(item => {
            // Tarifa is expressed in UF/hour (0.5 to 2.5 UF/h)
            item.costo_total_uf = item.horas * item.tarifa_costo;
            item.costo_total = item.costo_total_uf * currentUF;

            // Enforce margin between 10% and 20%
            if (item.margen_porcentaje < 10.0) item.margen_porcentaje = 10.0;
            if (item.margen_porcentaje > 20.0) item.margen_porcentaje = 20.0;

            const marginDecimal = item.margen_porcentaje / 100.0;

            if (state.modoMargen === 'costo') {
                // Markup sobre Costo: Utilidad = Costo * Margen%
                item.monto_utilidad_uf = item.costo_total_uf * marginDecimal;
                item.precio_venta_uf = item.costo_total_uf + item.monto_utilidad_uf;
            } else {
                // Margin sobre Venta: Precio Venta = Costo / (1 - Margen%)
                if (marginDecimal < 1.0) {
                    item.precio_venta_uf = item.costo_total_uf / (1.0 - marginDecimal);
                    item.monto_utilidad_uf = item.precio_venta_uf - item.costo_total_uf;
                } else {
                    item.precio_venta_uf = item.costo_total_uf;
                    item.monto_utilidad_uf = 0;
                }
            }

            item.monto_utilidad = item.monto_utilidad_uf * currentUF;
            item.precio_venta = item.precio_venta_uf * currentUF;

            sumHours += item.horas;
            sumCostUF += item.costo_total_uf;
            sumCost += item.costo_total;
            sumUtilityUF += item.monto_utilidad_uf;
            sumUtility += item.monto_utilidad;
            sumPriceUF += item.precio_venta_uf;
            sumPrice += item.precio_venta;
        });

        // Update KPIs
        kpiTotalHours.textContent = `${sumHours.toFixed(1)} hrs`;
        kpiTotalCost.innerHTML = `${sumCostUF.toFixed(2)} UF <span style="font-size:0.85rem; color:var(--text-muted); font-weight:normal;">(${formatCurrency(sumCost)})</span>`;
        kpiTotalUtility.innerHTML = `${sumUtilityUF.toFixed(2)} UF <span style="font-size:0.85rem; color:var(--emerald); font-weight:normal;">(${formatCurrency(sumUtility)})</span>`;
        kpiTotalPrice.innerHTML = `${sumPriceUF.toFixed(2)} UF <span style="font-size:0.85rem; color:var(--purple); font-weight:normal;">(${formatCurrency(sumPrice)})</span>`;

        const avgMargin = sumCost > 0 ? (sumUtility / sumCost) * 100 : state.margenGlobal;
        kpiMarginBadge.textContent = `Margen Prom: ${avgMargin.toFixed(1)}%`;
        itemCountLabel.textContent = `${state.items.length} Profesional${state.items.length !== 1 ? 'es' : ''} en la proyección`;

        // Update Charts
        updateCharts(sumCost, sumUtility);
    }

    function formatCurrency(amount) {
        const scale = parseFloat(state.unidadEscala) || 1;
        const scaledAmount = amount / scale;

        if (scale === 1) {
            const numStr = new Intl.NumberFormat('es-CL', {
                minimumFractionDigits: 0,
                maximumFractionDigits: 0
            }).format(Math.round(scaledAmount));
            return `$ ${numStr}`;
        } else {
            let suffix = scale === 1000 ? ' Miles ($k)' : ' Millones ($M)';
            const numStr = new Intl.NumberFormat('es-CL', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
            }).format(scaledAmount);
            return `$ ${numStr}${suffix}`;
        }
    }

    // --- RENDER TABLE & CARDS ---
    function render() {
        recalculate();
        tbody.innerHTML = '';

        if (state.items.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="6" style="text-align: center; padding: 2.5rem; color: var(--text-muted);">
                        <i class="fa-solid fa-folder-open" style="font-size: 2rem; margin-bottom: 0.5rem; display: block;"></i>
                        No hay profesionales agregados. Haz clic en <strong>"Agregar Profesional"</strong> para comenzar.
                    </td>
                </tr>
            `;
            return;
        }

        state.items.forEach((item, index) => {
            const tr = document.createElement('tr');

            // Construct Professional Select Options
            let profOptionsHtml = `<option value="">-- Seleccionar Profesional --</option>`;
            let matchedInList = false;

            state.profesionalesLista.forEach(prof => {
                const isSelected = item.profesional && item.profesional.toLowerCase() === prof.nombre.toLowerCase();
                if (isSelected) matchedInList = true;
                profOptionsHtml += `<option value="${escapeHtml(prof.nombre)}" ${isSelected ? 'selected' : ''}>${escapeHtml(prof.nombre)} (${escapeHtml(prof.perfil)})</option>`;
            });

            const isCustom = !matchedInList && item.profesional && item.profesional !== '';
            if (isCustom && !item.isEditingCustomName) {
                profOptionsHtml += `<option value="${escapeHtml(item.profesional)}" selected>${escapeHtml(item.profesional)} (Personalizado)</option>`;
            }
            profOptionsHtml += `<option value="__custom__" ${item.isEditingCustomName ? 'selected' : ''}>+ Escribir nuevo nombre...</option>`;

            // Construct Profile Select Options
            let optionsHtml = `<option value="">-- Tarifas Predefinidas (UF) --</option>`;
            state.perfiles.forEach(p => {
                const selected = item.perfil_id == p.id ? 'selected' : '';
                optionsHtml += `<option value="${p.id}" ${selected}>${p.nombre} (${p.tarifa_costo.toFixed(2)} UF/h)</option>`;
            });

            tr.innerHTML = `
                <td class="col-num">${index + 1}</td>
                
                <!-- COL 1: Nombre del Profesional (Lista Desplegable) -->
                <td class="col-name">
                    <div class="prof-input-wrap">
                        <select class="form-select item-name-select" data-uid="${item.uid}">
                            ${profOptionsHtml}
                        </select>
                        ${item.isEditingCustomName ? `<input type="text" class="form-input item-name-input" data-uid="${item.uid}" value="${escapeHtml(item.profesional)}" placeholder="Escribe el nombre completo" style="margin-top:0.3rem;">` : ''}
                    </div>
                </td>

                <!-- COL 2: Perfil de Costo en UF (0.5 - 2.5 UF/h) -->
                <td class="col-profile">
                    <div class="prof-input-wrap">
                        <select class="form-select item-profile-select" data-uid="${item.uid}">
                            ${optionsHtml}
                        </select>
                        <div style="display:flex; align-items:center; gap:0.4rem; margin-top:0.2rem;">
                            <input type="number" class="form-input item-rate-input" data-uid="${item.uid}" value="${item.tarifa_costo}" step="0.05" min="0.1" max="5.0" style="padding:0.3rem 0.5rem; font-size:0.85rem; font-weight:600;" title="Tarifa por Hora en UF">
                            <span style="font-size:0.75rem; color:var(--text-muted); font-weight:600;">UF/hora</span>
                        </div>
                    </div>
                </td>

                <!-- COL 3: Cálculo de Horas Ingresadas (UF * Horas * UF_Actual) -->
                <td class="col-hours">
                    <div class="prof-input-wrap">
                        <div style="display:flex; align-items:center; gap:0.4rem;">
                            <input type="number" class="form-input item-hours-input" data-uid="${item.uid}" value="${item.horas}" step="1" min="0" style="font-weight:700;">
                            <span style="font-size:0.85rem; color:var(--text-muted);">hrs</span>
                        </div>
                        <span class="sub-cost-badge">Costo: ${(item.costo_total_uf || 0).toFixed(2)} UF (${formatCurrency(item.costo_total)})</span>
                    </div>
                </td>

                <!-- COL 4: Cálculo de Utilidad (10% - 20%) -->
                <td class="col-utility">
                    <div class="utility-box">
                        <div class="row-margin-slider-wrap">
                            <input type="range" class="margin-range-slider item-margin-slider" data-uid="${item.uid}" min="10" max="20" step="0.5" value="${item.margen_porcentaje}">
                            <span class="row-margin-val">${item.margen_porcentaje.toFixed(1)}%</span>
                        </div>
                        <div class="utility-result-line">
                            <span>Utilidad:</span>
                            <strong>${(item.monto_utilidad_uf || 0).toFixed(2)} UF <span style="font-weight:normal; font-size:0.75rem; color:var(--text-muted);">(${formatCurrency(item.monto_utilidad)})</span></strong>
                        </div>
                        <div class="utility-result-line price-result-line">
                            <span>Precio:</span>
                            <strong>${(item.precio_venta_uf || 0).toFixed(2)} UF <span style="font-weight:normal; font-size:0.75rem; color:var(--text-muted);">(${formatCurrency(item.precio_venta)})</span></strong>
                        </div>
                    </div>
                </td>

                <!-- ACCIONES -->
                <td class="col-actions">
                    <button class="btn-icon-danger btn-delete-row" data-uid="${item.uid}" title="Eliminar profesional">
                        <i class="fa-solid fa-trash"></i>
                    </button>
                </td>
            `;

            tbody.appendChild(tr);
        });

        bindTableInputsEvents();
    }

    function bindTableInputsEvents() {
        // Professional dropdown change
        document.querySelectorAll('.item-name-select').forEach(sel => {
            sel.addEventListener('change', (e) => {
                const uid = e.target.getAttribute('data-uid');
                const val = e.target.value;
                const item = state.items.find(i => i.uid === uid);
                if (item) {
                    if (val === '__custom__') {
                        item.isEditingCustomName = true;
                        item.profesional = 'Nuevo Profesional';
                    } else if (val !== '') {
                        item.isEditingCustomName = false;
                        item.profesional = val;

                        // Auto-match profile & rate from selected professional
                        const foundProf = state.profesionalesLista.find(p => p.nombre.toLowerCase() === val.toLowerCase());
                        if (foundProf) {
                            const matchPerfil = state.perfiles.find(p => p.nombre.toLowerCase() === foundProf.perfil.toLowerCase());
                            if (matchPerfil) {
                                item.perfil_id = matchPerfil.id;
                                item.perfil_nombre = matchPerfil.nombre;
                                item.tarifa_costo = matchPerfil.tarifa_costo;
                            } else if (foundProf.tarifa) {
                                item.tarifa_costo = foundProf.tarifa;
                                item.perfil_nombre = foundProf.perfil;
                            }
                        }
                    }
                    render();
                }
            });
        });

        // Name input custom change
        document.querySelectorAll('.item-name-input').forEach(inp => {
            inp.addEventListener('input', (e) => {
                const uid = e.target.getAttribute('data-uid');
                const item = state.items.find(i => i.uid === uid);
                if (item) item.profesional = e.target.value;
            });
        });

        // Profile select
        document.querySelectorAll('.item-profile-select').forEach(sel => {
            sel.addEventListener('change', (e) => {
                const uid = e.target.getAttribute('data-uid');
                const pid = e.target.value;
                const item = state.items.find(i => i.uid === uid);
                if (item) {
                    item.perfil_id = pid;
                    const pObj = state.perfiles.find(p => p.id == pid);
                    if (pObj) {
                        item.perfil_nombre = pObj.nombre;
                        item.tarifa_costo = pObj.tarifa_costo;
                    }
                    render();
                }
            });
        });

        // Hourly rate input
        document.querySelectorAll('.item-rate-input').forEach(inp => {
            inp.addEventListener('input', (e) => {
                const uid = e.target.getAttribute('data-uid');
                const item = state.items.find(i => i.uid === uid);
                if (item) {
                    item.tarifa_costo = parseFloat(e.target.value) || 0;
                    render();
                }
            });
        });

        // Hours input
        document.querySelectorAll('.item-hours-input').forEach(inp => {
            inp.addEventListener('input', (e) => {
                const uid = e.target.getAttribute('data-uid');
                const item = state.items.find(i => i.uid === uid);
                if (item) {
                    item.horas = parseFloat(e.target.value) || 0;
                    render();
                }
            });
        });

        // Margin slider per row
        document.querySelectorAll('.item-margin-slider').forEach(sld => {
            sld.addEventListener('input', (e) => {
                const uid = e.target.getAttribute('data-uid');
                const item = state.items.find(i => i.uid === uid);
                if (item) {
                    item.margen_porcentaje = parseFloat(e.target.value) || 10.0;
                    render();
                }
            });
        });

        // Delete row
        document.querySelectorAll('.btn-delete-row').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const uid = btn.getAttribute('data-uid');
                state.items = state.items.filter(i => i.uid !== uid);
                render();
                showToast('Profesional eliminado', 'success');
            });
        });
    }

    // --- GLOBAL CONTROLS & EVENT BINDINGS ---
    function bindEvents() {
        // Global margin slider
        globalMarginSlider.addEventListener('input', (e) => {
            const val = parseFloat(e.target.value);
            state.margenGlobal = val;
            globalMarginDisplay.textContent = `${val.toFixed(1)}%`;
            
            // Sync all item margins
            state.items.forEach(i => i.margen_porcentaje = val);
            
            updatePresetButtonsHighlight(val);
            render();
        });

        // Margin preset buttons
        presetBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                const val = parseFloat(btn.getAttribute('data-margin'));
                state.margenGlobal = val;
                globalMarginSlider.value = val;
                globalMarginDisplay.textContent = `${val.toFixed(1)}%`;
                
                state.items.forEach(i => i.margen_porcentaje = val);
                updatePresetButtonsHighlight(val);
                render();
            });
        });

        // UF Value input manual edit listener
        if (ufValueInput) {
            ufValueInput.addEventListener('input', (e) => {
                state.valorUF = parseFloat(e.target.value) || 38850.0;
                render();
            });
        }
        if (btnRefreshUf) {
            btnRefreshUf.addEventListener('click', async () => {
                await fetchLiveUF();
            });
        }



        // Form Login Submit
        if (formLogin) {
            formLogin.addEventListener('submit', async (e) => {
                e.preventDefault();
                const email = document.getElementById('login-email').value.trim();
                const password = document.getElementById('login-password').value;

                if (!email.toLowerCase().endsWith('@bmining.cl')) {
                    showToast('Acceso restringido: Solo se permiten correos @bmining.cl', 'error');
                    return;
                }

                try {
                    const res = await fetch('/api/auth/login', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ email, password })
                    });
                    const data = await res.json();
                    if (data.status === 'success') {
                        state.currentUser = data.user;
                        renderAuthHeader();
                        if (modalAuth) modalAuth.classList.remove('active');
                        formLogin.reset();
                        showToast(`Bienvenido(a), ${data.user.nombre}`, 'success');
                    } else {
                        showToast(data.message || 'Error al iniciar sesión', 'error');
                    }
                } catch (err) {
                    showToast('Error de conexión al iniciar sesión', 'error');
                }
            });
        }
        // Gatekeeper Wall Login Submit
        if (gkFormLogin) {
            gkFormLogin.addEventListener('submit', async (e) => {
                e.preventDefault();
                const email = document.getElementById('gk-login-email').value.trim();
                const password = document.getElementById('gk-login-password').value;

                if (!email.toLowerCase().endsWith('@bmining.cl')) {
                    showToast('Acceso restringido: Solo se permiten correos institucionales @bmining.cl', 'error');
                    return;
                }

                try {
                    const res = await fetch('/api/auth/login', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ email, password })
                    });
                    const data = await res.json();
                    if (data.status === 'success') {
                        state.currentUser = data.user;
                        renderAuthHeader();
                        gkFormLogin.reset();
                        await fetchLiveUF();
                        showToast(`Permisos validados. ¡Bienvenido(a) ${data.user.nombre}!`, 'success');
                    } else {
                        showToast(data.message || 'Error al validar credenciales', 'error');
                    }
                } catch (err) {
                    showToast('Error de conexión al validar permisos', 'error');
                }
            });
        }

        // --- EXCEL BULK UPLOAD HANDLERS ---
        const excelDropZone = document.getElementById('excel-drop-zone');
        const excelFileInput = document.getElementById('excel-file-input');
        const excelFileLabel = document.getElementById('excel-file-label');
        const formExcelUpload = document.getElementById('form-excel-upload');
        const btnSubmitExcel = document.getElementById('btn-submit-excel');
        const chkAutoImportRows = document.getElementById('chk-auto-import-rows');

        if (excelDropZone && excelFileInput) {
            excelDropZone.addEventListener('click', () => excelFileInput.click());

            excelDropZone.addEventListener('dragover', (e) => {
                e.preventDefault();
                excelDropZone.classList.add('dragover');
            });
            excelDropZone.addEventListener('dragleave', () => {
                excelDropZone.classList.remove('dragover');
            });
            excelDropZone.addEventListener('drop', (e) => {
                e.preventDefault();
                excelDropZone.classList.remove('dragover');
                if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                    excelFileInput.files = e.dataTransfer.files;
                    updateExcelFileInfo();
                }
            });

            excelFileInput.addEventListener('change', updateExcelFileInfo);

            function updateExcelFileInfo() {
                if (excelFileInput.files && excelFileInput.files.length > 0) {
                    const f = excelFileInput.files[0];
                    excelFileLabel.innerHTML = `<strong>${escapeHtml(f.name)}</strong> (${(f.size/1024).toFixed(1)} KB)`;
                    if (btnSubmitExcel) btnSubmitExcel.disabled = false;
                } else {
                    excelFileLabel.textContent = 'Haz clic para seleccionar o arrastra tu archivo Excel aquí (.xlsx, .csv)';
                    if (btnSubmitExcel) btnSubmitExcel.disabled = true;
                }
            }
        }

        if (formExcelUpload) {
            formExcelUpload.addEventListener('submit', async (e) => {
                e.preventDefault();
                if (!excelFileInput || !excelFileInput.files || excelFileInput.files.length === 0) {
                    showToast('Selecciona un archivo Excel primero', 'error');
                    return;
                }

                const file = excelFileInput.files[0];
                const formData = new FormData();
                formData.append('file', file);

                if (btnSubmitExcel) {
                    btnSubmitExcel.disabled = true;
                    btnSubmitExcel.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Procesando Excel...';
                }

                try {
                    const res = await fetch('/api/perfiles/upload_excel', {
                        method: 'POST',
                        body: formData
                    });
                    const data = await res.json();

                    if (data.status === 'success') {
                        await loadPerfiles();

                        if (data.items && data.items.length > 0) {
                            state.profesionalesLista = [];
                            if (chkAutoImportRows && chkAutoImportRows.checked) {
                                state.items = [];
                            }

                            data.items.forEach((imp, idx) => {
                                if (imp.profesional) {
                                    state.profesionalesLista.push({
                                        nombre: imp.profesional,
                                        perfil: imp.perfil_nombre,
                                        tarifa: imp.tarifa_costo
                                    });
                                }

                                if (chkAutoImportRows && chkAutoImportRows.checked) {
                                    state.items.push(createItemObject(
                                        imp.profesional || `Profesional ${idx + 1}`,
                                        imp.perfil_id,
                                        imp.perfil_nombre,
                                        imp.tarifa_costo,
                                        10
                                    ));
                                }
                            });
                            render();
                        }

                        // POPUP MODAL SUMMARY WITH RECORD COUNT
                        showExcelSummaryModal(data.items || []);

                        excelFileInput.value = '';
                        if (excelFileLabel) excelFileLabel.textContent = 'Haz clic para seleccionar o arrastra tu archivo Excel aquí (.xlsx, .csv)';
                        if (btnSubmitExcel) btnSubmitExcel.disabled = true;
                    } else {
                        showToast(data.message || 'Error al procesar archivo Excel', 'error');
                    }
                } catch (err) {
                    showToast('Error de conexión al cargar archivo Excel', 'error');
                } finally {
                    if (btnSubmitExcel) {
                        btnSubmitExcel.innerHTML = '<i class="fa-solid fa-file-import"></i> Procesar e Importar Excel';
                    }
                }
            });
        }

    function showExcelSummaryModal(items) {
        const modalExcelSummary = document.getElementById('modal-excel-summary');
        const countTitle = document.getElementById('excel-summary-count-title');
        const summaryTbody = document.getElementById('excel-summary-tbody');

        if (!modalExcelSummary || !countTitle || !summaryTbody) return;

        countTitle.textContent = `${items.length} Registros Importados Exitosamente`;

        let rowsHtml = '';
        items.forEach(item => {
            rowsHtml += `
                <tr>
                    <td style="text-align: left; font-weight: 600;">${escapeHtml(item.profesional || 'Profesional')}</td>
                    <td style="text-align: left; color: var(--text-muted);">${escapeHtml(item.perfil_nombre || 'Perfil')}</td>
                    <td style="text-align: right; color: var(--emerald); font-weight: 700;">${item.tarifa_costo.toFixed(2)} UF/h</td>
                </tr>
            `;
        });
        summaryTbody.innerHTML = rowsHtml;

        if (modalProfiles) modalProfiles.classList.remove('active');
        modalExcelSummary.classList.add('active');

        const btnCloseSummary = document.getElementById('btn-close-excel-summary');
        if (btnCloseSummary) {
            btnCloseSummary.onclick = function() {
                modalExcelSummary.classList.remove('active');
            };
        }
    }

        // Add professional buttons
        const handleAdd = () => {
            const defaultProfile = state.perfiles[0] || {};
            state.items.push(createItemObject(
                `Profesional ${state.items.length + 1}`,
                defaultProfile.id || null,
                defaultProfile.nombre || 'Personalizado',
                defaultProfile.tarifa_costo || 1.0,
                10
            ));
            render();
            showToast('Nuevo profesional agregado', 'success');
        };
        btnAddProfessional.addEventListener('click', handleAdd);
        btnAddProfessionalMobile.addEventListener('click', handleAdd);

        // Clear items
        btnClearItems.addEventListener('click', () => {
            if (confirm('¿Estás seguro de limpiar la lista de profesionales?')) {
                state.items = [];
                render();
                showToast('Lista limpiada', 'success');
            }
        });

        // Export CSV
        btnExportCSV.addEventListener('click', async () => {
            if (state.items.length === 0) {
                showToast('Agrega al menos un profesional antes de exportar', 'error');
                return;
            }
            try {
                const payload = {
                    nombre_proyecto: projectNameInput.value || 'ProyectaBM_Proyeccion',
                    modo_margen: state.modoMargen,
                    unidad_escala: state.unidadEscala,
                    items: state.items
                };

                const res = await fetch('/api/export/csv', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });

                const blob = await res.blob();
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `${(projectNameInput.value || 'Proyeccion').replace(/\s+/g, '_')}.csv`;
                document.body.appendChild(a);
                a.click();
                a.remove();
                showToast('Archivo CSV generado y descargado', 'success');
            } catch (err) {
                showToast('Error al exportar CSV', 'error');
            }
        });

        // Save Projection to SQLite
        btnSaveProjection.addEventListener('click', async () => {
            if (state.items.length === 0) {
                showToast('Agrega profesionales antes de guardar', 'error');
                return;
            }

            try {
                const payload = {
                    id: state.currentProjectionId,
                    nombre_proyecto: projectNameInput.value || 'Proyección de Horas',
                    cliente: clientNameInput.value || '',
                    modo_margen: state.modoMargen,
                    margen_global: state.margenGlobal,
                    unidad_escala: state.unidadEscala,
                    items: state.items
                };

                const res = await fetch('/api/proyecciones', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });

                const data = await res.json();
                if (data.status === 'success') {
                    state.currentProjectionId = data.id;
                    showToast('Proyección guardada en base de datos', 'success');
                } else {
                    showToast(data.message || 'Error al guardar', 'error');
                }
            } catch (err) {
                showToast('Error de servidor al guardar proyección', 'error');
            }
        });

        // Logout buttons
        const doLogout = async () => {
            await fetch('/api/auth/logout', { method: 'POST' });
            if (inactivityTimer) clearTimeout(inactivityTimer);
            state.currentUser = null;
            renderAuthHeader();
            showToast('Sesión cerrada correctamente', 'success');
        };
        const btnHeaderLogout = document.getElementById('btn-logout');
        if (btnHeaderLogout) btnHeaderLogout.addEventListener('click', doLogout);
        const btnLogoutWorkspace = document.getElementById('btn-logout-workspace');
        if (btnLogoutWorkspace) btnLogoutWorkspace.addEventListener('click', doLogout);

        // Modal triggers
        const btnManageProfilesWorkspace = document.getElementById('btn-manage-profiles-workspace');
        if (btnManageProfilesWorkspace) {
            btnManageProfilesWorkspace.addEventListener('click', () => {
                if (modalProfiles) modalProfiles.classList.add('active');
            });
        }
        if (btnManageProfiles) {
            btnManageProfiles.addEventListener('click', () => {
                if (modalProfiles) modalProfiles.classList.add('active');
            });
        }
        if (btnViewLogs) {
            btnViewLogs.addEventListener('click', () => {
                if (modalLogs) modalLogs.classList.add('active');
                loadAuditLogs();
            });
        }

        // Modal close buttons
        document.querySelectorAll('.close-modal, .modal-close').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                const backdrop = btn.closest('.modal-backdrop');
                if (backdrop) {
                    backdrop.classList.remove('active');
                } else {
                    document.querySelectorAll('.modal-backdrop').forEach(m => m.classList.remove('active'));
                }
            });
        });

        // Form add profile submit
        formAddProfile.addEventListener('submit', async (e) => {
            e.preventDefault();
            const name = document.getElementById('new-profile-name').value.trim();
            const rate = parseFloat(document.getElementById('new-profile-rate').value);
            const desc = document.getElementById('new-profile-desc').value.trim();

            if (!name || isNaN(rate) || rate <= 0) {
                showToast('Ingresa un nombre y tarifa válida', 'error');
                return;
            }

            try {
                const res = await fetch('/api/perfiles', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ nombre: name, tarifa_costo: rate, descripcion: desc })
                });
                const data = await res.json();
                if (data.status === 'success') {
                    showToast('Perfil agregado al catálogo', 'success');
                    formAddProfile.reset();
                    await loadPerfiles();
                    render();
                } else {
                    showToast(data.message, 'error');
                }
            } catch (err) {
                showToast('Error al registrar perfil', 'error');
            }
        });
    }

    function updatePresetButtonsHighlight(val) {
        presetBtns.forEach(btn => {
            const btnVal = parseFloat(btn.getAttribute('data-margin'));
            if (btnVal === val) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });
    }

    // --- PROFILES & SCENARIOS LIST MODALS ---
    function renderProfilesModalList() {
        if (!profileListContainer) return;
        profileListContainer.innerHTML = '';
        if (state.perfiles.length === 0) {
            profileListContainer.innerHTML = `<li style="text-align:center; color:var(--text-muted); padding:1rem;">No hay perfiles registrados en el catálogo.</li>`;
            return;
        }
        state.perfiles.forEach(p => {
            const li = document.createElement('li');
            li.className = 'profile-item';
            li.innerHTML = `
                <div>
                    <strong>${escapeHtml(p.nombre)}</strong>
                    <div style="font-size:0.8rem; color:var(--text-muted);">$${p.tarifa_costo.toFixed(2)} / hora - ${escapeHtml(p.descripcion || '')}</div>
                </div>
                <button class="btn-icon-danger btn-delete-profile" data-id="${p.id}">
                    <i class="fa-solid fa-trash-can"></i>
                </button>
            `;
            profileListContainer.appendChild(li);
        });

        document.querySelectorAll('.btn-delete-profile').forEach(btn => {
            btn.addEventListener('click', async () => {
                const pid = btn.getAttribute('data-id');
                if (confirm('¿Eliminar este perfil del catálogo?')) {
                    try {
                        const res = await fetch(`/api/perfiles/${pid}`, { method: 'DELETE' });
                        if ((await res.json()).status === 'success') {
                            showToast('Perfil eliminado', 'success');
                            await loadPerfiles();
                            render();
                        }
                    } catch (err) {
                        showToast('Error al eliminar perfil', 'error');
                    }
                }
            });
        });
    }

    // --- CHARTS (CHART.JS) ---
    function initCharts() {
        const ctxDist = document.getElementById('cost-distribution-chart').getContext('2d');
        distChart = new Chart(ctxDist, {
            type: 'bar',
            data: {
                labels: [],
                datasets: [
                    {
                        label: 'Costo Directo ($)',
                        data: [],
                        backgroundColor: 'rgba(245, 158, 11, 0.7)',
                        borderColor: '#f59e0b',
                        borderWidth: 1
                    },
                    {
                        label: 'Utilidad Estimada ($)',
                        data: [],
                        backgroundColor: 'rgba(16, 185, 129, 0.7)',
                        borderColor: '#10b981',
                        borderWidth: 1
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { labels: { color: '#94a3b8' } }
                },
                scales: {
                    x: { ticks: { color: '#94a3b8' }, grid: { color: 'rgba(255,255,255,0.05)' } },
                    y: { ticks: { color: '#94a3b8' }, grid: { color: 'rgba(255,255,255,0.05)' } }
                }
            }
        });

        const ctxCompare = document.getElementById('margin-comparison-chart').getContext('2d');
        compareChart = new Chart(ctxCompare, {
            type: 'line',
            data: {
                labels: ['10% Utilidad', '12.5% Utilidad', '15.0% (Base)', '17.5% Utilidad', '20.0% Utilidad'],
                datasets: [{
                    label: 'Precio al Cliente ($)',
                    data: [0, 0, 0, 0, 0],
                    borderColor: '#8b5cf6',
                    backgroundColor: 'rgba(139, 92, 246, 0.2)',
                    fill: true,
                    tension: 0.3,
                    pointBackgroundColor: '#06b6d4'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { labels: { color: '#94a3b8' } }
                },
                scales: {
                    x: { ticks: { color: '#94a3b8' }, grid: { color: 'rgba(255,255,255,0.05)' } },
                    y: { ticks: { color: '#94a3b8' }, grid: { color: 'rgba(255,255,255,0.05)' } }
                }
            }
        });
    }

    function updateCharts(totalCost, totalUtility) {
        if (!distChart || !compareChart) return;

        const scale = parseFloat(state.unidadEscala) || 1;
        let unitTag = '';
        if (scale === 1000) unitTag = ' (Miles $k)';
        else if (scale === 1000000) unitTag = ' (Millones $M)';

        // Chart 1: Per professional breakdown
        distChart.data.datasets[0].label = `Costo Directo${unitTag}`;
        distChart.data.datasets[1].label = `Utilidad Estimada${unitTag}`;
        distChart.data.labels = state.items.map(i => i.profesional || 'Profesional');
        distChart.data.datasets[0].data = state.items.map(i => i.costo_total / scale);
        distChart.data.datasets[1].data = state.items.map(i => i.monto_utilidad / scale);
        distChart.update();

        // Chart 2: Scenario comparison across 10% - 20%
        const marginSteps = [10.0, 12.5, 15.0, 17.5, 20.0];
        const scenarioPrices = marginSteps.map(m => {
            const dec = m / 100.0;
            let price = 0;
            if (state.modoMargen === 'costo') {
                price = totalCost * (1 + dec);
            } else {
                price = totalCost / (1 - dec);
            }
            return price / scale;
        });

        compareChart.data.datasets[0].label = `Precio al Cliente${unitTag}`;
        compareChart.data.datasets[0].data = scenarioPrices;
        compareChart.update();
    }

    // --- HELPER UTILS ---
    function showToast(message, type = 'success') {
        const container = document.getElementById('toast-container');
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        const icon = type === 'success' ? 'fa-check-circle' : 'fa-exclamation-circle';
        toast.innerHTML = `<i class="fa-solid ${icon}"></i> <span>${escapeHtml(message)}</span>`;
        container.appendChild(toast);
        setTimeout(() => {
            toast.style.opacity = '0';
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }

    function escapeHtml(str) {
        return (str || '').replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
    }
});
