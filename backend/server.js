require('dotenv').config();

// ===================== 
// Imports
// =====================
const express = require('express');
const cors = require('cors');
const admin = require('firebase-admin');
const Stripe = require('stripe');
const bodyParser = require('body-parser');

// Firebase Functions v2 imports
const { onRequest } = require('firebase-functions/v2/https');
const { onDocumentCreated, onDocumentUpdated, onDocumentDeleted } = require('firebase-functions/v2/firestore');
const { onSchedule } = require('firebase-functions/v2/scheduler');

// =====================
// Initialize Firebase Admin SDK
// =====================
admin.initializeApp({
  credential: admin.credential.applicationDefault(),
  storageBucket: 'ready-set-fly-71506.appspot.com', // Replace with your storage bucket
});
const db = admin.firestore();
const storageBucket = admin.storage().bucket();

// FIX: Define admin.logger if it is undefined.
if (!admin.logger) {
  admin.logger = console;
}

// =====================
// Configuration Constants
// =====================
const ALLOWED_PACKAGES = ['Basic', 'Featured', 'Enhanced']; // Note: 'FreeTrial' is handled separately.
const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
const stripe = Stripe(stripeSecretKey);
const stripeWebhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

// =====================
// Initialize Express App
// =====================
const app = express();
app.use(cors({ origin: true }));

/**
 * ===============================
 * Stripe Webhook Endpoint (raw body needed)
 * IMPORTANT: We define this route BEFORE the JSON/body-parsing middleware
 * so that req.body remains raw for Stripe's signature check.
 * ===============================
 */
app.post(
  '/webhook',
  bodyParser.raw({ type: 'application/json' }),
  async (req, res) => {
    const sig = req.headers['stripe-signature'];
    let event;
    try {
      event = stripe.webhooks.constructEvent(req.body, sig, stripeWebhookSecret);
      admin.logger.info(`Received Stripe event: ${event.type}`);
    } catch (err) {
      admin.logger.error(`Webhook signature verification failed: ${err.message}`);
      res.setHeader('Content-Type', 'application/json');
      return res.status(400).json({ error: `Webhook Error: ${err.message}` });
    }

    try {
      // Handle Stripe events
      switch (event.type) {
        case 'payment_intent.created': {
          const paymentIntent = event.data.object;
          admin.logger.info(`PaymentIntent created: ${paymentIntent.id}`);
          // Additional handling for created events can be added here if needed.
          break;
        }
        case 'payment_intent.succeeded': {
          const paymentIntent = event.data.object;
          admin.logger.info(`PaymentIntent succeeded: ${paymentIntent.id}`);
          const { listingId, ownerId, rentalRequestId } = paymentIntent.metadata;

          // Update classified listing if applicable.
          if (listingId && ownerId) {
            const listingRef = db.collection('listings').doc(listingId);
            const listingDoc = await listingRef.get();
            if (!listingDoc.exists) {
              admin.logger.warn(`Listing not found for listingId: ${listingId}`);
            } else {
              await listingRef.update({
                status: 'active',
                paymentStatus: 'succeeded',
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
              });
              admin.logger.info(`Listing ${listingId} updated to active.`);
            }
          }

          // Update rental request if applicable.
          if (rentalRequestId && ownerId) {
            const rentalRequestRef = db.collection('rentalRequests').doc(rentalRequestId);
            const rentalRequestDoc = await rentalRequestRef.get();
            if (!rentalRequestDoc.exists) {
              admin.logger.warn(`Rental request not found: ${rentalRequestId}`);
            } else {
              await rentalRequestRef.update({
                paymentStatus: 'succeeded',
                status: 'active',
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
              });
              admin.logger.info(`Rental request ${rentalRequestId} updated to active.`);
            }

            // *** NEW: Update the owner's availableBalance with net funds ***
            // The owner should receive 94% of the base rental fee.
            // In CheckoutScreen, totalAmount = baseFee * 1.1725, where baseFee = hourly rate * hours.
            // Platform fee should be 23.25% of baseFee, i.e., total platform fee = baseFee * 0.2325.
            // Therefore, application_fee_amount = totalAmount * (0.2325 / 1.1725)
            const totalAmount = paymentIntent.amount; // in cents
            const platformFeePercentage = 0.2325; // 23.25% of base fee
            const totalMultiplier = 1.1725; // Total = base fee + fees
            const applicationFee =
              paymentIntent.application_fee_amount ||
              Math.round(totalAmount * (platformFeePercentage / totalMultiplier));
            const netAmount = totalAmount - applicationFee;
            await db.collection('users').doc(ownerId).update({
              availableBalance: admin.firestore.FieldValue.increment(netAmount)
            });
            admin.logger.info(`Owner ${ownerId} availableBalance incremented by ${netAmount} cents.`);
          }
          break;
        }
        case 'payment_intent.payment_failed': {
          const paymentIntent = event.data.object;
          admin.logger.info(`PaymentIntent payment failed: ${paymentIntent.id}`);
          // Additional handling for payment failures can be added here if needed.
          break;
        }
        case 'payment_intent.canceled': {
          const paymentIntent = event.data.object;
          admin.logger.info(`PaymentIntent canceled: ${paymentIntent.id}`);
          // Additional handling for canceled payments can be added here if needed.
          break;
        }
        case 'charge.refunded': {
          const charge = event.data.object;
          admin.logger.info(`Charge refunded: ${charge.id}`);
          // Additional handling for refunds can be added here if needed.
          break;
        }
        case 'charge.dispute.created': {
          const dispute = event.data.object;
          admin.logger.info(`Charge dispute created: ${dispute.id}`);
          // Additional handling for dispute creation can be added here if needed.
          break;
        }
        case 'account.updated': {
          const account = event.data.object;
          admin.logger.info(`Account updated: ${account.id}`);
          // Additional handling for account updates can be added here if needed.
          break;
        }
        case 'payout.paid': {
          const payout = event.data.object;
          admin.logger.info(`Payout paid: ${payout.id}`);
          // Additional handling for paid payouts can be added here if needed.
          break;
        }
        default:
          admin.logger.warn(`Unhandled event type ${event.type}`);
      }
    } catch (err) {
      // Log any error that occurs during processing but don't throw it.
      admin.logger.error(`Error processing event ${event.id}: ${err.message}`, err);
    }

    // Always respond with 200 to prevent Stripe from retrying the event.
    res.setHeader('Content-Type', 'application/json');
    res.json({ received: true });
  }
);

// =====================
// Global Body Parsing Middleware
// =====================
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// =====================
// Middleware for Firebase ID Token Authentication
// =====================
const authenticate = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    admin.logger.warn('Unauthorized: No token provided.');
    res.setHeader('Content-Type', 'application/json');
    return res.status(401).json({ error: 'Unauthorized: No token provided' });
  }
  const idToken = authHeader.split('Bearer ')[1];
  try {
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    req.user = decodedToken;
    next();
  } catch (error) {
    admin.logger.error('Error verifying Firebase ID token:', error);
    res.setHeader('Content-Type', 'application/json');
    return res.status(401).json({ error: 'Unauthorized: Invalid token' });
  }
};

