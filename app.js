'use strict';

// ═══════════════════════════════════════════════════════════════════════════
// FIREBASE INIT
// ═══════════════════════════════════════════════════════════════════════════

const FIREBASE_CONFIG = {
  apiKey: "AIzaSyAek0F64AeFDrOUgyGP-_c37X9CrqODVdM",
  authDomain: "aia-arquitectos-730e8.firebaseapp.com",
  projectId: "aia-arquitectos-730e8",
  storageBucket: "aia-arquitectos-730e8.firebasestorage.app",
  messagingSenderId: "996874189178",
  appId: "1:996874189178:web:5f61b3ee0155951a303ec3",
  measurementId: "G-69G7KP1V7N"
};

firebase.initializeApp(FIREBASE_CONFIG);
const auth = firebase.auth();
const db   = firebase.firestore();

const API_BASE = '';

// ═══════════════════════════════════════════════════════════════════════════
// STATE
// ═══════════════════════════════════════════════════════════════════════════

const state = {
  authUser:    null,   // Firebase Auth user object
  userData:    null,   // Firestore /users/{uid} doc
  sections:    [],
  pages:       [],
  currentPageId: null,
  autosaveTimer: null,
  isDirty:     false,
  antecedentes: { comuna: '', unidades: null, m2Total: null, encargados: [] },
};

// Predefined section colors
const SECTION_COLORS = [
  '#ef4444','#f97316','#eab308','#22c55e',
  '#14b8a6','#3b82f6','#8b5cf6','#ec4899',
];

// ═══════════════════════════════════════════════════════════════════════════
// DOM REFS
// ═══════════════════════════════════════════════════════════════════════════

const $ = id => document.getElementById(id);

const DOM = {
  loading:           $('loading-overlay'),
  header:            $('app-header'),
  appBody:           $('app-body'),
  hamburger:         $('hamburger-btn'),
  headerUserName:    $('header-user-name'),
  logoutBtn:         $('logout-btn'),
  moduleSidebar:     $('module-sidebar'),
  mainArea:          $('main-area'),
  // Wiki
  wikiModule:        $('wiki-module'),
  wikiSidebar:       $('wiki-sidebar'),
  sectionsList:      $('sections-list'),
  sectionsEmpty:     $('sections-empty'),
  createSectionBtn:  $('create-section-btn'),
  editorEmptyState:  $('editor-empty-state'),
  editorContainer:   $('editor-container'),
  pageTitleInput:    $('page-title-input'),
  saveIndicator:     $('save-indicator'),
  editorToolbar:     $('editor-toolbar'),
  editorContent:     $('editor-content'),
  textColorBtn:      $('text-color-btn'),
  textColorPopover:  $('text-color-popover'),
  textColorSwatch:   $('text-color-swatch'),
  fontSizeBtn:       $('font-size-btn'),
  fontSizePopover:   $('font-size-popover'),
  // Antecedentes
  antComuna:         $('ant-comuna'),
  antUnidades:       $('ant-unidades'),
  antM2Total:        $('ant-m2total'),
  antEncargadosChips:$('ant-encargados-chips'),
  antEncargadoInput: $('ant-encargado-input'),
  antEncargadoAddBtn:$('ant-encargado-add'),
  antEncargadosDatalist: $('ant-encargados-datalist'),
  // Resumen mensual
  resumenModule:         $('resumen-module'),
  resumenSidebar:        $('resumen-sidebar'),
  resumenWeeksList:      $('resumen-weeks-list'),
  resumenEmptyState:     $('resumen-empty-state'),
  resumenReportContainer:$('resumen-report-container'),
  resumenReport:         $('resumen-report'),
  resumenWeekLabel:      $('resumen-week-label'),
  resumenWeekMeta:       $('resumen-week-meta'),
  resumenPrevBtn:        $('resumen-prev-btn'),
  resumenNextBtn:        $('resumen-next-btn'),
  resumenPrintBtn:       $('resumen-print-btn'),
  // Admin
  adminModule:       $('admin-module'),
  adminNavBtn:       $('admin-nav-btn'),
  usersTableBody:    $('users-table-body'),
  createUserBtn:     $('create-user-btn'),
  adminSectionsList: $('admin-sections-list'),
  adminCreateSectionBtn: $('admin-create-section-btn'),
  activityList:      $('activity-list'),
  // Modal
  modalOverlay:      $('modal-overlay'),
  modalBox:          $('modal-box'),
  modalTitle:        $('modal-title'),
  modalBody:         $('modal-body'),
  modalFooter:       $('modal-footer'),
  modalCloseBtn:     $('modal-close-btn'),
  // Toast
  toastContainer:    $('toast-container'),
};

// ═══════════════════════════════════════════════════════════════════════════
// TOAST NOTIFICATIONS
// ═══════════════════════════════════════════════════════════════════════════

function toast(msg, type = 'info') {
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.textContent = msg;
  DOM.toastContainer.appendChild(el);
  setTimeout(() => el.remove(), 3200);
}

// ═══════════════════════════════════════════════════════════════════════════
// MODAL SYSTEM
// ═══════════════════════════════════════════════════════════════════════════

function openModal({ title, body, footer }) {
  DOM.modalTitle.textContent = title;
  DOM.modalBody.innerHTML = body;
  DOM.modalFooter.innerHTML = footer || '';
  DOM.modalOverlay.classList.remove('hidden');
  // Focus first input if present
  const first = DOM.modalBody.querySelector('input, select, textarea');
  if (first) setTimeout(() => first.focus(), 50);
}

function closeModal() {
  DOM.modalOverlay.classList.add('hidden');
  DOM.modalBody.innerHTML = '';
  DOM.modalFooter.innerHTML = '';
}

// "AAAA-MM-DD" para el value por defecto de <input type="date">.
function todayInputValue() {
  return dateKey(new Date());
}

// Parsea "AAAA-MM-DD" como fecha LOCAL (new Date(str) la toma como UTC y
// puede correrse un día para atrás en husos horarios negativos como -03:00).
function parseDateInputValue(value) {
  const [y, m, d] = value.split('-').map(Number);
  return new Date(y, m - 1, d);
}

DOM.modalCloseBtn.addEventListener('click', closeModal);
DOM.modalOverlay.addEventListener('click', e => {
  if (e.target === DOM.modalOverlay) closeModal();
});
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') closeModal();
});

// ═══════════════════════════════════════════════════════════════════════════
// AUTH
// ═══════════════════════════════════════════════════════════════════════════

auth.onAuthStateChanged(async user => {
  if (!user) {
    window.location.href = 'index.html';
    return;
  }

  state.authUser = user;

  try {
    const userDoc = await db.collection('users').doc(user.uid).get();

    if (!userDoc.exists) {
      await auth.signOut();
      toast('Usuario no encontrado en el sistema.', 'error');
      window.location.href = 'index.html';
      return;
    }

    const userData = userDoc.data();

    if (userData.disabled) {
      await auth.signOut();
      alert('Tu cuenta ha sido desactivada. Contactá al administrador.');
      window.location.href = 'index.html';
      return;
    }

    state.userData = userData;
    initApp();
  } catch (err) {
    console.error('Auth init error:', err);
    DOM.loading.querySelector('span').textContent = 'Error al cargar. Recargá la página.';
  }
});

DOM.logoutBtn.addEventListener('click', async () => {
  await auth.signOut();
  window.location.href = 'index.html';
});

// ═══════════════════════════════════════════════════════════════════════════
// APP INITIALIZATION
// ═══════════════════════════════════════════════════════════════════════════

function initApp() {
  const { userData } = state;

  DOM.headerUserName.textContent = userData.name || userData.email;

  // Show/hide admin nav based on role
  if (userData.role === 'admin') {
    DOM.adminNavBtn.classList.remove('hidden');
  }

  // Show UI
  DOM.loading.classList.add('hidden');
  DOM.header.classList.remove('hidden');
  DOM.appBody.classList.remove('hidden');

  initNavigation();
  initEditorToolbar();
  initAntecedentesPanel();
  loadWiki();
}

