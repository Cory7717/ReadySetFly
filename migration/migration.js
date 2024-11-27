// migration.js

// Import necessary modules
const path = require('path');
const fs = require('fs');
const admin = require('firebase-admin');
const stripePackage = require('stripe');
const nodemailer = require('nodemailer');

// Load environment variables from the .env file located in the root directory
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

// ====================
// Debugging: Verify Environment Variables
// ====================

console.log('🔑 STRIPE_SECRET_KEY:', process.env.STRIPE_SECRET_KEY ? 'Loaded' : 'Missing');
console.log('📧 EMAIL_USER:', process.env.EMAIL_USER ? 'Loaded' : 'Missing');
console.log('🔒 EMAIL_PASS:', process.env.EMAIL_PASS ? 'Loaded' : 'Missing');

// ====================
// Initialize Firebase Admin SDK with Service Account
// ====================

// Corrected path: serviceAccountKey.json is inside the migration folder
const serviceAccountPath = path.join(__dirname, 'serviceAccountKey.json');

if (fs.existsSync(serviceAccountPath)) {
  admin.initializeApp({
    credential: admin.credential.cert(require(serviceAccountPath)),
    storageBucket: 'ready-set-fly-71506.appspot.com', // Replace with your actual bucket name if different
  });
  console.log('✅ Initialized Firebase Admin with service account.');
} else {
  console.error('❌ Service account key file not found at:', serviceAccountPath);
  process.exit(1);
}

const db = admin.firestore();

// ====================
// Initialize Stripe SDK
// ====================

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;

if (!stripeSecretKey) {
  console.error("❌ Stripe secret key is not configured. Please set STRIPE_SECRET_KEY in your .env");
  process.exit(1);
}

const stripe = stripePackage(stripeSecretKey);

// ====================
// Initialize Nodemailer
// ====================

const emailUser = process.env.EMAIL_USER;
const emailPass = process.env.EMAIL_PASS;

if (!emailUser || !emailPass) {
  console.error("❌ Email credentials are not configured. Please set EMAIL_USER and EMAIL_PASS in your .env");
  process.exit(1);
}

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: emailUser,
    pass: emailPass,
  },
});

// ====================
// Migration Functions
// ====================

/**
 * Migrate specific string fields to numbers in the 'airplanes' collection.
 */
const migrateAirplanesFields = async () => {
  console.log('🔄 Starting migration for airplanes collection...');
  try {
    const airplanesRef = db.collection('airplanes');
    const snapshot = await airplanesRef.get();

    if (snapshot.empty) {
      console.log('ℹ️ No documents found in airplanes collection.');
      return;
    }

    const batch = db.batch();
    let updateCount = 0;

    for (const docSnap of snapshot.docs) {
      const data = docSnap.data();
      const updates = {};

      ['baseCost', 'commission', 'ownerPayout', 'rentalCost', 'totalCost'].forEach((field) => {
        if (data[field] && typeof data[field] === 'string') {
          const parsedValue = parseFloat(data[field]);
          if (!isNaN(parsedValue)) {
            updates[field] = parsedValue;
          }
        }
      });

      if (Object.keys(updates).length > 0) {
        const docRef = airplanesRef.doc(docSnap.id);
        batch.update(docRef, updates);
        updateCount += 1;
        console.log(`🛠️ Updated fields for document ID: ${docSnap.id}`);
      }
    }

    if (updateCount === 0) {
      console.log('✅ No string fields found to update in airplanes collection.');
      return;
    }

    await batch.commit();
    console.log(`🎉 Successfully updated ${updateCount} document(s) in airplanes collection.`);
  } catch (error) {
    console.error('❌ Error migrating airplanes fields:', error);
  }
};

/**
 * Migrate and validate the 'rentalRequestId' field in the 'rentalRequests' subcollections.
 * This function ensures that the 'rentalRequestId' field matches the document ID.
 */
