import React from 'react';
import { UserMinus, FolderOpen, ChevronDown } from 'lucide-react';
import type { AppUser, Role } from '../../lib/rbac';
import { updateUserRole, removeUser, ROLE_LABELS } from '../../lib/rbac';
import { RoleBadge } from './RoleBadge';
import { format } from 'date-fns';

interface Props {
    users: AppUser[];
    onRefresh: () => void;
}

export default function InvestigatorManagement({ users, onRefresh }: Props) {
    const investigators = users.filter(u => u.role !== 'admin');

    const handleRoleChange = (userId: string, newRole: Role) => {
        updateUserRole(userId, newRole);
        onRefresh();
    };

    const handleRemove = (user: AppUser) => {
        if (!window.confirm(`Remove ${user.name || user.email} from the system? This will revoke all case access.`)) return;
        removeUser(user.id);
        onRefresh();
    };

    if (investigators.length === 0) {
        return (
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-8 text-center">
                <p className="text-zinc-500">No investigators registered yet.</p>
                <p className="text-xs text-zinc-600 mt-1">Use "Invite Investigator" to add team members.</p>
            </div>
        );
    }

    return (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
                <thead>
                    <tr className="border-b border-zinc-800 text-zinc-500 text-xs uppercase tracking-wider">
                        <th className="text-left px-4 py-3 font-medium">Name</th>
                        <th className="text-left px-4 py-3 font-medium">Email</th>
                        <th className="text-left px-4 py-3 font-medium">Role</th>
                        <th className="text-left px-4 py-3 font-medium">Cases</th>
                        <th className="text-left px-4 py-3 font-medium">Joined</th>
                        <th className="text-right px-4 py-3 font-medium">Actions</th>
                    </tr>
                </thead>
                <tbody>
                    {investigators.map(user => (
                        <tr key={user.id} className="border-b border-zinc-800/50 hover:bg-zinc-800/30 transition-colors">
                            <td className="px-4 py-3 text-zinc-200 font-medium">{user.name || '—'}</td>
                            <td className="px-4 py-3 text-zinc-400 text-xs font-mono">{user.email}</td>
                            <td className="px-4 py-3">
                                <div className="relative inline-block">
                                    <select
                                        value={user.role}
                                        onChange={e => handleRoleChange(user.id, e.target.value as Role)}
                                        className="bg-transparent text-xs font-semibold pr-5 py-0.5 appearance-none focus:outline-none cursor-pointer text-zinc-300"
                                    >
                                        <option value="investigator">Investigator</option>
                                        <option value="viewer">Viewer</option>
                                    </select>
                                    <ChevronDown className="w-3 h-3 text-zinc-600 absolute right-0 top-1/2 -translate-y-1/2 pointer-events-none" />
                                </div>
                            </td>
                            <td className="px-4 py-3">
                                <div className="flex items-center gap-1.5 text-xs text-zinc-500">
                                    <FolderOpen className="w-3 h-3" />
                                    {user.assignedCases.length} assigned
                                </div>
                            </td>
                            <td className="px-4 py-3 text-xs text-zinc-500 font-mono">
                                {format(new Date(user.createdAt), 'MMM d, yyyy')}
                            </td>
                            <td className="px-4 py-3 text-right">
                                <button
                                    onClick={() => handleRemove(user)}
                                    className="text-red-400/60 hover:text-red-400 transition-colors p-1.5 rounded-lg hover:bg-red-500/10"
                                    title="Remove investigator"
                                >
                                    <UserMinus className="w-4 h-4" />
                                </button>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
