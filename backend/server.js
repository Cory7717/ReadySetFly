// backend/server.js

const functions = require('firebase-functions');
require('dotenv').config(); // For local development only

const express = require('express');
const stripePackage = require('stripe');
const bodyParser = require('body-parser');
const cors = require('cors');
const admin = require('firebase-admin');
const logger = require("firebase-functions/logger");
const nodemailer = require('nodemailer');
const { schedule } = require("firebase-functions/v2/pubsub");

// Initialize Firebase Admin SDK
const serviceAccount = require('./serviceAccountKey.json'); // Ensure the path is correct
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

// Initialize Firestore and Storage
const db = admin.firestore();
const storage = admin.storage().bucket();

// Initialize Express app
const app = express();

// CORS Configuration
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',')
  : '*';
app.use(cors({ origin: allowedOrigins }));

// Body Parser Middleware
app.use(bodyParser.json());

// Initialize Stripe with the secret key from Firebase Config
const stripe = stripePackage(functions.config().stripe.secret);

// Nodemailer Transporter
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    // Access email credentials from Firebase Config or .env (for local dev)
    user: process.env.EMAIL_USER || functions.config().email.user,
    pass: process.env.EMAIL_PASS || functions.config().email.pass,
  },
});

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
// Helper Function: Secure Routes as Admin Only
// =====================
const authenticateAdmin = async (req, res, next) => {
  await authenticate(req, res, () => {});

  const userId = req.user.uid;
  const adminDoc = await admin.firestore().collection('admins').doc(userId).get();

  if (!adminDoc.exists) {
    logger.warn(`User ${userId} is not an admin`);
    return res.status(403).json({ error: "Forbidden" });
  }

  next();
};

