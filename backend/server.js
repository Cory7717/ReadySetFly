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
const {
  onDocumentCreated,
  onDocumentUpdated,
  onDocumentDeleted,
} = require('firebase-functions/v2/firestore');
const { onSchedule } = require('firebase-functions/v2/scheduler');

// Initialize Firebase Admin SDK
admin.initializeApp({
  credential: admin.credential.applicationDefault(),
  storageBucket: 'ready-set-fly-71506.appspot.com', // Replace with your storage bucket
});

const db = admin.firestore();
const storageBucket = admin.storage().bucket();

// Initialize Express App
const app = express();

// =====================
// Configuration Constants
// =====================

// Allowed pricing packages
const ALLOWED_PACKAGES = ['Basic', 'Featured', 'Enhanced'];

// Initialize Stripe with your secret key (use environment variables in production)
const stripeSecretKey =
  process.env.STRIPE_SECRET_KEY ||
  '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'; // Replace with your actual Stripe secret key or use environment variable
const stripe = Stripe(stripeSecretKey);

// Stripe Webhook Secret (use environment variables in production)
const stripeWebhookSecret =
  process.env.STRIPE_WEBHOOK_SECRET ||
  'whsec_bMda2WJta35W9IF1t0ZLTiLvN9tteI3Z'; // Replace with your actual Stripe webhook secret or use environment variable

// =====================
// Middleware
// =====================

// Enable CORS for all origins
app.use(cors({ origin: true }));

// =====================
// Stripe Webhook Endpoint
// =====================

/**
 * @route   POST /webhook
 * @desc    Handle Stripe webhook events.
 * @access  Public
 */
// It's crucial to define the /webhook route **before** the body parsing middleware.
// This ensures that the raw body is available for Stripe's signature verification.
app.post(
  '/webhook',
  bodyParser.raw({ type: 'application/json' }),
  async (req, res) => {
    const sig = req.headers['stripe-signature'];

    let event;

    try {
      event = stripe.webhooks.constructEvent(
        req.body,
        sig,
        stripeWebhookSecret
      );
      admin.logger.info(`Received Stripe event: ${event.type}`);
    } catch (err) {
      admin.logger.error(`Webhook signature verification failed: ${err.message}`);
      return res
        .status(400)
        .json({ error: `Webhook Error: ${err.message}` }); // Changed to JSON response
    }

    // Handle the event
    switch (event.type) {
      case 'payment_intent.succeeded':
        const paymentIntent = event.data.object;
        admin.logger.info(`PaymentIntent was successful: ${paymentIntent.id}`);

        // Extract listingId or rentalRequestId from metadata
        const { listingId, ownerId, rentalRequestId } = paymentIntent.metadata;

        if (listingId && ownerId) {
          try {
            const listingRef = db.collection('listings').doc(listingId);
            const listingDoc = await listingRef.get();

            if (!listingDoc.exists) {
              admin.logger.warn(
                `Listing not found for listingId: ${listingId}`
              );
              break;
            }

            await listingRef.update({
              status: 'active',
              paymentStatus: 'succeeded',
              updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            });

            admin.logger.info(`Listing ${listingId} updated to active.`);
          } catch (error) {
            admin.logger.error(
              `Error updating listing status for listingId ${listingId}:`,
              error
            );
          }
        }

        if (rentalRequestId && ownerId) {
          try {
            // Assuming rental requests are stored under 'owners/{ownerId}/rentalRequests/{rentalRequestId}'
            const rentalRequestRef = db
              .collection('owners')
              .doc(ownerId)
              .collection('rentalRequests')
              .doc(rentalRequestId);
            const rentalRequestDoc = await rentalRequestRef.get();

            if (!rentalRequestDoc.exists) {
              admin.logger.warn(
                `Rental request not found for rentalRequestId: ${rentalRequestId}`
              );
              break;
            }

            await rentalRequestRef.update({
              paymentStatus: 'succeeded',
              status: 'active', // or appropriate status
              updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            });

            admin.logger.info(
              `Rental request ${rentalRequestId} updated to active.`
            );
          } catch (error) {
            admin.logger.error(
              `Error updating rental request status for rentalRequestId ${rentalRequestId}:`,
              error
            );
          }
        }

        break;

      // Handle other event types as needed
      default:
        admin.logger.warn(`Unhandled event type ${event.type}`);
    }

    // Acknowledge receipt of the event
    res.json({ received: true });
  }
);

// =====================
// Global Body Parsing Middleware
// =====================

// After defining the /webhook route, apply body parsing for other routes.
// This ensures that /webhook is not affected by these parsers.
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Middleware for authenticating Firebase ID Tokens
const authenticate = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    admin.logger.warn('Unauthorized access attempt: No token provided.');
    return res
      .status(401)
      .json({ error: 'Unauthorized: No token provided' });
  }

  const idToken = authHeader.split('Bearer ')[1];

  try {
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    req.user = decodedToken;
    next();
  } catch (error) {
    admin.logger.error('Error verifying Firebase ID token:', error);
    return res
      .status(401)
      .json({ error: 'Unauthorized: Invalid token' });
  }
};

// =====================
// Helper Functions
// =====================

/**
 * Sanitize incoming data by trimming strings.
 * @param {Object} data - The data object to sanitize.
 * @returns {Object} - The sanitized data object.
 */
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

