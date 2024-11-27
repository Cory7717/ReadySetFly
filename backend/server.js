// server.js

// =====================
// Imports
// =====================

const { onDocumentCreated, onDocumentUpdated, onDocumentDeleted } = require('firebase-functions/v2/firestore');
const { onRequest } = require('firebase-functions/v2/https');
const { onSchedule } = require('firebase-functions/v2/scheduler');
const { logger } = require('firebase-functions/v2');
const admin = require('firebase-admin');
const express = require('express');
const cors = require('cors');
const multer = require('multer'); // Retained since we're handling multipart/form-data
const Stripe = require('stripe');

// =====================
// Initialization
// =====================

admin.initializeApp({
  credential: admin.credential.applicationDefault(),
  storageBucket: 'ready-set-fly-71506.appspot.com',
});
logger.info('Firebase Admin Initialized Successfully.');

const db = admin.firestore();
const storageBucket = admin.storage().bucket('ready-set-fly-71506.appspot.com');

// =====================
// Express App Setup
// =====================

const app = express();

// Middleware
app.use(cors({ origin: true })); // Enable CORS for all origins
app.use(express.json()); // Parse JSON bodies
app.use(express.urlencoded({ extended: true })); // Parse URL-encoded bodies

// =====================
// Configuration Constants
// =====================

const MAX_IMAGES = 20; // Maximum number of images per upload
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB per file

// Define allowed pricing packages
const ALLOWED_PACKAGES = ['Basic', 'Featured', 'Enhanced'];

// Initialize Stripe with your secret key (ensure to replace with your actual key)
const stripe = Stripe('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');
logger.info('Stripe Initialized Successfully.');

// =====================
// Authentication Middleware
// =====================

const authenticate = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    logger.warn('Unauthorized access attempt: No token provided.');
    return res.status(401).json({ error: 'Unauthorized: No token provided' });
  }
  
  const idToken = authHeader.split('Bearer ')[1];
  
  try {
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    req.user = decodedToken;
    next();
  } catch (error) {
    logger.error('Error verifying Firebase ID token:', error);
    return res.status(401).json({ error: 'Unauthorized: Invalid token' });
  }
};

// =====================
// Data Sanitization Function
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

// =====================
// Configure Multer for Image Uploads
// =====================

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { 
    fileSize: MAX_FILE_SIZE, // 5MB per file
    files: MAX_IMAGES,        // Maximum number of files
  },
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith('image/')) {
      logger.warn(`Rejected file upload: ${file.originalname} is not an image.`);
      return cb(new multer.MulterError('LIMIT_UNEXPECTED_FILE', file.fieldname));
    }
    cb(null, true);
  },
});

// =====================
// Helper Functions
// =====================

/**
 * sendNotification
 * Sends notifications via FCM to specified tokens.
 * @param {Array} tokens - FCM tokens
 * @param {string} title - Notification title
 * @param {string} body - Notification body
 * @param {Object} data - Additional data payload
 */
const sendNotification = async (tokens, title, body, data = {}) => {
  const payload = {
    notification: {
      title,
      body,
    },
    data,
  };

  try {
    const response = await admin.messaging().sendToDevice(tokens, payload);
    logger.info('Notifications sent successfully:', response);
  } catch (error) {
    logger.error('Error sending notifications:', error);
  }
};

/**
 * calculateTotalCost
 * Calculates the total cost based on selected pricing package.
 * This function can be expanded based on business logic.
 * @param {string} packageType - Selected pricing package
 * @returns {number} - Price in dollars
 */
const calculateTotalCost = (packageType) => {
  const packagePrices = {
    Basic: 25,
    Featured: 70,
    Enhanced: 150, // Adjust as needed
  };

  return packagePrices[packageType] || 25; // Default to Basic if unknown
};

// =====================
// Routes: HTTP Endpoints via Express
// =====================

/**
 * @route   POST /createListing
 * @desc    Create a new listing with details and images.
 * @access  Protected
 */
