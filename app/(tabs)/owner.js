import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  View,
  TextInput,
  Alert,
  ScrollView,
  TouchableOpacity,
  Image,
  Text,
  ActivityIndicator,
  ImageBackground,
  Modal,
  StatusBar,
  RefreshControl,
  Platform,
  FlatList,
  KeyboardAvoidingView,
  Linking,
  Animated,
  Dimensions,
} from "react-native";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import { db, storage, auth } from "../../firebaseConfig";
import * as ImagePicker from "expo-image-picker";
import * as Notifications from "expo-notifications";
import {
  collection,
  addDoc,
  onSnapshot,
  updateDoc,
  deleteDoc,
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
  writeBatch,
  query,
  where,
  orderBy,
  limit,
  startAfter,
  getDocs,
  increment,
} from "firebase/firestore";
import { FontAwesome, Ionicons } from "@expo/vector-icons";
import wingtipClouds from "../../Assets/images/wingtip_clouds.jpg";
import { useStripe } from "@stripe/stripe-react-native";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { Picker } from "@react-native-picker/picker";
import BankDetailsForm from "../payment/BankDetailsForm";
import AsyncStorage from "@react-native-async-storage/async-storage";

// Define the API URL constant
const API_URL =
  "https://us-central1-ready-set-fly-71506.cloudfunctions.net/api";

// Helper function to format numbers into US locale
const formatNumber = (value) => {
  const number = parseFloat(value.toString().replace(/,/g, ""));
  if (isNaN(number)) return "";
  return number.toLocaleString("en-US", { maximumFractionDigits: 2 });
};

// Helper function to remove commas from a value
const removeCommas = (value) => value.toString().replace(/,/g, "");

/**
 * Reusable Input Component
 */
const CustomTextInput = ({
  placeholder,
  value,
  onChangeText,
  keyboardType = "default",
  editable = true,
  multiline = false,
  className = "",
  ...rest
}) => (
  <TextInput
    placeholder={placeholder}
    placeholderTextColor="#888"
    value={value}
    onChangeText={onChangeText}
    keyboardType={keyboardType}
    style={{
      borderWidth: 1,
      borderColor: "#ccc",
      borderRadius: 8,
      padding: 12,
      marginBottom: 12,
      ...rest.style,
    }}
    editable={editable}
    multiline={multiline}
    {...rest}
  />
);

/**
 * Reusable Section Component
 */
const Section = ({ title, children }) => (
  <View style={{ marginBottom: 16 }}>
    <Text style={{ fontSize: 18, fontWeight: "bold", marginBottom: 8 }}>
      {title}
    </Text>
    {children}
  </View>
);

/**
 * Reusable Button Component
 */
const CustomButton = ({
  onPress,
  title,
  backgroundColor = "#3182ce",
  style = {},
  textStyle = {},
  accessibilityLabel,
  accessibilityRole = "button",
}) => (
  <TouchableOpacity
    onPress={onPress}
    style={{
      backgroundColor,
      padding: 12,
      borderRadius: 8,
      alignItems: "center",
      justifyContent: "center",
      ...style,
    }}
    accessibilityLabel={accessibilityLabel || title}
    accessibilityRole={accessibilityRole}
  >
    <Text style={{ color: "#fff", fontWeight: "bold", ...textStyle }}>
      {title}
    </Text>
  </TouchableOpacity>
);

/**
 * Reusable Modal Header
 */
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

/**
 * Helper function to format dates
 */
const formatDate = (date) => {
  if (!date) return "N/A";
  if (date.toDate) {
    return date.toDate().toLocaleDateString();
  }
  if (date instanceof Date) {
    return date.toLocaleDateString();
  }
  return date; // Assume it's a string
};