/**
 * Calculate the total cost based on the selected pricing package.
 * @param {string} packageType - The selected pricing package.
 * @returns {number} - The total cost in cents.
 */
const calculateTotalCost = (packageType) => {
  const packagePrices = {
    Basic: 2500, // $25.00
    Featured: 7000, // $70.00
    Enhanced: 15000, // $150.00
  };

  return packagePrices[packageType] || 2500; // Default to Basic if unknown
};

/**
 * Send notifications via FCM to specified tokens.
 * @param {Array<string>} tokens - FCM tokens.
 * @param {string} title - Notification title.
 * @param {string} body - Notification body.
 * @param {Object} data - Additional data payload.
 */
const sendNotification = async (
  tokens,
  title,
  body,
  data = {}
) => {
  const payload = {
    notification: {
      title,
      body,
    },
    data,
  };

  try {
    const response = await admin.messaging().sendToDevice(
      tokens,
      payload
    );
    admin.logger.info('Notifications sent successfully:', response);
  } catch (error) {
    admin.logger.error('Error sending notifications:', error);
  }
};

// =====================
// Routes: HTTP Endpoints via Express
// =====================

/**
 * @route   POST /createListing
 * @desc    Create a new listing with details and images.
 * @access  Protected
 */
app.post('/createListing', authenticate, async (req, res) => {
  try {
    admin.logger.info(
      `Received /createListing request from user: ${req.user.uid}`
    );

    const listingDetailsRaw = req.body.listingDetails;
    if (!listingDetailsRaw) {
      admin.logger.warn(
        "Missing 'listingDetails' in createListing request"
      );
      return res
        .status(400)
        .json({ error: "Missing 'listingDetails' in request body" });
    }

    let listingDetails;
    try {
      listingDetails =
        typeof listingDetailsRaw === 'string'
          ? JSON.parse(listingDetailsRaw)
          : listingDetailsRaw;
      admin.logger.info(
        `Parsed listingDetails: ${JSON.stringify(listingDetails)}`
      );
    } catch (parseError) {
      admin.logger.warn("Invalid JSON in 'listingDetails' field");
      admin.logger.error(
        'Error parsing listingDetails:',
        parseError
      );
      return res
        .status(400)
        .json({ error: "Invalid JSON in 'listingDetails' field" });
    }

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
    } = sanitizeData(listingDetails);

    // Category requirements
    const categoryRequirements = {
      'Aircraft for Sale': ['title', 'description'],
      'Aviation Jobs': [
        'companyName',
        'jobTitle',
        'jobDescription',
      ],
      'Flight Schools': [
        'flightSchoolName',
        'flightSchoolDetails',
      ],
      // Add more categories if needed
    };

    // Validate category
    const requiredFields = categoryRequirements[category];
    if (!requiredFields) {
      admin.logger.warn(`Invalid category: ${category}`);
      return res
        .status(400)
        .json({ error: `Invalid category: ${category}` });
    }

    // Validate selectedPricing if not a free listing
    const isFree =
      isFreeListing === 'true' || isFreeListing === true;
    if (!isFree) {
      if (!selectedPricing || !ALLOWED_PACKAGES.includes(selectedPricing)) {
        admin.logger.warn(
          `Invalid or missing selectedPricing: ${selectedPricing}`
        );
        return res
          .status(400)
          .json({ error: 'Invalid or missing selectedPricing.' });
      }
    }

    // Conditionally require 'salePrice' and 'selectedPricing' if not a free listing and category is 'Aircraft for Sale'
    let finalRequiredFields = [...requiredFields];
    if (
      category === 'Aircraft for Sale' &&
      !isFree
    ) {
      finalRequiredFields.push('salePrice', 'selectedPricing');
    }

    // Check for missing required fields
    const missingFields = finalRequiredFields.filter(
      (field) => !listingDetails[field]
    );
    if (missingFields.length > 0) {
      admin.logger.warn(
        `Missing required fields: ${missingFields.join(', ')}`
      );
      return res
        .status(400)
        .json({
          error: `Missing required fields: ${missingFields.join(
            ', '
          )}`,
        });
    }

    // Validate location data
    if (!lat || !lng) {
      admin.logger.warn(
        "Missing location data in createListing request"
      );
      return res
        .status(400)
        .json({
          error: "Missing location data (lat, lng) in 'listingDetails'",
        });
    }

    // Parse and validate latitude and longitude
    const latitude = parseFloat(lat);
    const longitude = parseFloat(lng);
    if (isNaN(latitude) || isNaN(longitude)) {
      admin.logger.warn(
        "Invalid location data. 'lat' and 'lng' must be numbers."
      );
      return res
        .status(400)
        .json({
          error: "Invalid location data. 'lat' and 'lng' must be numbers.",
        });
    }

    // Handle and validate salePrice
    let finalSalePrice = 0;
    let finalPackageCost = 0;

    if (isFree) {
      finalSalePrice = 0;
      finalPackageCost = 0;
    } else {
      // Sanitize salePrice by removing non-numeric characters
      const sanitizedSalePrice = salePrice.replace(/[^0-9.]/g, '');
      const parsedSalePrice = parseFloat(sanitizedSalePrice);

      if (isNaN(parsedSalePrice) || parsedSalePrice <= 0) {
        admin.logger.warn(
          `Invalid salePrice provided: ${salePrice}`
        );
        return res
          .status(400)
          .json({
            error:
              'Invalid salePrice provided. It must be a positive number.',
          });
      }

      finalSalePrice = parsedSalePrice;
      finalPackageCost = calculateTotalCost(selectedPricing);
    }

    // Handle image URLs
    const imageUrls = Array.isArray(images) ? images : [];
    admin.logger.info(`Received image URLs: ${JSON.stringify(imageUrls)}`);

    // Construct listingData
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
      location: {
        lat: latitude,
        lng: longitude,
      },
      images: imageUrls,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      ownerId: req.user.uid,
      status: 'pending', // Initial status
    };

    admin.logger.info(
      `Creating Firestore document with data: ${JSON.stringify(
        listingData
      )}`
    );

    const listingRef = await db.collection('listings').add(listingData);
    admin.logger.info(`Listing created with ID: ${listingRef.id}`);

    res.status(201).json({ success: true, listingId: listingRef.id });
  } catch (error) {
    admin.logger.error('Error in /createListing endpoint:', error);
    res
      .status(500)
      .json({ error: error.message || 'Internal Server Error' });
  }
});

