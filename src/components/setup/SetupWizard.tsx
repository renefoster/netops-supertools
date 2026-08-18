import React, { useState, useEffect } from 'react';
import {
  Server,
  Database,
  Shield,
  Building2,
  User,
  Key,
  CheckCircle2,
  XCircle,
  Eye,
  EyeOff,
  Terminal,
  ArrowRight,
  ArrowLeft,
  Sparkles,
  RefreshCw,
  FolderSearch,
  Lock,
  Globe,
  MapPin,
  Mail,
  Phone,
  AlertTriangle,
  Layers,
  Cpu,
  Check,
  Activity,
  HardDrive,
} from 'lucide-react';

interface SetupWizardProps {
  onSetupCompleted: () => void;
}

export const SetupWizard: React.FC<SetupWizardProps> = ({ onSetupCompleted }) => {
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3>(1);

  // Step 1: Database & AI State
  const [dbType, setDbType] = useState<'sqlite' | 'mysql' | 'postgres'>('sqlite');
  const [dbHost, setDbHost] = useState('127.0.0.1');
  const [dbPort, setDbPort] = useState('3306');
  const [dbName, setDbName] = useState('_netops');
  const [dbUser, setDbUser] = useState('root');
  const [dbPassword, setDbPassword] = useState('');
  const [dbSsl, setDbSsl] = useState<'disable' | 'require' | 'prefer'>('disable');
  const [showDbPassword, setShowDbPassword] = useState(false);

  // SQLite Scanning State
  const [sqliteScannedInfo, setSqliteScannedInfo] = useState<{
    exists: boolean;
    path: string;
    size_bytes: number;
    tables_found: string[];
    is_new_install_recommended: boolean;
  } | null>(null);
  const [scanningSqlite, setScanningSqlite] = useState(false);
  const [dbTestResult, setDbTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [testingDb, setTestingDb] = useState(false);

  // Gemini AI Key (Optional)
  const [geminiApiKey, setGeminiApiKey] = useState('');
  const [showGeminiKey, setShowGeminiKey] = useState(false);

  // Step 2: Company & Login Information State (Blank for manual user input)
  const [companyName, setCompanyName] = useState('');
  const [companyAddress, setCompanyAddress] = useState('');
  const [companyCountry, setCompanyCountry] = useState('');
  const [companyProvince, setCompanyProvince] = useState('');
  const [companyCity, setCompanyCity] = useState('');
  const [companyStateCode, setCompanyStateCode] = useState('');
  const [companyEmail, setCompanyEmail] = useState('');
  const [companyPhone, setCompanyPhone] = useState('');

  // Super Admin Account State (Blank for manual user input)
  const [adminFullName, setAdminFullName] = useState('');
  const [adminRole, setAdminRole] = useState('');
  const [adminUsername, setAdminUsername] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showAdminPassword, setShowAdminPassword] = useState(false);

  // Step 3: Installation & Logs State
  const [installing, setInstalling] = useState(false);
  const [installerLogs, setInstallerLogs] = useState<
    Array<{ timestamp: string; level: 'INFO' | 'SUCCESS' | 'WARN' | 'ERROR'; message: string }>
  >([]);
  const [installError, setInstallError] = useState<string | null>(null);
  const [installSuccess, setInstallSuccess] = useState(false);

  // Scan local directory on mount
  useEffect(() => {
    scanSqliteDirectory();
  }, []);

  const scanSqliteDirectory = async () => {
    setScanningSqlite(true);
    try {
      const res = await fetch('/api/setup/status').then((r) => r.json());
      if (res.success && res.data?.sqlite_info) {
        setSqliteScannedInfo(res.data.sqlite_info);
      }
    } catch {
      // Ignore
    } finally {
      setScanningSqlite(false);
    }
  };

  const handleTestDatabaseConnection = async () => {
    setTestingDb(true);
    setDbTestResult(null);
    try {
      const res = await fetch('/api/setup/test-db', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: dbType,
          host: dbHost,
          port: dbPort ? Number(dbPort) : undefined,
          database: dbName,
          username: dbUser,
          password: dbPassword,
          ssl: dbSsl,
        }),
      }).then((r) => r.json());

      if (res.success) {
        setDbTestResult({
          success: true,
          message: res.data.message || 'Connection test successful!',
        });
      } else {
        setDbTestResult({
          success: false,
          message: res.error || 'Connection failed. Please verify database parameters.',
        });
      }
    } catch (err: any) {
      setDbTestResult({
        success: false,
        message: err.message || 'Network error connecting to database verification endpoint.',
      });
    } finally {
      setTestingDb(false);
    }
  };

  // Live password validation
  const pwHasLength = adminPassword.length >= 12;
  const pwHasUpper = /[A-Z]/.test(adminPassword);
  const pwHasLower = /[a-z]/.test(adminPassword);
  const pwHasNum = /[0-9]/.test(adminPassword);
  const pwHasSpecial = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(adminPassword);
  const pwMatchesConfirm = adminPassword === confirmPassword && confirmPassword.length > 0;
  const isPasswordValid = pwHasLength && pwHasUpper && pwHasLower && pwHasNum && pwHasSpecial && pwMatchesConfirm;

  // Step 1 validation
  const isStep1Valid =
    dbType === 'sqlite'
      ? true
      : dbHost.trim().length > 0 && dbName.trim().length > 0 && dbUser.trim().length > 0;

  // Step 2 validation
  const isStep2Valid =
    companyName.trim().length > 0 &&
    companyCity.trim().length > 0 &&
    companyCountry.trim().length > 0 &&
    adminFullName.trim().length > 0 &&
    adminUsername.trim().length > 0 &&
    isPasswordValid;

  // Run final installation
  const handleRunInstallation = async () => {
    setInstalling(true);
    setInstallError(null);
    setInstallerLogs([
      {
        timestamp: new Date().toISOString().substring(11, 19),
        level: 'INFO',
        message: 'Initializing installation pipeline...',
      },
    ]);

    try {
      const payload = {
        db_config: {
          type: dbType,
          host: dbType === 'sqlite' ? undefined : dbHost,
          port: dbType === 'sqlite' ? undefined : Number(dbPort),
          database: dbType === 'sqlite' ? undefined : dbName,
          username: dbType === 'sqlite' ? undefined : dbUser,
          password: dbType === 'sqlite' ? undefined : dbPassword,
          ssl: dbType === 'sqlite' ? undefined : dbSsl,
        },
        gemini_api_key: geminiApiKey.trim() || undefined,
        company_info: {
          name: companyName,
          address: companyAddress,
          country: companyCountry,
          province: companyProvince,
          city: companyCity,
          state_code: companyStateCode,
          contact_email: companyEmail,
          phone: companyPhone,
        },
        admin_user: {
          full_name: adminFullName,
          role: adminRole,
          username: adminUsername,
          password: adminPassword,
        },
      };

      const res = await fetch('/api/setup/install', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }).then((r) => r.json());

      if (res.data?.logs) {
        setInstallerLogs(res.data.logs);
      }

      if (res.success) {
        setInstallSuccess(true);
      } else {
        setInstallError(res.error || 'Installation encountered an issue.');
      }
    } catch (err: any) {
      setInstallError(err.message || 'Fatal error communicating with setup engine.');
    } finally {
      setInstalling(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0e17] text-[#c3cad8] flex flex-col justify-center items-center p-4 sm:p-6 font-sans">
      {/* Top Branding */}
      <div className="max-w-4xl w-full mb-6 text-center space-y-2">
        <div className="inline-flex items-center gap-2.5 px-4 py-1.5 rounded-full bg-[#151d2e] border border-[#1e2d45] text-xs font-mono text-emerald-400">
          <Activity className="w-3.5 h-3.5 animate-pulse" />
          <span> NETOPS SUPER TOOLS • FIRST-TIME INITIALIZATION WIZARD</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
          Network Operations Center Setup
        </h1>
        <p className="text-xs sm:text-sm text-[#8892a4] max-w-xl mx-auto">
          Configure your storage engine, property credentials, and administrative security parameters to deploy your self-hosted NetOps environment.
        </p>
      </div>

      {/* Main Setup Card */}
      <div className="max-w-4xl w-full bg-[#111726] border border-[#1e2d45] rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        {/* Step Progress Header */}
        <div className="grid grid-cols-3 border-b border-[#1e2d45] bg-[#0d1320] text-xs font-medium">
          <div
            className={`p-4 flex items-center gap-3 border-r border-[#1e2d45] ${
              currentStep === 1
                ? 'bg-[#151d2e] text-emerald-400 font-bold'
                : currentStep > 1
                ? 'text-white'
                : 'text-[#64748b]'
            }`}
          >
            <div
              className={`w-7 h-7 rounded-full flex items-center justify-center font-mono text-xs ${
                currentStep === 1
                  ? 'bg-emerald-500 text-black font-bold'
                  : currentStep > 1
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                  : 'bg-[#1e2d45] text-[#8892a4]'
              }`}
            >
              {currentStep > 1 ? <Check className="w-4 h-4" /> : '1'}
            </div>
            <div className="hidden sm:block">
              <div className="text-[10px] uppercase font-mono text-[#8892a4]">Step 1</div>
              <div className="truncate">System & Database</div>
            </div>
          </div>

          <div
            className={`p-4 flex items-center gap-3 border-r border-[#1e2d45] ${
              currentStep === 2
                ? 'bg-[#151d2e] text-emerald-400 font-bold'
                : currentStep > 2
                ? 'text-white'
                : 'text-[#64748b]'
            }`}
          >
            <div
              className={`w-7 h-7 rounded-full flex items-center justify-center font-mono text-xs ${
                currentStep === 2
                  ? 'bg-emerald-500 text-black font-bold'
                  : currentStep > 2
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                  : 'bg-[#1e2d45] text-[#8892a4]'
              }`}
            >
              {currentStep > 2 ? <Check className="w-4 h-4" /> : '2'}
            </div>
            <div className="hidden sm:block">
              <div className="text-[10px] uppercase font-mono text-[#8892a4]">Step 2</div>
              <div className="truncate">Company & Admin</div>
            </div>
          </div>

          <div
            className={`p-4 flex items-center gap-3 ${
              currentStep === 3
                ? 'bg-[#151d2e] text-emerald-400 font-bold'
                : 'text-[#64748b]'
            }`}
          >
            <div
              className={`w-7 h-7 rounded-full flex items-center justify-center font-mono text-xs ${
                currentStep === 3
                  ? 'bg-emerald-500 text-black font-bold'
                  : 'bg-[#1e2d45] text-[#8892a4]'
              }`}
            >
              3
            </div>
            <div className="hidden sm:block">
              <div className="text-[10px] uppercase font-mono text-[#8892a4]">Step 3</div>
              <div className="truncate">Review & Install</div>
            </div>
          </div>
        </div>

        {/* Step Body Content */}
        <div className="p-5 sm:p-8 space-y-6 flex-1">
          {/* ========================================================================= */}
          {/* STEP 1: SYSTEM SETUP & DATABASE ENGINE                                   */}
          {/* ========================================================================= */}
          {currentStep === 1 && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <Database className="w-5 h-5 text-emerald-400" />
                  <span>Database Engine Selection</span>
                </h3>
                <p className="text-xs text-[#8892a4] mt-1">
                  Select your persistence storage backend. You can use embedded zero-config SQLite or connect to external MySQL / MariaDB / PostgreSQL clusters.
                </p>
              </div>

              {/* Database Engine Radio Selector */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* SQLite Option */}
                <div
                  onClick={() => {
                    setDbType('sqlite');
                    setDbTestResult(null);
                  }}
                  className={`p-4 rounded-xl border cursor-pointer transition flex flex-col justify-between ${
                    dbType === 'sqlite'
                      ? 'bg-emerald-500/10 border-emerald-500/50 shadow-md ring-1 ring-emerald-500/30'
                      : 'bg-[#0e1422] border-[#1e2d45] hover:border-[#2a3a52]'
                  }`}
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="w-8 h-8 rounded-lg bg-[#1a2438] border border-[#2a3a52] flex items-center justify-center text-cyan-400">
                        <HardDrive className="w-4 h-4" />
                      </div>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#151d2e] text-emerald-400 border border-emerald-500/30">
                        Recommended
                      </span>
                    </div>
                    <div className="font-bold text-white text-sm">SQLite (Embedded)</div>
                    <p className="text-[11px] text-[#8892a4] leading-relaxed">
                      Zero-cloud standalone file database. Automatically allocated in local directory.
                    </p>
                  </div>
                </div>

                {/* MySQL / MariaDB Option */}
                <div
                  onClick={() => {
                    setDbType('mysql');
                    setDbPort('3306');
                    setDbTestResult(null);
                  }}
                  className={`p-4 rounded-xl border cursor-pointer transition flex flex-col justify-between ${
                    dbType === 'mysql'
                      ? 'bg-emerald-500/10 border-emerald-500/50 shadow-md ring-1 ring-emerald-500/30'
                      : 'bg-[#0e1422] border-[#1e2d45] hover:border-[#2a3a52]'
                  }`}
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="w-8 h-8 rounded-lg bg-[#1a2438] border border-[#2a3a52] flex items-center justify-center text-amber-400">
                        <Database className="w-4 h-4" />
                      </div>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#151d2e] text-[#8892a4] border border-[#1e2d45]">
                        Standard
                      </span>
                    </div>
                    <div className="font-bold text-white text-sm">MySQL / MariaDB</div>
                    <p className="text-[11px] text-[#8892a4] leading-relaxed">
                      Centralized SQL database server for multi-site or enterprise  clusters.
                    </p>
                  </div>
                </div>

                {/* PostgreSQL Option */}
                <div
                  onClick={() => {
                    setDbType('postgres');
                    setDbPort('5432');
                    setDbTestResult(null);
                  }}
                  className={`p-4 rounded-xl border cursor-pointer transition flex flex-col justify-between ${
                    dbType === 'postgres'
                      ? 'bg-emerald-500/10 border-emerald-500/50 shadow-md ring-1 ring-emerald-500/30'
                      : 'bg-[#0e1422] border-[#1e2d45] hover:border-[#2a3a52]'
                  }`}
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="w-8 h-8 rounded-lg bg-[#1a2438] border border-[#2a3a52] flex items-center justify-center text-blue-400">
                        <Layers className="w-4 h-4" />
                      </div>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#151d2e] text-[#8892a4] border border-[#1e2d45]">
                        High Scale
                      </span>
                    </div>
                    <div className="font-bold text-white text-sm">PostgreSQL</div>
                    <p className="text-[11px] text-[#8892a4] leading-relaxed">
                      Robust ACID relational engine with connection pooling and high concurrency.
                    </p>
                  </div>
                </div>
              </div>

              {/* SQLite Directory Scan & Initialization Details */}
              {dbType === 'sqlite' && (
                <div className="bg-[#0a0e17] border border-[#1e2d45] rounded-xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-xs font-bold text-white">
                      <FolderSearch className="w-4 h-4 text-emerald-400" />
                      <span>Local Directory & Database Scan</span>
                    </div>
                    <button
                      onClick={scanSqliteDirectory}
                      disabled={scanningSqlite}
                      className="text-[11px] font-mono text-emerald-400 hover:underline flex items-center gap-1"
                    >
                      <RefreshCw className={`w-3 h-3 ${scanningSqlite ? 'animate-spin' : ''}`} />
                      <span>Rescan Directory</span>
                    </button>
                  </div>

                  <div className="text-xs font-mono space-y-1.5 text-[#8892a4]">
                    <div className="flex flex-col sm:flex-row sm:justify-between">
                      <span>Target Storage Path:</span>
                      <span className="text-cyan-400 font-bold">{sqliteScannedInfo?.path || './data/netops.db'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Existing File Detected:</span>
                      <span className={sqliteScannedInfo?.exists ? 'text-amber-400' : 'text-emerald-400'}>
                        {sqliteScannedInfo?.exists ? 'YES (Existing DB Found)' : 'NO (Fresh Initialization)'}
                      </span>
                    </div>
                  </div>

                  <div className="p-3 bg-[#151d2e] border border-[#1e2d45] rounded-lg text-xs flex items-center gap-3">
                    <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                    <div>
                      <div className="font-bold text-white">Ready to Initialize Fresh Schema</div>
                      <div className="text-[#8892a4] text-[11px]">
                        The installer will create tables for <code className="text-emerald-400">devices</code>, <code className="text-emerald-400">users</code>, <code className="text-emerald-400">system_config</code>, <code className="text-emerald-400">alerts</code>, <code className="text-emerald-400">backups</code>, and telemetry logs.
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Remote Database (MySQL / Postgres) Connection Form */}
              {(dbType === 'mysql' || dbType === 'postgres') && (
                <div className="bg-[#0a0e17] border border-[#1e2d45] rounded-xl p-4 sm:p-5 space-y-4">
                  <div className="flex items-center justify-between pb-2 border-b border-[#1e2d45]">
                    <span className="text-xs font-bold text-white uppercase font-mono">
                      {dbType === 'mysql' ? 'MySQL / MariaDB Configuration' : 'PostgreSQL Configuration'}
                    </span>
                    <span className="text-[11px] text-[#8892a4] font-mono">Standard TCP Handshake</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="sm:col-span-2">
                      <label className="block text-xs text-[#8892a4] mb-1 font-mono">Server Host / IP:</label>
                      <input
                        type="text"
                        value={dbHost}
                        onChange={(e) => setDbHost(e.target.value)}
                        placeholder="127.0.0.1 or db..lan"
                        className="w-full px-3 py-2 bg-[#151d2e] border border-[#1e2d45] rounded-lg text-xs text-white font-mono focus:outline-none focus:border-emerald-500"
                      />
                    </div>

                    <div>
                      <label className="block text-xs text-[#8892a4] mb-1 font-mono">Port:</label>
                      <input
                        type="number"
                        value={dbPort}
                        onChange={(e) => setDbPort(e.target.value)}
                        className="w-full px-3 py-2 bg-[#151d2e] border border-[#1e2d45] rounded-lg text-xs text-white font-mono focus:outline-none focus:border-emerald-500"
                      />
                    </div>

                    <div>
                      <label className="block text-xs text-[#8892a4] mb-1 font-mono">Database Name:</label>
                      <input
                        type="text"
                        value={dbName}
                        onChange={(e) => setDbName(e.target.value)}
                        placeholder="_netops"
                        className="w-full px-3 py-2 bg-[#151d2e] border border-[#1e2d45] rounded-lg text-xs text-white font-mono focus:outline-none focus:border-emerald-500"
                      />
                    </div>

                    <div>
                      <label className="block text-xs text-[#8892a4] mb-1 font-mono">Username:</label>
                      <input
                        type="text"
                        value={dbUser}
                        onChange={(e) => setDbUser(e.target.value)}
                        placeholder="netops_admin"
                        className="w-full px-3 py-2 bg-[#151d2e] border border-[#1e2d45] rounded-lg text-xs text-white font-mono focus:outline-none focus:border-emerald-500"
                      />
                    </div>

                    <div>
                      <label className="block text-xs text-[#8892a4] mb-1 font-mono">Password:</label>
                      <div className="relative">
                        <input
                          type={showDbPassword ? 'text' : 'password'}
                          value={dbPassword}
                          onChange={(e) => setDbPassword(e.target.value)}
                          placeholder="••••••••••••"
                          className="w-full px-3 py-2 bg-[#151d2e] border border-[#1e2d45] rounded-lg text-xs text-white font-mono focus:outline-none focus:border-emerald-500 pr-9"
                        />
                        <button
                          type="button"
                          onClick={() => setShowDbPassword(!showDbPassword)}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#8892a4] hover:text-white"
                        >
                          {showDbPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pt-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-[#8892a4] font-mono">SSL Encryption:</span>
                      <select
                        value={dbSsl}
                        onChange={(e: any) => setDbSsl(e.target.value)}
                        className="px-2.5 py-1 bg-[#151d2e] border border-[#1e2d45] rounded text-xs text-white font-mono"
                      >
                        <option value="disable">Disable (Local Network)</option>
                        <option value="require">Require TLS / SSL</option>
                        <option value="prefer">Prefer TLS</option>
                      </select>
                    </div>

                    <button
                      type="button"
                      onClick={handleTestDatabaseConnection}
                      disabled={testingDb}
                      className="px-4 py-2 bg-[#1e2d45] hover:bg-[#2a3a52] text-white rounded-lg text-xs font-mono font-bold flex items-center gap-1.5 transition disabled:opacity-50"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${testingDb ? 'animate-spin' : ''}`} />
                      <span>{testingDb ? 'Testing Connection...' : 'Test Connection'}</span>
                    </button>
                  </div>

                  {dbTestResult && (
                    <div
                      className={`p-3 rounded-lg border text-xs font-mono flex items-start gap-2 ${
                        dbTestResult.success
                          ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                          : 'bg-red-500/10 border-red-500/30 text-red-400'
                      }`}
                    >
                      {dbTestResult.success ? (
                        <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                      ) : (
                        <XCircle className="w-4 h-4 shrink-0 mt-0.5" />
                      )}
                      <span>{dbTestResult.message}</span>
                    </div>
                  )}
                </div>
              )}

              {/* Section 2: Gemini AI Key (Optional) */}
              <div className="pt-2 border-t border-[#1e2d45] space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-emerald-400" />
                    <h4 className="font-bold text-white text-sm">Gemini AI Diagnostics API Key</h4>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#1a2438] text-[#8892a4] border border-[#2a3a52]">
                      Optional
                    </span>
                  </div>
                  <a
                    href="https://aistudio.google.com/app/apikey"
                    target="_blank"
                    rel="noreferrer"
                    className="text-[11px] text-cyan-400 hover:underline font-mono"
                  >
                    Get API Key &rarr;
                  </a>
                </div>
                <p className="text-xs text-[#8892a4]">
                  Powers intelligent root cause analysis, action plans, and automated CLI script generation using the Google Gemini 3.6 Flash model.
                </p>
                <div className="relative">
                  <input
                    type={showGeminiKey ? 'text' : 'password'}
                    value={geminiApiKey}
                    onChange={(e) => setGeminiApiKey(e.target.value)}
                    placeholder="AIzaSy..."
                    className="w-full px-3 py-2 bg-[#0a0e17] border border-[#1e2d45] rounded-lg text-xs text-white font-mono focus:outline-none focus:border-emerald-500 pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowGeminiKey(!showGeminiKey)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#8892a4] hover:text-white"
                  >
                    {showGeminiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* STEP 2: COMPANY & SUPER ADMIN CREDENTIALS                                */}
          {/* ========================================================================= */}
          {currentStep === 2 && (
            <div className="space-y-6">
              {/* Section 1: Company / Property Profile */}
              <div className="space-y-4">
                <div>
                  <h3 className="text-lg font-bold text-white flex items-center gap-2">
                    <Building2 className="w-5 h-5 text-emerald-400" />
                    <span>Company &  Property Information</span>
                  </h3>
                  <p className="text-xs text-[#8892a4] mt-1">
                    Enter the organizational identity for SLA telemetry reports, alert headers, and NOC inventory.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-[#0a0e17] p-4 rounded-xl border border-[#1e2d45]">
                  <div className="sm:col-span-2">
                    <label className="block text-xs text-[#8892a4] mb-1 font-mono">Company / Resort Name:</label>
                    <input
                      type="text"
                      value={companyName}
                      onChange={(e) => setCompanyName(e.target.value)}
                      placeholder="e.g. Royal  Resort & Spa"
                      className="w-full px-3 py-2 bg-[#151d2e] border border-[#1e2d45] rounded-lg text-xs text-white font-medium focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-xs text-[#8892a4] mb-1 font-mono">Street Address:</label>
                    <input
                      type="text"
                      value={companyAddress}
                      onChange={(e) => setCompanyAddress(e.target.value)}
                      placeholder="e.g. Jl. Pantai Jimbaran No. 88"
                      className="w-full px-3 py-2 bg-[#151d2e] border border-[#1e2d45] rounded-lg text-xs text-white focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs text-[#8892a4] mb-1 font-mono">Country:</label>
                    <input
                      type="text"
                      value={companyCountry}
                      onChange={(e) => setCompanyCountry(e.target.value)}
                      placeholder="e.g. Indonesia"
                      className="w-full px-3 py-2 bg-[#151d2e] border border-[#1e2d45] rounded-lg text-xs text-white focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs text-[#8892a4] mb-1 font-mono">Province / Region:</label>
                    <input
                      type="text"
                      value={companyProvince}
                      onChange={(e) => setCompanyProvince(e.target.value)}
                      placeholder="e.g. Bali"
                      className="w-full px-3 py-2 bg-[#151d2e] border border-[#1e2d45] rounded-lg text-xs text-white focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs text-[#8892a4] mb-1 font-mono">City / District:</label>
                    <input
                      type="text"
                      value={companyCity}
                      onChange={(e) => setCompanyCity(e.target.value)}
                      placeholder="e.g. Badung / Jimbaran"
                      className="w-full px-3 py-2 bg-[#151d2e] border border-[#1e2d45] rounded-lg text-xs text-white focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs text-[#8892a4] mb-1 font-mono">Postal / State Code:</label>
                    <input
                      type="text"
                      value={companyStateCode}
                      onChange={(e) => setCompanyStateCode(e.target.value)}
                      placeholder="e.g. 80361"
                      className="w-full px-3 py-2 bg-[#151d2e] border border-[#1e2d45] rounded-lg text-xs text-white font-mono focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs text-[#8892a4] mb-1 font-mono">Contact Email:</label>
                    <input
                      type="email"
                      value={companyEmail}
                      onChange={(e) => setCompanyEmail(e.target.value)}
                      placeholder="noc@.com"
                      className="w-full px-3 py-2 bg-[#151d2e] border border-[#1e2d45] rounded-lg text-xs text-white font-mono focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs text-[#8892a4] mb-1 font-mono">Emergency Phone:</label>
                    <input
                      type="text"
                      value={companyPhone}
                      onChange={(e) => setCompanyPhone(e.target.value)}
                      placeholder="+62 361 888999"
                      className="w-full px-3 py-2 bg-[#151d2e] border border-[#1e2d45] rounded-lg text-xs text-white font-mono focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>
              </div>

              {/* Section 2: Super Admin Account */}
              <div className="space-y-4 pt-2 border-t border-[#1e2d45]">
                <div>
                  <h3 className="text-lg font-bold text-white flex items-center gap-2">
                    <Shield className="w-5 h-5 text-emerald-400" />
                    <span>Super Admin & IT Operations Officer Account</span>
                  </h3>
                  <p className="text-xs text-[#8892a4] mt-1">
                    Create the primary root administrative account for system access, automation scheduling, and device configurations.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-[#0a0e17] p-4 rounded-xl border border-[#1e2d45]">
                  <div>
                    <label className="block text-xs text-[#8892a4] mb-1 font-mono">Full Name:</label>
                    <input
                      type="text"
                      value={adminFullName}
                      onChange={(e) => setAdminFullName(e.target.value)}
                      placeholder="e.g. Alex Henderson"
                      className="w-full px-3 py-2 bg-[#151d2e] border border-[#1e2d45] rounded-lg text-xs text-white focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs text-[#8892a4] mb-1 font-mono">Role / Designation:</label>
                    <input
                      type="text"
                      value={adminRole}
                      onChange={(e) => setAdminRole(e.target.value)}
                      placeholder="Super Admin / IT Operations Officer"
                      className="w-full px-3 py-2 bg-[#151d2e] border border-[#1e2d45] rounded-lg text-xs text-white focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-xs text-[#8892a4] mb-1 font-mono">Username (Login ID):</label>
                    <input
                      type="text"
                      value={adminUsername}
                      onChange={(e) => setAdminUsername(e.target.value)}
                      placeholder="admin"
                      className="w-full px-3 py-2 bg-[#151d2e] border border-[#1e2d45] rounded-lg text-xs text-white font-mono focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs text-[#8892a4] mb-1 font-mono">Password (Min 12 Chars):</label>
                    <div className="relative">
                      <input
                        type={showAdminPassword ? 'text' : 'password'}
                        value={adminPassword}
                        onChange={(e) => setAdminPassword(e.target.value)}
                        className="w-full px-3 py-2 bg-[#151d2e] border border-[#1e2d45] rounded-lg text-xs text-white font-mono focus:outline-none focus:border-emerald-500 pr-9"
                      />
                      <button
                        type="button"
                        onClick={() => setShowAdminPassword(!showAdminPassword)}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#8892a4] hover:text-white"
                      >
                        {showAdminPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs text-[#8892a4] mb-1 font-mono">Confirm Password:</label>
                    <input
                      type={showAdminPassword ? 'text' : 'password'}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="w-full px-3 py-2 bg-[#151d2e] border border-[#1e2d45] rounded-lg text-xs text-white font-mono focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  {/* Password Security Criteria Checklist */}
                  <div className="sm:col-span-2 pt-2 bg-[#151d2e] p-3 rounded-lg border border-[#1e2d45] space-y-2">
                    <div className="text-[11px] font-mono text-[#8892a4] uppercase flex items-center justify-between">
                      <span>Password Security Standards (Mandatory)</span>
                      <span className={isPasswordValid ? 'text-emerald-400 font-bold' : 'text-amber-400'}>
                        {isPasswordValid ? 'SECURITY REQUIREMENT MET' : 'CRITERIA INCOMPLETE'}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs font-mono">
                      <div className={`flex items-center gap-1.5 ${pwHasLength ? 'text-emerald-400' : 'text-[#64748b]'}`}>
                        {pwHasLength ? <CheckCircle2 className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
                        <span>Min 12 Characters</span>
                      </div>

                      <div className={`flex items-center gap-1.5 ${pwHasUpper ? 'text-emerald-400' : 'text-[#64748b]'}`}>
                        {pwHasUpper ? <CheckCircle2 className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
                        <span>Uppercase Letter (A-Z)</span>
                      </div>

                      <div className={`flex items-center gap-1.5 ${pwHasLower ? 'text-emerald-400' : 'text-[#64748b]'}`}>
                        {pwHasLower ? <CheckCircle2 className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
                        <span>Lowercase Letter (a-z)</span>
                      </div>

                      <div className={`flex items-center gap-1.5 ${pwHasNum ? 'text-emerald-400' : 'text-[#64748b]'}`}>
                        {pwHasNum ? <CheckCircle2 className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
                        <span>Numeric Digit (0-9)</span>
                      </div>

                      <div className={`flex items-center gap-1.5 ${pwHasSpecial ? 'text-emerald-400' : 'text-[#64748b]'}`}>
                        {pwHasSpecial ? <CheckCircle2 className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
                        <span>Special Character (!@#$)</span>
                      </div>

                      <div className={`flex items-center gap-1.5 ${pwMatchesConfirm ? 'text-emerald-400' : 'text-[#64748b]'}`}>
                        {pwMatchesConfirm ? <CheckCircle2 className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
                        <span>Passwords Match</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* STEP 3: REVIEW, INSTALLER LOG TERMINAL & FINALIZATION                      */}
          {/* ========================================================================= */}
          {currentStep === 3 && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <Terminal className="w-5 h-5 text-emerald-400" />
                  <span>Configuration Summary & Final Deployment</span>
                </h3>
                <p className="text-xs text-[#8892a4] mt-1">
                  Review all parameters prior to initializing schema, cryptographic salts, and system lock state.
                </p>
              </div>

              {/* Review Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* System & Database Summary */}
                <div className="bg-[#0a0e17] border border-[#1e2d45] rounded-xl p-4 space-y-3 font-mono text-xs">
                  <div className="flex items-center justify-between pb-2 border-b border-[#1e2d45] font-bold text-emerald-400">
                    <span className="flex items-center gap-1.5">
                      <Database className="w-4 h-4" />
                      <span>Database Engine</span>
                    </span>
                    <span className="uppercase text-[10px] px-2 py-0.5 bg-emerald-500/15 rounded">
                      {dbType}
                    </span>
                  </div>

                  <div className="space-y-1 text-[#8892a4]">
                    {dbType === 'sqlite' ? (
                      <div>
                        Path: <span className="text-white">{sqliteScannedInfo?.path || './data/netops.db'}</span>
                      </div>
                    ) : (
                      <>
                        <div>
                          Host/Port: <span className="text-white">{dbHost}:{dbPort}</span>
                        </div>
                        <div>
                          Database: <span className="text-white">{dbName}</span>
                        </div>
                        <div>
                          Username: <span className="text-white">{dbUser}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span>Password:</span>
                          <span className="text-white">
                            {showDbPassword ? dbPassword : '••••••••••••'}
                          </span>
                        </div>
                      </>
                    )}
                    <div className="pt-1 flex items-center justify-between">
                      <span>Gemini 3.6 AI:</span>
                      <span className={geminiApiKey ? 'text-emerald-400' : 'text-[#64748b]'}>
                        {geminiApiKey ? 'Configured (API Key Set)' : 'Heuristic Rules Mode'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Company & Super Admin Summary */}
                <div className="bg-[#0a0e17] border border-[#1e2d45] rounded-xl p-4 space-y-3 font-mono text-xs">
                  <div className="flex items-center justify-between pb-2 border-b border-[#1e2d45] font-bold text-cyan-400">
                    <span className="flex items-center gap-1.5">
                      <Shield className="w-4 h-4" />
                      <span>Property & Super Admin</span>
                    </span>
                    <span className="text-[10px] px-2 py-0.5 bg-cyan-500/15 rounded">
                      {companyCountry}
                    </span>
                  </div>

                  <div className="space-y-1 text-[#8892a4]">
                    <div>
                      Company: <span className="text-white">{companyName}</span>
                    </div>
                    <div>
                      Location: <span className="text-white">{companyCity}, {companyProvince}</span>
                    </div>
                    <div>
                      Admin Name: <span className="text-white">{adminFullName}</span>
                    </div>
                    <div>
                      Login Username: <span className="text-emerald-400 font-bold">{adminUsername}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Password:</span>
                      <div className="flex items-center gap-2">
                        <span className="text-white font-bold">
                          {showAdminPassword ? adminPassword : '••••••••••••••••'}
                        </span>
                        <button
                          type="button"
                          onClick={() => setShowAdminPassword(!showAdminPassword)}
                          className="text-[#8892a4] hover:text-white"
                        >
                          {showAdminPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Installer Live Terminal Window */}
              {installerLogs.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs font-mono text-[#8892a4]">
                    <span className="flex items-center gap-1.5">
                      <Terminal className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Live Installation Execution Terminal</span>
                    </span>
                    <span className="text-[10px] text-emerald-400 font-bold">
                      {installing ? 'INSTALLING...' : installSuccess ? 'COMPLETED' : 'ERROR'}
                    </span>
                  </div>

                  <div className="bg-[#050811] border border-[#1e2d45] rounded-xl p-4 font-mono text-xs space-y-1.5 max-h-56 overflow-y-auto">
                    {installerLogs.map((l, idx) => (
                      <div key={idx} className="flex items-start gap-2 leading-relaxed">
                        <span className="text-[#64748b] text-[10px]">[{l.timestamp}]</span>
                        <span
                          className={`text-[10px] font-bold px-1 rounded ${
                            l.level === 'SUCCESS'
                              ? 'bg-emerald-500/20 text-emerald-400'
                              : l.level === 'INFO'
                              ? 'bg-blue-500/20 text-blue-400'
                              : l.level === 'WARN'
                              ? 'bg-amber-500/20 text-amber-400'
                              : 'bg-red-500/20 text-red-400'
                          }`}
                        >
                          {l.level}
                        </span>
                        <span
                          className={
                            l.level === 'SUCCESS'
                              ? 'text-emerald-300'
                              : l.level === 'ERROR'
                              ? 'text-red-400 font-bold'
                              : 'text-[#c3cad8]'
                          }
                        >
                          {l.message}
                        </span>
                      </div>
                    ))}
                    {installing && (
                      <div className="flex items-center gap-2 text-emerald-400 pt-1">
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        <span>Provisioning database indexes and creating security salts...</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Install Error Banner */}
              {installError && (
                <div className="p-4 bg-red-500/10 border border-red-500/40 rounded-xl text-xs text-red-400 flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
                  <div>
                    <div className="font-bold">Installation Stopped Due to Error</div>
                    <div className="mt-0.5 text-red-300 font-mono">{installError}</div>
                  </div>
                </div>
              )}

              {/* Action Button */}
              {!installSuccess && (
                <div className="pt-2">
                  <button
                    onClick={handleRunInstallation}
                    disabled={installing}
                    className="w-full py-3.5 px-6 bg-gradient-to-r from-emerald-600 via-teal-600 to-blue-600 hover:from-emerald-500 hover:to-blue-500 text-white rounded-xl text-sm font-bold shadow-xl transition flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    <HardDrive className={`w-4 h-4 ${installing ? 'animate-spin' : ''}`} />
                    <span>{installing ? 'Running Installation Engine...' : 'Run Install & Initialize Database'}</span>
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Wizard Footer Navigation */}
        {!installSuccess && (
          <div className="p-4 sm:p-5 bg-[#0d1320] border-t border-[#1e2d45] flex items-center justify-between">
            {currentStep > 1 ? (
              <button
                type="button"
                onClick={() => setCurrentStep((prev) => (prev - 1) as any)}
                disabled={installing}
                className="px-4 py-2 bg-[#1a2438] hover:bg-[#2a3a52] text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition disabled:opacity-50"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Previous Step</span>
              </button>
            ) : (
              <div />
            )}

            {currentStep < 3 && (
              <button
                type="button"
                onClick={() => {
                  if (currentStep === 1 && isStep1Valid) setCurrentStep(2);
                  else if (currentStep === 2 && isStep2Valid) setCurrentStep(3);
                }}
                disabled={(currentStep === 1 && !isStep1Valid) || (currentStep === 2 && !isStep2Valid)}
                className="px-5 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-md transition disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <span>Continue to Step {currentStep + 1}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* SUCCESS MODAL DIALOG                                                      */}
      {/* ========================================================================= */}
      {installSuccess && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-fadeIn">
          <div className="bg-[#111726] border border-emerald-500/40 max-w-md w-full rounded-2xl p-6 sm:p-7 shadow-2xl space-y-5 text-center">
            <div className="w-16 h-16 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 flex items-center justify-center mx-auto shadow-lg">
              <CheckCircle2 className="w-9 h-9 animate-bounce" />
            </div>

            <div className="space-y-1.5">
              <h3 className="text-xl font-bold text-white">Installation Successful!</h3>
              <p className="text-xs text-[#8892a4] leading-relaxed">
                 NetOps Super Tools has been configured and the setup wizard is now permanently locked. You can now login with your Super Admin credentials.
              </p>
            </div>

            <div className="p-3 bg-[#0a0e17] border border-[#1e2d45] rounded-xl text-xs font-mono text-left space-y-1">
              <div className="flex justify-between text-[#8892a4]">
                <span>Property:</span>
                <span className="text-white font-bold">{companyName}</span>
              </div>
              <div className="flex justify-between text-[#8892a4]">
                <span>Storage Engine:</span>
                <span className="text-emerald-400 font-bold uppercase">{dbType}</span>
              </div>
              <div className="flex justify-between text-[#8892a4]">
                <span>Username:</span>
                <span className="text-cyan-400 font-bold">{adminUsername}</span>
              </div>
            </div>

            <button
              type="button"
              onClick={onSetupCompleted}
              className="w-full py-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl text-sm font-bold shadow-lg transition flex items-center justify-center gap-2"
            >
              <span>Continue to Login</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
