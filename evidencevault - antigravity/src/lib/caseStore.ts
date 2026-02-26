// ═══════════════════════════════════════════════
// Evidence Vault — Case Store (localStorage)
// ═══════════════════════════════════════════════

// ─── Types ────────────────────────────────────────────────────────────────────

export type CaseStatus =
    | 'Draft'
    | 'Open'
    | 'Under Investigation'
    | 'Evidence Verified'
    | 'Report Generated'
    | 'Closed'
    | 'Archived';

export type CasePriority = 'Low' | 'Medium' | 'High' | 'Critical';

export interface ManagedCase {
    caseId: string;
    title: string;
    description: string;
    createdBy: string;           // user id who created
    createdByEmail: string;
    assignedInvestigators: string[];  // user ids
    status: CaseStatus;
    priority: CasePriority;
    locked: boolean;
    tamperFlag: boolean;
    integrityVerified: boolean;
    digitalSignature: string;    // simulated signature hash
    createdAt: string;
    updatedAt: string;
}

// ─── Status Workflow ──────────────────────────────────────────────────────────

export const STATUS_ORDER: CaseStatus[] = [
    'Draft', 'Open', 'Under Investigation',
    'Evidence Verified', 'Report Generated', 'Closed', 'Archived',
];

const VALID_TRANSITIONS: Record<CaseStatus, CaseStatus[]> = {
    'Draft': ['Open'],
    'Open': ['Under Investigation'],
    'Under Investigation': ['Evidence Verified', 'Open'],       // can revert to Open
    'Evidence Verified': ['Report Generated', 'Under Investigation'],
    'Report Generated': ['Closed', 'Evidence Verified'],
    'Closed': ['Archived', 'Open'],                // can reopen
    'Archived': [],                                   // terminal
};

export function getNextStatuses(current: CaseStatus): CaseStatus[] {
    return VALID_TRANSITIONS[current] || [];
}

export function isValidTransition(from: CaseStatus, to: CaseStatus): boolean {
    return getNextStatuses(from).includes(to);
}

// ─── Status Colors ────────────────────────────────────────────────────────────

