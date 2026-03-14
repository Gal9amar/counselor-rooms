import React, { useEffect, useState } from 'react';
import {
  verifyAdmin, setAdminPassword,
  getRooms, addRoom, updateRoom, deleteRoom,
  getTherapists, addTherapist, updateTherapist, deleteTherapist,
  getSchedule, updateSlot, clearSlot,
} from '../services/api';
import { Trash2, Plus, LogIn, Pencil, Check, X } from 'lucide-react';

const DAYS_HE=['ראשון','שני','שלישי','רביעי','חמישי','שישי','שבת'];
const MONTHS_HE=['ינואר','פברואר','מרץ','אפריל','מאי','יוני','יולי','אוגוסט','ספטמבר','אוקטובר','נובמבר','דצמבר'];
const ALL_HOURS=[8,9,10,11,12,13,14,15,16,17,18,19,20,21,22];

function toDateStr(d){return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;}
function formatDateHe(ds){const d=new Date(ds+'T00:00:00');return `${DAYS_HE[d.getDay()]} ${d.getDate()} ${MONTHS_HE[d.getMonth()]} ${d.getFullYear()}`;}
function hLabel(h){return `${h}:00`;}

function EditableRow({item,onRename,onDelete,placeholder}){
  const [editing,setEditing]=useState(false);
  const [val,setVal]=useState(item.name);
  const [loading,setLoading]=useState(false);
  const save=async()=>{
    const t=val.trim();
    if(!t||t===item.name){setEditing(false);setVal(item.name);return;}
    setLoading(true);
    try{await onRename(item.id,t);setEditing(false);}
    catch{setVal(item.name);setEditing(false);}
    finally{setLoading(false);}
  };
  return(
    <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100 last:border-0">
      {editing?(
        <>
          <input autoFocus className="input flex-1 py-1.5 text-sm" value={val}
            onChange={e=>setVal(e.target.value)} placeholder={placeholder}
            onKeyDown={e=>{if(e.key==='Enter')save();if(e.key==='Escape'){setVal(item.name);setEditing(false);}}}/>
          <button onClick={save} disabled={loading} className="text-green-500 hover:text-green-600 p-1"><Check size={17}/></button>
          <button onClick={()=>{setVal(item.name);setEditing(false);}} className="text-gray-300 hover:text-gray-500 p-1"><X size={17}/></button>
        </>
      ):(
        <>
          <span className="flex-1 font-medium text-gray-700">{item.name}</span>
          <button onClick={()=>setEditing(true)} className="text-gray-300 hover:text-green-500 p-1 transition-colors"><Pencil size={15}/></button>
          <button onClick={()=>onDelete(item.id)} className="text-gray-300 hover:text-red-400 p-1 transition-colors"><Trash2 size={16}/></button>
        </>
      )}
    </div>
  );
}

