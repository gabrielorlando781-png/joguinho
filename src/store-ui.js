import { icon, escape, money } from './ui.js';
import {
  OFFICE_STAGES, OFFICE_SECTORS, ROOM_LEVELS, COMPUTER_LEVELS, SHOP_ITEMS,
  getOfficeOverview, getItemEligibility, getRoomEligibility,
  getExpansionEligibility, getComputerEligibility,
} from './office-progression.js';

const STORE_TABS = [
  ['overview', 'Escritório'], ['workstations', 'Postos & PCs'],
  ['rooms', 'Salas'], ['appearance', 'Identidade'],
];
const ITEM_ICONS = {
  desk: 'grid', chair: 'chair', lounge: 'sun', floor: 'grid', decor: 'plant',
  banner: 'star', 'coffee-machine': 'coffee', whiteboard: 'folder', meeting: 'people', ceo: 'target',
};
const SECTOR_ICONS = { development: 'code', sales: 'message', hr: 'people', finance: 'wallet' };
const number = (n) => Number(n || 0).toLocaleString('pt-BR', { maximumFractionDigits: 2 });
const countLabel = (n, label) => `${number(n)} ${n === 1 ? label : label === 'posição' ? 'posições' : `${label}s`}`;
const monthly = (n) => `${money(n)} / 28 dias`;

function eligibilityNote(eligibility, owned = false) {
  const available = eligibility.ok;
  const message = owned ? 'Já faz parte do escritório.' : eligibility.reason || (available ? 'Disponível para sua empresa.' : 'Ainda indisponível.');
  return `<p class="store-eligibility ${owned ? 'owned' : available ? 'available' : ''}">${icon(owned || available ? 'check' : 'lock')}<span>${escape(message)}</span></p>`;
}

function facts({ slots = 0, monthlyMaintenance = 0, dailyRent = 0 } = {}) {
  const items = [];
  if (slots > 0) items.push(`<span>${icon('grid')}${countLabel(slots, 'posição')}</span>`);
  if (monthlyMaintenance > 0) items.push(`<span>${icon('wallet')}${monthly(monthlyMaintenance)} de manutenção</span>`);
  if (dailyRent > 0) items.push(`<span>${icon('clock')}${money(dailyRent)} / dia de aluguel</span>`);
  return items.length ? `<div class="store-facts">${items.join('')}</div>` : '';
}

function price(value, note = 'compra única') {
  return `<div class="store-price">${money(value)}<small>${escape(note)}</small></div>`;
}

function itemOwned(state, item) {
  if (['meeting', 'ceo'].includes(item.id)) return Boolean(state.office.special[item.id]);
  if (Object.hasOwn(state.office.amenities, item.id)) return Boolean(state.office.amenities[item.id]);
  if (item.id === 'coffee-machine' || item.id === 'whiteboard') {
    return state.furniture.some((f) => (typeof f === 'string' ? f : f.id) === item.id);
  }
  return false;
}

function renderItem(state, itemId, options = {}) {
  const item = SHOP_ITEMS.find((entry) => entry.id === itemId);
  if (!item) return '';
  const eligibility = getItemEligibility(state, itemId, options);
  const owned = Boolean(eligibility.owned || itemOwned(state, item));
  const attrs = `data-office-buy="${escape(itemId)}"${options.workstationId ? ` data-workstation="${escape(options.workstationId)}"` : ''}`;
  return `<article class="store-item ${owned ? 'owned' : ''}">
    <div class="store-item-symbol">${icon(ITEM_ICONS[itemId] || 'plus')}</div>
    <div class="store-item-copy"><h3>${escape(item.name)}</h3><p>${escape(item.description)}</p>${facts(item)}</div>
    <div class="store-purchase">${price(eligibility.price ?? item.price)}<button class="${owned ? 'secondary' : 'primary'}-button compact" ${attrs} ${eligibility.ok ? '' : 'disabled'}>${owned ? `${icon('check')} Instalado` : `${icon('plus')} Comprar`}</button></div>
    ${eligibilityNote(eligibility, owned)}
  </article>`;
}

function sectionTitle(label, symbol, detail = '') {
  return `<div class="store-section-title">${icon(symbol)}<h3>${escape(label)}</h3>${detail ? `<small>${escape(detail)}</small>` : ''}</div>`;
}