const migrateRentalRequestIds = async () => {
  console.log('🔄 Starting migration for rentalRequests subcollections...');
  try {
    const ownersSnapshot = await db.collection('owners').get();

    if (ownersSnapshot.empty) {
      console.log('ℹ️ No documents found in owners collection.');
      return;
    }

    const batch = db.batch();
    let updateCount = 0;
    let mismatchCount = 0;
    let totalCount = 0;

    for (const ownerDoc of ownersSnapshot.docs) {
      const ownerId = ownerDoc.id;
      const rentalRequestsRef = db.collection('owners').doc(ownerId).collection('rentalRequests');
      const rentalSnapshot = await rentalRequestsRef.get();

      if (rentalSnapshot.empty) {
        console.log(`ℹ️ No rental requests found for owner: ${ownerId}`);
        continue;
      }

      for (const docSnap of rentalSnapshot.docs) {
        totalCount += 1;
        const data = docSnap.data();
        const documentId = docSnap.id;
        const rentalRequestId = data.rentalRequestId;

        if (!rentalRequestId || rentalRequestId === '') {
          // Set the missing rentalRequestId to the document ID
          batch.update(docSnap.ref, { rentalRequestId: documentId });
          updateCount += 1;
          console.log(`📝 Set missing rentalRequestId for document ID: ${documentId} under owner: ${ownerId}`);
        } else if (rentalRequestId !== documentId) {
          // Update the mismatched rentalRequestId to match the document ID
          batch.update(docSnap.ref, { rentalRequestId: documentId });
          mismatchCount += 1;
          console.log(`🔄 Fixed mismatched rentalRequestId for document ID: ${documentId} under owner: ${ownerId}`);
          console.log(`   - Previous rentalRequestId: ${rentalRequestId}`);
          console.log(`   - Updated rentalRequestId to: ${documentId}`);
        } else {
          // The rentalRequestId matches the document ID
          console.log(`✅ Valid rentalRequestId for document ID: ${documentId} under owner: ${ownerId}`);
        }
      }
    }

    if (updateCount === 0 && mismatchCount === 0) {
      console.log('✅ All rentalRequestId fields are already valid.');
      return;
    }

    await batch.commit();
    console.log('\n=== Migration Summary ===');
    console.log(`Total rentalRequests processed: ${totalCount}`);
    console.log(`Missing rentalRequestId fields fixed: ${updateCount}`);
    console.log(`Mismatched rentalRequestId fields corrected: ${mismatchCount}`);
  } catch (error) {
    console.error('❌ Error migrating rentalRequestId fields:', error);
  }
};

/**
 * Function: addStripeAccountIdToOwners
 * Description: Adds a `stripeAccountId` field to each owner in the 'owners' collection.
 * If the field already exists, it skips the owner.
 * Otherwise, it creates a Stripe Connected Account and stores the `stripeAccountId`.
 */
const addStripeAccountIdToOwners = async () => {
  console.log('🔄 Starting migration to add stripeAccountId to owners collection...');
  try {
    const ownersRef = db.collection('owners');
    const snapshot = await ownersRef.get();

    if (snapshot.empty) {
      console.log('ℹ️ No documents found in owners collection.');
      return;
    }

    const batch = db.batch();
    let updateCount = 0;
    let skipCount = 0;
    let errorCount = 0;

    for (const ownerDoc of snapshot.docs) {
      const ownerData = ownerDoc.data();
      const ownerId = ownerDoc.id;

      if (ownerData.stripeAccountId) {
        console.log(`✅ Owner ID: ${ownerId} already has a stripeAccountId. Skipping.`);
        skipCount += 1;
        continue;
      }

      // Validate email before attempting to create a Stripe account
      if (!ownerData.email || typeof ownerData.email !== 'string' || ownerData.email.trim() === '') {
        console.warn(`⚠️ Owner ID: ${ownerId} has an invalid or missing email. Skipping Stripe account creation.`);
        errorCount += 1;
        continue;
      }

      // Create a new Stripe Connected Account
      try {
        console.log(`🛠️ Creating Stripe Connected Account for Owner ID: ${ownerId}`);

        const account = await stripe.accounts.create({
          type: 'express', // You can choose 'standard', 'express', or 'custom' based on your needs
          country: 'US', // Set the country as per your requirements
          email: ownerData.email.trim(), // Ensure email is provided and trimmed
          metadata: {
            ownerId: ownerId,
            fullName: ownerData.fullName || '',
          },
        });

        if (account.id) {
          // Update Firestore document with stripeAccountId
          batch.update(ownerDoc.ref, { stripeAccountId: account.id, stripeAccountStatus: account.charges_enabled ? 'active' : 'inactive' });
          updateCount += 1;
          console.log(`✅ Successfully created and assigned stripeAccountId: ${account.id} to Owner ID: ${ownerId}`);
        } else {
          console.warn(`⚠️ Failed to retrieve stripeAccountId for Owner ID: ${ownerId}. Skipping.`);
          errorCount += 1;
        }
      } catch (stripeError) {
        console.error(`❌ Error creating Stripe account for Owner ID: ${ownerId}:`, stripeError.message);
        errorCount += 1;
      }
    }

    if (updateCount > 0) {
      await batch.commit();
      console.log(`🎉 Successfully updated ${updateCount} owner(s) with stripeAccountId.`);
    } else {
      console.log('✅ No owners were updated with stripeAccountId.');
    }

    if (skipCount > 0) {
      console.log(`ℹ️ Skipped ${skipCount} owner(s) who already have stripeAccountId.`);
    }

    if (errorCount > 0) {
      console.log(`⚠️ Encountered errors for ${errorCount} owner(s). Check logs for details.`);
    }
  } catch (error) {
    console.error('❌ Error adding stripeAccountId to owners:', error);
  }
};

