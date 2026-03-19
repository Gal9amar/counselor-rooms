import React, { useEffect, useState, useMemo } from 'react';
import { getRooms, getTherapists, getSchedule, bookSlot } from '../services/api';
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react';

const DAYS_HE=['ראשון','שני','שלישי','רביעי','חמישי','שישי','שבת'];
const MONTHS_HE=['ינואר','פברואר','מרץ','אפריל','מאי','יוני','יולי','אוגוסט','ספטמבר','אוקטובר','נובמבר','דצמבר'];
const ALL_HOURS=[8,9,10,11,12,13,14,15,16,17,18,19,20,21];

function toDateStr(d){return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;}
function hLabel(h){return `${h}:00`;}
function formatDateHe(ds){const d=new Date(ds+'T00:00:00');return `${DAYS_HE[d.getDay()]} ${d.getDate()} ${MONTHS_HE[d.getMonth()]} ${d.getFullYear()}`;}

function MonthCalendar({year,month,onSelectDate,slotDates,selectedDate}){
  const today=new Date();today.setHours(0,0,0,0);
  const daysInMonth=new Date(year,month+1,0).getDate();
  const startPad=new Date(year,month,1).getDay();
  const cells=[];
  for(let i=0;i<startPad;i++)cells.push(null);
  for(let d=1;d<=daysInMonth;d++)cells.push(d);
  return(
    <div>
      <div className="grid grid-cols-7 mb-1">
        {DAYS_HE.map(d=><div key={d} className="text-center text-xs text-gray-400 font-medium py-1">{d.slice(0,1)}</div>)}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {cells.map((day,i)=>{
          if(!day)return<div key={`p-${i}`}/>;
          const d=new Date(year,month,day);
          const ds=toDateStr(d);
          const isPast=d<today;
          const isToday=ds===toDateStr(today);
          const isSelected=ds===selectedDate;
          const hasSlot=slotDates.has(ds);
          return(
            <button key={ds} disabled={isPast} onClick={()=>!isPast&&onSelectDate(ds)}
              className={`relative rounded-xl py-2 text-sm font-medium transition-all flex flex-col items-center gap-0.5 ${
                isSelected?'bg-green-500 text-white shadow-md shadow-green-200'
                :isToday?'bg-green-100 text-green-700 font-bold ring-1 ring-green-300'
                :isPast?'text-gray-200 cursor-not-allowed'
                :hasSlot?'bg-green-50 text-green-700 border border-green-200'
                :'text-gray-500 hover:bg-gray-50'
              }`}>
              {day}
              {hasSlot&&!isPast&&<span className={`w-1.5 h-1.5 rounded-full ${isSelected?'bg-white':'bg-green-400'}`}/>}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default function SchedulePage(){
  const today=new Date();today.setHours(0,0,0,0);
  const currentYear=today.getFullYear();
  const [rooms,setRooms]=useState([]);
  const [therapists,setTherapists]=useState([]);
  const [allSlots,setAllSlots]=useState([]);
  const [loading,setLoading]=useState(true);
  const [step,setStep]=useState('room');
  const [selectedRoom,setSelectedRoom]=useState(null);
  const [selectedDate,setSelectedDate]=useState(null);
  const [daySlots,setDaySlots]=useState([]);
  const [years,setYears]=useState([currentYear]);
  const [filterYear,setFilterYear]=useState(currentYear);
  const [filterMonth,setFilterMonth]=useState(null);
  const [startHour,setStartHour]=useState(null);
  const [endHour,setEndHour]=useState('');
  const [selectedTherapist,setSelectedTherapist]=useState('');
  const [note,setNote]=useState('');
  const [booking,setBooking]=useState(false);
  const [bookError,setBookError]=useState('');

  useEffect(()=>{Promise.all([getRooms(),getTherapists()]).then(([r,t])=>{
    const sorted=[...r].sort((a,b)=>(parseInt(a.name.replace(/\D/g,""))||0)-(parseInt(b.name.replace(/\D/g,""))||0));
    setRooms(sorted);setTherapists(t);setLoading(false);
  });},[]);

  const handleSelectRoom=async(room)=>{
    setSelectedRoom(room);setStep('date');setSelectedDate(null);
    const s=await getSchedule({roomId:room.id,from:`${currentYear}-01-01`,to:`${currentYear}-12-31`});
    setAllSlots(s);
  };
  const handleSelectDate=async(ds)=>{
    setSelectedDate(ds);setStep('hour');setStartHour(null);setEndHour('');setBookError('');
    const s=await getSchedule({roomId:selectedRoom.id,date:ds});
    setDaySlots(s);
  };
  const handleAddYear=async()=>{
    const ny=Math.max(...years)+1;
    setYears(p=>[...p,ny]);setFilterYear(ny);setFilterMonth(null);
    const s=await getSchedule({roomId:selectedRoom.id,from:`${ny}-01-01`,to:`${ny}-12-31`});
    setAllSlots(p=>[...p,...s]);
  };
  const back=()=>{
    if(step==='hour'){setStep('date');setStartHour(null);setEndHour('');setBookError('');}
    else if(step==='date'){setStep('room');setSelectedRoom(null);setAllSlots([]);}
  };

  const slotDates=useMemo(()=>{const s=new Set();allSlots.forEach(sl=>s.add(toDateStr(new Date(sl.date))));return s;},[allSlots]);
  const monthsToShow=useMemo(()=>filterMonth!==null?[filterMonth]:Array.from({length:12},(_,i)=>i),[filterMonth]);
  const occupiedHours=new Set();
  daySlots.forEach(s=>{for(let h=s.startHour;h<s.endHour;h++)occupiedHours.add(h);});

  const handleBook=async()=>{
    const end=parseInt(endHour);
    if(!end||end<=startHour){setBookError('שעת סיום לא תקינה');return;}
    if(!selectedTherapist){setBookError('בחר שם');return;}
    if(daySlots.some(s=>startHour<s.endHour&&end>s.startHour)){setBookError('קיים חופף');return;}
    setBooking(true);setBookError('');
    try{
      const slot=await bookSlot(selectedRoom.id,selectedDate,startHour,end,parseInt(selectedTherapist),note.trim()||null);
      setDaySlots(p=>[...p,slot]);setAllSlots(p=>[...p,slot]);
      setStartHour(null);setEndHour('');setSelectedTherapist('');setNote('');
    }catch(e){setBookError(e.response?.data?.error||'שגיאה');}
    finally{setBooking(false);}
  };

  if(loading)return<div className="text-center text-gray-400 py-20">טוען...</div>;

  return(
    <div className="max-w-3xl mx-auto">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-gray-400 mb-5 fade-up">
        <span className={step==='room'?'font-semibold text-green-600':'hover:text-gray-600 cursor-pointer'} onClick={()=>step!=='room'&&back()&&back()}>בחר חדר</span>
        <ChevronLeft size={13}/>
        <span className={step==='date'?'font-semibold text-green-600':step==='hour'?'text-gray-600':'text-gray-300'}>{selectedRoom?.name||'בחר תאריך'}</span>
        <ChevronLeft size={13}/>
        <span className={step==='hour'?'font-semibold text-green-600':'text-gray-300'}>{selectedDate?formatDateHe(selectedDate):'בחר שעה'}</span>
      </div>

      {step!=='room'&&(
        <button onClick={back} className="mb-5 btn-ghost flex items-center gap-1 text-sm text-green-600 px-2 py-1.5">
          <ChevronRight size={14}/> חזור
        </button>
      )}

      {step==='room'&&(
        <div className="fade-up">
          <h1 className="section-title mb-1">לוח שיבוצים</h1>
          <p className="text-gray-400 text-sm mb-6">בחר חדר לשיבוץ</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {rooms.map((room,i)=>(
              <button key={room.id} onClick={()=>handleSelectRoom(room)}
                className={`card card-clickable rounded-2xl px-5 py-6 text-right fade-up-${Math.min(i,3)} group`}>
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-gray-800 text-base">{room.name}</span>
                  <span className="text-green-400 opacity-0 group-hover:opacity-100 transition-opacity duration-200 text-lg">←</span>
                </div>
                <p className="text-xs text-gray-400 mt-1.5">לחץ לשיבוץ</p>
              </button>
            ))}
          </div>
        </div>
      )}

      {step==='date'&&(
        <div className="fade-up">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
            <div>
              <h1 className="section-title">{selectedRoom.name}</h1>
              <p className="text-gray-400 text-sm">בחר תאריך לשיבוץ</p>
            </div>
            <button onClick={handleAddYear} className="btn-secondary flex items-center gap-1.5 text-sm px-3 py-2 whitespace-nowrap">
              <Plus size={15}/> הוסף שנה ({Math.max(...years)+1})
            </button>
          </div>
          <div className="flex gap-2 mb-5 flex-wrap">
            <div className="flex bg-gray-100 rounded-xl p-1 gap-0.5">
              {years.map(y=>(
                <button key={y} onClick={()=>{setFilterYear(y);setFilterMonth(null);}}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${filterYear===y?'bg-white shadow-sm text-gray-800':'text-gray-400 hover:text-gray-600'}`}>{y}</button>
              ))}
            </div>
            <select className="input rounded-xl px-3 py-1.5 text-sm w-auto" value={filterMonth??''}
              onChange={e=>setFilterMonth(e.target.value===''?null:parseInt(e.target.value))}>
              <option value="">כל החודשים</option>
              {MONTHS_HE.map((m,i)=><option key={i} value={i}>{m}</option>)}
            </select>
          </div>
          <div className={`grid gap-4 ${filterMonth!==null?'grid-cols-1 max-w-sm':'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3'}`}>
            {monthsToShow.map(month=>{
              const lastDay=new Date(filterYear,month+1,0);
              if(lastDay<today)return null;
              return(
                <div key={month} className="card rounded-2xl p-4">
                  <h3 className="text-sm font-semibold text-gray-600 mb-3 text-center">{MONTHS_HE[month]} {filterYear}</h3>
                  <MonthCalendar year={filterYear} month={month} onSelectDate={handleSelectDate} slotDates={slotDates} selectedDate={selectedDate}/>
                </div>
              );
            })}
          </div>
          <p className="text-xs text-gray-400 mt-4 text-center">נקודה ירוקה = יש שיבוצים באותו יום</p>
        </div>
      )}

      {step==='hour'&&(
        <div className="fade-up">
          <h1 className="section-title mb-1">{selectedRoom.name}</h1>
          <p className="text-green-600 font-medium text-sm mb-5">{formatDateHe(selectedDate)}</p>
          <p className="text-gray-500 text-sm mb-3">בחר שעת התחלה</p>
          <div className="grid grid-cols-4 sm:grid-cols-7 gap-2 mb-6">
            {ALL_HOURS.map(h=>{
              const occupied=occupiedHours.has(h);
              const isSelected=startHour===h;
              const occupant=daySlots.find(s=>h>=s.startHour&&h<s.endHour);
              return(
                <button key={h} disabled={occupied} type="button"
                  onClick={()=>{ if(occupied) return; setStartHour(h); setEndHour(''); setBookError(''); }}
                  title={occupied?occupant?.therapist?.name:''}
                  className={`hour-btn rounded-xl py-3 text-sm font-medium border ${
                    isSelected?'bg-green-500 text-white border-green-500 shadow-md shadow-green-200'
                    :occupied?'bg-gray-100 text-gray-300 border-gray-100 cursor-not-allowed'
                    :'bg-white text-gray-600 border-gray-200 hover:border-green-400 hover:text-green-700 hover:bg-green-50'
                  }`}>
                  {hLabel(h)}
                  {occupied&&<div className="text-xs truncate px-1 text-gray-300 mt-0.5">{occupant?.therapist?.name?.split(' ')[0]}</div>}
                </button>
              );
            })}
          </div>

          {startHour!==null&&(
            <div className="card rounded-2xl p-5 space-y-4 fade-up border-green-200">
              <p className="font-semibold text-gray-700">שיבוץ החל מ-<span className="text-green-600">{hLabel(startHour)}</span></p>
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="flex-1">
                  <label className="block text-sm font-medium text-gray-600 mb-1.5">שעת סיום</label>
                  <select className="input" value={endHour} onChange={e=>setEndHour(e.target.value)}>
                    <option value="">-- בחר --</option>
                    {ALL_HOURS.filter(h=>h>startHour).map(h=>{
                      const blocked=Array.from({length:h-startHour},(_,i)=>startHour+i).some(x=>occupiedHours.has(x));
                      return<option key={h} value={h} disabled={blocked}>{hLabel(h)}{blocked?' (חסום)':''}</option>;
                    })}
                    {!occupiedHours.has(21)&&startHour<=21&&<option value={22}>22:00</option>}
                  </select>
                </div>
                <div className="flex-1">
                  <label className="block text-sm font-medium text-gray-600 mb-1.5">שמך</label>
                  <select className="input" value={selectedTherapist} onChange={e=>setSelectedTherapist(e.target.value)}>
                    <option value="">-- בחר --</option>
                    {therapists.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1.5">הערה <span className="text-gray-400 font-normal text-xs">(לא חובה)</span></label>
                <textarea className="input resize-none" rows={2} placeholder="לדוגמה: טיפול זוגי, יש להכין מצע..." value={note} onChange={e=>setNote(e.target.value)} maxLength={200}/>
              </div>
              {bookError&&<p className="text-red-500 text-sm">{bookError}</p>}
              <div className="flex gap-2">
                <button onClick={handleBook} disabled={!endHour||!selectedTherapist||booking}
                  className="btn-primary flex-1 py-2.5 px-4">
                  {booking?'שומר...':`אשר שיבוץ ${hLabel(startHour)}–${endHour?hLabel(parseInt(endHour)):''}`}
                </button>
                <button type="button" onClick={()=>{setStartHour(null);setEndHour('');setBookError('');}} className="btn-secondary px-4 py-2.5">ביטול</button>
              </div>
            </div>
          )}

          {daySlots.length>0&&(
            <div className="mt-6 fade-up">
              <h3 className="text-sm font-semibold text-gray-500 mb-2">שיבוצים ביום זה</h3>
              <div className="space-y-2">
                {daySlots.sort((a,b)=>a.startHour-b.startHour).map(s=>(
                  <div key={s.id} className="flex items-center justify-between bg-green-50 border border-green-100 rounded-xl px-4 py-2.5">
                    <span className="font-medium text-gray-700">{s.therapist.name}</span>
                    <span className="text-sm text-green-600 font-medium">{hLabel(s.startHour)} – {hLabel(s.endHour)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
