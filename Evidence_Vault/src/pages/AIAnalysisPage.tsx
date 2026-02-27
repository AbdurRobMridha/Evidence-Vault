import React, { useState, useEffect } from 'react';
import {
    Cpu, FolderOpen, FileText, Play, ChevronDown,
    AlertTriangle, ShieldCheck, Loader2, RefreshCw, CheckCircle,
    XCircle
} from 'lucide-react';
import { getCasesForUser, getManagedCaseById, type ManagedCase } from '../lib/caseStore';
import { getEvidenceForCase, type StoredEvidenceMeta } from '../lib/evidenceStore';
import { getCurrentAppUser, type AppUser } from '../lib/rbac';
import { analyzeEvidence, type ForensicAnalysisResult } from '../lib/aiAnalyzer';
import { appendAuditEntry } from '../lib/auditLog';
import { CaseStatusBadge } from '../components/admin/CaseStatusBadge';

export default function AIAnalysisPage() {
    const [user, setUser] = useState<AppUser | null>(null);
    const [cases, setCases] = useState<ManagedCase[]>([]);
    const [selectedCaseId, setSelectedCaseId] = useState('');
    const [evidence, setEvidence] = useState<StoredEvidenceMeta[]>([]);
    const [selectedEvidence, setSelectedEvidence] = useState<StoredEvidenceMeta | null>(null);
    const [analyzing, setAnalyzing] = useState(false);
    const [result, setResult] = useState<ForensicAnalysisResult | null>(null);
    const [expandedPatterns, setExpandedPatterns] = useState(false);
    const [expandedCustody, setExpandedCustody] = useState(false);

    useEffect(() => {
        const u = getCurrentAppUser();
        setUser(u);
        if (u) {
            const userCases = getCasesForUser(u.id, u.role, u.email);
            setCases(userCases);
        }
    }, []);

    useEffect(() => {
        if (selectedCaseId) {
            const ev = getEvidenceForCase(selectedCaseId);
            setEvidence(ev);
            setSelectedEvidence(null);
            setResult(null);
        }
    }, [selectedCaseId]);

    const handleAnalyze = async () => {
        if (!selectedEvidence || !selectedCaseId) return;
        setAnalyzing(true);
        setResult(null);

        try {
            const mc = getManagedCaseById(selectedCaseId);
            const analysisResult = await analyzeEvidence({
                fileName: selectedEvidence.file_name,
                fileType: selectedEvidence.file_type,
                fileSize: selectedEvidence.file_size,
                clientHash: selectedEvidence.client_sha256,
                title: mc?.title || '',
                description: mc?.description || '',
            });

            setResult(analysisResult);

            // Log audit exactly as requested (JSON string representation)
            const auditPayload = {
                event: "AI Analysis Completed",
                riskLevel: analysisResult.riskLevel,
                confidence: `${Math.round(analysisResult.confidenceScore * 100)}%`,
                performedBy: user?.id || 'unknown',
                timestamp: "UTC"
            };

            appendAuditEntry(
                selectedCaseId,
                'ai_analysis_completed',
                user?.email || 'unknown',
                user?.role || 'unknown',
                JSON.stringify(auditPayload, null, 2)
            );
        } catch (err) {
            console.error('AI analysis failed', err);
        } finally {
            setAnalyzing(false);
        }
    };

    const getRiskColor = (level: string) => {
        switch (level) {
            case 'Critical': return { bg: 'bg-red-500/10', border: 'border-red-500/30', text: 'text-red-400', bar: 'bg-red-500' };
            case 'High': return { bg: 'bg-orange-500/10', border: 'border-orange-500/30', text: 'text-orange-400', bar: 'bg-orange-500' };
            case 'Medium': return { bg: 'bg-amber-500/10', border: 'border-amber-500/30', text: 'text-amber-400', bar: 'bg-amber-500' };
            default: return { bg: 'bg-emerald-500/10', border: 'border-emerald-500/30', text: 'text-emerald-400', bar: 'bg-emerald-500' };
        }
    };

    return (
        <div className="p-8 max-w-6xl mx-auto space-y-6">
            {/* Header */}
            <div>
                <div className="flex items-center gap-3 mb-2">
                    <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center">
                        <Cpu className="w-5 h-5 text-purple-400" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-semibold text-zinc-100 tracking-tight">AI Forensic Analysis</h1>
                        <p className="text-sm text-zinc-400">Analyze case evidence with intelligent threat detection</p>
                    </div>
                </div>
            </div>

            {/* Selection Controls */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Case Selector */}
                <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
                    <label className="block text-sm font-semibold text-zinc-300 mb-2">
                        <FolderOpen className="w-4 h-4 inline mr-1.5" />
                        Select Case
                    </label>
                    <div className="relative">
                        <select
                            value={selectedCaseId}
                            onChange={e => setSelectedCaseId(e.target.value)}
                            className="w-full bg-zinc-950 border border-zinc-700 text-zinc-200 text-sm rounded-lg pl-3 pr-8 py-2.5 appearance-none focus:outline-none focus:border-purple-500"
                        >
                            <option value="">Choose a case...</option>
                            {cases.map(c => (
                                <option key={c.caseId} value={c.caseId}>{c.title} ({c.caseId})</option>
                            ))}
                        </select>
                        <ChevronDown className="w-4 h-4 text-zinc-500 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    </div>
                </div>

                {/* Evidence Selector */}
                <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
                    <label className="block text-sm font-semibold text-zinc-300 mb-2">
                        <FileText className="w-4 h-4 inline mr-1.5" />
                        Select Evidence
                    </label>
                    <div className="relative">
                        <select
                            value={selectedEvidence?.id || ''}
                            onChange={e => {
                                const ev = evidence.find(x => x.id === e.target.value);
                                setSelectedEvidence(ev || null);
                                setResult(null);
                            }}
                            disabled={!selectedCaseId || evidence.length === 0}
                            className="w-full bg-zinc-950 border border-zinc-700 text-zinc-200 text-sm rounded-lg pl-3 pr-8 py-2.5 appearance-none focus:outline-none focus:border-purple-500 disabled:opacity-50"
                        >
                            <option value="">
                                {!selectedCaseId ? 'Select a case first...' : evidence.length === 0 ? 'No evidence in this case' : 'Choose evidence...'}
                            </option>
                            {evidence.map(ev => (
                                <option key={ev.id} value={ev.id}>{ev.file_name} ({ev.file_type})</option>
                            ))}
                        </select>
                        <ChevronDown className="w-4 h-4 text-zinc-500 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    </div>
                </div>
            </div>

            {/* Selected Evidence Info */}
            {selectedEvidence && (
                <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
                    <h3 className="text-sm font-semibold text-zinc-300 mb-3">Evidence Details</h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        <div>
                            <p className="text-xs text-zinc-500 mb-1">File Name</p>
                            <p className="text-sm text-zinc-200 font-mono truncate">{selectedEvidence.file_name}</p>
                        </div>
                        <div>
                            <p className="text-xs text-zinc-500 mb-1">Type</p>
                            <p className="text-sm text-zinc-200">{selectedEvidence.file_type}</p>
                        </div>
                        <div>
                            <p className="text-xs text-zinc-500 mb-1">Size</p>
                            <p className="text-sm text-zinc-200">{(selectedEvidence.file_size / 1024 / 1024).toFixed(2)} MB</p>
                        </div>
                        <div>
                            <p className="text-xs text-zinc-500 mb-1">Integrity</p>
                            <p className={`text-sm font-semibold ${selectedEvidence.integrity_status === 'VERIFIED' ? 'text-emerald-400' : 'text-amber-400'}`}>
                                {selectedEvidence.integrity_status}
                            </p>
                        </div>
                    </div>
                    {selectedEvidence.client_sha256 && (
                        <div className="mt-3 col-span-2 md:col-span-4">
                            <p className="text-xs text-zinc-500 mb-1">SHA-256</p>
                            <p className="text-xs text-emerald-400 font-mono break-words bg-zinc-950 rounded p-3 overflow-hidden">
                                {selectedEvidence.client_sha256}
                            </p>
                        </div>
                    )}
                </div>
            )}

            {/* Analyze Button */}
            <button
                onClick={handleAnalyze}
                disabled={!selectedEvidence || analyzing}
                className="w-full bg-purple-600 hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold px-6 py-4 rounded-xl transition-all flex items-center justify-center gap-3 text-base shadow-lg shadow-purple-900/20"
            >
                {analyzing ? (
                    <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        Running Forensic Analysis...
                    </>
                ) : (
                    <>
                        <Play className="w-5 h-5" />
                        Run AI Forensic Analysis
                    </>
                )}
            </button>

            {/* Results */}
            {result && (
                <div className="space-y-4 animate-in fade-in duration-500">
                    {/* Risk Banner */}
                    <div className={`${getRiskColor(result.riskLevel).bg} border ${getRiskColor(result.riskLevel).border} rounded-xl p-5`}>
                        <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-3">
                                {result.riskLevel === 'Critical' || result.riskLevel === 'High' ? (
                                    <AlertTriangle className={`w-6 h-6 ${getRiskColor(result.riskLevel).text}`} />
                                ) : (
                                    <ShieldCheck className={`w-6 h-6 ${getRiskColor(result.riskLevel).text}`} />
                                )}
                                <div>
                                    <p className={`text-lg font-bold ${getRiskColor(result.riskLevel).text}`}>
                                        {result.riskLevel.toUpperCase()} RISK
                                    </p>
                                    <p className="text-xs text-zinc-400">{result.evidenceClassification}</p>
                                </div>
                            </div>
                            <div className="text-right">
                                <p className={`text-3xl font-bold ${getRiskColor(result.riskLevel).text}`}>{result.riskScore}/10</p>
                                <p className="text-xs text-zinc-500">Risk Score</p>
                            </div>
                        </div>
                        <div className="w-full bg-zinc-800 rounded-full h-2">
                            <div className={`h-2 rounded-full transition-all duration-700 ${getRiskColor(result.riskLevel).bar}`} style={{ width: `${result.riskScore * 10}%` }} />
                        </div>
                    </div>

                    {/* Scores */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
                            <p className="text-xs text-zinc-500 uppercase font-semibold mb-1">Confidence</p>
                            <p className="text-2xl font-bold text-zinc-100">{Math.round(result.confidenceScore * 100)}%</p>
                            <div className="w-full bg-zinc-800 rounded-full h-1.5 mt-2">
                                <div className="h-1.5 rounded-full bg-blue-500 transition-all duration-700" style={{ width: `${result.confidenceScore * 100}%` }} />
                            </div>
                        </div>
                        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
                            <p className="text-xs text-zinc-500 uppercase font-semibold mb-1">Integrity</p>
                            <p className={`text-2xl font-bold ${result.integrityStatus === 'Verified' ? 'text-emerald-400' : 'text-amber-400'}`}>
                                {result.integrityStatus}
                            </p>
                        </div>
                    </div>

                    {/* Summary */}
                    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
                        <h3 className="text-sm font-bold text-zinc-200 mb-2">Analysis Summary</h3>
                        <div className="max-h-64 overflow-y-auto pr-2 custom-scrollbar">
                            <p className="text-sm text-zinc-400 leading-relaxed whitespace-pre-wrap break-words">{result.summary}</p>
                        </div>
                    </div>

                    {/* Indicators */}
                    {result.detectedIndicators.length > 0 && (
                        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
                            <h3 className="text-sm font-bold text-zinc-200 mb-3">Detected Indicators</h3>
                            <div className="flex flex-wrap gap-2">
                                {result.detectedIndicators.map((ind, i) => (
                                    <span key={i} className="text-xs font-semibold bg-red-500/10 text-red-400 border border-red-500/20 px-2.5 py-1 rounded-full">
                                        {ind}
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Suspicious Patterns (expandable) */}
                    {result.suspiciousPatterns.length > 0 && (
                        <div className="bg-zinc-900 border border-zinc-800 rounded-xl">
                            <button
                                onClick={() => setExpandedPatterns(!expandedPatterns)}
                                className="w-full flex items-center justify-between p-5 text-left"
                            >
                                <h3 className="text-sm font-bold text-zinc-200">Suspicious Patterns ({result.suspiciousPatterns.length})</h3>
                                <ChevronDown className={`w-4 h-4 text-zinc-400 transition-transform ${expandedPatterns ? 'rotate-180' : ''}`} />
                            </button>
                            {expandedPatterns && (
                                <div className="px-5 pb-5 space-y-2 max-h-64 overflow-y-auto custom-scrollbar">
                                    {result.suspiciousPatterns.map((p, i) => (
                                        <div key={i} className="flex items-start gap-2">
                                            <XCircle className="w-3.5 h-3.5 text-amber-400 mt-0.5 flex-shrink-0" />
                                            <p className="text-sm text-zinc-400 break-words">{p}</p>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Recommended Actions */}
                    {result.recommendedActions.length > 0 && (
                        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
                            <h3 className="text-sm font-bold text-zinc-200 mb-3">Recommended Actions</h3>
                            <div className="space-y-2">
                                {result.recommendedActions.map((action, i) => (
                                    <div key={i} className="flex items-start gap-2">
                                        <CheckCircle className="w-3.5 h-3.5 text-emerald-400 mt-0.5 flex-shrink-0" />
                                        <p className="text-sm text-zinc-400">{action}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Chain of Custody Notes */}
                    {result.chainOfCustodyNotes.length > 0 && (
                        <div className="bg-zinc-900 border border-zinc-800 rounded-xl">
                            <button
                                onClick={() => setExpandedCustody(!expandedCustody)}
                                className="w-full flex items-center justify-between p-5 text-left"
                            >
                                <h3 className="text-sm font-bold text-zinc-200">Chain of Custody Notes</h3>
                                <ChevronDown className={`w-4 h-4 text-zinc-400 transition-transform ${expandedCustody ? 'rotate-180' : ''}`} />
                            </button>
                            {expandedCustody && (
                                <div className="px-5 pb-5 space-y-2">
                                    {result.chainOfCustodyNotes.map((note, i) => (
                                        <p key={i} className="text-sm text-zinc-400">• {note}</p>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Source Badge */}
                    <div className="flex items-center justify-between text-xs text-zinc-500 px-1">
                        <span>Source: <span className="text-purple-400 font-semibold">{result.analysisSource === 'gemini-ai' ? 'Gemini AI' : 'Local Forensic Engine'}</span></span>
                        <span>{result.generatedAt}</span>
                    </div>

                    {/* Re-run */}
                    <button
                        onClick={handleAnalyze}
                        disabled={analyzing}
                        className="w-full flex items-center justify-center gap-2 text-sm text-purple-400 hover:text-purple-300 py-2 transition-colors"
                    >
                        <RefreshCw className={`w-4 h-4 ${analyzing ? 'animate-spin' : ''}`} />
                        Re-run Analysis
                    </button>
                </div>
            )}
        </div>
    );
}