// =====================
// Discount Code Validation Endpoint
// =====================
app.post('/validateDiscount', authenticate, async (req, res) => {
  try {
    const { discountCode, amount } = req.body;

    // Validate amount
    if (typeof amount !== 'number' || amount < 0) {
      return res.status(400).json({ valid: false, message: 'Invalid amount provided' });
    }

    if (!discountCode || discountCode.trim() === '') {
      return res.status(400).json({ valid: false, message: 'Discount code is required' });
    }

    // Trim and convert to lowercase
    const code = discountCode.trim().toLowerCase();

    // Check if the discount code exists in Firestore
    const discountDoc = await admin.firestore().collection('discounts').doc(code).get();

    if (!discountDoc.exists) {
      return res.status(404).json({ valid: false, message: 'Invalid discount code' });
    }

    const discountData = discountDoc.data();

    // Check if the discount has expired
    const now = new Date();
    if (discountData.expiration && discountData.expiration.toDate() < now) {
      return res.status(400).json({ valid: false, message: 'Discount code has expired' });
    }

    // Validate discount type
    if (!['percentage', 'fixed'].includes(discountData.type)) {
      return res.status(400).json({ valid: false, message: 'Invalid discount type' });
    }

    // Calculate the new adjusted amount based on the discount
    let adjustedAmount = amount; // Use the provided amount
    if (discountData.type === 'percentage') {
      adjustedAmount = adjustedAmount * (1 - discountData.value / 100);
    } else if (discountData.type === 'fixed') {
      adjustedAmount = adjustedAmount - discountData.value;
    }

    // Ensure adjustedAmount is never negative
    adjustedAmount = Math.max(0, adjustedAmount);

    // Return the adjusted amount and discount details
    res.status(200).json({
      valid: true,
      adjustedAmount: Math.round(adjustedAmount),
      pricingTier: discountData.pricingTier || 'standard',
      message: 'Discount applied successfully',
    });
  } catch (error) {
    logger.error('Error validating discount code:', error);
    res.status(500).json({ valid: false, message: 'Failed to apply discount' });
  }
});

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

    // Optional: Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: "Invalid email format" });
    }

    // Optional: Validate country code
    const validCountries = ['US', 'CA', /* Add other supported countries */];
    if (country && !validCountries.includes(country.toUpperCase())) {
      return res.status(400).json({ error: "Invalid country code" });
    }

    // Create a Custom Connected Account
    const account = await stripe.accounts.create({
      type: 'custom',
      country: country || 'US',
      email: email,
      business_type: 'individual',
      individual: {
        first_name: fullName.split(' ')[0],
        last_name: fullName.split(' ').slice(1).join(' ') || '',
      },
      capabilities: {
        card_payments: { requested: true },
        transfers: { requested: true },
      },
    });

    // Create a link for the owner to provide additional information if necessary
    const accountLink = await stripe.accountLinks.create({
      account: account.id,
      refresh_url: `${functions.config().api.url}/reauth`,
      return_url: `${functions.config().api.url}/return`,
      type: 'account_onboarding',
    });

    // Save the Stripe account ID in Firestore associated with the ownerId
    const ownerId = req.user.uid;
    await admin.firestore().collection('owners').doc(ownerId).set(
      { stripeAccountId: account.id },
      { merge: true }
    );

    res.send({ url: accountLink.url });
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
    const { amount, currency, listingId } = req.body;
    if (typeof amount !== 'number' || amount <= 0) {
      logger.warn("Invalid amount provided for classified payment intent");
      return res.status(400).json({ error: "Invalid amount. Amount must be a positive number representing cents." });
    }

    // Validate currency
    const supportedCurrencies = ['usd', 'eur', /* Add other supported currencies */];
    if (currency && !supportedCurrencies.includes(currency.toLowerCase())) {
      return res.status(400).json({ error: "Unsupported currency" });
    }

    // Ensure READY_SET_FLY_ACCOUNT is defined
    if (!functions.config().account.ready_set_fly_account) {
      logger.error("READY_SET_FLY_ACCOUNT is not defined in environment variables");
      return res.status(500).json({ error: "Server configuration error" });
    }

    const paymentIntent = await stripe.paymentIntents.create({
      amount,
      currency: currency || 'usd',
      automatic_payment_methods: { enabled: true },
      transfer_data: {
        destination: functions.config().account.ready_set_fly_account,
      },
      metadata: {
        paymentType: 'classified',
        userId: req.user.uid,
        listingId: listingId || '',
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

    if (typeof perHour !== 'number' || perHour <= 0) {
      logger.warn("Invalid perHour amount provided for rental payment intent");
      return res.status(400).json({ error: "Invalid perHour amount. Must be a positive number." });
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
    const perHourCents = Math.round(perHour * 100); // Convert to cents if perHour is in dollars
    const bookingFee = Math.round(perHourCents * 0.06); // 6%
    const processingFee = Math.round(perHourCents * 0.03); // 3%
    const tax = Math.round((perHourCents + bookingFee) * 0.0825); // 8.25% on (perHour + bookingFee)
    const totalAmount = perHourCents + bookingFee + processingFee + tax; // Total in cents

    // Calculate the transfer amount to the owner (94% of perHour)
    const transferAmount = Math.round(perHourCents * 0.94); // 94% in cents

    // Validate connectedAccountId format
    const stripeAccountIdRegex = /^acct_[A-Za-z0-9]+$/;
    if (!stripeAccountIdRegex.test(connectedAccountId)) {
      logger.warn(`Invalid Stripe account ID format for owner ${ownerId}`);
      return res.status(400).json({ error: "Invalid Stripe account ID" });
    }

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
        amount: transferAmount,
      },
    });

    res.status(200).json({ clientSecret: paymentIntent.client_secret });
  } catch (error) {
    logger.error("Error creating rental payment intent:", error);
    res.status(500).json({ error: error.message });
  }
});

