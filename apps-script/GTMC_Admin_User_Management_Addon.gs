/**
 * GTMC ADMIN USER MANAGEMENT ADD-ON
 * Add this file alongside Code.gs and the payment-notifications add-on.
 * No new sheet is created. Uses the existing Users sheet and audit log.
 *
 * Supported user roles:
 * admin, principal, vice_principal, bursar, registrar,
 * class_teacher, subject_teacher, student.
 * Parent accounts remain managed through the existing Parent Accounts tools.
 */
function gtmcUserMgmtRequireAdmin_(token) {
  return requireRole(token, ['admin']);
}
function gtmcUserMgmtHeaders_(sh) {
  var values = sh.getDataRange().getValues();
  if (!values.length) throw new Error('Users sheet has no header row.');
  var headers = values[0].map(function(h){ return String(h || '').trim().toLowerCase(); });
  var required = ['email','name','role','class','subjects','password','active','class_teacher_class'];
  required.forEach(function(k){ if (headers.indexOf(k) < 0) throw new Error('Users sheet is missing the ' + k + ' column.'); });
  return { values: values, headers: headers };
}
function gtmcUserMgmtRole_(role) {
  var allowed = ['admin','principal','vice_principal','bursar','registrar','class_teacher','subject_teacher','student'];
  var r = String(role || '').trim().toLowerCase();
  if (allowed.indexOf(r) < 0) throw new Error('Choose a supported account role.');
  return r;
}
function adminListUsers_(p, token) {
  gtmcUserMgmtRequireAdmin_(token);
  var rows = sheetToObjects(getSheet('Users'));
  return rows.map(function(u){
    return {
      email: String(u.email || ''), name: String(u.name || ''),
      role: String(u.role || ''), class: String(u.class || ''),
      class_teacher_class: String(u.class_teacher_class || ''),
      subjects: String(u.subjects || ''),
      active: u.active === true || String(u.active).toLowerCase() === 'true'
    };
  }).filter(function(u){ return !!u.email; });
}
function adminCreateUser_(p, token) {
  var admin = gtmcUserMgmtRequireAdmin_(token);
  var name = String(p.name || '').trim(), email = String(p.email || '').trim().toLowerCase();
  var password = String(p.password || ''), role = gtmcUserMgmtRole_(p.role);
  if (!name || !email || !password) throw new Error('Full name, email and temporary password are required.');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Enter a valid email address.');
  if (password.length < 8) throw new Error('Temporary password must contain at least 8 characters.');
  var sh = getSheet('Users'), hm = gtmcUserMgmtHeaders_(sh);
  var emailCol = hm.headers.indexOf('email');
  for (var i=1;i<hm.values.length;i++) if (String(hm.values[i][emailCol] || '').trim().toLowerCase() === email) throw new Error('An account with this email already exists.');
  var row = new Array(hm.headers.length).fill('');
  function put(k,v){ var c=hm.headers.indexOf(k); if(c>=0) row[c]=v; }
  put('email',email); put('name',name); put('role',role);
  put('class',String(p.class || '').trim()); put('subjects',String(p.subjects || '').trim());
  put('password',password); put('active',true);
  put('class_teacher_class',String(p.class_teacher_class || '').trim());
  sh.appendRow(row);
  logAudit(admin.email,'adminCreateUser',{email:email,role:role});
  return {success:true,email:email,role:role};
}
function adminUpdateUser_(p, token) {
  var admin = gtmcUserMgmtRequireAdmin_(token);
  var email = String(p.email || '').trim().toLowerCase();
  if(!email) throw new Error('Account email is required.');
  var role = gtmcUserMgmtRole_(p.role);
  if(email === String(admin.email || '').toLowerCase() && role !== 'admin') throw new Error('You cannot remove your own administrator role.');
  var sh=getSheet('Users'), hm=gtmcUserMgmtHeaders_(sh), emailCol=hm.headers.indexOf('email'), rowNum=-1;
  for(var i=1;i<hm.values.length;i++) if(String(hm.values[i][emailCol]||'').trim().toLowerCase()===email){rowNum=i+1;break;}
  if(rowNum<0) throw new Error('User account not found.');
  var roleCol=hm.headers.indexOf('role'), oldRole=String(hm.values[rowNum-1][roleCol]||'');
  if(oldRole.split(',').map(function(x){return x.trim();}).indexOf('admin')>=0 && role!=='admin'){
    var admins=hm.values.slice(1).filter(function(r){return String(r[roleCol]||'').split(',').map(function(x){return x.trim();}).indexOf('admin')>=0 && (r[hm.headers.indexOf('active')]===true || String(r[hm.headers.indexOf('active')]).toLowerCase()==='true');});
    if(admins.length<=1) throw new Error('The last active administrator cannot be changed.');
  }
  function set(k,v){var c=hm.headers.indexOf(k);if(c>=0)sh.getRange(rowNum,c+1).setValue(v);}
  set('name',String(p.name||'').trim()); set('role',role);
  set('class',String(p.class||'').trim()); set('subjects',String(p.subjects||'').trim());
  set('class_teacher_class',String(p.class_teacher_class||'').trim());
  logAudit(admin.email,'adminUpdateUser',{email:email,role:role});
  return {success:true};
}
function adminSetUserStatus_(p, token) {
  var admin=gtmcUserMgmtRequireAdmin_(token), email=String(p.email||'').trim().toLowerCase();
  if(!email) throw new Error('Account email is required.');
  if(email===String(admin.email||'').toLowerCase() && p.active===false) throw new Error('You cannot deactivate your own account.');
  var sh=getSheet('Users'),hm=gtmcUserMgmtHeaders_(sh),ec=hm.headers.indexOf('email'),ac=hm.headers.indexOf('active'),rc=hm.headers.indexOf('role'),rowNum=-1;
  for(var i=1;i<hm.values.length;i++) if(String(hm.values[i][ec]||'').trim().toLowerCase()===email){rowNum=i+1;break;}
  if(rowNum<0) throw new Error('User account not found.');
  var active=p.active===true;
  if(!active && String(hm.values[rowNum-1][rc]||'').split(',').map(function(x){return x.trim();}).indexOf('admin')>=0){
    var count=hm.values.slice(1).filter(function(r){return String(r[rc]||'').split(',').map(function(x){return x.trim();}).indexOf('admin')>=0 && (r[ac]===true || String(r[ac]).toLowerCase()==='true');}).length;
    if(count<=1) throw new Error('The last active administrator cannot be deactivated.');
  }
  sh.getRange(rowNum,ac+1).setValue(active);
  logAudit(admin.email,'adminSetUserStatus',{email:email,active:active});
  return {success:true,active:active};
}
function adminResetUserPassword_(p, token) {
  var admin=gtmcUserMgmtRequireAdmin_(token), email=String(p.email||'').trim().toLowerCase(), password=String(p.password||'');
  if(!email || password.length<8) throw new Error('Account email and a password of at least 8 characters are required.');
  var sh=getSheet('Users'),hm=gtmcUserMgmtHeaders_(sh),ec=hm.headers.indexOf('email'),pc=hm.headers.indexOf('password'),rowNum=-1;
  for(var i=1;i<hm.values.length;i++) if(String(hm.values[i][ec]||'').trim().toLowerCase()===email){rowNum=i+1;break;}
  if(rowNum<0) throw new Error('User account not found.');
  sh.getRange(rowNum,pc+1).setValue(password);
  logAudit(admin.email,'adminResetUserPassword',{email:email});
  return {success:true};
}
function staffGetLeadershipOverview_(p, token) {
  var staff=requireRole(token,['principal','vice_principal','registrar']);
  var users=sheetToObjects(getSheet('Users'));
  var classes=sheetToObjects(getSheet('Classes')).filter(function(c){return c.active!==false;});
  var submissions=sheetToObjects(getSheet('Submissions'));
  return {
    role:String(staff.role||''),
    activeStaff:users.filter(function(u){return u.active===true||String(u.active).toLowerCase()==='true';}).length,
    teachers:users.filter(function(u){var r=String(u.role||'').split(',');return r.indexOf('class_teacher')>=0||r.indexOf('subject_teacher')>=0;}).length,
    classes:classes.length,
    scoreSubmissions:submissions.length
  };
}
var __gtmcUserMgmtOriginalRoute = route;
route = function(action,p) {
  p=p||{};
  switch(action) {
    case 'adminListUsers': return adminListUsers_(p,p.token);
    case 'adminCreateUser': return adminCreateUser_(p,p.token);
    case 'adminUpdateUser': return adminUpdateUser_(p,p.token);
    case 'adminSetUserStatus': return adminSetUserStatus_(p,p.token);
    case 'adminResetUserPassword': return adminResetUserPassword_(p,p.token);
    case 'staffGetLeadershipOverview': return staffGetLeadershipOverview_(p,p.token);
    default: return __gtmcUserMgmtOriginalRoute(action,p);
  }
};
