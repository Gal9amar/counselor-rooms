import React, { useEffect, useState } from 'react';
import { getRooms } from '../services/api';
import RoomCard from '../components/RoomCard';
import { RefreshCw } from 'lucide-react';

export default function DashboardPage() {
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(null);

  const fetchRooms = async () => {
    try {
      const data = await getRooms();
      setRooms(data);
      setLastUpdated(new Date());
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRooms();
    const interval = setInterval(fetchRooms, 30000);
    return () => clearInterval(interval);
  }, []);

  const activeCount = rooms.filter((r) => r.activeShift).length;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">דשבורד חדרים</h1>
          <p className="text-gray-500 text-sm mt-1">
            {activeCount} מתוך {rooms.length} חדרים פעילים
          </p>
        </div>
        <button
          onClick={fetchRooms}
          className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 px-3 py-2 rounded-lg hover:bg-gray-100 transition-colors"
        >
          <RefreshCw size={14} />
          {lastUpdated && `עודכן ${lastUpdated.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}`}
        </button>
      </div>

      {loading ? (
        <div className="text-center text-gray-400 py-20">טוען...</div>
      ) : rooms.length === 0 ? (
        <div className="text-center text-gray-400 py-20">אין חדרים. הוסף חדרים בעמוד המנהל.</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {rooms.map((room) => (
            <RoomCard key={room.id} room={room} />
          ))}
        </div>
      )}
    </div>
  );
}
