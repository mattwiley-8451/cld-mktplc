(function(){
'use strict';
const M=MODEL, VO=M.vocab, LY=M._layout;
const V=THREE.Vector3, D=Math.PI/180;
const $=s=>document.querySelector(s);
const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const hexOf=c=>typeof c==='number'?c:parseInt(String(c||'#888780').replace('#',''),16);
const css=c=>'#'+hexOf(c).toString(16).padStart(6,'0');
const stage=$('#stage'), labelsEl=$('#labels'), insp=$('#insp'), cap=$('#cap'), flat=$('#flat'), tip=$('#tip'), bar=$('#bar');

const meta=M.meta||{};
$('#ttl').textContent=meta.title||'System architecture';
$('#subttl').textContent=[meta.subtitle,meta.source?'Source: '+meta.source:'',meta.asOf?'As of '+meta.asOf:''].filter(Boolean).join(' · ');

const statusOf=s=>VO.status[s]||{label:s,style:'solid'};
const styleOf=s=>statusOf(s).style||'solid';
const stLabel=s=>statusOf(s).label||s;
const stCls=s=>({solid:'ok',glass:'warn',ghost:'unk',missing:'iss'})[styleOf(s)]||'';
const kindOf=k=>VO.kinds[k]||{label:k,color:'#888780'};
const envs=VO.envs||{};
const envName=e=>!e||e==='shared'?'Shared':((envs[e]||{}).label||e);
const confOf=c=>{const v=(VO.confidence||{})[c]; return typeof v==='object'&&v?v:{label:v||c};};
const confName=c=>confOf(c).label||c;
const confCls=c=>{const s=confOf(c).style||({recorded:'solid',stated:'glass',inferred:'ghost'})[c]; return ({solid:'ok',glass:'warn',ghost:'unk'})[s]||'';};
const zoneName=id=>((M.zones.find(z=>z.id===id)||{}).label||id);
const floorName=id=>((M.floors.find(f=>f.id===id)||{}).label||id);
const chip=(t,c,attr)=>`<span class="chip ${c||''}" ${attr||''}>${esc(t)}</span>`;

const toggles={};
Object.entries(VO.status).forEach(([k,s])=>{ if(s&&s.toggle&&s.toggle!=='Issues') toggles[s.toggle]=!!s.toggleDefault; });
const S={env:'all',layers:{flows:true,gaps:false,issues:true,labels:true},toggles,linkMode:'sel',linkCats:{},solid:false,glass:50,lineOp:60,
  b:{},flowOn:{},focus:null,focusLinks:null,sel:null,selEdge:null,selIssue:null,hover:null,step:-1,stepFlows:null,mode:'3d'};
(M.flows||[]).forEach(f=>S.flowOn[f.id]=true);
(M.boundaries||[]).forEach(b=>S.b[b.id]=false);
Object.keys(VO.linkTypes||{}).forEach(k=>S.linkCats[k]=true);
const glassF=()=>S.glass/50, lineF=()=>S.lineOp/60;

let renderer=null;
try{renderer=new THREE.WebGLRenderer({antialias:true}); if(!renderer.getContext()) renderer=null;}catch(err){renderer=null;}
const ok3d=!!renderer;
const scene=new THREE.Scene(); scene.background=new THREE.Color(0x15171c);
const camera=new THREE.PerspectiveCamera(42,1,0.5,4000);
if(ok3d){renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,2)); stage.insertBefore(renderer.domElement,labelsEl);}
scene.add(new THREE.HemisphereLight(0xffffff,0x303440,0.8));
const dl=new THREE.DirectionalLight(0xffffff,0.75); dl.position.set(40,90,60); scene.add(dl);

const planes=[];
function plane(rect,y,color,op){
  const w=rect[2]-rect[0], d=rect[3]-rect[1], g=new THREE.PlaneGeometry(w,d);
  const m=new THREE.MeshStandardMaterial({color,transparent:true,opacity:op,side:THREE.DoubleSide,depthWrite:false,roughness:1});
  const p=new THREE.Mesh(g,m); p.rotation.x=-Math.PI/2; p.position.set(rect[0]+w/2,y-0.05,rect[1]+d/2); p.renderOrder=-2; scene.add(p);
  const eo=Math.min(0.9,op*3+0.25), em=new THREE.LineBasicMaterial({color,transparent:true,opacity:eo});
  const e=new THREE.LineSegments(new THREE.EdgesGeometry(g),em); e.rotation.x=-Math.PI/2; e.position.copy(p.position); scene.add(e);
  planes.push([m,op,em,eo]);
}
const groundY=LY.floors[LY.ground]||0;
const zoneLabels=[];
M.zones.forEach((z,i)=>{const r=LY.zones[z.id]; const col=z.color?hexOf(z.color):(i===0?0x2c2f37:[0x3d2a35,0x2a3540,0x353a2a,0x3a2f2a][(i-1)%4]); plane(r,groundY,col,0.85); zoneLabels.push({t:z.label||z.id,p:new V(r[0]+2,groundY+0.2,r[3]-1)});});
const floorColors=[0x378ADD,0xB4B2A9,0x5DCAA5,0xD4537E];
LY.plates.forEach((p,i)=>{const fi=M.floors.findIndex(f=>f.id===p.floor); plane(p.rect,p.y,floorColors[fi%floorColors.length],0.05); zoneLabels.push({t:floorName(p.floor),p:new V(p.rect[0]+2,p.y,p.rect[3]-1)});});

const ents=[];
M.groups.forEach(g=>ents.push({id:g.id,label:g.label||g.id,short:g.short||g.label||g.id,kind:g.kind,status:g.status,env:g.env||'shared',zone:g.zone,floor:g.floor,box:g.box,reps:[],shape:g.style==='glass'?'cont':g.style,isGroup:true,fields:g.fields||[],notes:g.notes||[],source:g.source,confidence:g.confidence,intent:g.intent}));
M.nodes.forEach(n=>ents.push({id:n.id,label:n.label||n.id,short:n.short||n.label||n.id,kind:n.kind,status:n.status,env:n.env||'shared',zone:n.zone,floor:n.floor,box:n.box,reps:n.reps||[],shape:n.shape||'box',isGroup:false,fields:n.fields||[],notes:n.notes||[],source:n.source,confidence:n.confidence,intent:n.intent}));
const byId={}; ents.forEach(e=>byId[e.id]=e);
const ISS=M.issues||[], BND=M.boundaries||[], FL=M.flows||[], STEPS=M.steps||[];

const ent={}, pick=[];
function geoFor(e){const b=e.box;
  if(e.shape==='cyl') return new THREE.CylinderGeometry(b.w/2,b.w/2,b.h,28);
  if(e.shape==='oct') return new THREE.OctahedronGeometry(b.w/2);
  if(e.shape==='actor') return new THREE.IcosahedronGeometry(b.w/2,1);
  return new THREE.BoxGeometry(b.w,b.h,b.d);}
function labPos(e){const b=e.box;
  if(e.shape==='cont') return new V(b.x-b.w/2+4,b.y+b.h+0.4,b.z-b.d/2+1);
  if(e.shape==='plate') return new V(b.x-b.w/2+5,b.y+0.6,b.z+b.d/2-1);
  if(e.shape==='slab') return new V(b.x,b.y+b.h+0.3,b.z+b.d/2-0.6);
  return new V(b.x,b.y+b.h+1.1,b.z);}
