import './styles.css';
import { lessons, tracks, questions, commands, references } from './content.js';
import { practices } from './practices.js';
import { calculateSubnet, campusConfig, departments, packetJourney } from './network.js';
import { loadProgress, saveProgress } from './storage.js';
import { icon, escapeHTML as esc, codeBlock, markdown, networkSVG } from './ui.js';

const app = document.querySelector('#app');
const nav = [
  ['inicio', 'Tu dashboard', 'home'], ['ruta', 'Ruta de aprendizaje', 'route'],
  ['practicas', 'Prácticas guiadas', 'layers'], ['mapa', 'Mapa de red', 'network'],
  ['comandos', 'Chuleta de comandos', 'terminal'], ['repaso', 'Ponte a prueba', 'zap'],
  ['biblioteca', 'Apuntes y fuentes', 'book'],
];
let progress = loadProgress();
// Ignore stale IDs from previous content versions when computing progress.
progress.lessons = progress.lessons.filter(id => lessons.some(l => l.id === id));
progress.saved = progress.saved.filter(id => lessons.some(l => l.id === id));
let notes = null;
let notesPromise = null;
let quiz = null;
let flashIndex = 0;
let flashFlipped = false;
let toastTimer;
let filter = 'all';
let practiceFilter = 'all';
let mapState = { department: 101, role: 'access', destination: 'other', routing: false, journey: null };
const norm = text => String(text).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const percent = (n, total) => total ? Math.round(n / total * 100) : 0;
const doneSteps = practice => (progress.steps[practice.id] || []).filter(i => i < practice.steps.length).length;
const doneLabs = () => practices.filter(p => doneSteps(p) === p.steps.length).length;
const findLesson = id => lessons.find(l => l.id === id);
const nextLesson = () => lessons.find(l => !progress.lessons.includes(l.id)) || lessons[0];
const href = (route, id) => `#${route}${id ? '/' + encodeURIComponent(id) : ''}`;
const badge = (text, color = '') => `<span class="badge ${color}">${text}</span>`;
const buttonLink = (link, text, primary = false, name = 'arrow') => `<a class="btn ${primary ? 'primary' : 'secondary'}" href="${link}">${text}${icon(name)}</a>`;

