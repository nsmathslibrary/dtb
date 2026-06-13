import React, { useEffect, useState } from 'react';
import { User } from 'firebase/auth';
import { initAuth, googleSignIn, logout } from './auth';
import { fetchRegistrations } from './googleApi';
import { STREAMS } from './types';
import RegistrationForm from './components/RegistrationForm';
import AdmitCard from './components/AdmitCard';
import { ShieldAlert, LogOut, CheckSquare, Search, PlusCircle, Layout, HelpCircle, FileSpreadsheet, FolderOpen, HeartHandshake, Award, RefreshCw } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [needsAuth, setNeedsAuth] = useState(true);
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  // App Navigation: 'landing' | 'register' | 'search' | 'admit'
  const [viewMode, setViewMode] = useState<'landing' | 'register' | 'search' | 'admit'>('landing');
  const [activeRegistration, setActiveRegistration] = useState<any | null>(null);

  // Search Fields
  const [searchRegId, setSearchRegId] = useState('');
  const [searchDob, setSearchDob] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  // Synced sheet details helper link
  const [spreadsheetId, setSpreadsheetId] = useState<string | null>(null);

  useEffect(() => {
    // Check if user is already logged in with a valid token
    const unsubscribe = initAuth(
      (firebaseUser, token) => {
        setUser(firebaseUser);
        setAccessToken(token);
        setNeedsAuth(false);
      },
      () => {
        setUser(null);
        setAccessToken(null);
        setNeedsAuth(true);
      }
    );

    return () => unsubscribe();
  }, []);

  const handleLogin = async () => {
    setIsLoggingIn(true);
    setSearchError(null);
    try {
      const result = await googleSignIn();
      if (result) {
        setUser(result.user);
        setAccessToken(result.accessToken);
        setNeedsAuth(false);
      }
    } catch (err) {
      console.error('Google authorization error:', err);
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    setUser(null);
    setAccessToken(null);
    setNeedsAuth(true);
    setViewMode('landing');
    setActiveRegistration(null);
    setSpreadsheetId(null);
  };

  const handleRegistrationSuccess = (record: any) => {
    setActiveRegistration(record);
    if (record.spreadsheetId) {
      setSpreadsheetId(record.spreadsheetId);
    }
    setViewMode('admit');
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accessToken) {
      alert('Please connect your Google Account first.');
      return;
    }
    if (!searchRegId.trim() || !searchDob) {
      setSearchError('Both Registration ID and Date of Birth are required.');
      return;
    }

    setIsSearching(true);
    setSearchError(null);

    try {
      // Look for Spreadsheet "Exam Registrations" on the student's drive first by using mock/default sheet lookup name.
      // Fetch registrations from Google sheets
      const query = encodeURIComponent("name = 'Exam Registrations' and mimeType = 'application/vnd.google-apps.spreadsheet' and trashed = false");
      const driveSearchRes = await fetch(`https://www.googleapis.com/drive/v3/files?q=${query}&fields=files(id)`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (!driveSearchRes.ok) {
        throw new Error('Failed to find your Exam registrations spreadsheet in Google Drive. Make sure you have previously registered a student.');
      }

      const driveData = await driveSearchRes.json();
      if (!driveData.files || driveData.files.length === 0) {
        throw new Error('No assessment registrations spreadsheet found. Please complete a registration first to initialize the spreadsheet.');
      }

      const activeSpreadsheetId = driveData.files[0].id;
      setSpreadsheetId(activeSpreadsheetId);

      const records = await fetchRegistrations(accessToken, activeSpreadsheetId);
      
      // Filter the matching entry case-insensitive and matching DOB exactly
      const matched = records.find(
        r => r.regId.toLowerCase().trim() === searchRegId.toLowerCase().trim() && r.dob === searchDob
      );

      if (matched) {
        setActiveRegistration(matched);
        setViewMode('admit');
      } else {
        setSearchError('No matching record was found. Please verify your Registration ID and Date of Birth.');
      }

    } catch (err: any) {
      console.error(err);
      setSearchError(err.message || 'Failed to communicate with Google Sheets database. Try refreshing or logging out & in again.');
    } finally {
      setIsSearching(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0A0B0D] text-slate-200 font-sans antialiased pb-12 flex flex-col">
      {/* Official Top Bar */}
      <header className="bg-[#0F1116] border-b border-slate-800/80 no-print">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-emerald-500 rounded-lg flex items-center justify-center shrink-0">
              <Award className="w-5 h-5 text-black font-bold" />
            </div>
            <div>
              <h1 className="font-bold text-sm tracking-tight text-white uppercase leading-none">Deeni Ta'leemi Board, Manipur</h1>
              <p className="text-[9px] text-slate-500 mt-0.5 font-medium tracking-wider uppercase">Head Office - Babupara Jama Masjid, Imphal - 795001</p>
            </div>
          </div>

          {/* User Sign In State */}
          <div className="flex items-center gap-3">
            {!needsAuth && user ? (
              <div className="flex items-center gap-3 bg-[#14161C] p-1.5 pl-2.5 pr-1.5 rounded-xl border border-slate-800/85">
                <div className="text-right">
                  <p className="text-xs font-bold text-white">{user.displayName || 'Authorized User'}</p>
                  <p className="text-[9px] text-slate-500 font-mono">{user.email}</p>
                </div>
                {user.photoURL ? (
                  <img src={user.photoURL} alt={user.displayName || ''} className="w-8 h-8 rounded-lg object-cover" />
                ) : (
                  <div className="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center font-bold text-slate-300">
                    {user.displayName?.[0] || 'U'}
                  </div>
                )}
                <button
                  onClick={handleLogout}
                  className="bg-[#1C1F26] hover:bg-rose-950/30 border border-slate-700/60 p-1.5 rounded-lg text-slate-400 hover:text-rose-400 transition-all cursor-pointer"
                  title="Logout"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div />
            )}
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-6xl mx-auto px-4 mt-10 flex-1 w-full">
        
        {/* Landing Dashboard View */}
        {viewMode === 'landing' && (
          <div className="space-y-12 no-print">
            
            {/* Title Hero */}
            <div className="text-center max-w-2xl mx-auto space-y-3">
              <span className="inline-block bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-xs font-bold px-3 py-1 rounded-full uppercase tracking-widest">
                DTB Examination Portal 2026-27
              </span>
              <h2 className="text-3xl md:text-4xl text-white tracking-tight leading-tight">
                Deeniyat Primary Course <span className="font-semibold text-emerald-400">Leaving Certificate Examination</span> 2026-27
              </h2>
              <p className="text-sm text-slate-400 leading-relaxed font-normal">
                Officially enroll student demographics (including passport photo, father's/mother's names, address, and selected Maktab). Process local fee exemptions, auto-generate Admit Cards, and synchronize records into Google Sheets and Drive.
              </p>
            </div>

            {needsAuth ? (
              /* Authorization Gate Required Card */
              <div className="max-w-md mx-auto bg-[#14161C] rounded-2xl border border-slate-800 shadow-2xl p-6 md:p-8 text-center space-y-6">
                <div className="w-14 h-14 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl flex items-center justify-center text-emerald-400 mx-auto">
                  <CheckSquare className="w-7 h-7" />
                </div>
                <div className="space-y-2">
                  <h3 className="text-base font-bold text-white">Authorize Workspace Integration</h3>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    This portal integrates with **Google Sheets** and **Google Drive** to securely store your data. Sign-in with permission is required to continue.
                  </p>
                </div>

                {/* Styled Sign In With Google Button */}
                <button
                  onClick={handleLogin}
                  disabled={isLoggingIn}
                  className="w-full h-12 border border-slate-750 rounded-xl bg-[#1C1F26] hover:bg-[#252a33] text-white hover:border-slate-605 transition-all flex items-center justify-center gap-3 font-semibold text-sm cursor-pointer disabled:opacity-50"
                  id="google-signin-btn"
                >
                  {isLoggingIn ? (
                    <RefreshCw className="w-4 h-4 animate-spin text-slate-400" />
                  ) : (
                    <svg className="w-5 h-5" viewBox="0 0 48 48">
                      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"></path>
                      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"></path>
                      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"></path>
                      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"></path>
                    </svg>
                  )}
                  <span>{isLoggingIn ? 'Connecting...' : 'Authorize with Google'}</span>
                </button>
              </div>
            ) : (
              /* Logged In Quick Actions Dashboard */
              <div className="space-y-6">
                
                {/* Visual Widgets Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  
                  {/* Action 1: Register */}
                  <div
                    onClick={() => setViewMode('register')}
                    className="group bg-[#14161C] hover:bg-[#1C1F26] border border-slate-800 hover:border-slate-700 p-6 rounded-2xl shadow-md transition-all cursor-pointer flex gap-4 items-start"
                  >
                    <div className="w-12 h-12 rounded-xl bg-[#1C1F26] group-hover:bg-emerald-500 group-hover:text-black flex items-center justify-center text-emerald-400 border border-slate-800 shrink-0 transition-all">
                      <PlusCircle className="w-6 h-6" />
                    </div>
                    <div className="space-y-1">
                      <h3 className="text-base font-bold text-white group-hover:text-white">New Assessment Registration</h3>
                      <p className="text-xs text-slate-400 group-hover:text-slate-300 leading-relaxed font-normal">
                        Apply for a new stream paper, complete invoice fees gateway, and upload details instantly.
                      </p>
                    </div>
                  </div>

                  {/* Action 2: Retrieve Search */}
                  <div
                    onClick={() => setViewMode('search')}
                    className="group bg-[#14161C] hover:bg-[#1C1F26] border border-slate-800 hover:border-slate-700 p-6 rounded-2xl shadow-md transition-all cursor-pointer flex gap-4 items-start"
                  >
                    <div className="w-12 h-12 rounded-xl bg-[#1C1F26] group-hover:bg-emerald-500 group-hover:text-black flex items-center justify-center text-emerald-400 border border-slate-800 shrink-0 transition-all">
                      <Search className="w-6 h-6" />
                    </div>
                    <div className="space-y-1">
                      <h3 className="text-base font-bold text-white group-hover:text-white">Admit Card Retrieval</h3>
                      <p className="text-xs text-slate-400 group-hover:text-slate-300 leading-relaxed font-normal">
                        Search your registered profile via Registration ID to download your E-Admit Card or print a copy.
                      </p>
                    </div>
                  </div>

                </div>

                {/* Sync & Drive Status Board */}
                <div className="bg-[#14161C] rounded-2xl border border-slate-800 p-6 space-y-4">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="space-y-1">
                      <h4 className="text-sm font-bold text-white flex items-center gap-1.5">
                        <CheckSquare className="text-emerald-400 w-4 h-4" />
                        <span>Google Account Integration Connected</span>
                      </h4>
                      <p className="text-xs text-slate-400">
                        All profile assets and applications are recorded safely inside your personal Google Account.
                      </p>
                    </div>

                    <div className="flex gap-2">
                      {spreadsheetId ? (
                        <>
                          <a
                            href={`https://docs.google.com/spreadsheets/d/${spreadsheetId}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1.5 bg-emerald-500 hover:bg-emerald-450 text-black text-xs font-bold py-2 px-3.5 rounded-lg transition-colors cursor-pointer"
                          >
                            <FileSpreadsheet className="w-3.5 h-3.5" />
                            <span>View Spreadsheet</span>
                          </a>
                          <a
                            href="https://drive.google.com"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1.5 bg-[#1C1F26] hover:bg-[#252a33] text-slate-300 hover:text-white text-xs font-bold py-2 px-3.5 rounded-lg border border-slate-700/80 transition-colors cursor-pointer"
                          >
                            <FolderOpen className="w-3.5 h-3.5" />
                            <span>Open Drive Folder</span>
                          </a>
                        </>
                      ) : (
                        <div className="text-xs text-slate-500 font-medium italic">
                          Spreadsheets will initialize upon first candidate registration.
                        </div>
                      )}
                    </div>
                  </div>
                </div>

              </div>
            )}
          </div>
        )}

        {/* Register Multistep Form View */}
        {viewMode === 'register' && accessToken && (
          <div className="space-y-4 no-print">
            <button
              onClick={() => setViewMode('landing')}
              className="text-xs font-bold text-slate-400 hover:text-white flex items-center gap-1 cursor-pointer transition-colors"
              id="back-lobby-btn"
            >
              <span>← Back to Candidate Portal Lobby</span>
            </button>
            <RegistrationForm
              accessToken={accessToken}
              userEmail={user?.email || ''}
              onSuccess={handleRegistrationSuccess}
            />
          </div>
        )}

        {/* Search / Status Lookup View */}
        {viewMode === 'search' && accessToken && (
          <div className="max-w-md mx-auto space-y-4 no-print">
            <button
              onClick={() => setViewMode('landing')}
              className="text-xs font-bold text-slate-400 hover:text-white flex items-center gap-1 cursor-pointer transition-colors"
              id="search-lobby-btn"
            >
              <span>← Back to Lobby</span>
            </button>

            <div className="bg-[#14161C] border border-slate-800 rounded-2xl p-6 md:p-8 shadow-xl space-y-6">
              <div className="space-y-1 text-center">
                <h3 className="text-lg font-bold text-white">E-Admit Card Query</h3>
                <p className="text-xs text-slate-400">Enter candidate ID and DOB to pull the certificate from Google Sheets.</p>
              </div>

              <form onSubmit={handleSearch} className="space-y-4">
                <div className="flex flex-col gap-1">
                  <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Registration ID</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. JEE-2026-12345"
                    value={searchRegId}
                    onChange={e => setSearchRegId(e.target.value)}
                    className="w-full bg-[#1C1F26] border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-300 placeholder:text-slate-600 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                    id="search-id"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Candidate Date of Birth</label>
                  <input
                    type="date"
                    required
                    value={searchDob}
                    onChange={e => setSearchDob(e.target.value)}
                    className="w-full bg-[#1C1F26] border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-300 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                    id="search-dob"
                  />
                </div>

                {searchError && (
                  <div className="p-3 bg-rose-950/20 border border-rose-800/80 rounded-lg text-xs font-semibold text-rose-300 flex items-start gap-1.5">
                    <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5 text-rose-400" />
                    <span>{searchError}</span>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isSearching}
                  className="w-full bg-emerald-500 hover:bg-emerald-400 text-black font-bold h-10.5 rounded-lg text-sm flex items-center justify-center gap-2 cursor-pointer transition-colors"
                  id="search-submit-btn"
                >
                  {isSearching ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <Search className="w-4 h-4" />
                  )}
                  <span>{isSearching ? 'Accessing Google Sheets Registry...' : 'Search & Fetch Admit Card'}</span>
                </button>
              </form>
            </div>
          </div>
        )}

        {/* Dynamic Admit Card View */}
        {viewMode === 'admit' && activeRegistration && accessToken && (
          <AdmitCard
            registration={activeRegistration}
            accessToken={accessToken}
            onBack={() => {
              setViewMode('landing');
              setActiveRegistration(null);
            }}
          />
        )}

      </main>

      {/* Sub-Footer Status */}
      <footer className="mt-auto h-12 px-8 flex items-center justify-between bg-[#0F1116] border-t border-slate-805/80 no-print text-[10px] text-slate-500">
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> Storage Sync Active</span>
          <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> Payment Authenticator Live</span>
        </div>
        <div>
          &copy; 2026 Deeni Ta'leemi Board, Manipur. Babupara, Imphal.
        </div>
      </footer>
    </div>
  );
}
