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
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(204).end();

  let decoded;
  try {
    decoded = await verifyAuth(req);
  } catch (err) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    if (req.method === 'GET') {
      const role = await getRole(decoded.uid);
      let snap;
      if (role === 'admin' || role === 'teacher') {
        snap = await getDb().collection('lessons').orderBy('date', 'asc').get();
      } else {
        snap = await getDb().collection('lessons')
          .where('studentId', '==', decoded.uid)
          .orderBy('date', 'asc')
          .get();
      }
      return res.json({ lessons: snap.docs.map(d => ({ id: d.id, ...d.data() })) });
    }

    if (req.method === 'POST') {
      const role = await getRole(decoded.uid);
      if (role !== 'admin' && role !== 'teacher') {
        return res.status(403).json({ error: 'Forbidden: admin or teacher only' });
      }

      const { studentId, date, durationMinutes = 60, studentName = 'Ученик', subject = 'Занятие' } = req.body;
      if (!studentId || !date) return res.status(400).json({ error: 'studentId and date are required' });

      const token = await getZoomToken();
      const zr = await fetch('https://api.zoom.us/v2/users/me/meetings', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic: `AAPA Math — ${studentName}`, type: 2,
          start_time: date, duration: durationMinutes, timezone: 'Asia/Almaty',
          settings: { auto_recording: 'cloud', waiting_room: false, join_before_host: true }
        })
      });
      if (!zr.ok) throw new Error(`Zoom: ${zr.status} ${await zr.text()}`);
      const zoom = await zr.json();

      const now = new Date().toISOString();
      const ref = await getDb().collection('lessons').add({
        studentId, date, durationMinutes, subject, status: 'scheduled',
        zoomMeetingId: String(zoom.id), zoomJoinUrl: zoom.join_url, zoomStartUrl: zoom.start_url,
        createdAt: now, updatedAt: now
      });
      return res.status(201).json({ id: ref.id });
    }

    res.status(405).json({ error: 'Method not allowed' });
  } catch (e) {
    console.error('[/api/lessons]', e);
    res.status(500).json({ error: String(e) });
  }
};