function toast(message) {
  const element = document.querySelector('#toast');
  element.textContent = message;
  element.classList.add('visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => element.classList.remove('visible'), 3500);
}

function persist() {
  if (!saveProgress(progress)) toast('No se pudo guardar en este navegador. Tu avance se conserva durante esta sesión.');
}

function routeInfo() {
  const [route = 'inicio', ...rest] = location.hash.slice(1).split('/');
  let id;
  try { id = decodeURIComponent(rest.join('/')); } catch { id = ''; }
  return { route: route || 'inicio', id };
}

function heading(eyebrow, title, description = '', action = '') {
  return `<div class="page-heading"><div><p class="eyebrow">${eyebrow}</p><h1>${title}</h1>${description ? `<p class="page-description">${description}</p>` : ''}</div>${action}</div>`;
}

function shell(content, route) {
  const selected = route === 'leccion' ? 'ruta' : route === 'practica' ? 'practicas' : route === 'apunte' ? 'biblioteca' : route;
  const pct = percent(progress.lessons.length, lessons.length);
  return `<aside class="sidebar" id="sidebar" aria-label="Barra lateral">
    <a href="#inicio" class="brand"><span class="brand-mark">${icon('network')}</span><span>Braulio<span class="brand-sub">NETWORK LAB</span></span><span class="brand-dot"></span></a>
    <div class="sidebar-label">TU ESPACIO DE ESTUDIO</div>
    <nav aria-label="Navegación principal">${nav.map(([id, label, name]) => `<a href="#${id}" class="nav-link ${selected === id ? 'active' : ''}" ${selected === id ? 'aria-current="page"' : ''}>${icon(name)}<span>${label}</span>${id === 'practicas' ? '<span class="nav-count">8</span>' : ''}</a>`).join('')}</nav>
    <a href="#simulador" class="simulator-nav ${selected === 'simulador' ? 'active' : ''}">${icon('terminal')}<span>Simulador Cisco<small>Escribe. Prueba. Aprende.</small></span>${icon('external')}</a>
    <div class="sidebar-bottom"><div class="sidebar-progress"><div><span>Tu avance</span><strong>${pct}%</strong></div><div class="progress-track"><span style="width:${pct}%"></span></div><small>${progress.lessons.length} de ${lessons.length} temas completados</small></div><div class="made-for"><span class="avatar">B</span><div>Hecho para ti, Braulio<small>De tus apuntes al siguiente nivel.</small></div></div></div>
  </aside>
  <div class="workspace"><header class="topbar"><div class="breadcrumbs"><button class="icon-button mobile-menu" data-action="menu" aria-label="Abrir navegación" aria-expanded="false" aria-controls="sidebar">${icon('menu')}</button><span>Conmutación</span>${icon('chevron')}<strong>${nav.find(n => n[0] === selected)?.[1] || (selected === 'simulador' ? 'Simulador Cisco' : 'Buscar')}</strong></div><form class="global-search" id="global-search" role="search"><label for="global-query" class="sr-only">Buscar en el laboratorio</label>${icon('search')}<input id="global-query" name="q" placeholder="Busca un tema, comando…" autocomplete="off"><kbd>Ctrl K</kbd></form><span class="term-badge"><i></i> EDICIÓN VERANO</span></header>
    <main id="main" tabindex="-1">${content}</main>
    <footer><span>Braulio · Network Lab <span class="footer-separator">/</span> Hecho entre compas, para entender de verdad.</span><a href="#biblioteca">Contenido y fuentes ${icon('arrow')}</a></footer>
  </div>`;
}

function trackCard(track, index) {
  const completed = track.lessons.filter(id => progress.lessons.includes(id)).length;
  return `<a class="track-card ${track.color}" href="${href('leccion', track.lessons.find(id => !progress.lessons.includes(id)) || track.lessons[0])}"><div class="track-top"><span class="tile-icon">${icon(track.icon)}</span><span class="track-number">0${index + 1}</span></div><h3>${track.title}</h3><p>${track.subtitle}</p><div class="track-meta"><span>${track.lessons.length} temas</span><span>${completed}/${track.lessons.length} ${icon('arrow')}</span></div><div class="progress-track"><span style="width:${percent(completed, track.lessons.length)}%"></span></div></a>`;
}

function home() {
  const next = nextLesson();
  return `${heading('APRENDE A TU RITMO', 'Qué onda, Braulio <span class="greeting">✦</span>', 'Las redes se entienden mejor cuando las pones a funcionar.')}
    <section class="hero panel"><div class="hero-copy"><span class="hero-label"><span></span> TU LABORATORIO DE CONMUTACIÓN</span><h2>Menos memorizar.<br>Más <em>conectar ideas.</em></h2><p>Todo lo de tu clase, en un solo lugar.<br>Entiende la teoría, arma la red y comprueba que funciona.</p><div class="hero-actions">${buttonLink(href('leccion', next.id), progress.lessons.length ? 'Continuar aprendiendo' : 'Empezar mi ruta', true)}<a href="#simulador" class="text-link">${icon('terminal')} Ir al simulador</a></div><div class="hero-footnote">${icon('check')} Sin cuentas <span>·</span> Tu progreso se guarda en este navegador</div></div><div class="hero-visual">${networkSVG()}<span class="diagram-caption">UNA RED. MUCHAS CONEXIONES.</span></div></section>
    <section class="stats-grid" aria-label="Resumen de estudio">${[
      ['book', `${progress.lessons.length}<small> / 12</small>`, 'Temas completados', 'mint'],
      ['layers', `${doneLabs()}<small> / 8</small>`, 'Prácticas completadas', 'blue'],
      ['trophy', `${progress.bestQuiz}<small>%</small>`, 'Mejor repaso', 'purple'],
      ['terminal', `${commands.length}`, 'Comandos a la mano', 'amber'],
    ].map(([name, value, label, color]) => `<div class="stat panel"><span class="tile-icon ${color}">${icon(name)}</span><div><strong>${value}</strong><span>${label}</span></div></div>`).join('')}</section>
    <div class="section-title"><div><h2>Tu siguiente conexión</h2><p>Un paso pequeño. Una idea que ya no se te olvida.</p></div><a class="text-link" href="#ruta">Ver toda la ruta ${icon('arrow')}</a></div>
    <div class="next-grid"><a class="next-card panel" href="${href('leccion', next.id)}"><div class="next-card-top">${badge('SIGUE POR AQUÍ', 'mint')}<span class="muted">${icon('clock')} ${next.minutes} min</span></div><div class="next-card-body"><span class="large-icon">${icon(next.icon)}</span><div><span class="eyebrow">${next.label}</span><h3>${next.title}</h3><p>${next.intro}</p></div></div><div class="next-card-footer"><span>Leer → entender → practicar</span><span class="round-arrow">${icon('arrow')}</span></div></a><section class="quick-card panel"><div class="quick-eyebrow">${icon('spark')} LA IDEA QUE TE LLEVAS HOY</div><h3>¿Access o trunk?</h3><p>Access: un carril para una VLAN de datos.<br>Trunk: varias VLAN por el mismo enlace.</p><div class="mini-tags"><span>PC ↔ Switch <b>ACCESS</b></span><span>Switch ↔ Switch <b>TRUNK*</b></span></div><small>*Cuando transportas varias VLAN.</small><a class="text-link" href="#mapa">Míralo en la red ${icon('arrow')}</a></section></div>
    <div class="section-title"><div><h2>De cero a “ya le entendí”</h2><p>Cuatro etapas. Tú eliges por dónde seguir.</p></div>${badge('12 TEMAS', 'subtle')}</div>
    <section class="tracks-grid">${tracks.map(trackCard).join('')}</section>
    <section class="bottom-callout"><span class="tile-icon mint">${icon('terminal')}</span><div><h3>Tu siguiente comando puede ser el bueno.</h3><p>Prueba el simulador 2960: modo guiado, examen o laboratorio libre.</p></div>${buttonLink('#simulador', 'Abrir laboratorio', false)}</section>`;
}

function learningPath() {
  return `${heading('TU RUTA DE APRENDIZAJE', 'Conecta una idea a la vez.', 'Empieza por las bases o salta al tema que te está dando guerra.')}
    <div class="route-summary panel"><span class="tile-icon mint">${icon('compass')}</span><div><h3>Entender → practicar → comprobar</h3><p>Marca un tema cuando puedas explicarlo con tus propias palabras. Tu avance es personal, no una calificación.</p></div><strong>${progress.lessons.length}<small>/12</small></strong></div>
    ${tracks.map((track, index) => `<section class="learning-stage"><div class="stage-heading"><span class="stage-number ${track.color}">0${index + 1}</span><div><h2>${track.title}</h2><p>${track.subtitle}</p></div></div><div class="lesson-grid">${track.lessons.map(id => {
      const l = findLesson(id), done = progress.lessons.includes(id);
      return `<a class="lesson-card panel" href="${href('leccion', id)}"><span class="tile-icon ${track.color}">${icon(done ? 'check' : l.icon)}</span><div><div class="lesson-label">${l.label}${progress.saved.includes(id) ? icon('bookmark') : ''}</div><h3>${l.title}</h3><p>${l.intro}</p><span class="lesson-meta">${icon('clock')} ${l.minutes} min <span>·</span> ${done ? 'Completado' : 'Por descubrir'}</span></div>${icon('chevron')}</a>`;
    }).join('')}</div></section>`).join('')}`;
}

function lessonPage(id) {
  const lesson = findLesson(id);
  if (!lesson) return notFound();
  progress.lastLesson = id;
  persist();
  const index = lessons.indexOf(lesson), done = progress.lessons.includes(id);
  const related = practices.filter(p => p.topic === id || (id === 'vlans' && p.id === 'campus'));
  return `<a href="#ruta" class="back-link">← Volver a la ruta</a>${heading(`TEMA ${String(index + 1).padStart(2, '0')} / 12 · ${lesson.minutes} MIN`, lesson.title, lesson.intro, `<button class="btn secondary" data-action="save-lesson" data-id="${id}" aria-pressed="${progress.saved.includes(id)}">${icon('bookmark')}${progress.saved.includes(id) ? 'Guardado' : 'Guardar tema'}</button>`)}
    <div class="reading-layout"><article class="lesson-article"><div class="takeaway"><span class="tile-icon mint">${icon('spark')}</span><div><span class="eyebrow">SI TE QUEDAS CON UNA IDEA</span><p>${esc(lesson.takeaway)}</p></div></div>
    ${lesson.sections.map(([title, body], n) => `<section class="article-section" id="section-${n}"><span class="section-index">0${n + 1}</span><h2>${title}</h2><div class="prose">${markdown(body)}</div></section>`).join('')}
    ${id === 'dhcp' ? doraWidget() : ''}
    <aside class="correction"><div>${icon('info')} <strong>Ojo con esta confusión</strong></div><p>${esc(lesson.correction)}</p></aside>
    <div class="lesson-complete panel"><div><h3>¿Ya podrías explicárselo a un compa?</h3><p>Es una buena señal de que lo entendiste.</p></div><button class="btn ${done ? 'secondary' : 'primary'}" data-action="complete-lesson" data-id="${id}" aria-pressed="${done}">${icon('check')}${done ? 'Completado · desmarcar' : 'Marcar como entendido'}</button></div>
    <div class="lesson-pagination">${index > 0 ? buttonLink(href('leccion', lessons[index - 1].id), '← Tema anterior') : '<span></span>'}${index < lessons.length - 1 ? buttonLink(href('leccion', lessons[index + 1].id), 'Siguiente tema', true) : buttonLink('#repaso', 'Ponerte a prueba', true)}</div></article>
    <aside class="reading-aside"><div class="panel toc"><span class="eyebrow">EN ESTE TEMA</span>${lesson.sections.map(([title], n) => `<button data-action="scroll-section" data-section="section-${n}"><span>0${n + 1}</span>${title}</button>`).join('')}</div><div class="panel aside-card"><span class="tile-icon blue">${icon('layers')}</span><h3>Llévalo a la práctica</h3>${related.length ? related.map(p => `<a href="${href('practica', p.id)}">${p.title} ${icon('arrow')}</a>`).join('') : '<a href="#repaso">Repasa lo aprendido →</a>'}<a href="${href('comandos', id)}">Comandos de este tema ${icon('arrow')}</a></div><div class="panel aside-card source-links"><span class="eyebrow">DE TUS APUNTES</span>${lesson.sources.map(path => `<a href="${href('apunte', path)}">${icon('book')}${esc(path.split('/').pop().replace('.md', ''))}</a>`).join('')}</div></aside></div>`;
}

function doraWidget() {
  return `<section class="panel dora-widget"><p class="eyebrow">HAZ CLIC EN CADA PASO</p><h3>DORA, de ida y vuelta</h3><div class="dora-steps">${['Discover', 'Offer', 'Request', 'ACK'].map((name, n) => `<button data-action="dora" data-step="${n}" aria-pressed="${n === 0}" class="${n === 0 ? 'active' : ''}"><strong>${name[0]}</strong>${name}</button>`).join('')}</div><p id="dora-detail" aria-live="polite">PC → difusión: «¿Hay un servidor DHCP disponible?»</p></section>`;
}

function practiceList() {
  const filtered = practices.filter(p => practiceFilter === 'all' || (practiceFilter === 'campus' ? ['campus', 'dhcp-campus', 'port-security'].includes(p.id) : ['rutas-estaticas', 'rip-cuatro', 'ospf-cuatro'].includes(p.id)));
  return `${heading('MANOS A LA RED', 'Aquí la teoría se vuelve práctica.', 'Guías con objetivos, comandos, verificaciones y los errores que sí pasaron en clase.', buttonLink('#simulador', 'Consola Cisco', false, 'terminal'))}
    <div class="filter-bar" aria-label="Filtrar prácticas">${[['all', 'Todas las prácticas'], ['campus', 'Campus de verano'], ['routing', 'Enrutamiento']].map(([id, label]) => `<button data-action="practice-filter" data-filter="${id}" class="chip ${practiceFilter === id ? 'selected' : ''}" aria-pressed="${practiceFilter === id}">${label}</button>`).join('')}</div>
    <div class="practice-grid">${filtered.map(p => `<a class="practice-card panel" href="${href('practica', p.id)}"><div class="practice-card-top"><span class="tile-icon ${p.topic === 'seguridad' ? 'amber' : 'blue'}">${icon(p.icon)}</span><span class="practice-number">LAB ${p.number}</span></div>${badge(p.level, 'subtle')}<h2>${p.title}</h2><p>${p.goal}</p><div class="practice-meta"><span>${icon('clock')} ${p.minutes} min</span><span>${doneSteps(p)}/${p.steps.length} pasos</span></div><div class="progress-track"><span style="width:${percent(doneSteps(p), p.steps.length)}%"></span></div><div class="practice-cta">${doneSteps(p) === p.steps.length ? 'Volver a practicar' : 'Entrar a la práctica'} ${icon('arrow')}</div></a>`).join('')}</div>`;
}

function practicePage(id) {
  const p = practices.find(item => item.id === id);
  if (!p) return notFound();
  const checked = progress.steps[id] || [];
  return `<a href="#practicas" class="back-link">← Todas las prácticas</a>${heading(`LAB ${p.number} · ${p.level.toUpperCase()} · ${p.minutes} MIN`, p.title, p.goal)}
    <div class="lab-intro panel"><span class="tile-icon blue">${icon('layers')}</span><div><h3>Qué necesitas</h3><p>${p.needs}</p></div><a class="text-link" href="${href('leccion', p.topic)}">Repasar teoría ${icon('arrow')}</a></div>
    <div class="lab-progress"><span id="lab-progress-text">${checked.length} de ${p.steps.length} pasos completados</span><span>Marca cada paso después de comprobarlo.</span><div class="progress-track"><span id="lab-progress-bar" style="width:${percent(checked.length, p.steps.length)}%"></span></div></div>
    ${p.table ? `<details class="panel address-table" open><summary>Topología y direccionamiento</summary><div class="prose">${markdown(p.table)}</div></details>` : ''}
    <div class="lab-steps">${p.steps.map(([title, description, code, expected], i) => `<section class="lab-step panel ${checked.includes(i) ? 'is-complete' : ''}" id="step-${i}"><div class="step-header"><span class="step-number">${String(i + 1).padStart(2, '0')}</span><h2>${title}</h2><label class="step-check"><input type="checkbox" data-practice="${id}" data-index="${i}" ${checked.includes(i) ? 'checked' : ''}><span>Completado</span></label></div><div class="step-body"><p>${description}</p>${code ? codeBlock(code) : ''}<div class="expected">${icon('check')}<div><strong>Así sabes que funcionó</strong><p>${expected}</p></div></div></div></section>`).join('')}</div>
    ${p.configs ? `<section class="panel config-section"><div class="section-title"><div><p class="eyebrow">CONFIGURACIÓN DE REFERENCIA</p><h2>Elige el equipo, revisa y practica.</h2><p>Comandos completos por equipo. Adapta interfaces a tu cableado; el reloj DCE se configura por separado.</p></div></div><label class="field-label" for="config-device">Equipo</label><select id="config-device" data-practice-id="${id}">${Object.keys(p.configs).map(key => `<option>${esc(key)}</option>`).join('')}</select><div id="device-config">${codeBlock(Object.values(p.configs)[0])}</div><button class="btn secondary" data-action="download-config" data-id="${id}">${icon('download')} Descargar configuración .txt</button></section>` : ''}
    <aside class="correction"><div>${icon('info')}<strong>Si algo no sale…</strong></div><p>${p.troubleshooting}</p></aside><div class="bottom-callout"><span class="tile-icon purple">${icon('zap')}</span><div><h3>Antes de cerrar, comprueba que lo entendiste.</h3><p>Las casillas registran tu autoevaluación; la web no inspecciona Packet Tracer.</p></div>${buttonLink('#repaso', 'Repasar', true)}</div>`;
}

function mapPage() {
  const journey = mapState.journey;
  return `${heading('VE LO QUE ESTÁ PASANDO', 'Tu red, de un vistazo.', 'Explora cómo viaja un paquete y construye la configuración de una rama del campus.')}
    <section class="packet-lab panel"><div class="section-title"><div><p class="eyebrow">EXPLORADOR DE PAQUETES</p><h2>¿Hasta dónde llega el mensaje?</h2></div>${badge('MODELO DIDÁCTICO', 'mint')}</div><div class="packet-grid"><div id="packet-diagram">${networkSVG('map', journey?.path)}</div><div class="packet-controls"><label class="field-label" for="packet-destination">Desde la PC de Braulio hacia…</label><select id="packet-destination"><option value="same" ${mapState.destination === 'same' ? 'selected' : ''}>PC vecina · misma VLAN 101</option><option value="other" ${mapState.destination === 'other' ? 'selected' : ''}>PC remota · VLAN 102</option></select><label class="toggle-row"><input type="checkbox" id="packet-routing" ${mapState.routing ? 'checked' : ''}><span>CORE con enrutamiento inter-VLAN<small>SVIs + ip routing + gateways correctos</small></span></label><button class="btn primary" data-action="send-packet">${icon('zap')} Enviar paquete</button><div id="packet-result" aria-live="polite">${journey ? journeyMarkup(journey) : '<div class="packet-hint">Elige el destino y envía el paquete. ¿Necesitará salir de su VLAN?</div>'}</div><p class="small muted">Esquema lógico simplificado: se omiten los switches de distribución. Supone IPs, enlaces, ARP y permisos correctos; no ejecuta tráfico real.</p></div></div></section>
    <section class="panel generator"><div class="section-title"><div><p class="eyebrow">TU PRÁCTICA DE VERANO</p><h2>Una rama, los comandos correctos.</h2><p>VLAN 101–110 · Administración VLAN 100 · Red 10.168.0.0/24</p></div>${icon('terminal')}</div><div class="generator-controls"><label>Departamento<select id="campus-department">${departments.map(d => `<option value="${d.vlan}" ${mapState.department === d.vlan ? 'selected' : ''}>${d.name} · VLAN ${d.vlan}</option>`).join('')}</select></label><label>Equipo / función<select id="campus-role">${[['access', 'Switch de enlace'], ['distribution', 'Switch de distribución'], ['core', 'CORE multicapa · una rama'], ['dhcp', 'DHCP en el CORE']].map(([id, text]) => `<option value="${id}" ${mapState.role === id ? 'selected' : ''}>${text}</option>`).join('')}</select></label></div><div id="campus-facts">${campusFacts()}</div><div id="campus-code">${codeBlock(campusConfig(mapState.department, mapState.role))}</div><div class="generator-footer"><p>Gi0/1 = uplink; Gi0/2 = downlink de distribución. CORE: usa un puerto distinto por rama al ampliar; selecciona 802.1Q antes del trunk si tu modelo lo exige. DHCP requiere la SVI de usuario ya operativa.</p><button class="btn secondary" data-action="download-campus">${icon('download')} Descargar .txt</button></div></section>
    <section class="panel subnet-section"><div><p class="eyebrow">HERRAMIENTA DE BOLSILLO</p><h2>Que las subredes te hagan clic.</h2><p>Calcula red, hosts, broadcast y wildcard. Prueba una /30 de tus enlaces seriales.</p></div><form id="subnet-form"><label class="field-label" for="subnet-input">Dirección IPv4 / prefijo</label><div class="input-button"><input id="subnet-input" name="cidr" value="192.168.1.6/30" placeholder="192.168.1.6/30" required spellcheck="false"><button class="btn primary" type="submit">Calcular ${icon('calculator')}</button></div></form><div id="subnet-result" aria-live="polite">${subnetMarkup(calculateSubnet('192.168.1.6/30'))}</div></section>`;
}

function journeyMarkup(journey) {
  return `<div class="journey-result ${journey.success ? 'success' : 'blocked'}"><strong>${journey.success ? '✓' : '↳'} ${journey.title}</strong><p>${journey.text}</p></div>`;
}

function campusFacts() {
  const d = departments.find(d => d.vlan === mapState.department);
  return `<div class="network-facts"><div><span>Subred de usuarios</span><strong>10.168.${d.vlan}.0/24</strong></div><div><span>Gateway de usuarios</span><strong>10.168.${d.vlan}.1</strong></div><div><span>IP gestión · distribución</span><strong>${d.distribution}</strong></div><div><span>IP gestión · enlace</span><strong>${d.access}</strong></div></div>`;
}

function subnetMarkup(result) {
  return `<div class="subnet-results">${[['Red', `${result.network}/${result.prefix}`], ['Máscara', result.mask], ['Wildcard', result.wildcard], ['Broadcast', result.broadcast], ['Primer host', result.first], ['Último host', result.last]].map(([label, value]) => `<div><span>${label}</span><strong>${value}</strong></div>`).join('')}</div><p class="subnet-note"><strong>${result.hosts.toLocaleString('es-MX')} ${result.prefix === 32 ? 'dirección' : 'hosts'}</strong> · ${result.note}</p>`;
}

function commandRows(query = '', topic = 'all') {
  const results = commands.filter(c => (topic === 'all' || c.topic === topic) && norm(`${c.command} ${c.mode} ${c.description} ${c.topic}`).includes(norm(query)));
  return `<p class="result-count" role="status">${results.length} comandos encontrados</p>${results.length ? `<div class="command-list">${results.map(c => `<article class="command-row panel"><div><code>${esc(c.command)}</code><p>${esc(c.description)}</p></div><div class="command-row-actions"><span class="mode-badge">${esc(c.mode)}</span><a href="${href('leccion', c.topic)}" class="icon-button" aria-label="Ver explicación de ${esc(c.command)}">${icon('book')}</a><button class="icon-button" data-action="copy-command" aria-label="Copiar ${esc(c.command)}">${icon('copy')}</button></div></article>`).join('')}</div>` : emptyState('No encontré ese comando.', 'Prueba con “vlan”, “gateway”, “show” o cambia el filtro.')}`;
}

function commandsPage(topic) {
  const selected = findLesson(topic) ? topic : 'all';
  return `${heading('TU CHULETA, BIEN EXPLICADA', 'El comando. El modo. El porqué.', 'Consulta rápido, copia sin el prompt y entiende dónde va cada instrucción.')}
    <div class="command-filters panel"><label class="search-field">${icon('search')}<input id="command-query" aria-label="Buscar comandos" placeholder="Ej. show, trunk, gateway…"></label><label class="sr-only" for="command-topic">Filtrar por tema</label><select id="command-topic"><option value="all">Todos los temas</option>${lessons.map(l => `<option value="${l.id}" ${selected === l.id ? 'selected' : ''}>${l.label}</option>`).join('')}</select></div><div id="command-results">${commandRows('', selected)}</div><aside class="correction"><div>${icon('info')}<strong>La ubicación importa tanto como el comando.</strong></div><p>Los ejemplos pertenecen a escenarios concretos. Revisa IP, VLAN y puerto antes de copiarlos. Para una configuración completa, abre su práctica.</p></aside>`;
}

function flashCard() {
  const lesson = lessons[flashIndex];
  return `<div class="flashcard-inner"><span class="eyebrow">TARJETA ${flashIndex + 1} / ${lessons.length} · ${lesson.label.toUpperCase()}</span><button class="flashcard" data-action="flip-card" aria-label="${flashFlipped ? 'Volver a la pregunta' : 'Mostrar respuesta'}"><span class="tile-icon purple">${icon(flashFlipped ? 'spark' : lesson.icon)}</span><h3>${flashFlipped ? esc(lesson.takeaway) : `¿Qué recuerdas de ${lesson.label.toLowerCase()}?`}</h3><span>${flashFlipped ? 'Haz clic para volver a pensar' : 'Piensa tu respuesta y toca para descubrirla'} ${icon('refresh')}</span></button><div class="flashcard-controls"><button class="btn secondary" data-action="previous-card" aria-label="Tarjeta anterior">← Anterior</button><a class="text-link" href="${href('leccion', lesson.id)}">Repasar tema</a><button class="btn secondary" data-action="next-card" aria-label="Tarjeta siguiente">Siguiente →</button></div></div>`;
}

function reviewPage() {
  return `${heading('EQUIVOCARSE TAMBIÉN ES APRENDER', '¿Ya te hizo clic?', 'Repasa con tarjetas o responde un reto. Cada respuesta viene con su explicación.')}
    <div class="review-grid"><section class="panel quiz-intro"><span class="tile-icon mint">${icon('zap')}</span><p class="eyebrow">UN RETO CORTO, UNA IDEA MÁS CLARA</p><h2>Ponte a prueba</h2><p>6 preguntas en el repaso general o 2 de un tema. Sin cronómetro: aquí importa entender.</p><label class="field-label" for="quiz-topic">¿Qué quieres practicar?</label><select id="quiz-topic"><option value="all">Un poco de todo</option>${lessons.map(l => `<option value="${l.id}">${l.label}</option>`).join('')}</select><button class="btn primary" data-action="start-quiz">Empezar reto ${icon('arrow')}</button><div class="quiz-stats"><span>Mejor resultado <b>${progress.bestQuiz}%</b></span><span>Repasos terminados <b>${progress.quizzes}</b></span></div></section><section class="panel flashcard-panel" id="flashcard-panel">${flashCard()}</section></div><section id="quiz-area" class="quiz-area" aria-live="polite">${quiz ? quizMarkup() : ''}</section>`;
}

function quizMarkup() {
  if (!quiz) return '';
  if (quiz.index >= quiz.items.length) {
    const score = percent(quiz.correct, quiz.items.length);
    return `<div class="quiz-result panel"><span class="tile-icon ${score >= 70 ? 'mint' : 'amber'}">${icon('trophy')}</span><p class="eyebrow">RETO COMPLETADO</p><h2>${score >= 70 ? '¡Ya estás conectando ideas!' : 'Ya sabes qué toca reforzar.'}</h2><div class="quiz-score">${score}<small>%</small></div><p>${quiz.correct} de ${quiz.items.length} respuestas correctas. ${score === 100 ? 'Ahora llévalo a la consola.' : 'Vuelve a los temas de tus respuestas incorrectas y prueba otra vez.'}</p>${quiz.missed.length ? `<div class="review-topics">${[...new Set(quiz.missed)].map(id => `<a class="chip" href="${href('leccion', id)}">${findLesson(id).label} ${icon('arrow')}</a>`).join('')}</div>` : ''}<button class="btn primary" data-action="start-quiz">Otro reto ${icon('refresh')}</button></div>`;
  }
  const q = quiz.items[quiz.index];
  return `<div class="quiz-question panel"><div class="quiz-question-heading">${badge(findLesson(q.topic).label, 'blue')}<span>Pregunta ${quiz.index + 1} de ${quiz.items.length}</span></div><div class="progress-track"><span style="width:${percent(quiz.index, quiz.items.length)}%"></span></div><h2>${q.prompt}</h2><div class="answer-options">${q.options.map((option, i) => `<button data-action="answer" data-answer="${i}" class="answer-option ${quiz.answered !== null ? i === q.answer ? 'correct' : i === quiz.answered ? 'incorrect' : '' : ''}" ${quiz.answered !== null ? 'disabled' : ''}><span>${'ABCD'[i]}</span>${option}${quiz.answered !== null && i === q.answer ? icon('check') : ''}</button>`).join('')}</div>${quiz.answered !== null ? `<div class="answer-feedback ${quiz.answered === q.answer ? 'success' : 'blocked'}"><strong>${quiz.answered === q.answer ? '¡Exacto!' : 'Casi. Vamos a aclararlo.'}</strong><p>${q.explanation}</p><button class="btn primary" data-action="next-question">${quiz.index === quiz.items.length - 1 ? 'Ver mi resultado' : 'Siguiente pregunta'} ${icon('arrow')}</button></div>` : '<p class="small muted">Elige una respuesta. Te contamos el porqué, aciertes o no.</p>'}</div>`;
}

async function loadNotes() {
  if (notes) return notes;
  if (!notesPromise) notesPromise = fetch(`${import.meta.env.BASE_URL}apuntes/originales.json`).then(response => {
    if (!response.ok) throw new Error('No se pudo cargar el archivo de apuntes.');
    return response.json();
  }).then(data => { notes = data.notes; return notes; }).catch(error => { notesPromise = null; throw error; });
  return notesPromise;
}

function originalRows(query = '') {
  if (!notes) return '<p class="muted">Cargando tus apuntes…</p>';
  const visible = notes.filter(n => norm(n.title + ' ' + n.path + ' ' + n.content).includes(norm(query)));
  return `<p class="result-count" role="status">${visible.length} de ${notes.length} archivos · 41 con contenido, 2 vacíos</p><div class="original-list">${visible.map(note => `<a class="original-row" href="${href('apunte', note.path)}">${icon('book')}<div><strong>${esc(note.title)}</strong><small>${esc(note.path)}</small></div>${note.content.trim() ? icon('chevron') : badge('Vacío', 'subtle')}</a>`).join('')}</div>`;
}

function libraryPage() {
  return `${heading('DE DÓNDE SALE TODO', 'Tus apuntes, con contexto.', 'Material de clase conservado, explicaciones revisadas y fuentes para ir más allá.')}
    <div class="library-intro panel"><div><span class="tile-icon mint">${icon('book')}</span><h2>43 archivos. Una ruta con sentido.</h2><p>Los 41 apuntes con contenido se reorganizaron en 12 temas y 8 prácticas. También se conservan los 2 archivos vacíos. Puedes abrir y descargar cada original.</p></div><div class="library-note"><strong>Original ≠ explicación revisada</strong><p>Los originales conservan erratas, duplicados y dudas de clase. Para estudiar, usa primero la ruta. Las imágenes mencionadas y archivos .pkt no venían en la carpeta proporcionada; los diagramas de la web son reconstrucciones.</p></div></div>
    <div class="section-title"><div><h2>Correcciones que sí importan</h2><p>Para que un apunte rápido no se convierta en una idea equivocada.</p></div></div><div class="corrections-grid">${lessons.map(l => `<a class="correction-card panel" href="${href('leccion', l.id)}"><span>${icon('check')}${l.label}</span><p>${esc(l.correction)}</p></a>`).join('')}</div>
    <div class="section-title"><div><h2>Archivo original de clase</h2><p>Busca por nombre o por cualquier palabra dentro de los apuntes.</p></div></div><label class="search-field panel archive-search">${icon('search')}<input id="notes-query" aria-label="Buscar en los apuntes originales" placeholder="Buscar entre tus 43 apuntes…"></label><div id="notes-results">${originalRows()}</div>
    <div class="section-title"><div><h2>Fuentes y material complementario</h2></div></div><div class="reference-grid">${references.map(([title, description, url]) => `<a class="reference-card panel" href="${url}" target="_blank" rel="noopener noreferrer"><div><strong>${title}</strong><p>${description}</p></div>${icon('external')}</a>`).join('')}</div>
    <section class="panel provenance"><h3>El simulador que ya conoces, integrado</h3><p>Incluye una copia del repositorio <a href="https://github.com/Angixs-zz/Cisco" target="_blank" rel="noopener noreferrer">Angixs-zz/Cisco</a>, revisión <code>7107dfd</code>. Su práctica de examen tiene VLAN y direccionamiento propios. Se añadió navegación de regreso y se aisló su caché.</p><p>EIGRP se amplió como complemento didáctico. Los ejemplos del campus explicitan el equipo multicapa necesario, las SVIs y el enrutamiento que faltaban en algunas notas. Referencias normativas enlazadas para contrastar conceptos; la sintaxis concreta depende del IOS.</p><a class="text-link" href="https://github.com/Angixs-zz/AyudaBraulio" target="_blank" rel="noopener noreferrer">Ver este proyecto en GitHub ${icon('external')}</a></section>`;
}

function originalPage(path) {
  if (!notes) return `${heading('ARCHIVO DE CLASE', 'Cargando apunte…')}<div id="note-loading" role="status">Un momento.</div>`;
  const note = notes.find(n => n.path === path);
  if (!note) return notFound();
  const normalized = note.content.replace(/!\[\[([^\]]+)\]\]/g, (_, name) => `\n\n> Imagen mencionada: ${esc(name)} — archivo no incluido en el material recibido.\n\n`).replace(/\[\[([^\]]+)\]\]/g, (_, raw) => {
    const [name, label] = raw.split('|');
    const target = notes.find(n => n.title === name || n.path === `${name}.md`);
    return target ? `[${label || name}](${href('apunte', target.path)})` : `${label || name} (referencia no incluida)`;
  });
  return `<a href="#biblioteca" class="back-link">← Apuntes y fuentes</a>${heading('APUNTE ORIGINAL · SIN CORREGIR', esc(note.title), esc(note.path), `<button class="btn secondary" data-action="download-note">${icon('download')} Descargar .md</button>`)}<aside class="correction"><div>${icon('info')}<strong>Estás viendo el material tal como se recibió.</strong></div><p>Puede contener erratas técnicas o instrucciones incompletas. Consulta las explicaciones revisadas en la ruta antes de aplicar comandos.</p></aside><article class="panel original-content prose">${note.content.trim() ? markdown(normalized) : '<p>Este archivo estaba vacío en el material original.</p>'}</article><details class="source-raw panel"><summary>Ver Markdown original sin transformar</summary><pre>${esc(note.content)}</pre></details>`;
}

