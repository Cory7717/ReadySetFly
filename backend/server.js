// server.js

// Load environment variables from .env for local development
require('dotenv').config();

// =====================
// Import Dependencies
// =====================
const { initializeApp, applicationDefault } = require('firebase-admin/app');
const admin = require('firebase-admin'); // Firebase Admin SDK
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const stripePackage = require('stripe');
const nodemailer = require('nodemailer');
const logger = require("firebase-functions/logger");
const { onRequest } = require('firebase-functions/v2/https');
const { onDocumentCreated, onDocumentUpdated, onDocumentDeleted } = require('firebase-functions/v2/firestore');
const { onSchedule } = require('firebase-functions/v2/scheduler');

// =====================
// Define Environment
// =====================
const isProduction = process.env.NODE_ENV === 'production';

// =====================
// Initialize Firebase Admin SDK
// =====================
if (!admin.apps.length) {
  if (isProduction) { // Use isProduction flag
    admin.initializeApp({
      credential: applicationDefault(),
      storageBucket: 'ready-set-fly-71506.appspot.com', // Replace with your actual bucket name
    });
  } else {
    const serviceAccount = require('./serviceAccountKey.json'); // Ensure this path is correct and secure
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      storageBucket: 'ready-set-fly-71506.appspot.com', // Replace with your actual bucket name
    });
  }
}

// Initialize Firestore, Storage, and Auth
const db = admin.firestore();
const storageBucket = admin.storage().bucket();
const auth = admin.auth();

// =====================
// Initialize Express App
// =====================
const app = express();

// CORS Configuration with Fallback
let allowedOrigins = process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : null;

if (allowedOrigins) {
  app.use(cors({ origin: allowedOrigins }));
  logger.info(`CORS enabled for origins: ${allowedOrigins.join(', ')}`);
} else {
  logger.error("ALLOWED_ORIGINS is not set. CORS cannot be configured securely.");
  throw new Error("CORS configuration missing. Please set ALLOWED_ORIGINS in your environment variables.");
}

// Body Parser Middleware
app.use(bodyParser.json());

// =====================
// Initialize Stripe
// =====================
const stripeSecretKey = process.env.STRIPE_SECRET_KEY;

if (!stripeSecretKey) {
  logger.error("Stripe secret key is not configured. Please set STRIPE_SECRET_KEY in your .env");
  throw new Error("Stripe secret key is missing");
}
const stripe = stripePackage(stripeSecretKey);

// =====================
// Initialize Nodemailer
// =====================
const emailUser = process.env.EMAIL_USER;
const emailPass = process.env.EMAIL_PASS;

if (!emailUser || !emailPass) {
  logger.error("Email credentials are not configured. Please set EMAIL_USER and EMAIL_PASS in your .env");
  throw new Error("Email credentials are missing");
}

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: emailUser,
    pass: emailPass,
  },
});

// =====================
// Constants for Fee Calculations
// =====================
const bookingFeeRate = 0.06; // 6%
const processingFeeRate = 0.03; // 3%
const taxRate = 0.0825; // 8.25%

// =====================
// Helper Functions
// =====================

/**
 * Function: sendNotification
 * Description: Helper function to send FCM notifications
 * @param {Array<string>} tokens - Array of FCM tokens
 * @param {string} title - Notification title
 * @param {string} body - Notification body
 */
const sendNotification = async (tokens, title, body) => {
  const payload = {
    notification: {
      title,
      body,
    },
  };

  try {
    const response = await admin.messaging().sendToDevice(tokens, payload);
    logger.info('Notifications sent successfully:', response);
  } catch (error) {
    logger.error('Error sending notifications:', error);
  }
};

/**
 * Function: sanitizeData
 * Description: Helper function to sanitize input data
 * @param {object} data - Data to sanitize
 * @returns {object} - Sanitized data
 */
const sanitizeData = (data) => {
  // Implement sanitization logic as needed
  // For example, remove any malicious scripts or unwanted fields
  // This is a placeholder and should be expanded based on specific requirements
  return data;
};

/**
 * Function: calculateTotalCost
 * Description: Calculates the total cost breakdown based on rental cost per hour and rental hours.
 * @param {number} rentalCostPerHour 
 * @param {number} rentalHours 
 * @returns {object} - Total cost breakdown
 */
const calculateTotalCost = (rentalCostPerHour, rentalHours) => {
  // Fixed percentages
  const bookingFeePercentage = 6; // 6%
  const transactionFeePercentage = 3; // 3%
  const salesTaxPercentage = 8.25; // 8.25%

  const rentalTotalCost = rentalCostPerHour * rentalHours;
  const bookingFee = rentalTotalCost * (bookingFeePercentage / 100);
  const transactionFee = rentalTotalCost * (transactionFeePercentage / 100);
  const tax = (rentalTotalCost + bookingFee) * (salesTaxPercentage / 100);
  const renterTotalCost = rentalTotalCost + bookingFee + transactionFee + tax;

  return {
    rentalCost: parseFloat(rentalTotalCost.toFixed(2)),
    bookingFee: parseFloat(bookingFee.toFixed(2)),
    transactionFee: parseFloat(transactionFee.toFixed(2)),
    salesTax: parseFloat(tax.toFixed(2)),
    total: parseFloat(renterTotalCost.toFixed(2)),
  };
};

// =====================
// Authentication Middleware
// =====================

/**
 * Middleware: authenticate
 * Description: Verifies Firebase ID token and authenticates the user.
 */
