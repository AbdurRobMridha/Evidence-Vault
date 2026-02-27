// ═══════════════════════════════════════════════
// Evidence Vault — Per-Case Evidence Store (localStorage)
// ═══════════════════════════════════════════════

export interface StoredEvidenceMeta {
    id: string;
    file_name: string;
    file_type: string;
    file_size: number;
    client_sha256: string;
    server_sha256: string;
    uploaded_by: string;
    upload_timestamp: string;
    integrity_status: 'VERIFIED' | 'COMPROMISED' | 'PENDING';
    storageKey?: string; // localStorage key for raw file data
}

const EVIDENCE_KEY_PREFIX = 'ev_case_evidence_';

// ─── Read ─────────────────────────────────────────────────────────────────────

export function getEvidenceForCase(caseId: string): StoredEvidenceMeta[] {
    try {
        return JSON.parse(localStorage.getItem(`${EVIDENCE_KEY_PREFIX}${caseId}`) || '[]');
    } catch { return []; }
}

export function getAllCaseEvidence(): Record<string, StoredEvidenceMeta[]> {
    const result: Record<string, StoredEvidenceMeta[]> = {};
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(EVIDENCE_KEY_PREFIX)) {
            const caseId = key.replace(EVIDENCE_KEY_PREFIX, '');
            try {
                result[caseId] = JSON.parse(localStorage.getItem(key) || '[]');
            } catch { result[caseId] = []; }
        }
    }
    return result;
}

export function getEvidenceCountForCase(caseId: string): number {
    return getEvidenceForCase(caseId).length;
}

// ─── Write ────────────────────────────────────────────────────────────────────

export function saveEvidenceToCase(caseId: string, evidence: StoredEvidenceMeta): void {
    const existing = getEvidenceForCase(caseId);
    // Avoid duplicates by id
    if (existing.some(e => e.id === evidence.id)) return;
    existing.unshift(evidence);
    localStorage.setItem(`${EVIDENCE_KEY_PREFIX}${caseId}`, JSON.stringify(existing));
}

export function removeEvidenceFromCase(caseId: string, evidenceId: string): void {
    const existing = getEvidenceForCase(caseId);
    const filtered = existing.filter(e => e.id !== evidenceId);
    localStorage.setItem(`${EVIDENCE_KEY_PREFIX}${caseId}`, JSON.stringify(filtered));
}

// ─── Bulk ─────────────────────────────────────────────────────────────────────

export function setEvidenceForCase(caseId: string, evidence: StoredEvidenceMeta[]): void {
    localStorage.setItem(`${EVIDENCE_KEY_PREFIX}${caseId}`, JSON.stringify(evidence));
}
