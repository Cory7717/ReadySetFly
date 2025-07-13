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
  SectionList,
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
  arrayUnion,
} from "firebase/firestore";

import {
  getStorage,
  ref as storageRef,
  uploadBytes,
  getDownloadURL,
} from "firebase/storage";

import { onAuthStateChanged, signOut } from "firebase/auth"; // ← added signOut

import axios from "axios"; // ← added axios

import * as ImagePicker from "expo-image-picker";
import * as DocumentPicker from "expo-document-picker";
import * as Location from "expo-location";
import { useFocusEffect } from "@react-navigation/native";

import {
  Ionicons,
  Octicons,
  MaterialCommunityIcons,
  Fontisto,
} from "@expo/vector-icons";
import { MaterialIcons } from "@expo/vector-icons";

import { useRouter, useLocalSearchParams, useNavigation } from "expo-router"; // Added useNavigation

import ConfirmationScreen from "../payment/ConfirmationScreen";
import MessagesScreen from "../screens/MessagesScreen";

import * as Notifications from "expo-notifications";
import AsyncStorage from "@react-native-async-storage/async-storage";

const API_URL =
  "https://us-central1-ready-set-fly-71506.cloudfunctions.net/api";

import { db, auth } from "../../firebaseConfig";

const storage = getStorage();
// helper to upload a local file URI → Storage → getDownloadURL
async function uploadFileAsync(uri, path) {
  // download file as blob
  const resp = await fetch(uri);
  const blob = await resp.blob();
  // upload to storage
  const ref = storageRef(storage, path);
  await uploadBytes(ref, blob);
  // get a public URL
  return getDownloadURL(ref);
}

const ParticipantName = ({ participantId }) => {
  const [name, setName] = useState("");

  useEffect(() => {
    if (!participantId) {
      setName("Unknown");
      return;
    }
    const fetchName = async () => {
      try {
        const userDocRef = doc(db, "users", participantId);
        const userDocSnap = await getDoc(userDocRef);
        if (userDocSnap.exists()) {
          const userData = userDocSnap.data();
          if (userData.firstName && userData.lastName) {
            setName(`${userData.firstName} ${userData.lastName}`);
          } else {
            setName(userData.fullName || participantId);
          }
        } else {
          setName(participantId);
        }
      } catch (error) {
        console.error("Error fetching participant name:", error);
        setName(participantId);
      }
    };

    fetchName();
  }, [participantId]);

  return <Text>{name}</Text>;
};

/**
 * Safely format a Firestore timestamp or JS Date
 */
function renterTimeStamp(ts) {
  if (!ts) return "--";
  // Firestore Timestamp
  if (typeof ts.toDate === "function") {
    return ts.toDate().toLocaleString();
  }
  // plain JS Date
  if (ts instanceof Date) {
    return ts.toLocaleString();
  }
  // anything else
  return new Date(ts).toLocaleString();
}

const ParticipantDate = ({ participantId }) => {
  const [date, setDate] = useState(null);

  useEffect(() => {
    if (!participantId) return;
    const fetchDate = async () => {
      try {
        const userDocRef = doc(db, "users", participantId);
        const userDocSnap = await getDoc(userDocRef);
        if (userDocSnap.exists()) {
          const userData = userDocSnap.data();
          // Assuming a Firestore timestamp is stored in createdAt
          if (userData.createdAt && userData.createdAt.toDate) {
            setDate(userData.createdAt.toDate());
          }
        }
      } catch (error) {
        console.error("Error fetching participant date:", error);
      }
    };
    fetchDate();
  }, [participantId]);

  return date ? (
    <Text style={{ fontSize: 12, color: "#718096" }}>
      {date.toLocaleDateString()}
    </Text>
  ) : null;
};

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
// const ModalHeader = ({ title, onClose }) => (
//   <View
//     style={{
//       flexDirection: "row",
//       justifyContent: "space-between",
//       alignItems: "center",
//       marginBottom: 16,
//     }}
//   >
//     <Text style={{ fontSize: 20, fontWeight: "bold" }}>{title}</Text>
//     <TouchableOpacity
//       onPress={onClose}
//       style={{ padding: 8 }}
//       accessibilityLabel="Close modal"
//       accessibilityRole="button"
//     >
//       <Ionicons name="close" size={24} color="#2d3748" />
//     </TouchableOpacity>
//   </View>
// );

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

// Replace your existing ModalHeader with this drop-in version:
const ModalHeader = ({ title, onClose, children }) => (
  <View style={styles.modalHeader}>
    <Text style={styles.modalHeaderTitle}>{title}</Text>
    <View style={{ flexDirection: "row", alignItems: "center" }}>
      {children}
      <TouchableOpacity onPress={onClose} style={styles.modalHeaderClose}>
        <Ionicons name="close" size={24} color="#2d3748" />
      </TouchableOpacity>
    </View>
  </View>
);

const ChatMessage = ({ message, isOwn }) => (
  <View
    style={[
      styles.chatBubble,
      isOwn ? styles.chatBubbleRight : styles.chatBubbleLeft,
    ]}
  >
    <Text style={styles.chatSenderName}>{message.senderName}</Text>
    <Text style={styles.chatMessageText}>{message.text}</Text>
    <Text style={styles.chatTimestamp}>
      {renterTimeStamp(message.timestamp ?? message.createdAt)}
    </Text>
  </View>
);

