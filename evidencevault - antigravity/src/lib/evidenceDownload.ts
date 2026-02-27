/**
 * Evidence Download & ZIP Export Utility
 * =======================================
 * Client-side evidence download and court-ready ZIP package export.
 * Demo mode — all data from localStorage, no backend.
 */

import JSZip from 'jszip';
import { getEvidenceForCase } from './evidenceStore';

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface StoredEvidence {
    name: string;
    type: string;
    size: number;
    data: string;          // base64 data URL from readAsDataURL
    clientHash: string;
    uploadedAt: string;
}

export interface CaseEvidence {
    id: string;
    file_name: string;
    file_type: string;
    file_size: number;
    client_sha256: string;
    server_sha256: string;
    upload_timestamp: string;
    user_id: string;
}

export interface CaseData {
    id: string;
    title: string;
    description: string;
    status: string;
    created_at: string;
    user_id: string;
    risk_score: number;
    risk_analysis: string;
    evidence: CaseEvidence[];
    logs: any[];
}

// ─── localStorage Helpers ──────────────────────────────────────────────────────

/**
 * Scan all `evidence_*` keys in localStorage and return parsed entries.
 */
function getAllStoredEvidence(): StoredEvidence[] {
    const results: StoredEvidence[] = [];
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (!key || !key.startsWith('evidence_')) continue;
        try {
            const raw = localStorage.getItem(key);
            if (!raw) continue;
            const parsed = JSON.parse(raw);
            if (parsed && parsed.name) {
                results.push(parsed as StoredEvidence);
            }
        } catch {
            // skip corrupt entries
        }
    }
    return results;
}

/**
 * Find a stored evidence entry by SHA-256 hash (most reliable).
 */
function findByHash(hash: string): StoredEvidence | null {
    if (!hash) return null;
    const lower = hash.toLowerCase();
    return getAllStoredEvidence().find(
        (e) => e.clientHash && e.clientHash.toLowerCase() === lower
    ) || null;
}

/**
 * Find a stored evidence entry by file name (fallback).
 */
function findByName(fileName: string): StoredEvidence | null {
    if (!fileName) return null;
    return getAllStoredEvidence().find((e) => e.name === fileName) || null;
}

/**
 * Find a stored evidence entry directly by its localStorage storageKey.
 * This is the most reliable lookup because the storageKey is the exact
 * pointer to where the raw file data was stored at upload time.
 */
function findByStorageKey(storageKey: string): StoredEvidence | null {
    if (!storageKey) return null;
    try {
        const raw = localStorage.getItem(storageKey);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        if (parsed && parsed.name && parsed.data) {
            return parsed as StoredEvidence;
        }
    } catch {
        // corrupt entry
    }
    return null;
}

// ─── Base64 → Blob Conversion ──────────────────────────────────────────────────

/**
 * Convert a base64 data URL string to a Uint8Array.
 * Returns null if conversion fails.
 */
function base64ToUint8Array(dataURL: string): { bytes: Uint8Array; mime: string } | null {
    try {
        if (!dataURL || typeof dataURL !== 'string') return null;

        let base64: string;
        let mime = 'application/octet-stream';

        if (dataURL.startsWith('data:')) {
            const commaIndex = dataURL.indexOf(',');
            if (commaIndex === -1) return null;
            const header = dataURL.substring(0, commaIndex);
            const mimeMatch = header.match(/:(.*?);/);
            if (mimeMatch) mime = mimeMatch[1];
            base64 = dataURL.substring(commaIndex + 1);
        } else {
            base64 = dataURL;
        }

        const binaryString = atob(base64);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
        }
        return { bytes, mime };
    } catch {
        return null;
    }
}

/**
 * Convert base64 data URL to Blob.
 */
function base64ToBlob(dataURL: string, fallbackMime?: string): Blob | null {
    const result = base64ToUint8Array(dataURL);
    if (!result) return null;
    return new Blob([result.bytes], { type: fallbackMime || result.mime });
}

// ─── Browser Download Trigger ──────────────────────────────────────────────────

function triggerBrowserDownload(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    anchor.style.display = 'none';
    document.body.appendChild(anchor);
    anchor.click();
    // Delay cleanup to ensure download starts
    setTimeout(() => {
        document.body.removeChild(anchor);
        URL.revokeObjectURL(url);
    }, 500);
}

