/********************************************************************
 * GRADE SYSTEM — BACKEND (v14, non-destructive upgrade)
 *
 * v13 additions (all backward compatible):
 *   - Ranking engine: classBase_, armsOfClass_, rankClassTerm_, rankStudent_
 *   - parentGetResult now returns positionArm, positionClass, classSize, armSize
 *   - parentAskResultAI now sees test-level data + positions in its prompt
 *   - New action: parentGetTestBreakdown (single round-trip for all 3 terms)
 *
 * v14 additions: non-destructive schema extension, assessment-specific correction windows,
 * domain visibility settings (five active items per domain), access checks, parent enquiry
 * and notification foundations, and publication-filtered parent year summaries.
 * Existing score data and historical domain columns are retained.
 ********************************************************************/

const SHEET_ID = '1ijAtsR96Z3UzB9sa1c5vE9Ks6jBvaNiT1m6dH9zHX34';
const SESSION_SECONDS = 6 * 60 * 60;
const ADMIN_EMAILS = ['admin@school.com'];

/* ============ CLASS LIST ============ */
const CLASSES = [
  'JSS1A','JSS1B','JSS1C','JSS1D',
  'JSS2A','JSS2B','JSS2C','JSS2D',
  'JSS3A','JSS3B','JSS3C',
  'SS1A','SS1B','SS1C',
  'SS2A','SS2B','SS2C',
  'SS3'
];

/* ============================================================
   SUBJECT LISTS — ORDER IS PERMANENT.
   ============================================================ */
const JSS_SUBJECTS = [
  'English Language','Mathematics','Christian Religious Knowledge','Yoruba',
  'Intermediate Science','Digital Technology','Physical & Health Education',
  'History','French','Livestock',
  'Business Studies','CCA',
  'Citizenship','Garment'
];

const SS_SUBJECTS = [
  'English Language','Mathematics','Physics','Chemistry','Biology',
  'Further Mathematics','Economics','Government','Accounting','Commerce',
  'Literature-in-English','Marketing','Citizenship','Garment','History',
  'French','Christian Religious Knowledge','Yoruba','Geography','Digital Technology',
  'Agricultural Science','Livestock'
];

const TERMS  = ['Term1','Term2','Term3'];
const FIELDS = ['T1','T2','T3','Exam'];

function subjectsForClass(className) {
  if (!className || typeof className !== 'string') return [];
  if (className.indexOf('JSS') === 0) return JSS_SUBJECTS;
  if (className.indexOf('SS')  === 0) return SS_SUBJECTS;
  return [];
}

/* ============ ROLE HELPERS ============ */
function roleList_(user) {
  if (!user) return [];
  const r = String(user.role || '').trim();
  if (!r) return [];
  return r.split(',').map(function (s) { return s.trim(); }).filter(Boolean);
}
function hasRole_(user, want) {
  return roleList_(user).indexOf(want) !== -1;
}

/* ============ DOMAIN COLUMNS ============ */
const DOMAIN_FIELDS = ['Days Opened','Days Present','Affective','Psychomotor'];
const DOMAIN_KEYS   = ['days_opened','days_present','affective','psychomotor'];
const DOMAIN_LETTERS = ['A','B','C','D','E'];
const DOMAIN_COLS_PER_TERM = DOMAIN_FIELDS.length;

/* ============ AFFECTIVE + PSYCHOMOTOR ITEMS ============ */
const AFFECTIVE_ITEMS = [
  ['punctuality', 'Punctuality'],
  ['attendance', 'Attendance'],
  ['honesty', 'Honesty'],
  ['cooperation', 'Cooperation'],
  ['leadership', 'Leadership']
];

const PSYCHOMOTOR_ITEMS = [
  ['handwriting', 'Handwriting'],
  ['drawing', 'Drawing and painting'],
  ['handwork', 'Handwork / practical skills'],
  ['sports', 'Sports and physical activities'],
  ['coordination', 'Coordination and dexterity']
];

const DOMAIN_RATINGS = {
  5: 'Excellent', 4: 'Very Good', 3: 'Good', 2: 'Fair', 1: 'Needs Improvement'
};

/* ============ TAB SCHEMA ============ */
const META_SCHEMA = {
  Users:       { headers: ['email','name','role','class','subjects','password','active','class_teacher_class'],
                 seed: [['admin@school.com','Admin User','admin','','','admin123', true]] },
  Students:    { headers: ['student_id','name','class','active'] },
  Classes:     { headers: ['class','active'] },
  Subjects:    { headers: ['subject','level'] },
  Submissions: { headers: ['teacher_email','class','subject','term','status','timestamp','assessment','academic_year','submitted_by','unlocked_at','unlocked_by','unlock_reason','correction_deadline','resubmitted_at','resubmitted_by'] },
  Audit:       { headers: ['timestamp','email','action','details'] },
  AI_Comments: { headers: [
    'Comment ID','Student ID','Student Name','Class','Academic Year',
    'Annual Average','Academic Summary','Strengths','Areas to Improve',
    'Recommended Actions','Approval Status','Generated At','Approved By','Approved At'
  ] },
  ParentAccounts: { headers: ['email','name','password','active','created_at','created_by'] },
  ParentLinks: { headers: ['parent_email','student_id','class','relationship','active','created_at','created_by'] },
  ReportTemplate: { headers: ['key','value','updated_at','updated_by'] },
  ResultPublication: { headers: ['student_id','class','term','academic_year','published','published_at','published_by'] },
  AssessmentPublication: { headers: ['class','term','academic_year','assessment','published','published_at','published_by'] },
  PrincipalRemarks: { headers: ['student_id','class','term','academic_year','remark','updated_at','updated_by'] },
  Affective:    { headers: ['student_id','class','term','academic_year',
                            'punctuality','attendance','honesty','cooperation',
                            'leadership','club_participation','obedience',
                            'neatness','responsibility','self_control',
                            'updated_at','updated_by'] },
  Psychomotor:  { headers: ['student_id','class','term','academic_year',
                            'handwriting','drawing','handwork',
                            'sports','coordination','tools',
                            'updated_at','updated_by'] },
  SchoolCalendar: { headers: ['academic_year','term','next_term_begins','school_vacates','days_school_opened','updated_at','updated_by'] },
  TeacherRemarks: { headers: ['student_id','class','term','academic_year','remark','updated_at','updated_by'] },
  Debtors:        { headers: ['student_id','class','academic_year','term','amount','note','updated_at','updated_by'] },
  Announcements:  { headers: ['id','message','target_classes','audience','active','expires_at','created_at','created_by'] },
  StaffMessages:  { headers: ['id','from_email','from_name','subject','message','related_date','status','created_at','reply','replied_at','replied_by'] },
  DomainSettings: { headers: ['key','value','updated_at','updated_by'] },
  ParentEnquiries: { headers: ['id','parent_email','parent_name','student_id','class','category','subject','message','status','assigned_to','created_at','reply','replied_at','replied_by','updated_at'] },
  Notifications: { headers: ['id','recipient_email','audience','title','message','type','link','created_at','read_at','created_by'] },
  SystemBackups: { headers: ['id','name','file_id','file_url','academic_year','created_at','created_by','status','notes'] },
  AcademicArchive: { headers: ['id','academic_year','backup_id','created_at','created_by','notes'] },
  FeeStructures: { headers: ['class','academic_year','term','category','amount','compulsory','active','updated_at','updated_by'] },
  StudentCharges: { headers: ['charge_id','student_id','student_name','class','academic_year','term','category','amount','note','active','created_at','created_by'] },
  FeePayments: { headers: ['payment_id','receipt_no','student_id','student_name','class','academic_year','term','amount','allocated_category','payment_method','reference','note','status','recorded_at','recorded_by','reversed_at','reversed_by','reversal_reason'] },
  FeeReceipts: { headers: ['receipt_no','payment_id','student_id','student_name','class','academic_year','term','amount','allocated_category','payment_method','reference','issued_at','issued_by','status'] },
  FinancialSettings: { headers: ['key','value','updated_at','updated_by'] },
  PaymentNotifications: { headers: ['id','parent_email','parent_name','student_id','student_name','class','academic_year','term','fee_category','payment_date','payment_time','amount','sender_name','reference','note','status','reply','replied_by','replied_at','created_at','updated_at','ledger_payment_id'] },
  LibraryResources: { headers: ['id','title','author','subject','class','category','url','description','active','created_at','created_by','updated_at','updated_by'] }
};

/* ============ ROUTER ============ */
function doPost(e) { return handle(e); }

function handle(e) {
  try {
    let p = {};
    if (e && e.postData && e.postData.contents) p = JSON.parse(e.postData.contents);
    else if (e && e.parameter) p = e.parameter;

    if (!p.action) throw new Error('Missing action');
    const data = route(p.action, p);
    return out({ success: true, data: data });
  } catch (err) {
    return out({ success: false, error: err.message });
  }
}

function route(action, p) {
  if (p && p.token) {
    const sessionUser = verifyToken(p.token);
    if (hasRole_(sessionUser, 'parent') && [
      'me','parentGetWards','parentGetResult','parentAskResultAI','parentGetDebts',
      'parentGetAnnouncements','parentGetTestBreakdown','getDomainSettings',
      'parentSubmitEnquiry','parentGetEnquiries','parentGetFeeStatement','parentSubmitPaymentNotification','parentGetPaymentNotifications','libraryList','getFeatureFlags','getMyNotifications','markNotificationRead'
    ].indexOf(action) === -1) {
      throw new Error('Permission denied for parent account.');
    }
    const isLeadershipAccount = roleList_(sessionUser).some(function(r) { return ['principal','vice_principal','vice_principal_admin','vice_principal_academic'].indexOf(r) !== -1; });
    const isBursarAccount = hasRole_(sessionUser, 'bursar');
    if (!hasRole_(sessionUser, 'admin') && isLeadershipAccount && isBursarAccount &&
        ['me','leadershipGetDashboard','getClasses','getStudents','libraryList','getFeatureFlags','staffGetPaymentNotifications','staffReplyPaymentNotification','adminSaveFeeStructure','adminGetFeeStructures','adminAssignStudentCharge','adminCancelStudentCharge','adminGetStudentFeeStatement','adminRecordFeePayment','adminReverseFeePayment','adminGetFeeOverview','adminGetFeeReceipt','getMyNotifications','markNotificationRead'].indexOf(action) === -1) {
      throw new Error('Combined Principal/Bursar accounts are limited to leadership summaries and financial functions.');
    }
    if (!hasRole_(sessionUser, 'admin') && isLeadershipAccount && !isBursarAccount &&
        ['me','leadershipGetDashboard','getMyNotifications','markNotificationRead'].indexOf(action) === -1) {
      throw new Error('Leadership accounts are restricted to aggregate academic summaries and notifications.');
    }
    if (!hasRole_(sessionUser, 'admin') && isBursarAccount && !isLeadershipAccount &&
        ['me','getClasses','getStudents','libraryList','getFeatureFlags','staffGetPaymentNotifications','staffReplyPaymentNotification','adminSaveFeeStructure','adminGetFeeStructures','adminAssignStudentCharge','adminCancelStudentCharge','adminGetStudentFeeStatement','adminRecordFeePayment','adminReverseFeePayment','adminGetFeeOverview','adminGetFeeReceipt','getMyNotifications','markNotificationRead'].indexOf(action) === -1) {
      throw new Error('Bursar accounts are restricted to student directory and financial functions.');
    }
    if (!hasRole_(sessionUser, 'admin') && hasRole_(sessionUser, 'registrar') &&
        ['me','getClasses','getStudents','addStudent','addStudentsBulk','deleteStudent','findStudentMatches','copyStudentFromClass','getMyNotifications','markNotificationRead'].indexOf(action) === -1) {
      throw new Error('Registrar accounts are restricted to student admission, registration and directory functions.');
    }
  }
  switch (action) {
    case 'login':               return login(p.email, p.password);
    case 'me':                  return verifyToken(p.token);
    case 'getClasses':          return getClasses(p.token);
    case 'getSubjectsForClass': return subjectsForClass(p.className);
    case 'getStudents':         return getStudents(p.className, p.token);
    case 'addStudent':          return addStudent(p, p.token);
    case 'addStudentsBulk':     return addStudentsBulk(p, p.token);
    case 'deleteStudent':       return deleteStudent(p.student_id, p.token);
    case 'getScores':           return getScores(p, p.token);
    case 'saveScore':           return saveScore(p, p.token);
    case 'getStudentScores':    return getStudentScores(p, p.token);
    case 'submitScores':        return submitScores(p, p.token);
    case 'unlockScores':        return unlockScores(p, p.token);
    case 'getSubmissions':      return getSubmissions(p, p.token);
    case 'getDomainSettings':   return getDomainSettings(p, p.token);
    case 'adminGetDomainSettings': return adminGetDomainSettings(p, p.token);
    case 'adminSaveDomainSettings': return adminSaveDomainSettings(p, p.token);
    case 'adminGetDashboard':   return adminGetDashboard(p, p.token);
    case 'parentSubmitEnquiry': return parentSubmitEnquiry(p, p.token);
    case 'parentGetEnquiries':  return parentGetEnquiries(p, p.token);
    case 'adminGetParentEnquiries': return adminGetParentEnquiries(p, p.token);
    case 'adminReplyParentEnquiry': return adminReplyParentEnquiry(p, p.token);
    case 'getMyNotifications':  return getMyNotifications(p, p.token);
    case 'markNotificationRead': return markNotificationRead(p, p.token);
    case 'adminCreateBackup':   return adminCreateBackup(p, p.token);
    case 'adminListBackups':    return adminListBackups(p, p.token);
    case 'adminListAcademicArchives': return adminListAcademicArchives(p, p.token);
    case 'adminGetAuditLogs':   return adminGetAuditLogs(p, p.token);
    case 'adminCreateAcademicArchive': return adminCreateAcademicArchive(p, p.token);
    case 'adminCreateRecoveryCopy': return adminCreateRecoveryCopy(p, p.token);
    case 'getTeachers':         return getTeachers(p.token);
    case 'createTeacher':       return createTeacher(p, p.token);
    case 'deleteTeacher':       return deleteTeacher(p.email, p.token);
    case 'adminListUsers':      return adminListUsers(p, p.token);
    case 'adminCreateUser':     return adminCreateUser(p, p.token);
    case 'adminUpdateUser':     return adminUpdateUser(p, p.token);
    case 'adminSetUserActive':  return adminSetUserActive(p, p.token);
    case 'adminSetUserStatus': return adminSetUserActive(p,p.token);
    case 'getFeatureFlags': return gtmcGetFeatureFlags_(p,p.token);
    case 'adminSaveFeatureFlags': return gtmcSaveFeatureFlags_(p,p.token);
    case 'libraryList': return libraryList_(p,p.token);
    case 'librarySave': return librarySave_(p,p.token);
    case 'libraryDelete': return libraryDelete_(p,p.token);
    case 'parentSubmitPaymentNotification': return parentSubmitPaymentNotification_(p,p.token);
    case 'parentGetPaymentNotifications': return parentGetPaymentNotifications_(p,p.token);
    case 'staffGetPaymentNotifications': return staffGetPaymentNotifications_(p,p.token);
    case 'staffReplyPaymentNotification': return staffReplyPaymentNotification_(p,p.token);
    case 'adminResetUserPassword': return adminResetUserPassword(p, p.token);
    case 'adminUpdateTeacherClass': return adminUpdateTeacherClass(p, p.token);
    case 'exportAll':           return exportAll(p.token);
    case 'importBulk':          return importBulk(p.rows, p.token);

    case 'generateAnnualAIComments': return generateAnnualAIComments(p, p.token);
    case 'getAICommentDrafts':      return getAICommentDrafts(p, p.token);
    case 'approveAIComment':        return approveAIComment(p, p.token);

    case 'parentLogin':             return parentLogin(p.email, p.password);
    case 'adminCreateParent':       return adminCreateParent(p, p.token);
    case 'adminGetParentAccounts':  return adminGetParentAccounts(p, p.token);
    case 'adminLinkWard':           return adminLinkWard(p, p.token);
    case 'adminUnlinkWard':         return adminUnlinkWard(p, p.token);
    case 'parentGetWards':          return parentGetWards(p.token);
    case 'parentGetResult':         return parentGetResult(p, p.token);
    case 'parentAskResultAI':       return parentAskResultAI(p, p.token);
    case 'parentGetDebts':          return parentGetDebts(p, p.token);
    case 'parentGetAnnouncements':  return parentGetAnnouncements(p, p.token);
    case 'parentGetTestBreakdown':  return parentGetTestBreakdown(p, p.token);
    case 'adminSetAssessmentPublication': return adminSetAssessmentPublication(p, p.token);
    case 'adminGetAssessmentPublication': return adminGetAssessmentPublication(p, p.token);

    case 'adminGetReportTemplate':  return adminGetReportTemplate(p.token);
    case 'adminSaveReportTemplate': return adminSaveReportTemplate(p, p.token);

    case 'adminPublishResult':      return adminPublishResult(p, p.token);
    case 'adminUnpublishResult':    return adminUnpublishResult(p, p.token);
    case 'adminGetPublicationStatus': return adminGetPublicationStatus(p, p.token);

    case 'getDomains':              return getDomains(p, p.token);
    case 'saveDomainScore':         return saveDomainScore(p, p.token);
    case 'submitDomains':           return submitDomains(p, p.token);
    case 'unlockDomains':           return unlockDomains(p, p.token);

    case 'adminPublishClass':       return adminPublishClass(p, p.token);
    case 'adminUnpublishClass':     return adminUnpublishClass(p, p.token);

    case 'adminPreviewPrincipalRemark':            return adminPreviewPrincipalRemark(p, p.token);
    case 'adminSetPrincipalRemark':                return adminSetPrincipalRemark(p, p.token);
    case 'adminGeneratePrincipalRemarksForClass':  return adminGeneratePrincipalRemarksForClass(p, p.token);

    case 'getDomainAssessments':    return getDomainAssessments(p, p.token);
    case 'saveDomainAssessment':    return saveDomainAssessment(p, p.token);

    case 'adminGetSchoolCalendar':  return adminGetSchoolCalendar(p, p.token);
    case 'adminSaveSchoolCalendar': return adminSaveSchoolCalendar(p, p.token);
    case 'adminGetTeacherRemarks':  return adminGetTeacherRemarks(p, p.token);
    case 'adminSaveTeacherRemark':  return adminSaveTeacherRemark(p, p.token);

    case 'adminGetDebts':           return adminGetDebts(p, p.token);
    case 'adminSaveDebt':           return adminSaveDebt(p, p.token);
    case 'adminGetAnnouncements':   return adminGetAnnouncements(p, p.token);
    case 'getTeacherAnnouncements': return getTeacherAnnouncements(p, p.token);
    case 'adminSaveAnnouncement':   return adminSaveAnnouncement(p, p.token);
    case 'adminDeleteAnnouncement': return adminDeleteAnnouncement(p, p.token);

    case 'findStudentMatches':      return findStudentMatches(p, p.token);
    case 'copyStudentFromClass':    return copyStudentFromClass(p, p.token);

    case 'checkNewStudent':          return checkNewStudent(p, p.token);
    case 'getClassScores':           return getClassScores(p, p.token);
    case 'adminAskPerformanceAI':    return adminAskPerformanceAI(p, p.token);
    case 'getClassDomains':          return getClassDomains(p, p.token);
    case 'getClassTeacherRemarks':   return getClassTeacherRemarks(p, p.token);

    case 'staffSendMessage':         return staffSendMessage(p, p.token);
    case 'adminGetStaffMessages':    return adminGetStaffMessages(p, p.token);
    case 'adminReplyStaffMessage':   return adminReplyStaffMessage(p, p.token);

    case 'adminCreateRoleAccount': return adminCreateRoleAccount(p, p.token);
    case 'leadershipGetDashboard': return leadershipGetDashboard(p, p.token);
    case 'adminSaveFeeStructure': return adminSaveFeeStructure(p, p.token);
    case 'adminGetFeeStructures': return adminGetFeeStructures(p, p.token);
    case 'adminAssignStudentCharge': return adminAssignStudentCharge(p, p.token);
    case 'adminCancelStudentCharge': return adminCancelStudentCharge(p, p.token);
    case 'adminGetStudentFeeStatement': return adminGetStudentFeeStatement(p, p.token);
    case 'adminRecordFeePayment': return adminRecordFeePayment(p, p.token);
    case 'adminReverseFeePayment': return adminReverseFeePayment(p, p.token);
    case 'adminGetFeeOverview': return adminGetFeeOverview(p, p.token);
    case 'adminGetFeeReceipt': return adminGetFeeReceipt(p, p.token);
    case 'parentGetFeeStatement': return parentGetFeeStatement(p, p.token);

    default: throw new Error('Unknown action: ' + action);
  }
}

function out(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}


