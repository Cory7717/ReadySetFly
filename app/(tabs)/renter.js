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

import { getAuth } from "firebase/auth";

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

import { API_URL } from "@env";

import CheckoutScreen from "../payment/CheckoutScreen";
import ConfirmationScreen from "../payment/ConfirmationScreen";
import MessagesScreen from "../screens/MessagesScreen";

const db = getFirestore();
const auth = getAuth();
const user = auth.currentUser;

const Stack = createNativeStackNavigator();

const BookingCalendar = () => {
  const stripe = useStripe();
  const navigation = useNavigation();

  const [profileModalVisible, setProfileModalVisible] = useState(false);
  const [menuVisible, setMenuVisible] = useState(false);
  const [
    rentalCostEstimatorModalVisible,
    setRentalCostEstimatorModalVisible,
  ] = useState(false);
  const [messagesModalVisible, setMessagesModalVisible] = useState(false);
  const [notificationModalVisible, setNotificationModalVisible] = useState(false);
  const [
    allNotificationsModalVisible,
    setAllNotificationsModalVisible,
  ] = useState(false);

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
  const [totalCost, setTotalCost] = useState(null);

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

  const renterId = user?.uid;

  const [isDatePickerVisible, setDatePickerVisibility] = useState(false);

  const [isMapModalVisible, setMapModalVisible] = useState(false);
  const [initialLocation, setInitialLocation] = useState(null);

  const [currentChatOwnerId, setCurrentChatOwnerId] = useState(null);

  useEffect(() => {
    if (!renterId) {
      console.error("Error: renterId is undefined.");
      Alert.alert("Error", "User is not authenticated.");
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

    const unsubscribeRentalRequests = onSnapshot(
      rentalRequestsQueryInstance,
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

        const ordersSnapshot = await getDocs(ordersQueryInstance);
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

  useEffect(() => {
    const handleApprovedRentals = async () => {
      for (const rental of rentals) {
        if (
          (rental.rentalStatus === "active" || rental.rentalStatus === "approved") &&
          !processedRentals.includes(rental.id)
        ) {
          const existingNotif = notifications.find(
            (notif) => notif.rentalRequestId === rental.id
          );
          if (!existingNotif) {
            try {
              // Ensure that listingId is fetched from rental request if missing
              let listingId = rental.listingId;
              if (!listingId) {
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
                  listingId = rentalRequestData.listingId || null;
                }
              }

              await addDoc(
                collection(db, "renters", renterId, "notifications"),
                {
                  rentalRequestId: rental.id,
                  message:
                    "Your rental has been approved! Proceed to payment.",
                  type: "rentalApproved",
                  listingId: listingId, // Ensure listingId is included
                  ownerId: rental.ownerId || null,
                  ownerName: rental.ownerName || "Unknown Owner",
                  rentalDate: rental.rentalDate || null,
                  createdAt: serverTimestamp(),
                  rentalStatus: rental.rentalStatus || "approved",
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

  // Function to create a rental request with listingId
  const createRentalRequest = async (listingId) => {
    if (!renterId) {
      Alert.alert("Error", "User is not authenticated.");
      return;
    }

    if (!listingId) {
      Alert.alert("Error", "Invalid Listing ID.");
      return;
    }

    try {
      const rentalRequestRef = collection(
        db,
        "renters",
        renterId,
        "rentalRequests"
      );

      await addDoc(rentalRequestRef, {
        listingId: listingId,
        rentalDate: rentalDate || new Date().toLocaleDateString(),
        rentalHours: rentalHours || "0",
        rentalStatus: "pending",
        ownerId: null, // You can set the ownerId if available
        createdAt: serverTimestamp(),
      });

      Alert.alert("Success", "Rental request created successfully.");
    } catch (error) {
      console.error("Error creating rental request:", error);
      Alert.alert("Error", "Failed to create rental request.");
    }
  };

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

      const totalCostFromRequest = parseFloat(rentalRequest.totalCost);

      const calculatedTotalCost = totalCostFromRequest.toFixed(2);

      console.log(`Calculated Total Cost: ${calculatedTotalCost}`);

      if (isNaN(calculatedTotalCost) || calculatedTotalCost <= 0) {
        Alert.alert(
          "Invalid Total Cost",
          "The total cost for this rental is invalid."
        );
        return;
      }

      const amountInCents = Math.round(calculatedTotalCost * 100);

      console.log(
        `Creating payment intent for rental ID: ${rentalRequestSnap.id} with amount: ${amountInCents} cents`
      );

      const clientSecret = await createPaymentIntent(amountInCents);

      if (clientSecret) {
        console.log(
          "Payment intent created successfully. Navigating to CheckoutScreen."
        );
        setNotificationModalVisible(false);
        setAllNotificationsModalVisible(false);

        navigation.navigate("CheckoutScreen", {
          rentalRequestId: rentalRequestSnap.id,
          amount: calculatedTotalCost,
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
        Alert.alert(
          "Payment Error",
          data.message || "Failed to create payment intent."
        );
        return null;
      }
    } catch (error) {
      console.error("Error creating payment intent:", error);
      Alert.alert("Payment Error", "An unexpected error occurred.");
      return null;
    }
  };

  const handleNotificationPress = async (notification) => {
    try {
      if (!notification) {
        throw new Error("Notification object is undefined.");
      }

      if (notification.rentalRequestId) {
        console.log(
          "Notification has rentalRequestId:",
          notification.rentalRequestId
        );

        setIsRentalRequestLoading(true);

        const rentalRequestRef = doc(
          db,
          "renters",
          renterId,
          "rentalRequests",
          notification.rentalRequestId
        );
        const rentalRequestSnap = await getDoc(rentalRequestRef);
        let rentalRequestData = null;
        if (rentalRequestSnap.exists()) {
          rentalRequestData = rentalRequestSnap.data();
          setSelectedRentalRequest(rentalRequestData);
          console.log("Fetched Rental Request:", rentalRequestData);
        } else {
          setSelectedRentalRequest(null);
          console.warn(
            "Rental request not found for ID:",
            notification.rentalRequestId
          );
          setTotalCost(null);
          setIsRentalRequestLoading(false);
          return;
        }

        let listingData = null;
        if (rentalRequestData.listingId) {
          const listingRef = doc(db, "airplanes", rentalRequestData.listingId);
          const listingSnap = await getDoc(listingRef);
          if (listingSnap.exists()) {
            listingData = listingSnap.data();
            setSelectedListing(listingData);
            console.log("Fetched Listing:", listingData);
          } else {
            setSelectedListing(null);
            setTotalCost(null);
            console.warn(
              "Listing not found for ID:",
              rentalRequestData.listingId
            );
            setIsRentalRequestLoading(false);
            return;
          }
        } else {
          setSelectedListing(null);
          setTotalCost(null);
          console.warn("Listing ID is missing in the rental request.");
          setIsRentalRequestLoading(false);
          return;
        }

        if (rentalRequestData.totalCost !== undefined) {
          setTotalCost(rentalRequestData.totalCost);
        } else {
          const rentalHours = parseFloat(rentalRequestData.rentalHours) || 0;
          const costPerHour = parseFloat(listingData.costPerHour) || 0;
          const calculatedTotalCost = (rentalHours * costPerHour).toFixed(2);

          console.log(`Calculated Total Cost: ${calculatedTotalCost}`);

          setTotalCost(calculatedTotalCost);
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
    }
  };

  const closeModal = () => {
    setNotificationModalVisible(false);
    setSelectedNotification(null);
    setSelectedRentalRequest(null);
    setSelectedListing(null);
    setTotalCost(null);
  };

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

  const showDatePicker = () => {
    setDatePickerVisibility(true);
  };

  const hideDatePicker = () => {
    setDatePickerVisibility(false);
  };

  const handleConfirm = (date) => {
    const formattedDate = `${date.getMonth() + 1}/${date.getDate()}/${date.getFullYear()}`;
    setRentalDate(formattedDate);
    hideDatePicker();
  };

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
      await addDoc(collection(db, "messages"), {
        senderId: renterId,
        senderName: user.displayName || "User",
        receiverId: currentChatOwnerId,
        text: messageText.trim(),
        timestamp: serverTimestamp(),
        participants: [renterId, currentChatOwnerId],
        rentalRequestId: selectedNotification?.rentalRequestId || null,
      });
      setMessageText("");
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

  const handleProfileSubmit = (values) => {
    setProfileData(values);
    setProfileSaved(true);
    setProfileModalVisible(false);
  };

  const handleNavigation = (filter) => {
    try {
      navigation.navigate("Home", { filter });
    } catch (error) {
      console.error("Navigation error:", error);
      Alert.alert("Error", "Failed to navigate to the home screen.");
    }
  };

  const calculateRentalCost = () => {
    const hours = parseFloat(rentalHours) || 0;
    const hourlyCost = parseFloat(costPerHour) || 200;
    const bookingFee = hourlyCost * hours * 0.06;
    const processingFee = hourlyCost * hours * 0.03;
    const tax = hourlyCost * hours * 0.0825;
    const totalCost =
      hourlyCost * hours + bookingFee + processingFee + tax;

    return totalCost.toFixed(2);
  };

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

  const handleRentalPress = (rental) => {
    Alert.alert(
      "Rental Pressed",
      `You pressed on rental: ${rental.aircraftModel || "N/A"}`
    );
  };

  const fetchMoreRentals = async () => {
    if (!hasMoreRentals) return;

    try {
      let rentalRequestsQueryInstance = query(
        collection(db, "renters", renterId, "rentalRequests"),
        where("rentalStatus", "in", ["pending", "approved", "active", "denied"]),
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
            }
          } catch (error) {
            console.error("Error fetching owner details:", error);
          }
        }

        newRentals.push({
          id: docSnap.id,
          rentalStatus: requestData.rentalStatus,
          ...requestData,
          ownerName,
        });
      }

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

      setRentals([...rentals, ...newRentals, ...completed]);

      const lastVisible = snapshot.docs[snapshot.docs.length - 1];
      setRentalsLastDoc(lastVisible);
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

      <ScrollView
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {}}
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
                onChangeText={(text) => setRentalHours(text.replace(/[^0-9.]/g, ""))}
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

            {/* Sample Button to Save Selected Aircraft ID */}
            {/* Replace this with your actual implementation */}
            <TouchableOpacity
              onPress={() => {
                saveSelectedAircraftIds("1Dj9eQwMcRWWXqtcGHNKEctgjW62");
                createRentalRequest("1Dj9eQwMcRWWXqtcGHNKEctgjW62"); // Create rental request with listingId
              }}
              style={{
                backgroundColor: "#48bb78",
                padding: 12,
                borderRadius: 8,
                marginTop: 16,
                alignItems: "center",
              }}
            >
              <Text style={{ color: "white", fontWeight: "bold" }}>
                Select This Aircraft
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
                      Rental Period: {item.rentalDate || "N/A"}
                    </Text>
                    <Text style={{ color: "#4a5568" }}>
                      Total Cost: ${item.totalCost || "N/A"}
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
            >
              <Text style={{ color: "white", fontWeight: "bold" }}>
                View All
              </Text>
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
            <Image source={{ uri: profileData.image }} style={styles.profileImage} />
          )}
        </View>
      ) : (
        <View style={styles.profileContainer}>
          <Text style={styles.profileTitle}>
            No Profile Information Available
          </Text>
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
                />
                <TouchableOpacity onPress={sendMessage} style={styles.sendButton}>
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
        transparent={true}
        onRequestClose={closeModal}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={{ flex: 1 }}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.notificationModalContainer}>
              <TouchableOpacity
                onPress={closeModal}
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
                          ? selectedNotification.createdAt
                              .toDate()
                              .toLocaleString()
                          : new Date(selectedNotification.createdAt).toLocaleString()
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
                        Total Cost: ${totalCost !== null ? totalCost : "N/A"}
                      </Text>
                    </View>
                  )}

                  {/* Proceed to Pay Button */}
                  {selectedNotification.rentalStatus !== "denied" && totalCost && (
                    <TouchableOpacity
                      onPress={() =>
                        navigateToCheckout(selectedNotification.rentalRequestId)
                      }
                      style={styles.paymentButton}
                    >
                      <Text style={styles.paymentButtonText}>Proceed to Pay</Text>
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
        <Stack.Screen
          name="ConfirmationScreen"
          component={ConfirmationScreen}
        />
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
  messageOwnerButton: {
    backgroundColor: "#38a169",
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
