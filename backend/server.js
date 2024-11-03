require('dotenv').config(); // Load environment variables from .env for local development

const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { getStorage } = require('firebase-admin/storage');
const { getAuth } = require('firebase-admin/auth');
const admin = require('firebase-admin'); // Ensure single initialization

const { onRequest } = require('firebase-functions/v2/https');
const { onDocumentUpdated, onDocumentCreated, onDocumentDeleted } = require('firebase-functions/v2/firestore');
const { onSchedule } = require('firebase-functions/v2/scheduler');

const express = require('express');
const stripePackage = require('stripe');
const bodyParser = require('body-parser');
const cors = require('cors');
const logger = require("firebase-functions/logger");
const nodemailer = require('nodemailer');

// Initialize Firebase Admin SDK
const serviceAccount = require('./serviceAccountKey.json'); // Ensure this path is correct
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  storageBucket: 'ready-set-fly-71506.appspot.com', // Replace with your actual bucket name
});

// Initialize Firestore and Storage
const db = getFirestore();
const storage = getStorage().bucket();
const auth = getAuth();

// Initialize Express app
const app = express();

// CORS Configuration
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',')
  : '*';
app.use(cors({ origin: true }));

// Body Parser Middleware
app.use(bodyParser.json());

// Initialize Stripe with the secret key from Environment Variables
const stripe = stripePackage(process.env.STRIPE_SECRET_KEY);

// Nodemailer Transporter
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

// Constants for Fee Calculations
const bookingFeeRate = 0.06; // 6%
const taxRate = 0.0825; // 8.25%

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
    const decodedToken = await auth.verifyIdToken(idToken);
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
  const adminDoc = await db.collection('admins').doc(userId).get();

  if (!adminDoc.exists) {
    logger.warn(`User ${userId} is not an admin`);
    return res.status(403).json({ error: "Forbidden" });
  }

  next();
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
    res.status(500).json({ error: error.message });
  }
});

/**
 * Endpoint: /create-classified-payment-intent
 * Description: Create payment intent for classified listings
 * Method: POST
 */
