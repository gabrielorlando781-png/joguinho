const clamp=(n,min,max)=>Math.max(min,Math.min(max,n));
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
import { roomWalls } from './office-layouts.js';
export function layoutObstacles(layout,office){const obstacles=Object.entries(layout.tables).map(([id,o])=>({...o,h:o.kind==='reception'?43:62,id:'table:'+id}));layout.posts.forEach((o,i)=>obstacles.push({...o,h:58,id:'post:'+office?.workstations?.[i]?.id}));obstacles.push({...layout.coffee,w:81,h:91,id:'coffee'},{...layout.lounge,id:'lounge'});layout.rooms.forEach(r=>obstacles.push(...roomWalls(r)));return obstacles;}
export class LayoutNavigation { constructor(layout,office,obstacles=null){this.layout=layout;this.obstacles=obstacles||layoutObstacles(layout,office);}
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
}
export function validateFloorPlan(layout,office){
  const nav=new LayoutNavigation(layout,office),floor=layout.floor;
  for(const r of layout.rooms)if(r.x<floor.x||r.y<floor.y||r.x+r.w>floor.x+floor.w||r.y+r.h>floor.y+floor.h)return {ok:false,message:'Um setor ficou fora do escritório.'};
  if(office.amenities?.decor&&layout.decor.some(p=>p.x<floor.x+16||p.x>floor.x+floor.w-16||p.y<floor.y+55||p.y>floor.y+floor.h))return {ok:false,message:'Mantenha as plantas dentro do escritório.'};
  if(office.amenities?.banner){const p=layout.banner,width=Math.min(310,Math.max(140,(office.banner?.text||'').length*7+30));if(p.x<floor.x||p.x+width>floor.x+floor.w||p.y<floor.y-100||p.y+25>floor.y+floor.h)return {ok:false,message:'Mantenha o banner na parede ou dentro do escritório.'};}
  const furniture=nav.obstacles.filter(o=>o.id);
  for(const o of furniture)if(o.x<floor.x||o.y<floor.y||o.x+o.w>floor.x+floor.w||o.y+o.h>floor.y+floor.h)return {ok:false,message:'Mantenha os móveis dentro do escritório.'};
  for(let i=0;i<furniture.length;i++)for(let j=i+1;j<furniture.length;j++){const a=furniture[i],b=furniture[j];if(a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.h&&a.y+a.h>b.y)return {ok:false,message:'Dois móveis estão sobrepostos. Separe-os antes de aplicar.'};}
  const origin=layout.walk,cols=Math.floor(origin.w/12)+1,rows=Math.floor(origin.h/12)+1,key=p=>p.y*cols+p.x,world=p=>({x:origin.x+p.x*12,y:origin.y+p.y*12});
  let spawn={...layout.spawn};
  if(!nav.canStand(spawn.x,spawn.y)){const cell=nav.pathGridCell(spawn);if(cell)spawn=world(cell);else {spawn={x:floor.x+24,y:floor.y+floor.h-24};}}
  const start=nav.pathGridCell(spawn);if(!start)return {ok:false,message:'Deixe um espaço livre para o fundador.'};
  const seen=new Set([key(start)]),queue=[start];
  for(let i=0;i<queue.length;i++){const cell=queue[i],here=world(cell);for(const [dx,dy]of [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]]){const next={x:cell.x+dx,y:cell.y+dy},k=key(next),p=world(next);if(next.x<0||next.y<0||next.x>=cols||next.y>=rows||seen.has(k)||!nav.canStand(p.x,p.y)||dx&&dy&&(!nav.canStand(here.x+dx*12,here.y)||!nav.canStand(here.x,here.y+dy*12)))continue;seen.add(k);queue.push(next);}}
  const targets=[...layout.stations,...layout.posts.map((p,i)=>({x:p.x+p.w/2,y:p.y+65*(p.w/136)+28,label:`Posto ${i+1}`}))];
  for(const t of targets){const cell=nav.pathGridCell(t);if(!nav.canStand(t.x,t.y)||!cell||!seen.has(key(cell)))return {ok:false,message:`O acesso a ${t.label||'um posto'} ficou bloqueado. Deixe um corredor livre.`};}
  return {ok:true,message:'Planta acessível. Pronta para aplicar.',spawn};
}
