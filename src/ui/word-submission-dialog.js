import {cancelWordUpload,loadStudentWordReviews,submitStudentWord} from '../api/word-review.js';
import {setLessonIcon} from './interface.js';
export function showWordSubmissionDialog({studentId,stageId,stageTitle,page,isCurrent,onSubmitted}){
  if(document.getElementById('word-submission-dialog'))return;
  const returnFocus=document.activeElement,dialog=document.createElement('dialog');
  dialog.id='word-submission-dialog';dialog.className='lesson-dialog';dialog.setAttribute('aria-labelledby','word-submit-title');
  dialog.innerHTML=`<form class="word-approval-form"><header class="lesson-dialog-heading"><h2 id="word-submit-title">先生にみてもらう</h2><button type="button" class="sys-btn" data-close aria-label="とじる" title="とじる"></button></header>
    <p data-stage></p><label>作品のPDF・画像<input type="file" name="work" required accept="application/pdf,image/png,image/jpeg"></label>
    <label class="word-approval-check"><input type="checkbox" name="share" required>この作品を先生に送ります</label>
    <p role="alert" class="word-approval-error" aria-live="polite"></p><footer class="lesson-dialog-actions"><button type="button" class="btn-secondary" data-close>やめる</button><button type="submit" class="btn-primary">先生に送る</button></footer></form>`;
  dialog.querySelector('[data-stage]').textContent=stageTitle+(page?`・${page}ページまで`:'');
  document.body.appendChild(dialog);setLessonIcon(dialog.querySelector('.sys-btn'),'x');
  const form=dialog.querySelector('form'),errorElement=dialog.querySelector('[role="alert"]');
  let busy=false,prepared=false,requestId=crypto.randomUUID();
  const close=async()=>{
    if(busy)return;
    if(prepared){busy=true;try{await cancelWordUpload(studentId,requestId);}catch(error){
      try{const state=await loadStudentWordReviews(studentId);if(state.requests.some(row=>row.id===requestId&&row.status==='pending')){prepared=false;busy=false;dialog.close();if(isCurrent())onSubmitted();return;}}catch{}
      errorElement.textContent=error.message+' もう一度かくにんしてね。';busy=false;return;
    }busy=false;}
    dialog.close();
  };
  dialog.querySelectorAll('[data-close]').forEach(button=>button.addEventListener('click',()=>void close()));
  dialog.addEventListener('cancel',event=>{event.preventDefault();void close();});
  dialog.addEventListener('close',()=>{form.reset();dialog.remove();if(returnFocus?.isConnected)returnFocus.focus();},{once:true});
  form.addEventListener('submit',async event=>{
    event.preventDefault();if(busy||!form.reportValidity())return;
    if(!isCurrent()){errorElement.textContent='児童の画面が変わりました。とじて、もう一度えらんでね。';return;}
    const file=form.elements.namedItem('work').files[0];
    busy=true;errorElement.textContent='';form.querySelectorAll('input,button').forEach(control=>{control.disabled=true;});
    const submit=form.querySelector('[type="submit"]');submit.textContent='送っています…';
    try{await submitStudentWord({studentId,stageId,page,file,requestId,onPrepared:()=>{prepared=true;}});prepared=false;busy=false;dialog.close();if(isCurrent())onSubmitted();}
    catch(error){errorElement.textContent=error.message||'送信できませんでした。';}
    finally{busy=false;if(dialog.isConnected){form.querySelectorAll('input,button').forEach(control=>{control.disabled=false;});if(prepared)form.elements.namedItem('work').disabled=true;submit.textContent='先生に送る';}}
  });
  dialog.showModal();
}
