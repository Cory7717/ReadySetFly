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
const bucket = admin.storage().bucket(); // Define storage bucket globally for convenience

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
          } else {
              console.warn(`⚠️ Invalid number format for field '${field}' in airplane ${docSnap.id}. Value: "${data[field]}". Skipping conversion.`);
          }
        }
      });

      if (Object.keys(updates).length > 0) {
        batch.update(docSnap.ref, updates);
        updateCount += 1;
        // console.log(`🛠️ Prepared number conversion for fields in airplane ID: ${docSnap.id}`); // Reduce log noise
      }
    }

    if (updateCount === 0) {
      console.log('✅ No string fields needed number conversion in airplanes collection.');
      return;
    }

    await batch.commit();
    console.log(`🎉 Successfully updated number fields for ${updateCount} document(s) in airplanes collection.`);
  } catch (error) {
    console.error('❌ Error migrating airplanes fields:', error);
  }
};

/**
 * Migrate and validate the 'rentalRequestId' field in the 'rentalRequests' subcollections within 'owners'.
 */
const migrateRentalRequestIds = async () => {
  console.log('🔄 Starting migration for rentalRequestId in owners/../rentalRequests subcollections...');
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
      const rentalRequestsRef = ownerDoc.ref.collection('rentalRequests');
      const rentalSnapshot = await rentalRequestsRef.get();

      if (rentalSnapshot.empty) continue;

      for (const docSnap of rentalSnapshot.docs) {
        totalCount += 1;
        const data = docSnap.data();
        const documentId = docSnap.id;
        const rentalRequestId = data.rentalRequestId;

        if (!rentalRequestId || typeof rentalRequestId !== 'string' || rentalRequestId.trim() === '' || rentalRequestId !== documentId) {
             if (!rentalRequestId || typeof rentalRequestId !== 'string' || rentalRequestId.trim() === '') {
                 console.log(`📝 Setting missing/invalid rentalRequestId for document ID: ${documentId} under owner: ${ownerId}`);
                 updateCount++;
             } else { // rentalRequestId !== documentId
                 console.log(`🔄 Fixing mismatched rentalRequestId for document ID: ${documentId} under owner: ${ownerId} (was: ${rentalRequestId})`);
                 mismatchCount++;
             }
             batch.update(docSnap.ref, { rentalRequestId: documentId });
        }
      }
    }

    if (updateCount === 0 && mismatchCount === 0) {
      console.log('✅ All rentalRequestId fields in subcollections are already valid.');
      return;
    }

    await batch.commit();
    console.log('\n=== rentalRequestId Migration Summary ===');
    console.log(`Total subcollection rentalRequests processed: ${totalCount}`);
    console.log(`Missing/invalid rentalRequestId fields fixed: ${updateCount}`);
    console.log(`Mismatched rentalRequestId fields corrected: ${mismatchCount}`);
  } catch (error) {
    console.error('❌ Error migrating rentalRequestId fields in subcollections:', error);
  }
};


/**
 * Fix numeric fields (rentalHours, rentalCostPerHour) in 'rentalRequests' subcollections using collectionGroup.
 */
const fixRentalHoursAndCostPerHour = async () => {
  console.log('🔄 Starting migration to fix rentalHours/rentalCostPerHour in rentalRequests subcollections...');
  try {
    const rentalRequestsRef = db.collectionGroup('rentalRequests');
    const snapshot = await rentalRequestsRef.get();

    if (snapshot.empty) {
      console.log('ℹ️ No documents found in any rentalRequests subcollections.');
      return;
    }

    const batch = db.batch();
    let fieldsUpdatedCount = 0;
    const fieldsToFix = ['rentalHours', 'rentalCostPerHour'];

    snapshot.docs.forEach((docSnap) => {
      const data = docSnap.data();
      const updates = {};
      let docNeedsUpdate = false;

      fieldsToFix.forEach(field => {
          const currentValue = data[field];
          let newValue = null;

          if (currentValue === undefined || currentValue === null) {
              newValue = 0;
              // console.log(`📝 Setting missing ${field} to 0 for Rental Request ${docSnap.ref.path}`); // Reduce noise
          } else if (typeof currentValue === 'string') {
              const parsedValue = parseFloat(currentValue);
              if (!isNaN(parsedValue)) {
                  newValue = parsedValue;
                  // console.log(`🔄 Converted ${field} from string to number for Rental Request ${docSnap.ref.path}`); // Reduce noise
              } else {
                  newValue = 0;
                  console.log(`⚠️ Invalid ${field} string format ("${currentValue}"). Setting to 0 for Rental Request ${docSnap.ref.path}`);
              }
          } else if (typeof currentValue !== 'number') {
              newValue = 0;
              console.log(`⚠️ Unexpected type (${typeof currentValue}) for ${field}. Setting to 0 for Rental Request ${docSnap.ref.path}`);
          }

          if (newValue !== null && newValue !== currentValue) {
              updates[field] = newValue;
              fieldsUpdatedCount++;
              docNeedsUpdate = true;
          }
      });

      if (docNeedsUpdate) {
        batch.update(docSnap.ref, updates);
      }
    });

    if (fieldsUpdatedCount === 0) {
      console.log('✅ No missing or improperly formatted rentalHours or rentalCostPerHour fields found in subcollections.');
      return;
    }

    await batch.commit();
    console.log(`🎉 Successfully updated ${fieldsUpdatedCount} rentalHours/rentalCostPerHour field(s) across rentalRequests subcollections.`);
  } catch (error) {
    console.error('❌ Error fixing rentalHours and rentalCostPerHour in subcollections:', error);
  }
};

/**
 * Fix numeric cost fields in the top-level "rentalRequests" collection.
 */
