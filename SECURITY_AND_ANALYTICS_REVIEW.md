# GTMC Grade Portal — Security and Analytics Review

**Review date:** 16 November 2026  
**Review branch:** `fix/assessment-lock-enforcement`  
**Scope:** Static inspection of `code.gs` and `index.html`, with targeted source-level fixes.  
**Production status:** No merge, Apps Script deployment, Vercel deployment, or live spreadsheet modification was performed.

## Executive assessment

**Provisional security posture: LOW (approximately 4/10 from static source review).** This is not a penetration-test score or security certification. Several important access-control and workflow protections have been added in this branch, but unresolved credential, session-storage, password-storage, and testing risks mean the portal should not yet be described as independently security-tested or production-hardened.

## Changes made on this branch

### Access control and result privacy
- Restricted student-directory access to known class tabs and authorized staff roles.
- Restricted student score retrieval to the authenticated student's own account and assigned class.
- Added an exact student + class + term + academic-year publication check before a student can retrieve results. Unpublished results now fail closed.
- Kept leadership access to aggregate analytics; the leadership endpoint does not return student names, IDs, or individual marks.
- Kept teacher score analysis behind the existing class/subject assignment checks.

### Assessment workflow
- Made assessment-lock matching independent of the teacher identity, while preserving the correction-window owner restriction.
- Put score writes and assessment submissions behind the same Apps Script script lock and re-check the lock during the write.
- Preserved existing score fields, totals, and result calculations.

### Session and request handling
- Added server-side session revocation on logout.
- Added a guard against recursive logout handling when a session has already expired.
- Rejected API actions sent through GET requests so passwords, tokens, and write parameters are not accepted in query strings.
- Added safer JavaScript argument encoding for dynamic values used by inline event handlers.

### Analytics
- Principal and VP dashboards now include an aggregate 50%+ benchmark rate, score coverage, score-band distribution, and class/subject pass-rate comparisons.
- Class-teacher analysis now includes complete-record coverage, a 50%+ benchmark, and score-band distribution.
- Subject-teacher analysis now includes entered-score coverage, a 50%+ benchmark, and score-band distribution for the selected subject.
- The 50% benchmark is an analytical indicator only. It does not alter official grading, ranking, or result calculations.
- Missing scores are excluded from averages and score-band counts; they are not converted to zero by these new analytics indicators.

## Important remaining risks

### High priority
1. **Default administrator seed credential remains in source.** The setup routine can seed a default administrator account when the Users sheet is empty or contains only its header, and the setup message prints the default login. This was not changed because the owner explicitly requested that existing password arrangements remain untouched. Before any production release, an authorized administrator should verify the Users sheet is populated and that the default seeded account is not active. Do not run setup as a backup procedure.
2. **Password hashing is a single salted SHA-256 pass.** This is better than storing a plain password, but it is not a password-specific slow hash such as Argon2id, scrypt, bcrypt, or PBKDF2 with a suitably high work factor. A spreadsheet compromise could permit offline guessing. No password was reset or changed in this review.
3. **Login throttling is not implemented.** The login path does not show an effective per-account/IP rate limit or progressive delay, leaving password-guessing resistance dependent on other controls.

### Medium priority
4. **Session tokens are stored in browser localStorage and remain valid for up to six hours.** Server-side logout revocation has now been added, but an XSS flaw or compromised browser profile could still expose a token.
5. **The frontend has many dynamic HTML rendering paths and inline event handlers.** Most inspected text output uses HTML escaping, and dynamic inline-handler arguments were hardened in this branch. This was a targeted source review, not a complete DOM-XSS audit. A restrictive Content Security Policy and gradual replacement of inline handlers/HTML-string rendering remain advisable.
6. **Audit coverage is not uniform across all operations.** Sensitive actions should consistently record actor, target, outcome, and timestamp without logging passwords or session tokens.
7. **Apps Script deployment access settings, Google Sheet sharing permissions, Script Properties, and Drive backup permissions were not inspectable from repository source.** These need a separate configuration review.

## Validation performed

- Backend source parsed successfully with JavaScript syntax validation.
- All four inline JavaScript blocks in the frontend parsed successfully.
- The new score-band helper was exercised with sample values in each band; each value landed in the expected band.
- The student score endpoint was exercised with mocked data:
  - requesting another student's record was denied;
  - requesting an unpublished result was denied;
  - a matching published record passed the publication gate.
- Source checks confirmed the class allow-list, exact publication-year match, server-side logout removal, and aggregate analytics fields.
- No live student records, scores, passwords, or spreadsheet rows were used in these tests.

## Validation not performed

- No live Apps Script execution or live portal sign-in was performed.
- No live spreadsheet backup was created or verified by this review.
- No end-to-end browser test, concurrent-user/load test, penetration test, dependency audit, or Google Apps Script deployment-settings review was performed.
- The repository did not contain a ready-to-run automated test suite during this inspection; source parsing and focused mock tests do not replace a full test suite.

## Release boundary

All changes remain on `fix/assessment-lock-enforcement`. The branch is not merged into `main`. No Apps Script or Vercel deployment was triggered. Do not merge or deploy until the owner reviews the changes, confirms the Google Sheets backup, and explicitly approves release.


## Additional result-access controls (development branch)

- Student and parent result endpoints now check the existing `Debtors` register for the selected academic year before returning marks.
- A positive recorded balance blocks the result response and returns a debtor notice containing the outstanding amount. The UI displays the notice without rendering scores.
- Bulk administrator report-card PDF generation skips students with a positive debtor-register balance and reports how many were withheld.
- The result-card summary displays overall position within the student's exact class arm (for example, JSS2A), using the existing backend rank object. Ranking calculations were not changed.
- Visible report labels now use “Class Teacher” and “Principal”.
- Buttons now provide press feedback; the sign-in button displays a spinner while authentication is in progress.

Validation added:
- Backend source parses successfully.
- All four inline frontend script blocks parse successfully.
- Isolated debtor-register tests cover accumulated balances, year/class/student matching, and non-debtor cases.
- This is source-level validation only. It does not replace live Apps Script, browser, concurrency, or deployment testing.

Important boundary:
- The debtor restriction uses the existing `Debtors` register already used by the portal's debtor panel and parent result payload. It does not automatically reconcile that register with the separate fee-ledger sheets.
