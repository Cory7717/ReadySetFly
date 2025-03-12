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
const serviceAccountPath = path.join(__dirname, 'serviceAccountKey.json');

if (fs.existsSync(serviceAccountPath)) {
  admin.initializeApp({
    credential: admin.credential.cert(require(serviceAccountPath)),
    storageBucket: 'ready-set-fly-71506.appspot.com', // Replace if different
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
// Load and Manage Schemas
// ====================
const schemasPath = path.join(__dirname, 'schemas.json');
let expectedSchemas = {};

if (fs.existsSync(schemasPath)) {
  try {
    const schemasData = fs.readFileSync(schemasPath, 'utf-8');
    expectedSchemas = JSON.parse(schemasData);
    console.log('✅ Loaded existing schemas from schemas.json.');
  } catch (error) {
    console.error('❌ Failed to read or parse schemas.json:', error);
    process.exit(1);
  }
} else {
  console.warn('⚠️ schemas.json not found. Starting with an empty schema.');
  expectedSchemas = {};
}

const saveSchemas = () => {
  try {
    fs.writeFileSync(schemasPath, JSON.stringify(expectedSchemas, null, 2));
    console.log('✅ schemas.json has been updated.');
  } catch (error) {
    console.error('❌ Failed to write to schemas.json:', error);
  }
};

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
        batch.update(docSnap.ref, updates);
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
          batch.update(docSnap.ref, { rentalRequestId: documentId });
          updateCount += 1;
          console.log(`📝 Set missing rentalRequestId for document ID: ${documentId} under owner: ${ownerId}`);
        } else if (rentalRequestId !== documentId) {
          batch.update(docSnap.ref, { rentalRequestId: documentId });
          mismatchCount += 1;
          console.log(`🔄 Fixed mismatched rentalRequestId for document ID: ${documentId} under owner: ${ownerId}`);
          console.log(`   - Previous rentalRequestId: ${rentalRequestId}`);
          console.log(`   - Updated rentalRequestId to: ${documentId}`);
        } else {
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
 * Fix numeric fields (rentalHours, rentalCostPerHour) in the rentalRequests subcollections.
 */
const fixRentalHoursAndCostPerHour = async () => {
  console.log('🔄 Starting migration to fix rentalHours and rentalCostPerHour in rentalRequests...');
  try {
    const rentalRequestsRef = db.collectionGroup('rentalRequests');

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

      // rentalCostPerHour
      if (data.rentalCostPerHour === undefined) {
        updates.rentalCostPerHour = 0;
        updateCount += 1;
        console.log(`📝 Setting missing rentalCostPerHour for Rental Request ID: ${docSnap.id}`);
      } else if (typeof data.rentalCostPerHour === 'string') {
        const parsedValue = parseFloat(data.rentalCostPerHour);
        if (!isNaN(parsedValue)) {
          updates.rentalCostPerHour = parsedValue;
          updateCount += 1;
          console.log(`🔄 Converted rentalCostPerHour from string to number for Rental Request ID: ${docSnap.id}`);
        } else {
          updates.rentalCostPerHour = 0;
          updateCount += 1;
          console.log(`⚠️ Invalid rentalCostPerHour format. Setting to 0 for Rental Request ID: ${docSnap.id}`);
        }
      } else if (typeof data.rentalCostPerHour !== 'number') {
        updates.rentalCostPerHour = 0;
        updateCount += 1;
        console.log(`⚠️ Unexpected type for rentalCostPerHour. Setting to 0 for Rental Request ID: ${docSnap.id}`);
      }

      // rentalHours
      if (data.rentalHours === undefined) {
        updates.rentalHours = 0;
        updateCount += 1;
        console.log(`📝 Setting missing rentalHours for Rental Request ID: ${docSnap.id}`);
      } else if (typeof data.rentalHours === 'string') {
        const parsedValue = parseFloat(data.rentalHours);
        if (!isNaN(parsedValue)) {
          updates.rentalHours = parsedValue;
          updateCount += 1;
          console.log(`🔄 Converted rentalHours from string to number for Rental Request ID: ${docSnap.id}`);
        } else {
          updates.rentalHours = 0;
          updateCount += 1;
          console.log(`⚠️ Invalid rentalHours format. Setting to 0 for Rental Request ID: ${docSnap.id}`);
        }
      } else if (typeof data.rentalHours !== 'number') {
        updates.rentalHours = 0;
        updateCount += 1;
        console.log(`⚠️ Unexpected type for rentalHours. Setting to 0 for Rental Request ID: ${docSnap.id}`);
      }

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

/**
 * Update paymentStatus in top-level "rentalRequests" if rentalStatus is approved and paymentStatus != completed.
 */
const updatePaymentStatusInRentalRequests = async () => {
  console.log('🔄 Starting migration to update paymentStatus in rentalRequests...');
  try {
    const rentalRequestsRef = db.collection('rentalRequests');
    const snapshot = await rentalRequestsRef.get();
    if (snapshot.empty) {
      console.log('ℹ️ No documents found in rentalRequests collection.');
      return;
    }
    const batch = db.batch();
    let updateCount = 0;
    snapshot.docs.forEach((docSnap) => {
      const data = docSnap.data();
      if (data.rentalStatus === "approved" && data.paymentStatus !== "completed") {
        batch.update(docSnap.ref, { paymentStatus: "completed" });
        updateCount++;
        console.log(`🛠️ Updated paymentStatus for rentalRequest ID: ${docSnap.id}`);
      }
    });
    if (updateCount === 0) {
      console.log('✅ All rentalRequests already have correct paymentStatus.');
      return;
    }
    await batch.commit();
    console.log(`🎉 Successfully updated paymentStatus for ${updateCount} rentalRequest(s).`);
  } catch (error) {
    console.error('❌ Error updating paymentStatus in rentalRequests:', error);
  }
};

/**
 * NEW SCRIPT: Migrate existing notifications for renters.
 * For each notification in a renter's notifications subcollection that has a rentalRequestId (or rentalRequest) field,
 * if the corresponding rental request in the top-level "rentalRequests" collection has paymentStatus "completed" and its rentalStatus is not "active",
 * update the rentalStatus to "active" and then delete the notification.
 */
const migrateNotificationsToActive = async () => {
  console.log('🔄 Starting migration to update notifications to active in renters subcollections...');
  try {
    const rentersSnapshot = await db.collection('renters').get();
    if (rentersSnapshot.empty) {
      console.log('ℹ️ No renter documents found.');
      return;
    }
    let totalNotificationsProcessed = 0;
    let notificationsDeleted = 0;
    for (const renterDoc of rentersSnapshot.docs) {
      const renterId = renterDoc.id;
      const notificationsRef = db.collection('renters').doc(renterId).collection('notifications');
      const notificationsSnapshot = await notificationsRef.get();
      if (notificationsSnapshot.empty) {
        continue;
      }
      for (const notifDoc of notificationsSnapshot.docs) {
        totalNotificationsProcessed++;
        const notifData = notifDoc.data();
        const rentalRequestId = notifData.rentalRequestId || notifData.rentalRequest;
        if (!rentalRequestId) {
          console.log(`ℹ️ Notification ${notifDoc.id} under renter ${renterId} does not have a rentalRequestId. Skipping.`);
          continue;
        }
        const rentalRequestRef = db.collection('rentalRequests').doc(rentalRequestId);
        const rentalRequestSnap = await rentalRequestRef.get();
        if (!rentalRequestSnap.exists) {
          console.log(`ℹ️ Rental request ${rentalRequestId} not found for notification ${notifDoc.id}. Skipping.`);
          continue;
        }
        const rentalData = rentalRequestSnap.data();
        if (rentalData.paymentStatus === "completed" && rentalData.rentalStatus !== "active") {
          await rentalRequestRef.update({ rentalStatus: "active" });
          console.log(`🛠️ Updated rental request ${rentalRequestId} rentalStatus to active.`);
        }
        if (rentalData.paymentStatus === "completed") {
          await notifDoc.ref.delete();
          notificationsDeleted++;
          console.log(`🗑️ Deleted notification ${notifDoc.id} under renter ${renterId}.`);
        }
      }
    }
    console.log(`🎉 Migration completed. Processed ${totalNotificationsProcessed} notifications; deleted ${notificationsDeleted} notifications.`);
  } catch (error) {
    console.error('❌ Error migrating notifications to active:', error);
  }
};

/**
 * Add a stripeAccountId to each owner in the 'owners' collection if missing.
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

      if (!ownerData.email || typeof ownerData.email !== 'string' || ownerData.email.trim() === '') {
        console.warn(`⚠️ Owner ID: ${ownerId} has an invalid or missing email. Skipping Stripe account creation.`);
        errorCount += 1;
        continue;
      }

      try {
        console.log(`🛠️ Creating Stripe Connected Account for Owner ID: ${ownerId}`);
        const account = await stripe.accounts.create({
          type: 'express',
          country: 'US',
          email: ownerData.email.trim(),
          metadata: {
            ownerId: ownerId,
            fullName: ownerData.fullName || '',
          },
        });

        if (account.id) {
          batch.update(ownerDoc.ref, {
            stripeAccountId: account.id,
            stripeAccountStatus: account.charges_enabled ? 'active' : 'inactive'
          });
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
 * Sync the stripeAccountId from "owners" to "users" by matching document IDs.
 */
const syncStripeAccountIdFromOwnersToUsers = async () => {
  console.log('🔄 Starting synchronization of stripeAccountId from owners to users...');
  try {
    const ownersSnapshot = await db.collection('owners').get();
    if (ownersSnapshot.empty) {
      console.log('ℹ️ No owners found.');
      return;
    }

    const batch = db.batch();
    let updateCount = 0;
    for (const ownerDoc of ownersSnapshot.docs) {
      const ownerData = ownerDoc.data();
      const ownerId = ownerDoc.id;
      if (ownerData.stripeAccountId) {
        const userRef = db.collection('users').doc(ownerId);
        batch.set(
          userRef,
          {
            stripeAccountId: ownerData.stripeAccountId,
            stripeAccountStatus: ownerData.stripeAccountStatus || 'active'
          },
          { merge: true }
        );
        updateCount++;
        console.log(`✅ Updated user ${ownerId} with stripeAccountId: ${ownerData.stripeAccountId}`);
      }
    }

    if (updateCount > 0) {
      await batch.commit();
      console.log(`🎉 Successfully updated ${updateCount} user document(s) with stripeAccountId.`);
    } else {
      console.log('✅ No user documents required update.');
    }
  } catch (error) {
    console.error('❌ Error synchronizing stripeAccountId from owners to users:', error);
  }
};

/**
 * Ensure messages have a participants array that includes both renter and owner if rentalRequestId is present.
 */
const migrateMessagesParticipants = async () => {
  console.log('🔄 Starting migration for messages collection...');
  try {
    const messagesRef = db.collection('messages');
    const snapshot = await messagesRef.get();
    if (snapshot.empty) {
      console.log('ℹ️ No messages found.');
      return;
    }
    const batch = db.batch();
    let updateCount = 0;
    for (const docSnap of snapshot.docs) {
      const data = docSnap.data();
      if (!data.participants || !Array.isArray(data.participants)) {
        console.warn(`⚠️ Message ${docSnap.id} is missing a valid participants field. Skipping.`);
        continue;
      }
      if (data.participants.length >= 2) {
        console.log(`✅ Message ${docSnap.id} already has multiple participants.`);
        continue;
      }
      if (data.rentalRequestId) {
        const rentalRequestRef = db.collection('rentalRequests').doc(data.rentalRequestId);
        const rentalRequestSnap = await rentalRequestRef.get();
        if (rentalRequestSnap.exists) {
          const rentalData = rentalRequestSnap.data();
          if (rentalData.ownerId) {
            let newParticipants = data.participants.slice();
            if (!newParticipants.includes(rentalData.ownerId)) {
              newParticipants.push(rentalData.ownerId);
              batch.update(docSnap.ref, { participants: newParticipants });
              updateCount++;
              console.log(`🔄 Updated message ${docSnap.id} with ownerId: ${rentalData.ownerId}`);
            }
          } else {
            console.warn(`⚠️ Rental request ${data.rentalRequestId} does not have an ownerId for message ${docSnap.id}`);
          }
        } else {
          console.warn(`⚠️ Rental request ${data.rentalRequestId} not found for message ${docSnap.id}`);
        }
      } else {
        console.warn(`⚠️ Message ${docSnap.id} does not have rentalRequestId. Skipping update.`);
      }
    }
    if (updateCount > 0) {
      await batch.commit();
      console.log(`🎉 Successfully updated ${updateCount} message document(s) in messages collection.`);
    } else {
      console.log('✅ No messages needed updating.');
    }
  } catch (error) {
    console.error('❌ Error migrating messages participants:', error);
  }
};

/**
 * Ensure each airplane document includes its own doc ID in the "id" field.
 */
const migrateAirplaneDocumentIds = async () => {
  console.log('🔄 Starting migration to ensure each airplane document includes its document ID in the data...');
  try {
    const airplanesRef = db.collection('airplanes');
    const snapshot = await airplanesRef.get();
    if (snapshot.empty) {
      console.log('ℹ️ No documents found in airplanes collection.');
      return;
    }
    const batch = db.batch();
    let updateCount = 0;
    snapshot.docs.forEach((docSnap) => {
      const data = docSnap.data();
      if (!data.id || data.id.trim() === "") {
        batch.update(docSnap.ref, { id: docSnap.id });
        updateCount++;
        console.log(`📝 Updated document ID field for airplane: ${docSnap.id}`);
      }
    });
    if (updateCount > 0) {
      await batch.commit();
      console.log(`🎉 Successfully updated ${updateCount} airplane document(s) with their document ID.`);
    } else {
      console.log('✅ All airplane documents already have a valid document ID.');
    }
  } catch (error) {
    console.error('❌ Error migrating airplane document IDs:', error);
  }
};

/**
 * Clean up orphaned listings in the 'UserPost' collection that have no matching owner in 'owners'.
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

        continue;
      }

      const ownerDoc = await db.collection('owners').doc(ownerId).get();
      if (!ownerDoc.exists) {
        console.warn(`⚠️ Orphaned Listing Found - Listing ID: ${listingDoc.id}, Owner ID: ${ownerId}`);
        batch.delete(listingDoc.ref);
        orphanedCount += 1;

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
    console.log(`🗑️ Successfully deleted ${imagesDeletedCount} associated image(s).`);
  } catch (error) {
    console.error('❌ Error during cleanup of orphaned listings:', error);
  }
};

/**
 * Migrate the 'listings' collection to ensure compliance with fields in Classifieds.js.
 */
const migrateClassifiedsListings = async () => {
  console.log('🔄 Starting migration for "listings" collection to align with Classifieds.js...');
  try {
    const listingsRef = db.collection('listings');
    const snapshot = await listingsRef.get();
    if (snapshot.empty) {
      console.log('ℹ️ No documents found in "listings" collection.');
      return;
    }

    const batch = db.batch();
    let updateCount = 0;

    for (const docSnap of snapshot.docs) {
      const data = docSnap.data();
      const docRef = docSnap.ref;

      const updates = {};

      // Ensure 'images' is an array
      if (!data.images || !Array.isArray(data.images)) {
        updates.images = [];
      }
      // Ensure 'category' is a string
      if (!data.category || typeof data.category !== 'string') {
        updates.category = 'Uncategorized';
      }
      // Ensure 'packageType' is a string
      if (!data.packageType || typeof data.packageType !== 'string') {
        updates.packageType = 'Basic';
      }
      // Ensure 'createdAt' is present
      if (!data.createdAt) {
        updates.createdAt = admin.firestore.FieldValue.serverTimestamp();
      }

      if (Object.keys(updates).length > 0) {
        batch.update(docRef, updates);
        updateCount++;
        console.log(`🛠️ Updating listing ${docRef.id} with missing or default fields.`);
      }
    }

    if (updateCount > 0) {
      await batch.commit();
      console.log(`🎉 Successfully updated ${updateCount} listing(s) in "listings" to align with Classifieds.js.`);
    } else {
      console.log('✅ All listings in "listings" collection are already aligned with Classifieds.js.');
    }
  } catch (error) {
    console.error('❌ Error migrating "listings" collection:', error);
  }
};

/**
 * NEW SCRIPT: Add publiclyViewable: true to all 'listings' documents if missing.
 */
const addPubliclyViewableFieldToListings = async () => {
  console.log('🔄 Starting migration to add "publiclyViewable: true" to all documents in the "listings" collection...');
  try {
    const listingsRef = db.collection('listings');
    const snapshot = await listingsRef.get();
    if (snapshot.empty) {
      console.log('ℹ️ No documents found in "listings" to update.');
      return;
    }

    const batch = db.batch();
    let updateCount = 0;

    snapshot.docs.forEach((docSnap) => {
      const data = docSnap.data();

      // If publiclyViewable is missing or not a boolean, set it to true
      if (typeof data.publiclyViewable !== 'boolean') {
        batch.update(docSnap.ref, { publiclyViewable: true });
        updateCount++;
        console.log(`🛠️ Setting publiclyViewable: true for listing ${docSnap.id}`);
      }
    });

    if (updateCount > 0) {
      await batch.commit();
      console.log(`🎉 Successfully updated ${updateCount} listings to have publiclyViewable: true`);
    } else {
      console.log('✅ All listings already have a publiclyViewable field set.');
    }
  } catch (error) {
    console.error('❌ Error adding publiclyViewable field to listings:', error);
  }
};

// ====================
// NEW FUNCTION: Update all 'users' doc to have role="both"
// ====================
const updateUserRoleToBoth = async () => {
  console.log('🔄 Starting updateUserRoleToBoth migration...');
  try {
    const usersRef = db.collection('users');
    const snapshot = await usersRef.get();

    if (snapshot.empty) {
      console.log('ℹ️ No user documents found in "users" collection.');
      return;
    }

    const batch = db.batch();
    let updateCount = 0;

    snapshot.forEach((docSnap) => {
      const data = docSnap.data();
      // If 'role' is missing or not 'both', set it to 'both'
      if (!data.role || data.role !== 'both') {
        batch.update(docSnap.ref, { role: 'both' });
        updateCount++;
        console.log(`🛠️ Setting role to "both" for user doc ID: ${docSnap.id}`);
      }
    });

    if (updateCount > 0) {
      await batch.commit();
      console.log(`🎉 Successfully updated ${updateCount} user doc(s) to have "role: both".`);
    } else {
      console.log('✅ All user docs already have role="both" or no update needed.');
    }
  } catch (error) {
    console.error('❌ Error updating user docs to role=both:', error);
  }
};

// ====================
// Audit and Dynamic Schema Management
// ====================

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
      ref: doc.ref,
      subcollections: [],
    };

    const subcollections = await doc.ref.listCollections();
    for (const subcol of subcollections) {
      const subcolData = await traverseCollection(subcol, docPath);
      docInfo.subcollections.push(...subcolData);
    }

    data.push(docInfo);
  }

  return data;
};

const analyzeDocument = (collectionName, docData, docPath) => {
  const schema = expectedSchemas[collectionName];
  const issues = [];

  if (schema) {
    const expectedFields = schema.fields;
    for (const field in expectedFields) {
      if (!(field in docData)) {
        issues.push(`❗ Missing field '${field}'`);
      } else {
        const expectedType = expectedFields[field];
        let actualType = typeof docData[field];
        if (docData[field] instanceof admin.firestore.Timestamp) {
          actualType = 'object';
        }
        if (actualType !== expectedType) {
          issues.push(`❗ Field '${field}' has type '${actualType}', expected '${expectedType}'`);
        }
      }
    }
    for (const field in docData) {
      if (!(field in expectedFields)) {
        issues.push(`⚠️ Unexpected field '${field}'`);
      }
    }
  } else {
    console.log(`🔍 Detected new collection: '${collectionName}'. Adding to schemas.json.`);
    expectedSchemas[collectionName] = { fields: {} };
    saveSchemas();
  }
  return issues;
};

const inferDataType = (value) => {
  if (value instanceof admin.firestore.Timestamp) return 'object';
  if (Array.isArray(value)) return 'object';
  return typeof value;
};

const fixMissingFields = async (collectionName, docRef, field, ownerId = null) => {
  if (!docRef || typeof docRef.update !== 'function') {
    console.error(`❌ Invalid DocumentReference for field '${field}' in collection '${collectionName}'. Skipping update.`);
    return;
  }

  const defaultValues = {
    string: '',
    number: 0,
    boolean: false,
    object: {},
  };

  const fieldType = expectedSchemas[collectionName]?.fields[field];
  let defaultValue = null;

  if (fieldType && defaultValues[fieldType] !== undefined) {
    defaultValue = defaultValues[fieldType];
  } else {
    defaultValue = null;
  }

  if (defaultValue === null) {
    console.warn(`⚠️ No default value defined for field '${field}' in collection '${collectionName}'. Skipping.`);
    return;
  }

  try {
    await docRef.update({ [field]: defaultValue });
    console.log(`🛠️ Fixed missing field '${field}' for document ID: ${docRef.id} in collection: ${collectionName}`);
  } catch (updateError) {
    console.error(`❌ Failed to update field '${field}' for document ID: ${docRef.id} in collection: ${collectionName}:`, updateError);
  }
};

const removeUnexpectedFields = async (collectionName, docRef, field) => {
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

const addFieldToSchema = async (collectionName, field, value) => {
  if (!expectedSchemas[collectionName]) {
    expectedSchemas[collectionName] = { fields: {} };
  }
  const inferredType = inferDataType(value);
  expectedSchemas[collectionName].fields[field] = inferredType;
  console.log(`🆕 Added new field '${field}' with type '${inferredType}' to collection '${collectionName}' in schemas.json.`);
  saveSchemas();
};

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

          for (const issue of issues) {
            if (issue.startsWith('❗ Missing field')) {
              const fieldMatch = issue.match(/'(.+)'/);
              if (fieldMatch && fieldMatch[1]) {
                const field = fieldMatch[1];
                const ownerId = collectionName === 'rentalRequests' ? doc.data.ownerId : null;
                await fixMissingFields(collectionName, doc.ref, field, ownerId);
              }
            }
            if (issue.startsWith('⚠️ Unexpected field')) {
              const fieldMatch = issue.match(/'(.+)'/);
              if (fieldMatch && fieldMatch[1]) {
                const field = fieldMatch[1];
                const fieldValue = doc.data[field];
                await addFieldToSchema(collectionName, field, fieldValue);
                await fixMissingFields(collectionName, doc.ref, field);
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

    console.log('\n📊 Audit Report:');
    console.log(`- Total Collections: ${report.summary.totalCollections}`);
    console.log(`- Total Documents: ${report.summary.totalDocuments}`);
    console.log(`- Total Issues Found: ${report.summary.totalIssues}`);

    if (report.summary.totalIssues > 0) {
      console.log('\n🛠️ Issues Breakdown:');
      for (const [issue, count] of Object.entries(report.summary.issuesByType)) {
        console.log(`  - ${issue}: ${count}`);
      }
      fs.writeFileSync('firestore_audit_report.json', JSON.stringify(report, null, 2));
      console.log('\n📄 Detailed report saved to firestore_audit_report.json');
    } else {
      console.log('🎉 No issues found. Your Firestore database is clean!');
    }
  } catch (error) {
    console.error('❌ Error generating audit report and fixing issues:', error);
  }
};

// ====================
// Execution Flow
// ====================
const runMigrationsAndAudit = async () => {
  console.log('🚀 Migration and Audit script started.');

  // Perform Migrations
  await migrateAirplanesFields();
  await migrateRentalRequestIds();
  await fixRentalHoursAndCostPerHour();
  await updatePaymentStatusInRentalRequests();
  await migrateNotificationsToActive(); // NEW: Migrate existing notifications to active state
  await addStripeAccountIdToOwners();
  
  // Synchronize stripeAccountId into users collection
  await syncStripeAccountIdFromOwnersToUsers();

  // Migrate messages participants
  await migrateMessagesParticipants();

  // Ensure each airplane doc includes its own ID
  await migrateAirplaneDocumentIds();

  // Clean up orphaned listings in UserPost
  await cleanupOrphanedListings();

  // Align 'listings' with Classifieds.js
  await migrateClassifiedsListings();

  // 🚨 NEW: Add publiclyViewable: true to all listings, if missing
  await addPubliclyViewableFieldToListings();

  // 🚨 NEW: Update all 'users' doc to have role="both"
  await updateUserRoleToBoth();

  // Perform Audit and Dynamic Schema Management
  await generateAuditReportAndFix();

  console.log('🏁 Migration and Audit script completed.');
  process.exit(0);
};

// Execute the script
runMigrationsAndAudit().catch((error) => {
  console.error('❌ Migration and Audit script encountered an error:', error);
  process.exit(1);
});
