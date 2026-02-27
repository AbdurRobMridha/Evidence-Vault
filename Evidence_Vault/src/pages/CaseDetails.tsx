import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Download, Clock, Trash2, Package, Loader2, Lock, Unlock, ShieldCheck, ShieldAlert, ChevronDown } from 'lucide-react';
import { format } from 'date-fns';
import CaseDetailsDashboard from '../components/CaseDetailsDashboard';
import { exportCaseAsZip } from '../lib/evidenceDownload';
import { getCurrentAppUser, canAccessCase, hasPermission, type AppUser } from '../lib/rbac';
import { getManagedCaseById, updateManagedCase, getNextStatuses, type ManagedCase, type CaseStatus } from '../lib/caseStore';
import { appendAuditEntry } from '../lib/auditLog';
import { CaseStatusBadge, CasePriorityBadge } from '../components/admin/CaseStatusBadge';
import { RoleBadge } from '../components/admin/RoleBadge';

export default function CaseDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [caseData, setCaseData] = useState<any>(null);
  const [managedCase, setManagedCase] = useState<ManagedCase | null>(null);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<AppUser | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);

  useEffect(() => {
    const currentUser = getCurrentAppUser();
    setUser(currentUser);

    // Removed premature access check here.
    // Access is now checked in render after data loads.

    // Try managed case store first
    if (id) {
      const mc = getManagedCaseById(id);
      if (mc) {
        setManagedCase(mc);
        // Convert to legacy format for CaseDetailsDashboard compatibility
        setCaseData({
          id: mc.caseId,
          title: mc.title,
          description: mc.description,
          status: mc.status.toLowerCase().replace(/ /g, '_'),
          created_at: mc.createdAt,
          risk_score: mc.priority === 'Critical' ? 9 : mc.priority === 'High' ? 7 : mc.priority === 'Medium' ? 4 : 2,
          user_id: mc.createdBy,
        });
        setLoading(false);
        return;
      }
    }

    // Fallback: Fetch from API
    fetch(`/api/cases/${id}`)
      .then(res => res.json())
      .then(data => setCaseData(data))
      .catch(() => { })
      .finally(() => setLoading(false));
  }, [id, navigate]);

  const handleExportZip = async () => {
    if (exporting || !id) return;
    setExporting(true);
    setExportProgress(0);
    try {
      await exportCaseAsZip(
        id,
        user?.email || 'unknown',
        (percent) => setExportProgress(Math.round(percent))
      );
      if (managedCase) {
        appendAuditEntry(id, 'case_exported', user?.email || 'unknown', user?.role || 'unknown', 'Case exported as ZIP');
      }
    } catch (err: any) {
      console.error('[ZIP Export] Error:', err);
      alert(`Export failed: ${err.message || 'Unknown error'}`);
    } finally {
      setExporting(false);
      setExportProgress(0);
    }
  };

  const handleStatusChange = (newStatus: CaseStatus) => {
    if (!id || !managedCase) return;
    updateManagedCase(id, { status: newStatus });
    setManagedCase(prev => prev ? { ...prev, status: newStatus } : null);
    appendAuditEntry(id, 'status_changed', user?.email || 'unknown', user?.role || 'unknown', `Status → ${newStatus}`);
  };

  const handleToggleLock = () => {
    if (!id || !managedCase) return;
    const newLocked = !managedCase.locked;
    updateManagedCase(id, { locked: newLocked });
    setManagedCase(prev => prev ? { ...prev, locked: newLocked } : null);
    appendAuditEntry(id, newLocked ? 'case_locked' : 'case_unlocked', user?.email || 'unknown', user?.role || 'unknown', newLocked ? 'Case locked' : 'Case unlocked');
  };

  if (loading) return (
    <div className="p-8 flex items-center justify-center min-h-[400px]">
      <div className="flex flex-col items-center gap-3 text-zinc-500 animate-pulse">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
        <p>Verifying access and loading case details...</p>
      </div>
    </div>
  );

  if (!caseData) return <div className="p-8 text-red-400">Case not found</div>;

  // Strict RBAC check AFTER case is loaded
  const isCreatorIdMatch = managedCase?.createdBy === user?.id || caseData.user_id === user?.id;
  const isCreatorEmailMatch = !!(managedCase?.createdByEmail && user?.email && managedCase.createdByEmail === user.email);
  const isAssigned = managedCase?.assignedInvestigators?.includes(user?.id || '');
  const isAdmin = user?.role === 'admin';
  const isInvestigator = user?.role === 'investigator';

  if (!isAdmin && !isCreatorIdMatch && !isCreatorEmailMatch && !isAssigned) {
    // If we get here, they are not admin, not the creator, and not an assigned investigator.
    // They cannot view this case.
    return (
      <div className="p-8 max-w-7xl mx-auto mt-10">
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-8 text-center max-w-md mx-auto">
          <ShieldAlert className="w-12 h-12 text-red-400 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-red-400 mb-2">Access Denied</h2>
          <p className="text-red-300/80 mb-6">
            You do not have permission to view this resource.
            This case belongs to another user.
          </p>
          <button onClick={() => navigate('/dashboard')} className="bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-medium px-4 py-2 rounded-lg transition-colors">
            Return to Dashboard
          </button>
        </div>
      </div>
    );
  }

  const canDelete = isAdmin;
  const canLock = isAdmin;
  const canChangeStatus = isAdmin || isInvestigator;
  const isLocked = managedCase?.locked ?? false;
  const nextStatuses = managedCase ? getNextStatuses(managedCase.status) : [];

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-3xl font-semibold text-zinc-100 tracking-tight">{caseData.title}</h1>
            {managedCase ? (
              <CaseStatusBadge status={managedCase.status} />
            ) : (
              <span className={`text-xs font-mono px-2 py-1 rounded-full ${caseData.status === 'escalated' ? 'bg-red-500/10 text-red-400 border border-red-500/20' :
                caseData.status === 'closed' ? 'bg-zinc-800 text-zinc-400' :
                  'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                }`}>
                {caseData.status.toUpperCase()}
              </span>
            )}
          </div>
          <div className="flex items-center gap-4">
            <p className="text-zinc-400 flex items-center gap-2 text-sm">
              <Clock className="w-4 h-4" />
              Created on {format(new Date(caseData.created_at || caseData.createdAt), 'PPP')}
            </p>
            {user && <RoleBadge role={user.role} />}
            {managedCase && <CasePriorityBadge priority={managedCase.priority} />}
          </div>
          <p className="text-zinc-500 text-sm mt-1">{caseData.description}</p>
        </div>

        <div className="flex items-center gap-3">
          {/* Status Dropdown (if managed case) */}
          {managedCase && canChangeStatus && nextStatuses.length > 0 && !isLocked && (
            <div className="relative">
              <select
                value={managedCase.status}
                onChange={e => handleStatusChange(e.target.value as CaseStatus)}
                className="bg-zinc-800 border border-zinc-700 text-zinc-200 text-sm rounded-lg pl-3 pr-8 py-2.5 appearance-none focus:outline-none focus:border-emerald-500 cursor-pointer"
              >
                <option value={managedCase.status}>{managedCase.status}</option>
                {nextStatuses.filter(s => {
                  if (!isAdmin && ['Archived', 'Closed'].includes(s)) return false;
                  return true;
                }).map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-zinc-500 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          )}

          {/* Lock Toggle (admin only) */}
          {canLock && managedCase && (
            <button
              onClick={handleToggleLock}
              className={`font-medium px-3 py-2.5 rounded-lg transition-colors flex items-center gap-2 text-sm ${isLocked ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20 hover:bg-amber-500/20' : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300'
                }`}
              title={isLocked ? 'Unlock case' : 'Lock case'}
            >
              {isLocked ? <Unlock className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
              {isLocked ? 'Unlock' : 'Lock'}
            </button>
          )}

          {/* Security Status */}
          {managedCase && (
            <div className="flex items-center gap-1">
              {managedCase.tamperFlag ? (
                <span className="text-xs text-red-400 bg-red-500/10 px-2 py-1 rounded-full flex items-center gap-1 border border-red-500/20">
                  <ShieldAlert className="w-3 h-3" /> Tamper Alert
                </span>
              ) : managedCase.integrityVerified ? (
                <span className="text-xs text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded-full flex items-center gap-1 border border-emerald-500/20">
                  <ShieldCheck className="w-3 h-3" /> Verified
                </span>
              ) : null}
            </div>
          )}

          {/* Export */}
          <button
            onClick={handleExportZip}
            disabled={exporting || isLocked}
            className="bg-zinc-800 hover:bg-zinc-700 disabled:opacity-60 text-zinc-200 font-medium px-4 py-2.5 rounded-lg transition-colors flex items-center gap-2"
          >
            {exporting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Exporting... {exportProgress}%
              </>
            ) : (
              <>
                <Package className="w-4 h-4" />
                Export ZIP
              </>
            )}
          </button>

          {/* Delete (admin only) */}
          {canDelete && (
            <button
              onClick={async () => {
                const ok = window.confirm('Are you sure you want to permanently delete this case and all associated evidence? This action cannot be undone.');
                if (!ok) return;
                setDeleting(true);
                try {
                  if (managedCase) {
                    // Delete from managed store
                    const { deleteManagedCase } = await import('../lib/caseStore');
                    deleteManagedCase(id!);
                    appendAuditEntry(id!, 'case_deleted', user?.email || 'admin', 'admin', `Case "${caseData.title}" deleted`);
                    navigate('/dashboard');
                  } else {
                    const res = await fetch(`/api/cases/${id}/delete`, { method: 'POST', headers: { 'Content-Type': 'application/json' } });
                    if (res.ok) { alert('Case deleted'); navigate('/dashboard'); }
                    else { const err = await res.json().catch(() => ({})); alert('Delete failed: ' + (err.error || res.statusText)); }
                  }
                } catch (e) {
                  console.error(e);
                  alert('Delete failed');
                } finally {
                  setDeleting(false);
                }
              }}
              disabled={deleting || isLocked}
              className="bg-red-700 hover:bg-red-600 disabled:opacity-50 text-white font-medium px-4 py-2.5 rounded-lg transition-colors flex items-center gap-2"
            >
              <Trash2 className="w-4 h-4" />
              {deleting ? 'Deleting...' : 'Delete Case'}
            </button>
          )}
        </div>
      </div>

      {/* Dashboard with tabs */}
      <CaseDetailsDashboard
        caseId={id || ''}
        uploadedBy={user?.email || 'unknown'}
        userId={user?.id || user?.email || 'unknown'}
        userEmail={user?.email || 'unknown'}
      />
    </div>
  );
}
