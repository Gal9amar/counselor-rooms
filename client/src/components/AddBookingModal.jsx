import React, { useEffect, useState, useMemo } from 'react';
import { getScheduleSilent, getRoomNotesSilent, bookSlotSilent, bookRecurringSilent } from '../services/api';
import { X, ChevronLeft, ChevronRight, Repeat2, CalendarDays, CalendarRange, AlertTriangle } from 'lucide-react';

const DAYS_HE = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];
const DAYS_SHORT = ['א', 'ב', 'ג', 'ד', 'ה', 'ו'];
const MONTHS_HE = ['ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני', 'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'];
const ALL_HOURS = [8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21];
const FREQ_OPTIONS = [
  { value: 'daily',   label: 'יומי',   desc: 'שיבוץ בכל יום, החל מהתאריך שנבחר', unit: 'ימים' },
  { value: 'weekly',  label: 'שבועי',  desc: 'שיבוץ בימים קבועים בכל שבוע',      unit: 'שבועות' },
  { value: 'monthly', label: 'חודשי',  desc: 'שיבוץ פעם בחודש, באותו תאריך',     unit: 'חודשים' },
];

function toDateStr(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function hLabel(h) { return `${h}:00`; }
function formatDateHe(ds) {
  const d = new Date(ds + 'T00:00:00');
  return `${DAYS_HE[d.getDay()]} ${d.getDate()} ${MONTHS_HE[d.getMonth()]} ${d.getFullYear()}`;
}
function formatShort(ds) {
  const d = new Date(ds + 'T00:00:00');
  return `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`;
}

function calcRecurStats(startDate, frequency, daysOfWeek, endMode, occurrences, endDate) {
  if (!startDate) return null;
  const start = new Date(startDate + 'T00:00:00');

  if (endMode === 'occurrences' && occurrences >= 1) {
    const n = parseInt(occurrences);
    let lastDate = null;
    let count = 0;

    if (frequency === 'daily') {
      const d = new Date(start); d.setDate(d.getDate() + n - 1);
      lastDate = toDateStr(d); count = n;
    } else if (frequency === 'monthly') {
      const d = new Date(start); d.setMonth(d.getMonth() + n - 1);
      lastDate = toDateStr(d); count = n;
    } else if (frequency === 'weekly') {
      if (!daysOfWeek || daysOfWeek.length === 0) return null;
      // n = מספר שבועות. תאריך סיום = תחילת שבוע n-1 + היום האחרון שנבחר באותו שבוע
      const sortedDays = [...daysOfWeek].sort((a, b) => a - b);
      // מצא את תחילת השבוע שבו נמצא startDate (ראשון)
      const startOfFirstWeek = new Date(start);
      startOfFirstWeek.setDate(start.getDate() - start.getDay()); // ראשון של השבוע הראשון
      // תחילת שבוע n (האחרון)
      const startOfLastWeek = new Date(startOfFirstWeek);
      startOfLastWeek.setDate(startOfFirstWeek.getDate() + (n - 1) * 7);
      // היום האחרון שנבחר בשבוע האחרון
      const lastDay = sortedDays[sortedDays.length - 1];
      const lastD = new Date(startOfLastWeek);
      lastD.setDate(startOfLastWeek.getDate() + lastDay);
      lastDate = toDateStr(lastD);
      count = n * daysOfWeek.length;
    }

    if (!lastDate) return null;
    return { startDate, endDate: lastDate, count };
  }

  if (endMode === 'date' && endDate) {
    const end = new Date(endDate + 'T00:00:00');
    if (end < start) return null;
    let count = 0;
    if (frequency === 'daily') {
      count = Math.floor((end - start) / (1000 * 60 * 60 * 24)) + 1;
    } else if (frequency === 'monthly') {
      count = (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth()) + 1;
    } else if (frequency === 'weekly') {
      if (!daysOfWeek || daysOfWeek.length === 0) return null;
      const d = new Date(start);
      while (d <= end) { if (daysOfWeek.includes(d.getDay())) count++; d.setDate(d.getDate() + 1); }
    }
    return { startDate, endDate, count };
  }

  return null;
}

function MonthCalendar({ year, month, onSelectDate, slotDates, selectedDate, blockedDates, partialBlockedDates, scatterDates }) {
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
          const isScatter = scatterDates?.has(ds);
          const hasSlot = slotDates?.has(ds);
          const isBlocked = blockedDates?.has(ds);
          const isPartialBlocked = !isBlocked && partialBlockedDates?.has(ds);
          return (
            <button key={ds} disabled={isPast || isBlocked} onClick={() => !isPast && !isBlocked && onSelectDate(ds)}
              title={isBlocked ? 'חדר חסום' : isPartialBlocked ? 'חלק מהשעות חסומות' : ''}
              className={`relative rounded-xl py-2 text-sm font-medium transition-all flex flex-col items-center gap-0.5 ${
                isSelected ? 'bg-green-500 text-white shadow-md shadow-green-200'
                : isScatter ? 'bg-blue-100 text-blue-700 border border-blue-300 ring-1 ring-blue-400'
                : isBlocked ? 'bg-red-100 text-red-400 border border-red-200 cursor-not-allowed'
                : isToday ? 'bg-green-100 text-green-700 font-bold ring-1 ring-green-300'
                : isPast ? 'text-gray-200 cursor-not-allowed'
                : isPartialBlocked ? 'bg-orange-50 text-orange-700 border border-orange-200 hover:bg-orange-100'
                : hasSlot ? 'bg-green-50 text-green-700 border border-green-200'
                : 'text-gray-500 hover:bg-gray-50'
              }`}>
              {day}
              {isBlocked && <span className="text-xs leading-none">🚫</span>}
              {isPartialBlocked && !isBlocked && <span className="text-xs leading-none">⚠️</span>}
              {hasSlot && !isPast && !isBlocked && !isScatter && (
                <span className={`w-1.5 h-1.5 rounded-full ${isSelected ? 'bg-white' : 'bg-green-400'}`} />
              )}
              {isScatter && <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default function AddBookingModal({ room, therapists, onClose, onSuccess }) {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const todayStr = toDateStr(today);

  // Navigation
  const [step, setStep] = useState('mode'); // 'mode' | 'calendar' | 'hour' | 'scatter'
  const [calYear, setCalYear] = useState(today.getFullYear());
  const [calMonth, setCalMonth] = useState(today.getMonth());

  // Shared
  const [therapistId, setTherapistId] = useState('');
  const [note, setNote] = useState('');
  const [bookError, setBookError] = useState('');
  const [booking, setBooking] = useState(false);

  // Single / Recurring
  const [selectedDate, setSelectedDate] = useState(null);
  const [startHour, setStartHour] = useState(null);
  const [endHour, setEndHour] = useState('');
  const [daySlots, setDaySlots] = useState([]);
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurFrequency, setRecurFrequency] = useState('weekly');
  const [recurDays, setRecurDays] = useState([]);
  const [recurEndMode, setRecurEndMode] = useState('occurrences');
  const [recurOccurrences, setRecurOccurrences] = useState(10);
  const [recurEndDate, setRecurEndDate] = useState('');
  const [conflictModal, setConflictModal] = useState(null);

  // Scatter
  const [scatterEntries, setScatterEntries] = useState([]);
  const [pendingDate, setPendingDate] = useState(null);
  const [scatterStart, setScatterStart] = useState(null);
  const [scatterEnd, setScatterEnd] = useState('');
  const [scatterTherapistId, setScatterTherapistId] = useState('');
  const [scatterNote, setScatterNote] = useState('');
  const [scatterYear, setScatterYear] = useState(today.getFullYear());
  const [scatterMonth, setScatterMonth] = useState(today.getMonth());
  const [scatterSaving, setScatterSaving] = useState(false);
  const [scatterResults, setScatterResults] = useState(null);

  // Calendar data
  const [allSlots, setAllSlots] = useState([]);
  const [blockingNotes, setBlockingNotes] = useState([]);
  const [dataLoading, setDataLoading] = useState(true);

  useEffect(() => {
    const y = today.getFullYear();
    Promise.all([
      getScheduleSilent({ roomId: room.id, from: `${y}-01-01`, to: `${y + 1}-12-31` }),
      getRoomNotesSilent(room.id),
    ]).then(([slots, notes]) => {
      setAllSlots(slots);
      setBlockingNotes(notes.filter(n => n.blocksBooking));
      setDataLoading(false);
    });
  }, [room.id]);

  const slotDates = useMemo(() => {
    const s = new Set();
    allSlots.forEach(sl => s.add(toDateStr(new Date(sl.date))));
    return s;
  }, [allSlots]);

  const { blockedDates, partialBlockedDates } = useMemo(() => {
    const blocked = new Set();
    const partial = new Set();
    blockingNotes.forEach(n => {
      const start = new Date(n.startDate); start.setHours(0, 0, 0, 0);
      const end = new Date(n.endDate); end.setHours(0, 0, 0, 0);
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        const ds = toDateStr(new Date(d));
        if (n.startHour == null) blocked.add(ds);
        else partial.add(ds);
      }
    });
    return { blockedDates: blocked, partialBlockedDates: partial };
  }, [blockingNotes]);

  const blockedHoursForDate = useMemo(() => {
    if (!selectedDate) return new Set();
    const s = new Set();
    blockingNotes.forEach(n => {
      if (n.startHour == null) return;
      const start = new Date(n.startDate); start.setHours(0, 0, 0, 0);
      const end = new Date(n.endDate); end.setHours(0, 0, 0, 0);
      const sel = new Date(selectedDate + 'T00:00:00');
      if (sel < start || sel > end) return;
      for (let h = n.startHour; h < n.endHour; h++) s.add(h);
    });
    return s;
  }, [blockingNotes, selectedDate]);

  const blockedHoursForPending = useMemo(() => {
    if (!pendingDate) return new Set();
    const s = new Set();
    blockingNotes.forEach(n => {
      if (n.startHour == null) return;
      const start = new Date(n.startDate); start.setHours(0, 0, 0, 0);
      const end = new Date(n.endDate); end.setHours(0, 0, 0, 0);
      const sel = new Date(pendingDate + 'T00:00:00');
      if (sel < start || sel > end) return;
      for (let h = n.startHour; h < n.endHour; h++) s.add(h);
    });
    return s;
  }, [blockingNotes, pendingDate]);

  const occupiedHours = useMemo(() => {
    const s = new Set();
    daySlots.forEach(sl => { for (let h = sl.startHour; h < sl.endHour; h++) s.add(h); });
    return s;
  }, [daySlots]);

  const occupiedHoursForPending = useMemo(() => {
    if (!pendingDate) return new Set();
    const s = new Set();
    allSlots
      .filter(sl => toDateStr(new Date(sl.date)) === pendingDate)
      .forEach(sl => { for (let h = sl.startHour; h < sl.endHour; h++) s.add(h); });
    return s;
  }, [allSlots, pendingDate]);

  const scatterDates = useMemo(() => new Set(scatterEntries.map(e => e.date)), [scatterEntries]);

  // Handlers
  const handleSelectDate = async (ds) => {
    setSelectedDate(ds);
    setStep('hour');
    setStartHour(null);
    setEndHour('');
    setBookError('');
    const s = await getScheduleSilent({ roomId: room.id, date: ds });
    setDaySlots(s);
  };

  const toggleRecurDay = (day) => {
    setRecurDays(prev => prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]);
  };

  const handleBook = async () => {
    const end = parseInt(endHour);
    if (!end || end <= startHour) { setBookError('שעת סיום לא תקינה'); return; }
    if (!therapistId) { setBookError('בחר שם'); return; }
    const tName = therapists.find(t => t.id === parseInt(therapistId))?.name || '';
    if (tName === 'אגף רווחה' && !note.trim()) { setBookError('עבור אגף רווחה יש למלא הערה'); return; }
    if (daySlots.some(s => startHour < s.endHour && end > s.startHour)) { setBookError('קיים חופף'); return; }

    setBooking(true); setBookError('');

    if (isRecurring) {
      if (recurFrequency === 'weekly' && recurDays.length === 0) { setBookError('יש לבחור לפחות יום אחד'); setBooking(false); return; }
      if (recurEndMode === 'occurrences' && (!recurOccurrences || recurOccurrences < 1)) { setBookError('יש להזין מספר מופעים'); setBooking(false); return; }
      if (recurEndMode === 'date' && !recurEndDate) { setBookError('יש לבחור תאריך סיום'); setBooking(false); return; }
      try {
        const result = await bookRecurringSilent({
          roomId: room.id,
          therapistId: parseInt(therapistId),
          startHour,
          endHour: end,
          note: note.trim() || null,
          frequency: recurFrequency,
          daysOfWeek: recurFrequency === 'weekly' ? recurDays : [],
          startDate: selectedDate,
          endDate: recurEndMode === 'date' ? recurEndDate : null,
          occurrences: recurEndMode === 'occurrences' ? parseInt(recurOccurrences) : null,
        });
        setAllSlots(p => [...p, ...result.slots]);
        onSuccess(result.slots);
        onClose();
      } catch (e) {
        const data = e.response?.data?.error;
        try {
          const parsed = JSON.parse(data);
          if (parsed.conflicts) { setConflictModal(parsed.conflicts); }
          else { setBookError(data || 'שגיאה'); }
        } catch { setBookError(data || 'שגיאה'); }
      }
    } else {
      try {
        const slot = await bookSlotSilent(room.id, selectedDate, startHour, end, parseInt(therapistId), note.trim() || null);
        setAllSlots(p => [...p, slot]);
        onSuccess([slot]);
        onClose();
      } catch (e) {
        setBookError(e.response?.data?.error || 'שגיאה');
      }
    }
    setBooking(false);
  };

  const handleScatterDateClick = (ds) => {
    if (scatterDates.has(ds)) {
      setScatterEntries(prev => prev.filter(e => e.date !== ds));
      if (pendingDate === ds) setPendingDate(null);
      return;
    }
    setPendingDate(ds);
    setScatterStart(null);
    setScatterEnd('');
  };

  const confirmScatterEntry = () => {
    const end = parseInt(scatterEnd);
    if (!scatterStart || !end || end <= scatterStart) return;
    const hasConflict = Array.from({ length: end - scatterStart }, (_, i) => scatterStart + i)
      .some(x => occupiedHoursForPending.has(x) || blockedHoursForPending.has(x));
    if (hasConflict) { setBookError('הטווח שנבחר חופף שיבוץ קיים בחדר'); return; }
    setBookError('');
    setScatterEntries(prev => [...prev, {
      id: crypto.randomUUID(),
      date: pendingDate,
      startHour: scatterStart,
      endHour: end,
    }]);
    setPendingDate(null);
    setScatterStart(null);
    setScatterEnd('');
  };

  const handleScatterSave = async () => {
    if (!scatterTherapistId || scatterEntries.length === 0) return;
    const tName = therapists.find(t => t.id === parseInt(scatterTherapistId))?.name || '';
    if (tName === 'אגף רווחה' && !scatterNote.trim()) {
      setBookError('עבור אגף רווחה יש למלא הערה');
      return;
    }
    setScatterSaving(true);
    const saved = [], failed = [];
    for (const entry of scatterEntries) {
      try {
        const slot = await bookSlotSilent(
          room.id, entry.date, entry.startHour, entry.endHour,
          parseInt(scatterTherapistId), scatterNote.trim() || null
        );
        saved.push({ ...entry, slot });
        setAllSlots(p => [...p, slot]);
      } catch (e) {
        const msg = e.response?.data?.error || 'שגיאה';
        failed.push({ ...entry, error: msg });
      }
    }
    setScatterResults({ saved, failed });
    setScatterSaving(false);
    if (saved.length > 0) onSuccess(saved.map(e => e.slot));
  };

  const prevScatterMonth = () => {
    if (scatterMonth === 0) { setScatterYear(y => y - 1); setScatterMonth(11); }
    else setScatterMonth(m => m - 1);
  };
  const nextScatterMonth = () => {
    if (scatterMonth === 11) { setScatterYear(y => y + 1); setScatterMonth(0); }
    else setScatterMonth(m => m + 1);
  };
  const prevCalMonth = () => {
    if (calMonth === 0) { setCalYear(y => y - 1); setCalMonth(11); }
    else setCalMonth(m => m - 1);
  };
  const nextCalMonth = () => {
    if (calMonth === 11) { setCalYear(y => y + 1); setCalMonth(0); }
    else setCalMonth(m => m + 1);
  };

  const isAgaf = therapists.find(t => String(t.id) === String(therapistId))?.name === 'אגף רווחה';
  const isScatterAgaf = therapists.find(t => String(t.id) === String(scatterTherapistId))?.name === 'אגף רווחה';

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-[2px] z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[92vh] flex flex-col border border-gray-100"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 shrink-0">
          <div className="flex items-center gap-3">
            {step !== 'mode' && (
              <button
                onClick={() => {
                  if (step === 'hour') { setStep('calendar'); setStartHour(null); setEndHour(''); setBookError(''); setIsRecurring(false); }
                  else if (step === 'calendar') setStep('mode');
                  else if (step === 'scatter') { setStep('mode'); setScatterEntries([]); setPendingDate(null); setScatterResults(null); }
                }}
                className="btn-ghost p-1.5 text-gray-400 hover:text-gray-600"
              >
                <ChevronRight size={18} />
              </button>
            )}
            <div>
              <h2 className="text-lg font-bold text-gray-800">{room.name}</h2>
              <p className="text-xs text-gray-400">
                {step === 'mode' && 'בחר סוג שיבוץ'}
                {step === 'calendar' && 'בחר תאריך'}
                {step === 'hour' && selectedDate && `${formatDateHe(selectedDate)} · ${isRecurring ? 'שיבוץ חוזר' : 'שיבוץ יחיד'}`}
                {step === 'scatter' && 'שיבוץ תפזורת'}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="btn-ghost p-1.5 text-gray-400 hover:text-gray-600">
            <X size={20} />
          </button>
        </div>

        {/* Conflict modal (inner) */}
        {conflictModal && (
          <div className="absolute inset-0 bg-black/50 z-10 flex items-center justify-center p-4 rounded-2xl" onClick={() => setConflictModal(null)}>
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
              <div className="max-h-52 overflow-y-auto space-y-2 mb-4">
                {conflictModal.map((c, i) => (
                  <div key={i} className="flex items-center justify-between bg-red-50 border border-red-100 rounded-xl px-3 py-2">
                    <span className="text-sm font-medium text-gray-700">{formatDateHe(c.date)}</span>
                    <span className="text-xs text-red-500">{c.therapist} {hLabel(c.startHour)}–{hLabel(c.endHour)}</span>
                  </div>
                ))}
              </div>
              <button onClick={() => setConflictModal(null)} className="btn-primary w-full py-2.5">הבנתי, אתקן</button>
            </div>
          </div>
        )}

        {/* Body */}
        <div className="overflow-y-auto flex-1 px-5 py-5">

          {/* ── STEP: mode ── */}
          {step === 'mode' && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 fade-up">
              <button
                onClick={() => { setStep('calendar'); setIsRecurring(false); }}
                className="card card-clickable rounded-2xl p-5 text-right flex flex-col gap-3 hover:border-green-300"
              >
                <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center">
                  <CalendarDays size={20} className="text-green-600" />
                </div>
                <div>
                  <p className="font-bold text-gray-800">שיבוץ יחיד</p>
                  <p className="text-xs text-gray-400 mt-0.5">תאריך אחד, שעות קבועות</p>
                </div>
              </button>
              <button
                onClick={() => { setStep('calendar'); setIsRecurring(true); }}
                className="card card-clickable rounded-2xl p-5 text-right flex flex-col gap-3 hover:border-blue-300"
              >
                <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
                  <Repeat2 size={20} className="text-blue-600" />
                </div>
                <div>
                  <p className="font-bold text-gray-800">שיבוץ חוזר</p>
                  <p className="text-xs text-gray-400 mt-0.5">יומי, שבועי או חודשי</p>
                </div>
              </button>
              <button
                onClick={() => setStep('scatter')}
                className="card card-clickable rounded-2xl p-5 text-right flex flex-col gap-3 hover:border-purple-300"
              >
                <div className="w-10 h-10 bg-purple-100 rounded-xl flex items-center justify-center">
                  <CalendarRange size={20} className="text-purple-600" />
                </div>
                <div>
                  <p className="font-bold text-gray-800">שיבוץ תפזורת</p>
                  <p className="text-xs text-gray-400 mt-0.5">ימים נבחרים, שעות שונות לכל יום</p>
                </div>
              </button>
            </div>
          )}

          {/* ── STEP: calendar ── */}
          {step === 'calendar' && (
            <div className="fade-up">
              {dataLoading ? (
                <div className="text-center text-gray-400 py-10">טוען...</div>
              ) : (
                <>
                  <div className="flex items-center justify-between mb-4">
                    <button onClick={prevCalMonth} disabled={calYear === today.getFullYear() && calMonth === today.getMonth()} className="btn-ghost p-1.5 disabled:opacity-30">
                      <ChevronRight size={18} />
                    </button>
                    <span className="font-semibold text-gray-700">{MONTHS_HE[calMonth]} {calYear}</span>
                    <button onClick={nextCalMonth} className="btn-ghost p-1.5">
                      <ChevronLeft size={18} />
                    </button>
                  </div>
                  <MonthCalendar
                    year={calYear} month={calMonth}
                    onSelectDate={handleSelectDate}
                    slotDates={slotDates}
                    selectedDate={selectedDate}
                    blockedDates={blockedDates}
                    partialBlockedDates={partialBlockedDates}
                  />
                  {isRecurring && (
                    <p className="text-xs text-blue-600 text-center mt-3 flex items-center justify-center gap-1">
                      <Repeat2 size={12} /> בחר תאריך התחלה לסדרה החוזרת
                    </p>
                  )}
                </>
              )}
            </div>
          )}

          {/* ── STEP: hour ── */}
          {step === 'hour' && (
            <div className="fade-up space-y-4">
              {blockedHoursForDate.size > 0 && (
                <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-2.5 text-sm text-red-700">
                  <span>🚫</span><span>חלק מהשעות חסומות בתאריך זה</span>
                </div>
              )}

              {/* שעת התחלה + סיום */}
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="flex-1">
                  <label className="block text-sm font-medium text-gray-600 mb-1.5">שעת התחלה</label>
                  <select className="input" value={startHour ?? ''} onChange={e => { setStartHour(parseInt(e.target.value)); setEndHour(''); setBookError(''); }}>
                    <option value="">-- בחר --</option>
                    {ALL_HOURS.map(h => {
                      const occ = occupiedHours.has(h);
                      const blk = blockedHoursForDate.has(h);
                      const occupant = daySlots.find(s => h >= s.startHour && h < s.endHour);
                      return <option key={h} value={h} disabled={occ || blk}>
                        {hLabel(h)}{blk ? ' — חסום 🚫' : occ ? ` — תפוס (${occupant?.therapist?.name || ''})` : ''}
                      </option>;
                    })}
                  </select>
                </div>
                <div className="flex-1">
                  <label className="block text-sm font-medium text-gray-600 mb-1.5">שעת סיום</label>
                  <select className="input" value={endHour} disabled={startHour === null} onChange={e => { setBookError(''); setEndHour(e.target.value); }}>
                    <option value="">-- בחר --</option>
                    {startHour !== null && [...ALL_HOURS.filter(h => h > startHour), ...(startHour <= 21 ? [22] : [])].map(h => {
                      const hoursInRange = Array.from({ length: h - startHour }, (_, i) => startHour + i);
                      const isSelfOccupied = occupiedHours.has(h - 1) || blockedHoursForDate.has(h - 1);
                      const hasPriorConflict = hoursInRange.some(x => occupiedHours.has(x) || blockedHoursForDate.has(x));
                      const label = isSelfOccupied
                        ? `${hLabel(h)} — חלון זמן תפוס`
                        : hasPriorConflict
                          ? `${hLabel(h)} — לא ניתן לשבץ`
                          : hLabel(h);
                      return <option key={h} value={h} disabled={hasPriorConflict}>{label}</option>;
                    })}
                  </select>
                  {startHour !== null && <p className="text-xs text-gray-400 mt-1">שעות סיום שחוצות שיבוץ קיים אינן זמינות</p>}
                </div>
              </div>

              {/* שם + הערה */}
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="flex-1">
                  <label className="block text-sm font-medium text-gray-600 mb-1.5">שמך</label>
                  <select className="input" value={therapistId} onChange={e => setTherapistId(e.target.value)}>
                    <option value="">-- בחר --</option>
                    {therapists.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                </div>
                <div className="flex-1">
                  <label className="block text-sm font-medium text-gray-600 mb-1.5">
                    הערה{' '}
                    {isAgaf
                      ? <span className="text-red-500 text-xs font-semibold">* חובה</span>
                      : <span className="text-gray-400 font-normal text-xs">(לא חובה)</span>}
                  </label>
                  <textarea
                    className={`input resize-none${isAgaf && !note.trim() ? ' border-red-300' : ''}`}
                    rows={2}
                    placeholder={isAgaf ? 'נא פרט את מטרת השימוש...' : 'הערה אופציונלית...'}
                    value={note}
                    onChange={e => setNote(e.target.value)}
                    maxLength={200}
                  />
                </div>
              </div>

              {/* הגדרות חוזר */}
              {isRecurring && (
                <div className="border-t border-gray-100 pt-4 space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-600 mb-2">תדירות</label>
                    <div className="flex gap-2 flex-wrap mb-1.5">
                      {FREQ_OPTIONS.map(f => (
                        <button key={f.value} type="button" onClick={() => setRecurFrequency(f.value)}
                          className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-all ${
                            recurFrequency === f.value ? 'bg-green-500 text-white border-green-500' : 'bg-white text-gray-600 border-gray-200 hover:border-green-300'
                          }`}>{f.label}</button>
                      ))}
                    </div>
                    <p className="text-xs text-gray-500">{FREQ_OPTIONS.find(f => f.value === recurFrequency)?.desc}</p>
                  </div>
                  {recurFrequency === 'weekly' && (
                    <div>
                      <label className="block text-sm font-medium text-gray-600 mb-2">ימים בשבוע</label>
                      <div className="flex gap-2">
                        {[0, 1, 2, 3, 4, 5].map(day => (
                          <button key={day} type="button" onClick={() => toggleRecurDay(day)}
                            className={`w-9 h-9 rounded-full text-sm font-bold border transition-all ${
                              recurDays.includes(day) ? 'bg-green-500 text-white border-green-500' : 'bg-white text-gray-500 border-gray-200 hover:border-green-300'
                            }`}>{DAYS_SHORT[day]}</button>
                        ))}
                      </div>
                    </div>
                  )}
                  <div>
                    <label className="block text-sm font-medium text-gray-600 mb-2">סיום הסדרה</label>
                    <div className="flex gap-3 mb-3">
                      {['occurrences', 'date'].map(mode => (
                        <label key={mode} className="flex items-center gap-1.5 cursor-pointer text-sm text-gray-600">
                          <input type="radio" name="endMode" value={mode} checked={recurEndMode === mode}
                            onChange={() => setRecurEndMode(mode)} className="accent-green-500" />
                          {mode === 'occurrences' ? 'לפי מספר מופעים' : 'לפי תאריך סיום'}
                        </label>
                      ))}
                    </div>
                    {recurEndMode === 'occurrences' ? (
                      <div className="flex items-center gap-2">
                        <input type="number" dir="ltr" min={1} max={200} value={recurOccurrences}
                          onChange={e => setRecurOccurrences(e.target.value)}
                          className="input text-center" style={{ width: '5rem' }} />
                        <span className="text-sm text-gray-500">{FREQ_OPTIONS.find(f => f.value === recurFrequency)?.unit || 'מופעים'}</span>
                      </div>
                    ) : (
                      <input type="date" dir="ltr" value={recurEndDate} min={selectedDate}
                        onChange={e => setRecurEndDate(e.target.value)} className="input w-auto" />
                    )}
                  </div>

                  {/* טווח תאריכים + סה"כ מפגשים */}
                  {(() => {
                    const stats = calcRecurStats(selectedDate, recurFrequency, recurDays, recurEndMode, recurOccurrences, recurEndDate);
                    if (!stats) return null;
                    return (
                      <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 space-y-1.5">
                        <div className="flex items-center gap-2 text-sm text-blue-700">
                          <CalendarRange size={15} className="shrink-0" />
                          <span>סדרת הטיפולים תהיה בין <strong>{formatShort(stats.startDate)}</strong> ועד <strong>{formatShort(stats.endDate)}</strong></span>
                        </div>
                        <div className="flex items-center gap-2 text-sm text-blue-600 font-medium">
                          <span className="w-4 h-4 bg-blue-200 rounded-full flex items-center justify-center text-xs text-blue-800 shrink-0">✓</span>
                          <span>סה"כ <strong>{stats.count}</strong> מפגשים</span>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              )}

              {bookError && <p className="text-red-500 text-sm">{bookError}</p>}
              <div className="flex gap-2">
                <button onClick={handleBook} disabled={!startHour || !endHour || !therapistId || booking}
                  className="btn-primary flex-1 py-2.5 px-4">
                  {booking ? 'שומר...' : isRecurring
                    ? `שמור סדרה חוזרת${startHour && endHour ? ` ${hLabel(startHour)}–${hLabel(parseInt(endHour))}` : ''}`
                    : `אשר שיבוץ${startHour && endHour ? ` ${hLabel(startHour)}–${hLabel(parseInt(endHour))}` : ''}`}
                </button>
                <button type="button" onClick={() => { setStep('calendar'); setStartHour(null); setEndHour(''); setBookError(''); }}
                  className="btn-secondary px-4 py-2.5">חזור</button>
              </div>
            </div>
          )}

          {/* ── STEP: scatter ── */}
          {step === 'scatter' && (
            <div className="fade-up">
              {/* Results screen */}
              {scatterResults ? (
                <div className="space-y-4">
                  <div className="flex gap-3">
                    {scatterResults.saved.length > 0 && (
                      <div className="flex-1 bg-green-50 border border-green-200 rounded-xl px-4 py-3 text-center">
                        <p className="text-2xl font-bold text-green-600">{scatterResults.saved.length}</p>
                        <p className="text-xs text-green-700 font-medium">שיבוצים נשמרו</p>
                      </div>
                    )}
                    {scatterResults.failed.length > 0 && (
                      <div className="flex-1 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-center">
                        <p className="text-2xl font-bold text-red-500">{scatterResults.failed.length}</p>
                        <p className="text-xs text-red-600 font-medium">נכשלו</p>
                      </div>
                    )}
                  </div>
                  {scatterResults.failed.length > 0 && (
                    <div>
                      <p className="text-sm font-semibold text-gray-600 mb-2">תאריכים שנכשלו:</p>
                      <div className="space-y-2 max-h-48 overflow-y-auto">
                        {scatterResults.failed.map(e => (
                          <div key={e.id} className="flex items-start justify-between bg-red-50 border border-red-100 rounded-xl px-3 py-2">
                            <span className="text-sm font-medium text-gray-700">{formatDateHe(e.date)}</span>
                            <span className="text-xs text-red-500 text-left mr-2">{hLabel(e.startHour)}–{hLabel(e.endHour)}</span>
                            <span className="text-xs text-red-400">{e.error}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  <div className="flex gap-2 pt-2">
                    <button
                      onClick={() => { setScatterEntries([]); setScatterResults(null); setPendingDate(null); }}
                      className="btn-secondary flex-1 py-2.5">הוסף עוד תאריכים</button>
                    <button onClick={onClose} className="btn-primary flex-1 py-2.5">סיים</button>
                  </div>
                </div>
              ) : (
                <>
                  {/* Therapist + note */}
                  <div className="flex flex-col sm:flex-row gap-3 mb-4">
                    <div className="flex-1">
                      <label className="block text-sm font-medium text-gray-600 mb-1.5">שם המטפל</label>
                      <select className="input" value={scatterTherapistId} onChange={e => setScatterTherapistId(e.target.value)}>
                        <option value="">-- בחר --</option>
                        {therapists.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                      </select>
                    </div>
                    <div className="flex-1">
                      <label className="block text-sm font-medium text-gray-600 mb-1.5">
                        הערה{' '}
                        {isScatterAgaf
                          ? <span className="text-red-500 text-xs font-semibold">* חובה</span>
                          : <span className="text-gray-400 font-normal text-xs">(לא חובה)</span>}
                      </label>
                      <input
                        className={`input${isScatterAgaf && !scatterNote.trim() ? ' border-red-300' : ''}`}
                        placeholder="הערה..."
                        value={scatterNote}
                        onChange={e => setScatterNote(e.target.value)}
                        maxLength={200}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                    {/* Calendar column */}
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <button onClick={prevScatterMonth}
                          disabled={scatterYear === today.getFullYear() && scatterMonth === today.getMonth()}
                          className="btn-ghost p-1.5 disabled:opacity-30">
                          <ChevronRight size={18} />
                        </button>
                        <span className="font-semibold text-gray-700 text-sm">{MONTHS_HE[scatterMonth]} {scatterYear}</span>
                        <button onClick={nextScatterMonth} className="btn-ghost p-1.5">
                          <ChevronLeft size={18} />
                        </button>
                      </div>
                      {dataLoading ? (
                        <div className="text-center text-gray-400 py-6">טוען...</div>
                      ) : (
                        <MonthCalendar
                          year={scatterYear} month={scatterMonth}
                          onSelectDate={handleScatterDateClick}
                          slotDates={slotDates}
                          selectedDate={pendingDate}
                          blockedDates={blockedDates}
                          partialBlockedDates={partialBlockedDates}
                          scatterDates={scatterDates}
                        />
                      )}

                      {/* Inline hour editor */}
                      {pendingDate && (
                        <div className="mt-4 bg-amber-50 border border-amber-200 rounded-2xl p-4 fade-up">
                          <p className="text-sm font-semibold text-amber-800 mb-3">
                            {formatDateHe(pendingDate)} — בחר שעות
                          </p>
                          {occupiedHoursForPending.size > 0 || blockedHoursForPending.size > 0 ? (
                            <p className="text-xs text-orange-600 mb-2">⚠️ חלק מהשעות תפוסות/חסומות</p>
                          ) : null}
                          <div className="flex gap-3 mb-3">
                            <div className="flex-1">
                              <p className="text-xs text-gray-500 mb-1.5">שעת התחלה:</p>
                              <select className="input text-sm" value={scatterStart ?? ''} onChange={e => { setScatterStart(parseInt(e.target.value)); setScatterEnd(''); }}>
                                <option value="">-- בחר --</option>
                                {ALL_HOURS.map(h => {
                                  const occ = occupiedHoursForPending.has(h);
                                  const blk = blockedHoursForPending.has(h);
                                  return <option key={h} value={h} disabled={occ || blk}>{hLabel(h)}{blk ? ' 🚫' : occ ? ' (תפוס)' : ''}</option>;
                                })}
                              </select>
                            </div>
                            <div className="flex-1">
                              <p className="text-xs text-gray-500 mb-1.5">שעת סיום:</p>
                              <select className="input text-sm" value={scatterEnd} disabled={scatterStart === null}
                                onChange={e => { setBookError(''); setScatterEnd(e.target.value); }}>
                                <option value="">-- בחר --</option>
                                {scatterStart !== null && [...ALL_HOURS.filter(h => h > scatterStart), ...(scatterStart <= 21 ? [22] : [])].map(h => {
                                  const hoursInRange = Array.from({ length: h - scatterStart }, (_, i) => scatterStart + i);
                                  const isSelfOccupied = occupiedHoursForPending.has(h - 1) || blockedHoursForPending.has(h - 1);
                                  const hasPriorConflict = hoursInRange.some(x => occupiedHoursForPending.has(x) || blockedHoursForPending.has(x));
                                  const disabled = hasPriorConflict;
                                  const label = isSelfOccupied
                                    ? `${hLabel(h)} — חלון זמן תפוס`
                                    : hasPriorConflict
                                      ? `${hLabel(h)} — לא ניתן לשבץ`
                                      : hLabel(h);
                                  return <option key={h} value={h} disabled={disabled}>{label}</option>;
                                })}
                              </select>
                              <p className="text-xs text-gray-400 mt-1">שעות סיום שחוצות שיבוץ קיים אינן זמינות</p>
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <button onClick={confirmScatterEntry}
                              disabled={!scatterStart || !scatterEnd}
                              className="btn-primary flex-1 py-2 text-sm disabled:opacity-40">
                              הוסף לרשימה
                            </button>
                            <button onClick={() => { setPendingDate(null); setScatterStart(null); setScatterEnd(''); }}
                              className="btn-secondary px-3 py-2 text-sm">ביטול</button>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Entries column */}
                    <div className="flex flex-col">
                      <h3 className="text-sm font-semibold text-gray-600 mb-3 flex items-center gap-1.5">
                        <CalendarRange size={14} className="text-purple-500" />
                        תאריכים שנבחרו
                        {scatterEntries.length > 0 && (
                          <span className="bg-purple-100 text-purple-700 text-xs font-bold px-2 py-0.5 rounded-full mr-1">
                            {scatterEntries.length}
                          </span>
                        )}
                      </h3>
                      {scatterEntries.length === 0 ? (
                        <p className="text-gray-400 text-sm text-center py-6 flex-1 flex items-center justify-center">
                          לחץ על יום בלוח להוספה
                        </p>
                      ) : (
                        <div className="space-y-2 overflow-y-auto flex-1" style={{ maxHeight: '280px' }}>
                          {[...scatterEntries]
                            .sort((a, b) => a.date.localeCompare(b.date))
                            .map(e => (
                              <div key={e.id} className="flex items-center gap-2 bg-purple-50 border border-purple-100 rounded-xl px-3 py-2">
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium text-gray-700 truncate">{formatDateHe(e.date)}</p>
                                  <p className="text-xs text-purple-600">{hLabel(e.startHour)} – {hLabel(e.endHour)}</p>
                                </div>
                                <button
                                  onClick={() => setScatterEntries(prev => prev.filter(x => x.id !== e.id))}
                                  className="text-gray-300 hover:text-red-400 transition-colors shrink-0 p-1">
                                  <X size={14} />
                                </button>
                              </div>
                            ))}
                        </div>
                      )}

                    </div>
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        {/* Footer מוצמד — מוצג רק ב-scatter ולא במסך results */}
        {step === 'scatter' && !scatterResults && (
          <div className="px-5 py-4 border-t border-gray-100 shrink-0 bg-white rounded-b-2xl">
            {bookError && <p className="text-red-500 text-xs mb-2">{bookError}</p>}
            <button
              onClick={handleScatterSave}
              disabled={scatterEntries.length === 0 || !scatterTherapistId || scatterSaving}
              className="btn-primary w-full py-2.5 disabled:opacity-40">
              {scatterSaving
                ? 'שומר...'
                : scatterEntries.length === 0
                  ? 'שמור הכל'
                  : `שמור הכל (${scatterEntries.length} שיבוצים)`}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
