import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  ShieldAlert, FileText, Clock, Plus, Users, Lock, ShieldCheck,
  Trash2, CheckSquare, Search, X, Phone, Filter,
} from 'lucide-react';
import { format } from 'date-fns';
import {
  getCasesForUser, seedDemoCases, deleteManagedCase,
  type ManagedCase, type CasePriority, type CaseStatus,
} from '../lib/caseStore';
import { getCurrentAppUser, seedDemoUsers, type AppUser } from '../lib/rbac';
import { getAllCaseEvidence } from '../lib/evidenceStore';
import { RoleBadge } from '../components/admin/RoleBadge';
import { CaseStatusBadge, CasePriorityBadge } from '../components/admin/CaseStatusBadge';
import { appendAuditEntry } from '../lib/auditLog';

// Extract contact handles from evidence file names (CONTACT_PROFILE-<handle>-CASE-xxx.txt
// or evidence-N-of-M-<Platform>-<handle>-*.txt)
function extractHandlesFromFileNames(fileNames: string[]): string[] {
  const handles = new Set<string>();
  for (const name of fileNames) {
    // CONTACT_PROFILE-<handle>-CASE-...
    const profileMatch = name.match(/^CONTACT_PROFILE-(.+?)-CASE-/i);
    if (profileMatch) handles.add(decodeHandle(profileMatch[1]));

    // evidence-N-of-M-<Platform>-<handle>-<timestamp>.txt
    const evMatch = name.match(/^evidence-\d+-of-\d+-[^-]+-(.+?)-\d+\.txt$/i);
    if (evMatch) handles.add(decodeHandle(evMatch[1]));

    // chat-transcript-<Platform>-<handle>-<timestamp>.txt
    const chatMatch = name.match(/^chat-transcript-[^-]+-(.+?)-\d+\.txt$/i);
    if (chatMatch) handles.add(decodeHandle(chatMatch[1]));
  }
  return [...handles].filter(h => h.length > 1);
}

// Rehydrate underscores-as-spaces for display (file system safe → human readable)
function decodeHandle(raw: string): string {
  return raw.replace(/_/g, ' ').trim();
}

// Extract platform names from file names
function extractPlatformsFromFileNames(fileNames: string[]): string[] {
  const platforms: string[] = [];
  const PLATFORMS = ['WhatsApp', 'Messenger', 'SMS', 'Telegram', 'Instagram_DM', 'Twitter_DM'];
  for (const name of fileNames) {
    for (const p of PLATFORMS) {
      if (name.includes(p)) {
        platforms.push(p.replace('_', ' '));
        break;
      }
    }
  }
  return [...new Set(platforms)];
}

const PLATFORM_OPTIONS = ['All Platforms', 'WhatsApp', 'Messenger', 'SMS', 'Telegram', 'Instagram DM', 'Twitter DM'];
const STATUS_OPTIONS: Array<'All Statuses' | CaseStatus> = ['All Statuses', 'Draft', 'Open', 'Under Investigation', 'Evidence Verified', 'Report Generated', 'Closed', 'Archived'];
const PRIORITY_OPTIONS: Array<'All Priorities' | CasePriority> = ['All Priorities', 'Critical', 'High', 'Medium', 'Low'];

