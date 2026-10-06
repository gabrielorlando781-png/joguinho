const icons = {
  settings: '<path d="m9 3-1 3-3 1-2 3 2 2-1 3 3 2 3-1 2 2 3-1 1-3 3-1 2-3-2-2 1-3-3-2-3 1-2-2Z"/><circle cx="12" cy="12" r="3"/>',
  fullscreen: '<path d="M9 3H3v6m12-6h6v6M3 15v6h6m12-6v6h-6"/>',
  search: '<circle cx="10" cy="10" r="6"/><path d="m15 15 6 6"/>',
  code: '<path d="m8 7-5 5 5 5m8-10 5 5-5 5m-3-13-2 16"/>',
  grid: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
  folder: '<path d="M3 7a2 2 0 0 1 2-2h5l2 2h7a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z"/><path d="M3 11h18"/>',
  people: '<circle cx="9" cy="8" r="3"/><path d="M3 20v-2a6 6 0 0 1 12 0v2m1-15a3 3 0 0 1 0 6m2 3a5 5 0 0 1 3 4v2"/>',
  wallet: '<path d="M20 7V5a2 2 0 0 0-2-2H5a3 3 0 0 0 0 6h15v12H5a3 3 0 0 1-3-3V6"/><path d="M20 12h-5v5h5"/><circle cx="16.5" cy="14.5" r=".5"/>',
  bulb: '<path d="M9 18h6m-5 3h4M8 14a7 7 0 1 1 8 0c-1 1-1 2-1 3H9c0-1 0-2-1-3Z"/>',
  chair: '<path d="M6 13V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v9M4 10v6h16v-6M7 16v5m10-5v5"/>',
  arrow: '<path d="M5 12h14m-6-6 6 6-6 6"/>',
  down: '<path d="m7 10 5 5 5-5"/>',
  play: '<path d="m8 4 13 8L8 20Z"/>',
  pause: '<path d="M7 4h3v16H7zm7 0h3v16h-3z"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  star: '<path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9Z"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1 1m12 12 1 1M5 19l1-1M18 6l1-1"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  close: '<path d="m6 6 12 12M6 18 18 6"/>',
  coffee: '<path d="M4 8h12v9a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3Zm12 1h3a3 3 0 0 1 0 6h-3M7 3v2m4-2v2M2 23h17"/>',
  target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>',
  trend: '<path d="m3 17 6-6 4 4L21 5m-6 0h6v6"/>',
  book: '<path d="M12 5v16M3 3c3-1 6 0 9 2 3-2 6-3 9-2v16c-3-1-6 0-9 2-3-2-6-3-9-2Z"/>',
  save: '<path d="M5 3h12l4 4v14H3V3Zm2 0v7h10V3M7 21v-7h10v7"/>',
  plant: '<path d="M12 14C5 14 3 9 3 4c6 0 9 3 9 10Zm0 0c0-7 3-10 9-10 0 5-2 10-9 10Zm0 0v6M7 20h10"/>',
  lock: '<rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V6a4 4 0 0 1 8 0v4"/>',
  message: '<path d="M21 15a3 3 0 0 1-3 3H8l-5 3V6a3 3 0 0 1 3-3h12a3 3 0 0 1 3 3Zm-14-7h10M7 12h7"/>',
};
const icon = (name, cls = '') => `<svg class="icon ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name] || icons.code}</svg>`;
const escape = (v) => String(v ?? '').replace(/[&<>"']/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
const money = (n) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(n || 0);
const pct = (n) => Math.max(0, Math.min(100, n));

function avatar(color = '#adc972', size = 48, name = '') {
  return `<svg class="avatar-art" width="${size}" height="${size}" viewBox="0 0 48 48" role="img" aria-label="${escape(name || 'Personagem')}"><rect width="48" height="48" rx="14" fill="${escape(color)}" fill-opacity=".14"/><path d="M12 48V34h6v-5h12v5h6v14" fill="${escape(color)}"/><path d="M15 11h18v8h3v10h-5v5H17v-5h-5V19h3" fill="#e9b891"/><path d="M12 17V9h5V5h15v5h5v12h-5v-7h-7v4H15v5h-3" fill="#45372e"/><path d="M19 23h3v3h-3m9-3h3v3h-3" fill="#292d29"/><path d="M21 31h7v2h-7" fill="#b37761"/><path d="M20 35h8v4h-8" fill="#e9b891"/></svg>`;
}


export { icon, escape, money, pct, avatar };