const fixRentalCostFields = async () => {
  console.log('🔄 Starting migration to fix cost fields in top-level rentalRequests...');
  try {
    const rentalRequestsRef = db.collection('rentalRequests');
    const snapshot = await rentalRequestsRef.get();
    if (snapshot.empty) {
      console.log('ℹ️ No documents found in top-level rentalRequests.');
      return;
    }
    const batch = db.batch();
    let fieldsUpdatedCount = 0;
    const fields = ['rentalCost', 'bookingFee', 'transactionFee', 'salesTax', 'totalCost'];

    snapshot.docs.forEach((docSnap) => {
      const data = docSnap.data();
      const updates = {};
      let docNeedsUpdate = false;

       fields.forEach((field) => {
          const currentValue = data[field];
          let newValue = null;

          if (currentValue === undefined || currentValue === null) {
              newValue = 0;
              // console.log(`📝 Setting missing ${field} to 0 for rentalRequest ${docSnap.id}`); // Reduce noise
          } else if (typeof currentValue === 'string') {
              const parsedValue = parseFloat(currentValue);
              if (!isNaN(parsedValue)) {
                  newValue = parsedValue;
                  // console.log(`🔄 Converted ${field} from string to number for rentalRequest ${docSnap.id}`); // Reduce noise
              } else {
                  newValue = 0;
                  console.log(`⚠️ Invalid ${field} string format ("${currentValue}"). Setting to 0 for rentalRequest ${docSnap.id}`);
              }
          } else if (typeof currentValue !== 'number') {
              newValue = 0;
              console.log(`⚠️ Unexpected type (${typeof currentValue}) for ${field}. Setting to 0 for rentalRequest ${docSnap.id}`);
          }

           if (newValue !== null && newValue !== currentValue) {
              updates[field] = newValue;
              fieldsUpdatedCount++;
              docNeedsUpdate = true;
          }
      });

      if (docNeedsUpdate) {
        batch.update(docSnap.ref, updates);
      }
    });
    if (fieldsUpdatedCount === 0) {
      console.log('✅ All cost fields in top-level rentalRequests are already in the correct format.');
      return;
    }
    await batch.commit();
    console.log(`🎉 Successfully updated ${fieldsUpdatedCount} cost field(s) in top-level rentalRequests.`);
  } catch (error) {
    console.error('❌ Error fixing cost fields in top-level rentalRequests:', error);
  }
};

/**
 * Update paymentStatus in top-level "rentalRequests" if rentalStatus is approved and paymentStatus needs update.
 */
const updatePaymentStatusInRentalRequests = async () => {
  console.log('🔄 Starting migration to update paymentStatus in top-level rentalRequests...');
  try {
    const rentalRequestsRef = db.collection('rentalRequests');
    const snapshot = await rentalRequestsRef
        .where('rentalStatus', '==', 'approved')
        .get();

    if (snapshot.empty) {
      console.log('ℹ️ No rentalRequests found with rentalStatus="approved".');
      return;
    }
    const batch = db.batch();
    let updateCount = 0;
    snapshot.docs.forEach((docSnap) => {
      const data = docSnap.data();
      if (data.paymentStatus !== "completed") {
          batch.update(docSnap.ref, { paymentStatus: "completed" });
          updateCount++;
          console.log(`🛠️ Updating paymentStatus to "completed" for rentalRequest ID: ${docSnap.id}`);
      }
    });
    if (updateCount === 0) {
      console.log('✅ All approved rentalRequests already have paymentStatus="completed".');
      return;
    }
    await batch.commit();
    console.log(`🎉 Successfully updated paymentStatus for ${updateCount} approved rentalRequest(s).`);
  } catch (error) {
    console.error('❌ Error updating paymentStatus in rentalRequests:', error);
    if (error.code === 'failed-precondition') {
        console.error('   Hint: This query might require a composite index in Firestore. Check the error details.');
    }
  }
};

/**
 * Migrate renter notifications: If related rentalRequest payment succeeded/completed,
 * update rentalRequest status to 'active' if needed, then delete the notification.
 */
const migrateNotificationsToActive = async () => {
  console.log('🔄 Starting migration for renter notifications...');
  try {
    const rentersSnapshot = await db.collection('renters').get();
    if (rentersSnapshot.empty) {
      console.log('ℹ️ No renter documents found.');
      return;
    }
    let totalNotificationsProcessed = 0;
    let notificationsDeleted = 0;
    let rentalStatusUpdatedCount = 0;

    for (const renterDoc of rentersSnapshot.docs) {
      const renterId = renterDoc.id;
      const notificationsRef = renterDoc.ref.collection('notifications');
      const notificationsSnapshot = await notificationsRef.get();

      if (notificationsSnapshot.empty) continue;

      for (const notifDoc of notificationsSnapshot.docs) {
        totalNotificationsProcessed++;
        const notifData = notifDoc.data();
        const rentalRequestId = notifData.rentalRequestId || notifData.rentalRequest || notifData.requestId;

        if (!rentalRequestId || typeof rentalRequestId !== 'string') {
          console.log(`ℹ️ Notification ${notifDoc.ref.path} lacks a valid rentalRequestId. Skipping.`);
          continue;
        }

        try {
            const rentalRequestRef = db.collection('rentalRequests').doc(rentalRequestId);
            const rentalRequestSnap = await rentalRequestRef.get();

            if (!rentalRequestSnap.exists) {
                console.warn(`⚠️ Rental request ${rentalRequestId} not found for notification ${notifDoc.ref.path}. Deleting notification.`);
                await notifDoc.ref.delete();
                notificationsDeleted++;
                continue;
            }

            const rentalData = rentalRequestSnap.data();
            const paymentCompleted = rentalData.paymentStatus === "succeeded" || rentalData.paymentStatus === "completed";

            if (paymentCompleted) {
                if (rentalData.rentalStatus !== "active") {
                    await rentalRequestRef.update({ rentalStatus: "active" });
                    rentalStatusUpdatedCount++;
                    console.log(`🛠️ Updated rental request ${rentalRequestId} status to 'active'.`);
                }
                await notifDoc.ref.delete();
                notificationsDeleted++;
                console.log(`🗑️ Deleted notification ${notifDoc.ref.path} (payment complete).`);
            }

        } catch (innerError) {
             console.error(`❌ Error processing notification ${notifDoc.ref.path} or rental request ${rentalRequestId}:`, innerError);
        }
      } // end loop notifications
    } // end loop renters

    console.log('\n=== Notification Migration Summary ===');
    console.log(`Processed ${totalNotificationsProcessed} notifications.`);
    console.log(`Updated ${rentalStatusUpdatedCount} rental requests to 'active'.`);
    console.log(`Deleted ${notificationsDeleted} notifications.`);
  } catch (error) {
    console.error('❌ Error migrating notifications:', error);
  }
};


/**
 * Add a Stripe Express account ID to each owner in 'owners' collection if missing.
 */
