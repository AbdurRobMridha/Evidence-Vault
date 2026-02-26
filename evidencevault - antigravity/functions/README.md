# Evidence Vault Cloud Functions

This folder contains Cloud Functions used for server-side integrity verification.

Functions:
- `startUpload` (HTTPS): register an evidence document and initial audit log before client uploads to Storage. Requires Authorization header with Firebase ID token.
- `onObjectFinalized` (Storage trigger): downloads uploaded file, computes SHA-256, compares with recorded client hash, updates `evidence` document and writes audit logs.

Deploy:

```bash
cd functions
npm install
firebase deploy --only functions
```

Notes:
- Functions use Admin SDK and therefore bypass Firestore security rules for server writes.
- For very large files, consider streaming hash to avoid storing entire file in /tmp.
