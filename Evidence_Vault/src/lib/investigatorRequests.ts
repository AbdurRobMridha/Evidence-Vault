// ═══════════════════════════════════════════════
// Evidence Vault — Investigator Request Store
// ═══════════════════════════════════════════════

export type RequestStatus = 'pending' | 'approved' | 'rejected';

export interface InvestigatorRequest {
    id: string;
    email: string;
    name: string;
    requestedCaseId?: string;
    message: string;
    status: RequestStatus;
    assignedRole?: string;
    createdAt: string;
    resolvedAt?: string;
    resolvedBy?: string;
}

const REQUESTS_KEY = 'ev_investigator_requests';

function getAll(): InvestigatorRequest[] {
    try { return JSON.parse(localStorage.getItem(REQUESTS_KEY) || '[]'); }
    catch { return []; }
}

function saveAll(requests: InvestigatorRequest[]): void {
    localStorage.setItem(REQUESTS_KEY, JSON.stringify(requests));
}

// ─── Public API ───────────────────────────────────────────────────────────────

export function submitRequest(email: string, name: string, caseId?: string, message?: string): InvestigatorRequest {
    const req: InvestigatorRequest = {
        id: `req-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        email,
        name,
        requestedCaseId: caseId,
        message: message || 'Requesting investigator access',
        status: 'pending',
        createdAt: new Date().toISOString(),
    };
    const all = getAll();
    all.unshift(req);
    saveAll(all);
    return req;
}

export function getPendingRequests(): InvestigatorRequest[] {
    return getAll().filter(r => r.status === 'pending');
}

export function getAllRequests(): InvestigatorRequest[] {
    return getAll();
}

export function approveRequest(requestId: string, resolvedBy: string, assignedRole: string = 'investigator'): InvestigatorRequest | null {
    const all = getAll();
    const req = all.find(r => r.id === requestId);
    if (!req || req.status !== 'pending') return null;

    req.status = 'approved';
    req.assignedRole = assignedRole;
    req.resolvedAt = new Date().toISOString();
    req.resolvedBy = resolvedBy;
    saveAll(all);

    // Auto-create user in RBAC store
    try {
        const { upsertUser, assignCaseToUser } = require('./rbac');
        const { assignInvestigatorToCase } = require('./caseStore');
        upsertUser({
            id: `inv-${Date.now()}`,
            name: req.name,
            email: req.email,
            role: assignedRole as any,
            assignedCases: req.requestedCaseId ? [req.requestedCaseId] : [],
            createdAt: new Date().toISOString(),
        });
        if (req.requestedCaseId) {
            assignInvestigatorToCase(req.requestedCaseId, `inv-${Date.now()}`);
        }
    } catch { /* ignore */ }

    return req;
}

export function rejectRequest(requestId: string, resolvedBy: string): InvestigatorRequest | null {
    const all = getAll();
    const req = all.find(r => r.id === requestId);
    if (!req || req.status !== 'pending') return null;

    req.status = 'rejected';
    req.resolvedAt = new Date().toISOString();
    req.resolvedBy = resolvedBy;
    saveAll(all);
    return req;
}

// ─── Demo Seed ────────────────────────────────────────────────────────────────

export function seedDemoRequests(): void {
    const existing = getAll();
    if (existing.length > 0) return;

    const seeds: InvestigatorRequest[] = [
        {
            id: 'req-demo-001',
            email: 'newdetective@police.gov',
            name: 'Detective Hasan',
            requestedCaseId: 'demo-case-001',
            message: 'Requesting access to the phishing investigation case',
            status: 'pending',
            createdAt: '2026-02-26T10:00:00Z',
        },
        {
            id: 'req-demo-002',
            email: 'analyst@forensics.bd',
            name: 'Forensic Analyst Rimi',
            message: 'Requesting general investigator access',
            status: 'pending',
            createdAt: '2026-02-26T12:00:00Z',
        },
    ];

    saveAll(seeds);
}