const OwnerProfile = ({ ownerId }) => {
  const navigation = useNavigation();
  const user = auth.currentUser; // Get current Firebase user
  const stripe = useStripe();
  const resolvedOwnerId = ownerId || user?.uid; // Resolve ownerId or default to Firebase user ID
  const [pendingDeletion, setPendingDeletion] = useState(null);
  const [deleteTimer, setDeleteTimer] = useState(null);
  const [ytdBalance, setYtdBalance] = useState(null);
  const pulse = useRef(new Animated.Value(1)).current;
  const pulseAnim = useRef();
  const prevMessagesCount = useRef(0);
  const flatListRef = useRef(null);
  const [ownerTermsAgreed, setOwnerTermsAgreed] = useState(false);
  useEffect(() => {
    (async () => {
      try {
        const val = await AsyncStorage.getItem("ownerTermsAgreed");
        if (val === "true") {
          setOwnerTermsAgreed(true);
        } else {
          // if not yet agreed, show the Important modal
          setFaqModalVisible(true);
        }
      } catch (e) {
        console.warn("Failed to load owner agreement flag", e);
      }
    })();
  }, []);

  // Request permission as soon as this screen mounts
  useEffect(() => {
    (async () => {
      const { status } = await Notifications.requestPermissionsAsync();
      if (status !== "granted") {
        Alert.alert(
          "Enable Notifications",
          "To receive new‑rental and message alerts, please enable notifications in your device settings."
        );
      }
    })();
  }, []);

  // add near the top of OwnerProfile, alongside your other handlers:
  const handleDeleteAccount = () => {
    Alert.alert(
      "Delete Account",
      "Are you sure you want to delete your account? This cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              // call your cloud‐function to delete user data
              const token = await user.getIdToken();
              await fetch(`${API_URL}/deleteAccount`, {
                method: "DELETE",
                headers: {
                  "Content-Type": "application/json",
                  Authorization: `Bearer ${token}`,
                },
              });
              // then sign out locally
              await auth.signOut();
              navigation.reset({
                index: 0,
                routes: [{ name: "Welcome" }],
              });
            } catch (err) {
              console.error("Delete account failed:", err);
              Alert.alert(
                "Error",
                "Unable to delete account. Please try again."
              );
            }
          },
        },
      ]
    );
  };

  // Add this helper component (you can place it near the top of OwnerProfile)
  const ParticipantName = ({ participantId }) => {
    const [name, setName] = useState("");

    useEffect(() => {
      if (!participantId) {
        // If no participantId is provided, set a fallback name.
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
   * Helper component to fetch & display the rental date for a thread
   */
  const RentalDate = ({ rentalRequestId }) => {
    const [date, setDate] = useState(null);

    useEffect(() => {
      if (!rentalRequestId) return;
      const fetchRentalDate = async () => {
        try {
          const reqRef = doc(db, "rentalRequests", rentalRequestId);
          const reqSnap = await getDoc(reqRef);
          if (reqSnap.exists() && reqSnap.data().rentalDate) {
            const rd = reqSnap.data().rentalDate;
            setDate(rd.toDate ? rd.toDate() : new Date(rd));
          }
        } catch (error) {
          console.error("Error fetching rental date:", error);
        }
      };
      fetchRentalDate();
    }, [rentalRequestId]);

    return date ? (
      <Text style={{ fontSize: 12, color: "#718096" }}>{formatDate(date)}</Text>
    ) : null;
  };

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
            // Assuming a Firestore timestamp is stored in createdAt:
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

  const fetchChatThreads = async () => {
    const messagesRef = collection(db, "messages");
    const q = query(
      messagesRef,
      where("participants", "array-contains", resolvedOwnerId)
    );
    const snapshot = await getDocs(q);
    const threads = snapshot.docs.map((docSnap) => ({
      id: docSnap.id,
      ...docSnap.data(),
    }));
    // reduce to one thread per rentalRequestId
    const unique = Object.values(
      threads.reduce((acc, t) => {
        if (!acc[t.rentalRequestId]) acc[t.rentalRequestId] = t;
        return acc;
      }, {})
    );
    setChatThreads(unique);
  };

  const [faqModalVisible, setFaqModalVisible] = useState(false);

  const [chatListModalVisible, setChatListModalVisible] = useState(false);

  // NEW: New state for account type ("Owner", "Renter", or "Both")
  // ─── User Role ─────────────────────────────────────────────────────────────
  const [userRole, setUserRole] = useState("");

  // fetch once, defaulting to empty string if accountType is undefined
  useEffect(() => {
    if (!user) return;

    const userDocRef = doc(db, "users", user.uid);
    getDoc(userDocRef)
      .then((docSnap) => {
        const role = docSnap.exists() ? docSnap.data().accountType ?? "" : "";
        setUserRole(role);
      })
      .catch((error) => {
        console.error("Error fetching user role:", error);
      });
  }, [user]);

  // block pure renters (but allow "Both")
  useEffect(() => {
    if (userRole.toLowerCase() === "renter") {
      Alert.alert(
        "Access Denied",
        "This section is for aircraft owners. Please use the renter section."
      );
      navigation.goBack();
    }
  }, [userRole]);

  // ─── Other OwnerProfile State ─────────────────────────────────────────────
  const [manageRentalModalVisible, setManageRentalModalVisible] =
    useState(false);
  const [connectedAccountModalVisible, setConnectedAccountModalVisible] =
    useState(false);
  const [liveBalance, setLiveBalance] = useState(null);

  // NEW: State for Update Profile Modal (newly added)
  const [updateProfileModalVisible, setUpdateProfileModalVisible] =
    useState(false);

  // Update initial profileData to check providerData if displayName isn’t directly set.
  const [profileData, setProfileData] = useState({
    firstName: "",
    lastName: "",
    fullName: user?.displayName || "",
    contact: "",
    address: "",
    email: user?.email || "",
  });

  const [aircraftDetails, setAircraftDetails] = useState({
    aircraftModel: "",
    tailNumber: "",
    engineType: "",
    totalTimeOnFrame: "",
    location: "",
    airportIdentifier: "",
    costPerHour: "",
    description: "",
    images: [],
    mainImage: "",
  });

  const [initialAircraftDetails, setInitialAircraftDetails] = useState(null);
  const [allAircrafts, setAllAircrafts] = useState([]);
  const [costData, setCostData] = useState({
    loanAmount: "",
    interestRate: "",
    loanTerm: "",
    insuranceCost: "",
    hangarCost: "",
    annualRegistrationFees: "",
    maintenanceReserve: "",
    fuelCostPerHour: "",
    consumablesCostPerHour: "",
    rentalHoursPerYear: "",
    costPerHour: "",
    financingExpense: "",
  });

  const [showCalculator, setShowCalculator] = useState(false);
  const [costSaved, setCostSaved] = useState(false);
  const [aircraftSaved, setAircraftSaved] = useState(false);
  const [isListedForRent, setIsListedForRent] = useState(false);
  const [images, setImages] = useState([]);
  const [currentAnnualPdf, setCurrentAnnualPdf] = useState(null);
  const [insurancePdf, setInsurancePdf] = useState(null);
  const [loading, setLoading] = useState(false);
  const [userListings, setUserListings] = useState([]);
  const [rentalHistory, setRentalHistory] = useState([]);
  const [ratings, setRatings] = useState({});
  const [availableBalance, setAvailableBalance] = useState(0);
  const [totalWithdrawn, setTotalWithdrawn] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [rentalRequests, setRentalRequests] = useState([]);
  const [activeRentals, setActiveRentals] = useState([]);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [selectedListingDetails, setSelectedListingDetails] = useState(null);
  const [messageInput, setMessageInput] = useState("");
  const [messageModalVisible, setMessageModalVisible] = useState(false);
  const [messages, setMessages] = useState([]);
  const [chatThreads, setChatThreads] = useState([]);
  const [selectedChatThreadId, setSelectedChatThreadId] = useState(null);
  const [fullScreenModalVisible, setFullScreenModalVisible] = useState(false);
  const [aircraftModalVisible, setAircraftModalVisible] = useState(false);
  const [selectedAircraft, setSelectedAircraft] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [selectedAircraftIds, setSelectedAircraftIds] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);

  // 1) Up near your other callbacks/hooks:
  const closeMessageModal = useCallback(() => {
    setMessageModalVisible(false);
    setSelectedChatThreadId(null);
    setMessages([]);
  }, []);

  // 2) Single‐thread listener:
  // Single‐thread listener + local notification for new messages
  useEffect(() => {
    if (!selectedChatThreadId) return;

    const threadRef = doc(db, "messages", selectedChatThreadId);
    const unsubscribe = onSnapshot(
      threadRef,
      (docSnap) => {
        const msgs = docSnap.exists() ? docSnap.data().messages || [] : [];

        // If we already had messages, and one more arrived, fire notification
        if (
          prevMessagesCount.current > 0 &&
          msgs.length > prevMessagesCount.current
        ) {
          const last = msgs[msgs.length - 1];
          if (last.senderId !== resolvedOwnerId) {
            Notifications.scheduleNotificationAsync({
              content: {
                title: `New message from ${last.senderName}`,
                body: last.text,
                data: { chatThreadId: selectedChatThreadId },
              },
              trigger: null,
            });
          }
        }

        // update the ref and state
        prevMessagesCount.current = msgs.length;
        setMessages(msgs);
      },
      (err) => console.error("Chat subscription error:", err)
    );

    return () => unsubscribe();
  }, [selectedChatThreadId, resolvedOwnerId]);

  // 3) Unread‐count listener:
  useEffect(() => {
    if (!resolvedOwnerId) return;
    const messagesRef = collection(db, "messages");
    const q = query(
      messagesRef,
      where("participants", "array-contains", resolvedOwnerId)
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      let count = 0;
      snapshot.docs.forEach((docSnap) => {
        const msgs = docSnap.data().messages || [];
        if (msgs.length && msgs[msgs.length - 1].senderId !== resolvedOwnerId) {
          count++;
        }
      });
      setUnreadCount(count);
    });
    return () => unsubscribe();
  }, [resolvedOwnerId]);

  useEffect(() => {
    if (unreadCount > 0) {
      // build & store the animation
      pulseAnim.current = Animated.loop(
        Animated.sequence([
          Animated.timing(pulse, {
            toValue: 1.2,
            duration: 500,
            useNativeDriver: true,
          }),
          Animated.timing(pulse, {
            toValue: 1,
            duration: 500,
            useNativeDriver: true,
          }),
        ])
      );

      pulseAnim.current.start();
    } else {
      // no unread: reset scale and stop any running loop
      pulseAnim.current?.stop();
      pulse.setValue(1);
    }

    return () => {
      pulseAnim.current?.stop();
    };
  }, [unreadCount, pulse]);
  const [rentalRequestModalVisible, setRentalRequestModalVisible] =
    useState(false);

  // Updated Withdraw Funds modal state remains for showing info only
  const [withdrawModalVisible, setWithdrawModalVisible] = useState(false);
  const [viewMoreModalVisible, setViewMoreModalVisible] = useState(false);
  const [activeRentalsPage, setActiveRentalsPage] = useState([]);
  const [lastActiveRentalDoc, setLastActiveRentalDoc] = useState(null);
  const [hasMoreActiveRentals, setHasMoreActiveRentals] = useState(true);
  const ACTIVE_RENTALS_PAGE_SIZE = 10;
  const [cleanupLoading, setCleanupLoading] = useState(false);

  // State for Stripe Account
  const [stripeAccountId, setStripeAccountId] = useState(null);
  const [isStripeConnected, setIsStripeConnected] = useState(false);

  // New state for Connect Stripe Modal
  const [connectStripeModalVisible, setConnectStripeModalVisible] =
    useState(false);

  // NEW: State for Existing Stripe Account Modal
  const [existingStripeModalVisible, setExistingStripeModalVisible] =
    useState(false);

  // NEW: State for Stripe Info Modal
  const [stripeInfoModalVisible, setStripeInfoModalVisible] = useState(false);

  // NEW: State for an optional input of a Stripe Account ID when retrieving an existing account.
  const [existingStripeAccountId, setExistingStripeAccountId] = useState("");

  // --- add this handler up in your component, near your other Stripe functions ---
  const handleSwitchStripeAccount = async () => {
    const acct = existingStripeAccountId.trim();
    const stripeAccountIdRegex = /^acct_[A-Za-z0-9]+$/;
    if (!stripeAccountIdRegex.test(acct)) {
      Alert.alert(
        "Invalid Stripe Account ID",
        "Please enter a valid Stripe Account ID (acct_XXXXXXXXXXXX)."
      );
      return;
    }
    try {
      // update React state
      setStripeAccountId(acct);
      setIsStripeConnected(true);
      // persist to Firestore
      const profileRef = doc(db, "users", resolvedOwnerId);
      await updateDoc(profileRef, { stripeAccountId: acct });
      Alert.alert("Success", "Stripe account switched successfully.");
      setConnectedAccountModalVisible(false);
    } catch (err) {
      console.error("Error switching Stripe account:", err);
      Alert.alert(
        "Error",
        "Unable to switch Stripe account. Please try again."
      );
    }
  };
  /**
   * Helper function to automatically send state data to Firestore.
   */
  const autoSaveDataToFirestore = async (field, data) => {
    try {
      const sanitizedData = sanitizeData(data);
      // Save to the root user document instead of a subcollection
      const docRef = doc(db, "users", resolvedOwnerId);
      await setDoc(docRef, { [field]: sanitizedData }, { merge: true });
      console.log(`${field} has been successfully saved to Firestore.`);
    } catch (error) {
      console.error(`Error saving ${field} to Firestore:`, error);
    }
  };

  /**
   * Sanitize data by removing undefined and null values.
   */
  const sanitizeData = (data) => {
    const sanitizedData = {};
    for (const key in data) {
      if (data[key] !== undefined && data[key] !== null) {
        sanitizedData[key] = data[key];
      } else if (typeof data[key] === "boolean") {
        sanitizedData[key] = data[key];
      } else {
        sanitizedData[key] = "";
      }
    }
    return sanitizedData;
  };

  // … all your other hooks and state up above …

  const fetchOwnerData = useCallback(async () => {
    if (!resolvedOwnerId) {
      console.error("No owner ID or user ID available.");
      Alert.alert("Error", "User is not authenticated. Please log in.");
      return;
    }

    try {
      // 1) Read the user's root document
      const profileDocRef = doc(db, "users", resolvedOwnerId);
      const profileDocSnap = await getDoc(profileDocRef);

      if (profileDocSnap.exists()) {
        const profile = profileDocSnap.data();

        // Hydrate profileData WITH firstName, lastName, fullName
        setProfileData({
          firstName: profile.firstName || "",
          lastName: profile.lastName || "",
          fullName:
            profile.fullName ||
            `${profile.firstName || ""} ${profile.lastName || ""}`.trim() ||
            user?.displayName ||
            "",
          contact: profile.profileData?.contact || "",
          address: profile.profileData?.address || "",
          email: profile.profileData?.email || user?.email || "",
        });

        // Hydrate costData and flags
        setCostData(
          profile.costData || {
            loanAmount: "",
            interestRate: "",
            loanTerm: "",
            insuranceCost: "",
            hangarCost: "",
            annualRegistrationFees: "",
            maintenanceReserve: "",
            fuelCostPerHour: "",
            consumablesCostPerHour: "",
            rentalHoursPerYear: "",
            costPerHour: "",
            financingExpense: "",
          }
        );
        setCostSaved(!!profile.costData);
        setShowCalculator(!!profile.costData);

        // Hydrate aircraftDetails
        setAircraftDetails(
          profile.aircraftDetails || {
            aircraftModel: "",
            tailNumber: "",
            engineType: "",
            totalTimeOnFrame: "",
            location: "",
            airportIdentifier: "",
            costPerHour: "",
            description: "",
            images: [],
            mainImage: "",
          }
        );

        // ─── NEW: Hydrate Stripe info ───
        setStripeAccountId(profile.stripeAccountId || null);
        setIsStripeConnected(!!profile.stripeAccountId);
        // ─────────────────────────────────
      } else {
        console.log("No owner profile data found.");
      }

      // 2) Load this owner's aircraft listings
      const airplanesRef = collection(db, "airplanes");
      const q = query(
        airplanesRef,
        where("ownerId", "==", resolvedOwnerId),
        orderBy("createdAt", "desc")
      );
      const snapshot = await getDocs(q);
      const aircrafts = snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        ...docSnap.data(),
      }));

      setUserListings(aircrafts);
      setAllAircrafts(aircrafts);
    } catch (error) {
      console.error("Error fetching owner data:", error);
      Alert.alert("Error", "Failed to fetch saved data.");
    }
  }, [resolvedOwnerId, user]);

  // ─── ensure this sits immediately after fetchOwnerData ───
  useEffect(() => {
    fetchOwnerData();
  }, [fetchOwnerData]);
  // ─────────────────────────────────────────────────────────

  useFocusEffect(
    useCallback(() => {
      fetchOwnerData();

      if (resolvedOwnerId) {
        // Listen to balance updates
        const profileDocRef = doc(db, "users", resolvedOwnerId);
        const unsubscribeBalance = onSnapshot(
          profileDocRef,
          (docSnap) => {
            if (docSnap.exists()) {
              const profile = docSnap.data();
              setAvailableBalance(profile.availableBalance || 0);
              setTotalWithdrawn(profile.totalWithdrawn || 0);
            }
          },
          (error) => {
            console.error("Error listening to balance updates:", error);
          }
        );

        return () => unsubscribeBalance();
      }
    }, [fetchOwnerData, resolvedOwnerId])
  );

  useEffect(() => {
    if (resolvedOwnerId) {
      autoSaveDataToFirestore("profileData", profileData);
    }
  }, [profileData, resolvedOwnerId]);

  useEffect(() => {
    if (resolvedOwnerId) {
      autoSaveDataToFirestore("aircraftDetails", aircraftDetails);
    }
  }, [aircraftDetails, resolvedOwnerId]);

  // useEffect(() => {
  //   if (resolvedOwnerId) {
  //     autoSaveDataToFirestore("costData", costData);
  //   }
  // }, [costData, resolvedOwnerId]);

  // NEW: Fetch live Stripe balance when Payment Information modal opens.
  // Instead of expecting a "latestPayment" field, we now get the pending deposit amount.
  useEffect(() => {
    const fetchStripeBalance = async () => {
      try {
        const token = await user.getIdToken();
        const response = await fetch(`${API_URL}/get-stripe-balance`, {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
        });
        const data = await response.json();
        if (response.ok) {
          setLiveBalance(data.availableAmount);
          setYtdBalance(data.ytdAmount);
          console.log("⚡️ stripe-balance payload:", data);
        } else {
          console.error("Error fetching live balance:", data.error);
        }
      } catch (e) {
        console.error("Error fetching live balance:", e);
      }
    };
  
    // Don’t try until we know who the user is
    if (!user) return;
  
    // Always fetch on mount / user change, and again whenever either modal toggles
    fetchStripeBalance();
  }, [user, withdrawModalVisible, connectedAccountModalVisible]);  

  /**
   * Function to handle connecting Stripe account.
   */
  const handleConnectStripe = async () => {
    if (!profileData.email || !profileData.fullName) {
      Alert.alert(
        "Incomplete Profile",
        "Please provide your full name and email address."
      );
      setConnectStripeModalVisible(true);
      return;
    }

    try {
      const token = await user.getIdToken();
      const response = await fetch(`${API_URL}/create-connected-account`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          ownerId: resolvedOwnerId,
          email: profileData.email,
          fullName: profileData.fullName,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        const { accountLinkUrl } = data;
        Linking.openURL(accountLinkUrl);
      } else {
        let errMsg =
          data.error || "Failed to connect Stripe account. Please try again.";
        if (
          errMsg.includes(
            "destination account needs to have at least one of the following capabilities enabled"
          )
        ) {
          errMsg =
            "Your connected Stripe account is missing required capabilities (e.g. transfers). Please contact support for assistance.";
        }
        Alert.alert("Error", errMsg);
      }
    } catch (error) {
      console.error("Error connecting Stripe account:", error);
      Alert.alert(
        "Error",
        "There was an error connecting your Stripe account."
      );
    }
  };

  /**
   * Function to handle submission of data from the Connect Stripe Modal.
   */
  const handleConnectStripeSubmit = async () => {
    if (!profileData.email || !profileData.fullName) {
      Alert.alert(
        "Incomplete Information",
        "Please provide both your full name and email address."
      );
      return;
    }
    setConnectStripeModalVisible(false);
    await handleConnectStripe();
  };

  /**
   * NEW: Function to handle retrieving an existing Stripe account.
   * Now allows the user to provide a Stripe Account ID (in the format acct_XXXXXX)
   * OR to supply their full name and email address.
   */
  const handleRetrieveExistingStripeAccount = async () => {
    // 1️⃣ If the user manually entered an acct_… ID:
    if (existingStripeAccountId.trim() !== "") {
      const stripeAccountIdRegex = /^acct_[a-zA-Z0-9]+$/;
      if (!stripeAccountIdRegex.test(existingStripeAccountId.trim())) {
        Alert.alert(
          "Invalid Stripe Account ID",
          "Please enter a valid Stripe Account ID in the format acct_XXXXXXXXXXXX."
        );
        return;
      }
      const acctId = existingStripeAccountId.trim();

      // update React state
      setStripeAccountId(acctId);
      setIsStripeConnected(true);

      // 🔥 persist to Firestore
      const profileRef = doc(db, "users", resolvedOwnerId);
      await updateDoc(profileRef, { stripeAccountId: acctId });

      Alert.alert("Success", "Stripe account ID saved successfully.");
      setExistingStripeModalVisible(false);
      return;
    }

    // 2️⃣ Otherwise, fetch it from your Cloud Function
    if (!profileData.email || !profileData.fullName) {
      Alert.alert(
        "Incomplete Information",
        "Please provide both your full name and email address."
      );
      return;
    }

    try {
      const token = await user.getIdToken();
      const response = await fetch(`${API_URL}/retrieve-connected-account`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          ownerId: resolvedOwnerId,
          email: profileData.email,
          fullName: profileData.fullName,
        }),
      });
      const data = await response.json();

      if (response.ok) {
        const acctId = data.stripeAccountId;

        // update React state
        setStripeAccountId(acctId);
        setIsStripeConnected(true);

        // 🔥 and here too: persist to Firestore
        const profileRef = doc(db, "users", resolvedOwnerId);
        await updateDoc(profileRef, { stripeAccountId: acctId });

        Alert.alert("Success", "Stripe account data retrieved and saved.");
        setExistingStripeModalVisible(false);
      } else {
        let errMsg = data.error || "Failed to retrieve Stripe account data.";
        // … your existing error‑message tweaks …
        Alert.alert("Error", errMsg);
      }
    } catch (error) {
      console.error("Error retrieving existing Stripe account:", error);
      Alert.alert(
        "Error",
        "There was an error retrieving your Stripe account data."
      );
    }
  };

  /**
   * Fetches the Stripe support phone number for the connected account
   * and prompts the user to call.
   */
  const handleGetStripeSupportPhone = async () => {
    if (!stripeAccountId) {
      Alert.alert("No Account ID", "Please connect your Stripe account first.");
      return;
    }
    try {
      const token = await user.getIdToken();
      const response = await fetch(`${API_URL}/get-stripe-account-support`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ accountId: stripeAccountId }),
      });
      const { phone, error } = await response.json();
      if (response.ok && phone) {
        Alert.alert("Stripe Support", phone, [
          { text: "Call Now", onPress: () => Linking.openURL(`tel:${phone}`) },
          { text: "OK", style: "cancel" },
        ]);
      } else {
        throw new Error(error || "Could not fetch support number.");
      }
    } catch (e) {
      console.error("Error fetching support phone:", e);
      Alert.alert("Error", e.message || "Unable to get support number.");
    }
  };

  /**
   * Function to toggle the selection of an aircraft.
   */
  const toggleSelectAircraft = (aircraftId) => {
    if (selectedAircraftIds.includes(aircraftId)) {
      setSelectedAircraftIds(
        selectedAircraftIds.filter((id) => id !== aircraftId)
      );
    } else {
      setSelectedAircraftIds([...selectedAircraftIds, aircraftId]);
    }
  };

  /**
   * Function to allow users to edit cost data after it has been saved.
   */
  const onEditCostData = () => {
    setCostSaved(false);
  };

  /**
   * Function to select a main image from the uploaded images.
   */
  const selectMainImage = (uri) => {
    setAircraftDetails((prev) => ({
      ...prev,
      mainImage: uri,
    }));
  };

  /**
   * Function to handle refreshing the data.
   */
  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await fetchOwnerData();
    } catch (error) {
      console.error("Error on refresh:", error);
      Alert.alert("Error", "Failed to refresh data.");
    } finally {
      setRefreshing(false);
    }
  };

  /**
   * Fetch rental requests and process them to include necessary details.
   */
  useEffect(() => {
    if (resolvedOwnerId) {
      const rentalRequestsRef = collection(db, "rentalRequests");
      const q = query(
        rentalRequestsRef,
        where("ownerId", "==", resolvedOwnerId),
        orderBy("createdAt", "desc")
      );

      const unsubscribeRentalRequests = onSnapshot(
        q,
        async (snapshot) => {
          // Notify on new pending requests
          snapshot.docChanges().forEach((change) => {
            if (change.type === "added") {
              const newRequest = change.doc.data();
              if (newRequest.rentalStatus === "pending") {
                Notifications.scheduleNotificationAsync({
                  content: {
                    title: "New Rental Request",
                    body: "You have received a new rental request. Check your Incoming Rental Requests for details.",
                    data: { rentalRequestId: change.doc.id },
                  },
                  trigger: null,
                });
              }
            }
          });

          // Enrich each request with listing details and cost calculations
          const requestsWithDetails = await Promise.all(
            snapshot.docs.map(async (docSnap) => {
              const requestData = docSnap.data();
              const renterId = requestData.renterId;
              let renterName = requestData.renterName || "Anonymous";
              let renterCityState = requestData.currentLocation || "N/A";

              let rentalHours =
                requestData.rentalHours != null
                  ? requestData.rentalHours
                  : "N/A";
              let currentMedical = requestData.currentMedical ? "Yes" : "No";
              let currentRentersInsurance = requestData.currentRentersInsurance
                ? "Yes"
                : "No";
              let rentalDate = requestData.rentalDate || null;

              const listingDetails = requestData.listingId
                ? await fetchListingDetails(requestData.listingId)
                : null;

              let baseCost = requestData.baseCost;
              let commission = requestData.commission;
              if (!baseCost && listingDetails) {
                const costPerHour = parseFloat(listingDetails.costPerHour);
                baseCost = (parseFloat(rentalHours) * costPerHour).toFixed(2);
                commission = (baseCost * 0.06).toFixed(2);
              }

              return {
                id: docSnap.id,
                ...requestData,
                renterName,
                renterCityState,
                rentalHours,
                currentMedical,
                currentRentersInsurance,
                rentalDate,
                listingDetails,
                baseCost,
                commission,
              };
            })
          );

          // Split into pending and active (including paid) lists
          let pendingRequests = requestsWithDetails.filter(
            (req) => req.rentalStatus === "pending"
          );
          const activeRentals = requestsWithDetails.filter(
            (req) =>
              req.rentalStatus === "active" || req.rentalStatus === "paid"
          );

          // Clean up stale pending requests (those with a rentalDate in the past)
          const now = new Date();
          for (const req of pendingRequests) {
            if (req.rentalDate) {
              let rentalDateObj = req.rentalDate;
              if (rentalDateObj.toDate) {
                rentalDateObj = rentalDateObj.toDate();
              } else {
                rentalDateObj = new Date(rentalDateObj);
              }
              if (now > rentalDateObj) {
                try {
                  await deleteDoc(doc(db, "rentalRequests", req.id));
                  console.log(`Deleted stale request ${req.id}`);
                } catch (error) {
                  console.error("Error deleting stale request:", error);
                }
              }
            }
          }

          // Filter pending requests again to only include those still valid
          const validPendingRequests = pendingRequests.filter((req) => {
            if (req.rentalDate) {
              let rentalDateObj = req.rentalDate;
              if (rentalDateObj.toDate) {
                rentalDateObj = rentalDateObj.toDate();
              } else {
                rentalDateObj = new Date(rentalDateObj);
              }
              return now <= rentalDateObj;
            }
            return true;
          });

          setRentalRequests(validPendingRequests);
          setActiveRentals(activeRentals);
        },
        (error) => {
          console.error("Error fetching rental requests:", error);
          Alert.alert("Error", "Failed to fetch rental requests.");
        }
      );

      return () => {
        unsubscribeRentalRequests();
      };
    }
  }, [resolvedOwnerId]);
  /**
   * Function to calculate the actual revenue based on rental history.
   */
  const calculateActualRevenue = () => {
    return rentalHistory
      .reduce((total, order) => {
        return total + parseFloat(order.totalCost);
      }, 0)
      .toFixed(2);
  };

  /**
   * Function to handle sending messages in chat threads.
   */
  const sendMessage = async () => {
    if (!messageInput.trim()) return;

    // Guard clause to ensure there is a valid chat thread ID
    if (!selectedChatThreadId) {
      Alert.alert(
        "Error",
        "No chat thread selected. Please open a chat from an active rental."
      );
      return;
    }

    const messageData = {
      senderId: user.uid,
      senderName: user.displayName || "Owner",
      text: messageInput,
      createdAt: new Date(),
    };

    try {
      const chatDocRef = doc(db, "messages", selectedChatThreadId);
      const chatDoc = await getDoc(chatDocRef);
      if (chatDoc.exists()) {
        const chatData = chatDoc.data();
        await updateDoc(chatDocRef, {
          messages: [...(chatData.messages || []), messageData],
        });
      }

      setMessageInput("");
      setMessages((prev) => [...prev, messageData]);
      // scroll to the new message
      flatListRef.current?.scrollToEnd({ animated: true });
    } catch (error) {
      console.error("Error sending message:", error);
      Alert.alert("Error", "Failed to send message.");
    }
  };

  const reportMessage = async (reason, comments = "") => {
    if (!selectedChatThreadId) {
      return Alert.alert(
        "No Conversation",
        "You need to have a chat open in order to report it."
      );
    }

    // lookup the thread document so we can extract the renter’s info
    const chatDoc = await getDoc(doc(db, "messages", selectedChatThreadId));
    if (!chatDoc.exists()) {
      return Alert.alert("Error", "Could not find this chat thread.");
    }
    const data = chatDoc.data();
    // participants array contains both owner and renter
    const renterId = data.participants.find((id) => id !== user.uid);
    const renterName =
      data.messages?.[0]?.senderName === user.displayName
        ? data.messages[data.messages.length - 1]?.senderName
        : data.messages?.[0]?.senderName || "Unknown";

    try {
      const token = await user.getIdToken();
      const payload = {
        listingId: selectedRequest?.listingId || null,
        chatThreadId: selectedChatThreadId,
        ownerId: user.uid,
        renterId,
        renterName,
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
    } catch (err) {
      console.error("Report failed", err);
      Alert.alert("Error", "Unable to send report. Please try again later.");
    }
  };

  /**
   * Function to open the message modal for a specific chat thread.
   */
  /**
   * Function to open the message modal for a specific chat thread.
   * Now also sets selectedChatThreadId so we can stream updates.
   */
  const openMessageModal = async (chatThreadId = null) => {
    try {
      let threadId = chatThreadId;

      // If caller passed in an ID, use it…
      if (!threadId) {
        // Or reuse the selected one if we’ve already opened it this session
        if (selectedChatThreadId) {
          threadId = selectedChatThreadId;
        } else {
          // No thread yet—try to find one by rentalRequestId
          if (!selectedRequest?.id || !selectedRequest?.renterId) {
            Alert.alert("Error", "No active rental selected to start a chat.");
            return;
          }
          const rentalId = selectedRequest.id;
          const renterId = selectedRequest.renterId;

          // Query for an existing thread on this rental
          const existingQuery = query(
            collection(db, "messages"),
            where("rentalRequestId", "==", rentalId),
            where("participants", "array-contains", resolvedOwnerId),
            limit(1)
          );
          const existingSnap = await getDocs(existingQuery);

          if (!existingSnap.empty) {
            // Reuse the first thread we find
            threadId = existingSnap.docs[0].id;
          } else {
            // No existing thread → create a new one
            const newThread = {
              participants: [resolvedOwnerId, renterId],
              ownerId: resolvedOwnerId,
              renterId,
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

      // Store and load
      setSelectedChatThreadId(threadId);
      const chatDocRef = doc(db, "messages", threadId);
      const chatDoc = await getDoc(chatDocRef);
      if (chatDoc.exists()) {
        // grab the existing messages…
        const initial = chatDoc.data().messages || [];
        setMessages(initial);
        // …and prime our ref so we don’t fire on old messages
        prevMessagesCount.current = initial.length;
      } else {
        Alert.alert("Error", "Chat thread not found.");
        return;
      }

      setMessageModalVisible(true);
    } catch (error) {
      console.error("Error opening message modal:", error);
      Alert.alert("Error", "Failed to open messages.");
      setChatFailed(true);
    }
  };

  // Function to handle deletion with an undo option
  const handleDeleteChatThread = (thread) => {
    // Clear any existing timer if needed
    if (deleteTimer) {
      clearTimeout(deleteTimer);
    }
    // Mark this thread as pending deletion so it is temporarily removed from the list
    setPendingDeletion(thread);
    // Start a 3-second timer to permanently delete the thread
    const timer = setTimeout(async () => {
      try {
        await deleteDoc(doc(db, "messages", thread.id));
        // Optionally log or notify that deletion succeeded
      } catch (error) {
        console.error("Error deleting chat thread:", error);
        Alert.alert("Error", "Failed to delete chat thread.");
      }
      setPendingDeletion(null);
      setDeleteTimer(null);
    }, 3000);
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

  /**
   * Function to handle approving a rental request.
   */
  const handleApproveRentalRequest = async (request) => {
    try {
      if (!request.listingId || !request.rentalDate) {
        console.error("Invalid request data: ", request);
        Alert.alert(
          "Error",
          "Request data is invalid or rental date is missing."
        );
        return;
      }

      const renterId = request.renterId;
      if (!renterId) {
        console.error("Rental Request is missing renterId: ", request);
        Alert.alert("Error", "Rental request is missing renter ID.");
        return;
      }

      const ownerName = user.displayName || "Unknown Owner";

      const rentalHours = request.rentalHours;
      const costPerHour = request.listingDetails
        ? parseFloat(request.listingDetails.costPerHour)
        : 0;

      if (!rentalHours || isNaN(costPerHour)) {
        Alert.alert(
          "Error",
          "Rental hours or cost per hour information is missing."
        );
        return;
      }

      const baseCost = (parseFloat(rentalHours) * costPerHour).toFixed(2);
      const commission = (baseCost * 0.06).toFixed(2);
      const totalCost = (parseFloat(baseCost) - parseFloat(commission)).toFixed(
        2
      );

      const batch = writeBatch(db);

      const rentalRequestRef = doc(db, "rentalRequests", request.id);
      batch.update(rentalRequestRef, {
        rentalStatus: "active",
        rentalDate: request.rentalDate,
        baseCost,
        commission,
        totalCost,
        renterName: request.renterName,
      });

      const notificationRef = collection(
        db,
        "renters",
        renterId,
        "notifications"
      );
      const notificationData = {
        type: "rentalApproved",
        message:
          "Your rental request has been approved. Please complete the payment.",
        rentalRequestId: request.id,
        listingId: request.listingId,
        ownerId: resolvedOwnerId,
        ownerName: ownerName,
        rentalDate: request.rentalDate,
        createdAt: serverTimestamp(),
        renterName: request.renterName,
      };
      const notificationDoc = doc(notificationRef);
      batch.set(notificationDoc, notificationData);

      await batch.commit();

      Alert.alert(
        "Request Approved",
        `The rental request for ${formatDate(
          request.rentalDate
        )} has been approved. A notification has been sent to the renter to complete the payment.`
      );

      setRentalRequestModalVisible(false);
    } catch (error) {
      console.error("Error approving rental request: ", error);
      Alert.alert("Error", "There was an error approving the rental request.");
    }
  };

  /**
   * Function to handle denying a rental request.
   */
  const handleDenyRentalRequest = async (request) => {
    try {
      if (!resolvedOwnerId) {
        Alert.alert("Error", "Owner ID is undefined.");
        return;
      }

      const renterId = request.renterId;
      if (!renterId) {
        console.error("Rental Request is missing renterId: ", request);
        Alert.alert("Error", "Rental request is missing renter ID.");
        return;
      }

      if (!request.listingId) {
        console.error("Rental Request is missing listingId: ", request);
        Alert.alert("Error", "Rental request is missing listing ID.");
        return;
      }

      const batch = writeBatch(db);

      const rentalRequestRef = doc(db, "rentalRequests", request.id);
      batch.update(rentalRequestRef, {
        rentalStatus: "denied",
      });

      const notificationRef = collection(
        db,
        "renters",
        renterId,
        "notifications"
      );
      const notificationData = {
        type: "rentalDenied",
        message: "Your rental request has been denied by the owner.",
        rentalRequestId: request.id,
        listingId: request.listingId,
        ownerId: resolvedOwnerId,
        createdAt: serverTimestamp(),
      };
      const notificationDoc = doc(notificationRef);
      batch.set(notificationDoc, notificationData);

      await batch.commit();

      Alert.alert("Request Denied", "The rental request has been denied.");
      setRentalRequestModalVisible(false);
    } catch (error) {
      console.error("Error denying rental request: ", error);
      Alert.alert("Error", "There was an error denying the rental request.");
    }
  };

  /**
   * Function to fetch listing details based on listingId.
   */
  const fetchListingDetails = async (listingId) => {
    try {
      if (!listingId) {
        // console.warn(`Rental Request is missing listingId.`);
        return null;
      }

      const listingDocRef = doc(db, "airplanes", listingId);
      const listingDoc = await getDoc(listingDocRef);
      if (listingDoc.exists()) {
        const listingData = listingDoc.data();
        if (!listingData.ownerId) {
          // console.warn(
          //   `Listing ID: ${listingId} is missing 'ownerId'. This listing will be excluded.`
          // );
          return null;
        }
        return listingData;
      } else {
        // console.warn(`No listing found for listingId: ${listingId}`);
        // return null;
      }
    } catch (error) {
      console.error("Error fetching listing details:", error);
      return null;
    }
  };

  /**
   * Function to handle deleting an active rental.
   */
  const handleDeleteActiveRental = async (rentalId) => {
    try {
      const rentalRequestRef = doc(db, "rentalRequests", rentalId);
      await deleteDoc(rentalRequestRef);

      setActiveRentals(
        activeRentals.filter((rental) => rental.id !== rentalId)
      );
      setActiveRentalsPage(
        activeRentalsPage.filter((rental) => rental.id !== rentalId)
      );
      setSelectedAircraftIds(
        selectedAircraftIds.filter((id) => id !== rentalId)
      );

      Alert.alert("Deleted", "The active rental has been deleted.");
    } catch (error) {
      console.error("Error deleting active rental:", error);
      Alert.alert("Error", "Failed to delete the active rental.");
    }
  };

  /**
   * Function to handle ending (closing) a rental.
   * This function updates the rental status to "ended", effectively closing it and moving it to Past Rentals.
   */
  const handleEndRental = async () => {
    if (!selectedRequest) {
      Alert.alert("Error", "No active rental selected.");
      return;
    }
    try {
      await updateDoc(doc(db, "rentalRequests", selectedRequest.id), {
        rentalStatus: "ended",
      });
      Alert.alert(
        "Rental Ended",
        "The rental has been ended and moved to Past Rentals."
      );
      setManageRentalModalVisible(false);
      setRentalRequestModalVisible(false);
    } catch (error) {
      console.error("Error ending rental:", error);
      Alert.alert("Error", "Failed to end the rental.");
    }
  };

  /**
   * useEffect to automatically close rentals that have not been ended by the end of the day.
   */
  useEffect(() => {
    const autoCloseRentals = async () => {
      const now = new Date();
      for (const rental of activeRentals) {
        if (!rental.rentalDate) continue;
        const rentalDateObj = rental.rentalDate.toDate
          ? rental.rentalDate.toDate()
          : new Date(rental.rentalDate);
        const rentalDay = new Date(
          rentalDateObj.getFullYear(),
          rentalDateObj.getMonth(),
          rentalDateObj.getDate()
        );
        const today = new Date(
          now.getFullYear(),
          now.getMonth(),
          now.getDate()
        );
        if (today > rentalDay) {
          try {
            const rentalRef = doc(db, "rentalRequests", rental.id);
            await updateDoc(rentalRef, { status: "ended" });
            console.log(`Auto-closed rental ${rental.id}`);
          } catch (error) {
            console.error("Error auto-closing rental:", error);
          }
        }
      }
    };

    autoCloseRentals();
  }, [activeRentals]);

  /**
   * Function to handle opening chat for an active rental.
   */
  const handleOpenChatForRental = async () => {
    try {
      const renterId = selectedRequest?.renterId;
      if (!renterId) {
        Alert.alert("Error", "No renter ID available.");
        return;
      }

      // Look for an existing thread between owner and this renter
      const chatThreadsQuery = query(
        collection(db, "messages"),
        where("participants", "array-contains", resolvedOwnerId)
      );
      const chatSnapshot = await getDocs(chatThreadsQuery);

      let chatThreadId = null;
      chatSnapshot.forEach((docSnap) => {
        const chatData = docSnap.data();
        if (
          chatData.participants.includes(resolvedOwnerId) &&
          chatData.participants.includes(renterId)
        ) {
          chatThreadId = docSnap.id;
        }
      });

      // If none exists, create a fresh thread
      if (!chatThreadId) {
        const chatThread = {
          participants: [resolvedOwnerId, renterId],
          ownerId: resolvedOwnerId,
          renterId: renterId,
          rentalRequestId: selectedRequest.id,
          messages: [],
          createdAt: serverTimestamp(),
        };
        const chatDocRef = await addDoc(collection(db, "messages"), chatThread);
        chatThreadId = chatDocRef.id;
      }

      // **NEW**: Make sure state knows which thread we're in
      setSelectedChatThreadId(chatThreadId);

      // Close the rental‑modals and hand off to openMessageModal
      setManageRentalModalVisible(false);
      setRentalRequestModalVisible(false);
      openMessageModal(chatThreadId);
    } catch (error) {
      console.error("Error opening chat:", error);
      Alert.alert("Error", "Failed to open chat.");
    }
  };

  /**
   * Function to fetch the first page of active rentals.
   */
  const fetchFirstPageActiveRentals = async () => {
    setLoading(true);
    try {
      const rentalsRef = collection(db, "rentalRequests");
      const q = query(
        rentalsRef,
        where("ownerId", "==", resolvedOwnerId),
        where("rentalStatus", "==", "active"),
        orderBy("createdAt", "desc"),
        limit(ACTIVE_RENTALS_PAGE_SIZE)
      );

      const snapshot = await getDocs(q);

      if (!snapshot.empty) {
        const lastDoc = snapshot.docs[snapshot.docs.length - 1];
        setLastActiveRentalDoc(lastDoc);

        const newRentals = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));

        setActiveRentalsPage(newRentals);

        if (snapshot.docs.length < ACTIVE_RENTALS_PAGE_SIZE) {
          setHasMoreActiveRentals(false);
        } else {
          setHasMoreActiveRentals(true);
        }
      } else {
        setHasMoreActiveRentals(false);
      }
    } catch (error) {
      console.error("Error fetching active rentals:", error);
      Alert.alert("Error", "Failed to fetch active rentals.");
    } finally {
      setLoading(false);
    }
  };

  /**
   * Function to handle loading more active rentals.
   */
  const handleLoadMoreActiveRentals = async () => {
    if (!hasMoreActiveRentals || loading) return;

    setLoading(true);
    try {
      const rentalsRef = collection(db, "rentalRequests");
      const q = query(
        rentalsRef,
        where("ownerId", "==", resolvedOwnerId),
        where("rentalStatus", "==", "active"),
        orderBy("createdAt", "desc"),
        startAfter(lastActiveRentalDoc),
        limit(ACTIVE_RENTALS_PAGE_SIZE)
      );

      const snapshot = await getDocs(q);

      if (!snapshot.empty) {
        const lastDoc = snapshot.docs[snapshot.docs.length - 1];
        setLastActiveRentalDoc(lastDoc);

        const newRentals = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));

        setActiveRentalsPage((prev) => [...prev, ...newRentals]);

        if (snapshot.docs.length < ACTIVE_RENTALS_PAGE_SIZE) {
          setHasMoreActiveRentals(false);
        }
      } else {
        setHasMoreActiveRentals(false);
      }
    } catch (error) {
      console.error("Error loading more active rentals:", error);
      Alert.alert("Error", "Failed to load more active rentals.");
    } finally {
      setLoading(false);
    }
  };

  /**
   * Utility Functions
   */

  // Inside your OwnerProfile component, locate the saveCostData function and replace it with the following:

  const saveCostData = async () => {
    setLoading(true);
    try {
      // Only require specific cost input fields (ignore computed fields)
      const requiredFieldKeys = [
        "loanAmount",
        "interestRate",
        "loanTerm",
        "insuranceCost",
        "hangarCost",
        "annualRegistrationFees",
        "maintenanceReserve",
        "fuelCostPerHour",
        "consumablesCostPerHour",
        "rentalHoursPerYear",
      ];
      for (const key of requiredFieldKeys) {
        if (costData[key].toString().trim() === "") {
          Alert.alert(
            "Error",
            "Please fill in all fields for accurate calculation."
          );
          setLoading(false);
          return;
        }
      }

      // Remove commas before parsing
      const loanAmount = parseFloat(removeCommas(costData.loanAmount));
      const interestRate = parseFloat(removeCommas(costData.interestRate));
      const loanTerm = parseFloat(removeCommas(costData.loanTerm));
      const insuranceCost = parseFloat(removeCommas(costData.insuranceCost));
      const hangarCost = parseFloat(removeCommas(costData.hangarCost));
      const annualRegistrationFees = parseFloat(
        removeCommas(costData.annualRegistrationFees)
      );
      const maintenanceReserve = parseFloat(
        removeCommas(costData.maintenanceReserve)
      );
      const fuelCostPerHour = parseFloat(
        removeCommas(costData.fuelCostPerHour)
      );
      const consumablesCostPerHour = parseFloat(
        removeCommas(costData.consumablesCostPerHour)
      );
      const rentalHoursPerYear = parseFloat(
        removeCommas(costData.rentalHoursPerYear)
      );

      const monthlyInterestRate = interestRate / 100 / 12;
      const numberOfPayments = loanTerm * 12;
      let financingExpense = 0;
      if (loanAmount) {
        if (monthlyInterestRate === 0) {
          financingExpense = loanAmount / numberOfPayments;
        } else {
          financingExpense =
            (loanAmount * monthlyInterestRate) /
            (1 - Math.pow(1 + monthlyInterestRate, -numberOfPayments));
        }
      }

      const totalFixedCosts =
        financingExpense * 12 +
        insuranceCost +
        hangarCost +
        annualRegistrationFees +
        maintenanceReserve;

      const totalVariableCosts =
        (fuelCostPerHour + consumablesCostPerHour) * rentalHoursPerYear;

      const totalCostPerYear = totalFixedCosts + totalVariableCosts;

      const costPerHour = (totalCostPerYear / rentalHoursPerYear).toFixed(2);

      setCostData((prev) => ({
        ...prev,
        costPerHour,
        financingExpense,
      }));

      // Persist to Firestore
      await setDoc(
        doc(db, "users", resolvedOwnerId),
        {
          costData: sanitizeData({
            ...costData,
            costPerHour,
            financingExpense,
          }),
        },
        { merge: true }
      );

      // ────────── ADD THESE TWO LINES HERE ──────────
      setCostSaved(true); // <-- mark cost data as saved so the mini‑view shows
      setShowCalculator(true); // <-- optionally collapse inputs to the summary
      // ─────────────────────────────────────────────

      Alert.alert("Success", `Estimated cost per hour: $${costPerHour}`);
    } catch (error) {
      console.error("Error saving cost data:", error);
      Alert.alert("Error", "Failed to save cost data.");
    } finally {
      setLoading(false);
    }
  };

  // For numeric cost fields, onChange removes commas and onBlur formats the value.
  const handleNumericChange = (field, value) => {
    handleInputChange(field, value.replace(/,/g, ""));
  };

  const handleNumericBlur = (field) => {
    const currentValue = costData[field];
    handleInputChange(field, formatNumber(currentValue));
  };

  const handleInputChange = (name, value) => {
    if (name in aircraftDetails) {
      setAircraftDetails((prev) => ({ ...prev, [name]: value }));
    } else if (name in costData) {
      setCostData((prev) => ({ ...prev, [name]: value }));
    } else if (name in profileData) {
      setProfileData((prev) => ({ ...prev, [name]: value }));
    }
  };

  const pickImage = async () => {
    if (images.length >= 7) {
      Alert.alert("Limit Reached", "You can only upload up to 7 images.");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      allowsEditing: false,
      aspect: [4, 3],
      quality: 1,
      selectionLimit: 7 - images.length,
    });

    if (!result.canceled) {
      const selectedUris = result.assets.map((asset) => asset.uri);
      setImages([...images, ...selectedUris]);
    }
  };

  const removeImage = (uri) => {
    setImages(images.filter((image) => image !== uri));
    if (aircraftDetails.mainImage === uri) {
      setAircraftDetails((prev) => ({
        ...prev,
        mainImage: images.length > 1 ? images[0] : "",
      }));
    }
  };

  const uploadFile = async (uri, folder) => {
    try {
      const response = await fetch(uri);
      const blob = await response.blob();
      const filename = uri.substring(uri.lastIndexOf("/") + 1);

      const storageRef = ref(
        storage,
        `${folder}/${resolvedOwnerId}/${filename}`
      );

      await uploadBytes(storageRef, blob);

      const downloadURL = await getDownloadURL(storageRef);

      return downloadURL;
    } catch (error) {
      console.error("Error uploading file: ", error);
      throw error;
    }
  };

  const onSaveAircraftDetails = async () => {
    console.log("Saving Aircraft Details. Location:", aircraftDetails.location);

    if (!aircraftDetails.location || aircraftDetails.location.trim() === "") {
      Alert.alert("Error", "Location is required.");
      return;
    }

    setLoading(true);
    try {
      const uploadedImages = await uploadImages(images, "aircraftImages");

      let mainImageURL = uploadedImages.length > 0 ? uploadedImages[0] : "";

      if (aircraftDetails.mainImage) {
        const mainImageIndex = images.indexOf(aircraftDetails.mainImage);
        if (mainImageIndex !== -1 && uploadedImages[mainImageIndex]) {
          mainImageURL = uploadedImages[mainImageIndex];
        }
      }

      const updatedAircraftDetails = {
        ...aircraftDetails,
        images: uploadedImages,
        mainImage: mainImageURL,
      };

      setImages(uploadedImages);
      setAircraftDetails(updatedAircraftDetails);
      setAircraftSaved(true);

      const airplanesRef = collection(db, "airplanes");
      if (selectedAircraft) {
        const aircraftDocRef = doc(db, "airplanes", selectedAircraft.id);
        await updateDoc(aircraftDocRef, {
          ...updatedAircraftDetails,
          updatedAt: serverTimestamp(),
        });

        setUserListings((prev) =>
          prev.map((aircraft) =>
            aircraft.id === selectedAircraft.id
              ? { id: selectedAircraft.id, ...updatedAircraftDetails }
              : aircraft
          )
        );
        setAllAircrafts((prev) =>
          prev.map((aircraft) =>
            aircraft.id === selectedAircraft.id
              ? { id: selectedAircraft.id, ...updatedAircraftDetails }
              : aircraft
          )
        );
      } else {
        const newAircraft = {
          ...updatedAircraftDetails,
          ownerId: resolvedOwnerId,
          createdAt: serverTimestamp(),
          isListed: true,
        };
        const docRef = await addDoc(airplanesRef, newAircraft);
        newAircraft.id = docRef.id;

        setUserListings((prev) => [...prev, newAircraft]);
        setAllAircrafts((prev) => [...prev, newAircraft]);
      }

      Alert.alert("Success", "Your aircraft details have been saved.");
      setFullScreenModalVisible(false);
      setIsListedForRent(true);
    } catch (error) {
      console.error("Error saving aircraft details:", error);
      Alert.alert("Error", "Failed to save aircraft details.");
    } finally {
      setLoading(false);
    }
  };

  const onEditAircraftDetails = () => {
    setIsEditing(true);
  };

  const handleCloseAircraftModal = async () => {
    await onSaveAircraftDetails();
    setAircraftModalVisible(false);
  };

  const onSubmitMethod = async (aircraft, additional = false) => {
    if (!aircraft.location || aircraft.location.trim() === "") {
      Alert.alert("Error", "Location is required for the selected aircraft.");
      return;
    }

    if (!aircraft.aircraftModel || aircraft.aircraftModel.trim() === "") {
      Alert.alert("Error", "Aircraft model is required.");
      return;
    }

    if (!aircraft.costPerHour || isNaN(aircraft.costPerHour)) {
      Alert.alert("Error", "Valid cost per hour is required.");
      return;
    }

    setLoading(true);
    try {
      const uploadedImages = await uploadImages(
        aircraft.images || [],
        "aircraftImages"
      );

      const annualProofURL = aircraft.currentAnnualPdf
        ? await uploadFile(aircraft.currentAnnualPdf, "documents")
        : "";
      const insuranceProofURL = aircraft.insurancePdf
        ? await uploadFile(aircraft.insurancePdf, "documents")
        : "";

      let mainImageURL = uploadedImages.length > 0 ? uploadedImages[0] : "";
      if (aircraft.mainImage) {
        const mainImageIndex = aircraft.images.indexOf(aircraft.mainImage);
        if (mainImageIndex !== -1 && uploadedImages[mainImageIndex]) {
          mainImageURL = uploadedImages[mainImageIndex];
        }
      }

      const newListing = sanitizeData({
        aircraftModel: aircraft.aircraftModel || "",
        tailNumber: aircraft.tailNumber || "",
        engineType: aircraft.engineType || "",
        totalTimeOnFrame: aircraft.totalTimeOnFrame || "",
        location: aircraft.location || "",
        airportIdentifier: aircraft.airportIdentifier || "",
        costPerHour: aircraft.costPerHour || "0",
        description: aircraft.description || "",
        images: uploadedImages.length > 0 ? uploadedImages : [],
        mainImage: mainImageURL,
        currentAnnualPdf: annualProofURL || "",
        insurancePdf: insuranceProofURL || "",
        ownerId: resolvedOwnerId,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      const airplanesRef = collection(db, "airplanes");
      const docRef = await addDoc(airplanesRef, newListing);
      newListing.id = docRef.id;

      setUserListings((prev) => [...prev, newListing]);
      setAllAircrafts((prev) => [...prev, newListing]);

      console.log("New Listing Data:", newListing);
      console.log("Listing added with ID:", docRef.id);

      Alert.alert("Success", "Your listing has been submitted.");
      setFullScreenModalVisible(false);
      setIsListedForRent(true);
    } catch (error) {
      console.error("Error submitting listing: ", error);
      Alert.alert(
        "Error",
        `There was an error submitting your listing: ${error.message}`
      );
    } finally {
      setLoading(false);
    }
  };

  const handleListForRentToggle = async () => {
    if (selectedAircraftIds.length === 0) {
      Alert.alert(
        "No Selection",
        "Please select at least one aircraft to list."
      );
      return;
    }

    setLoading(true);
    try {
      const selectedAircrafts = allAircrafts.filter((aircraft) =>
        selectedAircraftIds.includes(aircraft.id)
      );

      console.log("Selected Aircrafts for Listing:", selectedAircrafts);

      for (const aircraft of selectedAircrafts) {
        // Additional logic can be added here if needed
      }

      setSelectedAircraftIds([]);
      Alert.alert("Success", "Selected aircraft have been listed for rent.");
    } catch (error) {
      console.error("Error listing aircraft:", error);
      Alert.alert("Error", "There was an error listing the selected aircraft.");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteAllActiveRentals = async () => {
    try {
      for (const rental of activeRentals) {
        await handleDeleteActiveRental(rental.id);
      }
      Alert.alert("Deleted", "All active rentals have been deleted.");
    } catch (error) {
      console.error("Error deleting all active rentals:", error);
      Alert.alert("Error", "Failed to delete all active rentals.");
    }
  };

  const uploadImages = async (uris, folder) => {
    try {
      const uploadPromises = uris.map((uri) => uploadFile(uri, folder));
      const downloadURLs = await Promise.all(uploadPromises);
      return downloadURLs;
    } catch (error) {
      console.error("Error uploading images:", error);
      throw error;
    }
  };

  const performCleanup = async () => {
    setCleanupLoading(true);
    try {
      // Cleanup orphaned rental requests.
      // These are requests with either no listingId or with a listingId that doesn't exist in "airplanes".
      const rentalRequestsRef = collection(db, "rentalRequests");
      const rentalSnapshot = await getDocs(rentalRequestsRef);
      const batch = writeBatch(db);
      let orphanRequestsCount = 0;

      for (const rentalDoc of rentalSnapshot.docs) {
        const requestData = rentalDoc.data();
        // If no listingId is present, consider it orphaned.
        if (!requestData.listingId) {
          batch.delete(rentalDoc.ref);
          orphanRequestsCount++;
        } else {
          // Check if the corresponding airplane listing exists.
          const listingDocRef = doc(db, "airplanes", requestData.listingId);
          const listingDoc = await getDoc(listingDocRef);
          if (!listingDoc.exists()) {
            batch.delete(rentalDoc.ref);
            orphanRequestsCount++;
          }
        }
      }

      if (orphanRequestsCount > 0) {
        await batch.commit();
      }

      // Cleanup orphaned airplane listings.
      // For example, if a listing is missing an ownerId, consider it orphaned.
      const airplanesRef = collection(db, "airplanes");
      const airplanesSnapshot = await getDocs(airplanesRef);
      const batch2 = writeBatch(db);
      let orphanListingsCount = 0;

      for (const airplaneDoc of airplanesSnapshot.docs) {
        const airplaneData = airplaneDoc.data();
        if (!airplaneData.ownerId) {
          batch2.delete(airplaneDoc.ref);
          orphanListingsCount++;
        }
      }

      if (orphanListingsCount > 0) {
        await batch2.commit();
      }

      Alert.alert(
        "Cleanup Complete",
        `Deleted ${orphanRequestsCount} orphan rental request(s) and ${orphanListingsCount} orphan listing(s).`
      );
    } catch (error) {
      console.error("Error during cleanup:", error);
      Alert.alert("Cleanup Error", "An error occurred during cleanup.");
    } finally {
      setCleanupLoading(false);
    }
  };

  // ––– Define displayName for the header –––
  const displayName = (
    <Text style={{ fontSize: 20, fontWeight: "bold", color: "#fff" }}>
      {profileData.fullName ||
        user?.displayName ||
        user?.providerData?.[0]?.displayName ||
        "User"}
    </Text>
  );
  // –––––––––––––––––––––––––––––––––––––––––

  return (
    <View style={{ flex: 1, backgroundColor: "#fff" }}>
      <StatusBar
        barStyle="light-content"
        translucent
        backgroundColor="transparent"
      />

      <ScrollView
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        contentContainerStyle={{ paddingBottom: 16 }}
      >
        {/* Header Section */}
        <ImageBackground
          source={wingtipClouds}
          style={{ height: 224 }}
          resizeMode="cover"
        >
          <TouchableOpacity onPress={() => setUpdateProfileModalVisible(true)}>
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "center",
                paddingHorizontal: 16,
                paddingTop: 24,
              }}
            >
              <View>
                <Text style={{ fontSize: 14, color: "#fff" }}>Welcome</Text>
                {displayName}
              </View>
            </View>
          </TouchableOpacity>
        </ImageBackground>

        <View
          style={{
            alignItems: "center",
            marginTop: -56,
            marginBottom: 16,
          }}
        >
          <CustomButton
            onPress={() => setWithdrawModalVisible(true)}
            title={`Most Recent Payment: $${
              liveBalance
                ? (liveBalance / 100).toFixed(2)
                : (availableBalance / 100).toFixed(2)
            }`}
            backgroundColor="#000"
            style={{
              paddingHorizontal: 16,
              paddingVertical: 12,
              borderRadius: 24,
            }}
            textStyle={{ fontSize: 16, fontWeight: "bold" }}
          />
        </View>

        {/* Owner's Lounge */}
        <View style={{ alignItems: "center", marginBottom: 16 }}>
          <Text
            style={{ fontSize: 32, fontWeight: "bold", textAlign: "center" }}
          >
            Owner's Lounge
          </Text>
        </View>

        {/* New Icons Row */}
        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-around",
            paddingHorizontal: 16,
            marginBottom: 16,
          }}
        >
          <TouchableOpacity
            onPress={() => setFaqModalVisible(true)}
            style={{ alignItems: "center" }}
            accessibilityLabel="Important"
          >
            <Ionicons
              name={
                ownerTermsAgreed ? "checkmark-circle" : "alert-circle-outline"
              }
              size={36}
              color={ownerTermsAgreed ? "green" : "#3182ce"}
            />
            <Text style={{ marginTop: 4 }}>
              {ownerTermsAgreed ? "Agreed" : "Important"}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setUpdateProfileModalVisible(true)}
            style={{ alignItems: "center" }}
            accessibilityLabel="Profile"
          >
            <Ionicons name="person-circle-outline" size={36} color="#3182ce" />
            <Text style={{ marginTop: 4 }}>Profile</Text>
          </TouchableOpacity>
        </View>

        <View style={{ paddingHorizontal: 16 }}>
          <Text style={{ fontSize: 24, fontWeight: "bold", marginBottom: 16 }}>
            Cost of Ownership Calculator
          </Text>

          <TouchableOpacity
            onPress={() => setShowCalculator((prev) => !prev)}
            style={{
              backgroundColor: "#3182ce",
              padding: 12,
              borderRadius: 8,
              alignItems: "center",
              justifyContent: "center",
              marginBottom: 16,
            }}
            accessibilityLabel="Toggle Cost Calculator"
          >
            <Text style={{ color: "#fff", fontWeight: "bold" }}>
              {showCalculator ? "Hide Calculator" : "Show Calculator"}
            </Text>
          </TouchableOpacity>

          {showCalculator && (
            <>
              {costSaved ? (
                <View
                  style={{
                    backgroundColor: "#f7fafc",
                    padding: 16,
                    borderRadius: 8,
                  }}
                >
                  <Text
                    style={{
                      fontSize: 20,
                      fontWeight: "bold",
                      marginBottom: 8,
                    }}
                  >
                    Estimated Cost per Hour: ${costData.costPerHour}
                  </Text>
                  <Text style={{ fontSize: 16, marginBottom: 4 }}>
                    Recommended Rental Cost Per Hour: $
                    {Number(
                      parseFloat(costData.costPerHour) * 1.15
                    ).toLocaleString("en-US", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </Text>
                  <Text style={{ fontSize: 16, marginBottom: 4 }}>
                    Total Fixed Costs per Year: $
                    {Number(
                      parseFloat(costData.financingExpense) * 12 +
                        parseFloat(costData.insuranceCost) +
                        parseFloat(costData.hangarCost) +
                        parseFloat(costData.annualRegistrationFees) +
                        parseFloat(costData.maintenanceReserve)
                    ).toLocaleString("en-US", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </Text>
                  <Text style={{ fontSize: 16, marginBottom: 16 }}>
                    Total Variable Costs per Year: $
                    {Number(
                      (parseFloat(costData.fuelCostPerHour) +
                        parseFloat(costData.consumablesCostPerHour)) *
                        parseFloat(costData.rentalHoursPerYear)
                    ).toLocaleString("en-US", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </Text>
                  <CustomButton
                    onPress={onEditCostData}
                    title="Edit Cost Data"
                    backgroundColor="#ecc94b"
                    accessibilityLabel="Edit Cost Data button"
                  />
                </View>
              ) : (
                <View>
                  <Section title="Loan Details">
                    <CustomTextInput
                      placeholder="Loan Amount ($)"
                      value={
                        costData.loanAmount
                          ? formatNumber(costData.loanAmount)
                          : ""
                      }
                      onChangeText={(value) =>
                        handleNumericChange("loanAmount", value)
                      }
                      onBlur={() => handleNumericBlur("loanAmount")}
                      keyboardType="numeric"
                      accessibilityLabel="Loan Amount input"
                    />
                    <CustomTextInput
                      placeholder="Interest Rate (%)"
                      value={
                        costData.interestRate
                          ? formatNumber(costData.interestRate)
                          : ""
                      }
                      onChangeText={(value) =>
                        handleNumericChange("interestRate", value)
                      }
                      onBlur={() => handleNumericBlur("interestRate")}
                      keyboardType="numeric"
                      accessibilityLabel="Interest Rate input"
                    />
                    <CustomTextInput
                      placeholder="Loan Term (years)"
                      value={
                        costData.loanTerm ? formatNumber(costData.loanTerm) : ""
                      }
                      onChangeText={(value) =>
                        handleNumericChange("loanTerm", value)
                      }
                      onBlur={() => handleNumericBlur("loanTerm")}
                      keyboardType="numeric"
                      accessibilityLabel="Loan Term input"
                    />
                    <Text style={{ fontSize: 16, color: "#4a5568" }}>
                      Financing Expense: $
                      {parseFloat(costData.financingExpense || 0).toFixed(2)}
                    </Text>
                  </Section>

                  <Section title="Annual Costs">
                    <CustomTextInput
                      placeholder="Insurance Cost ($)"
                      value={
                        costData.insuranceCost
                          ? formatNumber(costData.insuranceCost)
                          : ""
                      }
                      onChangeText={(value) =>
                        handleNumericChange("insuranceCost", value)
                      }
                      onBlur={() => handleNumericBlur("insuranceCost")}
                      keyboardType="numeric"
                      accessibilityLabel="Insurance Cost input"
                    />
                    <CustomTextInput
                      placeholder="Hangar Cost ($)"
                      value={
                        costData.hangarCost
                          ? formatNumber(costData.hangarCost)
                          : ""
                      }
                      onChangeText={(value) =>
                        handleNumericChange("hangarCost", value)
                      }
                      onBlur={() => handleNumericBlur("hangarCost")}
                      keyboardType="numeric"
                      accessibilityLabel="Hangar Cost input"
                    />
                    <CustomTextInput
                      placeholder="Annual Registration & Fees ($)"
                      value={
                        costData.annualRegistrationFees
                          ? formatNumber(costData.annualRegistrationFees)
                          : ""
                      }
                      onChangeText={(value) =>
                        handleNumericChange("annualRegistrationFees", value)
                      }
                      onBlur={() => handleNumericBlur("annualRegistrationFees")}
                      keyboardType="numeric"
                      accessibilityLabel="Annual Registration & Fees input"
                    />
                    <CustomTextInput
                      placeholder="Maintenance Reserve ($)"
                      value={
                        costData.maintenanceReserve
                          ? formatNumber(costData.maintenanceReserve)
                          : ""
                      }
                      onChangeText={(value) =>
                        handleNumericChange("maintenanceReserve", value)
                      }
                      onBlur={() => handleNumericBlur("maintenanceReserve")}
                      keyboardType="numeric"
                      accessibilityLabel="Maintenance Reserve input"
                    />
                  </Section>

                  <Section title="Operational Costs">
                    <CustomTextInput
                      placeholder="Fuel Cost Per Hour ($)"
                      value={
                        costData.fuelCostPerHour
                          ? formatNumber(costData.fuelCostPerHour)
                          : ""
                      }
                      onChangeText={(value) =>
                        handleNumericChange("fuelCostPerHour", value)
                      }
                      onBlur={() => handleNumericBlur("fuelCostPerHour")}
                      keyboardType="numeric"
                      accessibilityLabel="Fuel Cost Per Hour input"
                    />
                    <CustomTextInput
                      placeholder="Consumables Cost Per Hour (e.g. tires, brake pads, etc.)"
                      value={
                        costData.consumablesCostPerHour
                          ? formatNumber(costData.consumablesCostPerHour)
                          : ""
                      }
                      onChangeText={(value) =>
                        handleNumericChange("consumablesCostPerHour", value)
                      }
                      onBlur={() => handleNumericBlur("consumablesCostPerHour")}
                      keyboardType="numeric"
                      accessibilityLabel="Consumables Cost Per Hour input"
                    />
                    <CustomTextInput
                      placeholder="Rental Hours Per Year"
                      value={
                        costData.rentalHoursPerYear
                          ? formatNumber(costData.rentalHoursPerYear)
                          : ""
                      }
                      onChangeText={(value) =>
                        handleNumericChange("rentalHoursPerYear", value)
                      }
                      onBlur={() => handleNumericBlur("rentalHoursPerYear")}
                      keyboardType="numeric"
                      accessibilityLabel="Rental Hours Per Year input"
                    />
                  </Section>

                  <CustomButton
                    onPress={saveCostData}
                    title="Save Cost Data"
                    accessibilityLabel="Save Cost Data button"
                  />
                  {loading && (
                    <ActivityIndicator
                      size="large"
                      color="#3182ce"
                      style={{ marginTop: 16 }}
                    />
                  )}
                </View>
              )}
            </>
          )}
        </View>

        {/* Connect Stripe Account Section */}
        {isStripeConnected ? (
          <View style={{ paddingHorizontal: 16, marginBottom: 16 }}>
            <CustomButton
              onPress={() => setConnectedAccountModalVisible(true)}
              title="View Connected Account"
              backgroundColor="#3182ce"
              accessibilityLabel="View your connected Stripe account details"
            />
          </View>
        ) : (
          <View style={{ paddingHorizontal: 16, marginBottom: 16 }}>
            <Text
              style={{ fontSize: 24, fontWeight: "bold", marginBottom: 16 }}
            >
              Connect Your Stripe Account
            </Text>
            <Text style={{ marginBottom: 16 }}>
              To receive payments, you need to connect your Stripe account.
            </Text>
            <TouchableOpacity
              onPress={() => setStripeInfoModalVisible(true)}
              style={{ alignSelf: "flex-end", marginBottom: 16 }}
              accessibilityLabel="What is Stripe?"
              accessibilityRole="button"
            >
              <Ionicons
                name="information-circle-outline"
                size={36}
                color="#3182ce"
              />
            </TouchableOpacity>
            <CustomButton
              onPress={() => setConnectStripeModalVisible(true)}
              title="Connect Stripe Account"
              backgroundColor="#3182ce"
              accessibilityLabel="Connect your Stripe account"
            />
          </View>
        )}

        {/* Your Aircraft Section */}
        <View style={{ paddingHorizontal: 16, marginBottom: 16 }}>
          <Text style={{ fontSize: 24, fontWeight: "bold", marginBottom: 16 }}>
            Your Aircraft
          </Text>

          <CustomButton
            onPress={() => {
              setSelectedAircraft(null);
              setIsEditing(true);
              setAircraftDetails({
                aircraftModel: "",
                tailNumber: "",
                engineType: "",
                totalTimeOnFrame: "",
                location: "",
                airportIdentifier: "",
                costPerHour: "",
                description: "",
                images: [],
                mainImage: "",
              });
              setImages([]);
              setAircraftModalVisible(true);
            }}
            title="Add Aircraft"
            backgroundColor="#3182ce"
            style={{ marginBottom: 16 }}
            accessibilityLabel="Add Aircraft button"
          />

          {allAircrafts.length > 0 ? (
            <FlatList
              data={allAircrafts}
              keyExtractor={(item, index) => `${item.id}_${index}`}
              horizontal
              showsHorizontalScrollIndicator={false}
              renderItem={({ item }) => (
                <TouchableOpacity
                  onPress={() => {
                    setSelectedAircraft(item);
                    setIsEditing(true);
                    setAircraftDetails(item);
                    setImages(item.images || []);
                    setAircraftModalVisible(true);
                  }}
                  style={{
                    width: 208,
                    marginRight: 16,
                    borderWidth: 1,
                    borderColor: "#ccc",
                    borderRadius: 8,
                    padding: 8,
                    backgroundColor: "#fff",
                  }}
                  accessibilityLabel={`View details for aircraft ${item.aircraftModel}`}
                  accessibilityRole="button"
                >
                  <TouchableOpacity
                    onPress={() => toggleSelectAircraft(item.id)}
                    style={{
                      position: "absolute",
                      top: 8,
                      left: 8,
                      width: 24,
                      height: 24,
                      borderRadius: 12,
                      backgroundColor: selectedAircraftIds.includes(item.id)
                        ? "#3182ce"
                        : "#ccc",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                    accessibilityLabel={
                      selectedAircraftIds.includes(item.id)
                        ? "Deselect aircraft"
                        : "Select aircraft"
                    }
                    accessibilityRole="button"
                  >
                    {selectedAircraftIds.includes(item.id) && (
                      <Ionicons name="checkmark" size={12} color="#fff" />
                    )}
                  </TouchableOpacity>

                  {item.mainImage ? (
                    <Image
                      source={{ uri: item.mainImage }}
                      style={{ width: "100%", height: 96, borderRadius: 8 }}
                    />
                  ) : (
                    <View
                      style={{
                        width: "100%",
                        height: 96,
                        borderRadius: 8,
                        backgroundColor: "#e2e8f0",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <Text style={{ color: "#a0aec0" }}>No Image</Text>
                    </View>
                  )}

                  <View style={{ marginTop: 8 }}>
                    <Text style={{ fontWeight: "bold", fontSize: 16 }}>
                      {item.aircraftModel}
                    </Text>
                    <Text style={{ fontSize: 14 }}>
                      Tail Number: {item.tailNumber}
                    </Text>
                    <Text style={{ fontSize: 14 }}>
                      Engine: {item.engineType}
                    </Text>
                    <Text style={{ fontSize: 14 }}>
                      Total Time: {item.totalTimeOnFrame} hours
                    </Text>
                    <Text style={{ fontSize: 14 }}>
                      Location: {item.location} ({item.airportIdentifier})
                    </Text>
                    <Text style={{ fontSize: 14 }}>
                      Cost Per Hour: ${item.costPerHour}
                    </Text>
                    <View style={{ flexDirection: "row", marginTop: 4 }}>
                      <Text
                        style={{
                          fontSize: 14,
                          color: "#4a5568",
                          marginRight: 8,
                        }}
                      >
                        Views: {item.viewCount || 0}
                      </Text>
                      {item.liveViews > 0 && (
                        <View
                          style={{
                            backgroundColor: "red",
                            paddingHorizontal: 4,
                            paddingVertical: 2,
                            borderRadius: 4,
                          }}
                        >
                          <Text style={{ color: "white", fontSize: 12 }}>
                            LIVE
                          </Text>
                        </View>
                      )}
                    </View>
                  </View>

                  <TouchableOpacity
                    onPress={() => {
                      if (item.isListed) {
                        // When currently listed, prompt to remove the listing.
                        Alert.alert(
                          "Remove Listing",
                          "Are you sure you want to remove this listing?",
                          [
                            { text: "Cancel", style: "cancel" },
                            {
                              text: "Remove",
                              style: "destructive",
                              onPress: async () => {
                                try {
                                  // Instead of deleting, update the aircraft document.
                                  await updateDoc(
                                    doc(db, "airplanes", item.id),
                                    {
                                      isListed: false,
                                    }
                                  );
                                  // Update local state to reflect the change.
                                  setUserListings((prev) =>
                                    prev.map((ac) =>
                                      ac.id === item.id
                                        ? { ...ac, isListed: false }
                                        : ac
                                    )
                                  );
                                  setAllAircrafts((prev) =>
                                    prev.map((ac) =>
                                      ac.id === item.id
                                        ? { ...ac, isListed: false }
                                        : ac
                                    )
                                  );
                                  Alert.alert(
                                    "Removed",
                                    "The listing has been removed."
                                  );
                                } catch (error) {
                                  console.error(
                                    "Error removing listing:",
                                    error
                                  );
                                  Alert.alert(
                                    "Error",
                                    "Failed to remove the listing."
                                  );
                                }
                              },
                            },
                          ]
                        );
                      } else {
                        // When not listed, allow the user to add the listing.
                        Alert.alert(
                          "Add Listing",
                          "Do you want to add this listing back?",
                          [
                            { text: "Cancel", style: "cancel" },
                            {
                              text: "Add",
                              onPress: async () => {
                                try {
                                  await updateDoc(
                                    doc(db, "airplanes", item.id),
                                    {
                                      isListed: true,
                                    }
                                  );
                                  setUserListings((prev) =>
                                    prev.map((ac) =>
                                      ac.id === item.id
                                        ? { ...ac, isListed: true }
                                        : ac
                                    )
                                  );
                                  setAllAircrafts((prev) =>
                                    prev.map((ac) =>
                                      ac.id === item.id
                                        ? { ...ac, isListed: true }
                                        : ac
                                    )
                                  );
                                  Alert.alert(
                                    "Added",
                                    "The listing has been added."
                                  );
                                } catch (error) {
                                  console.error("Error adding listing:", error);
                                  Alert.alert(
                                    "Error",
                                    "Failed to add the listing."
                                  );
                                }
                              },
                            },
                          ]
                        );
                      }
                    }}
                    style={{ marginLeft: 16 }}
                    accessibilityLabel={
                      item.isListed
                        ? `Remove listing for aircraft ${item.aircraftModel}`
                        : `Add listing for aircraft ${item.aircraftModel}`
                    }
                    accessibilityRole="button"
                  >
                    <View
                      style={{ flexDirection: "row", alignItems: "center" }}
                    >
                      <Ionicons
                        name={
                          item.isListed ? "close-circle" : "checkmark-circle"
                        }
                        size={24}
                        color={item.isListed ? "red" : "green"}
                      />
                      <Text
                        style={{
                          marginLeft: 4,
                          fontSize: 14,
                          color: item.isListed ? "red" : "green",
                        }}
                      >
                        {item.isListed ? "Hide Listing" : "Show Listing"}
                      </Text>
                    </View>
                  </TouchableOpacity>
                </TouchableOpacity>
              )}
            />
          ) : (
            <Text style={{ color: "#a0aec0" }}>No current listings.</Text>
          )}
        </View>

        {user?.email === "coryarmer@gmail.com" && (
          <View style={{ paddingHorizontal: 16, marginBottom: 16 }}>
            <Text
              style={{ fontSize: 24, fontWeight: "bold", marginBottom: 16 }}
            >
              Admin Tools
            </Text>
            <CustomButton
              onPress={() => {
                Alert.alert(
                  "Confirm Cleanup",
                  "Are you sure you want to perform cleanup? This will delete orphaned rental requests and listings.",
                  [
                    { text: "Cancel", style: "cancel" },
                    {
                      text: "Yes, Clean Up",
                      style: "destructive",
                      onPress: performCleanup,
                    },
                  ]
                );
              }}
              title="Perform Cleanup"
              backgroundColor="#e53e3e"
              style={{ marginBottom: 16 }}
              accessibilityLabel="Perform data cleanup"
            />
            {cleanupLoading && (
              <ActivityIndicator
                size="large"
                color="#e53e3e"
                style={{ marginTop: 8 }}
              />
            )}
          </View>
        )}

        <View style={{ paddingHorizontal: 16, marginBottom: 16 }}>
          <Text style={{ fontSize: 24, fontWeight: "bold", marginBottom: 16 }}>
            Incoming Rental Requests
          </Text>
          {rentalRequests.length > 0 ? (
            <FlatList
              data={rentalRequests}
              keyExtractor={(item, index) => `${item.id}_${index}`}
              nestedScrollEnabled={true}
              scrollEnabled={false}
              renderItem={({ item }) => (
                <TouchableOpacity
                  key={item.id}
                  onPress={async () => {
                    setSelectedRequest(item);
                    const listing = await fetchListingDetails(item.listingId);
                    setSelectedListingDetails(listing);
                    setRentalRequestModalVisible(true);
                  }}
                  style={{
                    borderWidth: 1,
                    borderColor: "#ccc",
                    borderRadius: 8,
                    padding: 16,
                    marginBottom: 16,
                    backgroundColor: "#fff",
                  }}
                  accessibilityLabel={`View details for rental request from ${item.renterName}`}
                  accessibilityRole="button"
                >
                  <Text style={{ fontSize: 18, fontWeight: "bold" }}>
                    Renter: {item.renterName}
                  </Text>
                  <Text style={{ fontSize: 16 }}>
                    Listing:{" "}
                    {item.listingDetails
                      ? `${item.listingDetails.aircraftModel}`
                      : "Listing details not available"}
                  </Text>
                  <Text style={{ fontSize: 16 }}>
                    Total Cost: ${item.baseCost}
                  </Text>
                  <Text style={{ fontSize: 16 }}>
                    Requested Date: {formatDate(item.rentalDate)}
                  </Text>
                  <Text style={{ fontSize: 16 }}>Status: {item.status}</Text>
                </TouchableOpacity>
              )}
            />
          ) : (
            <Text style={{ color: "#a0aec0" }}>
              No incoming rental requests.
            </Text>
          )}
        </View>

        <View style={{ paddingHorizontal: 16, marginBottom: 16 }}>
          <Text style={{ fontSize: 24, fontWeight: "bold", marginBottom: 16 }}>
            Active Rentals
          </Text>
          {activeRentals.length > 0 ? (
            <>
              {activeRentals.slice(0, 3).map((item, index) => (
                <View
                  key={item.id}
                  style={{
                    borderWidth: 1,
                    borderColor: "#ccc",
                    borderRadius: 8,
                    padding: 16,
                    marginBottom: 16,
                    backgroundColor: "#fff",
                    position: "relative",
                  }}
                >
                  <TouchableOpacity
                    onPress={() => {
                      setSelectedRequest(item);
                      setSelectedListingDetails(item.listingDetails);
                      setRentalRequestModalVisible(true);
                    }}
                    accessibilityLabel={`View details for active rental of ${item.listingDetails?.aircraftModel}`}
                    accessibilityRole="button"
                  >
                    <Text style={{ fontSize: 18, fontWeight: "bold" }}>
                      {item.listingDetails
                        ? `${item.listingDetails.aircraftModel}`
                        : "Listing details not available"}
                    </Text>
                    <Text>Renter: {item.renterName}</Text>
                    <Text>Total Cost: ${item.baseCost}</Text>
                    <Text>Rental Date: {formatDate(item.rentalDate)}</Text>
                    <Text>Status: {item.rentalStatus}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => handleDeleteActiveRental(item.id)}
                    style={{
                      position: "absolute",
                      top: 16,
                      right: 16,
                    }}
                    accessibilityLabel={`Delete active rental for ${item.listingDetails?.aircraftModel}`}
                    accessibilityRole="button"
                  >
                    <Ionicons name="close-circle" size={24} color="red" />
                  </TouchableOpacity>
                </View>
              ))}

              {activeRentals.length > 3 && (
                <CustomButton
                  onPress={() => setViewMoreModalVisible(true)}
                  title="View More"
                  backgroundColor="#3182ce"
                  style={{ marginTop: 16, marginBottom: 16 }}
                  accessibilityLabel="View more active rentals"
                />
              )}

              <CustomButton
                onPress={() =>
                  Alert.alert(
                    "Confirm Delete All",
                    "Are you sure you want to delete all active rentals? This action cannot be undone.",
                    [
                      { text: "Cancel", style: "cancel" },
                      {
                        text: "Yes, Delete All",
                        style: "destructive",
                        onPress: async () => {
                          try {
                            await handleDeleteAllActiveRentals();
                          } catch (error) {
                            console.error(
                              "Error deleting all active rentals:",
                              error
                            );
                            Alert.alert(
                              "Error",
                              "Failed to delete all active rentals."
                            );
                          }
                        },
                      },
                    ]
                  )
                }
                title="Delete All Active Rentals"
                backgroundColor="#e53e3e"
                style={{ marginTop: 16 }}
                accessibilityLabel="Delete all active rentals"
              />
            </>
          ) : (
            <Text style={{ color: "#a0aec0" }}>No active rentals.</Text>
          )}
        </View>
      </ScrollView>

      {/* Rental Request Details Modal */}
      <Modal
        visible={rentalRequestModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setRentalRequestModalVisible(false)}
      >
        <View
          style={{
            flex: 1,
            backgroundColor: "rgba(0,0,0,0.5)",
            justifyContent: "center",
            alignItems: "center",
          }}
        >
          <View
            style={{
              width: "88%",
              maxHeight: "90%",
              backgroundColor: "#fff",
              borderRadius: 8,
              padding: 24,
            }}
          >
            {selectedRequest && selectedListingDetails ? (
              <>
                <ModalHeader
                  title="Rental Request Details"
                  onClose={() => setRentalRequestModalVisible(false)}
                />
                <View style={{ marginBottom: 16 }}>
                  <Text style={{ fontSize: 16 }}>
                    <Text style={{ fontWeight: "bold" }}>Renter Name: </Text>
                    {selectedRequest.renterName}
                  </Text>
                  <Text style={{ fontSize: 16 }}>
                    <Text style={{ fontWeight: "bold" }}>Location: </Text>
                    {selectedRequest.renterCityState}
                  </Text>
                  <Text style={{ fontSize: 16 }}>
                    <Text style={{ fontWeight: "bold" }}>Rental Hours: </Text>
                    {selectedRequest.rentalHours}
                  </Text>
                  <Text style={{ fontSize: 16 }}>
                    <Text style={{ fontWeight: "bold" }}>
                      Current Medical:{" "}
                    </Text>
                    {selectedRequest.currentMedical}
                  </Text>
                  <Text style={{ fontSize: 16 }}>
                    <Text style={{ fontWeight: "bold" }}>
                      Current Renter's Insurance:{" "}
                    </Text>
                    {selectedRequest.currentRentersInsurance}
                  </Text>

                  <Text style={{ fontSize: 16 }}>
                    <Text style={{ fontWeight: "bold" }}>Listing: </Text>
                    {selectedListingDetails
                      ? `${selectedListingDetails.aircraftModel}`
                      : "Listing details not available"}
                  </Text>
                  <Text style={{ fontSize: 16 }}>
                    <Text style={{ fontWeight: "bold" }}>Rate per Hour: </Text>$
                    {selectedListingDetails.costPerHour}
                  </Text>
                  <Text style={{ fontSize: 16 }}>
                    <Text style={{ fontWeight: "bold" }}>
                      Number of Hours:{" "}
                    </Text>
                    {selectedRequest.rentalHours}
                  </Text>
                  <Text style={{ fontSize: 16 }}>
                    <Text style={{ fontWeight: "bold" }}>Base Cost: </Text>$
                    {selectedRequest.baseCost}
                  </Text>
                  <Text style={{ fontSize: 16 }}>
                    <Text style={{ fontWeight: "bold" }}>6% Commission: </Text>$
                    {selectedRequest.commission}
                  </Text>
                  <Text style={{ fontSize: 16 }}>
                    <Text style={{ fontWeight: "bold" }}>Owner's Total: </Text>$
                    {(
                      parseFloat(selectedRequest.baseCost) -
                      parseFloat(selectedRequest.commission)
                    ).toFixed(2)}
                  </Text>
                  <Text style={{ fontSize: 16 }}>
                    <Text style={{ fontWeight: "bold" }}>Requested Date: </Text>
                    {formatDate(selectedRequest.rentalDate)}
                  </Text>
                  <Text style={{ fontSize: 16 }}>
                    <Text style={{ fontWeight: "bold" }}>Status: </Text>
                    {selectedRequest.rentalStatus}
                  </Text>
                </View>

                {selectedRequest.status === "pending" && (
                  <View
                    style={{
                      flexDirection: "row",
                      justifyContent: "space-between",
                    }}
                  >
                    <CustomButton
                      onPress={() => {
                        handleApproveRentalRequest(selectedRequest);
                      }}
                      title="Approve"
                      backgroundColor="#48bb78"
                      style={{ flex: 1, marginRight: 8 }}
                      accessibilityLabel="Approve rental request"
                    />
                    <CustomButton
                      onPress={() => handleDenyRentalRequest(selectedRequest)}
                      title="Deny"
                      backgroundColor="#f56565"
                      style={{ flex: 1, marginLeft: 8 }}
                      accessibilityLabel="Deny rental request"
                    />
                  </View>
                )}

                {selectedRequest.rentalStatus === "active" && (
                  <CustomButton
                    onPress={() => setManageRentalModalVisible(true)}
                    title="Manage Rental"
                    backgroundColor="#4299e1"
                    style={{ marginTop: 16 }}
                    accessibilityLabel="Manage active rental"
                  />
                )}
              </>
            ) : (
              <ActivityIndicator size="large" color="#3182ce" />
            )}
          </View>
        </View>
      </Modal>

      {/* New Manage Rental Modal */}
      <Modal
        visible={manageRentalModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setManageRentalModalVisible(false)}
      >
        <View
          style={{
            flex: 1,
            backgroundColor: "rgba(0,0,0,0.5)",
            justifyContent: "center",
            alignItems: "center",
          }}
        >
          <View
            style={{
              width: "80%",
              backgroundColor: "#fff",
              borderRadius: 8,
              padding: 24,
            }}
          >
            <ModalHeader
              title="Manage Rental"
              onClose={() => setManageRentalModalVisible(false)}
            />
            <TouchableOpacity
              onPress={() => {
                Linking.openURL("mailto:coryarmer@gmail.com");
                setManageRentalModalVisible(false);
              }}
              style={{ paddingVertical: 12 }}
              accessibilityLabel="Contact Support"
              accessibilityRole="button"
            >
              <Text style={{ fontSize: 18, color: "#3182ce" }}>
                Contact Support
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleOpenChatForRental}
              style={{ paddingVertical: 12, marginTop: 16 }}
              accessibilityLabel="Open Chat"
              accessibilityRole="button"
            >
              <Text style={{ fontSize: 18, color: "#3182ce" }}>Open Chat</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleEndRental}
              style={{ paddingVertical: 12, marginTop: 16 }}
              accessibilityLabel="End Rental"
              accessibilityRole="button"
            >
              <Text style={{ fontSize: 18, color: "#3182ce" }}>End Rental</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Updated Messaging Modal */}
      <Modal
        visible={messageModalVisible}
        animationType="slide"
        transparent={true}
        presentationStyle="overFullScreen"
        onRequestClose={() => setMessageModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.messageModalContainer}
        >
          <View style={styles.messagesHeader}>
            <TouchableOpacity
              onPress={() => setMessageModalVisible(false)}
              style={styles.closeModalButton}
              accessibilityLabel="Close messages"
              accessibilityRole="button"
            >
              <Ionicons name="arrow-back" size={24} color="#2d3748" />
            </TouchableOpacity>

            <Text style={styles.messagesTitle}>Messages</Text>

            {/* just a spacer */}
            <View style={{ width: 24 }} />

            {/* DROP-IN: Report button */}
            <TouchableOpacity
              onPress={() => reportMessage("spam/scam")}
              style={styles.reportButton}
              accessibilityRole="button"
              accessibilityLabel="Report conversation as spam or scam"
            >
              <Text style={styles.reportText}>🚩 Report as spam/scam</Text>
            </TouchableOpacity>
          </View>

          <FlatList
            ref={flatListRef}
            data={messages}
            keyExtractor={(item, index) =>
              `${item.senderId}_${item.createdAt?.seconds}_${item.createdAt?.nanoseconds}_${index}`
            }
            renderItem={({ item, index }) => {
              const isSender = item.senderId === user.uid;

              // Get this message’s date string
              const dateObj = item.createdAt
                ? item.createdAt.toDate
                  ? item.createdAt.toDate()
                  : new Date(item.createdAt)
                : new Date();
              const thisDay = dateObj.toDateString();

              // Peek at the previous message’s date (if any)
              const prev = messages[index - 1];
              const prevDay =
                prev && prev.createdAt
                  ? (prev.createdAt.toDate
                      ? prev.createdAt.toDate()
                      : new Date(prev.createdAt)
                    ).toDateString()
                  : null;

              // Should we show the date separator?
              const showSeparator = prevDay !== thisDay;

              return (
                <View
                  style={{
                    width: "100%",
                    paddingHorizontal: 16, // inset from screen edges
                    alignItems: isSender ? "flex-end" : "flex-start",
                  }}
                >
                  {/* Date Separator */}
                  {showSeparator && (
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
                        {dateObj.toLocaleDateString()}
                      </Text>
                      <View
                        style={{ flex: 1, height: 1, backgroundColor: "#ccc" }}
                      />
                    </View>
                  )}

                  {/* Message + Header */}
                  <View
                    style={{
                      marginBottom: 4,
                      alignSelf: isSender ? "flex-end" : "flex-start",
                      maxWidth: "80%",
                    }}
                  >
                    {/* Header: name + time */}
                    <View
                      style={{
                        paddingHorizontal: 8,
                        paddingVertical: 4,
                        backgroundColor: "#fff",
                        borderTopLeftRadius: 8,
                        borderTopRightRadius: 8,
                        borderBottomWidth: 1,
                        borderColor: "#ccc",
                        alignItems: "flex-end",
                      }}
                    >
                      <Text
                        style={{
                          fontWeight: "bold",
                          fontSize: 14,
                          color: "#000",
                        }}
                      >
                        {item.senderName}
                      </Text>
                      <Text
                        style={{
                          fontWeight: "bold",
                          fontSize: 10,
                          color: "#000",
                          marginTop: 2,
                        }}
                      >
                        {dateObj.toLocaleTimeString()}
                      </Text>
                    </View>

                    {/* Bubble: auto-sized */}
                    <View
                      style={{
                        padding: 12,
                        borderBottomLeftRadius: 8,
                        borderBottomRightRadius: 8,
                        backgroundColor: isSender ? "#333" : "#e2e8f0",
                      }}
                    >
                      <Text
                        style={{
                          color: isSender ? "#fff" : "#000",
                          lineHeight: 20,
                        }}
                      >
                        {item.text}
                      </Text>
                    </View>
                  </View>
                </View>
              );
            }}
            contentContainerStyle={{ paddingBottom: 16 }}
            keyboardShouldPersistTaps="handled"
          />

          <View style={styles.messageInputContainer}>
            <TextInput
              placeholder="Type your message..."
              value={messageInput}
              onChangeText={(text) => setMessageInput(text)}
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

      {/* View More Active Rentals Modal */}
      <Modal
        visible={viewMoreModalVisible}
        animationType="slide"
        onRequestClose={() => setViewMoreModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={{ flex: 1 }}
          keyboardVerticalOffset={Platform.OS === "ios" ? 60 : 0}
        >
          <View
            style={{
              flex: 1,
              backgroundColor: "rgba(0,0,0,0.5)",
              justifyContent: "center",
              alignItems: "center",
            }}
          >
            <View
              style={{
                width: "90%",
                height: "85%",
                backgroundColor: "#fff",
                borderRadius: 8,
                padding: 24,
              }}
            >
              <ModalHeader
                title="All Active Rentals"
                onClose={() => setViewMoreModalVisible(false)}
              />
              <FlatList
                data={activeRentalsPage}
                keyExtractor={(item, index) => `${item.id}_${index}`}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    key={`activeRental_${item.id}`}
                    onPress={() => {
                      setSelectedRequest(item);
                      setSelectedListingDetails(item.listingDetails);
                      setRentalRequestModalVisible(true);
                      setViewMoreModalVisible(false);
                    }}
                    style={{
                      borderWidth: 1,
                      borderColor: "#ccc",
                      borderRadius: 8,
                      padding: 16,
                      marginBottom: 16,
                      backgroundColor: "#fff",
                    }}
                    accessibilityLabel={`View details for active rental of ${item.listingDetails?.aircraftModel}`}
                    accessibilityRole="button"
                  >
                    <Text style={{ fontSize: 18, fontWeight: "bold" }}>
                      {item.listingDetails
                        ? `${item.listingDetails.aircraftModel}`
                        : "Listing details not available"}
                    </Text>
                    <Text>Renter: {item.renterName}</Text>
                    <Text>Total Cost: ${item.baseCost}</Text>
                    <Text>Rental Date: {formatDate(item.rentalDate)}</Text>
                    <Text>Status: {item.rentalStatus}</Text>
                  </TouchableOpacity>
                )}
                ListFooterComponent={
                  hasMoreActiveRentals ? (
                    <ActivityIndicator
                      size="large"
                      color="#3182ce"
                      style={{ marginVertical: 16 }}
                    />
                  ) : (
                    <Text
                      style={{
                        textAlign: "center",
                        color: "#a0aec0",
                        marginTop: 16,
                      }}
                    >
                      No more active rentals to load.
                    </Text>
                  )
                }
                onEndReached={handleLoadMoreActiveRentals}
                onEndReachedThreshold={0.5}
                style={{ flex: 1 }}
              />
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Aircraft Details Modal */}
      <Modal
        visible={aircraftModalVisible}
        animationType="slide"
        onRequestClose={() => setAircraftModalVisible(false)}
      >
        <ScrollView style={{ flex: 1, padding: 16 }}>
          <ModalHeader
            title={isEditing ? "Edit Aircraft Details" : "Aircraft Details"}
            onClose={() => setAircraftModalVisible(false)}
          />

          <Section title="General Information">
            <CustomTextInput
              placeholder="Aircraft Model (Year/Make/Model)"
              value={aircraftDetails.aircraftModel}
              onChangeText={(value) =>
                handleInputChange("aircraftModel", value)
              }
              editable={isEditing}
              accessibilityLabel="Aircraft model input"
            />
            <CustomTextInput
              placeholder="Tail Number"
              value={aircraftDetails.tailNumber}
              onChangeText={(value) => handleInputChange("tailNumber", value)}
              editable={isEditing}
              accessibilityLabel="Tail number input"
            />
            <CustomTextInput
              placeholder="Engine Type"
              value={aircraftDetails.engineType}
              onChangeText={(value) => handleInputChange("engineType", value)}
              editable={isEditing}
              accessibilityLabel="Engine type input"
            />
            <CustomTextInput
              placeholder="Total Time on Frame (hours)"
              value={aircraftDetails.totalTimeOnFrame}
              onChangeText={(value) =>
                handleInputChange("totalTimeOnFrame", value)
              }
              keyboardType="numeric"
              editable={isEditing}
              accessibilityLabel="Total time on frame input"
            />
          </Section>

          <Section title="Location Information">
            <CustomTextInput
              placeholder="Location"
              value={aircraftDetails.location}
              onChangeText={(value) => handleInputChange("location", value)}
              editable={isEditing}
              accessibilityLabel="Location input"
            />
            <CustomTextInput
              placeholder="Airport Identifier"
              value={aircraftDetails.airportIdentifier}
              onChangeText={(value) =>
                handleInputChange("airportIdentifier", value)
              }
              editable={isEditing}
              accessibilityLabel="Airport identifier input"
            />
          </Section>

          <Section title="Cost Information">
            <CustomTextInput
              placeholder="Cost Per Hour ($)"
              value={aircraftDetails.costPerHour}
              onChangeText={(value) => handleInputChange("costPerHour", value)}
              keyboardType="numeric"
              editable={isEditing}
              accessibilityLabel="Cost per hour input"
            />
          </Section>

          <Section title="Description">
            <CustomTextInput
              placeholder="Description"
              value={aircraftDetails.description}
              onChangeText={(value) => handleInputChange("description", value)}
              style={{ height: 96, textAlignVertical: "top" }}
              multiline={true}
              editable={isEditing}
              accessibilityLabel="Description input"
            />
          </Section>

          <Section title="Images">
            <FlatList
              data={images}
              horizontal
              keyExtractor={(item, index) => `${item}_${index}`}
              renderItem={({ item }) => (
                <View style={{ position: "relative", marginRight: 8 }}>
                  <Image
                    source={{ uri: item }}
                    style={{ width: 96, height: 96, borderRadius: 8 }}
                  />
                  {isEditing && (
                    <>
                      <TouchableOpacity
                        onPress={() => selectMainImage(item)}
                        style={{
                          position: "absolute",
                          bottom: 4,
                          left: 4,
                          backgroundColor: "#3182ce",
                          paddingVertical: 4,
                          paddingHorizontal: 8,
                          borderRadius: 4,
                        }}
                        accessibilityLabel="Set as main image"
                        accessibilityRole="button"
                      >
                        <Text style={{ color: "#fff", fontSize: 12 }}>
                          Set Main
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => removeImage(item)}
                        style={{
                          position: "absolute",
                          top: 4,
                          right: 4,
                        }}
                        accessibilityLabel="Remove image"
                        accessibilityRole="button"
                      >
                        <Ionicons name="close-circle" size={20} color="red" />
                      </TouchableOpacity>
                    </>
                  )}
                </View>
              )}
              style={{ marginBottom: 8 }}
            />
            <Text style={{ color: "#a0aec0" }}>{images.length}/7 images</Text>
          </Section>

          {isEditing && (
            <>
              <CustomButton
                onPress={pickImage}
                title="Upload Images"
                backgroundColor="#3182ce"
                style={{ marginTop: 16, marginBottom: 8 }}
                accessibilityLabel="Upload images"
              />
              {images.length >= 7 && (
                <Text style={{ color: "#f56565" }}>
                  Maximum of 7 images reached.
                </Text>
              )}
            </>
          )}

          {selectedAircraft && selectedAircraft.mainImage && (
            <View style={{ marginTop: 16, alignItems: "center" }}>
              <Text
                style={{ fontSize: 16, fontWeight: "bold", marginBottom: 8 }}
              >
                Main Image:
              </Text>
              <Image
                source={{ uri: selectedAircraft.mainImage }}
                style={{ width: 192, height: 192, borderRadius: 8 }}
              />
            </View>
          )}

          <View style={{ marginTop: 24 }}>
            {isEditing ? (
              <>
                <CustomButton
                  onPress={onSaveAircraftDetails}
                  title="Save Aircraft Details"
                  backgroundColor="#3182ce"
                  style={{ marginBottom: 16 }}
                  accessibilityLabel="Save aircraft details"
                />
                <CustomButton
                  onPress={() => setAircraftModalVisible(false)}
                  title="Cancel"
                  backgroundColor="#e53e3e"
                  accessibilityLabel="Cancel aircraft details modal"
                />
              </>
            ) : (
              <CustomButton
                onPress={onEditAircraftDetails}
                title="Edit Aircraft"
                backgroundColor="#38a169"
                style={{ marginBottom: 16 }}
                accessibilityLabel="Edit aircraft details"
              />
            )}
          </View>
        </ScrollView>
      </Modal>

      {/* Connect Stripe Modal */}
      <Modal
        visible={connectStripeModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setConnectStripeModalVisible(false)}
      >
        <View
          style={{
            flex: 1,
            backgroundColor: "rgba(0,0,0,0.5)",
            justifyContent: "center",
            alignItems: "center",
          }}
        >
          <View
            style={{
              width: "88%",
              maxHeight: "90%",
              backgroundColor: "#fff",
              borderRadius: 8,
              padding: 24,
            }}
          >
            <ModalHeader
              title="Connect Stripe Account"
              onClose={() => setConnectStripeModalVisible(false)}
            />
            <TouchableOpacity
              onPress={() => setStripeInfoModalVisible(true)}
              style={{ alignSelf: "flex-end", marginBottom: 16 }}
              accessibilityLabel="What is Stripe?"
              accessibilityRole="button"
            >
              <Ionicons
                name="information-circle-outline"
                size={24}
                color="#3182ce"
              />
            </TouchableOpacity>
            <Text style={{ marginBottom: 16 }}>
              Please provide your full name and email address to connect your
              Stripe account.
            </Text>
            <CustomTextInput
              placeholder="Full Name"
              value={profileData.fullName}
              onChangeText={(value) => handleInputChange("fullName", value)}
              accessibilityLabel="Full Name input"
            />
            <CustomTextInput
              placeholder="Email Address"
              value={profileData.email}
              onChangeText={(value) => handleInputChange("email", value)}
              keyboardType="email-address"
              accessibilityLabel="Email Address input"
            />
            <CustomButton
              onPress={handleConnectStripeSubmit}
              title="Proceed"
              backgroundColor="#3182ce"
              style={{ marginTop: 16 }}
              accessibilityLabel="Proceed to connect Stripe account"
            />
            <TouchableOpacity
              onPress={() => {
                setConnectStripeModalVisible(false);
                setExistingStripeModalVisible(true);
              }}
              style={{ marginTop: 12 }}
              accessibilityLabel="Already have an account?"
              accessibilityRole="button"
            >
              <Text style={{ color: "#3182ce", textAlign: "center" }}>
                Already have an account?
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Existing Stripe Account Modal */}
      <Modal
        visible={existingStripeModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setExistingStripeModalVisible(false)}
      >
        <View
          style={{
            flex: 1,
            backgroundColor: "rgba(0,0,0,0.5)",
            justifyContent: "center",
            alignItems: "center",
          }}
        >
          <View
            style={{
              width: "88%",
              maxHeight: "90%",
              backgroundColor: "#fff",
              borderRadius: 8,
              padding: 24,
            }}
          >
            <ModalHeader
              title="Retrieve Existing Stripe Account"
              onClose={() => setExistingStripeModalVisible(false)}
            />
            <Text style={{ marginBottom: 16 }}>
              Enter your full name and email address OR your Stripe Account ID
              (e.g. acct_1QybOf00DkRxUhnr) to retrieve your existing Stripe
              account data.
            </Text>
            <CustomTextInput
              placeholder="Full Name"
              value={profileData.fullName}
              onChangeText={(value) => handleInputChange("fullName", value)}
              accessibilityLabel="Full Name input for existing account"
            />
            <CustomTextInput
              placeholder="Email Address"
              value={profileData.email}
              onChangeText={(value) => handleInputChange("email", value)}
              keyboardType="email-address"
              accessibilityLabel="Email Address input for existing account"
            />
            <CustomTextInput
              placeholder="Stripe Account ID (e.g. acct_1QybOf00DkRxUhnr)"
              value={existingStripeAccountId}
              onChangeText={(value) => setExistingStripeAccountId(value)}
              accessibilityLabel="Stripe Account ID input for existing account (optional)"
            />
            <CustomButton
              onPress={handleRetrieveExistingStripeAccount}
              title="Retrieve Account"
              backgroundColor="#3182ce"
              style={{ marginTop: 16 }}
              accessibilityLabel="Retrieve existing Stripe account"
            />
          </View>
        </View>
      </Modal>

      <Modal
        visible={withdrawModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setWithdrawModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={{ flex: 1 }}
          keyboardVerticalOffset={Platform.OS === "ios" ? 60 : 0}
        >
          <View style={styles.modalBackdrop}>
            <View style={styles.modalContent}>
              <ModalHeader
                title="Payment Information"
                onClose={() => setWithdrawModalVisible(false)}
              />

              {/* Live balance (pending deposits) */}
              <Text style={styles.modalText}>
                Live Balance:{" "}
                {liveBalance != null
                  ? `$${(liveBalance / 100).toFixed(2)}`
                  : `Loading…`}
              </Text>

              {/* Year-to-Date balance pulled live from Stripe */}
              <Text style={[styles.modalText, { fontWeight: "600" }]}>
                YTD Earnings:{" "}
                {ytdBalance != null
                  ? `$${(ytdBalance / 100).toFixed(2)}`
                  : `Loading…`}
              </Text>

              {/* Total withdrawn (historical) */}
              <Text style={[styles.modalText, { color: "#4A5568" }]}>
                Total Withdrawn: {`$${(totalWithdrawn / 100).toFixed(2)}`}
              </Text>

              <CustomButton
                onPress={() => setWithdrawModalVisible(false)}
                title="Close"
                backgroundColor="#F56565"
              />

              {loading && (
                <ActivityIndicator
                  size="large"
                  color="#3182ce"
                  style={{ marginTop: 16 }}
                />
              )}
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Stripe Info Modal */}
      <Modal
        visible={stripeInfoModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setStripeInfoModalVisible(false)}
      >
        <View
          style={{
            flex: 1,
            backgroundColor: "rgba(0,0,0,0.5)",
            justifyContent: "center",
            alignItems: "center",
          }}
        >
          <View
            style={{
              width: "88%",
              backgroundColor: "#fff",
              borderRadius: 8,
              padding: 24,
            }}
          >
            <ModalHeader
              title="About Stripe"
              onClose={() => setStripeInfoModalVisible(false)}
            />
            <Text style={{ marginBottom: 16 }}>
              Stripe is a payment processing platform that allows you to
              securely handle payments and transfers. Connecting/Creating a Stripe
              account enables you to receive payments directly to your bank
              account. For more information, tap Press Connect Stripe Account
              and it will direct you to the Stripe website for more details.
            </Text>
            <CustomButton
              onPress={() => setStripeInfoModalVisible(false)}
              title="Close"
              backgroundColor="#3182ce"
              accessibilityLabel="Close Stripe information"
            />
          </View>
        </View>
      </Modal>

      {/* Connected Account Modal */}
      <Modal
        visible={connectedAccountModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setConnectedAccountModalVisible(false)}
      >
        <View
          style={{
            flex: 1,
            backgroundColor: "rgba(0,0,0,0.5)",
            justifyContent: "center",
            alignItems: "center",
          }}
        >
          <View
            style={{
              width: "80%",
              backgroundColor: "#fff",
              borderRadius: 8,
              padding: 24,
            }}
          >
            <ModalHeader
              title="Connected Stripe Account"
              onClose={() => setConnectedAccountModalVisible(false)}
            />

            {stripeAccountId ? (
              <>
                {/* Account ID */}
                <Text style={{ fontSize: 16, marginBottom: 12 }}>
                  Your Stripe Account ID:
                  {"\n"}
                  <Text style={{ fontWeight: "bold" }}>{stripeAccountId}</Text>
                </Text>

                {/* Year-to-Date Balance */}
                <Text style={{ fontSize: 16, marginBottom: 24 }}>
                  Year-to-Date Earnings:{" "}
                  <Text style={{ fontWeight: "bold" }}>
                    {ytdBalance != null
                      ? `$${(ytdBalance / 100).toFixed(2)}`
                      : "Loading..."}
                  </Text>
                </Text>

                {/* Contact Support */}
                <TouchableOpacity
                  onPress={() =>
                    Linking.openURL("https://support.stripe.com/contact/login")
                  }
                  accessibilityRole="button"
                  style={{ marginBottom: 24 }}
                >
                  <Text
                    style={{
                      fontSize: 16,
                      color: "#3182ce",
                      textDecorationLine: "underline",
                    }}
                  >
                    Contact Stripe Support
                  </Text>
                </TouchableOpacity>
              </>
            ) : (
              <Text style={{ fontSize: 16, marginBottom: 24 }}>
                No connected account information available.
              </Text>
            )}

            {/* Switch Account */}
            <Text style={{ fontSize: 14, marginBottom: 8 }}>
              Or enter a different Stripe Account ID to switch:
            </Text>
            <TextInput
              placeholder="acct_XXXXXXXXXXXX"
              value={existingStripeAccountId}
              onChangeText={setExistingStripeAccountId}
              autoCapitalize="none"
              style={{
                borderWidth: 1,
                borderColor: "#ccc",
                borderRadius: 8,
                padding: 12,
                marginBottom: 16,
              }}
            />
            <CustomButton
              onPress={handleSwitchStripeAccount}
              title="Switch Account"
              backgroundColor="#3182ce"
            />

            {/* Close */}
            <CustomButton
              onPress={() => setConnectedAccountModalVisible(false)}
              title="Close"
              backgroundColor="#f56565"
              style={{ marginTop: 12 }}
            />
          </View>
        </View>
      </Modal>

      {/* Update Profile Modal (newly added) */}
      <Modal
        visible={updateProfileModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setUpdateProfileModalVisible(false)}
      >
        <View
          style={{
            flex: 1,
            backgroundColor: "rgba(0,0,0,0.5)",
            justifyContent: "center",
            alignItems: "center",
          }}
        >
          <View
            style={{
              width: "88%",
              backgroundColor: "#fff",
              borderRadius: 8,
              padding: 24,
            }}
          >
            <ModalHeader
              title="Update Profile"
              onClose={() => setUpdateProfileModalVisible(false)}
            />
            <CustomTextInput
              placeholder="Full Name"
              value={profileData.fullName}
              onChangeText={(value) => handleInputChange("fullName", value)}
              accessibilityLabel="Full Name input"
            />
            <CustomTextInput
              placeholder="Contact"
              value={profileData.contact}
              onChangeText={(value) => handleInputChange("contact", value)}
              accessibilityLabel="Contact input"
            />
            <CustomTextInput
              placeholder="Address"
              value={profileData.address}
              onChangeText={(value) => handleInputChange("address", value)}
              accessibilityLabel="Address input"
            />
            <CustomTextInput
              placeholder="Email Address"
              value={profileData.email}
              onChangeText={(value) => handleInputChange("email", value)}
              keyboardType="email-address"
              accessibilityLabel="Email Address input"
            />
            <CustomButton
              onPress={() => setUpdateProfileModalVisible(false)}
              title="Save"
              backgroundColor="#3182ce"
              accessibilityLabel="Save profile changes"
            />
            <View style={{ alignItems: "center", marginTop: 12 }}>
              <TouchableOpacity onPress={handleDeleteAccount}>
                <Text
                  style={{ color: "#e53e3e", textDecorationLine: "underline" }}
                >
                  Delete Account
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Important Modal */}
      <Modal
        visible={faqModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setFaqModalVisible(false)}
      >
        <View
          style={{
            flex: 1,
            backgroundColor: "rgba(0,0,0,0.5)",
            justifyContent: "center",
            alignItems: "center",
          }}
        >
          <View
            style={{
              width: "88%",
              backgroundColor: "#fff",
              borderRadius: 8,
              padding: 24,
            }}
          >
            <ModalHeader
              title="Important"
              onClose={() => setFaqModalVisible(false)}
            />

            {/* New agreement intro */}
            <Text style={{ marginBottom: 16, fontSize: 14, lineHeight: 20 }}>
              You must agree to the following before you can list your aircraft
              for rent in the Rental Marketplace.
            </Text>

            <ScrollView
              style={{ maxHeight: 400 }}
              showsHorizontalScrollIndicator={false}
            >
              <Text style={{ fontWeight: "bold", fontSize: 16, marginTop: 8 }}>
                1. You will ensure your aircraft is current on its annual.
              </Text>

              <Text style={{ fontWeight: "bold", fontSize: 16, marginTop: 8 }}>
                2. You agree to carry proper insurance.
              </Text>
              <Text style={{ marginBottom: 8, fontSize: 14 }}>
                (We recommend getting in touch with your insurance agent.)
              </Text>

              <Text style={{ fontWeight: "bold", fontSize: 16, marginTop: 8 }}>
                3. You may be required to show proof to the renter that your
                insurance is up to date.
              </Text>

              <Text style={{ fontWeight: "bold", fontSize: 16, marginTop: 8 }}>
                4. The renter will be required to show you proof of the
                following:
              </Text>
              <Text style={{ marginLeft: 16, fontSize: 14, marginBottom: 8 }}>
                a. A current copy of the renter’s insurance policy.{"\n"}
                b. Their pilot’s license.{"\n"}
                c. A copy of the most recent entries in their logbook.{"\n"}
                d. Proof of current medical.
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
                  await AsyncStorage.setItem("ownerTermsAgreed", "true");
                } catch (e) {
                  console.warn("Failed to save agreement", e);
                }
                setOwnerTermsAgreed(true);
                setFaqModalVisible(false);
              }}
              title="Agree & Proceed to List Your Aircraft"
              backgroundColor="#3182ce"
            />
          </View>
        </View>
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
              // Filter out the thread pending deletion so it isn’t shown while undo is available
              data={chatThreads.filter(
                (thread) => !pendingDeletion || thread.id !== pendingDeletion.id
              )}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => {
                // Safely retrieve the other participant's ID
                const otherParticipantId =
                  Array.isArray(item.participants) &&
                  item.participants.find((p) => p !== resolvedOwnerId);
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
                        {/* <ParticipantName
                          participantId={otherParticipantId || "Unknown"}
                        /> */}
                      </Text>
                      <ParticipantDate
                        participantId={otherParticipantId || "Unknown"}
                      />
                      <Text style={{ fontSize: 16, fontWeight: "bold" }}>
                        <ParticipantName
                          participantId={otherParticipantId || "Unknown"}
                        />
                      </Text>
                      <RentalDate rentalRequestId={item.rentalRequestId} />
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

            {/* If a thread is pending deletion, show the undo option */}
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

      {/* -- Floating Chat Bubble Icon -- */}
      <TouchableOpacity
        style={styles.chatBubbleIcon}
        onPress={async () => {
          await fetchChatThreads();
          setChatListModalVisible(true);
        }}
        accessibilityLabel="Open chat list"
        accessibilityRole="button"
      >
        {unreadCount > 0 && (
          <Animated.View
            style={[styles.badge, { transform: [{ scale: pulse }] }]}
          >
            <Text style={styles.badgeText}>{unreadCount}</Text>
          </Animated.View>
        )}
        <Ionicons name="chatbubble-ellipses" size={32} color="white" />
      </TouchableOpacity>

      {/* -- End of Floating Chat Bubble Icon -- */}
    </View>
  );
};

export default OwnerProfile;

/* -------------------
   Messaging Modal Styles
------------------- */
const styles = {
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
    backgroundColor: "#e2e8f0",
    alignSelf: "flex-start",
  },
  chatBubbleRight: {
    backgroundColor: "#000000",
    alignSelf: "flex-end",
  },
  chatSenderName: {
    fontWeight: "bold",
    color: "#2d3748",
    marginBottom: 4,
  },
  chatMessageText: {
    color: "#ffffff",
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
  // ADDED: Style for floating chat bubble icon
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
  badge: {
    position: "absolute",
    top: 4,
    right: 4,
    backgroundColor: "red",
    borderRadius: 8,
    paddingHorizontal: 4,
    minWidth: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeText: {
    color: "white",
    fontSize: 10,
    fontWeight: "bold",
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalContent: {
    width: "88%",
    maxHeight: "90%",
    backgroundColor: "#fff",
    borderRadius: 8,
    padding: 24,
  },
  modalText: {
    fontSize: 16,
    marginBottom: 16,
  },
};
