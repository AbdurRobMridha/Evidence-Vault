# PRESERVE EVIDENCE - VERIFICATION CHECKLIST

## Pre-Test Setup ✓

- [ ] Workspace: `d:\evidencevault`
- [ ] Component: `/src/pages/EvidenceUpload.tsx`
- [ ] Browser: http://localhost:5173/preserve-evidence
- [ ] DevTools: Open (F12) - Console tab ready

---

## QUICK SANITY CHECK (2 min)

### 1. Upload File Works
```
STEPS:
1. Open page
2. Enter Title: "Demo Test"
3. Enter Description: "Quick test"
4. Click "Choose File" → select any file
5. Click "Upload File"

EXPECTED:
✓ "File uploaded successfully" message
✓ Checkmark appears next to upload button
✓ SHA-256 hash displays (64 hex chars)
✓ File size displays
✓ Upload timestamp displays
✓ "Reset & Start Over" button appears

FAIL IF:
✗ No checkmark
✗ No hash displayed
✗ Error message appears
✗ Button stays in loading state
```

### 2. Preserve Without AI (Main Fix Test)
```
STEPS:
1. Upload file (from test above)
2. Click "Preserve Evidence" button
3. In dialog: Check "Preserve Now" button
4. Click "Preserve Now"

EXPECTED (CRITICAL):
✓ Loading spinner appears briefly
✓ **Spinner STOPS within 2-3 seconds** (THIS WAS THE BUG)
✓ Success alert: "Evidence preserved successfully! Case ID: case_123456_abc..."
✓ Form completely resets
✓ Case Details section is empty
✓ Upload section shows "No file uploaded"
✓ No file in evidence display area

FAIL IF (These were the original 6 bugs):
✗ Spinner never stops (infinite loop)
✗ No alert appears
✗ Form NOT reset
✗ No Case ID shown
✗ Data NOT saved
✗ Can't click outside dialog to cancel
```

### 3. Verify Data Saved to LocalStorage
```
STEPS:
1. Open DevTools (F12)
2. Go to Console tab
3. Run this command:
   JSON.parse(localStorage.getItem('cases'))

EXPECTED:
[
  {
    "id": "case_1708872341234_abc123def",
    "title": "Demo Test",
    "description": "Quick test",
    "createdAt": "2024-02-25T10:12:21.234Z",
    "evidence": [
      {
        "id": "evidence_1708872341235_xyz",
        "fileName": "your-file.txt",
        "fileSize": 1024,
        "clientHash": "a3c5...b2f9",
        "uploadedAt": "2024-02-25T10:12:20.100Z",
        "preservedAt": "2024-02-25T10:12:21.300Z"
      }
    ]
  }
]

FAIL IF:
✗ Returns null/undefined
✗ Returns empty array []
✗ JSON is malformed
✗ Missing any required fields
```

---

## SCENARIO 1: Basic Preservation (5 min)

### Test: Single File Preservation

```
STEPS:
1. Open http://localhost:5173/preserve-evidence
2. Fill in:
   - Title: "Test Case 001"
   - Description: "Testing basic preservation functionality"
3. Upload small text file (< 10MB)
4. Click "Preserve Evidence"
5. Dialog appears
6. Click "Preserve Now"
7. Observe result
8. Verify in console

EXPECTED BEHAVIOR:
✓ Step 1-2: Form clears
✓ Step 3: File uploads, shows name and hash
✓ Step 4: Dialog shows what will be saved
✓ Step 5: Dialog opens with 2 buttons (Cancel, Preserve Now)
✓ Step 6: Loading spinner appears
✓ CRITICAL: Spinner stops within 2-3 seconds
✓ Success alert appears with Case ID
✓ Form resets completely
✓ Can upload new file immediately

CONSOLE VERIFICATION:
JSON.parse(localStorage.getItem('cases')).length
→ Should be 1

const lastCase = JSON.parse(localStorage.getItem('cases'))[0];
console.log(lastCase.title);
→ Should be "Test Case 001"
```

---

## SCENARIO 2: Multiple Cases (5 min)

### Test: Preserve 3 Different Cases

```
STEPS:
1. Preserve Case 1:
   - Title: "Case Alpha"
   - File: file1.txt
   - Preserve

2. Preserve Case 2:
   - Title: "Case Beta"
   - File: file2.txt
   - Preserve

3. Preserve Case 3:
   - Title: "Case Gamma"
   - File: file3.txt
   - Preserve

4. Verify in console

EXPECTED:
✓ All 3 preserve operations complete
✓ No spinner hangs
✓ Each gets unique Case ID
✓ Timestamps are different

CONSOLE VERIFICATION:
const cases = JSON.parse(localStorage.getItem('cases'));
console.log(cases.length);
→ Should be 3

cases.map(c => ({ id: c.id, title: c.title }));
→ Should show all 3 cases with different IDs
```

---

## SCENARIO 3: Cancel During Preservation (3 min)

### Test: Cancel Button Works

