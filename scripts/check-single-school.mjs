import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {OPERATIONAL_SCHOOL,studentLoginCodes} from '../src/utils/single-school.js';
assert.equal(OPERATIONAL_SCHOOL,'wakamatsu-takasunishi');
assert.deepEqual(studentLoginCodes(),[OPERATIONAL_SCHOOL,'']);
const api=readFileSync('src/api/user.js','utf8'),admin=readFileSync('src/ui/admin-student-data.js','utf8'),html=readFileSync('index.html','utf8');
assert.match(api,/function getStudentLoginCampusCodesToTry\(\)\s*\{\s*return studentLoginCodes\(\);/);
for(const name of ['adminAddUser','adminResetStudentPasscode','adminDeleteUser','adminAddCampus','adminDeleteCampus']){
 const body=admin.match(new RegExp('export (?:async )?function '+name+'\\([^)]*\\) \\{([\\s\\S]*?)\\n\\}'))?.[1];
 assert.ok(body);assert.match(body,/Dサポート/);assert.doesNotMatch(body,/await |delete users|deleteCloud|saveUsers/);
}
assert.doesNotMatch(html,/onclick="adminAddUser\(\)"|onclick="adminDeleteUser\(\)"|onclick="adminResetStudentPasscode\(\)"/);
console.log('Single-school login ordering and D Support-only registration/reset/deletion UI passed.');
