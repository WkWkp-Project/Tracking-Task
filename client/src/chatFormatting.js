export const CHAT_EMOJIS = [
  '😀', '😄', '😂', '😊', '😍', '🥳', '😎', '🤔',
  '😅', '😢', '😭', '😡', '👍', '👏', '🙏', '💪',
  '❤️', '🔥', '✨', '🎉', '✅', '⚠️', '👀', '💡',
];

const emojiPresentation = /\p{Emoji_Presentation}/u;
const makeRange = (start, end) => {
  const result = [];
  for (let codePoint = start; codePoint <= end; codePoint += 1) {
    const value = String.fromCodePoint(codePoint);
    if (emojiPresentation.test(value)) result.push(value);
  }
  return result;
};
const unique = (values) => [...new Set(values)];
const flags = [];
for (let first = 0x1f1e6; first <= 0x1f1ff; first += 1) {
  for (let second = 0x1f1e6; second <= 0x1f1ff; second += 1) {
    flags.push(String.fromCodePoint(first, second));
  }
}

// Generated from Unicode emoji properties at runtime, then grouped locally.
// No catalogue/API request is made by the chat UI.
export const EMOJI_CATEGORIES = [
  { id: 'recent', label: 'แนะนำ', icon: '😀', keywords: 'smile emotion face', emojis: CHAT_EMOJIS },
  { id: 'people', label: 'คน', icon: '👋', keywords: 'people body hand gesture', emojis: unique([...makeRange(0x1f440, 0x1f64f), ...makeRange(0x1f90c, 0x1f9dd), ...makeRange(0x1faf0, 0x1faff)]) },
  { id: 'nature', label: 'ธรรมชาติ', icon: '🐻', keywords: 'animal nature weather plant', emojis: unique([...makeRange(0x1f300, 0x1f32c), ...makeRange(0x1f400, 0x1f43f), ...makeRange(0x1f980, 0x1f9ae), ...makeRange(0x1fab0, 0x1fabe)]) },
  { id: 'food', label: 'อาหาร', icon: '🍜', keywords: 'food drink fruit meal', emojis: unique([...makeRange(0x1f32d, 0x1f37f), ...makeRange(0x1f950, 0x1f97f), ...makeRange(0x1fad0, 0x1fadf)]) },
  { id: 'activities', label: 'กิจกรรม', icon: '⚽', keywords: 'activity sport celebration game', emojis: unique([...makeRange(0x1f380, 0x1f3ff), ...makeRange(0x1f93a, 0x1f94f)]) },
  { id: 'travel', label: 'เดินทาง', icon: '🚗', keywords: 'travel place transport vehicle', emojis: makeRange(0x1f680, 0x1f6ff) },
  { id: 'objects', label: 'สิ่งของ', icon: '💡', keywords: 'object tool office technology', emojis: unique([...makeRange(0x1f4a0, 0x1f5ff), ...makeRange(0x1f9e0, 0x1f9ff)]) },
  { id: 'symbols', label: 'สัญลักษณ์', icon: '❤️', keywords: 'symbol heart arrow warning', emojis: unique([...makeRange(0x2300, 0x27ff), ...makeRange(0x1f7e0, 0x1f7ff), '❤️', '♥️', '☑️', '✳️', '❇️']) },
  { id: 'flags', label: 'ธง', icon: '🏳️', keywords: 'flag country', emojis: unique(['🏳️', '🏴', '🏁', '🚩', ...flags]) },
];

export function searchEmojiCategories(query, categoryId = 'recent') {
  const normalized = String(query || '').trim().toLowerCase();
  const categories = normalized
    ? EMOJI_CATEGORIES.filter((category) =>
        `${category.label} ${category.keywords} ${category.id}`.toLowerCase().includes(normalized) ||
        category.emojis.includes(normalized)
      )
    : EMOJI_CATEGORIES.filter((category) => category.id === categoryId);
  return unique(categories.flatMap((category) => category.emojis));
}

const EMOTICONS = new Map([
  [':)', '🙂'],
  [':-)', '🙂'],
  [':(', '☹️'],
  [':-(', '☹️'],
  [';)', '😉'],
  [';-)', '😉'],
  [':D', '😄'],
  [':-D', '😄'],
  [':P', '😛'],
  [':-P', '😛'],
  ['<3', '❤️'],
]);

// Display-only normalization: the stored message body remains untouched.
export function normalizeEmoticonsForDisplay(value) {
  return String(value || '')
    .split(/(\s+)/)
    .map((token) => {
      const match = token.match(/^(.+?)([,.!?]*)$/);
      if (!match) return token;
      const normalized = EMOTICONS.get(match[1]);
      return normalized ? `${normalized}${match[2]}` : token;
    })
    .join('');
}

export function directGifUrl(value) {
  const candidate = String(value || '').trim();
  if (!candidate || candidate.length > 2048 || /\s/.test(candidate)) return null;
  try {
    const url = new URL(candidate);
    if (!['http:', 'https:'].includes(url.protocol)) return null;
    return url.pathname.toLowerCase().endsWith('.gif') ? url.href : null;
  } catch {
    return null;
  }
}

export function isGifAttachment(attachment) {
  if (!attachment) return false;
  const type = String(attachment.type || '').toLowerCase();
  const name = String(attachment.name || '').toLowerCase();
  const url = String(attachment.url || '').toLowerCase();
  return type === 'image/gif' || name.endsWith('.gif') || url.startsWith('data:image/gif');
}
