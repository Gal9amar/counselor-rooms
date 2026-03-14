import React, { useEffect, useState, useMemo } from 'react';
import { getRooms, getTherapists, getSchedule, bookSlot } from '../services/api';
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react';

const DAYS_HE = ['ראשון','שני','שלישי','רביעי','חמישי','שישי','שבת'];
const MONTHS_HE = ['ינואר','פברואר','מרץ','אפריל','מאי','יוני','יולי','אוגוסט','ספטמבר','אוקטובר','נובמבר','דצמבר'];
const ALL_HOURS = [8,9,10,11,12,13,14,15,16,17,18,19,20,21];

function toDateStr(d) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
function hLabel(h) { return `${h}:00`; }
function formatDateHe(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  return `${DAYS_HE[d.getDay()]} ${d.getDate()} ${MONTHS_HE[d.getMonth()]} ${d.getFullYear()}`;
}

function MonthCalendar({ year, month, onSelectDate, slotDates, selectedDate }) {
  const today = new Date(); today.setHours(0,0,0,0);
  const daysInMonth = new Date(year, month+1, 0).getDate();
  const startPad = new Date(year, month, 1).getDay();
  const cells = [];
  for (let i = 0; i < startPad; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  return (
    <div>
      <div className="grid grid-cols-7 mb-1">
        {DAYS_HE.map((d) => (
          <div key={d} className="text-center text-xs text-white/30 font-medium py-1">{d.slice(0,1)}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {cells.map((day, i) => {
          if (!day) return <div key={`p-${i}`}/>;
          const d = new Date(year, month, day);
          const dateStr = toDateStr(d);
          const isPast = d < today;
          const isToday = dateStr === toDateStr(today);
          const isSelected = dateStr === selectedDate;
          const hasSlot = slotDates.has(dateStr);
          return (
            <button key={dateStr} disabled={isPast} onClick={() => !isPast && onSelectDate(dateStr)}
              className={`relative rounded-xl py-2 text-sm font-medium transition-all flex flex-col items-center gap-0.5 ${
                isSelected ? 'bg-green-500 text-white shadow-lg shadow-green-900/50 ring-2 ring-green-400/50'
                : isToday ? 'bg-green-500/20 text-green-300 font-bold ring-1 ring-green-500/30'
                : isPast ? 'text-white/15 cursor-not-allowed'
                : hasSlot ? 'bg-green-900/50 text-green-300 border border-green-700/30'
                : 'text-white/50 hover:bg-white/8 hover:text-white'
              }`}
            >
              {day}
              {hasSlot && !isPast && (
                <span className={`w-1.5 h-1.5 rounded-full ${isSelected?'bg-white':'bg-green-400'}`}/>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default function SchedulePage() {
  const today = new Date(); today.setHours(0,0,0,0);
  const currentYear = today.getFullYear();

  const [rooms, setRooms] = useState([]);
  const [therapists, setTherapists] = useState([]);
  const [allSlots, setAllSlots] = useState([]);
  const [loading, setLoading] = useState(true);

  const [step, setStep] = useState('room');
  const [selectedRoom, setSelectedRoom] = useState(null);
  const [selectedDate, setSelectedDate] = useState(null);
  const [daySlots, setDaySlots] = useState([]);

  const [years, setYears] = useState([currentYear]);
  const [filterYear, setFilterYear] = useState(currentYear);
  const [filterMonth, setFilterMonth] = useState(null);

  const [startHour, setStartHour] = useState(null);
  const [endHour, setEndHour] = useState('');
  const [selectedTherapist, setSelectedTherapist] = useState('');
  const [booking, setBooking] = useState(false);
  const [bookError, setBookError] = useState('');

  useEffect(() => {
    Promise.all([getRooms(), getTherapists()]).then(([r,t]) => { setRooms(r); setTherapists(t); setLoading(false); });
  }, []);

  const loadRoomSlots = async (roomId, yr) => {
    const y = yr || Math.min(...years);
    const mx = yr || Math.max(...years);
    const s = await getSchedule({ roomId, from:`${y}-01-01`, to:`${mx}-12-31` });
    setAllSlots(s);
  };

  const handleSelectRoom = async (room) => {
    setSelectedRoom(room); setStep('date'); setSelectedDate(null);
    const s = await getSchedule({ roomId:room.id, from:`${currentYear}-01-01`, to:`${currentYear}-12-31` });
    setAllSlots(s);
  };

  const handleSelectDate = async (dateStr) => {
    setSelectedDate(dateStr); setStep('hour');
    const s = await getSchedule({ roomId:selectedRoom.id, date:dateStr });
    setDaySlots(s);
    setStartHour(null); setEndHour(''); setBookError('');
  };

  const handleAddYear = async () => {
    const nextYear = Math.max(...years)+1;
    setYears(prev=>[...prev,nextYear]); setFilterYear(nextYear); setFilterMonth(null);
    const s = await getSchedule({ roomId:selectedRoom.id, from:`${nextYear}-01-01`, to:`${nextYear}-12-31` });
    setAllSlots(prev=>[...prev,...s]);
  };

  const slotDates = useMemo(() => {
    const set = new Set();
    allSlots.forEach(s=>set.add(toDateStr(new Date(s.date))));
    return set;
  }, [allSlots]);

  const monthsToShow = useMemo(() => filterMonth!==null ? [filterMonth] : Array.from({length:12},(_,i)=>i), [filterMonth]);

  const back = () => {
    if (step==='hour'){setStep('date');setStartHour(null);setEndHour('');setBookError('');}
    else if (step==='date'){setStep('room');setSelectedRoom(null);setAllSlots([]);}
  };

  const occupiedHours = new Set();
  daySlots.forEach(s=>{ for(let h=s.startHour;h<s.endHour;h++) occupiedHours.add(h); });

  const handleBook = async () => {
    const end = parseInt(endHour);
    if (!end||end<=startHour){setBookError('שעת סיום לא תקינה');return;}
    if (!selectedTherapist){setBookError('בחר שם');return;}
    if (daySlots.some(s=>startHour<s.endHour&&end>s.startHour)){setBookError('קיים חופף');return;}
    setBooking(true); setBookError('');
    try {
      const slot = await bookSlot(selectedRoom.id,selectedDate,startHour,end,parseInt(selectedTherapist));
      setDaySlots(prev=>[...prev,slot]); setAllSlots(prev=>[...prev,slot]);
      setStartHour(null); setEndHour(''); setSelectedTherapist('');
    } catch(e){ setBookError(e.response?.data?.error||'שגיאה'); }
    finally { setBooking(false); }
  };

  if (loading) return <div className="text-center text-white/40 py-20">טוען...</div>;

  return (
    <div className="max-w-3xl mx-auto">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-white/30 mb-4 flex-wrap fade-in">
        <span className={step==='room'?'font-bold text-green-400':''}> בחר חדר</span>
        <ChevronLeft size={13}/>
        <span className={step==='date'?'font-bold text-green-400':step==='hour'?'text-white/60':''}>{selectedRoom?.name||'בחר תאריך'}</span>
        <ChevronLeft size={13}/>
        <span className={step==='hour'?'font-bold text-green-400':''}>{selectedDate?formatDateHe(selectedDate):'בחר שעה'}</span>
      </div>

      {step!=='room' && (
        <button onClick={back} className="mb-5 text-sm text-green-400 hover:text-green-300 flex items-center gap-1 transition-colors">
          <ChevronRight size={14}/> חזור
        </button>
      )}

      {/* STEP 1: Room */}
      {step==='room' && (
        <div className="fade-in">
          <h1 className="text-3xl font-bold text-white mb-2">לוח שיבוצים</h1>
          <p className="text-white/40 text-sm mb-6">בחר חדר לשיבוץ</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {rooms.map((room,i) => (
              <button key={room.id} onClick={() => handleSelectRoom(room)}
                className={`glass hover:border-green-500/30 rounded-2xl px-5 py-5 text-right transition-all hover:-translate-y-0.5 hover:shadow-xl hover:shadow-black/30 fade-in-delay-${Math.min(i,3)}`}
              >
                <span className="font-semibold text-white text-base">{room.name}</span>
                <p className="text-xs text-white/30 mt-1">לחץ לשיבוץ ←</p>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* STEP 2: Calendar */}
      {step==='date' && (
        <div className="fade-in">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
            <div>
              <h1 className="text-2xl font-bold text-white">{selectedRoom.name}</h1>
              <p className="text-white/40 text-sm">בחר תאריך לשיבוץ</p>
            </div>
            <button onClick={handleAddYear}
              className="flex items-center gap-1.5 text-sm glass text-green-300 px-3 py-2 rounded-xl transition-all hover:border-green-500/30 whitespace-nowrap">
              <Plus size={15}/> הוסף שנה ({Math.max(...years)+1})
            </button>
          </div>

          <div className="flex gap-2 mb-5 flex-wrap">
            <div className="flex glass rounded-xl p-1 gap-0.5">
              {years.map((y) => (
                <button key={y} onClick={() => { setFilterYear(y); setFilterMonth(null); }}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                    filterYear===y ? 'bg-green-600/40 text-green-300' : 'text-white/40 hover:text-white/70'
                  }`}>{y}</button>
              ))}
            </div>
            <select
              className="input-glass rounded-xl px-3 py-1.5 text-sm"
              value={filterMonth??''}
              onChange={(e) => setFilterMonth(e.target.value===''?null:parseInt(e.target.value))}
            >
              <option value="">כל החודשים</option>
              {MONTHS_HE.map((m,i)=><option key={i} value={i}>{m}</option>)}
            </select>
          </div>

          <div className={`grid gap-4 ${filterMonth!==null?'grid-cols-1 max-w-sm':'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3'}`}>
            {monthsToShow.map((month) => {
              const lastDay = new Date(filterYear, month+1, 0);
              if (lastDay < today) return null;
              return (
                <div key={month} className="glass rounded-2xl p-4">
                  <h3 className="text-sm font-bold text-green-300 mb-3 text-center">{MONTHS_HE[month]} {filterYear}</h3>
                  <MonthCalendar year={filterYear} month={month} onSelectDate={handleSelectDate} slotDates={slotDates} selectedDate={selectedDate}/>
                </div>
              );
            })}
          </div>
          <p className="text-xs text-white/25 mt-4 text-center">נקודה ירוקה = יש שיבוצים באותו יום</p>
        </div>
      )}

      {/* STEP 3: Hours */}
      {step==='hour' && (
        <div className="fade-in">
          <h1 className="text-2xl font-bold text-white mb-1">{selectedRoom.name}</h1>
          <p className="text-green-400 font-medium text-sm mb-5">{formatDateHe(selectedDate)}</p>
          <p className="text-white/40 text-sm mb-3">לחץ על שעת התחלה פנויה</p>

          <div className="grid grid-cols-4 sm:grid-cols-7 gap-2 mb-6">
            {ALL_HOURS.map((h) => {
              const occupied = occupiedHours.has(h);
              const isSelected = startHour===h;
              const occupant = daySlots.find(s=>h>=s.startHour&&h<s.endHour);
              return (
                <button key={h} disabled={occupied}
                  onClick={() => !occupied&&(setStartHour(h),setEndHour(''),setBookError(''))}
                  title={occupied?occupant?.therapist?.name:''}
                  className={`rounded-xl py-3 text-sm font-medium transition-all border ${
                    isSelected ? 'bg-green-500 text-white border-green-400 shadow-lg shadow-green-900/50'
                    : occupied ? 'bg-white/5 text-white/20 border-white/5 cursor-not-allowed'
                    : 'glass text-white/70 hover:text-white hover:border-green-500/40 hover:bg-green-900/30'
                  }`}
                >
                  {hLabel(h)}
                  {occupied && (
                    <div className="text-xs truncate px-1 text-white/25 leading-tight mt-0.5">
                      {occupant?.therapist?.name?.split(' ')[0]}
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          {startHour!==null && (
            <div className="glass-strong rounded-2xl p-5 space-y-4 fade-in">
              <p className="font-semibold text-white">
                שיבוץ החל מ-<span className="text-green-400">{hLabel(startHour)}</span>
              </p>
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="flex-1">
                  <label className="block text-sm font-medium text-white/60 mb-1.5">שעת סיום</label>
                  <select className="input-glass w-full rounded-xl px-3 py-2.5 text-base" value={endHour} onChange={e=>setEndHour(e.target.value)}>
                    <option value="">-- בחר --</option>
                    {ALL_HOURS.filter(h=>h>startHour).map(h=>{
                      const blocked=Array.from({length:h-startHour},(_,i)=>startHour+i).some(x=>occupiedHours.has(x));
                      return <option key={h} value={h} disabled={blocked}>{hLabel(h)}{blocked?' (חסום)':''}</option>;
                    })}
                    {!occupiedHours.has(21)&&startHour<=21&&<option value={22}>22:00</option>}
                  </select>
                </div>
                <div className="flex-1">
                  <label className="block text-sm font-medium text-white/60 mb-1.5">שמך</label>
                  <select className="input-glass w-full rounded-xl px-3 py-2.5 text-base" value={selectedTherapist} onChange={e=>setSelectedTherapist(e.target.value)}>
                    <option value="">-- בחר --</option>
                    {therapists.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                </div>
              </div>
              {bookError && <p className="text-red-400 text-sm">{bookError}</p>}
              <div className="flex gap-2">
                <button onClick={handleBook} disabled={!endHour||!selectedTherapist||booking}
                  className="flex-1 btn-green font-medium py-2.5 rounded-xl">
                  {booking?'שומר...':`אשר שיבוץ ${hLabel(startHour)}–${endHour?hLabel(parseInt(endHour)):''}`}
                </button>
                <button onClick={()=>{setStartHour(null);setEndHour('');setBookError('');}}
                  className="glass text-white/60 hover:text-white px-4 py-2.5 rounded-xl transition-colors">
                  ביטול
                </button>
              </div>
            </div>
          )}

          {daySlots.length>0 && (
            <div className="mt-6 fade-in">
              <h3 className="text-sm font-semibold text-white/50 mb-2">שיבוצים ביום זה</h3>
              <div className="space-y-2">
                {daySlots.sort((a,b)=>a.startHour-b.startHour).map(s=>(
                  <div key={s.id} className="flex items-center justify-between glass rounded-xl px-4 py-2.5 border-green-700/20">
                    <span className="font-medium text-white">{s.therapist.name}</span>
                    <span className="text-sm text-green-400">{hLabel(s.startHour)} – {hLabel(s.endHour)}</span>
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
