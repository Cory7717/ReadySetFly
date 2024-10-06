const { onRequest } = require("firebase-functions/v2/https");
const logger = require("firebase-functions/logger");
const { defineSecret } = require("firebase-functions/params");
const stripePackage = require("stripe");
const admin = require("firebase-admin");

// Define Stripe Secret Key as a secret
const STRIPE_SECRET_KEY = defineSecret("STRIPE_SECRET_KEY");

// Initialize Firebase Admin SDK
admin.initializeApp();

// Firebase function to generate a Firebase token
exports.getFirebaseToken = onRequest({ cors: true }, async (req, res) => {
  try {
    const { sessionToken } = req.body;

    logger.debug("Received sessionToken:", sessionToken);

    if (!sessionToken) {
      logger.warn("Missing sessionToken in request body");
      return res.status(400).json({ error: "sessionToken is required" });
    }

    // Validate the sessionToken and retrieve the UID
    const uid = await validateSessionToken(sessionToken);

    if (!uid) {
      logger.warn("Invalid session token");
      return res.status(401).json({ error: "Invalid session token" });
    }

    // Create a custom Firebase token using the UID
    const firebaseToken = await admin.auth().createCustomToken(uid);
    res.status(200).json({ firebaseToken });
  } catch (error) {
    logger.error("Error creating custom token:", error);
    res.status(500).json({ error: error.message });
  }
});

// Helper function to validate sessionToken and get the user UID
async function validateSessionToken(sessionToken) {
  try {
    // Your validation logic (e.g., using Clerk SDK)
    // Example: Validate sessionToken and return the UID
    // return validated UID
    return "userUID"; // Replace with actual validation logic to get UID
  } catch (error) {
    logger.error("Error validating sessionToken:", error);
    return null;
  }
}

// Payment Sheet function
exports.paymentSheet = onRequest(
  { secrets: [STRIPE_SECRET_KEY], cors: true },
  async (req, res) => {
    try {
      // Initialize Stripe with the secret key
      const stripe = stripePackage(STRIPE_SECRET_KEY.value());

      // Extract the amount from the request body
      const { amount } = req.body;

      logger.debug("Received payment amount:", amount);

      // Validate the amount
      if (!amount || amount <= 0) {
        logger.warn("Invalid amount provided for payment intent");
        return res.status(400).json({ error: "Invalid amount" });
      }

      // Create a PaymentIntent
      const paymentIntent = await stripe.paymentIntents.create({
        amount,
        currency: "usd",
        automatic_payment_methods: { enabled: true },
      });

      // Send the client secret as the response
      res.status(200).json({ clientSecret: paymentIntent.client_secret });
    } catch (error) {
      logger.error("Error creating payment intent:", error);
      res.status(500).json({ error: error.message });
    }
  }
);

// (Optional) Health Check function - Uncomment for testing purposes only
// exports.healthCheck = onRequest((req, res) => {
//   res.status(200).send("Server is healthy");
// });
