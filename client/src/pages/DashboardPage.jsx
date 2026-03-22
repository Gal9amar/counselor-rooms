import React, { useEffect, useState, useCallback } from 'react';
import { getRooms, getSchedule } from '../services/api';
import { useNavigate } from 'react-router-dom';
import { RefreshCw, User, Clock, CalendarDays, LayoutGrid, List, X, ChevronLeft, ChevronRight, Plus } from 'lucide-react';

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
  const navigate=useNavigate();
  const handleAddSlot=()=>{onClose();navigate('/schedule',{state:{preselectedRoomId:room.id}});};
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
          <div className="flex items-center gap-2">
            <button onClick={handleAddSlot}
              className="btn-primary flex items-center gap-1.5 text-sm px-3 py-1.5">
              <Plus size={14}/> הוסף שיבוץ
            </button>
            <button onClick={onClose} className="btn-ghost p-1.5"><X size={20}/></button>
          </div>
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

  const [viewDate,setViewDate]=React.useState(()=>new Date());
  const [filterRoom,setFilterRoom]=React.useState('all');
  const [viewMode,setViewMode]=React.useState('day');
  const [expandedSlot,setExpandedSlot]=React.useState(null); // mobile tap to expand

  const today=new Date();today.setHours(0,0,0,0);

  function startOfWeek(d){const c=new Date(d);c.setHours(0,0,0,0);c.setDate(c.getDate()-c.getDay());return c;}
  function addDays(d,n){const c=new Date(d);c.setDate(c.getDate()+n);return c;}

  const weekStart=startOfWeek(viewDate);
  const weekDays=viewMode==='week'?Array.from({length:7},(_,i)=>addDays(weekStart,i)):[viewDate];

  function prevNav(){setViewDate(d=>addDays(d,viewMode==='week'?-7:-1));setExpandedSlot(null);}
  function nextNav(){setViewDate(d=>addDays(d,viewMode==='week'?7:1));setExpandedSlot(null);}
  function goToday(){setViewDate(new Date());setExpandedSlot(null);}

  const displayRooms=filterRoom==='all'?rooms:rooms.filter(r=>String(r.id)===filterRoom);
  const toRight=(h)=>`${((h-HOURS[0])/totalHours)*100}%`;

  // Slot block component — shared between day/week
  function SlotBlock({s,isNow,isPast,slotW}){
    const isExpanded=expandedSlot===s.id;
    const color=isNow?'bg-gradient-to-l from-green-500 to-green-400 text-white shadow-lg shadow-green-200'
      :isPast?'bg-gray-200 text-gray-500'
      :'bg-green-100 text-green-900 border border-green-300';

    return(
      <div
        className={`absolute top-1 bottom-1 rounded-xl overflow-visible flex flex-col justify-center cursor-pointer transition-all ${color} ${isExpanded?'z-30':'z-10 hover:z-20'}`}
        style={{right:toRight(s.startHour),width:`${slotW}%`,minWidth:'4px'}}
        onClick={e=>{e.stopPropagation();setExpandedSlot(isExpanded?null:s.id);}}
      >
        {/* Block content */}
        <div className="px-1.5 overflow-hidden">
          {slotW>8&&<span className="block text-xs font-bold truncate leading-tight">{s.therapist.name}</span>}
          {slotW>14&&<span className={`block text-xs truncate leading-tight ${isNow?'text-white/80':isPast?'text-gray-400':'text-green-700'}`}>{s.room?.name}</span>}
          {slotW>14&&<span className={`block text-xs truncate leading-tight ${isNow?'text-white/70':isPast?'text-gray-400':'text-green-600'}`}>{s.startHour}:00–{s.endHour}:00</span>}
        </div>
        {/* Expanded popup — mobile friendly */}
        {isExpanded&&(
          <div className="absolute top-full right-0 mt-1 bg-white rounded-2xl shadow-xl border border-gray-200 p-3 min-w-[180px] max-w-[220px] z-50 text-gray-800" dir="rtl">
            <p className="font-bold text-sm text-gray-900 mb-1">{s.therapist.name}</p>
            <p className="text-xs text-gray-500 flex items-center gap-1 mb-0.5">
              <span>🏠</span>{s.room?.name}
            </p>
            <p className="text-xs text-green-700 font-semibold flex items-center gap-1 mb-0.5">
              <span>🕐</span>{s.startHour}:00 – {s.endHour}:00
            </p>
            {s.note&&<p className="text-xs text-gray-500 italic flex items-start gap-1 mt-1 pt-1 border-t border-gray-100">
              <span className="shrink-0">📝</span>{s.note}
            </p>}
          </div>
        )}
      </div>
    );
  }

  return(
    <div className="card rounded-2xl overflow-visible fade-up" onClick={()=>setExpandedSlot(null)}>
      {/* Controls */}
      <div className="px-3 py-2.5 border-b border-gray-100 bg-gray-50 rounded-t-2xl">
        {/* Row 1: date nav */}
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-0.5">
            <button onClick={prevNav} className="btn-ghost p-1.5"><ChevronRight size={18}/></button>
            <button onClick={nextNav} className="btn-ghost p-1.5"><ChevronLeft size={18}/></button>
            <button onClick={goToday} className="text-xs text-green-600 font-bold px-2 py-1 rounded-lg hover:bg-green-50 transition-colors mr-1">היום</button>
          </div>
          <span className="font-bold text-gray-700 text-sm text-center flex-1">
            {viewMode==='week'
              ? `${addDays(weekStart,0).getDate()}/${addDays(weekStart,0).getMonth()+1} – ${addDays(weekStart,6).getDate()}/${addDays(weekStart,6).getMonth()+1}`
              : `${DAYS_HE[viewDate.getDay()]} ${viewDate.getDate()} ${MONTHS_HE[viewDate.getMonth()]}`
            }
          </span>
          {/* Day/Week toggle */}
          <div className="flex bg-white border border-gray-200 rounded-xl p-0.5 gap-0.5">
            <button onClick={()=>{setViewMode('day');setExpandedSlot(null);}}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${viewMode==='day'?'bg-green-500 text-white':'text-gray-400'}`}>יום</button>
            <button onClick={()=>{setViewMode('week');setExpandedSlot(null);}}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${viewMode==='week'?'bg-green-500 text-white':'text-gray-400'}`}>שבוע</button>
          </div>
        </div>
        {/* Row 2: room filter */}
        <select
          className="input py-1.5 text-sm w-full"
          value={filterRoom}
          onChange={e=>{setFilterRoom(e.target.value);setExpandedSlot(null);}}
        >
          <option value="all">כל החדרים</option>
          {rooms.map(r=><option key={r.id} value={String(r.id)}>{r.name}</option>)}
        </select>
      </div>

      {/* Hour axis header */}
      <div className="flex border-b border-gray-100 bg-gray-50">
        <div className={`shrink-0 px-2 py-2 text-xs text-gray-400 font-medium ${viewMode==='week'?'w-16':'w-20'}`}>חדר</div>
        {viewMode==='week'&&<div className="w-14 shrink-0 px-1 py-2 text-xs text-gray-400 font-medium border-r border-gray-100">יום</div>}
        <div className="flex-1 relative h-7">
          {[8,10,12,14,16,18,20].map(h=>(
            <div key={h} className="absolute top-0 translate-x-1/2 text-xs text-gray-400" style={{right:toRight(h)}}>
              <div className="h-1.5 border-r border-gray-200 mx-auto w-px mb-0.5"/>
              <span style={{fontSize:'10px'}}>{h}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Rows */}
      <div className="overflow-visible">
      {viewMode==='day'?(
        displayRooms.map((room,ri)=>{
          const ds=toDateStr(viewDate);
          const daySlots=slots.filter(s=>s.roomId===room.id&&toDateStr(new Date(s.date))===ds).sort((a,b)=>a.startHour-b.startHour);
          const isToday=ds===dateStr;
          return(
            <div key={room.id} className={`flex items-center border-b border-gray-50 last:border-0 ${ri%2===0?'bg-white':'bg-gray-50/40'}`}>
              <div className="w-20 shrink-0 px-2 py-2 text-xs font-bold text-gray-700 truncate">{room.name}</div>
              <div className="flex-1 relative h-14 my-0.5 overflow-visible">
                {isToday&&nowDecimal>=HOURS[0]&&nowDecimal<=HOURS[HOURS.length-1]+1&&(
                  <div className="absolute top-0 bottom-0 w-0.5 bg-red-400 z-20" style={{right:toRight(nowDecimal)}}/>
                )}
                {daySlots.map(s=>{
                  const isNow=isToday&&nowDecimal>=s.startHour&&nowDecimal<s.endHour;
                  const isPast=(isToday&&s.endHour<=nowDecimal)||(ds<dateStr);
                  const slotW=((s.endHour-s.startHour)/totalHours)*100;
                  return <SlotBlock key={s.id} s={s} isNow={isNow} isPast={isPast} slotW={slotW}/>;
                })}
                {daySlots.length===0&&<div className="absolute inset-0 flex items-center"><div className="w-full border-t border-dashed border-gray-200"/></div>}
              </div>
            </div>
          );
        })
      ):(
        displayRooms.map((room,ri)=>{
          const roomWeekSlots=weekDays.map(day=>({
            day,ds:toDateStr(day),
            daySlots:slots.filter(s=>s.roomId===room.id&&toDateStr(new Date(s.date))===toDateStr(day)).sort((a,b)=>a.startHour-b.startHour)
          })).filter(({daySlots})=>daySlots.length>0);
          if(roomWeekSlots.length===0)return null;
          return(
            <React.Fragment key={room.id}>
              {roomWeekSlots.map(({day,ds,daySlots},di)=>{
                const isToday=ds===dateStr;
                return(
                  <div key={ds} className={`flex items-center border-b border-gray-50 last:border-0 ${ri%2===0?'bg-white':'bg-gray-50/40'}`}>
                    <div className="w-16 shrink-0 px-2 py-2 text-xs font-bold text-gray-700 truncate">{di===0?room.name:''}</div>
                    <div className={`w-14 shrink-0 px-1 py-1 text-center border-r border-gray-100 ${isToday?'text-green-700 font-bold':'text-gray-500'}`} style={{fontSize:'10px'}}>
                      <div>{DAYS_HE[day.getDay()].slice(0,3)}</div>
                      <div className="text-gray-400">{day.getDate()}/{day.getMonth()+1}</div>
                    </div>
                    <div className="flex-1 relative h-14 my-0.5 overflow-visible">
                      {isToday&&nowDecimal>=HOURS[0]&&nowDecimal<=HOURS[HOURS.length-1]+1&&(
                        <div className="absolute top-0 bottom-0 w-0.5 bg-red-400 z-20" style={{right:toRight(nowDecimal)}}/>
                      )}
                      {daySlots.map(s=>{
                        const isNow=isToday&&nowDecimal>=s.startHour&&nowDecimal<s.endHour;
                        const isPast=(isToday&&s.endHour<=nowDecimal)||(ds<dateStr);
                        const slotW=((s.endHour-s.startHour)/totalHours)*100;
                        return <SlotBlock key={s.id} s={s} isNow={isNow} isPast={isPast} slotW={slotW}/>;
                      })}
                    </div>
                  </div>
                );
              })}
            </React.Fragment>
          );
        })
      )}
      </div>

      {/* Legend */}
      <div className="flex gap-4 px-4 py-2.5 border-t border-gray-100 bg-gray-50 text-xs text-gray-400 flex-wrap rounded-b-2xl">
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-lg bg-green-400 inline-block"/> פעיל</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-lg bg-green-100 border border-green-300 inline-block"/> הבא</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-lg bg-gray-200 inline-block"/> עבר</span>
        <span className="flex items-center gap-1.5 mr-auto text-green-600 font-medium">לחץ על שיבוץ לפרטים</span>
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
