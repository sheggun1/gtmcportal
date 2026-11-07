/* GTMC Admin Feature Controls
 * Central feature visibility controls. Backend persistence is provided by
 * apps-script/GTMC_Feature_Controls_Addon.gs.
 */
(function(){
  'use strict';
  var FEATURES=[
    ['teachers','Staff & User Management','Administration','Create and manage staff accounts and assignments.'],
    ['parents','Parent Accounts','Administration','Parent account and ward-link management.'],
    ['submissions','Assessment Submissions','Academics','Review and manage submitted assessments.'],
    ['publish','Publish Results','Academics','Publish assessment and term results.'],
    ['broadsheet','Broadsheet','Academics','Class and subject performance broadsheets.'],
    ['performance','Performance Analytics','Academics','Teacher and student performance analysis.'],
    ['domains','Affective & Psychomotor','Academics','Manage student behavioural and psychomotor ratings.'],
    ['remarks','Class Teacher Remarks','Academics','Class teacher comments and recommendations.'],
    ['teacherRemarks','Subject Teacher Remarks','Academics','Subject teacher comments.'],
    ['calendar','School Calendar','Communication','School events and academic calendar.'],
    ['announcements','Announcements','Communication','School-wide notices and updates.'],
    ['debtors','Debtors & Finance','Finance','Outstanding balances and fee records.'],
    ['staffPayments','Staff Payment Notifications','Finance','Review parent payment notifications and clear verified payments.'],
    ['parentPayments','Parent Payment Notifications','Finance','Allow parents to report payments and track school replies.'],
    ['reportcards','Report Cards','Results','Generate and download student report cards.'],
    ['template','Result Template','Results','Configure report-card layout and display options.'],
    ['students','Student Records','Records','View and manage student records.'],
    ['scores','Score Management','Records','View and manage assessment scores.'],
    ['entry','Score Entry','Records','Enter assessment scores.'],
    ['history','Assessment History','Records','View previous assessment records.'],
    ['results','Student Results','Results','View published student results.'],
    ['report','Reports','Results','View and export academic reports.'],
    ['testPerformance','Test Performance','Academics','Monitor test and assessment entry progress.'],
    ['chat','AI Learning Assistant','Learning','AI-supported teaching and learning tools.'],
    ['library','School e-Library','Learning','Books, notes, past questions and learning resources.'],
    ['myAttendance','My Attendance','Staff','Personal staff attendance record.'],
    ['attendanceSummary','Attendance Summary','Staff','Attendance summaries and reports.'],
    ['staffAttendance','Staff Attendance','Staff','Staff attendance register and clock-in records.'],
    ['staffLinks','Staff Attendance Links','Staff','Link attendance machine IDs to staff accounts.'],
    ['messageAdmin','Contact Administrator','Staff','Send messages or complaints to the administrator.'],
    ['staffMessages','Staff Messages','Staff','Review staff messages and complaints.'],
    ['userManagement','User Management','Administration','Manage portal accounts and permissions.']
  ];
  var FEATURE_MAP={};
  FEATURES.forEach(function(x){FEATURE_MAP[x[0]]=x;});
  var flags={};
  var loaded=false;
  var loadError='';
  var observer=null;
  function q(id){return document.getElementById(id);}
  function admin(){return typeof hasRole==='function'&&hasRole('admin');}
  function enabled(id){return flags[id]!==false;}
  function applyVisibility(){
    document.querySelectorAll('.nav-item[data-tab]').forEach(function(n){
      var id=n.getAttribute('data-tab');
      if(id==='featureControls')return;
      n.style.display=enabled(id)?'':'none';
      n.setAttribute('aria-hidden',enabled(id)?'false':'true');
    });
    document.querySelectorAll('.panel[data-panel]').forEach(function(p){
      var id=p.getAttribute('data-panel');
      if(id==='featureControls')return;
      p.style.display=enabled(id)?'':'none';
    });
    var active=document.querySelector('.nav-item.active[data-tab]');
    if(active&&!enabled(active.getAttribute('data-tab'))){
      if(typeof window.setNav==='function')window.setNav('dashboard');
    }
  }
  window.GTMC_FEATURES=FEATURES;
  window.GTMC_FEATURE_FLAGS=flags;
  window.GTMC_FEATURES_LOADED=function(){return loaded;};
  window.GTMC_FEATURE_ENABLED=enabled;
  window.GTMC_LOAD_FEATURE_FLAGS=async function(){
    try{
      var data=await api('getFeatureFlags');
      flags={};
      FEATURES.forEach(function(f){flags[f[0]] = !(data && data[f[0]]===false);});
      loaded=true;loadError='';
    }catch(e){
      loadError=e.message||'Feature settings could not be loaded.';
      FEATURES.forEach(function(f){if(typeof flags[f[0]]==='undefined')flags[f[0]]=true;});
      loaded=false;
    }
    window.GTMC_FEATURE_FLAGS=flags;
    applyVisibility();
    return flags;
  };
  window.GTMC_SAVE_FEATURE_FLAGS=async function(){
    var draft={};
    document.querySelectorAll('[data-feature-toggle]').forEach(function(el){draft[el.getAttribute('data-feature-toggle')]=!!el.checked;});
    var status=q('featureControlStatus');
    if(status)status.textContent='Saving feature settings…';
    try{
      var data=await api('adminSaveFeatureFlags',{features:draft});
      FEATURES.forEach(function(f){flags[f[0]]=!(data&&data[f[0]]===false);});
      window.GTMC_FEATURE_FLAGS=flags;
      applyVisibility();
      if(status)status.textContent='Feature settings saved. Changes are now applied to all portal users.';
      if(typeof toast==='function')toast('Feature visibility updated.','ok');
      renderControls();
    }catch(e){
      if(status)status.textContent='Could not save: '+e.message;
      if(typeof toast==='function')toast(e.message,'err');
    }
  };
  function renderControls(){
    var host=q('featureControlRows');if(!host)return;
    var groups={};
    FEATURES.forEach(function(f){(groups[f[2]]||(groups[f[2]]=[])).push(f);});
    host.innerHTML=Object.keys(groups).map(function(group){
      return '<section class="card" style="margin-bottom:12px"><h2>'+esc(group)+'</h2><div class="grid cols-2">'+groups[group].map(function(f){
        var on=enabled(f[0]);
        return '<label class="check" style="align-items:flex-start;gap:12px;padding:13px"><input type="checkbox" data-feature-toggle="'+f[0]+'" '+(on?'checked':'')+' style="margin-top:3px;width:auto"><span style="flex:1"><strong style="display:block;color:var(--ink);font-size:13px;text-transform:none;letter-spacing:0">'+esc(f[1])+'</strong><small style="display:block;color:var(--muted);font-weight:400;text-transform:none;letter-spacing:0;margin-top:3px">'+esc(f[3])+'</small><small style="display:block;margin-top:6px;color:'+(on?'#15803d':'#b45309')+';font-weight:800">'+(on?'VISIBLE TO USERS':'HIDDEN FROM USERS')+'</small></span></label>';
      }).join('')+'</div></section>';
    }).join('');
    var status=q('featureControlStatus');
    if(status){
      if(loadError)status.textContent='Feature settings could not be read from the backend: '+loadError+'. Add the feature-controls Apps Script add-on and redeploy the backend to enable shared settings.';
      else status.textContent='Switch a feature off to hide it from portal users. Switch it on when you are ready to release it. The Feature Control Centre remains available to administrators.';
    }
  }
  function installAdminPanel(){
    var main=q('main'),side=q('sidebar');
    if(!main||!side||!admin())return;
    if(!q('featureControlsPanel')){
      main.insertAdjacentHTML('beforeend',
        '<div class="panel" data-panel="featureControls" id="featureControlsPanel">'+
        '<div class="page-head"><h1>Feature Control Centre</h1><p>Choose which portal features are available to users. You can hide a new feature while preparing it, then publish it whenever you are ready.</p></div>'+
        '<div class="card"><div class="row" style="justify-content:space-between;align-items:center"><div><h2>Portal feature visibility</h2><p class="sub">Changes apply centrally to parent, teacher, bursar, registrar and leadership portals where the feature is used.</p></div><button class="sec sm" onclick="GTMC_LOAD_FEATURE_FLAGS().then(function(){GTMC_RENDER_FEATURE_CONTROLS()})">Reload settings</button></div><div class="portal-note">Hidden features are removed from navigation and cannot be opened through the portal menu. The backend add-on also blocks the mapped feature endpoints.</div><div id="featureControlRows"></div><div class="row" style="justify-content:flex-end;margin-top:14px"><button class="ok" onclick="GTMC_SAVE_FEATURE_FLAGS()">Save Feature Settings</button></div><div id="featureControlStatus" class="portal-note" style="margin-top:12px"></div></div></div>');
    }
    if(!side.querySelector('[data-tab="featureControls"]')){
      side.insertAdjacentHTML('beforeend','<div class="group" id="featureControlsNavGroup"><div class="group-title">System Settings</div><div class="nav-item" data-tab="featureControls" onclick="setNav(\'featureControls\')"><span class="dot"></span><span>Feature Control Centre</span></div></div>');
    }
    renderControls();
    applyVisibility();
  }
  window.GTMC_RENDER_FEATURE_CONTROLS=renderControls;
  var oldSetNav=window.setNav;
  if(typeof oldSetNav==='function')window.setNav=function(id){
    if(id!=='featureControls'&&!enabled(id)){
      if(typeof toast==='function')toast('This feature is currently hidden by the administrator.','err');
      return;
    }
    return oldSetNav.apply(this,arguments);
  };
  var oldBuildNav=window.buildNav;
  if(typeof oldBuildNav==='function')window.buildNav=function(items,defaultTab){
    if(!enabled(defaultTab))defaultTab='dashboard';
    var result=oldBuildNav.apply(this,[items,defaultTab]);
    applyVisibility();
    return result;
  };
  ['renderAdmin','renderClassTeacher','renderSubjectTeacher','renderParent','renderStudent'].forEach(function(name){
    var old=window[name];
    if(typeof old==='function')window[name]=async function(){
      var result=await old.apply(this,arguments);
      applyVisibility();
      if(name==='renderAdmin')installAdminPanel();
      return result;
    };
  });
  var oldBoot=window.boot;
  if(typeof oldBoot==='function')window.boot=async function(){
    await window.GTMC_LOAD_FEATURE_FLAGS();
    var result=await oldBoot.apply(this,arguments);
    applyVisibility();
    if(admin())installAdminPanel();
    return result;
  };
  if(typeof MutationObserver!=='undefined'&&q('sidebar')){
    observer=new MutationObserver(function(){applyVisibility();});
    observer.observe(q('sidebar'),{childList:true,subtree:true});
  }
  document.addEventListener('DOMContentLoaded',function(){
    if(S&&S.token&&S.user&&admin())installAdminPanel();
  });
})();
