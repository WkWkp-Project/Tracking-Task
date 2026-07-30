// Tiny persistent JSON document store.
// No native modules -> installs & runs anywhere Node 18+ is available.
// Data is written atomically to server/data/db.json on every mutation.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, '..', 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');

const EMPTY = {
  users: [],
  projects: [],
  tasks: [],
  drafts: [],
  attachments: [],
  taskUpdates: [],    // task notes/comments with optional file attachment
  messages: [],     // chat (dm / task / project channels)
  notifications: [],
  timeLogs: [],      // individual hour entries logged against a task/draft
  aeTasks: [],       // Account-Executive spreadsheet rows (flat, single deadline)
  brands: [],        // shared brand registry — canonical names linking PM + AE work
  groups: [],        // chat groups: { id, name, memberIds[], createdBy, createdAt }
  meta: { version: 1 },
};

function ensureDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

function load() {
  ensureDir();
  if (!fs.existsSync(DB_FILE)) {
    fs.writeFileSync(DB_FILE, JSON.stringify(EMPTY, null, 2));
    return structuredClone(EMPTY);
  }
  try {
    const raw = fs.readFileSync(DB_FILE, 'utf8');
    const parsed = JSON.parse(raw || '{}');
    // make sure every collection exists even if file is from an older version
    return { ...structuredClone(EMPTY), ...parsed };
  } catch (err) {
    console.error('[db] failed to parse db.json, starting fresh:', err.message);
    return structuredClone(EMPTY);
  }
}

const state = load();

let saveTimer = null;
function persist() {
  // debounce rapid writes, but always flush within 50ms
  if (saveTimer) return;
  saveTimer = setTimeout(() => {
    saveTimer = null;
    try {
      ensureDir();
      const tmp = DB_FILE + '.tmp';
      fs.writeFileSync(tmp, JSON.stringify(state, null, 2));
      fs.renameSync(tmp, DB_FILE); // atomic on same volume
    } catch (err) {
      console.error('[db] persist error:', err.message);
    }
  }, 50);
}

// Flush synchronously (used on shutdown)
export function flush() {
  if (saveTimer) {
    clearTimeout(saveTimer);
    saveTimer = null;
  }
  ensureDir();
  fs.writeFileSync(DB_FILE, JSON.stringify(state, null, 2));
}

/**
 * Collection helper – thin wrapper around an array in `state`.
 */
class Collection {
  constructor(name) {
    this.name = name;
  }
  get _arr() {
    return state[this.name];
  }
  all() {
    return this._arr;
  }
  find(predicate) {
    return this._arr.filter(predicate);
  }
  findOne(predicate) {
    return this._arr.find(predicate) || null;
  }
  byId(id) {
    return this._arr.find((r) => r.id === id) || null;
  }
  insert(doc) {
    this._arr.push(doc);
    persist();
    return doc;
  }
  update(id, patch) {
    const row = this.byId(id);
    if (!row) return null;
    Object.assign(row, patch, { updatedAt: new Date().toISOString() });
    persist();
    return row;
  }
  remove(id) {
    const idx = this._arr.findIndex((r) => r.id === id);
    if (idx === -1) return false;
    this._arr.splice(idx, 1);
    persist();
    return true;
  }
  removeWhere(predicate) {
    const before = this._arr.length;
    state[this.name] = this._arr.filter((r) => !predicate(r));
    persist();
    return before - state[this.name].length;
  }
}

export const db = {
  users: new Collection('users'),
  projects: new Collection('projects'),
  tasks: new Collection('tasks'),
  drafts: new Collection('drafts'),
  attachments: new Collection('attachments'),
  taskUpdates: new Collection('taskUpdates'),
  messages: new Collection('messages'),
  notifications: new Collection('notifications'),
  timeLogs: new Collection('timeLogs'),
  aeTasks: new Collection('aeTasks'),
  brands: new Collection('brands'),
  groups: new Collection('groups'),
  raw: state,
  persist,
  flush,
};

export default db;
