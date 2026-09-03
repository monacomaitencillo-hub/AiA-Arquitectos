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
const auth    = firebase.auth();
const db      = firebase.firestore();
const storage = firebase.storage();

const API_BASE = '';

// ═══════════════════════════════════════════════════════════════════════════
// STATE
// ═══════════════════════════════════════════════════════════════════════════

const state = {
  authUser:    null,   // Firebase Auth user object
  userData:    null,   // Firestore /users/{uid} doc
  sections:    [],
  pages:       [],
  dropboxLinks: {},   // { [linkId]: { name, url, allowedUids } }
  currentPageId: null,
  autosaveTimer: null,
  isDirty:     false,
  antecedentes: { comuna: '', unidades: null, m2Total: null, encargados: [], revisorArquitectura: [], calculista: [] },
  optionLists: { comunas: [], revisores: [], calculistas: [], encargados: [], emails: [] },
};

// Predefined section colors
const SECTION_COLORS = [
  '#ef4444','#f97316','#eab308','#22c55e',
  '#14b8a6','#3b82f6','#8b5cf6','#ec4899',
];

// Secciones fijas del módulo Planos. La mayoría ('dropbox', default) solo
// muestra un botón que abre una carpeta compartida de Dropbox en una
// pestaña nueva. Otros dos tipos, sin link:
//  - 'notes': mini-wiki con las obras (secciones/páginas) copiadas de
//    Reuniones, con notas de texto y archivos por obra (ver planosPages).
//  - 'library': sin obras — solo grupos que arma el usuario a mano (ej.
//    "OGUC", "Plan Regulador") para juntar PDFs sueltos (ver planosGroups).
// Puede haber varias entradas de cada tipo, cada una independiente de las
// demás (se distinguen por parentId = id de esta entrada).
const DROPBOX_LINKS = [
  { id: 'detalles-constructivos',    name: 'Detalles Constructivos',    icon: '📐' },
  { id: 'antecedentes-municipales',  name: 'Antecedentes Municipales',  icon: '🏛️', type: 'notes' },
  { id: 'normativas',                name: 'Normativas',                icon: '📖', type: 'library' },
  { id: 'proyectos-permiso',         name: 'Proyectos con Permiso',     icon: '📋' },
];

// ═══════════════════════════════════════════════════════════════════════════
// DOM REFS
// ═══════════════════════════════════════════════════════════════════════════

const $ = id => document.getElementById(id);

const DOM = {
  loading:           $('loading-overlay'),
  appBody:           $('app-body'),
  hamburger:         $('hamburger-btn'),
  headerUserName:    $('header-user-name'),
  logoutBtn:         $('logout-btn'),
  moduleSidebar:     $('module-sidebar'),
  bottomNav:         $('bottom-nav'),
  bottomNavAccountBtn: $('bottom-nav-account-btn'),
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
  titleColorBtn:     $('title-color-btn'),
  titleColorPopover: $('title-color-popover'),
  titleColorSwatch:  $('title-color-swatch'),
  titleSizeBtn:      $('title-size-btn'),
  titleSizePopover:  $('title-size-popover'),
  // Antecedentes
  antUnidades:       $('ant-unidades'),
  antM2Total:        $('ant-m2total'),
  antComunaField:      $('ant-comuna-field'),
  antRevisorField:     $('ant-revisor-field'),
  antCalculistaField:  $('ant-calculista-field'),
  antEncargadosField:  $('ant-encargados-field'),
  antEncargadosDatalist: $('ant-encargados-datalist'),
  // Resumen
  resumenModule:         $('resumen-module'),
  resumenEmptyState:     $('resumen-empty-state'),
  resumenReportContainer:$('resumen-report-container'),
  resumenReport:         $('resumen-report'),
  resumenTitle:          $('resumen-title'),
  resumenMeta:           $('resumen-meta'),
  resumenFilterMode:     $('resumen-filter-mode'),
  resumenFilterEncargado:$('resumen-filter-encargado'),
  resumenPrintBtn:       $('resumen-print-btn'),
  resumenEmailTo:        $('resumen-email-to'),
  resumenEmailDatalist:  $('resumen-email-datalist'),
  resumenGmailBtn:       $('resumen-gmail-btn'),
  resumenEmailBtn:       $('resumen-email-btn'),
  // Dropbox links (Detalles Constructivos / Proyectos con Permiso)
  planosModule:  $('planos-module'),
  planosSidebar: $('planos-sidebar'),
  planosList:    $('planos-list'),
  planosArea:    $('planos-area'),
  adminDropboxList:    $('admin-dropbox-list'),
  // Admin
  adminModule:       $('admin-module'),
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

// Última acción deshacible por fuera del historial nativo del editor (p.ej.
// borrar una tarea). El botón "↩ Deshacer" de la barra la prioriza sobre el
// undo nativo para que siempre revierta lo último que pasó de verdad.
let pendingUndo = null;

// Toast con acción "Deshacer": queda más tiempo en pantalla que un toast
// normal y, si se clickea a tiempo (acá o desde la barra), ejecuta onUndo
// en vez de solo cerrarse.
function showUndoToast(msg, onUndo) {
  const el = document.createElement('div');
  el.className = 'toast toast-undo';
  el.innerHTML = `<span></span><button type="button" class="toast-undo-btn">Deshacer</button>`;
  el.querySelector('span').textContent = msg;
  DOM.toastContainer.appendChild(el);

  const entry = {
    dismiss() {
      clearTimeout(timer);
      el.remove();
      if (pendingUndo === entry) pendingUndo = null;
    },
    run() {
      entry.dismiss();
      onUndo();
    },
  };
  const timer = setTimeout(() => entry.dismiss(), 6000);
  pendingUndo = entry;
  el.querySelector('.toast-undo-btn').addEventListener('click', entry.run);
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
    document.querySelectorAll('.module-nav-btn[data-module="admin"]').forEach(b => b.classList.remove('hidden'));
  }

  // Show UI
  DOM.loading.classList.add('hidden');
  DOM.appBody.classList.remove('hidden');
  DOM.bottomNav.classList.remove('hidden');

  initNavigation();
  initEditorToolbar();
  loadTaskColumnWidths();
  initTaskColumnResize();
  initAntecedentesPanel();
  loadWiki();
  loadOptionLists();
  loadDropboxLinks();

  // Acceso directo a Administración (ver admin.html) sin pasar por Reuniones.
  if (location.hash === '#admin' && userData.role === 'admin') {
    switchModule('admin');
  }
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

  // Botón "Cuenta" de la barra inferior (mobile): abre el rail lateral como
  // drawer para ver el usuario y cerrar sesión, ya que en mobile el rail no
  // se usa para cambiar de módulo (eso lo hace la barra inferior).
  DOM.bottomNavAccountBtn.addEventListener('click', () => {
    DOM.moduleSidebar.classList.toggle('open');
  });
}

function switchModule(moduleName) {
  document.querySelectorAll('.module').forEach(m => m.classList.remove('active'));
  document.querySelectorAll('.module-nav-btn').forEach(b => b.classList.remove('active'));

  $(`${moduleName}-module`).classList.add('active');
  document.querySelectorAll(`.module-nav-btn[data-module="${moduleName}"]`).forEach(b => b.classList.add('active'));

  // El hamburguesa solo tiene sentido en los módulos con sub-sidebar propio
  // (secciones de Reuniones, carpetas de Planos); en Resumen/Admin no hay nada que abrir.
  DOM.hamburger.classList.toggle('hidden', moduleName !== 'wiki' && moduleName !== 'planos');

  if (moduleName === 'admin') {
    loadAdminTab('users');
  }
  if (moduleName === 'resumen') {
    loadResumen();
  }
  if (moduleName === 'planos') {
    renderDropboxModules();
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
  if (tabName === 'dropbox')  loadAdminDropbox();
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
        <span class="section-color-dot" style="background:${section.color || '#1a1a1a'}"></span>
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
  DOM.pageTitleInput.dataset.color = page.titleColor || '';
  DOM.pageTitleInput.dataset.size = page.titleSize || '';
  DOM.pageTitleInput.style.color = page.titleColor || '';
  DOM.pageTitleInput.style.fontSize = page.titleSize ? `${page.titleSize}px` : '';
  DOM.titleColorSwatch.style.borderBottomColor = page.titleColor || '#e03131';

  DOM.editorContent.innerHTML = page.content || '';
  normalizeTaskItems(DOM.editorContent);
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
  const titleColor = DOM.pageTitleInput.dataset.color || '';
  const titleSize = DOM.pageTitleInput.dataset.size ? Number(DOM.pageTitleInput.dataset.size) : null;

  try {
    await db.collection('pages').doc(pageId).update({
      title,
      content,
      antecedentes,
      titleColor,
      titleSize,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
      updatedBy: state.authUser.uid,
    });

    // Update local state
    const page = state.pages.find(p => p.id === pageId);
    if (page) {
      page.title = title; page.content = content; page.antecedentes = antecedentes;
      page.titleColor = titleColor; page.titleSize = titleSize;
    }

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

      if (btn.id === 'delete-task-btn') {
        const item = getSelectedTaskItem();
        if (item) {
          deleteTaskItem(item);
        } else {
          toast('Poné el cursor sobre una tarea para eliminarla.', 'info');
        }
        return;
      }

      if (btn.id === 'undo-btn') {
        if (pendingUndo) {
          pendingUndo.run();
        } else {
          document.execCommand('undo', false, null);
        }
        DOM.editorContent.focus();
        scheduleAutosave();
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
  bindCustomSizeInput(DOM.fontSizePopover, px => {
    applyFontSize(px);
    DOM.editorContent.focus();
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
    if (!DOM.titleColorPopover.classList.contains('hidden') &&
        !e.target.closest('#title-color-btn') && !e.target.closest('#title-color-popover')) {
      DOM.titleColorPopover.classList.add('hidden');
    }
    if (!DOM.titleSizePopover.classList.contains('hidden') &&
        !e.target.closest('#title-size-btn') && !e.target.closest('#title-size-popover')) {
      DOM.titleSizePopover.classList.add('hidden');
    }
    ANT_SELECT_FIELDS.forEach(f => {
      if (antSelectOpen[f.key] && !DOM[f.container].contains(e.target)) {
        antSelectOpen[f.key] = false;
        renderAntSelectField(f);
      }
    });
  });

  // Color y tamaño del título de la página
  DOM.titleColorBtn.addEventListener('click', e => {
    e.preventDefault();
    DOM.titleColorPopover.classList.toggle('hidden');
    DOM.titleSizePopover.classList.add('hidden');
  });
  DOM.titleSizeBtn.addEventListener('click', e => {
    e.preventDefault();
    DOM.titleSizePopover.classList.toggle('hidden');
    DOM.titleColorPopover.classList.add('hidden');
  });
  DOM.titleColorPopover.querySelectorAll('.color-swatch').forEach(swatch => {
    swatch.addEventListener('click', e => {
      e.preventDefault();
      const color = swatch.dataset.color;
      DOM.pageTitleInput.dataset.color = color;
      DOM.pageTitleInput.style.color = color;
      DOM.titleColorSwatch.style.borderBottomColor = color || '#e03131';
      DOM.titleColorPopover.classList.add('hidden');
      scheduleAutosave();
    });
  });
  DOM.titleSizePopover.querySelectorAll('.size-option').forEach(opt => {
    opt.addEventListener('click', e => {
      e.preventDefault();
      const size = opt.dataset.size;
      DOM.pageTitleInput.dataset.size = size;
      DOM.pageTitleInput.style.fontSize = size ? `${size}px` : '';
      DOM.titleSizePopover.classList.add('hidden');
      scheduleAutosave();
    });
  });
  bindCustomSizeInput(DOM.titleSizePopover, px => {
    DOM.pageTitleInput.dataset.size = px;
    DOM.pageTitleInput.style.fontSize = `${px}px`;
    scheduleAutosave();
  });

  // Listen for content changes. El "Encargado" y la "Fecha de entrega" de
  // una tarea son <input> reales: su value vive como propiedad del DOM y no
  // se refleja en innerHTML solo, así que hay que copiarlo al atributo a
  // mano para que el autoguardado (que serializa innerHTML) lo capture.
  DOM.editorContent.addEventListener('input', e => {
    const el = e.target;
    if (el.matches?.('.task-encargado, .task-due-date')) {
      el.setAttribute('value', el.value);
    }
    scheduleAutosave();
  });
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
    const deleteBtn = e.target.closest('.task-delete-btn');
    if (deleteBtn) {
      deleteTaskItem(deleteBtn.closest('.task-item'));
      return;
    }

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

// Fila "Otro (px)" al pie de un size-popover: además de las opciones fijas
// (Pequeño/Normal/Grande...), deja escribir cualquier número de píxeles a
// mano. onApply recibe el valor ya validado como string, p.ej. "37".
function bindCustomSizeInput(popover, onApply) {
  const input = popover.querySelector('.size-custom-input');
  const btn = popover.querySelector('.size-custom-apply');
  if (!input || !btn) return;

  const apply = () => {
    const px = parseInt(input.value, 10);
    if (!px || px <= 0) return;
    onApply(String(px));
    input.value = '';
    popover.classList.add('hidden');
  };

  btn.addEventListener('click', e => { e.preventDefault(); apply(); });
  input.addEventListener('click', e => e.stopPropagation());
  input.addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); apply(); }
  });
}

