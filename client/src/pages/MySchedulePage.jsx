import React, { useEffect, useState, useMemo } from 'react';
import { getTherapists, getSchedule } from '../services/api';
import { User, CalendarDays, Clock, ChevronDown } from 'lucide-react';

const DAYS_HE = ['ראשון','שני','שלישי','רביעי','חמישי','שישי','שבת'];
const MONTHS_HE = ['ינואר','פברואר','מרץ','אפריל','מאי','יוני','יולי','אוגוסט','ספטמבר','אוקטובר','נובמבר','דצמבר'];

function toDateStr(d) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
function hLabel(h) { return `${h}:00`; }
function formatDateFull(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  return `${DAYS_HE[d.getDay()]}, ${d.getDate()} ${MONTHS_HE[d.getMonth()]} ${d.getFullYear()}`;
}
function isToday(dateStr) {
  return dateStr === toDateStr(new Date());
}
function isFuture(dateStr) {
  return new Date(dateStr + 'T00:00:00') >= new Date(toDateStr(new Date()) + 'T00:00:00');
}

export default function MySchedulePage() {
  const [therapists, setTherapists] = useState([]);
  const [selectedId, setSelectedId] = useState('');
  const [slots, setSlots] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState('upcoming'); // 'upcoming' | 'all'

  useEffect(() => {
    getTherapists().then(setTherapists);
    // Restore last selected therapist from localStorage
    const saved = localStorage.getItem('myScheduleTherapistId');
    if (saved) setSelectedId(saved);
  }, []);

  useEffect(() => {
    if (!selectedId) { setSlots([]); return; }
    localStorage.setItem('myScheduleTherapistId', selectedId);
    setLoading(true);
    const today = new Date();
    const from = toDateStr(today);
    const to = new Date(today); to.setFullYear(today.getFullYear() + 1);
    getSchedule({ from, to: toDateStr(to) })
      .then(all => setSlots(all.filter(s => s.therapistId === parseInt(selectedId))))
      .finally(() => setLoading(false));
  }, [selectedId]);

  // Group by date
  const grouped = useMemo(() => {
    const filtered = filter === 'upcoming'
      ? slots.filter(s => isFuture(toDateStr(new Date(s.date))))
      : slots;
    const map = {};
    filtered.forEach(s => {
      const key = toDateStr(new Date(s.date));
      if (!map[key]) map[key] = [];
      map[key].push(s);
    });
    return Object.keys(map).sort().map(date => ({ date, slots: map[date].sort((a,b) => a.startHour - b.startHour) }));
  }, [slots, filter]);

  const therapistName = therapists.find(t => t.id === parseInt(selectedId))?.name;

  // Stats
  const totalHours = slots
    .filter(s => isFuture(toDateStr(new Date(s.date))))
    .reduce((acc, s) => acc + (s.endHour - s.startHour), 0);
  const totalSessions = slots.filter(s => isFuture(toDateStr(new Date(s.date)))).length;

  return (
    <div className="max-w-2xl mx-auto fade-up">
      <h1 className="section-title mb-1">השיבוצים שלי</h1>
      <p className="text-gray-400 text-sm mb-6">בחר שם לצפייה בכל השיבוצים</p>

      {/* Therapist selector */}
      <div className="relative mb-6">
        <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none">
          <User size={18} className="text-green-500" />
        </div>
        <select
          className="input pr-10 pl-10 text-base font-medium appearance-none cursor-pointer"
          value={selectedId}
          onChange={e => setSelectedId(e.target.value)}
        >
          <option value="">-- בחר את שמך --</option>
          {therapists.map(t => (
            <option key={t.id} value={t.id}>{t.name}</option>
          ))}
        </select>
        <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
          <ChevronDown size={16} className="text-gray-400" />
        </div>
      </div>

      {selectedId && !loading && (
        <>
          {/* Stats bar */}
          <div className="grid grid-cols-2 gap-3 mb-5">
            <div className="card rounded-2xl p-4 text-center">
              <div className="text-2xl font-bold text-green-600">{totalSessions}</div>
              <div className="text-xs text-gray-400 mt-0.5">שיבוצים קרובים</div>
            </div>
            <div className="card rounded-2xl p-4 text-center">
              <div className="text-2xl font-bold text-green-600">{totalHours}</div>
              <div className="text-xs text-gray-400 mt-0.5">שעות קרובות</div>
            </div>
          </div>

          {/* Filter toggle */}
          <div className="flex bg-gray-100 rounded-xl p-1 mb-5 w-fit">
            <button
              onClick={() => setFilter('upcoming')}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${filter==='upcoming'?'bg-white shadow-sm text-gray-800':'text-gray-400 hover:text-gray-600'}`}
            >
              קרובים
            </button>
            <button
              onClick={() => setFilter('all')}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${filter==='all'?'bg-white shadow-sm text-gray-800':'text-gray-400 hover:text-gray-600'}`}
            >
              הכל
            </button>
          </div>

          {/* Schedule list */}
          {grouped.length === 0 ? (
            <div className="card rounded-2xl p-10 text-center text-gray-400">
              <CalendarDays size={32} className="mx-auto mb-3 text-gray-200" />
              <p className="font-medium">אין שיבוצים</p>
              <p className="text-sm mt-1">עבור ללוח השיבוצים כדי להירשם</p>
            </div>
          ) : (
            <div className="space-y-3">
              {grouped.map(({ date, slots: daySlots }) => {
                const today = isToday(date);
                return (
                  <div key={date} className={`card rounded-2xl overflow-hidden ${today ? 'border-green-300' : ''}`}
                    style={today ? {borderColor:'#86efac'} : {}}>
                    {/* Date header */}
                    <div className={`px-4 py-2.5 border-b flex items-center justify-between ${
                      today ? 'bg-green-50 border-green-100' : 'bg-gray-50 border-gray-100'
                    }`}>
                      <div className="flex items-center gap-2">
                        <CalendarDays size={14} className={today ? 'text-green-500' : 'text-gray-400'} />
                        <span className={`font-semibold text-sm ${today ? 'text-green-700' : 'text-gray-700'}`}>
                          {formatDateFull(date)}
                        </span>
                      </div>
                      {today && (
                        <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">היום</span>
                      )}
                    </div>
                    {/* Slots */}
                    <div className="divide-y divide-gray-50">
                      {daySlots.map(s => (
                        <div key={s.id} className="flex items-center justify-between px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className={`w-2 h-2 rounded-full ${today ? 'bg-green-400' : 'bg-gray-300'}`} />
                            <span className="text-sm font-medium text-gray-700">{s.room.name}</span>
                          </div>
                          <div className="flex items-center gap-1.5 text-sm text-green-600 font-medium">
                            <Clock size={13} className="text-gray-400" />
                            {hLabel(s.startHour)} – {hLabel(s.endHour)}
                            <span className="text-xs text-gray-400 mr-1">
                              ({s.endHour - s.startHour} שע')
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {loading && (
        <div className="text-center text-gray-400 py-16">טוען...</div>
      )}

      {!selectedId && (
        <div className="card rounded-2xl p-12 text-center text-gray-300">
          <User size={40} className="mx-auto mb-3 text-gray-200" />
          <p className="font-medium text-gray-400">בחר שם מהרשימה</p>
          <p className="text-sm mt-1">כדי לראות את השיבוצים שלך</p>
        </div>
      )}
    </div>
  );
}
