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
  const handleSave=async()=>{
    const t=val.trim();
    if(!t||t===item.name){setEditing(false);setVal(item.name);return;}
    setLoading(true);
    try{await onRename(item.id,t);setEditing(false);}
    catch{setVal(item.name);setEditing(false);}
    finally{setLoading(false);}
  };
  return(
    <div className="flex items-center gap-2 px-4 py-3 border-b border-white/5 last:border-0">
      {editing?(
        <>
          <input autoFocus className="flex-1 input-glass rounded-lg px-3 py-1.5 text-sm" value={val}
            onChange={e=>setVal(e.target.value)} placeholder={placeholder}
            onKeyDown={e=>{if(e.key==='Enter')handleSave();if(e.key==='Escape'){setVal(item.name);setEditing(false);}}}/>
          <button onClick={handleSave} disabled={loading} className="text-green-400 hover:text-green-300 p-1"><Check size={17}/></button>
          <button onClick={()=>{setVal(item.name);setEditing(false);}} className="text-white/30 hover:text-white/60 p-1"><X size={17}/></button>
        </>
      ):(
        <>
          <span className="flex-1 font-medium text-white/80">{item.name}</span>
          <button onClick={()=>setEditing(true)} className="text-white/20 hover:text-green-400 p-1 transition-colors"><Pencil size={15}/></button>
          <button onClick={()=>onDelete(item.id)} className="text-white/20 hover:text-red-400 p-1 transition-colors"><Trash2 size={16}/></button>
        </>
      )}
    </div>
  );
}

