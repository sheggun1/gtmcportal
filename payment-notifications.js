/* GTMC Parent Payment Notifications — frontend extension */
(function(){
  function q(id){return document.getElementById(id);}
  function h(v){return typeof esc==='function'?esc(v==null?'':String(v)):String(v==null?'':v);}
  function badge(s){var c=s==='Confirmed / Cleared'?'ok':s==='Rejected / Not Found'?'err':s==='More Information Required'?'warn':'info';return '<span class="badge '+c+'">'+h(s||'Pending Verification')+'</span>';}
  function addNav(id,label){var side=q('sidebar');if(!side||side.querySelector('[data-tab="'+id+'"]'))return;side.insertAdjacentHTML('beforeend','<div class="nav-item" data-tab="'+id+'" onclick="setNav(\''+id+'\')"><span class="dot"></span><span>'+label+'</span></div>');}
  function hasPanel(id){return !!document.querySelector('[data-panel="'+id+'"]');}
  function installParent(){
    if(!q('main')||hasPanel('parentPayments'))return;
    q('main').insertAdjacentHTML('beforeend',
      '<div class="panel" data-panel="parentPayments">'+
      '<div class="page-head"><h1>Payment Notifications</h1><p>Notify the school about a payment and follow the verification response from the Bursar or Admin.</p></div>'+
      '<div class="card"><h2>Submit a Payment Notification</h2><p class="sub">This is a payment report, not a receipt. Your balance changes only after the school verifies and clears the payment.</p>'+
      '<div class="grid cols-3">'+
      '<div><label>Student / Ward</label><select id="payWard"></select></div>'+
      '<div><label>Academic Year</label><input id="payYear" value="2026/2027"></div>'+
      '<div><label>Term</label><select id="payTerm"><option>Term1</option><option>Term2</option><option>Term3</option></select></div>'+
      '<div><label>Fee Category</label><select id="payCategory"><option>School Fees</option><option>Boarding</option><option>Transport</option><option>Other</option></select></div>'+
      '<div><label>Payment Date</label><input id="payDate" type="date"></div>'+
      '<div><label>Payment Time</label><input id="payTime" type="time"></div>'+
      '<div><label>Amount Paid (₦)</label><input id="payAmount" type="number" min="1" step="0.01" placeholder="e.g. 50000"></div>'+
      '<div><label>Sender\\'s Name</label><input id="paySender" placeholder="Name shown by the bank / sender"></div>'+
      '<div><label>Transaction Reference (optional)</label><input id="payReference" placeholder="Bank transfer reference"></div></div>'+
      '<div style="margin-top:12px"><label>Additional Information (optional)</label><textarea id="payNote" rows="2" placeholder="Bank name or any useful detail"></textarea></div>'+
      '<div class="row" style="margin-top:14px"><button class="ok" onclick="submitParentPaymentNotification()">Submit Payment Notification</button><button class="sec" onclick="loadParentPaymentNotifications()">Refresh My Notifications</button></div>'+
      '<div id="paySubmitStatus" class="portal-note" style="margin-top:12px">Select your ward and enter the payment details.</div></div>'+
      '<div class="card"><div class="row" style="justify-content:space-between"><div><h2>My Payment History</h2><p class="sub">Your submitted payments and the school\\'s replies.</p></div><button class="sec sm" onclick="loadParentPaymentNotifications()">Refresh</button></div><div id="parentPaymentRows"><div class="empty">Loading payment notifications…</div></div></div></div>');
    addNav('parentPayments','Payment Notifications');
    var sel=q('payWard'),src=q('pWard');
    if(sel&&window.__WARDS){sel.innerHTML=window.__WARDS.map(function(w,i){return '<option value="'+i+'">'+h(w.studentName)+' · '+h(w.className)+'</option>';}).join('');if(src)sel.value=src.value;sel.addEventListener('change',loadParentPaymentNotifications);}
    var now=new Date();
    if(q('payDate'))q('payDate').value=[now.getFullYear(),String(now.getMonth()+1).padStart(2,'0'),String(now.getDate()).padStart(2,'0')].join('-');
    if(q('payTime'))q('payTime').value=String(now.getHours()).padStart(2,'0')+':'+String(now.getMinutes()).padStart(2,'0');
    loadParentPaymentNotifications();
    if(window.__gtmcPaymentPoll)clearInterval(window.__gtmcPaymentPoll);
    window.__gtmcPaymentPoll=setInterval(function(){var p=document.querySelector('[data-panel="parentPayments"]');if(p&&p.classList.contains('active'))loadParentPaymentNotifications();},30000);
  }
  function selectedWard(){var idx=Number(q('payWard')?q('payWard').value:(q('pWard')?q('pWard').value:0));return (window.__WARDS||[])[idx];}
  window.submitParentPaymentNotification=async function(){
    var w=selectedWard(),amount=Number(q('payAmount').value);
    if(!w)return toast('No linked ward is available. Contact the school administrator.','err');
    if(!q('payDate').value||!q('payTime').value||!q('paySender').value.trim()||!Number.isFinite(amount)||amount<=0)return toast('Complete payment date, time, amount and sender name.','err');
    var btn=document.querySelector('[data-panel="parentPayments"] button.ok');if(btn){btn.disabled=true;btn.textContent='Submitting…';}
    try{
      var r=await api('parentSubmitPaymentNotification',{studentId:w.studentId,className:w.className,academicYear:q('payYear').value.trim(),term:q('payTerm').value,feeCategory:q('payCategory').value,paymentDate:q('payDate').value,paymentTime:q('payTime').value,amount:amount,senderName:q('paySender').value.trim(),reference:q('payReference').value.trim(),note:q('payNote').value.trim()});
      q('paySubmitStatus').textContent='Submitted successfully. Reference: '+r.id+'. Status: Pending Verification.';
      q('payAmount').value='';q('payReference').value='';q('payNote').value='';
      await loadParentPaymentNotifications();toast('Payment notification submitted.','ok');
    }catch(e){q('paySubmitStatus').textContent=e.message;toast(e.message,'err');}
    finally{if(btn){btn.disabled=false;btn.textContent='Submit Payment Notification';}}
  };
  window.loadParentPaymentNotifications=async function(){
    var box=q('parentPaymentRows');if(!box)return;var w=selectedWard();
    if(!w){box.innerHTML='<div class="empty">No linked ward selected.</div>';return;}
    box.innerHTML='<div class="empty">Refreshing your payment history…</div>';
    try{
      var rows=await api('parentGetPaymentNotifications',{studentId:w.studentId,className:w.className});
      if(!rows.length){box.innerHTML='<div class="empty">No payment notifications submitted for this ward yet.</div>';return;}
      box.innerHTML='<div class="table-wrap"><table><thead><tr><th>Date submitted</th><th>Payment date/time</th><th>Category</th><th>Amount</th><th>Sender</th><th>Status</th><th>School reply</th></tr></thead><tbody>'+
      rows.map(function(r){return '<tr><td>'+h(r.createdAt?new Date(r.createdAt).toLocaleString():'—')+'<br><small>'+h(r.id)+'</small></td><td>'+h(r.paymentDate)+' '+h(r.paymentTime)+'</td><td>'+h(r.feeCategory)+'</td><td><strong>₦'+Number(r.amount||0).toLocaleString()+'</strong></td><td>'+h(r.senderName)+'</td><td>'+badge(r.status)+'</td><td>'+h(r.reply||'Awaiting school response')+(r.repliedBy?'<br><small>By '+h(r.repliedBy)+' · '+h(r.repliedAt?new Date(r.repliedAt).toLocaleString():'')+'</small>':'')+'</td></tr>';}).join('')+
      '</tbody></table></div>';
    }catch(e){box.innerHTML='<div class="empty">'+h(e.message)+'</div>';}
  };
  function installStaff(){
    if(!q('main')||hasPanel('staffPayments'))return;
    q('main').insertAdjacentHTML('beforeend',
      '<div class="panel" data-panel="staffPayments"><div class="page-head"><h1>Payment Notifications</h1><p>Review parent payment reports, reply, and clear verified payments into the financial record.</p></div>'+
      '<div class="card"><div class="grid cols-3"><div><label>Status Filter</label><select id="staffPayFilter" onchange="loadStaffPaymentNotifications()"><option value="">All statuses</option><option>Pending Verification</option><option>Confirmed / Cleared</option><option>Rejected / Not Found</option><option>More Information Required</option></select></div>'+
      '<div><label>Class (optional)</label><select id="staffPayClass" onchange="loadStaffPaymentNotifications()"><option value="">All classes</option></select></div>'+
      '<div style="display:flex;align-items:flex-end"><button class="blue" onclick="loadStaffPaymentNotifications()">Refresh Notifications</button></div></div></div>'+
      '<div id="staffPaymentRows"><div class="empty">Loading payment notifications…</div></div></div>');
    addNav('staffPayments','Payment Notifications');
    if(typeof loadClasses==='function')loadClasses().then(function(cs){if(q('staffPayClass'))q('staffPayClass').innerHTML='<option value="">All classes</option>'+cs.map(function(c){return '<option>'+h(c)+'</option>';}).join('');}).catch(function(){});
    loadStaffPaymentNotifications();
  }
  window.loadStaffPaymentNotifications=async function(){
    var box=q('staffPaymentRows');if(!box)return;box.innerHTML='<div class="empty">Loading…</div>';
    try{
      var rows=await api('staffGetPaymentNotifications',{status:q('staffPayFilter')?q('staffPayFilter').value:'',className:q('staffPayClass')?q('staffPayClass').value:''});
      if(!rows.length){box.innerHTML='<div class="card empty">No payment notifications match this filter.</div>';return;}
      box.innerHTML=rows.map(function(r){
        var id=h(r.id);
        return '<div class="card"><div class="row" style="justify-content:space-between;align-items:flex-start"><div><h2>'+h(r.studentName)+' · '+h(r.className)+'</h2><p class="sub">'+h(r.parentName)+' ('+h(r.parentEmail)+') · Submitted '+h(r.createdAt?new Date(r.createdAt).toLocaleString():'')+'</p></div>'+badge(r.status)+'</div>'+
        '<div class="grid cols-4" style="margin:12px 0"><div><small class="sub">Amount</small><strong>₦'+Number(r.amount||0).toLocaleString()+'</strong></div><div><small class="sub">Fee category</small><strong>'+h(r.feeCategory)+'</strong></div><div><small class="sub">Payment date/time</small><strong>'+h(r.paymentDate)+' '+h(r.paymentTime)+'</strong></div><div><small class="sub">Sender name</small><strong>'+h(r.senderName)+'</strong></div><div><small class="sub">Academic period</small><strong>'+h(r.term)+' · '+h(r.academicYear)+'</strong></div><div><small class="sub">Transaction reference</small><strong>'+h(r.reference||'Not supplied')+'</strong></div><div><small class="sub">Parent note</small><strong>'+h(r.note||'—')+'</strong></div><div><small class="sub">Notification ID</small><strong>'+id+'</strong></div></div>'+
        (r.reply?'<div class="portal-note"><strong>Previous reply:</strong> '+h(r.reply)+'</div>':'')+
        (r.status==='Confirmed / Cleared'?'':'<div class="grid cols-2"><div><label>Response</label><select id="pstat_'+id+'"><option>Confirmed / Cleared</option><option>Rejected / Not Found</option><option>More Information Required</option></select></div><div><label>Reply to parent (required)</label><textarea id="preply_'+id+'" rows="2">'+h(r.reply||'')+'</textarea></div></div><div class="row" style="margin-top:12px"><button class="ok" onclick="replyStaffPaymentNotification(\\''+id+'\\')">Save Reply / Process</button></div>')+
        '<p class="sub" style="margin-top:8px">A payment is added to the ledger and the outstanding debt is reduced only when Confirmed / Cleared is saved.</p></div>';
      }).join('');
    }catch(e){box.innerHTML='<div class="empty">'+h(e.message)+'</div>';}
  };
  window.replyStaffPaymentNotification=async function(id){
    var status=q('pstat_'+id)?q('pstat_'+id).value:'',reply=q('preply_'+id)?q('preply_'+id).value.trim():'';
    if(!status||!reply)return toast('Select a status and enter a reply.','err');
    if(status==='Confirmed / Cleared'&&!confirm('Confirm that this payment has been verified against the school bank/payment records? This will add it to the payment ledger and reduce the outstanding balance.'))return;
    try{await api('staffReplyPaymentNotification',{id:id,status:status,reply:reply});toast('Parent response saved.','ok');await loadStaffPaymentNotifications();}
    catch(e){toast(e.message,'err');}
  };
  function installBursar(){
    q('roleTag').textContent='Bursar Portal · Jesus, Our Teacher';
    q('sidebar').innerHTML='<div class="group"><div class="group-title">Finance</div><div class="nav-item active" data-tab="staffPayments" onclick="setNav(\\'staffPayments\\')"><span class="dot"></span><span>Payment Notifications</span></div></div>';
    q('main').innerHTML='<div class="page-head"><h1>Bursar Dashboard</h1><p>Review parent payment notifications and respond to payment enquiries.</p></div>';
    installStaff();setNav('staffPayments');
  }
  var prevParent=window.renderParent;
  if(typeof prevParent==='function')window.renderParent=async function(){await prevParent.apply(this,arguments);installParent();};
  var prevAdmin=window.renderAdmin;
  if(typeof prevAdmin==='function')window.renderAdmin=function(){prevAdmin.apply(this,arguments);installStaff();};
  var prevBoot=window.boot;
  if(typeof prevBoot==='function')window.boot=async function(){
    if(typeof hasRole==='function'&&hasRole('bursar')){
      if(!S.token||!S.user)return logout();
      q('loginView').style.display='none';q('appView').style.display='flex';
      q('userLabel').textContent=S.user.name||S.user.email;q('userRole').textContent='Bursar';
      if(typeof applyLogoFallback==='function')applyLogoFallback();
      installBursar();return;
    }
    return prevBoot.apply(this,arguments);
  };
})();
