import React, { useEffect, useState, useCallback } from 'react';
import { getRooms, getSchedule } from '../services/api';
import { RefreshCw, User, Clock, CalendarDays, LayoutGrid, List, X, ChevronLeft, ChevronRight } from 'lucide-react';

const HOURS=[8,9,10,11,12,13,14,15,16,17,18,19,20,21];
const DAYS_HE=['ראשון','שני','שלישי','רביעי','חמישי','שישי','שבת'];
const MONTHS_HE=['ינואר','פברואר','מרץ','אפריל','מאי','יוני','יולי','אוגוסט','ספטמבר','אוקטובר','נובמבר','דצמבר'];

function toDateStr(d){return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;}
function hLabel(h){return `${h}:00`;}
function getNow(){const n=new Date();return{dateStr:toDateStr(n),hour:n.getHours(),minute:n.getMinutes()};}
function formatDateHe(ds){const d=new Date(ds+'T00:00:00');return `${DAYS_HE[d.getDay()]} ${d.getDate()} ${MONTHS_HE[d.getMonth()]}`;}

function RoomModal({room,onClose}){
  const today=new Date();today.setHours(0,0,0,0);
  const [year,setYear]=useState(today.getFullYear());
  const [month,setMonth]=useState(today.getMonth());
  const [slots,setSlots]=useState([]);
  const [loading,setLoading]=useState(true);

  const load=useCallback(async(y,m)=>{
    setLoading(true);
    const from=`${y}-${String(m+1).padStart(2,'0')}-01`;
    const lastDay=new Date(y,m+1,0).getDate();
    const to=`${y}-${String(m+1).padStart(2,'0')}-${String(lastDay).padStart(2,'0')}`;
    try{const s=await getSchedule({roomId:room.id,from,to});setSlots(s);}
    finally{setLoading(false);}
  },[room.id]);

  useEffect(()=>{load(year,month);},[year,month,load]);

  const prevMonth=()=>{if(month===0){setYear(y=>y-1);setMonth(11);}else setMonth(m=>m-1);};
  const nextMonth=()=>{if(month===11){setYear(y=>y+1);setMonth(0);}else setMonth(m=>m+1);};

  const slotsByDate={};
  slots.forEach(s=>{const k=toDateStr(new Date(s.date));if(!slotsByDate[k])slotsByDate[k]=[];slotsByDate[k].push(s);});
  const daysInMonth=new Date(year,month+1,0).getDate();
  const startPad=new Date(year,month,1).getDay();
  const cells=[];
  for(let i=0;i<startPad;i++)cells.push(null);
  for(let d=1;d<=daysInMonth;d++)cells.push(d);
  const isPrevDisabled=year===today.getFullYear()&&month===today.getMonth();

  return(
    <div className="fixed inset-0 bg-black/30 backdrop-blur-[2px] z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col fade-up border border-gray-100" onClick={e=>e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div>
            <h2 className="text-lg font-bold text-gray-800">{room.name}</h2>
            <p className="text-xs text-gray-400 mt-0.5">לוח שיבוצים חודשי</p>
          </div>
          <button onClick={onClose} className="btn-ghost p-1.5"><X size={20}/></button>
        </div>
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
          <button onClick={prevMonth} disabled={isPrevDisabled} className="btn-ghost p-1.5 disabled:opacity-30"><ChevronRight size={18}/></button>
          <span className="font-semibold text-gray-700">{MONTHS_HE[month]} {year}</span>
          <button onClick={nextMonth} className="btn-ghost p-1.5"><ChevronLeft size={18}/></button>
        </div>
        <div className="overflow-y-auto flex-1 px-5 py-4">
          {loading ? <div className="text-center text-gray-400 py-10">טוען...</div> : (
            <>
              <div className="grid grid-cols-7 mb-1">
                {DAYS_HE.map(d=><div key={d} className="text-center text-xs text-gray-400 font-medium py-1">{d.slice(0,1)}</div>)}
              </div>
              <div className="grid grid-cols-7 gap-1 mb-5">
                {cells.map((day,i)=>{
                  if(!day)return<div key={`p-${i}`}/>;
                  const d=new Date(year,month,day);
                  const ds=toDateStr(d);
                  const isPast=d<today;
                  const isToday=ds===toDateStr(today);
                  const hasSlot=!!(slotsByDate[ds]?.length);
                  return(
                    <div key={ds} className={`rounded-xl py-1.5 text-sm text-center flex flex-col items-center gap-0.5 ${
                      isToday?'bg-green-100 font-bold text-green-700 ring-1 ring-green-300'
                      :isPast?'text-gray-200'
                      :hasSlot?'bg-green-50 text-green-700 font-medium'
                      :'text-gray-500'}`}>
                      {day}
                      {hasSlot&&!isPast&&<span className={`w-1.5 h-1.5 rounded-full ${isToday?'bg-green-500':'bg-green-400'}`}/>}
                    </div>
                  );
                })}
              </div>
              {Object.keys(slotsByDate).length===0?(
                <p className="text-center text-gray-400 text-sm py-4">אין שיבוצים בחודש זה</p>
              ):(
                <div className="space-y-3">
                  {Object.keys(slotsByDate).sort().map(ds=>{
                    const d=new Date(ds+'T00:00:00');
                    const isPast=d<today;
                    return(
                      <div key={ds}>
                        <div className={`text-xs font-semibold mb-1.5 ${isPast?'text-gray-300':'text-gray-500'}`}>{formatDateHe(ds)}</div>
                        <div className="space-y-1">
                          {slotsByDate[ds].sort((a,b)=>a.startHour-b.startHour).map(s=>(
                            <div key={s.id} className={`flex items-center justify-between rounded-xl px-3 py-2 ${isPast?'bg-gray-50 border border-gray-100':'bg-green-50 border border-green-100'}`}>
                              <div className="flex items-center gap-2">
                                <User size={13} className={isPast?'text-gray-300':'text-green-500'}/>
                                <span className={`text-sm font-medium ${isPast?'text-gray-400':'text-gray-700'}`}>{s.therapist.name}</span>
                              </div>
                              <span className={`text-xs font-medium ${isPast?'text-gray-300':'text-green-600'}`}>{hLabel(s.startHour)} – {hLabel(s.endHour)}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function RoomCard({room,slots,onClick,index}){
  const {dateStr,hour,minute}=getNow();
  const nowDecimal=hour+minute/60;
  const todaySlots=slots.filter(s=>s.roomId===room.id&&toDateStr(new Date(s.date))===dateStr).sort((a,b)=>a.startHour-b.startHour);
  const active=todaySlots.find(s=>nowDecimal>=s.startHour&&nowDecimal<s.endHour);
  const next=!active?todaySlots.find(s=>s.startHour>hour):null;
  const isActive=!!active;

  return(
    <button onClick={onClick}
      className={`w-full text-right rounded-2xl p-5 border-2 transition-all duration-200 fade-up-${Math.min(index,3)} card card-clickable ${isActive?'card-active':''}`}>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-base font-semibold text-gray-800">{room.name}</h3>
        <span className={isActive?'badge-active':'badge-free'}>
          {isActive?<span className="flex items-center gap-1"><span className="w-1.5 h-1.5 bg-green-500 rounded-full pulse-dot inline-block"/>פעיל</span>:'פנוי'}
        </span>
      </div>
      {active&&(
        <div className="space-y-1.5">
          <div className="flex items-center gap-2 text-gray-700"><User size={14} className="text-green-500 shrink-0"/><span className="font-semibold">{active.therapist.name}</span></div>
          <div className="flex items-center gap-2 text-gray-400 text-sm"><Clock size={12} className="shrink-0"/><span>{hLabel(active.startHour)} – {hLabel(active.endHour)}</span></div>
        </div>
      )}
      {!active&&next&&(
        <div className="space-y-1.5">
          <div className="flex items-center gap-1.5 text-gray-400 text-xs"><CalendarDays size={12} className="shrink-0"/><span>הבא היום:</span></div>
          <div className="flex items-center gap-2 text-gray-700"><User size={14} className="text-green-400 shrink-0"/><span className="font-medium">{next.therapist.name}</span></div>
          <div className="flex items-center gap-2 text-green-600 text-sm"><Clock size={12} className="shrink-0"/><span>{hLabel(next.startHour)} – {hLabel(next.endHour)}</span></div>
        </div>
      )}
      {!active&&!next&&<p className="text-gray-400 text-sm">אין שיבוץ היום</p>}
      <p className="text-xs text-gray-300 mt-3 pt-3 border-t border-gray-100">לחץ לצפייה בלוח החודשי</p>
    </button>
  );
}

function TimelineView({rooms,slots}){
  const {dateStr,hour,minute}=getNow();
  const nowDecimal=hour+minute/60;
  const totalHours=HOURS[HOURS.length-1]+1-HOURS[0];
  const ROOM_COL=112; // px, matches w-28

  const todayRooms=rooms.map(room=>({
    ...room,
    daySlots:slots.filter(s=>s.roomId===room.id&&toDateStr(new Date(s.date))===dateStr).sort((a,b)=>a.startHour-b.startHour)
  }));

  // pct: 0% = 8:00 (left), 100% = 21:00 (right)
  const pct=(h)=>`${((h-HOURS[0])/totalHours)*100}%`;

  return(
    <div className="card rounded-2xl overflow-hidden fade-up" style={{direction:'ltr'}}>
      {/* Header row */}
      <div className="flex border-b border-gray-100 bg-gray-50" style={{direction:'ltr'}}>
        {/* Timeline axis */}
        <div className="flex-1 relative h-9 border-r border-gray-100">
          {HOURS.map(h=>(
            <div key={h} className="absolute top-0 text-xs text-gray-400" style={{left:pct(h),transform:'translateX(-50%)'}}>
              <div className="h-2 border-r border-gray-200 mx-auto w-px mb-0.5"/>
              {hLabel(h)}
            </div>
          ))}
        </div>
        {/* Room column header */}
        <div style={{width:ROOM_COL,flexShrink:0}} className="px-4 py-2.5 text-xs text-gray-400 font-medium text-center">חדר</div>
      </div>

      {/* Data rows */}
      {todayRooms.map((room,ri)=>(
        <div key={room.id} className={`flex items-center border-b border-gray-50 last:border-0 ${ri%2===0?'bg-white':'bg-gray-50/50'}`} style={{direction:'ltr'}}>
          {/* Bar area */}
          <div className="flex-1 relative h-10 my-1 border-r border-gray-100">
            {/* Now line */}
            {nowDecimal>=HOURS[0]&&nowDecimal<=HOURS[HOURS.length-1]+1&&(
              <div className="absolute top-0 bottom-0 w-0.5 bg-green-400 z-10" style={{left:pct(nowDecimal)}}/>
            )}
            {/* Slots */}
            {room.daySlots.map(s=>{
              const isNow=nowDecimal>=s.startHour&&nowDecimal<s.endHour;
              const isPast=s.endHour<=nowDecimal;
              return(
                <div key={s.id}
                  className={`absolute top-1 bottom-1 rounded-lg flex items-center px-2 text-xs font-medium overflow-hidden ${
                    isNow?'bg-gradient-to-r from-green-500 to-green-400 text-white shadow-md shadow-green-200'
                    :isPast?'bg-gray-100 text-gray-400'
                    :'bg-green-100 text-green-700 border border-green-200'
                  }`}
                  style={{left:pct(s.startHour), width:`${((s.endHour-s.startHour)/totalHours)*100}%`}}
                  title={`${s.therapist.name} ${hLabel(s.startHour)}–${hLabel(s.endHour)}`}>
                  <span className="truncate">{s.therapist.name}</span>
                </div>
              );
            })}
            {room.daySlots.length===0&&(
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-dashed border-gray-200"/>
              </div>
            )}
          </div>
          {/* Room name — right side */}
          <div style={{width:ROOM_COL,flexShrink:0}} className="px-4 py-3 text-sm font-medium text-gray-700 truncate text-right">{room.name}</div>
        </div>
      ))}

      {/* Legend */}
      <div className="flex gap-5 px-4 py-2.5 border-t border-gray-100 bg-gray-50 text-xs text-gray-400" style={{direction:'rtl'}}>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-green-400 inline-block"/> פעיל עכשיו</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-green-100 border border-green-200 inline-block"/> הבא</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-gray-100 inline-block"/> עבר</span>
        <span className="flex items-center gap-1.5"><span className="w-0.5 h-3 bg-green-400 inline-block"/> עכשיו</span>
      </div>
    </div>
  );
}


function WhoIsIn({slots}){
  const {dateStr,hour,minute}=getNow();
  const nowDecimal=hour+minute/60;
  const active=slots.filter(s=>toDateStr(new Date(s.date))===dateStr&&nowDecimal>=s.startHour&&nowDecimal<s.endHour);
  if(!active.length)return null;
  return(
    <div className="card rounded-2xl p-4 mb-6 fade-up" style={{background:'linear-gradient(135deg,#f0fdf4,#dcfce7)',borderColor:'#bbf7d0'}}>
      <h2 className="text-sm font-semibold text-green-800 mb-3 flex items-center gap-2">
        <span className="w-2 h-2 bg-green-500 rounded-full pulse-dot inline-block"/>
        בבניין עכשיו ({active.length})
      </h2>
      <div className="flex flex-wrap gap-2">
        {active.map(s=>(
          <div key={s.id} className="flex items-center gap-2 bg-white border border-green-200 rounded-xl px-3 py-1.5 shadow-sm">
            <User size={13} className="text-green-500"/>
            <span className="text-sm font-medium text-gray-700">{s.therapist.name}</span>
            <span className="text-xs text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded-md">{s.room.name}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function DashboardPage(){
  const [rooms,setRooms]=useState([]);
  const [slots,setSlots]=useState([]);
  const [loading,setLoading]=useState(true);
  const [lastUpdated,setLastUpdated]=useState(null);
  const [view,setView]=useState('grid');
  const [modalRoom,setModalRoom]=useState(null);

  const fetchData=async()=>{
    try{
      const today=new Date();
      const [r,s]=await Promise.all([getRooms(),getSchedule({date:toDateStr(today)})]);
      setRooms(r);setSlots(s);setLastUpdated(new Date());
    }catch(e){console.error(e);}finally{setLoading(false);}
  };

  useEffect(()=>{fetchData();const i=setInterval(fetchData,60000);return()=>clearInterval(i);},[]);

  const {dateStr,hour,minute}=getNow();
  const nowDecimal=hour+minute/60;
  const activeCount=new Set(slots.filter(s=>toDateStr(new Date(s.date))===dateStr&&nowDecimal>=s.startHour&&nowDecimal<s.endHour).map(s=>s.roomId)).size;
  const now=new Date();

  return(
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-8 fade-up">
        <div>
          <h1 className="section-title">דשבורד</h1>
          <p className="text-gray-400 text-sm mt-1">
            {DAYS_HE[now.getDay()]} {now.getDate()} {MONTHS_HE[now.getMonth()]} ·{' '}
            <span className="text-green-600 font-medium">{activeCount}</span> מתוך {rooms.length} חדרים פעילים
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex bg-gray-100 rounded-xl p-1 gap-0.5">
            <button onClick={()=>setView('grid')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${view==='grid'?'bg-white shadow-sm text-gray-800':'text-gray-400 hover:text-gray-600'}`}>
              <LayoutGrid size={14}/> כרטיסים
            </button>
            <button onClick={()=>setView('timeline')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${view==='timeline'?'bg-white shadow-sm text-gray-800':'text-gray-400 hover:text-gray-600'}`}>
              <List size={14}/> ציר זמן
            </button>
          </div>
          <button onClick={fetchData} className="btn-ghost p-2 text-gray-400">
            <RefreshCw size={14}/>
          </button>
        </div>
      </div>

      {loading?<div className="text-center text-gray-400 py-20">טוען...</div>:(
        <>
          <WhoIsIn slots={slots}/>
          {view==='grid'?(
            rooms.length===0
              ?<div className="text-center text-gray-400 py-20">אין חדרים. הוסף חדרים בפאנל המנהל.</div>
              :<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {rooms.map((room,i)=><RoomCard key={room.id} room={room} slots={slots} index={i} onClick={()=>setModalRoom(room)}/>)}
              </div>
          ):<TimelineView rooms={rooms} slots={slots}/>}
        </>
      )}
      {modalRoom&&<RoomModal room={modalRoom} onClose={()=>setModalRoom(null)}/>}
    </div>
  );
}
