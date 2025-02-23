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

// =====================
// Configuration Constants
// =====================
const ALLOWED_PACKAGES = ['Basic', 'Featured', 'Enhanced'];
const stripeSecretKey = process.env.STRIPE_SECRET_KEY ||
  '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';
const stripe = Stripe(stripeSecretKey);
const stripeWebhookSecret = process.env.STRIPE_WEBHOOK_SECRET ||
  'whsec_bMda2WJta35W9IF1t0ZLTiLvN9tteI3Z';

// =====================
// Initialize Express App
// =====================
const app = express();
app.use(cors({ origin: true }));

// =====================
// Stripe Webhook Endpoint (raw body needed)
// =====================
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

    // Handle Stripe events
    switch (event.type) {
      case 'payment_intent.succeeded': {
        const paymentIntent = event.data.object;
        admin.logger.info(`PaymentIntent succeeded: ${paymentIntent.id}`);
        const { listingId, ownerId, rentalRequestId } = paymentIntent.metadata;
        // Update classified listing if listingId and ownerId are present
        if (listingId && ownerId) {
          try {
            const listingRef = db.collection('listings').doc(listingId);
            const listingDoc = await listingRef.get();
            if (!listingDoc.exists) {
              admin.logger.warn(`Listing not found for listingId: ${listingId}`);
              break;
            }
            await listingRef.update({
              status: 'active',
              paymentStatus: 'succeeded',
              updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            });
            admin.logger.info(`Listing ${listingId} updated to active.`);
          } catch (error) {
            admin.logger.error(`Error updating listing ${listingId}:`, error);
          }
        }
        // Update rental request if rentalRequestId and ownerId are present
        if (rentalRequestId && ownerId) {
          try {
            // Look up rental request in top-level "rentalRequests" collection.
            const rentalRequestRef = db.collection('rentalRequests').doc(rentalRequestId);
            const rentalRequestDoc = await rentalRequestRef.get();
            if (!rentalRequestDoc.exists) {
              admin.logger.warn(`Rental request not found: ${rentalRequestId}`);
              break;
            }
            await rentalRequestRef.update({
              paymentStatus: 'succeeded',
              status: 'active',
              updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            });
            admin.logger.info(`Rental request ${rentalRequestId} updated to active.`);
          } catch (error) {
            admin.logger.error(`Error updating rental request ${rentalRequestId}:`, error);
          }
        }
        break;
      }
      default:
        admin.logger.warn(`Unhandled event type ${event.type}`);
    }
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
      sanitized[key] = typeof data[key] === 'string' ? data[key].trim() : data[key];
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
      listingDetails = typeof listingDetailsRaw === 'string'
        ? JSON.parse(listingDetailsRaw)
        : listingDetailsRaw;
      admin.logger.info(`Parsed listingDetails: ${JSON.stringify(listingDetails)}`);
    } catch (parseError) {
      admin.logger.error('Error parsing listingDetails:', parseError);
      res.setHeader('Content-Type', 'application/json');
      return res.status(400).json({ error: "Invalid JSON in 'listingDetails'" });
    }
    // Destructure and (optionally) sanitize fields
    const {
      title, tailNumber, salePrice, description, city, state, email, phone,
      companyName, jobTitle, jobDescription, category, flightSchoolName,
      flightSchoolDetails, isFreeListing, selectedPricing, lat, lng, images,
    } = sanitizeData(listingDetails);
    const categoryRequirements = {
      'Aircraft for Sale': ['title', 'description'],
      'Aviation Jobs': ['companyName', 'jobTitle', 'jobDescription'],
      'Flight Schools': ['flightSchoolName', 'flightSchoolDetails'],
    };
    const requiredFields = categoryRequirements[category];
    if (!requiredFields) {
      admin.logger.warn(`Invalid category: ${category}`);
      res.setHeader('Content-Type', 'application/json');
      return res.status(400).json({ error: `Invalid category: ${category}` });
    }
    const isFree = isFreeListing === 'true' || isFreeListing === true;
    if (!isFree) {
      if (!selectedPricing || !ALLOWED_PACKAGES.includes(selectedPricing)) {
        admin.logger.warn(`Invalid selectedPricing: ${selectedPricing}`);
        res.setHeader('Content-Type', 'application/json');
        return res.status(400).json({ error: 'Invalid or missing selectedPricing.' });
      }
    }
    let finalRequiredFields = [...requiredFields];
    if (category === 'Aircraft for Sale' && !isFree) {
      finalRequiredFields.push('salePrice', 'selectedPricing');
    }
    const missingFields = finalRequiredFields.filter((field) => !listingDetails[field]);
    if (missingFields.length > 0) {
      admin.logger.warn(`Missing required fields: ${missingFields.join(', ')}`);
      res.setHeader('Content-Type', 'application/json');
      return res.status(400).json({ error: `Missing required fields: ${missingFields.join(', ')}` });
    }
    if (!lat || !lng) {
      admin.logger.warn("Missing location data in request");
      res.setHeader('Content-Type', 'application/json');
      return res.status(400).json({ error: "Missing location data (lat, lng)" });
    }
    const latitude = parseFloat(lat);
    const longitude = parseFloat(lng);
    if (isNaN(latitude) || isNaN(longitude)) {
      admin.logger.warn("Invalid location numbers");
      res.setHeader('Content-Type', 'application/json');
      return res.status(400).json({ error: "Invalid location data. 'lat' and 'lng' must be numbers." });
    }
    let finalSalePrice = 0;
    let finalPackageCost = 0;
    if (isFree) {
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
      isFreeListing: isFree,
      packageType: isFree ? null : selectedPricing,
      packageCost: isFree ? 0 : finalPackageCost,
      location: { lat: latitude, lng: longitude },
      images: imageUrls,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      ownerId: req.user.uid,
      status: 'pending',
    };
    const listingRef = await db.collection('listings').add(listingData);
    res.setHeader('Content-Type', 'application/json');
    res.status(201).json({ success: true, listingId: listingRef.id });
  } catch (error) {
    admin.logger.error('Error in /createListing:', error);
    res.setHeader('Content-Type', 'application/json');
    res.status(500).json({ error: error.message || 'Internal Server Error' });
  }
});

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
    const { title, tailNumber, salePrice, description, city, state, email, phone,
      companyName, jobTitle, jobDescription, category, flightSchoolName,
      flightSchoolDetails, isFreeListing, selectedPricing, lat, lng, images } = sanitizedListingDetails;
    const categoryRequirements = {
      'Aircraft for Sale': ['title', 'description'],
      'Aviation Jobs': ['companyName', 'jobTitle', 'jobDescription'],
      'Flight Schools': ['flightSchoolName', 'flightSchoolDetails'],
    };
    const requiredFields = categoryRequirements[category];
    if (!requiredFields) {
      res.setHeader('Content-Type', 'application/json');
      return res.status(400).json({ error: `Invalid category: ${category}` });
    }
    const isFree = isFreeListing === 'true' || isFreeListing === true;
    if (!isFree && (!selectedPricing || !ALLOWED_PACKAGES.includes(selectedPricing))) {
      res.setHeader('Content-Type', 'application/json');
      return res.status(400).json({ error: 'Invalid or missing selectedPricing.' });
    }
    let finalRequiredFields = [...requiredFields];
    if (category === 'Aircraft for Sale' && !isFree) {
      finalRequiredFields.push('salePrice', 'selectedPricing');
    }
    const missingFields = finalRequiredFields.filter((field) => !sanitizedListingDetails[field]);
    if (missingFields.length > 0) {
      res.setHeader('Content-Type', 'application/json');
      return res.status(400).json({ error: `Missing required fields: ${missingFields.join(', ')}` });
    }
    if (!lat || !lng) {
      res.setHeader('Content-Type', 'application/json');
      return res.status(400).json({ error: "Missing location data (lat, lng)" });
    }
    const latitude = parseFloat(lat);
    const longitude = parseFloat(lng);
    if (isNaN(latitude) || isNaN(longitude)) {
      res.setHeader('Content-Type', 'application/json');
      return res.status(400).json({ error: "Invalid location data. 'lat' and 'lng' must be numbers." });
    }
    let finalSalePrice = listingData.salePrice;
    let finalPackageCost = listingData.packageCost;
    let finalPackageType = listingData.packageType;
    if (isFree) {
      finalSalePrice = 0;
      finalPackageCost = 0;
      finalPackageType = null;
    } else {
      if (salePrice) {
        let salePriceString = salePrice;
        if (typeof salePrice !== 'string') {
          salePriceString = salePrice.toString();
        }
        const sanitizedSalePrice = salePriceString.replace(/[^0-9.]/g, '');
        const parsedSalePrice = parseFloat(sanitizedSalePrice);
        if (isNaN(parsedSalePrice) || parsedSalePrice <= 0) {
          res.setHeader('Content-Type', 'application/json');
          return res.status(400).json({ error: 'Invalid salePrice. It must be a positive number.' });
        }
        finalSalePrice = parsedSalePrice;
      }
      if (selectedPricing) {
        finalPackageCost = calculateTotalCost(selectedPricing);
        finalPackageType = selectedPricing;
      }
    }
    const imageUrls = Array.isArray(images) ? images : [];
    const updateData = {
      title: title || listingData.title,
      tailNumber: tailNumber || listingData.tailNumber,
      salePrice: finalSalePrice,
      description: description || listingData.description,
      city: city || listingData.city,
      state: state || listingData.state,
      email: email || listingData.email,
      phone: phone || listingData.phone,
      companyName: companyName || listingData.companyName,
      jobTitle: jobTitle || listingData.jobTitle,
      jobDescription: jobDescription || listingData.jobDescription,
      category: category || listingData.category,
      flightSchoolName: flightSchoolName || listingData.flightSchoolName,
      flightSchoolDetails: flightSchoolDetails || listingData.flightSchoolDetails,
      isFreeListing: isFree,
      packageType: finalPackageType,
      packageCost: finalPackageCost,
      location: { lat: latitude, lng: longitude },
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };
    if (imageUrls.length > 0) {
      updateData.images = imageUrls;
    }
    await listingRef.update(updateData);
    res.setHeader('Content-Type', 'application/json');
    res.status(200).json({ success: true, listingId });
  } catch (error) {
    admin.logger.error('Error in /updateListing:', error);
    res.setHeader('Content-Type', 'application/json');
    res.status(500).json({ error: error.message || 'Internal Server Error' });
  }
});

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
    admin.logger.error('Error in /deleteListing:', error);
    res.setHeader('Content-Type', 'application/json');
    res.status(500).json({ error: error.message || 'Internal Server Error' });
  }
});