function simulatorPage() {
  return `${heading('DEL APUNTE A LA CONSOLA', 'Tu switch virtual te espera.', 'Practica comandos de IOS con retroalimentación inmediata, sin instalar nada.')}
    <section class="simulator-hero panel"><div><span class="tile-icon mint">${icon('terminal')}</span><p class="eyebrow">CISCO CATALYST 2960 · SIMULADOR EDUCATIVO</p><h2>Aprende haciendo.<br>Y deshaciendo también.</h2><p>Configura VLANs, puertos access, trunks e IP de administración. Pide una pista, evalúa tu configuración o practica el borrado para empezar de nuevo.</p><a class="btn primary" href="./simulador/index.html">Entrar al simulador ${icon('arrow')}</a><p class="small muted">Se abre en esta misma pestaña. Puedes volver al dashboard desde la cabecera.</p></div><div class="terminal-preview"><div class="terminal-title"><span class="window-dots">● ● ●</span> CONSOLA · VISTA PREVIA</div><div><span>Switch&gt;</span> enable<br><span>Switch#</span> configure terminal<br><span>Switch(config)#</span> vlan 116<br><span>Switch(config-vlan)#</span> name INDUSTRIAL<br><span>Switch(config-vlan)#</span> exit<br><span>Switch(config)#</span> <i class="cursor"></i></div><p>Tu siguiente conexión empieza aquí.</p></div></section>
    <div class="three-grid">${[['compass', 'Modo guiado', 'Objetivos, checklist y pistas para no perderte entre modos.'], ['trophy', 'Modo examen', 'Configura por tu cuenta y evalúa qué objetivos cumpliste.'], ['terminal', 'Laboratorio libre', 'Experimenta, inspecciona running-config y repite lo que necesites.']].map(([name, title, body]) => `<section class="panel mode-card"><span class="tile-icon blue">${icon(name)}</span><h3>${title}</h3><p>${body}</p></section>`).join('')}</div>
    <aside class="correction"><div>${icon('info')}<strong>Dos prácticas distintas, la misma lógica.</strong></div><p>El simulador usa VLAN 110–118 para departamentos, 119 CCTV, 120 VOIP, 121 inalámbrica y VLAN 1 de administración (200.1.2.0/24). La práctica de verano usa VLAN 101–110 y administración 100. Sigue la tabla del escenario abierto. El simulador cubre switching; para routing, DHCP y Port Security usa las guías con Packet Tracer. No emula todo IOS.</p></aside>`;
}

