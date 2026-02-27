import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
    Shield, ShieldAlert, Lock, Unlock, FileText, Download,
    AlertTriangle, CheckCircle, Clock, ExternalLink, Eye,
    FolderOpen, XCircle, Loader2, MessageSquare, User, Calendar
} from 'lucide-react';
import {
    validateAccessToken, consumeAccessToken,
    type EmergencyAccessToken,
} from '../lib/emergencyAccessStore';
import { getAllManagedCases, type ManagedCase } from '../lib/caseStore';
import { getEvidenceForCase } from '../lib/evidenceStore';
import { handleDownloadEvidence } from '../lib/evidenceDownload';
import { appendAuditEntry } from '../lib/auditLog';
import { format } from 'date-fns';

// ─── Status screen helper ──────────────────────────────────────────────────────

function StatusScreen({ icon, title, message, color = 'red', children }: {
    icon: React.ReactNode;
    title: string;
    message: string;
    color?: 'red' | 'amber' | 'emerald';
    children?: React.ReactNode;
}) {
    const colorMap = {
        red: { ring: 'border-red-500/30 bg-red-500/5', text: 'text-red-400' },
        amber: { ring: 'border-amber-500/30 bg-amber-500/5', text: 'text-amber-400' },
        emerald: { ring: 'border-emerald-500/30 bg-emerald-500/5', text: 'text-emerald-400' },
    };
    const c = colorMap[color];
    return (
        <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-6">
            <div className="max-w-md w-full text-center">
                <div className={`w-20 h-20 rounded-2xl border ${c.ring} flex items-center justify-center mx-auto mb-6`}>
                    <span className={c.text}>{icon}</span>
                </div>
                <h1 className={`text-2xl font-bold mb-3 ${c.text}`}>{title}</h1>
                <p className="text-zinc-400 mb-6 leading-relaxed">{message}</p>
                {children}
            </div>
        </div>
    );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

type Phase = 'validating' | 'confirm' | 'viewing' | 'invalid' | 'expired' | 'used';

export default function EmergencyAccessPage() {
    const { token } = useParams<{ token: string }>();
    const navigate = useNavigate();

    const [phase, setPhase] = useState<Phase>('validating');
    const [accessEntry, setAccessEntry] = useState<EmergencyAccessToken | null>(null);
    const [caseData, setCaseData] = useState<ManagedCase | null>(null);
    const [evidenceList, setEvidenceList] = useState<ReturnType<typeof getEvidenceForCase>>([]);
    const [downloadingId, setDownloadingId] = useState<string | null>(null);

    // ── Step 1: validate token on mount ────────────────────────────────────────
    useEffect(() => {
        if (!token) { setPhase('invalid'); return; }

        // Short artificial delay for UX (loading feel)
        const timer = setTimeout(() => {
            const result = validateAccessToken(token);
            if (!result.valid) {
                const invalid = result as { valid: false; reason: 'not_found' | 'expired' | 'already_used' };
                setPhase(invalid.reason === 'expired' ? 'expired'
                    : invalid.reason === 'already_used' ? 'used'
                        : 'invalid');
                return;
            }
            setAccessEntry(result.token);

            // Find the case
            const allCases = getAllManagedCases();
            const found = allCases.find(c => c.caseId === result.token.caseId) ?? null;
            setCaseData(found);
            if (found) {
                setEvidenceList(getEvidenceForCase(found.caseId));
            }

            setPhase('confirm');
        }, 900);

        return () => clearTimeout(timer);
    }, [token]);

    // ── Step 2: trusted contact confirms access ─────────────────────────────────
    const handleConfirmAccess = () => {
        if (!token || !accessEntry) return;
        const ok = consumeAccessToken(token);
        if (!ok) { setPhase('used'); return; }

        // Audit log
        if (accessEntry.caseId) {
            appendAuditEntry(
                accessEntry.caseId,
                'case_exported',
                'trusted-contact (one-time-link)',
                'viewer',
                `One-time emergency access link used by trusted contact. Platform: ${accessEntry.platform}, Contact: ${accessEntry.contactName}`
            );
        }
        setPhase('viewing');
    };

    // ── Evidence download ───────────────────────────────────────────────────────
    const handleDownload = async (evId: string, evName: string) => {
        if (!caseData) return;
        setDownloadingId(evId);
        try {
            // handleDownloadEvidence(fileName, hash?) — finds the file in localStorage by name+hash
            const ev = evidenceList.find(e => e.id === evId);
            if (!ev) throw new Error('Evidence not found');
            handleDownloadEvidence(ev.file_name, ev.client_sha256);
        } catch (err) {
            console.error('Download failed:', err);
        } finally {
            setDownloadingId(null);
        }
    };

    // ─── Render states ─────────────────────────────────────────────────────────

    if (phase === 'validating') {
        return (
            <StatusScreen
                icon={<Loader2 className="w-10 h-10 animate-spin" />}
                title="Verifying Access Link…"
                message="Please wait while we authenticate your one-time emergency access token."
                color="emerald"
            />
        );
    }

    if (phase === 'invalid') {
        return (
            <StatusScreen
                icon={<XCircle className="w-10 h-10" />}
                title="Invalid Access Link"
                message="This link is not recognized. It may have been corrupted or never existed. Please contact the case owner for a new link."
                color="red"
            />
        );
    }

    if (phase === 'expired') {
        return (
            <StatusScreen
                icon={<Clock className="w-10 h-10" />}
                title="Link Has Expired"
                message="This one-time access link expired 72 hours after it was generated. Please contact the case owner to request a new emergency access link."
                color="amber"
            />
        );
    }

    if (phase === 'used') {
        return (
            <StatusScreen
                icon={<Lock className="w-10 h-10" />}
                title="Link Already Used"
                message="This one-time access link has already been consumed. For your security, each link can only be used once. Please contact the case owner if you need continued access."
                color="amber"
            />
        );
    }

    if (phase === 'confirm' && accessEntry) {
        const timeLeft = Math.max(0, Math.round((new Date(accessEntry.expiresAt).getTime() - Date.now()) / (1000 * 60 * 60)));
        return (
            <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-6">
                <div className="max-w-lg w-full">
                    {/* Header */}
                    <div className="text-center mb-8">
                        <div className="w-20 h-20 rounded-2xl bg-red-500/10 border border-red-500/30 flex items-center justify-center mx-auto mb-5 animate-pulse">
                            <ShieldAlert className="w-10 h-10 text-red-400" />
                        </div>
                        <h1 className="text-2xl font-bold text-zinc-100 mb-2">Emergency Case Access</h1>
                        <p className="text-zinc-400">You've received a one-time access link for a high-risk case.</p>
                    </div>

                    {/* Details card */}
                    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 mb-5 space-y-4">
                        <div className="flex items-center gap-3 pb-4 border-b border-zinc-800">
                            <AlertTriangle className="w-5 h-5 text-red-400" />
                            <div>
                                <p className="text-sm font-bold text-red-400">Risk Level {accessEntry.riskLevel}/10 — CRITICAL</p>
                                <p className="text-xs text-zinc-500">{accessEntry.platform} threat involving {accessEntry.contactName}</p>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4 text-sm">
                            <div>
                                <p className="text-zinc-500 mb-1 text-xs uppercase tracking-wider">Case ID</p>
                                <p className="font-mono text-zinc-200 text-xs">{accessEntry.caseId}</p>
                            </div>
                            <div>
                                <p className="text-zinc-500 mb-1 text-xs uppercase tracking-wider">Platform</p>
                                <p className="text-zinc-200">{accessEntry.platform}</p>
                            </div>
                            <div>
                                <p className="text-zinc-500 mb-1 text-xs uppercase tracking-wider">Issued</p>
                                <p className="text-zinc-200 text-xs">{format(new Date(accessEntry.createdAt), 'MMM d, yyyy HH:mm')}</p>
                            </div>
                            <div>
                                <p className="text-zinc-500 mb-1 text-xs uppercase tracking-wider">Link Expires In</p>
                                <p className="text-amber-400 font-semibold text-xs">{timeLeft} hour{timeLeft !== 1 ? 's' : ''}</p>
                            </div>
                        </div>

                        {/* Warning */}
                        <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl p-4 mt-2">
                            <p className="text-xs text-amber-300 leading-relaxed">
                                ⚠️ <strong>Important:</strong> This link can only be used <strong>once</strong>. After you click "Access Case Files" below, the link expires immediately.
                                Your access will be fully logged in the audit trail for legal purposes.
                            </p>
                        </div>
                    </div>

                    {/* Action buttons */}
                    <div className="flex flex-col gap-3">
                        <button
                            onClick={handleConfirmAccess}
                            className="w-full flex items-center justify-center gap-2 bg-red-600 hover:bg-red-500 text-white font-bold px-6 py-3.5 rounded-xl transition-all"
                        >
                            <Unlock className="w-4 h-4" />
                            Access Case Files (One-Time)
                        </button>
                        <p className="text-center text-xs text-zinc-600">
                            By accessing, you confirm you are the intended trusted contact and consent to your access being logged.
                        </p>
                    </div>
                </div>
            </div>
        );
    }

    // ── VIEWING phase ──────────────────────────────────────────────────────────

    if (phase === 'viewing') {
        return (
            <div className="min-h-screen bg-zinc-950 text-zinc-50">
                {/* Top bar */}
                <div className="sticky top-0 z-50 bg-zinc-950/90 backdrop-blur-xl border-b border-red-500/20">
                    <div className="max-w-4xl mx-auto px-5 h-14 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <Shield className="w-5 h-5 text-red-400" />
                            <span className="font-bold text-zinc-100 tracking-tight">Evidence Vault</span>
                            <span className="text-xs bg-red-500/10 text-red-400 border border-red-500/20 px-2 py-0.5 rounded-full font-semibold">
                                Emergency Access
                            </span>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-amber-400 bg-amber-500/5 border border-amber-500/20 px-3 py-1.5 rounded-full">
                            <Lock className="w-3 h-3" /> One-time link consumed — access logged
                        </div>
                    </div>
                </div>

                <div className="max-w-4xl mx-auto px-5 py-8 space-y-6">

                    {/* Emergency Banner */}
                    <div className="bg-red-500/5 border border-red-500/20 rounded-2xl p-6">
                        <div className="flex items-start gap-4">
                            <div className="w-12 h-12 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center flex-shrink-0">
                                <ShieldAlert className="w-6 h-6 text-red-400" />
                            </div>
                            <div>
                                <h1 className="text-xl font-bold text-red-400 mb-1">🚨 Emergency Case File — Trusted Contact Access</h1>
                                <p className="text-zinc-400 text-sm leading-relaxed">
                                    You have been granted read-only access to this emergency case by the Evidence Vault system.
                                    This is a one-time access session that has been permanently recorded.
                                    You may download all evidence files and use this material for legal investigation.
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Case Details */}
                    {caseData ? (
                        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 space-y-5">
                            <div className="flex items-start justify-between">
                                <div>
                                    <div className="flex items-center gap-2 mb-1">
                                        <FolderOpen className="w-4 h-4 text-emerald-400" />
                                        <h2 className="text-lg font-bold text-zinc-100">Case Details</h2>
                                    </div>
                                    <h3 className="text-base font-semibold text-emerald-400">{caseData.title}</h3>
                                </div>
                                <div className="text-right">
                                    <span className="text-xs font-mono text-zinc-600">{caseData.caseId}</span>
                                </div>
                            </div>

                            <p className="text-sm text-zinc-300 leading-relaxed bg-zinc-800/50 rounded-xl p-4 border border-zinc-700/30">
                                {caseData.description}
                            </p>

                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                {[
                                    { icon: AlertTriangle, label: 'Status', value: caseData.status, col: 'text-blue-400' },
                                    { icon: ShieldAlert, label: 'Priority', value: caseData.priority, col: 'text-red-400' },
                                    { icon: Calendar, label: 'Created', value: format(new Date(caseData.createdAt), 'MMM d, yyyy'), col: 'text-zinc-300' },
                                    { icon: User, label: 'Created By', value: caseData.createdByEmail || 'System', col: 'text-zinc-300' },
                                ].map(({ icon: Icon, label, value, col }, i) => (
                                    <div key={i} className="bg-zinc-800/50 rounded-xl p-3">
                                        <div className="flex items-center gap-1.5 mb-1">
                                            <Icon className={`w-3 h-3 ${col}`} />
                                            <p className="text-xs text-zinc-500">{label}</p>
                                        </div>
                                        <p className={`text-sm font-semibold ${col}`}>{value}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ) : (
                        <div className="bg-zinc-900 border border-amber-500/20 rounded-2xl p-6 text-center">
                            <AlertTriangle className="w-8 h-8 text-amber-400 mx-auto mb-2" />
                            <p className="text-amber-400 font-semibold">Case data not found in this browser session.</p>
                            <p className="text-sm text-zinc-500 mt-1">The case may have been created on a different device. Contact the authority to retrieve the full case file.</p>
                        </div>
                    )}

                    {/* Evidence Files */}
                    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
                        <div className="flex items-center gap-2 mb-5">
                            <FileText className="w-4 h-4 text-emerald-400" />
                            <h2 className="text-lg font-bold text-zinc-100">Evidence Files</h2>
                            <span className="ml-auto text-xs bg-zinc-800 text-zinc-400 px-2 py-0.5 rounded-full">{evidenceList.length} file(s)</span>
                        </div>

                        {evidenceList.length === 0 ? (
                            <div className="text-center py-10 text-zinc-500">
                                <FileText className="w-10 h-10 mx-auto mb-3 text-zinc-700" />
                                <p className="font-semibold">No evidence files found for this session.</p>
                                <p className="text-sm mt-1">Evidence may be stored on the originating device. The authority should export and share the files directly.</p>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {evidenceList.map(ev => (
                                    <div key={ev.id} className="flex items-center justify-between bg-zinc-800/50 border border-zinc-700/30 rounded-xl p-4 hover:border-emerald-500/30 transition-colors">
                                        <div className="flex items-center gap-3 min-w-0">
                                            <div className="w-9 h-9 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center flex-shrink-0">
                                                <FileText className="w-4 h-4 text-emerald-400" />
                                            </div>
                                            <div className="min-w-0">
                                                <p className="text-sm font-medium text-zinc-200 truncate">{ev.file_name}</p>
                                                <p className="text-xs text-zinc-500">
                                                    {typeof ev.file_size === 'number' ? `${(ev.file_size / 1024).toFixed(1)} KB` : ev.file_size} · {ev.file_type}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-3 ml-3">
                                            {ev.integrity_status === 'VERIFIED' && (
                                                <span className="text-xs text-emerald-400 flex items-center gap-1">
                                                    <CheckCircle className="w-3 h-3" /> Verified
                                                </span>
                                            )}
                                            <button
                                                onClick={() => handleDownload(ev.id, ev.file_name)}
                                                disabled={downloadingId === ev.id}
                                                className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 rounded-lg text-xs font-semibold transition-colors disabled:opacity-50"
                                            >
                                                {downloadingId === ev.id
                                                    ? <><Loader2 className="w-3 h-3 animate-spin" /> Downloading…</>
                                                    : <><Download className="w-3 h-3" /> Download</>}
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Legal Notice */}
                    <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-6">
                        <h3 className="text-sm font-bold text-zinc-300 mb-3 flex items-center gap-2">
                            <Shield className="w-4 h-4 text-emerald-400" /> Legal Notice & Chain of Custody
                        </h3>
                        <div className="space-y-2 text-xs text-zinc-500 leading-relaxed">
                            <p>• This access session has been recorded in the immutable audit log with a UTC timestamp.</p>
                            <p>• All evidence files carry SHA-256 cryptographic hashes at the time of original upload — proving no tampering has occurred.</p>
                            <p>• Downloaded files retain their original forensic integrity and may be used as evidence in legal proceedings.</p>
                            <p>• This one-time access token has been permanently invalidated and cannot be re-used.</p>
                            <p>• For additional case information or official correspondence, contact the issuing authority: <strong className="text-zinc-400">{accessEntry?.createdByEmail}</strong></p>
                        </div>
                    </div>

                    {/* Bottom: session info */}
                    <p className="text-center text-xs text-zinc-700 pb-6">
                        Evidence Vault Emergency Access · Token {token?.slice(0, 16)}… · Session valid until page close
                    </p>
                </div>
            </div>
        );
    }

    return null;
}