app.post('/createListing', authenticate, upload.array('images', MAX_IMAGES), async (req, res) => {
  try {
    logger.info(`Received /createListing request from user: ${req.user.uid}`);
    
    // Extract and parse listingDetails
    const listingDetailsRaw = req.body.listingDetails;
    if (!listingDetailsRaw) {
      logger.warn("Missing 'listingDetails' in createListing request");
      return res.status(400).json({ error: "Missing 'listingDetails' in request body" });
    }

    let listingDetails;
    try {
      // Assume that 'listingDetails' is sent as a JSON string
      if (typeof listingDetailsRaw === 'string') {
        listingDetails = JSON.parse(listingDetailsRaw);
      } else {
        listingDetails = listingDetailsRaw;
      }
      logger.info(`Parsed listingDetails: ${JSON.stringify(listingDetails)}`);
    } catch (parseError) {
      logger.warn("Invalid JSON in 'listingDetails' field");
      logger.error("Error parsing listingDetails:", parseError);
      logger.error(`Received listingDetailsRaw: ${listingDetailsRaw}`);
      return res.status(400).json({ error: "Invalid JSON in 'listingDetails' field" });
    }

    // Extract fields from listingDetails
    const {
      title,
      tailNumber,
      price,
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
      isFreeListing, // Boolean indicating if the listing is free
      selectedPricing, // New field from client
      lat, // Latitude
      lng, // Longitude
    } = listingDetails;

    // Validate selectedPricing if not a free listing
    if (!(isFreeListing === 'true' || isFreeListing === true)) {
      if (!selectedPricing || !ALLOWED_PACKAGES.includes(selectedPricing)) {
        logger.warn(`Invalid or missing selectedPricing: ${selectedPricing}`);
        return res.status(400).json({ error: 'Invalid or missing selectedPricing.' });
      }
    }

    // Validation based on category and isFreeListing
    const categoryRequirements = {
      'Aircraft for Sale': ['title', 'description'],
      'Aviation Jobs': ['companyName', 'jobTitle', 'jobDescription'],
      'Flight Schools': ['flightSchoolName', 'flightSchoolDetails'],
    };

    let requiredFields = categoryRequirements[category];
    if (!requiredFields) {
      logger.warn(`Invalid category: ${category}`);
      return res.status(400).json({ error: `Invalid category: ${category}` });
    }

    // Conditionally require 'price' and 'selectedPricing' if not a free listing and category is 'Aircraft for Sale'
    if (category === 'Aircraft for Sale' && !(isFreeListing === 'true' || isFreeListing === true)) {
      requiredFields = [...requiredFields, 'price', 'selectedPricing'];
    }

    // Check for missing required fields
    const missingFields = requiredFields.filter(field => !listingDetails[field]);
    if (missingFields.length > 0) {
      logger.warn(`Missing required fields: ${missingFields.join(', ')}`);
      return res.status(400).json({ error: `Missing required fields: ${missingFields.join(', ')}` });
    }

    // Validate location data
    if (!lat || !lng) {
      logger.warn("Missing location data in createListing request");
      return res.status(400).json({ error: "Missing location data (lat, lng) in 'listingDetails'" });
    }

    const latitude = parseFloat(lat);
    const longitude = parseFloat(lng);
    if (isNaN(latitude) || isNaN(longitude)) {
      logger.warn("Invalid location data. 'lat' and 'lng' must be numbers.");
      return res.status(400).json({ error: "Invalid location data. 'lat' and 'lng' must be numbers." });
    }

    // If not a free listing and category is 'Aircraft for Sale', price should be greater than 0
    if (category === 'Aircraft for Sale' && !(isFreeListing === 'true' || isFreeListing === true) && price <= 0) {
      logger.warn("Price must be greater than 0 for paid Aircraft for Sale listings.");
      return res.status(400).json({ error: "Price must be greater than 0 for paid Aircraft for Sale listings." });
    }

    // Handle image uploads
    const imageUrls = [];
    if (req.files && req.files.length > 0) {
      for (const file of req.files) {
        try {
          const timestamp = Date.now();
          const sanitizedFileName = file.originalname.replace(/\s+/g, '_'); // Replace spaces with underscores
          const fileName = `${req.user.uid}/${timestamp}-${sanitizedFileName}`;
          logger.info(`Uploading image: ${fileName}`);

          const fileUpload = storageBucket.file(fileName);
          await fileUpload.save(file.buffer, {
            metadata: {
              contentType: file.mimetype,
            },
          });

          // Make the file public
          await fileUpload.makePublic();

          const publicUrl = `https://storage.googleapis.com/${storageBucket.name}/${encodeURIComponent(fileName)}`;
          imageUrls.push(publicUrl);
          logger.info(`Uploaded image URL: ${publicUrl}`);
        } catch (uploadError) {
          logger.error(`Error uploading image ${file.originalname}:`, uploadError);
          return res.status(500).json({ error: `Failed to upload image: ${file.originalname}` });
        }
      }
    } else {
      logger.info("No images uploaded.");
    }

    // Determine price based on selectedPricing if not a free listing
    let finalPrice = 0;
    if (isFreeListing === 'true' || isFreeListing === true) {
      finalPrice = 0;
    } else {
      finalPrice = calculateTotalCost(selectedPricing);
    }

    // Construct listingData
    const listingData = {
      title: title || '',
      tailNumber: tailNumber || '',
      price: finalPrice,
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
      isFreeListing: isFreeListing === 'true' || isFreeListing === true,
      packageType: isFreeListing === 'true' || isFreeListing === true ? null : selectedPricing,
      location: {
        lat: latitude,
        lng: longitude,
      },
      images: imageUrls,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      ownerId: req.user.uid,
      status: 'pending', // Initial status
    };

    logger.info(`Creating Firestore document with data: ${JSON.stringify(listingData)}`);

    const listingRef = await db.collection('listings').add(listingData);
    logger.info(`Listing created with ID: ${listingRef.id}`);

    res.status(201).json({ success: true, listingId: listingRef.id });
  } catch (error) {
    logger.error("Error in /createListing endpoint:", error);
    res.status(500).json({ error: error.message || "Internal Server Error" });
  }
});

