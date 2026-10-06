const WIDTH = 1280;
const HEIGHT = 820;
const WALK_SPEED = 185;
const SPAWN = { x: 618, y: 453 };
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const STATIONS = [
  { action: 'work', label: 'DESENVOLVIMENTO', verb: 'Sentar e trabalhar', x: 196, y: 342, labelX: 196, labelY: 190, range: 54, bounds: {x: 114, y: 195, w: 162, h: 121} },
  { action: 'board', label: 'PROJETOS', verb: 'Consultar os projetos', x: 392, y: 210, labelX: 393, labelY: 69, range: 52, bounds: {x: 309, y: 88, w: 135, h: 89} },
  { action: 'sales', label: 'COMERCIAL', verb: 'Conversar com clientes', x: 636, y: 342, labelX: 636, labelY: 190, range: 54, bounds: {x: 554, y: 197, w: 170, h: 126} },
  { action: 'finance', label: 'FINANCEIRO', verb: 'Conferir o caixa', x: 1054, y: 342, labelX: 1054, labelY: 190, range: 54, bounds: {x: 966, y: 195, w: 176, h: 126} },
  { action: 'team', label: 'PESSOAS & CULTURA', verb: 'Cuidar da equipe', x: 569, y: 607, labelX: 573, labelY: 471, range: 54, bounds: {x: 500, y: 487, w: 150, h: 111} },
  { action: 'furniture', label: 'ARQUITETURA', verb: 'Planejar o escritório', x: 780, y: 607, labelX: 779, labelY: 471, range: 52, bounds: {x: 710, y: 489, w: 136, h: 108} },
  { action: 'coffee', label: 'CAFÉ', verb: 'Preparar um café', x: 183, y: 594, labelX: 144, labelY: 445, range: 50, bounds: {x: 100, y: 442, w: 92, h: 139} },
  { action: 'rest', label: 'LOUNGE', verb: 'Fazer uma pausa', x: 332, y: 706, labelX: 339, labelY: 562, range: 56, bounds: {x: 245, y: 593, w: 192, h: 78} },
  { action: 'product', label: 'LABORATÓRIO', verb: 'Desenvolver um produto', x: 1052, y: 649, labelX: 1052, labelY: 508, range: 54, bounds: {x: 962, y: 522, w: 184, h: 117} },
  { action: 'reception', label: 'RECEPÇÃO', verb: 'Abrir o diário do fundador', x: 618, y: 730, labelX: 618, labelY: 628, range: 50, bounds: {x: 550, y: 643, w: 144, h: 66} },
  { action: 'exit', label: 'SAÍDA', verb: 'Encerrar o expediente', x: 1157, y: 733, labelX: 1157, labelY: 686, range: 47, bounds: {x: 1120, y: 700, w: 82, h: 67} },
];