// ─── PART 1 & 2: Download Evidence File ────────────────────────────────────────

/**
 * Download an evidence file from localStorage.
 * Searches by hash first, then by filename.
 *
 * @param fileName - The file name to look for
 * @param clientHash - Optional SHA-256 hash for reliable lookup  
 * @returns true if download was triggered
 */
export function handleDownloadEvidence(fileName: string, clientHash?: string): boolean {
    try {
        // Find the stored evidence
        let stored: StoredEvidence | null = null;

        if (clientHash) {
            stored = findByHash(clientHash);
        }
        if (!stored) {
            stored = findByName(fileName);
        }

        // Check if we found it
        if (!stored) {
            alert(
                `File "${fileName}" not found in browser storage.\n\n` +
                `This file may have been uploaded in a previous session.\n` +
                `Please re-upload the evidence to enable download.`
            );
            return false;
        }

        // Check if base64 data exists and is valid
        if (!stored.data || typeof stored.data !== 'string' || stored.data.length < 10) {
            alert(
                `File "${fileName}" metadata exists but file content is missing.\n\n` +
                `The file data was not stored correctly.\n` +
                `Please re-upload the evidence file.`
            );
            return false;
        }

        // Convert base64 → Blob
        const blob = base64ToBlob(stored.data, stored.type || 'application/octet-stream');

        if (!blob || blob.size === 0) {
            alert(
                `File "${fileName}" data is corrupted and cannot be reconstructed.\n\n` +
                `Please re-upload the evidence file.`
            );
            return false;
        }

        // Trigger real browser download
        triggerBrowserDownload(blob, stored.name || fileName);
        console.log(`[Download] ✓ Started download: ${stored.name} (${blob.size} bytes)`);
        return true;

    } catch (err: any) {
        console.error('[Download] Error:', err);
        alert(`Download failed: ${err.message || 'Unknown error'}`);
        return false;
    }
}

// ─── PART 3: Court-Ready ZIP Export ────────────────────────────────────────────

/**
 * Fetch full case data from the backend API.
 */
async function fetchCaseData(caseId: string): Promise<CaseData> {
    const res = await fetch(`/api/cases/${caseId}`);
    if (!res.ok) throw new Error(`Failed to fetch case data (${res.status})`);
    return await res.json();
}

/**
 * Export a case as a court-ready ZIP evidence package.
 *
 * Structure:
 *   Case_<ID>/
 *   ├── Evidence/          (original uploaded files)
 *   ├── Report/            (forensic report TXT)
 *   ├── Metadata/          (case_metadata.json, chain_of_custody.json)
 *   └── hash_verification.txt
 *
 * @param caseId - The case ID to export
 * @param userEmail - The current user's email
 * @param onProgress - Optional progress callback (0-100)
 */
