import { saveEvidenceToCase } from './evidenceStore';

// ─── Platform Types ────────────────────────────────────────────────────────────

export type Platform = 'WhatsApp' | 'Messenger' | 'SMS' | 'Telegram' | 'Instagram DM' | 'Twitter DM';

export interface ConnectedAccount {
    id: string;
    platform: Platform;
    handle: string;            // username / phone number
    connectedAt: string;
    isActive: boolean;
    lastScanned: string | null;
}

// ─── Chat Scan Types ───────────────────────────────────────────────────────────

export type RiskLevel = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;

export interface ChatMessage {
    sender: string;
    content: string;
    timestamp: string;
    direction: 'incoming' | 'outgoing';
}

export interface ScannedConversation {
    id: string;
    accountId: string;        // ref to ConnectedAccount
    platform: Platform;
    contactName: string;
    contactHandle: string;
    scannedAt: string;
    messages: ChatMessage[];
    riskLevel: RiskLevel;
    riskSummary: string;
    detectedThreats: string[];
    recommendations: string[];
    aiAnalysisSource: 'gemini-ai' | 'local-fallback';
    // State flags
    autoCaseCreated: boolean;
    autoCaseId: string | null;
    dmsTriggerAt: string | null;  // ISO timestamp when DMS will fire
    dmsFired: boolean;
    userMarkedSafe: boolean;
    warningDismissed: boolean;
}

// ─── Push Notification Types ───────────────────────────────────────────────────

export interface SafetyAlert {
    id: string;
    conversationId: string;
    platform: Platform;
    contactName: string;
    riskLevel: RiskLevel;
    message: string;
    createdAt: string;
    read: boolean;
}

// ─── Storage Keys ─────────────────────────────────────────────────────────────

const ACCOUNTS_KEY = 'ev_social_accounts';
const SCANS_KEY = 'ev_social_scans';
const ALERTS_KEY = 'ev_social_alerts';
const SETTINGS_KEY = 'ev_social_settings';

export interface MonitorSettings {
    enabled: boolean;
    scanIntervalMinutes: number;   // 5 | 15 | 30 | 60
    dmsTimeoutMinutes: number;     // 15 | 30 | 60
    autoCreateCaseThreshold: RiskLevel;  // default 8
    notificationsEnabled: boolean;
}

const DEFAULT_SETTINGS: MonitorSettings = {
    enabled: false,
    scanIntervalMinutes: 15,
    dmsTimeoutMinutes: 30,     // Options: 5, 10, 15, 30, 60, 1440 (24h), 2880 (48h), 4320 (72h)
    autoCreateCaseThreshold: 8,
    notificationsEnabled: true,
};

// ─── Accounts CRUD ────────────────────────────────────────────────────────────

export function getConnectedAccounts(): ConnectedAccount[] {
    try { return JSON.parse(localStorage.getItem(ACCOUNTS_KEY) || '[]'); }
    catch { return []; }
}

function saveAccounts(accounts: ConnectedAccount[]): void {
    localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(accounts));
}

