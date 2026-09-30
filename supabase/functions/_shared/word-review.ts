export const wordStages = ['w_b1_1','w_b1_2','w_b1_3','w_b1_4','w_b1_5','w_m4_1','w_m4_2','w_m4_3'];
export const wordBucket = 'lesson-word-work';
export const wordSizeLimit = 8 * 1024 * 1024;
export const uuid = (value: unknown): value is string => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
export function validArtifact(bytes: Uint8Array, mime: string) {
  if (!bytes.length || bytes.length > wordSizeLimit) return false;
  if (mime === 'application/pdf') return new TextDecoder().decode(bytes.slice(0,5)) === '%PDF-';
  if (mime === 'image/png') return [137,80,78,71,13,10,26,10].every((value,index)=>bytes[index]===value);
  return mime === 'image/jpeg' && bytes[0]===255 && bytes[1]===216 && bytes[2]===255;
}
export async function artifactHash(bytes: Uint8Array) {
  return [...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes as Uint8Array<ArrayBuffer>))].map(value=>value.toString(16).padStart(2,'0')).join('');
}
export function publicRequest(row: Record<string, unknown>) {
  return {id:row.id,studentId:row.student_id,stageId:row.stage_id,childId:row.child_id,linkId:row.link_id,
    page:row.page,fileType:row.file_type,fileSize:row.file_size,status:row.status,revision:row.revision,
    submittedAt:row.submitted_at,reviewedAt:row.reviewed_at,reviewerName:row.reviewer_name,
    reason:row.reason,reward:row.reward,artifactAvailable:!row.artifact_deleted_at};
}
