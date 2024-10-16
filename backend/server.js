// server.js

require('dotenv').config(); // Load environment variables
const express = require('express');
const stripePackage = require('stripe');
const bodyParser = require('body-parser');
const cors = require('cors');
const { onRequest } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const admin = require('firebase-admin');
const logger = require("firebase-functions/logger");

// Define Stripe Secrets as Firebase Secrets
const STRIPE_SECRET_KEY = defineSecret("STRIPE_SECRET_KEY");
const STRIPE_WEBHOOK_SECRET = defineSecret("STRIPE_WEBHOOK_SECRET");

// Initialize Firebase Admin SDK with service account
const serviceAccount = require('./serviceAccountKey.json'); // Ensure the path is correct
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

// Initialize Express app
const app = express();

// CORS Configuration
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',')
  : '*';
app.use(cors({ origin: allowedOrigins }));

// Body Parser Middleware
// Note: For webhook endpoint, we need raw body. We'll handle it separately.
app.use(bodyParser.json());

// Initialize Stripe with the secret key
const stripe = stripePackage(STRIPE_SECRET_KEY.value());

// =====================
// Authentication Middleware
// =====================
const authenticate = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    logger.warn("Missing or invalid Authorization header");
    return res.status(401).json({ error: "Unauthorized" });
  }

  const idToken = authHeader.split('Bearer ')[1];

  try {
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    req.user = decodedToken;
    next();
  } catch (error) {
    logger.error("Error verifying Firebase ID token:", error);
    return res.status(401).json({ error: "Unauthorized" });
  }
};

// =====================
// Stripe Connected Account Creation Endpoint
// =====================
app.post('/create-connected-account', authenticate, async (req, res) => {
  try {
    const { email, fullName, country } = req.body;

    if (!email || !fullName) {
      logger.warn("Missing required fields for connected account creation");
      return res.status(400).json({ error: "Email and fullName are required" });
    }

    // Create a Custom Connected Account
    const account = await stripe.accounts.create({
      type: 'custom',
      country: country || 'US',
      email: email,
      business_type: 'individual',
      individual: {
        first_name: fullName.split(' ')[0],
        last_name: fullName.split(' ').slice(1).join(' '),
        // Collect additional individual details as necessary
      },
      capabilities: {
        card_payments: { requested: true },
        transfers: { requested: true },
      },
      // Optional: Collect additional information or set up branding
    });

    // Create a link for the owner to provide additional information if necessary
    const accountLink = await stripe.accountLinks.create({
      account: account.id,
      refresh_url: `${process.env.API_URL}/reauth`, // Update with your frontend URL
      return_url: `${process.env.API_URL}/return`,   // Update with your frontend URL
      type: 'account_onboarding',
    });

    // Save the Stripe account ID in Firestore associated with the ownerId
    const ownerId = req.user.uid;
    await admin.firestore().collection('owners').doc(ownerId).set(
      { stripeAccountId: account.id },
      { merge: true }
    );

    res.send({
      url: accountLink.url,
    });
  } catch (error) {
    logger.error("Error creating connected account:", error);
    res.status(500).send({ error: error.message });
  }
});

// =====================
// Stripe Payment Intent Creation Endpoint for Classifieds
// =====================
app.post('/create-classified-payment-intent', authenticate, async (req, res) => {
  try {
    const { amount, currency } = req.body;
    if (!amount || amount <= 0) {
      logger.warn("Invalid amount provided for classified payment intent");
      return res.status(400).json({ error: "Invalid amount" });
    }

    // Create a PaymentIntent with transfer_data.destination set to Ready Set Fly account
    const paymentIntent = await stripe.paymentIntents.create({
      amount,
      currency: currency || 'usd',
      automatic_payment_methods: { enabled: true },
      transfer_data: {
        destination: process.env.READY_SET_FLY_ACCOUNT, // Ready Set Fly Stripe Account ID
      },
      metadata: {
        paymentType: 'classified',
        userId: req.user.uid,
      },
    });

    res.status(200).json({ clientSecret: paymentIntent.client_secret });
  } catch (error) {
    logger.error("Error creating classified payment intent:", error);
    res.status(500).json({ error: error.message });
  }
});