/**
 * @route   PUT /updateListing
 * @desc    Update an existing listing with new details and images.
 * @access  Protected
 */
app.put('/updateListing', authenticate, async (req, res) => {
  try {
    const { listingId, listingDetails } = req.body;

    admin.logger.info(
      `Received /updateListing request for listing ID: ${listingId} from user: ${req.user.uid}`
    );

    // Validate listingId
    if (!listingId) {
      admin.logger.warn('Missing listingId in updateListing request');
      return res
        .status(400)
        .json({ error: 'Missing listingId in request body' });
    }

    // Fetch the listing
    const listingRef = db.collection('listings').doc(listingId);
    const listingDoc = await listingRef.get();

    if (!listingDoc.exists) {
      admin.logger.warn(`Listing not found: ID ${listingId}`);
      return res.status(404).json({ error: 'Listing not found' });
    }

    const listingData = listingDoc.data();

    // Verify ownership
    if (listingData.ownerId !== req.user.uid) {
      admin.logger.warn(
        `Unauthorized update attempt by user ${req.user.uid} for listing ${listingId}`
      );
      return res
        .status(403)
        .json({ error: 'You do not own this listing' });
    }

    // Validate listingDetails
    if (!listingDetails) {
      admin.logger.warn('Missing listingDetails in updateListing request');
      return res
        .status(400)
        .json({ error: 'Missing listingDetails in request body' });
    }

    // Sanitize listingDetails
    const sanitizedListingDetails = sanitizeData(listingDetails);

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
    } = sanitizedListingDetails;

    // Category requirements
    const categoryRequirements = {
      'Aircraft for Sale': ['title', 'description'],
      'Aviation Jobs': [
        'companyName',
        'jobTitle',
        'jobDescription',
      ],
      'Flight Schools': [
        'flightSchoolName',
        'flightSchoolDetails',
      ],
      // Add more categories if needed
    };

    // Validate category
    const requiredFields = categoryRequirements[category];
    if (!requiredFields) {
      admin.logger.warn(`Invalid category: ${category}`);
      return res
        .status(400)
        .json({ error: `Invalid category: ${category}` });
    }

    // Validate selectedPricing if not a free listing
    const isFree =
      isFreeListing === 'true' || isFreeListing === true;
    if (!isFree) {
      if (!selectedPricing || !ALLOWED_PACKAGES.includes(selectedPricing)) {
        admin.logger.warn(
          `Invalid or missing selectedPricing: ${selectedPricing}`
        );
        return res
          .status(400)
          .json({ error: 'Invalid or missing selectedPricing.' });
      }
    }

    // Conditionally require 'salePrice' and 'selectedPricing' if not a free listing and category is 'Aircraft for Sale'
    let finalRequiredFields = [...requiredFields];
    if (
      category === 'Aircraft for Sale' &&
      !isFree
    ) {
      finalRequiredFields.push('salePrice', 'selectedPricing');
    }

    // Check for missing required fields
    const missingFields = finalRequiredFields.filter(
      (field) => !sanitizedListingDetails[field]
    );
    if (missingFields.length > 0) {
      admin.logger.warn(
        `Missing required fields: ${missingFields.join(', ')}`
      );
      return res
        .status(400)
        .json({
          error: `Missing required fields: ${missingFields.join(
            ', '
          )}`,
        });
    }

    // Validate location data
    if (!lat || !lng) {
      admin.logger.warn(
        "Missing location data in updateListing request"
      );
      return res
        .status(400)
        .json({
          error: "Missing location data (lat, lng) in 'listingDetails'",
        });
    }

    // Parse and validate latitude and longitude
    const latitude = parseFloat(lat);
    const longitude = parseFloat(lng);
    if (isNaN(latitude) || isNaN(longitude)) {
      admin.logger.warn(
        "Invalid location data. 'lat' and 'lng' must be numbers."
      );
      return res
        .status(400)
        .json({
          error: "Invalid location data. 'lat' and 'lng' must be numbers.",
        });
    }

    // Handle and validate salePrice
    let finalSalePrice = listingData.salePrice; // Existing salePrice
    let finalPackageCost = listingData.packageCost;
    let finalPackageType = listingData.packageType;

    if (isFree) {
      finalSalePrice = 0;
      finalPackageCost = 0;
      finalPackageType = null;
    } else {
      if (salePrice) {
        // Sanitize salePrice by removing non-numeric characters
        const sanitizedSalePrice = salePrice.replace(/[^0-9.]/g, '');
        const parsedSalePrice = parseFloat(sanitizedSalePrice);

        if (isNaN(parsedSalePrice) || parsedSalePrice <= 0) {
          admin.logger.warn(
            `Invalid salePrice provided: ${salePrice}`
          );
          return res
            .status(400)
            .json({
              error:
                'Invalid salePrice provided. It must be a positive number.',
            });
        }

        finalSalePrice = parsedSalePrice;
      }

      if (selectedPricing) {
        finalPackageCost = calculateTotalCost(selectedPricing);
        finalPackageType = selectedPricing;
      }
    }

    // Handle image URLs
    const imageUrls = Array.isArray(images) ? images : [];
    admin.logger.info(
      `Received image URLs for update: ${JSON.stringify(imageUrls)}`
    );

    // Construct updateData with existing values if new ones are not provided
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
      jobDescription:
        jobDescription || listingData.jobDescription,
      category: category || listingData.category,
      flightSchoolName:
        flightSchoolName || listingData.flightSchoolName,
      flightSchoolDetails:
        flightSchoolDetails || listingData.flightSchoolDetails,
      isFreeListing: isFree,
      packageType: finalPackageType,
      packageCost: finalPackageCost,
      location: {
        lat: latitude,
        lng: longitude,
      },
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    if (imageUrls.length > 0) {
      updateData.images = imageUrls;
    }

    admin.logger.info(
      `Updating listing ID: ${listingId} with data: ${JSON.stringify(
        updateData
      )}`
    );

    await listingRef.update(updateData);
    admin.logger.info(`Listing updated with ID: ${listingId}`);

    res.status(200).json({ success: true, listingId });
  } catch (error) {
    admin.logger.error('Error in /updateListing endpoint:', error);
    res
      .status(500)
      .json({ error: error.message || 'Internal Server Error' });
  }
});

