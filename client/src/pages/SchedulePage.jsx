import React, { useEffect, useState, useMemo } from 'react';
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
    Promise.all([getRooms(), getTherapists()]).then(([r, t]) => {
      const sorted = [...r].sort((a, b) => (parseInt(a.name.replace(/\D/g, '')) || 0) - (parseInt(b.name.replace(/\D/g, '')) || 0));
      setRooms(sorted); setTherapists(t); setLoading(false);
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
    <div className="max-w-3xl mx-auto">
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
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {rooms.map((room, i) => (
              <button key={room.id} onClick={() => handleSelectRoom(room)}
                className={`card card-clickable rounded-2xl px-5 py-6 text-right fade-up-${Math.min(i, 3)} group`}>
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-gray-800 text-base">{room.name}</span>
                  <span className="text-green-400 opacity-0 group-hover:opacity-100 transition-opacity duration-200 text-lg">←</span>
                </div>
                <p className="text-xs text-gray-400 mt-1.5">לחץ לשיבוץ</p>
              </button>
            ))}
          </div>
        </div>
      )}

      {step === 'date' && (
        <div className="fade-up">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
            <div>
              <h1 className="section-title">{selectedRoom.name}</h1>
              <p className="text-gray-400 text-sm">בחר תאריך לשיבוץ</p>
            </div>
            <button onClick={handleAddYear} className="btn-secondary flex items-center gap-1.5 text-sm px-3 py-2 whitespace-nowrap">
              <Plus size={15} /> הוסף שנה ({Math.max(...years) + 1})
            </button>
          </div>
          <div className="flex gap-2 mb-5 flex-wrap">
            <div className="flex bg-gray-100 rounded-xl p-1 gap-0.5">
              {years.map(y => (
                <button key={y} onClick={() => { setFilterYear(y); setFilterMonth(null); }}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${filterYear === y ? 'bg-white shadow-sm text-gray-800' : 'text-gray-400 hover:text-gray-600'}`}>{y}</button>
              ))}
            </div>
            <select className="input rounded-xl px-3 py-1.5 text-sm w-auto" value={filterMonth ?? ''}
              onChange={e => setFilterMonth(e.target.value === '' ? null : parseInt(e.target.value))}>
              <option value="">כל החודשים</option>
              {MONTHS_HE.map((m, i) => <option key={i} value={i}>{m}</option>)}
            </select>
          </div>
          <div className={`grid gap-4 ${filterMonth !== null ? 'grid-cols-1 max-w-sm' : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3'}`}>
            {monthsToShow.map(month => {
              const lastDay = new Date(filterYear, month + 1, 0);
              if (lastDay < today) return null;
              return (
                <div key={month} className="card rounded-2xl p-4">
                  <h3 className="text-sm font-semibold text-gray-600 mb-3 text-center">{MONTHS_HE[month]} {filterYear}</h3>
                  <MonthCalendar year={filterYear} month={month} onSelectDate={handleSelectDate} slotDates={slotDates} selectedDate={selectedDate} />
                </div>
              );
            })}
          </div>
          <p className="text-xs text-gray-400 mt-4 text-center">נקודה ירוקה = יש שיבוצים באותו יום</p>
        </div>
      )}

      {step === 'hour' && (
        <div className="fade-up">
          <h1 className="section-title mb-1">{selectedRoom.name}</h1>
          <p className="text-green-600 font-medium text-sm mb-5">{formatDateHe(selectedDate)}</p>
          <p className="text-gray-500 text-sm mb-3">בחר שעת התחלה</p>
          <div className="grid grid-cols-4 sm:grid-cols-7 gap-2 mb-6">
            {ALL_HOURS.map(h => {
              const occupied = occupiedHours.has(h);
              const isSelected = startHour === h;
              const occupant = daySlots.find(s => h >= s.startHour && h < s.endHour);
              return (
                <button key={h} disabled={occupied} type="button"
                  onClick={() => { if (occupied) return; setStartHour(h); setEndHour(''); setBookError(''); }}
                  title={occupied ? occupant?.therapist?.name : ''}
                  className={`hour-btn rounded-xl py-3 text-sm font-medium border ${
                    isSelected ? 'bg-green-500 text-white border-green-500 shadow-md shadow-green-200'
                    : occupied ? 'bg-gray-100 text-gray-300 border-gray-100 cursor-not-allowed'
                    : 'bg-white text-gray-600 border-gray-200 hover:border-green-400 hover:text-green-700 hover:bg-green-50'
                  }`}>
                  {hLabel(h)}
                  {occupied && <div className="text-xs truncate px-1 text-gray-300 mt-0.5">{occupant?.therapist?.name?.split(' ')[0]}</div>}
                </button>
              );
            })}
          </div>

          {startHour !== null && (
            <div className="card rounded-2xl p-5 space-y-4 fade-up border-green-200">
              <p className="font-semibold text-gray-700">שיבוץ החל מ-<span className="text-green-600">{hLabel(startHour)}</span></p>

              <div className="flex flex-col sm:flex-row gap-3">
                <div className="flex-1">
                  <label className="block text-sm font-medium text-gray-600 mb-1.5">שעת סיום</label>
                  <select className="input" value={endHour} onChange={e => setEndHour(e.target.value)}>
                    <option value="">-- בחר --</option>
                    {ALL_HOURS.filter(h => h > startHour).map(h => {
                      const blocked = Array.from({ length: h - startHour }, (_, i) => startHour + i).some(x => occupiedHours.has(x));
                      return <option key={h} value={h} disabled={blocked}>{hLabel(h)}{blocked ? ' (חסום)' : ''}</option>;
                    })}
                    {!occupiedHours.has(21) && startHour <= 21 && <option value={22}>22:00</option>}
                  </select>
                </div>
                <div className="flex-1">
                  <label className="block text-sm font-medium text-gray-600 mb-1.5">שמך</label>
                  <select className="input" value={selectedTherapist} onChange={e => setSelectedTherapist(e.target.value)}>
                    <option value="">-- בחר --</option>
                    {therapists.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1.5">הערה <span className="text-gray-400 font-normal text-xs">(לא חובה)</span></label>
                <textarea className="input resize-none" rows={2} placeholder="לדוגמה: טיפול זוגי, יש להכין מצע..." value={note} onChange={e => setNote(e.target.value)} maxLength={200} />
              </div>

              {/* Recurring toggle */}
              <div className="border-t border-gray-100 pt-4">
                <button type="button"
                  onClick={() => setIsRecurring(p => !p)}
                  className={`flex items-center gap-2 text-sm font-medium transition-colors ${isRecurring ? 'text-green-600' : 'text-gray-400 hover:text-gray-600'}`}>
                  <Repeat2 size={16} />
                  שיבוץ חוזר
                  <span className={`w-9 h-5 rounded-full transition-colors flex items-center px-0.5 ${isRecurring ? 'bg-green-500' : 'bg-gray-200'}`}>
                    <span className={`w-4 h-4 bg-white rounded-full shadow transition-transform ${isRecurring ? '-translate-x-4' : 'translate-x-0'}`} />
                  </span>
                </button>

                {isRecurring && (
                  <div className="mt-4 space-y-4 fade-up">
                    {/* Frequency */}
                    <div>
                      <label className="block text-sm font-medium text-gray-600 mb-2">תדירות</label>
                      <div className="flex gap-2 flex-wrap mb-1.5">
                        {FREQ_OPTIONS.map(f => (
                          <button key={f.value} type="button"
                            onClick={() => setRecurFrequency(f.value)}
                            className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-all ${
                              recurFrequency === f.value
                                ? 'bg-green-500 text-white border-green-500'
                                : 'bg-white text-gray-600 border-gray-200 hover:border-green-300'
                            }`}>
                            {f.label}
                          </button>
                        ))}
                      </div>
                      <p className="text-xs text-gray-500">{FREQ_OPTIONS.find(f => f.value === recurFrequency)?.desc}</p>
                    </div>

                    {/* Days of week (weekly only) */}
                    {recurFrequency === 'weekly' && (
                      <div>
                        <label className="block text-sm font-medium text-gray-600 mb-2">ימים בשבוע</label>
                        <div className="flex gap-2">
                          {/* Sun=0 Mon=1 ... Fri=5 — show א-ו (0-5) */}
                          {[0, 1, 2, 3, 4, 5].map(day => (
                            <button key={day} type="button"
                              onClick={() => toggleRecurDay(day)}
                              className={`w-9 h-9 rounded-full text-sm font-bold border transition-all ${
                                recurDays.includes(day)
                                  ? 'bg-green-500 text-white border-green-500'
                                  : 'bg-white text-gray-500 border-gray-200 hover:border-green-300'
                              }`}>
                              {DAYS_SHORT[day]}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* End condition */}
                    <div>
                      <label className="block text-sm font-medium text-gray-600 mb-2">סיום הסדרה</label>
                      <div className="flex gap-3 mb-3">
                        {['occurrences', 'date'].map(mode => (
                          <label key={mode} className="flex items-center gap-1.5 cursor-pointer text-sm text-gray-600">
                            <input type="radio" name="endMode" value={mode} checked={recurEndMode === mode}
                              onChange={() => setRecurEndMode(mode)}
                              className="accent-green-500" />
                            {mode === 'occurrences' ? 'לפי מספר מופעים' : 'לפי תאריך סיום'}
                          </label>
                        ))}
                      </div>
                      {recurEndMode === 'occurrences' ? (
                        <div className="flex items-center gap-2">
                          <input type="number" min={1} max={200} value={recurOccurrences}
                            onChange={e => setRecurOccurrences(e.target.value)}
                            className="input text-center" style={{width:'5rem'}} />
                          <span className="text-sm text-gray-500">{FREQ_OPTIONS.find(f => f.value === recurFrequency)?.unit || 'מופעים'}</span>
                        </div>
                      ) : (
                        <input type="date" value={recurEndDate} min={selectedDate}
                          onChange={e => setRecurEndDate(e.target.value)}
                          className="input w-auto" />
                      )}
                    </div>
                  </div>
                )}
              </div>

              {bookError && <p className="text-red-500 text-sm">{bookError}</p>}
              <div className="flex gap-2">
                <button onClick={handleBook} disabled={!endHour || !selectedTherapist || booking}
                  className="btn-primary flex-1 py-2.5 px-4">
                  {booking ? 'שומר...' : isRecurring
                    ? `שמור סדרה חוזרת ${hLabel(startHour)}–${endHour ? hLabel(parseInt(endHour)) : ''}`
                    : `אשר שיבוץ ${hLabel(startHour)}–${endHour ? hLabel(parseInt(endHour)) : ''}`}
                </button>
                <button type="button" onClick={() => { setStartHour(null); setEndHour(''); setBookError(''); setIsRecurring(false); }} className="btn-secondary px-4 py-2.5">ביטול</button>
              </div>
            </div>
          )}

          {daySlots.length > 0 && (
            <div className="mt-6 fade-up">
              <h3 className="text-sm font-semibold text-gray-500 mb-2">שיבוצים ביום זה</h3>
              <div className="space-y-2">
                {daySlots.sort((a, b) => a.startHour - b.startHour).map(s => (
                  <div key={s.id} className="flex items-center justify-between bg-green-50 border border-green-100 rounded-xl px-4 py-2.5">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-700">{s.therapist.name}</span>
                      {s.recurringId && (
                        <span title="שיבוץ חוזר" className="flex items-center gap-0.5 text-xs text-green-500 bg-green-100 px-1.5 py-0.5 rounded-full">
                          <RefreshCw size={10} /> חוזר
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-sm text-green-600 font-medium">{hLabel(s.startHour)} – {hLabel(s.endHour)}</span>
                      <button onClick={() => handleDeleteSlot(s)} className="text-gray-300 hover:text-red-400 transition-colors">
                        <X size={15} />
                      </button>
                    </div>
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