// ═══════════════════════════════════════════════════════════════════════════
// NAVIGATION
// ═══════════════════════════════════════════════════════════════════════════

function initNavigation() {
  // Module nav buttons
  document.querySelectorAll('.module-nav-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const module = btn.dataset.module;
      switchModule(module);
      // Close sidebar on mobile
      DOM.moduleSidebar.classList.remove('open');
    });
  });

  // Admin tabs
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const tab = btn.dataset.tab;
      switchAdminTab(tab);
    });
  });

  // Hamburger
  DOM.hamburger.addEventListener('click', () => {
    DOM.moduleSidebar.classList.toggle('open');
  });
}

function switchModule(moduleName) {
  document.querySelectorAll('.module').forEach(m => m.classList.remove('active'));
  document.querySelectorAll('.module-nav-btn').forEach(b => b.classList.remove('active'));

  $(`${moduleName}-module`).classList.add('active');
  document.querySelector(`.module-nav-btn[data-module="${moduleName}"]`).classList.add('active');

  if (moduleName === 'admin') {
    loadAdminTab('users');
  }
  if (moduleName === 'resumen') {
    loadResumen();
  }
}

function switchAdminTab(tabName) {
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.admin-tab-content').forEach(t => t.classList.remove('active'));

  document.querySelector(`.tab-btn[data-tab="${tabName}"]`).classList.add('active');
  $(`tab-${tabName}`).classList.add('active');

  loadAdminTab(tabName);
}

function loadAdminTab(tabName) {
  if (tabName === 'users')    loadAdminUsers();
  if (tabName === 'sections') loadAdminSections();
  if (tabName === 'activity') loadActivity();
}

// ═══════════════════════════════════════════════════════════════════════════
// WIKI — DATA LOADING
// ═══════════════════════════════════════════════════════════════════════════

async function loadWiki() {
  const { userData } = state;

  if (userData.role === 'admin') {
    DOM.createSectionBtn.classList.remove('hidden');
    DOM.createSectionBtn.addEventListener('click', () => openCreateSectionModal());
  }

  try {
    const [sectionsSnap, pagesSnap] = await Promise.all([
      db.collection('sections').orderBy('createdAt').get(),
      db.collection('pages').orderBy('order').get(),
    ]);
    state.sections = sectionsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    state.pages    = pagesSnap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (err) {
    console.error('loadWiki error:', err);
    toast('Error al cargar Reuniones: ' + err.message + '. Verificá las reglas de Firestore.', 'error');
  }

  renderWikiSidebar();
}

function getAccessibleSections() {
  const { userData, sections } = state;
  if (userData.role === 'admin') return sections;
  return sections.filter(s =>
    Array.isArray(s.allowedUids) && s.allowedUids.includes(userData.uid)
  );
}

function getPagesForSection(sectionId) {
  return state.pages.filter(p => p.sectionId === sectionId);
}

// ═══════════════════════════════════════════════════════════════════════════
// WIKI — SIDEBAR RENDER
// ═══════════════════════════════════════════════════════════════════════════

function renderWikiSidebar() {
  const accessible = getAccessibleSections();
  const isAdmin    = state.userData.role === 'admin';
  const list       = DOM.sectionsList;
  list.innerHTML   = '';

  if (accessible.length === 0) {
    if (isAdmin) {
      list.innerHTML = `
        <div class="empty-state">
          <p style="margin-bottom:14px">No hay secciones todavía.</p>
          <button class="btn-sm primary js-empty-create-section" style="width:100%;justify-content:center">
            + Crear primera sección
          </button>
        </div>`;
      list.querySelector('.js-empty-create-section')
          .addEventListener('click', () => openCreateSectionModal());
    } else {
      list.innerHTML = '<div class="empty-state"><p>No tenés secciones asignadas.<br>Contactá al administrador.</p></div>';
    }
    return;
  }

  accessible.forEach(section => {
    const pages = getPagesForSection(section.id);
    const isAdmin = state.userData.role === 'admin';
    const canEdit  = state.userData.role !== 'viewer';

    const item = document.createElement('div');
    item.className = 'section-item';
    item.dataset.sectionId = section.id;

    item.innerHTML = `
      <div class="section-header" data-section-id="${section.id}">
        <span class="section-color-dot" style="background:${section.color || '#6b7280'}"></span>
        <span class="section-name">${escHtml(section.name)}</span>
        <span class="section-toggle">▶</span>
        <div class="section-actions">
          ${isAdmin ? `
            <button class="section-btn js-edit-section" data-id="${section.id}" title="Editar">✏️</button>
            <button class="section-btn js-delete-section" data-id="${section.id}" title="Eliminar">🗑️</button>
          ` : ''}
        </div>
      </div>
      <div class="pages-list" style="display:none">
        ${pages.map(p => renderPageItem(p)).join('')}
        ${canEdit ? `
          <button class="add-page-btn js-add-page" data-section="${section.id}">
            + Agregar página
          </button>
        ` : ''}
      </div>
    `;

    list.appendChild(item);
  });

  bindSidebarEvents();
}

function renderPageItem(page) {
  const isAdmin  = state.userData.role === 'admin';
  const isActive = page.id === state.currentPageId;
  return `
    <div class="page-item${isActive ? ' active' : ''}" data-page-id="${page.id}">
      <span class="page-title-nav">${escHtml(page.title || 'Sin título')}</span>
      ${isAdmin ? `<button class="page-delete-btn js-delete-page" data-id="${page.id}" title="Eliminar página">×</button>` : ''}
    </div>
  `;
}

function bindSidebarEvents() {
  // Section toggle (open/close pages list)
  DOM.sectionsList.querySelectorAll('.section-header').forEach(header => {
    header.addEventListener('click', e => {
      if (e.target.closest('.section-actions')) return;
      const item = header.closest('.section-item');
      const pagesList = item.querySelector('.pages-list');
      item.classList.toggle('open');
      pagesList.style.display = item.classList.contains('open') ? 'block' : 'none';
    });
  });

  // Page click
  DOM.sectionsList.querySelectorAll('.page-item').forEach(el => {
    el.addEventListener('click', e => {
      if (e.target.classList.contains('page-delete-btn') || e.target.closest('.page-delete-btn')) return;
      loadPage(el.dataset.pageId);
      // mobile: close wiki sidebar
      DOM.wikiSidebar.classList.remove('open');
    });
  });

  // Add page
  DOM.sectionsList.querySelectorAll('.js-add-page').forEach(btn => {
    btn.addEventListener('click', () => openCreatePageModal(btn.dataset.section));
  });

  // Edit section
  DOM.sectionsList.querySelectorAll('.js-edit-section').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const section = state.sections.find(s => s.id === btn.dataset.id);
      if (section) openEditSectionModal(section);
    });
  });

  // Delete section
  DOM.sectionsList.querySelectorAll('.js-delete-section').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      confirmDeleteSection(btn.dataset.id);
    });
  });

  // Delete page
  DOM.sectionsList.querySelectorAll('.js-delete-page').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      confirmDeletePage(btn.dataset.id);
    });
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// WIKI — PAGE LOAD & EDITOR
// ═══════════════════════════════════════════════════════════════════════════

async function loadPage(pageId) {
  state.currentPageId = pageId;
  const page = state.pages.find(p => p.id === pageId);
  if (!page) return;

  const canEdit = state.userData.role !== 'viewer';

  DOM.editorEmptyState.classList.add('hidden');
  DOM.editorContainer.classList.remove('hidden');

  DOM.pageTitleInput.value = page.title || '';
  DOM.pageTitleInput.disabled = !canEdit;

  DOM.editorContent.innerHTML = page.content || '';
  DOM.editorContent.contentEditable = canEdit ? 'true' : 'false';
  DOM.editorToolbar.style.display = canEdit ? 'flex' : 'none';

  state.antecedentes = normalizeAntecedentes(page.antecedentes);
  renderAntecedentesPanel(canEdit);

  setSaveIndicator('');

  // Update sidebar active state
  document.querySelectorAll('.page-item').forEach(el => {
    el.classList.toggle('active', el.dataset.pageId === pageId);
    if (el.dataset.pageId === pageId) {
      // Auto-expand parent section
      const sectionItem = el.closest('.section-item');
      if (sectionItem && !sectionItem.classList.contains('open')) {
        sectionItem.classList.add('open');
        sectionItem.querySelector('.pages-list').style.display = 'block';
      }
    }
  });
}

