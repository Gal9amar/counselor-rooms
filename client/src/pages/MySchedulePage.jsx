import React, { useEffect, useState } from 'react';
import { getTherapists, getSchedule } from '../services/api';
import { ChevronLeft, ChevronRight, Clock, MapPin, FileText, User } from 'lucide-react';

const DAYS_HE = ['ראשון','שני','שלישי','רביעי','חמישי','שישי','שבת'];
const MONTHS_HE = ['ינואר','פברואר','מרץ','אפריל','מאי','יוני','יולי','אוגוסט','ספטמבר','אוקטובר','נובמבר','דצמבר'];

function toDateStr(d) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
function hLabel(h) { return `${h}:00`; }
function startOfWeek(date) {
  const d = new Date(date);
  d.setHours(0,0,0,0);
  d.setDate(d.getDate() - d.getDay()); // Sunday
  return d;
}
function addDays(date, n) {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}
function isSameDay(a, b) { return toDateStr(a) === toDateStr(b); }

export default function MySchedulePage() {
  const [therapists, setTherapists] = useState([]);
  const [selectedId, setSelectedId] = useState('');
  const [slots, setSlots] = useState([]);
  const [loading, setLoading] = useState(false);
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()));

  useEffect(() => {
    getTherapists().then(setTherapists);
    const saved = localStorage.getItem('myScheduleTherapistId');
    if (saved) setSelectedId(saved);
  }, []);

  useEffect(() => {
    if (!selectedId) { setSlots([]); return; }
    localStorage.setItem('myScheduleTherapistId', selectedId);
    setLoading(true);
    const past = new Date('2020-01-01');
    const future = new Date(); future.setFullYear(future.getFullYear() + 2);
    getSchedule({ from: toDateStr(past), to: toDateStr(future) })
      .then(all => setSlots(all.filter(s => s.therapistId === parseInt(selectedId))))
      .finally(() => setLoading(false));
  }, [selectedId]);

  const today = new Date(); today.setHours(0,0,0,0);
  const todayStr = toDateStr(today);
  const now = new Date();
  const currentHour = now.getHours();

  // Week days: Sun–Sat
  const weekDays = Array.from({length:7}, (_,i) => addDays(weekStart, i));
  const weekEnd = weekDays[6];

  const prevWeek = () => setWeekStart(d => addDays(d, -7));
  const nextWeek = () => setWeekStart(d => addDays(d, 7));
  const goToday = () => setWeekStart(startOfWeek(new Date()));
  const isCurrentWeek = isSameDay(weekStart, startOfWeek(new Date()));

  // Slots for current week
  const weekSlots = slots.filter(s => {
    const sd = toDateStr(new Date(s.date));
    return sd >= toDateStr(weekStart) && sd <= toDateStr(weekEnd);
  });

  // Next upcoming slot (for hero banner)
  const nextSlot = slots
    .filter(s => {
      const sd = toDateStr(new Date(s.date));
      if (sd > todayStr) return true;
      if (sd === todayStr) return s.endHour > currentHour;
      return false;
    })
    .sort((a,b) => {
      const da = toDateStr(new Date(a.date)), db = toDateStr(new Date(b.date));
      return da !== db ? (da < db ? -1 : 1) : a.startHour - b.startHour;
    })[0];

  // Stats
  const futureSlots = slots.filter(s => {
    const sd = toDateStr(new Date(s.date));
    return sd > todayStr || (sd === todayStr && s.endHour > currentHour);
  });
  const totalHours = futureSlots.reduce((acc,s) => acc + (s.endHour - s.startHour), 0);

  function formatNextDate(ds) {
    if (ds === todayStr) return 'היום';
    const d = new Date(ds + 'T00:00:00');
    const diff = Math.round((d - today) / (1000*60*60*24));
    if (diff === 1) return 'מחר';
    return `${DAYS_HE[d.getDay()]} ${d.getDate()} ${MONTHS_HE[d.getMonth()]}`;
  }

  function isSlotPast(s) {
    const sd = toDateStr(new Date(s.date));
    if (sd < todayStr) return true;
    if (sd === todayStr) return s.endHour <= currentHour;
    return false;
  }
  function isSlotActive(s) {
    const sd = toDateStr(new Date(s.date));
    return sd === todayStr && currentHour >= s.startHour && currentHour < s.endHour;
  }

  return (
    <div className="max-w-2xl mx-auto fade-up">
      {/* Therapist selector */}
      <div className="relative mb-5">
        <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none">
          <User size={17} className="text-green-500"/>
        </div>
        <select
          className="input pr-10 pl-8 text-base font-medium appearance-none cursor-pointer"
          value={selectedId}
          onChange={e => setSelectedId(e.target.value)}
        >
          <option value="">-- בחר את שמך --</option>
          {therapists.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
        <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none text-gray-400">▾</div>
      </div>

      {!selectedId && (
        <div className="card rounded-2xl p-12 text-center text-gray-300">
          <User size={40} className="mx-auto mb-3 text-gray-200"/>
          <p className="font-medium text-gray-400">בחר שם מהרשימה לצפייה בשיבוצים</p>
        </div>
      )}

      {selectedId && loading && <div className="text-center text-gray-400 py-16">טוען...</div>}

      {selectedId && !loading && (
        <>
          {/* Hero — next slot */}
          {nextSlot && (
            <div className="card rounded-2xl p-4 mb-5 fade-up" style={{background:'linear-gradient(135deg,#f0fdf4,#dcfce7)',borderColor:'#bbf7d0'}}>
              <p className="text-xs font-semibold text-green-600 mb-2 flex items-center gap-1.5">
                <span className="w-2 h-2 bg-green-500 rounded-full pulse-dot inline-block"/>
                השיבוץ הקרוב שלך
              </p>
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div>
                  <p className="text-lg font-bold text-gray-800">
                    {formatNextDate(toDateStr(new Date(nextSlot.date)))}
                  </p>
                  <div className="flex items-center gap-3 mt-1 text-sm text-gray-600">
                    <span className="flex items-center gap-1"><Clock size={13} className="text-green-500"/>{hLabel(nextSlot.startHour)} – {hLabel(nextSlot.endHour)}</span>
                    <span className="flex items-center gap-1"><MapPin size={13} className="text-green-500"/>{nextSlot.room.name}</span>
                  </div>
                  {nextSlot.note && <p className="text-xs text-gray-400 italic mt-1 flex items-start gap-1"><FileText size={11} className="shrink-0 mt-0.5"/>{nextSlot.note}</p>}
                </div>
                <div className="text-left">
                  <p className="text-2xl font-bold text-green-600">{totalHours}</p>
                  <p className="text-xs text-gray-400">שעות קרובות</p>
                </div>
              </div>
            </div>
          )}

          {/* Week navigation */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-1">
              <button onClick={prevWeek} className="btn-ghost p-1.5"><ChevronRight size={18}/></button>
              <button onClick={nextWeek} className="btn-ghost p-1.5"><ChevronLeft size={18}/></button>
            </div>
            <span className="font-semibold text-gray-700 text-sm">
              {weekStart.getDate()} {MONTHS_HE[weekStart.getMonth()]} – {weekEnd.getDate()} {MONTHS_HE[weekEnd.getMonth()]} {weekEnd.getFullYear()}
            </span>
            {!isCurrentWeek && (
              <button onClick={goToday} className="text-xs text-green-600 font-medium hover:underline">היום</button>
            )}
            {isCurrentWeek && <div className="w-10"/>}
          </div>

          {/* Week cards */}
          <div className="space-y-2 mb-6">
            {weekDays.map(day => {
              const ds = toDateStr(day);
              const daySlots = weekSlots
                .filter(s => toDateStr(new Date(s.date)) === ds)
                .sort((a,b) => a.startHour - b.startHour);
              const isToday = ds === todayStr;
              const isPast = day < today;

              return (
                <div key={ds} className={`card rounded-2xl overflow-hidden ${
                  isToday ? 'border-green-300' : isPast ? 'opacity-50' : ''
                }`} style={isToday?{borderColor:'#86efac'}:{}}>
                  {/* Day header */}
                  <div className={`px-4 py-2.5 border-b flex items-center justify-between ${
                    isToday ? 'bg-green-50 border-green-100' : 'bg-gray-50 border-gray-100'
                  }`}>
                    <div className="flex items-center gap-2">
                      <span className={`font-bold text-sm ${isToday?'text-green-700':'text-gray-600'}`}>
                        {DAYS_HE[day.getDay()]}
                      </span>
                      <span className={`text-sm ${isToday?'text-green-600':'text-gray-400'}`}>
                        {day.getDate()} {MONTHS_HE[day.getMonth()]}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      {isToday && <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">היום</span>}
                      {daySlots.length > 0 && (
                        <span className="text-xs text-gray-400">{daySlots.length} שיבוצים · {daySlots.reduce((a,s)=>a+(s.endHour-s.startHour),0)} שע'</span>
                      )}
                    </div>
                  </div>

                  {/* Slots or empty */}
                  {daySlots.length === 0 ? (
                    <div className="px-4 py-3 text-sm text-gray-300">אין שיבוצים</div>
                  ) : (
                    <div className="divide-y divide-gray-50">
                      {daySlots.map(s => {
                        const active = isSlotActive(s);
                        const past = isSlotPast(s);
                        return (
                          <div key={s.id} className={`px-4 py-3 ${active?'bg-green-50':''}`}>
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                {active && <span className="w-2 h-2 bg-green-500 rounded-full pulse-dot shrink-0"/>}
                                <span className={`font-medium text-sm ${past?'text-gray-300':active?'text-green-700':'text-gray-700'}`}>
                                  {s.room.name}
                                </span>
                              </div>
                              <span className={`text-sm font-medium ${past?'text-gray-300':active?'text-green-600':'text-green-700'}`}>
                                {hLabel(s.startHour)} – {hLabel(s.endHour)}
                              </span>
                            </div>
                            {s.note && (
                              <p className={`text-xs italic mt-1 flex items-start gap-1 ${past?'text-gray-300':'text-gray-400'}`}>
                                <FileText size={10} className="shrink-0 mt-0.5"/>{s.note}
                              </p>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