/**
 * @route   DELETE /deleteListing
 * @desc    Delete a listing by ID.
 * @access  Protected
 */
app.delete('/deleteListing', authenticate, async (req, res) => {
  try {
    const { listingId } = req.body;

    if (!listingId) {
      admin.logger.warn(
        'Missing listingId in deleteListing request'
      );
      return res
        .status(400)
        .json({ error: 'Missing listingId in request body' });
    }

    // Fetch the listing
    const listingRef = db.collection('listings').doc(listingId);
    const listingDoc = await listingRef.get();

    if (!listingDoc.exists) {
      admin.logger.warn(`Listing not found: ID ${listingId}`);
      return res.status(404).json({ error: 'Listing not found' });
    }

    const listingData = listingDoc.data();

    // Verify ownership
    if (listingData.ownerId !== req.user.uid) {
      admin.logger.warn(
        `Unauthorized delete attempt by user ${req.user.uid} for listing ${listingId}`
      );
      return res
        .status(403)
        .json({ error: 'You do not own this listing' });
    }

    // Delete images from Firebase Storage
    const imageUrls = listingData.images || [];
    const deletePromises = imageUrls.map(async (imageUrl) => {
      const filePathMatch = imageUrl.match(/\/o\/(.+?)\?/);
      if (filePathMatch && filePathMatch[1]) {
        const filePath = decodeURIComponent(filePathMatch[1]).replace(
          /%2F/g,
          '/'
        );
        try {
          await storageBucket.file(filePath).delete();
          admin.logger.info(`Deleted image at path: ${filePath}`);
        } catch (err) {
          admin.logger.error(
            `Failed to delete image ${filePath}:`,
            err
          );
        }
      } else {
        admin.logger.warn(
          `Unable to extract file path from image URL: ${imageUrl}`
        );
      }
    });

    await Promise.all(deletePromises);
    admin.logger.info(
      `Deleted ${imageUrls.length} images for listing ${listingId}.`
    );

    // Delete the listing document
    await listingRef.delete();
    admin.logger.info(`Deleted listing with ID: ${listingId}`);

    res
      .status(200)
      .json({ success: true, message: 'Listing deleted successfully' });
  } catch (error) {
    admin.logger.error('Error in /deleteListing endpoint:', error);
    res
      .status(500)
      .json({ error: error.message || 'Internal Server Error' });
  }
});

/**
 * @route   POST /create-classified-payment-intent
 * @desc    Create a Stripe payment intent for classified listings.
 * @access  Protected
 */
