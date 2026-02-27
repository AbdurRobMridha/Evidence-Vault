import React, { useState, useEffect, useCallback } from 'react';
import {
    Wifi, WifiOff, AlertTriangle, CheckCircle, Bell,
    Radar, ChevronRight, Clock, X, MessageSquare, Eye, Zap, Play,
    RefreshCw, Info, ShieldAlert, UserX, Heart, FolderPlus,
    Siren, ChevronDown, ChevronUp, Trash2, BellOff, Link as LinkIcon
} from 'lucide-react';
import {
    Platform, PLATFORM_CONFIG, ConnectedAccount, ScannedConversation, SafetyAlert,
    MonitorSettings,
    getConnectedAccounts, connectAccount, disconnectAccount, toggleAccountActive,
    getAllScans, saveScan, updateScan, getHighRiskScans, deleteScan,
    getAllAlerts, createAlert, markAlertRead, markAllAlertsRead, deleteAlert, deleteAllReadAlerts, getUnreadAlertCount,
    getMonitorSettings, saveMonitorSettings,
    getRiskColor, getRiskLabel, generateDemoScan, RiskLevel,
    attachChatEvidenceToCase,
} from '../lib/socialMonitorStore';
import { createManagedCase } from '../lib/caseStore';
import { appendAuditEntry } from '../lib/auditLog';
import { getCurrentAppUser } from '../lib/rbac';

// ─── DMS Timer Options ────────────────────────────────────────────────────────
const DMS_OPTIONS = [
    { value: 5, label: '5 minutes' },
    { value: 10, label: '10 minutes' },
    { value: 15, label: '15 minutes' },
    { value: 30, label: '30 minutes' },
    { value: 60, label: '1 hour' },
    { value: 1440, label: '24 hours' },
    { value: 2880, label: '48 hours' },
    { value: 4320, label: '72 hours' },
];