const authenticate = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    logger.warn("Missing or invalid Authorization header");
    return res.status(401).json({ error: "Unauthorized" });
  }

  const idToken = authHeader.split('Bearer ')[1];

  try {
    const decodedToken = await auth.verifyIdToken(idToken);
    req.user = decodedToken;
    logger.info(`Authenticated user UID: ${req.user.uid}`);
    next();
  } catch (error) {
    logger.error("Error verifying Firebase ID token:", error);
    if (isProduction) {
      res.status(401).json({ error: "Unauthorized" });
    } else {
      res.status(401).json({ error: error.message });
    }
  }
};

/**
 * Middleware: authenticateAdmin
 * Description: Secures routes to be accessible only by admin users.
 */
const authenticateAdmin = async (req, res, next) => {
  await authenticate(req, res, async () => {
    const userId = req.user.uid;
    const adminDoc = await db.collection('admins').doc(userId).get();

    if (!adminDoc.exists) {
      logger.warn(`User ${userId} is not an admin`);
      return res.status(403).json({ error: "Forbidden" });
    }

    next();
  });
};

// =====================
// Define Routes
// =====================

// ---------------------
// Payment Intent Endpoints
// ---------------------

/**
 * Endpoint: /create-payment-intent
 * Description: General payment intent creation (if needed)
 * Method: POST
 */
app.post('/create-payment-intent', authenticate, async (req, res) => {
  try {
    const { amount, currency = 'usd' } = req.body;

    // Validate amount
    if (typeof amount !== 'number' || amount <= 0) {
      logger.warn("Invalid amount provided for general payment intent:", amount);
      return res.status(400).json({ error: "Invalid amount. Amount must be a positive number representing cents." });
    }

    // Validate currency
    const supportedCurrencies = ['usd', 'eur', 'gbp']; // Extend as needed
    if (!supportedCurrencies.includes(currency.toLowerCase())) {
      logger.warn(`Unsupported currency: ${currency}`);
      return res.status(400).json({ error: "Unsupported currency" });
    }

    // Create the PaymentIntent
    const paymentIntent = await stripe.paymentIntents.create({
      amount,
      currency,
      automatic_payment_methods: { enabled: true },
      metadata: {
        paymentType: 'general',
        userId: req.user.uid,
      },
    });

    logger.info(`General PaymentIntent created: ${paymentIntent.id}`);
    res.status(200).json({ clientSecret: paymentIntent.client_secret });
  } catch (error) {
    logger.error("Error creating general payment intent:", error);
    if (isProduction) {
      res.status(500).json({ error: "An unexpected error occurred." });
    } else {
      res.status(500).json({ error: error.message });
    }
  }
});

/**
 * Endpoint: /create-classified-payment-intent
 * Description: Create payment intent for classified listings
 * Method: POST
 */
app.post('/create-classified-payment-intent', authenticate, async (req, res) => {
  try {
    const { amount, currency = 'usd', listingId } = req.body; // Removed ownerId

    // Validate amount
    if (typeof amount !== 'number' || amount <= 0) {
      logger.warn("Invalid amount provided for classified payment intent:", amount);
      return res.status(400).json({ error: "Invalid amount. Amount must be a positive number representing cents." });
    }

    // Validate currency
    const supportedCurrencies = ['usd', 'eur']; // Add other supported currencies as needed
    if (!supportedCurrencies.includes(currency.toLowerCase())) {
      logger.warn(`Unsupported currency: ${currency}`);
      return res.status(400).json({ error: "Unsupported currency" });
    }

    // Validate listingId
    if (!listingId) {
      logger.warn("Missing listingId for classified payment intent");
      return res.status(400).json({ error: "listingId is required" });
    }

    const listingDoc = await db.collection('listings').doc(listingId).get();
    if (!listingDoc.exists) {
      logger.warn(`Listing with ID ${listingId} not found`);
      return res.status(404).json({ error: "Listing not found" });
    }

    // Fetch ownerId from listing
    const listingData = listingDoc.data();
    const ownerId = listingData.ownerId;
    if (!ownerId) {
      logger.warn(`Owner ID is missing in listing data for listingId: ${listingId}`);
      return res.status(400).json({ error: "Owner ID is missing in listing data" });
    }

    // Fetch owner's Stripe account ID from Firestore
    const ownerDoc = await db.collection('owners').doc(ownerId).get();
    if (!ownerDoc.exists) {
      logger.warn(`Owner with ID ${ownerId} not found`);
      return res.status(404).json({ error: "Owner not found" });
    }

    const connectedAccountId = ownerDoc.data().stripeAccountId;
    if (!connectedAccountId) {
      logger.warn(`Owner with ID ${ownerId} has not connected a Stripe account`);
      return res.status(400).json({ error: "Owner has not connected a Stripe account" });
    }

    // Verify owner's Stripe account is active
    const ownerStripeAccount = await stripe.accounts.retrieve(connectedAccountId);
    if (!ownerStripeAccount || !ownerStripeAccount.charges_enabled || !ownerStripeAccount.payouts_enabled) {
      logger.warn(`Owner with ID ${ownerId} has an inactive or incomplete Stripe account.`);
      return res.status(400).json({ error: "Owner's Stripe account is not active or properly configured." });
    }

    // Calculate tax
    const tax = Math.round(amount * taxRate); // Tax on amount

    const totalAmount = amount + tax;

    // Optional: Include application fee (e.g., 5%)
    const applicationFeeRate = 0.05; // 5%
    const applicationFeeAmount = Math.round(amount * applicationFeeRate); // in cents

    // Create the PaymentIntent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: totalAmount,
      currency,
      automatic_payment_methods: { enabled: true },
      metadata: {
        paymentType: 'classified',
        userId: req.user.uid,
        listingId,
        ownerId, // Reintroduced ownerId in metadata
        amount: (amount / 100).toFixed(2),
        tax: (tax / 100).toFixed(2),
      },
      // Optional: Add application_fee_amount if platform takes a fee
      application_fee_amount: applicationFeeAmount,
      transfer_data: {
        destination: connectedAccountId,
      },
    });

    logger.info(`Classified PaymentIntent created: ${paymentIntent.id}`);
    logger.info(`Amount: ${totalAmount} cents, Tax: ${tax} cents, Application Fee: ${applicationFeeAmount} cents`);

    res.status(200).json({ clientSecret: paymentIntent.client_secret });
  } catch (error) {
    logger.error("Error creating classified payment intent:", error);
    if (isProduction) {
      res.status(500).json({ error: "An unexpected error occurred." });
    } else {
      res.status(500).json({ error: error.message });
    }
  }
});

