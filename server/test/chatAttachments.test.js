import test from 'node:test';
import assert from 'node:assert/strict';
import { validateChatAttachment } from '../src/services/chatAttachments.js';
import {
  attachmentCategory,
  CHAT_ATTACHMENT_ACCEPT,
  validateChatFile,
} from '../../client/src/chatAttachments.js';

function attachment(name, type, content = 'safe test file') {
  return {
    name,
    type,
    url: `data:${type};base64,${Buffer.from(content).toString('base64')}`,
  };
}

test('server accepts supported document, spreadsheet, image, video, and ZIP attachments', () => {
  const samples = [
    ['photo.png', 'image/png', 'image'],
    ['clip.mp4', 'video/mp4', 'video'],
    ['brief.pdf', 'application/pdf', 'document'],
    ['plan.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'spreadsheet'],
    ['bundle.zip', 'application/zip', 'archive'],
  ];
  for (const [name, type, category] of samples) {
    const result = validateChatAttachment(attachment(name, type), 1024);
    assert.equal(result.category, category);
    assert.equal(result.type, type);
    assert.ok(result.size > 0);
  }
});

test('server rejects executable, script, MIME-mismatched, remote, and oversized attachments', () => {
  assert.throws(() => validateChatAttachment(attachment('run.exe', 'application/octet-stream'), 1024), /not allowed/);
  assert.throws(() => validateChatAttachment(attachment('page.html', 'text/html'), 1024), /not allowed/);
  assert.throws(() => validateChatAttachment(attachment('fake.pdf', 'image/png'), 1024), /do not match/);
  assert.throws(() => validateChatAttachment({ name: 'brief.pdf', type: 'application/pdf', url: 'https://example.com/file.pdf' }, 1024), /base64 data URL/);
  assert.throws(() => validateChatAttachment(attachment('large.txt', 'text/plain', '12345'), 4), /exceeds/);
});

test('ZIP archives are download-only and client rules match core server categories', () => {
  assert.match(CHAT_ATTACHMENT_ACCEPT, /\.zip/);
  assert.equal(validateChatFile({ name: 'bundle.zip', type: 'application/zip', size: 100 }).category, 'archive');
  assert.equal(attachmentCategory({ name: 'bundle.zip' }), 'archive');
  assert.throws(
    () => validateChatFile({ name: 'bundle.zip', type: 'text/html', size: 100 }),
    /MIME/
  );
});

