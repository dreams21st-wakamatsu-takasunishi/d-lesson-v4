import {currentUser,users,hasLessonRole,isGuestMode,invokeLessonFunction} from '../api/user.js';
import {parseTeacherTasks} from '../utils/learning-tasks.js';
let student='',lastRead=0,version=0,pending=false;
export async function refreshTeacherTasks(force=false){
    const section=document.getElementById('teacher-task-section'),list=document.getElementById('teacher-task-list'),status=document.getElementById('teacher-task-status'),refresh=document.getElementById('teacher-task-refresh');
    if(!section||!list||!status||!refresh)return;
    const data=users[currentUser];
    const allowed=hasLessonRole('student')&&!isGuestMode()&&/^student_/.test(currentUser||'')&&data&&!data.publicRegistration&&data.campusId!=='public'&&!data.isMaster;
    if(!allowed){student='';pending=false;lastRead=0;version++;section.hidden=true;list.replaceChildren();status.textContent='';return;}
    if(student!==currentUser){student=currentUser;version++;pending=false;lastRead=0;list.replaceChildren();section.hidden=true;}
    if(pending||(!force&&Date.now()-lastRead<15000))return;
    const expected=student,v=++version;pending=true;lastRead=Date.now();list.replaceChildren();refresh.disabled=true;
    status.textContent='先生からのかだいを読みこみ中...';
    refresh.onclick=()=>{void refreshTeacherTasks(true);};
    try{
        const tasks=parseTeacherTasks(await invokeLessonFunction('student-learning-tasks',{studentId:expected}));
        if(v!==version||currentUser!==expected)return;
        section.hidden=tasks.length===0;status.textContent='';
        for(const task of tasks){
            const item=document.createElement('li');
            const title=document.createElement('strong');title.textContent=task.title;
            const details=document.createElement('p');details.textContent=task.instructions;
            const button=document.createElement('button');button.type='button';button.className='btn-primary';button.textContent='このれんしゅうへ';
            button.onclick=()=>{if(currentUser===expected&&hasLessonRole('student'))document.getElementById(`cat-${task.category}`)?.click();};
            item.append(title,details,button);list.append(item);
        }
    }catch{
        if(v===version&&currentUser===expected){section.hidden=false;list.replaceChildren();status.textContent='先生からのかだいを読みこめなかったよ。更新で、もういちどためしてね。';}
    }finally{if(v===version){pending=false;refresh.disabled=false;}}
}
setInterval(()=>{if(document.getElementById('screen-category')?.classList.contains('active'))void refreshTeacherTasks(true);},30000);
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'&&document.getElementById('screen-category')?.classList.contains('active'))void refreshTeacherTasks(true);});