app.post('/create-classified-payment-intent', authenticate, async (req, res) => {
  try {
    const { amount, currency = 'usd', listingId, ownerId } = req.body; // Reintroduced ownerId

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

    // Validate ownerId
    if (!ownerId) { // Reintroduced validation
      logger.warn("Missing ownerId for classified payment intent");
      return res.status(400).json({ error: "ownerId is required" });
    }

    const ownerDoc = await db.collection('owners').doc(ownerId).get();
    if (!ownerDoc.exists) {
      logger.warn(`Owner with ID ${ownerId} not found`);
      return res.status(404).json({ error: "Owner not found" });
    }

    // Calculate tax
    const tax = Math.round(amount * taxRate); // Tax on amount

    const totalAmount = amount + tax;

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
    });

    logger.info(`Classified PaymentIntent created: ${paymentIntent.id}`);
    res.status(200).json({ clientSecret: paymentIntent.client_secret });
  } catch (error) {
    logger.error("Error creating classified payment intent:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Endpoint: /create-rental-payment-intent
 * Description: Create payment intent for rentals
 * Method: POST
 */
app.post('/create-rental-payment-intent', authenticate, async (req, res) => {
  try {
    const { rentalRequestId, ownerId, renterId } = req.body;

    // Log received data
    logger.info(`Received create-rental-payment-intent request: rentalRequestId=${rentalRequestId}, ownerId=${ownerId}, renterId=${renterId}`);

    // Validate input
    if (!rentalRequestId) {
      logger.warn("Missing rentalRequestId in payment intent request");
      return res.status(400).json({ error: "rentalRequestId is required" });
    }

    if (!ownerId) {
      logger.warn("Missing ownerId in payment intent request");
      return res.status(400).json({ error: "ownerId is required" });
    }

    if (!renterId) {
      logger.warn("Missing renterId in payment intent request");
      return res.status(400).json({ error: "renterId is required" });
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

    // Fetch rental request directly using renterId and rentalRequestId
    const rentalRequestRef = db.collection('renters')
      .doc(renterId)
      .collection('rentalRequests')
      .doc(rentalRequestId);

    const rentalRequestSnap = await rentalRequestRef.get();

    if (!rentalRequestSnap.exists) {
      logger.warn(`Rental request ${rentalRequestId} for renter ${renterId} not found`);
      return res.status(404).json({ error: "Rental request not found" });
    }

    const rentalRequest = rentalRequestSnap.data();

    if (!rentalRequest.ownerId) {
      logger.warn("Owner ID is missing in rental request");
      return res.status(400).json({ error: "Owner ID is missing in rental request" });
    }

    // Calculate fees and total amount
    const perHour = parseFloat(rentalRequest.rentalHours);
    if (isNaN(perHour) || perHour <= 0) {
      logger.warn(`Invalid perHour value in rental request ${rentalRequestId}`);
      return res.status(400).json({ error: "Invalid perHour value in rental request" });
    }

    const perHourCents = Math.round(perHour * 100); // Convert to cents
    const bookingFee = Math.round(perHourCents * bookingFeeRate); // Booking fee
    const tax = Math.round((perHourCents + bookingFee) * taxRate); // Tax on (perHourCents + bookingFee)
    const totalAmount = perHourCents + bookingFee + tax; // Total amount in cents

    const applicationFeeAmount = bookingFee + tax; // Platform collects booking fee and tax

    // Create the PaymentIntent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: totalAmount,
      currency: 'usd', // Ensure this matches your Stripe account's supported currencies
      automatic_payment_methods: { enabled: true },
      metadata: {
        paymentType: 'rental',
        userId: req.user.uid,
        ownerId: ownerId, // Reintroduced ownerId in metadata
        rentalId: rentalRequestId,
        perHour: (perHourCents / 100).toFixed(2),
        bookingFee: (bookingFee / 100).toFixed(2),
        tax: (tax / 100).toFixed(2),
      },
      application_fee_amount: applicationFeeAmount,
      transfer_data: {
        destination: connectedAccountId,
      },
    });

    logger.info(`Rental PaymentIntent created: ${paymentIntent.id}`);
    res.status(200).json({ clientSecret: paymentIntent.client_secret });
  } catch (error) {
    // Detailed error logging as previously described
    if (error && error.type === 'StripeCardError') {
      logger.error(`StripeCardError: ${error.message}`);
      res.status(400).json({ error: error.message });
    } else if (error && error.type === 'StripeInvalidRequestError') {
      logger.error(`StripeInvalidRequestError: ${error.message}`);
      res.status(400).json({ error: error.message });
    } else if (error && error.type === 'StripeAPIError') {
      logger.error(`StripeAPIError: ${error.message}`);
      res.status(500).json({ error: "Internal Server Error. Please try again." });
    } else if (error && error.type === 'StripeConnectionError') {
      logger.error(`StripeConnectionError: ${error.message}`);
      res.status(502).json({ error: "Bad Gateway. Please try again." });
    } else if (error && error.type === 'StripeAuthenticationError') {
      logger.error(`StripeAuthenticationError: ${error.message}`);
      res.status(401).json({ error: "Authentication with payment gateway failed." });
    } else {
      logger.error(`Unexpected Error: ${error.message}`, error);
      res.status(500).json({ error: "An unexpected error occurred." });
    }
  }
});

/**
 * Endpoint: /withdraw-funds
 * Description: Withdraw funds to owner's bank account
 * Method: POST
 */
app.post('/withdraw-funds', authenticate, async (req, res) => {
  try {
    const { amount } = req.body; // ownerId is reintroduced here as per previous setup

    // Validate amount
    if (typeof amount !== 'number' || amount <= 0) {
      logger.warn(`Invalid amount for withdrawal: ${amount}`);
      return res.status(400).json({ error: "Invalid amount. Must be a positive number." });
    }

    const ownerId = req.user.uid; // Use authenticated user's UID

    // Fetch the owner's document
    const ownerDoc = await db.collection('owners').doc(ownerId).get();
    if (!ownerDoc.exists) {
      logger.warn(`Owner with ID ${ownerId} not found`);
      return res.status(404).json({ error: "Owner not found" });
    }

    const connectedAccountId = ownerDoc.data().stripeAccountId;
    const availableBalance = ownerDoc.data().availableBalance || 0;
    const currency = ownerDoc.data().currency || 'usd'; // Assuming a currency field exists

    if (!connectedAccountId) {
      logger.warn(`Owner with ID ${ownerId} has not connected a Stripe account`);
      return res.status(400).json({ error: "Owner has not connected a Stripe account" });
    }

    if (availableBalance < amount) {
      logger.warn(`Owner ${ownerId} has insufficient balance: Requested ${amount}, Available ${availableBalance}`);
      return res.status(400).json({ error: "Insufficient available balance" });
    }

    // Check for minimum payout amount (example for USD: $5.00)
    const minimumPayoutCents = 500; // Adjust based on Stripe's requirements
    if (Math.round(amount * 100) < minimumPayoutCents) {
      logger.warn(`Withdrawal amount $${amount.toFixed(2)} is below the minimum payout limit`);
      return res.status(400).json({ error: `Minimum withdrawal amount is $${(minimumPayoutCents / 100).toFixed(2)}` });
    }

    // Create a Payout from the connected account to the owner's bank account
    const payout = await stripe.payouts.create(
      {
        amount: Math.round(amount * 100), // Convert to cents
        currency,
      },
      {
        stripeAccount: connectedAccountId,
      }
    );

    // Deduct the amount from the owner's available balance
    await db.collection('owners').doc(ownerId).update({
      availableBalance: FieldValue.increment(-amount),
      lastWithdrawal: FieldValue.serverTimestamp(),
      lastPayoutId: payout.id,
    });

    // Record the payout in owner's transactions
    await db.collection('owners').doc(ownerId).collection('transactions').add({
      amount: -amount, // Negative to indicate withdrawal
      description: `Withdrawal of $${amount.toFixed(2)}`,
      payoutId: payout.id,
      currency,
      createdAt: FieldValue.serverTimestamp(),
    });

    logger.info(`Withdrawal of $${amount.toFixed(2)} for owner ${ownerId} successful. Payout ID: ${payout.id}`);
    res.status(200).json({ message: "Withdrawal successful", payout });
  } catch (error) {
    logger.error("Error withdrawing funds:", error);

    // Optional: Implement rollback if payout creation fails after balance deduction
    // Note: Firestore transactions do not cover external API calls like Stripe payouts.
    // To handle this, consider manually adjusting the balance or implementing compensating transactions.

    res.status(500).json({ error: error.message });
  }
});

// ---------------------
// Other Functional Endpoints
// ---------------------

/**
 * Endpoint: /validateDiscount
 * Description: Validate discount codes
 * Method: POST
 */
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
    const discountDoc = await db.collection('discounts').doc(code).get();

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

/**
 * Endpoint: /create-connected-account
 * Description: Create Stripe connected accounts for owners
 * Method: POST
 */
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
    const validCountries = ['US', 'CA']; // Add other supported countries as needed
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
      refresh_url: `${process.env.API_URL}/reauth`,
      return_url: `${process.env.API_URL}/return`,
      type: 'account_onboarding',
    });

    // Save the Stripe account ID in Firestore associated with the ownerId
    const ownerId = req.user.uid;
    await db.collection('owners').doc(ownerId).set(
      { stripeAccountId: account.id },
      { merge: true }
    );

    logger.info(`Stripe connected account created for owner ${ownerId}: ${account.id}`);
    res.status(200).send({ url: accountLink.url });
  } catch (error) {
    logger.error("Error creating connected account:", error);
    res.status(500).send({ error: error.message });
  }
});