function searchPage(query) {
  const q = norm(query).trim();
  if (!q) return `${heading('BUSCADOR GLOBAL', '¿Qué quieres entender hoy?')}<p>Escribe un tema o comando en el buscador de arriba.</p>`;
  const foundLessons = lessons.filter(l => norm(`${l.title} ${l.label} ${l.intro} ${l.takeaway} ${l.sections.flat().join(' ')}`).includes(q));
  const foundPractices = practices.filter(p => norm(`${p.title} ${p.goal} ${p.topic} ${p.steps.flat().join(' ')}`).includes(q));
  return `${heading('BUSCADOR GLOBAL', `Resultados para “${esc(query)}”`, 'Busca también dentro de los originales desde Apuntes y fuentes.')}<h2 class="search-heading">Temas (${foundLessons.length})</h2><div class="search-results">${foundLessons.map(l => `<a href="${href('leccion', l.id)}" class="panel search-result">${icon(l.icon)}<div><h3>${l.title}</h3><p>${l.takeaway}</p></div>${icon('arrow')}</a>`).join('') || emptyState('No hay temas con esa búsqueda.', 'Prueba otra palabra.')}</div><h2 class="search-heading">Prácticas (${foundPractices.length})</h2><div class="search-results">${foundPractices.map(p => `<a href="${href('practica', p.id)}" class="panel search-result">${icon('layers')}<div><h3>${p.title}</h3><p>${p.goal}</p></div>${icon('arrow')}</a>`).join('')}</div><h2 class="search-heading">Comandos</h2>${commandRows(query)}`;
}

