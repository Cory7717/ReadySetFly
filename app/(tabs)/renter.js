// renter.js

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
  Animated,
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
  doc,
  onSnapshot,
  orderBy,
  getDoc,
  serverTimestamp,
  writeBatch,
  limit,
  startAfter,
} from "firebase/firestore";
import * as ImagePicker from "expo-image-picker";
import * as DocumentPicker from "expo-document-picker";
import { getAuth } from "firebase/auth";
import { Ionicons, FontAwesome } from "@expo/vector-icons";
import { useNavigation, useRoute } from "@react-navigation/native";
import DateTimePickerModal from "react-native-modal-datetime-picker";
import MapView, { Marker } from "react-native-maps";
import * as Location from "expo-location";
import Fontisto from "@expo/vector-icons/Fontisto";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import Octicons from "@expo/vector-icons/Octicons";
import { useStripe, CardField } from "@stripe/stripe-react-native";
import { createStackNavigator } from "@react-navigation/stack";

// Import environment variables
import { API_URL } from "@env"; // Ensure react-native-dotenv is configured

// Import your CheckoutScreen component
import CheckoutScreen from "../payment/CheckoutScreen"; // Update with the correct path
import ConfirmationScreen from "../payment/ConfirmationScreen"; // Ensure correct path
import MessagesScreen from "../screens/MessagesScreen"; // Ensure correct path
import BankDetailsForm from "../payment/BankDetailsForm"; // Adjusted path

const Stack = createStackNavigator();

