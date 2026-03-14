import React, { useEffect, useState, useCallback } from 'react';
import { getRooms, getSchedule } from '../services/api';
import { RefreshCw, User, Clock, CalendarDays, LayoutGrid, List, X, ChevronLeft, ChevronRight } from 'lucide-react';

const HOURS = [8,9,10,11,12,13,14,15,16,17,18,19,20,21];
const DAYS_HE = ['ראשון','שני','שלישי','רביעי','חמישי','שישי','שבת'];
const MONTHS_HE = ['ינואר','פברואר','מרץ','אפריל','מאי','יוני','יולי','אוגוסט','ספטמבר','אוקטובר','נובמבר','דצמבר'];

function toDateStr(d) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
function hLabel(h) { return `${h}:00`; }
function getNow() {
  const now = new Date();
  return { dateStr: toDateStr(now), hour: now.getHours(), minute: now.getMinutes() };
}
function formatDateHe(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  return `${DAYS_HE[d.getDay()]} ${d.getDate()} ${MONTHS_HE[d.getMonth()]}`;
}

function RoomModal({ room, onClose }) {
  const today = new Date(); today.setHours(0,0,0,0);
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [slots, setSlots] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadSlots = useCallback(async (y, m) => {
    setLoading(true);
    const from = `${y}-${String(m+1).padStart(2,'0')}-01`;
    const lastDay = new Date(y, m+1, 0).getDate();
    const to = `${y}-${String(m+1).padStart(2,'0')}-${String(lastDay).padStart(2,'0')}`;
    try { const s = await getSchedule({ roomId: room.id, from, to }); setSlots(s); }
    finally { setLoading(false); }
  }, [room.id]);

  useEffect(() => { loadSlots(year, month); }, [year, month, loadSlots]);

  const prevMonth = () => { if (month===0){setYear(y=>y-1);setMonth(11);}else setMonth(m=>m-1); };
  const nextMonth = () => { if (month===11){setYear(y=>y+1);setMonth(0);}else setMonth(m=>m+1); };

  const slotsByDate = {};
  slots.forEach((s) => {
    const key = toDateStr(new Date(s.date));
    if (!slotsByDate[key]) slotsByDate[key] = [];
    slotsByDate[key].push(s);
  });

  const firstDay = new Date(year, month, 1);
  const daysInMonth = new Date(year, month+1, 0).getDate();
  const startPad = firstDay.getDay();
  const cells = [];
  for (let i = 0; i < startPad; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const isPrevDisabled = year === today.getFullYear() && month === today.getMonth();

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="glass-strong rounded-2xl w-full max-w-lg max-h-[90vh] flex flex-col fade-in" dir="rtl" onClick={e=>e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
          <div>
            <h2 className="text-lg font-bold text-white">{room.name}</h2>
            <p className="text-xs text-white/40 mt-0.5">שיבוצים לחודש</p>
          </div>
          <button onClick={onClose} className="text-white/40 hover:text-white p-1.5 rounded-lg hover:bg-white/10 transition-colors">
            <X size={20}/>
          </button>
        </div>

        {/* Month nav */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-white/10">
          <button onClick={prevMonth} disabled={isPrevDisabled}
            className="p-1.5 rounded-lg hover:bg-white/10 disabled:opacity-30 transition-colors text-white/70 hover:text-white">
            <ChevronRight size={18}/>
          </button>
          <span className="font-semibold text-white">{MONTHS_HE[month]} {year}</span>
          <button onClick={nextMonth} className="p-1.5 rounded-lg hover:bg-white/10 transition-colors text-white/70 hover:text-white">
            <ChevronLeft size={18}/>
          </button>
        </div>

        <div className="overflow-y-auto flex-1 px-5 py-4">
          {loading ? (
            <div className="text-center text-white/40 py-10">טוען...</div>
          ) : (
            <>
              <div className="grid grid-cols-7 mb-1">
                {DAYS_HE.map((d) => (
                  <div key={d} className="text-center text-xs text-white/30 font-medium py-1">{d.slice(0,1)}</div>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-1 mb-5">
                {cells.map((day, i) => {
                  if (!day) return <div key={`p-${i}`}/>;
                  const d = new Date(year, month, day);
                  const dateStr = toDateStr(d);
                  const isPast = d < today;
                  const isToday = dateStr === toDateStr(today);
                  const hasSlot = !!(slotsByDate[dateStr]?.length);
                  return (
                    <div key={dateStr} className={`rounded-lg py-1.5 text-sm text-center flex flex-col items-center gap-0.5 ${
                      isToday ? 'bg-green-500/30 font-bold text-green-300 ring-1 ring-green-400/50'
                      : isPast ? 'text-white/15'
                      : hasSlot ? 'bg-green-900/40 text-green-300 font-medium'
                      : 'text-white/40'
                    }`}>
                      {day}
                      {hasSlot && <span className={`w-1.5 h-1.5 rounded-full ${isToday?'bg-green-300':'bg-green-500'}`}/>}
                    </div>
                  );
                })}
              </div>

              {Object.keys(slotsByDate).length === 0 ? (
                <p className="text-center text-white/30 text-sm py-4">אין שיבוצים בחודש זה</p>
              ) : (
                <div className="space-y-3">
                  {Object.keys(slotsByDate).sort().map((dateStr) => {
                    const d = new Date(dateStr + 'T00:00:00');
                    const isPast = d < today;
                    return (
                      <div key={dateStr}>
                        <div className={`text-xs font-semibold mb-1.5 ${isPast?'text-white/25':'text-green-300'}`}>
                          {formatDateHe(dateStr)}
                        </div>
                        <div className="space-y-1">
                          {slotsByDate[dateStr].sort((a,b)=>a.startHour-b.startHour).map((s) => (
                            <div key={s.id} className={`flex items-center justify-between rounded-xl px-3 py-2 ${
                              isPast ? 'bg-white/5 border border-white/5' : 'bg-green-900/40 border border-green-700/30'
                            }`}>
                              <div className="flex items-center gap-2">
                                <User size={13} className={isPast?'text-white/20':'text-green-400'}/>
                                <span className={`text-sm font-medium ${isPast?'text-white/30':'text-white'}`}>{s.therapist.name}</span>
                              </div>
                              <span className={`text-xs font-medium ${isPast?'text-white/20':'text-green-400'}`}>
                                {hLabel(s.startHour)} – {hLabel(s.endHour)}
                              </span>
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
        </div>
      </div>
    </div>
  );
}

function RoomCard({ room, slots, onClick, index }) {
  const { dateStr, hour, minute } = getNow();
  const nowDecimal = hour + minute / 60;
  const todaySlots = slots.filter((s) => s.roomId===room.id && toDateStr(new Date(s.date))===dateStr).sort((a,b)=>a.startHour-b.startHour);
  const active = todaySlots.find((s) => nowDecimal>=s.startHour && nowDecimal<s.endHour);
  const next = !active ? todaySlots.find((s) => s.startHour>hour) : null;
  const isActive = !!active;

  return (
    <button onClick={onClick}
      className={`w-full text-right rounded-2xl p-5 border transition-all duration-200 hover:shadow-xl hover:shadow-black/30 hover:-translate-y-0.5 active:translate-y-0 fade-in-delay-${Math.min(index,3)} ${
        isActive ? 'room-active glass' : 'glass hover:border-white/20'
      }`}
    >
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-base font-semibold text-white">{room.name}</h3>
        <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
          isActive
            ? 'bg-green-400/20 text-green-300 ring-1 ring-green-400/30'
            : 'bg-white/8 text-white/40 ring-1 ring-white/10'
        }`}>
          {isActive ? (
            <span className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 bg-green-400 rounded-full pulse-green inline-block"/>פעיל
            </span>
          ) : 'פנוי'}
        </span>
      </div>

      {active && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-white">
            <User size={14} className="text-green-400 shrink-0"/>
            <span className="font-semibold">{active.therapist.name}</span>
          </div>
          <div className="flex items-center gap-2 text-white/50 text-sm">
            <Clock size={12} className="shrink-0"/>
            <span>{hLabel(active.startHour)} – {hLabel(active.endHour)}</span>
          </div>
        </div>
      )}
      {!active && next && (
        <div className="space-y-2">
          <div className="flex items-center gap-1.5 text-white/40 text-xs">
            <CalendarDays size={12} className="shrink-0"/><span>הבא היום:</span>
          </div>
          <div className="flex items-center gap-2 text-white/80">
            <User size={14} className="text-green-500/70 shrink-0"/>
            <span className="font-medium">{next.therapist.name}</span>
          </div>
          <div className="flex items-center gap-2 text-green-400/70 text-sm">
            <Clock size={12} className="shrink-0"/>
            <span>{hLabel(next.startHour)} – {hLabel(next.endHour)}</span>
          </div>
        </div>
      )}
      {!active && !next && <p className="text-white/30 text-sm">אין שיבוץ היום</p>}
      <p className="text-xs text-white/20 mt-3 border-t border-white/5 pt-3">לחץ לצפייה בלוח החודשי ←</p>
    </button>
  );
}

function TimelineView({ rooms, slots }) {
  const { dateStr, hour, minute } = getNow();
  const nowDecimal = hour + minute / 60;
  const totalHours = HOURS[HOURS.length-1]+1-HOURS[0];

  const todayRooms = rooms.map((room) => ({
    ...room,
    daySlots: slots.filter((s) => s.roomId===room.id && toDateStr(new Date(s.date))===dateStr).sort((a,b)=>a.startHour-b.startHour),
  }));

  return (
    <div className="glass rounded-2xl overflow-hidden fade-in">
      <div className="flex border-b border-white/10 bg-white/5">
        <div className="w-28 shrink-0 px-4 py-2.5 text-xs text-white/40 font-medium">חדר</div>
        <div className="flex-1 relative h-9">
          {HOURS.map((h) => (
            <div key={h} className="absolute top-0 text-xs text-white/30 -translate-x-1/2"
              style={{ left:`${((h-HOURS[0])/totalHours)*100}%` }}>
              <div className="h-2 border-r border-white/10 mx-auto w-px mb-0.5"/>
              {hLabel(h)}
            </div>
          ))}
        </div>
      </div>
      {todayRooms.map((room, ri) => (
        <div key={room.id} className={`flex items-center border-b border-white/5 last:border-0 ${ri%2===0?'':'bg-white/3'}`}>
          <div className="w-28 shrink-0 px-4 py-3 text-sm font-medium text-white/70 truncate">{room.name}</div>
          <div className="flex-1 relative h-10 my-1">
            {nowDecimal>=HOURS[0] && nowDecimal<=HOURS[HOURS.length-1]+1 && (
              <div className="absolute top-0 bottom-0 w-0.5 bg-green-400/70 z-10 shadow-sm shadow-green-400/50"
                style={{ left:`${((nowDecimal-HOURS[0])/totalHours)*100}%` }}/>
            )}
            {room.daySlots.map((s) => {
              const left = ((s.startHour-HOURS[0])/totalHours)*100;
              const width = ((s.endHour-s.startHour)/totalHours)*100;
              const isNow = nowDecimal>=s.startHour && nowDecimal<s.endHour;
              return (
                <div key={s.id}
                  className={`absolute top-1 bottom-1 rounded-lg flex items-center px-2 text-xs font-medium overflow-hidden ${
                    isNow ? 'bg-gradient-to-r from-green-500 to-green-400 text-white shadow-md shadow-green-900/50'
                    : s.startHour > nowDecimal ? 'bg-green-900/60 text-green-300 border border-green-700/40'
                    : 'bg-white/8 text-white/30 border border-white/5'
                  }`}
                  style={{ left:`${left}%`, width:`${width}%` }}
                  title={`${s.therapist.name} ${hLabel(s.startHour)}–${hLabel(s.endHour)}`}
                >
                  <span className="truncate">{s.therapist.name}</span>
                </div>
              );
            })}
            {room.daySlots.length===0 && (
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-dashed border-white/5"/>
              </div>
            )}
          </div>
        </div>
      ))}
      <div className="flex gap-5 px-4 py-2.5 border-t border-white/10 bg-white/3 text-xs text-white/30">
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-green-400 inline-block"/> פעיל עכשיו</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-green-900/60 border border-green-700/40 inline-block"/> הבא</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-white/8 border border-white/5 inline-block"/> עבר</span>
        <span className="flex items-center gap-1.5"><span className="w-0.5 h-3 bg-green-400/70 inline-block"/> עכשיו</span>
      </div>
    </div>
  );
}

function WhoIsIn({ slots }) {
  const { dateStr, hour, minute } = getNow();
  const nowDecimal = hour + minute / 60;
  const activeSlots = slots.filter((s) => toDateStr(new Date(s.date))===dateStr && nowDecimal>=s.startHour && nowDecimal<s.endHour);
  if (activeSlots.length===0) return null;
  return (
    <div className="glass rounded-2xl p-4 mb-6 border-green-500/20 fade-in" style={{borderColor:'rgba(74,222,128,0.2)'}}>
      <h2 className="text-sm font-semibold text-green-300 mb-3 flex items-center gap-2">
        <span className="w-2 h-2 bg-green-400 rounded-full pulse-green inline-block"/>
        בבניין עכשיו ({activeSlots.length})
      </h2>
      <div className="flex flex-wrap gap-2">
        {activeSlots.map((s) => (
          <div key={s.id} className="flex items-center gap-2 bg-green-900/40 border border-green-700/30 rounded-xl px-3 py-1.5">
            <User size={13} className="text-green-400"/>
            <span className="text-sm font-medium text-white">{s.therapist.name}</span>
            <span className="text-xs text-white/40">{s.room.name}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const [rooms, setRooms] = useState([]);
  const [slots, setSlots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [view, setView] = useState('grid');
  const [modalRoom, setModalRoom] = useState(null);

  const fetchData = async () => {
    try {
      const today = new Date();
      const [r, s] = await Promise.all([getRooms(), getSchedule({ date: toDateStr(today) })]);
      setRooms(r); setSlots(s); setLastUpdated(new Date());
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 60000);
    return () => clearInterval(interval);
  }, []);

  const { dateStr, hour, minute } = getNow();
  const nowDecimal = hour + minute / 60;
  const activeRoomCount = new Set(
    slots.filter((s) => toDateStr(new Date(s.date))===dateStr && nowDecimal>=s.startHour && nowDecimal<s.endHour).map((s)=>s.roomId)
  ).size;
  const now = new Date();

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-8 fade-in">
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight">דשבורד</h1>
          <p className="text-white/50 text-sm mt-1">
            {DAYS_HE[now.getDay()]} {now.getDate()} {MONTHS_HE[now.getMonth()]} ·{' '}
            <span className="text-green-400">{activeRoomCount}</span> מתוך {rooms.length} חדרים פעילים
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex glass rounded-xl p-1 gap-0.5">
            <button onClick={() => setView('grid')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                view==='grid' ? 'bg-green-600/40 text-green-300 shadow-sm' : 'text-white/40 hover:text-white/70'
              }`}>
              <LayoutGrid size={15}/> כרטיסים
            </button>
            <button onClick={() => setView('timeline')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                view==='timeline' ? 'bg-green-600/40 text-green-300 shadow-sm' : 'text-white/40 hover:text-white/70'
              }`}>
              <List size={15}/> ציר זמן
            </button>
          </div>
          <button onClick={fetchData}
            className="flex items-center gap-1.5 text-sm text-white/30 hover:text-white/60 px-2 py-2 rounded-lg hover:bg-white/10 transition-colors">
            <RefreshCw size={14}/>
            {lastUpdated && lastUpdated.toLocaleTimeString('he-IL', { hour:'2-digit', minute:'2-digit' })}
          </button>
        </div>
      </div>

      {loading ? (
        <div className="text-center text-white/40 py-20">טוען...</div>
      ) : (
        <>
          <WhoIsIn slots={slots}/>
          {view==='grid' ? (
            rooms.length===0
              ? <div className="text-center text-white/30 py-20">אין חדרים. הוסף חדרים בפאנל המנהל.</div>
              : <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {rooms.map((room, i) => (
                    <RoomCard key={room.id} room={room} slots={slots} index={i} onClick={() => setModalRoom(room)}/>
                  ))}
                </div>
          ) : (
            <TimelineView rooms={rooms} slots={slots}/>
          )}
        </>
      )}
      {modalRoom && <RoomModal room={modalRoom} onClose={() => setModalRoom(null)}/>}
    </div>
  );
}