const GTMC_FEATURE_DEFAULTS_={dashboard:true,teachers:true,parents:true,submissions:true,publish:true,broadsheet:true,performance:true,domains:true,remarks:true,teacherRemarks:true,calendar:true,announcements:true,debtors:true,staffPayments:true,parentPayments:true,reportcards:true,template:true,students:true,scores:true,entry:true,history:true,results:true,report:true,testPerformance:true,chat:true,library:true,myAttendance:true,attendanceSummary:true,staffAttendance:true,staffLinks:true,messageAdmin:true,staffMessages:true,userManagement:true};
function gtmcGetFeatureFlags_(p,t){requireRole(t,['admin','principal','vice_principal','vice_principal_admin','vice_principal_academic','bursar','registrar','class_teacher','subject_teacher','student','parent']);let saved={};try{saved=JSON.parse(PropertiesService.getScriptProperties().getProperty('GTMC_FEATURE_FLAGS')||'{}')||{};}catch(e){}const out={};Object.keys(GTMC_FEATURE_DEFAULTS_).forEach(k=>out[k]=Object.prototype.hasOwnProperty.call(saved,k)?saved[k]!==false:true);return out;}
function gtmcSaveFeatureFlags_(p,t){const u=requireRole(t,['admin']),v=p.features||{},old=gtmcGetFeatureFlags_({},t),next={};Object.keys(GTMC_FEATURE_DEFAULTS_).forEach(k=>next[k]=Object.prototype.hasOwnProperty.call(v,k)?v[k]===true:old[k]);PropertiesService.getScriptProperties().setProperty('GTMC_FEATURE_FLAGS',JSON.stringify(next));logAudit(u.email,'adminSaveFeatureFlags',next);return next;}
function libraryList_(p,t){gtmcEnsureModuleSheets_();requireRole(t,['admin','principal','vice_principal','vice_principal_admin','vice_principal_academic','bursar','registrar','class_teacher','subject_teacher','student','parent']);return sheetToObjects(getSheet('LibraryResources')).filter(r=>r.active===''||r.active===undefined||r.active===true||String(r.active).toLowerCase()==='true').map(r=>({id:String(r.id||''),title:String(r.title||''),author:String(r.author||''),subject:String(r.subject||''),class:String(r.class||'ALL'),category:String(r.category||'Other'),url:String(r.url||''),description:String(r.description||'')}));}
function librarySave_(p,t){gtmcEnsureModuleSheets_();const u=requireRole(t,['admin']),title=String(p.title||'').trim(),url=String(p.url||'').trim();if(!title||!/^https?:\/\//i.test(url))throw new Error('Enter a title and valid URL.');const sh=getSheet('LibraryResources'),rows=sheetToObjects(sh),id=String(p.id||'').trim()||Utilities.getUuid(),now=new Date(),v=[id,title,String(p.author||''),String(p.subject||''),String(p.className||'ALL'),String(p.category||'Other'),url,String(p.description||''),true,now,u.email,now,u.email],at=rows.findIndex(r=>String(r.id)===id);if(at>=0)sh.getRange(at+2,1,1,v.length).setValues([v]);else sh.appendRow(v);logAudit(u.email,'librarySave',{id:id});return {success:true,id:id};}
function libraryDelete_(p,t){gtmcEnsureModuleSheets_();const u=requireRole(t,['admin']),id=String(p.id||''),sh=getSheet('LibraryResources'),d=sh.getDataRange().getValues(),h=d[0].map(String),ii=h.indexOf('id'),ai=h.indexOf('active');for(let i=1;i<d.length;i++)if(String(d[i][ii])===id){sh.getRange(i+1,ai+1).setValue(false);logAudit(u.email,'libraryDelete',{id:id});return {success:true};}throw new Error('Library resource not found.');}
function paymentNotificationRows_(){gtmcEnsureModuleSheets_();return sheetToObjects(getSheet('PaymentNotifications'));}
function paymentNotificationView_(r){return {id:String(r.id||''),studentId:String(r.student_id||''),studentName:String(r.student_name||''),className:String(r.class||''),academicYear:String(r.academic_year||''),term:String(r.term||''),feeCategory:String(r.fee_category||''),paymentDate:String(r.payment_date||''),paymentTime:String(r.payment_time||''),amount:Number(r.amount||0),senderName:String(r.sender_name||''),reference:String(r.reference||''),note:String(r.note||''),status:String(r.status||'Pending Verification'),reply:String(r.reply||''),repliedBy:String(r.replied_by||''),repliedAt:r.replied_at||'',createdAt:r.created_at||''};}
function paymentNotificationFind_(id){gtmcEnsureModuleSheets_();const sh=getSheet('PaymentNotifications'),d=sh.getDataRange().getValues(),h=d[0].map(String),ix=h.indexOf('id');for(let i=1;i<d.length;i++)if(String(d[i][ix])===String(id))return {sheet:sh,row:i+1,headers:h,values:d[i]};return null;}
function parentSubmitPaymentNotification_(p,t){gtmcEnsureModuleSheets_();const u=requireRole(t,['parent']),sid=String(p.studentId||''),cn=String(p.className||''),yr=String(p.academicYear||''),term=String(p.term||'');if(!sid||!cn||!yr||TERMS.indexOf(term)<0)throw new Error('Student, class, academic year and term are required.');portalAssertLinkedParent_(u,cn,sid);const st=gtmcStudent_(sid,cn),cat=String(p.feeCategory||''),date=String(p.paymentDate||''),time=String(p.paymentTime||''),sender=String(p.senderName||'').trim(),amount=Number(p.amount);if(gtmcCategories_().indexOf(cat)<0||!/^\d{4}-\d{2}-\d{2}$/.test(date)||!/^\d{2}:\d{2}$/.test(time)||!sender||!isFinite(amount)||amount<=0)throw new Error('Enter valid category, date, time, amount and sender.');const ref=String(p.reference||'').trim(),note=String(p.note||'').trim().slice(0,500),sh=getSheet('PaymentNotifications'),lock=LockService.getScriptLock();lock.waitLock(10000);try{if(ref&&paymentNotificationRows_().some(r=>String(r.reference||'').toLowerCase()===ref.toLowerCase()))throw new Error('This payment reference was already submitted.');const id='PAYN'+Date.now()+Utilities.getUuid().slice(0,6),now=new Date();sh.appendRow([id,u.email,u.name||'',sid,st.name,cn,yr,term,cat,date,time,amount,sender,ref,note,'Pending Verification','','','',now,now,'']);logAudit(u.email,'parentSubmitPaymentNotification',{id:id,amount:amount});return {id:id,status:'Pending Verification'};}finally{lock.releaseLock();}}
function parentGetPaymentNotifications_(p,t){const u=requireRole(t,['parent']),sid=String(p.studentId||''),cn=String(p.className||'');portalAssertLinkedParent_(u,cn,sid);return paymentNotificationRows_().filter(r=>String(r.parent_email).toLowerCase()===String(u.email).toLowerCase()&&String(r.student_id)===sid&&String(r.class)===cn).sort((a,b)=>new Date(b.created_at||0)-new Date(a.created_at||0)).map(paymentNotificationView_);}
function staffGetPaymentNotifications_(p,t){requireRole(t,['admin','bursar']);let rows=paymentNotificationRows_();if(p.status)rows=rows.filter(r=>String(r.status)===String(p.status));if(p.className)rows=rows.filter(r=>String(r.class)===String(p.className));return rows.sort((a,b)=>(a.status==='Pending Verification'?-1:1)-(b.status==='Pending Verification'?-1:1)||new Date(b.created_at||0)-new Date(a.created_at||0)).map(r=>Object.assign(paymentNotificationView_(r),{parentName:String(r.parent_name||''),parentEmail:String(r.parent_email||'')}));}
function staffReplyPaymentNotification_(p,t){const u=requireRole(t,['admin','bursar']),id=String(p.id||''),status=String(p.status||''),reply=String(p.reply||'').trim();if(!id||!reply||['Confirmed / Cleared','Rejected / Not Found','More Information Required'].indexOf(status)<0)throw new Error('Payment, status and reply are required.');const lock=LockService.getScriptLock();lock.waitLock(10000);try{const f=paymentNotificationFind_(id);if(!f)throw new Error('Payment notification not found.');const x={};f.headers.forEach((h,i)=>x[h]=i);if(String(f.values[x.status])==='Confirmed / Cleared')throw new Error('Payment already cleared.');let pid=String(f.values[x.ledger_payment_id]||'');if(status==='Confirmed / Cleared'&&!pid){const r=adminRecordFeePayment({studentId:f.values[x.student_id],className:f.values[x.class],academicYear:f.values[x.academic_year],term:f.values[x.term],category:f.values[x.fee_category],amount:f.values[x.amount],paymentMethod:'Bank Transfer',reference:f.values[x.reference],note:'Parent payment notification '+id},t);pid=r.paymentId;f.sheet.getRange(f.row,x.ledger_payment_id+1).setValue(pid);}const now=new Date();[['status',status],['reply',reply],['replied_by',u.name||u.email],['replied_at',now],['updated_at',now]].forEach(a=>f.sheet.getRange(f.row,x[a[0]]+1).setValue(a[1]));logAudit(u.email,'staffReplyPaymentNotification',{id:id,status:status,ledgerPaymentId:pid});return {success:true,id:id,status:status,ledgerPaymentId:pid};}finally{lock.releaseLock();}}

function gtmcPasswordHash_(password,salt){salt=salt||Utilities.getUuid();return 'sha256$'+salt+'$'+Utilities.base64Encode(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,String(salt)+'|'+String(password),Utilities.Charset.UTF_8));}
function gtmcPasswordMatches_(password,stored){const s=String(stored==null?'':stored);if(s.indexOf('sha256$')===0){const p=s.split('$');return p.length===3&&gtmcPasswordHash_(password,p[1])===s;}return s===String(password);}
function gtmcStorePassword_(sheetName,keyName,keyValue,passwordName,password){const sh=getSheet(sheetName),d=sh.getDataRange().getValues(),h=d[0].map(x=>String(x).toLowerCase()),ki=h.indexOf(keyName),pi=h.indexOf(passwordName);if(ki<0||pi<0)throw new Error('Password columns are missing.');for(let i=1;i<d.length;i++)if(String(d[i][ki]).toLowerCase()===String(keyValue).toLowerCase()){sh.getRange(i+1,pi+1).setValue(gtmcPasswordHash_(password));return true;}return false;}
/* ============ SHEET HELPERS ============ */
function openSS() { return SpreadsheetApp.openById(SHEET_ID); }

function getSheet(name) {
  if (!name) throw new Error('Sheet name required');
  const s = openSS().getSheetByName(name);
  if (!s) throw new Error('Missing tab: ' + name + ' — run setupSheets()');
  return s;
}

function sheetToObjects(sheet) {
  const data = sheet.getDataRange().getValues();
  if (data.length < 2) return [];
  const h = data[0];
  return data.slice(1).map(function (r) {
    const o = {};
    h.forEach(function (k, i) { o[k] = r[i]; });
    return o;
  });
}

function logAudit(email, action, details) {
  try {
    getSheet('Audit').appendRow([new Date(), email || 'anon', action, JSON.stringify(details || {})]);
  } catch (e) {}
}

/* ============ SETUP ============ */
function setupSheets() {
  verifySubjectOrderFingerprint_();
  const ss = openSS();
  const createdTabs = [];
  const repairedTabs = [];

  Object.keys(META_SCHEMA).forEach(function (name) {
    let sheet = ss.getSheetByName(name);
    if (!sheet) { sheet = ss.insertSheet(name); createdTabs.push(name); }
    ensureHeaders(sheet, META_SCHEMA[name].headers, repairedTabs, name);

    if (name === 'Users' && sheet.getLastRow() < 2) {
      sheet.getRange(2, 1, META_SCHEMA.Users.seed.length, META_SCHEMA.Users.seed[0].length)
        .setValues(META_SCHEMA.Users.seed);
    }
    if (name === 'DomainSettings' && sheet.getLastRow() < 2) {
      sheet.getRange(2, 1, 2, 4).setValues([
        ['affective_visible', 'true', new Date(), 'system'],
        ['psychomotor_visible', 'true', new Date(), 'system']
      ]);
    }
  });

  const classesSheet = ss.getSheetByName('Classes');
  if (classesSheet.getLastRow() < 2) {
    const rows = CLASSES.map(function (c) { return [c, true]; });
    classesSheet.getRange(2, 1, rows.length, 2).setValues(rows);
  }

  const subjSheet = ss.getSheetByName('Subjects');
  if (subjSheet.getLastRow() < 2) {
    const jss = JSS_SUBJECTS.map(function (s) { return [s, 'JSS']; });
    const ssRows = SS_SUBJECTS.map(function (s) { return [s, 'SS']; });
    subjSheet.getRange(2, 1, jss.length + ssRows.length, 2).setValues(jss.concat(ssRows));
  }

  CLASSES.forEach(function (cn) {
    let sheet = ss.getSheetByName(cn);
    if (!sheet) { sheet = ss.insertSheet(cn); createdTabs.push(cn); }
    buildClassTab(sheet, cn);
  });

  setupParentPortalSheets_();

  const defaultSheet = ss.getSheetByName('Sheet1');
  if (defaultSheet && defaultSheet.getLastRow() === 0 && ss.getSheets().length > 1) {
    ss.deleteSheet(defaultSheet);
  }

  const msg = [
    'Setup complete (non-destructive schema extension; existing score rows were not cleared).',
    'Created tabs: ' + (createdTabs.length ? createdTabs.join(', ') : '(none new)'),
    'Repaired: '     + (repairedTabs.length ? repairedTabs.join(', ') : '(none)'),
    'Class tabs: ' + CLASSES.length,
    '',
    'Default admin:',
    '  admin@school.com / admin123'
  ].join('\n');
  Logger.log(msg);
  try { SpreadsheetApp.getUi().alert(msg); } catch (e) {}
  return msg;
}

function ensureHeaders(sheet, headers, repairedList, name) {
  // Non-destructive schema handling: never rewrite or reorder an existing header row.
  // Missing fields are appended to the right, preserving positional legacy columns and data.
  const lastRow = sheet.getLastRow();
  const lastCol = Math.max(sheet.getLastColumn(), 1);
  if (lastRow === 0 || (lastRow === 1 && sheet.getLastColumn() === 1 && sheet.getRange(1, 1).getValue() === '')) {
    if (sheet.getMaxColumns() < headers.length) {
      sheet.insertColumnsAfter(sheet.getMaxColumns(), headers.length - sheet.getMaxColumns());
    }
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.setFrozenRows(1);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');
    if (repairedList) repairedList.push(name);
    return;
  }
  const existing = sheet.getRange(1, 1, 1, lastCol).getValues()[0].map(function (v) { return String(v || '').trim(); });
  const present = {};
  existing.forEach(function (h) { if (h) present[h] = true; });
  const missing = headers.filter(function (h) { return !present[h]; });
  if (missing.length) {
    const startCol = sheet.getLastColumn() + 1;
    if (sheet.getMaxColumns() < startCol + missing.length - 1) {
      sheet.insertColumnsAfter(sheet.getMaxColumns(), startCol + missing.length - 1 - sheet.getMaxColumns());
    }
    sheet.getRange(1, startCol, 1, missing.length).setValues([missing]);
    sheet.getRange(1, startCol, 1, missing.length).setFontWeight('bold');
    if (repairedList) repairedList.push(name + ' (appended ' + missing.join(', ') + ')');
  }
  sheet.setFrozenRows(1);
}

/* ============ DOMAIN VISIBILITY SETTINGS ============ */
function domainSettingsMap_() {
  const ss = openSS();
  const sh = ss.getSheetByName('DomainSettings');
  const out = { affective_visible: true, psychomotor_visible: true };
  if (!sh || sh.getLastRow() < 2) return out;
  sheetToObjects(sh).forEach(function (r) {
    const k = String(r.key || '').trim();
    if (k === 'affective_visible' || k === 'psychomotor_visible') {
      out[k] = String(r.value).toLowerCase() !== 'false';
    }
  });
  return out;
}
function domainVisible_(kind) {
  const s = domainSettingsMap_();
  return kind === 'affective' ? s.affective_visible : kind === 'psychomotor' ? s.psychomotor_visible : true;
}
function getDomainSettings(p, token) {
  const user = verifyToken(token);
  const s = domainSettingsMap_();
  return {
    affectiveVisible: s.affective_visible,
    psychomotorVisible: s.psychomotor_visible,
    affectiveItems: AFFECTIVE_ITEMS.map(function (x) { return { key: x[0], label: x[1] }; }),
    psychomotorItems: PSYCHOMOTOR_ITEMS.map(function (x) { return { key: x[0], label: x[1] }; }),
    role: roleList_(user)
  };
}
function adminGetDomainSettings(p, token) {
  requireRole(token, ['admin']);
  return getDomainSettings(p, token);
}
function adminSaveDomainSettings(p, token) {
  const admin = requireRole(token, ['admin']);
  const sh = getSheet('DomainSettings');
  const data = sh.getDataRange().getValues();
  const headers = (data[0] || []).map(function (v) { return String(v); });
  const ix = {}; headers.forEach(function (h, i) { ix[h] = i; });
  ['key','value','updated_at','updated_by'].forEach(function (h) {
    if (ix[h] === undefined) throw new Error('DomainSettings is missing required column: ' + h + '. Run setupSheets() first.');
  });
  const updates = [];
  if (p.affectiveVisible !== undefined) updates.push(['affective_visible', p.affectiveVisible === true || String(p.affectiveVisible).toLowerCase() === 'true']);
  if (p.psychomotorVisible !== undefined) updates.push(['psychomotor_visible', p.psychomotorVisible === true || String(p.psychomotorVisible).toLowerCase() === 'true']);
  if (!updates.length) throw new Error('Provide affectiveVisible and/or psychomotorVisible.');
  const lock = LockService.getScriptLock(); lock.waitLock(10000);
  try {
    updates.forEach(function (pair) {
      let rowNum = -1;
      for (let i = 1; i < data.length; i++) if (String(data[i][ix.key]) === pair[0]) { rowNum = i + 1; break; }
      const values = {};
      values[ix.key] = pair[0]; values[ix.value] = pair[1] ? 'true' : 'false';
      values[ix.updated_at] = new Date(); values[ix.updated_by] = admin.email;
      if (rowNum < 0) {
        const row = new Array(headers.length).fill('');
        Object.keys(values).forEach(function (k) { row[Number(k)] = values[k]; });
        sh.appendRow(row);
      } else {
        Object.keys(values).forEach(function (k) { sh.getRange(rowNum, Number(k) + 1).setValue(values[k]); });
      }
    });
  } finally { lock.releaseLock(); }
  logAudit(admin.email, 'adminSaveDomainSettings', { updates: updates });
  return getDomainSettings(p, token);
}

/* ------------------------------------------------------------
   buildClassTab — batched (fast, no timeout).
   ------------------------------------------------------------ */
function buildClassTab(sheet, className) {
  const subjects = subjectsForClass(className);
  if (!subjects.length) throw new Error('No subjects for class: ' + className);

  const scoreCells = TERMS.length * subjects.length * FIELDS.length;
  const totalCols  = 2 + scoreCells + TERMS.length * DOMAIN_COLS_PER_TERM;

  if (sheet.getMaxColumns() < totalCols) {
    sheet.insertColumnsAfter(sheet.getMaxColumns(), totalCols - sheet.getMaxColumns());
  }

  if (sheet.getMaxRows() < 3) {
    sheet.insertRowsAfter(sheet.getMaxRows(), 3 - sheet.getMaxRows());
  }

  const row1 = new Array(totalCols).fill('');
  const row2 = new Array(totalCols).fill('');
  const row3 = new Array(totalCols).fill('');

  row1[0] = 'ID';   row2[0] = '';   row3[0] = '';
  row1[1] = 'Name'; row2[1] = '';   row3[1] = '';

  TERMS.forEach(function (term, tIdx) {
    const termStart = 2 + tIdx * subjects.length * FIELDS.length;
    row1[termStart] = term;

    subjects.forEach(function (subj, sIdx) {
      const subStart = termStart + sIdx * FIELDS.length;
      row2[subStart] = subj;
      FIELDS.forEach(function (f, fIdx) {
        row3[subStart + fIdx] = f;
      });
    });
  });

  TERMS.forEach(function (term, tIdx) {
    const domStart = 2 + scoreCells + tIdx * DOMAIN_COLS_PER_TERM;
    row1[domStart] = term + ' Domains';
    DOMAIN_FIELDS.forEach(function (label, i) {
      row2[domStart + i] = label;
      row3[domStart + i] = (i >= 2) ? 'A-E' : '0+';
    });
  });

  sheet.getRange(1, 1, 3, totalCols).setValues([row1, row2, row3]);

  sheet.setFrozenRows(3);
  sheet.setFrozenColumns(2);

  sheet.getRange(1, 1, 3, totalCols)
    .setBackground('#ffffff')
    .setFontColor('#000000')
    .setFontWeight('normal')
    .setHorizontalAlignment('center')
    .setVerticalAlignment('middle');

  sheet.getRange(1, 1, 3, 2)
    .setBackground('#2c3e50')
    .setFontColor('#ffffff')
    .setFontWeight('bold');

  TERMS.forEach(function (term, tIdx) {
    const termStart = 2 + tIdx * subjects.length * FIELDS.length;
    const termWidth = subjects.length * FIELDS.length;

    sheet.getRange(1, termStart + 1, 1, termWidth)
      .setBackground('#34495e')
      .setFontColor('#ffffff')
      .setFontWeight('bold');

    sheet.getRange(2, termStart + 1, 1, termWidth)
      .setBackground('#ecf0f1')
      .setFontWeight('bold');

    sheet.getRange(3, termStart + 1, 1, termWidth)
      .setBackground('#f8f9fa')
      .setFontWeight('bold');
  });

  TERMS.forEach(function (term, tIdx) {
    const domStart = 2 + scoreCells + tIdx * DOMAIN_COLS_PER_TERM;
    sheet.getRange(1, domStart + 1, 1, DOMAIN_COLS_PER_TERM)
      .setBackground('#6b4423')
      .setFontColor('#ffffff')
      .setFontWeight('bold');
    sheet.getRange(2, domStart + 1, 1, DOMAIN_COLS_PER_TERM)
      .setBackground('#f4e3ce')
      .setFontWeight('bold');
    sheet.getRange(3, domStart + 1, 1, DOMAIN_COLS_PER_TERM)
      .setBackground('#f8f9fa');
  });

  sheet.setColumnWidth(1, 90);
  sheet.setColumnWidth(2, 180);
  for (let c = 3; c <= totalCols; c++) sheet.setColumnWidth(c, 42);
}

/* ============ CLASS TEACHER ASSIGNMENT HELPERS ============ */
// Users.class_teacher_class is the authoritative class assignment for class teachers.
// Users.class remains untouched as the separate default teaching-class field.
function getAssignedTeacherClass_(user) {
  return String(user && user.class_teacher_class ? user.class_teacher_class : '').trim();
}

function assertClassTeacherOwnClass_(user, className, message) {
  if (hasRole_(user, 'admin')) return true;
  if (hasRole_(user, 'class_teacher')) {
    const assignedClass = getAssignedTeacherClass_(user);
    const requestedClass = String(className || '').trim();
    if (!assignedClass) {
      throw new Error('No class has been assigned to your account. Contact the administrator.');
    }
    if (assignedClass !== requestedClass) {
      throw new Error(message || ('You can only access your assigned class: ' + assignedClass));
    }
  }
  return true;
}

/* ============ AUTH ============ */
function login(email, password) {
  if (!email || !password) throw new Error('Email and password required');
  const users = sheetToObjects(getSheet('Users'));
  const u = users.find(function (x) { return String(x.email).toLowerCase() === String(email).toLowerCase() && gtmcPasswordMatches_(password,x.password) && x.active !== false && String(x.active).toLowerCase() !== 'false'; });
  if (!u) throw new Error('Invalid credentials');
  if (String(u.password || '').indexOf('sha256$') !== 0) gtmcStorePassword_('Users','email',u.email,'password',password);

  const token = Utilities.getUuid();
  CacheService.getScriptCache().put('sess_' + token, JSON.stringify({
    email: u.email, name: u.name, role: String(u.role || ''),
    class: u.class || '', class_teacher_class: u.class_teacher_class || '', subjects: u.subjects || ''
  }), SESSION_SECONDS);

  logAudit(u.email, 'login', {});
  return {
    token: token,
    user: {
      email: u.email, name: u.name, role: String(u.role || ''),
      roles: roleList_(u),
      class: u.class || '', class_teacher_class: u.class_teacher_class || '', subjects: u.subjects || ''
    }
  };
}

function verifyToken(token) {
  if (!token) throw new Error('No token');
  const raw = CacheService.getScriptCache().get('sess_' + token);
  if (!raw) throw new Error('Session expired — please log in again');
  return JSON.parse(raw);
}

function requireRole(token, roles) {
  const u = verifyToken(token);
  const have = roleList_(u);
  const ok = roles.some(function (r) { return have.indexOf(r) !== -1; });
  if (!ok) throw new Error('Permission denied');
  return u;
}

/* ============ CLASSES ============ */
function getClasses(token) {
  verifyToken(token);
  return sheetToObjects(getSheet('Classes')).filter(function (c) { return c.active !== false; });
}

/* ============ STUDENTS ============ */
function getStudents(className, token) {
  verifyToken(token);
  if (!className) throw new Error('Class required');

  const sheet = getSheet(className);
  const lastRow = sheet.getLastRow();
  if (lastRow < 4) return [];

  const data = sheet.getRange(4, 1, lastRow - 3, 2).getValues();
  return data
    .filter(function (r) { return r[0] !== '' && r[1] !== ''; })
    .map(function (r) { return { student_id: String(r[0]), name: String(r[1]), class: className }; });
}

function addStudent(p, token) {
  const user = requireRole(token, ['admin', 'class_teacher', 'registrar']);
  const className = p.className || p.class;
  if (!className) throw new Error('Class required');
  assertClassTeacherOwnClass_(user, className, 'You can only add students to your assigned class.');
  if (CLASSES.indexOf(className) === -1) throw new Error('Unknown class: ' + className);

  const id = p.student_id || ('STU' + Date.now());
  const name = String(p.name || '').trim();
  if (!name) throw new Error('Student name required');

  const classSheet = getSheet(className);
  const lastRow = classSheet.getLastRow();
  if (lastRow >= 4) {
    const ids = classSheet.getRange(4, 1, lastRow - 3, 1).getValues().flat().map(String);
    if (ids.indexOf(id) !== -1) throw new Error('Duplicate student ID in this class');
  }

  const targetRow = Math.max(classSheet.getLastRow() + 1, 4);
  classSheet.getRange(targetRow, 1, 1, 2).setValues([[id, name]]);

  getSheet('Students').appendRow([id, name, className, true]);
  logAudit(user.email, 'addStudent', { id: id, name: name, class: className });
  return { student_id: id, name: name, class: className };
}

function addStudentsBulk(p, token) {
  const user = requireRole(token, ['admin', 'class_teacher', 'registrar']);
  const className = p.className || p.class;
  if (!className) throw new Error('Class required');
  assertClassTeacherOwnClass_(user, className, 'You can only add students to your assigned class.');
  if (CLASSES.indexOf(className) === -1) throw new Error('Unknown class: ' + className);

  let rawItems = [];
  if (Array.isArray(p.lines)) rawItems = p.lines;
  else if (Array.isArray(p.names)) rawItems = p.names;
  else if (typeof p.lines === 'string') rawItems = p.lines.split(/\r?\n/);
  else if (typeof p.names === 'string') rawItems = p.names.split(/\r?\n/);
  else throw new Error('No names provided');

  const items = [];
  rawItems.forEach(function (line) {
    const trimmed = String(line || '').trim();
    if (!trimmed) return;
    if (trimmed.indexOf(',') !== -1) {
      const parts = trimmed.split(',');
      const id = parts[0].trim();
      const name = parts.slice(1).join(',').trim();
      if (name) items.push({ id: id || null, name: name });
    } else {
      items.push({ id: null, name: trimmed });
    }
  });
  if (!items.length) throw new Error('No valid names found');

  const classSheet = getSheet(className);
  const studentsSheet = getSheet('Students');

  const lastRow = classSheet.getLastRow();
  const existingIds = {};
  let maxNum = 0;
  const insertStartRow = Math.max(lastRow + 1, 4);

  if (lastRow >= 4) {
    const idVals = classSheet.getRange(4, 1, lastRow - 3, 1).getValues();
    idVals.forEach(function (row) {
      const id = String(row[0] || '');
      if (!id) return;
      existingIds[id] = true;
      const m = id.match(/^STU(\d+)$/i);
      if (m) {
        const n = parseInt(m[1], 10);
        if (n > maxNum) maxNum = n;
      }
    });
  }

  const classRows = [];
  const studentRows = [];
  const added = [];
  const skipped = [];

  items.forEach(function (item) {
    let id = item.id;
    const name = item.name;
    if (id) {
      if (existingIds[id]) { skipped.push(id + ' (duplicate)'); return; }
    } else {
      maxNum++;
      id = 'STU' + String(maxNum).padStart(3, '0');
      while (existingIds[id]) { maxNum++; id = 'STU' + String(maxNum).padStart(3, '0'); }
    }
    existingIds[id] = true;
    classRows.push([id, name]);
    studentRows.push([id, name, className, true]);
    added.push({ id: id, name: name });
  });

  if (classRows.length) {
    classSheet.getRange(insertStartRow, 1, classRows.length, 2).setValues(classRows);
    const studentStart = Math.max(studentsSheet.getLastRow() + 1, 2);
    studentsSheet.getRange(studentStart, 1, studentRows.length, 4).setValues(studentRows);
  }

  logAudit(user.email, 'addStudentsBulk', {
    className: className, added: added.length, skipped: skipped.length
  });
  return { added: added, skipped: skipped, count: added.length };
}

function deleteStudent(studentId, token) {
  const user = requireRole(token, ['admin', 'class_teacher', 'registrar']);
  const studentsSheet = getSheet('Students');
  const students = sheetToObjects(studentsSheet);
  const target = students.find(function (s) { return String(s.student_id) === String(studentId); });
  if (!target) throw new Error('Student not found');
  assertClassTeacherOwnClass_(user, target.class, 'You can only manage students in your assigned class.');

  const data = studentsSheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]) === String(studentId) && data[i][2] === target.class) {
      studentsSheet.getRange(i + 1, 4).setValue(false);
    }
  }

  const classSheet = getSheet(target.class);
  const lastRow = classSheet.getLastRow();
  if (lastRow >= 4) {
    const ids = classSheet.getRange(4, 1, lastRow - 3, 1).getValues();
    for (let i = 0; i < ids.length; i++) {
      if (String(ids[i][0]) === String(studentId)) {
        classSheet.deleteRow(4 + i);
        break;
      }
    }
  }

  logAudit(user.email, 'deleteStudent', { id: studentId, class: target.class });
  return { success: true };
}

/* ============ TEACHER ACCESS HELPERS ============ */
function splitAssignmentList_(value) {
  return String(value || '').split(/[,;\n]/).map(function (x) { return x.trim().toLowerCase(); }).filter(Boolean);
}
function assertTeacherClassSubjectAccess_(user, className, subject) {
  if (hasRole_(user, 'admin')) return true;
  if (!hasRole_(user, 'class_teacher') && !hasRole_(user, 'subject_teacher')) {
    throw new Error('Permission denied for teacher score access.');
  }
  assertClassTeacherOwnClass_(user, className, 'You can only access your assigned class.');
  if (hasRole_(user, 'subject_teacher')) {
    const assigned = splitAssignmentList_(user.subjects);
    if (!assigned.length) throw new Error('No subjects are assigned to this account. Contact the administrator.');
    if (subject && assigned.indexOf(String(subject).trim().toLowerCase()) === -1) {
      throw new Error('You can only access your assigned subjects.');
    }
  }
  return true;
}
function assessmentFromField_(field) {
  if (FIELDS.indexOf(String(field || '')) < 0) throw new Error('Assessment field must be T1, T2, T3 or Exam.');
  return String(field);
}
function submissionHeadersMap_(sheet) {
  const headers = sheet.getRange(1, 1, 1, Math.max(sheet.getLastColumn(), 1)).getValues()[0].map(function (v) { return String(v || '').trim(); });
  const map = {}; headers.forEach(function (h, i) { if (h) map[h] = i; });
  return { headers: headers, map: map };
}
function submissionValue_(row, map, key) { return map[key] === undefined ? '' : row[map[key]]; }
function submissionSet_(sheet, rowNum, map, values) {
  Object.keys(values).forEach(function (key) {
    if (map[key] !== undefined) sheet.getRange(rowNum, map[key] + 1).setValue(values[key]);
  });
}
function normalizeAssessment_(assessment) {
  const raw = String(assessment || '').trim().toLowerCase();
  if (!raw) return '';
  const aliases = { t1:'T1', 'test 1':'T1', firsttest:'T1', 'first test':'T1', t2:'T2', 'test 2':'T2', secondtest:'T2', 'second test':'T2', t3:'T3', 'test 3':'T3', thirdtest:'T3', 'third test':'T3', exam:'Exam', examination:'Exam' };
  const result = aliases[raw] || '';
  if (!result) throw new Error('Assessment must be T1, T2, T3 or Exam.');
  return result;
}
function submissionMatches_(row, map, criteria) {
  return String(submissionValue_(row, map, 'teacher_email')) === String(criteria.teacherEmail) &&
    String(submissionValue_(row, map, 'class')) === String(criteria.className) &&
    String(submissionValue_(row, map, 'subject')) === String(criteria.subject) &&
    String(submissionValue_(row, map, 'term')) === String(criteria.term) &&
    (criteria.assessment === undefined || String(submissionValue_(row, map, 'assessment') || '') === String(criteria.assessment || '')) &&
    (!criteria.academicYear || !submissionValue_(row, map, 'academic_year') || String(submissionValue_(row, map, 'academic_year')) === String(criteria.academicYear));
}
function assessmentLockState_(className, subject, term, assessment, user, academicYear) {
  if (hasRole_(user, 'admin')) return { editable: true, state: 'admin' };
  const sh = getSheet('Submissions');
  const d = sh.getDataRange().getValues();
  if (!d.length) return { editable: true, state: 'open' };
  const hm = submissionHeadersMap_(sh), map = hm.map;
  let specific = null;
  for (let i = 1; i < d.length; i++) {
    if (!submissionMatches_(d[i], map, { teacherEmail: user.email, className: className, subject: subject, term: term, academicYear: academicYear })) continue;
    const a = String(submissionValue_(d[i], map, 'assessment') || '').trim();
    const status = String(submissionValue_(d[i], map, 'status') || '').toLowerCase();
    if (a === assessment) specific = { rowNum: i + 1, row: d[i], status: status, deadline: submissionValue_(d[i], map, 'correction_deadline') };
    // Legacy term-wide rows are ignored by the assessment lock model.
    // Each T1/T2/T3/Exam assessment is controlled only by its own record.
  }
  if (specific) {
    if (specific.status === 'locked') return { editable: false, state: 'locked', message: 'This assessment is locked. Ask the administrator to authorise a correction.' };
    if (specific.status === 'correction_open') {
      const deadline = specific.deadline ? new Date(specific.deadline).getTime() : NaN;
      if (!isFinite(deadline) || deadline <= Date.now()) return { editable: false, state: 'expired', message: 'The authorised correction window has expired.' };
      return { editable: true, state: 'correction_open', deadline: new Date(deadline).toISOString() };
    }
  }
  // No term-wide lock is applied: assessments are independent.
  return { editable: true, state: 'open' };
}
function assertAssessmentEditable_(className, subject, term, assessment, user, academicYear) {
  if (hasRole_(user, 'admin')) return;
  const state = assessmentLockState_(className, subject, term, assessment, user, academicYear);
  if (!state.editable) throw new Error(state.message || 'Assessment is locked.');
}

/* ============ SCORES ============ */
function columnOffset(className, subject, term, field) {
  const subjects = subjectsForClass(className);
  const sIdx = subjects.indexOf(subject);
  if (sIdx === -1) throw new Error('Subject not offered by ' + className + ': ' + subject);
  const tIdx = TERMS.indexOf(term);
  if (tIdx === -1) throw new Error('Bad term: ' + term);
  const fIdx = FIELDS.indexOf(field);
  if (fIdx === -1) throw new Error('Bad field: ' + field);
  return tIdx * subjects.length * FIELDS.length + sIdx * FIELDS.length + fIdx;
}

function getScores(p, token) {
  const user = verifyToken(token);
  const className = p.className, subject = p.subject, term = p.term;
  if (!className || !subject || !term) throw new Error('className, subject, term required');
  if (CLASSES.indexOf(className) === -1) throw new Error('Unknown class: ' + className);
  if (TERMS.indexOf(term) === -1) throw new Error('Invalid term: ' + term);
  assertTeacherClassSubjectAccess_(user, className, subject);

  const sheet = getSheet(className);
  const lastRow = sheet.getLastRow();
  if (lastRow < 4) return [];

  const subjects = subjectsForClass(className);
  const tIdx = TERMS.indexOf(term);
  const sIdx = subjects.indexOf(subject);
  if (tIdx === -1 || sIdx === -1) throw new Error('Invalid subject/term for this class');

  const firstScoreCol = 3 + tIdx * subjects.length * FIELDS.length + sIdx * FIELDS.length;

  const idName = sheet.getRange(4, 1, lastRow - 3, 2).getValues();
  const values = sheet.getRange(4, firstScoreCol, lastRow - 3, FIELDS.length).getValues();

  return idName.map(function (row, i) {
    if (!row[0] || !row[1]) return null;
    return {
      student_id: String(row[0]),
      name: row[1],
      T1: values[i][0], T2: values[i][1], T3: values[i][2], Exam: values[i][3]
    };
  }).filter(Boolean);
}

function getStudentScores(p, token) {
  verifyToken(token);
  const className = p.className, term = p.term, studentId = p.studentId;
  if (!className || !term || !studentId)
    throw new Error('className, term, studentId required');

  const sheet = getSheet(className);
  const lastRow = sheet.getLastRow();
  if (lastRow < 4) return [];

  const subjects = subjectsForClass(className);
  const tIdx = TERMS.indexOf(term);
  if (tIdx === -1) throw new Error('Bad term');

  const ids = sheet.getRange(4, 1, lastRow - 3, 1).getValues();
  let rowIdx = -1;
  for (let i = 0; i < ids.length; i++) {
    if (String(ids[i][0]) === String(studentId)) { rowIdx = 4 + i; break; }
  }
  if (rowIdx === -1) throw new Error('Student not found');

  const termStart = 3 + tIdx * subjects.length * FIELDS.length;
  const rowValues = sheet.getRange(rowIdx, termStart, 1, subjects.length * FIELDS.length).getValues()[0];

  return subjects.map(function (subj, i) {
    const base = i * FIELDS.length;
    const t1 = Number(rowValues[base])     || 0;
    const t2 = Number(rowValues[base + 1]) || 0;
    const t3 = Number(rowValues[base + 2]) || 0;
    const ex = Number(rowValues[base + 3]) || 0;
    return {
      subject: subj,
      T1: rowValues[base], T2: rowValues[base + 1], T3: rowValues[base + 2], Exam: rowValues[base + 3],
      total: t1 + t2 + t3 + ex
    };
  });
}

