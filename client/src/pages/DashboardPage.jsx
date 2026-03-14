import React, { useEffect, useState } from 'react';
import { getRooms, getSchedule } from '../services/api';
import { RefreshCw, User, Clock, CalendarDays, LayoutGrid, List } from 'lucide-react';

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

function RoomCard({ room, slots }) {
  const { dateStr, hour, minute } = getNow();
  const nowDecimal = hour + minute / 60;

  const todaySlots = slots
    .filter((s) => s.roomId === room.id && toDateStr(new Date(s.date)) === dateStr)
    .sort((a, b) => a.startHour - b.startHour);

  const active = todaySlots.find((s) => nowDecimal >= s.startHour && nowDecimal < s.endHour);
  const next = !active ? todaySlots.find((s) => s.startHour > hour) : null;
  const isActive = !!active;

  return (
    <div className={`rounded-xl p-5 border-2 transition-all ${
      isActive ? 'bg-green-50 border-green-400 shadow-md' : 'bg-white border-gray-200 shadow-sm'
    }`}>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-lg font-bold text-gray-800">{room.name}</h3>
        <span className={`text-xs font-semibold px-2 py-1 rounded-full ${
          isActive ? 'bg-green-200 text-green-800' : 'bg-gray-100 text-gray-500'
        }`}>{isActive ? 'פעיל' : 'פנוי'}</span>
      </div>
      {active && (
        <div className="space-y-1.5">
          <div className="flex items-center gap-2 text-gray-700">
            <User size={15} className="text-green-600 shrink-0" />
            <span className="font-semibold">{active.therapist.name}</span>
          </div>
          <div className="flex items-center gap-2 text-gray-500 text-sm">
            <Clock size={13} className="shrink-0" />
            <span>{hLabel(active.startHour)} – {hLabel(active.endHour)}</span>
          </div>
        </div>
      )}
      {!active && next && (
        <div className="space-y-1.5">
          <div className="flex items-center gap-2 text-gray-400 text-sm">
            <CalendarDays size={13} className="shrink-0" /><span>הבא היום:</span>
          </div>
          <div className="flex items-center gap-2 text-gray-600">
            <User size={15} className="text-blue-400 shrink-0" />
            <span className="font-medium">{next.therapist.name}</span>
          </div>
          <div className="flex items-center gap-2 text-blue-500 text-sm font-medium">
            <Clock size={13} className="shrink-0" />
            <span>{hLabel(next.startHour)} – {hLabel(next.endHour)}</span>
          </div>
        </div>
      )}
      {!active && !next && <p className="text-gray-400 text-sm">אין שיבוץ היום</p>}
    </div>
  );
}

function TimelineView({ rooms, slots }) {
  const { dateStr, hour, minute } = getNow();
  const nowDecimal = hour + minute / 60;
  const totalHours = HOURS[HOURS.length - 1] + 1 - HOURS[0];
  const nowPct = ((nowDecimal - HOURS[0]) / totalHours) * 100;

  const todayRooms = rooms.map((room) => ({
    ...room,
    daySlots: slots
      .filter((s) => s.roomId === room.id && toDateStr(new Date(s.date)) === dateStr)
      .sort((a, b) => a.startHour - b.startHour),
  }));

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
      <div className="flex border-b border-gray-100 bg-gray-50">
        <div className="w-24 shrink-0 px-3 py-2 text-xs text-gray-400 font-medium">חדר</div>
        <div className="flex-1 relative h-8">
          {HOURS.map((h) => (
            <div key={h} className="absolute top-0 text-xs text-gray-400 -translate-x-1/2"
              style={{ left: `${((h - HOURS[0]) / totalHours) * 100}%` }}>
              <div className="h-2 border-r border-gray-200 mx-auto w-px mb-0.5" />
              {hLabel(h)}
            </div>
          ))}
        </div>
      </div>
      {todayRooms.map((room, ri) => (
        <div key={room.id} className={`flex items-center border-b border-gray-50 last:border-0 ${ri % 2 === 0 ? '' : 'bg-gray-50/50'}`}>
          <div className="w-24 shrink-0 px-3 py-3 text-sm font-medium text-gray-700 truncate">{room.name}</div>
          <div className="flex-1 relative h-10 my-1">
            {nowDecimal >= HOURS[0] && nowDecimal <= HOURS[HOURS.length-1]+1 && (
              <div className="absolute top-0 bottom-0 w-0.5 bg-red-400 z-10"
                style={{ left: `${((nowDecimal - HOURS[0]) / totalHours) * 100}%` }} />
            )}
            {room.daySlots.map((s) => {
              const left = ((s.startHour - HOURS[0]) / totalHours) * 100;
              const width = ((s.endHour - s.startHour) / totalHours) * 100;
              const isNow = nowDecimal >= s.startHour && nowDecimal < s.endHour;
              return (
                <div key={s.id}
                  className={`absolute top-1 bottom-1 rounded-lg flex items-center px-2 text-xs font-medium overflow-hidden ${
                    isNow ? 'bg-green-400 text-white' : s.startHour > nowDecimal ? 'bg-blue-100 text-blue-700' : 'bg-gray-200 text-gray-500'
                  }`}
                  style={{ left: `${left}%`, width: `${width}%` }}
                  title={`${s.therapist.name} ${hLabel(s.startHour)}–${hLabel(s.endHour)}`}
                >
                  <span className="truncate">{s.therapist.name}</span>
                </div>
              );
            })}
            {room.daySlots.length === 0 && (
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-dashed border-gray-100" />
              </div>
            )}
          </div>
        </div>
      ))}
      <div className="flex gap-4 px-4 py-2 border-t border-gray-100 bg-gray-50 text-xs text-gray-400">
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-green-400 inline-block"/> פעיל עכשיו</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-blue-100 inline-block"/> הבא</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-gray-200 inline-block"/> עבר</span>
        <span className="flex items-center gap-1"><span className="w-0.5 h-3 bg-red-400 inline-block"/> עכשיו</span>
      </div>
    </div>
  );
}

