import React, { useEffect, useState } from 'react';
import {
  verifyAdmin, setAdminPassword,
  getRooms, addRoom, updateRoom, deleteRoom,
  getTherapists, addTherapist, updateTherapist, deleteTherapist,
  getSchedule, clearSlot,
} from '../services/api';
import { Trash2, Plus, LogIn, Pencil, Check, X } from 'lucide-react';

const DAYS_HE = ['ראשון','שני','שלישי','רביעי','חמישי','שישי','שבת'];
const MONTHS_HE = ['ינואר','פברואר','מרץ','אפריל','מאי','יוני','יולי','אוגוסט','ספטמבר','אוקטובר','נובמבר','דצמבר'];

function toDateStr(d) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
function formatDateHe(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  return `${DAYS_HE[d.getDay()]} ${d.getDate()} ${MONTHS_HE[d.getMonth()]}`;
}

function EditableRow({ item, onRename, onDelete, placeholder }) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(item.name);
  const [loading, setLoading] = useState(false);

  const handleSave = async () => {
    const trimmed = val.trim();
    if (!trimmed || trimmed === item.name) { setEditing(false); setVal(item.name); return; }
    setLoading(true);
    try { await onRename(item.id, trimmed); setEditing(false); }
    catch { setVal(item.name); setEditing(false); }
    finally { setLoading(false); }
  };

  return (
    <div className="flex items-center gap-2 px-4 py-3">
      {editing ? (
        <>
          <input autoFocus
            className="flex-1 border border-blue-400 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
            value={val} onChange={(e) => setVal(e.target.value)} placeholder={placeholder}
            onKeyDown={(e) => { if (e.key==='Enter') handleSave(); if (e.key==='Escape') { setVal(item.name); setEditing(false); } }}
          />
          <button onClick={handleSave} disabled={loading} className="text-green-600 p-1"><Check size={17}/></button>
          <button onClick={() => { setVal(item.name); setEditing(false); }} className="text-gray-400 p-1"><X size={17}/></button>
        </>
      ) : (
        <>
          <span className="flex-1 font-medium text-gray-800">{item.name}</span>
          <button onClick={() => setEditing(true)} className="text-gray-400 hover:text-blue-500 p-1"><Pencil size={15}/></button>
          <button onClick={() => onDelete(item.id)} className="text-gray-400 hover:text-red-500 p-1"><Trash2 size={16}/></button>
        </>
      )}
    </div>
  );
}