function saveScore(p, token) {
  const user = requireRole(token, ['admin', 'subject_teacher', 'class_teacher']);
  const className = p.className, subject = p.subject, term = p.term,
        field = p.field, studentId = p.studentId;
  let value = p.value;
  if (value === '' || value === null || value === undefined) value = '';
  else value = Number(value);

  if (!className || !subject || !term || !field || !studentId)
    throw new Error('className, subject, term, field, studentId required');
  if (CLASSES.indexOf(className) === -1) throw new Error('Unknown class');
  if (TERMS.indexOf(term) === -1) throw new Error('Invalid term');
  if (subjectsForClass(className).indexOf(subject) === -1) throw new Error('Invalid subject for this class');
  if (value !== '' && (!Number.isFinite(value))) throw new Error('Score must be a valid number');
  if (field === 'Exam' && value !== '' && (value < 0 || value > 70))
    throw new Error('Exam must be 0–70');
  if (field !== 'Exam' && value !== '' && (value < 0 || value > 10))
    throw new Error('Test must be 0–10');

  assertTeacherClassSubjectAccess_(user, className, subject);
  const assessment = assessmentFromField_(field);
  assertAssessmentEditable_(className, subject, term, assessment, user, p.academicYear);

  const sheet = getSheet(className);
  const lastRow = sheet.getLastRow();
  if (lastRow < 4) throw new Error('No students in ' + className);

  const ids = sheet.getRange(4, 1, lastRow - 3, 1).getValues();
  let rowIdx = -1;
  for (let i = 0; i < ids.length; i++) {
    if (String(ids[i][0]) === String(studentId)) { rowIdx = 4 + i; break; }
  }
  if (rowIdx === -1) throw new Error('Student not found in ' + className);

  const col = 3 + columnOffset(className, subject, term, field);
  const scoreCell = sheet.getRange(rowIdx, col);
  const previousValue = scoreCell.getValue();
  scoreCell.setValue(value);
  if (String(previousValue) !== String(value)) logAudit(user.email, 'saveScore', { className: className, subject: subject, term: term, assessment: assessment, studentId: String(studentId), previousValue: previousValue, newValue: value });
  return { success: true };
}

/* ============ SUBMISSION / LOCK ============ */
function assertEditable(className, subject, term, user) {
  // Compatibility wrapper for any older internal callers.
  const state = assessmentLockState_(className, subject, term, 'T1', user, '');
  if (!state.editable) throw new Error(state.message || 'Scores locked. Ask admin to unlock.');
}

function upsertSubmission_(values, criteria) {
  const sh = getSheet('Submissions');
  const data = sh.getDataRange().getValues();
  const hm = submissionHeadersMap_(sh), map = hm.map;
  let rowNum = -1;
  for (let i = 1; i < data.length; i++) {
    if (submissionMatches_(data[i], map, criteria)) rowNum = i + 1;
  }
  if (rowNum < 0) {
    const row = new Array(hm.headers.length).fill('');
    Object.keys(values).forEach(function (key) { if (map[key] !== undefined) row[map[key]] = values[key]; });
    sh.appendRow(row);
    return sh.getLastRow();
  }
  submissionSet_(sh, rowNum, map, values);
  return rowNum;
}

function submitScores(p, token) {
  const user = requireRole(token, ['subject_teacher', 'class_teacher', 'admin']);
  const className = String(p.className || '').trim(), subject = String(p.subject || '').trim(), term = String(p.term || '').trim();
  if (!className || !subject || !term) throw new Error('className, subject, term required');
  if (CLASSES.indexOf(className) === -1) throw new Error('Unknown class');
  if (TERMS.indexOf(term) === -1) throw new Error('Invalid term');
  if (subjectsForClass(className).indexOf(subject) === -1) throw new Error('Invalid subject for this class');
  assertTeacherClassSubjectAccess_(user, className, subject);

  const assessment = normalizeAssessment_(p.assessment || p.field || '');
  const now = new Date();
  if (assessment) {
    const state = assessmentLockState_(className, subject, term, assessment, user, p.academicYear);
    if (state.state === 'locked') throw new Error('This assessment has already been submitted and locked.');
    if (state.state === 'expired') throw new Error('The correction window has expired. Request a new authorisation.');
    // An existing legacy term-wide lock is intentionally not overwritten. This specific
    // assessment record permits only the authorised assessment to be corrected.
    const sh = getSheet('Submissions');
    const data = sh.getDataRange().getValues(), hm = submissionHeadersMap_(sh), map = hm.map;
    let current = null;
    for (let i = 1; i < data.length; i++) {
      if (submissionMatches_(data[i], map, { teacherEmail: user.email, className: className, subject: subject, term: term, assessment: assessment, academicYear: p.academicYear })) {
        current = { rowNum: i + 1, row: data[i], status: String(submissionValue_(data[i], map, 'status') || '').toLowerCase(), deadline: submissionValue_(data[i], map, 'correction_deadline') };
      }
    }
    if (current && current.status === 'correction_open') {
      const deadline = current.deadline ? new Date(current.deadline).getTime() : NaN;
      if (!isFinite(deadline) || deadline <= now.getTime()) throw new Error('The correction window has expired.');
    }
    const vals = {
      teacher_email: user.email, class: className, subject: subject, term: term,
      status: 'locked', timestamp: now, assessment: assessment,
      academic_year: p.academicYear || '', submitted_by: user.email,
      correction_deadline: '', resubmitted_at: current ? now : '', resubmitted_by: current ? user.email : ''
    };
    upsertSubmission_(vals, { teacherEmail: user.email, className: className, subject: subject, term: term, assessment: assessment, academicYear: p.academicYear });
    createNotification_('', 'admin', current ? 'Assessment resubmitted' : 'Assessment submitted', user.name + ' submitted ' + assessment + ' for ' + subject + ' (' + className + ', ' + term + ').', 'score_submission', 'submissions:' + className, user.email);
    logAudit(user.email, current ? 'resubmitAssessment' : 'submitAssessment', {
      className: className, subject: subject, term: term, assessment: assessment, academicYear: p.academicYear || ''
    });
    try {
      ADMIN_EMAILS.forEach(function (addr) {
        MailApp.sendEmail({
          to: addr,
          subject: '[Grade System] ' + user.name + ' submitted ' + assessment + ' / ' + subject + ' / ' + className + ' / ' + term,
          body: user.name + ' (' + user.email + ') submitted assessment scores.\n\nClass: ' + className + '\nSubject: ' + subject + '\nTerm: ' + term + '\nAssessment: ' + assessment + '\n\nThis assessment is now locked.'
        });
      });
    } catch (e) {}
    return { success: true, locked: true, assessment: assessment, status: 'locked' };
  }

  throw new Error('Choose T1, T2, T3 or Exam. Term-wide submission locks are disabled.');
  /* Legacy term-lock code retained below for historical reference; it is unreachable.
  const sh = getSheet('Submissions');
  const data = sh.getDataRange().getValues(), hm = submissionHeadersMap_(sh), map = hm.map;
  const vals = { teacher_email: user.email, class: className, subject: subject, term: term, status: 'locked', timestamp: now, assessment: '', academic_year: p.academicYear || '', submitted_by: user.email };
  upsertSubmission_(vals, { teacherEmail: user.email, className: className, subject: subject, term: term, assessment: '', academicYear: p.academicYear });
  try {
    ADMIN_EMAILS.forEach(function (addr) {
      MailApp.sendEmail({ to: addr, subject: '[Grade System] ' + user.name + ' submitted ' + subject + ' / ' + className + ' / ' + term,
        body: user.name + ' (' + user.email + ') submitted scores.\n\nClass: ' + className + '\nSubject: ' + subject + '\nTerm: ' + term + '\n\nLegacy term-wide lock applied.' });
    });
  } catch (e) {}
  logAudit(user.email, 'submitScoresLegacy', { className: className, subject: subject, term: term });
  return { success: true, locked: true, legacy: true };
  */
}

function unlockScores(p, token) {
  const admin = requireRole(token, ['admin']);
  const teacherEmail = String(p.teacherEmail || '').trim(), className = String(p.className || '').trim(),
        subject = String(p.subject || '').trim(), term = String(p.term || '').trim();
  if (!teacherEmail || !className || !subject || !term) throw new Error('teacherEmail, className, subject and term are required.');
  if (CLASSES.indexOf(className) === -1 || TERMS.indexOf(term) === -1 || subjectsForClass(className).indexOf(subject) === -1) throw new Error('Invalid class, subject or term.');
  const assessment = normalizeAssessment_(p.assessment || '');
  const now = new Date();
  if (assessment) {
    const reason = String(p.reason || p.unlockReason || '').trim();
    if (!reason) throw new Error('A reason is required for an assessment correction.');
    let deadline;
    if (p.correctionDeadline) deadline = new Date(p.correctionDeadline);
    else if (p.correctionMinutes !== undefined && p.correctionMinutes !== '') {
      const minutes = Number(p.correctionMinutes);
      if (!Number.isFinite(minutes) || minutes <= 0 || minutes > 10080) throw new Error('Correction duration must be between 1 and 10080 minutes.');
      deadline = new Date(now.getTime() + minutes * 60000);
    } else throw new Error('Provide correctionMinutes or correctionDeadline.');
    if (!isFinite(deadline.getTime()) || deadline.getTime() <= now.getTime()) throw new Error('Correction deadline must be in the future.');
    const vals = {
      teacher_email: teacherEmail, class: className, subject: subject, term: term,
      status: 'correction_open', timestamp: now, assessment: assessment,
      academic_year: p.academicYear || '', unlocked_at: now, unlocked_by: admin.email,
      unlock_reason: reason, correction_deadline: deadline, submitted_by: teacherEmail
    };
    upsertSubmission_(vals, { teacherEmail: teacherEmail, className: className, subject: subject, term: term, assessment: assessment, academicYear: p.academicYear });
    logAudit(admin.email, 'unlockAssessmentForCorrection', { teacherEmail: teacherEmail, className: className, subject: subject, term: term, assessment: assessment, reason: reason, correctionDeadline: deadline, academicYear: p.academicYear || '' });
    return { success: true, assessment: assessment, status: 'correction_open', correctionDeadline: deadline.toISOString() };
  }
  throw new Error('Select T1, T2, T3 or Exam. Term-wide unlocks are disabled.');
  /* Legacy unlock code retained for historical reference; it is unreachable.
  const sh = getSheet('Submissions'), data = sh.getDataRange().getValues(), hm = submissionHeadersMap_(sh), map = hm.map;
  for (let i = 1; i < data.length; i++) {
    if (submissionMatches_(data[i], map, { teacherEmail: teacherEmail, className: className, subject: subject, term: term, assessment: '' })) {
      submissionSet_(sh, i + 1, map, { status: 'unlocked', timestamp: now, unlocked_at: now, unlocked_by: admin.email, unlock_reason: String(p.reason || 'Legacy unlock'), correction_deadline: '' });
      logAudit(admin.email, 'unlockScoresLegacy', { teacherEmail: teacherEmail, className: className, subject: subject, term: term });
      return { success: true, legacy: true };
    }
  }
  throw new Error('No assessment submission found.');
  */
}

function getSubmissions(p, token) {
  const user = verifyToken(token);
  if (!hasRole_(user, 'admin') && !hasRole_(user, 'class_teacher') && !hasRole_(user, 'subject_teacher')) throw new Error('Permission denied.');
  let rows = sheetToObjects(getSheet('Submissions'));
  if (!hasRole_(user, 'admin')) rows = rows.filter(function (r) { return String(r.teacher_email) === String(user.email); });
  if (p.status) rows = rows.filter(function (r) { return String(r.status) === String(p.status); });
  if (p.className) rows = rows.filter(function (r) { return String(r.class) === String(p.className); });
  if (p.subject) rows = rows.filter(function (r) { return String(r.subject) === String(p.subject); });
  if (p.term) rows = rows.filter(function (r) { return String(r.term) === String(p.term); });
  if (p.assessment) rows = rows.filter(function (r) { return String(r.assessment || '') === normalizeAssessment_(p.assessment); });
  return rows;
}

/* ============ TEACHERS ============ */
function getTeachers(token) {
  requireRole(token, ['admin']);
  return sheetToObjects(getSheet('Users'))
    .filter(function (u) {
      const r = roleList_(u);
      return r.indexOf('subject_teacher') !== -1 || r.indexOf('class_teacher') !== -1;
    })
    .map(function (u) {
      return {
        email: u.email, name: u.name, role: String(u.role || ''),
        roles: roleList_(u),
        class: u.class || '', class_teacher_class: u.class_teacher_class || '', subjects: u.subjects || '', active: u.active
      };
    });
}

function createTeacher(p, token) {
  const admin = requireRole(token, ['admin']);
  if (!p.email || !p.name || !p.password) throw new Error('Name, email, password required');

  const roles = String(p.role || '').split(',').map(function (s) { return s.trim(); }).filter(Boolean);
  if (!roles.length) throw new Error('At least one role required');
  const valid = ['admin','subject_teacher','class_teacher','student','principal','vice_principal','vice_principal_admin','vice_principal_academic','registrar','bursar'];
  roles.forEach(function (r) {
    if (valid.indexOf(r) === -1) throw new Error('Invalid role: ' + r);
  });

  const sheet = getSheet('Users');
  const all = sheetToObjects(sheet);
  if (all.find(function (u) { return String(u.email).toLowerCase() === String(p.email).toLowerCase(); }))
    throw new Error('Email already exists');

  sheet.appendRow([
    p.email, p.name, roles.join(','),
    p.class || '', p.subjects || '', gtmcPasswordHash_(p.password), true, p.class_teacher_class || ''
  ]);
  logAudit(admin.email, 'createTeacher', { email: p.email, roles: roles, class_teacher_class: p.class_teacher_class || '' });
  return { success: true };
}

function adminUpdateTeacherClass(p, token) {
  const admin = requireRole(token, ['admin']);
  if (!p.email) throw new Error('Teacher email required');
  const sheet = getSheet('Users');
  const values = sheet.getDataRange().getValues();
  if (!values.length) throw new Error('Users sheet has no header row');
  const headers = values[0].map(function (h) { return String(h || '').trim(); });
  const normalizedHeaders = headers.map(function (h) { return h.toLowerCase(); });
  let classCol = normalizedHeaders.indexOf('class_teacher_class');
  if (classCol < 0) {
    classCol = headers.length;
    sheet.getRange(1, classCol + 1).setValue('class_teacher_class').setFontWeight('bold');
  }
  const emailCol = normalizedHeaders.indexOf('email');
  if (emailCol < 0) throw new Error('Users sheet is missing the email column');
  for (let i = 1; i < values.length; i++) {
    if (String(values[i][emailCol]).toLowerCase() === String(p.email).toLowerCase()) {
      const assigned = String(p.class_teacher_class || '').trim();
      if (assigned && CLASSES.indexOf(assigned) === -1) throw new Error('Unknown class assignment: ' + assigned);
      sheet.getRange(i + 1, classCol + 1).setValue(assigned);
      logAudit(admin.email, 'adminUpdateTeacherClass', { email: p.email, class_teacher_class: assigned });
      return { success: true, email: p.email, class_teacher_class: assigned };
    }
  }
  throw new Error('Teacher not found');
}

function deleteTeacher(email, token) {
  const admin = requireRole(token, ['admin']);
  const sheet = getSheet('Users');
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]).toLowerCase() === String(email).toLowerCase()) {
      sheet.getRange(i + 1, 7).setValue(false);
      logAudit(admin.email, 'deleteTeacher', { email: email });
      return { success: true };
    }
  }
  throw new Error('Teacher not found');
}

/* ============ EXPORT / IMPORT ============ */
function exportAll(token) {
  requireRole(token, ['admin']);
  const ss = openSS();
  const copy = ss.copy('Export_' + Date.now());
  const url = 'https://docs.google.com/spreadsheets/d/' + copy.getId() + '/export?format=xlsx';
  return { url: url, id: copy.getId() };
}

function importBulk(rows, token) {
  const admin = requireRole(token, ['admin']);
  if (!rows || !rows.length) throw new Error('No rows provided');

  let updated = 0;
  rows.forEach(function (r) {
    try {
      const sheet = getSheet(r.className);
      const lastRow = sheet.getLastRow();
      if (lastRow < 4) return;
      const ids = sheet.getRange(4, 1, lastRow - 3, 1).getValues();
      let rowIdx = -1;
      for (let i = 0; i < ids.length; i++) {
        if (String(ids[i][0]) === String(r.studentId)) { rowIdx = 4 + i; break; }
      }
      if (rowIdx === -1) return;
      const col = 3 + columnOffset(r.className, r.subject, r.term, r.field);
      sheet.getRange(rowIdx, col).setValue(r.value);
      updated++;
    } catch (e) {}
  });

  logAudit(admin.email, 'importBulk', { updated: updated });
  return { updated: updated };
}

/* ============ MENU ============ */
function onOpen() {
  try {
    SpreadsheetApp.getUi()
      .createMenu('Grade System')
      .addItem('Setup / Repair tabs', 'setupSheets')
      .addItem('Rebuild class headers only (safe)', 'rebuildClassHeaders')
      .addItem('Rebuild JSS headers only (safe)', 'rebuildJSSHeadersOnly')
      .addItem('Create / Repair AI Comments tab', 'createAICommentsTab')
      .addToUi();
  } catch (e) {}
}

function rebuildClassHeaders() {
  const ss = openSS();
  const errors = [];
  CLASSES.forEach(function (cn) {
    try {
      const s = ss.getSheetByName(cn);
      if (s) buildClassTab(s, cn);
    } catch (err) {
      errors.push(cn + ': ' + (err && err.message ? err.message : err));
    }
  });
  const msg = errors.length
    ? 'Some tabs failed:\n' + errors.join('\n')
    : 'Class headers rebuilt. Student data untouched.';
  Logger.log(msg);
  try { SpreadsheetApp.getUi().alert(msg); } catch (e) {}
}

function rebuildJSSHeadersOnly() {
  const ss = openSS();
  const jssClasses = CLASSES.filter(function (c) { return c.indexOf('JSS') === 0; });
  const errors = [];
  jssClasses.forEach(function (cn) {
    try {
      const s = ss.getSheetByName(cn);
      if (!s) { errors.push(cn + ': sheet not found'); return; }
      buildClassTab(s, cn);
    } catch (err) {
      errors.push(cn + ': ' + (err && err.message ? err.message : err));
    }
  });
  const msg = errors.length
    ? 'Some JSS tabs failed:\n' + errors.join('\n')
    : 'JSS headers rebuilt. Student data untouched. SS tabs not touched.';
  Logger.log(msg);
  try { SpreadsheetApp.getUi().alert(msg); } catch (e) {}
}

function verifySubjectOrderFingerprint_() {
  const props = PropertiesService.getScriptProperties();
  const KEY = 'SUBJECT_ORDER_FINGERPRINT';
  const fp = JSON.stringify({ jss: JSS_SUBJECTS, ss: SS_SUBJECTS });
  const stored = props.getProperty(KEY);
  if (!stored) { props.setProperty(KEY, fp); return; }
  if (stored !== fp) {
    const old = JSON.parse(stored);
    const isAppendOnly =
      JSS_SUBJECTS.slice(0, old.jss.length).join('|') === old.jss.join('|') &&
      SS_SUBJECTS.slice(0, old.ss.length).join('|') === old.ss.join('|');
    if (!isAppendOnly) {
      throw new Error(
        'Subject arrays were reordered/inserted/removed. Scores are stored by column ' +
        "position. Revert the change or deliberately clear Script Properties key 'SUBJECT_ORDER_FINGERPRINT'."
      );
    }
    props.setProperty(KEY, fp);
  }
}

/* ============ GET ENDPOINT ============ */
const SKIP = ["Users","Submissions","Students","Scores","Subjects","Classes","Audit",
              "AI_Comments","ParentAccounts","ParentLinks","ReportTemplate","ResultPublication",
              "PrincipalRemarks","Affective","Psychomotor","SchoolCalendar","TeacherRemarks",
              "Debtors","Announcements","StaffMessages"];

function doGet(e) {
  const params = (e && e.parameter) ? e.parameter : {};
  if (params.action) {
    const sensitiveActions = [
      'parentLogin','parentGetWards','parentGetResult','parentAskResultAI',
      'parentGetDebts','parentGetAnnouncements','parentGetTestBreakdown'
    ];
    if (sensitiveActions.indexOf(String(params.action)) !== -1) {
      return out({ success: false, error: 'Use POST for parent portal actions.' });
    }
    return handle(e);
  }

  try {
    if (params.sheet || params.sheets === 'all') {
      const backupKey = PropertiesService.getScriptProperties().getProperty('BACKUP_API_KEY');
      if (!backupKey || String(params.backupKey || '') !== backupKey) {
        return out({ error: 'Backup access is disabled or unauthorised. Configure BACKUP_API_KEY and provide it only to trusted backup clients.' });
      }
    }
    const ss = openSS();
    const result = {};
    if (params.sheet) {
      const sh = ss.getSheetByName(params.sheet);
      if (!sh) return out({ error: 'Sheet not found: ' + params.sheet });
      result[params.sheet] = sh.getDataRange().getValues();
    } else if (params.sheets === 'all') {
      ss.getSheets().forEach(function (sh) {
        const name = sh.getName();
        if (SKIP.indexOf(name) !== -1) return;
        result[name] = sh.getDataRange().getValues();
      });
    } else {
      return out({ success: true, message: 'Grade System API is running. Use ?action=... or ?sheets=all.' });
    }
    return out(result);
  } catch (err) {
    return out({ error: String(err && err.message ? err.message : err) });
  }
}

function json(obj) { return out(obj); }

/* ============================================================
   AI ANNUAL REPORT COMMENTS
   ============================================================ */
const AI_COMMENT_HEADERS = [
  'Comment ID','Student ID','Student Name','Class','Academic Year',
  'Annual Average','Academic Summary','Strengths','Areas to Improve',
  'Recommended Actions','Approval Status','Generated At','Approved By','Approved At'
];
const AI_BATCH_SIZE = 3;

function setupAICommentsSheet() {
  const ss = openSS();
  let sh = ss.getSheetByName('AI_Comments');
  if (!sh) sh = ss.insertSheet('AI_Comments');
  const existing = sh.getRange(1, 1, 1, AI_COMMENT_HEADERS.length).getValues()[0];
  const correct = AI_COMMENT_HEADERS.every(function (h, i) { return existing[i] === h; });
  if (sh.getLastRow() === 0 || !correct) {
    if (sh.getLastRow() > 1) {
      throw new Error('AI_Comments has data but its headers differ. Back it up and correct the headers manually before setup.');
    }
    sh.getRange(1, 1, 1, AI_COMMENT_HEADERS.length).setValues([AI_COMMENT_HEADERS]);
  }
  sh.setFrozenRows(1);
  sh.getRange(1, 1, 1, AI_COMMENT_HEADERS.length).setFontWeight('bold').setWrap(true);
  sh.setColumnWidth(7, 260);
  sh.setColumnWidth(8, 240);
  sh.setColumnWidth(9, 240);
  sh.setColumnWidth(10, 260);
  return 'AI_Comments tab is ready. Existing records were preserved.';
}

function aiGetCommentSheet_() {
  const ss = openSS();
  let sh = ss.getSheetByName('AI_Comments');
  if (!sh) {
    sh = ss.insertSheet('AI_Comments');
    sh.getRange(1, 1, 1, AI_COMMENT_HEADERS.length).setValues([AI_COMMENT_HEADERS]);
    sh.setFrozenRows(1);
    sh.getRange(1, 1, 1, AI_COMMENT_HEADERS.length).setFontWeight('bold');
  }
  const actual = sh.getRange(1, 1, 1, AI_COMMENT_HEADERS.length).getValues()[0];
  if (!AI_COMMENT_HEADERS.every(function (h, i) { return actual[i] === h; })) {
    throw new Error('AI_Comments tab headers are not correct. Run setupAICommentsSheet after backing up any existing data.');
  }
  return sh;
}

function aiGetExistingKeys_(sheet) {
  const keys = {};
  const last = sheet.getLastRow();
  if (last < 2) return keys;
  const rows = sheet.getRange(2, 1, last - 1, AI_COMMENT_HEADERS.length).getValues();
  rows.forEach(function (r) {
    const key = [String(r[1]), String(r[3]), String(r[4])].join('|');
    keys[key] = true;
  });
  return keys;
}

/* ============================================================
   GEMINI AI CONNECTION
   Configure GEMINI_API_KEY and optionally GEMINI_MODEL in
   Apps Script > Project Settings > Script Properties.
   ============================================================ */
function geminiGenerateText_(prompt, maxOutputTokens, jsonMode, keyOverride, modelOverride) {
  const props = PropertiesService.getScriptProperties();
  const apiKey = keyOverride || props.getProperty('GEMINI_API_KEY');
  const model = modelOverride || props.getProperty('GEMINI_MODEL') || 'gemini-2.5-flash';
  if (!apiKey) {
    throw new Error('Gemini is not configured. Add GEMINI_API_KEY in Apps Script Project Settings > Script Properties.');
  }

  const url = 'https://generativelanguage.googleapis.com/v1beta/models/' + encodeURIComponent(model) + ':generateContent';
  const generationConfig = {
    temperature: 0.3,
    maxOutputTokens: maxOutputTokens || 1000
  };
  if (jsonMode) generationConfig.responseMimeType = 'application/json';

  const payload = {
    contents: [{ role: 'user', parts: [{ text: String(prompt || '') }] }],
    generationConfig: generationConfig
  };
  const response = UrlFetchApp.fetch(url, {
    method: 'post',
    contentType: 'application/json',
    headers: { 'x-goog-api-key': apiKey },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  });

  const status = response.getResponseCode();
  const body = response.getContentText();
  if (status < 200 || status >= 300) {
    let detail = body;
    try {
      const errorData = JSON.parse(body);
      if (errorData.error && errorData.error.message) detail = errorData.error.message;
    } catch (ignore) {}
    if (status === 400) throw new Error('Gemini rejected the request (400): ' + String(detail).slice(0, 600));
    if (status === 401) throw new Error('Gemini authentication failed (401). Check that GEMINI_API_KEY is correct.');
    if (status === 403) throw new Error('Gemini access denied (403). Check API access, project restrictions and billing: ' + String(detail).slice(0, 500));
    if (status === 404) throw new Error('Gemini model not found (404). Check GEMINI_MODEL. Current setting: ' + model);
    if (status === 429) throw new Error('Gemini quota or rate limit reached (429). Check your Google AI API quota and billing.');
    throw new Error('Gemini API error (' + status + '): ' + String(detail).slice(0, 700));
  }

  let result;
  try {
    result = JSON.parse(body);
  } catch (err) {
    throw new Error('Gemini returned an unreadable response.');
  }
  if (!result.candidates || !result.candidates.length) {
    const reason = result.promptFeedback && result.promptFeedback.blockReason
      ? result.promptFeedback.blockReason : 'No response candidate returned';
    throw new Error('Gemini could not generate a response: ' + reason);
  }
  const candidate = result.candidates[0];
  const parts = candidate.content && candidate.content.parts ? candidate.content.parts : [];
  const answer = parts.map(function (part) { return part.text || ''; }).join('').trim();
  if (!answer) {
    const finishReason = candidate.finishReason || 'unknown reason';
    throw new Error('Gemini returned an empty response (finish reason: ' + finishReason + ').');
  }
  return answer;
}

function testGeminiConnection() {
  const answer = geminiGenerateText_('Reply with exactly: GTMC Gemini connection successful.', 60, false);
  Logger.log(answer);
  return answer;
}

function generateAnnualAIComments(p, token) {
  const admin = requireRole(token, ['admin']);
  const className = String(p.className || '').trim();
  const academicYear = String(p.academicYear || '').trim();
  const startIndex = Math.max(0, Number(p.startIndex) || 0);
  if (CLASSES.indexOf(className) === -1) throw new Error('Select a valid class.');
  if (!academicYear) throw new Error('Academic year is required, e.g. 2026/2027.');

  const apiKey = PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY');
  if (!apiKey) throw new Error('GEMINI_API_KEY is missing in Apps Script Project Settings > Script properties.');
  const model = PropertiesService.getScriptProperties().getProperty('GEMINI_MODEL') || 'gemini-2.5-flash';
  const classSheet = getSheet(className);
  const lastRow = classSheet.getLastRow();
  if (lastRow < 4) throw new Error('There are no students in ' + className + '.');

  const rows = classSheet.getRange(4, 1, lastRow - 3, 2).getValues()
    .map(function (r, i) { return { id: String(r[0] || '').trim(), name: String(r[1] || '').trim(), row: i + 4 }; })
    .filter(function (x) { return x.id && x.name; });
  if (startIndex >= rows.length) return { processed: 0, created: 0, skipped: 0, totalStudents: rows.length, done: true };

  const commentsSheet = aiGetCommentSheet_();
  const existing = aiGetExistingKeys_(commentsSheet);
  const batch = rows.slice(startIndex, startIndex + AI_BATCH_SIZE);
  let created = 0, skipped = 0;
  const issues = [];

  batch.forEach(function (student) {
    const key = [student.id, className, academicYear].join('|');
    if (existing[key]) { skipped++; return; }
    try {
      const annual = aiCalculateAnnualStudent_(classSheet, className, student);
      if (!annual.complete) {
        skipped++;
        issues.push({ studentId: student.id, studentName: student.name, reason: 'Missing or invalid scores', missing: annual.missing.slice(0, 12) });
        return;
      }
      const comment = aiRequestAnnualComment_(apiKey, model, {
        studentName: student.name, className: className, academicYear: academicYear,
        annualAverage: annual.annualAverage, subjectResults: annual.subjectResults
      });
      const commentId = Utilities.getUuid();
      commentsSheet.appendRow([
        commentId, student.id, student.name, className, academicYear,
        annual.annualAverage, comment.academicSummary, comment.strengths,
        comment.areasToImprove, comment.recommendedActions,
        'Draft', new Date(), '', ''
      ]);
      existing[key] = true;
      created++;
    } catch (err) {
      issues.push({ studentId: student.id, studentName: student.name, reason: String(err && err.message ? err.message : err) });
    }
  });

  logAudit(admin.email, 'generateAnnualAIComments', {
    className: className, academicYear: academicYear, startIndex: startIndex,
    processed: batch.length, created: created, skipped: skipped
  });
  const nextStartIndex = startIndex + batch.length;
  return {
    className: className, academicYear: academicYear,
    processed: batch.length, created: created, skipped: skipped,
    totalStudents: rows.length, done: nextStartIndex >= rows.length,
    nextStartIndex: nextStartIndex >= rows.length ? null : nextStartIndex,
    issues: issues
  };
}

