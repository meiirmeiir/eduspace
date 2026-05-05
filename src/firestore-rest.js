/**
 * Firestore REST wrapper — заменяет Firebase SDK.
 * Все операции идут через REST API (не WebChannel/gRPC).
 */

const getKey = () => import.meta.env.VITE_FIREBASE_API_KEY;
const getProject = () => import.meta.env.VITE_FIREBASE_PROJECT_ID;
const BASE = () =>
  `https://firestore.googleapis.com/v1/projects/${getProject()}/databases/(default)/documents`;

// Кодируем каждый сегмент пути (особенно важно для + в номерах телефонов)
function encodeFsPath(path) {
  return path.split('/').map(encodeURIComponent).join('/');
}

// ── Конвертация JS → Firestore value ─────────────────────────────────────────

function toFsValue(v) {
  if (v === null || v === undefined) return { nullValue: null };
  if (typeof v === 'boolean') return { booleanValue: v };
  if (typeof v === 'number')
    return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
  if (typeof v === 'string') return { stringValue: v };
  if (v instanceof Date) return { timestampValue: v.toISOString() };
  if (Array.isArray(v)) return { arrayValue: { values: v.map(toFsValue) } };
  if (typeof v === 'object') return { mapValue: { fields: toFsFields(v) } };
  return { stringValue: String(v) };
}

function toFsFields(obj) {
  return Object.fromEntries(
    Object.entries(obj).map(([k, v]) => [k, toFsValue(v)])
  );
}

// ── Конвертация Firestore value → JS ─────────────────────────────────────────

function fromFsValue(v) {
  if ('nullValue' in v) return null;
  if ('booleanValue' in v) return v.booleanValue;
  if ('integerValue' in v) return Number(v.integerValue);
  if ('doubleValue' in v) return v.doubleValue;
  if ('stringValue' in v) return v.stringValue;
  if ('timestampValue' in v) return v.timestampValue;
  if ('arrayValue' in v) return (v.arrayValue.values || []).map(fromFsValue);
  if ('mapValue' in v) return fromFsFields(v.mapValue.fields || {});
  return null;
}

function fromFsFields(fields) {
  return Object.fromEntries(
    Object.entries(fields).map(([k, v]) => [k, fromFsValue(v)])
  );
}

// ── DocumentSnapshot ──────────────────────────────────────────────────────────

function makeSnap(fsDoc) {
  const pathParts = (fsDoc?.name || '').split('/');
  const id = decodeURIComponent(pathParts[pathParts.length - 1]);
  const _data = fromFsFields(fsDoc?.fields || {});
  return {
    id,
    exists: () => !!fsDoc?.name,
    data: () => _data,
    get: (field) => _data[field],
  };
}

function makeEmptySnap(id) {
  return { id, exists: () => false, data: () => null, get: () => undefined };
}

// ── QuerySnapshot ─────────────────────────────────────────────────────────────

function makeQuerySnap(fsDocs) {
  const docs = (fsDocs || [])
    .filter(d => d.document?.name || d.name)
    .map(d => makeSnap(d.document || d));
  return {
    docs,
    empty: docs.length === 0,
    size: docs.length,
    forEach: (cb) => docs.forEach(cb),
  };
}

// ── Auth token (set by AuthContext via setAuthToken) ─────────────────────────
// When present, included as Authorization: Bearer <token> in every request.
// Firestore REST uses this token to populate request.auth in Security Rules.

let _authToken = null;

export function setAuthToken(token) {
  _authToken = token;
}

function _authHeader() {
  return _authToken ? { Authorization: `Bearer ${_authToken}` } : {};
}

// ── Ссылки ────────────────────────────────────────────────────────────────────

export const db = {};

export function doc(_db, ...pathSegments) {
  const path = pathSegments.join('/');
  return { _type: 'doc', path, id: pathSegments[pathSegments.length - 1] };
}

export function collection(_db, path) {
  return { _type: 'collection', path };
}

// ── Structured queries (query + where) ───────────────────────────────────────

const OP_MAP = {
  '==': 'EQUAL', '!=': 'NOT_EQUAL',
  '<': 'LESS_THAN', '<=': 'LESS_THAN_OR_EQUAL',
  '>': 'GREATER_THAN', '>=': 'GREATER_THAN_OR_EQUAL',
};

export function where(field, op, value) {
  return {
    _type: 'where',
    fieldFilter: {
      field: { fieldPath: field },
      op: OP_MAP[op] || op,
      value: toFsValue(value),
    },
  };
}

export function query(collRef, ...constraints) {
  return { _type: 'query', collRef, constraints };
}

// ── Чтение одного документа ───────────────────────────────────────────────────