function emptyState(title, text) { return `<div class="empty-state panel">${icon('search')}<h3>${title}</h3><p>${text}</p></div>`; }
function notFound() { return `${heading('ESTE CAMINO NO EXISTE', 'Vamos a reconectar.')}<p>El tema o enlace no se encontró en este laboratorio.</p>${buttonLink('#inicio', 'Volver al dashboard', true)}`; }

function render(focus = false) {
  const { route, id } = routeInfo();
  const pages = { inicio: home, ruta: learningPath, leccion: () => lessonPage(id), practicas: practiceList, practica: () => practicePage(id), mapa: mapPage, comandos: () => commandsPage(id), repaso: reviewPage, biblioteca: libraryPage, apunte: () => originalPage(id), simulador: simulatorPage, buscar: () => searchPage(id) };
  app.innerHTML = shell((pages[route] || notFound)(), route);
  document.title = `${document.querySelector('h1')?.textContent || 'Inicio'} · Braulio Network Lab`;
  if (focus) { window.scrollTo(0, 0); document.querySelector('#main').focus({ preventScroll: true }); }
  if (['biblioteca', 'apunte'].includes(route) && !notes) {
    loadNotes().then(() => {
      if (location.hash !== href(route, id) && !(route === 'biblioteca' && location.hash === '#biblioteca')) return;
      if (route === 'biblioteca') document.querySelector('#notes-results').innerHTML = originalRows(document.querySelector('#notes-query')?.value || '');
      else render();
    }).catch(() => {
      const container = document.querySelector(route === 'biblioteca' ? '#notes-results' : '#note-loading');
      if (container) container.innerHTML = '<p>No pudimos cargar los apuntes. Comprueba tu conexión y vuelve a intentarlo.</p><button class="btn secondary" data-action="retry-notes">Reintentar</button>';
    });
  }
}

