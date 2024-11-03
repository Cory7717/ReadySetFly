// renter.js

import React, { useState, useEffect } from "react";
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
  getFirestore,
  collection,
  query,
  where,
  getDocs,
  addDoc,
  updateDoc,
  setDoc,
  doc,
  onSnapshot,
  orderBy,
  serverTimestamp,
  writeBatch,
  limit,
  startAfter,
  arrayUnion,
  getDoc,
} from "firebase/firestore";

import * as ImagePicker from "expo-image-picker";
import * as DocumentPicker from "expo-document-picker";
import * as Location from "expo-location";

import { getAuth, onAuthStateChanged } from "firebase/auth";

import {
  Ionicons,
  Octicons,
  MaterialCommunityIcons,
  Fontisto,
} from "@expo/vector-icons";

import { useNavigation } from "@react-navigation/native";

import DateTimePickerModal from "react-native-modal-datetime-picker";
import { Picker } from "@react-native-picker/picker";
import { useStripe } from "@stripe/stripe-react-native";

import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { NavigationContainer } from "@react-navigation/native";

const API_URL =
  "https://us-central1-ready-set-fly-71506.cloudfunctions.net/api";
// Ensure this is the correct base URL for your Cloud Functions

import CheckoutScreen from "../payment/CheckoutScreen";
import ConfirmationScreen from "../payment/ConfirmationScreen";
import MessagesScreen from "../screens/MessagesScreen";

const db = getFirestore();
const auth = getAuth();

const Stack = createNativeStackNavigator();

