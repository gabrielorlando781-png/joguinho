const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
export function syncStaff(scene){
  const previous=scene.staff||new Map(),next=new Map();
  for(const [i,post] of (scene.state.office?.workstations||[]).entries()){
    const employee=scene.employees().find(e=>e.id===post.employeeId),p=scene.layout.posts[i];if(!employee||!p)continue;
    const home={x:p.x+p.w/2,y:p.y+65*(p.w/136)+28},old=previous.get(employee.id);
    next.set(employee.id,old&&distance(old.home,home)<.01?{...old,employee}:{...home,home,employee,facing:'up',seated:true,moving:false,step:0,phase:'working',timer:4+i*3,cycle:i,path:[],wait:0});
  }
  scene.staff=next;
}
export function updateStaff(scene,dt){
  if(!scene.staff)return;
  const active=!scene.state.paused&&!scene.interactionOpen&&!scene.editor&&scene.state.status!=='bankrupt';
  for(const npc of scene.staff.values()){
    npc.moving=false;
    const manager=npc.employee.area;
    const queue=scene.state.management?.requests||[];
    const queueIndex=manager?queue.findIndex(request=>request.area===manager):-1;
    if(manager && (queueIndex>=0 || scene.ceoLeaving===manager) && scene.state.office?.special?.ceo && !scene.editor){
      const room=scene.layout.ceo;
      const leaving=scene.ceoLeaving===manager;
      const inside=queueIndex===0&&!scene.ceoLeaving;
      const exitOffset=manager==='sales'?-130:manager==='finance'?130:manager==='development'?-90:90;
      const outside=room.door==='right'
        ? {x:room.x+room.w+42,y:room.y+room.h/2+(leaving?exitOffset*.6:(queueIndex-1)*47)}
        : {x:room.x+room.w/2+(leaving?exitOffset:(queueIndex-1)*60),y:room.y-48};
      const desired=inside?{x:room.x+Math.min(52,room.w*.19),y:room.y+room.h*.58}:outside;
      const target=scene.canStand(desired.x,desired.y)?desired:scene.nearestWalkablePosition(desired);
      npc.seated=false;
      if(target){
        const tag=leaving?'leaving':`${queue[queueIndex].id}:${inside?'inside':queueIndex}`;
        if(npc.managerTarget!==tag){npc.managerTarget=tag;npc.path=scene.findPath(npc,target)||[];npc.wait=0;}
        if(distance(npc,target)<9){
          npc.path=[];npc.managerLocation=inside?'inside':'outside';
          if(leaving)scene.ceoLeaving=null;
          if(inside&&!npc.arrivalNotified){npc.arrivalNotified=true;scene.onManagerArrival?.(manager);}
        }else{npc.managerLocation='walking';npc.arrivalNotified=false;}
      }
    }else if(manager){npc.managerTarget=null;npc.managerLocation='working';npc.arrivalNotified=false;}
    if(!active&&queueIndex<0&&!(manager&&scene.ceoLeaving===manager))continue;
    if(npc.path.length){
      while(npc.path.length&&distance(npc,npc.path[0])<.1)npc.path.shift();
      if(!npc.path.length){npc.seated=queueIndex<0&&npc.phase==='returning';npc.phase=npc.seated?'working':'break';npc.timer=npc.seated?14+npc.cycle%7:4+npc.cycle%4;continue;}
      const target=npc.path[0],d=distance(npc,target),step=Math.min(d,dt*(105+npc.cycle%3*8)),dx=(target.x-npc.x)/d*step,dy=(target.y-npc.y)/d*step,next={x:npc.x+dx,y:npc.y+dy};
      const people=[scene.player,...scene.staff.values()].filter(p=>p!==npc&&!p.seated);
      if(!scene.canTravelSegment(npc,next)||people.some(p=>distance(p,next)<19&&distance(p,next)<distance(p,npc))){npc.wait+=dt;if(npc.wait>2.5){npc.timer=2;npc.path=[];npc.phase='break';npc.wait=0; if(queueIndex>=0||(manager&&scene.ceoLeaving===manager))npc.managerTarget=null;}continue;}
      npc.wait=0;npc.x=next.x;npc.y=next.y;npc.facing=Math.abs(dx)>Math.abs(dy)?dx>0?'right':'left':dy>0?'down':'up';npc.moving=true;npc.step+=dt*9;continue;
    }
    if(queueIndex>=0||(manager&&scene.ceoLeaving===manager))continue;
    if(!active)continue;
    npc.timer-=dt;if(npc.timer>0)continue;
    let target;
    if(npc.phase!=='working'){target=npc.home;npc.phase='returning';}
    else {
      npc.cycle++;const action=manager?npc.employee.station:['coffee','rest','team'][npc.cycle%3],spot=scene.getStation(action);
      const offsets=[[0,0],[-28,0],[28,0],[0,28],[-28,28],[28,28]];
      target=spot&&offsets.map(([dx,dy])=>({x:spot.x+dx,y:spot.y+dy})).find(p=>scene.canStand(p.x,p.y)&&![scene.player,...scene.staff.values()].some(other=>other!==npc&&distance(p,other)<26));
      npc.phase='going';npc.activity=action==='coffee'?'Café':action==='rest'?'Pausa':'Conversando';
    }
    const route=target&&scene.findPath(npc,target);
    if(route){npc.path=route;npc.seated=false;}else{npc.phase=npc.seated?'working':'break';npc.timer=3;}
  }
}
export function createRoomDoors(layout,previous=[]){
  return layout.rooms.filter(r=>(r.level==='dedicated'||r.level==='glass'||r.baseEnclosed)&&r.level!=='partition').map(r=>{
    const horizontal=['top','bottom'].includes(r.door),size=r.doorSize||96;
    const x=horizontal?r.x+(r.w-size)/2:r.door==='right'?r.x+r.w-3:r.x+3,y=horizontal?(r.door==='bottom'?r.y+r.h-3:r.y+3):r.y+(r.h-size)/2;
    const old=previous.find(d=>d.id===r.sector&&d.x===x&&d.y===y);
    return {id:r.sector,x,y,size,horizontal,side:r.door,glass:r.level==='glass',center:{x:horizontal?x+size/2:x,y:horizontal?y:y+size/2},progress:old?.progress||0,hold:old?.hold||0};
  });
}
export function updateDoors(scene,dt){
  for(const door of scene.doors||[]){const close=[scene.player,...scene.staff?.values()||[]].some(p=>distance(p,door.center)<78);if(close)door.hold=1.15;else door.hold=Math.max(0,door.hold-dt);const target=door.hold>0?1:0;door.progress=Math.max(0,Math.min(1,door.progress+(target>door.progress?1:-1)*dt*3.4));}
}
