import React, { useState } from 'react';
import { Mail, Send, X, CheckCircle, Copy, Clock } from 'lucide-react';
import { createInvitation, type Invitation } from '../../lib/inviteStore';
import { getAllManagedCases } from '../../lib/caseStore';
import type { Role } from '../../lib/rbac';

interface Props {
    isOpen: boolean;
    onClose: () => void;
    onInviteSent: (invitation: Invitation) => void;
}

export default function InviteInvestigatorModal({ isOpen, onClose, onInviteSent }: Props) {
    const [email, setEmail] = useState('');
    const [role, setRole] = useState<Role>('investigator');
    const [selectedCases, setSelectedCases] = useState<string[]>([]);
    const [sent, setSent] = useState<Invitation | null>(null);
    const [copied, setCopied] = useState(false);

    const cases = getAllManagedCases();

    const toggleCase = (caseId: string) => {
        setSelectedCases(prev =>
            prev.includes(caseId) ? prev.filter(c => c !== caseId) : [...prev, caseId]
        );
    };

    const handleSend = () => {
        if (!email.trim()) return;

        const invitation = createInvitation(email.trim(), role, selectedCases, 'admin');
        setSent(invitation);
        onInviteSent(invitation);
    };

    const handleCopyToken = () => {
        if (sent) {
            navigator.clipboard.writeText(sent.token);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
    };

    const handleClose = () => {
        setEmail('');
        setRole('investigator');
        setSelectedCases([]);
        setSent(null);
        setCopied(false);
        onClose();
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 max-w-lg w-full max-h-[90vh] overflow-y-auto">
                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
                            <Mail className="w-5 h-5 text-blue-400" />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-zinc-100">Invite Investigator</h2>
                            <p className="text-xs text-zinc-500">Send a secure access invitation</p>
                        </div>
                    </div>
                    <button onClick={handleClose} className="text-zinc-500 hover:text-zinc-300 transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {sent ? (
                    /* ── Success State ───────────────────────── */
                    <div className="space-y-4">
                        <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-4 text-center">
                            <CheckCircle className="w-10 h-10 text-emerald-400 mx-auto mb-3" />
                            <h3 className="text-base font-bold text-emerald-400 mb-1">Invitation Sent!</h3>
                            <p className="text-sm text-zinc-400">A secure invitation has been generated for <span className="text-zinc-200 font-medium">{sent.email}</span></p>
                        </div>

                        {/* Token Info */}
                        <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-4 space-y-3">
                            <div className="flex items-center justify-between text-sm">
                                <span className="text-zinc-500">Access Token:</span>
                                <button
                                    onClick={handleCopyToken}
                                    className="flex items-center gap-1.5 text-emerald-400 hover:text-emerald-300 transition-colors text-xs font-mono"
                                >
                                    {copied ? <CheckCircle className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                                    {copied ? 'Copied!' : sent.token.slice(0, 20) + '...'}
                                </button>
                            </div>
                            <div className="flex items-center justify-between text-sm">
                                <span className="text-zinc-500">Role:</span>
                                <span className="text-zinc-200 capitalize">{sent.role}</span>
                            </div>
                            <div className="flex items-center justify-between text-sm">
                                <span className="text-zinc-500">Cases Assigned:</span>
                                <span className="text-zinc-200">{sent.caseIds.length} case(s)</span>
                            </div>
                            <div className="flex items-center justify-between text-sm">
                                <span className="text-zinc-500 flex items-center gap-1"><Clock className="w-3 h-3" /> Expires:</span>
                                <span className="text-zinc-200 font-mono text-xs">{new Date(sent.expiresAt).toLocaleDateString()}</span>
                            </div>
                        </div>

                        <div className="bg-amber-500/5 border border-amber-500/15 rounded-lg p-3">
                            <p className="text-xs text-amber-400">
                                <strong>Demo Mode:</strong> The invitation details have been logged to the browser console. In production, this would be sent via email.
                            </p>
                        </div>

                        <button
                            onClick={handleClose}
                            className="w-full bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-medium px-4 py-2.5 rounded-lg transition-colors"
                        >
                            Done
                        </button>
                    </div>
                ) : (
                    /* ── Form State ───────────────────────────── */
                    <div className="space-y-5">
                        {/* Email */}
                        <div>
                            <label className="block text-sm font-medium text-zinc-400 mb-1.5">Investigator Email</label>
                            <input
                                type="email"
                                value={email}
                                onChange={e => setEmail(e.target.value)}
                                placeholder="investigator@agency.gov"
                                className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-2.5 text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/50 transition-colors"
                            />
                        </div>

                        {/* Role */}
                        <div>
                            <label className="block text-sm font-medium text-zinc-400 mb-1.5">Assigned Role</label>
                            <select
                                value={role}
                                onChange={e => setRole(e.target.value as Role)}
                                className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-2.5 text-zinc-100 focus:outline-none focus:border-blue-500 appearance-none"
                            >
                                <option value="investigator">Investigator</option>
                                <option value="viewer">Viewer (Read-Only)</option>
                            </select>
                        </div>

                        {/* Case Selection */}
                        <div>
                            <label className="block text-sm font-medium text-zinc-400 mb-1.5">
                                Assign to Cases
                                <span className="text-zinc-600 font-normal ml-1">({selectedCases.length} selected)</span>
                            </label>
                            <div className="max-h-40 overflow-y-auto bg-zinc-950 border border-zinc-800 rounded-lg p-2 space-y-1">
                                {cases.length === 0 ? (
                                    <p className="text-xs text-zinc-600 p-2 text-center">No cases available</p>
                                ) : (
                                    cases.map(c => (
                                        <label
                                            key={c.caseId}
                                            className={`flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer transition-colors ${selectedCases.includes(c.caseId) ? 'bg-blue-500/10 border border-blue-500/20' : 'hover:bg-zinc-800/50 border border-transparent'
                                                }`}
                                        >
                                            <input
                                                type="checkbox"
                                                checked={selectedCases.includes(c.caseId)}
                                                onChange={() => toggleCase(c.caseId)}
                                                className="rounded border-zinc-700 bg-zinc-900 text-blue-500 focus:ring-blue-500/50"
                                            />
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm text-zinc-200 truncate">{c.title}</p>
                                                <p className="text-xs text-zinc-600 font-mono">{c.caseId}</p>
                                            </div>
                                        </label>
                                    ))
                                )}
                            </div>
                        </div>

                        {/* Security Notice */}
                        <div className="bg-zinc-950 border border-zinc-800 rounded-lg p-3">
                            <p className="text-xs text-zinc-500 leading-relaxed">
                                🔒 A secure one-time access token will be generated. No raw passwords are shared.
                                The token expires in 7 days and can only be used once.
                            </p>
                        </div>

                        {/* Send Button */}
                        <button
                            onClick={handleSend}
                            disabled={!email.trim()}
                            className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold px-4 py-3 rounded-lg transition-colors flex items-center justify-center gap-2"
                        >
                            <Send className="w-4 h-4" />
                            Send Invitation
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
