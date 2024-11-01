// // frontend/src/services/firebaseServices.js

// import axios from 'axios';
// import { getAuth } from 'firebase/auth';
// import { app } from '../config/firebaseConfig';

// // Initialize Firebase Auth
// const auth = getAuth(app);

// // Backend API Base URL
// const API_BASE_URL = 'https://us-central1-ready-set-fly-71506.cloudfunctions.net/api'; // Replace with your actual backend URL

// // Create an axios instance with default configurations
// const axiosInstance = axios.create({
//   baseURL: API_BASE_URL,
//   timeout: 10000, // 10 seconds timeout
// });

// // Helper function to retrieve the current user's ID token
// const getIdToken = async () => {
//   const user = auth.currentUser;
//   if (user) {
//     return await user.getIdToken(true); // Force refresh to get the latest token
//   }
//   throw new Error('User is not authenticated');
// };

// // Request interceptor to add the Authorization header to every request
// axiosInstance.interceptors.request.use(
//   async (config) => {
//     try {
//       const token = await getIdToken();
//       config.headers.Authorization = `Bearer ${token}`;
//       return config;
//     } catch (error) {
//       console.error('Error fetching ID token:', error.message);
//       throw error;
//     }
//   },
//   (error) => Promise.reject(error)
// );

// /**
//  * Service Function: Validate Discount Code
//  * Endpoint: POST /validateDiscount
//  *
//  * @param {string} discountCode - The discount code to validate.
//  * @param {number} amount - The original amount before discount.
//  * @returns {object} - Response data containing validation result and adjusted amount.
//  */
// export const validateDiscount = async (discountCode, amount) => {
//   try {
//     const response = await axiosInstance.post('/validateDiscount', {
//       discountCode,
//       amount,
//     });
//     return response.data;
//   } catch (error) {
//     console.error('Error validating discount:', error.response?.data || error.message);
//     throw error.response?.data || error;
//   }
// };

// /**
//  * Service Function: Create Connected Stripe Account
//  * Endpoint: POST /create-connected-account
//  *
//  * @param {object} accountDetails - Details required to create a connected account.
//  * @returns {object} - Response data containing account creation details.
//  */
// export const createConnectedAccount = async (accountDetails) => {
//   try {
//     const response = await axiosInstance.post('/create-connected-account', accountDetails);
//     return response.data;
//   } catch (error) {
//     console.error('Error creating connected account:', error.response?.data || error.message);
//     throw error.response?.data || error;
//   }
// };

// /**
//  * Service Function: Create Payment Intent for Classifieds
//  * Endpoint: POST /create-classified-payment-intent
//  *
//  * @param {object} paymentData - Data required to create a payment intent.
//  * @returns {object} - Response data containing the client secret.
//  */
// export const createClassifiedPaymentIntent = async (paymentData) => {
//   try {
//     const response = await axiosInstance.post('/create-classified-payment-intent', paymentData);
//     return response.data;
//   } catch (error) {
//     console.error('Error creating classified payment intent:', error.response?.data || error.message);
//     throw error.response?.data || error;
//   }
// };

// /**
//  * Service Function: Create Payment Intent for Rentals
//  * Endpoint: POST /create-rental-payment-intent
//  *
//  * @param {object} paymentData - Data required to create a rental payment intent.
//  * @returns {object} - Response data containing the client secret.
//  */
// export const createRentalPaymentIntent = async (paymentData) => {
//   try {
//     const response = await axiosInstance.post('/create-rental-payment-intent', paymentData);
//     return response.data;
//   } catch (error) {
//     console.error('Error creating rental payment intent:', error.response?.data || error.message);
//     throw error.response?.data || error;
//   }
// };

// /**
//  * Service Function: Attach Bank Account
//  * Endpoint: POST /attach-bank-account
//  *
//  * @param {object} bankAccountData - Data required to attach a bank account.
//  * @returns {object} - Response data containing attachment details.
//  */
// export const attachBankAccount = async (bankAccountData) => {
//   try {
//     const response = await axiosInstance.post('/attach-bank-account', bankAccountData);
//     return response.data;
//   } catch (error) {
//     console.error('Error attaching bank account:', error.response?.data || error.message);
//     throw error.response?.data || error;
//   }
// };