app.post(
  '/create-classified-payment-intent',
  authenticate,
  async (req, res) => {
    try {
      const { amount, currency = 'usd', listingId } = req.body;

      // Validate inputs
      if (!amount || !listingId) {
        admin.logger.warn(
          'Missing required fields: amount and listingId'
        );
        return res
          .status(400)
          .json({
            error: 'Missing required fields: amount and listingId',
          });
      }

      // Verify that the listing exists and belongs to the user
      const listingRef = db.collection('listings').doc(listingId);
      const listingDoc = await listingRef.get();
      if (!listingDoc.exists) {
        admin.logger.warn(`Listing not found: ID ${listingId}`);
        return res.status(404).json({ error: 'Listing not found' });
      }

      const listingData = listingDoc.data();
      if (listingData.ownerId !== req.user.uid) {
        admin.logger.warn(
          `Unauthorized payment intent creation attempt by user ${req.user.uid} for listing ${listingId}`
        );
        return res
          .status(403)
          .json({ error: 'You do not own this listing' });
      }

      // Ensure that the listing is not free before creating a payment intent
      if (listingData.isFreeListing) {
        admin.logger.warn(
          `Attempt to create payment intent for free listing ID: ${listingId}`
        );
        return res
          .status(400)
          .json({
            error: 'Cannot create payment intent for a free listing.',
          });
      }

      // Create a payment intent with Stripe
      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount, // Amount in cents, corresponds to packageCost
        currency: currency,
        metadata: { listingId: listingId, ownerId: listingData.ownerId },
      });

      admin.logger.info(
        `PaymentIntent created for listing ${listingId}: ${paymentIntent.id}`
      );

      res.status(200).json({ clientSecret: paymentIntent.client_secret });
    } catch (error) {
      admin.logger.error(
        'Error in /create-classified-payment-intent endpoint:',
        error
      );
      res
        .status(500)
        .json({ error: error.message || 'Internal Server Error' });
    }
  }
);

/**
 * @route   POST /create-rental-payment-intent
 * @desc    Create a Stripe payment intent for rental requests.
 * @access  Protected
 */
app.post(
  '/create-rental-payment-intent',
  authenticate,
  async (req, res) => {
    try {
      const { rentalRequestId, ownerId } = req.body;

      // Validate presence of rentalRequestId and ownerId
      if (!rentalRequestId || !ownerId) {
        admin.logger.warn(
          'Missing rentalRequestId or ownerId in request body'
        );
        return res
          .status(400)
          .json({
            error: 'Missing rentalRequestId or ownerId in request body',
          });
      }

      // Fetch the rental request
      const rentalRequestRef = db
        .collection('owners')
        .doc(ownerId)
        .collection('rentalRequests')
        .doc(rentalRequestId);
      const rentalRequestDoc = await rentalRequestRef.get();

      if (!rentalRequestDoc.exists) {
        admin.logger.warn(
          `Rental request not found: ID ${rentalRequestId} for owner ${ownerId}`
        );
        return res.status(404).json({ error: 'Rental request not found' });
      }

      const rentalRequest = rentalRequestDoc.data();

      // Verify that the renter making the request is the same as the one in rentalRequest
      if (rentalRequest.renterId !== req.user.uid) {
        admin.logger.warn(
          `Unauthorized payment intent creation attempt by user ${req.user.uid} for rental request ${rentalRequestId}`
        );
        return res.status(403).json({
          error:
            'You are not authorized to make a payment for this rental request',
        });
      }

      // Calculate the amount (if not already stored)
      let amount = rentalRequest.totalAmount;
      if (!amount) {
        const { costPerHour, rentalHours } = rentalRequest;
        if (!costPerHour || !rentalHours) {
          admin.logger.warn(
            `Invalid rental request data for rentalRequestId: ${rentalRequestId}`
          );
          return res
            .status(400)
            .json({ error: 'Invalid rental request data' });
        }
        const baseAmount = costPerHour * rentalHours; // in dollars
        const bookingFee = baseAmount * 0.06; // 6%
        const processingFee = baseAmount * 0.03; // 3%
        const tax = (baseAmount + bookingFee) * 0.0825; // 8.25%
        amount = Math.round(
          (baseAmount + bookingFee + processingFee + tax) * 100
        ); // Convert to cents

        // Update the rental request with the calculated totalAmount
        await rentalRequestDoc.ref.update({ totalAmount: amount });
        admin.logger.info(
          `Calculated and updated totalAmount for rentalRequestId: ${rentalRequestId} to ${amount} cents`
        );
      }

      // Create a payment intent with Stripe
      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount,
        currency: 'usd',
        metadata: { rentalRequestId: rentalRequestId, ownerId: ownerId },
      });

      admin.logger.info(
        `PaymentIntent created for rental request ${rentalRequestId}: ${paymentIntent.id}`
      );

      res.status(200).json({ clientSecret: paymentIntent.client_secret });
    } catch (error) {
      admin.logger.error(
        'Error in /create-rental-payment-intent endpoint:',
        error
      );
      res
        .status(500)
        .json({ error: error.message || 'Internal Server Error' });
    }
  }
);

/**
 * @route   POST /validateDiscount
 * @desc    Validate a discount code and apply it to the amount.
 * @access  Protected
 */
