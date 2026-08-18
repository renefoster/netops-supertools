import React, { useState } from 'react';
import {
  X,
  User,
  Shield,
  KeyRound,
  Building2,
  Mail,
  Phone,
  CheckCircle2,
  AlertTriangle,
  Eye,
  EyeOff,
  Lock,
  Save,
  Check,
} from 'lucide-react';

interface UserProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: { username: string; full_name: string; role: string } | null;
  companyName: string;
  onProfileUpdated: (updatedUser: { username: string; full_name: string; role: string }, newCompanyName: string) => void;
}

export const UserProfileModal: React.FC<UserProfileModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  companyName,
  onProfileUpdated,
}) => {
  const [activeTab, setActiveTab] = useState<'profile' | 'security'>('profile');

  // Profile fields
  const [fullName, setFullName] = useState(currentUser?.full_name || '');
  const [role, setRole] = useState(currentUser?.role || '');
  const [compName, setCompName] = useState(companyName || '');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileMsg, setProfileMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Password fields
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showOldPw, setShowOldPw] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [passwordMsg, setPasswordMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  if (!isOpen) return null;

  // Real-time password validation checks
  const pwChecks = {
    length: newPassword.length >= 12,
    upper: /[A-Z]/.test(newPassword),
    lower: /[a-z]/.test(newPassword),
    number: /[0-9]/.test(newPassword),
    special: /[^A-Za-z0-9]/.test(newPassword),
    match: newPassword.length > 0 && newPassword === confirmPassword,
  };

  const isPasswordValid =
    pwChecks.length &&
    pwChecks.upper &&
    pwChecks.lower &&
    pwChecks.number &&
    pwChecks.special &&
    pwChecks.match &&
    oldPassword.length > 0;

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingProfile(true);
    setProfileMsg(null);

    try {
      const token = localStorage.getItem('_netops_auth_token') || '';
      const res = await fetch('/api/auth/profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          full_name: fullName,
          role,
          company_name: compName,
          contact_email: email,
          phone,
        }),
      }).then((r) => r.json());

      if (res.success && res.data) {
        setProfileMsg({ type: 'success', text: 'Profile details saved successfully.' });
        onProfileUpdated(res.data.user, res.data.company_name);
        try {
          localStorage.setItem('_netops_user', JSON.stringify(res.data.user));
        } catch {
          // Ignore
        }
      } else {
        setProfileMsg({ type: 'error', text: res.error || 'Failed to update profile.' });
      }
    } catch (err: any) {
      setProfileMsg({ type: 'error', text: err.message || 'Network error occurred.' });
    } finally {
      setSavingProfile(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isPasswordValid) return;

    setSavingPassword(true);
    setPasswordMsg(null);

    try {
      const token = localStorage.getItem('_netops_auth_token') || '';
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          old_password: oldPassword,
          new_password: newPassword,
        }),
      }).then((r) => r.json());

      if (res.success) {
        setPasswordMsg({ type: 'success', text: 'Password successfully changed!' });
        setOldPassword('');
        setNewPassword('');
        setConfirmPassword('');
      } else {
        setPasswordMsg({ type: 'error', text: res.error || 'Failed to change password.' });
      }
    } catch (err: any) {
      setPasswordMsg({ type: 'error', text: err.message || 'Network error occurred.' });
    } finally {
      setSavingPassword(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
      <div className="bg-[#0f1522] border border-[#1e2d45] rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-5 py-4 border-b border-[#1e2d45] flex items-center justify-between bg-[#151d2e]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <User className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white">Account Settings & Security</h3>
              <p className="text-[11px] text-[#8892a4]">Manage operator credentials and profile</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-[#8892a4] hover:text-white hover:bg-[#1a2438] rounded-lg transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Selector */}
        <div className="flex border-b border-[#1e2d45] bg-[#0c101a] px-5 pt-2">
          <button
            onClick={() => setActiveTab('profile')}
            className={`pb-2.5 px-3 text-xs font-medium border-b-2 transition flex items-center gap-1.5 ${
              activeTab === 'profile'
                ? 'border-emerald-400 text-emerald-400 font-semibold'
                : 'border-transparent text-[#8892a4] hover:text-white'
            }`}
          >
            <User className="w-3.5 h-3.5" />
            Profile Details
          </button>
          <button
            onClick={() => setActiveTab('security')}
            className={`pb-2.5 px-3 text-xs font-medium border-b-2 transition flex items-center gap-1.5 ${
              activeTab === 'security'
                ? 'border-emerald-400 text-emerald-400 font-semibold'
                : 'border-transparent text-[#8892a4] hover:text-white'
            }`}
          >
            <KeyRound className="w-3.5 h-3.5" />
            Change Password
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 overflow-y-auto space-y-4">
          {activeTab === 'profile' && (
            <form onSubmit={handleSaveProfile} className="space-y-4">
              {profileMsg && (
                <div
                  className={`p-3 rounded-lg text-xs flex items-center gap-2 border ${
                    profileMsg.type === 'success'
                      ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                      : 'bg-red-500/10 border-red-500/30 text-red-400'
                  }`}
                >
                  {profileMsg.type === 'success' ? (
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                  ) : (
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                  )}
                  <span>{profileMsg.text}</span>
                </div>
              )}

              <div className="grid grid-cols-1 gap-3.5">
                <div>
                  <label className="block text-[11px] font-medium text-[#8892a4] mb-1">
                    Username (Permanent)
                  </label>
                  <input
                    type="text"
                    disabled
                    value={currentUser?.username || 'admin'}
                    className="w-full bg-[#080c14] border border-[#1e2d45] rounded-lg px-3 py-2 text-xs text-[#8892a4] cursor-not-allowed font-mono"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-white mb-1">
                    Full Name / Officer Name
                  </label>
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="e.g. Chief Network Engineer"
                    className="w-full bg-[#080c14] border border-[#1e2d45] focus:border-emerald-500/50 rounded-lg px-3 py-2 text-xs text-white placeholder-[#8892a4]/40 outline-none transition"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-white mb-1">
                    Role / Position Title
                  </label>
                  <input
                    type="text"
                    required
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                    placeholder="e.g. Lead Network Operations Officer"
                    className="w-full bg-[#080c14] border border-[#1e2d45] focus:border-emerald-500/50 rounded-lg px-3 py-2 text-xs text-white placeholder-[#8892a4]/40 outline-none transition"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-white mb-1">
                    Company /  Resort Name
                  </label>
                  <input
                    type="text"
                    value={compName}
                    onChange={(e) => setCompName(e.target.value)}
                    placeholder="e.g.  Operations"
                    className="w-full bg-[#080c14] border border-[#1e2d45] focus:border-emerald-500/50 rounded-lg px-3 py-2 text-xs text-white placeholder-[#8892a4]/40 outline-none transition"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-medium text-white mb-1">
                      Contact Email
                    </label>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="noc@resort.com"
                      className="w-full bg-[#080c14] border border-[#1e2d45] focus:border-emerald-500/50 rounded-lg px-3 py-2 text-xs text-white placeholder-[#8892a4]/40 outline-none transition"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-white mb-1">
                      Phone Number
                    </label>
                    <input
                      type="text"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="+62 361 000000"
                      className="w-full bg-[#080c14] border border-[#1e2d45] focus:border-emerald-500/50 rounded-lg px-3 py-2 text-xs text-white placeholder-[#8892a4]/40 outline-none transition"
                    />
                  </div>
                </div>
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  type="submit"
                  disabled={savingProfile}
                  className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold shadow-lg transition disabled:opacity-50"
                >
                  <Save className="w-3.5 h-3.5" />
                  {savingProfile ? 'Saving Changes...' : 'Save Profile Details'}
                </button>
              </div>
            </form>
          )}

          {activeTab === 'security' && (
            <form onSubmit={handleChangePassword} className="space-y-4">
              {passwordMsg && (
                <div
                  className={`p-3 rounded-lg text-xs flex items-center gap-2 border ${
                    passwordMsg.type === 'success'
                      ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                      : 'bg-red-500/10 border-red-500/30 text-red-400'
                  }`}
                >
                  {passwordMsg.type === 'success' ? (
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                  ) : (
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                  )}
                  <span>{passwordMsg.text}</span>
                </div>
              )}

              <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg text-xs text-blue-300 flex items-start gap-2">
                <Shield className="w-4 h-4 shrink-0 text-blue-400 mt-0.5" />
                <span>
                  Confirm your current password before setting a new one. New passwords must be at least 12 characters with uppercase, lowercase, numbers, and special characters.
                </span>
              </div>

              {/* Old Password */}
              <div>
                <label className="block text-[11px] font-medium text-white mb-1">
                  Current Password <span className="text-red-400">*</span>
                </label>
                <div className="relative">
                  <input
                    type={showOldPw ? 'text' : 'password'}
                    required
                    value={oldPassword}
                    onChange={(e) => setOldPassword(e.target.value)}
                    placeholder="Enter current password"
                    className="w-full bg-[#080c14] border border-[#1e2d45] focus:border-emerald-500/50 rounded-lg px-3 py-2 pr-9 text-xs text-white placeholder-[#8892a4]/40 outline-none transition font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => setShowOldPw(!showOldPw)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#8892a4] hover:text-white"
                  >
                    {showOldPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* New Password */}
              <div>
                <label className="block text-[11px] font-medium text-white mb-1">
                  New Password <span className="text-red-400">*</span> (min. 12 characters)
                </label>
                <div className="relative">
                  <input
                    type={showNewPw ? 'text' : 'password'}
                    required
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Enter strong new password"
                    className="w-full bg-[#080c14] border border-[#1e2d45] focus:border-emerald-500/50 rounded-lg px-3 py-2 pr-9 text-xs text-white placeholder-[#8892a4]/40 outline-none transition font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPw(!showNewPw)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#8892a4] hover:text-white"
                  >
                    {showNewPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Confirm New Password */}
              <div>
                <label className="block text-[11px] font-medium text-white mb-1">
                  Confirm New Password <span className="text-red-400">*</span>
                </label>
                <input
                  type="password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-type new password"
                  className="w-full bg-[#080c14] border border-[#1e2d45] focus:border-emerald-500/50 rounded-lg px-3 py-2 text-xs text-white placeholder-[#8892a4]/40 outline-none transition font-mono"
                />
              </div>

              {/* Checklist */}
              <div className="p-3 bg-[#080c14] border border-[#1e2d45] rounded-lg space-y-1 text-[11px]">
                <div className="text-[#8892a4] font-medium mb-1">Password Requirements:</div>
                <div className={`flex items-center gap-1.5 ${pwChecks.length ? 'text-emerald-400' : 'text-[#8892a4]'}`}>
                  <Check className="w-3 h-3" /> Minimum 12 characters length
                </div>
                <div className={`flex items-center gap-1.5 ${pwChecks.upper ? 'text-emerald-400' : 'text-[#8892a4]'}`}>
                  <Check className="w-3 h-3" /> Contains uppercase letter (A-Z)
                </div>
                <div className={`flex items-center gap-1.5 ${pwChecks.lower ? 'text-emerald-400' : 'text-[#8892a4]'}`}>
                  <Check className="w-3 h-3" /> Contains lowercase letter (a-z)
                </div>
                <div className={`flex items-center gap-1.5 ${pwChecks.number ? 'text-emerald-400' : 'text-[#8892a4]'}`}>
                  <Check className="w-3 h-3" /> Contains numeric digit (0-9)
                </div>
                <div className={`flex items-center gap-1.5 ${pwChecks.special ? 'text-emerald-400' : 'text-[#8892a4]'}`}>
                  <Check className="w-3 h-3" /> Contains special character (!@#$%^&*...)
                </div>
                <div className={`flex items-center gap-1.5 ${pwChecks.match ? 'text-emerald-400' : 'text-[#8892a4]'}`}>
                  <Check className="w-3 h-3" /> Passwords match
                </div>
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  type="submit"
                  disabled={!isPasswordValid || savingPassword}
                  className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold shadow-lg transition disabled:opacity-50"
                >
                  <Lock className="w-3.5 h-3.5" />
                  {savingPassword ? 'Updating Password...' : 'Update Password'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
