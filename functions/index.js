/**
 * Import function triggers from their respective submodules:
 *
 * const { onCall } = require("firebase-functions/v2/https");
 * const { onDocumentWritten } = require("firebase-functions/v2/firestore");
 *
 * See a full list of supported triggers at https://firebase.google.com/docs/functions
 */

const {onRequest} = require("firebase-functions/v2/https");
const logger = require("firebase-functions/logger");
const {defineSecret} = require("firebase-functions/params");
const stripePackage = require("stripe");

// Define Stripe Secret Key as a secret
const STRIPE_SECRET_KEY = defineSecret("STRIPE_SECRET_KEY");

// Add the paymentSheet function
exports.paymentSheet = onRequest(
    {secrets: [STRIPE_SECRET_KEY], cors: true}, // Corrected spacing
    async (req, res) => {
      try {
      // Initialize Stripe with the secret key inside the function handler
        const stripe = stripePackage(STRIPE_SECRET_KEY.value());

        // Extract the amount from the request body
        const {amount} = req.body; // Corrected spacing

        // Validate the amount
        if (!amount || amount <= 0) {
          res.status(400).send({error: "Invalid amount"}); // Corrected spacing
          return;
        }

        // Create a PaymentIntent with the order amount and currency
        const paymentIntent = await stripe.paymentIntents.create({
          amount,
          currency: "usd",
          automatic_payment_methods: {enabled: true}, // Corrected spacing
        });

        // Send the client secret to the client
        // eslint-disable-next-line max-len
        res.status(200).send({paymentIntent: paymentIntent.client_secret}); // Corrected spacing
      } catch (error) {
        logger.error("Error creating payment intent:", error);
        res.status(500).send({error: error.message}); // Corrected spacing
      }
    },
);

// Your other functions can go here
