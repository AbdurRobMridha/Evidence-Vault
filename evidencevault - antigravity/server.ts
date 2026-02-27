import express from 'express';
import { createServer as createViteServer } from 'vite';
import multer from 'multer';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import archiver from 'archiver';
import Database from 'better-sqlite3';
import { GoogleGenAI, ThinkingLevel } from '@google/genai';
import dotenv from 'dotenv';
import nodemailer from 'nodemailer';

// Load environment variables from .env
dotenv.config();

const app = express();
const PORT = 3000;

// Middleware
app.use(express.json());

// Initialize Database
const dbDir = path.join(process.cwd(), 'data');
if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir);
const db = new Database(path.join(dbDir, 'vault.db'));

// Ensure schema evolution: add columns/tables if missing
try {
  const userCols = db.prepare("PRAGMA table_info('users')").all();
  const colNames = userCols.map((c: any) => c.name);
  if (!colNames.includes('trusted_contacts')) {
    db.prepare("ALTER TABLE users ADD COLUMN trusted_contacts TEXT").run();
  }
  if (!colNames.includes('reminder_minutes_before')) {
    db.prepare("ALTER TABLE users ADD COLUMN reminder_minutes_before INTEGER DEFAULT 60").run();
  }
  if (!colNames.includes('reminder_sent')) {
    db.prepare("ALTER TABLE users ADD COLUMN reminder_sent INTEGER DEFAULT 0").run();
  }
  if (!colNames.includes('emergency_release_enabled')) {
    db.prepare("ALTER TABLE users ADD COLUMN emergency_release_enabled INTEGER DEFAULT 0").run();
  }
  if (!colNames.includes('emergency_release_sent')) {
    db.prepare("ALTER TABLE users ADD COLUMN emergency_release_sent INTEGER DEFAULT 0").run();
  }
  if (!colNames.includes('emergency_custom_message')) {
    db.prepare("ALTER TABLE users ADD COLUMN emergency_custom_message TEXT").run();
  }
  if (!colNames.includes('last_emergency_release')) {
    db.prepare("ALTER TABLE users ADD COLUMN last_emergency_release TEXT").run();
  }
} catch (e) {
  console.warn('Schema evolution skipped or failed:', e.message || e);
}

// Create tokens table for secure temporary download links
db.exec(`
  CREATE TABLE IF NOT EXISTS tokens (
    token TEXT PRIMARY KEY,
    case_id TEXT,
    expires_at DATETIME,
    allowed_emails TEXT,
    file_path TEXT
  );
`);

// Initialize Uploads Directory
const uploadsDir = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir);

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + '-' + file.originalname);
  },
});
const upload = multer({ storage });