const mset=b=>b.memberSet||b.members;
const issCount={}; ISS.forEach(is=>is.members.forEach(id=>issCount[id]=(issCount[id]||0)+1));
ents.forEach(e=>{
  const color=hexOf(kindOf(e.kind).color), sty=styleOf(e.status), cont=e.shape==='cont', ghost=sty==='ghost'||sty==='missing';
  let op=cont?(sty==='solid'?0.07:0.05):sty==='glass'?0.4:ghost?0.14:0.95;
  if(e.shape==='plate') op=0.6;
  const r={e,mats:[],edges:[],meshes:[],anchors:[],vis:true,f:1,op,cont,plate:e.shape==='plate'};
  [e.box].concat(e.reps).forEach(b=>{
    const parts=e.shape==='gate'?[[new THREE.BoxGeometry(b.w,b.h,b.w),b.h/2,-b.d/2],[new THREE.BoxGeometry(b.w,b.h,b.w),b.h/2,b.d/2],[new THREE.BoxGeometry(b.w,b.w,b.d+b.w),b.h,0]]:[[geoFor({box:b,shape:e.shape}),b.h/2,0]];
    parts.forEach(([g,oy,oz])=>{
      const m=new THREE.MeshStandardMaterial({color,transparent:true,opacity:op,roughness:0.55,metalness:0.05,depthWrite:op>0.9,side:cont?THREE.DoubleSide:THREE.FrontSide,wireframe:ghost&&!cont});
      const mesh=new THREE.Mesh(g,m); mesh.position.set(b.x,b.y+oy,b.z+oz); mesh.userData={id:e.id,cont:cont||e.shape==='plate'};
      scene.add(mesh); r.meshes.push(mesh); r.mats.push(m); pick.push(mesh);
      const em=sty==='glass'?new THREE.LineDashedMaterial({color:0xEF9F27,dashSize:0.7,gapSize:0.45,transparent:true,opacity:1})
        :ghost?new THREE.LineDashedMaterial({color:sty==='missing'?0xF09595:0xB4B2A9,dashSize:0.5,gapSize:0.5,transparent:true,opacity:0.85})
        :new THREE.LineBasicMaterial({color:new THREE.Color(color).lerp(new THREE.Color(0xffffff),0.35),transparent:true,opacity:0.9});
      const eg=new THREE.LineSegments(new THREE.EdgesGeometry(g),em); eg.position.copy(mesh.position);
      if(em.isLineDashedMaterial) eg.computeLineDistances();
      scene.add(eg); r.edges.push([em,em.opacity,eg]);
    });
    r.anchors.push(new V(b.x,b.y+b.h,b.z));
  });
  const lab=document.createElement('div'); lab.className='lab st-'+sty; lab.dataset.id=e.id;
  const ic=issCount[e.id]||0;
  lab.innerHTML='<i></i>'+esc(e.short)+(ic?`<b class="ib">!${ic>1?' '+ic:''}</b>`:'');
  labelsEl.appendChild(lab); r.lab=lab; r.lp=labPos(e);
  ent[e.id]=r;
});

function nearest(a,b){let best=null,bd=1e9;a.anchors.forEach(p=>b.anchors.forEach(q=>{const d=p.distanceTo(q);if(d<bd){bd=d;best=[p,q];}}));return best;}
function arc(a,b,lift){const m=a.clone().add(b).multiplyScalar(0.5); m.y+=lift; return new THREE.QuadraticBezierCurve3(a.clone(),m,b.clone());}
const hitMat=new THREE.MeshBasicMaterial({visible:false});
function mkLine(a,b,sty,kind){
  const [pa,pb]=nearest(ent[a],ent[b]); const c=arc(pa,pb,1.5+pa.distanceTo(pb)*(kind==='gap'?0.2:kind==='need'?0.27:0.12));
  const g=new THREE.BufferGeometry().setFromPoints(c.getPoints(48));
  let m,base,col;
  if(kind==='gap'){col=0xE24B4A; m=new THREE.LineDashedMaterial({color:col,dashSize:0.5,gapSize:0.6,transparent:true,opacity:0.95});base=0.95;}
  else if(kind==='need'){col=0xAFA9EC; m=new THREE.LineDashedMaterial({color:col,dashSize:0.7,gapSize:0.5,transparent:true,opacity:0.95});base=0.95;}
  else if(sty==='solid'){col=0xC2C0B6; m=new THREE.LineBasicMaterial({color:col,transparent:true,opacity:0.45});base=0.45;}
  else{col=sty==='glass'?0xEF9F27:sty==='missing'?0xAFA9EC:0x9c9a92; m=new THREE.LineDashedMaterial({color:col,dashSize:0.9,gapSize:0.6,transparent:true,opacity:0.85});base=0.85;}
  const line=new THREE.Line(g,m); if(m.isLineDashedMaterial) line.computeLineDistances(); scene.add(line);
  const tube=new THREE.Mesh(new THREE.TubeGeometry(c,24,0.65,5,false),hitMat); scene.add(tube);
  return {line,m,base,col,tube};
}
const links=(M.links||[]).map(l=>Object.assign({kind:'link',a:l.from,b:l.to,lbl:l.label||l.type,st:l.status,cat:l.type,src:l},mkLine(l.from,l.to,styleOf(l.status),'link')));
const gaps=(M.gaps||[]).map(g=>Object.assign({kind:'gap',a:g.from,b:g.to,lbl:g.label||'Not linked',st:null,src:g},mkLine(g.from,g.to,null,'gap')));
ISS.forEach(is=>is.links.forEach(([a,b])=>{const l=links.find(x=>(x.a===a&&x.b===b)||(x.a===b&&x.b===a)); if(l)(l.iss=l.iss||[]).push(is.id);}));
const needs=[]; ISS.forEach(is=>is.needs.forEach(nd=>needs.push(Object.assign({kind:'need',a:nd.from,b:nd.to,lbl:nd.label||'Needed',st:null,iss:[is.id],src:nd},mkLine(nd.from,nd.to,null,'need')))));
links.concat(gaps,needs).forEach(o=>o.tube.userData={edge:o});

const flows=[];
const dotGeo=new THREE.SphereGeometry(0.5,12,10);
FL.forEach((f,fi)=>{const color=hexOf(f.color||['#85B7EB','#AFA9EC','#5DCAA5','#ED93B1','#FAC775','#F0997B','#D3D1C7'][fi%7]); f._c=color;
  f.paths.forEach(path=>{
    const cp=new THREE.CurvePath();
    for(let i=0;i<path.length-1;i++){const [pa,pb]=nearest(ent[path[i]],ent[path[i+1]]); cp.add(arc(pa,pb,3+pa.distanceTo(pb)*0.18));}
    const len=cp.getLength();
    const m=new THREE.LineBasicMaterial({color,transparent:true,opacity:0.6});
    const line=new THREE.Line(new THREE.BufferGeometry().setFromPoints(cp.getSpacedPoints(160)),m); scene.add(line);
    const tube=new THREE.Mesh(new THREE.TubeGeometry(cp,80,0.8,5,false),hitMat); scene.add(tube);
    const n=Math.max(3,Math.round(len/8)), dots=[];
    for(let i=0;i<n;i++){const s=new THREE.Mesh(dotGeo,new THREE.MeshBasicMaterial({color,transparent:true,opacity:1})); scene.add(s); dots.push(s);}
    const o={kind:'flow',f,path,cp,len,line,m,dots,tube}; tube.userData={edge:o}; flows.push(o);
  });
});

const bnds={};
BND.forEach(b=>{
  const objs=[], fills=[]; let mn=new V(1e9,1e9,1e9), mx=new V(-1e9,-1e9,-1e9);
  (b.boxes||[]).forEach(([x,y,z,w,h,d])=>{
    const g=new THREE.BoxGeometry(w,h,d);
    const fm=new THREE.MeshBasicMaterial({color:0xE24B4A,transparent:true,opacity:0.07,depthWrite:false,side:THREE.DoubleSide});
    const mesh=new THREE.Mesh(g,fm); mesh.position.set(x,y,z);
    const el=new THREE.LineSegments(new THREE.EdgesGeometry(g),new THREE.LineDashedMaterial({color:0xF09595,dashSize:1,gapSize:0.6}));
    el.position.copy(mesh.position); el.computeLineDistances();
    scene.add(mesh); scene.add(el); objs.push(mesh,el); fills.push(fm);
    mn.min(new V(x-w/2,y-h/2,z-d/2)); mx.max(new V(x+w/2,y+h/2,z+d/2));
  });
  const b0=(b.boxes||[[0,0,0,1,1,1]])[0];
  const lab=document.createElement('div'); lab.className='blab'; lab.textContent=b.id+' · '+(b.label||''); labelsEl.appendChild(lab);
  bnds[b.id]={b,objs,fills,lab,lp:new V(b0[0]-b0[3]/2+2,b0[1]+b0[4]/2,b0[2]-b0[5]/2),c:mn.clone().add(mx).multiplyScalar(0.5),size:mx.clone().sub(mn)};
});
const zones=zoneLabels.map(z=>{const el=document.createElement('div'); el.className='zlab'; el.textContent=z.t; labelsEl.appendChild(el); return {el,p:z.p};});