function renderExpansion(state, overview) {
  const eligibility = overview.expansion || getExpansionEligibility(state);
  const next = eligibility.next || overview.nextStage;
  if (!next) return `<div class="concept-note">${icon('check')}<p>Seu escritório já ocupa um <strong>andar inteiro</strong>. Use as posições restantes para decidir quais setores merecem mais espaço.</p></div>`;
  return `<article class="store-upgrade">
    <div class="store-upgrade-title">${icon('grid')}<div><small>PRÓXIMO ENDEREÇO</small><h3>${escape(next.name)}</h3></div><span class="tag">+${next.slots - overview.maxSlots} posições</span></div>
    <p>${escape(next.description)}</p>
    <div class="store-facts"><span>${icon('grid')}${next.slots} posições no total</span><span>${icon('chair')}Até ${next.maxPosts} postos</span><span>${icon('wallet')}${money(next.dailyRent)} / dia de aluguel base</span></div>
    <div class="store-purchase">${price(eligibility.price ?? next.price, 'mudança de endereço')}<button class="primary-button compact" data-office-expand ${eligibility.ok ? '' : 'disabled'}>${icon('arrow')} Ampliar escritório</button></div>
    ${eligibilityNote(eligibility)}
  </article>`;
}

function renderOverview(state, overview) {
  const stageIndex = OFFICE_STAGES.findIndex((stage) => stage.id === overview.stage.id);
  const budget = `<div class="store-metrics">
    <div class="store-metric"><span>Caixa para investir</span><strong>${money(state.cash)}</strong><small>Antes dos próximos custos</small></div>
    <div class="store-metric"><span>Custo fixo diário</span><strong>${money(overview.dailyRent)}</strong><small>Inclusive no fim de semana</small></div>
    <div class="store-metric"><span>Manutenção</span><strong>${money(overview.monthlyMaintenance)}</strong><small>Próxima: D${overview.nextMaintenanceDay}</small></div>
  </div>`;
  return `<div class="store-hero"><div class="store-stage-art">${icon(overview.stage.id === 'garage' ? 'code' : 'grid')}</div><div><span class="section-label">SEU ESCRITÓRIO HOJE</span><h3>${escape(overview.stage.name)}</h3><p>${escape(overview.stage.description)}</p></div></div>
    ${budget}
    <div class="store-space-label"><span>Espaço ocupado</span><strong>${number(overview.usedSlots)} / ${number(overview.maxSlots)} posições</strong></div>
    <div class="store-space-track ${overview.usedSlots >= overview.maxSlots ? 'full' : ''}" role="meter" aria-label="Posições ocupadas no escritório" aria-valuemin="0" aria-valuemax="${overview.maxSlots}" aria-valuenow="${overview.usedSlots}"><span style="width:${Math.min(100, overview.usedSlots / overview.maxSlots * 100)}%"></span></div>
    <div class="office-effect-strip"><span>Transmissão de ruído: ${Math.round(overview.noise * 100)}%</span><span>Sinergia da equipe: ${Math.round(overview.synergy * 100)}%</span></div>
    <div class="store-stage-path">${OFFICE_STAGES.map((stage, index) => `<div class="${index === stageIndex ? 'current' : index < stageIndex ? 'complete' : ''}"><strong>${index < stageIndex ? '✓ ' : ''}${escape(stage.name)}</strong><small>${stage.slots} posições · ${money(stage.dailyRent)}/dia</small></div>`).join('')}</div>
    ${renderExpansion(state, overview)}
    ${sectionTitle('Sua próxima contratação', 'chair', `${overview.freePosts} posto${overview.freePosts === 1 ? '' : 's'} livre${overview.freePosts === 1 ? '' : 's'}`)}
    <div class="room-summary"><h3>${overview.freePosts > 0 ? 'Há lugar para crescer' : 'Prepare um lugar na equipe'}</h3><p>Você tem <strong>${overview.capacity} posto${overview.capacity === 1 ? '' : 's'} completo${overview.capacity === 1 ? '' : 's'} para a equipe</strong>, além do posto do fundador. Cada contratação precisa de mesa, cadeira e computador. Compre a mesa, complete o posto com a cadeira e procure o candidato no RH.</p><button class="text-button" data-store-tab="workstations">Consultar postos ${icon('arrow')}</button></div>
    ${sectionTitle('Cuidar da rotina', 'sun')}
    <div class="store-items">${renderItem(state, 'lounge')}${renderItem(state, 'coffee-machine')}${renderItem(state, 'whiteboard')}</div>
    <div class="concept-note">${icon('wallet')}<p><strong>Comprar muda seus custos.</strong> O aluguel acompanha o espaço e as salas. Computadores e melhorias têm manutenção a cada 28 dias; reserve caixa para a próxima cobrança.</p></div>`;
}