// =====================
// Attach Bank Account Endpoint
// =====================
app.post('/attach-bank-account', authenticate, async (req, res) => {
  try {
    const { ownerId, token } = req.body;

    if (!ownerId || !token) {
      logger.warn("Missing ownerId or token for attaching bank account");
      return res.status(400).json({ error: "ownerId and token are required" });
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

    // Validate Stripe account ID format
    const stripeAccountIdRegex = /^acct_[A-Za-z0-9]+$/;
    if (!stripeAccountIdRegex.test(connectedAccountId)) {
      logger.warn(`Invalid Stripe account ID format for owner ${ownerId}`);
      return res.status(400).json({ error: "Invalid Stripe account ID" });
    }

    // Attach the bank account to the connected account
    const bankAccount = await stripe.accounts.createExternalAccount(connectedAccountId, {
      external_account: token,
    });

    // Optionally, you can initiate verification if required
    // For example, sending micro-deposits and verifying them

    // Update Firestore with the attached bank account details
    await admin.firestore().collection('owners').doc(ownerId).update({
      bankAccount: {
        bankName: bankAccount.bank_name || '',
        last4: bankAccount.last4 || '',
        country: bankAccount.country || '',
        routingNumber: bankAccount.routing_number || '',
        accountType: bankAccount.account_type || '',
        // Add other relevant fields as needed
      },
    });

    res.status(200).json({ message: "Bank account attached successfully", bankAccount });
  } catch (error) {
    logger.error("Error attaching bank account:", error);
    res.status(500).json({ error: error.message });
  }
});

// =====================
// Create Listing Endpoint
// =====================
app.post('/createListing', authenticate, async (req, res) => {
  try {
    const { listingDetails } = req.body;

    if (!listingDetails || typeof listingDetails !== 'object') {
      logger.warn("Invalid or missing listingDetails for listing creation");
      return res.status(400).json({ error: "listingDetails are required and must be an object" });
    }

    // Validate required fields within listingDetails
    const { title, description, price, category } = listingDetails;
    if (!title || !description || !price || !category) {
      return res.status(400).json({ error: "Title, description, price, and category are required" });
    }

    // Optional: Additional validation based on your application's requirements
    if (typeof price !== 'number' || price < 0) {
      return res.status(400).json({ error: "Price must be a positive number" });
    }

    const ownerId = req.user.uid;

    // Add additional fields as necessary, such as createdAt
    const newListing = {
      ...listingDetails,
      ownerId,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      status: 'active', // or other initial status
    };

    // Add the new listing to Firestore
    const listingRef = await admin.firestore().collection('listings').add(newListing);

    res.status(201).json({ message: "Listing created successfully", listingId: listingRef.id });
  } catch (error) {
    logger.error("Error creating listing:", error);
    res.status(500).json({ error: "Failed to create listing" });
  }
});

// =====================
// Withdraw Funds Endpoint
// =====================
app.post('/withdraw-funds', authenticate, async (req, res) => {
  try {
    const { ownerId, amount } = req.body;

    if (!ownerId || !amount) {
      logger.warn("Missing ownerId or amount for withdrawal");
      return res.status(400).json({ error: "ownerId and amount are required" });
    }

    if (typeof amount !== 'number' || amount <= 0) {
      return res.status(400).json({ error: "Invalid amount. Must be a positive number." });
    }

    // Fetch the owner's document
    const ownerDoc = await admin.firestore().collection('owners').doc(ownerId).get();
    if (!ownerDoc.exists) {
      logger.warn(`Owner with ID ${ownerId} not found`);
      return res.status(404).json({ error: "Owner not found" });
    }

    const connectedAccountId = ownerDoc.data().stripeAccountId;
    const availableBalance = ownerDoc.data().availableBalance || 0;

    if (!connectedAccountId) {
      logger.warn(`Owner with ID ${ownerId} has not connected a Stripe account`);
      return res.status(400).json({ error: "Owner has not connected a Stripe account" });
    }

    if (availableBalance < amount) {
      return res.status(400).json({ error: "Insufficient available balance" });
    }

    // Create a Payout from the connected account to the owner's bank account
    const payout = await stripe.payouts.create(
      {
        amount: Math.round(amount * 100), // Convert to cents
        currency: 'usd',
      },
      {
        stripeAccount: connectedAccountId,
      }
    );

    // Deduct the amount from the owner's available balance
    await admin.firestore().collection('owners').doc(ownerId).update({
      availableBalance: admin.firestore.FieldValue.increment(-amount),
      lastWithdrawal: admin.firestore.FieldValue.serverTimestamp(),
      lastPayoutId: payout.id,
    });

    // Record the payout in owner's transactions
    await admin.firestore().collection('owners').doc(ownerId).collection('transactions').add({
      amount: -amount, // Negative to indicate withdrawal
      description: `Withdrawal of $${amount}`,
      payoutId: payout.id,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    res.status(200).json({ message: "Withdrawal successful", payout });
  } catch (error) {
    logger.error("Error withdrawing funds:", error);
    res.status(500).json({ error: error.message });
  }
});

// =====================
// Fetch Firebase User Information Endpoint
// =====================
app.get('/firebase-user/:uid', authenticate, async (req, res) => {
  const { uid } = req.params;
  
  // Ensure that users can only fetch their own information
  if (req.user.uid !== uid) {
    logger.warn(`User ${req.user.uid} attempted to access user data for ${uid}`);
    return res.status(403).json({ error: "Forbidden" });
  }

  try {
    const userRecord = await admin.auth().getUser(uid);
    // Sanitize user data before sending
    const sanitizedUser = {
      uid: userRecord.uid,
      email: userRecord.email,
      displayName: userRecord.displayName,
      photoURL: userRecord.photoURL,
      // Add other non-sensitive fields as needed
    };
    res.json({ user: sanitizedUser });
  } catch (error) {
    logger.error("Error fetching Firebase user:", error);
    res.status(500).json({ error: "Failed to fetch Firebase user" });
  }
});

// =====================
// Admin-only: Cleanup Orphaned Rental Requests Endpoint
// =====================
app.post('/admin/cleanupOrphanedRentalRequests', authenticateAdmin, async (req, res) => {
  try {
    let totalDeletions = 0;

    // Step 1: Fetch all owners
    const ownersSnapshot = await admin.firestore().collection('owners').get();
    console.log(`Fetched ${ownersSnapshot.size} owners.`);

    // Iterate through each owner
    for (const ownerDoc of ownersSnapshot.docs) {
      const ownerId = ownerDoc.id;
      console.log(`Processing owner: ${ownerId}`);

      const rentalRequestsRef = admin.firestore().collection('owners').doc(ownerId).collection('rentalRequests');
      const rentalRequestsSnapshot = await rentalRequestsRef.get();
      console.log(`Found ${rentalRequestsSnapshot.size} rental requests for owner ${ownerId}.`);

      const rentalBatch = admin.firestore().batch();

      for (const requestDoc of rentalRequestsSnapshot.docs) {
        const requestData = requestDoc.data();
        const rentalRequestId = requestDoc.id;
        const renterId = requestData.renterId;
        const chatThreadId = requestData.chatThreadId;

        let shouldDelete = false;

        // Check if renterId is missing or invalid
        if (!renterId) {
          shouldDelete = true;
          console.log(`Rental request ${rentalRequestId} for owner ${ownerId} has missing renterId.`);
        } else {
          const renterDocRef = admin.firestore().collection('renters').doc(renterId);
          const renterDoc = await renterDocRef.get();

          if (!renterDoc.exists) {
            shouldDelete = true;
            console.log(`Rental request ${rentalRequestId} for owner ${ownerId} references non-existent renterId ${renterId}.`);
          }
        }

        if (shouldDelete) {
          // Delete the rental request
          rentalBatch.delete(requestDoc.ref);
          totalDeletions++;

          // Delete associated chat thread if exists
          if (chatThreadId) {
            const chatThreadRef = admin.firestore().collection('messages').doc(chatThreadId);
            rentalBatch.delete(chatThreadRef);
            console.log(`Deleted associated chat thread ${chatThreadId} for rental request ${rentalRequestId}.`);
            totalDeletions++;
          }

          // Delete notifications associated with the rental request
          if (renterId) {
            const notificationsRef = admin.firestore().collection('renters').doc(renterId).collection('notifications')
              .where('rentalRequestId', '==', rentalRequestId);
            const notificationsSnapshot = await notificationsRef.get();

            notificationsSnapshot.forEach(notificationDoc => {
              rentalBatch.delete(notificationDoc.ref);
              console.log(`Deleted notification ${notificationDoc.id} for rental request ${rentalRequestId}.`);
              totalDeletions++;
            });
          }
        }
      }

      // Commit the batch if there are deletions
      if (totalDeletions > 0) {
        await rentalBatch.commit();
        console.log(`Committed batch deletions for owner ${ownerId}. Total deletions so far: ${totalDeletions}`);
      } else {
        console.log(`No deletions needed for owner ${ownerId}.`);
      }
    }

    res.status(200).send(`Cleanup complete. Total deletions: ${totalDeletions}`);
  } catch (error) {
    console.error('Error during cleanup:', error);
    res.status(500).send('Internal Server Error');
  }
});

// =====================
// Stripe Webhook Endpoint (Express Route)
// =====================
app.post('/webhook', bodyParser.raw({ type: 'application/json' }), async (req, res) => {
  let event;

  try {
    const endpointSecret = functions.config().stripe.webhook_secret;

    event = stripe.webhooks.constructEvent(req.body, req.headers['stripe-signature'], endpointSecret);
  } catch (err) {
    logger.error(`⚠️  Webhook signature verification failed.`, err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Handle the event
  switch (event.type) {
    case 'payment_intent.succeeded':
      {
        const paymentIntent = event.data.object;
        logger.info(`PaymentIntent for ${paymentIntent.amount} was successful!`);

        const paymentType = paymentIntent.metadata.paymentType;
        const userId = paymentIntent.metadata.userId;

        try {
          if (paymentType === 'rental') {
            const ownerId = paymentIntent.metadata.ownerId;
            const rentalId = paymentIntent.metadata.rentalId;
            const perHour = parseFloat(paymentIntent.metadata.perHour);

            if (!ownerId || !rentalId || isNaN(perHour)) {
              logger.warn("Missing ownerId, rentalId, or invalid perHour in rental payment intent metadata");
              break;
            }

            // Record the transaction under the owner
            await admin.firestore().collection('owners').doc(ownerId).collection('transactions').add({
              amount: perHour * 0.94, // 94% of perHour
              description: `Payment for rental ${rentalId}`,
              transferId: paymentIntent.transfer_data.destination_payment,
              createdAt: admin.firestore.FieldValue.serverTimestamp(),
            });

            // Update the owner's available balance
            const ownerRef = admin.firestore().collection('owners').doc(ownerId);
            await ownerRef.update({
              availableBalance: admin.firestore.FieldValue.increment(perHour * 0.94),
            });

            // Update the rental status to 'paid'
            await admin.firestore().collection('rentals').doc(rentalId).update({
              status: 'paid',
              paymentIntentId: paymentIntent.id,
              paidAt: admin.firestore.FieldValue.serverTimestamp(),
            });

            logger.info(`Rental ${rentalId} marked as paid and owner ${ownerId} notified.`);
          } else if (paymentType === 'classified') {
            const listingId = paymentIntent.metadata.listingId; // Assuming you pass listingId instead of rentalId for classifieds

            if (!listingId) {
              logger.warn("Missing listingId in classified payment intent metadata");
              break;
            }

            // Update the classified listing status to 'paid'
            await admin.firestore().collection('listings').doc(listingId).update({
              status: 'paid',
              paymentIntentId: paymentIntent.id,
              paidAt: admin.firestore.FieldValue.serverTimestamp(),
            });

            logger.info(`Classified listing ${listingId} marked as paid.`);
          } else if (paymentType === 'deposit') {
            const ownerId = paymentIntent.metadata.ownerId;
            const depositId = paymentIntent.metadata.depositId; // Assuming you pass a depositId

            if (!ownerId || !depositId) {
              logger.warn("Missing ownerId or depositId in deposit payment intent metadata");
              break;
            }

            // Update the owner's deposits
            await admin.firestore().collection('owners').doc(ownerId).collection('deposits').doc(depositId).update({
              status: 'completed',
              paymentIntentId: paymentIntent.id,
              completedAt: admin.firestore.FieldValue.serverTimestamp(),
            });

            logger.info(`Deposit ${depositId} for owner ${ownerId} marked as completed.`);
          }
        } catch (error) {
          logger.error("Error processing payment_intent.succeeded webhook:", error);
        }
      }
      break;
    case 'payment_intent.payment_failed':
      {
        const paymentIntent = event.data.object;
        logger.warn(`PaymentIntent failed: ${paymentIntent.id}`);

        const paymentType = paymentIntent.metadata.paymentType;
        const userId = paymentIntent.metadata.userId;

        // Optional: Handle failed payments, notify users, etc.
        // For example, update listing or rental status to 'payment_failed'
        try {
          if (paymentType === 'rental') {
            const rentalId = paymentIntent.metadata.rentalId;

            if (rentalId) {
              await admin.firestore().collection('rentals').doc(rentalId).update({
                status: 'payment_failed',
                paymentIntentId: paymentIntent.id,
                failedAt: admin.firestore.FieldValue.serverTimestamp(),
              });

              logger.info(`Rental ${rentalId} marked as payment_failed.`);
            }
          } else if (paymentType === 'classified') {
            const listingId = paymentIntent.metadata.listingId;

            if (listingId) {
              await admin.firestore().collection('listings').doc(listingId).update({
                status: 'payment_failed',
                paymentIntentId: paymentIntent.id,
                failedAt: admin.firestore.FieldValue.serverTimestamp(),
              });

              logger.info(`Classified listing ${listingId} marked as payment_failed.`);
            }
          }
        } catch (error) {
          logger.error("Error processing payment_intent.payment_failed webhook:", error);
        }
      }
      break;
    // Add more event types as needed
    default:
      logger.info(`Unhandled event type ${event.type}`);
  }

  // Return a response to acknowledge receipt of the event
  res.json({ received: true });
});

// =====================
// Export Express App as Firebase Function
// =====================
exports.api = functions.https.onRequest(app);

// =====================
// Firestore Triggers
// =====================

/**
 * Function: onRentalRequestApproved
 * Trigger: Firestore Document Update
 */
exports.onRentalRequestApproved = functions.firestore
  .document('owners/{ownerId}/rentalRequests/{rentalRequestId}')
  .onUpdate(async (change, context) => {
    const after = change.after.data();
    const before = change.before.data();
    const { ownerId, rentalRequestId } = context.params;

    // Check if the status has changed to 'approved'
    if (before.status !== 'approved' && after.status === 'approved') {
      const renterId = after.renterId;
      const listingId = after.listingId;
      const rentalDate = after.rentalDate || admin.firestore.FieldValue.serverTimestamp();

      if (!renterId || !listingId) {
        console.error('Missing renterId or listingId in rental request.');
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

      const chatDocRef = await messagesRef.add(chatThread);

      // Update the rental request with chatThreadId
      await change.after.ref.update({ chatThreadId: chatDocRef.id });

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
      } else {
        console.warn(`Renter document does not exist for renterId: ${renterId}`);
      }

      console.log(`Rental request ${rentalRequestId} approved and chat thread created.`);
    }

    return null;
  });

/**
 * Function: notifyNewMessage
 * Trigger: Firestore Document Creation
 */
exports.notifyNewMessage = functions.firestore
  .document('messages/{chatThreadId}/messages/{messageId}')
  .onCreate(async (snap, context) => {
    const { chatThreadId } = context.params;
    const messageData = snap.data();

    const { senderId, text, createdAt } = messageData;

    if (!senderId || !text) {
      console.error('Missing senderId or text in message.');
      return;
    }

    // Fetch chat thread to get participants
    const chatThreadRef = db.collection('messages').doc(chatThreadId);
    const chatThreadDoc = await chatThreadRef.get();

    if (!chatThreadDoc.exists) {
      console.error(`Chat thread ${chatThreadId} does not exist.`);
      return;
    }

    const chatThread = chatThreadDoc.data();
    const participants = chatThread.participants;

    // Remove sender from the list to notify the other participant(s)
    const recipients = participants.filter(id => id !== senderId);

    if (recipients.length === 0) {
      console.warn('No recipients to notify.');
      return;
    }

    // Fetch FCM tokens for recipients
    const tokens = [];

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
      console.warn('No FCM tokens found for recipients.');
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

    try {
      const response = await admin.messaging().sendToDevice(tokens, payload);
      console.log('Notifications sent successfully:', response);
    } catch (error) {
      console.error('Error sending notifications:', error);
    }

    return null;
  });

/**
 * Function: onListingDeleted
 * Trigger: Firestore Document Deletion
 */
exports.onListingDeleted = functions.firestore
  .document('airplanes/{listingId}')
  .onDelete(async (snap, context) => {
    const { listingId } = context.params;

    try {
      let totalDeletions = 0;

      // Step 1: Delete all rental requests associated with the listing
      const rentalRequestsRef = db.collectionGroup('rentalRequests').where('listingId', '==', listingId);
      const rentalRequestsSnapshot = await rentalRequestsRef.get();
      console.log(`Found ${rentalRequestsSnapshot.size} rental requests for listing ${listingId}.`);

      const rentalBatch = db.batch();

      for (const requestDoc of rentalRequestsSnapshot.docs) {
        const requestData = requestDoc.data();
        const renterId = requestData.renterId;
        const rentalRequestId = requestDoc.id;
        const chatThreadId = requestData.chatThreadId;

        // Delete rental request
        rentalBatch.delete(requestDoc.ref);
        totalDeletions++;

        // Delete associated chat thread if exists
        if (chatThreadId) {
          const chatThreadRef = db.collection('messages').doc(chatThreadId);
          rentalBatch.delete(chatThreadRef);
          totalDeletions++;
        }

        // Delete notifications associated with the rental request
        if (renterId) {
          const notificationsRef = db.collection('renters').doc(renterId).collection('notifications')
            .where('rentalRequestId', '==', rentalRequestId);
          const notificationsSnapshot = await notificationsRef.get();

          notificationsSnapshot.forEach(notificationDoc => {
            rentalBatch.delete(notificationDoc.ref);
            console.log(`Deleted notification ${notificationDoc.id} for rental request ${rentalRequestId}.`);
            totalDeletions++;
          });
        }
      }

      // Commit the batch if there are deletions
      if (totalDeletions > 0) {
        await rentalBatch.commit();
        console.log(`Committed ${totalDeletions} deletions for listing ${listingId}.`);
      } else {
        console.log(`No deletions needed for listing ${listingId}.`);
      }

      // Step 2: Delete images from Firebase Storage
      const images = snap.data().images || [];
      const deletePromises = images.map(imageUrl => {
        // Extract the file path from the URL
        const filePath = imageUrl.split('/').slice(-2).join('/'); // Adjust based on your storage structure
        return storage.file(filePath).delete().catch(err => {
          console.error(`Failed to delete image ${filePath}:`, err);
        });
      });

      await Promise.all(deletePromises);
      console.log(`Deleted ${images.length} images for listing ${listingId}.`);
    } catch (error) {
      console.error(`Error deleting associated data for listing ${listingId}:`, error);
    }

    return null;
  });

// =====================
// Scheduled Cleanup Function
// =====================
exports.scheduledCleanupOrphanedRentalRequests = schedule('every 24 hours').onRun(async (context) => {
  try {
    let totalDeletions = 0;

    // Step 1: Fetch all owners
    const ownersSnapshot = await db.collection('owners').get();
    console.log(`Fetched ${ownersSnapshot.size} owners for scheduled cleanup.`);

    for (const ownerDoc of ownersSnapshot.docs) {
      const ownerId = ownerDoc.id;
      const rentalRequestsRef = db.collection('owners').doc(ownerId).collection('rentalRequests');
      const rentalRequestsSnapshot = await rentalRequestsRef.get();
      console.log(`Owner ${ownerId} has ${rentalRequestsSnapshot.size} rental requests.`);

      const rentalBatch = db.batch();

      for (const requestDoc of rentalRequestsSnapshot.docs) {
        const requestData = requestDoc.data();
        const rentalRequestId = requestDoc.id;
        const renterId = requestData.renterId;
        const chatThreadId = requestData.chatThreadId;

        let shouldDelete = false;

        if (!renterId) {
          shouldDelete = true;
          console.log(`Rental request ${rentalRequestId} for owner ${ownerId} has missing renterId.`);
        } else {
          const renterDocRef = db.collection('renters').doc(renterId);
          const renterDoc = await renterDocRef.get();

          if (!renterDoc.exists) {
            shouldDelete = true;
            console.log(`Rental request ${rentalRequestId} for owner ${ownerId} references non-existent renterId ${renterId}.`);
          }
        }

        if (shouldDelete) {
          // Delete the rental request
          rentalBatch.delete(requestDoc.ref);
          totalDeletions++;

          // Delete associated chat thread if exists
          if (chatThreadId) {
            const chatThreadRef = db.collection('messages').doc(chatThreadId);
            rentalBatch.delete(chatThreadRef);
            console.log(`Deleted associated chat thread ${chatThreadId} for rental request ${rentalRequestId}.`);
            totalDeletions++;
          }

          // Delete notifications associated with the rental request
          if (renterId) {
            const notificationsRef = db.collection('renters').doc(renterId).collection('notifications')
              .where('rentalRequestId', '==', rentalRequestId);
            const notificationsSnapshot = await notificationsRef.get();

            notificationsSnapshot.forEach(notificationDoc => {
              rentalBatch.delete(notificationDoc.ref);
              console.log(`Deleted notification ${notificationDoc.id} for rental request ${rentalRequestId}.`);
              totalDeletions++;
            });
          }
        }
      }

      // Commit the batch if there are deletions
      if (totalDeletions > 0) {
        await rentalBatch.commit();
        console.log(`Committed ${totalDeletions} deletions for owner ${ownerId}.`);
      } else {
        console.log(`No orphaned rental requests found for owner ${ownerId}.`);
      }
    }

    console.log(`Scheduled cleanup completed. Total deletions: ${totalDeletions}`);
    return null;
  } catch (error) {
    console.error('Error during scheduled cleanup:', error);
    throw new functions.https.HttpsError('internal', 'Scheduled cleanup failed.');
  }
});