/** The entire game lives in this office. All interactions require physical travel. */
export class OfficeScene {
  constructor(canvas, { onInteract = () => {}, onMove = () => {} } = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.onInteract = onInteract;
    this.onMove = onMove;
    this.state = { profile: { name: 'Você', company: 'Seu estúdio', avatarColor: '#e59b54' }, employees: [], furniture: [], energy: 100, reputation: 12, cash: 20000, projects: [], leads: [] };
    this.player = { ...SPAWN, facing: 'down', moving: false, step: 0 };
    this.hotspots = STATIONS.map((station) => ({ ...station }));
    this.keys = new Set();
    this.pointer = null;
    this.destination = null;
    this.path = null;
    this.pendingAction = null;
    this.interactionOpen = false;
    this.positionLoaded = false;
    this.time = 0;
    this.lastTime = 0;
    this.moveReportElapsed = 0;
    this.travelAccumulator = 0;
    this.zoom = 1;
    this.destroyed = false;
    this.baseObstacles = [
      {x: 115, y: 238, w: 158, h: 75}, {x: 290, y: 230, w: 130, h: 76},
      {x: 289, y: 362, w: 134, h: 76}, {x: 558, y: 239, w: 164, h: 76},
      {x: 969, y: 239, w: 170, h: 76}, {x: 103, y: 483, w: 82, h: 91},
      {x: 245, y: 599, w: 188, h: 65}, {x: 502, y: 520, w: 144, h: 76},
      {x: 715, y: 521, w: 130, h: 74}, {x: 965, y: 559, w: 175, h: 76},
      {x: 553, y: 654, w: 141, h: 54},
      {x: 452, y: 191, w: 10, h: 188}, {x: 858, y: 191, w: 10, h: 188},
      {x: 452, y: 509, w: 10, h: 207}, {x: 858, y: 510, w: 10, h: 182},
      {x: 83, y: 199, w: 22, h: 35}, {x: 1177, y: 199, w: 22, h: 35},
    ];
    this.obstacles = this.baseObstacles.map((obstacle) => ({...obstacle}));
    this.background = document.createElement('canvas');
    this.background.width = WIDTH;
    this.background.height = HEIGHT;
    this.renderBackground();
    this.handleKeyDown = this.handleKeyDown.bind(this);
    this.handleKeyUp = (event) => this.keys.delete(event.key.toLowerCase());
    this.handlePointerMove = this.handlePointerMove.bind(this);
    this.handlePointerDown = this.handlePointerDown.bind(this);
    this.handlePointerLeave = () => { this.pointer = null; };
    this.handleBlur = () => { this.keys.clear(); this.player.moving = false; this.reportMovement(true); };
    this.frame = this.frame.bind(this);
    this.handleResize = () => this.resize();
    window.addEventListener('keydown', this.handleKeyDown);
    window.addEventListener('keyup', this.handleKeyUp);
    window.addEventListener('blur', this.handleBlur);
    window.addEventListener('resize', this.handleResize);
    canvas.addEventListener('pointermove', this.handlePointerMove);
    canvas.addEventListener('pointerdown', this.handlePointerDown);
    canvas.addEventListener('pointerleave', this.handlePointerLeave);
    this.resizeObserver = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => this.resize()) : null;
    this.resizeObserver?.observe(canvas);
    canvas.setAttribute('tabindex', '0');
    canvas.setAttribute('aria-label', 'Escritório da empresa. Caminhe com WASD ou setas. Use E próximo a cada setor ou clique na estação para ir até ela.');
    this.resize();
    this.raf = requestAnimationFrame(this.frame);
  }

  setState(state) {
    if (!state) return;
    this.state = state;
    const previous = this.obstacles;
    this.obstacles = this.baseObstacles.map((obstacle) => ({...obstacle}));
    if (this.hasFurniture('desk')) this.obstacles.push({x: 115, y: 370, w: 150, h: 76});
    const changed = previous.length !== this.obstacles.length || this.obstacles.some((o, i) => ['x','y','w','h'].some((key) => o[key] !== previous[i]?.[key]));
    if (!this.positionLoaded) {
      this.positionLoaded = true;
      const position = state.officePosition;
      if (Number.isFinite(position?.x) && Number.isFinite(position?.y)
        && position.x >= 85 && position.x <= 1195 && position.y >= 195 && position.y <= 756) {
        this.player.x = position.x;
        this.player.y = position.y;
      }
    }
    const blocked = !this.canStand(this.player.x, this.player.y);
    if (changed || blocked) this.cancelRoute();
    if (blocked) {
      const nearest = this.nearestWalkablePosition(this.player);
      Object.assign(this.player, nearest || SPAWN, {moving: false});
      this.keys.clear();
    }
  }

  getStation(action) { const station = this.hotspots.find((spot) => spot.action === action); return station ? {...station} : null; }
  isNearStation(action) { const spot = this.getStation(action); return !!spot && this.canStand(this.player.x, this.player.y) && distance(this.player, spot) <= spot.range; }
  getScreenPoint(action) {
    const spot = this.getStation(action);
    if (!spot) return null;
    const x = this.offsetX + spot.x * this.scale, y = this.offsetY + spot.y * this.scale;
    return {x, y, visible: x >= 0 && x <= this.cssWidth && y >= 0 && y <= this.cssHeight};
  }
  requestInteraction(action) {
    const spot = this.getStation(action);
    if (!spot || this.blockedInput()) return false;
    if (this.isNearStation(action)) { this.activate(action); return true; }
    return this.walkTo(spot, action);
  }
  setInteractionOpen(open) {
    this.interactionOpen = !!open;
    if (open) { this.cancelRoute(); this.keys.clear(); this.player.moving = false; this.reportMovement(true); }
  }
  setZoom(value) { this.zoom = clamp(Number(value) || 1, 1, 1.6); this.resize(); }
  resetPlayer() {
    Object.assign(this.player, SPAWN, {facing:'down',moving:false,step:0});
    this.positionLoaded = true;
    this.cancelRoute(); this.keys.clear(); this.travelAccumulator = 0; this.moveReportElapsed = 0;
    this.updateCamera();
  }
  cancelRoute() { this.destination = null; this.path = null; this.pendingAction = null; }
  activate(action) {
    if (!this.isNearStation(action) || this.blockedInput()) return false;
    this.cancelRoute(); this.player.moving = false; this.reportMovement(true); this.onInteract(action); return true;
  }

  resize() {
    const rect = this.canvas.getBoundingClientRect();
    this.cssWidth = Math.max(1, rect.width);
    this.cssHeight = Math.max(1, rect.height || 720);
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = Math.round(this.cssWidth * this.dpr);
    this.canvas.height = Math.round(this.cssHeight * this.dpr);
    const fit = Math.min(this.cssWidth / WIDTH, this.cssHeight / HEIGHT);
    this.followCamera = fit < 0.58 || this.zoom > 1;
    this.scale = this.followCamera ? Math.max(fit, this.cssWidth < 600 ? 0.72 : fit) * this.zoom : fit;
    this.updateCamera(); this.draw();
  }
  updateCamera() {
    if (!this.scale) return;
    const scaledW = WIDTH * this.scale, scaledH = HEIGHT * this.scale;
    this.offsetX = scaledW <= this.cssWidth ? (this.cssWidth-scaledW)/2 : clamp(this.cssWidth/2-this.player.x*this.scale, this.cssWidth-scaledW, 0);
    this.offsetY = scaledH <= this.cssHeight ? (this.cssHeight-scaledH)/2 : clamp(this.cssHeight*.56-this.player.y*this.scale, this.cssHeight-scaledH, 0);
  }
  destroy() {
    this.destroyed = true; cancelAnimationFrame(this.raf); this.reportMovement(true);
    window.removeEventListener('keydown', this.handleKeyDown); window.removeEventListener('keyup', this.handleKeyUp);
    window.removeEventListener('blur', this.handleBlur); window.removeEventListener('resize', this.handleResize);
    this.canvas.removeEventListener('pointermove', this.handlePointerMove); this.canvas.removeEventListener('pointerdown', this.handlePointerDown);
    this.canvas.removeEventListener('pointerleave', this.handlePointerLeave); this.resizeObserver?.disconnect();
  }
  blockedInput(event) {
    if (this.interactionOpen || this.canvas.closest?.('[hidden]')) return true;
    const target = event?.target || document.activeElement;
    if (target?.isContentEditable || target?.closest?.('input,textarea,select,[contenteditable]:not([contenteditable="false"]),[role="textbox"]')) return true;
    return [...document.querySelectorAll('.modal-overlay')].some((el) => !el.hidden && el.getAttribute('aria-hidden') !== 'true' && getComputedStyle(el).display !== 'none');
  }
  handleKeyDown(event) {
    if (this.blockedInput(event)) return;
    const key = event.key.toLowerCase();
    if (['w','a','s','d','arrowup','arrowdown','arrowleft','arrowright'].includes(key)) { event.preventDefault(); this.keys.add(key); this.cancelRoute(); }
    if (key === 'e' && !event.repeat) { event.preventDefault(); const spot = this.nearestHotspot(); if (spot) this.activate(spot.action); }
  }
  pointerPosition(event) { const rect = this.canvas.getBoundingClientRect(); return {x:(event.clientX-rect.left-this.offsetX)/this.scale,y:(event.clientY-rect.top-this.offsetY)/this.scale}; }
  handlePointerMove(event) { this.pointer = this.pointerPosition(event); this.canvas.style.cursor = this.hotspotAt(this.pointer) ? 'pointer' : 'crosshair'; }
  hotspotAt(point) {
    return this.hotspots.find((spot) => (Math.abs(point.x-spot.labelX) < Math.max(62,spot.label.length*4.5) && Math.abs(point.y-spot.labelY) < 15)
      || distance(point,spot)<28 || (point.x>=spot.bounds.x && point.x<=spot.bounds.x+spot.bounds.w && point.y>=spot.bounds.y && point.y<=spot.bounds.y+spot.bounds.h));
  }
  handlePointerDown(event) {
    if (this.blockedInput(event)) return;
    this.canvas.focus({preventScroll:true});
    const point = this.pointerPosition(event), station = this.hotspotAt(point);
    if (station) { this.requestInteraction(station.action); return; }
    const target = {x:clamp(point.x,85,1195),y:clamp(point.y,195,756)};
    if (this.canStand(target.x,target.y)) this.walkTo(target);
  }
  walkTo(target, action = null) {
    if (!this.canStand(target.x,target.y)) return false;
    const path = this.findPath(this.player,target);
    if (!path) return false;
    this.keys.clear(); this.destination = {x:target.x,y:target.y}; this.path = path; this.pendingAction = action; return true;
  }
  nearestHotspot() { return this.hotspots.filter((spot) => this.isNearStation(spot.action)).sort((a,b) => distance(this.player,a)-distance(this.player,b))[0]; }
  canStand(x,y) {
    const epsilon = 1e-6;
    return Number.isFinite(x) && Number.isFinite(y) && x>=85 && x<=1195 && y>=195 && y<=756
      && !this.obstacles.some((o) => x>o.x-11+epsilon && x<o.x+o.w+11-epsilon && y>o.y-4+epsilon && y<o.y+o.h+5-epsilon);
  }
  canTravelSegment(start,end) {
    for(let step=1;step<=4;step++) {
      if(!this.canStand(start.x+(end.x-start.x)*step/4,start.y+(end.y-start.y)*step/4)) return false;
    }
    return true;
  }
  nearestWalkablePosition(position) {
    for (let ring=1;ring<=100;ring++) {
      let result=null, best=Infinity;
      for (let offset=-ring;offset<=ring;offset++) for (const [dx,dy] of [[offset,-ring],[offset,ring],[-ring,offset],[ring,offset]]) {
        const p={x:position.x+dx*8,y:position.y+dy*8}, d=dx*dx+dy*dy;
        if (d<best && this.canStand(p.x,p.y)) {result=p;best=d;}
      }
      if(result) return result;
    }
    return null;
  }
  findPath(start,end) {
    const unit=14, cols=81, rows=41, origin={x:85,y:195};
    const cell=(p)=>({x:clamp(Math.round((p.x-origin.x)/unit),0,cols-1),y:clamp(Math.round((p.y-origin.y)/unit),0,rows-1)});
    const key=(p)=>p.y*cols+p.x, world=(p)=>({x:origin.x+p.x*unit,y:origin.y+p.y*unit});
    const a=cell(start), b=cell(end), open=[a], costs=new Map([[key(a),0]]), parents=new Map(), visited=new Set();
    let found=null;
    while(open.length) {
      open.sort((p,q)=>(costs.get(key(p))+Math.hypot(p.x-b.x,p.y-b.y))-(costs.get(key(q))+Math.hypot(q.x-b.x,q.y-b.y)));
      const current=open.shift(); if(visited.has(key(current))) continue;
      if(current.x===b.x && current.y===b.y) {found=current;break;}
      visited.add(key(current));
      for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]]) {
        const next={x:current.x+dx,y:current.y+dy}, position=world(next), here=world(current);
        if(next.x<0 || next.x>=cols || next.y<0 || next.y>=rows || visited.has(key(next)) || !this.canStand(position.x,position.y)) continue;
        if(dx && dy && (!this.canStand(here.x+dx*unit,here.y) || !this.canStand(here.x,here.y+dy*unit))) continue;
        const cost=costs.get(key(current))+Math.hypot(dx,dy);
        if(cost<(costs.get(key(next))??Infinity)) {costs.set(key(next),cost);parents.set(key(next),current);open.push(next);}
      }
    }
    if(!found) return null;
    const result=[{...end}];
    while(key(found)!==key(a)) {result.unshift(world(found));found=parents.get(key(found));}
    // The actual station can be closer to an obstacle than its rounded grid cell.
    return result;
  }
  frame(timestamp) {
    if(this.destroyed) return;
    const dt=Math.min((timestamp-(this.lastTime||timestamp))/1000,.045);this.lastTime=timestamp;this.time+=dt;
    this.update(dt);this.updateCamera();this.draw();this.raf=requestAnimationFrame(this.frame);
  }
  update(dt) {
    this.moveReportElapsed+=dt;
    if(this.blockedInput()) {this.keys.clear();this.player.moving=false;this.reportMovement(true);return;}
    let dx=(this.keys.has('d')||this.keys.has('arrowright')?1:0)-(this.keys.has('a')||this.keys.has('arrowleft')?1:0);
    let dy=(this.keys.has('s')||this.keys.has('arrowdown')?1:0)-(this.keys.has('w')||this.keys.has('arrowup')?1:0);
    let pointerTravel=false, target=null;
    if(!dx && !dy && this.destination) {
      if(distance(this.player,this.destination)<5) {const action=this.pendingAction;this.cancelRoute();this.player.moving=false;this.reportMovement(true);if(action)this.activate(action);return;}
      while(this.path?.length>1 && distance(this.player,this.path[0])<1e-7) this.path.shift();
      target=this.path?.[0]||this.destination;dx=target.x-this.player.x;dy=target.y-this.player.y;pointerTravel=true;
    }
    const magnitude=Math.hypot(dx,dy), before={x:this.player.x,y:this.player.y};
    if(magnitude) {
      const amount=pointerTravel?Math.min(WALK_SPEED*dt,magnitude):WALK_SPEED*dt;
      dx=dx/magnitude*amount;dy=dy/magnitude*amount;
      // Reach a corner exactly before changing direction; near-corner skipping can
      // leave feet a floating-point fraction inside a desk's collision boundary.
      if(pointerTravel && magnitude<=WALK_SPEED*dt && this.canTravelSegment(this.player,target)) {
        this.player.x=target.x;this.player.y=target.y;
      } else {
        if(this.canStand(this.player.x+dx,this.player.y))this.player.x+=dx;
        if(this.canStand(this.player.x,this.player.y+dy))this.player.y+=dy;
      }
      this.player.facing=Math.abs(dx)>Math.abs(dy)?(dx>0?'right':'left'):(dy>0?'down':'up');
    }
    const travelled=distance(before,this.player);
    this.player.moving=travelled>.01;
    if(this.player.moving){this.player.step+=dt*12;this.travelAccumulator+=travelled;this.reportMovement();}
    else this.reportMovement(true);
  }
  reportMovement(force=false) {
    if(this.travelAccumulator<=0 || (!force && this.moveReportElapsed<.25))return;
    const payload={x:this.player.x,y:this.player.y,distance:this.travelAccumulator,station:this.nearestHotspot()?.action||null};
    this.travelAccumulator=0;this.moveReportElapsed=0;this.onMove(payload);
  }
  employees() {return Array.isArray(this.state.employees)?this.state.employees:[];}
  hasFurniture(id) {return (this.state.furniture||[]).some((item)=>(typeof item==='string'?item:item.id)===id);}
  ownedFurniture() {return (this.state.furniture||[]).map((item)=>typeof item==='string'?item:`${item.id||''} ${item.name||''}`).join(' ').toLowerCase();}
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
    const c=this.background.getContext('2d');
    c.clearRect(0,0,WIDTH,HEIGHT);
    const gradient=c.createRadialGradient(640,360,70,640,360,780);gradient.addColorStop(0,'#294738');gradient.addColorStop(1,'#14261e');
    c.fillStyle=gradient;c.fillRect(0,0,WIDTH,HEIGHT);
    this.ellipse(c,641,777,596,29,'#0e2018');
    this.rect(c,63,176,1156,604,'#775b3e');this.rect(c,68,181,1148,589,'#e3bd8e');
    c.save();c.beginPath();c.rect(68,181,1148,589);c.clip();
    for(let row=0;row<23;row++){
      const y=181+row*26;this.rect(c,68,y,1148,25,['#dfba88','#e6c396','#dcb480','#e3bd8b'][row%4]);
      this.rect(c,68,y+25,1148,1,'#c89f72');
      for(let x=70+(row%2?68:174);x<1215;x+=198){this.rect(c,x,y+1,1,24,'#bf976d');this.rect(c,x+14,y+7,47,1,'#d2a676');this.rect(c,x+80,y+19,42,1,'#cfa373');}
    }
    c.restore();
    this.rect(c,67,763,1149,9,'#b78a5d');this.rect(c,67,773,1149,8,'#5c4c36');
    this.rect(c,65,73,1152,106,'#285747');this.rect(c,65,73,1152,5,'#5c8068');
    this.rect(c,65,165,1152,14,'#214237');this.rect(c,67,179,1149,5,'#b58b5c');
    for(let x=80;x<1208;x+=39)this.rect(c,x,83,1,74,'#315e4c');
    this.polygon(c,[[42,91],[65,73],[65,770],[42,788]],'#1b4132');this.rect(c,62,79,5,688,'#3a6851');
    this.polygon(c,[[42,779],[65,762],[65,777],[42,792]],'#8e6a45');
    this.drawWindow(c,108,88,163,77);this.drawWindow(c,498,88,179,77);this.drawWindow(c,926,88,139,77);
    c.save();c.globalAlpha=.085;
    this.polygon(c,[[108,185],[256,185],[541,588],[332,588]],'#fff9d4');
    this.polygon(c,[[508,185],[661,185],[902,570],[695,570]],'#fff9d4');
    this.polygon(c,[[931,185],[1057,185],[1210,441],[1141,441]],'#fff9d4');c.restore();
    this.rug(c,103,216,328,225,'#799078','#6f846c');
    this.rug(c,493,220,338,171,'#a89b79','#968a6b');
    this.rug(c,899,220,285,171,'#80968a','#6c8577');
    this.rug(c,233,582,211,153,'#c68a63','#b57854');
    this.rug(c,496,510,347,109,'#a5aa86','#929970');
    this.rug(c,920,542,271,129,'#879e9b','#708784');
    // The studio's central circulation is intentionally clear and wide.
    c.font='600 10px system-ui,sans-serif';c.fillStyle='#997b58';c.textAlign='center';
    c.fillText('C O N S T R U I R   •   C O N V E R S A R   •   C R E S C E R',640,449);
    this.rect(c,497,458,286,1,'#c29b70');
    this.rect(c,108,457,112,10,'#a1815c');this.rect(c,111,451,106,7,'#c7a374');
    this.rect(c,504,481,141,5,'#be9563');this.rect(c,714,482,131,5,'#be9563');
    this.rect(c,909,490,280,8,'#bc9363');
    this.rect(c,565,716,107,31,'#46644c');this.rect(c,570,721,97,20,'#79916a');
    c.fillStyle='#e2dec0';c.font='600 8px monospace';c.fillText('OLÁ, MUNDO.',618,734);
  }
  rug(c,x,y,w,h,outer,inner){
    this.rect(c,x+2,y+3,w,h,'#a2856266');this.rect(c,x,y,w,h,outer);this.rect(c,x+6,y+6,w-12,h-12,inner);
    for(let offset=10;offset<w-10;offset+=10){this.rect(c,x+offset,y+2,4,2,'#dad1a077');this.rect(c,x+offset,y+h-4,4,2,'#dad1a077');}
    for(let row=10;row<h-8;row+=7)this.rect(c,x+9,y+row,w-18,1,outer+'aa');
  }
  at(c,x,y,draw,scale=1){c.save();c.translate(x,y);c.scale(scale,scale);draw();c.restore();}
  text(c,label,x,y,size=11,color='#e0e3c8',align='left',weight=500){c.font=`${weight} ${size}px system-ui,sans-serif`;c.fillStyle=color;c.textAlign=align;c.textBaseline='alphabetic';c.fillText(String(label),x,y);}
  divider(c,x,y,h){this.rect(c,x-2,y,h>190?15:14,h,'#6b7d5c');this.rect(c,x-3,y-7,16,h,'#3e6451');this.rect(c,x-3,y-7,4,h,'#83916a');for(let offset=19;offset<h;offset+=37)this.rect(c,x+2,y+offset,7,3,'#52735b');this.rect(c,x-3,y+h-8,17,8,'#294e3d');}
  drawProjects(c){
    this.rect(c,307,89,139,88,'#193e30');this.rect(c,305,86,139,86,'#ba9867');this.rect(c,310,91,129,75,'#eee3c6');
    const projects=(this.state.projects||[]).filter((p)=>p.status!=='delivered');
    ['A FAZER','FAZENDO','PRONTO'].forEach((label,index)=>{this.text(c,label,315+index*41,103,7,'#65705e');this.rect(c,350+index*41,108,1,47,'#d1cbb0');});
    [[316,111,'#ddb578'],[316,136,'#aabf8c'],[357,111,'#d49c81'],[398,111,'#93b4a1']].forEach(([x,y,color],index)=>{
      this.rect(c,x,y,29,21,color);this.rect(c,x+4,y+5,19,1,'#8e8267');this.rect(c,x+4,y+10,13,1,'#8e8267');
      if(index===2&&projects[0]){const progress=clamp((projects[0].progress||0)/(projects[0].hours||1),0,1);this.rect(c,x+3,y+15,23,3,'#b88065');this.rect(c,x+3,y+15,Math.round(23*progress),3,'#627e5b');}
    });
    this.text(c,`${projects.length} EM ANDAMENTO`,374,160,7,'#5c6f58','center');
    if(this.hasFurniture('whiteboard')){this.rect(c,398,136,29,20,'#a4bab0');this.rect(c,403,142,17,1,'#687e6c');this.rect(c,405,147,11,1,'#687e6c');}
  }
  drawWorldData(c){
    // These are physical displays mounted to the appropriate sector, not a dashboard.
    this.text(c,(this.state.profile?.company||'Seu estúdio').toUpperCase().slice(0,28),104,52,18,'#d9dcb6','left',700);
    this.text(c,'SOFTWARE HOUSE  /  DESDE 2026',104,66,8,'#839f83');
    this.rect(c,704,98,136,64,'#1b3c30');this.rect(c,708,102,128,55,'#ebdfbd');
    this.text(c,'CAIXA DE ENTRADA',772,114,8,'#61745a','center',700);
    this.text(c,`${(this.state.leads||[]).length} CONTATOS`,772,136,14,'#4d6f50','center',700);
    this.text(c,'cada conversa abre uma porta',772,149,6,'#918871','center');
    this.rect(c,1080,95,116,70,'#163d30');this.rect(c,1084,99,108,62,'#214d3b');
    this.text(c,'CAIXA DA EMPRESA',1138,114,8,'#a0b68e','center',600);
    const cash=new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL',maximumFractionDigits:0}).format(this.state.cash||0);
    this.text(c,cash,1138,137,15,(this.state.cash||0)<0?'#efaf8c':'#e4d99f','center',700);
    this.text(c,`${(this.state.receivables||[]).length} pagamentos a receber`,1138,152,7,'#8faf93','center');
    this.rect(c,689,49,151,25,'#1b4234');this.text(c,`REPUTAÇÃO  ${Math.round(this.state.reputation||0)}`,764,65,10,'#d9cf99','center',700);
    const trophies=Math.min(5,Math.floor((this.state.reputation||0)/20));
    for(let i=0;i<trophies;i++){this.rect(c,852+i*12,54,7,8,'#d9b56c');this.rect(c,854+i*12,62,3,5,'#d9b56c');this.rect(c,851+i*12,67,9,2,'#b29355');}
    this.rect(c,104,459,92,25,'#2f4d38');this.text(c,'ENERGIA',112,470,6,'#aebd92');this.rect(c,112,475,75,3,'#193e2a');this.rect(c,112,475,Math.round(75*clamp(this.state.energy??100,0,100)/100),3,'#c1cd8c');
    this.rect(c,497,489,29,29,'#e9d9b2');this.text(c,this.employees().length,511,501,10,'#60734f','center',700);
    this.text(c,'PESSOAS',511,510,5,'#60734f','center',600);this.rect(c,501,513,21,2,'#bdbea0');
    this.rect(c,501,513,Math.round(21*clamp(this.state.teamMorale??this.state.morale??80,0,100)/100),2,'#729c6b');
    this.rect(c,938,494,10,10,'#a4b17e');this.rect(c,951,494,10,10,'#b2c393');this.rect(c,964,494,10,10,'#d4b080');
  }
  drawDraftingTable(c){
    this.ellipse(c,779,598,76,10,'#b39670');this.rect(c,724,561,8,33,'#7a654b');this.rect(c,828,561,8,33,'#7a654b');
    this.rect(c,713,524,133,56,'#9e7950');this.rect(c,712,519,135,53,'#d2aa75');this.rect(c,725,527,94,34,'#adc0bc');
    for(let x=731;x<818;x+=12)this.rect(c,x,529,1,29,'#819f98');for(let y=531;y<560;y+=8)this.rect(c,728,y,88,1,'#819f98');
    this.rect(c,744,537,40,17,'#dfe1c5');this.rect(c,748,540,14,11,'#89a796');this.rect(c,769,540,10,11,'#89a796');
    this.rect(c,831,534,3,21,'#b56549');this.rect(c,824,535,3,20,'#e0d097');this.rect(c,725,563,64,3,'#ead5a4');
    this.rect(c,716,499,22,21,'#c89d6a');this.ellipse(c,727,499,11,4,'#d8b886');
  }
  drawReception(c){
    this.ellipse(c,624,713,78,10,'#b59873');this.rect(c,553,658,141,47,'#52734e');this.rect(c,558,665,132,32,'#365940');
    this.rect(c,550,650,147,13,'#ddb47b');this.rect(c,555,648,137,6,'#edcc94');
    this.rect(c,568,638,30,14,'#a57551');this.rect(c,570,639,26,10,'#e1d0a5');this.rect(c,585,638,2,14,'#668468');
    this.rect(c,617,634,33,16,'#ecdfb4');this.text(c,'DIÁRIO',633,645,6,'#63734e','center',700);
    this.rect(c,666,631,18,20,'#b17c53');this.at(c,675,631,()=>this.drawPlant(c,0,0,.3));
    this.text(c,'BEM-VINDO AO ESTÚDIO',624,684,9,'#e2dcad','center',600);
  }
  drawExit(c){
    this.rect(c,1121,704,80,60,'#9c8060');this.rect(c,1125,709,72,53,'#59775a');this.rect(c,1130,714,62,42,'#87a17a');
    this.rect(c,1140,724,3,21,'#bcc6a0');this.rect(c,1150,724,3,21,'#bcc6a0');this.rect(c,1160,724,3,21,'#bcc6a0');
    this.polygon(c,[[1180,729],[1180,738],[1190,733]],'#e5e5bc');
    this.text(c,'ATÉ AMANHÃ',1157,755,7,'#e5e5bd','center',700);
  }
  drawLab(c){
    this.drawDesk(c,965,559,175,'finance');
    this.rect(c,1081,531,43,27,'#355c54');this.rect(c,1085,535,35,19,'#7caba0');
    this.rect(c,1097,538,10,13,'#cad9ba');this.rect(c,1100,541,4,7,'#6a9d8e');
    this.rect(c,969,541,15,17,'#b2c1a5');this.rect(c,973,527,7,16,'#b2c1a5');this.rect(c,973,539,7,9,'#bf9967');
    this.rect(c,1130,546,10,9,'#b58459');
    const product=this.state.product;
    this.text(c,product?.name?String(product.name).slice(0,20):'UMA IDEIA PODE VIRAR PRODUTO',1054,688,9,'#62785c','center',600);
    const progress=clamp(product?.progress||0,0,100);this.rect(c,1001,696,105,3,'#b69772');this.rect(c,1001,696,Math.round(progress*1.05),3,'#58877a');
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
    } else if (kind === 'sales' || kind === 'team') {
      this.rect(c, x + 38, y - 29, 18, 5, '#94b89a');
      this.rect(c, x + 38, y - 22, 38, 7, '#d7c6a1');
      this.rect(c, x + 54, y - 12, 36, 7, '#a1bba2');
      this.rect(c, x + 42, y - 19, 24, 1, '#869a84');
      this.rect(c, x + 61, y - 9, 20, 1, '#6c8a77');
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


  draw() {
    if(!this.ctx||!this.scale)return;
    const c=this.ctx;c.setTransform(this.dpr,0,0,this.dpr,0,0);c.fillStyle='#14271f';c.fillRect(0,0,this.cssWidth,this.cssHeight);
    c.translate(this.offsetX,this.offsetY);c.scale(this.scale,this.scale);c.imageSmoothingEnabled=false;c.drawImage(this.background,0,0);
    this.drawWorldData(c);this.drawProjects(c);
    const nearest=this.nearestHotspot(), hovered=this.pointer?this.hotspotAt(this.pointer):null;
    const selected=this.hotspots.find((spot)=>spot.action===this.pendingAction)||hovered||nearest;
    if(selected){c.globalAlpha=.19+Math.sin(this.time*3)*.04;this.ellipse(c,selected.x,selected.y,32,13,'#f4e6aa');c.globalAlpha=1;c.strokeStyle='#f5e2a58a';c.lineWidth=1.5;c.beginPath();c.ellipse(selected.x,selected.y,32,13,0,0,Math.PI*2);c.stroke();}
    if(this.destination){
      c.save();c.strokeStyle='#f7e8c259';c.lineWidth=2;c.setLineDash([3,8]);c.beginPath();c.moveTo(this.player.x,this.player.y);this.path?.forEach(p=>c.lineTo(p.x,p.y));c.stroke();c.restore();
      c.strokeStyle='#f2dfb3a1';c.lineWidth=2;c.beginPath();c.ellipse(this.destination.x,this.destination.y,12,5,0,0,Math.PI*2);c.stroke();
    }
    const props=[
      {y:379,draw:()=>this.divider(c,452,191,188)},{y:379,draw:()=>this.divider(c,858,191,188)},
      {y:716,draw:()=>this.divider(c,452,509,207)},{y:692,draw:()=>this.divider(c,858,510,182)},
      {y:316,draw:()=>this.drawDesk(c,115,238,158)},{y:309,draw:()=>this.drawDesk(c,290,230,130)},
      {y:440,draw:()=>this.drawDesk(c,289,362,134)},
      {y:318,draw:()=>this.drawDesk(c,558,239,164,'sales')},{y:318,draw:()=>this.drawDesk(c,969,239,170,'finance')},
      {y:337,draw:()=>this.drawChair(c,196,337)},{y:335,draw:()=>this.drawChair(c,352,335)},
      {y:457,draw:()=>this.drawChair(c,355,457)},{y:340,draw:()=>this.drawChair(c,636,340,'#77876a')},
      {y:340,draw:()=>this.drawChair(c,1054,340,'#5e766d')},
      {y:598,draw:()=>this.drawDesk(c,502,520,144,'team')},{y:609,draw:()=>this.drawChair(c,570,607,'#87966b')},
      {y:601,draw:()=>this.drawDraftingTable(c)},
      {y:578,draw:()=>this.at(c,10,182,()=>this.drawCoffee(c))},
      {y:671,draw:()=>this.at(c,-376,240,()=>this.drawSofa(c))},
      {y:640,draw:()=>this.drawLab(c)},{y:656,draw:()=>this.drawChair(c,1052,654,'#678b82')},
      {y:709,draw:()=>this.drawReception(c)},{y:766,draw:()=>this.drawExit(c)},
      {y:242,draw:()=>this.drawPlant(c,97,234,.8)},{y:242,draw:()=>this.drawPlant(c,1188,234,.8)},
      {y:740,draw:()=>this.drawPlant(c,96,733,.9)},{y:740,draw:()=>this.drawPlant(c,909,731,.75)},
      {y:572,draw:()=>this.drawPlant(c,410,563,.55)},{y:683,draw:()=>this.at(c,-108,267,()=>this.drawLamp(c))},
      {y:this.player.y,draw:()=>this.drawCharacter(c,this.player,this.state.profile?.avatarColor||'#e3a46b',true)},
    ];
    const employees=this.employees();
    if(employees[0])props.push({y:336,draw:()=>{this.drawCharacter(c,{x:352,y:337,facing:'up'},employees[0].color||'#8da17f');this.employeeBubble(c,employees[0],352,271);}});
    if(employees[1])props.push({y:458,draw:()=>{this.drawCharacter(c,{x:355,y:458,facing:'up'},employees[1].color||'#8d9fb4');this.employeeBubble(c,employees[1],355,392);}});
    if(this.hasFurniture('desk')){
      props.push({y:449,draw:()=>this.drawDesk(c,115,370,150)});props.push({y:463,draw:()=>this.drawChair(c,188,462)});
      if(employees[2])props.push({y:464,draw:()=>{this.drawCharacter(c,{x:188,y:464,facing:'up'},employees[2].color||'#b68d83');this.employeeBubble(c,employees[2],188,398);}});
    }
    if(this.hasFurniture('monitors'))props.push({y:315,draw:()=>{this.rect(c,225,211,40,25,'#28463a');this.rect(c,228,214,34,19,'#8bac92');this.rect(c,242,234,5,9,'#345042');}});
    props.sort((a,b)=>a.y-b.y).forEach(prop=>prop.draw());
    this.hotspots.forEach(spot=>this.drawBadge(c,spot,selected?.action===spot.action));
    this.drawPlayerLabel(c,nearest);
    for(let i=0;i<14;i++){c.globalAlpha=.2+Math.sin(this.time+i)*.1;this.rect(c,139+i*69+Math.sin(this.time*.4+i)*3,195+(i*39+this.time*5)%332,2,2,'#fff0be');}c.globalAlpha=1;
  }
  employeeBubble(c,employee,x,y){
    const stressed=(employee.stress||0)>65, morale=employee.morale??80;
    const label=stressed?'PRECISO DE UMA PAUSA':morale<35?'VAMOS CONVERSAR?':'EM FOCO';
    const width=stressed?113:morale<35?115:60;
    c.fillStyle=stressed||morale<35?'#e0b186':'#2f5945dd';c.beginPath();c.roundRect(x-width/2,y-8,width,17,4);c.fill();
    this.text(c,label,x,y+4,7,stressed||morale<35?'#6b493b':'#c1d4ac','center',600);
  }
  drawBadge(c,spot,active){
    c.font='700 10px system-ui,sans-serif';const w=c.measureText(spot.label).width+25;
    c.fillStyle=active?'#e9d9ab':'#193d2fec';c.beginPath();c.roundRect(spot.labelX-w/2,spot.labelY-12,w,26,4);c.fill();
    c.strokeStyle=active?'#f4e6c1':'#87997b78';c.lineWidth=1;c.stroke();
    this.text(c,spot.label,spot.labelX,spot.labelY+4,10,active?'#34523c':'#dce1c0','center',700);
    this.rect(c,spot.labelX-1,spot.labelY+17,2,3,active?'#e9d9ab':'#668369');
  }
  drawPlayerLabel(c,nearby){
    const {x,y}=this.player,name=(this.state.profile?.name||'Você').split(' ')[0].slice(0,15);
    c.font='600 11px system-ui,sans-serif';const width=c.measureText(name).width+19;
    c.fillStyle='#183b2ce6';c.beginPath();c.roundRect(x-width/2,y-75,width,20,4);c.fill();this.text(c,name,x,y-61,11,'#eee9cb','center',600);
    this.polygon(c,[[x-3,y-53],[x+3,y-53],[x,y-49]],'#d6d4a5');
    if(nearby&&!this.player.moving&&!this.interactionOpen){
      c.font='600 11px system-ui,sans-serif';const label=nearby.verb,promptW=c.measureText(label).width+46;
      c.fillStyle='#eee1bb';c.beginPath();c.roundRect(x-promptW/2,y+15,promptW,27,5);c.fill();
      this.rect(c,x-promptW/2+7,y+20,17,17,'#365b40');this.text(c,'E',x-promptW/2+15.5,y+33,11,'#f1e8c7','center',700);
      this.text(c,label,x-promptW/2+31,y+33,11,'#3c513c','left',600);
    }
    if(this.pendingAction&&this.player.moving){const station=this.getStation(this.pendingAction);this.text(c,`A caminho: ${station.label.toLowerCase()}`,x,y+19,10,'#3f6246','center',600);}
  }
}
