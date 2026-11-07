/**
 * GTMC FEATURE CONTROLS ADD-ON
 * Add this file to the existing Apps Script project alongside Code.gs and
 * the other GTMC add-ons. No sheet is created; settings are stored in
 * Script Properties. Redeploy the existing web app after adding this file.
 */
var GTMC_FEATURE_DEFAULTS_ = {
  dashboard:true, teachers:true, parents:true, submissions:true, publish:true,
  broadsheet:true, performance:true, domains:true, remarks:true, teacherRemarks:true,
  calendar:true, announcements:true, debtors:true, staffPayments:true, parentPayments:true,
  reportcards:true, template:true, students:true, scores:true, entry:true, history:true,
  results:true, report:true, testPerformance:true, chat:true, library:true,
  myAttendance:true, attendanceSummary:true, staffAttendance:true, staffLinks:true,
  messageAdmin:true, staffMessages:true, userManagement:true
};
function gtmcFeatureFlags_() {
  var raw=PropertiesService.getScriptProperties().getProperty('GTMC_FEATURE_FLAGS');
  var saved={};
  if(raw)try{saved=JSON.parse(raw)||{};}catch(e){}
  var out={};
  Object.keys(GTMC_FEATURE_DEFAULTS_).forEach(function(k){
    out[k]=Object.prototype.hasOwnProperty.call(saved,k)?saved[k]!==false:true;
  });
  return out;
}
function gtmcFeatureRequireUser_(token) {
  return requireRole(token,[
    'admin','principal','vice_principal','vice_principal_admin','vice_principal_academic',
    'bursar','registrar','class_teacher','subject_teacher','student','parent'
  ]);
}
function gtmcFeatureSave_(p,token) {
  var admin= requireRole(token,['admin']);
  var incoming=p&&p.features&&typeof p.features==='object'?p.features:{};
  var current=gtmcFeatureFlags_(),next={};
  Object.keys(GTMC_FEATURE_DEFAULTS_).forEach(function(k){
    next[k]=Object.prototype.hasOwnProperty.call(incoming,k)?incoming[k]===true:current[k];
  });
  PropertiesService.getScriptProperties().setProperty('GTMC_FEATURE_FLAGS',JSON.stringify(next));
  if(typeof logAudit==='function')logAudit(admin.email,'adminSaveFeatureFlags',next);
  return next;
}
function gtmcFeatureActionMap_(action) {
  var map={
    libraryList:'library',librarySave:'library',libraryDelete:'library',
    parentSubmitPaymentNotification:'parentPayments',
    parentGetPaymentNotifications:'parentPayments',
    staffGetPaymentNotifications:'staffPayments',
    staffReplyPaymentNotification:'staffPayments'
  };
  return map[String(action||'')]||'';
}
var __gtmcFeatureOriginalRoute_=route;
route=function(action,p){
  p=p||{};
  if(action==='getFeatureFlags'){gtmcFeatureRequireUser_(p.token);return gtmcFeatureFlags_();}
  if(action==='adminSaveFeatureFlags')return gtmcFeatureSave_(p,p.token);
  var feature=gtmcFeatureActionMap_(action);
  if(feature&&gtmcFeatureFlags_()[feature]===false)throw new Error('This feature is currently unavailable. Please contact the school administrator.');
  return __gtmcFeatureOriginalRoute_(action,p);
};
