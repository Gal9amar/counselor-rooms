import React, { useEffect, useState } from 'react';
import { getRooms, getTherapists, getSchedule, bookSlot } from '../services/api';
import { ChevronLeft } from 'lucide-react';

const DAYS = [
  { key: 0, label: 'ראשון' },
  { key: 1, label: 'שני' },
  { key: 2, label: 'שלישי' },
  { key: 3, label: 'רביעי' },
  { key: 4, label: 'חמישי' },
  { key: 5, label: 'שישי' },
];

const ALL_HOURS = [8,9,10,11,12,13,14,15,16,17,18,19,20,21];

function hLabel(h) { return `${h}:00`; }

// step = 'room' | 'day' | 'hour'
export default function SchedulePage() {
  const [rooms, setRooms] = useState([]);
  const [therapists, setTherapists] = useState([]);
  const [loading, setLoading] = useState(true);

  // wizard state
  const [step, setStep] = useState('room');
  const [selectedRoom, setSelectedRoom] = useState(null);
  const [selectedDay, setSelectedDay] = useState(null);
  const [slots, setSlots] = useState([]); // slots for selected room

  // booking modal
  const [startHour, setStartHour] = useState(null);
  const [endHour, setEndHour] = useState('');
  const [selectedTherapist, setSelectedTherapist] = useState('');
  const [booking, setBooking] = useState(false);
  const [bookError, setBookError] = useState('');

  useEffect(() => {
    Promise.all([getRooms(), getTherapists()]).then(([r, t]) => {
      setRooms(r);
      setTherapists(t);
      setLoading(false);
    });
  }, []);

  const loadSlots = async (roomId) => {
    const s = await getSchedule(roomId, null);
    setSlots(s);
  };

  const handleSelectRoom = async (room) => {
    setSelectedRoom(room);
    setStep('day');
    await loadSlots(room.id);
  };

  const handleSelectDay = (day) => {
    setSelectedDay(day);
    setStep('hour');
  };

  const back = () => {
    if (step === 'hour') { setStep('day'); setStartHour(null); setEndHour(''); setBookError(''); }
    else if (step === 'day') { setStep('room'); setSelectedRoom(null); setSlots([]); }
  };

  // Slots for selected day
  const daySlots = slots.filter((s) => s.dayOfWeek === selectedDay?.key);

  // Which hours are occupied in selected day
  const occupiedHours = new Set();
  daySlots.forEach((s) => {
    for (let h = s.startHour; h < s.endHour; h++) occupiedHours.add(h);
  });

  // Which days have at least one free hour
  const daysFreeStatus = DAYS.map((d) => {
    const dayOccupied = new Set();
    slots.filter((s) => s.dayOfWeek === d.key)
      .forEach((s) => { for (let h = s.startHour; h < s.endHour; h++) dayOccupied.add(h); });
    const hasFree = ALL_HOURS.some((h) => !dayOccupied.has(h));
    return { ...d, hasFree, dayOccupied };
  });

  const handleSelectStartHour = (h) => {
    setStartHour(h);
    setEndHour('');
    setBookError('');
    setSelectedTherapist('');
  };

  const handleBook = async () => {
    const end = parseInt(endHour);
    if (!end || end <= startHour || end > 22) {
      setBookError('שעת סיום לא תקינה');
      return;
    }
    if (!selectedTherapist) { setBookError('בחר שם'); return; }

    // Check overlap with existing
    const hasOverlap = daySlots.some(
      (s) => startHour < s.endHour && end > s.startHour
    );
    if (hasOverlap) { setBookError('קיים חופף עם שיבוץ קיים'); return; }

    setBooking(true);
    setBookError('');
    try {
      const slot = await bookSlot(selectedRoom.id, selectedDay.key, startHour, end, parseInt(selectedTherapist));
      setSlots((prev) => [...prev, slot]);
      setStartHour(null);
      setEndHour('');
      setSelectedTherapist('');
    } catch (e) {
      setBookError(e.response?.data?.error || 'שגיאה');
    } finally {
      setBooking(false);
    }
  };

  if (loading) return <div className="text-center text-gray-400 py-20">טוען...</div>;

  return (
    <div className="max-w-2xl mx-auto">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-gray-400 mb-6 flex-wrap">
        <span className={step === 'room' ? 'font-bold text-blue-600' : 'text-gray-400'}>בחר חדר</span>
        <ChevronLeft size={14} />
        <span className={step === 'day' ? 'font-bold text-blue-600' : step === 'hour' ? 'text-gray-600' : 'text-gray-300'}>
          {selectedRoom ? selectedRoom.name : 'בחר יום'}
        </span>
        <ChevronLeft size={14} />
        <span className={step === 'hour' ? 'font-bold text-blue-600' : 'text-gray-300'}>
          {selectedDay ? selectedDay.label : 'בחר שעה'}
        </span>
      </div>

      {/* Back button */}
      {step !== 'room' && (
        <button onClick={back} className="mb-4 text-sm text-blue-600 hover:underline flex items-center gap-1">
          <ChevronLeft size={14} /> חזור
        </button>
      )}

      {/* STEP 1: Room */}
      {step === 'room' && (
        <div>
          <h1 className="text-2xl font-bold text-gray-900 mb-6">לוח שבועי — בחר חדר</h1>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {rooms.map((room) => (
              <button
                key={room.id}
                onClick={() => handleSelectRoom(room)}
                className="bg-white border border-gray-200 hover:border-blue-400 hover:bg-blue-50 rounded-xl px-5 py-4 text-right transition-colors shadow-sm"
              >
                <span className="font-semibold text-gray-800">{room.name}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* STEP 2: Day */}
      {step === 'day' && (
        <div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">{selectedRoom.name}</h1>
          <p className="text-sm text-gray-500 mb-6">בחר יום לשיבוץ</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {daysFreeStatus.map((d) => (
              <button
                key={d.key}
                onClick={() => d.hasFree && handleSelectDay(d)}
                disabled={!d.hasFree}
                className={`rounded-xl px-4 py-5 text-center transition-colors border shadow-sm ${
                  d.hasFree
                    ? 'bg-white border-gray-200 hover:border-blue-400 hover:bg-blue-50 cursor-pointer'
                    : 'bg-gray-50 border-gray-100 opacity-50 cursor-not-allowed'
                }`}
              >
                <div className="font-semibold text-gray-800 text-base">{d.label}</div>
                <div className="text-xs text-gray-400 mt-1">
                  {d.hasFree ? 'יש שעות פנויות' : 'מלא'}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* STEP 3: Hours */}
      {step === 'hour' && (
        <div>
          <h1 className="text-2xl font-bold text-gray-900 mb-1">{selectedRoom.name} · {selectedDay.label}</h1>
          <p className="text-sm text-gray-500 mb-6">לחץ על שעת התחלה פנויה</p>

          {/* Hour grid */}
          <div className="grid grid-cols-4 sm:grid-cols-7 gap-2 mb-6">
            {ALL_HOURS.map((h) => {
              const occupied = occupiedHours.has(h);
              const isSelected = startHour === h;
              const occupant = daySlots.find((s) => h >= s.startHour && h < s.endHour);
              return (
                <button
                  key={h}
                  disabled={occupied}
                  onClick={() => !occupied && handleSelectStartHour(h)}
                  title={occupied ? `${occupant?.therapist?.name}` : ''}
                  className={`rounded-xl py-3 text-sm font-medium transition-colors border ${
                    isSelected
                      ? 'bg-blue-600 text-white border-blue-600 shadow-md'
                      : occupied
                      ? 'bg-gray-100 text-gray-300 border-gray-100 cursor-not-allowed'
                      : 'bg-white text-gray-700 border-gray-200 hover:border-blue-400 hover:bg-blue-50'
                  }`}
                >
                  {hLabel(h)}
                  {occupied && (
                    <div className="text-xs truncate px-1 text-gray-400">
                      {occupant?.therapist?.name?.split(' ')[0]}
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          {/* Booking form — shown after selecting start hour */}
          {startHour !== null && (
            <div className="bg-white border border-blue-200 rounded-2xl p-5 shadow-sm space-y-4">
              <p className="font-semibold text-gray-800">
                שיבוץ החל מ-<span className="text-blue-600">{hLabel(startHour)}</span>
              </p>

              <div className="flex flex-col sm:flex-row gap-3">
                <div className="flex-1">
                  <label className="block text-sm font-medium text-gray-700 mb-1">שעת סיום</label>
                  <select
                    className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-base focus:outline-none focus:ring-2 focus:ring-blue-400"
                    value={endHour}
                    onChange={(e) => setEndHour(e.target.value)}
                  >
                    <option value="">-- בחר --</option>
                    {ALL_HOURS.filter((h) => h > startHour).map((h) => {
                      // disable if any hour in range is occupied
                      const blocked = ALL_HOURS
                        .filter((x) => x >= startHour && x < h)
                        .some((x) => occupiedHours.has(x));
                      return (
                        <option key={h} value={h} disabled={blocked}>
                          {hLabel(h)}{blocked ? ' (חסום)' : ''}
                        </option>
                      );
                    })}
                    {/* 22:00 as end-of-day option */}
                    {!occupiedHours.has(21) && (
                      <option value={22}>22:00</option>
                    )}
                  </select>
                </div>

                <div className="flex-1">
                  <label className="block text-sm font-medium text-gray-700 mb-1">שמך</label>
                  <select
                    className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-base focus:outline-none focus:ring-2 focus:ring-blue-400"
                    value={selectedTherapist}
                    onChange={(e) => setSelectedTherapist(e.target.value)}
                  >
                    <option value="">-- בחר --</option>
                    {therapists.map((t) => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              {bookError && <p className="text-red-600 text-sm">{bookError}</p>}

              <div className="flex gap-2">
                <button
                  onClick={handleBook}
                  disabled={!endHour || !selectedTherapist || booking}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-medium py-2.5 rounded-lg transition-colors"
                >
                  {booking ? 'שומר...' : `אשר שיבוץ ${hLabel(startHour)}–${endHour ? hLabel(parseInt(endHour)) : ''}`}
                </button>
                <button
                  onClick={() => { setStartHour(null); setEndHour(''); setBookError(''); }}
                  className="border border-gray-300 text-gray-600 hover:bg-gray-50 px-4 py-2.5 rounded-lg transition-colors"
                >
                  ביטול
                </button>
              </div>
            </div>
          )}

          {/* Existing bookings for this day */}
          {daySlots.length > 0 && (
            <div className="mt-6">
              <h3 className="text-sm font-semibold text-gray-600 mb-2">שיבוצים קיימים ביום זה</h3>
              <div className="space-y-2">
                {daySlots.sort((a,b) => a.startHour - b.startHour).map((s) => (
                  <div key={s.id} className="flex items-center justify-between bg-blue-50 border border-blue-100 rounded-xl px-4 py-2.5">
                    <span className="font-medium text-blue-800">{s.therapist.name}</span>
                    <span className="text-sm text-blue-500">{hLabel(s.startHour)} – {hLabel(s.endHour)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
