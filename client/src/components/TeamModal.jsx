import React, { useEffect, useState } from 'react';
import { Users, Trash2, KeyRound, ShieldCheck } from 'lucide-react';
import api from '../api/client.js';
import { Modal, ModalHeader, Avatar } from './ui.jsx';
import { ROLE_LABELS } from '../utils.js';
import { useAuth } from '../context/AuthContext.jsx';

const ROLE_OPTIONS = [
  ['pm', 'Project Manager'],
  ['creative', 'Creative / Art'],
  ['copywriter', 'Copywriter'],
  ['video', 'Video Editor'],
  ['ae', 'Account Executive'],
  ['admin', 'แอดมิน'],
];

export default function TeamModal({ open, onClose, onChanged }) {
  const { isAdmin } = useAuth();
  const [users, setUsers] = useState([]);
  const [form, setForm] = useState({ name: '', email: '', role: 'creative', password: '', capacityHoursPerDay: 8 });
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [passwordReset, setPasswordReset] = useState({ userId: null, value: '', error: '', busy: false });
  const [busy, setBusy] = useState(false);

  const load = async () => {
    const { users } = await api.users();
    setUsers(users);
  };
  useEffect(() => { if (open) load(); }, [open]);

  const add = async (e) => {
    e.preventDefault();
    setError(''); setNotice(''); setBusy(true);
    try {
      await api.createUser(form);
      setForm({ name: '', email: '', role: 'creative', password: '', capacityHoursPerDay: 8 });
      await load();
      onChanged?.();
    } catch (err) {
      setError(err.message);
    } finally { setBusy(false); }
  };

  const updateField = async (id, patch) => {
    await api.updateUser(id, patch).catch((e) => setError(e.message));
    await load();
    onChanged?.();
  };

  const remove = async (id) => {
    if (!confirm('ลบผู้ใช้นี้?')) return;
    await api.deleteUser(id).catch((e) => setError(e.message));
    await load();
    onChanged?.();
  };

  const resetPw = async (event) => {
    event.preventDefault();
    if (!passwordReset.userId || passwordReset.value.length < 6) return;
    setNotice('');
    setPasswordReset((current) => ({ ...current, error: '', busy: true }));
    try {
      await api.updateUser(passwordReset.userId, { password: passwordReset.value });
      await load();
      onChanged?.();
      setPasswordReset({ userId: null, value: '', error: '', busy: false });
      setNotice('ตั้งรหัสผ่านใหม่แล้ว สามารถใช้รหัสใหม่นี้เข้าสู่ระบบได้ทันที');
    } catch (err) {
      setPasswordReset((current) => ({
        ...current,
        error: err.message || 'ตั้งรหัสผ่านไม่สำเร็จ',
        busy: false,
      }));
    }
  };

  return (
    <Modal open={open} onClose={onClose} width="max-w-3xl">
      <ModalHeader title="จัดการทีม & ผู้ใช้งาน" icon={<Users size={18} className="text-blue-600" />} onClose={onClose} />
      <div className="flex flex-1 overflow-hidden">
        {/* add form (admin only) */}
        <div className="w-1/2 p-5 border-r border-gray-100 overflow-y-auto">
          <h3 className="text-sm font-bold text-gray-800 mb-3 flex items-center gap-2"><ShieldCheck size={15} /> เพิ่มผู้ใช้ (Admin)</h3>
          {!isAdmin ? (
            <p className="text-xs text-gray-400 bg-gray-50 p-3 rounded-lg">เฉพาะแอดมินเท่านั้นที่เพิ่ม/แก้ไขผู้ใช้ได้</p>
          ) : (
            <form onSubmit={add} className="space-y-3">
              {error && <p className="text-xs text-red-600 bg-red-50 p-2 rounded">{error}</p>}
              <div>
                <label className="block text-xs font-bold text-gray-600 mb-1">ชื่อ</label>
                <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required className="w-full p-2 border border-gray-300 rounded-lg text-sm" placeholder="เช่น สมชาย" />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-600 mb-1">อีเมล (ใช้ login)</label>
                <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required className="w-full p-2 border border-gray-300 rounded-lg text-sm" placeholder="user@wkwkp.com" />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-600 mb-1 flex items-center gap-1"><KeyRound size={12} /> รหัสผ่าน</label>
                <input type="password" minLength={6} autoComplete="new-password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} className="w-full p-2 border border-gray-300 rounded-lg text-sm" placeholder="อย่างน้อย 6 ตัว (เว้นว่าง = login ผ่าน Google เท่านั้น)" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-600 mb-1">บทบาท</label>
                  <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} className="w-full p-2 border border-gray-300 rounded-lg text-sm">
                    {ROLE_OPTIONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-600 mb-1">ชม.ทำงาน/วัน</label>
                  <input type="number" min="1" max="16" value={form.capacityHoursPerDay} onChange={(e) => setForm({ ...form, capacityHoursPerDay: Number(e.target.value) })} className="w-full p-2 border border-gray-300 rounded-lg text-sm" />
                </div>
              </div>
              <button type="submit" disabled={busy} className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg text-sm disabled:opacity-60">เพิ่มสมาชิก</button>
            </form>
          )}
        </div>

        {/* user list */}
        <div className="w-1/2 p-5 bg-gray-50 overflow-y-auto">
          <h3 className="text-sm font-bold text-gray-800 mb-3">สมาชิก ({users.length})</h3>
          {notice && <p role="status" className="mb-3 rounded-lg border border-emerald-200 bg-emerald-50 p-2 text-xs font-bold text-emerald-700">{notice}</p>}
          <div className="space-y-2">
            {users.map((u) => (
              <div key={u.id} className="bg-white p-3 rounded-lg border border-gray-200 shadow-sm">
                <div className="flex items-center gap-2">
                  <Avatar user={u} size={32} />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-gray-900 truncate">{u.name} {u.disabled && <span className="text-red-400">(ปิด)</span>}</p>
                    <p className="text-[10px] text-gray-500 truncate">{u.email}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    {u.hasGoogle && <span title="เชื่อม Google แล้ว" className="text-[9px] bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded font-bold">G</span>}
                    {u.hasPassword && <span title="มีรหัสผ่าน" className="text-[9px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded font-bold">PW</span>}
                  </div>
                </div>
                {isAdmin && (
                  <div className="flex items-center gap-2 mt-2 pt-2 border-t border-gray-100">
                    <select value={u.role} onChange={(e) => updateField(u.id, { role: e.target.value })} className="text-[11px] border border-gray-200 rounded px-1 py-0.5 flex-1">
                      {ROLE_OPTIONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                    </select>
                    <input type="number" min="1" max="16" defaultValue={u.capacityHoursPerDay}
                      onBlur={(e) => updateField(u.id, { capacityHoursPerDay: Number(e.target.value) })}
                      title="ชม./วัน" className="w-12 text-[11px] border border-gray-200 rounded px-1 py-0.5" />
                    <button
                      type="button"
                      onClick={() => {
                        setNotice('');
                        setPasswordReset({ userId: u.id, value: '', error: '', busy: false });
                      }}
                      title="ตั้งรหัสผ่าน"
                      aria-label={`ตั้งรหัสผ่านสำหรับ ${u.name}`}
                      className="p-1 text-gray-400 hover:text-blue-600"
                    >
                      <KeyRound size={14} />
                    </button>
                    <button onClick={() => remove(u.id)} title="ลบ" className="p-1 text-gray-400 hover:text-red-600"><Trash2 size={14} /></button>
                  </div>
                )}
                {isAdmin && passwordReset.userId === u.id && (
                  <form onSubmit={resetPw} className="mt-2 space-y-2 rounded-lg border border-blue-100 bg-blue-50 p-2">
                    <label className="block text-[10px] font-bold text-blue-800">รหัสผ่านใหม่สำหรับ {u.name}</label>
                    <input
                      type="password"
                      minLength={6}
                      required
                      autoComplete="new-password"
                      value={passwordReset.value}
                      onChange={(event) => setPasswordReset((current) => ({ ...current, value: event.target.value, error: '' }))}
                      className="w-full rounded-md border border-blue-200 bg-white px-2 py-1.5 text-xs outline-none focus:border-blue-500"
                      placeholder="อย่างน้อย 6 ตัว"
                    />
                    {passwordReset.error && <p role="alert" className="text-[10px] font-bold text-red-600">{passwordReset.error}</p>}
                    <div className="flex justify-end gap-1.5">
                      <button
                        type="button"
                        onClick={() => setPasswordReset({ userId: null, value: '', error: '', busy: false })}
                        className="rounded-md border border-gray-200 bg-white px-2 py-1 text-[10px] font-bold text-gray-600"
                      >
                        ยกเลิก
                      </button>
                      <button
                        type="submit"
                        disabled={passwordReset.busy || passwordReset.value.length < 6}
                        className="rounded-md bg-blue-600 px-2.5 py-1 text-[10px] font-bold text-white disabled:opacity-50"
                      >
                        {passwordReset.busy ? 'กำลังบันทึก…' : 'บันทึกรหัสผ่าน'}
                      </button>
                    </div>
                  </form>
                )}
                {!isAdmin && <p className="text-[10px] text-gray-400 mt-1">{ROLE_LABELS[u.role]} • {u.capacityHoursPerDay} ชม./วัน</p>}
              </div>
            ))}
          </div>
        </div>
      </div>

      {isAdmin && (
        <div className="px-6 py-3 border-t border-gray-100 bg-gray-50 flex items-center justify-between gap-2">
          <span className="text-[11px] text-gray-400">ระบบเตือนเดดไลน์อัตโนมัติส่งเข้าแชตส่วนตัวของผู้รับผิดชอบเท่านั้น ทุกวัน 10:00 น. (เวลาไทย, ล่วงหน้า 3 วัน)</span>
          <button
            onClick={async () => {
              const res = await api.runReminders().catch(() => ({ sent: 0 }));
              alert(`ส่งแจ้งเตือนเดดไลน์แล้ว ${res.sent} รายการ (แชตส่วนตัวของผู้รับผิดชอบเท่านั้น)`);
            }}
            className="text-xs font-bold text-blue-600 border border-blue-200 rounded-lg px-3 py-1.5 hover:bg-blue-50 shrink-0"
          >
            ทดสอบส่งเตือนตอนนี้
          </button>
        </div>
      )}
    </Modal>
  );
}