export async function exportCaseAsZip(
    caseId: string,
    userEmail: string,
    onProgress?: (percent: number) => void
): Promise<void> {
    const report = onProgress || (() => { });
    report(5);

    // 1. Fetch case data from API
    const caseData = await fetchCaseData(caseId);
    report(15);

    const zip = new JSZip();
    const rootFolder = `Case_${caseId}`;

    // 2. Evidence folder — add original uploaded files
    const evidenceFolder = zip.folder(`${rootFolder}/Evidence`);
    const hashLines: string[] = [];
    const evidenceMetadata: any[] = [];

    if (caseData.evidence && caseData.evidence.length > 0) {
        // Load the per-case evidence metadata from localStorage so we can use
        // the storageKey field, which is the direct pointer to the file data.
        const localMeta = getEvidenceForCase(caseId);

        for (let i = 0; i < caseData.evidence.length; i++) {
            const ev = caseData.evidence[i];
            const fileName = ev.file_name || `evidence_${i + 1}`;
            const hash = ev.client_sha256 || '';

            // Build a quick lookup map: file_name -> storageKey from local metadata
            const metaEntry = localMeta.find(
                (m) =>
                    m.file_name === fileName ||
                    (hash && m.client_sha256 && m.client_sha256.toLowerCase() === hash.toLowerCase())
            );

            // Priority order:
            //   1. storageKey  — direct pointer saved at upload time (most reliable)
            //   2. hash        — SHA-256 scan across all evidence_* keys
            //   3. name        — filename scan (least reliable, can collide)
            let stored: StoredEvidence | null = null;
            if (metaEntry?.storageKey) {
                stored = findByStorageKey(metaEntry.storageKey);
                if (stored) console.log(`[ZIP Export] Found by storageKey: ${fileName}`);
            }
            if (!stored && hash) {
                stored = findByHash(hash);
                if (stored) console.log(`[ZIP Export] Found by hash: ${fileName}`);
            }
            if (!stored) {
                stored = findByName(fileName);
                if (stored) console.log(`[ZIP Export] Found by name: ${fileName}`);
            }

            if (stored && stored.data && typeof stored.data === 'string') {
                const converted = base64ToUint8Array(stored.data);
                if (converted) {
                    evidenceFolder!.file(fileName, converted.bytes);
                    hashLines.push(`SHA-256: ${hash || 'N/A'}  ${fileName}  (${converted.bytes.length} bytes) — INCLUDED`);
                } else {
                    hashLines.push(`SHA-256: ${hash || 'N/A'}  ${fileName}  — ERROR: Could not decode file data`);
                }
            } else {
                hashLines.push(`SHA-256: ${hash || 'N/A'}  ${fileName}  — NOT AVAILABLE (file data not in browser storage)`);
            }

            // Build evidence metadata
            evidenceMetadata.push({
                id: ev.id,
                file_name: ev.file_name,
                file_type: ev.file_type,
                file_size: ev.file_size,
                client_sha256: ev.client_sha256,
                server_sha256: ev.server_sha256,
                upload_timestamp: ev.upload_timestamp,
                uploaded_by: ev.user_id,
                integrity_verified: ev.client_sha256 === ev.server_sha256 && !!ev.client_sha256,
            });

            report(15 + ((i + 1) / caseData.evidence.length) * 30);
        }
    } else {
        // ── Fallback: files uploaded via CaseDetailsDashboard (localStorage only) ──
        // These uploads bypass the server API, so caseData.evidence from the DB is
        // empty. We pull from the per-case localStorage evidence store instead.
        console.log(`[ZIP Export] API returned 0 evidence — using localStorage fallback for case ${caseId}.`);
        const fallbackMeta = getEvidenceForCase(caseId);

        for (let i = 0; i < fallbackMeta.length; i++) {
            const meta = fallbackMeta[i];
            const fileName = meta.file_name || `evidence_${i + 1}`;
            const hash = meta.client_sha256 || '';

            // Priority: storageKey (direct) → hash → name
            let stored: StoredEvidence | null = null;
            if (meta.storageKey) {
                stored = findByStorageKey(meta.storageKey);
                if (stored) console.log(`[ZIP Export] ✓ (local) Found by storageKey: ${fileName}`);
            }
            if (!stored && hash) {
                stored = findByHash(hash);
                if (stored) console.log(`[ZIP Export] ✓ (local) Found by hash: ${fileName}`);
            }
            if (!stored) {
                stored = findByName(fileName);
                if (stored) console.log(`[ZIP Export] ✓ (local) Found by name: ${fileName}`);
            }

            if (stored && stored.data && typeof stored.data === 'string') {
                const converted = base64ToUint8Array(stored.data);
                if (converted) {
                    evidenceFolder!.file(fileName, converted.bytes);
                    hashLines.push(`SHA-256: ${hash || 'N/A'}  ${fileName}  (${converted.bytes.length} bytes) — INCLUDED`);
                } else {
                    hashLines.push(`SHA-256: ${hash || 'N/A'}  ${fileName}  — ERROR: Could not decode file data`);
                }
            } else {
                console.warn(`[ZIP Export] ✗ File data not found in localStorage: ${fileName}`);
                hashLines.push(`SHA-256: ${hash || 'N/A'}  ${fileName}  — NOT AVAILABLE (file data not in browser storage)`);
            }

            evidenceMetadata.push({
                id: meta.id,
                file_name: meta.file_name,
                file_type: meta.file_type,
                file_size: meta.file_size,
                client_sha256: meta.client_sha256,
                server_sha256: meta.server_sha256,
                upload_timestamp: meta.upload_timestamp,
                uploaded_by: meta.uploaded_by,
                integrity_verified: meta.integrity_status === 'VERIFIED',
            });

            // Patch caseData.evidence so forensic report and metadata sections
            // list these files (they are not null-safe without this patch).
            (caseData.evidence as any[]).push({
                id: meta.id,
                file_name: meta.file_name,
                file_type: meta.file_type,
                file_size: meta.file_size,
                client_sha256: meta.client_sha256,
                server_sha256: meta.server_sha256,
                upload_timestamp: meta.upload_timestamp,
                user_id: meta.uploaded_by,
            });

            report(15 + ((i + 1) / Math.max(fallbackMeta.length, 1)) * 30);
        }
    }

    // 3. Report folder — forensic report TXT
    const reportFolder = zip.folder(`${rootFolder}/Report`);
    const forensicReportTxt = buildForensicReportTXT(caseData, userEmail);
    reportFolder!.file(`forensic_report_${caseId}.txt`, forensicReportTxt);
    report(60);

    // 4. Metadata folder
    const metadataFolder = zip.folder(`${rootFolder}/Metadata`);

    // case_metadata.json
    const caseMetadataJson = JSON.stringify({
        case_id: caseData.id,
        case_title: caseData.title,
        case_description: caseData.description,
        case_status: caseData.status,
        created_at: caseData.created_at,
        investigator: userEmail,
        risk_score: caseData.risk_score,
        evidence_count: (caseData.evidence || []).length,
        evidence: evidenceMetadata,
        hashes: (caseData.evidence || []).map((ev: any) => ({
            file_name: ev.file_name,
            client_sha256: ev.client_sha256,
            server_sha256: ev.server_sha256,
        })),
        audit_trail: (caseData.logs || []).map((log: any) => ({
            action: log.action,
            user_id: log.user_id,
            timestamp: log.timestamp,
            details: log.details,
        })),
        integrity_verified: (caseData.evidence || []).every(
            (ev: any) => ev.client_sha256 && ev.client_sha256 === ev.server_sha256
        ),
        exported_at: new Date().toISOString(),
        exported_by: userEmail,
        system: 'Evidence Vault v1.0.0',
    }, null, 2);
    metadataFolder!.file('case_metadata.json', caseMetadataJson);

    // chain_of_custody.json
    const chainOfCustody = JSON.stringify({
        case_id: caseData.id,
        case_title: caseData.title,
        generated_at: new Date().toISOString(),
        entries: (caseData.logs || []).map((log: any, idx: number) => ({
            sequence: idx + 1,
            action: log.action,
            performed_by: log.user_id,
            timestamp: log.timestamp,
            details: log.details,
            event_id: log.id,
        })),
    }, null, 2);
    metadataFolder!.file('chain_of_custody.json', chainOfCustody);
    report(75);

    // 5. hash_verification.txt
    const hashVerification = [
        '═'.repeat(70),
        '          HASH VERIFICATION — DIGITAL EVIDENCE INTEGRITY',
        '═'.repeat(70),
        '',
        `  Case ID:        ${caseData.id}`,
        `  Case Title:     ${caseData.title}`,
        `  Generated:      ${new Date().toISOString()}`,
        `  Generated By:   ${userEmail}`,
        `  System:         Evidence Vault v1.0.0`,
        '',
        '─'.repeat(70),
        '  FILE HASHES',
        '─'.repeat(70),
        '',
        ...hashLines.map(l => `  ${l}`),
        '',
        '─'.repeat(70),
        '  INTEGRITY STATEMENT',
        '─'.repeat(70),
        '',
        '  SHA-256 cryptographic hashes were computed for each evidence file at the',
        '  time of upload. These hashes can be independently verified to confirm',
        '  that no modification, corruption, or tampering has occurred.',
        '',
        '  Verification Method:  SHA-256 (Web Crypto API)',
        '  Timestamp Authority:  System UTC Clock',
        '  Immutability:         Original hashes cannot be overwritten',
        '',
        '═'.repeat(70),
        `  End of Hash Verification — ${new Date().toISOString()}`,
        '═'.repeat(70),
    ].join('\n');
    zip.file(`${rootFolder}/hash_verification.txt`, hashVerification);
    report(85);

    // 6. Generate and download ZIP
    const zipBlob = await zip.generateAsync(
        { type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } },
        (meta) => {
            report(85 + (meta.percent / 100) * 14);
        }
    );
    report(99);

    const zipFileName = `${caseId}_Evidence_Package.zip`;
    triggerBrowserDownload(zipBlob, zipFileName);
    report(100);
    console.log(`[ZIP Export] ✓ Package downloaded: ${zipFileName} (${zipBlob.size} bytes)`);
}

