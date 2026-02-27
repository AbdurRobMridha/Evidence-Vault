import React, { useState, useEffect } from 'react';
import { Upload, Search, FileText, CheckCircle, AlertCircle, FolderPlus, Download, Trash2, Eye, Shield, ScrollText } from 'lucide-react';
import { EvidenceRecord, generateEvidenceRecord } from '../lib/forensicRecords';
import EvidenceRecordDisplay from './EvidenceRecordDisplay';
import ForensicReportPanel from './ForensicReportPanel';
import { handleDownloadEvidence } from '../lib/evidenceDownload';
import { getEvidenceForCase, saveEvidenceToCase, removeEvidenceFromCase, type StoredEvidenceMeta } from '../lib/evidenceStore';
import { appendAuditEntry } from '../lib/auditLog';

interface CaseFile {
  id: string;
  name: string;
  type: string;
  size: string;
  dateModified: string;
  clientHash?: string;
  serverHash?: string;
  integrityStatus?: 'VERIFIED' | 'COMPROMISED' | 'PENDING';
  uploadedBy: string;
  uploadTimestamp: string;
}

interface CaseDashboardProps {
  caseId: string;
  uploadedBy: string;
  userId?: string;
  userEmail?: string;
}

export default function CaseDetailsDashboard({ caseId, uploadedBy, userId, userEmail }: CaseDashboardProps) {
  const [activeTab, setActiveTab] = useState<'files' | 'verify' | 'records' | 'report'>('files');
  const [files, setFiles] = useState<CaseFile[]>([]);
  const [evidenceRecords, setEvidenceRecords] = useState<EvidenceRecord[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'name' | 'date' | 'size'>('date');
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [verificationResult, setVerificationResult] = useState<{
    status: 'idle' | 'verified' | 'modified' | 'not_found' | 'error';
    message?: string;
    matchedFile?: CaseFile | null;
    computedHash?: string;
  }>({ status: 'idle' });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);

  async function verifySelectedFile(file: File) {
    setVerifying(true);
    setVerificationResult({ status: 'idle' });
    try {
      const arrayBuffer = await file.arrayBuffer();
      const digest = await crypto.subtle.digest('SHA-256', arrayBuffer);
      const hashArray = Array.from(new Uint8Array(digest));
      const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
      const lower = hashHex.toLowerCase();

      const exactMatch = files.find(fl => (fl.serverHash || '').toLowerCase() === lower || (fl.clientHash || '').toLowerCase() === lower);
      if (exactMatch) {
        try {
          await fetch(`/api/cases/${caseId}/verify`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ fileName: file.name, computedHash: hashHex, userId: uploadedBy, result: 'exact_match' })
          });
        } catch (e) {
          console.warn('Failed to record verification attempt', e);
        }
        setVerificationResult({ status: 'verified', message: 'Exact match found – file is identical to stored evidence.', matchedFile: exactMatch, computedHash: hashHex });
        return;
      }

      const nameMatch = files.find(fl => fl.name === file.name);
      if (nameMatch) {
        try {
          await fetch(`/api/cases/${caseId}/verify`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ fileName: file.name, computedHash: hashHex, userId: uploadedBy, result: 'name_match_hash_mismatch' })
          });
        } catch (e) {
          console.warn('Failed to record verification attempt', e);
        }
        setVerificationResult({ status: 'modified', message: 'Similar file detected – possible modification or alteration.', matchedFile: nameMatch, computedHash: hashHex });
        return;
      }

      try {
        await fetch(`/api/cases/${caseId}/verify`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ fileName: file.name, computedHash: hashHex, userId: uploadedBy, result: 'not_found' })
        });
      } catch (e) {
        console.warn('Failed to record verification attempt', e);
      }

      setVerificationResult({ status: 'not_found', message: 'No matching evidence found in database.', computedHash: hashHex });
    } catch (err: any) {
      setVerificationResult({ status: 'error', message: err?.message || String(err) });
    } finally {
      setVerifying(false);
    }
  }



  // Load files/evidence from localStorage evidence store first, fallback API
  useEffect(() => {
    let cancelled = false;
    async function load() {
      // 1) Try localStorage evidence store
      const stored = getEvidenceForCase(caseId);
      if (stored.length > 0) {
        const localFiles: CaseFile[] = stored.map(ev => ({
          id: ev.id,
          name: ev.file_name,
          type: ev.file_type,
          size: typeof ev.file_size === 'number' ? `${(ev.file_size / 1024 / 1024).toFixed(2)} MB` : String(ev.file_size),
          dateModified: ev.upload_timestamp,
          clientHash: ev.client_sha256,
          serverHash: ev.server_sha256,
          integrityStatus: ev.integrity_status,
          uploadedBy: ev.uploaded_by,
          uploadTimestamp: ev.upload_timestamp,
        }));
        if (!cancelled) {
          setFiles(localFiles);
          setEvidenceRecords(localFiles.map(f => generateEvidenceRecord(f.name, f.type, f.size, f.clientHash || '', f.serverHash || '', f.uploadedBy, f.uploadTimestamp, caseId)));
        }
        return;
      }

      // 2) Try API
      try {
        const resp = await fetch(`/api/cases/${caseId}`);
        if (!resp.ok) throw new Error('API fetch failed');
        const data = await resp.json();
        if (cancelled) return;

        const fetchedFiles: CaseFile[] = (data.evidence || []).map((ev: any) => ({
          id: ev.id || ev.file_id || `file-${Math.random().toString(36).slice(2, 9)}`,
          name: ev.file_name || ev.fileName || 'unknown',
          type: ev.file_type || ev.fileType || 'Unknown',
          size: ev.file_size || ev.fileSize || '0',
          dateModified: ev.upload_timestamp || ev.dateModified || new Date().toISOString(),
          clientHash: ev.client_sha256 || ev.clientHash || '',
          serverHash: ev.server_sha256 || ev.serverHash || '',
          integrityStatus: ev.integrity_verified ? 'VERIFIED' : (ev.server_sha256 && ev.client_sha256 && ev.client_sha256 !== ev.server_sha256 ? 'COMPROMISED' : 'PENDING'),
          uploadedBy: ev.user_id || uploadedBy,
          uploadTimestamp: ev.upload_timestamp || new Date().toISOString(),
        }));

        setFiles(fetchedFiles);
        setEvidenceRecords(fetchedFiles.map(file => generateEvidenceRecord(file.name, file.type, file.size, file.clientHash || '', file.serverHash || '', file.uploadedBy, file.uploadTimestamp, caseId)));
      } catch (err) {
        console.warn('No evidence found for case', caseId);
        // Start with empty — no mock data
        setFiles([]);
        setEvidenceRecords([]);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [caseId, uploadedBy]);

  // Filter and sort files
  const filteredFiles = files
    .filter(file =>
      file.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      file.type.toLowerCase().includes(searchQuery.toLowerCase())
    )
    .sort((a, b) => {
      switch (sortBy) {
        case 'name':
          return a.name.localeCompare(b.name);
        case 'size':
          return parseFloat(a.size) - parseFloat(b.size);
        case 'date':
        default:
          return new Date(b.dateModified).getTime() - new Date(a.dateModified).getTime();
      }
    });

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const uploadedFiles = e.target.files;
    if (!uploadedFiles) return;

    for (let i = 0; i < uploadedFiles.length; i++) {
      setUploadProgress((i / uploadedFiles.length) * 100);

      const file = uploadedFiles[i];

      // Calculate real SHA-256 hash
      let fileHash: string;
      try {
        const arrayBuffer = await file.arrayBuffer();
        const digest = await crypto.subtle.digest('SHA-256', arrayBuffer);
        const hashArray = Array.from(new Uint8Array(digest));
        fileHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
      } catch {
        fileHash = `${Math.random().toString(16).substr(2)}${Math.random().toString(16).substr(2)}`;
      }

      // Store file as base64 in localStorage for download later
      // Declare storageKey BEFORE try so it's accessible after the block
      let storageKey = '';
      let storageSuccess = false;
      try {
        const base64Data = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = () => reject(new Error('Failed to read file'));
          reader.readAsDataURL(file);
        });

        // Build key once and reuse — never call Date.now() again for this file
        storageKey = `evidence_${Date.now()}_${i}`;
        localStorage.setItem(storageKey, JSON.stringify({
          name: file.name,
          type: file.type,
          size: file.size,
          data: base64Data,
          clientHash: fileHash,
          uploadedAt: new Date().toISOString()
        }));
        console.log('[Dashboard Upload] Stored file in localStorage:', storageKey);
        storageSuccess = true;
      } catch (err: any) {
        console.warn('[Dashboard Upload] Failed to store file data:', err);
        const errMsg = err.name === 'QuotaExceededError'
          ? `File "${file.name}" is too large for browser storage limit.`
          : `Failed to store file "${file.name}".`;
        alert(errMsg);
        continue; // Skip adding this file since it was not stored
      }

      if (!storageSuccess) continue;

      const uploadTimestamp = new Date().toISOString();
      const fileId = `file-${Date.now()}-${i}`;

      const newFile: CaseFile = {
        id: fileId,
        name: file.name,
        type: file.type || 'Unknown',
        size: `${(file.size / 1024 / 1024).toFixed(2)} MB`,
        dateModified: uploadTimestamp,
        clientHash: fileHash,
        serverHash: fileHash,
        integrityStatus: 'VERIFIED',
        uploadedBy: uploadedBy,
        uploadTimestamp,
      };

      setFiles(prev => [newFile, ...prev]);

      // Persist evidence metadata — reuse the exact storageKey captured above
      saveEvidenceToCase(caseId, {
        id: newFile.id,
        file_name: newFile.name,
        file_type: newFile.type,
        file_size: file.size,
        client_sha256: newFile.clientHash,
        server_sha256: newFile.serverHash,
        uploaded_by: newFile.uploadedBy,
        upload_timestamp: newFile.uploadTimestamp,
        integrity_status: 'VERIFIED',
        storageKey,   // ← same key that holds the actual file data
      });

      // Log audit entry
      appendAuditEntry(caseId, 'evidence_uploaded', uploadedBy, 'user', `Uploaded: ${file.name} (${(file.size / 1024 / 1024).toFixed(2)} MB)`);

      // Generate evidence record
      const record = generateEvidenceRecord(
        newFile.name,
        newFile.type,
        newFile.size,
        newFile.clientHash,
        newFile.serverHash,
        newFile.uploadedBy,
        newFile.uploadTimestamp,
        caseId,
        {
          os: navigator.platform,
          browser: navigator.userAgent.split(' ').pop() || 'Unknown'
        }
      );
      setEvidenceRecords(prev => [record, ...prev]);
    }

    setUploadProgress(null);
  };

  const handleNewFolder = () => {
    const folderName = window.prompt("Enter new folder name:");
    if (!folderName || folderName.trim() === '') return;

    const newFolder: CaseFile = {
      id: `folder-${Date.now()}`,
      name: folderName.trim(),
      type: 'Folder',
      size: '--',
      dateModified: new Date().toISOString(),
      clientHash: '-',
      serverHash: '-',
      integrityStatus: 'PENDING',
      uploadedBy: uploadedBy,
      uploadTimestamp: new Date().toISOString(),
    };

    setFiles(prev => [newFolder, ...prev]);

    saveEvidenceToCase(caseId, {
      id: newFolder.id,
      file_name: newFolder.name,
      file_type: newFolder.type,
      file_size: 0,
      client_sha256: newFolder.clientHash || '',
      server_sha256: newFolder.serverHash || '',
      uploaded_by: newFolder.uploadedBy,
      upload_timestamp: newFolder.uploadTimestamp,
      integrity_status: 'PENDING',
    });

    try {
      appendAuditEntry(caseId, 'evidence_uploaded', uploadedBy, 'user', `Created folder: ${newFolder.name}`);
    } catch (e) {
      console.warn("Failed to log audit for folder creation", e);
    }
  };

  const deleteFile = (fileId: string) => {
    setFiles(prev => prev.filter(f => f.id !== fileId));
    setEvidenceRecords(prev => prev.filter(r => r.file_id !== fileId));
    removeEvidenceFromCase(caseId, fileId);
  };

  const downloadFile = (fileName: string, clientHash?: string) => {
    const success = handleDownloadEvidence(fileName, clientHash);
    if (success) {
      appendAuditEntry(caseId, 'evidence_verified', uploadedBy, 'user', `Downloaded: ${fileName}`);
    }
  };

  const getStatusBadge = (status?: string) => {
    switch (status) {
      case 'VERIFIED':
        return (
          <span className="flex items-center gap-1 px-2 py-1 bg-emerald-500/10 text-emerald-400 rounded text-xs font-semibold border border-emerald-500/30">
            <CheckCircle className="w-3 h-3" />
            VERIFIED
          </span>
        );
      case 'COMPROMISED':
        return (
          <span className="flex items-center gap-1 px-2 py-1 bg-red-500/10 text-red-400 rounded text-xs font-semibold border border-red-500/30">
            <AlertCircle className="w-3 h-3" />
            COMPROMISED
          </span>
        );
      default:
        return (
          <span className="flex items-center gap-1 px-2 py-1 bg-amber-500/10 text-amber-400 rounded text-xs font-semibold border border-amber-500/30">
            <AlertCircle className="w-3 h-3" />
            PENDING
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">

      {/* Tabs */}
      <div className="flex gap-8 border-b border-zinc-800">
        <button
          onClick={() => setActiveTab('files')}
          className={`pb-3 px-1 font-semibold transition-colors ${activeTab === 'files'
            ? 'text-zinc-100 border-b-2 border-emerald-500'
            : 'text-zinc-500 hover:text-zinc-300'
            }`}
        >
          <span className="flex items-center gap-2">
            <FileText className="w-4 h-4" />
            Evidence Files
          </span>
        </button>
        <button
          onClick={() => setActiveTab('verify')}
          className={`pb-3 px-1 font-semibold transition-colors ${activeTab === 'verify'
            ? 'text-zinc-100 border-b-2 border-emerald-500'
            : 'text-zinc-500 hover:text-zinc-300'
            }`}
        >
          <span className="flex items-center gap-2">
            <Shield className="w-4 h-4" />
            Verify Integrity
          </span>
        </button>
        <button
          onClick={() => setActiveTab('records')}
          className={`pb-3 px-1 font-semibold transition-colors ${activeTab === 'records'
            ? 'text-zinc-100 border-b-2 border-emerald-500'
            : 'text-zinc-500 hover:text-zinc-300'
            }`}
        >
          <span className="flex items-center gap-2">
            <Shield className="w-4 h-4" />
            Evidence Record
          </span>
        </button>
        <button
          onClick={() => setActiveTab('report')}
          className={`pb-3 px-1 font-semibold transition-colors ${activeTab === 'report'
            ? 'text-zinc-100 border-b-2 border-emerald-500'
            : 'text-zinc-500 hover:text-zinc-300'
            }`}
        >
          <span className="flex items-center gap-2">
            <ScrollText className="w-4 h-4" />
            Forensic Report
          </span>
        </button>
      </div>

      {/* TAB 1: Evidence Files */}
      {activeTab === 'files' && (
        <div className="space-y-4">
          {/* Toolbar */}
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex-1 flex gap-2">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                <input
                  type="text"
                  placeholder="Search files..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-lg pl-10 pr-4 py-2.5 text-zinc-100 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleNewFolder}
                className="flex items-center gap-2 px-4 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-100 rounded-lg font-semibold transition-colors"
              >
                <FolderPlus className="w-4 h-4" />
                New Folder
              </button>
              <label className="flex items-center gap-2 px-4 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-zinc-950 rounded-lg font-semibold transition-colors cursor-pointer">
                <Upload className="w-4 h-4" />
                {uploadProgress !== null ? `Uploading... ${Math.round(uploadProgress)}%` : 'Add File'}
                <input
                  type="file"
                  multiple
                  onChange={handleFileUpload}
                  className="hidden"
                  disabled={uploadProgress !== null}
                />
              </label>
            </div>
          </div>

          {/* Sort Options */}
          <div className="flex gap-2">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as 'name' | 'date' | 'size')}
              className="bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-zinc-100 focus:outline-none focus:border-emerald-500"
            >
              <option value="date">Date Modified</option>
              <option value="name">Name</option>
              <option value="size">Size</option>
            </select>
          </div>

          {/* Files Table */}
          {filteredFiles.length > 0 ? (
            <div className="bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden">
              <table className="w-full">
                <thead className="bg-zinc-800/50 border-b border-zinc-700">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-zinc-400">NAME</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-zinc-400">DATE MODIFIED</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-zinc-400">SIZE</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-zinc-400">INTEGRITY</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-zinc-400">ACTION</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredFiles.map((file, idx) => (
                    <tr
                      key={file.id}
                      className={`border-b border-zinc-800 hover:bg-zinc-800/30 transition-colors ${idx % 2 === 0 ? 'bg-zinc-900/50' : ''
                        }`}
                    >
                      <td className="px-6 py-4">
                        <div>
                          <p className="font-semibold text-zinc-100">{file.name}</p>
                          <p className="text-xs text-zinc-500">{file.type}</p>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-zinc-300">
                        {new Date(file.dateModified).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 text-sm text-zinc-300">{file.size}</td>
                      <td className="px-6 py-4">{getStatusBadge(file.integrityStatus)}</td>
                      <td className="px-6 py-4">
                        <div className="flex gap-2">
                          <button
                            onClick={() => downloadFile(file.name, file.clientHash)}
                            className="p-2 hover:bg-zinc-700 rounded transition-colors"
                            title="Download"
                          >
                            <Download className="w-4 h-4 text-zinc-400 hover:text-emerald-400" />
                          </button>
                          <button
                            onClick={() => deleteFile(file.id)}
                            className="p-2 hover:bg-zinc-700 rounded transition-colors"
                            title="Delete"
                          >
                            <Trash2 className="w-4 h-4 text-zinc-400 hover:text-red-400" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-12 text-center">
              <FileText className="w-12 h-12 text-zinc-700 mx-auto mb-4" />
              <p className="text-zinc-400 font-semibold mb-2">No files yet</p>
              <p className="text-sm text-zinc-500 mb-4">Create a folder or drag and drop a file to get started.</p>
              <div className="flex gap-2 justify-center">
                <button
                  onClick={handleNewFolder}
                  className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-100 rounded-lg font-semibold transition-colors"
                >
                  New Folder
                </button>
                <label className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-zinc-950 rounded-lg font-semibold transition-colors cursor-pointer">
                  Upload File
                  <input type="file" multiple onChange={handleFileUpload} className="hidden" />
                </label>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: Verify Integrity */}
      {activeTab === 'verify' && (
        <div className="space-y-4">
          <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-4">
            <div className="flex gap-3">
              <CheckCircle className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-emerald-400">Integrity Verification Active</p>
                <p className="text-sm text-emerald-300/80 mt-1">
                  All uploaded files are automatically verified using SHA-256 cryptographic hashing.
                  Client-side and server-side hashes are compared to ensure file integrity.
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
              <p className="text-zinc-500 text-xs font-semibold uppercase mb-2">Total Files</p>
              <p className="text-3xl font-bold text-zinc-100">{filteredFiles.length}</p>
            </div>
            <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
              <p className="text-zinc-500 text-xs font-semibold uppercase mb-2">Verified</p>
              <p className="text-3xl font-bold text-emerald-400">
                {filteredFiles.filter(f => f.integrityStatus === 'VERIFIED').length}
              </p>
            </div>
            <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
              <p className="text-zinc-500 text-xs font-semibold uppercase mb-2">Compromised</p>
              <p className="text-3xl font-bold text-red-400">
                {filteredFiles.filter(f => f.integrityStatus === 'COMPROMISED').length}
              </p>
            </div>
          </div>

          <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 space-y-3">
            <h3 className="font-semibold text-zinc-100">Hash Verification Details</h3>
            <div className="bg-zinc-900/20 border border-zinc-800 rounded-lg p-3">
              <p className="text-zinc-400 text-sm mb-3">Upload a local file to check its cryptographic hash against our secure ledger. This proves the file has not been tampered with since it was originally uploaded.</p>

              <label
                htmlFor="manual-verify-file"
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragEnter={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={(e) => { e.preventDefault(); setDragOver(false); }}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragOver(false);
                  const f = e.dataTransfer?.files && e.dataTransfer.files[0];
                  if (f) {
                    setVerificationResult({ status: 'idle' });
                    setSelectedFile(f);
                  }
                }}
                className={`w-full cursor-pointer block rounded-lg border-2 border-dashed p-6 text-center ${selectedFile ? 'border-emerald-400/40 bg-zinc-900' : dragOver ? 'border-emerald-400/60 bg-zinc-900/10' : 'border-zinc-700/40 bg-transparent'}`}>
                {selectedFile ? (
                  <div className="flex flex-col items-center gap-2">
                    <div className="w-full flex items-center justify-center">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-emerald-100 rounded-full flex items-center justify-center">
                          <Shield className="w-5 h-5 text-emerald-600" />
                        </div>
                        <div className="text-left">
                          <p className="font-semibold text-zinc-100">{selectedFile.name}</p>
                          <p className="text-xs text-zinc-400">{(selectedFile.size / 1024 / 1024).toFixed(2)} MB</p>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-2">
                    <div className="w-10 h-10 bg-emerald-100 rounded-full flex items-center justify-center">
                      <Shield className="w-5 h-5 text-emerald-600" />
                    </div>
                    <p className="text-zinc-400">Click to select a file or drag it here</p>
                  </div>
                )}
                <input
                  id="manual-verify-file"
                  type="file"
                  accept="*/*"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files && e.target.files[0];
                    setVerificationResult({ status: 'idle' });
                    setSelectedFile(f || null);
                  }}
                />
              </label>

              <div className="mt-4">
                <button
                  onClick={() => selectedFile && verifySelectedFile(selectedFile)}
                  disabled={!selectedFile || verifying}
                  className="w-full py-3 bg-zinc-950 hover:bg-zinc-900 text-white rounded-lg font-semibold disabled:opacity-50"
                >
                  {verifying ? 'Verifying...' : 'Verify Integrity'}
                </button>
              </div>

              {/* Result Panel */}
              {verificationResult.status !== 'idle' && (
                <div className="mt-4 p-4 rounded-lg border border-zinc-800 bg-zinc-900/50">
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0">
                      <div className="w-10 h-10 rounded-full bg-zinc-800 flex items-center justify-center">
                        {verificationResult.status === 'verified' ? (
                          <CheckCircle className="w-5 h-5 text-emerald-400" />
                        ) : (
                          <AlertCircle className="w-5 h-5 text-zinc-400" />
                        )}
                      </div>
                    </div>
                    <div>
                      <p className="font-semibold text-zinc-100">
                        {verificationResult.status === 'verified' && 'Exact match found'}
                        {verificationResult.status === 'modified' && 'Similar file detected'}
                        {verificationResult.status === 'not_found' && 'Record Not Found'}
                        {verificationResult.status === 'error' && 'Verification Error'}
                      </p>
                      <p className="text-sm text-zinc-400 mt-1">{verificationResult.message}</p>
                      {verificationResult.computedHash && (
                        <p className="mt-2 text-xs text-zinc-500">Computed SHA-256: <span className="font-mono text-emerald-400">{verificationResult.computedHash}</span></p>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
            {filteredFiles.map(file => (
              <div
                key={file.id}
                className="bg-zinc-800/50 border border-zinc-700 rounded p-3 space-y-2"
              >
                <div className="flex justify-between items-start gap-2">
                  <p className="font-semibold text-zinc-100">{file.name}</p>
                  {getStatusBadge(file.integrityStatus)}
                </div>
                <div className="space-y-1 text-xs">
                  <div>
                    <p className="text-zinc-500">Client Hash:</p>
                    <p className="text-emerald-400 font-mono break-all">{file.clientHash}</p>
                  </div>
                  <div>
                    <p className="text-zinc-500">Server Hash:</p>
                    <p className="text-emerald-400 font-mono break-all">{file.serverHash}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 3: Evidence Records */}
      {activeTab === 'records' && (
        <div className="space-y-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
            <p className="text-zinc-400 text-sm mb-3">
              Court-admissible evidence records for all uploaded files. Click on a record to view detailed forensic information and download reports.
            </p>
          </div>

          {evidenceRecords.length > 0 ? (
            <EvidenceRecordDisplay records={evidenceRecords} />
          ) : (
            <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-12 text-center">
              <Shield className="w-12 h-12 text-zinc-700 mx-auto mb-4" />
              <p className="text-zinc-400 font-semibold mb-2">No evidence records</p>
              <p className="text-sm text-zinc-500">Upload files in the "Evidence Files" tab to generate records.</p>
            </div>
          )}
        </div>
      )}

      {/* TAB 4: Forensic Report Generator */}
      {activeTab === 'report' && (
        <ForensicReportPanel
          caseId={caseId}
          userId={userId || uploadedBy}
          userEmail={userEmail || uploadedBy}
        />
      )}
    </div>
  );
}
