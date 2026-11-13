import assert from 'node:assert/strict';
import {readLessonUserRows} from '../src/api/lesson-user-read.js';

const calls=[];
const client={from:table=>({select:fields=>{
    calls.push([table,fields]);
    return {in:(key,ids)=>calls.push([key,ids])};
}})};
readLessonUserRows(client,'test_user_data','student_fixture','__GLOBAL_SETTINGS__');
assert.deepEqual(calls,[['test_user_data','id,data'],['id',['student_fixture','__GLOBAL_SETTINGS__']]]);
calls.length=0;
readLessonUserRows(client,'user_data',null,'__GLOBAL_SETTINGS__');
assert.deepEqual(calls,[['user_data','id,data']]);
console.log('Lesson scope projections: passed');