async function copy(text) {
  try { await navigator.clipboard.writeText(text); toast('Comandos copiados. Revisa el equipo y el modo antes de pegarlos.'); }
  catch { toast('No se pudo acceder al portapapeles. Selecciona el comando y cópialo manualmente.'); }
}

function download(filename, text, mime = 'text/plain;charset=utf-8') {
  const url = URL.createObjectURL(new Blob([text], { type: mime }));
  const a = document.createElement('a'); a.href = url; a.download = filename; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  toast('Descarga preparada.');
}

function startQuiz() {
  const topic = document.querySelector('#quiz-topic').value;
  const pool = questions.filter(q => topic === 'all' || q.topic === topic);
  // Fisher–Yates avoids a biased sort comparator and never mutates the question bank.
  for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; }
  quiz = { items: pool.slice(0, 6), index: 0, correct: 0, answered: null, missed: [] };
  updateQuiz();
  document.querySelector('#quiz-area').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function updateQuiz() {
  document.querySelector('#quiz-area').innerHTML = quizMarkup();
  document.querySelector('.quiz-question h2, .quiz-result h2')?.setAttribute('tabindex', '-1');
  document.querySelector('.quiz-question h2, .quiz-result h2')?.focus({ preventScroll: true });
}

app.addEventListener('click', event => {
  const button = event.target.closest('[data-action]');
  if (!button) return;
  const { action, id } = button.dataset;
  if (action === 'menu') { const open = document.querySelector('#sidebar').classList.toggle('open'); button.setAttribute('aria-expanded', String(open)); }
  if (action === 'copy-code') copy(button.closest('.code-block').querySelector('code').textContent);
  if (action === 'copy-command') copy(button.closest('.command-row').querySelector('code').textContent);
  if (action === 'scroll-section') document.getElementById(button.dataset.section)?.scrollIntoView({ behavior: 'smooth' });
  if (action === 'retry-notes') render();
  if (action === 'save-lesson' || action === 'complete-lesson') {
    const key = action === 'save-lesson' ? 'saved' : 'lessons';
    if (progress[key].includes(id)) progress[key] = progress[key].filter(item => item !== id);
    else progress[key].push(id);
    persist();
    const y = window.scrollY; render(); window.scrollTo(0, y);
    document.querySelector(`[data-action="${action}"]`)?.focus({ preventScroll: true });
    toast(action === 'save-lesson' ? (progress.saved.includes(id) ? 'Tema guardado para volver a él.' : 'Tema retirado de guardados.') : (progress.lessons.includes(id) ? '¡Una idea más conectada! Avance guardado.' : 'Tema marcado para repasar.'));
  }
  if (action === 'practice-filter') { practiceFilter = button.dataset.filter; render(); document.querySelector(`[data-filter="${practiceFilter}"]`)?.focus(); }
  if (action === 'download-config') { const p = practices.find(p => p.id === id); const device = document.querySelector('#config-device').value; download(`${id}-${device}.txt`, p.configs[device]); }
  if (action === 'download-campus') download(`campus-vlan${mapState.department}-${mapState.role}.txt`, campusConfig(mapState.department, mapState.role));
  if (action === 'download-note') { const n = notes.find(n => n.path === routeInfo().id); if (n) download(n.path.split('/').pop(), n.content, 'text/markdown;charset=utf-8'); }
  if (action === 'send-packet') {
    mapState.destination = document.querySelector('#packet-destination').value;
    mapState.routing = document.querySelector('#packet-routing').checked;
    mapState.journey = packetJourney(mapState.destination, mapState.routing);
    document.querySelector('#packet-diagram').innerHTML = networkSVG('map', mapState.journey.path);
    document.querySelector('#packet-result').innerHTML = journeyMarkup(mapState.journey);
  }
  if (action === 'dora') {
    document.querySelectorAll('[data-action="dora"]').forEach(b => { const active = b === button; b.classList.toggle('active', active); b.setAttribute('aria-pressed', String(active)); });
    document.querySelector('#dora-detail').textContent = ['PC → difusión: «¿Hay un servidor DHCP disponible?»', 'Servidor → PC: «Te ofrezco una IP, máscara y arrendamiento.»', 'PC → servidores: «Solicito la oferta de este servidor.»', 'Servidor → PC: «Confirmado. Esta es tu concesión y sus parámetros.»'][Number(button.dataset.step)];
  }
  if (['flip-card', 'next-card', 'previous-card'].includes(action)) {
    if (action === 'flip-card') flashFlipped = !flashFlipped;
    else { flashIndex = (flashIndex + (action === 'next-card' ? 1 : -1) + lessons.length) % lessons.length; flashFlipped = false; }
    document.querySelector('#flashcard-panel').innerHTML = flashCard();
    document.querySelector(`[data-action="${action}"]`)?.focus({ preventScroll: true });
  }
  if (action === 'start-quiz') startQuiz();
  if (action === 'answer' && quiz && quiz.answered === null) {
    const answer = Number(button.dataset.answer), q = quiz.items[quiz.index];
    quiz.answered = answer;
    if (q.answer === answer) quiz.correct++; else quiz.missed.push(q.topic);
    updateQuiz();
    document.querySelector('[data-action="next-question"]')?.focus({ preventScroll: true });
  }
  if (action === 'next-question' && quiz && quiz.answered !== null && quiz.index < quiz.items.length) {
    quiz.index++; quiz.answered = null;
    if (quiz.index === quiz.items.length) { progress.bestQuiz = Math.max(progress.bestQuiz, percent(quiz.correct, quiz.items.length)); progress.quizzes++; persist(); }
    updateQuiz();
  }
});