/**
 * 🔄 **Updated Function: Fix Rental Hours and Rental Cost Per Hour**
 * 
 * Ensures that every rentalRequest document has `rentalHours` and `rentalCostPerHour` fields set as numbers.
 * If these fields are missing or improperly formatted, they are either set to 0 or converted to numbers.
 * Crucially, it avoids overwriting fields that already have valid numerical values.
 */
const fixRentalHoursAndCostPerHour = async () => {
  console.log('🔄 Starting migration to fix rentalHours and rentalCostPerHour in rentalRequests...');
  try {
    const rentalRequestsRef = db.collectionGroup('rentalRequests'); // Using collectionGroup to access all subcollections

    const snapshot = await rentalRequestsRef.get();

    if (snapshot.empty) {
      console.log('ℹ️ No documents found in rentalRequests subcollections.');
      return;
    }

    const batch = db.batch();
    let updateCount = 0;

    snapshot.docs.forEach((docSnap) => {
      const data = docSnap.data();
      const updates = {};

      // Handle rentalCostPerHour
      if (data.rentalCostPerHour === undefined) {
        updates.rentalCostPerHour = 0; // Set default value
        updateCount += 1;
        console.log(`📝 Setting missing rentalCostPerHour for Rental Request ID: ${docSnap.id}`);
      } else if (typeof data.rentalCostPerHour === 'string') {
        const parsedValue = parseFloat(data.rentalCostPerHour);
        if (!isNaN(parsedValue)) {
          updates.rentalCostPerHour = parsedValue;
          updateCount += 1;
          console.log(`🔄 Converted rentalCostPerHour from string to number for Rental Request ID: ${docSnap.id}`);
        } else {
          updates.rentalCostPerHour = 0; // Fallback to 0 if parsing fails
          updateCount += 1;
          console.log(`⚠️ Invalid rentalCostPerHour format. Setting to 0 for Rental Request ID: ${docSnap.id}`);
        }
      } else if (typeof data.rentalCostPerHour !== 'number') {
        // If it's neither undefined nor string nor number, set to 0
        updates.rentalCostPerHour = 0;
        updateCount += 1;
        console.log(`⚠️ Unexpected type for rentalCostPerHour. Setting to 0 for Rental Request ID: ${docSnap.id}`);
      }

      // Handle rentalHours
      if (data.rentalHours === undefined) {
        updates.rentalHours = 0; // Set default value
        updateCount += 1;
        console.log(`📝 Setting missing rentalHours for Rental Request ID: ${docSnap.id}`);
      } else if (typeof data.rentalHours === 'string') {
        const parsedValue = parseFloat(data.rentalHours);
        if (!isNaN(parsedValue)) {
          updates.rentalHours = parsedValue;
          updateCount += 1;
          console.log(`🔄 Converted rentalHours from string to number for Rental Request ID: ${docSnap.id}`);
        } else {
          updates.rentalHours = 0; // Fallback to 0 if parsing fails
          updateCount += 1;
          console.log(`⚠️ Invalid rentalHours format. Setting to 0 for Rental Request ID: ${docSnap.id}`);
        }
      } else if (typeof data.rentalHours !== 'number') {
        // If it's neither undefined nor string nor number, set to 0
        updates.rentalHours = 0;
        updateCount += 1;
        console.log(`⚠️ Unexpected type for rentalHours. Setting to 0 for Rental Request ID: ${docSnap.id}`);
      }

      // Apply updates only if there are changes
      if (Object.keys(updates).length > 0) {
        batch.update(docSnap.ref, updates);
      }
    });

    if (updateCount === 0) {
      console.log('✅ No missing or improperly formatted rentalHours or rentalCostPerHour fields found.');
      return;
    }

    await batch.commit();
    console.log(`🎉 Successfully updated ${updateCount} fields in rentalRequests.`);
  } catch (error) {
    console.error('❌ Error fixing rentalHours and rentalCostPerHour:', error);
  }
};