/**
 * Endpoint: /attach-bank-account
 * Description: Attach bank accounts to connected Stripe accounts
 * Method: POST
 */
app.post('/attach-bank-account', authenticate, async (req, res) => {
  try {
    const { token } = req.body;

    if (!token) {
      logger.warn("Missing token for attaching bank account");
      return res.status(400).json({ error: "Token is required" });
    }

    const ownerId = req.user.uid;

    // Fetch the owner's connected account ID from Firestore
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

    // Update Firestore with the attached bank account details
    await db.collection('owners').doc(ownerId).update({
      bankAccount: {
        bankName: bankAccount.bank_name || '',
        last4: bankAccount.last4 || '',
        country: bankAccount.country || '',
        routingNumber: bankAccount.routing_number || '',
        accountType: bankAccount.account_type || '',
        // Add other relevant fields as needed
      },
    });

    logger.info(`Bank account attached for owner ${ownerId}: ${bankAccount.id}`);
    res.status(200).json({ message: "Bank account attached successfully", bankAccount });
  } catch (error) {
    logger.error("Error attaching bank account:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Endpoint: /createListing
 * Description: Create a new listing
 * Method: POST
 */
app.post('/createListing', authenticate, async (req, res) => {
  try {
    const { listingDetails } = req.body;

    if (!listingDetails || typeof listingDetails !== 'object') {
      logger.warn("Invalid or missing listingDetails for listing creation");
      return res.status(400).json({ error: "listingDetails are required and must be an object" });
    }

    // Validate required fields within listingDetails
    const { title, description, price, category } = listingDetails;
    if (!title || !description || typeof price !== 'number' || price < 0 || !category) {
      return res.status(400).json({ error: "Title, description, price, and category are required and must be valid" });
    }

    const ownerId = req.user.uid;

    // Add additional fields as necessary, such as createdAt
    const newListing = {
      ...listingDetails,
      ownerId,
      createdAt: FieldValue.serverTimestamp(),
      status: 'active', // or other initial status
    };

    // Add the new listing to Firestore
    const listingRef = await db.collection('listings').add(newListing);

    logger.info(`Listing created successfully: ${listingRef.id} by owner ${ownerId}`);
    res.status(201).json({ message: "Listing created successfully", listingId: listingRef.id });
  } catch (error) {
    logger.error("Error creating listing:", error);
    res.status(500).json({ error: "Failed to create listing" });
  }
});

/**
 * Endpoint: /firebase-user/:uid
 * Description: Fetch Firebase user information
 * Method: GET
 */
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

/**
 * Endpoint: /admin/cleanupOrphanedRentalRequests
 * Description: Admin-only endpoint to cleanup orphaned rental requests
 * Method: POST
 */
app.post('/admin/cleanupOrphanedRentalRequests', authenticateAdmin, async (req, res) => {
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
          // Delete the rental request
          rentalBatch.delete(requestDoc.ref);
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
    res.status(200).send(`Cleanup complete. Total deletions: ${totalDeletions}`);
  } catch (error) {
    logger.error('Error removing orphaned rental requests:', error);
    res.status(500).send('Internal Server Error');
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
      const userId = paymentIntent.metadata.userId;

      try {
        if (paymentType === 'rental') {
          const ownerId = paymentIntent.metadata.ownerId;
          const rentalId = paymentIntent.metadata.rentalId;
          const perHour = parseFloat(paymentIntent.metadata.perHour);
          const currency = paymentIntent.currency;

          if (!ownerId || !rentalId || isNaN(perHour)) {
            logger.warn("Missing ownerId, rentalId, or invalid perHour in rental payment intent metadata");
            break;
          }

          // Record the transaction under the owner
          await db.collection('owners').doc(ownerId).collection('transactions').add({
            amount: perHour, // Amount in dollars
            description: `Payment for rental ${rentalId}`,
            transferId: paymentIntent.transfer_data.destination_payment,
            currency,
            createdAt: FieldValue.serverTimestamp(),
          });

          // Update the owner's available balance
          const ownerRef = db.collection('owners').doc(ownerId);
          await ownerRef.update({
            availableBalance: FieldValue.increment(perHour),
          });

          // Update the rental status to 'paid'
          await db.collection('rentals').doc(rentalId).update({
            status: 'paid',
            paymentIntentId: paymentIntent.id,
            paidAt: FieldValue.serverTimestamp(),
          });

          logger.info(`Rental ${rentalId} marked as paid and owner ${ownerId} notified.`);
        } else if (paymentType === 'classified') {
          const listingId = paymentIntent.metadata.listingId;
          const currency = paymentIntent.currency;

          if (!listingId) {
            logger.warn("Missing listingId in classified payment intent metadata");
            break;
          }

          // Update the classified listing status to 'paid'
          await db.collection('listings').doc(listingId).update({
            status: 'paid',
            paymentIntentId: paymentIntent.id,
            paidAt: FieldValue.serverTimestamp(),
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
      const userId = paymentIntent.metadata.userId;

      // Optional: Handle failed payments, notify users, etc.
      try {
        if (paymentType === 'rental') {
          const rentalId = paymentIntent.metadata.rentalId;

          if (rentalId) {
            await db.collection('rentals').doc(rentalId).update({
              status: 'payment_failed',
              paymentIntentId: paymentIntent.id,
              failedAt: FieldValue.serverTimestamp(),
            });

            logger.info(`Rental ${rentalId} marked as payment_failed.`);
          }
        } else if (paymentType === 'classified') {
          const listingId = paymentIntent.metadata.listingId;

          if (listingId) {
            await db.collection('listings').doc(listingId).update({
              status: 'payment_failed',
              paymentIntentId: paymentIntent.id,
              failedAt: FieldValue.serverTimestamp(),
            });

            logger.info(`Classified listing ${listingId} marked as payment_failed.`);
          }
        }
      } catch (error) {
        logger.error("Error processing payment_intent.payment_failed webhook:", error);
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
 * Trigger: Firestore Document Update
 */
exports.onRentalRequestApproved = onDocumentUpdated('owners/{ownerId}/rentalRequests/{rentalRequestId}', async (event) => {
  const before = event.data.before.data();
  const after = event.data.after.data();
  const { ownerId, rentalRequestId } = event.params;

  // Check if the status has changed to 'approved'
  if (before.status !== 'approved' && after.status === 'approved') {
    const renterId = after.renterId;
    const listingId = after.listingId;
    const rentalDate = after.rentalDate || FieldValue.serverTimestamp();

    if (!renterId || !listingId) {
      logger.error('Missing renterId or listingId in rental request.');
      return;
    }

    // Create a chat thread
    const messagesRef = db.collection('messages');
    const chatThread = {
      participants: [ownerId, renterId],
      messages: [],
      rentalRequestId,
      createdAt: FieldValue.serverTimestamp(),
    };

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
        createdAt: FieldValue.serverTimestamp(),
      };

      await renterRef.collection('notifications').add(notification);
      logger.info(`Notification sent to renter ${renterId} for rental request ${rentalRequestId}.`);
    } else {
      logger.warn(`Renter document does not exist for renterId: ${renterId}`);
    }

    logger.info(`Rental request ${rentalRequestId} approved and chat thread created.`);
  }

  return null;
});

/**
 * Function: notifyNewMessage
 * Trigger: Firestore Document Creation
 */
exports.notifyNewMessage = onDocumentCreated('messages/{chatThreadId}/messages/{messageId}', async (snap, context) => {
  const { chatThreadId } = context.params;
  const messageData = snap.data();

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

  try {
    const response = await admin.messaging().sendToDevice(tokens, payload);
    logger.info('Notifications sent successfully:', response);
  } catch (error) {
    logger.error('Error sending notifications:', error);
  }

  return null;
});

/**
 * Function: onListingDeleted
 * Trigger: Firestore Document Deletion
 */
exports.onListingDeleted = onDocumentDeleted('airplanes/{listingId}', async (snap, context) => {
  const { listingId } = context.params;

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
      const renterId = requestData.renterId;
      const chatThreadId = requestData.chatThreadId;

      // Delete rental request
      rentalBatch.delete(requestDoc.ref);
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
      logger.info(`Committed ${totalDeletions} deletions for listing ${listingId}.`);
    } else {
      logger.info(`No deletions needed for listing ${listingId}.`);
    }

    // Step 2: Delete images from Firebase Storage
    const images = snap.data().images || [];
    const deletePromises = images.map(imageUrl => {
      // Extract the file path from the URL
      const filePath = imageUrl.split('/').slice(-2).join('/'); // Adjust based on your storage structure
      return storage.file(filePath).delete().catch(err => {
        logger.error(`Failed to delete image ${filePath}:`, err);
      });
    });

    await Promise.all(deletePromises);
    logger.info(`Deleted ${images.length} images for listing ${listingId}.`);
  } catch (error) {
    logger.error(`Error deleting associated data for listing ${listingId}:`, error);
  }

  return null;
});

// =====================
// Scheduled Cleanup Function
// =====================
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
          // Delete the rental request
          rentalBatch.delete(requestDoc.ref);
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
        logger.info(`Committed ${totalDeletions} deletions for owner ${ownerId}.`);
      } else {
        logger.info(`No orphaned rental requests found for owner ${ownerId}.`);
      }
    }

    logger.info(`Scheduled cleanup completed. Total deletions: ${totalDeletions}`);
    return null;
  } catch (error) {
    logger.error('Error during scheduled cleanup:', error);
    throw new Error('Scheduled cleanup failed.');
  }
});

// =====================
// New Cloud Function: syncRentalRequestToOwner
// =====================

/**
 * Function: syncRentalRequestToOwner
 * Trigger: Firestore Document Creation
 * Description: Synchronize rental requests from renters to owners
 */
exports.syncRentalRequestToOwner = onDocumentCreated("renters/{renterId}/rentalRequests/{rentalRequestId}", async (snap, context) => {
  const { renterId, rentalRequestId } = context.params;
  const rentalRequest = snap.data();

  const ownerId = rentalRequest.ownerId;

  if (!ownerId) {
    console.error(`Rental request ${rentalRequestId} is missing ownerId.`);
    return;
  }

  const ownerRentalRequestRef = db
    .collection("owners")
    .doc(ownerId)
    .collection("rentalRequests")
    .doc(rentalRequestId);

  try {
    await ownerRentalRequestRef.set({
      ...rentalRequest,
      rentalRequestId: rentalRequestId,
    });
    console.log(`Synchronized rental request ${rentalRequestId} to owner ${ownerId}.`);
  } catch (error) {
    console.error(`Error syncing rental request to owner: ${error}`);
  }
});

// =====================
// Export Express App as Firebase Function
// =====================
exports.api = onRequest(app);
