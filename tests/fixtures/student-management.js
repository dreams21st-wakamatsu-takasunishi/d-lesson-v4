// Local fictional fixture. No real API request is allowed by its browser test.
import '/src/style.css';
import '/src/styles/interface.css';
import * as api from '/src/api/user.js';
import * as table from '/src/ui/admin-user-table.js';
import * as students from '/src/ui/admin-student-data.js';
import {replaceCampusCatalogs} from '/src/utils/managed-content.js';
import {showScreen} from '/src/ui/screen.js';
import {updateGlobalHeader} from '/src/ui/home-dashboard.js';
api.supabase.auth.getUser=async()=>({data:{user:{id:'11111111-1111-4111-8111-111111111111'}},error:null});
await api.refreshCurrentLessonAccess();
await api.replaceUsers({
 __GLOBAL_SETTINGS__:{textTasks:[{id:'legacy',title:'共通教材'}],campuses:[{id:'main',name:'古い設定名',code:'main'}]},
 student_classroom:{userDataId:'student_classroom',displayName:'架空児童 あおい',birthdate:'2016-01-01',campusId:'school',group:'小学部',coins:9,keyboardSequence:3,loginNumber:'1',authUserId:'22222222-2222-4222-8222-222222222222'},
 student_legacy:{userDataId:'student_legacy',displayName:'架空児童 旧データ',birthdate:'2015-01-01',campusId:'main',coins:8,keyboardSequence:2}
},false);
api.replaceCampusRegistry([{id:'main',name:'本校',code:'main',registration_enabled:false},{id:'school',name:'架空の運用校',code:'school',registration_enabled:true}]);
replaceCampusCatalogs([{campus_id:'school',content:{textTasks:[{id:'fixture_task',title:'校舎教材',content:'本文',time:10,star:5,targetGroup:'',hidden:false}],customThemes:[],customEffects:[]}}]);
await api.refreshStudentManagementStatus();
Object.assign(window,table,students,{__managementFixture:{api,render:()=>table.updateAdminUserTable()}});
students.renderCampusAdmin(); table.updateAdminUserTable(); showScreen('screen-admin');
document.getElementById('admin-main-menu').style.display='none';
document.getElementById('admin-panel-content').style.display='flex';
document.getElementById('admin-sec-users').style.display='flex';
document.getElementById('admin-sec-users').style.flexDirection='column';
updateGlobalHeader();
document.body.dataset.fixtureReady='true';
