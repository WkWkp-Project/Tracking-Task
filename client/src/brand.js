import api from './api/client.js';
import { nameSimilarity } from './utils.js';

const MATCH_THRESHOLD = 0.85;

// Resolves a typed brand/project name against the shared brand registry.
// - exact match (case-insensitive) -> silently reuse the canonical spelling
// - >=85% similar to an existing brand -> ask the user to confirm it's the same brand
// - otherwise -> register it as a new brand
// Returns the name to actually save on the project/task.
export async function resolveBrandName(rawName, brands) {
  const typed = (rawName || '').trim();
  if (!typed) return typed;

  const exact = brands.find((b) => b.name.toLowerCase() === typed.toLowerCase());
  if (exact) return exact.name;

  let best = null;
  let bestScore = 0;
  for (const b of brands) {
    const score = nameSimilarity(typed, b.name);
    if (score > bestScore) { bestScore = score; best = b; }
  }

  if (best && bestScore >= MATCH_THRESHOLD) {
    const pct = Math.round(bestScore * 100);
    const sameBrand = window.confirm(
      `ชื่อ "${typed}" ใกล้เคียงกับแบรนด์ที่มีอยู่แล้ว "${best.name}" (${pct}%)\n\n` +
      `เป็นแบรนด์เดียวกันหรือไม่?\n\n` +
      `ตกลง = ใช่ ใช้แบรนด์ "${best.name}" (เชื่อมกับงานอื่นที่แบรนด์นี้)\n` +
      `ยกเลิก = ไม่ใช่ สร้างแบรนด์ใหม่ "${typed}"`
    );
    if (sameBrand) return best.name;
  }

  try { await api.createBrand({ name: typed }); } catch { /* non-fatal — the field still saves the typed name */ }
  return typed;
}
