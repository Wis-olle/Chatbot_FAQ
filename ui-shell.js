const byId = id => document.getElementById(id);
const mobile = matchMedia('(max-width: 760px)');
let menuOpen = false;

export function icon(name, className = '') {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('class', `icon ${className}`.trim());
  svg.setAttribute('aria-hidden', 'true');
  const use = document.createElementNS('http://www.w3.org/2000/svg', 'use');
  use.setAttribute('href', `/icons.svg#${name}`);
  svg.append(use);
  return svg;
}

function syncSidebar() {
  const open = mobile.matches && menuOpen;
  const sidebar = byId('app-sidebar');
  sidebar.inert = mobile.matches && !open;
  sidebar.setAttribute('aria-hidden', String(mobile.matches && !open));
  byId('main').inert = open;
  byId('sidebar-backdrop').hidden = !open;
  byId('open-sidebar').setAttribute('aria-expanded', String(open));
  document.body.classList.toggle('sidebar-open', open);
  if (open) {
    sidebar.setAttribute('role', 'dialog');
    sidebar.setAttribute('aria-modal', 'true');
  } else {
    sidebar.removeAttribute('role');
    sidebar.removeAttribute('aria-modal');
  }
}

export function closeSidebar(restoreFocus = true) {
  const wasOpen = menuOpen;
  menuOpen = false;
  syncSidebar();
  if (wasOpen && restoreFocus && mobile.matches) byId('open-sidebar').focus();
}

function handleMenuKeys(event) {
  if (!mobile.matches || !menuOpen) return;
  if (event.key === 'Escape') { event.preventDefault(); closeSidebar(); return; }
  if (event.key !== 'Tab') return;
  const controls = [...byId('app-sidebar').querySelectorAll('a[href], button:not(:disabled), [tabindex="0"]')]
    .filter(node => node.getClientRects().length > 0);
  const first = controls[0];
  const last = controls.at(-1);
  if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
  else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
}

function applyTheme(theme, persist = false) {
  const dark = theme === 'dark';
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  const button = byId('theme-toggle');
  button.setAttribute('aria-pressed', String(dark));
  button.setAttribute('aria-label', dark ? 'Chuyển sang giao diện sáng' : 'Chuyển sang giao diện tối');
  button.replaceChildren(icon(dark ? 'sun' : 'moon'));
  document.querySelector('meta[name="theme-color"]').content = dark ? '#151517' : '#ffffff';
  if (persist) {
    try { localStorage.setItem('hosting-demo.theme.v1', dark ? 'dark' : 'light'); }
    catch { /* The visual preference still works when browser storage is unavailable. */ }
  }
}

export function mountShell() {
  let theme = 'light';
  try { theme = localStorage.getItem('hosting-demo.theme.v1') ?? 'light'; }
  catch { /* Default to light when browser storage is unavailable. */ }
  applyTheme(theme);
  byId('theme-toggle').addEventListener('click', () => applyTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark', true));
  byId('open-sidebar').addEventListener('click', () => {
    menuOpen = true;
    syncSidebar();
    requestAnimationFrame(() => { if (menuOpen && mobile.matches) byId('close-sidebar').focus(); });
  });
  byId('close-sidebar').addEventListener('click', () => closeSidebar());
  byId('sidebar-backdrop').addEventListener('click', () => closeSidebar());
  byId('app-sidebar').querySelectorAll('a').forEach(link => link.addEventListener('click', () => closeSidebar(false)));
  document.addEventListener('keydown', handleMenuKeys);
  mobile.addEventListener('change', () => {
    const sidebarHadFocus = byId('app-sidebar').contains(document.activeElement);
    closeSidebar(false);
    if (mobile.matches && sidebarHadFocus) byId('open-sidebar').focus();
  });
  syncSidebar();
}
