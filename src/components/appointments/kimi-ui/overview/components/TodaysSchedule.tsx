import { ExternalLink, MoreVertical } from 'lucide-react';
import { schedule } from '../mock-data';

export default function TodaysSchedule() {
  return (
    <div className="ref-card p-5">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <h3 className="text-[15px] font-bold text-gray-900">Today's schedule</h3>
          <span className="ref-pill pill-purple">12</span>
        </div>
        <button className="flex items-center gap-1 text-[12.5px] font-semibold text-indigo-600 hover:text-indigo-700">
          View calendar <ExternalLink size={13} />
        </button>
      </div>
      <div className="divide-y divide-gray-50">
        {schedule.map((a) => (
          <div key={a.time} className="flex items-center gap-4 py-3">
            <div className="w-[64px] shrink-0">
              <div className="text-[13px] font-semibold text-gray-900">{a.time}</div>
              <div className="text-[11px] text-gray-400">{a.dur}</div>
            </div>
            <div className="w-[130px] shrink-0">
              <div className="flex items-center gap-1.5 text-[13px] font-medium text-gray-700">
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />{a.type}
              </div>
              <div className="text-[11px] text-gray-400 pl-3">{a.loc}</div>
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[13px] font-semibold text-gray-900">{a.name}</div>
              <div className="text-[11px] text-gray-400">{a.phone}</div>
            </div>
            <span className={`ref-pill ${a.status === 'Confirmed' ? 'pill-green' : 'pill-amber'}`}>{a.status}</span>
            <button className="text-gray-300 hover:text-gray-500"><MoreVertical size={16} /></button>
          </div>
        ))}
      </div>
      <button className="text-[13px] font-semibold text-indigo-600 hover:text-indigo-700 mt-1">+ 7 more appointments</button>
    </div>
  );
}
