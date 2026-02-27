/**
 * Digital Forensic Evidence Record Generator
 * Generates court-admissible evidence records with integrity verification
 * Suitable for legal proceedings and forensic analysis
 */

export interface DeviceInfo {
  os?: string;
  browser?: string;
  userAgent?: string;
}

export interface AuditLogEntry {
  action: string;
  timestamp: string;
  user: string;
  details?: string;
}

export interface EvidenceRecord {
  file_id: string;
  file_name: string;
  file_type: string;
  file_size: string;
  client_sha256: string;
  server_sha256: string;
  uploaded_by: string;
  upload_timestamp: string;
  verification_timestamp?: string;
  device_info: DeviceInfo;
  integrity_verified: boolean;
  integrity_status: 'VERIFIED' | 'COMPROMISED' | 'PENDING';
  case_id: string;
  audit_log: AuditLogEntry[];
}

export interface EvidenceRecordResponse {
  records: EvidenceRecord[];
  summary: {
    total_files: number;
    verified_count: number;
    compromised_count: number;
    pending_count: number;
    generation_timestamp: string;
  };
}

/**
 * Generates a court-admissible evidence record for uploaded files
 * @param fileData - Array of file metadata to process
 * @returns Structured JSON record ready for Firestore storage
 */
export function generateEvidenceRecord(
  fileName: string,
  fileType: string,
  fileSize: string,
  clientSha256: string,
  serverSha256: string,
  uploaderId: string,
  uploadTimestamp: string,
  caseId: string,
  deviceInfo?: DeviceInfo,
  fileId?: string
): EvidenceRecord {
  // Verify integrity by comparing hashes (case-insensitive)
  const hashesMatch = clientSha256.toLowerCase() === serverSha256.toLowerCase();
  const integrityVerified = hashesMatch && clientSha256 !== '' && serverSha256 !== '';

  // Determine integrity status
  let integrityStatus: 'VERIFIED' | 'COMPROMISED' | 'PENDING' = 'PENDING';
  if (integrityVerified) {
    integrityStatus = 'VERIFIED';
  } else if (clientSha256 && serverSha256 && !hashesMatch) {
    integrityStatus = 'COMPROMISED';
  }

  // Generate unique file ID if not provided
  const uniqueFileId = fileId || `EV-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  // Create initial audit log entry
  const auditLog: AuditLogEntry[] = [
    {
      action: 'uploaded',
      timestamp: uploadTimestamp,
      user: uploaderId,
      details: `File uploaded with integrity status: ${integrityStatus}`
    }
  ];

  // Build evidence record with court-admissible structure
  const record: EvidenceRecord = {
    file_id: uniqueFileId,
    file_name: fileName,
    file_type: fileType.toLowerCase(),
    file_size: fileSize,
    client_sha256: clientSha256,
    server_sha256: serverSha256,
    uploaded_by: uploaderId,
    upload_timestamp: uploadTimestamp,
    device_info: deviceInfo || {},
    integrity_verified: integrityVerified,
    integrity_status: integrityStatus,
    case_id: caseId,
    audit_log: auditLog
  };

  return record;
}

/**
 * Generates multiple evidence records and provides summary
 * @param filesData - Array of file metadata objects
 * @returns Structured response with all records and summary statistics
 */
export function generateEvidenceRecords(
  filesData: Array<{
    fileName: string;
    fileType: string;
    fileSize: string;
    clientSha256: string;
    serverSha256: string;
    uploaderId: string;
    uploadTimestamp: string;
    caseId: string;
    deviceInfo?: DeviceInfo;
    fileId?: string;
  }>
): EvidenceRecordResponse {
  const records: EvidenceRecord[] = filesData.map(file =>
    generateEvidenceRecord(
      file.fileName,
      file.fileType,
      file.fileSize,
      file.clientSha256,
      file.serverSha256,
      file.uploaderId,
      file.uploadTimestamp,
      file.caseId,
      file.deviceInfo,
      file.fileId
    )
  );

  // Calculate summary statistics
  const verifiedCount = records.filter(r => r.integrity_verified).length;
  const compromisedCount = records.filter(r => r.integrity_status === 'COMPROMISED').length;
  const pendingCount = records.filter(r => r.integrity_status === 'PENDING').length;

  const response: EvidenceRecordResponse = {
    records,
    summary: {
      total_files: records.length,
      verified_count: verifiedCount,
      compromised_count: compromisedCount,
      pending_count: pendingCount,
      generation_timestamp: new Date().toISOString()
    }
  };

  return response;
}

/**
 * Adds an audit log entry to an existing evidence record
 * Maintains chain of custody documentation
 * @param record - The evidence record to update
 * @param action - The action being performed
 * @param user - The user performing the action
 * @param details - Optional details about the action
 */
export function addAuditLogEntry(
  record: EvidenceRecord,
  action: string,
  user: string,
  details?: string
): EvidenceRecord {
  const newEntry: AuditLogEntry = {
    action,
    timestamp: new Date().toISOString(),
    user,
    details
  };

  return {
    ...record,
    audit_log: [...record.audit_log, newEntry]
  };
}

/**
 * Generates a professional forensic report for a single evidence file
 * Suitable for court submission
 */
export function generateForensicReport(record: EvidenceRecord): string {
  const report = `
═══════════════════════════════════════════════════════════════════════════════
                    DIGITAL FORENSIC EVIDENCE REPORT
═══════════════════════════════════════════════════════════════════════════════

FILE IDENTIFICATION:
  File ID:              ${record.file_id}
  File Name:            ${record.file_name}
  File Type:            ${record.file_type.toUpperCase()}
  File Size:            ${record.file_size}
  Case ID:              ${record.case_id}

UPLOADER INFORMATION:
  Uploaded By:          ${record.uploaded_by}
  Upload Timestamp:     ${record.upload_timestamp}
  Device OS:            ${record.device_info.os || 'Not recorded'}
  Browser:              ${record.device_info.browser || 'Not recorded'}

CRYPTOGRAPHIC INTEGRITY VERIFICATION:
  Client-Side Hash:     ${record.client_sha256}
  Server-Side Hash:     ${record.server_sha256}
  Hash Match:           ${record.integrity_verified ? 'YES' : 'NO'}
  Status:               ${record.integrity_status}
    Verification Time:    ${record.verification_timestamp || 'Not available'}

INTEGRITY ASSESSMENT:
  ${
    record.integrity_verified
      ? `✓ PASSED: File integrity has been verified. Client-side and server-side\n` +
        `  SHA-256 hashes are identical, confirming that the file was transmitted\n` +
        `  and stored without modification or corruption.`
      : `✗ FAILED: File integrity verification failed. Client-side and server-side\n` +
        `  hashes do not match. This indicates potential file modification,\n` +
        `  corruption, or tampering during transmission or storage.`
  }

  ${record.integrity_verified ? '\nSTATEMENT:\nThe cryptographic hash values confirm that the evidence file has not been altered since submission.\n' : ''}

CHAIN OF CUSTODY:
${record.audit_log
  .map(
    (entry, index) =>
      `  [${index + 1}] ${entry.action.toUpperCase()}\n` +
      `      Timestamp: ${entry.timestamp}\n` +
      `      User:      ${entry.user}\n` +
      `      Details:   ${entry.details || 'No additional details'}`
  )
  .join('\n\n')}

CERTIFICATION:
This report documents the forensic analysis of the above-referenced digital
evidence file. The integrity verification process employs SHA-256 cryptographic
hashing, an industry-standard method recognized by forensic professionals and
courts of law. The complete chain of custody is maintained for audit trail
purposes.

This evidence record is suitable for use in legal proceedings and forensic
investigations, subject to proper authentication and foundation requirements.

═══════════════════════════════════════════════════════════════════════════════
Report Generated: ${new Date().toISOString()}
═══════════════════════════════════════════════════════════════════════════════
  `;

  return report;
}

/**
 * Exports evidence records as court-admissible JSON
 * Includes metadata structure suitable for legal documentation
 */
export function exportEvidenceAsJSON(response: EvidenceRecordResponse): string {
  return JSON.stringify(response, null, 2);
}

/**
 * Validates if a hash string is a valid SHA-256
 */
export function isValidSha256(hash: string): boolean {
  // SHA-256 produces 64 hexadecimal characters
  return /^[a-fA-F0-9]{64}$/.test(hash);
}
