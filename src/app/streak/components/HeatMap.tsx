import { useCallback } from 'react';
import { UsageDay } from '@/services/usageService';

export type ActivityRecord = Record<string, UsageDay>; // map day to data

type HeatMapProps = {
  data?: ActivityRecord;
  onClickCell: (date: string) => void;
  className?: string;
};

export default function HeatMap(props: HeatMapProps) {
  const { data: activeRecord = {}, onClickCell } = props;

  const onDayClick = useCallback(async (weekIdx: number, dayIdx: number) => {
    const date = getDate(weekIdx, dayIdx);
    onClickCell(date);
  }, [onClickCell]);

  const hmLabelClass = 'text-xs fill-primary';

  return (
    <div className='overflow-auto p-1 m-1'>
      <svg width='828' height='128' className='hm-svg'>
        <g transform='translate(10, 20)'>
          {Array.from(Array(53).keys()).map(weekIdx => (
            <WeekHeatMap 
              key={`week-${weekIdx}`} 
              data={activeRecord}
              weekIdx={weekIdx} 
              onClick={onDayClick} 
            />
          ))}
          {Array.from(Array(13).keys()).map(monIdx => (
            <text 
              key={`mon-${monIdx}`} 
              id={`start-${calcMonStart()}-idx-${monIdx}`}
              x={`${calcMonStart() * 11 + 16 * 4 * monIdx}`} 
              y='-8' className={hmLabelClass}
            >
              {getMonthLabel(monIdx)}
            </text>
          ))}
          <text textAnchor='start' className='hidden' dx='-10' dy='8'>Sun</text>
          <text textAnchor='start' className={hmLabelClass} dx='-10' dy='25'>M</text>
          <text textAnchor='start' className='hidden' dx='-10' dy='42'>Tue</text>
          <text textAnchor='start' className={hmLabelClass} dx='-10' dy='56'>W</text>
          <text textAnchor='start' className='hidden' dx='-10' dy='72'>Thu</text>
          <text textAnchor='start' className={hmLabelClass} dx='-10' dy='85'>F</text>
          <text textAnchor='start' className='hidden' dx='-10' dy='98'>Sat</text>
        </g>
      </svg>
    </div>
  );
}

type WeekProps = {
  data: ActivityRecord;
  weekIdx: number;
  onClick: (weekIdx: number, dayIdx: number) => Promise<void>;
  className?: string;
};

function WeekHeatMap({ data, weekIdx, onClick }: WeekProps) {
  return (
    <g transform={`translate(${16 * weekIdx}, 0)`}>
      {Array.from(Array(7).keys()).map(dayIdx => (
        <rect 
          key={`day-${dayIdx}`} width='11' height='11' rx='2' ry='2'  
          x={`${16 - weekIdx}`} 
          y={`${15 * dayIdx}`} 
          className={getDayStyle(data, weekIdx, dayIdx)} 
          onClick={async () => await onClick(weekIdx, dayIdx)}
        >
          <title>{getDataToolTips(data, weekIdx, dayIdx)}</title>
        </rect>
      ))}
    </g>
  );
}

function getStrDate(dateStr: string) {
  const date = new Date(dateStr);
  return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
}

/** local date format: yyyy-m-d */
function getDate(weekIdx: number, dayIdx: number) {
  const date = new Date(); // today
  const day = date.getDate();
  const weekDay = date.getDay();
  const gapDay = (52 - weekIdx) * 7 - (dayIdx - weekDay);
  date.setDate(day - gapDay);
  return getStrDate(date.toString());
}

function calcMonStart() {
  const date = new Date();
  const day = date.getDate();
  const startIdx = Math.ceil(day / 7);
  return startIdx;
}

function getData(
  data: ActivityRecord,
  weekIdx: number, 
  dayIdx: number
): UsageDay | undefined {
  const date = getDate(weekIdx, dayIdx);
  return data[date];
}

function getDataToolTips(data: ActivityRecord, weekIdx: number, dayIdx: number) {
  const aData = getData(data, weekIdx, dayIdx);
  const date = getDate(weekIdx, dayIdx);
  const readMinutes = Math.ceil((aData?.readSeconds || 0) / 60);
  const noteNum = aData?.annotations || 0;
  return `${date}:\nRead: ${readMinutes}\nWrite: ${noteNum}`;
}

function getDayStyle(data: ActivityRecord, weekIdx: number, dayIdx: number) {
  const aData = getData(data, weekIdx, dayIdx);
  const readMin = (aData?.readSeconds || 0) / 60;
  const noteNum = aData?.annotations || 0;
  const today = new Date();
  const weekDay = today.getDay();
  const isAfterToday = weekIdx >= 52 && dayIdx > weekDay;
  const fillStyle = isAfterToday 
    ? 'fill-transparent' 
    : readMin === 0 
      ? 'fill-base-300'
      : readMin >= 60 
        ? 'fill-success'
        : readMin >= 45
          ? 'fill-success/85' 
          : readMin >= 15 ? 'fill-success/70' : 'fill-success/55';

  const lineStyle = isAfterToday 
    ? 'border-none' 
    : noteNum === 0 
      ? 'stroke-base-200'
      : noteNum >= 15 
        ? 'stroke-primary'
        : noteNum >= 10
          ? 'stroke-primary/85' 
          : noteNum >= 5 ? 'stroke-primary/70' : 'stroke-primary/55';

  return `${fillStyle} ${lineStyle} cursor-pointer`;
}

function getMonthLabel(idx: number) {
  if (idx > 12) return '';
  const months = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
  ];
  const nowMonth = new Date().getMonth();
  const monIdx = nowMonth + idx;
  const realIdx = monIdx >= 12 ? monIdx - 12 : monIdx;
  return months[realIdx] || '';
}
