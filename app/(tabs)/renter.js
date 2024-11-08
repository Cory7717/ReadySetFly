import React, { useState, useEffect, useRef } from "react";
import {
  TextInput,
  Image,
  View,
  Text,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  Modal,
  RefreshControl,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ImageBackground,
  StatusBar,
  ActivityIndicator,
  FlatList,
  StyleSheet,
} from "react-native";

import {
  collection,
  query,
  where,
  getDocs,
  getDoc,
  addDoc,
  updateDoc,
  doc,
  onSnapshot,
  orderBy,
  serverTimestamp,
  writeBatch,
  limit,
  startAfter,
  setDoc,
} from "firebase/firestore";

import * as ImagePicker from "expo-image-picker";
import * as DocumentPicker from "expo-document-picker";
import * as Location from "expo-location";

import { onAuthStateChanged } from "firebase/auth";

import {
  Ionicons,
  Octicons,
  MaterialCommunityIcons,
  Fontisto,
} from "@expo/vector-icons";

import { useNavigation } from "@react-navigation/native";

import DateTimePickerModal from "react-native-modal-datetime-picker";

// Import your components as needed
import CheckoutScreen from "../payment/CheckoutScreen";
import ConfirmationScreen from "../payment/ConfirmationScreen";
import MessagesScreen from "../screens/MessagesScreen";

// **Remove the import for API_URL from @env**
// import { API_URL } from "@env"; // Removed

// Define API_URL directly
const API_URL = "https://us-central1-ready-set-fly-71506.cloudfunctions.net/api";

// Import Firebase configuration
import { db, auth } from "../../firebaseConfig"; // Adjust the path as necessary