const envF=e=>(S.env==='all'||!e.env||e.env==='shared')?1:(e.env===S.env?1:0.1);
const focF=id=>(!S.focus||S.focus.has(id))?1:0.1;
function statusVis(st){if(!st) return true; const s=statusOf(st); if(!s.toggle) return true; if(s.toggle==='Issues') return S.layers.issues; return !!S.toggles[s.toggle];}
function entVis(e){return statusVis(e.status);}
const isSelEdge=o=>S.selEdge===o;
const inIssue=l=>S.selIssue&&l.iss&&l.iss.includes(S.selIssue);
function linkShown(l){
  if(!ent[l.a].vis||!ent[l.b].vis) return false;
  if(isSelEdge(l)||inIssue(l)) return true;
  if(!statusVis(l.st)) return false;
  if(S.linkCats[l.cat]===false) return false;
  if(S.linkMode==='off') return false;
  if(S.linkMode==='all') return true;
  if(S.focusLinks) return S.focusLinks.has(l);
  if(S.focus) return S.focus.has(l.a)&&S.focus.has(l.b);
  return false;
}
function linkF(l){if(isSelEdge(l)||S.hover===l||inIssue(l)) return 1; if(!S.focus) return 1; if(S.focusLinks) return S.focusLinks.has(l)?1:0.05; return S.focus.has(l.a)&&S.focus.has(l.b)?1:0.05;}
function entOp(r){
  if(r.cont) return Math.min(0.5,r.op*glassF());
  if(r.plate) return Math.min(0.95,r.op*glassF());
  if(S.solid&&styleOf(r.e.status)!=='ghost'&&styleOf(r.e.status)!=='missing') return 0.95;
  return r.op;
}
function refresh(){
  labelsEl.classList.toggle('noiss',!S.layers.issues);
  planes.forEach(([m,op,em,eo])=>{m.opacity=Math.min(0.97,op*glassF()); em.opacity=Math.min(0.95,eo*Math.max(0.4,glassF()));});
  Object.values(ent).forEach(r=>{
    const v=entVis(r.e), f=envF(r.e)*focF(r.e.id), op=entOp(r); r.vis=v; r.f=f;
    r.meshes.forEach(m=>m.visible=v);
    r.mats.forEach(m=>{m.opacity=op*f; m.depthWrite=op*f>0.9;});
    r.edges.forEach(([m,eo,eg])=>{eg.visible=v; m.opacity=eo*Math.max(f,0.08);});
    r.lab.style.display=(v&&S.layers.labels)?'':'none';
    r.lab.style.opacity=f<1?0.22:1;
    r.lab.classList.toggle('sel',S.sel===r.e.id||(S.selEdge&&S.selEdge.kind!=='flow'&&(S.selEdge.a===r.e.id||S.selEdge.b===r.e.id)));
  });
  const ef=l=>Math.min(envF(byId[l.a]),envF(byId[l.b]));
  links.forEach(l=>{l.line.visible=linkShown(l); const hot=isSelEdge(l)||S.hover===l; l.m.color.setHex(hot?0xffffff:(S.layers.issues&&l.iss?0xF09595:l.col)); l.m.opacity=hot?1:Math.min(1,l.base*lineF()*linkF(l)*ef(l));});
  gaps.forEach(l=>{l.line.visible=(S.layers.gaps&&ent[l.a].vis&&ent[l.b].vis)||isSelEdge(l); const hot=isSelEdge(l)||S.hover===l; l.m.color.setHex(hot?0xffffff:l.col); l.m.opacity=hot?1:Math.min(1,l.base*lineF()*linkF(l)*ef(l));});
  needs.forEach(l=>{l.line.visible=S.layers.issues&&ent[l.a].vis&&ent[l.b].vis&&(isSelEdge(l)||inIssue(l)||(S.sel&&(l.a===S.sel||l.b===S.sel))); const hot=isSelEdge(l)||S.hover===l; l.m.color.setHex(hot?0xffffff:l.col); l.m.opacity=hot?1:Math.min(1,l.base*lineF());});
  flows.forEach(x=>{
    const v=S.layers.flows&&S.flowOn[x.f.id]&&(!S.stepFlows||S.stepFlows.has(x.f.id))&&x.path.every(id=>ent[id].vis)&&statusVis(x.f.status);
    let ff=1;
    if(S.selIssue) ff=0.06;
    else if(S.selEdge&&S.selEdge.kind==='flow') ff=S.selEdge.f===x.f?1:0.07;
    else if(S.selEdge) ff=0.12;
    else if(S.sel) ff=x.path.includes(S.sel)?1:0.07;
    const hot=(S.hover&&S.hover.kind==='flow'&&S.hover.f===x.f)||(S.selEdge&&S.selEdge.kind==='flow'&&S.selEdge.f===x.f);
    const fe=Math.min(...x.path.map(id=>envF(byId[id])));
    x.line.visible=v; x.m.opacity=hot?1:Math.min(1,0.6*lineF()*ff*fe);
    x.dots.forEach(d=>{d.visible=v; d.material.opacity=ff*fe; d.scale.setScalar(hot?1.7:1);});
  });
  Object.values(bnds).forEach(bb=>{const tg=bb.b.toggle; const v=S.b[bb.b.id]&&(!tg||S.toggles[tg]); bb.objs.forEach(o=>o.visible=v); bb.fills.forEach(m=>m.opacity=Math.min(0.4,0.07*glassF())); bb.lab.style.display=v?'':'none';});
  bar.querySelectorAll('button[data-b]').forEach(btn=>{btn.classList.toggle('bon',!!S.b[btn.dataset.b]); const tg=(bnds[btn.dataset.b].b||{}).toggle; btn.disabled=!!tg&&!S.toggles[tg];});
  const ba=$('#b-ball'); if(ba){const allOn=BND.every(b=>S.b[b.id]||(b.toggle&&!S.toggles[b.toggle])); ba.classList.toggle('bon',allOn); ba.textContent=allOn?'Hide all':'Show all';}
  if(S.mode==='2d') build2d();
}

const bounds=LY.bounds;
const cam={t:new V(),r:150,th:0,ph:1};
function setCam(p){cam.t.set(...p.t); cam.r=p.r; cam.th=p.th*D; cam.ph=p.ph*D;}
function applyCam(){const s=Math.sin(cam.ph); camera.position.set(cam.t.x+cam.r*s*Math.sin(cam.th),cam.t.y+cam.r*Math.cos(cam.ph),cam.t.z+cam.r*s*Math.cos(cam.th)); camera.lookAt(cam.t);}
let tw=null;
function tweenTo(p){
  const from={t:cam.t.clone(),r:cam.r,th:cam.th,ph:cam.ph}; let th2=p.th*D;
  while(th2-from.th>Math.PI) th2-=2*Math.PI; while(th2-from.th<-Math.PI) th2+=2*Math.PI;
  tw={from,to:{t:new V(...p.t),r:p.r,th:th2,ph:p.ph*D},s:performance.now(),d:1100};
}
function bboxOf(ids){const mn=new V(1e9,1e9,1e9), mx=new V(-1e9,-1e9,-1e9); let any=false;
  ids.forEach(id=>{const e=byId[id]; if(!e||!ent[id].vis) return; [e.box].concat(e.reps).forEach(b=>{any=true; mn.min(new V(b.x-b.w/2,b.y,b.z-b.d/2)); mx.max(new V(b.x+b.w/2,b.y+b.h,b.z+b.d/2));});});
  return any?{c:mn.clone().add(mx).multiplyScalar(0.5),s:mx.clone().sub(mn)}:null;}