export default function AdminPage() {
  const [authed, setAuthed] = useState(!!sessionStorage.getItem('adminPass'));
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [tab, setTab] = useState('rooms');

  const [rooms, setRooms] = useState([]);
  const [therapists, setTherapists] = useState([]);
  const [slots, setSlots] = useState([]);
  const [newRoom, setNewRoom] = useState('');
  const [newTherapist, setNewTherapist] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (authed) { setAdminPassword(sessionStorage.getItem('adminPass')); loadAll(); }
  }, [authed]);

  const loadAll = async () => {
    const today = new Date();
    const from = toDateStr(today);
    const to = new Date(today); to.setDate(today.getDate() + 60);
    const [r, t, s] = await Promise.all([getRooms(), getTherapists(), getSchedule({ from, to: toDateStr(to) })]);
    setRooms(r); setTherapists(t); setSlots(s);
  };

  const handleLogin = async () => {
    try { await verifyAdmin(password); sessionStorage.setItem('adminPass', password); setAdminPassword(password); setAuthed(true); }
    catch { setAuthError('סיסמה שגויה'); }
  };

  const handleAddRoom = async () => {
    if (!newRoom.trim()) return;
    try { await addRoom(newRoom.trim()); setNewRoom(''); setError(''); setRooms(await getRooms()); }
    catch (e) { setError(e.response?.data?.error || 'שגיאה'); }
  };
  const handleRenameRoom = async (id, name) => {
    try { await updateRoom(id, name); setRooms((p) => p.map((r) => r.id===id ? {...r,name} : r)); }
    catch (e) { setError(e.response?.data?.error || 'שגיאה'); throw e; }
  };
  const handleDeleteRoom = async (id) => {
    if (!confirm('למחוק את החדר?')) return;
    try { await deleteRoom(id); setRooms(rooms.filter((r) => r.id!==id)); }
    catch (e) { setError(e.response?.data?.error || 'שגיאה'); }
  };
  const handleAddTherapist = async () => {
    if (!newTherapist.trim()) return;
    try { await addTherapist(newTherapist.trim()); setNewTherapist(''); setError(''); setTherapists(await getTherapists()); }
    catch (e) { setError(e.response?.data?.error || 'שגיאה'); }
  };
  const handleRenameTherapist = async (id, name) => {
    try { await updateTherapist(id, name); setTherapists((p) => p.map((t) => t.id===id ? {...t,name} : t)); }
    catch (e) { setError(e.response?.data?.error || 'שגיאה'); throw e; }
  };
  const handleDeleteTherapist = async (id) => {
    if (!confirm('למחוק את המטפל?')) return;
    try { await deleteTherapist(id); setTherapists(therapists.filter((t) => t.id!==id)); }
    catch (e) { setError(e.response?.data?.error || 'שגיאה'); }
  };
  const handleClearSlot = async (slotId) => {
    if (!confirm('לפנות את השיבוץ?')) return;
    try { await clearSlot(slotId); setSlots(slots.filter((s) => s.id!==slotId)); }
    catch (e) { setError(e.response?.data?.error || 'שגיאה'); }
  };

  // Group slots by date
  const slotsByDate = {};
  slots.forEach((s) => {
    const key = toDateStr(new Date(s.date));
    if (!slotsByDate[key]) slotsByDate[key] = [];
    slotsByDate[key].push(s);
  });
  const sortedDates = Object.keys(slotsByDate).sort();

  if (!authed) return (
    <div className="max-w-sm mx-auto mt-16 px-4">
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
        <h2 className="text-xl font-bold text-gray-900 mb-6 text-center">כניסת מנהל</h2>
        <input type="password" placeholder="סיסמה"
          className="w-full border border-gray-300 rounded-lg px-3 py-3 mb-3 focus:outline-none focus:ring-2 focus:ring-blue-400 text-base"
          value={password} onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => e.key==='Enter' && handleLogin()} />
        {authError && <p className="text-red-600 text-sm mb-3">{authError}</p>}
        <button onClick={handleLogin}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 rounded-lg flex items-center justify-center gap-2 transition-colors">
          <LogIn size={18}/> כניסה
        </button>
      </div>
    </div>
  );

  const tabs = [{ id:'rooms', label:'חדרים' }, { id:'therapists', label:'מטפלים' }, { id:'schedule', label:'שיבוצים' }];

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">פאנל מנהל</h1>
        <button onClick={() => { sessionStorage.removeItem('adminPass'); setAuthed(false); }}
          className="text-sm text-gray-500 hover:text-gray-700 px-3 py-1.5 rounded-lg hover:bg-gray-100">יציאה</button>
      </div>

      <div className="flex gap-1 mb-6 border-b border-gray-200">
        {tabs.map((t) => (
          <button key={t.id} onClick={() => { setTab(t.id); setError(''); }}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
              tab===t.id ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}>{t.label}</button>
        ))}
      </div>

      {error && <div className="bg-red-100 text-red-700 rounded-lg p-3 mb-4 text-sm">{error}</div>}

      {tab==='rooms' && (
        <div className="space-y-4">
          <div className="flex gap-2">
            <input type="text" placeholder="שם חדר חדש"
              className="flex-1 border border-gray-300 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-400 text-base"
              value={newRoom} onChange={(e) => setNewRoom(e.target.value)}
              onKeyDown={(e) => e.key==='Enter' && handleAddRoom()} />
            <button onClick={handleAddRoom}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-lg flex items-center gap-1 transition-colors whitespace-nowrap">
              <Plus size={16}/> הוסף
            </button>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 divide-y">
            {rooms.length===0 && <p className="text-gray-400 text-sm text-center py-6">אין חדרים</p>}
            {rooms.map((room) => <EditableRow key={room.id} item={room} onRename={handleRenameRoom} onDelete={handleDeleteRoom} placeholder="שם חדר"/>)}
          </div>
        </div>
      )}

      {tab==='therapists' && (
        <div className="space-y-4">
          <div className="flex gap-2">
            <input type="text" placeholder="שם מטפל חדש"
              className="flex-1 border border-gray-300 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-400 text-base"
              value={newTherapist} onChange={(e) => setNewTherapist(e.target.value)}
              onKeyDown={(e) => e.key==='Enter' && handleAddTherapist()} />
            <button onClick={handleAddTherapist}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-lg flex items-center gap-1 transition-colors whitespace-nowrap">
              <Plus size={16}/> הוסף
            </button>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 divide-y">
            {therapists.length===0 && <p className="text-gray-400 text-sm text-center py-6">אין מטפלים</p>}
            {therapists.map((t) => <EditableRow key={t.id} item={t} onRename={handleRenameTherapist} onDelete={handleDeleteTherapist} placeholder="שם מטפל"/>)}
          </div>
        </div>
      )}

      {tab==='schedule' && (
        <div className="space-y-4">
          {sortedDates.length===0 && <p className="text-gray-400 text-sm text-center py-10">אין שיבוצים</p>}
          {sortedDates.map((dateStr) => (
            <div key={dateStr} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="bg-gray-50 px-4 py-2 border-b border-gray-100">
                <span className="font-semibold text-gray-700">{formatDateHe(dateStr)}</span>
              </div>
              <div className="divide-y">
                {slotsByDate[dateStr].sort((a,b) => a.startHour-b.startHour).map((s) => (
                  <div key={s.id} className="flex items-center justify-between px-4 py-3">
                    <div>
                      <span className="font-medium text-gray-800">{s.therapist.name}</span>
                      <span className="text-sm text-gray-400 mr-3">{s.room.name} · {s.startHour}:00–{s.endHour}:00</span>
                    </div>
                    <button onClick={() => handleClearSlot(s.id)} className="text-gray-300 hover:text-red-500 transition-colors p-1">
                      <Trash2 size={15}/>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
