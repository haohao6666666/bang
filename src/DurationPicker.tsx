import {KeyboardInput} from './mobile';

const commonMinutes=[5,10,20,30,60];
export function DurationPicker({value,onChange}:{value:string;onChange:(value:string)=>void}){
  return <fieldset className="focus-duration-picker"><legend>专注时长</legend>
    <div className="duration-presets" aria-label="常用专注时长">{commonMinutes.map(minutes=><button key={minutes} type="button" aria-label={`专注 ${minutes} 分钟`} aria-pressed={Number(value)===minutes} onClick={()=>onChange(String(minutes))}>{minutes}<small>分钟</small></button>)}</div>
    <label className="duration-field"><span>自定义</span><KeyboardInput type="number" inputMode="numeric" min="1" max="180" step="1" value={value} onChange={event=>onChange(event.target.value)} aria-label="专注时长（分钟）"/><em>分钟</em></label>
  </fieldset>;
}
