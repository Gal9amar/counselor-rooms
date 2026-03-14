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

const HOURS = [8, 9, 10, 11, 12, 13, 14, 15, 16, 17];

function hourLabel(h) { return `${h}:00`; }

export default function SchedulePage() {
  const [rooms, setRooms] = useState([]);
  const [therapists, setTherapists] = useState([]);
  const [slots, setSlots] = useState([]);
  const [selectedRoom, setSelectedRoom] = useState('');
  const [loading, setLoading] = useState(true);

  // modal
  const [modal, setModal] = useState(null); // { dayOfWeek, hour }
  const [selectedTherapist, setSelectedTherapist] = useState('');
  const [booking, setBooking] = useState(false);
  const [bookError, setBookError] = useState('');

  const load = async (roomId) => {
    setLoading(true);
    try {
      const s = await getSchedule(roomId || null);
      setSlots(s);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    Promise.all([getRooms(), getTherapists()]).then(([r, t]) => {
      setRooms(r);
      setTherapists(t);
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    if (selectedRoom) load(parseInt(selectedRoom));
    else setSlots([]);
  }, [selectedRoom]);

  // Build lookup: "day-hour" → slot
  const slotMap = {};
  slots.forEach((s) => { slotMap[`${s.dayOfWeek}-${s.hour}`] = s; });

  const openModal = (dayOfWeek, hour) => {
    setModal({ dayOfWeek, hour });
    setSelectedTherapist('');
    setBookError('');
  };

  const handleBook = async () => {
    if (!selectedTherapist) return;
    setBooking(true);
    setBookError('');
    try {
      const slot = await bookSlot(parseInt(selectedRoom), modal.dayOfWeek, modal.hour, parseInt(selectedTherapist));
      setSlots((prev) => [...prev, slot]);
      setModal(null);
    } catch (e) {
      setBookError(e.response?.data?.error || 'שגיאה בשיבוץ');
    } finally {
      setBooking(false);
    }
  };

  const roomName = rooms.find((r) => r.id === parseInt(selectedRoom))?.name;

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <h1 className="text-2xl font-bold text-gray-900">לוח שבועי</h1>
        <select
          className="border border-gray-300 rounded-lg px-3 py-2.5 text-base focus:outline-none focus:ring-2 focus:ring-blue-400 w-full sm:w-64"
          value={selectedRoom}
          onChange={(e) => setSelectedRoom(e.target.value)}
        >
          <option value="">-- בחר חדר לצפייה --</option>
          {rooms.map((r) => (
            <option key={r.id} value={r.id}>{r.name}</option>
          ))}
        </select>
      </div>

      {!selectedRoom ? (
        <div className="text-center text-gray-400 py-20">בחר חדר כדי לראות את הלוח</div>
      ) : loading ? (
        <div className="text-center text-gray-400 py-20">טוען...</div>
      ) : (
        <>
          <p className="text-sm text-gray-500 mb-4">
            <span className="font-medium text-gray-700">{roomName}</span> — לחץ על תא פנוי כדי להירשם
          </p>

          {/* Desktop table */}
          <div className="hidden sm:block overflow-x-auto">
            <table className="border-collapse bg-white rounded-xl shadow-sm overflow-hidden text-sm w-full">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="text-right px-4 py-3 font-semibold text-gray-600 w-20">שעה</th>
                  {DAYS.map((d) => (
                    <th key={d.key} className="text-center px-3 py-3 font-semibold text-gray-600">{d.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {HOURS.map((hour, hi) => (
                  <tr key={hour} className={hi % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                    <td className="px-4 py-2.5 font-medium text-gray-500 border-l border-gray-100 text-sm">
                      {hourLabel(hour)}
                    </td>
                    {DAYS.map((d) => {
                      const slot = slotMap[`${d.key}-${hour}`];
                      return (
                        <td key={d.key} className="px-2 py-2 text-center">
                          {slot ? (
                            <span className="inline-block bg-blue-100 text-blue-800 text-xs font-medium px-2 py-1.5 rounded-lg w-full">
                              {slot.therapist.name}
                            </span>
                          ) : (
                            <button
                              onClick={() => openModal(d.key, hour)}
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

          {/* Mobile: day cards */}
          <div className="sm:hidden space-y-5">
            {DAYS.map((d) => {
              const daySlots = HOURS.map((h) => ({ hour: h, slot: slotMap[`${d.key}-${h}`] }));
              const hasAny = daySlots.some((x) => x.slot);
              return (
                <div key={d.key}>
                  <h2 className="text-sm font-bold text-gray-600 mb-2 border-b pb-1">{d.label}</h2>
                  <div className="grid grid-cols-2 gap-2">
                    {daySlots.map(({ hour, slot }) => (
                      <div key={hour}>
                        {slot ? (
                          <div className="bg-blue-50 border border-blue-200 rounded-xl px-3 py-2">
                            <div className="text-xs text-blue-500 font-medium">{hourLabel(hour)}</div>
                            <div className="text-sm font-semibold text-blue-800 truncate">{slot.therapist.name}</div>
                          </div>
                        ) : (
                          <button
                            onClick={() => openModal(d.key, hour)}
                            className="w-full border border-dashed border-gray-200 hover:border-blue-300 hover:bg-blue-50 rounded-xl px-3 py-2 text-right transition-colors"
                          >
                            <div className="text-xs text-gray-400">{hourLabel(hour)}</div>
                            <div className="text-xs text-gray-300 hover:text-blue-400">+ שבץ</div>
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* Modal */}
      {modal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6" dir="rtl">
            <h2 className="text-lg font-bold text-gray-900 mb-1">שיבוץ</h2>
            <p className="text-sm text-gray-500 mb-4">
              {roomName} · {DAYS.find((d) => d.key === modal.dayOfWeek)?.label} · {hourLabel(modal.hour)}
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

            {bookError && <p className="text-red-600 text-sm mb-3">{bookError}</p>}

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