const addStripeAccountIdToOwners = async () => {
  console.log("🔄 Starting migration to add stripeAccountId to owners...");
  try {
    const ownersRef = db.collection("owners");
    const snapshot = await ownersRef.get();

    if (snapshot.empty) {
      console.log("ℹ️ No documents found in owners collection.");
      return;
    }

    const results = await Promise.allSettled(snapshot.docs.map(async (ownerDoc) => {
      const ownerData = ownerDoc.data();
      const ownerId = ownerDoc.id;
      const logPrefix = `Owner ID: ${ownerId}`;

      if (ownerData.stripeAccountId) {
        return { status: 'skipped', reason: 'already exists' };
      }

      if (!ownerData.email || typeof ownerData.email !== 'string' || !ownerData.email.includes('@')) {
        console.warn(`⚠️ ${logPrefix}: Invalid or missing email ("${ownerData.email || 'N/A'}"). Skipping Stripe account creation.`);
        return { status: 'skipped', reason: 'invalid email' };
      }

      try {
        console.log(`🛠️ ${logPrefix}: Creating Stripe Connected Account...`);
        const account = await stripe.accounts.create({
          type: "express",
          country: "US",
          email: ownerData.email.trim(),
          metadata: {
            ownerId: ownerId,
            firestoreDocPath: ownerDoc.ref.path,
            fullName: ownerData.fullName || '',
          },
          capabilities: {
                card_payments: {requested: true},
                transfers: {requested: true},
          },
        });

        if (account && account.id) {
          await ownerDoc.ref.update({
            stripeAccountId: account.id,
            stripeAccountStatus: account.charges_enabled ? 'enabled' : 'restricted',
            stripeDetailsSubmitted: account.details_submitted || false,
          });
          console.log(`✅ ${logPrefix}: Successfully created and assigned stripeAccountId: ${account.id}`);
          return { status: 'created', accountId: account.id };
        } else {
          console.warn(`⚠️ ${logPrefix}: Failed to retrieve account ID after creation. Skipping update.`);
           return { status: 'error', reason: 'creation failed silently' };
        }
      } catch (stripeError) {
        console.error(`❌ ${logPrefix}: Error creating Stripe account:`, stripeError.message);
        return { status: 'error', reason: stripeError.message };
      }
    })); // End Promise.allSettled

    // Summarize results
    let createdCount = 0;
    let skippedCount = 0;
    let errorCount = 0;
    results.forEach(result => {
        if (result.status === 'fulfilled') {
            if (result.value.status === 'created') createdCount++;
            else if (result.value.status === 'skipped') skippedCount++;
            else if (result.value.status === 'error') errorCount++;
        } else {
            console.error("💥 Unexpected rejection in Promise.allSettled:", result.reason);
            errorCount++;
        }
    });

    console.log('\n=== Stripe Account ID Migration Summary ===');
    console.log(`Processed ${snapshot.size} owner documents.`);
    console.log(`Created ${createdCount} new Stripe accounts.`);
    console.log(`Skipped ${skippedCount} owners (already had ID or invalid email).`);
    console.log(`Encountered errors for ${errorCount} owners.`);

  } catch (error) {
    console.error("❌ Error adding stripeAccountId to owners:", error);
  }
};

/**
 * Sync stripeAccountId from "owners" to "users" collection (matching doc IDs).
 */
const syncStripeAccountIdFromOwnersToUsers = async () => {
  console.log('🔄 Starting synchronization of stripeAccountId from owners to users...');
  try {
    const ownersSnapshot = await db.collection('owners').get();
    if (ownersSnapshot.empty) {
      console.log('ℹ️ No owners found to sync from.');
      return;
    }

    const batch = db.batch();
    let updateCount = 0;
    let notFoundCount = 0;

    for (const ownerDoc of ownersSnapshot.docs) {
      const ownerData = ownerDoc.data();
      const userId = ownerDoc.id;

      if (ownerData.stripeAccountId) {
        const userRef = db.collection('users').doc(userId);
        batch.set(
          userRef,
          {
            stripeAccountId: ownerData.stripeAccountId,
            stripeAccountStatus: ownerData.stripeAccountStatus || null,
            stripeDetailsSubmitted: ownerData.stripeDetailsSubmitted !== undefined ? ownerData.stripeDetailsSubmitted : null,
          },
          { merge: true }
        );
        updateCount++;
        // console.log(`✅ Prepared sync for user ${userId} with stripeAccountId: ${ownerData.stripeAccountId}`); // Reduce noise
      }
    }

    if (updateCount > 0) {
      await batch.commit();
      console.log(`🎉 Successfully synced stripeAccountId for ${updateCount} user document(s).`);
    } else {
      console.log('✅ No owner documents required Stripe ID synchronization to users.');
    }
    // Note: notFoundCount logic was commented out as set({merge:true}) handles creation.
  } catch (error) {
    console.error('❌ Error synchronizing stripeAccountId from owners to users:', error);
  }
};

/**
 * Update all 'users' documents to ensure role="both".
 */
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
      if (data.role !== 'both') {
        batch.update(docSnap.ref, { role: 'both' });
        updateCount++;
        console.log(`🛠️ Setting role to "both" for user doc ID: ${docSnap.id} (was: ${data.role || 'missing'})`);
      }
    });

    if (updateCount > 0) {
      await batch.commit();
      console.log(`🎉 Successfully updated ${updateCount} user doc(s) to have "role: both".`);
    } else {
      console.log('✅ All user docs already have role="both".');
    }
  } catch (error) {
    console.error('❌ Error updating user docs to role=both:', error);
  }
};

/**
 * Update all user documents to ensure profileType = "Both".
 */
const updateProfileTypeToBoth = async () => {
  console.log('🔄 Starting updateProfileTypeToBoth migration...');
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
      if (data.profileType !== 'Both') {
        batch.update(docSnap.ref, { profileType: 'Both' });
        updateCount++;
        console.log(`🛠️ Setting profileType to "Both" for user doc ID: ${docSnap.id} (was: ${data.profileType || 'missing'})`);
      }
    });

    if (updateCount > 0) {
      await batch.commit();
      console.log(`🎉 Successfully updated ${updateCount} user doc(s) to have profileType: "Both".`);
    } else {
      console.log('✅ All user docs already have profileType="Both".');
    }
  } catch (error) {
    console.error('❌ Error updating user docs to profileType="Both":', error);
  }
};


/**
 * Migrate top-level "rentalRequests" fields needed by renter view, ensuring they are strings.
 */
