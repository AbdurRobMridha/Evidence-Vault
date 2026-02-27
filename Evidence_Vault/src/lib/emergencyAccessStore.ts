// ═══════════════════════════════════════════════════════════════════════════════
// Evidence Vault — Emergency Access Token Store
// One-time links sent to trusted contacts via emergency email.
// ═══════════════════════════════════════════════════════════════════════════════

const ACCESS_KEY = 'ev_emergency_access_tokens';

export interface EmergencyAccessToken {
    token: string;          // e.g. "EAT-xxxxxxxxxxxxxxxx"
    caseId: string;
    platform: string;
    contactName: string;
    riskLevel: number;
    createdAt: string;
    expiresAt: string;      // 72 hours
    used: boolean;
    usedAt?: string;
    createdByEmail: string;
}

// ─── Generate ─────────────────────────────────────────────────────────────────

function makeToken(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let t = 'EAT-';
    for (let i = 0; i < 40; i++) t += chars[Math.floor(Math.random() * chars.length)];
    return t;
}

function getAll(): EmergencyAccessToken[] {
    try { return JSON.parse(localStorage.getItem(ACCESS_KEY) || '[]'); } catch { return []; }
}

function saveAll(tokens: EmergencyAccessToken[]): void {
    localStorage.setItem(ACCESS_KEY, JSON.stringify(tokens));
}

// ─── Create ───────────────────────────────────────────────────────────────────

export function createEmergencyAccessToken(
    caseId: string,
    platform: string,
    contactName: string,
    riskLevel: number,
    createdByEmail: string,
): EmergencyAccessToken {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 72 * 60 * 60 * 1000); // 72 h

    const entry: EmergencyAccessToken = {
        token: makeToken(),
        caseId, platform, contactName, riskLevel, createdByEmail,
        createdAt: now.toISOString(),
        expiresAt: expiresAt.toISOString(),
        used: false,
    };

    const all = getAll();
    all.unshift(entry);
    // Keep max 100 tokens
    if (all.length > 100) all.length = 100;
    saveAll(all);
    return entry;
}

// ─── Validate & Consume ───────────────────────────────────────────────────────

export type AccessValidationResult =
    | { valid: true; token: EmergencyAccessToken }
    | { valid: false; reason: 'not_found' | 'expired' | 'already_used' };

export function validateAccessToken(token: string): AccessValidationResult {
    const all = getAll();
    const entry = all.find(t => t.token === token);
    if (!entry) return { valid: false, reason: 'not_found' };
    if (entry.used) return { valid: false, reason: 'already_used' };
    if (new Date() > new Date(entry.expiresAt)) return { valid: false, reason: 'expired' };
    return { valid: true, token: entry };
}

/** Mark the token as used (idempotent). Returns false if already used. */
export function consumeAccessToken(token: string): boolean {
    const all = getAll();
    const entry = all.find(t => t.token === token);
    if (!entry || entry.used) return false;
    entry.used = true;
    entry.usedAt = new Date().toISOString();
    saveAll(all);
    return true;
}

export function getAllAccessTokens(): EmergencyAccessToken[] {
    return getAll();
}
