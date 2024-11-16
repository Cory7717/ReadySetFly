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
  StyleSheet,
  Linking,
} from "react-native";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import { db, storage, auth } from "../../firebaseConfig";
import * as ImagePicker from "expo-image-picker";
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
} from "firebase/firestore";
import { FontAwesome, Ionicons } from "@expo/vector-icons";
import wingtipClouds from "../../Assets/images/wingtip_clouds.jpg";
import { useStripe, CardField } from "@stripe/stripe-react-native";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { Picker } from "@react-native-picker/picker";
import BankDetailsForm from "../payment/BankDetailsForm";

// Define the API URL constant
const API_URL =
  "https://us-central1-ready-set-fly-71506.cloudfunctions.net/api";

// Reusable Input Component
const CustomTextInput = ({
  placeholder,
  value,
  onChangeText,
  keyboardType = "default",
  editable = true,
  multiline = false,
  style,
  ...rest
}) => (
  <TextInput
    placeholder={placeholder}
    placeholderTextColor="#888"
    value={value}
    onChangeText={onChangeText}
    keyboardType={keyboardType}
    style={[styles.input, style]}
    editable={editable}
    multiline={multiline}
    {...rest}
  />
);

// Reusable Section Component
const Section = ({ title, children }) => (
  <View style={{ marginBottom: 16 }}>
    <Text style={{ fontSize: 20, fontWeight: "bold", marginBottom: 8 }}>
      {title}
    </Text>
    {children}
  </View>
);

// Reusable Button Component
const CustomButton = ({
  onPress,
  title,
  backgroundColor = "#3182ce",
  style,
  textStyle,
  accessibilityLabel,
}) => (
  <TouchableOpacity
    onPress={onPress}
    style={[styles.button, { backgroundColor }, style]}
    accessibilityLabel={accessibilityLabel || title}
    accessibilityRole="button"
  >
    <Text style={[styles.buttonText, textStyle]}>{title}</Text>
  </TouchableOpacity>
);

// Reusable Modal Header
const ModalHeader = ({ title, onClose }) => (
  <View style={styles.modalHeader}>
    <Text style={styles.modalTitle}>{title}</Text>
    <TouchableOpacity
      onPress={onClose}
      style={styles.closeModalButton}
      accessibilityLabel="Close modal"
      accessibilityRole="button"
    >
      <Ionicons name="close" size={24} color="#2d3748" />
    </TouchableOpacity>
  </View>
);