// ─── Scan Card ────────────────────────────────────────────────────────────────
function ScanCard({ scan, onViewDetail, onMarkSafe, onCreateCase, onEmergency, onDelete, user }: {
    scan: ScannedConversation;
    onViewDetail: (s: ScannedConversation) => void;
    onMarkSafe: (id: string) => void;
    onCreateCase: (s: ScannedConversation) => void;
    onEmergency: (s: ScannedConversation) => void;
    onDelete: (id: string) => void;
    user: any;
}) {
    const colors = getRiskColor(scan.riskLevel);
    const isHighRisk = scan.riskLevel >= 8;
    const cfg = PLATFORM_CONFIG[scan.platform];
    const timeUntilDms = scan.dmsTriggerAt
        ? Math.max(0, Math.ceil((new Date(scan.dmsTriggerAt).getTime() - Date.now()) / 60000))
        : null;

    return (
        <div className={`rounded-xl border p-4 space-y-3 transition-all ${isHighRisk && !scan.userMarkedSafe ? `${colors.border} ${colors.bg}` : 'border-zinc-800 bg-zinc-900/50'}`}>
            <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-zinc-800 flex items-center justify-center text-lg flex-shrink-0">
                        {cfg.icon}
                    </div>
                    <div>
                        <p className="font-semibold text-zinc-100">{scan.contactName}</p>
                        <p className="text-xs text-zinc-500">{scan.platform} · {scan.contactHandle}</p>
                    </div>
                </div>
                <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border flex-shrink-0 ${colors.text} ${colors.bg} ${colors.border}`}>
                    <span>{scan.riskLevel}/10</span>
                    <span>{getRiskLabel(scan.riskLevel)}</span>
                </div>
            </div>

            {scan.detectedThreats.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                    {scan.detectedThreats.map((t, i) => (
                        <span key={i} className="px-2 py-0.5 bg-red-500/10 text-red-400 border border-red-500/20 rounded-full text-xs">{t}</span>
                    ))}
                </div>
            )}

            <p className="text-sm text-zinc-400 line-clamp-2">{scan.riskSummary}</p>

            {isHighRisk && !scan.userMarkedSafe && scan.dmsTriggerAt && !scan.dmsFired && (
                <div className="flex items-center gap-2 px-3 py-2 bg-red-500/10 border border-red-500/30 rounded-lg">
                    <Clock className="w-4 h-4 text-red-400 flex-shrink-0 animate-pulse" />
                    <p className="text-xs text-red-300">
                        {timeUntilDms !== null && timeUntilDms > 0
                            ? `DMS fires in ${timeUntilDms < 60 ? `${timeUntilDms} min` : `${Math.round(timeUntilDms / 60)}h`} — Click "I'm Safe" to cancel`
                            : "Dead Man's Switch ARMED — Report sending..."}
                    </p>
                </div>
            )}

            {scan.autoCaseCreated && (
                <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
                    <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
                    <p className="text-xs text-emerald-300 truncate">Case: {scan.autoCaseId}</p>
                </div>
            )}

            {scan.dmsFired && !scan.userMarkedSafe && (
                <div className="flex items-center gap-2 px-3 py-1.5 bg-red-500/20 border border-red-500/30 rounded-lg">
                    <Siren className="w-3.5 h-3.5 text-red-400" />
                    <p className="text-xs text-red-300">Emergency report sent to trusted contacts</p>
                </div>
            )}

            <div className="grid grid-cols-2 gap-2 pt-1">
                <button onClick={() => onViewDetail(scan)}
                    className="flex items-center justify-center gap-1.5 px-3 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-100 rounded-lg text-xs font-semibold transition-colors col-span-2">
                    <Eye className="w-3.5 h-3.5" /> View Details
                </button>

                {isHighRisk && !scan.userMarkedSafe && (
                    <>
                        <button onClick={() => onEmergency(scan)}
                            className="flex items-center justify-center gap-1.5 px-3 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg text-xs font-bold transition-colors">
                            <Siren className="w-3.5 h-3.5" /> Emergency!
                        </button>
                        <button onClick={() => onMarkSafe(scan.id)}
                            className="flex items-center justify-center gap-1.5 px-3 py-2 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-lg text-xs font-semibold transition-colors">
                            <Heart className="w-3.5 h-3.5" /> I'm Safe
                        </button>
                    </>
                )}

                {!scan.autoCaseCreated && (
                    <button onClick={() => onCreateCase(scan)}
                        className="flex items-center justify-center gap-1.5 px-3 py-2 bg-purple-500/10 hover:bg-purple-500/20 text-purple-400 border border-purple-500/30 rounded-lg text-xs font-semibold transition-colors col-span-2">
                        <FolderPlus className="w-3.5 h-3.5" /> Create Case Manually
                    </button>
                )}

                {/* Remove scan result */}
                <button onClick={() => onDelete(scan.id)}
                    className="flex items-center justify-center gap-1.5 px-3 py-2 bg-zinc-800/80 hover:bg-red-500/10 text-zinc-500 hover:text-red-400 border border-zinc-700/50 hover:border-red-500/30 rounded-lg text-xs font-semibold transition-colors col-span-2">
                    <Trash2 className="w-3 h-3" /> Remove Scan
                </button>
            </div>
        </div>
    );
}

// ─── Detail Modal ─────────────────────────────────────────────────────────────
function ScanDetailModal({ scan, onClose, onCreateCase, onEmergency, onMarkSafe }: {
    scan: ScannedConversation;
    onClose: () => void;
    onCreateCase: (s: ScannedConversation) => void;
    onEmergency: (s: ScannedConversation) => void;
    onMarkSafe: (id: string) => void;
}) {
    const colors = getRiskColor(scan.riskLevel);
    const cfg = PLATFORM_CONFIG[scan.platform];
    const isHighRisk = scan.riskLevel >= 8;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={onClose}>
            <div className="bg-zinc-900 border border-zinc-700 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl"
                onClick={e => e.stopPropagation()}>
                <div className="sticky top-0 bg-zinc-900/95 backdrop-blur border-b border-zinc-800 p-5 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <span className="text-2xl">{cfg.icon}</span>
                        <div>
                            <h2 className="font-bold text-zinc-100">{scan.contactName}</h2>
                            <p className="text-xs text-zinc-500">{scan.platform} · {scan.contactHandle}</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-zinc-800 rounded-lg transition-colors">
                        <X className="w-4 h-4 text-zinc-400" />
                    </button>
                </div>

                <div className="p-5 space-y-5">
                    <div className={`p-4 rounded-xl border ${colors.bg} ${colors.border}`}>
                        <p className={`font-bold text-lg ${colors.text}`}>Risk Level: {scan.riskLevel}/10 — {getRiskLabel(scan.riskLevel)}</p>
                        <p className="text-sm text-zinc-300 mt-1">{scan.riskSummary}</p>
                    </div>

                    {/* Quick Actions */}
                    <div className="flex flex-wrap gap-2">
                        {isHighRisk && !scan.userMarkedSafe && (
                            <>
                                <button onClick={() => { onEmergency(scan); onClose(); }}
                                    className="flex items-center gap-2 px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg text-sm font-bold transition-colors">
                                    <Siren className="w-4 h-4" /> Trigger Emergency Now
                                </button>
                                <button onClick={() => { onMarkSafe(scan.id); onClose(); }}
                                    className="flex items-center gap-2 px-4 py-2 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-lg text-sm font-semibold transition-colors">
                                    <Heart className="w-4 h-4" /> I'm Safe — Disarm DMS
                                </button>
                            </>
                        )}
                        {!scan.autoCaseCreated && (
                            <button onClick={() => { onCreateCase(scan); onClose(); }}
                                className="flex items-center gap-2 px-4 py-2 bg-purple-500/10 hover:bg-purple-500/20 text-purple-400 border border-purple-500/30 rounded-lg text-sm font-semibold transition-colors">
                                <FolderPlus className="w-4 h-4" /> Create Case from Scan
                            </button>
                        )}
                    </div>

                    {scan.detectedThreats.length > 0 && (
                        <div>
                            <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2">Detected Threats</p>
                            <div className="space-y-1.5">
                                {scan.detectedThreats.map((t, i) => (
                                    <div key={i} className="flex items-center gap-2 px-3 py-2 bg-red-500/10 border border-red-500/20 rounded-lg">
                                        <AlertTriangle className="w-3.5 h-3.5 text-red-400 flex-shrink-0" />
                                        <span className="text-sm text-red-300">{t}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    <div>
                        <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2">Recommendations</p>
                        <div className="space-y-1.5">
                            {scan.recommendations.map((r, i) => (
                                <div key={i} className="flex items-center gap-2 px-3 py-2 bg-zinc-800 rounded-lg">
                                    <ChevronRight className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                                    <span className="text-sm text-zinc-300">{r}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div>
                        <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2">Preserved Chat Messages ({scan.messages.length})</p>
                        <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                            {scan.messages.map((msg, i) => (
                                <div key={i} className={`flex ${msg.direction === 'outgoing' ? 'justify-end' : 'justify-start'}`}>
                                    <div className={`max-w-[80%] px-3 py-2 rounded-xl text-sm ${msg.direction === 'outgoing'
                                        ? 'bg-emerald-500/20 text-emerald-100 rounded-br-sm'
                                        : 'bg-zinc-800 text-zinc-200 rounded-bl-sm'}`}>
                                        <p className="font-medium text-xs opacity-60 mb-0.5">{msg.sender}</p>
                                        <p>{msg.content}</p>
                                        <p className="text-xs opacity-40 mt-1 text-right">{new Date(msg.timestamp).toLocaleTimeString()}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    <p className="text-xs text-zinc-500 border-t border-zinc-800 pt-3">
                        Scanned: {new Date(scan.scannedAt).toLocaleString()} · Source: {scan.aiAnalysisSource}
                    </p>
                </div>
            </div>
        </div>
    );
}

// ─── Connect Modal ────────────────────────────────────────────────────────────
function ConnectModal({ onClose, onConnect }: { onClose: () => void; onConnect: (p: Platform, h: string) => void }) {
    const [platform, setPlatform] = useState<Platform>('WhatsApp');
    const [handle, setHandle] = useState('');
    const platforms = Object.keys(PLATFORM_CONFIG) as Platform[];

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={onClose}>
            <div className="bg-zinc-900 border border-zinc-700 rounded-2xl w-full max-w-md shadow-2xl" onClick={e => e.stopPropagation()}>
                <div className="p-5 border-b border-zinc-800 flex items-center justify-between">
                    <h2 className="font-bold text-zinc-100">Connect Social Account</h2>
                    <button onClick={onClose} className="p-2 hover:bg-zinc-800 rounded-lg"><X className="w-4 h-4 text-zinc-400" /></button>
                </div>
                <div className="p-5 space-y-4">
                    <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg flex gap-2">
                        <Info className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
                        <p className="text-xs text-amber-300"><strong>Demo Mode:</strong> No real OAuth required. Platform-specific threats are simulated for hackathon demo purposes.</p>
                    </div>

                    <div>
                        <label className="block text-xs font-semibold text-zinc-400 mb-2">Platform</label>
                        <div className="grid grid-cols-2 gap-2">
                            {platforms.map(p => {
                                const cfg = PLATFORM_CONFIG[p];
                                return (
                                    <button key={p} onClick={() => setPlatform(p)}
                                        className={`flex items-center gap-2 px-3 py-2.5 rounded-lg border text-sm font-medium transition-all ${platform === p ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-300' : 'border-zinc-700 bg-zinc-800 text-zinc-400 hover:border-zinc-600'}`}>
                                        <span>{cfg.icon}</span>{p}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-semibold text-zinc-400 mb-2">{PLATFORM_CONFIG[platform].fieldLabel}</label>
                        <input type="text" value={handle} onChange={e => setHandle(e.target.value)}
                            placeholder={`Enter your ${PLATFORM_CONFIG[platform].fieldLabel.toLowerCase()}...`}
                            className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2.5 text-zinc-100 focus:outline-none focus:border-emerald-500 text-sm" />
                    </div>

                    <div className="flex gap-2">
                        <button onClick={onClose} className="flex-1 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg text-sm font-semibold transition-colors">Cancel</button>
                        <button onClick={() => { if (handle.trim()) { onConnect(platform, handle.trim()); onClose(); } }}
                            disabled={!handle.trim()}
                            className="flex-1 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-zinc-950 rounded-lg text-sm font-bold transition-colors disabled:opacity-50">
                            Grant Permission
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function SocialMonitoringPage({ user }: { user?: any }) {
    const [accounts, setAccounts] = useState<ConnectedAccount[]>([]);
    const [scans, setScans] = useState<ScannedConversation[]>([]);
    const [alerts, setAlerts] = useState<SafetyAlert[]>([]);
    const [settings, setSettings] = useState<MonitorSettings>(getMonitorSettings());
    const [scanning, setScanning] = useState(false);
    const [showConnect, setShowConnect] = useState(false);
    const [selectedScan, setSelectedScan] = useState<ScannedConversation | null>(null);
    const [activeTab, setActiveTab] = useState<'overview' | 'scans' | 'alerts' | 'settings'>('overview');
    const [scanProgress, setScanProgress] = useState(0);
    const [scansCollapsed, setScansCollapsed] = useState(false);
    const [scansShowAll, setScansShowAll] = useState(false);
    const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' | 'info' } | null>(null);

    const showToast = (msg: string, type: 'success' | 'error' | 'info' = 'success') => {
        setToast({ msg, type });
        setTimeout(() => setToast(null), 4000);
    };

    const refresh = useCallback(() => {
        setAccounts(getConnectedAccounts());
        setScans(getAllScans());
        setAlerts(getAllAlerts());
        setSettings(getMonitorSettings());
    }, []);

    useEffect(() => { refresh(); }, [refresh]);

    // Helper: get the correct RBAC user so createdBy/Email match getCasesForUser
    const getRbacUser = () => {
        const appUser = getCurrentAppUser();
        return {
            id: appUser?.id || user?.uid || 'system',
            email: appUser?.email || user?.email || 'system@evidencevault',
        };
    };

    // Helper: dispatch event so Dashboard.tsx re-reads localStorage immediately
    const notifyDashboard = () => window.dispatchEvent(new Event('ev:case-created'));

    // DMS countdown ticker
    useEffect(() => {
        const interval = setInterval(() => {
            const highRisk = getAllScans().filter(s => s.riskLevel >= 8 && !s.userMarkedSafe && s.dmsTriggerAt && !s.dmsFired);
            highRisk.forEach(s => {
                const remaining = Math.max(0, Math.ceil((new Date(s.dmsTriggerAt!).getTime() - Date.now()) / 60000));
                if (remaining === 0 && !s.dmsFired) {
                    updateScan(s.id, { dmsFired: true });
                    createAlert({
                        conversationId: s.id, platform: s.platform, contactName: s.contactName,
                        riskLevel: s.riskLevel,
                        message: `⚠️ Dead Man's Switch FIRED for ${s.contactName} on ${s.platform}. Report auto-sent via Ethereal Email.`,
                    });
                    fetch('/api/social-monitor/dms-fire', {
                        method: 'POST', headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ scanId: s.id, contactName: s.contactName, platform: s.platform, riskLevel: s.riskLevel }),
                    }).catch(() => { });
                    refresh();
                }
            });
        }, 30000);
        return () => clearInterval(interval);
    }, [refresh]);

    useEffect(() => {
        if (settings.notificationsEnabled && 'Notification' in window && Notification.permission === 'default') {
            Notification.requestPermission();
        }
    }, [settings.notificationsEnabled]);

    const sendBrowserNotification = (title: string, body: string) => {
        if ('Notification' in window && Notification.permission === 'granted') {
            new Notification(title, { body, icon: '/favicon.ico' });
        }
    };

    // ── DELETE SCAN ─────────────────────────────────────────────────────
    const handleDeleteScan = (scanId: string) => {
        const scan = scans.find(s => s.id === scanId);
        const label = scan ? `${scan.platform} — ${scan.contactName}` : scanId;
        if (!window.confirm(`Remove scanned result for "${label}"? This cannot be undone.`)) return;
        deleteScan(scanId);
        refresh();
        showToast('Scan result removed.', 'info');
    };

    // ── EMERGENCY TRIGGER (bypasses DMS timer) ────────────────────────────────
    const handleEmergency = async (scan: ScannedConversation) => {
        const rbac = getRbacUser();

        // 1. Create case immediately if not already
        let caseId = scan.autoCaseId;
        if (!scan.autoCaseCreated) {
            const newCase = createManagedCase({
                title: `[EMERGENCY] ${scan.platform} — ${scan.contactName}`,
                description: scan.riskSummary,
                createdBy: rbac.id,
                createdByEmail: rbac.email,
                priority: 'Critical',
            });
            caseId = newCase.caseId;
            updateScan(scan.id, { autoCaseCreated: true, autoCaseId: caseId, dmsFired: true });
            appendAuditEntry(caseId, 'case_created', rbac.email, 'system',
                `🚨 EMERGENCY case from ${scan.platform} monitoring — Risk ${scan.riskLevel}/10`);
            // Attach chat transcript as evidence in the case
            attachChatEvidenceToCase(caseId, scan, rbac.email);
            notifyDashboard(); // <-- instant Dashboard refresh
        } else {
            updateScan(scan.id, { dmsFired: true });
        }

        // 2. Fire DMS immediately (no timer)
        let previewUrl: string | null = null;
        let emailOk = false;
        try {
            const resp = await fetch('/api/social-monitor/dms-fire', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    scanId: scan.id, contactName: scan.contactName,
                    platform: scan.platform, riskLevel: scan.riskLevel, isEmergency: true,
                }),
            });
            const data = await resp.json().catch(() => ({}));
            previewUrl = data.previewUrl || null;
            emailOk = true;
        } catch {
            emailOk = false;
        }

        // 3. Create in-app alert with preview link
        createAlert({
            conversationId: scan.id, platform: scan.platform, contactName: scan.contactName,
            riskLevel: scan.riskLevel,
            message: `🚨 EMERGENCY for ${scan.contactName} on ${scan.platform}. Case ${caseId} created. Email ${emailOk ? 'sent' : 'FAILED'}.${previewUrl ? ` ⭐ Preview: ${previewUrl}` : ''}`,
        });

        // 4. Show toast with Ethereal link
        if (emailOk && previewUrl) {
            showToast(`🚨 Emergency triggered! Case created. ⭐ Email preview ready — check Alerts tab.`, 'error');
        } else if (emailOk) {
            showToast(`🚨 Emergency triggered! Case created. Email sent to trusted contacts.`, 'error');
        } else {
            showToast(`Case created. Email send failed — check server logs.`, 'info');
        }

        sendBrowserNotification('🚨 Emergency Triggered',
            `Case created + contacts alerted: ${scan.contactName} on ${scan.platform}`);
        refresh();
    };

    // ── CREATE CASE MANUALLY ─────────────────────────────────────────────────
    const handleCreateCase = (scan: ScannedConversation) => {
        if (scan.autoCaseCreated) { showToast('A case already exists for this scan.', 'info'); return; }
        const rbac = getRbacUser();
        const newCase = createManagedCase({
            title: `[Social Monitor] ${scan.platform} — ${scan.contactName}`,
            description: scan.riskSummary,
            createdBy: rbac.id,
            createdByEmail: rbac.email,
            priority: scan.riskLevel >= 9 ? 'Critical' : scan.riskLevel >= 7 ? 'High' : scan.riskLevel >= 5 ? 'Medium' : 'Low',
        });
        updateScan(scan.id, { autoCaseCreated: true, autoCaseId: newCase.caseId });
        appendAuditEntry(newCase.caseId, 'case_created', rbac.email, 'user',
            `Manually created from social monitoring — Risk ${scan.riskLevel}/10 on ${scan.platform}`);
        // Attach chat transcript as evidence in the case
        attachChatEvidenceToCase(newCase.caseId, scan, rbac.email);
        createAlert({
            conversationId: scan.id, platform: scan.platform, contactName: scan.contactName,
            riskLevel: scan.riskLevel,
            message: `📁 Case ${newCase.caseId} manually created from ${scan.platform} scan of ${scan.contactName}. Check My Cases.`,
        });
        notifyDashboard(); // <-- instant Dashboard refresh
        showToast(`✅ Case created: ${newCase.caseId} — visible in My Cases now!`, 'success');
        refresh();
    };

    const runScan = async () => {
        if (accounts.filter(a => a.isActive).length === 0) {
            showToast('Connect at least one account first.', 'info'); return;
        }
        setScanning(true); setScanProgress(0);
        const active = accounts.filter(a => a.isActive);
        const scanSettings = getMonitorSettings();
        const rbacAuto = getRbacUser(); // resolve once for the whole scan batch

        for (let i = 0; i < active.length; i++) {
            const acc = active[i];
            const numConvos = 2 + (i % 2);
            for (let j = 0; j < numConvos; j++) {
                setScanProgress(Math.round(((i * numConvos + j) / (active.length * numConvos)) * 85));
                await new Promise(r => setTimeout(r, 400));
                const scan = generateDemoScan(acc.id, acc.platform, j + i);

                if (scan.riskLevel >= scanSettings.autoCreateCaseThreshold && !scan.autoCaseCreated) {
                    const newCase = createManagedCase({
                        title: `[AUTO] ${scan.platform} Threat — ${scan.contactName}`,
                        description: scan.riskSummary,
                        createdBy: rbacAuto.id,
                        createdByEmail: rbacAuto.email,
                        priority: scan.riskLevel >= 9 ? 'Critical' : 'High',
                    });
                    scan.autoCaseCreated = true;
                    scan.autoCaseId = newCase.caseId;
                    scan.dmsTriggerAt = new Date(Date.now() + scanSettings.dmsTimeoutMinutes * 60 * 1000).toISOString();
                    appendAuditEntry(newCase.caseId, 'case_created', rbacAuto.email, 'system', `Auto-created from social monitoring — Risk ${scan.riskLevel}/10 on ${scan.platform}`);
                    // Attach chat transcript as evidence
                    attachChatEvidenceToCase(newCase.caseId, scan, rbacAuto.email);
                    notifyDashboard();
                }
                saveScan(scan);

                if (scan.riskLevel >= 7) {
                    createAlert({
                        conversationId: scan.id, platform: scan.platform, contactName: scan.contactName,
                        riskLevel: scan.riskLevel,
                        message: `${PLATFORM_CONFIG[scan.platform].icon} ${scan.platform}: Risk ${scan.riskLevel}/10 from ${scan.contactName}. ${scan.riskSummary.slice(0, 100)}...`,
                    });
                    if (settings.notificationsEnabled) {
                        sendBrowserNotification(`⚠️ Threat — ${scan.platform}`, `Risk ${scan.riskLevel}/10: ${scan.contactName}`);
                    }
                }
            }
            const updatedAccounts = getConnectedAccounts().map(a =>
                a.id === acc.id ? { ...a, lastScanned: new Date().toISOString() } : a
            );
            localStorage.setItem('ev_social_accounts', JSON.stringify(updatedAccounts));
        }

        setScanProgress(100);
        setTimeout(() => { setScanning(false); setScanProgress(0); refresh(); showToast('Scan complete!', 'success'); }, 600);
    };

    const handleMarkSafe = (scanId: string) => {
        const scan = scans.find(s => s.id === scanId);
        updateScan(scanId, { userMarkedSafe: true, dmsTriggerAt: null });
        createAlert({
            conversationId: scanId,
            platform: scan?.platform || 'WhatsApp',
            contactName: scan?.contactName || '',
            riskLevel: 1 as RiskLevel,
            message: `✅ You marked yourself safe. Dead Man's Switch disarmed for ${scan?.contactName}.`,
        });
        showToast("✅ Safe confirmed. DMS disarmed.", 'success');
        refresh();
    };

    const handleConnect = (platform: Platform, handle: string) => { connectAccount(platform, handle); refresh(); };
    const toggleMonitoring = () => {
        const updated = { ...settings, enabled: !settings.enabled };
        saveMonitorSettings(updated); setSettings(updated);
    };

    const highRiskCount = scans.filter(s => s.riskLevel >= 8 && !s.userMarkedSafe).length;
    const unreadAlerts = alerts.filter(a => !a.read).length;
    const activeAccounts = accounts.filter(a => a.isActive).length;
    const highRiskScans = getHighRiskScans();
    const PREVIEW_LIMIT = 4;

    return (
        <div className="p-6 space-y-6 max-w-6xl mx-auto">
            {/* Toast */}
            {toast && (
                <div className={`fixed top-4 right-4 z-50 flex items-center gap-3 px-4 py-3 rounded-xl shadow-xl border text-sm font-semibold max-w-sm transition-all ${toast.type === 'error' ? 'bg-red-500/20 border-red-500/40 text-red-200' :
                    toast.type === 'info' ? 'bg-blue-500/20 border-blue-500/40 text-blue-200' :
                        'bg-emerald-500/20 border-emerald-500/40 text-emerald-200'
                    }`}>
                    <span className="flex-1">{toast.msg}</span>
                    <button onClick={() => setToast(null)}><X className="w-4 h-4 opacity-60" /></button>
                </div>
            )}

            {/* Header */}
            <div className="flex items-start justify-between gap-4 flex-wrap">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center">
                        <Radar className="w-5 h-5 text-purple-400" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-zinc-100">Social Monitor</h1>
                        <p className="text-sm text-zinc-500">AI-powered chat monitoring & safety alerts</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <button onClick={() => setActiveTab('alerts')} className="relative p-2.5 bg-zinc-800 hover:bg-zinc-700 rounded-lg transition-colors">
                        <Bell className="w-4 h-4 text-zinc-400" />
                        {unreadAlerts > 0 && (
                            <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-xs rounded-full flex items-center justify-center font-bold">
                                {unreadAlerts > 9 ? '9+' : unreadAlerts}
                            </span>
                        )}
                    </button>
                    <button onClick={toggleMonitoring}
                        className={`flex items-center gap-2 px-4 py-2.5 rounded-lg font-semibold text-sm transition-all ${settings.enabled
                            ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20'
                            : 'bg-zinc-800 border border-zinc-700 text-zinc-400 hover:bg-zinc-700'}`}>
                        {settings.enabled ? <Wifi className="w-4 h-4" /> : <WifiOff className="w-4 h-4" />}
                        {settings.enabled ? 'Monitoring Active' : 'Monitoring Off'}
                    </button>
                </div>
            </div>

            {/* High Risk Banner */}
            {highRiskCount > 0 && (
                <div className="flex items-center gap-3 p-4 bg-red-500/10 border border-red-500/30 rounded-xl">
                    <ShieldAlert className="w-5 h-5 text-red-400 flex-shrink-0 animate-pulse" />
                    <div className="flex-1">
                        <p className="font-bold text-red-300">{highRiskCount} HIGH-RISK conversation{highRiskCount > 1 ? 's' : ''} detected</p>
                        <p className="text-sm text-red-400/80">Use <strong>Emergency!</strong> to instantly alert contacts, or <strong>I'm Safe</strong> to disarm the DMS.</p>
                    </div>
                    <button onClick={() => setActiveTab('scans')} className="px-3 py-1.5 bg-red-500 hover:bg-red-600 text-white rounded-lg text-xs font-bold transition-colors whitespace-nowrap">
                        Review Now
                    </button>
                </div>
            )}

            {/* Tabs */}
            <div className="flex gap-1 bg-zinc-900 border border-zinc-800 rounded-xl p-1">
                {(['overview', 'scans', 'alerts', 'settings'] as const).map(tab => (
                    <button key={tab} onClick={() => setActiveTab(tab)}
                        className={`flex-1 py-2 px-3 rounded-lg text-sm font-semibold capitalize transition-all ${activeTab === tab ? 'bg-zinc-700 text-zinc-100' : 'text-zinc-500 hover:text-zinc-300'}`}>
                        {tab === 'alerts' && unreadAlerts > 0 ? `Alerts (${unreadAlerts})` : tab.charAt(0).toUpperCase() + tab.slice(1)}
                    </button>
                ))}
            </div>

            {/* ── OVERVIEW ── */}
            {activeTab === 'overview' && (
                <div className="space-y-6">
                    {/* Stats */}
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                        {[
                            { label: 'Connected Accounts', value: accounts.length, sub: `${activeAccounts} active`, icon: Wifi, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
                            { label: 'Conversations Scanned', value: scans.length, sub: 'total monitored', icon: MessageSquare, color: 'text-blue-400', bg: 'bg-blue-500/10' },
                            { label: 'High Risk', value: highRiskCount, sub: 'pending action', icon: AlertTriangle, color: 'text-red-400', bg: 'bg-red-500/10' },
                            { label: 'Alerts', value: unreadAlerts, sub: 'unread', icon: Bell, color: 'text-purple-400', bg: 'bg-purple-500/10' },
                        ].map((stat, i) => (
                            <div key={i} className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
                                <div className={`w-9 h-9 rounded-lg ${stat.bg} flex items-center justify-center mb-3`}>
                                    <stat.icon className={`w-4 h-4 ${stat.color}`} />
                                </div>
                                <p className={`text-2xl font-black ${stat.color}`}>{stat.value}</p>
                                <p className="text-xs font-semibold text-zinc-300">{stat.label}</p>
                                <p className="text-xs text-zinc-500">{stat.sub}</p>
                            </div>
                        ))}
                    </div>

                    {/* Connected Accounts */}
                    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 space-y-4">
                        <div className="flex items-center justify-between">
                            <h2 className="font-bold text-zinc-100">Connected Accounts</h2>
                            <button onClick={() => setShowConnect(true)}
                                className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-zinc-950 rounded-lg text-xs font-bold transition-colors">
                                + Connect Account
                            </button>
                        </div>
                        {accounts.length === 0 ? (
                            <div className="text-center py-8">
                                <Wifi className="w-10 h-10 text-zinc-700 mx-auto mb-3" />
                                <p className="text-zinc-400 font-semibold">No accounts connected</p>
                                <p className="text-sm text-zinc-500 mb-4">Connect your social accounts to start monitoring</p>
                                <button onClick={() => setShowConnect(true)} className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-zinc-950 rounded-lg text-sm font-bold transition-colors">Connect First Account</button>
                            </div>
                        ) : (
                            <div className="space-y-2">
                                {accounts.map(acc => {
                                    const cfg = PLATFORM_CONFIG[acc.platform];
                                    return (
                                        <div key={acc.id} className="flex items-center gap-3 p-3 bg-zinc-800/50 rounded-lg border border-zinc-700/50">
                                            <span className="text-xl">{cfg.icon}</span>
                                            <div className="flex-1 min-w-0">
                                                <p className="font-semibold text-zinc-100 text-sm">{acc.platform}</p>
                                                <p className="text-xs text-zinc-500 truncate">{acc.handle} · {acc.lastScanned ? `Scanned: ${new Date(acc.lastScanned).toLocaleTimeString()}` : 'Not scanned'}</p>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <button onClick={() => { toggleAccountActive(acc.id); refresh(); }}
                                                    className={`px-2 py-1 rounded text-xs font-semibold transition-colors ${acc.isActive ? 'bg-emerald-500/10 text-emerald-400' : 'bg-zinc-700 text-zinc-500'}`}>
                                                    {acc.isActive ? 'Active' : 'Paused'}
                                                </button>
                                                <button onClick={() => { disconnectAccount(acc.id); refresh(); }}
                                                    className="p-1.5 hover:bg-red-500/10 rounded text-zinc-500 hover:text-red-400 transition-colors">
                                                    <UserX className="w-3.5 h-3.5" />
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    {/* Scan Controls */}
                    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
                        <div className="flex items-center justify-between mb-4">
                            <div>
                                <h2 className="font-bold text-zinc-100">Run Scan</h2>
                                <p className="text-sm text-zinc-500">AI analyzes all connected accounts for threats</p>
                            </div>
                            <button onClick={runScan} disabled={scanning || activeAccounts === 0}
                                className="flex items-center gap-2 px-4 py-2.5 bg-purple-500 hover:bg-purple-600 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg font-semibold text-sm transition-colors">
                                {scanning ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                                {scanning ? `Scanning... ${scanProgress}%` : 'Start Scan'}
                            </button>
                        </div>
                        {scanning && (
                            <div className="w-full bg-zinc-800 rounded-full h-2">
                                <div className="bg-purple-500 h-2 rounded-full transition-all duration-300" style={{ width: `${scanProgress}%` }} />
                            </div>
                        )}
                    </div>

                    {/* High-Risk Scans with collapse/expand */}
                    {highRiskScans.length > 0 && (
                        <div className="space-y-3">
                            <div className="flex items-center justify-between">
                                <h2 className="font-bold text-zinc-100">Urgent — High Risk ({highRiskScans.length})</h2>
                                <div className="flex items-center gap-2">
                                    {highRiskScans.length > PREVIEW_LIMIT && !scansCollapsed && (
                                        <button onClick={() => setScansShowAll(v => !v)}
                                            className="text-xs text-purple-400 hover:text-purple-300 flex items-center gap-1">
                                            {scansShowAll ? <><ChevronUp className="w-3 h-3" /> View Less</> : <><ChevronDown className="w-3 h-3" /> View All ({highRiskScans.length})</>}
                                        </button>
                                    )}
                                    <button onClick={() => setScansCollapsed(v => !v)}
                                        className="text-xs text-zinc-500 hover:text-zinc-300 flex items-center gap-1">
                                        {scansCollapsed ? <><ChevronDown className="w-3 h-3" /> Expand</> : <><ChevronUp className="w-3 h-3" /> Collapse</>}
                                    </button>
                                </div>
                            </div>
                            {!scansCollapsed && (
                                <div className="grid gap-3 md:grid-cols-2">
                                    {(scansShowAll ? highRiskScans : highRiskScans.slice(0, PREVIEW_LIMIT)).map(scan => (
                                        <ScanCard key={scan.id} scan={scan}
                                            onViewDetail={setSelectedScan}
                                            onMarkSafe={handleMarkSafe}
                                            onCreateCase={handleCreateCase}
                                            onEmergency={handleEmergency}
                                            onDelete={handleDeleteScan}
                                            user={user} />
                                    ))}
                                </div>
                            )}
                            {scansCollapsed && (
                                <p className="text-sm text-zinc-500 italic">Section collapsed — {highRiskScans.length} threat(s) hidden.</p>
                            )}
                        </div>
                    )}
                </div>
            )}

            {/* ── SCANS TAB ── */}
            {activeTab === 'scans' && (
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <p className="text-sm text-zinc-400">{scans.length} conversations scanned</p>
                        <button onClick={runScan} disabled={scanning || activeAccounts === 0}
                            className="flex items-center gap-2 px-3 py-2 bg-purple-500 hover:bg-purple-600 disabled:opacity-50 text-white rounded-lg text-sm font-semibold transition-colors">
                            {scanning ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />}
                            {scanning ? 'Scanning...' : 'Rescan'}
                        </button>
                    </div>
                    {scans.length === 0 ? (
                        <div className="text-center py-16">
                            <Radar className="w-12 h-12 text-zinc-700 mx-auto mb-4" />
                            <p className="text-zinc-400 font-semibold mb-2">No scans yet</p>
                            <p className="text-sm text-zinc-500">Connect accounts and run a scan</p>
                        </div>
                    ) : (
                        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                            {[...scans].sort((a, b) => b.riskLevel - a.riskLevel).map(scan => (
                                <ScanCard key={scan.id} scan={scan}
                                    onViewDetail={setSelectedScan}
                                    onMarkSafe={handleMarkSafe}
                                    onCreateCase={handleCreateCase}
                                    onEmergency={handleEmergency}
                                    onDelete={handleDeleteScan}
                                    user={user} />
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* ── ALERTS TAB ── */}
            {activeTab === 'alerts' && (
                <div className="space-y-4">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                        <p className="text-sm text-zinc-400">{alerts.length} alerts · {unreadAlerts} unread</p>
                        <div className="flex items-center gap-2">
                            {unreadAlerts > 0 && (
                                <button onClick={() => { markAllAlertsRead(); refresh(); }}
                                    className="text-xs text-purple-400 hover:text-purple-300 flex items-center gap-1">
                                    <BellOff className="w-3 h-3" /> Mark all read
                                </button>
                            )}
                            {alerts.filter(a => a.read).length > 0 && (
                                <button onClick={() => { deleteAllReadAlerts(); refresh(); showToast('Read alerts cleared.', 'info'); }}
                                    className="text-xs text-red-400 hover:text-red-300 flex items-center gap-1">
                                    <Trash2 className="w-3 h-3" /> Clear read
                                </button>
                            )}
                        </div>
                    </div>
                    {alerts.length === 0 ? (
                        <div className="text-center py-16">
                            <Bell className="w-12 h-12 text-zinc-700 mx-auto mb-4" />
                            <p className="text-zinc-400 font-semibold">No alerts yet</p>
                            <p className="text-sm text-zinc-500">Safety alerts appear here when threats are detected</p>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {alerts.map(alert => {
                                const colors = getRiskColor(alert.riskLevel);
                                return (
                                    <div key={alert.id}
                                        className={`flex items-start gap-3 p-4 rounded-xl border transition-all ${alert.read ? 'border-zinc-800 bg-zinc-900/30' : `${colors.border} ${colors.bg}`}`}>
                                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${colors.bg} border ${colors.border} cursor-pointer`}
                                            onClick={() => { markAlertRead(alert.id); refresh(); }}>
                                            {alert.riskLevel >= 8 ? <AlertTriangle className={`w-4 h-4 ${colors.text}`} /> : <Bell className={`w-4 h-4 ${colors.text}`} />}
                                        </div>
                                        <div className="flex-1 min-w-0 cursor-pointer" onClick={() => { markAlertRead(alert.id); refresh(); }}>
                                            <div className="flex items-start justify-between gap-2">
                                                <p className={`text-sm font-semibold ${alert.read ? 'text-zinc-300' : 'text-zinc-100'}`}>
                                                    {PLATFORM_CONFIG[alert.platform].icon} {alert.platform} — {alert.contactName}
                                                </p>
                                                {!alert.read && <div className="w-2 h-2 bg-purple-400 rounded-full mt-1.5 flex-shrink-0" />}
                                            </div>
                                            {/* Render message — linkify Ethereal preview URLs */}
                                            {(() => {
                                                const previewMatch = alert.message.match(/(https:\/\/ethereal\.email\S+)/);
                                                const msgBeforeUrl = previewMatch
                                                    ? alert.message.slice(0, alert.message.indexOf(previewMatch[1]))
                                                    : alert.message;
                                                return (
                                                    <div className="text-xs text-zinc-400 mt-0.5">
                                                        <p>{msgBeforeUrl}</p>
                                                        {previewMatch && (
                                                            <a href={previewMatch[1]} target="_blank" rel="noopener noreferrer"
                                                                className="inline-flex items-center gap-1 mt-1.5 px-2.5 py-1 bg-amber-500/10 border border-amber-500/30 text-amber-300 rounded-lg text-xs font-semibold hover:bg-amber-500/20 transition-colors"
                                                                onClick={e => e.stopPropagation()}>
                                                                ⭐ Open Ethereal Email Preview →
                                                            </a>
                                                        )}
                                                    </div>
                                                );
                                            })()}
                                            <p className="text-xs text-zinc-600 mt-1">{new Date(alert.createdAt).toLocaleString()}</p>
                                        </div>
                                        {/* Dismiss button */}
                                        <button onClick={() => { deleteAlert(alert.id); refresh(); showToast('Alert dismissed.', 'info'); }}
                                            className="p-1.5 hover:bg-red-500/10 rounded text-zinc-600 hover:text-red-400 transition-colors flex-shrink-0">
                                            <X className="w-3.5 h-3.5" />
                                        </button>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}

            {/* ── SETTINGS TAB ── */}
            {activeTab === 'settings' && (
                <div className="space-y-4">
                    {[
                        {
                            label: 'Monitoring Enabled', desc: 'Enable or disable all monitoring activity',
                            control: (
                                <button onClick={toggleMonitoring}
                                    className={`relative w-12 h-6 rounded-full transition-colors ${settings.enabled ? 'bg-emerald-500' : 'bg-zinc-700'}`}>
                                    <span className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${settings.enabled ? 'left-7' : 'left-1'}`} />
                                </button>
                            )
                        },
                        {
                            label: 'Push Notifications', desc: 'Browser notifications for high-risk alerts',
                            control: (
                                <button onClick={() => { const s = { ...settings, notificationsEnabled: !settings.notificationsEnabled }; saveMonitorSettings(s); setSettings(s); }}
                                    className={`relative w-12 h-6 rounded-full transition-colors ${settings.notificationsEnabled ? 'bg-emerald-500' : 'bg-zinc-700'}`}>
                                    <span className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${settings.notificationsEnabled ? 'left-7' : 'left-1'}`} />
                                </button>
                            )
                        },
                        {
                            label: 'Auto-Case Threshold', desc: 'Auto-create case when risk reaches this level',
                            control: (
                                <select value={settings.autoCreateCaseThreshold}
                                    onChange={e => { const s = { ...settings, autoCreateCaseThreshold: Number(e.target.value) as RiskLevel }; saveMonitorSettings(s); setSettings(s); }}
                                    className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-1.5 text-zinc-100 text-sm focus:outline-none focus:border-purple-500">
                                    {[6, 7, 8, 9, 10].map(v => <option key={v} value={v}>Level {v}+</option>)}
                                </select>
                            )
                        },
                        {
                            label: "Dead Man's Switch Timer", desc: 'Waiting period before auto-sending emergency report',
                            control: (
                                <select value={settings.dmsTimeoutMinutes}
                                    onChange={e => { const s = { ...settings, dmsTimeoutMinutes: Number(e.target.value) }; saveMonitorSettings(s); setSettings(s); }}
                                    className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-1.5 text-zinc-100 text-sm focus:outline-none focus:border-purple-500">
                                    {DMS_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                                </select>
                            )
                        },
                    ].map((row, i) => (
                        <div key={i} className="flex items-center justify-between p-4 bg-zinc-900 border border-zinc-800 rounded-xl">
                            <div>
                                <p className="font-semibold text-zinc-100">{row.label}</p>
                                <p className="text-sm text-zinc-500">{row.desc}</p>
                            </div>
                            {row.control}
                        </div>
                    ))}

                    <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-xl">
                        <div className="flex gap-2">
                            <Info className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" />
                            <div>
                                <p className="text-sm font-semibold text-blue-300 mb-1">Demo Mode Notice</p>
                                <p className="text-xs text-blue-300/80">Platform integrations are simulated. The Emergency button and Dead Man's Switch both use Ethereal Email in demo mode. Real deployment uses official OAuth APIs.</p>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Modals */}
            {showConnect && <ConnectModal onClose={() => setShowConnect(false)} onConnect={handleConnect} />}
            {selectedScan && (
                <ScanDetailModal scan={selectedScan} onClose={() => setSelectedScan(null)}
                    onCreateCase={handleCreateCase} onEmergency={handleEmergency} onMarkSafe={handleMarkSafe} />
            )}
        </div>
    );
}