// =====================
// Helper Functions
// =====================
const sanitizeData = (data) => {
  const sanitized = {};
  for (const key in data) {
    if (data.hasOwnProperty(key)) {
      sanitized[key] =
        typeof data[key] === 'string' ? data[key].trim() : data[key];
    }
  }
  return sanitized;
};

const calculateTotalCost = (packageType) => {
  const packagePrices = { Basic: 2500, Featured: 7000, Enhanced: 15000 };
  return packagePrices[packageType] || 2500;
};

const sendNotification = async (tokens, title, body, data = {}) => {
  const payload = {
    notification: { title, body },
    data,
  };
  try {
    const response = await admin.messaging().sendToDevice(tokens, payload);
    admin.logger.info('Notifications sent successfully:', response);
  } catch (error) {
    admin.logger.error('Error sending notifications:', error);
  }
};

// ===================================================================
// Routes: Listings
// ===================================================================

// POST /createListing
app.post('/createListing', authenticate, async (req, res) => {
  try {
    admin.logger.info(`User ${req.user.uid} creating a listing`);
    const listingDetailsRaw = req.body.listingDetails;
    if (!listingDetailsRaw) {
      admin.logger.warn("Missing 'listingDetails' in request body");
      res.setHeader('Content-Type', 'application/json');
      return res.status(400).json({ error: "Missing 'listingDetails' in request body" });
    }
    let listingDetails;
    try {
      listingDetails =
        typeof listingDetailsRaw === 'string'
          ? JSON.parse(listingDetailsRaw)
          : listingDetailsRaw;
      admin.logger.info(`Parsed listingDetails: ${JSON.stringify(listingDetails)}`);
    } catch (parseError) {
      admin.logger.error('Error parsing listingDetails:', parseError);
      res.setHeader('Content-Type', 'application/json');
      return res.status(400).json({ error: "Invalid JSON in 'listingDetails'" });
    }
    // Destructure common fields
    const {
      title,
      tailNumber,
      salePrice,
      description,
      city,
      state,
      email,
      phone,
      companyName,
      jobTitle,
      jobDescription,
      category,
      flightSchoolName,
      flightSchoolDetails,
      isFreeListing,
      selectedPricing,
      lat,
      lng,
      images,
      // ADDING new field for 'Aircraft for Sale'
      airportIdentifier
    } = sanitizeData(listingDetails);

    // Updated category requirements for Flight Schools
    const categoryRequirements = {
      'Aircraft for Sale': ['title', 'description', 'airportIdentifier'],
      'Aviation Jobs': ['companyName', 'jobTitle', 'jobDescription'],
      'Flight Schools': ['flightSchoolDetails'],
      'Flight Instructors': [
        'firstName',
        'lastName',
        'certifications',
        'fiEmail',
        'fiDescription',
        'serviceLocations',
      ],
      'Aviation Mechanic': [
        'amFirstName',
        'amLastName',
        'amCertifications',
        'amEmail',
        'amDescription',
        'amServiceLocations',
      ],
    };

    const requiredFields = categoryRequirements[category];
    if (!requiredFields) {
      admin.logger.warn(`Invalid category: ${category}`);
      res.setHeader('Content-Type', 'application/json');
      return res.status(400).json({ error: `Invalid category: ${category}` });
    }

    let freeListing = isFreeListing === 'true' || isFreeListing === true;

    if (selectedPricing === 'FreeTrial') {
      freeListing = true;
    }

    let finalRequiredFields = [...requiredFields];
    if (category === 'Aircraft for Sale' && !freeListing) {
      finalRequiredFields.push('salePrice', 'selectedPricing');
    }
    const missingFields = finalRequiredFields.filter(
      (field) => !listingDetails[field]
    );
    if (missingFields.length > 0) {
      admin.logger.warn(`Missing required fields: ${missingFields.join(', ')}`);
      res.setHeader('Content-Type', 'application/json');
      return res.status(400).json({ error: `Missing required fields: ${missingFields.join(', ')}` });
    }
    // For Flight Schools, only the flightSchoolDetails object is expected.
    // Ensure that flightSchoolDetails exists and has a non-empty flightSchoolEmail.
    if (category === 'Flight Schools') {
      if (
        !listingDetails.flightSchoolDetails ||
        !listingDetails.flightSchoolDetails.flightSchoolEmail
      ) {
        admin.logger.warn('Missing required field: flightSchoolDetails.flightSchoolEmail');
        res.setHeader('Content-Type', 'application/json');
        return res.status(400).json({ error: 'Missing required field: flightSchoolDetails.flightSchoolEmail' });
      }
    }
    if (!lat || !lng) {
      admin.logger.warn('Missing location data in request');
      res.setHeader('Content-Type', 'application/json');
      return res.status(400).json({ error: 'Missing location data (lat, lng)' });
    }
    const latitude = parseFloat(lat);
    const longitude = parseFloat(lng);
    if (isNaN(latitude) || isNaN(longitude)) {
      admin.logger.warn('Invalid location numbers');
      res.setHeader('Content-Type', 'application/json');
      return res.status(400).json({
        error: "Invalid location data. 'lat' and 'lng' must be numbers.",
      });
    }

    let finalSalePrice = 0;
    let finalPackageCost = 0;
    if (freeListing) {
      finalSalePrice = 0;
      finalPackageCost = 0;
    } else {
      let salePriceString = salePrice;
      if (typeof salePrice !== 'string') {
        salePriceString = salePrice.toString();
      }
      const sanitizedSalePrice = salePriceString.replace(/[^0-9.]/g, '');
      const parsedSalePrice = parseFloat(sanitizedSalePrice);
      if (isNaN(parsedSalePrice) || parsedSalePrice <= 0) {
        admin.logger.warn(`Invalid salePrice: ${salePrice}`);
        res.setHeader('Content-Type', 'application/json');
        return res.status(400).json({ error: 'Invalid salePrice. It must be a positive number.' });
      }
      finalSalePrice = parsedSalePrice;
      finalPackageCost = calculateTotalCost(selectedPricing);
    }

    const imageUrls = Array.isArray(images) ? images : [];
    const listingData = {
      title: title || '',
      tailNumber: tailNumber || '',
      salePrice: finalSalePrice,
      description: description || '',
      city: city || '',
      state: state || '',
      email: email || '',
      phone: phone || '',
      companyName: companyName || '',
      jobTitle: jobTitle || '',
      jobDescription: jobDescription || '',
      category: category || '',
      flightSchoolName: flightSchoolName || '',
      flightSchoolDetails: flightSchoolDetails || '',
      isFreeListing: freeListing,
      packageType: freeListing ? null : selectedPricing,
      packageCost: freeListing ? 0 : finalPackageCost,
      location: { lat: latitude, lng: longitude },
      images: imageUrls,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      ownerId: req.user.uid,
      status: 'pending',

      // Storing new airportIdentifier for 'Aircraft for Sale'
      airportIdentifier: airportIdentifier || '',
    };

    if (freeListing && selectedPricing === 'FreeTrial') {
      listingData.trialExpiry = admin.firestore.Timestamp.fromDate(new Date(Date.now() + 14 * 24 * 60 * 60 * 1000));
    }

    const listingRef = await db.collection('listings').add(listingData);
    res.setHeader('Content-Type', 'application/json');
    res.status(201).json({ success: true, listingId: listingRef.id });
  } catch (error) {
    const errorMessage = error && error.message ? error.message : 'Internal Server Error';
    admin.logger.error('Error in /createListing:', error);
    res.setHeader('Content-Type', 'application/json');
    res.status(500).json({ error: errorMessage });
  }
});

