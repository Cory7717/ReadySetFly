/**
 * Import function triggers from their respective submodules:
 *
 * const { onCall } = require("firebase-functions/v2/https");
 * const { onDocumentWritten } = require("firebase-functions/v2/firestore");
 *
 * See a full list of supported triggers at https://firebase.google.com/docs/functions
 */

const { onRequest, onCall } = require("firebase-functions/v2/https");
const { onDocumentWritten, onDocumentCreated } = require("firebase-functions/v2/firestore");
const logger = require("firebase-functions/logger");

// HTTPS Function Example
// exports.helloWorld = onRequest((request, response) => {
//   logger.info("Hello logs!", { structuredData: true });
//   response.send("Hello from Firebase!");
// });

// Callable Function Example
exports.addMessage = onCall((data, context) => {
  const message = data.message;
  if (!message) {
    throw new functions.https.HttpsError('invalid-argument', 'The function must be called with one argument "message".');
  }
  return { result: `Message received: ${message}` };
});

// Firestore Trigger Example
exports.onUserCreated = onDocumentCreated("users/{userId}", (snap, context) => {
  const newValue = snap.data();
  logger.info(`New user created with ID: ${context.params.userId}`, { structuredData: true });
  // Implement your logic here
});

