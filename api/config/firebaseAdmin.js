const admin = require('firebase-admin');

// Initialize Firebase Admin SDK
// Option 1: Using service account JSON file (if you have serviceAccountKey.json)
// const serviceAccount = require('../path/to/serviceAccountKey.json');
// admin.initializeApp({
//   credential: admin.credential.cert(serviceAccount)
// });

// Option 2: Using environment variables (Recommended for production)
if (!admin.apps.length) {
  try {
    // Check if using service account file path
    if (process.env.FIREBASE_SERVICE_ACCOUNT_PATH) {
      const serviceAccount = require(process.env.FIREBASE_SERVICE_ACCOUNT_PATH);
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
      });
    } 
    // Otherwise use environment variables
    else if (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY) {
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId: process.env.FIREBASE_PROJECT_ID,
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
          privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n')
        })
      });
    }
    // Else: using REST API for Firebase auth (authREST.js) – no Admin SDK needed, no message
  } catch (error) {
    // Only warn if we were actually trying to initialize (had env vars)
    if (process.env.FIREBASE_SERVICE_ACCOUNT_PATH || (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY)) {
      console.error('[Firebase Admin] Initialization error:', error.message);
    }
  }
}

module.exports = admin;
