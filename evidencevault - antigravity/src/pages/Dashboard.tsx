import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ShieldAlert, FileText, Clock, Plus, Users, Lock, ShieldCheck } from 'lucide-react';
import { format } from 'date-fns';
import {
  getCasesForUser, seedDemoCases,
  type ManagedCase,
} from '../lib/caseStore';
import { getCurrentAppUser, seedDemoUsers, type AppUser } from '../lib/rbac';
import { RoleBadge } from '../components/admin/RoleBadge';
import { CaseStatusBadge, CasePriorityBadge } from '../components/admin/CaseStatusBadge';

export default function Dashboard() {
  const [cases, setCases] = useState<ManagedCase[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<AppUser | null>(null);

  useEffect(() => {
    // Seed demo data
    seedDemoUsers();
    seedDemoCases();

    const user = getCurrentAppUser();
    setCurrentUser(user);

    if (user) {
      // Load cases filtered by role
      const userCases = getCasesForUser(user.id, user.role);
      setCases(userCases);
    } else {
      // Fallback: try API (for backward compatibility)
      fetch('/api/cases')
        .then(res => res.json())
        .then(data => setCases(data))
        .catch(() => { });
    }

    setLoading(false);
  }, []);

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
            <Link
              key={c.caseId}
              to={`/cases/${c.caseId}`}
              className="group bg-zinc-900 border border-zinc-800 hover:border-emerald-500/50 rounded-2xl p-6 transition-all"
            >
              <div className="flex justify-between items-start mb-3">
                <CaseStatusBadge status={c.status} />
                <CasePriorityBadge priority={c.priority} />
              </div>

              <h3 className="text-lg font-medium text-zinc-100 mb-2 line-clamp-1 group-hover:text-emerald-400 transition-colors">
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
          ))}
        </div>
      )}
    </div>
  );
}