export const STATUS_COLORS: Record<CaseStatus, { text: string; bg: string; border: string }> = {
    'Draft': { text: 'text-zinc-400', bg: 'bg-zinc-500/10', border: 'border-zinc-500/20' },
    'Open': { text: 'text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500/20' },
    'Under Investigation': { text: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/20' },
    'Evidence Verified': { text: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20' },
    'Report Generated': { text: 'text-purple-400', bg: 'bg-purple-500/10', border: 'border-purple-500/20' },
    'Closed': { text: 'text-zinc-400', bg: 'bg-zinc-800', border: 'border-zinc-700' },
    'Archived': { text: 'text-zinc-500', bg: 'bg-zinc-900', border: 'border-zinc-800' },
};

export const PRIORITY_COLORS: Record<CasePriority, { text: string; bg: string; border: string }> = {
    'Low': { text: 'text-zinc-400', bg: 'bg-zinc-500/10', border: 'border-zinc-500/20' },
    'Medium': { text: 'text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500/20' },
    'High': { text: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/20' },
    'Critical': { text: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/20' },
};

// ─── Case localStorage CRUD ───────────────────────────────────────────────────

const CASES_KEY = 'ev_managed_cases';

export function getAllManagedCases(): ManagedCase[] {
    try { return JSON.parse(localStorage.getItem(CASES_KEY) || '[]'); }
    catch { return []; }
}

function saveCases(cases: ManagedCase[]): void {
    localStorage.setItem(CASES_KEY, JSON.stringify(cases));
}

export function getManagedCaseById(caseId: string): ManagedCase | null {
    return getAllManagedCases().find(c => c.caseId === caseId) ?? null;
}

export function getCasesForUser(userId: string, role: string): ManagedCase[] {
    const all = getAllManagedCases();
    if (role === 'admin') return all;
    return all.filter(c => c.assignedInvestigators.includes(userId) || c.createdBy === userId);
}

export function createManagedCase(data: {
    title: string;
    description: string;
    createdBy: string;
    createdByEmail: string;
    priority?: CasePriority;
}): ManagedCase {
    const newCase: ManagedCase = {
        caseId: `CASE-${Date.now()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`,
        title: data.title,
        description: data.description,
        createdBy: data.createdBy,
        createdByEmail: data.createdByEmail,
        assignedInvestigators: [],
        status: 'Draft',
        priority: data.priority || 'Medium',
        locked: false,
        tamperFlag: false,
        integrityVerified: true,
        digitalSignature: generateSignature(data.title),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
    };

    const cases = getAllManagedCases();
    cases.unshift(newCase);
    saveCases(cases);
    return newCase;
}

export function updateManagedCase(caseId: string, updates: Partial<ManagedCase>): ManagedCase | null {
    const cases = getAllManagedCases();
    const idx = cases.findIndex(c => c.caseId === caseId);
    if (idx < 0) return null;

    cases[idx] = { ...cases[idx], ...updates, updatedAt: new Date().toISOString() };
    saveCases(cases);
    return cases[idx];
}

export function deleteManagedCase(caseId: string): boolean {
    const cases = getAllManagedCases();
    const filtered = cases.filter(c => c.caseId !== caseId);
    if (filtered.length === cases.length) return false;
    saveCases(filtered);
    return true;
}

export function assignInvestigatorToCase(caseId: string, userId: string): void {
    const cases = getAllManagedCases();
    const c = cases.find(c => c.caseId === caseId);
    if (c && !c.assignedInvestigators.includes(userId)) {
        c.assignedInvestigators.push(userId);
        c.updatedAt = new Date().toISOString();
        saveCases(cases);
    }
}

export function removeInvestigatorFromCase(caseId: string, userId: string): void {
    const cases = getAllManagedCases();
    const c = cases.find(c => c.caseId === caseId);
    if (c) {
        c.assignedInvestigators = c.assignedInvestigators.filter(id => id !== userId);
        c.updatedAt = new Date().toISOString();
        saveCases(cases);
    }
}

// ─── Helper ───────────────────────────────────────────────────────────────────

function generateSignature(input: string): string {
    // Simulated digital signature (demo)
    let hash = 0;
    const str = input + Date.now().toString();
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
    }
    return 'SIG-' + Math.abs(hash).toString(16).toUpperCase().padStart(12, '0');
}

// ─── Metrics ──────────────────────────────────────────────────────────────────

export interface CaseMetrics {
    total: number;
    draft: number;
    open: number;
    underInvestigation: number;
    evidenceVerified: number;
    reportGenerated: number;
    closed: number;
    archived: number;
    critical: number;
    locked: number;
    tampered: number;
}

export function getCaseMetrics(): CaseMetrics {
    const cases = getAllManagedCases();
    return {
        total: cases.length,
        draft: cases.filter(c => c.status === 'Draft').length,
        open: cases.filter(c => c.status === 'Open').length,
        underInvestigation: cases.filter(c => c.status === 'Under Investigation').length,
        evidenceVerified: cases.filter(c => c.status === 'Evidence Verified').length,
        reportGenerated: cases.filter(c => c.status === 'Report Generated').length,
        closed: cases.filter(c => c.status === 'Closed').length,
        archived: cases.filter(c => c.status === 'Archived').length,
        critical: cases.filter(c => c.priority === 'Critical').length,
        locked: cases.filter(c => c.locked).length,
        tampered: cases.filter(c => c.tamperFlag).length,
    };
}

// ─── Demo Seed ────────────────────────────────────────────────────────────────

export function seedDemoCases(): void {
    const existing = getAllManagedCases();
    if (existing.length > 0) return;

    const demos: ManagedCase[] = [
        {
            caseId: 'demo-case-001',
            title: 'Phishing Email Investigation',
            description: 'Suspicious phishing emails targeting corporate employees with credential harvesting links.',
            createdBy: 'admin-001',
            createdByEmail: 'authority@police.gov',
            assignedInvestigators: ['inv-001'],
            status: 'Under Investigation',
            priority: 'High',
            locked: false, tamperFlag: false, integrityVerified: true,
            digitalSignature: 'SIG-00A3F7B2C1D0',
            createdAt: '2026-02-20T09:00:00Z',
            updatedAt: '2026-02-24T15:30:00Z',
        },
        {
            caseId: 'demo-case-002',
            title: 'Financial Fraud Analysis',
            description: 'Investigation into fraudulent wire transfers from compromised banking credentials.',
            createdBy: 'admin-001',
            createdByEmail: 'authority@police.gov',
            assignedInvestigators: ['inv-001', 'inv-002'],
            status: 'Evidence Verified',
            priority: 'Critical',
            locked: false, tamperFlag: false, integrityVerified: true,
            digitalSignature: 'SIG-00B4E8C3D2F1',
            createdAt: '2026-02-22T14:00:00Z',
            updatedAt: '2026-02-25T11:00:00Z',
        },
        {
            caseId: 'demo-case-003',
            title: 'Social Media Harassment Report',
            description: 'Evidence collection regarding persistent online harassment and threats via social platforms.',
            createdBy: 'user-victim-001',
            createdByEmail: 'victim@example.com',
            assignedInvestigators: ['user-victim-001'],
            status: 'Open',
            priority: 'Medium',
            locked: false, tamperFlag: false, integrityVerified: true,
            digitalSignature: 'SIG-00C5F9D4E3A2',
            createdAt: '2026-02-25T10:00:00Z',
            updatedAt: '2026-02-25T10:00:00Z',
        },
        {
            caseId: 'demo-case-004',
            title: 'Data Breach Forensics',
            description: 'Forensic analysis of unauthorized data exfiltration from internal database systems.',
            createdBy: 'admin-001',
            createdByEmail: 'authority@police.gov',
            assignedInvestigators: ['inv-002'],
            status: 'Draft',
            priority: 'High',
            locked: false, tamperFlag: false, integrityVerified: true,
            digitalSignature: 'SIG-00D6A0E5F4B3',
            createdAt: '2026-02-26T08:00:00Z',
            updatedAt: '2026-02-26T08:00:00Z',
        },
    ];

    saveCases(demos);
}
