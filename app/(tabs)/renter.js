// src/components/BookingCalendar.js

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

import { useRouter } from "expo-router"; // Use Expo Router's useRouter

import DateTimePickerModal from "react-native-modal-datetime-picker";

// Removed direct import of CheckoutScreen
// import CheckoutScreen from "../payment/CheckoutScreen"; // Removed
import ConfirmationScreen from "../payment/ConfirmationScreen";
import MessagesScreen from "../screens/MessagesScreen";

// Define API_URL directly
const API_URL = "https://us-central1-ready-set-fly-71506.cloudfunctions.net/api";

// Import Firebase configuration
import { db, auth } from "../../firebaseConfig"; // Adjust the path as necessary

const BookingCalendar = () => {
  const router = useRouter(); // Initialize Expo Router
  // Removed React Navigation's useNavigation

  // [All your existing state variables...]

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

  // New State for Debouncing Payment Intent Creation
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);

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
    if (isProcessingPayment) {
      // If a payment is already being processed, do not proceed
      console.warn("Payment is already being processed.");
      return;
    }

    if (!rentalRequestId) {
      Alert.alert("Error", "No rental request selected.");
      return;
    }

    try {
      console.log(`Navigating to CheckoutScreen with Rental Request ID: ${rentalRequestId}`);
      // Navigate using Expo Router's router.push with the correct path
      router.push({
        pathname: "/payment/CheckoutScreen", // Adjust the path based on your file structure
        params: { rentalRequestId },
      });
    } catch (error) {
      console.error("Error navigating to CheckoutScreen:", error);
      Alert.alert("Error", "Failed to navigate to payment screen.");
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

  /**
   * Handle Navigation based on filter
   * Moved inside the component to access 'router'
   */
  const handleNavigationInternal = (filter) => {
    // Implement navigation logic based on filter
    // Example:
    if (filter === "all") {
      router.push("/AllAircraftScreen"); // Adjust path as per your file structure
    } else if (filter === "jets") {
      router.push("/JetsScreen"); // Adjust path as per your file structure
    } else if (filter === "pistons") {
      router.push("/PistonsScreen"); // Adjust path as per your file structure
    } else if (filter === "helicopters") {
      router.push("/HelicoptersScreen"); // Adjust path as per your file structure
    } else if (filter === "cessna-172") {
      // If you have specific screens for recommended listings
      router.push("/payment/CheckoutScreen"); // Adjust path as per your file structure
    } else if (filter === "beechcraft-baron") {
      router.push("/payment/CheckoutScreen"); // Adjust path as per your file structure
    } else if (filter === "cirrus-sr22") {
      router.push("/payment/CheckoutScreen"); // Adjust path as per your file structure
    }
    // Add more navigation cases as needed
  };

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
              onPress={() => handleNavigationInternal("all")}
              accessibilityLabel="View all aircraft"
              accessibilityRole="button"
            >
              <Octicons name="paper-airplane" size={32} color="#3182ce" />
              <Text>All</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.navigationButton}
              onPress={() => handleNavigationInternal("jets")}
              accessibilityLabel="View jets"
              accessibilityRole="button"
            >
              <Ionicons name="airplane-outline" size={32} color="#3182ce" />
              <Text>Jets</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.navigationButton}
              onPress={() => handleNavigationInternal("pistons")}
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
              onPress={() => handleNavigationInternal("helicopters")}
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
                onPress={() => handleNavigationInternal("single-piston")}
                accessibilityLabel="View single engine piston aircraft"
                accessibilityRole="button"
              >
                <Text style={styles.aircraftTypeText}>
                  Single Engine Piston
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.aircraftTypeButton}
                onPress={() => handleNavigationInternal("twin-piston")}
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
                  handleNavigationInternal("cessna-172");
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
                  handleNavigationInternal("beechcraft-baron");
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
                  handleNavigationInternal("cirrus-sr22");
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
              router.push("/sign-in"); // Adjust the path as per your file structure
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
                    style={[
                      styles.proceedToPayButton,
                      isProcessingPayment && styles.disabledButton,
                    ]}
                    accessibilityLabel="Proceed to payment"
                    accessibilityRole="button"
                    disabled={isProcessingPayment} // Disable button while processing
                  >
                    {isProcessingPayment ? (
                      <ActivityIndicator
                        size="small"
                        color="#fff"
                      />
                    ) : (
                      <Text style={styles.proceedToPayButtonText}>
                        Proceed to Pay
                      </Text>
                    )}
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

