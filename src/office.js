import { createOfficeLayout, roomWalls } from './office-layouts.js';

const WIDTH = 1280;
const HEIGHT = 820;
const WALK_SPEED = 185;
const SPAWN = { x: 697, y: 491 };
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

/** The entire game lives in this office. All interactions require physical travel. */
export class OfficeScene {
  constructor(canvas, { onInteract = () => {}, onMove = () => {} } = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.onInteract = onInteract;
    this.onMove = onMove;
    this.state = { profile: { name: 'Você', company: 'Seu estúdio', avatarColor: '#e59b54' }, employees: [], furniture: [], energy: 100, reputation: 12, cash: 20000, projects: [], leads: [] };
    this.player = { ...SPAWN, facing: 'down', moving: false, seated: false, step: 0 };
    this.layout = createOfficeLayout();
    this.hotspots = this.layout.stations;
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
    this.geometryKey = '';
    this.obstacles = this.buildObstacles();
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
    const wasPositionLoaded = this.positionLoaded;
    const previousStage = this.layout.stage;
    const previousStation = this.nearestHotspot()?.action;
    this.state = state;
    const office = state.office || {};
    const key = JSON.stringify([office.stage, office.rooms, office.special, office.amenities, office.workstations?.map((post) => [post.desk, post.chair]), office.banner]);
    const changed = key !== this.geometryKey;
    if (changed) {
      this.geometryKey = key;
      this.layout = createOfficeLayout(office);
      this.hotspots = this.layout.stations;
      this.obstacles = this.buildObstacles();
      this.renderBackground();
    }
    if (!this.positionLoaded) {
      this.positionLoaded = true;
      const position = state.officePosition;
      if (Number.isFinite(position?.x) && Number.isFinite(position?.y) && position.x > 0 && position.y > 0) {
        this.player.x = position.x;
        this.player.y = position.y;
      } else Object.assign(this.player, this.layout.spawn);
    }
    const blocked = !this.canStand(this.player.x, this.player.y);
    if (changed || blocked) this.cancelRoute();
    if (blocked || (wasPositionLoaded && previousStage !== this.layout.stage)) {
      const currentStation = changed && previousStation ? this.getStation(previousStation) : null;
      const nearest = currentStation && this.canStand(currentStation.x, currentStation.y)
        ? currentStation : this.nearestWalkablePosition(this.player) || this.layout.spawn;
      Object.assign(this.player, { x: nearest.x, y: nearest.y, moving: false, seated: false });
      this.keys.clear();
      this.travelAccumulator = 0;
      this.onMove({ x: this.player.x, y: this.player.y, distance: 0, station: this.nearestHotspot()?.action || null });
    }
    this.updateCamera();
  }

  buildObstacles() {
    const layout = this.layout;
    const obstacles = Object.values(layout.tables).map(({ x, y, w, kind }) => ({ x, y, w, h: kind === 'reception' ? 43 : 62 }));
    layout.posts.forEach((position, i) => { if (this.state.office?.workstations?.[i]?.desk !== false) obstacles.push({ x: position.x, y: position.y, w: position.w, h: 58 }); });
    obstacles.push({ x: layout.coffee.x, y: layout.coffee.y, w: 81, h: 91 });
    obstacles.push({ ...layout.lounge });
    layout.rooms.forEach((room) => obstacles.push(...roomWalls(room)));
    return obstacles;
  }