// ===================================================================
// Payment Endpoints
// ===================================================================

// Classified listing payment intent
app.post('/create-classified-payment-intent', authenticate, async (req, res) => {
  try {
    const { amount, currency = 'usd', listingId, listingDetails } = req.body;
    const finalListingId = listingId || (listingDetails && listingDetails.id);
    if (!amount || !finalListingId) {
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
    if (listingData.isFreeListing) {
      res.setHeader('Content-Type', 'application/json');
      return res.status(400).json({ error: 'Cannot create payment intent for a free listing.' });
    }
    const paymentIntent = await stripe.paymentIntents.create({
      amount,
      currency,
      metadata: { listingId: finalListingId, ownerId: listingData.ownerId },
    });
    res.setHeader('Content-Type', 'application/json');
    res.status(200).json({ clientSecret: paymentIntent.client_secret });
  } catch (error) {
    admin.logger.error('Error in /create-classified-payment-intent:', error);
    res.setHeader('Content-Type', 'application/json');
    res.status(500).json({ error: error.message || 'Internal Server Error' });
  }
});

// Rental payment intent
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
    // Look up rental request from top-level "rentalRequests" collection.
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
    const paymentIntent = await stripe.paymentIntents.create({
      amount,
      currency: 'usd',
      payment_method_types: ["card"],
      metadata: { rentalRequestId, ownerId, renterId: req.user.uid },
    });
    res.setHeader('Content-Type', 'application/json');
    res.status(200).json({ clientSecret: paymentIntent.client_secret });
  } catch (error) {
    admin.logger.error('Error in /create-rental-payment-intent:', error);
    res.setHeader('Content-Type', 'application/json');
    res.status(500).json({ error: error.message || 'Internal Server Error' });
  }
});