app.post(
  '/validateDiscount',
  authenticate,
  async (req, res) => {
    try {
      const { discountCode, amount } = req.body;

      if (
        !discountCode ||
        typeof amount !== 'number' ||
        amount <= 0
      ) {
        admin.logger.warn(
          'Invalid request parameters for discount validation'
        );
        return res
          .status(400)
          .json({
            valid: false,
            message: 'Invalid request parameters',
          });
      }

      // Define discount codes (Alternatively, fetch from Firestore)
      const discountCodes = {
        SUMMER20: {
          type: 'percentage',
          value: 20,
          message: '20% off your listing!',
        },
        FLY50: {
          type: 'fixed',
          value: 5000, // amount in cents
          message: '$50 off your listing!',
        },
        // Add more discount codes as needed
      };

      const discount = discountCodes[discountCode.toUpperCase()];

      if (!discount) {
        admin.logger.info(
          `Invalid discount code attempted: ${discountCode}`
        );
        return res
          .status(200)
          .json({ valid: false, message: 'Invalid discount code.' });
      }

      let adjustedAmount = amount;
      let pricingTier = 'Basic'; // Default pricing tier

      if (discount.type === 'percentage') {
        adjustedAmount = Math.round(
          adjustedAmount * (1 - discount.value / 100)
        );
        pricingTier = 'Featured'; // Example: Upgrade pricing tier
      } else if (discount.type === 'fixed') {
        adjustedAmount = adjustedAmount - discount.value;
        if (adjustedAmount < 0) adjustedAmount = 0;
        pricingTier = 'Enhanced'; // Example: Upgrade pricing tier
      }

      admin.logger.info(
        `Discount code ${discountCode} applied. Adjusted amount: ${adjustedAmount} cents.`
      );

      res.status(200).json({
        valid: true,
        adjustedAmount,
        pricingTier,
        message: discount.message,
      });
    } catch (error) {
      admin.logger.error(
        'Error in /validateDiscount endpoint:',
        error
      );
      res
        .status(500)
        .json({
          valid: false,
          message: 'Internal Server Error',
        });
    }
  }
);

// =====================
// Firestore-Triggered Functions
// =====================

/**
 * onMessageSent
 * Trigger: Firestore Document Creation for messages/{messageId}
 */
exports.onMessageSent = onDocumentCreated(
  'messages/{messageId}',
  async (snapshot, context) => {
    const { messageId } = context.params;
    const messageData = snapshot.data();

    const { recipients, text, chatThreadId, senderId } = messageData;

    if (!recipients || !Array.isArray(recipients)) {
      admin.logger.warn(
        `Invalid recipients for message ${messageId}`
      );
      return null;
    }

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
        admin.logger.warn('No FCM tokens found for recipients.');
        return null;
      }

      // Construct the notification payload
      const payload = {
        notification: {
          title: 'New Message',
          body:
            text.length > 50 ? `${text.substring(0, 47)}...` : text,
          click_action: 'FLUTTER_NOTIFICATION_CLICK', // Adjust based on your app's requirements
        },
        data: {
          chatThreadId,
          senderId,
        },
      };

      // Send notifications
      const response = await admin.messaging().sendToDevice(
        tokens,
        payload
      );
      admin.logger.info('Notifications sent successfully:', response);
    } catch (error) {
      admin.logger.error(
        'Error fetching FCM tokens or sending notifications:',
        error
      );
    }

    return null;
  }
);

/**
 * onListingDeleted
 * Trigger: Firestore Document Deletion for listings/{listingId}
 */
exports.onListingDeleted = onDocumentDeleted(
  'listings/{listingId}',
  async (snapshot, context) => {
    const { listingId } = context.params;
    const deletedData = snapshot.data();

    try {
      let totalDeletions = 0;

      // Step 1: Delete all rental requests associated with the listing
      const rentalRequestsRef = db
        .collectionGroup('rentalRequests')
        .where('listingId', '==', listingId);
      const rentalRequestsSnapshot = await rentalRequestsRef.get();
      admin.logger.info(
        `Found ${rentalRequestsSnapshot.size} rental requests for listing ${listingId}.`
      );

      const rentalBatch = db.batch();

      for (const requestDoc of rentalRequestsSnapshot.docs) {
        const requestData = requestDoc.data();
        const rentalRequestId = requestDoc.id;
        const ownerId = requestData.ownerId;
        const renterId = requestData.renterId;
        const chatThreadId = requestData.chatThreadId;

        if (!ownerId) {
          admin.logger.warn(
            `Rental request ${rentalRequestId} is missing ownerId. Skipping deletion.`
          );
          continue;
        }

        // Delete the rental request from 'owners/{ownerId}/rentalRequests/{rentalRequestId}'
        const rentalRequestRef = db
          .collection('owners')
          .doc(ownerId)
          .collection('rentalRequests')
          .doc(rentalRequestId);
        rentalBatch.delete(rentalRequestRef);
        totalDeletions++;

        // Delete associated chat thread if exists
        if (chatThreadId) {
          const chatThreadRef = db
            .collection('messages')
            .doc(chatThreadId);
          rentalBatch.delete(chatThreadRef);
          admin.logger.info(
            `Deleted associated chat thread ${chatThreadId} for rental request ${rentalRequestId}.`
          );
          totalDeletions++;
        }

        // Delete notifications associated with the rental request
        if (renterId) {
          const notificationsRef = db
            .collection('renters')
            .doc(renterId)
            .collection('notifications')
            .where('rentalRequestId', '==', rentalRequestId);
          const notificationsSnapshot = await notificationsRef.get();

          notificationsSnapshot.forEach((notificationDoc) => {
            rentalBatch.delete(notificationDoc.ref);
            admin.logger.info(
              `Deleted notification ${notificationDoc.id} for rental request ${rentalRequestId}.`
            );
            totalDeletions++;
          });
        }
      }

      // Commit the batch if there are deletions
      if (totalDeletions > 0) {
        await rentalBatch.commit();
        admin.logger.info(
          `Deleted ${totalDeletions} rental requests and associated data for listing ${listingId}.`
        );
      } else {
        admin.logger.info(
          `No rental requests found for listing ${listingId}.`
        );
      }

      // Step 2: Delete images from Firebase Storage
      const imageUrls = deletedData.images || [];
      const deletePromises = imageUrls.map(async (imageUrl) => {
        const filePathMatch = imageUrl.match(/\/o\/(.+?)\?/);
        if (filePathMatch && filePathMatch[1]) {
          const filePath = decodeURIComponent(filePathMatch[1]).replace(
            /%2F/g,
            '/'
          );
          try {
            await storageBucket.file(filePath).delete();
            admin.logger.info(`Deleted image at path: ${filePath}`);
          } catch (err) {
            admin.logger.error(
              `Failed to delete image ${filePath}:`,
              err
            );
          }
        } else {
          admin.logger.warn(
            `Unable to extract file path from image URL: ${imageUrl}`
          );
        }
      });

      await Promise.all(deletePromises);
      admin.logger.info(
        `Deleted ${imageUrls.length} images for listing ${listingId}.`
      );
    } catch (error) {
      admin.logger.error(
        `Error deleting associated data for listing ${listingId}:`,
        error
      );
    }

    return null;
  }
);

