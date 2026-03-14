import React, { useEffect, useState } from 'react';
import {
  verifyAdmin, setAdminPassword,
  getRooms, addRoom, deleteRoom,
  getTherapists, addTherapist, deleteTherapist,
  getHistory,
} from '../services/api';
import { Trash2, Plus, LogIn } from 'lucide-react';

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

export default function AdminPage() {
  const [authed, setAuthed] = useState(!!sessionStorage.getItem('adminPass'));
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [tab, setTab] = useState('rooms');

  const [rooms, setRooms] = useState([]);
  const [therapists, setTherapists] = useState([]);
  const [history, setHistory] = useState([]);
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
    const [r, t, h] = await Promise.all([getRooms(), getTherapists(), getHistory()]);
    setRooms(r); setTherapists(t); setHistory(h);
  };

  const handleLogin = async () => {
    try {
      await verifyAdmin(password);
      sessionStorage.setItem('adminPass', password);
      setAdminPassword(password);
      setAuthed(true);
    } catch {
      setAuthError('סיסמה שגויה');
    }
  };

  const handleAddRoom = async () => {
    if (!newRoom.trim()) return;
    try {
      await addRoom(newRoom.trim());
      setNewRoom(''); setError('');
      setRooms(await getRooms());
    } catch (err) { setError(err.response?.data?.error || 'שגיאה'); }
  };

  const handleDeleteRoom = async (id) => {
    if (!confirm('למחוק את החדר?')) return;
    try { await deleteRoom(id); setRooms(rooms.filter((r) => r.id !== id)); }
    catch (err) { setError(err.response?.data?.error || 'שגיאה'); }
  };

  const handleAddTherapist = async () => {
    if (!newTherapist.trim()) return;
    try {
      await addTherapist(newTherapist.trim());
      setNewTherapist(''); setError('');
      setTherapists(await getTherapists());
    } catch (err) { setError(err.response?.data?.error || 'שגיאה'); }
  };

  const handleDeleteTherapist = async (id) => {
    if (!confirm('למחוק את המטפל?')) return;
    try { await deleteTherapist(id); setTherapists(therapists.filter((t) => t.id !== id)); }
    catch (err) { setError(err.response?.data?.error || 'שגיאה'); }
  };

  if (!authed) {
    return (
      <div className="max-w-sm mx-auto mt-16 px-4">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
          <h2 className="text-xl font-bold text-gray-900 mb-6 text-center">כניסת מנהל</h2>
          <input
            type="password"
            placeholder="סיסמה"
            className="w-full border border-gray-300 rounded-lg px-3 py-3 mb-3 focus:outline-none focus:ring-2 focus:ring-blue-400 text-base"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
          />
          {authError && <p className="text-red-600 text-sm mb-3">{authError}</p>}
          <button
            onClick={handleLogin}
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
    { id: 'history', label: 'היסטוריה' },
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">פאנל מנהל</h1>
        <button
          onClick={() => { sessionStorage.removeItem('adminPass'); setAuthed(false); }}
          className="text-sm text-gray-500 hover:text-gray-700 px-3 py-1.5 rounded-lg hover:bg-gray-100"
        >
          יציאה
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b border-gray-200">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => { setTab(t.id); setError(''); }}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              tab === t.id ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {error && <div className="bg-red-100 text-red-700 rounded-lg p-3 mb-4 text-sm">{error}</div>}

      {/* Rooms */}
      {tab === 'rooms' && (
        <div className="space-y-4">
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="שם חדר חדש"
              className="flex-1 border border-gray-300 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-400 text-base"
              value={newRoom}
              onChange={(e) => setNewRoom(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAddRoom()}
            />
            <button
              onClick={handleAddRoom}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-lg flex items-center gap-1 transition-colors whitespace-nowrap"
            >
              <Plus size={16} /> הוסף
            </button>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 divide-y">
            {rooms.length === 0 && <p className="text-gray-400 text-sm text-center py-6">אין חדרים</p>}
            {rooms.map((room) => (
              <div key={room.id} className="flex items-center justify-between px-4 py-3">
                <span className="font-medium text-gray-800">{room.name}</span>
                <button onClick={() => handleDeleteRoom(room.id)} className="text-gray-400 hover:text-red-500 transition-colors p-1">
                  <Trash2 size={17} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Therapists */}
      {tab === 'therapists' && (
        <div className="space-y-4">
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="שם מטפל חדש"
              className="flex-1 border border-gray-300 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-400 text-base"
              value={newTherapist}
              onChange={(e) => setNewTherapist(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAddTherapist()}
            />
            <button
              onClick={handleAddTherapist}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-lg flex items-center gap-1 transition-colors whitespace-nowrap"
            >
              <Plus size={16} /> הוסף
            </button>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 divide-y">
            {therapists.length === 0 && <p className="text-gray-400 text-sm text-center py-6">אין מטפלים</p>}
            {therapists.map((t) => (
              <div key={t.id} className="flex items-center justify-between px-4 py-3">
                <span className="font-medium text-gray-800">{t.name}</span>
                <button onClick={() => handleDeleteTherapist(t.id)} className="text-gray-400 hover:text-red-500 transition-colors p-1">
                  <Trash2 size={17} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* History */}
      {tab === 'history' && (
        <>
          {/* Mobile: cards */}
          <div className="sm:hidden space-y-3">
            {history.length === 0 && <p className="text-gray-400 text-sm text-center py-10">אין היסטוריה</p>}
            {history.map((s) => <HistoryCard key={s.id} s={s} />)}
          </div>

          {/* Desktop: table */}
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