// Validate discount code endpoint
app.post('/validateDiscount', authenticate, async (req, res) => {
  try {
    const { discountCode, amount } = req.body;
    if (!discountCode || typeof amount !== 'number' || amount <= 0) {
      res.setHeader('Content-Type', 'application/json');
      return res.status(400).json({ valid: false, message: 'Invalid request parameters' });
    }
    const discountCodes = {
      SUMMER20: { type: 'percentage', value: 20, message: '20% off your listing!' },
      FLY50: { type: 'fixed', value: 5000, message: '$50 off your listing!' },
    };
    const discount = discountCodes[discountCode.toUpperCase()];
    if (!discount) {
      res.setHeader('Content-Type', 'application/json');
      return res.status(200).json({ valid: false, message: 'Invalid discount code.' });
    }
    let adjustedAmount = amount;
    let pricingTier = 'Basic';
    if (discount.type === 'percentage') {
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
    admin.logger.error('Error in /validateDiscount:', error);
    res.setHeader('Content-Type', 'application/json');
    res.status(500).json({ valid: false, message: error.message || 'Internal Server Error' });
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
    const ownerDoc = await db.collection('users').doc(ownerId).get();
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
    admin.logger.error('Error attaching bank account:', error);
    res.setHeader('Content-Type', 'application/json');
    res.status(500).json({ error: error.message || 'Internal Server Error' });
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
      capabilities: { transfers: { requested: true } },
    });
    await db.collection('users').doc(ownerId).set({ stripeAccountId: account.id }, { merge: true });
    const accountLink = await stripe.accountLinks.create({
      account: account.id,
      refresh_url: 'https://your-app-url.com/reauth', // Replace with your URL
      return_url: 'https://your-app-url.com/return',   // Replace with your URL
      type: 'account_onboarding',
    });
    res.setHeader('Content-Type', 'application/json');
    res.status(200).json({ message: 'Connected account created', accountLinkUrl: accountLink.url });
  } catch (error) {
    admin.logger.error('Error creating connected account:', error);
    res.setHeader('Content-Type', 'application/json');
    res.status(500).json({ error: error.message || 'Internal Server Error' });
  }
});

