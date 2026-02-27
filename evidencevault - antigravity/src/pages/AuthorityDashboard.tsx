import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Shield, Users, ClipboardList, FolderOpen, UserPlus,
  Lock, Unlock, AlertTriangle, Trash2, ChevronDown,
  ShieldCheck, ShieldAlert, MoreVertical, RefreshCw,
  Fingerprint, FileText, Radar, Siren
} from 'lucide-react';

// Lib
import { getAllUsers, seedDemoUsers, getCurrentAppUser, type AppUser } from '../lib/rbac';
import {
  getAllManagedCases, getCaseMetrics, seedDemoCases,
  updateManagedCase, deleteManagedCase, getNextStatuses,
  type ManagedCase, type CaseStatus, type CasePriority,
} from '../lib/caseStore';
import { getGlobalAuditLog, seedDemoAuditLog, appendAuditEntry } from '../lib/auditLog';
import { getPendingInvitations } from '../lib/inviteStore';
import { getPendingRequests, getAllRequests, approveRequest, rejectRequest, seedDemoRequests, type InvestigatorRequest } from '../lib/investigatorRequests';
import { getEvidenceCountForCase } from '../lib/evidenceStore';
import { getAllScans, getAllAlerts, getUnreadAlertCount, getRiskColor, getRiskLabel, PLATFORM_CONFIG } from '../lib/socialMonitorStore';

// Components
import CaseOverviewMetrics from '../components/admin/CaseOverviewMetrics';
import { CaseStatusBadge, CasePriorityBadge } from '../components/admin/CaseStatusBadge';
import { RoleBadge } from '../components/admin/RoleBadge';
import AuditLogPanel from '../components/admin/AuditLogPanel';
import InvestigatorManagement from '../components/admin/InvestigatorManagement';
import InviteInvestigatorModal from '../components/admin/InviteInvestigatorModal';

type TabId = 'overview' | 'investigators' | 'audit' | 'cases' | 'requests' | 'social';

