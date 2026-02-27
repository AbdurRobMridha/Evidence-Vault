// ═══════════════════════════════════════════════
// Evidence Vault — Role-Based Access Control
// ═══════════════════════════════════════════════

// ─── Imports ──────────────────────────────────────────────────────────────────
import { getManagedCaseById } from './caseStore';

// ─── Types ────────────────────────────────────────────────────────────────────

export type Role = 'admin' | 'investigator' | 'user' | 'viewer';

export interface AppUser {
    id: string;
    name: string;
    email: string;
    role: Role;
    assignedCases: string[];
    createdAt: string;
}

export type Permission =
    | 'view_all_cases'
    | 'view_assigned_cases'
    | 'upload_evidence'
    | 'add_notes'
    | 'update_status'
    | 'update_status_limited'
    | 'modify_metadata'
    | 'change_priority'
    | 'assign_investigators'
    | 'remove_investigators'
    | 'trigger_emergency_release'
    | 'generate_report'
    | 'export_report'
    | 'view_audit_logs'
    | 'archive_case'
    | 'delete_case'
    | 'lock_case'
    | 'verify_evidence'
    | 'emergency_override'
    | 'invite_investigators';

// ─── Permission Map ───────────────────────────────────────────────────────────

export const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
    admin: [
        'view_all_cases', 'view_assigned_cases', 'upload_evidence', 'add_notes',
        'update_status', 'modify_metadata', 'change_priority',
        'assign_investigators', 'remove_investigators',
        'trigger_emergency_release', 'generate_report', 'export_report',
        'view_audit_logs', 'archive_case', 'delete_case', 'lock_case',
        'verify_evidence', 'emergency_override', 'invite_investigators',
    ],
    investigator: [
        'view_assigned_cases', 'upload_evidence', 'add_notes',
        'update_status_limited', 'generate_report', 'export_report',
    ],
    viewer: [
        'view_assigned_cases',
    ],
    user: [
        'view_assigned_cases',
    ],
};

// ─── Permission Guards ────────────────────────────────────────────────────────

export function hasPermission(role: Role, permission: Permission): boolean {
    return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}

export function canAccessCase(user: AppUser, caseId: string): boolean {
    if (user.role === 'admin') return true;
    if (user.assignedCases.includes(caseId)) return true;

    // Check if user created this case or is assigned as investigator on it
    try {
        const mc = getManagedCaseById(caseId);
        if (mc) {
            if (mc.createdBy === user.id) return true;
            if (mc.createdByEmail === user.email) return true;
            if (mc.assignedInvestigators && mc.assignedInvestigators.includes(user.id)) return true;
        }
    } catch (err) {
        console.error('Error checking case access:', err);
    }
    return false;
}

export function canUpdateStatus(user: AppUser, nextStatus: string): boolean {
    if (user.role === 'admin') return true;
    if (user.role === 'investigator') {
        return !['Archived', 'Closed'].includes(nextStatus);
    }
    return false;
}

// ─── Role Labels & Colors ─────────────────────────────────────────────────────

export const ROLE_LABELS: Record<Role, string> = {
    admin: 'Authority',
    investigator: 'Investigator',
    viewer: 'Viewer',
    user: 'General User',
};