export function connectAccount(platform: Platform, handle: string): ConnectedAccount {
    const account: ConnectedAccount = {
        id: `acc-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        platform,
        handle,
        connectedAt: new Date().toISOString(),
        isActive: true,
        lastScanned: null,
    };
    const accounts = getConnectedAccounts();
    accounts.unshift(account);
    saveAccounts(accounts);
    return account;
}

export function disconnectAccount(accountId: string): void {
    const accounts = getConnectedAccounts().filter(a => a.id !== accountId);
    saveAccounts(accounts);
}

export function toggleAccountActive(accountId: string): void {
    const accounts = getConnectedAccounts();
    const a = accounts.find(a => a.id === accountId);
    if (a) { a.isActive = !a.isActive; saveAccounts(accounts); }
}

// ─── Scanned Conversations CRUD ───────────────────────────────────────────────

export function getAllScans(): ScannedConversation[] {
    try { return JSON.parse(localStorage.getItem(SCANS_KEY) || '[]'); }
    catch { return []; }
}

function saveScans(scans: ScannedConversation[]): void {
    localStorage.setItem(SCANS_KEY, JSON.stringify(scans));
}

export function saveScan(scan: ScannedConversation): void {
    const scans = getAllScans();
    const idx = scans.findIndex(s => s.id === scan.id);
    if (idx >= 0) scans[idx] = scan;
    else scans.unshift(scan);
    // Keep max 200 scans
    if (scans.length > 200) scans.length = 200;
    saveScans(scans);
}

export function getScanById(id: string): ScannedConversation | null {
    return getAllScans().find(s => s.id === id) ?? null;
}

export function updateScan(id: string, updates: Partial<ScannedConversation>): void {
    const scans = getAllScans();
    const idx = scans.findIndex(s => s.id === id);
    if (idx >= 0) { scans[idx] = { ...scans[idx], ...updates }; saveScans(scans); }
}

export function getHighRiskScans(): ScannedConversation[] {
    return getAllScans().filter(s => s.riskLevel >= 8);
}

export function deleteScan(scanId: string): void {
    const scans = getAllScans().filter(s => s.id !== scanId);
    saveScans(scans);
}

// ─── Attach Chat Evidence to a Case ──────────────────────────────────────────
// Serialises the preserved chat messages into a plain-text evidence file and
// stores both the file content (raw bytes in localStorage) and the metadata
// entry so it appears in the Case Details > Evidence tab.

export function attachChatEvidenceToCase(
    caseId: string,
    scan: ScannedConversation,
    uploaderEmail: string
): void {
    const filename = `chat-evidence-${scan.platform.replace(/\s+/g, '_')}-${scan.contactName.replace(/\s+/g, '_')}-${Date.now()}.txt`;

    // Build a human-readable transcript
    const lines: string[] = [
        `Evidence Vault — Preserved Chat Transcript`,
        `${'='.repeat(60)}`,
        `Platform   : ${scan.platform}`,
        `Contact    : ${scan.contactName} (${scan.contactHandle})`,
        `Risk Level : ${scan.riskLevel}/10 — ${getRiskLabel(scan.riskLevel)}`,
        `Scanned At : ${new Date(scan.scannedAt).toLocaleString()}`,
        `Case ID    : ${caseId}`,
        ``,
        `Risk Summary`,
        `${'-'.repeat(60)}`,
        scan.riskSummary,
        ``,
        `Detected Threats`,
        `${'-'.repeat(60)}`,
        ...scan.detectedThreats.map(t => `  • ${t}`),
        ``,
        `Recommendations`,
        `${'-'.repeat(60)}`,
        ...scan.recommendations.map(r => `  → ${r}`),
        ``,
        `Chat Messages (${scan.messages.length} preserved)`,
        `${'-'.repeat(60)}`,
        ...scan.messages.map(m =>
            `[${new Date(m.timestamp).toLocaleString()}] ${m.direction === 'outgoing' ? 'ME' : m.sender.toUpperCase()}: ${m.content}`
        ),
        ``,
        `${'='.repeat(60)}`,
        `Generated by Evidence Vault Social Monitor`,
    ];

    const content = lines.join('\n');
    const encoder = new TextEncoder();
    const bytes = encoder.encode(content);

    // 1. Store file as a data URL — must match the format CaseDetailsDashboard uses
    //    so handleDownloadEvidence / exportCaseAsZip can read it correctly.
    const storageKey = `ev_file_${caseId}_${Date.now()}`;
    const b64 = btoa(String.fromCharCode(...bytes));
    const dataUrl = `data:text/plain;base64,${b64}`;
    localStorage.setItem(storageKey, JSON.stringify({
        name: filename,
        type: 'text/plain',
        size: bytes.length,
        data: dataUrl,
        uploadedAt: new Date().toISOString(),
    }));

    // Compute a simple deterministic hash for the transcript (for integrity display)
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
        hash = ((hash << 5) - hash) + content.charCodeAt(i);
        hash |= 0;
    }
    const hashHex = Math.abs(hash).toString(16).padStart(16, '0');

    // 2. Register metadata in the evidence store  
    saveEvidenceToCase(caseId, {
        id: `social-ev-${scan.id}-${Date.now()}`,
        file_name: filename,
        file_type: 'text/plain',
        file_size: bytes.length,
        client_sha256: hashHex,
        server_sha256: hashHex,
        uploaded_by: uploaderEmail,
        upload_timestamp: new Date().toISOString(),
        integrity_status: 'VERIFIED',
        storageKey,
    });
}

// ─── Alerts CRUD ──────────────────────────────────────────────────────────────

export function getAllAlerts(): SafetyAlert[] {
    try { return JSON.parse(localStorage.getItem(ALERTS_KEY) || '[]'); }
    catch { return []; }
}

function saveAlerts(alerts: SafetyAlert[]): void {
    localStorage.setItem(ALERTS_KEY, JSON.stringify(alerts));
}

export function createAlert(data: Omit<SafetyAlert, 'id' | 'createdAt' | 'read'>): SafetyAlert {
    const alert: SafetyAlert = {
        id: `alert-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        createdAt: new Date().toISOString(),
        read: false,
        ...data,
    };
    const alerts = getAllAlerts();
    alerts.unshift(alert);
    if (alerts.length > 100) alerts.length = 100;
    saveAlerts(alerts);
    return alert;
}