// Inserta un ítem de tarea (casillero + texto + encargado + fecha de
// entrega + prioridad), en formato de fila, siempre debajo de la última
// tarea existente (si hay alguna) en vez de donde estuviera el cursor.
// Tildar el casillero la marca resuelta; la etiqueta de prioridad rota
// entre Alta/Media/Baja al clickearla.
function insertTask() {
  const tempId = 'tmp-task-' + Date.now();
  const html = `<div class="task-item" data-priority="media"><input type="checkbox" class="task-checkbox"><span class="task-text" id="${tempId}">Nueva tarea</span><input type="text" class="task-encargado" list="ant-encargados-datalist" placeholder="Encargado"><span class="task-col-resize" data-col="encargado" contenteditable="false" title="Arrastrar para ajustar el ancho"></span><input type="date" class="task-due-date" title="Fecha de entrega"><span class="task-col-resize" data-col="due" contenteditable="false" title="Arrastrar para ajustar el ancho"></span><button type="button" class="task-priority-tag" data-priority="media">Media</button><button type="button" class="task-delete-btn" title="Eliminar tarea">×</button></div>`;
  const spacerHtml = `<p><br></p>`;

  const taskItems = DOM.editorContent.querySelectorAll('.task-item');
  const lastTask = taskItems[taskItems.length - 1];

  if (lastTask) {
    // Insertar por selección + execCommand es ambiguo para el navegador
    // cuando el punto de inserción cae justo al final de una fila flex:
    // en vez de crear una fila hermana debajo, a veces la mete adentro de
    // la anterior (queda "al lado"). Insertando el nodo a mano se evita
    // esa ambigüedad y la nueva fila siempre queda debajo de la última.
    const temp = document.createElement('div');
    temp.innerHTML = html + spacerHtml;
    const newTaskEl = temp.firstElementChild;
    const newSpacerEl = temp.lastElementChild;
    const afterLast = lastTask.nextSibling?.nodeType === Node.ELEMENT_NODE && lastTask.nextSibling.matches('p')
      ? lastTask.nextSibling
      : lastTask;
    afterLast.after(newTaskEl, newSpacerEl);
  } else {
    document.execCommand('insertHTML', false, html + spacerHtml);
  }

  DOM.editorContent.focus();
  const textEl = document.getElementById(tempId);
  if (textEl) {
    textEl.removeAttribute('id');
    const range = document.createRange();
    range.selectNodeContents(textEl);
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
  }
  scheduleAutosave();
}

// Saca una tarea del editor. execCommand('delete') sobre un <div> de layout
// flex es poco confiable (a veces deja el marcado a medio borrar), así que
// se saca con remove() y se ofrece un "Deshacer" propio en vez de depender
// del historial nativo del editor.
function deleteTaskItem(item) {
  if (!item) return;
  const parent = item.parentNode;
  const nextSibling = item.nextSibling;
  const html = item.outerHTML;
  item.remove();
  scheduleAutosave();
  showUndoToast('Tarea eliminada', () => {
    const temp = document.createElement('div');
    temp.innerHTML = html;
    const restored = temp.firstElementChild;
    if (nextSibling && nextSibling.isConnected) {
      parent.insertBefore(restored, nextSibling);
    } else {
      parent.appendChild(restored);
    }
    scheduleAutosave();
  });
}

// Encuentra la tarea donde está parado el cursor, para el botón "Eliminar"
// de la barra de herramientas (a diferencia del botón × de cada fila, que
// ya sabe sobre qué tarea actuar porque está adentro de ella).
function getSelectedTaskItem() {
  const sel = window.getSelection();
  if (!sel.rangeCount) return null;
  let node = sel.getRangeAt(0).commonAncestorContainer;
  if (node.nodeType === Node.TEXT_NODE) node = node.parentElement;
  return node?.closest?.('.task-item') || null;
}

// Las tareas guardadas antes de agregar el botón de eliminar quedaron sin
// él en su HTML: al abrir la página se les inserta acá para que también
// se puedan borrar, sin tener que tocar los datos guardados.
function normalizeTaskItems(container) {
  container.querySelectorAll('.task-item').forEach(item => {
    if (item.querySelector('.task-delete-btn')) return;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'task-delete-btn';
    btn.title = 'Eliminar tarea';
    btn.textContent = '×';
    item.appendChild(btn);
  });

  // Tareas guardadas antes de agregar las manijas para ajustar el ancho de
  // Encargado / Fecha de entrega: se insertan acá, después de cada input.
  container.querySelectorAll('.task-item').forEach(item => {
    const encargado = item.querySelector('.task-encargado');
    if (encargado && !encargado.nextElementSibling?.matches('.task-col-resize')) {
      encargado.after(makeTaskColResizeHandle('encargado'));
    }
    const due = item.querySelector('.task-due-date');
    if (due && !due.nextElementSibling?.matches('.task-col-resize')) {
      due.after(makeTaskColResizeHandle('due'));
    }
  });

  // Si la tarea más nueva de la página no tiene un párrafo vacío después
  // (páginas viejas, guardadas antes de este chequeo), no queda ningún
  // renglón de texto donde caiga el cursor al hacer clic debajo — hay que
  // agregarlo para poder seguir escribiendo o insertar una fecha ahí.
  const items = container.querySelectorAll('.task-item');
  const lastItem = items[items.length - 1];
  if (lastItem) {
    const next = lastItem.nextSibling;
    const hasSpacer = next && next.nodeType === Node.ELEMENT_NODE && next.matches('p');
    if (!hasSpacer) {
      const spacer = document.createElement('p');
      spacer.innerHTML = '<br>';
      lastItem.after(spacer);
    }
  }
}

function makeTaskColResizeHandle(col) {
  const span = document.createElement('span');
  span.className = 'task-col-resize';
  span.dataset.col = col;
  span.contentEditable = 'false';
  span.title = 'Arrastrar para ajustar el ancho';
  return span;
}

// Ancho de las columnas Encargado / Fecha de entrega de las tareas: viven
// como variables CSS globales (mismo ancho en todas las filas, como una
// columna de planilla) y se guardan en localStorage para que el ajuste
// quede entre sesiones, sin tener que tocar los datos de cada página.
const TASK_COL_STORAGE_KEY = 'aia-task-col-widths';
const TASK_COL_LIMITS = {
  encargado: { min: 40, max: 320, varName: '--task-encargado-w' },
  due:       { min: 70, max: 220, varName: '--task-due-date-w' },
};

function loadTaskColumnWidths() {
  let saved = {};
  try { saved = JSON.parse(localStorage.getItem(TASK_COL_STORAGE_KEY)) || {}; } catch { /* ignore */ }
  Object.entries(TASK_COL_LIMITS).forEach(([col, { varName }]) => {
    const w = Number(saved[col]);
    if (w) document.documentElement.style.setProperty(varName, w + 'px');
  });
}

function saveTaskColumnWidth(col, widthPx) {
  let saved = {};
  try { saved = JSON.parse(localStorage.getItem(TASK_COL_STORAGE_KEY)) || {}; } catch { /* ignore */ }
  saved[col] = widthPx;
  localStorage.setItem(TASK_COL_STORAGE_KEY, JSON.stringify(saved));
}

function initTaskColumnResize() {
  DOM.editorContent.addEventListener('mousedown', e => {
    const handle = e.target.closest('.task-col-resize');
    if (!handle) return;
    e.preventDefault();

    const col = handle.dataset.col;
    const { min, max, varName } = TASK_COL_LIMITS[col];
    const startX = e.clientX;
    const startWidth = parseFloat(getComputedStyle(document.documentElement).getPropertyValue(varName)) || min;
    handle.classList.add('is-resizing');

    let currentWidth = startWidth;
    const onMove = ev => {
      currentWidth = Math.min(max, Math.max(min, startWidth + (ev.clientX - startX)));
      document.documentElement.style.setProperty(varName, currentWidth + 'px');
    };
    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      handle.classList.remove('is-resizing');
      saveTaskColumnWidth(col, Math.round(currentWidth));
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  });
}

