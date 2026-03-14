import React, { useEffect, useState } from 'react';
import { getRooms, getTherapists, getSchedule, bookSlot } from '../services/api';
import { ChevronLeft, ChevronRight } from 'lucide-react';

const DAYS_HE = ['ראשון','שני','שלישי','רביעי','חמישי','שישי','שבת'];
const MONTHS_HE = ['ינואר','פברואר','מרץ','אפריל','מאי','יוני','יולי','אוגוסט','ספטמבר','אוקטובר','נובמבר','דצמבר'];
const ALL_HOURS = [8,9,10,11,12,13,14,15,16,17,18,19,20,21];

function toDateStr(d) {
  // YYYY-MM-DD in local time
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function formatDateHe(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  return `${DAYS_HE[d.getDay()]} ${d.getDate()} ${MONTHS_HE[d.getMonth()]}`;
}

function hLabel(h) { return `${h}:00`; }

// ── Date picker: show 4 weeks starting today ──────────────────
function DatePicker({ onSelect, slots }) {
  const today = new Date();
  today.setHours(0,0,0,0);

  const [weekOffset, setWeekOffset] = useState(0);

  // Build 4 weeks grid (28 days)
  const startOfDisplay = new Date(today);
  startOfDisplay.setDate(today.getDate() + weekOffset * 7);

  // Start from Sunday of that week
  const startSunday = new Date(startOfDisplay);
  startSunday.setDate(startOfDisplay.getDate() - startOfDisplay.getDay());

  const days = Array.from({ length: 28 }, (_, i) => {
    const d = new Date(startSunday);
    d.setDate(startSunday.getDate() + i);
    return d;
  });

  // Count slots per date
  const slotsByDate = {};
  slots.forEach((s) => {
    const key = toDateStr(new Date(s.date));
    slotsByDate[key] = (slotsByDate[key] || 0) + 1;
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <button onClick={() => setWeekOffset((w) => Math.max(0, w - 1))}
          disabled={weekOffset === 0}
          className="p-2 rounded-lg hover:bg-gray-100 disabled:opacity-30 transition-colors">
          <ChevronRight size={18} />
        </button>
        <span className="text-sm font-medium text-gray-600">
          {MONTHS_HE[startSunday.getMonth()]} {startSunday.getFullYear()}
        </span>
        <button onClick={() => setWeekOffset((w) => w + 1)}
          className="p-2 rounded-lg hover:bg-gray-100 transition-colors">
          <ChevronLeft size={18} />
        </button>
      </div>

      {/* Day headers */}
      <div className="grid grid-cols-7 mb-1">
        {DAYS_HE.map((d) => (
          <div key={d} className="text-center text-xs text-gray-400 font-medium py-1">{d.slice(0,1)}</div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-1">
        {days.map((d) => {
          const dateStr = toDateStr(d);
          const isPast = d < today;
          const isToday = toDateStr(d) === toDateStr(today);
          const count = slotsByDate[dateStr] || 0;

          return (
            <button
              key={dateStr}
              disabled={isPast}
              onClick={() => !isPast && onSelect(dateStr)}
              className={`relative rounded-xl py-2.5 text-sm font-medium transition-colors flex flex-col items-center ${
                isPast
                  ? 'text-gray-200 cursor-not-allowed'
                  : isToday
                  ? 'bg-blue-600 text-white hover:bg-blue-700'
                  : 'bg-white border border-gray-200 text-gray-700 hover:border-blue-400 hover:bg-blue-50'
              }`}
            >
              {d.getDate()}
              {count > 0 && !isPast && (
                <span className={`w-1.5 h-1.5 rounded-full mt-0.5 ${isToday ? 'bg-white' : 'bg-blue-400'}`} />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default function SchedulePage() {
  const [rooms, setRooms] = useState([]);
  const [therapists, setTherapists] = useState([]);
  const [allSlots, setAllSlots] = useState([]);
  const [loading, setLoading] = useState(true);

  const [step, setStep] = useState('room'); // room | date | hour
  const [selectedRoom, setSelectedRoom] = useState(null);
  const [selectedDate, setSelectedDate] = useState(null); // 'YYYY-MM-DD'
  const [daySlots, setDaySlots] = useState([]);

  // booking
  const [startHour, setStartHour] = useState(null);
  const [endHour, setEndHour] = useState('');
  const [selectedTherapist, setSelectedTherapist] = useState('');
  const [booking, setBooking] = useState(false);
  const [bookError, setBookError] = useState('');

  useEffect(() => {
    Promise.all([getRooms(), getTherapists()]).then(([r, t]) => {
      setRooms(r); setTherapists(t); setLoading(false);
    });
  }, []);

  const loadRoomSlots = async (roomId) => {
    const today = new Date();
    const from = toDateStr(today);
    const to = new Date(today);
    to.setDate(today.getDate() + 28);
    const s = await getSchedule({ roomId, from, to: toDateStr(to) });
    setAllSlots(s);
  };

  const handleSelectRoom = async (room) => {
    setSelectedRoom(room);
    setStep('date');
    await loadRoomSlots(room.id);
  };

  const handleSelectDate = async (dateStr) => {
    setSelectedDate(dateStr);
    setStep('hour');
    const s = await getSchedule({ roomId: selectedRoom.id, date: dateStr });
    setDaySlots(s);
    setStartHour(null); setEndHour(''); setBookError('');
  };

  const back = () => {
    if (step === 'hour') { setStep('date'); setStartHour(null); setEndHour(''); setBookError(''); }
    else if (step === 'date') { setStep('room'); setSelectedRoom(null); setAllSlots([]); }
  };

  const occupiedHours = new Set();
  daySlots.forEach((s) => {
    for (let h = s.startHour; h < s.endHour; h++) occupiedHours.add(h);
  });

  const handleBook = async () => {
    const end = parseInt(endHour);
    if (!end || end <= startHour) { setBookError('שעת סיום לא תקינה'); return; }
    if (!selectedTherapist) { setBookError('בחר שם'); return; }
    const hasOverlap = daySlots.some((s) => startHour < s.endHour && end > s.startHour);
    if (hasOverlap) { setBookError('קיים חופף עם שיבוץ קיים'); return; }

    setBooking(true); setBookError('');
    try {
      const slot = await bookSlot(selectedRoom.id, selectedDate, startHour, end, parseInt(selectedTherapist));
      setDaySlots((prev) => [...prev, slot]);
      setAllSlots((prev) => [...prev, slot]);
      setStartHour(null); setEndHour(''); setSelectedTherapist('');
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
      <div className="flex items-center gap-2 text-sm text-gray-400 mb-4 flex-wrap">
        <span className={step === 'room' ? 'font-bold text-blue-600' : 'text-gray-400'}>בחר חדר</span>
        <ChevronLeft size={13} />
        <span className={step === 'date' ? 'font-bold text-blue-600' : step === 'hour' ? 'text-gray-600' : 'text-gray-300'}>
          {selectedRoom?.name || 'בחר תאריך'}
        </span>
        <ChevronLeft size={13} />
        <span className={step === 'hour' ? 'font-bold text-blue-600' : 'text-gray-300'}>
          {selectedDate ? formatDateHe(selectedDate) : 'בחר שעה'}
        </span>
      </div>

      {step !== 'room' && (
        <button onClick={back} className="mb-4 text-sm text-blue-600 hover:underline flex items-center gap-1">
          <ChevronRight size={14} /> חזור
        </button>
      )}

      {/* STEP 1: Room */}
      {step === 'room' && (
        <div>
          <h1 className="text-2xl font-bold text-gray-900 mb-6">לוח שיבוצים — בחר חדר</h1>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {rooms.map((room) => (
              <button key={room.id} onClick={() => handleSelectRoom(room)}
                className="bg-white border border-gray-200 hover:border-blue-400 hover:bg-blue-50 rounded-xl px-5 py-4 text-right transition-colors shadow-sm">
                <span className="font-semibold text-gray-800">{room.name}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* STEP 2: Date picker */}
      {step === 'date' && (
        <div>
          <h1 className="text-2xl font-bold text-gray-900 mb-1">{selectedRoom.name}</h1>
          <p className="text-sm text-gray-500 mb-5">בחר תאריך לשיבוץ</p>
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
            <DatePicker onSelect={handleSelectDate} slots={allSlots} />
          </div>
          <p className="text-xs text-gray-400 mt-3 text-center">נקודה כחולה = יש שיבוצים באותו יום</p>
        </div>
      )}

      {/* STEP 3: Hours */}
      {step === 'hour' && (
        <div>
          <h1 className="text-2xl font-bold text-gray-900 mb-1">{selectedRoom.name}</h1>
          <p className="text-sm text-blue-600 font-medium mb-5">{formatDateHe(selectedDate)}</p>

          <p className="text-sm text-gray-500 mb-3">לחץ על שעת התחלה פנויה</p>

          {/* Hour grid */}
          <div className="grid grid-cols-4 sm:grid-cols-7 gap-2 mb-6">
            {ALL_HOURS.map((h) => {
              const occupied = occupiedHours.has(h);
              const isSelected = startHour === h;
              const occupant = daySlots.find((s) => h >= s.startHour && h < s.endHour);
              return (
                <button key={h} disabled={occupied}
                  onClick={() => !occupied && (setStartHour(h), setEndHour(''), setBookError(''))}
                  title={occupied ? occupant?.therapist?.name : ''}
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
                    <div className="text-xs truncate px-1 text-gray-400 leading-tight mt-0.5">
                      {occupant?.therapist?.name?.split(' ')[0]}
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          {/* Booking form */}
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
                    value={endHour} onChange={(e) => setEndHour(e.target.value)}
                  >
                    <option value="">-- בחר --</option>
                    {ALL_HOURS.filter((h) => h > startHour).map((h) => {
                      const blocked = Array.from({length: h - startHour}, (_,i) => startHour + i)
                        .some((x) => occupiedHours.has(x));
                      return <option key={h} value={h} disabled={blocked}>{hLabel(h)}{blocked ? ' (חסום)' : ''}</option>;
                    })}
                    {!occupiedHours.has(21) && startHour <= 21 && (
                      <option value={22}>22:00</option>
                    )}
                  </select>
                </div>
                <div className="flex-1">
                  <label className="block text-sm font-medium text-gray-700 mb-1">שמך</label>
                  <select
                    className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-base focus:outline-none focus:ring-2 focus:ring-blue-400"
                    value={selectedTherapist} onChange={(e) => setSelectedTherapist(e.target.value)}
                  >
                    <option value="">-- בחר --</option>
                    {therapists.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                </div>
              </div>
              {bookError && <p className="text-red-600 text-sm">{bookError}</p>}
              <div className="flex gap-2">
                <button onClick={handleBook} disabled={!endHour || !selectedTherapist || booking}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-medium py-2.5 rounded-lg transition-colors">
                  {booking ? 'שומר...' : `אשר שיבוץ ${hLabel(startHour)}–${endHour ? hLabel(parseInt(endHour)) : ''}`}
                </button>
                <button onClick={() => { setStartHour(null); setEndHour(''); setBookError(''); }}
                  className="border border-gray-300 text-gray-600 hover:bg-gray-50 px-4 py-2.5 rounded-lg transition-colors">
                  ביטול
                </button>
              </div>
            </div>
          )}

          {/* Existing bookings */}
          {daySlots.length > 0 && (
            <div className="mt-6">
              <h3 className="text-sm font-semibold text-gray-600 mb-2">שיבוצים ביום זה</h3>
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
