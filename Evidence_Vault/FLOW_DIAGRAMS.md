# Evidence Upload - Visual Flow Diagrams

## State Machine Diagram

```
                    ┌────────────────┐
                    │  FILE SELECTED │
                    └────────┬────────┘
                             │
                    ┌────────▼─────────┐
                    │  File uploaded?  │
                    └────────┬─────────┘
                             │
              ┌──────────────┴──────────────┐
              │                             │
         NO  ▼                              ▼ YES
      ┌──────────────┐            ┌────────────────────┐
      │ Upload disabled│            │ Upload: Completed  │
      │ (Button shows │            │ Analyze: Available │
      │  "Upload")    │            │ Preserve: Available│
      └──────┬────────┘            └────────┬───────────┘
             │                              │
       ┌─────▼──────────┐          ┌───────▼────────────┐
       │ Click "Upload" │          │ Analyze complete?  │
       └─────┬──────────┘          └───────┬────────────┘
             │                              │
          ┌──▼──────────────────────────────┘
          │                             
          ▼                             NO
     [UPLOADING]                    │
          │                         │
          │                    ┌────▼──────┐
          ▼                    │ Click      │
       SUCCESS                 │ "Analyze"  │
          │                    └────┬──────┘
          │                         │
          ├─►[SET fileUploaded]     ▼
          │                    [ANALYZING]
          │                         │
          │                         ▼
          │                     SUCCESS
          │                         │
          │                    ├─►[SET analysisComplete]
          │                    │
          │                    ▼
          │                [RESULTS SHOWN]
          │                    │
          ▼                    ▼
       [READY]            [READY FOR PRESERVE]
          │                    │
          └────────┬───────────┘
                   │
              ┌────▼──────────┐
              │ Click         │
              │ "Preserve"    │
              └────┬──────────┘
                   │
                   ▼
            [CONFIRM DIALOG]
                   │
         ┌─────────┴─────────┐
         │                   │
      CANCEL             CONFIRM
         │                   │
         ▼                   ▼
      [RESET]          [PRESERVING]
                            │
                            ▼
                        SUCCESS
                            │
                    ├─►[Case Created]
                    │   [Evidence Linked]
                    │   [Audit Logged]
                    │
                    ▼
              [REDIRECT TO CASE]
```

## Button State Transitions

```
┌──────────────────────────────────────────────────────────────────┐
│                  UPLOAD FILE BUTTON                              │
├──────────────────────────────────────────────────────────────────┤
│                                                                   │
│  Initial:     [Upload File]  (Disabled - no file selected)       │
│                │                                                 │
│  After Select: [Upload File]  (Enabled)                          │
│                │                                                 │
│  Clicking:     [Uploading...] ◄─── (Loading spinner)             │
│                │                                                 │
│  Complete:     [✓ Uploaded]   (Disabled)                         │
│                                                                   │
│  New File:     [Upload File]  (Enabled again)                    │
│                                                                   │
└──────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────┐
│                   ANALYZE BUTTON                                 │
├──────────────────────────────────────────────────────────────────┤
│                                                                   │
│  Initial:          [Analyze] (Disabled - no file)                │
│                    │                                             │
│  File Uploaded:    [Analyze] (Enabled if title+desc filled)      │
│                    │                                             │
│  Clicking:         [Analyzing...] ◄─── (Loading spinner)         │
│                    │                                             │
│  Success:          [✓ Analysis Complete] (Disabled)              │
│                    │                                             │
│  New File/Reset:   [Analyze] (Enabled again)                     │
│                                                                   │
└──────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────┐
│              PRESERVE EVIDENCE BUTTON                             │
├──────────────────────────────────────────────────────────────────┤
│                                                                   │
│  Initial:          [Preserve Evidence] (Disabled)                │
│                    │                                             │
│  File Uploaded:    [Preserve Evidence] (Enabled)                 │
│                    │                                             │
│  Clicking:         ▼                                              │
│                 [Confirmation Dialog]                            │
│                    │                                             │
│         ┌──────────┴──────────┐                                   │
│         │                     │                                   │
│      Cancel                Confirm                                │
│         │                     │                                   │
│         ▼                     ▼                                   │
│      [Dialog Closes] [Preserving...] ◄─── (Loading)              │
│                          │                                        │
│                          ▼                                        │
│                    [Success - Redirect]                           │
│                                                                   │
└──────────────────────────────────────────────────────────────────┘
```

