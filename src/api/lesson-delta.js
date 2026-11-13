const same = (a,b) => JSON.stringify(a)===JSON.stringify(b);

export function lessonDelta(previous, next) {
    const before=JSON.parse(previous), after=JSON.parse(next);
    const patch=Object.fromEntries(Object.entries(after).filter(([key,value])=>!Object.hasOwn(before,key)||!same(before[key],value)));
    const removed=Object.keys(before).filter(key=>!Object.hasOwn(after,key));
    return {patch,removed};
}

export function createLessonDeltaWriter(initialRevision, initialData, write) {
    let revision=initialRevision,baseline=JSON.stringify(initialData),queue=Promise.resolve();
    let pending=0;
    const save=(data,isCurrent=()=>true)=>{
        const snapshot=JSON.stringify(data);
        pending++;
        const request=queue.then(async()=>{
            if(!isCurrent())throw Error('LESSON_SESSION_CHANGED');
            const {patch,removed}=lessonDelta(baseline,snapshot);
            if(!Object.keys(patch).length&&!removed.length)return;
            const result=await write(revision,patch,removed);
            if(typeof result!=='string'||!/^\d{1,10}$/.test(result))throw Error('LESSON_SAVE_RESULT_UNVERIFIED');
            revision=result;
            baseline=snapshot;
        });
        queue=request.catch(()=>{});
        return request;
    };
    const writeSnapshot=(data,isCurrent)=>save(data,isCurrent).finally(()=>{pending--;});
    writeSnapshot.busy=()=>pending>0;
    return writeSnapshot;
}
