const LABELS={development:'Desenvolvimento',sales:'Comercial',finance:'Financeiro',hr:'RH',meeting:'Reuniões',ceo:'CEO',team:'Mesa do RH',furniture:'Mesa da loja',product:'Laboratório',reception:'Diário',financeAccounts:'Contas a pagar'};
export function validPlacement(value){
  if(value===undefined)return true;
  return Boolean(value&&value.version===1&&value.stages&&typeof value.stages==='object'&&!Array.isArray(value.stages)&&Object.entries(value.stages).every(([stage,items])=>['garage','commercial','floor'].includes(stage)&&items&&typeof items==='object'&&!Array.isArray(items)&&Object.keys(items).length<=80&&Object.entries(items).every(([id,p])=>/^(room:(development|sales|finance|hr|meeting|ceo)|post:post-\d+|table:(sales|finance|financeAccounts|team|furniture|product|reception|meeting|ceo)|board|finance-board|coffee|lounge|decor:plant-[12]|banner)$/.test(id)&&p&&Number.isFinite(p.x)&&Number.isFinite(p.y)&&p.x>=0&&p.y>=0&&p.x<=4000&&p.y<=4000&&(p.door===undefined||['top','right','bottom','left'].includes(p.door)))));
}
export function describeLayout(layout,office){
  return [
    ...layout.rooms.map(r=>({id:`room:${r.sector}`,name:`Setor: ${LABELS[r.sector]}`,x:r.x,y:r.y,w:r.w,h:r.h,door:r.door,group:true})),
    ...layout.posts.map((r,i)=>({id:`post:${office.workstations[i].id}`,name:office.workstations[i].employeeId==='founder'?'Meu computador':`Posto ${i+1}`,x:r.x,y:r.y,w:r.w,h:88})),
    ...Object.entries(layout.tables).map(([id,r])=>({id:`table:${id}`,name:LABELS[id]||id,...r})),
    {id:'board',name:'Quadro de projetos',...layout.board,w:140,h:87},
    {id:'finance-board',name:'Quadro financeiro',...layout.financeBoard},
    {id:'coffee',name:'Copa / cafeteira',...layout.coffee,w:81,h:91},
    {id:'lounge',name:'Sofá / descanso',...layout.lounge},
    ...(office.amenities?.decor?layout.decor.map((p,i)=>({id:`decor:plant-${i+1}`,name:`Planta ${i+1}`,...p,w:34,h:55})):[]),
    ...(office.amenities?.banner?[{id:'banner',name:'Banner da empresa',...layout.banner,w:Math.min(260,Math.max(120,(office.banner?.text||'').length*7+28)),h:25}]:[]),
  ];
}
const FAMILY={development:['work'],sales:['sales'],finance:['finance'],hr:['team'],meeting:['meeting'],ceo:['ceo']};
const FAMILY_TABLES={sales:['sales'],finance:['finance','financeAccounts'],hr:['team'],meeting:['meeting'],ceo:['ceo']};
function shift(o,dx,dy){o.x+=dx;o.y+=dy;}
function shiftStation(layout,action,dx,dy){const s=layout.stations.find(s=>s.action===action);if(!s)return;shift(s,dx,dy);s.labelX+=dx;s.labelY+=dy;shift(s.bounds,dx,dy);}
export function applyPlacement(layout,office){
  const items=office.placement?.stages?.[layout.stage]||{};
  layout.decor=[{x:layout.floor.x+22,y:layout.floor.y+layout.floor.h-17},{x:layout.floor.x+layout.floor.w-30,y:layout.floor.y+layout.floor.h-17}];
  const bannerWidth=Math.min(310,Math.max(140,(office.banner?.text||'').length*7+30));layout.banner={x:layout.floor.x+layout.floor.w-bannerWidth-13,y:layout.floor.y-78};
  for(const room of layout.rooms){const p=items[`room:${room.sector}`];if(!p)continue;const dx=p.x-room.x,dy=p.y-room.y;shift(room,dx,dy);room.door=p.door||room.door;
    for(const action of FAMILY[room.sector]||[])shiftStation(layout,action,dx,dy);
    for(const name of FAMILY_TABLES[room.sector]||[])if(layout.tables[name])shift(layout.tables[name],dx,dy);
    if(room.sector==='development')layout.posts.forEach(o=>shift(o,dx,dy));
    if(room.sector==='finance')shift(layout.financeBoard,dx,dy);
  }
  for(const [id,p] of Object.entries(items)){
    if(id.startsWith('room:'))continue;
    if(id.startsWith('post:')){const i=office.workstations.findIndex(s=>s.id===id.slice(5)),o=layout.posts[i];if(!o)continue;const dx=p.x-o.x,dy=p.y-o.y;shift(o,dx,dy);if(office.workstations[i].employeeId==='founder')shiftStation(layout,'work',dx,dy);}
    else if(id.startsWith('table:')){const name=id.slice(6),o=layout.tables[name];if(!o)continue;const dx=p.x-o.x,dy=p.y-o.y;shift(o,dx,dy);if(!['finance','financeAccounts'].includes(name))shiftStation(layout,name,dx,dy);}
    else if(id.startsWith('decor:')){const o=layout.decor[Number(id.at(-1))-1];Object.assign(o,p);}
    else if(id==='banner')Object.assign(layout.banner,p);
    else {const key=id==='finance-board'?'financeBoard':id,o=layout[key];if(!o)continue;const dx=p.x-o.x,dy=p.y-o.y;shift(o,dx,dy);shiftStation(layout,{board:'board','finance-board':'finance',coffee:'coffee',lounge:'rest'}[id],dx,dy);}
  }
  // Keep the founder interaction attached to their particular desk, even after a move.
  const i=office.workstations?.findIndex(p=>p.employeeId==='founder')??0,post=layout.posts[Math.max(0,i)],s=layout.stations.find(s=>s.action==='work');
  if(post&&s){s.x=post.x+post.w/2;s.y=post.y+88;s.labelX=post.x+post.w/2;s.labelY=post.y-31;s.bounds={x:post.x-8,y:post.y-38,w:post.w+16,h:126};}
  return layout;
}
export function movePlacement(layout,office,items,id,x,y,door){
  const copy=structuredClone(items),objects=describeLayout(layout,office),selected=objects.find(o=>o.id===id);if(!selected)return copy;
  if(selected.group){const dx=x-selected.x,dy=y-selected.y,sector=id.slice(5);for(const child of objects.filter(o=>o.id.startsWith('post:')&&sector==='development'||(FAMILY_TABLES[sector]||[]).some(t=>o.id===`table:${t}`)||o.id==='finance-board'&&sector==='finance')){copy[child.id]={x:child.x+dx,y:child.y+dy};}}
  copy[id]={x:Math.round(x),y:Math.round(y),...(selected.group?{door:door||selected.door}: {})};return copy;
}
