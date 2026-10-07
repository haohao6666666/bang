import type {StampBookPage} from './stampBook';
import {describeTimeStampOccurrence, resolveTimeStampDefinition, stampAsset, type CollectedStamp, type StampDefinition} from './stampDefinitions';

export const MAX_CALENDAR_STAMP_TYPES = 6;
export type DailyStamp = {
  definition:StampDefinition;
  definitions:StampDefinition[];
  count:number;
  reason:string;
};

/** Day evidence controls time stamps; first-acquired dates only control the
 * one-off growth stamps. Visual grouping never changes saved acquisition. */
export function collectDailyStamps(page:StampBookPage, collection:readonly CollectedStamp[]):DailyStamp[] {
  const stamps=new Map<string,DailyStamp>();
  const add=(definition:StampDefinition,count:number,reason:string)=>{
    const artwork=stampAsset(definition),existing=stamps.get(artwork);
    if(existing){
      existing.count+=count;
      if(!existing.definitions.some(item=>item.key===definition.key))existing.definitions.push(definition);
      if(reason)existing.reason+="\n"+reason;
    }else stamps.set(artwork,{definition,definitions:[definition],count,reason});
  };
  for(const group of page.groups){
    if(group.actualStampCount<1)continue;
    add(resolveTimeStampDefinition(group),group.actualStampCount,describeTimeStampOccurrence(group));
  }
  const seen=new Set<string>();
  for(const stamp of collection){
    if(!stamp.earned||stamp.definition.category==='time'||stamp.firstEarnedDate!==page.dateKey||seen.has(stamp.definition.key))continue;
    seen.add(stamp.definition.key);
    add(stamp.definition,1,stamp.reason??stamp.definition.triggerDescription);
  }
  return [...stamps.values()];
}
