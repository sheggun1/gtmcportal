/**
 * GTMC PAYMENT NOTIFICATIONS ADD-ON
 * Add this file to the existing GTMC Apps Script project alongside Code.gs.
 * Run setupSheets() once, then redeploy the existing web app as a new version.
 * Existing score sheets and Debtors rows are preserved.
 */
var __gtmcPaymentOriginalSetupSheets = setupSheets;
setupSheets = function() {
  META_SCHEMA.PaymentNotifications = {
  headers: [
    'id','parent_email','parent_name','student_id','student_name','class',
    'academic_year','term','fee_category','payment_date','payment_time',
    'amount','sender_name','reference','note','status','reply',
    'replied_by','replied_at','created_at','updated_at','ledger_payment_id'
  ]
  };
  META_SCHEMA.FeePayments = {
  headers: [
    'id','notification_id','student_id','student_name','class','academic_year',
    'term','fee_category','amount','payment_date','payment_time','sender_name',
    'reference','recorded_by','recorded_at','voided','void_reason'
  ]
  };
  return __gtmcPaymentOriginalSetupSheets();
};

var __gtmcPaymentOriginalRoute = route;
route = function(action, p) {
  p = p || {};
  switch (action) {
    case 'parentSubmitPaymentNotification': return parentSubmitPaymentNotification_(p, p.token);
    case 'parentGetPaymentNotifications': return parentGetPaymentNotifications_(p, p.token);
    case 'staffGetPaymentNotifications': return staffGetPaymentNotifications_(p, p.token);
    case 'staffReplyPaymentNotification': return staffReplyPaymentNotification_(p, p.token);
    default: return __gtmcPaymentOriginalRoute(action, p);
  }
};