function aiCalculateAnnualStudent_(sheet, className, student) {
  const subjects = subjectsForClass(className);
  const cellsPerTerm = subjects.length * FIELDS.length;
  const allValues = sheet.getRange(student.row, 3, 1, cellsPerTerm * TERMS.length).getValues()[0];
  const subjectResults = [];
  const missing = [];
  let allSubjectAnnualAverages = 0;

  subjects.forEach(function (subject, sIdx) {
    const termTotals = [];
    TERMS.forEach(function (term, tIdx) {
      const base = tIdx * cellsPerTerm + sIdx * FIELDS.length;
      const labels = ['T1', 'T2', 'T3', 'Exam'];
      const limits = [10, 10, 10, 70];
      const scores = [];
      for (let f = 0; f < FIELDS.length; f++) {
        const raw = allValues[base + f];
        const blank = raw === '' || raw === null || raw === undefined;
        const value = blank ? NaN : Number(raw);
        if (blank || !isFinite(value) || value < 0 || value > limits[f]) {
          missing.push({ subject: subject, term: term, field: labels[f] });
        } else {
          scores.push(value);
        }
      }
      if (scores.length === 4) termTotals.push(scores.reduce(function (a, b) { return a + b; }, 0));
      else termTotals.push(null);
    });

    if (termTotals.every(function (v) { return v !== null; })) {
      const annualSubjectAverage = Math.round(((termTotals[0] + termTotals[1] + termTotals[2]) / 3) * 100) / 100;
      allSubjectAnnualAverages += annualSubjectAverage;
      subjectResults.push({
        subject: subject, term1: termTotals[0], term2: termTotals[1], term3: termTotals[2],
        annualAverage: annualSubjectAverage
      });
    }
  });

  const complete = missing.length === 0 && subjectResults.length === subjects.length;
  return {
    complete: complete, missing: missing,
    annualAverage: complete ? Math.round((allSubjectAnnualAverages / subjects.length) * 100) / 100 : null,
    subjectResults: subjectResults
  };
}

function aiRequestAnnualComment_(apiKey, model, data) {
  const prompt = [
    'You are assisting a school administrator to draft an annual academic report comment.',
    'Use only the student academic data supplied. Do not invent attendance, behaviour, personality, family circumstances, or activities.',
    'Be professional, constructive, specific, respectful, and suitable for a Nigerian secondary school report.',
    'Use the subject results to identify genuine academic strengths and areas needing improvement.',
    'Do not make claims unsupported by the scores. Avoid predicting future grades.',
    'Return valid JSON with exactly these string fields: academicSummary, strengths, areasToImprove, recommendedActions.',
    'Keep each field concise (1–3 sentences). Do not include markdown fences.',
    'Student data: ' + JSON.stringify(data)
  ].join('\n\n');

  const outputText = geminiGenerateText_(prompt, 700, true, apiKey, model);
  let obj;
  try {
    obj = JSON.parse(outputText.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, ''));
  } catch (err) {
    throw new Error('Gemini returned invalid JSON for the annual comment.');
  }
  const required = ['academicSummary', 'strengths', 'areasToImprove', 'recommendedActions'];
  required.forEach(function (key) {
    if (typeof obj[key] !== 'string' || !obj[key].trim()) {
      throw new Error('Gemini response is missing ' + key + '.');
    }
  });
  return obj;
}

function getAICommentDrafts(p, token) {
  requireRole(token, ['admin']);
  const sheet = aiGetCommentSheet_();
  const last = sheet.getLastRow();
  if (last < 2) return [];
  let rows = sheet.getRange(2, 1, last - 1, AI_COMMENT_HEADERS.length).getValues().map(function (r) {
    return {
      commentId: r[0], studentId: r[1], studentName: r[2], className: r[3],
      academicYear: r[4], annualAverage: r[5], academicSummary: r[6],
      strengths: r[7], areasToImprove: r[8], recommendedActions: r[9],
      approvalStatus: r[10], generatedAt: r[11], approvedBy: r[12], approvedAt: r[13]
    };
  });
  if (p.className) rows = rows.filter(function (r) { return r.className === p.className; });
  if (p.academicYear) rows = rows.filter(function (r) { return r.academicYear === p.academicYear; });
  if (p.status) rows = rows.filter(function (r) { return r.approvalStatus === p.status; });
  return rows;
}

function approveAIComment(p, token) {
  const admin = requireRole(token, ['admin']);
  const commentId = String(p.commentId || '').trim();
  if (!commentId) throw new Error('commentId is required.');
  const sheet = aiGetCommentSheet_();
  const last = sheet.getLastRow();
  if (last < 2) throw new Error('No AI comments are available.');
  const ids = sheet.getRange(2, 1, last - 1, 1).getValues();
  for (let i = 0; i < ids.length; i++) {
    if (String(ids[i][0]) === commentId) {
      const row = i + 2;
      const status = String(sheet.getRange(row, 11).getValue());
      if (status === 'Approved') throw new Error('This comment is already approved.');
      sheet.getRange(row, 11, 1, 4).setValues([['Approved', sheet.getRange(row, 12).getValue(), admin.email, new Date()]]);
      logAudit(admin.email, 'approveAIComment', { commentId: commentId });
      return { success: true, commentId: commentId, status: 'Approved' };
    }
  }
  throw new Error('AI comment not found.');
}

function createAICommentsTab() {
  const result = setupAICommentsSheet();
  Logger.log(result);
  try { SpreadsheetApp.getUi().alert(result); } catch (e) {}
  return result;
}

/* ============================================================
   PARENT PORTAL
   ============================================================ */
const PARENT_ACCOUNT_HEADERS_ = ['email','name','password','active','created_at','created_by'];
const PARENT_ACCOUNT_HEADERS_OLD_ = ['email','name','salt','password_hash','active','created_at','created_by'];
const PARENT_LINK_HEADERS_ = ['parent_email','student_id','class','relationship','active','created_at','created_by'];
const REPORT_TEMPLATE_HEADERS_ = ['key','value','updated_at','updated_by'];
const PUBLICATION_HEADERS_ = ['student_id','class','term','academic_year','published','published_at','published_by'];

function setupParentPortalSheets_() {
  const ss = openSS();

  let pa = ss.getSheetByName('ParentAccounts');
  if (!pa) {
    pa = ss.insertSheet('ParentAccounts');
    pa.getRange(1, 1, 1, PARENT_ACCOUNT_HEADERS_.length).setValues([PARENT_ACCOUNT_HEADERS_]);
  } else {
    const current = pa.getRange(1, 1, 1, PARENT_ACCOUNT_HEADERS_OLD_.length).getValues()[0];
    const isOld = PARENT_ACCOUNT_HEADERS_OLD_.every(function (h, i) { return current[i] === h; });
    const isNew = PARENT_ACCOUNT_HEADERS_.every(function (h, i) { return current[i] === h; });
    if (!isNew && isOld && pa.getLastRow() >= 2) {
      const data = pa.getRange(2, 1, pa.getLastRow() - 1, PARENT_ACCOUNT_HEADERS_OLD_.length).getValues();
      const rows = data.map(function (r) { return [r[0], r[1], r[3] || '', r[4], r[5], r[6]]; });
      pa.getRange(1, 1, 1, PARENT_ACCOUNT_HEADERS_.length).setValues([PARENT_ACCOUNT_HEADERS_]);
      pa.getRange(2, 1, rows.length, PARENT_ACCOUNT_HEADERS_.length).setValues(rows);
      if (pa.getMaxColumns() > PARENT_ACCOUNT_HEADERS_.length) {
        pa.deleteColumns(PARENT_ACCOUNT_HEADERS_.length + 1, pa.getMaxColumns() - PARENT_ACCOUNT_HEADERS_.length);
      }
      logAudit('system', 'parentAccountsMigrated', { rows: rows.length });
    } else if (!isNew && !isOld && pa.getLastRow() === 0) {
      pa.getRange(1, 1, 1, PARENT_ACCOUNT_HEADERS_.length).setValues([PARENT_ACCOUNT_HEADERS_]);
    }
  }

  [
    ['ParentLinks', PARENT_LINK_HEADERS_],
    ['ReportTemplate', REPORT_TEMPLATE_HEADERS_],
    ['ResultPublication', PUBLICATION_HEADERS_]
  ].forEach(function (pair) {
    let sh = ss.getSheetByName(pair[0]);
    if (!sh) sh = ss.insertSheet(pair[0]);
    ensureHeaders(sh, pair[1], null, pair[0]);
  });

  const template = ss.getSheetByName('ReportTemplate');
  if (template.getLastRow() < 2) {
    const defaults = {
      schoolName: 'Greater Tomorrow Model Schools',
      schoolMotto: 'Jesus, our Teacher',
      logoUrl: '',
      primaryColor: '#17365D',
      secondaryColor: '#FFFFFF',
      showTests: true, showExam: true, showSubjectTotals: true,
      showGrade: true, showTeacherRemark: true, showPrincipalRemark: true,
      showAttendance: true, showAIComment: true, showAnnualAverage: true,
      showAffective: true, showPsychomotor: true, showTermDates: true,
      principalName: 'The Principal',
      principalSignatureUrl: '',
      schoolStampUrl: '',
      gradeScale: [
        {min: 80, max: 100, grade: 'A', remark: 'Excellent'},
        {min: 70, max: 79.99, grade: 'B', remark: 'Very Good'},
        {min: 60, max: 69.99, grade: 'C', remark: 'Good'},
        {min: 50, max: 59.99, grade: 'D', remark: 'Credit'},
        {min: 40, max: 49.99, grade: 'E', remark: 'Pass'},
        {min: 0, max: 39.99, grade: 'F', remark: 'Needs Improvement'}
      ]
    };
    template.appendRow(['config', JSON.stringify(defaults), new Date(), 'system']);
  }
}

function parentLogin(email, password) {
  if (!email || !password) throw new Error('Email and password are required.');
  const normalized = String(email).trim().toLowerCase();
  const sh = getSheet('ParentAccounts');
  const rows = sh.getDataRange().getValues();
  let account = null;
  for (let i = 1; i < rows.length; i++) {
    if (String(rows[i][0]).trim().toLowerCase() === normalized && rows[i][3] === true) {
      account = { email: rows[i][0], name: rows[i][1], password: String(rows[i][2] || '') };
      break;
    }
  }
  if (!account || !gtmcPasswordMatches_(password,account.password)) throw new Error('Invalid parent login details.');
  if (String(account.password || '').indexOf('sha256$') !== 0) gtmcStorePassword_('ParentAccounts','email',account.email,'password',password);
  const token = Utilities.getUuid();
  const session = { email: account.email, name: account.name, role: 'parent' };
  CacheService.getScriptCache().put('sess_' + token, JSON.stringify(session), SESSION_SECONDS);
  logAudit(account.email, 'parentLogin', {});
  return { token: token, user: session };
}

function adminCreateParent(p, token) {
  const admin = requireRole(token, ['admin']);
  const email = String(p.email || '').trim().toLowerCase();
  const name = String(p.name || '').trim();
  const password = String(p.password || '');
  if (!email || !name || password.length < 6) {
    throw new Error('Provide parent name, email, and a password of at least 6 characters.');
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Enter a valid email address.');
  const sh = getSheet('ParentAccounts');
  const data = sh.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]).toLowerCase() === email) throw new Error('A parent account with this email already exists.');
  }
  sh.appendRow([email, name, gtmcPasswordHash_(password), true, new Date(), admin.email]);
  logAudit(admin.email, 'adminCreateParent', { parentEmail: email });
  return { success: true, email: email, message: 'Parent account created. Link the student/ward before sharing login details.' };
}

function adminGetParentAccounts(p, token) {
  requireRole(token, ['admin']);
  const accounts = sheetToObjects(getSheet('ParentAccounts')).map(function (a) {
    return { email: a.email, name: a.name, active: a.active === true || String(a.active).toLowerCase()==='true' };
  });
  const links = sheetToObjects(getSheet('ParentLinks')).filter(function (x) { return x.active === true; });
  return accounts.map(function (a) {
    return Object.assign(a, {
      wards: links.filter(function (l) {
        return String(l.parent_email).toLowerCase() === String(a.email).toLowerCase();
      }).map(function (l) {
        return { studentId: String(l.student_id), className: l.class, relationship: l.relationship };
      })
    });
  });
}

function adminLinkWard(p, token) {
  const admin = requireRole(token, ['admin']);
  const email = String(p.email || '').trim().toLowerCase();
  const studentId = String(p.studentId || '').trim();
  const className = String(p.className || '').trim();
  const relationship = String(p.relationship || 'Parent').trim();
  if (!email || !studentId || !className) throw new Error('Parent email, student ID and class are required.');
  if (CLASSES.indexOf(className) < 0) throw new Error('Unknown class.');
  const account = sheetToObjects(getSheet('ParentAccounts')).find(function (a) {
    return String(a.email).toLowerCase() === email && a.active === true;
  });
  if (!account) throw new Error('Active parent account not found.');
  if (!portalFindStudent_(className, studentId)) throw new Error('Student ID was not found in the selected class.');
  const sh = getSheet('ParentLinks');
  const rows = sh.getDataRange().getValues();
  for (let i = 1; i < rows.length; i++) {
    if (String(rows[i][0]).toLowerCase() === email && String(rows[i][1]) === studentId && String(rows[i][2]) === className) {
      sh.getRange(i + 1, 4, 1, 2).setValues([[relationship, true]]);
      logAudit(admin.email, 'adminLinkWard', { email: email, studentId: studentId, className: className });
      return { success: true, message: 'Ward link updated.' };
    }
  }
  sh.appendRow([email, studentId, className, relationship, true, new Date(), admin.email]);
  logAudit(admin.email, 'adminLinkWard', { email: email, studentId: studentId, className: className });
  return { success: true, message: 'Ward linked to parent account.' };
}

function adminUnlinkWard(p, token) {
  const admin = requireRole(token, ['admin']);
  const email = String(p.email || '').trim().toLowerCase();
  const studentId = String(p.studentId || '').trim();
  const className = String(p.className || '').trim();
  const sh = getSheet('ParentLinks');
  const rows = sh.getDataRange().getValues();
  let changed = 0;
  for (let i = 1; i < rows.length; i++) {
    if (String(rows[i][0]).toLowerCase() === email && String(rows[i][1]) === studentId && String(rows[i][2]) === className && rows[i][4] === true) {
      sh.getRange(i + 1, 5).setValue(false); changed++;
    }
  }
  logAudit(admin.email, 'adminUnlinkWard', { email: email, studentId: studentId, className: className });
  return { success: true, changed: changed };
}

function parentGetWards(token) {
  const parent = requireRole(token, ['parent']);
  return sheetToObjects(getSheet('ParentLinks'))
    .filter(function (l) {
      return String(l.parent_email).toLowerCase() === String(parent.email).toLowerCase() && l.active === true;
    })
    .map(function (l) {
      const student = portalFindStudent_(String(l.class), String(l.student_id));
      return student ? { studentId: String(l.student_id), studentName: student.name, className: String(l.class), relationship: l.relationship } : null;
    }).filter(Boolean);
}

function portalFindStudent_(className, studentId) {
  if (CLASSES.indexOf(className) < 0) throw new Error('Unknown class.');
  const sh = getSheet(className);
  const last = sh.getLastRow();
  if (last < 4) return null;
  const data = sh.getRange(4, 1, last - 3, 2).getValues();
  for (let i = 0; i < data.length; i++) {
    if (String(data[i][0]) === String(studentId)) {
      return { row: i + 4, studentId: String(data[i][0]), name: String(data[i][1]), className: className };
    }
  }
  return null;
}

function portalAssertLinkedParent_(parent, className, studentId) {
  const links = sheetToObjects(getSheet('ParentLinks'));
  const ok = links.some(function (l) {
    return String(l.parent_email).toLowerCase() === String(parent.email).toLowerCase() &&
           String(l.student_id) === String(studentId) && String(l.class) === String(className) && l.active === true;
  });
  if (!ok) throw new Error('You are not authorised to view this student.');
}

function portalIsPublished_(studentId, className, term, academicYear) {
  const rows = sheetToObjects(getSheet('ResultPublication'));
  return rows.some(function (r) {
    return String(r.student_id) === String(studentId) && String(r.class) === String(className) &&
           String(r.term) === String(term) && String(r.academic_year) === String(academicYear) && r.published === true;
  });
}

function createParentResultNotifications_(studentId, className, term, academicYear, createdBy) {
  const links = sheetToObjects(getSheet('ParentLinks')).filter(function (r) {
    return String(r.student_id) === String(studentId) && String(r.class) === String(className) && (r.active === true || String(r.active).toLowerCase() === 'true');
  });
  const seen = {};
  links.forEach(function (r) {
    const email = String(r.parent_email || '').trim().toLowerCase();
    if (!email || seen[email]) return;
    seen[email] = true;
    createNotification_(email, '', 'Result published', 'A result is now available for ' + className + ' (' + term + ', ' + academicYear + ').', 'result_published', 'result:' + className + ':' + studentId + ':' + term + ':' + academicYear, createdBy);
  });
}

function adminPublishResult(p, token) {
  const admin = requireRole(token, ['admin']);
  const studentId = String(p.studentId || '').trim();
  const className = String(p.className || '').trim();
  const term = String(p.term || '').trim();
  const academicYear = String(p.academicYear || '').trim();
  if (!studentId || !className || !term || !academicYear) throw new Error('studentId, className, term and academicYear are required.');
  if (CLASSES.indexOf(className) < 0 || TERMS.indexOf(term) < 0) throw new Error('Invalid class or term.');
  if (!portalFindStudent_(className, studentId)) throw new Error('Student not found in class.');
  const sh = getSheet('ResultPublication');
  const rows = sh.getDataRange().getValues();
  for (let i = 1; i < rows.length; i++) {
    if (String(rows[i][0]) === studentId && String(rows[i][1]) === className && String(rows[i][2]) === term && String(rows[i][3]) === academicYear) {
      const wasPublished = rows[i][4] === true;
      sh.getRange(i + 1, 5, 1, 3).setValues([[true, new Date(), admin.email]]);
      if (!wasPublished) createParentResultNotifications_(studentId, className, term, academicYear, admin.email);
      logAudit(admin.email, 'adminPublishResult', { studentId: studentId, className: className, term: term, academicYear: academicYear });
      return { success: true, published: true };
    }
  }
  sh.appendRow([studentId, className, term, academicYear, true, new Date(), admin.email]);
  createParentResultNotifications_(studentId, className, term, academicYear, admin.email);
  logAudit(admin.email, 'adminPublishResult', { studentId: studentId, className: className, term: term, academicYear: academicYear });
  return { success: true, published: true };
}

function adminUnpublishResult(p, token) {
  const admin = requireRole(token, ['admin']);
  const studentId = String(p.studentId || '').trim();
  const className = String(p.className || '').trim();
  const term = String(p.term || '').trim();
  const academicYear = String(p.academicYear || '').trim();
  const sh = getSheet('ResultPublication');
  const rows = sh.getDataRange().getValues();
  let changed = 0;
  for (let i = 1; i < rows.length; i++) {
    if (String(rows[i][0]) === studentId && String(rows[i][1]) === className && String(rows[i][2]) === term && String(rows[i][3]) === academicYear && rows[i][4] === true) {
      sh.getRange(i + 1, 5).setValue(false);
      sh.getRange(i + 1, 6).setValue(new Date());
      sh.getRange(i + 1, 7).setValue(admin.email);
      changed++;
    }
  }
  logAudit(admin.email, 'adminUnpublishResult', { studentId: studentId, className: className, term: term, academicYear: academicYear });
  return { success: true, changed: changed };
}

function adminGetPublicationStatus(p, token) {
  requireRole(token, ['admin']);
  let rows = sheetToObjects(getSheet('ResultPublication'));
  ['className','term','academicYear','studentId'].forEach(function (k) {
    if (p[k]) {
      const col = { className: 'class', term: 'term', academicYear: 'academic_year', studentId: 'student_id' }[k];
      rows = rows.filter(function (r) { return String(r[col]) === String(p[k]); });
    }
  });
  return rows.map(function (r) {
    return {
      studentId: String(r.student_id), className: r.class, term: r.term,
      academicYear: r.academic_year, published: r.published === true,
      publishedAt: r.published_at, publishedBy: r.published_by
    };
  });
}

function adminPublishClass(p, token) {
  const admin = requireRole(token, ['admin']);
  const className = String(p.className || '').trim();
  const term = String(p.term || '').trim();
  const academicYear = String(p.academicYear || '').trim();
  if (!className || !term || !academicYear) throw new Error('className, term and academicYear are required.');
  if (CLASSES.indexOf(className) < 0) throw new Error('Invalid class.');
  if (TERMS.indexOf(term) < 0) throw new Error('Invalid term.');

  const classSheet = getSheet(className);
  const last = classSheet.getLastRow();
  if (last < 4) throw new Error('No students in ' + className + '.');
  const students = classSheet.getRange(4, 1, last - 3, 2).getValues()
    .filter(function (r) { return r[0] && r[1]; })
    .map(function (r) { return { id: String(r[0]), name: String(r[1]) }; });
  if (!students.length) throw new Error('No students in ' + className + '.');

  const sheet = getSheet('ResultPublication');
  const rows = sheet.getDataRange().getValues();

  const wantClass = className.toUpperCase();
  const wantTerm = term.toUpperCase();
  const wantYear = academicYear;
  const existing = {};
  for (let i = 1; i < rows.length; i++) {
    const rowClass = String(rows[i][1] || '').trim().toUpperCase();
    const rowTerm = String(rows[i][2] || '').trim().toUpperCase();
    const rowYear = String(rows[i][3] || '').trim();
    if (rowClass !== wantClass) continue;
    if (rowTerm !== wantTerm) continue;
    if (rowYear !== wantYear) continue;
    const sid = String(rows[i][0] || '').trim();
    if (!sid) continue;
    existing[sid] = { row: i + 1, published: rows[i][4] === true };
  }

  const now = new Date();
  let created = 0, updated = 0, already = 0;
  const alreadyListed = [];
  const newlyPublishedIds = [];

  students.forEach(function (st) {
    const hit = existing[st.id];
    if (hit) {
      if (hit.published) { already++; alreadyListed.push(st.id); return; }
      sheet.getRange(hit.row, 5, 1, 3).setValues([[true, now, admin.email]]);
      updated++;
      newlyPublishedIds.push(st.id);
    } else {
      sheet.appendRow([st.id, className, term, academicYear, true, now, admin.email]);
      created++;
      newlyPublishedIds.push(st.id);
    }
  });

  newlyPublishedIds.forEach(function (sid) { createParentResultNotifications_(sid, className, term, academicYear, admin.email); });
  logAudit(admin.email, 'adminPublishClass', {
    className: className, term: term, academicYear: academicYear,
    created: created, updated: updated, already: already, total: students.length
  });
  return {
    success: true, className: className, term: term, academicYear: academicYear,
    total: students.length, created: created, updated: updated, already: already,
    alreadyListed: alreadyListed,
    matchedRows: Object.keys(existing).length
  };
}

function adminUnpublishClass(p, token) {
  const admin = requireRole(token, ['admin']);
  const className = String(p.className || '').trim();
  const term = String(p.term || '').trim();
  const academicYear = String(p.academicYear || '').trim();
  if (!className || !term || !academicYear) throw new Error('className, term and academicYear are required.');

  const classSheet = getSheet(className);
  const last = classSheet.getLastRow();
  if (last < 4) return { success: true, changed: 0 };

  const classIds = classSheet.getRange(4, 1, last - 3, 1).getValues()
    .map(function (r) { return String(r[0] || '').trim(); }).filter(Boolean);
  const idMap = {};
  classIds.forEach(function (id) { idMap[id] = true; });

  const sheet = getSheet('ResultPublication');
  const rows = sheet.getDataRange().getValues();
  const wantClass = className.toUpperCase();
  const wantTerm = term.toUpperCase();
  const wantYear = academicYear;
  let changed = 0;
  for (let i = 1; i < rows.length; i++) {
    const sid = String(rows[i][0] || '').trim();
    if (!idMap[sid]) continue;
    if (String(rows[i][1] || '').trim().toUpperCase() !== wantClass) continue;
    if (String(rows[i][2] || '').trim().toUpperCase() !== wantTerm) continue;
    if (String(rows[i][3] || '').trim() !== wantYear) continue;
    if (rows[i][4] !== true) continue;
    sheet.getRange(i + 1, 5, 1, 3).setValues([[false, new Date(), admin.email]]);
    changed++;
  }
  logAudit(admin.email, 'adminUnpublishClass', {
    className: className, term: term, academicYear: academicYear, changed: changed
  });
  return { success: true, className: className, term: term, academicYear: academicYear, changed: changed };
}

/* ============ DOMAINS ============ */
function domainTermStart_(className, term) {
  const subjects = subjectsForClass(className);
  const tIdx = TERMS.indexOf(term);
  if (tIdx === -1) throw new Error('Bad term: ' + term);
  return 3 + subjects.length * FIELDS.length * TERMS.length + tIdx * DOMAIN_COLS_PER_TERM;
}

function getDomains(p, token) {
  const user = verifyToken(token);
  const className = p.className, term = p.term;
  if (!className || !term) throw new Error('className and term required');
  if (CLASSES.indexOf(className) === -1) throw new Error('Unknown class: ' + className);
  if (TERMS.indexOf(term) === -1) throw new Error('Invalid term');
  if (!hasRole_(user, 'admin') && !hasRole_(user, 'class_teacher')) throw new Error('Permission denied.');
  assertClassTeacherOwnClass_(user, className, 'You can only access your assigned class.');

  const sheet = getSheet(className);
  const lastRow = sheet.getLastRow();
  if (lastRow < 4) return [];

  const idName = sheet.getRange(4, 1, lastRow - 3, 2).getValues();
  const start = domainTermStart_(className, term);
  const vals = sheet.getRange(4, start, lastRow - 3, DOMAIN_COLS_PER_TERM).getValues();

  return idName.map(function (row, i) {
    if (!row[0] || !row[1]) return null;
    return {
      student_id: String(row[0]),
      name: row[1],
      days_opened: vals[i][0] === '' ? null : Number(vals[i][0]),
      days_present: vals[i][1] === '' ? null : Number(vals[i][1]),
      affective: (hasRole_(user, 'admin') || domainVisible_('affective')) ? String(vals[i][2] || '').trim().toUpperCase() : '',
      psychomotor: (hasRole_(user, 'admin') || domainVisible_('psychomotor')) ? String(vals[i][3] || '').trim().toUpperCase() : ''
    };
  }).filter(Boolean);
}

function saveDomainScore(p, token) {
  const user = requireRole(token, ['admin', 'class_teacher']);
  const className = p.className, term = p.term, studentId = p.studentId, field = p.field;
  if (!className || !term || !studentId || !field) throw new Error('className, term, studentId, field required');
  if (CLASSES.indexOf(className) === -1) throw new Error('Unknown class');
  assertClassTeacherOwnClass_(user, className, 'You can only edit your assigned class.');
  if (!hasRole_(user, 'admin') && field === 'affective' && !domainVisible_('affective')) throw new Error('Affective Domain is hidden by the administrator.');
  if (!hasRole_(user, 'admin') && field === 'psychomotor' && !domainVisible_('psychomotor')) throw new Error('Psychomotor Domain is hidden by the administrator.');

  const fIdx = DOMAIN_KEYS.indexOf(field);
  if (fIdx === -1) throw new Error('Unknown field: ' + field);

  let value = p.value;
  if (field === 'affective' || field === 'psychomotor') {
    value = String(value || '').trim().toUpperCase();
    if (value !== '' && DOMAIN_LETTERS.indexOf(value) === -1) throw new Error('Use A, B, C, D or E');
  } else {
    if (value === '' || value === null || value === undefined) value = '';
    else {
      value = Number(value);
      if (!isFinite(value) || value < 0 || value > 500) throw new Error('Days must be 0 or more');
    }
  }

  if (isDomainsLocked_(className, term, user)) throw new Error('Domains locked. Ask admin to unlock.');

  const sheet = getSheet(className);
  const lastRow = sheet.getLastRow();
  if (lastRow < 4) throw new Error('No students in ' + className);
  const ids = sheet.getRange(4, 1, lastRow - 3, 1).getValues();
  let rowIdx = -1;
  for (let i = 0; i < ids.length; i++) {
    if (String(ids[i][0]) === String(studentId)) { rowIdx = 4 + i; break; }
  }
  if (rowIdx === -1) throw new Error('Student not found in ' + className);

  const col = domainTermStart_(className, term) + fIdx;
  const domainCell = sheet.getRange(rowIdx, col);
  const previousValue = domainCell.getValue();
  domainCell.setValue(value);
  if (String(previousValue) !== String(value)) logAudit(user.email, 'saveDomainScore', { className: className, term: term, studentId: String(studentId), field: field, previousValue: previousValue, newValue: value });
  return { success: true };
}

function isDomainsLocked_(className, term, user) {
  if (hasRole_(user, 'admin')) return false;
  const subs = sheetToObjects(getSheet('Submissions'));
  return subs.some(function (s) {
    return s.class === className && s.subject === '__DOMAINS__' && s.term === term &&
           s.teacher_email === user.email && s.status === 'locked';
  });
}

function submitDomains(p, token) {
  const user = requireRole(token, ['class_teacher', 'admin']);
  const className = p.className, term = p.term;
  if (!className || !term) throw new Error('className and term required');
  assertClassTeacherOwnClass_(user, className, 'You can only submit your assigned class.');

  const sheet = getSheet('Submissions');
  const data = sheet.getDataRange().getValues();
  let found = -1;
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === user.email && data[i][1] === className &&
        data[i][2] === '__DOMAINS__' && data[i][3] === term) {
      found = i + 1; break;
    }
  }
  const now = new Date();
  if (found > 0) sheet.getRange(found, 5, 1, 2).setValues([['locked', now]]);
  else sheet.appendRow([user.email, className, '__DOMAINS__', term, 'locked', now]);

  logAudit(user.email, 'submitDomains', { className: className, term: term });
  return { success: true, locked: true };
}

