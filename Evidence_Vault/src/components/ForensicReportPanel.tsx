import React, { useState, useEffect, useCallback } from 'react';
import {
    FileText, Download, Loader2, ShieldCheck, AlertCircle,
    CheckCircle, Hash, ClipboardCopy, FileDown, RefreshCw
} from 'lucide-react';
import {
    type ForensicReportData,
    type GeneratedReport,
    type ReportEvidence,
    type ReportAuditEntry,
    type ReportAIAnalysis,
    generateForensicReportTXT,
    generateForensicReportPDF,
    downloadText,
    downloadBlob,
} from '../lib/ForensicReportGenerator';
import { getManagedCaseById } from '../lib/caseStore';
import { getEvidenceForCase } from '../lib/evidenceStore';
import { getCaseAuditLog } from '../lib/auditLog';

interface ForensicReportPanelProps {
    caseId: string;
    userId: string;
    userEmail: string;
}

export default function ForensicReportPanel({ caseId, userId, userEmail }: ForensicReportPanelProps) {
    const [generating, setGenerating] = useState(false);
    const [report, setReport] = useState<GeneratedReport | null>(null);
    const [reportData, setReportData] = useState<ForensicReportData | null>(null);
    const [error, setError] = useState('');
    const [copied, setCopied] = useState(false);
    const [downloadingPDF, setDownloadingPDF] = useState(false);
    const [generationCount, setGenerationCount] = useState(0);
    const [investigatorNotes, setInvestigatorNotes] = useState('');
    const [showPreview, setShowPreview] = useState(false);
    const [previewContent, setPreviewContent] = useState('');

    // Build report data from localStorage first, fallback to API
    const fetchReportData = useCallback(async (): Promise<ForensicReportData> => {
        // ── 1) Try localStorage (caseStore + evidenceStore + auditLog) ──
        const mc = getManagedCaseById(caseId);
        const storedEvidence = getEvidenceForCase(caseId);
        const auditEntries = getCaseAuditLog(caseId);

        if (mc) {
            // Map evidence from evidenceStore
            const evidence: ReportEvidence[] = storedEvidence.map(ev => ({
                id: ev.id,
                file_name: ev.file_name,
                file_type: ev.file_type,
                file_size: ev.file_size,
                client_sha256: ev.client_sha256,
                server_sha256: ev.server_sha256,
                hash_match: ev.client_sha256 === ev.server_sha256 && ev.client_sha256 !== '',
                upload_timestamp: ev.upload_timestamp,
                uploaded_by: ev.uploaded_by,
                device_info: `Platform: ${navigator.platform}`,
                integrity_status: ev.integrity_status,
            }));

            // Map audit log
            const audit_log: ReportAuditEntry[] = auditEntries.map(entry => ({
                action: entry.action,
                performed_by: entry.actor,
                timestamp: entry.timestamp,
                event_id: entry.id,
                integrity_status: entry.action.includes('verified') ? 'VERIFIED' : 'N/A',
                details: entry.detail,
            }));

            return {
                case_id: caseId,
                case_title: mc.title || `Case #${caseId}`,
                case_description: mc.description || '',
                case_status: mc.status,
                case_created_at: mc.createdAt,
                user_id: userId,
                user_email: userEmail,
                evidence,
                audit_log,
                ai_analysis: null,
                investigator_notes: investigatorNotes || undefined,
                report_version: generationCount + 1,
            };
        }

        // ── 2) Fallback to API ──
        const res = await fetch(`/api/cases/${caseId}`);
        if (!res.ok) throw new Error('Failed to load case data');
        const caseInfo = await res.json();

        // Map evidence
        const evidence: ReportEvidence[] = (caseInfo.evidence || []).map((ev: any) => ({
            id: ev.id || ev.file_id || `EV-${Date.now()}`,
            file_name: ev.file_name || ev.fileName || 'unknown',
            file_type: ev.file_type || ev.fileType || 'unknown',
            file_size: ev.file_size || ev.fileSize || 0,
            client_sha256: ev.client_sha256 || ev.clientHash || '',
            server_sha256: ev.server_sha256 || ev.serverHash || '',
            hash_match:
                !!(ev.client_sha256 && ev.server_sha256 && ev.client_sha256.toLowerCase() === ev.server_sha256.toLowerCase()) ||
                !!ev.integrity_verified,
            upload_timestamp: ev.upload_timestamp || ev.uploadedAt || new Date().toISOString(),
            uploaded_by: ev.user_id || ev.uploadedBy || userId,
            device_info: ev.device_info || `Platform: ${navigator.platform}`,
            integrity_status: ev.integrity_verified
                ? 'VERIFIED'
                : ev.server_sha256 && ev.client_sha256 && ev.client_sha256 !== ev.server_sha256
                    ? 'COMPROMISED'
                    : 'PENDING',
        }));

        // Map audit log
        const audit_log: ReportAuditEntry[] = (caseInfo.logs || []).map((log: any) => ({
            action: log.action || 'unknown',
            performed_by: log.user_id || 'SYSTEM',
            timestamp: log.timestamp || new Date().toISOString(),
            event_id: log.id || `EVT-${Date.now()}`,
            integrity_status: log.action?.includes('VERIFIED') ? 'VERIFIED' : 'N/A',
            details: log.details || '',
        }));

        // Parse AI analysis from case risk_analysis field
        let ai_analysis: ReportAIAnalysis | null = null;
        if (caseInfo.risk_analysis && caseInfo.risk_analysis !== '{}') {
            try {
                const aiRaw = typeof caseInfo.risk_analysis === 'string'
                    ? JSON.parse(caseInfo.risk_analysis)
                    : caseInfo.risk_analysis;
                ai_analysis = {
                    risk_score: aiRaw.risk_score || caseInfo.risk_score || 0,
                    severity:
                        (aiRaw.risk_score || caseInfo.risk_score || 0) >= 7
                            ? 'HIGH'
                            : (aiRaw.risk_score || caseInfo.risk_score || 0) >= 4
                                ? 'MEDIUM'
                                : 'LOW',
                    findings: aiRaw.detected_threats || [],
                    observations: aiRaw.observations || [],
                    recommendations: aiRaw.recommendations || [],
                };
            } catch {
                // ignore parse errors
            }
        }

        return {
            case_id: caseId,
            case_title: caseInfo.title || `Case #${caseId}`,
            case_description: caseInfo.description || '',
            case_status: caseInfo.status || 'open',
            case_created_at: caseInfo.created_at || new Date().toISOString(),
            user_id: userId,
            user_email: userEmail,
            evidence,
            audit_log,
            ai_analysis,
            investigator_notes: investigatorNotes || undefined,
            report_version: generationCount + 1,
        };
    }, [caseId, userId, userEmail, investigatorNotes, generationCount]);

    // Generate the full forensic report
    const handleGenerate = async () => {
        setGenerating(true);
        setError('');
        setReport(null);
        setShowPreview(false);

        try {
            const data = await fetchReportData();
            setReportData(data);

            const generatedReport = await generateForensicReportTXT(data);
            setReport(generatedReport);
            setPreviewContent(generatedReport.content_txt);
            setGenerationCount((c) => c + 1);

            // Log report generation to the audit trail
            try {
                await fetch(`/api/cases/${caseId}/verify`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        fileName: `forensic_report_${caseId}.txt`,
                        computedHash: generatedReport.report_hash,
                        userId: userId,
                        result: 'report_generated',
                    }),
                });
            } catch {
                // non-critical, continue
            }
        } catch (err: any) {
            setError(err.message || 'Failed to generate report');
        } finally {
            setGenerating(false);
        }
    };

    // Download TXT
    const handleDownloadTXT = () => {
        if (!report) return;
        downloadText(report.content_txt, `forensic_report_${caseId}_v${report.version}.txt`);
    };

    // Download PDF
    const handleDownloadPDF = async () => {
        if (!reportData || !report) return;
        setDownloadingPDF(true);
        try {
            const { blob } = await generateForensicReportPDF(reportData, report);
            downloadBlob(blob, `forensic_report_${caseId}_v${report.version}.pdf`);
        } catch (err: any) {
            setError('PDF generation failed: ' + (err.message || ''));
        } finally {
            setDownloadingPDF(false);
        }
    };

    // Copy hash
    const handleCopyHash = () => {
        if (!report) return;
        navigator.clipboard.writeText(report.report_hash);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div className="space-y-6">
            {/* Header Info Card */}
            <div className="bg-gradient-to-br from-zinc-900 via-zinc-900 to-emerald-950/20 border border-zinc-800 rounded-xl p-6">
                <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center flex-shrink-0">
                        <ShieldCheck className="w-6 h-6 text-emerald-400" />
                    </div>
                    <div className="flex-1">
                        <h3 className="text-lg font-bold text-zinc-100 mb-1">
                            Forensic Investigation Report Generator
                        </h3>
                        <p className="text-sm text-zinc-400 leading-relaxed">
                            Generate a court-admissible, chain-of-custody compliant forensic report with
                            SHA-256 integrity verification. Suitable for legal proceedings, cybercrime
                            reporting, and investigative review.
                        </p>
                    </div>
                </div>
            </div>

            {/* Investigator Notes */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
                <label className="block text-sm font-semibold text-zinc-300 mb-2">
                    Investigation Notes (Optional)
                </label>
                <textarea
                    value={investigatorNotes}
                    onChange={(e) => setInvestigatorNotes(e.target.value)}
                    placeholder="Enter any investigator remarks, observations, or reference IDs..."
                    rows={3}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-2.5 text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/50 transition-colors resize-none text-sm"
                />
            </div>

            {/* Generate Button */}
            <button
                onClick={handleGenerate}
                disabled={generating}
                className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-zinc-950 font-bold px-6 py-4 rounded-xl transition-all flex items-center justify-center gap-3 text-base shadow-lg shadow-emerald-900/20"
            >
                {generating ? (
                    <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        Generating Forensic Report...
                    </>
                ) : generationCount > 0 ? (
                    <>
                        <RefreshCw className="w-5 h-5" />
                        Regenerate Report (v{generationCount + 1})
                    </>
                ) : (
                    <>
                        <FileText className="w-5 h-5" />
                        Generate Forensic Report
                    </>
                )}
            </button>

            {/* Error */}
            {error && (
                <div className="bg-red-500/10 border border-red-500/20 text-red-300 p-4 rounded-xl flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                    <p className="text-sm">{error}</p>
                </div>
            )}

            {/* Report Generated - Result Panel */}
            {report && (
                <div className="space-y-5 animate-in fade-in duration-500">
                    {/* Success Banner */}
                    <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-5">
                        <div className="flex items-start gap-3">
                            <CheckCircle className="w-5 h-5 text-emerald-400 mt-0.5 flex-shrink-0" />
                            <div className="flex-1">
                                <p className="font-semibold text-emerald-400 mb-1">Report Generated Successfully</p>
                                <p className="text-sm text-emerald-300/70">
                                    Version {report.version} • Generated at {report.generated_at}
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Report Metadata Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
                            <p className="text-xs font-semibold text-zinc-500 uppercase mb-1">Report ID</p>
                            <p className="text-sm text-zinc-200 font-mono break-all">{report.report_id}</p>
                        </div>
                        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
                            <p className="text-xs font-semibold text-zinc-500 uppercase mb-1">Version</p>
                            <p className="text-sm text-zinc-200 font-mono">v{report.version}</p>
                        </div>
                        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
                            <p className="text-xs font-semibold text-zinc-500 uppercase mb-1">Generated (UTC)</p>
                            <p className="text-sm text-zinc-200 font-mono">{report.generated_at}</p>
                        </div>
                        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
                            <p className="text-xs font-semibold text-zinc-500 uppercase mb-1">Generation Count</p>
                            <p className="text-sm text-zinc-200 font-mono">{generationCount}</p>
                        </div>
                    </div>

                    {/* Report Hash */}
                    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
                        <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                                <Hash className="w-4 h-4 text-emerald-400" />
                                <p className="text-xs font-semibold text-zinc-500 uppercase">Report SHA-256 Hash</p>
                            </div>
                            <button
                                onClick={handleCopyHash}
                                className="flex items-center gap-1.5 text-xs text-zinc-400 hover:text-emerald-400 transition-colors"
                            >
                                <ClipboardCopy className="w-3.5 h-3.5" />
                                {copied ? 'Copied!' : 'Copy'}
                            </button>
                        </div>
                        <p className="text-emerald-400 font-mono text-xs break-all bg-zinc-950 rounded-lg p-3 border border-zinc-800">
                            {report.report_hash}
                        </p>
                        <p className="text-xs text-zinc-500 mt-2">
                            To verify integrity: recompute SHA-256 of the TXT report file and compare with this hash.
                        </p>
                    </div>

                    {/* Download Actions */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <button
                            onClick={handleDownloadTXT}
                            className="flex items-center justify-center gap-3 bg-zinc-800 hover:bg-zinc-700 text-zinc-100 font-semibold px-5 py-3.5 rounded-xl transition-colors"
                        >
                            <FileDown className="w-5 h-5 text-zinc-400" />
                            <div className="text-left">
                                <p className="text-sm font-semibold">Download TXT</p>
                                <p className="text-xs text-zinc-500">Forensic text format</p>
                            </div>
                        </button>

                        <button
                            onClick={handleDownloadPDF}
                            disabled={downloadingPDF}
                            className="flex items-center justify-center gap-3 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 text-zinc-100 font-semibold px-5 py-3.5 rounded-xl transition-colors"
                        >
                            {downloadingPDF ? (
                                <Loader2 className="w-5 h-5 animate-spin text-zinc-400" />
                            ) : (
                                <Download className="w-5 h-5 text-zinc-400" />
                            )}
                            <div className="text-left">
                                <p className="text-sm font-semibold">{downloadingPDF ? 'Generating PDF...' : 'Download PDF'}</p>
                                <p className="text-xs text-zinc-500">Formatted legal report</p>
                            </div>
                        </button>
                    </div>

                    {/* Toggle Preview */}
                    <button
                        onClick={() => setShowPreview(!showPreview)}
                        className="w-full flex items-center justify-center gap-2 text-sm text-zinc-400 hover:text-emerald-400 transition-colors py-2"
                    >
                        <FileText className="w-4 h-4" />
                        {showPreview ? 'Hide Report Preview' : 'Show Report Preview'}
                    </button>

                    {/* Report Preview */}
                    {showPreview && previewContent && (
                        <div className="bg-black rounded-xl border border-zinc-800 overflow-hidden">
                            <div className="flex items-center justify-between px-4 py-2 bg-zinc-900 border-b border-zinc-800">
                                <p className="text-xs font-semibold text-zinc-400">REPORT PREVIEW</p>
                                <p className="text-xs text-zinc-600 font-mono">v{report.version}</p>
                            </div>
                            <div className="overflow-auto max-h-[600px] p-4">
                                <pre className="text-emerald-400 text-xs font-mono whitespace-pre-wrap break-words leading-relaxed">
                                    {previewContent}
                                </pre>
                            </div>
                        </div>
                    )}

                    {/* Verification Checklist */}
                    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
                        <h4 className="text-sm font-bold text-zinc-200 mb-3 flex items-center gap-2">
                            <ShieldCheck className="w-4 h-4 text-emerald-400" />
                            Report Verification Checklist
                        </h4>
                        <div className="space-y-2">
                            {[
                                'Report generated with unique UUID identifier',
                                'SHA-256 hash computed for full report content',
                                'All timestamps recorded in UTC format',
                                'Chain of custody log included with chronological entries',
                                'Evidence inventory with hash verification status',
                                'Integrity verification statement included',
                                'Legal declaration with formal conditions',
                                'System configuration snapshot in appendix',
                                `Report version: v${report.version}`,
                            ].map((item, i) => (
                                <div key={i} className="flex items-center gap-2 text-sm">
                                    <CheckCircle className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                                    <span className="text-zinc-300">{item}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Digital Signature Simulation */}
                    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
                        <h4 className="text-sm font-bold text-zinc-200 mb-3">Digital Signature Block</h4>
                        <div className="bg-zinc-950 rounded-lg p-4 border border-zinc-800 font-mono text-xs space-y-1">
                            <p className="text-zinc-500">Signed By:      <span className="text-zinc-300">{userEmail}</span></p>
                            <p className="text-zinc-500">Signature Time: <span className="text-zinc-300">{report.generated_at}</span></p>
                            <p className="text-zinc-500">Report Hash:    <span className="text-emerald-400">{report.report_hash.substring(0, 32)}...</span></p>
                            <p className="text-zinc-500">System:         <span className="text-zinc-300">Evidence Vault v1.0.0</span></p>
                            <p className="text-zinc-500">Status:         <span className="text-emerald-400">AUTHENTICATED</span></p>
                        </div>
                        <p className="text-xs text-zinc-600 mt-2">
                            This is a simulated digital signature block. In production, integrate with
                            PKI or HSM for legally binding digital signatures.
                        </p>
                    </div>

                    {/* Tamper Detection Warning */}
                    <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl p-4">
                        <div className="flex items-start gap-3">
                            <AlertCircle className="w-5 h-5 text-amber-400 mt-0.5 flex-shrink-0" />
                            <div>
                                <p className="text-sm font-semibold text-amber-400">Tamper Detection Notice</p>
                                <p className="text-xs text-amber-300/70 mt-1">
                                    Any modification to the report file after generation will invalidate the
                                    SHA-256 hash. The report is cryptographically sealed at the moment of
                                    generation. Verify integrity before submission.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
