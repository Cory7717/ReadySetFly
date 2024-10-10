/* eslint-disable max-len */
/* eslint-disable require-jsdoc */
/**
 * Import function triggers from their respective submodules:
 *
 * const { onCall } = require("firebase-functions/v2/https");
 * const { onDocumentWritten } = require("firebase-functions/v2/firestore");
 *
 * See a full list of supported triggers at https://firebase.google.com/docs/functions
 */

const {onRequest} = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY); // Stripe Secret Key

// Initialize Firebase Admin SDK
admin.initializeApp();

// Function to create a custom Firebase token using Firebase Auth UID
exports.getFirebaseToken = onRequest(async (request, response) => {
  const {uid} = request.body; // Firebase Auth UID from the client

  try {
    // Generate custom Firebase token based on the provided UID
    const firebaseToken = await admin.auth().createCustomToken(uid);

    console.log(`Firebase token generated for UID: ${uid}`);
    response.send({firebaseToken});
  } catch (error) {
    console.error("Error generating Firebase token", error);
    response.status(500).send("Error generating Firebase token");
  }
});

// Function to handle Stripe Payment Intents
exports.paymentSheet = onRequest(async (request, response) => {
  const {amount, currency} = request.body; // Amount and currency from the client

  try {
    // Create a PaymentIntent with Stripe
    const paymentIntent = await stripe.paymentIntents.create({
      amount,
      currency,
      automatic_payment_methods: {enabled: true},
    });

    console.log(`PaymentIntent created with ID: ${paymentIntent.id}`);
    response.send({clientSecret: paymentIntent.client_secret});
  } catch (error) {
    console.error("Error creating PaymentIntent", error);
    response.status(500).send("Error creating PaymentIntent");
  }
});

// Example "helloWorld" function
exports.helloWorld = onRequest((request, response) => {
  console.log("Hello logs!");
  response.send("Hello from Firebase!");
});

// Example function using Firebase Authentication (create a custom token)
exports.createCustomToken = onRequest(async (request, response) => {
  try {
    const {uid} = request.body;
    const customToken = await admin.auth().createCustomToken(uid);

    console.log(`Custom token created for UID: ${uid}`);
    response.send({token: customToken});
  } catch (error) {
    console.error("Error creating custom token", error);
    response.status(500).send("Error creating custom token");
  }
});

// Example function to verify an ID token (Firebase Authentication)
exports.verifyIdToken = onRequest(async (request, response) => {
  try {
    const idToken = request.body.idToken;
    const decodedToken = await admin.auth().verifyIdToken(idToken);

    console.log(`Token verified for UID: ${decodedToken.uid}`);
    response.send({uid: decodedToken.uid});
  } catch (error) {
    console.error("Error verifying ID token", error);
    response.status(500).send("Error verifying ID token");
  }
});

// Add more functions as needed