  getStation(action) { const station = this.hotspots.find((spot) => spot.action === action); return station ? {...station} : null; }
  isNearStation(action) {
    const spot = this.getStation(action);
    return !!spot && this.canStand(this.player.x, this.player.y)
      && distance(this.player, spot) <= spot.range && this.canTravelSegment(this.player, spot);
  }
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
  founderSeat() {
    const posts = this.state.office?.workstations || [];
    const index = Math.max(0, posts.findIndex(post => post.employeeId === 'founder'));
    const post = posts[index], position = this.layout.posts[index];
    if (!position || (post && (!post.desk || !post.chair))) return null;
    return { x: position.x + position.w/2, y: position.y + 65 * (position.w/136) + 28 };
  }
  setPlayerSeated(seated) {
    if (!seated) { this.player.seated = false; this.player.facing = 'down'; return true; }
    if (!this.isNearStation('work')) return false;
    const seat = this.founderSeat(), spot = this.getStation('work');
    if (!seat || !this.canStand(seat.x,seat.y) || distance(seat,spot) > spot.range || !this.canTravelSegment(this.player,seat)) return false;
    this.cancelRoute(); this.keys.clear();
    Object.assign(this.player,seat,{seated:true,moving:false,facing:'up'});
    this.travelAccumulator=0;this.moveReportElapsed=0;this.updateCamera();
    this.onMove({ x: seat.x, y: seat.y, distance: 0, station: 'work' });
    return true;
  }
  setZoom(value) { this.zoom = clamp(Number(value) || 1, 1, 1.6); this.resize(); }
  resetPlayer() {
    Object.assign(this.player, this.layout.spawn, {facing:'down',moving:false,seated:false,step:0});
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
    const walk = this.layout.walk;
    const target = {x:clamp(point.x,walk.x,walk.x+walk.w),y:clamp(point.y,walk.y,walk.y+walk.h)};
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
    const bounds = this.layout.walk;
    return Number.isFinite(x) && Number.isFinite(y) && x>=bounds.x && x<=bounds.x+bounds.w && y>=bounds.y && y<=bounds.y+bounds.h
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
        if (d<best && this.canStand(p.x,p.y) && this.pathGridCell(p)) {result=p;best=d;}
      }
      if(result) return result;
    }
    return null;
  }
  findPath(start,end) {
    const unit=12, origin={x:this.layout.walk.x,y:this.layout.walk.y};
    const cols=Math.floor(this.layout.walk.w/unit)+1, rows=Math.floor(this.layout.walk.h/unit)+1;
    const key=(p)=>p.y*cols+p.x, world=(p)=>({x:origin.x+p.x*unit,y:origin.y+p.y*unit});
    const a=this.pathGridCell(start), b=this.pathGridCell(end);
    if (!a || !b) return null;
    const open=[a], costs=new Map([[key(a),0]]), parents=new Map(), visited=new Set();
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
    result.unshift(world(a));
    return result;
  }
  pathGridCell(point) {
    const unit=12, origin=this.layout.walk;
    const cols=Math.floor(origin.w/unit)+1, rows=Math.floor(origin.h/unit)+1;
    const center={x:clamp(Math.round((point.x-origin.x)/unit),0,cols-1),y:clamp(Math.round((point.y-origin.y)/unit),0,rows-1)};
    const world=cell=>({x:origin.x+cell.x*unit,y:origin.y+cell.y*unit});
    for(let ring=0;ring<=3;ring++) {
      const candidates=[];
      for(let dy=-ring;dy<=ring;dy++)for(let dx=-ring;dx<=ring;dx++) {
        if(ring&&Math.max(Math.abs(dx),Math.abs(dy))!==ring)continue;
        const cell={x:center.x+dx,y:center.y+dy};
        if(cell.x<0||cell.x>=cols||cell.y<0||cell.y>=rows)continue;
        const position=world(cell);
        if(this.canStand(position.x,position.y)&&this.canTravelSegment(point,position))candidates.push(cell);
      }
      if(candidates.length)return candidates.sort((a,b)=>distance(point,world(a))-distance(point,world(b)))[0];
    }
    return null;
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
    const floor = this.layout.floor, improved = !!this.state.office?.amenities?.floor;
    this.ellipse(c,floor.x+floor.w/2,floor.y+floor.h+6,floor.w/2+14,21,'#0e2018');
    this.rect(c,floor.x-5,floor.y-5,floor.w+10,floor.h+15,'#775b3e');
    this.rect(c,floor.x,floor.y,floor.w,floor.h,improved?'#d9d3b6':'#e3bd8e');
    c.save();c.beginPath();c.rect(floor.x,floor.y,floor.w,floor.h);c.clip();
    for(let row=0;row<Math.ceil(floor.h/26);row++){
      const y=floor.y+row*26;
      this.rect(c,floor.x,y,floor.w,25,(improved?['#c9ceb8','#d6d9c7','#c4cdb9','#d0d4bf']:['#dfba88','#e6c396','#dcb480','#e3bd8b'])[row%4]);
      this.rect(c,floor.x,y+25,floor.w,1,improved?'#adb79e':'#c89f72');
      for(let x=floor.x+(row%2?68:174);x<floor.x+floor.w;x+=198){this.rect(c,x,y+1,1,24,improved?'#b1bda5':'#bf976d');this.rect(c,x+14,y+7,47,1,improved?'#c0c8b1':'#d2a676');}
    }
    c.restore();
    const wallY = floor.y - 106;
    this.rect(c,floor.x,floor.y+floor.h-7,floor.w,9,'#b78a5d');this.rect(c,floor.x,floor.y+floor.h+2,floor.w,7,'#5c4c36');
    this.rect(c,floor.x,wallY,floor.w,106,this.layout.stage==='garage'?'#446255':'#285747');this.rect(c,floor.x,wallY,floor.w,5,'#6c8b6c');
    this.rect(c,floor.x,floor.y-14,floor.w,14,'#214237');this.rect(c,floor.x,floor.y,floor.w,5,'#b58b5c');
    for(let x=floor.x+14;x<floor.x+floor.w-8;x+=39)this.rect(c,x,wallY+10,1,74,'#315e4c');
    this.polygon(c,[[floor.x-23,wallY+18],[floor.x,wallY],[floor.x,floor.y+floor.h],[floor.x-23,floor.y+floor.h+18]],'#1b4132');this.rect(c,floor.x-3,wallY+6,5,floor.h+94,'#3a6851');
    if (this.layout.stage === 'garage') {
      this.rect(c,floor.x+33,wallY+18,162,68,'#324c3e');
      for(let i=0;i<5;i++)this.rect(c,floor.x+37,wallY+21+i*12,154,8,'#93a59a');
      this.rect(c,floor.x+54,wallY+42,8,5,'#5c7566');
      this.drawWindow(c,floor.x+floor.w-192,wallY+18,151,64);
    } else {
      this.drawWindow(c,floor.x+37,wallY+18,154,70);
      this.drawWindow(c,floor.x+floor.w-237,wallY+18,154,70);
    }
    c.save();c.globalAlpha=.085;
    this.polygon(c,[[floor.x+floor.w-208,floor.y],[floor.x+floor.w-61,floor.y],[floor.x+floor.w,floor.y+289],[floor.x+floor.w-144,floor.y+289]],'#fff9d4');c.restore();
    const colors = {development:['#799078','#6f846c'],sales:['#a89b79','#968a6b'],finance:['#80968a','#6c8577'],hr:['#a5aa86','#929970'],meeting:['#9b8874','#8d7c67'],ceo:['#aa9b75','#9d8c65']};
    this.layout.rooms.forEach(room=>{
      const [outer,inner]=colors[room.sector];
      this.rug(c,room.x+9,room.y+10,room.w-18,room.h-18,outer,inner);
      if(room.level!=='open')this.text(c,room.level==='partition'?'DIVISÓRIAS':room.level==='glass'?'SALA DE VIDRO':'SALA DEDICADA',room.x+room.w/2,room.y+room.h-18,7,'#e4dcc1','center',600);
    });
    this.text(c,'C O N S T R U I R   •   C O N V E R S A R   •   C R E S C E R',floor.x+floor.w/2,this.layout.stage==='garage'?507:556,9,'#947754','center',600);
    this.rect(c,floor.x+floor.w/2-135,this.layout.stage==='garage'?515:564,270,1,'#bd976b');
    this.text(c,this.layout.name,floor.x+12,wallY-29,11,'#bed0ac','left',700);
    this.text(c,this.layout.subtitle,floor.x+12,wallY-13,8,'#7f9e82');
  }
  rug(c,x,y,w,h,outer,inner){
    this.rect(c,x+2,y+3,w,h,'#a2856266');this.rect(c,x,y,w,h,outer);this.rect(c,x+6,y+6,w-12,h-12,inner);
    for(let offset=10;offset<w-10;offset+=10){this.rect(c,x+offset,y+2,4,2,'#dad1a077');this.rect(c,x+offset,y+h-4,4,2,'#dad1a077');}
    for(let row=10;row<h-8;row+=7)this.rect(c,x+9,y+row,w-18,1,outer+'aa');
  }
  at(c,x,y,draw,scale=1){c.save();c.translate(x,y);c.scale(scale,scale);draw();c.restore();}
  text(c,label,x,y,size=11,color='#e0e3c8',align='left',weight=500){c.font=`${weight} ${size}px system-ui,sans-serif`;c.fillStyle=color;c.textAlign=align;c.textBaseline='alphabetic';c.fillText(String(label),x,y);}
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
  drawWorldData(c) {
    const floor=this.layout.floor, office=this.state.office||{};
    this.text(c,(this.state.profile?.company||'Seu estúdio').toUpperCase().slice(0,32),floor.x+12,floor.y-159,20,'#d9dcb6','left',700);
    if(office.amenities?.banner) {
      const text=String(office.banner?.text||this.state.profile?.company||'Seu estúdio').slice(0,38);
      const width=Math.min(310,Math.max(140,text.length*7+30)), x=floor.x+floor.w-width-13, y=floor.y-78;
      this.rect(c,x-2,y-2,width+4,29,'#d7c697');this.rect(c,x,y,width,25,office.banner?.color||'#63866a');
      this.text(c,text,x+width/2,y+17,12,'#fff8dd','center',700);
      this.rect(c,x+8,y+25,2,11,'#d1c498');this.rect(c,x+width-10,y+25,2,11,'#d1c498');
    }
    const cash=new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL',maximumFractionDigits:0}).format(this.state.cash||0);
    const readout=(kind,label,value,color='#44664b')=>{
      const t=this.layout.tables[kind]; if(!t)return;
      const width=Math.min(t.w-10,132), x=t.x+(t.w-width)/2,y=t.y-25;
      this.rect(c,x-2,y-2,width+4,32,'#8d7752');this.rect(c,x,y,width,29,'#eee2c1');
      this.text(c,label,t.x+t.w/2,y+9,6,'#797b60','center',700);this.text(c,value,t.x+t.w/2,y+22,10,color,'center',700);
    };
    readout('sales','CAIXA DE ENTRADA',`${(this.state.leads||[]).length} contatos`);
    readout('finance','CAIXA DA EMPRESA',cash,(this.state.cash||0)<0?'#b0674b':'#44664b');
    readout('team','PESSOAS & CULTURA',`${this.employees().length} pessoas`);
    readout('product','PRODUTO PRÓPRIO',this.state.product?.stage==='launched'?'MVP no ar':`${Math.round(this.state.product?.progress||0)}% do MVP`);
    readout('furniture','ESPAÇO DA EMPRESA',`${(office.workstations||[]).filter(p=>p.desk&&p.chair).length} postos prontos`);
    const post=this.layout.posts[0];
    if(post) {
      this.rect(c,post.x+2,post.y-18,40,15,'#e3cb92');this.text(c,`E ${Math.round(this.state.energy??100)}%`,post.x+22,post.y-7,7,'#63764f','center',700);
    }
    const trophies=Math.min(5,Math.floor((this.state.reputation||0)/20));
    this.text(c,`REPUTAÇÃO ${Math.round(this.state.reputation||0)}`,floor.x+floor.w-27,floor.y-15,9,'#d9cf99','right',700);
    for(let i=0;i<trophies;i++){this.rect(c,floor.x+floor.w-26-i*14,floor.y-32,7,8,'#d9b56c');this.rect(c,floor.x+floor.w-24-i*14,floor.y-24,3,5,'#d9b56c');}
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

  drawCharacter(c, character, color, isPlayer = false) {
    const x = Math.round(character.x), y = Math.round(character.y);
    const moving = character.moving;
    const walk = moving ? Math.sin(character.step) : 0;
    const bob = moving ? Math.round(Math.abs(Math.sin(character.step)) * 2) : 0;
    const up = character.facing === 'up';
    const side = character.facing === 'left' || character.facing === 'right';
    if (character.seated) {
      const typing = Math.sin(this.time * 9) > 0 ? 1 : -1;
      this.ellipse(c,x,y+1,14,4,'#8e86675c');
      this.rect(c,x-10,y-13,8,11,'#324a4c');this.rect(c,x+2,y-13,8,11,'#324a4c');
      this.rect(c,x-11,y-4,10,4,'#263c38');this.rect(c,x+2,y-4,10,4,'#263c38');
      this.rect(c,x-10,y-27,20,17,color||'#d49561');
      this.polygon(c,[[x-9,y-27],[x-17,y-41],[x-12,y-44],[x-4,y-28]],color||'#d49561');
      this.polygon(c,[[x+9,y-27],[x+17,y-41],[x+12,y-44],[x+4,y-28]],color||'#d49561');
      this.rect(c,x-16,y-46+typing,6,6,'#dfaa7a');this.rect(c,x+10,y-46-typing,6,6,'#dfaa7a');
      this.rect(c,x-4,y-31,8,7,'#d49d75');
      this.rect(c,x-11,y-49,22,21,'#4a3d30');this.rect(c,x-8,y-52,18,5,'#4a3d30');
      this.rect(c,x-8,y-46,6,2,'#63503b');this.rect(c,x-7,y-30,14,3,'#4a3d30');
      if(isPlayer)this.rect(c,x-4,y-23,8,2,'#f2d7aa');
      return;
    }
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


  drawTable(c,table) {
    const {x,y,w,kind}=table;
    this.ellipse(c,x+w/2,y+64,w/2+3,8,'#b3967088');
    this.rect(c,x+7,y+38,7,25,'#7a654b');this.rect(c,x+w-14,y+38,7,25,'#7a654b');
    this.rect(c,x,y+8,w,42,kind==='reception'?'#476c4e':'#9e7951');this.rect(c,x-2,y-1,w+4,39,'#d5ae77');
    this.rect(c,x+2,y+2,w-4,32,'#e1bd87');this.rect(c,x,y+35,w,5,'#bb8e58');
    if(kind==='furniture') {
      this.rect(c,x+9,y+7,w-28,23,'#9fb8ad');
      for(let i=0;i<3;i++)this.rect(c,x+14+i*24,y+11,17,14,'#e1e3bf');
      this.rect(c,x+w-14,y+8,3,20,'#b97651');
    } else if(kind==='finance') {
      this.rect(c,x+12,y+7,38,25,'#e9dfbf');
      for(let i=0;i<4;i++)this.rect(c,x+17,y+11+i*5,27,1,'#719578');
      this.rect(c,x+w-37,y+8,23,25,'#43574b');this.rect(c,x+w-34,y+10,17,6,'#c2ceab');
      for(let i=0;i<9;i++)this.rect(c,x+w-34+(i%3)*6,y+19+Math.floor(i/3)*4,4,2,'#8ea18a');
    } else if(kind==='product') {
      this.rect(c,x+11,y+7,w-37,24,'#4d7467');this.rect(c,x+16,y+10,w-47,15,'#a9c6ae');
      this.text(c,'MVP',x+(w-15)/2,y+22,9,'#466a56','center',700);
      this.rect(c,x+w-22,y+11,12,19,'#dddac0');
    } else if(kind==='meeting') {
      for(const offset of [11,w-31]) {this.rect(c,x+offset,y+8,20,25,'#e9deb9');this.rect(c,x+offset+3,y+13,13,1,'#82a38e');}
      this.ellipse(c,x+w/2,y+20,13,8,'#7f9a73');this.rect(c,x+w/2-3,y+8,6,12,'#9dac8b');
      this.drawChair(c,x-13,y+29,'#8c9772');this.drawChair(c,x+w+14,y+29,'#8c9772');
    } else if(kind==='ceo') {
      this.rect(c,x+9,y+8,31,24,'#536847');this.rect(c,x+12,y+10,25,18,'#e7d7ac');
      this.rect(c,x+w-35,y+9,19,18,'#9d7550');this.rect(c,x+w-32,y+11,13,13,'#d4c292');
      this.text(c,'FOCO',x+w-25,y+20,5,'#627651','center',700);
      this.drawChair(c,x+w/2,y+78,'#b4a271');
    } else {
      this.rect(c,x+10,y+6,34,26,kind==='reception'?'#a67651':'#6e8b69');this.rect(c,x+13,y+8,27,20,'#ecdfb9');
      this.text(c,kind==='reception'?'DIÁRIO':kind==='sales'?'CLIENTES':'EQUIPE',x+27,y+20,5,'#617453','center',700);
      this.rect(c,x+w-42,y+10,27,18,'#d2bd8c');this.rect(c,x+w-39,y+12,21,1,'#839277');
      this.rect(c,x+w-36,y+17,16,1,'#839277');this.rect(c,x+w-33,y+21,12,1,'#839277');
    }
  }
  drawWorkstation(c,position,post,index) {
    const scale=position.w/136;
    if(post.desk) this.at(c,position.x,position.y,()=>{
      this.drawDesk(c,0,0,136,'work');
      if(post.computerLevel>=2){this.rect(c,99,-41,32,26,'#17362b');this.rect(c,102,-38,26,20,post.computerLevel===3?'#c3dca5':'#8aaca4');this.rect(c,112,-14,7,16,'#335546');}
      if(post.computerLevel===3){this.rect(c,110,8,20,25,'#395555');this.rect(c,113,12,14,2,'#7cc8bc');this.rect(c,113,18,14,2,'#7cc8bc');}
      this.rect(c,7,32,18,12,'#314f3d');this.text(c,`N${post.computerLevel||1}`,16,41,7,'#deebc9','center',700);
    },scale);
    const x=position.x+position.w/2,y=position.y+65*(position.w/136)+28;
    if(post.chair)this.drawChair(c,x,y,index===0?'#60806a':'#768b6c');
    const employee=this.employees().find(person=>person.id===post.employeeId);
    if(employee) {this.drawCharacter(c,{x,y,facing:'up',seated:true},employee.color||'#8da17f');this.employeeBubble(c,employee,x,y-67);}
    else if(post.employeeId==='founder')this.text(c,'FUNDADOR',x,y+27,6,'#658163','center',700);
    else this.text(c,post.chair?'POSTO LIVRE':'FALTA CADEIRA',x,y+25,6,post.chair?'#7a855f':'#a17852','center',600);
  }
  drawRoomWall(c,wall) {
    const {x,y,w,h,room}=wall, glass=room.level==='glass', partition=room.level==='partition';
    const inside=this.player.x>=room.x&&this.player.x<=room.x+room.w&&this.player.y>=room.y&&this.player.y<=room.y+room.h;
    c.save();c.globalAlpha=glass?.48:inside&&!partition?.64:1;
    const height=partition?23:43;
    this.rect(c,x,y-height,w,h+height,glass?'#9ac3bd':partition?'#6d8669':'#46705a');
    this.rect(c,x,y-height,w,4,glass?'#d8e6ce':partition?'#aab893':'#a1b48f');
    this.rect(c,x,y+h-4,w,5,'#335a47');
    if(glass){this.rect(c,x,y-height,3,h+height,'#739184');if(w>20)for(let i=42;i<w;i+=58)this.rect(c,x+i,y-height,2,h+height,'#648f83');}
    else if(partition&&h>20)for(let i=18;i<h;i+=29)this.rect(c,x+2,y+i,Math.max(2,w-4),2,'#789270');
    c.restore();
  }
  drawLounge(c) {
    const {x,y,w,h}=this.layout.lounge, upgraded=this.state.office?.amenities?.lounge;
    this.ellipse(c,x+w/2,y+h+1,w/2+4,7,'#b5967088');
    this.rect(c,x+5,y+h-5,5,10,'#735c43');this.rect(c,x+w-10,y+h-5,5,10,'#735c43');
    this.rect(c,x,y,w,h,upgraded?'#476c4a':'#8c9478');this.rect(c,x+4,y+4,w-8,h-10,upgraded?'#7e9c69':'#b4b78e');
    this.rect(c,x+4,y+4,w-8,Math.min(12,h/3),upgraded?'#9ab681':'#d0ca9e');
    if(upgraded){this.rect(c,x+9,y+h-21,Math.min(30,w-18),16,'#e8c997');if(w>80)this.rect(c,x+w-38,y+13,26,20,'#cb966e');}
  }
  draw() {
    if(!this.ctx||!this.scale)return;
    const c=this.ctx;c.setTransform(this.dpr,0,0,this.dpr,0,0);c.fillStyle='#14271f';c.fillRect(0,0,this.cssWidth,this.cssHeight);
    c.translate(this.offsetX,this.offsetY);c.scale(this.scale,this.scale);c.imageSmoothingEnabled=false;c.drawImage(this.background,0,0);
    this.at(c,this.layout.board.x-305,this.layout.board.y-86,()=>this.drawProjects(c));
    const nearest=this.nearestHotspot(), hovered=this.pointer?this.hotspotAt(this.pointer):null;
    const selected=this.hotspots.find((spot)=>spot.action===this.pendingAction)||hovered||nearest;
    if(selected){c.globalAlpha=.19+Math.sin(this.time*3)*.04;this.ellipse(c,selected.x,selected.y,28,11,'#f4e6aa');c.globalAlpha=1;c.strokeStyle='#f5e2a58a';c.lineWidth=1.5;c.beginPath();c.ellipse(selected.x,selected.y,28,11,0,0,Math.PI*2);c.stroke();}
    if(this.destination){
      c.save();c.strokeStyle='#f7e8c259';c.lineWidth=2;c.setLineDash([3,8]);c.beginPath();c.moveTo(this.player.x,this.player.y);this.path?.forEach(p=>c.lineTo(p.x,p.y));c.stroke();c.restore();
      c.strokeStyle='#f2dfb3a1';c.lineWidth=2;c.beginPath();c.ellipse(this.destination.x,this.destination.y,12,5,0,0,Math.PI*2);c.stroke();
    }
    const props=[];
    Object.values(this.layout.tables).forEach(table=>props.push({y:table.y+table.h,draw:()=>this.drawTable(c,table)}));
    const posts=this.state.office?.workstations||[{desk:true,chair:true,computerLevel:1,employeeId:'founder'}];
    this.layout.posts.forEach((position,i)=>props.push({y:position.y+65*(position.w/136)+28,draw:()=>this.drawWorkstation(c,position,posts[i],i)}));
    props.push({y:this.layout.coffee.y+94,draw:()=>this.at(c,this.layout.coffee.x-93,this.layout.coffee.y-301,()=>this.drawCoffee(c))});
    props.push({y:this.layout.lounge.y+this.layout.lounge.h,draw:()=>this.drawLounge(c)});
    const exit=this.getStation('exit');
    props.push({y:exit.y+16,draw:()=>{this.rect(c,exit.x-16,exit.y-22,32,33,'#658566');this.rect(c,exit.x-11,exit.y-18,22,23,'#9fb694');this.polygon(c,[[exit.x-5,exit.y-11],[exit.x+5,exit.y-6],[exit.x-5,exit.y]],'#edf1ce');}});
    this.layout.rooms.forEach(room=>roomWalls(room).forEach(wall=>props.push({y:wall.y+wall.h,draw:()=>this.drawRoomWall(c,wall)})));
    if(this.state.office?.amenities?.decor) {
      const floor=this.layout.floor;
      props.push({y:floor.y+floor.h-15,draw:()=>this.drawPlant(c,floor.x+22,floor.y+floor.h-17,.72)});
      props.push({y:floor.y+floor.h-15,draw:()=>this.drawPlant(c,floor.x+floor.w-30,floor.y+floor.h-17,.72)});
      this.rect(c,floor.x+214,floor.y-78,43,37,'#ba9469');this.rect(c,floor.x+218,floor.y-74,35,29,'#afc9a1');this.polygon(c,[[floor.x+222,floor.y-49],[floor.x+232,floor.y-63],[floor.x+248,floor.y-49]],'#739373');
    }
    props.push({y:this.player.y,draw:()=>this.drawCharacter(c,this.player,this.state.profile?.avatarColor||'#e3a46b',true)});
    props.sort((a,b)=>a.y-b.y).forEach(prop=>prop.draw());
    this.drawWorldData(c);
    this.hotspots.forEach(spot=>this.drawBadge(c,spot,selected?.action===spot.action));
    this.drawPlayerLabel(c,nearest);
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