function unlockDomains(p, token) {
  const admin = requireRole(token, ['admin']);
  const email = p.teacherEmail, className = p.className, term = p.term;
  const sheet = getSheet('Submissions');
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === email && data[i][1] === className &&
        data[i][2] === '__DOMAINS__' && data[i][3] === term) {
      sheet.getRange(i + 1, 5, 1, 2).setValues([['unlocked', new Date()]]);
      logAudit(admin.email, 'unlockDomains', { teacherEmail: email, className: className, term: term });
      return { success: true };
    }
  }
  throw new Error('No domain submission found to unlock');
}

/* ============ PRINCIPAL REMARKS ============ */
function autoPrincipalRemark_(overallPercent, gradeScale) {
  if (overallPercent == null) return 'Result pending.';
  const sorted = (Array.isArray(gradeScale) ? gradeScale.slice() : [])
    .sort(function (a, b) { return Number(b.min) - Number(a.min); });
  const band = sorted.find(function (b) { return overallPercent >= Number(b.min); });
  const grade = band ? String(band.grade) : '?';
  const map = {
    A: 'An excellent result. Keep up this outstanding performance.',
    B: 'A very good result. Aim even higher next term.',
    C: 'A good result. There is room for steady improvement.',
    D: 'A fair result. More effort is required.',
    E: 'A pass. Consistent study will improve your performance.',
    F: 'A poor result. Significant and focused improvement is needed.'
  };
  return (map[grade] || 'Result available.') +
    ' (Overall: ' + Math.round(overallPercent * 100) / 100 + '%)';
}

function principalRemarkFor_(studentId, className, term, academicYear) {
  const rows = sheetToObjects(getSheet('PrincipalRemarks'));
  const row = rows.find(function (r) {
    return String(r.student_id) === String(studentId) &&
           String(r.class) === String(className) &&
           String(r.term) === String(term) &&
           String(r.academic_year) === String(academicYear);
  });
  return row ? String(row.remark || '') : '';
}

function computeOverallFor_(className, studentId, term) {
  const sheet = getSheet(className);
  const lastRow = sheet.getLastRow();
  if (lastRow < 4) return null;
  const ids = sheet.getRange(4, 1, lastRow - 3, 1).getValues();
  let rowIdx = -1;
  for (let i = 0; i < ids.length; i++) {
    if (String(ids[i][0]) === String(studentId)) { rowIdx = 4 + i; break; }
  }
  if (rowIdx === -1) return null;

  const subjects = subjectsForClass(className);
  const termStart = 3 + TERMS.indexOf(term) * subjects.length * FIELDS.length;
  const vals = sheet.getRange(rowIdx, termStart, 1, subjects.length * FIELDS.length).getValues()[0];

  const totals = [];
  for (let i = 0; i < subjects.length; i++) {
    const base = i * FIELDS.length;
    const nums = vals.slice(base, base + FIELDS.length).map(function (v) {
      return v === '' || v === null ? null : Number(v);
    });
    if (nums.every(function (n) { return n !== null && isFinite(n); })) {
      totals.push(nums.reduce(function (a, b) { return a + b; }, 0));
    }
  }
  if (!totals.length) return null;
  return Math.round(totals.reduce(function (a, b) { return a + b; }, 0) / totals.length * 100) / 100;
}

function adminPreviewPrincipalRemark(p, token) {
  requireRole(token, ['admin', 'class_teacher']);
  const className = String(p.className || '').trim();
  const studentId = String(p.studentId || '').trim();
  const term = String(p.term || '').trim();
  const academicYear = String(p.academicYear || '').trim();
  if (!className || !studentId || !term || !academicYear) throw new Error('className, studentId, term, academicYear required.');

  const overallPercent = computeOverallFor_(className, studentId, term);
  const override = principalRemarkFor_(studentId, className, term, academicYear);
  const template = portalGetTemplate_();
  const auto = autoPrincipalRemark_(overallPercent, template.gradeScale);

  return {
    studentId: studentId, className: className, term: term, academicYear: academicYear,
    overallPercent: overallPercent,
    autoRemark: auto, overrideRemark: override,
    remark: override || auto,
    source: override ? 'override' : (overallPercent == null ? 'none' : 'auto')
  };
}

function adminSetPrincipalRemark(p, token) {
  const admin = requireRole(token, ['admin']);
  const className = String(p.className || '').trim();
  const studentId = String(p.studentId || '').trim();
  const term = String(p.term || '').trim();
  const academicYear = String(p.academicYear || '').trim();
  const remark = String(p.remark || '').trim();
  if (!className || !studentId || !term || !academicYear) throw new Error('className, studentId, term, academicYear required.');
  if (CLASSES.indexOf(className) < 0) throw new Error('Invalid class.');
  if (TERMS.indexOf(term) < 0) throw new Error('Invalid term.');

  const sh = getSheet('PrincipalRemarks');
  const data = sh.getDataRange().getValues();
  let rowNum = -1;
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]) === studentId && String(data[i][1]) === className &&
        String(data[i][2]) === term && String(data[i][3]) === academicYear) { rowNum = i + 1; break; }
  }

  if (remark === '') {
    if (rowNum > 0) { sh.deleteRow(rowNum); logAudit(admin.email, 'adminSetPrincipalRemark', { studentId: studentId, action: 'cleared' }); }
    return { success: true, studentId: studentId, cleared: true };
  }

  const values = [studentId, className, term, academicYear, remark, new Date(), admin.email];
  if (rowNum > 0) sh.getRange(rowNum, 1, 1, values.length).setValues([values]);
  else sh.appendRow(values);
  logAudit(admin.email, 'adminSetPrincipalRemark', { studentId: studentId, action: 'set' });
  return { success: true, studentId: studentId, saved: true };
}

function adminGeneratePrincipalRemarksForClass(p, token) {
  const admin = requireRole(token, ['admin']);
  const className = String(p.className || '').trim();
  const term = String(p.term || '').trim();
  const academicYear = String(p.academicYear || '').trim();
  if (!className || !term || !academicYear) throw new Error('className, term, academicYear required.');
  if (CLASSES.indexOf(className) < 0) throw new Error('Invalid class.');
  if (TERMS.indexOf(term) < 0) throw new Error('Invalid term.');

  const classSheet = getSheet(className);
  const last = classSheet.getLastRow();
  if (last < 4) throw new Error('No students in ' + className + '.');
  const students = classSheet.getRange(4, 1, last - 3, 2).getValues()
    .filter(function (r) { return r[0] && r[1]; })
    .map(function (r) { return { id: String(r[0]), name: String(r[1]) }; });
  if (!students.length) throw new Error('No students in ' + className + '.');

  const template = portalGetTemplate_();
  const sh = getSheet('PrincipalRemarks');
  const rows = sh.getDataRange().getValues();
  const existing = {};
  for (let i = 1; i < rows.length; i++) {
    if (String(rows[i][1]) !== className) continue;
    if (String(rows[i][2]) !== term) continue;
    if (String(rows[i][3]) !== academicYear) continue;
    existing[String(rows[i][0])] = true;
  }

  let created = 0, skipped = 0, noScore = 0;
  const now = new Date();
  students.forEach(function (st) {
    if (existing[st.id]) { skipped++; return; }
    const pct = computeOverallFor_(className, st.id, term);
    if (pct == null) { noScore++; return; }
    const remark = autoPrincipalRemark_(pct, template.gradeScale);
    sh.appendRow([st.id, className, term, academicYear, remark, now, admin.email]);
    created++;
  });

  logAudit(admin.email, 'adminGeneratePrincipalRemarksForClass', {
    className: className, term: term, academicYear: academicYear,
    created: created, skipped: skipped, noScore: noScore, total: students.length
  });
  return {
    success: true, className: className, term: term, academicYear: academicYear,
    total: students.length, created: created, skipped: skipped, noScore: noScore
  };
}

/* ============ REPORT TEMPLATE ============ */
function portalGrade_(score, scale) {
  if (!Array.isArray(scale)) return '';
  const item = scale.find(function (g) { return Number(score) >= Number(g.min) && Number(score) <= Number(g.max); });
  return item ? String(item.grade || '') : '';
}

function portalGetTemplate_() {
  const rows = getSheet('ReportTemplate').getDataRange().getValues();
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][0] === 'config') {
      try { return JSON.parse(rows[i][1]); } catch (e) { throw new Error('Report template configuration is invalid JSON.'); }
    }
  }
  return {};
}

function adminGetReportTemplate(token) {
  requireRole(token, ['admin']);
  return portalGetTemplate_();
}

function adminSaveReportTemplate(p, token) {
  const admin = requireRole(token, ['admin']);
  const config = p.template;
  if (!config || typeof config !== 'object' || Array.isArray(config)) throw new Error('template object is required.');
  const allowed = [
    'schoolName','schoolAddress','schoolMotto','logoUrl','primaryColor','secondaryColor',
    'showTests','showExam','showSubjectTotals','showGrade','showTeacherRemark',
    'showPrincipalRemark','showAttendance','showAIComment','showAnnualAverage',
    'showAffective','showPsychomotor','showTermDates',
    'principalName','principalSignatureUrl','schoolStampUrl',
    'gradeScale'
  ];
  const clean = {};
  allowed.forEach(function (k) { if (Object.prototype.hasOwnProperty.call(config, k)) clean[k] = config[k]; });
  if (!clean.schoolName || typeof clean.schoolName !== 'string') throw new Error('schoolName is required.');
  if (clean.logoUrl && !/^https:\/\//i.test(clean.logoUrl)) throw new Error('logoUrl must use HTTPS.');
  if (clean.principalSignatureUrl && !/^https:\/\//i.test(clean.principalSignatureUrl)) throw new Error('principalSignatureUrl must use HTTPS.');
  if (clean.schoolStampUrl && !/^https:\/\//i.test(clean.schoolStampUrl)) throw new Error('schoolStampUrl must use HTTPS.');
  if (clean.gradeScale && (!Array.isArray(clean.gradeScale) || clean.gradeScale.some(function (g) {
    return !isFinite(Number(g.min)) || !isFinite(Number(g.max)) || Number(g.min) > Number(g.max) || !g.grade;
  }))) {
    throw new Error('gradeScale must contain valid min, max and grade values.');
  }
  const sh = getSheet('ReportTemplate');
  const rows = sh.getDataRange().getValues();
  const json = JSON.stringify(clean);
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][0] === 'config') {
      sh.getRange(i + 1, 2, 1, 3).setValues([[json, new Date(), admin.email]]);
      logAudit(admin.email, 'adminSaveReportTemplate', { keys: Object.keys(clean) });
      return { success: true, template: clean };
    }
  }
  sh.appendRow(['config', json, new Date(), admin.email]);
  logAudit(admin.email, 'adminSaveReportTemplate', { keys: Object.keys(clean) });
  return { success: true, template: clean };
}

/* ============================================================
   RANKING ENGINE (v13)
   ============================================================ */

// "JSS1A" -> "JSS1"; "SS3" -> "SS3"
function classBase_(className) {
  return String(className || '').replace(/[A-Z]$/i, '').trim();
}

// All arms sharing the same base, in CLASSES order.
function armsOfClass_(className) {
  const base = classBase_(className);
  return CLASSES.filter(function (c) { return classBase_(c) === base; });
}

// Returns [{ studentId, name, average, position, outOf }] sorted by average desc.
// Only students with a COMPLETE score set for the term are ranked.
function rankClassTerm_(className, term) {
  const sheet = getSheet(className);
  const last = sheet.getLastRow();
  if (last < 4) return [];

  const subjects = subjectsForClass(className);
  if (!subjects.length) return [];

  const tIdx = TERMS.indexOf(term);
  if (tIdx === -1) return [];

  const cellsPerTerm = subjects.length * FIELDS.length;
  const tStartOffset = tIdx * cellsPerTerm;

  // Read only the columns we need: ID, Name, and THIS term's scores
  const termStartCol = 3 + tStartOffset;
  const data = sheet.getRange(4, 1, last - 3, 2 + cellsPerTerm).getValues();
  // But we only want this term's slice → read separately for clarity

  const termData = sheet.getRange(4, termStartCol, last - 3, cellsPerTerm).getValues();
  const idName = sheet.getRange(4, 1, last - 3, 2).getValues();

  const rows = [];
  for (let i = 0; i < idName.length; i++) {
    const id = String(idName[i][0] || '').trim();
    const name = String(idName[i][1] || '').trim();
    if (!id || !name) continue;

    const termScores = termData[i];
    const totals = [];
    let complete = true;
    for (let s = 0; s < subjects.length; s++) {
      const base = s * FIELDS.length;
      const fields = termScores.slice(base, base + FIELDS.length);
      const nums = fields.map(function (v) {
        return (v === '' || v === null || v === undefined) ? null : Number(v);
      });
      if (nums.every(function (n) { return n !== null && isFinite(n); })) {
        totals.push(nums.reduce(function (a, b) { return a + b; }, 0));
      } else {
        complete = false;
      }
    }
    if (!complete || !subjects.length) continue;

    const avg = Math.round(
      totals.reduce(function (a, b) { return a + b; }, 0) / subjects.length * 100
    ) / 100;

    rows.push({ studentId: id, name: name, average: avg });
  }

  rows.sort(function (a, b) { return b.average - a.average; });

  let lastAvg = null, lastPos = 0;
  rows.forEach(function (r, i) {
    if (lastAvg !== null && r.average === lastAvg) {
      r.position = lastPos;
    } else {
      r.position = i + 1;
      lastPos = r.position;
      lastAvg = r.average;
    }
    r.outOf = rows.length;
  });

  return rows;
}

// Combined ranking across all arms of the same base class.
function rankStudent_(studentId, className, term) {
  const armRows = rankClassTerm_(className, term);
  const armHit = armRows.find(function (r) { return r.studentId === String(studentId); });

  const base = classBase_(className);
  const arms = armsOfClass_(className);

  let combined = [];
  arms.forEach(function (arm) {
    const rows = (arm === className) ? armRows : rankClassTerm_(arm, term);
    rows.forEach(function (r) {
      combined.push({ studentId: r.studentId, name: r.name, average: r.average, className: arm });
    });
  });

  combined.sort(function (a, b) { return b.average - a.average; });
  let lastAvg = null, lastPos = 0;
  combined.forEach(function (r, i) {
    if (lastAvg !== null && r.average === lastAvg) {
      r.position = lastPos;
    } else {
      r.position = i + 1;
      lastPos = r.position;
      lastAvg = r.average;
    }
    r.outOf = combined.length;
  });

  const combinedHit = combined.find(function (r) {
    return r.studentId === String(studentId) && r.className === className;
  });

  return {
    arm: armHit ? {
      position: armHit.position,
      outOf: armHit.outOf,
      average: armHit.average,
      armName: className,
      baseName: base
    } : null,
    combined: combinedHit ? {
      position: combinedHit.position,
      outOf: combinedHit.outOf,
      average: combinedHit.average,
      baseName: base,
      arms: arms.length
    } : null,
    classSize: combined.length,
    armSize: armRows.length
  };
}

/* ============ PARENT RESULT (with ranking) ============ */
function parentGetResult(p, token) {
  const parent = requireRole(token, ['parent']);
  const className = String(p.className || '').trim();
  const studentId = String(p.studentId || '').trim();
  const term = String(p.term || '').trim();
  const academicYear = String(p.academicYear || '').trim();
  if (!className || !studentId || !term || !academicYear) throw new Error('className, studentId, term and academicYear are required.');
  portalAssertLinkedParent_(parent, className, studentId);
  if (TERMS.indexOf(term) < 0) throw new Error('Invalid term.');
  if (!portalIsPublished_(studentId, className, term, academicYear)) throw new Error('This result has not been published yet.');
  const student = portalFindStudent_(className, studentId);
  if (!student) throw new Error('Student not found.');
  const sh = getSheet(className);
  const subjects = subjectsForClass(className);
  const template = portalGetTemplate_();

  const cellsPerTerm = subjects.length * FIELDS.length;
  const allValues = sh.getRange(student.row, 3, 1, cellsPerTerm * TERMS.length).getValues()[0];

  function subjectTermTotal(subjIndex, termIndex) {
    const base = termIndex * cellsPerTerm + subjIndex * FIELDS.length;
    const raw = allValues.slice(base, base + FIELDS.length);
    const nums = raw.map(function (v) { return v === '' || v === null ? null : Number(v); });
    if (!nums.every(function (n) { return n !== null && isFinite(n); })) return null;
    return nums.reduce(function (a, b) { return a + b; }, 0);
  }

  const subjectResults = subjects.map(function (subject, i) {
    const t1 = subjectTermTotal(i, 0);
    const t2 = subjectTermTotal(i, 1);
    const t3 = subjectTermTotal(i, 2);

    const presentTerms = [t1, t2, t3].filter(function (v) { return v !== null; });
    const cumulative = presentTerms.length
      ? Math.round(presentTerms.reduce(function (a, b) { return a + b; }, 0) / presentTerms.length * 100) / 100
      : null;

    const tIdx = TERMS.indexOf(term);
    const currentBase = tIdx * cellsPerTerm + i * FIELDS.length;
    const currentRaw = allValues.slice(currentBase, currentBase + FIELDS.length);
    const currentNums = currentRaw.map(function (v) { return v === '' || v === null ? null : Number(v); });
    const currentComplete = currentNums.every(function (n) { return n !== null && isFinite(n); });
    const currentTotal = currentComplete ? currentNums.reduce(function (a, b) { return a + b; }, 0) : null;

    return {
      subject: subject,
      T1: currentRaw[0], T2: currentRaw[1], T3: currentRaw[2], Exam: currentRaw[3],
      total: currentTotal,
      complete: currentComplete,
      grade: currentTotal === null ? '' : portalGrade_(currentTotal, template.gradeScale),
      term1Total: t1,
      term2Total: t2,
      term3Total: t3,
      cumulative: cumulative
    };
  });

  const completeTotals = subjectResults.filter(function (r) { return r.total !== null; });
  const overallAverage = (completeTotals.length === subjectResults.length && subjectResults.length)
    ? Math.round(completeTotals.reduce(function (a, r) { return a + r.total; }, 0) / subjectResults.length * 100) / 100
    : null;

  const domStart = domainTermStart_(className, term);
  const domVals = sh.getRange(student.row, domStart, 1, DOMAIN_COLS_PER_TERM).getValues()[0];
  const domains = {
    days_opened: domVals[0] === '' ? null : Number(domVals[0]),
    days_present: domVals[1] === '' ? null : Number(domVals[1]),
    affective: domainVisible_('affective') ? String(domVals[2] || '').trim().toUpperCase() : '',
    psychomotor: domainVisible_('psychomotor') ? String(domVals[3] || '').trim().toUpperCase() : ''
  };

  const override = principalRemarkFor_(studentId, className, term, academicYear);
  const principalRemark = override || autoPrincipalRemark_(overallAverage, template.gradeScale);

  const affective = getDomainAssessments({
    kind: 'affective', className: className, term: term,
    academicYear: academicYear, studentId: studentId
  }, token);
  const psychomotor = getDomainAssessments({
    kind: 'psychomotor', className: className, term: term,
    academicYear: academicYear, studentId: studentId
  }, token);

  const teacherRow = sheetToObjects(getSheet('TeacherRemarks'))
    .find(function (r) {
      return String(r.student_id) === studentId &&
             String(r.class) === className &&
             String(r.term) === term &&
             String(r.academic_year) === academicYear;
    });
  const teacherRemark = teacherRow ? String(teacherRow.remark || '') : '';

  const calendarRow = sheetToObjects(getSheet('SchoolCalendar'))
    .find(function (r) {
      return String(r.academic_year) === academicYear && String(r.term) === term;
    });
  const calendar = calendarRow ? {
    next_term_begins: String(calendarRow.next_term_begins || ''),
    school_vacates: String(calendarRow.school_vacates || ''),
    days_school_opened: String(calendarRow.days_school_opened || '')
  } : null;

  const debtRows = sheetToObjects(getSheet('Debtors')).filter(function (r) {
    return String(r.student_id) === studentId &&
           String(r.class) === className &&
           String(r.academic_year) === academicYear;
  });
  const debts = debtRows.map(function (r) {
    return { term: String(r.term), amount: Number(r.amount) || 0, note: String(r.note || '') };
  });
  const totalDebt = debts.reduce(function (a, d) { return a + d.amount; }, 0);

  const annRows = sheetToObjects(getSheet('Announcements')).filter(function (r) {
    if (r.active !== true) return false;
    const t = String(r.target_classes || 'ALL').trim();
    if (t !== 'ALL' && t.split(',').map(function (s) { return s.trim(); }).indexOf(className) === -1) return false;
    if (r.expires_at && isFinite(new Date(r.expires_at).getTime()) && new Date(r.expires_at).getTime() < Date.now()) return false;
    return true;
  });
  annRows.sort(function (a, b) { return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime(); });
  const announcements = annRows.map(function (r) {
    return { id: String(r.id || ''), message: String(r.message || ''), createdAt: r.created_at || '' };
  });

  const termsArray = ['Term1','Term2','Term3'];
  const termAverages = { Term1: null, Term2: null, Term3: null };
  let enrolledFrom = null;
  termsArray.forEach(function (t) {
    const pct = computeOverallFor_(className, studentId, t);
    termAverages[t] = pct;
    if (pct !== null && enrolledFrom === null) enrolledFrom = t;
  });
  const presentTerms = termsArray.filter(function (t) { return termAverages[t] !== null; });
  const cumulativeAverage = presentTerms.length
    ? Math.round(presentTerms.reduce(function (a, t) { return a + termAverages[t]; }, 0) / presentTerms.length * 100) / 100
    : null;

  // v13 — ranking
  const ranking = rankStudent_(studentId, className, term);

  return {
    student: { studentId: student.studentId, name: student.name, className: className },
    term: term, academicYear: academicYear,
    subjects: subjectResults,
    overallAverage: overallAverage,
    complete: completeTotals.length === subjectResults.length,
    domains: domains,
    principalRemark: principalRemark,
    affective: domainVisible_('affective') ? affective : null,
    psychomotor: domainVisible_('psychomotor') ? psychomotor : null,
    teacherRemark: teacherRemark,
    daysPresent: domains.days_present,
    calendar: calendar,
    debtTotal: totalDebt,
    announcements: announcements,
    term1Average: termAverages.Term1,
    term2Average: termAverages.Term2,
    term3Average: termAverages.Term3,
    cumulativeAverage: cumulativeAverage,
    enrolledFrom: enrolledFrom,

    // v13 additions
    positionArm: ranking.arm,
    positionClass: ranking.combined,
    classSize: ranking.classSize,
    armSize: ranking.armSize,

    template: template
  };
}

/* ============ ASSESSMENT-LEVEL PUBLICATION ============ */
function assessmentPublicationSheet_() { return getSheet('AssessmentPublication'); }
function assessmentPublicationKey_(r, className, term, year, assessment) {
  return String(r.class || '').trim().toUpperCase() === String(className).trim().toUpperCase() &&
    String(r.term || '').trim().toUpperCase() === String(term).trim().toUpperCase() &&
    String(r.academic_year || '').trim() === String(year).trim() &&
    normalizeAssessment_(r.assessment) === normalizeAssessment_(assessment);
}
function adminGetAssessmentPublication(p, token) {
  requireRole(token, ['admin']);
  const className=String(p.className||'').trim(), term=String(p.term||'').trim(), academicYear=String(p.academicYear||'').trim();
  if(!className||!term||!academicYear) throw new Error('className, term and academicYear are required.');
  const rows=sheetToObjects(assessmentPublicationSheet_()).filter(function(r){return String(r.class).trim().toUpperCase()===className.toUpperCase()&&String(r.term).trim().toUpperCase()===term.toUpperCase()&&String(r.academic_year).trim()===academicYear;});
  const status={}; ['T1','T2','T3','Exam'].forEach(function(a){const found=rows.filter(function(r){return normalizeAssessment_(r.assessment)===a;}).slice(-1)[0];status[a]=!!(found&&(found.published===true||String(found.published).toLowerCase()==='true'));});
  return {className:className,term:term,academicYear:academicYear,assessments:status};
}
function adminSetAssessmentPublication(p, token) {
  const admin=requireRole(token,['admin']);
  const className=String(p.className||'').trim(),term=String(p.term||'').trim(),academicYear=String(p.academicYear||'').trim(),assessment=normalizeAssessment_(p.assessment||''),published=p.published===true||String(p.published).toLowerCase()==='true';
  if(!className||!term||!academicYear||!assessment) throw new Error('className, term, academicYear and assessment are required.');
  if(CLASSES.indexOf(className)<0||TERMS.indexOf(term)<0) throw new Error('Invalid class or term.');
  const sheet=assessmentPublicationSheet_(), rows=sheet.getDataRange().getValues(), now=new Date(); let rowNum=0;
  for(let i=1;i<rows.length;i++) if(String(rows[i][0]).trim().toUpperCase()===className.toUpperCase()&&String(rows[i][1]).trim().toUpperCase()===term.toUpperCase()&&String(rows[i][2]).trim()===academicYear&&normalizeAssessment_(rows[i][3])===assessment){rowNum=i+1;break;}
  const values=[className,term,academicYear,assessment,published,now,admin.email];
  if(rowNum) sheet.getRange(rowNum,1,1,values.length).setValues([values]); else sheet.appendRow(values);
  logAudit(admin.email,published?'publishAssessment':'unpublishAssessment',{className:className,term:term,academicYear:academicYear,assessment:assessment});
  return {success:true,className:className,term:term,academicYear:academicYear,assessment:assessment,published:published};
}

/* ============ PARENT: TEST BREAKDOWN (v13) ============ */
// Single round-trip returning all three published terms for one student.
function parentGetTestBreakdown(p, token) {
  const parent = requireRole(token, ['parent']);
  const className = String(p.className || '').trim();
  const studentId = String(p.studentId || '').trim();
  const academicYear = String(p.academicYear || '').trim();
  if (!className || !studentId || !academicYear) {
    throw new Error('className, studentId and academicYear are required.');
  }
  portalAssertLinkedParent_(parent, className, studentId);
  const student = portalFindStudent_(className, studentId);
  if (!student) throw new Error('Student not found.');

  const sh = getSheet(className);
  const subjects = subjectsForClass(className);
  const template = portalGetTemplate_();
  const cellsPerTerm = subjects.length * FIELDS.length;

  const allValues = sh.getRange(student.row, 3, 1, cellsPerTerm * TERMS.length).getValues()[0];

  function termSubjectSlice(termIndex, subjIndex) {
    const base = termIndex * cellsPerTerm + subjIndex * FIELDS.length;
    return allValues.slice(base, base + FIELDS.length);
  }
  function totalOf(slice) {
    const nums = slice.map(function (v) { return v === '' || v === null ? null : Number(v); });
    if (!nums.every(function (n) { return n !== null && isFinite(n); })) return null;
    return nums.reduce(function (a, b) { return a + b; }, 0);
  }

  const terms = {};
  ['Term1','Term2','Term3'].forEach(function (term, tIdx) {
    const published = portalIsPublished_(studentId, className, term, academicYear);
    const assessmentPubRows = sheetToObjects(assessmentPublicationSheet_()).filter(function(r){return String(r.class).trim().toUpperCase()===className.toUpperCase()&&String(r.term).trim().toUpperCase()===term.toUpperCase()&&String(r.academic_year).trim()===academicYear;});
    const assessmentPublished = {}; ['T1','T2','T3','Exam'].forEach(function(a){const hit=assessmentPubRows.filter(function(r){return normalizeAssessment_(r.assessment)===a;}).slice(-1)[0];assessmentPublished[a]=!!(hit&&(hit.published===true||String(hit.published).toLowerCase()==='true'));});
    if (!Object.keys(assessmentPublished).some(function(a){return assessmentPublished[a];})) { terms[term] = null; return; }

    const subjectRows = subjects.map(function (subject, sIdx) {
      const slice = termSubjectSlice(tIdx, sIdx);
      const total = totalOf(slice);
      return {
        subject: subject,
        T1: assessmentPublished.T1 ? slice[0] : null, T2: assessmentPublished.T2 ? slice[1] : null, T3: assessmentPublished.T3 ? slice[2] : null, Exam: assessmentPublished.Exam ? slice[3] : null,
        total: (assessmentPublished.T1 && assessmentPublished.T2 && assessmentPublished.T3 && assessmentPublished.Exam) ? total : null,
        complete: (assessmentPublished.T1 && assessmentPublished.T2 && assessmentPublished.T3 && assessmentPublished.Exam) && total !== null,
        grade: (assessmentPublished.T1 && assessmentPublished.T2 && assessmentPublished.T3 && assessmentPublished.Exam && total !== null) ? portalGrade_(total, template.gradeScale) : ''
      };
    });

    const completeTotals = subjectRows.filter(function (r) { return r.total !== null; });
    const overallAverage = (completeTotals.length === subjectRows.length && subjectRows.length)
      ? Math.round(completeTotals.reduce(function (a, r) { return a + r.total; }, 0) / subjectRows.length * 100) / 100
      : null;

    const ranking = rankStudent_(studentId, className, term);

    terms[term] = {
      published: true,
      assessmentPublished: assessmentPublished,
      subjects: subjectRows,
      overallAverage: overallAverage,
      complete: completeTotals.length === subjectRows.length,
      positionArm: ranking.arm,
      positionClass: ranking.combined,
      armSize: ranking.armSize,
      classSize: ranking.classSize
    };
  });

  // Year summary per subject: average of available term totals
  const subjectYearSummary = subjects.map(function (subject, sIdx) {
    const totals = [];
    ['Term1','Term2','Term3'].forEach(function (term, tIdx) {
      const pubRows=sheetToObjects(assessmentPublicationSheet_()).filter(function(r){return String(r.class).trim().toUpperCase()===className.toUpperCase()&&String(r.term).trim().toUpperCase()===term.toUpperCase()&&String(r.academic_year).trim()===academicYear;});
      const pubMap={}; ['T1','T2','T3','Exam'].forEach(function(a){const hit=pubRows.filter(function(r){return normalizeAssessment_(r.assessment)===a;}).slice(-1)[0];pubMap[a]=!!(hit&&(hit.published===true||String(hit.published).toLowerCase()==='true'));});
      if (!(pubMap.T1 && pubMap.T2 && pubMap.T3 && pubMap.Exam)) return;
      const slice = termSubjectSlice(tIdx, sIdx);
      const t = totalOf(slice);
      if (t !== null) totals.push(t);
    });
    const average = totals.length
      ? Math.round(totals.reduce(function (a, b) { return a + b; }, 0) / totals.length * 100) / 100
      : null;
    return {
      subject: subject,
      termsWithScores: totals.length,
      yearAverage: average,
      best: totals.length ? Math.max.apply(null, totals) : null,
      weakest: totals.length ? Math.min.apply(null, totals) : null
    };
  });

  return {
    student: { studentId: student.studentId, name: student.name, className: className },
    academicYear: academicYear,
    terms: terms,
    subjectYearSummary: subjectYearSummary,
    gradeScale: template.gradeScale || []
  };
}

