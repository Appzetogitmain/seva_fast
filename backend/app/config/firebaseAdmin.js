import dotenv from "dotenv";
import admin from "firebase-admin";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

let firebaseAdminApp = null;
let firebaseAppAdminApp = null;

/**
 * Returns a firebase-admin app when FIREBASE_SERVICE_ACCOUNT (JSON string)
 * is set. FIREBASE_DATABASE_URL is optional (required only for Realtime DB).
 */
export const getFirebaseAdminApp = () => {
  if (firebaseAdminApp) return firebaseAdminApp;

  const json = process.env.FIREBASE_SERVICE_ACCOUNT;
  const databaseURL = process.env.FIREBASE_DATABASE_URL;
  if (!json) {
    return null;
  }

  try {
    const serviceAccount = JSON.parse(json);
    const config = {
      credential: admin.credential.cert(serviceAccount),
    };
    if (databaseURL) {
      config.databaseURL = databaseURL;
    }
    firebaseAdminApp = admin.initializeApp(config);
    return firebaseAdminApp;
  } catch (e) {
    console.warn("[Firebase] Init skipped:", e.message);
    return null;
  }
};

/**
 * Returns a dedicated firebase-admin app for mobile app push tokens if configured
 * via FIREBASE_SERVICE_ACCOUNT_APP. Falls back to default getFirebaseAdminApp().
 */
export const getFirebaseAppMessagingApp = () => {
  if (firebaseAppAdminApp) return firebaseAppAdminApp;

  const json = process.env.FIREBASE_SERVICE_ACCOUNT_APP;
  if (!json) {
    return getFirebaseAdminApp();
  }

  try {
    const serviceAccount = JSON.parse(json);
    const config = {
      credential: admin.credential.cert(serviceAccount),
    };
    firebaseAppAdminApp = admin.initializeApp(config, "app_mobile_push");
    return firebaseAppAdminApp;
  } catch (e) {
    console.warn("[Firebase Mobile App] Init failed, falling back to default:", e.message);
    return getFirebaseAdminApp();
  }
};

export const getFirebaseRealtimeDb = () => {
  const app = getFirebaseAdminApp();
  if (!app) return null;
  return admin.database(app);
};


