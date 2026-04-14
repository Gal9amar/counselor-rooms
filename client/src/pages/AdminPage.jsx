import React, { useEffect, useState } from 'react';
import {
  verifyAdmin, setAdminPassword,
  getRooms, addRoom, updateRoom, deleteRoom, reorderRooms,
  getTherapists, addTherapist, updateTherapist, deleteTherapist,
  getSchedule, updateSlot, clearSlot, updateRecurring, deleteRecurring,
  getRoomNotes, addRoomNote, deleteRoomNote,
} from '../services/api';
import { Trash2, Plus, LogIn, Pencil, Check, X, RefreshCw, CalendarDays, GripVertical, MessageSquarePlus, AlertTriangle } from 'lucide-react';

const DAYS_HE=['ראשון','שני','שלישי','רביעי','חמישי','שישי','שבת'];
const DAYS_SHORT=['א','ב','ג','ד','ה','ו','ש'];
const MONTHS_HE=['ינואר','פברואר','מרץ','אפריל','מאי','יוני','יולי','אוגוסט','ספטמבר','אוקטובר','נובמבר','דצמבר'];
const ALL_HOURS=[8,9,10,11,12,13,14,15,16,17,18,19,20,21,22];
const FREQ_HE={daily:'יומי',weekly:'שבועי',monthly:'חודשי',yearly:'שנתי'};

function toDateStr(d){return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;}
function formatDateHe(ds){const d=new Date(ds+'T00:00:00');return `${DAYS_HE[d.getDay()]} ${d.getDate()} ${MONTHS_HE[d.getMonth()]} ${d.getFullYear()}`;}
function hLabel(h){return `${h}:00`;}

function EditableRow({item,onRename,onDelete,placeholder,dragHandleProps}){
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
      {dragHandleProps&&(
        <span {...dragHandleProps} className="text-gray-300 hover:text-gray-500 cursor-grab active:cursor-grabbing touch-none">
          <GripVertical size={16}/>
        </span>
      )}
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
          <button onClick={()=>setEditing(true)} className="flex items-center gap-1 text-xs font-medium text-green-600 hover:bg-green-50 border border-green-200 rounded-lg px-2.5 py-1.5 transition-colors"><Pencil size={13}/> עריכה</button>
          <button onClick={()=>onDelete(item.id)} className="flex items-center gap-1 text-xs font-medium text-red-500 hover:bg-red-50 border border-red-200 rounded-lg px-2.5 py-1.5 transition-colors"><Trash2 size={13}/> מחיקה</button>
        </>
      )}
    </div>
  );
}