function SlotRow({slot,therapists,onSave,onDelete}){
  const [editing,setEditing]=useState(false);
  const [startHour,setStartHour]=useState(slot.startHour);
  const [endHour,setEndHour]=useState(slot.endHour);
  const [therapistId,setTherapistId]=useState(slot.therapistId);
  const [saving,setSaving]=useState(false);
  const [err,setErr]=useState('');
  const handleSave=async()=>{
    if(endHour<=startHour){setErr('סיום אחרי התחלה');return;}
    setSaving(true);setErr('');
    try{await onSave(slot.id,startHour,endHour,therapistId);setEditing(false);}
    catch(e){setErr(e.response?.data?.error||'שגיאה');}
    finally{setSaving(false);}
  };
  const handleCancel=()=>{setStartHour(slot.startHour);setEndHour(slot.endHour);setTherapistId(slot.therapistId);setErr('');setEditing(false);};
  return(
    <div className="px-4 py-3 border-b border-white/5 last:border-0">
      {editing?(
        <div className="space-y-2">
          <div className="flex flex-wrap gap-2 items-center">
            <select className="input-glass rounded-lg px-2 py-1.5 text-sm" value={startHour} onChange={e=>setStartHour(parseInt(e.target.value))}>
              {ALL_HOURS.slice(0,-1).map(h=><option key={h} value={h}>{hLabel(h)}</option>)}
            </select>
            <span className="text-white/30 text-sm">–</span>
            <select className="input-glass rounded-lg px-2 py-1.5 text-sm" value={endHour} onChange={e=>setEndHour(parseInt(e.target.value))}>
              {ALL_HOURS.filter(h=>h>startHour).map(h=><option key={h} value={h}>{hLabel(h)}</option>)}
            </select>
            <select className="input-glass rounded-lg px-2 py-1.5 text-sm" value={therapistId} onChange={e=>setTherapistId(parseInt(e.target.value))}>
              {therapists.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
            <button onClick={handleSave} disabled={saving} className="text-green-400 hover:text-green-300 p-1"><Check size={18}/></button>
            <button onClick={handleCancel} className="text-white/30 hover:text-white/60 p-1"><X size={18}/></button>
          </div>
          {err&&<p className="text-red-400 text-xs">{err}</p>}
        </div>
      ):(
        <div className="flex items-center justify-between">
          <div>
            <span className="font-medium text-white/80">{slot.therapist.name}</span>
            <span className="text-sm text-white/30 mr-3">{slot.room.name} · {hLabel(slot.startHour)}–{hLabel(slot.endHour)}</span>
          </div>
          <div className="flex items-center gap-1">
            <button onClick={()=>setEditing(true)} className="text-white/20 hover:text-green-400 transition-colors p-1"><Pencil size={14}/></button>
            <button onClick={()=>onDelete(slot.id)} className="text-white/20 hover:text-red-400 transition-colors p-1"><Trash2 size={14}/></button>
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

  const handleLogin=async()=>{
    try{await verifyAdmin(password);sessionStorage.setItem('adminPass',password);setAdminPassword(password);setAuthed(true);}
    catch{setAuthError('סיסמה שגויה');}
  };

  const handleAddRoom=async()=>{if(!newRoom.trim())return;try{await addRoom(newRoom.trim());setNewRoom('');setError('');setRooms(await getRooms());}catch(e){setError(e.response?.data?.error||'שגיאה');}};
  const handleRenameRoom=async(id,name)=>{try{await updateRoom(id,name);setRooms(p=>p.map(r=>r.id===id?{...r,name}:r));}catch(e){setError(e.response?.data?.error||'שגיאה');throw e;}};
  const handleDeleteRoom=async(id)=>{if(!confirm('למחוק את החדר?'))return;try{await deleteRoom(id);setRooms(rooms.filter(r=>r.id!==id));}catch(e){setError(e.response?.data?.error||'שגיאה');}};
  const handleAddTherapist=async()=>{if(!newTherapist.trim())return;try{await addTherapist(newTherapist.trim());setNewTherapist('');setError('');setTherapists(await getTherapists());}catch(e){setError(e.response?.data?.error||'שגיאה');}};
  const handleRenameTherapist=async(id,name)=>{try{await updateTherapist(id,name);setTherapists(p=>p.map(t=>t.id===id?{...t,name}:t));}catch(e){setError(e.response?.data?.error||'שגיאה');throw e;}};
  const handleDeleteTherapist=async(id)=>{if(!confirm('למחוק את המטפל?'))return;try{await deleteTherapist(id);setTherapists(therapists.filter(t=>t.id!==id));}catch(e){setError(e.response?.data?.error||'שגיאה');}};
  const handleUpdateSlot=async(id,sh,eh,tid)=>{const updated=await updateSlot(id,sh,eh,tid);setSlots(prev=>prev.map(s=>s.id===id?{...s,...updated}:s));};
  const handleClearSlot=async(id)=>{if(!confirm('למחוק את השיבוץ?'))return;try{await clearSlot(id);setSlots(slots.filter(s=>s.id!==id));}catch(e){setError(e.response?.data?.error||'שגיאה');}};

  const slotsByDate={};
  slots.forEach(s=>{const k=toDateStr(new Date(s.date));if(!slotsByDate[k])slotsByDate[k]=[];slotsByDate[k].push(s);});
  const sortedDates=Object.keys(slotsByDate).sort();

  if(!authed) return(
    <div className="max-w-sm mx-auto mt-16 px-4 fade-in">
      <div className="glass-strong rounded-2xl p-8">
        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-green-400 to-green-600 flex items-center justify-center mx-auto mb-5 shadow-lg shadow-green-900/50">
          <span className="text-white font-bold text-xl">מ</span>
        </div>
        <h2 className="text-xl font-bold text-white mb-6 text-center">כניסת מנהל</h2>
        <input type="password" placeholder="סיסמה"
          className="input-glass w-full rounded-xl px-4 py-3 mb-3 text-base"
          value={password} onChange={e=>setPassword(e.target.value)}
          onKeyDown={e=>e.key==='Enter'&&handleLogin()}/>
        {authError&&<p className="text-red-400 text-sm mb-3">{authError}</p>}
        <button onClick={handleLogin} className="btn-green w-full font-medium py-3 rounded-xl flex items-center justify-center gap-2">
          <LogIn size={18}/> כניסה
        </button>
      </div>
    </div>
  );

  const tabs=[{id:'rooms',label:'חדרים'},{id:'therapists',label:'מטפלים'},{id:'schedule',label:'שיבוצים'}];

  return(
    <div className="fade-in">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold text-white">פאנל מנהל</h1>
        <button onClick={()=>{sessionStorage.removeItem('adminPass');setAuthed(false);}}
          className="text-sm text-white/30 hover:text-white/60 px-3 py-1.5 rounded-xl glass transition-colors">יציאה</button>
      </div>

      <div className="flex gap-1 mb-6 glass rounded-xl p-1 w-fit">
        {tabs.map(t=>(
          <button key={t.id} onClick={()=>{setTab(t.id);setError('');}}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-all whitespace-nowrap ${
              tab===t.id?'bg-green-600/40 text-green-300 shadow-sm':'text-white/40 hover:text-white/70'
            }`}>{t.label}</button>
        ))}
      </div>

      {error&&<div className="bg-red-900/30 border border-red-500/20 text-red-300 rounded-xl p-3 mb-4 text-sm">{error}</div>}

      {tab==='rooms'&&(
        <div className="space-y-4">
          <div className="flex gap-2">
            <input type="text" placeholder="שם חדר חדש" className="input-glass flex-1 rounded-xl px-4 py-2.5 text-base"
              value={newRoom} onChange={e=>setNewRoom(e.target.value)} onKeyDown={e=>e.key==='Enter'&&handleAddRoom()}/>
            <button onClick={handleAddRoom} className="btn-green px-4 py-2.5 rounded-xl flex items-center gap-1 whitespace-nowrap">
              <Plus size={16}/> הוסף
            </button>
          </div>
          <div className="glass rounded-2xl overflow-hidden">
            {rooms.length===0&&<p className="text-white/30 text-sm text-center py-6">אין חדרים</p>}
            {rooms.map(room=><EditableRow key={room.id} item={room} onRename={handleRenameRoom} onDelete={handleDeleteRoom} placeholder="שם חדר"/>)}
          </div>
        </div>
      )}

      {tab==='therapists'&&(
        <div className="space-y-4">
          <div className="flex gap-2">
            <input type="text" placeholder="שם מטפל חדש" className="input-glass flex-1 rounded-xl px-4 py-2.5 text-base"
              value={newTherapist} onChange={e=>setNewTherapist(e.target.value)} onKeyDown={e=>e.key==='Enter'&&handleAddTherapist()}/>
            <button onClick={handleAddTherapist} className="btn-green px-4 py-2.5 rounded-xl flex items-center gap-1 whitespace-nowrap">
              <Plus size={16}/> הוסף
            </button>
          </div>
          <div className="glass rounded-2xl overflow-hidden">
            {therapists.length===0&&<p className="text-white/30 text-sm text-center py-6">אין מטפלים</p>}
            {therapists.map(t=><EditableRow key={t.id} item={t} onRename={handleRenameTherapist} onDelete={handleDeleteTherapist} placeholder="שם מטפל"/>)}
          </div>
        </div>
      )}

      {tab==='schedule'&&(
        <div className="space-y-4">
          {sortedDates.length===0&&<p className="text-white/30 text-sm text-center py-10">אין שיבוצים</p>}
          {sortedDates.map(dateStr=>(
            <div key={dateStr} className="glass rounded-2xl overflow-hidden">
              <div className="px-4 py-2.5 border-b border-white/5 bg-green-900/20">
                <span className="font-semibold text-green-300 text-sm">{formatDateHe(dateStr)}</span>
              </div>
              {slotsByDate[dateStr].sort((a,b)=>a.startHour-b.startHour).map(s=>(
                <SlotRow key={s.id} slot={s} therapists={therapists} onSave={handleUpdateSlot} onDelete={handleClearSlot}/>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
