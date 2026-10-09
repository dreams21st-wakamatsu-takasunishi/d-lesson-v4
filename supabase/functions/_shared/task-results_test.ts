import {projectTaskResults} from './task-results.ts';
const assert=(condition:unknown,label:string)=>{if(!condition)throw Error(label);};
Deno.test('task results match exact stage and JST dates, dedupe, exclude old/unrelated/outside logs without rewriting data',()=>{
 const task={id:'task',revision:3,category:'mouse',stage_id:'1',starts_on:'2026-10-01',ends_on:'2026-10-01'};
 const log={id:'a',at:'2026-09-30T15:00:00Z',category:'mouse',stageId:'1',detail:'クリア',amount:'5回',secret:'omit'};
 const data={practiceLogs:[log,log,{...log,id:'before',at:'2026-09-30T14:59:59Z'},{...log,id:'after',at:'2026-10-01T15:00:00Z'},
  {...log,id:'other-stage',stageId:'2'},{...log,id:'other-course',category:'keyboard'}, {...log,id:'legacy',stageId:undefined}, {...log,id:'invalid',at:'invalid'}]};
 const snapshot=JSON.stringify(data),result=projectTaskResults([task],data)[0];
 assert(result.count===1&&result.unidentifiedCount===1,'exact stage and date');
 assert(result.revision===3&&result.historyComplete===false,'no completion or historical completeness inference');
 assert(!('secret' in result.latest[0]),'safe projection');assert(JSON.stringify(data)===snapshot,'immutable logs');
 assert(projectTaskResults([{...task,stage_id:null}],data)[0].count===3,'legacy category assignments remain usable');
});