export default function Dashboard() {
  const [cases, setCases] = useState<ManagedCase[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<AppUser | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [selectedCaseIds, setSelectedCaseIds] = useState<Set<string>>(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);

  // ── Filter state ──────────────────────────────────────────────────────────
  const [searchQuery, setSearchQuery] = useState('');
  const [platformFilter, setPlatformFilter] = useState('All Platforms');
  const [statusFilter, setStatusFilter] = useState<'All Statuses' | CaseStatus>('All Statuses');
  const [priorityFilter, setPriorityFilter] = useState<'All Priorities' | CasePriority>('All Priorities');
  const [showFilters, setShowFilters] = useState(false);

  // Evidence index: caseId → { handles[], platforms[] }
  const [evidenceIndex, setEvidenceIndex] = useState<Record<string, { handles: string[]; platforms: string[] }>>({});

  const loadCases = () => {
    seedDemoUsers();
    seedDemoCases();
    const user = getCurrentAppUser();
    setCurrentUser(user);
    if (user) {
      const userCases = getCasesForUser(user.id, user.role, user.email);
      setCases(userCases);

      // Build evidence index from stored file names
      const allEvidence = getAllCaseEvidence();
      const index: Record<string, { handles: string[]; platforms: string[] }> = {};
      for (const [caseId, evList] of Object.entries(allEvidence)) {
        const names = evList.map(e => e.file_name);
        index[caseId] = {
          handles: extractHandlesFromFileNames(names),
          platforms: extractPlatformsFromFileNames(names),
        };
      }
      setEvidenceIndex(index);
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
    const onStorage = (e: StorageEvent) => { if (e.key?.startsWith('ev_') || e.key === null) loadCases(); };
    const onVisible = () => { if (document.visibilityState === 'visible') loadCases(); };
    window.addEventListener('storage', onStorage);
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('ev:case-created', loadCases);
    return () => {
      window.removeEventListener('storage', onStorage);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('ev:case-created', loadCases);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Filtered cases ────────────────────────────────────────────────────────
  const filteredCases = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return cases.filter(c => {
      // Text search: title, description, caseId, contact handle, platform
      if (q) {
        const idx = evidenceIndex[c.caseId];
        const inTitle = c.title.toLowerCase().includes(q);
        const inDesc = c.description.toLowerCase().includes(q);
        const inId = c.caseId.toLowerCase().includes(q);
        const inHandle = idx?.handles.some(h => h.toLowerCase().includes(q));
        const inPlatformEvidence = idx?.platforms.some(p => p.toLowerCase().includes(q));
        if (!inTitle && !inDesc && !inId && !inHandle && !inPlatformEvidence) return false;
      }

      // Platform filter
      if (platformFilter !== 'All Platforms') {
        const idx = evidenceIndex[c.caseId];
        const titleHasPlatform = c.title.toLowerCase().includes(platformFilter.toLowerCase());
        const evidenceHasPlatform = idx?.platforms.includes(platformFilter);
        if (!titleHasPlatform && !evidenceHasPlatform) return false;
      }

      // Status filter
      if (statusFilter !== 'All Statuses' && c.status !== statusFilter) return false;

      // Priority filter
      if (priorityFilter !== 'All Priorities' && c.priority !== priorityFilter) return false;

      return true;
    });
  }, [cases, searchQuery, platformFilter, statusFilter, priorityFilter, evidenceIndex]);

  const hasActiveFilters = searchQuery || platformFilter !== 'All Platforms' || statusFilter !== 'All Statuses' || priorityFilter !== 'All Priorities';

  const clearFilters = () => {
    setSearchQuery('');
    setPlatformFilter('All Platforms');
    setStatusFilter('All Statuses');
    setPriorityFilter('All Priorities');
  };

  // ── Single delete ─────────────────────────────────────────────────────────
  const handleRemoveCase = (e: React.MouseEvent, c: ManagedCase) => {
    e.preventDefault();
    e.stopPropagation();
    if (c.locked) { alert('This case is locked and cannot be deleted. Unlock it in Case Details first.'); return; }
    if (!window.confirm(`Permanently delete case "${c.title}"?\n\nThis cannot be undone.`)) return;
    setDeletingId(c.caseId);
    try {
      deleteManagedCase(c.caseId);
      appendAuditEntry(c.caseId, 'case_deleted', currentUser?.email || 'unknown', currentUser?.role || 'user', `Case "${c.title}" deleted`);
      setSelectedCaseIds(prev => { const next = new Set(prev); next.delete(c.caseId); return next; });
      loadCases();
    } catch { alert('Failed to delete case. Please try again.'); }
    finally { setDeletingId(null); }
  };

  // ── Bulk delete ───────────────────────────────────────────────────────────
  const handleBulkDelete = () => {
    const selected = cases.filter(c => selectedCaseIds.has(c.caseId));
    const locked = selected.filter(c => c.locked);
    if (locked.length > 0) {
      alert(`${locked.length} selected case(s) are locked:\n${locked.map(c => c.title).join('\n')}\n\nUnlock them first.`);
      return;
    }
    const deletable = selected.filter(c => canDelete(c));
    if (deletable.length === 0) { alert('No deletable cases selected.'); return; }
    if (!window.confirm(`Permanently delete ${deletable.length} case(s)?\n\n${deletable.map(c => `• ${c.title}`).join('\n')}\n\nThis cannot be undone.`)) return;
    setBulkDeleting(true);
    try {
      deletable.forEach(c => {
        deleteManagedCase(c.caseId);
        appendAuditEntry(c.caseId, 'case_deleted', currentUser?.email || 'unknown', currentUser?.role || 'user', `Bulk deleted: "${c.title}"`);
      });
      setSelectedCaseIds(new Set());
      loadCases();
    } catch { alert('Bulk delete partially failed. Please refresh.'); }
    finally { setBulkDeleting(false); }
  };

  const canDelete = (c: ManagedCase): boolean => {
    if (!currentUser) return false;
    if (currentUser.role === 'admin') return true;
    return (c.createdBy === currentUser.id || c.createdByEmail === currentUser.email) && !c.locked;
  };

  const deletableCases = filteredCases.filter(canDelete);
  const allDeleteableSelected = deletableCases.length > 0 && deletableCases.every(c => selectedCaseIds.has(c.caseId));

  return (
    <div className="p-8 max-w-6xl mx-auto">

      {/* ── Header ── */}
      <div className="flex justify-between items-end mb-6">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-3xl font-semibold text-zinc-100 tracking-tight">My Cases</h1>
            {currentUser && <RoleBadge role={currentUser.role} />}
          </div>
          <p className="text-zinc-400 text-sm">
            {currentUser?.role === 'admin' ? 'Viewing all cases across the system.' : 'Securely manage and preserve your assigned digital evidence.'}
          </p>
        </div>
        <Link to="/upload" className="bg-emerald-500 hover:bg-emerald-600 text-zinc-950 font-semibold px-4 py-2.5 rounded-lg transition-colors flex items-center gap-2">
          <Plus className="w-5 h-5" />
          New Case
        </Link>
      </div>

      {/* ── Search & Filter Bar ── */}
      <div className="space-y-3 mb-6">
        <div className="flex gap-2">
          {/* Search input */}
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 pointer-events-none" />
            <input
              type="text"
              placeholder="Search by case title, phone number, @username, platform, description…"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full bg-zinc-900 border border-zinc-800 focus:border-emerald-500 rounded-lg pl-10 pr-10 py-2.5 text-zinc-100 placeholder-zinc-600 text-sm outline-none transition-colors"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300">
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Toggle filters */}
          <button
            onClick={() => setShowFilters(v => !v)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg border text-sm font-medium transition-colors ${showFilters || platformFilter !== 'All Platforms' || statusFilter !== 'All Statuses' || priorityFilter !== 'All Priorities'
              ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-400'
              : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-zinc-200'
              }`}
          >
            <Filter className="w-4 h-4" />
            Filters
            {hasActiveFilters && <span className="w-2 h-2 rounded-full bg-emerald-400" />}
          </button>
        </div>

        {/* Expanded filters */}
        {showFilters && (
          <div className="flex flex-wrap gap-3 p-4 bg-zinc-900 border border-zinc-800 rounded-xl">
            {/* Platform */}
            <div className="flex flex-col gap-1">
              <label className="text-xs text-zinc-500 font-semibold uppercase flex items-center gap-1">
                <Phone className="w-3 h-3" /> Platform / Account
              </label>
              <select
                value={platformFilter}
                onChange={e => setPlatformFilter(e.target.value)}
                className="bg-zinc-950 border border-zinc-700 text-zinc-200 text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-emerald-500"
              >
                {PLATFORM_OPTIONS.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>

            {/* Status */}
            <div className="flex flex-col gap-1">
              <label className="text-xs text-zinc-500 font-semibold uppercase">Status</label>
              <select
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value as typeof statusFilter)}
                className="bg-zinc-950 border border-zinc-700 text-zinc-200 text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-emerald-500"
              >
                {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>

            {/* Priority */}
            <div className="flex flex-col gap-1">
              <label className="text-xs text-zinc-500 font-semibold uppercase">Priority</label>
              <select
                value={priorityFilter}
                onChange={e => setPriorityFilter(e.target.value as typeof priorityFilter)}
                className="bg-zinc-950 border border-zinc-700 text-zinc-200 text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-emerald-500"
              >
                {PRIORITY_OPTIONS.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>

            {hasActiveFilters && (
              <div className="flex items-end">
                <button
                  onClick={clearFilters}
                  className="flex items-center gap-1.5 px-3 py-2 text-sm text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg transition-colors"
                >
                  <X className="w-3.5 h-3.5" /> Clear all
                </button>
              </div>
            )}
          </div>
        )}

        {/* Results count + active handle chips */}
        {(hasActiveFilters || cases.length > 0) && (
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-zinc-500">
              {filteredCases.length} of {cases.length} case{cases.length !== 1 ? 's' : ''}
            </span>
            {searchQuery && (
              <span className="flex items-center gap-1 text-xs bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded-full">
                <Search className="w-3 h-3" />"{searchQuery}"
              </span>
            )}
            {platformFilter !== 'All Platforms' && (
              <span className="flex items-center gap-1 text-xs bg-blue-500/10 text-blue-400 border border-blue-500/20 px-2 py-0.5 rounded-full">
                <Phone className="w-3 h-3" />{platformFilter}
                <button onClick={() => setPlatformFilter('All Platforms')}><X className="w-3 h-3 hover:text-blue-200" /></button>
              </span>
            )}
          </div>
        )}
      </div>

      {/* ── Bulk action toolbar ── */}
      {selectedCaseIds.size > 0 && (
        <div className="flex items-center gap-3 mb-5 px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-xl">
          <CheckSquare className="w-4 h-4 text-emerald-400 flex-shrink-0" />
          <span className="text-sm font-semibold text-zinc-200">
            {selectedCaseIds.size} case{selectedCaseIds.size > 1 ? 's' : ''} selected
          </span>
          <div className="flex-1" />
          <button onClick={() => setSelectedCaseIds(new Set())} className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors px-2 py-1">
            Clear selection
          </button>
          <button
            onClick={handleBulkDelete}
            disabled={bulkDeleting}
            className="flex items-center gap-1.5 px-4 py-2 bg-red-600 hover:bg-red-500 disabled:opacity-60 text-white text-sm font-bold rounded-lg transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
            {bulkDeleting ? 'Deleting…' : `Delete ${selectedCaseIds.size}`}
          </button>
        </div>
      )}

      {/* ── Content ── */}
      {loading ? (
        <div className="text-zinc-500 animate-pulse">Loading cases...</div>
      ) : cases.length === 0 ? (
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-12 text-center">
          <div className="w-16 h-16 mx-auto rounded-full bg-zinc-800 flex items-center justify-center mb-4">
            <FileText className="w-8 h-8 text-zinc-500" />
          </div>
          <h3 className="text-xl font-medium text-zinc-200 mb-2">No cases found</h3>
          <p className="text-zinc-500 mb-6">
            {currentUser?.role === 'investigator' ? 'No cases have been assigned to you yet.' : 'Start by creating a new case and uploading evidence.'}
          </p>
          <Link to="/upload" className="inline-flex items-center gap-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-medium px-4 py-2 rounded-lg transition-colors">
            Create Case
          </Link>
        </div>
      ) : filteredCases.length === 0 ? (
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-12 text-center">
          <Search className="w-12 h-12 text-zinc-700 mx-auto mb-4" />
          <h3 className="text-xl font-medium text-zinc-200 mb-2">No matching cases</h3>
          <p className="text-zinc-500 mb-4">No cases match your search or filter criteria.</p>
          <button onClick={clearFilters} className="text-sm text-emerald-400 hover:text-emerald-300 transition-colors underline underline-offset-2">
            Clear all filters
          </button>
        </div>
      ) : (
        <>
          {/* Select All row */}
          {deletableCases.length > 0 && (
            <div className="flex items-center gap-2 mb-3 px-1">
              <input
                type="checkbox"
                id="select-all-cases"
                className="w-4 h-4 rounded accent-emerald-500 cursor-pointer"
                checked={allDeleteableSelected}
                onChange={e => {
                  if (e.target.checked) setSelectedCaseIds(new Set(deletableCases.map(c => c.caseId)));
                  else setSelectedCaseIds(new Set());
                }}
              />
              <label htmlFor="select-all-cases" className="text-xs text-zinc-500 cursor-pointer select-none">
                Select all {deletableCases.length} deletable case{deletableCases.length > 1 ? 's' : ''}
              </label>
            </div>
          )}

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filteredCases.map(c => {
              const idx = evidenceIndex[c.caseId];
              return (
                <div key={c.caseId} className={`relative group ${selectedCaseIds.has(c.caseId) ? 'ring-2 ring-emerald-500/40 rounded-2xl' : ''}`}>

                  {/* Checkbox */}
                  {canDelete(c) && (
                    <div
                      className={`absolute top-3 left-3 z-10 transition-opacity ${selectedCaseIds.has(c.caseId) ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}
                      onClick={e => e.preventDefault()}
                    >
                      <input
                        type="checkbox"
                        className="w-4 h-4 rounded accent-emerald-500 cursor-pointer"
                        checked={selectedCaseIds.has(c.caseId)}
                        onChange={e => {
                          e.stopPropagation();
                          setSelectedCaseIds(prev => {
                            const next = new Set(prev);
                            if (e.target.checked) next.add(c.caseId); else next.delete(c.caseId);
                            return next;
                          });
                        }}
                      />
                    </div>
                  )}

                  <Link to={`/cases/${c.caseId}`} className="block bg-zinc-900 border border-zinc-800 hover:border-emerald-500/50 rounded-2xl p-6 transition-all h-full">
                    <div className="flex justify-between items-start mb-3">
                      <CaseStatusBadge status={c.status} />
                      <CasePriorityBadge priority={c.priority} />
                    </div>

                    <h3 className="text-lg font-medium text-zinc-100 mb-1.5 line-clamp-1 group-hover:text-emerald-400 transition-colors pl-6 pr-6">
                      {c.title}
                    </h3>
                    <p className="text-sm text-zinc-500 mb-3 line-clamp-2">{c.description}</p>

                    {/* Contact handle chips from evidence */}
                    {idx?.handles && idx.handles.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mb-3">
                        {idx.handles.slice(0, 3).map(h => (
                          <span
                            key={h}
                            className="flex items-center gap-1 text-xs bg-zinc-800 text-zinc-400 border border-zinc-700 px-2 py-0.5 rounded-full font-mono"
                          >
                            <Phone className="w-2.5 h-2.5 flex-shrink-0" />
                            {h}
                          </span>
                        ))}
                        {idx.handles.length > 3 && (
                          <span className="text-xs text-zinc-600">+{idx.handles.length - 3} more</span>
                        )}
                      </div>
                    )}

                    <div className="flex items-center justify-between text-xs font-mono text-zinc-500 border-t border-zinc-800 pt-3">
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

                  {/* Single delete button */}
                  {canDelete(c) && (
                    <button
                      onClick={(e) => handleRemoveCase(e, c)}
                      disabled={deletingId === c.caseId || c.locked}
                      title={c.locked ? 'Case is locked' : 'Remove case'}
                      className={`
                        absolute top-3 right-3 w-7 h-7 rounded-lg flex items-center justify-center
                        opacity-0 group-hover:opacity-100 transition-all duration-150
                        ${c.locked
                          ? 'bg-zinc-800 text-zinc-600 cursor-not-allowed'
                          : 'bg-zinc-800 hover:bg-red-500/20 text-zinc-500 hover:text-red-400 border border-zinc-700 hover:border-red-500/40'}
                        ${deletingId === c.caseId ? 'opacity-100 animate-pulse' : ''}
                      `}
                    >
                      {deletingId === c.caseId ? <span className="text-xs">…</span> : <Trash2 className="w-3.5 h-3.5" />}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