// BookingCalendar Component
const BookingCalendar = ({ airplaneId, ownerId }) => {
  const auth = getAuth();
  const user = auth.currentUser;
  const stripe = useStripe();
  const navigation = useNavigation();

  // State Variables
  const [profileModalVisible, setProfileModalVisible] = useState(false);
  const [menuVisible, setMenuVisible] = useState(false);
  const [rentalCostEstimatorModalVisible, setRentalCostEstimatorModalVisible] =
    useState(false);
  const [messagesModalVisible, setMessagesModalVisible] = useState(false);
  const [transactionModalVisible, setTransactionModalVisible] = useState(false);
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
  const [completedRentals, setCompletedRentals] = useState([]);
  const [ratings, setRatings] = useState({});
  const [rentalDate, setRentalDate] = useState("");
  const [rentalHours, setRentalHours] = useState("");
  const [preferredLocation, setPreferredLocation] = useState("");
  const [isDatePickerVisible, setDatePickerVisibility] = useState(false);
  const [isMapModalVisible, setMapModalVisible] = useState(false);
  const [initialLocation, setInitialLocation] = useState(null);
  const [costPerHour, setCostPerHour] = useState("");
  const [numHours, setNumHours] = useState("");
  const [costPerGallon, setCostPerGallon] = useState("");
  const [numGallons, setNumGallons] = useState("");

  const [rentalRequests, setRentalRequests] = useState([]);
  const [approvedRentals, setApprovedRentals] = useState([]);
  const [currentRentalRequest, setCurrentRentalRequest] = useState(null);
  const [messages, setMessages] = useState([]);
  const [messageText, setMessageText] = useState("");
  const [notifications, setNotifications] = useState([]);
  const [notificationCount, setNotificationCount] = useState(0);

  const slideAnimation = useRef(new Animated.Value(300)).current;
  const renterId = user?.uid;

  // Modal States for Notification Details
  const [notificationModalVisible, setNotificationModalVisible] = useState(false);
  const [selectedNotification, setSelectedNotification] = useState(null);

  // New State for All Notifications Modal
  const [allNotificationsModalVisible, setAllNotificationsModalVisible] = useState(false);

  // Define showDatePicker and hideDatePicker within the component
  const showDatePicker = () => {
    setDatePickerVisibility(true);
  };

  const hideDatePicker = () => {
    setDatePickerVisibility(false);
  };

  // Handle date confirmation
  const handleConfirm = (date) => {
    const formattedDate = `${date.getMonth() + 1}/${date.getDate()}/${date.getFullYear()}`;
    setRentalDate(formattedDate);
    hideDatePicker();
  };

  // Define sendMessage function to prevent ReferenceError
  const sendMessage = async () => {
    if (!messageText.trim()) {
      Alert.alert("Validation Error", "Message cannot be empty.");
      return;
    }

    if (!currentRentalRequest) {
      Alert.alert("Error", "No rental request selected.");
      return;
    }

    const db = getFirestore();
    try {
      await addDoc(collection(db, "renters", renterId, "messages"), {
        rentalRequestId: currentRentalRequest.id,
        senderId: renterId,
        senderName: user.displayName || "User",
        text: messageText.trim(),
        timestamp: serverTimestamp(),
      });
      setMessageText("");
      Alert.alert("Success", "Message sent successfully!");
    } catch (error) {
      console.error("Error sending message:", error);
      Alert.alert("Error", "Failed to send message.");
    }
  };

  // Fetch rental requests and notifications
  useEffect(() => {
    const db = getFirestore();

    if (!renterId) {
      console.error("Error: renterId is undefined.");
      Alert.alert("Error", "User is not authenticated.");
      return;
    }

    // Listen to Rental Requests
    const rentalRequestsRef = collection(db, "renters", renterId, "rentalRequests");
    const rentalRequestsQueryInstance = query(
      rentalRequestsRef,
      where("rentalStatus", "in", ["pending", "approved", "denied"]),
      orderBy("createdAt", "desc"),
      limit(20) // Initial fetch limit
    );

    const unsubscribeRentalRequests = onSnapshot(
      rentalRequestsQueryInstance,
      async (snapshot) => {
        const requests = [];
        for (const docSnap of snapshot.docs) {
          const requestData = docSnap.data();
          let ownerName = "Unknown Owner";
          if (requestData.ownerId) {
            try {
              const ownerDocRef = doc(db, "owners", requestData.ownerId);
              const ownerDoc = await getDoc(ownerDocRef);
              if (ownerDoc.exists()) {
                ownerName = ownerDoc.data().fullName || "Unknown Owner";
              }
            } catch (error) {
              console.error("Error fetching owner details:", error);
            }
          }

          requests.push({
            id: docSnap.id,
            ...requestData,
            ownerName,
          });
        }
        setRentalRequests(requests);

        // Separate approved rentals
        const approved = requests.filter(
          (request) => request.rentalStatus === "approved"
        );
        setApprovedRentals(approved);
      },
      (error) => {
        console.error("Error fetching rental requests:", error);
        Alert.alert("Error", "Failed to fetch rental requests.");
      }
    );

    // Listen to Notifications
    const notificationsRef = collection(db, "renters", renterId, "notifications");
    const notificationsQueryInstance = query(
      notificationsRef,
      orderBy("createdAt", "desc"),
      limit(20) // Initial fetch limit
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
        setNotificationCount(notifs.length);
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
  }, [renterId]);

  // Listen to approved rentals and handle notifications
  useEffect(() => {
    if (approvedRentals.length > 0) {
      approvedRentals.forEach((rental) => {
        // Check if a notification for this rental already exists to prevent duplicates
        const existingNotif = notifications.find(
          (notif) => notif.rentalRequestId === rental.id
        );
        if (!existingNotif) {
          // Create a notification
          const db = getFirestore();
          addDoc(collection(db, "renters", renterId, "notifications"), {
            rentalRequestId: rental.id,
            message:
              "Your rental request has been approved! Please proceed with the payment.",
            type: "rentalApproved",
            createdAt: serverTimestamp(),
          }).catch((error) => {
            console.error("Error adding notification:", error);
          });
        }
      });
    }
  }, [approvedRentals, notifications, renterId]);

  // Handle Notifications Press
  const handleNotificationPress = async (notification) => {
    console.log("Pressed notification:", notification); // Debugging log

    const db = getFirestore();
    try {
      if (!notification) {
        throw new Error("Notification object is undefined.");
      }

      // Check if the notification is related to a rental request
      if (notification.rentalRequestId) {
        const rentalRequestRef = doc(
          db,
          "renters",
          renterId,
          "rentalRequests",
          notification.rentalRequestId
        );

        const rentalRequestSnap = await getDoc(rentalRequestRef);
        console.log("Fetched rental request snap:", rentalRequestSnap.exists());

        if (rentalRequestSnap.exists()) {
          const rentalRequest = rentalRequestSnap.data();
          console.log("Fetched rental request data:", rentalRequest);

          setCurrentRentalRequest({ id: rentalRequestSnap.id, ...rentalRequest });

          // Fetch ownerName if available
          let ownerName = "Unknown Owner";
          if (rentalRequest.ownerId) {
            try {
              const ownerDocRef = doc(db, "owners", rentalRequest.ownerId);
              const ownerDoc = await getDoc(ownerDocRef);
              if (ownerDoc.exists()) {
                ownerName = ownerDoc.data().fullName || "Unknown Owner";
              }
            } catch (error) {
              console.error("Error fetching owner details:", error);
            }
          }

          // If notification type is "rentalApproved", navigate to payment
          if (notification.type === "rentalApproved") {
            setSelectedNotification({
              ...notification,
              ownerName, // Add ownerName to the selectedNotification
            });
            setNotificationModalVisible(false); // Close notificationModal if open
            setTransactionModalVisible(true); // Open transactionModal for payment
            console.log("Opening Transaction Modal for payment.");
          } else {
            // Handle other notification types as before
            setSelectedNotification({
              ...notification,
              ownerName,
            });
            setNotificationModalVisible(true); // Open notificationModal for other types
            console.log("Opening Notification Modal for other types.");
          }
        } else {
          throw new Error("Rental request not found.");
        }
      } else {
        // Handle notifications without rentalRequestId based on their type
        switch (notification.type) {
          case "rentalDenied":
            Alert.alert(
              "Rental Denied",
              notification.message || "Your rental request has been denied."
            );
            break;
          case "generalInfo":
            Alert.alert("Info", notification.message || "No additional information.");
            break;
          case "systemAlert":
            Alert.alert("Alert", notification.message || "System alert.");
            break;
          // Add more cases as needed for different notification types
          default:
            Alert.alert(
              "Notification",
              notification.message || "You have a new notification."
            );
        }
      }
    } catch (error) {
      console.error("Error handling notification press:", error);
      Alert.alert("Error", error.message);
    }
  };

  // Handle Approved Rentals Press
  const handleApprovedRentalPress = (rental) => {
    console.log("Pressed approved rental:", rental); // Debugging log
    if (rental) {
      setCurrentRentalRequest(rental);
      setTransactionModalVisible(true); // Open transactionModal for payment
      console.log("Opening Transaction Modal for payment.");
    } else {
      Alert.alert("Error", "Rental details are unavailable.");
    }
  };

  // Listen to messages for the current rental request
  useEffect(() => {
    if (currentRentalRequest) {
      const db = getFirestore();
      const messagesRef = collection(db, "renters", renterId, "messages");
      const messagesQuery = query(
        messagesRef,
        where("rentalRequestId", "==", currentRentalRequest.id),
        orderBy("timestamp", "asc")
      );

      const unsubscribeMessages = onSnapshot(
        messagesQuery,
        (snapshot) => {
          const msgs = [];
          snapshot.docs.forEach((docSnap) => {
            msgs.push({ id: docSnap.id, ...docSnap.data() });
          });
          setMessages(msgs);
        },
        (error) => {
          console.error("Error fetching messages:", error);
          Alert.alert("Error", "Failed to fetch messages.");
        }
      );

      return () => unsubscribeMessages();
    }
  }, [currentRentalRequest, renterId]);

  // Toggle Messages Modal
  const toggleMessagesModal = () => {
    // Close other modals before opening messagesModal
    setTransactionModalVisible(false);
    setNotificationModalVisible(false);
    setMessagesModalVisible(!messagesModalVisible);
    console.log("Toggling Messages Modal.");
  };

  // Fetch Completed Rentals
  const fetchCompletedRentals = async () => {
    const db = getFirestore();
    const rentalsRef = collection(db, "orders");
    const resolvedRenterId = renterId || user?.uid;

    if (resolvedRenterId) {
      const q = query(
        rentalsRef,
        where("renterId", "==", resolvedRenterId),
        where("status", "==", "completed"),
        orderBy("completedAt", "desc"),
        limit(20) // Initial fetch limit
      );

      try {
        const querySnapshot = await getDocs(q);
        const rentals = [];
        querySnapshot.forEach((doc) => {
          rentals.push({ id: doc.id, ...doc.data() });
        });
        setCompletedRentals(rentals);
        console.log("Fetched completed rentals:", rentals);
      } catch (error) {
        console.error("Error fetching completed rentals:", error);
        Alert.alert("Error", "Failed to fetch completed rentals.");
      }
    } else {
      console.error("Error: renterId is undefined.");
      Alert.alert("Error", "Renter ID is undefined.");
    }
  };

  // Get Current Location
  const getCurrentLocation = async () => {
    let { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission to access location was denied");
      return;
    }

    let location = await Location.getCurrentPositionAsync({});
    setInitialLocation({
      latitude: location.coords.latitude,
      longitude: location.coords.longitude,
      latitudeDelta: 0.0922,
      longitudeDelta: 0.0421,
    });
    console.log("Fetched current location:", location.coords);
  };

  // Handle Rating Submission
  const handleRating = async (rentalId, rating) => {
    const db = getFirestore();
    try {
      const rentalDocRef = doc(db, "orders", rentalId);
      await updateDoc(rentalDocRef, { rating });
      setRatings((prevRatings) => ({ ...prevRatings, [rentalId]: rating }));
      Alert.alert("Rating Submitted", "Thank you for your feedback!");
      console.log(`Submitted rating of ${rating} for rental ID: ${rentalId}`);
    } catch (error) {
      console.error("Error submitting rating:", error);
      Alert.alert("Error", "Failed to submit rating.");
    }
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
      console.log("Picked image:", result.assets[0].uri);
    }
  };

  // Document Picker
  const pickDocument = async (field) => {
    let result = await DocumentPicker.getDocumentAsync({
      type: ["application/pdf", "image/*"],
    });

    if (result.type !== "cancel") {
      setProfileData({ ...profileData, [field]: result.uri });
      console.log(`Picked document for ${field}:`, result.uri);
    }
  };

  // Handle Profile Submission
  const handleProfileSubmit = (values) => {
    setProfileData(values);
    setProfileSaved(true);
    setProfileModalVisible(false);
    console.log("Profile submitted:", values);
  };

  // Handle Navigation
  const handleNavigation = (filter) => {
    try {
      navigation.navigate("Home", { filter });
      console.log(`Navigated to Home with filter: ${filter}`);
    } catch (error) {
      console.error("Navigation error:", error);
      Alert.alert("Error", "Failed to navigate to the home screen.");
    }
  };

  // Calculate Rental Cost
  const calculateRentalCost = () => {
    const hours = parseFloat(rentalHours) || 0;
    const hourlyCost = parseFloat(costPerHour) || 200; // Example cost per hour
    const bookingFee = hourlyCost * hours * 0.06;
    const processingFee = hourlyCost * hours * 0.03;
    const tax = hourlyCost * hours * 0.0825;
    const totalCost = hourlyCost * hours + bookingFee + processingFee + tax;

    console.log("Calculated total cost:", totalCost.toFixed(2));

    return totalCost.toFixed(2);
  };

  // ************* Add createPaymentIntent Function *************
  const createPaymentIntent = async (amount) => {
    if (isNaN(amount) || amount <= 0) {
      Alert.alert("Invalid Amount", "The payment amount is invalid.");
      return null;
    }

    try {
      const response = await fetch(`${API_URL}/create-payment-intent`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ amount }), // Amount should be in the smallest currency unit (e.g., cents)
      });

      const data = await response.json();

      if (response.ok) {
        return data.clientSecret;
      } else {
        console.error("Error creating payment intent:", data);
        Alert.alert("Payment Error", data.message || "Failed to create payment intent.");
        return null;
      }
    } catch (error) {
      console.error("Error creating payment intent:", error);
      Alert.alert("Payment Error", "An unexpected error occurred.");
      return null;
    }
  };
  // ************* End of createPaymentIntent Function *************

  // ************* Update navigateToCheckout Function *************
  const navigateToCheckout = async () => {
    if (!currentRentalRequest) {
      Alert.alert("Error", "No rental request selected.");
      console.error("navigateToCheckout called without a currentRentalRequest.");
      return;
    }

    let totalCost =
      parseFloat(currentRentalRequest.totalCost) ||
      parseFloat(currentRentalRequest.rentalDetails?.totalCost) ||
      parseFloat(calculateRentalCost());

    if (isNaN(totalCost) || totalCost <= 0) {
      Alert.alert("Invalid Total Cost", "The total cost for this rental is invalid.");
      return;
    }

    // Convert amount to the smallest currency unit (e.g., cents)
    const amountInCents = Math.round(totalCost * 100);

    // Create Payment Intent
    const clientSecret = await createPaymentIntent(amountInCents);

    if (clientSecret) {
      console.log(
        `Navigating to CheckoutScreen with rentalRequestId: ${currentRentalRequest.id}, amount: ${totalCost}`
      );

      navigation.navigate("CheckoutScreen", {
        rentalRequestId: currentRentalRequest.id,
        amount: totalCost,
        clientSecret, // Pass the clientSecret to the CheckoutScreen
      });
    } else {
      Alert.alert("Payment Error", "Unable to proceed with payment.");
    }
  };
  // ************* End of navigateToCheckout Function *************

  // ************* Enhanced Messaging Functions *************

  // Function to open chat thread
  const openChatThread = async (rentalRequestId) => {
    const db = getFirestore();
    try {
      // Fetch rental request details to get ownerId
      const rentalRequestRef = doc(db, "renters", renterId, "rentalRequests", rentalRequestId);
      const rentalRequestSnap = await getDoc(rentalRequestRef);
      if (!rentalRequestSnap.exists()) {
        throw new Error("Rental request does not exist.");
      }
      const rentalRequest = rentalRequestSnap.data();
      const ownerId = rentalRequest.ownerId;

      // Check if chat thread exists
      const chatThreadsRef = collection(db, "messages");
      const chatQuery = query(
        chatThreadsRef,
        where("participants", "array-contains", renterId),
        where("participants", "array-contains", ownerId)
      );
      const chatSnapshot = await getDocs(chatQuery);

      let existingChatThread = null;
      chatSnapshot.forEach((docSnap) => {
        const chatData = docSnap.data();
        if (
          chatData.participants.includes(renterId) &&
          chatData.participants.includes(ownerId)
        ) {
          existingChatThread = { id: docSnap.id, ...chatData };
        }
      });

      let chatThreadId = existingChatThread ? existingChatThread.id : null;

      if (!chatThreadId) {
        // Create new chat thread
        const chatThread = {
          participants: [renterId, ownerId],
          messages: [],
          rentalRequestId: rentalRequestId,
          createdAt: serverTimestamp(),
        };
        const chatDocRef = await addDoc(collection(db, "messages"), chatThread);
        chatThreadId = chatDocRef.id;
      }

      // Navigate to MessagesScreen with chatThreadId
      navigation.navigate("Messages", { chatThreadId });
    } catch (error) {
      console.error("Error opening chat thread:", error);
      Alert.alert("Error", "Failed to open chat thread.");
    }
  };

  // ************* End of Enhanced Messaging Functions *************

  // ************* Pagination for Notifications *************
  const [allNotifications, setAllNotifications] = useState([]);
  const [notificationsLastDoc, setNotificationsLastDoc] = useState(null);
  const [hasMoreNotifications, setHasMoreNotifications] = useState(true);
  const NOTIFICATIONS_PAGE_SIZE = 20;

  const fetchMoreNotifications = async () => {
    if (!hasMoreNotifications) return;

    const db = getFirestore();
    try {
      let notificationsQueryInstance = query(
        collection(db, "renters", renterId, "notifications"),
        orderBy("createdAt", "desc"),
        limit(NOTIFICATIONS_PAGE_SIZE)
      );

      if (notificationsLastDoc) {
        notificationsQueryInstance = query(
          collection(db, "renters", renterId, "notifications"),
          orderBy("createdAt", "desc"),
          startAfter(notificationsLastDoc),
          limit(NOTIFICATIONS_PAGE_SIZE)
        );
      }

      const snapshot = await getDocs(notificationsQueryInstance);

      if (!snapshot.empty) {
        const newNotifs = snapshot.docs.map((docSnap) => ({
          id: docSnap.id,
          ...docSnap.data(),
        }));
        setAllNotifications([...allNotifications, ...newNotifs]);

        const lastVisible = snapshot.docs[snapshot.docs.length - 1];
        setNotificationsLastDoc(lastVisible);

        if (snapshot.docs.length < NOTIFICATIONS_PAGE_SIZE) {
          setHasMoreNotifications(false);
        }
      } else {
        setHasMoreNotifications(false);
      }
    } catch (error) {
      console.error("Error fetching more notifications:", error);
      Alert.alert("Error", "Failed to fetch more notifications.");
    }
  };

  useEffect(() => {
    setAllNotifications(notifications);
  }, [notifications]);

  // ************* Cleanup Functions *************

  // Function to clean up old notifications (optional)
  const cleanupOldNotifications = async () => {
    const db = getFirestore();
    const notificationsRef = collection(db, "renters", renterId, "notifications");
    const q = query(
      notificationsRef,
      orderBy("createdAt", "desc"),
      limit(100) // Keep latest 100 notifications
    );

    try {
      const snapshot = await getDocs(q);
      const batch = writeBatch(db);
      snapshot.docs.forEach((docSnap, index) => {
        if (index >= 100) {
          batch.delete(docSnap.ref);
        }
      });
      await batch.commit();
      console.log("Old notifications cleaned up.");
    } catch (error) {
      console.error("Error cleaning up notifications:", error);
      Alert.alert("Error", "Failed to clean up notifications.");
    }
  };

  // Call cleanup function periodically or based on certain conditions
  useEffect(() => {
    // Example: Cleanup after fetching notifications
    cleanupOldNotifications();
  }, [allNotifications]);

  // ************* End of Cleanup Functions *************

  return (
    <View style={{ flex: 1, backgroundColor: "white" }}>
      <SafeAreaView style={{ backgroundColor: "white" }}>
        <StatusBar hidden={true} />
      </SafeAreaView>

      <ScrollView
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={fetchCompletedRentals} />
        }
        contentContainerStyle={{ paddingBottom: 16 }}
      >
        {/* Header Section with Welcome Text and Inputs */}
        <ImageBackground
          source={require("../../Assets/images/wingtip_clouds.jpg")}
          style={{
            height: 200,
            paddingTop: Platform.OS === "android" ? StatusBar.currentHeight : 0,
            justifyContent: "center",
            paddingHorizontal: 16,
          }}
          resizeMode="cover"
        >
          <SafeAreaView style={{ flex: 1 }}>
            <Text style={{ fontSize: 20, fontWeight: "bold", color: "white" }}>
              Good afternoon, {user?.displayName || "User"}
            </Text>
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                marginTop: 16,
              }}
            >
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
              >
                <Text>{rentalDate || "Select Date"}</Text>
              </TouchableOpacity>
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
                onChangeText={setRentalHours}
                value={rentalHours}
              />
            </View>
            <TouchableOpacity
              onPress={() => setMapModalVisible(true)}
              style={{
                backgroundColor: "white",
                borderRadius: 8,
                paddingHorizontal: 16,
                paddingVertical: 12,
                marginTop: 16,
                opacity: 0.9,
                textAlign: "center",
                justifyContent: "center",
              }}
            >
              <Text style={{ textAlign: "center" }}>
                {preferredLocation || "Preferred City/Airport"}
              </Text>
            </TouchableOpacity>
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
          >
            <Octicons name="paper-airplane" size={32} color="#3182ce" />
            <Text>All Aircraft</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={{ alignItems: "center" }}
            onPress={() => handleNavigation("jets")}
          >
            <Ionicons name="airplane-outline" size={32} color="#3182ce" />
            <Text>Jets</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={{ alignItems: "center" }}
            onPress={() => handleNavigation("pistons")}
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
          >
            <Fontisto name="helicopter" size={32} color="#3182ce" />
            <Text>Helicopters</Text>
          </TouchableOpacity>
        </View>

        {/* Recent Searches */}
        <View style={{ paddingHorizontal: 16 }}>
          <Text style={{ fontSize: 18, fontWeight: "bold", marginBottom: 16 }}>
            Recent searches
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
          <Text style={{ fontSize: 18, fontWeight: "bold", marginBottom: 16 }}>
            Aircraft Types
          </Text>
          <View
            style={{ flexDirection: "row", justifyContent: "space-between" }}
          >
            <TouchableOpacity
              style={{ flex: 1, marginRight: 8 }}
              onPress={() => handleNavigation("single-piston")}
            >
              <Text style={{ marginTop: 8, fontWeight: "bold" }}>
                Single Engine Piston
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={{ flex: 1 }}
              onPress={() => handleNavigation("twin-piston")}
            >
              <Text style={{ marginTop: 8, fontWeight: "bold" }}>
                Twin Engine Piston
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Recommended for You */}
        <View style={{ paddingHorizontal: 16, paddingTop: 24 }}>
          <Text style={{ fontSize: 18, fontWeight: "bold", marginBottom: 16 }}>
            Recommended for you
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <TouchableOpacity
              style={{ marginRight: 16 }}
              onPress={() => handleNavigation("cessna-172")}
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
            <TouchableOpacity
              style={{ marginRight: 16 }}
              onPress={() => handleNavigation("beechcraft-baron")}
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
            <TouchableOpacity
              style={{ marginRight: 16 }}
              onPress={() => handleNavigation("cirrus-sr22")}
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

        {/* Manage Your Rentals Section */}
        <View style={{ paddingHorizontal: 16, paddingTop: 24 }}>
          <Text style={{ fontSize: 18, fontWeight: "bold", marginBottom: 16 }}>
            Manage Your Rentals
          </Text>
          {completedRentals.length > 0 ? (
            <FlatList
              data={completedRentals}
              keyExtractor={(item, index) => `${item.id}_${index}`} // Ensure rental.id is unique and exists
              renderItem={({ item }) => (
                <View
                  key={item.id} // Ensure rental.id is unique and exists
                  style={{
                    backgroundColor: "#edf2f7",
                    padding: 16,
                    borderRadius: 16,
                    marginBottom: 16,
                  }}
                >
                  <Text style={{ fontWeight: "bold", color: "#2d3748" }}>
                    {item.renterName}
                  </Text>
                  <Text style={{ color: "#4a5568" }}>{item.rentalPeriod}</Text>
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      marginTop: 8,
                    }}
                  >
                    <Text style={{ fontWeight: "bold", color: "#2d3748" }}>
                      Rate this renter:
                    </Text>
                    <View style={{ flexDirection: "row", marginLeft: 16 }}>
                      {[1, 2, 3, 4, 5].map((star) => (
                        <TouchableOpacity
                          key={`${item.id}_${star}`} // Unique key by combining rental.id and star
                          onPress={() => handleRating(item.id, star)}
                        >
                          <FontAwesome
                            name={
                              star <= (ratings[item.id] || 0)
                                ? "star"
                                : "star-o"
                            }
                            size={24}
                            color="gold"
                          />
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                  <TouchableOpacity
                    onPress={() => openChatThread(item.id)}
                    style={{
                      backgroundColor: "#3182ce",
                      padding: 12,
                      borderRadius: 8,
                      alignItems: "center",
                      marginTop: 16,
                    }}
                  >
                    <Text style={{ color: "white", fontWeight: "bold" }}>
                      Message Owner
                    </Text>
                  </TouchableOpacity>
                </View>
              )}
            />
          ) : (
            <Text style={{ textAlign: "center", color: "#718096" }}>
              No completed rentals available.
            </Text>
          )}
        </View>
        {/* ************* End of Completed Rentals Section ************* */}

        {/* ************* Approved Rentals Section with Pagination ************* */}
        <View style={{ paddingHorizontal: 16, paddingTop: 24 }}>
          <Text style={{ fontSize: 18, fontWeight: "bold", marginBottom: 16 }}>
            Approved Rentals
          </Text>
          {approvedRentals.length > 0 ? (
            <>
              <FlatList
                data={approvedRentals}
                keyExtractor={(item, index) => `${item.id}_${index}`} // Ensure rental.id is unique
                renderItem={({ item }) => (
                  <TouchableOpacity
                    key={item.id} // Ensure rental.id is unique
                    style={{
                      backgroundColor: "#edf2f7",
                      padding: 16,
                      borderRadius: 16,
                      marginBottom: 16,
                    }}
                    onPress={() => handleApprovedRentalPress(item)}
                  >
                    <Text style={{ fontWeight: "bold", color: "#2d3748", fontSize: 16 }}>
                      {item.aircraftModel}
                    </Text>
                    <Text style={{ color: "#4a5568" }}>Renter: {item.renterName}</Text>
                    <Text style={{ color: "#4a5568" }}>
                      Rental Period: {item.rentalPeriod}
                    </Text>
                    <Text style={{ color: "#4a5568" }}>
                      Total Cost: ${item.totalCost}
                    </Text>
                    <Text>
                      Payment Status: {item.paymentStatus ? item.paymentStatus : "N/A"}
                    </Text>
                  </TouchableOpacity>
                )}
                ListFooterComponent={
                  hasMoreNotifications ? (
                    <ActivityIndicator size="large" color="#3182ce" style={{ marginVertical: 16 }} />
                  ) : (
                    <Text style={{ textAlign: "center", color: "#4a5568", marginVertical: 16 }}>
                      No more approved rentals to load.
                    </Text>
                  )
                }
                onEndReached={fetchMoreNotifications}
                onEndReachedThreshold={0.5}
              />

              {/* Load More Button */}
              {hasMoreNotifications && (
                <TouchableOpacity
                  onPress={fetchMoreNotifications}
                  style={{
                    alignItems: "center",
                    padding: 12,
                    backgroundColor: "#3182ce",
                    borderRadius: 8,
                    marginTop: 8,
                  }}
                >
                  <Text style={{ color: "white", fontWeight: "bold" }}>Load More</Text>
                </TouchableOpacity>
              )}
            </>
          ) : (
            <Text style={{ textAlign: "center", color: "#718096" }}>
              No approved rentals at the moment.
            </Text>
          )}
        </View>
        {/* ************* End of Approved Rentals Section ************* */}

        {/* ************* Notifications Section with Pagination ************* */}
        <View style={{ paddingHorizontal: 16, paddingTop: 24 }}>
          <Text style={{ fontSize: 18, fontWeight: "bold", marginBottom: 16 }}>
            Notifications
          </Text>
          {allNotifications.length > 0 ? (
            <FlatList
              data={allNotifications}
              keyExtractor={(item, index) => `${item.id}_${index}`} // Ensure unique keys
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
                >
                  <Text style={{ fontWeight: "bold", color: "#2d3748", fontSize: 16 }}>
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
                  <ActivityIndicator size="large" color="#3182ce" style={{ marginVertical: 16 }} />
                ) : (
                  <Text style={{ textAlign: "center", color: "#4a5568", marginVertical: 16 }}>
                    No more notifications to load.
                  </Text>
                )
              }
              onEndReached={fetchMoreNotifications}
              onEndReachedThreshold={0.5}
            />
          ) : (
            <Text style={{ textAlign: "center", color: "#718096" }}>
              No notifications available.
            </Text>
          )}

          {/* "View All" Button */}
          {notifications.length > 3 && (
            <TouchableOpacity
              onPress={() => setAllNotificationsModalVisible(true)}
              style={{
                alignItems: "center",
                padding: 12,
                backgroundColor: "#3182ce",
                borderRadius: 8,
                marginTop: 8,
              }}
            >
              <Text style={{ color: "white", fontWeight: "bold" }}>View All</Text>
            </TouchableOpacity>
          )}
        </View>
        {/* ************* End of Notifications Section ************* */}
      </ScrollView>

      {/* Profile Information Display */}
      {profileSaved ? (
        <View style={styles.profileContainer}>
          <Text style={styles.profileTitle}>Profile Information</Text>
          <View style={styles.profileRow}>
            <Text style={styles.profileLabel}>Name:</Text>
            <Text style={styles.profileValue}>{profileData.name}</Text>
          </View>
          {/* Add other profile fields as needed */}
          {profileData.image && (
            <Image
              source={{ uri: profileData.image }}
              style={styles.profileImage}
            />
          )}
        </View>
      ) : (
        <View style={styles.profileContainer}>
          <Text style={styles.profileTitle}>No Profile Information Available</Text>
        </View>
      )}

      {/* ************* Messages Modal ************* */}
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
              >
                <Ionicons name="close-circle" size={32} color="#2d3748" />
              </TouchableOpacity>

              {messages.length > 0 ? (
                <FlatList
                  data={messages}
                  keyExtractor={(item, index) =>
                    `${item.senderId}_${item.timestamp?.seconds}_${item.timestamp?.nanoseconds}_${index}`
                  } // Ensures unique keys by including index
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
                />
                <TouchableOpacity onPress={sendMessage} style={styles.sendButton}>
                  <Ionicons name="send" size={24} color="white" />
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
      {/* ************* End of Messages Modal ************* */}

      {/* ************* Transaction Details Modal ************* */}
      <Modal
        visible={transactionModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setTransactionModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={{ flex: 1 }}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.transactionModalContainer}>
              <TouchableOpacity
                onPress={() => setTransactionModalVisible(false)}
                style={styles.closeModalButton}
              >
                <Ionicons name="close-circle" size={32} color="#2d3748" />
              </TouchableOpacity>

              {currentRentalRequest ? (
                <View style={{ flex: 1 }}>
                  <Text
                    style={{
                      fontSize: 20,
                      fontWeight: "bold",
                      marginBottom: 16,
                      textAlign: "center",
                      color: "#2d3748",
                    }}
                  >
                    Transaction Details
                  </Text>
                  <View style={{ marginBottom: 16 }}>
                    <Text style={{ fontWeight: "bold", color: "#2d3748" }}>
                      Aircraft Model:
                    </Text>
                    <Text style={{ color: "#4a5568" }}>
                      {currentRentalRequest.aircraftModel}
                    </Text>
                  </View>
                  <View style={{ marginBottom: 16 }}>
                    <Text style={{ fontWeight: "bold", color: "#2d3748" }}>
                      Rental Period:
                    </Text>
                    <Text style={{ color: "#4a5568" }}>
                      {currentRentalRequest.rentalPeriod}
                    </Text>
                  </View>
                  <View style={{ marginBottom: 16 }}>
                    <Text style={{ fontWeight: "bold", color: "#2d3748" }}>
                      Total Cost:
                    </Text>
                    <Text style={{ color: "#4a5568" }}>
                      ${currentRentalRequest.totalCost}
                    </Text>
                  </View>

                  {/* Complete Payment Button */}
                  <TouchableOpacity
                    onPress={navigateToCheckout}
                    style={styles.paymentButton}
                  >
                    <Text style={styles.paymentButtonText}>Complete Payment</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <Text style={{ textAlign: "center", color: "#718096" }}>
                  No rental request available for payment.
                </Text>
              )}
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
      {/* ************* End of Transaction Details Modal ************* */}

      {/* ************* Notification Details Modal ************* */}
      <Modal
        visible={notificationModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setNotificationModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={{ flex: 1 }}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.messageModalContainer}>
              <TouchableOpacity
                onPress={() => setNotificationModalVisible(false)}
                style={styles.closeModalButton}
              >
                <Ionicons name="close-circle" size={32} color="#2d3748" />
              </TouchableOpacity>

              {selectedNotification ? (
                <>
                  <Text
                    style={{
                      fontSize: 20,
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
                          ? selectedNotification.createdAt.toDate().toLocaleString()
                          : new Date(selectedNotification.createdAt).toLocaleString()
                        : "N/A"}
                    </Text>
                  </View>

                  {/* Conditionally render buttons based on notification type */}
                  {selectedNotification.type === "rentalApproved" && (
                    <TouchableOpacity
                      onPress={navigateToCheckout}
                      style={styles.paymentButton}
                    >
                      <Text style={styles.paymentButtonText}>Process Payment</Text>
                    </TouchableOpacity>
                  )}

                  {selectedNotification.type === "rentalDenied" && (
                    <TouchableOpacity
                      onPress={() => setNotificationModalVisible(false)}
                      style={styles.closeButton}
                    >
                      <Text style={styles.closeButtonText}>Close</Text>
                    </TouchableOpacity>
                  )}

                  {/* Add more conditions for other notification types as needed */}
                </>
              ) : (
                <ActivityIndicator size="large" color="#3182ce" />
              )}
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
      {/* ************* End of Notification Details Modal ************* */}

      {/* ************* All Notifications Modal ************* */}
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
                  keyExtractor={(item, index) => `${item.id}_${index}`} // Ensure unique keys
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
                        setAllNotificationsModalVisible(false); // Close "All Notifications" modal when a notification is pressed
                      }}
                    >
                      <Text style={{ fontWeight: "bold", color: "#2d3748", fontSize: 16 }}>
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
                      <ActivityIndicator size="large" color="#3182ce" style={{ marginVertical: 16 }} />
                    ) : (
                      <Text style={{ textAlign: "center", color: "#4a5568", marginVertical: 16 }}>
                        No more notifications to load.
                      </Text>
                    )
                  }
                  onEndReached={fetchMoreNotifications}
                  onEndReachedThreshold={0.5}
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
      {/* ************* End of All Notifications Modal ************* */}

      {/* Chat Bubble Button */}
      <TouchableOpacity
        style={styles.chatBubbleIcon}
        onPress={toggleMessagesModal} // Directly toggle the modal
      >
        <Ionicons name="chatbubble-ellipses" size={32} color="white" />
      </TouchableOpacity>
    </View>
  );
};

