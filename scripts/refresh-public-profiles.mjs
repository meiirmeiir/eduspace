/**
 * refresh-public-profiles.mjs — разовый прогрев зеркал publicProfiles/{uid}
 * по текущим users/{uid} (та же проекция, что в Cloud Function
 * mirrorUserToPublicProfile). Нужен после добавления полей в зеркало
 * (crystals/streak): иначе они появились бы только при следующем write users.
 *
 *   node scripts/refresh-public-profiles.mjs
 */
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';

initializeApp({ credential: cert(JSON.parse(readFileSync('./scripts/service-account.json', 'utf8'))) });
const db = getFirestore();

const usersSnap = await db.collection('users').get();
let written = 0;
for (let i = 0; i < usersSnap.docs.length; i += 200) {
  const chunk = usersSnap.docs.slice(i, i + 200);
  const batch = db.batch();
  for (const docSnap of chunk) {
    const d = docSnap.data() || {};
    batch.set(db.collection('publicProfiles').doc(docSnap.id), {
      uid:         docSnap.id,
      firstName:   d.firstName   || '',
      lastName:    d.lastName    || '',
      avatarUrl:   d.avatarUrl   || '',
      equipped:    d.equipped    || {},
      totalPoints: Number(d.totalPoints || 0),
      weekPoints:  Number(d.weekPoints  || 0),
      xp:          Number(d.xp          || 0),
      crystals:    Number(d.crystals    || 0),
      streak:      Number(d.streak     || 0),
      details:     d.details     || '',
      region:      d.region      || '',
      updatedAt:   new Date().toISOString(),
    }, { merge: true });
  }
  await batch.commit();
  written += chunk.length;
}
console.log(`✅ обновлено зеркал: ${written}`);
