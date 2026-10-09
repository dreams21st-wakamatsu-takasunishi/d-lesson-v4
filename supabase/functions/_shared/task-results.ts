import {serviceDate} from './support-learning.ts';

type Row=Record<string,unknown>;
export function projectTaskResults(tasks:Row[], data:Row) {
 const seen=new Set<string>();
 const logs=(Array.isArray(data.practiceLogs)?data.practiceLogs:[])
  .filter((entry):entry is Row=>!!entry && typeof entry==='object' && !Array.isArray(entry))
  .filter(entry=>typeof entry.id==='string' && entry.id.length>0 && entry.id.length<=200 && typeof entry.at==='string' && entry.at.length<=50 && !!serviceDate(entry.at))
  .sort((a,b)=>Date.parse(String(b.at))-Date.parse(String(a.at)))
  .filter(entry=>!seen.has(String(entry.id)) && !!seen.add(String(entry.id)));
 return tasks.map(task=>{
  const period=logs.filter(entry=>{
   const date=serviceDate(entry.at);
   return date>=String(task.starts_on) && date<=String(task.ends_on) && entry.category===task.category;
  });
  const matched=task.stage_id?period.filter(entry=>entry.stageId===task.stage_id):period;
  return {taskId:task.id,revision:task.revision,count:matched.length,historyComplete:false,
   unidentifiedCount:task.stage_id?period.filter(entry=>!entry.stageId).length:0,
   latest:matched.slice(0,3).map(entry=>({id:entry.id,at:entry.at,
    detail:typeof entry.detail==='string'?entry.detail.slice(0,240):'',amount:typeof entry.amount==='string'?entry.amount.slice(0,160):''}))};
 });
}
