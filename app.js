const API_URL = 'https://script.google.com/macros/s/AKfycbzUolLGUottwRDPHrowXx1vxhJ3sw4W5icp2hM3lKD3RgSiZEVBKaMk_F79UV_zBqbgDQ/exec';
const UPLOAD_TYPES = [['EXPORT','info','Order Export','Export'],['IMPORT','accent','Order Import','Import'],['งานอื่นๆ (นอก BU)','neutral','งานนอก BU','งานอื่นๆ']];
const UPLOAD_ALLOWED = ['551358','534736'];
const USERS = [
{id:'551358',name:'CS 551358',role:'CS - อัปโหลดคำสั่งงาน'},
{id:'534736',name:'CS 534736',role:'CS - อัปโหลดคำสั่งงาน'},
{id:'PL01',name:'ปวีณา จันทร์เพ็ญ',role:'Planner - วางแผนจัดรถ'},
{id:'CC01',name:'วราภรณ์ ตั้งใจดี',role:'CC - ติดตามงาน'},
{id:'AD01',name:'ผู้ดูแลระบบ',role:'Admin'}
];
let currentUser = USERS[0];
const canUpload = () => UPLOAD_ALLOWED.indexOf(currentUser.id) >= 0;
const CS_FIELDS = [['date','วันที่'],['customer','ลูกค้า'],['from','ต้นทาง'],['to','ปลายทาง'],
['booking','Booking / BL'],['contNo','Cont. No'],['seal','Seal'],['size','Size'],
['loadDate','Loading Date'],['due','กำหนดส่ง / Closing'],['returnPort','Return Port']];
const CC_FIELDS = [['detail','เลขตู้ / รายละเอียด'],['truck','เบอร์รถ'],['driver','พจส.'],
['phone','เบอร์โทร'],['finished','วันที่เวลาจบงาน'],['gps','สถานะรถ (GPS)']];
const SUBMITTED = 'ส่งให้ CC แล้ว';
const isSubmitted = r => (r.submitted||'').trim() === SUBMITTED;
function waitingChip(){ const s=el('span','chip warn','waiting'); return s; }
const RISK_OPTS=['On Plan','เสี่ยงล่าช้า','เสี่ยงส่งไม่ทัน'];
const RISK_CLS={'On Plan':'good','เสี่ยงล่าช้า':'warn','เสี่ยงส่งไม่ทัน':'crit'};
const GOODS_OPTS=['Complete','On the Way','Pending'];
const GOODS_CLS={'Complete':'info','On the Way':'text','Pending':'crit'};
const DOC_OPTS=['รอวางบิล','รอเอกสาร','วางบิลแล้ว','รับชำระแล้ว','ค้างชำระ'];
const DOC_CLS={'รอวางบิล':'neutral','รอเอกสาร':'warn','วางบิลแล้ว':'good','รับชำระแล้ว':'good','ค้างชำระ':'crit'};
const TICK_SEQ=['pass','fail','na'];
const TICK_VIEW={pass:['✓','good'],fail:['X','crit'],na:['-','muted']};
const BEH=['0%Acl','ชุดพนักงาน','ความเร็วไม่เกิน 65','ไม่จอดไหล่ทาง','ไม่จอดนอนกลางทาง','Complain','AD'];
let STATE = {roster:[], tracking:[], billing:[], cells:{}, uploads:[], audit:[], deleted:[]};
let online = false;
let lastError = '';   // เก็บสาเหตุไว้แสดงบนหน้าจอ ไม่ให้ผู้ใช้เห็นแค่หน้าว่าง
const $ = s => document.querySelector(s);
const el = (t,c,txt) => { const e=document.createElement(t); if(c) e.className=c; if(txt!=null) e.textContent=txt; return e; };
function td(txt,c){ return el('td',c,txt==null?'':String(txt)); }
function chipTd(txt,kind,c){ const t=el('td',c); t.appendChild(el('span','chip '+(kind||'neutral'),txt||'-')); return t; }
const toMin = v => { const m=/^(\d{1,2}):(\d{2})$/.exec(String(v||'').trim()); return m?(+m[1])*60+(+m[2]):null; };
const fmtMin = m => { const s=Math.abs(m); return (m<0?'-':'')+String(Math.floor(s/60)).padStart(2,'0')+':'+String(s%60).padStart(2,'0'); };
function setConn(kind,txt){ const c=$('#conn'); c.className='status-pill '+kind; c.innerHTML=''; c.appendChild(el('span','dot')); c.appendChild(document.createTextNode(txt)); }
function showToast(m){ let t=$('#toast'); if(!t){ t=el('div','toast'); t.id='toast'; document.body.appendChild(t);} t.textContent=m; t.classList.add('show'); clearTimeout(t._h); t._h=setTimeout(()=>t.classList.remove('show'),3600); }
function formatNow(){ const d=new Date(),p=n=>String(n).padStart(2,'0'); return p(d.getDate())+'/'+p(d.getMonth()+1)+'/'+d.getFullYear()+' '+p(d.getHours())+':'+p(d.getMinutes()); }
/* ---- รหัสร่วมของทีม: เก็บในเบราว์เซอร์ของแต่ละคน ไม่อยู่ในโค้ด ---- */
const PW_KEY = 'bu5_team_pw';
function pwGet(){ try{ return localStorage.getItem(PW_KEY) || ''; }catch(e){ return ''; } }
function pwSet(v){ try{ v ? localStorage.setItem(PW_KEY, v) : localStorage.removeItem(PW_KEY); }catch(e){} }
function signOut(){ pwSet(''); location.reload(); }

function pwClose(){ const o=$('#pw-ov'); if(o) o.remove(); }
function pwNote(msg){ const n=$('#pw-note'); if(!n) return; n.textContent=msg||''; n.classList.toggle('show',!!msg); }
function pwBusy(on){
const b=$('#pw-go'), i=$('#pw-in');
if(b){ b.disabled=on; b.textContent = on ? 'กำลังตรวจสอบ...' : 'เข้าใช้งาน'; }
if(i) i.disabled=on;
}
function pwBuild(){
const ov = el('div','pw-ov'); ov.id='pw-ov';
const box = el('div','pw-box');
box.appendChild(Object.assign(el('div','pw-ic'),{textContent:'🚚'}));
box.appendChild(Object.assign(el('h2','pw-t'),{textContent:'BU5 Control Tower'}));
box.appendChild(Object.assign(el('p','pw-s'),{textContent:'ใส่รหัสของทีมเพื่อเข้าใช้งาน'}));
const nt = el('div','pw-note'); nt.id='pw-note'; box.appendChild(nt);
const inp = el('input','pw-in'); inp.type='password'; inp.id='pw-in';
inp.placeholder='รหัสของทีม'; inp.autocomplete='current-password'; box.appendChild(inp);
const go = el('button','btn pw-go'); go.type='button'; go.id='pw-go'; go.textContent='เข้าใช้งาน'; box.appendChild(go);
box.appendChild(Object.assign(el('div','pw-hint'),{textContent:'ขอรหัสจากหัวหน้างาน — ใส่ครั้งเดียว เบราว์เซอร์จะจำไว้'}));
ov.appendChild(box); document.body.appendChild(ov);
return ov;
}

/* ค้างหน้าใส่รหัสไว้จนเซิร์ฟเวอร์ตอบ ไม่ปิดก่อนรู้ผล */
function pwAsk(note){
return new Promise(resolve=>{
if(!$('#pw-ov')) pwBuild();
pwBusy(false); pwNote(note);
const inp=$('#pw-in'), go=$('#pw-go');
inp.value='';
const submit=()=>{
const v=inp.value.trim();
if(!v){ inp.focus(); return; }
pwNote(''); pwBusy(true);
resolve(v);
};
go.onclick=submit;
inp.onkeydown=e=>{ if(e.key==='Enter'){ e.preventDefault(); submit(); } };
setTimeout(()=>inp.focus(),60);
});
}

async function apiPost(payload){
let pw = pwGet(), note = '';
for(let i=0;i<8;i++){
if(!pw){ pw = await pwAsk(note); note=''; }
let j;
try{
const r = await fetch(API_URL,{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},
body:JSON.stringify(Object.assign({pw:pw},payload)),redirect:'follow'});
const txt = await r.text();
try{ j=JSON.parse(txt); }catch(e){
throw new Error('Apps Script ไม่ได้ส่ง JSON กลับมา — ตรวจว่า Deploy เป็น New version และ Who has access = Anyone');
}
}catch(err){
if($('#pw-ov')){ pwBusy(false); pwNote('ต่อเซิร์ฟเวอร์ไม่ได้: '+err.message); }
throw err;
}
if(j.ok){ pwSet(pw); pwClose(); return j; }
if(j.code==='AUTH'){ pwSet(''); pw=''; note='รหัสไม่ถูกต้อง ลองอีกครั้ง'; continue; }
if($('#pw-ov')){ pwBusy(false); pwNote(j.error||'เกิดข้อผิดพลาด'); }
throw new Error(j.error||'unknown');
}
throw new Error('ใส่รหัสไม่ถูกต้องหลายครั้ง กรุณาโหลดหน้าใหม่');
}

