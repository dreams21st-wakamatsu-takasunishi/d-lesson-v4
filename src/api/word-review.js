import {supabase,invokeLessonFunction} from './user.js';
const table=import.meta.env.VITE_SUPABASE_TABLE||(import.meta.env.VITE_SUPABASE_USE_TEST_TABLE==='true'?'test_user_data':'user_data');
export const loadStudentWordReviews=studentId=>invokeLessonFunction('student-word-review',{action:'status',studentId});
export const cancelWordUpload=(studentId,requestId)=>invokeLessonFunction('student-word-review',{action:'cancel',studentId,requestId});
export async function submitStudentWord({studentId,stageId,page,file,requestId,onPrepared}){
  if(!file||!['application/pdf','image/png','image/jpeg'].includes(file.type)||!file.size||file.size>8*1024*1024)throw Error('8MBまでのPDF・PNG・JPEGをえらんでね。');
  const current=await loadStudentWordReviews(studentId);
  const existing=current.requests.find(row=>row.id===requestId&&row.status==='pending');
  if(existing)return {request:existing};
  const prepared=await invokeLessonFunction('student-word-review',{action:'prepare',studentId,stageId,page,requestId,fileType:file.type,fileSize:file.size});
  onPrepared?.();
  const {error}=await supabase.storage.from('lesson-word-work').uploadToSignedUrl(prepared.upload.path,prepared.upload.token,file,{contentType:file.type,upsert:false});
  if(error){
    // A lost upload response may still have stored the immutable object.
    try{return await invokeLessonFunction('student-word-review',{action:'submit',studentId,requestId});}
    catch{throw Error('作品を送信できませんでした。通信を確認して、もう一度送ってね。');}
  }
  return invokeLessonFunction('student-word-review',{action:'submit',studentId,requestId});
}
export async function readWordStudentSnapshot(studentId){
  const {data,error}=await supabase.from(table).select('id,data').eq('id',studentId).single();
  if(error||data.id!==studentId)throw Error('先生の確認結果を読み直せませんでした。');
  return data.data;
}
