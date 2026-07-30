import React, { useEffect, useRef, useState } from 'react';
import { CheckCircle2, LoaderCircle, XCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

const ERRORS = {
  google_not_configured: 'ระบบยังไม่ได้ตั้งค่า Google Login',
  domain_not_allowed: 'บัญชีนี้อยู่นอกโดเมนที่องค์กรอนุญาต',
  oauth_failed: 'เชื่อมต่อ Google ไม่สำเร็จ กรุณาลองใหม่',
  no_code: 'Google ไม่ได้ส่งรหัสยืนยันกลับมา',
  invalid_state: 'คำขอเข้าสู่ระบบหมดอายุหรือไม่ปลอดภัย กรุณาเริ่มใหม่',
  email_not_verified: 'อีเมล Google นี้ยังไม่ได้รับการยืนยัน',
  account_disabled: 'บัญชีนี้ถูกปิดใช้งาน',
  account_mismatch: 'อีเมล Google ไม่ตรงกับบัญชีที่กำลังเชื่อมต่อ',
  google_account_conflict: 'บัญชีระบบนี้เชื่อมกับ Google บัญชีอื่นแล้ว',
  access_denied: 'ยกเลิกการเข้าสู่ระบบด้วย Google',
};

export default function AuthCallback() {
  const navigate = useNavigate();
  const { loginWithGoogleCode } = useAuth();
  const [state, setState] = useState({ type: 'loading', message: 'กำลังตรวจสอบบัญชี Google…' });
  const done = useRef(false);

  useEffect(() => {
    if (done.current) return;
    done.current = true;

    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    const error = params.get('error');
    window.history.replaceState({}, document.title, '/auth/callback');

    if (error) {
      setState({ type: 'error', message: ERRORS[error] || `เกิดข้อผิดพลาด: ${error}` });
      return;
    }
    if (!code) {
      setState({ type: 'error', message: 'ไม่พบรหัสเข้าสู่ระบบ กรุณาเริ่มใหม่' });
      return;
    }

    loginWithGoogleCode(code)
      .then(() => {
        setState({ type: 'success', message: 'เข้าสู่ระบบสำเร็จ' });
        setTimeout(() => navigate('/', { replace: true }), 350);
      })
      .catch((err) => {
        setState({ type: 'error', message: err.message || 'รหัสเข้าสู่ระบบหมดอายุ กรุณาลองใหม่' });
      });
  }, [navigate, loginWithGoogleCode]);

  const Icon = state.type === 'loading'
    ? LoaderCircle
    : state.type === 'success'
      ? CheckCircle2
      : XCircle;

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-xl">
        <Icon
          size={34}
          className={`mx-auto mb-4 ${
            state.type === 'loading'
              ? 'animate-spin text-blue-600'
              : state.type === 'success'
                ? 'text-emerald-500'
                : 'text-red-500'
          }`}
        />
        <h1 className="text-lg font-bold text-slate-900">Google Login</h1>
        <p className="mt-2 text-sm text-slate-500">{state.message}</p>
        {state.type === 'error' && (
          <button
            type="button"
            onClick={() => navigate('/login', { replace: true })}
            className="mt-5 w-full rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-bold text-white hover:bg-slate-800"
          >
            กลับหน้าเข้าสู่ระบบ
          </button>
        )}
      </div>
    </div>
  );
}
