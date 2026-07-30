import React, { useState } from 'react';
import { LayoutDashboard, LogOut, Check } from 'lucide-react';
import api from '../api/client.js';
import { setToken } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import { SELF_ROLE_OPTIONS } from '../utils.js';

// Blocks the whole app for accounts that were self-provisioned (first Google
// login) and haven't confirmed a real role yet — see server roleConfirmed.
export default function RoleSelect() {
  const { user, refreshUser, logout } = useAuth();
  const [picked, setPicked] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const confirm = async () => {
    if (!picked) return;
    setBusy(true); setError('');
    try {
      const { token } = await api.setRole(picked);
      setToken(token);
      await refreshUser();
    } catch (e) {
      setError(e.message);
    } finally { setBusy(false); }
  };

  return (
    <div className="h-screen bg-gray-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden">
        <div className="px-6 py-5 bg-sidebar text-white">
          <div className="flex items-center gap-2">
            <LayoutDashboard size={20} className="text-primary" />
            <h1 className="text-lg font-bold font-poppins tracking-wide">ยินดีต้อนรับสู่ Tracking Task</h1>
          </div>
          <p className="text-xs text-sidebar-text mt-1">
            สวัสดี {user?.name} — ก่อนใช้งาน กรุณาเลือกบทบาทของคุณ เพื่อให้ระบบจัดหน้าจอ/สิทธิ์การใช้งานให้เหมาะสม
          </p>
        </div>

        <div className="p-5 space-y-2">
          {error && <p className="text-xs text-red-600 bg-red-50 p-2 rounded">{error}</p>}
          {SELF_ROLE_OPTIONS.map((r) => (
            <button
              key={r.key}
              onClick={() => setPicked(r.key)}
              className={`w-full text-left px-4 py-3 rounded-xl border flex items-center justify-between gap-3 transition-colors ${
                picked === r.key ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:bg-gray-50'
              }`}
            >
              <div>
                <p className={`text-sm font-bold ${picked === r.key ? 'text-blue-700' : 'text-gray-800'}`}>{r.label}</p>
                <p className="text-[11px] text-gray-500 mt-0.5">{r.hint}</p>
              </div>
              {picked === r.key && <Check size={18} className="text-blue-600 shrink-0" />}
            </button>
          ))}
        </div>

        <div className="px-5 pb-5 flex items-center gap-2">
          <button onClick={logout} className="flex items-center gap-1.5 px-3 py-2.5 text-xs font-bold text-gray-500 hover:text-red-500">
            <LogOut size={14} /> ออกจากระบบ
          </button>
          <button
            onClick={confirm}
            disabled={!picked || busy}
            className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold rounded-lg text-sm"
          >
            {busy ? 'กำลังบันทึก…' : 'ยืนยันบทบาทนี้'}
          </button>
        </div>
      </div>
    </div>
  );
}
