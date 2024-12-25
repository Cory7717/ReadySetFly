// src/components/renter.js (originally BookingCalendar.js)

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
// import CheckoutScreen from "../payment/CheckoutScreen";
import ConfirmationScreen from "../payment/ConfirmationScreen";
import MessagesScreen from "../screens/MessagesScreen";

// Define API_URL directly
const API_URL = "https://us-central1-ready-set-fly-71506.cloudfunctions.net/api";

// Import Firebase configuration
import { db, auth } from "../../firebaseConfig"; // Adjust the path as necessary

const renter = () => {
  const router = useRouter(); // Initialize Expo Router

  // -------------------------
  // State Variables
  // -------------------------
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
  const [baseCost, setBaseCost] = useState(0);
  const [hours, setHours] = useState(0);

  const [notifications, setNotifications] = useState([]);
  const [notificationCount, setNotificationCount] = useState(0);

  const [selectedNotification, setSelectedNotification] = useState(null);
  const [selectedRentalRequest, setSelectedRentalRequest] = useState(null);
  const [isRentalRequestLoading, setIsRentalRequestLoading] = useState(false);

  const [selectedListing, setSelectedListing] = useState(null);
  const [selectedListingId, setSelectedListingId] = useState(null);
  const [selectedListingName, setSelectedListingName] = useState(null);
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

  const [isAuthChecked, setIsAuthChecked] = useState(false);
  const [renter, setRenter] = useState(null);

  const [isDatePickerVisible, setDatePickerVisibility] = useState(false);

  const [isMapModalVisible, setMapModalVisible] = useState(false);
  const [initialLocation, setInitialLocation] = useState(null);

  const [currentChatOwnerId, setCurrentChatOwnerId] = useState(null);

  // New States for Payment
  const [paymentComplete, setPaymentComplete] = useState(false);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);

  // Refs
  const processedRentalsRef = useRef([]);
  const rentalRequestListenerRef = useRef(null);

  // ----------------------------------------------------------------
  // 1) Utility Functions
  // ----------------------------------------------------------------
  const safeToFixed = (value, decimals = 2) => {
    let number = value;
    if (typeof value === "string") {
      number = parseFloat(value);
      if (isNaN(number)) {
        console.warn(`Expected a number but received a non-numeric string.`);
        return "N/A";
      }
    }
    if (typeof number === "number" && !isNaN(number)) {
      return number.toFixed(decimals);
    }
    console.warn(`Expected a number but got something else.`);
    return "N/A";
  };

  /**
   * Calculate total cost (bookingFee 6%, transactionFee 3%, tax 8.25%)
   */
  const calculateTotalCost = (rentalCostPerHour, rentalHours) => {
    const bookingFeePercentage = 6;
    const transactionFeePercentage = 3;
    const salesTaxPercentage = 8.25;

    const rentalTotalCost = rentalCostPerHour * rentalHours;
    const bookingFee = rentalTotalCost * (bookingFeePercentage / 100);
    const transactionFee = rentalTotalCost * (transactionFeePercentage / 100);
    const salesTax = rentalTotalCost * (salesTaxPercentage / 100);
    const total = rentalTotalCost + bookingFee + transactionFee + salesTax;

    return {
      rentalCost: rentalTotalCost.toFixed(2),
      bookingFee: bookingFee.toFixed(2),
      transactionFee: transactionFee.toFixed(2),
      salesTax: salesTax.toFixed(2),
      total: total.toFixed(2),
    };
  };

  // ----------------------------------------------------------------
  // 2) Auth and Firestore Setup
  // ----------------------------------------------------------------
  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setRenter(user);
        const renterDocRef = doc(db, "renters", user.uid);
        const renterDocSnap = await getDoc(renterDocRef);
        if (!renterDocSnap.exists()) {
          await setDoc(renterDocRef, {
            uid: user.uid,
            fullName: user.displayName || "Unnamed Renter",
            contact: user.email || "No Email",
          });
          console.log(`Renter document created for UID: ${user.uid}`);
        }
      } else {
        setRenter(null);
        // Possibly navigate to login
      }
      setIsAuthChecked(true);
    });
    return () => unsubscribeAuth();
  }, []);

  const renterId = renter?.uid;

  // ----------------------------------------------------------------
  // 3) Data Migration (One-time check)
  // ----------------------------------------------------------------
  useEffect(() => {
    const migrateData = async () => {
      try {
        const migrationFlagRef = doc(db, "migrationFlags", "rentalRequestsMigration");
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

          ["rentalCost", "bookingFee", "transactionFee", "salesTax", "totalCost"].forEach((field) => {
            if (data[field] === undefined) {
              updates[field] = 0;
              migrationCount += 1;
            } else if (typeof data[field] === "string") {
              const parsedValue = parseFloat(data[field]);
              updates[field] = isNaN(parsedValue) ? 0 : parsedValue;
              migrationCount += 1;
            } else if (typeof data[field] !== "number") {
              updates[field] = 0;
              migrationCount += 1;
            }
          });

          if (Object.keys(updates).length > 0) {
            batch.update(docSnap.ref, updates);
          }
        });

        if (migrationCount > 0) {
          await batch.commit();
          console.log(`Migrated ${migrationCount} fields in rentalRequests.`);
        } else {
          console.log("No migration needed for rentalRequests.");
        }

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

  // ----------------------------------------------------------------
  // 4) Fetch Rentals & Notifications
  // ----------------------------------------------------------------
  useEffect(() => {
    if (!isAuthChecked) return;
    if (!renterId) {
      console.error("Error: renterId is undefined.");
      Alert.alert("Authentication Error", "User is not authenticated.");
      return;
    }

    const rentalRequestsRef = collection(db, "rentalRequests");
    const notificationsRef = collection(db, "renters", renterId, "notifications");

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

    const unsubscribeRentalRequests = onSnapshot(
      rentalRequestsQueryInstance,
      async (snapshot) => {
        const active = [];
        for (const docSnap of snapshot.docs) {
          const requestData = docSnap.data();

          // Minimal validations
          if (!requestData.rentalStatus) {
            console.warn(`Rental Request ${docSnap.id} missing rentalStatus.`);
            continue;
          }
          if (!requestData.ownerId) {
            console.warn(`Rental Request ${docSnap.id} missing ownerId.`);
            continue;
          }

          let ownerName = "Unknown Owner";
          try {
            const ownerDocRef = doc(db, "owners", requestData.ownerId);
            const ownerDoc = await getDoc(ownerDocRef);
            if (ownerDoc.exists()) {
              ownerName = ownerDoc.data().fullName || "Unknown Owner";
            } else {
              console.warn(`Owner doc not found for ${requestData.ownerId}`);
            }
          } catch (error) {
            console.error("Error fetching owner details:", error);
          }

          const rentalCostPerHour = parseFloat(requestData.rentalCostPerHour);
          const rentalHrs = requestData.rentalHours;
          if (
            isNaN(rentalCostPerHour) ||
            typeof rentalHrs !== "number" ||
            isNaN(rentalHrs)
          ) {
            console.warn(`Invalid cost fields in request ${docSnap.id}.`);
            continue;
          }

          active.push({
            id: docSnap.id,
            rentalStatus: requestData.rentalStatus,
            ...requestData,
            ownerName,
          });
        }

        setRentals(active);
        const lastRentalDoc = snapshot.docs[snapshot.docs.length - 1];
        setRentalsLastDoc(lastRentalDoc);
      },
      (error) => {
        console.error("Error fetching rentals:", error);
        Alert.alert("Error", "Failed to fetch rentals.");
      }
    );

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

  // ----------------------------------------------------------------
  // 5) Payment Navigation
  // ----------------------------------------------------------------
  const navigateToCheckout = async (rentalRequestId, costPerHour, rentalHours) => {
    // Prevent double navigation or re-pressing
    if (isProcessingPayment) {
      console.warn("Payment is already being processed.");
      return;
    }
    setIsProcessingPayment(true);

    if (!rentalRequestId) {
      setIsProcessingPayment(false);
      Alert.alert("Error", "No rental request selected.");
      return;
    }

    try {
      console.log(`Navigating to CheckoutScreen with Rental Request ID: ${rentalRequestId}`);
      console.log(`Cost Per Hour: ${costPerHour}, Rental Hours: ${rentalHours}`);

      // Navigate using Expo Router's router.push
      router.push({
        pathname: "/payment/CheckoutScreen",
        params: {
          rentalRequestId,
          costPerHour,
          rentalHours,
        },
      });
    } catch (error) {
      console.error("Error navigating to CheckoutScreen:", error);
      Alert.alert("Error", "Failed to navigate to payment screen.");
      setIsProcessingPayment(false); // Re-enable if navigation truly fails
    }
    // We do NOT reset isProcessingPayment here automatically, to avoid double triggers
  };

  // ----------------------------------------------------------------
  // 6) Handling Notification Press
  // ----------------------------------------------------------------
  const handleNotificationPress = async (notification) => {
    try {
      if (!notification) throw new Error("Notification object is undefined.");

      const rentalRequestId = notification.rentalRequestId || notification.rentalRequest;
      if (rentalRequestId) {
        console.log("Notification has rentalRequestId:", rentalRequestId);

        setIsRentalRequestLoading(true);
        setPaymentComplete(false);

        const rentalRequestRef = doc(db, "rentalRequests", rentalRequestId);

        // Clean up any existing snapshot listener
        if (rentalRequestListenerRef.current) {
          rentalRequestListenerRef.current();
        }

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

        let ownerName = "Unknown Owner";
        try {
          const ownerDocRef = doc(db, "owners", rentalRequestData.ownerId);
          const ownerDocSnap = await getDoc(ownerDocRef);
          if (ownerDocSnap.exists()) {
            ownerName = ownerDocSnap.data().fullName || "Unknown Owner";
          } else {
            console.warn(`Owner doc not found for ID: ${rentalRequestData.ownerId}`);
          }
        } catch (error) {
          console.error("Error fetching owner details:", error);
        }

        const updatedRentalRequestData = { ...rentalRequestData, ownerName };
        setSelectedRentalRequest(updatedRentalRequestData);

        // Fetch listing
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

        const rentalHoursVal = rentalRequestData.rentalHours;
        const rentalCostPerHourVal = parseFloat(listingData.costPerHour);

        console.log("rentalCostPerHour:", rentalCostPerHourVal);
        console.log("rentalHours:", rentalHoursVal);

        if (
          isNaN(rentalCostPerHourVal) ||
          typeof rentalHoursVal !== "number"
        ) {
          Alert.alert("Error", "One or more cost components are invalid.");
          setIsRentalRequestLoading(false);
          return;
        }

        const computedTotalCost = calculateTotalCost(rentalCostPerHourVal, rentalHoursVal);
        setTotalCost(computedTotalCost);

        // Watch for paymentStatus changes
        rentalRequestListenerRef.current = onSnapshot(
          rentalRequestRef,
          (docSnap) => {
            if (docSnap.exists()) {
              const data = docSnap.data();
              if (data.paymentStatus === "completed") {
                setPaymentComplete(true);
                Alert.alert("Payment Complete", "Your payment has been processed.");
              }
            }
          },
          (error) => {
            console.error("Error listening to rental request:", error);
          }
        );

        setSelectedNotification(notification);
        setNotificationModalVisible(true);
        setIsRentalRequestLoading(false);
      } else {
        // If there's no rentalRequestId, treat it as a plain notification
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

  // ----------------------------------------------------------------
  // 7) Close Notification Modal
  // ----------------------------------------------------------------
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
    if (rentalRequestListenerRef.current) {
      rentalRequestListenerRef.current();
      rentalRequestListenerRef.current = null;
    }
  };

  // ----------------------------------------------------------------
  // 8) Remove All Notifications
  // ----------------------------------------------------------------
  const removeAllNotifications = async () => {
    Alert.alert(
      "Confirm Deletion",
      "Are you sure you want to remove all notifications?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove All",
          style: "destructive",
          onPress: async () => {
            try {
              const notificationsRef = collection(db, "renters", renterId, "notifications");
              const snapshot = await getDocs(notificationsRef);
              if (snapshot.empty) {
                Alert.alert("No Notifications", "No notifications to remove.");
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
              Alert.alert("Success", "All notifications removed.");
            } catch (error) {
              console.error("Error removing notifications:", error);
              Alert.alert("Error", "Failed to remove notifications.");
            }
          },
        },
      ],
      { cancelable: true }
    );
  };

  // ----------------------------------------------------------------
  // 9) Date Picker
  // ----------------------------------------------------------------
  const showDatePicker = () => setDatePickerVisibility(true);
  const hideDatePicker = () => setDatePickerVisibility(false);
  const handleConfirm = (date) => {
    const formattedDate = `${date.getMonth() + 1}/${date.getDate()}/${date.getFullYear()}`;
    setRentalDate(formattedDate);
    hideDatePicker();
  };

  // ----------------------------------------------------------------
  // 10) Messaging
  // ----------------------------------------------------------------
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
      const rentalRequestId = selectedNotification?.rentalRequestId || null;

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
      Alert.alert("Success", "Message sent.");
    } catch (error) {
      console.error("Error sending message:", error);
      Alert.alert("Error", "Failed to send message.");
    }
  };

  const toggleMessagesModal = () => {
    setNotificationModalVisible(false);
    setAllNotificationsModalVisible(false);
    setMessagesModalVisible(!messagesModalVisible);
  };

  // ----------------------------------------------------------------
  // 11) Profile Image / Document Pickers
  // ----------------------------------------------------------------
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

  const pickDocument = async (field) => {
    let result = await DocumentPicker.getDocumentAsync({
      type: ["application/pdf", "image/*"],
    });
    if (result.type !== "cancel") {
      setProfileData({ ...profileData, [field]: result.uri });
    }
  };

  // ----------------------------------------------------------------
  // 12) Profile Submit
  // ----------------------------------------------------------------
  const handleProfileSubmit = (values) => {
    setProfileData(values);
    setProfileSaved(true);
    setProfileModalVisible(false);
  };

  // ----------------------------------------------------------------
  // 13) Location
  // ----------------------------------------------------------------
  const getCurrentLocation = async () => {
    let { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission Denied", "Permission to access location was denied.");
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

  // ----------------------------------------------------------------
  // 14) Ratings
  // ----------------------------------------------------------------
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

  // ----------------------------------------------------------------
  // 15) Listen for Messages
  // ----------------------------------------------------------------
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
          snapshot.docs.forEach((docSnap) => {
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

  // ----------------------------------------------------------------
  // 16) Render Items, Load More
  // ----------------------------------------------------------------
  const handleRentalPress = (rental) => {
    Alert.alert("Rental Pressed", `You pressed on rental: ${rental.aircraftModel || "N/A"}`);
  };

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
        if (requestData.ownerId) {
          try {
            const ownerDocRef = doc(db, "owners", requestData.ownerId);
            const ownerDoc = await getDoc(ownerDocRef);
            if (ownerDoc.exists()) {
              ownerName = ownerDoc.data().fullName || "Unknown Owner";
            } else {
              console.warn(`Owner doc not found for ${requestData.ownerId}`);
            }
          } catch (error) {
            console.error("Error fetching owner details:", error);
          }
        } else {
          console.warn(`Rental Request ${docSnap.id} missing ownerId.`);
          continue;
        }

        const rentalCostPerHour = parseFloat(requestData.rentalCostPerHour);
        const rentalHrs = requestData.rentalHours;
        if (isNaN(rentalCostPerHour) || typeof rentalHrs !== "number") {
          console.warn(`Invalid cost in request ${docSnap.id}.`);
          continue;
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

  const renderRentalItem = ({ item }) => (
    <TouchableOpacity
      style={styles.rentalBox}
      onPress={() => handleRentalPress(item)}
      accessibilityLabel={`View details for rental: ${item.aircraftModel}`}
      accessibilityRole="button"
    >
      <Text style={styles.rentalAircraftModel}>{item.aircraftModel || "N/A"}</Text>
      <Text style={styles.rentalStatus}>{item.rentalStatus}</Text>
      <Text style={styles.rentalTotalCost}>
        Total Cost: ${safeToFixed(item.totalCost)}
      </Text>
    </TouchableOpacity>
  );

  // ----------------------------------------------------------------
  // 17) Navigation by Filter (Optional)
  // ----------------------------------------------------------------
  const handleNavigationInternal = (filter) => {
    if (filter === "all") {
      router.push("/AllAircraftScreen");
    } else if (filter === "jets") {
      router.push("/JetsScreen");
    } else if (filter === "pistons") {
      router.push("/PistonsScreen");
    } else if (filter === "helicopters") {
      router.push("/HelicoptersScreen");
    } else if (filter === "cessna-172") {
      router.push("/payment/CheckoutScreen");
    } else if (filter === "beechcraft-baron") {
      router.push("/payment/CheckoutScreen");
    } else if (filter === "cirrus-sr22") {
      router.push("/payment/CheckoutScreen");
    }
  };

  // ----------------------------------------------------------------
  // 18) Main Return
  // ----------------------------------------------------------------
  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <StatusBar hidden={false} />
      </SafeAreaView>

      {/* If auth not checked yet, show loading */}
      {!isAuthChecked ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#3182ce" />
        </View>
      ) : renterId ? (
        <ScrollView
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => {}} />}
          contentContainerStyle={{ paddingBottom: 16 }}
        >
          {/* Header with background */}
          <ImageBackground
            source={require("../../Assets/images/wingtip_clouds.jpg")}
            style={styles.headerImage}
            resizeMode="cover"
          >
            <View style={styles.headerOverlay}>
              <SafeAreaView style={styles.headerContent}>
                <Text style={styles.greetingText}>
                  Good afternoon, {renter?.displayName || "User"}
                </Text>
                <View style={styles.headerRow}>
                  {/* Date */}
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

                  {/* Hours */}
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
              <TouchableOpacity
                style={styles.recommendedBox}
                onPress={() => {}}
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

              <TouchableOpacity
                style={styles.recommendedBox}
                onPress={() => {}}
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

              <TouchableOpacity
                style={styles.recommendedBox}
                onPress={() => {}}
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
        // If user not authenticated
        <View style={styles.notAuthenticatedContainer}>
          <Text style={styles.notAuthenticatedText}>
            You are not authenticated. Please log in to continue.
          </Text>
          <TouchableOpacity
            onPress={() => {
              router.push("/sign-in");
            }}
            style={styles.goToLoginButton}
            accessibilityLabel="Navigate to login screen"
            accessibilityRole="button"
          >
            <Text style={styles.goToLoginButtonText}>Go to Login</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Profile Information (example usage) */}
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
        transparent={false}
        presentationStyle="fullScreen"
        onRequestClose={() => setMessagesModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.messageModalContainer}
        >
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
            <View style={{ width: 24 }} />
          </View>

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
                <Text style={styles.chatSenderName}>{item.senderName}:</Text>
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

                    {totalCost !== undefined && totalCost !== null ? (
                      <View style={{ marginTop: 8 }}>
                        <Text style={styles.detailLabel}>Cost Breakdown:</Text>
                        <Text style={styles.detailValue}>
                          Rental Cost (${selectedListing.costPerHour}/hr *{" "}
                          {selectedRentalRequest.rentalHours} hours): $
                          {safeToFixed(totalCost.rentalCost)}
                        </Text>
                        <Text style={styles.detailValue}>
                          Booking Fee (6%): ${safeToFixed(totalCost.bookingFee)}
                        </Text>
                        <Text style={styles.detailValue}>
                          Transaction Fee (3%): $
                          {safeToFixed(totalCost.transactionFee)}
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
                          selectedNotification?.rentalRequest,
                        parseFloat(selectedListing.costPerHour),
                        parseFloat(selectedRentalRequest.rentalHours)
                      )
                    }
                    style={[
                      styles.proceedToPayButton,
                      isProcessingPayment && styles.disabledButton,
                    ]}
                    accessibilityLabel="Proceed to payment"
                    accessibilityRole="button"
                    disabled={isProcessingPayment}
                  >
                    {isProcessingPayment ? (
                      <ActivityIndicator size="small" color="#fff" />
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
              // General Notification
              <ScrollView contentContainerStyle={{ padding: 16 }}>
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
                        ? selectedNotification.createdAt
                            .toDate()
                            .toLocaleString()
                        : new Date(selectedNotification.createdAt).toLocaleString()
                      : "N/A"}
                  </Text>
                </View>

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
              <TouchableOpacity
                onPress={() => setAllNotificationsModalVisible(false)}
                style={styles.closeModalButton}
                accessibilityLabel="Close all notifications"
                accessibilityRole="button"
              >
                <Ionicons name="close-circle" size={32} color="#2d3748" />
              </TouchableOpacity>

              <Text style={styles.allNotificationsTitle}>All Notifications</Text>

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

      {/* Chat Bubble Icon to open Messages */}
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

export default renter;

/**
 * Explanation of Key Fixes:
 *
 * 1) In `navigateToCheckout`, we only set `setIsProcessingPayment(true)` if not already processing,
 *    then we do NOT forcibly reset it to false unless navigation fails. This prevents double-calls.
 *
 * 2) The "Proceed to Pay" button in the modal is disabled while `isProcessingPayment` is true:
 *      style={[styles.proceedToPayButton, isProcessingPayment && styles.disabledButton]}
 *      disabled={isProcessingPayment}
 *
 * 3) If navigation to CheckoutScreen fails, we set `setIsProcessingPayment(false)` in the `catch` block,
 *    so the user can try again.
 *
 * 4) We did not alter the entire structure but made sure that we do not re-enable
 *    the "Proceed to Pay" button until after a successful or failed attempt.
 */

// Styles (Assuming you have a StyleSheet defined below)
const styles = StyleSheet.create({
  // ... [Your existing styles go here]
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
    justifyContent: "flex-end",
  },
  headerOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.4)",
    justifyContent: "flex-end",
  },
  headerContent: {
    padding: 16,
  },
  greetingText: {
    color: "#fff",
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 8,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  datePickerButton: {
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    padding: 8,
    borderRadius: 8,
    marginRight: 8,
  },
  datePickerText: {
    color: "#fff",
    fontSize: 16,
  },
  hoursInput: {
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    padding: 8,
    borderRadius: 8,
    color: "#fff",
    width: 80,
    textAlign: "center",
  },
  locationButton: {
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    padding: 8,
    borderRadius: 8,
  },
  locationText: {
    color: "#fff",
    fontSize: 16,
  },
  navigationButtonsContainer: {
    flexDirection: "row",
    justifyContent: "space-around",
    paddingVertical: 16,
  },
  navigationButton: {
    alignItems: "center",
  },
  sectionContainer: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 8,
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
    backgroundColor: "#3182ce",
    padding: 12,
    borderRadius: 8,
    flex: 1,
    alignItems: "center",
  },
  aircraftTypeText: {
    color: "#fff",
    fontSize: 16,
  },
  recommendedBox: {
    marginRight: 16,
    alignItems: "center",
    width: 120,
  },
  recommendedImage: {
    width: 100,
    height: 80,
    borderRadius: 8,
  },
  recommendedText: {
    marginTop: 8,
    textAlign: "center",
    fontSize: 14,
  },
  rentalBox: {
    backgroundColor: "#fff",
    padding: 16,
    borderRadius: 8,
    marginBottom: 8,
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  rentalAircraftModel: {
    fontSize: 16,
    fontWeight: "bold",
  },
  rentalStatus: {
    fontSize: 14,
    color: "#718096",
    marginVertical: 4,
  },
  rentalTotalCost: {
    fontSize: 14,
    color: "#2d3748",
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
    marginTop: 8,
  },
  loadMoreRentalsButtonText: {
    color: "#fff",
    fontSize: 16,
  },
  noActiveRentalsText: {
    textAlign: "center",
    color: "#a0aec0",
    marginVertical: 16,
  },
  notificationBox: {
    backgroundColor: "#fff",
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
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
    padding: 12,
    borderRadius: 8,
    alignItems: "center",
    marginTop: 8,
  },
  viewAllNotificationsButtonText: {
    color: "#3182ce",
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
    padding: 16,
    backgroundColor: "#fff",
    borderTopWidth: 1,
    borderColor: "#e2e8f0",
  },
  profileTitle: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 8,
  },
  profileRow: {
    flexDirection: "row",
    marginBottom: 4,
  },
  profileLabel: {
    fontWeight: "bold",
    marginRight: 4,
  },
  profileValue: {
    color: "#4a5568",
  },
  profileImage: {
    width: 100,
    height: 100,
    borderRadius: 50,
    marginTop: 8,
  },
  messageModalContainer: {
    flex: 1,
    backgroundColor: "#f7fafc",
  },
  messagesHeader: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderColor: "#e2e8f0",
  },
  closeModalButton: {
    padding: 8,
  },
  messagesTitle: {
    flex: 1,
    textAlign: "center",
    fontSize: 18,
    fontWeight: "bold",
  },
  chatBubble: {
    padding: 12,
    borderRadius: 8,
    marginVertical: 4,
    maxWidth: "80%",
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
    marginBottom: 4,
  },
  chatMessageText: {
    color: "#2d3748",
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
    backgroundColor: "#fff",
    borderTopWidth: 1,
    borderColor: "#e2e8f0",
    alignItems: "center",
  },
  messageTextInput: {
    flex: 1,
    backgroundColor: "#edf2f7",
    padding: 12,
    borderRadius: 20,
    marginRight: 8,
    color: "#2d3748",
  },
  sendButton: {
    backgroundColor: "#3182ce",
    padding: 12,
    borderRadius: 20,
  },
  notificationModalContainer: {
    flex: 1,
    backgroundColor: "#fff",
    paddingTop: 40,
  },
  notificationDetailsTitle: {
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 12,
  },
  notificationDetailBox: {
    marginBottom: 12,
  },
  detailLabel: {
    fontWeight: "bold",
    fontSize: 16,
    color: "#2d3748",
  },
  detailValue: {
    fontSize: 16,
    color: "#4a5568",
    marginTop: 4,
  },
  detailTotalCostText: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#2d3748",
    marginTop: 8,
  },
  proceedToPayButton: {
    backgroundColor: "#38a169",
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
  disabledButton: {
    backgroundColor: "#a0aec0",
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
  disabledButtonText: {
    color: "#cbd5e0",
  },
  closeNotificationModalButton: {
    backgroundColor: "#e2e8f0",
    padding: 12,
    borderRadius: 8,
    alignItems: "center",
    marginTop: 16,
  },
  closeNotificationModalButtonText: {
    color: "#2d3748",
    fontSize: 16,
  },
  allNotificationsModalContainer: {
    flex: 1,
    backgroundColor: "#fff",
    padding: 16,
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
    marginBottom: 16,
    textAlign: "center",
  },
  chatBubbleIcon: {
    position: "absolute",
    bottom: 32,
    right: 32,
    backgroundColor: "#3182ce",
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevaation: 5,
  },
});