const migrateRenterRentalRequestsFields = async () => {
  console.log('🔄 Starting migration for renter-view fields in top-level rentalRequests...');
  try {
    const rentalRequestsRef = db.collection('rentalRequests');
    const snapshot = await rentalRequestsRef.get();
    if (snapshot.empty) {
      console.log('ℹ️ No documents found in top-level rentalRequests.');
      return;
    }
    const batch = db.batch();
    let fieldsUpdatedCount = 0;
    const fieldsToEnsureString = [
      'address', 'aircraftType', 'certifications', 'contact', 'currentLocation',
      'email', 'fcmToken', 'fullName', 'listingId', 'name',
      'rentalPeriod', 'renterId', 'status', // 'totalCost' conversion depends on usage, keep as number?
      'rentalDate', 'rentalStatus', 'ownerId'
    ];
    const numericFields = ['totalCost']; // Fields that should likely remain numbers

    snapshot.docs.forEach(docSnap => {
      const data = docSnap.data();
      const updates = {};
      let docNeedsUpdate = false;

      fieldsToEnsureString.forEach(field => {
        const currentValue = data[field];
        let newValue = null;

        if (currentValue === undefined || currentValue === null) {
           newValue = "";
           // console.log(`📝 Setting missing field '${field}' to "" in rentalRequest ${docSnap.id}.`); // Reduce noise
        } else if (typeof currentValue !== 'string') {
           newValue = String(currentValue);
           // console.log(`🔄 Converted field '${field}' in rentalRequest ${docSnap.id} to string (was ${typeof currentValue}).`); // Reduce noise
        }

        if (newValue !== null) {
            updates[field] = newValue;
            fieldsUpdatedCount++;
            docNeedsUpdate = true;
        }
      });

       // Add check for numeric fields if needed (example: ensure totalCost is number)
       numericFields.forEach(field => {
           const currentValue = data[field];
           let newValue = null;
           if (currentValue !== undefined && typeof currentValue !== 'number') {
                const parsed = parseFloat(currentValue);
                if (!isNaN(parsed)) {
                    newValue = parsed;
                    console.log(`🔄 Converted field '${field}' in rentalRequest ${docSnap.id} back to number.`);
                } else {
                    newValue = 0; // Or handle error differently
                    console.log(`⚠️ Could not convert field '${field}' to number in rentalRequest ${docSnap.id}. Setting to 0.`);
                }
           } else if (currentValue === undefined) {
               newValue = 0; // Default missing numeric fields to 0
           }
           if (newValue !== null && newValue !== currentValue) {
              updates[field] = newValue;
              fieldsUpdatedCount++;
              docNeedsUpdate = true;
          }
       });


      if (docNeedsUpdate) {
        batch.update(docSnap.ref, updates);
      }
    });

    if (fieldsUpdatedCount > 0) {
      await batch.commit();
      console.log(`🎉 Successfully performed ${fieldsUpdatedCount} field modifications for renter view in rentalRequests.`);
    } else {
      console.log('✅ All relevant rentalRequests fields already meet expected formats.');
    }
  } catch (error) {
    console.error('❌ Error migrating renter rentalRequests fields:', error);
  }
};


/**
 * Migrate 'listings' where category="Flight Schools": Move details into flightSchoolDetails object.
 */
const migrateFlightSchoolFields = async () => {
  console.log('🔄 Starting migration for Flight Schools listings structure...');
  try {
    const listingsRef = db.collection('listings');
    const snapshot = await listingsRef.where('category', '==', 'Flight Schools').get();
    if (snapshot.empty) {
      console.log('ℹ️ No Flight Schools listings found.');
      return;
    }
    const batch = db.batch();
    let updateCount = 0;
    snapshot.docs.forEach(doc => {
      const data = doc.data();
      let needsUpdate = false;

      const currentDetails = data.flightSchoolDetails;
      let updatedDetails = (typeof currentDetails === 'object' && currentDetails !== null && !Array.isArray(currentDetails))
                           ? { ...currentDetails }
                           : {};

      const fieldsToNest = [
          'flightSchoolName', 'flightSchoolLocation', 'flightSchoolEmail',
          'flightSchoolPhone', 'flightSchoolDescription'
      ];
      const updateData = {};

      fieldsToNest.forEach(field => {
          if (data[field] !== undefined) {
              if (updatedDetails[field] === undefined || updatedDetails[field] === '') {
                  updatedDetails[field] = typeof data[field] === 'string' ? data[field] : String(data[field]);
                  needsUpdate = true;
              }
              updateData[field] = admin.firestore.FieldValue.delete();
              needsUpdate = true;
          }
          if (updatedDetails[field] === undefined) {
               updatedDetails[field] = '';
               needsUpdate = true;
          }
      });

      if (needsUpdate || JSON.stringify(currentDetails) !== JSON.stringify(updatedDetails)) {
          updateData.flightSchoolDetails = updatedDetails;
          needsUpdate = true;
      }

      if (needsUpdate) {
        batch.update(doc.ref, updateData);
        updateCount++;
        console.log(`🛠️ Migrating structure for Flight Schools listing: ${doc.id}`);
      }
    });

     if (updateCount > 0) {
        await batch.commit();
        console.log(`🎉 Successfully migrated structure for ${updateCount} Flight Schools listing(s).`);
     } else {
        console.log('✅ All Flight Schools listings already seem to have the correct structure.');
     }
  } catch (error) {
    console.error('❌ Error migrating Flight Schools listings structure:', error);
  }
};


/**
 * Ensure 'listings' where category="Flight Instructors" have a 'profileImage' field (string).
 */
const migrateClassifiedsProfileImageField = async () => {
  console.log('🔄 Starting migration for "profileImage" field in Flight Instructors listings...');
  try {
    const listingsRef = db.collection('listings');
    const snapshot = await listingsRef.where('category', '==', 'Flight Instructors').get();
    if (snapshot.empty) {
      console.log('ℹ️ No Flight Instructors listings found.');
      return;
    }
    const batch = db.batch();
    let updateCount = 0;
    snapshot.docs.forEach(doc => {
      const data = doc.data();
      if (data.profileImage === undefined || data.profileImage === null) {
        batch.update(doc.ref, { profileImage: '' });
        updateCount++;
        console.log(`🛠️ Added/Reset profileImage field for Flight Instructor listing: ${doc.id}`);
      } else if (typeof data.profileImage !== 'string') {
         batch.update(doc.ref, { profileImage: String(data.profileImage) });
         updateCount++;
         console.log(`🔄 Ensured profileImage field is string for Flight Instructor listing: ${doc.id}`);
      }
    });
    if (updateCount > 0) {
      await batch.commit();
      console.log(`🎉 Successfully ensured profileImage field for ${updateCount} Flight Instructors listings.`);
    } else {
      console.log('✅ All Flight Instructors listings already have a profileImage field.');
    }
  } catch (error) {
    console.error('❌ Error migrating profileImage field in Flight Instructors listings:', error);
  }
};


/**
 * Ensure 'messages' have a 'participants' array including owner & renter from the related rentalRequest.
 */