/* ============ PARENT AI ============ */
function parentAskResultAI(p, token) {
  const parent = requireRole(token, ['parent']);
  const question = String(p.question || '').trim();
  if (!question || question.length > 1200) throw new Error('Enter a question of up to 1,200 characters.');
  const result = parentGetResult(p, token);
  // Gemini API credentials are read securely from Apps Script Script Properties.

  // Explicit test-level snapshot
  const testSnapshot = result.subjects.map(function (s) {
    return {
      subject: s.subject,
      test1: s.T1, test2: s.T2, test3: s.T3, exam: s.Exam,
      termTotal: s.total,
      grade: s.grade,
      term1Total: s.term1Total, term2Total: s.term2Total, term3Total: s.term3Total,
      cumulative: s.cumulative,
      complete: s.complete
    };
  });

  const prompt = [
    'You are the academic performance assistant for Greater Tomorrow Model Schools.',
    'Answer the parent using ONLY the authorised student result data below.',
    'Do not reveal or speculate about any other student.',
    'The student has THREE continuous assessment tests (T1, T2, T3, each out of 10) and one Exam (out of 70) per subject, per term.',
    'A subject total = T1 + T2 + T3 + Exam (max 100).',
    'When the parent asks about a specific test (e.g. "how did she do in the 2nd test?", "which subject had the lowest exam score?"), answer using the exact T1/T2/T3/Exam values in the data.',
    'When the parent asks about position or ranking, use positionInArm (position within their specific arm, e.g. JSS1A) and positionInClass (position across all arms of the same class, e.g. JSS1). Always state both when relevant. If either is null, it means the student does not yet have complete scores for that term and is not ranked.',
    'If a value is null or missing, say it has not been entered yet — do not invent it.',
    'Explain scores clearly, identify stronger and weaker subjects only when the scores support it, and offer practical, encouraging study suggestions.',
    'Do not invent attendance, conduct, health, family circumstances, teacher opinions, or unpublished results.',
    'If asked for information not present in the data, say it is not available in this result.',
    'Keep the answer respectful, concise, and understandable to a parent. This is guidance, not a formal school decision.',
    '',
    'Parent question: ' + question,
    '',
    'Authorised published result (JSON): ' + JSON.stringify({
      student: result.student,
      term: result.term,
      academicYear: result.academicYear,
      overallAverage: result.overallAverage,
      complete: result.complete,
      term1Average: result.term1Average,
      term2Average: result.term2Average,
      term3Average: result.term3Average,
      cumulativeAverage: result.cumulativeAverage,
      subjects: testSnapshot,
      affective: result.affective,
      psychomotor: result.psychomotor,
      daysOpened: result.domains ? result.domains.days_opened : null,
      daysPresent: result.domains ? result.domains.days_present : null,
      positionInArm: result.positionArm,
      positionInClass: result.positionClass
    }, null, 2)
  ].join('\n');

  const answer = geminiGenerateText_(prompt, 700, false);
  if (!answer || !answer.trim()) throw new Error('Gemini did not return an answer. Please try again.');
  logAudit(parent.email, 'parentAskResultAI', {
    studentId: result.student.studentId, className: result.student.className, term: result.term
  });
  return { answer: answer.trim() };
}

function setupParentPortalSheets() {
  setupParentPortalSheets_();
  try { SpreadsheetApp.getUi().alert('Parent portal tabs are ready.'); } catch (e) {}
  return 'Parent portal tabs are ready.';
}

/* ============================================================
   DOMAIN ASSESSMENTS (v6)
   ============================================================ */
function domainHeaders_(kind) {
  return kind === 'affective' ? AFFECTIVE_ITEMS : PSYCHOMOTOR_ITEMS;
}
function domainSheet_(kind) {
  return getSheet(kind === 'affective' ? 'Affective' : 'Psychomotor');
}

function getDomainAssessments(p, token) {
  const user = verifyToken(token);
  const kind = String(p.kind || '').toLowerCase();
  if (kind !== 'affective' && kind !== 'psychomotor') throw new Error('kind must be affective or psychomotor');
  const className = String(p.className || '').trim();
  const term = String(p.term || '').trim();
  const academicYear = String(p.academicYear || '').trim();
  const studentId = p.studentId ? String(p.studentId).trim() : '';
  if (!className || !term || !academicYear) throw new Error('className, term, academicYear required');
  if (CLASSES.indexOf(className) === -1 || TERMS.indexOf(term) === -1) throw new Error('Invalid class or term.');
  if (hasRole_(user, 'parent')) {
    if (!studentId) throw new Error('Parent access requires a studentId.');
    portalAssertLinkedParent_(user, className, studentId);
  } else if (!hasRole_(user, 'admin') && !hasRole_(user, 'class_teacher')) {
    throw new Error('Permission denied.');
  } else if (hasRole_(user, 'class_teacher') && !hasRole_(user, 'admin')) {
    assertClassTeacherOwnClass_(user, className, 'You can only access your assigned class.');
  }
  if (!domainVisible_(kind) && !hasRole_(user, 'admin')) return studentId ? null : [];

  const sheet = domainSheet_(kind);
  const rows = sheetToObjects(sheet);
  const items = domainHeaders_(kind);

  const filtered = rows.filter(function (r) {
    if (String(r.class) !== className) return false;
    if (String(r.term) !== term) return false;
    if (String(r.academic_year) !== academicYear) return false;
    if (studentId && String(r.student_id) !== studentId) return false;
    return true;
  });

  const mapped = filtered.map(function (r) {
    const out = { student_id: String(r.student_id), class: r.class, term: r.term, academic_year: r.academic_year };
    items.forEach(function (pair) {
      const key = pair[0];
      const raw = r[key];
      const n = raw === '' || raw === null || raw === undefined ? null : Number(raw);
      out[key] = (n !== null && n >= 1 && n <= 5) ? n : null;
    });
    return out;
  });

  return studentId ? (mapped[0] || null) : mapped;
}

function saveDomainAssessment(p, token) {
  const user = requireRole(token, ['admin', 'class_teacher']);
  const kind = String(p.kind || '').toLowerCase();
  if (kind !== 'affective' && kind !== 'psychomotor') throw new Error('kind must be affective or psychomotor');
  const className = String(p.className || '').trim();
  const term = String(p.term || '').trim();
  const academicYear = String(p.academicYear || '').trim();
  const studentId = String(p.studentId || '').trim();
  const item = String(p.item || '').trim();
  if (!className || !term || !academicYear || !studentId || !item) {
    throw new Error('className, term, academicYear, studentId, item required');
  }
  if (CLASSES.indexOf(className) === -1) throw new Error('Unknown class: ' + className);
  if (TERMS.indexOf(term) === -1) throw new Error('Unknown term: ' + term);
  assertClassTeacherOwnClass_(user, className, 'You can only edit your assigned class.');
  if (!hasRole_(user, 'admin') && !domainVisible_(kind)) throw new Error(kind + ' domain is hidden by the administrator.');

  const items = domainHeaders_(kind);
  if (!items.some(function (pair) { return pair[0] === item; })) throw new Error('Unknown item: ' + item);

  let value = p.value;
  if (value === '' || value === null || value === undefined) value = '';
  else {
    value = Number(value);
    if (!Number.isFinite(value) || value < 1 || value > 5) throw new Error('Rating must be 1–5');
  }

  const sheet = domainSheet_(kind);
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const colOf = {};
  headers.forEach(function (h, i) { colOf[String(h)] = i; });

  let rowNum = -1;
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]) === studentId &&
        String(data[i][1]) === className &&
        String(data[i][2]) === term &&
        String(data[i][3]) === academicYear) { rowNum = i + 1; break; }
  }

  let previousValue = '';
  if (rowNum > 0 && colOf[item] !== undefined) previousValue = data[rowNum - 1][colOf[item]];
  if (rowNum === -1) {
    const newRow = new Array(headers.length).fill('');
    newRow[colOf['student_id']] = studentId;
    newRow[colOf['class']] = className;
    newRow[colOf['term']] = term;
    newRow[colOf['academic_year']] = academicYear;
    newRow[colOf[item]] = value;
    newRow[colOf['updated_at']] = new Date();
    newRow[colOf['updated_by']] = user.email;
    sheet.appendRow(newRow);
  } else {
    sheet.getRange(rowNum, colOf[item] + 1).setValue(value);
    sheet.getRange(rowNum, colOf['updated_at'] + 1).setValue(new Date());
    sheet.getRange(rowNum, colOf['updated_by'] + 1).setValue(user.email);
  }

  logAudit(user.email, 'saveDomainAssessment', {
    kind: kind, className: className, term: term, academicYear: academicYear,
    studentId: studentId, item: item, previousValue: previousValue, newValue: value
  });
  return { success: true };
}

/* ============================================================
   v7: SCHOOL CALENDAR + TEACHER REMARKS
   ============================================================ */
function adminGetSchoolCalendar(p, token) {
  requireRole(token, ['admin', 'class_teacher', 'subject_teacher']);
  let rows = sheetToObjects(getSheet('SchoolCalendar'));
  if (p.academicYear) rows = rows.filter(function (r) { return String(r.academic_year) === String(p.academicYear); });
  if (p.term)         rows = rows.filter(function (r) { return String(r.term) === String(p.term); });
  return rows;
}

function adminSaveSchoolCalendar(p, token) {
  const admin = requireRole(token, ['admin']);
  const academicYear = String(p.academicYear || '').trim();
  const term = String(p.term || '').trim();
  const nextTermBegins = String(p.nextTermBegins || '').trim();
  const schoolVacates = String(p.schoolVacates || '').trim();
  const daysSchoolOpened = String(p.daysSchoolOpened || '').trim();
  if (!academicYear || !term) throw new Error('academicYear and term are required.');
  const sh = getSheet('SchoolCalendar');
  const data = sh.getDataRange().getValues();
  const headers = data[0];
  let rowNum = -1;
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]) === academicYear && String(data[i][1]) === term) { rowNum = i + 1; break; }
  }
  const values = [academicYear, term, nextTermBegins, schoolVacates, daysSchoolOpened, new Date(), admin.email];
  if (rowNum > 0) sh.getRange(rowNum, 1, 1, headers.length).setValues([values]);
  else sh.appendRow(values);
  logAudit(admin.email, 'adminSaveSchoolCalendar', { academicYear: academicYear, term: term });
  return { success: true };
}

function adminGetTeacherRemarks(p, token) {
  requireRole(token, ['admin', 'class_teacher']);
  const className = String(p.className || '').trim();
  const term = String(p.term || '').trim();
  const academicYear = String(p.academicYear || '').trim();
  if (!className || !term || !academicYear) throw new Error('className, term, academicYear required.');
  return sheetToObjects(getSheet('TeacherRemarks')).filter(function (r) {
    return String(r.class) === className &&
           String(r.term) === term &&
           String(r.academic_year) === academicYear;
  });
}

function adminSaveTeacherRemark(p, token) {
  const user = requireRole(token, ['admin', 'class_teacher']);
  const studentId = String(p.studentId || '').trim();
  const className = String(p.className || '').trim();
  const term = String(p.term || '').trim();
  const academicYear = String(p.academicYear || '').trim();
  const remark = String(p.remark || '');
  if (!studentId || !className || !term || !academicYear) throw new Error('Missing fields.');
  assertClassTeacherOwnClass_(user, className, 'You can only edit remarks for your assigned class.');
  const sh = getSheet('TeacherRemarks');
  const data = sh.getDataRange().getValues();
  const headers = data[0];
  let rowNum = -1;
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]) === studentId &&
        String(data[i][1]) === className &&
        String(data[i][2]) === term &&
        String(data[i][3]) === academicYear) { rowNum = i + 1; break; }
  }
  const values = [studentId, className, term, academicYear, remark, new Date(), user.email];
  if (rowNum > 0) sh.getRange(rowNum, 1, 1, headers.length).setValues([values]);
  else sh.appendRow(values);
  logAudit(user.email, 'adminSaveTeacherRemark', { studentId: studentId, className: className, term: term });
  return { success: true };
}

/* ============================================================
   v8: DEBTORS
   ============================================================ */
function adminGetDebts(p, token) {
  requireRole(token, ['admin']);
  let rows = sheetToObjects(getSheet('Debtors'));
  if (p.className)    rows = rows.filter(function (r) { return String(r.class) === String(p.className); });
  if (p.studentId)    rows = rows.filter(function (r) { return String(r.student_id) === String(p.studentId); });
  if (p.academicYear) rows = rows.filter(function (r) { return String(r.academic_year) === String(p.academicYear); });
  return rows.map(function (r) {
    return {
      studentId: String(r.student_id),
      className: String(r.class),
      academicYear: String(r.academic_year),
      term: String(r.term),
      amount: r.amount === '' ? 0 : Number(r.amount),
      note: String(r.note || ''),
      updatedAt: r.updated_at,
      updatedBy: String(r.updated_by || '')
    };
  });
}

function adminSaveDebt(p, token) {
  const admin = requireRole(token, ['admin']);
  const studentId = String(p.studentId || '').trim();
  const className = String(p.className || '').trim();
  const academicYear = String(p.academicYear || '').trim();
  const term = String(p.term || '').trim();
  let amount = p.amount;
  if (amount === '' || amount === null || amount === undefined) amount = 0;
  else amount = Number(amount);
  const note = String(p.note || '').trim();

  if (!studentId || !className || !academicYear) throw new Error('studentId, className, academicYear required.');
  if (CLASSES.indexOf(className) < 0) throw new Error('Invalid class.');
  if (!isFinite(amount) || amount < 0) throw new Error('Amount must be zero or a positive number.');

  const sh = getSheet('Debtors');
  const data = sh.getDataRange().getValues();
  const headers = data[0];
  let rowNum = -1;
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]) === studentId &&
        String(data[i][1]) === className &&
        String(data[i][2]) === academicYear &&
        String(data[i][3]) === term) { rowNum = i + 1; break; }
  }

  if (amount === 0 && note === '' && rowNum > 0) {
    sh.deleteRow(rowNum);
    logAudit(admin.email, 'adminSaveDebt', { studentId: studentId, action: 'cleared' });
    return { success: true, cleared: true };
  }

  const values = [studentId, className, academicYear, term, amount, note, new Date(), admin.email];
  if (rowNum > 0) sh.getRange(rowNum, 1, 1, headers.length).setValues([values]);
  else sh.appendRow(values);
  logAudit(admin.email, 'adminSaveDebt', { studentId: studentId, className: className, amount: amount });
  return { success: true };
}

function parentGetDebts(p, token) {
  const parent = requireRole(token, ['parent']);
  const className = String(p.className || '').trim();
  const studentId = String(p.studentId || '').trim();
  const academicYear = String(p.academicYear || '').trim();
  if (!className || !studentId) throw new Error('className and studentId required.');
  portalAssertLinkedParent_(parent, className, studentId);

  let rows = sheetToObjects(getSheet('Debtors')).filter(function (r) {
    return String(r.student_id) === studentId &&
           String(r.class) === className &&
           (!academicYear || String(r.academic_year) === academicYear);
  });
  return rows.map(function (r) {
    return {
      academicYear: String(r.academic_year),
      term: String(r.term),
      amount: r.amount === '' ? 0 : Number(r.amount),
      note: String(r.note || '')
    };
  });
}

/* ============================================================
   v8: ANNOUNCEMENTS
   ============================================================ */
function adminGetAnnouncements(p, token) {
  requireRole(token, ['admin']);
  let rows = sheetToObjects(getSheet('Announcements'));
  if (p.className) {
    rows = rows.filter(function (r) {
      const t = String(r.target_classes || '').trim();
      return t === 'ALL' || t.split(',').map(function (s) { return s.trim(); }).indexOf(p.className) !== -1;
    });
  }
  if (p.active !== undefined && p.active !== '') {
    const wanted = String(p.active) === 'true';
    rows = rows.filter(function (r) { return (r.active === true) === wanted; });
  }
  rows.sort(function (a, b) {
    return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime();
  });
  return rows.map(function (r) {
    return {
      id: String(r.id || ''),
      message: String(r.message || ''),
      targetClasses: String(r.target_classes || ''),
      audience: String(r.audience || 'parents'),
      active: r.active === true,
      expiresAt: r.expires_at || '',
      createdAt: r.created_at || '',
      createdBy: String(r.created_by || '')
    };
  });
}

function notifyAnnouncementAudience_(id, message, targetClasses, audience, createdBy) {
  const aud = String(audience || 'parents').toLowerCase();
  const classes = String(targetClasses || 'ALL').trim() === 'ALL' ? null : String(targetClasses).split(',').map(function (x) { return x.trim(); }).filter(Boolean);
  const link = 'announcement:' + id;
  const notifyParents = ['parents','both','all'].indexOf(aud) !== -1;
  const notifyTeachers = ['teachers','both','all'].indexOf(aud) !== -1;
  const notifyStudents = ['students','both','all'].indexOf(aud) !== -1;
  if (notifyParents) {
    const seen = {};
    sheetToObjects(getSheet('ParentLinks')).forEach(function (r) {
      if (!(r.active === true || String(r.active).toLowerCase() === 'true')) return;
      if (classes && classes.indexOf(String(r.class || '').trim()) === -1) return;
      const email = String(r.parent_email || '').trim().toLowerCase();
      if (!email || seen[email]) return;
      seen[email] = true;
      createNotification_(email, '', 'New school announcement', message, 'announcement', link, createdBy);
    });
  }
  if (notifyTeachers) createNotification_('', 'class_teacher', 'New school announcement', message, 'announcement', link, createdBy);
  if (notifyStudents) createNotification_('', 'student', 'New school announcement', message, 'announcement', link, createdBy);
}

function adminSaveAnnouncement(p, token) {
  const admin = requireRole(token, ['admin']);
  const message = String(p.message || '').trim();
  const targetClasses = String(p.targetClasses || 'ALL').trim() || 'ALL';
  const audience = String(p.audience || 'parents').toLowerCase();
  const expiresAt = String(p.expiresAt || '').trim();
  const active = p.active === undefined ? true : (p.active === true || p.active === 'true');

  if (!message) throw new Error('Message is required.');
  if (message.length > 2000) throw new Error('Message too long (max 2000 chars).');
  if (['parents','teachers','students','both','all'].indexOf(audience) === -1) throw new Error('audience must be parents, teachers, students, both or all.')

  if (targetClasses !== 'ALL') {
    const list = targetClasses.split(',').map(function (s) { return s.trim(); }).filter(Boolean);
    if (!list.length) throw new Error('targetClasses must be ALL or a list of classes.');
    list.forEach(function (cn) {
      if (CLASSES.indexOf(cn) === -1) throw new Error('Unknown class: ' + cn);
    });
  }

  const sh = getSheet('Announcements');
  const createdAt = new Date();
  let id = String(p.id || '').trim();
  let rowNum = -1;
  if (id) {
    const data = sh.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) if (String(data[i][0]) === id) { rowNum = i + 1; break; }
    if (rowNum < 0) throw new Error('Announcement not found for update.');
    sh.getRange(rowNum, 2, 1, 7).setValues([[message, targetClasses, audience, active, expiresAt, data[rowNum - 1][6] || createdAt, admin.email]]);
  } else {
    id = 'ANN' + Date.now() + '_' + Math.floor(Math.random() * 10000);
    sh.appendRow([id, message, targetClasses, audience, active, expiresAt, createdAt, admin.email]);
  }
  if (active) notifyAnnouncementAudience_(id, message, targetClasses, audience, admin.email);
  logAudit(admin.email, p.id ? 'adminUpdateAnnouncement' : 'adminSaveAnnouncement', { id: id, targetClasses: targetClasses, audience: audience });
  return { success: true, id: id, updated: rowNum > 0 };
}

function getTeacherAnnouncements(p, token) {
  const user = requireRole(token, ['admin', 'class_teacher', 'subject_teacher']);
  const now = Date.now();
  const className = String(p.className || getAssignedTeacherClass_(user) || '').trim();
  return sheetToObjects(getSheet('Announcements')).filter(function (r) {
    if (!(r.active === true || String(r.active).toLowerCase() === 'true')) return false;
    const audience = String(r.audience || 'parents').toLowerCase();
    if (audience !== 'teachers' && audience !== 'both' && audience !== 'all') return false;
    const targets = String(r.target_classes || 'ALL').trim();
    if (targets !== 'ALL' && (!className || targets.split(',').map(function (x) { return x.trim(); }).indexOf(className) === -1)) return false;
    if (r.expires_at && isFinite(new Date(r.expires_at).getTime()) && new Date(r.expires_at).getTime() < now) return false;
    return true;
  }).sort(function (a, b) { return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime(); }).map(function (r) {
    return { id: String(r.id || ''), message: String(r.message || ''), targetClasses: String(r.target_classes || 'ALL'), audience: String(r.audience || 'teachers'), createdAt: r.created_at || '', expiresAt: r.expires_at || '' };
  });
}

function adminDeleteAnnouncement(p, token) {
  const admin = requireRole(token, ['admin']);
  const id = String(p.id || '').trim();
  if (!id) throw new Error('id required.');
  const sh = getSheet('Announcements');
  const data = sh.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]) === id) {
      sh.getRange(i + 1, 5).setValue(false);
      logAudit(admin.email, 'adminDeleteAnnouncement', { id: id });
      return { success: true };
    }
  }
  throw new Error('Announcement not found.');
}

function parentGetAnnouncements(p, token) {
  const parent = requireRole(token, ['parent']);
  const className = String(p.className || '').trim();
  const studentId = String(p.studentId || '').trim();
  if (!className || !studentId) throw new Error('className and studentId required.');
  portalAssertLinkedParent_(parent, className, studentId);

  const now = Date.now();
  const rows = sheetToObjects(getSheet('Announcements')).filter(function (r) {
    if (r.active !== true) return false;
    const aud = String(r.audience || 'parents').toLowerCase();
    if (aud !== 'parents' && aud !== 'both' && aud !== 'students' && aud !== 'all') return false;
    const t = String(r.target_classes || 'ALL').trim();
    if (t !== 'ALL' && t.split(',').map(function (s) { return s.trim(); }).indexOf(className) === -1) return false;
    if (r.expires_at) {
      const exp = new Date(r.expires_at).getTime();
      if (isFinite(exp) && exp < now) return false;
    }
    return true;
  });

  rows.sort(function (a, b) {
    return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime();
  });
  return rows.map(function (r) {
    return {
      id: String(r.id || ''),
      message: String(r.message || ''),
      createdAt: r.created_at || ''
    };
  });
}

/* ============================================================
   v9: DUPLICATE DETECTION + COPY-FROM-CLASS
   ============================================================ */
function normName_(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function nameSimilarity_(a, b) {
  const na = normName_(a), nb = normName_(b);
  if (!na || !nb) return 0;
  if (na === nb) return 1;
  const ta = na.split(' ').filter(Boolean);
  const tb = nb.split(' ').filter(Boolean);
  const setB = {};
  tb.forEach(function (t) { setB[t] = true; });
  let shared = 0;
  ta.forEach(function (t) { if (setB[t]) shared++; });
  const maxLen = Math.max(ta.length, tb.length);
  const tokenScore = maxLen ? shared / maxLen : 0;
  function editDistance(x, y) {
    const m = x.length, n = y.length;
    if (!m) return n;
    if (!n) return m;
    const dp = [];
    for (let i = 0; i <= m; i++) { dp.push(new Array(n + 1).fill(0)); dp[i][0] = i; }
    for (let j = 0; j <= n; j++) dp[0][j] = j;
    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        dp[i][j] = Math.min(
          dp[i - 1][j] + 1,
          dp[i][j - 1] + 1,
          dp[i - 1][j - 1] + (x[i - 1] === y[j - 1] ? 0 : 1)
        );
      }
    }
    return dp[m][n];
  }
  const dist = editDistance(na, nb);
  const maxLenStr = Math.max(na.length, nb.length);
  const editScore = maxLenStr ? 1 - (dist / maxLenStr) : 0;
  return Math.max(tokenScore, editScore);
}

function findStudentMatches(p, token) {
  verifyToken(token);
  const name = String(p.name || '').trim();
  const excludeClass = String(p.excludeClass || '').trim();
  const excludeId = String(p.excludeId || '').trim();
  if (!name) throw new Error('name required');

  const matches = [];
  CLASSES.forEach(function (cls) {
    if (cls === excludeClass) return;
    const sh = getSheet(cls);
    const last = sh.getLastRow();
    if (last < 4) return;
    const rows = sh.getRange(4, 1, last - 3, 2).getValues();
    rows.forEach(function (r, i) {
      const id = String(r[0] || '').trim();
      const nm = String(r[1] || '').trim();
      if (!id || !nm) return;
      if (excludeId && id === excludeId && cls === excludeClass) return;
      const score = nameSimilarity_(name, nm);
      if (score >= 0.6) {
        const totalCols = subjectsForClass(cls).length * FIELDS.length * TERMS.length;
        let scoreCount = 0;
        if (totalCols > 0) {
          const scoreVals = sh.getRange(4 + i, 3, 1, totalCols).getValues()[0];
          scoreVals.forEach(function (v) {
            if (v !== '' && v !== null && v !== undefined && isFinite(Number(v))) scoreCount++;
          });
        }
        matches.push({
          className: cls,
          studentId: id,
          name: nm,
          similarity: Math.round(score * 100) / 100,
          scoreCount: scoreCount
        });
      }
    });
  });

  matches.sort(function (a, b) { return b.similarity - a.similarity || b.scoreCount - a.scoreCount; });
  return matches.slice(0, 10);
}

function copyStudentFromClass(p, token) {
  const user = requireRole(token, ['admin', 'class_teacher']);
  const fromClass = String(p.fromClass || '').trim();
  const fromId    = String(p.fromId || '').trim();
  const toClass   = String(p.toClass || '').trim();
  const toId      = String(p.toId || '').trim();

  if (!fromClass || !fromId || !toClass || !toId) throw new Error('fromClass, fromId, toClass, toId required');
  if (CLASSES.indexOf(fromClass) === -1) throw new Error('Unknown fromClass: ' + fromClass);
  if (CLASSES.indexOf(toClass) === -1) throw new Error('Unknown toClass: ' + toClass);

  assertClassTeacherOwnClass_(user, toClass, 'You can only copy into your assigned class.');

  const fromSheet = getSheet(fromClass);
  const toSheet = getSheet(toClass);

  const fromLast = fromSheet.getLastRow();
  if (fromLast < 4) throw new Error('No students in ' + fromClass);
  const fromIds = fromSheet.getRange(4, 1, fromLast - 3, 1).getValues();
  let fromRowIdx = -1;
  for (let i = 0; i < fromIds.length; i++) {
    if (String(fromIds[i][0]) === fromId) { fromRowIdx = 4 + i; break; }
  }
  if (fromRowIdx === -1) throw new Error('Student ' + fromId + ' not found in ' + fromClass);

  const toLast = toSheet.getLastRow();
  if (toLast < 4) throw new Error('No students in ' + toClass);
  const toIds = toSheet.getRange(4, 1, toLast - 3, 1).getValues();
  let toRowIdx = -1;
  for (let i = 0; i < toIds.length; i++) {
    if (String(toIds[i][0]) === toId) { toRowIdx = 4 + i; break; }
  }
  if (toRowIdx === -1) throw new Error('Student ' + toId + ' not found in ' + toClass);

  const targetScoreCols = subjectsForClass(toClass).length * FIELDS.length * TERMS.length;
  if (targetScoreCols > 0) {
    const targetVals = toSheet.getRange(toRowIdx, 3, 1, targetScoreCols).getValues()[0];
    const hasAnyScore = targetVals.some(function (v) {
      return v !== '' && v !== null && v !== undefined && isFinite(Number(v));
    });
    if (hasAnyScore) throw new Error('Target row already has scores. Refusing to overwrite.');
  }

  const sourceScoreCols = subjectsForClass(fromClass).length * FIELDS.length * TERMS.length;
  const sourceScores = sourceScoreCols > 0
    ? fromSheet.getRange(fromRowIdx, 3, 1, sourceScoreCols).getValues()[0]
    : [];
  const targetScores = new Array(targetScoreCols).fill('');
  const copyCount = Math.min(sourceScores.length, targetScores.length);
  for (let i = 0; i < copyCount; i++) {
    const v = sourceScores[i];
    if (v !== '' && v !== null && v !== undefined && isFinite(Number(v))) targetScores[i] = v;
  }
  if (targetScoreCols > 0) toSheet.getRange(toRowIdx, 3, 1, targetScoreCols).setValues([targetScores]);

  let domainsCopied = 0;
  TERMS.forEach(function (term) {
    ['affective', 'psychomotor'].forEach(function (kind) {
      const items = kind === 'affective' ? AFFECTIVE_ITEMS : PSYCHOMOTOR_ITEMS;
      const sh = getSheet(kind === 'affective' ? 'Affective' : 'Psychomotor');
      const data = sh.getDataRange().getValues();
      const headers = data[0];
      const colOf = {};
      headers.forEach(function (h, i) { colOf[String(h)] = i; });
      let srcRow = -1;
      for (let i = 1; i < data.length; i++) {
        if (String(data[i][colOf['student_id']]) === fromId &&
            String(data[i][colOf['class']]) === fromClass &&
            String(data[i][colOf['term']]) === term) { srcRow = i; break; }
      }
      if (srcRow === -1) return;
      const newRow = new Array(headers.length).fill('');
      newRow[colOf['student_id']] = toId;
      newRow[colOf['class']] = toClass;
      newRow[colOf['term']] = term;
      newRow[colOf['academic_year']] = String(p.academicYear || '').trim() || '';
      items.forEach(function (pair) {
        const k = pair[0];
        if (colOf[k] !== undefined) newRow[colOf[k]] = data[srcRow][colOf[k]];
      });
      newRow[colOf['updated_at']] = new Date();
      newRow[colOf['updated_by']] = user.email;
      sh.appendRow(newRow);
      domainsCopied++;
    });
  });

  logAudit(user.email, 'copyStudentFromClass', {
    fromClass: fromClass, fromId: fromId, toClass: toClass, toId: toId,
    scoresCopied: targetScores.filter(function (v) { return v !== ''; }).length,
    domainsCopied: domainsCopied
  });

  return {
    success: true,
    copiedScores: targetScores.filter(function (v) { return v !== ''; }).length,
    copiedDomains: domainsCopied
  };
}