function frame(bb,th,ph){const r=Math.max(bb.s.x,bb.s.z,bb.s.y*1.5)*1.05+30; return {t:[bb.c.x,bb.c.y,bb.c.z],r,th:th==null?cam.th/D:th,ph:ph==null?Math.min(Math.max(cam.ph/D,35),65):ph};}
const span=Math.max(bounds[2]-bounds[0],bounds[3]-bounds[1]);
const VIEWS=[];
VIEWS.push({id:'overview',label:'Overview',t:[(bounds[0]+bounds[2])/2,groundY+2,(bounds[1]+bounds[3])/2],r:span*1.05+45,th:-22,ph:52});
VIEWS.push({id:'top',label:'Top-down',t:[(bounds[0]+bounds[2])/2,groundY,(bounds[1]+bounds[3])/2],r:span*1.15+45,th:0,ph:1});
M.floors.forEach(f=>{const ids=ents.filter(e=>e.floor===f.id).map(e=>e.id); if(!ids.length||M.floors.length<2) return; const bb=bboxOf(ids)||{c:new V(0,0,0),s:new V(20,5,20)}; const below=(f.level||0)<0; VIEWS.push(Object.assign({id:'floor:'+f.id,label:f.label||f.id},frame(bb,-24,below?108:44)));});
if(M.zones.length>1) M.zones.forEach(z=>{const r=LY.zones[z.id]; VIEWS.push({id:'zone:'+z.id,label:z.label||z.id,t:[(r[0]+r[2])/2,groundY+3,(r[1]+r[3])/2],r:Math.max(r[2]-r[0],r[3]-r[1])*1.1+35,th:-40,ph:56});});
(M.views||[]).forEach(v=>{let p; if(v.focus){const bb=bboxOf(v.focus); if(!bb) return; p=frame(bb,v.theta,v.phi);} else p={t:v.target||[0,0,0],r:v.r||100,th:v.theta==null?-22:v.theta,ph:v.phi==null?52:v.phi}; const i=VIEWS.findIndex(x=>x.id===v.id); const o=Object.assign({id:v.id,label:v.label||v.id},p); if(i>=0) VIEWS[i]=o; else VIEWS.push(o);});
const viewById=id=>VIEWS.find(v=>v.id===id);
setCam(VIEWS[0]);

function pickAt(ev){
  const rc=renderer.domElement.getBoundingClientRect();
  const ndc=new THREE.Vector2(((ev.clientX-rc.left)/rc.width)*2-1,-((ev.clientY-rc.top)/rc.height)*2+1);
  const ray=new THREE.Raycaster(); ray.setFromCamera(ndc,camera);
  const cands=pick.filter(m=>m.visible).concat(links.concat(gaps,needs).filter(l=>l.line.visible).map(l=>l.tube),flows.filter(x=>x.line.visible).map(x=>x.tube));
  const hits=ray.intersectObjects(cands,false); if(!hits.length) return null;
  const good=h=>{const u=h.object.userData; if(u.edge) return true; return !u.cont&&ent[u.id].f>0.5;};
  const h=hits.find(good)||hits.find(x=>x.object.userData.edge||!x.object.userData.cont)||hits[0];
  const u=h.object.userData; return u.edge?{edge:u.edge}:{id:u.id};
}
function edgeTitle(o){
  if(o.kind==='flow') return 'Flow: '+(o.f.label||o.f.id);
  return (o.kind==='gap'?'Missing link: ':o.kind==='need'?'Needed: ':'')+byId[o.a].short+' → '+byId[o.b].short+(o.kind==='gap'?'':' · '+o.lbl);
}
function pan(dx,dy){const s=cam.r*0.0016; const right=new V().setFromMatrixColumn(camera.matrix,0), up=new V().setFromMatrixColumn(camera.matrix,1); cam.t.addScaledVector(right,-dx*s).addScaledVector(up,dy*s);}
let drag=null, hoverPending=false;
stage.addEventListener('pointerdown',ev=>{
  if(ev.target.closest('.ui')) return;
  drag={x:ev.clientX,y:ev.clientY,moved:0,pan:ev.button===2||ev.shiftKey,target:ev.target};
  try{stage.setPointerCapture(ev.pointerId);}catch(err){}
  tw=null; tip.style.display='none';
});
function hoverAt(ev){
  if(ev.target.closest&&ev.target.closest('.ui')){tip.style.display='none'; return;}
  const isLab=ev.target.classList&&ev.target.classList.contains('lab');
  const p=isLab?null:pickAt(ev), edge=p&&p.edge?p.edge:null;
  if(edge!==S.hover){S.hover=edge; refresh();}
  stage.style.cursor=(isLab||p)?'pointer':'grab';
  if(edge){const rc=stage.getBoundingClientRect(); tip.textContent=edgeTitle(edge); tip.style.display='block'; tip.style.transform=`translate(${ev.clientX-rc.left+14}px,${ev.clientY-rc.top+12}px)`;}
  else tip.style.display='none';
}
stage.addEventListener('pointermove',ev=>{
  if(!drag){ if(ok3d&&!hoverPending){hoverPending=true; requestAnimationFrame(()=>{hoverPending=false; hoverAt(ev);});} return; }
  const dx=ev.clientX-drag.x, dy=ev.clientY-drag.y; drag.x=ev.clientX; drag.y=ev.clientY; drag.moved+=Math.abs(dx)+Math.abs(dy);
  if(drag.pan) pan(dx,dy); else {cam.th-=dx*0.006; cam.ph=Math.min(2.6,Math.max(0.02,cam.ph-dy*0.006));}
});
stage.addEventListener('pointerleave',()=>{tip.style.display='none'; if(S.hover){S.hover=null; refresh();}});
stage.addEventListener('pointerup',ev=>{
  if(!drag) return; const d=drag; drag=null;
  if(d.moved<5){
    const lab=d.target.closest&&d.target.closest('.lab');
    if(lab){select(lab.dataset.id); return;}
    const p=pickAt(ev);
    if(!p) select(null); else if(p.edge) selectEdge(p.edge); else select(p.id);
  }
});
stage.addEventListener('contextmenu',ev=>ev.preventDefault());
stage.addEventListener('wheel',ev=>{if(ev.target.closest('.ui')) return; ev.preventDefault(); tw=null; cam.r=Math.min(span*4+200,Math.max(10,cam.r*(1+ev.deltaY*0.0012)));},{passive:false});
document.addEventListener('keydown',ev=>{
  if(ev.target.tagName==='INPUT') return;
  if(S.step>=0&&ev.key==='ArrowRight'){play(S.step+1);ev.preventDefault();}
  else if(S.step>=0&&ev.key==='ArrowLeft'){play(Math.max(0,S.step-1));ev.preventDefault();}
  else if(ev.key==='Escape'){ if(S.step>=0) exitPlay(); else select(null); }
});

function neighbors(id){
  const nb=new Set([id]), fl=new Set();
  links.forEach(l=>{if(l.a===id||l.b===id){nb.add(l.a);nb.add(l.b);fl.add(l);}});
  if(S.layers.gaps) gaps.forEach(l=>{if(l.a===id||l.b===id){nb.add(l.a);nb.add(l.b);fl.add(l);}});
  if(S.layers.issues) needs.forEach(l=>{if(l.a===id||l.b===id){nb.add(l.a);nb.add(l.b);fl.add(l);}});
  FL.forEach(f=>f.paths.forEach(p=>{if(p.includes(id)) p.forEach(x=>nb.add(x));}));
  return [nb,fl];
}
function leaveStep(){ if(S.step>=0){S.step=-1; cap.style.display='none'; S.stepFlows=null;} }
function clearSel(){S.sel=null; S.selEdge=null; S.selIssue=null;}
function select(id){
  leaveStep(); clearSel(); S.sel=id||null;
  if(!id){S.focus=null; S.focusLinks=null; refresh(); intro(); return;}
  const [nb,fl]=neighbors(id); S.focus=nb; S.focusLinks=fl; refresh(); showEnt(id);
}
const onPath=(f,a,b)=>f.paths.some(p=>p.some((x,i)=>i<p.length-1&&((x===a&&p[i+1]===b)||(x===b&&p[i+1]===a))));
function selectEdge(o){
  leaveStep(); clearSel(); S.selEdge=o;
  if(o.kind==='flow'){const ids=new Set(o.f.paths.flat()); S.focus=ids; S.focusLinks=new Set(links.filter(l=>onPath(o.f,l.a,l.b)));}
  else {S.focus=new Set([o.a,o.b]); S.focusLinks=new Set([o]);}
  refresh(); if(o.kind==='flow') showFlow(o.f); else if(o.kind==='need') showNeed(o); else showEdge(o);
}

