export const taskCategories=['mouse','keyboard','text','word','vision','minigame'] as const;
export function publicTask(row:Record<string,unknown>){return {id:row.id,revision:row.revision,category:row.category,title:row.title,instructions:row.instructions,startsOn:row.starts_on,endsOn:row.ends_on,active:row.active,updatedAt:row.updated_at,...(row.stage_id?{stageId:row.stage_id}:{})};}
