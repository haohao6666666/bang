import { useState } from 'react';
import { TimeDistribution } from './TimeDistribution';

type Task = {id:string;subject:string};
type Log = {id:string;taskId:string;startedAt:number;durationMs:number};
export function focusTimeGroups(tasks:Task[], logs:Log[], from:number, until:number) {
  const seen = new Set<string>();
  return logs.flatMap(log=>{
    if(seen.has(log.id))return []; seen.add(log.id);
    if(!Number.isFinite(log.startedAt)||!Number.isFinite(log.durationMs)||log.durationMs<=0)return [];
    const ms=Math.max(0,Math.min(log.startedAt+log.durationMs,until)-Math.max(log.startedAt,from));
    return ms?[{subject:tasks.find(t=>t.id===log.taskId)?.subject||'未分类',taskKind:'custom' as const,actualMs:ms}]:[];
  });
}
export function TaskTimeStats({tasks,logs}:{tasks:Task[];logs:Log[]}) {
  const [range,setRange]=useState('month');
  const now=new Date(), today=new Date(now.getFullYear(),now.getMonth(),now.getDate());
  const from=range==='all'?0:range==='month'?new Date(now.getFullYear(),now.getMonth(),1).getTime():range==='week'?new Date(today.getFullYear(),today.getMonth(),today.getDate()-6).getTime():today.getTime();
  const groups=focusTimeGroups(tasks,logs,from,now.getTime());
  return <section className="task-time-stats" aria-label="任务分类时长统计">
    <header><h2>时间花在哪儿</h2><select aria-label="统计时间范围" value={range} onChange={e=>setRange(e.target.value)}><option value="today">今天</option><option value="week">近 7 天</option><option value="month">本月</option><option value="all">全部</option></select></header>
    <TimeDistribution groups={groups}/>
    <small>按任务类别汇总专注时间，正在进行的也会记上，暂停时间不计入。</small>
  </section>;
}