const BookingCalendar = () => {
  const stripe = useStripe();
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

  const [notifications, setNotifications] = useState([]);
  const [notificationCount, setNotificationCount] = useState(0);

  const [selectedNotification, setSelectedNotification] = useState(null);
  const [selectedRentalRequest, setSelectedRentalRequest] = useState(null);
  const [isRentalRequestLoading, setIsRentalRequestLoading] = useState(false);

  const [selectedListing, setSelectedListing] = useState(null);
  const [selectedListingId, setSelectedListingId] = useState(null); // Dynamic Listing ID
  const [selectedListingName, setSelectedListingName] = useState(null); // Display Aircraft Name
  const [totalCost, setTotalCost] = useState(null); // State for Total Cost

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

  // Fetch authenticated renter details
  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      if (user) {
        setRenter(user);
      } else {
        setRenter(null);
        // Optionally navigate to login screen here
      }
      setIsAuthChecked(true); // Auth state has been determined
    });

    return () => unsubscribeAuth();
  }, []);

  const renterId = renter?.uid;

  // Fetch Rentals and Notifications
  useEffect(() => {
    if (!isAuthChecked) return; // Wait until auth is checked

    if (!renterId) {
      console.error("Error: renterId is undefined.");
      Alert.alert("Authentication Error", "User is not authenticated.");
      // Optionally, navigate to login screen here
      return;
    }

    const rentalRequestsRef = collection(
      db,
      "renters",
      renterId,
      "rentalRequests"
    );
    const ordersRef = collection(db, "orders");
    const notificationsRef = collection(
      db,
      "renters",
      renterId,
      "notifications"
    );

    const rentalRequestsQueryInstance = query(
      rentalRequestsRef,
      where("rentalStatus", "in", ["pending", "approved", "active", "denied"]),
      orderBy("createdAt", "desc"),
      limit(RENTALS_PAGE_SIZE)
    );

    const ordersQueryInstance = query(
      ordersRef,
      where("renterId", "==", renterId),
      where("status", "==", "completed"),
      orderBy("completedAt", "desc"),
      limit(RENTALS_PAGE_SIZE)
    );

    const notificationsQueryInstance = query(
      notificationsRef,
      orderBy("createdAt", "desc"),
      limit(NOTIFICATIONS_PAGE_SIZE)
    );

    // Real-time listener for Rental Requests and Orders
    const unsubscribeRentalRequests = onSnapshot(
      rentalRequestsQueryInstance,
      async (snapshot) => {
        const active = [];
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

          // Ensure listingId exists
          if (!requestData.listingId) {
            console.warn(
              `Rental Request ID: ${docSnap.id} is missing 'listingId'. This request will be excluded.`
            );
            continue; // Skip rental requests without listingId
          }

          active.push({
            id: docSnap.id,
            rentalStatus: requestData.rentalStatus,
            ...requestData,
            ownerName,
          });
        }

        // Fetch completed rentals from Orders
        const ordersSnapshot = await getDocs(ordersQueryInstance);
        const completed = [];
        for (const docSnap of ordersSnapshot.docs) {
          const orderData = docSnap.data();
          let ownerName = "Unknown Owner";

          // Ensure ownerId exists
          if (orderData.ownerId) {
            try {
              const ownerDocRef = doc(db, "owners", orderData.ownerId);
              const ownerDocSnap = await getDoc(ownerDocRef);
              if (ownerDocSnap.exists()) {
                ownerName = ownerDocSnap.data().fullName || "Unknown Owner";
              } else {
                console.warn(
                  `Owner document not found for ownerId: ${orderData.ownerId}`
                );
              }
            } catch (error) {
              console.error("Error fetching owner details:", error);
            }
          } else {
            console.warn(
              `Order ID: ${docSnap.id} is missing 'ownerId'. This order will be excluded.`
            );
            continue; // Skip orders without ownerId
          }

          // Ensure listingId exists
          if (!orderData.listingId) {
            console.warn(
              `Order ID: ${docSnap.id} is missing 'listingId'. This order will be excluded.`
            );
            continue; // Skip orders without listingId
          }

          completed.push({
            id: docSnap.id,
            rentalStatus: "completed",
            ...orderData,
            ownerName,
          });
        }

        setRentals([...active, ...completed]);

        // Update last document for pagination
        const lastActiveDoc = snapshot.docs[snapshot.docs.length - 1];
        setRentalsLastDoc(lastActiveDoc);
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

  // Handle Approved Rentals: Create Notifications
  useEffect(() => {
    const handleApprovedRentals = async () => {
      for (const rental of rentals) {
        if (
          (rental.rentalStatus === "active" ||
            rental.rentalStatus === "approved") &&
          !processedRentals.includes(rental.id)
        ) {
          const existingNotif = notifications.find(
            (notif) => notif.rentalRequestId === rental.id
          );
          if (!existingNotif) {
            try {
              // Ensure that listingId and ownerId are fetched correctly
              let { listingId, ownerId, rentalDate, totalCost } = rental;

              if (!listingId || !ownerId) {
                const rentalRequestRef = doc(
                  db,
                  "renters",
                  renterId,
                  "rentalRequests",
                  rental.id
                );
                const rentalRequestSnap = await getDoc(rentalRequestRef);
                if (rentalRequestSnap.exists()) {
                  const rentalRequestData = rentalRequestSnap.data();
                  listingId = rentalRequestData.listingId || listingId;
                  ownerId = rentalRequestData.ownerId || ownerId;
                  rentalDate = rentalRequestData.rentalDate || rentalDate;
                  totalCost = rentalRequestData.totalCost || totalCost;
                }
              }

              if (!listingId || !ownerId) {
                console.warn(
                  `Missing listingId or ownerId for rental ID: ${rental.id}. Notification not created.`
                );
                continue; // Skip if essential fields are missing
              }

              // Fetch owner name
              let ownerName = "Unknown Owner";
              try {
                const ownerDocRef = doc(db, "owners", ownerId);
                const ownerDocSnap = await getDoc(ownerDocRef);
                if (ownerDocSnap.exists()) {
                  ownerName = ownerDocSnap.data().fullName || "Unknown Owner";
                }
              } catch (error) {
                console.error("Error fetching owner details:", error);
              }

              // Optional: Ensure totalCost is set correctly
              if (totalCost === undefined || totalCost === null) {
                console.warn(
                  `Total cost is missing for rental ID: ${rental.id}. Setting to 0.`
                );
                totalCost = 0;
              }

              await addDoc(
                collection(db, "renters", renterId, "notifications"),
                {
                  rentalRequestId: rental.id,
                  message: "Your rental has been approved! Proceed to payment.",
                  type: "rentalApproved",
                  listingId: listingId, // Ensure listingId is included
                  ownerId: ownerId,
                  ownerName: ownerName,
                  rentalDate: rentalDate || null,
                  createdAt: serverTimestamp(),
                  rentalStatus: rental.rentalStatus || "approved",
                  totalCost: totalCost, // Include totalCost in the notification
                }
              );
              console.log(
                `Added rentalApproved notification for rental ID: ${rental.id}`
              );
              setProcessedRentals((prev) => [...prev, rental.id]);
            } catch (error) {
              console.error("Error adding notification:", error);
            }
          }
        }
      }
    };

    if (rentals.length > 0) {
      handleApprovedRentals();
    }
  }, [rentals, notifications, renterId, processedRentals]);

  // Updated: New createRentalRequest Function
  const createRentalRequest = async (listingId, renterId, otherData) => {
    if (!listingId) {
      console.error("Cannot create rental request without listingId.");
      Alert.alert(
        "Error",
        "Listing ID is required to create a rental request."
      );
      return;
    }

    if (!renterId) {
      console.error("Cannot create rental request without renterId.");
      Alert.alert("Error", "Renter ID is required to create a rental request.");
      return;
    }

    try {
      const listingRef = doc(db, "airplanes", listingId);
      const listingSnap = await getDoc(listingRef);

      if (!listingSnap.exists()) {
        Alert.alert("Error", "Listing not found.");
        return;
      }

      const listingData = listingSnap.data();
      const ownerId = listingData.ownerId;

      if (!ownerId) {
        Alert.alert("Error", "Listing does not have an associated owner.");
        console.warn(`Listing ID: ${listingId} is missing 'ownerId'.`);
        return;
      }

      // Parse costPerHour as a float and validate
      const parsedCostPerHour = parseFloat(listingData.ratesPerHour);
      if (isNaN(parsedCostPerHour) || parsedCostPerHour <= 0) {
        Alert.alert(
          "Invalid Rate",
          "The listing has an invalid rate per hour. Please contact support."
        );
        console.error(
          `Invalid ratesPerHour for listing ID: ${listingId}. Received: ${listingData.ratesPerHour}`
        );
        return;
      }

      const rentalRequest = {
        listingId: listingId,
        renterId: renterId,
        rentalStatus: "pending",
        rentalDate: otherData.rentalDate || "",
        createdAt: serverTimestamp(),
        totalCost: 0,
        senderId: renterId,
        senderName: otherData.senderName || renter.displayName || "User Name",
        contact:
          otherData.contact ||
          profileData.contact ||
          "User email and phone number",
        airplaneModel:
          otherData.airplaneModel || selectedListingName || "Aircraft Model",
        rentalHours: parseFloat(otherData.rentalHours) || 1,
        costPerHour: parsedCostPerHour, // Ensure it's a number
        ownerId: ownerId,
        rentalRequestId: "", // Initialize to empty
      };

      // Add to renter's rentalRequests and get rentalRequestId
      const renterRentalRequestRef = collection(
        db,
        "renters",
        renterId,
        "rentalRequests"
      );
      const renterRentalRequestDoc = await addDoc(
        renterRentalRequestRef,
        rentalRequest
      );
      const rentalRequestId = renterRentalRequestDoc.id;

      // Update the renterRentalRequestDoc with rentalRequestId
      await updateDoc(renterRentalRequestDoc, { rentalRequestId });

      console.log(
        `Created rental request ${rentalRequestId} for listing ${listingId}`
      );
      Alert.alert("Success", "Rental request created successfully.");
    } catch (error) {
      console.error("Error creating rental request:", error);
      Alert.alert("Error", "Failed to create rental request.");
    }
  };

  // Compute Total Cost Function
  const computeTotalCost = (rentalHours, costPerHour) => {
    const hours = parseFloat(rentalHours);
    const hourlyCost = parseFloat(costPerHour);

    console.log(
      "computeTotalCost - rentalHours:",
      rentalHours,
      "hours:",
      hours
    );
    console.log(
      "computeTotalCost - costPerHour:",
      costPerHour,
      "hourlyCost:",
      hourlyCost
    );

    if (isNaN(hours) || hours <= 0 || isNaN(hourlyCost) || hourlyCost <= 0) {
      console.warn("Invalid rentalHours or costPerHour:", {
        rentalHours,
        costPerHour,
      });
      return null;
    }

    const rentalCost = hours * hourlyCost;
    const bookingFee = rentalCost * 0.06; // 6% booking fee
    const tax = rentalCost * 0.0825; // 8.25% state tax
    const processingFee = rentalCost * 0.03; // 3% CC processing fee
    const totalAmount = rentalCost + bookingFee + tax + processingFee;

    return {
      rentalCost: rentalCost.toFixed(2),
      bookingFee: bookingFee.toFixed(2),
      tax: tax.toFixed(2),
      processingFee: processingFee.toFixed(2),
      total: totalAmount.toFixed(2),
    };
  };

  // Navigate to CheckoutScreen with Payment Intent
  const navigateToCheckout = async (rentalRequestId) => {
    if (!rentalRequestId) {
      Alert.alert("Error", "No rental request selected.");
      return;
    }

    try {
      const rentalRequestRef = doc(
        db,
        "renters",
        renterId,
        "rentalRequests",
        rentalRequestId
      );
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

      // Use `computeTotalCost` to calculate detailed total cost
      const computedTotalCost = computeTotalCost(
        rentalRequest.rentalHours || 1,
        listingData.ratesPerHour || "0.00"
      );

      if (computedTotalCost) {
        setTotalCost(computedTotalCost);
      } else {
        setTotalCost({
          rentalCost: "N/A",
          bookingFee: "N/A",
          tax: "N/A",
          processingFee: "N/A",
          total: "N/A",
        });
      }

      const amountInCents = computedTotalCost
        ? Math.round(parseFloat(computedTotalCost.total) * 100)
        : 0;

      console.log(
        `Creating payment intent for rental ID: ${rentalRequestSnap.id} with amount: ${amountInCents} cents`
      );

      // Confirm that ownerId exists
      if (!rentalRequest.ownerId) {
        console.error("Owner ID is missing in rental request.");
        Alert.alert("Error", "Owner information is missing.");
        return;
      }

      // Pass amount, rentalRequestId, ownerId, and renterId
      const clientSecret = await createPaymentIntent(
        amountInCents,
        rentalRequestSnap.id,
        rentalRequest.ownerId, // Pass ownerId
        renterId // Pass renterId
      );

      if (clientSecret) {
        console.log(
          "Payment intent created successfully. Navigating to CheckoutScreen."
        );
        setNotificationModalVisible(false);
        setAllNotificationsModalVisible(false);

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

  // Create Payment Intent via Backend
  const createPaymentIntent = async (
    amount,
    rentalRequestId,
    ownerId,
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

    if (!ownerId) {
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
      console.log(`Owner ID: ${ownerId}`);
      console.log(`Renter ID: ${renterId}`);
      console.log(`API_URL is: ${API_URL}`);

      const response = await fetch(`${API_URL}/create-rental-payment-intent`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${await auth.currentUser.getIdToken()}`,
        },
        body: JSON.stringify({ amount, rentalRequestId, ownerId, renterId }), // Include renterId
      });

      const text = await response.text();

      console.log("Payment Intent Response:", text);

      if (response.ok) {
        const data = JSON.parse(text);
        if (data.clientSecret) {
          return data.clientSecret;
        } else {
          console.error("clientSecret not found in response:", data);
          Alert.alert("Payment Error", "Invalid response from payment server.");
          return null;
        }
      } else {
        console.error("Error creating payment intent:", text);
        Alert.alert("Payment Error", "Failed to create payment intent.");
        return null;
      }
    } catch (error) {
      console.error("Error creating payment intent:", error);
      Alert.alert("Payment Error", "An unexpected error occurred.");
      return null;
    }
  };

  // Simplified handleNotificationPress Function
  const handleNotificationPress = async (notification) => {
    try {
      if (!notification) {
        throw new Error("Notification object is undefined.");
      }

      if (notification.rentalRequestId) {
        console.log("Notification has rentalRequestId:", notification.rentalRequestId);

        setIsRentalRequestLoading(true);

        const rentalRequestRef = doc(
          db,
          "renters",
          renterId,
          "rentalRequests",
          notification.rentalRequestId
        );

        // Fetch rental request data using getDoc
        const rentalRequestSnap = await getDoc(rentalRequestRef);
        if (!rentalRequestSnap.exists()) {
          setSelectedRentalRequest(null);
          setSelectedListing(null);
          setTotalCost(null);
          Alert.alert("Error", "Rental request not found.");
          setIsRentalRequestLoading(false);
          return;
        }

        const rentalRequestData = rentalRequestSnap.data();
        setSelectedRentalRequest(rentalRequestData);
        console.log("Rental Request Data:", rentalRequestData);

        // Fetch listing data
        const listingRef = doc(db, "airplanes", rentalRequestData.listingId);
        const listingSnap = await getDoc(listingRef);
        if (!listingSnap.exists()) {
          setSelectedListing(null);
          setTotalCost(null);
          Alert.alert("Error", "Listing not found.");
          setIsRentalRequestLoading(false);
          return;
        }

        const listingData = listingSnap.data();
        setSelectedListing(listingData);
        console.log("Listing Data:", listingData);

        // Compute total cost
        const computedTotalCost = computeTotalCost(
          rentalRequestData.rentalHours || 1,
          listingData.ratesPerHour || 0
        );

        if (computedTotalCost) {
          setTotalCost(computedTotalCost);
        } else {
          setTotalCost({
            rentalCost: "N/A",
            bookingFee: "N/A",
            tax: "N/A",
            processingFee: "N/A",
            total: "N/A",
          });
        }

        setSelectedNotification(notification);
        console.log("Selected Notification:", notification);
        setNotificationModalVisible(true);
        setIsRentalRequestLoading(false);
      } else {
        setSelectedNotification(notification);
        setSelectedRentalRequest(null);
        setSelectedListing(null);
        setTotalCost(null);
        setNotificationModalVisible(true);
      }
    } catch (error) {
      console.error("Error handling notification press:", error);
      Alert.alert("Error", error.message);
      setIsRentalRequestLoading(false);
    }
  };

  // Close Notification Modal
  const closeModal = () => {
    setNotificationModalVisible(false);
    setSelectedNotification(null);
    setSelectedRentalRequest(null);
    setSelectedListing(null);
    setTotalCost(null);
  };

  // Remove All Notifications
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

  // Date Picker Functions
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

  // Send Message Function
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
      // Fetch listingId from the selected notification or rental request
      let listingId = selectedNotification?.listingId || null;
      let rentalRequestId = selectedNotification?.rentalRequestId || null;

      await addDoc(collection(db, "messages"), {
        senderId: renterId,
        senderName: renter.displayName || "User",
        receiverId: currentChatOwnerId,
        text: messageText.trim(),
        timestamp: serverTimestamp(),
        participants: [renterId, currentChatOwnerId],
        rentalRequestId: rentalRequestId,
        listingId: listingId, // Explicitly include listingId
      });
      setMessageText("");
    } catch (error) {
      console.error("Error sending message:", error);
      Alert.alert("Error", "Failed to send message.");
    }
  };

  // Toggle Messages Modal
  const toggleMessagesModal = () => {
    setNotificationModalVisible(false);
    setAllNotificationsModalVisible(false);
    setMessagesModalVisible(!messagesModalVisible);
  };

  // Image Picker
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

  // Document Picker
  const pickDocument = async (field) => {
    let result = await DocumentPicker.getDocumentAsync({
      type: ["application/pdf", "image/*"],
    });

    if (result.type !== "cancel") {
      setProfileData({ ...profileData, [field]: result.uri });
    }
  };

  // Handle Profile Submit
  const handleProfileSubmit = (values) => {
    setProfileData(values);
    setProfileSaved(true);
    setProfileModalVisible(false);
  };

  // Handle Navigation to Home with Filters
  const handleNavigation = (filter) => {
    try {
      navigation.navigate("Home", { filter });
    } catch (error) {
      console.error("Navigation error:", error);
      Alert.alert("Error", "Failed to navigate to the home screen.");
    }
  };

  // Get Current Location
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

  // Handle Rating Submission
  const handleRating = async (rentalId, rating) => {
    try {
      const rentalDocRef = doc(db, "orders", rentalId);
      await updateDoc(rentalDocRef, { rating });
      setRatings((prevRatings) => ({ ...prevRatings, [rentalId]: rating }));
      Alert.alert("Rating Submitted", "Thank you for your feedback!");
    } catch (error) {
      console.error("Error submitting rating:", error);
      Alert.alert("Error", "Failed to submit rating.");
    }
  };

  // Listen for Messages between Renter and Owner
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

  // Save Selected Aircraft IDs
  const saveSelectedAircraftIds = async (aircraftId) => {
    if (!aircraftId) {
      Alert.alert("Error", "Invalid Aircraft ID.");
      return;
    }

    const aircraftRef = doc(db, "aircraftDetails", aircraftId);

    try {
      const aircraftSnap = await getDoc(aircraftRef);

      if (aircraftSnap.exists()) {
        await updateDoc(aircraftRef, {
          selectedBy: arrayUnion(renterId),
          timestamp: serverTimestamp(),
        });
        console.log("Selected aircraft ID updated successfully.");
        Alert.alert("Success", "Aircraft selected successfully.");
      } else {
        await setDoc(
          aircraftRef,
          {
            selectedBy: [renterId],
            timestamp: serverTimestamp(),
          },
          { merge: true }
        );
        console.log("Selected aircraft ID document created successfully.");
        Alert.alert(
          "Success",
          "Aircraft selected and document created successfully."
        );
      }
    } catch (error) {
      console.error("Error saving selected aircraft IDs:", error);
      Alert.alert("Error", "Failed to save selected aircraft ID.");
    }
  };

  // Handle Rental Press (Optional: Expand Functionality)
  const handleRentalPress = (rental) => {
    Alert.alert(
      "Rental Pressed",
      `You pressed on rental: ${rental.aircraftModel || "N/A"}`
    );
  };

  // Fetch More Rentals for Pagination
  const fetchMoreRentals = async () => {
    if (!hasMoreRentals) return;

    try {
      let rentalRequestsQueryInstance = query(
        collection(db, "renters", renterId, "rentalRequests"),
        where("rentalStatus", "in", [
          "pending",
          "approved",
          "active",
          "denied",
        ]),
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

        // Ensure listingId exists
        if (!requestData.listingId) {
          console.warn(
            `Rental Request ID: ${docSnap.id} is missing 'listingId'. This request will be excluded.`
          );
          continue; // Skip rental requests without listingId
        }

        newRentals.push({
          id: docSnap.id,
          rentalStatus: requestData.rentalStatus,
          ...requestData,
          ownerName,
        });
      }

      // Fetch completed rentals from Orders
      const ordersSnapshot = await getDocs(
        query(
          collection(db, "orders"),
          where("renterId", "==", renterId),
          where("status", "==", "completed"),
          orderBy("completedAt", "desc"),
          startAfter(rentalsLastDoc),
          limit(RENTALS_PAGE_SIZE)
        )
      );
      const completed = [];
      for (const docSnap of ordersSnapshot.docs) {
        const orderData = docSnap.data();
        let ownerName = "Unknown Owner";

        // Ensure ownerId exists
        if (orderData.ownerId) {
          try {
            const ownerDocRef = doc(db, "owners", orderData.ownerId);
            const ownerDocSnap = await getDoc(ownerDocRef);
            if (ownerDocSnap.exists()) {
              ownerName = ownerDocSnap.data().fullName || "Unknown Owner";
            } else {
              console.warn(
                `Owner document not found for ownerId: ${orderData.ownerId}`
              );
            }
          } catch (error) {
            console.error("Error fetching owner details:", error);
          }
        } else {
          console.warn(
            `Order ID: ${docSnap.id} is missing 'ownerId'. This order will be excluded.`
          );
          continue; // Skip orders without ownerId
        }

        // Ensure listingId exists
        if (!orderData.listingId) {
          console.warn(
            `Order ID: ${docSnap.id} is missing 'listingId'. This order will be excluded.`
          );
          continue; // Skip orders without listingId
        }

        completed.push({
          id: docSnap.id,
          rentalStatus: "completed",
          ...orderData,
          ownerName,
        });
      }

      setRentals([...rentals, ...newRentals, ...completed]);

      const lastVisible = snapshot.docs[snapshot.docs.length - 1];
      setRentalsLastDoc(lastVisible);
    } catch (error) {
      console.error("Error fetching more rentals:", error);
      Alert.alert("Error", "Failed to fetch more rentals.");
    }
  };

  // Fetch More Notifications for Pagination
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
    } catch (error) {
      console.error("Error fetching more notifications:", error);
      Alert.alert("Error", "Failed to fetch more notifications.");
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: "white" }}>
      <SafeAreaView style={{ backgroundColor: "white" }}>
        <StatusBar hidden={true} />
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
            style={{
              height: 200,
              paddingTop:
                Platform.OS === "android" ? StatusBar.currentHeight : 0,
              justifyContent: "center",
              paddingHorizontal: 16,
            }}
            resizeMode="cover"
          >
            <SafeAreaView style={{ flex: 1 }}>
              <Text
                style={{ fontSize: 20, fontWeight: "bold", color: "white" }}
              >
                Good afternoon, {renter?.displayName || "User"}
              </Text>
              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                  marginTop: 16,
                }}
              >
                {/* Select Date */}
                <TouchableOpacity
                  onPress={showDatePicker}
                  style={{
                    backgroundColor: "white",
                    borderRadius: 8,
                    paddingHorizontal: 16,
                    paddingVertical: 12,
                    flex: 1,
                    marginRight: 8,
                    opacity: 0.9,
                    justifyContent: "center",
                  }}
                  accessibilityLabel="Select rental date"
                  accessibilityRole="button"
                >
                  <Text>{rentalDate || "Select Date"}</Text>
                </TouchableOpacity>

                {/* Estimated Hours */}
                <TextInput
                  placeholder="Estimated Hours"
                  placeholderTextColor="#888"
                  keyboardType="numeric"
                  style={{
                    backgroundColor: "white",
                    borderRadius: 8,
                    paddingHorizontal: 16,
                    paddingVertical: 12,
                    flex: 1,
                    opacity: 0.9,
                  }}
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
                style={{
                  backgroundColor: "white",
                  borderRadius: 8,
                  paddingHorizontal: 16,
                  paddingVertical: 12,
                  marginTop: 16,
                  opacity: 0.9,
                  justifyContent: "center",
                }}
                accessibilityLabel="Select preferred rental location"
                accessibilityRole="button"
              >
                <Text style={{ textAlign: "center" }}>
                  {preferredLocation || "Preferred City/Airport"}
                </Text>
              </TouchableOpacity>

              {/* Button to Create Rental Request */}
              <TouchableOpacity
                onPress={() => {
                  // Validate rentalHours before proceeding
                  if (
                    !rentalHours ||
                    isNaN(rentalHours) ||
                    parseFloat(rentalHours) <= 0
                  ) {
                    Alert.alert(
                      "Invalid Rental Hours",
                      "Please enter a valid number of rental hours."
                    );
                    return;
                  }

                  if (selectedListingId) {
                    // Ensure a listing is selected
                    saveSelectedAircraftIds(selectedListingId);
                    // Prepare otherData
                    const otherData = {
                      rentalDate: rentalDate || new Date().toLocaleDateString(),
                      senderName: renter.displayName || "User Name",
                      contact:
                        profileData.contact || "User email and phone number",
                      airplaneModel: selectedListingName || "Aircraft Model",
                      rentalHours: parseFloat(rentalHours) || 1, // Ensure it's a number
                    };
                    createRentalRequest(selectedListingId, renterId, otherData); // Create rental request with dynamic listingId and otherData
                  } else {
                    Alert.alert(
                      "Select an Aircraft",
                      "Please select an aircraft first."
                    );
                  }
                }}
                style={{
                  backgroundColor: "#48bb78",
                  padding: 12,
                  borderRadius: 8,
                  marginTop: 16,
                  alignItems: "center",
                  opacity: selectedListingId ? 1 : 0.5, // Optional: Visual feedback
                }}
                disabled={!selectedListingId} // Disable button if no listing is selected
                accessibilityLabel="Create rental request"
                accessibilityRole="button"
              >
                <Text style={{ color: "white", fontWeight: "bold" }}>
                  Create Rental Request
                </Text>
              </TouchableOpacity>

              {/* Display Selected Aircraft (Optional) */}
              {selectedListingName && (
                <Text
                  style={{
                    marginTop: 8,
                    color: "white",
                    textAlign: "center",
                  }}
                >
                  Selected Aircraft: {selectedListingName}
                </Text>
              )}
            </SafeAreaView>
          </ImageBackground>

          {/* Date Picker Modal */}
          <DateTimePickerModal
            isVisible={isDatePickerVisible}
            mode="date"
            onConfirm={handleConfirm}
            onCancel={hideDatePicker}
          />

          {/* Navigation Buttons */}
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              padding: 16,
            }}
          >
            <TouchableOpacity
              style={{ alignItems: "center" }}
              onPress={() => handleNavigation("all")}
              accessibilityLabel="View all aircraft"
              accessibilityRole="button"
            >
              <Octicons name="paper-airplane" size={32} color="#3182ce" />
              <Text>All Aircraft</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={{ alignItems: "center" }}
              onPress={() => handleNavigation("jets")}
              accessibilityLabel="View jets"
              accessibilityRole="button"
            >
              <Ionicons name="airplane-outline" size={32} color="#3182ce" />
              <Text>Jets</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={{ alignItems: "center" }}
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
              style={{ alignItems: "center" }}
              onPress={() => handleNavigation("helicopters")}
              accessibilityLabel="View helicopters"
              accessibilityRole="button"
            >
              <Fontisto name="helicopter" size={32} color="#3182ce" />
              <Text>Helicopters</Text>
            </TouchableOpacity>
          </View>

          {/* Recent Searches */}
          <View style={{ paddingHorizontal: 16 }}>
            <Text
              style={{ fontSize: 18, fontWeight: "bold", marginBottom: 16 }}
            >
              Recent Searches
            </Text>
            <View
              style={{ flexDirection: "row", justifyContent: "space-between" }}
            >
              <View
                style={{
                  backgroundColor: "#edf2f7",
                  padding: 12,
                  borderRadius: 8,
                  flex: 1,
                  marginRight: 8,
                }}
              >
                <Text>Van Nuys Airport</Text>
                <Text style={{ color: "#a0aec0" }}>
                  3 guests · 9/10/23-9/17/23
                </Text>
              </View>
              <View
                style={{
                  backgroundColor: "#edf2f7",
                  padding: 12,
                  borderRadius: 8,
                  flex: 1,
                }}
              >
                <Text>Santa Monica Airport</Text>
                <Text style={{ color: "#a0aec0" }}>
                  2 guests · 9/18/23-9/25/23
                </Text>
              </View>
            </View>
          </View>

          {/* Aircraft Types */}
          <View style={{ paddingHorizontal: 16, paddingTop: 24 }}>
            <Text
              style={{ fontSize: 18, fontWeight: "bold", marginBottom: 16 }}
            >
              Aircraft Types
            </Text>
            <View
              style={{ flexDirection: "row", justifyContent: "space-between" }}
            >
              <TouchableOpacity
                style={{ flex: 1, marginRight: 8 }}
                onPress={() => handleNavigation("single-piston")}
                accessibilityLabel="View single engine piston aircraft"
                accessibilityRole="button"
              >
                <Text style={{ marginTop: 8, fontWeight: "bold" }}>
                  Single Engine Piston
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={{ flex: 1 }}
                onPress={() => handleNavigation("twin-piston")}
                accessibilityLabel="View twin engine piston aircraft"
                accessibilityRole="button"
              >
                <Text style={{ marginTop: 8, fontWeight: "bold" }}>
                  Twin Engine Piston
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Recommended for You */}
          <View style={{ paddingHorizontal: 16, paddingTop: 24 }}>
            <Text
              style={{ fontSize: 18, fontWeight: "bold", marginBottom: 16 }}
            >
              Recommended for you
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {/* Cessna 172 */}
              <TouchableOpacity
                style={{ marginRight: 16 }}
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
                  style={{ width: 200, height: 120, borderRadius: 8 }}
                  resizeMode="cover"
                />
                <Text style={{ marginTop: 8, fontWeight: "bold" }}>
                  Cessna 172
                </Text>
              </TouchableOpacity>

              {/* Beechcraft Baron */}
              <TouchableOpacity
                style={{ marginRight: 16 }}
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
                  style={{ width: 200, height: 120, borderRadius: 8 }}
                  resizeMode="cover"
                />
                <Text style={{ marginTop: 8, fontWeight: "bold" }}>
                  Beechcraft Baron
                </Text>
              </TouchableOpacity>

              {/* Cirrus SR22 */}
              <TouchableOpacity
                style={{ marginRight: 16 }}
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
                  style={{ width: 200, height: 120, borderRadius: 8 }}
                  resizeMode="cover"
                />
                <Text style={{ marginTop: 8, fontWeight: "bold" }}>
                  Cirrus SR22
                </Text>
              </TouchableOpacity>
            </ScrollView>
          </View>

          {/* Active Rentals */}
          <View style={{ paddingHorizontal: 16, paddingTop: 24 }}>
            <Text
              style={{ fontSize: 18, fontWeight: "bold", marginBottom: 16 }}
            >
              Active Rentals
            </Text>
            {rentals.length > 0 ? (
              <>
                <FlatList
                  data={rentals.filter(
                    (rental) => rental.rentalStatus === "active"
                  )}
                  keyExtractor={(item, index) => `${item.id}_${index}`}
                  renderItem={({ item }) => (
                    <TouchableOpacity
                      key={item.id}
                      style={{
                        backgroundColor: "#edf2f7",
                        padding: 16,
                        borderRadius: 16,
                        marginBottom: 16,
                      }}
                      onPress={() => handleRentalPress(item)}
                      accessibilityLabel={`View details for active rental of ${
                        item.aircraftModel || "N/A"
                      }`}
                      accessibilityRole="button"
                    >
                      <Text
                        style={{
                          fontWeight: "bold",
                          color: "#2d3748",
                          fontSize: 16,
                        }}
                      >
                        {item.aircraftModel || "N/A"}
                      </Text>
                      <Text style={{ color: "#4a5568" }}>
                        Owner: {item.ownerName || "N/A"}
                      </Text>
                      <Text style={{ color: "#4a5568" }}>
                        Rental Period:{" "}
                        {item.rentalDate ||
                          selectedRentalRequest?.rentalDate ||
                          "N/A"}
                      </Text>
                      <Text style={{ color: "#4a5568" }}>
                        Total Cost: $
                        {item.totalCost !== undefined && item.totalCost !== null
                          ? parseFloat(item.totalCost).toFixed(2)
                          : "N/A"}
                      </Text>
                      <Text>
                        Payment Status:{" "}
                        {item.paymentStatus ? item.paymentStatus : "N/A"}
                      </Text>
                      <Text>
                        Status:{" "}
                        {item.rentalStatus.charAt(0).toUpperCase() +
                          item.rentalStatus.slice(1)}
                      </Text>
                    </TouchableOpacity>
                  )}
                  ListFooterComponent={
                    hasMoreRentals ? (
                      <ActivityIndicator
                        size="large"
                        color="#3182ce"
                        style={{ marginVertical: 16 }}
                      />
                    ) : (
                      <Text
                        style={{
                          textAlign: "center",
                          color: "#4a5568",
                          marginVertical: 16,
                        }}
                      >
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
                    style={{
                      alignItems: "center",
                      padding: 12,
                      backgroundColor: "#3182ce",
                      borderRadius: 8,
                      marginTop: 8,
                    }}
                    accessibilityLabel="Load more rentals"
                    accessibilityRole="button"
                  >
                    <Text style={{ color: "white", fontWeight: "bold" }}>
                      Load More
                    </Text>
                  </TouchableOpacity>
                )}
              </>
            ) : (
              <Text style={{ textAlign: "center", color: "#718096" }}>
                No active rentals at the moment.
              </Text>
            )}
          </View>

          {/* Notifications */}
          <View style={{ paddingHorizontal: 16, paddingTop: 24 }}>
            <Text
              style={{ fontSize: 18, fontWeight: "bold", marginBottom: 16 }}
            >
              Notifications
            </Text>
            {allNotifications.length > 0 ? (
              <FlatList
                data={allNotifications}
                keyExtractor={(item, index) => `${item.id}_${index}`}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    key={item.id}
                    style={{
                      backgroundColor: "#edf2f7",
                      padding: 16,
                      borderRadius: 16,
                      marginBottom: 16,
                    }}
                    onPress={() => handleNotificationPress(item)}
                    accessibilityLabel={`View details for notification: ${item.message}`}
                    accessibilityRole="button"
                  >
                    <Text
                      style={{
                        fontWeight: "bold",
                        color: "#2d3748",
                        fontSize: 16,
                      }}
                    >
                      {item.message}
                    </Text>
                    <Text style={{ color: "#4a5568" }}>
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
                    <Text
                      style={{
                        textAlign: "center",
                        color: "#4a5568",
                        marginVertical: 16,
                      }}
                    >
                      No more notifications to load.
                    </Text>
                  )
                }
                onEndReached={fetchMoreNotifications}
                onEndReachedThreshold={0.5}
                scrollEnabled={false}
              />
            ) : (
              <Text style={{ textAlign: "center", color: "#718096" }}>
                No notifications available.
              </Text>
            )}

            {/* "Remove All" Button */}
            {allNotifications.length > 0 && (
              <TouchableOpacity
                onPress={removeAllNotifications}
                style={{
                  alignItems: "center",
                  padding: 12,
                  backgroundColor: "#e53e3e",
                  borderRadius: 8,
                  marginTop: 8,
                }}
                accessibilityLabel="Remove all notifications"
                accessibilityRole="button"
              >
                <Text style={{ color: "white", fontWeight: "bold" }}>
                  Remove All
                </Text>
              </TouchableOpacity>
            )}

            {/* "View All" Button */}
            {allNotifications.length > 3 && (
              <TouchableOpacity
                onPress={() => setAllNotificationsModalVisible(true)}
                style={{
                  alignItems: "center",
                  padding: 12,
                  backgroundColor: "#3182ce",
                  borderRadius: 8,
                  marginTop: 8,
                }}
                accessibilityLabel="View all notifications"
                accessibilityRole="button"
              >
                <Text style={{ color: "white", fontWeight: "bold" }}>
                  View All
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </ScrollView>
      ) : (
        // If user is not authenticated, display a message or navigate to login
        <View style={styles.notAuthenticatedContainer}>
          <Text style={{ fontSize: 18, color: "#2d3748", textAlign: "center" }}>
            You are not authenticated. Please log in to continue.
          </Text>
          <TouchableOpacity
            onPress={() => navigation.navigate("Login")} // Ensure you have a Login screen in your navigator
            style={{
              backgroundColor: "#3182ce",
              padding: 12,
              borderRadius: 8,
              marginTop: 16,
              alignItems: "center",
            }}
            accessibilityLabel="Navigate to login screen"
            accessibilityRole="button"
          >
            <Text style={{ color: "white", fontWeight: "bold" }}>
              Go to Login
            </Text>
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
        transparent={true}
        onRequestClose={() => setMessagesModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={{ flex: 1 }}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.messageModalContainer}>
              <TouchableOpacity
                onPress={() => setMessagesModalVisible(false)}
                style={styles.closeModalButton}
                accessibilityLabel="Close messages"
                accessibilityRole="button"
              >
                <Ionicons name="close-circle" size={32} color="#2d3748" />
              </TouchableOpacity>

              <Text
                style={{
                  fontSize: 20,
                  fontWeight: "bold",
                  marginBottom: 16,
                  textAlign: "center",
                  color: "#2d3748",
                }}
              >
                Messages
              </Text>

              {messages.length > 0 ? (
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
                      <Text style={{ fontWeight: "bold" }}>
                        {item.senderName}:
                      </Text>
                      <Text>{item.text}</Text>
                      <Text style={styles.chatTimestamp}>
                        {item.timestamp
                          ? item.timestamp.toDate
                            ? item.timestamp.toDate().toLocaleString()
                            : new Date(item.timestamp).toLocaleString()
                          : "N/A"}
                      </Text>
                    </View>
                  )}
                  scrollEnabled={false}
                />
              ) : (
                <Text>No messages yet.</Text>
              )}

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
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Notification Modal */}
      <Modal
        visible={notificationModalVisible}
        animationType="slide"
        transparent={false} // Changed from true to false
        presentationStyle="fullScreen" // Added for full screen
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

            {selectedNotification ? (
              <ScrollView contentContainerStyle={{ padding: 16 }}>
                <Text
                  style={{
                    fontSize: 24,
                    fontWeight: "bold",
                    marginBottom: 16,
                    textAlign: "center",
                    color: "#2d3748",
                  }}
                >
                  Notification Details
                </Text>
                <View style={{ marginBottom: 16 }}>
                  <Text style={{ fontWeight: "bold", color: "#2d3748" }}>
                    Message:
                  </Text>
                  <Text style={{ color: "#4a5568" }}>
                    {selectedNotification.message}
                  </Text>
                </View>
                <View style={{ marginBottom: 16 }}>
                  <Text style={{ fontWeight: "bold", color: "#2d3748" }}>
                    From:
                  </Text>
                  <Text style={{ color: "#4a5568" }}>
                    {selectedNotification.ownerName || "Unknown Owner"}
                  </Text>
                </View>
                <View style={{ marginBottom: 16 }}>
                  <Text style={{ fontWeight: "bold", color: "#2d3748" }}>
                    Date:
                  </Text>
                  <Text style={{ color: "#4a5568" }}>
                    {selectedNotification.createdAt
                      ? selectedNotification.createdAt.toDate
                        ? selectedNotification.createdAt
                            .toDate()
                            .toLocaleString()
                        : new Date(
                            selectedNotification.createdAt
                          ).toLocaleString()
                      : "N/A"}
                  </Text>
                </View>

                {/* Rental Details */}
                {selectedRentalRequest && selectedListing && (
                  <View style={{ marginBottom: 16 }}>
                    <Text
                      style={{
                        fontWeight: "bold",
                        color: "#2d3748",
                      }}
                    >
                      Rental Details:
                    </Text>
                    <Text style={{ color: "#4a5568" }}>
                      Aircraft Model: {selectedListing.aircraft || "N/A"}
                    </Text>
                    <Text style={{ color: "#4a5568" }}>
                      Rental Period: {selectedRentalRequest.rentalDate || "N/A"}
                    </Text>
                    <Text style={{ color: "#4a5568" }}>
                      Estimated Hours:{" "}
                      {selectedRentalRequest.rentalHours || "N/A"}
                    </Text>
                    {/* Detailed Total Cost Components */}
                    {totalCost ? (
                      <>
                        <Text style={{ color: "#4a5568" }}>
                          Rental Cost (${selectedListing.ratesPerHour}/hr): $
                          {totalCost.rentalCost}
                        </Text>
                        <Text style={{ color: "#4a5568" }}>
                          Booking Fee (6%): ${totalCost.bookingFee}
                        </Text>
                        <Text style={{ color: "#4a5568" }}>
                          Tax (8.25%): ${totalCost.tax}
                        </Text>
                        <Text style={{ color: "#4a5568" }}>
                          Processing Fee (3%): ${totalCost.processingFee}
                        </Text>
                        <Text style={{ fontWeight: "bold", color: "#4a5568" }}>
                          Total: ${totalCost.total}
                        </Text>
                      </>
                    ) : (
                      <Text style={{ color: "#4a5568" }}>Total Cost: N/A</Text>
                    )}
                  </View>
                )}

                {/* Proceed to Pay Button */}
                {selectedRentalRequest &&
                  selectedRentalRequest.totalCost &&
                  parseFloat(selectedRentalRequest.totalCost) > 0 && (
                    <TouchableOpacity
                      onPress={() =>
                        navigateToCheckout(selectedNotification.rentalRequestId)
                      }
                      style={styles.paymentButton}
                      accessibilityLabel="Proceed to payment"
                      accessibilityRole="button"
                    >
                      <Text style={styles.paymentButtonText}>
                        Proceed to Pay
                      </Text>
                    </TouchableOpacity>
                  )}

                {/* Message Owner Button */}
                {selectedNotification.ownerId && (
                  <TouchableOpacity
                    onPress={() => {
                      setCurrentChatOwnerId(selectedNotification.ownerId);
                      setMessagesModalVisible(true);
                    }}
                    style={styles.messageOwnerButton}
                    accessibilityLabel="Message Owner"
                    accessibilityRole="button"
                  >
                    <Text style={styles.messageOwnerButtonText}>
                      Message Owner
                    </Text>
                  </TouchableOpacity>
                )}

                {/* Close Button */}
                <TouchableOpacity
                  onPress={closeModal}
                  style={styles.closeButton}
                  accessibilityLabel="Close notification modal"
                  accessibilityRole="button"
                >
                  <Text style={styles.closeButtonText}>Close</Text>
                </TouchableOpacity>
              </ScrollView>
            ) : isRentalRequestLoading ? (
              <ActivityIndicator size="large" color="#3182ce" />
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
            <View style={styles.messageModalContainer}>
              <TouchableOpacity
                onPress={() => setAllNotificationsModalVisible(false)}
                style={styles.closeModalButton}
                accessibilityLabel="Close all notifications"
                accessibilityRole="button"
              >
                <Ionicons name="close-circle" size={32} color="#2d3748" />
              </TouchableOpacity>

              <Text
                style={{
                  fontSize: 20,
                  fontWeight: "bold",
                  marginBottom: 16,
                  textAlign: "center",
                  color: "#2d3748",
                }}
              >
                All Notifications
              </Text>

              {allNotifications.length > 0 ? (
                <FlatList
                  data={allNotifications}
                  keyExtractor={(item, index) => `${item.id}_${index}`}
                  renderItem={({ item }) => (
                    <TouchableOpacity
                      key={item.id}
                      style={{
                        backgroundColor: "#edf2f7",
                        padding: 16,
                        borderRadius: 16,
                        marginBottom: 16,
                      }}
                      onPress={() => {
                        handleNotificationPress(item);
                        setAllNotificationsModalVisible(false);
                      }}
                      accessibilityLabel={`View details for notification: ${item.message}`}
                      accessibilityRole="button"
                    >
                      <Text
                        style={{
                          fontWeight: "bold",
                          color: "#2d3748",
                          fontSize: 16,
                        }}
                      >
                        {item.message}
                      </Text>
                      <Text style={{ color: "#4a5568" }}>
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
                      <Text
                        style={{
                          textAlign: "center",
                          color: "#4a5568",
                          marginVertical: 16,
                        }}
                      >
                        No more notifications to load.
                      </Text>
                    )
                  }
                  onEndReached={fetchMoreNotifications}
                  onEndReachedThreshold={0.5}
                  scrollEnabled={false}
                />
              ) : (
                <Text style={{ textAlign: "center", color: "#718096" }}>
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

// Navigation Container
const BookingNavigator = () => {
  return (
    <NavigationContainer independent={true}>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="BookingCalendar" component={BookingCalendar} />
        <Stack.Screen name="CheckoutScreen" component={CheckoutScreen} />
        <Stack.Screen
          name="ConfirmationScreen"
          component={ConfirmationScreen}
        />
        <Stack.Screen name="Messages" component={MessagesScreen} />
        {/* Ensure you have a Login screen in your navigator */}
        <Stack.Screen name="Login" component={LoginScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
};

// Placeholder LoginScreen Component
const LoginScreen = () => {
  const navigation = useNavigation();

  // Implement your login logic here
  return (
    <View style={styles.loginContainer}>
      <Text style={{ fontSize: 24, fontWeight: "bold", marginBottom: 24 }}>
        Login Screen
      </Text>
      {/* Add your login form here */}
      <TouchableOpacity
        onPress={() => navigation.navigate("BookingCalendar")}
        style={{
          backgroundColor: "#3182ce",
          padding: 12,
          borderRadius: 8,
          alignItems: "center",
        }}
        accessibilityLabel="Navigate to booking calendar after login"
        accessibilityRole="button"
      >
        <Text style={{ color: "white", fontWeight: "bold" }}>Login</Text>
      </TouchableOpacity>
    </View>
  );
};

// Stylesheet
const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  notAuthenticatedContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 16,
  },
  profileContainer: {
    padding: 16,
    backgroundColor: "#f7fafc",
  },
  profileTitle: {
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 16,
    textAlign: "center",
    color: "#2d3748",
  },
  profileRow: {
    flexDirection: "row",
    marginBottom: 8,
  },
  profileLabel: {
    fontWeight: "bold",
    color: "#2d3748",
    flex: 1,
  },
  profileValue: {
    color: "#4a5568",
    flex: 2,
  },
  profileImage: {
    width: 100,
    height: 100,
    borderRadius: 50,
    alignSelf: "center",
    marginTop: 16,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  messageModalContainer: {
    width: "90%",
    height: "80%",
    backgroundColor: "white",
    borderRadius: 16,
    padding: 16,
  },
  notificationModalContainer: {
    flex: 1,
    backgroundColor: "white",
    paddingTop: 16,
  },
  closeModalButton: {
    alignSelf: "flex-end",
  },
  chatBubble: {
    padding: 10,
    borderRadius: 10,
    marginBottom: 10,
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
  chatTimestamp: {
    fontSize: 10,
    color: "#a0aec0",
    marginTop: 4,
  },
  messageInputContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 16,
  },
  messageTextInput: {
    flex: 1,
    borderColor: "#cbd5e0",
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginRight: 8,
  },
  sendButton: {
    backgroundColor: "#3182ce",
    padding: 10,
    borderRadius: 8,
  },
  messageOwnerButton: {
    backgroundColor: "#3182ce",
    padding: 12,
    borderRadius: 8,
    alignItems: "center",
    marginTop: 16,
  },
  messageOwnerButtonText: {
    color: "white",
    fontWeight: "bold",
  },
  closeButton: {
    backgroundColor: "#e2e8f0",
    padding: 12,
    borderRadius: 8,
    alignItems: "center",
    marginTop: 16,
  },
  closeButtonText: {
    color: "#2d3748",
    fontWeight: "bold",
  },
  paymentButton: {
    backgroundColor: "#48bb78",
    padding: 16,
    borderRadius: 8,
    alignItems: "center",
    marginTop: 16,
  },
  paymentButtonText: {
    color: "white",
    fontWeight: "bold",
    fontSize: 16,
  },
  chatBubbleIcon: {
    position: "absolute",
    bottom: 32,
    right: 32,
    backgroundColor: "#3182ce",
    borderRadius: 32,
    padding: 8,
    elevation: 5, // For Android shadow
    shadowColor: "#000", // For iOS shadow
    shadowOffset: { width: 0, height: 2 }, // For iOS shadow
    shadowOpacity: 0.3, // For iOS shadow
    shadowRadius: 3, // For iOS shadow
  },
  loginContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 16,
  },
});

export default BookingNavigator;
