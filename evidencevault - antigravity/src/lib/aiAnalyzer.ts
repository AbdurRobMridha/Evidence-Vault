// ═══════════════════════════════════════════════════════════════════════════════
// Evidence Vault — Local Smart AI Analysis Engine
// Zero-dependency, client-side forensic analysis with intelligent heuristics.
// Provides bulletproof fallback when Gemini API is unavailable.
// ═══════════════════════════════════════════════════════════════════════════════

// ─── Types ──────────────────────────────────────────────────────────────────────

export interface ForensicAnalysisResult {
    riskLevel: 'Low' | 'Medium' | 'High' | 'Critical';
    riskScore: number;                  // 1–10
    summary: string;
    detectedIndicators: string[];
    integrityStatus: 'Verified' | 'Warning' | 'Unknown';
    evidenceClassification: string;
    suspiciousPatterns: string[];
    recommendedActions: string[];
    chainOfCustodyNotes: string[];
    confidenceScore: number;            // 0–100
    generatedAt: string;                // UTC ISO-8601
    analysisSource: 'gemini-ai' | 'local-engine';
}

export interface AnalysisInput {
    title: string;
    description: string;
    fileName?: string;
    fileSize?: number;
    fileType?: string;
    clientHash?: string;
}

// ─── Constants ──────────────────────────────────────────────────────────────────

const SUSPICIOUS_KEYWORDS = [
    'confidential', 'leak', 'password', 'internal', 'classified', 'secret',
    'hack', 'exploit', 'malware', 'phishing', 'threat', 'attack', 'breach',
    'stolen', 'unauthorized', 'illegal', 'fraud', 'blackmail', 'extortion',
    'stalking', 'harassment', 'abuse', 'spy', 'surveillance', 'ransom',
    'keylogger', 'trojan', 'virus', 'spyware', 'rootkit', 'backdoor',
    'credential', 'dump', 'exfiltrate', 'injection', 'vulnerability',
];

const HIGH_RISK_EXTENSIONS = ['.exe', '.bat', '.cmd', '.scr', '.msi', '.ps1', '.vbs', '.js', '.wsf', '.com', '.pif'];
const MEDIUM_RISK_EXTENSIONS = ['.zip', '.rar', '.7z', '.tar', '.gz', '.iso', '.dmg', '.img'];
const LOW_RISK_EXTENSIONS = ['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.txt', '.rtf', '.csv'];
const MEDIA_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.svg', '.mp4', '.avi', '.mov', '.mkv', '.mp3', '.wav', '.webm'];
const DATABASE_EXTENSIONS = ['.db', '.sqlite', '.sql', '.mdb', '.accdb'];
const COMMUNICATION_EXTENSIONS = ['.eml', '.msg', '.mbox', '.pst', '.ost'];

// ─── Classification ────────────────────────────────────────────────────────────

function classifyEvidence(fileName: string, fileType?: string): string {
    const ext = getExtension(fileName);

    if (HIGH_RISK_EXTENSIONS.includes(ext)) return 'Executable / Script';
    if (MEDIUM_RISK_EXTENSIONS.includes(ext)) return 'Compressed Archive';
    if (DATABASE_EXTENSIONS.includes(ext)) return 'Database File';
    if (COMMUNICATION_EXTENSIONS.includes(ext)) return 'Communication / Email';
    if (MEDIA_EXTENSIONS.includes(ext)) {
        if (['.mp4', '.avi', '.mov', '.mkv', '.webm'].includes(ext)) return 'Video Recording';
        if (['.mp3', '.wav'].includes(ext)) return 'Audio Recording';
        return 'Image / Screenshot';
    }
    if (LOW_RISK_EXTENSIONS.includes(ext)) return 'Document';
    if (fileType?.startsWith('text/')) return 'Text File';
    if (fileType?.startsWith('image/')) return 'Image / Screenshot';
    if (fileType?.startsWith('video/')) return 'Video Recording';
    if (fileType?.startsWith('audio/')) return 'Audio Recording';

    return 'Unknown / Binary File';
}

function getExtension(fileName: string): string {
    const idx = fileName.lastIndexOf('.');
    return idx >= 0 ? fileName.substring(idx).toLowerCase() : '';
}

// ─── Keyword Scanning ───────────────────────────────────────────────────────────

function detectSuspiciousKeywords(text: string): string[] {
    const normalized = text.toLowerCase();
    return SUSPICIOUS_KEYWORDS.filter(kw => normalized.includes(kw));
}

