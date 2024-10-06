require('dotenv').config(); // Load environment variables
const express = require('express');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const bodyParser = require('body-parser');
const cors = require('cors');
const app = express();

// Import Clerk and Firebase Admin SDK
const { users, requireAuth } = require('@clerk/clerk-sdk-node');
const admin = require('firebase-admin');

// Initialize Firebase Admin SDK with service account
const serviceAccount = require('./serviceAccountKey.json'); // Ensure the path is correct

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

// Use CORS and Body-parser
app.use(cors()); // Limit origins in production
app.use(bodyParser.json());

// Existing endpoint for handling Payment Sheet
app.post('/create-payment-intent', async (req, res) => {
  try {
    const { amount, currency } = req.body;

    const paymentIntent = await stripe.paymentIntents.create({
      amount,
      currency,
    });

    res.json({ clientSecret: paymentIntent.client_secret });
  } catch (error) {
    console.error('Error creating payment intent:', error);
    res.status(500).json({ error: 'Failed to create payment intent' });
  }
});

// New endpoint for generating Firebase custom tokens
app.post('/getFirebaseToken', requireAuth(), async (req, res) => {
  try {
    const { userId } = req.auth;

    // Create Firebase custom token
    const firebaseToken = await admin.auth().createCustomToken(userId);

    res.json({ firebaseToken });
  } catch (error) {
    console.error('Error creating Firebase custom token:', error);
    res.status(500).json({ error: 'Failed to create Firebase custom token' });
  }
});

// Example function using Clerk users
const fetchClerkUser = async (userId) => {
  try {
    const user = await users.getUser(userId);
    console.log('Clerk User:', user);
  } catch (error) {
    console.error('Error fetching Clerk user:', error);
  }
};

// Example endpoint to demonstrate fetching Clerk user
app.get('/clerk-user/:userId', async (req, res) => {
  const { userId } = req.params;

  try {
    const user = await users.getUser(userId);
    res.json({ user });
  } catch (error) {
    console.error('Error fetching Clerk user:', error);
    res.status(500).json({ error: 'Failed to fetch Clerk user' });
  }
});

// Export the app as a Firebase Cloud Function
const { onRequest } = require("firebase-functions/v2/https");
exports.api = onRequest(app);
