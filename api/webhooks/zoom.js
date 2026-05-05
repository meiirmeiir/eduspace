const admin = require('firebase-admin');
const crypto = require('crypto');

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

// Find the lesson closest to meetingEndTime (or most recent if no time given)
async function findLesson(meetingId, meetingEndTime) {
  const q = await getDb().collection('lessons')
    .where('zoomMeetingId', '==', String(meetingId))
    .get();
  if (q.empty) return null;
  if (q.docs.length === 1) return q.docs[0];

  const refTime = meetingEndTime ? new Date(meetingEndTime) : new Date();
  // Pick the lesson whose date is closest to (and before) the meeting end time
  let best = null;
  let bestDiff = Infinity;
  for (const doc of q.docs) {
    const lessonDate = new Date(doc.data().date || 0);
    const diff = Math.abs(refTime - lessonDate);
    if (diff < bestDiff) {
      bestDiff = diff;
      best = doc;
    }
  }
  return best;
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).end();

  const body = req.body;

  // Zoom URL-validation handshake
  if (body.event === 'endpoint.url_validation') {
    const secret = process.env.ZOOM_WEBHOOK_SECRET || '';
    const hash = crypto.createHmac('sha256', secret).update(body.payload.plainToken).digest('hex');
    return res.json({ plainToken: body.payload.plainToken, encryptedToken: hash });
  }

  // Verify webhook signature
  const secret = process.env.ZOOM_WEBHOOK_SECRET || '';
  const timestamp = req.headers['x-zm-request-timestamp'] || '';
  const signature = req.headers['x-zm-signature'] || '';

  // Replay attack protection: reject requests older than 5 minutes
  const ts = parseInt(timestamp, 10);
  if (!ts || Math.abs(Date.now() / 1000 - ts) > 300) {
    return res.status(401).json({ error: 'Request timestamp expired' });
  }

  const rawBody = JSON.stringify(body);
  const expected = 'v0=' + crypto.createHmac('sha256', secret).update(`v0:${timestamp}:${rawBody}`).digest('hex');

  // Timing-safe comparison to prevent timing attacks
  const sigBuf = Buffer.from(signature);
  const expBuf = Buffer.from(expected);
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
    return res.status(401).json({ error: 'Invalid signature' });
  }

  // ── recording.completed → save video URL ───────────────────────────────────
  if (body.event === 'recording.completed') {
    const meeting = body.payload?.object;
    if (!meeting) return res.status(400).json({ error: 'No meeting data' });

    try {
      const lessonDoc = await findLesson(meeting.id, meeting.end_time);
      if (!lessonDoc) return res.json({ status: 'no_match' });

      const shareUrl = meeting.share_url || '';
      const recordings = meeting.recording_files || [];
      const mp4 = recordings.find(f => f.file_type === 'MP4');
      const recordingUrl = shareUrl || mp4?.play_url || '';

      await lessonDoc.ref.update({
        status: 'completed',
        driveVideoUrl: recordingUrl,
        updatedAt: new Date().toISOString(),
      });

      console.log(`[zoom-webhook] recording saved: lesson=${lessonDoc.id}`);
      return res.json({ status: 'accepted', lessonId: lessonDoc.id });
    } catch (e) {
      console.error('[zoom-webhook] recording.completed error:', e);
      return res.status(500).json({ error: String(e) });
    }
  }

  // ── meeting.summary_completed → save Zoom AI Companion summary ───────────
  if (body.event === 'meeting.summary_completed') {
    const obj = body.payload?.object;
    if (!obj) return res.status(400).json({ error: 'No summary data' });

    // Log full payload for debugging
    console.log('[zoom-webhook] summary payload:', JSON.stringify(obj, null, 2));

    try {
      // Zoom sends numeric id as obj.id (not obj.meeting_id)
      const meetingId = obj.id || obj.meeting_id;
      const lessonDoc = await findLesson(meetingId, obj.meeting_end_time || obj.end_time);
      if (!lessonDoc) {
        console.log(`[zoom-webhook] no lesson found for meetingId=${meetingId}`);
        return res.json({ status: 'no_match', meetingId });
      }

      // Build summary from summary_details items
      let summaryText = '';

      if (Array.isArray(obj.summary_details) && obj.summary_details.length) {
        summaryText = obj.summary_details.map(item => {
          const label = item.label || item.summary || '';
          const detail = item.details || item.content || '';
          if (label && detail) return `${label}\n${detail}`;
          return label || detail || '';
        }).filter(Boolean).join('\n\n');
      }

      if (!summaryText) return res.json({ status: 'empty_summary' });

      await lessonDoc.ref.update({
        summary: summaryText,
        updatedAt: new Date().toISOString(),
      });

      console.log(`[zoom-webhook] summary saved: lesson=${lessonDoc.id} length=${summaryText.length}`);
      return res.json({ status: 'accepted', lessonId: lessonDoc.id });
    } catch (e) {
      console.error('[zoom-webhook] meeting.summary_completed error:', e);
      return res.status(500).json({ error: String(e) });
    }
  }

  return res.json({ status: 'ignored' });
};
