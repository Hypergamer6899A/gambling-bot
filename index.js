import admin from "firebase-admin";
import serviceAccount from "./serviceAccountKey.json" assert { type: "json" };

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: "https://<your-project-id>.firebaseio.com" // replace with your real URL
  });
}

const db = admin.firestore();
export { db };
