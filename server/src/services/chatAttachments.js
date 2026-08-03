import path from 'node:path';

const MIME_BY_EXTENSION = {
  '.gif': ['image/gif'],
  '.jpg': ['image/jpeg'],
  '.jpeg': ['image/jpeg'],
  '.png': ['image/png'],
  '.webp': ['image/webp'],
  '.mp4': ['video/mp4'],
  '.webm': ['video/webm'],
  '.pdf': ['application/pdf'],
  '.doc': ['application/msword', 'application/octet-stream'],
  '.docx': ['application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/octet-stream'],
  '.txt': ['text/plain'],
  '.csv': ['text/csv', 'text/plain', 'application/vnd.ms-excel'],
  '.xls': ['application/vnd.ms-excel', 'application/octet-stream'],
  '.xlsx': ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/octet-stream'],
  '.zip': ['application/zip', 'application/x-zip-compressed', 'application/octet-stream'],
  '.ppt': ['application/vnd.ms-powerpoint', 'application/octet-stream'],
  '.pptx': ['application/vnd.openxmlformats-officedocument.presentationml.presentation', 'application/octet-stream'],
  '.rtf': ['application/rtf', 'text/rtf', 'application/octet-stream'],
  '.mp3': ['audio/mpeg'],
  '.m4a': ['audio/mp4', 'audio/x-m4a'],
  '.wav': ['audio/wav', 'audio/x-wav'],
};

const CATEGORY_BY_EXTENSION = {
  '.gif': 'image', '.jpg': 'image', '.jpeg': 'image', '.png': 'image', '.webp': 'image',
  '.mp4': 'video', '.webm': 'video',
  '.pdf': 'document', '.doc': 'document', '.docx': 'document', '.txt': 'document',
  '.csv': 'spreadsheet', '.xls': 'spreadsheet', '.xlsx': 'spreadsheet',
  '.zip': 'archive',
  '.ppt': 'file', '.pptx': 'file', '.rtf': 'file',
  '.mp3': 'file', '.m4a': 'file', '.wav': 'file',
};

const DATA_URL_RE = /^data:([^;,]+);base64,([a-z0-9+/=\s]+)$/i;

export function chatAttachmentRules() {
  return {
    extensions: Object.keys(MIME_BY_EXTENSION),
    mimeByExtension: MIME_BY_EXTENSION,
  };
}

export function validateChatAttachment(attachment, maxBytes) {
  if (attachment == null) return null;
  if (!attachment || typeof attachment !== 'object' || Array.isArray(attachment))
    throw new Error('invalid attachment');

  const name = path.basename(String(attachment.name || '')).replace(/[\r\n"]/g, '_').slice(0, 160);
  const extension = path.extname(name).toLowerCase();
  const allowedMimes = MIME_BY_EXTENSION[extension];
  if (!name || !allowedMimes) throw new Error('file type not allowed');

  const url = String(attachment.url || '');
  const match = url.match(DATA_URL_RE);
  if (!match) throw new Error('attachment must be a base64 data URL');
  const mime = match[1].toLowerCase();
  if (!allowedMimes.includes(mime)) throw new Error('file extension and MIME type do not match');

  const base64 = match[2].replace(/\s/g, '');
  if (base64.length % 4 !== 0) throw new Error('invalid attachment data');
  const bytes = Buffer.from(base64, 'base64');
  if (bytes.length === 0 || bytes.toString('base64').replace(/=+$/, '') !== base64.replace(/=+$/, ''))
    throw new Error('invalid attachment data');
  if (bytes.length > maxBytes) throw new Error(`attachment exceeds ${maxBytes} bytes`);

  return {
    name,
    type: mime,
    size: bytes.length,
    category: CATEGORY_BY_EXTENSION[extension],
    url: `data:${mime};base64,${base64}`,
  };
}