// Database Schema
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE,
    password_hash TEXT,
    role TEXT DEFAULT 'user',
    dead_man_interval_hours INTEGER DEFAULT 24,
    last_checkin DATETIME DEFAULT CURRENT_TIMESTAMP,
    next_checkin DATETIME,
    status TEXT DEFAULT 'active'
  );

  CREATE TABLE IF NOT EXISTS contacts (
    id TEXT PRIMARY KEY,
    user_id TEXT,
    name TEXT,
    email TEXT,
    role TEXT,
    FOREIGN KEY(user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS cases (
    id TEXT PRIMARY KEY,
    user_id TEXT,
    title TEXT,
    description TEXT,
    risk_score INTEGER,
    risk_analysis TEXT,
    status TEXT DEFAULT 'open',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS evidence (
    id TEXT PRIMARY KEY,
    case_id TEXT,
    user_id TEXT,
    file_name TEXT,
    file_type TEXT,
    file_size INTEGER,
    client_sha256 TEXT,
    server_sha256 TEXT,
    integrity_verified BOOLEAN,
    upload_timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    file_path TEXT,
    FOREIGN KEY(case_id) REFERENCES cases(id),
    FOREIGN KEY(user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS audit_logs (
    id TEXT PRIMARY KEY,
    case_id TEXT,
    user_id TEXT,
    action TEXT,
    details TEXT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

// Ensure audit_logs has archived column for safe archival instead of hard delete
try {
  const auditCols = db.prepare("PRAGMA table_info('audit_logs')").all();
  const aNames = auditCols.map((c: any) => c.name);
  if (!aNames.includes('archived')) {
    db.prepare("ALTER TABLE audit_logs ADD COLUMN archived INTEGER DEFAULT 0").run();
  }
} catch (e) {
  console.warn('Failed to evolve audit_logs schema:', e.message || e);
}

// Mock User for Hackathon Demo
const mockUserId = 'user-123';
const mockAdminId = 'admin-456';
const stmt = db.prepare('INSERT OR IGNORE INTO users (id, email, password_hash, role, next_checkin) VALUES (?, ?, ?, ?, datetime(\'now\', \'+24 hours\'))');
stmt.run(mockUserId, 'victim@example.com', 'hashed_pw', 'user');
stmt.run(mockAdminId, 'authority@police.gov', 'hashed_pw', 'admin');

// Helper to log audit
function logAudit(caseId: string | null, userId: string, action: string, details: string) {
  const id = crypto.randomUUID();
  db.prepare('INSERT INTO audit_logs (id, case_id, user_id, action, details) VALUES (?, ?, ?, ?, ?)').run(id, caseId, userId, action, details);
}

// --- API ROUTES ---

// 1. Auth (Mocked for demo)
app.post('/api/auth/login', (req, res) => {
  const { email } = req.body;
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  if (user) {
    res.json({ token: 'mock-jwt-token', user });
  } else {
    res.status(401).json({ error: 'Invalid credentials' });
  }
});

app.get('/api/me', (req, res) => {
  // Mocking auth middleware
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(mockUserId);
  res.json(user);
});

// Helper: AI Analysis with timeout and retry logic
async function performAIAnalysis(title: string, description: string): Promise<{ risk_score: number; risk_analysis: string }> {
  let risk_score = 0;
  let risk_analysis = '{}';

  async function callGenAIWithRetries(prompt: string, maxAttempts = 3, timeoutMs = 30000) {
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    let attempt = 0;

    while (attempt < maxAttempts) {
      attempt += 1;
      try {
        // Wrap in timeout promise
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => reject(new Error(`AI analysis timeout after ${timeoutMs}ms`)), timeoutMs);
        });

        const response = await Promise.race([
          ai.models.generateContent({
            model: 'gemini-3.1-pro-preview',
            contents: prompt,
            config: {
              responseMimeType: 'application/json',
              thinkingConfig: { thinkingLevel: ThinkingLevel.HIGH }
            }
          }),
          timeoutPromise
        ]);

        return response;
      } catch (err: any) {
        // Check for timeout
        if (err.message && err.message.includes('timeout')) {
          console.error(`GenAI timeout on attempt ${attempt}/${maxAttempts}`);
          if (attempt >= maxAttempts) {
            throw new Error('AI analysis timed out after 30 seconds');
          }
          continue;
        }

        // If rate-limited, attempt to parse retry info and wait
        try {
          const msg = err?.message || '';
          const m = msg.match(/retryDelay"\s*:\s*"?(\\?\d+s)"?/);
          if (m && m[1]) {
            const s = parseInt(m[1].replace(/\\?s/, ''), 10);
            const waitMs = (isNaN(s) ? 2 : s) * 1000;
            console.warn(`GenAI rate-limited, attempt ${attempt}/${maxAttempts}, waiting ${waitMs}ms`);
            await new Promise(r => setTimeout(r, waitMs));
            continue;
          }
        } catch (_) {
          // ignore parsing errors
        }

        // Generic exponential backoff for transient errors
        const backoffMs = Math.min(30000, 1000 * Math.pow(2, attempt));
        console.warn(`GenAI call failed (attempt ${attempt}/${maxAttempts}) - backing off ${backoffMs}ms:`, err?.message || err);

        if (attempt >= maxAttempts) {
          throw err;
        }

        await new Promise(r => setTimeout(r, backoffMs));
      }
    }

    throw new Error('AI analysis failed after all retries exhausted');
  }

  try {
    const prompt = `Analyze the following case description for cyber harassment, surveillance, or technology-facilitated abuse.\nTitle: ${title}\nDescription: ${description}\n\nProvide a JSON response with:\n- risk_score: integer from 1 to 10\n- detected_threats: array of strings (e.g., "Phishing", "Stalking")\n- recommendations: array of strings for immediate action`;

    const response = await callGenAIWithRetries(prompt, 3, 30000);

    if (response && response.text) {
      try {
        const aiResult = JSON.parse(response.text || '{}');
        risk_score = aiResult.risk_score || 0;
        risk_analysis = JSON.stringify(aiResult);
        console.log('AI Analysis complete:', { risk_score, detected_threats: aiResult.detected_threats });
      } catch (parseErr) {
        console.warn('GenAI returned non-JSON or unparsable response:', response.text);
        throw new Error('Failed to parse AI response as JSON');
      }
    } else {
      throw new Error('No response from AI service');
    }
  } catch (err) {
    console.error('AI Analysis failed:', err);
    throw err;
  }

  return { risk_score, risk_analysis };
}

// 2. Cases
app.get('/api/cases', (req, res) => {
  const cases = db.prepare('SELECT * FROM cases WHERE user_id = ? ORDER BY created_at DESC').all(mockUserId);
  res.json(cases);
});

app.get('/api/admin/cases', (req, res) => {
  const cases = db.prepare('SELECT * FROM cases WHERE status = \'escalated\' ORDER BY created_at DESC').all();
  res.json(cases);
});

// ── Server-side local fallback analyzer ──────────────────────────────────────
function serverLocalAnalysis(title: string, description: string, fileName?: string, fileSize?: number, fileType?: string) {
  const SUSPICIOUS_KW = [
    'confidential', 'leak', 'password', 'internal', 'classified', 'secret',
    'hack', 'exploit', 'malware', 'phishing', 'threat', 'attack', 'breach',
    'stolen', 'unauthorized', 'illegal', 'fraud', 'blackmail', 'extortion',
    'stalking', 'harassment', 'abuse', 'spy', 'surveillance', 'ransom',
    'keylogger', 'trojan', 'virus', 'spyware', 'rootkit', 'backdoor',
    'credential', 'dump', 'exfiltrate', 'injection', 'vulnerability',
  ];
  const HIGH_EXT = ['.exe', '.bat', '.cmd', '.scr', '.msi', '.ps1', '.vbs', '.js', '.wsf'];
  const MED_EXT = ['.zip', '.rar', '.7z', '.tar', '.gz', '.iso', '.dmg'];

  const combined = `${title} ${description} ${fileName || ''}`.toLowerCase();
  const ext = fileName ? (fileName.lastIndexOf('.') >= 0 ? fileName.substring(fileName.lastIndexOf('.')).toLowerCase() : '') : '';

  let score = 2;
  const threats: string[] = [];
  const recommendations: string[] = [];

  // File type
  if (HIGH_EXT.includes(ext)) { score += 4; threats.push(`High-risk file type: ${ext}`); }
  else if (MED_EXT.includes(ext)) { score += 2; threats.push(`Archive format: ${ext}`); }

  // Keywords
  const found = SUSPICIOUS_KW.filter(kw => combined.includes(kw));
  if (found.length > 0) { score += Math.min(4, found.length); threats.push(`Suspicious keywords: ${found.join(', ')}`); }

  // Size
  if (fileSize && fileSize > 100 * 1024 * 1024) { score += 1; threats.push(`Unusually large file: ${(fileSize / 1024 / 1024).toFixed(1)} MB`); }

  score = Math.max(1, Math.min(10, score));

  // Recommendations
  recommendations.push('Preserve evidence immediately');
  if (score >= 7) {
    recommendations.push('Escalate to authority');
    recommendations.push('Restrict case access');
    recommendations.push('Conduct deep forensic scan');
  } else if (score >= 4) {
    recommendations.push('Assign investigator for review');
    recommendations.push('Verify metadata authenticity');
  } else {
    recommendations.push('Log in chain-of-custody records');
    recommendations.push('Generate standard forensic report');
  }

  return {
    risk_score: score,
    detected_threats: threats,
    recommendations,
    summary: `Analysis of "${title}" yielded a risk score of ${score}/10. ${threats.length} indicator(s) detected.`,
    analysisSource: 'local-fallback',
  };
}

// NEW: AI Analysis endpoint (STEP 1: analyze only, no case creation)
// This endpoint NEVER returns a 500 error — always produces meaningful output.
app.post('/api/analyze', express.json(), async (req, res) => {
  const { title, description, fileName, fileSize, fileType } = req.body;

  if (!title || !description) {
    return res.status(400).json({ error: 'Title and description are required' });
  }

  // Try Gemini AI first, fallback to local on ANY failure
  try {
    if (!process.env.GEMINI_API_KEY) {
      throw new Error('GEMINI_API_KEY not configured');
    }

    console.log('Starting Gemini AI analysis for:', title);
    const { risk_score, risk_analysis } = await performAIAnalysis(title, description);

    res.json({
      success: true,
      risk_score,
      risk_analysis: JSON.parse(risk_analysis),
      analysisSource: 'gemini-ai',
    });
  } catch (err: any) {
    console.warn('[AI Analyze] Gemini failed, using local fallback:', err.message || err);

    const localResult = serverLocalAnalysis(title, description, fileName, fileSize, fileType);

    res.json({
      success: true,
      risk_score: localResult.risk_score,
      risk_analysis: localResult,
      analysisSource: 'local-fallback',
    });
  }
});

// MODIFIED: /api/cases now creates case WITHOUT AI analysis (AI is done in /api/analyze)
app.post('/api/cases', express.json(), async (req, res) => {
  const { title, description } = req.body;

  if (!title || !description) {
    return res.status(400).json({ error: 'Title and description are required' });
  }

  try {
    const id = crypto.randomUUID();

    // Create case without AI (AI was done separately via /api/analyze)
    // Default values if AI wasn't run
    const risk_score = 0;
    const risk_analysis = '{}';

    db.prepare('INSERT INTO cases (id, user_id, title, description, risk_score, risk_analysis) VALUES (?, ?, ?, ?, ?, ?)').run(
      id, mockUserId, title, description, risk_score, risk_analysis
    );
    logAudit(id, mockUserId, 'CASE_CREATED', 'Case created (AI analysis done separately)');

    res.json({ id, title, description, risk_score });
  } catch (err: any) {
    console.error('Case creation failed:', err);
    res.status(500).json({ error: err.message || 'Failed to create case' });
  }
});

app.get('/api/cases/:id', (req, res) => {
  const caseData = db.prepare('SELECT * FROM cases WHERE id = ?').get(req.params.id) as any;
  const evidence = db.prepare('SELECT * FROM evidence WHERE case_id = ?').all(req.params.id);
  const logs = db.prepare('SELECT * FROM audit_logs WHERE case_id = ? ORDER BY timestamp DESC').all(req.params.id);
  res.json({ ...(caseData || {}), evidence, logs });
});

// Delete Case endpoint - secure cascade deletion
app.post('/api/cases/:id/delete', express.json(), async (req, res) => {
  const caseId = req.params.id;
  // Mock auth: get current user
  const currentUser = db.prepare('SELECT * FROM users WHERE id = ?').get(mockUserId) as any;
  if (!currentUser) return res.status(401).json({ error: 'Not authenticated' });

  const caseRow = db.prepare('SELECT * FROM cases WHERE id = ?').get(caseId) as any;
  if (!caseRow) return res.status(404).json({ error: 'Case not found' });

  // Permission check: owner or admin
  if (caseRow.user_id !== currentUser.id && currentUser.role !== 'admin') {
    return res.status(403).json({ error: 'Forbidden' });
  }

  try {
    // Fetch evidence records
    const evidenceRows = db.prepare('SELECT * FROM evidence WHERE case_id = ?').all(caseId) as any[];

    // Delete files from local storage
    evidenceRows.forEach(ev => {
      try {
        if (ev.file_path && fs.existsSync(ev.file_path)) fs.unlinkSync(ev.file_path);
      } catch (e) {
        console.warn('Failed to delete file', ev.file_path, e.message || e);
      }
    });

    // Remove evidence rows
    db.prepare('DELETE FROM evidence WHERE case_id = ?').run(caseId);

    // Archive audit logs for the case (mark archived instead of hard delete)
    db.prepare('UPDATE audit_logs SET archived = 1 WHERE case_id = ?').run(caseId);

    // Delete case row
    db.prepare('DELETE FROM cases WHERE id = ?').run(caseId);

    // Log deletion event
    logAudit(caseId, currentUser.id, 'case_deleted', `Case ${caseId} deleted by ${currentUser.email}`);

    // If Firebase Admin configured, attempt remote cleanup in Firestore/Storage as well
    if (process.env.FIREBASE_SERVICE_ACCOUNT || process.env.GOOGLE_APPLICATION_CREDENTIALS) {
      try {
        // Lazy import
        const admin = await import('firebase-admin');
        if (!admin.apps.length) {
          if (process.env.FIREBASE_SERVICE_ACCOUNT) {
            const svc = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
            admin.initializeApp({ credential: admin.credential.cert(svc), storageBucket: process.env.FIREBASE_STORAGE_BUCKET });
          } else {
            admin.initializeApp();
          }
        }

        const firestore = admin.firestore();
        const bucket = admin.storage().bucket();

        // Delete Firestore case doc if exists
        try { await firestore.collection('cases').doc(caseId).delete(); } catch (e) { console.warn('Firestore case delete failed', e.message || e); }

        // Delete evidence documents and storage objects
        const evSnap = await firestore.collection('evidence').where('case_id', '==', caseId).get();
        for (const doc of evSnap.docs) {
          const ev = doc.data() as any;
          // if storagePath present, delete file
          if (ev.storagePath) {
            try { await bucket.file(ev.storagePath).delete().catch(() => { }); } catch (e) { console.warn('Failed deleting storage file', ev.storagePath, e.message || e); }
          }
          try { await doc.ref.delete(); } catch (e) { console.warn('Failed deleting evidence doc', e.message || e); }
        }

        // Archive or delete audit logs in Firestore
        const logsSnap = await firestore.collection('audit_logs').where('case_id', '==', caseId).get();
        for (const ldoc of logsSnap.docs) {
          try { await ldoc.ref.update({ archived: true }); } catch (e) { console.warn('Failed archiving remote audit log', e.message || e); }
        }
      } catch (e) {
        console.warn('Firebase admin cleanup failed:', e?.message || e);
      }
    }

    res.json({ success: true });
  } catch (err: any) {
    console.error('Case deletion failed', err);
    res.status(500).json({ error: String(err) });
  }
});

// 3. Evidence Upload
app.post('/api/cases/:id/evidence', upload.single('file'), (req, res) => {
  const file = req.file;
  const { client_sha256 } = req.body;
  const caseId = req.params.id;

  if (!file) return res.status(400).json({ error: 'No file uploaded' });

  // Calculate server-side SHA-256
  const fileBuffer = fs.readFileSync(file.path);
  const hashSum = crypto.createHash('sha256');
  hashSum.update(fileBuffer);
  const server_sha256 = hashSum.digest('hex');

  const integrity_verified = client_sha256 === server_sha256 ? 1 : 0;
  const id = crypto.randomUUID();

  db.prepare(`
    INSERT INTO evidence (id, case_id, user_id, file_name, file_type, file_size, client_sha256, server_sha256, integrity_verified, file_path)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, caseId, mockUserId, file.originalname, file.mimetype, file.size, client_sha256, server_sha256, integrity_verified, file.path);

  logAudit(caseId, mockUserId, 'EVIDENCE_UPLOADED', `File ${file.originalname} uploaded. Integrity verified: ${integrity_verified === 1}`);

  res.json({ id, integrity_verified, server_sha256 });
});

// Safety settings endpoints
app.get('/api/safety', (req, res) => {
  const user = db.prepare('SELECT id, trusted_contacts, dead_man_interval_hours, reminder_minutes_before FROM users WHERE id = ?').get(mockUserId) as any;
  if (!user) return res.status(404).json({ error: 'User not found' });
  let trusted = [];
  try { trusted = JSON.parse(user.trusted_contacts || '[]'); } catch (e) { trusted = []; }
  res.json({ trustedContacts: trusted, deadManIntervalHours: user.dead_man_interval_hours, reminderMinutesBefore: user.reminder_minutes_before });
});

app.post('/api/safety', express.json(), (req, res) => {
  const { trustedContacts, deadManIntervalHours, reminderMinutesBefore } = req.body || {};
  try {
    // read current values
    const userRow = db.prepare('SELECT dead_man_interval_hours, reminder_minutes_before, last_checkin FROM users WHERE id = ?').get(mockUserId) as any;
    const oldInterval = userRow ? Number(userRow.dead_man_interval_hours || 24) : 24;
    const oldReminder = userRow ? Number(userRow.reminder_minutes_before || 60) : 60;

    // persist trusted contacts and timers
    db.prepare('UPDATE users SET trusted_contacts = ?, dead_man_interval_hours = ?, reminder_minutes_before = ? WHERE id = ?')
      .run(JSON.stringify(trustedContacts || []), deadManIntervalHours || 24, reminderMinutesBefore || 60, mockUserId);

    // Recalculate next_checkin based on authoritative last_checkin (server time)
    let lastCheckin = userRow ? userRow.last_checkin : null;
    let lastDate = lastCheckin ? new Date(lastCheckin) : new Date();
    const intervalHours = Number(deadManIntervalHours || oldInterval || 24);
    const nextDate = new Date(lastDate.getTime() + intervalHours * 3600 * 1000);

    db.prepare('UPDATE users SET next_checkin = ? WHERE id = ?').run(nextDate.toISOString(), mockUserId);

    // Audit log the configuration change with details
    const details = JSON.stringify({ old_interval: oldInterval, new_interval: intervalHours, old_reminder: oldReminder, new_reminder: Number(reminderMinutesBefore || oldReminder) });
    logAudit(null, mockUserId, 'deadman_config_updated', details);

    res.json({ success: true, next_checkin: nextDate.toISOString(), last_checkin: lastDate.toISOString() });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

// ──── Emergency Email Release Endpoints ────────────────────────────────────

// GET config
app.get('/api/emergency-release/config', (req, res) => {
  const user = db.prepare('SELECT emergency_release_enabled, emergency_custom_message, last_emergency_release, emergency_release_sent FROM users WHERE id = ?').get(mockUserId) as any;
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json({
    enabled: !!user.emergency_release_enabled,
    customMessage: user.emergency_custom_message || '',
    lastRelease: user.last_emergency_release || null,
    releaseSent: !!user.emergency_release_sent,
    smtpConfigured: !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS && process.env.SMTP_USER !== 'your-email@gmail.com')
  });
});

// POST config
app.post('/api/emergency-release/config', express.json(), (req, res) => {
  const { enabled, customMessage } = req.body || {};
  try {
    db.prepare('UPDATE users SET emergency_release_enabled = ?, emergency_custom_message = ? WHERE id = ?')
      .run(enabled ? 1 : 0, customMessage || '', mockUserId);
    logAudit(null, mockUserId, 'emergency_release_config', `Emergency release ${enabled ? 'enabled' : 'disabled'}`);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

// Reset emergency release sent flag (allows re-sending)
app.post('/api/emergency-release/reset', (req, res) => {
  db.prepare('UPDATE users SET emergency_release_sent = 0 WHERE id = ?').run(mockUserId);
  res.json({ success: true });
});

// Helper: Build professional HTML email
function buildEmergencyEmailHTML(caseData: any, evidence: any[], logs: any[], accessLink: string, customMessage: string): string {
  const evidenceRows = evidence.map((ev: any, i: number) => `
    <tr style="border-bottom: 1px solid #333;">
      <td style="padding: 10px; color: #ccc;">${i + 1}</td>
      <td style="padding: 10px; color: #e5e5e5; font-weight: 600;">${ev.file_name}</td>
      <td style="padding: 10px; color: #ccc; font-family: monospace; font-size: 11px;">${(ev.client_sha256 || 'N/A').substring(0, 16)}...</td>
      <td style="padding: 10px; color: #ccc;">${ev.file_size || 'N/A'} bytes</td>
      <td style="padding: 10px; color: ${ev.client_sha256 === ev.server_sha256 ? '#10b981' : '#f59e0b'};">${ev.client_sha256 === ev.server_sha256 ? '✓ Verified' : '⚠ Pending'}</td>
    </tr>`).join('');

  const custodyEntries = logs.slice(0, 10).map((log: any) => `
    <tr style="border-bottom: 1px solid #333;">
      <td style="padding: 8px; color: #888; font-size: 12px; font-family: monospace;">${log.timestamp}</td>
      <td style="padding: 8px; color: #e5e5e5;">${log.action}</td>
      <td style="padding: 8px; color: #aaa; font-size: 12px;">${log.details || ''}</td>
    </tr>`).join('');

  return `
<!DOCTYPE html>
<html>
<body style="margin: 0; padding: 0; background-color: #0a0a0a; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;">
<div style="max-width: 640px; margin: 0 auto; padding: 32px 20px;">

  <!-- Header -->
  <div style="background: linear-gradient(135deg, #0c1220, #091a1a); border: 1px solid #1a3a2a; border-radius: 16px; padding: 32px; text-align: center; margin-bottom: 24px;">
    <div style="width: 56px; height: 56px; border-radius: 14px; background: rgba(16,185,129,0.1); border: 1px solid rgba(16,185,129,0.2); margin: 0 auto 16px; line-height: 56px; font-size: 28px;">🛡️</div>
    <h1 style="color: #e5e5e5; font-size: 22px; margin: 0 0 8px;">🚨 Emergency Evidence Release</h1>
    <p style="color: #10b981; font-size: 13px; margin: 0; font-weight: 600; letter-spacing: 1px;">DEAD-MAN SWITCH ACTIVATED</p>
  </div>

  <!-- Alert -->
  <div style="background: rgba(239,68,68,0.08); border: 1px solid rgba(239,68,68,0.2); border-radius: 12px; padding: 20px; margin-bottom: 24px;">
    <p style="color: #fca5a5; margin: 0; font-size: 14px;">⚠️ The investigator failed to check in within the scheduled interval. This automated release was triggered by the Dead-Man Switch safety system.</p>
  </div>

  ${customMessage ? `
  <div style="background: #18181b; border: 1px solid #27272a; border-radius: 12px; padding: 20px; margin-bottom: 24px;">
    <p style="color: #a1a1aa; font-size: 12px; margin: 0 0 8px; text-transform: uppercase; letter-spacing: 1px;">Investigator's Message</p>
    <p style="color: #e5e5e5; margin: 0; font-size: 14px;">${customMessage}</p>
  </div>` : ''}

  <!-- Case Info -->
  <div style="background: #18181b; border: 1px solid #27272a; border-radius: 12px; padding: 24px; margin-bottom: 24px;">
    <h2 style="color: #e5e5e5; font-size: 16px; margin: 0 0 16px;">📋 Case Information</h2>
    <table style="width: 100%; border-collapse: collapse;">
      <tr><td style="padding: 6px 0; color: #71717a; width: 140px;">Case ID</td><td style="color: #e5e5e5; font-family: monospace; font-size: 13px;">${caseData.id}</td></tr>
      <tr><td style="padding: 6px 0; color: #71717a;">Case Title</td><td style="color: #e5e5e5; font-weight: 600;">${caseData.title}</td></tr>
      <tr><td style="padding: 6px 0; color: #71717a;">Status</td><td style="color: #ef4444; font-weight: 600;">${(caseData.status || 'escalated').toUpperCase()}</td></tr>
      <tr><td style="padding: 6px 0; color: #71717a;">Created</td><td style="color: #e5e5e5;">${caseData.created_at}</td></tr>
      <tr><td style="padding: 6px 0; color: #71717a;">Released</td><td style="color: #e5e5e5;">${new Date().toISOString()}</td></tr>
    </table>
  </div>

  <!-- Evidence Table -->
  <div style="background: #18181b; border: 1px solid #27272a; border-radius: 12px; padding: 24px; margin-bottom: 24px;">
    <h2 style="color: #e5e5e5; font-size: 16px; margin: 0 0 16px;">📁 Evidence Inventory</h2>
    ${evidence.length ? `
    <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
      <thead><tr style="border-bottom: 2px solid #333;">
        <th style="padding: 8px; color: #71717a; text-align: left;">#</th>
        <th style="padding: 8px; color: #71717a; text-align: left;">File</th>
        <th style="padding: 8px; color: #71717a; text-align: left;">SHA-256</th>
        <th style="padding: 8px; color: #71717a; text-align: left;">Size</th>
        <th style="padding: 8px; color: #71717a; text-align: left;">Integrity</th>
      </tr></thead>
      <tbody>${evidenceRows}</tbody>
    </table>` : '<p style="color: #71717a;">No evidence files attached to this case.</p>'}
  </div>

  <!-- Integrity Statement -->
  <div style="background: rgba(16,185,129,0.05); border: 1px solid rgba(16,185,129,0.15); border-radius: 12px; padding: 20px; margin-bottom: 24px;">
    <p style="color: #10b981; font-weight: 600; margin: 0 0 8px;">🔒 Evidence Integrity Statement</p>
    <p style="color: #a7f3d0; font-size: 13px; margin: 0;">All evidence files were cryptographically hashed using SHA-256 at the time of upload. These hashes can be independently verified to confirm that no modification, corruption, or tampering has occurred since original preservation.</p>
  </div>

  <!-- Chain of Custody -->
  ${logs.length ? `
  <div style="background: #18181b; border: 1px solid #27272a; border-radius: 12px; padding: 24px; margin-bottom: 24px;">
    <h2 style="color: #e5e5e5; font-size: 16px; margin: 0 0 16px;">🔗 Chain of Custody (Latest)</h2>
    <table style="width: 100%; border-collapse: collapse; font-size: 12px;">
      <tbody>${custodyEntries}</tbody>
    </table>
  </div>` : ''}

  <!-- Access Link -->
  <div style="text-align: center; margin-bottom: 24px;">
    <a href="${accessLink}" style="display: inline-block; background: #10b981; color: #0a0a0a; font-weight: 700; padding: 14px 32px; border-radius: 10px; text-decoration: none; font-size: 14px;">Access Investigation Report</a>
    <p style="color: #71717a; font-size: 12px; margin-top: 12px;">This link contains a secure access token valid for 24 hours.</p>
  </div>

  <!-- Footer -->
  <div style="border-top: 1px solid #27272a; padding-top: 20px; text-align: center;">
    <p style="color: #52525b; font-size: 11px; margin: 0;">This is an automated message from Evidence Vault.<br>Secure Digital Evidence Preservation Platform</p>
    <p style="color: #3f3f46; font-size: 10px; margin-top: 8px;">© 2026 Evidence Vault • Generated ${new Date().toISOString()}</p>
  </div>

</div>
</body>
</html>`;
}

// Helper: Build plain-text fallback
function buildEmergencyEmailText(caseData: any, evidence: any[], logs: any[], accessLink: string, customMessage: string): string {
  const lines = [
    '══════════════════════════════════════════',
    '  🚨 EMERGENCY EVIDENCE RELEASE',
    '  Dead-Man Switch Activated',
    '══════════════════════════════════════════',
    '',
    customMessage ? `Investigator Message: ${customMessage}\n` : '',
    `Case ID:     ${caseData.id}`,
    `Title:       ${caseData.title}`,
    `Status:      ESCALATED`,
    `Created:     ${caseData.created_at}`,
    `Released:    ${new Date().toISOString()}`,
    '',
    '── Evidence Files ──',
  ];
  evidence.forEach((ev: any, i: number) => {
    lines.push(`  ${i + 1}. ${ev.file_name}`);
    lines.push(`     SHA-256: ${ev.client_sha256 || 'N/A'}`);
    lines.push(`     Size: ${ev.file_size || 'N/A'} bytes`);
    lines.push(`     Integrity: ${ev.client_sha256 === ev.server_sha256 ? 'VERIFIED' : 'PENDING'}`);
  });
  lines.push('', '── Chain of Custody ──');
  logs.slice(0, 10).forEach((log: any) => {
    lines.push(`  [${log.timestamp}] ${log.action}: ${log.details || ''}`);
  });
  lines.push('', `Access Report: ${accessLink}`, '', '──────────────────────────────────────────', '  Evidence Vault • Secure Preservation');
  return lines.join('\n');
}

// Helper: Generate forensic report text for attachment
function generateForensicReportAttachment(caseData: any, evidence: any[], logs: any[]): string {
  const lines = [
    '═'.repeat(60),
    '  FORENSIC INVESTIGATION REPORT',
    '  Evidence Vault — Emergency Release',
    '═'.repeat(60),
    '',
    `Case ID:        ${caseData.id}`,
    `Case Title:     ${caseData.title}`,
    `Status:         ESCALATED (Dead-Man Switch)`,
    `Created:        ${caseData.created_at}`,
    `Released:       ${new Date().toISOString()}`,
    `System:         Evidence Vault v1.0.0`,
    '',
    '─'.repeat(60),
    '  EVIDENCE INVENTORY',
    '─'.repeat(60),
    '',
  ];
  evidence.forEach((ev: any, i: number) => {
    lines.push(`  [Evidence #${i + 1}]`);
    lines.push(`    File:    ${ev.file_name}`);
    lines.push(`    Type:    ${ev.file_type || 'unknown'}`);
    lines.push(`    Size:    ${ev.file_size || 0} bytes`);
    lines.push(`    Client:  ${ev.client_sha256 || 'N/A'}`);
    lines.push(`    Server:  ${ev.server_sha256 || 'N/A'}`);
    lines.push(`    Match:   ${ev.client_sha256 === ev.server_sha256 ? 'VERIFIED ✓' : 'PENDING'}`);
    lines.push('');
  });
  lines.push('─'.repeat(60), '  CHAIN OF CUSTODY', '─'.repeat(60), '');
  logs.forEach((log: any, i: number) => {
    lines.push(`  [${i + 1}] ${(log.action || '').toUpperCase()}`);
    lines.push(`      Time:    ${log.timestamp}`);
    lines.push(`      User:    ${log.user_id}`);
    lines.push(`      Details: ${log.details || 'N/A'}`);
    lines.push('');
  });
  lines.push('─'.repeat(60), '  INTEGRITY STATEMENT', '─'.repeat(60), '');
  lines.push('  SHA-256 cryptographic hashes were computed for all evidence');
  lines.push('  files. All timestamps are in UTC. Original hash values are');
  lines.push('  immutable and cannot be overwritten.', '');
  lines.push('═'.repeat(60));
  lines.push(`  Generated: ${new Date().toISOString()}`);
  lines.push('═'.repeat(60));
  return lines.join('\n');
}

// Helper: Detect if real SMTP is configured
function isRealSmtpConfigured(): boolean {
  return !!(process.env.SMTP_USER && process.env.SMTP_PASS &&
    process.env.SMTP_USER !== 'your-email@gmail.com' &&
    process.env.SMTP_PASS !== 'your-gmail-app-password');
}

// Helper: Create transporter — real SMTP if configured, otherwise Ethereal demo
async function createSmartTransporter(): Promise<{ transporter: any; from: string; isDemoMode: boolean }> {
  if (isRealSmtpConfigured()) {
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: Number(process.env.SMTP_PORT) || 465,
      secure: process.env.SMTP_SECURE !== 'false',
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
    });
    return { transporter, from: process.env.SMTP_FROM || process.env.SMTP_USER!, isDemoMode: false };
  }

  // Demo mode: auto-create free Ethereal test account (no signup needed)
  const testAccount = await nodemailer.createTestAccount();
  const transporter = nodemailer.createTransport({
    host: 'smtp.ethereal.email',
    port: 587,
    secure: false,
    auth: { user: testAccount.user, pass: testAccount.pass }
  });
  console.log('[Email Demo] Using Ethereal test account:', testAccount.user);
  return { transporter, from: testAccount.user, isDemoMode: true };
}

// Test email endpoint
app.post('/api/emergency-release/test', express.json(), async (req, res) => {
  try {
    const user = db.prepare('SELECT trusted_contacts FROM users WHERE id = ?').get(mockUserId) as any;
    let trusted: any[] = [];
    try { trusted = JSON.parse(user.trusted_contacts || '[]'); } catch { trusted = []; }

    // Fallback: accept contacts from request body (e.g. UI contacts not yet saved to DB)
    const { trustedContacts: bodyContacts, toEmail } = req.body || {};
    if (trusted.length === 0 && bodyContacts && Array.isArray(bodyContacts)) {
      trusted = bodyContacts;
    }
    if (toEmail) {
      trusted = [{ email: toEmail }, ...trusted];
    }

    const emails = trusted.map((t: any) => t.email).filter(Boolean);

    // In demo/Ethereal mode, use a fallback test email if none provided
    const recipientList = emails.length > 0 ? emails : ['demo@evidencevault.test'];

    const baseUrl = process.env.BASE_URL || 'http://localhost:3000';
    const { transporter, from, isDemoMode } = await createSmartTransporter();

    const info = await transporter.sendMail({
      from,
      to: recipientList.join(','),
      subject: '✅ Evidence Vault — Test Email (Dead-Man Switch)',
      html: `
        <div style="max-width: 500px; margin: 0 auto; padding: 32px; font-family: sans-serif; background: #0a0a0a; color: #e5e5e5;">
          <h2 style="color: #10b981;">✅ Test Email Successful</h2>
          ${isDemoMode ? '<p style="background:#1a3a00;padding:10px;border-radius:6px;color:#86efac;font-size:13px;">📧 <strong>Demo Mode:</strong> This email was sent via Ethereal (preview only). Click the preview link to see it.</p>' : ''}
          <p>This is a test email from <strong>Evidence Vault</strong>.</p>
          <p>If the Dead-Man Switch triggers, you will receive a detailed forensic report with evidence metadata, SHA-256 hashes, and an access link.</p>
          <hr style="border-color: #333;" />
          <p style="color: #888; font-size: 12px;">Sent from: ${baseUrl} &bull; ${new Date().toISOString()}</p>
        </div>`,
      text: 'Test email from Evidence Vault Dead-Man Switch. You will receive a full forensic report if triggered.'
    });

    // Get preview URL (only available with Ethereal)
    const previewUrl = isDemoMode ? nodemailer.getTestMessageUrl(info) : null;
    if (previewUrl) {
      console.log('[Email Demo] Preview URL:', previewUrl);
    }

    logAudit(null, mockUserId, 'test_email_sent', `Test email sent to: ${recipientList.join(', ')} (demo: ${isDemoMode})`);
    res.json({ success: true, sentTo: recipientList, isDemoMode, previewUrl });
  } catch (err: any) {
    console.error('[Test Email] Error:', err);
    res.status(500).json({ error: err.message || 'Failed to send test email' });
  }
});

// Local compatibility endpoint for Functions-style registration
// Allows the frontend to call `${FUNCTIONS_BASE}/startUpload` when functions emulator or deployed functions are not used.
app.post('/functions/startUpload', express.json(), (req, res) => {
  const { caseId, fileName, fileSize, mimeType, clientSha256, deviceInfo } = req.body || {};
  if (!fileName) return res.status(400).json({ error: 'Missing parameters: fileName is required' });

  const id = crypto.randomUUID();
  // Insert minimal evidence record (will be updated when actual file uploaded)
  // caseId may be null (evidence uploaded but not yet linked to a case)
  db.prepare(`INSERT INTO evidence (id, case_id, user_id, file_name, file_type, file_size, client_sha256, upload_timestamp, file_path) VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'), ?)`)
    .run(id, caseId || null, mockUserId, fileName, mimeType || 'application/octet-stream', fileSize || 0, clientSha256 || '', null);

  logAudit(caseId || null, mockUserId, 'START_UPLOAD', `Registered evidence ${fileName} (${id}) for upload`);

  res.json({ evidenceId: id });
});

// Link an existing evidence record to a case (used after user selects case)
app.post('/api/evidence/:id/link', express.json(), async (req, res) => {
  const evidenceId = req.params.id;
  const { caseId } = req.body || {};
  if (!evidenceId || !caseId) return res.status(400).json({ error: 'Missing evidenceId or caseId' });

  // Mock auth
  const currentUser = db.prepare('SELECT * FROM users WHERE id = ?').get(mockUserId) as any;
  if (!currentUser) return res.status(401).json({ error: 'Not authenticated' });

  const ev = db.prepare('SELECT * FROM evidence WHERE id = ?').get(evidenceId) as any;
  if (!ev) return res.status(404).json({ error: 'Evidence not found' });

  const caseRow = db.prepare('SELECT * FROM cases WHERE id = ?').get(caseId) as any;
  if (!caseRow) return res.status(404).json({ error: 'Case not found' });

  // Only allow linking by owner or admin
  if (ev.user_id !== currentUser.id && currentUser.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });

  try {
    db.prepare('UPDATE evidence SET case_id = ? WHERE id = ?').run(caseId, evidenceId);
    logAudit(caseId, currentUser.id, 'EVIDENCE_LINKED', `Evidence ${evidenceId} linked to case ${caseId}`);
    res.json({ success: true });
  } catch (e: any) {
    console.error('Failed linking evidence', e);
    res.status(500).json({ error: String(e) });
  }
});

// NEW: Preserve endpoint (STEP 2: called after user confirms via dialog)
// This endpoint saves evidence and records audit log for preservation
app.post('/api/preserve', express.json(), async (req, res) => {
  const { evidenceId, caseId, serverHash } = req.body || {};

  if (!evidenceId || !caseId || !serverHash) {
    return res.status(400).json({ error: 'Missing evidenceId, caseId, or serverHash' });
  }

  try {
    // Mock auth
    const currentUser = db.prepare('SELECT * FROM users WHERE id = ?').get(mockUserId) as any;
    if (!currentUser) return res.status(401).json({ error: 'Not authenticated' });

    // Verify evidence exists
    const ev = db.prepare('SELECT * FROM evidence WHERE id = ?').get(evidenceId) as any;
    if (!ev) return res.status(404).json({ error: 'Evidence not found' });

    // Verify case exists
    const caseRow = db.prepare('SELECT * FROM cases WHERE id = ?').get(caseId) as any;
    if (!caseRow) return res.status(404).json({ error: 'Case not found' });

    // Only allow by owner or admin
    if (ev.user_id !== currentUser.id && currentUser.role !== 'admin') {
      return res.status(403).json({ error: 'Forbidden' });
    }

    // Ensure evidence is linked to the right case
    db.prepare('UPDATE evidence SET case_id = ?, server_sha256 = ? WHERE id = ?').run(caseId, serverHash, evidenceId);

    // Log the preservation event with full audit trail
    const auditDetails = JSON.stringify({
      evidenceId,
      fileName: ev.file_name,
      fileSize: ev.file_size,
      clientHash: ev.client_sha256,
      serverHash: serverHash,
      preservedAt: new Date().toISOString()
    });

    logAudit(caseId, currentUser.id, 'evidence_preserved', auditDetails);

    console.log(`Evidence ${evidenceId} preserved to case ${caseId}`);
    res.json({ success: true, evidenceId, caseId });
  } catch (err: any) {
    console.error('Preserve endpoint error:', err);
    res.status(500).json({ error: err.message || 'Failed to preserve evidence' });
  }
});

// 3a. Manual verification logging endpoint (records verification attempts without storing file)
app.post('/api/cases/:id/verify', (req, res) => {
  const caseId = req.params.id;
  const { fileName, computedHash, userId, result } = req.body;
  if (!fileName || !computedHash || !userId || !result) {
    return res.status(400).json({ error: 'Missing parameters' });
  }

  const id = crypto.randomUUID();
  const details = JSON.stringify({ fileName, computedHash, result });
  db.prepare('INSERT INTO audit_logs (id, case_id, user_id, action, details) VALUES (?, ?, ?, ?, ?)').run(id, caseId, userId, 'MANUAL_VERIFICATION', details);

  res.json({ success: true, id });
});

// 4. Dead-Man Switch
app.post('/api/deadman/checkin', (req, res) => {
  const user = db.prepare('SELECT dead_man_interval_hours FROM users WHERE id = ?').get(mockUserId) as any;
  const now = new Date();
  const nowIso = now.toISOString();
  const nextCheckin = new Date(now);
  nextCheckin.setHours(nextCheckin.getHours() + (user.dead_man_interval_hours || 24));

  // Persist ISO timestamps so frontend can reliably parse and show last_checkin
  db.prepare('UPDATE users SET last_checkin = ?, next_checkin = ?, status = \'active\', reminder_sent = 0 WHERE id = ?').run(nowIso, nextCheckin.toISOString(), mockUserId);

  res.json({ success: true, last_checkin: nowIso, next_checkin: nextCheckin.toISOString() });
});

// 5. Export / Release
app.get('/api/cases/:id/export', (req, res) => {
  const caseId = req.params.id;
  const caseData = db.prepare('SELECT * FROM cases WHERE id = ?').get(caseId) as any;
  const evidence = db.prepare('SELECT * FROM evidence WHERE case_id = ?').all(caseId) as any[];
  const logs = db.prepare('SELECT * FROM audit_logs WHERE case_id = ? ORDER BY timestamp DESC').all(caseId) as any[];

  logAudit(caseId, mockUserId, 'CASE_EXPORTED', 'Case exported as ZIP archive');

  res.attachment(`evidence_vault_case_${caseId}.zip`);
  const archive = archiver('zip', { zlib: { level: 9 } });
  archive.pipe(res);

  // Add Metadata
  archive.append(JSON.stringify(caseData, null, 2), { name: 'metadata.json' });
  archive.append(JSON.stringify(logs, null, 2), { name: 'audit_logs.json' });

  // Add Evidence Files & SHA256SUMS
  let sha256sums = '';
  evidence.forEach(ev => {
    if (fs.existsSync(ev.file_path)) {
      archive.file(ev.file_path, { name: `evidence/${ev.file_name}` });
      sha256sums += `${ev.server_sha256}  evidence/${ev.file_name}\n`;
    }
  });
  archive.append(sha256sums, { name: 'SHA256SUMS.txt' });

  // Add Legal Report
  const report = `# Legal Evidence Report
Case ID: ${caseId}
Title: ${caseData.title}
Date: ${new Date().toISOString()}

## Risk Assessment
Score: ${caseData.risk_score}/10
Analysis: ${caseData.risk_analysis}

## Chain of Custody
${logs.map(l => `- [${l.timestamp}] ${l.action}: ${l.details}`).join('\n')}

## Legal Disclaimer
This report preserves cryptographic integrity but does not replace certified forensic investigation.
`;
  archive.append(report, { name: 'LEGAL_REPORT.md' });

  archive.finalize();
});

// Serve packaged report by token (time-limited)
app.get('/download/report/:token', (req, res) => {
  const token = req.params.token;
  const row = db.prepare('SELECT * FROM tokens WHERE token = ?').get(token) as any;
  if (!row) return res.status(404).send('Not found');
  const now = new Date();
  if (new Date(row.expires_at) < now) return res.status(410).send('Link expired');

  // Require requester to supply their email to verify allowed list
  const requesterEmail = (req.query.email as string) || '';
  let allowed: string[] = [];
  try { allowed = JSON.parse(row.allowed_emails || '[]'); } catch (e) { allowed = []; }
  if (!requesterEmail || !allowed.includes(requesterEmail)) return res.status(403).send('Forbidden');

  // Stream file
  if (!fs.existsSync(row.file_path)) return res.status(404).send('File missing');
  res.setHeader('Content-Disposition', `attachment; filename="evidence_report_${row.case_id}.zip"`);
  const stream = fs.createReadStream(row.file_path);
  stream.pipe(res);
  // Log access
  logAudit(row.case_id, requesterEmail, 'report_downloaded', `Trusted contact ${requesterEmail} downloaded report token ${token}`);
});

// Dead-Man Timer Cron (Simulated)
setInterval(() => {
  // Check for reminders and expirations per user
  const users = db.prepare('SELECT id, email, next_checkin, reminder_minutes_before, reminder_sent, trusted_contacts FROM users WHERE status = \'active\'').all() as any[];
  const now = new Date();
  users.forEach(u => {
    if (!u.next_checkin) return;
    const next = new Date(u.next_checkin);
    const reminderBefore = u.reminder_minutes_before || 60;
    const reminderTime = new Date(next.getTime() - reminderBefore * 60000);

    // Send reminder if within window and not sent
    if (reminderTime <= now && now < next && (!u.reminder_sent || u.reminder_sent === 0)) {
      console.log(`Sending reminder to user ${u.id} before deadman expiration.`);
      // Log reminder
      db.prepare('INSERT INTO audit_logs (id, case_id, user_id, action, details) VALUES (?, ?, ?, ?, ?)').run(crypto.randomUUID(), null, u.id, 'DEADMAN_REMINDER', `Reminder sent before ${u.next_checkin}`);
      // mark reminder sent
      db.prepare('UPDATE users SET reminder_sent = 1 WHERE id = ?').run(u.id);
      // TODO: send email/SMS reminder to user (if contact info available)
    }

    // If expired
    if (next <= now) {
      console.log(`User ${u.id} missed check-in. Escalating cases...`);
      db.prepare('UPDATE users SET status = \'danger\' WHERE id = ?').run(u.id);

      // Check if emergency release already sent to prevent duplicates
      const userCheck = db.prepare('SELECT emergency_release_enabled, emergency_release_sent FROM users WHERE id = ?').get(u.id) as any;
      if (userCheck && userCheck.emergency_release_sent) {
        console.log(`User ${u.id}: Emergency release already sent, skipping duplicate.`);
        return;
      }

      const userCases = db.prepare('SELECT * FROM cases WHERE user_id = ? AND status = \'open\'').all(u.id) as any[];
      userCases.forEach(c => {
        db.prepare('UPDATE cases SET status = \'escalated\' WHERE id = ?').run(c.id);
        logAudit(c.id, 'SYSTEM', 'AUTO_ESCALATION', 'Dead-Man switch triggered. Case escalated and released to authorities.');

        try {
          // Generate export ZIP and create token
          const exportPath = path.join(uploadsDir, `evidence_vault_case_${c.id}_${Date.now()}.zip`);
          const output = fs.createWriteStream(exportPath);
          const archive = archiver('zip', { zlib: { level: 9 } });
          archive.pipe(output);
          archive.append(JSON.stringify(c, null, 2), { name: 'metadata.json' });
          const caseLogs = db.prepare('SELECT * FROM audit_logs WHERE case_id = ? ORDER BY timestamp DESC').all(c.id) as any[];
          archive.append(JSON.stringify(caseLogs, null, 2), { name: 'audit_logs.json' });
          const evidence = db.prepare('SELECT * FROM evidence WHERE case_id = ?').all(c.id) as any[];

          // Generate forensic report attachment
          const forensicReport = generateForensicReportAttachment(c, evidence, caseLogs);
          archive.append(forensicReport, { name: 'forensic_report.txt' });

          // Generate case metadata JSON
          const caseMetadata = JSON.stringify({
            case_id: c.id,
            case_title: c.title,
            case_status: 'ESCALATED',
            created_at: c.created_at,
            released_at: new Date().toISOString(),
            evidence_count: evidence.length,
            evidence: evidence.map((ev: any) => ({
              file_name: ev.file_name,
              file_type: ev.file_type,
              file_size: ev.file_size,
              client_sha256: ev.client_sha256,
              server_sha256: ev.server_sha256,
              integrity_verified: ev.client_sha256 === ev.server_sha256
            })),
            audit_trail: caseLogs.map((l: any) => ({ action: l.action, timestamp: l.timestamp, details: l.details })),
            integrity_verified: evidence.every((ev: any) => ev.client_sha256 && ev.client_sha256 === ev.server_sha256),
            system: 'Evidence Vault v1.0.0'
          }, null, 2);
          archive.append(caseMetadata, { name: 'case_metadata.json' });

          let sha256sums = '';
          evidence.forEach(ev => {
            if (ev.file_path && fs.existsSync(ev.file_path)) {
              archive.file(ev.file_path, { name: `evidence/${ev.file_name}` });
              sha256sums += `${ev.server_sha256}  evidence/${ev.file_name}\n`;
            }
          });
          archive.append(sha256sums || 'No evidence files with disk storage.', { name: 'SHA256SUMS.txt' });
          archive.finalize();

          // when archive is finalized, create token and send professional email
          output.on('close', async () => {
            const token = crypto.randomBytes(24).toString('hex');
            const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24); // 24h
            let trusted: any[] = [];
            try { trusted = JSON.parse(u.trusted_contacts || '[]'); } catch { trusted = []; }
            const emails = trusted.map((t: any) => t.email).filter(Boolean);
            db.prepare('INSERT INTO tokens (token, case_id, expires_at, allowed_emails, file_path) VALUES (?, ?, ?, ?, ?)').run(token, c.id, expiresAt.toISOString(), JSON.stringify(emails), exportPath);

            logAudit(c.id, 'SYSTEM', 'report_generated', `Report generated at ${exportPath}`);

            // Send professional email if emergency release enabled (works in demo mode too)
            const isEmergencyEnabled = userCheck && userCheck.emergency_release_enabled;

            if (isEmergencyEnabled && emails.length > 0) {
              try {
                const { transporter, from, isDemoMode } = await createSmartTransporter();
                const baseUrl = process.env.BASE_URL || `http://localhost:${PORT}`;
                const accessLink = `${baseUrl}/download/report/${token}?email=${encodeURIComponent(emails[0])}`;
                const customMsg = (db.prepare('SELECT emergency_custom_message FROM users WHERE id = ?').get(u.id) as any)?.emergency_custom_message || '';

                const htmlBody = buildEmergencyEmailHTML(c, evidence, caseLogs, accessLink, customMsg);
                const textBody = buildEmergencyEmailText(c, evidence, caseLogs, accessLink, customMsg);

                const attachments: any[] = [
                  { filename: `forensic_report_${c.id}.txt`, content: forensicReport },
                  { filename: `case_metadata_${c.id}.json`, content: caseMetadata },
                ];

                const info = await transporter.sendMail({
                  from,
                  to: emails.join(','),
                  subject: `🚨 Emergency Evidence Release – Case #${c.id}`,
                  html: htmlBody,
                  text: textBody,
                  attachments
                });

                // In demo mode, log Ethereal preview URL to console
                if (isDemoMode) {
                  const previewUrl = nodemailer.getTestMessageUrl(info);
                  console.log(`[Emergency Release Demo] Preview URL: ${previewUrl}`);
                  logAudit(c.id, 'SYSTEM', 'emergency_email_sent', `Demo email preview: ${previewUrl}`);
                } else {
                  logAudit(c.id, 'SYSTEM', 'emergency_email_sent', `Emergency email sent to: ${emails.join(', ')}`);
                }

                // Mark as sent to prevent duplicates
                db.prepare('UPDATE users SET emergency_release_sent = 1, last_emergency_release = ? WHERE id = ?').run(new Date().toISOString(), u.id);
                console.log(`[Emergency Release] ✓ Email sent for case ${c.id} to ${emails.join(', ')} (demo: ${isDemoMode})`);
              } catch (emailErr: any) {
                console.error('[Emergency Release] Email failed:', emailErr);
                logAudit(c.id, 'SYSTEM', 'emergency_email_failed', `Email error: ${emailErr.message || emailErr}`);
              }
            } else {
              const reason = !isEmergencyEnabled ? 'Emergency release not enabled' : 'No trusted contacts';
              console.log(`[Emergency Release] Skipped for case ${c.id}: ${reason}`);
              logAudit(c.id, 'SYSTEM', 'emergency_email_skipped', `Skipped: ${reason}. Trusted: ${emails.join(',')}`);
            }
          });
        } catch (packErr) {
          console.error('Failed to package report', packErr);
          logAudit(c.id, 'SYSTEM', 'report_failed', `Packaging error: ${String(packErr)}`);
        }
      });
    }
  });
}, 60000); // Check every minute for demo

// ─── Social Monitor: DMS Fire Endpoint ───────────────────────────────────────
app.post('/api/social-monitor/dms-fire', express.json(), async (req, res) => {
  const { scanId, contactName, platform, riskLevel } = req.body || {};
  try {
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(mockUserId) as any;
    let trusted: any[] = [];
    try { trusted = JSON.parse(user?.trusted_contacts || '[]'); } catch { trusted = []; }
    const emails = trusted.map((c: any) => c.email).filter(Boolean);

    const { transporter, from, isDemoMode } = await (async () => {
      // reuse smart transporter logic inline
      const realSmtp = !!(process.env.SMTP_USER && process.env.SMTP_PASS &&
        process.env.SMTP_USER !== 'your-email@gmail.com' &&
        process.env.SMTP_PASS !== 'your-gmail-app-password');
      if (realSmtp) {
        const t = nodemailer.createTransport({ host: process.env.SMTP_HOST || 'smtp.gmail.com', port: Number(process.env.SMTP_PORT) || 465, secure: true, auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } });
        return { transporter: t, from: process.env.SMTP_USER!, isDemoMode: false };
      }
      const testAccount = await nodemailer.createTestAccount();
      const t = nodemailer.createTransport({ host: 'smtp.ethereal.email', port: 587, secure: false, auth: { user: testAccount.user, pass: testAccount.pass } });
      return { transporter: t, from: testAccount.user, isDemoMode: true };
    })();

    const to = emails.length > 0 ? emails : [from];
    const info = await transporter.sendMail({
      from: `"Evidence Vault" <${from}>`,
      to: to.join(', '),
      subject: `🚨 EMERGENCY: High-Risk Social Media Threat Detected (Risk ${riskLevel}/10)`,
      html: `
        <div style="background:#0a0a0a;color:#e5e5e5;font-family:sans-serif;max-width:600px;margin:0 auto;padding:32px;">
          <div style="background:rgba(239,68,68,0.1);border:1px solid rgba(239,68,68,0.3);border-radius:12px;padding:24px;margin-bottom:24px;">
            <h1 style="color:#ef4444;margin:0 0 8px;">🚨 Dead Man's Switch Activated</h1>
            <p style="color:#fca5a5;margin:0;">Social Media Monitoring detected a critical threat and the user did not respond in time.</p>
          </div>
          <table style="width:100%;border-collapse:collapse;background:#18181b;border-radius:12px;overflow:hidden;">
            <tr><td style="padding:12px 16px;color:#71717a;width:140px;">Platform</td><td style="padding:12px 16px;color:#e5e5e5;font-weight:600;">${platform}</td></tr>
            <tr><td style="padding:12px 16px;color:#71717a;">Contact</td><td style="padding:12px 16px;color:#e5e5e5;">${contactName}</td></tr>
            <tr><td style="padding:12px 16px;color:#71717a;">Risk Level</td><td style="padding:12px 16px;color:#ef4444;font-weight:700;">${riskLevel}/10 — CRITICAL</td></tr>
            <tr><td style="padding:12px 16px;color:#71717a;">Triggered</td><td style="padding:12px 16px;color:#e5e5e5;">${new Date().toISOString()}</td></tr>
          </table>
          <p style="color:#71717a;font-size:12px;margin-top:24px;">This automated message was sent by Evidence Vault's Dead Man's Switch safety system.</p>
        </div>`,
    });

    let previewUrl: string | false = false;
    if (isDemoMode) previewUrl = nodemailer.getTestMessageUrl(info);
    logAudit(null, mockUserId, 'emergency_release', `Social Monitor DMS fired: ${platform}/${contactName} risk=${riskLevel}. Preview: ${previewUrl || 'N/A'}`);
    res.json({ success: true, isDemoMode, previewUrl });
  } catch (e: any) {
    console.error('[Social Monitor DMS]', e);
    res.status(500).json({ error: e.message });
  }
});

//Vite middleware for development
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(process.cwd(), 'dist')));
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
