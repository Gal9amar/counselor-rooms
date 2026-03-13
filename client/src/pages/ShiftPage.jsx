import React, { useEffect, useState } from 'react';
import { getTherapists, getRooms, startShift, endShift, getActiveShift } from '../services/api';
import { CheckCircle, AlertCircle } from 'lucide-react';

export default function ShiftPage() {
  const [therapists, setTherapists] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [selectedTherapist, setSelectedTherapist] = useState('');
  const [selectedRoom, setSelectedRoom] = useState('');
  const [activeShift, setActiveShift] = useState(null);
  const [message, setMessage] = useState(null); // { type: 'success'|'error', text }
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    Promise.all([getTherapists(), getRooms()]).then(([t, r]) => {
      setTherapists(t);
      setRooms(r);
    });
  }, []);

  useEffect(() => {
    if (!selectedTherapist) {
      setActiveShift(null);
      return;
    }
    getActiveShift(selectedTherapist).then(setActiveShift).catch(() => setActiveShift(null));
  }, [selectedTherapist]);

  const vacantRooms = rooms.filter((r) => !r.activeShift || r.activeShift?.therapist?.id === parseInt(selectedTherapist));

  const showMessage = (type, text) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 4000);
  };

  const handleStart = async () => {
    if (!selectedTherapist || !selectedRoom) return;
    setLoading(true);
    try {
      await startShift(parseInt(selectedTherapist), parseInt(selectedRoom));
      const shift = await getActiveShift(selectedTherapist);
      setActiveShift(shift);
      const updatedRooms = await getRooms();
      setRooms(updatedRooms);
      setSelectedRoom('');
      showMessage('success', 'המשמרת התחילה בהצלחה!');
    } catch (err) {
      showMessage('error', err.response?.data?.error || 'שגיאה בהתחלת משמרת');
    } finally {
      setLoading(false);
    }
  };

  const handleEnd = async () => {
    if (!selectedTherapist) return;
    setLoading(true);
    try {
      await endShift(parseInt(selectedTherapist));
      setActiveShift(null);
      const updatedRooms = await getRooms();
      setRooms(updatedRooms);
      showMessage('success', 'המשמרת הסתיימה. שהייה טובה!');
    } catch (err) {
      showMessage('error', err.response?.data?.error || 'שגיאה בסיום משמרת');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">כניסה / יציאה ממשמרת</h1>

      {message && (
        <div
          className={`flex items-center gap-2 p-4 rounded-lg mb-4 ${
            message.type === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
          }`}
        >
          {message.type === 'success' ? <CheckCircle size={18} /> : <AlertCircle size={18} />}
          {message.text}
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 space-y-4">
        {/* Therapist select */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">בחר מטפל</label>
          <select
            className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
            value={selectedTherapist}
            onChange={(e) => setSelectedTherapist(e.target.value)}
          >
            <option value="">-- בחר שם --</option>
            {therapists.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </div>

        {/* Active shift display */}
        {activeShift && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <p className="text-green-800 font-medium">
              משמרת פעילה ב<strong>{activeShift.room.name}</strong>
            </p>
            <p className="text-green-600 text-sm mt-1">
              החלה ב-{new Date(activeShift.startTime).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}
            </p>
            <button
              onClick={handleEnd}
              disabled={loading}
              className="mt-3 w-full bg-red-500 hover:bg-red-600 text-white font-medium py-2 rounded-lg transition-colors disabled:opacity-50"
            >
              {loading ? 'מסיים...' : 'סיום משמרת'}
            </button>
          </div>
        )}

        {/* Room select + start shift */}
        {!activeShift && selectedTherapist && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">בחר חדר</label>
            <select
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
              value={selectedRoom}
              onChange={(e) => setSelectedRoom(e.target.value)}
            >
              <option value="">-- בחר חדר --</option>
              {vacantRooms.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
            <button
              onClick={handleStart}
              disabled={loading || !selectedRoom}
              className="mt-3 w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 rounded-lg transition-colors disabled:opacity-50"
            >
              {loading ? 'מתחיל...' : 'התחלת משמרת'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