// ====================
// Audit Functions
// ====================

/**
 * Define expected schemas for your collections.
 * Update this object based on your application's data structure.
 */
const expectedSchemas = {
  owners: {
    fields: {
      stripeAccountId: 'string',
      stripeAccountStatus: 'string',
      uid: 'string',
      fullName: 'string',
      contact: 'string',
      email: 'string',
      address: 'string',
      image: 'string',
      // Add other expected fields and their types
    },
  },
  rentalRequests: {
    fields: {
      rentalRequestId: 'string',
      ownerId: 'string',
      renterId: 'string',
      listingId: 'string',
      rentalStatus: 'string',
      rentalPeriod: 'string',
      renterName: 'string',
      rentalCostPerHour: 'number',
      rentalHours: 'number',
      rentalCost: 'number',
      transactionFee: 'number',
      bookingFee: 'number',
      salesTax: 'number',
      totalCost: 'number',
      // Add other expected fields and their types
    },
  },
  airplanes: {
    fields: {
      baseCost: 'number',
      commission: 'number',
      ownerPayout: 'number',
      rentalCost: 'number',
      totalCost: 'number',
      createdAt: 'object', // Firestore timestamp
      images: 'object', // Array in Firestore is of type object
      airplaneModel: 'string',
      minimumHours: 'number',
      currentAnnualPdf: 'string',
      insurancePdf: 'string',
      ratesPerHour: 'number',
      description: 'string',
      location: 'string',
      ownerId: 'string',
      boosted: 'boolean',
      listing: 'string',
      costPerHour: 'number',
      availableDates: 'object', // Array in Firestore is of type object
      airplaneYear: 'number',
      userEmail: 'string',
      airplaneID: 'string',
      aircraftModel: 'string',
      tailNumber: 'string',
      engineType: 'string',
      totalTimeOnFrame: 'number',
      airportIdentifier: 'string',
      mainImage: 'string',
      documents: 'object', // Array in Firestore is of type object
      insuranceDocuments: 'object', // Array in Firestore is of type object
      boostListing: 'boolean',
      airplaneId: 'string',
      // Add other expected fields and their types
    },
  },
  UserPost: {
    fields: {
      ownerId: 'string',
      title: 'string',
      tailNumber: 'string',
      price: 'string', // Assuming price was stored as string and needs conversion
      description: 'string',
      city: 'string',
      state: 'string',
      email: 'string',
      phone: 'string',
      category: 'string',
      images: 'object', // Array in Firestore is of type object
      // Add other expected fields and their types
    },
  },
  // Define schemas for other collections as needed
};

/**
 * Utility Function: Recursively Traverse Collections and Subcollections
 * @param {FirebaseFirestore.CollectionReference} collectionRef
 * @param {string} parentPath
 * @returns {Array} Array of document information
 */
