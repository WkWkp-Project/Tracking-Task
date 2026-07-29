import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LayoutDashboard, LogIn, AlertCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import api from '../api/client.js';

export default function Login() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('admin@wkwkp.com');
  const [password, setPassword] = useState('admin1234');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [google, setGoogle] = useState({ configured: false, allowedDomain: null });

  useEffect(() => {
    if (user) navigate('/', { replace: true });
  }, [user, navigate]);
  useEffect(() => {
    api.googleStatus().then(setGoogle).catch(() => {});
  }, []);

  const submit = async (e) => {
    e.preventDefault();
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
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-600 to-indigo-700 p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden">
        <div className="bg-blue-600 px-8 py-6 flex items-center gap-3">
          <LayoutDashboard className="text-white" size={26} />
          <div>
            <h1 className="text-xl font-bold text-white">PM Hub</h1>
            <p className="text-blue-100 text-xs">Workspace สำหรับทีมครีเอทีฟ</p>
          </div>
        </div>

        <form onSubmit={submit} className="p-8 space-y-4">
          {error && (
            <div className="flex items-center gap-2 bg-red-50 text-red-700 text-sm p-3 rounded-lg border border-red-100">
              <AlertCircle size={16} /> {error}
            </div>
          )}
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">อีเมล</label>
            <input
              type="email" value={email} onChange={(e) => setEmail(e.target.value)}
              className="w-full p-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              required
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">รหัสผ่าน</label>
            <input
              type="password" value={password} onChange={(e) => setPassword(e.target.value)}
              className="w-full p-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              required
            />
          </div>
          <button
            type="submit" disabled={busy}
            className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-bold rounded-lg flex items-center justify-center gap-2 shadow-sm"
          >
            <LogIn size={16} /> {busy ? 'กำลังเข้าสู่ระบบ…' : 'เข้าสู่ระบบ'}
          </button>

          {google.configured ? (
            <a
              href="/api/auth/google"
              className="w-full py-2.5 border border-gray-300 rounded-lg flex items-center justify-center gap-2 text-sm font-bold text-gray-700 hover:bg-gray-50"
            >
              <img src="https://www.google.com/favicon.ico" alt="" className="w-4 h-4" />
              เข้าสู่ระบบด้วย Google {google.allowedDomain ? `(@${google.allowedDomain})` : ''}
            </a>
          ) : (
            <p className="text-[11px] text-center text-gray-400">
              * Google login ยังไม่ถูกตั้งค่า — ใส่ credential ใน <code>server/.env</code> เพื่อเปิดใช้
            </p>
          )}

          <div className="text-[11px] text-gray-400 bg-gray-50 rounded-lg p-3 border border-gray-100">
            <p className="font-bold text-gray-500 mb-1">บัญชีทดสอบ</p>
            admin@wkwkp.com / admin1234 (แอดมิน)<br />
            jira.pm@wkwkp.com / password123 (PM)<br />
            art.a@wkwkp.com / password123 (Creative)
          </div>
        </form>
      </div>
    </div>
  );
}
