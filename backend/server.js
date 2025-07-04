// require("dotenv").config();

// const functions = require('firebase‑functions');

// =====================
// Imports
// =====================
const express = require("express");
const cors = require("cors");
const admin = require("firebase-admin");
const Stripe = require("stripe");
const bodyParser = require("body-parser");
const nodemailer = require("nodemailer");
const { defineSecret } = require("firebase-functions/params");

// Firebase Functions v2 imports
const { onRequest } = require("firebase-functions/v2/https");
const {
  onDocumentCreated,
  onDocumentUpdated,
  onDocumentDeleted,
} = require("firebase-functions/v2/firestore");
const { onSchedule } = require("firebase-functions/v2/scheduler");

// =====================
// Initialize Firebase Admin SDK
// =====================
admin.initializeApp({
  credential: admin.credential.applicationDefault(),
  storageBucket: "ready-set-fly-71506.appspot.com", // Replace with your storage bucket
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
// =====================
// Configuration Constants
// =====================
const ALLOWED_PACKAGES = ["Basic", "Featured", "Enhanced", "Charter Services"]; // Note: 'FreeTrial' is handled separately.

// Step 4: Load Stripe & moderator secrets via Firebase Functions v2 params
const STRIPE_SECRET_KEY = defineSecret("STRIPE_SECRET_KEY");
const STRIPE_WEBHOOK_SECRET = defineSecret("STRIPE_WEBHOOK_SECRET");
const MODERATOR_EMAIL_SECRET = defineSecret("MODERATOR_EMAIL");

// Initialize Stripe and moderator email at runtime
// REMOVE this block-scoped initialization to avoid redeclaration error.
// Stripe and related secrets are initialized in initStripeAndEmail().

// =====================
// Email (Nodemailer) setup            // <-- NEW block
// =====================

// ─── SMTP (Nodemailer) setup ────────────────────────────────────────
const SMTP_HOST = defineSecret("SMTP_HOST");
const SMTP_PORT = defineSecret("SMTP_PORT");
const SMTP_USER = defineSecret("SMTP_USER");
const SMTP_PASS = defineSecret("SMTP_PASS");

let emailEnabled = false;

let transporter = null;
async function initTransporter() {
  if (transporter) return; // only once per cold start
  const [host, portStr, user, pass] = await Promise.all([
    SMTP_HOST.value(),
    SMTP_PORT.value(),
    SMTP_USER.value(),
    SMTP_PASS.value(),
  ]);
  const port = parseInt(portStr, 10);
if (!host || Number.isNaN(port) || !user || !pass) {
  admin.logger.warn("⚠️ SMTP secrets missing or invalid – email disabled.");
  return;
}
  transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });
  transporter.verify((err) =>
    err
      ? admin.logger.error("❌ SMTP config error", err)
      : admin.logger.info("✅ SMTP transporter ready")
  );
}

// 3) Immediately fetch and configure nodemailer

// how many free days each category gets
const TRIAL_DAYS = {
  Basic: 7,
  "Aviation Jobs": 7,
  "Flight Schools": 7, // changed from 14 → 7
  "Flight Instructors": 7,
  "Aviation Mechanic": 7,
  "Charter Services": 7,
};

// how much to charge (in cents) for the 30-day period *after* the trial
const PRICE_BY_CATEGORY = {
  Basic: 2500, // if you ever want Basic paid
  "Aviation Jobs": 0, // stays free forever
  "Flight Schools": 25000, // $250.00
  "Flight Instructors": 3000, // $30.00
  "Aviation Mechanic": 3000, // $30.00
  "Charter Services": 25000, // $250.00
};

const ALLOWED_ORIGINS = [
  "https://readysetfly.us",
  // "https://www.readysetfly.us",
  // "https://admin.readysetfly.com",
];
// =====================
// Initialize Express App
// =====================

// =====================
// Initialize Express App
// =====================
const app = express();

// 1) Health-check (no async/init middleware in the way)
app.get("/", (req, res) => {
  res.status(200).send("OK");
});
// right after you create `const app = express();`
app.use(async (req, res, next) => {
   // don’t block health checks
  if (req.path === "/") return next();

  try {
    await initStripeAndEmail();
    await initTransporter(); // also ensure your mailer is ready
    next();
  } catch (err) {
    // if you really need, you can log but still continue
    console.error("Failed to init secrets:", err);
    next();
  }
});