const migrateMessagesParticipants = async () => {
  console.log('🔄 Starting migration for messages participants...');
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
      const rentalRequestId = data.rentalRequestId || data.rentalRequest || data.requestId;

      if (!rentalRequestId || typeof rentalRequestId !== 'string') {
        continue;
      }

      let currentParticipants = data.participants;
      if (!Array.isArray(currentParticipants)) {
          console.warn(`⚠️ Message ${docSnap.ref.path} has invalid 'participants' field (${typeof currentParticipants}). Resetting.`);
          currentParticipants = [];
      }

      try {
        const rentalRequestRef = db.collection('rentalRequests').doc(rentalRequestId);
        const rentalRequestSnap = await rentalRequestRef.get();

        if (rentalRequestSnap.exists) {
          const rentalData = rentalRequestSnap.data();
          const ownerId = rentalData.ownerId;
          const renterId = rentalData.renterId;

          if (ownerId && renterId) {
            let newParticipantsSet = new Set(currentParticipants);
            let changed = false;

            if (!newParticipantsSet.has(ownerId)) {
                newParticipantsSet.add(ownerId);
                changed = true;
            }
            if (!newParticipantsSet.has(renterId)) {
                newParticipantsSet.add(renterId);
                changed = true;
            }

            if (changed) {
              const newParticipantsArray = Array.from(newParticipantsSet);
              batch.update(docSnap.ref, { participants: newParticipantsArray });
              updateCount++;
              console.log(`🔄 Updated participants for message ${docSnap.ref.path} to include owner/renter.`);
            }
          } else {
            console.warn(`⚠️ Rental request ${rentalRequestId} missing ownerId or renterId for message ${docSnap.ref.path}`);
          }
        } else {
          console.warn(`⚠️ Rental request ${rentalRequestId} not found for message ${docSnap.ref.path}`);
        }
      } catch(innerError) {
           console.error(`❌ Error processing participants for message ${docSnap.ref.path}:`, innerError);
      }
    } // End loop messages

    if (updateCount > 0) {
      await batch.commit();
      console.log(`🎉 Successfully updated participants for ${updateCount} message document(s).`);
    } else {
      console.log('✅ No messages needed participant updates based on rental requests.');
    }
  } catch (error) {
    console.error('❌ Error migrating messages participants:', error);
  }
};


/**
 * Ensure each 'airplanes' document includes its own doc ID in the 'id' field.
 */
const migrateAirplaneDocumentIds = async () => {
  console.log('🔄 Starting migration to ensure airplane documents include their own ID...');
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
      if (data.id !== docSnap.id) {
        batch.update(docSnap.ref, { id: docSnap.id });
        updateCount++;
        console.log(`📝 Setting/Fixing document ID field for airplane: ${docSnap.id} (was: ${data.id || 'missing'})`);
      }
    });
    if (updateCount > 0) {
      await batch.commit();
      console.log(`🎉 Successfully set/fixed document ID field for ${updateCount} airplane document(s).`);
    } else {
      console.log('✅ All airplane documents already have a correct ID field.');
    }
  } catch (error) {
    console.error('❌ Error migrating airplane document IDs:', error);
  }
};


/**
 * Clean up orphaned listings in 'UserPost' collection and associated images in Storage.
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
    let firestoreDeletions = 0;
    let imagesToDelete = [];

    for (const listingDoc of listingsSnapshot.docs) {
      const listingData = listingDoc.data();
      const ownerId = listingData.ownerId;
      let isOrphaned = false;

      if (!ownerId || typeof ownerId !== 'string' || ownerId.trim() === '') {
        console.warn(`⚠️ Listing ${listingDoc.ref.path} is missing or has invalid 'ownerId'. Marking as orphaned.`);
        isOrphaned = true;
      } else {
         try {
            const ownerDoc = await db.collection('owners').doc(ownerId).get();
            if (!ownerDoc.exists) {
                console.warn(`⚠️ Orphaned Listing Found - ${listingDoc.ref.path}, Owner ID: ${ownerId} does not exist.`);
                isOrphaned = true;
            }
         } catch (ownerCheckError) {
              console.error(`❌ Error checking owner ${ownerId} for listing ${listingDoc.ref.path}:`, ownerCheckError);
              // Consider skipping instead of assuming orphaned on error
              // isOrphaned = true;
         }
      }

      if (isOrphaned) {
        batch.delete(listingDoc.ref);
        firestoreDeletions++;

        if (listingData.images && Array.isArray(listingData.images)) {
          listingData.images.forEach(imageUrl => {
            if (typeof imageUrl === 'string' && imageUrl.startsWith('https://firebasestorage.googleapis.com/')) {
                try {
                    const urlParts = new URL(imageUrl);
                    let filePath = decodeURIComponent(urlParts.pathname);
                    const bucketName = bucket.name;
                    const prefix = `/v0/b/${bucketName}/o/`;
                    if (filePath.startsWith(prefix)) {
                        filePath = filePath.substring(prefix.length);
                        imagesToDelete.push(filePath);
                    } else {
                        console.warn(`⚠️ Skipping image URL with unexpected path format in ${listingDoc.id}: ${imageUrl}`);
                    }
                } catch(urlError) {
                     console.warn(`⚠️ Skipping invalid image URL in ${listingDoc.id}: ${imageUrl}`, urlError);
                }
            }
          });
        }
      }
    } // End loop through listings

    if (firestoreDeletions > 0) {
        await batch.commit();
        console.log(`🎉 Successfully deleted ${firestoreDeletions} orphaned listing document(s) from UserPost.`);
    } else {
        console.log('✅ No orphaned listing documents found in UserPost.');
    }

    if (imagesToDelete.length > 0) {
        console.log(`🗑️ Attempting to delete ${imagesToDelete.length} associated image(s) from Storage...`);
        let imagesDeletedCount = 0;
        const imageDeletionResults = await Promise.allSettled(
            imagesToDelete.map(filePath => bucket.file(filePath).delete())
        );

        imageDeletionResults.forEach((result, index) => {
            if (result.status === 'fulfilled') {
                imagesDeletedCount++;
            } else {
                if (result.reason.code === 404) {
                    console.log(`ℹ️ Image not found (already deleted?): ${imagesToDelete[index]}`);
                } else {
                    console.error(`❌ Failed to delete image: ${imagesToDelete[index]}`, result.reason.message);
                }
            }
        });
         console.log(`🗑️ Successfully deleted ${imagesDeletedCount} image(s). Encountered ${imagesToDelete.length - imagesDeletedCount} errors/missing files.`);
    } else if (firestoreDeletions > 0) {
        console.log('ℹ️ No associated images found or collected for deletion from Storage.');
    }

  } catch (error) {
    console.error('❌ Error during cleanup of orphaned listings:', error);
  }
};


/**
 * Migrate the 'listings' collection for general field compliance (images, category, packageType, createdAt, publiclyViewable).
 */
