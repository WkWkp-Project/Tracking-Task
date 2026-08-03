import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CHAT_EMOJIS,
  EMOJI_CATEGORIES,
  directGifUrl,
  isGifAttachment,
  normalizeEmoticonsForDisplay,
  searchEmojiCategories,
} from '../../client/src/chatFormatting.js';

test('curated emoji picker has a useful dependency-free set', () => {
  assert.ok(CHAT_EMOJIS.length >= 20);
  assert.ok(CHAT_EMOJIS.includes('😀'));
  assert.ok(CHAT_EMOJIS.includes('❤️'));
  assert.equal(new Set(CHAT_EMOJIS).size, CHAT_EMOJIS.length);
});

test('full local Unicode picker exposes categories, flags, and category search', () => {
  const all = new Set(EMOJI_CATEGORIES.flatMap((category) => category.emojis));
  assert.ok(all.size > 1000);
  assert.ok(EMOJI_CATEGORIES.length >= 8);
  assert.ok(EMOJI_CATEGORIES.find((category) => category.id === 'flags').emojis.includes('🇹🇭'));
  assert.ok(searchEmojiCategories('food').includes('🍜'));
  assert.deepEqual(searchEmojiCategories('', 'recent'), CHAT_EMOJIS);
});

test('typed emoticons normalize for display without touching surrounding text', () => {
  const stored = 'Great job :) <3';
  assert.equal(normalizeEmoticonsForDisplay(stored), 'Great job 🙂 ❤️');
  assert.equal(stored, 'Great job :) <3');
  assert.equal(
    normalizeEmoticonsForDisplay('https://example.com/a:)'),
    'https://example.com/a:)'
  );
});

test('only direct HTTP GIF URLs receive inline previews', () => {
  assert.equal(
    directGifUrl('https://cdn.example.com/reaction.gif?size=large'),
    'https://cdn.example.com/reaction.gif?size=large'
  );
  assert.equal(directGifUrl('https://cdn.example.com/reaction.png'), null);
  assert.equal(directGifUrl('javascript:alert(1).gif'), null);
  assert.equal(directGifUrl('look https://cdn.example.com/reaction.gif'), null);
});

test('uploaded GIF attachments are detected from safe existing metadata', () => {
  assert.equal(isGifAttachment({ name: 'reaction.gif', type: 'file', url: '' }), true);
  assert.equal(isGifAttachment({ name: 'image', type: 'image/gif', url: '' }), true);
  assert.equal(isGifAttachment({ name: 'image', type: '', url: 'data:image/gif;base64,abc' }), true);
  assert.equal(isGifAttachment({ name: 'photo.png', type: 'image/png', url: '' }), false);
});