/**
 * @route   PUT /updateListing
 * @desc    Update an existing listing with new details and images.
 * @access  Protected
 */
app.put('/updateListing', authenticate, upload.array('images', MAX_IMAGES), async (req, res) => {
  try {
    const { listingId, listingDetails } = req.body;

    logger.info(`Received /updateListing request for listing ID: ${listingId} from user: ${req.user.uid}`);

    // Validate listingId
    if (!listingId) {
      logger.warn("Missing listingId in updateListing request");
      return res.status(400).json({ error: 'Missing listingId in request body' });
    }

    // Fetch the listing
    const listingRef = db.collection('listings').doc(listingId);
    const listingDoc = await listingRef.get();

    if (!listingDoc.exists) {
      logger.warn(`Listing not found: ID ${listingId}`);
      return res.status(404).json({ error: 'Listing not found' });
    }

    const listingData = listingDoc.data();

    // Verify ownership
    if (listingData.ownerId !== req.user.uid) {
      logger.warn(`Unauthorized update attempt by user ${req.user.uid} for listing ${listingId}`);
      return res.status(403).json({ error: 'You do not own this listing' });
    }

    // Validate listingDetails
    if (!listingDetails) {
      logger.warn("Missing listingDetails in updateListing request");
      return res.status(400).json({ error: 'Missing listingDetails in request body' });
    }

    // Sanitize listingDetails
    const sanitizedListingDetails = sanitizeData(listingDetails);

    // Extract fields from listingDetails
    const {
      title,
      tailNumber,
      price,
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
      isFreeListing, // Boolean indicating if the listing is free
      selectedPricing, // New field from client
      lat, // Latitude
      lng, // Longitude
    } = sanitizedListingDetails;

    // Validate selectedPricing if not a free listing
    if (!(isFreeListing === 'true' || isFreeListing === true)) {
      if (!selectedPricing || !ALLOWED_PACKAGES.includes(selectedPricing)) {
        logger.warn(`Invalid or missing selectedPricing: ${selectedPricing}`);
        return res.status(400).json({ error: 'Invalid or missing selectedPricing.' });
      }
    }

    // Validation based on category and isFreeListing
    const categoryRequirements = {
      'Aircraft for Sale': ['title', 'description'],
      'Aviation Jobs': ['companyName', 'jobTitle', 'jobDescription'],
      'Flight Schools': ['flightSchoolName', 'flightSchoolDetails'],
    };

    let requiredFields = categoryRequirements[category];
    if (!requiredFields) {
      logger.warn(`Invalid category: ${category}`);
      return res.status(400).json({ error: `Invalid category: ${category}` });
    }

    // Conditionally require 'price' and 'selectedPricing' if not a free listing and category is 'Aircraft for Sale'
    if (category === 'Aircraft for Sale' && !(isFreeListing === 'true' || isFreeListing === true)) {
      requiredFields = [...requiredFields, 'price', 'selectedPricing'];
    }

    // Check for missing required fields
    const missingFields = requiredFields.filter(field => !sanitizedListingDetails[field]);
    if (missingFields.length > 0) {
      logger.warn(`Missing required fields: ${missingFields.join(', ')}`);
      return res.status(400).json({ error: `Missing required fields: ${missingFields.join(', ')}` });
    }

    // Validate location data
    if (!lat || !lng) {
      logger.warn("Missing location data in updateListing request");
      return res.status(400).json({ error: "Missing location data (lat, lng) in 'listingDetails'" });
    }

    const latitude = parseFloat(lat);
    const longitude = parseFloat(lng);
    if (isNaN(latitude) || isNaN(longitude)) {
      logger.warn("Invalid location data. 'lat' and 'lng' must be numbers.");
      return res.status(400).json({ error: "Invalid location data. 'lat' and 'lng' must be numbers." });
    }

    // If not a free listing and category is 'Aircraft for Sale', price should be greater than 0
    if (category === 'Aircraft for Sale' && !(isFreeListing === 'true' || isFreeListing === true) && price <= 0) {
      logger.warn("Price must be greater than 0 for paid Aircraft for Sale listings.");
      return res.status(400).json({ error: "Price must be greater than 0 for paid Aircraft for Sale listings." });
    }

    // Handle image uploads
    const imageUrls = [];
    if (req.files && req.files.length > 0) {
      for (const file of req.files) {
        try {
          const timestamp = Date.now();
          const sanitizedFileName = file.originalname.replace(/\s+/g, '_'); // Replace spaces with underscores
          const fileName = `${req.user.uid}/${timestamp}-${sanitizedFileName}`;
          logger.info(`Uploading image: ${fileName}`);

          const fileUpload = storageBucket.file(fileName);
          await fileUpload.save(file.buffer, {
            metadata: {
              contentType: file.mimetype,
            },
          });

          // Make the file public
          await fileUpload.makePublic();

          const publicUrl = `https://storage.googleapis.com/${storageBucket.name}/${encodeURIComponent(fileName)}`;
          imageUrls.push(publicUrl);
          logger.info(`Uploaded image URL: ${publicUrl}`);
        } catch (uploadError) {
          logger.error(`Error uploading image ${file.originalname}:`, uploadError);
          return res.status(500).json({ error: `Failed to upload image: ${file.originalname}` });
        }
      }
    } else {
      logger.info("No images uploaded for update.");
    }

    // Determine price based on selectedPricing if not a free listing
    let finalPrice = listingData.price; // Default to existing price
    let finalPackageType = listingData.packageType; // Default to existing packageType

    if (isFreeListing === 'true' || isFreeListing === true) {
      finalPrice = 0;
      finalPackageType = null;
    } else {
      finalPrice = calculateTotalCost(selectedPricing);
      finalPackageType = selectedPricing;
    }

    // Construct updateData
    const updateData = {
      title: title || listingData.title,
      tailNumber: tailNumber || listingData.tailNumber,
      price: finalPrice,
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
      isFreeListing: isFreeListing === 'true' || isFreeListing === true,
      packageType: finalPackageType,
      location: {
        lat: latitude,
        lng: longitude,
      },
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    if (imageUrls.length > 0) {
      updateData.images = admin.firestore.FieldValue.arrayUnion(...imageUrls);
    }

    logger.info(`Updating listing ID: ${listingId} with data: ${JSON.stringify(updateData)}`);

    await listingRef.update(updateData);
    logger.info(`Listing updated with ID: ${listingId}`);

    res.status(200).json({ success: true, listingId });
  } catch (error) {
    logger.error("Error in /updateListing endpoint:", error);
    res.status(500).json({ error: error.message || "Internal Server Error" });
  }
});

/**
 * @route   POST /create-classified-payment-intent
 * @desc    Create a Stripe payment intent for classified listings.
 * @access  Protected
 */
app.post('/create-classified-payment-intent', authenticate, async (req, res) => {
  try {
    const { amount, currency = 'usd', listingId } = req.body;

    // Validate inputs
    if (!amount || !listingId) {
      logger.warn("Missing required fields: amount and listingId");
      return res.status(400).json({ error: 'Missing required fields: amount and listingId' });
    }

    // Verify that the listing exists and belongs to the user
    const listingRef = db.collection('listings').doc(listingId);
    const listingDoc = await listingRef.get();
    if (!listingDoc.exists) {
      logger.warn(`Listing not found: ID ${listingId}`);
      return res.status(404).json({ error: 'Listing not found' });
    }

    const listingData = listingDoc.data();
    if (listingData.ownerId !== req.user.uid) {
      logger.warn(`Unauthorized payment intent creation attempt by user ${req.user.uid} for listing ${listingId}`);
      return res.status(403).json({ error: 'You do not own this listing' });
    }

    // Create a payment intent with Stripe
    const paymentIntent = await stripe.paymentIntents.create({
      amount: amount, // Amount in cents
      currency: currency,
      metadata: { listingId: listingId, ownerId: listingData.ownerId },
    });

    logger.info(`PaymentIntent created for listing ${listingId}: ${paymentIntent.id}`);

    res.status(200).json({ clientSecret: paymentIntent.client_secret });
  } catch (error) {
    logger.error("Error in /create-classified-payment-intent endpoint:", error);
    res.status(500).json({ error: error.message || "Internal Server Error" });
  }
});

/**
 * @route   POST /create-rental-payment-intent
 * @desc    Create a Stripe payment intent for rental requests.
 * @access  Protected
 * 
 * NOTE: This function remains unchanged as per your request.
 */
app.post('/create-rental-payment-intent', authenticate, async (req, res) => {
  try {
    const { rentalRequestId } = req.body;

    if (!rentalRequestId) {
      logger.warn("Missing rentalRequestId in request body");
      return res.status(400).json({ error: 'Missing rentalRequestId in request body' });
    }

    // Fetch the rental request
    const rentalRequestRef = db.collectionGroup('rentalRequests').where(admin.firestore.FieldPath.documentId(), '==', rentalRequestId).limit(1);
    const rentalRequestSnapshot = await rentalRequestRef.get();

    if (rentalRequestSnapshot.empty) {
      logger.warn(`Rental request not found: ID ${rentalRequestId}`);
      return res.status(404).json({ error: 'Rental request not found' });
    }

    const rentalRequestDoc = rentalRequestSnapshot.docs[0];
    const rentalRequest = rentalRequestDoc.data();

    // Verify ownership
    if (rentalRequest.ownerId !== req.user.uid) {
      logger.warn(`Unauthorized payment intent creation attempt by user ${req.user.uid} for rental request ${rentalRequestId}`);
      return res.status(403).json({ error: 'You do not own this rental request' });
    }

    // Calculate the amount (if not already stored)
    let amount = rentalRequest.totalAmount;
    if (!amount) {
      const { costPerHour, rentalHours } = rentalRequest;
      if (!costPerHour || !rentalHours) {
        logger.warn(`Invalid rental request data for rentalRequestId: ${rentalRequestId}`);
        return res.status(400).json({ error: 'Invalid rental request data' });
      }
      const baseAmount = costPerHour * rentalHours; // in dollars
      const bookingFee = baseAmount * 0.06; // 6%
      const processingFee = baseAmount * 0.03; // 3%
      const tax = (baseAmount + bookingFee) * 0.0825; // 8.25%
      amount = Math.round((baseAmount + bookingFee + processingFee + tax) * 100); // Convert to cents

      // Update the rental request with the calculated totalAmount
      await rentalRequestDoc.ref.update({ totalAmount: amount });
      logger.info(`Calculated and updated totalAmount for rentalRequestId: ${rentalRequestId} to ${amount} cents`);
    }

    // Create a payment intent with Stripe
    const paymentIntent = await stripe.paymentIntents.create({
      amount: amount,
      currency: 'usd',
      metadata: { rentalRequestId: rentalRequestId, ownerId: rentalRequest.ownerId },
    });

    logger.info(`PaymentIntent created for rental request ${rentalRequestId}: ${paymentIntent.id}`);

    res.status(200).json({ clientSecret: paymentIntent.client_secret });
  } catch (error) {
    logger.error("Error in /create-rental-payment-intent endpoint:", error);
    res.status(500).json({ error: error.message || "Internal Server Error" });
  }
});

/**
 * @route   POST /validateDiscount
 * @desc    Validate a discount code and apply it to the amount.
 * @access  Protected
 */
app.post('/validateDiscount', authenticate, async (req, res) => {
  try {
    const { discountCode, amount } = req.body;

    if (!discountCode || typeof amount !== 'number') {
      logger.warn("Invalid request parameters for discount validation");
      return res.status(400).json({ valid: false, message: 'Invalid request parameters' });
    }

    // Define discount codes (Alternatively, fetch from Firestore)
    const discountCodes = {
      'SUMMER20': { type: 'percentage', value: 20, message: '20% off your listing!' },
      'FLY50': { type: 'fixed', value: 5000, message: '$50 off your listing!' }, // amount in cents
      // Add more discount codes as needed
    };

    const discount = discountCodes[discountCode.toUpperCase()];

    if (!discount) {
      logger.info(`Invalid discount code attempted: ${discountCode}`);
      return res.status(200).json({ valid: false, message: 'Invalid discount code.' });
    }

    let adjustedAmount = amount;
    let pricingTier = 'Basic'; // Default pricing tier

    if (discount.type === 'percentage') {
      adjustedAmount = Math.round(adjustedAmount * (1 - discount.value / 100));
      pricingTier = 'Featured'; // Example: Upgrade pricing tier
    } else if (discount.type === 'fixed') {
      adjustedAmount = adjustedAmount - discount.value;
      if (adjustedAmount < 0) adjustedAmount = 0;
      pricingTier = 'Enhanced'; // Example: Upgrade pricing tier
    }

    logger.info(`Discount code ${discountCode} applied. Adjusted amount: ${adjustedAmount} cents.`);

    res.status(200).json({
      valid: true,
      adjustedAmount,
      pricingTier,
      message: discount.message,
    });
  } catch (error) {
    logger.error("Error in /validateDiscount endpoint:", error);
    res.status(500).json({ valid: false, message: 'Internal Server Error' });
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
      logger.warn("Missing listingId in deleteListing request");
      return res.status(400).json({ error: 'Missing listingId in request body' });
    }

    // Fetch the listing
    const listingRef = db.collection('listings').doc(listingId);
    const listingDoc = await listingRef.get();

    if (!listingDoc.exists) {
      logger.warn(`Listing not found: ID ${listingId}`);
      return res.status(404).json({ error: 'Listing not found' });
    }

    const listingData = listingDoc.data();

    // Verify ownership
    if (listingData.ownerId !== req.user.uid) {
      logger.warn(`Unauthorized delete attempt by user ${req.user.uid} for listing ${listingId}`);
      return res.status(403).json({ error: 'You do not own this listing' });
    }

    // Delete images from Firebase Storage
    const imageUrls = listingData.images || [];
    const deletePromises = imageUrls.map(async imageUrl => {
      const filePathMatch = imageUrl.match(/\/o\/(.+?)\?/);
      if (filePathMatch && filePathMatch[1]) {
        const filePath = decodeURIComponent(filePathMatch[1]).replace(/%2F/g, "/");
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
    logger.info(`Deleted ${imageUrls.length} images for listing ${listingId}.`);

    // Delete the listing document
    await listingRef.delete();
    logger.info(`Deleted listing with ID: ${listingId}`);

    res.status(200).json({ success: true, message: 'Listing deleted successfully' });
  } catch (error) {
    logger.error("Error in /deleteListing endpoint:", error);
    res.status(500).json({ error: error.message || "Internal Server Error" });
  }
});

// =====================
// Firestore-Triggered Functions
// =====================

/**
 * onMessageSent
 * Trigger: Firestore Document Creation for messages/{messageId}
 */
exports.onMessageSent = onDocumentCreated('messages/{messageId}', async (event) => {
  const { messageId } = event.params;
  const messageData = event.data;

  const { recipients, text, chatThreadId, senderId } = messageData;

  if (!recipients || !Array.isArray(recipients)) {
    logger.warn(`Invalid recipients for message ${messageId}`);
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
      logger.warn('No FCM tokens found for recipients.');
      return null;
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

  return null;
});

/**
 * onListingDeleted
 * Trigger: Firestore Document Deletion for listings/{listingId}
 */
exports.onListingDeleted = onDocumentDeleted('listings/{listingId}', async (event) => {
  const { listingId } = event.params;
  const deletedData = event.data;

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

  return null;
});

/**
 * handleAircraftDetails
 * Trigger: Firestore Document Create for aircraftDetails/{ownerId}
 * Description: Initializes default fields and validates initial data upon creation of aircraftDetails.
 */
exports.handleAircraftDetails = onDocumentCreated('aircraftDetails/{ownerId}', async (event) => {
  const ownerId = event.params.ownerId;
  const newData = event.data;
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

  return null;
});

/**
 * handleAircraftDetailsUpdate
 * Trigger: Firestore Document Update for aircraftDetails/{ownerId}
 * Description: Handles updates to aircraftDetails, including profile updates, cost recalculations, and validation.
 */
exports.handleAircraftDetailsUpdate = onDocumentUpdated('aircraftDetails/{ownerId}', async (event) => {
  const ownerId = event.params.ownerId;
  const beforeData = event.data.before;
  const afterData = event.data.after;
  logger.info(`aircraftDetails updated for ownerId: ${ownerId}`);

  // Handle Profile Data Updates
  if (JSON.stringify(beforeData.profileData) !== JSON.stringify(afterData.profileData)) {
    logger.info(`Profile data updated for ownerId: ${ownerId}`);
    // Example: Trigger a notification if the owner's display name changes
    if (beforeData.profileData.displayName !== afterData.profileData.displayName) {
      try {
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
        logger.error(`Error sending notification for ownerId ${ownerId}:`, error);
      }
    }
  }

  // Handle Aircraft Details Updates
  if (JSON.stringify(beforeData.aircraftDetails) !== JSON.stringify(afterData.aircraftDetails)) {
    logger.info(`Aircraft details updated for ownerId: ${ownerId}`);
    // Example: Validate aircraft details or update related listings
    // Add your validation logic here
  }

  // Handle Cost Data Updates
  if (JSON.stringify(beforeData.costData) !== JSON.stringify(afterData.costData)) {
    logger.info(`Cost data updated for ownerId: ${ownerId}`);
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
  if (JSON.stringify(beforeData.selectedAircraftIds) !== JSON.stringify(afterData.selectedAircraftIds)) {
    logger.info(`Selected aircraft IDs updated for ownerId: ${ownerId}`);
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
  if (JSON.stringify(beforeData.additionalAircrafts) !== JSON.stringify(afterData.additionalAircrafts)) {
    logger.info(`Additional aircrafts updated for ownerId: ${ownerId}`);
    // Example: Validate additional aircrafts or trigger related updates
    // Add your validation logic here
  }

  return null;
});

/**
 * scheduledCleanupOrphanedRentalRequests
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
        logger.info(`Deleted ${totalDeletions} rental requests and associated data for owner ${ownerId}.`);
      } else {
        logger.info(`No rental requests found for owner ${ownerId}.`);
      }
    }

    logger.info(`Cleanup complete. Total deletions: ${totalDeletions}`);
    return null;
  } catch (error) {
    logger.error('Error during scheduled cleanup:', error);
    throw new Error('Scheduled cleanup failed.');
  }
});

// =====================
// Error-Handling Middleware
// =====================

// This should be placed after all other app.use() and routes calls
app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    // Handle Multer-specific errors
    if (err.code === 'LIMIT_UNEXPECTED_FILE') {
      logger.warn(`Multer Error: Too many files uploaded by user ${req.user ? req.user.uid : 'Unknown User'}`);
      return res.status(400).json({ error: `Too many files uploaded. Maximum is ${MAX_IMAGES}.` });
    }
    if (err.code === 'LIMIT_FILE_SIZE') {
      logger.warn(`Multer Error: File size too large uploaded by user ${req.user ? req.user.uid : 'Unknown User'}`);
      return res.status(400).json({ error: 'File size too large. Maximum is 5MB per file.' });
    }
    // Handle other Multer errors
    logger.warn(`Multer Error: ${err.message} by user ${req.user ? req.user.uid : 'Unknown User'}`);
    return res.status(400).json({ error: err.message });
  } else if (err.message && err.message.includes('Unexpected end of form')) {
    // Handle incomplete form data errors from Busboy
    logger.warn(`Malformed form data from user ${req.user ? req.user.uid : 'Unknown User'}`);
    return res.status(400).json({ error: 'Incomplete form data. Please ensure all fields are correctly filled and try again.' });
  } else if (err) {
    // Handle other types of errors
    logger.error("Unhandled error:", err);
    return res.status(500).json({ error: "Internal Server Error" });
  }
  next();
});

// =====================
// Export Express App as Firebase Function
// =====================
exports.api = onRequest(app);
