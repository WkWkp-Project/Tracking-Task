import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

const ERRORS = {
  google_not_configured: 'ระบบยังไม่ได้ตั้งค่า Google',
  domain_not_allowed: 'อนุญาตเฉพาะอีเมลในโดเมนที่กำหนดเท่านั้น',
  oauth_failed: 'เชื่อมต่อ Google ไม่สำเร็จ',
  no_code: 'ไม่ได้รับ authorization code',
};

export default function AuthCallback() {
  const navigate = useNavigate();
  const { loginWithToken } = useAuth();
  const [msg, setMsg] = useState('กำลังเชื่อมต่อ Google…');
  const done = useRef(false);

  useEffect(() => {
    if (done.current) return;
    done.current = true;
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');
    const error = params.get('error');
    if (error) {
      setMsg(ERRORS[error] || `เกิดข้อผิดพลาด: ${error}`);
      setTimeout(() => navigate('/login', { replace: true }), 2500);
      return;
    }
    if (token) {
      loginWithToken(token)
        .then(() => navigate('/', { replace: true }))
        .catch(() => navigate('/login', { replace: true }));
    } else {
      navigate('/login', { replace: true });
    }
  }, [navigate, loginWithToken]);

  return (
    <div className="h-screen flex items-center justify-center text-gray-500 text-sm">{msg}</div>
  );
}
