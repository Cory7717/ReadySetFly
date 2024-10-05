require('dotenv').config(); // Load environment variables
const express = require('express');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const bodyParser = require('body-parser');
const cors = require('cors');
const app = express();
const PORT = process.env.PORT || 8081;

// Import Clerk and Firebase Admin SDK
const { Clerk, requireAuth } = require('@clerk/clerk-sdk-node');
const admin = require('firebase-admin');

// Initialize Clerk with your secret key
const clerkClient = new Clerk({ secretKey: process.env.CLERK_SECRET_KEY });

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
  // ... existing code ...
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

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