// ---- START OF RENTER COMPONENT ----
const renter = () => {
  const router = useRouter();
  const params = useLocalSearchParams(); // Access search params (e.g., autoOpenChat)
  const navigation = useNavigation(); // Get navigation object
  const flatListRef = useRef(null);

  // At the top of your renter component, add:
  const [chatFailed, setChatFailed] = useState(false);
  const [chatFailSafeModalVisible, setChatFailSafeModalVisible] =
    useState(false);
  const [ownerEmail, setOwnerEmail] = useState(null);
  // after all your other useState calls
  const [termsAgreed, setTermsAgreed] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const saved = await AsyncStorage.getItem("termsAgreed");
        if (saved === "true") {
          setTermsAgreed(true);
        }
      } catch (e) {
        console.warn("↪️ failed to load termsAgreed", e);
      }
    })();
  }, []);

  useEffect(() => {
    if (chatFailed && paymentComplete) {
      setChatFailSafeModalVisible(true);
    }
  }, [chatFailed, paymentComplete]);
  

  // New state to track if the payment flow has already been handled (Original)
  const [paymentHandled, setPaymentHandled] = useState(false);

  // *** NEW STATE FOR POST-PAYMENT FLOW ***
  const [processingPaymentSuccess, setProcessingPaymentSuccess] =
    useState(null);

  // NEW STATE for Past Rental Modal details
  const [pastRentalModalVisible, setPastRentalModalVisible] = useState(false);
  const [selectedPastRental, setSelectedPastRental] = useState(null);

  // NEW: Function to close Past Rental Modal and reset its state
  const closePastRentalModal = () => {
    setPastRentalModalVisible(false);
    setSelectedPastRental(null);
  };

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
  const [rentalCostEstimatorModalVisible, setRentalCostEstimatorModalVisible] =
    useState(false);
  const [messagesModalVisible, setMessagesModalVisible] = useState(false);
  const [notificationModalVisible, setNotificationModalVisible] =
    useState(false);
  const [allNotificationsModalVisible, setAllNotificationsModalVisible] =
    useState(false);
  const [faqModalVisible, setFaqModalVisible] = useState(false);
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
  const [selectedChatThreadId, setSelectedChatThreadId] = useState(null);
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

  // Utility to format just the date part
  const formatDate = (ts) => {
    let d;
    if (!ts) return "";
    // Firestore Timestamp with toDate()
    if (typeof ts.toDate === "function") {
      d = ts.toDate();
    }
    // plain JS Date
    else if (ts instanceof Date) {
      d = ts;
    }
    // Firestore-like object { seconds, nanoseconds }
    else if (ts.seconds != null) {
      d = new Date(ts.seconds * 1000 + Math.floor(ts.nanoseconds / 1e6));
    }
    // fallback
    else {
      d = new Date(ts);
    }
    return d.toLocaleDateString();
  };

  const buildDisplayMessages = (msgs) => {
    const out = [];
    let lastDay = null;

    msgs.forEach((m) => {
      // pick whichever exists
      const rawTs = m.timestamp ?? m.createdAt;

      // convert to JS Date
      let dateObj;
      if (rawTs) {
        if (typeof rawTs.toDate === "function") {
          dateObj = rawTs.toDate();
        } else if (rawTs instanceof Date) {
          dateObj = rawTs;
        } else if (rawTs.seconds != null) {
          dateObj = new Date(
            rawTs.seconds * 1000 + (rawTs.nanoseconds || 0) / 1e6
          );
        } else {
          dateObj = new Date(rawTs);
        }
      } else {
        console.warn("Message missing raw timestamp:", m);
        dateObj = new Date();
      }

      // date separator (owner.js uses toLocaleDateString)
      const dayString = dateObj.toDateString();
      if (dayString !== lastDay) {
        out.push({
          type: "separator",
          date: dateObj.toLocaleDateString(),
        });
        lastDay = dayString;
      }

      // attach a normalized 'timestamp' field so ChatMessage can use it
      out.push({
        type: "message",
        ...m,
        timestamp: rawTs,
      });
    });

    return out;
  };

  const displayMessages = buildDisplayMessages(messages);
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
  const [activeRentalModalVisible, setActiveRentalModalVisible] =
    useState(false);
  const processedRentalsRef = useRef([]);
  const rentalRequestListenerRef = useRef(null);
  const [favoritesListings, setFavoritesListings] = useState([]);
  const [chatListModalVisible, setChatListModalVisible] = useState(false);
  const [chatThreads, setChatThreads] = useState([]);
  // ─── New: track number of threads with unread messages ───
  const [unreadCount, setUnreadCount] = useState(0);
  const [pendingDeletion, setPendingDeletion] = useState(null);
  const [deleteTimer, setDeleteTimer] = useState(null);

  // --- Helper Functions ---
  const fetchChatThreads = async () => {
    try {
      const messagesRef = collection(db, "messages");
      const q = query(
        messagesRef,
        where("participants", "array-contains", renterId)
      );
      const snapshot = await getDocs(q);

      // Build a map so we only keep one doc per rentalRequestId
      const threadsByRental = {};
      snapshot.docs.forEach((docSnap) => {
        const data = docSnap.data();
        const rentalId = data.rentalRequestId || "__no_rental__";
        // only keep the first thread we encounter for each rental
        if (!threadsByRental[rentalId]) {
          threadsByRental[rentalId] = { id: docSnap.id, ...data };
        }
      });

      setChatThreads(Object.values(threadsByRental));
    } catch (error) {
      console.error("Error fetching chat threads:", error);
      Alert.alert("Error", "Failed to load chat threads.");
    }
  };

  /**
   * Function to open the message modal for a specific chat thread.
   * Now also sets selectedChatThreadId and currentChatOwnerId.
   */
  /**
   * Opens (or creates) a single chat thread per rental.
   */
  const openMessageModal = async (chatThreadId = null) => {
    try {
      let threadId = chatThreadId;

      // 1) If you were passed an explicit threadId, keep it.
      if (!threadId) {
        // 2) Otherwise, reuse any thread we’ve already opened in this session…
        if (selectedChatThreadId) {
          threadId = selectedChatThreadId;
        } else {
          // 3) No open thread yet → try to find one by rentalRequestId
          const rentalId = selectedRentalRequest?.id;
          if (!rentalId || !currentChatOwnerId) {
            Alert.alert(
              "Error",
              "Cannot open chat: missing rental or owner information."
            );
            return;
          }

          // Query for an existing thread for this rental
          const existingQuery = query(
            collection(db, "messages"),
            where("rentalRequestId", "==", rentalId),
            where("participants", "array-contains", renterId),
            limit(1)
          );
          const existingSnap = await getDocs(existingQuery);

          if (!existingSnap.empty) {
            // Reuse the first matching thread
            threadId = existingSnap.docs[0].id;
          } else {
            // No thread exists yet → create a new one
            const newThread = {
              participants: [renterId, currentChatOwnerId],
              rentalRequestId: rentalId,
              messages: [],
              createdAt: serverTimestamp(),
            };
            const chatDocRef = await addDoc(
              collection(db, "messages"),
              newThread
            );
            threadId = chatDocRef.id;
          }
        }
      }

      // 4) Save and load
      setSelectedChatThreadId(threadId);
      const chatDocRef = doc(db, "messages", threadId);
      const chatDoc = await getDoc(chatDocRef);
      if (!chatDoc.exists()) {
        Alert.alert("Error", "Chat thread not found.");
        return;
      }
      setMessages(chatDoc.data().messages || []);
      setMessagesModalVisible(true);
    } catch (err) {
      console.error("Error opening message modal:", err);
      Alert.alert("Error", "Failed to open chat.");
    }
  };

  const sendPaymentNotificationToOwner = async (rentalRequestId, ownerId) => {
    try {
      // 1) Find or create the shared chat thread
      let chatThreadId = selectedChatThreadId;

      if (!chatThreadId) {
        const threadsRef = collection(db, "messages");
        // look for any thread where this renter is a participant
        const q = query(
          threadsRef,
          where("participants", "array-contains", renterId)
        );
        const snap = await getDocs(q);

        // try to find one that also contains the owner and matches the rentalRequestId
        const existing = snap.docs.find((docSnap) => {
          const data = docSnap.data();
          return (
            data.participants.includes(renterId) &&
            data.participants.includes(ownerId) &&
            data.rentalRequestId === rentalRequestId
          );
        });

        if (existing) {
          chatThreadId = existing.id;
        } else {
          // no existing thread — create a new one
          const newThread = {
            participants: [renterId, ownerId],
            rentalRequestId,
            messages: [],
            createdAt: serverTimestamp(),
          };
          const docRef = await addDoc(threadsRef, newThread);
          chatThreadId = docRef.id;
        }

        // keep it in state for future calls
        setSelectedChatThreadId(chatThreadId);
      }

      // 2) Send the “payment completed” system message
      const paymentMessage = {
        senderId: renterId,
        senderName: renter?.displayName || "Renter",
        text: "Payment completed for rental. Let’s chat!",
        timestamp: serverTimestamp(),
        recipients: [ownerId],
      };

      const threadDocRef = doc(db, "messages", chatThreadId);
      await updateDoc(threadDocRef, {
        messages: arrayUnion(paymentMessage),
      });

      console.log(
        "Payment notification sent to owner in chat thread:",
        chatThreadId
      );
    } catch (error) {
      console.error("Error sending payment notification message:", error);
    }
  };
  // Function to handle deletion with an undo option
  const handleDeleteChatThread = (thread) => {
    if (deleteTimer) {
      clearTimeout(deleteTimer);
    }
    setPendingDeletion(thread);
    const timer = setTimeout(async () => {
      try {
        await deleteDoc(doc(db, "messages", thread.id));
      } catch (error) {
        console.error("Error deleting chat thread:", error);
        Alert.alert("Error", "Failed to delete chat thread.");
      }
      setPendingDeletion(null);
      setDeleteTimer(null);
    }, 10000);
    setDeleteTimer(timer);
  };

  // Function to undo the deletion
  const handleUndoDelete = () => {
    if (deleteTimer) {
      clearTimeout(deleteTimer);
      setDeleteTimer(null);
    }
    setPendingDeletion(null);
  };

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
        if (!listingData.ownerId) {
          console.warn(
            `Listing ID: ${listingId} is missing 'ownerId'. Cannot process.`
          );
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
    setActiveRentalModalVisible(false);
    setMessagesModalVisible(false);
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

  // (Original calculateTotalCost function - unchanged)
  const calculateTotalCost = (rentalCostPerHour, rentalHours) => {
    if (isNaN(rentalCostPerHour) || isNaN(rentalHours) || rentalHours <= 0) {
      console.warn(
        "Invalid input for calculateTotalCost",
        rentalCostPerHour,
        rentalHours
      );
      return {
        rentalCost: "0.00",
        bookingFee: "0.00",
        transactionFee: "0.00",
        salesTax: "0.00",
        total: "0.00",
      };
    }
    const rentalTotalCost = rentalCostPerHour * rentalHours;
    const bookingFee = rentalTotalCost * 0.06;
    const transactionFee = rentalTotalCost * 0.03;
    const salesTax = rentalTotalCost * 0.0825;
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
  // *** MODIFIED: useEffect to Handle Post-Payment Navigation ***
  // -------------------------
  // *** NEW: useEffect to Handle Post-Payment Navigation & Auto‑Open Chat ***
  useEffect(() => {
    if (
      params?.paymentSuccessFor &&
      params.paymentSuccessFor !== processingPaymentSuccess
    ) {
      const rentalId = params.paymentSuccessFor;
      const ownerIdForChat = params.ownerId;

      console.log(`Handling payment success for rental: ${rentalId}`);
      setProcessingPaymentSuccess(rentalId);

      // 1) Mark the rentalRequest “active” in Firestore
      (async () => {
        try {
          const rentalRef = doc(db, "rentalRequests", rentalId);
          await updateDoc(rentalRef, { rentalStatus: "active" });
          console.log("Rental status updated to active");
        } catch (err) {
          console.error("Error updating rental status:", err);
        }
      })();

      // 2) Notify renter, then open chat once they tap “OK”
      Alert.alert("Payment Successful!", "Your rental is now active.", [
        {
          text: "OK",
          onPress: async () => {
            setIsProcessingPayment(false);
            // a) send the “payment completed” system message into the chat thread
            await sendPaymentNotificationToOwner(rentalId, ownerIdForChat);
            // b) close any open modals
            closeAllOpenModals();
            // c) set the current owner so chat knows where to point
            setCurrentChatOwnerId(ownerIdForChat);
            // d) actually open the in‑app chat modal (will create/reuse the thread)
            openMessageModal();
            // e) clear URL params so this effect won’t re‑fire
            router.replace({ pathname: "/renter" });
          },
        },
      ]);
    }

    // cleanup: reset our local “handled” flag if params change
    return () => {
      if (params?.paymentSuccessFor !== processingPaymentSuccess) {
        setProcessingPaymentSuccess(null);
      }
    };
  }, [params, processingPaymentSuccess]);

  // -------------------------
  // Fetch Profile on Mount (Original - unchanged, reads from 'users')
  // -------------------------
  useEffect(() => {
    if (renterId && !profileData.firstName) {
      (async () => {
        try {
          const profileDocRef = doc(db, "users", renterId);
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

        rentalRequestsSnapshot.docs.forEach((docSnap) => {
          const data = docSnap.data();
          const updates = {};

          [
            "rentalCost",
            "bookingFee",
            "transactionFee",
            "salesTax",
            "totalCost",
          ].forEach((field) => {
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

  useEffect(() => {
    if (!renterId) return;

    (async () => {
      const { status: existing } = await Notifications.getPermissionsAsync();
      let finalStatus = existing;
      if (existing !== "granted") {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }
      if (finalStatus !== "granted") {
        Alert.alert(
          "Permission required",
          "Push notifications won’t work without permission."
        );
        return;
      }

      const { data: token } = await Notifications.getExpoPushTokenAsync();
      // Merge it into your user record
      await setDoc(
        doc(db, "users", renterId),
        { expoPushToken: token },
        { merge: true }
      );
    })();
  }, [renterId]);

  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        const { rentalRequestId } =
          response.notification.request.content.data || {};
        if (rentalRequestId) {
          router.push({
            pathname: "/payment/CheckoutScreen",
            params: { rentalRequestId },
          });
        }
      }
    );
    return () => sub.remove();
  }, []);

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
              data.rentalStatus === "approved"
                ? "Rental Approved"
                : "Rental Denied";

            const body =
              data.rentalStatus === "approved"
                ? "Your rental request has been approved. Tap to pay now."
                : "Your rental request has been denied.";

            try {
              await Notifications.scheduleNotificationAsync({
                content: {
                  title,
                  body,
                  data: { rentalRequestId: docSnap.id },
                },
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
            const notificationsRef = collection(
              db,
              "renters",
              renterId,
              "notifications"
            );
            const notifQuery = query(
              notificationsRef,
              where("rentalRequestId", "==", rentalId)
            );
            const notifSnapshot = await getDocs(notifQuery);

            notifSnapshot.docs.forEach(async (notifDoc) => {
              await deleteDoc(notifDoc.ref);
            });

            // Update local state
            setNotifications((prev) =>
              prev.filter((n) => n.rentalRequestId !== rentalId)
            );
            setAllNotifications((prev) =>
              prev.filter((n) => n.rentalRequestId !== rentalId)
            );
          } catch (error) {
            console.error(
              "Error cleaning up notifications for active rental:",
              error
            );
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
              const ownerDocRef = doc(db, "users", requestData.ownerId);
              const ownerDoc = await getDoc(ownerDocRef);
              if (ownerDoc.exists()) {
                ownerName =
                  ownerDoc.data().fullName ||
                  ownerDoc.data().displayName ||
                  "N/A";
              } else {
                console.warn(
                  `Owner user doc not found for ${requestData.ownerId}`
                );
              }
            } catch (error) {
              console.error("Error fetching owner details:", error);
            }
          }

          // ** Fetch and attach listing details **
          const listingDetails = await fetchListingDetails(
            requestData.listingId
          );

          active.push({
            id: docSnap.id,
            ...requestData,
            ownerName, // Add owner name
            listingDetails: listingDetails, // Attach the fetched listing data
            aircraftModel: listingDetails?.aircraftModel || "N/A", // Convenience field
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
        setHasMoreNotifications(
          snapshot.docs.length === NOTIFICATIONS_PAGE_SIZE
        ); // Update hasMoreNotifications flag
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
  const navigateToCheckout = async (
    rentalRequestId,
    costPerHour,
    rentalHours,
    ownerIdParam
  ) => {
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
    if (!ownerIdParam) {
      setIsProcessingPayment(false);
      Alert.alert("Error", "Owner information missing for payment.");
      console.error(
        "Missing ownerId when navigating to checkout for rental:",
        rentalRequestId
      );
      return;
    }

    try {
      console.log(
        `Navigating to CheckoutScreen with Rental Request ID: ${rentalRequestId}`
      );
      console.log(
        `Cost Per Hour: ${costPerHour}, Rental Hours: ${rentalHours}, Owner ID: ${ownerIdParam}`
      );

      router.push({
        pathname: "/payment/CheckoutScreen",
        params: {
          rentalRequestId,
          costPerHour,
          rentalHours,
          ownerId: ownerIdParam,
        },
      });
    } catch (error) {
      console.error("Error navigating to CheckoutScreen:", error);
      Alert.alert("Error", "Failed to navigate to payment screen.");
      setIsProcessingPayment(false);
    }
  };

  // -------------------------
  // Handling Notification Press (Original - slightly adapted for clarity and ownerId)
  // -------------------------
  const handleNotificationPress = async (notification) => {
    try {
      if (!notification) throw new Error("Notification object is undefined.");
      const rentalRequestId =
        notification.rentalRequestId || notification.rentalRequest;

      if (rentalRequestId) {
        console.log("Notification has rentalRequestId:", rentalRequestId);
        setIsRentalRequestLoading(true);
        setPaymentComplete(false);

        const rentalRequestRef = doc(db, "rentalRequests", rentalRequestId);
        if (rentalRequestListenerRef.current) {
          rentalRequestListenerRef.current();
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

        setCurrentChatOwnerId(rentalRequestData.ownerId);

        setPaymentComplete(
          rentalRequestData.paymentStatus === "succeeded" ||
            rentalRequestData.rentalStatus === "active"
        );

        let ownerName = "N/A";
        if (rentalRequestData.ownerId) {
          try {
            const ownerDocRef = doc(db, "users", rentalRequestData.ownerId);
            const ownerDoc = await getDoc(ownerDocRef);
            if (ownerDoc.exists()) {
              ownerName = ownerDoc.data().fullName || "N/A";
              setOwnerEmail(ownerDoc.data().email || null); // Set owner email if available
            }
          } catch (e) {
            console.error("Error fetching owner details:", e);
          }
        }

        const updatedRentalRequestData = { ...rentalRequestData, ownerName };
        setSelectedRentalRequest(updatedRentalRequestData);

        const listingData = await fetchListingDetails(
          rentalRequestData.listingId
        );
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

        const computedTotalCost = calculateTotalCost(
          rentalCostPerHourVal,
          rentalHoursVal
        );
        setTotalCost(computedTotalCost);

        rentalRequestListenerRef.current = onSnapshot(
          rentalRequestRef,
          (docSnap) => {
            if (docSnap.exists()) {
              const data = docSnap.data();
              setSelectedRentalRequest((prev) => ({ ...prev, ...data }));
              setPaymentComplete(
                data.paymentStatus === "succeeded" ||
                  data.rentalStatus === "active"
              );
            } else {
              console.warn(
                `Rental request ${rentalRequestId} deleted while modal open.`
              );
              closeModal();
              Alert.alert(
                "Request Deleted",
                "This rental request is no longer available."
              );
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
        console.log(
          "Notification pressed without rentalRequestId:",
          notification
        );
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

      const listingData = await fetchListingDetails(
        rentalRequestData.listingId
      );
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

      const computedTotalCost = calculateTotalCost(
        rentalCostPerHourVal,
        rentalHoursVal
      );
      setTotalCost(computedTotalCost);

      setCurrentChatOwnerId(rentalRequestData.ownerId);

      setActiveRentalModalVisible(true);
      setIsRentalRequestLoading(false);
    } catch (error) {
      console.error("Error handling active rental press:", error);
      Alert.alert("Error", `Failed to load rental details: ${error.message}`);
      setIsRentalRequestLoading(false);
    }
  };

  // -------------------------
  // Handle Past Rental Press (Modified to open a full-screen modal with listing and payment details)
  // -------------------------
  const handlePastRentalPress = (rental) => {
    try {
      setSelectedPastRental(rental);
      setPastRentalModalVisible(true);
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
      <Text style={styles.rentalStatus}>
        {item.rentalStatus === "active"
          ? "Active"
          : "Approved - Payment Pending"}
      </Text>
      <Text style={styles.rentalTotalCost}>
        Total Cost: ${safeToFixed(item.totalCost)}
      </Text>
    </TouchableOpacity>
  );

  const renderPastRentalItem = ({ item }) => (
    <TouchableOpacity
      style={styles.rentalBox}
      onPress={() => handlePastRentalPress(item)}
      accessibilityLabel={`Access past rental: ${
        item.listing?.aircraftModel || "Listing"
      }`}
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
          if (
            typeof data.rentalDate === "string" &&
            data.rentalDate.includes("/")
          ) {
            const parts = data.rentalDate.split("/");
            let year = parts[2];
            if (year.length === 2) year = "20" + year;
            rentalDateObj = new Date(
              year,
              parseInt(parts[0]) - 1,
              parseInt(parts[1])
            );
          } else if (
            typeof data.rentalDate === "string" &&
            data.rentalDate.includes("-")
          ) {
            rentalDateObj = new Date(data.rentalDate);
          } else if (data.rentalDate.toDate) {
            rentalDateObj = data.rentalDate.toDate();
          } else {
            console.warn(
              `Unrecognized rentalDate format for ${docSnap.id}:`,
              data.rentalDate
            );
            return;
          }

          rentalDateObj.setHours(23, 59, 59, 999);

          if (now > rentalDateObj) {
            batch.update(docSnap.ref, { rentalStatus: "completed" });
            console.log(
              `Scheduling rental ${docSnap.id} to be marked as completed.`
            );
            needsCommit = true;
          }
        }
      });

      if (needsCommit) {
        batch
          .commit()
          .catch((error) =>
            console.error("Error batch updating rental status:", error)
          );
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
      setTotalCost({
        rentalCost: "0.00",
        bookingFee: "0.00",
        transactionFee: "0.00",
        salesTax: "0.00",
        total: "0.00",
      });
      setPaymentComplete(false);
    }
    if (rentalRequestListenerRef.current) {
      rentalRequestListenerRef.current();
      rentalRequestListenerRef.current = null;
    }
  }, [selectedNotification, selectedRentalRequest]);

  const handleDeniedNotificationClose = async () => {
    if (!selectedNotification || !renterId) return;
    try {
      // Delete the denied notification from the renter's notifications collection
      await deleteDoc(
        doc(db, "renters", renterId, "notifications", selectedNotification.id)
      );
      // Optionally update your local state here if needed.
    } catch (error) {
      console.error("Error deleting denied notification:", error);
    }
    closeModal();
  };

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
              const notificationsRef = collection(
                db,
                "renters",
                renterId,
                "notifications"
              );
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
    const formattedDate = `${
      date.getMonth() + 1
    }/${date.getDate()}/${date.getFullYear()}`;
    setRentalDate(formattedDate);
    hideDatePicker();
  };

  // -------------------------
  // Messaging (Original - unchanged except for reverting status check)
  // -------------------------
  const sendMessage = async () => {
    if (!messageText.trim()) {
      Alert.alert("Validation Error", "Message cannot be empty.");
      return;
    }

    if (
      selectedRentalRequest &&
      selectedRentalRequest.rentalStatus === "completed"
    ) {
      Alert.alert(
        "Chat Disabled",
        "Chatting about a completed rental is no longer available."
      );
      return;
    }

    if (!selectedChatThreadId || !currentChatOwnerId) {
      Alert.alert("Error", "Cannot send message: missing chat context.");
      return;
    }

    try {
      const threadRef = doc(db, "messages", selectedChatThreadId);
      const newMsg = {
        senderId: renterId,
        senderName: renter.displayName || "User",
        text: messageText.trim(),
        timestamp: new Date(),
      };

      await updateDoc(threadRef, {
        messages: arrayUnion(newMsg),
      });

      setMessageText("");
    } catch (error) {
      console.error("Error sending message:", error);
      Alert.alert("Error", "Failed to send message.");
    }
  };

  /**
   * Exact same logic as owner.js → report this chat thread to moderators
   */
  const reportSpamMessage = async (reason, comments = "") => {
    if (!selectedChatThreadId) {
      return Alert.alert(
        "No Conversation",
        "You need to have a chat open in order to report it."
      );
    }

    // 1) Fetch the thread so we can find the other participant (owner)
    let chatDoc;
    try {
      chatDoc = await getDoc(doc(db, "messages", selectedChatThreadId));
    } catch (err) {
      console.error(err);
      return Alert.alert("Error", "Could not access this chat thread.");
    }
    if (!chatDoc.exists()) {
      return Alert.alert("Error", "Could not find this chat thread.");
    }
    const data = chatDoc.data();

    // 2) Identify the owner (the one that isn’t the renter)
    const ownerId = data.participants.find((id) => id !== renterId);
    // 3) Pick a “name” for the owner (first or last sender in the thread)
    const ownerName =
      data.messages?.[0]?.senderName === renter?.displayName
        ? data.messages[data.messages.length - 1]?.senderName
        : data.messages?.[0]?.senderName || "Unknown";

    // 4) Call your Cloud Function
    try {
      const token = await renter.getIdToken();
      const payload = {
        listingId: selectedRentalRequest?.listingId || null,
        chatThreadId: selectedChatThreadId,
        renterId, // this user
        ownerId, // the other party
        ownerName,
        reason,
        comments,
      };

      await fetch(`${API_URL}/reportListing`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      Alert.alert(
        "Reported",
        "Thank you—we’ve notified the moderators with all relevant details."
      );
      setMessagesModalVisible(false);
    } catch (err) {
      console.error("Report failed", err);
      Alert.alert("Error", "Unable to send report. Please try again later.");
    }
  };

  // ─── Listen to the single thread’s messages ───
  useEffect(() => {
    if (!selectedChatThreadId) {
      setMessages([]);
      return;
    }

    const threadRef = doc(db, "messages", selectedChatThreadId);
    const unsubscribe = onSnapshot(
      threadRef,
      (snap) => {
        setMessages(snap.exists() ? snap.data().messages || [] : []);
      },
      (err) => {
        console.error("Error listening to chat thread:", err);
        Alert.alert("Error", "Lost connection to chat.");
      }
    );

    return () => unsubscribe();
  }, [selectedChatThreadId]);

  // ─── New: subscribe to all chat threads to compute unread count ───
  useEffect(() => {
    if (!renterId) return;
    const messagesRef = collection(db, "messages");
    const q = query(
      messagesRef,
      where("participants", "array-contains", renterId)
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      let count = 0;
      snapshot.docs.forEach((docSnap) => {
        const data = docSnap.data();
        const msgs = data.messages || [];
        if (msgs.length) {
          const lastMsg = msgs[msgs.length - 1];
          if (lastMsg.senderId !== renterId) count += 1;
        }
      });
      setUnreadCount(count);
    });
    return () => unsubscribe();
  }, [renterId]);

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

  const handleDocument = async (field) => {
    try {
      const existingUri = profileData[field];

      if (existingUri) {
        // —— OPEN existing document ——
        // works for both http(s) URLs or local file:// URIs
        await Linking.openURL(existingUri);
        return;
      }

      // —— PICK new document ——
      const result = await DocumentPicker.getDocumentAsync({
        type: ["application/pdf", "image/*"],
      });

      if (result.type === "success") {
        // uploadFileAsync is your Firebase-storage helper from earlier
        const localUri = result.uri;
        const fileName = localUri.split("/").pop();
        const storagePath = `users/${renterId}/${field}/${fileName}`;
        const downloadUrl = await uploadFileAsync(localUri, storagePath);

        setProfileData((prev) => ({
          ...prev,
          [field]: downloadUrl,
        }));
      }
    } catch (err) {
      console.error("Doc pick/open error", err);
      Alert.alert(
        "Oops",
        "We couldn’t open or upload that file. Please try again."
      );
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
  const handleProfileSubmit = async (values) => {
    try {
      // write only the changed profile fields back to Firestore
      const userRef = doc(db, "users", renterId);
      await updateDoc(userRef, {
        firstName: values.firstName,
        lastName: values.lastName,
        image: values.image,
        insurance: values.insurance,
        pilotLicense: values.pilotLicense,
        medical: values.medical,
        aircraftType: values.aircraftType,
        certifications: values.certifications,
      });

      // update local state and close modal
      setProfileData(values);
      setProfileModalVisible(false);
    } catch (err) {
      console.error("Error saving profile:", err);
      Alert.alert("Error", "Couldn’t save your profile—please try again.");
    }
  };

  const handleDeleteAccount = async () => {
    try {
      // 1) Get fresh ID token
      const user = auth.currentUser;
      if (!user) throw new Error("No authenticated user");

      const idToken = await user.getIdToken();

      // 2) Call your backend to delete both Firestore user doc and Auth account
      await axios.delete(`${API_URL}/deleteAccount`, {
        headers: {
          Authorization: `Bearer ${idToken}`,
        },
      });

      // 3) Actually sign out locally
      await signOut(auth);

      // 4) Navigate back to your sign-in or onboarding flow
      // (useRouter hook from expo-router)
      router.replace("/sign-in");
    } catch (error) {
      console.error("Delete account failed:", error);
      Alert.alert(
        "Error",
        error.response?.data?.error ||
          error.message ||
          "Could not delete account. Please try again."
      );
    }
  };

  // -------------------------
  // Location (Original - unchanged)
  // -------------------------
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
  // useEffect(() => {
  //   if (currentChatOwnerId && renterId) {
  //     const messagesRef = collection(db, "messages");
  //     const messagesQueryInstance = query(
  //       messagesRef,
  //       where("participants", "array-contains", renterId),
  //       orderBy("timestamp", "asc")
  //     );

  //     const unsubscribe = onSnapshot(
  //       messagesQueryInstance,
  //       (snapshot) => {
  //         const fetchedMessages = [];
  //         snapshot.docs.forEach((docSnap) => {
  //           const messageData = docSnap.data();
  //           if (
  //             messageData.participants &&
  //             messageData.participants.includes(renterId) &&
  //             messageData.participants.includes(currentChatOwnerId)
  //           ) {
  //             fetchedMessages.push({ id: docSnap.id, ...messageData });
  //           }
  //         });
  //         setMessages(fetchedMessages);
  //       },
  //       (error) => {
  //         console.error("Error fetching messages:", error);
  //         Alert.alert("Error", "Failed to fetch messages.");
  //       }
  //     );

  //     return () => unsubscribe();
  //   } else {
  //     setMessages([]);
  //   }
  // }, [currentChatOwnerId, renterId]);

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
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => {}} />
          }
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
                      {/*
    Show the auth‐user’s displayName first when they chose “Both”,
    otherwise fall back to their first/last name from profileData,
    then finally to displayName or "User" if nothing else exists.
  */}
                      {profileData.profileType === "both"
                        ? renter?.displayName || "User"
                        : profileData.firstName
                        ? `${profileData.firstName} ${profileData.lastName}`
                        : renter?.displayName || "User"}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            </ImageBackground>
          </View>

          {/* New Centered Large Text */}
          <View>
            <Text style={styles.renterLoungeText}>Renter's Lounge</Text>
          </View>

          {/* Navigation Buttons */}
          <View style={styles.navigationButtonsContainer}>
            <TouchableOpacity
              style={styles.navigationButton}
              onPress={() => setFaqModalVisible(true)}
              accessibilityLabel={
                termsAgreed ? "Agreed" : "Important Information"
              }
              accessibilityRole="button"
            >
              <Ionicons
                name={termsAgreed ? "checkmark-circle" : "alert-circle-outline"}
                size={32}
                color={termsAgreed ? "#38A169" : "#e53e3e"}
              />
              <Text style={{ color: termsAgreed ? "#38A169" : "#000" }}>
                {termsAgreed ? "Agreed" : "Important"}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.navigationButton}
              onPress={fetchUserProfile}
              accessibilityLabel="Edit profile"
              accessibilityRole="button"
            >
              <Ionicons
                name="person-circle-outline"
                size={32}
                color="#3182ce"
              />
              <Text>Profile</Text>
            </TouchableOpacity>
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
              <Text style={styles.noActiveRentalsText}>
                No past rentals available.
              </Text>
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
            {rentals.filter((r) => r.rentalStatus === "active").length > 0 ? (
              <>
                <FlatList
                  data={rentals.filter((r) => r.rentalStatus === "active")}
                  keyExtractor={(item, index) => `${item.id}_${index}`}
                  renderItem={renderRentalItem}
                  scrollEnabled={false}
                />
                {paymentComplete &&
                  rentals.some((r) => {
                    if (r.rentalDate) {
                      let rentalDateObj;
                      if (typeof r.rentalDate === "string") {
                        rentalDateObj = new Date(r.rentalDate);
                      } else if (r.rentalDate.toDate) {
                        rentalDateObj = r.rentalDate.toDate();
                      } else {
                        rentalDateObj = new Date(r.rentalDate);
                      }
                      return rentalDateObj >= new Date();
                    }
                    return false;
                  }) && (
                    <CustomButton
                      onPress={() => setChatFailSafeModalVisible(true)}
                      title="Email Owner"
                      backgroundColor="#3182ce"
                    />
                  )}
              </>
            ) : (
              <Text style={styles.noActiveRentalsText}>
                No active rentals at the moment.
              </Text>
            )}
          </View>

          {/* Notifications Section */}
          <View style={styles.sectionContainer}>
            <Text style={styles.sectionTitle}>Notifications</Text>
            {notifications.filter(
              (n) =>
                !rentals.some(
                  (r) =>
                    r.id === n.rentalRequestId && r.rentalStatus === "active"
                )
            ).length > 0 ? (
              <FlatList
                data={notifications
                  .filter(
                    (n) =>
                      !rentals.some(
                        (r) =>
                          r.id === n.rentalRequestId &&
                          r.rentalStatus === "active"
                      )
                  )
                  .slice(0, 3)}
                keyExtractor={(item, index) => `${item.id}_${index}`}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={styles.notificationBox}
                    onPress={() => {
                      handleNotificationPress(item);
                    }}
                    accessibilityLabel={`View details for notification: ${
                      typeof item.message === "string"
                        ? item.message
                        : JSON.stringify(item.message)
                    }`}
                    accessibilityRole="button"
                  >
                    <Text style={styles.notificationMessageText}>
                      {typeof item.message === "string"
                        ? item.message
                        : JSON.stringify(item.message)}
                    </Text>
                    <Text style={styles.notificationDateText}>
                      {item.createdAt?.toDate
                        ? item.createdAt.toDate().toLocaleString()
                        : "N/A"}
                    </Text>
                  </TouchableOpacity>
                )}
                scrollEnabled={false}
              />
            ) : (
              <Text style={styles.noNotificationsText}>
                No new notifications.
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
      {/* {profileSaved && renterId && (
        <View style={styles.profileContainer}>
          <Text style={styles.profileTitle}>Profile Information</Text>
          <View style={styles.profileRow}>
            <Text style={styles.profileLabel}>Name:</Text>
            <Text style={styles.profileValue}>
              {profileData.firstName} {profileData.lastName}
            </Text>
          </View>
          {profileData.image && (
            <Image
              source={{ uri: profileData.image }}
              style={styles.profileImage}
            />
          )}
        </View>
      )} */}

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
          <View style={styles.profileModalWrapper}>
            <ScrollView
              style={styles.profileModalScroll}
              contentContainerStyle={styles.profileModalContent}
            >
              <Text style={styles.modalTitle}>Edit Profile</Text>

              <TouchableOpacity
                onPress={pickImage}
                style={styles.profileImageUpload}
                accessibilityLabel="Upload profile image"
                accessibilityRole="button"
              >
                {profileData.image ? (
                  <Image
                    source={{ uri: profileData.image }}
                    style={styles.profileImagePreview}
                  />
                ) : (
                  <Ionicons
                    name="person-circle-outline"
                    size={100}
                    color="#ccc"
                  />
                )}
                <Text style={styles.uploadText}>Upload Profile Image</Text>
              </TouchableOpacity>

              <TextInput
                placeholder="First Name"
                value={profileData.firstName}
                onChangeText={(text) =>
                  setProfileData({ ...profileData, firstName: text })
                }
                style={styles.modalInput}
              />

              <TextInput
                placeholder="Last Name"
                value={profileData.lastName}
                onChangeText={(text) =>
                  setProfileData({ ...profileData, lastName: text })
                }
                style={styles.modalInput}
              />

              {[
                { key: "insurance", label: "Renters Insurance" },
                { key: "pilotLicense", label: "Pilot’s License" },
                { key: "medical", label: "Medical Document" },
              ].map(({ key, label }) => (
                <View key={key} style={{ marginBottom: 16 }}>
                  <TouchableOpacity
                    onPress={() => handleDocument(key)}
                    style={styles.uploadButton}
                    activeOpacity={0.7}
                    accessibilityLabel={`${
                      profileData[key] ? "View" : "Upload"
                    } ${label}`}
                    accessibilityRole="button"
                  >
                    <Text style={styles.uploadButtonText}>
                      {profileData[key] ? `View ${label}` : `Upload ${label}`}
                    </Text>
                  </TouchableOpacity>

                  {profileData[key] && (
                    <TouchableOpacity
                      style={styles.documentRow}
                      onPress={() => handleDocument(key)}
                    >
                      <MaterialCommunityIcons
                        name="file-document-outline"
                        size={18}
                        color="#2c5282"
                        style={{ marginRight: 8 }}
                      />
                      <Text style={styles.documentText}>
                        {profileData[key].split("/").pop()}
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              ))}

              <TextInput
                placeholder="Type of aircraft certified in"
                value={profileData.aircraftType}
                onChangeText={(text) =>
                  setProfileData({ ...profileData, aircraftType: text })
                }
                style={styles.modalInput}
              />

              <TextInput
                placeholder="Certifications (e.g., IFR)"
                value={profileData.certifications}
                onChangeText={(text) =>
                  setProfileData({ ...profileData, certifications: text })
                }
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

              {/* NEW: Delete Account */}
              <TouchableOpacity
                onPress={() =>
                  Alert.alert(
                    "Delete Account",
                    "Are you sure you want to delete your account? This action cannot be undone.",
                    [
                      { text: "Cancel", style: "cancel" },
                      {
                        text: "Delete",
                        style: "destructive",
                        onPress: () => handleDeleteAccount(),
                      },
                    ],
                    { cancelable: true }
                  )
                }
                style={styles.deleteAccountButton}
                accessibilityLabel="Delete account"
                accessibilityRole="button"
              >
                <Text style={styles.deleteAccountText}>Delete Account</Text>
              </TouchableOpacity>
              <Text style={styles.deleteWarningText}>
                This cannot be undone!
              </Text>
            </ScrollView>
          </View>
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
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={{ flex: 1 }}
        >
          <SafeAreaView style={{ flex: 1, backgroundColor: "#f7fafc" }}>
            <ModalHeader
              title="Messages"
              onClose={() => setMessagesModalVisible(false)}
            >
              <TouchableOpacity
                onPress={() =>
                  Alert.alert(
                    "Report Spam or Scam?",
                    "Select a reason:",
                    [
                      {
                        text: "Spam",
                        onPress: () => reportSpamMessage("Spam"),
                      },
                      {
                        text: "Scam",
                        onPress: () => reportSpamMessage("Scam"),
                      },
                      {
                        text: "Other",
                        onPress: () =>
                          Alert.prompt(
                            "Other Reason",
                            "Please describe:",
                            (comments) => reportSpamMessage("Other", comments),
                            "plain-text"
                          ),
                      },
                      { text: "Cancel", style: "cancel" },
                    ],
                    { cancelable: true }
                  )
                }
                style={styles.modalHeaderReport}
                accessibilityLabel="Report this chat"
                accessibilityRole="button"
              >
                <MaterialIcons name="report" size={24} color="#e53e3e" />
              </TouchableOpacity>
            </ModalHeader>

            <FlatList
              data={displayMessages}
              keyExtractor={(item, index) =>
                item.type === "separator"
                  ? `sep-${item.date}-${index}`
                  : `${item.senderId}-${
                      item.timestamp?.seconds ?? item.createdAt?.seconds
                    }-${
                      item.timestamp?.nanoseconds ?? item.createdAt?.nanoseconds
                    }-${index}`
              }
              renderItem={({ item }) => {
                if (item.type === "separator") {
                  return (
                    <View
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        marginVertical: 8,
                        width: "100%",
                      }}
                    >
                      <View
                        style={{ flex: 1, height: 1, backgroundColor: "#ccc" }}
                      />
                      <Text
                        style={{
                          marginHorizontal: 8,
                          color: "#666",
                          fontSize: 12,
                        }}
                      >
                        {item.date}
                      </Text>
                      <View
                        style={{ flex: 1, height: 1, backgroundColor: "#ccc" }}
                      />
                    </View>
                  );
                }
                return (
                  <ChatMessage
                    message={item}
                    isOwn={item.senderId === renterId}
                  />
                );
              }}
              contentContainerStyle={styles.messagesList}
              ref={flatListRef}
              onContentSizeChange={() =>
                flatListRef.current?.scrollToEnd({ animated: false })
              }
              onLayout={() =>
                flatListRef.current?.scrollToEnd({ animated: false })
              }
              style={{ flex: 1 }}
            />

            <View style={styles.messageInputContainer}>
              <TextInput
                placeholder="Type your message..."
                value={messageText}
                onChangeText={setMessageText}
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
                <Ionicons name="send" size={20} color="#fff" />
              </TouchableOpacity>
            </View>
          </SafeAreaView>
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
              <ActivityIndicator
                size="large"
                color="#3182ce"
                style={{ marginTop: 20 }}
              />
            ) : selectedRentalRequest ? (
              <ScrollView contentContainerStyle={{ padding: 16 }}>
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
                    {selectedRentalRequest.ownerName || "N/A"}
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
                    {totalCost ? (
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

                {selectedRentalRequest &&
                selectedRentalRequest.rentalStatus === "denied" ? (
                  <TouchableOpacity
                    onPress={handleDeniedNotificationClose}
                    style={[
                      styles.closeNotificationModalButton,
                      { marginTop: 20 },
                    ]}
                    accessibilityLabel="Close"
                    accessibilityRole="button"
                  >
                    <Text style={styles.closeNotificationModalButtonText}>
                      Close
                    </Text>
                  </TouchableOpacity>
                ) : !paymentComplete ? (
                  <TouchableOpacity
                    onPress={() => {
                      const ownerIdForCheckout = selectedRentalRequest?.ownerId;
                      if (!ownerIdForCheckout) {
                        Alert.alert(
                          "Error",
                          "Cannot proceed to payment: Owner information is missing."
                        );
                        return;
                      }
                      navigateToCheckout(
                        selectedNotification?.rentalRequestId ||
                          selectedRentalRequest.id,
                        parseFloat(selectedListing.costPerHour),
                        parseFloat(selectedRentalRequest.rentalHours),
                        ownerIdForCheckout
                      );
                    }}
                    style={[
                      styles.proceedToPayButton,
                      { marginTop: 20, backgroundColor: "#38a169" },
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
                ) : (
                  // Existing branch for when payment is complete...
                  <View style={{ alignItems: "center", marginVertical: 16 }}>
                    <Text
                      style={{
                        fontSize: 18,
                        color: "#38a169",
                        marginBottom: 8,
                      }}
                    >
                      Payment Completed. Rental is now active.
                    </Text>
                    <TouchableOpacity
                      onPress={() => {
                        closeModal();
                        handleActiveRentalPress(selectedRentalRequest);
                      }}
                      style={styles.closeNotificationModalButton}
                      accessibilityLabel="Manage Rental"
                      accessibilityRole="button"
                    >
                      <Text style={styles.closeNotificationModalButtonText}>
                        Manage Rental
                      </Text>
                    </TouchableOpacity>
                  </View>
                )}
              </ScrollView>
            ) : selectedNotification ? (
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
                    {selectedNotification.ownerName || "System"}
                  </Text>
                </View>
                <View style={styles.notificationDetailBox}>
                  <Text style={styles.detailLabel}>Date:</Text>
                  <Text style={styles.detailValue}>
                    {selectedNotification.createdAt?.toDate
                      ? selectedNotification.createdAt.toDate().toLocaleString()
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
              <ModalHeader
                title="All Notifications"
                onClose={() => setAllNotificationsModalVisible(false)}
              />

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
                      accessibilityLabel={`View notification: ${
                        typeof item.message === "string"
                          ? item.message
                          : JSON.stringify(item.message)
                      }`}
                      accessibilityRole="button"
                    >
                      <Text style={styles.notificationMessageText}>
                        {typeof item.message === "string"
                          ? item.message
                          : JSON.stringify(item.message)}
                      </Text>
                      <Text style={styles.notificationDateText}>
                        {item.createdAt?.toDate
                          ? item.createdAt.toDate().toLocaleString()
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

      {/* Active Rental Details Modal */}
      <Modal
        visible={activeRentalModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setActiveRentalModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={{
            flex: 1,
            justifyContent: "center",
            alignItems: "center",
            backgroundColor: "rgba(0,0,0,0.5)",
          }}
        >
          <View
            style={{
              width: "90%",
              backgroundColor: "#fff",
              padding: 20,
              borderRadius: 10,
              maxHeight: "85%",
            }}
          >
            <ModalHeader
              title="Active Rental Details"
              onClose={() => setActiveRentalModalVisible(false)}
            />

            {selectedListing && selectedRentalRequest ? (
              <ScrollView>
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

                <Text style={[styles.detailLabel, { marginTop: 15 }]}>
                  Cost Breakdown:
                </Text>
                <Text style={styles.detailValue}>
                  Rental Cost: ${safeToFixed(totalCost.rentalCost)}
                </Text>
                <Text style={styles.detailValue}>
                  Booking Fee: ${safeToFixed(totalCost.bookingFee)}
                </Text>
                <Text style={styles.detailValue}>
                  Transaction Fee: ${safeToFixed(totalCost.transactionFee)}
                </Text>
                <Text style={styles.detailValue}>
                  Sales Tax: ${safeToFixed(totalCost.salesTax)}
                </Text>
                <Text style={styles.detailTotalCostText}>
                  Total Cost: ${safeToFixed(totalCost.total)}
                </Text>

                {/* Proceed to Pay Button added here if payment is not complete */}
                {!paymentComplete && (
                  <TouchableOpacity
                    onPress={() => {
                      const ownerIdForCheckout = selectedRentalRequest?.ownerId;
                      if (!ownerIdForCheckout) {
                        Alert.alert(
                          "Error",
                          "Cannot proceed to payment: Owner information is missing."
                        );
                        return;
                      }
                      navigateToCheckout(
                        selectedRentalRequest?.id,
                        parseFloat(selectedListing.costPerHour),
                        parseFloat(selectedRentalRequest.rentalHours),
                        ownerIdForCheckout
                      );
                    }}
                    style={[
                      styles.proceedToPayButton,
                      { marginTop: 20, backgroundColor: "#38a169" },
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

                <TouchableOpacity
                  onPress={() => {
                    setActiveRentalModalVisible(false);
                    setMessagesModalVisible(true);
                  }}
                  style={[
                    styles.proceedToPayButton,
                    { marginTop: 20, backgroundColor: "#3182ce" },
                  ]}
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
      
      {/* Past Rental Details Modal */}
      <Modal
        visible={pastRentalModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={closePastRentalModal}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={{
            flex: 1,
            justifyContent: "center",
            alignItems: "center",
            backgroundColor: "rgba(0,0,0,0.5)",
          }}
        >
          <View
            style={{
              width: "90%",
              backgroundColor: "#fff",
              padding: 20,
              borderRadius: 10,
              maxHeight: "85%",
            }}
          >
            <ModalHeader
              title="Past Rental Details"
              onClose={closePastRentalModal}
            />
            <ScrollView>
              {/* Listing Preview Card */}
              {selectedPastRental && selectedPastRental.listing && (
                <TouchableOpacity
                  style={styles.listingCard}
                  onPress={() => {
                    const listingId =
                      selectedPastRental.listingId ||
                      selectedPastRental.listing.id;
                    if (listingId) {
                      router.push({
                        pathname: "/home",
                        params: { listingId },
                      });
                    } else {
                      Alert.alert("Error", "Listing not available.");
                    }
                  }}
                >
                  <Image
                    source={{
                      uri:
                        selectedPastRental.listing.images &&
                        selectedPastRental.listing.images[0]
                          ? selectedPastRental.listing.images[0]
                          : "https://via.placeholder.com/150",
                    }}
                    style={styles.listingImage}
                  />
                  <Text style={styles.listingTitle}>
                    {selectedPastRental.listing.aircraftModel || "View Listing"}
                  </Text>
                </TouchableOpacity>
              )}

              {/* Rental & Payment Details */}
              <Text style={styles.detailLabel}>Aircraft Model:</Text>
              <Text style={styles.detailValue}>
                {selectedPastRental?.listing?.aircraftModel || "N/A"}
              </Text>
              <Text style={styles.detailLabel}>Tail Number:</Text>
              <Text style={styles.detailValue}>
                {selectedPastRental?.listing?.tailNumber || "N/A"}
              </Text>
              <Text style={styles.detailLabel}>Rental Hours:</Text>
              <Text style={styles.detailValue}>
                {selectedPastRental?.rentalHours || "N/A"}
              </Text>
              <Text style={styles.detailLabel}>Rental Date:</Text>
              <Text style={styles.detailValue}>
                {selectedPastRental?.rentalDate || "N/A"}
              </Text>
              <Text style={[styles.detailLabel, { marginTop: 15 }]}>
                Payment Details:
              </Text>
              {selectedPastRental?.listing &&
              selectedPastRental?.rentalHours &&
              !isNaN(parseFloat(selectedPastRental.listing.costPerHour)) ? (
                (() => {
                  const costPerHour =
                    parseFloat(selectedPastRental.listing.costPerHour) || 0;
                  const hours = parseFloat(selectedPastRental.rentalHours) || 0;
                  const pastCost = calculateTotalCost(costPerHour, hours);
                  return (
                    <View style={{ marginTop: 8 }}>
                      <Text style={styles.detailValue}>
                        Rental Cost (${costPerHour}/hr *{" "}
                        {selectedPastRental.rentalHours} hours): $
                        {safeToFixed(pastCost.rentalCost)}
                      </Text>
                      <Text style={styles.detailValue}>
                        Booking Fee (6%): ${safeToFixed(pastCost.bookingFee)}
                      </Text>
                      <Text style={styles.detailValue}>
                        Transaction Fee (3%): $
                        {safeToFixed(pastCost.transactionFee)}
                      </Text>
                      <Text style={styles.detailValue}>
                        Sales Tax (8.25%): ${safeToFixed(pastCost.salesTax)}
                      </Text>
                      <Text style={styles.detailTotalCostText}>
                        Total Paid: ${safeToFixed(pastCost.total)}
                      </Text>
                    </View>
                  );
                })()
              ) : (
                <Text style={styles.detailValue}>
                  Payment details not available.
                </Text>
              )}

              {/* ----------------------------------------- */}
              {/* *** ADDED: “Open Chat” Button for Past Rental *** */}
              {/* ----------------------------------------- */}
              {selectedPastRental && selectedPastRental.listing?.ownerId && (
                <CustomButton
                  onPress={async () => {
                    // set the owner for the chat context
                    setCurrentChatOwnerId(selectedPastRental.listing.ownerId);
                    // open (or create) the chat thread for this rental
                    await openMessageModal();
                    // close the Past‑Rental modal so you can see the chat
                    closePastRentalModal();
                  }}
                  title="Open Chat"
                  backgroundColor="#3182ce"
                />
              )}
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Important Modal (FAQ for renters) */}
      <Modal
        visible={faqModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setFaqModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.modalContainer}
        >
          <View style={styles.modalContent}>
            <ModalHeader
              title="Important"
              onClose={() => setFaqModalVisible(false)}
            />

            {/* Intro text */}
            <Text style={{ marginBottom: 16, fontSize: 14, lineHeight: 20 }}>
              You must agree to the following before you can rent an aircraft
              through our platform.
            </Text>

            <ScrollView
              style={{ maxHeight: 400 }}
              showsHorizontalScrollIndicator={false}
            >
              <Text style={{ fontWeight: "bold", fontSize: 16, marginTop: 8 }}>
                1. You agree to have a valid and active renter's insurance
                policy.
              </Text>
              <Text style={{ fontWeight: "bold", fontSize: 16, marginTop: 8 }}>
                2. You agree to carry proper insurance.
              </Text>
              <Text style={{ marginBottom: 8, fontSize: 14 }}>
                (We recommend getting in touch with your insurance agent.)
              </Text>
              <Text style={{ fontWeight: "bold", fontSize: 16, marginTop: 8 }}>
                3. You may be required to show proof to the aircraft owner that
                your insurance is up to date.
              </Text>
              <Text style={{ fontWeight: "bold", fontSize: 16, marginTop: 8 }}>
                4. The owner will be required to show you proof of the
                following:
              </Text>
              <Text style={{ marginLeft: 16, fontSize: 14, marginBottom: 8 }}>
                a. A current copy of their insurance policy.{"\n"}
                b. Proof of current annual.{"\n"}
                c. A copy of the most recent maintenance logs.{"\n"}
              </Text>
              <Text style={{ fontWeight: "bold", fontSize: 16, marginTop: 8 }}>
                5. It is also recommended that you conduct a full safety
                walk-around and a pre-flight with any potential renters prior to
                leasing your aircraft.
              </Text>
              <Text style={{ fontWeight: "bold", fontSize: 16, marginTop: 8 }}>
                6. You agree to keep all transactions within the app.
              </Text>
            </ScrollView>

            <CustomButton
              onPress={async () => {
                try {
                  await AsyncStorage.setItem("termsAgreed", "true");
                } catch (e) {
                  console.warn("↪️ failed to save termsAgreed", e);
                }
                setTermsAgreed(true);
                setFaqModalVisible(false);
              }}
              title="Agree & Proceed to View Rentals"
              backgroundColor="#3182ce"
            />
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Chat Fail-Safe Modal */}
      <Modal
        visible={chatFailSafeModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setChatFailSafeModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.modalContainer}
        >
          <View
            style={{
              width: "90%",
              backgroundColor: "#fff",
              padding: 20,
              borderRadius: 10,
            }}
          >
            <ModalHeader
              title="Contact Owner"
              onClose={() => setChatFailSafeModalVisible(false)}
            />
            <Text style={{ fontSize: 16, marginBottom: 16 }}>
              It looks like the chat isn’t working. Please contact the owner
              directly at:
            </Text>
            <Text style={styles.ownerEmailText}>
              {ownerEmail || "Email not available"}
            </Text>
            <CustomButton
              onPress={() => {
                if (ownerEmail) {
                  Linking.openURL(
                    `mailto:${ownerEmail}?subject=Rental Inquiry`
                  );
                }
              }}
              title="Send Email"
              backgroundColor="#3182ce"
            />
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal
        visible={chatListModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setChatListModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={{
            flex: 1,
            justifyContent: "center",
            alignItems: "center",
            backgroundColor: "rgba(0,0,0,0.5)",
          }}
        >
          <View
            style={{
              width: "90%",
              backgroundColor: "#fff",
              borderRadius: 8,
              padding: 20,
              maxHeight: "80%",
            }}
          >
            <ModalHeader
              title="Your Chats"
              onClose={() => setChatListModalVisible(false)}
            />
            <FlatList
              data={chatThreads.filter(
                (thread) => !pendingDeletion || thread.id !== pendingDeletion.id
              )}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => {
                const otherParticipant =
                  Array.isArray(item.participants) &&
                  item.participants.find((p) => p !== renterId);
                return (
                  <View
                    style={{
                      flexDirection: "row",
                      justifyContent: "space-between",
                      alignItems: "center",
                      paddingVertical: 12,
                      borderBottomWidth: 1,
                      borderColor: "#e2e8f0",
                    }}
                  >
                    <TouchableOpacity
                      style={{ flex: 1 }}
                      onPress={() => {
                        setChatListModalVisible(false);
                        openMessageModal(item.id);
                      }}
                    >
                      <Text style={{ fontSize: 16, fontWeight: "bold" }}>
                        Chat with{" "}
                        <ParticipantName
                          participantId={otherParticipant || "Unknown"}
                        />
                      </Text>
                      <ParticipantDate
                        participantId={otherParticipant || "Unknown"}
                      />
                    </TouchableOpacity>

                    <TouchableOpacity
                      onPress={() => handleDeleteChatThread(item)}
                    >
                      <Text
                        style={{ color: "red", fontSize: 14, marginLeft: 8 }}
                      >
                        Delete
                      </Text>
                    </TouchableOpacity>
                  </View>
                );
              }}
            />

            {pendingDeletion && (
              <View style={{ marginTop: 16, alignItems: "center" }}>
                <Text style={{ color: "#2d3748", marginBottom: 8 }}>
                  Chat deleted.
                </Text>
                <TouchableOpacity onPress={handleUndoDelete}>
                  <Text style={{ color: "#3182ce", fontSize: 16 }}>Undo</Text>
                </TouchableOpacity>
              </View>
            )}

            <CustomButton
              onPress={() => {
                setChatListModalVisible(false);
                openMessageModal(); // Auto-create a new chat thread if none selected.
              }}
              title="Start New Chat"
              backgroundColor="#3182ce"
            />
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <TouchableOpacity
        style={styles.chatBubbleIcon}
        onPress={async () => {
          await fetchChatThreads();
          setChatListModalVisible(true);
        }}
        accessibilityLabel="Open chat list"
        accessibilityRole="button"
      >
        <Ionicons name="chatbubble-ellipses" size={32} color="white" />
        {unreadCount > 0 && (
          <View style={styles.unreadBadge}>
            <Text style={styles.unreadBadgeText}>{unreadCount}</Text>
          </View>
        )}
      </TouchableOpacity>
    </View>
  );
};

export default renter;

// -------------------
// Styles (Original styles plus new renterLoungeText style and listing preview styles)
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
    borderRadius: 12,
    padding: 12,
    marginVertical: 4,
    maxWidth: "80%",
  },
  chatBubbleLeft: {
    backgroundColor: "#f1f0f0",
    alignSelf: "flex-start",
  },
  chatBubbleRight: {
    backgroundColor: "#007aff",
    alignSelf: "flex-end",
  },
  chatSenderName: {
    fontSize: 12,
    fontWeight: "600",
    color: "#555",
    marginBottom: 4,
  },
  chatMessageText: {
    fontSize: 16,
    lineHeight: 20,
    color: "#000",
  },
  chatTimestamp: {
    fontSize: 10,
    color: "#888",
    marginTop: 6,
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
  ownerEmailText: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#3182ce",
    textAlign: "center",
    marginBottom: 16,
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
    borderColor: "#3182ce",
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: "#ebf8ff",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  uploadButtonText: {
    color: "#3182ce",
    fontSize: 16,
    fontWeight: "600",
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
  renterLoungeText: {
    fontSize: 28,
    fontWeight: "bold",
    textAlign: "center",
    marginVertical: 16,
    color: "#2d3748",
  },
  listingCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#edf2f7",
    padding: 10,
    borderRadius: 8,
    marginBottom: 16,
  },
  listingImage: {
    width: 60,
    height: 60,
    borderRadius: 8,
    marginRight: 12,
  },
  listingTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#2d3748",
  },
  // Unread message styling
  unreadBadge: {
    position: "absolute",
    top: 4,
    right: 4,
    backgroundColor: "#e53e3e",
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    paddingHorizontal: 2,
    justifyContent: "center",
    alignItems: "center",
  },
  unreadBadgeText: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "bold",
  },
  dateSeparator: {
    alignSelf: "center",
    backgroundColor: "#e2e8f0",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 4,
    marginVertical: 8,
  },
  dateSeparatorText: {
    fontSize: 12,
    color: "#4a5568",
    fontWeight: "600",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    borderBottomWidth: 1,
    borderColor: "#e2e8f0",
  },
  modalHeaderTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#2d3748",
  },
  modalHeaderClose: {
    padding: 8,
  },
  modalHeaderReport: {
    padding: 8,
    marginLeft: 12,
  },
  // New styles for the profile modal
  profileModalWrapper: {
    width: "95%", // widen modal to 95% of screen
    maxHeight: "90%", // allow it to go up to 90% of screen height
    backgroundColor: "#fff",
    borderRadius: 10,
    overflow: "hidden", // clip any background/borders
  },
  profileModalScroll: {
    flexGrow: 1, // ensure the ScrollView expands and scrolls its content
  },
  profileModalContent: {
    padding: 20,
    paddingBottom: 40, // give extra space at bottom for Save button
  },
  deleteAccountButton: {
    padding: 12,
    marginTop: 16,
    alignItems: "center",
  },
  deleteAccountText: {
    color: "#e53e3e",
    fontSize: 16,
    fontWeight: "bold",
  },
  deleteWarningText: {
    textAlign: "center",
    color: "#e53e3e",
    marginTop: 2,
    fontSize: 14,
  },
  uploadButtonContent: {
    flexDirection: "row",
    alignItems: "center",
  },
  documentRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 8,
    marginBottom: 16,
  },
  documentText: {
    fontSize: 15,
    color: "#2c5282",
  },
});