function renderWorkstations(state, overview) {
  return `<p class="store-intro">Um posto completo é uma vaga real: <strong>mesa, cadeira e computador</strong>. PCs melhores aceleram apenas quem usa aquele posto e aumentam a manutenção.</p>
    <div class="store-metrics"><div class="store-metric"><span>Capacidade da equipe</span><strong>${overview.capacity}</strong><small>Além do fundador</small></div><div class="store-metric"><span>Vagas livres</span><strong>${overview.freePosts}</strong><small>Disponíveis para contratar</small></div><div class="store-metric"><span>Limite do endereço</span><strong>${overview.stage.maxPosts}</strong><small>Mesas, incluindo o fundador</small></div></div>
    <div class="store-items">${renderItem(state, 'desk')}</div>
    ${sectionTitle('Equipamento por posto', 'code', `${overview.workstations.length} mesa${overview.workstations.length === 1 ? '' : 's'}`)}
    <div class="store-posts">${overview.workstations.map((post, index) => {
      const level = post.computer || COMPUTER_LEVELS.find((entry) => entry.id === post.computerLevel);
      const computerEligibility = post.computerEligibility || getComputerEligibility(state, post.id);
      const chairEligibility = post.chairEligibility || getItemEligibility(state, 'chair', { workstationId: post.id });
      const next = computerEligibility.next;
      const name = post.occupantName || (post.employeeId === 'founder' ? state.profile.name : post.employeeId ? 'Funcionário' : 'Vaga livre');
      return `<article class="store-post"><div class="store-post-head">${icon('code')}<div><h3>Posto ${index + 1} · ${escape(name)}</h3><small>${post.chair ? 'Mesa e cadeira instaladas' : 'Falta uma cadeira para liberar a vaga'}</small></div><span class="tag">${post.employeeId ? 'Em uso' : post.chair ? 'Livre' : 'Incompleto'}</span></div>
        <div class="store-computer-tiers">${COMPUTER_LEVELS.map((tier) => `<div class="${tier.id === post.computerLevel ? 'active' : ''}"><strong>${escape(tier.name)}</strong><small>×${number(tier.multiplier)} produção<br>${monthly(tier.monthlyMaintenance)}</small></div>`).join('')}</div>
        ${!post.chair ? `<div class="store-purchase">${price(chairEligibility.price, 'completar este posto')}<button class="primary-button compact" data-office-buy="chair" data-workstation="${escape(post.id)}" ${chairEligibility.ok ? '' : 'disabled'}>${icon('chair')} Instalar cadeira</button></div>${eligibilityNote(chairEligibility)}` : ''}
        ${next ? `<div class="store-purchase">${price(computerEligibility.price ?? next.upgradePrice, `melhorar para ${next.name}`)}<button class="secondary-button compact" data-computer-upgrade="${escape(post.id)}" ${computerEligibility.ok ? '' : 'disabled'}>${icon('trend')} Melhorar PC</button></div>${eligibilityNote(computerEligibility)}` : `<p class="store-eligibility owned">${icon('check')}<span>${escape(level?.name || 'Computador')} instalado · ${monthly(level?.monthlyMaintenance || 0)} de manutenção.</span></p>`}
      </article>`;
    }).join('')}</div>
    <p class="store-note">A primeira mesa já pertence ao fundador. Uma mesa sem cadeira ocupa espaço, mas não libera contratação. O RH usa automaticamente o próximo posto completo disponível.</p>`;
}

