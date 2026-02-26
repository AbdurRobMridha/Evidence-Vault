import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldX, ArrowLeft, Home } from 'lucide-react';

export default function UnauthorizedPage() {
    const navigate = useNavigate();

    return (
        <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4">
            <div className="max-w-md w-full text-center">
                <div className="w-20 h-20 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center mx-auto mb-6">
                    <ShieldX className="w-10 h-10 text-red-400" />
                </div>
                <h1 className="text-2xl font-bold text-zinc-100 mb-3">Access Denied</h1>
                <p className="text-zinc-400 mb-8 leading-relaxed">
                    You do not have permission to view this resource.
                    Contact your system administrator if you believe this is an error.
                </p>
                <div className="flex items-center justify-center gap-4">
                    <button
                        onClick={() => navigate(-1)}
                        className="flex items-center gap-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-medium px-5 py-2.5 rounded-lg transition-colors"
                    >
                        <ArrowLeft className="w-4 h-4" />
                        Go Back
                    </button>
                    <button
                        onClick={() => navigate('/')}
                        className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-zinc-950 font-semibold px-5 py-2.5 rounded-lg transition-colors"
                    >
                        <Home className="w-4 h-4" />
                        Home
                    </button>
                </div>
            </div>
        </div>
    );
}