// =====================
// Stripe Payment Intent Creation Endpoint for Rentals
// =====================
app.post('/create-rental-payment-intent', authenticate, async (req, res) => {
  try {
    const { perHour, ownerId, rentalId } = req.body;

    if (!perHour || perHour <= 0) {
      logger.warn("Invalid perHour amount provided for rental payment intent");
      return res.status(400).json({ error: "Invalid perHour amount" });
    }

    if (!ownerId || !rentalId) {
      logger.warn("Missing ownerId or rentalId for rental payment intent");
      return res.status(400).json({ error: "ownerId and rentalId are required" });
    }

    // Fetch the owner's connected account ID from Firestore
    const ownerDoc = await admin.firestore().collection('owners').doc(ownerId).get();
    if (!ownerDoc.exists) {
      logger.warn(`Owner with ID ${ownerId} not found`);
      return res.status(404).json({ error: "Owner not found" });
    }

    const connectedAccountId = ownerDoc.data().stripeAccountId;
    if (!connectedAccountId) {
      logger.warn(`Owner with ID ${ownerId} has not connected a Stripe account`);
      return res.status(400).json({ error: "Owner has not connected a Stripe account" });
    }

    // Calculate fees and total amount
    const bookingFee = perHour * 0.06; // 6%
    const processingFee = perHour * 0.03; // 3%
    const tax = (perHour + bookingFee) * 0.0825; // 8.25% on (perHour + bookingFee)
    const totalAmount = Math.round((perHour + bookingFee + processingFee + tax) * 100); // Convert to cents

    // Calculate the transfer amount to the owner (94% of perHour)
    const transferAmount = Math.round(perHour * 0.94 * 100); // 94% in cents

    // Create a PaymentIntent with application fee and transfer_data.destination
    const paymentIntent = await stripe.paymentIntents.create({
      amount: totalAmount,
      currency: 'usd',
      automatic_payment_methods: { enabled: true },
      metadata: {
        paymentType: 'rental',
        userId: req.user.uid,
        ownerId: ownerId,
        rentalId: rentalId,
        perHour: perHour.toString(),
        bookingFee: bookingFee.toString(),
        processingFee: processingFee.toString(),
        tax: tax.toString(),
      },
      application_fee_amount: Math.round(totalAmount * 0.06), // 6% fee
      transfer_data: {
        destination: connectedAccountId,
        amount: transferAmount, // Optional: Specify exact amount to transfer
      },
    });

    res.status(200).json({ clientSecret: paymentIntent.client_secret });
  } catch (error) {
    logger.error("Error creating rental payment intent:", error);
    res.status(500).json({ error: error.message });
  }
});

// =====================
// Stripe Webhook Endpoint
// =====================
app.post('/webhook', bodyParser.raw({ type: 'application/json' }), async (req, res) => {
  let event;

  try {
    // Retrieve the webhook secret from Firebase Secrets
    const endpointSecret = STRIPE_WEBHOOK_SECRET.value();

    // Construct the event using the webhook secret
    event = stripe.webhooks.constructEvent(req.body, req.headers['stripe-signature'], endpointSecret);
  } catch (err) {
    logger.error(`⚠️  Webhook signature verification failed.`, err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Handle the event
  switch (event.type) {
    case 'payment_intent.succeeded':
      const paymentIntent = event.data.object;
      logger.info(`PaymentIntent for ${paymentIntent.amount} was successful!`);

      const paymentType = paymentIntent.metadata.paymentType;
      const userId = paymentIntent.metadata.userId;

      if (paymentType === 'rental') {
        const ownerId = paymentIntent.metadata.ownerId;
        const rentalId = paymentIntent.metadata.rentalId;
        const perHour = parseFloat(paymentIntent.metadata.perHour);

        if (!ownerId || !rentalId || isNaN(perHour)) {
          logger.warn("Missing ownerId, rentalId, or invalid perHour in rental payment intent metadata");
          break;
        }

        // Record the transaction in owner's transactions subcollection
        await admin.firestore().collection('owners').doc(ownerId).collection('transactions').add({
          amount: perHour * 0.94, // 94% of perHour
          description: `Payment for rental ${rentalId}`,
          transferId: paymentIntent.transfer_data.destination_payment, // Reference to the transfer if available
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        // Update the rental status to 'paid' in Firestore
        await admin.firestore().collection('rentals').doc(rentalId).update({
          status: 'paid',
          paymentIntentId: paymentIntent.id,
          paidAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        // Notify owner and renter if necessary
        // Implement notification logic here (e.g., send emails, push notifications)

        logger.info(`Rental ${rentalId} marked as paid and owner ${ownerId} notified.`);
      } else if (paymentType === 'classified') {
        // For Classifieds, no additional transfers are needed as funds go directly to Ready Set Fly
        const rentalId = paymentIntent.metadata.rentalId;

        // Update your database to mark the classified listing as paid
        await admin.firestore().collection('rentals').doc(rentalId).update({
          status: 'paid',
          paymentIntentId: paymentIntent.id,
          paidAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        // Notify user if necessary
        logger.info(`Classified rental ${rentalId} marked as paid.`);
      }
      break;
    // ... handle other event types as needed
    default:
      logger.info(`Unhandled event type ${event.type}`);
  }

  // Return a response to acknowledge receipt of the event
  res.json({ received: true });
});

// =====================
// Fetch Firebase User Information
// =====================
app.get('/firebase-user/:uid', authenticate, async (req, res) => {
  const { uid } = req.params;
  try {
    const userRecord = await admin.auth().getUser(uid);
    res.json({ user: userRecord });
  } catch (error) {
    logger.error("Error fetching Firebase user:", error);
    res.status(500).json({ error: "Failed to fetch Firebase user" });
  }
});

// =====================
// Start Express Server as Firebase Function
// =====================
// Export the Express app as a Firebase Cloud Function named 'api'.
exports.api = onRequest(app);