## Component Dependency Graph

```
┌─────────────────────────────────────┐
│  EvidenceUpload Component           │
├─────────────────────────────────────┤
│                                     │
│  State:                             │
│  ├── Form: title, description       │
│  ├── Upload: isUploading, ...       │
│  ├── Analyze: isAnalyzing, ...      │
│  └── Preserve: isPreserving, ...    │
│                                     │
│  Handlers:                          │
│  ├── handleFileChange()             │
│  ├── handleUploadFile()  ────────┐  │
│  ├── handleAnalyze()     ────┐   │  │
│  └── handlePreserveClick() ─┐ │   │  │
│     + handleConfirmPreserve()│ │   │  │
│                             │ │   │  │
├─────────────────────────────┼─┼───┼──┤
│ Firebase Integration        │ │   │  │
├─────────────────────────────┼─┼───┼──┤
│                             │ │   │  │
│  storage.uploadBytesResumable() ◄──┤
│  storage.getDownloadURL()    ◄─────┘
│                             │
├─────────────────────────────┼──────────
│ Backend API Calls           │
├─────────────────────────────┼──────────
│                             │
│  POST /functions/startUpload ◄────────
│  POST /api/analyze           ◄─┐
│  POST /api/cases             ◄─┼─
│  POST /api/preserve          ◄─┘
│                                   
└─────────────────────────────────────
```

## Error Flow Diagram

```
User Action
    │
    ▼
┌───────────────────┐
│ API Call          │
└────────┬──────────┘
         │
    ┌────┴────────────────┬────────────────┬──────────┐
    │                     │                │          │
    ▼                     ▼                ▼          ▼
  200 OK            400 Bad Request      404 Not Found  500 Error
    │                     │                │          │
    ▼                     ▼                ▼          ▼
Parse JSON         Show: "Invalid        Show:      Show:
Extract Data       params"            "Endpoint   "API Key
Set State                             not found"   error"
    │
    ▼
[SUCCESS]

    For 404:
    ▼
    └─► Check /api/analyze exists
        in server.ts

    For 500:
    ▼
    └─► Check GEMINI_API_KEY
        is set and valid

    For Timeout:
    ▼
    └─► Check network
        Check API server up
```

## Data Flow During Upload

```
1. User selects file
   │
   ├─ File object created
   │ (File.name, File.size, File.type)
   │
   └─ calculateSHA256(file) starts in background
      │
      ├─ Read file as ArrayBuffer
      │ ├─ crypto.subtle.digest('SHA-256', buffer)
      │ └─ Convert to hex string
      │
      └─ setClientHash(hash)
         setClientHashGeneratedAt(timestamp)

2. User clicks "Upload File"
   │
   ├─ POST /functions/startUpload
   │  Request: {
   │    fileName: "test.pdf",
   │    fileSize: 1024000,
   │    mimeType: "application/pdf",
   │    clientSha256: "abc123...",
   │    deviceInfo: {...}
   │  }
   │
   │  Response: {
   │    evidenceId: "uuid"
   │  }
   │
   └─ setEvidenceId(uuid)

3. Upload to Firebase
   │
   ├─ storageRef(storage, `evidence/unlinked/{uuid}/{name}`)
   │ ├─ uploadBytesResumable(ref, file, metadata)
   │ │  metadata: {
   │ │    customMetadata: {
   │ │      evidenceId: uuid,
   │ │      clientSha256: hash
   │ │    }
   │ │  }
   │ │
   │ └─ Listen: state_changed → progress updates
   │    Listen: success → compute server hash
   │
   ├─ Read file again (server-side verification)
   │ ├─ crypto.subtle.digest('SHA-256', buffer)
   │ └─ Convert to hex string
   │
   ├─ Compare hashes
   │ ├─ If match: setServerHash(hash) + ✓ verified
   │ └─ If mismatch: warn in console
   │
   └─ setFileUploaded(true)

4. Button states update
   │
   ├─ Upload button → disabled, shows checkmark
   ├─ Analyze button → enabled
   └─ Preserve button → enabled
```

## Data Flow During Analysis

