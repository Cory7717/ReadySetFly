import React, { useState, useEffect, useCallback } from "react";
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

  // New state for Manage Rental Modal
  const [manageRentalModalVisible, setManageRentalModalVisible] = useState(false);

  // ... (other state definitions remain unchanged)
  const [profileData, setProfileData] = useState({
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
  // Updated costData state without oilCostPerHour and routineMaintenancePerHour
  const [costData, setCostData] = useState({
    loanAmount: "",
    interestRate: "",
    loanTerm: "",
    insuranceCost: "",
    hangarCost: "",
    annualRegistrationFees: "",
    maintenanceReserve: "",
    fuelCostPerHour: "",
    // Removed oilCostPerHour and routineMaintenancePerHour
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

  const [rentalRequestModalVisible, setRentalRequestModalVisible] =
    useState(false);

  const [withdrawModalVisible, setWithdrawModalVisible] = useState(false);
  const [withdrawalAmount, setWithdrawalAmount] = useState("");
  const [withdrawalEmail, setWithdrawalEmail] = useState("");

  // State for "View More" Active Rentals Modal with Pagination
  const [viewMoreModalVisible, setViewMoreModalVisible] = useState(false);
  const [activeRentalsPage, setActiveRentalsPage] = useState([]);
  const [lastActiveRentalDoc, setLastActiveRentalDoc] = useState(null);
  const [hasMoreActiveRentals, setHasMoreActiveRentals] = useState(true);
  const ACTIVE_RENTALS_PAGE_SIZE = 10;

  // State for Cleanup Loading
  const [cleanupLoading, setCleanupLoading] = useState(false);

  // State for Stripe Account
  const [stripeAccountId, setStripeAccountId] = useState(null);
  const [isStripeConnected, setIsStripeConnected] = useState(false);

  // New state for Connect Stripe Modal
  const [connectStripeModalVisible, setConnectStripeModalVisible] =
    useState(false);

  // NEW: State for Existing Stripe Account Modal
  const [existingStripeModalVisible, setExistingStripeModalVisible] = useState(false);

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

  const fetchOwnerData = useCallback(async () => {
    if (!resolvedOwnerId) {
      console.error("No owner ID or user ID available.");
      Alert.alert("Error", "User is not authenticated. Please log in.");
      return;
    }

    try {
      // Read from the root user document now
      const profileDocRef = doc(db, "users", resolvedOwnerId);
      const profileDocSnap = await getDoc(profileDocRef);

      if (profileDocSnap.exists()) {
        const profile = profileDocSnap.data();
        setProfileData({
          fullName: profile.fullName || "",
          contact: profile.contact || "",
          address: profile.address || "",
          email: profile.email || user.email || "",
        });
        setStripeAccountId(profile.stripeAccountId || null);
        setIsStripeConnected(!!profile.stripeAccountId);
        setAvailableBalance(profile.availableBalance || 0);
      } else {
        console.log("No owner profile data found.");
        setIsStripeConnected(false);
        setProfileData((prev) => ({
          ...prev,
          email: user.email || "",
          fullName: user.displayName || "",
        }));
        setAvailableBalance(0);
      }

      const airplanesRef = collection(db, "airplanes");
      const q = query(
        airplanesRef,
        where("ownerId", "==", resolvedOwnerId),
        orderBy("createdAt", "desc")
      );
      const snapshot = await getDocs(q);
      const aircrafts = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setUserListings(aircrafts);
      setAllAircrafts(aircrafts);
    } catch (error) {
      console.error("Error fetching owner data:", error);
      Alert.alert("Error", "Failed to fetch saved data.");
    }
  }, [resolvedOwnerId, user]);

  useFocusEffect(
    useCallback(() => {
      fetchOwnerData();

      if (resolvedOwnerId) {
        // Listen to changes on the root user document now
        const profileDocRef = doc(db, "users", resolvedOwnerId);
        const unsubscribeBalance = onSnapshot(
          profileDocRef,
          (docSnap) => {
            if (docSnap.exists()) {
              const profile = docSnap.data();
              setAvailableBalance(profile.availableBalance || 0);
            }
          },
          (error) => {
            console.error(
              "Error listening to availableBalance updates:",
              error
            );
          }
        );

        return () => {
          unsubscribeBalance();
        };
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

  useEffect(() => {
    if (resolvedOwnerId) {
      autoSaveDataToFirestore("costData", costData);
    }
  }, [costData, resolvedOwnerId]);
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
        Alert.alert(
          "Error",
          data.error || "Failed to connect Stripe account. Please try again."
        );
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
   */
  const handleRetrieveExistingStripeAccount = async () => {
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
        // Assume that the response returns stripeAccountId
        setStripeAccountId(data.stripeAccountId);
        setIsStripeConnected(true);
        Alert.alert("Success", "Stripe account data retrieved and saved.");
        setExistingStripeModalVisible(false);
      } else {
        Alert.alert(
          "Error",
          data.error || "Failed to retrieve Stripe account data."
        );
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
   * Function to handle withdrawal.
   */
  const handleWithdraw = async () => {
    if (
      !withdrawalAmount ||
      isNaN(withdrawalAmount) ||
      parseFloat(withdrawalAmount) <= 0
    ) {
      Alert.alert("Invalid Amount", "Please enter a valid withdrawal amount.");
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!withdrawalEmail || !emailRegex.test(withdrawalEmail)) {
      Alert.alert("Invalid Email", "Please enter a valid email address.");
      return;
    }

    const amount = parseFloat(withdrawalAmount);

    if (amount > availableBalance) {
      Alert.alert(
        "Insufficient Funds",
        "The withdrawal amount exceeds your available balance."
      );
      return;
    }

    setLoading(true);
    try {
      const token = await user.getIdToken();

      const response = await fetch(`${API_URL}/withdraw-funds`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          ownerId: resolvedOwnerId,
          amount: Math.round(amount * 100),
          email: withdrawalEmail,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        Alert.alert(
          "Success",
          `You have successfully withdrawn $${amount.toFixed(
            2
          )}. An email confirmation has been sent to ${withdrawalEmail}.`
        );
        setWithdrawalAmount("");
        setWithdrawalEmail("");
        setWithdrawModalVisible(false);
      } else {
        Alert.alert(
          "Error",
          data.error ||
            "Failed to process withdrawal. Please try again or contact support."
        );
      }
    } catch (error) {
      console.error("Error processing withdrawal:", error);
      Alert.alert("Error", "There was an error processing your withdrawal.");
    } finally {
      setLoading(false);
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
          snapshot.docChanges().forEach((change) => {
            if (change.type === "added") {
              const newRequest = change.doc.data();
              if (newRequest.status === "pending") {
                Notifications.scheduleNotificationAsync({
                  content: {
                    title: "New Rental Request",
                    body:
                      "You have received a new rental request. Check your Incoming Rental Requests for details.",
                    data: { rentalRequestId: change.doc.id },
                  },
                  trigger: null,
                });
              }
            }
          });

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
                baseCost = (
                  parseFloat(rentalHours) * costPerHour
                ).toFixed(2);
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

          const pendingRequests = requestsWithDetails.filter(
            (req) => req.status === "pending"
          );
          const activeRentals = requestsWithDetails.filter(
            (req) => req.status === "active"
          );

          setRentalRequests(pendingRequests);
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

    const messageData = {
      senderId: user.uid,
      senderName: user.displayName || "Owner",
      text: messageInput,
      createdAt: new Date(),
    };

    try {
      const chatThreadId = selectedChatThreadId;
      const chatDocRef = doc(db, "messages", chatThreadId);
      const chatDoc = await getDoc(chatDocRef);
      if (chatDoc.exists()) {
        const chatData = chatDoc.data();
        await updateDoc(chatDocRef, {
          messages: [...(chatData.messages || []), messageData],
        });
      }

      setMessageInput("");
      setMessages((prevMessages) => [...prevMessages, messageData]);
    } catch (error) {
      console.error("Error sending message:", error);
      Alert.alert("Error", "Failed to send message.");
    }
  };

  /**
   * Function to open the message modal for a specific chat thread.
   */
  const openMessageModal = async (chatThreadId = null) => {
    try {
      setMessageModalVisible(true);
      setSelectedChatThreadId(chatThreadId);
      if (chatThreadId) {
        const chatDocRef = doc(db, "messages", chatThreadId);
        const chatDoc = await getDoc(chatDocRef);
        if (chatDoc.exists()) {
          const chatData = chatDoc.data();
          setMessages(chatData.messages || []);
        }
      }
    } catch (error) {
      console.error("Error opening message modal:", error);
      Alert.alert("Error", "Failed to open messages.");
    }
  };

  /**
   * Function to handle approving a rental request.
   * 
   * Updated: After approving, instead of automatically opening the chat modal,
   * the owner receives an alert indicating that a notification was sent to the renter.
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
      const totalCost = (
        parseFloat(baseCost) - parseFloat(commission)
      ).toFixed(2);

      const batch = writeBatch(db);

      const rentalRequestRef = doc(db, "rentalRequests", request.id);
      batch.update(rentalRequestRef, {
        status: "active",
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

      // Remove the automatic opening of the chat modal.
      Alert.alert(
        "Request Approved",
        `The rental request for ${formatDate(request.rentalDate)} has been approved. A notification has been sent to the renter to complete the payment.`
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
        status: "denied",
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
        console.warn(`Rental Request is missing listingId.`);
        return null;
      }

      const listingDocRef = doc(db, "airplanes", listingId);
      const listingDoc = await getDoc(listingDocRef);
      if (listingDoc.exists()) {
        const listingData = listingDoc.data();
        if (!listingData.ownerId) {
          console.warn(
            `Listing ID: ${listingId} is missing 'ownerId'. This listing will be excluded.`
          );
          return null;
        }
        return listingData;
      } else {
        console.warn(`No listing found for listingId: ${listingId}`);
        return null;
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
   * Cleanup Functions
   */
  const cleanupOrphanedRentalRequests = async () => {
    const BATCH_SIZE = 500;
    try {
      const rentalRequestsRef = collection(db, "rentalRequests");
      const snapshot = await getDocs(rentalRequestsRef);

      if (snapshot.empty) {
        Alert.alert("Cleanup", "No rental requests found to clean up.");
        return;
      }

      let batch = writeBatch(db);
      let deletions = 0;

      for (let i = 0; i < snapshot.docs.length; i++) {
        const docSnap = snapshot.docs[i];
        const requestData = docSnap.data();
        const renterId = requestData.renterId;

        if (!renterId) {
          batch.delete(docSnap.ref);
          deletions += 1;
        } else {
          const renterDocRef = doc(db, "renters", renterId);
          const renterDocSnap = await getDoc(renterDocRef);
          if (!renterDocSnap.exists()) {
            batch.delete(docSnap.ref);
            deletions += 1;
          }
        }

        if (deletions % BATCH_SIZE === 0 && deletions > 0) {
          await batch.commit();
          console.log(`${deletions} rental requests deleted so far...`);
          batch = writeBatch(db);
        }
      }

      if (deletions % BATCH_SIZE !== 0) {
        await batch.commit();
      }

      if (deletions > 0) {
        Alert.alert(
          "Cleanup Complete",
          `${deletions} orphaned rental request(s) have been deleted.`
        );
      } else {
        Alert.alert("Cleanup Complete", "No orphaned rental requests found.");
      }
    } catch (error) {
      console.error("Error cleaning up rental requests:", error);
      Alert.alert("Error", "Failed to clean up rental requests.");
    }
  };

  const cleanupOrphanedListings = async () => {
    const BATCH_SIZE = 500;
    try {
      const listingsRef = collection(db, "airplanes");
      const snapshot = await getDocs(listingsRef);

      if (snapshot.empty) {
        Alert.alert("Cleanup", "No listings found to clean up.");
        return;
      }

      let batch = writeBatch(db);
      let deletions = 0;

      for (let i = 0; i < snapshot.docs.length; i++) {
        const docSnap = snapshot.docs[i];
        const listingData = docSnap.data();
        const ownerId = listingData.ownerId;

        if (!ownerId) {
          batch.delete(docSnap.ref);
          deletions += 1;
        } else {
          const ownerDocRef = doc(db, "users", ownerId, "owners", ownerId);
          const ownerDocSnap = await getDoc(ownerDocRef);
          if (!ownerDocSnap.exists()) {
            batch.delete(docSnap.ref);
            deletions += 1;
          }
        }

        if (deletions % BATCH_SIZE === 0 && deletions > 0) {
          await batch.commit();
          console.log(`${deletions} listings deleted so far...`);
          batch = writeBatch(db);
        }
      }

      if (deletions % BATCH_SIZE !== 0) {
        await batch.commit();
      }

      if (deletions > 0) {
        Alert.alert(
          "Cleanup Complete",
          `${deletions} orphaned listing(s) have been deleted.`
        );
      } else {
        Alert.alert("Cleanup Complete", "No orphaned listings found.");
      }
    } catch (error) {
      console.error("Error cleaning up listings:", error);
      Alert.alert("Error", "Failed to clean up listings.");
    }
  };

  const performCleanup = async () => {
    setCleanupLoading(true);
    try {
      await cleanupOrphanedRentalRequests();
      await cleanupOrphanedListings();
      Alert.alert("Cleanup Success", "All cleanup operations completed.");
    } catch (error) {
      console.error("Error performing cleanup:", error);
      Alert.alert("Error", "An error occurred during cleanup.");
    } finally {
      setCleanupLoading(false);
    }
  };

  /**
   * Function to fetch the first page of active rentals when 'View More' modal is opened
   */
  useEffect(() => {
    if (viewMoreModalVisible) {
      fetchFirstPageActiveRentals();
    } else {
      setActiveRentalsPage([]);
      setLastActiveRentalDoc(null);
      setHasMoreActiveRentals(true);
    }
  }, [viewMoreModalVisible, fetchOwnerData]);

  /**
   * Function to fetch the first page of active rentals
   */
  const fetchFirstPageActiveRentals = async () => {
    setLoading(true);
    try {
      const rentalsRef = collection(db, "rentalRequests");
      const q = query(
        rentalsRef,
        where("ownerId", "==", resolvedOwnerId),
        where("status", "==", "active"),
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
   * Function to handle loading more active rentals
   */
  const handleLoadMoreActiveRentals = async () => {
    if (!hasMoreActiveRentals || loading) return;

    setLoading(true);
    try {
      const rentalsRef = collection(db, "rentalRequests");
      const q = query(
        rentalsRef,
        where("ownerId", "==", resolvedOwnerId),
        where("status", "==", "active"),
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
   * NEW: Function to handle opening chat for an active rental.
   * 
   * Updated: Now explicitly includes ownerId and renterId fields in the created chat thread.
   */
  const handleOpenChatForRental = async () => {
    try {
      const renterId = selectedRequest?.renterId;
      if (!renterId) {
        Alert.alert("Error", "No renter ID available.");
        return;
      }
      const chatThreadsQuery = query(
        collection(db, "messages"),
        where("participants", "array-contains", resolvedOwnerId)
      );
      const chatSnapshot = await getDocs(chatThreadsQuery);
      let existingChatThread = null;
      chatSnapshot.forEach((docSnap) => {
        const chatData = docSnap.data();
        if (
          chatData.participants.includes(resolvedOwnerId) &&
          chatData.participants.includes(renterId)
        ) {
          existingChatThread = { id: docSnap.id, ...chatData };
        }
      });
      let chatThreadId = existingChatThread ? existingChatThread.id : null;
      if (!chatThreadId) {
        const chatThread = {
          participants: [resolvedOwnerId, renterId],
          ownerId: resolvedOwnerId,      // <-- Added field for owner
          renterId: renterId,            // <-- Added field for renter
          rentalRequestId: selectedRequest.id,
          messages: [],
          createdAt: serverTimestamp(),
        };
        const chatDocRef = await addDoc(collection(db, "messages"), chatThread);
        chatThreadId = chatDocRef.id;
      }
      setManageRentalModalVisible(false);
      setRentalRequestModalVisible(false);
      openMessageModal(chatThreadId);
    } catch (error) {
      console.error("Error opening chat:", error);
      Alert.alert("Error", "Failed to open chat.");
    }
  };

  /**
   * Utility Functions
   */

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
      const annualRegistrationFees = parseFloat(removeCommas(costData.annualRegistrationFees));
      const maintenanceReserve = parseFloat(removeCommas(costData.maintenanceReserve));
      const fuelCostPerHour = parseFloat(removeCommas(costData.fuelCostPerHour));
      const consumablesCostPerHour = parseFloat(removeCommas(costData.consumablesCostPerHour));
      const rentalHoursPerYear = parseFloat(removeCommas(costData.rentalHoursPerYear));

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
      setCostSaved(true);
      setLoading(false);

      await setDoc(
        // Save costData to the root user document
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
    // Remove commas during input
    handleInputChange(field, value.replace(/,/g, ""));
  };

  const handleNumericBlur = (field) => {
    // Format the value when editing is complete
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
    } else if (name === "withdrawalAmount") {
      setWithdrawalAmount(value);
    } else if (name === "withdrawalEmail") {
      setWithdrawalEmail(value);
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
              <Text style={{ fontSize: 14, color: "#fff" }}>Good Morning</Text>
              <Text style={{ fontSize: 20, fontWeight: "bold", color: "#fff" }}>
                {user?.displayName || "User"}
              </Text>
            </View>
          </View>
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
            title={`$${availableBalance.toFixed(2)}`}
            backgroundColor="#000"
            style={{ width: 96, height: 48, borderRadius: 24 }}
            textStyle={{ fontSize: 18, fontWeight: "bold" }}
          />
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
                    {Number(parseFloat(costData.costPerHour) * 1.15).toLocaleString(
                      "en-US",
                      { minimumFractionDigits: 2, maximumFractionDigits: 2 }
                    )}
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
                      value={costData.loanAmount ? formatNumber(costData.loanAmount) : ""}
                      onChangeText={(value) =>
                        handleNumericChange("loanAmount", value)
                      }
                      onBlur={() => handleNumericBlur("loanAmount")}
                      keyboardType="numeric"
                      accessibilityLabel="Loan Amount input"
                    />
                    <CustomTextInput
                      placeholder="Interest Rate (%)"
                      value={costData.interestRate ? formatNumber(costData.interestRate) : ""}
                      onChangeText={(value) =>
                        handleNumericChange("interestRate", value)
                      }
                      onBlur={() => handleNumericBlur("interestRate")}
                      keyboardType="numeric"
                      accessibilityLabel="Interest Rate input"
                    />
                    <CustomTextInput
                      placeholder="Loan Term (years)"
                      value={costData.loanTerm ? formatNumber(costData.loanTerm) : ""}
                      onChangeText={(value) =>
                        handleNumericChange("loanTerm", value)
                      }
                      onBlur={() => handleNumericBlur("loanTerm")}
                      keyboardType="numeric"
                      accessibilityLabel="Loan Term input"
                    />
                    <Text style={{ fontSize: 16, color: "#4a5568" }}>
                      Financing Expense: ${parseFloat(costData.financingExpense || 0).toFixed(2)}
                    </Text>
                  </Section>

                  <Section title="Annual Costs">
                    <CustomTextInput
                      placeholder="Insurance Cost ($)"
                      value={costData.insuranceCost ? formatNumber(costData.insuranceCost) : ""}
                      onChangeText={(value) =>
                        handleNumericChange("insuranceCost", value)
                      }
                      onBlur={() => handleNumericBlur("insuranceCost")}
                      keyboardType="numeric"
                      accessibilityLabel="Insurance Cost input"
                    />
                    <CustomTextInput
                      placeholder="Hangar Cost ($)"
                      value={costData.hangarCost ? formatNumber(costData.hangarCost) : ""}
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
                      value={costData.fuelCostPerHour ? formatNumber(costData.fuelCostPerHour) : ""}
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
            <Text style={{ fontSize: 24, fontWeight: "bold", marginBottom: 16 }}>
              Connected Stripe Account
            </Text>
            <CustomButton
              onPress={() => navigation.navigate("ConnectedAccountDetails")}
              title="View Connected Account"
              backgroundColor="#3182ce"
              accessibilityLabel="View your connected Stripe account details"
            />
          </View>
        ) : (
          <View style={{ paddingHorizontal: 16, marginBottom: 16 }}>
            <Text style={{ fontSize: 24, fontWeight: "bold", marginBottom: 16 }}>
              Connect Your Stripe Account
            </Text>
            <Text style={{ marginBottom: 16 }}>
              To receive payments, you need to connect your Stripe account.
            </Text>
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
              keyExtractor={(item) => item.id}
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
                                await deleteDoc(doc(db, "airplanes", item.id));

                                setUserListings(
                                  userListings.filter((a) => a.id !== item.id)
                                );
                                setAllAircrafts(
                                  allAircrafts.filter((a) => a.id !== item.id)
                                );
                                setSelectedAircraftIds(
                                  selectedAircraftIds.filter(
                                    (id) => id !== item.id
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
                    }}
                    style={{ marginLeft: 16 }}
                    accessibilityLabel={`Remove listing for aircraft ${item.aircraftModel}`}
                    accessibilityRole="button"
                  >
                    <Ionicons name="close-circle" size={24} color="red" />
                  </TouchableOpacity>
                </TouchableOpacity>
              )}
            />
          ) : (
            <Text style={{ color: "#a0aec0" }}>No current listings.</Text>
          )}

          <TouchableOpacity
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
            style={{
              alignItems: "center",
              justifyContent: "center",
              marginTop: 16,
            }}
            accessibilityLabel="Add new aircraft"
            accessibilityRole="button"
          >
            <Ionicons name="add-circle" size={60} color="#3182ce" />
          </TouchableOpacity>
          <CustomButton
            onPress={handleListForRentToggle}
            title="List Selected Aircraft"
            backgroundColor="#38a169"
            style={{ marginTop: 16, marginBottom: 16 }}
            accessibilityLabel="List selected aircraft for rent"
          />
        </View>

        {user?.email === "admin@example.com" && (
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
                    <Text>Status: {item.status}</Text>
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
                    <Text style={{ fontWeight: "bold" }}>Current Medical: </Text>
                    {selectedRequest.currentMedical}
                  </Text>
                  <Text style={{ fontSize: 16 }}>
                    <Text style={{ fontWeight: "bold" }}>Current Renter's Insurance: </Text>
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
                    <Text style={{ fontWeight: "bold" }}>Number of Hours: </Text>
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
                    {selectedRequest.status}
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

                {selectedRequest.status === "active" && (
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
          </View>
        </View>
      </Modal>

      {/* Rental Request Message Modal */}
      <Modal
        visible={messageModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setMessageModalVisible(false)}
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
              height: "80%",
              backgroundColor: "#fff",
              borderRadius: 8,
              padding: 24,
            }}
          >
            <TouchableOpacity
              onPress={() => setMessageModalVisible(false)}
              style={{ position: "absolute", top: 16, right: 16 }}
              accessibilityLabel="Close messages"
              accessibilityRole="button"
            >
              <Ionicons name="close-circle" size={32} color="#2d3748" />
            </TouchableOpacity>

            {messages.length > 0 ? (
              <FlatList
                data={messages}
                keyExtractor={(item, index) =>
                  `${item.senderId}_${item.createdAt?.seconds}_${item.createdAt?.nanoseconds}_${index}`
                }
                renderItem={({ item }) => (
                  <View
                    style={{
                      padding: 12,
                      borderRadius: 8,
                      marginBottom: 8,
                      maxWidth: "75%",
                      alignSelf:
                        item.senderId === user.uid ? "flex-end" : "flex-start",
                      backgroundColor:
                        item.senderId === user.uid ? "#3182ce" : "#e2e8f0",
                    }}
                  >
                    <Text
                      style={{
                        fontWeight: "bold",
                        color: item.senderId === user.uid ? "#fff" : "#000",
                      }}
                    >
                      {item.senderName}:
                    </Text>
                    <Text
                      style={{
                        color: item.senderId === user.uid ? "#fff" : "#000",
                      }}
                    >
                      {item.text}
                    </Text>
                    <Text
                      style={{ fontSize: 10, color: "#a0aec0", marginTop: 4 }}
                    >
                      {item.createdAt
                        ? item.createdAt.toDate
                          ? item.createdAt.toDate().toLocaleString()
                          : new Date(item.createdAt).toLocaleString()
                        : "N/A"}
                    </Text>
                  </View>
                )}
                style={{ flex: 1 }}
              />
            ) : (
              <Text style={{ color: "#a0aec0", textAlign: "center" }}>
                No messages yet.
              </Text>
            )}

            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                marginTop: 16,
              }}
            >
              <TextInput
                placeholder="Type your message..."
                value={messageInput}
                onChangeText={(text) => setMessageInput(text)}
                style={{
                  flex: 1,
                  borderWidth: 1,
                  borderColor: "#ccc",
                  borderRadius: 8,
                  padding: 12,
                  marginRight: 8,
                }}
                keyboardType="default"
                autoCapitalize="none"
                accessibilityLabel="Type a message"
              />
              <TouchableOpacity
                onPress={sendMessage}
                style={{
                  backgroundColor: "#3182ce",
                  padding: 12,
                  borderRadius: 8,
                  alignItems: "center",
                  justifyContent: "center",
                }}
                accessibilityLabel="Send message"
                accessibilityRole="button"
              >
                <Ionicons name="send" size={24} color="#fff" />
              </TouchableOpacity>
            </View>
          </View>
        </View>
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
                    <Text>Status: {item.status}</Text>
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
            {/* NEW: Pressable text to use an existing account */}
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

      {/* NEW: Existing Stripe Account Modal */}
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
              Enter your full name and email address to retrieve your existing
              Stripe account data.
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

      {/* Updated Withdraw Funds Modal */}
      <Modal
        visible={withdrawModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setWithdrawModalVisible(false)}
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
                width: "88%",
                maxHeight: "90%",
                backgroundColor: "#fff",
                borderRadius: 8,
                padding: 24,
              }}
            >
              <ModalHeader
                title="Withdraw Funds"
                onClose={() => setWithdrawModalVisible(false)}
              />

              <Text style={{ fontSize: 16, marginBottom: 16 }}>
                Available Balance: ${availableBalance.toFixed(2)}
              </Text>

              <Text style={{ fontSize: 14, marginBottom: 16, color: "#4a5568" }}>
                Withdrawals will be processed to your connected bank account via Stripe.
              </Text>

              <Section title="Withdrawal Email">
                <CustomTextInput
                  placeholder="Email Address"
                  value={withdrawalEmail}
                  onChangeText={(value) => setWithdrawalEmail(value)}
                  keyboardType="email-address"
                  accessibilityLabel="Withdrawal email input"
                />
              </Section>

              <Section title="Withdrawal Amount">
                <CustomTextInput
                  placeholder="Amount to Withdraw ($)"
                  value={withdrawalAmount}
                  onChangeText={(value) => setWithdrawalAmount(value)}
                  keyboardType="numeric"
                  accessibilityLabel="Withdrawal amount input"
                />
              </Section>

              <CustomButton
                onPress={handleWithdraw}
                title="Withdraw"
                backgroundColor="#48bb78"
                style={{ marginTop: 16, marginBottom: 8 }}
                accessibilityLabel="Withdraw funds"
              />
              <CustomButton
                onPress={() => setWithdrawModalVisible(false)}
                title="Cancel"
                backgroundColor="#f56565"
                accessibilityLabel="Cancel withdrawal"
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
    </View>
  );
};

export default OwnerProfile;