function renderRooms(state, overview) {
  const levelNames = Object.fromEntries(ROOM_LEVELS.map((level) => [level.id, level.name]));
  const comparisons = {
    open: ['Revisões rápidas e troca de ajuda', 'Ruído do comercial e mais estresse'],
    partition: ['Metade do ruído, baixo custo', 'Menos sinergia e uma posição ocupada'],
    dedicated: ['Bônus pleno do setor e isolamento', 'Menos sinergia, mais espaço e custos'],
    glass: ['Bônus do setor e parte da sinergia', 'Investimento e manutenção maiores'],
  };
  return `<p class="store-intro">Você evolui <strong>cada setor separadamente</strong>. Isolar a produção pode reduzir bugs, mas dividir a equipe também diminui a troca de ajuda.</p>
    <table class="store-room-table"><caption>Separar a equipe é uma escolha</caption><thead><tr><th scope="col">Formato</th><th scope="col">Ganho</th><th scope="col">Troca</th></tr></thead><tbody>${ROOM_LEVELS.map((level) => `<tr><td>${escape(level.name)}</td><td>${escape(comparisons[level.id]?.[0] || level.description)}</td><td>${escape(comparisons[level.id]?.[1] || '')}</td></tr>`).join('')}</tbody></table>
    ${sectionTitle('Setores do escritório', 'grid')}
    ${OFFICE_SECTORS.map((sector) => {
      const room = overview.rooms.find((entry) => entry.id === sector.id);
      const current = room?.level || ROOM_LEVELS.find((entry) => entry.id === state.office.rooms[sector.id]);
      const eligibility = room?.eligibility || getRoomEligibility(state, sector.id);
      const next = eligibility.next;
      const currentFacts = facts(current);
      return `<article class="store-room"><div class="store-room-head">${icon(SECTOR_ICONS[sector.id] || 'grid')}<h3>${escape(sector.name)}</h3><span class="tag">${escape(current?.name || levelNames.open)}</span></div><p>${escape(sector.description)}</p>${currentFacts}
        ${next ? `<div class="store-room-tradeoff"><div><strong>PRÓXIMO: ${escape(next.name).toUpperCase()}</strong>${escape(next.description)}</div><div class="cost"><strong>PARA MANTER ESTA SALA</strong>${countLabel(next.slots, 'posição')} · ${monthly(next.monthlyMaintenance)}<br>${money(next.dailyRent)} / dia de aluguel adicional</div></div><div class="store-purchase">${price(eligibility.price ?? next.price, 'construção do próximo nível')}<button class="primary-button compact" data-room-upgrade="${escape(sector.id)}" ${eligibility.ok ? '' : 'disabled'}>${icon('plus')} Construir ${escape(next.name).toLowerCase()}</button></div>${eligibilityNote(eligibility)}` : '<p class="store-eligibility owned">' + icon('check') + '<span>Este setor já chegou ao último nível.</span></p>'}
      </article>`;
    }).join('')}
    ${sectionTitle('Salas com ações próprias', 'people')}
    <div class="store-items">${renderItem(state, 'meeting')}${renderItem(state, 'ceo')}</div>
    <p class="store-note">As paredes aparecem no mapa ao construir. Cada endereço tem posições definidas; nenhuma sala pode ultrapassar o espaço disponível. Novas ações são consultadas caminhando até a sala construída.</p>`;
}

function renderAppearance(state) {
  const bannerOwned = Boolean(state.office.amenities.banner);
  const color = /^#[0-9a-f]{6}$/i.test(state.office.banner.color) ? state.office.banner.color : '#d7ed8d';
  return `<p class="store-intro">Deixe a empresa com a sua cara. Piso e decoração melhoram um pouco a moral; o banner ajuda a empresa a ser lembrada e atrair contatos.</p>
    ${sectionTitle('Ambiente e identidade', 'plant')}
    <div class="store-items">${renderItem(state, 'floor')}${renderItem(state, 'decor')}${renderItem(state, 'banner')}</div>
    ${bannerOwned ? `<div class="store-banner-preview" style="--banner-color:${escape(color)}"><span>${escape(state.office.banner.text || state.profile.company)}</span></div><form id="banner-form" class="store-banner-form"><h3>Personalizar o banner</h3><p class="store-intro">O texto e a cor aparecem na parede do escritório. Personalizar um banner já instalado é gratuito.</p><div class="store-banner-fields"><label>Texto do banner<input name="bannerText" maxlength="40" required value="${escape(state.office.banner.text || state.profile.company)}" placeholder="Nome ou lema da empresa" autocomplete="off"></label><label>Cor<input name="bannerColor" type="color" value="${escape(color)}" aria-label="Cor do banner"></label></div><button class="primary-button" type="submit">${icon('check')} Aplicar identidade</button></form>` : `<div class="concept-note">${icon('star')}<p>Instale o banner para escolher um texto de até <strong>40 caracteres</strong> e uma cor. Ele aparece na parede e passa a trabalhar pela reputação da empresa.</p></div>`}`;
}

/** Pure view for the furniture terminal; every mutation is handled by main.js. */
export function renderOfficeStore(state, tab = 'overview') {
  const activeTab = STORE_TABS.some(([id]) => id === tab) ? tab : 'overview';
  const overview = getOfficeOverview(state);
  const nav = `<nav class="in-world-tabs store-tabs" aria-label="Opções da loja do escritório">${STORE_TABS.map(([id, label]) => `<button data-store-tab="${id}" class="${id === activeTab ? 'active' : ''}" aria-current="${id === activeTab ? 'page' : 'false'}">${escape(label)}</button>`).join('')}</nav>`;
  const content = activeTab === 'workstations' ? renderWorkstations(state, overview)
    : activeTab === 'rooms' ? renderRooms(state, overview)
      : activeTab === 'appearance' ? renderAppearance(state) : renderOverview(state, overview);
  return `<div class="office-store"><button class="secondary-button" data-edit="open">${icon('grid')} Editar layout</button>${nav}${content}</div>`;
}