/* ============================================================
   v10: DUPLICATE PREVENTION + BULK PDF READS
   ============================================================ */
function checkNewStudent(p, token) {
  verifyToken(token);
  const className = String(p.className || '').trim();
  const studentId = String(p.studentId || '').trim();
  const name = String(p.name || '').trim();
  if (!className) throw new Error('className required');
  if (CLASSES.indexOf(className) === -1) throw new Error('Unknown class.');

  let idInThisClass = false;
  if (studentId) {
    const sh = getSheet(className);
    const last = sh.getLastRow();
    if (last >= 4) {
      const ids = sh.getRange(4, 1, last - 3, 1).getValues();
      for (let i = 0; i < ids.length; i++) {
        if (String(ids[i][0]).trim() === studentId) { idInThisClass = true; break; }
      }
    }
  }

  let sameNameInOtherClasses = [];
  if (name) {
    sameNameInOtherClasses = findStudentMatches({ name: name, excludeClass: className }, token);
  }

  return {
    idInThisClass: idInThisClass,
    sameNameInOtherClasses: sameNameInOtherClasses
  };
}

/* ============ AI CLASS PERFORMANCE ANALYSIS ============ */
function adminAskPerformanceAI(p, token) {
  const user = requireRole(token, ['admin', 'class_teacher']);
  const className = String(p.className || '').trim();
  const term = String(p.term || '').trim();
  const assessment = String(p.assessment || 'total').trim();
  if (CLASSES.indexOf(className) === -1) throw new Error('Choose a valid class.');
  if (TERMS.indexOf(term) === -1) throw new Error('Choose a valid term.');
  if (['total','T1','T2','T3','Exam'].indexOf(assessment) === -1) throw new Error('Invalid assessment.');
  assertClassTeacherOwnClass_(user, className, 'You can only analyse your assigned class.');

  // Gemini API credentials are read securely from Apps Script Script Properties.
  const students = getStudents(className, token);
  const subjects = subjectsForClass(className);
  const scoreMap = getClassScores({ className: className, term: term }, token);
  const getValue = function (record) {
    record = record || {};
    if (assessment === 'total') {
      const keys = ['T1','T2','T3','Exam'];
      if (!keys.every(function (k) { return record[k] !== '' && record[k] !== null && record[k] !== undefined && isFinite(Number(record[k])); })) return null;
      return keys.reduce(function (sum, k) { return sum + Number(record[k]); }, 0);
    }
    const v = record[assessment];
    return v === '' || v === null || v === undefined || !isFinite(Number(v)) ? null : Number(v);
  };

  const subjectSummary = subjects.map(function (subject) {
    const ranked = students.map(function (student, index) {
      return { label: 'Student ' + String(index + 1).padStart(3, '0'), score: getValue((scoreMap[student.student_id] || {})[subject]) };
    }).filter(function (x) { return x.score !== null; }).sort(function (a, b) { return b.score - a.score; });
    let last = null, rank = 0;
    ranked.forEach(function (r, i) { if (last === null || r.score !== last) rank = i + 1; r.rank = rank; last = r.score; });
    const scores = ranked.map(function (r) { return r.score; });
    return {
      subject: subject,
      entered: scores.length,
      missing: students.length - scores.length,
      average: scores.length ? Math.round(scores.reduce(function (a,b) { return a+b; },0) / scores.length * 100) / 100 : null,
      highest: scores.length ? Math.max.apply(null, scores) : null,
      lowest: scores.length ? Math.min.apply(null, scores) : null,
      topFive: ranked.slice(0,5)
    };
  });
  const all = subjectSummary.reduce(function (a, r) { return a.concat(r.topFive); }, []);
  const payload = {
    school: 'Greater Tomorrow Model Schools', className: className, term: term,
    assessment: assessment === 'total' ? 'Subject total out of 100' : assessment,
    studentCount: students.length, subjectCount: subjects.length,
    subjects: subjectSummary
  };
  const prompt = [
    'You are the academic performance analyst for Greater Tomorrow Model Schools.',
    'Analyse only the supplied class-level test data. Do not invent facts, student names, causes, attendance, or personal circumstances.',
    'Student labels are anonymised; refer to them only by their supplied labels if needed.',
    'Write a concise, practical report with these headings: Overall Overview; Strongest Subjects; Subjects Requiring Attention; Top Subject Performers; Teaching and Revision Recommendations; Data Quality Notes.',
    'Use the supplied averages, highs, lows, entered and missing counts accurately. Distinguish a high score from a class average. Do not claim a subject is failed unless the supplied scale supports that conclusion.',
    'For each subject, mention its average and the highest/lowest scores when useful. Recommend actionable classroom interventions.',
    'Data (JSON): ' + JSON.stringify(payload)
  ].join('\n\n');
  const answer = geminiGenerateText_(prompt, 1000, false);
  if (!answer || !answer.trim()) throw new Error('Gemini did not return an analysis. Please try again.');
  logAudit(user.email, 'adminAskPerformanceAI', { className: className, term: term, assessment: assessment });
  return { answer: answer.trim(), className: className, term: term, assessment: assessment };
}

function getClassScores(p, token) {
  const user = verifyToken(token);
  const className = String(p.className || '').trim();
  const term = String(p.term || '').trim();
  if (!className) throw new Error('className required');
  if (CLASSES.indexOf(className) === -1) throw new Error('Unknown class.');
  if (TERMS.indexOf(term) === -1) throw new Error('Invalid term.');

  if (!hasRole_(user, 'admin') &&
      !hasRole_(user, 'class_teacher') &&
      !hasRole_(user, 'subject_teacher')) {
    throw new Error('Permission denied.');
  }

  // A class teacher who also has the subject_teacher role must be able
  // to review every subject in their assigned class. Subject filtering
  // applies only to accounts that are subject teachers exclusively.
  assertClassTeacherOwnClass_(user, className, 'You can only access your assigned class.');

  const isSubjectTeacherOnly =
    hasRole_(user, 'subject_teacher') &&
    !hasRole_(user, 'admin') &&
    !hasRole_(user, 'class_teacher');

  const assignedSubjects = isSubjectTeacherOnly
    ? splitAssignmentList_(user.subjects).map(function (s) {
        return String(s).trim().toLowerCase();
      })
    : [];

  if (isSubjectTeacherOnly && !assignedSubjects.length) {
    throw new Error('No subjects are assigned to this account.');
  }

  const sh = getSheet(className);
  const last = sh.getLastRow();
  if (last < 4) return {};

  const subjects = subjectsForClass(className);
  const tIdx = TERMS.indexOf(term);
  const termStart = 3 + tIdx * subjects.length * FIELDS.length;
  const idAndScores = sh.getRange(
    4, 1, last - 3, termStart - 1 + subjects.length * FIELDS.length
  ).getValues();

  const out = {};
  idAndScores.forEach(function (row) {
    const sid = String(row[0] || '').trim();
    if (!sid) return;

    const slice = row.slice(termStart - 1);
    const perSubject = {};

    subjects.forEach(function (subj, i) {
      if (isSubjectTeacherOnly &&
          assignedSubjects.indexOf(String(subj).trim().toLowerCase()) === -1) {
        return;
      }

      const b = i * FIELDS.length;
      perSubject[subj] = {
        T1: slice[b],
        T2: slice[b + 1],
        T3: slice[b + 2],
        Exam: slice[b + 3]
      };
    });

    out[sid] = perSubject;
  });

  return out;
}

function getClassDomains(p, token) {
  const user = verifyToken(token);
  const className = String(p.className || '').trim();
  const term = String(p.term || '').trim();
  const academicYear = String(p.academicYear || '').trim();
  if (!className || !term || !academicYear) throw new Error('className, term, academicYear required.');
  if (CLASSES.indexOf(className) === -1 || TERMS.indexOf(term) === -1) throw new Error('Unknown class or term.');
  if (!hasRole_(user, 'admin') && !hasRole_(user, 'class_teacher')) throw new Error('Permission denied.');
  assertClassTeacherOwnClass_(user, className, 'You can only access your assigned class.');

  const out = {};

  [['affective','Affective'], ['psychomotor','Psychomotor']].forEach(function (pair) {
    const kind = pair[0];
    const sheetName = pair[1];
    const items = kind === 'affective' ? AFFECTIVE_ITEMS : PSYCHOMOTOR_ITEMS;
    const rows = sheetToObjects(getSheet(sheetName));
    rows.forEach(function (r) {
      if (String(r.class) !== className) return;
      if (String(r.term) !== term) return;
      if (String(r.academic_year) !== academicYear) return;
      const sid = String(r.student_id || '').trim();
      if (!sid) return;
      if (!out[sid]) out[sid] = { affective: {}, psychomotor: {}, days: {} };
      items.forEach(function (pair2) {
        const k = pair2[0];
        const v = r[k];
        const n = v === '' || v === null || v === undefined ? null : Number(v);
        out[sid][kind][k] = (!hasRole_(user, 'admin') && !domainVisible_(kind)) ? null : ((n !== null && n >= 1 && n <= 5) ? n : null);
      });
    });
  });

  const classSheet = getSheet(className);
  const lastRow = classSheet.getLastRow();
  if (lastRow >= 4) {
    const domStart = domainTermStart_(className, term);
    const idCol = classSheet.getRange(4, 1, lastRow - 3, 1).getValues();
    const dayVals = classSheet.getRange(4, domStart, lastRow - 3, DOMAIN_COLS_PER_TERM).getValues();
    for (let i = 0; i < idCol.length; i++) {
      const sid = String(idCol[i][0] || '').trim();
      if (!sid) continue;
      if (!out[sid]) out[sid] = { affective: {}, psychomotor: {}, days: {} };
      out[sid].days = {
        days_opened: dayVals[i][0] === '' ? null : Number(dayVals[i][0]),
        days_present: dayVals[i][1] === '' ? null : Number(dayVals[i][1]),
        affective_letter: (hasRole_(user, 'admin') || domainVisible_('affective')) ? String(dayVals[i][2] || '').trim().toUpperCase() : '',
        psychomotor_letter: (hasRole_(user, 'admin') || domainVisible_('psychomotor')) ? String(dayVals[i][3] || '').trim().toUpperCase() : ''
      };
    }
  }

  return out;
}

function getClassTeacherRemarks(p, token) {
  verifyToken(token);
  const className = String(p.className || '').trim();
  const term = String(p.term || '').trim();
  const academicYear = String(p.academicYear || '').trim();
  if (!className || !term || !academicYear) throw new Error('className, term, academicYear required.');

  const out = {};
  sheetToObjects(getSheet('TeacherRemarks')).forEach(function (r) {
    if (String(r.class) !== className) return;
    if (String(r.term) !== term) return;
    if (String(r.academic_year) !== academicYear) return;
    const sid = String(r.student_id || '').trim();
    if (!sid) return;
    out[sid] = String(r.remark || '');
  });
  return out;
}

/* ============================================================
   v12: STAFF MESSAGES
   ============================================================ */
function staffSendMessage(p, token) {
  const user = verifyToken(token);
  if (hasRole_(user, 'parent') || hasRole_(user, 'student')) {
    throw new Error('Only staff can message the admin.');
  }
  const subject = String(p.subject || '').trim();
  const message = String(p.message || '').trim();
  const relatedDate = String(p.relatedDate || '').trim();
  if (!message) throw new Error('Message body is required.');
  if (message.length > 2000) throw new Error('Message too long (max 2000 chars).');
  if (subject.length > 100) throw new Error('Subject too long (max 100 chars).');
  if (relatedDate && !/^\d{4}-\d{2}-\d{2}$/.test(relatedDate)) {
    throw new Error('relatedDate must be YYYY-MM-DD.');
  }

  const id = 'MSG' + Date.now() + '_' + Math.floor(Math.random() * 10000);
  const sh = getSheet('StaffMessages');
  sh.appendRow([
    id,
    String(user.email || '').toLowerCase(),
    String(user.name || ''),
    subject,
    message,
    relatedDate,
    'Open',
    new Date(),
    '',
    '',
    ''
  ]);
  logAudit(user.email, 'staffSendMessage', { id: id, subject: subject });
  return { success: true, id: id };
}

/* ============================================================
   ADMIN DASHBOARD, PARENT ENQUIRIES, NOTIFICATIONS AND SAFE BACKUPS
   ============================================================ */
function adminGetDashboard(p, token) {
  const admin = requireRole(token, ['admin']);
  const safeRows = function (name) { try { return sheetToObjects(getSheet(name)); } catch (e) { return []; } };
  let studentCount = 0;
  CLASSES.forEach(function (cn) { try { const sh = getSheet(cn); const last = sh.getLastRow(); if (last >= 4) studentCount += sh.getRange(4, 1, last - 3, 2).getValues().filter(function (r) { return r[0] && r[1]; }).length; } catch (e) {} });
  const teachers = safeRows('Users').filter(function (u) { return String(u.role || '').split(',').map(function (x) { return x.trim(); }).some(function (r) { return r === 'class_teacher' || r === 'subject_teacher'; }) && String(u.active).toLowerCase() !== 'false'; });
  const submissions = safeRows('Submissions');
  const enquiries = safeRows('ParentEnquiries');
  const announcements = safeRows('Announcements');
  const publications = safeRows('ResultPublication');
  const auditRows = safeRows('Audit').sort(function (a, b) { return new Date(b.timestamp || 0).getTime() - new Date(a.timestamp || 0).getTime(); }).slice(0, 10);
  const now = Date.now();
  return {
    generatedAt: new Date().toISOString(),
    classesConfigured: CLASSES.length,
    activeStudentRecords: studentCount,
    activeTeachers: teachers.length,
    submissions: {
      total: submissions.length,
      locked: submissions.filter(function (r) { return String(r.status).toLowerCase() === 'locked'; }).length,
      correctionOpen: submissions.filter(function (r) { return String(r.status).toLowerCase() === 'correction_open' && r.correction_deadline && new Date(r.correction_deadline).getTime() > now; }).length,
      expiredCorrections: submissions.filter(function (r) { return String(r.status).toLowerCase() === 'correction_open' && r.correction_deadline && new Date(r.correction_deadline).getTime() <= now; }).length,
      legacyTermLocks: submissions.filter(function (r) { return !String(r.assessment || '').trim() && String(r.status).toLowerCase() === 'locked'; }).length
    },
    parentEnquiries: { total: enquiries.length, open: enquiries.filter(function (r) { return String(r.status).toLowerCase() !== 'resolved' && String(r.status).toLowerCase() !== 'closed'; }).length },
    activeAnnouncements: announcements.filter(function (r) { return r.active === true || String(r.active).toLowerCase() === 'true'; }).length,
    resultPublication: { publishedRecords: publications.filter(function (r) { return r.published === true || String(r.published).toLowerCase() === 'true'; }).length, unpublishedRecords: publications.filter(function (r) { return !(r.published === true || String(r.published).toLowerCase() === 'true'); }).length },
    recentAudit: auditRows,
    staffAttendance: { note: 'Existing staff attendance is managed by the separate attendance application; this backend does not replace it.' },
    domainVisibility: { affectiveVisible: domainVisible_('affective'), psychomotorVisible: domainVisible_('psychomotor') }
  };
}

function createNotification_(recipientEmail, audience, title, message, type, link, createdBy) {
  const sh = getSheet('Notifications');
  const id = Utilities.getUuid();
  sh.appendRow([id, recipientEmail || '', audience || '', title || '', message || '', type || 'info', link || '', new Date(), '', createdBy || 'system']);
  return id;
}
function getMyNotifications(p, token) {
  const user = verifyToken(token);
  const rows = sheetToObjects(getSheet('Notifications'));
  return rows.filter(function (r) {
    const recipient = String(r.recipient_email || '').trim().toLowerCase();
    const audience = String(r.audience || '').trim().toLowerCase();
    return recipient === String(user.email || '').toLowerCase() || (!recipient && audience && (roleList_(user).indexOf(audience) !== -1 || (audience === 'class_teacher' && hasRole_(user, 'subject_teacher')) || (audience === 'subject_teacher' && hasRole_(user, 'class_teacher'))));
  }).sort(function (a, b) { return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime(); }).slice(0, Math.min(Number(p.limit) || 100, 250));
}
function markNotificationRead(p, token) {
  const user = verifyToken(token), id = String(p.id || '').trim();
  if (!id) throw new Error('Notification id required.');
  const sh = getSheet('Notifications'), data = sh.getDataRange().getValues(), hm = submissionHeadersMap_(sh);
  const map = hm.map;
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][map.id]) !== id) continue;
    const recipient = String(data[i][map.recipient_email] || '').toLowerCase();
    const audience = String(data[i][map.audience] || '').toLowerCase();
    if (recipient !== String(user.email || '').toLowerCase() && !(recipient === '' && (roleList_(user).indexOf(audience) !== -1 || (audience === 'class_teacher' && hasRole_(user, 'subject_teacher')) || (audience === 'subject_teacher' && hasRole_(user, 'class_teacher')))) && !hasRole_(user, 'admin')) throw new Error('Permission denied.');
    sh.getRange(i + 1, map.read_at + 1).setValue(new Date());
    return { success: true, id: id };
  }
  throw new Error('Notification not found.');
}

function parentSubmitEnquiry(p, token) {
  const parent = requireRole(token, ['parent']);
  const message = String(p.message || '').trim(), category = String(p.category || 'General').trim();
  const subject = String(p.subject || '').trim(), studentId = String(p.studentId || '').trim(), className = String(p.className || '').trim();
  if (!message) throw new Error('Enquiry message is required.');
  if (message.length > 5000 || subject.length > 200 || category.length > 100) throw new Error('Enquiry is too long.');
  if (studentId || className) {
    if (!studentId || !className) throw new Error('Provide both className and studentId, or neither.');
    portalAssertLinkedParent_(parent, className, studentId);
  }
  const id = Utilities.getUuid(), now = new Date();
  getSheet('ParentEnquiries').appendRow([id, parent.email, parent.name || '', studentId, className, category, subject, message, 'open', '', now, '', '', '', now]);
  logAudit(parent.email, 'parentSubmitEnquiry', { enquiryId: id, category: category, studentId: studentId, className: className });
  try { ADMIN_EMAILS.forEach(function (addr) { MailApp.sendEmail({ to: addr, subject: '[GTMC] New parent enquiry', body: 'A parent has submitted an enquiry.\nReference: ' + id + '\nCategory: ' + category + '\nSubject: ' + subject + '\n\n' + message }); }); } catch (e) {}
  createNotification_('', 'admin', 'New parent enquiry', 'A parent enquiry is awaiting review.', 'parent_enquiry', 'enquiry:' + id, 'system');
  return { success: true, id: id, status: 'open', createdAt: now.toISOString() };
}
function parentGetEnquiries(p, token) {
  const parent = requireRole(token, ['parent']);
  return sheetToObjects(getSheet('ParentEnquiries')).filter(function (r) { return String(r.parent_email).toLowerCase() === String(parent.email).toLowerCase(); }).sort(function (a, b) { return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime(); });
}
function adminGetParentEnquiries(p, token) {
  requireRole(token, ['admin']);
  let rows = sheetToObjects(getSheet('ParentEnquiries'));
  if (p.status) rows = rows.filter(function (r) { return String(r.status).toLowerCase() === String(p.status).toLowerCase(); });
  if (p.category) rows = rows.filter(function (r) { return String(r.category).toLowerCase() === String(p.category).toLowerCase(); });
  return rows.sort(function (a, b) { return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime(); });
}
function adminReplyParentEnquiry(p, token) {
  const admin = requireRole(token, ['admin']);
  const id = String(p.id || '').trim(), reply = String(p.reply || '').trim();
  if (!id || !reply) throw new Error('Enquiry id and reply are required.');
  if (reply.length > 5000) throw new Error('Reply is too long.');
  const sh = getSheet('ParentEnquiries'), data = sh.getDataRange().getValues();
  const map = {}; (data[0] || []).forEach(function (h, i) { map[String(h)] = i; });
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][map.id]) !== id) continue;
    const now = new Date();
    sh.getRange(i + 1, map.reply + 1).setValue(reply);
    sh.getRange(i + 1, map.replied_at + 1).setValue(now);
    sh.getRange(i + 1, map.replied_by + 1).setValue(admin.email);
    sh.getRange(i + 1, map.status + 1).setValue(String(p.status || 'resolved'));
    sh.getRange(i + 1, map.updated_at + 1).setValue(now);
    const email = String(data[i][map.parent_email] || '');
    if (email) createNotification_(email, '', 'Reply to your GTMC enquiry', reply, 'parent_enquiry_reply', 'enquiry:' + id, admin.email);
    logAudit(admin.email, 'adminReplyParentEnquiry', { enquiryId: id, status: String(p.status || 'resolved') });
    return { success: true, id: id, status: String(p.status || 'resolved') };
  }
  throw new Error('Parent enquiry not found.');
}

function adminGetAuditLogs(p, token) {
  requireRole(token, ['admin']);
  let rows = sheetToObjects(getSheet('Audit'));
  if (p.email) rows = rows.filter(function (r) { return String(r.email).toLowerCase() === String(p.email).toLowerCase(); });
  if (p.action) rows = rows.filter(function (r) { return String(r.action).toLowerCase().indexOf(String(p.action).toLowerCase()) !== -1; });
  if (p.fromDate) { const from = new Date(p.fromDate).getTime(); if (isFinite(from)) rows = rows.filter(function (r) { return new Date(r.timestamp).getTime() >= from; }); }
  if (p.toDate) { const to = new Date(p.toDate).getTime(); if (isFinite(to)) rows = rows.filter(function (r) { return new Date(r.timestamp).getTime() <= to; }); }
  rows.sort(function (a, b) { return new Date(b.timestamp || 0).getTime() - new Date(a.timestamp || 0).getTime(); });
  return rows.slice(0, Math.min(Math.max(Number(p.limit) || 200, 1), 1000));
}
function adminListAcademicArchives(p, token) {
  requireRole(token, ['admin']);
  let rows = sheetToObjects(getSheet('AcademicArchive'));
  if (p.academicYear) rows = rows.filter(function (r) { return String(r.academic_year) === String(p.academicYear); });
  return rows.sort(function (a, b) { return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime(); });
}

function adminCreateBackup(p, token) {
  const admin = requireRole(token, ['admin']);
  const year = String(p.academicYear || '').trim();
  const note = String(p.notes || '').trim();
  const stamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyyMMdd_HHmmss');
  const name = 'GTMC_GradeSystem_Backup_' + (year ? year.replace(/[^A-Za-z0-9_-]/g, '_') + '_' : '') + stamp;
  // Make a full spreadsheet copy in Drive; do not alter or delete the live workbook.
  const copy = DriveApp.getFileById(SHEET_ID).makeCopy(name);
  const id = Utilities.getUuid(), now = new Date();
  getSheet('SystemBackups').appendRow([id, name, copy.getId(), copy.getUrl(), year, now, admin.email, 'created', note]);
  logAudit(admin.email, 'adminCreateBackup', { backupId: id, driveFileId: copy.getId(), academicYear: year });
  return { success: true, id: id, name: name, fileId: copy.getId(), url: copy.getUrl(), createdAt: now.toISOString() };
}
function adminListBackups(p, token) {
  requireRole(token, ['admin']);
  return sheetToObjects(getSheet('SystemBackups')).sort(function (a, b) { return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime(); });
}
function adminCreateAcademicArchive(p, token) {
  const admin = requireRole(token, ['admin']);
  const year = String(p.academicYear || '').trim();
  if (!year) throw new Error('academicYear is required.');
  // Archive metadata points to a full backup copy; it does not move or clear live scores.
  const backup = adminCreateBackup({ academicYear: year, notes: 'Academic-year archive: ' + String(p.notes || '') }, token);
  const id = Utilities.getUuid(), now = new Date();
  getSheet('AcademicArchive').appendRow([id, year, backup.id, now, admin.email, String(p.notes || '')]);
  logAudit(admin.email, 'adminCreateAcademicArchive', { archiveId: id, academicYear: year, backupId: backup.id });
  return { success: true, id: id, academicYear: year, backupId: backup.id, backupUrl: backup.url, createdAt: now.toISOString() };
}
function adminCreateRecoveryCopy(p, token) {
  const admin = requireRole(token, ['admin']);
  const backupId = String(p.backupId || '').trim();
  if (!backupId || p.confirm !== true) throw new Error('Provide backupId and set confirm=true. This creates a separate recovery copy and never overwrites the live spreadsheet.');
  const rows = sheetToObjects(getSheet('SystemBackups'));
  const record = rows.find(function (r) { return String(r.id) === backupId; });
  if (!record || !record.file_id) throw new Error('Backup record not found.');
  const source = DriveApp.getFileById(String(record.file_id));
  const name = 'GTMC_Recovery_Copy_' + Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyyMMdd_HHmmss');
  const copy = source.makeCopy(name);
  logAudit(admin.email, 'adminCreateRecoveryCopy', { backupId: backupId, recoveryFileId: copy.getId() });
  return { success: true, fileId: copy.getId(), name: name, url: copy.getUrl(), note: 'A separate recovery copy was created. The live spreadsheet was not overwritten.' };
}

function adminGetStaffMessages(p, token) {
  requireRole(token, ['admin']);
  let rows = sheetToObjects(getSheet('StaffMessages'));
  if (p.status) rows = rows.filter(function (r) { return String(r.status) === String(p.status); });
  if (p.fromEmail) rows = rows.filter(function (r) {
    return String(r.from_email).toLowerCase() === String(p.fromEmail).toLowerCase();
  });
  rows.sort(function (a, b) {
    return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime();
  });
  return rows.map(function (r) {
    return {
      id: String(r.id || ''),
      fromEmail: String(r.from_email || ''),
      fromName: String(r.from_name || ''),
      subject: String(r.subject || ''),
      message: String(r.message || ''),
      relatedDate: String(r.related_date || ''),
      status: String(r.status || 'Open'),
      createdAt: r.created_at || '',
      reply: String(r.reply || ''),
      repliedAt: r.replied_at || '',
      repliedBy: String(r.replied_by || '')
    };
  });
}

function adminReplyStaffMessage(p, token) {
  const admin = requireRole(token, ['admin']);
  const id = String(p.id || '').trim();
  const reply = String(p.reply || '').trim();
  if (!id) throw new Error('id required.');
  if (!reply) throw new Error('reply required.');
  if (reply.length > 2000) throw new Error('Reply too long (max 2000 chars).');

  const sh = getSheet('StaffMessages');
  const data = sh.getDataRange().getValues();
  const headers = data[0];
  const cId = headers.indexOf('id');
  if (cId === -1) throw new Error('StaffMessages sheet missing id column.');

  for (let i = 1; i < data.length; i++) {
    if (String(data[i][cId]) === id) {
      const cReply = headers.indexOf('reply') + 1;
      const cStatus = headers.indexOf('status') + 1;
      const cRepliedAt = headers.indexOf('replied_at') + 1;
      const cRepliedBy = headers.indexOf('replied_by') + 1;
      sh.getRange(i + 1, cReply, 1, cStatus - cReply + 1).setValues([[
        reply, 'Replied', new Date(), admin.email
      ]]);
      logAudit(admin.email, 'adminReplyStaffMessage', { id: id });
      return { success: true, id: id, status: 'Replied' };
    }
  }
  throw new Error('Message not found: ' + id);
}
/* ============================================================
   v15: LEADERSHIP SUMMARY + FINANCIAL MANAGEMENT MODULE
   Non-destructive: new sheets are added; existing Debtors and score
   records are retained and are not used as a source of transactions.
   ============================================================ */

function gtmcEnsureModuleSheets_() {
  const ss = openSS();
  const schemas = {
    FeeStructures: ['class','academic_year','term','category','amount','compulsory','active','updated_at','updated_by'],
    StudentCharges: ['charge_id','student_id','student_name','class','academic_year','term','category','amount','note','active','created_at','created_by'],
    FeePayments: ['payment_id','receipt_no','student_id','student_name','class','academic_year','term','amount','allocated_category','payment_method','reference','note','status','recorded_at','recorded_by','reversed_at','reversed_by','reversal_reason'],
    FeeReceipts: ['receipt_no','payment_id','student_id','student_name','class','academic_year','term','amount','allocated_category','payment_method','reference','issued_at','issued_by','status'],
    FinancialSettings: ['key','value','updated_at','updated_by'],
    PaymentNotifications: ['id','parent_email','parent_name','student_id','student_name','class','academic_year','term','fee_category','payment_date','payment_time','amount','sender_name','reference','note','status','reply','replied_by','replied_at','created_at','updated_at','ledger_payment_id'],
    LibraryResources: ['id','title','author','subject','class','category','url','description','active','created_at','created_by','updated_at','updated_by']
  };
  Object.keys(schemas).forEach(function(name) {
    let sh = ss.getSheetByName(name);
    if (!sh) sh = ss.insertSheet(name);
    ensureHeaders(sh, schemas[name], [], name);
  });
  return Object.keys(schemas);
}

