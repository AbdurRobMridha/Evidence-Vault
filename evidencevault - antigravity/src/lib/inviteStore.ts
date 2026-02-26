// ═══════════════════════════════════════════════
// Evidence Vault — Invitation System
// ═══════════════════════════════════════════════

import type { Role } from './rbac';

export interface Invitation {
    token: string;
    email: string;
    role: Role;
    caseIds: string[];
    createdBy: string;
    createdAt: string;
    expiresAt: string;
    accepted: boolean;
    acceptedAt?: string;
    appLink: string;
}

const INVITES_KEY = 'ev_invitations';

// ─── Generate Token ───────────────────────────────────────────────────────────

function generateToken(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let token = 'EVT-';
    for (let i = 0; i < 32; i++) {
        token += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return token;
}

// ─── CRUD ─────────────────────────────────────────────────────────────────────

export function getAllInvitations(): Invitation[] {
    try { return JSON.parse(localStorage.getItem(INVITES_KEY) || '[]'); }
    catch { return []; }
}

function saveInvitations(invites: Invitation[]): void {
    localStorage.setItem(INVITES_KEY, JSON.stringify(invites));
}

export function createInvitation(
    email: string,
    role: Role,
    caseIds: string[],
    createdBy: string
): Invitation {
    const token = generateToken();
    const now = new Date();
    const expires = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // 7 days

    const invitation: Invitation = {
        token,
        email,
        role,
        caseIds,
        createdBy,
        createdAt: now.toISOString(),
        expiresAt: expires.toISOString(),
        accepted: false,
        appLink: `${window.location.origin}/login?invite=${token}`,
    };

    const invites = getAllInvitations();
    invites.unshift(invitation);
    saveInvitations(invites);

    // Simulate email in console (demo mode)
    console.log('╔══════════════════════════════════════════════════╗');
    console.log('║      📧 INVESTIGATOR INVITATION EMAIL           ║');
    console.log('╠══════════════════════════════════════════════════╣');
    console.log(`║  To:       ${email}`);
    console.log(`║  Role:     ${role}`);
    console.log(`║  Cases:    ${caseIds.join(', ')}`);
    console.log(`║  Token:    ${token}`);
    console.log(`║  Link:     ${invitation.appLink}`);
    console.log(`║  Expires:  ${expires.toISOString()}`);
    console.log('╚══════════════════════════════════════════════════╝');

    return invitation;
}

export function validateInvitation(token: string): { valid: boolean; invitation?: Invitation; error?: string } {
    const invites = getAllInvitations();
    const invite = invites.find(i => i.token === token);

    if (!invite) return { valid: false, error: 'Invitation not found' };
    if (invite.accepted) return { valid: false, error: 'Invitation already used' };

    const now = new Date();
    if (now > new Date(invite.expiresAt)) {
        return { valid: false, error: 'Invitation has expired' };
    }

    return { valid: true, invitation: invite };
}

export function markInvitationUsed(token: string): boolean {
    const invites = getAllInvitations();
    const invite = invites.find(i => i.token === token);
    if (!invite || invite.accepted) return false;

    invite.accepted = true;
    invite.acceptedAt = new Date().toISOString();
    saveInvitations(invites);
    return true;
}

export function getInvitationsForEmail(email: string): Invitation[] {
    return getAllInvitations().filter(i => i.email === email);
}

export function getPendingInvitations(): Invitation[] {
    const now = new Date();
    return getAllInvitations().filter(
        i => !i.accepted && new Date(i.expiresAt) > now
    );
}

export function getExpiredInvitations(): Invitation[] {
    const now = new Date();
    return getAllInvitations().filter(
        i => !i.accepted && new Date(i.expiresAt) <= now
    );
}