const traverseCollection = async (collectionRef, parentPath = '') => {
  const snapshot = await collectionRef.get();
  const data = [];

  for (const doc of snapshot.docs) {
    const docData = doc.data();
    const docPath = parentPath ? `${parentPath}/${doc.id}` : doc.id;
    const docInfo = {
      id: doc.id,
      path: docPath,
      data: docData,
      ref: doc.ref, // Include DocumentReference
      subcollections: [],
    };

    // Check for subcollections
    const subcollections = await doc.ref.listCollections();
    for (const subcol of subcollections) {
      const subcolData = await traverseCollection(subcol, docPath);
      docInfo.subcollections.push(...subcolData);
    }

    data.push(docInfo);
  }

  return data;
};

/**
 * Function: Analyze Document Structure Against Expected Schema
 * @param {string} collectionName
 * @param {object} docData
 * @param {string} docPath
 * @returns {Array} Array of issues found
 */
const analyzeDocument = (collectionName, docData, docPath) => {
  const schema = expectedSchemas[collectionName];
  const issues = [];

  if (schema) {
    const expectedFields = schema.fields;

    // Check for missing fields
    for (const field in expectedFields) {
      if (!(field in docData)) {
        issues.push(`❗ Missing field '${field}'`);
      } else {
        // Check data type
        const expectedType = expectedFields[field];
        let actualType = typeof docData[field];
        // Firestore Timestamps are objects
        if (docData[field] instanceof admin.firestore.Timestamp) {
          actualType = 'object';
        }
        if (actualType !== expectedType) {
          issues.push(
            `❗ Field '${field}' has type '${actualType}', expected '${expectedType}'`
          );
        }
      }
    }

    // Check for unexpected fields
    for (const field in docData) {
      if (!(field in expectedFields)) {
        issues.push(`⚠️ Unexpected field '${field}'`);
      }
    }
  } else {
    // If no schema is defined for the collection, optionally flag or skip
    // For now, we'll skip detailed analysis
  }

  return issues;
};

/**
 * Function: Fix Missing Fields
 * Assign default values to missing fields based on predefined defaults or logic.
 */
const fixMissingFields = async (collectionName, docRef, field, ownerId = null) => {
  // Validate docRef
  if (!docRef || typeof docRef.update !== 'function') {
    console.error(`❌ Invalid DocumentReference for field '${field}' in collection '${collectionName}'. Skipping update.`);
    return;
  }

  const defaultValues = {
    airplanes: {
      baseCost: 0,
      commission: 0,
      ownerPayout: 0,
      rentalCost: 0,
      totalCost: 0,
      // Add other fields with their default values
    },
    owners: {
      stripeAccountId: '',
      stripeAccountStatus: 'inactive',
      uid: '',
      fullName: '',
      contact: '',
      email: '',
      address: '',
      image: '',
      // Add other fields with their default values
    },
    rentalRequests: {
      rentalRequestId: '',
      ownerId: ownerId || '',
      renterId: '',
      listingId: '',
      rentalStatus: 'pending',
      rentalPeriod: '',
      renterName: '',
      rentalCostPerHour: 0,
      rentalHours: 0,
      rentalCost: 0,
      transactionFee: 0,
      bookingFee: 0,
      salesTax: 0,
      totalCost: 0,
      // Add other fields with their default values
    },
    UserPost: {
      ownerId: '',
      title: '',
      tailNumber: '',
      price: '',
      description: '',
      city: '',
      state: '',
      email: '',
      phone: '',
      category: '',
      images: [],
      // Add other fields with their default values
    },
    // Add default values for other collections
  };
  
  if (defaultValues[collectionName] && defaultValues[collectionName][field] !== undefined) {
    const defaultValue = defaultValues[collectionName][field];
    try {
      await docRef.update({ [field]: defaultValue });
      console.log(`🛠️ Fixed missing field '${field}' for document ID: ${docRef.id} in collection: ${collectionName}`);
    } catch (updateError) {
      console.error(`❌ Failed to update field '${field}' for document ID: ${docRef.id} in collection: ${collectionName}:`, updateError);
    }
  } else {
    console.warn(`⚠️ No default value defined for missing field '${field}' in collection: ${collectionName}`);
  }
};

/**
 * Function: Remove Unexpected Fields
 * Deletes fields that are not defined in the expected schemas.
 */