function gtmcRequireBursar_(token) { return requireRole(token, ['admin','bursar']); }
function gtmcRequireLeadership_(token) { return requireRole(token, ['admin','principal','vice_principal','vice_principal_admin','vice_principal_academic']); }
function gtmcBool_(v) { return v === true || String(v).toLowerCase() === 'true' || String(v) === '1'; }
function gtmcMoney_(v, label) {
  const n = Number(v);
  if (!isFinite(n) || n < 0 || Math.round(n * 100) !== n * 100) throw new Error((label || 'Amount') + ' must be a valid non-negative amount with at most 2 decimal places.');
  return Math.round(n * 100) / 100;
}
function gtmcStudent_(studentId, className) {
  if (CLASSES.indexOf(className) < 0) throw new Error('Invalid class.');
  const sh = getSheet(className), last = sh.getLastRow();
  if (last < 4) throw new Error('Student not found in ' + className + '.');
  const rows = sh.getRange(4, 1, last - 3, 2).getValues();
  for (let i = 0; i < rows.length; i++) if (String(rows[i][0]) === String(studentId)) return {studentId:String(rows[i][0]), name:String(rows[i][1]), className:className};
  throw new Error('Student not found in the selected class.');
}
function gtmcValidatePeriod_(year, term) {
  if (!String(year || '').trim()) throw new Error('Academic year is required.');
  if (TERMS.indexOf(String(term || '')) < 0) throw new Error('Select a valid term.');
}
function gtmcCategories_() { return ['School Fees','Boarding Fees','Bus Fees','Other']; }
function gtmcActive_(r) { return r.active === '' || r.active === undefined || gtmcBool_(r.active); }
function gtmcFinancialRows_(studentId, className, year, term) {
  const structures = sheetToObjects(getSheet('FeeStructures')).filter(function(r) {
    return String(r.class)===className && String(r.academic_year)===year && String(r.term)===term && String(r.category)==='School Fees' && gtmcActive_(r);
  });
  const charges = sheetToObjects(getSheet('StudentCharges')).filter(function(r) {
    return String(r.student_id)===studentId && String(r.class)===className && String(r.academic_year)===year && String(r.term)===term && gtmcActive_(r);
  });
  const payments = sheetToObjects(getSheet('FeePayments')).filter(function(r) {
    return String(r.student_id)===studentId && String(r.class)===className && String(r.academic_year)===year && String(r.term)===term && String(r.status||'posted').toLowerCase()==='posted';
  });
  const due = {};
  structures.forEach(function(r) { due[String(r.category)] = (due[String(r.category)] || 0) + Number(r.amount || 0); });
  charges.forEach(function(r) { due[String(r.category)] = (due[String(r.category)] || 0) + Number(r.amount || 0); });
  const paid = {};
  payments.forEach(function(r) { paid[String(r.allocated_category)] = (paid[String(r.allocated_category)] || 0) + Number(r.amount || 0); });
  const categories = Array.from(new Set(Object.keys(due).concat(Object.keys(paid))));
  const lines = categories.map(function(category) {
    const amountDue = Math.round((due[category] || 0) * 100) / 100;
    const amountPaid = Math.round((paid[category] || 0) * 100) / 100;
    return {category:category, amountDue:amountDue, amountPaid:amountPaid, balance:Math.round((amountDue-amountPaid)*100)/100, compulsory:category==='School Fees'};
  });
  const totalDue = lines.reduce(function(a,x){return a+x.amountDue;},0);
  const totalPaid = lines.reduce(function(a,x){return a+x.amountPaid;},0);
  return {lines:lines,totalDue:Math.round(totalDue*100)/100,totalPaid:Math.round(totalPaid*100)/100,balance:Math.round((totalDue-totalPaid)*100)/100,payments:payments.sort(function(a,b){return new Date(b.recorded_at||0)-new Date(a.recorded_at||0);})};
}

function adminSaveFeeStructure(p, token) {
  const user = gtmcRequireBursar_(token); gtmcEnsureModuleSheets_();
  const cn=String(p.className||'').trim(), year=String(p.academicYear||'').trim(), term=String(p.term||'').trim(), category=String(p.category||'').trim();
  gtmcValidatePeriod_(year,term); if(CLASSES.indexOf(cn)<0) throw new Error('Invalid class.');
  if(gtmcCategories_().indexOf(category)<0) throw new Error('Invalid fee category.');
  if(category!=='School Fees' && gtmcBool_(p.compulsory)) throw new Error('Only School Fees can be compulsory.');
  const amount=gtmcMoney_(p.amount,'Fee amount'); if(category==='School Fees' && amount<=0) throw new Error('School Fees must be greater than zero.');
  const sh=getSheet('FeeStructures'), rows=sheetToObjects(sh); let row=-1;
  for(let i=0;i<rows.length;i++) if(String(rows[i].class)===cn&&String(rows[i].academic_year)===year&&String(rows[i].term)===term&&String(rows[i].category)===category){row=i+2;break;}
  const values=[cn,year,term,category,amount,category==='School Fees',true,new Date(),user.email];
  if(row>0) sh.getRange(row,1,1,values.length).setValues([values]); else sh.appendRow(values);
  logAudit(user.email,'adminSaveFeeStructure',{className:cn,academicYear:year,term:term,category:category,amount:amount});
  return {success:true};
}
function adminGetFeeStructures(p, token) {
  gtmcRequireBursar_(token); gtmcEnsureModuleSheets_();
  return sheetToObjects(getSheet('FeeStructures')).filter(function(r){return (!p.className||String(r.class)===String(p.className))&&(!p.academicYear||String(r.academic_year)===String(p.academicYear))&&(!p.term||String(r.term)===String(p.term));});
}
function adminAssignStudentCharge(p, token) {
  const user=gtmcRequireBursar_(token); gtmcEnsureModuleSheets_();
  const sid=String(p.studentId||'').trim(), cn=String(p.className||'').trim(), year=String(p.academicYear||'').trim(), term=String(p.term||'').trim(), category=String(p.category||'').trim();
  gtmcValidatePeriod_(year,term); const student=gtmcStudent_(sid,cn);
  if(['Boarding Fees','Bus Fees','Other'].indexOf(category)<0) throw new Error('Optional charge category must be Boarding Fees, Bus Fees or Other.');
  let rawAmount=p.amount;
  if(rawAmount===undefined||rawAmount===null||rawAmount==='') {
    const preset=sheetToObjects(getSheet('FeeStructures')).find(function(r){return String(r.class)===cn&&String(r.academic_year)===year&&String(r.term)===term&&String(r.category)===category&&gtmcActive_(r);});
    if(!preset) throw new Error('Enter an amount or configure a default amount for this optional fee category and class.');
    rawAmount=preset.amount;
  }
  const amount=gtmcMoney_(rawAmount,'Charge amount'); if(amount<=0) throw new Error('Optional charge must be greater than zero.');
  const sh=getSheet('StudentCharges'), id=Utilities.getUuid();
  sh.appendRow([id,sid,student.name,cn,year,term,category,amount,String(p.note||'').trim(),true,new Date(),user.email]);
  logAudit(user.email,'adminAssignStudentCharge',{chargeId:id,studentId:sid,className:cn,category:category,amount:amount});
  return {success:true,chargeId:id};
}
function adminCancelStudentCharge(p, token) {
  const user=gtmcRequireBursar_(token); gtmcEnsureModuleSheets_(); const id=String(p.chargeId||'').trim(); if(!id) throw new Error('Charge ID required.');
  const sh=getSheet('StudentCharges'), data=sh.getDataRange().getValues(), headers=data[0].map(String), ix=headers.indexOf('charge_id'), ax=headers.indexOf('active');
  for(let i=1;i<data.length;i++) if(String(data[i][ix])===id){
    const payments=sheetToObjects(getSheet('FeePayments')).filter(function(r){return String(r.student_id)===String(data[i][1])&&String(r.academic_year)===String(data[i][4])&&String(r.term)===String(data[i][5])&&String(r.allocated_category)===String(data[i][6])&&String(r.status||'posted')==='posted';});
    if(payments.length) throw new Error('This charge has payments against its category. Reverse/refund the payment before cancelling the charge.');
    sh.getRange(i+1,ax+1).setValue(false); logAudit(user.email,'adminCancelStudentCharge',{chargeId:id}); return {success:true};
  }
  throw new Error('Charge not found.');
}
function adminGetStudentFeeStatement(p, token) {
  gtmcRequireBursar_(token); gtmcEnsureModuleSheets_();
  const sid=String(p.studentId||'').trim(), cn=String(p.className||'').trim(), year=String(p.academicYear||'').trim(), term=String(p.term||'').trim();
  if(!sid||!cn) throw new Error('Student and class are required.'); gtmcValidatePeriod_(year,term);
  const student=gtmcStudent_(sid,cn), statement=gtmcFinancialRows_(sid,cn,year,term);
  return {student:student,academicYear:year,term:term,lines:statement.lines,charges:sheetToObjects(getSheet('StudentCharges')).filter(function(x){return String(x.student_id)===sid&&String(x.class)===cn&&String(x.academic_year)===year&&String(x.term)===term&&gtmcActive_(x);}),totalDue:statement.totalDue,totalPaid:statement.totalPaid,balance:statement.balance,payments:statement.payments};
}
function adminRecordFeePayment(p, token) {
  const user=gtmcRequireBursar_(token); gtmcEnsureModuleSheets_();
  const sid=String(p.studentId||'').trim(), cn=String(p.className||'').trim(), year=String(p.academicYear||'').trim(), term=String(p.term||'').trim(), category=String(p.category||'').trim();
  gtmcValidatePeriod_(year,term); const student=gtmcStudent_(sid,cn); const amount=gtmcMoney_(p.amount,'Payment amount');
  if(amount<=0) throw new Error('Payment amount must be greater than zero.');
  if(gtmcCategories_().indexOf(category)<0) throw new Error('Select a valid fee category.');
  const statement=gtmcFinancialRows_(sid,cn,year,term), line=statement.lines.find(function(x){return x.category===category;});
  if(!line) throw new Error('No charge exists for this student under ' + category + '.');
  if(amount>line.balance+0.0001) throw new Error('Payment exceeds the outstanding balance for ' + category + '. Current balance: ' + line.balance);
  const paymentId=Utilities.getUuid(), receiptNo='GTMC-'+Utilities.formatDate(new Date(),Session.getScriptTimeZone(),'yyyyMMdd')+'-'+Utilities.getUuid().slice(0,8).toUpperCase();
  const method=String(p.paymentMethod||'Cash').trim();
  const values=[paymentId,receiptNo,sid,student.name,cn,year,term,amount,category,method,String(p.reference||'').trim(),String(p.note||'').trim(),'posted',new Date(),user.email,'','',''];
  getSheet('FeePayments').appendRow(values);
  getSheet('FeeReceipts').appendRow([receiptNo,paymentId,sid,student.name,cn,year,term,amount,category,method,String(p.reference||'').trim(),new Date(),user.email,'issued']);
  logAudit(user.email,'adminRecordFeePayment',{paymentId:paymentId,receiptNo:receiptNo,studentId:sid,className:cn,amount:amount,category:category});
  const after=gtmcFinancialRows_(sid,cn,year,term);
  return {success:true,paymentId:paymentId,receiptNo:receiptNo,statement:{totalDue:after.totalDue,totalPaid:after.totalPaid,balance:after.balance,lines:after.lines}};
}
function adminReverseFeePayment(p, token) {
  const user=gtmcRequireBursar_(token); gtmcEnsureModuleSheets_(); const id=String(p.paymentId||'').trim(), reason=String(p.reason||'').trim();
  if(!id||!reason) throw new Error('Payment ID and reversal reason are required.');
  const sh=getSheet('FeePayments'), data=sh.getDataRange().getValues(), h=data[0].map(String), ix={}; h.forEach(function(x,i){ix[x]=i;});
  for(let i=1;i<data.length;i++) if(String(data[i][ix.payment_id])===id){
    if(String(data[i][ix.status])!=='posted') throw new Error('Only posted payments can be reversed.');
    sh.getRange(i+1,ix.status+1).setValue('reversed'); sh.getRange(i+1,ix.reversed_at+1).setValue(new Date()); sh.getRange(i+1,ix.reversed_by+1).setValue(user.email); sh.getRange(i+1,ix.reversal_reason+1).setValue(reason);
    const rec=getSheet('FeeReceipts'), rd=rec.getDataRange().getValues(), rh=rd[0].map(String), pi=rh.indexOf('payment_id'), si=rh.indexOf('status');
    for(let j=1;j<rd.length;j++) if(String(rd[j][pi])===id) rec.getRange(j+1,si+1).setValue('reversed');
    logAudit(user.email,'adminReverseFeePayment',{paymentId:id,reason:reason}); return {success:true};
  }
  throw new Error('Payment not found.');
}
function adminGetFeeOverview(p, token) {
  gtmcRequireBursar_(token); gtmcEnsureModuleSheets_();
  const year=String(p.academicYear||'').trim(), term=String(p.term||'').trim(); gtmcValidatePeriod_(year,term);
  const classes=p.className?[String(p.className)]:CLASSES;
  const structures=sheetToObjects(getSheet('FeeStructures')).filter(function(r){return String(r.academic_year)===year&&String(r.term)===term&&String(r.category)==='School Fees'&&gtmcActive_(r);});
  const charges=sheetToObjects(getSheet('StudentCharges')).filter(function(r){return String(r.academic_year)===year&&String(r.term)===term&&gtmcActive_(r);});
  const payments=sheetToObjects(getSheet('FeePayments')).filter(function(r){return String(r.academic_year)===year&&String(r.term)===term&&String(r.status||'posted').toLowerCase()==='posted';});
  const feeByClass={}, chargeByStudent={}, paidByStudent={};
  structures.forEach(function(r){feeByClass[String(r.class)]=(feeByClass[String(r.class)]||0)+Number(r.amount||0);});
  charges.forEach(function(r){const k=String(r.class)+'|'+String(r.student_id);chargeByStudent[k]=(chargeByStudent[k]||0)+Number(r.amount||0);});
  payments.forEach(function(r){const k=String(r.class)+'|'+String(r.student_id);paidByStudent[k]=(paidByStudent[k]||0)+Number(r.amount||0);});
  const output=[]; let due=0,paid=0,students=0,owing=0;
  classes.forEach(function(cn){
    if(CLASSES.indexOf(cn)<0) throw new Error('Invalid class: '+cn);
    const sh=getSheet(cn), last=sh.getLastRow(), rows=last>=4?sh.getRange(4,1,last-3,2).getValues():[];
    let cd=0,cp=0,co=0,cs=0;
    rows.forEach(function(r){if(!r[0]||!r[1])return; const k=cn+'|'+String(r[0]); const d=(feeByClass[cn]||0)+(chargeByStudent[k]||0), q=paidByStudent[k]||0; cs++;cd+=d;cp+=q;if(d-q>0.0001)co++;});
    due+=cd;paid+=cp;students+=cs;owing+=co;
    output.push({className:cn,students:cs,totalDue:Math.round(cd*100)/100,totalPaid:Math.round(cp*100)/100,outstanding:Math.round((cd-cp)*100)/100,studentsWithBalance:co});
  });
  return {academicYear:year,term:term,classes:output,totalStudents:students,totalDue:Math.round(due*100)/100,totalPaid:Math.round(paid*100)/100,outstanding:Math.round((due-paid)*100)/100,studentsWithBalance:owing,collectionRate:due?Math.round(paid/due*10000)/100:0};
}
function adminGetFeeReceipt(p, token) {
  gtmcRequireBursar_(token); gtmcEnsureModuleSheets_(); const no=String(p.receiptNo||'').trim(); if(!no) throw new Error('Receipt number required.');
  const r=sheetToObjects(getSheet('FeeReceipts')).find(function(x){return String(x.receipt_no)===no;}); if(!r) throw new Error('Receipt not found.'); return r;
}
function parentGetFeeStatement(p, token) {
  const parent=requireRole(token,['parent']); gtmcEnsureModuleSheets_(); const sid=String(p.studentId||'').trim(), cn=String(p.className||'').trim(), year=String(p.academicYear||'').trim(), term=String(p.term||'').trim();
  if(!sid||!cn) throw new Error('Student and class are required.'); gtmcValidatePeriod_(year,term); portalAssertLinkedParent_(parent,cn,sid);
  const student=gtmcStudent_(sid,cn), s=gtmcFinancialRows_(sid,cn,year,term);
  return {student:student,academicYear:year,term:term,lines:s.lines,totalDue:s.totalDue,totalPaid:s.totalPaid,balance:s.balance,payments:s.payments.map(function(x){return {receipt_no:x.receipt_no,amount:x.amount,allocated_category:x.allocated_category,recorded_at:x.recorded_at,status:x.status};})};
}

function leadershipGetDashboard(p, token) {
  const user = gtmcRequireLeadership_(token);
  const term = String(p.term || 'Term1');
  const assessment = String(p.assessment || 'total');
  if (TERMS.indexOf(term) < 0) throw new Error('Invalid term.');
  if (['total','T1','T2','T3','Exam'].indexOf(assessment) < 0) throw new Error('Invalid assessment.');

  const classes = p.className ? [String(p.className)] : CLASSES.slice();
  const classSummaries = [];
  const schoolSubjects = {};
  let schoolSum = 0, schoolCount = 0, schoolEntered = 0, schoolExpected = 0;

  classes.forEach(function(className) {
    if (CLASSES.indexOf(className) < 0) throw new Error('Invalid class: ' + className);
    const sh = getSheet(className);
    const last = sh.getLastRow();
    const subjects = subjectsForClass(className);
    const studentRows = last >= 4 ? sh.getRange(4, 1, last - 3, 2).getValues() : [];
    const scoreStart = 3 + TERMS.indexOf(term) * subjects.length * FIELDS.length;
    const scoreRows = studentRows.length
      ? sh.getRange(4, scoreStart, studentRows.length, subjects.length * FIELDS.length).getValues()
      : [];

    const subjectPerformance = [];
    let classSum = 0, classCount = 0, enteredTotals = 0;
    const studentCount = studentRows.filter(function(row) { return row[0] && row[1]; }).length;
    schoolExpected += studentCount * subjects.length;

    subjects.forEach(function(subject, subjectIndex) {
      let sum = 0, count = 0, high = null, low = null;
      studentRows.forEach(function(student, rowIndex) {
        if (!student[0] || !student[1]) return;
        const row = scoreRows[rowIndex] || [];
        const base = subjectIndex * FIELDS.length;
        const values = row.slice(base, base + FIELDS.length);
        let raw = null, maximum = null;

        if (assessment === 'total') {
          const complete = values.length === FIELDS.length && values.every(function(v) {
            return v !== '' && v !== null && v !== undefined && isFinite(Number(v));
          });
          if (complete) {
            raw = values.reduce(function(total, value) { return total + Number(value); }, 0);
            maximum = 100;
          }
        } else {
          const fieldIndex = FIELDS.indexOf(assessment);
          const value = values[fieldIndex];
          if (value !== '' && value !== null && value !== undefined && isFinite(Number(value))) {
            raw = Number(value);
            maximum = assessment === 'Exam' ? 70 : 10;
          }
        }

        if (raw === null || maximum === null) return;
        const percentage = raw / maximum * 100;
        sum += percentage;
        count++;
        high = high === null ? percentage : Math.max(high, percentage);
        low = low === null ? percentage : Math.min(low, percentage);
      });

      const average = count ? Math.round(sum / count * 100) / 100 : null;
      subjectPerformance.push({
        subject: subject,
        average: average,
        highest: high === null ? null : Math.round(high * 100) / 100,
        lowest: low === null ? null : Math.round(low * 100) / 100,
        scoresEntered: count
      });
      classSum += sum;
      classCount += count;
      enteredTotals += count;

      if (!schoolSubjects[subject]) schoolSubjects[subject] = { sum: 0, count: 0, high: null, low: null };
      if (count) {
        const bucket = schoolSubjects[subject];
        bucket.sum += sum;
        bucket.count += count;
        bucket.high = bucket.high === null ? high : Math.max(bucket.high, high);
        bucket.low = bucket.low === null ? low : Math.min(bucket.low, low);
      }
    });

    const average = classCount ? Math.round(classSum / classCount * 100) / 100 : null;
    schoolSum += classSum;
    schoolCount += classCount;
    schoolEntered += enteredTotals;
    const submissions = sheetToObjects(getSheet('Submissions')).filter(function(row) {
      return String(row.class) === className && String(row.term) === term;
    });
    const expectedSubmissions = subjects.length * (assessment === 'total' ? FIELDS.length : 1);
    const submittedSubjects = new Set(submissions.filter(function(row) {
      const status = String(row.status || '').toLowerCase();
      return (status === 'submitted' || status === 'locked') &&
        (assessment === 'total' || String(row.assessment || '') === assessment);
    }).map(function(row) { return String(row.subject) + '|' + String(row.assessment || ''); })).size;

    classSummaries.push({
      className: className,
      studentCount: studentCount,
      average: average,
      performance: average === null ? 'No Scores' : average < 50 ? 'Needs Attention' : average < 60 ? 'Satisfactory' : 'Strong',
      coverage: studentCount && subjects.length ? Math.round((assessment === 'total' ? enteredTotals : classCount) / (studentCount * subjects.length) * 10000) / 100 : 0,
      submissionCoverage: expectedSubmissions ? Math.min(100, Math.round(submittedSubjects / expectedSubmissions * 10000) / 100) : 0,
      subjectPerformance: subjectPerformance
    });
  });

  classSummaries.sort(function(a, b) {
    if (a.average === null) return b.average === null ? a.className.localeCompare(b.className) : -1;
    if (b.average === null) return 1;
    return a.average - b.average;
  });

  const subjectPerformance = Object.keys(schoolSubjects).map(function(subject) {
    const bucket = schoolSubjects[subject];
    return {
      subject: subject,
      average: bucket.count ? Math.round(bucket.sum / bucket.count * 100) / 100 : null,
      highest: bucket.high === null ? null : Math.round(bucket.high * 100) / 100,
      lowest: bucket.low === null ? null : Math.round(bucket.low * 100) / 100,
      scoresEntered: bucket.count
    };
  }).sort(function(a, b) {
    if (a.average === null) return 1;
    if (b.average === null) return -1;
    return a.average - b.average;
  });

  const validClasses = classSummaries.filter(function(row) { return row.average !== null; });
  const overallAverage = schoolCount ? Math.round(schoolSum / schoolCount * 100) / 100 : null;

  return {
    generatedAt: new Date().toISOString(),
    generatedFor: user.email,
    term: term,
    assessment: assessment,
    classes: classSummaries,
    weakestClasses: classSummaries.filter(function(row) { return row.average !== null; }).slice(0, 5),
    subjectPerformance: subjectPerformance,
    overallAverage: overallAverage,
    scoreCoverage: schoolExpected ? Math.round(schoolEntered / schoolExpected * 10000) / 100 : 0,
    note: 'Aggregate academic indicators only. No student names, IDs or individual marks are returned.'
  };
}

function adminCreateRoleAccount(p, token) {
  const admin=requireRole(token,['admin']);
  const allowed=['principal','vice_principal','vice_principal_admin','vice_principal_academic','registrar','bursar'];
  const roles=String(p.role||'').split(',').map(function(x){return x.trim();}).filter(Boolean);
  if(!p.email||!p.name||!p.password||!roles.length) throw new Error('Name, email, password and role are required.');
  roles.forEach(function(r){if(allowed.indexOf(r)<0) throw new Error('Invalid leadership/finance role: '+r);});
  const sh=getSheet('Users'), rows=sheetToObjects(sh); if(rows.some(function(r){return String(r.email).toLowerCase()===String(p.email).toLowerCase();})) throw new Error('Email already exists.');
  sh.appendRow([String(p.email).trim(),String(p.name).trim(),roles.join(','),'','',gtmcPasswordHash_(String(p.password)),true,'']);
  logAudit(admin.email,'adminCreateRoleAccount',{email:p.email,roles:roles}); return {success:true};
}

/* ============ ADMIN USER MANAGEMENT (ADDITIVE) ============ */
const GTMC_MANAGED_ROLES_ = ['admin','principal','vice_principal','vice_principal_admin','vice_principal_academic','registrar','bursar','class_teacher','subject_teacher','student'];

function adminUserSheetInfo_() {
  const sh = getSheet('Users');
  const values = sh.getDataRange().getValues();
  if (!values.length) throw new Error('Users sheet has no header row');
  const headers = values[0].map(function (h) { return String(h || '').trim().toLowerCase(); });
  ['email','name','role','class','subjects','password','active','class_teacher_class'].forEach(function (key) {
    if (headers.indexOf(key) < 0) throw new Error('Users sheet is missing required column: ' + key);
  });
  return { sheet: sh, values: values, headers: headers };
}
function adminUserRow_(info, email) {
  const col = info.headers.indexOf('email');
  const target = String(email || '').trim().toLowerCase();
  for (let i = 1; i < info.values.length; i++) {
    if (String(info.values[i][col] || '').trim().toLowerCase() === target) return i + 1;
  }
  return 0;
}
function adminListUsers(p, token) {
  requireRole(token, ['admin']);
  const info = adminUserSheetInfo_();
  const ix = function (key) { return info.headers.indexOf(key); };
  return info.values.slice(1).filter(function (r) { return String(r[ix('email')] || '').trim(); }).map(function (r) {
    return {
      email: String(r[ix('email')] || ''), name: String(r[ix('name')] || ''),
      role: String(r[ix('role')] || ''), roles: String(r[ix('role')] || '').split(',').map(function(x){return x.trim();}).filter(Boolean),
      class: String(r[ix('class')] || ''), subjects: String(r[ix('subjects')] || ''),
      class_teacher_class: String(r[ix('class_teacher_class')] || ''), active: r[ix('active')] === true || String(r[ix('active')]).toLowerCase() === 'true'
    };
  });
}
function adminCreateUser(p, token) {
  const admin = requireRole(token, ['admin']);
  const email = String(p.email || '').trim().toLowerCase();
  const name = String(p.name || '').trim();
  const password = String(p.password || '');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Enter a valid email address.');
  if (!name) throw new Error('Full name is required.');
  if (password.length < 6) throw new Error('Password must contain at least 6 characters.');
  const roles = String(p.roles || p.role || '').split(',').map(function (x) { return x.trim().toLowerCase(); }).filter(Boolean);
  if (!roles.length) throw new Error('Select at least one role.');
  roles.forEach(function (r) { if (GTMC_MANAGED_ROLES_.indexOf(r) < 0) throw new Error('Unsupported role: ' + r); });
  const info = adminUserSheetInfo_();
  if (adminUserRow_(info, email)) throw new Error('An account with this email already exists.');
  const sh = info.sheet;
  const values = { email: email, name: name, role: Array.from(new Set(roles)).join(','), class: String(p.class || '').trim(), subjects: String(p.subjects || '').trim(), password: gtmcPasswordHash_(password), active: true, class_teacher_class: String(p.class_teacher_class || '').trim() };
  const row = info.headers.map(function (h) { return Object.prototype.hasOwnProperty.call(values, h) ? values[h] : ''; });
  sh.appendRow(row);
  logAudit(admin.email, 'adminCreateUser', { email: email, roles: roles });
  return { success: true, email: email, roles: roles, message: 'User account created.' };
}
function adminUpdateUser(p, token) {
  const admin = requireRole(token, ['admin']);
  const email = String(p.email || '').trim().toLowerCase();
  if (!email) throw new Error('User email is required.');
  const info = adminUserSheetInfo_();
  const row = adminUserRow_(info, email);
  if (!row) throw new Error('User account not found.');
  const allowed = ['name','role','class','subjects','class_teacher_class'];
  const updates = {};
  allowed.forEach(function (key) {
    if (Object.prototype.hasOwnProperty.call(p, key)) updates[key] = String(p[key] == null ? '' : p[key]).trim();
  });
  if (Object.prototype.hasOwnProperty.call(updates, 'name') && !updates.name) throw new Error('Name cannot be blank.');
  if (Object.prototype.hasOwnProperty.call(updates, 'role')) {
    const roles = updates.role.split(',').map(function(x){return x.trim().toLowerCase();}).filter(Boolean);
    if (!roles.length) throw new Error('At least one role is required.');
    roles.forEach(function(r){if(GTMC_MANAGED_ROLES_.indexOf(r)<0)throw new Error('Unsupported role: '+r);});
    updates.role = Array.from(new Set(roles)).join(',');
  }
  Object.keys(updates).forEach(function (key) { info.sheet.getRange(row, info.headers.indexOf(key) + 1).setValue(updates[key]); });
  logAudit(admin.email, 'adminUpdateUser', { email: email, fields: Object.keys(updates) });
  return { success: true, email: email };
}
function adminSetUserActive(p, token) {
  const admin = requireRole(token, ['admin']);
  const email = String(p.email || '').trim().toLowerCase();
  const active = p.active === true || String(p.active).toLowerCase() === 'true';
  if (!email) throw new Error('User email is required.');
  if (!active && email === String(admin.email).toLowerCase()) throw new Error('You cannot deactivate your own account.');
  const info = adminUserSheetInfo_();
  const row = adminUserRow_(info, email);
  if (!row) throw new Error('User account not found.');
  const roleCol = info.headers.indexOf('role');
  if (!active && String(info.sheet.getRange(row, roleCol + 1).getValue()).split(',').map(function(x){return x.trim();}).indexOf('admin') >= 0) {
    const activeAdmins = info.values.slice(1).filter(function(r){return String(r[roleCol]||'').split(',').map(function(x){return x.trim();}).indexOf('admin')>=0 && (r[info.headers.indexOf('active')]===true || String(r[info.headers.indexOf('active')]).toLowerCase()==='true');});
    if (activeAdmins.length <= 1) throw new Error('The last active admin account cannot be deactivated.');
  }
  info.sheet.getRange(row, info.headers.indexOf('active') + 1).setValue(active);
  logAudit(admin.email, active ? 'adminActivateUser' : 'adminDeactivateUser', { email: email });
  return { success: true, email: email, active: active };
}
function adminResetUserPassword(p, token) {
  const admin = requireRole(token, ['admin']);
  const email = String(p.email || '').trim().toLowerCase();
  const password = String(p.password || '');
  if (!email) throw new Error('User email is required.');
  if (password.length < 6) throw new Error('New password must contain at least 6 characters.');
  const info = adminUserSheetInfo_();
  const row = adminUserRow_(info, email);
  if (!row) throw new Error('User account not found.');
  info.sheet.getRange(row, info.headers.indexOf('password') + 1).setValue(gtmcPasswordHash_(password));
  logAudit(admin.email, 'adminResetUserPassword', { email: email });
  return { success: true, email: email, message: 'Password reset successfully.' };
}


/* v16 ROLE SUPPORT: registrar and vice_principal are canonical selectable roles. Legacy vice_principal_admin and vice_principal_academic remain supported for existing accounts. Registrar can manage student registration/directory records only; vice_principal receives leadership aggregate dashboard access, not unrestricted admin access. */
