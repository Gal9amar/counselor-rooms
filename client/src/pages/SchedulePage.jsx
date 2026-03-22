import React, { useEffect, useState, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { getRooms, getTherapists, getSchedule, bookSlot, bookRecurring, clearSlot } from '../services/api';
import { ChevronLeft, ChevronRight, Plus, RefreshCw, X, Repeat2, AlertTriangle, Trash2 } from 'lucide-react';

const DAYS_HE = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];
const DAYS_SHORT = ['א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ש'];
const MONTHS_HE = ['ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני', 'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'];
const ALL_HOURS = [8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21];
const FREQ_OPTIONS = [
  { value: 'daily',   label: 'יומי',   desc: 'שיבוץ בכל יום, החל מהתאריך שנבחר', unit: 'ימים' },
  { value: 'weekly',  label: 'שבועי',  desc: 'שיבוץ בימים קבועים בכל שבוע',       unit: 'שבועות' },
  { value: 'monthly', label: 'חודשי',  desc: 'שיבוץ פעם בחודש, באותו תאריך',      unit: 'חודשים' },
];

function toDateStr(d) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; }
function hLabel(h) { return `${h}:00`; }
function formatDateHe(ds) { const d = new Date(ds + 'T00:00:00'); return `${DAYS_HE[d.getDay()]} ${d.getDate()} ${MONTHS_HE[d.getMonth()]} ${d.getFullYear()}`; }

