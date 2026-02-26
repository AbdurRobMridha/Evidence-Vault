import React from 'react';
import { Shield, Search, Eye } from 'lucide-react';
import type { Role } from '../../lib/rbac';
import { ROLE_LABELS, ROLE_COLORS } from '../../lib/rbac';

export function RoleBadge({ role, size = 'sm' }: { role: Role; size?: 'sm' | 'md' }) {
    const colors = ROLE_COLORS[role];
    const icons: Record<Role, React.ReactNode> = {
        admin: <Shield className={size === 'sm' ? 'w-3 h-3' : 'w-3.5 h-3.5'} />,
        investigator: <Search className={size === 'sm' ? 'w-3 h-3' : 'w-3.5 h-3.5'} />,
        viewer: <Eye className={size === 'sm' ? 'w-3 h-3' : 'w-3.5 h-3.5'} />,
    };

    return (
        <span className={`inline-flex items-center gap-1.5 font-semibold border rounded-full ${colors.text} ${colors.bg} ${colors.border} ${size === 'sm' ? 'text-xs px-2.5 py-0.5' : 'text-sm px-3 py-1'
            }`}>
            {icons[role]}
            {ROLE_LABELS[role]}
        </span>
    );
}

export default RoleBadge;