const migrateClassifiedsListings = async () => {
  console.log('🔄 Starting migration for general field compliance in "listings" collection...');
  try {
    const listingsRef = db.collection('listings');
    const snapshot = await listingsRef.get();
    if (snapshot.empty) {
      console.log('ℹ️ No documents found in "listings" collection.');
      return;
    }

    const batch = db.batch();
    let updatedDocsCount = 0;
    let fieldsFixedCount = 0;

    for (const docSnap of snapshot.docs) {
      const data = docSnap.data();
      const docRef = docSnap.ref;
      const updates = {};
      let needsUpdate = false;

      // Ensure 'images' is an array
      if (!Array.isArray(data.images)) {
        updates.images = []; needsUpdate = true; fieldsFixedCount++;
        console.log(`🛠️ Resetting 'images' to array for listing ${docRef.id}`);
      }
      // Ensure 'category' is a non-empty string
      if (!data.category || typeof data.category !== 'string' || data.category.trim() === '') {
        updates.category = 'Uncategorized'; needsUpdate = true; fieldsFixedCount++;
         console.log(`🛠️ Setting 'category' to 'Uncategorized' for listing ${docRef.id}`);
      }
      // Ensure 'packageType' is a non-empty string
      if (!data.packageType || typeof data.packageType !== 'string' || data.packageType.trim() === '') {
        updates.packageType = 'Basic'; needsUpdate = true; fieldsFixedCount++;
        console.log(`🛠️ Setting 'packageType' to 'Basic' for listing ${docRef.id}`);
      }
      // Ensure 'createdAt' is a Firestore Timestamp
      if (!(data.createdAt instanceof admin.firestore.Timestamp)) {
         console.warn(`⚠️ Listing ${docRef.id} has invalid 'createdAt'. Setting to server timestamp.`);
         updates.createdAt = admin.firestore.FieldValue.serverTimestamp();
         needsUpdate = true; fieldsFixedCount++;
      }
      // Ensure 'publiclyViewable' is a boolean
      if (typeof data.publiclyViewable !== 'boolean') {
         updates.publiclyViewable = true; // Default to true
         needsUpdate = true; fieldsFixedCount++;
          console.log(`🛠️ Setting 'publiclyViewable' to true for listing ${docRef.id}`);
      }

      if (needsUpdate) {
        batch.update(docRef, updates);
        updatedDocsCount++;
      }
    }

    if (updatedDocsCount > 0) {
      await batch.commit();
      console.log(`🎉 Successfully updated ${updatedDocsCount} listing(s) fixing ${fieldsFixedCount} fields for general compliance.`);
    } else {
      console.log('✅ All listings already meet general field compliance checks.');
    }
  } catch (error) {
    console.error('❌ Error migrating "listings" for general compliance:', error);
  }
};

// This function is redundant if migrateClassifiedsListings ensures the publiclyViewable field.
// Kept for reference but commented out from execution flow.
/**
 * DEPRECATED by migrateClassifiedsListings: Ensure 'publiclyViewable' field exists and is boolean.
 */
/*
const addPubliclyViewableFieldToListings = async () => {
  console.log('🔄 Starting migration to add "publiclyViewable: true" to "listings" collection...');
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
      console.log('✅ All listings already have a publiclyViewable boolean field set.');
    }
  } catch (error) {
    console.error('❌ Error adding publiclyViewable field to listings:', error);
  }
};
*/

/**
 * Migrate Charter Services Data from JSON file to 'charterServices' collection.
 */
const migrateCharterServicesData = async () => {
  console.log('🔄 Starting migration for Charter Services data...');
  const charterServicesFilePath = path.join(__dirname, 'charterServicesData.json');

  if (!fs.existsSync(charterServicesFilePath)) {
    console.warn('⚠️ charterServicesData.json file not found. Skipping Charter Services data migration.');
    return;
  }

  try {
    const fileContent = fs.readFileSync(charterServicesFilePath, 'utf-8');
    const charterServicesData = JSON.parse(fileContent);

    if (!Array.isArray(charterServicesData)) {
      console.error('❌ Invalid format: charterServicesData.json should contain an array of records.');
      return;
    }

    const batch = db.batch();
    const collectionRef = db.collection('charterServices');
    let count = 0;

    for (const record of charterServicesData) {
      let docRef;
      let docId;

      if (record.id && typeof record.id === 'string' && record.id.trim() !== '') {
        docId = record.id.trim();
        docRef = collectionRef.doc(docId);
      } else {
        docRef = collectionRef.doc();
        docId = docRef.id;
        console.log(`ℹ️ Record missing valid 'id'. Generated new document ID: ${docId}`);
      }

      const firestoreData = {
        id: docId,
        companyName: typeof record.companyName === 'string' ? record.companyName.trim() : '',
        servicesOffered: typeof record.servicesOffered === 'string' ? record.servicesOffered.trim() : '',
        contactInfo: {
          email: typeof record.contactInfo?.email === 'string' ? record.contactInfo.email.trim() : (typeof record.email === 'string' ? record.email.trim() : ''),
          phone: typeof record.contactInfo?.phone === 'string' ? record.contactInfo.phone.trim() : (typeof record.phone === 'string' ? record.phone.trim() : ''),
          website: typeof record.contactInfo?.website === 'string' ? record.contactInfo.website.trim() : (typeof record.website === 'string' ? record.website.trim() : ''),
        },
        location: {
          address: typeof record.location?.address === 'string' ? record.location.address.trim() : (typeof record.address === 'string' ? record.address.trim() : ''),
          city: typeof record.location?.city === 'string' ? record.location.city.trim() : '',
          state: typeof record.location?.state === 'string' ? record.location.state.trim() : '',
          zipCode: typeof record.location?.zipCode === 'string' ? record.location.zipCode.trim() : '',
          country: typeof record.location?.country === 'string' ? record.location.country.trim() : 'US',
        },
        aircraftTypes: Array.isArray(record.aircraftTypes)
          ? record.aircraftTypes
              .map(item => typeof item === 'string' ? item.trim() : null)
              .filter(item => item !== null && item !== '')
          : [],
        description: typeof record.description === 'string' ? record.description.trim() : '',
        migratedAt: admin.firestore.FieldValue.serverTimestamp(),
        // createdAt: admin.firestore.FieldValue.serverTimestamp(), // Uncomment if overwrite desired
      };

      // Optional: Remove empty nested objects
      if (Object.values(firestoreData.contactInfo).every(val => val === '')) {
          delete firestoreData.contactInfo;
      }
      if (Object.values(firestoreData.location).every(val => val === '' || val === 'US')) {
          delete firestoreData.location;
      }

      batch.set(docRef, firestoreData, { merge: true });
      count++;
    }

    if (count > 0) {
      await batch.commit();
      console.log(`🎉 Successfully migrated/updated ${count} Charter Services record(s) to Firestore.`);
    } else {
      console.log('✅ No Charter Services records found in the JSON file.');
    }
  } catch (error) {
    console.error('❌ Error migrating Charter Services data:', error);
     if (error instanceof SyntaxError) {
       console.error('   -> Check charterServicesData.json for JSON syntax errors.');
    }
  }
};


// ====================
// Audit and Dynamic Schema Management Functions (Corrected for SyntaxError)
// ====================

/**
 * Recursively traverse a collection and its subcollections for audit.
 */
