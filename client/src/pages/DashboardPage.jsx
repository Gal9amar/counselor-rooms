import React, { useEffect, useState, useCallback } from 'react';
import { getRooms, getSchedule } from '../services/api';
import { RefreshCw, User, Clock, CalendarDays, LayoutGrid, List, X, ChevronLeft, ChevronRight } from 'lucide-react';

const HOURS=[8,9,10,11,12,13,14,15,16,17,18,19,20,21];
const DAYS_HE=['ראשון','שני','שלישי','רביעי','חמישי','שישי','שבת'];
const MONTHS_HE=['ינואר','פברואר','מרץ','אפריל','מאי','יוני','יולי','אוגוסט','ספטמבר','אוקטובר','נובמבר','דצמבר'];

function toDateStr(d){
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
function formatNextDate(dateStr){
  const today=toDateStr(new Date());
  if(dateStr===today) return 'היום';
  const d=new Date(dateStr+'T00:00:00');
  const diff=Math.round((d-new Date(today+'T00:00:00'))/(1000*60*60*24));
  if(diff===1) return 'מחר';
  return `${DAYS_HE[d.getDay()]} ${d.getDate()} ${MONTHS_HE[d.getMonth()]}`;
}
function formatDateHe(dateStr){
  const d=new Date(dateStr+'T00:00:00');
  return `${DAYS_HE[d.getDay()]} ${d.getDate()} ${MONTHS_HE[d.getMonth()]} ${d.getFullYear()}`;
}
function hLabel(h){return `${h}:00`;}
function getNow(){const n=new Date();return{dateStr:toDateStr(n),hour:n.getHours(),minute:n.getMinutes()};}

function RoomModal({room,onClose}){
  const today=new Date();today.setHours(0,0,0,0);
  const [year,setYear]=useState(today.getFullYear());
  const [month,setMonth]=useState(today.getMonth());
  const [slots,setSlots]=useState([]);
  const [loading,setLoading]=useState(true);
  const [selectedDate,setSelectedDate]=useState(null); // clicked day

  const load=useCallback(async(y,m)=>{
    setLoading(true);
    const from=`${y}-${String(m+1).padStart(2,'0')}-01`;
    const lastDay=new Date(y,m+1,0).getDate();
    const to=`${y}-${String(m+1).padStart(2,'0')}-${String(lastDay).padStart(2,'0')}`;
    try{const s=await getSchedule({roomId:room.id,from,to});setSlots(s);}
    finally{setLoading(false);}
  },[room.id]);

  useEffect(()=>{load(year,month);setSelectedDate(null);},[year,month,load]);

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

  // Slots for selected day
  const selectedSlots=selectedDate?((slotsByDate[selectedDate]||[]).sort((a,b)=>a.startHour-b.startHour)):[];

  return(
    <div className="fixed inset-0 bg-black/30 backdrop-blur-[2px] z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col border border-gray-100" onClick={e=>e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div>
            <h2 className="text-lg font-bold text-gray-800">{room.name}</h2>
            <p className="text-xs text-gray-400 mt-0.5">
              {selectedDate ? formatDateHe(selectedDate) : 'לחץ על יום לפרטים'}
            </p>
          </div>
          <button onClick={onClose} className="btn-ghost p-1.5"><X size={20}/></button>
        </div>
        {/* Month nav */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
          <button onClick={prevMonth} disabled={isPrevDisabled} className="btn-ghost p-1.5 disabled:opacity-30"><ChevronRight size={18}/></button>
          <span className="font-semibold text-gray-700">{MONTHS_HE[month]} {year}</span>
          <button onClick={nextMonth} className="btn-ghost p-1.5"><ChevronLeft size={18}/></button>
        </div>

        <div className="overflow-y-auto flex-1 px-5 py-4">
          {loading ? <div className="text-center text-gray-400 py-10">טוען...</div> : (
            <>
              {/* Calendar */}
              <div className="grid grid-cols-7 mb-1">
                {DAYS_HE.map(d=><div key={d} className="text-center text-xs text-gray-400 font-medium py-1">{d.slice(0,1)}</div>)}
              </div>
              <div className="grid grid-cols-7 gap-1 mb-4">
                {cells.map((day,i)=>{
                  if(!day)return<div key={`p-${i}`}/>;
                  const d=new Date(year,month,day);
                  const ds=toDateStr(d);
                  const isPast=d<today;
                  const isToday=ds===toDateStr(today);
                  const isSelected=ds===selectedDate;
                  const hasSlot=!!(slotsByDate[ds]?.length);
                  const count=slotsByDate[ds]?.length||0;
                  return(
                    <button
                      key={ds}
                      onClick={()=>setSelectedDate(isSelected?null:ds)}
                      className={`rounded-xl py-1.5 text-sm text-center flex flex-col items-center gap-0.5 transition-all ${
                        isSelected?'bg-green-500 text-white ring-2 ring-green-400 shadow-md'
                        :isToday?'bg-green-100 font-bold text-green-700 ring-1 ring-green-300 hover:bg-green-200'
                        :isPast?'text-gray-200 cursor-default'
                        :hasSlot?'bg-green-50 text-green-700 font-medium hover:bg-green-100 cursor-pointer'
                        :'text-gray-400 hover:bg-gray-50 cursor-pointer'
                      }`}
                    >
                      {day}
                      {hasSlot&&(
                        <span className={`w-1.5 h-1.5 rounded-full ${isSelected?'bg-white':'bg-green-400'}`}/>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Selected day slots */}
              {selectedDate&&(
                <div className="border-t border-gray-100 pt-4">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-bold text-gray-700 flex items-center gap-1.5">
                      <CalendarDays size={14} className="text-green-500"/>
                      {formatDateHe(selectedDate)}
                    </h3>
                    {selectedSlots.length>0&&(
                      <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">
                        {selectedSlots.length} שיבוצים
                      </span>
                    )}
                  </div>
                  {selectedSlots.length===0?(
                    <p className="text-gray-400 text-sm text-center py-3">אין שיבוצים ביום זה</p>
                  ):(
                    <div className="space-y-2">
                      {selectedSlots.map(s=>(
                        <div key={s.id} className="bg-green-50 border border-green-100 rounded-xl px-4 py-3">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <User size={13} className="text-green-500"/>
                              <span className="text-sm font-semibold text-gray-800">{s.therapist.name}</span>
                            </div>
                            <span className="text-sm font-medium text-green-700">
                              {hLabel(s.startHour)} – {hLabel(s.endHour)}
                            </span>
                          </div>
                          {s.note&&<p className="text-xs text-gray-400 italic mt-1.5 pr-5">{s.note}</p>}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* No day selected — show summary */}
              {!selectedDate&&(
                <div className="text-center text-gray-400 text-xs py-2">
                  {Object.keys(slotsByDate).length===0
                    ?'אין שיבוצים בחודש זה'
                    :`${Object.keys(slotsByDate).length} ימים עם שיבוצים — לחץ על יום לפרטים`}
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

  // All slots for this room sorted by date+hour
  const roomSlots=slots
    .filter(s=>s.roomId===room.id)
    .sort((a,b)=>{
      const da=toDateStr(new Date(a.date));
      const db=toDateStr(new Date(b.date));
      if(da!==db) return da<db?-1:1;
      return a.startHour-b.startHour;
    });

  const todaySlots=roomSlots.filter(s=>toDateStr(new Date(s.date))===dateStr);
  const active=todaySlots.find(s=>nowDecimal>=s.startHour&&nowDecimal<s.endHour);

  // Next = first slot that hasn't ended yet (today or future)
  const next=!active?roomSlots.find(s=>{
    const sd=toDateStr(new Date(s.date));
    if(sd>dateStr) return true;
    if(sd===dateStr) return s.endHour>nowDecimal;
    return false;
  }):null;

  // All slots on the same day as "next" (the upcoming day)
  const nextDayStr=next?toDateStr(new Date(next.date)):null;
  const nextDaySlots=nextDayStr
    ?roomSlots.filter(s=>{
        if(toDateStr(new Date(s.date))!==nextDayStr) return false;
        // If next day is today — only show slots not yet ended
        if(nextDayStr===dateStr) return s.endHour>nowDecimal;
        // Future day — show all slots
        return true;
      })
    :[];

  const isActive=!!active;

  return(
    <button onClick={onClick}
      className={`w-full text-right rounded-2xl overflow-hidden fade-up-${Math.min(index,3)} card card-clickable flex flex-col ${isActive?'card-active pulse-ring':''}`}
      style={{minHeight:'160px'}}>
      {/* Indicator bar */}
      <div className={`h-1 w-full shrink-0 ${isActive?'bg-gradient-to-l from-red-400 to-red-300':'bg-gradient-to-l from-green-400 to-green-300'}`}/>
      <div className="p-5 flex flex-col flex-1">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-base font-semibold text-gray-800">{room.name}</h3>
          <span className={isActive?'badge-active':'badge-free'}>
            {isActive
              ?<span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 bg-red-500 rounded-full pulse-dot inline-block"/>תפוס</span>
              :<span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 bg-green-500 rounded-full inline-block"/>פנוי</span>
            }
          </span>
        </div>
        {active&&(
          <div className="rounded-xl bg-red-50 border border-red-100 px-3 py-2.5 space-y-1.5">
            <div className="flex items-center gap-2 text-gray-800"><User size={14} className="text-red-400 shrink-0"/><span className="font-semibold">{active.therapist.name}</span></div>
            <div className="flex items-center gap-2 text-red-600 text-sm font-medium"><Clock size={12} className="shrink-0"/><span>{hLabel(active.startHour)} – {hLabel(active.endHour)}</span></div>
            {active.note && <p className="text-xs text-gray-400 italic">{active.note}</p>}
          </div>
        )}
        {!active&&next&&(
          <div className="rounded-xl bg-green-50 border border-green-100 px-3 py-2 flex flex-col" style={{maxHeight:'160px'}}>
            {/* Day header */}
            <div className="flex items-center gap-1.5 text-green-700 text-xs font-bold pb-1.5 border-b border-green-100 shrink-0">
              <CalendarDays size={12} className="shrink-0"/>
              <span>שיבוץ קרוב: {formatNextDate(nextDayStr)}</span>
              {nextDaySlots.length>1&&<span className="mr-auto bg-green-200 text-green-800 rounded-full px-1.5 text-xs">{nextDaySlots.length}</span>}
            </div>
            {/* Scrollable list */}
            <div className="overflow-y-auto mt-1.5 space-y-1.5 pl-0.5" style={{scrollbarWidth:'thin'}}>
              {nextDaySlots.map(s=>(
                <div key={s.id} className="flex flex-col gap-0.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-gray-800">
                      <User size={12} className="text-green-500 shrink-0"/>
                      <span className="text-sm font-semibold">{s.therapist.name}</span>
                    </div>
                    <span className="text-green-700 text-xs font-medium">{hLabel(s.startHour)}–{hLabel(s.endHour)}</span>
                  </div>
                  {s.note&&<p className="text-xs text-gray-400 italic pr-4">{s.note}</p>}
                </div>
              ))}
            </div>
          </div>
        )}
        {!active&&!next&&<p className="text-gray-400 text-sm">אין שיבוצים קרובים</p>}
        <p className="text-xs text-gray-400 mt-auto pt-3 border-t border-gray-100">לחץ לצפייה בלוח החודשי ←</p>
      </div>
    </button>
  );
}

function TimelineView({rooms,slots}){
  const {dateStr,hour,minute}=getNow();
  const nowDecimal=hour+minute/60;
  const totalHours=HOURS[HOURS.length-1]+1-HOURS[0];

  const todayRooms=rooms.map(room=>({
    ...room,
    daySlots:slots.filter(s=>s.roomId===room.id&&toDateStr(new Date(s.date))===dateStr).sort((a,b)=>a.startHour-b.startHour)
  }));

  // In RTL layout: right:0% = visual right (near room name = hour 8)
  // right:X% positions element X% from the right edge
  const toRight=(h)=>`${((h-HOURS[0])/totalHours)*100}%`;
  const barWidth=(s)=>`${((s.endHour-s.startHour)/totalHours)*100}%`;

  return(
    <div className="card rounded-2xl overflow-hidden fade-up">
      {/* Header */}
      <div className="flex border-b border-gray-100 bg-gray-50">
        {/* Room label — first in RTL = rightmost */}
        <div className="w-28 shrink-0 px-4 py-2.5 text-xs text-gray-400 font-medium">חדר</div>
        {/* Hour axis */}
        <div className="flex-1 relative h-9">
          {HOURS.map(h=>(
            <div key={h} className="absolute top-0 text-xs text-gray-400 translate-x-1/2" style={{right:toRight(h)}}>
              <div className="h-2 border-l border-gray-200 mx-auto w-px mb-0.5"/>
              {hLabel(h)}
            </div>
          ))}
        </div>
      </div>

      {/* Rows */}
      {todayRooms.map((room,ri)=>(
        <div key={room.id} className={`flex items-center border-b border-gray-50 last:border-0 ${ri%2===0?'bg-white':'bg-gray-50/50'}`}>
          {/* Room name — first in RTL = rightmost */}
          <div className="w-28 shrink-0 px-4 py-3 text-sm font-medium text-gray-700 truncate">{room.name}</div>
          {/* Bar area */}
          <div className="flex-1 relative h-10 my-1">
            {/* Now line */}
            {nowDecimal>=HOURS[0]&&nowDecimal<=HOURS[HOURS.length-1]+1&&(
              <div className="absolute top-0 bottom-0 w-0.5 bg-green-400 z-10" style={{right:toRight(nowDecimal)}}/>
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
                  style={{right:toRight(s.startHour), width:barWidth(s)}}
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
        </div>
      ))}

      {/* Legend */}
      <div className="flex gap-5 px-4 py-2.5 border-t border-gray-100 bg-gray-50 text-xs text-gray-400">
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
    <div className="rounded-2xl px-4 py-3 mb-6 fade-up border border-gray-200 bg-white flex items-center gap-3 flex-wrap">
      <span className="text-sm font-semibold text-gray-700 shrink-0">בבניין עכשיו:</span>
      {active.map(s=>(
        <span key={s.id} className="flex items-center gap-1.5 bg-gray-100 border border-gray-200 rounded-full px-3 py-1 text-sm text-gray-800 font-medium">
          {s.therapist.name}
          <span className="text-xs text-gray-400 font-normal">· {s.room.name}</span>
        </span>
      ))}
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
      const future=new Date(today);future.setDate(today.getDate()+30);
      const [r,s]=await Promise.all([getRooms(),getSchedule({from:toDateStr(today),to:toDateStr(future)})]);
      const sortedR=[...r].sort((a,b)=>(parseInt(a.name.replace(/\D/g,""))||0)-(parseInt(b.name.replace(/\D/g,""))||0));
      setRooms(sortedR);setSlots(s);setLastUpdated(new Date());
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
          <h1 className="section-title">לוח חדרים</h1>
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
              :<div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                {rooms.map((room,i)=><RoomCard key={room.id} room={room} slots={slots} index={i} onClick={()=>setModalRoom(room)}/>)}
              </div>
          ):<TimelineView rooms={rooms} slots={slots}/>}
        </>
      )}
      {modalRoom&&<RoomModal room={modalRoom} onClose={()=>setModalRoom(null)}/>}
    </div>
  );
}