function paymentBool_(v) {
  return v === true || String(v).toLowerCase() === 'true';
}
function paymentText_(v, max, label) {
  var s = String(v == null ? '' : v).trim();
  if (!s) throw new Error(label + ' is required.');
  if (s.length > max) throw new Error(label + ' is too long.');
  return s;
}
function paymentNotificationRows_() {
  return sheetToObjects(getSheet('PaymentNotifications'));
}
function paymentNotificationRow_(id) {
  var sh = getSheet('PaymentNotifications');
  var data = sh.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][0]) === String(id)) return { sheet: sh, row: i + 1, values: data[i] };
  }
  return null;
}
function paymentNotificationPublic_(r) {
  return {
    id: String(r.id || ''),
    studentId: String(r.student_id || ''),
    studentName: String(r.student_name || ''),
    className: String(r.class || ''),
    academicYear: String(r.academic_year || ''),
    term: String(r.term || ''),
    feeCategory: String(r.fee_category || ''),
    paymentDate: String(r.payment_date || ''),
    paymentTime: String(r.payment_time || ''),
    amount: Number(r.amount || 0),
    senderName: String(r.sender_name || ''),
    reference: String(r.reference || ''),
    note: String(r.note || ''),
    status: String(r.status || 'Pending Verification'),
    reply: String(r.reply || ''),
    repliedBy: String(r.replied_by || ''),
    repliedAt: r.replied_at || '',
    createdAt: r.created_at || '',
    updatedAt: r.updated_at || ''
  };
}
function paymentFindWard_(className, studentId) {
  if (CLASSES.indexOf(className) < 0) throw new Error('Invalid class.');
  var sh = getSheet(className), last = sh.getLastRow();
  if (last < 4) throw new Error('Student not found in the selected class.');
  var rows = sh.getRange(4, 1, last - 3, 2).getValues();
  for (var i = 0; i < rows.length; i++) {
    if (String(rows[i][0]) === studentId) return String(rows[i][1] || '');
  }
  throw new Error('Student not found in the selected class.');
}
function parentSubmitPaymentNotification_(p, token) {
  var parent = requireRole(token, ['parent']);
  var studentId = paymentText_(p.studentId, 100, 'Student');
  var className = paymentText_(p.className, 30, 'Class');
  portalAssertLinkedParent_(parent, className, studentId);
  var studentName = paymentFindWard_(className, studentId);
  var academicYear = paymentText_(p.academicYear, 20, 'Academic year');
  var term = paymentText_(p.term, 20, 'Term');
  if (TERMS.indexOf(term) < 0) throw new Error('Select a valid term.');
  var category = paymentText_(p.feeCategory, 40, 'Fee category');
  if (['School Fees','Boarding','Transport','Other'].indexOf(category) < 0) throw new Error('Invalid fee category.');
  var paymentDate = paymentText_(p.paymentDate, 20, 'Payment date');
  var paymentTime = paymentText_(p.paymentTime, 20, 'Payment time');
  var amount = Number(p.amount);
  if (!isFinite(amount) || amount <= 0 || amount > 100000000) throw new Error('Enter a valid payment amount.');
  var senderName = paymentText_(p.senderName, 120, 'Sender name');
  var reference = String(p.reference || '').trim().slice(0, 120);
  var note = String(p.note || '').trim().slice(0, 500);

  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    var existing = paymentNotificationRows_();
    if (reference && existing.some(function(r) {
      return String(r.reference || '').toLowerCase() === reference.toLowerCase();
    })) throw new Error('This payment reference has already been submitted.');
    var id = 'PAYN' + Date.now() + Utilities.getUuid().slice(0, 6).toUpperCase();
    var now = new Date();
    getSheet('PaymentNotifications').appendRow([
      id, parent.email, parent.name || '', studentId, studentName, className,
      academicYear, term, category, paymentDate, paymentTime, amount,
      senderName, reference, note, 'Pending Verification', '', '', '',
      now, now, ''
    ]);
    logAudit(parent.email, 'parentSubmitPaymentNotification', {
      id: id, studentId: studentId, className: className, amount: amount, category: category
    });
    return { id: id, status: 'Pending Verification', createdAt: now };
  } finally {
    lock.releaseLock();
  }
}
function parentGetPaymentNotifications_(p, token) {
  var parent = requireRole(token, ['parent']);
  var className = paymentText_(p.className, 30, 'Class');
  var studentId = paymentText_(p.studentId, 100, 'Student');
  portalAssertLinkedParent_(parent, className, studentId);
  return paymentNotificationRows_()
    .filter(function(r) {
      return String(r.parent_email).toLowerCase() === String(parent.email).toLowerCase() &&
        String(r.student_id) === studentId && String(r.class) === className;
    })
    .sort(function(a,b) { return new Date(b.created_at || 0) - new Date(a.created_at || 0); })
    .map(paymentNotificationPublic_);
}
function staffGetPaymentNotifications_(p, token) {
  var staff = requireRole(token, ['admin','bursar']);
  var rows = paymentNotificationRows_();
  if (p.status) rows = rows.filter(function(r) { return String(r.status) === String(p.status); });
  if (p.className) rows = rows.filter(function(r) { return String(r.class) === String(p.className); });
  rows.sort(function(a,b) {
    var ap = String(a.status) === 'Pending Verification' ? 0 : 1;
    var bp = String(b.status) === 'Pending Verification' ? 0 : 1;
    return ap - bp || new Date(b.created_at || 0) - new Date(a.created_at || 0);
  });
  return rows.map(function(r) {
    var x = paymentNotificationPublic_(r);
    x.parentName = String(r.parent_name || '');
    x.parentEmail = String(r.parent_email || '');
    return x;
  });
}
function staffReplyPaymentNotification_(p, token) {
  var staff = requireRole(token, ['admin','bursar']);
  var id = paymentText_(p.id, 100, 'Notification ID');
  var status = paymentText_(p.status, 50, 'Status');
  if (['Confirmed / Cleared','Rejected / Not Found','More Information Required'].indexOf(status) < 0) {
    throw new Error('Choose a valid response status.');
  }
  var reply = String(p.reply || '').trim().slice(0, 1000);
  if (!reply) throw new Error('Enter a reply for the parent.');
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    var found = paymentNotificationRow_(id);
    if (!found) throw new Error('Payment notification not found.');
    var r = found.values;
    var headers = found.sheet.getRange(1, 1, 1, found.sheet.getLastColumn()).getValues()[0];
    var ix = {}; headers.forEach(function(h,i) { ix[String(h)] = i; });
    var current = String(r[ix.status] || '');
    if (current === 'Confirmed / Cleared') throw new Error('This payment has already been cleared and cannot be processed again.');
    if (status === 'Confirmed / Cleared') {
      var ref = String(r[ix.reference] || '').trim().toLowerCase();
      if (ref) {
        var ledger = sheetToObjects(getSheet('FeePayments'));
        if (ledger.some(function(x) { return String(x.reference || '').trim().toLowerCase() === ref; })) {
          throw new Error('This payment reference already exists in the payment ledger.');
        }
      }
      var amount = Number(r[ix.amount] || 0);
      if (!isFinite(amount) || amount <= 0) throw new Error('Invalid payment amount on this notification.');
      var paymentId = 'RCPT' + Date.now() + Utilities.getUuid().slice(0, 6).toUpperCase();
      var recordedAt = new Date();
      getSheet('FeePayments').appendRow([
        paymentId, id, r[ix.student_id], r[ix.student_name], r[ix.class],
        r[ix.academic_year], r[ix.term], r[ix.fee_category], amount,
        r[ix.payment_date], r[ix.payment_time], r[ix.sender_name], r[ix.reference],
        staff.email, recordedAt, false, ''
      ]);
      // Debtors.amount is the legacy aggregate outstanding balance. Reduce it once,
      // never below zero. Fee category remains recorded in the separate ledger.
      var debtSheet = getSheet('Debtors');
      var debts = debtSheet.getDataRange().getValues();
      var debtRow = -1;
      for (var i = 1; i < debts.length; i++) {
        if (String(debts[i][0]) === String(r[ix.student_id]) &&
            String(debts[i][1]) === String(r[ix.class]) &&
            String(debts[i][2]) === String(r[ix.academic_year]) &&
            String(debts[i][3]) === String(r[ix.term])) { debtRow = i + 1; break; }
      }
      if (debtRow > 0) {
        var outstanding = Number(debts[debtRow - 1][4] || 0);
        debtSheet.getRange(debtRow, 5).setValue(Math.max(0, outstanding - amount));
        debtSheet.getRange(debtRow, 7).setValue(recordedAt);
        debtSheet.getRange(debtRow, 8).setValue(staff.email);
      }
      found.sheet.getRange(found.row, ix.ledger_payment_id + 1).setValue(paymentId);
    }
    found.sheet.getRange(found.row, ix.status + 1).setValue(status);
    found.sheet.getRange(found.row, ix.reply + 1).setValue(reply);
    found.sheet.getRange(found.row, ix.replied_by + 1).setValue(staff.name || staff.email);
    found.sheet.getRange(found.row, ix.replied_at + 1).setValue(new Date());
    found.sheet.getRange(found.row, ix.updated_at + 1).setValue(new Date());
    logAudit(staff.email, 'staffReplyPaymentNotification', { id: id, status: status });
    return { success: true, id: id, status: status };
  } finally {
    lock.releaseLock();
  }
}
