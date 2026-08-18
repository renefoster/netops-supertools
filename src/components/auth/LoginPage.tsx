import React, { useState } from 'react';
import {
  Shield,
  Lock,
  User,
  Eye,
  EyeOff,
  ArrowRight,
  Activity,
  Server,
  Terminal,
  CheckCircle2,
  AlertTriangle,
  Building2,
} from 'lucide-react';

interface LoginPageProps {
  companyName?: string;
  onLoginSuccess: (user: { username: string; full_name: string; role: string }, token: string, companyName: string) => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({ companyName, onLoginSuccess }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password) {
      setError('Please enter both username and password.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username.trim(), password }),
      }).then((r) => r.json());

      if (res.success && res.data) {
        // Save auth token in localStorage
        try {
          localStorage.setItem('_netops_auth_token', res.data.token);
          localStorage.setItem('_netops_user', JSON.stringify(res.data.user));
          localStorage.setItem('_netops_company', res.data.company_name || ' Operations');
        } catch {
          // Ignore storage restrictions
        }
        onLoginSuccess(res.data.user, res.data.token, res.data.company_name);
      } else {
        setError(res.error || 'Invalid credentials. Please verify username and password.');
      }
    } catch (err: any) {
      setError(err.message || 'Network error connecting to authentication server.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#080c14] text-[#c3cad8] flex flex-col justify-center items-center p-4 sm:p-6 font-sans relative overflow-hidden">
      {/* Background Decorative Grid */}
      <div className="absolute inset-0 bg-[radial-gradient(#1e293b_1px,transparent_1px)] [background-size:24px_24px] opacity-20 pointer-events-none" />

      <div className="max-w-md w-full relative z-10 space-y-6">
        {/* Brand Header */}
        <div className="text-center space-y-2">
          <div className="w-14 h-14 rounded-2xl bg-[#111726] border border-[#1e2d45] flex items-center justify-center mx-auto text-emerald-400 shadow-xl">
            <Activity className="w-7 h-7" />
          </div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#151d2e] border border-[#1e2d45] text-[11px] font-mono text-emerald-400">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span> NETOPS • OPERATIONAL NOC</span>
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">
            {companyName || ' Network Operations'}
          </h1>
          <p className="text-xs text-[#8892a4]">
            Sign in with your Super Admin / IT Operations credentials
          </p>
        </div>

        {/* Login Card */}
        <div className="bg-[#111726] border border-[#1e2d45] rounded-2xl p-6 sm:p-7 shadow-2xl space-y-5">
          <form onSubmit={handleLogin} className="space-y-4">
            {/* Error Message */}
            {error && (
              <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-xs text-red-400 flex items-start gap-2.5 font-mono">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            {/* Username */}
            <div>
              <label className="block text-xs font-mono text-[#8892a4] mb-1.5 flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-emerald-400" />
                <span>Username or Admin ID</span>
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Enter your username"
                className="w-full px-3.5 py-2.5 bg-[#0a0e17] border border-[#1e2d45] rounded-xl text-xs text-white font-mono focus:outline-none focus:border-emerald-500 transition"
              />
            </div>

            {/* Password */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-mono text-[#8892a4] flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Password</span>
                </label>
              </div>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  className="w-full px-3.5 py-2.5 bg-[#0a0e17] border border-[#1e2d45] rounded-xl text-xs text-white font-mono focus:outline-none focus:border-emerald-500 transition pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#8892a4] hover:text-white"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl text-xs font-bold uppercase tracking-wider shadow-lg transition flex items-center justify-center gap-2 disabled:opacity-50 mt-2"
            >
              <span>{loading ? 'Authenticating...' : 'Sign In to Operations Console'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          {/* Security Footnote */}
          <div className="pt-3 border-t border-[#1e2d45] flex items-center justify-between text-[11px] font-mono text-[#64748b]">
            <span className="flex items-center gap-1">
              <Shield className="w-3 h-3 text-emerald-400" />
              <span>TLS / AES-256 Auth</span>
            </span>
            <span>Version 2.4.0-NOC</span>
          </div>
        </div>
      </div>
    </div>
  );
};
