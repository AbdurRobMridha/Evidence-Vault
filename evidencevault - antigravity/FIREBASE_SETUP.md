# Evidence Vault - Firebase Setup & Deployment Guide

## ⚠️ TROUBLESHOOTING: auth/configuration-not-found Error

If you see the error `Firebase: Error (auth/configuration-not-found)`, Firebase Authentication is not enabled in your project.

### Quick Fix:
1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select **evidence-vault-67dba** project
3. Click **Authentication** in the left sidebar
4. Click **Sign-in method** tab
5. Enable **Email/Password** and click Save

**For now, you can use the fallback mock authentication:**
- The app automatically uses mock auth if Firebase isn't configured
- Test with: `victim@example.com` / `password` or `authority@police.gov` / `password`

---

# Evidence Vault - Firebase Setup & Deployment Guide

This document outlines the architecture and deployment instructions for migrating the Evidence Vault hackathon prototype to a production-ready Firebase environment (Free Spark Plan).

## 1. Firebase Configuration

Initialize your Firebase project and add the following configuration to your frontend environment:

\`\`\`javascript
// src/lib/firebase.ts
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY,
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.VITE_FIREBASE_APP_ID
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
\`\`\`

## 2. Firestore Schema & Security Rules

### Schema Structure

- **\`users/{userId}\`**
  - \`email\`: string
  - \`role\`: string ("user" | "admin")
  - \`dead_man_interval_hours\`: number
  - \`last_checkin\`: timestamp
  - \`next_checkin\`: timestamp
  - \`status\`: string ("active" | "danger")

- **\`cases/{caseId}\`**
  - \`user_id\`: string
  - \`title\`: string
  - \`description\`: string
  - \`risk_score\`: number
  - \`risk_analysis\`: string (JSON)
  - \`status\`: string ("open" | "closed" | "escalated")
  - \`created_at\`: timestamp

- **\`evidence/{evidenceId}\`**
  - \`case_id\`: string
  - \`user_id\`: string
  - \`file_name\`: string
  - \`file_type\`: string
  - \`file_size\`: number
  - \`client_sha256\`: string
  - \`server_sha256\`: string
  - \`integrity_verified\`: boolean
  - \`storage_path\`: string
  - \`upload_timestamp\`: timestamp

- **\`audit_logs/{logId}\`**
  - \`case_id\`: string
  - \`user_id\`: string
  - \`action\`: string
  - \`details\`: string
  - \`timestamp\`: timestamp

### Firestore Security Rules (Immutable Audit Logs)

\`\`\`javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    
    // Helper functions
    function isAuthenticated() { return request.auth != null; }
    function isOwner(userId) { return request.auth.uid == userId; }
    function isAdmin() { return get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin'; }

    match /users/{userId} {
      allow read: if isAuthenticated() && (isOwner(userId) || isAdmin());
      allow update: if isAuthenticated() && isOwner(userId) && request.resource.data.diff(resource.data).affectedKeys().hasOnly(['last_checkin', 'next_checkin', 'status', 'dead_man_interval_hours']);
    }

    match /cases/{caseId} {
      allow read: if isAuthenticated() && (isOwner(resource.data.user_id) || isAdmin());
      allow create: if isAuthenticated() && isOwner(request.resource.data.user_id);
      allow update: if isAdmin(); // Only admins/system can update case status
    }

    match /evidence/{evidenceId} {
      allow read: if isAuthenticated() && (isOwner(resource.data.user_id) || isAdmin());
      allow create: if isAuthenticated() && isOwner(request.resource.data.user_id);
      allow update, delete: if false; // Immutable evidence records
    }

    match /audit_logs/{logId} {
      allow read: if isAuthenticated() && (isAdmin() || isOwner(resource.data.user_id));
      allow create: if isAuthenticated(); // Anyone can append logs
      allow update, delete: if false; // Append-only immutable logs
    }
  }
}
\`\`\`

## 3. Storage Structure & Rules

### Structure
\`\`\`
/evidence/{userId}/{caseId}/{timestamp}_{filename}
/exports/{caseId}/evidence_vault_case_{caseId}.zip
\`\`\`

### Storage Security Rules
\`\`\`javascript
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /evidence/{userId}/{caseId}/{fileName} {
      allow read: if request.auth != null && (request.auth.uid == userId || firestore.get(/databases/(default)/documents/users/$(request.auth.uid)).data.role == 'admin');
      allow create: if request.auth != null && request.auth.uid == userId && request.resource.size < 50 * 1024 * 1024; // 50MB max
      allow update, delete: if false; // Immutable evidence
    }
    match /exports/{caseId}/{fileName} {
      allow read: if request.auth != null; // Further restricted by signed URLs in practice
      allow write: if false; // Only Cloud Functions can write exports
    }
  }
}
\`\`\`

## 4. Cloud Functions (Node.js)

Deploy these functions to Firebase to handle backend logic.

\`\`\`javascript
const functions = require('firebase-functions');
const admin = require('firebase-admin');
const crypto = require('crypto');
const { GoogleGenAI } = require('@google/genai');

admin.initializeApp();
const db = admin.firestore();
const storage = admin.storage();

// 1. Evidence Integrity Verification (Triggered on Storage Upload)
exports.verifyEvidenceIntegrity = functions.storage.object().onFinalize(async (object) => {
  if (!object.name.startsWith('evidence/')) return;

  const fileBucket = object.bucket;
  const filePath = object.name;
  const file = storage.bucket(fileBucket).file(filePath);
  
  // Download file to memory to calculate hash
  const [buffer] = await file.download();
  const serverSha256 = crypto.createHash('sha256').update(buffer).digest('hex');

  // Find corresponding Firestore document (assuming metadata contains evidenceId)
  const evidenceId = object.metadata.evidenceId;
  const evidenceRef = db.collection('evidence').doc(evidenceId);
  const evidenceDoc = await evidenceRef.get();
  
  if (evidenceDoc.exists) {
    const clientSha256 = evidenceDoc.data().client_sha256;
    const isVerified = clientSha256 === serverSha256;
    
    await evidenceRef.update({
      server_sha256: serverSha256,
      integrity_verified: isVerified
    });
    
    await db.collection('audit_logs').add({
      case_id: evidenceDoc.data().case_id,
      user_id: evidenceDoc.data().user_id,
      action: 'EVIDENCE_VERIFIED',
      details: \`Server hash generated. Integrity verified: \${isVerified}\`,
      timestamp: admin.firestore.FieldValue.serverTimestamp()
    });
  }
});

// 2. Dead-Man Timer Check (Pub/Sub Scheduled Function)
exports.checkDeadManSwitches = functions.pubsub.schedule('every 5 minutes').onRun(async (context) => {
  const now = admin.firestore.Timestamp.now();
  
  const overdueUsersSnapshot = await db.collection('users')
    .where('status', '==', 'active')
    .where('next_checkin', '<', now)
    .get();

  const batch = db.batch();

  for (const userDoc of overdueUsersSnapshot.docs) {
    // Mark user as in danger
    batch.update(userDoc.ref, { status: 'danger' });

    // Escalate all open cases for this user
    const casesSnapshot = await db.collection('cases')
      .where('user_id', '==', userDoc.id)
      .where('status', '==', 'open')
      .get();

    for (const caseDoc of casesSnapshot.docs) {
      batch.update(caseDoc.ref, { status: 'escalated' });
      
      // Log escalation
      const logRef = db.collection('audit_logs').doc();
      batch.set(logRef, {
        case_id: caseDoc.id,
        user_id: userDoc.id,
        action: 'AUTO_ESCALATION',
        details: 'Dead-Man switch triggered. Case escalated.',
        timestamp: admin.firestore.FieldValue.serverTimestamp()
      });
      
      // Trigger ZIP generation (can be done via Pub/Sub or direct call)
      // await generateCaseZip(caseDoc.id);
    }
  }

  await batch.commit();
});

// 3. AI Risk Analysis (Callable Function)
exports.analyzeCaseRisk = functions.https.onCall(async (data, context) => {
  if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Must be logged in.');
  
  const { title, description } = data;
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  
  const prompt = \`Analyze the following case description for cyber harassment, surveillance, or technology-facilitated abuse.
  Title: \${title}
  Description: \${description}
  
  Provide a JSON response with:
  - risk_score: integer from 1 to 10
  - detected_threats: array of strings
  - recommendations: array of strings
  \`;
  
  const response = await ai.models.generateContent({
    model: 'gemini-3.1-pro-preview',
    contents: prompt,
    config: {
      responseMimeType: 'application/json',
      thinkingConfig: { thinkingLevel: 'HIGH' }
    }
  });
  
  return JSON.parse(response.text);
});
\`\`\`

## 5. Deployment Instructions (Free Plan)

1. **Install Firebase CLI:**
   \`npm install -g firebase-tools\`

2. **Login & Init:**
   \`firebase login\`
   \`firebase init\` (Select Firestore, Functions, Storage, Hosting)

3. **Deploy Rules & Indexes:**
   \`firebase deploy --only firestore:rules,storage\`

4. **Deploy Functions:**
   \`firebase deploy --only functions\`
   *(Note: Scheduled functions require the Blaze plan, but you can trigger them manually via HTTP for a hackathon demo on the Spark plan).*

5. **Deploy Frontend:**
   \`npm run build\`
   \`firebase deploy --only hosting\`
