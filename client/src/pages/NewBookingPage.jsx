import React, { useEffect, useState, useMemo } from 'react';
import {
  CalendarDays, Repeat2, CalendarRange, ChevronLeft, ChevronRight,
  CheckCircle, X, AlertTriangle,
} from 'lucide-react';
import { getRoomsSilent, getTherapistsSilent, getScheduleSilent, getRoomNotesSilent, createBookingRequest } from '../services/api';

// ─── helpers ────────────────────────────────────────────────────────────────
const DAYS_HE    = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];
const DAYS_SHORT = ['א', 'ב', 'ג', 'ד', 'ה', 'ו'];
const MONTHS_HE  = ['ינואר','פברואר','מרץ','אפריל','מאי','יוני','יולי','אוגוסט','ספטמבר','אוקטובר','נובמבר','דצמבר'];
const ALL_HOURS  = [8,9,10,11,12,13,14,15,16,17,18,19,20,21];
const FREQ_OPTIONS = [
  { value: 'daily',   label: 'יומי',   desc: 'שיבוץ בכל יום, החל מהתאריך שנבחר',   unit: 'ימים' },
  { value: 'weekly',  label: 'שבועי',  desc: 'שיבוץ בימים קבועים בכל שבוע',        unit: 'שבועות' },
  { value: 'monthly', label: 'חודשי',  desc: 'שיבוץ פעם בחודש, באותו תאריך',       unit: 'חודשים' },
];

function toDateStr(d) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
function hLabel(h) { return `${h}:00`; }
function formatDateHe(ds) {
  const d = new Date(ds + 'T00:00:00');
  return `${DAYS_HE[d.getDay()]} ${d.getDate()} ${MONTHS_HE[d.getMonth()]} ${d.getFullYear()}`;
}
function formatShort(ds) {
  const d = new Date(ds + 'T00:00:00');
  return `${d.getDate()}/${d.getMonth()+1}/${d.getFullYear()}`;
}

function calcRecurStats(startDate, frequency, daysOfWeek, endMode, occurrences, endDate) {
  if (!startDate) return null;
  const start = new Date(startDate + 'T00:00:00');
  if (endMode === 'occurrences' && occurrences >= 1) {
    const n = parseInt(occurrences);
    let lastDate = null, count = 0;
    if (frequency === 'daily') {
      const d = new Date(start); d.setDate(d.getDate() + n - 1);
      lastDate = toDateStr(d); count = n;
    } else if (frequency === 'monthly') {
      const d = new Date(start); d.setMonth(d.getMonth() + n - 1);
      lastDate = toDateStr(d); count = n;
    } else if (frequency === 'weekly') {
      if (!daysOfWeek || daysOfWeek.length === 0) return null;
      const sortedDays = [...daysOfWeek].sort((a,b) => a-b);
      const startOfFirstWeek = new Date(start);
      startOfFirstWeek.setDate(start.getDate() - start.getDay());
      const startOfLastWeek = new Date(startOfFirstWeek);
      startOfLastWeek.setDate(startOfFirstWeek.getDate() + (n-1)*7);
      const lastDay = sortedDays[sortedDays.length-1];
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
      count = Math.floor((end - start) / 86400000) + 1;
    } else if (frequency === 'monthly') {
      count = (end.getFullYear()-start.getFullYear())*12 + (end.getMonth()-start.getMonth()) + 1;
    } else if (frequency === 'weekly') {
      if (!daysOfWeek || daysOfWeek.length === 0) return null;
      const d = new Date(start);
      while (d <= end) { if (daysOfWeek.includes(d.getDay())) count++; d.setDate(d.getDate()+1); }
    }
    return { startDate, endDate, count };
  }
  return null;
}