function WhoIsIn({ slots }) {
  const { dateStr, hour, minute } = getNow();
  const nowDecimal = hour + minute / 60;
  const activeSlots = slots.filter(
    (s) => toDateStr(new Date(s.date)) === dateStr && nowDecimal >= s.startHour && nowDecimal < s.endHour
  );
  if (activeSlots.length === 0) return null;
  return (
    <div className="bg-green-50 border border-green-200 rounded-xl p-4 mb-6">
      <h2 className="text-sm font-semibold text-green-800 mb-3 flex items-center gap-2">
        <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse inline-block" />
        בבניין עכשיו ({activeSlots.length})
      </h2>
      <div className="flex flex-wrap gap-2">
        {activeSlots.map((s) => (
          <div key={s.id} className="flex items-center gap-2 bg-white border border-green-200 rounded-lg px-3 py-1.5">
            <User size={13} className="text-green-600" />
            <span className="text-sm font-medium text-gray-800">{s.therapist.name}</span>
            <span className="text-xs text-gray-400">{s.room.name}</span>
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

  const fetchData = async () => {
    try {
      const today = new Date();
      const todayStr = toDateStr(today);
      const [r, s] = await Promise.all([
        getRooms(),
        getSchedule({ date: todayStr }),
      ]);
      setRooms(r); setSlots(s);
      setLastUpdated(new Date());
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
    slots.filter((s) => toDateStr(new Date(s.date)) === dateStr && nowDecimal >= s.startHour && nowDecimal < s.endHour)
      .map((s) => s.roomId)
  ).size;

  const now = new Date();

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">דשבורד</h1>
          <p className="text-gray-500 text-sm mt-1">
            {DAYS_HE[now.getDay()]} {now.getDate()} {MONTHS_HE[now.getMonth()]} · {activeRoomCount} מתוך {rooms.length} חדרים פעילים
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex bg-gray-100 rounded-lg p-1">
            <button onClick={() => setView('grid')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                view === 'grid' ? 'bg-white shadow-sm text-gray-800' : 'text-gray-500 hover:text-gray-700'
              }`}>
              <LayoutGrid size={15} /> כרטיסים
            </button>
            <button onClick={() => setView('timeline')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                view === 'timeline' ? 'bg-white shadow-sm text-gray-800' : 'text-gray-500 hover:text-gray-700'
              }`}>
              <List size={15} /> ציר זמן
            </button>
          </div>
          <button onClick={fetchData}
            className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-600 px-2 py-2 rounded-lg hover:bg-gray-100 transition-colors">
            <RefreshCw size={14} />
            {lastUpdated && lastUpdated.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}
          </button>
        </div>
      </div>

      {loading ? (
        <div className="text-center text-gray-400 py-20">טוען...</div>
      ) : (
        <>
          <WhoIsIn slots={slots} />
          {view === 'grid' ? (
            rooms.length === 0
              ? <div className="text-center text-gray-400 py-20">אין חדרים. הוסף חדרים בפאנל המנהל.</div>
              : <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {rooms.map((room) => <RoomCard key={room.id} room={room} slots={slots} />)}
                </div>
          ) : (
            <TimelineView rooms={rooms} slots={slots} />
          )}
        </>
      )}
    </div>
  );
}
