import { initializeApp } from 'firebase/app';
import { getFirestore, doc, setDoc } from 'firebase/firestore';
import fs from 'fs';
import path from 'path';

const firebaseConfig = {
  apiKey: "AIzaSyBlkthPW-3LCSVvyXg4k8yYZ7lx_5RZg3E",
  authDomain: "xrplhackathon-9bf0a.firebaseapp.com",
  projectId: "xrplhackathon-9bf0a",
  storageBucket: "xrplhackathon-9bf0a.appspot.com",
  messagingSenderId: "235937752656",
  appId: "1:235937752656:web:abcdef1234567890abcdef"
};

async function main() {
  const dataPath = path.resolve(__dirname, '../data/seed.json');
  const raw = fs.readFileSync(dataPath, 'utf8');
  const seed = JSON.parse(raw);

  const app = initializeApp(firebaseConfig);
  const db = getFirestore(app);

  // users
  for (const u of seed.users) {
    await setDoc(doc(db, 'users', u.userId), u, { merge: true });
    console.log('[seed] user', u.userId);
  }

  // enterprises
  for (const e of seed.enterprises) {
    await setDoc(doc(db, 'enterprises', e.enterpriseId), e, { merge: true });
    console.log('[seed] enterprise', e.enterpriseId);
  }

  // health_data
  for (const d of seed.health_data) {
    await setDoc(doc(db, 'health_data', d.dataId), d, { merge: true });
    console.log('[seed] health_data', d.dataId);
  }

  console.log('Firestore seeding complete.');
}

main().catch((err) => {
  console.error('Seed failed', err);
  process.exit(1);
});