```
STEPS:
1. Fill form:
   - Title: "Case to Cancel"
   - Description: "Will not save"
2. Upload file
3. Click "Preserve Evidence"
4. Click "Cancel" button
5. Check storage

EXPECTED:
✓ Dialog appears
✓ Cancel button is clickable
✓ Dialog closes
✓ Form returns to state before preserve click
✓ No data saved to localStorage
✓ No error message shown
✓ File still uploaded (uploadState unchanged)

CONSOLE VERIFICATION:
const cases = JSON.parse(localStorage.getItem('cases'));
cases.find(c => c.title === "Case to Cancel")
→ Should be undefined (not found)
```

---

## SCENARIO 4: Validation - Missing Title (2 min)

### Test: Error Handling - Required Field

```
STEPS:
1. Leave Title empty
2. Fill Description: "Has description"
3. Upload file
4. Click "Preserve Evidence"
5. Click "Preserve Now"

EXPECTED:
✓ Dialog shows error: "Case title is required"
✓ Loading spinner stops
✓ Error appears in red text
✓ Dialog stays open (allows retry)
✓ Can cancel and go back
✓ Can fill title and try again
✓ No data saved on error

CONSOLE VERIFICATION:
const cases = JSON.parse(localStorage.getItem('cases'));
cases.length
→ Should be same as before (no new case added)
```

---

## SCENARIO 5: Validation - Missing Description (2 min)

### Test: Error Handling - Missing Description

```
STEPS:
1. Fill Title: "Case Missing Desc"
2. Leave Description empty
3. Upload file
4. Click "Preserve Evidence"
5. Click "Preserve Now"

EXPECTED:
✓ Dialog shows error: "Case description is required"
✓ Loading spinner stops
✓ Error message displayed
✓ Dialog stays open
✓ No data saved

CONSOLE VERIFICATION:
const cases = JSON.parse(localStorage.getItem('cases'));
cases.find(c => c.title === "Case Missing Desc")
→ Should be undefined
```

---

## SCENARIO 6: Validation - No File Uploaded (2 min)

### Test: Error Handling - File Required

```
STEPS:
1. Fill Title: "No File Case"
2. Fill Description: "Has description"
3. Do NOT upload file
4. Click "Preserve Evidence"
5. Click "Preserve Now"

EXPECTED:
✓ Dialog shows error: "File not uploaded"
✓ Loading spinner stops
✓ No data saved

CONSOLE VERIFICATION:
const cases = JSON.parse(localStorage.getItem('cases'));
cases.find(c => c.title === "No File Case")
→ Should be undefined
```

---

## SCENARIO 7: With AI Analysis (5 min)

### Test: Preserve with AI Results

**NOTE:** Requires Google Gemini API key in environment

```
STEPS:
1. Fill Title: "Case with AI"
2. Fill Description: "Testing AI integration"
3. Upload file
4. Click "Analyze with AI"
5. Wait for analysis complete
6. Verify risk score shows
7. Click "Preserve Evidence"
8. Click "Preserve Now"

EXPECTED:
✓ AI analysis runs (shows Risk Score)
✓ Preservation completes successfully
✓ Success alert appears
✓ Data includes AI analysis results

CONSOLE VERIFICATION:
const lastCase = JSON.parse(localStorage.getItem('cases')).slice(-1)[0];
lastCase.evidence[0].aiAnalysis
→ Should show: { risk_score: 7, threats: [...], recommendations: [...] }
```

---

## SCENARIO 8: No File Error Handling (2 min)

### Test: 404 or API Unavailable

**NOTE:** Only relevant if AI endpoint is called

```
STEPS:
1. Fill form with valid data
2. Upload file
3. Click "Analyze with AI"
4. Observe what happens

EXPECTED:
✓ If no API: Shows "API endpoint not configured"
✓ If no key: Shows "API key missing"
✓ If network error: Shows specific error
✓ Loading spinner stops
✓ Can still preserve without AI
```

---

## ERROR SCENARIOS - RECOVERY

### Scenario A: Browser Crashes/Closes

```
EXPECTED ON RELOAD:
✓ localStorage data persists
✓ Cases still available in next session
✓ No data loss

VERIFICATION:
Open DevTools after reload:
JSON.parse(localStorage.getItem('cases')).length
→ Should still show saved cases
```

### Scenario B: LocalStorage Full

```
IF YOU GET: QuotaExceededError

CAUSES:
- Stored >5MB of data
- Other sites using storage
- Browser settings

RESOLUTION:
localStorage.clear()
location.reload()
```

### Scenario C: Corrupted JSON

```
IF YOU GET: SyntaxError: Unexpected token

CAUSES:
- Manual edit of localStorage
- Browser crash during write
- Duplicate key issues

RESOLUTION:
1. Check structure: localStorage.getItem('cases')
2. If broken: localStorage.clear()
3. Test again from scratch
```

---

## LOADING STATE VERIFICATION (Critical Bug Test)

### The Bug We Fixed

**Original Problem:**
- Click "Preserve" → Spinner appears → Spinner NEVER STOPS → No message

**Root Cause:**
- `handleConfirmPreserve()` called async fetch() without try/catch/finally
- No proper error handling
- Loading state stuck as true

