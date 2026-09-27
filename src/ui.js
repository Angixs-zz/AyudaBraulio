import { marked } from 'marked';
import DOMPurify from 'dompurify';

export const escapeHTML = value => String(value).replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
const paths = {
  home: '<path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z"/>',
  book: '<path d="M12 6v15M3 3h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5v16h-5a4 4 0 0 0-4 2 4 4 0 0 0-4-2H3z"/>',
  layers: '<path d="m12 3 10 5-10 5L2 8zM2 12l10 5 10-5M2 16l10 5 10-5"/>',
  network: '<rect x="8" y="2" width="8" height="6" rx="1"/><rect x="2" y="16" width="7" height="6" rx="1"/><rect x="15" y="16" width="7" height="6" rx="1"/><path d="M12 8v4M5.5 16v-4h13v4"/>',
  terminal: '<rect x="2" y="3" width="20" height="18" rx="3"/><path d="m6 8 4 4-4 4m7 0h5"/>',
  route: '<circle cx="5" cy="5" r="3"/><circle cx="19" cy="19" r="3"/><path d="M8 5h8a4 4 0 0 1 0 8H8a4 4 0 0 0 0 8h7"/>',
  shield: '<path d="m12 2 9 4v6c0 5-9 10-9 10S3 17 3 12V6zM8 12l3 3 5-6"/>',
  zap: '<path d="m13 2-9 12h7l-1 8 10-13h-8z"/>',
  search: '<circle cx="10.5" cy="10.5" r="7.5"/><path d="m16 16 5 5"/>',
  arrow: '<path d="M4 12h16m-6-6 6 6-6 6"/>',
  chevron: '<path d="m9 5 7 7-7 7"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  bookmark: '<path d="M6 3h12v19l-6-4-6 4z"/>',
  external: '<path d="M14 3h7v7m0-7L10 14M10 3H4a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h16a1 1 0 0 0 1-1v-6"/>',
  copy: '<rect x="8" y="8" width="13" height="13" rx="2"/><path d="M16 8V3H3v13h5"/>',
  download: '<path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5"/>',
  refresh: '<path d="M21 4v6h-6M3 20v-6h6M4 8a8 8 0 0 1 13-4l4 6M3 14l4 6a8 8 0 0 0 13-4"/>',
  calculator: '<rect x="4" y="2" width="16" height="20" rx="2"/><path d="M7 6h10M7 11h2m6 0h2M7 15h2m6 0h2M7 19h2m6 0h2"/>',
  compass: '<circle cx="12" cy="12" r="9"/><path d="m16 8-2 6-6 2 2-6z"/>',
  plug: '<path d="M8 2v5m8-5v5M6 7h12v4a6 6 0 0 1-12 0zM12 17v5"/>',
  menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
  close: '<path d="m6 6 12 12M6 18 18 6"/>',
  spark: '<path d="m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5z"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6m0-10v1"/>',
  trophy: '<path d="M8 3h8v7a4 4 0 0 1-8 0zM8 5H3v3a4 4 0 0 0 5 4m8-7h5v3a4 4 0 0 1-5 4M12 14v6m-5 1h10"/>',
};
export const icon = (name, className = '') => `<svg class="icon ${className}" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || paths.book}</svg>`;
export const codeBlock = text => `<div class="code-block"><div class="code-bar"><span><i></i> CISCO IOS</span><button type="button" data-action="copy-code" aria-label="Copiar comandos">${icon('copy')} Copiar</button></div><pre><code>${escapeHTML(text)}</code></pre></div>`;
marked.use({ renderer: { code: ({ text }) => codeBlock(text), table: ({ header, rows }) => `<div class="table-scroll"><table><thead><tr>${header.map(c => `<th>${marked.parseInline(c.text)}</th>`).join('')}</tr></thead><tbody>${rows.map(row => `<tr>${row.map(c => `<td>${marked.parseInline(c.text)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>` } });
export const markdown = text => DOMPurify.sanitize(marked.parse(text), { ADD_ATTR: ['data-action'] });

export function networkSVG(variant = 'hero', activePath = '') {
  const device = (x, y, title, subtitle, kind = 'switch') => `<g transform="translate(${x} ${y})"><rect x="-62" y="-27" width="124" height="54" rx="10" fill="#102437" stroke="${kind === 'core' ? '#70f0b3' : '#315168'}"/><g stroke="${kind === 'core' ? '#70f0b3' : '#53d4ff'}" stroke-width="2"><path d="M-12-11h24M-12-5h24"/>${[-10, -3, 4, 11].map(n => `<path d="M${n} 1v4"/>`).join('')}</g><text y="19" text-anchor="middle" class="device-name">${title}</text><text y="45" text-anchor="middle" class="device-sub">${subtitle}</text></g>`;
  const pc = (x, label, vlan, color) => `<g transform="translate(${x} 284)"><rect x="-18" y="-15" width="36" height="25" rx="4" fill="#102437" stroke="${color}"/><path d="M-8 16H8M0 10v6" stroke="${color}"/><text y="36" text-anchor="middle" class="device-name">${label}</text><text y="53" text-anchor="middle" class="device-sub">VLAN ${vlan}</text></g>`;
  return `<svg class="network-svg ${variant}" viewBox="0 0 560 354" role="img" aria-label="Topología: CORE multicapa conectado por trunks a switches de Sistemas y Electrónica; PCs en VLAN 101 y 102.">
    <defs><pattern id="dots-${variant}" width="18" height="18" patternUnits="userSpaceOnUse"><circle cx="2" cy="2" r=".7" fill="#426278" opacity=".4"/></pattern></defs>
    <rect width="560" height="354" fill="url(#dots-${variant})"/>
    <g fill="none" stroke="#315168" stroke-width="2"><path d="M280 83v30H145v47M280 113h135v47"/><path d="M145 214v28H80v27M145 242h65v27M415 214v55"/></g>
    <g fill="none" stroke="${activePath === 'blocked' ? '#ffc768' : '#70f0b3'}" stroke-width="3" stroke-dasharray="6 7" class="packet-path"><path d="${activePath === 'local' ? 'M80 269v-27h130v27' : activePath === 'routed' ? 'M80 269v-27h65V113h270v156' : activePath === 'blocked' ? 'M80 269v-27h65V113h135V83' : 'M145 160v-47h135V83'}"/></g>
    <text x="165" y="137" class="link-label">802.1Q</text><text x="365" y="137" class="link-label">TRUNK</text>
    ${device(280, 56, 'CORE', 'CAPA 3 · GATEWAYS', 'core')}${device(145, 187, 'SISTEMAS', '10.168.101.0/24')}${device(415, 187, 'ELECTRÓNICA', '10.168.102.0/24')}
    ${pc(80, 'PC de Braulio', 101, '#70f0b3')}${pc(210, 'PC vecina', 101, '#70f0b3')}${pc(415, 'PC remota', 102, '#53d4ff')}
    ${variant === 'hero' ? '<circle cx="501" cy="40" r="4" fill="#70f0b3"/><text x="489" y="44" text-anchor="end" class="link-label">LAB VIRTUAL</text>' : ''}
  </svg>`;
}