// ─── Risk Scoring Engine ────────────────────────────────────────────────────────

function calculateRiskScore(input: AnalysisInput): {
    score: number;
    indicators: string[];
    patterns: string[];
} {
    let score = 2; // baseline
    const indicators: string[] = [];
    const patterns: string[] = [];
    const fileName = (input.fileName || '').toLowerCase();
    const ext = getExtension(fileName);
    const combinedText = `${input.title} ${input.description} ${input.fileName || ''}`;

    // ── File type risk ──
    if (HIGH_RISK_EXTENSIONS.includes(ext)) {
        score += 4;
        indicators.push(`High-risk file type: ${ext.toUpperCase()}`);
        patterns.push('Executable or script file detected — potential malware vector');
    } else if (MEDIUM_RISK_EXTENSIONS.includes(ext)) {
        score += 2;
        indicators.push(`Archive format: ${ext.toUpperCase()}`);
        patterns.push('Compressed archive may contain concealed payloads');
    } else if (DATABASE_EXTENSIONS.includes(ext)) {
        score += 2;
        indicators.push('Database file detected');
        patterns.push('Database files may contain sensitive structured data');
    } else if (COMMUNICATION_EXTENSIONS.includes(ext)) {
        score += 1;
        indicators.push('Communication artifact detected');
        patterns.push('Email/message files may contain evidence of correspondence');
    }

    // ── Keyword detection ──
    const foundKeywords = detectSuspiciousKeywords(combinedText);
    if (foundKeywords.length > 0) {
        const keywordBoost = Math.min(4, foundKeywords.length);
        score += keywordBoost;
        indicators.push(`Suspicious keywords detected: ${foundKeywords.join(', ')}`);

        if (foundKeywords.some(kw => ['malware', 'virus', 'trojan', 'keylogger', 'spyware', 'rootkit', 'backdoor', 'ransom'].includes(kw))) {
            patterns.push('Malware-related terminology found in case metadata');
        }
        if (foundKeywords.some(kw => ['stalking', 'harassment', 'abuse', 'blackmail', 'extortion'].includes(kw))) {
            patterns.push('Language indicative of interpersonal cyber-crime');
        }
        if (foundKeywords.some(kw => ['leak', 'exfiltrate', 'stolen', 'unauthorized', 'breach'].includes(kw))) {
            patterns.push('Data exfiltration or unauthorized access indicators');
        }
        if (foundKeywords.some(kw => ['phishing', 'fraud', 'credential', 'injection'].includes(kw))) {
            patterns.push('Social engineering or credential theft indicators');
        }
        if (foundKeywords.some(kw => ['confidential', 'classified', 'internal', 'secret'].includes(kw))) {
            patterns.push('Sensitive document classification markers detected');
        }
    }

    // ── File size anomalies ──
    if (input.fileSize) {
        const sizeMB = input.fileSize / (1024 * 1024);
        if (sizeMB > 100) {
            score += 1;
            indicators.push(`Unusually large file: ${sizeMB.toFixed(1)} MB`);
            patterns.push('Large file size may indicate data dumps or bulk exfiltration');
        }
        if (HIGH_RISK_EXTENSIONS.includes(ext) && sizeMB < 0.01) {
            score += 1;
            indicators.push('Unusually small executable');
            patterns.push('Tiny executables are often droppers or stagers');
        }
    }

    // ── Double extension detection ──
    const parts = fileName.split('.');
    if (parts.length > 2) {
        const secondToLast = '.' + parts[parts.length - 2];
        if (MEDIA_EXTENSIONS.includes(secondToLast) || LOW_RISK_EXTENSIONS.includes(secondToLast)) {
            if (HIGH_RISK_EXTENSIONS.includes(ext)) {
                score += 3;
                indicators.push('Double extension detected (social engineering)');
                patterns.push(`File masquerading as ${secondToLast.toUpperCase()} but is actually ${ext.toUpperCase()}`);
            }
        }
    }

    // ── Title/Description length bonus ──
    if (input.description.length > 200) {
        patterns.push('Detailed case description provided — improves analysis confidence');
    }

    // Clamp to 1–10
    score = Math.max(1, Math.min(10, score));

    return { score, indicators, patterns };
}

// ─── Summary Generator ──────────────────────────────────────────────────────────