function SlotRow({slot,therapists,onSave,onDelete}){
  const [editing,setEditing]=useState(false);
  const [sh,setSh]=useState(slot.startHour);
  const [eh,setEh]=useState(slot.endHour);
  const [tid,setTid]=useState(slot.therapistId);
  const [nt,setNt]=useState(slot.note||'');
  const [saving,setSaving]=useState(false);
  const [err,setErr]=useState('');
  const save=async()=>{
    if(eh<=sh){setErr('סיום אחרי התחלה');return;}
    setSaving(true);setErr('');
    try{await onSave(slot.id,sh,eh,tid,nt.trim()||null);setEditing(false);}
    catch(e){setErr(e.response?.data?.error||'שגיאה');}
    finally{setSaving(false);}
  };
  const cancel=()=>{setSh(slot.startHour);setEh(slot.endHour);setTid(slot.therapistId);setNt(slot.note||'');setErr('');setEditing(false);};
  return(
    <div className="px-4 py-3 border-b border-gray-100 last:border-0">
      {editing?(
        <div className="space-y-2">
          <div className="flex flex-wrap gap-2 items-center">
            <select className="input py-1.5 text-sm w-auto" value={sh} onChange={e=>setSh(parseInt(e.target.value))}>
              {ALL_HOURS.slice(0,-1).map(h=><option key={h} value={h}>{hLabel(h)}</option>)}
            </select>
            <span className="text-gray-300">–</span>
            <select className="input py-1.5 text-sm w-auto" value={eh} onChange={e=>setEh(parseInt(e.target.value))}>
              {ALL_HOURS.filter(h=>h>sh).map(h=><option key={h} value={h}>{hLabel(h)}</option>)}
            </select>
            <select className="input py-1.5 text-sm w-auto" value={tid} onChange={e=>setTid(parseInt(e.target.value))}>
              {therapists.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
            <button onClick={save} disabled={saving} className="text-green-500 hover:text-green-600 p-1"><Check size={18}/></button>
            <button onClick={cancel} className="text-gray-300 hover:text-gray-500 p-1"><X size={18}/></button>
          </div>
          {err&&<p className="text-red-500 text-xs">{err}</p>}
        </div>
      ):(
        <div className="flex items-center justify-between">
          <div>
            <span className="font-medium text-gray-700">{slot.therapist.name}</span>
            <span className="text-sm text-gray-400 mr-3">{slot.room.name} · {hLabel(slot.startHour)}–{hLabel(slot.endHour)}</span>
            {slot.note && <span className="text-xs text-gray-400 mr-2 italic">· {slot.note}</span>}
          </div>
          <div className="flex gap-1">
            <button onClick={()=>setEditing(true)} className="text-gray-300 hover:text-green-500 p-1 transition-colors"><Pencil size={14}/></button>
            <button onClick={()=>onDelete(slot.id)} className="text-gray-300 hover:text-red-400 p-1 transition-colors"><Trash2 size={14}/></button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function AdminPage(){
  const [authed,setAuthed]=useState(!!sessionStorage.getItem('adminPass'));
  const [password,setPassword]=useState('');
  const [authError,setAuthError]=useState('');
  const [tab,setTab]=useState('rooms');
  const [rooms,setRooms]=useState([]);
  const [therapists,setTherapists]=useState([]);
  const [slots,setSlots]=useState([]);
  const [newRoom,setNewRoom]=useState('');
  const [newTherapist,setNewTherapist]=useState('');
  const [error,setError]=useState('');

  useEffect(()=>{if(authed){setAdminPassword(sessionStorage.getItem('adminPass'));loadAll();}},[authed]);

  const loadAll=async()=>{
    const today=new Date();
    const from=toDateStr(today);
    const to=new Date(today);to.setFullYear(today.getFullYear()+2);
    const [r,t,s]=await Promise.all([getRooms(),getTherapists(),getSchedule({from,to:toDateStr(to)})]);
    setRooms(r);setTherapists(t);setSlots(s);
  };

  const handleLogin=async()=>{try{await verifyAdmin(password);sessionStorage.setItem('adminPass',password);setAdminPassword(password);setAuthed(true);}catch{setAuthError('סיסמה שגויה');}};
  const addR=async()=>{if(!newRoom.trim())return;try{await addRoom(newRoom.trim());setNewRoom('');setError('');setRooms(await getRooms());}catch(e){setError(e.response?.data?.error||'שגיאה');}};
  const renR=async(id,n)=>{try{await updateRoom(id,n);setRooms(p=>p.map(r=>r.id===id?{...r,name:n}:r));}catch(e){setError(e.response?.data?.error||'שגיאה');throw e;}};
  const delR=async(id)=>{
    const r=rooms.find(r=>r.id===id);
    const cnt=slots.filter(s=>s.roomId===id).length;
    const msg=cnt>0
      ?`לחדר "${r?.name}" יש ${cnt} שיבוצים.\nמחיקתו תמחק גם את כל השיבוצים שלו.\nלהמשיך?`
      :`למחוק את "${r?.name}"?`;
    if(!confirm(msg))return;
    try{await deleteRoom(id);setRooms(rooms.filter(r=>r.id!==id));setSlots(slots.filter(s=>s.roomId!==id));}
    catch(e){setError(e.response?.data?.error||'שגיאה');}
  };
  const addT=async()=>{if(!newTherapist.trim())return;try{await addTherapist(newTherapist.trim());setNewTherapist('');setError('');setTherapists(await getTherapists());}catch(e){setError(e.response?.data?.error||'שגיאה');}};
  const renT=async(id,n)=>{try{await updateTherapist(id,n);setTherapists(p=>p.map(t=>t.id===id?{...t,name:n}:t));}catch(e){setError(e.response?.data?.error||'שגיאה');throw e;}};
  const delT=async(id)=>{
    const t=therapists.find(t=>t.id===id);
    const slotRes=await fetch(`/api/schedule?from=2020-01-01&to=2030-12-31`).then(r=>r.json()).catch(()=>[]);
    const cnt=Array.isArray(slotRes)?slotRes.filter(s=>s.therapistId===id).length:0;
    const msg=cnt>0
      ?`למטפל "${t?.name}" יש ${cnt} שיבוצים.\nמחיקתו תמחק גם את כל השיבוצים שלו.\nלהמשיך?`
      :`למחוק את "${t?.name}"?`;
    if(!confirm(msg))return;
    try{await deleteTherapist(id);setTherapists(therapists.filter(t=>t.id!==id));setSlots(slots.filter(s=>s.therapistId!==id));}
    catch(e){setError(e.response?.data?.error||'שגיאה');}
  };
  const saveSlot=async(id,sh,eh,tid,nt)=>{const u=await updateSlot(id,sh,eh,tid,nt);setSlots(p=>p.map(s=>s.id===id?{...s,...u}:s));};
  const delSlot=async(id)=>{if(!confirm('למחוק?'))return;try{await clearSlot(id);setSlots(slots.filter(s=>s.id!==id));}catch(e){setError(e.response?.data?.error||'שגיאה');}};

  const slotsByDate={};
  slots.forEach(s=>{const k=toDateStr(new Date(s.date));if(!slotsByDate[k])slotsByDate[k]=[];slotsByDate[k].push(s);});
  const sortedDates=Object.keys(slotsByDate).sort();

  if(!authed)return(
    <div className="max-w-sm mx-auto mt-16 px-4 fade-up">
      <div className="card rounded-2xl p-8">
        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-green-400 to-green-600 flex items-center justify-center mx-auto mb-5 shadow-lg shadow-green-200">
          <span className="text-white font-bold text-2xl">מ</span>
        </div>
        <h2 className="text-xl font-bold text-gray-800 mb-6 text-center">כניסת מנהל</h2>
        <input type="password" placeholder="סיסמה" className="input mb-3"
          value={password} onChange={e=>setPassword(e.target.value)}
          onKeyDown={e=>e.key==='Enter'&&handleLogin()}/>
        {authError&&<p className="text-red-500 text-sm mb-3">{authError}</p>}
        <button onClick={handleLogin} className="btn-primary w-full py-3 flex items-center justify-center gap-2">
          <LogIn size={18}/> כניסה
        </button>
      </div>
    </div>
  );

  const tabs=[{id:'rooms',label:'חדרים'},{id:'therapists',label:'מטפלים'},{id:'schedule',label:'שיבוצים'}];

  return(
    <div className="fade-up">
      <div className="flex items-center justify-between mb-8">
        <h1 className="section-title">פאנל מנהל</h1>
        <button onClick={()=>{sessionStorage.removeItem('adminPass');setAuthed(false);}} className="btn-ghost text-sm px-3 py-1.5">יציאה</button>
      </div>

      <div className="flex gap-1 mb-6 bg-gray-100 rounded-xl p-1 w-fit">
        {tabs.map(t=>(
          <button key={t.id} onClick={()=>{setTab(t.id);setError('');}}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-all whitespace-nowrap ${tab===t.id?'bg-white shadow-sm text-gray-800':'text-gray-400 hover:text-gray-600'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {error&&<div className="bg-red-50 border border-red-200 text-red-600 rounded-xl p-3 mb-4 text-sm">{error}</div>}

      {tab==='rooms'&&(
        <div className="space-y-4">
          <div className="flex gap-2">
            <input type="text" placeholder="שם חדר חדש" className="input" value={newRoom}
              onChange={e=>setNewRoom(e.target.value)} onKeyDown={e=>e.key==='Enter'&&addR()}/>
            <button onClick={addR} className="btn-primary px-4 py-2.5 flex items-center gap-1 whitespace-nowrap"><Plus size={16}/> הוסף</button>
          </div>
          <div className="card rounded-2xl overflow-hidden">
            {rooms.length===0&&<p className="text-gray-400 text-sm text-center py-6">אין חדרים</p>}
            {rooms.map(r=><EditableRow key={r.id} item={r} onRename={renR} onDelete={delR} placeholder="שם חדר"/>)}
          </div>
        </div>
      )}

      {tab==='therapists'&&(
        <div className="space-y-4">
          <div className="flex gap-2">
            <input type="text" placeholder="שם מטפל חדש" className="input" value={newTherapist}
              onChange={e=>setNewTherapist(e.target.value)} onKeyDown={e=>e.key==='Enter'&&addT()}/>
            <button onClick={addT} className="btn-primary px-4 py-2.5 flex items-center gap-1 whitespace-nowrap"><Plus size={16}/> הוסף</button>
          </div>
          <div className="card rounded-2xl overflow-hidden">
            {therapists.length===0&&<p className="text-gray-400 text-sm text-center py-6">אין מטפלים</p>}
            {therapists.map(t=><EditableRow key={t.id} item={t} onRename={renT} onDelete={delT} placeholder="שם מטפל"/>)}
          </div>
        </div>
      )}

      {tab==='schedule'&&(
        <div className="space-y-4">
          {sortedDates.length===0&&<p className="text-gray-400 text-sm text-center py-10">אין שיבוצים</p>}
          {sortedDates.map(ds=>(
            <div key={ds} className="card rounded-2xl overflow-hidden">
              <div className="px-4 py-2.5 border-b border-gray-100 bg-green-50">
                <span className="font-semibold text-green-700 text-sm">{formatDateHe(ds)}</span>
              </div>
              {slotsByDate[ds].sort((a,b)=>a.startHour-b.startHour).map(s=>(
                <SlotRow key={s.id} slot={s} therapists={therapists} onSave={saveSlot} onDelete={delSlot}/>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