function SlotRow({slot}){
  return(
    <div className="px-4 py-2.5 border-b border-gray-100 last:border-0">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="font-medium text-gray-700">{slot.therapist.name}</span>
        <span className="text-sm text-gray-400">{hLabel(slot.startHour)}–{hLabel(slot.endHour)}</span>
      </div>
      {slot.note && (
        <p className="text-xs text-amber-600 bg-amber-50 rounded-lg px-2 py-1 mt-1 flex items-start gap-1">
          <span className="shrink-0">📝</span>{slot.note}
        </p>
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
  const _now=new Date();
  const [filterYear,setFilterYear]=useState(_now.getFullYear());
  const [filterMonths,setFilterMonths]=useState([_now.getMonth()]);
  const [filterTherapistId,setFilterTherapistId]=useState(null);
  const [newRoom,setNewRoom]=useState('');
  const [newTherapist,setNewTherapist]=useState('');
  const [error,setError]=useState('');
  const [roomNotes,setRoomNotes]=useState([]);
  const [noteModal,setNoteModal]=useState(null); // roomId | null
  const [noteForm,setNoteForm]=useState({message:'',startDate:'',endDate:'',startHour:'',endHour:'',blocksBooking:false});
  const [noteSaving,setNoteSaving]=useState(false);
  const [noteError,setNoteError]=useState('');

  useEffect(()=>{if(authed){setAdminPassword(sessionStorage.getItem('adminPass'));loadAll(filterYear,filterMonths);getRoomNotes().then(setRoomNotes).catch(()=>{});}},[authed]);

  const loadAll=async(year,months)=>{
    const y=year??filterYear;
    const ms=months??filterMonths;
    const sorted=[...ms].sort((a,b)=>a-b);
    const firstM=sorted[0];
    const lastM=sorted[sorted.length-1];
    const from=`${y}-${String(firstM+1).padStart(2,'0')}-01`;
    const lastDay=new Date(y,lastM+1,0).getDate();
    const to=`${y}-${String(lastM+1).padStart(2,'0')}-${String(lastDay).padStart(2,'0')}`;
    const [r,t,s]=await Promise.all([getRooms(),getTherapists(),getSchedule({from,to})]);
    // Filter slots to only selected months
    const filtered=s.filter(sl=>ms.includes(new Date(sl.date).getMonth()));
    setRooms(r);setTherapists(t);setSlots(filtered);
  };

  const handleLogin=async()=>{try{await verifyAdmin(password);sessionStorage.setItem('adminPass',password);setAdminPassword(password);setAuthed(true);}catch{setAuthError('סיסמה שגויה');}};
  const addR=async()=>{if(!newRoom.trim())return;try{await addRoom(newRoom.trim());setNewRoom('');setError('');setRooms(await getRooms());}catch(e){setError(e.response?.data?.error||'שגיאה');}};

  const saveNote=async()=>{
    const {message,startDate,endDate,startHour,endHour,blocksBooking}=noteForm;
    if(!message.trim()||!startDate||!endDate){setNoteError('יש למלא הודעה, תאריך התחלה וסיום');return;}
    const sh=startHour!==''?parseInt(startHour):null;
    const eh=endHour!==''?parseInt(endHour):null;
    if(sh!=null&&eh!=null&&eh<=sh){setNoteError('שעת סיום אחרי שעת התחלה');return;}
    setNoteSaving(true);setNoteError('');
    try{
      const n=await addRoomNote({roomId:noteModal,message:message.trim(),startDate,endDate,startHour:sh,endHour:eh,blocksBooking});
      setRoomNotes(p=>[...p,n]);
      setNoteModal(null);
    }catch(e){setNoteError(e.response?.data?.error||'שגיאה');}
    finally{setNoteSaving(false);}
  };
  const removeNote=async(id)=>{
    try{await deleteRoomNote(id);setRoomNotes(p=>p.filter(n=>n.id!==id));}
    catch(e){setError(e.response?.data?.error||'שגיאה');}
  };

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
    const slotRes=await getSchedule({from:'2020-01-01',to:'2030-12-31'}).catch(()=>[]);
    const cnt=Array.isArray(slotRes)?slotRes.filter(s=>s.therapistId===id).length:0;
    const msg=cnt>0
      ?`למטפל "${t?.name}" יש ${cnt} שיבוצים.\nמחיקתו תמחק גם את כל השיבוצים שלו.\nלהמשיך?`
      :`למחוק את "${t?.name}"?`;
    if(!confirm(msg))return;
    try{await deleteTherapist(id);setTherapists(therapists.filter(t=>t.id!==id));setSlots(slots.filter(s=>s.therapistId!==id));}
    catch(e){setError(e.response?.data?.error||'שגיאה');}
  };
  const saveSlot=async(id,sh,eh,tid,nt,rid,dt)=>{const u=await updateSlot(id,sh,eh,tid,nt,rid,dt);setSlots(p=>p.map(s=>s.id===id?{...s,...u}:s));};

  const openEditRecurring=(rid,seriesSlots)=>{
    const first=seriesSlots[0];
    const sorted=[...seriesSlots].sort((a,b)=>new Date(a.date)-new Date(b.date));
    const startDate=first.recurring?.startDate
      ?toDateStr(new Date(first.recurring.startDate))
      :toDateStr(new Date(sorted[0].date));
    setEditRecurring({rid:parseInt(rid),roomId:first.roomId,therapistId:first.therapistId,startHour:first.startHour,endHour:first.endHour,note:first.note||'',startDate});
    setEditRecurringErr('');
  };
  const saveRecurring=async()=>{
    const {rid,roomId,therapistId,startHour,endHour,note,startDate}=editRecurring;
    if(endHour<=startHour){setEditRecurringErr('סיום אחרי התחלה');return;}
    setEditRecurringSaving(true);setEditRecurringErr('');
    try{
      const updated=await updateRecurring(rid,{roomId,therapistId,startHour,endHour,note:note||null,startDate});
      setSlots(p=>{
        const updatedIds=new Set(updated.map(u=>u.id));
        const oldRecurring=p.filter(s=>s.recurringId===rid);
        const keptOther=p.filter(s=>s.recurringId!==rid);
        // replace entire series with updated (handles date regeneration)
        return [...keptOther,...updated];
      });
      setEditRecurring(null);
    }catch(e){
      const data=e.response?.data?.error;
      try{const parsed=JSON.parse(data);if(parsed.conflicts)setEditRecurringErr(`התנגשות ב-${parsed.conflicts.length} תאריכים`);}
      catch{setEditRecurringErr(data||'שגיאה');}
    }finally{setEditRecurringSaving(false);}
  };

  const handleDeleteRecurring=async(rid)=>{
    if(!confirm('למחוק את כל השיבוצים בסדרה זו?'))return;
    try{
      await deleteRecurring(parseInt(rid));
      setSlots(p=>p.filter(s=>s.recurringId!==parseInt(rid)));
    }catch(e){setError(e.response?.data?.error||'שגיאה');}
  };

  const [dragRoomId,setDragRoomId]=useState(null);
  const [dragOverRoomId,setDragOverRoomId]=useState(null);

  const handleRoomDragEnd=async()=>{
    if(dragRoomId==null||dragOverRoomId==null||dragRoomId===dragOverRoomId){
      setDragRoomId(null);setDragOverRoomId(null);return;
    }
    const from=rooms.findIndex(r=>r.id===dragRoomId);
    const to=rooms.findIndex(r=>r.id===dragOverRoomId);
    const reordered=[...rooms];
    const [moved]=reordered.splice(from,1);
    reordered.splice(to,0,moved);
    setRooms(reordered);
    setDragRoomId(null);setDragOverRoomId(null);
    try{await reorderRooms(reordered.map(r=>r.id));}
    catch{setRooms(rooms);}
  };

  const [deleteModal,setDeleteModal]=useState(null);
  const [editRecurring,setEditRecurring]=useState(null);
  const [editRecurringErr,setEditRecurringErr]=useState('');
  const [editRecurringSaving,setEditRecurringSaving]=useState(false);
  const [editSlot,setEditSlot]=useState(null); // {id,roomId,date,startHour,endHour,therapistId,note}
  const [editSlotErr,setEditSlotErr]=useState('');
  const [editSlotSaving,setEditSlotSaving]=useState(false);

  const openEditSlot=(slot)=>{
    setEditSlot({id:slot.id,roomId:slot.roomId,date:toDateStr(new Date(slot.date)),startHour:slot.startHour,endHour:slot.endHour,therapistId:slot.therapistId,note:slot.note||''});
    setEditSlotErr('');
  };
  const saveEditSlot=async()=>{
    const {id,roomId,date,startHour,endHour,therapistId,note}=editSlot;
    if(endHour<=startHour){setEditSlotErr('סיום אחרי התחלה');return;}
    setEditSlotSaving(true);setEditSlotErr('');
    try{
      const updated=await updateSlot(id,startHour,endHour,therapistId,note||null,roomId,date);
      setSlots(p=>p.map(s=>s.id===id?{...s,...updated}:s));
      setEditSlot(null);
    }catch(e){setEditSlotErr(e.response?.data?.error||'שגיאה');}
    finally{setEditSlotSaving(false);}
  };

  const [deleteSingleModal,setDeleteSingleModal]=useState(null);

  const delSlot=async(slot)=>{
    if(slot.recurringId){setDeleteModal(slot);return;}
    setDeleteSingleModal(slot);
  };
  const confirmDeleteSingle=async()=>{
    const slot=deleteSingleModal;setDeleteSingleModal(null);
    try{await clearSlot(slot.id,'single');setSlots(p=>p.filter(s=>s.id!==slot.id));}
    catch(e){setError(e.response?.data?.error||'שגיאה');}
  };

  const confirmDelete=async(scope)=>{
    const slot=deleteModal;setDeleteModal(null);
    try{
      await clearSlot(slot.id,scope);
      if(scope==='all'){setSlots(p=>p.filter(s=>s.recurringId!==slot.recurringId));}
      else{setSlots(p=>p.filter(s=>s.id!==slot.id));}
    }catch(e){setError(e.response?.data?.error||'שגיאה');}
  };

  // Apply therapist filter
  const visibleSlots=filterTherapistId?slots.filter(s=>s.therapistId===filterTherapistId):slots;

  // Separate recurring series from one-time slots
  const recurringMap={};
  const oneTimeSlots=[];
  visibleSlots.forEach(s=>{
    if(s.recurringId){
      if(!recurringMap[s.recurringId])recurringMap[s.recurringId]=[];
      recurringMap[s.recurringId].push(s);
    } else {
      oneTimeSlots.push(s);
    }
  });
  // Group one-time slots by room then date
  const slotsByRoom={};
  oneTimeSlots.forEach(s=>{
    const rId=s.roomId;
    if(!slotsByRoom[rId])slotsByRoom[rId]={};
    const ds=toDateStr(new Date(s.date));
    if(!slotsByRoom[rId][ds])slotsByRoom[rId][ds]=[];
    slotsByRoom[rId][ds].push(s);
  });
  // Group recurring series by room
  const recurringByRoom={};
  Object.entries(recurringMap).forEach(([rid,series])=>{
    const rId=series[0]?.roomId;
    if(!rId)return;
    if(!recurringByRoom[rId])recurringByRoom[rId]=[];
    recurringByRoom[rId].push({rid,series});
  });
  // Sort rooms numerically by name (include rooms with only recurring)
  const allRoomIds=[...new Set([...Object.keys(slotsByRoom),...Object.keys(recurringByRoom)])];
  const sortedRoomIds=allRoomIds.sort((a,b)=>{
    const ra=rooms.find(r=>r.id===parseInt(a));
    const rb=rooms.find(r=>r.id===parseInt(b));
    const na=parseInt((ra?.name||'').replace(/[^0-9]/g,''))||0;
    const nb=parseInt((rb?.name||'').replace(/[^0-9]/g,''))||0;
    return na-nb;
  });

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

  const tabs=[
    {id:'rooms',label:'חדרים',count:rooms.length},
    {id:'therapists',label:'מטפלים',count:therapists.length},
    {id:'schedule',label:'שיבוצים',count:slots.length},
  ];

  return(
    <>
      {editRecurring&&(
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={()=>setEditRecurring(null)}>
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6" onClick={e=>e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-gray-800 flex items-center gap-2"><RefreshCw size={16} className="text-blue-500"/> עריכת סדרה חוזרת</h3>
              <button onClick={()=>setEditRecurring(null)} className="text-gray-300 hover:text-gray-500"><X size={18}/></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">תאריך התחלה</label>
                <input type="date" dir="ltr" className="input py-2 text-sm" value={editRecurring.startDate}
                  onChange={e=>setEditRecurring(p=>({...p,startDate:e.target.value}))}/>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">חדר</label>
                <select className="input py-2 text-sm" value={editRecurring.roomId} onChange={e=>setEditRecurring(p=>({...p,roomId:parseInt(e.target.value)}))}>
                  {rooms.map(r=><option key={r.id} value={r.id}>{r.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">מטפל</label>
                <select className="input py-2 text-sm" value={editRecurring.therapistId} onChange={e=>setEditRecurring(p=>({...p,therapistId:parseInt(e.target.value)}))}>
                  {therapists.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>
              <div className="flex gap-2">
                <div className="flex-1">
                  <label className="block text-xs font-medium text-gray-500 mb-1">שעת התחלה</label>
                  <select className="input py-2 text-sm" value={editRecurring.startHour} onChange={e=>setEditRecurring(p=>({...p,startHour:parseInt(e.target.value)}))}>
                    {ALL_HOURS.slice(0,-1).map(h=><option key={h} value={h}>{hLabel(h)}</option>)}
                  </select>
                </div>
                <div className="flex-1">
                  <label className="block text-xs font-medium text-gray-500 mb-1">שעת סיום</label>
                  <select className="input py-2 text-sm" value={editRecurring.endHour} onChange={e=>setEditRecurring(p=>({...p,endHour:parseInt(e.target.value)}))}>
                    {ALL_HOURS.filter(h=>h>editRecurring.startHour).map(h=><option key={h} value={h}>{hLabel(h)}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">הערה</label>
                <input className="input py-2 text-sm" placeholder="הערה (לא חובה)" value={editRecurring.note}
                  onChange={e=>setEditRecurring(p=>({...p,note:e.target.value}))} maxLength={200}/>
              </div>
              {editRecurringErr&&<p className="text-red-500 text-xs">{editRecurringErr}</p>}
              <div className="flex gap-2 pt-1">
                <button onClick={saveRecurring} disabled={editRecurringSaving} className="btn-primary flex-1 py-2.5 text-sm">
                  {editRecurringSaving?'שומר...':'שמור שינויים'}
                </button>
                <button onClick={()=>setEditRecurring(null)} className="btn-secondary px-4 py-2.5 text-sm">ביטול</button>
              </div>
            </div>
          </div>
        </div>
      )}
      {editSlot&&(
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={()=>setEditSlot(null)}>
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6" onClick={e=>e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-gray-800 flex items-center gap-2"><Pencil size={16} className="text-green-500"/> עריכת שיבוץ</h3>
              <button onClick={()=>setEditSlot(null)} className="text-gray-300 hover:text-gray-500"><X size={18}/></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">תאריך</label>
                <input type="date" dir="ltr" className="input py-2 text-sm" value={editSlot.date}
                  onChange={e=>setEditSlot(p=>({...p,date:e.target.value}))}/>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">חדר</label>
                <select className="input py-2 text-sm" value={editSlot.roomId} onChange={e=>setEditSlot(p=>({...p,roomId:parseInt(e.target.value)}))}>
                  {rooms.map(r=><option key={r.id} value={r.id}>{r.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">מטפל</label>
                <select className="input py-2 text-sm" value={editSlot.therapistId} onChange={e=>setEditSlot(p=>({...p,therapistId:parseInt(e.target.value)}))}>
                  {therapists.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>
              <div className="flex gap-2">
                <div className="flex-1">
                  <label className="block text-xs font-medium text-gray-500 mb-1">שעת התחלה</label>
                  <select className="input py-2 text-sm" value={editSlot.startHour} onChange={e=>setEditSlot(p=>({...p,startHour:parseInt(e.target.value)}))}>
                    {ALL_HOURS.slice(0,-1).map(h=><option key={h} value={h}>{hLabel(h)}</option>)}
                  </select>
                </div>
                <div className="flex-1">
                  <label className="block text-xs font-medium text-gray-500 mb-1">שעת סיום</label>
                  <select className="input py-2 text-sm" value={editSlot.endHour} onChange={e=>setEditSlot(p=>({...p,endHour:parseInt(e.target.value)}))}>
                    {ALL_HOURS.filter(h=>h>editSlot.startHour).map(h=><option key={h} value={h}>{hLabel(h)}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">הערה</label>
                <input className="input py-2 text-sm" placeholder="הערה (לא חובה)" value={editSlot.note}
                  onChange={e=>setEditSlot(p=>({...p,note:e.target.value}))} maxLength={200}/>
              </div>
              {editSlotErr&&<p className="text-red-500 text-xs">{editSlotErr}</p>}
              <div className="flex gap-2 pt-1">
                <button onClick={saveEditSlot} disabled={editSlotSaving} className="btn-primary flex-1 py-2.5 text-sm">
                  {editSlotSaving?'שומר...':'שמור שינויים'}
                </button>
                <button onClick={()=>setEditSlot(null)} className="btn-secondary px-4 py-2.5 text-sm">ביטול</button>
              </div>
            </div>
          </div>
        </div>
      )}
      {deleteModal&&(
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={()=>setDeleteModal(null)}>
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6" onClick={e=>e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center"><Trash2 size={18} className="text-red-500"/></div>
              <h3 className="font-bold text-gray-800">מחיקת שיבוץ חוזר</h3>
            </div>
            <p className="text-sm text-gray-600 mb-4">שיבוץ זה הוא חלק מסדרה חוזרת. מה ברצונך למחוק?</p>
            <div className="space-y-2">
              <button onClick={()=>confirmDelete('single')} className="w-full text-right px-4 py-3 bg-gray-50 hover:bg-gray-100 rounded-xl text-sm font-medium text-gray-700 transition-colors">מחק רק שיבוץ זה</button>
              <button onClick={()=>confirmDelete('all')} className="w-full text-right px-4 py-3 bg-red-50 hover:bg-red-100 rounded-xl text-sm font-medium text-red-600 transition-colors">מחק את כל הסדרה ({slots.filter(s=>s.recurringId===deleteModal.recurringId).length} שיבוצים)</button>
              <button onClick={()=>setDeleteModal(null)} className="w-full text-right px-4 py-3 text-sm text-gray-400 hover:text-gray-600 transition-colors">ביטול</button>
            </div>
          </div>
        </div>
      )}
      {deleteSingleModal&&(
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={()=>setDeleteSingleModal(null)}>
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6" onClick={e=>e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center"><Trash2 size={18} className="text-red-500"/></div>
              <h3 className="font-bold text-gray-800">מחיקת שיבוץ</h3>
            </div>
            <p className="text-sm text-gray-600 mb-1">
              <span className="font-medium">{deleteSingleModal.therapist?.name}</span>
              {' · '}{hLabel(deleteSingleModal.startHour)}–{hLabel(deleteSingleModal.endHour)}
            </p>
            <p className="text-sm text-gray-400 mb-5">{formatDateHe(toDateStr(new Date(deleteSingleModal.date)))}</p>
            <div className="flex gap-2">
              <button onClick={confirmDeleteSingle} className="flex-1 bg-red-500 hover:bg-red-600 text-white font-medium py-2.5 rounded-xl text-sm transition-colors">מחק</button>
              <button onClick={()=>setDeleteSingleModal(null)} className="btn-secondary px-4 py-2.5 text-sm">ביטול</button>
            </div>
          </div>
        </div>
      )}
      {noteModal&&(
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={()=>setNoteModal(null)}>
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6" onClick={e=>e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-gray-800 flex items-center gap-2">
                <AlertTriangle size={16} className="text-amber-500"/> הוספת הערה לחדר
              </h3>
              <button onClick={()=>setNoteModal(null)} className="text-gray-300 hover:text-gray-500"><X size={18}/></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">הודעה</label>
                <input className="input py-2 text-sm" placeholder='למשל: "בתיקון עד יום ה׳"'
                  value={noteForm.message} onChange={e=>setNoteForm(p=>({...p,message:e.target.value}))} maxLength={200}/>
              </div>
              <div className="flex gap-2">
                <div className="flex-1">
                  <label className="block text-xs font-medium text-gray-500 mb-1">מתאריך</label>
                  <input type="date" dir="ltr" className="input py-2 text-sm"
                    value={noteForm.startDate} onChange={e=>setNoteForm(p=>({...p,startDate:e.target.value}))}/>
                </div>
                <div className="flex-1">
                  <label className="block text-xs font-medium text-gray-500 mb-1">עד תאריך</label>
                  <input type="date" dir="ltr" className="input py-2 text-sm"
                    value={noteForm.endDate} onChange={e=>setNoteForm(p=>({...p,endDate:e.target.value}))}/>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">שעות (אופציונלי)</label>
                <div className="flex items-center gap-2">
                  <select className="input py-2 text-sm flex-1" value={noteForm.startHour}
                    onChange={e=>setNoteForm(p=>({...p,startHour:e.target.value}))}>
                    <option value="">כל היום</option>
                    {ALL_HOURS.slice(0,-1).map(h=><option key={h} value={h}>{h}:00</option>)}
                  </select>
                  <span className="text-gray-400 text-sm shrink-0">עד</span>
                  <select className="input py-2 text-sm flex-1" value={noteForm.endHour}
                    onChange={e=>setNoteForm(p=>({...p,endHour:e.target.value}))}>
                    <option value="">כל היום</option>
                    {ALL_HOURS.filter(h=>noteForm.startHour===''||h>parseInt(noteForm.startHour)).map(h=><option key={h} value={h}>{h}:00</option>)}
                  </select>
                </div>
              </div>
              <button
                onClick={()=>setNoteForm(p=>({...p,blocksBooking:!p.blocksBooking}))}
                className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border transition-colors ${
                  noteForm.blocksBooking
                    ?'bg-red-50 border-red-200 text-red-700'
                    :'bg-gray-50 border-gray-200 text-gray-600'
                }`}>
                <span className="text-sm font-medium">חסום שיבוצים בזמן ההערה</span>
                <div dir="ltr" className={`w-10 h-6 rounded-full transition-colors flex items-center px-1 ${noteForm.blocksBooking?'bg-red-500':'bg-gray-300'}`}>
                  <div className={`w-4 h-4 bg-white rounded-full shadow transition-transform duration-200 ${noteForm.blocksBooking?'translate-x-4':'translate-x-0'}`}/>
                </div>
              </button>
              {noteError&&<p className="text-red-500 text-xs">{noteError}</p>}
              <div className="flex gap-2 pt-1">
                <button onClick={saveNote} disabled={noteSaving} className="btn-primary flex-1 py-2.5 text-sm">
                  {noteSaving?'שומר...':'הוסף הערה'}
                </button>
                <button onClick={()=>setNoteModal(null)} className="btn-secondary px-4 py-2.5 text-sm">ביטול</button>
              </div>
            </div>
          </div>
        </div>
      )}
      <div className="fade-up">
      <div className="flex items-center justify-between mb-8">
        <h1 className="section-title">פאנל מנהל</h1>
        <button onClick={()=>{sessionStorage.removeItem('adminPass');setAuthed(false);}} className="btn-ghost text-sm px-3 py-1.5">יציאה</button>
      </div>

      <div className="flex gap-1 mb-6 bg-gray-100 rounded-xl p-1 w-fit">
        {tabs.map(t=>(
          <button key={t.id} onClick={()=>{setTab(t.id);setError('');}}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-all whitespace-nowrap flex items-center gap-1.5 ${tab===t.id?'bg-white shadow-sm text-gray-800':'text-gray-400 hover:text-gray-600'}`}>
            {t.label}
            {t.count>0&&<span className={`text-xs rounded-full px-1.5 py-0.5 font-semibold ${tab===t.id?'bg-green-100 text-green-700':'bg-gray-200 text-gray-500'}`}>{t.count}</span>}
          </button>
        ))}
      </div>

      {error&&<div className="bg-red-50 border border-red-200 text-red-600 rounded-xl p-3 mb-4 text-sm">{error}</div>}

      {/* Schedule filters — only shown on schedule tab */}
      {tab==='schedule'&&(
        <div className="mb-5 space-y-3">
          {/* Year selector */}
          <div className="flex bg-gray-100 rounded-xl p-1 gap-0.5 w-fit">
            {[filterYear-1,filterYear,filterYear+1].map(y=>(
              <button key={y}
                onClick={()=>{setFilterYear(y);loadAll(y,filterMonths);}}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                  filterYear===y?'bg-white shadow-sm text-gray-800':'text-gray-400 hover:text-gray-600'
                }`}>{y}</button>
            ))}
          </div>
          {/* Month pills multi-select */}
          <div className="flex flex-wrap gap-1.5">
            {MONTHS_HE.map((name,i)=>{
              const selected=filterMonths.includes(i);
              return(
                <button key={i}
                  onClick={()=>{
                    const next=selected
                      ?filterMonths.filter(m=>m!==i)
                      :[...filterMonths,i];
                    if(next.length===0)return; // at least one month
                    setFilterMonths(next);
                    loadAll(filterYear,next);
                  }}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all border ${
                    selected
                      ?'bg-green-500 text-white border-green-500 shadow-sm'
                      :'bg-white text-gray-500 border-gray-200 hover:border-green-300 hover:text-green-700'
                  }`}>{name}</button>
              );
            })}
          </div>
          {/* Therapist filter */}
          <div className="flex flex-wrap gap-1.5">
            <button
              onClick={()=>setFilterTherapistId(null)}
              className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all border ${
                filterTherapistId===null
                  ?'bg-gray-700 text-white border-gray-700 shadow-sm'
                  :'bg-white text-gray-500 border-gray-200 hover:border-gray-400 hover:text-gray-700'
              }`}>הכל</button>
            {therapists.map(t=>(
              <button key={t.id}
                onClick={()=>setFilterTherapistId(p=>p===t.id?null:t.id)}
                className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all border ${
                  filterTherapistId===t.id
                    ?'bg-gray-700 text-white border-gray-700 shadow-sm'
                    :'bg-white text-gray-500 border-gray-200 hover:border-gray-400 hover:text-gray-700'
                }`}>{t.name}</button>
            ))}
          </div>
          <span className="text-xs text-gray-400">
            {filterTherapistId
              ? slots.filter(s=>s.therapistId===filterTherapistId).length
              : slots.length} שיבוצים
          </span>
        </div>
      )}

      {tab==='rooms'&&(
        <div className="space-y-4">
          <div className="flex gap-2">
            <input type="text" placeholder="שם חדר חדש" className="input" value={newRoom}
              onChange={e=>setNewRoom(e.target.value)} onKeyDown={e=>e.key==='Enter'&&addR()}/>
            <button onClick={addR} className="btn-primary px-4 py-2.5 flex items-center gap-1 whitespace-nowrap"><Plus size={16}/> הוסף</button>
          </div>
          <div className="card rounded-2xl overflow-hidden">
            {rooms.length===0&&<p className="text-gray-400 text-sm text-center py-6">אין חדרים</p>}
            {rooms.map(r=>{
              const rNotes=roomNotes.filter(n=>n.roomId===r.id);
              return(
              <div key={r.id}
                draggable
                onDragStart={()=>setDragRoomId(r.id)}
                onDragOver={e=>{e.preventDefault();setDragOverRoomId(r.id);}}
                onDragEnd={handleRoomDragEnd}
                className={`transition-colors ${dragOverRoomId===r.id&&dragRoomId!==r.id?'bg-green-50':''} ${dragRoomId===r.id?'opacity-50':''}`}>
                <div className="flex items-center gap-2 border-b border-gray-100">
                  <div className="flex-1 min-w-0">
                    <EditableRow item={r} onRename={renR} onDelete={delR} placeholder="שם חדר"
                      dragHandleProps={{draggable:false,onMouseDown:e=>e.stopPropagation()}}/>
                  </div>
                  <button onClick={()=>{setNoteModal(r.id);setNoteForm({message:'',startDate:'',endDate:'',startHour:'',endHour:'',blocksBooking:false});setNoteError('');}}
                    className="flex items-center gap-1 text-xs font-medium text-amber-600 hover:bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-1.5 transition-colors ml-3 shrink-0">
                    <MessageSquarePlus size={13}/> הערה
                  </button>
                </div>
                {rNotes.length>0&&(
                  <div className="px-4 py-2 space-y-1.5 bg-amber-50 border-b border-amber-100">
                    {rNotes.map(n=>(
                      <div key={n.id} className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 mb-0.5">
                            <p className="text-xs font-medium text-amber-800">{n.message}</p>
                            {n.blocksBooking&&<span className="text-xs bg-red-100 text-red-600 font-semibold px-1.5 py-0.5 rounded-full">חוסם שיבוצים</span>}
                          </div>
                          <p className="text-xs text-amber-600">
                            {new Date(n.startDate).toLocaleDateString('he-IL')} – {new Date(n.endDate).toLocaleDateString('he-IL')}
                            {n.startHour!=null&&n.endHour!=null&&` · ${n.startHour}:00–${n.endHour}:00`}
                          </p>
                        </div>
                        <button onClick={()=>removeNote(n.id)} className="text-amber-400 hover:text-red-500 transition-colors shrink-0 p-0.5"><X size={14}/></button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              );
            })}
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
        <div className="space-y-6">

          {sortedRoomIds.length>0&&(
            <div>
              <h2 className="text-sm font-semibold text-gray-500 mb-3 flex items-center gap-1.5"><CalendarDays size={14}/> שיבוצים חד-פעמיים</h2>
              <div className="space-y-3">
                {sortedRoomIds.map(rId=>{
                  const room=rooms.find(r=>r.id===parseInt(rId));
                  const sortedDates=Object.keys(slotsByRoom[rId]||{}).sort();
                  return(
                  <div key={rId} className="card rounded-2xl overflow-hidden">
                    {/* Room header */}
                    <div className="px-4 py-2.5 border-b border-gray-100 bg-gray-800">
                      <span className="font-bold text-white text-sm">{room?.name||'חדר לא ידוע'}</span>
                    </div>
                    {/* Recurring series for this room */}
                    {(recurringByRoom[rId]||[]).map(({rid,series})=>{
                      const first=series[0];
                      const sorted=[...series].sort((a,b)=>new Date(a.date)-new Date(b.date));
                      const firstDate=toDateStr(new Date(sorted[0].date));
                      const lastDate=toDateStr(new Date(sorted[sorted.length-1].date));
                      const days=first.recurring?.daysOfWeek||[];
                      const freq=first.recurring?.frequency;
                      return(
                        <div key={rid} className="border-b border-blue-100 bg-blue-50">
                          {/* Date header row */}
                          <div className="px-4 py-2 border-b border-blue-100 flex items-center justify-between">
                            <span className="font-bold text-blue-700 text-sm flex items-center gap-1.5">
                              <RefreshCw size={12} className="shrink-0"/>
                              {firstDate} → {lastDate}
                            </span>
                            <div className="flex gap-1.5 shrink-0">
                              <button onClick={()=>openEditRecurring(rid,series)} className="flex items-center gap-1 text-xs font-medium text-blue-600 hover:bg-blue-100 border border-blue-200 rounded-lg px-2.5 py-1.5 transition-colors"><Pencil size={13}/> עריכה</button>
                              <button onClick={()=>handleDeleteRecurring(rid)} className="flex items-center gap-1 text-xs font-medium text-red-500 hover:bg-red-50 border border-red-200 rounded-lg px-2.5 py-1.5 transition-colors"><Trash2 size={13}/> מחיקה</button>
                            </div>
                          </div>
                          {/* Details row */}
                          <div className="px-4 py-2.5">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-medium text-gray-700">{first.therapist.name}</span>
                              <span className="text-sm text-gray-400">{hLabel(first.startHour)}–{hLabel(first.endHour)}</span>
                              <span className="text-xs text-blue-600 font-semibold bg-blue-100 px-2 py-0.5 rounded-full">{FREQ_HE[freq]||freq}</span>
                              {days.length>0&&<span className="text-xs text-blue-500 bg-blue-100 px-2 py-0.5 rounded-full">{days.map(d=>DAYS_SHORT[d]).join(' ')}</span>}
                            </div>
                            {first.note&&(
                              <p className="text-xs text-amber-600 bg-amber-50 rounded-lg px-2 py-1 mt-1.5 flex items-start gap-1">
                                <span className="shrink-0">📝</span>{first.note}
                              </p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                    {sortedDates.map(ds=>{
                      const daySlots=slotsByRoom[rId][ds].sort((a,b)=>a.startHour-b.startHour);
                      return(
                      <div key={ds}>
                        {daySlots.map((s,i)=>(
                          <div key={s.id}>
                            <div className="px-4 py-2 border-b border-gray-100 bg-green-50 flex items-center justify-between">
                              <span className="font-semibold text-green-700 text-sm">{formatDateHe(ds)}</span>
                              <div className="flex gap-1.5 shrink-0">
                                <button onClick={()=>openEditSlot(s)} className="flex items-center gap-1 text-xs font-medium text-green-600 hover:bg-green-100 border border-green-200 rounded-lg px-2.5 py-1.5 transition-colors"><Pencil size={13}/> עריכה</button>
                                <button onClick={()=>delSlot(s)} className="flex items-center gap-1 text-xs font-medium text-red-500 hover:bg-red-50 border border-red-200 rounded-lg px-2.5 py-1.5 transition-colors"><Trash2 size={13}/> מחיקה</button>
                              </div>
                            </div>
                            <SlotRow slot={s}/>
                          </div>
                        ))}
                      </div>
                      );
                    })}
                  </div>
                  );
                })}
              </div>
            </div>
          )}

          {Object.keys(recurringMap).length===0&&sortedRoomIds.length===0&&(
            <p className="text-gray-400 text-sm text-center py-10">אין שיבוצים</p>
          )}
        </div>
      )}
      </div>
    </>
  );
}