async function apiLoad(){ return (await apiPost({action:'loadState'})).state; }
async function apiSave(desc){ return await apiPost({action:'saveState',state:STATE,user:currentUser,description:desc}); }
function tickBtn(key,i,val){
const b=el('button','tick-btn'); b.type='button'; b.dataset.ck=key+'|b'+i; b.dataset.val=val||'na';
const paint=()=>{ const v=TICK_VIEW[b.dataset.val]||TICK_VIEW.na; b.textContent=v[0]; b.className='tick-btn tick '+v[1]; };
b.onclick=()=>{ b.dataset.val=TICK_SEQ[(TICK_SEQ.indexOf(b.dataset.val)+1)%TICK_SEQ.length]; paint(); };
paint(); const c=el('td'); c.appendChild(b); return c;
}
function textTd(key,field,val,ph,cls){
const c=el('td',cls); const i=el('input','cell-input'); i.type='text'; i.value=val||''; if(ph) i.placeholder=ph;
i.dataset.rk=key; i.dataset.f=field; c.appendChild(i); return c;
}
function timeTd(key,field,val){
const c=el('td'); const i=el('input','time-input'); i.type='time'; i.value=val||'';
i.dataset.rk=key; i.dataset.f=field; i.addEventListener('change',()=>refreshDerived(c.parentNode)); c.appendChild(i); return c;
}
function refreshDerived(tr){
if(!tr||tr.children.length<17) return;
const ins=tr.querySelectorAll('input.time-input');
const a=toMin(ins[0].value), b=toMin(ins[1].value);
/* ช่อง "มาตรงเวลา" (children[14]) เป็นช่องเลือกเอง ห้ามเขียนทับ
   เหลือคำนวณอัตโนมัติแค่ รวมเวลา / เกิน Std */
const c15=tr.children[15];
if(a===null||b===null) c15.textContent='-';
else { let t=b-a; if(t<=0)t+=1440; const ov=t-720;
c15.textContent=fmtMin(t)+(ov>0?'  (+'+fmtMin(ov)+')':'  (-)'); c15.style.color=ov>0?'var(--warn)':''; }
}
// ---------- ตัวกรองตารางกะ ----------
const SHIFT_BANDS = [['morning','เช้า','06:00–13:59'],['afternoon','บ่าย','14:00–21:59'],['night','ดึก','22:00–05:59']];
const shiftStart = s => { const m=/(\d{1,2}):(\d{2})/.exec(String(s||'')); return m?(+m[1])*60+(+m[2]):null; };
function shiftBand(s){
const t=shiftStart(s); if(t===null) return null;
if(t>=360 && t<840) return 'morning';
if(t>=840 && t<1320) return 'afternoon';
return 'night';
}
let ROSF = {band:'all', shift:'all'};
const rosMatch = r =>
(ROSF.band==='all' || shiftBand(r.shift)===ROSF.band) &&
(ROSF.shift==='all' || ((r.shift||'').trim()||'(ไม่ระบุกะ)')===ROSF.shift);
function buildRosterFilters(){
const grp=$('#ros-band'), sel=$('#ros-shift');
if(!grp||!sel) return;
const box=document.querySelector('.ros-filters');
if(box) box.style.display = STATE.roster.length ? '' : 'none';
if(!STATE.roster.length){ grp.innerHTML=''; sel.innerHTML=''; return; }
grp.innerHTML='';
const n=id=>id==='all'?STATE.roster.length:STATE.roster.filter(r=>shiftBand(r.shift)===id).length;
[['all','ทั้งหมด','ทุกช่วงเวลา']].concat(SHIFT_BANDS).forEach(([id,label,range])=>{
const b=el('button','band-btn'+(ROSF.band===id?' active':'')); b.type='button'; b.title=range;
b.setAttribute('aria-pressed',ROSF.band===id?'true':'false');
b.appendChild(el('span','band-name',label));
b.appendChild(el('span','band-n',String(n(id))));
b.onclick=()=>{ ROSF.band=id; ROSF.shift='all'; renderRoster(); };
grp.appendChild(b);
});
sel.innerHTML='';
const pool=STATE.roster.filter(r=>ROSF.band==='all'||shiftBand(r.shift)===ROSF.band);
const cnt={};
pool.forEach(r=>{ const s=(r.shift||'').trim()||'(ไม่ระบุกะ)'; cnt[s]=(cnt[s]||0)+1; });
const keys=Object.keys(cnt).sort((a,b)=>{
const x=shiftStart(a), y=shiftStart(b);
return (x===null?9999:x)-(y===null?9999:y);
});
const mk=(v,t)=>{ const o=el('option',null,t); o.value=v; if(v===ROSF.shift) o.selected=true; sel.appendChild(o); };
mk('all','ทุกกะ ('+pool.length+' คน)');
keys.forEach(k=>mk(k,k+' ('+cnt[k]+' คน)'));
sel.onchange=()=>{ ROSF.shift=sel.value; renderRoster(); };
}
function applyRosterFilter(){
const body=$('#roster-body'); if(!body) return 0;
const allow={}; STATE.roster.filter(rosMatch).forEach(r=>allow[r.key]=1);
let shown=0;
body.querySelectorAll('tr[data-key]').forEach(tr=>{
const ok=!!allow[tr.dataset.key];
tr.style.display=ok?'':'none';
if(ok) shown++;
});
return shown;
}
function rosterStatus(shown){
const host=$('#ros-status'); if(!host) return;
host.innerHTML='';
if(!STATE.roster.length) return;
const bits=[];
if(ROSF.band!=='all'){ const b=SHIFT_BANDS.filter(x=>x[0]===ROSF.band)[0]; bits.push('ช่วง'+b[1]+' '+b[2]); }
if(ROSF.shift!=='all') bits.push('กะ '+ROSF.shift);
host.appendChild(el('span','ros-st-t', bits.length?('กำลังกรอง — '+bits.join(' · ')):'แสดงทุกกะ'));
host.appendChild(el('span','ros-st-n','แสดง '+shown+' จาก '+STATE.roster.length+' คน'));
if(bits.length){
const c=el('button','ros-clear','ล้างตัวกรอง'); c.type='button';
c.onclick=()=>{ ROSF={band:'all',shift:'all'}; renderRoster(); };
host.appendChild(c);
}
if(!shown){
const w=el('span','ros-st-empty','ไม่มีพจส.ที่ตรงกับตัวกรองนี้ — ข้อมูลที่ซ่อนอยู่ยังถูกบันทึกตามปกติ');
host.appendChild(w);
}
}
// ---------- สถานะความพร้อม รถ / พจส. ----------
const CAR_OPTS = ['พร้อม','ไม่พร้อม','AD'];
const CAR_TONE = {'พร้อม':'good','ไม่พร้อม':'crit','AD':'crit'};
const DRV_OPTS = ['พร้อม','ลา','ขาดงาน'];
const ONTIME_OPTS=['ตรงเวลา','สาย','มาก่อนเวลา'];
const ONTIME_TONE={'ตรงเวลา':'good','มาก่อนเวลา':'good','สาย':'warn'};
const DRV_TONE = {'พร้อม':'good','ลา':'purple','ขาดงาน':'crit','ขาด':'crit','OFF':'neutral'};
// ชื่อวันที่ยอมรับได้ในช่อง "วันหยุด" เรียงตาม getDay() 0=อาทิตย์
const DAY_ALIASES = [
['อา.','อา','อาทิตย์','sun','sunday'],
['จ.','จ','จันทร์','mon','monday'],
['อ.','อ','อังคาร','tue','tuesday'],
['พ.','พ','พุธ','wed','wednesday'],
['พฤ.','พฤ','พฤหัส','พฤหัสบดี','thu','thursday'],
['ศ.','ศ','ศุกร์','fri','friday'],
['ส.','ส','เสาร์','sat','saturday']
];
const dayNorm = s => String(s||'').trim().toLowerCase().replace(/^วัน/,'');
function isOffToday(r,when){
const names = DAY_ALIASES[(when||new Date()).getDay()];
return String(r.off||'').split(/[,\/|·]|\s+/).map(dayNorm).filter(Boolean)
.some(v => names.indexOf(v)>=0);
}
const carStatus = r => String(r.carReady||'').trim();
const driverStatus = r => isOffToday(r) ? 'OFF' : String(r.driverReady||'').trim();
function flagRow(tr,r){
const car=carStatus(r), drv=driverStatus(r);
const crit = (car && car!=='พร้อม') || drv==='ขาดงาน' || drv==='ขาด';
const warn = drv==='ลา' || drv==='OFF' || !drv;
tr.className = crit ? 'flag-crit' : (warn ? 'flag-warn' : '');
}
function rosterSelectTd(r,field,opts,toneMap,cls){
const c=el('td',cls);
const s=el('select','status-select'); s.dataset.rk=r.key; s.dataset.f=field;
const cur=String(r[field]||'').trim();
const list=opts.slice();
if(cur && list.indexOf(cur)<0) list.push(cur);   // ค่าเดิมจากชีทที่ไม่อยู่ในรายการ เก็บไว้ ไม่เขียนทับเงียบ ๆ
if(!cur) list.unshift('');
list.forEach(o=>{ const op=el('option',null,o===''?'— ไม่ระบุ —':o); op.value=o;
if(o===cur) op.selected=true; s.appendChild(op); });
const paint=()=>{ const k=toneMap[s.value]||(s.value?'crit':'neutral'); s.style.color='var(--'+k+')'; };
s.onchange=()=>{ r[field]=s.value; paint();
const tr=s.parentNode&&s.parentNode.parentNode; if(tr&&tr.tagName==='TR') flagRow(tr,r);
renderRosterKpi(); };
paint(); c.appendChild(s); return c;
}
function driverReadyTd(r){
if(isOffToday(r)){
const c=el('td');
const sp=el('span','chip off-auto','OFF');
sp.title='วันหยุดตามตารางกะ ('+(r.off||'-')+') — ระบบกำหนดให้อัตโนมัติ ไม่ทับค่าที่บันทึกไว้';
c.appendChild(sp); return c;
}
return rosterSelectTd(r,'driverReady',DRV_OPTS,DRV_TONE);
}
function rosterRow(r){
const tr=el('tr');
flagRow(tr,r);
tr.dataset.key=r.key;
tr.appendChild(td(r.truck,'sticky1'));
tr.appendChild(rosterSelectTd(r,'carReady',CAR_OPTS,CAR_TONE,'sticky2'));
tr.appendChild(td(r.shift,'rfz3 num'));
const dc=el('td','rfz4'); const sc=el('span','stack-cell');
sc.appendChild(document.createTextNode(r.driver||'ตำแหน่งว่าง'));
if(r.code) sc.appendChild(el('small',null,'รหัส '+r.code));
dc.appendChild(sc); tr.appendChild(dc);
tr.appendChild(td(r.phone||'-','rfz5'));
tr.appendChild(td(r.off||'-','rfz6'));
tr.appendChild(td(r.mainJob||'-','rfz7'));
tr.appendChild(driverReadyTd(r));
tr.appendChild(textTd(r.key,'planOut',r.planOut,'ขาไป'));
tr.appendChild(textTd(r.key,'planBack',r.planBack,'ขากลับ'));
tr.appendChild(textTd(r.key,'actOut',r.actOut,'จริง-ขาไป'));
tr.appendChild(textTd(r.key,'actBack',r.actBack,'จริง-ขากลับ'));
tr.appendChild(timeTd(r.key,'in',r['in']));
tr.appendChild(timeTd(r.key,'out',r.out));
tr.appendChild(rosterSelectTd(r,'onTime',ONTIME_OPTS,ONTIME_TONE));  // มาตรงเวลา (กรอกเอง)
tr.appendChild(el('td','num'));     // รวมเวลา (คำนวณ)
tr.appendChild(textTd(r.key,'note',r.note,'สาเหตุ / หมายเหตุ','note-cell'));
for(let i=0;i<7;i++) tr.appendChild(tickBtn(r.key,i,(r.b||[])[i]));
const act=el('td'); const db=el('button','row-del-btn','ลบ'); db.onclick=()=>delRow(tr); act.appendChild(db); tr.appendChild(act);
refreshDerived(tr);
return tr;
}
function renderRoster(){
const b=$('#roster-body'); b.innerHTML='';
if(!STATE.roster.length){
const tr=el('tr'); const cell=el('td'); cell.colSpan=25;
cell.style.cssText='padding:26px;white-space:normal';
const box=el('div'); box.style.cssText=
'border:1px solid var(--border);border-left:4px solid var(--'+(online?'warn':'crit')+
');border-radius:12px;background:var(--'+(online?'warn':'crit')+'-soft);padding:16px 18px;max-width:820px';
box.appendChild(el('div',null,online
? 'เชื่อมต่อ Google Sheet ได้ แต่ชีท Roster ยังไม่มีข้อมูล'
: 'ยังเชื่อมต่อ Google Sheet ไม่ได้')).style.cssText='font-weight:800;font-size:14px;margin-bottom:8px';
if(lastError){
const e=el('div',null,'สาเหตุ: '+lastError);
e.style.cssText='font-size:12px;color:var(--text-2);margin-bottom:10px';
box.appendChild(e);
}
const steps=online
? ['ในหน้า Apps Script เลือกฟังก์ชัน setupSheets แล้วกด Run',
'เลือกฟังก์ชัน seedRoster แล้วกด Run (ใส่ตารางกะ 60 คน)',
'รีเฟรชหน้านี้']
: ['วางไฟล์ Code.gs ตัวใหม่ใน Apps Script แล้วกด Save',
'เลือกฟังก์ชัน testAll แล้ว Run — ดูผลที่ View → Logs ต้องเห็นจำนวนแถวตารางกะ',
'Deploy → Manage deployments → ✏️ → Version: New version → Deploy',
'เปิด URL ของ Apps Script ต่อท้าย ?action=ping ต้องได้ JSON',
'รีเฟรชหน้านี้'];
const ol=el('ol'); ol.style.cssText='margin:0;padding-left:20px;font-size:12.5px;line-height:1.9;color:var(--text)';
steps.forEach(s=>ol.appendChild(el('li',null,s)));
box.appendChild(ol);
cell.appendChild(box); tr.appendChild(cell); b.appendChild(tr);
}else{
STATE.roster.forEach(r=>b.appendChild(rosterRow(r)));
}
$('#roster-src').textContent = STATE.roster.length
? ('ตารางกะ '+STATE.roster.length+' รายการ ดึงจาก Google Sheet — แก้ที่ชีทได้โดยตรง')
: 'ตารางกะดึงจาก Google Sheet (ยังไม่มีข้อมูล)';
buildRosterFilters();
rosterStatus(applyRosterFilter());
renderRosterKpi();
setTimeout(alignSticky,0);
}
function renderRosterKpi(){
const R=STATE.roster.filter(rosMatch), n=v=>R.filter(v).length;
const late=R.filter(r=>{ const sm=/(\d{1,2}:\d{2})/.exec(r.shift||''); const st=sm?toMin(sm[1]):null, a=toMin(r['in']);
if(st===null||a===null) return false; let d=a-st; if(d>720)d-=1440; if(d<-720)d+=1440; return d>0; }).length;
const over=R.filter(r=>{ const a=toMin(r['in']),b=toMin(r.out); if(a===null||b===null) return false; let t=b-a; if(t<=0)t+=1440; return t>720; }).length;
kpiInto('#ros-kpi',[
[(ROSF.band==='all'&&ROSF.shift==='all')?'พจส. ทั้งหมด':'พจส. ที่กรองไว้',R.length,'info',undefined,'👥'],
['พร้อม',n(r=>driverStatus(r)==='พร้อม'),'good',undefined,'✅'],
['ขาดงาน',n(r=>{const d=driverStatus(r); return d==='ขาดงาน'||d==='ขาด';}),'crit',undefined,'❌'],
['ลา',n(r=>driverStatus(r)==='ลา'),'purple',undefined,'🌴'],
['OFF',n(r=>driverStatus(r)==='OFF'),'neutral',n(r=>isOffToday(r))+' จากตารางกะวันนี้','💤'],
['ตำแหน่งว่าง',n(r=>!r.driver||r.driver==='ตำแหน่งว่าง'),'neutral',undefined,'🪑'],
['รถไม่พร้อม',n(r=>{const c=carStatus(r); return !!c&&c!=='พร้อม';}),'crit',undefined,'🔧'],
['มีแผนงานแล้ว',n(r=>r.planOut||r.planBack),'purple',undefined,'📋'],
['มาสาย',late,'warn',undefined,'⏰'],
['เกิน Std 12ชม.',over,'crit',undefined,'⏳']
]);
}
function addDriverRow(){
const truck=prompt('เบอร์รถ (เช่น EV1-199)'); if(!truck) return;
const shift=prompt('กะ (เช่น 08:00-20:00)'); if(!shift) return;
const driver=prompt('ชื่อพจส.')||'';
const key=truck.trim()+'|'+shift.trim();
if(STATE.roster.some(r=>r.key===key)){ showToast('มี '+key+' อยู่แล้ว'); return; }
ROSF={band:'all',shift:'all'};
STATE.roster.unshift({key,truck:truck.trim(),shift:shift.trim(),driver,code:'',phone:'',off:'',mainJob:'',
carReady:'พร้อม',driverReady:'พร้อม',planOut:'',planBack:'',actOut:'',actBack:'','in':'',out:'',note:'',b:['na','na','na','na','na','na','na'],source:'เพิ่มใหม่'});
renderRoster();
showToast('เพิ่มแล้ว — กด "บันทึกการเปลี่ยนแปลง" เพื่อเขียนลง Sheet');
}
function delRow(tr){
const key=tr.dataset.key;
if(!confirm('ยืนยันนำ '+key.replace('|',' กะ ')+' ออกจากตารางวันนี้?')) return;
STATE.roster=STATE.roster.filter(r=>r.key!==key);
if(STATE.deleted.indexOf(key)<0) STATE.deleted.push(key);
renderRoster();
save('นำพจส. '+key.replace('|',' กะ ')+' ออกจากตารางวันนี้');
}
function chipSelect(opts,clsMap,key,field,cur){
const c=el('td'); const s=el('select','status-select'); s.dataset.ck=key+'|'+field;
opts.forEach(o=>{ const op=el('option',null,o); op.value=o; if(o===cur) op.selected=true; s.appendChild(op); });
const paint=()=>{ const k=clsMap[s.value]; s.style.color=k?('var(--'+k+')'):''; };
s.onchange=paint; paint(); c.appendChild(s); return c;
}
const TRACK_COLS = [
['วันที่','date','sticky1 num'],['ลูกค้า','customer','fz2'],['ต้นทาง','from','fz3'],['ปลายทาง','to','fz4'],
['เลขตู้ / รายละเอียด','detail','fz5'],['Booking / BL','booking','fz6'],['Size','size',''],
['กำหนดส่ง / Closing','due',''],['เลขที่ใบงาน','key','num'],['เบอร์รถ','truck',''],['พจส.','driver',''],
['เบอร์โทร','phone',''],['วันที่เวลาจบงาน','finished','num'],['สถานะรถ (GPS)','gps',''],
['Ontime / ความเสี่ยง','risk',''],['สถานะสินค้า','goods','']
];
const TYPE_OF = {'t-export':'Export','t-import':'Import','t-other':'งานอื่นๆ'};
function trackRows(tabId){
const want = TYPE_OF[tabId];
return STATE.tracking.filter(r=>{
if(!isSubmitted(r)) return false;
const t = (r.type||'').trim();
if(want==='งานอื่นๆ') return t!=='Export' && t!=='Import';
return t===want;
});
}
const submittedJobs = () => STATE.tracking.filter(isSubmitted);
const riskOf  = r => STATE.cells[r.key+'|risk']  || r.risk  || 'On Plan';
const goodsOf = r => STATE.cells[r.key+'|goods'] || r.goods || 'On the Way';
const isUrgent = r => riskOf(r)!=='On Plan' || goodsOf(r)!=='Complete';
function emptyBox(title, steps){
const box=el('div');
box.style.cssText='border:1px solid var(--border);border-left:4px solid var(--warn);border-radius:12px;'+
'background:var(--warn-soft);padding:16px 18px;max-width:820px;margin:4px 0';
const h=el('div',null,title); h.style.cssText='font-weight:800;font-size:14px;margin-bottom:8px'; box.appendChild(h);
const ol=el('ol'); ol.style.cssText='margin:0;padding-left:20px;font-size:12.5px;line-height:1.9';
steps.forEach(s=>ol.appendChild(el('li',null,s)));
box.appendChild(ol); return box;
}
function renderTrackTab(id){
const host=$('#'+id); host.innerHTML='';
const rows=trackRows(id);
const bar=el('div','save-bar');
bar.appendChild(el('span','note','กดบันทึกเมื่อปรับ Ontime/ความเสี่ยง หรือสถานะสินค้า'));
const bt=el('button','btn','บันทึกการเปลี่ยนแปลง');
bt.onclick=()=>save('อัปเดตสถานะติดตามงาน — '+TYPE_OF[id]);
bar.appendChild(bt); host.appendChild(bar);
if(!rows.length){
const card=el('div','card');
card.appendChild(emptyBox('ยังไม่มีคำสั่งงาน'+TYPE_OF[id]+'ในชีท',
['เปิด Google Sheet → ชีท Tracking_งานCC',
'เพิ่มแถว โดยใส่ KEY = เลขที่ใบงาน (ห้ามซ้ำ) และ ประเภทงาน = '+TYPE_OF[id],
'วางข้อมูลจาก Excel ต่อท้ายได้เลย แล้วรีเฟรชหน้านี้']));
host.appendChild(card); return;
}
const card=el('div','card'), wrap=el('div','tbl-wrap'), tb=el('table','plain wide'), thead=el('thead');
const g=el('tr','grp');
[['📋 ข้อมูลคำสั่งงาน (จากชีท)',8],['🚚 รถ / พจส. — CC กรอกช่อง waiting ได้ที่นี่',6],['🎯 CC ติดตาม',2]].forEach(([t,n])=>{
const th=el('th',null,t); th.colSpan=n; g.appendChild(th); });
thead.appendChild(g);
const hr=el('tr'); TRACK_COLS.forEach(([label,,cls])=>hr.appendChild(el('th',cls.replace(' num',''),label)));
thead.appendChild(hr); tb.appendChild(thead);
const body=el('tbody');
rows.forEach(r=>{
const risk=riskOf(r), goods=goodsOf(r);
const tr=el('tr');
if(risk==='เสี่ยงส่งไม่ทัน') tr.className='flag-crit';
else if(risk==='เสี่ยงล่าช้า') tr.className='flag-warn';
TRACK_COLS.forEach(([label,field,cls])=>{
if(field==='risk'){ tr.appendChild(chipSelect(RISK_OPTS,RISK_CLS,r.key,'risk',risk)); return; }
if(field==='goods'){ tr.appendChild(chipSelect(GOODS_OPTS,GOODS_CLS,r.key,'goods',goods)); return; }
if(CC_FIELDS.some(f=>f[0]===field)){
const c=el('td',cls); const i=el('input','cell-input'); i.type='text';
i.value=r[field]||''; i.placeholder='waiting';
i.dataset.tk=r.key; i.dataset.tf=field;
c.appendChild(i); tr.appendChild(c); return;
}
tr.appendChild(td(r[field]||'-',cls));
});
body.appendChild(tr);
});
tb.appendChild(body); wrap.appendChild(tb); card.appendChild(wrap); host.appendChild(card);
}
function renderTracking(){
$('#cc-tabs').innerHTML='';
[['t-export','📤 Export'],['t-import','📥 Import'],['t-other','📦 งานอื่นๆ']].forEach(([id,lbl],idx)=>{
const n=trackRows(id).filter(isUrgent).length;
const b=el('button','tab-btn'+(idx===0?' active':''),lbl+' '); b.dataset.tab=id;
b.appendChild(el('span','chip '+(n?'crit':'good'),n+' urgent'));
b.onclick=()=>{ document.querySelectorAll('.tab-btn').forEach(x=>x.classList.remove('active')); b.classList.add('active');
document.querySelectorAll('.subtab').forEach(s=>s.classList.remove('active')); $('#'+id).classList.add('active');
setTimeout(alignSticky,0); };
$('#cc-tabs').appendChild(b);
});
['t-export','t-import','t-other'].forEach(renderTrackTab);
const all=submittedJobs();   // CC นับเฉพาะงานที่ CS ส่งมาแล้ว
const cnt=v=>all.filter(r=>goodsOf(r)===v).length;
const p=(x)=>all.length?Math.round(x/all.length*100)+'%':'0%';
kpiInto('#cc-kpi',[
['รายการติดตามทั้งหมด',all.length,'info','ที่ CS ส่งให้ CC แล้ว','📦'],
['เสร็จสิ้น',cnt('Complete'),'good',p(cnt('Complete')),'✅',all.length?cnt('Complete')/all.length*100:0],
['กำลังเดินทาง',cnt('On the Way'),'purple',p(cnt('On the Way')),'🚚'],
['รอดำเนินการ',cnt('Pending'),'warn',p(cnt('Pending')),'⏳'],
['ต้องเร่งติดตาม',all.filter(isUrgent).length,'crit',p(all.filter(isUrgent).length),'🔔']
]);
}
const docOf  = b => STATE.cells[b.key+'|docStatus'] || b.status || 'รอวางบิล';
const noteOf = b => STATE.cells[b.key+'|billNote'] !== undefined ? STATE.cells[b.key+'|billNote'] : (b.note||'');
function renderBilling(){
const body=$('#bill-body'); body.innerHTML='';
if(!STATE.billing.length){
const tr=el('tr'), c=el('td'); c.colSpan=7; c.style.cssText='padding:22px;white-space:normal';
c.appendChild(emptyBox('ยังไม่มีรายการวางบิลในชีท',
['เปิด Google Sheet → ชีท Billing_วางบิล',
'เพิ่มแถว โดยใส่ KEY = เลขที่ใบวางบิล/ใบงาน (ห้ามซ้ำ)',
'รีเฟรชหน้านี้']));
tr.appendChild(c); body.appendChild(tr);
}else{
STATE.billing.forEach(b=>{
const st=docOf(b);
const tr=el('tr');
if(st==='ค้างชำระ') tr.className='flag-crit'; else if(st==='รอเอกสาร') tr.className='flag-warn';
tr.appendChild(td(b.customer||'-'));
tr.appendChild(chipTd(b.type||'-',b.type==='Export'?'info':(b.type==='Import'?'accent':'neutral')));
tr.appendChild(td(b.key,'num'));
tr.appendChild(td(b.done||'-','num'));
tr.appendChild(chipSelect(DOC_OPTS,DOC_CLS,b.key,'docStatus',st));
tr.appendChild(td(b.due||'-','num'));
const nc=el('td'); const i=el('input','cell-input'); i.type='text'; i.value=noteOf(b);
i.placeholder='ขาดเอกสารอะไร / หมายเหตุ'; i.dataset.ck=b.key+'|billNote';
nc.appendChild(i); tr.appendChild(nc);
body.appendChild(tr);
});
}
const c=v=>STATE.billing.filter(b=>docOf(b)===v).length;
const B=STATE.billing, p=x=>B.length?Math.round(x/B.length*100)+'%':'0%';
kpiInto('#bill-kpi',[
['รอวางบิล',c('รอวางบิล'),'purple',p(c('รอวางบิล')),'🧾'],
['รอเอกสาร',c('รอเอกสาร'),'warn',p(c('รอเอกสาร')),'📄'],
['รับชำระแล้ว',c('รับชำระแล้ว'),'good',p(c('รับชำระแล้ว')),'💰',B.length?c('รับชำระแล้ว')/B.length*100:0],
['ค้างชำระเกินกำหนด',c('ค้างชำระ'),'crit',p(c('ค้างชำระ')),'🔴']
]);
}
const U_TYPE_OF = {'u-export':'Export','u-import':'Import','u-other':'งานอื่นๆ'};
function uploadRows(tabId){
const want=U_TYPE_OF[tabId];
return STATE.tracking.filter(r=>{
const t=(r.type||'').trim();
if(want==='งานอื่นๆ') return t!=='Export' && t!=='Import';
return t===want;
});
}
const TPL_MARK = '#BU5-TEMPLATE';
const TPL_VERSION = 'v2';
const TPL_SALT = 'BU5-CONTROL-TOWER';
const TPL_ROWS = 30;                    // แถวว่างให้กรอกในเทมเพลต
const tplHeaders = () => ['เลขที่ใบงาน'].concat(CS_FIELDS.map(f => f[1]));
function tplSign(type, issued, by){
const base = [TPL_MARK, type, TPL_VERSION, issued, by, tplHeaders().join(','), TPL_SALT].join('~');
let h = 0x811c9dc5;
for(let i=0;i<base.length;i++){ h ^= base.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
return ('00000000' + h.toString(36).toUpperCase()).slice(-8);
}
const csvCell = v => { const s = String(v==null?'':v); return /[",\r\n]/.test(s) ? '"'+s.replace(/"/g,'""')+'"' : s; };
function parseCSV(text){
const rows=[]; let row=[], cell='', q=false;
for(let i=0;i<text.length;i++){
const c=text[i];
if(q){
if(c==='"'){ if(text[i+1]==='"'){ cell+='"'; i++; } else q=false; }
else cell+=c;
}else if(c==='"') q=true;
else if(c===',') { row.push(cell); cell=''; }
else if(c==='\r') continue;
else if(c==='\n'){ row.push(cell); rows.push(row); row=[]; cell=''; }
else cell+=c;
}
if(cell!=='' || row.length){ row.push(cell); rows.push(row); }
return rows;
}
function downloadTemplate(type){
if(!canUpload()){ showToast('ไม่มีสิทธิ์ดาวน์โหลดเทมเพลต'); return; }
const issued = formatNow(), by = currentUser.id;
const hdr = tplHeaders();
const lines = [[TPL_MARK, type, TPL_VERSION, issued, by, tplSign(type,issued,by)].join('|')];
lines.push(hdr.map(csvCell).join(','));
for(let i=0;i<TPL_ROWS;i++) lines.push(new Array(hdr.length).join(','));
const blob = new Blob(['﻿'+lines.join('\r\n')+'\r\n'], {type:'text/csv;charset=utf-8'});
const a = el('a'); a.href = URL.createObjectURL(blob);
a.download = 'BU5_'+type.replace(/[^A-Za-z0-9ก-๙]/g,'')+'_'+issued.slice(0,10).replace(/\//g,'-')+'.csv';
document.body.appendChild(a); a.click(); document.body.removeChild(a);
setTimeout(()=>URL.revokeObjectURL(a.href), 4000);
showToast('ดาวน์โหลดเทมเพลต '+type+' แล้ว — กรอกข้อมูลแล้วบันทึกเป็น .csv ไฟล์เดิม');
}
function readTemplate(text, wantType){
if(text.charCodeAt(0)===0xFEFF) text = text.slice(1);
const rows = parseCSV(text);
if(!rows.length) return {ok:false, error:'ไฟล์ว่าง'};
const sigLine = (rows[0][0]||'').trim();
if(sigLine.indexOf(TPL_MARK)!==0)
return {ok:false, error:'ไม่ใช่เทมเพลตของระบบ — บรรทัดแรกต้องเป็นลายเซ็น '+TPL_MARK+' (ห้ามลบหรือแก้บรรทัดแรก) กดดาวน์โหลดเทมเพลตใหม่'};
const p = sigLine.split('|');
if(p.length!==6) return {ok:false, error:'ลายเซ็นในบรรทัดแรกไม่สมบูรณ์ — ดาวน์โหลดเทมเพลตใหม่'};
const type=p[1], ver=p[2], issued=p[3], by=p[4], sig=p[5];
if(ver!==TPL_VERSION) return {ok:false, error:'เทมเพลตเป็นเวอร์ชัน '+ver+' แต่ระบบใช้ '+TPL_VERSION+' — ดาวน์โหลดเทมเพลตใหม่'};
if(sig!==tplSign(type,issued,by)) return {ok:false, error:'ลายเซ็นไม่ถูกต้อง — ไฟล์ถูกแก้บรรทัดแรก หรือไม่ได้ออกจากระบบนี้'};
if(type!==wantType) return {ok:false, error:'ไฟล์นี้เป็นเทมเพลต '+type+' แต่กำลังอัปโหลดในช่อง '+wantType+' — เลือกช่องให้ตรงประเภทงาน'};
const hdr = tplHeaders();
const got = (rows[1]||[]).map(s=>String(s||'').trim());
while(got.length && got[got.length-1]==='') got.pop();   // Excel มักทิ้งคอลัมน์ว่างท้ายแถว
if(got.length!==hdr.length || hdr.some((h,i)=>got[i]!==h))
return {ok:false, error:'หัวคอลัมน์ไม่ตรงกับเทมเพลต (พบ '+got.length+' คอลัมน์ ต้องมี '+hdr.length+
') — ห้ามเพิ่ม ลบ หรือสลับคอลัมน์ ดาวน์โหลดเทมเพลตใหม่'};
const jobs=[], seen={}, dup=[], noKey=[];
for(let r=2;r<rows.length;r++){
const cells = hdr.map((_,i)=>String(rows[r][i]==null?'':rows[r][i]).trim());
if(cells.every(v=>v==='')) continue;             // แถวว่างที่ยังไม่กรอก
const key = cells[0];
if(!key){ noKey.push(r+1); continue; }
if(seen[key] || STATE.tracking.some(t=>t.key===key)){ dup.push(key); continue; }
seen[key]=1;
const job = {key:key, type:wantType, submitted:'',
detail:'', truck:'', driver:'', phone:'', finished:'', gps:'',
risk:'On Plan', goods:'Pending'};
CS_FIELDS.forEach((f,i)=>{ job[f[0]] = cells[i+1]; });
jobs.push(job);
}
if(noKey.length) return {ok:false, error:'แถวที่ '+noKey.join(', ')+' ไม่ได้ใส่เลขที่ใบงาน — เลขที่ใบงานเป็นช่องบังคับ'};
if(!jobs.length && !dup.length) return {ok:false, error:'ยังไม่ได้กรอกข้อมูลในเทมเพลต'};
return {ok:true, jobs:jobs, dup:dup, issued:issued, by:by, type:type};
}
function uploadTemplate(file, wantType, label, pick){
if(!/\.csv$/i.test(file.name)){
showToast('รับเฉพาะไฟล์ .csv ที่ออกจากระบบ — ถ้าเปิดใน Excel ให้บันทึกเป็น CSV UTF-8 ไฟล์เดิม');
pick.value=''; return;
}
const rd = new FileReader();
rd.onerror = () => { showToast('อ่านไฟล์ไม่ได้'); pick.value=''; };
rd.onload = () => {
const res = readTemplate(String(rd.result||''), wantType);
pick.value='';
if(!res.ok){ showToast('ไม่รับไฟล์: '+res.error); return; }
res.jobs.forEach(j=>STATE.tracking.push(j));
STATE.uploads.push({time:formatNow(), file:file.name,
size:Math.max(1,Math.round(file.size/1024))+' KB', type:label, user:currentUser.name});
renderUpload(); renderSummary(); renderOverview();
let msg = 'นำเข้า '+res.jobs.length+' คำสั่งงาน ('+wantType+') จากเทมเพลตที่ออกเมื่อ '+res.issued;
if(res.dup.length) msg += ' · ข้ามเลขที่ซ้ำ '+res.dup.length+' รายการ: '+res.dup.slice(0,5).join(', ');
showToast(msg);
save('นำเข้าคำสั่งงาน '+wantType+' '+res.jobs.length+' รายการ จากเทมเพลต '+file.name);
};
rd.readAsText(file, 'utf-8');
}
function renderUpload(){
const perm=$('#upload-perm'); perm.innerHTML='';
const ok=canUpload();
const banner=el('div');
banner.style.cssText='display:flex;align-items:center;gap:10px;border-radius:11px;padding:10px 14px;'+
'margin-bottom:16px;font-size:12.5px;font-weight:600;border:1px solid '+
(ok?'color-mix(in srgb,var(--good) 35%,transparent);background:var(--good-soft);color:var(--good)'
:'color-mix(in srgb,var(--warn) 35%,transparent);background:var(--warn-soft);color:var(--warn)');
banner.appendChild(el('span',null,ok?'🔓':'🔒'));
banner.appendChild(el('span',null, ok
? ('คุณมีสิทธิ์อัปโหลดและแก้ไขคำสั่งงาน (รหัส '+currentUser.id+')')
: ('โหมดดูอย่างเดียว — อัปโหลด/แก้ไขได้เฉพาะรหัส '+UPLOAD_ALLOWED.join(' และ '))));
perm.appendChild(banner);
const g=$('#upload-grid'); g.innerHTML='';
UPLOAD_TYPES.forEach(([label,kind,tpl,jobType])=>{
const card=el('div','card');
card.appendChild(el('span','chip '+kind,label));
const dz=el('div','dropzone'); dz.style.marginTop='12px';
dz.appendChild(el('div','dz-title','นำเข้าคำสั่งงานด้วยเทมเพลต'));
const steps=el('ol','dz-steps');
['ดาวน์โหลดเทมเพลต '+jobType,
'กรอกข้อมูลใน Excel แล้วบันทึกเป็น CSV UTF-8 ไฟล์เดิม',
'อัปโหลดไฟล์นั้นกลับเข้ามา'].forEach(s=>steps.appendChild(el('li',null,s)));
dz.appendChild(steps);
const row=el('div','dz-btns');
const dl=el('button','btn ghost','⬇ ดาวน์โหลดเทมเพลต');
const pick=el('input'); pick.type='file'; pick.accept='.csv'; pick.style.display='none';
const bt=el('button','btn','⬆ อัปโหลดที่กรอกแล้ว');
if(!ok){
dl.disabled=true; dl.title='ไม่มีสิทธิ์';
bt.disabled=true; bt.title='ไม่มีสิทธิ์อัปโหลด';
}else{
dl.onclick=()=>downloadTemplate(jobType);
bt.onclick=()=>pick.click();
}
pick.onchange=()=>{ const f=pick.files&&pick.files[0]; if(f) uploadTemplate(f,jobType,label,pick); };
row.appendChild(dl); row.appendChild(bt); row.appendChild(pick);
dz.appendChild(row);
dz.appendChild(el('div','dz-warn','รับเฉพาะเทมเพลตที่ออกจากระบบ · ห้ามลบบรรทัดแรกหรือแก้หัวคอลัมน์'));
card.appendChild(dz);
const n=STATE.uploads.filter(u=>u.type===label).length;
const jn=STATE.tracking.filter(r=>{ const t=(r.type||'').trim();
return jobType==='งานอื่นๆ' ? (t!=='Export'&&t!=='Import') : t===jobType; }).length;
card.appendChild(el('div','upload-stat','นำเข้าแล้ว '+n+' ไฟล์ · '+jn+' คำสั่งงาน'));
g.appendChild(card);
});
$('#cs-tabs').innerHTML='';
[['u-export','📤 Export'],['u-import','📥 Import'],['u-other','📦 งานอื่นๆ']].forEach(([id,lbl],idx)=>{
const rows=uploadRows(id);
const draft=rows.filter(r=>!isSubmitted(r)).length;
const b=el('button','tab-btn'+(idx===0?' active':''),lbl+' '); b.dataset.tab=id;
b.appendChild(el('span','chip '+(draft?'warn':'good'), draft?(draft+' รอส่ง'):(rows.length+' ส่งแล้ว')));
b.onclick=()=>{
$('#cs-tabs').querySelectorAll('.tab-btn').forEach(x=>x.classList.remove('active')); b.classList.add('active');
document.querySelectorAll('#page-upload .subtab').forEach(s=>s.classList.remove('active'));
$('#'+id).classList.add('active');
};
$('#cs-tabs').appendChild(b);
});
['u-export','u-import','u-other'].forEach(renderUploadTab);
renderUploadLog();
}
function renderUploadTab(id){
const host=$('#'+id); host.innerHTML='';
const ok=canUpload();
const rows=uploadRows(id);
const type=U_TYPE_OF[id];
const bar=el('div','save-bar');
bar.appendChild(el('span','note', ok
? 'แก้ข้อมูลแล้วกดบันทึก · กด "ส่งให้ CC" เมื่อตรวจสอบครบ งานจะไปแสดงในหน้าติดตามงาน (CC)'
: 'โหมดดูอย่างเดียว'));
const grp=el('div'); grp.style.cssText='display:flex;gap:8px;flex-wrap:wrap';
if(ok){
const addB=el('button','row-add-btn','+ เพิ่มคำสั่งงาน');
addB.onclick=()=>addJob(type);
const sendB=el('button','btn','ส่งให้ CC ทั้งแท็บ');
const nDraft=rows.filter(r=>!isSubmitted(r)).length;
if(!nDraft){ sendB.disabled=true; sendB.title='ไม่มีงานที่รอส่ง'; }
sendB.onclick=()=>submitTab(type);
const saveB=el('button','btn','บันทึกการเปลี่ยนแปลง');
saveB.onclick=()=>save('แก้ไขคำสั่งงาน — '+type+' (หน้าอัปโหลด)');
grp.appendChild(addB); grp.appendChild(saveB); grp.appendChild(sendB);
}
bar.appendChild(grp); host.appendChild(bar);
if(!rows.length){
const card=el('div','card');
card.appendChild(emptyBox('ยังไม่มีคำสั่งงาน'+type,
ok ? ['กด "⬇ ดาวน์โหลดเทมเพลต" ด้านบน กรอกแล้วอัปโหลดกลับเข้ามา',
'หรือกด "+ เพิ่มคำสั่งงาน" เพื่อเพิ่มทีละรายการ',
'ช่องที่ยังไม่ทราบ เช่น เลขตู้ ปล่อยว่างไว้ได้ จะขึ้น waiting ให้ CC กรอก']
: ['ยังไม่มีข้อมูล — ติดต่อ CS ผู้มีสิทธิ์อัปโหลด']));
host.appendChild(card); return;
}
const card=el('div','card'), wrap=el('div','tbl-wrap'), tb=el('table','plain wide'), thead=el('thead');
const g=el('tr','grp');
[['📝 CS กรอกตอนอัปโหลด',1+CS_FIELDS.length],['⏳ CC กรอกภายหลัง',CC_FIELDS.length],['🚦 สถานะ',ok?2:1]].forEach(([t,n])=>{
const th=el('th',null,t); th.colSpan=n; g.appendChild(th); });
thead.appendChild(g);
const hr=el('tr');
hr.appendChild(el('th','sticky1','เลขที่ใบงาน'));
CS_FIELDS.forEach(([,lbl])=>hr.appendChild(el('th',null,lbl)));
CC_FIELDS.forEach(([,lbl])=>hr.appendChild(el('th',null,lbl)));
hr.appendChild(el('th',null,'สถานะส่งงาน'));
if(ok) hr.appendChild(el('th',null,'จัดการ'));
thead.appendChild(hr); tb.appendChild(thead);
const body=el('tbody');
rows.forEach(r=>{
const sent=isSubmitted(r);
const tr=el('tr'); if(!sent) tr.className='flag-warn';
tr.appendChild(td(r.key,'sticky1 num'));
CS_FIELDS.forEach(([f])=>{
if(!ok){ tr.appendChild(td(r[f]||'-')); return; }
const c=el('td'); const i=el('input','cell-input'); i.type='text'; i.value=r[f]||'';
i.dataset.tk=r.key; i.dataset.tf=f; c.appendChild(i); tr.appendChild(c);
});
CC_FIELDS.forEach(([f])=>{
const v=(r[f]||'').trim();
if(v) tr.appendChild(td(v));
else { const c=el('td'); c.appendChild(waitingChip()); tr.appendChild(c); }
});
tr.appendChild(chipTd(sent?'ส่งแล้ว':'รอส่ง', sent?'good':'warn'));
if(ok){
const ac=el('td');
if(!sent){
const b=el('button','btn','ส่งให้ CC'); b.style.padding='5px 12px';
b.onclick=()=>submitJob(r.key);
ac.appendChild(b);
}else{
const b=el('button','row-del-btn','ดึงกลับ'); b.title='ดึงกลับมาแก้ไข';
b.onclick=()=>unsubmitJob(r.key);
ac.appendChild(b);
}
tr.appendChild(ac);
}
body.appendChild(tr);
});
tb.appendChild(body); wrap.appendChild(tb); card.appendChild(wrap); host.appendChild(card);
}
function addJob(type){
if(!canUpload()){ showToast('ไม่มีสิทธิ์เพิ่มคำสั่งงาน'); return; }
const key=prompt('เลขที่ใบงาน (ห้ามซ้ำ)'); if(!key) return;
const k=key.trim();
if(STATE.tracking.some(r=>r.key===k)){ showToast('มีเลขที่ '+k+' อยู่แล้ว'); return; }
const cust=prompt('ชื่อลูกค้า')||'';
STATE.tracking.push({key:k,type:type,submitted:'',date:new Date().toLocaleDateString('th-TH'),
customer:cust,from:'',to:'',detail:'',booking:'',size:'',due:'',
truck:'',driver:'',phone:'',finished:'',gps:'',risk:'On Plan',goods:'Pending'});
renderUpload(); renderSummary(); renderOverview();
showToast('เพิ่มแล้ว — กรอกข้อมูลแล้วกด "บันทึกการเปลี่ยนแปลง"');
}
function submitJob(key){
const r=STATE.tracking.find(x=>x.key===key); if(!r) return;
r.submitted=SUBMITTED;
save('ส่งคำสั่งงาน '+key+' ให้ CC');
}
function unsubmitJob(key){
const r=STATE.tracking.find(x=>x.key===key); if(!r) return;
if(!confirm('ดึง '+key+' กลับมาแก้ไข? งานจะหายจากหน้าติดตามงาน (CC)')) return;
r.submitted='';
save('ดึงคำสั่งงาน '+key+' กลับมาแก้ไข');
}
function submitTab(type){
const rows=STATE.tracking.filter(r=>{
const t=(r.type||'').trim();
const match = type==='งานอื่นๆ' ? (t!=='Export'&&t!=='Import') : t===type;
return match && !isSubmitted(r);
});
if(!rows.length){ showToast('ไม่มีงานที่รอส่ง'); return; }
if(!confirm('ส่งคำสั่งงาน '+type+' จำนวน '+rows.length+' รายการ ให้ CC?')) return;
rows.forEach(r=>r.submitted=SUBMITTED);
save('ส่งคำสั่งงาน '+type+' '+rows.length+' รายการ ให้ CC');
}
function renderUploadLog(){
const b=$('#upload-body'); b.innerHTML='';
if(!STATE.uploads.length){
const tr=el('tr'); const c=td('ยังไม่มีการรับไฟล์'); c.colSpan=6;
c.style.color='var(--text-muted)'; tr.appendChild(c); b.appendChild(tr); return;
}
STATE.uploads.slice().reverse().forEach(u=>{
const tr=el('tr'); tr.appendChild(td(u.time,'num')); tr.appendChild(td(u.file));
tr.appendChild(chipTd(u.type,'info')); tr.appendChild(td(u.size||'-')); tr.appendChild(td(u.user));
tr.appendChild(chipTd('รับไฟล์แล้ว','good')); b.appendChild(tr);
});
}
function summaryRows(){
const m={};
STATE.tracking.forEach(r=>{
const cust=(r.customer||'ไม่ระบุลูกค้า').trim();
const type=(r.type||'').trim()||'งานอื่นๆ';
const route=((r.from||'')+' → '+(r.to||'')).replace(/^ → $/,'-');
const key=cust+'|'+type;
if(!m[key]) m[key]={cust,type,route,need:0,done:0};
m[key].need++;
if((r.truck||'').trim()) m[key].done++;
});
return Object.values(m).sort((a,b)=>(a.done/a.need)-(b.done/b.need));
}
function renderSummary(){
const b=$('#sum-body'); b.innerHTML='';
const rows=summaryRows();
let need=0,done=0;
if(!rows.length){
const tr=el('tr'), c=el('td'); c.colSpan=8; c.style.cssText='padding:22px;white-space:normal';
c.appendChild(emptyBox('ยังไม่มีคำสั่งงานให้สรุป',
['เพิ่มคำสั่งงานในชีท Tracking_งานCC ก่อน','หน้านี้จะสรุปให้อัตโนมัติตามลูกค้าและประเภทงาน','รีเฟรชหน้านี้']));
tr.appendChild(c); b.appendChild(tr);
}else{
rows.forEach(s=>{
need+=s.need; done+=s.done;
const pct=Math.round(s.done/s.need*100), full=s.done>=s.need;
const tr=el('tr'); if(!full&&pct<50) tr.className='flag-crit';
tr.appendChild(td(s.cust)); tr.appendChild(td(s.route));
tr.appendChild(chipTd(s.type,s.type==='Export'?'info':(s.type==='Import'?'accent':'neutral')));
tr.appendChild(td(s.need,'num')); tr.appendChild(td(s.need,'num'));
const pc=el('td'); const pw=el('div','prog'); const ps=el('span'); ps.style.width=pct+'%';
if(!full) ps.style.background=pct<50?'var(--crit)':'var(--warn)';
pw.appendChild(ps); pc.appendChild(pw); pc.appendChild(el('span','num',s.done+'/'+s.need)); tr.appendChild(pc);
tr.appendChild(td(s.need-s.done,'num'));
tr.appendChild(chipTd(full?'จัดครบ':(pct<50?'ขาดรถ':'รอจัดรถ'),full?'good':(pct<50?'crit':'warn')));
b.appendChild(tr);
});
}
kpiInto('#sum-kpi',[
['รวมออเดอร์',STATE.tracking.length,'info',undefined,'📦'],
['รวมเที่ยวที่ต้องจัด',need,'purple',undefined,'🗺️'],
['จัดรถแล้ว',done,'good',need?Math.round(done/need*100)+'%':'0%','🚛',need?done/need*100:0],
['คงเหลือ / ขาดรถ',need-done,'warn',need?Math.round((need-done)/need*100)+'%':'0%','⚠️']
]);
}
function xrow(label,chipKind,pct,barColor,val,statusTxt,statusKind){
const r=el('div','xrow'); const l=el('div','xrow-label');
if(chipKind) l.appendChild(el('span','chip '+chipKind[1],chipKind[0]));
l.appendChild(document.createTextNode(' '+label));
r.appendChild(l);
const bw=el('div','xrow-bar'); const bs=el('span'); bs.style.width=pct+'%';
bs.style.background='var(--'+barColor+')'; bw.appendChild(bs); r.appendChild(bw);
r.appendChild(el('div','xrow-val',val));
if(statusTxt){ const s=el('div','xrow-status'); s.appendChild(el('span','chip '+statusKind,statusTxt)); r.appendChild(s); }
return r;
}
function kpiInto(hostSel,list){
const h=$(hostSel); h.innerHTML='';
list.forEach(([l,v,c,dt,ic,pct])=>{
const d=el('div','kpi');
if(c){ d.style.setProperty('--kpi-tone','var(--'+c+')'); d.style.setProperty('--kpi-soft','var(--'+c+'-soft)'); }
if(ic) d.appendChild(el('div','kpi-ic',ic));
d.appendChild(el('div','kpi-label',l));
const vv=el('div','kpi-value num',String(v)); if(c) vv.style.color='var(--'+c+')'; d.appendChild(vv);
if(dt!==undefined) d.appendChild(el('div','kpi-delta',dt));
if(pct!==undefined && pct!==null){
const bar=el('div','kpi-bar'); const s=el('span');
s.style.width=Math.max(0,Math.min(100,pct))+'%'; bar.appendChild(s); d.appendChild(bar);
}
h.appendChild(d); });
}
function donutInto(hostSel,total,parts,centerLabel){
const h=$(hostSel); h.innerHTML='';
const R=38, C=2*Math.PI*R, sum=parts.reduce((a,p)=>a+p.n,0);
const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');
svg.setAttribute('viewBox','0 0 100 100'); svg.setAttribute('width','96'); svg.setAttribute('height','96');
svg.setAttribute('class','donut');
const ring=(color,dash,offset,w)=>{
const c=document.createElementNS('http://www.w3.org/2000/svg','circle');
c.setAttribute('cx','50'); c.setAttribute('cy','50'); c.setAttribute('r',String(R));
c.setAttribute('fill','none'); c.setAttribute('stroke',color); c.setAttribute('stroke-width',String(w||11));
if(dash!=null){ c.setAttribute('stroke-dasharray',dash+' '+C); c.setAttribute('stroke-dashoffset',String(offset)); c.setAttribute('stroke-linecap','round'); }
c.setAttribute('transform','rotate(-90 50 50)');
return c;
};
svg.appendChild(ring('var(--surface-3)',null,0));
let acc=0;
if(sum>0) parts.forEach(p=>{
if(!p.n) return;
svg.appendChild(ring('var(--'+p.tone+')', (p.n/sum)*C, -acc, 11));
acc += (p.n/sum)*C;
});
const t1=document.createElementNS('http://www.w3.org/2000/svg','text');
t1.setAttribute('x','50'); t1.setAttribute('y','48'); t1.setAttribute('text-anchor','middle');
t1.setAttribute('font-size','21'); t1.setAttribute('font-weight','700'); t1.setAttribute('fill','currentColor');
t1.textContent=String(total); svg.appendChild(t1);
const t2=document.createElementNS('http://www.w3.org/2000/svg','text');
t2.setAttribute('x','50'); t2.setAttribute('y','62'); t2.setAttribute('text-anchor','middle');
t2.setAttribute('font-size','9'); t2.setAttribute('fill','var(--text-muted)');
t2.textContent=centerLabel; svg.appendChild(t2);
h.appendChild(svg);
const lg=el('div','donut-legend');
parts.forEach(p=>{
const r=el('div','dlg'); const i=el('i'); i.style.background='var(--'+p.tone+')';
r.appendChild(i); r.appendChild(el('span',null,p.label));
r.appendChild(el('b',null,(sum?Math.round(p.n/sum*100):0)+'%'));
lg.appendChild(r);
});
h.appendChild(lg);
}
function goPage(name){
const b=document.querySelector('.nav-btn[data-page="'+name+'"]');
if(b) b.click();
}
async function reloadState(btn){
if(btn) btn.classList.add('spin');
setConn('busy','กำลังโหลดข้อมูล...');
try{
const s=await apiLoad();
STATE.roster=s.roster||[]; STATE.tracking=s.tracking||[]; STATE.billing=s.billing||[];
STATE.cells=s.cells||{}; STATE.uploads=s.uploads||[]; STATE.audit=s.audit||[];
online=true; lastError='';
setConn('ok','เชื่อมต่อ Google Sheet แล้ว');
renderRoster(); renderUpload(); renderTracking(); renderBilling(); renderSummary(); renderOverview();
showToast('โหลดข้อมูลจาก Google Sheet ใหม่แล้ว');
}catch(e){
online=false; lastError=e.message;
setConn('bad','เชื่อมต่อ Sheet ไม่ได้');
showToast('โหลดไม่สำเร็จ: '+e.message);
}finally{ if(btn) btn.classList.remove('spin'); }
}
function noData(hostSel,msg){
const h=$(hostSel); h.innerHTML='';
const p=el('div',null,msg); p.style.cssText='font-size:12.5px;color:var(--text-muted);padding:10px 2px';
h.appendChild(p);
}
function renderOverview(){
const R=STATE.roster, B=STATE.billing;
const ALL=STATE.tracking;
const T=submittedJobs();          // ความเสี่ยง/สถานะเป็นเรื่องของงานที่ส่งให้ CC แล้ว
const waitingCS=ALL.length-T.length;
const sum=summaryRows();
const need=sum.reduce((a,s)=>a+s.need,0), done=sum.reduce((a,s)=>a+s.done,0);
const urgent=T.filter(isUrgent).length;
const overdue=B.filter(b=>docOf(b)==='ค้างชำระ').length;
const pctDone = need ? Math.round(done/need*100) : 0;
const eb=$('#exec-brief'); eb.innerHTML='';
const pc=(n,d)=>d?Math.round(n/d*100)+'%':'0%', pc2=pc;
[['blue','📋','คำสั่งงานในระบบ',ALL.length, need?('จัดรถแล้ว '+done+'/'+need+' ('+pctDone+'%)'):'ยังไม่มีเที่ยวงาน'],
['teal','🚚','รอ CS ตรวจ/ส่งให้ CC',waitingCS, pc(waitingCS,ALL.length)],
['purple','📍','งานต้องเร่งติดตาม',urgent, pc(urgent,T.length)],
['orange','📅','ลูกค้าค้างชำระเกินกำหนด',overdue, pc(overdue,B.length)]
].forEach(([tone,ic,lbl,val,sub])=>{
const c=el('div','hero-card'); c.dataset.tone=tone;
const top=el('div','hero-top');
top.appendChild(el('div','hero-ic',ic));
top.appendChild(el('div','hero-lbl',lbl));
c.appendChild(top);
c.appendChild(el('div','hero-val num',String(val)));
c.appendChild(el('div','hero-sub',sub));
eb.appendChild(c);
});
const withPlan=R.filter(r=>r.planOut||r.planBack).length;
const absent=R.filter(r=>r.driverReady==='ขาด').length, leave=R.filter(r=>r.driverReady==='ลา').length;
const late=R.filter(r=>{const sm=/(\d{1,2}:\d{2})/.exec(r.shift||'');const st=sm?toMin(sm[1]):null,a=toMin(r['in']);
if(st===null||a===null)return false;let d=a-st;if(d>720)d-=1440;if(d<-720)d+=1440;return d>0;}).length;
$('#ins1').textContent=ALL.length+' คำสั่งงาน · พจส. '+R.length+' คน · มีแผนงาน '+withPlan+' คน';
kpiInto('#ov-kpi1',[
['คำสั่งงานทั้งหมด',ALL.length,'info', waitingCS ? ('รอ CS ส่ง '+waitingCS) : 'ส่งให้ CC ครบแล้ว','📋'],
['ขาด / ลา / มาสาย',absent+' / '+leave+' / '+late,'warn','พจส. '+R.length+' คน','🚚'],
['พจส. มีแผนงานแล้ว',withPlan,'good','จาก '+R.length+' คน','✅',R.length?withPlan/R.length*100:0],
['เที่ยวที่จัดแล้ว',done+'/'+need,'crit',pctDone+'%','👤',pctDone]
]);
const oc=$('#ov-cust'); oc.innerHTML='';
if(!sum.length) noData('#ov-cust','ยังไม่มีคำสั่งงานในชีท');
else sum.forEach(s=>{
const pct=Math.round(s.done/s.need*100), full=s.done>=s.need;
oc.appendChild(xrow(s.cust,[s.type==='งานอื่นๆ'?'อื่นๆ':s.type,
s.type==='Export'?'info':(s.type==='Import'?'accent':'neutral')],
pct,full?'good':(pct<50?'crit':'warn'),s.done+'/'+s.need,
full?'จัดครบ':(pct<50?'ขาดรถ':'รอจัดรถ'),full?'good':(pct<50?'crit':'warn')));
});
const dDone   = T.filter(r=>goodsOf(r)==='Complete').length;
const dRisky  = T.filter(r=>goodsOf(r)!=='Complete' && riskOf(r)!=='On Plan').length;
const dMoving = T.length - dDone - dRisky;
donutInto('#ov-donut', ALL.length, [
{label:'รอ CS ตรวจ/ส่งให้ CC', n:waitingCS, tone:'info'},
{label:'เสี่ยง / ต้องเร่งติดตาม', n:dRisky,   tone:'crit'},
{label:'กำลังดำเนินงาน',        n:dMoving,   tone:'warn'},
{label:'เสร็จสิ้นแล้ว',          n:dDone,     tone:'good'}
], 'คำสั่งงาน');
const evTrips=T.filter(r=>(r.truck||'').trim()).length;
$('#eco-sub').textContent = evTrips
? ('ขนส่งด้วยรถ EV แล้ว '+evTrips+' เที่ยววันนี้ · ลดการใช้น้ำมันดีเซล')
: 'ลดการใช้พลังงาน สู่อนาคตที่สะอาดกว่า';
const ot=$('#ov-type'); ot.innerHTML='';
if(!T.length) noData('#ov-type','ยังไม่มีคำสั่งงานในชีท');
else [['Export','info'],['Import','accent'],['งานอื่นๆ','neutral']].forEach(([t,cl])=>{
const rows=T.filter(r=>{const ty=(r.type||'').trim();
return t==='งานอื่นๆ' ? (ty!=='Export'&&ty!=='Import') : ty===t;});
if(!rows.length) return;
const custs=new Set(rows.map(r=>r.customer)).size;
const w=el('div'); w.style.marginBottom='12px';
const hd=el('div'); hd.style.cssText='display:flex;justify-content:space-between;font-size:13px;margin-bottom:4px';
const lft=el('span'); lft.appendChild(el('span','chip '+cl,t));
lft.appendChild(document.createTextNode(' '+custs+' ลูกค้า'));
hd.appendChild(lft); hd.appendChild(el('b','num',rows.length+' งาน')); w.appendChild(hd);
const pw=el('div','prog'); pw.style.width='100%'; const ps=el('span');
ps.style.width=Math.round(rows.length/T.length*100)+'%'; ps.style.background='var(--'+cl+')';
pw.appendChild(ps); w.appendChild(pw); ot.appendChild(w);
});
$('#ins2').textContent = T.length ? (urgent+' จาก '+T.length+' งาน') : 'ยังไม่มีคำสั่งงาน';
const riskCnt=v=>T.filter(r=>riskOf(r)===v).length;
const gCnt=v=>T.filter(r=>goodsOf(r)===v).length;
kpiInto('#ov-kpi2',[
['งานเกินกำหนด',riskCnt('เสี่ยงส่งไม่ทัน'),'crit',pc2(riskCnt('เสี่ยงส่งไม่ทัน'),T.length),'🔔'],
['กำลังดำเนินงาน',gCnt('On the Way'),'info',pc2(gCnt('On the Way'),T.length),'🚚'],
['เสร็จสิ้นแล้ว',gCnt('Complete'),'good',pc2(gCnt('Complete'),T.length),'✅'],
['ยังไม่เริ่มงาน',gCnt('Pending'),'purple',pc2(gCnt('Pending'),T.length),'🕐',T.length?gCnt('Pending')/T.length*100:0]
]);
const tr1=$('#ov-trisk'); tr1.innerHTML='';
if(!T.length) noData('#ov-trisk','ยังไม่มีคำสั่งงานในชีท');
else [['t-export','Export','info'],['t-import','Import','accent'],['t-other','งานอื่นๆ','neutral']].forEach(([id,lbl,cl])=>{
const rows=trackRows(id); if(!rows.length) return;
const u=rows.filter(isUrgent).length;
tr1.appendChild(xrow('',[lbl,cl],Math.round(u/rows.length*100),cl,u+'/'+rows.length));
});
const cr=$('#ov-crisk'); cr.innerHTML='';
const byCust={};
T.filter(isUrgent).forEach(r=>{
const c=(r.customer||'ไม่ระบุ').trim();
if(!byCust[c]) byCust[c]={n:0,worst:'On Plan'};
byCust[c].n++;
const rk=riskOf(r);
if(rk==='เสี่ยงส่งไม่ทัน') byCust[c].worst='เสี่ยงส่งไม่ทัน';
else if(rk==='เสี่ยงล่าช้า'&&byCust[c].worst!=='เสี่ยงส่งไม่ทัน') byCust[c].worst='เสี่ยงล่าช้า';
});
const custKeys=Object.keys(byCust);
if(!custKeys.length) noData('#ov-crisk','ไม่มีงานที่ต้องติดตาม');
else{
const mx=Math.max(1,...custKeys.map(c=>byCust[c].n));
custKeys.sort((a,b)=>byCust[b].n-byCust[a].n).forEach(c=>{
const v=byCust[c];
cr.appendChild(xrow(c,null,Math.round(v.n/mx*100),RISK_CLS[v.worst]||'neutral',
String(v.n),v.worst,RISK_CLS[v.worst]||'neutral'));
});
}
const c=v=>B.filter(b=>docOf(b)===v).length;
$('#ins3').textContent = B.length ? ('ค้างชำระ '+c('ค้างชำระ')+' ราย · รอเอกสาร '+c('รอเอกสาร')+' ราย')
: 'ยังไม่มีรายการวางบิล';
kpiInto('#ov-kpi3',[
['ค้างชำระเกินกำหนด',c('ค้างชำระ'),'crit',pc2(c('ค้างชำระ'),B.length),'🔴'],
['รอเอกสาร',c('รอเอกสาร'),'warn',pc2(c('รอเอกสาร'),B.length),'📄'],
['รอวางบิล',c('รอวางบิล'),'purple',pc2(c('รอวางบิล'),B.length),'🧾'],
['รับชำระแล้ว',c('รับชำระแล้ว'),'good',pc2(c('รับชำระแล้ว'),B.length),'💰',B.length?c('รับชำระแล้ว')/B.length*100:0]
]);
const ob=$('#ov-bill'); ob.innerHTML='';
const ICON={'ค้างชำระ':['🔴','crit'],'รอเอกสาร':['🟠','warn'],'รอวางบิล':['⚪','neutral']};
const urgentBills=B.filter(b=>ICON[docOf(b)]);
if(!urgentBills.length){
const p=el('div',null,B.length?'ไม่มีรายการที่ต้องเร่งติดตาม':'ยังไม่มีรายการวางบิลในชีท');
p.style.cssText='font-size:12.5px;color:var(--text-muted);padding:6px 2px'; ob.appendChild(p);
}else urgentBills.forEach(b=>{
const st=docOf(b), note=noteOf(b);
const a=el('div','alert '+ICON[st][1]);
a.appendChild(el('span',null,ICON[st][0]));
const bd=el('div'); bd.style.flex='1';
const t=el('div','alert-title'); const lf=el('span');
lf.appendChild(document.createTextNode((b.customer||'-')+' '));
lf.appendChild(el('span','chip '+ICON[st][1],st));
t.appendChild(lf); t.appendChild(el('span','alert-due','ครบกำหนด '+(b.due||'-')));
bd.appendChild(t);
bd.appendChild(el('div','alert-desc',note||('เลขที่ '+b.key)));
a.appendChild(bd); ob.appendChild(a);
});
renderAudit();
}
function renderAudit(){
const b=$('#audit-body'); b.innerHTML='';
if(!STATE.audit.length){ const tr=el('tr'); const c=td('ยังไม่มีประวัติ'); c.colSpan=5; c.style.color='var(--text-muted)'; tr.appendChild(c); b.appendChild(tr); return; }
STATE.audit.forEach(e=>{ const tr=el('tr');
tr.appendChild(td(e.time,'num')); tr.appendChild(td(e.id,'num')); tr.appendChild(td(e.name)); tr.appendChild(td(e.role)); tr.appendChild(td(e.desc));
b.appendChild(tr); });
}
function collect(){
const byKey={}; STATE.roster.forEach(r=>byKey[r.key]=r);
document.querySelectorAll('#roster-body input[data-rk],#roster-body select[data-rk]').forEach(i=>{
const r=byKey[i.dataset.rk]; if(r) r[i.dataset.f]=i.value;
});
document.querySelectorAll('#roster-body button[data-ck]').forEach(b=>{
const [key,bi]=b.dataset.ck.split('|b'); const r=byKey[key];
if(r){ r.b=r.b||['na','na','na','na','na','na','na']; r.b[+bi]=b.dataset.val; }
});
document.querySelectorAll('[data-ck]').forEach(e=>{
if(e.tagName==='BUTTON') return;                 // roster ticks จัดการไปแล้ว
STATE.cells[e.dataset.ck]=e.value;
});
const jobByKey={}; STATE.tracking.forEach(r=>jobByKey[r.key]=r);
document.querySelectorAll('input[data-tk]').forEach(i=>{
const r=jobByKey[i.dataset.tk]; if(r) r[i.dataset.tf]=i.value;
});
}
let saving=false;
async function save(desc){
if(saving) return;
if(!online){ showToast('ยังเชื่อมต่อ Google Sheet ไม่ได้ — บันทึกไม่ได้'); return; }
saving=true;
const btns=[...document.querySelectorAll('.save-bar .btn')]; btns.forEach(b=>b.disabled=true);
try{
collect();
setConn('busy','กำลังบันทึก...');
const r=await apiSave(desc);
STATE.audit.unshift({time:r.savedAt,id:currentUser.id,name:currentUser.name,role:currentUser.role.split(' - ')[0],desc});
STATE.deleted=[];
renderAudit();
setConn('ok','บันทึกแล้ว');
const n=Object.values(r.changed||{}).reduce((a,b)=>a+b,0);
showToast('บันทึกลง Google Sheet แล้ว ('+n+' รายการ) โดย '+r.by.name);
renderRosterKpi(); renderTracking(); renderBilling(); renderOverview();
}catch(e){
setConn('bad','บันทึกไม่สำเร็จ');
showToast('บันทึกไม่สำเร็จ: '+e.message);
}finally{ saving=false; btns.forEach(b=>b.disabled=false); }
}
function selectUser(id){ const f=USERS.find(u=>u.id===id); if(!f) return; currentUser=f;
$('#user-avatar').textContent=f.name.trim()[0]; $('#user-role').textContent=f.role+' · '+f.id; }
function toggleTheme(){ const dark=document.documentElement.getAttribute('data-theme')==='dark';
applyTheme(dark?'light':'dark'); try{localStorage.setItem('bu5-theme',dark?'light':'dark');}catch(e){} }
function applyTheme(t){ document.documentElement.setAttribute('data-theme',t);
$('#theme-icon').textContent=t==='dark'?'🌙':'☀️'; $('#theme-label').textContent=t==='dark'?'กลางคืน':'กลางวัน'; }
function setDateMode(mode,btn){ const s=btn.closest('.date-filter');
s.querySelectorAll('.dm-btn').forEach(b=>b.classList.toggle('active',b.dataset.mode===mode));
s.querySelector('[data-role="date-day"]').style.display=mode==='day'?'':'none';
s.querySelector('[data-role="date-from"]').style.display=mode==='range'?'':'none';
s.querySelector('[data-role="date-range-sep"]').style.display=mode==='range'?'':'none';
s.querySelector('[data-role="date-to"]').style.display=mode==='range'?'':'none';
s.querySelector('[data-role="date-month"]').style.display=mode==='month'?'':'none'; }
function applyDateFilter(btn){ const s=btn.closest('.date-filter');
const m=s.querySelector('.dm-btn.active').dataset.mode;
const v=m==='day'?s.querySelector('[data-role="date-day"]').value
:m==='range'?(s.querySelector('[data-role="date-from"]').value+' ถึง '+s.querySelector('[data-role="date-to"]').value)
:s.querySelector('[data-role="date-month"]').value;
showToast('ช่วงที่เลือก: '+v); }
function alignCols(table,classes){
if(!table) return; let left=0;
classes.forEach(cls=>{ const c=table.querySelector('.'+cls); if(!c) return;
const w=c.getBoundingClientRect().width; if(!w) return;
table.querySelectorAll('.'+cls).forEach(e=>e.style.left=left+'px'); left+=w; });
}
function alignSticky(){
const w=document.documentElement.clientWidth;
if(w>0) document.documentElement.style.setProperty('--win-w',w+'px');
[['page-dispatch','dispatch-top'],['page-tracking','cc-top']].forEach(([p,b])=>{
const pg=document.getElementById(p); if(!pg||pg.offsetParent===null) return;
const blk=pg.querySelector('.'+b); if(!blk) return;
const h=blk.getBoundingClientRect().height; if(h>0) pg.style.setProperty('--pinned-h',(64+h)+'px');
});
const rt=$('#roster-table');
if(rt&&rt.offsetParent!==null) alignCols(rt,['sticky1','sticky2','rfz3','rfz4','rfz5','rfz6','rfz7']);
['t-export','t-import'].forEach(id=>{ const t=document.querySelector('#'+id+' table.plain');
if(t&&t.offsetParent!==null) alignCols(t,['sticky1','fz2','fz3','fz4','fz5','fz6']); });
}
function tick(){ const d=new Date(),p=n=>String(n).padStart(2,'0');
$('#clock').textContent=p(d.getHours())+':'+p(d.getMinutes())+':'+p(d.getSeconds());
const TH=['อาทิตย์','จันทร์','อังคาร','พุธ','พฤหัสบดี','ศุกร์','เสาร์'];
const M=['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];
$('#clock-date').textContent=TH[d.getDay()]+' '+d.getDate()+' '+M[d.getMonth()]+' '+(d.getFullYear()+543);
}
document.querySelectorAll('.nav-btn').forEach(b=>{
b.onclick=()=>{ document.querySelectorAll('.nav-btn').forEach(x=>x.classList.remove('active')); b.classList.add('active');
document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));
document.getElementById('page-'+b.dataset.page).classList.add('active');
$('#crumb').textContent=b.dataset.label; window.scrollTo({top:0,behavior:'instant'}); setTimeout(alignSticky,0);
};
});
window.addEventListener('resize',alignSticky);
tick(); setInterval(tick,1000);
(function(){ let s=null; try{s=localStorage.getItem('bu5-theme');}catch(e){}
applyTheme(s==='dark'||s==='light'?s:(window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light')); })();
USERS.forEach(u=>{ const o=el('option',null,u.name); o.value=u.id; $('#user-select').appendChild(o); });
selectUser(USERS[0].id);
const today=new Date().toISOString().slice(0,10);
document.querySelectorAll('input[type="date"]').forEach(i=>i.value=today);
document.querySelectorAll('input[type="month"]').forEach(i=>i.value=today.slice(0,7));
(async function boot(){
renderUpload(); renderSummary(); renderTracking(); renderBilling(); renderOverview();
try{
const s = await apiLoad();
STATE.roster   = s.roster||[];
STATE.tracking = s.tracking||[];
STATE.billing  = s.billing||[];
STATE.cells    = s.cells||{};
STATE.uploads= s.uploads||[];
STATE.audit  = s.audit||[];
online = true;
setConn('ok','เชื่อมต่อ Google Sheet แล้ว');
if(!STATE.roster.length) showToast('เชื่อมต่อได้ แต่ชีท Roster ยังว่าง — รัน seedRoster() ใน Apps Script');
}catch(e){
online = false;
lastError = e.message;
setConn('bad','เชื่อมต่อ Sheet ไม่ได้');
showToast('โหลดตารางกะไม่ได้: '+e.message);
}
renderRoster(); renderUpload(); renderTracking(); renderBilling(); renderOverview();
setTimeout(alignSticky,0);
})();