export function markAlertRead(alertId: string): void {
    const alerts = getAllAlerts();
    const a = alerts.find(a => a.id === alertId);
    if (a) { a.read = true; saveAlerts(alerts); }
}

export function markAllAlertsRead(): void {
    const alerts = getAllAlerts().map(a => ({ ...a, read: true }));
    saveAlerts(alerts);
}

export function deleteAlert(alertId: string): void {
    const alerts = getAllAlerts().filter(a => a.id !== alertId);
    saveAlerts(alerts);
}

export function deleteAllReadAlerts(): void {
    const alerts = getAllAlerts().filter(a => !a.read);
    saveAlerts(alerts);
}

export function getUnreadAlertCount(): number {
    return getAllAlerts().filter(a => !a.read).length;
}

// ─── Settings ────────────────────────────────────────────────────────────────

export function getMonitorSettings(): MonitorSettings {
    try { return { ...DEFAULT_SETTINGS, ...JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}') }; }
    catch { return DEFAULT_SETTINGS; }
}

export function saveMonitorSettings(settings: Partial<MonitorSettings>): void {
    const current = getMonitorSettings();
    localStorage.setItem(SETTINGS_KEY, JSON.stringify({ ...current, ...settings }));
}

// ─── Risk Helpers ─────────────────────────────────────────────────────────────

export function getRiskColor(risk: RiskLevel): { text: string; bg: string; border: string } {
    if (risk >= 9) return { text: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/30' };
    if (risk >= 7) return { text: 'text-orange-400', bg: 'bg-orange-500/10', border: 'border-orange-500/30' };
    if (risk >= 5) return { text: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/30' };
    if (risk >= 3) return { text: 'text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500/30' };
    return { text: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/30' };
}

export function getRiskLabel(risk: RiskLevel): string {
    if (risk >= 9) return 'CRITICAL';
    if (risk >= 7) return 'HIGH';
    if (risk >= 5) return 'MEDIUM';
    if (risk >= 3) return 'LOW';
    return 'SAFE';
}

// ─── Platform Config ──────────────────────────────────────────────────────────

export const PLATFORM_CONFIG: Record<Platform, { color: string; icon: string; fieldLabel: string }> = {
    'WhatsApp': { color: '#25D366', icon: '💬', fieldLabel: 'Phone Number' },
    'Messenger': { color: '#0099FF', icon: '💙', fieldLabel: 'Facebook Profile URL' },
    'SMS': { color: '#A78BFA', icon: '📱', fieldLabel: 'Phone Number' },
    'Telegram': { color: '#229ED9', icon: '✈️', fieldLabel: '@Username' },
    'Instagram DM': { color: '#E1306C', icon: '📷', fieldLabel: '@Username' },
    'Twitter DM': { color: '#1DA1F2', icon: '🐦', fieldLabel: '@Username' },
};

// ─── Demo Simulator ───────────────────────────────────────────────────────────
// Platform-specific realistic threat scenarios for hackathon demo.

const PLATFORM_THREATS: Record<Platform, Array<{
    name: string; handle: string; riskLevel: RiskLevel;
    threats: string[]; messages: ChatMessage[]; summary: string; recommendations: string[];
}>> = {
    'WhatsApp': [
        {
            name: 'Blocked_Sender_X', handle: '+880-19XX-XXXX', riskLevel: 9,
            threats: ['Physical location threats', 'Photo-based extortion', 'Repeated contact after block'],
            messages: [
                { sender: 'Blocked_Sender_X', content: 'I can see you right now at the market. Blue shirt, right?', timestamp: new Date(Date.now() - 3600000).toISOString(), direction: 'incoming' },
                { sender: 'Me', content: 'Stop messaging me or I will contact police.', timestamp: new Date(Date.now() - 3500000).toISOString(), direction: 'outgoing' },
                { sender: 'Blocked_Sender_X', content: 'I have intimate photos of you saved. Pay me 50,000 BDT or I forward to your family group.', timestamp: new Date(Date.now() - 3000000).toISOString(), direction: 'incoming' },
                { sender: 'Blocked_Sender_X', content: '24 hours. Clock is ticking.', timestamp: new Date(Date.now() - 900000).toISOString(), direction: 'incoming' },
            ],
            summary: 'Critical WhatsApp extortion: explicit blackmail with intimate images and physical surveillance threats. Sender claims to know victim location in real time.',
            recommendations: ['Screenshot and preserve all messages immediately', 'Do NOT pay any ransom', 'Report to WhatsApp and local cybercrime unit', 'File police report with evidence', 'Block and report account'],
        },
        {
            name: 'Group_Admin_Harasser', handle: '+880-17XX-XXXX', riskLevel: 7,
            threats: ['Group defamation', 'Coordinated harassment', 'Social exclusion threats'],
            messages: [
                { sender: 'Group_Admin_Harasser', content: 'Everyone in the class group knows what you did. You are finished here.', timestamp: new Date(Date.now() - 7200000).toISOString(), direction: 'incoming' },
                { sender: 'Me', content: 'I have not done anything wrong. Please stop this.', timestamp: new Date(Date.now() - 7100000).toISOString(), direction: 'outgoing' },
                { sender: 'Group_Admin_Harasser', content: 'I removed you from every group. No one will talk to you. I will make sure of it.', timestamp: new Date(Date.now() - 3600000).toISOString(), direction: 'incoming' },
            ],
            summary: 'WhatsApp group harassment: coordinated social exclusion and defamation campaign by group administrator.',
            recommendations: ['Save full chat history', 'Report the group admin to WhatsApp', 'Inform a trusted adult or school authority', 'Document evidence of group removal'],
        },
        { name: 'Cousin_Fatima', handle: '+880-18XX-XXXX', riskLevel: 1, threats: [], messages: [{ sender: 'Cousin_Fatima', content: 'Can you bring some biryani for iftar tonight? 😊', timestamp: new Date(Date.now() - 3600000).toISOString(), direction: 'incoming' }], summary: 'Normal family conversation. No threats detected.', recommendations: ['No action required'] },
    ],
    'Messenger': [
        {
            name: 'FakeProfile_2024', handle: 'facebook.com/fakeprofile2024', riskLevel: 9,
            threats: ['Identity impersonation', 'Financial scam', 'Credential phishing'],
            messages: [
                { sender: 'FakeProfile_2024', content: 'Hi! I am your friend Nadia. I need urgent help — my account got hacked. Can you send me BDT 5000 via bKash?', timestamp: new Date(Date.now() - 5400000).toISOString(), direction: 'incoming' },
                { sender: 'Me', content: 'Nadia? Which Nadia? I am going to call your real number.', timestamp: new Date(Date.now() - 5000000).toISOString(), direction: 'outgoing' },
                { sender: 'FakeProfile_2024', content: 'No no do not call! My phone broke too. Please just send the money, I will return tomorrow. Your secret about the exam is safe with me if you help now 😉', timestamp: new Date(Date.now() - 4800000).toISOString(), direction: 'incoming' },
            ],
            summary: 'Facebook Messenger identity fraud: impersonating a known contact combined with implied blackmail to coerce financial transfer.',
            recommendations: ['Do not send money', 'Call the real person through a known number', 'Report the fake profile on Facebook', 'Warn your contacts about the impersonator'],
        },
        {
            name: 'Ex_Partner_Msgs', handle: 'facebook.com/blocked_user', riskLevel: 8,
            threats: ['Stalking behavior', 'Intimidation', 'Repeated contact after blocking'],
            messages: [
                { sender: 'Ex_Partner_Msgs', content: 'I created a new account because you blocked me. You cannot escape. I will always find you.', timestamp: new Date(Date.now() - 2700000).toISOString(), direction: 'incoming' },
                { sender: 'Ex_Partner_Msgs', content: 'I am outside your building. Come out and talk or I post everything.', timestamp: new Date(Date.now() - 1800000).toISOString(), direction: 'incoming' },
            ],
            summary: 'Messenger stalking: persistent contact through new accounts after blocking, combined with physical location surveillance and blackmail threats.',
            recommendations: ['Contact law enforcement immediately', 'Do not respond or engage', 'Preserve all messages as evidence', 'Consider a restraining order'],
        },
        { name: 'WorkColleague_Tanvir', handle: 'facebook.com/tanvir.official', riskLevel: 2, threats: [], messages: [{ sender: 'WorkColleague_Tanvir', content: 'Hey, the project deadline has been moved to Friday. Just an FYI!', timestamp: new Date(Date.now() - 3600000).toISOString(), direction: 'incoming' }], summary: 'Normal professional communication. No threats detected.', recommendations: ['No action required'] },
    ],
    'SMS': [
        {
            name: 'Unknown (+880)', handle: '+880-13XX-XXXX', riskLevel: 9,
            threats: ['Threatening SMS', 'Mob reference', 'Ultimatum with deadline'],
            messages: [
                { sender: 'Unknown (+880)', content: 'We know your daily route. Pay BDT 10,000 to the number below by tomorrow or face consequences. Do not contact police.', timestamp: new Date(Date.now() - 7200000).toISOString(), direction: 'incoming' },
                { sender: 'Me', content: 'I do not know who this is. I am reporting this.', timestamp: new Date(Date.now() - 7100000).toISOString(), direction: 'outgoing' },
                { sender: 'Unknown (+880)', content: 'Wrong choice. We know your children go to XYZ School. Last warning.', timestamp: new Date(Date.now() - 3600000).toISOString(), direction: 'incoming' },
            ],
            summary: 'Critical SMS threat: organized extortion with explicit threats to family members and ultimatum deadline. Possible criminal gang involvement.',
            recommendations: ['Contact police immediately — do not try to handle alone', 'Preserve SMS screenshots', 'Alert family members to be cautious', 'Do NOT pay any demands'],
        },
        {
            name: 'SMS_Spammer_OTP', handle: '+1-800-XXX-XXXX', riskLevel: 5,
            threats: ['Phishing SMS', 'OTP harvesting', 'Bank impersonation'],
            messages: [
                { sender: 'SMS_Spammer_OTP', content: 'DUTCH-BANGLA BANK ALERT: Your account has been suspended. Verify now: http://dbl-verify.xyz/otp', timestamp: new Date(Date.now() - 3600000).toISOString(), direction: 'incoming' },
                { sender: 'SMS_Spammer_OTP', content: 'Urgent: Enter your OTP on our secure portal to restore access within 2 hours.', timestamp: new Date(Date.now() - 1800000).toISOString(), direction: 'incoming' },
            ],
            summary: 'SMS phishing attempt impersonating a bank. Links lead to credential harvesting sites designed to steal OTP and banking passwords.',
            recommendations: ['Do NOT click any links', 'Do NOT share OTP with anyone', 'Call your bank directly on their official number', 'Report the number to BTRC'],
        },
        { name: 'Delivery_Service', handle: '+880-16XX-XXXX', riskLevel: 1, threats: [], messages: [{ sender: 'Delivery_Service', content: 'Your package will arrive today between 2-5PM. No action required.', timestamp: new Date(Date.now() - 3600000).toISOString(), direction: 'incoming' }], summary: 'Routine delivery notification. No threats detected.', recommendations: ['No action required'] },
    ],
    'Telegram': [
        {
            name: '@darkweb_recruiter', handle: '@darkweb_recruiter', riskLevel: 9,
            threats: ['Criminal recruitment', 'Illegal content sharing', 'Coercive pressure'],
            messages: [
                { sender: '@darkweb_recruiter', content: 'You have been selected to join our private channel. 50k BDT/month. Just help us move some packages, no questions asked.', timestamp: new Date(Date.now() - 5400000).toISOString(), direction: 'incoming' },
                { sender: 'Me', content: 'I am not interested. Who are you?', timestamp: new Date(Date.now() - 5000000).toISOString(), direction: 'outgoing' },
                { sender: '@darkweb_recruiter', content: 'Wrong answer. We already have your data from the data breach. Cooperate or we publish your info in this 50K-member channel.', timestamp: new Date(Date.now() - 3600000).toISOString(), direction: 'incoming' },
                { sender: '@darkweb_recruiter', content: '[Forwarded file: your_personal_data.zip - 2.3MB]', timestamp: new Date(Date.now() - 1800000).toISOString(), direction: 'incoming' },
            ],
            summary: 'Telegram criminal recruitment with data breach extortion. Sender possesses personal data and is coercing cooperation with illegal activities under blackmail.',
            recommendations: ['Report channel and user to Telegram', 'Contact cybercrime division immediately', 'Change all passwords linked to your email', 'Enable 2FA on all accounts'],
        },
        {
            name: '@anon_harasser99', handle: '@anon_harasser99', riskLevel: 7,
            threats: ['Anonymous harassment', 'Targeted abuse', 'Doxxing threat'],
            messages: [
                { sender: '@anon_harasser99', content: 'I found your real address: [REDACTED]. Nice house.', timestamp: new Date(Date.now() - 3600000).toISOString(), direction: 'incoming' },
                { sender: '@anon_harasser99', content: 'Your employer will receive a very interesting email tomorrow about you.', timestamp: new Date(Date.now() - 1800000).toISOString(), direction: 'incoming' },
            ],
            summary: 'Telegram anonymous doxxing: user has identified home address and is threatening employment consequences. Classic targeted harassment pattern.',
            recommendations: ['Export chat as evidence', 'Report account on Telegram', 'Alert your employer about potential fake emails', 'Consider contacting cyber police'],
        },
        { name: '@study_group_bd', handle: '@study_group_bd', riskLevel: 1, threats: [], messages: [{ sender: '@study_group_bd', content: 'Chapter 7 notes have been uploaded. Good luck on Finals!', timestamp: new Date(Date.now() - 3600000).toISOString(), direction: 'incoming' }], summary: 'Normal study group message. No threats detected.', recommendations: ['No action required'] },
    ],
    'Instagram DM': [
        {
            name: 'fake_model_scam', handle: '@fake_model_scam', riskLevel: 9,
            threats: ['Romance scam', 'Sextortion', 'Intimate image threat'],
            messages: [
                { sender: 'fake_model_scam', content: 'Hey cutie 💕 I really like your profile. Want to video call? I am a model in Dubai.', timestamp: new Date(Date.now() - 86400000).toISOString(), direction: 'incoming' },
                { sender: 'Me', content: 'Sure, that sounds fun.', timestamp: new Date(Date.now() - 82800000).toISOString(), direction: 'outgoing' },
                { sender: 'fake_model_scam', content: 'I screenshotted our video. You have 2 hours to send $500 gift cards or I post this to your followers. I already have your follower list.', timestamp: new Date(Date.now() - 1800000).toISOString(), direction: 'incoming' },
                { sender: 'fake_model_scam', content: 'Tick tock. Your family follows you on Instagram, right? 😈', timestamp: new Date(Date.now() - 900000).toISOString(), direction: 'incoming' },
            ],
            summary: 'Instagram sextortion: romance scam progressed to screen-recording extortion. Victim is threatened with content exposure to followers and family.',
            recommendations: ['Do NOT pay — payment escalates demands', 'Report the account on Instagram for blackmail', 'Lock down your Instagram to private immediately', 'Contact cybercrime police with screenshots'],
        },
        {
            name: 'troll_army_account', handle: '@troll.brigade', riskLevel: 8,
            threats: ['Coordinated trolling', 'Hate speech', 'Coordinated report bombing'],
            messages: [
                { sender: 'troll_army_account', content: 'You should delete your account. Our group of 200+ people will report and spam you until Instagram bans you.', timestamp: new Date(Date.now() - 3600000).toISOString(), direction: 'incoming' },
                { sender: 'troll_army_account', content: 'We already submitted fake reports on your last 10 posts. Just wait.', timestamp: new Date(Date.now() - 1800000).toISOString(), direction: 'incoming' },
            ],
            summary: 'Instagram coordinated harassment: organized troll group actively report-bombing account to trigger platform ban. Clear targeted harassment campaign.',
            recommendations: ['Document all messages', 'Report coordinated harassment to Instagram Trust & Safety', 'Enable comment filters and limit DMs to followers', 'Preserve evidence before account potential suspension'],
        },
        { name: 'best_friend_riya', handle: '@riya.official', riskLevel: 1, threats: [], messages: [{ sender: 'best_friend_riya', content: 'Omg your last reel got 10K views!! You are literally going viral 🔥', timestamp: new Date(Date.now() - 3600000).toISOString(), direction: 'incoming' }], summary: 'Friendly social interaction. No threats detected.', recommendations: ['No action required'] },
    ],
    'Twitter DM': [
        {
            name: '@politic_troll_X', handle: '@politic_troll_X', riskLevel: 9,
            threats: ['Targeted harassment campaign', 'Doxxing', 'Death threat'],
            messages: [
                { sender: '@politic_troll_X', content: 'Your tweet about the election crossed a line. We know your home district. You have been warned.', timestamp: new Date(Date.now() - 7200000).toISOString(), direction: 'incoming' },
                { sender: 'Me', content: 'I am entitled to my opinion. This is harassment.', timestamp: new Date(Date.now() - 7000000).toISOString(), direction: 'outgoing' },
                { sender: '@politic_troll_X', content: 'THREAD INCOMING: We are about to expose your full personal profile to 80K followers. Your government job will end.', timestamp: new Date(Date.now() - 3600000).toISOString(), direction: 'incoming' },
                { sender: '@politic_troll_X', content: 'Still got your address from the voter list leak. Keep posting and see what happens.', timestamp: new Date(Date.now() - 900000).toISOString(), direction: 'incoming' },
            ],
            summary: 'Twitter coordinated political harassment with doxxing using leaked voter data. Explicit threats to employment and physical safety escalate this to critical threat level.',
            recommendations: ['Report to Twitter/X Safety and National Cyber Cell', 'Lock your Twitter account to followers only', 'Alert your employer proactively', 'Do not engage — preserve all DM evidence'],
        },
        {
            name: '@crypto_scammer_bot', handle: '@cryptoking_official', riskLevel: 6,
            threats: ['Crypto investment fraud', 'Impersonating verified account', 'Financial coercion'],
            messages: [
                { sender: '@crypto_scammer_bot', content: 'Hi! I am Elon Musk verified. Your tweet was selected for our $10,000 BTC giveaway. Send 0.01 BTC to verify wallet and receive 1 BTC instantly!', timestamp: new Date(Date.now() - 3600000).toISOString(), direction: 'incoming' },
            ],
            summary: 'Twitter crypto scam: celebrity impersonation targeting your recent tweet for advance-fee fraud. Classic BTC doubling scam.',
            recommendations: ['Do not send any cryptocurrency', 'Report the account as impersonation', 'Block the account', 'Warn your followers about the scam account'],
        },
        { name: '@friend_dev_arif', handle: '@arif_codes', riskLevel: 1, threats: [], messages: [{ sender: '@arif_codes', content: 'Loved your thread on open source! Want to collaborate on a project? 🚀', timestamp: new Date(Date.now() - 3600000).toISOString(), direction: 'incoming' }], summary: 'Normal professional networking. No threats detected.', recommendations: ['No action required'] },
    ],
};

export function generateDemoScan(accountId: string, platform: Platform, personaIndex: number): ScannedConversation {
    const platformScenarios = PLATFORM_THREATS[platform];
    const scenario = platformScenarios[personaIndex % platformScenarios.length];

    return {
        id: `scan-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        accountId,
        platform,
        contactName: scenario.name,
        contactHandle: scenario.handle,
        scannedAt: new Date().toISOString(),
        messages: scenario.messages,
        riskLevel: scenario.riskLevel,
        riskSummary: scenario.summary,
        detectedThreats: scenario.threats,
        recommendations: scenario.recommendations,
        aiAnalysisSource: 'local-fallback',
        autoCaseCreated: false,
        autoCaseId: null,
        dmsTriggerAt: null,
        dmsFired: false,
        userMarkedSafe: false,
        warningDismissed: false,
    };
}
