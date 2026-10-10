import { staffExchange } from './people.js';

const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
function meetingSeat(scene,index){
  const room=scene.layout.meeting,station=scene.getStation('meeting');
  const spots=[];
  for(let y=room.y+room.h-38;y>=room.y+56;y-=39)for(let x=room.x+39;x<=room.x+room.w-35;x+=39){
    const point={x,y};
    if(scene.canStand(x,y)&&(!station||distance(point,station)>44))spots.push(point);
  }
  return spots[index]||null;
}
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
  const meeting=scene.state.management?.meeting;
  for(const npc of scene.staff.values()){
    npc.moving=false;
    const manager=npc.employee.area;
    const queue=scene.state.management?.requests||[];
    const queueIndex=manager?queue.findIndex(request=>request.area===manager):-1;
    const meetingIndex=meeting?.attendees.indexOf(npc.employee.id)??-1;
    const meetingLeaving=scene.meetingLeaving?.has(npc.employee.id);
    if((meetingIndex>=0||meetingLeaving)&&scene.state.office?.special?.meeting&&!scene.editor){
      const target=meetingLeaving?npc.home:meetingSeat(scene,meetingIndex);
      npc.seated=false;
      if(target){
        const tag=meetingLeaving?'meeting-leave':`meeting:${meeting.day}:${meetingIndex}`;
        if(npc.meetingTarget!==tag){npc.meetingTarget=tag;npc.path=scene.findPath(npc,target)||[];npc.wait=0;}
        if(distance(npc,target)<9){
          npc.path=[];npc.meetingLocation=meetingLeaving?'left':'inside';
          if(meetingLeaving){scene.meetingLeaving.delete(npc.employee.id);npc.meetingTarget=null;npc.seated=true;}
        }else npc.meetingLocation='walking';
      }
    }else if(manager && (queueIndex>=0 || scene.ceoLeaving===manager) && scene.state.office?.special?.ceo && !scene.editor){
      if(npc.meetingTarget){npc.meetingTarget=null;npc.meetingLocation=null;npc.path=[];}
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
          if(leaving){scene.ceoLeaving=null;npc.returningToArea=true;npc.managerTarget=null;npc.phase='returning';npc.path=scene.findPath(npc,npc.home)||[];}
          if(inside&&!npc.arrivalNotified){npc.arrivalNotified=true;scene.onManagerArrival?.(manager);}
        }else{npc.managerLocation='walking';npc.arrivalNotified=false;}
      }
    }else {
      if(npc.meetingTarget){npc.meetingTarget=null;npc.meetingLocation=null;npc.path=[];}
      if(manager){npc.managerTarget=null;npc.managerLocation='working';npc.arrivalNotified=false;}
      if(npc.returningToArea&&!npc.path.length&&distance(npc,npc.home)>=9)npc.path=scene.findPath(npc,npc.home)||[];
    }
    if(!active&&queueIndex<0&&!(manager&&scene.ceoLeaving===manager)&&meetingIndex<0&&!meetingLeaving&&!npc.returningToArea)continue;
    if(npc.path.length){
      while(npc.path.length&&distance(npc,npc.path[0])<.1)npc.path.shift();
      if(!npc.path.length){npc.seated=queueIndex<0&&npc.phase==='returning';if(npc.seated)npc.returningToArea=false;npc.phase=npc.seated?'working':'break';npc.timer=npc.seated?14+npc.cycle%7:4+npc.cycle%4;continue;}
      const target=npc.path[0],d=distance(npc,target),step=Math.min(d,dt*(105+npc.cycle%3*8)),dx=(target.x-npc.x)/d*step,dy=(target.y-npc.y)/d*step,next={x:npc.x+dx,y:npc.y+dy};
      const people=[scene.player,...scene.staff.values()].filter(p=>p!==npc&&!p.seated&&!(meetingIndex>=0&&meeting?.attendees.includes(p.employee?.id)));
      const personalSpace=meetingIndex>=0||meetingLeaving?10:19;
      if(!scene.canTravelSegment(npc,next)||people.some(p=>distance(p,next)<personalSpace&&distance(p,next)<distance(p,npc))){npc.wait+=dt;if(npc.wait>2.5){npc.timer=2;npc.path=[];npc.phase='break';npc.wait=0; if(queueIndex>=0||(manager&&scene.ceoLeaving===manager))npc.managerTarget=null;if(meetingIndex>=0||meetingLeaving)npc.meetingTarget=null;}continue;}
      npc.wait=0;npc.x=next.x;npc.y=next.y;npc.facing=Math.abs(dx)>Math.abs(dy)?dx>0?'right':'left':dy>0?'down':'up';npc.moving=true;npc.step+=dt*9;continue;
    }
    if(meetingIndex>=0||meetingLeaving||queueIndex>=0||(manager&&scene.ceoLeaving===manager))continue;
    if(npc.returningToArea){if(distance(npc,npc.home)<9){npc.returningToArea=false;npc.seated=true;npc.phase='working';}continue;}
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
  if(meeting&&scene.areMeetingAttendeesReady?.()){
    const tag=`${meeting.day}:${meeting.agenda}`;
    if(scene.meetingReadyTag!==tag){scene.meetingReadyTag=tag;scene.onMeetingReady?.();}
  }else if(!meeting)scene.meetingReadyTag=null;
  updateAmbientConversation(scene,dt,active);
}

function updateAmbientConversation(scene,dt,active){
  if(!active||scene.state.management?.meeting){scene.ambientConversation=null;return;}
  if(scene.ambientConversation){
    scene.ambientConversation.elapsed+=dt;
    if(scene.ambientConversation.elapsed>=7){scene.ambientConversation=null;scene.nextConversationIn=16;}
    return;
  }
  scene.nextConversationIn=(scene.nextConversationIn??9)-dt;
  if(scene.nextConversationIn>0)return;
  const staff=[...scene.staff.values()].filter((person)=>!person.moving&&!person.meetingTarget&&!person.managerTarget);
  const pairs=[];
  for(let a=0;a<staff.length;a++)for(let b=a+1;b<staff.length;b++)if(distance(staff[a],staff[b])<190)pairs.push([staff[a],staff[b]]);
  if(!pairs.length){scene.nextConversationIn=5;return;}
  const pair=pairs[(scene.ambientCycle||0)%pairs.length];
  scene.ambientCycle=(scene.ambientCycle||0)+1;
  scene.ambientConversation={lines:staffExchange(scene.state,pair[0].employee,pair[1].employee),elapsed:0};
}