/**
 * handleAircraftDetails
 * Trigger: Firestore Document Create for aircraftDetails/{ownerId}
 * Description: Initializes default fields and validates initial data upon creation of aircraftDetails.
 */
exports.handleAircraftDetails = onDocumentCreated(
  'aircraftDetails/{ownerId}',
  async (snapshot, context) => {
    const ownerId = context.params.ownerId;
    const newData = snapshot.data();
    admin.logger.info(
      `New aircraftDetails created for ownerId: ${ownerId}`
    );

    // Initialize default fields if necessary
    const updatedData = {
      profileData: sanitizeData(newData.profileData || {}),
      aircraftDetails: sanitizeData(newData.aircraftDetails || {}),
      costData: sanitizeData(newData.costData || {}),
      selectedAircraftIds: newData.selectedAircraftIds || [],
      additionalAircrafts: newData.additionalAircrafts || [],
    };

    try {
      await db
        .collection('aircraftDetails')
        .doc(ownerId)
        .set(updatedData, { merge: true });
      admin.logger.info(
        `Initialized default fields for ownerId: ${ownerId}`
      );
    } catch (error) {
      admin.logger.error(
        `Error initializing data for ownerId ${ownerId}:`,
        error
      );
    }

    return null;
  }
);

/**
 * handleAircraftDetailsUpdate
 * Trigger: Firestore Document Update for aircraftDetails/{ownerId}
 * Description: Handles updates to aircraftDetails, including profile updates, cost recalculations, and validation.
 */