function MonthCalendar({ year, month, onSelectDate, slotDates, selectedDate }) {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const startPad = new Date(year, month, 1).getDay();
  const cells = [];
  for (let i = 0; i < startPad; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  return (
    <div>
      <div className="grid grid-cols-7 mb-1">
        {DAYS_HE.map(d => <div key={d} className="text-center text-xs text-gray-400 font-medium py-1">{d.slice(0, 1)}</div>)}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {cells.map((day, i) => {
          if (!day) return <div key={`p-${i}`} />;
          const d = new Date(year, month, day);
          const ds = toDateStr(d);
          const isPast = d < today;
          const isToday = ds === toDateStr(today);
          const isSelected = ds === selectedDate;
          const hasSlot = slotDates.has(ds);
          return (
            <button key={ds} disabled={isPast} onClick={() => !isPast && onSelectDate(ds)}
              className={`relative rounded-xl py-2 text-sm font-medium transition-all flex flex-col items-center gap-0.5 ${
                isSelected ? 'bg-green-500 text-white shadow-md shadow-green-200'
                : isToday ? 'bg-green-100 text-green-700 font-bold ring-1 ring-green-300'
                : isPast ? 'text-gray-200 cursor-not-allowed'
                : hasSlot ? 'bg-green-50 text-green-700 border border-green-200'
                : 'text-gray-500 hover:bg-gray-50'
              }`}>
              {day}
              {hasSlot && !isPast && <span className={`w-1.5 h-1.5 rounded-full ${isSelected ? 'bg-white' : 'bg-green-400'}`} />}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// Modal for conflict display
function ConflictModal({ conflicts, onClose }) {
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6" onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
            <AlertTriangle size={20} className="text-red-500" />
          </div>
          <div>
            <h3 className="font-bold text-gray-800 text-lg">התנגשות בשיבוצים</h3>
            <p className="text-sm text-gray-500">לא ניתן לשמור את הסדרה</p>
          </div>
        </div>
        <p className="text-sm text-gray-600 mb-3">
          נמצאו <strong>{conflicts.length}</strong> תאריכים עם שיבוץ קיים:
        </p>
        <div className="max-h-60 overflow-y-auto space-y-2 mb-5">
          {conflicts.map((c, i) => (
            <div key={i} className="flex items-center justify-between bg-red-50 border border-red-100 rounded-xl px-3 py-2">
              <span className="text-sm font-medium text-gray-700">{formatDateHe(c.date)}</span>
              <span className="text-xs text-red-500">{c.therapist} {hLabel(c.startHour)}–{hLabel(c.endHour)}</span>
            </div>
          ))}
        </div>
        <p className="text-xs text-gray-400 mb-4">יש לשנות את הגדרות הסדרה כדי להימנע מהתנגשויות אלה.</p>
        <button onClick={onClose} className="btn-primary w-full py-2.5">הבנתי, אתקן</button>
      </div>
    </div>
  );
}

// Modal for delete scope
function DeleteModal({ slot, onClose, onDelete }) {
  const isRecurring = !!slot.recurringId;
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6" onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
            <Trash2 size={18} className="text-red-500" />
          </div>
          <h3 className="font-bold text-gray-800">מחיקת שיבוץ</h3>
        </div>
        <p className="text-sm text-gray-600 mb-4">
          {isRecurring ? 'שיבוץ זה הוא חלק מסדרה חוזרת. מה ברצונך למחוק?' : 'האם למחוק שיבוץ זה?'}
        </p>
        <div className="space-y-2">
          <button onClick={() => onDelete('single')} className="w-full text-right px-4 py-3 bg-gray-50 hover:bg-gray-100 rounded-xl text-sm font-medium text-gray-700 transition-colors">
            מחק רק תאריך זה
          </button>
          {isRecurring && (
            <button onClick={() => onDelete('all')} className="w-full text-right px-4 py-3 bg-red-50 hover:bg-red-100 rounded-xl text-sm font-medium text-red-600 transition-colors">
              מחק את כל הסדרה
            </button>
          )}
          <button onClick={onClose} className="w-full text-right px-4 py-3 text-sm text-gray-400 hover:text-gray-600 transition-colors">
            ביטול
          </button>
        </div>
      </div>
    </div>
  );
}

export default function SchedulePage() {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const currentYear = today.getFullYear();
  const [rooms, setRooms] = useState([]);
  const [therapists, setTherapists] = useState([]);
  const [allSlots, setAllSlots] = useState([]);
  const [loading, setLoading] = useState(true);
  const location = useLocation();
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
  const [note, setNote] = useState('');
  const [booking, setBooking] = useState(false);
  const [bookError, setBookError] = useState('');

  // Recurring state
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurFrequency, setRecurFrequency] = useState('weekly');
  const [recurDays, setRecurDays] = useState([]);
  const [recurEndMode, setRecurEndMode] = useState('occurrences'); // 'occurrences' | 'date'
  const [recurOccurrences, setRecurOccurrences] = useState(10);
  const [recurEndDate, setRecurEndDate] = useState('');
  const [conflictModal, setConflictModal] = useState(null); // array of conflicts or null
  const [deleteModal, setDeleteModal] = useState(null); // slot to delete or null

  useEffect(() => {
    const _today = new Date();
    const _y = _today.getFullYear();
    const _m = _today.getMonth();
    const _from = `${_y}-${String(_m+1).padStart(2,'0')}-01`;
    // 4 months: current + 3
    const _endMonth = new Date(_y, _m+4, 0); // last day of month+3
    const _to = `${_endMonth.getFullYear()}-${String(_endMonth.getMonth()+1).padStart(2,'0')}-${String(_endMonth.getDate()).padStart(2,'0')}`;
    Promise.all([getRooms(), getTherapists(), getSchedule({from:_from, to:_to})]).then(([r, t, s]) => {
      const sorted = [...r].sort((a, b) => (parseInt(a.name.replace(/\D/g, '')) || 0) - (parseInt(b.name.replace(/\D/g, '')) || 0));
      setRooms(sorted); setTherapists(t); setAllSlots(s); setLoading(false);
      console.log('Loaded slots for stats:', s.length);
      // Auto-select room if navigated from dashboard
      const preId = location?.state?.preselectedRoomId;
      if (preId) {
        const preRoom = sorted.find(room => room.id === preId);
        if (preRoom) setTimeout(() => handleSelectRoom(preRoom), 0);
      }
    });
  }, []);

  const handleSelectRoom = async (room) => {
    setSelectedRoom(room); setStep('date'); setSelectedDate(null);
    const s = await getSchedule({ roomId: room.id, from: `${currentYear}-01-01`, to: `${currentYear}-12-31` });
    setAllSlots(s);
  };
  const handleSelectDate = async (ds) => {
    setSelectedDate(ds); setStep('hour'); setStartHour(null); setEndHour(''); setBookError(''); setIsRecurring(false);
    const s = await getSchedule({ roomId: selectedRoom.id, date: ds });
    setDaySlots(s);
  };
  const handleAddYear = async () => {
    const ny = Math.max(...years) + 1;
    setYears(p => [...p, ny]); setFilterYear(ny); setFilterMonth(null);
    const s = await getSchedule({ roomId: selectedRoom.id, from: `${ny}-01-01`, to: `${ny}-12-31` });
    setAllSlots(p => [...p, ...s]);
  };
  const back = () => {
    if (step === 'hour') { setStep('date'); setStartHour(null); setEndHour(''); setBookError(''); setIsRecurring(false); }
    else if (step === 'date') { setStep('room'); setSelectedRoom(null); setAllSlots([]); }
  };

  const toggleRecurDay = (day) => {
    setRecurDays(prev => prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]);
  };

  const slotDates = useMemo(() => { const s = new Set(); allSlots.forEach(sl => s.add(toDateStr(new Date(sl.date)))); return s; }, [allSlots]);
  const monthsToShow = useMemo(() => filterMonth !== null ? [filterMonth] : Array.from({ length: 12 }, (_, i) => i), [filterMonth]);
  const occupiedHours = new Set();
  daySlots.forEach(s => { for (let h = s.startHour; h < s.endHour; h++) occupiedHours.add(h); });

  const handleBook = async () => {
    const end = parseInt(endHour);
    if (!end || end <= startHour) { setBookError('שעת סיום לא תקינה'); return; }
    if (!selectedTherapist) { setBookError('בחר שם'); return; }
    const _tName = therapists.find(t => t.id === parseInt(selectedTherapist))?.name || '';
    if (_tName === 'אגף רווחה' && !note.trim()) { setBookError('עבור אגף רווחה יש למלא הערה'); return; }
    if (daySlots.some(s => startHour < s.endHour && end > s.startHour)) { setBookError('קיים חופף'); return; }

    setBooking(true); setBookError('');

    if (isRecurring) {
      // Recurring booking
      if (recurFrequency === 'weekly' && recurDays.length === 0) { setBookError('יש לבחור לפחות יום אחד'); setBooking(false); return; }
      if (recurEndMode === 'occurrences' && (!recurOccurrences || recurOccurrences < 1)) { setBookError('יש להזין מספר מופעים'); setBooking(false); return; }
      if (recurEndMode === 'date' && !recurEndDate) { setBookError('יש לבחור תאריך סיום'); setBooking(false); return; }

      try {
        const result = await bookRecurring({
          roomId: selectedRoom.id,
          therapistId: parseInt(selectedTherapist),
          startHour,
          endHour: end,
          note: note.trim() || null,
          frequency: recurFrequency,
          daysOfWeek: recurFrequency === 'weekly' ? recurDays : [],
          startDate: selectedDate,
          endDate: recurEndMode === 'date' ? recurEndDate : null,
          occurrences: recurEndMode === 'occurrences' ? parseInt(recurOccurrences) : null,
        });
        // Add all created slots to state
        setDaySlots(p => [...p, ...result.slots.filter(s => toDateStr(new Date(s.date)) === selectedDate)]);
        setAllSlots(p => [...p, ...result.slots]);
        setStartHour(null); setEndHour(''); setSelectedTherapist(''); setNote(''); setIsRecurring(false); setRecurDays([]);
      } catch (e) {
        const data = e.response?.data?.error;
        try {
          const parsed = JSON.parse(data);
          if (parsed.conflicts) { setConflictModal(parsed.conflicts); }
          else { setBookError(data || 'שגיאה'); }
        } catch { setBookError(data || 'שגיאה'); }
      }
    } else {
      // One-time booking
      try {
        const slot = await bookSlot(selectedRoom.id, selectedDate, startHour, end, parseInt(selectedTherapist), note.trim() || null);
        setDaySlots(p => [...p, slot]); setAllSlots(p => [...p, slot]);
        setStartHour(null); setEndHour(''); setSelectedTherapist(''); setNote('');
      } catch (e) { setBookError(e.response?.data?.error || 'שגיאה'); }
    }
    setBooking(false);
  };

  const handleDeleteSlot = (slot) => {
    setDeleteModal(slot);
  };

  const confirmDelete = async (scope) => {
    const slot = deleteModal;
    setDeleteModal(null);
    try {
      await clearSlot(slot.id, scope);
      if (scope === 'all' && slot.recurringId) {
        setDaySlots(p => p.filter(s => s.recurringId !== slot.recurringId));
        setAllSlots(p => p.filter(s => s.recurringId !== slot.recurringId));
      } else {
        setDaySlots(p => p.filter(s => s.id !== slot.id));
        setAllSlots(p => p.filter(s => s.id !== slot.id));
      }
    } catch (e) {
      console.error('Delete failed', e);
    }
  };

  if (loading) return <div className="text-center text-gray-400 py-20">טוען...</div>;

  return (
    <div className="max-w-5xl mx-auto">
      {conflictModal && <ConflictModal conflicts={conflictModal} onClose={() => setConflictModal(null)} />}
      {deleteModal && <DeleteModal slot={deleteModal} onClose={() => setDeleteModal(null)} onDelete={confirmDelete} />}

      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-gray-400 mb-5 fade-up">
        <span className={step === 'room' ? 'font-semibold text-green-600' : 'hover:text-gray-600 cursor-pointer'} onClick={() => step !== 'room' && back() && back()}>בחר חדר</span>
        <ChevronLeft size={13} />
        <span className={step === 'date' ? 'font-semibold text-green-600' : step === 'hour' ? 'text-gray-600' : 'text-gray-300'}>{selectedRoom?.name || 'בחר תאריך'}</span>
        <ChevronLeft size={13} />
        <span className={step === 'hour' ? 'font-semibold text-green-600' : 'text-gray-300'}>{selectedDate ? formatDateHe(selectedDate) : 'בחר שעה'}</span>
      </div>

      {step !== 'room' && (
        <button onClick={back} className="mb-5 btn-ghost flex items-center gap-1 text-sm text-green-600 px-2 py-1.5">
          <ChevronRight size={14} /> חזור
        </button>
      )}

      {step === 'room' && (
        <div className="fade-up">
          <h1 className="section-title mb-1">לוח שיבוצים</h1>
          <p className="text-gray-400 text-sm mb-6">בחר חדר לשיבוץ</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {rooms.map((room, i) => (
              <button key={room.id} onClick={() => handleSelectRoom(room)}
                className={`card card-clickable rounded-2xl text-right fade-up-${Math.min(i, 3)} overflow-hidden`}>
                {/* Header */}
                <div className="px-5 pt-5 pb-4 border-b border-gray-100 flex items-center justify-between">
                  <span className="font-bold text-gray-800 text-lg">{room.name}</span>
                  <span className="text-green-500 text-sm font-medium">לשיבוץ ←</span>
                </div>
                {/* Month stats */}
                {(()=>{
                  const now=new Date();
                  const roomSlots=allSlots.filter(s=>s.roomId===room.id);
                  const months=Array.from({length:3},(_,mi)=>{
                    const y=mi===0?now.getFullYear():new Date(now.getFullYear(),now.getMonth()+mi,1).getFullYear();
                    const m=new Date(now.getFullYear(),now.getMonth()+mi,1).getMonth();
                    const dim=new Date(y,m+1,0).getDate();
                    let workDays=0;
                    for(let dd=1;dd<=dim;dd++){if(new Date(y,m,dd).getDay()!==6)workDays++;}
                    // Use UTC month/year from date string
                    const bookedSet=new Set();
                    roomSlots.forEach(s=>{
                      const utcY=parseInt(s.date.slice(0,4));
                      const utcM=parseInt(s.date.slice(5,7))-1;
                      const utcD=parseInt(s.date.slice(8,10));
                      if(utcY===y&&utcM===m) bookedSet.add(utcD);
                    });
                    const booked=bookedSet.size;
                    const free=Math.max(0,workDays-booked);
                    const pct=workDays>0?Math.round((booked/workDays)*100):0;
                    return{label:MONTHS_HE[m],booked,free,workDays,pct};
                  });
                  return(
                    <div className="flex border-t border-gray-100">
                      {months.map(({label,booked,free,workDays,pct},mi)=>(
                        <div key={mi} className="flex-1 px-3 py-3 text-center border-r border-gray-100 last:border-0">
                          <p className="text-xs font-bold text-gray-500 mb-2">{label}</p>
                          <div className="h-1.5 rounded-full bg-gray-100 mb-2.5 overflow-hidden mx-1">
                            <div className="h-full rounded-full bg-green-400" style={{width:`${pct}%`}}/>
                          </div>
                          <p className="font-bold text-green-600 text-base leading-tight">{booked}</p>
                          <p className="text-gray-400 leading-tight" style={{fontSize:'10px'}}>משובצים</p>
                          <p className="font-semibold text-gray-400 text-sm mt-1 leading-tight">{free}</p>
                          <p className="text-gray-300 leading-tight" style={{fontSize:'10px'}}>פנויים</p>
                        </div>
                      ))}
                    </div>
                  );
                })()}