export const ROLE_COLORS: Record<Role, { text: string; bg: string; border: string }> = {
    admin: { text: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/30' },
    investigator: { text: 'text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500/30' },
    viewer: { text: 'text-zinc-400', bg: 'bg-zinc-500/10', border: 'border-zinc-500/30' },
    user: { text: 'text-zinc-400', bg: 'bg-zinc-500/10', border: 'border-zinc-500/30' },
};

// ─── User Store (localStorage) ────────────────────────────────────────────────

const USERS_KEY = 'ev_users';

export function getAllUsers(): AppUser[] {
    try {
        const users: AppUser[] = JSON.parse(localStorage.getItem(USERS_KEY) || '[]');
        let modified = false;
        users.forEach(u => {
            if (u.email === 'victim@example.com' && u.role === 'investigator') {
                u.role = 'user';
                modified = true;
            }
        });
        if (modified) {
            localStorage.setItem(USERS_KEY, JSON.stringify(users));
        }
        return users;
    }
    catch { return []; }
}

export function saveUsers(users: AppUser[]): void {
    localStorage.setItem(USERS_KEY, JSON.stringify(users));
}

export function getUserById(id: string): AppUser | null {
    return getAllUsers().find(u => u.id === id) ?? null;
}

export function getUserByEmail(email: string): AppUser | null {
    return getAllUsers().find(u => u.email === email) ?? null;
}

export function upsertUser(user: AppUser): void {
    const users = getAllUsers();
    const idx = users.findIndex(u => u.id === user.id);
    if (idx >= 0) users[idx] = user; else users.push(user);
    saveUsers(users);
}

export function updateUserRole(id: string, role: Role): void {
    const users = getAllUsers();
    const u = users.find(u => u.id === id);
    if (u) { u.role = role; saveUsers(users); }
}

export function assignCaseToUser(userId: string, caseId: string): void {
    const users = getAllUsers();
    const u = users.find(u => u.id === userId);
    if (u && !u.assignedCases.includes(caseId)) {
        u.assignedCases.push(caseId);
        saveUsers(users);
    }
}

export function removeCaseFromUser(userId: string, caseId: string): void {
    const users = getAllUsers();
    const u = users.find(u => u.id === userId);
    if (u) {
        u.assignedCases = u.assignedCases.filter(c => c !== caseId);
        saveUsers(users);
    }
}

export function removeUser(userId: string): void {
    saveUsers(getAllUsers().filter(u => u.id !== userId));
}

// ─── Current User Helper ──────────────────────────────────────────────────────

export function getCurrentAppUser(): AppUser | null {
    try {
        const raw = localStorage.getItem('user');
        if (!raw) return null;
        const loginUser = JSON.parse(raw);

        // Auto-patch corrupted session data from earlier builds
        if (loginUser.email === 'victim@example.com' && loginUser.role === 'investigator') {
            loginUser.role = 'user';
            localStorage.setItem('user', JSON.stringify(loginUser));
        }

        // First check the RBAC user store
        const appUser = getUserByEmail(loginUser.email);
        if (appUser) return appUser;
        // Fallback: construct from login data
        return {
            id: loginUser.uid || loginUser.id || `user-${Date.now()}`,
            name: loginUser.email?.split('@')[0] || 'User',
            email: loginUser.email,
            role: loginUser.role || (loginUser.email?.includes('authority') ? 'admin' : 'user'),
            assignedCases: [],
            createdAt: new Date().toISOString(),
        };
    } catch { return null; }
}

// ─── Demo Seed ────────────────────────────────────────────────────────────────

export function seedDemoUsers(): void {
    const existing = getAllUsers();

    // Auto-patch: if users were already seeded with 'investigator' for the demo victim, fix it.
    if (existing.length > 0) {
        let needsSave = false;
        existing.forEach(u => {
            if (u.email === 'victim@example.com' && u.role === 'investigator') {
                u.role = 'user';
                needsSave = true;
            }
        });
        if (needsSave) saveUsers(existing);
        return; // already seeded
    }

    const demoUsers: AppUser[] = [
        {
            id: 'admin-001',
            name: 'Authority Admin',
            email: 'authority@police.gov',
            role: 'admin',
            assignedCases: [],
            createdAt: '2026-01-01T00:00:00Z',
        },
        {
            id: 'inv-001',
            name: 'Detective Rahman',
            email: 'rahman@investigation.bd',
            role: 'investigator',
            assignedCases: [],
            createdAt: '2026-01-15T10:00:00Z',
        },
        {
            id: 'inv-002',
            name: 'Officer Karim',
            email: 'karim@investigation.bd',
            role: 'investigator',
            assignedCases: [],
            createdAt: '2026-02-01T08:30:00Z',
        },
        {
            id: 'user-victim-001',
            name: 'Victim User',
            email: 'victim@example.com',
            role: 'user',
            assignedCases: [],
            createdAt: '2026-02-10T12:00:00Z',
        },
    ];
    saveUsers(demoUsers);
}
