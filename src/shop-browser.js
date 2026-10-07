import { escape, money, icon } from './ui.js';
import { OFFICE_STAGES, OFFICE_SECTORS, ROOM_LEVELS, COMPUTER_LEVELS, SHOP_ITEMS,
  getOfficeOverview, getItemEligibility, getExpansionEligibility, getRoomEligibility, getComputerEligibility,
} from './office-progression.js';

export const SHOP_HOST = 'www.espacoecia.game';
export const SHOP_CATEGORIES = [
  { id: 'all', slug: '', name: 'Todas as expansões', icon: 'grid' },
  { id: 'areas', slug: 'areas', name: 'Expansões de área', icon: 'grid' },
  { id: 'rooms', slug: 'salas', name: 'Salas e divisórias', icon: 'people' },
  { id: 'desks', slug: 'postos', name: 'Mesas e cadeiras', icon: 'chair' },
  { id: 'hardware', slug: 'computadores', name: 'Computadores', icon: 'code' },
  { id: 'comfort', slug: 'conforto', name: 'Conforto e rotina', icon: 'coffee' },
  { id: 'identity', slug: 'identidade', name: 'Piso e identidade', icon: 'plant' },
];
const normalize = (value) => String(value || '').normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
export function createShopBrowser() {
  return { history: [{ page: 'catalog', category: 'all', query: '', sort: 'recommended', available: false, roomClass: '' }], index: 0, receipt: null };
}
export function currentShopRoute(browser) { return browser.history[browser.index]; }
export function navigateShop(browser, route) {
  const next = { page: 'catalog', category: 'all', query: '', sort: 'recommended', available: false, roomClass: '', ...route };
  if (JSON.stringify(currentShopRoute(browser)) === JSON.stringify(next)) return;
  browser.history = [...browser.history.slice(0, browser.index + 1), next].slice(-40);
  browser.index = browser.history.length - 1;
}
export function shopAddress(route) {
  const category = SHOP_CATEGORIES.find((entry) => entry.id === route.category);
  const path = route.page === 'product' ? `produto/${encodeURIComponent(route.product)}`
    : route.page === 'office' ? 'meu-escritorio' : route.page === 'receipt' ? 'pedido-confirmado'
      : route.page === 'home' ? '' : `catalogo${category?.slug ? '/' + category.slug : ''}`;
  return `https://${SHOP_HOST}/${path}${route.query ? '?busca=' + encodeURIComponent(route.query) : ''}`;
}
export function parseShopAddress(input) {
  try {
    const raw = String(input || '').trim();
    const url = new URL(raw.startsWith('/') ? `https://${SHOP_HOST}${raw}` : /^[a-z]+:\/\//i.test(raw) ? raw : `https://${raw}`);
    if (url.protocol !== 'https:' || url.hostname !== SHOP_HOST || url.port || url.username || url.password) return { page: 'error', message: 'Endereço não encontrado. Abra a página inicial da Espaço & Cia.' };
    const path = decodeURIComponent(url.pathname).replace(/\/$/, '');
    if (!path) return { page: 'home' };
    if (path === '/meu-escritorio') return { page: 'office' };
    if (path.startsWith('/produto/')) return { page: 'product', product: path.slice(9) };
    if (path === '/catalogo' || path.startsWith('/catalogo/')) {
      const slug = path.slice(10);
      const category = SHOP_CATEGORIES.find((entry) => entry.slug === slug);
      if (category) return { page: 'catalog', category: category.id, query: (url.searchParams.get('busca') || '').slice(0, 64) };
    }
    return { page: 'error', message: 'Esta página não está no catálogo. Volte para a loja e escolha uma categoria.' };
  } catch { return { page: 'error', message: 'Confira o endereço e tente novamente.' }; }
}

/** Every displayed offer uses the same eligibility rules as the office economy. */
export function getShopCatalog(state) {
  const overview = getOfficeOverview(state);
  const products = [];
  const add = (entry) => products.push({ description: '', className: '', maintenance: 0, rent: 0, slots: 0, ...entry });
  const stageIndex = OFFICE_STAGES.findIndex((stage) => stage.id === state.office.stage);
  OFFICE_STAGES.forEach((stage, index) => {
    const owned = index <= stageIndex;
    const eligibility = owned ? { ok: false, owned: true, reason: index === stageIndex ? 'Este é o endereço atual da empresa.' : 'Esta etapa já faz parte da sua história.' }
      : index === stageIndex + 1 ? getExpansionEligibility(state) : { ok: false, reason: `Amplie para ${OFFICE_STAGES[index - 1].name.toLowerCase()} primeiro.` };
    add({ id: `area:${stage.id}`, category: 'areas', kind: 'area', target: stage.id, name: stage.name, description: stage.description,
      price: stage.price, rent: stage.dailyRent, slots: stage.slots, className: `Classe ${index + 1}`, eligibility,
      spec: `${stage.slots} posições · até ${stage.maxPosts} postos, incluindo o fundador` });
  });
  for (const item of SHOP_ITEMS.filter((entry) => entry.id !== 'chair')) {
    const category = item.id === 'desk' ? 'desks' : ['meeting', 'ceo'].includes(item.id) ? 'rooms'
      : ['floor', 'decor', 'banner'].includes(item.id) ? 'identity' : 'comfort';
    add({ id: `item:${item.id}`, category, kind: 'item', target: item.id, name: item.name, description: item.description,
      price: item.price, slots: item.slots, maintenance: item.monthlyMaintenance, rent: item.id === 'meeting' ? 10 : item.id === 'ceo' ? 18 : 0,
      className: category === 'rooms' ? 'Sala especial' : '', eligibility: getItemEligibility(state, item.id), spec: item.id === 'desk' ? 'Mesa + computador básico; cadeira vendida separadamente' : '' });
  }
  const chair = SHOP_ITEMS.find((entry) => entry.id === 'chair');
  const incomplete = overview.workstations.filter((post) => !post.chair);
  if (!incomplete.length) add({ id: 'chair:pending', category: 'desks', kind: 'item', target: 'chair', name: chair.name, price: chair.price,
    description: chair.description, eligibility: getItemEligibility(state, 'chair'), spec: 'Compre uma mesa para escolher onde instalar.' });
  for (const post of incomplete) add({ id: `chair:${post.id}`, category: 'desks', kind: 'item', target: 'chair', workstation: post.id,
    name: `${chair.name} · Posto ${overview.workstations.indexOf(post) + 1}`, price: chair.price, description: chair.description,
    eligibility: getItemEligibility(state, 'chair', { workstationId: post.id }), spec: 'Completa este posto e libera uma vaga para contratação.' });
  for (const sector of OFFICE_SECTORS) {
    const current = ROOM_LEVELS.findIndex((level) => level.id === state.office.rooms[sector.id]);
    ROOM_LEVELS.slice(1).forEach((level, offset) => {
      const index = offset + 1;
      const eligibility = index <= current ? { ok: false, owned: true, reason: index === current ? 'Este é o nível atual deste setor.' : 'Este nível já foi construído.' }
        : index === current + 1 ? getRoomEligibility(state, sector.id) : { ok: false, reason: `Construa ${ROOM_LEVELS[index - 1].name.toLowerCase()} neste setor primeiro.` };
      add({ id: `room:${sector.id}:${level.id}`, category: 'rooms', kind: 'room', target: sector.id, level: level.id,
        name: `${level.name} · ${sector.name}`, description: `${level.description} ${sector.description}`, price: level.price,
        maintenance: level.monthlyMaintenance, rent: level.dailyRent, slots: level.slots, className: level.name, eligibility,
        spec: `Setor: ${sector.name} · substitui o nível anterior` });
    });
  }
  for (const [index, post] of overview.workstations.entries()) {
    for (const level of COMPUTER_LEVELS) {
      const eligibility = level.id <= post.computerLevel ? { ok: false, owned: true, reason: level.id === post.computerLevel ? 'Equipamento instalado neste posto.' : 'Este nível já foi superado.' }
        : level.id === post.computerLevel + 1 ? getComputerEligibility(state, post.id) : { ok: false, reason: 'Instale um computador profissional neste posto primeiro.' };
      add({ id: `pc:${post.id}:${level.id}`, category: 'hardware', kind: 'computer', target: post.id, level: level.id,
        name: `PC ${level.name.toLowerCase()} · Posto ${index + 1}`, description: level.description, price: level.upgradePrice,
        maintenance: level.monthlyMaintenance, className: `Nível ${level.id}`, eligibility,
        spec: `${post.occupantName || 'Vaga livre'} · produção ×${level.multiplier.toLocaleString('pt-BR')}` });
    }
  }
  return products;
}

export function filterShopCatalog(products, route) {
  const query = normalize(route.query).trim();
  const filtered = products.filter((entry) => (!route.category || route.category === 'all' || entry.category === route.category)
    && (!route.available || entry.eligibility.ok) && (!route.roomClass || entry.className === route.roomClass)
    && (!query || normalize(`${entry.name} ${entry.description} ${entry.className} ${entry.spec || ''}`).includes(query)));
  if (route.sort === 'price-low') filtered.sort((a, b) => a.price - b.price || a.name.localeCompare(b.name, 'pt-BR'));
  else if (route.sort === 'price-high') filtered.sort((a, b) => b.price - a.price || a.name.localeCompare(b.name, 'pt-BR'));
  else if (route.sort === 'name') filtered.sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
  else filtered.sort((a, b) => Number(b.eligibility.ok) - Number(a.eligibility.ok) || Number(Boolean(a.eligibility.owned)) - Number(Boolean(b.eligibility.owned)));
  return filtered;
}

function sceneArt(product) {
  const kind = product.kind === 'area' ? (product.target === 'floor' ? 'floor-office' : product.target) : product.kind === 'room' || ['meeting', 'ceo'].includes(product.target) ? 'room'
    : product.kind === 'computer' ? 'computer' : product.target;
  const table = (x, y, scale = 1) => `<g transform="translate(${x} ${y}) scale(${scale})"><path fill="#ac7344" d="M0 10 38 0 74 17 37 30Z"/><path fill="#754d30" d="M0 10v7l37 20v-7Z"/><path fill="#d7a36a" d="M37 30 74 17v7L37 37Z"/><path stroke="#656763" stroke-width="5" d="M5 17v28M37 36v28M69 24v24"/><path fill="#333d43" d="M29-13 53-6v22l-24-8Z"/><path fill="#93bfd1" d="m32-9 17 5v14l-17-5Z"/><path fill="#dee5e7" d="m22 15 28 8 10-4-27-8Z"/></g>`;
  const floor = '<path fill="#ddd8cc" d="M27 130 155 73 297 133 165 195Z"/><path fill="none" stroke="#c9c1b4" d="m61 115 141 62m-107-77 142 61M129 85l143 59M62 146l129-57M96 162l129-58M131 179l130-60"/>';
  let art = '';
  if (['garage', 'commercial', 'floor-office', 'room'].includes(kind)) {
    const glass = product.level === 'glass';
    art = floor + `<path fill="${glass ? '#b9d6d9' : '#eee8d7'}" d="M27 130V47l128-55v81Z"/><path fill="${glass ? '#c8e1e4' : '#d4c9b6'}" d="M155-8 297 49v84L155 73Z"/>`;
    art += kind === 'garage' ? '<path fill="#9ba69a" d="m50 45 79-34v63l-79 35Z"/><path stroke="#d8dcd4" stroke-width="3" d="m55 51 69-30M55 64l69-30M55 77l69-30M55 90l69-30"/>'
      : `<path fill="${glass ? '#9ec6d3' : '#7f9aa4'}" d="m180 12 91 37v53l-91-37Z"/><path stroke="#f3f1e6" stroke-width="3" d="m209 24v54m31-41v54m-60-56 91 37"/>`;
    art += table(69, 98, .85) + table(173, 102, .72);
    if (kind === 'floor-office') art += table(127, 63, .6) + table(203, 61, .55);
    if (kind === 'room') art += `<path fill="${glass ? '#b6dae3' : '#e5ddd1'}" fill-opacity="${glass ? '.62' : '1'}" stroke="${glass ? '#6e939c' : '#b4a792'}" stroke-width="3" d="M162 86v86l104-48V37Z"/><path stroke="#8ea2a4" stroke-width="2" d="M198 69v86m34-102v86"/>`;
  } else if (kind === 'desk') art = floor + table(88, 105, 1.65);
  else if (kind === 'computer') art = `<path fill="#c5c1b2" stroke="#686c69" stroke-width="2" d="M74 25h124v105H74Z"/><path fill="#303c40" d="M84 35h104v76H84Z"/><path fill="${product.level === 3 ? '#4778b8' : '#688f9c'}" d="M90 41h92v64H90Z"/><path fill="#d1e3de" d="M96 50h40v6H96Zm0 14h74v4H96Zm0 11h57v4H96Z"/><path fill="#a6a394" d="M123 130h28v17h-28Zm-25 17h81v11H98Z"/><path fill="#dcd6c8" stroke="#919183" d="m52 169 134-4 25 24-151 3Z"/><path stroke="#a5a397" stroke-width="4" d="m68 176 112-2m-104 9 111-2"/><path fill="#bbb6a7" stroke="#747469" d="M217 38h49v122h-49Z"/><path fill="#485451" d="M226 51h31v8h-31Zm0 18h31v5h-31Z"/><circle fill="#8dbf6c" cx="250" cy="140" r="4"/>`;
  else if (kind === 'chair') art = '<path stroke="#3f454b" stroke-width="8" d="M160 117v44m-1 0-42 18m42-18 47 13m-47-13 3 26"/><path fill="#556b7c" stroke="#303e48" stroke-width="3" d="M112 40q48-19 88 0v60q-45 18-88 0Z"/><path fill="#66839a" d="m104 106 53-11 56 13-51 30-58-14Z"/><path stroke="#3f454b" stroke-width="7" d="M109 99v-18m97 19V81"/><circle fill="#292e30" cx="117" cy="180" r="7"/><circle fill="#292e30" cx="205" cy="175" r="7"/><circle fill="#292e30" cx="163" cy="188" r="7"/>';
  else if (kind === 'lounge') art = '<path fill="#988b67" d="M62 88q0-28 27-28h135q28 0 28 28v53H62Z"/><path fill="#b9aa80" d="M68 97h178v41H68Z"/><path fill="#817653" d="M53 91h29v71H53Zm183 0h28v71h-28Z"/><path fill="#c9bc98" d="M88 94h64v42H88Zm68 0h70v42h-70Z"/><path stroke="#625c47" stroke-width="6" d="M72 159v20m173-20v20"/><path fill="#d1bc8f" d="m130 170 46-9 48 16-48 14Z"/>';
  else if (kind === 'coffee-machine') art = '<path fill="#b9b6a8" stroke="#77766c" stroke-width="2" d="M108 30h94v119h-94Z"/><path fill="#4a4a42" d="M116 38h78v34h-78Zm0 77h78v25h-78Z"/><path fill="#cbc7b8" d="M128 81h52v28h-52Z"/><path fill="#332b22" d="M146 72h10v15h-10Z"/><path fill="#f1e8d9" d="M139 85h27v31h-27Z"/><path fill="none" stroke="#f1e8d9" stroke-width="5" d="M166 93h10v15h-10"/><path fill="#8d6045" d="M82 150h150v18H82Z"/><path stroke="#9bb8a1" stroke-width="3" d="M150 56h24"/>';
  else if (kind === 'whiteboard') art = '<path fill="#f9faf3" stroke="#969b91" stroke-width="7" d="M60 26h194v117H60Z"/><path stroke="#8c9d82" stroke-width="4" d="M78 52h48v29H78Zm80 31h53v26h-53Zm-32-16h33m-11-7 11 7-11 7"/><path stroke="#5c655e" stroke-width="6" d="M87 148v43m138-43v43"/><path fill="#bb634b" d="M83 126h44v6H83Z"/>';
  else if (kind === 'floor') art = floor;
  else if (kind === 'banner') art = '<path fill="#e1d9c6" d="M44 45h232v102H44Z"/><path fill="#466c63" d="M53 55h214v82H53Z"/><path fill="#e4eee2" d="M80 76h157v10H80Zm26 21h105v6H106Z"/><path stroke="#a59b89" stroke-width="6" d="M57 148v39m204-39v39"/>';
  else art = '<path fill="#b88a65" d="M117 126h81l-12 60h-58Z"/>' + '<path stroke="#55715a" stroke-width="7" d="M158 130V53m0 48-39-30m40 15 40-35"/><path fill="#709267" d="M159 81q-58-4-49-41 42 2 49 41Zm0-13q-24-52 8-62 31 23-8 62Zm1 25q60-5 54-46-40 1-54 46Z"/>';
  return `<svg class="shop-product-art" viewBox="0 0 320 210" aria-hidden="true"><defs><linearGradient id="shop-bg-${escape(product.id.replace(/[^a-z0-9]/gi, '-'))}" x2="0" y2="1"><stop stop-color="#fcfaf3"/><stop offset="1" stop-color="#e8e2d8"/></linearGradient></defs><path fill="url(#shop-bg-${escape(product.id.replace(/[^a-z0-9]/gi, '-'))})" d="M0 0h320v210H0Z"/><ellipse fill="#c7bfb0" opacity=".45" cx="163" cy="179" rx="110" ry="14"/><g transform="translate(0 10)">${art}</g></svg>`;
}

function status(product) { return product.eligibility.owned ? 'Já adquirido' : product.eligibility.ok ? 'Disponível' : 'Bloqueado'; }
function productCard(product) {
  return `<article class="shop-card" data-shop-card="${escape(product.id)}"><button class="shop-card-link" data-shop-product="${escape(product.id)}" aria-label="Ver ${escape(product.name)}"><div class="shop-card-image">${sceneArt(product)}<span class="shop-card-status ${product.eligibility.owned ? 'owned' : product.eligibility.ok ? 'available' : 'locked'}">${status(product)}</span></div><div class="shop-card-label"><strong>${escape(product.name)}</strong><span>${money(product.price)}</span></div></button><div class="shop-card-caption"><small>${escape(product.className || SHOP_CATEGORIES.find((category) => category.id === product.category)?.name)}</small><button data-shop-product="${escape(product.id)}">Ver detalhes ${icon('arrow')}</button></div></article>`;
}
function shopOverview(state) {
  const office = getOfficeOverview(state);
  return `<section class="shop-office-overview"><div class="shop-section-heading"><div><small>SEU PLANO DE CRESCIMENTO</small><h2>${escape(office.stage.name)}</h2></div><span>${escape(state.profile.company)}</span></div><div class="shop-office-metrics"><div><span>Espaço ocupado</span><strong>${office.usedSlots}/${office.maxSlots}</strong><small>posições do escritório</small><meter min="0" max="${office.maxSlots}" value="${office.usedSlots}" aria-label="Posições ocupadas"></meter></div><div><span>Postos livres</span><strong>${office.freePosts}</strong><small>prontos para contratar</small></div><div><span>Custos fixos</span><strong>${money(office.dailyRent)}</strong><small>por dia, incluindo serviços e salas</small></div><div><span>Manutenção</span><strong>${money(office.monthlyMaintenance)}</strong><small>a cada 28 dias · próxima D${office.nextMaintenanceDay}</small></div></div><div class="shop-stage-roadmap">${OFFICE_STAGES.map((stage) => `<button data-shop-product="area:${stage.id}" class="${office.stage.id === stage.id ? 'current' : ''}"><span>${stage.slots} posições</span><strong>${escape(stage.name)}</strong><small>${money(stage.price)} · ${money(stage.dailyRent)}/dia base</small></button>`).join('')}</div><p>Ruído entre setores: ${Math.round(office.noise * 100)}% · Sinergia da equipe: ${Math.round(office.synergy * 100)}%. Explore salas e equipamentos para escolher como crescer.</p><button class="shop-primary" data-shop-category="areas">Ver expansões de área ${icon('arrow')}</button></section>`;
}
function productDetail(state, product) {
  if (!product) return '<section class="shop-empty"><h2>Esse produto mudou no catálogo.</h2><p>Consulte as opções atuais para o seu escritório.</p><button class="shop-primary" data-shop-category="all">Voltar ao catálogo</button></section>';
  const eligibility = product.eligibility;
  return `<section class="shop-product-detail" data-shop-detail="${escape(product.id)}"><button class="shop-breadcrumb" data-shop-category="${product.category}">← ${escape(SHOP_CATEGORIES.find((entry) => entry.id === product.category)?.name)}</button><div class="shop-detail-columns"><div class="shop-detail-visual">${sceneArt(product)}<span>${escape(product.className || 'Para o seu escritório')}</span></div><div class="shop-detail-copy"><small>ESPAÇO & CIA. / ${escape(product.category.toUpperCase())}</small><h2>${escape(product.name)}</h2><p>${escape(product.description)}</p><strong class="shop-detail-price">${money(product.price)}</strong><span class="shop-price-note">${product.kind === 'area' ? 'mudança de endereço' : 'compra e instalação'}</span>${product.spec ? `<p class="shop-product-spec">${escape(product.spec)}</p>` : ''}<dl class="shop-product-costs"><div><dt>${product.kind === 'area' ? 'Capacidade do endereço' : 'Espaço ocupado'}</dt><dd>${product.slots ? product.slots + ' posições' : 'Sem posição adicional'}</dd></div><div><dt>${product.kind === 'area' ? 'Aluguel base' : 'Aluguel adicional'}</dt><dd>${money(product.rent)} / dia</dd></div><div><dt>Manutenção do item</dt><dd>${money(product.maintenance)} / 28 dias</dd></div></dl><p class="shop-detail-eligibility ${eligibility.ok ? 'available' : ''}" role="status">${icon(eligibility.owned || eligibility.ok ? 'check' : 'lock')}<span>${escape(eligibility.reason || 'Disponível para comprar e instalar no escritório.')}</span></p><button class="shop-primary shop-buy" data-shop-buy="${escape(product.id)}" ${eligibility.ok ? '' : 'disabled'}>${eligibility.owned ? 'Já faz parte da empresa' : product.kind === 'area' ? 'Mudar para este endereço' : 'Comprar e instalar'} ${icon('arrow')}</button><p class="shop-price-note">Seu saldo: ${money(state.cash)}. ${product.kind === 'area' ? 'Internet, serviços e salas são somados ao aluguel base.' : 'A compra é instalada no escritório ao confirmar.'}</p></div></div>${product.target === 'banner' && state.office.amenities.banner ? `<form id="banner-form" class="shop-banner-form"><h3>Personalizar seu banner</h3><label>Texto<input name="bannerText" value="${escape(state.office.banner.text)}" maxlength="40" required></label><label>Cor<input name="bannerColor" type="color" value="${escape(state.office.banner.color)}"></label><button class="shop-primary" type="submit">Salvar identidade</button></form>` : ''}</section>`;
}
function receiptPage(state, receipt) {
  if (!receipt) return shopOverview(state);
  const office = getOfficeOverview(state);
  return `<section class="shop-receipt"><div class="shop-receipt-check">${icon('check')}</div><small>ESPAÇO & CIA. · PEDIDO CONFIRMADO</small><h2>Sua empresa ganhou espaço para crescer.</h2><p>${escape(receipt.name)}</p><dl><div><dt>Total pago</dt><dd>${money(receipt.price)}</dd></div><div><dt>Saldo após a compra</dt><dd>${money(receipt.cash ?? state.cash)}</dd></div><div><dt>Espaço após a compra</dt><dd>${receipt.usedSlots ?? office.usedSlots}/${receipt.maxSlots ?? office.maxSlots} posições</dd></div><div><dt>Próxima manutenção</dt><dd>D${receipt.nextMaintenanceDay ?? office.nextMaintenanceDay} · ${money(receipt.maintenance ?? office.monthlyMaintenance)}</dd></div></dl><p>${escape(receipt.message)}</p><div class="shop-receipt-actions"><button class="shop-primary" data-shop-category="${receipt.category}">Continuar nessa categoria</button><button data-shop-page="office">Consultar meu escritório</button><button data-action="close-station">Ver no escritório</button></div></section>`;
}

export function renderShopBrowser(state, browser) {
  const route = currentShopRoute(browser);
  const products = getShopCatalog(state);
  const category = SHOP_CATEGORIES.find((entry) => entry.id === route.category) || SHOP_CATEGORIES[0];
  const filtered = filterShopCatalog(products, route);
  const featured = ['area:commercial', 'item:desk', 'pc:post-1:2', 'item:coffee-machine', 'item:meeting', 'item:lounge'].map((id) => products.find((entry) => entry.id === id)).filter(Boolean);
  let content;
  if (route.page === 'product') content = productDetail(state, products.find((entry) => entry.id === route.product));
  else if (route.page === 'office') content = shopOverview(state);
  else if (route.page === 'receipt') content = receiptPage(state, route.receipt || browser.receipt);
  else if (route.page === 'error') content = `<section class="shop-empty"><h2>Página não encontrada</h2><p>${escape(route.message)}</p><button class="shop-primary" data-shop-page="home">Abrir a loja</button></section>`;
  else content = `${route.page === 'home' ? `<section class="shop-hero"><div><small>O PRÓXIMO PASSO DA SUA EMPRESA</small><h2>Um escritório à altura<br>das suas ideias.</h2><p>Do primeiro posto a um andar inteiro. Encontre o espaço, os equipamentos e as salas para crescer.</p><button data-shop-category="areas">Explorar endereços ${icon('arrow')}</button></div><div class="shop-hero-art">${sceneArt(products.find((entry) => entry.id === 'area:commercial'))}</div><span>CATÁLOGO 98 / EMPRESAS EM MOVIMENTO</span></section><div class="shop-category-tiles">${SHOP_CATEGORIES.slice(1).map((entry) => `<button data-shop-category="${entry.id}">${icon(entry.icon)}<strong>${entry.name}</strong><span>Explorar →</span></button>`).join('')}</div>` : ''}<div class="shop-section-heading"><div><small>${route.page === 'home' ? 'SELEÇÃO PARA SUA EMPRESA' : 'CATÁLOGO DE EXPANSÕES'}</small><h2>${route.page === 'home' ? 'Escolha seu próximo investimento' : escape(category.name)}</h2></div><span>${route.page === 'home' ? featured.length : filtered.length} opções</span></div>${route.page === 'home' ? '' : `<button class="shop-toggle-filters" data-shop-toggle-filters="true" aria-expanded="${Boolean(route.filtersOpen)}">Filtrar e ordenar ${icon('down')}</button><form id="shop-filter-form" class="shop-filters ${route.filtersOpen ? 'open' : ''}"><label>Ordenar<select name="sort"><option value="recommended" ${route.sort === 'recommended' ? 'selected' : ''}>Disponíveis primeiro</option><option value="price-low" ${route.sort === 'price-low' ? 'selected' : ''}>Menor preço</option><option value="price-high" ${route.sort === 'price-high' ? 'selected' : ''}>Maior preço</option><option value="name" ${route.sort === 'name' ? 'selected' : ''}>Nome</option></select></label>${route.category === 'rooms' ? `<label>Classe<select name="roomClass"><option value="">Todas as classes</option>${['Divisórias', 'Sala dedicada', 'Sala de vidro', 'Sala especial'].map((name) => `<option ${route.roomClass === name ? 'selected' : ''}>${name}</option>`).join('')}</select></label>` : ''}<label class="shop-available-filter"><input name="available" type="checkbox" ${route.available ? 'checked' : ''}>Só disponíveis</label><button type="submit">Aplicar</button></form>`}<div class="shop-product-grid">${(route.page === 'home' ? featured : filtered).map(productCard).join('') || '<div class="shop-empty"><h3>Nenhuma opção com esses filtros.</h3><p>Tente outra busca ou consulte todas as expansões.</p><button data-shop-category="all">Limpar filtros</button></div>'}</div>`;
  return `<div class="shop-browser office-store" data-shop-page-active="${escape(route.page)}"><div class="shop-browser-toolbar"><button data-shop-nav="back" ${browser.index === 0 ? 'disabled' : ''} aria-label="Voltar página">←</button><button data-shop-nav="forward" ${browser.index >= browser.history.length - 1 ? 'disabled' : ''} aria-label="Avançar página">→</button><button data-shop-nav="reload" aria-label="Atualizar página">↻</button><button data-shop-page="home" aria-label="Página inicial da loja">${icon('grid')}</button><button data-edit="open" aria-label="Editar layout" title="Organizar escritório">▱</button><form id="shop-address-form"><label for="shop-address">Endereço</label><span aria-hidden="true">${icon('lock')}</span><input id="shop-address" name="address" value="${escape(shopAddress(route))}" aria-label="Endereço do navegador" autocomplete="off" spellcheck="false"><button type="submit">Ir</button></form></div><div class="shop-browser-favorites"><span>Favoritos</span><button data-shop-page="home">${icon('star')} Espaço & Cia.</button><button data-shop-page="office">${icon('folder')} Meu escritório</button></div><div class="shop-browser-viewport"><div class="shop-site"><div class="shop-site-announcement">INVISTA NO ESCRITÓRIO. CONSTRUA A PRÓXIMA ETAPA DA SUA EMPRESA.</div><header class="shop-site-header"><button class="shop-logo" data-shop-page="home"><span>E<span>&</span>C</span><strong>ESPAÇO <b>& CIA.</b><small>ESCRITÓRIOS EM EXPANSÃO</small></strong></button><form id="shop-search-form" class="shop-search"><input name="query" value="${escape(route.query || '')}" placeholder="Busque uma expansão, sala ou equipamento" aria-label="Buscar no catálogo" maxlength="64"><button type="submit" aria-label="Buscar produtos">${icon('search')}</button></form><button class="shop-account" data-shop-page="office"><small>SALDO DA EMPRESA</small><strong>${money(state.cash)}</strong><span>Meu escritório →</span></button></header><nav class="shop-site-nav" aria-label="Categorias da loja">${SHOP_CATEGORIES.map((entry) => `<button data-shop-category="${entry.id}" class="${route.page === 'catalog' && category.id === entry.id ? 'active' : ''}">${escape(entry.name)}</button>`).join('')}</nav><div class="shop-page-layout"><aside class="shop-sidebar"><strong>DEPARTAMENTOS</strong>${SHOP_CATEGORIES.slice(1).map((entry) => `<button data-shop-category="${entry.id}" class="${category.id === entry.id ? 'active' : ''}">${icon(entry.icon)}${escape(entry.name)}</button>`).join('')}<div class="shop-sidebar-note"><span>COMPRE PARA O SEU MOMENTO</span><strong>${escape(getOfficeOverview(state).stage.name)}</strong><p>Os requisitos e o espaço livre definem o que sua empresa pode instalar.</p><button data-shop-page="office">Consultar espaço →</button></div></aside><main class="shop-page-content" tabindex="-1">${content}</main></div><footer class="shop-site-footer"><strong>ESPAÇO & CIA.</strong><span>Espaço, equipamentos e novas possibilidades.</span><button data-shop-page="office">Seu escritório e os custos contínuos →</button></footer></div></div><footer class="shop-browser-status"><span>${icon('check')} Página carregada · Espaço & Cia.</span><span>Intranet ${icon('grid')}</span></footer></div>`;
}
