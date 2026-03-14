import React, { useEffect, useState } from 'react';
import { getRooms, getTherapists, getSchedule, bookSlot } from '../services/api';

const DAYS = [
  { key: 0, label: 'ראשון' },
  { key: 1, label: 'שני' },
  { key: 2, label: 'שלישי' },
  { key: 3, label: 'רביעי' },
  { key: 4, label: 'חמישי' },
  { key: 5, label: 'שישי' },
];

export default function SchedulePage() {
  const [rooms, setRooms] = useState([]);
  const [therapists, setTherapists] = useState([]);
  const [slots, setSlots] = useState([]); // ScheduleSlot[]
  const [loading, setLoading] = useState(true);

  // booking modal state
  const [modal, setModal] = useState(null); // { roomId, dayOfWeek }
  const [selectedTherapist, setSelectedTherapist] = useState('');
  const [booking, setBooking] = useState(false);
  const [error, setError] = useState('');

  const load = async () => {
    const [r, t, s] = await Promise.all([getRooms(), getTherapists(), getSchedule()]);
    setRooms(r);
    setTherapists(t);
    setSlots(s);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  // Build lookup: "roomId-day" → slot
  const slotMap = {};
  slots.forEach((s) => { slotMap[`${s.roomId}-${s.dayOfWeek}`] = s; });

  const openModal = (roomId, dayOfWeek) => {
    setModal({ roomId, dayOfWeek });
    setSelectedTherapist('');
    setError('');
  };

  const handleBook = async () => {
    if (!selectedTherapist) return;
    setBooking(true);
    setError('');
    try {
      const slot = await bookSlot(modal.roomId, modal.dayOfWeek, parseInt(selectedTherapist));
      setSlots((prev) => [...prev, slot]);
      setModal(null);
    } catch (e) {
      setError(e.response?.data?.error || 'שגיאה בשיבוץ');
    } finally {
      setBooking(false);
    }
  };

  if (loading) return <div className="text-center text-gray-400 py-20">טוען...</div>;

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">לוח שבועי</h1>

      {/* Desktop: full table */}
      <div className="hidden sm:block overflow-x-auto">
        <table className="w-full border-collapse bg-white rounded-xl shadow-sm overflow-hidden text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="text-right px-4 py-3 font-semibold text-gray-600 w-32">חדר</th>
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
                        <span className="inline-block bg-blue-100 text-blue-800 text-xs font-medium px-2.5 py-1.5 rounded-lg w-full">
                          {slot.therapist.name}
                        </span>
                      ) : (
                        <button
                          onClick={() => openModal(room.id, d.key)}
                          className="w-full text-xs text-gray-300 hover:text-blue-500 hover:bg-blue-50 border border-dashed border-gray-200 hover:border-blue-300 rounded-lg py-1.5 transition-colors"
                        >
                          + שבץ
                        </button>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile: day-by-day cards */}
      <div className="sm:hidden space-y-6">
        {DAYS.map((d) => (
          <div key={d.key}>
            <h2 className="text-base font-bold text-gray-700 mb-2 border-b pb-1">{d.label}</h2>
            <div className="space-y-2">
              {rooms.map((room) => {
                const slot = slotMap[`${room.id}-${d.key}`];
                return (
                  <div key={room.id} className="flex items-center justify-between bg-white rounded-xl border border-gray-200 px-4 py-3">
                    <span className="text-sm font-medium text-gray-700">{room.name}</span>
                    {slot ? (
                      <span className="bg-blue-100 text-blue-800 text-xs font-medium px-2.5 py-1 rounded-full">
                        {slot.therapist.name}
                      </span>
                    ) : (
                      <button
                        onClick={() => openModal(room.id, d.key)}
                        className="text-xs text-blue-600 border border-blue-300 rounded-lg px-3 py-1 hover:bg-blue-50 transition-colors"
                      >
                        + שבץ
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Booking modal */}
      {modal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6" dir="rtl">
            <h2 className="text-lg font-bold text-gray-900 mb-1">שיבוץ לחדר</h2>
            <p className="text-sm text-gray-500 mb-4">
              {rooms.find((r) => r.id === modal.roomId)?.name} ·{' '}
              {DAYS.find((d) => d.key === modal.dayOfWeek)?.label}
            </p>

            <label className="block text-sm font-medium text-gray-700 mb-1">בחר את שמך</label>
            <select
              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-base focus:outline-none focus:ring-2 focus:ring-blue-400 mb-4"
              value={selectedTherapist}
              onChange={(e) => setSelectedTherapist(e.target.value)}
            >
              <option value="">-- בחר --</option>
              {therapists.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>

            {error && <p className="text-red-600 text-sm mb-3">{error}</p>}

            <div className="flex gap-2">
              <button
                onClick={handleBook}
                disabled={!selectedTherapist || booking}
                className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-medium py-2.5 rounded-lg transition-colors"
              >
                {booking ? 'שומר...' : 'אשר שיבוץ'}
              </button>
              <button
                onClick={() => setModal(null)}
                className="flex-1 border border-gray-300 text-gray-600 hover:bg-gray-50 font-medium py-2.5 rounded-lg transition-colors"
              >
                ביטול
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
