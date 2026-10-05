const WIDTH = 920;
const HEIGHT = 540;
const WALK_SPEED = 142;
const PALETTE = {
  ink: '#29382e', wall: '#285547', wallDark: '#1c4036', wood: '#d2a572',
  woodLight: '#e1bd8c', woodDark: '#9b714e', cream: '#f2e5c8', green: '#759b64',
};

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

/** A self-contained, keyboard and pointer controlled pixel-art office. */
export class OfficeScene {
  constructor(canvas, { onInteract = () => {}, onMove = () => {} } = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.onInteract = onInteract;
    this.onMove = onMove;
    this.state = { profile: { name: 'Você', company: 'Nova empresa', avatarColor: '#e59b54' }, employees: [], furniture: [] };
    this.player = { x: 448, y: 348, facing: 'down', moving: false, step: 0 };
    this.keys = new Set();
    this.pointer = null;
    this.destination = null;
    this.pendingAction = null;
    this.hasMoved = false;
    this.time = 0;
    this.lastTime = 0;
    this.destroyed = false;
    this.hotspots = [
      { action: 'work', label: 'COMPUTADOR', x: 242, y: 291, labelX: 242, labelY: 162, range: 72 },
      { action: 'coffee', label: 'CAFÉ', x: 215, y: 350, labelX: 133, labelY: 274, range: 70 },
      { action: 'board', label: 'PROJETOS', x: 710, y: 157, labelX: 710, labelY: 31, range: 65 },
      { action: 'finance', label: 'FINANCEIRO', x: 692, y: 307, labelX: 692, labelY: 185, range: 68 },
      { action: 'rest', label: 'DESCANSAR', x: 695, y: 450, labelX: 714, labelY: 341, range: 66 },
    ];
    this.obstacles = [
      { x: 169, y: 192, w: 149, h: 78 },
      { x: 374, y: 182, w: 156, h: 73 },
      { x: 604, y: 224, w: 173, h: 68 },
      { x: 90, y: 295, w: 88, h: 102 },
      { x: 618, y: 364, w: 189, h: 66 },
      { x: 86, y: 148, w: 54, h: 52 },
      { x: 797, y: 147, w: 38, h: 59 },
    ];
    this.baseObstacles = this.obstacles.map((obstacle) => ({ ...obstacle }));
    this.background = document.createElement('canvas');
    this.background.width = WIDTH;
    this.background.height = HEIGHT;
    this.renderBackground();
    this.handleKeyDown = this.handleKeyDown.bind(this);
    this.handleKeyUp = this.handleKeyUp.bind(this);
    this.handlePointerMove = this.handlePointerMove.bind(this);
    this.handlePointerDown = this.handlePointerDown.bind(this);
    this.handlePointerLeave = () => { this.pointer = null; };
    this.handleBlur = () => { this.keys.clear(); this.player.moving = false; };
    this.frame = this.frame.bind(this);
    window.addEventListener('keydown', this.handleKeyDown);
    window.addEventListener('keyup', this.handleKeyUp);
    window.addEventListener('blur', this.handleBlur);
    canvas.addEventListener('pointermove', this.handlePointerMove);
    canvas.addEventListener('pointerdown', this.handlePointerDown);
    canvas.addEventListener('pointerleave', this.handlePointerLeave);
    this.resizeObserver = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => this.resize()) : null;
    this.resizeObserver?.observe(canvas);
    this.handleResize = () => this.resize();
    window.addEventListener('resize', this.handleResize);
    canvas.setAttribute('aria-label', 'Escritório jogável. Use WASD ou as setas para andar e E para interagir. Você também pode clicar no chão ou nas estações.');
    canvas.setAttribute('tabindex', '0');
    this.resize();
    this.raf = requestAnimationFrame(this.frame);
  }

  setState(state) {
    this.state = state || this.state;
    const previousObstacles = this.obstacles;
    this.obstacles = this.baseObstacles.map((obstacle) => ({ ...obstacle }));
    if (/mesa|desk/.test(this.ownedFurniture())) this.obstacles.push({ x: 191, y: 377, w: 142, h: 78 });
    const obstaclesChanged = previousObstacles.length !== this.obstacles.length
      || this.obstacles.some((obstacle, index) => ['x', 'y', 'w', 'h'].some((key) => obstacle[key] !== previousObstacles[index]?.[key]));
    const playerBlocked = !this.canStand(this.player.x, this.player.y);
    if (obstaclesChanged || playerBlocked) {
      this.destination = null;
      this.path = null;
      this.pendingAction = null;
    }
    if (playerBlocked) {
      const position = this.nearestWalkablePosition(this.player);
      if (position) {
        this.player.x = position.x;
        this.player.y = position.y;
        this.player.moving = false;
        this.keys.clear();
      } else this.resetPlayer();
    }
    this.renderBackground();
  }

  resetPlayer() {
    this.player.x = 448;
    this.player.y = 348;
    this.player.facing = 'down';
    this.player.moving = false;
    this.destination = null;
    this.path = null;
    this.pendingAction = null;
    this.keys.clear();
    this.hasMoved = false;
  }

  resize() {
    const rect = this.canvas.getBoundingClientRect();
    this.cssWidth = Math.max(1, rect.width);
    this.cssHeight = Math.max(1, rect.height || 430);
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = Math.round(this.cssWidth * dpr);
    this.canvas.height = Math.round(this.cssHeight * dpr);
    this.dpr = dpr;
    this.scale = Math.min(this.cssWidth / WIDTH, this.cssHeight / HEIGHT);
    this.offsetX = (this.cssWidth - WIDTH * this.scale) / 2;
    this.offsetY = (this.cssHeight - HEIGHT * this.scale) / 2;
    this.draw();
  }

  destroy() {
    this.destroyed = true;
    cancelAnimationFrame(this.raf);
    window.removeEventListener('keydown', this.handleKeyDown);
    window.removeEventListener('keyup', this.handleKeyUp);
    window.removeEventListener('blur', this.handleBlur);
    window.removeEventListener('resize', this.handleResize);
    this.canvas.removeEventListener('pointermove', this.handlePointerMove);
    this.canvas.removeEventListener('pointerdown', this.handlePointerDown);
    this.canvas.removeEventListener('pointerleave', this.handlePointerLeave);
    this.resizeObserver?.disconnect();
  }

  blockedInput(event) {
    const target = event?.target || document.activeElement;
    if (this.canvas.closest?.('[hidden]')) return true;
    if (target?.isContentEditable || target?.closest?.('input, textarea, select, [contenteditable]:not([contenteditable="false"]), [role="textbox"]')) return true;
    const overlays = document.querySelectorAll('.modal-overlay');
    return [...overlays].some((overlay) => !overlay.hidden && overlay.getAttribute('aria-hidden') !== 'true' && getComputedStyle(overlay).display !== 'none');
  }

  handleKeyDown(event) {
    if (this.blockedInput(event)) return;
    const key = event.key.toLowerCase();
    if (['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(key)) {
      event.preventDefault();
      this.keys.add(key);
      this.destination = null;
      this.pendingAction = null;
    }
    if (key === 'e' && !event.repeat) {
      event.preventDefault();
      const hotspot = this.nearestHotspot();
      if (hotspot) this.onInteract(hotspot.action);
    }
  }

  handleKeyUp(event) {
    this.keys.delete(event.key.toLowerCase());
  }

  pointerPosition(event) {
    const rect = this.canvas.getBoundingClientRect();
    return { x: (event.clientX - rect.left - this.offsetX) / this.scale, y: (event.clientY - rect.top - this.offsetY) / this.scale };
  }

  handlePointerMove(event) {
    this.pointer = this.pointerPosition(event);
    this.canvas.style.cursor = this.hotspotAt(this.pointer) ? 'pointer' : 'crosshair';
  }

  hotspotAt(point) {
    return this.hotspots.find((spot) =>
      (Math.abs(point.x - spot.labelX) < 70 && Math.abs(point.y - spot.labelY) < 15)
      || distance(point, spot) < 33
      || (spot.action === 'work' && point.x > 170 && point.x < 318 && point.y > 185 && point.y < 270)
      || (spot.action === 'coffee' && point.x > 90 && point.x < 175 && point.y > 292 && point.y < 397)
      || (spot.action === 'board' && point.x > 642 && point.x < 781 && point.y > 50 && point.y < 127)
      || (spot.action === 'finance' && point.x > 604 && point.x < 777 && point.y > 222 && point.y < 292)
      || (spot.action === 'rest' && point.x > 620 && point.x < 805 && point.y > 365 && point.y < 430));
  }

  handlePointerDown(event) {
    if (this.blockedInput(event)) return;
    this.canvas.focus({ preventScroll: true });
    const point = this.pointerPosition(event);
    const hotspot = this.hotspotAt(point);
    if (hotspot && distance(this.player, hotspot) <= hotspot.range) {
      this.onInteract(hotspot.action);
      return;
    }
    const target = hotspot ? { x: hotspot.x, y: hotspot.y } : { x: clamp(point.x, 99, 827), y: clamp(point.y, 151, 474) };
    if (!this.canStand(target.x, target.y)) return;
    this.destination = target;
    this.pendingAction = hotspot?.action || null;
    this.keys.clear();
    this.path = this.findPath(this.player, target);
  }

  nearestHotspot() {
    return this.hotspots.filter((spot) => distance(this.player, spot) <= spot.range).sort((a, b) => distance(this.player, a) - distance(this.player, b))[0];
  }

  canStand(x, y) {
    if (x < 98 || x > 827 || y < 151 || y > 475) return false;
    return !this.obstacles.some((o) => x > o.x - 11 && x < o.x + o.w + 11 && y > o.y - 4 && y < o.y + o.h + 5);
  }

  nearestWalkablePosition(position) {
    const step = 8;
    for (let ring = 1; ring <= 50; ring++) {
      let nearest = null;
      let nearestDistance = Infinity;
      for (let offset = -ring; offset <= ring; offset++) {
        for (const [dx, dy] of [[offset, -ring], [offset, ring], [-ring, offset], [ring, offset]]) {
          const candidate = { x: position.x + dx * step, y: position.y + dy * step };
          const candidateDistance = dx * dx + dy * dy;
          if (candidateDistance < nearestDistance && this.canStand(candidate.x, candidate.y)) {
            nearest = candidate;
            nearestDistance = candidateDistance;
          }
        }
      }
      if (nearest) return nearest;
    }
    return null;
  }

  // A small grid routes pointer movement around desks instead of stopping at furniture.
  findPath(start, end) {
    const unit = 15;
    const cols = 50;
    const rows = 23;
    const origin = { x: 98, y: 151 };
    const cell = (point) => ({ x: clamp(Math.round((point.x - origin.x) / unit), 0, cols - 1), y: clamp(Math.round((point.y - origin.y) / unit), 0, rows - 1) });
    const key = (p) => p.y * cols + p.x;
    const world = (p) => ({ x: origin.x + p.x * unit, y: origin.y + p.y * unit });
    const a = cell(start), b = cell(end);
    const open = [a];
    const cameFrom = new Map();
    const costs = new Map([[key(a), 0]]);
    const visited = new Set();
    let found = null;
    while (open.length) {
      open.sort((p, q) => (costs.get(key(p)) + Math.hypot(p.x - b.x, p.y - b.y)) - (costs.get(key(q)) + Math.hypot(q.x - b.x, q.y - b.y)));
      const current = open.shift();
      if (current.x === b.x && current.y === b.y) { found = current; break; }
      visited.add(key(current));
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) {
        const next = { x: current.x + dx, y: current.y + dy };
        const position = world(next);
        if (next.x < 0 || next.x >= cols || next.y < 0 || next.y >= rows || visited.has(key(next)) || !this.canStand(position.x, position.y)) continue;
        if (dx && dy && (!this.canStand(world(current).x + dx * unit, world(current).y) || !this.canStand(world(current).x, world(current).y + dy * unit))) continue;
        const cost = costs.get(key(current)) + Math.hypot(dx, dy);
        if (cost < (costs.get(key(next)) ?? Infinity)) {
          cameFrom.set(key(next), current);
          costs.set(key(next), cost);
          open.push(next);
        }
      }
    }
    if (!found) return [end];
    const result = [end];
    while (key(found) !== key(a)) {
      result.unshift(world(found));
      found = cameFrom.get(key(found));
    }
    return result;
  }

  frame(timestamp) {
    if (this.destroyed) return;
    const dt = Math.min((timestamp - (this.lastTime || timestamp)) / 1000, 0.045);
    this.lastTime = timestamp;
    this.time += dt;
    this.update(dt);
    this.draw();
    this.raf = requestAnimationFrame(this.frame);
  }

  update(dt) {
    if (this.blockedInput()) {
      this.keys.clear();
      this.player.moving = false;
      return;
    }
    let dx = (this.keys.has('d') || this.keys.has('arrowright') ? 1 : 0) - (this.keys.has('a') || this.keys.has('arrowleft') ? 1 : 0);
    let dy = (this.keys.has('s') || this.keys.has('arrowdown') ? 1 : 0) - (this.keys.has('w') || this.keys.has('arrowup') ? 1 : 0);
    if (!dx && !dy && this.destination) {
      let target = this.path?.[0] || this.destination;
      if (distance(this.player, target) < 5) {
        this.path?.shift();
        target = this.path?.[0] || this.destination;
      }
      if (distance(this.player, this.destination) < 6) {
        this.destination = null;
        this.player.moving = false;
        const action = this.pendingAction;
        this.pendingAction = null;
        if (action) this.onInteract(action);
        return;
      }
      dx = target.x - this.player.x;
      dy = target.y - this.player.y;
    }
    const magnitude = Math.hypot(dx, dy);
    this.player.moving = magnitude > 0;
    if (magnitude) {
      const previous = { x: this.player.x, y: this.player.y };
      const step = Math.min(WALK_SPEED * dt, magnitude > 2 ? magnitude : Infinity);
      dx = dx / magnitude * step;
      dy = dy / magnitude * step;
      if (this.canStand(this.player.x + dx, this.player.y)) this.player.x += dx;
      if (this.canStand(this.player.x, this.player.y + dy)) this.player.y += dy;
      this.player.facing = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up');
      this.player.step += dt * 12;
      if (!this.hasMoved && distance(previous, this.player) > 0.1) {
        this.hasMoved = true;
        this.onMove({ x: this.player.x, y: this.player.y });
      }
    }
  }

  rect(ctx, x, y, w, h, color) {
    ctx.fillStyle = color;
    ctx.fillRect(Math.round(x), Math.round(y), w, h);
  }

  polygon(ctx, points, color) {
    ctx.fillStyle = color;
    ctx.beginPath();
    points.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y));
    ctx.closePath();
    ctx.fill();
  }

  ellipse(ctx, x, y, rx, ry, color) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  renderBackground() {
    const c = this.background.getContext('2d');
    c.clearRect(0, 0, WIDTH, HEIGHT);
    // Subtle studio backdrop and the elevated room platform.
    const gradient = c.createRadialGradient(455, 260, 70, 460, 290, 600);
    gradient.addColorStop(0, '#243e35');
    gradient.addColorStop(1, '#14271f');
    c.fillStyle = gradient;
    c.fillRect(0, 0, WIDTH, HEIGHT);
    this.ellipse(c, 464, 490, 400, 30, '#10231c');
    this.rect(c, 77, 135, 774, 365, '#725943');
    this.rect(c, 84, 138, 759, 352, '#ebce9f');
    this.rect(c, 84, 482, 759, 9, '#b28960');
    this.rect(c, 84, 491, 759, 7, '#614e39');
    // Staggered oak planks.
    for (let row = 0; row < 13; row++) {
      const y = 139 + row * 27;
      const colors = ['#dfbb88', '#e4c293', '#dbb580', '#e8c99a'];
      this.rect(c, 85, y, 756, 26, colors[row % colors.length]);
      this.rect(c, 85, y + 25, 756, 1, '#cda679');
      for (let x = 86 + (row % 2 ? 53 : 145); x < 840; x += 190) {
        this.rect(c, x, y + 1, 1, 24, '#c5a075');
        this.rect(c, x + 9, y + 8, 44, 1, '#d6ad7c');
        this.rect(c, x + 85, y + 18, 28, 1, '#d2aa79');
      }
    }
    // Green walls and warm wooden trim.
    this.rect(c, 79, 30, 768, 108, PALETTE.wall);
    this.rect(c, 79, 30, 768, 5, '#59816a');
    this.rect(c, 79, 122, 768, 13, '#214439');
    this.rect(c, 83, 133, 760, 5, '#ae855a');
    this.polygon(c, [[49, 54], [79, 30], [79, 482], [49, 501]], '#1d4437');
    this.rect(c, 75, 36, 7, 449, '#376453');
    this.polygon(c, [[49, 490], [79, 473], [79, 486], [49, 505]], '#836746');
    for (let x = 90; x < 839; x += 42) this.rect(c, x, 39, 1, 79, '#315d4d');
    this.drawWindow(c, 122, 49, 179, 73);
    this.drawWindow(c, 357, 49, 177, 73);
    // Warm afternoon light falls across the floor.
    c.save();
    c.globalAlpha = 0.1;
    this.polygon(c, [[127, 138], [207, 138], [425, 467], [330, 467]], '#fff9ca');
    this.polygon(c, [[248, 138], [286, 138], [515, 463], [462, 463]], '#fff9ca');
    this.polygon(c, [[361, 138], [516, 138], [800, 467], [605, 467]], '#fff9ca');
    c.restore();
    // Framed abstract art, clock, and project board.
    this.rect(c, 564, 55, 43, 52, '#17372d');
    this.rect(c, 567, 54, 37, 48, '#d9af74');
    this.rect(c, 571, 58, 29, 40, '#f3e5bc');
    this.rect(c, 575, 65, 20, 13, '#b97452');
    this.polygon(c, [[574, 94], [585, 76], [596, 94]], '#809b72');
    this.ellipse(c, 821, 67, 17, 17, '#163c31');
    this.ellipse(c, 820, 65, 15, 15, '#e9dfc1');
    this.rect(c, 819, 54, 2, 12, '#3e5647');
    this.rect(c, 820, 64, 8, 2, '#3e5647');
    this.drawBoard(c);
    // An inviting woven rug leaves a clear path through the room.
    this.rect(c, 324, 291, 248, 169, '#c39a72');
    this.rect(c, 328, 294, 240, 160, '#bc785a');
    this.rect(c, 337, 301, 222, 146, '#d4976e');
    this.rect(c, 343, 307, 210, 134, '#c5805e');
    for (let x = 338; x < 559; x += 10) {
      this.rect(c, x, 296, 5, 3, '#ead3a8');
      this.rect(c, x, 449, 5, 3, '#ead3a8');
    }
    for (let y = 314; y < 435; y += 8) this.rect(c, 348, y, 199, 1, '#c98a64');
    this.polygon(c, [[440, 333], [488, 371], [440, 410], [393, 371]], '#d59b72');
    this.polygon(c, [[440, 348], [469, 371], [440, 394], [412, 371]], '#bf7756');
    this.rect(c, 439, 351, 3, 40, '#e9bf8b');
    this.rect(c, 419, 370, 44, 3, '#e9bf8b');
    // Tiny entry mat and a discreet plant stand.
    this.rect(c, 438, 461, 89, 24, '#43604a');
    this.rect(c, 443, 465, 79, 16, '#647c57');
    c.fillStyle = '#d8dbb1';
    c.font = 'bold 8px monospace';
    c.textAlign = 'center';
    c.fillText('BEM-VINDO', 482, 476);
  }

  drawWindow(c, x, y, w, h) {
    this.rect(c, x - 5, y - 5, w + 10, h + 12, '#143b30');
    this.rect(c, x - 3, y - 3, w + 6, h + 6, '#caad79');
    this.rect(c, x, y, w, h, '#aecbcc');
    this.rect(c, x, y + 30, w, h - 30, '#d7ded0');
    this.rect(c, x, y + 54, w, h - 54, '#a5ba88');
    c.save();
    c.beginPath();
    c.rect(x, y, w, h);
    c.clip();
    for (const [tx, ty, s] of [[x + 19, y + 26, 1], [x + 78, y + 43, 0.8], [x + 151, y + 23, 1.2]]) {
      this.rect(c, tx - 3, ty + 9, 6, 51, '#75856a');
      this.ellipse(c, tx, ty, 24 * s, 18 * s, '#7ea07a');
      this.ellipse(c, tx - 14, ty + 14, 22 * s, 18 * s, '#8cac7d');
      this.ellipse(c, tx + 14, ty + 10, 20 * s, 18 * s, '#688b69');
      this.rect(c, tx - 11, ty - 8, 11, 6, '#a1bc8a');
    }
    c.restore();
    this.rect(c, x + w / 2 - 3, y, 6, h, '#ecd7ab');
    this.rect(c, x, y + 29, w, 5, '#e8d1a4');
    this.rect(c, x - 6, y + h, w + 12, 8, '#e1c28f');
    this.rect(c, x - 6, y + h + 7, w + 12, 3, '#83674a');
    this.rect(c, x + 6, y + 5, 8, 17, '#d4e6df');
    this.rect(c, x + 17, y + 5, 4, 9, '#d4e6df');
  }

  drawBoard(c) {
    this.rect(c, 641, 50, 143, 80, '#163a30');
    this.rect(c, 638, 46, 144, 78, '#bd9867');
    this.rect(c, 643, 51, 134, 68, '#eee3c6');
    c.font = 'bold 7px monospace';
    c.fillStyle = '#64705c';
    c.textAlign = 'left';
    ['IDEIAS', 'FAZENDO', 'PRONTO'].forEach((label, index) => {
      const x = 649 + index * 43;
      c.fillText(label, x, 64);
      this.rect(c, x + 36, 69, 1, 41, '#d5ceb5');
    });
    [[650, 72, '#e4b974'], [650, 94, '#adbd8b'], [693, 72, '#e0a18b'], [693, 94, '#e1b573'], [736, 72, '#a9b99d']].forEach(([x, y, color]) => {
      this.rect(c, x + 1, y + 2, 29, 17, '#d0c4a7');
      this.rect(c, x, y, 29, 17, color);
      this.rect(c, x + 5, y + 6, 16, 1, '#897c65');
      this.rect(c, x + 5, y + 10, 12, 1, '#897c65');
    });
    if (/whiteboard|quadro/.test(this.ownedFurniture())) {
      this.rect(c, 736, 94, 29, 17, '#a4bcb3');
      this.rect(c, 741, 100, 18, 2, '#607c6a');
      this.rect(c, 742, 105, 11, 1, '#607c6a');
      this.rect(c, 676, 83, 8, 2, '#789576');
      this.polygon(c, [[683, 80], [687, 84], [683, 88]], '#789576');
      this.rect(c, 719, 83, 8, 2, '#789576');
      this.polygon(c, [[726, 80], [730, 84], [726, 88]], '#789576');
    }
  }

  drawDesk(c, x, y, w, kind = 'work') {
    this.ellipse(c, x + w / 2, y + 74, w / 2 + 6, 13, '#b5966c');
    this.rect(c, x + 8, y + 47, 9, 31, '#7b6047');
    this.rect(c, x + w - 18, y + 47, 9, 31, '#7b6047');
    this.rect(c, x + 7, y + 52, w - 15, 13, '#c19461');
    this.rect(c, x, y + 12, w, 43, '#8f6b47');
    this.rect(c, x - 2, y, w + 4, 49, '#e4bc80');
    this.rect(c, x + 2, y + 3, w - 4, 42, '#d5a86c');
    this.rect(c, x, y + 43, w, 6, '#bc8c54');
    this.rect(c, x + 5, y + 8, w - 10, 1, '#e6c394');
    // Desk mat, thin monitor, screen full of tiny lines of code.
    this.rect(c, x + 24, y + 14, 81, 29, '#62786a');
    this.rect(c, x + 51, y + 7, 24, 5, '#314d3e');
    this.rect(c, x + 60, y - 4, 6, 15, '#254536');
    this.rect(c, x + 29, y - 41, 73, 44, '#17362b');
    this.rect(c, x + 33, y - 37, 65, 35, kind === 'finance' ? '#1d3f3a' : '#20384a');
    this.rect(c, x + 34, y - 37, 63, 4, '#374f58');
    this.rect(c, x + 38, y - 36, 2, 2, '#de9b70');
    this.rect(c, x + 42, y - 36, 2, 2, '#dbc17d');
    this.rect(c, x + 46, y - 36, 2, 2, '#82b590');
    if (kind === 'finance') {
      [9, 17, 13, 24, 21].forEach((height, index) => this.rect(c, x + 40 + index * 10, y - 5 - height, 6, height, ['#83b896', '#dab878'][index % 2]));
      this.rect(c, x + 38, y - 5, 55, 1, '#50665c');
    } else {
      for (let line = 0; line < 7; line++) {
        this.rect(c, x + 37, y - 29 + line * 4, 3, 1, '#566d7c');
        const indent = line % 3 * 3;
        this.rect(c, x + 44 + indent, y - 29 + line * 4, 12 + line % 3 * 4, 2, ['#94b798', '#cfb581', '#8da6c5'][line % 3]);
        if (line % 2 === 0) this.rect(c, x + 66 + indent, y - 29 + line * 4, 13, 2, '#b896b2');
      }
    }
    this.rect(c, x + 38, y + 23, 53, 12, '#dbcbb0');
    this.rect(c, x + 41, y + 25, 47, 2, '#9e9b85');
    this.rect(c, x + 41, y + 29, 47, 2, '#9e9b85');
    this.rect(c, x + 51, y + 33, 26, 1, '#9e9b85');
    this.rect(c, x + 97, y + 27, 6, 8, '#e1d8bb');
    // Notebook, ceramic cup and a small cable.
    this.rect(c, x + w - 39, y + 21, 23, 18, '#406652');
    this.rect(c, x + w - 37, y + 22, 20, 15, '#e9dcb8');
    this.rect(c, x + w - 29, y + 20, 2, 20, '#c78059');
    this.ellipse(c, x + 17, y + 22, 9, 4, '#bf8f5d');
    this.rect(c, x + 10, y + 12, 10, 10, '#e5ddc0');
    this.rect(c, x + 19, y + 14, 4, 6, '#e5ddc0');
    this.rect(c, x + 20, y + 16, 2, 2, '#c1996e');
    this.ellipse(c, x + 15, y + 12, 5, 2, '#665045');
  }

  drawChair(c, x, y, color = '#3f6a57') {
    this.ellipse(c, x, y + 12, 20, 7, '#b1936e');
    this.rect(c, x - 2, y - 1, 4, 18, '#3c5545');
    this.rect(c, x - 17, y + 13, 35, 4, '#3d5141');
    this.rect(c, x - 18, y + 15, 6, 5, '#2a4539');
    this.rect(c, x + 13, y + 15, 6, 5, '#2a4539');
    this.rect(c, x - 19, y - 13, 38, 18, '#254736');
    this.rect(c, x - 16, y - 17, 32, 19, color);
    this.rect(c, x - 13, y - 16, 26, 3, '#628370');
    this.rect(c, x - 16, y - 35, 32, 21, '#2c5140');
    this.rect(c, x - 13, y - 34, 26, 19, color);
    this.rect(c, x - 20, y - 13, 5, 3, '#2b4838');
    this.rect(c, x + 15, y - 13, 5, 3, '#2b4838');
  }

  drawCoffee(c) {
    const x = 93, y = 301;
    this.ellipse(c, 135, 399, 51, 10, '#b3946a');
    this.rect(c, x, y, 81, 91, '#bd9365');
    this.rect(c, x + 4, y + 21, 73, 67, '#e2cc9d');
    this.rect(c, x + 39, y + 25, 2, 60, '#bfa47a');
    this.rect(c, x + 30, y + 39, 4, 16, '#786e4e');
    this.rect(c, x + 47, y + 39, 4, 16, '#786e4e');
    this.rect(c, x - 4, y - 5, 89, 23, '#7a8168');
    this.rect(c, x - 4, y - 5, 89, 5, '#a7ab89');
    this.rect(c, x + 9, y - 41, 35, 39, '#223e32');
    this.rect(c, x + 13, y - 38, 27, 13, '#596d5b');
    this.rect(c, x + 17, y - 34, 18, 4, '#b7c49a');
    this.rect(c, x + 16, y - 23, 21, 15, '#152e25');
    this.rect(c, x + 24, y - 20, 5, 6, '#aeb3a0');
    this.rect(c, x + 21, y - 12, 10, 9, '#ead9b3');
    this.rect(c, x + 18, y - 3, 19, 3, '#8c9a79');
    this.rect(c, x + 49, y - 19, 20, 17, '#e7d5b0');
    this.ellipse(c, x + 59, y - 19, 10, 4, '#f0e3bf');
    this.rect(c, x + 68, y - 15, 6, 8, '#dccba5');
    this.rect(c, x + 53, y - 25, 11, 5, '#aeb49a');
    this.rect(c, x + 49, y + 5, 26, 7, '#c18b5e');
    if (/coffee-machine|cafeteira/.test(this.ownedFurniture())) {
      this.rect(c, x + 6, y - 45, 41, 43, '#b5baaa');
      this.rect(c, x + 9, y - 42, 35, 14, '#718477');
      this.rect(c, x + 13, y - 39, 18, 7, '#c6d9a8');
      this.rect(c, x + 36, y - 39, 4, 4, '#f1d787');
      this.rect(c, x + 11, y - 26, 32, 20, '#2e4437');
      this.rect(c, x + 18, y - 23, 15, 3, '#b6bfa9');
      this.rect(c, x + 24, y - 20, 4, 7, '#adbaac');
      this.rect(c, x + 19, y - 11, 13, 9, '#ecdfba');
      this.rect(c, x + 9, y - 2, 36, 3, '#d3d4ba');
    }
    // A little rising steam makes the office feel occupied.
    const steam = Math.sin(this.time * 2) * 2;
    c.globalAlpha = 0.4;
    this.rect(c, x + 24 + steam, y - 27, 2, 5, '#e8e1c3');
    this.rect(c, x + 27 - steam, y - 35, 2, 5, '#e8e1c3');
    c.globalAlpha = 1;
  }

  drawSofa(c) {
    this.ellipse(c, 712, 433, 103, 10, '#b49670');
    this.rect(c, 636, 414, 8, 16, '#725e42');
    this.rect(c, 784, 414, 8, 16, '#725e42');
    this.rect(c, 623, 359, 178, 65, '#30523d');
    this.rect(c, 629, 361, 166, 44, '#5b7b50');
    this.rect(c, 632, 367, 78, 30, '#79935f');
    this.rect(c, 714, 367, 78, 30, '#71915f');
    this.rect(c, 631, 393, 161, 27, '#547348');
    this.rect(c, 635, 395, 74, 19, '#809768');
    this.rect(c, 714, 395, 74, 19, '#799362');
    this.rect(c, 621, 380, 14, 43, '#527348');
    this.rect(c, 791, 380, 14, 43, '#527348');
    this.rect(c, 621, 380, 14, 5, '#8a9b68');
    this.rect(c, 791, 380, 14, 5, '#8a9b68');
    this.rect(c, 644, 374, 27, 25, '#e0bb7d');
    this.rect(c, 646, 376, 23, 20, '#e8c994');
    this.rect(c, 755, 378, 28, 22, '#bd7d58');
    this.rect(c, 757, 380, 24, 16, '#ce9670');
    for (let y = 400; y < 417; y += 5) this.rect(c, 751, y, 33, 2, '#bb8e6c');
    if (/lounge|descanso/.test(this.ownedFurniture())) {
      this.rect(c, 712, 388, 25, 33, '#d8bb8a');
      for (let y = 391; y < 421; y += 5) this.rect(c, 713, y, 23, 2, '#e9cfa2');
      this.rect(c, 811, 382, 20, 30, '#9f7c55');
      this.rect(c, 809, 377, 24, 8, '#d7b382');
      this.rect(c, 812, 373, 19, 4, '#c57d5a');
      this.rect(c, 813, 370, 18, 3, '#e6d6b4');
      this.rect(c, 817, 359, 8, 11, '#c1d3ad');
      this.ellipse(c, 821, 359, 4, 2, '#78956b');
    }
  }

  drawPlant(c, x, y, size = 1, color = '#64865a') {
    c.save();
    c.translate(x, y);
    c.scale(size, size);
    this.ellipse(c, 0, 1, 22, 6, '#b0956b');
    this.polygon(c, [[-13, -23], [13, -23], [9, 0], [-9, 0]], '#a96948');
    this.rect(c, -14, -26, 28, 7, '#c28b5c');
    this.ellipse(c, 0, -25, 11, 3, '#625942');
    this.rect(c, -2, -56, 4, 35, '#5c784a');
    this.polygon(c, [[0, -39], [-19, -57], [-26, -55], [-23, -42], [-9, -33]], color);
    this.polygon(c, [[0, -47], [11, -69], [20, -69], [20, -56], [7, -41]], '#7d9a63');
    this.polygon(c, [[0, -31], [17, -51], [28, -48], [25, -38], [9, -28]], '#547849');
    this.polygon(c, [[0, -44], [-9, -77], [-17, -80], [-20, -68], [-10, -48]], '#71905a');
    this.rect(c, 0, -57, 2, 30, '#99ac75');
    c.restore();
  }

  drawShelf(c) {
    const x = 89, y = 147;
    this.rect(c, x - 3, y - 17, 54, 69, '#344d37');
    this.rect(c, x, y - 22, 48, 70, '#b99161');
    this.rect(c, x + 4, y - 17, 40, 25, '#785f40');
    this.rect(c, x + 4, y + 14, 40, 26, '#785f40');
    const colors = ['#cc8b62', '#91a276', '#dbc493', '#688c90', '#b27666'];
    for (let index = 0; index < 5; index++) {
      this.rect(c, x + 7 + index * 7, y - 13 + index % 2 * 2, 6, 20 - index % 2 * 2, colors[index]);
      this.rect(c, x + 8 + index * 7, y - 9, 4, 1, '#dcccaa');
    }
    this.rect(c, x + 8, y + 29, 19, 7, '#b5815c');
    this.rect(c, x + 8, y + 23, 20, 6, '#cbb68f');
    this.rect(c, x + 31, y + 19, 9, 17, '#d7c8a2');
    this.rect(c, x + 2, y + 41, 45, 7, '#c59c67');
  }

  drawLamp(c) {
    this.ellipse(c, 591, 410, 17, 6, '#b39973');
    this.rect(c, 581, 405, 21, 5, '#43503c');
    this.rect(c, 589, 330, 4, 77, '#536047');
    this.polygon(c, [[577, 301], [603, 301], [613, 334], [568, 334]], '#eddaab');
    this.rect(c, 571, 332, 39, 4, '#bca476');
    this.rect(c, 587, 301, 3, 28, '#f7e8bd');
  }

  drawCharacter(c, character, color, isPlayer = false) {
    const x = Math.round(character.x), y = Math.round(character.y);
    const moving = character.moving;
    const walk = moving ? Math.sin(character.step) : 0;
    const bob = moving ? Math.round(Math.abs(Math.sin(character.step)) * 2) : 0;
    const up = character.facing === 'up';
    const side = character.facing === 'left' || character.facing === 'right';
    this.ellipse(c, x, y + 1, 15, 5, '#8e86675c');
    // Chunky shoes, trousers and a sweatshirt. Feet define collision position.
    this.rect(c, x - 10, y - 10 + walk * 2, 8, 10, '#324a4c');
    this.rect(c, x + 2, y - 10 - walk * 2, 8, 10, '#324a4c');
    this.rect(c, x - 11, y - 3 + walk * 2, 10, 4, '#263c38');
    this.rect(c, x + 2, y - 3 - walk * 2, 11, 4, '#263c38');
    this.rect(c, x - 11, y - 29 - bob, 22, 23, '#a06e4a');
    this.rect(c, x - 10, y - 29 - bob, 20, 20, color || '#d49561');
    this.rect(c, x - 13, y - 26 - bob + walk, 5, 17, color || '#d49561');
    this.rect(c, x + 8, y - 26 - bob - walk, 5, 17, color || '#d49561');
    this.rect(c, x - 13, y - 12 - bob + walk, 5, 6, '#dca774');
    this.rect(c, x + 8, y - 12 - bob - walk, 5, 6, '#dca774');
    this.rect(c, x - 3, y - 32 - bob, 6, 7, '#c99468');
    this.rect(c, x - 11, y - 50 - bob, 22, 23, '#694934');
    this.rect(c, x - 10, y - 43 - bob, 20, 16, '#e4b387');
    this.rect(c, x - 12, y - 50 - bob, 24, 12, '#4a3d30');
    this.rect(c, x - 8, y - 53 - bob, 18, 5, '#4a3d30');
    this.rect(c, x - 11, y - 42 - bob, 4, 6, '#4a3d30');
    this.rect(c, x + 8, y - 42 - bob, 3, 5, '#4a3d30');
    this.rect(c, x - 8, y - 49 - bob, 6, 2, '#63503b');
    if (up) {
      this.rect(c, x - 10, y - 46 - bob, 20, 16, '#4a3d30');
      this.rect(c, x - 5, y - 32 - bob, 10, 3, '#d49d75');
    } else {
      if (!side || character.facing === 'left') this.rect(c, x - 6, y - 37 - bob, 3, 3, '#3c4036');
      if (!side || character.facing === 'right') this.rect(c, x + 4, y - 37 - bob, 3, 3, '#3c4036');
      this.rect(c, x - 2 + (side ? (character.facing === 'right' ? 6 : -6) : 0), y - 31 - bob, 5, 1, '#a97455');
    }
    if (isPlayer) {
      this.rect(c, x - 4, y - 25 - bob, 8, 2, '#f2d7aa');
      this.rect(c, x + 4, y - 18 - bob, 4, 4, '#f0cea0');
    }
  }

  employees() {
    if (Array.isArray(this.state.employees)) return this.state.employees;
    return Array.from({ length: Number(this.state.employees) || 0 }, (_, index) => ({ name: `Pessoa ${index + 1}`, color: ['#87a77b', '#8a9db7', '#bc8aa0'][index % 3] }));
  }

  ownedFurniture() {
    return (this.state.furniture || this.state.upgrades || []).map((item) => typeof item === 'string' ? item : `${item.id || ''} ${item.name || ''}`).join(' ').toLowerCase();
  }

  draw() {
    if (!this.ctx || !this.scale) return;
    const c = this.ctx;
    c.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    c.fillStyle = '#14271f';
    c.fillRect(0, 0, this.cssWidth, this.cssHeight);
    c.translate(this.offsetX, this.offsetY);
    c.scale(this.scale, this.scale);
    c.imageSmoothingEnabled = false;
    c.drawImage(this.background, 0, 0);
    const nearby = this.nearestHotspot();
    const hovered = this.pointer ? this.hotspotAt(this.pointer) : null;
    const highlighted = hovered || nearby;
    if (highlighted) {
      c.save();
      c.globalAlpha = 0.22 + Math.sin(this.time * 3) * 0.04;
      this.ellipse(c, highlighted.x, highlighted.y, 29, 12, '#eaddab');
      c.restore();
      c.strokeStyle = '#efdfaa99';
      c.lineWidth = 1.5;
      c.beginPath();
      c.ellipse(highlighted.x, highlighted.y, 28, 11, 0, 0, Math.PI * 2);
      c.stroke();
    }
    if (this.destination) {
      c.strokeStyle = '#f0ddb79c';
      c.lineWidth = 2;
      c.beginPath();
      c.ellipse(this.destination.x, this.destination.y, 10 + Math.sin(this.time * 5) * 2, 4, 0, 0, Math.PI * 2);
      c.stroke();
      this.rect(c, this.destination.x - 1, this.destination.y - 1, 3, 3, '#f5e6be');
    }
    const employees = this.employees();
    const props = [
      { y: 200, draw: () => this.drawShelf(c) },
      { y: 210, draw: () => this.drawPlant(c, 812, 201, 1.15) },
      { y: 275, draw: () => this.drawDesk(c, 170, 194, 148) },
      { y: 259, draw: () => this.drawDesk(c, 375, 185, 155) },
      { y: 291, draw: () => this.drawChair(c, 244, 289) },
      { y: 274, draw: () => this.drawChair(c, 453, 274) },
      { y: 305, draw: () => this.drawDesk(c, 604, 226, 173, 'finance') },
      { y: 319, draw: () => this.drawChair(c, 691, 319, '#6a7066') },
      { y: 399, draw: () => this.drawCoffee(c) },
      { y: 410, draw: () => this.drawLamp(c) },
      { y: 431, draw: () => this.drawSofa(c) },
      { y: 470, draw: () => this.drawPlant(c, 821, 465, 0.95) },
      { y: 463, draw: () => this.drawPlant(c, 108, 461, 0.72) },
      { y: this.player.y, draw: () => this.drawCharacter(c, this.player, this.state.profile?.avatarColor || '#e8ac6d', true) },
    ];
    if (employees[0]) props.push({ y: 271, draw: () => this.drawCharacter(c, { x: 453, y: 273, facing: 'up' }, employees[0].color || '#8da17f') });
    if (employees[1]) props.push({ y: 313, draw: () => this.drawCharacter(c, { x: 692, y: 317, facing: 'up' }, employees[1].color || '#8a9eaf') });
    const owned = this.ownedFurniture();
    if (/planta|plant|decor/.test(owned)) props.push({ y: 185, draw: () => this.drawPlant(c, 324, 178, 0.65) });
    if (/livro|book|estante/.test(owned)) props.push({ y: 148, draw: () => { this.rect(c, 305, 132, 35, 8, '#799075'); this.rect(c, 307, 127, 32, 5, '#c19772'); } });
    if (/mesa|desk/.test(owned)) {
      props.push({ y: 457, draw: () => {
        this.drawDesk(c, 191, 377, 142);
        this.rect(c, 286, 350, 38, 28, '#324d43');
        this.rect(c, 289, 353, 32, 21, '#77998a');
        this.rect(c, 290, 377, 36, 15, '#bbbd9b');
        this.rect(c, 294, 379, 29, 7, '#878f77');
      } });
      props.push({ y: 468, draw: () => this.drawChair(c, 259, 467) });
      if (employees[2]) props.push({ y: 469, draw: () => this.drawCharacter(c, { x: 259, y: 469, facing: 'up' }, employees[2].color || '#b58a8e') });
      if (employees[3]) props.push({ y: 470, draw: () => this.drawCharacter(c, { x: 303, y: 470, facing: 'up' }, employees[3].color || '#95a67e') });
    }
    if (/computador|computer|monitor/.test(owned)) props.push({ y: 273, draw: () => { this.rect(c, 278, 172, 34, 23, '#254036'); this.rect(c, 281, 175, 28, 17, '#789d91'); this.rect(c, 294, 193, 4, 9, '#335143'); } });
    props.sort((a, b) => a.y - b.y).forEach((prop) => prop.draw());
    // Station badges remain crisp, legible and clickable at any display size.
    this.hotspots.forEach((spot) => this.drawBadge(c, spot, highlighted?.action === spot.action));
    this.drawPlayerLabel(c, nearby);
    this.drawAmbientDetails(c);
  }

  drawBadge(c, spot, active) {
    c.font = '600 9px system-ui, sans-serif';
    const width = c.measureText(spot.label).width + 24;
    const x = spot.labelX - width / 2, y = spot.labelY - 11;
    c.fillStyle = active ? '#ebd8a9' : '#183a2fe8';
    c.beginPath();
    c.roundRect(x, y, width, 23, 5);
    c.fill();
    c.strokeStyle = active ? '#f4e8c5' : '#74907566';
    c.lineWidth = 1;
    c.stroke();
    c.fillStyle = active ? '#2c4837' : '#d7dabc';
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillText(spot.label, spot.labelX, spot.labelY + 0.5);
    c.textBaseline = 'alphabetic';
  }

  drawPlayerLabel(c, nearby) {
    const { x, y } = this.player;
    const name = (this.state.profile?.name || 'Você').split(' ')[0].slice(0, 15);
    c.font = '600 10px system-ui, sans-serif';
    c.textAlign = 'center';
    const width = c.measureText(name).width + 18;
    c.fillStyle = '#17392ede';
    c.beginPath();
    c.roundRect(x - width / 2, y - 72, width, 18, 4);
    c.fill();
    c.fillStyle = '#e8e9d1';
    c.fillText(name, x, y - 59);
    if (nearby && !this.player.moving) {
      const actions = { work: 'Trabalhar', coffee: 'Tomar café', board: 'Ver projetos', finance: 'Ver finanças', rest: 'Descansar' };
      const label = actions[nearby.action];
      c.font = '500 10px system-ui, sans-serif';
      const promptWidth = c.measureText(label).width + 43;
      c.fillStyle = '#e9ddb8';
      c.beginPath();
      c.roundRect(x - promptWidth / 2, y + 13, promptWidth, 24, 5);
      c.fill();
      this.rect(c, x - promptWidth / 2 + 7, y + 17, 16, 16, '#3a5944');
      c.fillStyle = '#f0e7c8';
      c.font = 'bold 10px system-ui, sans-serif';
      c.fillText('E', x - promptWidth / 2 + 15, y + 29);
      c.fillStyle = '#3c5140';
      c.font = '600 10px system-ui, sans-serif';
      c.textAlign = 'left';
      c.fillText(label, x - promptWidth / 2 + 30, y + 29);
    }
  }

  drawAmbientDetails(c) {
    // A few drifting sunlit specks, kept restrained and outside the HUD.
    for (let index = 0; index < 9; index++) {
      const x = 181 + index * 58 + Math.sin(this.time * 0.3 + index) * 5;
      const y = 146 + (index * 43 + this.time * 5) % 240;
      c.globalAlpha = 0.25 + Math.sin(this.time + index) * 0.12;
      this.rect(c, x, y, 2, 2, '#fff0bf');
    }
    c.globalAlpha = 1;
    c.font = '500 9px system-ui, sans-serif';
    c.textAlign = 'left';
    c.fillStyle = '#9aae95';
    c.fillText('SEU PRIMEIRO ESCRITÓRIO', 84, 522);
    c.textAlign = 'right';
    c.fillStyle = '#d0d9b4';
    const company = this.state.profile?.company || this.state.profile?.companyName || 'Sua próxima grande ideia começa aqui.';
    c.fillText(company.slice(0, 45), 841, 522);
  }
}