app.addEventListener('change', event => {
  const input = event.target;
  if (input.dataset.practice) {
    const id = input.dataset.practice, index = Number(input.dataset.index);
    progress.steps[id] = input.checked ? [...new Set([...(progress.steps[id] || []), index])] : (progress.steps[id] || []).filter(i => i !== index);
    persist();
    input.closest('.lab-step').classList.toggle('is-complete', input.checked);
    const p = practices.find(p => p.id === id);
    document.querySelector('#lab-progress-text').textContent = `${doneSteps(p)} de ${p.steps.length} pasos completados`;
    document.querySelector('#lab-progress-bar').style.width = `${percent(doneSteps(p), p.steps.length)}%`;
    if (doneSteps(p) === p.steps.length) toast('¡Práctica completada! Buen trabajo, Braulio.');
  }
  if (input.id === 'config-device') document.querySelector('#device-config').innerHTML = codeBlock(practices.find(p => p.id === input.dataset.practiceId).configs[input.value]);
  if (['campus-department', 'campus-role'].includes(input.id)) {
    mapState.department = Number(document.querySelector('#campus-department').value);
    mapState.role = document.querySelector('#campus-role').value;
    document.querySelector('#campus-facts').innerHTML = campusFacts();
    document.querySelector('#campus-code').innerHTML = codeBlock(campusConfig(mapState.department, mapState.role));
  }
  if (['packet-destination', 'packet-routing'].includes(input.id)) {
    mapState.destination = document.querySelector('#packet-destination').value;
    mapState.routing = document.querySelector('#packet-routing').checked;
    mapState.journey = null;
    document.querySelector('#packet-result').innerHTML = '<div class="packet-hint">Cambiaste el escenario. Envía el paquete para ver qué pasa.</div>';
    document.querySelector('#packet-diagram').innerHTML = networkSVG('map');
  }
  if (input.id === 'command-topic') { filter = input.value; document.querySelector('#command-results').innerHTML = commandRows(document.querySelector('#command-query').value, filter); }
});

app.addEventListener('input', event => {
  if (event.target.id === 'command-query') document.querySelector('#command-results').innerHTML = commandRows(event.target.value, document.querySelector('#command-topic').value);
  if (event.target.id === 'notes-query') document.querySelector('#notes-results').innerHTML = originalRows(event.target.value);
});

app.addEventListener('submit', event => {
  event.preventDefault();
  if (event.target.id === 'global-search') {
    const q = new FormData(event.target).get('q').trim();
    if (q) { const target = href('buscar', q); if (location.hash === target) render(true); else location.hash = target; }
  }
  if (event.target.id === 'subnet-form') {
    try { document.querySelector('#subnet-result').innerHTML = subnetMarkup(calculateSubnet(new FormData(event.target).get('cidr'))); }
    catch (error) { document.querySelector('#subnet-result').innerHTML = `<p class="input-error" role="alert">${esc(error.message)}</p>`; }
  }
});

document.addEventListener('keydown', event => {
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); document.querySelector('#global-query')?.focus(); }
  if (event.key === 'Escape') { document.querySelector('#sidebar')?.classList.remove('open'); document.querySelector('[data-action="menu"]')?.setAttribute('aria-expanded', 'false'); }
});
window.addEventListener('hashchange', () => render(true));
render();