function srcHtml(x){ if(!x.source&&!x.confidence) return ''; return `<p class="src">${x.confidence?chip(confName(x.confidence),confCls(x.confidence))+' ':''}${x.source?'Source: '+esc(x.source):''}</p>`; }
function crossHtml(a,b){
  const A=byId[a], Bn=byId[b], leaves=[], enters=[];
  BND.forEach(bd=>{ if(bd.toggle&&!S.toggles[bd.toggle]) return; const ia=mset(bd).includes(a), ib=mset(bd).includes(b); if(ia&&!ib) leaves.push(bd); if(ib&&!ia) enters.push(bd); });
  const envX=A.env!=='shared'&&Bn.env!=='shared'&&A.env!==Bn.env, zoneX=A.zone!==Bn.zone, floorX=A.floor!==Bn.floor;
  if(!leaves.length&&!enters.length&&!envX&&!zoneX&&!floorX) return '<p class="m">Stays inside the same zone, floor and boundaries.</p>';
  let h='<ul>';
  if(zoneX) h+=`<li>Crosses zones: ${esc(zoneName(A.zone))} to ${esc(zoneName(Bn.zone))}</li>`;
  if(envX) h+=`<li>Crosses environments: ${esc(envName(A.env))} to ${esc(envName(Bn.env))}</li>`;
  if(floorX) h+=`<li>Crosses floors: ${esc(floorName(A.floor))} to ${esc(floorName(Bn.floor))}</li>`;
  const bc=x=>chip(x.id+' · '+(x.label||''),'bd',`data-b="${esc(x.id)}"`);
  if(leaves.length) h+='<li>Leaves '+leaves.map(bc).join(' ')+'</li>';
  if(enters.length) h+='<li>Enters '+enters.map(bc).join(' ')+'</li>';
  return h+'</ul>';
}
const issueById=id=>ISS.find(x=>x.id===id);
const issLink=is=>`<a data-iss="${esc(is.id)}">${esc(is.title||is.id)}</a>`;
function showEdge(l){
  const A=byId[l.a], Bn=byId[l.b], gap=l.kind==='gap', s=l.src||{};
  const lt=(VO.linkTypes||{})[l.cat]||{};
  let h=`<button class="x" data-close="1" aria-label="Close">×</button><h3>${gap?'Missing link':'Link'}: ${esc(A.short)} → ${esc(Bn.short)}</h3>
  <div class="chips">${gap?chip('Not in source','unk'):chip(stLabel(l.st),stCls(l.st))}${gap?'':chip(lt.label||l.cat)}</div>${srcHtml(s)}
  <table><tr><th>From</th><td><a data-id="${esc(l.a)}">${esc(A.label)}</a></td></tr><tr><th>To</th><td><a data-id="${esc(l.b)}">${esc(Bn.label)}</a></td></tr><tr><th>${gap?'What is missing':'Relationship'}</th><td>${esc(l.lbl)}</td></tr></table>`;
  const ex=s.explain||(gap?'':lt.explain); if(ex) h+=`<p class="lbl">What it means</p><p>${esc(ex)}</p>`;
  if(s.note) h+=`<p class="lbl">Observation</p><p>${esc(s.note)}</p>`;
  h+='<p class="lbl">Crossings</p>'+crossHtml(l.a,l.b);
  if(!gap){const fs=FL.filter(f=>onPath(f,l.a,l.b)); if(fs.length) h+='<p class="lbl">Flows on this link</p><ul>'+fs.map(f=>`<li><span class="sw2" style="background:${css(f._c)}"></span><a data-flow="${esc(f.id)}">${esc(f.label||f.id)}</a></li>`).join('')+'</ul>';}
  if(l.iss) h+='<p class="lbl">Issues</p><ul>'+l.iss.map(id=>`<li>${issLink(issueById(id))}</li>`).join('')+'</ul>';
  insp.innerHTML=h; insp.scrollTop=0;
}
function showNeed(l){
  const is=issueById(l.iss[0]);
  insp.innerHTML=`<button class="x" data-close="1" aria-label="Close">×</button><h3>Needed link: ${esc(byId[l.a].short)} → ${esc(byId[l.b].short)}</h3><div class="chips">${chip('Needed, not in source','iss')}</div><p>${esc(l.lbl)}</p><p class="lbl">Part of</p><p>${issLink(is)}</p><p class="lbl">Crossings</p>${crossHtml(l.a,l.b)}`;
  insp.scrollTop=0;
}
function showFlow(f){
  const ls=links.filter(l=>onPath(f,l.a,l.b)), segs=[];
  f.paths.forEach(p=>{for(let i=0;i<p.length-1;i++) segs.push([p[i],p[i+1]]);});
  let h=`<button class="x" data-close="1" aria-label="Close">×</button><h3><span class="sw2" style="background:${css(f._c)}"></span>Flow: ${esc(f.label||f.id)}</h3>
  <div class="chips">${f.status?chip(stLabel(f.status),stCls(f.status)):''}</div>${srcHtml(f)}`;
  if(f.quote) h+=`<p class="lbl">What the source says</p><p>${esc(f.quote)}</p>`;
  if(f.description) h+=`<p class="lbl">Description</p><p>${esc(f.description)}</p>`;
  h+=`<p class="lbl">Paths</p><ul>${f.paths.map(p=>'<li>'+p.map(id=>`<a data-id="${esc(id)}">${esc(byId[id].short)}</a>`).join(' → ')+'</li>').join('')}</ul>`;
  h+='<p class="lbl">Crossings</p>'+segs.map(([a,b])=>`<p class="m" style="margin:6px 0 0">${esc(byId[a].short)} → ${esc(byId[b].short)}</p>`+crossHtml(a,b)).join('');
  h+='<p class="lbl">Recorded links along this flow</p>'+(ls.length?'<ul>'+ls.map(l=>`<li><a data-link="${links.indexOf(l)}">${esc(byId[l.a].short)} → ${esc(byId[l.b].short)}</a> <span class="m">${esc(l.lbl)}</span> ${chip(stLabel(l.st),stCls(l.st))}</li>`).join('')+'</ul>':'<p class="m">None: no recorded link backs this flow.</p>');
  insp.innerHTML=h; insp.scrollTop=0;
}
function intro(){
  const counts={}; ents.forEach(e=>counts[e.status]=(counts[e.status]||0)+1);
  const kindsUsed=[...new Set(ents.filter(e=>!e.isGroup).map(e=>e.kind))];
  const shapeName={box:'boxes',tower:'towers',cyl:'cylinders',oct:'octahedrons',actor:'spheres',gate:'gates'};
  let h=`<h3>${esc(meta.title||'System architecture')}</h3>`;
  if(meta.summary) h+=`<p>${esc(meta.summary)}</p>`;
  h+='<div class="kv">'+Object.entries(counts).map(([k,n])=>`<b>${n}</b><span>${esc(stLabel(k))}</span>`).join('')+[[links.length,'links'],[FL.length,'flows'],[BND.length,'security boundaries'],[ISS.length,'issues']].filter(x=>x[0]).map(([n,t])=>`<b>${n}</b><span>${t}</span>`).join('')+'</div>';
  h+='<p class="lbl">Reading the scene</p><ul>';
  if(M.zones.length>1) h+=`<li>Zones, side by side: ${M.zones.map(z=>esc(z.label||z.id)).join(', ')}.</li>`;
  if(M.floors.length>1) h+=`<li>Floors, top to bottom: ${M.floors.slice().sort((a,b)=>(b.level||0)-(a.level||0)).map(f=>esc(f.label||f.id)).join(', ')}.</li>`;
  h+='<li>Kinds: '+kindsUsed.map(k=>`<span class="sw2" style="background:${css(kindOf(k).color)}"></span>${esc(kindOf(k).label)}`).join(', ')+'.</li>';
  h+='<li>Glass volumes, slabs and plates are groupings such as resource groups, clusters and accounts.</li>';
  h+='<li>Solid means '+esc(stLabel(Object.keys(VO.status).find(k=>styleOf(k)==='solid')||''))+'. Translucent with amber dashed edges, wireframe and red dashed wireframe show the other statuses (see the legend).</li>';
  h+='<li>Links appear for whatever you select; switch Links to All to see every one. Every line is clickable.</li></ul>';
  if(ISS.length) h+=`<p class="lbl">Issues</p><ul><li>Red "!" badges mark items involved in an issue. Use Issues (${ISS.length}) to list them; problem links show in red, needed links in purple dashed.</li></ul>`;
  h+='<p class="lbl">Too busy?</p><ul><li>Turn on Solid, or drag Glass and Lines down.</li><li>Untick link types or flows in the legend.</li>'+(Object.keys(envs).length?'<li>Pick one environment.</li>':'')+'</ul>';
  if(STEPS.length) h+='<p class="lbl">Try</p><ul><li>Play the walkthrough, then use the arrow keys.</li></ul>';
  (meta.notes||[]).length&&(h+='<p class="lbl">Notes</p><ul>'+meta.notes.map(n=>`<li>${esc(n)}</li>`).join('')+'</ul>');
  insp.innerHTML=h;
}
function showEnt(id){
  const e=byId[id];
  let h=`<button class="x" data-close="1" aria-label="Close">×</button><h3>${esc(e.label)}</h3><div class="chips">${chip(stLabel(e.status),stCls(e.status))}${chip(envName(e.env))}${chip(kindOf(e.kind).label)}${M.zones.length>1?chip(zoneName(e.zone)):''}</div>${srcHtml(e)}`;
  if(e.fields.length) h+='<table>'+e.fields.map(([k,v])=>`<tr><th>${esc(k)}</th><td>${esc(v)}</td></tr>`).join('')+'</table>';
  const rel=links.filter(l=>l.a===id||l.b===id);
  if(rel.length) h+='<p class="lbl">Links</p><ul>'+rel.map(l=>{const o=l.a===id?l.b:l.a; return `<li>${l.a===id?'→':'←'} <a data-id="${esc(o)}">${esc(byId[o].short)}</a> <a data-link="${links.indexOf(l)}" class="m">${esc(l.lbl)}</a> ${chip(stLabel(l.st),stCls(l.st))}</li>`;}).join('')+'</ul>';
  const fs=FL.filter(f=>f.paths.some(p=>p.includes(id)));
  if(fs.length) h+='<p class="lbl">Flows</p><ul>'+fs.map(f=>`<li><span class="sw2" style="background:${css(f._c)}"></span><a data-flow="${esc(f.id)}">${esc(f.label||f.id)}</a></li>`).join('')+'</ul>';
  const gs=gaps.filter(g=>g.a===id||g.b===id);
  if(gs.length) h+='<p class="lbl">Gaps (links the source does not have)</p><ul>'+gs.map(g=>{const o=g.a===id?g.b:g.a; return `<li><a data-gap="${gaps.indexOf(g)}">${esc(g.lbl)}</a>: <a data-id="${esc(o)}">${esc(byId[o].short)}</a></li>`;}).join('')+'</ul>';
  if(e.notes.length) h+='<p class="lbl">Observations</p><ul>'+e.notes.map(o=>`<li>${esc(o)}</li>`).join('')+'</ul>';
  if(e.intent) h+=`<p class="lbl">Intended design</p><p>${esc(e.intent)}</p>`;
  const iss=ISS.filter(x=>x.members.includes(id)); if(iss.length) h+='<p class="lbl">Issues</p><ul>'+iss.map(is=>`<li>${issLink(is)}</li>`).join('')+'</ul>';
  const bs=BND.filter(b=>mset(b).includes(id));
  if(bs.length) h+='<p class="lbl">Inside boundaries</p><div class="chips">'+bs.map(b=>chip(b.id+' · '+(b.label||''),'bd',`data-b="${esc(b.id)}"`)).join('')+'</div>';
  insp.innerHTML=h; insp.scrollTop=0;
}
function showBPanel(id){
  const b=bnds[id].b;
  insp.innerHTML=`<button class="x" data-close="1" aria-label="Close">×</button><h3>${esc(b.id)} · ${esc(b.label||'')}</h3><div class="chips">${chip('Security boundary','bd')}</div>${b.description?`<p>${esc(b.description)}</p>`:''}
  ${b.records.length?`<p class="lbl">What the source records</p><ul>${b.records.map(x=>`<li>${esc(x)}</li>`).join('')}</ul>`:''}
  ${b.open.length?`<p class="lbl">Open questions</p><ul>${b.open.map(x=>`<li>${esc(x)}</li>`).join('')}</ul>`:''}
  <p class="lbl">Members</p><ul>${b.members.map(x=>`<li><a data-id="${esc(x)}">${esc(byId[x].short)}</a></li>`).join('')}</ul>`;
  insp.scrollTop=0;
}
function showB(id){
  const bb=bnds[id]; S.b[id]=true; leaveStep(); clearSel(); S.focus=new Set(mset(bb.b)); S.focusLinks=null;
  refresh(); showBPanel(id);
  if(S.mode==='3d') tweenTo({t:[bb.c.x,bb.c.y,bb.c.z],r:Math.max(bb.size.x,bb.size.z)*1.25+30,th:cam.th/D,ph:Math.min(Math.max(cam.ph/D,35),70)});
}
const issChip=is=>chip(is.category||'Issue','iss');
function showIssues(){
  insp.innerHTML=`<h3>Issues</h3>${meta.issuesIntro?`<p class="m">${esc(meta.issuesIntro)}</p>`:''}<ul>${ISS.map((is,i)=>`<li><a data-iss="${esc(is.id)}">${i+1}. ${esc(is.title||is.id)}</a> ${issChip(is)}</li>`).join('')}</ul><p class="src">Red lines are problem links, purple dashed lines are links that are needed, red dashed boxes are missing items.</p>`;
  insp.scrollTop=0;
}
function showIssue(is){
  const pl=links.filter(l=>l.iss&&l.iss.includes(is.id)), nd=needs.filter(l=>l.iss.includes(is.id));
  const li=a=>a.map(x=>`<li>${esc(x)}</li>`).join('');
  insp.innerHTML=`<button class="x" data-close="1" aria-label="Close">×</button><p class="src"><a data-isslist="1">← All issues</a></p><h3>${esc(is.title||is.id)}</h3><div class="chips">${issChip(is)}</div>
  ${is.records.length?`<p class="lbl">What the source records</p><ul>${li(is.records)}</ul>`:''}
  ${is.cause?`<p class="lbl">Likely cause</p><p>${esc(is.cause)}</p>`:''}
  ${is.fix.length?`<p class="lbl">What needs to change</p><ul>${li(is.fix)}</ul>`:''}
  ${pl.length?`<p class="lbl">Problem links (red)</p><ul>${pl.map(l=>`<li><a data-link="${links.indexOf(l)}">${esc(byId[l.a].short)} → ${esc(byId[l.b].short)}</a> <span class="m">${esc(l.lbl)}</span></li>`).join('')}</ul>`:''}
  ${nd.length?`<p class="lbl">Needed links (purple dashed)</p><ul>${nd.map(l=>`<li><a data-need="${needs.indexOf(l)}">${esc(byId[l.a].short)} → ${esc(byId[l.b].short)}</a> <span class="m">${esc(l.lbl)}</span></li>`).join('')}</ul>`:''}
  <p class="lbl">Affected</p><div class="chips">${is.members.map(id=>`<a data-id="${esc(id)}" class="chip">${esc(byId[id].short)}</a>`).join('')}</div>`;
  insp.scrollTop=0;
}
function selectIssue(id){
  const is=issueById(id); leaveStep(); clearSel(); S.selIssue=id;
  if(!S.layers.issues){S.layers.issues=true; const b=bar.querySelector('[data-layer="issues"]'); if(b) b.classList.add('on');}
  const ids=new Set(is.members); is.links.forEach(([a,b])=>{ids.add(a);ids.add(b);}); is.needs.forEach(n=>{ids.add(n.from);ids.add(n.to);});
  S.focus=ids; S.focusLinks=new Set(links.filter(l=>l.iss&&l.iss.includes(id)));
  refresh(); showIssue(is);
  if(S.mode==='3d'){const bb=bboxOf([...ids]); if(bb) tweenTo(frame(bb));}
}
function onPanelClick(ev){
  const t=ev.target;
  const a=t.closest('[data-id]'); if(a){ev.preventDefault(); select(a.dataset.id); return;}
  const lk=t.closest('[data-link]'); if(lk){selectEdge(links[+lk.dataset.link]); return;}
  const gp=t.closest('[data-gap]'); if(gp){selectEdge(gaps[+gp.dataset.gap]); return;}
  const nd=t.closest('[data-need]'); if(nd){selectEdge(needs[+nd.dataset.need]); return;}
  const fw=t.closest('[data-flow]'); if(fw&&fw.tagName!=='INPUT'){const x=flows.find(o=>o.f.id===fw.dataset.flow); if(x) selectEdge(x); return;}
  const is=t.closest('[data-iss]'); if(is){selectIssue(is.dataset.iss); return;}
  if(t.closest('[data-isslist]')){showIssues(); return;}
  const b=t.closest('[data-b]'); if(b){showB(b.dataset.b); return;}
  if(t.closest('[data-close]')) select(null);
}
insp.addEventListener('click',onPanelClick);

