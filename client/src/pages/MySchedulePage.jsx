import React, { useEffect, useState } from 'react';
import { getTherapists, getSchedule } from '../services/api';
import { Clock, MapPin, FileText, User, ChevronLeft, ChevronRight } from 'lucide-react';

const DAYS_HE = ['ראשון','שני','שלישי','רביעי','חמישי','שישי','שבת'];
const MONTHS_HE = ['ינואר','פברואר','מרץ','אפריל','מאי','יוני','יולי','אוגוסט','ספטמבר','אוקטובר','נובמבר','דצמבר'];
const HOURS = [8,9,10,11,12,13,14,15,16,17,18,19,20,21,22];
const DAY_START = 8;
const DAY_END = 22;
const TOTAL_HOURS = DAY_END - DAY_START;

function toDateStr(d) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
function hLabel(h) { return `${h}:00`; }
function startOfMonth(y, m) { return new Date(y, m, 1); }
function daysInMonth(y, m) { return new Date(y, m+1, 0).getDate(); }

export default function MySchedulePage() {
  const [therapists, setTherapists] = useState([]);
  const [selectedId, setSelectedId] = useState('');
  const [slots, setSlots] = useState([]);
  const [loading, setLoading] = useState(false);
  const now = new Date();
  const [viewYear, setViewYear] = useState(now.getFullYear());
  const [viewMonth, setViewMonth] = useState(now.getMonth());

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
  const currentHour = now.getHours();

  const prevMonth = () => { if (viewMonth===0){setViewYear(y=>y-1);setViewMonth(11);}else setViewMonth(m=>m-1); };
  const nextMonth = () => { if (viewMonth===11){setViewYear(y=>y+1);setViewMonth(0);}else setViewMonth(m=>m+1); };
  const goNow = () => { setViewYear(now.getFullYear()); setViewMonth(now.getMonth()); };
  const isCurrentMonth = viewYear===now.getFullYear() && viewMonth===now.getMonth();

  // Month slots — only days that have slots
  const monthSlots = slots.filter(s => {
    const d = new Date(s.date);
    return d.getFullYear()===viewYear && d.getMonth()===viewMonth;
  });
  const slotsByDay = {};
  monthSlots.forEach(s => {
    const ds = toDateStr(new Date(s.date));
    if (!slotsByDay[ds]) slotsByDay[ds] = [];
    slotsByDay[ds].push(s);
  });
  const activeDays = Object.keys(slotsByDay).sort();

  // Stats for month
  const monthHours = monthSlots.reduce((a,s)=>a+(s.endHour-s.startHour),0);

  // Next upcoming slot
  const nextSlot = slots
    .filter(s => {
      const sd = toDateStr(new Date(s.date));
      if (sd > todayStr) return true;
      if (sd === todayStr) return s.endHour > currentHour;
      return false;
    })
    .sort((a,b) => {
      const da=toDateStr(new Date(a.date)), db=toDateStr(new Date(b.date));
      return da!==db?(da<db?-1:1):a.startHour-b.startHour;
    })[0];

  function formatNextDate(ds) {
    if (ds===todayStr) return 'היום';
    const d = new Date(ds+'T00:00:00');
    const diff = Math.round((d-today)/(1000*60*60*24));
    if (diff===1) return 'מחר';
    return `${DAYS_HE[d.getDay()]} ${d.getDate()} ${MONTHS_HE[d.getMonth()]}`;
  }

  function slotStatus(s) {
    const sd = toDateStr(new Date(s.date));
    if (sd < todayStr) return 'past';
    if (sd === todayStr && s.endHour <= currentHour) return 'past';
    if (sd === todayStr && currentHour >= s.startHour && currentHour < s.endHour) return 'active';
    return 'future';
  }

  // Color per slot (cycle through palette for multiple slots same day)
  const COLORS = [
    {bg:'bg-green-500',light:'bg-green-100',text:'text-green-700',border:'border-green-300'},
    {bg:'bg-blue-500',light:'bg-blue-100',text:'text-blue-700',border:'border-blue-300'},
    {bg:'bg-purple-500',light:'bg-purple-100',text:'text-purple-700',border:'border-purple-300'},
    {bg:'bg-orange-500',light:'bg-orange-100',text:'text-orange-700',border:'border-orange-300'},
  ];

  return (
    <div className="max-w-2xl mx-auto fade-up" dir="rtl">
      {/* Therapist selector */}
      <div className="relative mb-5">
        <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none">
          <User size={17} className="text-green-500"/>
        </div>
        <select
          className="input pr-10 pl-8 text-base font-medium appearance-none cursor-pointer" style={{paddingRight:'2.5rem'}}
          value={selectedId}
          onChange={e => setSelectedId(e.target.value)}
        >
          <option value="">-- בחר את שמך --</option>
          {therapists.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
        <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none text-gray-400 text-xs">▾</div>
      </div>

      {!selectedId && (
        <div className="card rounded-2xl p-12 text-center">
          <User size={40} className="mx-auto mb-3 text-gray-200"/>
          <p className="text-gray-400">בחר שם מהרשימה לצפייה בשיבוצים</p>
        </div>
      )}

      {selectedId && loading && <div className="text-center text-gray-400 py-16">טוען...</div>}

      {selectedId && !loading && (
        <>
          {/* Next slot hero */}
          {nextSlot && (
            <div className="rounded-2xl p-4 mb-5 fade-up border" style={{background:'linear-gradient(135deg,#f0fdf4,#dcfce7)',borderColor:'#86efac'}}>
              <p className="text-xs font-bold text-green-700 mb-2 flex items-center gap-1.5">
                <span className="w-2 h-2 bg-green-500 rounded-full pulse-dot inline-block"/>
                השיבוץ הקרוב שלך
              </p>
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  <p className="text-xl font-bold text-gray-800">{formatNextDate(toDateStr(new Date(nextSlot.date)))}</p>
                  <div className="flex flex-wrap gap-3 mt-1.5 text-sm text-gray-600">
                    <span className="flex items-center gap-1"><Clock size={13} className="text-green-500"/>{hLabel(nextSlot.startHour)} – {hLabel(nextSlot.endHour)}</span>
                    <span className="flex items-center gap-1"><MapPin size={13} className="text-green-500"/>{nextSlot.room.name}</span>
                  </div>
                  {nextSlot.note && (
                    <p className="text-xs text-gray-500 italic mt-1.5 flex items-start gap-1">
                      <FileText size={11} className="shrink-0 mt-0.5 text-green-400"/>{nextSlot.note}
                    </p>
                  )}
                </div>
                <div className="text-center shrink-0 bg-white/60 rounded-xl px-3 py-2 border border-green-200">
                  <p className="text-2xl font-bold text-green-600">{monthHours}</p>
                  <p className="text-xs text-gray-400 whitespace-nowrap">שע' ב{MONTHS_HE[viewMonth]}</p>
                </div>
              </div>
            </div>
          )}

          {/* Month nav */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-1">
              <button onClick={prevMonth} className="btn-ghost p-1.5"><ChevronRight size={18}/></button>
              <button onClick={nextMonth} className="btn-ghost p-1.5"><ChevronLeft size={18}/></button>
            </div>
            <h2 className="font-bold text-gray-800 text-base">{MONTHS_HE[viewMonth]} {viewYear}</h2>
            {!isCurrentMonth
              ? <button onClick={goNow} className="text-xs text-green-600 font-semibold hover:underline">החודש</button>
              : <div className="w-12"/>
            }
          </div>

          {/* Days with slots — timeline per day */}
          {activeDays.length === 0 ? (
            <div className="card rounded-2xl p-8 text-center text-gray-400">
              <p className="font-medium">אין שיבוצים ב{MONTHS_HE[viewMonth]}</p>
            </div>
          ) : (
            <div className="space-y-3">
              {activeDays.map(ds => {
                const d = new Date(ds+'T00:00:00');
                const daySlots = slotsByDay[ds].sort((a,b)=>a.startHour-b.startHour);
                const isPast = d < today;
                const isToday = ds === todayStr;
                const dayHours = daySlots.reduce((a,s)=>a+(s.endHour-s.startHour),0);

                return (
                  <div key={ds} className={`card rounded-2xl overflow-hidden ${isToday?'border-green-300':''}  ${isPast?'opacity-60':''}`}
                    style={isToday?{borderColor:'#86efac'}:{}}>
                    {/* Day header */}
                    <div className={`px-4 py-2.5 border-b flex items-center justify-between ${isToday?'bg-green-50 border-green-100':'bg-gray-50 border-gray-100'}`}>
                      <div className="flex items-center gap-2">
                        <span className={`font-bold text-sm ${isToday?'text-green-700':'text-gray-700'}`}>{DAYS_HE[d.getDay()]}</span>
                        <span className={`text-sm ${isToday?'text-green-600':'text-gray-400'}`}>{d.getDate()} {MONTHS_HE[d.getMonth()]}</span>
                        {isToday && <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-semibold">היום</span>}
                      </div>
                      <span className="text-xs text-gray-400">{daySlots.length} שיבוצים · {dayHours} שע'</span>
                    </div>

                    {/* Timeline bar */}
                    <div className="px-4 pt-3 pb-1">
                      <div className="relative h-8 rounded-lg bg-gray-100 overflow-hidden" dir="ltr">
                        {/* Hour ticks */}
                        {HOURS.map(h => (
                          <div key={h} className="absolute top-0 bottom-0 w-px bg-gray-200"
                            style={{left:`${((h-DAY_START)/TOTAL_HOURS)*100}%`}}/>
                        ))}
                        {/* Slot blocks */}
                        {daySlots.map((s,i) => {
                          const status = slotStatus(s);
                          const left = ((s.startHour-DAY_START)/TOTAL_HOURS)*100;
                          const width = ((s.endHour-s.startHour)/TOTAL_HOURS)*100;
                          const col = COLORS[i % COLORS.length];
                          return (
                            <div key={s.id}
                              className={`absolute top-0.5 bottom-0.5 rounded-md flex items-center justify-center text-xs font-medium text-white overflow-hidden ${
                                status==='past'?'bg-gray-300':col.bg
                              }`}
                              style={{left:`${left}%`,width:`${width}%`}}
                              title={`${hLabel(s.startHour)}–${hLabel(s.endHour)}`}
                            >
                              {width>20 && <span className="truncate px-1 text-[10px] font-medium">{hLabel(s.startHour)}–{hLabel(s.endHour)}</span>}
                            </div>
                          );
                        })}
                        {/* Now line */}
                        {isToday && currentHour>=DAY_START && currentHour<=DAY_END && (
                          <div className="absolute top-0 bottom-0 w-0.5 bg-red-400 z-10"
                            style={{left:`${((currentHour-DAY_START)/TOTAL_HOURS)*100}%`}}/>
                        )}
                      </div>
                      {/* Hour labels */}
                      <div className="flex justify-between mt-0.5 px-0.5" dir="ltr">
                        {[8,10,12,14,16,18,20,22].map(h=>(
                          <span key={h} className="text-gray-300" style={{fontSize:'9px'}}>{h}</span>
                        ))}
                      </div>
                    </div>

                    {/* Slot details */}
                    <div className="divide-y divide-gray-50 mt-1">
                      {daySlots.map((s,i) => {
                        const status = slotStatus(s);
                        const col = COLORS[i % COLORS.length];
                        return (
                          <div key={s.id} className={`px-4 py-2.5 flex gap-3 items-start ${status==='active'?'bg-green-50':''}`}>
                            <div className={`w-2.5 h-2.5 rounded-sm mt-1 shrink-0 ${status==='past'?'bg-gray-300':col.bg} ${status==='active'?'pulse-dot':''}`}/>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between gap-2">
                                <span className={`font-medium text-sm ${status==='past'?'text-gray-400':'text-gray-700'}`}>{s.room.name}</span>
                                <span className={`text-sm font-semibold shrink-0 ${status==='past'?'text-gray-300':status==='active'?'text-green-600':col.text}`}>
                                  {hLabel(s.startHour)} – {hLabel(s.endHour)}
                                </span>
                              </div>
                              {s.note && (
                                <p className={`text-xs italic mt-0.5 flex items-start gap-1 ${status==='past'?'text-gray-300':'text-gray-400'}`}>
                                  <FileText size={10} className="shrink-0 mt-0.5"/>{s.note}
                                </p>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