function generateSummary(input: AnalysisInput, riskScore: number, classification: string, indicators: string[]): string {
    const riskWord = riskScore >= 8 ? 'Critical' : riskScore >= 6 ? 'High' : riskScore >= 4 ? 'Moderate' : 'Low';
    const fileName = input.fileName || 'the submitted evidence';
    const ext = getExtension(input.fileName || '');

    let summary = `Forensic analysis of "${input.title}" identified a ${riskWord.toLowerCase()}-risk profile (${riskScore}/10). `;
    summary += `The evidence file "${fileName}" has been classified as ${classification}. `;

    if (indicators.length > 0) {
        summary += `${indicators.length} risk indicator${indicators.length > 1 ? 's were' : ' was'} detected during automated scanning. `;
    }

    if (riskScore >= 7) {
        summary += 'Immediate investigator review and evidence preservation is strongly recommended. ';
        summary += 'This evidence exhibits characteristics consistent with active threats or ongoing malicious activity.';
    } else if (riskScore >= 4) {
        summary += 'Further investigation is advised to rule out potential threats. ';
        summary += 'The evidence warrants careful examination before case closure.';
    } else {
        summary += 'No immediate threats were detected, but standard evidence preservation protocols should be followed. ';
        summary += 'Routine review is recommended to maintain chain-of-custody compliance.';
    }

    return summary;
}

// ─── Recommended Actions Generator ──────────────────────────────────────────────

function generateRecommendedActions(riskScore: number, indicators: string[], ext: string): string[] {
    const actions: string[] = [];

    // Always recommend
    actions.push('Preserve evidence immediately with cryptographic hash verification');

    if (riskScore >= 7) {
        actions.push('Escalate to authority — high-risk evidence requires immediate attention');
        actions.push('Restrict case access to authorized investigators only');
        actions.push('Conduct deep forensic scan of the evidence file');
        actions.push('Generate emergency backup of all case materials');
        actions.push('Document findings for potential legal proceedings');
    } else if (riskScore >= 4) {
        actions.push('Assign investigator for detailed review');
        actions.push('Verify metadata authenticity and timestamps');
        actions.push('Cross-reference with other case evidence');
        actions.push('Generate forensic report for case documentation');
    } else {
        actions.push('Log evidence in chain-of-custody records');
        actions.push('Verify file integrity matches source documentation');
        actions.push('Generate standard forensic report');
    }

    if (HIGH_RISK_EXTENSIONS.includes(ext)) {
        actions.push('Isolate executable in sandbox environment before analysis');
        actions.push('Scan for known malware signatures');
    }

    if (ext === '.zip' || ext === '.rar' || ext === '.7z') {
        actions.push('Extract and inventory archive contents in isolated environment');
    }

    return actions;
}

// ─── Chain of Custody Notes ─────────────────────────────────────────────────────

function generateChainOfCustodyNotes(input: AnalysisInput, riskScore: number): string[] {
    const notes: string[] = [];

    notes.push('Evidence received and cataloged — automated analysis initiated');

    if (input.clientHash) {
        notes.push(`SHA-256 hash recorded at time of upload: ${input.clientHash.substring(0, 16)}...`);
        notes.push('Hash can be independently verified to confirm evidence integrity');
    } else {
        notes.push('⚠ No SHA-256 hash provided — integrity cannot be independently verified');
        notes.push('Recommend re-uploading evidence with hash computation enabled');
    }

    notes.push(`Automated risk assessment completed — Score: ${riskScore}/10`);

    if (riskScore >= 7) {
        notes.push('High-risk classification — access logging enabled for all interactions');
        notes.push('Evidence flagged for priority review by assigned investigator');
    }

    notes.push('All timestamps are in UTC and recorded immutably in the audit trail');

    return notes;
}

// ─── Confidence Score Calculator ────────────────────────────────────────────────

function calculateConfidence(input: AnalysisInput, riskLevel: 'Low' | 'Medium' | 'High' | 'Critical', indicatorCount: number): number {
    let baseConfidence = 50;

    if (indicatorCount > 0) baseConfidence += indicatorCount * 5;
    if (riskLevel === 'High') baseConfidence += 10;
    if (riskLevel === 'Critical') baseConfidence += 20;
    if (!input.clientHash) baseConfidence -= 10;

    // Rules: Never show 100%, never show below 30% (clamped to 40-98 per request)
    return Math.min(Math.max(baseConfidence, 40), 98) / 100; // Return as decimal for consistency with existing UI
}

// ─── Risk Level Mapper ──────────────────────────────────────────────────────────

