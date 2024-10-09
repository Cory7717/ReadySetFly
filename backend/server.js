require('dotenv').config(); // Load environment variables
const express = require('express');
const stripePackage = require('stripe');
const bodyParser = require('body-parser');
const cors = require('cors');
const { onRequest } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const admin = require('firebase-admin');
const logger = require("firebase-functions/logger");

// Define Stripe Secret Key as a secret
const STRIPE_SECRET_KEY = defineSecret("STRIPE_SECRET_KEY");

// Initialize Firebase Admin SDK with service account
const serviceAccount = require('./serviceAccountKey.json'); // Ensure the path is correct
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

// Initialize Express app
const app = express();
app.use(cors({ origin: process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : '*' }));
app.use(bodyParser.json());

// --- Firebase Custom Token Generation Endpoint ---
app.post('/get-firebase-token', async (req, res) => {
  try {
    const { idToken } = req.body;

    logger.debug("Received idToken:", idToken);
    if (!idToken) {
      logger.warn("Missing idToken in request body");
      return res.status(400).json({ error: "idToken is required" });
    }

    // Verify the ID token with Firebase Admin SDK
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    const uid = decodedToken.uid;

    // Generate Firebase custom token
    const firebaseToken = await admin.auth().createCustomToken(uid);
    res.status(200).json({ firebaseToken });
  } catch (error) {
    logger.error("Error creating Firebase custom token:", error);
    res.status(500).json({ error: error.message });
  }
});

// --- Stripe Payment Intent Creation Endpoint ---
app.post('/create-payment-intent', async (req, res) => {
  try {
    const { amount, currency } = req.body;
    if (!amount || amount <= 0) {
      logger.warn("Invalid amount provided for payment intent");
      return res.status(400).json({ error: "Invalid amount" });
    }

    // Initialize Stripe with the secret key
    const stripe = stripePackage(STRIPE_SECRET_KEY.value());

    // Create a PaymentIntent
    const paymentIntent = await stripe.paymentIntents.create({
      amount,
      currency: currency || 'usd',
      automatic_payment_methods: { enabled: true },
    });

    res.status(200).json({ clientSecret: paymentIntent.client_secret });
  } catch (error) {
    logger.error("Error creating payment intent:", error);
    res.status(500).json({ error: error.message });
  }
});

// --- Fetch Firebase User Information ---
app.get('/firebase-user/:uid', async (req, res) => {
  const { uid } = req.params;
  try {
    const userRecord = await admin.auth().getUser(uid);
    res.json({ user: userRecord });
  } catch (error) {
    logger.error("Error fetching Firebase user:", error);
    res.status(500).json({ error: "Failed to fetch Firebase user" });
  }
});

// Export the app as a Firebase Cloud Function
exports.api = onRequest(app);
