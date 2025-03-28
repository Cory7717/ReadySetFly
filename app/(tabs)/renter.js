import React, { useState, useEffect, useRef, useCallback } from "react"; // Added useCallback
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
  Linking,
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
  deleteDoc,
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

import { useRouter, useLocalSearchParams, useNavigation } from "expo-router"; // Added useNavigation

import ConfirmationScreen from "../payment/ConfirmationScreen";
import MessagesScreen from "../screens/MessagesScreen";

import * as Notifications from "expo-notifications";

const API_URL = "https://us-central1-ready-set-fly-71506.cloudfunctions.net/api";

import { db, auth } from "../../firebaseConfig";

// -----------------------------------------------------------------------------
// Move safeToFixed to a top-level function declaration so it is hoisted and
// available to render functions (e.g., renderRentalItem)
// -----------------------------------------------------------------------------
function safeToFixed(value, decimals = 2) {
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
}

// --- ModalHeader Component (identical to owner.js) ---
const ModalHeader = ({ title, onClose }) => (
  <View
    style={{
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 16,
    }}
  >
    <Text style={{ fontSize: 20, fontWeight: "bold" }}>{title}</Text>
    <TouchableOpacity
      onPress={onClose}
      style={{ padding: 8 }}
      accessibilityLabel="Close modal"
      accessibilityRole="button"
    >
      <Ionicons name="close" size={24} color="#2d3748" />
    </TouchableOpacity>
  </View>
);

// --- CustomButton Component ---
const CustomButton = ({ onPress, title, backgroundColor }) => (
  <TouchableOpacity
    onPress={onPress}
    style={{
      backgroundColor: backgroundColor || "#3182ce",
      padding: 16,
      borderRadius: 8,
      alignItems: "center",
      marginTop: 16,
    }}
  >
    <Text style={{ color: "#fff", fontSize: 16, fontWeight: "bold" }}>
      {title}
    </Text>
  </TouchableOpacity>
);