exports.handleAircraftDetailsUpdate = onDocumentUpdated(
  'aircraftDetails/{ownerId}',
  async (snapshot, context) => {
    const ownerId = context.params.ownerId;
    const beforeData = snapshot.before.data();
    const afterData = snapshot.after.data();
    admin.logger.info(
      `aircraftDetails updated for ownerId: ${ownerId}`
    );

    // Handle Profile Data Updates
    if (
      JSON.stringify(beforeData.profileData) !==
      JSON.stringify(afterData.profileData)
    ) {
      admin.logger.info(
        `Profile data updated for ownerId: ${ownerId}`
      );
      // Example: Trigger a notification if the owner's display name changes
      if (
        beforeData.profileData.displayName !==
        afterData.profileData.displayName
      ) {
        try {
          // Assume fcmToken is stored in profileData
          const fcmToken = afterData.profileData.fcmToken;
          if (fcmToken) {
            await sendNotification(
              [fcmToken],
              'Profile Updated',
              'Your profile information has been updated successfully.'
            );
          }
        } catch (error) {
          admin.logger.error(
            `Error sending notification for ownerId ${ownerId}:`,
            error
          );
        }
      }
    }

    // Handle Aircraft Details Updates
    if (
      JSON.stringify(beforeData.aircraftDetails) !==
      JSON.stringify(afterData.aircraftDetails)
    ) {
      admin.logger.info(
        `Aircraft details updated for ownerId: ${ownerId}`
      );
      // Example: Validate aircraft details or update related listings
      // Add your validation logic here
    }

    // Handle Cost Data Updates
    if (
      JSON.stringify(beforeData.costData) !==
      JSON.stringify(afterData.costData)
    ) {
      admin.logger.info(
        `Cost data updated for ownerId: ${ownerId}`
      );
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
        const monthlyInterestRate =
          parseFloat(interestRate) / 100 / 12;
        const numberOfPayments = parseFloat(loanTerm) * 12;
        const principal = parseFloat(loanAmount);
        const mortgageExpense = principal
          ? (
              (principal * monthlyInterestRate) /
              (1 - Math.pow(1 + monthlyInterestRate, -numberOfPayments))
            ).toFixed(2)
          : 0;

        const depreciationExpense = (
          (parseFloat(purchasePrice) *
            parseFloat(depreciationRate)) /
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
        const costPerHour = parseFloat(
          (totalCostPerYear / parseFloat(rentalHoursPerYear)).toFixed(
            2
          )
        );

        // Update the costPerHour field
        try {
          await db
            .collection('aircraftDetails')
            .doc(ownerId)
            .update({
              'costData.mortgageExpense': parseFloat(
                mortgageExpense
              ),
              'costData.depreciationExpense': parseFloat(
                depreciationExpense
              ),
              'costData.costPerHour': costPerHour,
            });
          admin.logger.info(
            `Recalculated costPerHour for ownerId: ${ownerId}`
          );
        } catch (error) {
          admin.logger.error(
            `Error updating costPerHour for ownerId ${ownerId}:`,
            error
          );
        }
      }
    }

    // Handle selectedAircraftIds Updates
    if (
      JSON.stringify(beforeData.selectedAircraftIds) !==
      JSON.stringify(afterData.selectedAircraftIds)
    ) {
      admin.logger.info(
        `Selected aircraft IDs updated for ownerId: ${ownerId}`
      );
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
        admin.logger.warn(
          `OwnerId: ${ownerId} has invalid selectedAircraftIds: ${invalidSelectedIds.join(
            ', '
          )}`
        );

        // Remove invalid IDs from selectedAircraftIds
        const updatedSelectedIds = selectedIds.filter((id) =>
          validAircraftIds.includes(id)
        );

        try {
          await db
            .collection('aircraftDetails')
            .doc(ownerId)
            .update({
              selectedAircraftIds: updatedSelectedIds,
            });
          admin.logger.info(
            `Removed invalid selectedAircraftIds for ownerId: ${ownerId}`
          );
        } catch (error) {
          admin.logger.error(
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
      admin.logger.info(
        `Additional aircrafts updated for ownerId: ${ownerId}`
      );
      // Example: Validate additional aircrafts or trigger related updates
      // Add your validation logic here
    }

    return null;
  }
);

// =====================
// Scheduled Functions
// =====================

/**
 * scheduledCleanupOrphanedRentalRequests
 * Trigger: Scheduled Function
 * Description: Periodically cleans up orphaned rental requests and associated data.
 */
exports.scheduledCleanupOrphanedRentalRequests = onSchedule(
  'every 24 hours',
  async (event) => {
    try {
      let totalDeletions = 0;

      // Step 1: Fetch all owners
      const ownersSnapshot = await db.collection('owners').get();
      admin.logger.info(
        `Fetched ${ownersSnapshot.size} owners for scheduled cleanup.`
      );

      for (const ownerDoc of ownersSnapshot.docs) {
        const ownerId = ownerDoc.id;
        admin.logger.info(`Processing owner: ${ownerId}`);

        const rentalRequestsRef = db
          .collection('owners')
          .doc(ownerId)
          .collection('rentalRequests');
        const rentalRequestsSnapshot = await rentalRequestsRef.get();
        admin.logger.info(
          `Owner ${ownerId} has ${rentalRequestsSnapshot.size} rental requests.`
        );

        const rentalBatch = db.batch();

        for (const requestDoc of rentalRequestsSnapshot.docs) {
          const requestData = requestDoc.data();
          const rentalRequestId = requestDoc.id;
          const renterId = requestData.renterId;
          const chatThreadId = requestData.chatThreadId;

          // Define criteria for orphaned rental requests
          // Example: Rental requests older than 30 days with no active status
          const createdAt = requestData.createdAt;
          const thirtyDaysAgo = admin.firestore.Timestamp.fromDate(
            new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
          );

          if (
            createdAt &&
            createdAt.toDate() < thirtyDaysAgo.toDate() &&
            requestData.status !== 'active'
          ) {
            // Delete the rental request
            rentalBatch.delete(requestDoc.ref);
            totalDeletions++;

            // Delete associated chat thread if exists
            if (chatThreadId) {
              const chatThreadRef = db
                .collection('messages')
                .doc(chatThreadId);
              rentalBatch.delete(chatThreadRef);
              admin.logger.info(
                `Deleted associated chat thread ${chatThreadId} for rental request ${rentalRequestId}.`
              );
              totalDeletions++;
            }

            // Delete notifications associated with the rental request
            if (renterId) {
              const notificationsRef = db
                .collection('renters')
                .doc(renterId)
                .collection('notifications')
                .where('rentalRequestId', '==', rentalRequestId);
              const notificationsSnapshot = await notificationsRef.get();

              notificationsSnapshot.forEach((notificationDoc) => {
                rentalBatch.delete(notificationDoc.ref);
                admin.logger.info(
                  `Deleted notification ${notificationDoc.id} for rental request ${rentalRequestId}.`
                );
                totalDeletions++;
              });
            }
          }
        }

        // Commit the batch if there are deletions
        if (totalDeletions > 0) {
          await rentalBatch.commit();
          admin.logger.info(
            `Deleted ${totalDeletions} rental requests and associated data for owner ${ownerId}.`
          );
        } else {
          admin.logger.info(
            `No orphaned rental requests found for owner ${ownerId}.`
          );
        }
      }

      admin.logger.info(
        `Scheduled cleanup complete. Total deletions: ${totalDeletions}`
      );
      return null;
    } catch (error) {
      admin.logger.error('Error during scheduled cleanup:', error);
      throw new Error('Scheduled cleanup failed.');
    }
  }
);

// =====================
// Error-Handling Middleware
// =====================

// This should be placed after all other app.use() and routes calls
app.use((err, req, res, next) => {
  admin.logger.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal Server Error' });
});

// Handle undefined routes
app.use((req, res, next) => {
  res.status(404).json({ error: 'Route not found' });
});

// =====================
// Export Express App as Firebase Function
// =====================
exports.api = onRequest(app);
