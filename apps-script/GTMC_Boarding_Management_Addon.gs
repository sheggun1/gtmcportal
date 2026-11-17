/**
 * GTMC BOARDING MANAGEMENT ADD-ON
 * Add this file to the Apps Script project alongside Code.gs and the existing add-ons.
 * Creates only new boarding tabs; existing student, result and finance records are preserved.
 */
var GTMC_BOARDING_SECTIONS_ = ['Boys','Girls'];
var GTMC_BOARDING_SCHEMAS_ = {
  BoardingAssignments:['assignment_id','student_id','student_name','class','section','status','academic_year','term','boarding_fee_amount','assigned_at','assigned_by','ended_at','ended_by'],
  BoardingExits:['exit_id','student_id','student_name','class','section','exit_time','reason','destination','expected_return','authorised_by','recorded_by','return_time','return_recorded_by','status','created_at']
};
function gtmcBoardingEnsure_(){
  var ss=openSS();
  Object.keys(GTMC_BOARDING_SCHEMAS_).forEach(function(name){
    var sh=ss.getSheetByName(name);
    if(!sh)sh=ss.insertSheet(name);
    var headers=GTMC_BOARDING_SCHEMAS_[name],last=sh.getLastColumn();
    if(!last){sh.getRange(1,1,1,headers.length).setValues([headers]);return;}
    var current=sh.getRange(1,1,1,last).getValues()[0].map(function(x){return String(x||'').trim();});
    headers.forEach(function(h){if(current.indexOf(h)<0){current.push(h);sh.getRange(1,current.length).setValue(h);}});
  });
  var users=ss.getSheetByName('Users');
  if(users){
    var last=users.getLastColumn(),heads=users.getRange(1,1,1,last).getValues()[0].map(function(x){return String(x||'').trim().toLowerCase();});
    if(heads.indexOf('boarding_section')<0)users.getRange(1,last+1).setValue('boarding_section');
  }
}
function gtmcBoardingBool_(v){return v===true||String(v).toLowerCase()==='true'||String(v)==='1';}
function gtmcBoardingUser_(token,allowAll){
  gtmcBoardingEnsure_();
  var u=verifyToken(token),roles=roleList_(u),section='';
  if(roles.indexOf('admin')>=0||roles.indexOf('vice_principal_admin')>=0)return {user:u,all:true,section:''};
  if(roles.indexOf('housemaster')>=0||roles.indexOf('housemistress')>=0){
    var rows=sheetToObjects(getSheet('Users')),row=rows.filter(function(x){return String(x.email||'').toLowerCase()===String(u.email||'').toLowerCase();})[0];
    section=String(row&&row.boarding_section||'').trim();
    if(GTMC_BOARDING_SECTIONS_.indexOf(section)<0)throw new Error('Your boarding section has not been assigned. Contact the administrator.');
    if((roles.indexOf('housemaster')>=0&&section!=='Boys')||(roles.indexOf('housemistress')>=0&&section!=='Girls'))throw new Error('Your account role does not match its assigned boarding section.');
    return {user:u,all:false,section:section};
  }
  throw new Error('You do not have permission to access Boarding Management.');
}
function gtmcBoardingStudent_(studentId,className){
  if(CLASSES.indexOf(String(className))<0)throw new Error('Unknown class.');
  var sh=getSheet(String(className)),last=sh.getLastRow(),found=null;
  if(last>=4){var data=sh.getRange(4,1,last-3,2).getValues();for(var i=0;i<data.length;i++){if(String(data[i][0])===String(studentId)){found={student_id:String(data[i][0]),name:String(data[i][1]),class:String(className)};break;}}}
  if(!found)throw new Error('Student not found in the selected class.');
  return found;
}
function gtmcBoardingCharge_(student,section,year,term,actor){
  var fs=sheetToObjects(getSheet('FeeStructures'));
  var fee=fs.filter(function(x){
    return String(x.class)===String(student.class)&&String(x.academic_year)===String(year)&&String(x.term)===String(term)&&String(x.category).toLowerCase()==='boarding fees'&&x.active!==false&&String(x.active).toLowerCase()!=='false';
  })[0];
  if(!fee||!(Number(fee.amount)>0))return {created:false,reason:'No active Boarding Fees structure is configured for this class, academic year and term.'};
  var sh=getSheet('StudentCharges'),charges=sheetToObjects(sh);
  var exists=charges.some(function(x){return String(x.student_id)===String(student.student_id)&&String(x.academic_year)===String(year)&&String(x.term)===String(term)&&String(x.category).toLowerCase()==='boarding fees'&&x.active!==false&&String(x.active).toLowerCase()!=='false';});
  if(exists)return {created:false,reason:'A boarding charge already exists for this student and term.'};
  var id='BRD-'+Utilities.getUuid().slice(0,12).toUpperCase(),now=new Date();
  sh.appendRow([id,student.student_id,student.name,student.class,year,term,'Boarding Fees',Number(fee.amount),'Automatic boarding charge ('+section+' Section)',true,now,actor]);
  return {created:true,amount:Number(fee.amount),chargeId:id};
}
function gtmcBoardingAssign_(p,token){
  var access=gtmcBoardingUser_(token,true),u=access.user;
  if(!access.all)throw new Error('Only the VP Administration or an administrator can register boarders.');
  var section=String(p.section||'').trim(),year=String(p.academicYear||'').trim(),term=String(p.term||'').trim();
  if(GTMC_BOARDING_SECTIONS_.indexOf(section)<0)throw new Error('Choose Boys or Girls.');
  if(!year||['Term1','Term2','Term3'].indexOf(term)<0)throw new Error('Academic year and term are required.');
  var student=gtmcBoardingStudent_(p.studentId,p.className),active=sheetToObjects(getSheet('BoardingAssignments'));
  var current=active.filter(function(x){return String(x.student_id)===String(student.student_id)&&String(x.status)==='Boarder'&&!x.ended_at;})[0];
  if(current&&String(current.section)===section)return {success:true,alreadyAssigned:true,charge:{created:false,reason:'Student is already registered in this section.'}};
  if(current)throw new Error('This student is already registered in '+current.section+' Boarding. End that assignment before transferring sections.');
  var id='BAS-'+Utilities.getUuid().slice(0,12).toUpperCase(),now=new Date();
  getSheet('BoardingAssignments').appendRow([id,student.student_id,student.name,student.class,section,'Boarder',year,term,'',now,u.email,'','']);
  var charge=gtmcBoardingCharge_(student,section,year,term,u.email);
  logAudit(u.email,'boardingStudentAssigned',{studentId:student.student_id,section:section,academicYear:year,term:term,charge:charge});
  return {success:true,assignmentId:id,charge:charge};
}
function gtmcBoardingEnd_(p,token){
  var access=gtmcBoardingUser_(token,true),u=access.user;
  if(!access.all)throw new Error('Only the VP Administration or an administrator can change boarding status.');
  var sh=getSheet('BoardingAssignments'),rows=sheetToObjects(sh),idx=rows.findIndex(function(x){return String(x.assignment_id)===String(p.assignmentId)&&String(x.status)==='Boarder'&&!x.ended_at;});
  if(idx<0)throw new Error('Active boarding assignment not found.');
  sh.getRange(idx+2,6).setValue('Day Student');sh.getRange(idx+2,12).setValue(new Date());sh.getRange(idx+2,13).setValue(u.email);
  logAudit(u.email,'boardingStatusEnded',{assignmentId:p.assignmentId});
  return {success:true};
}
function gtmcBoardingStudentOptions_(p,token){
  var access=gtmcBoardingUser_(token,true);if(!access.all)throw new Error('Only the VP Administration or an administrator can register boarders.');
  var cls=String(p.className||'').trim();if(CLASSES.indexOf(cls)<0)throw new Error('Choose a valid class.');
  var sh=getSheet(cls),last=sh.getLastRow();if(last<4)return [];
  return sh.getRange(4,1,last-3,2).getValues().filter(function(r){return r[0]!==''&&r[1]!=='';}).map(function(r){return {student_id:String(r[0]),name:String(r[1]),class:cls};});
}
function gtmcBoardingStudentIdsForClass_(className,token){
  var access=gtmcBoardingUser_(token,false);
  return sheetToObjects(getSheet('BoardingAssignments')).filter(function(x){return String(x.class)===String(className)&&String(x.status)==='Boarder'&&!x.ended_at&&(!access.section||String(x.section)===access.section);}).map(function(x){return String(x.student_id);});
}
function gtmcBoardingPerformance_(p,token){
  var access=gtmcBoardingUser_(token,false),cls=String(p.className||'').trim();
  if(CLASSES.indexOf(cls)<0)throw new Error('Choose a valid class.');
  var ids=gtmcBoardingStudentIdsForClass_(cls,token);
  if(!ids.length)return {students:[],scores:{}};
  var scores=getClassScores({className:cls,term:p.term},token),filtered={};
  ids.forEach(function(id){if(scores[id])filtered[id]=scores[id];});
  var students=sheetToObjects(getSheet('BoardingAssignments')).filter(function(x){return String(x.class)===cls&&String(x.status)==='Boarder'&&!x.ended_at&&(!access.section||String(x.section)===access.section)&&ids.indexOf(String(x.student_id))>=0;}).map(function(x){return {student_id:x.student_id,name:x.student_name,class:x.class,section:x.section};});
  return {students:students,scores:filtered};
}
function gtmcBoardingList_(p,token){
  var access=gtmcBoardingUser_(token,false),rows=sheetToObjects(getSheet('BoardingAssignments'));
  rows=rows.filter(function(x){return String(x.status)==='Boarder'&&!x.ended_at&&(!access.section||String(x.section)===access.section);});
  return {section:access.section||'All',students:rows};
}
function gtmcBoardingRecordExit_(p,token){
  var access=gtmcBoardingUser_(token,false),id=String(p.studentId||''),cls=String(p.className||''),student=gtmcBoardingStudent_(id,cls);
  var assignment=sheetToObjects(getSheet('BoardingAssignments')).filter(function(x){return String(x.student_id)===id&&String(x.status)==='Boarder'&&!x.ended_at;})[0];
  if(!assignment)throw new Error('This student is not currently registered as a boarder.');
  if(access.section&&String(assignment.section)!==access.section)throw new Error('You can only record exits for your assigned boarding section.');
  var reason=String(p.reason||'').trim(),destination=String(p.destination||'').trim(),expected=String(p.expectedReturn||'').trim();
  if(!reason)throw new Error('A reason for leaving is required.');
  if(!expected)throw new Error('Expected return date and time are required.');
  var now=new Date(),exitId='BEX-'+Utilities.getUuid().slice(0,12).toUpperCase();
  getSheet('BoardingExits').appendRow([exitId,id,student.name,cls,assignment.section,now,reason,destination,expected,String(p.authorisedBy||'').trim(),access.user.email,'','','Out',now]);
  var parents=sheetToObjects(getSheet('ParentLinks')).filter(function(x){return String(x.student_id)===id&&gtmcBoardingBool_(x.active);});
  var msg='Boarding sign-out notice\nStudent: '+student.name+' ('+id+')\nSection: '+assignment.section+'\nSign-out: '+now.toLocaleString()+'\nReason: '+reason+'\nDestination: '+(destination||'Not specified')+'\nExpected return: '+expected;
  parents.forEach(function(parent){gtmcBoardingNotify_(parent.parent_email,'Boarding sign-out: '+student.name,msg,exitId,access.user.email);});
  logAudit(access.user.email,'boardingStudentSignedOut',{studentId:id,exitId:exitId,parentNotifications:parents.length});
  return {success:true,exitId:exitId,parentNotifications:parents.length};
}
function gtmcBoardingRecordReturn_(p,token){
  var access=gtmcBoardingUser_(token,false),sh=getSheet('BoardingExits'),rows=sheetToObjects(sh),idx=rows.findIndex(function(x){return String(x.exit_id)===String(p.exitId)&&String(x.status)==='Out';});
  if(idx<0)throw new Error('An outstanding sign-out record was not found.');
  var row=rows[idx];
  if(access.section&&String(row.section)!==access.section)throw new Error('You can only update records for your assigned boarding section.');
  var now=new Date();sh.getRange(idx+2,12).setValue(now);sh.getRange(idx+2,13).setValue(access.user.email);sh.getRange(idx+2,14).setValue('Returned');
  var parents=sheetToObjects(getSheet('ParentLinks')).filter(function(x){return String(x.student_id)===String(row.student_id)&&gtmcBoardingBool_(x.active);});
  var msg='Boarding return notice\nStudent: '+row.student_name+' ('+row.student_id+')\nReturn recorded: '+now.toLocaleString();
  parents.forEach(function(parent){gtmcBoardingNotify_(parent.parent_email,'Boarding return: '+row.student_name,msg,row.exit_id,access.user.email);});
  logAudit(access.user.email,'boardingStudentReturned',{studentId:row.student_id,exitId:row.exit_id,parentNotifications:parents.length});
  return {success:true,parentNotifications:parents.length};
}
function gtmcBoardingNotify_(email,title,message,link,actor){
  email=String(email||'').trim().toLowerCase();if(!email)return;
  var sh=getSheet('Notifications'),id='NTF-'+Utilities.getUuid().slice(0,12).toUpperCase();
  sh.appendRow([id,email,'parent',title,message,'boarding','',new Date(),'','Boarding Management ('+actor+')']);
}
function gtmcBoardingHistory_(p,token){
  var access=gtmcBoardingUser_(token,false),rows=sheetToObjects(getSheet('BoardingExits'));
  return rows.filter(function(x){return !access.section||String(x.section)===access.section;}).sort(function(a,b){return new Date(b.created_at)-new Date(a.created_at);}).slice(0,300);
}
function gtmcBoardingDashboard_(p,token){
  var access=gtmcBoardingUser_(token,false),students=sheetToObjects(getSheet('BoardingAssignments')).filter(function(x){return String(x.status)==='Boarder'&&!x.ended_at&&(!access.section||String(x.section)===access.section);});
  var exits=sheetToObjects(getSheet('BoardingExits')).filter(function(x){return (!access.section||String(x.section)===access.section)&&String(x.status)==='Out';});
  return {section:access.section||'All Sections',boarders:students.length,boys:students.filter(function(x){return x.section==='Boys';}).length,girls:students.filter(function(x){return x.section==='Girls';}).length,currentlyOut:exits.length};
}
var __gtmcBoardingOriginalRoute_=route;
route=function(action,p){
  p=p||{};
  switch(action){
    case 'boardingList':return gtmcBoardingList_(p,p.token);
    case 'boardingPerformance':return gtmcBoardingPerformance_(p,p.token);
    case 'boardingStudentOptions':return gtmcBoardingStudentOptions_(p,p.token);
    case 'boardingAssign':return gtmcBoardingAssign_(p,p.token);
    case 'boardingEnd':return gtmcBoardingEnd_(p,p.token);
    case 'boardingRecordExit':return gtmcBoardingRecordExit_(p,p.token);
    case 'boardingRecordReturn':return gtmcBoardingRecordReturn_(p,p.token);
    case 'boardingHistory':return gtmcBoardingHistory_(p,p.token);
    case 'boardingDashboard':return gtmcBoardingDashboard_(p,p.token);
    default:return __gtmcBoardingOriginalRoute_(action,p);
  }
};