const BookingCalendar = () => {
  const navigation = useNavigation();

  // State Variables
  const [profileModalVisible, setProfileModalVisible] = useState(false);
  const [menuVisible, setMenuVisible] = useState(false);
  const [rentalCostEstimatorModalVisible, setRentalCostEstimatorModalVisible] =
    useState(false);
  const [messagesModalVisible, setMessagesModalVisible] = useState(false);
  const [notificationModalVisible, setNotificationModalVisible] =
    useState(false);
  const [allNotificationsModalVisible, setAllNotificationsModalVisible] =
    useState(false);

  const [profileSaved, setProfileSaved] = useState(false);
  const [profileData, setProfileData] = useState({
    name: "",
    aircraftType: "",
    certifications: "",
    contact: "",
    address: "",
    logBooks: null,
    medical: null,
    insurance: null,
    image: null,
  });

  const [refreshing, setRefreshing] = useState(false);

  const [rentals, setRentals] = useState([]);
  const [ratings, setRatings] = useState({});

  const [rentalDate, setRentalDate] = useState("");
  const [rentalHours, setRentalHours] = useState("");
  const [preferredLocation, setPreferredLocation] = useState("");
  const [costPerHour, setCostPerHour] = useState("");
  const [numHours, setNumHours] = useState("");
  const [costPerGallon, setCostPerGallon] = useState("");
  const [numGallons, setNumGallons] = useState("");
  const [baseCost, setBaseCost] = useState(0); // Assuming baseCost is needed
  const [hours, setHours] = useState(0); // Assuming hours is needed

  const [notifications, setNotifications] = useState([]);
  const [notificationCount, setNotificationCount] = useState(0);

  const [selectedNotification, setSelectedNotification] = useState(null);
  const [selectedRentalRequest, setSelectedRentalRequest] = useState(null);
  const [isRentalRequestLoading, setIsRentalRequestLoading] = useState(false);

  const [selectedListing, setSelectedListing] = useState(null);
  const [selectedListingId, setSelectedListingId] = useState(null); // Dynamic Listing ID
  const [selectedListingName, setSelectedListingName] = useState(null); // Display Aircraft Name
  const [totalCost, setTotalCost] = useState({
    rentalCost: "0.00",
    bookingFee: "0.00",
    transactionFee: "0.00",
    salesTax: "0.00",
    total: "0.00",
  });

  const [messages, setMessages] = useState([]);
  const [messageText, setMessageText] = useState("");

  const [processedRentals, setProcessedRentals] = useState([]);

  const [rentalsLastDoc, setRentalsLastDoc] = useState(null);
  const [hasMoreRentals, setHasMoreRentals] = useState(true);
  const RENTALS_PAGE_SIZE = 20;

  const [allNotifications, setAllNotifications] = useState([]);
  const [notificationsLastDoc, setNotificationsLastDoc] = useState(null);
  const [hasMoreNotifications, setHasMoreNotifications] = useState(true);
  const NOTIFICATIONS_PAGE_SIZE = 20;

  const [isAuthChecked, setIsAuthChecked] = useState(false); // Track auth status
  const [renter, setRenter] = useState(null); // Manage authenticated user

  const [isDatePickerVisible, setDatePickerVisibility] = useState(false);

  const [isMapModalVisible, setMapModalVisible] = useState(false);
  const [initialLocation, setInitialLocation] = useState(null);

  const [currentChatOwnerId, setCurrentChatOwnerId] = useState(null);

  // New State for Payment Completion
  const [paymentComplete, setPaymentComplete] = useState(false);

  // Ref for tracking processed rentals to prevent duplicate notifications
  const processedRentalsRef = useRef([]);

  // Ref for Firestore listener on rental request
  const rentalRequestListenerRef = useRef(null);

  /**
   * Utility Function to Safely Call toFixed
   * @param {number|string} value - The value to format.
   * @param {number} decimals - Number of decimal places.
   * @returns {string} - Formatted number or 'N/A' if invalid.
   */
  const safeToFixed = (value, decimals = 2) => {
    let number = value;

    if (typeof value === "string") {
      number = parseFloat(value);
      if (isNaN(number)) {
        console.warn(
          `Expected a number but received a non-numeric string. Returning 'N/A'.`
        );
        return "N/A";
      }
    }

    if (typeof number === "number" && !isNaN(number)) {
      return number.toFixed(decimals);
    }

    console.warn(
      `Expected a number but received ${typeof number}. Returning 'N/A'.`
    );
    return "N/A";
  };

  /**
   * Calculation Function for Total Cost
   * @param {number} rentalCostPerHour - Cost per hour.
   * @param {number} rentalHours - Number of rental hours.
   * @returns {object} - Calculated cost breakdown.
   */
  const calculateTotalCost = (rentalCostPerHour, rentalHours) => {
    // Fixed percentages
    const bookingFeePercentage = 6; // 6%
    const transactionFeePercentage = 3; // 3%
    const salesTaxPercentage = 8.25; // 8.25%

    const rentalTotalCost = rentalCostPerHour * rentalHours;
    const bookingFee = rentalTotalCost * (bookingFeePercentage / 100);
    const transactionFee = rentalTotalCost * (transactionFeePercentage / 100);
    const salesTax = rentalTotalCost * (salesTaxPercentage / 100);
    const renterTotalCost =
      rentalTotalCost + bookingFee + transactionFee + salesTax;

    return {
      rentalCost: rentalTotalCost.toFixed(2),
      bookingFee: bookingFee.toFixed(2),
      transactionFee: transactionFee.toFixed(2),
      salesTax: salesTax.toFixed(2),
      total: renterTotalCost.toFixed(2),
    };
  };

  /**
   * Fetch authenticated renter details
   */
  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setRenter(user);
        // Ensure renter document exists
        const renterDocRef = doc(db, "renters", user.uid);
        const renterDocSnap = await getDoc(renterDocRef);
        if (!renterDocSnap.exists()) {
          // Optionally, prompt the user to complete their profile or automatically create the document
          await setDoc(renterDocRef, {
            uid: user.uid,
            fullName: user.displayName || "Unnamed Renter",
            contact: user.email || "No Email",
            // ... other default fields
          });
          console.log(`Renter document created for UID: ${user.uid}`);
        }
      } else {
        setRenter(null);
        // Optionally navigate to login screen here if you have a separate authentication flow
      }
      setIsAuthChecked(true); // Auth state has been determined
    });

    return () => unsubscribeAuth();
  }, []);

  const renterId = renter?.uid;

  /**
   * Data Migration Function
   * Converts relevant fields from strings to numbers in the 'rentalRequests' collection.
   * This function runs once when the component mounts.
   */
  useEffect(() => {
    const migrateData = async () => {
      try {
        // Flag to ensure migration runs only once
        const migrationFlagRef = doc(
          db,
          "migrationFlags",
          "rentalRequestsMigration"
        );
        const migrationFlagSnap = await getDoc(migrationFlagRef);

        if (migrationFlagSnap.exists() && migrationFlagSnap.data().migrated) {
          console.log("Data migration already completed.");
          return;
        }

        const rentalRequestsRef = collection(db, "rentalRequests");
        const rentalRequestsSnapshot = await getDocs(rentalRequestsRef);

        const batch = writeBatch(db);
        let migrationCount = 0;

        rentalRequestsSnapshot.forEach((docSnap) => {
          const data = docSnap.data();
          const updates = {};

          // List of fields to migrate
          const fieldsToMigrate = [
            "rentalCost",
            "bookingFee",
            "transactionFee",
            "salesTax",
            "totalCost",
          ];

          fieldsToMigrate.forEach((field) => {
            if (data[field] === undefined) {
              // Field is missing, set to 0
              updates[field] = 0;
              migrationCount += 1;
            } else if (typeof data[field] === "string") {
              // Attempt to parse string to number
              const parsedValue = parseFloat(data[field]);
              updates[field] = isNaN(parsedValue) ? 0 : parsedValue;
              migrationCount += 1;
            } else if (typeof data[field] !== "number") {
              // Field exists but is not a string or number, set to 0
              updates[field] = 0;
              migrationCount += 1;
            }
            // If it's already a number, do nothing
          });

          if (Object.keys(updates).length > 0) {
            batch.update(docSnap.ref, updates);
          }
        });

        if (migrationCount > 0) {
          // Commit the batch (ensure it doesn't exceed Firestore's batch limit of 500)
          await batch.commit();
          console.log(`Migrated ${migrationCount} fields in rentalRequests.`);
        } else {
          console.log("No migration needed for rentalRequests.");
        }

        // Set migration flag
        await setDoc(migrationFlagRef, {
          migrated: true,
          migratedAt: new Date(),
        });
        console.log("Migration flag set to true.");
      } catch (error) {
        console.error("Error during data migration:", error);
      }
    };

    if (isAuthChecked && renterId) {
      migrateData();
    }
  }, [isAuthChecked, renterId]);

  /**
   * Fetch Rentals and Notifications
   */
  useEffect(() => {
    if (!isAuthChecked) return; // Wait until auth is checked

    if (!renterId) {
      console.error("Error: renterId is undefined.");
      Alert.alert("Authentication Error", "User is not authenticated.");
      // Optionally, navigate to login screen here
      return;
    }

    const rentalRequestsRef = collection(db, "rentalRequests");
    const notificationsRef = collection(
      db,
      "renters",
      renterId,
      "notifications"
    );

    const rentalRequestsQueryInstance = query(
      rentalRequestsRef,
      where("renterId", "==", renterId),
      where("rentalStatus", "in", ["active", "approved"]),
      orderBy("createdAt", "desc"),
      limit(RENTALS_PAGE_SIZE)
    );

    const notificationsQueryInstance = query(
      notificationsRef,
      orderBy("createdAt", "desc"),
      limit(NOTIFICATIONS_PAGE_SIZE)
    );

    // Real-time listener for Rental Requests
    const unsubscribeRentalRequests = onSnapshot(
      rentalRequestsQueryInstance,
      async (snapshot) => {
        const active = [];
        for (const docSnap of snapshot.docs) {
          const requestData = docSnap.data();

          // Ensure rentalStatus exists
          if (!requestData.rentalStatus) {
            console.warn(
              `Rental Request ID: ${docSnap.id} is missing 'rentalStatus'. This request will be excluded.`
            );
            continue; // Skip rentals without rentalStatus
          }

          // Ensure ownerId exists
          if (!requestData.ownerId) {
            console.warn(
              `Rental Request ID: ${docSnap.id} is missing 'ownerId'. This request will be excluded.`
            );
            continue; // Skip rental requests without ownerId
          }

          // Fetch owner details
          let ownerName = "Unknown Owner";
          try {
            const ownerDocRef = doc(db, "owners", requestData.ownerId);
            const ownerDoc = await getDoc(ownerDocRef);
            if (ownerDoc.exists()) {
              ownerName = ownerDoc.data().fullName || "Unknown Owner";
            } else {
              console.warn(
                `Owner document not found for ownerId: ${requestData.ownerId}`
              );
            }
          } catch (error) {
            console.error("Error fetching owner details:", error);
          }

          // Add validation for rentalCostPerHour and rentalHours
          const rentalCostPerHour = parseFloat(requestData.rentalCostPerHour);
          const rentalHours = requestData.rentalHours;

          console.log(`Processing Rental Request ID: ${docSnap.id}`);
          console.log(
            `rentalCostPerHour (${typeof rentalCostPerHour}):`,
            rentalCostPerHour
          );
          console.log(`rentalHours (${typeof rentalHours}):`, rentalHours);

          // Ensure all required fields are valid numbers
          if (
            isNaN(rentalCostPerHour) ||
            typeof rentalHours !== "number" ||
            isNaN(rentalHours)
          ) {
            console.warn(
              `Rental Request ID: ${docSnap.id} has invalid or missing cost components: rentalCostPerHour=${rentalCostPerHour}, rentalHours=${rentalHours}`
            );
            continue; // Skip invalid rental requests
          }

          active.push({
            id: docSnap.id,
            rentalStatus: requestData.rentalStatus,
            ...requestData,
            ownerName,
          });
        }

        setRentals(active);

        // Update last document for pagination
        const lastRentalDoc = snapshot.docs[snapshot.docs.length - 1];
        setRentalsLastDoc(lastRentalDoc);
      },
      (error) => {
        console.error("Error fetching rentals:", error);
        Alert.alert("Error", "Failed to fetch rentals.");
      }
    );

    // Real-time listener for Notifications
    const unsubscribeNotifications = onSnapshot(
      notificationsQueryInstance,
      (snapshot) => {
        const notifs = [];
        snapshot.docs.forEach((docSnap) => {
          notifs.push({
            id: docSnap.id,
            ...docSnap.data(),
          });
        });
        setNotifications(notifs);
        setAllNotifications(notifs);
        setNotificationCount(notifs.length);

        const lastVisible = snapshot.docs[snapshot.docs.length - 1];
        setNotificationsLastDoc(lastVisible);
      },
      (error) => {
        console.error("Error fetching notifications:", error);
        Alert.alert("Error", "Failed to fetch notifications.");
      }
    );

    return () => {
      unsubscribeRentalRequests();
      unsubscribeNotifications();
    };
  }, [renterId, isAuthChecked]);

  /**
   * Navigate to Checkout Screen
   * @param {string} rentalRequestId - The ID of the rental request.
   */
  const navigateToCheckout = async (rentalRequestId) => {
    if (!rentalRequestId) {
      Alert.alert("Error", "No rental request selected.");
      return;
    }

    try {
      const rentalRequestRef = doc(db, "rentalRequests", rentalRequestId);
      const rentalRequestSnap = await getDoc(rentalRequestRef);

      if (!rentalRequestSnap.exists()) {
        Alert.alert("Error", "Rental request not found.");
        return;
      }

      const rentalRequest = rentalRequestSnap.data();

      console.log("Rental Request Data:", rentalRequest);

      if (!rentalRequest.listingId) {
        Alert.alert("Error", "Listing ID is missing in rental request.");
        console.warn(
          `Rental Request ID: ${rentalRequestId} is missing 'listingId'.`
        );
        return;
      }

      const listingRef = doc(db, "airplanes", rentalRequest.listingId);
      const listingSnap = await getDoc(listingRef);

      if (!listingSnap.exists()) {
        Alert.alert("Error", "Listing not found.");
        return;
      }

      const listingData = listingSnap.data();

      console.log("Listing Data:", listingData);

      // **Defensive Coding: Check if required fields exist and are numbers**
      const rentalCostPerHour = parseFloat(listingData.costPerHour);
      const rentalHours = rentalRequest.rentalHours;

      console.log(
        `rentalCostPerHour (${typeof rentalCostPerHour}):`,
        rentalCostPerHour
      );
      console.log(`rentalHours (${typeof rentalHours}):`, rentalHours);

      if (isNaN(rentalCostPerHour) || typeof rentalHours !== "number") {
        Alert.alert(
          "Error",
          "One or more cost components are missing or invalid."
        );
        console.error(
          `Rental Request ID: ${rentalRequestId} has invalid cost components:`,
          { rentalCostPerHour, rentalHours }
        );
        return;
      }

      // **Compute Renter's Total Cost using the corrected calculation function**
      const computedTotalCost = calculateTotalCost(
        rentalCostPerHour, // Use costPerHour from listingData
        rentalHours
      );

      setTotalCost(computedTotalCost);

      // **Debugging: Log computedTotalCost**
      console.log("Computed Total Cost:", computedTotalCost);

      const amountInCents = Math.round(parseFloat(computedTotalCost.total) * 100);

      console.log(
        `Creating payment intent for rental ID: ${rentalRequestSnap.id} with amount: ${amountInCents} cents`
      );

      // Use ownerUid from rentalRequest
      const ownerUid = rentalRequest.ownerId;

      if (!ownerUid) {
        console.error("Owner ID is missing in rental request.");
        Alert.alert("Error", "Owner information is missing.");
        return;
      }

      // Since ownerDocId is ownerUid, no need to fetch
      const ownerDocId = ownerUid;

      // Pass amount, rentalRequestId, ownerDocId, and renterId
      const clientSecret = await createPaymentIntent(
        amountInCents,
        rentalRequestSnap.id,
        ownerDocId, // Pass Firestore document ID
        renterId // Pass renterId
      );

      if (clientSecret) {
        console.log(
          "Payment intent created successfully. Navigating to CheckoutScreen."
        );

        // Navigate to CheckoutScreen
        // Ensure CheckoutScreen is properly imported and set up in your navigation
        navigation.navigate("CheckoutScreen", {
          rentalRequestId: rentalRequestSnap.id,
          amount: computedTotalCost.total, // Pass the calculated total cost
          clientSecret,
        });
      } else {
        console.log("Failed to create payment intent.");
        Alert.alert("Payment Error", "Unable to proceed with payment.");
      }
    } catch (error) {
      console.error("Error navigating to CheckoutScreen:", error);
      Alert.alert("Error", "An unexpected error occurred.");
    }
  };

  /**
   * Create Payment Intent
   * @param {number} amount - The amount in cents.
   * @param {string} rentalRequestId - The rental request ID.
   * @param {string} ownerDocId - The Firestore document ID of the owner.
   * @param {string} renterId - The UID of the renter.
   * @returns {Promise<string|null>} - Returns the client secret if successful, else null.
   */
  const createPaymentIntent = async (
    amount,
    rentalRequestId,
    ownerDocId,
    renterId
  ) => {
    if (isNaN(amount) || amount <= 0) {
      Alert.alert("Invalid Amount", "The payment amount is invalid.");
      return null;
    }

    if (!rentalRequestId) {
      Alert.alert("Invalid Rental Request", "Rental Request ID is missing.");
      return null;
    }

    if (!ownerDocId) {
      Alert.alert("Invalid Owner", "Owner ID is missing.");
      return null;
    }

    if (!renterId) {
      Alert.alert("Invalid Renter", "Renter ID is missing.");
      return null;
    }

    try {
      console.log(`Creating payment intent for amount: ${amount} cents`);
      console.log(`Rental Request ID: ${rentalRequestId}`);
      console.log(`Owner Document ID: ${ownerDocId}`);
      console.log(`Renter ID: ${renterId}`);
      console.log(`API_URL is: ${API_URL}`);

      // **Fetch Owner Document ID based on UID**
      const ownerDocRef = doc(db, "owners", ownerDocId);
      const ownerDocSnap = await getDoc(ownerDocRef);

      if (!ownerDocSnap.exists()) {
        console.error(`Owner with ID ${ownerDocId} does not exist.`);
        Alert.alert("Payment Error", "Associated owner does not exist.");
        return null;
      }

      // **Ensure API_URL is defined**
      if (!API_URL) {
        console.error("API_URL is not defined.");
        Alert.alert(
          "Configuration Error",
          "Payment processing is not available at this time."
        );
        return null;
      }

      const response = await fetch(`${API_URL}/create-rental-payment-intent`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${await auth.currentUser.getIdToken()}`,
        },
        body: JSON.stringify({
          amount,
          rentalRequestId,
          ownerId: ownerDocId,
          renterId,
        }), // Ensure correct ownerId
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error("Error creating payment intent:", errorData);
        Alert.alert(
          "Payment Error",
          errorData.message || "Failed to create payment intent."
        );
        return null;
      }

      const data = await response.json();

      console.log("Payment Intent Response:", data);

      if (data.clientSecret) {
        return data.clientSecret;
      } else {
        console.error("clientSecret not found in response:", data);
        Alert.alert("Payment Error", "Invalid response from payment server.");
        return null;
      }
    } catch (error) {
      console.error("Error creating payment intent:", error);
      Alert.alert("Payment Error", "An unexpected error occurred.");
      return null;
    }
  };

  /**
   * Handle Notification Press
   * Fetches rental request details and computes renter's total cost.
   * @param {object} notification - The notification object.
   */
  const handleNotificationPress = async (notification) => {
    try {
      if (!notification) {
        throw new Error("Notification object is undefined.");
      }

      // Handle both 'rentalRequestId' and 'rentalRequest' properties
      const rentalRequestId =
        notification.rentalRequestId || notification.rentalRequest;

      if (rentalRequestId) {
        console.log("Notification has rentalRequestId:", rentalRequestId);

        setIsRentalRequestLoading(true);
        setPaymentComplete(false); // Reset payment status

        const rentalRequestRef = doc(db, "rentalRequests", rentalRequestId);

        // Clean up any existing listener
        if (rentalRequestListenerRef.current) {
          rentalRequestListenerRef.current();
        }

        // Fetch rental request data using getDoc
        const rentalRequestSnap = await getDoc(rentalRequestRef);
        if (!rentalRequestSnap.exists()) {
          setSelectedRentalRequest(null);
          setSelectedListing(null);
          setTotalCost({
            rentalCost: "0.00",
            bookingFee: "0.00",
            transactionFee: "0.00",
            salesTax: "0.00",
            total: "0.00",
          });
          Alert.alert("Error", "Rental request not found.");
          setIsRentalRequestLoading(false);
          return;
        }

        const rentalRequestData = rentalRequestSnap.data();
        console.log("Rental Request Data:", rentalRequestData);

        // **Debugging: Log cost fields**
        console.log("Cost Fields:");
        console.log("bookingFee:", rentalRequestData.bookingFee);
        console.log("transactionFee:", rentalRequestData.transactionFee);
        console.log("salesTax:", rentalRequestData.salesTax);
        console.log("rentalHours:", rentalRequestData.rentalHours);

        // Fetch owner details
        let ownerName = "Unknown Owner";
        try {
          const ownerDocRef = doc(db, "owners", rentalRequestData.ownerId);
          const ownerDocSnap = await getDoc(ownerDocRef);
          if (ownerDocSnap.exists()) {
            ownerName = ownerDocSnap.data().fullName || "Unknown Owner";
          } else {
            console.warn(
              `Owner document not found for ownerId: ${rentalRequestData.ownerId}`
            );
          }
        } catch (error) {
          console.error("Error fetching owner details:", error);
        }

        // Update rentalRequestData with ownerName
        const updatedRentalRequestData = {
          ...rentalRequestData,
          ownerName,
        };

        // Set selected rental request with ownerName
        setSelectedRentalRequest(updatedRentalRequestData);

        // Fetch listing data
        const listingRef = doc(db, "airplanes", rentalRequestData.listingId);
        const listingSnap = await getDoc(listingRef);
        if (!listingSnap.exists()) {
          setSelectedListing(null);
          setTotalCost({
            rentalCost: "0.00",
            bookingFee: "0.00",
            transactionFee: "0.00",
            salesTax: "0.00",
            total: "0.00",
          });
          Alert.alert("Error", "Listing not found.");
          setIsRentalRequestLoading(false);
          return;
        }

        const listingData = listingSnap.data();
        console.log("Listing Data:", listingData);

        setSelectedListing(listingData);

        // **Defensive Coding: Check if required fields exist and are numbers**
        const rentalHours = rentalRequestData.rentalHours;

        // Use listingData.costPerHour instead of rentalRequestData.rentalCost
        const rentalCostPerHour = parseFloat(listingData.costPerHour);

        console.log(
          `rentalCostPerHour (${typeof rentalCostPerHour}):`,
          rentalCostPerHour
        );
        console.log(`rentalHours (${typeof rentalHours}):`, rentalHours);

        if (isNaN(rentalCostPerHour) || typeof rentalHours !== "number") {
          Alert.alert(
            "Error",
            "One or more cost components are missing or invalid."
          );
          console.error(
            `Rental Request ID: ${rentalRequestId} has invalid cost components:`,
            { rentalCostPerHour, rentalHours }
          );
          setIsRentalRequestLoading(false);
          return;
        }

        // **Compute Renter's Total Cost using the corrected calculation function**
        const computedTotalCost = calculateTotalCost(
          rentalCostPerHour, // Use costPerHour from listingData
          rentalHours
        );

        setTotalCost(computedTotalCost);

        // **Debugging: Log computedTotalCost**
        console.log("Computed Total Cost:", computedTotalCost);

        // Set up Firestore listener to monitor payment status
        rentalRequestListenerRef.current = onSnapshot(
          rentalRequestRef,
          (docSnap) => {
            if (docSnap.exists()) {
              const data = docSnap.data();
              if (data.paymentStatus === "completed") {
                setPaymentComplete(true);
                Alert.alert(
                  "Payment Complete",
                  "Your payment has been processed."
                );
              }
            }
          },
          (error) => {
            console.error("Error listening to rental request:", error);
          }
        );

        // Set selectedNotification for context
        setSelectedNotification(notification);

        // Open Notification Modal
        setNotificationModalVisible(true);
        setIsRentalRequestLoading(false);
      } else {
        // Handle other notification types if any
        setSelectedNotification(notification);
        setSelectedRentalRequest(null);
        setSelectedListing(null);
        setTotalCost({
          rentalCost: "0.00",
          bookingFee: "0.00",
          transactionFee: "0.00",
          salesTax: "0.00",
          total: "0.00",
        });
        setPaymentComplete(false);
        setNotificationModalVisible(true);
      }
    } catch (error) {
      console.error("Error handling notification press:", error);
      Alert.alert("Error", error.message);
      setIsRentalRequestLoading(false);
    }
  };

  /**
   * Close Notification Modal
   */
  const closeModal = () => {
    setNotificationModalVisible(false);
    setSelectedNotification(null);
    setSelectedRentalRequest(null);
    setSelectedListing(null);
    setTotalCost({
      rentalCost: "0.00",
      bookingFee: "0.00",
      transactionFee: "0.00",
      salesTax: "0.00",
      total: "0.00",
    });
    setPaymentComplete(false);
    // Clean up listener
    if (rentalRequestListenerRef.current) {
      rentalRequestListenerRef.current();
      rentalRequestListenerRef.current = null;
    }
  };

  /**
   * Remove All Notifications
   */
  const removeAllNotifications = async () => {
    Alert.alert(
      "Confirm Deletion",
      "Are you sure you want to remove all notifications?",
      [
        {
          text: "Cancel",
          style: "cancel",
        },
        {
          text: "Remove All",
          style: "destructive",
          onPress: async () => {
            try {
              const notificationsRef = collection(
                db,
                "renters",
                renterId,
                "notifications"
              );
              const snapshot = await getDocs(notificationsRef);
              if (snapshot.empty) {
                Alert.alert(
                  "No Notifications",
                  "There are no notifications to remove."
                );
                return;
              }

              const batch = writeBatch(db);
              snapshot.docs.forEach((docSnap) => {
                batch.delete(docSnap.ref);
              });

              await batch.commit();
              setNotifications([]);
              setAllNotifications([]);
              setNotificationCount(0);
              Alert.alert("Success", "All notifications have been removed.");
            } catch (error) {
              console.error("Error removing all notifications:", error);
              Alert.alert("Error", "Failed to remove all notifications.");
            }
          },
        },
      ],
      { cancelable: true }
    );
  };

  /**
   * Date Picker Functions
   */
  const showDatePicker = () => {
    setDatePickerVisibility(true);
  };

  const hideDatePicker = () => {
    setDatePickerVisibility(false);
  };

  const handleConfirm = (date) => {
    const formattedDate = `${
      date.getMonth() + 1
    }/${date.getDate()}/${date.getFullYear()}`;
    setRentalDate(formattedDate);
    hideDatePicker();
  };

  /**
   * Send Message Function
   */
  const sendMessage = async () => {
    if (!messageText.trim()) {
      Alert.alert("Validation Error", "Message cannot be empty.");
      return;
    }

    if (!currentChatOwnerId) {
      Alert.alert("Error", "No owner selected for messaging.");
      return;
    }

    try {
      // Fetch rentalRequestId from the selected notification or rental request
      let rentalRequestId = selectedNotification?.rentalRequestId || null;

      await addDoc(collection(db, "messages"), {
        senderId: renterId,
        senderName: renter.displayName || "User",
        receiverId: currentChatOwnerId,
        text: messageText.trim(),
        timestamp: serverTimestamp(),
        participants: [renterId, currentChatOwnerId],
        rentalRequestId: rentalRequestId,
      });
      setMessageText("");
      Alert.alert("Success", "Message sent successfully.");
    } catch (error) {
      console.error("Error sending message:", error);
      Alert.alert("Error", "Failed to send message.");
    }
  };

  /**
   * Toggle Messages Modal
   */
  const toggleMessagesModal = () => {
    setNotificationModalVisible(false);
    setAllNotificationsModalVisible(false);
    setMessagesModalVisible(!messagesModalVisible);
  };

  /**
   * Image Picker
   */
  const pickImage = async () => {
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.All,
      allowsEditing: true,
      aspect: [4, 4],
      quality: 1,
    });

    if (!result.canceled) {
      setProfileData({ ...profileData, image: result.assets[0].uri });
    }
  };

  /**
   * Document Picker
   */
  const pickDocument = async (field) => {
    let result = await DocumentPicker.getDocumentAsync({
      type: ["application/pdf", "image/*"],
    });

    if (result.type !== "cancel") {
      setProfileData({ ...profileData, [field]: result.uri });
    }
  };

  /**
   * Handle Profile Submit
   */
  const handleProfileSubmit = (values) => {
    setProfileData(values);
    setProfileSaved(true);
    setProfileModalVisible(false);
  };

  /**
   * Handle Navigation to Home with Filters
   */
  const handleNavigation = (filter) => {
    try {
      navigation.navigate("Home", { filter });
    } catch (error) {
      console.error("Navigation error:", error);
      Alert.alert("Error", "Failed to navigate to the home screen.");
    }
  };

  /**
   * Get Current Location
   */
  const getCurrentLocation = async () => {
    let { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== "granted") {
      Alert.alert(
        "Permission Denied",
        "Permission to access location was denied."
      );
      return;
    }

    let location = await Location.getCurrentPositionAsync({});
    setInitialLocation({
      latitude: location.coords.latitude,
      longitude: location.coords.longitude,
      latitudeDelta: 0.0922,
      longitudeDelta: 0.0421,
    });
  };

  /**
   * Handle Rating Submission
   */
  const handleRating = async (rentalId, rating) => {
    try {
      const rentalDocRef = doc(db, "rentalRequests", rentalId);
      await updateDoc(rentalDocRef, { rating });
      setRatings((prevRatings) => ({ ...prevRatings, [rentalId]: rating }));
      Alert.alert("Rating Submitted", "Thank you for your feedback!");
    } catch (error) {
      console.error("Error submitting rating:", error);
      Alert.alert("Error", "Failed to submit rating.");
    }
  };

  /**
   * Listen for Messages between Renter and Owner
   */
  useEffect(() => {
    if (currentChatOwnerId) {
      const messagesRef = collection(db, "messages");
      const messagesQueryInstance = query(
        messagesRef,
        where("participants", "array-contains", renterId),
        orderBy("timestamp", "asc")
      );

      const unsubscribe = onSnapshot(
        messagesQueryInstance,
        (snapshot) => {
          const fetchedMessages = [];
          snapshot.forEach((docSnap) => {
            const messageData = docSnap.data();
            if (
              messageData.participants.includes(renterId) &&
              messageData.participants.includes(currentChatOwnerId)
            ) {
              fetchedMessages.push(messageData);
            }
          });
          setMessages(fetchedMessages);
        },
        (error) => {
          console.error("Error fetching messages:", error);
          Alert.alert("Error", "Failed to fetch messages.");
        }
      );

      return () => unsubscribe();
    } else {
      setMessages([]);
    }
  }, [currentChatOwnerId, renterId]);

  /**
   * Handle Rental Press (Optional: Expand Functionality)
   */
  const handleRentalPress = (rental) => {
    Alert.alert(
      "Rental Pressed",
      `You pressed on rental: ${rental.aircraftModel || "N/A"}`
    );
  };

  /**
   * Fetch More Rentals for Pagination
   */
  const fetchMoreRentals = async () => {
    if (!hasMoreRentals) return;

    try {
      let rentalRequestsQueryInstance = query(
        collection(db, "rentalRequests"),
        where("renterId", "==", renterId),
        where("rentalStatus", "in", ["active", "approved"]),
        orderBy("createdAt", "desc"),
        startAfter(rentalsLastDoc),
        limit(RENTALS_PAGE_SIZE)
      );

      const snapshot = await getDocs(rentalRequestsQueryInstance);
      if (snapshot.empty) {
        setHasMoreRentals(false);
        return;
      }

      const newRentals = [];
      for (const docSnap of snapshot.docs) {
        const requestData = docSnap.data();
        let ownerName = "Unknown Owner";

        // Ensure ownerId exists
        if (requestData.ownerId) {
          try {
            const ownerDocRef = doc(db, "owners", requestData.ownerId);
            const ownerDoc = await getDoc(ownerDocRef);
            if (ownerDoc.exists()) {
              ownerName = ownerDoc.data().fullName || "Unknown Owner";
            } else {
              console.warn(
                `Owner document not found for ownerId: ${requestData.ownerId}`
              );
            }
          } catch (error) {
            console.error("Error fetching owner details:", error);
          }
        } else {
          console.warn(
            `Rental Request ID: ${docSnap.id} is missing 'ownerId'. This request will be excluded.`
          );
          continue; // Skip rental requests without ownerId
        }

        // **Defensive Coding: Check if required fields exist and are numbers**
        const rentalCostPerHour = parseFloat(requestData.rentalCostPerHour);
        const rentalHours = requestData.rentalHours;

        console.log(`Processing Rental Request ID: ${docSnap.id}`);
        console.log(
          `rentalCostPerHour (${typeof rentalCostPerHour}):`,
          rentalCostPerHour
        );
        console.log(`rentalHours (${typeof rentalHours}):`, rentalHours);

        if (isNaN(rentalCostPerHour) || typeof rentalHours !== "number") {
          console.warn(
            `Rental Request ID: ${docSnap.id} has invalid or missing cost components: rentalCostPerHour=${rentalCostPerHour}, rentalHours=${rentalHours}`
          );
          continue; // Skip invalid rental requests
        }

        newRentals.push({
          id: docSnap.id,
          rentalStatus: requestData.rentalStatus,
          ...requestData,
          ownerName,
        });
      }

      setRentals([...rentals, ...newRentals]);

      const lastVisible = snapshot.docs[snapshot.docs.length - 1];
      setRentalsLastDoc(lastVisible);

      if (snapshot.docs.length < RENTALS_PAGE_SIZE) {
        setHasMoreRentals(false);
      }
    } catch (error) {
      console.error("Error fetching more rentals:", error);
      Alert.alert("Error", "Failed to fetch more rentals.");
    }
  };

  /**
   * Fetch More Notifications for Pagination
   */
  const fetchMoreNotifications = async () => {
    if (!hasMoreNotifications || !notificationsLastDoc) return;

    try {
      const notificationsQueryInstance = query(
        collection(db, "renters", renterId, "notifications"),
        orderBy("createdAt", "desc"),
        startAfter(notificationsLastDoc),
        limit(NOTIFICATIONS_PAGE_SIZE)
      );

      const snapshot = await getDocs(notificationsQueryInstance);
      if (snapshot.empty) {
        setHasMoreNotifications(false);
        return;
      }

      const newNotifications = [];
      snapshot.docs.forEach((docSnap) => {
        newNotifications.push({
          id: docSnap.id,
          ...docSnap.data(),
        });
      });

      setAllNotifications([...allNotifications, ...newNotifications]);
      setNotificationsLastDoc(snapshot.docs[snapshot.docs.length - 1]);

      if (snapshot.docs.length < NOTIFICATIONS_PAGE_SIZE) {
        setHasMoreNotifications(false);
      }
    } catch (error) {
      console.error("Error fetching more notifications:", error);
      Alert.alert("Error", "Failed to fetch more notifications.");
    }
  };

  /**
   * Render Rental Item
   */
  const renderRentalItem = ({ item }) => (
    <TouchableOpacity
      style={styles.rentalBox}
      onPress={() => handleRentalPress(item)}
      accessibilityLabel={`View details for rental: ${item.aircraftModel}`}
      accessibilityRole="button"
    >
      <Text style={styles.rentalAircraftModel}>
        {item.aircraftModel || "N/A"}
      </Text>
      <Text style={styles.rentalStatus}>{item.rentalStatus}</Text>
      <Text style={styles.rentalTotalCost}>
        Total Cost: ${safeToFixed(item.totalCost)}
      </Text>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <StatusBar hidden={false} />
      </SafeAreaView>

      {/* Display Loading Indicator While Auth State is Being Determined */}
      {!isAuthChecked ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#3182ce" />
        </View>
      ) : renterId ? (
        <ScrollView
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {}} // Implement pull-to-refresh if needed
            />
          }
          contentContainerStyle={{ paddingBottom: 16 }}
        >
          {/* Header with Image Background */}
          <ImageBackground
            source={require("../../Assets/images/wingtip_clouds.jpg")}
            style={styles.headerImage}
            resizeMode="cover"
          >
            {/* Semi-transparent Overlay for Better Readability */}
            <View style={styles.headerOverlay}>
              <SafeAreaView style={styles.headerContent}>
                <Text style={styles.greetingText}>
                  Good afternoon, {renter?.displayName || "User"}
                </Text>
                <View style={styles.headerRow}>
                  {/* Select Date */}
                  <TouchableOpacity
                    onPress={showDatePicker}
                    style={styles.datePickerButton}
                    accessibilityLabel="Select rental date"
                    accessibilityRole="button"
                  >
                    <Text style={styles.datePickerText}>
                      {rentalDate || "Select Date"}
                    </Text>
                  </TouchableOpacity>

                  {/* Estimated Hours */}
                  <TextInput
                    placeholder="Hours"
                    placeholderTextColor="#fff"
                    keyboardType="numeric"
                    style={styles.hoursInput}
                    onChangeText={(text) => {
                      const sanitizedText = text.replace(/[^0-9.]/g, "");
                      setRentalHours(sanitizedText);
                    }}
                    value={rentalHours}
                    accessibilityLabel="Enter estimated rental hours"
                  />
                </View>

                {/* Preferred Location */}
                <TouchableOpacity
                  onPress={() => setMapModalVisible(true)}
                  style={styles.locationButton}
                  accessibilityLabel="Select preferred rental location"
                  accessibilityRole="button"
                >
                  <Text style={styles.locationText}>
                    {preferredLocation || "Preferred Location"}
                  </Text>
                </TouchableOpacity>
              </SafeAreaView>
            </View>
          </ImageBackground>

          {/* Date Picker Modal */}
          <DateTimePickerModal
            isVisible={isDatePickerVisible}
            mode="date"
            onConfirm={handleConfirm}
            onCancel={hideDatePicker}
          />

          {/* Navigation Buttons */}
          <View style={styles.navigationButtonsContainer}>
            <TouchableOpacity
              style={styles.navigationButton}
              onPress={() => handleNavigation("all")}
              accessibilityLabel="View all aircraft"
              accessibilityRole="button"
            >
              <Octicons name="paper-airplane" size={32} color="#3182ce" />
              <Text>All</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.navigationButton}
              onPress={() => handleNavigation("jets")}
              accessibilityLabel="View jets"
              accessibilityRole="button"
            >
              <Ionicons name="airplane-outline" size={32} color="#3182ce" />
              <Text>Jets</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.navigationButton}
              onPress={() => handleNavigation("pistons")}
              accessibilityLabel="View piston aircraft"
              accessibilityRole="button"
            >
              <MaterialCommunityIcons
                name="engine-outline"
                size={32}
                color="#3182ce"
              />
              <Text>Pistons</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.navigationButton}
              onPress={() => handleNavigation("helicopters")}
              accessibilityLabel="View helicopters"
              accessibilityRole="button"
            >
              <Fontisto name="helicopter" size={32} color="#3182ce" />
              <Text>Helicopters</Text>
            </TouchableOpacity>
          </View>

          {/* Recent Searches */}
          <View style={styles.sectionContainer}>
            <Text style={styles.sectionTitle}>Recent Searches</Text>
            <View style={styles.recentSearchesRow}>
              <View style={styles.recentSearchBox}>
                <Text>Van Nuys Airport</Text>
                <Text style={styles.recentSearchDetails}>
                  3 guests · 9/10/23-9/17/23
                </Text>
              </View>
              <View style={styles.recentSearchBox}>
                <Text>Santa Monica Airport</Text>
                <Text style={styles.recentSearchDetails}>
                  2 guests · 9/18/23-9/25/23
                </Text>
              </View>
            </View>
          </View>

          {/* Aircraft Types */}
          <View style={styles.sectionContainer}>
            <Text style={styles.sectionTitle}>Aircraft Types</Text>
            <View style={styles.aircraftTypesRow}>
              <TouchableOpacity
                style={[styles.aircraftTypeButton, { marginRight: 8 }]}
                onPress={() => handleNavigation("single-piston")}
                accessibilityLabel="View single engine piston aircraft"
                accessibilityRole="button"
              >
                <Text style={styles.aircraftTypeText}>
                  Single Engine Piston
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.aircraftTypeButton}
                onPress={() => handleNavigation("twin-piston")}
                accessibilityLabel="View twin engine piston aircraft"
                accessibilityRole="button"
              >
                <Text style={styles.aircraftTypeText}>
                  Twin Engine Piston
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Recommended for You */}
          <View style={styles.sectionContainer}>
            <Text style={styles.sectionTitle}>Recommended for you</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {/* Cessna 172 */}
              <TouchableOpacity
                style={styles.recommendedBox}
                onPress={() => {
                  setSelectedListingId("cessna-172-id"); // Set dynamic Listing ID
                  setSelectedListingName("Cessna 172"); // Optional: Set aircraft name
                  handleNavigation("cessna-172");
                }}
                accessibilityLabel="Select Cessna 172"
                accessibilityRole="button"
              >
                <Image
                  source={require("../../Assets/images/recommended1.jpg")}
                  style={styles.recommendedImage}
                  resizeMode="cover"
                />
                <Text style={styles.recommendedText}>Cessna 172</Text>
              </TouchableOpacity>

              {/* Beechcraft Baron */}
              <TouchableOpacity
                style={styles.recommendedBox}
                onPress={() => {
                  setSelectedListingId("beechcraft-baron-id"); // Set dynamic Listing ID
                  setSelectedListingName("Beechcraft Baron"); // Optional: Set aircraft name
                  handleNavigation("beechcraft-baron");
                }}
                accessibilityLabel="Select Beechcraft Baron"
                accessibilityRole="button"
              >
                <Image
                  source={require("../../Assets/images/recommended2.jpg")}
                  style={styles.recommendedImage}
                  resizeMode="cover"
                />
                <Text style={styles.recommendedText}>Beechcraft Baron</Text>
              </TouchableOpacity>

              {/* Cirrus SR22 */}
              <TouchableOpacity
                style={styles.recommendedBox}
                onPress={() => {
                  setSelectedListingId("cirrus-sr22-id"); // Set dynamic Listing ID
                  setSelectedListingName("Cirrus SR22"); // Optional: Set aircraft name
                  handleNavigation("cirrus-sr22");
                }}
                accessibilityLabel="Select Cirrus SR22"
                accessibilityRole="button"
              >
                <Image
                  source={require("../../Assets/images/recommended3.jpg")}
                  style={styles.recommendedImage}
                  resizeMode="cover"
                />
                <Text style={styles.recommendedText}>Cirrus SR22</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>

          {/* Active Rentals */}
          <View style={styles.sectionContainer}>
            <Text style={styles.sectionTitle}>Active Rentals</Text>
            {rentals.length > 0 ? (
              <>
                <FlatList
                  data={rentals}
                  keyExtractor={(item, index) => `${item.id}_${index}`}
                  renderItem={renderRentalItem}
                  ListFooterComponent={
                    hasMoreRentals ? (
                      <ActivityIndicator
                        size="large"
                        color="#3182ce"
                        style={{ marginVertical: 16 }}
                      />
                    ) : (
                      <Text style={styles.noMoreRentalsText}>
                        No more rentals to load.
                      </Text>
                    )
                  }
                  onEndReached={fetchMoreRentals}
                  onEndReachedThreshold={0.5}
                  scrollEnabled={false}
                />

                {hasMoreRentals && (
                  <TouchableOpacity
                    onPress={fetchMoreRentals}
                    style={styles.loadMoreRentalsButton}
                    accessibilityLabel="Load more rentals"
                    accessibilityRole="button"
                  >
                    <Text style={styles.loadMoreRentalsButtonText}>
                      Load More
                    </Text>
                  </TouchableOpacity>
                )}
              </>
            ) : (
              <Text style={styles.noActiveRentalsText}>
                No active rentals at the moment.
              </Text>
            )}
          </View>

          {/* Notifications */}
          <View style={styles.sectionContainer}>
            <Text style={styles.sectionTitle}>Notifications</Text>
            {allNotifications.length > 0 ? (
              <FlatList
                data={allNotifications}
                keyExtractor={(item, index) => `${item.id}_${index}`}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    key={item.id}
                    style={styles.notificationBox}
                    onPress={() => {
                      handleNotificationPress(item);
                      setAllNotificationsModalVisible(false);
                    }}
                    accessibilityLabel={`View details for notification: ${item.message}`}
                    accessibilityRole="button"
                  >
                    <Text style={styles.notificationMessageText}>
                      {item.message}
                    </Text>
                    <Text style={styles.notificationDateText}>
                      {item.createdAt
                        ? item.createdAt.toDate
                          ? item.createdAt.toDate().toLocaleString()
                          : new Date(item.createdAt).toLocaleString()
                        : "N/A"}
                    </Text>
                  </TouchableOpacity>
                )}
                ListFooterComponent={
                  hasMoreNotifications ? (
                    <ActivityIndicator
                      size="large"
                      color="#3182ce"
                      style={{ marginVertical: 16 }}
                    />
                  ) : (
                    <Text style={styles.noMoreNotificationsText}>
                      No more notifications to load.
                    </Text>
                  )
                }
                onEndReached={fetchMoreNotifications}
                onEndReachedThreshold={0.5}
                scrollEnabled={false}
              />
            ) : (
              <Text style={styles.noNotificationsText}>
                No notifications available.
              </Text>
            )}

            {/* "Remove All" Button */}
            {allNotifications.length > 0 && (
              <TouchableOpacity
                onPress={removeAllNotifications}
                style={styles.removeAllNotificationsButton}
                accessibilityLabel="Remove all notifications"
                accessibilityRole="button"
              >
                <Text style={styles.removeAllNotificationsButtonText}>
                  Remove All
                </Text>
              </TouchableOpacity>
            )}

            {/* "View All" Button */}
            {allNotifications.length > 3 && (
              <TouchableOpacity
                onPress={() => setAllNotificationsModalVisible(true)}
                style={styles.viewAllNotificationsButton}
                accessibilityLabel="View all notifications"
                accessibilityRole="button"
              >
                <Text style={styles.viewAllNotificationsButtonText}>
                  View All
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </ScrollView>
      ) : (
        // If user is not authenticated, display a message or navigate to login
        <View style={styles.notAuthenticatedContainer}>
          <Text style={styles.notAuthenticatedText}>
            You are not authenticated. Please log in to continue.
          </Text>
          <TouchableOpacity
            onPress={() => {
              // Replace this with your navigation logic to the login screen
              // For example:
              navigation.navigate("Login");
            }}
            style={styles.goToLoginButton}
            accessibilityLabel="Navigate to login screen"
            accessibilityRole="button"
          >
            <Text style={styles.goToLoginButtonText}>Go to Login</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Profile Information */}
      {profileSaved && renterId && (
        <View style={styles.profileContainer}>
          <Text style={styles.profileTitle}>Profile Information</Text>
          <View style={styles.profileRow}>
            <Text style={styles.profileLabel}>Name:</Text>
            <Text style={styles.profileValue}>{profileData.name}</Text>
          </View>
          {profileData.image && (
            <Image
              source={{ uri: profileData.image }}
              style={styles.profileImage}
            />
          )}
        </View>
      )}

      {/* Messages Modal */}
      <Modal
        visible={messagesModalVisible}
        animationType="slide"
        transparent={false} // Changed from true to false
        presentationStyle="fullScreen" // Ensure full-screen presentation
        onRequestClose={() => setMessagesModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.messageModalContainer}
        >
          {/* Header */}
          <View style={styles.messagesHeader}>
            <TouchableOpacity
              onPress={() => setMessagesModalVisible(false)}
              style={styles.closeModalButton}
              accessibilityLabel="Close messages"
              accessibilityRole="button"
            >
              <Ionicons name="arrow-back" size={24} color="#2d3748" />
            </TouchableOpacity>
            <Text style={styles.messagesTitle}>Messages</Text>
            {/* Placeholder for alignment */}
            <View style={{ width: 24 }} />
          </View>

          {/* Messages List */}
          <FlatList
            data={messages}
            keyExtractor={(item, index) =>
              `${item.senderId}_${item.timestamp?.seconds}_${item.timestamp?.nanoseconds}_${index}`
            }
            renderItem={({ item }) => (
              <View
                style={[
                  styles.chatBubble,
                  item.senderId === renterId
                    ? styles.chatBubbleRight
                    : styles.chatBubbleLeft,
                ]}
              >
                <Text style={styles.chatSenderName}>
                  {item.senderName}:
                </Text>
                <Text style={styles.chatMessageText}>{item.text}</Text>
                <Text style={styles.chatTimestamp}>
                  {item.timestamp
                    ? item.timestamp.toDate
                      ? item.timestamp.toDate().toLocaleString()
                      : new Date(item.timestamp).toLocaleString()
                    : "N/A"}
                </Text>
              </View>
            )}
            contentContainerStyle={styles.messagesList}
            style={{ flex: 1, width: "100%" }}
          />

          {/* Message Input */}
          <View style={styles.messageInputContainer}>
            <TextInput
              placeholder="Type your message..."
              value={messageText}
              onChangeText={(text) => setMessageText(text)}
              style={styles.messageTextInput}
              keyboardType="default"
              autoCapitalize="none"
              accessibilityLabel="Type a message"
            />
            <TouchableOpacity
              onPress={sendMessage}
              style={styles.sendButton}
              accessibilityLabel="Send message"
              accessibilityRole="button"
            >
              <Ionicons name="send" size={24} color="white" />
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Notification Modal */}
      <Modal
        visible={notificationModalVisible}
        animationType="slide"
        transparent={false}
        presentationStyle="fullScreen"
        onRequestClose={closeModal}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={{ flex: 1 }}
        >
          <View style={styles.notificationModalContainer}>
            <TouchableOpacity
              onPress={closeModal}
              style={styles.closeModalButton}
              accessibilityLabel="Close notification"
              accessibilityRole="button"
            >
              <Ionicons name="close-circle" size={32} color="#2d3748" />
            </TouchableOpacity>

            {isRentalRequestLoading ? (
              <ActivityIndicator
                size="large"
                color="#3182ce"
                style={{ marginTop: 20 }}
              />
            ) : selectedRentalRequest ? (
              <ScrollView contentContainerStyle={{ padding: 16 }}>
                {/* Rental Request Details */}
                <Text style={styles.notificationDetailsTitle}>
                  Rental Request Details
                </Text>
                <View style={styles.notificationDetailBox}>
                  <Text style={styles.detailLabel}>Message:</Text>
                  <Text style={styles.detailValue}>
                    {selectedNotification?.message || "Rental Request"}
                  </Text>
                </View>
                <View style={styles.notificationDetailBox}>
                  <Text style={styles.detailLabel}>From:</Text>
                  <Text style={styles.detailValue}>
                    {selectedRentalRequest.ownerName || "Unknown Owner"}
                  </Text>
                </View>
                <View style={styles.notificationDetailBox}>
                  <Text style={styles.detailLabel}>Date:</Text>
                  <Text style={styles.detailValue}>
                    {selectedRentalRequest.rentalDate || "N/A"}
                  </Text>
                </View>

                {/* Rental Details */}
                {selectedRentalRequest && selectedListing && (
                  <View style={styles.notificationDetailBox}>
                    <Text style={styles.detailLabel}>Rental Details:</Text>
                    <Text style={styles.detailValue}>
                      Aircraft Model: {selectedListing.aircraftModel || "N/A"}
                    </Text>
                    <Text style={styles.detailValue}>
                      Tail Number: {selectedListing.tailNumber || "N/A"}
                    </Text>
                    <Text style={styles.detailValue}>
                      Rental Hours: {selectedRentalRequest.rentalHours || "N/A"}
                    </Text>
                    <Text style={styles.detailValue}>
                      Rental Date: {selectedRentalRequest.rentalDate || "N/A"}
                    </Text>

                    {/* Display Total Cost Breakdown */}
                    {totalCost !== undefined && totalCost !== null ? (
                      <View style={{ marginTop: 8 }}>
                        <Text style={styles.detailLabel}>Cost Breakdown:</Text>
                        <Text style={styles.detailValue}>
                          Rental Cost (${selectedListing.costPerHour}/hr * {selectedRentalRequest.rentalHours} hours): $
                          {safeToFixed(totalCost.rentalCost)}
                        </Text>
                        <Text style={styles.detailValue}>
                          Booking Fee (6%): ${safeToFixed(totalCost.bookingFee)}
                        </Text>
                        <Text style={styles.detailValue}>
                          Transaction Fee (3%): ${safeToFixed(
                            totalCost.transactionFee
                          )}
                        </Text>
                        <Text style={styles.detailValue}>
                          Sales Tax (8.25%): ${safeToFixed(totalCost.salesTax)}
                        </Text>
                        <Text style={styles.detailTotalCostText}>
                          Total Cost: ${safeToFixed(totalCost.total)}
                        </Text>
                      </View>
                    ) : (
                      <Text style={styles.detailValue}>Total Cost: N/A</Text>
                    )}
                  </View>
                )}

                {/* Proceed to Pay Button */}
                {selectedRentalRequest && (
                  <TouchableOpacity
                    onPress={() =>
                      navigateToCheckout(
                        selectedNotification?.rentalRequestId ||
                          selectedNotification?.rentalRequest
                      )
                    }
                    style={styles.proceedToPayButton}
                    accessibilityLabel="Proceed to payment"
                    accessibilityRole="button"
                  >
                    <Text style={styles.proceedToPayButtonText}>
                      Proceed to Pay
                    </Text>
                  </TouchableOpacity>
                )}

                {/* Message Owner Button */}
                {selectedRentalRequest?.ownerId && (
                  <TouchableOpacity
                    onPress={() => {
                      setCurrentChatOwnerId(selectedRentalRequest.ownerId);
                      setMessagesModalVisible(true);
                    }}
                    style={[
                      styles.messageOwnerButton,
                      !paymentComplete && styles.disabledButton,
                    ]}
                    accessibilityLabel="Message Owner"
                    accessibilityRole="button"
                    disabled={!paymentComplete}
                  >
                    <Text
                      style={[
                        styles.messageOwnerButtonText,
                        !paymentComplete && styles.disabledButtonText,
                      ]}
                    >
                      Message Owner
                    </Text>
                  </TouchableOpacity>
                )}

                {/* Close Button */}
                <TouchableOpacity
                  onPress={closeModal}
                  style={styles.closeNotificationModalButton}
                  accessibilityLabel="Close notification modal"
                  accessibilityRole="button"
                >
                  <Text style={styles.closeNotificationModalButtonText}>
                    Close
                  </Text>
                </TouchableOpacity>
              </ScrollView>
            ) : selectedNotification ? (
              <ScrollView contentContainerStyle={{ padding: 16 }}>
                {/* General Notification Details */}
                <Text style={styles.notificationDetailsTitle}>
                  Notification Details
                </Text>
                <View style={styles.notificationDetailBox}>
                  <Text style={styles.detailLabel}>Message:</Text>
                  <Text style={styles.detailValue}>
                    {selectedNotification.message}
                  </Text>
                </View>
                <View style={styles.notificationDetailBox}>
                  <Text style={styles.detailLabel}>From:</Text>
                  <Text style={styles.detailValue}>
                    {selectedNotification.ownerName || "Unknown Owner"}
                  </Text>
                </View>
                <View style={styles.notificationDetailBox}>
                  <Text style={styles.detailLabel}>Date:</Text>
                  <Text style={styles.detailValue}>
                    {selectedNotification.createdAt
                      ? selectedNotification.createdAt.toDate
                        ? selectedNotification.createdAt.toDate().toLocaleString()
                        : new Date(selectedNotification.createdAt).toLocaleString()
                      : "N/A"}
                  </Text>
                </View>

                {/* Additional details for general notification if any */}
                {/* ... */}

                {/* Close Button */}
                <TouchableOpacity
                  onPress={closeModal}
                  style={styles.closeNotificationModalButton}
                  accessibilityLabel="Close notification modal"
                  accessibilityRole="button"
                >
                  <Text style={styles.closeNotificationModalButtonText}>
                    Close
                  </Text>
                </TouchableOpacity>
              </ScrollView>
            ) : (
              <ActivityIndicator size="large" color="#3182ce" />
            )}
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* All Notifications Modal */}
      <Modal
        visible={allNotificationsModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setAllNotificationsModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={{ flex: 1 }}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.allNotificationsModalContainer}>
              {/* Close Button */}
              <TouchableOpacity
                onPress={() => setAllNotificationsModalVisible(false)}
                style={styles.closeModalButton}
                accessibilityLabel="Close all notifications"
                accessibilityRole="button"
              >
                <Ionicons name="close-circle" size={32} color="#2d3748" />
              </TouchableOpacity>

              {/* All Notifications Title */}
              <Text style={styles.allNotificationsTitle}>
                All Notifications
              </Text>

              {/* Notifications List */}
              {allNotifications.length > 0 ? (
                <FlatList
                  data={allNotifications}
                  keyExtractor={(item, index) => `${item.id}_${index}`}
                  renderItem={({ item }) => (
                    <TouchableOpacity
                      key={item.id}
                      style={styles.notificationBox}
                      onPress={() => {
                        handleNotificationPress(item);
                        setAllNotificationsModalVisible(false);
                      }}
                      accessibilityLabel={`View details for notification: ${item.message}`}
                      accessibilityRole="button"
                    >
                      <Text style={styles.notificationMessageText}>
                        {item.message}
                      </Text>
                      <Text style={styles.notificationDateText}>
                        {item.createdAt
                          ? item.createdAt.toDate
                            ? item.createdAt.toDate().toLocaleString()
                            : new Date(item.createdAt).toLocaleString()
                          : "N/A"}
                      </Text>
                    </TouchableOpacity>
                  )}
                  ListFooterComponent={
                    hasMoreNotifications ? (
                      <ActivityIndicator
                        size="large"
                        color="#3182ce"
                        style={{ marginVertical: 16 }}
                      />
                    ) : (
                      <Text style={styles.noMoreNotificationsText}>
                        No more notifications to load.
                      </Text>
                    )
                  }
                  onEndReached={fetchMoreNotifications}
                  onEndReachedThreshold={0.5}
                  scrollEnabled={false}
                />
              ) : (
                <Text style={styles.noNotificationsText}>
                  No notifications available.
                </Text>
              )}
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Chat Bubble Icon */}
      <TouchableOpacity
        style={styles.chatBubbleIcon}
        onPress={toggleMessagesModal}
        accessibilityLabel="Open messages"
        accessibilityRole="button"
      >
        <Ionicons name="chatbubble-ellipses" size={32} color="white" />
      </TouchableOpacity>
    </View>
  );
};

export default BookingCalendar;

// Stylesheet
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f7fafc",
  },
  safeArea: {
    flex: 0,
    backgroundColor: "#f7fafc",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  headerImage: {
    width: "100%",
    height: 200,
    justifyContent: "center",
  },
  headerOverlay: {
    backgroundColor: "rgba(0,0,0,0.3)",
    flex: 1,
    justifyContent: "center",
  },
  headerContent: {
    padding: 16,
  },
  greetingText: {
    fontSize: 24,
    color: "#fff",
    marginBottom: 16,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  datePickerButton: {
    backgroundColor: "#3182ce",
    padding: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  datePickerText: {
    color: "#fff",
  },
  hoursInput: {
    backgroundColor: "#3182ce",
    padding: 8,
    borderRadius: 4,
    color: "#fff",
    width: 80,
  },
  locationButton: {
    backgroundColor: "#3182ce",
    padding: 8,
    borderRadius: 4,
    marginTop: 8,
  },
  locationText: {
    color: "#fff",
  },
  navigationButtonsContainer: {
    flexDirection: "row",
    justifyContent: "space-around",
    paddingVertical: 16,
  },
  navigationButton: {
    alignItems: "center",
  },
  recentSearchesRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  recentSearchBox: {
    backgroundColor: "#edf2f7",
    padding: 12,
    borderRadius: 8,
    width: "48%",
  },
  recentSearchDetails: {
    color: "#a0aec0",
    marginTop: 4,
  },
  aircraftTypesRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  aircraftTypeButton: {
    backgroundColor: "#edf2f7",
    padding: 12,
    borderRadius: 8,
    flex: 1,
    alignItems: "center",
  },
  aircraftTypeText: {
    color: "#2d3748",
  },
  recommendedBox: {
    marginRight: 16,
    alignItems: "center",
  },
  recommendedImage: {
    width: 150,
    height: 100,
    borderRadius: 8,
  },
  recommendedText: {
    marginTop: 8,
    fontSize: 16,
    color: "#2d3748",
  },
  rentalBox: {
    backgroundColor: "#edf2f7",
    padding: 16,
    borderRadius: 8,
    marginBottom: 12,
  },
  rentalAircraftModel: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#2d3748",
  },
  rentalStatus: {
    fontSize: 14,
    color: "#4a5568",
    marginVertical: 4,
  },
  rentalTotalCost: {
    fontSize: 16,
    color: "#2b6cb0",
    fontWeight: "bold",
  },
  noMoreRentalsText: {
    textAlign: "center",
    color: "#a0aec0",
    marginVertical: 16,
  },
  loadMoreRentalsButton: {
    backgroundColor: "#3182ce",
    padding: 12,
    borderRadius: 8,
    alignItems: "center",
    marginVertical: 8,
  },
  loadMoreRentalsButtonText: {
    color: "#fff",
    fontSize: 16,
  },
  noActiveRentalsText: {
    textAlign: "center",
    color: "#a0aec0",
    marginTop: 8,
  },
  sectionContainer: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#2d3748",
    marginBottom: 8,
  },
  notificationBox: {
    backgroundColor: "#edf2f7",
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  notificationMessageText: {
    fontSize: 16,
    color: "#2d3748",
  },
  notificationDateText: {
    fontSize: 12,
    color: "#a0aec0",
    marginTop: 4,
  },
  noMoreNotificationsText: {
    textAlign: "center",
    color: "#a0aec0",
    marginVertical: 16,
  },
  noNotificationsText: {
    textAlign: "center",
    color: "#a0aec0",
    marginTop: 8,
  },
  removeAllNotificationsButton: {
    backgroundColor: "#e53e3e",
    padding: 12,
    borderRadius: 8,
    alignItems: "center",
    marginTop: 8,
  },
  removeAllNotificationsButtonText: {
    color: "#fff",
    fontSize: 16,
  },
  viewAllNotificationsButton: {
    backgroundColor: "#3182ce",
    padding: 12,
    borderRadius: 8,
    alignItems: "center",
    marginTop: 8,
  },
  viewAllNotificationsButtonText: {
    color: "#fff",
    fontSize: 16,
  },
  notAuthenticatedContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 16,
  },
  notAuthenticatedText: {
    fontSize: 18,
    color: "#2d3748",
    textAlign: "center",
    marginBottom: 16,
  },
  goToLoginButton: {
    backgroundColor: "#3182ce",
    padding: 12,
    borderRadius: 8,
  },
  goToLoginButtonText: {
    color: "#fff",
    fontSize: 16,
  },
  profileContainer: {
    backgroundColor: "#edf2f7",
    padding: 16,
    borderRadius: 8,
    margin: 16,
  },
  profileTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#2d3748",
    marginBottom: 8,
  },
  profileRow: {
    flexDirection: "row",
    marginBottom: 4,
  },
  profileLabel: {
    fontWeight: "bold",
    color: "#2d3748",
    marginRight: 8,
  },
  profileValue: {
    color: "#2d3748",
  },
  profileImage: {
    width: 100,
    height: 100,
    borderRadius: 50,
    marginTop: 8,
  },
  messageModalContainer: {
    flex: 1,
    backgroundColor: "#fff",
  },
  messagesHeader: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    backgroundColor: "#edf2f7",
  },
  closeModalButton: {
    padding: 8,
  },
  messagesTitle: {
    flex: 1,
    textAlign: "center",
    fontSize: 20,
    fontWeight: "bold",
    color: "#2d3748",
  },
  chatBubble: {
    maxWidth: "70%",
    padding: 10,
    borderRadius: 8,
    marginVertical: 4,
    marginHorizontal: 8,
  },
  chatBubbleLeft: {
    backgroundColor: "#edf2f7",
    alignSelf: "flex-start",
  },
  chatBubbleRight: {
    backgroundColor: "#3182ce",
    alignSelf: "flex-end",
  },
  chatSenderName: {
    fontWeight: "bold",
    color: "#2d3748",
  },
  chatMessageText: {
    color: "#fff",
  },
  chatTimestamp: {
    fontSize: 10,
    color: "#a0aec0",
    marginTop: 4,
    textAlign: "right",
  },
  messagesList: {
    padding: 16,
  },
  messageInputContainer: {
    flexDirection: "row",
    padding: 16,
    borderTopWidth: 1,
    borderColor: "#e2e8f0",
    alignItems: "center",
    backgroundColor: "#fff",
  },
  messageTextInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#cbd5e0",
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginRight: 8,
  },
  sendButton: {
    backgroundColor: "#3182ce",
    padding: 12,
    borderRadius: 20,
  },
  notificationModalContainer: {
    flex: 1,
    padding: 16,
    backgroundColor: "#fff",
  },
  notificationDetailsTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#2d3748",
    marginBottom: 12,
  },
  notificationDetailBox: {
    marginBottom: 12,
  },
  detailLabel: {
    fontWeight: "bold",
    color: "#2d3748",
  },
  detailValue: {
    color: "#2d3748",
    marginTop: 4,
  },
  detailTotalCostText: {
    fontWeight: "bold",
    color: "#2b6cb0",
    marginTop: 8,
    fontSize: 16,
  },
  proceedToPayButton: {
    backgroundColor: "#48bb78",
    padding: 16,
    borderRadius: 8,
    alignItems: "center",
    marginTop: 16,
  },
  proceedToPayButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
  },
  messageOwnerButton: {
    backgroundColor: "#3182ce",
    padding: 16,
    borderRadius: 8,
    alignItems: "center",
    marginTop: 8,
  },
  messageOwnerButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
  },
  disabledButton: {
    backgroundColor: "#a0aec0",
  },
  disabledButtonText: {
    color: "#fff",
  },
  closeNotificationModalButton: {
    backgroundColor: "#e53e3e",
    padding: 12,
    borderRadius: 8,
    alignItems: "center",
    marginTop: 16,
  },
  closeNotificationModalButtonText: {
    color: "#fff",
    fontSize: 16,
  },
  allNotificationsModalContainer: {
    flex: 1,
    padding: 16,
    backgroundColor: "#fff",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  allNotificationsTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#2d3748",
    marginBottom: 16,
    textAlign: "center",
  },
  chatBubbleIcon: {
    position: "absolute",
    bottom: 32,
    right: 32,
    backgroundColor: "#3182ce",
    padding: 12,
    borderRadius: 24,
    elevation: 5,
  },
});