```
1. User clicks "Analyze"
   │
   ├─ setIsAnalyzing(true)
   ├─ setAnalysisError('')
   └─ Clear previous results

2. POST /api/analyze
   │
   ├─ Request body: {
   │   title: "Suspicious emails",
   │   description: "Got weird emails from..."
   │ }
   │
   └─ Console: "[Analyze] Starting AI analysis..."

3. Server processes
   │
   ├─ Google Gemini API call
   │ ├─ Model: gemini-3.1-pro-preview
   │ ├─ Prompt: "Analyze for threats..."
   │ └─ Timeout: 30 seconds
   │
   └─ Response parsing

4. Response handling
   │
   ├─ Status 200 OK
   │ ├─ Parse JSON
   │ ├─ Extract: risk_score, detected_threats, recommendations
   │ └─ setAnalysisResult(data)
   │
   ├─ Status 404
   │ ├─ Error: "Endpoint not found"
   │ └─ Check /api/analyze exists
   │
   ├─ Status 500
   │ ├─ Error: "API Key error"
   │ └─ Check GEMINI_API_KEY
   │
   └─ Timeout
       ├─ Error: "Request took too long"
       └─ Check network

5. UI updates
   │
   ├─ setAnalysisComplete(true)
   ├─ Display risk score bar
   ├─ Display threats
   └─ Display recommendations

6. Button states update
   │
   ├─ Analyze button → shows checkmark, disabled
   └─ Preserve button → still enabled
```

## Authorization & Permissions Flow

```
┌──────────────────────────────────────────┐
│ Firebase Auth Context                    │
├──────────────────────────────────────────┤
│                                          │
│  Current User:                           │
│  ├─ UID: (from firebase auth)            │
│  ├─ Email: (from firebase auth)          │
│  └─ ID Token: (from getIdToken())        │
│                                          │
│  Used in:                                │
│  └─ POST /functions/startUpload          │
│     Header: Authorization: Bearer {token}│
│                                          │
├──────────────────────────────────────────┤
│ Backend Mock Auth (for demo)             │
├──────────────────────────────────────────┤
│                                          │
│  Mock User ID:                           │
│  └─ mockUserId = 'user-123'              │
│                                          │
│  Used in:                                │
│  ├─ INSERT INTO evidence                 │
│  │  user_id = mockUserId                 │
│  │                                       │
│  ├─ INSERT INTO cases                    │
│  │  user_id = mockUserId                 │
│  │                                       │
│  └─ INSERT INTO audit_logs               │
│     user_id = mockUserId                 │
│                                          │
└──────────────────────────────────────────┘
```

---

## Quick Reference: Button Enablement Rules

```
UPLOAD FILE:
  Enabled  = file selected && !uploading && !fileUploaded
  Color    = Blue (hover) when enabled, Green (checkmark) when done

ANALYZE:
  Enabled  = fileUploaded && title.length > 0 && description.length > 0
           && !analyzing && !analysisComplete
  Color    = Purple (hover) when enabled, Green (checkmark) when done

PRESERVE EVIDENCE:
  Enabled  = fileUploaded && title.length > 0 && description.length > 0
           && !preserving
  Color    = Emerald (always, no hover change during action)
  Behavior = Confirms in dialog before action
```

## Quick Reference: State Variables

```
UPLOAD STATE:
├─ isUploading: boolean          // Button clicking
├─ fileUploaded: boolean         // Upload success
├─ clientHash: string            // Pre-upload SHA256
├─ clientHashGeneratedAt: string // When computed
├─ evidenceId: string            // From backend
├─ serverHash: string            // Post-upload SHA256

ANALYZE STATE:
├─ isAnalyzing: boolean          // Button clicking
├─ analysisComplete: boolean     // Analysis done
├─ analysisResult: object | null // AI response
├─ analysisError: string         // Error message

PRESERVE STATE:
├─ isPreserving: boolean         // During preserve
├─ showConfirmDialog: boolean    // Dialog shown
├─ caseId: string               // Created case ID

GENERAL:
├─ title: string                // Case title
├─ description: string          // Case description
├─ file: File | null            // Selected file
├─ error: string                // Top-level error
├─ navigate: function           // Router navigation
```

---

**All diagrams represent the NEW refactored 3-button architecture.**