function stepView(s){
  if(s.view&&viewById(s.view)) return viewById(s.view);
  if(s.focus.length){const bb=bboxOf(s.focus); if(bb) return frame(bb,-24,50);}
  return VIEWS[0];
}
function play(i){
  if(i<0||i>=STEPS.length){exitPlay(); return;}
  if(S.mode==='2d') set2d(false);
  const s=STEPS[i]; S.step=i; clearSel();
  S.focus=s.focus.length?new Set(s.focus.concat(...s.flows.filter(id=>id!=='all').map(id=>(FL.find(f=>f.id===id)||{paths:[]}).paths.flat()))):null; S.focusLinks=null;
  S.stepFlows=s.flows.includes('all')?null:new Set(s.flows);
  BND.forEach(b=>S.b[b.id]=s.boundaries.includes(b.id));
  refresh(); tweenTo(stepView(s));
  const qs=s.flows.map(id=>FL.find(f=>f.id===id)).filter(f=>f&&f.quote).map(f=>`<p class="q"><span class="sw2" style="background:${css(f._c)}"></span>${esc(f.quote)}</p>`).join('');
  cap.innerHTML=`<div><b>${esc(s.title||'Step '+(i+1))}</b> <span style="color:#b4b2a9">· ${i+1} of ${STEPS.length}</span></div><p>${esc(s.text||'')}</p>${qs}<div class="nav"><button data-nav="-1" ${i===0?'disabled':''}>Back</button><button data-nav="1">${i===STEPS.length-1?'Finish':'Next'}</button><button data-nav="x">Exit</button></div>`;
  cap.style.display='block';
  if(s.boundaries.length) showBPanel(s.boundaries[s.boundaries.length-1]); else intro();
}
function exitPlay(){S.step=-1; S.stepFlows=null; S.focus=null; clearSel(); BND.forEach(b=>S.b[b.id]=false); cap.style.display='none'; refresh(); intro(); tweenTo(VIEWS[0]);}
cap.addEventListener('click',ev=>{const n=ev.target.closest('[data-nav]'); if(!n) return; const v=n.dataset.nav; if(v==='x') exitPlay(); else play(S.step+Number(v));});