// PUT /updateListing
app.put('/updateListing', authenticate, async (req, res) => {
  try {
    const { listingId, listingDetails } = req.body;
    admin.logger.info(`Updating listing ${listingId} by user ${req.user.uid}`);
    if (!listingId || !listingDetails) {
      res.setHeader('Content-Type', 'application/json');
      return res.status(400).json({ error: 'Missing listingId or listingDetails' });
    }
    const listingRef = db.collection('listings').doc(listingId);
    const listingDoc = await listingRef.get();
    if (!listingDoc.exists) {
      res.setHeader('Content-Type', 'application/json');
      return res.status(404).json({ error: 'Listing not found' });
    }
    const listingData = listingDoc.data();
    if (listingData.ownerId !== req.user.uid) {
      res.setHeader('Content-Type', 'application/json');
      return res.status(403).json({ error: 'You do not own this listing' });
    }
    let parsedListingDetails = typeof listingDetails === 'string'
      ? JSON.parse(listingDetails)
      : listingDetails;
    const sanitizedListingDetails = sanitizeData(parsedListingDetails);

    // Updated category requirements for Flight Schools
    const categoryRequirements = {
      'Aircraft for Sale': ['title', 'description', 'airportIdentifier'],
      'Aviation Jobs': ['companyName', 'jobTitle', 'jobDescription'],
      'Flight Schools': ['flightSchoolDetails'],
      'Flight Instructors': ['firstName', 'lastName', 'certifications', 'fiEmail', 'fiDescription', 'serviceLocations'],
      'Aviation Mechanic': ['amFirstName', 'amLastName', 'amCertifications', 'amEmail', 'amDescription', 'amServiceLocations'],
    };

    const reqCategoryRequirements = categoryRequirements[sanitizedListingDetails.category];
    if (!reqCategoryRequirements) {
      res.setHeader('Content-Type', 'application/json');
      return res.status(400).json({ error: `Invalid category: ${sanitizedListingDetails.category}` });
    }

    let freeListing = sanitizedListingDetails.isFreeListing === 'true' || sanitizedListingDetails.isFreeListing === true;
    if (sanitizedListingDetails.selectedPricing === 'FreeTrial') {
      freeListing = true;
    }

    if (!freeListing && (!sanitizedListingDetails.selectedPricing || (!ALLOWED_PACKAGES.includes(sanitizedListingDetails.selectedPricing) && sanitizedListingDetails.selectedPricing !== 'FreeTrial'))) {
      res.setHeader('Content-Type', 'application/json');
      return res.status(400).json({ error: 'Invalid or missing selectedPricing.' });
    }
    let finalRequiredFields = [...reqCategoryRequirements];
    if (sanitizedListingDetails.category === 'Aircraft for Sale' && !freeListing) {
      finalRequiredFields.push('salePrice', 'selectedPricing');
    }
    const missingFields = finalRequiredFields.filter((field) => !sanitizedListingDetails[field]);
    if (missingFields.length > 0) {
      res.setHeader('Content-Type', 'application/json');
      return res.status(400).json({ error: `Missing required fields: ${missingFields.join(', ')}` });
    }
    // For Flight Schools, ensure that flightSchoolDetails exists and has a non-empty flightSchoolEmail.
    if (sanitizedListingDetails.category === 'Flight Schools') {
      if (
        !sanitizedListingDetails.flightSchoolDetails ||
        !sanitizedListingDetails.flightSchoolDetails.flightSchoolEmail
      ) {
        res.setHeader('Content-Type', 'application/json');
        return res.status(400).json({ error: 'Missing required field: flightSchoolDetails.flightSchoolEmail' });
      }
    }
    if (!sanitizedListingDetails.lat || !sanitizedListingDetails.lng) {
      res.setHeader('Content-Type', 'application/json');
      return res.status(400).json({ error: 'Missing location data (lat, lng)' });
    }
    const latitude = parseFloat(sanitizedListingDetails.lat);
    const longitude = parseFloat(sanitizedListingDetails.lng);
    if (isNaN(latitude) || isNaN(longitude)) {
      res.setHeader('Content-Type', 'application/json');
      return res.status(400).json({ error: "Invalid location data. 'lat' and 'lng' must be numbers." });
    }

    let finalSalePrice = listingData.salePrice;
    let finalPackageCost = listingData.packageCost;
    let finalPackageType = listingData.packageType;
    if (freeListing) {
      finalSalePrice = 0;
      finalPackageCost = 0;
      finalPackageType = null;
    } else {
      if (sanitizedListingDetails.salePrice && String(sanitizedListingDetails.salePrice).trim().toLowerCase() !== 'n/a') {
        const salePriceString = String(sanitizedListingDetails.salePrice).trim();
        const sanitizedSalePrice = salePriceString.replace(/[^0-9.]/g, '');
        const parsedSalePrice = parseFloat(sanitizedSalePrice);
        if (isNaN(parsedSalePrice) || parsedSalePrice <= 0) {
          res.setHeader('Content-Type', 'application/json');
          return res.status(400).json({ error: 'Invalid salePrice. It must be a positive number.' });
        }
        finalSalePrice = parsedSalePrice;
      }
      if (sanitizedListingDetails.selectedPricing) {
        finalPackageCost = calculateTotalCost(sanitizedListingDetails.selectedPricing);
        finalPackageType = sanitizedListingDetails.selectedPricing;
      }
    }
    const imageUrls = Array.isArray(sanitizedListingDetails.images) ? sanitizedListingDetails.images : [];
    const updateData = {
      title: sanitizedListingDetails.title || listingData.title,
      tailNumber: sanitizedListingDetails.tailNumber || listingData.tailNumber,
      salePrice: finalSalePrice,
      description: sanitizedListingDetails.description || listingData.description,
      city: sanitizedListingDetails.city || listingData.city,
      state: sanitizedListingDetails.state || listingData.state,
      email: sanitizedListingDetails.email || listingData.email,
      phone: sanitizedListingDetails.phone || listingData.phone,
      companyName: sanitizedListingDetails.companyName || listingData.companyName,
      jobTitle: sanitizedListingDetails.jobTitle || listingData.jobTitle,
      jobDescription: sanitizedListingDetails.jobDescription || listingData.jobDescription,
      category: sanitizedListingDetails.category || listingData.category,
      flightSchoolName: sanitizedListingDetails.flightSchoolName || listingData.flightSchoolName,
      flightSchoolDetails: sanitizedListingDetails.flightSchoolDetails || listingData.flightSchoolDetails,
      isFreeListing: freeListing,
      packageType: freeListing ? null : finalPackageType,
      packageCost: freeListing ? 0 : finalPackageCost,
      location: { lat: latitude, lng: longitude },
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),

      // Updating the airportIdentifier if present
      airportIdentifier: sanitizedListingDetails.airportIdentifier || listingData.airportIdentifier,
    };

    // If there are new images, update them
    if (imageUrls.length > 0) {
      updateData.images = imageUrls;
    }

    await listingRef.update(updateData);
    res.setHeader('Content-Type', 'application/json');
    res.status(200).json({ success: true, listingId });
  } catch (error) {
    const errorMessage = error && error.message ? error.message : 'Internal Server Error';
    admin.logger.error('Error in /updateListing:', error);
    res.setHeader('Content-Type', 'application/json');
    res.status(500).json({ error: errorMessage });
  }
});

