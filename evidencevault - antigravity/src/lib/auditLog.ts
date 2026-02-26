// ═══════════════════════════════════════════════
// Evidence Vault — Audit Logging System
// ═══════════════════════════════════════════════

export type AuditAction =
    | 'case_created'
    | 'case_updated'
    | 'status_changed'
    | 'priority_changed'
    | 'evidence_uploaded'
    | 'evidence_verified'
    | 'report_generated'
    | 'case_exported'
    | 'case_locked'
    | 'case_unlocked'
    | 'case_archived'
    | 'case_deleted'
    | 'investigator_assigned'
    | 'investigator_removed'
    | 'emergency_release'
    | 'emergency_override'
    | 'invitation_sent'
    | 'invitation_accepted'
    | 'tamper_detected'
    | 'integrity_verified'
    | 'note_added';

export interface AuditEntry {
    id: string;
    caseId: string;
    action: AuditAction;
    actor: string;       // email or user name
    actorRole: string;
    detail: string;
    timestamp: string;
}

const GLOBAL_LOG_KEY = 'ev_audit_log';

// ─── Append ───────────────────────────────────────────────────────────────────

export function appendAuditEntry(
    caseId: string,
    action: AuditAction,
    actor: string,
    actorRole: string,
    detail: string
): AuditEntry {
    const entry: AuditEntry = {
        id: `audit-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        caseId,
        action,
        actor,
        actorRole,
        detail,
        timestamp: new Date().toISOString(),
    };

    // Append to global log
    const global = getGlobalAuditLog();
    global.unshift(entry); // newest first
    // Keep max 500 entries
    if (global.length > 500) global.length = 500;
    localStorage.setItem(GLOBAL_LOG_KEY, JSON.stringify(global));

    return entry;
}

// ─── Read ─────────────────────────────────────────────────────────────────────

export function getGlobalAuditLog(): AuditEntry[] {
    try { return JSON.parse(localStorage.getItem(GLOBAL_LOG_KEY) || '[]'); }
    catch { return []; }
}

export function getCaseAuditLog(caseId: string): AuditEntry[] {
    return getGlobalAuditLog().filter(e => e.caseId === caseId);
}

export function getRecentAuditEntries(count: number = 50): AuditEntry[] {
    return getGlobalAuditLog().slice(0, count);
}

// ─── Action Labels & Icons ────────────────────────────────────────────────────

export const ACTION_LABELS: Record<AuditAction, string> = {
    case_created: 'Case Created',
    case_updated: 'Case Updated',
    status_changed: 'Status Changed',
    priority_changed: 'Priority Changed',
    evidence_uploaded: 'Evidence Uploaded',
    evidence_verified: 'Evidence Verified',
    report_generated: 'Report Generated',
    case_exported: 'Case Exported',
    case_locked: 'Case Locked',
    case_unlocked: 'Case Unlocked',
    case_archived: 'Case Archived',
    case_deleted: 'Case Deleted',
    investigator_assigned: 'Investigator Assigned',
    investigator_removed: 'Investigator Removed',
    emergency_release: 'Emergency Release',
    emergency_override: 'Emergency Override',
    invitation_sent: 'Invitation Sent',
    invitation_accepted: 'Invitation Accepted',
    tamper_detected: 'Tamper Detected',
    integrity_verified: 'Integrity Verified',
    note_added: 'Note Added',
};

export const ACTION_COLORS: Record<AuditAction, string> = {
    case_created: 'text-emerald-400',
    case_updated: 'text-blue-400',
    status_changed: 'text-blue-400',
    priority_changed: 'text-amber-400',
    evidence_uploaded: 'text-emerald-400',
    evidence_verified: 'text-emerald-400',
    report_generated: 'text-purple-400',
    case_exported: 'text-purple-400',
    case_locked: 'text-amber-400',
    case_unlocked: 'text-amber-400',
    case_archived: 'text-zinc-400',
    case_deleted: 'text-red-400',
    investigator_assigned: 'text-blue-400',
    investigator_removed: 'text-red-400',
    emergency_release: 'text-red-400',
    emergency_override: 'text-red-400',
    invitation_sent: 'text-blue-400',
    invitation_accepted: 'text-emerald-400',
    tamper_detected: 'text-red-400',
    integrity_verified: 'text-emerald-400',
    note_added: 'text-zinc-400',
};

// ─── Seed Demo Audit Entries ──────────────────────────────────────────────────

export function seedDemoAuditLog(): void {
    const existing = getGlobalAuditLog();
    if (existing.length > 0) return;

    const seeds: Omit<AuditEntry, 'id'>[] = [
        { caseId: 'demo-case-001', action: 'case_created', actor: 'authority@police.gov', actorRole: 'admin', detail: 'Demo case created: Phishing Email Investigation', timestamp: '2026-02-20T09:00:00Z' },
        { caseId: 'demo-case-001', action: 'investigator_assigned', actor: 'authority@police.gov', actorRole: 'admin', detail: 'Detective Rahman assigned to case', timestamp: '2026-02-20T09:05:00Z' },
        { caseId: 'demo-case-001', action: 'evidence_uploaded', actor: 'rahman@investigation.bd', actorRole: 'investigator', detail: 'Uploaded suspicious_email.eml (SHA-256 verified)', timestamp: '2026-02-20T10:30:00Z' },
        { caseId: 'demo-case-001', action: 'status_changed', actor: 'rahman@investigation.bd', actorRole: 'investigator', detail: 'Status: Draft → Under Investigation', timestamp: '2026-02-20T11:00:00Z' },
        { caseId: 'demo-case-002', action: 'case_created', actor: 'authority@police.gov', actorRole: 'admin', detail: 'Demo case created: Financial Fraud Analysis', timestamp: '2026-02-22T14:00:00Z' },
        { caseId: 'demo-case-002', action: 'priority_changed', actor: 'authority@police.gov', actorRole: 'admin', detail: 'Priority: Medium → Critical', timestamp: '2026-02-22T14:10:00Z' },
    ];

    const entries: AuditEntry[] = seeds.map((s, i) => ({
        ...s,
        id: `audit-seed-${i}`,
    }));

    localStorage.setItem(GLOBAL_LOG_KEY, JSON.stringify(entries));
}
