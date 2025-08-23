import admin from "firebase-admin";
import fs from "fs";
require('dotenv').config();

const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH || './serviceAccount.json';
if (!fs.existsSync(serviceAccountPath)) {
  console.error('Missing Firebase service account file. Put it at', serviceAccountPath);
  process.exit(1);
}

const serviceAccount = require(serviceAccountPath);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: process.env.FIREBASE_DB_URL
});

const db = admin.database();

module.exports = { admin, db };
