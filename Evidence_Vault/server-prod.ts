import express from 'express';
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
const PORT = process.env.PORT || 3000;

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
    status TEXT DEFAULT 'pending',
    risk_score INTEGER,
    risk_analysis TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS evidence (
    id TEXT PRIMARY KEY,
    case_id TEXT,
    file_name TEXT,
    file_size INTEGER,
    file_type TEXT,
    file_path TEXT,
    uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(case_id) REFERENCES cases(id)
  );
`);

// Serve static files from dist directory
app.use(express.static(path.join(process.cwd(), 'dist')));

// Mock user ID for testing
const mockUserId = 'test-user-123';

// Helper: Call GenAI with retry logic
async function callGenAIWithRetries(prompt: string, maxAttempts: number, timeoutMs: number) {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const api_key = process.env.GEMINI_API_KEY;
      if (!api_key) {
        throw new Error('GEMINI_API_KEY not configured');
      }

      const ai = new GoogleGenAI({ apiKey: api_key });
      
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('timeout')), timeoutMs)
      );

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

// Helper: Analyze case with AI or fallback
async function analyzeCase(title: string, description: string, fileName?: string, fileSize?: number, fileType?: string) {
  let risk_score = 0;
  let risk_analysis = '{}';

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

// API Routes
app.get('/api/cases', (req, res) => {
  try {
    const cases = db.prepare('SELECT * FROM cases WHERE user_id = ? ORDER BY created_at DESC').all(mockUserId);
    res.json(cases);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch cases' });
  }
});

app.post('/api/cases', async (req, res) => {
  try {
    const { title, description } = req.body;
    const caseId = crypto.randomUUID();
    
    const { risk_score, risk_analysis } = await analyzeCase(title, description);
    
    db.prepare(`
      INSERT INTO cases (id, user_id, title, description, risk_score, risk_analysis, status)
      VALUES (?, ?, ?, ?, ?, ?, 'pending')
    `).run(caseId, mockUserId, title, description, risk_score, risk_analysis);

    res.json({ id: caseId, title, description, risk_score, risk_analysis });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to create case' });
  }
});

app.post('/api/cases/:caseId/upload', upload.single('file'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const { caseId } = req.params;
    const evidenceId = crypto.randomUUID();

    db.prepare(`
      INSERT INTO evidence (id, case_id, file_name, file_size, file_type, file_path)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      evidenceId,
      caseId,
      req.file.originalname,
      req.file.size,
      req.file.mimetype,
      req.file.path
    );

    res.json({ 
      id: evidenceId,
      fileName: req.file.originalname,
      fileSize: req.file.size,
      uploadedAt: new Date().toISOString()
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Upload failed' });
  }
});

app.get('/api/cases/:caseId/download', (req, res) => {
  try {
    const { caseId } = req.params;
    const evidence = db.prepare('SELECT file_path FROM evidence WHERE case_id = ?').all(caseId) as any[];

    if (evidence.length === 0) {
      return res.status(404).json({ error: 'No evidence found' });
    }

    const fileName = `evidence_vault_case_${caseId}_${Date.now()}.zip`;
    const archiveStream = archiver('zip', { zlib: { level: 9 } });

    res.attachment(fileName);
    archiveStream.pipe(res);

    evidence.forEach((e: any) => {
      if (fs.existsSync(e.file_path)) {
        archiveStream.file(e.file_path, { name: path.basename(e.file_path) });
      }
    });

    archiveStream.finalize();
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Download failed' });
  }
});

// Serve index.html for all routes (SPA)
app.get('*', (req, res) => {
  res.sendFile(path.join(process.cwd(), 'dist', 'index.html'));
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Evidence Vault server running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});