// Inserta un nuevo bloque fechado ("<hr><h2>fecha</h2>") al final de la
// página actual, con la fecha elegida a mano en el calendario (no la de hoy).
function openInsertDateModal() {
  // El modal le saca el foco al editor, así que hay que guardar dónde
  // estaba el cursor antes de abrirlo para poder insertar la fecha ahí
  // mismo (y no siempre al final del documento).
  const sel = window.getSelection();
  const savedRange = (sel && sel.rangeCount > 0 && DOM.editorContent.contains(sel.anchorNode))
    ? sel.getRangeAt(0).cloneRange()
    : null;

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
    const html = `<hr><h2 class="date-heading">${label}</h2><p><br></p>`;

    DOM.editorContent.focus();
    if (savedRange) {
      const liveSel = window.getSelection();
      liveSel.removeAllRanges();
      liveSel.addRange(savedRange);
      document.execCommand('insertHTML', false, html);
    } else {
      DOM.editorContent.innerHTML += html;
    }
    scheduleAutosave();
    closeModal();
    DOM.editorContent.focus();
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// WIKI — ANTECEDENTES PANEL (ficha fija por página: comuna, encargados, m², unidades)
// ═══════════════════════════════════════════════════════════════════════════

// Comunas fijas de base (siempre disponibles, no se pueden borrar de la
// lista). Las agregadas a mano con "+" se guardan aparte en Firestore
// (state.optionLists.comunas) y se suman a estas.
const BASE_COMUNAS = [
  'Arica', 'Iquique', 'Antofagasta', 'Calama', 'La Serena', 'Coquimbo',
  'Valparaíso', 'Quilpué', 'Santiago', 'Machalí',
];

// Campos "desplegable con lista editable" de la ficha de antecedentes:
// cada uno tiene un botón que abre un popover con checkboxes (o radios
// para comuna, que es de un solo valor), un "+" para sumar un nombre
// nuevo a la lista compartida (visible en todas las obras) y una "×"
// por opción para sacarla de esa lista compartida.
const ANT_SELECT_FIELDS = [
  { key: 'comuna',              container: 'antComunaField',     listKey: 'comunas',     multi: false, emptyHint: '-- Seleccionar --' },
  { key: 'revisorArquitectura', container: 'antRevisorField',    listKey: 'revisores',   multi: true,  emptyHint: 'Sin revisor asignado' },
  { key: 'calculista',          container: 'antCalculistaField', listKey: 'calculistas', multi: true,  emptyHint: 'Sin calculista asignado' },
  { key: 'encargados',          container: 'antEncargadosField', listKey: 'encargados',  multi: true,  emptyHint: 'Sin encargados' },
];

const antSelectOpen = {};
// Valor (string) que se está renombrando en el popover de cada campo, o null
// si ninguno está en edición — un solo campo a la vez, igual que antSelectOpen.
const antEditingValue = {};
let antCanEdit = false;

function normalizeAntecedentes(raw) {
  // m2Total: si la página venía del esquema viejo (lista de m² por unidad),
  // se suma esa lista como valor de arranque para no perder lo ya cargado.
  const legacyM2Sum = Array.isArray(raw?.m2)
    ? raw.m2.reduce((sum, x) => sum + (Number(x.valor) || 0), 0)
    : null;

  const out = {
    unidades: (raw?.unidades === 0 || raw?.unidades) ? Number(raw.unidades) : null,
    m2Total: (raw?.m2Total === 0 || raw?.m2Total) ? Number(raw.m2Total) : legacyM2Sum,
  };
  ANT_SELECT_FIELDS.forEach(f => {
    const v = raw?.[f.key];
    if (!f.multi) {
      // Dato legado: si alguna vez quedó guardado como array de un elemento.
      out[f.key] = Array.isArray(v) ? (v[0] || '') : (v || '');
      return;
    }
    // Dato legado: estos campos pasaron brevemente por un esquema de texto
    // libre (string con " / "); se separan para no perder lo ya cargado.
    if (Array.isArray(v)) out[f.key] = v.filter(Boolean);
    else if (typeof v === 'string' && v.trim()) out[f.key] = v.split('/').map(s => s.trim()).filter(Boolean);
    else out[f.key] = [];
  });
  return out;
}

async function loadOptionLists() {
  try {
    const doc = await db.collection('config').doc('optionLists').get();
    const d = doc.exists ? doc.data() : {};
    state.optionLists = {
      comunas:     Array.isArray(d.comunas)     ? d.comunas     : [],
      revisores:   Array.isArray(d.revisores)   ? d.revisores   : [],
      calculistas: Array.isArray(d.calculistas) ? d.calculistas : [],
      encargados:  Array.isArray(d.encargados)  ? d.encargados  : [],
      emails:      Array.isArray(d.emails)      ? d.emails      : [],
    };
  } catch (err) {
    console.error('loadOptionLists error:', err);
  }
  // Si ya hay una obra abierta, refresca las opciones visibles con la lista recién cargada.
  if (state.currentPageId) ANT_SELECT_FIELDS.forEach(f => renderAntSelectField(f));
  renderEncargadosDatalist();
  renderResumenEmailDatalist();
}

// Sugerencias del campo "Encargado" de cada tarea (☑ Tarea): la misma
// lista compartida que usa el desplegable de Encargado/s de Antecedentes.
function renderEncargadosDatalist() {
  DOM.antEncargadosDatalist.innerHTML = state.optionLists.encargados
    .map(n => `<option value="${escHtml(n)}"></option>`)
    .join('');
}

async function addOptionListValue(listKey, value) {
  if (!state.optionLists[listKey].includes(value)) {
    state.optionLists[listKey] = [...state.optionLists[listKey], value].sort((a, b) => a.localeCompare(b, 'es'));
  }
  try {
    await db.collection('config').doc('optionLists').set(
      { [listKey]: firebase.firestore.FieldValue.arrayUnion(value) },
      { merge: true }
    );
  } catch (err) {
    console.error('addOptionListValue error:', err);
    toast('Error al guardar la nueva opción.', 'error');
  }
  if (listKey === 'encargados') renderEncargadosDatalist();
  if (listKey === 'emails') renderResumenEmailDatalist();
}

async function removeOptionListValue(listKey, value) {
  state.optionLists[listKey] = state.optionLists[listKey].filter(v => v !== value);
  try {
    await db.collection('config').doc('optionLists').set(
      { [listKey]: firebase.firestore.FieldValue.arrayRemove(value) },
      { merge: true }
    );
  } catch (err) {
    console.error('removeOptionListValue error:', err);
    toast('Error al quitar la opción.', 'error');
  }
  if (listKey === 'encargados') renderEncargadosDatalist();
}

// Renombra un valor en el catálogo compartido (p.ej. corregir un typo) y lo
// actualiza también en la página abierta y en cualquier otra obra que ya lo
// tuviera marcado — si solo se corrigiera el catálogo, esas obras quedarían
// mostrando el nombre viejo, que ya no aparecería como opción para destildar.
async function renameOptionListValue(field, oldValue, newValue) {
  const listKey = field.listKey;

  state.optionLists[listKey] = Array.from(new Set(
    (state.optionLists[listKey] || []).map(v => (v === oldValue ? newValue : v))
  )).sort((a, b) => a.localeCompare(b, 'es'));

  const a = state.antecedentes;
  if (field.multi) {
    if ((a[field.key] || []).includes(oldValue)) {
      a[field.key] = Array.from(new Set(a[field.key].map(v => (v === oldValue ? newValue : v))));
    }
  } else if (a[field.key] === oldValue) {
    a[field.key] = newValue;
  }

  try {
    await db.collection('config').doc('optionLists').set(
      { [listKey]: state.optionLists[listKey] },
      { merge: true }
    );
  } catch (err) {
    console.error('renameOptionListValue error (catálogo):', err);
    toast('Error al modificar la opción.', 'error');
    return;
  }

  const affected = state.pages.filter(p => {
    if (p.id === state.currentPageId) return false; // esta página se guarda aparte, con saveAntecedentesNow
    const v = p.antecedentes?.[field.key];
    return field.multi ? Array.isArray(v) && v.includes(oldValue) : v === oldValue;
  });
  if (!affected.length) return;

  const batch = db.batch();
  affected.forEach(p => {
    const v = p.antecedentes[field.key];
    const updated = field.multi
      ? Array.from(new Set(v.map(x => (x === oldValue ? newValue : x))))
      : newValue;
    p.antecedentes = { ...p.antecedentes, [field.key]: updated };
    batch.update(db.collection('pages').doc(p.id), { [`antecedentes.${field.key}`]: updated });
  });
  try {
    await batch.commit();
  } catch (err) {
    console.error('renameOptionListValue error (otras obras):', err);
    toast('Se modificó en la lista, pero no se pudo actualizar en todas las obras.', 'error');
  }
}

// Opciones visibles del desplegable: para comuna, la lista fija de base más
// las agregadas a mano; para el resto, las agregadas a mano. En los dos
// casos se suman también los valores ya marcados en la obra abierta, aunque
// no estén en el catálogo compartido — puede pasar con datos viejos (este
// campo fue texto libre por un tiempo) migrados a lista sin pasar por
// "Agregar". Si no se sumaran acá, ese nombre se seguiría viendo en el
// resumen del campo pero sin ninguna fila en el desplegable para tildarlo,
// editarlo o sacarlo: quedaría pegado ahí sin forma de tocarlo.
function antFieldOptions(field) {
  const custom = state.optionLists[field.listKey] || [];
  const selected = field.multi
    ? (state.antecedentes[field.key] || [])
    : (state.antecedentes[field.key] ? [state.antecedentes[field.key]] : []);
  const all = field.key === 'comuna'
    ? new Set([...BASE_COMUNAS, ...custom, ...selected])
    : new Set([...custom, ...selected]);
  return Array.from(all).sort((a, b) => a.localeCompare(b, 'es'));
}

function renderAntecedentesPanel(canEdit) {
  const a = state.antecedentes;
  antCanEdit = canEdit;

  DOM.antUnidades.value = a.unidades ?? '';
  DOM.antUnidades.disabled = !canEdit;

  DOM.antM2Total.value = a.m2Total ?? '';
  DOM.antM2Total.disabled = !canEdit;

  ANT_SELECT_FIELDS.forEach(f => {
    antSelectOpen[f.key] = false;
    antEditingValue[f.key] = null;
    renderAntSelectField(f);
  });
}

function renderAntSelectField(field) {
  const container = DOM[field.container];
  const a = state.antecedentes;
  const canEdit = antCanEdit;
  const selected = field.multi ? (a[field.key] || []) : (a[field.key] ? [a[field.key]] : []);
  const options = antFieldOptions(field);
  const isOpen = !!antSelectOpen[field.key];
  const summary = selected.length ? selected.join(' / ') : field.emptyHint;

  const optionsHtml = options.length
    ? options.map(opt => {
        const checked = selected.includes(opt);
        const editable = canEdit && !(field.key === 'comuna' && BASE_COMUNAS.includes(opt));

        if (editable && antEditingValue[field.key] === opt) {
          return `
            <div class="ant-select-option ant-select-option-editing">
              <input type="text" class="ant-select-rename-input" value="${escHtml(opt)}" maxlength="60" />
              <button type="button" class="ant-select-rename-save" title="Guardar">✓</button>
              <button type="button" class="ant-select-rename-cancel" title="Cancelar">✕</button>
            </div>
          `;
        }
        return `
          <label class="ant-select-option">
            <input type="${field.multi ? 'checkbox' : 'radio'}" name="ant-select-${field.key}" value="${escHtml(opt)}" ${checked ? 'checked' : ''} ${canEdit ? '' : 'disabled'} />
            <span>${escHtml(opt)}</span>
            ${editable ? `<button type="button" class="ant-select-edit" data-value="${escHtml(opt)}" title="Modificar nombre">✎</button>` : ''}
            ${editable ? `<button type="button" class="ant-select-remove" data-value="${escHtml(opt)}" title="Quitar de la lista">×</button>` : ''}
          </label>
        `;
      }).join('')
    : `<div class="ant-select-empty">Sin opciones todavía</div>`;

  container.innerHTML = `
    <button type="button" class="ant-select-btn" ${canEdit ? '' : 'disabled'}>
      <span class="ant-select-btn-text">${escHtml(summary)}</span>
      <span class="ant-select-chevron">▾</span>
    </button>
    <div class="ant-select-popover ${isOpen ? '' : 'hidden'}">
      <div class="ant-select-options">${optionsHtml}</div>
      ${canEdit ? `
        <div class="ant-select-add-row">
          <input type="text" class="ant-select-add-input" placeholder="Agregar nuevo..." maxlength="60" />
          <button type="button" class="btn-sm ant-select-add-btn">+</button>
        </div>
      ` : ''}
    </div>
  `;

  if (!canEdit) return;

  container.querySelector('.ant-select-btn').addEventListener('click', e => {
    e.stopPropagation();
    antSelectOpen[field.key] = !antSelectOpen[field.key];
    renderAntSelectField(field);
  });

  container.querySelectorAll(`input[name="ant-select-${field.key}"]`).forEach(input => {
    input.addEventListener('change', () => {
      if (field.multi) {
        const set = new Set(a[field.key] || []);
        if (input.checked) set.add(input.value); else set.delete(input.value);
        a[field.key] = Array.from(set);
      } else {
        a[field.key] = input.checked ? input.value : '';
        antSelectOpen[field.key] = false;
      }
      saveAntecedentesNow();
      renderAntSelectField(field);
    });
  });

  container.querySelectorAll('.ant-select-remove').forEach(btn => {
    btn.addEventListener('click', async e => {
      e.stopPropagation();
      const value = btn.dataset.value;
      if (field.multi) a[field.key] = (a[field.key] || []).filter(v => v !== value);
      else if (a[field.key] === value) a[field.key] = '';
      await removeOptionListValue(field.listKey, value);
      saveAntecedentesNow();
      renderAntSelectField(field);
    });
  });

  container.querySelectorAll('.ant-select-edit').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      antEditingValue[field.key] = btn.dataset.value;
      renderAntSelectField(field);
    });
  });

  // Fila de edición: cambia el nombre en el catálogo compartido y, si otras
  // obras ya lo tenían marcado, también en cada una de ellas — para que el
  // arreglo de un typo no deje nombres viejos sueltos por ahí.
  const renameRow = container.querySelector('.ant-select-option-editing');
  if (renameRow) {
    const oldValue = antEditingValue[field.key];
    const renameInput = renameRow.querySelector('.ant-select-rename-input');
    renameInput.focus();
    renameInput.select();
    renameInput.addEventListener('click', e => e.stopPropagation());

    const confirmRename = async () => {
      const newValue = renameInput.value.trim();
      antEditingValue[field.key] = null;
      if (newValue && newValue !== oldValue) {
        await renameOptionListValue(field, oldValue, newValue);
        saveAntecedentesNow();
      }
      renderAntSelectField(field);
    };
    const cancelRename = () => {
      antEditingValue[field.key] = null;
      renderAntSelectField(field);
    };

    renameRow.querySelector('.ant-select-rename-save').addEventListener('click', e => { e.stopPropagation(); confirmRename(); });
    renameRow.querySelector('.ant-select-rename-cancel').addEventListener('click', e => { e.stopPropagation(); cancelRename(); });
    renameInput.addEventListener('keydown', e => {
      if (e.key === 'Enter') { e.preventDefault(); confirmRename(); }
      if (e.key === 'Escape') { e.preventDefault(); cancelRename(); }
    });
  }

  const addInput = container.querySelector('.ant-select-add-input');
  const addBtn = container.querySelector('.ant-select-add-btn');
  const doAdd = async () => {
    const value = addInput.value.trim();
    if (!value) return;
    await addOptionListValue(field.listKey, value);
    if (field.multi) {
      a[field.key] = Array.from(new Set([...(a[field.key] || []), value]));
    } else {
      a[field.key] = value;
      antSelectOpen[field.key] = false;
    }
    saveAntecedentesNow();
    renderAntSelectField(field);
  };
  addBtn.addEventListener('click', e => { e.stopPropagation(); doAdd(); });
  addInput.addEventListener('click', e => e.stopPropagation());
  addInput.addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); doAdd(); }
  });
}