const removeUnexpectedFields = async (collectionName, docRef, field) => {
  // Validate docRef
  if (!docRef || typeof docRef.update !== 'function') {
    console.error(`❌ Invalid DocumentReference for field '${field}' in collection '${collectionName}'. Skipping removal.`);
    return;
  }

  try {
    await docRef.update({ [field]: admin.firestore.FieldValue.delete() });
    console.log(`🗑️ Removed unexpected field '${field}' from document ID: ${docRef.id} in collection: ${collectionName}`);
  } catch (removeError) {
    console.error(`❌ Failed to remove field '${field}' from document ID: ${docRef.id} in collection: ${collectionName}:`, removeError);
  }
};

/**
 * Function: Generate Audit Report and Fix Issues
 * This function traverses all collections and documents, analyzes them, logs issues, and fixes missing/unexpected fields.
 */
const generateAuditReportAndFix = async () => {
  console.log('\n🔍 Starting Firestore Audit and Fixes...');
  try {
    const rootCollections = await db.listCollections();
    const report = {
      collections: [],
      summary: {
        totalCollections: 0,
        totalDocuments: 0,
        totalIssues: 0,
        issuesByType: {},
      },
    };

    for (const collection of rootCollections) {
      const collectionName = collection.id;
      console.log(`📁 Processing collection: ${collectionName}`);
      report.summary.totalCollections += 1;

      const collectionData = await traverseCollection(collection);
      const collectionReport = {
        name: collectionName,
        documents: [],
      };

      for (const doc of collectionData) {
        report.summary.totalDocuments += 1;
        const issues = analyzeDocument(collectionName, doc.data, doc.path);

        if (issues.length > 0) {
          report.summary.totalIssues += issues.length;
          issues.forEach((issue) => {
            if (!report.summary.issuesByType[issue]) {
              report.summary.issuesByType[issue] = 1;
            } else {
              report.summary.issuesByType[issue] += 1;
            }
          });

          // Iterate through each issue and attempt fixes
          for (const issue of issues) {
            if (issue.startsWith('❗ Missing field')) {
              const fieldMatch = issue.match(/'(.+)'/);
              if (fieldMatch && fieldMatch[1]) {
                const field = fieldMatch[1];
                // Determine ownerId only for rentalRequests
                const ownerId = collectionName === 'rentalRequests' ? doc.data.ownerId : null;
                await fixMissingFields(collectionName, doc.ref, field, ownerId);
              }
            }

            if (issue.startsWith('⚠️ Unexpected field')) {
              const fieldMatch = issue.match(/'(.+)'/);
              if (fieldMatch && fieldMatch[1]) {
                const field = fieldMatch[1];
                const shouldRemove = true; // Set to false if you want to retain the field
                if (shouldRemove) {
                  await removeUnexpectedFields(collectionName, doc.ref, field);
                } else {
                  console.log(`ℹ️ Retaining unexpected field '${field}' as per configuration.`);
                  // Optionally, update expectedSchemas to include this field
                  if (expectedSchemas[collectionName]) {
                    const fieldType = typeof doc.data[field];
                    expectedSchemas[collectionName].fields[field] = fieldType;
                    console.log(`✅ Updated expected schema to include field '${field}' with type '${fieldType}'.`);
                  }
                }
              }
            }
          }
        }

        collectionReport.documents.push({
          id: doc.id,
          path: doc.path,
          issues,
        });
      }

      report.collections.push(collectionReport);
    }

    // Output the report to the console
    console.log('\n📊 Audit Report:');
    console.log(`- Total Collections: ${report.summary.totalCollections}`);
    console.log(`- Total Documents: ${report.summary.totalDocuments}`);
    console.log(`- Total Issues Found: ${report.summary.totalIssues}`);

    if (report.summary.totalIssues > 0) {
      console.log('\n🛠️ Issues Breakdown:');
      for (const [issue, count] of Object.entries(report.summary.issuesByType)) {
        console.log(`  - ${issue}: ${count}`);
      }

      // Save detailed report to a JSON file
      fs.writeFileSync('firestore_audit_report.json', JSON.stringify(report, null, 2));
      console.log('\n📄 Detailed report saved to firestore_audit_report.json');
    } else {
      console.log('🎉 No issues found. Your Firestore database is clean!');
    }
  } catch (error) {
    console.error('❌ Error generating audit report and fixing issues:', error);
  }
};

