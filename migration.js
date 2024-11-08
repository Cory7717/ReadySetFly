// migration.js

const admin = require('firebase-admin');

admin.initializeApp({
  credential: admin.credential.applicationDefault(),
});

const db = admin.firestore();

const migrateFields = async () => {
  const airplanesRef = db.collection('airplanes');
  const snapshot = await airplanesRef.get();

  snapshot.forEach(async (doc) => {
    const data = doc.data();
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
      try {
        await doc.ref.update(updates);
        console.log(`Updated document ${doc.id} with numeric fields.`);
      } catch (error) {
        console.error(`Error updating document ${doc.id}:`, error);
      }
    }
  });
};

migrateFields().then(() => {
  console.log('Migration complete.');
  process.exit(0);
}).catch((error) => {
  console.error('Migration failed:', error);
  process.exit(1);
});