async function _fetchDoc(docPath) {
  const url = `${BASE()}/${encodeFsPath(docPath)}?key=${getKey()}`;
  const resp = await fetch(url, { headers: _authHeader() });
  if (resp.status === 404) return null;
  if (!resp.ok) throw new Error(`Firestore GET error: HTTP ${resp.status}`);
  return resp.json();
}

export async function getDoc(ref) {
  const fsDoc = await _fetchDoc(ref.path);
  if (!fsDoc) return makeEmptySnap(ref.id);
  return makeSnap(fsDoc);
}

export const getDocFromServer = getDoc;

// ── Чтение коллекции ──────────────────────────────────────────────────────────

export async function getDocs(ref) {
  if (ref._type === 'query') return _runQuery(ref);

  let allDocs = [];
  let pageToken = null;

  do {
    const tokenParam = pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : '';
    const url = `${BASE()}/${encodeFsPath(ref.path)}?key=${getKey()}&pageSize=300${tokenParam}`;
    const resp = await fetch(url, { headers: _authHeader() });
    if (!resp.ok) throw new Error(`Firestore LIST error: HTTP ${resp.status}`);
    const json = await resp.json();
    if (json.documents) allDocs = allDocs.concat(json.documents);
    pageToken = json.nextPageToken || null;
  } while (pageToken);

  return makeQuerySnap(allDocs);
}

async function _runQuery(queryRef) {
  const { collRef, constraints } = queryRef;
  const filters = constraints.filter(c => c._type === 'where');

  let whereClause;
  if (filters.length === 1) {
    whereClause = { fieldFilter: filters[0].fieldFilter };
  } else if (filters.length > 1) {
    whereClause = {
      compositeFilter: {
        op: 'AND',
        filters: filters.map(c => ({ fieldFilter: c.fieldFilter })),
      },
    };
  }

  const structuredQuery = {
    from: [{ collectionId: collRef.path }],
    ...(whereClause ? { where: whereClause } : {}),
  };

  const url = `${BASE()}:runQuery?key=${getKey()}`;
  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ..._authHeader() },
    body: JSON.stringify({ structuredQuery }),
  });
  if (!resp.ok) throw new Error(`Firestore QUERY error: HTTP ${resp.status}`);
  const results = await resp.json();
  return makeQuerySnap(results);
}

// ── Запись (setDoc) ───────────────────────────────────────────────────────────

export async function setDoc(ref, data, options = {}) {
  if (options?.merge) {
    return updateDoc(ref, data);
  }
  const url = `${BASE()}/${encodeFsPath(ref.path)}?key=${getKey()}`;
  const body = { fields: toFsFields(data) };
  const resp = await fetch(url, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', ..._authHeader() },
    body: JSON.stringify(body),
  });
  if (!resp.ok) throw new Error(`Firestore SET error: HTTP ${resp.status}`);
}

// ── Обновление (updateDoc) ────────────────────────────────────────────────────

export async function updateDoc(ref, data) {
  const keys = Object.keys(data);
  if (keys.length === 0) return;
  const mask = keys.map(f => `updateMask.fieldPaths=${encodeURIComponent(f)}`).join('&');
  const url = `${BASE()}/${encodeFsPath(ref.path)}?${mask}&key=${getKey()}`;
  const body = { fields: toFsFields(data) };
  const resp = await fetch(url, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', ..._authHeader() },
    body: JSON.stringify(body),
  });
  if (!resp.ok) throw new Error(`Firestore UPDATE error: HTTP ${resp.status}`);
}

// ── Добавление нового документа ───────────────────────────────────────────────

export async function addDoc(collRef, data) {
  const url = `${BASE()}/${encodeFsPath(collRef.path)}?key=${getKey()}`;
  const body = { fields: toFsFields(data) };
  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ..._authHeader() },
    body: JSON.stringify(body),
  });
  if (!resp.ok) throw new Error(`Firestore ADD error: HTTP ${resp.status}`);
  const fsDoc = await resp.json();
  const parts = fsDoc.name.split('/');
  return { id: parts[parts.length - 1] };
}

// ── Удаление документа ────────────────────────────────────────────────────────

export async function deleteDoc(ref) {
  const url = `${BASE()}/${encodeFsPath(ref.path)}?key=${getKey()}`;
  const resp = await fetch(url, { method: 'DELETE', headers: _authHeader() });
  if (!resp.ok && resp.status !== 404)
    throw new Error(`Firestore DELETE error: HTTP ${resp.status}`);
}

// ── onSnapshot (polling каждые 5 сек) ────────────────────────────────────────

export function onSnapshot(ref, callback) {
  let active = true;

  const poll = async () => {
    if (!active) return;
    try {
      const snap = await getDoc(ref);
      if (active) callback(snap);
    } catch (e) {
      console.warn('onSnapshot poll error:', e);
    }
    if (active) setTimeout(poll, 5000);
  };

  poll();
  return () => { active = false; };
}