// /**
//  * Service Function: Create Listing
//  * Endpoint: POST /createListing
//  *
//  * @param {object} listingDetails - Details of the listing to create.
//  * @returns {object} - Response data containing the newly created listing ID.
//  */
// export const createListing = async (listingDetails) => {
//   try {
//     const response = await axiosInstance.post('/createListing', { listingDetails });
//     return response.data;
//   } catch (error) {
//     console.error('Error creating listing:', error.response?.data || error.message);
//     throw error.response?.data || error;
//   }
// };

// /**
//  * Service Function: Withdraw Funds
//  * Endpoint: POST /withdraw-funds
//  *
//  * @param {object} withdrawData - Data required to initiate a withdrawal.
//  * @returns {object} - Response data containing withdrawal confirmation.
//  */
// export const withdrawFunds = async (withdrawData) => {
//   try {
//     const response = await axiosInstance.post('/withdraw-funds', withdrawData);
//     return response.data;
//   } catch (error) {
//     console.error('Error withdrawing funds:', error.response?.data || error.message);
//     throw error.response?.data || error;
//   }
// };

// /**
//  * Service Function: Get Firebase User Information
//  * Endpoint: GET /firebase-user/:uid
//  *
//  * @param {string} uid - The UID of the Firebase user.
//  * @returns {object} - Response data containing sanitized user information.
//  */
// export const getFirebaseUser = async (uid) => {
//   try {
//     const response = await axiosInstance.get(`/firebase-user/${uid}`);
//     return response.data;
//   } catch (error) {
//     console.error('Error fetching Firebase user:', error.response?.data || error.message);
//     throw error.response?.data || error;
//   }
// };

// /**
//  * Service Function: Cleanup Orphaned Rental Requests (Admin Only)
//  * Endpoint: POST /admin/cleanupOrphanedRentalRequests
//  *
//  * @returns {object} - Response data containing cleanup results.
//  */
// export const cleanupOrphanedRentalRequests = async () => {
//   try {
//     const response = await axiosInstance.post('/admin/cleanupOrphanedRentalRequests', {});
//     return response.data;
//   } catch (error) {
//     console.error('Error cleaning up orphaned rental requests:', error.response?.data || error.message);
//     throw error.response?.data || error;
//   }
// };

// /**
//  * Service Function: Create Rental Request
//  * Endpoint: POST /createRentalRequest (Assuming you have such an endpoint)
//  *
//  * @param {object} rentalData - Data required to create a rental request.
//  * @returns {object} - Response data containing rental request details.
//  */
// export const createRentalRequest = async (rentalData) => {
//   try {
//     const response = await axiosInstance.post('/createRentalRequest', rentalData);
//     return response.data;
//   } catch (error) {
//     console.error('Error creating rental request:', error.response?.data || error.message);
//     throw error.response?.data || error;
//   }
// };

// /**
//  * Service Function: Approve Rental Request (Assuming you have such an endpoint)
//  * Endpoint: POST /approveRentalRequest (Not present in your server.js, but shown for completeness)
//  *
//  * @param {object} approvalData - Data required to approve a rental request.
//  * @returns {object} - Response data confirming approval.
//  */
// export const approveRentalRequest = async (approvalData) => {
//   try {
//     const response = await axiosInstance.post('/approveRentalRequest', approvalData);
//     return response.data;
//   } catch (error) {
//     console.error('Error approving rental request:', error.response?.data || error.message);
//     throw error.response?.data || error;
//   }
// };

// /**
//  * Service Function: Send Message (Assuming you have such an endpoint)
//  * Endpoint: POST /sendMessage (Not present in your server.js, but shown for completeness)
//  *
//  * @param {object} messageData - Data required to send a message.
//  * @returns {object} - Response data confirming message sending.
//  */
// export const sendMessage = async (messageData) => {
//   try {
//     const response = await axiosInstance.post('/sendMessage', messageData);
//     return response.data;
//   } catch (error) {
//     console.error('Error sending message:', error.response?.data || error.message);
//     throw error.response?.data || error;
//   }
// };

// /**
//  * Service Function: Fetch Messages (Assuming you have such an endpoint)
//  * Endpoint: GET /messages/:chatThreadId (Not present in your server.js, but shown for completeness)
//  *
//  * @param {string} chatThreadId - The ID of the chat thread to fetch messages from.
//  * @returns {object} - Response data containing messages.
//  */
// export const fetchMessages = async (chatThreadId) => {
//   try {
//     const response = await axiosInstance.get(`/messages/${chatThreadId}`);
//     return response.data;
//   } catch (error) {
//     console.error('Error fetching messages:', error.response?.data || error.message);
//     throw error.response?.data || error;
//   }
// };

