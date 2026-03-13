import React from 'react';
import { User, Clock } from 'lucide-react';

function formatTime(dateStr) {
  return new Date(dateStr).toLocaleTimeString('he-IL', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function RoomCard({ room }) {
  const { name, activeShift } = room;
  const isActive = !!activeShift;

  return (
    <div
      className={`rounded-xl p-6 border-2 transition-all ${
        isActive
          ? 'bg-green-50 border-green-400 shadow-md'
          : 'bg-white border-gray-200 shadow-sm'
      }`}
    >
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-lg font-bold text-gray-800">{name}</h3>
        <span
          className={`text-xs font-semibold px-2 py-1 rounded-full ${
            isActive ? 'bg-green-200 text-green-800' : 'bg-gray-100 text-gray-500'
          }`}
        >
          {isActive ? 'פעיל' : 'פנוי'}
        </span>
      </div>

      {isActive ? (
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-gray-700">
            <User size={16} className="text-green-600" />
            <span className="font-medium">{activeShift.therapist.name}</span>
          </div>
          <div className="flex items-center gap-2 text-gray-500 text-sm">
            <Clock size={14} />
            <span>מאז {formatTime(activeShift.startTime)}</span>
          </div>
        </div>
      ) : (
        <p className="text-gray-400 text-sm">אין מטפל בחדר</p>
      )}
    </div>
  );
}