// DELETE /deleteListing
app.delete('/deleteListing', authenticate, async (req, res) => {
  try {
    const { listingId } = req.body;
    if (!listingId) {
      res.setHeader('Content-Type', 'application/json');
      return res.status(400).json({ error: 'Missing listingId in request body' });
    }
    const listingRef = db.collection('listings').doc(listingId);
    const listingDoc = await listingRef.get();
    if (!listingDoc.exists) {
      res.setHeader('Content-Type', 'application/json');
      return res.status(404).json({ error: 'Listing not found' });
    }
    const listingData = listingDoc.data();
    if (listingData.ownerId !== req.user.uid) {
      res.setHeader('Content-Type', 'application/json');
      return res.status(403).json({ error: 'You do not own this listing' });
    }
    const imageUrls = listingData.images || [];
    const deletePromises = imageUrls.map(async (imageUrl) => {
      const filePathMatch = imageUrl.match(/\/o\/(.+?)\?/);
      if (filePathMatch && filePathMatch[1]) {
        const filePath = decodeURIComponent(filePathMatch[1]).replace(/%2F/g, '/');
        try {
          await storageBucket.file(filePath).delete();
          admin.logger.info(`Deleted image at path: ${filePath}`);
        } catch (err) {
          admin.logger.error(`Failed to delete image ${filePath}:`, err);
        }
      } else {
        admin.logger.warn(`Unable to extract file path from image URL: ${imageUrl}`);
      }
    });
    await Promise.all(deletePromises);
    await listingRef.delete();
    res.setHeader('Content-Type', 'application/json');
    res.status(200).json({ success: true, message: 'Listing deleted successfully' });
  } catch (error) {
    const errorMessage = error && error.message ? error.message : 'Internal Server Error';
    admin.logger.error('Error in /deleteListing:', error);
    res.setHeader('Content-Type', 'application/json');
    res.status(500).json({ error: errorMessage });
  }
});

// ===================================================================
// Payment Endpoints
// ===================================================================

