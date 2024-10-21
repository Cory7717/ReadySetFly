const functions = require('firebase-functions');
const admin = require('firebase-admin');
admin.initializeApp();

exports.cleanupOrphanedRentalRequests = functions.https.onRequest(async (req, res) => {
  // Only allow POST requests for security
  if (req.method !== 'POST') {
    return res.status(405).send('Method Not Allowed');
  }

  try {
    const db = admin.firestore();
    const ownersSnapshot = await db.collection('owners').get();
    let totalDeletions = 0;

    // Iterate through each owner
    for (const ownerDoc of ownersSnapshot.docs) {
      const ownerId = ownerDoc.id;
      const rentalRequestsRef = db.collection('owners').doc(ownerId).collection('rentalRequests');
      const rentalRequestsSnapshot = await rentalRequestsRef.get();

      // Iterate through each rental request
      for (const requestDoc of rentalRequestsSnapshot.docs) {
        const requestData = requestDoc.data();
        const renterId = requestData.renterId;

        if (!renterId) {
          // If renterId is missing, delete the rental request
          await requestDoc.ref.delete();
          totalDeletions++;
          console.log(`Deleted rental request ${requestDoc.id} for owner ${ownerId} due to missing renterId.`);
          continue;
        }

        const renterDocRef = db.collection('renters').doc(renterId);
        const renterDoc = await renterDocRef.get();

        if (!renterDoc.exists) {
          // If renter does not exist, delete the rental request
          await requestDoc.ref.delete();
          totalDeletions++;
          console.log(`Deleted rental request ${requestDoc.id} for owner ${ownerId} as renterId ${renterId} does not exist.`);
        }
      }
    }

    res.status(200).send(`Cleanup complete. Total deletions: ${totalDeletions}`);
  } catch (error) {
    console.error('Error during cleanup:', error);
    res.status(500).send('Internal Server Error');
  }
});