function setSaveIndicator(status) {
  const el = DOM.saveIndicator;
  el.className = '';
  if (status === 'saving') {
    el.textContent = 'Guardando...';
    el.classList.add('saving');
  } else if (status === 'saved') {
    el.textContent = '✓ Guardado';
    el.classList.add('saved');
  } else {
    el.textContent = '';
  }
}

function scheduleAutosave() {
  if (state.userData.role === 'viewer') return;
  clearTimeout(state.autosaveTimer);
  setSaveIndicator('saving');
  state.autosaveTimer = setTimeout(performAutosave, 1200);
}

async function performAutosave() {
  const pageId = state.currentPageId;
  if (!pageId) return;

  const title   = DOM.pageTitleInput.value.trim() || 'Sin título';
  const content = DOM.editorContent.innerHTML;
  const antecedentes = state.antecedentes;

  try {
    await db.collection('pages').doc(pageId).update({
      title,
      content,
      antecedentes,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
      updatedBy: state.authUser.uid,
    });

    // Update local state
    const page = state.pages.find(p => p.id === pageId);
    if (page) { page.title = title; page.content = content; page.antecedentes = antecedentes; }

    // Update sidebar title
    const navEl = document.querySelector(`.page-item[data-page-id="${pageId}"] .page-title-nav`);
    if (navEl) navEl.textContent = title;

    setSaveIndicator('saved');
    setTimeout(() => setSaveIndicator(''), 3000);
  } catch (err) {
    console.error('Autosave error:', err);
    toast('Error al guardar. Reintentando...', 'error');
    setSaveIndicator('');
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// WIKI — EDITOR TOOLBAR
// ═══════════════════════════════════════════════════════════════════════════

function initEditorToolbar() {
  DOM.editorToolbar.querySelectorAll('.toolbar-btn').forEach(btn => {
    btn.addEventListener('click', e => {
      e.preventDefault();

      if (btn.id === 'insert-date-btn') {
        openInsertDateModal();
        return;
      }

      if (btn.id === 'insert-task-btn') {
        insertTask();
        return;
      }

      if (btn.id === 'text-color-btn') {
        DOM.textColorPopover.classList.toggle('hidden');
        return;
      }

      if (btn.id === 'font-size-btn') {
        DOM.fontSizePopover.classList.toggle('hidden');
        return;
      }

      const cmd = btn.dataset.cmd;
      const val = btn.dataset.val || null;

      if (cmd === 'createLink') {
        const url = prompt('Ingresá la URL:');
        if (url) document.execCommand('createLink', false, url);
      } else if (val) {
        document.execCommand(cmd, false, val);
      } else {
        document.execCommand(cmd, false, null);
      }
      DOM.editorContent.focus();
    });
  });

  // Color de texto: click en un swatch aplica el color a la selección
  DOM.textColorPopover.querySelectorAll('.color-swatch').forEach(swatch => {
    swatch.addEventListener('click', e => {
      e.preventDefault();
      const color = swatch.dataset.color;
      document.execCommand('foreColor', false, color || 'inherit');
      DOM.textColorSwatch.style.borderBottomColor = color || '#e03131';
      DOM.textColorPopover.classList.add('hidden');
      DOM.editorContent.focus();
    });
  });

  // Tamaño de letra: click en una opción aplica el tamaño a la selección
  DOM.fontSizePopover.querySelectorAll('.size-option').forEach(opt => {
    opt.addEventListener('click', e => {
      e.preventDefault();
      applyFontSize(opt.dataset.size);
      DOM.fontSizePopover.classList.add('hidden');
      DOM.editorContent.focus();
    });
  });

  document.addEventListener('click', e => {
    if (!DOM.textColorPopover.classList.contains('hidden') &&
        !e.target.closest('.toolbar-color-wrap')) {
      DOM.textColorPopover.classList.add('hidden');
    }
    if (!DOM.fontSizePopover.classList.contains('hidden') &&
        !e.target.closest('.toolbar-size-wrap')) {
      DOM.fontSizePopover.classList.add('hidden');
    }
  });

  // Listen for content changes
  DOM.editorContent.addEventListener('input', scheduleAutosave);
  DOM.pageTitleInput.addEventListener('input', scheduleAutosave);

  // Keyboard shortcuts
  DOM.editorContent.addEventListener('keydown', e => {
    if ((e.ctrlKey || e.metaKey)) {
      if (e.key === 'b') { e.preventDefault(); document.execCommand('bold'); }
      if (e.key === 'i') { e.preventDefault(); document.execCommand('italic'); }
      if (e.key === 'u') { e.preventDefault(); document.execCommand('underline'); }
    }
  });

  // Tareas: tildar casillero = resuelta (se tacha y se oculta del Resumen);
  // click en la etiqueta = rota la prioridad Alta → Media → Baja.
  DOM.editorContent.addEventListener('click', e => {
    const checkbox = e.target.closest('.task-checkbox');
    if (checkbox) {
      const item = checkbox.closest('.task-item');
      const done = checkbox.checked;
      item.classList.toggle('task-done', done);
      checkbox.toggleAttribute('checked', done);
      scheduleAutosave();
      return;
    }

    const tag = e.target.closest('.task-priority-tag');
    if (tag) {
      const order = ['alta', 'media', 'baja'];
      const next = order[(order.indexOf(tag.dataset.priority) + 1) % order.length];
      tag.dataset.priority = next;
      tag.textContent = capitalizeFirst(next);
      tag.closest('.task-item').dataset.priority = next;
      scheduleAutosave();
    }
  });
}

// execCommand no tiene un comando directo para un tamaño en píxeles: se
// envuelve la selección con 'fontSize' (nivel 7, el más raro de encontrar
// ya puesto) y después se reemplaza cada <font size="7"> resultante por un
// <span> con el font-size real, o sin estilo si se eligió "Normal".
function applyFontSize(px) {
  document.execCommand('fontSize', false, '7');
  DOM.editorContent.querySelectorAll('font[size="7"]').forEach(el => {
    const span = document.createElement('span');
    if (px) span.style.fontSize = px + 'px';
    while (el.firstChild) span.appendChild(el.firstChild);
    el.replaceWith(span);
  });
}

// Inserta un ítem de tarea (casillero + texto + prioridad) en la posición
// del cursor. Tildar el casillero la marca resuelta; la etiqueta de
// prioridad rota entre Alta/Media/Baja al clickearla.
function insertTask() {
  const tempId = 'tmp-task-' + Date.now();
  const html = `<div class="task-item" data-priority="media"><input type="checkbox" class="task-checkbox"><span class="task-text" id="${tempId}">Nueva tarea</span><button type="button" class="task-priority-tag" data-priority="media">Media</button></div><p><br></p>`;
  document.execCommand('insertHTML', false, html);

  const textEl = document.getElementById(tempId);
  if (textEl) {
    textEl.removeAttribute('id');
    const range = document.createRange();
    range.selectNodeContents(textEl);
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
  }
  DOM.editorContent.focus();
  scheduleAutosave();
}

// Inserta un nuevo bloque fechado ("<hr><h2>fecha</h2>") al final de la
// página actual, con la fecha elegida a mano en el calendario (no la de hoy).
function openInsertDateModal() {
  openModal({
    title: 'Insertar nueva fecha',
    body: `
      <div class="form-group">
        <label>Fecha</label>
        <input id="m-insert-date" type="date" value="${todayInputValue()}" />
      </div>
    `,
    footer: `
      <button class="btn-sm" id="m-cancel-btn">Cancelar</button>
      <button class="btn-sm primary" id="m-confirm-btn">Insertar</button>
    `,
  });

  $('m-cancel-btn').addEventListener('click', closeModal);
  $('m-confirm-btn').addEventListener('click', () => {
    const dateValue = $('m-insert-date').value;
    if (!dateValue) return;

    const label = formatDayLabel(parseDateInputValue(dateValue));
    DOM.editorContent.innerHTML += `<hr><h2>${label}</h2><p><br></p>`;
    scheduleAutosave();
    closeModal();
    DOM.editorContent.focus();
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// WIKI — ANTECEDENTES PANEL (ficha fija por página: comuna, encargados, m², unidades)
// ═══════════════════════════════════════════════════════════════════════════

function normalizeAntecedentes(raw) {
  // m2Total: si la página venía del esquema viejo (lista de m² por unidad),
  // se suma esa lista como valor de arranque para no perder lo ya cargado.
  const legacyM2Sum = Array.isArray(raw?.m2)
    ? raw.m2.reduce((sum, x) => sum + (Number(x.valor) || 0), 0)
    : null;

  return {
    comuna: raw?.comuna || '',
    unidades: (raw?.unidades === 0 || raw?.unidades) ? Number(raw.unidades) : null,
    m2Total: (raw?.m2Total === 0 || raw?.m2Total) ? Number(raw.m2Total) : legacyM2Sum,
    encargados: Array.isArray(raw?.encargados) ? raw.encargados.slice() : [],
  };
}

function renderAntecedentesPanel(canEdit) {
  const a = state.antecedentes;

  // Si la comuna guardada no está entre las opciones fijas (dato legado en
  // texto libre), se agrega como opción extra para no perder el valor.
  if (a.comuna && !Array.from(DOM.antComuna.options).some(o => o.value === a.comuna)) {
    const legacyOpt = new Option(a.comuna, a.comuna);
    DOM.antComuna.add(legacyOpt);
  }
  DOM.antComuna.value = a.comuna || '';
  DOM.antComuna.disabled = !canEdit;

  DOM.antUnidades.value = a.unidades ?? '';
  DOM.antUnidades.disabled = !canEdit;

  DOM.antM2Total.value = a.m2Total ?? '';
  DOM.antM2Total.disabled = !canEdit;

  DOM.antEncargadoInput.disabled = !canEdit;
  DOM.antEncargadoAddBtn.style.display = canEdit ? '' : 'none';
  DOM.antEncargadoInput.style.display = canEdit ? '' : 'none';

  renderEncargadosChips(canEdit);
  renderEncargadosDatalist();
}

// Sugerencias del datalist: nombres únicos ya cargados en cualquier página,
// para no tener que retipear un encargado que se usó antes.
function renderEncargadosDatalist() {
  const names = new Set();
  state.pages.forEach(p => (p.antecedentes?.encargados || []).forEach(n => names.add(n)));
  state.antecedentes.encargados.forEach(n => names.add(n));

  DOM.antEncargadosDatalist.innerHTML = Array.from(names)
    .sort((a, b) => a.localeCompare(b, 'es'))
    .map(n => `<option value="${escHtml(n)}"></option>`)
    .join('');
}

function renderEncargadosChips(canEdit) {
  const list = state.antecedentes.encargados;
  DOM.antEncargadosChips.innerHTML = list.length
    ? list.map((name, i) => `
      <span class="ant-chip">
        ${escHtml(name)}
        ${canEdit ? `<button type="button" class="ant-chip-remove" data-index="${i}" title="Quitar">×</button>` : ''}
      </span>
    `).join('')
    : '<span class="ant-empty-hint">Sin encargados</span>';

  DOM.antEncargadosChips.querySelectorAll('.ant-chip-remove').forEach(btn => {
    btn.addEventListener('click', () => {
      state.antecedentes.encargados.splice(parseInt(btn.dataset.index, 10), 1);
      renderEncargadosChips(true);
      saveAntecedentesNow();
    });
  });
}

function addEncargado() {
  const name = DOM.antEncargadoInput.value.trim();
  if (!name) return;
  state.antecedentes.encargados.push(name);
  DOM.antEncargadoInput.value = '';
  renderEncargadosChips(true);
  renderEncargadosDatalist();
  saveAntecedentesNow();
  DOM.antEncargadoInput.focus();
}

// Guarda de inmediato (sin el debounce de 1.2s de scheduleAutosave) para
// acciones puntuales de lista (agregar/quitar) donde el usuario espera que
// quede guardado ya mismo, incluso si recarga la página al toque.
function saveAntecedentesNow() {
  clearTimeout(state.autosaveTimer);
  setSaveIndicator('saving');
  performAutosave();
}

function initAntecedentesPanel() {
  DOM.antComuna.addEventListener('change', () => {
    state.antecedentes.comuna = DOM.antComuna.value;
    scheduleAutosave();
  });

  DOM.antUnidades.addEventListener('input', () => {
    const v = DOM.antUnidades.value;
    state.antecedentes.unidades = v === '' ? null : Number(v);
    scheduleAutosave();
  });

  DOM.antM2Total.addEventListener('input', () => {
    const v = DOM.antM2Total.value;
    state.antecedentes.m2Total = v === '' ? null : Number(v);
    scheduleAutosave();
  });

  DOM.antEncargadoAddBtn.addEventListener('click', addEncargado);
  DOM.antEncargadoInput.addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); addEncargado(); }
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// WIKI — SECTIONS CRUD
// ═══════════════════════════════════════════════════════════════════════════

function colorGridHTML(selected) {
  return `
    <div class="color-grid">
      ${SECTION_COLORS.map(c => `
        <div
          class="color-swatch${c === selected ? ' selected' : ''}"
          style="background:${c}"
          data-color="${c}"
          title="${c}"
        ></div>
      `).join('')}
    </div>
  `;
}

function bindColorGrid(container, onSelect) {
  let selected = container.querySelector('.color-swatch.selected')?.dataset.color || SECTION_COLORS[0];
  onSelect(selected);

  container.querySelectorAll('.color-swatch').forEach(sw => {
    sw.addEventListener('click', () => {
      container.querySelectorAll('.color-swatch').forEach(s => s.classList.remove('selected'));
      sw.classList.add('selected');
      selected = sw.dataset.color;
      onSelect(selected);
    });
  });
}

function openCreateSectionModal() {
  let selectedColor = SECTION_COLORS[0];

  openModal({
    title: 'Crear sección',
    body: `
      <div class="form-group">
        <label>Nombre de la sección</label>
        <input id="m-section-name" type="text" placeholder="Reuniones de equipo" maxlength="60" />
      </div>
      <div class="form-group">
        <label>Color</label>
        ${colorGridHTML(selectedColor)}
      </div>
      <div id="m-section-error" class="form-error" style="display:none"></div>
    `,
    footer: `
      <button class="btn-sm" id="m-cancel-btn">Cancelar</button>
      <button class="btn-sm primary" id="m-confirm-btn">Crear sección</button>
    `,
  });

  bindColorGrid(DOM.modalBody.querySelector('.color-grid'), c => { selectedColor = c; });

  $('m-cancel-btn').addEventListener('click', closeModal);
  $('m-confirm-btn').addEventListener('click', async () => {
    const name = $('m-section-name').value.trim();
    if (!name) { $('m-section-error').textContent = 'Ingresá un nombre.'; $('m-section-error').style.display='block'; return; }

    $('m-confirm-btn').disabled = true;
    $('m-confirm-btn').textContent = 'Creando...';
    try {
      const docRef = await db.collection('sections').add({
        name,
        color: selectedColor,
        allowedUids: [],
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      });
      state.sections.push({ id: docRef.id, name, color: selectedColor, allowedUids: [], createdAt: new Date() });
      closeModal();
      renderWikiSidebar();
      toast('Sección creada correctamente', 'success');
    } catch (err) {
      const msg = err.code === 'permission-denied'
        ? 'Sin permisos. Verificá las reglas de Firestore en Firebase Console.'
        : 'Error al crear: ' + err.message;
      $('m-section-error').textContent = msg;
      $('m-section-error').style.display = 'block';
      toast(msg, 'error');
      $('m-confirm-btn').disabled = false;
      $('m-confirm-btn').textContent = 'Crear sección';
    }
  });
}

function openEditSectionModal(section) {
  let selectedColor = section.color || SECTION_COLORS[0];

  openModal({
    title: 'Editar sección',
    body: `
      <div class="form-group">
        <label>Nombre</label>
        <input id="m-section-name" type="text" value="${escHtml(section.name)}" maxlength="60" />
      </div>
      <div class="form-group">
        <label>Color</label>
        ${colorGridHTML(selectedColor)}
      </div>
      <div id="m-section-error" class="form-error" style="display:none"></div>
    `,
    footer: `
      <button class="btn-sm" id="m-cancel-btn">Cancelar</button>
      <button class="btn-sm primary" id="m-confirm-btn">Guardar</button>
    `,
  });

  bindColorGrid(DOM.modalBody.querySelector('.color-grid'), c => { selectedColor = c; });

  $('m-cancel-btn').addEventListener('click', closeModal);
  $('m-confirm-btn').addEventListener('click', async () => {
    const name = $('m-section-name').value.trim();
    if (!name) { $('m-section-error').textContent = 'Ingresá un nombre.'; $('m-section-error').style.display='block'; return; }

    $('m-confirm-btn').disabled = true;
    try {
      await db.collection('sections').doc(section.id).update({ name, color: selectedColor });
      const s = state.sections.find(x => x.id === section.id);
      if (s) { s.name = name; s.color = selectedColor; }
      closeModal();
      renderWikiSidebar();
      toast('Sección actualizada', 'success');
    } catch (err) {
      $('m-section-error').textContent = 'Error: ' + err.message;
      $('m-section-error').style.display = 'block';
      $('m-confirm-btn').disabled = false;
      $('m-confirm-btn').textContent = 'Guardar';
    }
  });
}

async function confirmDeleteSection(sectionId) {
  const section = state.sections.find(s => s.id === sectionId);
  if (!section) return;

  const pages = getPagesForSection(sectionId);

  openModal({
    title: 'Eliminar sección',
    body: `
      <p>¿Estás seguro de que querés eliminar <strong>${escHtml(section.name)}</strong>?</p>
      ${pages.length > 0 ? `<p style="margin-top:8px;color:var(--danger)">Esto eliminará también las <strong>${pages.length} página(s)</strong> dentro de esta sección.</p>` : ''}
    `,
    footer: `
      <button class="btn-sm" id="m-cancel-btn">Cancelar</button>
      <button class="btn-sm danger" id="m-confirm-btn">Eliminar</button>
    `,
  });

  $('m-cancel-btn').addEventListener('click', closeModal);
  $('m-confirm-btn').addEventListener('click', async () => {
    $('m-confirm-btn').disabled = true;
    try {
      const batch = db.batch();
      batch.delete(db.collection('sections').doc(sectionId));
      pages.forEach(p => batch.delete(db.collection('pages').doc(p.id)));
      await batch.commit();

      state.sections = state.sections.filter(s => s.id !== sectionId);
      state.pages    = state.pages.filter(p => p.sectionId !== sectionId);

      if (pages.some(p => p.id === state.currentPageId)) {
        state.currentPageId = null;
        DOM.editorContainer.classList.add('hidden');
        DOM.editorEmptyState.classList.remove('hidden');
      }

      closeModal();
      renderWikiSidebar();
      toast('Sección eliminada', 'success');
    } catch (err) {
      toast('Error al eliminar: ' + err.message, 'error');
      closeModal();
    }
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// WIKI — PAGES CRUD
// ═══════════════════════════════════════════════════════════════════════════

function openCreatePageModal(sectionId) {
  openModal({
    title: 'Nueva página',
    body: `
      <div class="form-group">
        <label>Título de la página</label>
        <input id="m-page-title" type="text" placeholder="Nombre de la reunión o tema" maxlength="120" />
      </div>
      <div class="form-group">
        <label>Fecha</label>
        <input id="m-page-date" type="date" value="${todayInputValue()}" />
      </div>
      <div id="m-page-error" class="form-error" style="display:none"></div>
    `,
    footer: `
      <button class="btn-sm" id="m-cancel-btn">Cancelar</button>
      <button class="btn-sm primary" id="m-confirm-btn">Crear página</button>
    `,
  });

  $('m-cancel-btn').addEventListener('click', closeModal);
  $('m-confirm-btn').addEventListener('click', async () => {
    const title = $('m-page-title').value.trim();
    if (!title) { $('m-page-error').textContent = 'Ingresá un título.'; $('m-page-error').style.display='block'; return; }
    const dateValue = $('m-page-date').value;
    if (!dateValue) { $('m-page-error').textContent = 'Elegí una fecha.'; $('m-page-error').style.display='block'; return; }

    $('m-confirm-btn').disabled = true;
    try {
      const maxOrder = state.pages.filter(p => p.sectionId === sectionId).reduce((m, p) => Math.max(m, p.order || 0), 0);
      const fechaCapitalizada = formatDayLabel(parseDateInputValue(dateValue));
      const initialContent = `<h2>${fechaCapitalizada}</h2><p><br></p>`;
      const initialAntecedentes = normalizeAntecedentes({});
      const docRef = await db.collection('pages').add({
        sectionId,
        title,
        content: initialContent,
        antecedentes: initialAntecedentes,
        order: maxOrder + 1,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
        updatedBy: state.authUser.uid,
      });
      const newPage = { id: docRef.id, sectionId, title, content: initialContent, antecedentes: initialAntecedentes, order: maxOrder + 1 };
      state.pages.push(newPage);
      closeModal();
      renderWikiSidebar();
      loadPage(docRef.id);
      toast('Página creada correctamente', 'success');
    } catch (err) {
      const msg = err.code === 'permission-denied'
        ? 'Sin permisos. Verificá las reglas de Firestore en Firebase Console.'
        : 'Error: ' + err.message;
      $('m-page-error').textContent = msg;
      $('m-page-error').style.display = 'block';
      toast(msg, 'error');
      $('m-confirm-btn').disabled = false;
      $('m-confirm-btn').textContent = 'Crear página';
    }
  });
}

async function confirmDeletePage(pageId) {
  const page = state.pages.find(p => p.id === pageId);
  if (!page) return;

  openModal({
    title: 'Eliminar página',
    body: `<p>¿Eliminar la página <strong>${escHtml(page.title || 'Sin título')}</strong>? Esta acción no se puede deshacer.</p>`,
    footer: `
      <button class="btn-sm" id="m-cancel-btn">Cancelar</button>
      <button class="btn-sm danger" id="m-confirm-btn">Eliminar</button>
    `,
  });

  $('m-cancel-btn').addEventListener('click', closeModal);
  $('m-confirm-btn').addEventListener('click', async () => {
    $('m-confirm-btn').disabled = true;
    try {
      await db.collection('pages').doc(pageId).delete();
      state.pages = state.pages.filter(p => p.id !== pageId);

      if (state.currentPageId === pageId) {
        state.currentPageId = null;
        DOM.editorContainer.classList.add('hidden');
        DOM.editorEmptyState.classList.remove('hidden');
      }

      closeModal();
      renderWikiSidebar();
      toast('Página eliminada', 'success');
    } catch (err) {
      toast('Error al eliminar: ' + err.message, 'error');
      closeModal();
    }
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// RESUMEN MENSUAL
// ═══════════════════════════════════════════════════════════════════════════
//
// Cada página de Reuniones va acumulando entradas fechadas, separadas por
// <hr>, donde la primera línea de cada entrada es un <h2> con la fecha en
// español (insertada a mano con "Insertar fecha"). Este módulo detecta esas
// fechas de TODAS las secciones/páginas accesibles, arma meses calendario
// y, dentro de cada mes, agrupa todo por día — para que se pueda elegir un
// mes e imprimir un resumen único para repartir.

const MESES_ES = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
const DIAS_ES  = ['domingo','lunes','martes','miércoles','jueves','viernes','sábado'];
const DATE_HEADING_RE = /(\d{1,2})\s+de\s+(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre)(?:\s+de)?\s+(\d{4})/i;

const resumenState = {
  months: [],     // [{ key, month, entries: [...] }], más reciente primero
  currentIndex: -1,
};

// Clave "AAAA-MM-DD" en hora LOCAL (no usar toISOString: en husos horarios
// adelantados a UTC corre la fecha un día para atrás).
function dateKey(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function formatDayLabel(date) {
  const label = `${DIAS_ES[date.getDay()]}, ${date.getDate()} de ${MESES_ES[date.getMonth()]} de ${date.getFullYear()}`;
  return capitalizeFirst(label);
}

function monthStart(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function monthKey(month) {
  return `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, '0')}`;
}

function formatMonthLabel(month) {
  return capitalizeFirst(`${MESES_ES[month.getMonth()]} de ${month.getFullYear()}`);
}

// Splits a page's HTML content into dated entries using <hr> as separator
// and the leading <h2> of each chunk as the date marker.
function capitalizeFirst(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

// Saca del resumen lo tachado (texto suelto con el botón "S") y las tareas
// ya resueltas (casillero tildado): el resumen es para ver qué queda
// pendiente, no un historial de todo lo que se escribió.
function stripResolvedContent(html) {
  const tmp = document.createElement('div');
  tmp.innerHTML = html;
  tmp.querySelectorAll('s, strike, .task-item.task-done').forEach(el => el.remove());
  tmp.querySelectorAll('.task-checkbox').forEach(cb => cb.disabled = true);
  return tmp.innerHTML;
}

// Busca la fecha "D de MES [de] AAAA" de un bloque. Primero intenta un
// encabezado (H1–H6: la fecha se puede insertar con el botón de calendario,
// que usa H2, o el usuario puede haberla escrito a mano con cualquier
// tamaño de título) — eso además indica dónde termina el título y empieza
// el cuerpo. Si no hay ningún encabezado con fecha, busca el mismo patrón
// en cualquier parte del texto del bloque (alguien la escribió en un
// párrafo suelto, en negrita, etc., sin usar los botones de encabezado).
function extractChunkDate(chunk) {
  const headingMatch = chunk.match(/<h[1-6][^>]*>([\s\S]*?)<\/h[1-6]>/i);
  if (headingMatch) {
    const label = headingMatch[1].replace(/<[^>]+>/g, '').trim();
    const dm = label.match(DATE_HEADING_RE);
    if (dm) {
      return { dm, dateLabel: label, bodyHtml: chunk.slice(headingMatch.index + headingMatch[0].length) };
    }
  }

  const plainText = chunk.replace(/<[^>]+>/g, ' ');
  const dm = plainText.match(DATE_HEADING_RE);
  if (dm) {
    return { dm, dateLabel: dm[0].trim(), bodyHtml: chunk };
  }

  return null;
}

// Un chunk sin ninguna fecha reconocible (nunca se le insertó fecha, o no
// matchea el formato) no tiene una fecha real que mostrar y se descarta del
// Resumen — no se usa como respaldo la fecha de última edición, porque eso
// hacía aparecer contenido bajo una fecha que no es la que está puesta en
// la página.
function splitPageIntoEntries(page) {
  const html = page.content || '';
  if (!html.trim()) return [];

  const chunks = html.split(/<hr\s*\/?>/i);
  const entries = [];

  chunks.forEach(chunk => {
    const found = extractChunkDate(chunk);
    if (!found) return;

    const { dm, dateLabel, bodyHtml } = found;
    const day   = parseInt(dm[1], 10);
    const month = MESES_ES.indexOf(dm[2].toLowerCase());
    const year  = parseInt(dm[3], 10);
    const date  = new Date(year, month, day);
    if (isNaN(date.getTime())) return;

    const visibleHtml = stripResolvedContent(bodyHtml);

    const isEmpty = visibleHtml
      .replace(/<(p|div)>\s*(<br\s*\/?>)?\s*<\/(p|div)>/gi, '')
      .replace(/\s|&nbsp;/g, '').length === 0;
    if (isEmpty) return;

    entries.push({ date, dateLabel, html: visibleHtml });
  });

  return entries;
}

// Groups every dated entry from every accessible section/page into months.
//
// Una página puede tener varios bloques con fecha real (una por cada vez
// que se usó "Insertar fecha"); cada uno cuenta por separado bajo su propia
// fecha, así que una misma página puede aportar contenido a más de un mes
// si tiene entradas puestas en días distintos.
function buildMonthlyData() {
  const sections = getAccessibleSections();
  const sectionById = Object.fromEntries(sections.map(s => [s.id, s]));
  const monthsMap = new Map();

  state.pages.forEach(page => {
    const section = sectionById[page.sectionId];
    if (!section) return; // sección no accesible para este usuario

    splitPageIntoEntries(page).forEach(seg => {
      const month = monthStart(seg.date);
      const key = monthKey(month);
      if (!monthsMap.has(key)) {
        monthsMap.set(key, { key, month, entries: [] });
      }
      monthsMap.get(key).entries.push({
        section, page, date: seg.date, dateLabel: seg.dateLabel, html: seg.html,
      });
    });
  });

  const months = Array.from(monthsMap.values());
  months.forEach(m => {
    m.entries.sort((a, b) =>
      a.date - b.date ||
      a.section.name.localeCompare(b.section.name) ||
      (a.page.title || '').localeCompare(b.page.title || '')
    );
  });
  months.sort((a, b) => b.month - a.month); // más reciente primero

  return months;
}

async function loadResumen() {
  try {
    const [sectionsSnap, pagesSnap] = await Promise.all([
      db.collection('sections').orderBy('createdAt').get(),
      db.collection('pages').orderBy('order').get(),
    ]);
    state.sections = sectionsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    state.pages    = pagesSnap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (err) {
    console.error('loadResumen error:', err);
    toast('Error al cargar el resumen: ' + err.message, 'error');
  }

  resumenState.months = buildMonthlyData();

  // Mantener el mes seleccionado si sigue existiendo; si no, ir al más reciente
  const prevKey = resumenState.months[resumenState.currentIndex]?.key;
  let idx = prevKey ? resumenState.months.findIndex(m => m.key === prevKey) : -1;
  if (idx === -1) idx = resumenState.months.length > 0 ? 0 : -1;
  resumenState.currentIndex = idx;

  renderResumenSidebar();
  renderResumenMonth();
}

function selectResumenMonth(index) {
  resumenState.currentIndex = index;
  renderResumenSidebar();
  renderResumenMonth();
}

function renderResumenSidebar() {
  const list = DOM.resumenWeeksList;

  if (resumenState.months.length === 0) {
    list.innerHTML = '<div class="empty-state"><p>No hay resúmenes fechados aún.<br>Se generan automáticamente a partir de las fechas en Reuniones.</p></div>';
    return;
  }

  const currentMonthKey = monthKey(monthStart(new Date()));

  list.innerHTML = resumenState.months.map((m, i) => `
    <div class="resumen-week-item${i === resumenState.currentIndex ? ' active' : ''}" data-index="${i}">
      <span class="resumen-week-name">${formatMonthLabel(m.month)}${m.key === currentMonthKey ? ' <span class="resumen-week-tag">Actual</span>' : ''}</span>
      <span class="resumen-week-count">${m.entries.length} entrada${m.entries.length === 1 ? '' : 's'}</span>
    </div>
  `).join('');

  list.querySelectorAll('.resumen-week-item').forEach(el => {
    el.addEventListener('click', () => {
      selectResumenMonth(parseInt(el.dataset.index, 10));
      DOM.resumenSidebar.classList.remove('open');
    });
  });
}

function renderResumenMonth() {
  const month = resumenState.months[resumenState.currentIndex];

  if (!month) {
    DOM.resumenEmptyState.classList.remove('hidden');
    DOM.resumenReportContainer.classList.add('hidden');
    return;
  }

  DOM.resumenEmptyState.classList.add('hidden');
  DOM.resumenReportContainer.classList.remove('hidden');

  DOM.resumenWeekLabel.textContent = formatMonthLabel(month.month);
  const totalSections = new Set(month.entries.map(e => e.section.id)).size;
  DOM.resumenWeekMeta.textContent = `${month.entries.length} entrada${month.entries.length === 1 ? '' : 's'} · ${totalSections} ${totalSections === 1 ? 'sección' : 'secciones'}`;

  DOM.resumenPrevBtn.disabled = resumenState.currentIndex >= resumenState.months.length - 1;
  DOM.resumenNextBtn.disabled = resumenState.currentIndex <= 0;

  // Dentro del mes, agrupa cronológicamente por día — todo lo que pasó
  // ese día, sin importar la sección.
  const byDay = new Map();
  month.entries.forEach(e => {
    const key = dateKey(e.date);
    if (!byDay.has(key)) byDay.set(key, { date: e.date, entries: [] });
    byDay.get(key).entries.push(e);
  });
  const days = Array.from(byDay.values()).sort((a, b) => a.date - b.date);

  const generadoLabel = new Date().toLocaleDateString('es-AR', { year: 'numeric', month: 'long', day: 'numeric' });

  const daysHtml = days.map(({ date, entries }) => {
    const entriesHtml = entries.map(e => `
      <div class="resumen-entry">
        <div class="resumen-entry-meta">
          <span class="resumen-entry-section" style="background:${e.section.color || '#6b7280'}">${escHtml(e.section.name)}</span>
          <span class="resumen-entry-page">${escHtml(e.page.title || 'Sin título')}</span>
        </div>
        <div class="resumen-entry-body">${e.html}</div>
      </div>
    `).join('');

    return `
      <div class="resumen-day-block">
        <h3 class="resumen-day-title">${escHtml(formatDayLabel(date))}</h3>
        ${entriesHtml}
      </div>
    `;
  }).join('');

  DOM.resumenReport.innerHTML = `
    <div class="resumen-print-header">
      <div class="resumen-print-brand">AiA Arquitectos</div>
      <h1 class="resumen-print-title">${formatMonthLabel(month.month)}</h1>
      <div class="resumen-print-sub">Resumen mensual de reuniones · Generado el ${generadoLabel}</div>
    </div>
    ${daysHtml || '<div class="empty-state"><p>Sin entradas para este mes.</p></div>'}
  `;
}

DOM.resumenPrevBtn.addEventListener('click', () => {
  if (resumenState.currentIndex < resumenState.months.length - 1) {
    selectResumenMonth(resumenState.currentIndex + 1);
  }
});

DOM.resumenNextBtn.addEventListener('click', () => {
  if (resumenState.currentIndex > 0) {
    selectResumenMonth(resumenState.currentIndex - 1);
  }
});

DOM.resumenPrintBtn.addEventListener('click', () => {
  window.print();
});

// ═══════════════════════════════════════════════════════════════════════════
// ADMIN — USERS TAB
// ═══════════════════════════════════════════════════════════════════════════

async function loadAdminUsers() {
  DOM.usersTableBody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:var(--text-muted);padding:20px">Cargando...</td></tr>';

  try {
    const snap = await db.collection('users').orderBy('createdAt').get();
    const users = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderUsersTable(users);
  } catch (err) {
    DOM.usersTableBody.innerHTML = `<tr><td colspan="6" style="color:var(--danger);padding:12px">Error: ${err.message}</td></tr>`;
  }
}

function renderUsersTable(users) {
  if (users.length === 0) {
    DOM.usersTableBody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:var(--text-muted);padding:20px">No hay usuarios</td></tr>';
    return;
  }

  DOM.usersTableBody.innerHTML = users.map(u => `
    <tr data-uid="${u.uid}">
      <td><strong>${escHtml(u.name || '—')}</strong></td>
      <td style="color:var(--text-muted)">${escHtml(u.email)}</td>
      <td>
        <select class="role-select" data-uid="${u.uid}" ${u.uid === state.authUser.uid ? 'disabled title="No podés cambiar tu propio rol"' : ''}>
          <option value="admin"  ${u.role==='admin'  ? 'selected' : ''}>Admin</option>
          <option value="editor" ${u.role==='editor' ? 'selected' : ''}>Editor</option>
          <option value="viewer" ${u.role==='viewer' ? 'selected' : ''}>Viewer</option>
        </select>
      </td>
      <td>
        <span class="status-badge ${u.disabled ? 'disabled' : 'active'}">
          ${u.disabled ? 'Desactivado' : 'Activo'}
        </span>
      </td>
      <td style="color:var(--text-muted);font-size:12px">${formatDate(u.createdAt)}</td>
      <td>
        <button
          class="btn-sm ${u.disabled ? 'success' : 'danger'} toggle-user-btn"
          data-uid="${u.uid}"
          data-disabled="${u.disabled}"
          ${u.uid === state.authUser.uid ? 'disabled title="No podés desactivarte a vos mismo"' : ''}
        >
          ${u.disabled ? 'Activar' : 'Desactivar'}
        </button>
      </td>
    </tr>
  `).join('');

  // Role change handlers
  DOM.usersTableBody.querySelectorAll('.role-select').forEach(sel => {
    sel.addEventListener('change', async () => {
      const uid  = sel.dataset.uid;
      const role = sel.value;
      try {
        await db.collection('users').doc(uid).update({ role });
        toast('Rol actualizado', 'success');
      } catch (err) {
        toast('Error al actualizar rol: ' + err.message, 'error');
        loadAdminUsers();
      }
    });
  });

  // Toggle disable handlers
  DOM.usersTableBody.querySelectorAll('.toggle-user-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const uid      = btn.dataset.uid;
      const disabled = btn.dataset.disabled === 'true';
      try {
        await db.collection('users').doc(uid).update({ disabled: !disabled });
        toast(`Usuario ${disabled ? 'activado' : 'desactivado'}`, 'success');
        loadAdminUsers();
      } catch (err) {
        toast('Error: ' + err.message, 'error');
      }
    });
  });

  // Create user button
  DOM.createUserBtn.onclick = () => openCreateUserModal();
}

function openCreateUserModal() {
  openModal({
    title: 'Crear usuario',
    body: `
      <div class="form-group">
        <label>Nombre completo</label>
        <input id="m-name" type="text" placeholder="Ana García" maxlength="80" />
      </div>
      <div class="form-group">
        <label>Email</label>
        <input id="m-email" type="email" placeholder="ana@empresa.com" />
      </div>
      <div class="form-group">
        <label>Contraseña</label>
        <input id="m-password" type="password" placeholder="Mínimo 6 caracteres" minlength="6" />
        <div class="form-hint">El usuario podrá cambiarla después.</div>
      </div>
      <div class="form-group">
        <label>Rol</label>
        <select id="m-role">
          <option value="viewer">Viewer — solo lectura</option>
          <option value="editor">Editor — puede editar páginas</option>
          <option value="admin">Admin — acceso total</option>
        </select>
      </div>
      <div id="m-user-error" class="form-error" style="display:none"></div>
    `,
    footer: `
      <button class="btn-sm" id="m-cancel-btn">Cancelar</button>
      <button class="btn-sm primary" id="m-confirm-btn">Crear usuario</button>
    `,
  });

  $('m-cancel-btn').addEventListener('click', closeModal);
  $('m-confirm-btn').addEventListener('click', async () => {
    const name     = $('m-name').value.trim();
    const email    = $('m-email').value.trim();
    const password = $('m-password').value;
    const role     = $('m-role').value;
    const errEl    = $('m-user-error');

    if (!name || !email || !password) {
      errEl.textContent = 'Completá todos los campos.';
      errEl.style.display = 'block';
      return;
    }
    if (password.length < 6) {
      errEl.textContent = 'La contraseña debe tener al menos 6 caracteres.';
      errEl.style.display = 'block';
      return;
    }

    $('m-confirm-btn').disabled = true;
    $('m-confirm-btn').textContent = 'Creando...';

    try {
      const idToken = await state.authUser.getIdToken();
      const res = await fetch(`${API_BASE}/api/users`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`,
        },
        body: JSON.stringify({ name, email, password, role }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error del servidor');

      closeModal();
      toast('Usuario creado exitosamente', 'success');
      loadAdminUsers();
    } catch (err) {
      errEl.textContent = err.message;
      errEl.style.display = 'block';
      $('m-confirm-btn').disabled = false;
      $('m-confirm-btn').textContent = 'Crear usuario';
    }
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// ADMIN — SECTIONS TAB
// ═══════════════════════════════════════════════════════════════════════════

async function loadAdminSections() {
  DOM.adminSectionsList.innerHTML = '<p style="color:var(--text-muted);font-size:13px">Cargando...</p>';

  try {
    const [sectionsSnap, pagesSnap, usersSnap] = await Promise.all([
      db.collection('sections').orderBy('createdAt').get(),
      db.collection('pages').get(),
      db.collection('users').get(),
    ]);

    const sections = sectionsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    const pages    = pagesSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    const users    = usersSnap.docs.map(d => ({ id: d.id, ...d.data() }));

    // Update local state
    state.sections = sections;
    state.pages    = pages;

    renderAdminSections(sections, pages, users);
  } catch (err) {
    DOM.adminSectionsList.innerHTML = `<p style="color:var(--danger)">Error: ${err.message}</p>`;
  }
}

function renderAdminSections(sections, pages, users) {
  if (sections.length === 0) {
    DOM.adminSectionsList.innerHTML = '<div class="empty-state"><p>No hay secciones. Creá una para comenzar.</p></div>';
    bindAdminSectionButtons(sections, pages, users);
    return;
  }

  DOM.adminSectionsList.innerHTML = sections.map(s => {
    const sectionPages   = pages.filter(p => p.sectionId === s.id);
    const allowedUsers   = users.filter(u => (s.allowedUids || []).includes(u.uid));
    const accessLabel    = allowedUsers.length === 0
      ? '<em style="color:var(--text-muted)">Sin acceso asignado</em>'
      : allowedUsers.map(u => `<span style="font-size:12px;background:var(--sidebar-bg);padding:2px 6px;border-radius:99px;margin:2px">${escHtml(u.name || u.email)}</span>`).join('');

    return `
      <div class="section-card" data-section-id="${s.id}">
        <div class="section-card-color" style="background:${s.color || '#6b7280'}"></div>
        <div class="section-card-info">
          <div class="section-card-name">${escHtml(s.name)}</div>
          <div class="section-card-meta">${sectionPages.length} página(s) · Acceso: ${accessLabel}</div>
        </div>
        <div class="section-card-actions">
          <button class="btn-sm js-manage-access" data-id="${s.id}" title="Gestionar accesos">👥 Accesos</button>
          <button class="btn-sm js-edit-section-admin" data-id="${s.id}">✏️ Editar</button>
          <button class="btn-sm danger js-delete-section-admin" data-id="${s.id}">🗑️</button>
        </div>
      </div>
    `;
  }).join('');

  bindAdminSectionButtons(sections, pages, users);
}

function bindAdminSectionButtons(sections, pages, users) {
  DOM.adminCreateSectionBtn.onclick = () => openCreateSectionModal();

  DOM.adminSectionsList.querySelectorAll('.js-manage-access').forEach(btn => {
    btn.addEventListener('click', () => {
      const section = sections.find(s => s.id === btn.dataset.id);
      if (section) openManageAccessModal(section, users);
    });
  });

  DOM.adminSectionsList.querySelectorAll('.js-edit-section-admin').forEach(btn => {
    btn.addEventListener('click', () => {
      const section = sections.find(s => s.id === btn.dataset.id);
      if (section) openEditSectionModal(section);
    });
  });

  DOM.adminSectionsList.querySelectorAll('.js-delete-section-admin').forEach(btn => {
    btn.addEventListener('click', () => confirmDeleteSection(btn.dataset.id));
  });
}

function openManageAccessModal(section, allUsers) {
  const editorViewers = allUsers.filter(u => u.role !== 'admin');
  const currentUids   = section.allowedUids || [];

  openModal({
    title: `Accesos — ${section.name}`,
    body: `
      <p style="font-size:13px;color:var(--text-muted);margin-bottom:12px">
        Seleccioná qué usuarios pueden ver y editar esta sección.
        Los administradores siempre tienen acceso.
      </p>
      <div class="access-list">
        ${editorViewers.length === 0
          ? '<p style="color:var(--text-muted);font-size:13px">No hay usuarios con rol editor o viewer.</p>'
          : editorViewers.map(u => `
            <div class="access-item">
              <input type="checkbox" id="acc-${u.uid}" value="${u.uid}" ${currentUids.includes(u.uid) ? 'checked' : ''} />
              <div class="access-item-info">
                <div class="access-item-name">${escHtml(u.name || u.email)}</div>
                <div class="access-item-email">${escHtml(u.email)} · <span class="role-badge ${u.role}">${u.role}</span></div>
              </div>
            </div>
          `).join('')
        }
      </div>
    `,
    footer: `
      <button class="btn-sm" id="m-cancel-btn">Cancelar</button>
      <button class="btn-sm primary" id="m-confirm-btn">Guardar accesos</button>
    `,
  });

  $('m-cancel-btn').addEventListener('click', closeModal);
  $('m-confirm-btn').addEventListener('click', async () => {
    const checked = Array.from(DOM.modalBody.querySelectorAll('input[type=checkbox]:checked')).map(cb => cb.value);

    $('m-confirm-btn').disabled = true;
    try {
      await db.collection('sections').doc(section.id).update({ allowedUids: checked });
      const s = state.sections.find(x => x.id === section.id);
      if (s) s.allowedUids = checked;
      closeModal();
      loadAdminSections();
      toast('Accesos actualizados', 'success');
    } catch (err) {
      toast('Error: ' + err.message, 'error');
      closeModal();
    }
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// ADMIN — ACTIVITY TAB
// ═══════════════════════════════════════════════════════════════════════════

async function loadActivity() {
  DOM.activityList.innerHTML = '<p style="color:var(--text-muted);font-size:13px">Cargando...</p>';

  try {
    const [pagesSnap, sectionsSnap, usersSnap] = await Promise.all([
      db.collection('pages').orderBy('updatedAt', 'desc').limit(100).get(),
      db.collection('sections').get(),
      db.collection('users').get(),
    ]);

    const pages    = pagesSnap.docs.map(d => ({ id: d.id, ...d.data() })).filter(p => p.updatedAt);
    const sections = Object.fromEntries(sectionsSnap.docs.map(d => [d.id, d.data()]));
    const users    = Object.fromEntries(usersSnap.docs.map(d => [d.id, d.data()]));

    if (pages.length === 0) {
      DOM.activityList.innerHTML = '<div class="empty-state"><p>No hay actividad registrada.</p></div>';
      return;
    }

    DOM.activityList.innerHTML = pages.map(p => {
      const section = sections[p.sectionId] || {};
      const user    = users[p.updatedBy] || {};
      return `
        <div class="activity-row">
          <div class="activity-icon">✏️</div>
          <div class="activity-text">
            <strong>${escHtml(p.title || 'Sin título')}</strong>
            <div class="activity-meta">
              ${section.name ? `<span style="background:${section.color||'#6b7280'};color:#fff;padding:1px 6px;border-radius:99px;font-size:11px">${escHtml(section.name)}</span> · ` : ''}
              ${escHtml(user.name || user.email || p.updatedBy || 'Desconocido')}
            </div>
          </div>
          <div class="activity-time">${formatDate(p.updatedAt)}</div>
        </div>
      `;
    }).join('');
  } catch (err) {
    DOM.activityList.innerHTML = `<p style="color:var(--danger)">Error: ${err.message}</p>`;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// MOBILE — WIKI SIDEBAR TOGGLE
// ═══════════════════════════════════════════════════════════════════════════

DOM.hamburger.addEventListener('click', () => {
  // If wiki/resumen is active, also toggle its own sidebar
  if (DOM.wikiModule.classList.contains('active')) {
    DOM.wikiSidebar.classList.toggle('open');
  }
  if (DOM.resumenModule.classList.contains('active')) {
    DOM.resumenSidebar.classList.toggle('open');
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// UTILS
// ═══════════════════════════════════════════════════════════════════════════

function escHtml(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatDate(ts) {
  if (!ts) return '—';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString('es-AR', {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}