// ---- START OF RENTER COMPONENT ----
const renter = () => {
  const router = useRouter();
  const params = useLocalSearchParams(); // Access search params (e.g., autoOpenChat)
  const navigation = useNavigation(); // Get navigation object

  // New state to track if the payment flow has already been handled (Original)
  // NOTE: This specific flag `paymentHandled` is less useful with the new flow,
  // but kept as per the request to keep other logic the same.
  // The new `processingPaymentSuccess` state manages the immediate post-payment action.
  const [paymentHandled, setPaymentHandled] = useState(false);

  // *** NEW STATE FOR POST-PAYMENT FLOW ***
  const [processingPaymentSuccess, setProcessingPaymentSuccess] = useState(null);

  // Request notification permissions on component mount (Original)
  useEffect(() => {
    (async () => {
      const { status } = await Notifications.requestPermissionsAsync();
      if (status !== "granted") {
        Alert.alert(
          "Permission required",
          "Push notifications need permission to be enabled."
        );
      }
    })();
  }, []);

  // -------------------------
  // State Variables (Original, plus new processingPaymentSuccess)
  // -------------------------
  const [profileModalVisible, setProfileModalVisible] = useState(false);
  const [menuVisible, setMenuVisible] = useState(false);
  const [rentalCostEstimatorModalVisible, setRentalCostEstimatorModalVisible] = useState(false);
  const [messagesModalVisible, setMessagesModalVisible] = useState(false);
  const [notificationModalVisible, setNotificationModalVisible] = useState(false);
  const [allNotificationsModalVisible, setAllNotificationsModalVisible] = useState(false);
  const [faqModalVisible, setFaqModalVisible] = useState(false);
  const [investModalVisible, setInvestModalVisible] = useState(false);
  const [privacyModalVisible, setPrivacyModalVisible] = useState(false);
  const [profileData, setProfileData] = useState({
    firstName: "",
    lastName: "",
    insurance: null,
    pilotLicense: null,
    medical: null,
    aircraftType: "",
    certifications: "",
    image: null,
    profileType: "renter",
  });
  const [profileSaved, setProfileSaved] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [rentals, setRentals] = useState([]);
  const [pastRentals, setPastRentals] = useState([]);
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
  const [paymentComplete, setPaymentComplete] = useState(false);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [activeRentalModalVisible, setActiveRentalModalVisible] = useState(false);
  const processedRentalsRef = useRef([]);
  const rentalRequestListenerRef = useRef(null);
  const [favoritesListings, setFavoritesListings] = useState([]);

  // --- Helper Functions ---

  // *** NEW: Added fetchListingDetails function definition ***
  const fetchListingDetails = async (listingId) => {
      try {
          if (!listingId) {
              console.warn(`WorkspaceListingDetails called with missing listingId.`);
              return null;
          }
          const listingDocRef = doc(db, "airplanes", listingId);
          const listingDoc = await getDoc(listingDocRef);
          if (listingDoc.exists()) {
              const listingData = listingDoc.data();
              // Basic validation: Ensure ownerId exists
              if (!listingData.ownerId) {
                  console.warn(`Listing ID: ${listingId} is missing 'ownerId'. Cannot process.`);
                  return null; 
              }
              return listingData;
          } else {
              console.warn(`No listing found for listingId: ${listingId}`);
              return null;
          }
      } catch (error) {
          console.error("Error fetching listing details in renter.js:", error);
          return null; 
      }
  };

  // *** NEW: Added closeAllOpenModals function definition ***
  const closeAllOpenModals = () => {
      setNotificationModalVisible(false);
      setAllNotificationsModalVisible(false);
      setProfileModalVisible(false);
      setFaqModalVisible(false);
      setInvestModalVisible(false);
      setPrivacyModalVisible(false);
      setActiveRentalModalVisible(false); // Ensure active rental modal is closed too
      setMessagesModalVisible(false); // Ensure messages modal is closed
      // Reset related states if needed
      setSelectedNotification(null);
      setSelectedRentalRequest(null);
      setSelectedListing(null);
  };

  // (Original calculateTotalCost function - unchanged)
  const calculateTotalCost = (rentalCostPerHour, rentalHours) => {
    if (isNaN(rentalCostPerHour) || isNaN(rentalHours) || rentalHours <= 0) {
        console.warn("Invalid input for calculateTotalCost", rentalCostPerHour, rentalHours);
        return { rentalCost: "0.00", bookingFee: "0.00", transactionFee: "0.00", salesTax: "0.00", total: "0.00" };
    }
    const rentalTotalCost = rentalCostPerHour * rentalHours;
    const bookingFee = rentalTotalCost * 0.06;
    const transactionFee = rentalTotalCost * 0.03;
    const salesTax = rentalTotalCost * 0.0825; // Tax calculated on base rental cost
    const total = rentalTotalCost + bookingFee + transactionFee + salesTax;
    return {
      rentalCost: rentalTotalCost.toFixed(2),
      bookingFee: bookingFee.toFixed(2),
      transactionFee: transactionFee.toFixed(2),
      salesTax: salesTax.toFixed(2),
      total: total.toFixed(2),
    };
  };

  // -------------------------
  // Auth and Firestore Setup (Original - unchanged)
  // -------------------------
  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setRenter(user);
        // Original logic used 'renters' collection - kept as is, but 'users' might be intended target now
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
      }
      setIsAuthChecked(true);
    });
    return () => unsubscribeAuth();
  }, []);

  const renterId = renter?.uid;

  // -------------------------
  // *** NEW: useEffect to Handle Post-Payment Navigation ***
  // -------------------------
  useEffect(() => {
      if (params?.paymentSuccessFor && params.paymentSuccessFor !== processingPaymentSuccess) {
          const rentalId = params.paymentSuccessFor;
          const ownerIdForChat = params.ownerId;

          console.log(`Handling payment success for rental: ${rentalId}`);
          setProcessingPaymentSuccess(rentalId); 

          Alert.alert("Payment Successful!", "Your rental is now active.");

          closeAllOpenModals(); 

          const checkRentalActive = () => {
              const updatedRental = rentals.find(r => r.id === rentalId && r.rentalStatus === 'active');
              
              if (updatedRental) {
                  console.log("Found updated active rental:", updatedRental);
                  
                  fetchListingDetails(updatedRental.listingId).then(listingData => {
                      if (listingData) {
                          setSelectedRentalRequest(updatedRental);
                          setSelectedListing(listingData);
                          
                          const costDetails = calculateTotalCost(parseFloat(listingData.costPerHour), parseFloat(updatedRental.rentalHours));
                          setTotalCost(costDetails);

                          setCurrentChatOwnerId(ownerIdForChat); 
                          
                          setActiveRentalModalVisible(true); 

                      } else {
                          Alert.alert("Error", "Could not load listing details for the active rental. Chat is available.");
                          setCurrentChatOwnerId(ownerIdForChat);
                      }
                  }).catch(err => {
                      console.error("Error fetching listing details post-payment:", err);
                      Alert.alert("Error", "Failed to fetch listing details. Chat is available.");
                      setCurrentChatOwnerId(ownerIdForChat);
                  });

              } else {
                  console.warn(`Rental ${rentalId} not found in 'active' state immediately after payment.`);
                  Alert.alert("Processing", "Rental details are updating. You can access chat shortly via the main screen.");
                  setCurrentChatOwnerId(ownerIdForChat); 
              }
          };

          setTimeout(checkRentalActive, 1000); // Delay to allow Firestore to update rental status

          navigation.setParams({ paymentSuccessFor: null, ownerId: null }); 
      }

       return () => {
           if (navigation.isFocused() && params?.paymentSuccessFor !== processingPaymentSuccess) {
               setProcessingPaymentSuccess(null);
           }
       };

  }, [params, rentals, navigation, processingPaymentSuccess]);

  // -------------------------
  // Fetch Profile on Mount (Original - unchanged, reads from 'users')
  // -------------------------
  useEffect(() => {
    if (renterId && !profileData.firstName) {
      (async () => {
        try {
          const profileDocRef = doc(db, "users", renterId); // Reads from 'users'
          const profileDocSnap = await getDoc(profileDocRef);
          if (profileDocSnap.exists()) {
            const data = profileDocSnap.data();
            setProfileData((prev) => ({
              ...prev,
              firstName: data.firstName || "",
              lastName: data.lastName || "",
              insurance: data.insurance || null,
              pilotLicense: data.pilotLicense || null,
              medical: data.medical || null,
              aircraftType: data.aircraftType || "",
              certifications: data.certifications || "",
              image: data.image || null,
              profileType: data.profileType || "renter",
            }));
          }
        } catch (error) {
          console.error("Error fetching profile on mount", error);
        }
      })();
    }
  }, [renterId]);

  // -------------------------
  // Data Migration (Original - unchanged)
  // -------------------------
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

        rentalRequestsSnapshot.docs.forEach((docSnap) => {
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

  // -------------------------
  // Listen for Rental Request Status Changes for Notifications (Original - unchanged)
  // -------------------------
  useEffect(() => {
    if (!renterId) return;
    const rentalRequestsRef = collection(db, "rentalRequests");
    const statusQuery = query(
      rentalRequestsRef,
      where("renterId", "==", renterId),
      where("rentalStatus", "in", ["approved", "denied"])
    );

    const unsubscribeStatus = onSnapshot(
      statusQuery,
      (snapshot) => {
        snapshot.docs.forEach(async (docSnap) => {
          const data = docSnap.data();
          if (!data.notified) {
            const title =
              data.rentalStatus === "approved" ? "Rental Approved" : "Rental Denied";
            const body =
              data.rentalStatus === "approved"
                ? "Your rental request has been approved."
                : "Your rental request has been denied.";

            try {
              await Notifications.scheduleNotificationAsync({
                content: { title, body },
                trigger: null,
              });

              await updateDoc(docSnap.ref, { notified: true });
            } catch (error) {
              console.error("Error sending notification:", error);
            }
          }
        });
      },
      (error) => {
        console.error("Error listening for rental status changes:", error);
      }
    );

    return () => unsubscribeStatus();
  }, [renterId]);

  // -------------------------
  // Centralized Cleanup of Approval Notifications for Active Rentals (Original - unchanged)
  // -------------------------
  useEffect(() => {
    if (!renterId) return;
    const rentalRequestsRef = collection(db, "rentalRequests");
    const activeQuery = query(
      rentalRequestsRef,
      where("renterId", "==", renterId),
      where("rentalStatus", "==", "active")
    );

    const unsubscribeActive = onSnapshot(
      activeQuery,
      async (snapshot) => {
        for (const docSnap of snapshot.docs) {
          const rentalId = docSnap.id;
          try {
            const notificationsRef = collection(db, "renters", renterId, "notifications");
            const notifQuery = query(notificationsRef, where("rentalRequestId", "==", rentalId));
            const notifSnapshot = await getDocs(notifQuery);

            notifSnapshot.docs.forEach(async (notifDoc) => {
              await deleteDoc(notifDoc.ref);
            });

            // Update local state
            setNotifications((prev) => prev.filter((n) => n.rentalRequestId !== rentalId));
            setAllNotifications((prev) => prev.filter((n) => n.rentalRequestId !== rentalId));
          } catch (error) {
            console.error("Error cleaning up notifications for active rental:", error);
          }
        }
      },
      (error) => {
        console.error("Error listening for active rental requests:", error);
      }
    );

    return () => unsubscribeActive();
  }, [renterId]);

  // -------------------------
  // Fetch Past Rentals (Original - unchanged)
  // -------------------------
  useEffect(() => {
    if (!isAuthChecked || !renterId) return;

    const pastRentalsRef = collection(db, "rentalRequests");
    const pastRentalsQuery = query(
      pastRentalsRef,
      where("renterId", "==", renterId),
      where("rentalStatus", "==", "completed"),
      orderBy("createdAt", "desc")
    );

    const unsubscribePastRentals = onSnapshot(
      pastRentalsQuery,
      (snapshot) => {
        const fetchListings = async () => {
          const past = await Promise.all(
            snapshot.docs.map(async (docSnap) => {
              let rentalData = { id: docSnap.id, ...docSnap.data() };

              if (rentalData.listingId) {
                const listingRef = doc(db, "airplanes", rentalData.listingId);
                const listingSnap = await getDoc(listingRef);
                if (listingSnap.exists()) {
                  rentalData.listing = listingSnap.data();
                }
              }
              return rentalData;
            })
          );
          setPastRentals(past);
        };
        fetchListings();
      },
      (error) => {
        console.error("Error fetching past rentals:", error);
        Alert.alert("Error", "Failed to fetch past rentals.");
      }
    );

    return () => unsubscribePastRentals();
  }, [isAuthChecked, renterId]);

  // -------------------------
  // Fetch Favorites Listings (Original - unchanged)
  // -------------------------
  useEffect(() => {
    if (!renterId) return;
    const favoritesRef = collection(db, "users", renterId, "favorites");
    const favoritesQuery = query(favoritesRef, limit(5));

    const unsubscribeFavorites = onSnapshot(
      favoritesQuery,
      (snapshot) => {
        const favs = snapshot.docs
          .map((docSnap) => docSnap.data())
          .filter((fav) => fav.ownerId !== renterId);

        setFavoritesListings(favs);
      },
      (error) => {
        console.error("Error fetching favorites: ", error);
      }
    );

    return () => unsubscribeFavorites();
  }, [renterId]);

  // (Original removeFavorite function - unchanged)
  const removeFavorite = async (listing) => {
    if (!renterId) return;
    try {
      const favRef = collection(db, "users", renterId, "favorites");
      const favQuery = query(favRef, where("id", "==", listing.id));
      const favSnapshot = await getDocs(favQuery);

      favSnapshot.docs.forEach(async (docSnap) => {
        await deleteDoc(doc(db, "users", renterId, "favorites", docSnap.id));
      });

      Alert.alert("Favorite Removed", "Listing removed from favorites.");
    } catch (error) {
      console.error("Error removing favorite:", error);
      Alert.alert("Error", "Failed to remove favorite.");
    }
  };

  // -------------------------
  // Fetch Rentals & Notifications (Original - unchanged, reads active/approved)
  // -------------------------
  useEffect(() => {
    if (!isAuthChecked || !renterId) return; // Guard clause

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
          if (!requestData.rentalStatus) {
            console.warn(`Rental Request ${docSnap.id} missing rentalStatus.`);
            continue;
          }
          if (!requestData.listingId) {
            console.warn(`Rental Request ${docSnap.id} missing listingId.`);
            continue;
          }

          let ownerName = "N/A"; // Default owner name
          if (requestData.ownerId) {
            try {
                // ** Correction: Read from 'users' collection **
                const ownerDocRef = doc(db, "users", requestData.ownerId); 
                const ownerDoc = await getDoc(ownerDocRef);
                if (ownerDoc.exists()) {
                    ownerName = ownerDoc.data().fullName || ownerDoc.data().displayName || "N/A"; 
                } else {
                    console.warn(`Owner user doc not found for ${requestData.ownerId}`);
                }
            } catch (error) {
                console.error("Error fetching owner details:", error);
            }
          }
          
          // ** Fetch and attach listing details **
          const listingDetails = await fetchListingDetails(requestData.listingId);

          active.push({
            id: docSnap.id,
            ...requestData,
            ownerName, // Add owner name
            listingDetails: listingDetails, // Attach the fetched listing data
            aircraftModel: listingDetails?.aircraftModel || 'N/A' // Convenience field
          });
        }

        setRentals(active); // This state holds both 'active' and 'approved'
        const lastRentalDoc = snapshot.docs[snapshot.docs.length - 1];
        setRentalsLastDoc(lastRentalDoc);
        setHasMoreRentals(snapshot.docs.length === RENTALS_PAGE_SIZE); // Update hasMoreRentals flag
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
        setAllNotifications(notifs); // Keep this separate for the 'View All' modal
        setNotificationCount(notifs.length);

        const lastVisible = snapshot.docs[snapshot.docs.length - 1];
        setNotificationsLastDoc(lastVisible);
        setHasMoreNotifications(snapshot.docs.length === NOTIFICATIONS_PAGE_SIZE); // Update hasMoreNotifications flag
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

  // -------------------------
  // Payment Navigation (Original - requires ownerId parameter)
  // -------------------------
  const navigateToCheckout = async (rentalRequestId, costPerHour, rentalHours, ownerIdParam) => { // Add ownerIdParam
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
      if (!ownerIdParam) { // Validate ownerIdParam
          setIsProcessingPayment(false);
          Alert.alert("Error", "Owner information missing for payment.");
          console.error("Missing ownerId when navigating to checkout for rental:", rentalRequestId);
          return;
      }

      try {
          console.log(`Navigating to CheckoutScreen with Rental Request ID: ${rentalRequestId}`);
          console.log(`Cost Per Hour: ${costPerHour}, Rental Hours: ${rentalHours}, Owner ID: ${ownerIdParam}`);

          router.push({
              pathname: "/payment/CheckoutScreen",
              params: {
                  rentalRequestId,
                  costPerHour,
                  rentalHours,
                  ownerId: ownerIdParam, // Pass ownerId
              },
          });
      } catch (error) {
          console.error("Error navigating to CheckoutScreen:", error);
          Alert.alert("Error", "Failed to navigate to payment screen.");
          setIsProcessingPayment(false); // Reset on error
      } 
  };

  // -------------------------
  // Handling Notification Press (Original - slightly adapted for clarity and ownerId)
  // -------------------------
  const handleNotificationPress = async (notification) => {
      try {
          if (!notification) throw new Error("Notification object is undefined.");
          const rentalRequestId = notification.rentalRequestId || notification.rentalRequest; 
          
          if (rentalRequestId) {
              console.log("Notification has rentalRequestId:", rentalRequestId);
              setIsRentalRequestLoading(true);
              setPaymentComplete(false); 

              const rentalRequestRef = doc(db, "rentalRequests", rentalRequestId);
              if (rentalRequestListenerRef.current) {
                  rentalRequestListenerRef.current(); // Detach previous listener
              }

              const rentalRequestSnap = await getDoc(rentalRequestRef);
              if (!rentalRequestSnap.exists()) {
                  Alert.alert("Error", "Rental request not found.");
                  setIsRentalRequestLoading(false);
                  closeAllOpenModals();
                  return;
              }

              const rentalRequestData = rentalRequestSnap.data();
              console.log("Rental Request Data:", rentalRequestData);

              setPaymentComplete(rentalRequestData.paymentStatus === "succeeded" || rentalRequestData.rentalStatus === "active");

              let ownerName = "N/A";
              if (rentalRequestData.ownerId) {
                  try {
                      const ownerDocRef = doc(db, "users", rentalRequestData.ownerId); // Check 'users' collection
                      const ownerDoc = await getDoc(ownerDocRef);
                      if (ownerDoc.exists()) {
                          ownerName = ownerDoc.data().fullName || "N/A"; 
                      }
                  } catch (e) { console.error("Error fetching owner name", e); }
              }
              
              const updatedRentalRequestData = { ...rentalRequestData, ownerName };
              setSelectedRentalRequest(updatedRentalRequestData);

              const listingData = await fetchListingDetails(rentalRequestData.listingId);
              if (!listingData) {
                  Alert.alert("Error", "Associated listing not found.");
                  setIsRentalRequestLoading(false);
                  closeAllOpenModals();
                  return;
              }
              setSelectedListing(listingData);

              const rentalHoursVal = parseFloat(rentalRequestData.rentalHours);
              const rentalCostPerHourVal = parseFloat(listingData.costPerHour);

              if (isNaN(rentalCostPerHourVal) || isNaN(rentalHoursVal)) {
                  Alert.alert("Error", "Rental cost information is invalid.");
                  setIsRentalRequestLoading(false);
                  closeAllOpenModals();
                  return;
              }

              const computedTotalCost = calculateTotalCost(rentalCostPerHourVal, rentalHoursVal);
              setTotalCost(computedTotalCost);

              rentalRequestListenerRef.current = onSnapshot(
                  rentalRequestRef,
                  (docSnap) => {
                      if (docSnap.exists()) {
                          const data = docSnap.data();
                          setSelectedRentalRequest(prev => ({ ...prev, ...data })); 
                          setPaymentComplete(data.paymentStatus === "succeeded" || data.rentalStatus === "active");
                      } else {
                          console.warn(`Rental request ${rentalRequestId} deleted while modal open.`);
                          closeModal(); 
                          Alert.alert("Request Deleted", "This rental request is no longer available.");
                      }
                  },
                  (error) => {
                      console.error("Error listening to rental request in modal:", error);
                  }
              );

              setSelectedNotification(notification);
              setNotificationModalVisible(true); 
              setIsRentalRequestLoading(false);

          } else {
              console.log("Notification pressed without rentalRequestId:", notification);
              setSelectedNotification(notification);
              setSelectedRentalRequest(null);
              setSelectedListing(null);
              setTotalCost({ rentalCost: "0.00", bookingFee: "0.00", transactionFee: "0.00", salesTax: "0.00", total: "0.00" });
              setPaymentComplete(false);
              setNotificationModalVisible(true); 
          }
      } catch (error) {
          console.error("Error handling notification press:", error);
          Alert.alert("Error", `Failed to process notification: ${error.message}`);
          setIsRentalRequestLoading(false);
          closeAllOpenModals();
      }
  };

  // -------------------------
  // Handling Active Rental Card Press (Original - requires definition before use)
  // -------------------------
  const handleActiveRentalPress = async (rental) => {
    try {
      if (!rental || !rental.id) {
        Alert.alert("Error", "Invalid rental data.");
        return;
      }
      setIsRentalRequestLoading(true);
      const rentalRequestRef = doc(db, "rentalRequests", rental.id);
      const rentalRequestSnap = await getDoc(rentalRequestRef);

      if (!rentalRequestSnap.exists()) {
        Alert.alert("Error", "Rental request not found.");
        setIsRentalRequestLoading(false);
        return;
      }

      const rentalRequestData = rentalRequestSnap.data();
      setSelectedRentalRequest(rentalRequestData);

      const listingData = await fetchListingDetails(rentalRequestData.listingId);
      if (!listingData) {
        Alert.alert("Error", "Associated listing not found.");
        setIsRentalRequestLoading(false);
        return;
      }
      setSelectedListing(listingData);

      const rentalHoursVal = parseFloat(rentalRequestData.rentalHours);
      const rentalCostPerHourVal = parseFloat(listingData.costPerHour);

      if (isNaN(rentalCostPerHourVal) || isNaN(rentalHoursVal)) {
        Alert.alert("Error", "Rental cost information is invalid.");
        setIsRentalRequestLoading(false);
        return;
      }

      const computedTotalCost = calculateTotalCost(rentalCostPerHourVal, rentalHoursVal);
      setTotalCost(computedTotalCost);

      setCurrentChatOwnerId(rentalRequestData.ownerId); // Set owner ID for potential chat

      setActiveRentalModalVisible(true); // Show the active rental modal
      setIsRentalRequestLoading(false);
    } catch (error) {
      console.error("Error handling active rental press:", error);
      Alert.alert("Error", `Failed to load rental details: ${error.message}`);
      setIsRentalRequestLoading(false);
    }
  };

  // -------------------------
  // Handle Past Rental Press (Original - requires definition before use)
  // -------------------------
  const handlePastRentalPress = (rental) => {
    try {
      console.log("Past rental pressed:", rental);
      Alert.alert(
        "Past Rental",
        `This is a past rental for: ${rental.listing?.aircraftModel || "No aircraft model"}`
      );
    } catch (error) {
      console.error("Error handling past rental press:", error);
    }
  };

  // -------------------------
  // Render Functions (Defined within component scope for access to handlers)
  // -------------------------
  const renderRentalItem = ({ item }) => (
      <TouchableOpacity
          style={styles.rentalBox}
          onPress={() => handleActiveRentalPress(item)}
          accessibilityLabel={`View details for rental: ${item.aircraftModel}`}
          accessibilityRole="button"
      >
          <Text style={styles.rentalAircraftModel}>
              {item.aircraftModel || "N/A"} 
          </Text>
          <Text style={styles.rentalStatus}>{item.rentalStatus === 'active' ? 'Active' : 'Approved - Payment Pending'}</Text>
          <Text style={styles.rentalTotalCost}>
              Total Cost: ${safeToFixed(item.totalCost)} 
          </Text>
      </TouchableOpacity>
  );

  const renderPastRentalItem = ({ item }) => (
      <TouchableOpacity
          style={styles.rentalBox}
          onPress={() => handlePastRentalPress(item)}
          accessibilityLabel={`Access past rental: ${item.listing?.aircraftModel || "Listing"}`}
          accessibilityRole="button"
      >
          <Text style={styles.rentalAircraftModel}>
              {item.listing?.aircraftModel || "Listing"}
          </Text>
          <Text style={styles.rentalStatus}>Completed</Text> 
          <Text style={styles.rentalTotalCost}>
              Total Cost: ${safeToFixed(item.totalCost)}
          </Text>
      </TouchableOpacity>
  );

  const renderFavoriteItem = ({ item }) => (
      <View style={styles.favoriteCard}>
          <TouchableOpacity
              style={styles.favoriteRemoveButton}
              onPress={() => removeFavorite(item)}
              accessibilityLabel="Remove favorite listing"
              accessibilityRole="button"
          >
              <Ionicons name="close-circle" size={20} color="#FF0000" />
          </TouchableOpacity>
          <TouchableOpacity
              onPress={() =>
                  router.push({
                      pathname: "/home",
                      params: { listingId: item.id },
                  })
              }
              accessibilityLabel={`View favorite listing: ${item.year} ${item.make}`}
              accessibilityRole="button"
          >
              <ImageBackground
                  source={{ uri: item.images && item.images[0] }}
                  style={styles.favoriteImage}
                  imageStyle={{ borderTopLeftRadius: 8, borderTopRightRadius: 8 }}
              />
              <View style={styles.favoriteInfo}>
                  <Text style={styles.favoriteTitle} numberOfLines={1}>
                      {`${item.year} ${item.make}`}
                  </Text>
              </View>
          </TouchableOpacity>
      </View>
  );

  // -------------------------
  // Auto-move active rentals to past rentals (Original - unchanged, but adapted date parsing)
  // -------------------------
  useEffect(() => {
    if (!renterId) return;

    const rentalRequestsRef = collection(db, "rentalRequests");
    const activeRentalsQuery = query(
      rentalRequestsRef,
      where("renterId", "==", renterId),
      where("rentalStatus", "==", "active")
    );

    const unsubscribe = onSnapshot(activeRentalsQuery, (snapshot) => {
      const batch = writeBatch(db);
      let needsCommit = false;
      const now = new Date();

      snapshot.docs.forEach((docSnap) => {
        const data = docSnap.data();
        if (data.rentalDate) {
          let rentalDateObj;
          if (typeof data.rentalDate === 'string' && data.rentalDate.includes('/')) {
              const parts = data.rentalDate.split("/");
              let year = parts[2];
              if (year.length === 2) year = "20" + year; 
              rentalDateObj = new Date(year, parseInt(parts[0]) - 1, parseInt(parts[1])); 
          } else if (typeof data.rentalDate === 'string' && data.rentalDate.includes('-')) {
              rentalDateObj = new Date(data.rentalDate);
          } else if (data.rentalDate.toDate) {
               rentalDateObj = data.rentalDate.toDate();
          } else {
               console.warn(`Unrecognized rentalDate format for ${docSnap.id}:`, data.rentalDate);
               return; 
          }

          rentalDateObj.setHours(23, 59, 59, 999);

          if (now > rentalDateObj) {
              batch.update(docSnap.ref, { rentalStatus: "completed" }); 
              console.log(`Scheduling rental ${docSnap.id} to be marked as completed.`);
              needsCommit = true;
          }
        }
      });

      if (needsCommit) {
        batch.commit().catch(error => console.error("Error batch updating rental status:", error));
      }
    });

    return () => unsubscribe();
  }, [renterId]);

  // -------------------------
  // Close Notification Modal (Original, wrapped in useCallback)
  // -------------------------
  const closeModal = useCallback(() => {
    setNotificationModalVisible(false);
    if (selectedNotification || selectedRentalRequest) { 
        setSelectedNotification(null);
        setSelectedRentalRequest(null);
        setSelectedListing(null);
        setTotalCost({ rentalCost: "0.00", bookingFee: "0.00", transactionFee: "0.00", salesTax: "0.00", total: "0.00" });
        setPaymentComplete(false);
    }
    if (rentalRequestListenerRef.current) {
        rentalRequestListenerRef.current();
        rentalRequestListenerRef.current = null;
    }
  }, [selectedNotification, selectedRentalRequest]);

  // -------------------------
  // Remove All Notifications (Original - unchanged)
  // -------------------------
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

  // -------------------------
  // Fetch More Notifications (Original - unchanged)
  // -------------------------
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

  // -------------------------
  // Date Picker (Original - unchanged)
  // -------------------------
  const showDatePicker = () => setDatePickerVisibility(true);
  const hideDatePicker = () => setDatePickerVisibility(false);
  const handleConfirm = (date) => {
    const formattedDate = `${date.getMonth() + 1}/${date.getDate()}/${date.getFullYear()}`;
    setRentalDate(formattedDate);
    hideDatePicker();
  };

  // -------------------------
  // Messaging (Original - unchanged)
  // -------------------------
  const sendMessage = async () => {
    if (!messageText.trim()) {
      Alert.alert("Validation Error", "Message cannot be empty.");
      return;
    }

    if (selectedRentalRequest && selectedRentalRequest.rentalStatus === "completed") {
      Alert.alert("Chat Disabled", "Chatting about a completed rental is no longer available.");
      return;
    }
    
    if (!currentChatOwnerId) {
        Alert.alert("Error", "Cannot send message: Owner information missing.");
        return;
    }

    try {
      const rentalRequestIdForMsg = selectedRentalRequest?.id || selectedNotification?.rentalRequestId || null;

      await addDoc(collection(db, "messages"), {
        senderId: renterId,
        senderName: renter.displayName || "User",
        text: messageText.trim(),
        timestamp: serverTimestamp(),
        participants: [renterId, currentChatOwnerId], 
        rentalRequestId: rentalRequestIdForMsg, 
      });
      setMessageText("");
    } catch (error) {
      console.error("Error sending message:", error);
      Alert.alert("Error", "Failed to send message.");
    }
  };

  const toggleMessagesModal = () => {
    closeAllOpenModals();
    setMessagesModalVisible(!messagesModalVisible);
  };

  // -------------------------
  // Profile Image / Document Pickers (Original - updated DocumentPicker access)
  // -------------------------
  const pickImage = async () => {
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.All,
      allowsEditing: true,
      aspect: [4, 4],
      quality: 1,
    });

    if (!result.canceled && result.assets && result.assets.length > 0) {
      setProfileData({ ...profileData, image: result.assets[0].uri });
    }
  };

  const pickDocument = async (field) => {
    let result = await DocumentPicker.getDocumentAsync({
      type: ["application/pdf", "image/*"],
    });

    if (result.assets && result.assets.length > 0) { 
      setProfileData({ ...profileData, [field]: result.assets[0].uri });
    } else if (!result.canceled && result.uri) { 
      setProfileData({ ...profileData, [field]: result.uri });
    }
  };

  // -------------------------
  // Fetch User Profile (Original - unchanged)
  // -------------------------
  const fetchUserProfile = async () => {
    if (!renterId) {
      console.error("No renter ID available");
      return;
    }

    try {
      const profileDocRef = doc(db, "users", renterId);
      const profileDocSnap = await getDoc(profileDocRef);

      if (profileDocSnap.exists()) {
        const data = profileDocSnap.data();
        setProfileData({
          firstName: data.firstName || "",
          lastName: data.lastName || "",
          insurance: data.insurance || null,
          pilotLicense: data.pilotLicense || null,
          medical: data.medical || null,
          aircraftType: data.aircraftType || "",
          certifications: data.certifications || "",
          image: data.image || null,
          profileType: data.profileType || "renter",
        });
      } else {
        console.warn("Profile document not found in 'users'.");
      }

      setProfileModalVisible(true);
    } catch (error) {
      console.error("Error fetching profile:", error);
      Alert.alert("Error", "Unable to load profile.");
    }
  };

  // -------------------------
  // Profile Submit (Original - unchanged)
  // -------------------------
  const handleProfileSubmit = (values) => {
    setProfileData(values);
    setProfileSaved(true);
    setProfileModalVisible(false);
  };

  // -------------------------
  // Location (Original - unchanged)
  // -------------------------
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

  // -------------------------
  // Ratings (Original - unchanged)
  // -------------------------
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

  // -------------------------
  // Listen for Messages (Original - unchanged)
  // -------------------------
  useEffect(() => {
    if (currentChatOwnerId && renterId) {
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
              messageData.participants &&
              messageData.participants.includes(renterId) &&
              messageData.participants.includes(currentChatOwnerId)
            ) {
              fetchedMessages.push({ id: docSnap.id, ...messageData });
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

  // --- JSX Return ---
  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <StatusBar hidden={false} />
      </SafeAreaView>

      {!isAuthChecked ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#3182ce" />
        </View>
      ) : renterId ? (
        <ScrollView
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => {}} />}
          contentContainerStyle={{ paddingBottom: 16 }}
        >
          {/* Header Section */}
          <View style={styles.headerWrapper}>
            <ImageBackground
              source={require("../../Assets/images/wingtip_clouds.jpg")}
              style={styles.headerImage}
              resizeMode="cover"
            >
              <View style={styles.headerOverlay}>
                <View style={styles.headerContent}>
                  <TouchableOpacity
                    onPress={fetchUserProfile}
                    style={styles.headerTextContainer}
                    accessibilityLabel="Edit profile"
                    accessibilityRole="button"
                  >
                    <Text style={styles.welcomeText}>Welcome,</Text>
                    <Text style={styles.userNameText}>
                      {profileData.firstName
                        ? `${profileData.firstName} ${profileData.lastName}`
                        : renter?.displayName || "User"}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            </ImageBackground>
          </View>

          {/* Navigation Buttons */}
          <View style={styles.navigationButtonsContainer}>
            <TouchableOpacity
              style={styles.navigationButton}
              onPress={() => setFaqModalVisible(true)}
              accessibilityLabel="Frequently Asked Questions"
              accessibilityRole="button"
            >
              <Ionicons name="help-circle-outline" size={32} color="#3182ce" />
              <Text>FAQ</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.navigationButton}
              onPress={fetchUserProfile}
              accessibilityLabel="Edit profile"
              accessibilityRole="button"
            >
              <Ionicons name="person-circle-outline" size={32} color="#3182ce" />
              <Text>Profile</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.navigationButton}
              onPress={() => setInvestModalVisible(true)}
              accessibilityLabel="Invest in Ready Set Fly"
              accessibilityRole="button"
            >
              <Ionicons name="rocket-outline" size={32} color="#3182ce" />
              <Text style={{ textAlign: "center", fontSize: 12 }}>Invest in R.S.F?</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.navigationButton}
              onPress={() => setPrivacyModalVisible(true)}
              accessibilityLabel="Privacy Policy"
              accessibilityRole="button"
            >
              <Ionicons name="lock-closed-outline" size={32} color="#3182ce" />
              <Text>Privacy Policy</Text>
            </TouchableOpacity>
          </View>

          {/* Recent Searches Section */}
          <View style={styles.sectionContainer}>
            <Text style={styles.sectionTitle}>Recent Searches</Text>
            <View style={styles.recentSearchesRow}>
              <View style={styles.recentSearchBox}>
                <Text>Van Nuys Airport</Text>
                <Text style={styles.recentSearchDetails}>3 guests · 9/10/23-9/17/23</Text>
              </View>
              <View style={styles.recentSearchBox}>
                <Text>Santa Monica Airport</Text>
                <Text style={styles.recentSearchDetails}>2 guests · 9/18/23-9/25/23</Text>
              </View>
            </View>
          </View>

          {/* Past Rentals Section */}
          <View style={styles.sectionContainer}>
            <Text style={styles.sectionTitle}>Past Rentals</Text>
            {pastRentals.length > 0 ? (
              <FlatList
                data={pastRentals}
                keyExtractor={(item, index) => `${item.id}_${index}`}
                renderItem={renderPastRentalItem}
                horizontal
                showsHorizontalScrollIndicator={false}
              />
            ) : (
              <Text style={styles.noActiveRentalsText}>No past rentals available.</Text>
            )}
          </View>

          {/* Favorites Section */}
          {favoritesListings.length > 0 && (
            <View style={styles.sectionContainer}>
              <Text style={styles.sectionTitle}>Favorites</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {favoritesListings.map((item, index) => (
                  <View key={item.id || index} style={{ marginRight: 16 }}>
                    {renderFavoriteItem({ item })}
                  </View>
                ))}
              </ScrollView>
            </View>
          )}

          {/* Active Rentals Section */}
          <View style={styles.sectionContainer}>
            <Text style={styles.sectionTitle}>Active Rentals</Text>
            {rentals.filter(r => r.rentalStatus === 'active').length > 0 ? (
              <>
                <FlatList
                  data={rentals.filter(r => r.rentalStatus === 'active')}
                  keyExtractor={(item, index) => `${item.id}_${index}`}
                  renderItem={renderRentalItem}
                  scrollEnabled={false}
                />
              </>
            ) : (
              <Text style={styles.noActiveRentalsText}>No active rentals at the moment.</Text>
            )}
          </View>

          {/* Notifications Section */}
          <View style={styles.sectionContainer}>
             <Text style={styles.sectionTitle}>Notifications</Text>
             {notifications.filter(n => !rentals.some(r => r.id === n.rentalRequestId && r.rentalStatus === 'active')).length > 0 ? (
                 <FlatList
                    data={notifications.filter(n => !rentals.some(r => r.id === n.rentalRequestId && r.rentalStatus === 'active')).slice(0, 3)}
                    keyExtractor={(item, index) => `${item.id}_${index}`}
                    renderItem={({ item }) => (
                        <TouchableOpacity
                            style={styles.notificationBox}
                            onPress={() => {
                                handleNotificationPress(item);
                            }}
                            accessibilityLabel={`View details for notification: ${typeof item.message === "string" ? item.message : JSON.stringify(item.message)}`}
                            accessibilityRole="button"
                        >
                            <Text style={styles.notificationMessageText}>
                              {typeof item.message === "string" ? item.message : JSON.stringify(item.message)}
                            </Text>
                            <Text style={styles.notificationDateText}>
                                {item.createdAt?.toDate ? item.createdAt.toDate().toLocaleString() : "N/A"}
                            </Text>
                        </TouchableOpacity>
                    )}
                    scrollEnabled={false}
                 />
             ) : (
                 <Text style={styles.noNotificationsText}>No new notifications.</Text>
             )}
             {allNotifications.length > 0 && (
                 <TouchableOpacity
                     onPress={removeAllNotifications}
                     style={styles.removeAllNotificationsButton}
                     accessibilityLabel="Remove all notifications"
                     accessibilityRole="button"
                 >
                     <Text style={styles.removeAllNotificationsButtonText}>Remove All</Text>
                 </TouchableOpacity>
             )}
             {allNotifications.length > 3 && (
                 <TouchableOpacity
                     onPress={() => setAllNotificationsModalVisible(true)}
                     style={styles.viewAllNotificationsButton}
                     accessibilityLabel="View all notifications"
                     accessibilityRole="button"
                 >
                     <Text style={styles.viewAllNotificationsButtonText}>View All</Text>
                 </TouchableOpacity>
             )}
          </View>

        </ScrollView>
      ) : (
        <View style={styles.notAuthenticatedContainer}>
          <Text style={styles.notAuthenticatedText}>
            You are not authenticated. Please log in to continue.
          </Text>
          <TouchableOpacity
            onPress={() => router.push("/sign-in")}
            style={styles.goToLoginButton}
            accessibilityLabel="Navigate to login screen"
            accessibilityRole="button"
          >
            <Text style={styles.goToLoginButtonText}>Go to Login</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Original Profile Saved View */}
      {profileSaved && renterId && (
        <View style={styles.profileContainer}>
          <Text style={styles.profileTitle}>Profile Information</Text>
          <View style={styles.profileRow}>
            <Text style={styles.profileLabel}>Name:</Text>
            <Text style={styles.profileValue}>
              {profileData.firstName} {profileData.lastName}
            </Text>
          </View>
          {profileData.image && (
            <Image source={{ uri: profileData.image }} style={styles.profileImage} />
          )}
        </View>
      )}

      {/* --- Modals --- */}

      {/* Profile Modal */}
      <Modal
          visible={profileModalVisible}
          animationType="slide"
          transparent={true}
          onRequestClose={() => setProfileModalVisible(false)}
      >
          <KeyboardAvoidingView
              behavior={Platform.OS === "ios" ? "padding" : "height"}
              style={styles.modalContainer}
          >
              <ScrollView contentContainerStyle={styles.modalContent}>
                  <Text style={styles.modalTitle}>Edit Profile</Text>
                  <TouchableOpacity
                      onPress={pickImage}
                      style={styles.profileImageUpload}
                      accessibilityLabel="Upload profile image"
                      accessibilityRole="button"
                  >
                      {profileData.image ? (
                          <Image source={{ uri: profileData.image }} style={styles.profileImagePreview} />
                      ) : (
                          <Ionicons name="person-circle-outline" size={100} color="#ccc" />
                      )}
                      <Text style={styles.uploadText}>Upload Profile Image</Text>
                  </TouchableOpacity>
                  <TextInput
                      placeholder="First Name"
                      value={profileData.firstName}
                      onChangeText={(text) => setProfileData({ ...profileData, firstName: text })}
                      style={styles.modalInput}
                  />
                  <TextInput
                      placeholder="Last Name"
                      value={profileData.lastName}
                      onChangeText={(text) => setProfileData({ ...profileData, lastName: text })}
                      style={styles.modalInput}
                  />
                  <TouchableOpacity
                      onPress={() => pickDocument("insurance")}
                      style={styles.uploadButton}
                      accessibilityLabel="Upload renters insurance"
                      accessibilityRole="button"
                  >
                      <Text style={styles.uploadButtonText}> 
                          {profileData.insurance ? "Renters Insurance Uploaded" : "Upload Renters Insurance"}
                      </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                      onPress={() => pickDocument("pilotLicense")}
                      style={styles.uploadButton}
                      accessibilityLabel="Upload pilots license"
                      accessibilityRole="button"
                  >
                      <Text style={styles.uploadButtonText}>
                          {profileData.pilotLicense ? "Pilots License Uploaded" : "Upload Pilots License"}
                      </Text>
                  </TouchableOpacity>
                   <TouchableOpacity
                      onPress={() => pickDocument("medical")}
                      style={styles.uploadButton}
                      accessibilityLabel="Upload current medical"
                      accessibilityRole="button"
                  >
                      <Text style={styles.uploadButtonText}>
                          {profileData.medical ? "Medical Document Uploaded" : "Upload Current Medical"}
                      </Text>
                  </TouchableOpacity>
                  <TextInput
                      placeholder="Type of aircraft certified in"
                      value={profileData.aircraftType}
                      onChangeText={(text) => setProfileData({ ...profileData, aircraftType: text })}
                      style={styles.modalInput}
                  />
                  <TextInput
                      placeholder="Certifications (e.g., IFR)"
                      value={profileData.certifications}
                      onChangeText={(text) => setProfileData({ ...profileData, certifications: text })}
                      style={styles.modalInput}
                  />
                  <TouchableOpacity
                      onPress={() => handleProfileSubmit(profileData)}
                      style={styles.saveButton}
                      accessibilityLabel="Save profile"
                      accessibilityRole="button"
                  >
                      <Text style={styles.saveButtonText}>Save</Text>
                  </TouchableOpacity>
              </ScrollView>
          </KeyboardAvoidingView>
      </Modal>

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
                  item.senderId === renterId ? styles.chatBubbleRight : styles.chatBubbleLeft, 
                ]}
              >
                <Text style={styles.chatSenderName}>{item.senderName}:</Text>
                <Text style={styles.chatMessageText}>
                  {typeof item.text === "string" ? item.text : JSON.stringify(item.text)}
                </Text>
                <Text style={styles.chatTimestamp}>
                  {item.timestamp?.toDate ? item.timestamp.toDate().toLocaleString() : "Sending..."}
                </Text>
              </View>
            )}
            contentContainerStyle={styles.messagesList}
            style={{ flex: 1, width: "100%" }}
            inverted
            ref={ref => this.flatList = ref}
            onContentSizeChange={() => this.flatList.scrollToOffset({ animated: false, offset: 0 })}
            onLayout={() => this.flatList.scrollToOffset({ animated: false, offset: 0 })}
          />

          <View style={styles.messageInputContainer}>
            <TextInput
              placeholder="Type your message..."
              value={messageText}
              onChangeText={(text) => setMessageText(text)}
              style={styles.messageTextInput}
              keyboardType="default"
              autoCapitalize="sentences"
              accessibilityLabel="Type a message"
              multiline
            />
            <TouchableOpacity
              onPress={sendMessage}
              style={styles.sendButton}
              accessibilityLabel="Send message"
              accessibilityRole="button"
            >
              <Ionicons name="send" size={20} color="white" />
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Notification Details Modal */}
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
              <ActivityIndicator size="large" color="#3182ce" style={{ marginTop: 20 }} />
            ) : selectedRentalRequest ? (
              <ScrollView contentContainerStyle={{ padding: 16 }}>
                <Text style={styles.notificationDetailsTitle}>Rental Request Details</Text>
                <View style={styles.notificationDetailBox}>
                    <Text style={styles.detailLabel}>Message:</Text>
                    <Text style={styles.detailValue}>{selectedNotification?.message || "Rental Request"}</Text>
                </View>
                <View style={styles.notificationDetailBox}>
                    <Text style={styles.detailLabel}>From:</Text>
                    <Text style={styles.detailValue}>{selectedRentalRequest.ownerName || "N/A"}</Text>
                </View>
                <View style={styles.notificationDetailBox}>
                    <Text style={styles.detailLabel}>Date:</Text>
                    <Text style={styles.detailValue}>{selectedRentalRequest.rentalDate || "N/A"}</Text>
                </View>
                {selectedRentalRequest && selectedListing && (
                    <View style={styles.notificationDetailBox}>
                        <Text style={styles.detailLabel}>Rental Details:</Text>
                        <Text style={styles.detailValue}>Aircraft Model: {selectedListing.aircraftModel || "N/A"}</Text>
                        <Text style={styles.detailValue}>Tail Number: {selectedListing.tailNumber || "N/A"}</Text>
                        <Text style={styles.detailValue}>Rental Hours: {selectedRentalRequest.rentalHours || "N/A"}</Text>
                        <Text style={styles.detailValue}>Rental Date: {selectedRentalRequest.rentalDate || "N/A"}</Text>
                        {totalCost ? (
                            <View style={{ marginTop: 8 }}>
                                <Text style={styles.detailLabel}>Cost Breakdown:</Text>
                                <Text style={styles.detailValue}>Rental Cost (${selectedListing.costPerHour}/hr * {selectedRentalRequest.rentalHours} hours): ${safeToFixed(totalCost.rentalCost)}</Text>
                                <Text style={styles.detailValue}>Booking Fee (6%): ${safeToFixed(totalCost.bookingFee)}</Text>
                                <Text style={styles.detailValue}>Transaction Fee (3%): ${safeToFixed(totalCost.transactionFee)}</Text>
                                <Text style={styles.detailValue}>Sales Tax (8.25%): ${safeToFixed(totalCost.salesTax)}</Text>
                                <Text style={styles.detailTotalCostText}>Total Cost: ${safeToFixed(totalCost.total)}</Text>
                            </View>
                        ) : (
                            <Text style={styles.detailValue}>Total Cost: N/A</Text>
                        )}
                    </View>
                )}

                {!paymentComplete ? (
                    <TouchableOpacity
                        onPress={() => {
                           const ownerIdForCheckout = selectedRentalRequest?.ownerId; 
                           if (!ownerIdForCheckout) {
                               Alert.alert("Error", "Cannot proceed to payment: Owner information is missing.");
                               return;
                           }
                           navigateToCheckout(
                               selectedNotification?.rentalRequestId || selectedRentalRequest.id,
                               parseFloat(selectedListing.costPerHour),
                               parseFloat(selectedRentalRequest.rentalHours),
                               ownerIdForCheckout
                           );
                        }}
                        style={[styles.proceedToPayButton, isProcessingPayment && styles.disabledButton]}
                        accessibilityLabel="Proceed to payment"
                        accessibilityRole="button"
                        disabled={isProcessingPayment}
                    >
                        {isProcessingPayment ? (
                            <ActivityIndicator size="small" color="#fff" />
                        ) : (
                            <Text style={styles.proceedToPayButtonText}>Proceed to Pay</Text>
                        )}
                    </TouchableOpacity>
                ) : (
                    <View style={{ alignItems: "center", marginVertical: 16 }}>
                        <Text style={{ fontSize: 18, color: "#38a169", marginBottom: 8 }}>Payment Completed. Rental is now active.</Text>
                        <TouchableOpacity
                            onPress={() => {
                                closeModal();
                                handleActiveRentalPress(selectedRentalRequest);
                            }}
                            style={styles.closeNotificationModalButton}
                            accessibilityLabel="Manage Rental"
                            accessibilityRole="button"
                        >
                            <Text style={styles.closeNotificationModalButtonText}>Manage Rental</Text>
                        </TouchableOpacity>
                    </View>
                )}
              </ScrollView>
            ) : selectedNotification ? (
              <ScrollView contentContainerStyle={{ padding: 16 }}>
                 <Text style={styles.notificationDetailsTitle}>Notification Details</Text>
                 <View style={styles.notificationDetailBox}>
                    <Text style={styles.detailLabel}>Message:</Text>
                    <Text style={styles.detailValue}>{selectedNotification.message}</Text>
                 </View>
                 <View style={styles.notificationDetailBox}>
                    <Text style={styles.detailLabel}>From:</Text>
                    <Text style={styles.detailValue}>{selectedNotification.ownerName || "System"}</Text> 
                 </View>
                 <View style={styles.notificationDetailBox}>
                    <Text style={styles.detailLabel}>Date:</Text>
                    <Text style={styles.detailValue}>
                        {selectedNotification.createdAt?.toDate ? selectedNotification.createdAt.toDate().toLocaleString() : "N/A"}
                    </Text>
                 </View>
                 <TouchableOpacity
                    onPress={closeModal}
                    style={styles.closeNotificationModalButton}
                    accessibilityLabel="Close notification modal"
                    accessibilityRole="button"
                 >
                    <Text style={styles.closeNotificationModalButtonText}>Close</Text>
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
              <ModalHeader title="All Notifications" onClose={() => setAllNotificationsModalVisible(false)} />
              
              {allNotifications.length > 0 ? (
                <FlatList
                  data={allNotifications}
                  keyExtractor={(item, index) => `${item.id}_${index}`}
                  renderItem={({ item }) => (
                    <TouchableOpacity
                      style={styles.notificationBox}
                      onPress={() => {
                        handleNotificationPress(item);
                        setAllNotificationsModalVisible(false); 
                      }}
                      accessibilityLabel={`View notification: ${typeof item.message === "string" ? item.message : JSON.stringify(item.message)}`}
                      accessibilityRole="button"
                    >
                      <Text style={styles.notificationMessageText}>
                        {typeof item.message === "string" ? item.message : JSON.stringify(item.message)}
                      </Text>
                      <Text style={styles.notificationDateText}>
                        {item.createdAt?.toDate ? item.createdAt.toDate().toLocaleString() : "N/A"}
                      </Text>
                    </TouchableOpacity>
                  )}
                  ListFooterComponent={
                    hasMoreNotifications ? (
                      <ActivityIndicator size="large" color="#3182ce" style={{ marginVertical: 16 }} />
                    ) : (
                      <Text style={styles.noMoreNotificationsText}>No more notifications to load.</Text>
                    )
                  }
                  onEndReached={fetchMoreNotifications}
                  onEndReachedThreshold={0.5}
                />
              ) : (
                <Text style={styles.noNotificationsText}>No notifications available.</Text>
              )}
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Active Rental Details Modal */}
      <Modal
        visible={activeRentalModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setActiveRentalModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "rgba(0,0,0,0.5)" }}
        >
          <View style={{ width: "90%", backgroundColor: "#fff", padding: 20, borderRadius: 10, maxHeight: '85%' }}> 
            <ModalHeader title="Active Rental Details" onClose={() => setActiveRentalModalVisible(false)} /> 
            
            {selectedListing && selectedRentalRequest ? (
              <ScrollView>
                <Text style={styles.detailValue}>Aircraft Model: {selectedListing.aircraftModel || "N/A"}</Text>
                <Text style={styles.detailValue}>Tail Number: {selectedListing.tailNumber || "N/A"}</Text>
                <Text style={styles.detailValue}>Rental Hours: {selectedRentalRequest.rentalHours || "N/A"}</Text>
                <Text style={styles.detailValue}>Rental Date: {selectedRentalRequest.rentalDate || "N/A"}</Text>
                
                <Text style={[styles.detailLabel, {marginTop: 15}]}>Cost Breakdown:</Text>
                <Text style={styles.detailValue}>Rental Cost: ${safeToFixed(totalCost.rentalCost)}</Text>
                <Text style={styles.detailValue}>Booking Fee: ${safeToFixed(totalCost.bookingFee)}</Text>
                <Text style={styles.detailValue}>Transaction Fee: ${safeToFixed(totalCost.transactionFee)}</Text>
                <Text style={styles.detailValue}>Sales Tax: ${safeToFixed(totalCost.salesTax)}</Text>
                <Text style={styles.detailTotalCostText}>Total Cost: ${safeToFixed(totalCost.total)}</Text>

                <TouchableOpacity 
                    onPress={() => {
                        setActiveRentalModalVisible(false);
                        setMessagesModalVisible(true);
                    }} 
                    style={[styles.proceedToPayButton, { marginTop: 20, backgroundColor: '#3182ce' }]}
                    accessibilityLabel="Open Chat with Owner"
                    accessibilityRole="button"
                >
                    <Text style={styles.proceedToPayButtonText}>Open Chat</Text>
                </TouchableOpacity>

              </ScrollView>
            ) : (
              <ActivityIndicator size="large" color="#3182ce" />
            )}
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* FAQ Modal */}
      <Modal
        visible={faqModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setFaqModalVisible(false)}
      >
          <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.modalContainer} >
             <View style={styles.modalContent}>
                 <ModalHeader title="FAQ" onClose={() => setFaqModalVisible(false)} />
                 <ScrollView contentContainerStyle={{paddingBottom: 20}}>
                    <Text>FAQ content goes here.</Text> 
                 </ScrollView>
                 <CustomButton onPress={() => setFaqModalVisible(false)} title="Close" backgroundColor="#3182ce" />
             </View>
          </KeyboardAvoidingView>
      </Modal>

      {/* Invest Modal */}
      <Modal
        visible={investModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setInvestModalVisible(false)}
      >
          <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", alignItems: "center", }}>
              <View style={{ width: "88%", backgroundColor: "#fff", borderRadius: 8, padding: 24, }}>
                  <ModalHeader title="Invest in Ready Set Fly?" onClose={() => setInvestModalVisible(false)} />
                  <Text style={{ marginBottom: 16 }}> Interested in investing in Ready Set Fly? Contact us at{" "} <Text style={{ color: "#3182ce", textDecorationLine: "underline" }} onPress={() => Linking.openURL( "mailto:coryarmer@gmail.com?subject=Interested%20in%20Investing%20in%20Ready,%20Set,%20Fly!" ) } > coryarmer@gmail.com </Text>{" "} for more details. </Text>
                  <CustomButton onPress={() => setInvestModalVisible(false)} title="Close" backgroundColor="#3182ce" />
              </View>
          </View>
      </Modal>

      {/* Privacy Policy Modal */}
      <Modal
        visible={privacyModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setPrivacyModalVisible(false)}
      >
           <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", alignItems: "center", }}>
              <View style={{ width: "88%", backgroundColor: "#fff", borderRadius: 8, padding: 24, maxHeight: "80%", }}>
                  <ModalHeader title="Privacy Policy & Sensitive Data Policy" onClose={() => setPrivacyModalVisible(false)} />
                  <ScrollView style={{ marginBottom: 16 }}>
                      <Text style={{ fontSize: 14, marginBottom: 8 }}> Effective Date: March 17th, 2025 </Text>
                      <Text style={{ fontSize: 14, marginBottom: 8 }}> This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our application. We are committed to protecting your personal data and ensuring your privacy. </Text>
                      <Text style={{ fontSize: 14, marginBottom: 8 }}> 1. Information We Collect: We may collect personal information, such as your name, email address, contact details, and usage data. Sensitive data is handled with strict security measures. </Text>
                      <Text style={{ fontSize: 14, marginBottom: 8 }}> 2. How We Use Your Information: Your data is used to provide and improve our services, communicate with you, and comply with legal obligations. </Text>
                      <Text style={{ fontSize: 14, marginBottom: 8 }}> 3. Data Sharing and Disclosure: We do not sell your personal data. Information may be shared with trusted partners only as necessary to perform services or as required by law. </Text>
                      <Text style={{ fontSize: 14, marginBottom: 8 }}> 4. Security: We implement a variety of security measures to maintain the safety of your personal information. </Text>
                      <Text style={{ fontSize: 14, marginBottom: 8 }}> 5. Your Rights: You have the right to access, update, or request deletion of your personal information. Please contact us to exercise these rights. </Text>
                      <Text style={{ fontSize: 14, marginBottom: 8 }}> 6. Changes to This Policy: We may update this Privacy Policy from time to time. Any changes will be posted in the application. </Text>
                  </ScrollView>
                  <CustomButton onPress={() => setPrivacyModalVisible(false)} title="Close" backgroundColor="#3182ce" accessibilityLabel="Close Privacy Policy" />
              </View>
           </View>
      </Modal>

      {/* Floating Chat Bubble Icon */}
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