const traverseCollection = async (collectionRef, parentPath = '') => {
  const snapshot = await collectionRef.get();
  const data = [];

  for (const doc of snapshot.docs) {
    const docData = doc.data();
    // Construct full path including collection name
    const docPath = parentPath ? `${parentPath}/${collectionRef.id}/${doc.id}` : `${collectionRef.id}/${doc.id}`;
    const docInfo = {
      id: doc.id,
      path: docPath,
      data: docData,
      ref: doc.ref,
      subcollectionsData: null,
    };

    try {
        const subcollections = await doc.ref.listCollections();
        if (subcollections.length > 0) {
            docInfo.subcollectionsData = {};
            for (const subcol of subcollections) {
                // Pass the document path as the new parent path for the subcollection
                docInfo.subcollectionsData[subcol.id] = await traverseCollection(subcol, docPath);
            }
        }
    } catch (subError) {
        console.error(`❌ Error listing/traversing subcollections for ${docPath}:`, subError);
    }
    data.push(docInfo);
  }
  return data;
};

/**
 * Analyze a document against its expected schema (handles subcollection paths).
 */
const analyzeDocument = (collectionPath, docData, docPath) => {
    // Derive schema name from the potentially nested collection path
    // e.g., "owners/docId/rentalRequests" -> schema name "rentalRequests"
    // e.g., "users" -> schema name "users"
    const pathSegments = collectionPath.split('/');
    const schemaName = pathSegments[pathSegments.length - 1]; // Use the last segment as schema key
    const schema = expectedSchemas[schemaName];
    const issues = [];

    if (!schema) {
        console.log(`🔍 Schema not found for '${schemaName}' (derived from path ${collectionPath}). Add to schemas.json?`);
        return [`⚠️ Schema definition missing for '${schemaName}'`];
    }

    const expectedFields = schema.fields || {};

    // Check for missing fields
    for (const field in expectedFields) {
        if (!(field in docData)) {
            issues.push(`❗ Missing field '${field}' (expected type: ${expectedFields[field]})`);
        } else {
            // Check type mismatches
            const expectedType = expectedFields[field];
            const actualType = inferDataType(docData[field]);

            if (expectedType === 'timestamp') {
                if (!(docData[field] instanceof admin.firestore.Timestamp)) {
                    issues.push(`❗ Type mismatch for '${field}': expected 'timestamp', got '${actualType}' in ${docPath}`);
                }
            } else if (expectedType === 'geopoint') {
                if (!(docData[field] instanceof admin.firestore.GeoPoint)) {
                    issues.push(`❗ Type mismatch for '${field}': expected 'geopoint', got '${actualType}' in ${docPath}`);
                }
            } else if (expectedType === 'array') {
                if (!Array.isArray(docData[field])) {
                    issues.push(`❗ Type mismatch for '${field}': expected 'array', got '${actualType}' in ${docPath}`);
                }
            } else if (actualType !== expectedType && expectedType !== 'any') {
                 if ((expectedType === 'integer' && actualType === 'number' && !Number.isInteger(docData[field]))) {
                     issues.push(`❗ Type mismatch for '${field}': expected 'integer', got 'number' (float) in ${docPath}`);
                 } else if (!(expectedType === 'integer' && actualType === 'number')) {
                    issues.push(`❗ Type mismatch for '${field}': expected '${expectedType}', got '${actualType}' in ${docPath}`);
                 }
            }
        }
    }

    // Check for unexpected fields
    for (const field in docData) {
        if (!(field in expectedFields)) {
            issues.push(`⚠️ Unexpected field '${field}' (type: ${inferDataType(docData[field])}) in ${docPath}`);
        }
    }

    return issues;
};


/**
 * Infer data type for schema comparison/generation.
 */
const inferDataType = (value) => {
  if (value === null) return 'null';
  if (value instanceof admin.firestore.Timestamp) return 'timestamp';
  if (value instanceof admin.firestore.GeoPoint) return 'geopoint';
  if (Array.isArray(value)) return 'array';
  const type = typeof value;
  if (type === 'number') {
      return Number.isInteger(value) ? 'integer' : 'number';
  }
  return type;
};

/**
 * Fix missing fields by adding default values based on schema.
 */
const fixMissingFields = async (collectionPath, docRef, field) => {
  if (!docRef || typeof docRef.update !== 'function') {
    console.error(`❌ Invalid DocumentReference for field '${field}' in path '${collectionPath}'. Skipping update.`);
    return;
  }
  const pathSegments = collectionPath.split('/');
  const schemaName = pathSegments[pathSegments.length - 1];
  const fieldType = expectedSchemas[schemaName]?.fields[field];
  let defaultValue;

  switch (fieldType) {
      case 'string': defaultValue = ''; break;
      case 'number': defaultValue = 0; break;
      case 'integer': defaultValue = 0; break;
      case 'boolean': defaultValue = false; break;
      case 'array': defaultValue = []; break;
      case 'object': defaultValue = {}; break;
      case 'timestamp': defaultValue = admin.firestore.FieldValue.serverTimestamp(); break;
      case 'geopoint': defaultValue = new admin.firestore.GeoPoint(0, 0); break;
      case 'null': defaultValue = null; break;
      default:
          console.warn(`⚠️ Cannot fix missing field '${field}' in ${docRef.path}: No default value defined or unknown type '${fieldType}'.`);
          return;
  }

  try {
    await docRef.update({ [field]: defaultValue });
    console.log(`🛠️ Fixed missing field '${field}' in ${docRef.path}. Set to default value.`);
  } catch (updateError) {
    console.error(`❌ Failed to fix missing field '${field}' in ${docRef.path}:`, updateError);
  }
};

/**
 * Remove unexpected fields (Use with caution!).
 */
const removeUnexpectedFields = async (collectionPath, docRef, field) => {
  if (!docRef || typeof docRef.update !== 'function') {
    console.error(`❌ Invalid DocumentReference for field '${field}' in path '${collectionPath}'. Skipping removal.`);
    return;
  }
  try {
    await docRef.update({ [field]: admin.firestore.FieldValue.delete() });
    console.log(`🗑️ Removed unexpected field '${field}' from document ${docRef.path}.`);
  } catch (removeError) {
    console.error(`❌ Failed to remove field '${field}' from document ${docRef.path}:`, removeError);
  }
};

/**
 * Add a newly discovered field to the schema file.
 */
const addFieldToSchema = async (collectionPath, field, value) => {
   const pathSegments = collectionPath.split('/');
   const schemaName = pathSegments[pathSegments.length - 1];

  if (!expectedSchemas[schemaName]) {
    expectedSchemas[schemaName] = { fields: {} };
    console.log(`🆕 Detected new collection schema '${schemaName}' and added to schemas.`);
  } else if (!expectedSchemas[schemaName].fields) {
     expectedSchemas[schemaName].fields = {};
  }

  if (!expectedSchemas[schemaName].fields[field]) {
      const inferredType = inferDataType(value);
      expectedSchemas[schemaName].fields[field] = inferredType;
      console.log(`🆕 Added new field '${field}' (type: '${inferredType}') to schema for '${schemaName}'.`);
      saveSchemas(); // Save updated schema immediately
  }
};