// /create-classified-payment-intent remains largely unchanged
app.post('/create-classified-payment-intent', authenticate, async (req, res) => {
  try {
    const { amount, currency = 'usd', listingId, listingDetails } = req.body;
    const finalListingId = listingId || (listingDetails && listingDetails.id);
    if (typeof amount !== 'number' || finalListingId === '') {
      res.setHeader('Content-Type', 'application/json');
      return res.status(400).json({ error: 'Missing amount or listingId' });
    }
    const listingRef = db.collection('listings').doc(finalListingId);
    const listingDoc = await listingRef.get();
    if (!listingDoc.exists) {
      res.setHeader('Content-Type', 'application/json');
      return res.status(404).json({ error: 'Listing not found' });
    }
    const listingData = listingDoc.data();
    if (amount === 0) {
      await listingRef.update({
        status: 'trial',
        paymentStatus: 'free',
        trialExpiry: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      res.setHeader('Content-Type', 'application/json');
      return res.status(200).json({ clientSecret: null, freeListing: true });
    }
    const paymentIntent = await stripe.paymentIntents.create({
      amount,
      currency,
      metadata: {
        listingId: finalListingId,
        ownerId: listingData.ownerId,
      },
    });
    res.setHeader('Content-Type', 'application/json');
    res.status(200).json({ clientSecret: paymentIntent.client_secret });
  } catch (error) {
    const errorMessage = error.message || 'Internal Server Error';
    admin.logger.error('Error in /create-classified-payment-intent:', error);
    res.setHeader('Content-Type', 'application/json');
    res.status(500).json({ error: errorMessage });
  }
});

// Rental payment intent endpoint updated to use destination charges
app.post('/create-rental-payment-intent', authenticate, async (req, res) => {
  try {
    const { rentalRequestId, ownerId, amount: clientAmount, renterId } = req.body;
    if (!rentalRequestId || !ownerId) {
      res.setHeader('Content-Type', 'application/json');
      return res.status(400).json({ error: 'Missing rentalRequestId or ownerId' });
    }
    const parsedAmount = Number(clientAmount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      res.setHeader('Content-Type', 'application/json');
      return res.status(400).json({ error: 'Invalid payment amount provided.' });
    }
    const amount = parsedAmount;
    const rentalRequestRef = db.collection('rentalRequests').doc(rentalRequestId);
    const rentalRequestDoc = await rentalRequestRef.get();
    if (!rentalRequestDoc.exists) {
      res.setHeader('Content-Type', 'application/json');
      return res.status(404).json({ error: 'Rental request not found' });
    }
    const rentalRequest = rentalRequestDoc.data();
    if (rentalRequest.renterId !== req.user.uid) {
      res.setHeader('Content-Type', 'application/json');
      return res.status(403).json({ error: 'Unauthorized to pay for this rental request' });
    }
    await rentalRequestRef.update({ totalAmount: amount });

    // Fetch the owner's connected account ID from Firestore
    const ownerDoc = await db.collection('users').doc(ownerId).get();
    if (!ownerDoc.exists) {
      res.setHeader('Content-Type', 'application/json');
      return res.status(404).json({ error: 'Owner not found' });
    }
    const ownerData = ownerDoc.data();
    const connectedAccountId = ownerData.stripeAccountId;
    if (!connectedAccountId) {
      res.setHeader('Content-Type', 'application/json');
      return res.status(400).json({ error: 'Owner does not have a connected Stripe account' });
    }

    // Create a PaymentIntent using destination charges.
    // The total amount is calculated in CheckoutScreen (base fee plus fees).
    // To split the funds:
    //   Let B = base rental fee, then total = B * 1.1725.
    //   Platform fee should be 23.25% of B, which is: (B * 0.2325) = total * (0.2325 / 1.1725).
    const platformFeePercentage = 0.2325; // 23.25% of base fee
    const totalMultiplier = 1.1725; // total = base fee + fees
    const applicationFee = Math.round(amount * (platformFeePercentage / totalMultiplier));

    const paymentIntent = await stripe.paymentIntents.create({
      amount,
      currency: 'usd',
      payment_method_types: ['card'],
      transfer_data: {
        destination: connectedAccountId,
      },
      application_fee_amount: applicationFee,
      metadata: { rentalRequestId, ownerId, renterId: req.user.uid },
    });
    res.setHeader('Content-Type', 'application/json');
    res.status(200).json({ clientSecret: paymentIntent.client_secret });
  } catch (error) {
    const errorMessage = error.message || 'Internal Server Error';
    admin.logger.error('Error in /create-rental-payment-intent:', error);
    res.setHeader('Content-Type', 'application/json');
    res.status(500).json({ error: errorMessage });
  }
});

// Validate discount code endpoint
app.post('/validateDiscount', authenticate, async (req, res) => {
  try {
    const { discountCode, amount } = req.body;
    if (!discountCode || typeof amount !== 'number' || (amount <= 0 && discountCode.toUpperCase() !== 'RSF2005')) {
      res.setHeader('Content-Type', 'application/json');
      return res.status(400).json({ valid: false, message: 'Invalid request parameters' });
    }
    const discountCodes = {
      RSF2005: {
        type: 'free',
        value: 0,
        message:
          'Free 2 week listing activated! Your listing will auto renew and you will be charged for renewal after 2 weeks.',
      },
    };
    const discount = discountCodes[discountCode.toUpperCase()];
    if (!discount) {
      res.setHeader('Content-Type', 'application/json');
      return res.status(200).json({ valid: false, message: 'Invalid discount code.' });
    }
    let adjustedAmount = amount;
    let pricingTier = 'Basic';
    if (discount.type === 'free') {
      adjustedAmount = 0;
      pricingTier = 'FreeTrial';
    } else if (discount.type === 'percentage') {
      adjustedAmount = Math.round(amount * (1 - discount.value / 100));
      pricingTier = 'Featured';
    } else if (discount.type === 'fixed') {
      adjustedAmount = amount - discount.value;
      if (adjustedAmount < 0) adjustedAmount = 0;
      pricingTier = 'Enhanced';
    }
    res.setHeader('Content-Type', 'application/json');
    res.status(200).json({
      valid: true,
      adjustedAmount,
      pricingTier,
      message: discount.message,
    });
  } catch (error) {
    const errorMessage = error.message || 'Internal Server Error';
    admin.logger.error('Error in /validateDiscount:', error);
    res.setHeader('Content-Type', 'application/json');
    res.status(500).json({ valid: false, message: errorMessage });
  }
});

// ===================================================================
// Stripe & Bank Account Endpoints
// ===================================================================
app.post('/attach-bank-account', authenticate, async (req, res) => {
  try {
    const { ownerId, token, bankName } = req.body;
    if (!ownerId || !token || !bankName) {
      res.setHeader('Content-Type', 'application/json');
      return res.status(400).json({ error: 'Missing required fields: ownerId, token, bankName' });
    }
    const ownerRef = db.collection('users').doc(ownerId);
    const ownerDoc = await ownerRef.get();
    if (!ownerDoc.exists) {
      res.setHeader('Content-Type', 'application/json');
      return res.status(404).json({ error: 'Owner not found' });
    }
    const ownerData = ownerDoc.data();
    const connectedAccountId = ownerData.stripeAccountId;
    if (!connectedAccountId) {
      res.setHeader('Content-Type', 'application/json');
      return res.status(400).json({ error: 'Stripe account not connected' });
    }
    const bankAccount = await stripe.accounts.createExternalAccount(
      connectedAccountId,
      { external_account: token }
    );
    await db.collection('users').doc(ownerId).update({ bankAccountId: bankAccount.id, bankName });
    res.setHeader('Content-Type', 'application/json');
    res.status(200).json({ message: 'Bank account attached successfully', bankAccount });
  } catch (error) {
    const errorMessage = error.message || 'Internal Server Error';
    admin.logger.error('Error attaching bank account:', error);
    res.setHeader('Content-Type', 'application/json');
    res.status(500).json({ error: errorMessage });
  }
});

app.post('/create-connected-account', authenticate, async (req, res) => {
  try {
    const { ownerId, email, fullName } = req.body;
    if (!ownerId || !email || !fullName) {
      res.setHeader('Content-Type', 'application/json');
      return res.status(400).json({ error: 'Missing required fields: ownerId, email, fullName' });
    }
    const account = await stripe.accounts.create({
      type: 'custom',
      country: 'US',
      email,
      business_type: 'individual',
      individual: {
        first_name: fullName.split(' ')[0],
        last_name: fullName.split(' ').slice(1).join(' ') || '',
      },
      capabilities: { 
        transfers: { requested: true },
        card_payments: { requested: true }
      },
    });
    await db.collection('users').doc(ownerId).set({ stripeAccountId: account.id }, { merge: true });
    const accountLink = await stripe.accountLinks.create({
      account: account.id,
      refresh_url: 'https://ready-set-fly-71506.web.app/reauth', // Replace with your URL
      return_url: 'https://ready-set-fly-71506.firebaseapp.com/return',   // Replace with your URL
      type: 'account_onboarding',
    });
    res.setHeader('Content-Type', 'application/json');
    res.status(200).json({ message: 'Connected account created', accountLinkUrl: accountLink.url });
  } catch (error) {
    const errorMessage = error.message || 'Internal Server Error';
    admin.logger.error('Error creating connected account:', error);
    res.setHeader('Content-Type', 'application/json');
    res.status(500).json({ error: errorMessage });
  }
});

// NEW: Retrieve Existing Connected Account Endpoint
app.post('/retrieve-connected-account', authenticate, async (req, res) => {
  try {
    const { ownerId, email, fullName } = req.body;
    if (!ownerId || !email || !fullName) {
      res.setHeader('Content-Type', 'application/json');
      return res.status(400).json({ error: 'Missing required fields: ownerId, email, fullName' });
    }
    const ownerDoc = await db.collection('users').doc(ownerId).get();
    if (!ownerDoc.exists) {
      res.setHeader('Content-Type', 'application/json');
      return res.status(404).json({ error: 'Owner not found' });
    }
    const ownerData = ownerDoc.data();
    const stripeAccountId = ownerData.stripeAccountId;
    if (!stripeAccountId) {
      res.setHeader('Content-Type', 'application/json');
      return res.status(400).json({ error: 'No connected Stripe account found' });
    }
    // Optionally, retrieve additional details from Stripe
    const account = await stripe.accounts.retrieve(stripeAccountId);
    res.setHeader('Content-Type', 'application/json');
    res.status(200).json({ stripeAccountId: account.id, account });
  } catch (error) {
    const errorMessage = error.message || 'Internal Server Error';
    admin.logger.error('Error retrieving connected account:', error);
    res.setHeader('Content-Type', 'application/json');
    res.status(500).json({ error: errorMessage });
  }
});

// NEW: Get Stripe Balance Endpoint
app.get('/get-stripe-balance', authenticate, async (req, res) => {
  try {
    // Retrieve the owner's document using the UID from the decoded token
    const ownerDoc = await db.collection('users').doc(req.user.uid).get();
    if (!ownerDoc.exists) {
      return res.status(404).json({ error: 'Owner not found' });
    }
    const ownerData = ownerDoc.data();
    if (!ownerData.stripeAccountId) {
      return res.status(400).json({ error: 'Stripe account not connected' });
    }
    // IMPORTANT: Retrieve the connected account’s balance with correct parameters
    const balance = await stripe.balance.retrieve({}, { stripeAccount: ownerData.stripeAccountId });
    return res.status(200).json({ balance });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

// ===================================================================
// UPDATED Withdraw Funds Endpoint (commented out)
// ===================================================================
// The following withdraw funds endpoint is currently commented out
// in order to align with the new update to owner.js. This endpoint
// processed payouts. With the new changes, withdrawal is now
// informational only on the client-side.
// Uncomment the code below if you decide to re-enable withdrawals.

/*
// app.post('/withdraw-funds', authenticate, async (req, res) => {
//   try {
//     const { ownerId, amount, email } = req.body;
//     if (!ownerId || !amount || !email) {
//       res.setHeader('Content-Type', 'application/json');
//       return res.status(400).json({ error: 'Missing required fields: ownerId, amount, email' });
//     }
//
//     // Fetch the owner's document
//     const ownerRef = db.collection('users').doc(ownerId);
//     const ownerDoc = await ownerRef.get();
//     if (!ownerDoc.exists) {
//       res.setHeader('Content-Type', 'application/json');
//       return res.status(404).json({ error: 'Owner not found' });
//     }
//     const ownerData = ownerDoc.data();
//     const connectedAccountId = ownerData.stripeAccountId;
//     if (!connectedAccountId) {
//       res.setHeader('Content-Type', 'application/json');
//       return res.status(400).json({ error: 'Stripe account not connected' });
//     }
//
//     // Check if the owner has sufficient availableBalance (amount is in cents)
//     const currentBalance = ownerData.availableBalance || 0;
//     if (currentBalance < amount) {
//       res.setHeader('Content-Type', 'application/json');
//       return res.status(400).json({ error: 'Insufficient funds for withdrawal' });
//     }
//
//     // Deduct the withdrawal amount from availableBalance in Firestore via transaction
//     await db.runTransaction(async (transaction) => {
//       const ownerSnapshot = await transaction.get(ownerRef);
//       const balance = ownerSnapshot.get('availableBalance') || 0;
//       if (balance < amount) {
//         throw new Error('Insufficient funds for withdrawal');
//       }
//       transaction.update(ownerRef, { availableBalance: admin.firestore.FieldValue.increment(-amount) });
//     });
//
//     // Process the payout via Stripe
//     let payout;
//     try {
//       payout = await stripe.payouts.create(
//         { amount, currency: 'usd' },
//         { stripeAccount: connectedAccountId }
//       );
//     } catch (payoutError) {
//       // Roll back the balance deduction if payout fails
//       await ownerRef.update({ availableBalance: admin.firestore.FieldValue.increment(amount) });
//       throw payoutError;
//     }
//
//     // *** NEW: Update the owner's totalWithdrawn field in Firestore ***
//     await ownerRef.update({ totalWithdrawn: admin.firestore.FieldValue.increment(amount) });
//
//     res.setHeader('Content-Type', 'application/json');
//     res.status(200).json({ message: 'Withdrawal processed successfully', payout });
//   } catch (error) {
//     const errorMessage = error.message || 'Internal Server Error';
//     admin.logger.error('Error processing withdrawal:', error);
//     res.setHeader('Content-Type', 'application/json');
//     res.status(500).json({ error: errorMessage });
//   }
// });
*/

// ===================================================================
// Firestore-Triggered Functions
// ===================================================================

exports.onMessageSent = onDocumentCreated('messages/{messageId}', async (snapshot, context) => {
  const { messageId } = context.params;
  const messageData = snapshot.data();
  const { recipients, text, chatThreadId, senderId } = messageData;
  if (!recipients || !Array.isArray(recipients)) {
    admin.logger.warn(`Invalid recipients for message ${messageId}`);
    return null;
  }
  const tokens = [];
  try {
    for (const recipientId of recipients) {
      const ownerRef = db.collection('owners').doc(recipientId);
      const ownerDoc = await ownerRef.get();
      if (ownerDoc.exists) {
        const ownerData = ownerDoc.data();
        if (ownerData.fcmToken) tokens.push(ownerData.fcmToken);
      }
      const renterRef = db.collection('renters').doc(recipientId);
      // getDoc is not a standard Firestore method in Node admin—assuming you have a helper or it’s a snippet
      const renterDoc = await getDoc(renterRef);
      if (renterDoc.exists) {
        const renterData = renterDoc.data();
        if (renterData.fcmToken) tokens.push(renterData.fcmToken);
      }
    }
    if (tokens.length === 0) {
      admin.logger.warn('No FCM tokens found for recipients.');
      return null;
    }
    const payload = {
      notification: {
        title: 'New Message',
        body: text.length > 50 ? `${text.substring(0, 47)}...` : text,
        click_action: 'FLUTTER_NOTIFICATION_CLICK',
      },
      data: { chatThreadId, senderId },
    };
    const response = await admin.messaging().sendToDevice(tokens, payload);
    admin.logger.info('Notifications sent:', response);
  } catch (error) {
    admin.logger.error('Error sending notifications:', error);
  }
  return null;
});

exports.onListingDeleted = onDocumentDeleted('listings/{listingId}', async (snapshot, context) => {
  const { listingId } = context.params;
  const deletedData = snapshot.data();
  try {
    let totalDeletions = 0;
    const rentalRequestsRef = db.collectionGroup('rentalRequests').where('listingId', '==', listingId);
    const rentalRequestsSnapshot = await rentalRequestsRef.get();
    admin.logger.info(`Found ${rentalRequestsSnapshot.size} rental requests for listing ${listingId}.`);
    const rentalBatch = db.batch();
    rentalRequestsSnapshot.forEach((docSnap) => {
      rentalBatch.delete(docSnap.ref);
      totalDeletions++;
    });
    await rentalBatch.commit();
    admin.logger.info(`Deleted ${totalDeletions} associated rental requests for listing ${listingId}.`);

    const imageUrls = deletedData.images || [];
    const deletePromises = imageUrls.map(async (imageUrl) => {
      const filePathMatch = imageUrl.match(/\/o\/(.+?)\?/);
      if (filePathMatch && filePathMatch[1]) {
        const filePath = decodeURIComponent(filePathMatch[1]).replace(/%2F/g, '/');
        try {
          await storageBucket.file(filePath).delete();
          admin.logger.info(`Deleted image at: ${filePath}`);
        } catch (err) {
          admin.logger.error(`Error deleting image ${filePath}:`, err);
        }
      } else {
        admin.logger.warn(`Could not extract file path from ${imageUrl}`);
      }
    });
    await Promise.all(deletePromises);
  } catch (error) {
    admin.logger.error(`Error deleting data for listing ${listingId}:`, error);
  }
  return null;
});

exports.handleAircraftDetails = onDocumentCreated('aircraftDetails/{ownerId}', async (snapshot, context) => {
  const ownerId = context.params.ownerId;
  const newData = snapshot.data();
  admin.logger.info(`New aircraftDetails for ownerId: ${ownerId}`);
  const updatedData = {
    profileData: sanitizeData(newData.profileData || {}),
    aircraftDetails: sanitizeData(newData.aircraftDetails || {}),
    costData: sanitizeData(newData.costData || {}),
    selectedAircraftIds: newData.selectedAircraftIds || [],
    additionalAircrafts: newData.additionalAircrafts || [],
  };
  try {
    await db.collection('aircraftDetails').doc(ownerId).set(updatedData, { merge: true });
    admin.logger.info(`Initialized aircraftDetails for ownerId: ${ownerId}`);
  } catch (error) {
    admin.logger.error(`Error initializing aircraftDetails for ownerId ${ownerId}:`, error);
  }
  return null;
});

exports.handleAircraftDetailsUpdate = onDocumentUpdated('aircraftDetails/{ownerId}', async (snapshot, context) => {
  const ownerId = context.params.ownerId;
  const beforeData = snapshot.before.data();
  const afterData = snapshot.after.data();
  admin.logger.info(`AircraftDetails updated for ownerId: ${ownerId}`);

  if (JSON.stringify(beforeData.profileData) !== JSON.stringify(afterData.profileData)) {
    admin.logger.info(`Profile data updated for ownerId: ${ownerId}`);
    if (beforeData.profileData.displayName !== afterData.profileData.displayName) {
      try {
        const fcmToken = afterData.profileData.fcmToken;
        if (fcmToken) {
          await sendNotification([fcmToken], 'Profile Updated', 'Your profile has been updated.');
        }
      } catch (error) {
        admin.logger.error(`Error sending profile update notification for ownerId ${ownerId}:`, error);
      }
    }
  }

  if (JSON.stringify(beforeData.aircraftDetails) !== JSON.stringify(afterData.aircraftDetails)) {
    admin.logger.info(`Aircraft details updated for ownerId: ${ownerId}`);
  }

  if (JSON.stringify(beforeData.costData) !== JSON.stringify(afterData.costData)) {
    admin.logger.info(`Cost data updated for ownerId: ${ownerId}`);
    const costData = afterData.costData;
    const { purchasePrice, loanAmount, interestRate, loanTerm, depreciationRate, rentalHoursPerYear, insuranceCost, hangarCost, maintenanceReserve, annualRegistrationFees, fuelCostPerHour, oilCostPerHour, routineMaintenancePerHour, tiresPerHour, otherConsumablesPerHour } = costData;
    if (purchasePrice && loanAmount && interestRate && loanTerm && depreciationRate && rentalHoursPerYear) {
      const monthlyInterestRate = parseFloat(interestRate) / 100 / 12;
      const numberOfPayments = parseFloat(loanTerm) * 12;
      const principal = parseFloat(loanAmount);
      const mortgageExpense = principal
        ? (principal * monthlyInterestRate) / (1 - Math.pow(1 + monthlyInterestRate, -numberOfPayments))
        : 0;
      const depreciationExpense = (parseFloat(purchasePrice) * parseFloat(depreciationRate)) / 100;
      const totalFixedCosts = parseFloat(mortgageExpense) * 12 + parseFloat(depreciationExpense) + parseFloat(insuranceCost || 0) + parseFloat(hangarCost || 0) + parseFloat(maintenanceReserve || 0) + parseFloat(annualRegistrationFees || 0);
      const totalVariableCosts = (parseFloat(fuelCostPerHour || 0) + parseFloat(oilCostPerHour || 0) + parseFloat(routineMaintenancePerHour || 0) + parseFloat(tiresPerHour || 0) + parseFloat(otherConsumablesPerHour || 0)) * parseFloat(rentalHoursPerYear);
      const totalCostPerYear = totalFixedCosts + totalVariableCosts;
      const costPerHour = parseFloat((totalCostPerYear / parseFloat(rentalHoursPerYear)).toFixed(2));
      try {
        await db.collection('aircraftDetails').doc(ownerId).update({
          'costData.mortgageExpense': parseFloat(mortgageExpense),
          'costData.depreciationExpense': parseFloat(depreciationExpense),
          'costData.costPerHour': costPerHour,
        });
        admin.logger.info(`Updated costPerHour for ownerId: ${ownerId}`);
      } catch (error) {
        admin.logger.error(`Error updating costPerHour for ownerId ${ownerId}:`, error);
      }
    }
  }

  if (JSON.stringify(beforeData.selectedAircraftIds) !== JSON.stringify(afterData.selectedAircraftIds)) {
    admin.logger.info(`Selected aircraft IDs updated for ownerId: ${ownerId}`);
    const selectedIds = afterData.selectedAircraftIds || [];
    const additionalAircrafts = afterData.additionalAircrafts || [];
    const validAircraftIds = [ownerId, ...additionalAircrafts.map(ac => ac.id)];
    const invalidSelectedIds = selectedIds.filter(id => !validAircraftIds.includes(id));
    if (invalidSelectedIds.length > 0) {
      const updatedSelectedIds = selectedIds.filter(id => validAircraftIds.includes(id));
      try {
        await db.collection('aircraftDetails').doc(ownerId).update({ selectedAircraftIds: updatedSelectedIds });
        admin.logger.info(`Removed invalid selectedAircraftIds for ownerId: ${ownerId}`);
      } catch (error) {
        admin.logger.error(`Error removing invalid selectedAircraftIds for ownerId ${ownerId}:`, error);
      }
    }
  }
  return null;
});

exports.scheduledCleanupOrphanedRentalRequests = onSchedule('every 24 hours', async (event) => {
  try {
    let totalDeletions = 0;
    const ownersSnapshot = await db.collection('owners').get();
    admin.logger.info(`Fetched ${ownersSnapshot.size} owners for cleanup.`);
    for (const ownerDoc of ownersSnapshot.docs) {
      const ownerId = ownerDoc.id;
      const rentalRequestsRef = db.collection('owners').doc(ownerId).collection('rentalRequests');
      const rentalRequestsSnapshot = await rentalRequestsRef.get();
      const rentalBatch = db.batch();
      for (const requestDoc of rentalRequestsSnapshot.docs) {
        const requestData = requestDoc.data();
        const createdAt = requestData.createdAt;
        const thirtyDaysAgo = admin.firestore.Timestamp.fromDate(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000));
        if (createdAt && createdAt.toDate() < thirtyDaysAgo.toDate() && requestData.status !== 'active') {
          rentalBatch.delete(requestDoc.ref);
          totalDeletions++;
        }
      }
      if (totalDeletions > 0) {
        await rentalBatch.commit();
        admin.logger.info(`Deleted ${totalDeletions} orphaned rental requests for owner ${ownerId}.`);
      }
    }
    admin.logger.info(`Scheduled cleanup complete. Total deletions: ${totalDeletions}`);
    return null;
  } catch (error) {
    admin.logger.error('Scheduled cleanup error:', error);
    throw new Error('Cleanup failed.');
  }
});

exports.closeExpiredMessaging = onSchedule('every 1 hours', async (event) => {
  try {
    const now = new Date();
    const rentalRequestsSnapshot = await db.collection('rentalRequests').get();
    let batch = db.batch();
    let updateCount = 0;
    rentalRequestsSnapshot.forEach(docSnap => {
      const data = docSnap.data();
      if (data.rentalDate && !data.messagingClosed) {
        // Assume rentalDate is stored as a string (MM/DD/YYYY) – adjust parsing as needed
        const rentalDate = new Date(data.rentalDate);
        if (rentalDate < now) {
          batch.update(docSnap.ref, { messagingClosed: true });
          updateCount++;
        }
      }
    });
    if (updateCount > 0) {
      await batch.commit();
      admin.logger.info(`Closed messaging for ${updateCount} rental requests.`);
    } else {
      admin.logger.info('No rental requests required messaging closure.');
    }
    return null;
  } catch (error) {
    admin.logger.error('Error in closeExpiredMessaging:', error);
    throw new Error('closeExpiredMessaging failed');
  }
});

// ===================================================================
// NEW: Scheduled Function to Refresh Listings
// ===================================================================
exports.refreshListings = onSchedule('every 1 hours', async (event) => {
  try {
    const nowMillis = Date.now();
    // Query listings with packageType Enhanced or Featured and order by createdAt descending
    const listingsQuery = db.collection('listings')
      .where('packageType', 'in', ['Enhanced', 'Featured'])
      .orderBy('createdAt', 'desc');
    const listingsSnapshot = await listingsQuery.get();
    if (listingsSnapshot.empty) {
      admin.logger.info('No Enhanced or Featured listings found for refresh.');
      return null;
    }
    const listings = [];
    listingsSnapshot.forEach(doc => {
      const data = doc.data();
      data.id = doc.id;
      listings.push(data);
    });
    // Helper function to generate a random integer between min and max (inclusive)
    const randomBetween = (min, max) => {
      return Math.floor(Math.random() * (max - min + 1)) + min;
    };

    for (const listing of listings) {
      let refreshInterval = 0;
      if (listing.packageType === 'Enhanced') {
        refreshInterval = 24 * 3600 * 1000;
      } else if (listing.packageType === 'Featured') {
        refreshInterval = 48 * 3600 * 1000;
      }
      let lastRefreshMillis;
      if (listing.lastRefreshAt && listing.lastRefreshAt.toMillis) {
        lastRefreshMillis = listing.lastRefreshAt.toMillis();
      } else if (listing.createdAt && listing.createdAt.toMillis) {
        lastRefreshMillis = listing.createdAt.toMillis();
      } else {
        continue;
      }
      if (nowMillis - lastRefreshMillis >= refreshInterval) {
        let newCreatedAtMillis = nowMillis;
        if (listing.packageType === 'Enhanced') {
          // For Enhanced, if at least 30 listings exist, use the createdAt of the 30th listing as lower bound.
          if (listings.length >= 30) {
            const listing30 = listings[29];
            const index30Millis = listing30.createdAt && listing30.createdAt.toMillis ? listing30.createdAt.toMillis() : listing30.createdAt;
            newCreatedAtMillis = randomBetween(index30Millis, nowMillis);
          }
        } else if (listing.packageType === 'Featured') {
          // For Featured, use the 15th listing as top bound and 50th as bottom bound if available.
          let topBound = nowMillis;
          let bottomBound = nowMillis - 3600 * 1000; // fallback: 1 hour ago
          if (listings.length >= 15) {
            const listing15 = listings[14];
            topBound = listing15.createdAt && listing15.createdAt.toMillis ? listing15.createdAt.toMillis() : listing15.createdAt;
          }
          if (listings.length >= 50) {
            const listing50 = listings[49];
            bottomBound = listing50.createdAt && listing50.createdAt.toMillis ? listing50.createdAt.toMillis() : listing50.createdAt;
          }
          newCreatedAtMillis = randomBetween(bottomBound, topBound);
        }
        const newNextRefreshAtMillis = nowMillis + refreshInterval;
        await db.collection('listings').doc(listing.id).update({
          createdAt: admin.firestore.Timestamp.fromMillis(newCreatedAtMillis),
          lastRefreshAt: admin.firestore.Timestamp.fromMillis(newCreatedAtMillis),
          nextRefreshAt: admin.firestore.Timestamp.fromMillis(newNextRefreshAtMillis),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        admin.logger.info(`Listing ${listing.id} refreshed. New createdAt: ${newCreatedAtMillis}`);
      }
    }
    return null;
  } catch (error) {
    admin.logger.error('Error in refreshListings scheduled function:', error);
    throw new Error('refreshListings failed');
  }
});

// ===================================================================
// Error-Handling Middleware
// ===================================================================
app.use((err, req, res, next) => {
  admin.logger.error('Unhandled error:', err);
  if (!res.headersSent) {
    res.setHeader('Content-Type', 'application/json');
    res.status(500).json({ error: 'Internal Server Error' });
  } else {
    next(err);
  }
});

// Handle undefined routes
app.use((req, res, next) => {
  res.setHeader('Content-Type', 'application/json');
  res.status(404).json({ error: 'Route not found' });
});

// =====================
// Export Express App as Firebase Function with Memory and Timeout Config
// =====================
exports.api = onRequest(
  { memory: '512Mi', timeoutSeconds: 60 },
  app
);

// For local testing, you can uncomment the following lines:
// const PORT = process.env.PORT || 3000;
// app.listen(PORT, () => {
//   console.log(`Server is running on port ${PORT}`);
// });