/**
 * Function: cleanupOrphanedListings
 * Description: Identifies and deletes listings in the 'UserPost' collection where the 'ownerId' does not correspond to any existing user in the 'owners' collection.
 * Optionally deletes associated images from Firebase Storage.
 */
const cleanupOrphanedListings = async () => {
  console.log('🔄 Starting cleanup of orphaned listings in UserPost collection...');
  try {
    const userPostRef = db.collection('UserPost');
    const listingsSnapshot = await userPostRef.get();

    if (listingsSnapshot.empty) {
      console.log('ℹ️ No listings found in UserPost collection.');
      return;
    }

    const batch = db.batch();
    let orphanedCount = 0;
    let imagesDeletedCount = 0;

    for (const listingDoc of listingsSnapshot.docs) {
      const listingData = listingDoc.data();
      const ownerId = listingData.ownerId;

      if (!ownerId) {
        console.warn(`⚠️ Listing ID: ${listingDoc.id} is missing 'ownerId'. Marking as orphaned.`);
        batch.delete(listingDoc.ref);
        orphanedCount += 1;

        // Optionally delete associated images
        if (listingData.images && Array.isArray(listingData.images)) {
          for (const imageUrl of listingData.images) {
            try {
              const filePath = decodeURIComponent(new URL(imageUrl).pathname)
                .replace('/storage/v1/b/ready-set-fly-71506.appspot.com/o/', '')
                .replace(/\+/g, ' ');
              const storageRef = admin.storage().bucket().file(filePath);
              await storageRef.delete();
              imagesDeletedCount += 1;
              console.log(`🗑️ Deleted image: ${filePath}`);
            } catch (imageError) {
              console.error(`❌ Failed to delete image at URL: ${imageUrl}`, imageError);
            }
          }
        }

        continue; // Skip further checks since ownerId is missing
      }

      // Check if the owner exists in the 'owners' collection
      const ownerDoc = await db.collection('owners').doc(ownerId).get();
      if (!ownerDoc.exists) {
        console.warn(`⚠️ Orphaned Listing Found - Listing ID: ${listingDoc.id}, Owner ID: ${ownerId}`);
        batch.delete(listingDoc.ref);
        orphanedCount += 1;

        // Optionally delete associated images
        if (listingData.images && Array.isArray(listingData.images)) {
          for (const imageUrl of listingData.images) {
            try {
              const filePath = decodeURIComponent(new URL(imageUrl).pathname)
                .replace('/storage/v1/b/ready-set-fly-71506.appspot.com/o/', '')
                .replace(/\+/g, ' ');
              const storageRef = admin.storage().bucket().file(filePath);
              await storageRef.delete();
              imagesDeletedCount += 1;
              console.log(`🗑️ Deleted image: ${filePath}`);
            } catch (imageError) {
              console.error(`❌ Failed to delete image at URL: ${imageUrl}`, imageError);
            }
          }
        }
      }
    }

    if (orphanedCount === 0) {
      console.log('✅ No orphaned listings found.');
      return;
    }

    await batch.commit();
    console.log(`🎉 Successfully deleted ${orphanedCount} orphaned listing(s) from UserPost collection.`);
    console.log(`🗑️ Successfully deleted ${imagesDeletedCount} associated image(s) from Firebase Storage.`);
  } catch (error) {
    console.error('❌ Error during cleanup of orphaned listings:', error);
  }
};

// ====================
// Execution Flow
// ====================

/**
 * Execute all migration and audit functions sequentially.
 */
const runMigrationsAndAudit = async () => {
  console.log('🚀 Migration and Audit script started.');

  // Perform Migrations
  await migrateAirplanesFields();
  await migrateRentalRequestIds();
  await fixRentalHoursAndCostPerHour(); // Updated migration function
  await addStripeAccountIdToOwners(); // Existing migration function

  // Perform Cleanup
  await cleanupOrphanedListings();

  // Perform Audit and Fixes
  await generateAuditReportAndFix();

  console.log('🏁 Migration and Audit script completed.');
  process.exit(0);
};

// Execute the script
runMigrationsAndAudit().catch((error) => {
  console.error('❌ Migration and Audit script encountered an error:', error);
  process.exit(1);
});
