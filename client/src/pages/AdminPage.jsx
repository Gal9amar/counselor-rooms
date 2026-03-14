import React, { useEffect, useState } from 'react';
import {
  verifyAdmin, setAdminPassword,
  getRooms, addRoom, updateRoom, deleteRoom,
  getTherapists, addTherapist, updateTherapist, deleteTherapist,
  getHistory, getSchedule, clearSlot,
} from '../services/api';
import { Trash2, Plus, LogIn, Pencil, Check, X } from 'lucide-react';

const DAYS = [
  { key: 0, label: 'ראשון' }, { key: 1, label: 'שני' }, { key: 2, label: 'שלישי' },
  { key: 3, label: 'רביעי' }, { key: 4, label: 'חמישי' }, { key: 5, label: 'שישי' },
];

function formatDate(d) { return new Date(d).toLocaleDateString('he-IL'); }
function formatTime(d) { return new Date(d).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' }); }

function HistoryCard({ s }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-1">
      <div className="flex items-center justify-between">
        <span className="font-semibold text-gray-800">{s.therapist.name}</span>
        <span className="text-xs bg-gray-100 text-gray-500 px-2 py-1 rounded-full">{s.room.name}</span>
      </div>
      <div className="text-sm text-gray-500">
        {formatDate(s.startTime)} · {formatTime(s.startTime)} – {formatTime(s.endTime)}
      </div>
    </div>
  );
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

  const handleCancel = () => { setVal(item.name); setEditing(false); };

  return (
    <div className="flex items-center gap-2 px-4 py-3">
      {editing ? (
        <>
          <input autoFocus
            className="flex-1 border border-blue-400 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
            value={val} onChange={(e) => setVal(e.target.value)} placeholder={placeholder}
            onKeyDown={(e) => { if (e.key === 'Enter') handleSave(); if (e.key === 'Escape') handleCancel(); }}
          />
          <button onClick={handleSave} disabled={loading} className="text-green-600 hover:text-green-700 p-1"><Check size={17} /></button>
          <button onClick={handleCancel} className="text-gray-400 hover:text-gray-600 p-1"><X size={17} /></button>
        </>
      ) : (
        <>
          <span className="flex-1 font-medium text-gray-800">{item.name}</span>
          <button onClick={() => setEditing(true)} className="text-gray-400 hover:text-blue-500 p-1"><Pencil size={15} /></button>
          <button onClick={() => onDelete(item.id)} className="text-gray-400 hover:text-red-500 p-1"><Trash2 size={16} /></button>
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
  const [history, setHistory] = useState([]);
  const [slots, setSlots] = useState([]);
  const [newRoom, setNewRoom] = useState('');
  const [newTherapist, setNewTherapist] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (authed) {
      const pass = sessionStorage.getItem('adminPass');
      setAdminPassword(pass);
      loadAll();
    }
  }, [authed]);

  const loadAll = async () => {
    const [r, t, h, s] = await Promise.all([getRooms(), getTherapists(), getHistory(), getSchedule()]);
    setRooms(r); setTherapists(t); setHistory(h); setSlots(s);
  };

  const handleLogin = async () => {
    try {
      await verifyAdmin(password);
      sessionStorage.setItem('adminPass', password);
      setAdminPassword(password);
      setAuthed(true);
    } catch { setAuthError('סיסמה שגויה'); }
  };

  const handleAddRoom = async () => {
    if (!newRoom.trim()) return;
    try { await addRoom(newRoom.trim()); setNewRoom(''); setError(''); setRooms(await getRooms()); }
    catch (e) { setError(e.response?.data?.error || 'שגיאה'); }
  };
  const handleRenameRoom = async (id, name) => {
    try { await updateRoom(id, name); setRooms((p) => p.map((r) => r.id === id ? { ...r, name } : r)); }
    catch (e) { setError(e.response?.data?.error || 'שגיאה'); throw e; }
  };
  const handleDeleteRoom = async (id) => {
    if (!confirm('למחוק את החדר?')) return;
    try { await deleteRoom(id); setRooms(rooms.filter((r) => r.id !== id)); }
    catch (e) { setError(e.response?.data?.error || 'שגיאה'); }
  };

  const handleAddTherapist = async () => {
    if (!newTherapist.trim()) return;
    try { await addTherapist(newTherapist.trim()); setNewTherapist(''); setError(''); setTherapists(await getTherapists()); }
    catch (e) { setError(e.response?.data?.error || 'שגיאה'); }
  };
  const handleRenameTherapist = async (id, name) => {
    try { await updateTherapist(id, name); setTherapists((p) => p.map((t) => t.id === id ? { ...t, name } : t)); }
    catch (e) { setError(e.response?.data?.error || 'שגיאה'); throw e; }
  };
  const handleDeleteTherapist = async (id) => {
    if (!confirm('למחוק את המטפל?')) return;
    try { await deleteTherapist(id); setTherapists(therapists.filter((t) => t.id !== id)); }
    catch (e) { setError(e.response?.data?.error || 'שגיאה'); }
  };

  const handleClearSlot = async (slotId) => {
    if (!confirm('לפנות את התא?')) return;
    try { await clearSlot(slotId); setSlots(slots.filter((s) => s.id !== slotId)); }
    catch (e) { setError(e.response?.data?.error || 'שגיאה'); }
  };

  // Build slot map for schedule tab
  const slotMap = {};
  slots.forEach((s) => { slotMap[`${s.roomId}-${s.dayOfWeek}`] = s; });

  if (!authed) {
    return (
      <div className="max-w-sm mx-auto mt-16 px-4">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
          <h2 className="text-xl font-bold text-gray-900 mb-6 text-center">כניסת מנהל</h2>
          <input type="password" placeholder="סיסמה"
            className="w-full border border-gray-300 rounded-lg px-3 py-3 mb-3 focus:outline-none focus:ring-2 focus:ring-blue-400 text-base"
            value={password} onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
          />
          {authError && <p className="text-red-600 text-sm mb-3">{authError}</p>}
          <button onClick={handleLogin}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 rounded-lg flex items-center justify-center gap-2 transition-colors"
          >
            <LogIn size={18} /> כניסה
          </button>
        </div>
      </div>
    );
  }

  const tabs = [
    { id: 'rooms', label: 'חדרים' },
    { id: 'therapists', label: 'מטפלים' },
    { id: 'schedule', label: 'לוח שבועי' },
    { id: 'history', label: 'היסטוריה' },
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">פאנל מנהל</h1>
        <button onClick={() => { sessionStorage.removeItem('adminPass'); setAuthed(false); }}
          className="text-sm text-gray-500 hover:text-gray-700 px-3 py-1.5 rounded-lg hover:bg-gray-100">
          יציאה
        </button>
      </div>

      <div className="flex gap-1 mb-6 border-b border-gray-200 overflow-x-auto">
        {tabs.map((t) => (
          <button key={t.id} onClick={() => { setTab(t.id); setError(''); }}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
              tab === t.id ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >{t.label}</button>
        ))}
      </div>

      {error && <div className="bg-red-100 text-red-700 rounded-lg p-3 mb-4 text-sm">{error}</div>}

      {/* Rooms */}
      {tab === 'rooms' && (
        <div className="space-y-4">
          <div className="flex gap-2">
            <input type="text" placeholder="שם חדר חדש"
              className="flex-1 border border-gray-300 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-400 text-base"
              value={newRoom} onChange={(e) => setNewRoom(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAddRoom()} />
            <button onClick={handleAddRoom}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-lg flex items-center gap-1 transition-colors whitespace-nowrap">
              <Plus size={16} /> הוסף
            </button>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 divide-y">
            {rooms.length === 0 && <p className="text-gray-400 text-sm text-center py-6">אין חדרים</p>}
            {rooms.map((room) => (
              <EditableRow key={room.id} item={room} onRename={handleRenameRoom} onDelete={handleDeleteRoom} placeholder="שם חדר" />
            ))}
          </div>
        </div>
      )}

      {/* Therapists */}
      {tab === 'therapists' && (
        <div className="space-y-4">
          <div className="flex gap-2">
            <input type="text" placeholder="שם מטפל חדש"
              className="flex-1 border border-gray-300 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-400 text-base"
              value={newTherapist} onChange={(e) => setNewTherapist(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAddTherapist()} />
            <button onClick={handleAddTherapist}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-lg flex items-center gap-1 transition-colors whitespace-nowrap">
              <Plus size={16} /> הוסף
            </button>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 divide-y">
            {therapists.length === 0 && <p className="text-gray-400 text-sm text-center py-6">אין מטפלים</p>}
            {therapists.map((t) => (
              <EditableRow key={t.id} item={t} onRename={handleRenameTherapist} onDelete={handleDeleteTherapist} placeholder="שם מטפל" />
            ))}
          </div>
        </div>
      )}

      {/* Schedule — admin can clear slots */}
      {tab === 'schedule' && (
        <div>
          <p className="text-sm text-gray-500 mb-4">לחץ על 🗑 לפינוי תא מהלוח</p>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse bg-white rounded-xl shadow-sm overflow-hidden text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="text-right px-4 py-3 font-semibold text-gray-600">חדר</th>
                  {DAYS.map((d) => (
                    <th key={d.key} className="text-center px-3 py-3 font-semibold text-gray-600">{d.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rooms.map((room, ri) => (
                  <tr key={room.id} className={ri % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                    <td className="px-4 py-3 font-medium text-gray-800 border-l border-gray-100">{room.name}</td>
                    {DAYS.map((d) => {
                      const slot = slotMap[`${room.id}-${d.key}`];
                      return (
                        <td key={d.key} className="px-2 py-2 text-center">
                          {slot ? (
                            <div className="flex items-center justify-center gap-1">
                              <span className="bg-blue-100 text-blue-800 text-xs font-medium px-2 py-1 rounded-lg">
                                {slot.therapist.name}
                              </span>
                              <button onClick={() => handleClearSlot(slot.id)}
                                className="text-gray-300 hover:text-red-500 transition-colors">
                                <Trash2 size={13} />
                              </button>
                            </div>
                          ) : (
                            <span className="text-gray-200 text-xs">—</span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* History */}
      {tab === 'history' && (
        <>
          <div className="sm:hidden space-y-3">
            {history.length === 0 && <p className="text-gray-400 text-sm text-center py-10">אין היסטוריה</p>}
            {history.map((s) => <HistoryCard key={s.id} s={s} />)}
          </div>
          <div className="hidden sm:block bg-white rounded-xl border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="text-right px-4 py-3 font-medium text-gray-600">מטפל</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600">חדר</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600">תאריך</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600">כניסה</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600">יציאה</th>
                </tr>
              </thead>
              <tbody>
                {history.map((s, i) => (
                  <tr key={s.id} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                    <td className="px-4 py-3 text-gray-800">{s.therapist.name}</td>
                    <td className="px-4 py-3 text-gray-600">{s.room.name}</td>
                    <td className="px-4 py-3 text-gray-600">{formatDate(s.startTime)}</td>
                    <td className="px-4 py-3 text-gray-600">{formatTime(s.startTime)}</td>
                    <td className="px-4 py-3 text-gray-600">{formatTime(s.endTime)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
