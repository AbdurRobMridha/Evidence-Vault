// ═══════════════════════════════════════════════════════════════
// Evidence Vault — Survivors Safety Monitor
// ═══════════════════════════════════════════════════════════════
//
// Purpose:
//   • Tracks the user's last activity timestamp for high-risk cases.
//   • If the user is inactive for more than the configured threshold
//     (X hours) on a High or Critical case, the system will:
//       1. Auto-notify the authority (demo: in-browser alert log + notification)
//       2. Trigger an alert status change on the case (→ "Under Investigation")
//       3. Record the event in the safety audit log
//
// All state is stored in localStorage so it persists across tabs/refreshes.
// ───────────────────────────────────────────────────────────────

import { getAllManagedCases, updateManagedCase } from './caseStore';

// ─── Keys ─────────────────────────────────────────────────────────────────────

const KEY_SETTINGS = 'ev_safety_monitor_settings';
const KEY_ACTIVITY = 'ev_safety_monitor_activity';   // caseId → last ISO timestamp
const KEY_ALERTS   = 'ev_safety_monitor_alerts';     // alert log entries
const KEY_NOTIFIED = 'ev_safety_monitor_notified';   // caseIds already notified (avoid spam)

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface SafetyMonitorSettings {
    enabled: boolean;
    inactivityHours: number;  // trigger after X hours of inactivity on high-risk case
    authorityEmail: string;   // demo: shown in the notification
    notifyBrowser: boolean;   // whether to show browser notification
}

export interface SafetyAlertEntry {
    id: string;
    caseId: string;
    caseTitle: string;
    priority: string;
    triggeredAt: string;       // ISO string
    inactiveHours: number;
    actionTaken: string;
    authorityNotified: boolean;
    statusChanged: boolean;
    prevStatus: string;
    newStatus: string;
}

// ─── Settings CRUD ─────────────────────────────────────────────────────────────

export function getSafetyMonitorSettings(): SafetyMonitorSettings {
    try {
        const raw = localStorage.getItem(KEY_SETTINGS);
        if (raw) return JSON.parse(raw);
    } catch { /* empty */ }
    return {
        enabled: true,
        inactivityHours: 24,
        authorityEmail: 'authority@police.gov',
        notifyBrowser: true,
    };
}

export function saveSafetyMonitorSettings(settings: SafetyMonitorSettings): void {
    localStorage.setItem(KEY_SETTINGS, JSON.stringify(settings));
}

// ─── Activity Tracking ─────────────────────────────────────────────────────────

export function recordCaseActivity(caseId: string): void {
    try {
        const raw = localStorage.getItem(KEY_ACTIVITY);
        const map: Record<string, string> = raw ? JSON.parse(raw) : {};
        map[caseId] = new Date().toISOString();
        localStorage.setItem(KEY_ACTIVITY, JSON.stringify(map));
    } catch { /* empty */ }
}

export function getLastCaseActivity(caseId: string): Date | null {
    try {
        const raw = localStorage.getItem(KEY_ACTIVITY);
        if (!raw) return null;
        const map: Record<string, string> = JSON.parse(raw);
        const ts = map[caseId];
        return ts ? new Date(ts) : null;
    } catch { return null; }
}

// ─── Alert Log ─────────────────────────────────────────────────────────────────

export function getSafetyAlerts(): SafetyAlertEntry[] {
    try {
        const raw = localStorage.getItem(KEY_ALERTS);
        return raw ? JSON.parse(raw) : [];
    } catch { return []; }
}

function addSafetyAlert(entry: SafetyAlertEntry): void {
    const alerts = getSafetyAlerts();
    alerts.unshift(entry);
    // Keep last 100 alerts
    localStorage.setItem(KEY_ALERTS, JSON.stringify(alerts.slice(0, 100)));
}

export function clearSafetyAlerts(): void {
    localStorage.removeItem(KEY_ALERTS);
}

// ─── Notified Set (avoid re-notifying same case) ──────────────────────────────

function getNotifiedCases(): Set<string> {
    try {
        const raw = localStorage.getItem(KEY_NOTIFIED);
        return raw ? new Set(JSON.parse(raw)) : new Set();
    } catch { return new Set(); }
}

function markCaseNotified(caseId: string): void {
    const set = getNotifiedCases();
    set.add(caseId);
    localStorage.setItem(KEY_NOTIFIED, JSON.stringify([...set]));
}

