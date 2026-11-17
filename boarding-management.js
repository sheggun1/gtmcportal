(function(){
'use strict';
const $=id=>document.getElementById(id), escv=v=>typeof esc==='function'?esc(v==null?'':String(v)):String(v==null?'':v);
function hasBoardingRole(){return hasRole('admin')||hasRole('vice_principal_admin')||hasRole('vice_principal')||hasRole('housemaster')||hasRole('housemistress');}
function installBoarding(){
 if(!S||!S.user||!hasBoardingRole()||!$('main')||$('boardingPanel'))return;
 const side=$('sidebar'),main=$('main');
 side.insertAdjacentHTML('beforeend','<div class="group"><div class="group-title">Boarding</div><div class="nav-item" data-tab="boarding" onclick="setNav(\'boarding\')"><span class="dot"></span><span>Boarding Management</span></div></div>');
 main.insertAdjacentHTML('beforeend',`
 <div class="panel" data-panel="boarding" id="boardingPanel">
  <div class="page-head"><h1>Boarding Management</h1><p>Boys’ and Girls’ Boarding Sections · Parent portal sign-out and return notifications</p></div>
  <div class="grid cols-4" id="boardingStats"></div>
  <div class="card" id="boardingAssignCard"><h2>Register a Boarder</h2><p class="sub">For the VP Administration and administrator. Boarding charges are generated from the existing fee structure.</p>
   <div class="grid cols-4"><div><label>Class</label><select id="brClass"></select></div><div><label>Student</label><select id="brStudent"></select></div><div><label>Section</label><select id="brSection"><option value="Boys">Boys’ Boarding</option><option value="Girls">Girls’ Boarding</option></select></div><div><label>Academic year</label><input id="brYear" placeholder="2026/2027"></div><div><label>Term</label><select id="brTerm"><option value="Term1">First Term</option><option value="Term2">Second Term</option><option value="Term3">Third Term</option></select></div></div>
   <button class="ok" style="margin-top:12px" onclick="gtmcBoardingAssign()">Register Boarder & Add Fee</button>
  </div>
  <div class="card"><div class="row" style="justify-content:space-between"><div><h2>Current Boarders</h2><p class="sub">Housemaster/housemistress access is restricted to their assigned section. VP Administration sees both sections.</p></div><button class="sec sm" onclick="gtmcBoardingLoad()">Refresh</button></div><div id="boardingStudents"></div></div>
  <div class="card"><h2>Student Sign-out</h2><p class="sub">The parent receives a notification in their school portal when the sign-out is recorded.</p>
   <div class="grid cols-4"><div><label>Student</label><select id="brExitStudent"></select></div><div><label>Reason</label><input id="brReason" placeholder="Reason for leaving"></div><div><label>Destination</label><input id="brDestination" placeholder="Where the student is going"></div><div><label>Expected return</label><input id="brExpected" type="datetime-local"></div><div><label>Authorised by</label><input id="brAuthorised" placeholder="Name of approving staff"></div></div>
   <button class="blue" style="margin-top:12px" onclick="gtmcBoardingSignOut()">Record Sign-out & Notify Parent</button>
  </div>
  <div class="card"><h2>Academic Performance Monitoring</h2><p class="sub">Read-only view of existing recorded scores for boarders in the selected class. Examination records and calculations are not changed.</p><div class="grid cols-3"><div><label>Class</label><select id="brPerfClass"></select></div><div><label>Term</label><select id="brPerfTerm"><option value="Term1">First Term</option><option value="Term2">Second Term</option><option value="Term3">Third Term</option></select></div><div style="display:flex;align-items:flex-end"><button class="blue" onclick="gtmcBoardingPerformance()">Load performance</button></div></div><div id="brPerformance" style="margin-top:12px"><div class="empty">Select a class and load performance.</div></div></div>
  <div class="card"><h2>Sign-out and Return History</h2><div id="boardingHistory"></div></div>
 </div>`);
 const isGlobal=hasRole('admin')||hasRole('vice_principal_admin')||hasRole('vice_principal');
 $('boardingAssignCard').style.display=isGlobal?'':'none';
 if(!isGlobal){$('brExitStudent').closest('.card');}
 loadClasses().then(async cs=>{const list=(cs||[]).map(x=>typeof x==='string'?x:x.class||x.className).filter(Boolean);$('brClass').innerHTML=list.map(c=>'<option>'+escv(c)+'</option>').join('');$('brClass').onchange=gtmcBoardingLoadClassStudents;await gtmcBoardingLoadClassStudents();}).catch(e=>toast(e.message,'err'));
 gtmcBoardingLoad();
}
window.gtmcBoardingLoadClassStudents=async function(){
 const cls=$('brClass')&&$('brClass').value;if(!cls)return;
 try{const rows=await api('boardingStudentOptions',{className:cls});$('brStudent').innerHTML=rows.map(x=>'<option value="'+escv(x.student_id)+'">'+escv(x.name)+' · '+escv(x.student_id)+'</option>').join('');}catch(e){toast(e.message,'err');}
};
window.gtmcBoardingLoad=async function(){
 if(!$('boardingPanel'))return;
 try{
  const [d,rows,history]=await Promise.all([api('boardingDashboard'),api('boardingList'),api('boardingHistory')]);
  $('boardingStats').innerHTML=[['Total boarders',d.boarders],['Boys',d.boys],['Girls',d.girls],['Currently out',d.currentlyOut]].map(x=>'<div class="stat-card"><div class="sub">'+x[0]+'</div><div class="stat-number">'+x[1]+'</div></div>').join('');
  const students=rows.students||[];
  $('boardingStudents').innerHTML=students.length?'<div class="table-wrap"><table><thead><tr><th>Student</th><th>Class</th><th>Section</th><th>Academic year</th><th>Term</th><th>Action</th></tr></thead><tbody>'+students.map(x=>'<tr><td>'+escv(x.student_name)+'<br><small>'+escv(x.student_id)+'</small></td><td>'+escv(x.class)+'</td><td>'+escv(x.section)+'</td><td>'+escv(x.academic_year)+'</td><td>'+escv(x.term)+'</td><td>'+(hasRole('admin')||hasRole('vice_principal_admin')||hasRole('vice_principal')?'<button class="danger sm" onclick="gtmcBoardingEnd('+JSON.stringify(x.assignment_id)+')">End boarding</button>':'')+'</td></tr>').join('')+'</tbody></table></div>':'<div class="empty">No current boarders in this section.</div>';
  $('brExitStudent').innerHTML=students.map(x=>'<option value="'+escv(x.student_id)+'" data-class="'+escv(x.class)+'">'+escv(x.student_name)+' · '+escv(x.class)+'</option>').join('');
  $('boardingHistory').innerHTML=history.length?'<div class="table-wrap"><table><thead><tr><th>Student</th><th>Section</th><th>Sign-out</th><th>Reason</th><th>Expected return</th><th>Status</th><th>Action</th></tr></thead><tbody>'+history.map(x=>'<tr><td>'+escv(x.student_name)+'<br><small>'+escv(x.student_id)+'</small></td><td>'+escv(x.section)+'</td><td>'+escv(x.exit_time?new Date(x.exit_time).toLocaleString():'')+'</td><td>'+escv(x.reason)+'</td><td>'+escv(x.expected_return)+'</td><td>'+escv(x.status)+'</td><td>'+(x.status==='Out'?'<button class="ok sm" onclick="gtmcBoardingReturn('+JSON.stringify(x.exit_id)+')">Record return</button>':'')+'</td></tr>').join('')+'</tbody></table></div>':'<div class="empty">No sign-out records yet.</div>';
 }catch(e){$('boardingStudents').innerHTML='<div class="empty">'+escv(e.message)+'</div>';}
};
window.gtmcBoardingPerformance=async function(){
 const box=$('brPerformance');if(!box)return;box.innerHTML='<div class="empty">Loading existing academic records…</div>';
 try{const d=await api('boardingPerformance',{className:$('brPerfClass').value,term:$('brPerfTerm').value});const students=d.students||[],scores=d.scores||{};
  box.innerHTML=students.length?'<div class="table-wrap"><table><thead><tr><th>Student</th><th>Subject</th><th>T1</th><th>T2</th><th>T3</th><th>Exam</th></tr></thead><tbody>'+students.map(st=>{const by=scores[st.student_id]||{};const subjects=Object.keys(by);return subjects.length?subjects.map(sub=>{const x=by[sub]||{};return '<tr><td>'+escv(st.name)+'<br><small>'+escv(st.student_id)+'</small></td><td>'+escv(sub)+'</td><td>'+escv(x.T1)+'</td><td>'+escv(x.T2)+'</td><td>'+escv(x.T3)+'</td><td>'+escv(x.Exam)+'</td></tr>';}).join(''):'<tr><td>'+escv(st.name)+'</td><td colspan="5">No scores recorded for this term.</td></tr>';}).join('')+'</tbody></table></div>':'<div class="empty">No boarders are currently assigned to this class.</div>';
 }catch(e){box.innerHTML='<div class="empty">'+escv(e.message)+'</div>';}
};
window.gtmcBoardingAssign=async function(){
 try{const r=await api('boardingAssign',{studentId:$('brStudent').value,className:$('brClass').value,section:$('brSection').value,academicYear:$('brYear').value.trim(),term:$('brTerm').value});toast(r.charge&&r.charge.created?'Boarder registered and boarding fee added.':'Boarder registered. '+(r.charge&&r.charge.reason||''),'ok');await gtmcBoardingLoad();}catch(e){toast(e.message,'err');}
};
window.gtmcBoardingEnd=async function(id){if(!confirm('End this student’s boarding status? Existing fee and payment records will be preserved.'))return;try{await api('boardingEnd',{assignmentId:id});toast('Boarding status updated.','ok');await gtmcBoardingLoad();}catch(e){toast(e.message,'err');}};
window.gtmcBoardingSignOut=async function(){
 const option=$('brExitStudent').selectedOptions[0];if(!option)return toast('Select a boarder.','err');
 try{const r=await api('boardingRecordExit',{studentId:$('brExitStudent').value,className:option.dataset.class,reason:$('brReason').value,destination:$('brDestination').value,expectedReturn:$('brExpected').value,authorisedBy:$('brAuthorised').value});toast('Sign-out recorded. Parent portal notifications sent: '+r.parentNotifications,'ok');$('brReason').value='';$('brDestination').value='';$('brExpected').value='';await gtmcBoardingLoad();}catch(e){toast(e.message,'err');}
};
window.gtmcBoardingReturn=async function(id){if(!confirm('Confirm that this student has returned to the boarding section?'))return;try{const r=await api('boardingRecordReturn',{exitId:id});toast('Return recorded. Parent portal notifications sent: '+r.parentNotifications,'ok');await gtmcBoardingLoad();}catch(e){toast(e.message,'err');}};
const priorBoot=window.boot;
if(typeof priorBoot==='function')window.boot=async function(){
 if(S&&S.user&&hasBoardingRole()&&!hasRole('admin')&&!hasRole('principal')&&!hasRole('vice_principal')&&!hasRole('vice_principal_admin')&&!hasRole('vice_principal_academic')&&!hasRole('bursar')&&!hasRole('registrar')&&!hasRole('class_teacher')&&!hasRole('subject_teacher')&&!hasRole('student')&&!hasRole('parent')){
  $('loginView').style.display='none';$('appView').style.display='flex';$('userLabel').textContent=S.user.name||S.user.email;$('userRole').textContent=hasRole('housemaster')?'Housemaster':'Housemistress';if(typeof applyLogoFallback==='function')applyLogoFallback();installBoarding();setNav('boarding');return;
 }
 const result=await priorBoot.apply(this,arguments);
 if(S&&S.user&&hasBoardingRole())installBoarding();
 return result;
};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(installBoarding,500));else setTimeout(installBoarding,500);
})();