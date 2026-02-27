# Quick Start Guide - Evidence Upload Refactoring

## 🚀 Get Started in 3 Steps

### Step 1: Set Environment Variables

```bash
# Windows PowerShell
$env:GEMINI_API_KEY = "your-actual-gemini-api-key-here"

# Or create .env file in project root:
GEMINI_API_KEY=your-actual-gemini-api-key-here
```

### Step 2: Start the Server

```bash
cd d:\evidencevault
npm install  # If needed
npm run dev  # Start dev server
```

### Step 3: Open in Browser

```
http://localhost:5173
Navigate to: Preserve Evidence page
```

---

## 📋 The Three Buttons

### Button 1️⃣: Upload File
- **Click to**: Upload file to Firebase temporarily
- **Requires**: File selected
- **Does**: Generates SHA-256 hash, shows file metadata
- **Result**: Shows "✓ Uploaded" when done
- **Next**: Enables Analyze and Preserve buttons

### Button 2️⃣: Analyze
- **Click to**: Run AI threat analysis
- **Requires**: File uploaded + Title + Description
- **Does**: Calls Gemini API, shows risk score + threats
- **Result**: Shows analysis results with risk visualization
- **Next**: Optional - can proceed to Preserve without analyzing

### Button 3️⃣: Preserve Evidence
- **Click to**: Permanently save evidence and create case
- **Requires**: File uploaded + Title + Description
- **Does**: Shows confirmation dialog → Creates case → Links evidence
- **Result**: Redirects to case details page
- **Important**: Cannot be undone!

---

## 🎯 Typical User Flow

```
1. Select file (auto-computes hash)
   ↓
2. Enter case title and description
   ↓
3. Click "Upload File" (wait for checkmark)
   ↓