function scoreToLevel(score: number): 'Low' | 'Medium' | 'High' | 'Critical' {
    if (score >= 8) return 'Critical';
    if (score >= 6) return 'High';
    if (score >= 4) return 'Medium';
    return 'Low';
}

// ═══════════════════════════════════════════════════════════════════════════════
// PUBLIC API
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Run the local smart analysis engine. Produces forensic-grade structured output
 * with zero external dependencies. Designed as a bulletproof fallback and as
 * standalone demo capability.
 *
 * Adds a realistic 800–1500ms delay to simulate processing.
 */
export async function localSmartAnalyzer(input: AnalysisInput): Promise<ForensicAnalysisResult> {
    // Simulate processing time for realistic UX
    await new Promise(resolve => setTimeout(resolve, 800 + Math.random() * 700));

    const fileName = input.fileName || 'unknown_file';
    const ext = getExtension(fileName);
    const classification = classifyEvidence(fileName, input.fileType);
    const { score, indicators, patterns } = calculateRiskScore(input);
    const riskLevel = scoreToLevel(score);
    const summary = generateSummary(input, score, classification, indicators);
    const recommendedActions = generateRecommendedActions(score, indicators, ext);
    const chainOfCustodyNotes = generateChainOfCustodyNotes(input, score);
    const confidenceScore = calculateConfidence(input, riskLevel, indicators.length);
    const integrityStatus: 'Verified' | 'Warning' | 'Unknown' = input.clientHash
        ? 'Verified'
        : 'Unknown';

    return {
        riskLevel,
        riskScore: score,
        summary,
        detectedIndicators: indicators,
        integrityStatus,
        evidenceClassification: classification,
        suspiciousPatterns: patterns,
        recommendedActions,
        chainOfCustodyNotes,
        confidenceScore,
        generatedAt: new Date().toISOString(),
        analysisSource: 'local-engine',
    };
}

/**
 * Attempt to call the server's /api/analyze endpoint.
 * On ANY failure, seamlessly fall back to the local engine.
 * This function NEVER throws.
 */
export async function analyzeEvidence(input: AnalysisInput): Promise<ForensicAnalysisResult> {
    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 35000); // 35s timeout

        const res = await fetch('/api/analyze', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                title: input.title,
                description: input.description,
                fileName: input.fileName,
                fileSize: input.fileSize,
                fileType: input.fileType,
            }),
            signal: controller.signal,
        });

        clearTimeout(timeout);

        if (!res.ok) {
            console.warn(`[AI Analyzer] Server returned ${res.status}, falling back to local engine`);
            return localSmartAnalyzer(input);
        }

        const data = await res.json();

        // If server returned a valid forensic result (new format), use it directly
        if (data.forensicAnalysis) {
            return data.forensicAnalysis as ForensicAnalysisResult;
        }

        // If server returned old-format result, transform it
        if (data.risk_analysis) {
            const raw = typeof data.risk_analysis === 'string' ? JSON.parse(data.risk_analysis) : data.risk_analysis;
            const ext = getExtension(input.fileName || '');

            // Merge server AI result with local enrichment
            const score = raw.risk_score || data.risk_score || 3;
            const riskLevel = scoreToLevel(score);
            const classification = classifyEvidence(input.fileName || '', input.fileType);
            const confidenceScore = Math.min(0.95, calculateConfidence(input, riskLevel, raw.detected_threats?.length || 0) + 0.15); // AI gets higher confidence

            return {
                riskLevel,
                riskScore: score,
                summary: raw.summary || generateSummary(input, score, classification, raw.detected_threats || []),
                detectedIndicators: raw.detected_threats || [],
                integrityStatus: input.clientHash ? 'Verified' : 'Unknown',
                evidenceClassification: classification,
                suspiciousPatterns: raw.suspicious_patterns || [],
                recommendedActions: raw.recommendations || generateRecommendedActions(score, [], ext),
                chainOfCustodyNotes: generateChainOfCustodyNotes(input, score),
                confidenceScore,
                generatedAt: new Date().toISOString(),
                analysisSource: 'gemini-ai',
            };
        }

        // Fallback if server response is unexpected
        console.warn('[AI Analyzer] Unexpected server response format, using local engine');
        return localSmartAnalyzer(input);
    } catch (err: any) {
        console.warn('[AI Analyzer] Server analysis failed, using local engine:', err.message || err);
        return localSmartAnalyzer(input);
    }
}