function grp(label){const g=document.createElement('div'); g.className='grp'; if(label){const s=document.createElement('span'); s.textContent=label; g.appendChild(s);} bar.appendChild(g); return g;}
function btn(g,text,on,fn,attrs){const b=document.createElement('button'); b.textContent=text; if(on) b.classList.add('on'); Object.entries(attrs||{}).forEach(([k,v])=>b.setAttribute(k,v)); b.addEventListener('click',()=>fn(b)); g.appendChild(b); return b;}
const gv=grp('View'); VIEWS.forEach(v=>btn(gv,v.label,false,()=>{if(S.mode==='2d') set2d(false); tweenTo(v);}));
if(Object.keys(envs).length){const ge=grp('Environment'); const all=[['all','All']].concat(Object.entries(envs).map(([k,v])=>[k,(v||{}).label||k])); all.forEach(([k,lbl])=>btn(ge,lbl,k==='all',b=>{S.env=k; ge.querySelectorAll('button').forEach(x=>x.classList.toggle('on',x===b)); refresh();}));}
const gl=grp('Links'); [['all','All'],['sel','On selection'],['off','Off']].forEach(([k,lbl])=>btn(gl,lbl,k===S.linkMode,b=>{S.linkMode=k; gl.querySelectorAll('button').forEach(x=>x.classList.toggle('on',x===b)); refresh();}));
const gly=grp('Layers');
const layerBtn=(key,lbl)=>btn(gly,lbl,S.layers[key],b=>{S.layers[key]=!S.layers[key]; b.classList.toggle('on',S.layers[key]); if(S.sel){const [nb,fl]=neighbors(S.sel); S.focus=nb; S.focusLinks=fl;} refresh();},{'data-layer':key});
if(FL.length) layerBtn('flows','Flows');
if(gaps.length) layerBtn('gaps','Gaps');
if(ISS.length||ents.some(e=>statusOf(e.status).toggle==='Issues')) layerBtn('issues','Issues');
Object.keys(S.toggles).filter(t=>ents.some(e=>statusOf(e.status).toggle===t)||BND.some(b=>b.toggle===t)).forEach(t=>btn(gly,t,S.toggles[t],b=>{S.toggles[t]=!S.toggles[t]; b.classList.toggle('on',S.toggles[t]); refresh();}));
layerBtn('labels','Labels');
const gd=grp('Display');
btn(gd,'Solid',false,b=>{S.solid=!S.solid; b.classList.toggle('on',S.solid); refresh();});
[['Glass','glass',0,100],['Lines','lineOp',10,100]].forEach(([lbl,key,mn,mx])=>{const l=document.createElement('label'); l.className='rng'; l.textContent=lbl+' '; const r=document.createElement('input'); r.type='range'; r.min=mn; r.max=mx; r.step=1; r.value=S[key]; r.addEventListener('input',()=>{S[key]=+r.value; refresh();}); l.appendChild(r); gd.appendChild(l);});
if(BND.length){const gb=grp('Boundaries'); BND.forEach(b=>{const x=btn(gb,b.short||b.id,false,()=>{ if(S.b[b.id]){S.b[b.id]=false; refresh();} else showB(b.id); },{'data-b':b.id}); x.title=b.label||b.id;}); const ball=btn(gb,'Show all',false,()=>{const allOn=BND.every(b=>S.b[b.id]||(b.toggle&&!S.toggles[b.toggle])); BND.forEach(b=>S.b[b.id]=!allOn); refresh();}); ball.id='b-ball';}
const ga=grp('');
if(ISS.length) btn(ga,`Issues (${ISS.length})`,false,()=>{select(null); showIssues();});
const playBtn=STEPS.length?btn(ga,'Play the walkthrough',false,()=>play(0)):null;
const flatBtn=btn(ga,'2D view',false,()=>{ if(ok3d) set2d(S.mode!=='2d'); });

const lg=$('#legend');
const swStyle={solid:'background:#5DCAA5',glass:'background:rgba(93,202,165,.35);border:1px dashed #EF9F27',ghost:'border:1px dashed #b4b2a9',missing:'border:1px dashed #F09595'};
lg.innerHTML=`<div class="hd">Legend ▸</div><div class="hd">Status</div>`+Object.entries(VO.status).map(([k,s])=>`<div class="row"><span class="sw" style="${swStyle[(s||{}).style||'solid']}"></span>${esc((s||{}).label||k)}</div>`).join('')+
`<div class="row"><span class="sw" style="border:1px dashed #E24B4A;background:rgba(226,75,74,.1)"></span>Security boundary</div>`+
(ISS.length?`<div class="row"><span class="sw" style="height:0;border-top:2px solid #F09595"></span>Problem link (issue)</div><div class="row"><span class="sw" style="height:0;border-top:2px dashed #AFA9EC"></span>Needed link</div>`:'')+
(gaps.length?`<div class="row"><span class="sw" style="height:0;border-top:2px dashed #E24B4A"></span>Gap: link the source lacks</div>`:'')+
`<div class="hd">Link types</div>`+Object.entries(VO.linkTypes||{}).filter(([k])=>links.some(l=>l.cat===k)).map(([k,c])=>`<label><input type="checkbox" data-cat="${esc(k)}" checked>${esc(c.label||k)} <span style="color:#888780">${links.filter(l=>l.cat===k).length}</span></label>`).join('')+
(FL.length?`<div class="hd">Flows</div>`+FL.map(f=>`<label><input type="checkbox" data-flow="${esc(f.id)}" checked><span class="sw" style="background:${css(f._c)}"></span>${esc(f.label||f.id)}</label>`).join(''):'');
lg.addEventListener('click',ev=>{ if(ev.target===lg.firstElementChild){ lg.classList.toggle('min'); lg.firstElementChild.textContent=lg.classList.contains('min')?'Legend ▸':'Legend ▾'; } });
lg.addEventListener('change',ev=>{const c=ev.target; if(c.dataset.flow) S.flowOn[c.dataset.flow]=c.checked; if(c.dataset.cat) S.linkCats[c.dataset.cat]=c.checked; refresh();});

