/* GTMC Admin User Management — frontend extension */
(function(){
  function q(id){return document.getElementById(id);}
  function esc(v){return typeof window.esc==='function'?window.esc(v==null?'':String(v)):String(v==null?'':v);}
  var roles=['admin','principal','vice_principal','vice_principal_admin','vice_principal_academic','bursar','registrar','class_teacher','subject_teacher','student'];
  function roleLabel(r){return ({admin:'Administrator',principal:'Principal',vice_principal:'Vice Principal',bursar:'Bursar',registrar:'Registrar',class_teacher:'Class Teacher',subject_teacher:'Subject Teacher',student:'Student'})[r]||r;}
  function addNav(){
    var side=q('sidebar'); if(!side||side.querySelector('[data-tab="userManagement"]'))return;
    side.insertAdjacentHTML('beforeend','<div class="nav-item" data-tab="userManagement" onclick="setNav(\'userManagement\')"><span class="dot"></span><span>User Management</span></div>');
  }
  function install(){
    if(!q('main')||document.querySelector('[data-panel="userManagement"]'))return;
    addNav();
    q('main').insertAdjacentHTML('beforeend',`
      <div class="panel" data-panel="userManagement">
        <div class="page-head"><h1>User Management</h1><p>Create and manage staff and student accounts. Parent accounts remain in Parent Account Management.</p></div>
        <div class="card">
          <h2>Create Account</h2>
          <div class="grid cols-4">
            <div><label>Full name</label><input id="umName" autocomplete="name"></div>
            <div><label>Email</label><input id="umEmail" type="email" autocomplete="email"></div>
            <div><label>Temporary password</label><input id="umPassword" type="password" autocomplete="new-password" minlength="8"></div>
            <div><label>Account roles (select multiple)</label><select id="umRole" multiple size="4">${roles.map(r=>'<option value="'+r+'">'+roleLabel(r)+'</option>').join('')}</select><small class="sub">Select more than one role for combined duties, such as Principal + Bursar.</small></div>
            <div><label>Default class (optional)</label><select id="umClass"><option value="">— None —</option>${(window.__gtmcClasses||[]).map(c=>'<option value="'+esc(c)+'">'+esc(c)+'</option>').join('')}</select></div>
            <div><label>Class teacher class (optional)</label><select id="umCTClass"><option value="">— None —</option>${(window.__gtmcClasses||[]).map(c=>'<option value="'+esc(c)+'">'+esc(c)+'</option>').join('')}</select></div>
            <div style="grid-column:span 2"><label>Subjects (comma-separated, for subject teachers)</label><input id="umSubjects" placeholder="e.g. Mathematics, Physics"></div>
          </div>
          <div class="row" style="margin-top:14px"><button class="ok" id="umCreateBtn" onclick="gtmcCreateManagedUser()">Create Account</button><span class="sub">Use at least 8 characters for the temporary password.</span></div>
        </div>
        <div class="card">
          <div class="row" style="justify-content:space-between"><div><h2>All Accounts</h2><p class="sub">Change role, assignments and account status. Passwords are never displayed.</p></div><button class="sec sm" onclick="gtmcLoadManagedUsers()">Refresh</button></div>
          <div class="portal-toolbar"><input id="umSearch" class="table-search" placeholder="Search by name, email or role" oninput="gtmcFilterManagedUsers(this.value)"></div>
          <div id="umUsersBox"><div class="empty">Loading accounts…</div></div>
        </div>
      </div>`);
    gtmcLoadManagedUsers();
  }
  window.gtmcCreateManagedUser=async function(){
    var name=q('umName').value.trim(),email=q('umEmail').value.trim(),password=q('umPassword').value,roles=Array.from(q('umRole').selectedOptions).map(function(o){return o.value;});
    if(!name||!email||!password||!roles.length)return toast('Complete the name, email, temporary password and select at least one role.','err');
    if(password.length<8)return toast('Temporary password must be at least 8 characters.','err');
    var b=q('umCreateBtn');b.disabled=true;b.textContent='Creating…';
    try{
      await api('adminCreateUser',{name:name,email:email,password:password,roles:roles.join(','),class:q('umClass').value,class_teacher_class:q('umCTClass').value,subjects:q('umSubjects').value.trim()});
      q('umName').value='';q('umEmail').value='';q('umPassword').value='';q('umSubjects').value='';
      toast('Account created successfully.','ok');await gtmcLoadManagedUsers();
    }catch(e){toast(e.message,'err');}finally{b.disabled=false;b.textContent='Create Account';}
  };
  window.gtmcLoadManagedUsers=async function(){
    var box=q('umUsersBox');if(!box)return;box.innerHTML='<div class="empty">Loading accounts…</div>';
    try{
      var rows=await api('adminListUsers');
      if(!rows.length){box.innerHTML='<div class="empty">No accounts found.</div>';return;}
      box.innerHTML='<div class="table-wrap"><table><thead><tr><th>Name / Email</th><th>Role</th><th>Default class</th><th>Class teacher class</th><th>Subjects</th><th>Status</th><th>Actions</th></tr></thead><tbody>'+
      rows.map(function(u,i){return '<tr data-um-row><td><strong>'+esc(u.name)+'</strong><br><small>'+esc(u.email)+'</small></td>'+
      '<td><select id="umRole_'+i+'" multiple size="4">'+roles.map(function(r){return '<option value="'+r+'" '+((u.roles||String(u.role||'').split(',')).indexOf(r)>=0?'selected':'')+'>'+roleLabel(r)+'</option>';}).join('')+'</select></td>'+
      '<td><input id="umClass_'+i+'" value="'+esc(u.class)+'" style="min-width:90px"></td>'+
      '<td><select id="umCT_'+i+'"><option value="">— None —</option>'+(window.__gtmcClasses||[]).map(function(c){return '<option value="'+esc(c)+'" '+(u.class_teacher_class===c?'selected':'')+'>'+esc(c)+'</option>';}).join('')+'</select></td>'+
      '<td><input id="umSub_'+i+'" value="'+esc(u.subjects)+'" style="min-width:130px"></td>'+
      '<td><span class="badge '+(u.active?'ok':'warn')+'">'+(u.active?'Active':'Disabled')+'</span></td>'+
      '<td><div class="row"><button class="blue sm" onclick="gtmcSaveManagedUser('+i+')">Save</button><button class="sec sm" onclick="gtmcResetManagedPassword('+JSON.stringify(u.email).replace(/"/g,'&quot;')+')">Reset password</button><button class="'+(u.active?'danger':'ok')+' sm" onclick="gtmcToggleManagedUser('+JSON.stringify(u.email).replace(/"/g,'&quot;')+','+(!u.active)+')">'+(u.active?'Disable':'Enable')+'</button></div></td></tr>';}).join('')+
      '</tbody></table></div>';
      window.__gtmcManagedUsers=rows;
      gtmcFilterManagedUsers(q('umSearch')?q('umSearch').value:'');
    }catch(e){box.innerHTML='<div class="empty">'+esc(e.message)+'</div>';}
  };
  window.gtmcSaveManagedUser=async function(i){
    var u=(window.__gtmcManagedUsers||[])[i];if(!u)return;
    try{await api('adminUpdateUser',{email:u.email,name:u.name,role:Array.from(q('umRole_'+i).selectedOptions).map(function(o){return o.value;}).join(','),class:q('umClass_'+i).value,class_teacher_class:q('umCT_'+i).value,subjects:q('umSub_'+i).value});toast('Account updated.','ok');await gtmcLoadManagedUsers();}
    catch(e){toast(e.message,'err');}
  };
  window.gtmcToggleManagedUser=async function(email,active){
    if(!confirm((active?'Enable':'Disable')+' this account?'))return;
    try{await api('adminSetUserStatus',{email:email,active:active});toast('Account status updated.','ok');await gtmcLoadManagedUsers();}
    catch(e){toast(e.message,'err');}
  };
  window.gtmcResetManagedPassword=async function(email){
    var password=prompt('Enter a new temporary password (at least 8 characters) for '+email+':');
    if(password===null)return;if(password.length<8)return toast('Password must be at least 8 characters.','err');
    try{await api('adminResetUserPassword',{email:email,password:password});toast('Password reset. Share it securely with the account holder.','ok');}
    catch(e){toast(e.message,'err');}
  };
  window.gtmcFilterManagedUsers=function(value){
    var n=String(value||'').toLowerCase();document.querySelectorAll('[data-um-row]').forEach(function(r){r.style.display=!n||r.textContent.toLowerCase().indexOf(n)>=0?'':'none';});
  };
  var prev=window.renderAdmin;
  if(typeof prev==='function')window.renderAdmin=async function(){await prev.apply(this,arguments);install();};
  var prevBoot=window.boot;
  if(typeof prevBoot==='function')window.boot=async function(){
    if(S.user && (hasRole('principal')||hasRole('vice_principal')||hasRole('registrar')) && !hasRole('bursar')){
      q('loginView').style.display='none';q('appView').style.display='flex';
      q('userLabel').textContent=S.user.name||S.user.email;
      q('userRole').textContent=hasRole('principal')?'Principal':hasRole('vice_principal')?'Vice Principal':'Registrar';
      if(typeof applyLogoFallback==='function')applyLogoFallback();
      q('main').innerHTML='<div class="page-head"><h1>School Overview</h1><p>Read-only leadership overview. Student marks and financial records are not exposed here.</p></div><div class="grid cols-4" id="leadershipStats"><div class="card">Loading overview…</div></div>';
      try{var d=await api('staffGetLeadershipOverview');q('leadershipStats').innerHTML=[['Active accounts',d.activeStaff],['Teachers',d.teachers],['Classes',d.classes],['Score submissions',d.scoreSubmissions]].map(function(x){return '<div class="card stat-card"><div class="sub">'+x[0]+'</div><div class="stat-number">'+x[1]+'</div></div>';}).join('');}
      catch(e){q('leadershipStats').innerHTML='<div class="card">'+esc(e.message)+'</div>';}
      return;
    }
    return prevBoot.apply(this,arguments);
  };
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',function(){if(S.user&&hasRole('admin'))install();});
  else if(S.user&&hasRole('admin'))install();
})();