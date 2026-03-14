import React, { useEffect, useState } from 'react';
import { getHistory, getTherapists } from '../services/api';

function formatDate(dateStr) {
  return new Date(dateStr).toLocaleDateString('he-IL');
}
function formatTime(dateStr) {
  return new Date(dateStr).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });
}
function duration(start, end) {
  const ms = new Date(end) - new Date(start);
  const mins = Math.floor(ms / 60000);
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h > 0 ? `${h}ש' ${m}ד'` : `${m}ד'`;
}

// Mobile card view for a single shift
function ShiftCard({ shift }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-2">
      <div className="flex items-center justify-between">
        <span className="font-semibold text-gray-800">{shift.therapist.name}</span>
        <span className="text-xs bg-gray-100 text-gray-500 px-2 py-1 rounded-full">{shift.room.name}</span>
      </div>
      <div className="flex gap-4 text-sm text-gray-500">
        <span>{formatDate(shift.startTime)}</span>
        <span>{formatTime(shift.startTime)} – {formatTime(shift.endTime)}</span>
        <span className="text-gray-400">{duration(shift.startTime, shift.endTime)}</span>
      </div>
    </div>
  );
}

export default function HistoryPage() {
  const [shifts, setShifts] = useState([]);
  const [therapists, setTherapists] = useState([]);
  const [filterTherapist, setFilterTherapist] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getTherapists().then(setTherapists);
  }, []);

  useEffect(() => {
    setLoading(true);
    getHistory(filterTherapist || null)
      .then(setShifts)
      .finally(() => setLoading(false));
  }, [filterTherapist]);

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <h1 className="text-2xl font-bold text-gray-900">היסטוריית משמרות</h1>
        <select
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 w-full sm:w-auto"
          value={filterTherapist}
          onChange={(e) => setFilterTherapist(e.target.value)}
        >
          <option value="">כל המטפלים</option>
          {therapists.map((t) => (
            <option key={t.id} value={t.id}>{t.name}</option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className="text-center text-gray-400 py-20">טוען...</div>
      ) : shifts.length === 0 ? (
        <div className="text-center text-gray-400 py-20">אין היסטוריה להצגה</div>
      ) : (
        <>
          {/* Mobile: cards */}
          <div className="sm:hidden space-y-3">
            {shifts.map((shift) => <ShiftCard key={shift.id} shift={shift} />)}
          </div>

          {/* Desktop: table */}
          <div className="hidden sm:block bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-right px-4 py-3 font-medium text-gray-600">מטפל</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600">חדר</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600">תאריך</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600">כניסה</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600">יציאה</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600">משך</th>
                </tr>
              </thead>
              <tbody>
                {shifts.map((shift, i) => (
                  <tr key={shift.id} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                    <td className="px-4 py-3 font-medium text-gray-800">{shift.therapist.name}</td>
                    <td className="px-4 py-3 text-gray-600">{shift.room.name}</td>
                    <td className="px-4 py-3 text-gray-600">{formatDate(shift.startTime)}</td>
                    <td className="px-4 py-3 text-gray-600">{formatTime(shift.startTime)}</td>
                    <td className="px-4 py-3 text-gray-600">{formatTime(shift.endTime)}</td>
                    <td className="px-4 py-3 text-gray-500">{duration(shift.startTime, shift.endTime)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