function build2d(){
  const VW=1000, bw=bounds[2]-bounds[0], sc=(VW-20)/Math.max(bw,1), X=x=>(x-bounds[0])*sc+10;
  const panels=M.floors.slice().sort((a,b)=>(b.level||0)-(a.level||0)).filter(f=>ents.some(e=>e.floor===f.id));
  let y0=0, svg='';
  panels.forEach(P=>{
    const Z=z=>(z-bounds[1])*sc+y0+30, ph=(bounds[3]-bounds[1])*sc+40;
    svg+=`<text x="8" y="${y0+16}" class="pt">${esc(P.label||P.id)}</text><rect x="4" y="${y0+24}" width="${VW-8}" height="${ph-20}" rx="10" class="pb"/>`;
    M.zones.forEach(z=>{const r=LY.zones[z.id]; if(M.zones.length>1) svg+=`<rect x="${X(r[0])}" y="${Z(r[1])}" width="${(r[2]-r[0])*sc}" height="${(r[3]-r[1])*sc}" rx="8" class="zr" stroke="#888780"/><text x="${X(r[0])+6}" y="${Z(r[3])-6}" class="zl">${esc(z.label||z.id)}</text>`;});
    BND.forEach(b=>{ if(!S.b[b.id]||(b.toggle&&!S.toggles[b.toggle])) return; (b.boxes||[]).forEach(([x,y,z,w,h,d])=>{const fl=M.floors.map(f=>[f.id,Math.abs((LY.floors[f.id]||0)-(y-h/2))]).sort((a,c)=>a[1]-c[1])[0][0]; if(fl!==P.id) return; svg+=`<rect x="${X(x-w/2)}" y="${Z(z-d/2)}" width="${w*sc}" height="${d*sc}" rx="6" class="bd2" data-b="${esc(b.id)}"/>`;});});
    const ctr=e=>[X(e.box.x),Z(e.box.z)];
    if(S.layers.flows) flows.forEach(x=>{ if(!x.line.visible) return; const p=x.path; for(let i=0;i<p.length-1;i++){const a=byId[p[i]],c=byId[p[i+1]]; if(a.floor!==P.id||c.floor!==P.id) continue; const [x1,y1]=ctr(a),[x2,y2]=ctr(c); svg+=`<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${css(x.f._c)}" stroke-width="${S.selEdge===x?4:2.5}" opacity=".85" class="e2" data-flow="${esc(x.f.id)}"/>`;}});
    links.concat(gaps,needs).forEach(l=>{ if(!l.line.visible) return; const a=byId[l.a],c=byId[l.b]; if(a.floor!==P.id||c.floor!==P.id) return; const [x1,y1]=ctr(a),[x2,y2]=ctr(c);
      const col=isSelEdge(l)?'currentColor':l.kind==='need'?'#7F77DD':l.kind==='gap'?'#E24B4A':(S.layers.issues&&l.iss)?'#E24B4A':styleOf(l.st)==='glass'?'#BA7517':'#888780';
      const dash=l.kind!=='link'||styleOf(l.st)!=='solid';
      const attr=l.kind==='gap'?`data-gap="${gaps.indexOf(l)}"`:l.kind==='need'?`data-need="${needs.indexOf(l)}"`:`data-link="${links.indexOf(l)}"`;
      svg+=`<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${col}" stroke-width="${isSelEdge(l)?2.5:1.2}" ${dash?'stroke-dasharray="4 3"':''}/><line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="transparent" stroke-width="10" class="e2" ${attr}><title>${esc(edgeTitle(l))}</title></line>`;});
    const order=ents.filter(e=>e.floor===P.id&&ent[e.id].vis).sort((a,b)=>(b.isGroup?1:0)-(a.isGroup?1:0));
    order.forEach(e=>{
      [e.box].concat(e.reps).forEach(b=>{
        const ww=Math.max(b.w*sc,14), dd=Math.max(b.d*sc,12), x=X(b.x)-ww/2, y=Z(b.z)-dd/2, op=envF(e)*focF(e.id);
        svg+=`<g class="n2 s${styleOf(e.status)} ${e.isGroup?'c2':''} ${S.sel===e.id?'sel':''}" data-id="${esc(e.id)}" opacity="${op<1?0.3:1}"><rect x="${x}" y="${y}" width="${ww}" height="${dd}" rx="3" fill="${css(kindOf(e.kind).color)}"/>`+
          (e.isGroup?`<text class="l2" x="${x+4}" y="${y+11}">${esc(e.short)}</text>`:`<text class="l2" x="${x+ww/2}" y="${y+dd+10}" text-anchor="middle">${esc(e.short)}</text>`)+`</g>`;
      });
    });
    y0+=ph+14;
  });
  flat.innerHTML=`<svg viewBox="0 0 ${VW} ${y0}" width="100%" role="img" aria-label="Flat view by floor">${svg}</svg>`;
}
flat.addEventListener('click',onPanelClick);
function set2d(on){
  S.mode=on?'2d':'3d'; stage.style.display=on?'none':''; flat.style.display=on?'block':'none';
  flatBtn.textContent=on?'3D view':'2D view'; if(playBtn) playBtn.disabled=on;
  if(on) build2d();
}

function resize(){const w=stage.clientWidth,h=stage.clientHeight; if(!w||!h) return; renderer.setSize(w,h); camera.aspect=w/h; camera.updateProjectionMatrix();}
const tmp=new V(), placed=[];
function put(el,p,W,H,pri){ if(el.style.display==='none') return; tmp.copy(p).project(camera); if(tmp.z>1||tmp.z<-1){el.style.visibility='hidden'; return;}
  if(!el._w){el._w=el.offsetWidth; el._h=el.offsetHeight;}
  placed.push({el,x:(tmp.x+1)/2*W,y:(1-tmp.y)/2*H,w:el._w,h:el._h,pri}); }
function layoutLabels(W){
  placed.sort((a,b)=>b.pri-a.pri); const kept=[];
  placed.forEach(o=>{ const l=Math.max(4,Math.min(W-o.w-4,o.x-o.w/2)), t=o.y-o.h, r=l+o.w, b=o.y;
    if(kept.some(k=>l<k.r+3&&r>k.l-3&&t<k.b+1&&b>k.t-1)){o.el.style.visibility='hidden'; return;}
    kept.push({l,t,r,b}); o.el.style.visibility=''; o.el.style.transform=`translate(${l.toFixed(1)}px,${t.toFixed(1)}px)`; });
  placed.length=0; }
function lpri(r){ const id=r.e.id; if(S.sel===id||(S.selEdge&&(S.selEdge.a===id||S.selEdge.b===id))) return 100; let p=kindOf(r.e.kind).priority||(r.e.isGroup?8:20); if(r.cont||r.plate) p-=6; if(styleOf(r.e.status)==='missing') p+=12; if(S.focus&&S.focus.has(id)) p+=40; if(r.f<1) p-=30; return p; }
const t0=performance.now();
function loop(now){
  if(tw){let k=Math.min(1,(now-tw.s)/tw.d); k=k<0.5?4*k*k*k:1-Math.pow(-2*k+2,3)/2;
    cam.t.lerpVectors(tw.from.t,tw.to.t,k); cam.r=tw.from.r+(tw.to.r-tw.from.r)*k; cam.th=tw.from.th+(tw.to.th-tw.from.th)*k; cam.ph=tw.from.ph+(tw.to.ph-tw.from.ph)*k;
    if(k>=1) tw=null;}
  applyCam();
  const t=(now-t0)/1000;
  flows.forEach(x=>{ if(!x.line.visible) return; const n=x.dots.length; x.dots.forEach((d,i)=>{const p=x.cp.getPointAt(Math.min(((t*9/x.len)+i/n)%1,0.999)); if(p) d.position.copy(p);}); });
  if(S.mode==='3d'){
    renderer.render(scene,camera);
    const W=stage.clientWidth,H=stage.clientHeight;
    Object.values(bnds).forEach(b=>put(b.lab,b.lp,W,H,90));
    zones.forEach(z=>put(z.el,z.p,W,H,60));
    Object.values(ent).forEach(r=>put(r.lab,r.lp,W,H,lpri(r)));
    layoutLabels(W);
  }
  requestAnimationFrame(loop);
}
intro();
if(ok3d){ new ResizeObserver(resize).observe(stage); resize(); refresh(); requestAnimationFrame(loop); }
else { refresh(); set2d(true); flatBtn.disabled=true; insp.insertAdjacentHTML('afterbegin','<p class="src">3D is not available in this browser, so the flat view is shown.</p>'); }
window.SV3D={select,selectEdge,selectIssue,showB,play,S,links,gaps,needs,flows,camera,VIEWS};
})();