// Stylesheet (styles)
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'white',
  },
  safeArea: {
    flex: 0,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingBottom: 16,
  },
  headerImage: {
    width: '100%',
    height: 200,
    justifyContent: 'center',
  },
  headerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)', // Semi-transparent overlay
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerContent: {
    width: '90%',
  },
  greetingText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 10,
    textAlign: 'center',
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  datePickerButton: {
    backgroundColor: '#3182ce',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  datePickerText: {
    color: '#fff',
    fontSize: 16,
  },
  hoursInput: {
    backgroundColor: '#3182ce',
    color: '#fff',
    paddingVertical: 10,
    paddingHorizontal: 15,
    borderRadius: 8,
    width: 100,
    textAlign: 'center',
    fontSize: 16,
  },
  locationButton: {
    backgroundColor: '#3182ce',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
    marginTop: 10,
  },
  locationText: {
    color: '#fff',
    fontSize: 16,
    textAlign: 'center',
  },
  navigationButtonsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginVertical: 20,
  },
  navigationButton: {
    alignItems: 'center',
  },
  sectionContainer: {
    marginHorizontal: 20,
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#2d3748',
  },
  recentSearchesRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  recentSearchBox: {
    backgroundColor: '#f7fafc',
    padding: 15,
    borderRadius: 8,
    width: '48%',
  },
  recentSearchDetails: {
    color: '#718096',
    marginTop: 5,
  },
  aircraftTypesRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  aircraftTypeButton: {
    backgroundColor: '#edf2f7',
    padding: 15,
    borderRadius: 8,
    flex: 1,
  },
  aircraftTypeText: {
    textAlign: 'center',
    color: '#2d3748',
    fontWeight: '500',
  },
  recommendedBox: {
    marginRight: 15,
    alignItems: 'center',
    width: 150,
  },
  recommendedImage: {
    width: 150,
    height: 100,
    borderRadius: 8,
  },
  recommendedText: {
    marginTop: 5,
    fontSize: 16,
    color: '#2d3748',
    textAlign: 'center',
  },
  rentalBox: {
    backgroundColor: '#edf2f7',
    padding: 15,
    borderRadius: 8,
    marginBottom: 10,
  },
  rentalAircraftModel: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2d3748',
  },
  rentalStatus: {
    fontSize: 14,
    color: '#718096',
    marginVertical: 5,
  },
  rentalTotalCost: {
    fontSize: 14,
    color: '#2d3748',
  },
  noMoreRentalsText: {
    textAlign: 'center',
    color: '#a0aec0',
    marginVertical: 10,
  },
  loadMoreRentalsButton: {
    backgroundColor: '#3182ce',
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 10,
  },
  loadMoreRentalsButtonText: {
    color: '#fff',
    fontSize: 16,
  },
  noActiveRentalsText: {
    textAlign: 'center',
    color: '#a0aec0',
    fontSize: 16,
  },
  notificationBox: {
    backgroundColor: '#f7fafc',
    padding: 15,
    borderRadius: 8,
    marginBottom: 10,
  },
  notificationMessageText: {
    fontSize: 16,
    color: '#2d3748',
  },
  notificationDateText: {
    fontSize: 12,
    color: '#a0aec0',
    marginTop: 5,
  },
  noMoreNotificationsText: {
    textAlign: 'center',
    color: '#a0aec0',
    marginVertical: 10,
  },
  noNotificationsText: {
    textAlign: 'center',
    color: '#a0aec0',
    fontSize: 16,
  },
  removeAllNotificationsButton: {
    backgroundColor: '#e53e3e',
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 10,
  },
  removeAllNotificationsButtonText: {
    color: '#fff',
    fontSize: 16,
  },
  viewAllNotificationsButton: {
    backgroundColor: '#3182ce',
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 10,
  },
  viewAllNotificationsButtonText: {
    color: '#fff',
    fontSize: 16,
  },
  notAuthenticatedContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  notAuthenticatedText: {
    fontSize: 18,
    textAlign: 'center',
    marginBottom: 20,
    color: '#2d3748',
  },
  goToLoginButton: {
    backgroundColor: '#3182ce',
    paddingVertical: 15,
    paddingHorizontal: 30,
    borderRadius: 8,
  },
  goToLoginButtonText: {
    color: '#fff',
    fontSize: 16,
  },
  profileContainer: {
    position: 'absolute',
    bottom: 20,
    left: 20,
    right: 20,
    backgroundColor: '#edf2f7',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
  },
  profileTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#2d3748',
  },
  profileRow: {
    flexDirection: 'row',
    marginBottom: 5,
  },
  profileLabel: {
    fontWeight: '500',
    color: '#2d3748',
  },
  profileValue: {
    marginLeft: 5,
    color: '#2d3748',
  },
  profileImage: {
    width: 100,
    height: 100,
    borderRadius: 50,
    marginTop: 10,
  },
  messageModalContainer: {
    flex: 1,
  },
  messagesHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    backgroundColor: '#edf2f7',
  },
  closeModalButton: {
    padding: 5,
  },
  messagesTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2d3748',
  },
  chatBubble: {
    maxWidth: '80%',
    padding: 10,
    borderRadius: 10,
    marginVertical: 5,
  },
  chatBubbleLeft: {
    backgroundColor: '#edf2f7',
    alignSelf: 'flex-start',
  },
  chatBubbleRight: {
    backgroundColor: '#3182ce',
    alignSelf: 'flex-end',
  },
  chatSenderName: {
    fontWeight: 'bold',
    color: '#2d3748',
    marginBottom: 2,
  },
  chatMessageText: {
    color: '#2d3748',
  },
  chatTimestamp: {
    fontSize: 10,
    color: '#a0aec0',
    marginTop: 2,
    textAlign: 'right',
  },
  messagesList: {
    padding: 10,
  },
  messageInputContainer: {
    flexDirection: 'row',
    padding: 10,
    backgroundColor: '#edf2f7',
    alignItems: 'center',
  },
  messageTextInput: {
    flex: 1,
    backgroundColor: '#fff',
    paddingVertical: 10,
    paddingHorizontal: 15,
    borderRadius: 20,
    fontSize: 16,
    marginRight: 10,
  },
  sendButton: {
    backgroundColor: '#3182ce',
    padding: 10,
    borderRadius: 20,
  },
  notificationModalContainer: {
    flex: 1,
  },
  detailLabel: {
    fontWeight: 'bold',
    color: '#2d3748',
  },
  detailValue: {
    color: '#2d3748',
    marginBottom: 5,
  },
  notificationDetailsTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 15,
    color: '#2d3748',
  },
  notificationDetailBox: {
    marginBottom: 15,
  },
  proceedToPayButton: {
    backgroundColor: '#38a169',
    paddingVertical: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 10,
  },
  proceedToPayButtonText: {
    color: '#fff',
    fontSize: 16,
  },
  disabledButton: {
    backgroundColor: '#a0aec0',
  },
  disabledButtonText: {
    color: '#fff',
  },
  messageOwnerButton: {
    backgroundColor: '#3182ce',
    paddingVertical: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 10,
  },
  messageOwnerButtonText: {
    color: '#fff',
    fontSize: 16,
  },
  closeNotificationModalButton: {
    backgroundColor: '#e53e3e',
    paddingVertical: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 20,
  },
  closeNotificationModalButtonText: {
    color: '#fff',
    fontSize: 16,
  },
  allNotificationsModalContainer: {
    flex: 1,
    backgroundColor: '#fff',
    padding: 20,
  },
  allNotificationsTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 20,
    color: '#2d3748',
    textAlign: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  chatBubbleIcon: {
    position: 'absolute',
    bottom: 30,
    right: 20,
    backgroundColor: '#3182ce',
    padding: 15,
    borderRadius: 30,
    elevation: 5,
  },
});
