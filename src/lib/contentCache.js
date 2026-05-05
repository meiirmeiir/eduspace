/**
 * contentCache.js
 * In-memory cache for static content collections (read-only for students).
 * TTL: 10 minutes. Cache is cleared on page reload.
 * Admin screens bypass this cache and use getDocs() directly.
 */

import { getDocs, collection, db } from '../firestore-rest.js';

const TTL_MS = 10 * 60 * 1000; // 10 minutes

const _cache = {};
// _cache[name] = { promise: Promise<item[]>, fetchedAt: timestamp }

export async function getContent(collectionName) {
  const now = Date.now();
  const entry = _cache[collectionName];

  // Return cached promise if still fresh
  if (entry && (now - entry.fetchedAt) < TTL_MS) {
    return entry.promise;
  }

  // Fetch and store promise (deduplicates parallel calls during inflight)
  const promise = getDocs(collection(db, collectionName))
    .then(snap => {
      const items = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      console.log('[contentCache] loaded:', collectionName, items.length);
      return items;
    })
    .catch(err => {
      // On error — evict so next call retries
      delete _cache[collectionName];
      throw err;
    });

  _cache[collectionName] = { promise, fetchedAt: now };
  return promise;
}

/** Manually invalidate one or all collections (e.g. after admin edit) */
export function invalidateContent(collectionName) {
  if (collectionName) {
    delete _cache[collectionName];
  } else {
    Object.keys(_cache).forEach(k => delete _cache[k]);
  }
}