// /**
//  * Service Function: Add Notification
//  * Endpoint: POST /addNotification (Assuming you have such an endpoint)
//  *
//  * @param {object} notificationData - Data required to add a notification.
//  * @returns {object} - Response data confirming notification addition.
//  */
// export const addNotification = async (notificationData) => {
//   try {
//     const response = await axiosInstance.post('/addNotification', notificationData);
//     return response.data;
//   } catch (error) {
//     console.error('Error adding notification:', error.response?.data || error.message);
//     throw error.response?.data || error;
//   }
// };

// /**
//  * Service Function: Fetch Notifications
//  * Endpoint: GET /notifications (Assuming you have such an endpoint)
//  *
//  * @returns {object} - Response data containing notifications.
//  */
// export const fetchNotifications = async () => {
//   try {
//     const response = await axiosInstance.get('/notifications');
//     return response.data;
//   } catch (error) {
//     console.error('Error fetching notifications:', error.response?.data || error.message);
//     throw error.response?.data || error;
//   }
// };

// /**
//  * Service Function: Remove All Notifications
//  * Endpoint: DELETE /notifications (Assuming you have such an endpoint)
//  *
//  * @returns {object} - Response data confirming notification removal.
//  */
// export const removeAllNotifications = async () => {
//   try {
//     const response = await axiosInstance.delete('/notifications');
//     return response.data;
//   } catch (error) {
//     console.error('Error removing all notifications:', error.response?.data || error.message);
//     throw error.response?.data || error;
//   }
// };

// /**
//  * Service Function: Create Listing Image Upload URL (If needed)
//  * Endpoint: POST /createListingImageUploadURL (Assuming you have such an endpoint)
//  *
//  * @param {object} imageData - Data required to create an image upload URL.
//  * @returns {object} - Response data containing the upload URL.
//  */
// export const createListingImageUploadURL = async (imageData) => {
//   try {
//     const response = await axiosInstance.post('/createListingImageUploadURL', imageData);
//     return response.data;
//   } catch (error) {
//     console.error('Error creating listing image upload URL:', error.response?.data || error.message);
//     throw error.response?.data || error;
//   }
// };

// /**
//  * Service Function: Fetch Listings
//  * Endpoint: GET /listings (Assuming you have such an endpoint)
//  *
//  * @returns {object} - Response data containing listings.
//  */
// export const fetchListings = async () => {
//   try {
//     const response = await axiosInstance.get('/listings');
//     return response.data;
//   } catch (error) {
//     console.error('Error fetching listings:', error.response?.data || error.message);
//     throw error.response?.data || error;
//   }
// };

// /**
//  * Service Function: Fetch Rental Requests
//  * Endpoint: GET /rentalRequests (Assuming you have such an endpoint)
//  *
//  * @returns {object} - Response data containing rental requests.
//  */
// export const fetchRentalRequests = async () => {
//   try {
//     const response = await axiosInstance.get('/rentalRequests');
//     return response.data;
//   } catch (error) {
//     console.error('Error fetching rental requests:', error.response?.data || error.message);
//     throw error.response?.data || error;
//   }
// };

// /**
//  * Service Function: Update Rental Request Status
//  * Endpoint: PUT /rentalRequests/:id (Assuming you have such an endpoint)
//  *
//  * @param {string} rentalRequestId - The ID of the rental request to update.
//  * @param {object} updateData - Data to update in the rental request.
//  * @returns {object} - Response data confirming update.
//  */
// export const updateRentalRequestStatus = async (rentalRequestId, updateData) => {
//   try {
//     const response = await axiosInstance.put(`/rentalRequests/${rentalRequestId}`, updateData);
//     return response.data;
//   } catch (error) {
//     console.error('Error updating rental request status:', error.response?.data || error.message);
//     throw error.response?.data || error;
//   }
// };

// // Export all functions for easy import elsewhere
// export default {
//   validateDiscount,
//   createConnectedAccount,
//   createClassifiedPaymentIntent,
//   createRentalPaymentIntent,
//   attachBankAccount,
//   createListing,
//   withdrawFunds,
//   getFirebaseUser,
//   cleanupOrphanedRentalRequests,
//   createRentalRequest,
//   approveRentalRequest,
//   sendMessage,
//   fetchMessages,
//   addNotification,
//   fetchNotifications,
//   removeAllNotifications,
//   createListingImageUploadURL,
//   fetchListings,
//   fetchRentalRequests,
//   updateRentalRequestStatus,
// };