// BookingNavigator Component with Single Stack Navigator
const BookingNavigator = () => {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="BookingCalendar" component={BookingCalendar} />
      <Stack.Screen name="CheckoutScreen" component={CheckoutScreen} />
      <Stack.Screen name="ConfirmationScreen" component={ConfirmationScreen} />
      <Stack.Screen name="Messages" component={MessagesScreen} />
    </Stack.Navigator>
  );
};

// Styles Object
const styles = StyleSheet.create({
  // Reusable Styles
  chatBubbleIcon: {
    position: "absolute",
    bottom: 20,
    right: 20,
    backgroundColor: "#3182ce",
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center", // Center the modal vertically
    alignItems: "center", // Center the modal horizontally
  },
  messageModalContainer: {
    width: "90%",
    height: "80%", // Adjusted height for better visibility
    backgroundColor: "white",
    borderRadius: 24,
    padding: 24,
    position: "relative",
  },
  transactionModalContainer: {
    width: "90%",
    backgroundColor: "white",
    borderRadius: 24,
    padding: 24,
    position: "relative",
    maxHeight: "80%",
    flex: 1,
  },
  closeModalButton: {
    position: "absolute",
    top: 10,
    right: 10,
  },
  chatBubble: {
    padding: 8,
    borderRadius: 8,
    marginVertical: 4,
    maxWidth: "80%",
  },
  chatBubbleLeft: {
    backgroundColor: "#bee3f8",
    alignSelf: "flex-start",
  },
  chatBubbleRight: {
    backgroundColor: "#e2e8f0",
    alignSelf: "flex-end",
  },
  chatTimestamp: {
    fontSize: 10,
    color: "#4a5568",
    marginTop: 4,
  },
  messageInputContainer: {
    flexDirection: "row",
    alignItems: "center",
    borderTopWidth: 1,
    borderTopColor: "#e2e8f0",
    paddingTop: 8,
  },
  messageTextInput: {
    flex: 1,
    borderColor: "#e2e8f0",
    borderWidth: 1,
    borderRadius: 24,
    padding: 8,
    marginRight: 8,
  },
  sendButton: {
    backgroundColor: "#3182ce",
    padding: 12,
    borderRadius: 24,
  },
  profileContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "white",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.22,
    shadowRadius: 2.22,
    elevation: 3,
    borderRadius: 24,
    marginBottom: 16,
  },
  profileTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#2d3748",
    marginBottom: 8,
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
    color: "#718096",
    flex: 2,
  },
  profileImage: {
    width: 144,
    height: 144,
    borderRadius: 8,
    marginTop: 8,
  },
  paymentButton: {
    backgroundColor: "#3182ce",
    padding: 16,
    borderRadius: 8,
    alignItems: "center",
    marginTop: 16,
  },
  paymentButtonText: {
    color: "white",
    fontWeight: "bold",
  },
  closeButton: {
    backgroundColor: "#e53e3e",
    padding: 16,
    borderRadius: 8,
    alignItems: "center",
    marginTop: 16,
  },
  closeButtonText: {
    color: "white",
    fontWeight: "bold",
  },
});

export default BookingNavigator;