// Helper function to format dates
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

  // State Definitions
  const [profileData, setProfileData] = useState({
    fullName: user?.displayName || "",
    contact: "",
    address: "",
    email: user?.email || "", // Include email from Firebase Auth
    // Add more owner-specific fields as needed
  });

  const [aircraftDetails, setAircraftDetails] = useState({
    aircraftModel: "", // Year/Make/Model
    tailNumber: "", // New field
    engineType: "",
    totalTimeOnFrame: "",
    location: "",
    airportIdentifier: "",
    costPerHour: "",
    description: "",
    images: [],
    mainImage: "",
    // Add more aircraft-specific fields as needed
  });

  const [initialAircraftDetails, setInitialAircraftDetails] = useState(null);
  const [allAircrafts, setAllAircrafts] = useState([]); // List of all aircraft
  const [costData, setCostData] = useState({
    purchasePrice: "",
    loanAmount: "",
    interestRate: "",
    loanTerm: "",
    depreciationRate: "",
    usefulLife: "",
    estimatedAnnualCost: "",
    insuranceCost: "",
    hangarCost: "",
    annualRegistrationFees: "",
    maintenanceReserve: "",
    oilCostPerHour: "",
    routineMaintenancePerHour: "",
    tiresPerHour: "",
    otherConsumablesPerHour: "",
    fuelCostPerHour: "",
    rentalHoursPerYear: "",
    costPerHour: "",
    mortgageExpense: "",
    depreciationExpense: "",
  });

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

  const [depositModalVisible, setDepositModalVisible] = useState(false);
  const [withdrawalAmount, setWithdrawalAmount] = useState("");
  const [withdrawalEmail, setWithdrawalEmail] = useState("");

  // Payment Method State
  const [paymentMethod, setPaymentMethod] = useState("bank"); // 'bank' or 'card'
  const [bankDetails, setBankDetails] = useState({
    accountHolderName: "",
    bankName: "",
    routingNumber: "",
    accountNumber: "",
  });
  const [cardDetails, setCardDetails] = useState({}); // State for CardField details

  // State for "View More" Active Rentals Modal with Pagination
  const [viewMoreModalVisible, setViewMoreModalVisible] = useState(false);
  const [activeRentalsPage, setActiveRentalsPage] = useState([]);
  const [lastActiveRentalDoc, setLastActiveRentalDoc] = useState(null);
  const [hasMoreActiveRentals, setHasMoreActiveRentals] = useState(true);
  const ACTIVE_RENTALS_PAGE_SIZE = 10; // Number of rentals to fetch per page

  // State for Cleanup Loading
  const [cleanupLoading, setCleanupLoading] = useState(false);

  // State for Stripe Account
  const [stripeAccountId, setStripeAccountId] = useState(null);
  const [isStripeConnected, setIsStripeConnected] = useState(false);

  // New state for Connect Stripe Modal
  const [connectStripeModalVisible, setConnectStripeModalVisible] =
    useState(false);

  /**
   * Helper function to automatically send state data to Firestore.
   * Ensures that every update is correctly persisted.
   */
  const autoSaveDataToFirestore = async (field, data) => {
    try {
      const sanitizedData = sanitizeData(data); // Sanitize data before saving
      const docRef = doc(db, "users", resolvedOwnerId, "owners", resolvedOwnerId);
      // Using setDoc with merge: true to create document if it doesn't exist
      await setDoc(docRef, { [field]: sanitizedData }, { merge: true });
      console.log(`${field} has been successfully saved to Firestore.`);
    } catch (error) {
      console.error(`Error saving ${field} to Firestore:`, error);
      // Optionally, notify the user about the error
    }
  };

  /**
   * Sanitize data by removing undefined and null values.
   * Ensures data consistency in Firestore.
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

  // UseCallback to memoize fetchOwnerData for use in useEffect and onRefresh
  const fetchOwnerData = useCallback(async () => {
    if (!resolvedOwnerId) {
      console.error("No owner ID or user ID available.");
      Alert.alert("Error", "User is not authenticated. Please log in.");
      return;
    }

    try {
      // Fetch Owner Profile Data from 'users/{uid}/owners/{ownerId}'
      const profileDocRef = doc(
        db,
        "users",
        resolvedOwnerId,
        "owners",
        resolvedOwnerId
      );
      const profileDocSnap = await getDoc(profileDocRef);

      if (profileDocSnap.exists()) {
        const profile = profileDocSnap.data();
        setProfileData({
          fullName: profile.fullName || "",
          contact: profile.contact || "",
          address: profile.address || "",
          email: profile.email || user.email || "", // Include email from Firestore or Firebase Auth
          // Add more fields as necessary
        });
        setStripeAccountId(profile.stripeAccountId || null); // Set Stripe Account ID
        setIsStripeConnected(!!profile.stripeAccountId); // Update connection status
      } else {
        console.log("No owner profile data found.");
        setIsStripeConnected(false); // Owner not connected
        // Initialize profileData with user's email
        setProfileData((prev) => ({
          ...prev,
          email: user.email || "",
          fullName: user.displayName || "",
        }));
      }

      // Fetch Aircrafts from 'airplanes' collection where ownerId == resolvedOwnerId
      const airplanesRef = collection(db, "airplanes");
      const q = query(
        airplanesRef,
        where("ownerId", "==", resolvedOwnerId),
        orderBy("createdAt", "desc")
      );
      const snapshot = await getDocs(q);
      const aircrafts = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      setUserListings(aircrafts);
      setAllAircrafts(aircrafts);
    } catch (error) {
      console.error("Error fetching owner data:", error);
      Alert.alert("Error", "Failed to fetch saved data.");
    }
  }, [resolvedOwnerId, user]);

  /**
   * UseEffect to fetch owner data on component mount and when resolvedOwnerId changes.
   */
  useFocusEffect(
    useCallback(() => {
      fetchOwnerData();
    }, [fetchOwnerData])
  );

  /**
   * UseEffect to watch and auto-save changes in profileData, aircraftDetails, costData
   */
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
    // Ensure that both email and fullName are present before proceeding
    if (!profileData.email || !profileData.fullName) {
      Alert.alert(
        "Incomplete Profile",
        "Please provide your full name and email address."
      );
      setConnectStripeModalVisible(true); // Open the modal to collect data
      return;
    }

    try {
      const token = await user.getIdToken(); // Get Firebase ID token for authentication

      const response = await fetch(`${API_URL}/create-connected-account`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          ownerId: resolvedOwnerId, // Ensure ownerId is included
          email: profileData.email,
          fullName: profileData.fullName,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        const { accountLinkUrl } = data;
        // Open the account link in a web browser
        Linking.openURL(accountLinkUrl);
      } else {
        Alert.alert(
          "Error",
          data.error || "Failed to connect Stripe account. Please try again."
        );
      }
    } catch (error) {
      console.error("Error connecting Stripe account:", error);
      Alert.alert("Error", "There was an error connecting your Stripe account.");
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
   * Function to handle withdrawal.
   * Ensures all necessary fields are validated and included.
   */
  const handleWithdraw = async () => {
    // Validate Withdrawal Amount
    if (
      !withdrawalAmount ||
      isNaN(withdrawalAmount) ||
      parseFloat(withdrawalAmount) <= 0
    ) {
      Alert.alert("Invalid Amount", "Please enter a valid withdrawal amount.");
      return;
    }

    // Validate Email
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

    // Validate Payment Method
    if (paymentMethod === "bank") {
      const { accountHolderName, bankName, routingNumber, accountNumber } =
        bankDetails;
      if (!accountHolderName || !bankName || !routingNumber || !accountNumber) {
        Alert.alert("Incomplete Details", "Please fill in all bank details.");
        return;
      }
      // Note: Implement bank account withdrawal functionality here
      Alert.alert(
        "Info",
        "Bank withdrawal functionality is currently under development."
      );
      return;
    } else if (paymentMethod === "card") {
      if (!cardDetails || !cardDetails.complete) {
        Alert.alert("Incomplete Details", "Please enter complete card details.");
        return;
      }
    }

    setLoading(true);
    try {
      let paymentMethodId = "";

      if (paymentMethod === "card") {
        // Create a Stripe payment method using the CardField
        const { error, paymentMethod: stripePaymentMethod } =
          await stripe.createPaymentMethod({
            type: "Card",
            card: cardDetails,
            billingDetails: {
              name: user.displayName || "Owner",
            },
          });

        if (error) {
          Alert.alert("Card Error", error.message);
          setLoading(false);
          return;
        }

        paymentMethodId = stripePaymentMethod.id;
      }

      // Proceed with withdrawal via backend
      const token = await user.getIdToken(); // Get Firebase ID token for authentication

      const response = await fetch(`${API_URL}/withdraw-funds`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          ownerId: resolvedOwnerId, // Ensure ownerId is included
          amount: Math.round(amount * 100), // Convert to cents if required by backend
          paymentMethodId,
          email: withdrawalEmail, // Include email in the request
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
        setWithdrawalEmail(""); // Reset email field
        setDepositModalVisible(false);
        // The availableBalance will update automatically via Firestore snapshot
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
   * Adds or removes the aircraft ID from the selectedAircraftIds array.
   */
  const toggleSelectAircraft = (aircraftId) => {
    if (selectedAircraftIds.includes(aircraftId)) {
      setSelectedAircraftIds(selectedAircraftIds.filter((id) => id !== aircraftId));
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
   * Updated to use centralized 'rentalRequests' collection.
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
          const requestsWithDetails = await Promise.all(
            snapshot.docs.map(async (docSnap) => {
              const requestData = docSnap.data();

              // Extract renter's info
              const renterId = requestData.renterId;
              let renterName = "Anonymous";
              let renterCityState = "N/A";
              let rentalHours =
                requestData.rentalHours != null ? requestData.rentalHours : "N/A";
              let currentMedical = requestData.currentMedical ? "Yes" : "No";
              let currentRentersInsurance = requestData.currentRentersInsurance
                ? "Yes"
                : "No";
              let rentalDate = requestData.rentalDate || null;

              // Fetch listing details
              const listingDetails = requestData.listingId
                ? await fetchListingDetails(requestData.listingId)
                : null;

              // Fetch renter's name and location
              if (renterId) {
                // Corrected Firestore path
                const renterDocRef = doc(db, "renters", renterId);
                const renterDocSnap = await getDoc(renterDocRef);
                if (renterDocSnap.exists()) {
                  const renterData = renterDocSnap.data();
                  console.log("Renter Data:", renterData); // Debugging line
                  renterName = renterData.fullName || "Anonymous";
                  renterCityState = renterData.currentLocation || "N/A";
                }
              }

              // Calculate baseCost, commission, and totalCost if not already calculated
              let baseCost = requestData.baseCost;
              let commission = requestData.commission;
              if (!baseCost && listingDetails) {
                const costPerHour = parseFloat(listingDetails.costPerHour);
                baseCost = (parseFloat(rentalHours) * costPerHour).toFixed(2);
                commission = (baseCost * 0.06).toFixed(2); // 6% commission
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

          // Separate rental requests into pending and active
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

      // Ensure rentalHours and costPerHour are available
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

      // Calculate baseCost, commission, and totalCost
      const baseCost = (parseFloat(rentalHours) * costPerHour).toFixed(2);
      const commission = (baseCost * 0.06).toFixed(2); // 6% commission
      const totalCost = (parseFloat(baseCost) - parseFloat(commission)).toFixed(2);

      // Start a batch write to ensure atomicity
      const batch = writeBatch(db);

      // Update the rental request status to 'active' in 'rentalRequests' collection
      const rentalRequestRef = doc(db, "rentalRequests", request.id);
      batch.update(rentalRequestRef, {
        status: "active",
        rentalDate: request.rentalDate, // Use the date from the request
        baseCost,
        commission,
        totalCost,
      });

      // Notify the renter with rentalRequestId
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
        rentalRequestId: request.id, // Include rentalRequestId
        listingId: request.listingId,
        ownerId: resolvedOwnerId,
        ownerName: ownerName, // Include owner name
        rentalDate: request.rentalDate,
        createdAt: serverTimestamp(),
      };
      const notificationDoc = doc(notificationRef); // Auto-generated ID
      batch.set(notificationDoc, notificationData);

      // Commit the batch
      await batch.commit();

      // Handle Chat Threads
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
          messages: [],
          rentalRequestId: request.id,
          createdAt: serverTimestamp(),
        };
        const chatDocRef = await addDoc(collection(db, "messages"), chatThread);
        chatThread.id = chatDocRef.id;
        setChatThreads([...chatThreads, chatThread]);
        chatThreadId = chatDocRef.id;
      }

      Alert.alert(
        "Request Approved",
        `The rental request for ${formatDate(
          request.rentalDate
        )} has been approved.`
      );

      // Open the message modal for the chat thread
      openMessageModal(chatThreadId);
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

      // Start a batch write to ensure atomicity
      const batch = writeBatch(db);

      // Update the rental request status to 'denied' in 'rentalRequests' collection
      const rentalRequestRef = doc(db, "rentalRequests", request.id);
      batch.update(rentalRequestRef, {
        status: "denied",
      });

      // Notify the renter with rentalRequestId
      const notificationRef = collection(
        db,
        "renters",
        renterId,
        "notifications"
      );
      const notificationData = {
        type: "rentalDenied",
        message: "Your rental request has been denied by the owner.",
        rentalRequestId: request.id, // Include rentalRequestId
        listingId: request.listingId,
        ownerId: resolvedOwnerId,
        createdAt: serverTimestamp(),
      };
      const notificationDoc = doc(notificationRef); // Auto-generated ID
      batch.set(notificationDoc, notificationData);

      // Commit the batch
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
   * Removes the rental request from the 'rentalRequests' collection.
   */
  const handleDeleteActiveRental = async (rentalId) => {
    try {
      // Delete the rental request document from Firestore
      const rentalRequestRef = doc(db, "rentalRequests", rentalId);
      await deleteDoc(rentalRequestRef);

      // Remove the rental from the activeRentals state
      setActiveRentals(activeRentals.filter((rental) => rental.id !== rentalId));

      // Remove the rental from the activeRentalsPage state
      setActiveRentalsPage(
        activeRentalsPage.filter((rental) => rental.id !== rentalId)
      );

      // Remove from selectedAircraftIds if selected
      setSelectedAircraftIds(selectedAircraftIds.filter((id) => id !== rentalId));

      Alert.alert("Deleted", "The active rental has been deleted.");
    } catch (error) {
      console.error("Error deleting active rental:", error);
      Alert.alert("Error", "Failed to delete the active rental.");
    }
  };

  /**
   * Cleanup Functions
   * These functions ensure data integrity by removing orphaned rental requests and listings.
   */
  // Function to clean up orphaned rental requests
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
          // If renterId is missing, delete the rental request
          batch.delete(docSnap.ref);
          deletions += 1;
        } else {
          const renterDocRef = doc(db, "renters", renterId);
          const renterDocSnap = await getDoc(renterDocRef);
          if (!renterDocSnap.exists()) {
            // If renter document does not exist, delete the rental request
            batch.delete(docSnap.ref);
            deletions += 1;
          }
        }

        // Commit the batch every BATCH_SIZE deletions
        if (deletions % BATCH_SIZE === 0 && deletions > 0) {
          await batch.commit();
          console.log(`${deletions} rental requests deleted so far...`);
          batch = writeBatch(db); // Reset the batch
        }
      }

      // Commit any remaining deletions
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

  // Function to clean up orphaned listings
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
          // If ownerId is missing, delete the listing
          batch.delete(docSnap.ref);
          deletions += 1;
        } else {
          const ownerDocRef = doc(db, "users", ownerId, "owners", ownerId);
          const ownerDocSnap = await getDoc(ownerDocRef);
          if (!ownerDocSnap.exists()) {
            // If owner document does not exist, delete the listing
            batch.delete(docSnap.ref);
            deletions += 1;
          }
        }

        // Commit the batch every BATCH_SIZE deletions
        if (deletions % BATCH_SIZE === 0 && deletions > 0) {
          await batch.commit();
          console.log(`${deletions} listings deleted so far...`);
          batch = writeBatch(db); // Reset the batch
        }
      }

      // Commit any remaining deletions
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

  // General cleanup function
  const performCleanup = async () => {
    setCleanupLoading(true);
    try {
      await cleanupOrphanedRentalRequests();
      await cleanupOrphanedListings();
      // Add more cleanup functions here if needed
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
      // Reset pagination when modal is closed
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
   * Utility Functions
   */

  /**
   * Function to save cost data.
   * Calculates and persists cost-related information.
   */
  const saveCostData = async () => {
    setLoading(true);
    try {
      // Validate Inputs
      const requiredFields = Object.values(costData).filter(
        (field) => field === ""
      );
      if (requiredFields.length > 0) {
        Alert.alert(
          "Error",
          "Please fill in all fields for accurate calculation."
        );
        setLoading(false);
        return;
      }

      // Calculate Monthly Mortgage Expense
      const monthlyInterestRate = parseFloat(costData.interestRate) / 100 / 12;
      const numberOfPayments = parseFloat(costData.loanTerm) * 12;
      const principal = parseFloat(costData.loanAmount);
      const mortgageExpense = principal
        ? (
            (principal * monthlyInterestRate) /
            (1 - Math.pow(1 + monthlyInterestRate, -numberOfPayments))
          ).toFixed(2)
        : 0;

      // Calculate Depreciation Expense
      const depreciationExpense = (
        (parseFloat(costData.purchasePrice) * parseFloat(costData.depreciationRate)) /
        100
      ).toFixed(2);

      // Total Fixed Costs per Year
      const totalFixedCosts =
        parseFloat(mortgageExpense) * 12 +
        parseFloat(depreciationExpense) +
        parseFloat(costData.insuranceCost) +
        parseFloat(costData.hangarCost) +
        parseFloat(costData.maintenanceReserve) +
        parseFloat(costData.annualRegistrationFees);

      // Total Variable Costs per Year
      const totalVariableCosts =
        (parseFloat(costData.fuelCostPerHour) +
          parseFloat(costData.oilCostPerHour) +
          parseFloat(costData.routineMaintenancePerHour) +
          parseFloat(costData.tiresPerHour) +
          parseFloat(costData.otherConsumablesPerHour)) *
        parseFloat(costData.rentalHoursPerYear);

      // Total Cost per Year
      const totalCostPerYear = totalFixedCosts + totalVariableCosts;

      // Cost per Hour
      const costPerHour = (
        totalCostPerYear / parseFloat(costData.rentalHoursPerYear)
      ).toFixed(2);

      setCostData((prev) => ({
        ...prev,
        costPerHour,
        mortgageExpense,
        depreciationExpense,
      }));
      setCostSaved(true);
      setLoading(false);

      // Persist cost data to Firestore using setDoc with merge: true
      await setDoc(
        doc(db, "users", resolvedOwnerId, "owners", resolvedOwnerId),
        {
          costData: sanitizeData({
            ...costData,
            costPerHour,
            mortgageExpense,
            depreciationExpense,
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

  /**
   * Function to handle input changes in various sections.
   * Ensures that all changes are correctly reflected in the state.
   */
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

  /**
   * Function to pick images using Expo ImagePicker.
   * Ensures that the maximum number of images is not exceeded.
   */
  const pickImage = async () => {
    if (images.length >= 7) {
      Alert.alert("Limit Reached", "You can only upload up to 7 images.");
      return;
    }

    // Disable allowsEditing when allowsMultipleSelection is enabled
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      allowsEditing: false,
      aspect: [4, 3],
      quality: 1,
      selectionLimit: 7 - images.length, // Allow selecting multiple images up to the limit
    });

    if (!result.canceled) {
      const selectedUris = result.assets.map((asset) => asset.uri);
      setImages([...images, ...selectedUris]);
    }
  };

  /**
   * Function to remove an image from the list.
   * Ensures that the main image is updated if necessary.
   */
  const removeImage = (uri) => {
    setImages(images.filter((image) => image !== uri));
    if (aircraftDetails.mainImage === uri) {
      setAircraftDetails((prev) => ({
        ...prev,
        mainImage: images.length > 1 ? images[0] : "",
      }));
    }
  };

  /**
   * Function to upload a file (image or PDF) to Firebase Storage.
   * Returns the download URL of the uploaded file.
   */
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

  /**
   * Function to handle saving aircraft details.
   * Ensures that `ownerId` is included and correctly set.
   */
  const onSaveAircraftDetails = async () => {
    // Debugging: Log current location value
    console.log("Saving Aircraft Details. Location:", aircraftDetails.location);

    if (!aircraftDetails.location || aircraftDetails.location.trim() === "") {
      Alert.alert("Error", "Location is required.");
      return;
    }

    setLoading(true);
    try {
      // **Step 1: Upload images to Firebase Storage and get download URLs**
      const uploadedImages = await uploadImages(images, "aircraftImages");

      // **Step 2: Determine the main image URL based on the original selection**
      let mainImageURL = uploadedImages.length > 0 ? uploadedImages[0] : "";

      if (aircraftDetails.mainImage) {
        const mainImageIndex = images.indexOf(aircraftDetails.mainImage);
        if (mainImageIndex !== -1 && uploadedImages[mainImageIndex]) {
          mainImageURL = uploadedImages[mainImageIndex];
        }
      }

      // **Step 3: Update aircraftDetails with uploaded images and mainImage URL**
      const updatedAircraftDetails = {
        ...aircraftDetails,
        images: uploadedImages,
        mainImage: mainImageURL,
      };

      // **Step 4: Update state**
      setImages(uploadedImages);
      setAircraftDetails(updatedAircraftDetails);
      setAircraftSaved(true);

      // **Step 5: Update Firestore using setDoc**
      const airplanesRef = collection(db, "airplanes");
      if (selectedAircraft) {
        // Editing an existing aircraft
        const aircraftDocRef = doc(db, "airplanes", selectedAircraft.id);
        await updateDoc(aircraftDocRef, {
          ...updatedAircraftDetails,
          updatedAt: serverTimestamp(),
        });

        // Update local state
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
        // Adding a new aircraft
        const newAircraft = {
          ...updatedAircraftDetails,
          ownerId: resolvedOwnerId, // Ensure ownerId is included
          createdAt: serverTimestamp(),
        };
        const docRef = await addDoc(airplanesRef, newAircraft);
        newAircraft.id = docRef.id;

        // **Step 7: Update State**
        setUserListings((prev) => [...prev, newAircraft]);
        setAllAircrafts((prev) => [...prev, newAircraft]);
      }

      Alert.alert("Success", "Your aircraft details have been saved.");
      setAircraftModalVisible(false); // Close the modal after saving
    } catch (error) {
      console.error("Error saving aircraft details:", error);
      Alert.alert("Error", "Failed to save aircraft details.");
    } finally {
      setLoading(false);
    }
  };

  /**
   * Function to initiate editing of aircraft details.
   */
  const onEditAircraftDetails = () => {
    setIsEditing(true);
  };

  /**
   * Function to handle closing the aircraft modal.
   * Saves the aircraft details before closing.
   */
  const handleCloseAircraftModal = async () => {
    await onSaveAircraftDetails();
    setAircraftModalVisible(false);
  };

  /**
   * Handles the submission of aircraft listings.
   * Updated to align with the 'airplanes' collection structure.
   */
  const onSubmitMethod = async (aircraft, additional = false) => {
    // Validate necessary fields from the passed aircraft
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
      // **Step 1: Upload Images**
      const uploadedImages = await uploadImages(
        aircraft.images || [],
        "aircraftImages"
      );

      // **Step 2: Upload PDFs (if any)**
      const annualProofURL = aircraft.currentAnnualPdf
        ? await uploadFile(aircraft.currentAnnualPdf, "documents")
        : "";
      const insuranceProofURL = aircraft.insurancePdf
        ? await uploadFile(aircraft.insurancePdf, "documents")
        : "";

      // **Step 3: Determine Main Image**
      let mainImageURL = uploadedImages.length > 0 ? uploadedImages[0] : "";
      if (aircraft.mainImage) {
        const mainImageIndex = aircraft.images.indexOf(aircraft.mainImage);
        if (mainImageIndex !== -1 && uploadedImages[mainImageIndex]) {
          mainImageURL = uploadedImages[mainImageIndex];
        }
      }

      // **Step 4: Prepare New Listing Data**
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
        ownerId: resolvedOwnerId, // **Ensure ownerId is included**
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      // **Step 5: Add Listing to Firestore**
      const airplanesRef = collection(db, "airplanes");
      const docRef = await addDoc(airplanesRef, newListing);
      newListing.id = docRef.id; // Assign listingId

      // **Step 6: Update State**
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

  /**
   * Function to toggle the listing of selected aircraft.
   * Ensures that only selected aircraft are listed for rent.
   */
  const handleListForRentToggle = async () => {
    if (selectedAircraftIds.length === 0) {
      Alert.alert("No Selection", "Please select at least one aircraft to list.");
      return;
    }

    setLoading(true);
    try {
      // Fetch the selected aircraft details
      const selectedAircrafts = allAircrafts.filter((aircraft) =>
        selectedAircraftIds.includes(aircraft.id)
      );

      console.log("Selected Aircrafts for Listing:", selectedAircrafts);

      // List each selected aircraft
      for (const aircraft of selectedAircrafts) {
        // You can implement additional logic here if needed
        // For now, we're assuming the aircraft is already listed in 'airplanes' collection
        // If additional actions are required, implement them here
      }

      // Reset selection after listing
      setSelectedAircraftIds([]);
      Alert.alert("Success", "Selected aircraft have been listed for rent.");
    } catch (error) {
      console.error("Error listing aircraft:", error);
      Alert.alert("Error", "There was an error listing the selected aircraft.");
    } finally {
      setLoading(false);
    }
  };

  /**
   * Function to handle deleting all active rentals.
   * Ensures that rentals are removed from the 'rentalRequests' collection.
   */
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

  /**
   * Function to upload multiple images concurrently.
   * Enhances performance by uploading all images in parallel.
   */
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
    <View style={{ flex: 1, backgroundColor: "white" }}>
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
          style={{
            height: 224,
            paddingTop: Platform.OS === "android" ? StatusBar.currentHeight : 0,
          }}
          resizeMode="cover"
        >
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
              paddingHorizontal: 16,
              paddingTop:
                Platform.OS === "android" ? StatusBar.currentHeight + 8 : 16,
            }}
          >
            <View>
              <Text style={{ fontSize: 14, color: "white", marginTop: 1 }}>
                Good Morning
              </Text>
              <Text style={{ fontSize: 18, fontWeight: "bold", color: "white" }}>
                {user?.displayName || "User"}
              </Text>
            </View>
            {/* Removed Funds Button from Header */}
          </View>
        </ImageBackground>

        {/* Funds Button Above Cost of Ownership */}
        <View style={styles.fundsButtonContainer}>
          <CustomButton
            onPress={() => setDepositModalVisible(true)}
            title={`$${availableBalance.toFixed(2)}`}
            backgroundColor="#000000" // Changed to black
            style={styles.fundsButtonStyle}
            textStyle={styles.fundsButtonTextStyle}
          />
        </View>
        {/* End of Funds Button Placement */}

        {/* Cost of Ownership Calculator */}
        <View style={{ padding: 16 }}>
          <Text style={{ fontSize: 24, fontWeight: "bold", marginBottom: 16 }}>
            Cost of Ownership Calculator
          </Text>
          {costSaved ? (
            <View style={styles.calculatorResultContainer}>
              <Text style={styles.calculatorTitle}>
                Estimated Cost per Hour: ${costData.costPerHour}
              </Text>
              <Text style={styles.calculatorText}>
                Total Fixed Costs per Year: $
                {(
                  parseFloat(costData.mortgageExpense) * 12 +
                  parseFloat(costData.depreciationExpense) +
                  parseFloat(costData.insuranceCost) +
                  parseFloat(costData.hangarCost) +
                  parseFloat(costData.maintenanceReserve) +
                  parseFloat(costData.annualRegistrationFees)
                ).toFixed(2)}
              </Text>
              <Text style={styles.calculatorText}>
                Total Variable Costs per Year: $
                {(
                  (parseFloat(costData.fuelCostPerHour) +
                    parseFloat(costData.oilCostPerHour) +
                    parseFloat(costData.routineMaintenancePerHour) +
                    parseFloat(costData.tiresPerHour) +
                    parseFloat(costData.otherConsumablesPerHour)) *
                  parseFloat(costData.rentalHoursPerYear)
                ).toFixed(2)}
              </Text>
              <CustomButton
                onPress={onEditCostData}
                title="Edit Cost Data"
                style={{ marginTop: 16 }}
              />
            </View>
          ) : (
            <View>
              {/* Loan Details Section */}
              <Section title="Loan Details">
                <CustomTextInput
                  placeholder="Purchase Price ($)"
                  value={costData.purchasePrice}
                  onChangeText={(value) =>
                    handleInputChange("purchasePrice", value)
                  }
                  keyboardType="numeric"
                  accessibilityLabel="Purchase Price input"
                />
                <CustomTextInput
                  placeholder="Loan Amount ($)"
                  value={costData.loanAmount}
                  onChangeText={(value) => handleInputChange("loanAmount", value)}
                  keyboardType="numeric"
                  accessibilityLabel="Loan Amount input"
                />
                <CustomTextInput
                  placeholder="Interest Rate (%)"
                  value={costData.interestRate}
                  onChangeText={(value) =>
                    handleInputChange("interestRate", value)
                  }
                  keyboardType="numeric"
                  accessibilityLabel="Interest Rate input"
                />
                <CustomTextInput
                  placeholder="Loan Term (years)"
                  value={costData.loanTerm}
                  onChangeText={(value) => handleInputChange("loanTerm", value)}
                  keyboardType="numeric"
                  accessibilityLabel="Loan Term input"
                />
                <CustomTextInput
                  placeholder="Depreciation Rate (%)"
                  value={costData.depreciationRate}
                  onChangeText={(value) =>
                    handleInputChange("depreciationRate", value)
                  }
                  keyboardType="numeric"
                  accessibilityLabel="Depreciation Rate input"
                />
                <CustomTextInput
                  placeholder="Useful Life (years)"
                  value={costData.usefulLife}
                  onChangeText={(value) => handleInputChange("usefulLife", value)}
                  keyboardType="numeric"
                  accessibilityLabel="Useful Life input"
                />
                <Text style={styles.modalText}>
                  Mortgage Expense: ${costData.mortgageExpense}
                </Text>
                <Text style={styles.modalText}>
                  Depreciation Expense: ${costData.depreciationExpense}
                </Text>
              </Section>

              {/* Annual Costs Section */}
              <Section title="Annual Costs">
                <CustomTextInput
                  placeholder="Estimated Annual Cost ($)"
                  value={costData.estimatedAnnualCost}
                  onChangeText={(value) =>
                    handleInputChange("estimatedAnnualCost", value)
                  }
                  keyboardType="numeric"
                  accessibilityLabel="Estimated Annual Cost input"
                />
                <CustomTextInput
                  placeholder="Insurance Cost ($)"
                  value={costData.insuranceCost}
                  onChangeText={(value) =>
                    handleInputChange("insuranceCost", value)
                  }
                  keyboardType="numeric"
                  accessibilityLabel="Insurance Cost input"
                />
                <CustomTextInput
                  placeholder="Hangar Cost ($)"
                  value={costData.hangarCost}
                  onChangeText={(value) => handleInputChange("hangarCost", value)}
                  keyboardType="numeric"
                  accessibilityLabel="Hangar Cost input"
                />
                <CustomTextInput
                  placeholder="Annual Registration & Fees ($)"
                  value={costData.annualRegistrationFees}
                  onChangeText={(value) =>
                    handleInputChange("annualRegistrationFees", value)
                  }
                  keyboardType="numeric"
                  accessibilityLabel="Annual Registration & Fees input"
                />
                <CustomTextInput
                  placeholder="Maintenance Reserve ($)"
                  value={costData.maintenanceReserve}
                  onChangeText={(value) =>
                    handleInputChange("maintenanceReserve", value)
                  }
                  keyboardType="numeric"
                  accessibilityLabel="Maintenance Reserve input"
                />
              </Section>

              {/* Operational Costs Section */}
              <Section title="Operational Costs">
                <CustomTextInput
                  placeholder="Fuel Cost Per Hour ($)"
                  value={costData.fuelCostPerHour}
                  onChangeText={(value) =>
                    handleInputChange("fuelCostPerHour", value)
                  }
                  keyboardType="numeric"
                  accessibilityLabel="Fuel Cost Per Hour input"
                />
                <CustomTextInput
                  placeholder="Oil Cost Per Hour ($)"
                  value={costData.oilCostPerHour}
                  onChangeText={(value) =>
                    handleInputChange("oilCostPerHour", value)
                  }
                  keyboardType="numeric"
                  accessibilityLabel="Oil Cost Per Hour input"
                />
                <CustomTextInput
                  placeholder="Routine Maintenance Per Hour ($)"
                  value={costData.routineMaintenancePerHour}
                  onChangeText={(value) =>
                    handleInputChange("routineMaintenancePerHour", value)
                  }
                  keyboardType="numeric"
                  accessibilityLabel="Routine Maintenance Per Hour input"
                />
                <CustomTextInput
                  placeholder="Tires Per Hour ($)"
                  value={costData.tiresPerHour}
                  onChangeText={(value) =>
                    handleInputChange("tiresPerHour", value)
                  }
                  keyboardType="numeric"
                  accessibilityLabel="Tires Per Hour input"
                />
                <CustomTextInput
                  placeholder="Other Consumables Per Hour ($)"
                  value={costData.otherConsumablesPerHour}
                  onChangeText={(value) =>
                    handleInputChange("otherConsumablesPerHour", value)
                  }
                  keyboardType="numeric"
                  accessibilityLabel="Other Consumables Per Hour input"
                />
                <CustomTextInput
                  placeholder="Rental Hours Per Year"
                  value={costData.rentalHoursPerYear}
                  onChangeText={(value) =>
                    handleInputChange("rentalHoursPerYear", value)
                  }
                  keyboardType="numeric"
                  accessibilityLabel="Rental Hours Per Year input"
                />
              </Section>

              <CustomButton
                onPress={saveCostData}
                title="Save Cost Data"
                accessibilityLabel="Save Cost Data button"
                accessibilityRole="button"
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
        </View>
        {/* End of Cost of Ownership Calculator */}

        {/* Connect Stripe Account Section */}
        {!isStripeConnected && (
          <View style={{ padding: 16 }}>
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
              accessibilityRole="button"
            />
          </View>
        )}
        {/* ************* Updated Section: Your Aircraft ************* */}
        <View style={{ padding: 16 }}>
          <Text style={{ fontSize: 24, fontWeight: "bold", marginBottom: 16 }}>
            Your Aircraft
          </Text>

          {/* Add Aircraft Button */}
          <CustomButton
            onPress={() => {
              setSelectedAircraft(null);
              setIsEditing(true);
              setAircraftDetails({
                aircraftModel: "",
                tailNumber: "", // New field
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
            accessibilityRole="button"
          />

          {/* Horizontal ScrollView for Aircraft Cards */}
          {allAircrafts.length > 0 ? (
            <FlatList
              data={allAircrafts}
              keyExtractor={(item) => item.id} // Ensure unique keys
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
                  style={styles.aircraftCard}
                  accessibilityLabel={`View details for aircraft ${item.aircraftModel}`}
                  accessibilityRole="button"
                >
                  {/* Circle Selection Button */}
                  <TouchableOpacity
                    onPress={() => toggleSelectAircraft(item.id)}
                    style={[
                      styles.selectionButton,
                      selectedAircraftIds.includes(item.id)
                        ? styles.selectionButtonSelected
                        : styles.selectionButtonUnselected,
                    ]}
                    accessibilityLabel={
                      selectedAircraftIds.includes(item.id)
                        ? "Deselect aircraft"
                        : "Select aircraft"
                    }
                    accessibilityRole="button"
                  >
                    {selectedAircraftIds.includes(item.id) && (
                      <Ionicons name="checkmark" size={20} color="#fff" />
                    )}
                  </TouchableOpacity>

                  {/* Aircraft Image */}
                  {item.mainImage ? (
                    <Image
                      source={{ uri: item.mainImage }}
                      style={styles.aircraftCardImage}
                    />
                  ) : (
                    <View style={styles.noImageContainer}>
                      <Text style={{ color: "#a0aec0" }}>No Image</Text>
                    </View>
                  )}

                  {/* Aircraft Info */}
                  <View style={styles.aircraftCardInfo}>
                    <Text style={styles.aircraftCardTitle}>
                      {item.aircraftModel}
                    </Text>
                    <Text>Tail Number: {item.tailNumber}</Text>
                    <Text>Engine: {item.engineType}</Text>
                    <Text>Total Time: {item.totalTimeOnFrame} hours</Text>
                    <Text>
                      Location: {item.location} ({item.airportIdentifier})
                    </Text>
                    <Text>Cost Per Hour: ${item.costPerHour}</Text>
                  </View>

                  {/* Remove Button */}
                  <TouchableOpacity
                    onPress={() => {
                      Alert.alert(
                        "Remove Aircraft",
                        "Are you sure you want to remove this aircraft?",
                        [
                          { text: "Cancel", style: "cancel" },
                          {
                            text: "Remove",
                            style: "destructive",
                            onPress: async () => {
                              try {
                                // Remove the aircraft from 'airplanes' collection
                                await deleteDoc(doc(db, "airplanes", item.id));

                                setUserListings(
                                  userListings.filter((a) => a.id !== item.id)
                                );
                                setAllAircrafts(
                                  allAircrafts.filter((a) => a.id !== item.id)
                                );
                                setSelectedAircraftIds(
                                  selectedAircraftIds.filter((id) => id !== item.id)
                                );

                                Alert.alert(
                                  "Removed",
                                  "The aircraft has been removed."
                                );
                              } catch (error) {
                                console.error("Error removing aircraft:", error);
                                Alert.alert(
                                  "Error",
                                  "Failed to remove the aircraft."
                                );
                              }
                            },
                          },
                        ]
                      );
                    }}
                    style={styles.removeAircraftButton}
                    accessibilityLabel={`Remove listing for aircraft ${item.aircraftModel}`}
                    accessibilityRole="button"
                  >
                    <Ionicons name="close-circle" size={24} color="red" />
                  </TouchableOpacity>
                </TouchableOpacity>
              )}
            />
          ) : (
            <Text>No aircraft added yet.</Text>
          )}

          {/* ************* Big Plus Sign to Add Additional Aircraft ************* */}
          <TouchableOpacity
            onPress={() => {
              setSelectedAircraft(null);
              setIsEditing(true);
              setAircraftDetails({
                aircraftModel: "",
                tailNumber: "", // New field
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
            style={styles.addAircraftButton}
            accessibilityLabel="Add new aircraft"
            accessibilityRole="button"
          >
            <Ionicons name="add-circle" size={60} color="#3182ce" />
          </TouchableOpacity>
          {/* ************* End of Big Plus Sign ************* */}

          {/* List Selected Aircraft Button */}
          <CustomButton
            onPress={handleListForRentToggle}
            title="List Selected Aircraft"
            backgroundColor="#48bb78"
            style={{ marginTop: 16, marginBottom: 16 }}
            accessibilityLabel="List selected aircraft for rent"
            accessibilityRole="button"
          />
        </View>
        {/* ************* End of Updated Section: Your Aircraft ************* */}

        {/* ************* Admin Tools Section ************* */}
        {/* Show only for admin users */}
        {user?.email === "admin@example.com" && ( // Replace with your admin condition
          <View style={{ padding: 16 }}>
            <Text style={{ fontSize: 24, fontWeight: "bold", marginBottom: 16 }}>
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
              backgroundColor="#e53e3e" // Red color for destructive action
              style={{ marginBottom: 16 }}
              accessibilityLabel="Perform data cleanup"
              accessibilityRole="button"
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
        {/* ************* End of Admin Tools Section ************* */}

        {/* Current Listings */}
        <View style={{ padding: 16 }}>
          <Text style={{ fontSize: 24, fontWeight: "bold", marginBottom: 16 }}>
            Current Listings
          </Text>
          {userListings.length > 0 ? (
            <FlatList
              data={userListings}
              keyExtractor={(item, index) => `${item.id}_${index}`} // Ensures unique keys
              nestedScrollEnabled={true}
              scrollEnabled={false} // Disable scrolling to prevent nesting issues
              renderItem={({ item }) => (
                <TouchableOpacity
                  onPress={() => {
                    setSelectedAircraft(item);
                    setIsEditing(true);
                    setAircraftDetails(item);
                    setImages(item.images || []);
                    setAircraftModalVisible(true);
                  }}
                  style={styles.listingContainer}
                  accessibilityLabel={`View details for listing ${item.aircraftModel}`}
                  accessibilityRole="button"
                >
                  <View style={{ flexDirection: "row", alignItems: "center" }}>
                    {/* Pressable Area */}
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 18, fontWeight: "bold" }}>
                        {item.aircraftModel}
                      </Text>
                      <Text>{item.description}</Text>
                      <Text>Rate per Hour: ${item.costPerHour}</Text>
                    </View>
                    {/* Remove Button */}
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
                                  // Remove the aircraft from 'airplanes' collection
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
                                  console.error("Error removing listing:", error);
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
                      style={styles.removeAircraftButton}
                      accessibilityLabel={`Remove listing for aircraft ${item.aircraftModel}`}
                      accessibilityRole="button"
                    >
                      <Ionicons name="close-circle" size={24} color="red" />
                    </TouchableOpacity>
                  </View>
                  {item.images.length > 0 && (
                    <FlatList
                      data={item.images}
                      horizontal
                      keyExtractor={(image, idx) => `${image}_${idx}`} // Ensures unique keys
                      nestedScrollEnabled={true}
                      scrollEnabled={false} // Disable scrolling to prevent nesting issues
                      renderItem={({ item: image }) => (
                        <Image
                          source={{ uri: image }}
                          style={styles.listingImage}
                        />
                      )}
                    />
                  )}
                </TouchableOpacity>
              )}
            />
          ) : (
            <Text>No current listings.</Text>
          )}
        </View>

        {/* ************* New Section: Incoming Rental Requests ************* */}
        <View style={{ padding: 16 }}>
          <Text style={{ fontSize: 24, fontWeight: "bold", marginBottom: 16 }}>
            Incoming Rental Requests
          </Text>
          {rentalRequests.length > 0 ? (
            <FlatList
              data={rentalRequests}
              keyExtractor={(item, index) => `${item.id}_${index}`} // Ensures unique keys
              nestedScrollEnabled={true}
              scrollEnabled={false} // Disable scrolling to prevent nesting issues
              renderItem={({ item }) => (
                <TouchableOpacity
                  key={item.id}
                  onPress={async () => {
                    setSelectedRequest(item);
                    const listing = await fetchListingDetails(item.listingId);
                    setSelectedListingDetails(listing);
                    setRentalRequestModalVisible(true);
                  }}
                  style={styles.rentalRequestContainer}
                  accessibilityLabel={`View details for rental request from ${item.renterName}`}
                  accessibilityRole="button"
                >
                  <Text style={{ fontSize: 18, fontWeight: "bold" }}>
                    Renter: {item.renterName}
                  </Text>
                  {/* Display Aircraft */}
                  <Text>
                    Listing:{" "}
                    {item.listingDetails
                      ? `${item.listingDetails.aircraftModel}`
                      : "Listing details not available"}
                  </Text>
                  {/* Update to display only base cost */}
                  <Text>Total Cost: ${item.baseCost}</Text>
                  <Text>Requested Date: {formatDate(item.rentalDate)}</Text>
                  <Text>Status: {item.status}</Text>
                </TouchableOpacity>
              )}
            />
          ) : (
            <Text>No incoming rental requests.</Text>
          )}
        </View>
        {/* ************* End of Incoming Rental Requests ************* */}

        {/* ************* New Section: Active Rentals ************* */}
        <View style={{ padding: 16 }}>
          <Text style={{ fontSize: 24, fontWeight: "bold", marginBottom: 16 }}>
            Active Rentals
          </Text>
          {activeRentals.length > 0 ? (
            <>
              {/* Display only first 3 active rentals */}
              {activeRentals.slice(0, 3).map((item, index) => (
                <View
                  key={item.id}
                  style={styles.activeRentalContainer}
                >
                  <TouchableOpacity
                    onPress={() => {
                      setSelectedRequest(item);
                      setSelectedListingDetails(item.listingDetails);
                      setRentalRequestModalVisible(true); // Reuse the same modal for Active Rentals
                    }}
                    accessibilityLabel={`View details for active rental of ${item.listingDetails?.aircraftModel}`}
                    accessibilityRole="button"
                  >
                    {/* Display rental details */}
                    <Text style={{ fontSize: 18, fontWeight: "bold" }}>
                      {item.listingDetails
                        ? `${item.listingDetails.aircraftModel}`
                        : "Listing details not available"}
                    </Text>
                    <Text>Renter: {item.renterName}</Text>
                    {/* Update to display only base cost */}
                    <Text>Total Cost: ${item.baseCost}</Text>
                    <Text>Rental Date: {formatDate(item.rentalDate)}</Text>
                    <Text>Status: {item.status}</Text>
                  </TouchableOpacity>
                  {/* Remove Button */}
                  <TouchableOpacity
                    onPress={() => handleDeleteActiveRental(item.id)}
                    style={styles.removeAircraftButton}
                    accessibilityLabel={`Delete active rental for ${item.listingDetails?.aircraftModel}`}
                    accessibilityRole="button"
                  >
                    <Ionicons name="close-circle" size={24} color="red" />
                  </TouchableOpacity>
                </View>
              ))}

              {/* View More Button */}
              {activeRentals.length > 3 && (
                <CustomButton
                  onPress={() => setViewMoreModalVisible(true)}
                  title="View More"
                  backgroundColor="#3182ce"
                  style={{ marginTop: 16 }}
                  accessibilityLabel="View more active rentals"
                  accessibilityRole="button"
                />
              )}

              {/* Delete All Button */}
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
                backgroundColor="#e53e3e" // Red color for destructive action
                style={{ marginTop: 16 }}
                accessibilityLabel="Delete all active rentals"
                accessibilityRole="button"
              />
            </>
          ) : (
            <Text>No active rentals.</Text>
          )}
        </View>
        {/* ************* End of Active Rentals ************* */}
      </ScrollView>

      {/* ************* Modals Outside ScrollView ************* */}

      {/* Rental Request Details Modal */}
      <Modal
        visible={rentalRequestModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setRentalRequestModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            {selectedRequest && selectedListingDetails ? (
              <>
                <ModalHeader
                  title="Rental Request Details"
                  onClose={() => setRentalRequestModalVisible(false)}
                />
                <View style={{ marginBottom: 16 }}>
                  {/* Renter's Additional Information */}
                  <Text style={styles.modalText}>
                    <Text style={styles.modalLabel}>Renter Name: </Text>
                    {selectedRequest.renterName}
                  </Text>
                  <Text style={styles.modalText}>
                    <Text style={styles.modalLabel}>Location: </Text>
                    {selectedRequest.renterCityState}
                  </Text>
                  <Text style={styles.modalText}>
                    <Text style={styles.modalLabel}>Rental Hours: </Text>
                    {selectedRequest.rentalHours}
                  </Text>
                  <Text style={styles.modalText}>
                    <Text style={styles.modalLabel}>Current Medical: </Text>
                    {selectedRequest.currentMedical}
                  </Text>
                  <Text style={styles.modalText}>
                    <Text style={styles.modalLabel}>
                      Current Renter's Insurance:{" "}
                    </Text>
                    {selectedRequest.currentRentersInsurance}
                  </Text>

                  {/* Existing Rental Request Details */}
                  <Text style={styles.modalText}>
                    <Text style={styles.modalLabel}>Listing: </Text>
                    {selectedListingDetails
                      ? `${selectedListingDetails.aircraftModel}`
                      : "Listing details not available"}
                  </Text>
                  <Text style={styles.modalText}>
                    <Text style={styles.modalLabel}>Rate per Hour: </Text>$
                    {selectedListingDetails.costPerHour}
                  </Text>
                  <Text style={styles.modalText}>
                    <Text style={styles.modalLabel}>Number of Hours: </Text>
                    {selectedRequest.rentalHours}
                  </Text>
                  {/* Display Base Cost */}
                  <Text style={styles.modalText}>
                    <Text style={styles.modalLabel}>Base Cost: </Text>$
                    {selectedRequest.baseCost}
                  </Text>
                  {/* Display Commission */}
                  <Text style={styles.modalText}>
                    <Text style={styles.modalLabel}>6% Commission: </Text>$
                    {selectedRequest.commission}
                  </Text>
                  {/* Display Owner's Total */}
                  <Text style={styles.modalText}>
                    <Text style={styles.modalLabel}>Owner's Total: </Text>$
                    {(
                      parseFloat(selectedRequest.baseCost) -
                      parseFloat(selectedRequest.commission)
                    ).toFixed(2)}
                  </Text>
                  <Text style={styles.modalText}>
                    <Text style={styles.modalLabel}>Requested Date: </Text>
                    {formatDate(selectedRequest.rentalDate)}
                  </Text>
                  <Text style={styles.modalText}>
                    <Text style={styles.modalLabel}>Status: </Text>
                    {selectedRequest.status}
                  </Text>
                </View>

                {selectedRequest.status === "pending" && (
                  <View style={styles.modalButtonsContainer}>
                    <CustomButton
                      onPress={() => {
                        // Changed to handleApproveRentalRequest
                        handleApproveRentalRequest(selectedRequest);
                      }}
                      title="Approve"
                      backgroundColor="#48bb78"
                      style={{ flex: 1, marginRight: 8 }}
                      textStyle={{ fontSize: 16 }}
                      accessibilityLabel="Approve rental request"
                      accessibilityRole="button"
                    />
                    <CustomButton
                      onPress={() => handleDenyRentalRequest(selectedRequest)}
                      title="Deny"
                      backgroundColor="#e53e3e"
                      style={{ flex: 1, marginLeft: 8 }}
                      textStyle={{ fontSize: 16 }}
                      accessibilityLabel="Deny rental request"
                      accessibilityRole="button"
                    />
                  </View>
                )}

                {selectedRequest.status === "active" && (
                  <CustomButton
                    onPress={() => {
                      // Implement any actions for active rentals if needed
                      Alert.alert(
                        "Info",
                        "Active rentals details can be managed here."
                      );
                    }}
                    title="Manage Rental"
                    backgroundColor="#3182ce"
                    style={{ marginTop: 16 }}
                    textStyle={{ fontSize: 16 }}
                    accessibilityLabel="Manage active rental"
                    accessibilityRole="button"
                  />
                )}
              </>
            ) : (
              <ActivityIndicator size="large" color="#3182ce" />
            )}
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
        <View style={styles.modalOverlay}>
          <View style={styles.messageModalContainer}>
            <TouchableOpacity
              onPress={() => setMessageModalVisible(false)}
              style={styles.closeModalButton}
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
                } // Ensures unique keys by including index
                renderItem={({ item }) => (
                  <View
                    style={[
                      styles.chatBubble,
                      item.senderId === user.uid
                        ? styles.chatBubbleRight
                        : styles.chatBubbleLeft,
                    ]}
                  >
                    <Text style={{ fontWeight: "bold" }}>
                      {item.senderName}:
                    </Text>
                    <Text>{item.text}</Text>
                    <Text style={styles.chatTimestamp}>
                      {item.createdAt
                        ? item.createdAt.toDate
                          ? item.createdAt.toDate().toLocaleString()
                          : new Date(item.createdAt).toLocaleString()
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
          </View>
        </View>
      </Modal>

      {/* ************* New Modal: View More Active Rentals with Pagination ************* */}
      <Modal
        visible={viewMoreModalVisible}
        animationType="slide"
        onRequestClose={() => setViewMoreModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={{ flex: 1 }}
          keyboardVerticalOffset={Platform.OS === "ios" ? 60 : 0} // Adjust offset as needed
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContainer}>
              <ModalHeader
                title="All Active Rentals"
                onClose={() => setViewMoreModalVisible(false)}
              />
              <FlatList
                data={activeRentalsPage}
                keyExtractor={(item, index) => `${item.id}_${index}`} // Ensures unique keys
                renderItem={({ item }) => (
                  <TouchableOpacity
                    key={`activeRental_${item.id}`}
                    onPress={() => {
                      setSelectedRequest(item);
                      setSelectedListingDetails(item.listingDetails);
                      setRentalRequestModalVisible(true);
                      setViewMoreModalVisible(false);
                    }}
                    style={styles.activeRentalContainer}
                    accessibilityLabel={`View details for active rental of ${item.listingDetails?.aircraftModel}`}
                    accessibilityRole="button"
                  >
                    {/* Display rental details */}
                    <Text style={{ fontSize: 18, fontWeight: "bold" }}>
                      {item.listingDetails
                        ? `${item.listingDetails.aircraftModel}`
                        : "Listing details not available"}
                    </Text>
                    <Text>Renter: {item.renterName}</Text>
                    {/* Display only base cost */}
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
                        color: "#4a5568",
                        marginVertical: 16,
                      }}
                    >
                      No more active rentals to load.
                    </Text>
                  )
                }
                onEndReached={handleLoadMoreActiveRentals}
                onEndReachedThreshold={0.5}
              />
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
      {/* ************* End of New Modal: View More Active Rentals ************* */}

      {/* Aircraft Details Modal */}
      <Modal
        visible={aircraftModalVisible}
        animationType="slide"
        onRequestClose={() => setAircraftModalVisible(false)}
      >
        <ScrollView contentContainerStyle={{ padding: 16 }}>
          <ModalHeader
            title={isEditing ? "Edit Aircraft Details" : "Aircraft Details"}
            onClose={() => setAircraftModalVisible(false)}
          />

          {/* General Information Section */}
          <Section title="General Information">
            <CustomTextInput
              placeholder="Aircraft Model (Year/Make/Model)"
              value={aircraftDetails.aircraftModel}
              onChangeText={(value) => handleInputChange("aircraftModel", value)}
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

          {/* Location Information Section */}
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

          {/* Cost Information Section */}
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

          {/* Description Section */}
          <Section title="Description">
            <CustomTextInput
              placeholder="Description"
              value={aircraftDetails.description}
              onChangeText={(value) => handleInputChange("description", value)}
              style={{ height: 100 }}
              multiline={true}
              editable={isEditing}
              accessibilityLabel="Description input"
            />
          </Section>

          {/* Images Section */}
          <Section title="Images">
            <FlatList
              data={images}
              horizontal
              keyExtractor={(item, index) => `${item}_${index}`} // Ensures unique keys by combining URI with index
              renderItem={({ item }) => (
                <View style={styles.imagePreviewContainer}>
                  <Image source={{ uri: item }} style={styles.imagePreview} />
                  {isEditing && (
                    <>
                      {/* Set Main Image Button */}
                      <TouchableOpacity
                        onPress={() => selectMainImage(item)}
                        style={styles.setMainImageButton}
                        accessibilityLabel="Set as main image"
                        accessibilityRole="button"
                      >
                        <Text style={{ color: "white", fontSize: 10 }}>
                          Set Main
                        </Text>
                      </TouchableOpacity>
                      {/* Remove Image Button */}
                      <TouchableOpacity
                        onPress={() => removeImage(item)}
                        style={styles.removeImageButton}
                        accessibilityLabel="Remove image"
                        accessibilityRole="button"
                      >
                        <Ionicons name="close-circle" size={20} color="red" />
                      </TouchableOpacity>
                    </>
                  )}
                </View>
              )}
            />
            <Text style={{ marginTop: 4, color: "#4a5568" }}>
              {images.length}/7 images
            </Text>
          </Section>

          {/* Upload Images Button */}
          {isEditing && (
            <>
              <CustomButton
                onPress={pickImage}
                title="Upload Images"
                backgroundColor="#3182ce"
                style={{ marginTop: 16 }}
                accessibilityLabel="Upload images"
                accessibilityRole="button"
              />
              {images.length >= 7 && (
                <Text style={{ color: "red", marginTop: 4 }}>
                  Maximum of 7 images reached.
                </Text>
              )}
            </>
          )}

          {/* Main Image Display */}
          {selectedAircraft && selectedAircraft.mainImage && (
            <View style={{ marginTop: 16, alignItems: "center" }}>
              <Text style={{ fontSize: 16, fontWeight: "bold" }}>
                Main Image:
              </Text>
              <Image
                source={{ uri: selectedAircraft.mainImage }}
                style={styles.mainImageDisplay}
              />
            </View>
          )}

          {/* Buttons */}
          <View style={{ marginTop: 24 }}>
            {isEditing ? (
              <>
                <CustomButton
                  onPress={onSaveAircraftDetails}
                  title="Save Aircraft Details"
                  backgroundColor="#3182ce"
                  style={{ marginBottom: 16 }}
                  accessibilityLabel="Save aircraft details"
                  accessibilityRole="button"
                />
                <CustomButton
                  onPress={() => setAircraftModalVisible(false)}
                  title="Cancel"
                  backgroundColor="#e53e3e"
                  accessibilityLabel="Cancel aircraft details modal"
                  accessibilityRole="button"
                />
              </>
            ) : (
              <CustomButton
                onPress={onEditAircraftDetails}
                title="Edit Aircraft"
                backgroundColor="#48bb78"
                style={{ marginBottom: 16 }}
                accessibilityLabel="Edit aircraft details"
                accessibilityRole="button"
              />
            )}
          </View>
        </ScrollView>
      </Modal>
      {/* ************* End of Aircraft Details Modal ************* */}

      {/* Connect Stripe Modal */}
      <Modal
        visible={connectStripeModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setConnectStripeModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
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
              autoCapitalize="none"
              accessibilityLabel="Email Address input"
            />
            <CustomButton
              onPress={handleConnectStripeSubmit}
              title="Proceed"
              backgroundColor="#3182ce"
              style={{ marginTop: 16 }}
              accessibilityLabel="Proceed to connect Stripe account"
              accessibilityRole="button"
            />
          </View>
        </View>
      </Modal>

      {/* ************* Updated Withdraw Funds Modal ************* */}
      <Modal
        visible={depositModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setDepositModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={{ flex: 1 }}
          keyboardVerticalOffset={Platform.OS === "ios" ? 60 : 0} // Adjust offset as needed
        >
          <View style={styles.modalOverlay}>
            <View style={styles.depositModalContainer}>
              <ScrollView
                contentContainerStyle={{ flexGrow: 1, paddingBottom: 20 }}
                keyboardShouldPersistTaps="handled"
                showsHorizontalScrollIndicator="false"
              >
                <ModalHeader
                  title="Withdraw Funds"
                  onClose={() => setDepositModalVisible(false)}
                />
                <Text style={styles.modalText}>
                  Available Balance: ${availableBalance.toFixed(2)}
                </Text>

                {/* Payment Method Selection */}
                <Section title="Payment Method">
                  <View style={styles.pickerContainer}>
                    <Picker
                      selectedValue={paymentMethod}
                      onValueChange={(itemValue, itemIndex) =>
                        setPaymentMethod(itemValue)
                      }
                      style={styles.picker}
                      accessibilityLabel="Select payment method"
                    >
                      <Picker.Item label="Bank Account" value="bank" />
                      <Picker.Item label="Debit Card" value="card" />
                    </Picker>
                  </View>
                </Section>

                {/* Payment Method Details */}
                {paymentMethod === "bank" && (
                  <BankDetailsForm
                    bankDetails={bankDetails}
                    setBankDetails={setBankDetails}
                  />
                )}

                {paymentMethod === "card" && (
                  <Section title="Debit Card Details">
                    {/* Using Stripe's CardField without ref for secure card input */}
                    <CardField
                      postalCodeEnabled={false}
                      placeholder={{
                        number: "4242 4242 4242 4242",
                        placeholderTextColor: "#888",
                      }}
                      cardStyle={{
                        backgroundColor: "#FFFFFF",
                        textColor: "#000000",
                      }}
                      style={{
                        width: "100%",
                        height: 50,
                        marginVertical: 30,
                      }}
                      onCardChange={(details) => {
                        setCardDetails(details); // Update cardDetails state
                      }}
                      accessibilityLabel="Debit card details input"
                    />
                  </Section>
                )}

                {/* Withdrawal Email Field */}
                <Section title="Withdrawal Email">
                  <CustomTextInput
                    placeholder="Email Address"
                    placeholderTextColor="#888"
                    value={withdrawalEmail}
                    onChangeText={(value) => setWithdrawalEmail(value)}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    accessibilityLabel="Withdrawal email input"
                  />
                </Section>

                {/* Withdrawal Amount Field */}
                <Section title="Withdrawal Amount">
                  <CustomTextInput
                    placeholder="Amount to Withdraw ($)"
                    placeholderTextColor="#888"
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
                  style={{ marginTop: 16 }}
                  accessibilityLabel="Withdraw funds"
                  accessibilityRole="button"
                />
                <CustomButton
                  onPress={() => setDepositModalVisible(false)}
                  title="Cancel"
                  backgroundColor="#e53e3e"
                  style={{ marginTop: 8 }}
                  accessibilityLabel="Cancel withdrawal"
                  accessibilityRole="button"
                />
                {loading && (
                  <ActivityIndicator
                    size="large"
                    color="#3182ce"
                    style={{ marginTop: 16 }}
                  />
                )}
              </ScrollView>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
      {/* ************* End of Updated Withdraw Funds Modal ************* */}
    </View>
  );
};

// Styles
const styles = StyleSheet.create({
  input: {
    borderWidth: 1,
    borderColor: "#a0aec0",
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  button: {
    padding: 12,
    borderRadius: 8,
    alignItems: "center",
  },
  buttonText: {
    color: "white",
    fontWeight: "bold",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "bold",
  },
  closeModalButton: {
    padding: 4,
  },
  fundsButtonContainer: {
    alignItems: "center",
    marginTop: -32,
    marginBottom: 16,
  },
  fundsButtonStyle: {
    width: 100,
    height: 50,
    borderRadius: 25,
    justifyContent: "center",
    alignItems: "center",
  },
  fundsButtonTextStyle: {
    fontSize: 18,
    fontWeight: "bold",
  },
  calculatorResultContainer: {
    backgroundColor: "#edf2f7",
    padding: 16,
    borderRadius: 8,
  },
  calculatorTitle: {
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 8,
  },
  calculatorText: {
    fontSize: 16,
    marginBottom: 4,
  },
  pickerContainer: {
    borderWidth: 1,
    borderColor: "#a0aec0",
    borderRadius: 8,
    overflow: "hidden",
  },
  picker: {
    height: 50,
    width: "100%",
  },
  imagePreviewContainer: {
    position: "relative",
    marginRight: 8,
  },
  imagePreview: {
    width: 100,
    height: 100,
    borderRadius: 8,
  },
  setMainImageButton: {
    position: "absolute",
    bottom: 4,
    left: 4,
    backgroundColor: "#3182ce",
    padding: 2,
    borderRadius: 4,
  },
  removeImageButton: {
    position: "absolute",
    top: 4,
    right: 4,
  },
  mainImageDisplay: {
    width: 200,
    height: 200,
    borderRadius: 8,
    marginTop: 8,
  },
  selectionButton: {
    position: "absolute",
    top: 8,
    left: 8,
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#a0aec0",
  },
  selectionButtonSelected: {
    backgroundColor: "#3182ce",
  },
  selectionButtonUnselected: {
    backgroundColor: "#a0aec0",
  },
  aircraftCard: {
    width: 200,
    marginRight: 16,
    borderWidth: 1,
    borderColor: "#a0aec0",
    borderRadius: 8,
    padding: 8,
    backgroundColor: "#fff",
  },
  aircraftCardImage: {
    width: "100%",
    height: 100,
    borderRadius: 8,
  },
  noImageContainer: {
    width: "100%",
    height: 100,
    borderRadius: 8,
    backgroundColor: "#edf2f7",
    justifyContent: "center",
    alignItems: "center",
  },
  aircraftCardInfo: {
    marginTop: 8,
  },
  aircraftCardTitle: {
    fontSize: 16,
    fontWeight: "bold",
  },
  removeAircraftButton: {
    marginTop: 8,
    alignSelf: "flex-end",
  },
  addAircraftButton: {
    alignItems: "center",
    justifyContent: "center",
    marginTop: 16,
  },
  listingContainer: {
    borderWidth: 1,
    borderColor: "#a0aec0",
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    backgroundColor: "#fff",
  },
  listingImage: {
    width: 100,
    height: 100,
    borderRadius: 8,
    marginTop: 8,
    marginRight: 8,
  },
  rentalRequestContainer: {
    borderWidth: 1,
    borderColor: "#a0aec0",
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    backgroundColor: "#fff",
  },
  activeRentalContainer: {
    borderWidth: 1,
    borderColor: "#a0aec0",
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    backgroundColor: "#fff",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalContainer: {
    width: "90%",
    maxHeight: "80%",
    backgroundColor: "white",
    borderRadius: 8,
    padding: 16,
  },
  messageModalContainer: {
    width: "90%",
    maxHeight: "80%",
    backgroundColor: "white",
    borderRadius: 8,
    padding: 16,
    justifyContent: "space-between",
  },
  messageInputContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 16,
  },
  messageTextInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#a0aec0",
    borderRadius: 8,
    padding: 12,
    marginRight: 8,
  },
  sendButton: {
    backgroundColor: "#3182ce",
    padding: 12,
    borderRadius: 8,
  },
  chatBubble: {
    padding: 8,
    borderRadius: 8,
    marginBottom: 8,
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
    color: "#718096",
    marginTop: 4,
    textAlign: "right",
  },
  modalButtonsContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  depositModalContainer: {
    width: "90%",
    maxHeight: "80%",
    backgroundColor: "white",
    borderRadius: 8,
    padding: 16,
  },
  calculatorResultContainer: {
    backgroundColor: "#edf2f7",
    padding: 16,
    borderRadius: 8,
  },
  connectStripeButton: {
    backgroundColor: "#667eea",
    padding: 12,
    borderRadius: 8,
    alignItems: "center",
    marginTop: 8,
  },
  connectStripeButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
  },
});

export default OwnerProfile;