/**
 * Run the audit process, report issues, and apply fixes based on flags.
 */
const generateAuditReportAndFix = async () => {
  console.log('\n🔍 Starting Firestore Audit and Fixes...');
  const FIX_MISSING = true;
  const ADD_UNEXPECTED_TO_SCHEMA = true;
  const REMOVE_UNEXPECTED = false;

  try {
    const rootCollections = await db.listCollections();
    const report = {
      auditTimestamp: new Date().toISOString(),
      summary: {
        totalCollections: 0,
        totalDocuments: 0,
        totalIssues: 0,
        issuesByType: {},
        collectionsAudited: [],
      },
      details: {},
    };
    const processedCollectionPaths = new Set();

    for (const collection of rootCollections) {
        // Start recursive processing from root collections
        await processCollectionForAudit(collection, '', report, processedCollectionPaths, {
             FIX_MISSING, ADD_UNEXPECTED_TO_SCHEMA, REMOVE_UNEXPECTED
         });
    }

    console.log('\n📊 Audit Report Summary:');
    console.log(`- Audited At: ${report.auditTimestamp}`);
    console.log(`- Total Collections Audited: ${report.summary.collectionsAudited.length}`);
    console.log(`- Total Documents Audited: ${report.summary.totalDocuments}`);
    console.log(`- Total Issues Found: ${report.summary.totalIssues}`);

    if (report.summary.totalIssues > 0) {
      console.log('\n🛠️ Issues Breakdown by Type:');
      const sortedIssueTypes = Object.entries(report.summary.issuesByType).sort(([, countA], [, countB]) => countB - countA);
      for (const [issueType, count] of sortedIssueTypes) {
          console.log(`   - ${issueType}: ${count}`);
      }
      const reportFileName = `firestore_audit_report_${Date.now()}.json`;
      fs.writeFileSync(reportFileName, JSON.stringify(report, null, 2));
      console.log(`\n📄 Detailed report saved to ${reportFileName}`);
    } else {
      console.log('🎉 No issues found. Your Firestore database appears consistent with the schemas!');
    }
  } catch (error) {
    console.error('❌ Error during audit process:', error);
  }
};


/**
 * Helper function to process a single collection (and its subcollections) for the audit.
 */
async function processCollectionForAudit(collectionRef, parentDocPath, report, processedPaths, flags) {
    // Construct the collection path: e.g., "owners" or "owners/docId/rentalRequests"
    const collectionPath = parentDocPath ? `${parentDocPath}/${collectionRef.id}` : collectionRef.id;

    if (processedPaths.has(collectionPath)) return;
    processedPaths.add(collectionPath);

    console.log(`\n📁 Processing collection/subcollection: ${collectionPath}`);
    report.summary.totalCollections += 1;
    report.summary.collectionsAudited.push(collectionPath);
    if (!report.details[collectionPath]) {
         report.details[collectionPath] = { documentsWithIssues: [] };
    }

    const snapshot = await collectionRef.get();

    for (const doc of snapshot.docs) {
        // Full document path: e.g., "owners/docId" or "owners/docId/rentalRequests/reqId"
        const docPath = `${collectionPath}/${doc.id}`;
        report.summary.totalDocuments += 1;
        const docData = doc.data();
        // Analyze using the collection path to find the correct schema
        const issues = analyzeDocument(collectionPath, docData, docPath);

        if (issues.length > 0) {
            report.details[collectionPath].documentsWithIssues.push({
                path: docPath,
                id: doc.id,
                issues: issues,
            });
            report.summary.totalIssues += issues.length;

            // Use for...of to handle awaits correctly during fixes
            for (const issue of issues) {
                const issueType = issue.split(':')[0].trim();
                report.summary.issuesByType[issueType] = (report.summary.issuesByType[issueType] || 0) + 1;

                const fieldMatch = issue.match(/'([^']+)'/);
                const field = fieldMatch ? fieldMatch[1] : null;

                if (field) {
                    if (issue.startsWith('❗ Missing field') && flags.FIX_MISSING) {
                        await fixMissingFields(collectionPath, doc.ref, field); // Pass collectionPath
                    } else if (issue.startsWith('⚠️ Unexpected field')) {
                        if (flags.ADD_UNEXPECTED_TO_SCHEMA) {
                            await addFieldToSchema(collectionPath, field, docData[field]); // Pass collectionPath
                        }
                        if (flags.REMOVE_UNEXPECTED) {
                            console.warn(`🔥 Removing unexpected field '${field}' from ${docPath} based on REMOVE_UNEXPECTED flag.`);
                            await removeUnexpectedFields(collectionPath, doc.ref, field); // Pass collectionPath
                        }
                    }
                }
            }
        }

        // Process Subcollections Recursively
        try {
            const subcollections = await doc.ref.listCollections();
            for (const subcol of subcollections) {
                // The new parent path for the subcollection is the current document's path
                await processCollectionForAudit(subcol, docPath, report, processedPaths, flags);
            }
        } catch (subError) {
             console.error(`❌ Error listing/traversing subcollections under ${docPath}:`, subError);
        }
    }
}


// ====================
// Execution Flow
// ====================
const runMigrationsAndAudit = async () => {
  console.log('🚀 Migration and Audit script started.');

  // --- Perform Migrations ---
  console.log('\n--- Running Data Migrations ---');
  await migrateAirplanesFields();
  await migrateRentalRequestIds();
  await fixRentalHoursAndCostPerHour();
  await fixRentalCostFields();
  await updatePaymentStatusInRentalRequests();
  await migrateNotificationsToActive();
  await addStripeAccountIdToOwners();
  await syncStripeAccountIdFromOwnersToUsers();
  await updateUserRoleToBoth();
  await updateProfileTypeToBoth();
  await migrateRenterRentalRequestsFields();
  // Combined listing migrations
  await migrateFlightSchoolFields();
  await migrateClassifiedsProfileImageField();
  await migrateClassifiedsListings(); // Includes publiclyViewable check
  // await addPubliclyViewableFieldToListings(); // Commented out as redundant
  // Other migrations
  await migrateMessagesParticipants();
  await migrateAirplaneDocumentIds();
  await cleanupOrphanedListings();
  await migrateCharterServicesData();

  // --- Perform Audit and Dynamic Schema Management ---
   console.log('\n--- Running Firestore Audit & Fixes ---');
   await generateAuditReportAndFix();

  console.log('\n🏁 Migration and Audit script completed.');
  process.exit(0); // Success
};

// Execute the script
runMigrationsAndAudit().catch((error) => {
  console.error('\n❌ Migration and Audit script encountered a critical error:', error);
  process.exit(1); // Failure
});