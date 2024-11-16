// migration.js

const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

// Path to your service account key
const serviceAccountPath = path.join(__dirname, 'serviceAccountKey.json');

// Initialize Firebase Admin SDK with Service Account
if (fs.existsSync(serviceAccountPath)) {
  admin.initializeApp({
    credential: admin.credential.cert(require(serviceAccountPath)),
  });
  console.log('✅ Initialized Firebase Admin with service account.');
} else {
  console.error('❌ Service account key file not found at:', serviceAccountPath);
  process.exit(1);
}

const db = admin.firestore();

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
      status: 'string',
      rentalPeriod: 'string',
      renterName: 'string',
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
      createdAt: 'timestamp',
      images: 'array',
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
      availableDates: 'array',
      airplaneYear: 'number',
      userEmail: 'string',
      airplaneID: 'string',
      aircraftModel: 'string',
      tailNumber: 'string',
      engineType: 'string',
      totalTimeOnFrame: 'number',
      airportIdentifier: 'string',
      mainImage: 'string',
      documents: 'array',
      insuranceDocuments: 'array',
      boostListing: 'boolean',
      airplaneId: 'string',
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
    const docPath = `${parentPath}/${doc.id}`;
    const docInfo = {
      id: doc.id,
      path: docPath,
      data: docData,
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
        const actualType = typeof docData[field];
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
      status: 'pending',
      rentalPeriod: '',
      renterName: '',
      rentalCost: 0,
      transactionFee: 0,
      bookingFee: 0,
      salesTax: 0,
      totalCost: 0,
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
