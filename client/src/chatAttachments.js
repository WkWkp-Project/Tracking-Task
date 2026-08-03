export const DEFAULT_CHAT_ATTACHMENT_MAX_BYTES = 5 * 1024 * 1024;

const RULES = {
  gif: { category: 'image', mimes: ['image/gif'] },
  jpg: { category: 'image', mimes: ['image/jpeg'] },
  jpeg: { category: 'image', mimes: ['image/jpeg'] },
  png: { category: 'image', mimes: ['image/png'] },
  webp: { category: 'image', mimes: ['image/webp'] },
  mp4: { category: 'video', mimes: ['video/mp4'] },
  webm: { category: 'video', mimes: ['video/webm'] },
  pdf: { category: 'document', mimes: ['application/pdf'] },
  doc: { category: 'document', mimes: ['application/msword', 'application/octet-stream'] },
  docx: { category: 'document', mimes: ['application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/octet-stream'] },
  txt: { category: 'document', mimes: ['text/plain'] },
  csv: { category: 'spreadsheet', mimes: ['text/csv', 'text/plain', 'application/vnd.ms-excel'] },
  xls: { category: 'spreadsheet', mimes: ['application/vnd.ms-excel', 'application/octet-stream'] },
  xlsx: { category: 'spreadsheet', mimes: ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/octet-stream'] },
  zip: { category: 'archive', mimes: ['application/zip', 'application/x-zip-compressed', 'application/octet-stream'] },
  ppt: { category: 'file', mimes: ['application/vnd.ms-powerpoint', 'application/octet-stream'] },
  pptx: { category: 'file', mimes: ['application/vnd.openxmlformats-officedocument.presentationml.presentation', 'application/octet-stream'] },
  rtf: { category: 'file', mimes: ['application/rtf', 'text/rtf', 'application/octet-stream'] },
  mp3: { category: 'file', mimes: ['audio/mpeg'] },
  m4a: { category: 'file', mimes: ['audio/mp4', 'audio/x-m4a'] },
  wav: { category: 'file', mimes: ['audio/wav', 'audio/x-wav'] },
};

export const CHAT_ATTACHMENT_ACCEPT = Object.keys(RULES).map((extension) => `.${extension}`).join(',');

export function validateChatFile(file, maxBytes = DEFAULT_CHAT_ATTACHMENT_MAX_BYTES) {
  if (!file) throw new Error('ไม่พบไฟล์');
  const name = String(file.name || '');
  const extension = name.includes('.') ? name.split('.').pop().toLowerCase() : '';
  const rule = RULES[extension];
  if (!rule) throw new Error('ไม่รองรับไฟล์ประเภทนี้');
  const mime = String(file.type || '').toLowerCase();
  if (!rule.mimes.includes(mime)) throw new Error('นามสกุลไฟล์และชนิด MIME ไม่ตรงกัน');
  if (!Number.isFinite(file.size) || file.size <= 0) throw new Error('ไฟล์ว่างหรือขนาดไม่ถูกต้อง');
  if (file.size > maxBytes) throw new Error(`ไฟล์ต้องมีขนาดไม่เกิน ${Math.ceil(maxBytes / 1024 / 1024)} MB`);
  return { name, type: mime, size: file.size, category: rule.category };
}

export function attachmentCategory(attachment) {
  if (!attachment) return null;
  if (['image', 'video', 'document', 'spreadsheet', 'archive', 'file'].includes(attachment.category))
    return attachment.category;
  const extension = String(attachment.name || '').split('.').pop().toLowerCase();
  return RULES[extension]?.category || 'file';
}

