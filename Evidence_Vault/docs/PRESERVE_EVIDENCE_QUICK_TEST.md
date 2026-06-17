# Quick Test - Preserve Evidence Demo

## 5-Minute Test

```
1. Open: http://localhost:5173/preserve-evidence
2. Title: "Test Demo"
3. Description: "Quick test"
4. Select any file
5. Click "Upload File" → wait for checkmark ✓
6. Click "Preserve Evidence"
7. Click "Preserve Now" in dialog
8. ✅ Should see: "Evidence preserved successfully!"
9. ✅ Form resets automatically
10. ✅ Open console (F12) and run:
    localStorage.getItem('cases')
    // Should show your saved case
```

## What to Expect

### Success Flow
```
Upload File selected
    ↓
Click "Upload File"
    ↓ (shows spinner)
    ↓
✓ Uploaded checkmark appears
    ↓
Title + Description filled
    ↓
Click "Preserve Evidence"
    ↓
Dialog: "Confirm Preservation"
    ↓
Click "Preserve Now"
    ↓ (shows spinner)
    ↓
Alert: "✓ Evidence preserved successfully!"
    ↓
Form resets
    ↓
Ready for next case
```

### If Something Goes Wrong
```
Loading spinner + nothing happens for 5+ seconds?
    → Check browser console (F12)
    → Look for [Preserve] ERROR messages
    → Try refresh (Ctrl+F5)

Success alert doesn't appear?
    → Still check console
    → Look for "Preservation complete ✓"

Data not saving?
    → Run in console: localStorage.getItem('cases')
    → Should see: [{id: "case_...", title: ...}]
```

## Key Fix Areas

1. **No More Infinite Loading**
   - Uses `try/catch/finally` block
   - `setPreserveState(isPreserving: false)` ALWAYS executes

2. **LocalStorage Only**
   - No API calls
   - No Firestore dependency
   - Pure browser storage

3. **Proper Validation**
   - File must be uploaded
   - Title/description required
   - Hash must exist
   - Fails gracefully with error message

4. **Working Cancel**
   - Click "Cancel" in dialog
   - Stops immediately
   - Returns to normal state

5. **Success Feedback**
   - Alert shows Case ID
   - Form resets
   - Clear success indication

## Console Commands for Testing

```javascript
// Check saved cases
JSON.parse(localStorage.getItem('cases'))

// Check all evidence
JSON.parse(localStorage.getItem('evidence'))

// Check total cases
JSON.parse(localStorage.getItem('cases')).length

// Clear all (reset demo)
localStorage.clear()

// Check if specific case exists
JSON.parse(localStorage.getItem('cases')).find(c => c.title === "Your Title")
```

## Expected Data Format

```javascript
{
  id: "case_1708872341234_abc123def",
  title: "Your Case Title",
  description: "Your description",
  createdAt: "2026-02-25T10:30:45.123Z",
  evidence: [
    {
      id: "evidence_1708872341234",
      fileName: "filename.pdf",
      fileSize: 2048576,
      clientHash: "a1b2c3d4...",
      uploadedAt: "2026-02-25T10:30:30.000Z",
      aiAnalysis: null || {...},
      preservedAt: "2026-02-25T10:30:45.123Z"
    }
  ]
}
```

## Status: ✅ READY FOR TESTING

All fixes implemented:
- ✅ Async handling fixed
- ✅ LocalStorage save works
- ✅ Loading stops properly
- ✅ Cancel button works
- ✅ Validation complete
- ✅ Duplicate prevention
- ✅ Console debugging active
- ✅ Error messages clear