export default function AuthorityDashboard() {
  const [tab, setTab] = useState<TabId>('overview');
  const [inviteOpen, setInviteOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [actionMenuOpen, setActionMenuOpen] = useState<string | null>(null);

  // Seed demo data on first load
  useEffect(() => {
    seedDemoUsers();
    seedDemoCases();
    seedDemoAuditLog();
    seedDemoRequests();
  }, []);

  const refresh = () => setRefreshKey(k => k + 1);

  // Data
  const currentUser = getCurrentAppUser();
  const metrics = getCaseMetrics();
  const cases = getAllManagedCases();
  const users = getAllUsers();
  const auditLog = getGlobalAuditLog();
  const pendingInvites = getPendingInvitations();
  const pendingRequests = getPendingRequests();
  const allRequests = getAllRequests();

  // Handlers
  const handleStatusChange = (caseId: string, newStatus: CaseStatus) => {
    updateManagedCase(caseId, { status: newStatus });
    appendAuditEntry(caseId, 'status_changed', currentUser?.email || 'admin', 'admin', `Status → ${newStatus}`);
    refresh();
    setActionMenuOpen(null);
  };

  const handlePriorityChange = (caseId: string, newPriority: CasePriority) => {
    updateManagedCase(caseId, { priority: newPriority });
    appendAuditEntry(caseId, 'priority_changed', currentUser?.email || 'admin', 'admin', `Priority → ${newPriority}`);
    refresh();
  };

  const handleToggleLock = (c: ManagedCase) => {
    updateManagedCase(c.caseId, { locked: !c.locked });
    appendAuditEntry(c.caseId, c.locked ? 'case_unlocked' : 'case_locked', currentUser?.email || 'admin', 'admin', c.locked ? 'Case unlocked' : 'Case locked');
    refresh();
    setActionMenuOpen(null);
  };

  const handleVerifyIntegrity = (c: ManagedCase) => {
    updateManagedCase(c.caseId, { integrityVerified: true, tamperFlag: false });
    appendAuditEntry(c.caseId, 'integrity_verified', currentUser?.email || 'admin', 'admin', 'Manual integrity verification passed');
    refresh();
    setActionMenuOpen(null);
  };

  const handleFlagTamper = (c: ManagedCase) => {
    updateManagedCase(c.caseId, { tamperFlag: true, integrityVerified: false });
    appendAuditEntry(c.caseId, 'tamper_detected', currentUser?.email || 'admin', 'admin', 'Evidence tamper flagged by authority');
    refresh();
    setActionMenuOpen(null);
  };

  const handleDeleteCase = (c: ManagedCase) => {
    if (!window.confirm(`Permanently delete case "${c.title}"? This cannot be undone.`)) return;
    deleteManagedCase(c.caseId);
    appendAuditEntry(c.caseId, 'case_deleted', currentUser?.email || 'admin', 'admin', `Case ${c.title} deleted`);
    refresh();
  };

  const handleEmergencyOverride = (c: ManagedCase) => {
    if (!window.confirm(`Trigger EMERGENCY OVERRIDE on "${c.title}"? This will forcefully unlock and escalate the case.`)) return;
    updateManagedCase(c.caseId, { locked: false, status: 'Open' as CaseStatus, priority: 'Critical' as CasePriority });
    appendAuditEntry(c.caseId, 'emergency_override', currentUser?.email || 'admin', 'admin', 'Emergency override: case unlocked + escalated to Critical');
    refresh();
    setActionMenuOpen(null);
  };

  // Tabs
  const tabs: { id: TabId; label: string; icon: React.ReactNode; count?: number }[] = [
    { id: 'overview', label: 'Overview', icon: <FolderOpen className="w-4 h-4" /> },
    { id: 'investigators', label: 'Investigators', icon: <Users className="w-4 h-4" />, count: users.filter(u => u.role !== 'admin').length },
    { id: 'audit', label: 'Audit Log', icon: <ClipboardList className="w-4 h-4" />, count: auditLog.length },
    { id: 'cases', label: 'All Cases', icon: <FileText className="w-4 h-4" />, count: cases.length },
    { id: 'requests', label: 'Requests', icon: <UserPlus className="w-4 h-4" />, count: pendingRequests.length },
    { id: 'social', label: 'Social Threats', icon: <Radar className="w-4 h-4" />, count: getUnreadAlertCount() || undefined },
  ];

  return (
    <div className="p-8 max-w-7xl mx-auto">

      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4 mb-8">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-3xl font-semibold text-zinc-100 tracking-tight">Authority Dashboard</h1>
            <RoleBadge role="admin" size="md" />
          </div>
          <p className="text-zinc-400">Manage cases, investigators, and system integrity.</p>
        </div>
        <div className="flex items-center gap-3">
          {pendingInvites.length > 0 && (
            <span className="text-xs text-amber-400 bg-amber-500/10 px-3 py-1.5 rounded-full border border-amber-500/20">
              {pendingInvites.length} pending invite(s)
            </span>
          )}
          <button
            onClick={() => setInviteOpen(true)}
            className="bg-blue-600 hover:bg-blue-500 text-white font-semibold px-4 py-2.5 rounded-lg transition-colors flex items-center gap-2 text-sm"
          >
            <UserPlus className="w-4 h-4" />
            Invite Investigator
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 mb-8 border-b border-zinc-800 overflow-x-auto">
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${tab === t.id
              ? 'border-emerald-400 text-emerald-400'
              : 'border-transparent text-zinc-500 hover:text-zinc-300'
              }`}
          >
            {t.icon}
            {t.label}
            {t.count !== undefined && (
              <span className="text-xs bg-zinc-800 text-zinc-400 px-1.5 py-0.5 rounded-full ml-1">{t.count}</span>
            )}
          </button>
        ))}
      </div>

      {/* ─── TAB: OVERVIEW ───────────────────────────── */}
      {tab === 'overview' && (
        <div className="space-y-8">
          <CaseOverviewMetrics metrics={metrics} />

          {/* Recent Cases */}
          <div>
            <h3 className="text-lg font-semibold text-zinc-200 mb-4">Recent Cases</h3>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {cases.slice(0, 6).map(c => (
                <Link
                  key={c.caseId}
                  to={`/cases/${c.caseId}`}
                  className="group bg-zinc-900 border border-zinc-800 hover:border-emerald-500/40 rounded-xl p-5 transition-all"
                >
                  <div className="flex items-start justify-between mb-3">
                    <CaseStatusBadge status={c.status} />
                    <CasePriorityBadge priority={c.priority} />
                  </div>
                  <h4 className="text-base font-semibold text-zinc-100 mb-1 line-clamp-1 group-hover:text-emerald-400 transition-colors">
                    {c.title}
                  </h4>
                  <p className="text-xs text-zinc-500 line-clamp-2 mb-3">{c.description}</p>
                  <div className="flex items-center justify-between text-xs text-zinc-600">
                    <span className="font-mono">{c.caseId.slice(0, 16)}</span>
                    <div className="flex items-center gap-2">
                      {c.locked && <Lock className="w-3 h-3 text-amber-400" />}
                      {c.tamperFlag && <ShieldAlert className="w-3 h-3 text-red-400" />}
                      <Users className="w-3 h-3" />
                      <span>{c.assignedInvestigators.length}</span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ─── TAB: INVESTIGATORS ──────────────────────── */}
      {tab === 'investigators' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-zinc-200">Team Management</h3>
            <button
              onClick={() => setInviteOpen(true)}
              className="text-sm text-blue-400 hover:text-blue-300 transition-colors font-medium"
            >
              + Invite New
            </button>
          </div>
          <InvestigatorManagement users={users} onRefresh={refresh} />
        </div>
      )}

      {/* ─── TAB: AUDIT LOG ──────────────────────────── */}
      {tab === 'audit' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-zinc-200">Audit Log Management</h3>
              <p className="text-sm text-zinc-500 mt-0.5">Complete immutable history of all system actions. Admins can filter, export, and prune entries.</p>
            </div>
            <button onClick={refresh}
              className="flex items-center gap-2 text-xs text-zinc-400 hover:text-zinc-200 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 px-3 py-2 rounded-lg transition-colors font-medium">
              <RefreshCw className="w-3.5 h-3.5" /> Refresh
            </button>
          </div>
          <AuditLogPanel entries={auditLog} onRefresh={refresh} />
        </div>
      )}


      {/* ─── TAB: ALL CASES ──────────────────────────── */}
      {tab === 'cases' && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-zinc-200">All Cases ({cases.length})</h3>

          {cases.length === 0 ? (
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-8 text-center text-zinc-500">
              No cases found.
            </div>
          ) : (
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-800 text-zinc-500 text-xs uppercase tracking-wider">
                    <th className="text-left px-4 py-3 font-medium">Case</th>
                    <th className="text-left px-4 py-3 font-medium">Status</th>
                    <th className="text-left px-4 py-3 font-medium">Priority</th>
                    <th className="text-left px-4 py-3 font-medium">Investigators</th>
                    <th className="text-left px-4 py-3 font-medium">Security</th>
                    <th className="text-right px-4 py-3 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {cases.map(c => (
                    <tr key={c.caseId} className="border-b border-zinc-800/50 hover:bg-zinc-800/20 transition-colors">
                      <td className="px-4 py-3">
                        <Link to={`/cases/${c.caseId}`} className="text-zinc-200 hover:text-emerald-400 font-medium transition-colors">
                          {c.title}
                        </Link>
                        <p className="text-xs text-zinc-600 font-mono mt-0.5">{c.caseId.slice(0, 20)}</p>
                      </td>
                      <td className="px-4 py-3">
                        <div className="relative inline-block">
                          <select
                            value={c.status}
                            onChange={e => handleStatusChange(c.caseId, e.target.value as CaseStatus)}
                            disabled={c.locked}
                            className="bg-transparent text-xs font-semibold text-zinc-300 pr-5 py-0.5 appearance-none focus:outline-none cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            <option value={c.status}>{c.status}</option>
                            {getNextStatuses(c.status).map(s => (
                              <option key={s} value={s}>{s}</option>
                            ))}
                          </select>
                          <ChevronDown className="w-3 h-3 text-zinc-600 absolute right-0 top-1/2 -translate-y-1/2 pointer-events-none" />
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="relative inline-block">
                          <select
                            value={c.priority}
                            onChange={e => handlePriorityChange(c.caseId, e.target.value as CasePriority)}
                            disabled={c.locked}
                            className="bg-transparent text-xs font-semibold text-zinc-300 pr-5 py-0.5 appearance-none focus:outline-none cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {(['Low', 'Medium', 'High', 'Critical'] as CasePriority[]).map(p => (
                              <option key={p} value={p}>{p}</option>
                            ))}
                          </select>
                          <ChevronDown className="w-3 h-3 text-zinc-600 absolute right-0 top-1/2 -translate-y-1/2 pointer-events-none" />
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs text-zinc-400">
                          {c.assignedInvestigators.length} assigned · {getEvidenceCountForCase(c.caseId)} evidence
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          {c.locked && (
                            <span className="text-xs text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full flex items-center gap-1">
                              <Lock className="w-3 h-3" /> Locked
                            </span>
                          )}
                          {c.tamperFlag && (
                            <span className="text-xs text-red-400 bg-red-500/10 px-2 py-0.5 rounded-full flex items-center gap-1">
                              <ShieldAlert className="w-3 h-3" /> Tamper
                            </span>
                          )}
                          {c.integrityVerified && !c.tamperFlag && (
                            <span className="text-xs text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full flex items-center gap-1">
                              <ShieldCheck className="w-3 h-3" /> Verified
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="relative inline-block">
                          <button
                            onClick={() => setActionMenuOpen(actionMenuOpen === c.caseId ? null : c.caseId)}
                            className="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-500 hover:text-zinc-300 transition-colors"
                          >
                            <MoreVertical className="w-4 h-4" />
                          </button>

                          {actionMenuOpen === c.caseId && (
                            <div className="absolute right-0 top-full mt-1 w-52 bg-zinc-800 border border-zinc-700 rounded-xl shadow-xl z-20 py-1 overflow-hidden">
                              <Link
                                to={`/cases/${c.caseId}`}
                                className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-zinc-300 hover:bg-zinc-700/50 transition-colors"
                              >
                                <FileText className="w-4 h-4 text-zinc-500" />
                                View Details
                              </Link>
                              <button
                                onClick={() => handleToggleLock(c)}
                                className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-zinc-300 hover:bg-zinc-700/50 transition-colors"
                              >
                                {c.locked ? <Unlock className="w-4 h-4 text-amber-400" /> : <Lock className="w-4 h-4 text-amber-400" />}
                                {c.locked ? 'Unlock Case' : 'Lock Case'}
                              </button>
                              <button
                                onClick={() => handleVerifyIntegrity(c)}
                                className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-zinc-300 hover:bg-zinc-700/50 transition-colors"
                              >
                                <Fingerprint className="w-4 h-4 text-emerald-400" />
                                Verify Integrity
                              </button>
                              <button
                                onClick={() => handleFlagTamper(c)}
                                className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-zinc-300 hover:bg-zinc-700/50 transition-colors"
                              >
                                <ShieldAlert className="w-4 h-4 text-red-400" />
                                Flag Tamper
                              </button>
                              <div className="border-t border-zinc-700 my-1" />
                              <button
                                onClick={() => handleEmergencyOverride(c)}
                                className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-red-400 hover:bg-red-500/10 transition-colors"
                              >
                                <AlertTriangle className="w-4 h-4" />
                                Emergency Override
                              </button>
                              <button
                                onClick={() => handleDeleteCase(c)}
                                className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-red-400 hover:bg-red-500/10 transition-colors"
                              >
                                <Trash2 className="w-4 h-4" />
                                Delete Case
                              </button>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ─── TAB: SOCIAL THREATS ─────────────────────── */}
      {tab === 'social' && (() => {
        const scans = getAllScans();
        const unreadAlerts = getAllAlerts().filter(a => !a.read);
        const highRiskScans = scans.filter(s => s.riskLevel >= 7);
        return (
          <div className="space-y-6">
            {/* Social Monitor Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: 'Total Scans', value: scans.length, color: 'text-blue-400', bg: 'bg-blue-500/10' },
                { label: 'High-Risk Convos', value: highRiskScans.length, color: 'text-red-400', bg: 'bg-red-500/10' },
                { label: 'Auto-Cases Created', value: scans.filter(s => s.autoCaseCreated).length, color: 'text-purple-400', bg: 'bg-purple-500/10' },
                { label: 'Unread Alerts', value: unreadAlerts.length, color: 'text-amber-400', bg: 'bg-amber-500/10' },
              ].map((stat, i) => (
                <div key={i} className={`${stat.bg} border border-zinc-800 rounded-xl p-4`}>
                  <p className={`text-2xl font-black ${stat.color}`}>{stat.value}</p>
                  <p className="text-xs font-semibold text-zinc-400 mt-1">{stat.label}</p>
                </div>
              ))}
            </div>

            {/* DMS Fired Alert */}
            {scans.filter(s => s.dmsFired && !s.userMarkedSafe).length > 0 && (
              <div className="flex items-start gap-3 p-4 bg-red-500/10 border border-red-500/30 rounded-xl">
                <Siren className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold text-red-300">Dead Man's Switch Fired</p>
                  <p className="text-sm text-red-400/80">{scans.filter(s => s.dmsFired && !s.userMarkedSafe).length} emergency report(s) were automatically sent to trusted contacts.</p>
                </div>
              </div>
            )}

            {/* Scans Table */}
            <div>
              <h3 className="text-lg font-semibold text-zinc-200 mb-4">All Scanned Conversations</h3>
              {scans.length === 0 ? (
                <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-8 text-center text-zinc-500">
                  No conversations scanned yet. Run a scan from Social Monitor.
                </div>
              ) : (
                <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-zinc-800 text-zinc-500 text-xs uppercase tracking-wider">
                        <th className="text-left px-4 py-3 font-medium">Contact</th>
                        <th className="text-left px-4 py-3 font-medium">Platform</th>
                        <th className="text-left px-4 py-3 font-medium">Risk</th>
                        <th className="text-left px-4 py-3 font-medium">Threats</th>
                        <th className="text-left px-4 py-3 font-medium">Case ID</th>
                        <th className="text-left px-4 py-3 font-medium">Status</th>
                        <th className="text-left px-4 py-3 font-medium">Scanned</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[...scans].sort((a, b) => b.riskLevel - a.riskLevel).map(scan => {
                        const colors = getRiskColor(scan.riskLevel);
                        const cfg = PLATFORM_CONFIG[scan.platform];
                        return (
                          <tr key={scan.id} className="border-b border-zinc-800/50 hover:bg-zinc-800/20 transition-colors">
                            <td className="px-4 py-3">
                              <p className="text-zinc-200 font-medium">{scan.contactName}</p>
                              <p className="text-xs text-zinc-500 font-mono">{scan.contactHandle}</p>
                            </td>
                            <td className="px-4 py-3">
                              <span className="flex items-center gap-1.5 text-zinc-300">
                                {cfg.icon} {scan.platform}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold border ${colors.text} ${colors.bg} ${colors.border}`}>
                                {scan.riskLevel}/10 {getRiskLabel(scan.riskLevel)}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex flex-wrap gap-1">
                                {scan.detectedThreats.slice(0, 2).map((t, i) => (
                                  <span key={i} className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 px-1.5 py-0.5 rounded">{t}</span>
                                ))}
                                {scan.detectedThreats.length > 2 && (
                                  <span className="text-xs text-zinc-500">+{scan.detectedThreats.length - 2} more</span>
                                )}
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              {scan.autoCaseCreated && scan.autoCaseId ? (
                                <Link to={`/cases/${scan.autoCaseId}`} className="text-xs text-purple-400 hover:text-purple-300 font-mono transition-colors">
                                  {scan.autoCaseId.slice(0, 20)}…
                                </Link>
                              ) : (
                                <span className="text-xs text-zinc-600">—</span>
                              )}
                            </td>
                            <td className="px-4 py-3">
                              {scan.dmsFired && !scan.userMarkedSafe && (
                                <span className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 px-2 py-0.5 rounded-full flex items-center gap-1 w-fit">
                                  <Siren className="w-3 h-3" /> DMS Fired
                                </span>
                              )}
                              {scan.userMarkedSafe && (
                                <span className="text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full w-fit">Safe</span>
                              )}
                              {!scan.dmsFired && !scan.userMarkedSafe && scan.dmsTriggerAt && (
                                <span className="text-xs text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-full w-fit">DMS Armed</span>
                              )}
                              {!scan.dmsFired && !scan.userMarkedSafe && !scan.dmsTriggerAt && (
                                <span className="text-xs text-zinc-500">No DMS</span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-xs text-zinc-500">
                              {new Date(scan.scannedAt).toLocaleString()}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        );
      })()}

      {/* ─── TAB: REQUESTS ──────────────────────────── */}
      {tab === 'requests' && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-zinc-200">Investigator Access Requests</h3>

          {allRequests.length === 0 ? (
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-8 text-center text-zinc-500">
              No requests yet.
            </div>
          ) : (
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-800 text-zinc-500 text-xs uppercase tracking-wider">
                    <th className="text-left px-4 py-3 font-medium">Name</th>
                    <th className="text-left px-4 py-3 font-medium">Email</th>
                    <th className="text-left px-4 py-3 font-medium">Case</th>
                    <th className="text-left px-4 py-3 font-medium">Message</th>
                    <th className="text-left px-4 py-3 font-medium">Status</th>
                    <th className="text-right px-4 py-3 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {allRequests.map(req => (
                    <tr key={req.id} className="border-b border-zinc-800/50 hover:bg-zinc-800/20 transition-colors">
                      <td className="px-4 py-3 text-zinc-200 font-medium">{req.name}</td>
                      <td className="px-4 py-3 text-zinc-400 text-xs font-mono">{req.email}</td>
                      <td className="px-4 py-3 text-xs text-zinc-500 font-mono">{req.requestedCaseId || '—'}</td>
                      <td className="px-4 py-3 text-xs text-zinc-400 max-w-xs truncate">{req.message}</td>
                      <td className="px-4 py-3">
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${req.status === 'pending' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' :
                          req.status === 'approved' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                            'bg-red-500/10 text-red-400 border border-red-500/20'
                          }`}>
                          {req.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        {req.status === 'pending' && (
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => {
                                approveRequest(req.id, currentUser?.email || 'admin', 'investigator');
                                appendAuditEntry(req.requestedCaseId || 'system', 'investigator_assigned', currentUser?.email || 'admin', 'admin', `Approved request from ${req.email}`);
                                refresh();
                              }}
                              className="text-xs font-semibold text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 px-3 py-1.5 rounded-lg transition-colors"
                            >
                              Approve
                            </button>
                            <button
                              onClick={() => {
                                rejectRequest(req.id, currentUser?.email || 'admin');
                                appendAuditEntry(req.requestedCaseId || 'system', 'investigator_removed', currentUser?.email || 'admin', 'admin', `Rejected request from ${req.email}`);
                                refresh();
                              }}
                              className="text-xs font-semibold text-red-400 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 px-3 py-1.5 rounded-lg transition-colors"
                            >
                              Reject
                            </button>
                          </div>
                        )}
                        {req.status !== 'pending' && (
                          <span className="text-xs text-zinc-500">Resolved</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Invite Modal */}
      <InviteInvestigatorModal
        isOpen={inviteOpen}
        onClose={() => setInviteOpen(false)}
        onInviteSent={(inv) => {
          appendAuditEntry(
            inv.caseIds[0] || 'system',
            'invitation_sent',
            currentUser?.email || 'admin',
            'admin',
            `Invitation sent to ${inv.email} (role: ${inv.role})`
          );
          refresh();
        }}
      />
    </div>
  );
}
