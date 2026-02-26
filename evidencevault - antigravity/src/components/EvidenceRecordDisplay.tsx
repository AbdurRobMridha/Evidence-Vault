import { useState } from 'react';
import { Shield, CheckCircle, AlertCircle, HardDrive, Download } from 'lucide-react';
import { EvidenceRecord, generateForensicReport } from '../lib/forensicRecords';
import { handleDownloadEvidence } from '../lib/evidenceDownload';

interface EvidenceRecordDisplayProps {
  records: EvidenceRecord[];
}

export default function EvidenceRecordDisplay({ records }: EvidenceRecordDisplayProps) {
  const [expandedRecord, setExpandedRecord] = useState<string | null>(null);
  const [showReport, setShowReport] = useState<string | null>(null);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'VERIFIED':
        return 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400';
      case 'COMPROMISED':
        return 'bg-red-500/10 border-red-500/30 text-red-400';
      default:
        return 'bg-amber-500/10 border-amber-500/30 text-amber-400';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'VERIFIED':
        return <CheckCircle className="w-5 h-5" />;
      case 'COMPROMISED':
        return <AlertCircle className="w-5 h-5" />;
      default:
        return <HardDrive className="w-5 h-5" />;
    }
  };

  if (!records || records.length === 0) {
    return (
      <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6 text-center text-zinc-400">
        No evidence records to display
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {records.map((record) => (
        <div
          key={record.file_id}
          className="bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden"
        >
          {/* Header */}
          <button
            onClick={() =>
              setExpandedRecord(expandedRecord === record.file_id ? null : record.file_id)
            }
            className="w-full p-4 flex items-center justify-between hover:bg-zinc-800/50 transition-colors"
          >
            <div className="flex items-center gap-4 flex-1 text-left">
              <Shield className="w-5 h-5 text-emerald-400 flex-shrink-0" />
              <div className="flex-1">
                <p className="font-semibold text-zinc-100">{record.file_name}</p>
                <p className="text-xs text-zinc-500">
                  {record.file_size} • {record.file_type.toUpperCase()} • ID: {record.file_id}
                </p>
              </div>
              <div
                className={`flex items-center gap-2 px-3 py-1 rounded-full border ${getStatusColor(
                  record.integrity_status
                )}`}
              >
                {getStatusIcon(record.integrity_status)}
                <span className="text-sm font-medium">{record.integrity_status}</span>
              </div>
            </div>
          </button>

          {/* Expanded Content */}
          {expandedRecord === record.file_id && (
            <div className="border-t border-zinc-800 p-4 bg-zinc-950/50 space-y-4">
              {/* Metadata */}
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-zinc-500 text-xs font-semibold uppercase mb-1">Uploaded By</p>
                  <p className="text-zinc-100 font-mono">{record.uploaded_by}</p>
                </div>
                <div>
                  <p className="text-zinc-500 text-xs font-semibold uppercase mb-1">Upload Time</p>
                  <p className="text-zinc-100 font-mono">
                    {new Date(record.upload_timestamp).toLocaleString()}
                  </p>
                </div>
                <div>
                  <p className="text-zinc-500 text-xs font-semibold uppercase mb-1">Case ID</p>
                  <p className="text-zinc-100 font-mono">{record.case_id}</p>
                </div>
                <div>
                  <p className="text-zinc-500 text-xs font-semibold uppercase mb-1">File Size</p>
                  <p className="text-zinc-100 font-mono">{record.file_size}</p>
                </div>
              </div>

              {/* Hash Verification */}
              <div className="bg-zinc-800/50 border border-zinc-700 rounded p-3 space-y-2">
                <p className="text-zinc-500 text-xs font-semibold uppercase">
                  Cryptographic Integrity Verification
                </p>
                <div>
                  <p className="text-zinc-400 text-xs mb-1">Client-Side SHA-256:</p>
                  <p className="text-emerald-400 font-mono text-xs break-all">
                    {record.client_sha256 || 'N/A'}
                  </p>
                </div>
                <div>
                  <p className="text-zinc-400 text-xs mb-1">Server-Side SHA-256:</p>
                  <p className="text-emerald-400 font-mono text-xs break-all">
                    {record.server_sha256 || 'N/A'}
                  </p>
                </div>
                <div className="pt-2 border-t border-zinc-700">
                  <p
                    className={`text-xs font-semibold ${record.integrity_verified ? 'text-emerald-400' : 'text-red-400'
                      }`}
                  >
                    {record.integrity_verified ? '✓ Hashes Match - Integrity Verified' : '✗ Hashes Do Not Match - Integrity Compromised'}
                  </p>
                </div>
              </div>

              {/* Device Info */}
              {(record.device_info.os || record.device_info.browser) && (
                <div className="text-sm">
                  <p className="text-zinc-500 text-xs font-semibold uppercase mb-2">Device Info</p>
                  <div className="space-y-1">
                    {record.device_info.os && (
                      <p className="text-zinc-300">
                        <span className="text-zinc-500">OS:</span> {record.device_info.os}
                      </p>
                    )}
                    {record.device_info.browser && (
                      <p className="text-zinc-300">
                        <span className="text-zinc-500">Browser:</span> {record.device_info.browser}
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* Audit Log */}
              <div>
                <p className="text-zinc-500 text-xs font-semibold uppercase mb-2">Chain of Custody</p>
                <div className="space-y-2">
                  {record.audit_log.map((entry, idx) => (
                    <div key={idx} className="bg-zinc-800/30 border border-zinc-700 rounded p-2 text-xs">
                      <div className="flex justify-between items-start gap-2">
                        <p className="text-emerald-400 font-semibold uppercase">{entry.action}</p>
                        <p className="text-zinc-500 font-mono">
                          {new Date(entry.timestamp).toLocaleString()}
                        </p>
                      </div>
                      <p className="text-zinc-400 mt-1">User: {entry.user}</p>
                      {entry.details && <p className="text-zinc-400 mt-1">{entry.details}</p>}
                    </div>
                  ))}
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-2 pt-4 border-t border-zinc-800">
                <button
                  onClick={() => handleDownloadEvidence(record.file_name, record.client_sha256)}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded px-3 py-2 text-sm transition-colors flex items-center justify-center gap-2"
                >
                  <Download className="w-4 h-4" />
                  Download Evidence File
                </button>
                <button
                  onClick={() => setShowReport(showReport === record.file_id ? null : record.file_id)}
                  className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-zinc-950 font-semibold rounded px-3 py-2 text-sm transition-colors"
                >
                  {showReport === record.file_id ? 'Hide Report' : 'View Forensic Report'}
                </button>
                <button
                  onClick={() => {
                    const report = generateForensicReport(record);
                    const blob = new Blob([report], { type: 'text/plain' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `${record.file_id}-forensic-report.txt`;
                    a.click();
                    URL.revokeObjectURL(url);
                  }}
                  className="bg-zinc-700 hover:bg-zinc-600 text-zinc-100 font-semibold rounded px-3 py-2 text-sm transition-colors"
                >
                  Download Report
                </button>
              </div>

              {/* Forensic Report Display */}
              {showReport === record.file_id && (
                <div className="bg-black rounded p-3 mt-4 overflow-auto max-h-96">
                  <pre className="text-emerald-400 text-xs font-mono whitespace-pre-wrap break-words">
                    {generateForensicReport(record)}
                  </pre>
                </div>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