// Guarda de inmediato (sin el debounce de 1.2s de scheduleAutosave) para
// acciones puntuales de selección (marcar/agregar/quitar) donde el usuario
// espera que quede guardado ya mismo, incluso si recarga la página al toque.
function saveAntecedentesNow() {
  clearTimeout(state.autosaveTimer);
  setSaveIndicator('saving');
  performAutosave();
}

function initAntecedentesPanel() {
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

    $('m-confirm-btn').disabled = true;
    try {
      const maxOrder = state.pages.filter(p => p.sectionId === sectionId).reduce((m, p) => Math.max(m, p.order || 0), 0);
      // Sin fecha automática: la página arranca vacía y la fecha se agrega
      // a mano con "Insertar fecha" cuando corresponda.
      const initialContent = `<p><br></p>`;
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
// RESUMEN
// ═══════════════════════════════════════════════════════════════════════════
//
// Cada página de Reuniones puede tener varias entradas separadas por <hr>,
// cada una con su fecha en español opcional al principio (insertada a mano
// con "Insertar fecha"). Este módulo junta el contenido de TODAS las
// secciones/páginas accesibles en un único resumen para imprimir y
// repartir, agrupado por empresa (sección) — sin dividir por mes ni semana,
// y sin dejar afuera lo que no tiene fecha puesta. La fecha, cuando existe,
// se muestra como un dato más de la entrada, no como criterio de inclusión
// ni de agrupación: lo que importa para repartir es a qué empresa le
// corresponde cada cosa.

const MESES_ES = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
const DIAS_ES  = ['domingo','lunes','martes','miércoles','jueves','viernes','sábado'];
const DATE_HEADING_RE = /(\d{1,2})\s+de\s+(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre)(?:\s+de)?\s+(\d{4})/i;

const resumenState = {
  sectionGroups: [],  // [{ section, entries: [...] }], en el orden de las secciones
  mode: 'empresa',    // 'empresa' (todo) | 'encargado' (solo obras de una persona)
  encargado: '',       // nombre elegido cuando mode === 'encargado'
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

  // Cada tarea deja un <p><br></p> "espaciador" para poder pararse ahí con
  // el cursor (uno por tarea, ya sea la propia o uno que quedó suelto al
  // sacar una tarea resuelta o borrada con el botón ×). Ninguno aporta al
  // resumen impreso, y al no quedar pegado a una .task-item pierde el
  // margen achicado (.task-item + p) y se ve como un hueco en blanco — así
  // que se sacan todos los párrafos vacíos, sin importar dónde quedaron.
  tmp.querySelectorAll('p, div:not(.task-item)').forEach(p => {
    if (p.closest('.task-item') || p.querySelector('.task-item')) return;
    const text = p.textContent.replace(/ /g, ' ').trim();
    if (!text && !p.querySelector('img')) p.remove();
  });

  tmp.querySelectorAll('.task-checkbox, .task-encargado, .task-due-date').forEach(el => el.disabled = true);
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
// matchea el formato) igual entra al Resumen — la fecha ya no decide qué se
// incluye, solo se muestra como dato de la entrada cuando existe. Sin
// fecha, la entrada se ordena al final dentro de su empresa (ver
// buildResumenData).
function splitPageIntoEntries(page) {
  const html = page.content || '';
  if (!html.trim()) return [];

  const chunks = html.split(/<hr\s*\/?>/i);
  const entries = [];

  chunks.forEach(chunk => {
    const found = extractChunkDate(chunk);
    let date = null;
    let dateLabel = '';
    let bodyHtml = chunk;

    if (found) {
      const day   = parseInt(found.dm[1], 10);
      const month = MESES_ES.indexOf(found.dm[2].toLowerCase());
      const year  = parseInt(found.dm[3], 10);
      const parsed = new Date(year, month, day);
      if (!isNaN(parsed.getTime())) {
        date = parsed;
        dateLabel = found.dateLabel;
        bodyHtml = found.bodyHtml;
      }
    }

    const visibleHtml = stripResolvedContent(bodyHtml);

    const isEmpty = visibleHtml
      .replace(/<(p|div)>\s*(<br\s*\/?>)?\s*<\/(p|div)>/gi, '')
      .replace(/\s|&nbsp;/g, '').length === 0;
    if (isEmpty) return;

    entries.push({ date, dateLabel, html: visibleHtml });
  });

  return entries;
}

// Groups every dated entry from every accessible section/page by empresa
// (sección), sin importar el mes o la fecha — todo el historial junto.
//
// Una página puede tener varios bloques con fecha real (una por cada vez
// que se usó "Insertar fecha"); cada uno cuenta como una entrada aparte,
// ordenada cronológicamente dentro de su empresa.
function buildResumenData(filterEncargado) {
  const sections = getAccessibleSections();
  const sectionById = Object.fromEntries(sections.map(s => [s.id, s]));
  const sectionOrder = new Map(sections.map((s, i) => [s.id, i]));
  const bySection = new Map();

  state.pages.forEach(page => {
    const section = sectionById[page.sectionId];
    if (!section) return; // sección no accesible para este usuario

    // Modo "por encargado": solo entran las obras donde esa persona figura
    // en Antecedentes → Encargado/s (dato de la obra, no de cada tarea).
    if (filterEncargado && !normalizeAntecedentes(page.antecedentes).encargados.includes(filterEncargado)) {
      return;
    }

    splitPageIntoEntries(page).forEach(seg => {
      if (!bySection.has(section.id)) {
        bySection.set(section.id, { section, entries: [] });
      }
      bySection.get(section.id).entries.push({
        page, date: seg.date, dateLabel: seg.dateLabel, html: seg.html,
      });
    });
  });

  const sectionGroups = Array.from(bySection.values());
  sectionGroups.forEach(g => {
    // Fechadas primero, en orden cronológico; las sin fecha van al final,
    // ordenadas por título de página.
    g.entries.sort((a, b) => {
      if (a.date && b.date) return a.date - b.date || (a.page.title || '').localeCompare(b.page.title || '');
      if (a.date) return -1;
      if (b.date) return 1;
      return (a.page.title || '').localeCompare(b.page.title || '');
    });
  });
  sectionGroups.sort((a, b) =>
    (sectionOrder.get(a.section.id) ?? 0) - (sectionOrder.get(b.section.id) ?? 0)
  );

  return sectionGroups;
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

  renderResumenFilterEncargado();
  renderResumenEmailDatalist();
  recomputeResumen();
}

// Sugerencias del campo "Para:" de envío por correo: direcciones ya
// usadas antes desde este resumen, compartidas entre todos los que usan
// la app (misma lista que state.optionLists, ver loadOptionLists).
function renderResumenEmailDatalist() {
  DOM.resumenEmailDatalist.innerHTML = (state.optionLists.emails || [])
    .map(addr => `<option value="${escHtml(addr)}"></option>`)
    .join('');
}

// Repuebla el <select> de nombres del filtro "Por encargado" con la lista
// compartida (la misma que se carga/edita desde Antecedentes), preservando
// la selección actual si ese nombre sigue estando en la lista.
function renderResumenFilterEncargado() {
  const names = state.optionLists.encargados || [];
  const prev = resumenState.encargado;
  DOM.resumenFilterEncargado.innerHTML = names.length
    ? names.map(n => `<option value="${escHtml(n)}">${escHtml(n)}</option>`).join('')
    : `<option value="">Sin encargados cargados</option>`;
  resumenState.encargado = names.includes(prev) ? prev : (names[0] || '');
  DOM.resumenFilterEncargado.value = resumenState.encargado;
}

function recomputeResumen() {
  const filter = resumenState.mode === 'encargado' ? resumenState.encargado : '';
  resumenState.sectionGroups = buildResumenData(filter);
  renderResumen();
}

function renderResumen() {
  const sectionGroups = resumenState.sectionGroups;
  const totalEntries = sectionGroups.reduce((n, g) => n + g.entries.length, 0);
  const isEncargadoMode = resumenState.mode === 'encargado';

  // El estado "vacío" de toda la página solo aplica si ni siquiera hay
  // datos para el modo "por empresa" (sin eso, no hay filtro que mostrar).
  const hasAnyData = isEncargadoMode ? true : totalEntries > 0;
  if (!hasAnyData) {
    DOM.resumenEmptyState.classList.remove('hidden');
    DOM.resumenReportContainer.classList.add('hidden');
    return;
  }

  DOM.resumenEmptyState.classList.add('hidden');
  DOM.resumenReportContainer.classList.remove('hidden');

  const generadoLabel = new Date().toLocaleDateString('es-AR', { year: 'numeric', month: 'long', day: 'numeric' });

  if (isEncargadoMode && !resumenState.encargado) {
    DOM.resumenTitle.textContent = 'Resumen por encargado';
    DOM.resumenMeta.textContent = 'Todavía no hay encargados cargados en Antecedentes.';
    DOM.resumenReport.innerHTML = '';
    return;
  }

  const titleLabel = isEncargadoMode ? `Obras a cargo de ${resumenState.encargado}` : 'Resumen por empresa';
  DOM.resumenTitle.textContent = isEncargadoMode ? `Resumen — ${resumenState.encargado}` : 'Resumen';
  DOM.resumenMeta.textContent = totalEntries
    ? `${totalEntries} entrada${totalEntries === 1 ? '' : 's'} · ${sectionGroups.length} ${sectionGroups.length === 1 ? 'empresa' : 'empresas'}`
    : 'Sin entradas fechadas todavía para esta persona.';

  const sectionsHtml = sectionGroups.map(({ section, entries }) => {
    const entriesHtml = entries.map(e => `
      <div class="resumen-entry">
        <div class="resumen-entry-meta">
          ${e.dateLabel ? `<span class="resumen-entry-date">${escHtml(e.dateLabel)}</span>` : ''}
          <span class="resumen-entry-page">${escHtml(e.page.title || 'Sin título')}</span>
        </div>
        <div class="resumen-entry-body">${e.html}</div>
      </div>
    `).join('');

    return `
      <div class="resumen-section-block">
        <h3 class="resumen-section-title" style="border-color:${section.color || '#1a1a1a'}">
          <span class="resumen-section-dot" style="background:${section.color || '#1a1a1a'}"></span>
          ${escHtml(section.name)}
        </h3>
        ${entriesHtml}
      </div>
    `;
  }).join('');

  DOM.resumenReport.innerHTML = `
    <div class="resumen-print-header">
      <div class="resumen-print-brand">AiA Arquitectos</div>
      <h1 class="resumen-print-title">${escHtml(titleLabel)}</h1>
      <div class="resumen-print-sub">Generado el ${generadoLabel}</div>
    </div>
    ${sectionsHtml || `<p class="resumen-empty-filtered">Sin entradas fechadas todavía para esta persona.</p>`}
  `;
}

DOM.resumenFilterMode.addEventListener('change', () => {
  resumenState.mode = DOM.resumenFilterMode.value;
  DOM.resumenFilterEncargado.classList.toggle('hidden', resumenState.mode !== 'encargado');
  recomputeResumen();
});

DOM.resumenFilterEncargado.addEventListener('change', () => {
  resumenState.encargado = DOM.resumenFilterEncargado.value;
  recomputeResumen();
});

DOM.resumenPrintBtn.addEventListener('click', () => {
  window.print();
});

// Arma asunto + cuerpo (texto plano, recortado — ni mailto ni el compose
// de Gmail por URL soportan HTML o adjuntos) a partir del resumen actual.
// Devuelve null si no hay nada para mandar.
function buildResumenEmailPayload() {
  const isEncargadoMode = resumenState.mode === 'encargado';
  const subject = isEncargadoMode
    ? `Resumen de obras — ${resumenState.encargado}`
    : 'Resumen por empresa';

  let body = (DOM.resumenReport.innerText || DOM.resumenReport.textContent || '').trim();
  if (!body) {
    toast('No hay contenido en el resumen para enviar.', 'error');
    return null;
  }
  const LIMIT = 1500; // los clientes de mail truncan o rechazan links muy largos
  if (body.length > LIMIT) {
    body = body.slice(0, LIMIT) + '\n\n(resumen recortado — usá "Imprimir" para verlo completo)';
  }
  return { subject, body };
}

// Guarda el correo usado en la lista compartida (state.optionLists.emails)
// para que la próxima vez aparezca sugerido en el campo "Para:".
function rememberResumenEmail(addr) {
  if (addr && !state.optionLists.emails.includes(addr)) {
    addOptionListValue('emails', addr);
  }
}

DOM.resumenGmailBtn.addEventListener('click', () => {
  const payload = buildResumenEmailPayload();
  if (!payload) return;
  const to = DOM.resumenEmailTo.value.trim();
  rememberResumenEmail(to);

  const params = new URLSearchParams({ view: 'cm', fs: '1', su: payload.subject, body: payload.body });
  if (to) params.set('to', to);
  window.open(`https://mail.google.com/mail/?${params.toString()}`, '_blank');
});

// "Otro correo": abre el cliente de mail configurado por defecto en el
// dispositivo (mailto:) para quien no usa Gmail. No envía nada por sí
// solo — el usuario completa lo que falte y aprieta enviar desde su
// propio programa de correo.
DOM.resumenEmailBtn.addEventListener('click', () => {
  const payload = buildResumenEmailPayload();
  if (!payload) return;
  const to = DOM.resumenEmailTo.value.trim();
  rememberResumenEmail(to);

  const mailto = `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(payload.subject)}&body=${encodeURIComponent(payload.body)}`;
  window.location.href = mailto;
});

// ═══════════════════════════════════════════════════════════════════════════
// PLANOS — enlaces a Dropbox (Detalles Constructivos / Proyectos con Permiso)
// ═══════════════════════════════════════════════════════════════════════════
//
// "Planos" es un único módulo del menú con una barra lateral (como Reuniones
// o Resumen) que lista estas entradas fijas. Ninguna tiene contenido propio
// en el portal: cada una solo apunta a una carpeta compartida en el Dropbox
// de aia.arq@gmail.com. El acceso se controla igual que en las secciones de
// Reuniones (allowedUids por doc), pero acá cada una vive en un doc fijo de
// la colección `dropboxLinks`.

const planosState = { currentId: null };

async function loadDropboxLinks() {
  try {
    const snap = await db.collection('dropboxLinks').get();
    state.dropboxLinks = Object.fromEntries(snap.docs.map(d => [d.id, d.data()]));
  } catch (err) {
    console.error('loadDropboxLinks error:', err);
  }
  updateDropboxNavVisibility();
}

function userHasDropboxAccess(linkId) {
  const { userData } = state;
  if (userData.role === 'admin') return true;
  const link = state.dropboxLinks[linkId];
  return !!link && Array.isArray(link.allowedUids) && link.allowedUids.includes(userData.uid);
}

function getAccessibleDropboxLinks() {
  return DROPBOX_LINKS.filter(entry => userHasDropboxAccess(entry.id));
}

// El botón "Planos" del menú se muestra si el usuario tiene acceso a al
// menos uno de los enlaces.
function updateDropboxNavVisibility() {
  const hasAccess = getAccessibleDropboxLinks().length > 0;
  document.querySelectorAll('.module-nav-btn[data-module="planos"]').forEach(b => b.classList.toggle('hidden', !hasAccess));
}

function renderDropboxModules() {
  renderPlanosSidebar();
  renderPlanosArea();
}

function renderPlanosSidebar() {
  const accessible = getAccessibleDropboxLinks();

  if (accessible.length === 0) {
    DOM.planosList.innerHTML = '<div class="empty-state"><p>No tenés planos asignados.<br>Contactá al administrador.</p></div>';
    return;
  }

  // Si no hay selección, o la seleccionada dejó de ser accesible, elegir la primera
  if (!planosState.currentId || !accessible.some(e => e.id === planosState.currentId)) {
    planosState.currentId = accessible[0].id;
  }

  DOM.planosList.innerHTML = accessible.map(entry => `
    <div class="planos-item${entry.id === planosState.currentId ? ' active' : ''}" data-id="${entry.id}">
      <span>${entry.icon}</span><span>${escHtml(entry.name)}</span>
    </div>
  `).join('');

  DOM.planosList.querySelectorAll('.planos-item').forEach(el => {
    el.addEventListener('click', () => {
      planosState.currentId = el.dataset.id;
      renderPlanosSidebar();
      renderPlanosArea();
      DOM.planosSidebar.classList.remove('open');
    });
  });
}

function renderPlanosArea() {
  const container = DOM.planosArea;
  const isAdmin   = state.userData.role === 'admin';
  const entry     = DROPBOX_LINKS.find(e => e.id === planosState.currentId);

  if (!entry) {
    container.className = 'dropbox-area';
    container.innerHTML = '<div class="empty-state"><p>Seleccioná un plano para ver su enlace.</p></div>';
    return;
  }

  if (entry.type === 'notes') {
    container.className = 'municipal-area';
    renderPlanosNotesArea(entry);
    return;
  }
  if (entry.type === 'library') {
    container.className = 'library-area';
    renderPlanosLibraryArea(entry);
    return;
  }
  container.className = 'dropbox-area';

  const link = state.dropboxLinks[entry.id];
  const url  = link && link.url;

  if (url) {
    container.innerHTML = `
      <div class="empty-state">
        <div style="font-size:40px;line-height:1">${entry.icon}</div>
        <p style="font-size:16px;font-weight:600;color:var(--text);margin-top:10px">${escHtml(entry.name)}</p>
        <p>Los archivos se gestionan en Dropbox (aia.arq@gmail.com).</p>
        <a class="btn-sm primary" style="display:inline-flex;align-items:center;gap:6px;margin-top:12px;text-decoration:none"
           href="${escHtml(url)}" target="_blank" rel="noopener noreferrer">
          Abrir en Dropbox ↗
        </a>
      </div>
    `;
  } else {
    container.innerHTML = `
      <div class="empty-state">
        <div style="font-size:40px;line-height:1">${entry.icon}</div>
        <p style="font-size:16px;font-weight:600;color:var(--text);margin-top:10px">${escHtml(entry.name)}</p>
        <p>Todavía no se configuró el enlace de la carpeta de Dropbox.${isAdmin ? ' Configuralo en Administración → Dropbox.' : ' Pedile al administrador que lo configure.'}</p>
      </div>
    `;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// PLANOS — ÍTEMS "NOTES" (mini-wiki con notas + archivos por obra)
// ═══════════════════════════════════════════════════════════════════════════
//
// Cubre cualquier entrada de DROPBOX_LINKS con type:'notes' (hoy:
// "Antecedentes Municipales" y "Normativas" — puede haber más). Todas
// comparten una única colección `planosPages`, distinguidas por
// `parentId` (el id de la entrada), así que agregar una entrada nueva de
// este tipo no pide tocar el esquema. Reusan las mismas secciones
// (empresas) de Reuniones — no hace falta duplicarlas, ya tienen su
// propio control de acceso — pero cada obra (página) tiene, para cada
// entrada 'notes', su propio doc independiente en `planosPages` con notas
// de texto y archivos adjuntos (Firebase Storage), separado del contenido
// de la reunión y de las demás entradas 'notes'. "Sincronizar" crea, para
// cada página de Reuniones que todavía no tenga su par acá, una entrada
// vacía lista para cargar — es incremental: correrlo de nuevo no duplica
// lo ya copiado.

const planosNotesState = {
  parentId: null,   // qué entrada de DROPBOX_LINKS está cargada (ver abajo)
  loaded: false,
  loading: false,
  sections: [],     // secciones accesibles (mismas que Reuniones)
  sourcePages: [],  // páginas de Reuniones, solo para poder sincronizar
  items: [],         // docs de planosPages con parentId === este parentId
  currentPageId: null,
  notesTimer: null,
};

async function loadPlanosNotesData(entry) {
  if (planosNotesState.loading) return;
  planosNotesState.loading = true;
  planosNotesState.parentId = entry.id;
  DOM.planosArea.innerHTML = '<div class="empty-state"><p>Cargando...</p></div>';

  try {
    const [sectionsSnap, pagesSnap, notesSnap] = await Promise.all([
      db.collection('sections').orderBy('createdAt').get(),
      db.collection('pages').orderBy('order').get(),
      db.collection('planosPages').where('parentId', '==', entry.id).get(),
    ]);
    const allSections = sectionsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    planosNotesState.sections = state.userData.role === 'admin'
      ? allSections
      : allSections.filter(s => Array.isArray(s.allowedUids) && s.allowedUids.includes(state.userData.uid));
    planosNotesState.sourcePages = pagesSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    planosNotesState.items       = notesSnap.docs.map(d => ({ id: d.id, ...d.data() }))
      .sort((a, b) => (a.order || 0) - (b.order || 0));
  } catch (err) {
    console.error('loadPlanosNotesData error:', err);
    toast(`Error al cargar ${entry.name}: ` + err.message, 'error');
    planosNotesState.loading = false;
    DOM.planosArea.innerHTML = `<div class="empty-state"><p>Error al cargar. ${escHtml(err.message)}</p></div>`;
    return;
  }

  planosNotesState.loading = false;
  planosNotesState.loaded = true;
  planosNotesState.currentPageId = null;

  // Primera vez que se usa esta entrada (todavía no hay ninguna obra
  // copiada): arranca solo con lo que ya existe en Reuniones, para no
  // partir de cero.
  if (planosNotesState.items.length === 0 && planosNotesState.sourcePages.length > 0) {
    await syncPlanosNotesPages(entry, true);
  }

  renderPlanosNotesArea(entry);
}

// Crea, para cada página de Reuniones que todavía no tenga su par en
// `planosPages` para esta entrada (comparando por sourcePageId), un doc
// nuevo vacío. Devuelve cuántos creó. Es seguro llamarla varias veces.
async function syncPlanosNotesPages(entry, silent) {
  const existingSourceIds = new Set(planosNotesState.items.map(p => p.sourcePageId).filter(Boolean));
  const accessibleSectionIds = new Set(planosNotesState.sections.map(s => s.id));
  const toCreate = planosNotesState.sourcePages.filter(p =>
    !existingSourceIds.has(p.id) && accessibleSectionIds.has(p.sectionId)
  );
  if (!toCreate.length) {
    if (!silent) toast('No hay obras nuevas para copiar.', 'info');
    return 0;
  }

  try {
    const batch = db.batch();
    const newDocs = [];
    toCreate.forEach(p => {
      const ref = db.collection('planosPages').doc();
      const data = {
        parentId: entry.id,
        sectionId: p.sectionId,
        sourcePageId: p.id,
        title: p.title || 'Sin título',
        notes: '',
        antecedentes: p.antecedentes || null,
        files: [],
        order: p.order || 0,
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
      };
      batch.set(ref, data);
      newDocs.push({ id: ref.id, ...data });
    });
    await batch.commit();
    planosNotesState.items.push(...newDocs);
    if (!silent) toast(`${toCreate.length} obra${toCreate.length === 1 ? '' : 's'} copiada${toCreate.length === 1 ? '' : 's'} de Reuniones.`, 'success');
    return toCreate.length;
  } catch (err) {
    console.error('syncPlanosNotesPages error:', err);
    toast('Error al sincronizar: ' + err.message, 'error');
    return 0;
  }
}

function renderPlanosNotesArea(entry) {
  const container = DOM.planosArea;

  // Si se cambió a otra entrada 'notes' (ej. de Antecedentes Municipales a
  // Normativas), hay que recargar — son colecciones lógicas distintas.
  if (!planosNotesState.loaded || planosNotesState.parentId !== entry.id) {
    planosNotesState.loaded = false;
    loadPlanosNotesData(entry);
    return;
  }

  const groups = planosNotesState.sections.map(section => ({
    section,
    items: planosNotesState.items.filter(it => it.sectionId === section.id)
      .sort((a, b) => (a.order || 0) - (b.order || 0) || (a.title || '').localeCompare(b.title || '', 'es')),
  }));

  if (!planosNotesState.currentPageId || !planosNotesState.items.some(it => it.id === planosNotesState.currentPageId)) {
    planosNotesState.currentPageId = groups.find(g => g.items.length)?.items[0]?.id || null;
  }

  container.innerHTML = `
    <div class="municipal-sidebar">
      <div class="municipal-sidebar-header">
        <span>${escHtml(entry.name)}</span>
        <button class="btn-sm" id="municipal-sync-btn" title="Copiar obras nuevas de Reuniones">🔄</button>
      </div>
      <div class="municipal-sections-list">
        ${groups.length === 0 ? '<div class="empty-state"><p>No hay secciones accesibles.</p></div>' : groups.map(g => `
          <div class="municipal-section-group">
            <div class="municipal-section-name" style="border-left-color:${g.section.color || '#1a1a1a'}">${escHtml(g.section.name)}</div>
            ${g.items.length === 0
              ? '<div class="municipal-section-empty">Sin obras copiadas todavía</div>'
              : g.items.map(it => `
                <div class="municipal-page-item${it.id === planosNotesState.currentPageId ? ' active' : ''}" data-id="${it.id}">
                  ${escHtml(it.title || 'Sin título')}${(it.files || []).length ? ` <span class="municipal-file-count">📎${it.files.length}</span>` : ''}
                </div>
              `).join('')}
          </div>
        `).join('')}
      </div>
    </div>
    <div class="municipal-editor" id="municipal-editor"></div>
  `;

  $('municipal-sync-btn').addEventListener('click', async () => {
    $('municipal-sync-btn').disabled = true;
    await syncPlanosNotesPages(entry, false);
    $('municipal-sync-btn').disabled = false;
    renderPlanosNotesArea(entry);
  });

  container.querySelectorAll('.municipal-page-item').forEach(el => {
    el.addEventListener('click', () => {
      planosNotesState.currentPageId = el.dataset.id;
      renderPlanosNotesArea(entry);
    });
  });

  renderPlanosNotesEditor();
}

function renderPlanosNotesEditor() {
  const editor = $('municipal-editor');
  if (!editor) return;
  const item = planosNotesState.items.find(it => it.id === planosNotesState.currentPageId);
  const canEdit = state.userData.role !== 'viewer';

  if (!item) {
    editor.innerHTML = '<div class="empty-state"><p>Seleccioná una obra para ver sus antecedentes.</p></div>';
    return;
  }

  editor.innerHTML = `
    <div class="municipal-editor-title">${escHtml(item.title || 'Sin título')}</div>
    <textarea id="municipal-notes" placeholder="Notas..." ${canEdit ? '' : 'disabled'}>${escHtml(item.notes || '')}</textarea>
    <div class="municipal-files">
      <div class="municipal-files-header">
        <span>Archivos</span>
        ${canEdit ? `
          <label class="btn-sm municipal-upload-btn">
            📎 Subir archivo${item.files && item.files.length ? 's' : ''}
            <input type="file" id="municipal-file-input" multiple hidden />
          </label>
        ` : ''}
      </div>
      <div class="municipal-files-list">
        ${(item.files || []).length === 0
          ? '<p class="ant-empty-hint">Sin archivos todavía</p>'
          : item.files.map((f, i) => `
            <div class="municipal-file-row">
              <button type="button" class="municipal-file-name" data-url="${escHtml(f.url)}" data-name="${escHtml(f.name)}">${escHtml(f.name)}</button>
              <a class="municipal-file-open" href="${escHtml(f.url)}" target="_blank" rel="noopener noreferrer" title="Abrir en pestaña nueva">↗</a>
              <span class="municipal-file-size">${formatFileSize(f.size)}</span>
              ${canEdit ? `<button type="button" class="municipal-file-remove" data-index="${i}" title="Eliminar">×</button>` : ''}
            </div>
          `).join('')}
      </div>
      <div id="municipal-upload-status"></div>
    </div>
  `;

  bindFileRowPreviews(editor);

  if (!canEdit) return;

  const notesEl = $('municipal-notes');
  notesEl.addEventListener('input', () => {
    clearTimeout(planosNotesState.notesTimer);
    planosNotesState.notesTimer = setTimeout(() => savePlanosNotesText(item.id, notesEl.value), 1000);
  });

  const fileInput = $('municipal-file-input');
  fileInput.addEventListener('change', () => {
    if (fileInput.files.length) uploadPlanosNotesFiles(item.id, Array.from(fileInput.files));
    fileInput.value = '';
  });

  editor.querySelectorAll('.municipal-file-remove').forEach(btn => {
    btn.addEventListener('click', () => {
      const index = parseInt(btn.dataset.index, 10);
      deletePlanosNotesFile(item.id, index);
    });
  });
}

function formatFileSize(bytes) {
  if (!bytes && bytes !== 0) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// Sube un archivo a Storage reportando progreso (0-100) a medida que va,
// en vez de solo saber al final si terminó — para que en archivos grandes
// o conexiones lentas se vea que efectivamente está avanzando.
function uploadFileWithProgress(path, file, onProgress) {
  return new Promise((resolve, reject) => {
    const task = storage.ref(path).put(file);
    task.on('state_changed',
      snap => onProgress(Math.round((snap.bytesTransferred / snap.totalBytes) * 100)),
      reject,
      () => task.snapshot.ref.getDownloadURL().then(resolve).catch(reject)
    );
  });
}

// Alterna una vista previa embebida (iframe) del PDF justo debajo de su
// fila, para poder leerlo ahí mismo sin salir de la página. Solo deja una
// abierta a la vez dentro de la misma lista.
function toggleInlinePdfPreview(rowEl, url, name) {
  const next = rowEl.nextElementSibling;
  if (next && next.classList.contains('municipal-file-preview')) {
    next.remove();
    return;
  }
  rowEl.parentElement.querySelectorAll('.municipal-file-preview').forEach(el => el.remove());
  const preview = document.createElement('div');
  preview.className = 'municipal-file-preview';
  preview.innerHTML = `<iframe src="${escHtml(url)}" title="${escHtml(name)}"></iframe>`;
  rowEl.after(preview);
}

function bindFileRowPreviews(container) {
  container.querySelectorAll('.municipal-file-name').forEach(btn => {
    btn.addEventListener('click', () => {
      toggleInlinePdfPreview(btn.closest('.municipal-file-row'), btn.dataset.url, btn.dataset.name);
    });
  });
}

async function savePlanosNotesText(pageId, notes) {
  const item = planosNotesState.items.find(it => it.id === pageId);
  if (item) item.notes = notes;
  try {
    await db.collection('planosPages').doc(pageId).update({
      notes, updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
    });
  } catch (err) {
    console.error('savePlanosNotesText error:', err);
    toast('Error al guardar las notas: ' + err.message, 'error');
  }
}

async function uploadPlanosNotesFiles(pageId, files) {
  const status = $('municipal-upload-status');
  const item = planosNotesState.items.find(it => it.id === pageId);
  if (!item) return;

  const progress = {};
  const renderStatus = () => {
    if (status) status.innerHTML = Object.entries(progress).map(([name, pct]) => `<div>${escHtml(name)}: ${pct}%</div>`).join('');
  };

  // En paralelo: con varios PDFs a la vez, subirlos uno por uno (como
  // antes) tardaba la suma de todos; así tardan lo que tarda el más lento.
  await Promise.all(files.map(async file => {
    progress[file.name] = 0;
    renderStatus();
    const path = `planos/${pageId}/${Date.now()}_${file.name}`;
    try {
      const url = await uploadFileWithProgress(path, file, pct => { progress[file.name] = pct; renderStatus(); });
      const meta = { name: file.name, path, url, size: file.size, uploadedAt: new Date().toISOString() };
      await db.collection('planosPages').doc(pageId).update({
        files: firebase.firestore.FieldValue.arrayUnion(meta),
        updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
      });
      item.files = [...(item.files || []), meta];
    } catch (err) {
      console.error('uploadPlanosNotesFiles error:', err);
      toast(`Error al subir ${file.name}: ` + err.message, 'error');
    } finally {
      delete progress[file.name];
      renderStatus();
    }
  }));
  renderPlanosNotesEditor();
}

async function deletePlanosNotesFile(pageId, index) {
  const item = planosNotesState.items.find(it => it.id === pageId);
  if (!item || !item.files || !item.files[index]) return;
  const file = item.files[index];

  try {
    await storage.ref(file.path).delete().catch(() => {}); // si ya no está en Storage, igual se saca de la lista
    await db.collection('planosPages').doc(pageId).update({
      files: firebase.firestore.FieldValue.arrayRemove(file),
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
    });
    item.files = item.files.filter((_, i) => i !== index);
    renderPlanosNotesEditor();
  } catch (err) {
    console.error('deletePlanosNotesFile error:', err);
    toast('Error al eliminar el archivo: ' + err.message, 'error');
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// PLANOS — ÍTEMS "LIBRARY" (grupos armados a mano para juntar PDFs sueltos)
// ═══════════════════════════════════════════════════════════════════════════
//
// Cubre cualquier entrada de DROPBOX_LINKS con type:'library' (hoy:
// "Normativas"). A diferencia de 'notes', acá no hay obras: el usuario
// arma sus propios grupos (ej. "OGUC", "Plan Regulador Comunal") y sube
// los PDFs que quiera adentro de cada uno. Todas comparten una única
// colección `planosGroups`, distinguidas por `parentId`.

const planosLibraryState = {
  parentId: null,
  loaded: false,
  loading: false,
  groups: [],
};

async function loadPlanosLibraryData(entry) {
  if (planosLibraryState.loading) return;
  planosLibraryState.loading = true;
  planosLibraryState.parentId = entry.id;
  DOM.planosArea.innerHTML = '<div class="empty-state"><p>Cargando...</p></div>';

  try {
    const snap = await db.collection('planosGroups').where('parentId', '==', entry.id).get();
    planosLibraryState.groups = snap.docs.map(d => ({ id: d.id, ...d.data() }))
      .sort((a, b) => (a.order || 0) - (b.order || 0) || (a.name || '').localeCompare(b.name || '', 'es'));
  } catch (err) {
    console.error('loadPlanosLibraryData error:', err);
    toast(`Error al cargar ${entry.name}: ` + err.message, 'error');
    planosLibraryState.loading = false;
    DOM.planosArea.innerHTML = `<div class="empty-state"><p>Error al cargar. ${escHtml(err.message)}</p></div>`;
    return;
  }

  planosLibraryState.loading = false;
  planosLibraryState.loaded = true;
  renderPlanosLibraryArea(entry);
}

function renderPlanosLibraryArea(entry) {
  const container = DOM.planosArea;

  if (!planosLibraryState.loaded || planosLibraryState.parentId !== entry.id) {
    planosLibraryState.loaded = false;
    loadPlanosLibraryData(entry);
    return;
  }

  const canEdit = state.userData.role !== 'viewer';
  const groups = planosLibraryState.groups;

  container.innerHTML = `
    <div class="library-header">
      <span>${escHtml(entry.name)}</span>
      ${canEdit ? '<button class="btn-sm primary" id="library-new-group-btn">+ Nuevo grupo</button>' : ''}
    </div>
    <div class="library-groups">
      ${groups.length === 0
        ? '<div class="empty-state"><p>Todavía no hay grupos. Creá uno para empezar a juntar PDFs.</p></div>'
        : groups.map(g => `
          <div class="library-group-card" data-id="${g.id}">
            <div class="library-group-header">
              <span class="library-group-name">${escHtml(g.name || 'Sin nombre')}</span>
              ${canEdit ? `
                <label class="btn-sm library-upload-btn">
                  📎 Subir PDF
                  <input type="file" class="library-file-input" data-id="${g.id}" accept="application/pdf" multiple hidden />
                </label>
                <button type="button" class="btn-sm library-group-delete" data-id="${g.id}" title="Eliminar grupo">🗑️</button>
              ` : ''}
            </div>
            <div class="municipal-files-list">
              ${(g.files || []).length === 0
                ? '<p class="ant-empty-hint">Sin archivos todavía</p>'
                : g.files.map((f, i) => `
                  <div class="municipal-file-row">
                    <button type="button" class="municipal-file-name" data-url="${escHtml(f.url)}" data-name="${escHtml(f.name)}">${escHtml(f.name)}</button>
                    <a class="municipal-file-open" href="${escHtml(f.url)}" target="_blank" rel="noopener noreferrer" title="Abrir en pestaña nueva">↗</a>
                    <span class="municipal-file-size">${formatFileSize(f.size)}</span>
                    ${canEdit ? `<button type="button" class="library-file-remove" data-id="${g.id}" data-index="${i}" title="Eliminar">×</button>` : ''}
                  </div>
                `).join('')}
            </div>
            <div class="library-upload-status" data-id="${g.id}"></div>
          </div>
        `).join('')}
    </div>
  `;

  bindFileRowPreviews(container);

  if (!canEdit) return;

  $('library-new-group-btn')?.addEventListener('click', () => createPlanosGroup(entry));

  container.querySelectorAll('.library-file-input').forEach(input => {
    input.addEventListener('change', () => {
      if (input.files.length) uploadPlanosGroupFiles(input.dataset.id, Array.from(input.files));
      input.value = '';
    });
  });

  container.querySelectorAll('.library-file-remove').forEach(btn => {
    btn.addEventListener('click', () => {
      deletePlanosGroupFile(btn.dataset.id, parseInt(btn.dataset.index, 10));
    });
  });

  container.querySelectorAll('.library-group-delete').forEach(btn => {
    btn.addEventListener('click', () => deletePlanosGroup(entry, btn.dataset.id));
  });
}

async function createPlanosGroup(entry) {
  const name = (prompt('Nombre del grupo (ej. "OGUC", "Plan Regulador Comunal"):') || '').trim();
  if (!name) return;

  try {
    const ref = db.collection('planosGroups').doc();
    const data = {
      parentId: entry.id,
      name,
      files: [],
      order: planosLibraryState.groups.length,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    };
    await ref.set(data);
    planosLibraryState.groups.push({ id: ref.id, ...data });
    renderPlanosLibraryArea(entry);
  } catch (err) {
    console.error('createPlanosGroup error:', err);
    toast('Error al crear el grupo: ' + err.message, 'error');
  }
}

function deletePlanosGroup(entry, groupId) {
  const group = planosLibraryState.groups.find(g => g.id === groupId);
  if (!group) return;

  openModal({
    title: 'Eliminar grupo',
    body: `<p>¿Eliminar el grupo <strong>${escHtml(group.name || 'Sin nombre')}</strong> y sus ${(group.files || []).length} archivo${(group.files || []).length === 1 ? '' : 's'}? Esta acción no se puede deshacer.</p>`,
    footer: `
      <button class="btn-sm" id="m-cancel-btn">Cancelar</button>
      <button class="btn-sm danger" id="m-confirm-btn">Eliminar</button>
    `,
  });

  $('m-cancel-btn').addEventListener('click', closeModal);
  $('m-confirm-btn').addEventListener('click', async () => {
    $('m-confirm-btn').disabled = true;
    try {
      await Promise.all((group.files || []).map(f => storage.ref(f.path).delete().catch(() => {})));
      await db.collection('planosGroups').doc(groupId).delete();
      planosLibraryState.groups = planosLibraryState.groups.filter(g => g.id !== groupId);
      closeModal();
      renderPlanosLibraryArea(entry);
      toast('Grupo eliminado', 'success');
    } catch (err) {
      console.error('deletePlanosGroup error:', err);
      toast('Error al eliminar el grupo: ' + err.message, 'error');
      closeModal();
    }
  });
}

async function uploadPlanosGroupFiles(groupId, files) {
  const status = document.querySelector(`.library-upload-status[data-id="${groupId}"]`);
  const group = planosLibraryState.groups.find(g => g.id === groupId);
  if (!group) return;

  const progress = {};
  const renderStatus = () => {
    if (status) status.innerHTML = Object.entries(progress).map(([name, pct]) => `<div>${escHtml(name)}: ${pct}%</div>`).join('');
  };

  // En paralelo: con varios PDFs a la vez, subirlos uno por uno (como
  // antes) tardaba la suma de todos; así tardan lo que tarda el más lento.
  await Promise.all(files.map(async file => {
    progress[file.name] = 0;
    renderStatus();
    const path = `planos/${groupId}/${Date.now()}_${file.name}`;
    try {
      const url = await uploadFileWithProgress(path, file, pct => { progress[file.name] = pct; renderStatus(); });
      const meta = { name: file.name, path, url, size: file.size, uploadedAt: new Date().toISOString() };
      await db.collection('planosGroups').doc(groupId).update({
        files: firebase.firestore.FieldValue.arrayUnion(meta),
      });
      group.files = [...(group.files || []), meta];
    } catch (err) {
      console.error('uploadPlanosGroupFiles error:', err);
      toast(`Error al subir ${file.name}: ` + err.message, 'error');
    } finally {
      delete progress[file.name];
      renderStatus();
    }
  }));
  const entry = DROPBOX_LINKS.find(e => e.id === planosLibraryState.parentId);
  if (entry) renderPlanosLibraryArea(entry);
}

async function deletePlanosGroupFile(groupId, index) {
  const group = planosLibraryState.groups.find(g => g.id === groupId);
  if (!group || !group.files || !group.files[index]) return;
  const file = group.files[index];

  try {
    await storage.ref(file.path).delete().catch(() => {});
    await db.collection('planosGroups').doc(groupId).update({
      files: firebase.firestore.FieldValue.arrayRemove(file),
    });
    group.files = group.files.filter((_, i) => i !== index);
    const entry = DROPBOX_LINKS.find(e => e.id === planosLibraryState.parentId);
    if (entry) renderPlanosLibraryArea(entry);
  } catch (err) {
    console.error('deletePlanosGroupFile error:', err);
    toast('Error al eliminar el archivo: ' + err.message, 'error');
  }
}

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
        <div class="section-card-color" style="background:${s.color || '#1a1a1a'}"></div>
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
// ADMIN — DROPBOX TAB
// ═══════════════════════════════════════════════════════════════════════════

async function loadAdminDropbox() {
  DOM.adminDropboxList.innerHTML = '<p style="color:var(--text-muted);font-size:13px">Cargando...</p>';

  try {
    const [linksSnap, usersSnap] = await Promise.all([
      db.collection('dropboxLinks').get(),
      db.collection('users').get(),
    ]);

    state.dropboxLinks = Object.fromEntries(linksSnap.docs.map(d => [d.id, d.data()]));
    const users = usersSnap.docs.map(d => ({ id: d.id, ...d.data() }));

    renderAdminDropbox(users);
    updateDropboxNavVisibility();
  } catch (err) {
    DOM.adminDropboxList.innerHTML = `<p style="color:var(--danger)">Error: ${err.message}</p>`;
  }
}

function renderAdminDropbox(users) {
  DOM.adminDropboxList.innerHTML = DROPBOX_LINKS.map(entry => {
    const link = state.dropboxLinks[entry.id] || {};
    const allowedUsers = users.filter(u => (link.allowedUids || []).includes(u.uid));
    const accessLabel  = allowedUsers.length === 0
      ? '<em style="color:var(--text-muted)">Sin acceso asignado</em>'
      : allowedUsers.map(u => `<span style="font-size:12px;background:var(--sidebar-bg);padding:2px 6px;border-radius:99px;margin:2px">${escHtml(u.name || u.email)}</span>`).join('');

    if (entry.type === 'notes' || entry.type === 'library') {
      const desc = entry.type === 'notes'
        ? 'Mini-wiki con notas y archivos por obra (copiadas de Reuniones) — no usa enlace de Dropbox.'
        : 'Grupos armados a mano para juntar PDFs sueltos — no usa enlace de Dropbox.';
      return `
        <div class="dropbox-admin-card" data-link-id="${entry.id}">
          <div class="dropbox-admin-card-header">
            <span class="dropbox-admin-card-title">${entry.icon} ${escHtml(entry.name)}</span>
            <button class="btn-sm js-manage-dropbox-access" data-id="${entry.id}">👥 Accesos</button>
          </div>
          <p class="section-card-meta" style="margin:8px 0">${desc}</p>
          <div class="dropbox-admin-card-footer">
            <span class="section-card-meta">Acceso: ${accessLabel}</span>
          </div>
        </div>
      `;
    }

    return `
      <div class="dropbox-admin-card" data-link-id="${entry.id}">
        <div class="dropbox-admin-card-header">
          <span class="dropbox-admin-card-title">${entry.icon} ${escHtml(entry.name)}</span>
          <button class="btn-sm js-manage-dropbox-access" data-id="${entry.id}">👥 Accesos</button>
        </div>
        <div class="form-group" style="margin:10px 0 4px">
          <label>Enlace de la carpeta compartida de Dropbox</label>
          <input type="text" class="js-dropbox-url" data-id="${entry.id}" placeholder="https://www.dropbox.com/scl/fo/..." value="${escHtml(link.url || '')}" />
        </div>
        <div class="dropbox-admin-card-footer">
          <span class="section-card-meta">Acceso: ${accessLabel}</span>
          <button class="btn-sm primary js-save-dropbox-url" data-id="${entry.id}">Guardar enlace</button>
        </div>
      </div>
    `;
  }).join('');

  bindAdminDropboxButtons(users);
}

function bindAdminDropboxButtons(users) {
  DOM.adminDropboxList.querySelectorAll('.js-save-dropbox-url').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id     = btn.dataset.id;
      const entry  = DROPBOX_LINKS.find(l => l.id === id);
      const input  = DOM.adminDropboxList.querySelector(`.js-dropbox-url[data-id="${id}"]`);
      const url    = input.value.trim();
      const existing = state.dropboxLinks[id] || {};

      btn.disabled = true;
      try {
        await db.collection('dropboxLinks').doc(id).set({
          name: entry.name,
          url,
          allowedUids: existing.allowedUids || [],
        }, { merge: true });
        state.dropboxLinks[id] = { ...existing, name: entry.name, url };
        updateDropboxNavVisibility();
        renderDropboxModules();
        toast('Enlace guardado', 'success');
      } catch (err) {
        toast('Error: ' + err.message, 'error');
      } finally {
        btn.disabled = false;
      }
    });
  });

  DOM.adminDropboxList.querySelectorAll('.js-manage-dropbox-access').forEach(btn => {
    btn.addEventListener('click', () => {
      const id    = btn.dataset.id;
      const entry = DROPBOX_LINKS.find(l => l.id === id);
      const link  = state.dropboxLinks[id] || {};
      openManageDropboxAccessModal(entry, link, users);
    });
  });
}

function openManageDropboxAccessModal(entry, link, allUsers) {
  const editorViewers = allUsers.filter(u => u.role !== 'admin');
  const currentUids   = link.allowedUids || [];

  openModal({
    title: `Accesos — ${entry.name}`,
    body: `
      <p style="font-size:13px;color:var(--text-muted);margin-bottom:12px">
        Seleccioná qué usuarios pueden ver esta sección y su enlace de Dropbox.
        Los administradores siempre tienen acceso.
      </p>
      <div class="access-list">
        ${editorViewers.length === 0
          ? '<p style="color:var(--text-muted);font-size:13px">No hay usuarios con rol editor o viewer.</p>'
          : editorViewers.map(u => `
            <div class="access-item">
              <input type="checkbox" id="dacc-${u.uid}" value="${u.uid}" ${currentUids.includes(u.uid) ? 'checked' : ''} />
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
      await db.collection('dropboxLinks').doc(entry.id).set({
        name: entry.name,
        url: link.url || '',
        allowedUids: checked,
      }, { merge: true });
      state.dropboxLinks[entry.id] = { ...link, name: entry.name, url: link.url || '', allowedUids: checked };
      closeModal();
      loadAdminDropbox();
      updateDropboxNavVisibility();
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
              ${section.name ? `<span style="background:${section.color||'#1a1a1a'};color:#fff;padding:1px 6px;border-radius:99px;font-size:11px">${escHtml(section.name)}</span> · ` : ''}
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
  // If wiki is active, also toggle its own sidebar
  if (DOM.wikiModule.classList.contains('active')) {
    DOM.wikiSidebar.classList.toggle('open');
  }
  if (DOM.planosModule.classList.contains('active')) {
    DOM.planosSidebar.classList.toggle('open');
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