export function resetCaseNotified(caseId: string): void {
    const set = getNotifiedCases();
    set.delete(caseId);
    localStorage.setItem(KEY_NOTIFIED, JSON.stringify([...set]));
}

// ─── Core Check Logic ──────────────────────────────────────────────────────────

/**
 * Run inactivity check for all high-risk cases (High / Critical priority).
 * Should be called periodically (e.g., every minute) from the app root.
 */
export function runInactivityCheck(): SafetyAlertEntry[] {
    const settings = getSafetyMonitorSettings();
    if (!settings.enabled) return [];

    const allCases = getAllManagedCases();
    const highRisk = allCases.filter(c =>
        (c.priority === 'High' || c.priority === 'Critical') &&
        c.status !== 'Closed' &&
        c.status !== 'Archived'
    );

    const notified = getNotifiedCases();
    const now = new Date();
    const thresholdMs = settings.inactivityHours * 60 * 60 * 1000;
    const triggered: SafetyAlertEntry[] = [];

    for (const c of highRisk) {
        // Skip already-notified cases
        if (notified.has(c.caseId)) continue;

        const lastActivity = getLastCaseActivity(c.caseId);
        // If no activity ever recorded, use case's updatedAt as baseline
        const baseline = lastActivity ?? new Date(c.updatedAt);
        const elapsed = now.getTime() - baseline.getTime();

        if (elapsed >= thresholdMs) {
            const inactiveHours = Math.floor(elapsed / (60 * 60 * 1000));
            const prevStatus = c.status;
            let newStatus = prevStatus;
            let statusChanged = false;

            // Escalate status if not already escalated
            if (prevStatus === 'Draft' || prevStatus === 'Open') {
                newStatus = 'Under Investigation';
                updateManagedCase(c.caseId, { status: newStatus });
                statusChanged = true;
            }

            // Show browser notification if available
            if (settings.notifyBrowser && 'Notification' in window) {
                try {
                    if (Notification.permission === 'granted') {
                        new Notification('⚠️ Survivors Safety Alert', {
                            body: `Case "${c.caseTitle || c.title}" (${c.priority}) has been inactive for ${inactiveHours}h. Authority notified.`,
                            icon: '/favicon.ico',
                            tag: `ev-safety-${c.caseId}`,
                        });
                    }
                } catch { /* not critical */ }
            }

            const entry: SafetyAlertEntry = {
                id: `alert-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
                caseId: c.caseId,
                caseTitle: (c as any).caseTitle || c.title,
                priority: c.priority,
                triggeredAt: now.toISOString(),
                inactiveHours,
                actionTaken: statusChanged
                    ? `Status escalated: ${prevStatus} → ${newStatus}. Authority email queued to ${settings.authorityEmail}.`
                    : `Authority email queued to ${settings.authorityEmail}. Status retained (${prevStatus}).`,
                authorityNotified: true,
                statusChanged,
                prevStatus,
                newStatus,
            };

            addSafetyAlert(entry);
            markCaseNotified(c.caseId);
            triggered.push(entry);

            // Fire custom event so UI can react
            window.dispatchEvent(new CustomEvent('ev:safety-alert', { detail: entry }));
        }
    }

    return triggered;
}

// ─── High-Risk Check for a single case ────────────────────────────────────────

export function isHighRiskCase(priority: string): boolean {
    return priority === 'High' || priority === 'Critical';
}

export function getCaseAlertStatus(caseId: string): {
    isOverdue: boolean;
    inactiveHours: number;
    lastActivity: Date | null;
    thresholdHours: number;
} {
    const settings = getSafetyMonitorSettings();
    const lastActivity = getLastCaseActivity(caseId);
    const cases = getAllManagedCases();
    const c = cases.find(x => x.caseId === caseId);
    const baseline = lastActivity ?? (c ? new Date(c.updatedAt) : new Date());
    const elapsed = Date.now() - baseline.getTime();
    const inactiveHours = elapsed / (60 * 60 * 1000);
    return {
        isOverdue: inactiveHours >= settings.inactivityHours,
        inactiveHours: Math.floor(inactiveHours),
        lastActivity,
        thresholdHours: settings.inactivityHours,
    };
}

// ─── Notification Permission Request ─────────────────────────────────────────

export async function requestNotificationPermission(): Promise<NotificationPermission> {
    if (!('Notification' in window)) return 'denied';
    if (Notification.permission === 'granted') return 'granted';
    return Notification.requestPermission();
}
