const functions = require('firebase-functions');
const admin = require('firebase-admin');
const crypto = require('crypto');
const os = require('os');
const path = require('path');
const fs = require('fs');

admin.initializeApp();
const db = admin.firestore();

exports.startUpload = functions.https.onRequest(async (req, res) => {
  try {
    if (req.method !== 'POST') return res.status(405).send({ message: 'Method Not Allowed' });

    const authHeader = (req.headers.authorization || '');
    const idToken = authHeader.startsWith('Bearer ') ? authHeader.split('Bearer ')[1] : null;
    if (!idToken) return res.status(401).send({ message: 'Missing auth token' });

    const decoded = await admin.auth().verifyIdToken(idToken);
    const uid = decoded.uid;

    const { caseId, fileName, fileSize, mimeType, clientSha256, deviceInfo } = req.body || {};
    if (!caseId || !fileName || !clientSha256) return res.status(400).send({ message: 'Missing required fields' });

    // capture uploader IP (x-forwarded-for preferred)
    const ip = (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').toString();
    const ipHash = crypto.createHash('sha256').update(ip).digest('hex');

    const evidenceId = `EV-${Date.now().toString(36)}-${crypto.randomBytes(6).toString('hex')}`;

    const evidenceRef = db.collection('evidence').doc(evidenceId);
    await evidenceRef.set({
      file_name: fileName,
      file_size: Number(fileSize) || 0,
      mime_type: mimeType || 'application/octet-stream',
      client_sha256: (clientSha256 || '').toLowerCase(),
      client_hash_generated_at: admin.firestore.FieldValue.serverTimestamp(),
      server_sha256: null,
      integrity_status: 'PENDING',
      upload_timestamp: admin.firestore.FieldValue.serverTimestamp(),
      uploaded_by: uid,
      device_info: deviceInfo || {},
      ip_hash: ipHash,
      case_id: caseId,
      storage_path: null,
      audit_log_ids: []
    });

    const logRef = db.collection('evidence_audit_logs').doc();
    await logRef.set({
      action_type: 'hash_generated',
      performed_by: uid,
      server_timestamp: admin.firestore.FieldValue.serverTimestamp(),
      related_evidence_id: evidenceId,
      details: { client_sha256: (clientSha256 || '').toLowerCase(), note: 'Client generated SHA-256 and registered upload.' },
      ip_hash: ipHash
    });

    await evidenceRef.update({ audit_log_ids: admin.firestore.FieldValue.arrayUnion(logRef.id) });

    return res.status(200).send({ evidenceId, message: 'Registered', uploadTimestamp: new Date().toISOString() });
  } catch (err) {
    console.error('startUpload error', err);
    return res.status(500).send({ message: err.message || 'Internal error' });
  }
});

exports.onObjectFinalized = functions.storage.object().onFinalize(async (object) => {
  try {
    const bucket = admin.storage().bucket(object.bucket);
    const objectPath = object.name; // e.g. evidence/{caseId}/{evidenceId}/{filename}
    const metadata = object.metadata || {};
    const evidenceId = metadata.evidenceId || null;

    if (!evidenceId) {
      console.warn('No evidenceId metadata on uploaded object:', objectPath);
      return;
    }

    const tmpDir = os.tmpdir();
    const tempFilePath = path.join(tmpDir, `${Date.now().toString(36)}-${path.basename(objectPath).replace(/\//g,'_')}`);
    await bucket.file(objectPath).download({ destination: tempFilePath });

    const fileBuffer = fs.readFileSync(tempFilePath);
    const serverHash = crypto.createHash('sha256').update(fileBuffer).digest('hex');

    const evidenceRef = db.collection('evidence').doc(evidenceId);
    const evidenceSnap = await evidenceRef.get();
    if (!evidenceSnap.exists) {
      console.warn('Evidence doc not found for id:', evidenceId);
      const lref = db.collection('evidence_audit_logs').doc();
      await lref.set({ action_type: 'file_uploaded', performed_by: 'SYSTEM', server_timestamp: admin.firestore.FieldValue.serverTimestamp(), related_evidence_id: evidenceId, details: { storage_path: objectPath } });
      return;
    }

    const doc = evidenceSnap.data() || {};
    const clientSha = (doc.client_sha256 || '').toLowerCase();
    const serverSha = serverHash.toLowerCase();
    const integrity_status = (clientSha && serverSha && clientSha === serverSha) ? 'VERIFIED' : 'FAILED';

    const batch = db.batch();
    const fileUploadedRef = db.collection('evidence_audit_logs').doc();
    batch.set(fileUploadedRef, {
      action_type: 'file_uploaded',
      performed_by: 'SYSTEM',
      server_timestamp: admin.firestore.FieldValue.serverTimestamp(),
      related_evidence_id: evidenceId,
      details: { storage_path: objectPath, size: object.size || null }
    });

    const hashVerifiedRef = db.collection('evidence_audit_logs').doc();
    batch.set(hashVerifiedRef, {
      action_type: 'hash_verified',
      performed_by: 'SYSTEM',
      server_timestamp: admin.firestore.FieldValue.serverTimestamp(),
      related_evidence_id: evidenceId,
      details: { client_sha256: clientSha, server_sha256: serverSha, match: integrity_status === 'VERIFIED' }
    });

    const integrityCheckedRef = db.collection('evidence_audit_logs').doc();
    batch.set(integrityCheckedRef, {
      action_type: 'integrity_checked',
      performed_by: 'SYSTEM',
      server_timestamp: admin.firestore.FieldValue.serverTimestamp(),
      related_evidence_id: evidenceId,
      details: { integrity_status }
    });

    batch.update(evidenceRef, {
      server_sha256: serverSha,
      integrity_status,
      storage_path: objectPath,
      verification_timestamp: admin.firestore.FieldValue.serverTimestamp(),
      audit_log_ids: admin.firestore.FieldValue.arrayUnion(fileUploadedRef.id, hashVerifiedRef.id, integrityCheckedRef.id)
    });

    await batch.commit();

    try { fs.unlinkSync(tempFilePath); } catch (e) {}

    console.log(`Processed evidence ${evidenceId}, integrity: ${integrity_status}`);
    return;
  } catch (err) {
    console.error('onObjectFinalized error', err);
    return;
  }
});
