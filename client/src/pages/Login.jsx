import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertCircle, LayoutDashboard, LoaderCircle, LogIn } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import api from '../api/client.js';

function GoogleMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <path fill="#4285F4" d="M17.64 9.205c0-.638-.057-1.252-.164-1.841H9v3.481h4.844a4.14 4.14 0 0 1-1.797 2.715v2.258h2.909c1.702-1.567 2.684-3.874 2.684-6.613Z" />
      <path fill="#34A853" d="M9 18c2.43 0 4.468-.806 5.956-2.182l-2.909-2.258c-.806.54-1.835.859-3.047.859-2.344 0-4.328-1.585-5.037-3.714H.956v2.333A8.998 8.998 0 0 0 9 18Z" />
      <path fill="#FBBC05" d="M3.963 10.705A5.411 5.411 0 0 1 3.682 9c0-.592.102-1.168.281-1.705V4.962H.956A9 9 0 0 0 0 9c0 1.452.347 2.827.956 4.038l3.007-2.333Z" />
      <path fill="#EA4335" d="M9 3.58c1.321 0 2.507.454 3.441 1.346l2.581-2.581C13.464.892 11.426 0 9 0A8.998 8.998 0 0 0 .956 4.962l3.007 2.333C4.672 5.166 6.656 3.58 9 3.58Z" />
    </svg>
  );
}

export default function Login() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [google, setGoogle] = useState({ loading: true, configured: false, allowedDomain: null });

  useEffect(() => {
    if (user) navigate('/', { replace: true });
  }, [user, navigate]);

  useEffect(() => {
    api.googleStatus()
      .then((status) => setGoogle({ ...status, loading: false }))
      .catch(() => setGoogle({ loading: false, configured: false, allowedDomain: null }));
  }, []);

  const submit = async (event) => {
    event.preventDefault();
    setError('');
    setBusy(true);
    try {
      await login(email.trim(), password);
      navigate('/', { replace: true });
    } catch (err) {
      setError(err.message || 'เข้าสู่ระบบไม่สำเร็จ');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-sidebar via-blue-800 to-emerald-600 p-4">
      <div className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center gap-3 bg-sidebar px-8 py-6">
          <LayoutDashboard className="text-primary" size={26} />
          <div>
            <h1 className="font-poppins text-xl font-bold tracking-wide text-white">Tracking Task</h1>
            <p className="text-xs text-sidebar-text">Workspace สำหรับทีมครีเอทีฟ</p>
          </div>
        </div>

        <form onSubmit={submit} className="space-y-4 p-8">
          {error && (
            <div className="flex items-center gap-2 rounded-lg border border-red-100 bg-red-50 p-3 text-sm text-red-700">
              <AlertCircle size={16} /> {error}
            </div>
          )}

          <div>
            <label className="mb-1 block text-xs font-bold text-gray-700">อีเมล</label>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="w-full rounded-lg border border-gray-300 p-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500"
              autoComplete="email"
              required
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-bold text-gray-700">รหัสผ่าน</label>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="w-full rounded-lg border border-gray-300 p-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500"
              autoComplete="current-password"
              required
            />
          </div>

          <button
            type="submit"
            disabled={busy}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 py-2.5 font-bold text-white shadow-sm hover:bg-blue-700 disabled:opacity-60"
          >
            {busy ? <LoaderCircle className="animate-spin" size={16} /> : <LogIn size={16} />}
            {busy ? 'กำลังเข้าสู่ระบบ…' : 'เข้าสู่ระบบ'}
          </button>

          <div className="flex items-center gap-3 py-1">
            <span className="h-px flex-1 bg-gray-200" />
            <span className="text-[11px] font-medium text-gray-400">หรือ</span>
            <span className="h-px flex-1 bg-gray-200" />
          </div>

          {google.configured ? (
            <>
              <a
                href="/api/auth/google"
                className="flex w-full items-center justify-center gap-3 rounded-lg border border-gray-300 bg-white py-2.5 text-sm font-bold text-gray-700 shadow-sm hover:bg-gray-50"
              >
                <GoogleMark />
                เข้าสู่ระบบด้วย Google
              </a>
              <p className="text-center text-[11px] text-gray-400">
                {google.allowedDomain
                  ? `ใช้บัญชี @${google.allowedDomain} เท่านั้น`
                  : 'ใช้บัญชี Google ของคุณเพื่อเข้าสู่ระบบ'}
              </p>
            </>
          ) : (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-center">
              <button
                type="button"
                disabled
                className="flex w-full cursor-not-allowed items-center justify-center gap-3 rounded-lg border border-gray-200 bg-white py-2.5 text-sm font-bold text-gray-400"
              >
                {google.loading ? <LoaderCircle className="animate-spin" size={18} /> : <GoogleMark />}
                เข้าสู่ระบบด้วย Google
              </button>
              {!google.loading && (
                <p className="mt-2 text-[11px] leading-relaxed text-amber-700">
                  ผู้ดูแลระบบยังไม่ได้เชื่อม Google OAuth
                </p>
              )}
            </div>
          )}

        </form>
      </div>
    </div>
  );
}