/**
 * Endpoint: /create-rental-payment-intent
 * Description: Create payment intent for rentals
 * Method: POST
 */
app.post('/create-rental-payment-intent', authenticate, async (req, res) => {
  try {
    const { rentalRequestId } = req.body;

    // Log received data
    logger.info(`Received create-rental-payment-intent request: rentalRequestId=${rentalRequestId}`);

    // Validate input
    if (!rentalRequestId) {
      logger.warn("Missing rentalRequestId in payment intent request");
      return res.status(400).json({ error: "rentalRequestId is required" });
    }

    const renterId = req.user.uid; // Infer renterId from authenticated user
    logger.info(`Authenticated renterId: ${renterId}`);

    // Fetch rental request from the nested 'owners/{ownerId}/rentalRequests/{rentalRequestId}' collection
    // First, find the ownerId associated with this rentalRequestId
    const rentalRequestsSnapshot = await db.collectionGroup('rentalRequests').where(admin.firestore.FieldPath.documentId(), '==', rentalRequestId).get();

    if (rentalRequestsSnapshot.empty) {
      logger.warn(`Rental request ${rentalRequestId} not found in any owner's rentalRequests collection`);
      return res.status(404).json({ error: "Rental request not found" });
    }

    if (rentalRequestsSnapshot.size > 1) {
      logger.warn(`Multiple rental requests found with ID ${rentalRequestId}. Ensure rentalRequestId is unique.`);
      return res.status(400).json({ error: "Multiple rental requests found. Please ensure rentalRequestId is unique." });
    }

    // Assuming rentalRequestId is unique across all owners
    const rentalRequestDoc = rentalRequestsSnapshot.docs[0];
    const rentalRequest = rentalRequestDoc.data();
    const ownerId = rentalRequestDoc.ref.parent.parent.id; // Get ownerId from the path

    // Verify that the authenticated renter is the one associated with this rental request
    if (rentalRequest.renterId !== renterId) {
      logger.warn(`Authenticated renterId ${renterId} does not match rental request renterId ${rentalRequest.renterId}`);
      return res.status(403).json({ error: "Forbidden: You do not have access to this rental request" });
    }

    // Defensive Coding: Check if required fields exist and are numbers
    const rentalCostPerHour = parseFloat(rentalRequest.costPerHour);
    const rentalHours = parseFloat(rentalRequest.rentalHours);

    logger.info(`Processing Rental Request ID: ${rentalRequestId}`);
    logger.info(`rentalCostPerHour (${typeof rentalCostPerHour}):`, rentalCostPerHour);
    logger.info(`rentalHours (${typeof rentalHours}):`, rentalHours);

    if (isNaN(rentalCostPerHour) || rentalCostPerHour <= 0) {
      logger.warn(`Rental Request ID: ${rentalRequestId} has invalid cost components: rentalCostPerHour=${rentalCostPerHour}`);
      return res.status(400).json({ error: "Invalid rentalCostPerHour value in rental request" });
    }

    if (isNaN(rentalHours) || rentalHours <= 0) {
      logger.warn(`Rental Request ID: ${rentalRequestId} has invalid rentalHours: rentalHours=${rentalHours}`);
      return res.status(400).json({ error: "Invalid rentalHours value in rental request" });
    }

    // Compute Renter's Total Cost using the calculation function
    const computedTotalCost = calculateTotalCost(
      rentalCostPerHour, // Use costPerHour from rental request
      rentalHours
    );

    // Store the total cost breakdown in Firestore or use as needed
    // Example: Update the rental request with computed costs
    await rentalRequestDoc.ref.update({
      ...computedTotalCost,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    logger.info("Computed Total Cost:", computedTotalCost);

    // Compute amount in cents based on total cost
    const amountInCents = Math.round(parseFloat(computedTotalCost.total) * 100);

    logger.info(
      `Creating payment intent for rental ID: ${rentalRequestId} with amount: ${amountInCents} cents`
    );

    // Fetch owner's Stripe account ID from Firestore
    const ownerDoc = await db.collection('owners').doc(ownerId).get();
    if (!ownerDoc.exists) {
      logger.warn(`Owner with ID ${ownerId} not found`);
      return res.status(404).json({ error: "Owner not found" });
    }

    const connectedAccountId = ownerDoc.data().stripeAccountId;
    if (!connectedAccountId) {
      logger.warn(`Owner with ID ${ownerId} has not connected a Stripe account`);
      return res.status(400).json({ error: "Owner has not connected a Stripe account" });
    }

    // Verify owner's Stripe account is active
    const ownerStripeAccount = await stripe.accounts.retrieve(connectedAccountId);
    if (!ownerStripeAccount || !ownerStripeAccount.charges_enabled || !ownerStripeAccount.payouts_enabled) {
      logger.warn(`Owner with ID ${ownerId} has an inactive or incomplete Stripe account.`);
      return res.status(400).json({ error: "Owner's Stripe account is not active or properly configured." });
    }

    // Optional: Include application fee (e.g., 5%)
    const applicationFeeRate = 0.05; // 5%
    const applicationFeeAmount = Math.round(amountInCents * applicationFeeRate); // in cents

    // Create PaymentIntent directly without making an HTTP request
    const paymentIntent = await stripe.paymentIntents.create({
      amount: amountInCents,
      currency: 'usd',
      automatic_payment_methods: { enabled: true },
      metadata: {
        paymentType: 'rental',
        rentalRequestId: rentalRequestId,
        renterId: renterId,
        ownerId: ownerId,
        amount: (computedTotalCost.total).toFixed(2),
      },
      // Optional: Add transfer_data if using Connect accounts
      transfer_data: {
        destination: connectedAccountId,
      },
      // Optional: Include application_fee_amount if platform takes a fee
      application_fee_amount: applicationFeeAmount,
    });

    logger.info(`Payment Intent created successfully: ${paymentIntent.id}`);
    logger.info(`Amount: ${amountInCents} cents, Application Fee: ${applicationFeeAmount} cents`);

    // Optionally, update the rental request with paymentIntentId
    await rentalRequestDoc.ref.update({ paymentIntentId: paymentIntent.id });

    // Respond with clientSecret to the frontend
    res.status(200).json({ clientSecret: paymentIntent.client_secret });
  } catch (error) {
    logger.error("Error creating rental payment intent:", error);
    if (isProduction) {
      res.status(500).json({ error: "An unexpected error occurred." });
    } else {
      res.status(500).json({ error: error.message });
    }
  }
});

// =====================
// Stripe Webhook Endpoint
// =====================

/**
 * Endpoint: /webhook
 * Description: Handle Stripe webhooks
 * Method: POST
 */
app.post('/webhook', bodyParser.raw({ type: 'application/json' }), async (req, res) => {
  let event;

  try {
    const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

    if (!endpointSecret) {
      logger.error("Stripe webhook secret is not configured. Please set STRIPE_WEBHOOK_SECRET in your .env");
      return res.status(500).send("Webhook secret is missing");
    }

    event = stripe.webhooks.constructEvent(req.body, req.headers['stripe-signature'], endpointSecret);
  } catch (err) {
    logger.error(`⚠️  Webhook signature verification failed:`, err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Handle the event
  switch (event.type) {
    case 'payment_intent.succeeded': {
      const paymentIntent = event.data.object;
      logger.info(`PaymentIntent succeeded: ${paymentIntent.id}`);

      const paymentType = paymentIntent.metadata.paymentType;
      const rentalRequestId = paymentIntent.metadata.rentalRequestId;
      const renterId = paymentIntent.metadata.renterId;
      const ownerId = paymentIntent.metadata.ownerId;
      const listingId = paymentIntent.metadata.listingId; // For classified

      try {
        if (paymentType === 'rental') {
          if (!rentalRequestId || !renterId || !ownerId) {
            logger.warn("Missing rentalRequestId, renterId, or ownerId in rental payment intent metadata");
            break;
          }

          // Update the rental request status to 'paid' in the nested collection
          const rentalRequestRef = db.collection('owners').doc(ownerId).collection('rentalRequests').doc(rentalRequestId);
          await rentalRequestRef.update({
            status: 'paid',
            paymentIntentId: paymentIntent.id,
            paidAt: admin.firestore.FieldValue.serverTimestamp(),
          });

          // Record the transaction under the renter
          await db.collection('renters').doc(renterId).collection('transactions').add({
            amount: parseFloat(paymentIntent.amount_received) / 100, // Convert cents to dollars
            description: `Payment for rental ${rentalRequestId}`,
            transferId: paymentIntent.transfer || '',
            currency: paymentIntent.currency,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
          });

          logger.info(`Rental ${rentalRequestId} marked as paid and renter ${renterId} notified.`);
        } else if (paymentType === 'classified') {
          if (!listingId) {
            logger.warn("Missing listingId in classified payment intent metadata");
            break;
          }

          // Update the classified listing status to 'paid'
          await db.collection('listings').doc(listingId).update({
            status: 'paid',
            paymentIntentId: paymentIntent.id,
            paidAt: admin.firestore.FieldValue.serverTimestamp(),
          });

          logger.info(`Classified listing ${listingId} marked as paid.`);
        }
      } catch (error) {
        logger.error("Error processing payment_intent.succeeded webhook:", error);
      }
      break;
    }

    case 'payment_intent.payment_failed': {
      const paymentIntent = event.data.object;
      logger.warn(`PaymentIntent failed: ${paymentIntent.id}`);

      const paymentType = paymentIntent.metadata.paymentType;
      const rentalRequestId = paymentIntent.metadata.rentalRequestId;
      const renterId = paymentIntent.metadata.renterId;
      const ownerId = paymentIntent.metadata.ownerId;
      const listingId = paymentIntent.metadata.listingId; // For classified

      // Optional: Handle failed payments, notify users, etc.
      try {
        if (paymentType === 'rental') {
          if (!rentalRequestId || !renterId || !ownerId) {
            logger.warn("Missing rentalRequestId, renterId, or ownerId in rental payment intent metadata");
            break;
          }

          const rentalRequestRef = db.collection('owners').doc(ownerId).collection('rentalRequests').doc(rentalRequestId);
          await rentalRequestRef.update({
            status: 'payment_failed',
            paymentIntentId: paymentIntent.id,
            failedAt: admin.firestore.FieldValue.serverTimestamp(),
          });

          logger.info(`Rental ${rentalRequestId} marked as payment_failed.`);
        } else if (paymentType === 'classified') {
          if (!listingId) {
            logger.warn("Missing listingId in classified payment intent metadata");
            break;
          }

          await db.collection('listings').doc(listingId).update({
            status: 'payment_failed',
            paymentIntentId: paymentIntent.id,
            failedAt: admin.firestore.FieldValue.serverTimestamp(),
          });

          logger.info(`Classified listing ${listingId} marked as payment_failed.`);
        }
      } catch (error) {
        logger.error("Error processing payment_intent.payment_failed webhook:", error);
      }
      break;
    }

    case 'account.updated': {
      const account = event.data.object;
      logger.info(`Stripe Account Updated: ${account.id}`);

      // Check if the account is now active
      if (account.charges_enabled && account.payouts_enabled) {
        // Update Firestore to mark the account as active
        try {
          // Assuming you store Stripe Account ID under 'owners/{ownerId}/stripeAccountId'
          const ownerSnapshot = await db.collection('owners').where('stripeAccountId', '==', account.id).get();

          if (ownerSnapshot.empty) {
            logger.warn(`No owner found with Stripe account ID: ${account.id}`);
            break;
          }

          ownerSnapshot.forEach(async (doc) => {
            await db.collection('owners').doc(doc.id).update({
              stripeAccountStatus: 'active',
            });
            logger.info(`Owner ${doc.id} Stripe account marked as active.`);
          });
        } catch (error) {
          logger.error(`Error updating owner Stripe account status:`, error);
        }
      } else {
        // Handle cases where account is not active
        try {
          const ownerSnapshot = await db.collection('owners').where('stripeAccountId', '==', account.id).get();

          if (ownerSnapshot.empty) {
            logger.warn(`No owner found with Stripe account ID: ${account.id}`);
            break;
          }

          ownerSnapshot.forEach(async (doc) => {
            await db.collection('owners').doc(doc.id).update({
              stripeAccountStatus: 'inactive',
            });
            logger.info(`Owner ${doc.id} Stripe account marked as inactive.`);
          });
        } catch (error) {
          logger.error(`Error updating owner Stripe account status:`, error);
        }
      }

      break;
    }

    // Add more event types as needed
    default:
      logger.info(`Unhandled event type ${event.type}`);
  }

  // Return a response to acknowledge receipt of the event
  res.json({ received: true });
});

// =====================
// Firestore Triggers
// =====================

/**
 * Function: onRentalRequestApproved
 * Trigger: Firestore Document Update for owners/{ownerId}/rentalRequests/{rentalRequestId}
 */
exports.onRentalRequestApproved = onDocumentUpdated('owners/{ownerId}/rentalRequests/{rentalRequestId}', async (event) => {
  const before = event.data.before.data();
  const after = event.data.after.data();
  const { rentalRequestId, ownerId } = event.params;

  // Check if the status has changed to 'approved'
  if (before.status !== 'approved' && after.status === 'approved') {
    const renterId = after.renterId;
    const listingId = after.listingId;
    const rentalDate = after.rentalDate || admin.firestore.FieldValue.serverTimestamp();

    if (!ownerId || !renterId || !listingId) {
      logger.error('Missing ownerId, renterId, or listingId in rental request.');
      return;
    }

    // Create a chat thread
    const messagesRef = db.collection('messages');
    const chatThread = {
      participants: [ownerId, renterId],
      messages: [],
      rentalRequestId,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    try {
      const chatDocRef = await messagesRef.add(chatThread);

      // Update the rental request with chatThreadId
      await event.data.after.ref.update({ chatThreadId: chatDocRef.id });

      // Send notification to renter
      const renterRef = db.collection('renters').doc(renterId);
      const renterDoc = await renterRef.get();

      if (renterDoc.exists) {
        const renterData = renterDoc.data();
        const notification = {
          type: 'rentalApproved',
          message: `Your rental request for listing ${listingId} has been approved.`,
          listingId,
          ownerId,
          rentalDate,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        };

        await renterRef.collection('notifications').add(notification);
        logger.info(`Notification sent to renter ${renterId} for rental request ${rentalRequestId}.`);
      } else {
        logger.warn(`Renter document does not exist for renterId: ${renterId}`);
      }

      logger.info(`Rental request ${rentalRequestId} approved and chat thread created.`);
    } catch (error) {
      logger.error(`Error handling rental request approval for ${rentalRequestId}:`, error);
    }
  }

  return;
});

/**
 * Function: notifyNewMessage
 * Trigger: Firestore Document Creation for messages/{chatThreadId}/messages/{messageId}
 */
exports.notifyNewMessage = onDocumentCreated('messages/{chatThreadId}/messages/{messageId}', async (event) => {
  const { chatThreadId } = event.params;
  const messageData = event.data.data();

  const { senderId, text, createdAt } = messageData;

  if (!senderId || !text) {
    logger.error('Missing senderId or text in message.');
    return;
  }

  // Fetch chat thread to get participants
  const chatThreadRef = db.collection('messages').doc(chatThreadId);
  const chatThreadDoc = await chatThreadRef.get();

  if (!chatThreadDoc.exists) {
    logger.error(`Chat thread ${chatThreadId} does not exist.`);
    return;
  }

  const chatThread = chatThreadDoc.data();
  const participants = chatThread.participants;

  // Remove sender from the list to notify the other participant(s)
  const recipients = participants.filter(id => id !== senderId);

  if (recipients.length === 0) {
    logger.warn('No recipients to notify.');
    return;
  }

  // Fetch FCM tokens for recipients
  const tokens = [];

  try {
    for (const recipientId of recipients) {
      const ownerRef = db.collection('owners').doc(recipientId);
      const ownerDoc = await ownerRef.get();

      if (ownerDoc.exists) {
        const ownerData = ownerDoc.data();
        if (ownerData.fcmToken) {
          tokens.push(ownerData.fcmToken);
        }
      }

      const renterRef = db.collection('renters').doc(recipientId);
      const renterDoc = await renterRef.get();

      if (renterDoc.exists) {
        const renterData = renterDoc.data();
        if (renterData.fcmToken) {
          tokens.push(renterData.fcmToken);
        }
      }
    }

    if (tokens.length === 0) {
      logger.warn('No FCM tokens found for recipients.');
      return;
    }

    // Construct the notification payload
    const payload = {
      notification: {
        title: 'New Message',
        body: text.length > 50 ? `${text.substring(0, 47)}...` : text,
        click_action: 'FLUTTER_NOTIFICATION_CLICK', // For React Native apps
      },
      data: {
        chatThreadId,
        senderId,
      },
    };

    // Send notifications
    const response = await admin.messaging().sendToDevice(tokens, payload);
    logger.info('Notifications sent successfully:', response);
  } catch (error) {
    logger.error('Error fetching FCM tokens or sending notifications:', error);
  }

  return;
});

/**
 * Function: onListingDeleted
 * Trigger: Firestore Document Deletion for airplanes/{listingId}
 */
exports.onListingDeleted = onDocumentDeleted('airplanes/{listingId}', async (event) => {
  const { listingId } = event.params;
  const deletedData = event.data.data();
  
  try {
    let totalDeletions = 0;

    // Step 1: Delete all rental requests associated with the listing
    const rentalRequestsRef = db.collectionGroup('rentalRequests').where('listingId', '==', listingId);
    const rentalRequestsSnapshot = await rentalRequestsRef.get();
    logger.info(`Found ${rentalRequestsSnapshot.size} rental requests for listing ${listingId}.`);

    const rentalBatch = db.batch();

    for (const requestDoc of rentalRequestsSnapshot.docs) {
      const requestData = requestDoc.data();
      const rentalRequestId = requestDoc.id;
      const ownerId = requestData.ownerId;
      const renterId = requestData.renterId;
      const chatThreadId = requestData.chatThreadId;

      if (!ownerId) {
        logger.warn(`Rental request ${rentalRequestId} is missing ownerId. Skipping deletion.`);
        continue;
      }

      // Delete the rental request from 'owners/{ownerId}/rentalRequests/{rentalRequestId}'
      const rentalRequestRef = db.collection('owners').doc(ownerId).collection('rentalRequests').doc(rentalRequestId);
      rentalBatch.delete(rentalRequestRef);
      totalDeletions++;

      // Delete associated chat thread if exists
      if (chatThreadId) {
        const chatThreadRef = db.collection('messages').doc(chatThreadId);
        rentalBatch.delete(chatThreadRef);
        logger.info(`Deleted associated chat thread ${chatThreadId} for rental request ${rentalRequestId}.`);
        totalDeletions++;
      }

      // Delete notifications associated with the rental request
      if (renterId) {
        const notificationsRef = db.collection('renters').doc(renterId).collection('notifications')
          .where('rentalRequestId', '==', rentalRequestId);
        const notificationsSnapshot = await notificationsRef.get();

        notificationsSnapshot.forEach(notificationDoc => {
          rentalBatch.delete(notificationDoc.ref);
          logger.info(`Deleted notification ${notificationDoc.id} for rental request ${rentalRequestId}.`);
          totalDeletions++;
        });
      }
    }

    // Commit the batch if there are deletions
    if (totalDeletions > 0) {
      await rentalBatch.commit();
      logger.info(`Deleted ${totalDeletions} rental requests and associated data for listing ${listingId}.`);
    } else {
      logger.info(`No rental requests found for listing ${listingId}.`);
    }

    // Step 2: Delete images from Firebase Storage
    const images = deletedData.images || [];
    const deletePromises = images.map(async imageUrl => {
      // Extract the file path from the URL
      const filePathMatch = imageUrl.match(/\/o\/(.+?)\?/);
      if (filePathMatch && filePathMatch[1]) {
        const filePath = decodeURIComponent(filePathMatch[1]).replace(/%2F/g, "/"); // Adjust based on your storage structure
        try {
          await storageBucket.file(filePath).delete();
          logger.info(`Deleted image at path: ${filePath}`);
        } catch (err) {
          logger.error(`Failed to delete image ${filePath}:`, err);
        }
      } else {
        logger.warn(`Unable to extract file path from image URL: ${imageUrl}`);
      }
    });

    await Promise.all(deletePromises);
    logger.info(`Deleted ${images.length} images for listing ${listingId}.`);
  } catch (error) {
    logger.error(`Error deleting associated data for listing ${listingId}:`, error);
  }

  return;
});

/**
 * Function: scheduledCleanupOrphanedRentalRequests
 * Trigger: Scheduled Function
 * Description: Periodically cleans up orphaned rental requests and associated data.
 */
exports.scheduledCleanupOrphanedRentalRequests = onSchedule('every 24 hours', async (event) => {
  try {
    let totalDeletions = 0;

    // Step 1: Fetch all owners
    const ownersSnapshot = await db.collection('owners').get();
    logger.info(`Fetched ${ownersSnapshot.size} owners for scheduled cleanup.`);

    for (const ownerDoc of ownersSnapshot.docs) {
      const ownerId = ownerDoc.id;
      logger.info(`Processing owner: ${ownerId}`);

      const rentalRequestsRef = db.collection('owners').doc(ownerId).collection('rentalRequests');
      const rentalRequestsSnapshot = await rentalRequestsRef.get();
      logger.info(`Owner ${ownerId} has ${rentalRequestsSnapshot.size} rental requests.`);

      const rentalBatch = db.batch();

      for (const requestDoc of rentalRequestsSnapshot.docs) {
        const requestData = requestDoc.data();
        const rentalRequestId = requestDoc.id;
        const renterId = requestData.renterId;
        const chatThreadId = requestData.chatThreadId;

        let shouldDelete = false;

        if (!renterId) {
          shouldDelete = true;
          logger.warn(`Rental request ${rentalRequestId} for owner ${ownerId} has missing renterId.`);
        } else {
          const renterDocRef = db.collection('renters').doc(renterId);
          const renterDoc = await renterDocRef.get();

          if (!renterDoc.exists) {
            shouldDelete = true;
            logger.warn(`Rental request ${rentalRequestId} for owner ${ownerId} references non-existent renterId ${renterId}.`);
          }
        }

        if (shouldDelete) {
          // Delete the rental request from 'owners/{ownerId}/rentalRequests/{rentalRequestId}'
          const rentalRequestRef = db.collection('owners').doc(ownerId).collection('rentalRequests').doc(rentalRequestId);
          rentalBatch.delete(rentalRequestRef);
          totalDeletions++;

          // Delete associated chat thread if exists
          if (chatThreadId) {
            const chatThreadRef = db.collection('messages').doc(chatThreadId);
            rentalBatch.delete(chatThreadRef);
            logger.info(`Deleted associated chat thread ${chatThreadId} for rental request ${rentalRequestId}.`);
            totalDeletions++;
          }

          // Delete notifications associated with the rental request
          if (renterId) {
            const notificationsRef = db.collection('renters').doc(renterId).collection('notifications')
              .where('rentalRequestId', '==', rentalRequestId);
            const notificationsSnapshot = await notificationsRef.get();

            notificationsSnapshot.forEach(notificationDoc => {
              rentalBatch.delete(notificationDoc.ref);
              logger.info(`Deleted notification ${notificationDoc.id} for rental request ${rentalRequestId}.`);
              totalDeletions++;
            });
          }
        }
      }

      // Commit the batch if there are deletions
      if (totalDeletions > 0) {
        await rentalBatch.commit();
        logger.info(`Committed batch deletions for owner ${ownerId}. Total deletions so far: ${totalDeletions}`);
      } else {
        logger.info(`No deletions needed for owner ${ownerId}.`);
      }
    }

    logger.info(`Cleanup complete. Total deletions: ${totalDeletions}`);
    return;
  } catch (error) {
    logger.error('Error during scheduled cleanup:', error);
    throw new Error('Scheduled cleanup failed.');
  }
});

/**
 * Function: handleAircraftDetails
 * Trigger: Firestore Document Create for aircraftDetails/{ownerId}
 * Description: Initializes default fields and validates initial data upon creation of aircraftDetails.
 */
exports.handleAircraftDetails = onDocumentCreated('aircraftDetails/{ownerId}', async (event) => {
  const ownerId = event.params.ownerId;
  const newData = event.data.data();
  logger.info(`New aircraftDetails created for ownerId: ${ownerId}`);

  // Initialize default fields if necessary
  const updatedData = {
    profileData: sanitizeData(newData.profileData || {}),
    aircraftDetails: sanitizeData(newData.aircraftDetails || {}),
    costData: sanitizeData(newData.costData || {}),
    selectedAircraftIds: newData.selectedAircraftIds || [],
    additionalAircrafts: newData.additionalAircrafts || [],
  };

  try {
    await db.collection('aircraftDetails').doc(ownerId).set(updatedData, { merge: true });
    logger.info(`Initialized default fields for ownerId: ${ownerId}`);
  } catch (error) {
    logger.error(`Error initializing data for ownerId ${ownerId}:`, error);
  }
});

/**
 * Function: handleAircraftDetailsUpdate
 * Trigger: Firestore Document Update for aircraftDetails/{ownerId}
 * Description: Handles updates to aircraftDetails, including profile updates, cost recalculations, and validation.
 */
exports.handleAircraftDetailsUpdate = onDocumentUpdated('aircraftDetails/{ownerId}', async (event) => {
  const ownerId = event.params.ownerId;
  const beforeData = event.data.before.data();
  const afterData = event.data.after.data();
  logger.info(`aircraftDetails updated for ownerId: ${ownerId}`);

  // Handle Profile Data Updates
  if (
    JSON.stringify(beforeData.profileData) !==
    JSON.stringify(afterData.profileData)
  ) {
    logger.info(`Profile data updated for ownerId: ${ownerId}`);
    // Example: Trigger a notification if the owner's display name changes
    if (beforeData.profileData.displayName !== afterData.profileData.displayName) {
      try {
        const userRecord = await admin.auth().getUser(ownerId);
        // Assume fcmToken is stored in profileData
        const fcmToken = afterData.profileData.fcmToken;
        if (fcmToken) {
          await sendNotification(
            [fcmToken],
            "Profile Updated",
            "Your profile information has been updated successfully."
          );
        }
      } catch (error) {
        logger.error(`Error fetching user record or sending notification for ownerId ${ownerId}:`, error);
      }
    }
  }

  // Handle Aircraft Details Updates
  if (
    JSON.stringify(beforeData.aircraftDetails) !==
    JSON.stringify(afterData.aircraftDetails)
  ) {
    logger.info(`Aircraft details updated for ownerId: ${ownerId}`);
    // Example: Validate aircraft details or update related listings
    // Add your validation logic here
  }

  // Handle Cost Data Updates
  if (
    JSON.stringify(beforeData.costData) !==
    JSON.stringify(afterData.costData)
  ) {
    logger.info(`Cost data updated for ownerId: ${ownerId}`);
    // Example: Recalculate costPerHour if related fields change
    const costData = afterData.costData;
    const {
      purchasePrice,
      loanAmount,
      interestRate,
      loanTerm,
      depreciationRate,
      rentalHoursPerYear,
      insuranceCost,
      hangarCost,
      maintenanceReserve,
      annualRegistrationFees,
      fuelCostPerHour,
      oilCostPerHour,
      routineMaintenancePerHour,
      tiresPerHour,
      otherConsumablesPerHour,
    } = costData;

    if (
      purchasePrice &&
      loanAmount &&
      interestRate &&
      loanTerm &&
      depreciationRate &&
      rentalHoursPerYear
    ) {
      const monthlyInterestRate = parseFloat(interestRate) / 100 / 12;
      const numberOfPayments = parseFloat(loanTerm) * 12;
      const principal = parseFloat(loanAmount);
      const mortgageExpense = principal
        ? (
            (principal * monthlyInterestRate) /
            (1 - Math.pow(1 + monthlyInterestRate, -numberOfPayments))
          ).toFixed(2)
        : 0;

      const depreciationExpense = (
        (parseFloat(purchasePrice) * parseFloat(depreciationRate)) /
        100
      ).toFixed(2);

      const totalFixedCosts =
        parseFloat(mortgageExpense) * 12 +
        parseFloat(depreciationExpense) +
        parseFloat(insuranceCost || 0) +
        parseFloat(hangarCost || 0) +
        parseFloat(maintenanceReserve || 0) +
        parseFloat(annualRegistrationFees || 0);

      const totalVariableCosts =
        (parseFloat(fuelCostPerHour || 0) +
          parseFloat(oilCostPerHour || 0) +
          parseFloat(routineMaintenancePerHour || 0) +
          parseFloat(tiresPerHour || 0) +
          parseFloat(otherConsumablesPerHour || 0)) *
        parseFloat(rentalHoursPerYear);

      const totalCostPerYear = totalFixedCosts + totalVariableCosts;
      const costPerHour = parseFloat((totalCostPerYear / parseFloat(rentalHoursPerYear)).toFixed(2));

      // Update the costPerHour field
      try {
        await db.collection('aircraftDetails').doc(ownerId).update({
          "costData.mortgageExpense": parseFloat(mortgageExpense),
          "costData.depreciationExpense": parseFloat(depreciationExpense),
          "costData.costPerHour": costPerHour,
        });
        logger.info(`Recalculated costPerHour for ownerId: ${ownerId}`);
      } catch (error) {
        logger.error(`Error updating costPerHour for ownerId ${ownerId}:`, error);
      }
    }
  }

  // Handle selectedAircraftIds Updates
  if (
    JSON.stringify(beforeData.selectedAircraftIds) !==
    JSON.stringify(afterData.selectedAircraftIds)
  ) {
    logger.info(`Selected aircraft IDs updated for ownerId: ${ownerId}`);
    // Example: Ensure that selectedAircraftIds correspond to existing aircraft
    const selectedIds = afterData.selectedAircraftIds || [];
    const additionalAircrafts = afterData.additionalAircrafts || [];

    // Fetch all valid aircraft IDs (including main aircraft)
    const validAircraftIds = [
      ownerId, // Assuming main aircraft has id === ownerId
      ...additionalAircrafts.map((aircraft) => aircraft.id),
    ];

    const invalidSelectedIds = selectedIds.filter(
      (id) => !validAircraftIds.includes(id)
    );

    if (invalidSelectedIds.length > 0) {
      logger.warn(
        `OwnerId: ${ownerId} has invalid selectedAircraftIds: ${invalidSelectedIds.join(
          ", "
        )}`
      );

      // Remove invalid IDs from selectedAircraftIds
      const updatedSelectedIds = selectedIds.filter((id) =>
        validAircraftIds.includes(id)
      );

      try {
        await db.collection('aircraftDetails').doc(ownerId).update({
          selectedAircraftIds: updatedSelectedIds,
        });
        logger.info(
          `Removed invalid selectedAircraftIds for ownerId: ${ownerId}`
        );
      } catch (error) {
        logger.error(
          `Error removing invalid selectedAircraftIds for ownerId ${ownerId}:`,
          error
        );
      }
    }

    // Additional actions can be performed here, such as updating listings for rent
  }

  // Handle Additional Aircrafts Updates
  if (
    JSON.stringify(beforeData.additionalAircrafts) !==
    JSON.stringify(afterData.additionalAircrafts)
  ) {
    logger.info(`Additional aircrafts updated for ownerId: ${ownerId}`);
    // Example: Validate additional aircrafts or trigger related updates
    // Add your validation logic here
  }

  return;
});

// =====================
// Export Express App as Firebase Function
// =====================

exports.api = onRequest(app);