// -------------------
// Styles (Original styles)
// -------------------
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
  headerWrapper: {
    width: "100%",
    overflow: "hidden",
  },
  headerImage: {
    width: "100%",
    height: 200,
  },
  headerOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.4)",
    justifyContent: "flex-start",
  },
  headerContent: {
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    position: "absolute",
    top: 20,
    left: 16,
    right: 16,
  },
  headerTopRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  headerTextContainer: {
    justifyContent: "center",
    alignItems: "flex-start",
  },
  welcomeText: {
    color: "#fff",
    fontSize: 18,
  },
  userNameText: {
    color: "#fff",
    fontSize: 24,
    fontWeight: "bold",
  },
  profileImageButton: {
    padding: 4,
  },
  profileImage: {
    width: 80,
    height: 80,
    borderRadius: 40,
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
  rentalBox: {
    backgroundColor: "#fff",
    padding: 16,
    borderRadius: 8,
    marginBottom: 8,
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
    marginRight: 10,
    width: 200,
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
  noNotificationsText: {
    textAlign: "center",
    color: "#a0aec0",
    marginVertical: 16,
    padding: 10,
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
    backgroundColor: "#edf2f7",
  },
  viewAllNotificationsButtonText: {
    color: "#3182ce",
    fontSize: 16,
    fontWeight: "bold",
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
    paddingTop: Platform.OS === "android" ? StatusBar.currentHeight + 5 : 45,
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
    textAlign: "center",
  },
  notificationDetailBox: {
    marginBottom: 12,
    paddingHorizontal: 16,
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
    color: "#2F855A",
    marginTop: 8,
  },
  proceedToPayButton: {
    backgroundColor: "#38a169",
    paddingVertical: 15,
    paddingHorizontal: 30,
    borderRadius: 8,
    alignItems: "center",
    marginTop: 16,
    marginHorizontal: 16,
  },
  payButtonDisabled: {
    backgroundColor: "#ccc",
  },
  proceedToPayButtonText: {
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
    marginHorizontal: 16,
  },
  closeNotificationModalButtonText: {
    color: "#2d3748",
    fontSize: 16,
    fontWeight: "bold",
  },
  allNotificationsModalContainer: {
    width: "90%",
    maxHeight: "85%",
    backgroundColor: "#fff",
    borderRadius: 10,
    padding: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
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
  favoriteCard: {
    width: 120,
    backgroundColor: "#fff",
    borderRadius: 8,
    overflow: "hidden",
    elevation: 3,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    position: "relative",
  },
  favoriteRemoveButton: {
    position: "absolute",
    top: 2,
    right: 2,
    zIndex: 2,
  },
  favoriteImage: {
    width: "100%",
    height: 80,
  },
  favoriteInfo: {
    padding: 6,
  },
  favoriteTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#2D3748",
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
    elevation: 5,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalContent: {
    backgroundColor: "#fff",
    marginHorizontal: 16,
    marginVertical: 50,
    borderRadius: 10,
    padding: 20,
    width: "90%",
    maxHeight: "85%",
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: "bold",
    marginBottom: 20,
    textAlign: "center",
  },
  profileImageUpload: {
    alignItems: "center",
    marginBottom: 20,
  },
  profileImagePreview: {
    width: 100,
    height: 100,
    borderRadius: 50,
  },
  uploadText: {
    marginTop: 8,
    fontSize: 16,
    color: "#3182ce",
  },
  modalInput: {
    width: "100%",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  uploadButton: {
    width: "100%",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 8,
    padding: 12,
    alignItems: "center",
    marginBottom: 16,
  },
  uploadButtonText: {
    color: "#2c5282",
    fontSize: 15,
    fontWeight: "500",
  },
  saveButton: {
    width: "100%",
    backgroundColor: "#38a169",
    padding: 16,
    borderRadius: 8,
    alignItems: "center",
    marginTop: 10,
  },
  saveButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
  },
});