app.post('/withdraw-funds', authenticate, async (req, res) => {
  try {
    const { ownerId, amount, paymentMethodId, email } = req.body;
    if (!ownerId || !amount || !paymentMethodId || !email) {
      res.setHeader('Content-Type', 'application/json');
      return res.status(400).json({ error: 'Missing required fields: ownerId, amount, paymentMethodId, email' });
    }
    const ownerDoc = await db.collection('users').doc(ownerId).get();
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
    const payout = await stripe.payouts.create(
      { amount, currency: 'usd' },
      { stripeAccount: connectedAccountId }
    );
    res.setHeader('Content-Type', 'application/json');
    res.status(200).json({ message: 'Withdrawal processed successfully', payout });
  } catch (error) {
    admin.logger.error('Error processing withdrawal:', error);
    res.setHeader('Content-Type', 'application/json');
    res.status(500).json({ error: error.message || 'Internal Server Error' });
  }
});

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
      const renterDoc = await renterRef.get();
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
      const requestData = docSnap.data();
      const rentalRequestId = docSnap.id;
      const ownerId = requestData.ownerId;
      const renterId = requestData.renterId;
      const chatThreadId = requestData.chatThreadId;
      rentalBatch.delete(docSnap.ref);
      totalDeletions++;
      if (chatThreadId) {
        const chatThreadRef = db.collection('messages').doc(chatThreadId);
        rentalBatch.delete(chatThreadRef);
        totalDeletions++;
      }
      if (renterId) {
        const notificationsRef = db.collection('renters').doc(renterId)
          .collection('notifications').where('rentalRequestId', '==', rentalRequestId);
        notificationsRef.get().then((notifSnap) => {
          notifSnap.forEach((notificationDoc) => {
            rentalBatch.delete(notificationDoc.ref);
            totalDeletions++;
          });
        });
      }
    });
    await rentalBatch.commit();
    admin.logger.info(`Deleted ${totalDeletions} associated documents for listing ${listingId}.`);
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
          if (requestData.chatThreadId) {
            const chatThreadRef = db.collection('messages').doc(requestData.chatThreadId);
            rentalBatch.delete(chatThreadRef);
            totalDeletions++;
          }
          if (requestData.renterId) {
            const notificationsRef = db.collection('renters').doc(requestData.renterId)
              .collection('notifications').where('rentalRequestId', '==', requestDoc.id);
            notificationsRef.get().then((notifSnap) => {
              notifSnap.forEach((notificationDoc) => {
                rentalBatch.delete(notificationDoc.ref);
                totalDeletions++;
              });
            });
          }
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

// =====================
// Error-Handling Middleware
// =====================
app.use((err, req, res, next) => {
  admin.logger.error('Unhandled error:', err);
  res.setHeader('Content-Type', 'application/json');
  res.status(500).json({ error: 'Internal Server Error' });
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
