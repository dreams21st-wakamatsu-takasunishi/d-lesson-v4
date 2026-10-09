import {findTaskStage} from './task-stages.js';
const categories=new Set(['mouse','keyboard','text','word','vision','minigame']);
export function parseTeacherTasks(payload){
    if(payload?.schemaVersion!==1||!Array.isArray(payload.tasks)||payload.tasks.length>100)throw Error('先生からのかだいを読みなおしてね。');
    const today=new Date().toLocaleDateString('sv-SE',{timeZone:'Asia/Tokyo'});
    const tasks=payload.tasks.map(row=>{
        if(!row||!(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i).test(row.id)||!categories.has(row.category)||typeof row.title!=='string'||!row.title.trim()||row.title.length>80||typeof row.instructions!=='string'||row.instructions.length>500||row.active!==true||!Number.isSafeInteger(row.revision)||row.revision<1||!(/^\d{4}-\d{2}-\d{2}$/).test(row.startsOn)||!(/^\d{4}-\d{2}-\d{2}$/).test(row.endsOn)||row.startsOn>today||row.endsOn<today)throw Error('先生からのかだいを読みなおしてね。');
        if(row.stageId!=null&&!findTaskStage(row.category,row.stageId))throw Error('先生からのかだいを読みなおしてね。');
        return {id:row.id,category:row.category,title:row.title,instructions:row.instructions,...(row.stageId?{stageId:row.stageId}:{})};
    });
    if(new Set(tasks.map(task=>task.id)).size!==tasks.length)throw Error('先生からのかだいを読みなおしてね。');
    return tasks;
}
