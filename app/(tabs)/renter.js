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
import { Ionicons, FontAwesome, Octicons, MaterialCommunityIcons, Fontisto } from "@expo/vector-icons";
import { NavigationContainer, useNavigation } from "@react-navigation/native";
import DateTimePickerModal from "react-native-modal-datetime-picker";
import MapView, { Marker } from "react-native-maps";
import * as Location from "expo-location";
import { useStripe } from "@stripe/stripe-react-native";
import { createStackNavigator } from "@react-navigation/stack";

// Import environment variables
import { API_URL } from "@env"; 

// Import your CheckoutScreen component
import CheckoutScreen from "../payment/CheckoutScreen"; 
import ConfirmationScreen from "../payment/ConfirmationScreen"; 
import MessagesScreen from "../screens/MessagesScreen"; 

const Stack = createStackNavigator();

const BookingCalendar = ({ airplaneId, ownerId }) => {
  const auth = getAuth();
  const user = auth.currentUser;
  const stripe = useStripe();
  const navigation = useNavigation();

  // Modal Visibility States
  const [profileModalVisible, setProfileModalVisible] = useState(false);
  const [menuVisible, setMenuVisible] = useState(false);
  const [rentalCostEstimatorModalVisible, setRentalCostEstimatorModalVisible] = useState(false);
  const [messagesModalVisible, setMessagesModalVisible] = useState(false);
  const [transactionModalVisible, setTransactionModalVisible] = useState(false);
  const [notificationModalVisible, setNotificationModalVisible] = useState(false);
  const [allNotificationsModalVisible, setAllNotificationsModalVisible] = useState(false);

  // Profile States
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

  // Refresh Control
  const [refreshing, setRefreshing] = useState(false);

  // Consolidated Rentals State
  const [rentals, setRentals] = useState([]); // Holds both active and completed rentals
  const [ratings, setRatings] = useState({});

  // Rental Details States
  const [rentalDate, setRentalDate] = useState("");
  const [rentalHours, setRentalHours] = useState("");
  const [preferredLocation, setPreferredLocation] = useState("");
  const [costPerHour, setCostPerHour] = useState("");
  const [numHours, setNumHours] = useState("");
  const [costPerGallon, setCostPerGallon] = useState("");
  const [numGallons, setNumGallons] = useState("");

  // Notifications
  const [notifications, setNotifications] = useState([]);
  const [notificationCount, setNotificationCount] = useState(0);

  // Current Rental and Selected Notification
  const [currentRentalRequest, setCurrentRentalRequest] = useState(null);
  const [selectedNotification, setSelectedNotification] = useState(null);

  // Messaging States
  const [messages, setMessages] = useState([]);
  const [messageText, setMessageText] = useState("");

  // Processed Rentals to Avoid Duplicate Notifications
  const [processedRentals, setProcessedRentals] = useState([]);

  // Rentals Pagination States
  const [rentalsLastDoc, setRentalsLastDoc] = useState(null);
  const [hasMoreRentals, setHasMoreRentals] = useState(true);
  const RENTALS_PAGE_SIZE = 20;

  // Notifications Pagination States
  const [allNotifications, setAllNotifications] = useState([]);
  const [notificationsLastDoc, setNotificationsLastDoc] = useState(null);
  const [hasMoreNotifications, setHasMoreNotifications] = useState(true);
  const NOTIFICATIONS_PAGE_SIZE = 20;

  const renterId = user?.uid;

  // Date Picker Visibility
  const [isDatePickerVisible, setDatePickerVisibility] = useState(false);

  // Map Modal Visibility
  const [isMapModalVisible, setMapModalVisible] = useState(false);
  const [initialLocation, setInitialLocation] = useState(null);

  // State for Current Chat Owner in Messages Modal
  const [currentChatOwnerId, setCurrentChatOwnerId] = useState(null);

  // Fetch and Manage Data
  useEffect(() => {
    const db = getFirestore();

    if (!renterId) {
      console.error("Error: renterId is undefined.");
      Alert.alert("Error", "User is not authenticated.");
      return;
    }

    // References
    const rentalRequestsRef = collection(db, "renters", renterId, "rentalRequests");
    const ordersRef = collection(db, "orders");
    const notificationsRef = collection(db, "renters", renterId, "notifications");

    // Queries
    const rentalRequestsQuery = query(
      rentalRequestsRef,
      where("rentalStatus", "in", ["pending", "approved", "denied", "active"]),
      orderBy("createdAt", "desc"),
      limit(RENTALS_PAGE_SIZE)
    );

    const ordersQuery = query(
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

    const unsubscribeRentalRequests = onSnapshot(
      rentalRequestsQuery,
      async (snapshot) => {
        const active = [];
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

          active.push({
            id: docSnap.id,
            rentalStatus: requestData.rentalStatus,
            ...requestData,
            ownerName,
          });
        }

        // Fetch Completed Rentals
        const ordersSnapshot = await getDocs(ordersQuery);
        const completed = [];
        for (const docSnap of ordersSnapshot.docs) {
          const orderData = docSnap.data();
          let ownerName = "Unknown Owner";
          if (orderData.ownerId) {
            try {
              const ownerDocRef = doc(db, "owners", orderData.ownerId);
              const ownerDoc = await getDoc(ownerDocRef);
              if (ownerDoc.exists()) {
                ownerName = ownerDoc.data().fullName || "Unknown Owner";
              }
            } catch (error) {
              console.error("Error fetching owner details:", error);
            }
          }

          completed.push({
            id: docSnap.id,
            rentalStatus: "completed",
            ...orderData,
            ownerName,
          });
        }

        // Combine Active and Completed Rentals
        setRentals([...active, ...completed]);
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

        // Set the last document for pagination
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
  }, [renterId]);

  // Handle Approved Rentals by Creating Notifications
  useEffect(() => {
    const handleApprovedRentals = async () => {
      const db = getFirestore();
      for (const rental of rentals) {
        if (rental.rentalStatus === "active" && !processedRentals.includes(rental.id)) {
          const existingNotif = notifications.find(
            (notif) => notif.rentalRequestId === rental.id
          );
          if (!existingNotif) {
            try {
              await addDoc(collection(db, "renters", renterId, "notifications"), {
                rentalRequestId: rental.id,
                message:
                  "Your rental has been activated! Enjoy your flight.",
                type: "rentalActivated", // Notification type
                createdAt: serverTimestamp(),
              });
              console.log(`Added rentalActivated notification for rental ID: ${rental.id}`);
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

  // Navigate to Checkout Screen with Rental Request Details
  const navigateToCheckout = async (rentalRequest) => {
    if (!rentalRequest) {
      Alert.alert("Error", "No rental request selected.");
      return;
    }

    // Calculate Total Cost
    let totalCost =
      parseFloat(rentalRequest.totalCost) ||
      parseFloat(rentalRequest.rentalDetails?.totalCost) ||
      parseFloat(calculateRentalCost());

    if (isNaN(totalCost) || totalCost <= 0) {
      Alert.alert("Invalid Total Cost", "The total cost for this rental is invalid.");
      return;
    }

    const amountInCents = Math.round(totalCost * 100);

    console.log(`Creating payment intent for rental ID: ${rentalRequest.id} with amount: ${amountInCents} cents`);

    const clientSecret = await createPaymentIntent(amountInCents);

    if (clientSecret) {
      console.log("Payment intent created successfully. Navigating to CheckoutScreen.");
      // Close all modals before navigating
      setMessagesModalVisible(false);
      setTransactionModalVisible(false);
      setNotificationModalVisible(false);
      setAllNotificationsModalVisible(false);

      navigation.navigate("CheckoutScreen", {
        rentalRequestId: rentalRequest.id,
        amount: totalCost,
        clientSecret, 
      });
    } else {
      console.log("Failed to create payment intent.");
      Alert.alert("Payment Error", "Unable to proceed with payment.");
    }
  };

  // Create Payment Intent via Backend
  const createPaymentIntent = async (amount) => {
    if (isNaN(amount) || amount <= 0) {
      Alert.alert("Invalid Amount", "The payment amount is invalid.");
      return null;
    }

    try {
      console.log(`Creating payment intent for amount: ${amount} cents`);
      const response = await fetch(`${API_URL}/create-payment-intent`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ amount }), 
      });

      const data = await response.json();

      console.log("Payment Intent Response:", data);

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

  // Handle Notification Press
  const handleNotificationPress = async (notification) => {
    const db = getFirestore();
    try {
      if (!notification) {
        throw new Error("Notification object is undefined.");
      }

      if (notification.rentalRequestId) {
        const rentalRequestRef = doc(
          db,
          "renters",
          renterId,
          "rentalRequests",
          notification.rentalRequestId
        );

        const rentalRequestSnap = await getDoc(rentalRequestRef);

        if (rentalRequestSnap.exists()) {
          const rentalRequest = rentalRequestSnap.data();

          setCurrentRentalRequest({ id: rentalRequestSnap.id, ...rentalRequest });

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

          setSelectedNotification({
            ...notification,
            ownerName, 
          });
          // Modal will be opened via useEffect
        } else {
          throw new Error("Rental request not found.");
        }
      } else {
        // For notifications without rentalRequestId, still set the selectedNotification
        setSelectedNotification(notification);
        setCurrentRentalRequest(null); // No rental details available
        // Open the modal regardless of rentalRequestId
      }
    } catch (error) {
      console.error("Error handling notification press:", error);
      Alert.alert("Error", error.message);
    }
  };

  // Handle Rental Press (Active or Completed)
  const handleRentalPress = (rental) => {
    if (rental.rentalStatus === "active") {
      setCurrentRentalRequest(rental);
      // Removed setTransactionModalVisible(true) from here
    } else if (rental.rentalStatus === "completed") {
      // Handle actions for completed rentals, such as viewing details or providing feedback
      Alert.alert("Completed Rental", "This rental has been completed.");
      // You can add more functionalities as needed
    } else {
      Alert.alert("Rental Status", `This rental is currently ${rental.rentalStatus}.`);
    }
  };

  // Open Messages Modal with Chat Context
  const openMessagesModal = () => {
    setMessagesModalVisible(true);
  };

  // useEffect to Open Modal Once Selected Notification and Current Rental Request are Set
  useEffect(() => {
    if (selectedNotification) {
      if (selectedNotification.type === "rentalActivated") {
        if (currentRentalRequest) {
          setNotificationModalVisible(true);
        }
        // Else, wait for currentRentalRequest to be set
      } else {
        // For notifications without rentalRequestId or different types
        setNotificationModalVisible(true);
      }
    }
  }, [selectedNotification, currentRentalRequest]);

  // New useEffect to open Transaction Modal when currentRentalRequest is set
  useEffect(() => {
    if (currentRentalRequest) {
      setTransactionModalVisible(true);
    }
  }, [currentRentalRequest]);

  // Fetch More Rentals for Pagination
  const fetchMoreRentals = async () => {
    if (!hasMoreRentals) return;

    const db = getFirestore();

    try {
      const rentalRequestsRef = collection(db, "renters", renterId, "rentalRequests");
      const ordersRef = collection(db, "orders");

      // Define queries for rentalRequests and orders with pagination
      let rentalRequestsQueryInstance = query(
        rentalRequestsRef,
        where("rentalStatus", "in", ["pending", "approved", "denied", "active"]),
        orderBy("createdAt", "desc"),
        startAfter(rentalsLastDoc?.rentalRequestsLastDoc || 0),
        limit(RENTALS_PAGE_SIZE)
      );

      let ordersQueryInstance = query(
        ordersRef,
        where("renterId", "==", renterId),
        where("status", "==", "completed"),
        orderBy("completedAt", "desc"),
        startAfter(rentalsLastDoc?.ordersLastDoc || 0),
        limit(RENTALS_PAGE_SIZE)
      );

      // Fetch rentalRequests
      const rentalRequestsSnapshot = await getDocs(rentalRequestsQueryInstance);
      const fetchedActive = [];
      for (const docSnap of rentalRequestsSnapshot.docs) {
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

        fetchedActive.push({
          id: docSnap.id,
          rentalStatus: requestData.rentalStatus,
          ...requestData,
          ownerName,
        });
      }

      // Fetch completed rentals
      const ordersSnapshot = await getDocs(ordersQueryInstance);
      const fetchedCompleted = [];
      for (const docSnap of ordersSnapshot.docs) {
        const orderData = docSnap.data();
        let ownerName = "Unknown Owner";
        if (orderData.ownerId) {
          try {
            const ownerDocRef = doc(db, "owners", orderData.ownerId);
            const ownerDoc = await getDoc(ownerDocRef);
            if (ownerDoc.exists()) {
              ownerName = ownerDoc.data().fullName || "Unknown Owner";
            }
          } catch (error) {
            console.error("Error fetching owner details:", error);
          }
        }

        fetchedCompleted.push({
          id: docSnap.id,
          rentalStatus: "completed",
          ...orderData,
          ownerName,
        });
      }

      // Update the last document fetched for both rentalRequests and orders
      const newRentalsLastDoc = {
        rentalRequestsLastDoc:
          rentalRequestsSnapshot.docs[rentalRequestsSnapshot.docs.length - 1],
        ordersLastDoc: ordersSnapshot.docs[ordersSnapshot.docs.length - 1],
      };
      setRentalsLastDoc(newRentalsLastDoc);

      // Combine the new rentals with existing ones
      setRentals((prevRentals) => [
        ...prevRentals,
        ...fetchedActive,
        ...fetchedCompleted,
      ]);

      // Check if more rentals are available
      if (
        rentalRequestsSnapshot.docs.length < RENTALS_PAGE_SIZE &&
        ordersSnapshot.docs.length < RENTALS_PAGE_SIZE
      ) {
        setHasMoreRentals(false);
      }
    } catch (error) {
      console.error("Error fetching more rentals:", error);
      Alert.alert("Error", "Failed to fetch more rentals.");
    }
  };

  // Define fetchMoreNotifications Function
  const fetchMoreNotifications = async () => {
    if (!hasMoreNotifications) return;

    const db = getFirestore();
    const notificationsRef = collection(db, "renters", renterId, "notifications");

    try {
      const notificationsQueryInstance = query(
        notificationsRef,
        orderBy("createdAt", "desc"),
        startAfter(notificationsLastDoc || 0),
        limit(NOTIFICATIONS_PAGE_SIZE)
      );

      const notificationsSnapshot = await getDocs(notificationsQueryInstance);
      const fetchedNotifications = [];

      notificationsSnapshot.forEach((docSnap) => {
        fetchedNotifications.push({
          id: docSnap.id,
          ...docSnap.data(),
        });
      });

      // Update the last document fetched
      const lastVisible = notificationsSnapshot.docs[notificationsSnapshot.docs.length - 1];
      setNotificationsLastDoc(lastVisible);

      // Append new notifications to existing ones
      setAllNotifications((prevNotifications) => [
        ...prevNotifications,
        ...fetchedNotifications,
      ]);

      // Check if more notifications are available
      if (notificationsSnapshot.docs.length < NOTIFICATIONS_PAGE_SIZE) {
        setHasMoreNotifications(false);
      }
    } catch (error) {
      console.error("Error fetching more notifications:", error);
      Alert.alert("Error", "Failed to fetch more notifications.");
    }
  };

  // Initialize All Notifications from Notifications State
  useEffect(() => {
    setAllNotifications(notifications);
  }, [notifications]);

  // Cleanup Old Notifications to Maintain Performance
  const cleanupOldNotifications = async () => {
    const db = getFirestore();
    const notificationsRef = collection(db, "renters", renterId, "notifications");
    const q = query(
      notificationsRef,
      orderBy("createdAt", "desc"),
      limit(100) 
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
      console.log("Old notifications cleaned up successfully.");
    } catch (error) {
      console.error("Error cleaning up notifications:", error);
      Alert.alert("Error", "Failed to clean up notifications.");
    }
  };

  // Trigger Cleanup Whenever All Notifications Update
  useEffect(() => {
    cleanupOldNotifications();
  }, [allNotifications]);

  // Remove All Notifications Function
  const removeAllNotifications = async () => {
    const db = getFirestore();
    const notificationsRef = collection(db, "renters", renterId, "notifications");

    // Confirmation Alert
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
              const snapshot = await getDocs(notificationsRef);
              if (snapshot.empty) {
                Alert.alert("No Notifications", "There are no notifications to remove.");
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

  // Show Date Picker
  const showDatePicker = () => {
    setDatePickerVisibility(true);
  };

  // Hide Date Picker
  const hideDatePicker = () => {
    setDatePickerVisibility(false);
  };

  // Handle Date Selection
  const handleConfirm = (date) => {
    const formattedDate = `${date.getMonth() + 1}/${date.getDate()}/${date.getFullYear()}`;
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

    const db = getFirestore();
    try {
      await addDoc(collection(db, "messages"), {
        senderId: renterId,
        senderName: user.displayName || "User",
        receiverId: currentChatOwnerId,
        text: messageText.trim(),
        timestamp: serverTimestamp(),
        participants: [renterId, currentChatOwnerId],
        rentalRequestId: currentRentalRequest ? currentRentalRequest.id : null,
      });
      setMessageText("");
      // Optionally, provide feedback or reset states
    } catch (error) {
      console.error("Error sending message:", error);
      Alert.alert("Error", "Failed to send message.");
    }
  };

  // Toggle Messages Modal and Close Others
  const toggleMessagesModal = () => {
    setTransactionModalVisible(false);
    setNotificationModalVisible(false);
    setMessagesModalVisible(!messagesModalVisible);
  };

  // Profile Image Picker
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

  // Document Picker for Profile Documents
  const pickDocument = async (field) => {
    let result = await DocumentPicker.getDocumentAsync({
      type: ["application/pdf", "image/*"],
    });

    if (result.type !== "cancel") {
      setProfileData({ ...profileData, [field]: result.uri });
    }
  };

  // Handle Profile Submission
  const handleProfileSubmit = (values) => {
    setProfileData(values);
    setProfileSaved(true);
    setProfileModalVisible(false);
  };

  // Navigation Function
  const handleNavigation = (filter) => {
    try {
      navigation.navigate("Home", { filter });
    } catch (error) {
      console.error("Navigation error:", error);
      Alert.alert("Error", "Failed to navigate to the home screen.");
    }
  };

  // Calculate Rental Cost
  const calculateRentalCost = () => {
    const hours = parseFloat(rentalHours) || 0;
    const hourlyCost = parseFloat(costPerHour) || 200; 
    const bookingFee = hourlyCost * hours * 0.06;
    const processingFee = hourlyCost * hours * 0.03;
    const tax = hourlyCost * hours * 0.0825;
    const totalCost = hourlyCost * hours + bookingFee + processingFee + tax;

    return totalCost.toFixed(2);
  };

  // Get Current Location for Map Modal (Optional)
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
  };

  // Handle Rating Submission
  const handleRating = async (rentalId, rating) => {
    const db = getFirestore();
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

  // Fetch Messages When currentChatOwnerId Changes
  useEffect(() => {
    if (currentChatOwnerId) {
      const db = getFirestore();
      const messagesRef = collection(db, "messages");
      const messagesQueryInstance = query(
        messagesRef,
        where("participants", "array-contains", renterId),
        where("participants", "array-contains", currentChatOwnerId),
        orderBy("timestamp", "asc")
      );

      const unsubscribe = onSnapshot(
        messagesQueryInstance,
        (snapshot) => {
          const fetchedMessages = [];
          snapshot.forEach((docSnap) => {
            fetchedMessages.push(docSnap.data());
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
      setMessages([]); // Clear messages if no owner is selected
    }
  }, [currentChatOwnerId]);

  // Render Component
  return (
    <View style={{ flex: 1, backgroundColor: "white" }}>
      <SafeAreaView style={{ backgroundColor: "white" }}>
        <StatusBar hidden={true} />
      </SafeAreaView>

      <ScrollView
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => { /* Implement refresh logic if needed */ }} />
        }
        contentContainerStyle={{ paddingBottom: 16 }}
      >
        {/* Header with Image Background */}
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
                onChangeText={setRentalHours}
                value={rentalHours}
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

        {/* Active Rentals */}
        <View style={{ paddingHorizontal: 16, paddingTop: 24 }}>
          <Text style={{ fontSize: 18, fontWeight: "bold", marginBottom: 16 }}>
            Active Rentals
          </Text>
          {rentals.length > 0 ? (
            <>
              <FlatList
                data={rentals}
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
                    <Text>
                      Status: {item.rentalStatus.charAt(0).toUpperCase() + item.rentalStatus.slice(1)}
                    </Text>
                  </TouchableOpacity>
                )}
                ListFooterComponent={
                  hasMoreRentals ? (
                    <ActivityIndicator size="large" color="#3182ce" style={{ marginVertical: 16 }} />
                  ) : (
                    <Text style={{ textAlign: "center", color: "#4a5568", marginVertical: 16 }}>
                      No more rentals to load.
                    </Text>
                  )
                }
                onEndReached={fetchMoreRentals}
                onEndReachedThreshold={0.5}
                scrollEnabled={false} // Disable scrolling for nested FlatList
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
                >
                  <Text style={{ color: "white", fontWeight: "bold" }}>Load More</Text>
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
          <Text style={{ fontSize: 18, fontWeight: "bold", marginBottom: 16 }}>
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
              scrollEnabled={false} // Disable scrolling for nested FlatList
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
                backgroundColor: "#e53e3e", // Red color to indicate deletion
                borderRadius: 8,
                marginTop: 8,
              }}
            >
              <Text style={{ color: "white", fontWeight: "bold" }}>Remove All</Text>
            </TouchableOpacity>
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
      </ScrollView>

      {/* Profile Information */}
      {profileSaved ? (
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
      ) : (
        <View style={styles.profileContainer}>
          <Text style={styles.profileTitle}>No Profile Information Available</Text>
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
              >
                <Ionicons name="close-circle" size={32} color="#2d3748" />
              </TouchableOpacity>

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
                  scrollEnabled={false} // Disable scrolling for nested FlatList
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

      {/* Transaction Modal */}
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
                <ScrollView contentContainerStyle={{ padding: 16 }}>
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
                      Pricing Details:
                    </Text>
                    <Text style={{ color: "#4a5568" }}>
                      Cost per Hour: ${currentRentalRequest.costPerHour || costPerHour}
                    </Text>
                    <Text style={{ color: "#4a5568" }}>
                      Number of Hours: {currentRentalRequest.rentalHours || rentalHours}
                    </Text>
                    <Text style={{ color: "#4a5568" }}>
                      Total Cost: ${currentRentalRequest.totalCost || calculateRentalCost()}
                    </Text>
                  </View>

                  {/* Proceed to Pay Button (Only Visible When rentalRequest Exists) */}
                  {currentRentalRequest && (
                    <TouchableOpacity
                      onPress={() => navigateToCheckout(currentRentalRequest)} 
                      style={styles.paymentButton}
                    >
                      <Text style={styles.paymentButtonText}>Proceed to Pay</Text>
                    </TouchableOpacity>
                  )}

                  {/* Message Owner Button */}
                  <TouchableOpacity
                    onPress={() => {
                      if (currentRentalRequest?.ownerId) {
                        setCurrentChatOwnerId(currentRentalRequest.ownerId);
                        setMessagesModalVisible(true);
                      } else {
                        Alert.alert("Error", "No owner available to message.");
                      }
                    }}
                    style={styles.messageOwnerButton}
                  >
                    <Text style={styles.messageOwnerButtonText}>Message Owner</Text>
                  </TouchableOpacity>
                </ScrollView>
              ) : (
                <Text style={{ textAlign: "center", color: "#718096" }}>
                  No rental request available for payment.
                </Text>
              )}
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Notification Modal */}
      <Modal
        visible={notificationModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => {
          setNotificationModalVisible(false);
          setSelectedNotification(null); // Reset selectedNotification when modal is closed
        }}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={{ flex: 1 }}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.notificationModalContainer}>
              <TouchableOpacity
                onPress={() => {
                  setNotificationModalVisible(false);
                  setSelectedNotification(null); // Reset selectedNotification when modal is closed
                }}
                style={styles.closeModalButton}
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
                          ? selectedNotification.createdAt.toDate().toLocaleString()
                          : new Date(selectedNotification.createdAt).toLocaleString()
                        : "N/A"}
                    </Text>
                  </View>

                  {/* Additional Rental Details if Available */}
                  {selectedNotification.rentalRequestId && currentRentalRequest && (
                    <>
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
                          Pricing Details:
                        </Text>
                        <Text style={{ color: "#4a5568" }}>
                          Cost per Hour: ${currentRentalRequest.costPerHour || costPerHour}
                        </Text>
                        <Text style={{ color: "#4a5568" }}>
                          Number of Hours: {currentRentalRequest.rentalHours || rentalHours}
                        </Text>
                        <Text style={{ color: "#4a5568" }}>
                          Total Cost: ${currentRentalRequest.totalCost || calculateRentalCost()}
                        </Text>
                      </View>
                    </>
                  )}

                  {/* Proceed to Pay Button (Only Visible When rentalRequest Exists) */}
                  {currentRentalRequest && (
                    <TouchableOpacity
                      onPress={() => navigateToCheckout(currentRentalRequest)} 
                      style={styles.paymentButton}
                    >
                      <Text style={styles.paymentButtonText}>Proceed to Pay</Text>
                    </TouchableOpacity>
                  )}

                  {/* Message Owner Button */}
                  <TouchableOpacity
                    onPress={() => {
                      if (currentRentalRequest?.ownerId) {
                        setCurrentChatOwnerId(currentRentalRequest.ownerId);
                        setMessagesModalVisible(true);
                      } else {
                        Alert.alert("Error", "No owner available to message.");
                      }
                    }}
                    style={styles.messageOwnerButton}
                  >
                    <Text style={styles.messageOwnerButtonText}>Message Owner</Text>
                  </TouchableOpacity>

                  {/* Close Button for All Notifications */}
                  <TouchableOpacity
                    onPress={() => {
                      setNotificationModalVisible(false);
                      setSelectedNotification(null); // Reset selectedNotification when modal is closed
                    }}
                    style={styles.closeButton}
                  >
                    <Text style={styles.closeButtonText}>Close</Text>
                  </TouchableOpacity>
                </ScrollView>
              ) : (
                <ActivityIndicator size="large" color="#3182ce" />
              )}
            </View>
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
                  scrollEnabled={false} // Disable scrolling for nested FlatList
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
      >
        <Ionicons name="chatbubble-ellipses" size={32} color="white" />
      </TouchableOpacity>
    </View>
  );
};

const BookingNavigator = () => {
  return (
    <NavigationContainer independent={true}>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="BookingCalendar" component={BookingCalendar} />
        <Stack.Screen name="CheckoutScreen" component={CheckoutScreen} />
        <Stack.Screen name="ConfirmationScreen" component={ConfirmationScreen} />
        <Stack.Screen name="Messages" component={MessagesScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
};

const styles = StyleSheet.create({
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
    justifyContent: "center",
    alignItems: "center",
  },
  messageModalContainer: {
    width: "90%",
    height: "80%",
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
  notificationModalContainer: {
    width: "100%",
    height: "100%",
    backgroundColor: "white",
    borderRadius: 0,
    padding: 24,
    position: "relative",
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
  messageOwnerButton: { // New Style for "Message Owner" Button
    backgroundColor: "#38a169", // Green color to indicate action
    padding: 16,
    borderRadius: 8,
    alignItems: "center",
    marginTop: 16,
  },
  messageOwnerButtonText: {
    color: "white",
    fontWeight: "bold",
  },
});

export default BookingNavigator;
