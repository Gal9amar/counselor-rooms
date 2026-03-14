import React, { useEffect, useState } from 'react';
import { getRooms, getSchedule } from '../services/api';
import { RefreshCw, User, Clock, CalendarDays } from 'lucide-react';

// day-of-week matching Israel: 0=Sun,1=Mon,...,6=Sat
function getNow() {
  const now = new Date();
  return {
    day: now.getDay(),       // 0=Sun
    hour: now.getHours(),
    minute: now.getMinutes(),
  };
}

function hourLabel(h) { return `${h}:00`; }

function RoomCard({ room, slots }) {
  const { day, hour, minute } = getNow();
  const nowDecimal = hour + minute / 60;

  // slots for this room today
  const todaySlots = slots
    .filter((s) => s.roomId === room.id && s.dayOfWeek === day)
    .sort((a, b) => a.startHour - b.startHour);

  // active right now
  const active = todaySlots.find(
    (s) => nowDecimal >= s.startHour && nowDecimal < s.endHour
  );

  // next upcoming today
  const next = !active
    ? todaySlots.find((s) => s.startHour > hour)
    : null;

  const isActive = !!active;

  return (
    <div className={`rounded-xl p-5 border-2 transition-all ${
      isActive
        ? 'bg-green-50 border-green-400 shadow-md'
        : 'bg-white border-gray-200 shadow-sm'
    }`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-lg font-bold text-gray-800">{room.name}</h3>
        <span className={`text-xs font-semibold px-2 py-1 rounded-full ${
          isActive ? 'bg-green-200 text-green-800' : 'bg-gray-100 text-gray-500'
        }`}>
          {isActive ? 'פעיל' : 'פנוי'}
        </span>
      </div>

      {/* Active now */}
      {active && (
        <div className="space-y-1.5">
          <div className="flex items-center gap-2 text-gray-700">
            <User size={15} className="text-green-600 shrink-0" />
            <span className="font-semibold">{active.therapist.name}</span>
          </div>
          <div className="flex items-center gap-2 text-gray-500 text-sm">
            <Clock size={13} className="shrink-0" />
            <span>{hourLabel(active.startHour)} – {hourLabel(active.endHour)}</span>
          </div>
        </div>
      )}

      {/* Next upcoming */}
      {!active && next && (
        <div className="space-y-1.5">
          <div className="flex items-center gap-2 text-gray-400 text-sm">
            <CalendarDays size={13} className="shrink-0" />
            <span>הבא היום:</span>
          </div>
          <div className="flex items-center gap-2 text-gray-600">
            <User size={15} className="text-blue-400 shrink-0" />
            <span className="font-medium">{next.therapist.name}</span>
          </div>
          <div className="flex items-center gap-2 text-blue-500 text-sm font-medium">
            <Clock size={13} className="shrink-0" />
            <span>{hourLabel(next.startHour)} – {hourLabel(next.endHour)}</span>
          </div>
        </div>
      )}

      {/* No schedule today */}
      {!active && !next && (
        <p className="text-gray-400 text-sm">אין שיבוץ היום</p>
      )}
    </div>
  );
}

export default function DashboardPage() {
  const [rooms, setRooms] = useState([]);
  const [slots, setSlots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(null);

  const fetchData = async () => {
    try {
      const [r, s] = await Promise.all([getRooms(), getSchedule()]);
      setRooms(r);
      setSlots(s);
      setLastUpdated(new Date());
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 60000); // refresh every minute
    return () => clearInterval(interval);
  }, []);

  const { day, hour, minute } = getNow();
  const nowDecimal = hour + minute / 60;

  const activeCount = rooms.filter((room) =>
    slots.some(
      (s) => s.roomId === room.id && s.dayOfWeek === day &&
        nowDecimal >= s.startHour && nowDecimal < s.endHour
    )
  ).length;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">דשבורד חדרים</h1>
          <p className="text-gray-500 text-sm mt-1">
            {activeCount} מתוך {rooms.length} חדרים פעילים כעת
          </p>
        </div>
        <button
          onClick={fetchData}
          className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 px-3 py-2 rounded-lg hover:bg-gray-100 transition-colors"
        >
          <RefreshCw size={14} />
          {lastUpdated && lastUpdated.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}
        </button>
      </div>

      {loading ? (
        <div className="text-center text-gray-400 py-20">טוען...</div>
      ) : rooms.length === 0 ? (
        <div className="text-center text-gray-400 py-20">אין חדרים. הוסף חדרים בפאנל המנהל.</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {rooms.map((room) => (
            <RoomCard key={room.id} room={room} slots={slots} />
          ))}
        </div>
      )}
    </div>
  );
}
