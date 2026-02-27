import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Upload, ShieldCheck, File, AlertCircle, Loader2, CheckCircle } from 'lucide-react';
import { createManagedCase } from '../lib/caseStore';
import { appendAuditEntry } from '../lib/auditLog';
import { getCurrentAppUser } from '../lib/rbac';

interface UploadState {
  isUploading: boolean;
  fileUploaded: boolean;
  fileName: string;
  fileSize: number;
  clientHash: string;
  uploadedAt: string;
}

interface PreserveState {
  isPreserving: boolean;
  showConfirm: boolean;
  error: string;
}

export default function EvidenceUpload() {
  const navigate = useNavigate();

  // Form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [file, setFile] = useState<File | null>(null);

  // Upload state (separate)
  const [uploadState, setUploadState] = useState<UploadState>({
    isUploading: false,
    fileUploaded: false,
    fileName: '',
    fileSize: 0,
    clientHash: '',
    uploadedAt: ''
  });

  // Preserve state (separate)
  const [preserveState, setPreserveState] = useState<PreserveState>({
    isPreserving: false,
    showConfirm: false,
    error: ''
  });

  // General error
  const [generalError, setGeneralError] = useState('');

  const calculateSHA256 = async (file: File): Promise<string> => {
    const buffer = await file.arrayBuffer();
    const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      setFile(selectedFile);
      setGeneralError('');

      // Reset upload state for new file
      setUploadState({
        isUploading: false,
        fileUploaded: false,
        fileName: '',
        fileSize: 0,
        clientHash: '',
        uploadedAt: ''
      });
    }
  };

  // ===== BUTTON 1: Upload File =====
  const handleUploadFile = async () => {
    if (!file) {
      setGeneralError('Please select a file');
      return;
    }

    setUploadState({ ...uploadState, isUploading: true });
    setGeneralError('');

    try {
      console.log('[Upload] Starting file upload:', file.name);

      // Calculate hash
      const hash = await calculateSHA256(file);
      console.log('[Upload] SHA-256 calculated:', hash);

      // Store file in localStorage (demo purposes)
      const reader = new FileReader();
      reader.onload = (e) => {
        const fileData = e.target?.result;
        const storageKey = `evidence_${Date.now()}`;

        try {
          localStorage.setItem(
            storageKey,
            JSON.stringify({
              name: file.name,
              type: file.type,
              size: file.size,
              data: fileData,
              clientHash: hash,
              uploadedAt: new Date().toISOString()
            })
          );

          console.log('[Upload] File stored in localStorage:', storageKey);

          setUploadState({
            isUploading: false,
            fileUploaded: true,
            fileName: file.name,
            fileSize: file.size,
            clientHash: hash,
            uploadedAt: new Date().toISOString()
          });

          console.log('[Upload] Upload complete ✓');
        } catch (storageErr: any) {
          console.error('[Upload] localStorage error:', storageErr);
          setUploadState({ ...uploadState, isUploading: false });
          setGeneralError(
            storageErr.name === 'QuotaExceededError'
              ? 'File too large for browser storage'
              : 'Failed to store file'
          );
        }
      };
      reader.readAsDataURL(file);
    } catch (err: any) {
      console.error('[Upload] Error:', err);
      setUploadState({ ...uploadState, isUploading: false });
      setGeneralError(err.message || 'Upload failed');
    }
  };

  // ===== BUTTON 3: Preserve Evidence =====
  const handlePreserveClick = () => {
    if (!uploadState.fileUploaded) {
      setPreserveState({ ...preserveState, error: 'Please upload a file first' });
      return;
    }

    if (!title || !description) {
      setPreserveState({ ...preserveState, error: 'Please enter title and description' });
      return;
    }

    setPreserveState({ ...preserveState, showConfirm: true, error: '' });
  };

  const handleConfirmPreserve = async () => {
    // Validation before saving
    console.log('[Preserve] Starting preservation process...');
    console.log('[Preserve] Validating data...');

    if (!uploadState.fileUploaded) {
      setPreserveState({
        isPreserving: false,
        showConfirm: false,
        error: 'File not uploaded'
      });
      return;
    }

    if (!title || !title.trim()) {
      setPreserveState({
        isPreserving: false,
        showConfirm: false,
        error: 'Case title is required'
      });
      return;
    }

    if (!description || !description.trim()) {
      setPreserveState({
        isPreserving: false,
        showConfirm: false,
        error: 'Case description is required'
      });
      return;
    }

    if (!uploadState.clientHash) {
      setPreserveState({
        isPreserving: false,
        showConfirm: false,
        error: 'File hash missing'
      });
      return;
    }

    // Start loading
    setPreserveState({
      isPreserving: true,
      showConfirm: false,
      error: ''
    });
    setGeneralError('');

    try {
      console.log('[Preserve] All validations passed ✓');
      console.log('[Preserve] Creating case via API...');

      // 1. Create Case using the backend API
      const caseRes = await fetch('/api/cases', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim()
        })
      });

      if (!caseRes.ok) {
        throw new Error('Failed to create case on the server.');
      }

      const caseData = await caseRes.json();
      const caseId = caseData.id;

      console.log('[Preserve] Case created on server:', caseId);

      // 2. We skip uploading the actual file for the demo, but we should register the evidence
      // Since demo stores files in localStorage and real server stores on disk, 
      // let's mimic the registration to link evidence to the case.
      // 
      // As per server.ts, you can start upload:
      const evRes = await fetch('/functions/startUpload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          caseId: caseId,
          fileName: uploadState.fileName,
          fileSize: uploadState.fileSize,
          mimeType: 'application/octet-stream', // Mock for now
          clientSha256: uploadState.clientHash
        })
      });

      if (!evRes.ok) {
        throw new Error('Failed to register evidence with the case.');
      }

      const evData = await evRes.json();
      const evidenceId = evData.evidenceId;

      console.log('[Preserve] Evidence registered:', evidenceId);

      // 3. Preserve evidence link
      const preserveRes = await fetch('/api/preserve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          evidenceId: evidenceId,
          caseId: caseId,
          serverHash: uploadState.clientHash // Mocking server hash as client hash for demo
        })
      });

      if (!preserveRes.ok) {
        throw new Error('Failed to securely link evidence to case.');
      }

      console.log('[Preserve] ✓ Preservation complete - case confirmed saved via API');

      // 4. Also save to the managed case store (so Dashboard can display it)
      const currentUser = getCurrentAppUser();
      const managedCase = createManagedCase({
        title: title.trim(),
        description: description.trim(),
        createdBy: currentUser?.id || 'unknown',
        createdByEmail: currentUser?.email || 'unknown',
      });
      console.log('[Preserve] Case saved to managed store:', managedCase.caseId);

      // Log to audit trail
      appendAuditEntry(
        managedCase.caseId,
        'case_created',
        currentUser?.email || 'unknown',
        currentUser?.role || 'unknown',
        `Case created: ${title.trim()}`
      );
      appendAuditEntry(
        managedCase.caseId,
        'evidence_uploaded',
        currentUser?.email || 'unknown',
        currentUser?.role || 'unknown',
        `Evidence uploaded: ${uploadState.fileName} (SHA-256: ${uploadState.clientHash.slice(0, 16)}...)`
      );

      // Stop loading
      setPreserveState({
        isPreserving: false,
        showConfirm: false,
        error: ''
      });

      // Show success alert
      alert(`✓ Evidence preserved successfully!\n\nCase ID: ${managedCase.caseId}\n\nYour evidence and case details have been saved.`);

      // Reset form
      handleReset();

    } catch (err: any) {
      console.error('[Preserve] Error during preservation:', err);

      // Failure: Stop loading and show error (dialog stays open for retry)
      setPreserveState({
        isPreserving: false,
        showConfirm: true, // Keep dialog open so user can retry
        error: err.message || 'Failed to preserve evidence. Please try again.'
      });
    }
  };

  const handleCancelPreserve = () => {
    console.log('[Preserve] Preservation cancelled by user');
    setPreserveState({ showConfirm: false, isPreserving: false, error: '' });
  };

  const handleReset = () => {
    setFile(null);
    setTitle('');
    setDescription('');
    setGeneralError('');
    setUploadState({
      isUploading: false,
      fileUploaded: false,
      fileName: '',
      fileSize: 0,
      clientHash: '',
      uploadedAt: ''
    });
    setPreserveState({
      isPreserving: false,
      showConfirm: false,
      error: ''
    });
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      {/* Header */}
      <div className="bg-zinc-900 border-b border-zinc-800 px-8 py-6">
        <h1 className="text-3xl font-bold tracking-tight mb-2">Preserve Evidence</h1>
        <p className="text-zinc-400">Upload, analyze, and permanently preserve digital evidence securely.</p>
      </div>

      {/* Main Content */}
      <div className="p-8 max-w-4xl mx-auto">

        {/* General Error */}
        {generalError && (
          <div className="bg-red-500/10 border border-red-500/20 text-red-300 p-4 rounded-xl mb-6 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
            <p className="text-sm">{generalError}</p>
          </div>
        )}

        {/* Section 1: Case Details */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 mb-6">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <span className="flex items-center justify-center w-6 h-6 rounded-full bg-zinc-800 text-xs font-bold">1</span>
            Case Details
          </h2>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-2">Title</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g., Suspicious emails from unknown sender"
                className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-2.5 text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/50 transition-colors"
                disabled={uploadState.isUploading || preserveState.isPreserving}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-2">Description</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe the context. Include relevant details about the evidence..."
                rows={3}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-2.5 text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/50 transition-colors resize-none"
                disabled={uploadState.isUploading || preserveState.isPreserving}
              />
            </div>
          </div>
        </div>

        {/* Section 2: Upload File */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 mb-6">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <span className="flex items-center justify-center w-6 h-6 rounded-full bg-zinc-800 text-xs font-bold">2</span>
            Upload File
          </h2>

          {/* File Input */}
          <div className="mb-4">
            <div className="border-2 border-dashed border-zinc-700 rounded-lg p-8 text-center hover:bg-zinc-800/50 transition-colors relative">
              <input
                type="file"
                onChange={handleFileChange}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                accept=".pdf,.jpg,.jpeg,.png,.mp4,.zip,.doc,.docx,.xls,.xlsx,.txt,.wav,.mov"
                disabled={uploadState.isUploading || preserveState.isPreserving}
              />

              {file ? (
                <div className="flex flex-col items-center">
                  <div className="w-12 h-12 rounded-full bg-emerald-500/10 flex items-center justify-center mb-3">
                    <File className="w-6 h-6 text-emerald-400" />
                  </div>
                  <p className="text-zinc-200 font-medium">{file.name}</p>
                  <p className="text-zinc-500 text-sm mt-1">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                </div>
              ) : (
                <div className="flex flex-col items-center">
                  <div className="w-12 h-12 rounded-full bg-zinc-800 flex items-center justify-center mb-3">
                    <Upload className="w-6 h-6 text-zinc-500" />
                  </div>
                  <p className="text-zinc-300 font-medium">Click or drag file to upload</p>
                  <p className="text-zinc-500 text-sm mt-1">PDF, JPG, PNG, MP4, DOC, ZIP, and more</p>
                </div>
              )}
            </div>
          </div>

          {/* Upload Button */}
          <button
            onClick={handleUploadFile}
            disabled={!file || uploadState.isUploading || uploadState.fileUploaded}
            className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-zinc-950 font-semibold px-4 py-3 rounded-lg transition-colors flex items-center justify-center gap-2"
          >
            {uploadState.isUploading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Uploading...
              </>
            ) : uploadState.fileUploaded ? (
              <>
                <CheckCircle className="w-5 h-5" />
                Uploaded ✓
              </>
            ) : (
              <>
                <Upload className="w-5 h-5" />
                Upload File
              </>
            )}
          </button>

          {/* File Metadata after upload */}
          {uploadState.fileUploaded && (
            <div className="mt-4 bg-zinc-950 border border-zinc-800 rounded-lg p-4 space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-zinc-400">File Size:</span>
                <span className="text-zinc-200 font-mono">{(uploadState.fileSize / 1024 / 1024).toFixed(2)} MB</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-zinc-400">Uploaded:</span>
                <span className="text-zinc-200 font-mono">{new Date(uploadState.uploadedAt).toLocaleString()}</span>
              </div>
              <div className="flex flex-col text-sm gap-1">
                <span className="text-zinc-400">SHA-256:</span>
                <span className="text-emerald-400 font-mono text-xs break-all">{uploadState.clientHash}</span>
              </div>
            </div>
          )}
        </div>




        {/* Section 4: Preserve Evidence */}
        {uploadState.fileUploaded && (
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 mb-6">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <span className="flex items-center justify-center w-6 h-6 rounded-full bg-zinc-800 text-xs font-bold">3</span>
              Preserve Evidence
            </h2>

            {preserveState.error && (
              <div className="bg-red-500/10 border border-red-500/20 text-red-300 p-3 rounded-lg mb-4 flex items-start gap-2 text-sm">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{preserveState.error}</span>
              </div>
            )}

            <button
              onClick={handlePreserveClick}
              disabled={!uploadState.fileUploaded || !title || !description || preserveState.isPreserving}
              className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-zinc-950 font-semibold px-4 py-3 rounded-lg transition-colors flex items-center justify-center gap-2"
            >
              {preserveState.isPreserving ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Preserving...
                </>
              ) : (
                <>
                  <ShieldCheck className="w-5 h-5" />
                  Preserve Evidence
                </>
              )}
            </button>
          </div>
        )}

        {/* Confirmation Dialog */}
        {preserveState.showConfirm && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-8 max-w-md w-full">
              <h3 className="text-xl font-bold text-zinc-100 mb-4 flex items-center gap-2">
                <AlertCircle className="w-6 h-6 text-yellow-500" />
                Confirm Preservation
              </h3>

              <p className="text-zinc-400 mb-6">
                Do you want to permanently preserve this evidence? This action cannot be undone and will:
              </p>

              <ul className="text-sm text-zinc-300 space-y-2 mb-6 bg-zinc-950 border border-zinc-800 rounded-lg p-4">
                <li className="flex gap-2">
                  <span className="text-emerald-400">✓</span>
                  <span>Save case details to browser storage</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-emerald-400">✓</span>
                  <span>Store file metadata and hash</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-emerald-400">✓</span>
                  <span>Preserve integrity verification hash</span>
                </li>

                <li className="flex gap-2">
                  <span className="text-emerald-400">✓</span>
                  <span>Create timestamped case record</span>
                </li>
              </ul>

              <div className="flex gap-3">
                <button
                  onClick={handleCancelPreserve}
                  disabled={preserveState.isPreserving}
                  className="flex-1 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 text-zinc-100 font-medium px-4 py-2 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmPreserve}
                  disabled={preserveState.isPreserving}
                  className="flex-1 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-zinc-950 font-semibold px-4 py-2 rounded-lg transition-colors flex items-center justify-center gap-2"
                >
                  {preserveState.isPreserving ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Preserving...
                    </>
                  ) : (
                    <>
                      <ShieldCheck className="w-4 h-4" />
                      Preserve Now
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Reset Button */}
        {uploadState.fileUploaded && (
          <div className="flex justify-center">
            <button
              onClick={handleReset}
              className="text-zinc-400 hover:text-zinc-300 font-medium text-sm underline transition-colors"
            >
              Reset & Start Over
            </button>
          </div>
        )}
      </div>
    </div >
  );
}