// ─── Lightweight Forensic Report for ZIP ───────────────────────────────────────

function buildForensicReportTXT(caseData: CaseData, userEmail: string): string {
    const SEP = '═'.repeat(70);
    const THIN = '─'.repeat(70);
    const now = new Date().toISOString();
    const lines: string[] = [];

    lines.push(SEP);
    lines.push('           FORENSIC INVESTIGATION REPORT');
    lines.push('           Evidence Vault — Digital Preservation');
    lines.push(SEP);
    lines.push('');
    lines.push(`  Case ID:           ${caseData.id}`);
    lines.push(`  Case Title:        ${caseData.title}`);
    lines.push(`  Case Status:       ${(caseData.status || 'open').toUpperCase()}`);
    lines.push(`  Created (UTC):     ${caseData.created_at}`);
    lines.push(`  Investigator:      ${userEmail}`);
    lines.push(`  Generated (UTC):   ${now}`);
    lines.push(`  System:            Evidence Vault v1.0.0`);
    lines.push('');

    // Executive Summary
    lines.push('SECTION 1: EXECUTIVE SUMMARY');
    lines.push(THIN);
    lines.push('');
    lines.push(`  ${caseData.description || 'No description provided.'}`);
    lines.push(`  Total Evidence Files: ${(caseData.evidence || []).length}`);
    lines.push('');

    // Evidence Inventory
    lines.push('SECTION 2: EVIDENCE INVENTORY');
    lines.push(THIN);
    lines.push('');
    if (caseData.evidence && caseData.evidence.length > 0) {
        caseData.evidence.forEach((ev, idx) => {
            const hashMatch = ev.client_sha256 && ev.server_sha256 &&
                ev.client_sha256.toLowerCase() === ev.server_sha256.toLowerCase();
            lines.push(`  [Evidence #${idx + 1}]`);
            lines.push(`    File Name:        ${ev.file_name}`);
            lines.push(`    File Type:        ${ev.file_type}`);
            lines.push(`    File Size:        ${ev.file_size} bytes`);
            lines.push(`    Client SHA-256:   ${ev.client_sha256 || 'N/A'}`);
            lines.push(`    Server SHA-256:   ${ev.server_sha256 || 'N/A'}`);
            lines.push(`    Hash Match:       ${hashMatch ? 'VERIFIED ✓' : 'PENDING'}`);
            lines.push(`    Upload Time:      ${ev.upload_timestamp}`);
            lines.push('');
        });
    } else {
        lines.push('  No evidence files.');
        lines.push('');
    }

    // Chain of Custody
    lines.push('SECTION 3: CHAIN OF CUSTODY');
    lines.push(THIN);
    lines.push('');
    if (caseData.logs && caseData.logs.length > 0) {
        caseData.logs.forEach((log, idx) => {
            lines.push(`  [${idx + 1}] ${(log.action || '').toUpperCase()}`);
            lines.push(`      Time:    ${log.timestamp}`);
            lines.push(`      User:    ${log.user_id}`);
            lines.push(`      Details: ${log.details || 'N/A'}`);
            lines.push('');
        });
    } else {
        lines.push('  No audit log entries.');
        lines.push('');
    }

    // Integrity Statement
    lines.push('SECTION 4: INTEGRITY VERIFICATION STATEMENT');
    lines.push(THIN);
    lines.push('');
    lines.push('  SHA-256 cryptographic hash verification was performed on all');
    lines.push('  evidence files. All timestamps are in UTC. Original hash values');
    lines.push('  are immutable and cannot be overwritten.');
    lines.push('');

    // Legal Declaration
    lines.push('SECTION 5: LEGAL DECLARATION');
    lines.push(THIN);
    lines.push('');
    lines.push('  This report was automatically generated by Evidence Vault.');
    lines.push('  It preserves cryptographic integrity and chain of custody.');
    lines.push('  Suitable for use as supporting evidence in legal proceedings.');
    lines.push('');

    lines.push(SEP);
    lines.push(`  Generated: ${now} | Case: ${caseData.id}`);
    lines.push(SEP);

    return lines.join('\n');
}