// CORS middleware
app.use(
  cors({
    origin: (incomingOrigin, callback) => {
      // allow Postman / mobile apps / server-to-server calls
      if (!incomingOrigin) return callback(null, true);
      if (ALLOWED_ORIGINS.includes(incomingOrigin)) {
        return callback(null, true);
      }
      callback(
        new Error(`CORS policy: origin '${incomingOrigin}' is not permitted.`)
      );
    },
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

let stripe;
let stripeWebhookSecret;
let moderatorEmail;

// only run once per cold start
async function initStripeAndEmail() {
  if (stripe) return;

  // grab all your secrets in parallel
  const [stripeKey, webhookSecret, modEmail] = await Promise.all([
    STRIPE_SECRET_KEY.value(),
    STRIPE_WEBHOOK_SECRET.value(),
    MODERATOR_EMAIL_SECRET.value(),
  ]);

  stripe = new Stripe(stripeKey);
  stripeWebhookSecret = webhookSecret;
  moderatorEmail = modEmail;

  // optionally log
  admin.logger.info("🔑 Stripe & moderator-email ready.");
}

/**
 * ===============================
 * Stripe Webhook Endpoint (raw body needed)
 * IMPORTANT: We define this route BEFORE the JSON/body-parsing middleware
 * so that req.body remains raw for Stripe's signature check.
 * ===============================
 */

app.post(
  "/webhook",
  bodyParser.raw({ type: "application/json" }),
  async (req, res) => {
    const sig = req.headers["stripe-signature"];
    let event;
    try {
      event = stripe.webhooks.constructEvent(
        req.body,
        sig,
        stripeWebhookSecret
      );
      admin.logger.info(`Received Stripe event: ${event.type}`);
    } catch (err) {
      admin.logger.error(
        `Webhook signature verification failed: ${err.message}`
      );
      res.setHeader("Content-Type", "application/json");
      return res.status(400).json({ error: `Webhook Error: ${err.message}` });
    }

    try {
      switch (event.type) {
        case "payment_intent.created": {
          const paymentIntent = event.data.object;
          admin.logger.info(`PaymentIntent created: ${paymentIntent.id}`);
          break;
        }

        case "payment_intent.succeeded": {
          const paymentIntent = event.data.object;
          admin.logger.info(`PaymentIntent succeeded: ${paymentIntent.id}`);
          const { listingId, ownerId, rentalRequestId } =
            paymentIntent.metadata;

          // ── 1) Update classified listing ─────────────────────────────────
          if (listingId && ownerId) {
            const listingRef = db.collection("listings").doc(listingId);
            const listingSnap = await listingRef.get();
            if (!listingSnap.exists) {
              admin.logger.warn(
                `Listing not found for listingId: ${listingId}`
              );
            } else {
              // activate the listing
              await listingRef.update({
                status: "active",
                paymentStatus: "succeeded",
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
              });
              admin.logger.info(`Listing ${listingId} updated to active.`);

              // ── 5b) Extend trialExpiry by TRIAL_DAYS[packageType]
              const listing = listingSnap.data();
              const days = TRIAL_DAYS[listing.packageType] || 0;
              if (days > 0) {
                const newExpiry = admin.firestore.Timestamp.fromDate(
                  new Date(Date.now() + days * 24 * 60 * 60 * 1000)
                );
                await listingRef.update({ trialExpiry: newExpiry });
                admin.logger.info(
                  `Listing ${listingId} trialExpiry set to ${newExpiry
                    .toDate()
                    .toISOString()} (+${days}d).`
                );
              }
            }
          }

          // ── 2) Update rental request ───────────────────────────────────────
          if (rentalRequestId && ownerId) {
            const rentalRequestRef = db
              .collection("rentalRequests")
              .doc(rentalRequestId);
            const rentalRequestDoc = await rentalRequestRef.get();
            if (!rentalRequestDoc.exists) {
              admin.logger.warn(`Rental request not found: ${rentalRequestId}`);
            } else {
              await rentalRequestRef.update({
                paymentStatus: "succeeded",
                rentalStatus: "active",
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
              });
              admin.logger.info(
                `Rental request ${rentalRequestId} updated to active.`
              );
            }

            // ── 3) Calculate net and credit owner ────────────────────────────
            const totalAmount = paymentIntent.amount; // in cents
            const platformFeePercentage = 0.2325; // 23.25% of base fee
            const totalMultiplier = 1.1725; // base + fees
            const applicationFee =
              paymentIntent.application_fee_amount ||
              Math.round(
                totalAmount * (platformFeePercentage / totalMultiplier)
              );
            const netAmount = totalAmount - applicationFee;

            // 3a) increment availableBalance
            await db
              .collection("users")
              .doc(ownerId)
              .update({
                availableBalance:
                  admin.firestore.FieldValue.increment(netAmount),
              });
            admin.logger.info(
              `Owner ${ownerId} availableBalance incremented by ${netAmount} cents.`
            );

            // 3b) record the payment for Year-to-Date sums
            await db
              .collection("users")
              .doc(ownerId)
              .collection("payments")
              .add({
                netAmount,
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
              });
            admin.logger.info(
              `Owner ${ownerId} payment record of ${netAmount}¢ written to Firestore.`
            );
          }

          break;
        }

        case "payment_intent.payment_failed": {
          const paymentIntent = event.data.object;
          admin.logger.info(
            `PaymentIntent payment failed: ${paymentIntent.id}`
          );
          break;
        }

        case "payment_intent.canceled": {
          const paymentIntent = event.data.object;
          admin.logger.info(`PaymentIntent canceled: ${paymentIntent.id}`);
          break;
        }

        case "charge.refunded": {
          const charge = event.data.object;
          admin.logger.info(`Charge refunded: ${charge.id}`);
          break;
        }

        case "charge.dispute.created": {
          const dispute = event.data.object;
          admin.logger.info(`Charge dispute created: ${dispute.id}`);
          break;
        }

        case "account.updated": {
          const account = event.data.object;
          admin.logger.info(`Account updated: ${account.id}`);
          break;
        }

        case "payout.paid": {
          const payout = event.data.object;
          admin.logger.info(`Payout paid: ${payout.id}`);
          const ownerId = payout.metadata && payout.metadata.ownerId;
          if (ownerId) {
            await db
              .collection("users")
              .doc(ownerId)
              .update({
                totalWithdrawn: admin.firestore.FieldValue.increment(
                  payout.amount
                ),
                availableBalance: admin.firestore.FieldValue.increment(
                  -payout.amount
                ),
              });
            admin.logger.info(
              `Owner ${ownerId} totalWithdrawn incremented by ${payout.amount} cents.`
            );
          } else {
            admin.logger.warn(
              "Payout does not include an ownerId in its metadata."
            );
          }
          break;
        }

        default:
          admin.logger.warn(`Unhandled event type ${event.type}`);
      }
    } catch (err) {
      admin.logger.error(
        `Error processing event ${event.id}: ${err.message}`,
        err
      );
    }

    res.setHeader("Content-Type", "application/json");
    res.json({ received: true });
  }
);

// =====================
// Middleware for Firebase ID Token Authentication
// =====================
const authenticate = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    admin.logger.warn("Unauthorized: No token provided.");
    res.setHeader("Content-Type", "application/json");
    return res.status(401).json({ error: "Unauthorized: No token provided" });
  }
  const idToken = authHeader.split("Bearer ")[1];
  try {
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    req.user = decodedToken;
    next();
  } catch (error) {
    admin.logger.error("Error verifying Firebase ID token:", error);
    res.setHeader("Content-Type", "application/json");
    return res.status(401).json({ error: "Unauthorized: Invalid token" });
  }
};

// =====================
// Global Body Parsing Middleware
// =====================
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ─── Contact Form Endpoint ─────────────────────────────────────────
app.post("/contact", async (req, res) => {
  // Grab & sanitize incoming fields
  const { firstName, lastName, email, message } = req.body || {};
  if (!firstName || !lastName || !email || !message) {
    return res.status(400).json({ error: "All fields are required." });
  }

  try {
    // ensure transporter is ready
    await initTransporter();
    if (!transporter) {
      return res.status(500).json({ error: "Email service not configured." });
    }

    // send the mail
    await transporter.sendMail({
      from: `"Ready Set Fly Contact" <${await SMTP_USER.value()}>`,
      to: "coryarmer@gmail.com",
      subject: "New Contact Us Message",
      text: `
First Name: ${firstName}
Last Name:  ${lastName}
Email:      ${email}

Message:
${message}
      `,
    });

    return res.status(200).json({ success: true, message: "Message sent." });
  } catch (err) {
    admin.logger.error("Error in /contact:", err);
    return res
      .status(500)
      .json({ error: "Failed to send message. Please try again." });
  }
});

// ───────────────────────────────────────────────────
// Stripe Admin: Search Customers/Accounts
// ───────────────────────────────────────────────────
app.get("/stripe/search", authenticate, async (req, res) => {
  const q = req.query.q;
  if (!q) return res.status(400).json({ error: "Missing query" });

  try {
    // first try customer lookup
    const customers = await stripe.customers.search({
      query: `email:'${q}' or metadata['account_number']:'${q}'`,
      limit: 10,
    });

    // if none, try account lookup
    let accounts = [];
    if (customers.data.length === 0) {
      const acct = await stripe.accounts.list({ limit: 10, email: q });
      accounts = acct.data;
    }

    return res.json({ customers: customers.data, accounts });
  } catch (err) {
    console.error("Error in /stripe/search:", err);
    return res.status(500).json({ error: err.message });
  }
});

// ───────────────────────────────────────────────────
// Stripe Admin: List Recent Charges
// ───────────────────────────────────────────────────
app.get("/stripe/charges", authenticate, async (req, res) => {
  const limit = parseInt(req.query.limit, 10) || 10;

  try {
    const charges = await stripe.charges.list({ limit });
    return res.json({ data: charges.data });
  } catch (err) {
    console.error("Error in /stripe/charges:", err);
    return res.status(500).json({ error: err.message });
  }
});

// ───────────────────────────────────────────────────
// Stripe Admin: Issue a Refund
// ───────────────────────────────────────────────────
app.get("/stripe/refund", authenticate, async (req, res) => {
  const { chargeId } = req.body;
  if (!chargeId) return res.status(400).json({ error: "Missing chargeId" });

  try {
    const refund = await stripe.refunds.create({ charge: chargeId });
    return res.json({ refund });
  } catch (err) {
    console.error("Error in /stripe/refund:", err);
    return res.status(500).json({ error: err.message });
  }
});

app.get("/stripe/reports", authenticate, async (req, res) => {
  // initialize a fresh stripe client
 const stripeClient = stripe;

  // compute unix timestamps for those windows
  const now = Math.floor(Date.now() / 1000);
  const startToday = Math.floor(new Date().setUTCHours(0, 0, 0, 0) / 1000);
  const startYest = startToday - 86400;
  const startMon = Math.floor(
    new Date(
      new Date().getUTCFullYear(),
      new Date().getUTCMonth(),
      1
    ).getTime() / 1000
  );
  const startYear = Math.floor(
    new Date(new Date().getUTCFullYear(), 0, 1).getTime() / 1000
  );

  // helper to page through charges and sum amounts
  async function sumWindow(gte, lt) {
    let sum = 0;
    let lastId = null;
    do {
      const params = { limit: 100, created: { gte, lt } };
      if (lastId) params.starting_after = lastId;
      const page = await stripeClient.charges.list(params);
      page.data.forEach((c) => {
        sum += c.amount;
      });
      lastId =
        page.data.length === 100 ? page.data[page.data.length - 1].id : null;
    } while (lastId);
    return Math.round(sum / 100); // convert cents → dollars
  }

  const yesterday = await sumWindow(startYest, startToday);
  const mtd = await sumWindow(startMon, now);
  const ytd = await sumWindow(startYear, now);

  res.json({ yesterday, mtd, ytd });
});

// simplest health‐check endpoint
// app.get("/", (req, res) => {
//   res.status(200).send("OK");
// });

// =====================
// Helper Functions
// =====================
const sanitizeData = (data) => {
  const sanitized = {};
  for (const key in data) {
    if (data.hasOwnProperty(key)) {
      sanitized[key] =
        typeof data[key] === "string" ? data[key].trim() : data[key];
    }
  }
  return sanitized;
};

const calculateTotalCost = (packageType) => {
  const packagePrices = {
    Basic: 2500,
    Featured: 7000,
    Enhanced: 15000,
    "Charter Services": 50000,
  };
  return packagePrices[packageType] || 2500;
};

const sendNotification = async (tokens, title, body, data = {}) => {
  const payload = {
    notification: { title, body },
    data,
  };
  try {
    const response = await admin.messaging().sendToDevice(tokens, payload);
    admin.logger.info("Notifications sent successfully:", response);
  } catch (error) {
    admin.logger.error("Error sending notifications:", error);
  }
};

// Replace your existing sendReportEmail with this:

const sendReportEmail = async ({ listingId, reporterId, reason, comments }) => {
  // Ensure transporter has been initialized
  await initTransporter();
  if (!transporter) {
    admin.logger.warn(
      "SMTP transporter not initialized – skipping report email."
    );
    return;
  }

  try {
    // grab your SMTP_USER secret for the “from” address
    const fromAddr = await SMTP_USER.value();

    await transporter.sendMail({
      from: `"RSF Alert" <${fromAddr}>`,
      to: moderatorEmail,
      subject: `⚑ Listing ${listingId} reported`,
      html: `
        <h2>Listing report received</h2>
        <p><strong>Listing ID:</strong> ${listingId}</p>
        <p><strong>Reporter UID:</strong> ${reporterId}</p>
        <p><strong>Reason:</strong> ${reason}</p>
        <p><strong>Comments:</strong> ${comments || "(none)"}</p>
      `,
    });

    admin.logger.info(`Report email for ${listingId} sent.`);
  } catch (err) {
    admin.logger.error("sendReportEmail error:", err);
  }
};

// ===================================================================
// Routes: Listings
// ===================================================================

// POST /createListing
app.post("/createListing", authenticate, async (req, res) => {
  try {
    admin.logger.info(`User ${req.user.uid} creating a listing`);
    const listingDetailsRaw = req.body.listingDetails;
    if (!listingDetailsRaw) {
      admin.logger.warn("Missing 'listingDetails' in request body");
      res.setHeader("Content-Type", "application/json");
      return res
        .status(400)
        .json({ error: "Missing 'listingDetails' in request body" });
    }
    let listingDetails;
    try {
      listingDetails =
        typeof listingDetailsRaw === "string"
          ? JSON.parse(listingDetailsRaw)
          : listingDetailsRaw;
      admin.logger.info(
        `Parsed listingDetails: ${JSON.stringify(listingDetails)}`
      );
    } catch (parseError) {
      admin.logger.error("Error parsing listingDetails:", parseError);
      res.setHeader("Content-Type", "application/json");
      return res
        .status(400)
        .json({ error: "Invalid JSON in 'listingDetails'" });
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
      airportIdentifier,
    } = sanitizeData(listingDetails);

    // Updated category requirements for Flight Schools, Flight Instructors, and Charter Services
    const categoryRequirements = {
      "Aircraft for Sale": ["title", "description", "airportIdentifier"],
      "Aviation Jobs": ["companyName", "jobTitle", "jobDescription"],
      "Flight Schools": ["flightSchoolDetails"],
      "Flight Instructors": [
        "firstName",
        "lastName",
        "certifications",
        "fiEmail",
        "fiDescription",
        "serviceLocationsList",
      ],
      "Aviation Mechanic": [
        "amFirstName",
        "amLastName",
        "amCertifications",
        "amEmail",
        "amDescription",
        "amServiceLocations",
      ],
      "Charter Services": ["charterServiceDetails"],
    };

    const requiredFields = categoryRequirements[category];
    if (!requiredFields) {
      admin.logger.warn(`Invalid category: ${category}`);
      res.setHeader("Content-Type", "application/json");
      return res.status(400).json({ error: `Invalid category: ${category}` });
    }

    let freeListing = isFreeListing === "true" || isFreeListing === true;
    if (selectedPricing === "FreeTrial") {
      freeListing = true;
    }
    // FORCE freeListing for Flight Schools since salePrice is not applicable.
    if (category === "Flight Schools" || category === "Aviation Jobs") {
      freeListing = true;
    }

    let finalRequiredFields = [...requiredFields];
    // For Aircraft for Sale, require salePrice and selectedPricing if not a free listing.
    if (category === "Aircraft for Sale" && !freeListing) {
      finalRequiredFields.push("salePrice", "selectedPricing");
    }
    const missingFields = finalRequiredFields.filter(
      (field) => !listingDetails[field]
    );
    if (missingFields.length > 0) {
      admin.logger.warn(`Missing required fields: ${missingFields.join(", ")}`);
      res.setHeader("Content-Type", "application/json");
      return res.status(400).json({
        error: `Missing required fields: ${missingFields.join(", ")}`,
      });
    }
    // For Flight Schools, ensure that flightSchoolDetails exists and has a non-empty flightSchoolEmail.
    if (category === "Flight Schools") {
      if (
        !listingDetails.flightSchoolDetails ||
        !listingDetails.flightSchoolDetails.flightSchoolEmail
      ) {
        res.setHeader("Content-Type", "application/json");
        return res.status(400).json({
          error:
            "Missing required field: flightSchoolDetails.flightSchoolEmail",
        });
      }
    }
    // NEW: For Charter Services, verify that charterServiceDetails exists with required keys.
    if (category === "Charter Services") {
      if (
        !listingDetails.charterServiceDetails ||
        !listingDetails.charterServiceDetails.charterServiceName ||
        !listingDetails.charterServiceDetails.charterServiceLocation ||
        !listingDetails.charterServiceDetails.charterServiceEmail
      ) {
        admin.logger.warn(
          `Missing required fields in charterServiceDetails for category Charter Services`
        );
        res.setHeader("Content-Type", "application/json");
        return res.status(400).json({
          error:
            "Missing required fields: charterServiceName, charterServiceLocation, charterServiceEmail",
        });
      }
    }
    let finalSalePrice = 0;
    let finalPackageCost = 0;
    // Only process salePrice if the category is NOT Flight Instructors and NOT Charter Services.
    if (category !== "Flight Instructors" && category !== "Charter Services") {
      if (freeListing) {
        finalSalePrice = 0;
        finalPackageCost = 0;
      } else {
        if (salePrice === undefined) {
          admin.logger.warn("Missing salePrice for category " + category);
          res.setHeader("Content-Type", "application/json");
          return res
            .status(400)
            .json({ error: "Missing salePrice for this category" });
        }
        let salePriceString =
          typeof salePrice === "string" ? salePrice : salePrice.toString();
        const sanitizedSalePrice = salePriceString.replace(/[^0-9.]/g, "");
        const parsedSalePrice = parseFloat(sanitizedSalePrice);
        if (isNaN(parsedSalePrice) || parsedSalePrice <= 0) {
          admin.logger.warn(`Invalid salePrice: ${salePrice}`);
          res.setHeader("Content-Type", "application/json");
          return res.status(400).json({
            error: "Invalid salePrice. It must be a positive number.",
          });
        }
        finalSalePrice = parsedSalePrice;
        finalPackageCost = calculateTotalCost(selectedPricing);
      }
    }
    const imageUrls = Array.isArray(images) ? images : [];
    const listingData = {
      title: title || "",
      tailNumber: tailNumber || "",
      salePrice: finalSalePrice,
      description: description || "",
      city: city || "",
      state: state || "",
      email: email || "",
      phone: phone || "",
      companyName: companyName || "",
      jobTitle: jobTitle || "",
      jobDescription: jobDescription || "",
      category: category || "",
      flightSchoolName: flightSchoolName || "",
      flightSchoolDetails: flightSchoolDetails || "",
      isFreeListing: freeListing,
      packageType: freeListing ? null : selectedPricing,
      packageCost: freeListing ? 0 : finalPackageCost,
      location: { lat: parseFloat(lat), lng: parseFloat(lng) },
      images: imageUrls,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      ownerId: req.user.uid,
      rentalStatus: "pending", // Use rentalStatus for rental requests
      airportIdentifier: airportIdentifier || "",
    };

    // For Flight Instructors, remove salePrice and add additional fields.
    if (category === "Flight Instructors") {
      listingData.firstName = listingDetails.firstName;
      listingData.lastName = listingDetails.lastName;
      listingData.certifications = listingDetails.certifications;
      listingData.fiEmail = listingDetails.fiEmail;
      listingData.fiDescription = listingDetails.fiDescription;
      listingData.serviceLocationsList = listingDetails.serviceLocationsList;
      listingData.hourlyRate = listingDetails.hourlyRate;
      listingData.aircraftProvided = listingDetails.aircraftProvided;
      listingData.profileImage = listingDetails.profileImage || "";
      delete listingData.salePrice;
    } else if (category === "Aviation Mechanic") {
      listingData.amFirstName = listingDetails.amFirstName;
      listingData.amLastName = listingDetails.amLastName;
      listingData.amCertifications = listingDetails.amCertifications;
      listingData.amEmail = listingDetails.amEmail;
      listingData.amDescription = listingDetails.amDescription;
      listingData.amServiceLocations = listingDetails.amServiceLocations;
    }
    // NEW: For Charter Services, add the charterServiceDetails field.
    if (category === "Charter Services") {
      listingData.charterServiceDetails =
        listingDetails.charterServiceDetails || {};
    }

    // if they chose Basic, we give them a 7-day trial; otherwise they pay up front
    // in your /createListing handler, after you build listingData:
    const days = TRIAL_DAYS[category] || 0;
    if (days > 0) {
      listingData.status = "trial";
      listingData.trialExpiry = admin.firestore.Timestamp.fromDate(
        new Date(Date.now() + days * 24 * 60 * 60 * 1000)
      );
    } else {
      listingData.status = "pending_payment";
      listingData.trialExpiry = null;
    }

    // then write listingData → Firestore

    listingData.expired = false;

    const listingRef = await db.collection("listings").add(listingData);
    res.setHeader("Content-Type", "application/json");
    res.status(201).json({ success: true, listingId: listingRef.id });
  } catch (error) {
    const errorMessage =
      error && error.message ? error.message : "Internal Server Error";
    admin.logger.error("Error in /createListing:", error);
    res.setHeader("Content-Type", "application/json");
    res.status(500).json({ error: errorMessage });
  }
});

// PUT /updateListing
app.put("/updateListing", authenticate, async (req, res) => {
  try {
    const { listingId, listingDetails } = req.body;
    admin.logger.info(`Updating listing ${listingId} by user ${req.user.uid}`);
    if (!listingId || !listingDetails) {
      res.setHeader("Content-Type", "application/json");
      return res
        .status(400)
        .json({ error: "Missing listingId or listingDetails" });
    }
    const listingRef = db.collection("listings").doc(listingId);
    const listingDoc = await listingRef.get();
    if (!listingDoc.exists) {
      res.setHeader("Content-Type", "application/json");
      return res.status(404).json({ error: "Listing not found" });
    }
    const listingData = listingDoc.data();
    if (listingData.ownerId !== req.user.uid) {
      res.setHeader("Content-Type", "application/json");
      return res.status(403).json({ error: "You do not own this listing" });
    }
    let parsedListingDetails =
      typeof listingDetails === "string"
        ? JSON.parse(listingDetails)
        : listingDetails;
    const sanitizedListingDetails = sanitizeData(parsedListingDetails);

    // Updated category requirements for Flight Schools, Flight Instructors, and Charter Services
    const categoryRequirements = {
      "Aircraft for Sale": ["title", "description", "airportIdentifier"],
      "Aviation Jobs": ["companyName", "jobTitle", "jobDescription"],
      "Flight Schools": ["flightSchoolDetails"],
      "Flight Instructors": [
        "firstName",
        "lastName",
        "certifications",
        "fiEmail",
        "fiDescription",
        "serviceLocationsList",
      ],
      "Aviation Mechanic": [
        "amFirstName",
        "amLastName",
        "amCertifications",
        "amEmail",
        "amDescription",
        "amServiceLocations",
      ],
      "Charter Services": ["charterServiceDetails"],
    };

    const reqCategoryRequirements =
      categoryRequirements[sanitizedListingDetails.category];
    if (!reqCategoryRequirements) {
      res.setHeader("Content-Type", "application/json");
      return res.status(400).json({
        error: `Invalid category: ${sanitizedListingDetails.category}`,
      });
    }

    let freeListing =
      sanitizedListingDetails.isFreeListing === "true" ||
      sanitizedListingDetails.isFreeListing === true;
    if (sanitizedListingDetails.selectedPricing === "FreeTrial") {
      freeListing = true;
    }
    // FORCE freeListing for Flight Schools during update.
    if (sanitizedListingDetails.category === "Flight Schools") {
      freeListing = true;
    }
    // FORCE freeListing for Aviation Jobs during update.
    if (sanitizedListingDetails.category === "Aviation Jobs") {
      freeListing = true;
    }

    let finalRequiredFields = [...reqCategoryRequirements];
    if (
      sanitizedListingDetails.category === "Aircraft for Sale" &&
      !freeListing
    ) {
      finalRequiredFields.push("salePrice", "selectedPricing");
    }
    const missingFields = finalRequiredFields.filter(
      (field) => !sanitizedListingDetails[field]
    );
    if (missingFields.length > 0) {
      res.setHeader("Content-Type", "application/json");
      return res.status(400).json({
        error: `Missing required fields: ${missingFields.join(", ")}`,
      });
    }
    // For Flight Schools, ensure that flightSchoolDetails exists and has a non-empty flightSchoolEmail.
    if (sanitizedListingDetails.category === "Flight Schools") {
      if (
        !sanitizedListingDetails.flightSchoolDetails ||
        !sanitizedListingDetails.flightSchoolDetails.flightSchoolEmail
      ) {
        res.setHeader("Content-Type", "application/json");
        return res.status(400).json({
          error:
            "Missing required field: flightSchoolDetails.flightSchoolEmail",
        });
      }
    }
    // NEW: For Charter Services, ensure that charterServiceDetails exists and contains the required keys.
    if (sanitizedListingDetails.category === "Charter Services") {
      if (
        !sanitizedListingDetails.charterServiceDetails ||
        !sanitizedListingDetails.charterServiceDetails.charterServiceName ||
        !sanitizedListingDetails.charterServiceDetails.charterServiceLocation ||
        !sanitizedListingDetails.charterServiceDetails.charterServiceEmail
      ) {
        res.setHeader("Content-Type", "application/json");
        return res.status(400).json({
          error:
            "Missing required fields: charterServiceName, charterServiceLocation, charterServiceEmail",
        });
      }
    }
    // Modified location check: Use incoming lat/lng if available; otherwise, fall back to existing listingData.location.
    let latitude, longitude;
    if (!sanitizedListingDetails.lat || !sanitizedListingDetails.lng) {
      if (
        listingData.location &&
        listingData.location.lat &&
        listingData.location.lng
      ) {
        latitude = parseFloat(listingData.location.lat);
        longitude = parseFloat(listingData.location.lng);
      } else {
        res.setHeader("Content-Type", "application/json");
        return res
          .status(400)
          .json({ error: "Missing location data (lat, lng)" });
      }
    } else {
      latitude = parseFloat(sanitizedListingDetails.lat);
      longitude = parseFloat(sanitizedListingDetails.lng);
    }
    if (isNaN(latitude) || isNaN(longitude)) {
      res.setHeader("Content-Type", "application/json");
      return res.status(400).json({
        error: "Invalid location data. 'lat' and 'lng' must be numbers.",
      });
    }

    let finalSalePrice = listingData.salePrice;
    let finalPackageCost = listingData.packageCost;
    let finalPackageType = listingData.packageType;
    if (freeListing) {
      finalSalePrice = 0;
      finalPackageCost = 0;
      finalPackageType = null;
    } else if (
      sanitizedListingDetails.category !== "Flight Instructors" &&
      sanitizedListingDetails.category !== "Charter Services"
    ) {
      if (
        sanitizedListingDetails.salePrice &&
        String(sanitizedListingDetails.salePrice).trim().toLowerCase() !== "n/a"
      ) {
        const salePriceString = String(
          sanitizedListingDetails.salePrice
        ).trim();
        const sanitizedSalePrice = salePriceString.replace(/[^0-9.]/g, "");
        const parsedSalePrice = parseFloat(sanitizedSalePrice);
        if (isNaN(parsedSalePrice) || parsedSalePrice <= 0) {
          res.setHeader("Content-Type", "application/json");
          return res.status(400).json({
            error: "Invalid salePrice. It must be a positive number.",
          });
        }
        finalSalePrice = parsedSalePrice;
      }
      if (sanitizedListingDetails.selectedPricing) {
        finalPackageCost = calculateTotalCost(
          sanitizedListingDetails.selectedPricing
        );
        finalPackageType = sanitizedListingDetails.selectedPricing;
      }
    }
    const imageUrls = Array.isArray(sanitizedListingDetails.images)
      ? sanitizedListingDetails.images
      : [];
    const updateData = {
      title: sanitizedListingDetails.title || listingData.title,
      tailNumber: sanitizedListingDetails.tailNumber || listingData.tailNumber,
      salePrice: finalSalePrice,
      description:
        sanitizedListingDetails.description || listingData.description,
      city: sanitizedListingDetails.city || listingData.city,
      state: sanitizedListingDetails.state || listingData.state,
      email: sanitizedListingDetails.email || listingData.email,
      phone: sanitizedListingDetails.phone || listingData.phone,
      companyName:
        sanitizedListingDetails.companyName || listingData.companyName,
      jobTitle: sanitizedListingDetails.jobTitle || listingData.jobTitle,
      jobDescription:
        sanitizedListingDetails.jobDescription || listingData.jobDescription,
      category: sanitizedListingDetails.category || listingData.category,
      flightSchoolName:
        sanitizedListingDetails.flightSchoolName ||
        listingData.flightSchoolName,
      flightSchoolDetails:
        sanitizedListingDetails.flightSchoolDetails ||
        listingData.flightSchoolDetails,
      isFreeListing: freeListing,
      packageType: freeListing ? null : finalPackageType,
      packageCost: freeListing ? 0 : finalPackageCost,
      location: { lat: latitude, lng: longitude },
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      airportIdentifier:
        sanitizedListingDetails.airportIdentifier ||
        listingData.airportIdentifier,
    };

    // For Flight Instructors, update using hourlyRate instead of salePrice and update profileImage.
    if (sanitizedListingDetails.category === "Flight Instructors") {
      updateData.firstName = sanitizedListingDetails.firstName;
      updateData.lastName = sanitizedListingDetails.lastName;
      updateData.certifications = sanitizedListingDetails.certifications;
      updateData.fiEmail = sanitizedListingDetails.fiEmail;
      updateData.fiDescription = sanitizedListingDetails.fiDescription;
      updateData.serviceLocationsList =
        sanitizedListingDetails.serviceLocationsList;
      updateData.hourlyRate = sanitizedListingDetails.hourlyRate;
      updateData.aircraftProvided = sanitizedListingDetails.aircraftProvided;
      updateData.profileImage = sanitizedListingDetails.profileImage;
      delete updateData.salePrice;
    } else if (sanitizedListingDetails.category === "Aviation Mechanic") {
      updateData.amFirstName = sanitizedListingDetails.amFirstName;
      updateData.amLastName = sanitizedListingDetails.amLastName;
      updateData.amCertifications = sanitizedListingDetails.amCertifications;
      updateData.amEmail = sanitizedListingDetails.amEmail;
      updateData.amDescription = sanitizedListingDetails.amDescription;
      updateData.amServiceLocations =
        sanitizedListingDetails.amServiceLocations;
    }
    // NEW: For Charter Services, update charterServiceDetails.
    if (sanitizedListingDetails.category === "Charter Services") {
      updateData.charterServiceDetails =
        sanitizedListingDetails.charterServiceDetails || {};
    }

    // If there are new images, update them
    if (imageUrls.length > 0) {
      updateData.images = imageUrls;
    }

    await listingRef.update(updateData);
    res.setHeader("Content-Type", "application/json");
    res.status(200).json({ success: true, listingId });
  } catch (error) {
    const errorMessage =
      error && error.message ? error.message : "Internal Server Error";
    admin.logger.error("Error in /updateListing:", error);
    res.setHeader("Content-Type", "application/json");
    res.status(500).json({ error: errorMessage });
  }
});

// DELETE /deleteListing
app.delete("/deleteListing", authenticate, async (req, res) => {
  try {
    const { listingId } = req.body;
    if (!listingId) {
      res.setHeader("Content-Type", "application/json");
      return res
        .status(400)
        .json({ error: "Missing listingId in request body" });
    }
    const listingRef = db.collection("listings").doc(listingId);
    const listingDoc = await listingRef.get();
    if (!listingDoc.exists) {
      res.setHeader("Content-Type", "application/json");
      return res.status(404).json({ error: "Listing not found" });
    }
    const listingData = listingDoc.data();
    if (listingData.ownerId !== req.user.uid) {
      res.setHeader("Content-Type", "application/json");
      return res.status(403).json({ error: "You do not own this listing" });
    }
    const imageUrls = listingData.images || [];
    const deletePromises = imageUrls.map(async (imageUrl) => {
      const filePathMatch = imageUrl.match(/\/o\/(.+?)\?/);
      if (filePathMatch && filePathMatch[1]) {
        const filePath = decodeURIComponent(filePathMatch[1]).replace(
          /%2F/g,
          "/"
        );
        try {
          await storageBucket.file(filePath).delete();
          admin.logger.info(`Deleted image at path: ${filePath}`);
        } catch (err) {
          admin.logger.error(`Failed to delete image ${filePath}:`, err);
        }
      } else {
        admin.logger.warn(
          `Unable to extract file path from image URL: ${imageUrl}`
        );
      }
    });
    await Promise.all(deletePromises);
    await listingRef.delete();
    res.setHeader("Content-Type", "application/json");
    res
      .status(200)
      .json({ success: true, message: "Listing deleted successfully" });
  } catch (error) {
    const errorMessage =
      error && error.message ? error.message : "Internal Server Error";
    admin.logger.error("Error in /deleteListing:", error);
    res.setHeader("Content-Type", "application/json");
    res.status(500).json({ error: errorMessage });
  }
});

// ── NEW: POST /continueListing ─────────────────────────────────────
// User pays to continue a listing after its free trial expires
app.post("/continueListing", authenticate, async (req, res) => {
  try {
    const { listingId, paymentMethodId } = req.body;
    if (!listingId || !paymentMethodId) {
      return res
        .status(400)
        .json({ error: "listingId and paymentMethodId are required" });
    }

    const listingRef = db.collection("listings").doc(listingId);
    const listingSnap = await listingRef.get();
    if (!listingSnap.exists) {
      return res.status(404).json({ error: "Listing not found" });
    }
    const listing = listingSnap.data();
    if (listing.ownerId !== req.user.uid) {
      return res.status(403).json({ error: "You do not own this listing" });
    }
    if (listing.status !== "trial_expired") {
      return res
        .status(400)
        .json({ error: "Listing is not in an expired trial state" });
    }

    // Calculate amount for a 30‐day extension based on category
    const pricing = {
      Basic: 2500,
      "Flight Schools": 25000,
      "Flight Instructors": 3000,
      "Aviation Mechanic": 3000,
      "Charter Services": 25000,
    };
    const amount = pricing[listing.category] || 2500;

    // Create a Stripe PaymentIntent
    const pi = await stripe.paymentIntents.create({
      amount,
      currency: "usd",
      payment_method: paymentMethodId,
      confirm: true,
      metadata: { listingId, ownerId: req.user.uid },
    });

    // On successful payment, flip it back to “active” and extend expiry 30 days
    if (pi.status === "succeeded") {
      const newExpiry = admin.firestore.Timestamp.fromDate(
        new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
      );
      await listingRef.update({
        status: "active",
        paymentStatus: "succeeded",
        trialExpiry: newExpiry,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      return res.json({ success: true, newExpiry });
    }

    return res.status(402).json({ error: "Payment failed" });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
});

app.delete("/deleteAccount", authenticate, async (req, res) => {
  const uid = req.user.uid;
  try {
    // 1) Delete subcollections (listings, rentalRequests, etc.)
    const batch = db.batch();
    // e.g. delete all of this user’s listings
    const listings = await db
      .collection("listings")
      .where("ownerId", "==", uid)
      .get();
    listings.forEach((doc) => batch.delete(doc.ref));
    // …repeat for rentalRequests, notifications, etc.
    await batch.commit();

    // 2) Delete Firestore user record
    await db.collection("users").doc(uid).delete();

    // 3) Delete the Auth user
    await admin.auth().deleteUser(uid);

    admin.logger.info(`User ${uid} and all related data deleted`);
    return res.status(200).json({ success: true, message: "Account deleted." });
  } catch (error) {
    admin.logger.error(`Error deleting account for UID ${uid}:`, error);
    return res
      .status(500)
      .json({ error: "Failed to delete account. Please try again later." });
  }
});

// -------------------------------------------------------------------
// POST /reportListing   ⟶  saves a report + emails the moderators
// -------------------------------------------------------------------
app.post("/reportListing", authenticate, async (req, res) => {
  try {
    const { listingId, reason, comments = "" } = req.body;

    // ─── basic validation ──────────────────────────────────────────
    if (!listingId || !reason) {
      return res
        .status(400)
        .json({ error: "listingId and reason are required" });
    }

    // make sure the listing still exists (optional but nice)
    const listingSnap = await db.collection("listings").doc(listingId).get();
    if (!listingSnap.exists) {
      return res.status(404).json({ error: "Listing not found" });
    }

    // ─── build and save the report doc ─────────────────────────────
    const report = {
      listingId,
      reporterId: req.user.uid,
      reason, // e.g. "Spam" | "Offensive content" | …
      comments, // free‑form text from the user
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    await db.collection("listingReports").add(report); // <-- THIS is the write you asked about

    // ─── ping the mods by email (helper added earlier) ─────────────
    sendReportEmail(report);

    return res.status(201).json({ success: true });
  } catch (err) {
    admin.logger.error("Error in /reportListing:", err);
    return res.status(500).json({ error: "Internal Server Error" });
  }
});

// ===================================================================
// Payment Endpoints
// ===================================================================

// /create-classified-payment-intent remains largely unchanged
app.post(
  "/create-classified-payment-intent",
  authenticate,
  async (req, res) => {
    try {
      const { amount, currency = "usd", listingId, listingDetails } = req.body;
      const finalListingId = listingId || (listingDetails && listingDetails.id);
      if (typeof amount !== "number" || finalListingId === "") {
        res.setHeader("Content-Type", "application/json");
        return res.status(400).json({ error: "Missing amount or listingId" });
      }
      const listingRef = db.collection("listings").doc(finalListingId);
      const listingDoc = await listingRef.get();
      if (!listingDoc.exists) {
        res.setHeader("Content-Type", "application/json");
        return res.status(404).json({ error: "Listing not found" });
      }
      const listingData = listingDoc.data();
      if (amount === 0) {
        await listingRef.update({
          status: "trial",
          paymentStatus: "free",
          trialExpiry: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        res.setHeader("Content-Type", "application/json");
        return res.status(200).json({ clientSecret: null, freeListing: true });
      }
      const paymentIntent = await stripe.paymentIntents.create({
        amount,
        currency,
        receipt_email: req.user.email, // Added to send receipt email
        metadata: {
          listingId: finalListingId,
          ownerId: listingData.ownerId,
        },
      });
      res.setHeader("Content-Type", "application/json");
      res.status(200).json({ clientSecret: paymentIntent.client_secret });
    } catch (error) {
      const errorMessage = error.message || "Internal Server Error";
      admin.logger.error("Error in /create-classified-payment-intent:", error);
      res.setHeader("Content-Type", "application/json");
      res.status(500).json({ error: errorMessage });
    }
  }
);

// Rental payment intent endpoint updated to use destination charges
app.post("/create-rental-payment-intent", authenticate, async (req, res) => {
  try {
    const {
      rentalRequestId,
      ownerId,
      amount: clientAmount,
      renterId,
    } = req.body;
    if (!rentalRequestId || !ownerId) {
      res.setHeader("Content-Type", "application/json");
      return res
        .status(400)
        .json({ error: "Missing rentalRequestId or ownerId" });
    }
    const parsedAmount = Number(clientAmount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      res.setHeader("Content-Type", "application/json");
      return res
        .status(400)
        .json({ error: "Invalid payment amount provided." });
    }
    const amount = parsedAmount;
    const rentalRequestRef = db
      .collection("rentalRequests")
      .doc(rentalRequestId);
    const rentalRequestDoc = await rentalRequestRef.get();
    if (!rentalRequestDoc.exists) {
      res.setHeader("Content-Type", "application/json");
      return res.status(404).json({ error: "Rental request not found" });
    }
    const rentalRequest = rentalRequestDoc.data();
    if (rentalRequest.renterId !== req.user.uid) {
      res.setHeader("Content-Type", "application/json");
      return res
        .status(403)
        .json({ error: "Unauthorized to pay for this rental request" });
    }
    await rentalRequestRef.update({ totalAmount: amount });

    // Fetch the owner's connected account ID from Firestore
    const ownerDoc = await db.collection("owners").doc(ownerId).get();
    if (!ownerDoc.exists) {
      res.setHeader("Content-Type", "application/json");
      return res.status(404).json({ error: "Owner not found" });
    }
    const ownerData = ownerDoc.data();
    const connectedAccountId = ownerData.stripeAccountId;
    if (!connectedAccountId) {
      res.setHeader("Content-Type", "application/json");
      return res
        .status(400)
        .json({ error: "Owner does not have a connected Stripe account" });
    }

    // Create a PaymentIntent using destination charges.
    const platformFeePercentage = 0.2325; // 23.25% of base fee
    const totalMultiplier = 1.1725; // Total = base fee + fees
    const applicationFee = Math.round(
      amount * (platformFeePercentage / totalMultiplier)
    );

    const paymentIntent = await stripe.paymentIntents.create({
      amount,
      currency: "usd",
      payment_method_types: ["card"],
      transfer_data: {
        destination: connectedAccountId,
      },
      application_fee_amount: applicationFee,
      receipt_email: req.user.email, // Added to send receipt email
      metadata: { rentalRequestId, ownerId, renterId: req.user.uid },
    });
    res.setHeader("Content-Type", "application/json");
    res.status(200).json({ clientSecret: paymentIntent.client_secret });
  } catch (error) {
    const errorMessage = error.message || "Internal Server Error";
    admin.logger.error("Error in /create-rental-payment-intent:", error);
    res.setHeader("Content-Type", "application/json");
    res.status(500).json({ error: errorMessage });
  }
});

// Validate discount code endpoint
app.post("/validateDiscount", authenticate, async (req, res) => {
  try {
    const { discountCode, amount } = req.body;
    if (
      !discountCode ||
      typeof amount !== "number" ||
      (amount <= 0 && discountCode.toUpperCase() !== "RSF2005")
    ) {
      res.setHeader("Content-Type", "application/json");
      return res
        .status(400)
        .json({ valid: false, message: "Invalid request parameters" });
    }
    const discountCodes = {
      RSF2005: {
        type: "free",
        value: 0,
        message:
          "Free 2 week listing activated! Your listing will auto renew and you will be charged for renewal after 2 weeks.",
      },
    };
    const discount = discountCodes[discountCode.toUpperCase()];
    if (!discount) {
      res.setHeader("Content-Type", "application/json");
      return res
        .status(200)
        .json({ valid: false, message: "Invalid discount code." });
    }
    let adjustedAmount = amount;
    let pricingTier = "Basic";
    if (discount.type === "free") {
      adjustedAmount = 0;
      pricingTier = "FreeTrial";
    } else if (discount.type === "percentage") {
      adjustedAmount = Math.round(amount * (1 - discount.value / 100));
      pricingTier = "Featured";
    } else if (discount.type === "fixed") {
      adjustedAmount = amount - discount.value;
      if (adjustedAmount < 0) adjustedAmount = 0;
      pricingTier = "Enhanced";
    }
    res.setHeader("Content-Type", "application/json");
    res.status(200).json({
      valid: true,
      adjustedAmount,
      pricingTier,
      message: discount.message,
    });
  } catch (error) {
    const errorMessage = error.message || "Internal Server Error";
    admin.logger.error("Error in /validateDiscount:", error);
    res.setHeader("Content-Type", "application/json");
    res.status(500).json({ valid: false, message: errorMessage });
  }
});

// ===================================================================
// Stripe & Bank Account Endpoints
// ===================================================================
app.post("/attach-bank-account", authenticate, async (req, res) => {
  try {
    const { ownerId, token, bankName } = req.body;
    if (!ownerId || !token || !bankName) {
      res.setHeader("Content-Type", "application/json");
      return res
        .status(400)
        .json({ error: "Missing required fields: ownerId, token, bankName" });
    }
    const ownerRef = db.collection("users").doc(ownerId);
    const ownerDoc = await ownerRef.get();
    if (!ownerDoc.exists) {
      res.setHeader("Content-Type", "application/json");
      return res.status(404).json({ error: "Owner not found" });
    }
    const ownerData = ownerDoc.data();
    const connectedAccountId = ownerData.stripeAccountId;
    if (!connectedAccountId) {
      res.setHeader("Content-Type", "application/json");
      return res.status(400).json({ error: "Stripe account not connected" });
    }
    const bankAccount = await stripe.accounts.createExternalAccount(
      connectedAccountId,
      { external_account: token }
    );
    await db
      .collection("users")
      .doc(ownerId)
      .update({ bankAccountId: bankAccount.id, bankName });
    res.setHeader("Content-Type", "application/json");
    res
      .status(200)
      .json({ message: "Bank account attached successfully", bankAccount });
  } catch (error) {
    const errorMessage = error.message || "Internal Server Error";
    admin.logger.error("Error attaching bank account:", error);
    res.setHeader("Content-Type", "application/json");
    res.status(500).json({ error: errorMessage });
  }
});

app.post("/create-connected-account", authenticate, async (req, res) => {
  try {
    const { ownerId, email, fullName } = req.body;
    if (!ownerId || !email || !fullName) {
      res.setHeader("Content-Type", "application/json");
      return res
        .status(400)
        .json({ error: "Missing required fields: ownerId, email, fullName" });
    }
    const account = await stripe.accounts.create({
      type: "custom",
      country: "US",
      email,
      business_type: "individual",
      individual: {
        first_name: fullName.split(" ")[0],
        last_name: fullName.split(" ").slice(1).join(" ") || "",
      },
      capabilities: {
        transfers: { requested: true },
        card_payments: { requested: true },
      },
    });
    await db
      .collection("users")
      .doc(ownerId)
      .set({ stripeAccountId: account.id }, { merge: true });
    const accountLink = await stripe.accountLinks.create({
      account: account.id,
      refresh_url: "https://ready-set-fly-71506.web.app/reauth", // Replace with your URL
      return_url: "https://ready-set-fly-71506.firebaseapp.com/return", // Replace with your URL
      type: "account_onboarding",
    });
    res.setHeader("Content-Type", "application/json");
    res.status(200).json({
      message: "Connected account created",
      accountLinkUrl: accountLink.url,
    });
  } catch (error) {
    const errorMessage = error.message || "Internal Server Error";
    admin.logger.error("Error creating connected account:", error);
    res.setHeader("Content-Type", "application/json");
    res.status(500).json({ error: errorMessage });
  }
});

// NEW: Retrieve Existing Connected Account Endpoint
app.post("/retrieve-connected-account", authenticate, async (req, res) => {
  try {
    const { ownerId, email, fullName } = req.body;
    if (!ownerId || !email || !fullName) {
      res.setHeader("Content-Type", "application/json");
      return res
        .status(400)
        .json({ error: "Missing required fields: ownerId, email, fullName" });
    }
    const ownerDoc = await db.collection("users").doc(ownerId).get();
    if (!ownerDoc.exists) {
      res.setHeader("Content-Type", "application/json");
      return res.status(404).json({ error: "Owner not found" });
    }
    const ownerData = ownerDoc.data();
    const stripeAccountId = ownerData.stripeAccountId;
    if (!stripeAccountId) {
      res.setHeader("Content-Type", "application/json");
      return res
        .status(400)
        .json({ error: "No connected Stripe account found" });
    }
    // Optionally, retrieve additional details from Stripe
    const account = await stripe.accounts.retrieve(stripeAccountId);
    res.setHeader("Content-Type", "application/json");
    res.status(200).json({ stripeAccountId: account.id, account });
  } catch (error) {
    const errorMessage = error.message || "Internal Server Error";
    admin.logger.error("Error retrieving connected account:", error);
    res.setHeader("Content-Type", "application/json");
    res.status(500).json({ error: errorMessage });
  }
});

// ===================================================================
// Drop-in replacement for the existing /get-stripe-balance endpoint.
// Keeps availableAmount and pendingAmount logic, replaces YTD calculation
// with a Firestore sum over your payments subcollection.

app.get("/get-stripe-balance", authenticate, async (req, res) => {
  try {
    // 1) Load the owner’s Firestore record
    const ownerSnapshot = await db.collection("users").doc(req.user.uid).get();
    if (!ownerSnapshot.exists) {
      return res.status(404).json({ error: "Owner not found" });
    }
    const { stripeAccountId: accountId } = ownerSnapshot.data();
    if (!accountId) {
      return res.status(400).json({ error: "Stripe account not connected" });
    }

    // 2) Retrieve the connected account’s current balance from Stripe
    const balance = await stripe.balance.retrieve(
      {},
      { stripeAccount: accountId }
    );

    // Sum up the “available” balance
    let availableAmount = 0;
    for (const a of balance.available || []) {
      availableAmount += a.amount;
    }

    // Sum up the “pending” balance
    let pendingAmount = 0;
    for (const p of balance.pending || []) {
      pendingAmount += p.amount;
    }

    // ——————————————————————————————
    // 3) Year-to-Date gross volume: sum all payments recorded in Firestore
    // ——————————————————————————————
    const startOfYear = admin.firestore.Timestamp.fromDate(
      new Date(new Date().getFullYear(), 0, 1)
    );
    const paymentsSnap = await db
      .collection("users")
      .doc(req.user.uid)
      .collection("payments")
      .where("createdAt", ">=", startOfYear)
      .get();

    let ytdAmount = 0;
    paymentsSnap.forEach((doc) => {
      const { netAmount } = doc.data();
      if (typeof netAmount === "number") {
        ytdAmount += netAmount;
      }
    });

    // 4) Send back all three figures (in cents)
    return res.status(200).json({
      availableAmount,
      pendingAmount,
      ytdAmount,
    });
  } catch (err) {
    console.error("Error in /get-stripe-balance:", err);
    if (
      err.type === "StripeInvalidRequestError" &&
      err.message.includes("does not have access")
    ) {
      return res
        .status(400)
        .json({ error: "Connected account not linked to this platform." });
    }
    return res
      .status(500)
      .json({ error: err.message || "Internal Server Error" });
  }
});

// ===================================================================
// Firestore-Triggered Functions
// ===================================================================

exports.emailOnListingReported = onDocumentCreated(
  "listingReports/{reportId}",
  async (snap, ctx) => {
    const data = snap.data();
    await sendReportEmail(data); // reuse the same helper
    return null;
  }
);

exports.onMessageSent = onDocumentCreated(
  "messages/{messageId}",
  async (snapshot, context) => {
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
        // single lookup in `users` instead of separate owners/renters
        const userRef = db.collection("users").doc(recipientId);
        const userDoc = await userRef.get();
        if (userDoc.exists) {
          const userData = userDoc.data();
          // adjust to whichever field you store the push token under
          const pushToken = userData.expoPushToken || userData.fcmToken;
          if (pushToken) tokens.push(pushToken);
        }
      }

      if (tokens.length === 0) {
        admin.logger.warn("No push tokens found for recipients.");
        return null;
      }

      const payload = {
        notification: {
          title: "New Message",
          body: text.length > 50 ? `${text.substring(0, 47)}…` : text,
          click_action: "FLUTTER_NOTIFICATION_CLICK",
        },
        data: { chatThreadId, senderId },
      };

      const response = await admin.messaging().sendToDevice(tokens, payload);
      admin.logger.info("Notifications sent:", response);
    } catch (error) {
      admin.logger.error("Error sending notifications:", error);
    }

    return null;
  }
);

exports.onNewRentalRequest = onDocumentCreated(
  "rentalRequests/{requestId}",
  async (snap, ctx) => {
    const data = snap.data();
    const ownerId = data.ownerId;
    if (!ownerId) return null;

    await db
      .collection("owners")
      .doc(ownerId)
      .collection("notifications")
      .add({
        rentalRequestId: ctx.params.requestId,
        message: `${data.fullName || "Someone"} just requested your listing.`,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    return null;
  }
);

exports.onRentalRequestStatusChange = onDocumentUpdated(
  "rentalRequests/{requestId}",
  async (snap, ctx) => {
    const before = snap.before.data();
    const after = snap.after.data();
    const renterId = after.renterId;
    if (!renterId) return null;

    // only fire when status flips into “approved” or “denied”
    if (
      before.rentalStatus !== after.rentalStatus &&
      ["approved", "denied"].includes(after.rentalStatus)
    ) {
      const msg =
        after.rentalStatus === "approved"
          ? "Your rental request was approved! Tap to pay now."
          : "Sorry, your rental request was denied.";
      await db
        .collection("renters")
        .doc(renterId)
        .collection("notifications")
        .add({
          rentalRequestId: ctx.params.requestId,
          message: msg,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });
    }
    return null;
  }
);

exports.onListingDeleted = onDocumentDeleted(
  "listings/{listingId}",
  async (snapshot, context) => {
    const { listingId } = context.params;
    const deletedData = snapshot.data();
    try {
      let totalDeletions = 0;
      const rentalRequestsRef = db
        .collectionGroup("rentalRequests")
        .where("listingId", "==", listingId);
      const rentalRequestsSnapshot = await rentalRequestsRef.get();
      admin.logger.info(
        `Found ${rentalRequestsSnapshot.size} rental requests for listing ${listingId}.`
      );
      const rentalBatch = db.batch();
      rentalRequestsSnapshot.forEach((docSnap) => {
        rentalBatch.delete(docSnap.ref);
        totalDeletions++;
      });
      await rentalBatch.commit();
      admin.logger.info(
        `Deleted ${totalDeletions} associated rental requests for listing ${listingId}.`
      );

      const imageUrls = deletedData.images || [];
      const deletePromises = imageUrls.map(async (imageUrl) => {
        const filePathMatch = imageUrl.match(/\/o\/(.+?)\?/);
        if (filePathMatch && filePathMatch[1]) {
          const filePath = decodeURIComponent(filePathMatch[1]).replace(
            /%2F/g,
            "/"
          );
          try {
            await storageBucket.file(filePath).delete();
            admin.logger.info(`Deleted image at: ${filePath}`);
          } catch (err) {
            admin.logger.error(`Could not delete image ${filePath}:`, err);
          }
        } else {
          admin.logger.warn(`Could not extract file path from ${imageUrl}`);
        }
      });
      await Promise.all(deletePromises);
    } catch (error) {
      admin.logger.error(
        `Error deleting data for listing ${listingId}:`,
        error
      );
    }
    return null;
  }
);

exports.handleAircraftDetails = onDocumentCreated(
  "aircraftDetails/{ownerId}",
  async (snapshot, context) => {
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
      await db
        .collection("aircraftDetails")
        .doc(ownerId)
        .set(updatedData, { merge: true });
      admin.logger.info(`Initialized aircraftDetails for ownerId: ${ownerId}`);
    } catch (error) {
      admin.logger.error(
        `Error initializing aircraftDetails for ownerId ${ownerId}:`,
        error
      );
    }
    return null;
  }
);

exports.handleAircraftDetailsUpdate = onDocumentUpdated(
  "aircraftDetails/{ownerId}",
  async (snapshot, context) => {
    const ownerId = context.params.ownerId;
    const beforeData = snapshot.before.data();
    const afterData = snapshot.after.data();
    admin.logger.info(`AircraftDetails updated for ownerId: ${ownerId}`);

    if (
      JSON.stringify(beforeData.profileData) !==
      JSON.stringify(afterData.profileData)
    ) {
      admin.logger.info(`Profile data updated for ownerId: ${ownerId}`);
      if (
        beforeData.profileData.displayName !== afterData.profileData.displayName
      ) {
        try {
          const fcmToken = afterData.profileData.fcmToken;
          if (fcmToken) {
            await sendNotification(
              [fcmToken],
              "Profile Updated",
              "Your profile has been updated."
            );
          }
        } catch (error) {
          admin.logger.error(
            `Error sending profile update notification for ownerId ${ownerId}:`,
            error
          );
        }
      }
    }

    if (
      JSON.stringify(beforeData.aircraftDetails) !==
      JSON.stringify(afterData.aircraftDetails)
    ) {
      admin.logger.info(`Aircraft details updated for ownerId: ${ownerId}`);
    }

    if (
      JSON.stringify(beforeData.costData) !== JSON.stringify(afterData.costData)
    ) {
      admin.logger.info(`Cost data updated for ownerId: ${ownerId}`);
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
          ? (principal * monthlyInterestRate) /
            (1 - Math.pow(1 + monthlyInterestRate, -numberOfPayments))
          : 0;
        const depreciationExpense =
          (parseFloat(purchasePrice) * parseFloat(depreciationRate)) / 100;
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
          (totalCostPerYear / parseFloat(rentalHoursPerYear)).toFixed(2)
        );
        try {
          await db
            .collection("aircraftDetails")
            .doc(ownerId)
            .update({
              "costData.mortgageExpense": parseFloat(mortgageExpense),
              "costData.depreciationExpense": parseFloat(depreciationExpense),
              "costData.costPerHour": costPerHour,
            });
          admin.logger.info(`Updated costPerHour for ownerId: ${ownerId}`);
        } catch (error) {
          admin.logger.error(
            `Error updating costPerHour for ownerId ${ownerId}:`,
            error
          );
        }
      }
    }

    if (
      JSON.stringify(beforeData.selectedAircraftIds) !==
      JSON.stringify(afterData.selectedAircraftIds)
    ) {
      admin.logger.info(
        `Selected aircraft IDs updated for ownerId: ${ownerId}`
      );
      const selectedIds = afterData.selectedAircraftIds || [];
      const additionalAircrafts = afterData.additionalAircrafts || [];
      const validAircraftIds = [
        ownerId,
        ...additionalAircrafts.map((ac) => ac.id),
      ];
      const invalidSelectedIds = selectedIds.filter(
        (id) => !validAircraftIds.includes(id)
      );
      if (invalidSelectedIds.length > 0) {
        const updatedSelectedIds = selectedIds.filter((id) =>
          validAircraftIds.includes(id)
        );
        try {
          await db
            .collection("aircraftDetails")
            .doc(ownerId)
            .update({ selectedAircraftIds: updatedSelectedIds });
          admin.logger.info(
            `Removed invalid selectedAircraftIds for ownerId: ${ownerId}`
          );
        } catch (error) {
          admin.logger.error(
            `Error removing invalid selectedAircraftIds for ownerId: ${ownerId}:`,
            error
          );
        }
      }
    }
    return null;
  }
);

exports.scheduledCleanupOrphanedRentalRequests = onSchedule(
  "every 24 hours",
  async (event) => {
    try {
      let totalDeletions = 0;
      const ownersSnapshot = await db.collection("owners").get();
      admin.logger.info(`Fetched ${ownersSnapshot.size} owners for cleanup.`);
      for (const ownerDoc of ownersSnapshot.docs) {
        const ownerId = ownerDoc.id;
        const rentalRequestsRef = db
          .collection("owners")
          .doc(ownerId)
          .collection("rentalRequests");
        const rentalRequestsSnapshot = await rentalRequestsRef.get();
        const rentalBatch = db.batch();
        for (const requestDoc of rentalRequestsSnapshot.docs) {
          const requestData = requestDoc.data();
          const createdAt = requestData.createdAt;
          const thirtyDaysAgo = admin.firestore.Timestamp.fromDate(
            new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
          );
          // Check rentalStatus instead of status
          if (
            createdAt &&
            createdAt.toDate() < thirtyDaysAgo.toDate() &&
            requestData.rentalStatus !== "active"
          ) {
            rentalBatch.delete(requestDoc.ref);
            totalDeletions++;
          }
        }
        if (totalDeletions > 0) {
          await rentalBatch.commit();
          admin.logger.info(
            `Deleted ${totalDeletions} orphaned rental requests for owner ${ownerId}.`
          );
        }
      }
      admin.logger.info(
        `Scheduled cleanup complete. Total deletions: ${totalDeletions}`
      );
      return null;
    } catch (error) {
      admin.logger.error("Scheduled cleanup error:", error);
      throw new Error("Cleanup failed.");
    }
  }
);

exports.closeExpiredMessaging = onSchedule("every 1 hours", async (event) => {
  try {
    const now = new Date();
    const rentalRequestsSnapshot = await db.collection("rentalRequests").get();
    let batch = db.batch();
    let updateCount = 0;
    rentalRequestsSnapshot.forEach((docSnap) => {
      const data = docSnap.data();
      if (data.rentalDate && !data.messagingClosed) {
        const rentalDate = new Date(data.rentalDate);
        if (rentalDate < now) {
          batch.update(docSnap.ref, {
            messagingClosed: true,
            rentalStatus: "completed",
          });
          updateCount++;
        }
      }
    });
    if (updateCount > 0) {
      await batch.commit();
      admin.logger.info(`Closed messaging for ${updateCount} rental requests.`);
    } else {
      admin.logger.info("No rental requests required messaging closure.");
    }
    return null;
  } catch (error) {
    admin.logger.error("Error in closeExpiredMessaging:", error);
    throw new Error("closeExpiredMessaging failed");
  }
});

exports.refreshListings = onSchedule("every 1 hours", async (event) => {
  try {
    const nowMillis = Date.now();
    const listingsQuery = db
      .collection("listings")
      .where("packageType", "in", ["Enhanced", "Featured"])
      .orderBy("createdAt", "desc");
    const listingsSnapshot = await listingsQuery.get();
    if (listingsSnapshot.empty) {
      admin.logger.info("No Enhanced or Featured listings found for refresh.");
      return null;
    }
    const listings = [];
    listingsSnapshot.forEach((doc) => {
      const data = doc.data();
      data.id = doc.id;
      listings.push(data);
    });
    const randomBetween = (min, max) => {
      return Math.floor(Math.random() * (max - min + 1)) + min;
    };

    for (const listing of listings) {
      let refreshInterval = 0;
      if (listing.packageType === "Enhanced") {
        refreshInterval = 24 * 3600 * 1000;
      } else if (listing.packageType === "Featured") {
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
        if (listing.packageType === "Enhanced") {
          if (listings.length >= 30) {
            const listing30 = listings[29];
            const index30Millis =
              listing30.createdAt && listing30.createdAt.toMillis
                ? listing30.createdAt.toMillis()
                : listing30.createdAt;
            newCreatedAtMillis = randomBetween(index30Millis, nowMillis);
          }
        } else if (listing.packageType === "Featured") {
          let topBound = nowMillis;
          let bottomBound = nowMillis - 3600 * 1000;
          if (listings.length >= 15) {
            const listing15 = listings[14];
            topBound =
              listing15.createdAt && listing15.createdAt.toMillis
                ? listing15.createdAt.toMillis()
                : listing15.createdAt;
          }
          if (listings.length >= 50) {
            const listing50 = listings[49];
            bottomBound =
              listing50.createdAt && listing50.createdAt.toMillis
                ? listing50.createdAt.toMillis()
                : listing50.createdAt;
          }
          newCreatedAtMillis = randomBetween(bottomBound, topBound);
        }
        const newNextRefreshAtMillis = nowMillis + refreshInterval;
        await db
          .collection("listings")
          .doc(listing.id)
          .update({
            createdAt: admin.firestore.Timestamp.fromMillis(newCreatedAtMillis),
            lastRefreshAt:
              admin.firestore.Timestamp.fromMillis(newCreatedAtMillis),
            nextRefreshAt: admin.firestore.Timestamp.fromMillis(
              newNextRefreshAtMillis
            ),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          });
        admin.logger.info(
          `Listing ${listing.id} refreshed. New createdAt: ${newCreatedAtMillis}`
        );
      }
    }
    return null;
  } catch (error) {
    admin.logger.error("Error in refreshListings scheduled function:", error);
    throw new Error("refreshListings failed");
  }
});

/**
 * Every hour, find all Aircraft-for-Sale listings whose
 * createdAt + package duration (30/60/90 days) is in the past,
 * and mark them expired.
 */
exports.expireAircraftListings = onSchedule("every 1 hours", async () => {
  const nowMillis = Date.now();
  const batch = db.batch();

  // map package name → days
  const pkgDays = { Basic: 30, Featured: 60, Enhanced: 90 };
  for (const [pkg, days] of Object.entries(pkgDays)) {
    // compute cutoff timestamp
    const cutoff = admin.firestore.Timestamp.fromMillis(
      nowMillis - days * 24 * 60 * 60 * 1000
    );

    const snap = await db
      .collection("listings")
      .where("category", "==", "Aircraft for Sale")
      .where("packageType", "==", pkg)
      .where("createdAt", "<=", cutoff)
      .where("expired", "==", false) // only those not yet expired
      .get();

    snap.forEach((doc) => {
      batch.update(doc.ref, {
        expired: true,
        status: "expired", // optional, if you have a status field
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    });
  }

  if (!batch._ops.length) return null; // nothing to do
  await batch.commit();
  admin.logger.info("expireAircraftListings: committed expiry batch");
  return null;
});

// ===================================================================
// Error-Handling Middleware
// ===================================================================
app.use((err, req, res, next) => {
  admin.logger.error("Unhandled error:", err);
  if (!res.headersSent) {
    res.setHeader("Content-Type", "application/json");
    res.status(500).json({ error: "Internal Server Error" });
  } else {
    next(err);
  }
});

// ───────────────────────────────────────────────────
// Admin: Search App Users by name or UID
// ───────────────────────────────────────────────────
app.get("/api/users/search", authenticate, async (req, res) => {
  const q = (req.query.q || "").trim();
  if (!q) return res.status(400).json({ error: "Missing query" });
  try {
    const usersRef = db.collection("users");
    const results = [];

    // 1) Try exact UID lookup
    const byId = await usersRef.doc(q).get();
    if (byId.exists) {
      results.push({ uid: byId.id, ...byId.data() });
    }

    // 2) Firestore doesn't support OR in one query, so do two name queries
    const nameQ = usersRef
      .orderBy("firstName")
      .startAt(q)
      .endAt(q + "\uf8ff")
      .limit(10);
    const lastQ = usersRef
      .orderBy("lastName")
      .startAt(q)
      .endAt(q + "\uf8ff")
      .limit(10);

    const [snap1, snap2] = await Promise.all([nameQ.get(), lastQ.get()]);
    snap1.forEach((doc) => {
      if (!results.find((u) => u.uid === doc.id))
        results.push({ uid: doc.id, ...doc.data() });
    });
    snap2.forEach((doc) => {
      if (!results.find((u) => u.uid === doc.id))
        results.push({ uid: doc.id, ...doc.data() });
    });

    res.json({ users: results.slice(0, 10) });
  } catch (err) {
    console.error("Error in /api/users/search:", err);
    res.status(500).json({ error: err.message });
  }
});

// ───────────────────────────────────────────────────
// Admin: Fetch all current listings for a given user
// ───────────────────────────────────────────────────
app.get("/api/users/:uid/listings", authenticate, async (req, res) => {
  const { uid } = req.params;
  try {
    // Optionally, you could verify the user exists first
    const listingsSnap = await db
      .collection("listings")
      .where("ownerId", "==", uid)
      .where("expired", "==", false) // only active/current
      .orderBy("createdAt", "desc")
      .get();

    const listings = listingsSnap.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    res.json({ listings });
  } catch (err) {
    console.error(`Error in /api/users/${uid}/listings:`, err);
    res.status(500).json({ error: err.message });
  }
});

// Handle undefined routes
app.use((req, res, next) => {
  res.setHeader("Content-Type", "application/json");
  res.status(404).json({ error: "Route not found" });
});

// =====================
// Export Express App as Firebase Function with Memory and Timeout Config
// =====================
exports.api = onRequest(
  {
    memory: "512Mi",
    timeoutSeconds: 120,
    secrets: [
      SMTP_HOST,
      SMTP_PORT,
      SMTP_USER,
      SMTP_PASS,
      STRIPE_SECRET_KEY,
      STRIPE_WEBHOOK_SECRET,
      MODERATOR_EMAIL_SECRET,
    ],
  },
  app
);

exports.expireTrials = onSchedule("every 1 hours", async () => {
  const now = admin.firestore.Timestamp.now();
  const snap = await db
    .collection("listings")
    .where("status", "==", "trial")
    .where("trialExpiry", "<=", now)
    .get();

  const batch = db.batch();
  snap.forEach((doc) => batch.update(doc.ref, { status: "trial_expired" }));
  await batch.commit();
});

// For local testing, you can uncomment the following lines:
// const PORT = process.env.PORT || 3000;
// app.listen(PORT, () => {
//   console.log(`Server is running on port ${PORT}`);
// });
exports.cleanupApprovalNotificationsOnActiveRental = onDocumentUpdated(
  "rentalRequests/{rentalRequestId}",
  async (snapshot, context) => {
    const beforeData = snapshot.before.data();
    const afterData = snapshot.after.data();

    // If the rentalStatus changes to "active" (and wasn't already active)
    if (
      beforeData.rentalStatus !== "active" &&
      afterData.rentalStatus === "active"
    ) {
      const rentalRequestId = context.params.rentalRequestId;
      const renterId = afterData.renterId;
      if (!renterId) {
        admin.logger.warn(
          `No renterId found for rentalRequestId: ${rentalRequestId}`
        );
        return null;
      }
      // Query the renter's notifications that correspond to this rentalRequestId
      const notificationsRef = db
        .collection("renters")
        .doc(renterId)
        .collection("notifications");
      const notifSnapshot = await notificationsRef
        .where("rentalRequestId", "==", rentalRequestId)
        .get();

      if (notifSnapshot.empty) {
        admin.logger.info(
          `No notifications found for rentalRequestId: ${rentalRequestId}`
        );
        return null;
      }

      const batch = db.batch();
      notifSnapshot.forEach((docSnap) => {
        batch.delete(docSnap.ref);
      });

      await batch.commit();
      admin.logger.info(
        `Cleaned up approval notifications for rentalRequestId: ${rentalRequestId}`
      );
    }

    return null;
  }
);