**The Fix:**
```typescript
try {
  // Validate data
  // Save to localStorage
  // Show success
} catch (error) {
  // Show error
} finally {
  setPreserveState(prev => ({ ...prev, isPreserving: false }));
  // ALWAYS runs - guarantees spinner stops
}
```

### Test the Fix

```
STEPS:
1. Open DevTools Console
2. Go to Network tab
3. Throttle: Set to "Offline"
4. Try to preserve (will "fail")
5. Observe what happens

EXPECTED:
✓ Spinner appears
✓ Error appears: "File not found" or similar
✓ Spinner STOPS (key behavior!)
✓ Dialog stays open
✓ Can click Cancel
✓ Can fill title and retry

THIS VALIDATES THE FIX:
If spinner stops even on error → try/catch/finally working ✓
If spinner hangs → something's still broken ✗
```

---

## FINAL VERIFICATION CHECKLIST

### Code Level
- [ ] `handleConfirmPreserve()` uses try/catch/finally (not just try/catch)
- [ ] Validation happens BEFORE saving (fail fast)
- [ ] localStorage.setItem() called with JSON.stringify()
- [ ] Existing cases array merged safely
- [ ] Success shows Case ID in alert
- [ ] Error messages specific (not generic)
- [ ] Loading state set to false in finally block
- [ ] Console logs start with [Preserve] prefix

### UI Level
- [ ] Form title/description inputs present
- [ ] Upload file button shows file metadata when done
- [ ] Preserve button only enabled when file uploaded
- [ ] Dialog shows confirmation details
- [ ] Cancel button closes dialog safely
- [ ] Success alert shows Case ID
- [ ] Error dialog shows specific error message
- [ ] Form resets after success
- [ ] No success until data actually saved

### Storage Level
- [ ] 'cases' key exists in localStorage
- [ ] 'evidence' key exists in localStorage
- [ ] Cases array has correct structure
- [ ] Each case has unique ID
- [ ] Timestamps are ISO strings
- [ ] File hash is 64-char hex string
- [ ] Multiple cases don't overwrite each other
- [ ] JSON is valid (can be parsed)

### Performance
- [ ] Spinner appears/disappears smoothly
- [ ] No lag between actions
- [ ] Preservation completes in <3 seconds
- [ ] No memory leaks (check DevTools)
- [ ] Works with files up to 100MB (localStorage limit)

---

## QUICK REFERENCE: Console Commands

```javascript
// See all saved cases
JSON.parse(localStorage.getItem('cases'))

// Count cases
JSON.parse(localStorage.getItem('cases') || '[]').length

// Get case by title
JSON.parse(localStorage.getItem('cases')).find(c => c.title === "YOUR_TITLE")

// Get case by ID
JSON.parse(localStorage.getItem('cases')).find(c => c.id === "case_123...")

// See all evidence
JSON.parse(localStorage.getItem('evidence'))

// Clear everything (CAREFUL - data loss!)
localStorage.clear()

// Validate JSON
JSON.parse(localStorage.getItem('cases')) // will throw if invalid

// Export case as JSON file
const cases = JSON.parse(localStorage.getItem('cases'));
copy(JSON.stringify(cases, null, 2));

// Pretty print a case
console.table(JSON.parse(localStorage.getItem('cases'))[0])
```

---

## EXPECTED SUCCESS STATE

After all tests pass, you should see:

```
✅ Cases loading into localStorage
✅ Spinner stops in all scenarios
✅ Success messages with Case IDs
✅ Error messages are specific
✅ Form resets after preservation
✅ Multiple cases don't overwrite
✅ Cancel button works smoothly
✅ Data persists after refresh
✅ No hanging promises
✅ Demo mode fully functional
```

---

## IF TESTS FAIL

### Spinner still hangs?
- [ ] Check browser console for errors (F12)
- [ ] Check DevTools → Network tab for hanging requests
- [ ] Look for red error messages in console
- [ ] Compare code to handleConfirmPreserve() fix
- [ ] Check if finally block is executing

### Data not saving?
- [ ] Check console: `localStorage.getItem('cases')`
- [ ] Check if error is logged: `[Preserve] Error: ...`
- [ ] Verify all 5 validations pass
- [ ] Check browser storage quota isn't exceeded

### Wrong Case ID?
- [ ] Case ID format should be: `case_1708872341234_abc123def`
- [ ] Check if timestamp is being generated: `Date.now()`
- [ ] Check if random string is being added

### Dialog won't close?
- [ ] Try pressing Escape key
- [ ] Check if error is blocking close
- [ ] Look for modal overlay preventing clicks

---

## READY TO TEST?

1. ✅ Save EvidenceUpload.tsx with new code
2. ✅ Dev server running (npm run dev)
3. ✅ Browser open to http://localhost:5173
4. ✅ DevTools ready (F12)
5. ✅ This checklist printed or visible

**Start with QUICK SANITY CHECK (2 min)**
↓
**Then run SCENARIO 1 (5 min)**
↓
**Finally verify in console**

Good luck! This fix should solve all 6 reported bugs. 🎯
