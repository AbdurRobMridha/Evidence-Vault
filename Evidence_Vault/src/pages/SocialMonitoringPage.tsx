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
    attachChatEvidenceToCase, attachAllContactEvidenceToCase,
} from '../lib/socialMonitorStore';
import { createManagedCase } from '../lib/caseStore';
import { appendAuditEntry } from '../lib/auditLog';
import { getCurrentAppUser } from '../lib/rbac';
import { createEmergencyAccessToken } from '../lib/emergencyAccessStore';

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
function ScanCard({ scan, onViewDetail, onMarkSafe, onCreateCase, onEmergency, onDelete, user, emergencyLoadingId }: {
    scan: ScannedConversation;
    onViewDetail: (s: ScannedConversation) => void;
    onMarkSafe: (scanId: string) => void;
    onCreateCase: (scan: ScannedConversation) => void;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onEmergency: (scan: ScannedConversation) => any;
    onDelete: (scanId: string) => void;
    user: any;
    emergencyLoadingId?: string | null;
}) {
    const isEmergencyLoading = emergencyLoadingId === scan.id;
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
                        <button
                            onClick={() => onEmergency(scan)}
                            disabled={isEmergencyLoading}
                            className="flex items-center justify-center gap-1.5 px-3 py-2 bg-red-500 hover:bg-red-600 disabled:opacity-60 disabled:cursor-wait text-white rounded-lg text-xs font-bold transition-colors"
                        >
                            {isEmergencyLoading
                                ? <><span className="w-3 h-3 border-2 border-white/40 border-t-white rounded-full animate-spin" />Sending…</>
                                : <><Siren className="w-3.5 h-3.5" />Emergency!</>}
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
    onEmergency: (s: ScannedConversation) => void | Promise<void>;
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
    const [emergencyLoadingId, setEmergencyLoadingId] = useState<string | null>(null);
    // scanId → client-side blob URL (in-session only, not persisted)
    const [previewUrls, setPreviewUrls] = useState<Record<string, string>>({});

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

    // ── BUILD CLIENT-SIDE EMAIL PREVIEW (Ethereal-mimic) ─────────────────
    const buildEmailPreviewHtml = (
        contactName: string, platform: string, riskLevel: number,
        caseId: string, accessLink: string, triggeredAt: string, rbacEmail: string
    ) => {
        return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8">
<title>🚨 Evidence Vault Emergency Alert</title>
<style>
  * { box-sizing:border-box; margin:0; padding:0; }
  body { background:#09090b; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
    min-height:100vh; display:flex; flex-direction:column; align-items:center; padding:40px 16px; }
  .badge { background:#18181b; border:1px solid #3f3f46; border-radius:8px; padding:8px 16px;
    color:#71717a; font-size:12px; margin-bottom:24px; text-align:center; }
  .email { background:#18181b; border:1px solid #27272a; border-radius:16px;
    max-width:640px; width:100%; overflow:hidden; }
  .hdr { background:rgba(239,68,68,.1); border-bottom:1px solid rgba(239,68,68,.2);
    padding:28px 28px 24px; text-align:center; }
  .hdr .emoji { font-size:40px; margin-bottom:12px; }
  .hdr h1 { color:#ef4444; font-size:24px; font-weight:800; margin-bottom:8px; }
  .hdr p { color:#fca5a5; font-size:14px; line-height:1.6; }
  .body { padding:28px; }
  table.details { width:100%; border-collapse:collapse; background:#0f0f11;
    border:1px solid #27272a; border-radius:12px; overflow:hidden; margin-bottom:24px; }
  table.details tr { border-bottom:1px solid #27272a; }
  table.details tr:last-child { border:none; }
  table.details td { padding:13px 18px; font-size:13px; }
  table.details td:first-child { color:#71717a; width:130px; font-weight:600;
    text-transform:uppercase; letter-spacing:.05em; }
  table.details td:last-child { color:#e4e4e7; font-weight:500; }
  .risk-badge { color:#ef4444; font-weight:800; font-size:17px; }
  .risk-label { background:rgba(239,68,68,.13); color:#fca5a5; font-size:12px;
    font-weight:700; padding:2px 10px; border-radius:999px; margin-left:8px; }
  .case-mono { font-family:monospace; color:#a1a1aa; font-size:13px; }
  .access-box { background:linear-gradient(135deg,rgba(239,68,68,.09),rgba(220,38,38,.04));
    border:1.5px solid rgba(239,68,68,.35); border-radius:14px; padding:24px;
    text-align:center; margin-bottom:24px; }
  .access-box .label { color:#fca5a5; font-size:12px; font-weight:700;
    letter-spacing:.08em; text-transform:uppercase; margin-bottom:8px; }
  .access-box .desc { color:#a1a1aa; font-size:12px; line-height:1.7; margin-bottom:18px; }
  .access-btn { display:inline-block; background:#dc2626; color:#fff; font-weight:800;
    font-size:15px; padding:14px 32px; border-radius:10px; text-decoration:none;
    letter-spacing:.02em; box-shadow:0 4px 20px rgba(220,38,38,.4); }
  .access-url { margin-top:12px; color:#71717a; font-size:10px; word-break:break-all; }
  .steps { background:#0f0f11; border:1px solid #27272a; border-radius:12px;
    padding:20px 22px; margin-bottom:24px; }
  .steps .title { color:#a1a1aa; font-size:12px; font-weight:700;
    letter-spacing:.06em; text-transform:uppercase; margin-bottom:12px; }
  .steps ol { color:#a1a1aa; font-size:13px; line-height:1.9; padding-left:18px; }
  .legal { border-top:1px solid #27272a; padding-top:20px; color:#52525b;
    font-size:11px; line-height:1.8; }
  .legal p { margin-bottom:4px; }
  .footer { max-width:640px; width:100%; text-align:center; margin-top:20px;
    color:#3f3f46; font-size:11px; }
</style></head><body>
  <div class="badge">
    📧 Ethereal Demo Preview — This is what your trusted contact receives<br>
    Simulated delivery by <strong style="color:#a1a1aa">Evidence Vault</strong>
    &bull; <span id="ts" style="color:#a1a1aa">${triggeredAt}</span>
  </div>
  <div class="email">
    <div class="hdr">
      <div class="emoji">🚨</div>
      <h1>Dead Man's Switch Activated</h1>
      <p>Evidence Vault's Social Media Monitor detected a <strong>CRITICAL threat</strong>
      and the user did not respond in time. You have been designated as a trusted emergency contact.</p>
    </div>
    <div class="body">
      <table class="details">
        <tr><td>Platform</td><td><strong>${platform}</strong></td></tr>
        <tr><td>Contact</td><td>${contactName}</td></tr>
        <tr><td>Risk Level</td><td><span class="risk-badge">${riskLevel}/10</span><span class="risk-label">CRITICAL</span></td></tr>
        <tr><td>Case ID</td><td><span class="case-mono">${caseId}</span></td></tr>
        <tr><td>Sent By</td><td style="color:#a1a1aa">${rbacEmail}</td></tr>
        <tr><td>Triggered</td><td style="font-size:12px;color:#a1a1aa">${triggeredAt}</td></tr>
      </table>

      <div class="access-box">
        <div class="label">🔑 One-Time Secure Access Link</div>
        <div class="desc">
          This link grants you <strong style="color:#fca5a5">single-use, read-only access</strong>
          to the forensic case files, evidence attachments, and AI threat analysis reports.<br>
          <strong style="color:#ef4444">Expires 72 hours after issue &bull; Can only be used once.</strong>
        </div>
        <a href="${accessLink}" class="access-btn">🔓 Access Case Files &amp; Evidence →</a>
        <div class="access-url">Direct URL: ${accessLink}</div>
      </div>

      <div class="steps">
        <div class="title">📋 Recommended Actions</div>
        <ol>
          <li>Click the access link above to view the full case file and download all evidence.</li>
          <li>Verify file integrity using the SHA-256 hashes listed in the case details.</li>
          <li>Contact relevant authorities (police, legal counsel) and share the evidence package.</li>
          <li>Record that you received this email — it is timestamped and forms part of the chain of custody.</li>
        </ol>
      </div>

      <div class="legal">
        <p>• This message was generated automatically by Evidence Vault's Dead Man's Switch safety system.</p>
        <p>• All evidence files carry SHA-256 cryptographic hashes proving no tampering has occurred.</p>
        <p>• Your access of the case files will be permanently recorded in the immutable audit trail.</p>
        <p>• The one-time access link expires <strong style="color:#71717a">72 hours</strong> from issue time.</p>
      </div>
    </div>
  </div>
  <div class="footer">Evidence Vault &copy; ${new Date().getFullYear()} &bull; Demo Mode &bull; Encrypted in transit</div>
</body></html>`;
    };

    // ── EMERGENCY TRIGGER (bypasses DMS timer) ────────────────────────────────
    const handleEmergency = async (scan: ScannedConversation) => {
        if (emergencyLoadingId) return;
        setEmergencyLoadingId(scan.id);
        try {
            const rbac = getRbacUser();

            // 1. Create case
            let caseId = scan.autoCaseId;
            if (!scan.autoCaseCreated) {
                const newCase = createManagedCase({
                    title: `[EMERGENCY] ${scan.platform} — ${scan.contactName}`,
                    description: scan.riskSummary,
                    createdBy: rbac.id, createdByEmail: rbac.email, priority: 'Critical',
                });
                caseId = newCase.caseId;
                updateScan(scan.id, { autoCaseCreated: true, autoCaseId: caseId, dmsFired: true });
                appendAuditEntry(caseId, 'case_created', rbac.email, 'system',
                    `🚨 EMERGENCY case from ${scan.platform} — Risk ${scan.riskLevel}/10`);
                attachAllContactEvidenceToCase(caseId, scan, rbac.email);
                notifyDashboard();
            } else {
                caseId = scan.autoCaseId || `emergency-${Date.now()}`;
                updateScan(scan.id, { dmsFired: true });
            }

            // 2. One-time access token
            const accessTokenEntry = createEmergencyAccessToken(
                caseId, scan.platform, scan.contactName, scan.riskLevel, rbac.email
            );
            const accessLink = `${window.location.origin}/access/${accessTokenEntry.token}`;
            const triggeredAt = new Date().toUTCString();

            // 3. Build client-side email preview (always works, server-independent)
            const emailHtml = buildEmailPreviewHtml(
                scan.contactName, scan.platform, scan.riskLevel,
                caseId, accessLink, triggeredAt, rbac.email
            );
            const blob = new Blob([emailHtml], { type: 'text/html' });
            const clientPreviewUrl = URL.createObjectURL(blob);

            // 4. Try real Ethereal send in background (bonus — doesn't block UX)
            let serverPreviewUrl: string | null = null;
            fetch('/api/social-monitor/dms-fire', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    scanId: scan.id, contactName: scan.contactName,
                    platform: scan.platform, riskLevel: scan.riskLevel, isEmergency: true,
                    caseId, accessToken: accessTokenEntry.token, accessLink,
                }),
            }).then(r => r.json()).then(d => {
                if (d.previewUrl) serverPreviewUrl = d.previewUrl;
            }).catch(() => { /* silent — client preview is primary */ });

            // 5. Save preview URL keyed by scan.id (used by Alerts tab)
            setPreviewUrls(prev => ({ ...prev, [scan.id]: clientPreviewUrl }));

            // 6. In-app alert + toast — stays on current tab
            createAlert({
                conversationId: scan.id, platform: scan.platform, contactName: scan.contactName,
                riskLevel: scan.riskLevel,
                message: `🚨 EMERGENCY — ${scan.contactName} on ${scan.platform}. Case ${caseId} created. Trusted contact alerted. Open the Alerts section to preview the sent email.`,
            });

            showToast(`🚨 Emergency triggered! Case created & trusted contact alerted.`, 'error');
            sendBrowserNotification('🚨 Emergency Alert Sent',
                `Case ${caseId} created for ${scan.contactName}. Trusted contact has been alerted.`);
            refresh();
        } catch (err: any) {
            console.error('[Emergency]', err);
            showToast(`❌ Emergency failed: ${err?.message || 'Unknown error'}`, 'error');
        } finally {
            setEmergencyLoadingId(null);
        }
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
        attachAllContactEvidenceToCase(newCase.caseId, scan, rbac.email);
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
                                            onViewDetail={(s: ScannedConversation): void => setSelectedScan(s)}
                                            onMarkSafe={handleMarkSafe}
                                            onCreateCase={handleCreateCase}
                                            onEmergency={handleEmergency}
                                            onDelete={handleDeleteScan}
                                            emergencyLoadingId={emergencyLoadingId}
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
                                    onViewDetail={(s: ScannedConversation): void => setSelectedScan(s)}
                                    onMarkSafe={handleMarkSafe}
                                    onCreateCase={handleCreateCase}
                                    onEmergency={handleEmergency}
                                    onDelete={handleDeleteScan}
                                    emergencyLoadingId={emergencyLoadingId}
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
                                            <div className="text-xs text-zinc-400 mt-1 space-y-1.5">
                                                <p>{alert.message}</p>
                                                {/* Emergency preview button — shown when this alert has a client-side preview URL */}
                                                {previewUrls[alert.conversationId] && (
                                                    <button
                                                        onClick={e => {
                                                            e.stopPropagation();
                                                            window.open(previewUrls[alert.conversationId], '_blank', 'noopener');
                                                        }}
                                                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-500/12 border border-amber-500/35 text-amber-300 hover:bg-amber-500/20 hover:border-amber-400/50 rounded-lg text-xs font-bold transition-all"
                                                    >
                                                        <span>⭐</span> Open Ethereal Email Preview →
                                                    </button>
                                                )}
                                            </div>
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