// ─── MonthCalendar ───────────────────────────────────────────────────────────
function MonthCalendar({ year, month, onSelectDate, slotDates, selectedDate, blockedDates, partialBlockedDates, scatterDates }) {
  const today = new Date(); today.setHours(0,0,0,0);
  const daysInMonth = new Date(year, month+1, 0).getDate();
  const startPad    = new Date(year, month, 1).getDay();
  const cells = [];
  for (let i = 0; i < startPad; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  return (
    <div>
      <div className="grid grid-cols-7 mb-1">
        {DAYS_HE.map(d => <div key={d} className="text-center text-xs text-gray-400 font-medium py-1">{d.slice(0,1)}</div>)}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {cells.map((day, i) => {
          if (!day) return <div key={`p-${i}`} />;
          const d   = new Date(year, month, day);
          const ds  = toDateStr(d);
          const isPast           = d < today;
          const isToday          = ds === toDateStr(today);
          const isSelected       = ds === selectedDate;
          const isScatter        = scatterDates?.has(ds);
          const hasSlot          = slotDates?.has(ds);
          const isBlocked        = blockedDates?.has(ds);
          const isPartialBlocked = !isBlocked && partialBlockedDates?.has(ds);
          return (
            <button key={ds} disabled={isPast || isBlocked}
              onClick={() => !isPast && !isBlocked && onSelectDate(ds)}
              title={isBlocked ? 'חדר חסום' : isPartialBlocked ? 'חלק מהשעות חסומות' : ''}
              className={`relative rounded-xl py-2 text-sm font-medium transition-all flex flex-col items-center gap-0.5
                ${isSelected   ? 'bg-green-500 text-white shadow-md shadow-green-200'
                : isScatter    ? 'bg-blue-100 text-blue-700 border border-blue-300 ring-1 ring-blue-400'
                : isBlocked    ? 'bg-red-100 text-red-400 border border-red-200 cursor-not-allowed'
                : isToday      ? 'bg-green-100 text-green-700 font-bold ring-1 ring-green-300'
                : isPast       ? 'text-gray-200 cursor-not-allowed'
                : isPartialBlocked ? 'bg-orange-50 text-orange-700 border border-orange-200 hover:bg-orange-100'
                : hasSlot      ? 'bg-green-50 text-green-700 border border-green-200'
                : 'text-gray-500 hover:bg-gray-50'}`}>
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

// ─── TYPE PICKER ─────────────────────────────────────────────────────────────
const BOOKING_TYPES = [
  {
    id: 'single',
    icon: CalendarDays,
    iconBg: 'bg-green-100',
    iconColor: 'text-green-600',
    border: 'hover:border-green-400',
    title: 'שיבוץ יחיד',
    subtitle: 'תאריך אחד, שעות קבועות',
    bullets: ['בוחרים תאריך ספציפי', 'קובעים שעת התחלה וסיום', 'מתאים לפגישה חד-פעמית'],
  },
  {
    id: 'recurring',
    icon: Repeat2,
    iconBg: 'bg-blue-100',
    iconColor: 'text-blue-600',
    border: 'hover:border-blue-400',
    title: 'שיבוץ חוזר',
    subtitle: 'יומי, שבועי או חודשי',
    bullets: ['קובעים תדירות חזרה', 'הגדרת ימים בשבוע (לשבועי)', 'מתאים לטיפולים קבועים'],
  },
  {
    id: 'scatter',
    icon: CalendarRange,
    iconBg: 'bg-purple-100',
    iconColor: 'text-purple-600',
    border: 'hover:border-purple-400',
    title: 'שיבוץ תפזורת',
    subtitle: 'ימים נבחרים, שעות שונות',
    bullets: ['בוחרים מספר תאריכים לא רצופים', 'שעות שונות לכל תאריך', 'מתאים ללוח זמנים גמיש'],
  },
];

// ─── MAIN PAGE ────────────────────────────────────────────────────────────────
export default function NewBookingPage() {
  const today    = new Date(); today.setHours(0,0,0,0);
  const todayStr = toDateStr(today);

  // Global state
  const [rooms, setRooms]           = useState([]);
  const [therapists, setTherapists] = useState([]);
  const [roomId, setRoomId]         = useState('');
  const [therapistId, setTherapistId] = useState('');
  const [step, setStep]           = useState('type'); // 'type'|'form'|'success'
  const [bookingType, setBookingType] = useState(null); // 'single'|'recurring'|'scatter'
  const [error, setError]         = useState('');
  const [saving, setSaving]       = useState(false);

  // Calendar / schedule data
  const [allSlots, setAllSlots]         = useState([]);
  const [blockingNotes, setBlockingNotes] = useState([]);
  const [dataLoading, setDataLoading]   = useState(false);

  // Single / recurring
  const [calYear, setCalYear]     = useState(today.getFullYear());
  const [calMonth, setCalMonth]   = useState(today.getMonth());
  const [selectedDate, setSelectedDate] = useState(null);
  const [calStep, setCalStep]     = useState('calendar'); // 'calendar'|'hours'
  const [daySlots, setDaySlots]   = useState([]);
  const [startHour, setStartHour] = useState(null);
  const [endHour, setEndHour]     = useState('');
  const [note, setNote]           = useState('');
  // Recurring settings
  const [recurFrequency, setRecurFrequency]   = useState('weekly');
  const [recurDays, setRecurDays]             = useState([]);
  const [recurEndMode, setRecurEndMode]       = useState('occurrences');
  const [recurOccurrences, setRecurOccurrences] = useState(10);
  const [recurEndDate, setRecurEndDate]       = useState('');

  // Scatter
  const [scatterEntries, setScatterEntries] = useState([]);
  const [pendingDate, setPendingDate]       = useState(null);
  const [scatterStart, setScatterStart]     = useState(null);
  const [scatterEnd, setScatterEnd]         = useState('');
  const [scatterYear, setScatterYear]       = useState(today.getFullYear());
  const [scatterMonth, setScatterMonth]     = useState(today.getMonth());

  // Load rooms + therapists once
  useEffect(() => {
    getRoomsSilent().then(setRooms).catch(() => {});
    getTherapistsSilent().then(setTherapists).catch(() => {});
  }, []);

  // Load schedule data when room selected
  useEffect(() => {
    if (!roomId) return;
    setDataLoading(true);
    const y = today.getFullYear();
    Promise.all([
      getScheduleSilent({ roomId: parseInt(roomId), from: `${y}-01-01`, to: `${y+1}-12-31` }),
      getRoomNotesSilent(parseInt(roomId)),
    ]).then(([slots, notes]) => {
      setAllSlots(slots);
      setBlockingNotes(notes.filter(n => n.blocksBooking));
      setDataLoading(false);
    }).catch(() => setDataLoading(false));
  }, [roomId]);

  // ── derived sets ──
  const slotDates = useMemo(() => {
    const s = new Set();
    allSlots.forEach(sl => s.add(toDateStr(new Date(sl.date))));
    return s;
  }, [allSlots]);

  const { blockedDates, partialBlockedDates } = useMemo(() => {
    const blocked = new Set(), partial = new Set();
    blockingNotes.forEach(n => {
      const start = new Date(n.startDate); start.setHours(0,0,0,0);
      const end   = new Date(n.endDate);   end.setHours(0,0,0,0);
      for (let d = new Date(start); d <= end; d.setDate(d.getDate()+1)) {
        const ds = toDateStr(new Date(d));
        n.startHour == null ? blocked.add(ds) : partial.add(ds);
      }
    });
    return { blockedDates: blocked, partialBlockedDates: partial };
  }, [blockingNotes]);

  const blockedHoursForDate = useMemo(() => {
    if (!selectedDate) return new Set();
    const s = new Set();
    blockingNotes.forEach(n => {
      if (n.startHour == null) return;
      const start = new Date(n.startDate); start.setHours(0,0,0,0);
      const end   = new Date(n.endDate);   end.setHours(0,0,0,0);
      const sel   = new Date(selectedDate + 'T00:00:00');
      if (sel < start || sel > end) return;
      for (let h = n.startHour; h < n.endHour; h++) s.add(h);
    });
    return s;
  }, [blockingNotes, selectedDate]);

  const occupiedHours = useMemo(() => {
    const s = new Set();
    daySlots.forEach(sl => { for (let h = sl.startHour; h < sl.endHour; h++) s.add(h); });
    return s;
  }, [daySlots]);

  const blockedHoursForPending = useMemo(() => {
    if (!pendingDate) return new Set();
    const s = new Set();
    blockingNotes.forEach(n => {
      if (n.startHour == null) return;
      const start = new Date(n.startDate); start.setHours(0,0,0,0);
      const end   = new Date(n.endDate);   end.setHours(0,0,0,0);
      const sel   = new Date(pendingDate + 'T00:00:00');
      if (sel < start || sel > end) return;
      for (let h = n.startHour; h < n.endHour; h++) s.add(h);
    });
    return s;
  }, [blockingNotes, pendingDate]);

  const occupiedHoursForPending = useMemo(() => {
    if (!pendingDate) return new Set();
    const s = new Set();
    allSlots
      .filter(sl => toDateStr(new Date(sl.date)) === pendingDate)
      .forEach(sl => { for (let h = sl.startHour; h < sl.endHour; h++) s.add(h); });
    return s;
  }, [allSlots, pendingDate]);

  const scatterDates = useMemo(() => new Set(scatterEntries.map(e => e.date)), [scatterEntries]);

  // ── handlers ──
  const handleSelectType = (type) => {
    setBookingType(type);
    setStep('form');
    setError('');
    resetForm();
  };

  const resetForm = () => {
    setSelectedDate(null); setCalStep('calendar');
    setStartHour(null); setEndHour(''); setNote('');
    setRecurFrequency('weekly'); setRecurDays([]); setRecurEndMode('occurrences'); setRecurOccurrences(10); setRecurEndDate('');
    setScatterEntries([]); setPendingDate(null); setScatterStart(null); setScatterEnd('');
    setCalYear(today.getFullYear()); setCalMonth(today.getMonth());
    setScatterYear(today.getFullYear()); setScatterMonth(today.getMonth());
    setDaySlots([]);
  };

  const handleSelectDate = async (ds) => {
    setSelectedDate(ds);
    setCalStep('hours');
    setStartHour(null); setEndHour(''); setError('');
    const s = await getScheduleSilent({ roomId: parseInt(roomId), date: ds });
    setDaySlots(s);
  };

  const handleScatterDateClick = (ds) => {
    if (scatterDates.has(ds)) {
      setScatterEntries(prev => prev.filter(e => e.date !== ds));
      if (pendingDate === ds) setPendingDate(null);
      return;
    }
    setPendingDate(ds);
    setScatterStart(null); setScatterEnd('');
  };

  const confirmScatterEntry = () => {
    const end = parseInt(scatterEnd);
    if (!scatterStart || !end || end <= scatterStart) return;
    const conflict = Array.from({ length: end - scatterStart }, (_, i) => scatterStart + i)
      .some(x => occupiedHoursForPending.has(x) || blockedHoursForPending.has(x));
    if (conflict) { setError('הטווח שנבחר חופף שיבוץ קיים בחדר'); return; }
    setError('');
    setScatterEntries(prev => [...prev, { id: crypto.randomUUID(), date: pendingDate, startHour: scatterStart, endHour: end }]);
    setPendingDate(null); setScatterStart(null); setScatterEnd('');
  };

  // ── submit ──
  const handleSubmit = async () => {
    setError('');
    if (!therapistId)    { setError('נא לבחור שם'); return; }
    if (!roomId)         { setError('נא לבחור חדר'); return; }
    if (!note.trim())    { setError('יש למלא הערה — שדה חובה'); return; }
    const therapistName = therapists.find(t => t.id === parseInt(therapistId))?.name || '';

    if (bookingType === 'single' || bookingType === 'recurring') {
      if (!selectedDate)  { setError('נא לבחור תאריך'); return; }
      if (!startHour)     { setError('נא לבחור שעת התחלה'); return; }
      if (!endHour)       { setError('נא לבחור שעת סיום'); return; }
      const end = parseInt(endHour);
      if (daySlots.some(s => startHour < s.endHour && end > s.startHour)) {
        setError('קיים שיבוץ חופף בחדר זה בשעות אלו'); return;
      }
      if (bookingType === 'recurring') {
        if (recurFrequency === 'weekly' && recurDays.length === 0) { setError('יש לבחור לפחות יום אחד'); return; }
        if (recurEndMode === 'occurrences' && (!recurOccurrences || recurOccurrences < 1)) { setError('יש להזין מספר מופעים'); return; }
        if (recurEndMode === 'date' && !recurEndDate) { setError('יש לבחור תאריך סיום'); return; }
      }
      setSaving(true);
      try {
        await createBookingRequest({
          therapistName: therapistName,
          roomId: parseInt(roomId),
          date: selectedDate,
          startHour,
          endHour: end,
          note: note.trim() || undefined,
          bookingType,
          ...(bookingType === 'recurring' ? {
            recurFrequency,
            recurDays: recurFrequency === 'weekly' ? recurDays : [],
            recurEndMode,
            recurOccurrences: recurEndMode === 'occurrences' ? parseInt(recurOccurrences) : null,
            recurEndDate:     recurEndMode === 'date' ? recurEndDate : null,
          } : {}),
        });
        setStep('success');
      } catch (e) {
        setError(e.response?.data?.error || 'שגיאה בשליחת הבקשה');
      } finally { setSaving(false); }

    } else if (bookingType === 'scatter') {
      if (scatterEntries.length === 0) { setError('יש לבחור לפחות תאריך אחד'); return; }
      setSaving(true);
      try {
        // שולח בקשה אחת לכל entry
        for (const entry of scatterEntries) {
          await createBookingRequest({
            therapistName: therapistName,
            roomId: parseInt(roomId),
            date: entry.date,
            startHour: entry.startHour,
            endHour: entry.endHour,
            note: note.trim() || undefined,
            bookingType: 'scatter',
          });
        }
        setStep('success');
      } catch (e) {
        setError(e.response?.data?.error || 'שגיאה בשליחת הבקשה');
      } finally { setSaving(false); }
    }
  };

  const handleBackToTypes = () => {
    setStep('type');
    setBookingType(null);
    resetForm();
    setRoomId('');
    setTherapistId('');
    setError('');
  };

  const prevCalMonth = () => calMonth === 0 ? (setCalYear(y => y-1), setCalMonth(11)) : setCalMonth(m => m-1);
  const nextCalMonth = () => calMonth === 11 ? (setCalYear(y => y+1), setCalMonth(0)) : setCalMonth(m => m+1);
  const prevScatMonth = () => scatterMonth === 0 ? (setScatterYear(y => y-1), setScatterMonth(11)) : setScatterMonth(m => m-1);
  const nextScatMonth = () => scatterMonth === 11 ? (setScatterYear(y => y+1), setScatterMonth(0)) : setScatterMonth(m => m+1);

  const currentType = BOOKING_TYPES.find(t => t.id === bookingType);

  // ── render ──
  return (
    <div className="min-h-screen bg-gray-50" dir="rtl">
      {/* Top bar */}
      <div className="bg-white border-b border-gray-100 shadow-sm">
        <div className="max-w-2xl mx-auto px-4 h-14 flex items-center justify-between">
          <img src="/logo-right.png" alt="מרכז אופק" className="h-8 w-auto object-contain" />
          <span className="text-sm font-semibold text-gray-600">בקשת שיבוץ חדר</span>
          <img src="/logo-left.png" alt="חוף אשקלון" className="h-8 w-auto object-contain" />
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-8">

        {/* ── SUCCESS ─────────────────────────────────────────── */}
        {step === 'success' && (
          <div className="text-center py-16 fade-up">
            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-5">
              <CheckCircle size={44} className="text-green-500" />
            </div>
            <h2 className="text-2xl font-bold text-gray-800 mb-2">הבקשה נשלחה!</h2>
            <p className="text-gray-500 mb-1">הבקשה שלך התקבלה בהצלחה</p>
            <p className="text-gray-400 text-sm mb-8">המנהל יבדוק את הבקשה ויאשר את השיבוץ בהקדם</p>
            <button onClick={handleBackToTypes} className="btn-primary px-8 py-3 text-base">
              שלח בקשה נוספת
            </button>
          </div>
        )}

        {/* ── TYPE PICKER ─────────────────────────────────────── */}
        {step === 'type' && (
          <div className="fade-up">
            <div className="text-center mb-8">
              <h1 className="text-2xl font-bold text-gray-800 mb-2">בחר סוג שיבוץ</h1>
              <p className="text-gray-500 text-sm">בחר את סוג השיבוץ המתאים לצרכיך</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {BOOKING_TYPES.map(type => {
                const Icon = type.icon;
                return (
                  <button key={type.id} onClick={() => handleSelectType(type.id)}
                    className={`bg-white rounded-2xl border-2 border-gray-100 p-6 text-right flex flex-col gap-4 transition-all shadow-sm hover:shadow-md ${type.border}`}>
                    <div className={`w-12 h-12 ${type.iconBg} rounded-xl flex items-center justify-center`}>
                      <Icon size={24} className={type.iconColor} />
                    </div>
                    <div>
                      <p className="font-bold text-gray-800 text-base mb-1">{type.title}</p>
                      <p className="text-xs text-gray-400 mb-3">{type.subtitle}</p>
                      <ul className="space-y-1">
                        {type.bullets.map((b, i) => (
                          <li key={i} className="flex items-start gap-1.5 text-xs text-gray-500">
                            <span className="text-green-400 mt-0.5 shrink-0">✓</span>
                            {b}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* ── FORM ────────────────────────────────────────────── */}
        {step === 'form' && (
          <div className="fade-up">
            {/* Back + title */}
            <div className="flex items-center gap-3 mb-6">
              <button onClick={handleBackToTypes}
                className="p-2 rounded-xl hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors">
                <ChevronRight size={20} />
              </button>
              <div className="flex items-center gap-3">
                {currentType && (
                  <div className={`w-9 h-9 ${currentType.iconBg} rounded-xl flex items-center justify-center`}>
                    {React.createElement(currentType.icon, { size: 18, className: currentType.iconColor })}
                  </div>
                )}
                <div>
                  <h2 className="text-lg font-bold text-gray-800">{currentType?.title}</h2>
                  <p className="text-xs text-gray-400">{currentType?.subtitle}</p>
                </div>
              </div>
            </div>

            {/* שם + חדר — תמיד מוצגים */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 mb-4 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">שמך <span className="text-red-400">*</span></label>
                <select value={therapistId} onChange={e => setTherapistId(e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-300 bg-white">
                  <option value="">בחר שם...</option>
                  {therapists.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">חדר מבוקש <span className="text-red-400">*</span></label>
                <select value={roomId} onChange={e => setRoomId(e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-300 bg-white">
                  <option value="">בחר חדר...</option>
                  {rooms.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                </select>
              </div>
            </div>

            {/* ── Single / Recurring ─────────── */}
            {(bookingType === 'single' || bookingType === 'recurring') && (
              <>
                {/* Calendar */}
                {calStep === 'calendar' && (
                  <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 mb-4">
                    <label className="block text-sm font-semibold text-gray-700 mb-3">
                      {bookingType === 'recurring' ? 'תאריך התחלה לסדרה' : 'תאריך'} <span className="text-red-400">*</span>
                    </label>
                    {!roomId ? (
                      <p className="text-center text-gray-400 text-sm py-6">יש לבחור חדר תחילה</p>
                    ) : dataLoading ? (
                      <p className="text-center text-gray-400 text-sm py-6">טוען...</p>
                    ) : (
                      <>
                        <div className="flex items-center justify-between mb-4">
                          <button onClick={nextCalMonth} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
                            <ChevronRight size={18} className="text-gray-500" />
                          </button>
                          <span className="font-semibold text-gray-700">{MONTHS_HE[calMonth]} {calYear}</span>
                          <button onClick={prevCalMonth} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
                            <ChevronLeft size={18} className="text-gray-500" />
                          </button>
                        </div>
                        <MonthCalendar year={calYear} month={calMonth}
                          onSelectDate={handleSelectDate}
                          slotDates={slotDates} selectedDate={selectedDate}
                          blockedDates={blockedDates} partialBlockedDates={partialBlockedDates} />
                        {bookingType === 'recurring' && (
                          <p className="text-xs text-blue-600 text-center mt-3 flex items-center justify-center gap-1">
                            <Repeat2 size={12}/> בחר תאריך התחלה לסדרה החוזרת
                          </p>
                        )}
                      </>
                    )}
                  </div>
                )}

                {/* Hours form */}
                {calStep === 'hours' && selectedDate && (
                  <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 mb-4 space-y-4">
                    {/* תאריך נבחר + חזור */}
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-semibold text-gray-700">{formatDateHe(selectedDate)}</p>
                        {bookingType === 'recurring' && <p className="text-xs text-blue-500">תאריך התחלה לסדרה</p>}
                      </div>
                      <button onClick={() => { setCalStep('calendar'); setStartHour(null); setEndHour(''); setError(''); }}
                        className="text-xs text-gray-400 hover:text-gray-600 border border-gray-200 rounded-lg px-3 py-1.5 transition-colors">
                        שנה תאריך
                      </button>
                    </div>

                    {blockedHoursForDate.size > 0 && (
                      <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-2.5 text-sm text-red-700">
                        <span>🚫</span><span>חלק מהשעות חסומות בתאריך זה</span>
                      </div>
                    )}

                    {/* שעות */}
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1.5">שעת התחלה</label>
                        <select value={startHour ?? ''} onChange={e => { setStartHour(parseInt(e.target.value)); setEndHour(''); setError(''); }}
                          className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-300 bg-white">
                          <option value="">בחר...</option>
                          {ALL_HOURS.map(h => {
                            const occ = occupiedHours.has(h), blk = blockedHoursForDate.has(h);
                            const occupant = daySlots.find(s => h >= s.startHour && h < s.endHour);
                            return <option key={h} value={h} disabled={occ || blk}>
                              {hLabel(h)}{blk ? ' — חסום 🚫' : occ ? ` — תפוס (${occupant?.therapist?.name || ''})` : ''}
                            </option>;
                          })}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1.5">שעת סיום</label>
                        <select value={endHour} disabled={startHour === null}
                          onChange={e => { setEndHour(e.target.value); setError(''); }}
                          className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-300 bg-white disabled:opacity-40">
                          <option value="">בחר...</option>
                          {startHour !== null && [...ALL_HOURS.filter(h => h > startHour), ...(startHour <= 21 ? [22] : [])].map(h => {
                            const hoursInRange = Array.from({ length: h - startHour }, (_, i) => startHour + i);
                            const isSelfOcc    = occupiedHours.has(h-1) || blockedHoursForDate.has(h-1);
                            const hasPrior     = hoursInRange.some(x => occupiedHours.has(x) || blockedHoursForDate.has(x));
                            return <option key={h} value={h} disabled={hasPrior}>
                              {hLabel(h)}{isSelfOcc ? ' — חלון זמן תפוס' : hasPrior ? ' — לא ניתן לשבץ' : ''}
                            </option>;
                          })}
                        </select>
                      </div>
                    </div>

                    {/* הערה */}
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1.5">הערה <span className="text-red-400">*</span></label>
                      <textarea value={note} onChange={e => setNote(e.target.value)} rows={2} maxLength={200}
                        placeholder="מידע נוסף..." className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-300 resize-none" />
                    </div>

                    {/* הגדרות חוזר */}
                    {bookingType === 'recurring' && (
                      <div className="border-t border-gray-100 pt-4 space-y-4">
                        {/* תדירות */}
                        <div>
                          <label className="block text-sm font-semibold text-gray-700 mb-2">תדירות</label>
                          <div className="flex gap-2 flex-wrap mb-1">
                            {FREQ_OPTIONS.map(f => (
                              <button key={f.value} type="button" onClick={() => setRecurFrequency(f.value)}
                                className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-all ${
                                  recurFrequency === f.value ? 'bg-blue-500 text-white border-blue-500' : 'bg-white text-gray-600 border-gray-200 hover:border-blue-300'
                                }`}>{f.label}</button>
                            ))}
                          </div>
                          <p className="text-xs text-gray-400">{FREQ_OPTIONS.find(f => f.value === recurFrequency)?.desc}</p>
                        </div>

                        {/* ימים בשבוע */}
                        {recurFrequency === 'weekly' && (
                          <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-2">ימים בשבוע</label>
                            <div className="flex gap-2">
                              {[0,1,2,3,4,5].map(day => (
                                <button key={day} type="button"
                                  onClick={() => setRecurDays(prev => prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day])}
                                  className={`w-9 h-9 rounded-full text-sm font-bold border transition-all ${
                                    recurDays.includes(day) ? 'bg-blue-500 text-white border-blue-500' : 'bg-white text-gray-500 border-gray-200 hover:border-blue-300'
                                  }`}>{DAYS_SHORT[day]}</button>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* סיום */}
                        <div>
                          <label className="block text-sm font-semibold text-gray-700 mb-2">סיום הסדרה</label>
                          <div className="flex gap-3 mb-3">
                            {['occurrences','date'].map(mode => (
                              <label key={mode} className="flex items-center gap-1.5 cursor-pointer text-sm text-gray-600">
                                <input type="radio" name="endMode" value={mode}
                                  checked={recurEndMode === mode} onChange={() => setRecurEndMode(mode)}
                                  className="accent-blue-500" />
                                {mode === 'occurrences' ? 'לפי מספר מופעים' : 'לפי תאריך סיום'}
                              </label>
                            ))}
                          </div>
                          {recurEndMode === 'occurrences' ? (
                            <div className="flex items-center gap-2">
                              <input type="number" dir="ltr" min={1} max={200} value={recurOccurrences}
                                onChange={e => setRecurOccurrences(e.target.value)}
                                className="w-20 border border-gray-200 rounded-xl px-3 py-2 text-sm text-center focus:outline-none focus:ring-2 focus:ring-blue-300" />
                              <span className="text-sm text-gray-500">{FREQ_OPTIONS.find(f => f.value === recurFrequency)?.unit}</span>
                            </div>
                          ) : (
                            <input type="date" dir="ltr" value={recurEndDate} min={selectedDate}
                              onChange={e => setRecurEndDate(e.target.value)}
                              className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
                          )}
                        </div>

                        {/* stats */}
                        {(() => {
                          const stats = calcRecurStats(selectedDate, recurFrequency, recurDays, recurEndMode, recurOccurrences, recurEndDate);
                          if (!stats) return null;
                          return (
                            <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 space-y-1.5">
                              <p className="text-sm text-blue-700 flex items-center gap-2">
                                <CalendarRange size={14} className="shrink-0" />
                                סדרת הטיפולים: <strong>{formatShort(stats.startDate)}</strong> עד <strong>{formatShort(stats.endDate)}</strong>
                              </p>
                              <p className="text-sm text-blue-600 font-medium">סה"כ <strong>{stats.count}</strong> מפגשים</p>
                            </div>
                          );
                        })()}
                      </div>
                    )}
                  </div>
                )}
              </>
            )}

            {/* ── Scatter ───────────────────── */}
            {bookingType === 'scatter' && (
              <div className="space-y-4">
                {/* הערה */}
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                  <label className="block text-xs font-medium text-gray-500 mb-1.5">הערה <span className="text-red-400">*</span></label>
                  <input value={note} onChange={e => setNote(e.target.value)} maxLength={200}
                    placeholder="הערה לכל השיבוצים..."
                    className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-300" />
                </div>

                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                  {!roomId ? (
                    <p className="text-center text-gray-400 text-sm py-6">יש לבחור חדר תחילה</p>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                      {/* לוח */}
                      <div>
                        <div className="flex items-center justify-between mb-3">
                          <button onClick={nextScatMonth} className="p-1.5 rounded-lg hover:bg-gray-100">
                            <ChevronRight size={18} className="text-gray-500" />
                          </button>
                          <span className="font-semibold text-gray-700 text-sm">{MONTHS_HE[scatterMonth]} {scatterYear}</span>
                          <button onClick={prevScatMonth} className="p-1.5 rounded-lg hover:bg-gray-100">
                            <ChevronLeft size={18} className="text-gray-500" />
                          </button>
                        </div>
                        {dataLoading ? (
                          <p className="text-center text-gray-400 py-6 text-sm">טוען...</p>
                        ) : (
                          <MonthCalendar year={scatterYear} month={scatterMonth}
                            onSelectDate={handleScatterDateClick}
                            slotDates={slotDates} selectedDate={pendingDate}
                            blockedDates={blockedDates} partialBlockedDates={partialBlockedDates}
                            scatterDates={scatterDates} />
                        )}

                        {/* עורך שעות inline */}
                        {pendingDate && (
                          <div className="mt-4 bg-amber-50 border border-amber-200 rounded-2xl p-4">
                            <p className="text-sm font-semibold text-amber-800 mb-3">{formatDateHe(pendingDate)} — בחר שעות</p>
                            {(occupiedHoursForPending.size > 0 || blockedHoursForPending.size > 0) && (
                              <p className="text-xs text-orange-600 mb-2">⚠️ חלק מהשעות תפוסות/חסומות</p>
                            )}
                            <div className="grid grid-cols-2 gap-2 mb-3">
                              <div>
                                <p className="text-xs text-gray-500 mb-1">שעת התחלה</p>
                                <select value={scatterStart ?? ''} onChange={e => { setScatterStart(parseInt(e.target.value)); setScatterEnd(''); }}
                                  className="w-full border border-gray-200 rounded-xl px-2 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-amber-300">
                                  <option value="">בחר...</option>
                                  {ALL_HOURS.map(h => {
                                    const occ = occupiedHoursForPending.has(h), blk = blockedHoursForPending.has(h);
                                    return <option key={h} value={h} disabled={occ||blk}>{hLabel(h)}{blk?' 🚫':occ?' (תפוס)':''}</option>;
                                  })}
                                </select>
                              </div>
                              <div>
                                <p className="text-xs text-gray-500 mb-1">שעת סיום</p>
                                <select value={scatterEnd} disabled={scatterStart === null}
                                  onChange={e => { setError(''); setScatterEnd(e.target.value); }}
                                  className="w-full border border-gray-200 rounded-xl px-2 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-amber-300 disabled:opacity-40">
                                  <option value="">בחר...</option>
                                  {scatterStart !== null && [...ALL_HOURS.filter(h => h > scatterStart), ...(scatterStart <= 21 ? [22] : [])].map(h => {
                                    const range    = Array.from({ length: h - scatterStart }, (_, i) => scatterStart + i);
                                    const selfOcc  = occupiedHoursForPending.has(h-1) || blockedHoursForPending.has(h-1);
                                    const priorConflict = range.some(x => occupiedHoursForPending.has(x) || blockedHoursForPending.has(x));
                                    return <option key={h} value={h} disabled={priorConflict}>
                                      {hLabel(h)}{selfOcc ? ' — חלון זמן תפוס' : priorConflict ? ' — לא ניתן לשבץ' : ''}
                                    </option>;
                                  })}
                                </select>
                              </div>
                            </div>
                            <div className="flex gap-2">
                              <button onClick={confirmScatterEntry} disabled={!scatterStart || !scatterEnd}
                                className="btn-primary flex-1 py-2 text-sm disabled:opacity-40">הוסף לרשימה</button>
                              <button onClick={() => { setPendingDate(null); setScatterStart(null); setScatterEnd(''); }}
                                className="btn-secondary px-3 py-2 text-sm">ביטול</button>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* רשימת תאריכים */}
                      <div className="flex flex-col">
                        <h3 className="text-sm font-semibold text-gray-600 mb-3 flex items-center gap-1.5">
                          <CalendarRange size={14} className="text-purple-500" />
                          תאריכים שנבחרו
                          {scatterEntries.length > 0 && (
                            <span className="bg-purple-100 text-purple-700 text-xs font-bold px-2 py-0.5 rounded-full">{scatterEntries.length}</span>
                          )}
                        </h3>
                        {scatterEntries.length === 0 ? (
                          <p className="text-gray-400 text-sm text-center py-8 flex-1 flex items-center justify-center">
                            לחץ על יום בלוח להוספה
                          </p>
                        ) : (
                          <div className="space-y-2 max-h-64 overflow-y-auto">
                            {[...scatterEntries].sort((a,b) => a.date.localeCompare(b.date)).map(e => (
                              <div key={e.id} className="flex items-center gap-2 bg-purple-50 border border-purple-100 rounded-xl px-3 py-2">
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium text-gray-700 truncate">{formatDateHe(e.date)}</p>
                                  <p className="text-xs text-purple-600">{hLabel(e.startHour)} – {hLabel(e.endHour)}</p>
                                </div>
                                <button onClick={() => setScatterEntries(prev => prev.filter(x => x.id !== e.id))}
                                  className="text-gray-300 hover:text-red-400 transition-colors p-1">
                                  <X size={14} />
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Error */}
            {error && (
              <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm mt-4">
                <AlertTriangle size={16} className="shrink-0" /> {error}
              </div>
            )}

            {/* Submit */}
            {((bookingType !== 'single' && bookingType !== 'recurring') || calStep === 'hours') && (
              <button onClick={handleSubmit} disabled={saving}
                className="btn-primary w-full py-3 text-base mt-4">
                {saving ? 'שולח בקשה...' : bookingType === 'scatter'
                  ? `שלח בקשה (${scatterEntries.length} שיבוצים)`
                  : 'שלח בקשת שיבוץ'}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
