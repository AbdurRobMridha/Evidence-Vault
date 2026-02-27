import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ShieldAlert, FileText, Clock, Plus, Users, Lock, ShieldCheck, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import {
  getCasesForUser, seedDemoCases, deleteManagedCase,
  type ManagedCase,
} from '../lib/caseStore';
import { getCurrentAppUser, seedDemoUsers, type AppUser } from '../lib/rbac';
import { RoleBadge } from '../components/admin/RoleBadge';
import { CaseStatusBadge, CasePriorityBadge } from '../components/admin/CaseStatusBadge';
import { appendAuditEntry } from '../lib/auditLog';

export default function Dashboard() {
  const [cases, setCases] = useState<ManagedCase[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<AppUser | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const loadCases = () => {
    seedDemoUsers();
    seedDemoCases();
    const user = getCurrentAppUser();
    setCurrentUser(user);
    if (user) {
      const userCases = getCasesForUser(user.id, user.role);
      setCases(userCases);
    } else {
      fetch('/api/cases')
        .then(res => res.json())
        .then(data => setCases(data))
        .catch(() => { });
    }
    setLoading(false);
  };

  useEffect(() => {
    loadCases();

    const onStorage = (e: StorageEvent) => {
      if (e.key === 'ev_managed_cases' || e.key === null) loadCases();
    };
    const onVisible = () => { if (document.visibilityState === 'visible') loadCases(); };
    const onCaseCreated = () => loadCases();

    window.addEventListener('storage', onStorage);
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('ev:case-created', onCaseCreated);
    return () => {
      window.removeEventListener('storage', onStorage);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('ev:case-created', onCaseCreated);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Remove case handler ────────────────────────────────────────────────────
  const handleRemoveCase = (e: React.MouseEvent, c: ManagedCase) => {
    e.preventDefault();   // prevent Link navigation
    e.stopPropagation();

    if (c.locked) {
      alert('This case is locked and cannot be deleted. Unlock it in Case Details first.');
      return;
    }

    const ok = window.confirm(
      `Permanently delete case "${c.title}"?\n\nThis will also remove all associated evidence records. This action cannot be undone.`
    );
    if (!ok) return;

    setDeletingId(c.caseId);
    try {
      deleteManagedCase(c.caseId);
      appendAuditEntry(
        c.caseId,
        'case_deleted',
        currentUser?.email || 'unknown',
        currentUser?.role || 'user',
        `Case "${c.title}" deleted from My Cases`
      );
      loadCases();          // instant refresh
    } catch (err) {
      console.error('[Dashboard] Delete failed:', err);
      alert('Failed to delete case. Please try again.');
    } finally {
      setDeletingId(null);
    }
  };

  // ── Permission: who can delete ─────────────────────────────────────────────
  const canDelete = (c: ManagedCase): boolean => {
    if (!currentUser) return false;
    if (currentUser.role === 'admin') return true;        // admin can delete any
    // Creator can delete their own case if not locked
    return (c.createdBy === currentUser.id || c.createdByEmail === currentUser.email) && !c.locked;
  };

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="flex justify-between items-end mb-8">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-3xl font-semibold text-zinc-100 tracking-tight">My Cases</h1>
            {currentUser && <RoleBadge role={currentUser.role} />}
          </div>
          <p className="text-zinc-400">
            {currentUser?.role === 'admin'
              ? 'Viewing all cases across the system.'
              : 'Securely manage and preserve your assigned digital evidence.'}
          </p>
        </div>
        <Link
          to="/upload"
          className="bg-emerald-500 hover:bg-emerald-600 text-zinc-950 font-semibold px-4 py-2.5 rounded-lg transition-colors flex items-center gap-2"
        >
          <Plus className="w-5 h-5" />
          New Case
        </Link>
      </div>

      {loading ? (
        <div className="text-zinc-500 animate-pulse">Loading cases...</div>
      ) : cases.length === 0 ? (
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-12 text-center">
          <div className="w-16 h-16 mx-auto rounded-full bg-zinc-800 flex items-center justify-center mb-4">
            <FileText className="w-8 h-8 text-zinc-500" />
          </div>
          <h3 className="text-xl font-medium text-zinc-200 mb-2">No cases found</h3>
          <p className="text-zinc-500 mb-6">
            {currentUser?.role === 'investigator'
              ? 'No cases have been assigned to you yet.'
              : 'Start by creating a new case and uploading evidence.'}
          </p>
          <Link
            to="/upload"
            className="inline-flex items-center gap-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-medium px-4 py-2 rounded-lg transition-colors"
          >
            Create Case
          </Link>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {cases.map(c => (
            // Outer div keeps position:relative so the delete button can be absolute
            <div key={c.caseId} className="relative group">
              <Link
                to={`/cases/${c.caseId}`}
                className="block bg-zinc-900 border border-zinc-800 hover:border-emerald-500/50 rounded-2xl p-6 transition-all h-full"
              >
                <div className="flex justify-between items-start mb-3">
                  <CaseStatusBadge status={c.status} />
                  <CasePriorityBadge priority={c.priority} />
                </div>

                <h3 className="text-lg font-medium text-zinc-100 mb-2 line-clamp-1 group-hover:text-emerald-400 transition-colors pr-6">
                  {c.title}
                </h3>
                <p className="text-sm text-zinc-500 mb-4 line-clamp-2">{c.description}</p>

                <div className="flex items-center justify-between text-xs font-mono text-zinc-500 border-t border-zinc-800 pt-4">
                  <div className="flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5" />
                    {format(new Date(c.createdAt), 'MMM d, yyyy')}
                  </div>
                  <div className="flex items-center gap-3">
                    {c.locked && <Lock className="w-3.5 h-3.5 text-amber-400" />}
                    {c.tamperFlag && <ShieldAlert className="w-3.5 h-3.5 text-red-400" />}
                    {c.integrityVerified && !c.tamperFlag && <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />}
                    <div className="flex items-center gap-1 text-zinc-600">
                      <Users className="w-3 h-3" />
                      {c.assignedInvestigators.length}
                    </div>
                  </div>
                </div>
              </Link>

              {/* ── Remove Case button (absolutely positioned, top-right) ── */}
              {canDelete(c) && (
                <button
                  onClick={(e) => handleRemoveCase(e, c)}
                  disabled={deletingId === c.caseId || c.locked}
                  title={c.locked ? 'Case is locked' : 'Remove case'}
                  className={`
                    absolute top-3 right-3
                    w-7 h-7 rounded-lg flex items-center justify-center
                    opacity-0 group-hover:opacity-100
                    transition-all duration-150
                    ${c.locked
                      ? 'bg-zinc-800 text-zinc-600 cursor-not-allowed'
                      : 'bg-zinc-800 hover:bg-red-500/20 text-zinc-500 hover:text-red-400 border border-zinc-700 hover:border-red-500/40'}
                    ${deletingId === c.caseId ? 'opacity-100 animate-pulse' : ''}
                  `}
                >
                  {deletingId === c.caseId
                    ? <span className="text-xs">…</span>
                    : <Trash2 className="w-3.5 h-3.5" />}
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
