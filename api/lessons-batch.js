const admin = require('firebase-admin');

let db;
function getDb() {
  if (!db) {
    if (!admin.apps.length) {
      const sa = JSON.parse(process.env.FIREBASE_ADMIN_SERVICE_ACCOUNT);
      admin.initializeApp({ credential: admin.credential.cert(sa), projectId: 'aapa-79307' });
    }
    db = admin.firestore();
  }
  return db;
}

async function verifyAuth(req) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new Error('Missing Authorization header');
  }
  const token = authHeader.substring(7);
  return admin.auth().verifyIdToken(token);
}

async function getRole(uid) {
  const snap = await getDb().doc(`users/${uid}`).get();
  if (!snap.exists) return null;
  return snap.data().role || null;
}

async function getZoomToken() {
  const { ZOOM_ACCOUNT_ID, ZOOM_CLIENT_ID, ZOOM_CLIENT_SECRET } = process.env;
  const creds = Buffer.from(`${ZOOM_CLIENT_ID}:${ZOOM_CLIENT_SECRET}`).toString('base64');
  const res = await fetch(`https://zoom.us/oauth/token?grant_type=account_credentials&account_id=${ZOOM_ACCOUNT_ID}`, {
    method: 'POST', headers: { Authorization: `Basic ${creds}` }
  });
  if (!res.ok) throw new Error(`Zoom OAuth: ${res.status} ${await res.text()}`);
  return (await res.json()).access_token;
}

module.exports = async (req, res) => {
  const allowedOrigin = process.env.ALLOWED_ORIGIN;
  if (!allowedOrigin) {
    return res.status(500).json({ error: 'Server misconfigured: ALLOWED_ORIGIN required' });
  }
  res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  let decoded;
  try {
    decoded = await verifyAuth(req);
  } catch (err) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const role = await getRole(decoded.uid);
  if (role !== 'admin' && role !== 'teacher') {
    return res.status(403).json({ error: 'Forbidden: admin or teacher only' });
  }

  try {
    const { studentId, studentName = 'Ученик', dates, durationMinutes = 60, subject = 'Занятие' } = req.body;
    if (!studentId || !dates?.length)
      return res.status(400).json({ error: 'studentId and dates required' });

    const token = await getZoomToken();

    // Create a single recurring Zoom meeting (type 3 = no fixed time)
    const zoomRes = await fetch('https://api.zoom.us/v2/users/me/meetings', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        topic: `AAPA Math — ${studentName}`,
        type: 3,
        duration: durationMinutes,
        timezone: 'Asia/Almaty',
        settings: { auto_recording: 'cloud', waiting_room: false, join_before_host: true },
      }),
    });
    if (!zoomRes.ok) throw new Error(`Zoom: ${zoomRes.status} ${await zoomRes.text()}`);
    const zoom = await zoomRes.json();

    const batch = getDb().batch();
    const now = new Date().toISOString();
    const created = [];

    for (const date of dates) {
      const ref = getDb().collection('lessons').doc();
      batch.set(ref, {
        studentId, date, durationMinutes, subject, status: 'scheduled',
        zoomMeetingId: String(zoom.id), zoomJoinUrl: zoom.join_url, zoomStartUrl: zoom.start_url,
        createdAt: now, updatedAt: now,
      });
      created.push(ref.id);
    }

    await batch.commit();
    return res.status(201).json({ count: created.length, lessonIds: created, zoomMeetingId: String(zoom.id) });
  } catch (e) {
    console.error('[/api/lessons-batch]', e);
    res.status(500).json({ error: String(e) });
  }
};
