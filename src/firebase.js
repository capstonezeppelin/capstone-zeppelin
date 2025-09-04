// import { initializeApp } from "firebase/app";
// import { query, getDatabase, ref, onValue, limitToLast} from "firebase/database";
// import admin from "firebase-admin";
// import dotenv from "dotenv";

// dotenv.config({path: "../.env"});

// const firebaseConfig = {
//   apiKey: process.env.FIREBASE_API_KEY,
//   authDomain: process.env.FIREBASE_AUTH_DOMAIN,
//   databaseURL: process.env.DATABASE_URL, // ✅ goes here
//   projectId: process.env.FIREBASE_PROJECT_ID,
//   storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
//   messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
//   appId: process.env.FIREBASE_APP_ID,
// };

// const app = initializeApp(firebaseConfig);
// const db = getDatabase(app);

// const sensorIds = ["sender1", "sender2"]; // add more as needed

// sensorIds.forEach((id) => {
//   const senderRef = ref(db, `sensor_data/${id}`);
//   const latestRef = query(senderRef, limitToLast(1));

//   onValue(latestRef, (snapshot) => {
//     const data = snapshot.val();
//     if (data) {
//       const latestKey = Object.keys(data)[0];
//       const latestValue = data[latestKey];
//       console.log(`[${id}] Latest key:`, latestKey);
//       console.log(`[${id}] Latest value:`, latestValue);
//     }
//   });
// });
