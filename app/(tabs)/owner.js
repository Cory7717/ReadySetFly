// OwnerProfile.js

import React, { useState, useEffect } from "react";
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
  StyleSheet,
  FlatList,
  KeyboardAvoidingView,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { db, storage, auth } from "../../firebaseConfig"; // Ensure correct path
import * as ImagePicker from "expo-image-picker";
import {
  collection,
  addDoc,
  onSnapshot,
  updateDoc,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  setDoc,
  serverTimestamp,
  writeBatch,
  query,
  where,
  orderBy,
  limit,
  startAfter,
  deleteField, // Added import for deleteField
} from "firebase/firestore";
import { FontAwesome, Ionicons } from "@expo/vector-icons";
import wingtipClouds from "../../Assets/images/wingtip_clouds.jpg";
import { useStripe, CardField } from "@stripe/stripe-react-native";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { Picker } from "@react-native-picker/picker";
import BankDetailsForm from "../payment/BankDetailsForm"; // Adjusted path

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
}) => (
  <TouchableOpacity
    onPress={onPress}
    style={[styles.button, { backgroundColor }, style]}
  >
    <Text style={[styles.buttonText, textStyle]}>{title}</Text>
  </TouchableOpacity>
);

// Reusable Modal Header
const ModalHeader = ({ title, onClose }) => (
  <View style={styles.modalHeader}>
    <Text style={styles.modalTitle}>{title}</Text>
    <TouchableOpacity onPress={onClose} style={styles.closeModalButton}>
      <Ionicons name="close" size={24} color="#2d3748" />
    </TouchableOpacity>
  </View>
);

const OwnerProfile = ({ ownerId }) => {
  const navigation = useNavigation();
  const user = auth.currentUser; // Get current Firebase user
  const stripe = useStripe();
  const resolvedOwnerId = ownerId || user?.uid; // Resolve ownerId or default to Firebase user ID

  // State Definitions
  const [profileData, setProfileData] = useState({
    airplaneModel: "",
    description: "",
    location: "",
    ratesPerHour: "",
    minimumHours: "",
    boostListing: false,
    boostedListing: false,
  });

  const [aircraftDetails, setAircraftDetails] = useState({
    aircraft: "", // Combined Year/Make/Model
    tailNumber: "", // New field
    engine: "",
    description: "",
    totalTime: "",
    costPerHour: "",
    location: "",
    airportIdentifier: "",
    mainImage: "",
    images: [],
  });

  const [initialAircraftDetails, setInitialAircraftDetails] = useState(null);
  const [allAircrafts, setAllAircrafts] = useState([]); // Combined list of all aircraft
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
    flightHoursPerYear: "",
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
  const [availableBalance, setAvailableBalance] = useState(0); // Updated initial balance
  const [refreshing, setRefreshing] = useState(false);
  const [rentalRequests, setRentalRequests] = useState([]);
  const [activeRentals, setActiveRentals] = useState([]);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [messageInput, setMessageInput] = useState("");
  const [messageModalVisible, setMessageModalVisible] = useState(false);
  const [messages, setMessages] = useState([]);
  const [chatThreads, setChatThreads] = useState([]);
  const [selectedChatThreadId, setSelectedChatThreadId] = useState(null);
  const [fullScreenModalVisible, setFullScreenModalVisible] = useState(false);
  const [aircraftModalVisible, setAircraftModalVisible] = useState(false);
  const [selectedAircraft, setSelectedAircraft] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [selectedAircraftIds, setSelectedAircraftIds] = useState([]); // NEW: Selected aircraft IDs

  const [rentalRequestModalVisible, setRentalRequestModalVisible] =
    useState(false);
  const [selectedListingDetails, setSelectedListingDetails] = useState(null);

  const [depositModalVisible, setDepositModalVisible] = useState(false);
  const [withdrawalAmount, setWithdrawalAmount] = useState("");
  const [withdrawalEmail, setWithdrawalEmail] = useState(""); // New state for email

  // Payment Method State
  const [paymentMethod, setPaymentMethod] = useState("bank"); // 'bank' or 'card'
  const [bankDetails, setBankDetails] = useState({
    accountHolderName: "",
    bankName: "",
    routingNumber: "",
    accountNumber: "",
  });
  const [cardDetails, setCardDetails] = useState({}); // State for CardField details

  // *** NEW: State for "View More" Active Rentals Modal with Pagination ***
  const [viewMoreModalVisible, setViewMoreModalVisible] = useState(false);
  const [activeRentalsPage, setActiveRentalsPage] = useState([]);
  const [lastActiveRentalDoc, setLastActiveRentalDoc] = useState(null);
  const [hasMoreActiveRentals, setHasMoreActiveRentals] = useState(true);
  const ACTIVE_RENTALS_PAGE_SIZE = 10; // Number of rentals to fetch per page

  // Function to handle withdrawal
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
        Alert.alert(
          "Incomplete Details",
          "Please enter complete card details."
        );
        return;
      }
    }

    setLoading(true);
    try {
      let paymentMethodId = "";

      if (paymentMethod === "card") {
        // Create a Stripe payment method using the CardField
        const { error, paymentMethod } = await stripe.createPaymentMethod({
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

        paymentMethodId = paymentMethod.id;
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
          ownerId: resolvedOwnerId,
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

  // Fetch stored data on mount
  useEffect(() => {
    if (!resolvedOwnerId) {
      console.error("No owner ID or user ID available.");
      Alert.alert("Error", "User is not authenticated. Please log in.");
      return;
    }

    const fetchOwnerData = async () => {
      try {
        const docRef = doc(db, "aircraftDetails", resolvedOwnerId);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
          const data = docSnap.data();

          if (data.costData) {
            setCostData(data.costData);
            setCostSaved(true);
          }

          if (data.aircraftDetails) {
            const aircraft = { ...data.aircraftDetails, id: resolvedOwnerId };
            setAircraftDetails(aircraft);
            setInitialAircraftDetails(aircraft);
            setImages(aircraft.images || []);
            setAircraftSaved(true);
            setAllAircrafts([aircraft]);
          }

          if (
            data.additionalAircrafts &&
            Array.isArray(data.additionalAircrafts)
          ) {
            const additionalAircraftsWithId = data.additionalAircrafts.map(
              ({ id, ...rest }, index) => ({
                ...rest,
                id: id || `additional_${index}_${Date.now()}`,
              })
            );
            setAllAircrafts((prev) => [...prev, ...additionalAircraftsWithId]);
          }

          // NEW: Fetch selectedAircraftIds from Firestore
          if (
            data.selectedAircraftIds &&
            Array.isArray(data.selectedAircraftIds)
          ) {
            setSelectedAircraftIds(data.selectedAircraftIds);
          }
        } else {
          console.log("No saved data found for this owner.");
        }
      } catch (error) {
        console.error("Error fetching owner data:", error);
        Alert.alert("Error", "Failed to fetch saved data.");
      }
    };

    fetchOwnerData();
  }, [resolvedOwnerId]);

  // *** UPDATED: Persist selectedAircraftIds to Firestore whenever it changes ***
  useEffect(() => {
    const persistSelectedAircraftIds = async () => {
      try {
        const docRef = doc(db, "aircraftDetails", resolvedOwnerId);
        await updateDoc(docRef, {
          selectedAircraftIds: selectedAircraftIds,
        });
      } catch (error) {
        console.error("Error saving selected aircraft IDs:", error);
        // Optionally, handle the error (e.g., show an alert)
      }
    };

    // Only persist if ownerId is resolved
    if (resolvedOwnerId) {
      persistSelectedAircraftIds();
    }
  }, [selectedAircraftIds, resolvedOwnerId]);

  // Fetch rental requests with renter details and chat thread data
  useEffect(() => {
    if (resolvedOwnerId) {
      const rentalRequestsQueryInstance = collection(
        db,
        "owners",
        resolvedOwnerId,
        "rentalRequests"
      );

      const unsubscribeRentalRequests = onSnapshot(
        rentalRequestsQueryInstance,
        async (snapshot) => {
          const requestsWithNamesAndListings = await Promise.all(
            snapshot.docs.map(async (docSnap, index) => {
              const requestData = docSnap.data();

              // *** UPDATED: Added comprehensive logging ***
              console.log(`Processing Rental Request ID: ${docSnap.id}`);
              console.log(`Request Data:`, requestData);

              let renterName = "Anonymous";
              let renterCityState = "N/A";
              let flightHours = "N/A";
              let currentMedical = "N/A";
              let currentRentersInsurance = "N/A";

              if (!requestData.renterId) {
                console.warn(
                  `Rental Request ID: ${docSnap.id} is missing renterId.`
                );
              }

              if (requestData.renterId) {
                try {
                  const renterDocRef = doc(db, "renters", requestData.renterId);
                  const renterDoc = await getDoc(renterDocRef);
                  if (renterDoc.exists()) {
                    const renterData = renterDoc.data();
                    renterName = renterData.fullName || "Anonymous";
                    renterCityState =
                      renterData.city && renterData.state
                        ? `${renterData.city}, ${renterData.state}`
                        : "N/A";
                    flightHours = renterData.flightHours || "N/A";
                    currentMedical = renterData.currentMedical || "N/A";
                    currentRentersInsurance =
                      renterData.currentRentersInsurance || "N/A";
                  } else {
                    console.warn(
                      `Renter document does not exist for renterId: ${requestData.renterId}`
                    );
                  }
                } catch (error) {
                  console.error("Error fetching renter's details:", error);
                }
              }

              // *** UPDATED: Log listingId before fetching ***
              console.log(
                `Fetching Listing Details for listingId: ${requestData.listingId}`
              );

              if (!requestData.listingId) {
                console.warn(
                  `Rental Request ID: ${docSnap.id} is missing listingId.`
                );
              }

              const listingDetails = requestData.listingId
                ? await fetchListingDetails(requestData.listingId)
                : null;

              if (!listingDetails) {
                console.warn(
                  `Listing details not found for listingId: ${requestData.listingId}`
                );
              } else {
                console.log(`Fetched Listing Details:`, listingDetails);
              }

              return {
                id: docSnap.id,
                ...requestData,
                renterName,
                renterCityState,
                flightHours,
                currentMedical,
                currentRentersInsurance,
                listingDetails,
              };
            })
          );

          // Separate rental requests into pending and approved (active) rentals
          const pendingRequests = requestsWithNamesAndListings.filter(
            (req) => req.status === "pending"
          );
          const approvedRentals = requestsWithNamesAndListings.filter(
            (req) => req.status === "approved"
          );

          setRentalRequests(pendingRequests);
          setActiveRentals(approvedRentals); // Set Active Rentals

          console.log(`Pending Requests: ${pendingRequests.length}`);
          console.log(`Approved Rentals: ${approvedRentals.length}`);
        }
      );

      return () => {
        unsubscribeRentalRequests();
      };
    }
  }, [resolvedOwnerId]);

  // Subscribe to messages in a chat thread
  useEffect(() => {
    if (selectedChatThreadId) {
      const chatDocRef = doc(db, "messages", selectedChatThreadId);
      const unsubscribe = onSnapshot(chatDocRef, (docSnapshot) => {
        if (docSnapshot.exists()) {
          const chatData = docSnapshot.data();
          setMessages(chatData.messages || []);
        }
      });
      return () => unsubscribe();
    } else {
      setMessages([]);
    }
  }, [selectedChatThreadId]);

  // Fetch available balance on mount and listen for updates
  useEffect(() => {
    if (resolvedOwnerId) {
      const balanceRef = doc(db, "owners", resolvedOwnerId);
      const unsubscribe = onSnapshot(balanceRef, (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data();
          setAvailableBalance(data.availableBalance || 0);
        } else {
          setAvailableBalance(0);
        }
      });

      return () => unsubscribe();
    }
  }, [resolvedOwnerId]);

  // Utility Functions

  const saveCostData = async () => {
    setLoading(true);
    const {
      purchasePrice,
      loanAmount,
      interestRate,
      loanTerm,
      depreciationRate,
      usefulLife,
      estimatedAnnualCost,
      insuranceCost,
      hangarCost,
      annualRegistrationFees,
      maintenanceReserve,
      oilCostPerHour,
      routineMaintenancePerHour,
      tiresPerHour,
      otherConsumablesPerHour,
      fuelCostPerHour,
      flightHoursPerYear,
    } = costData;

    // Validate Inputs
    const requiredFields = [
      purchasePrice,
      loanAmount,
      interestRate,
      loanTerm,
      depreciationRate,
      usefulLife,
      estimatedAnnualCost,
      insuranceCost,
      hangarCost,
      annualRegistrationFees,
      maintenanceReserve,
      oilCostPerHour,
      routineMaintenancePerHour,
      tiresPerHour,
      otherConsumablesPerHour,
      fuelCostPerHour,
      flightHoursPerYear,
    ];

    if (requiredFields.some((field) => !field)) {
      Alert.alert(
        "Error",
        "Please fill in all fields for accurate calculation."
      );
      setLoading(false);
      return;
    }

    // Calculate Monthly Mortgage Expense
    const monthlyInterestRate = parseFloat(interestRate) / 100 / 12;
    const numberOfPayments = parseFloat(loanTerm) * 12;
    const principal = parseFloat(loanAmount);
    const mortgageExpense = principal
      ? (
          (principal * monthlyInterestRate) /
          (1 - Math.pow(1 + monthlyInterestRate, -numberOfPayments))
        ).toFixed(2)
      : 0;

    // Calculate Depreciation Expense
    const depreciationExpense = (
      (parseFloat(purchasePrice) * parseFloat(depreciationRate)) /
      100
    ).toFixed(2);

    // Total Fixed Costs per Year
    const totalFixedCosts =
      parseFloat(mortgageExpense) * 12 +
      parseFloat(depreciationExpense) +
      parseFloat(insuranceCost) +
      parseFloat(hangarCost) +
      parseFloat(maintenanceReserve) +
      parseFloat(annualRegistrationFees);

    // Total Variable Costs per Year
    const totalVariableCosts =
      (parseFloat(fuelCostPerHour) +
        parseFloat(oilCostPerHour) +
        parseFloat(routineMaintenancePerHour) +
        parseFloat(tiresPerHour) +
        parseFloat(otherConsumablesPerHour)) *
      parseFloat(flightHoursPerYear);

    // Total Cost per Year
    const totalCostPerYear = totalFixedCosts + totalVariableCosts;

    // Cost per Hour
    const costPerHour = (
      totalCostPerYear / parseFloat(flightHoursPerYear)
    ).toFixed(2);

    setCostData((prev) => ({
      ...prev,
      costPerHour,
      mortgageExpense,
      depreciationExpense,
    }));
    setCostSaved(true);
    setLoading(false);

    try {
      await setDoc(doc(db, "aircraftDetails", resolvedOwnerId), {
        costData,
        aircraftDetails: initialAircraftDetails
          ? { ...initialAircraftDetails, id: resolvedOwnerId }
          : { ...aircraftDetails, id: `initial_${Date.now()}` }, // Ensure 'id' is set
        additionalAircrafts: allAircrafts.filter(
          (aircraft) => aircraft.id !== initialAircraftDetails?.id
        ),
        selectedAircraftIds, // Persist selectedAircraftIds
      });

      Alert.alert("Success", `Estimated cost per hour: $${costPerHour}`);
    } catch (error) {
      console.error("Error saving cost data:", error);
      Alert.alert("Error", "Failed to save cost data.");
    }
  };

  const handleInputChange = (name, value) => {
    if (name in aircraftDetails) {
      setAircraftDetails((prev) => ({ ...prev, [name]: value }));
    } else if (name in costData) {
      setCostData((prev) => ({ ...prev, [name]: value }));
    } else if (name in profileData) {
      setProfileData((prev) => ({ ...prev, [name]: value }));
    }
    // Removed the incorrect condition for withdrawalAmount
  };

  const pickImage = async () => {
    if (images.length >= 7) {
      Alert.alert("Limit Reached", "You can only upload up to 7 images.");
      return;
    }

    // Disable allowsEditing when allowsMultipleSelection is enabled
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      allowsEditing: false, // Set to false to fix the warning
      aspect: [4, 3],
      quality: 1,
      selectionLimit: 7 - images.length, // Allow selecting multiple images up to the limit
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
      const uploadedImages = [];
      for (const image of images) {
        const downloadURL = await uploadFile(image, "aircraftImages");
        uploadedImages.push(downloadURL);
      }

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

      // **Step 5: Determine if the aircraft is main or additional**
      const isMainAircraft = updatedAircraftDetails.id === resolvedOwnerId;

      if (isMainAircraft) {
        // **Step 6: Update Firestore for main aircraft**
        await updateDoc(doc(db, "aircraftDetails", resolvedOwnerId), {
          aircraftDetails: updatedAircraftDetails,
          costData: costData,
          selectedAircraftIds: selectedAircraftIds, // Persist selectedAircraftIds
        });

        // **Step 7: Update local state for main aircraft**
        setInitialAircraftDetails(updatedAircraftDetails);
        setAllAircrafts((prev) =>
          prev.map((aircraft) =>
            aircraft.id === resolvedOwnerId ? updatedAircraftDetails : aircraft
          )
        );
      } else {
        // **Step 6: Update Firestore for additional aircraft**
        const additionalAircraftsSnapshot = await getDoc(
          doc(db, "aircraftDetails", resolvedOwnerId)
        );

        let additionalAircrafts = [];

        if (additionalAircraftsSnapshot.exists()) {
          const data = additionalAircraftsSnapshot.data();
          additionalAircrafts = data.additionalAircrafts || [];
        }

        // **Find and update the specific additional aircraft**
        const aircraftIndex = additionalAircrafts.findIndex(
          (aircraft) => aircraft.id === updatedAircraftDetails.id
        );

        if (aircraftIndex !== -1) {
          additionalAircrafts[aircraftIndex] = updatedAircraftDetails;
        } else {
          // If it's a new additional aircraft, add it
          additionalAircrafts.push(updatedAircraftDetails);
        }

        // **Update Firestore**
        await updateDoc(doc(db, "aircraftDetails", resolvedOwnerId), {
          additionalAircrafts: additionalAircrafts,
          selectedAircraftIds: selectedAircraftIds, // Persist selectedAircraftIds
        });

        // **Update local state for additional aircraft**
        setAllAircrafts((prev) =>
          prev.map((aircraft) =>
            aircraft.id === updatedAircraftDetails.id
              ? updatedAircraftDetails
              : aircraft
          )
        );
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

  const onEditAircraftDetails = () => {
    setIsEditing(true);
  };

  const handleCloseAircraftModal = async () => {
    await onSaveAircraftDetails();
    setAircraftModalVisible(false);
  };

  // **Updated onSubmitMethod to accept aircraft data**
  const onSubmitMethod = async (aircraft, additional = false) => {
    // Validate necessary fields from the passed aircraft
    if (!aircraft.location || aircraft.location.trim() === "") {
      Alert.alert("Error", "Location is required for the selected aircraft.");
      return;
    }

    if (!aircraft.aircraft || aircraft.aircraft.trim() === "") {
      Alert.alert("Error", "Aircraft name/model is required.");
      return;
    }

    if (!aircraft.costPerHour || isNaN(aircraft.costPerHour)) {
      Alert.alert("Error", "Valid cost per hour is required.");
      return;
    }

    setLoading(true);
    try {
      // **Step 1: Upload Images**
      const uploadedImages = [];
      for (const image of aircraft.images || []) {
        const downloadURL = await uploadFile(image, "aircraftImages");
        uploadedImages.push(downloadURL);
      }

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
        aircraft: aircraft.aircraft || "",
        tailNumber: aircraft.tailNumber || "",
        engine: aircraft.engine || "",
        description: aircraft.description || "",
        location: aircraft.location || "",
        airportIdentifier: aircraft.airportIdentifier || "",
        ratesPerHour: aircraft.costPerHour || "0",
        minimumHours: profileData.minimumHours || "1",
        images: uploadedImages.length > 0 ? uploadedImages : [],
        mainImage: mainImageURL,
        currentAnnualPdf: annualProofURL || "",
        insurancePdf: insuranceProofURL || "",
        ownerId: resolvedOwnerId,
        createdAt: serverTimestamp(),
        boosted: profileData.boostListing || false,
        boostedListing: profileData.boostListing ? true : false,
      });

      // **Step 5: Add Listing to Firestore**
      const docRef = await addDoc(collection(db, "airplanes"), newListing);
      newListing.id = docRef.id;

      // **Step 6: Update State**
      if (additional) {
        setAllAircrafts((prev) => [...prev, newListing]);
      } else {
        setUserListings((prev) => [...prev, newListing]);
        setAllAircrafts((prev) => [...prev, newListing]);
      }

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
      // Fetch the selected aircraft details
      const selectedAircrafts = allAircrafts.filter((aircraft) =>
        selectedAircraftIds.includes(aircraft.id)
      );

      console.log("Selected Aircrafts for Listing:", selectedAircrafts);

      // List each selected aircraft
      for (const aircraft of selectedAircrafts) {
        await onSubmitMethod(aircraft, true);
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

  // **UPDATED: handleApproveRentalRequest with comprehensive logging and error handling**
  const handleApproveRentalRequest = async (request) => {
    try {
      if (!request.renterId || !request.listingId || !request.rentalPeriod) {
        console.error("Invalid request data: ", request);
        Alert.alert(
          "Error",
          "Request data is invalid or rental date is missing."
        );
        return;
      }

      // Update the rental request status
      const rentalRequestRef = doc(
        db,
        "owners",
        resolvedOwnerId,
        "rentalRequests",
        request.id
      );
      await updateDoc(rentalRequestRef, {
        status: "approved",
        rentalDate: request.rentalPeriod, // Use the date from the request
      });

      // Notify the renter
      await addDoc(
        collection(db, "renters", request.renterId, "notifications"),
        {
          type: "rentalApproved",
          message:
            "Your rental request has been approved. Please complete the payment.",
          listingId: request.listingId,
          ownerId: resolvedOwnerId,
          rentalDate: request.rentalPeriod,
          createdAt: serverTimestamp(),
        }
      );

      // **Modified Query: Use only one array-contains filter**
      const chatThreadsQuery = query(
        collection(db, "messages"),
        where("participants", "array-contains", resolvedOwnerId)
        // Removed the second 'array-contains' to comply with Firestore limitations
      );
      const chatSnapshot = await getDocs(chatThreadsQuery);
      let existingChatThread = null;

      chatSnapshot.forEach((docSnap) => {
        const chatData = docSnap.data();
        if (
          chatData.participants.includes(resolvedOwnerId) &&
          chatData.participants.includes(request.renterId)
        ) {
          existingChatThread = { id: docSnap.id, ...chatData };
        }
      });

      let chatThreadId = existingChatThread ? existingChatThread.id : null;

      if (!chatThreadId) {
        const chatThread = {
          participants: [resolvedOwnerId, request.renterId],
          messages: [],
          rentalRequestId: request.id,
          createdAt: serverTimestamp(),
        };
        const chatDocRef = await addDoc(collection(db, "messages"), chatThread);
        chatThread.id = chatDocRef.id;
        setChatThreads([...chatThreads, chatThread]);
        chatThreadId = chatDocRef.id;
      }

      console.log("Chat Thread ID:", chatThreadId);

      Alert.alert(
        "Request Approved",
        `The rental request for ${request.rentalPeriod} has been approved.`
      );

      // Optionally, open the message modal for the chat thread
      openMessageModal(chatThreadId);
      setRentalRequestModalVisible(false);
    } catch (error) {
      console.error("Error approving rental request: ", error);
      Alert.alert("Error", "There was an error approving the rental request.");
    }
  };

  const handleDenyRentalRequest = async (request) => {
    try {
      if (!resolvedOwnerId) {
        Alert.alert("Error", "Owner ID is undefined.");
        return;
      }

      if (!request.renterId || !request.listingId) {
        console.error("Invalid request data: ", request);
        Alert.alert("Error", "Request data is invalid.");
        return;
      }

      const rentalRequestRef = doc(
        db,
        "owners",
        resolvedOwnerId,
        "rentalRequests",
        request.id
      );
      await updateDoc(rentalRequestRef, { status: "denied" });

      await addDoc(
        collection(db, "renters", request.renterId, "notifications"),
        {
          type: "rentalDenied",
          message: "Your rental request has been denied by the owner.",
          listingId: request.listingId,
          ownerId: resolvedOwnerId,
          createdAt: serverTimestamp(),
        }
      );

      Alert.alert("Request Denied", "The rental request has been denied.");
      setRentalRequestModalVisible(false);
    } catch (error) {
      console.error("Error denying rental request:", error);
      Alert.alert("Error", "There was an error denying the rental request.");
    }
  };

  const fetchListingDetails = async (listingId) => {
    try {
      const listingDocRef = doc(db, "airplanes", listingId);
      const listingDoc = await getDoc(listingDocRef);
      if (listingDoc.exists()) {
        console.log(`Listing found for listingId: ${listingId}`);
        return listingDoc.data();
      } else {
        console.warn(`No listing found for listingId: ${listingId}`);
        return null;
      }
    } catch (error) {
      console.error("Error fetching listing details:", error);
      return null;
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    // Implement any additional refresh logic if necessary
    setRefreshing(false);
  };

  const calculateActualRevenue = () => {
    return rentalHistory
      .reduce((total, order) => {
        return total + parseFloat(order.totalCost);
      }, 0)
      .toFixed(2);
  };

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

  const handleRating = async (orderId, rating) => {
    try {
      const orderDocRef = doc(db, "rentalHistory", orderId);
      await updateDoc(orderDocRef, { rating });
      setRatings((prevRatings) => ({ ...prevRatings, [orderId]: rating }));
      Alert.alert("Rating Submitted", "Thank you for your feedback!");
    } catch (error) {
      console.error("Error submitting rating:", error);
      Alert.alert("Error", "Failed to submit rating.");
    }
  };

  // Function to handle selecting a main image
  const selectMainImage = (imageUri) => {
    setAircraftDetails((prev) => ({ ...prev, mainImage: imageUri }));
  };

  // Function to toggle selection of an aircraft
  const toggleSelectAircraft = (aircraftId) => {
    if (selectedAircraftIds.includes(aircraftId)) {
      setSelectedAircraftIds(
        selectedAircraftIds.filter((id) => id !== aircraftId)
      );
    } else {
      setSelectedAircraftIds([...selectedAircraftIds, aircraftId]);
    }
  };

  // *** NEW: Cleanup Functions ***

  // Function to clean up orphaned rental requests
  const cleanupOrphanedRentalRequests = async () => {
    try {
      const rentalRequestsRef = collection(
        db,
        "owners",
        resolvedOwnerId,
        "rentalRequests"
      );
      const snapshot = await getDocs(rentalRequestsRef);

      if (snapshot.empty) {
        Alert.alert("Cleanup", "No rental requests found to clean up.");
        return;
      }

      const batch = writeBatch(db);
      let deletions = 0;

      for (const docSnap of snapshot.docs) {
        const requestData = docSnap.data();
        const renterId = requestData.renterId;

        if (!renterId) {
          // If renterId is missing, delete the rental request
          batch.delete(docSnap.ref);
          deletions += 1;
          continue;
        }

        const renterDocRef = doc(db, "renters", renterId);
        const renterDocSnap = await getDoc(renterDocRef);

        if (!renterDocSnap.exists()) {
          // If renter document does not exist, delete the rental request
          batch.delete(docSnap.ref);
          deletions += 1;
        }
      }

      if (deletions > 0) {
        await batch.commit();
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

  // Function to delete all active rentals
  const deleteAllActiveRentals = async () => {
    try {
      const rentalRequestsRef = collection(
        db,
        "owners",
        resolvedOwnerId,
        "rentalRequests"
      );
      const activeRentalsQuery = query(
        rentalRequestsRef,
        where("status", "==", "approved"),
        orderBy("createdAt", "desc"),
        limit(500) // Firestore batch limit
      );

      const snapshot = await getDocs(activeRentalsQuery);

      if (snapshot.empty) {
        Alert.alert("Delete All", "No active rentals found to delete.");
        return;
      }

      const batch = writeBatch(db);
      const renterIdsToDelete = new Set();

      snapshot.docs.forEach((docSnap) => {
        const rentalData = docSnap.data();
        const renterId = rentalData.renterId;

        batch.delete(docSnap.ref);
        if (renterId) {
          renterIdsToDelete.add(renterId);
        }
      });

      // Fetch renter documents to delete
      const renterPromises = Array.from(renterIdsToDelete).map(
        async (renterId) => {
          const renterRef = doc(db, "renters", renterId);
          const renterDoc = await getDoc(renterRef);
          if (renterDoc.exists()) {
            batch.delete(renterRef);
          } else {
            console.warn(
              `Renter document does not exist for renterId: ${renterId}`
            );
          }
        }
      );

      await Promise.all(renterPromises);

      await batch.commit();
      Alert.alert(
        "Delete All Complete",
        "All active rentals have been deleted."
      );
      setActiveRentals([]); // Update state
    } catch (error) {
      console.error("Error deleting all active rentals:", error);
      Alert.alert("Error", "Failed to delete active rentals.");
    }
  };

  // Function to fetch active rentals with pagination
  const fetchActiveRentals = async () => {
    if (!hasMoreActiveRentals) return;

    try {
      let activeRentalsQueryInstance = query(
        collection(db, "owners", resolvedOwnerId, "rentalRequests"),
        where("status", "==", "approved"),
        orderBy("createdAt", "desc"),
        limit(ACTIVE_RENTALS_PAGE_SIZE)
      );

      if (lastActiveRentalDoc) {
        activeRentalsQueryInstance = query(
          collection(db, "owners", resolvedOwnerId, "rentalRequests"),
          where("status", "==", "approved"),
          orderBy("createdAt", "desc"),
          startAfter(lastActiveRentalDoc),
          limit(ACTIVE_RENTALS_PAGE_SIZE)
        );
      }

      const snapshot = await getDocs(activeRentalsQueryInstance);

      if (!snapshot.empty) {
        const rentalsData = await Promise.all(
          snapshot.docs.map(async (docSnap) => {
            const rentalData = docSnap.data();
            let renterName = "Anonymous";
            let renterCityState = "N/A";
            let flightHours = "N/A";
            let currentMedical = "N/A";
            let currentRentersInsurance = "N/A";

            if (rentalData.renterId) {
              try {
                const renterDocRef = doc(db, "renters", rentalData.renterId);
                const renterDoc = await getDoc(renterDocRef);
                if (renterDoc.exists()) {
                  const renterData = renterDoc.data();
                  renterName = renterData.fullName || "Anonymous";
                  renterCityState =
                    renterData.city && renterData.state
                      ? `${renterData.city}, ${renterData.state}`
                      : "N/A";
                  flightHours = renterData.flightHours || "N/A";
                  currentMedical = renterData.currentMedical || "N/A";
                  currentRentersInsurance =
                    renterData.currentRentersInsurance || "N/A";
                } else {
                  console.warn(
                    `Renter document does not exist for renterId: ${rentalData.renterId}`
                  );
                }
              } catch (error) {
                console.error("Error fetching renter's details:", error);
              }
            }

            const listingDetails = rentalData.listingId
              ? await fetchListingDetails(rentalData.listingId)
              : null;

            if (!listingDetails) {
              console.warn(
                `Listing details not found for listingId: ${rentalData.listingId}`
              );
            } else {
              console.log(`Fetched Listing Details:`, listingDetails);
            }

            return {
              id: docSnap.id,
              ...rentalData,
              renterName,
              renterCityState,
              flightHours,
              currentMedical,
              currentRentersInsurance,
              listingDetails,
            };
          })
        );

        setActiveRentalsPage((prevPage) => [...prevPage, ...rentalsData]);

        const lastVisible = snapshot.docs[snapshot.docs.length - 1];
        setLastActiveRentalDoc(lastVisible);

        if (snapshot.docs.length < ACTIVE_RENTALS_PAGE_SIZE) {
          setHasMoreActiveRentals(false);
        }
      } else {
        setHasMoreActiveRentals(false);
      }
    } catch (error) {
      console.error("Error fetching active rentals:", error);
      Alert.alert("Error", "Failed to fetch active rentals. Please try again.");
    }
  };

  // Function to handle infinite scrolling in "View More" Modal
  const handleLoadMoreActiveRentals = () => {
    if (hasMoreActiveRentals && !loading) {
      fetchActiveRentals();
    }
  };

  // Initialize active rentals page when modal is opened
  useEffect(() => {
    if (viewMoreModalVisible) {
      // Reset pagination
      setActiveRentalsPage([]);
      setLastActiveRentalDoc(null);
      setHasMoreActiveRentals(true);
      fetchActiveRentals();
    }
  }, [viewMoreModalVisible]);

  // Function to handle deleting an active rental
  const handleDeleteActiveRental = async (rentalId) => {
    try {
      // Delete the rental request document from Firestore
      const rentalRequestRef = doc(
        db,
        "owners",
        resolvedOwnerId,
        "rentalRequests",
        rentalId
      );
      await deleteDoc(rentalRequestRef);

      // Remove the rental from the activeRentals state
      setActiveRentals(
        activeRentals.filter((rental) => rental.id !== rentalId)
      );

      // Remove the rental from the activeRentalsPage state
      setActiveRentalsPage(
        activeRentalsPage.filter((rental) => rental.id !== rentalId)
      );

      // *** UPDATED: Remove from selectedAircraftIds if selected ***
      setSelectedAircraftIds(
        selectedAircraftIds.filter((id) => id !== rentalId)
      );

      Alert.alert("Deleted", "The active rental has been deleted.");
    } catch (error) {
      console.error("Error deleting active rental:", error);
      Alert.alert("Error", "Failed to delete the active rental.");
    }
  };

  // *** NEW: Define the onEditCostData function to handle editing cost data ***
  const onEditCostData = () => {
    setCostSaved(false);
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
              <Text
                style={{ fontSize: 18, fontWeight: "bold", color: "white" }}
              >
                {user?.displayName || "User"}
              </Text>
            </View>
            {/* Removed Funds Button from Header */}
          </View>
        </ImageBackground>

        {/* ************* Funds Button Above Cost of Ownership ************* */}
        <View style={styles.fundsButtonContainer}>
          <CustomButton
            onPress={() => setDepositModalVisible(true)}
            title={`$${availableBalance.toFixed(2)}`}
            backgroundColor="#000000" // Changed to black
            style={styles.fundsButtonStyle}
            textStyle={styles.fundsButtonTextStyle}
          />
        </View>
        {/* ************* End of Funds Button Placement ************* */}

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
                  parseFloat(costData.flightHoursPerYear)
                ).toFixed(2)}
              </Text>
              <CustomButton
                onPress={onEditCostData} // Now correctly defined
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
                />
                <CustomTextInput
                  placeholder="Loan Amount ($)"
                  value={costData.loanAmount}
                  onChangeText={(value) =>
                    handleInputChange("loanAmount", value)
                  }
                  keyboardType="numeric"
                />
                <CustomTextInput
                  placeholder="Interest Rate (%)"
                  value={costData.interestRate}
                  onChangeText={(value) =>
                    handleInputChange("interestRate", value)
                  }
                  keyboardType="numeric"
                />
                <CustomTextInput
                  placeholder="Loan Term (years)"
                  value={costData.loanTerm}
                  onChangeText={(value) => handleInputChange("loanTerm", value)}
                  keyboardType="numeric"
                />
                <CustomTextInput
                  placeholder="Depreciation Rate (%)"
                  value={costData.depreciationRate}
                  onChangeText={(value) =>
                    handleInputChange("depreciationRate", value)
                  }
                  keyboardType="numeric"
                />
                <CustomTextInput
                  placeholder="Useful Life (years)"
                  value={costData.usefulLife}
                  onChangeText={(value) =>
                    handleInputChange("usefulLife", value)
                  }
                  keyboardType="numeric"
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
                />
                <CustomTextInput
                  placeholder="Insurance Cost ($)"
                  value={costData.insuranceCost}
                  onChangeText={(value) =>
                    handleInputChange("insuranceCost", value)
                  }
                  keyboardType="numeric"
                />
                <CustomTextInput
                  placeholder="Hangar Cost ($)"
                  value={costData.hangarCost}
                  onChangeText={(value) =>
                    handleInputChange("hangarCost", value)
                  }
                  keyboardType="numeric"
                />
                <CustomTextInput
                  placeholder="Annual Registration & Fees ($)"
                  value={costData.annualRegistrationFees}
                  onChangeText={(value) =>
                    handleInputChange("annualRegistrationFees", value)
                  }
                  keyboardType="numeric"
                />
                <CustomTextInput
                  placeholder="Maintenance Reserve ($)"
                  value={costData.maintenanceReserve}
                  onChangeText={(value) =>
                    handleInputChange("maintenanceReserve", value)
                  }
                  keyboardType="numeric"
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
                />
                <CustomTextInput
                  placeholder="Oil Cost Per Hour ($)"
                  value={costData.oilCostPerHour}
                  onChangeText={(value) =>
                    handleInputChange("oilCostPerHour", value)
                  }
                  keyboardType="numeric"
                />
                <CustomTextInput
                  placeholder="Routine Maintenance Per Hour ($)"
                  value={costData.routineMaintenancePerHour}
                  onChangeText={(value) =>
                    handleInputChange("routineMaintenancePerHour", value)
                  }
                  keyboardType="numeric"
                />
                <CustomTextInput
                  placeholder="Tires Per Hour ($)"
                  value={costData.tiresPerHour}
                  onChangeText={(value) =>
                    handleInputChange("tiresPerHour", value)
                  }
                  keyboardType="numeric"
                />
                <CustomTextInput
                  placeholder="Other Consumables Per Hour ($)"
                  value={costData.otherConsumablesPerHour}
                  onChangeText={(value) =>
                    handleInputChange("otherConsumablesPerHour", value)
                  }
                  keyboardType="numeric"
                />
                <CustomTextInput
                  placeholder="Flight Hours Per Year"
                  value={costData.flightHoursPerYear}
                  onChangeText={(value) =>
                    handleInputChange("flightHoursPerYear", value)
                  }
                  keyboardType="numeric"
                />
              </Section>

              <CustomButton onPress={saveCostData} title="Save Cost Data" />
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
                aircraft: "",
                tailNumber: "", // New field
                engine: "",
                description: "",
                totalTime: "",
                costPerHour: "",
                location: "",
                airportIdentifier: "",
                mainImage: "",
                images: [],
              });
              setImages([]);
              setAircraftModalVisible(true);
            }}
            title="Add Aircraft"
            backgroundColor="#3182ce"
            style={{ marginBottom: 16 }}
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
                      {item.aircraft}
                    </Text>
                    <Text>Tail Number: {item.tailNumber}</Text>
                    <Text>Engine: {item.engine}</Text>
                    <Text>Total Time: {item.totalTime} hours</Text>
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
                                // Removal logic...
                              } catch (error) {
                                console.error(
                                  "Error removing aircraft:",
                                  error
                                );
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
                aircraft: "",
                tailNumber: "", // New field
                engine: "",
                description: "",
                totalTime: "",
                costPerHour: "",
                location: "",
                airportIdentifier: "",
                mainImage: "",
                images: [],
              });
              setImages([]);
              setAircraftModalVisible(true);
            }}
            style={styles.addAircraftButton}
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
          />
        </View>
        {/* ************* End of Updated Section: Your Aircraft ************* */}

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
                >
                  <View style={{ flexDirection: "row", alignItems: "center" }}>
                    {/* Pressable Area */}
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 18, fontWeight: "bold" }}>
                        {item.aircraft}
                      </Text>
                      <Text>{item.description}</Text>
                      <Text>Rate per Hour: ${item.ratesPerHour}</Text>
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
                                  await deleteDoc(
                                    doc(db, "airplanes", item.id)
                                  );
                                  setUserListings(
                                    userListings.filter((l) => l.id !== item.id)
                                  );
                                  setAllAircrafts(
                                    allAircrafts.filter((a) => a.id !== item.id)
                                  );
                                  setSelectedAircraftIds(
                                    selectedAircraftIds.filter(
                                      (id) => id !== item.id
                                    )
                                  ); // Remove from selectedAircraftIds if selected
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
                      style={styles.removeAircraftButton}
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
                  key={item.id || `rentalRequest_${index}`}
                  onPress={async () => {
                    setSelectedRequest(item);
                    const listing = await fetchListingDetails(item.listingId);
                    setSelectedListingDetails(listing);
                    setRentalRequestModalVisible(true);
                  }}
                  style={styles.rentalRequestContainer}
                >
                  <Text style={{ fontSize: 18, fontWeight: "bold" }}>
                    Renter: {item.renterName}
                  </Text>
                  {/* Display Aircraft */}
                  <Text>
                    Listing:{" "}
                    {item.listingDetails
                      ? `${item.listingDetails.aircraft}`
                      : "Listing details not available"}
                  </Text>
                  <Text>Total Cost: ${item.totalCost}</Text>
                  <Text>Requested Date: {item.rentalPeriod || "N/A"}</Text>
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
                  key={item.id || `activeRental_${index}`}
                  style={styles.activeRentalContainer}
                >
                  <TouchableOpacity
                    onPress={() => {
                      setSelectedRequest(item);
                      setSelectedListingDetails(item.listingDetails);
                      setRentalRequestModalVisible(true); // Reuse the same modal for Active Rentals
                    }}
                  >
                    <Text style={{ fontSize: 18, fontWeight: "bold" }}>
                      {item.listingDetails
                        ? `${item.listingDetails.aircraft}`
                        : "Listing details not available"}
                    </Text>
                    <Text>Renter: {item.renterName}</Text>
                    <Text>Total Cost: ${item.totalCost}</Text>
                    <Text>Rental Date: {item.rentalDate || "N/A"}</Text>
                    <Text>Status: {item.status}</Text>
                  </TouchableOpacity>
                  {/* Remove Button */}
                  <TouchableOpacity
                    onPress={() => handleDeleteActiveRental(item.id)}
                    style={styles.removeAircraftButton}
                  >
                    <Ionicons name="close-circle" size={24} color="red" />
                  </TouchableOpacity>
                </View>
              ))}

              {/* View More Button */}
              {activeRentals.length > 3 && (
                <CustomButton
                  onPress={() => setViewMoreModalVisible(true)} // Updated to open the new modal
                  title="View More"
                  backgroundColor="#3182ce"
                  style={{ marginTop: 16 }}
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
                        onPress: deleteAllActiveRentals,
                      },
                    ]
                  )
                }
                title="Delete All Active Rentals"
                backgroundColor="#e53e3e" // Red color for destructive action
                style={{ marginTop: 16 }}
              />
            </>
          ) : (
            <Text>No active rentals.</Text>
          )}
        </View>
        {/* ************* End of Active Rentals ************* */}

        {/* Rental History */}
        <View style={{ padding: 16 }}>
          <Text
            style={{
              fontSize: 24,
              fontWeight: "bold",
              marginBottom: 16,
              color: "#2d3748",
              textAlign: "center",
            }}
          >
            Rental History
          </Text>
          {rentalHistory.length > 0 ? (
            <FlatList
              data={rentalHistory}
              keyExtractor={(item, index) => `${item.id}_${index}`} // Ensure unique keys
              nestedScrollEnabled={true}
              scrollEnabled={false} // Disable scrolling to prevent nesting issues
              renderItem={({ item }) => (
                <View
                  key={item.id || `order_${index}`} // Ensure that order.id is unique and exists
                  style={styles.rentalHistoryContainer}
                >
                  <Text style={styles.rentalHistoryTitle}>{item.aircraft}</Text>
                  <Text style={styles.rentalHistoryText}>
                    {item.rentalPeriod}
                  </Text>
                  <Text style={styles.rentalHistoryText}>
                    {item.renterName}
                  </Text>
                  <View style={styles.ratingContainer}>
                    <Text style={{ color: "#2d3748" }}>Rate this renter:</Text>
                    <View style={{ flexDirection: "row" }}>
                      {[1, 2, 3, 4, 5].map((star) => (
                        <TouchableOpacity
                          key={`${item.id}_${star}`} // Ensure unique key
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
                  <CustomButton
                    onPress={() => {
                      setSelectedRequest(item);
                      openMessageModal(item.chatThreadId);
                    }}
                    title="Message Renter"
                    backgroundColor="#3182ce"
                    style={{ marginTop: 16 }}
                  />
                </View>
              )}
            />
          ) : (
            <Text style={{ color: "#4a5568", textAlign: "center" }}>
              No rental history.
            </Text>
          )}
        </View>
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
                    <Text style={styles.modalLabel}>Flight Hours: </Text>
                    {selectedRequest.flightHours}
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
                      ? `${selectedListingDetails.aircraft}`
                      : "Listing details not available"}
                  </Text>
                  <Text style={styles.modalText}>
                    <Text style={styles.modalLabel}>Rate per Hour: </Text>$
                    {selectedListingDetails.ratesPerHour}
                  </Text>
                  <Text style={styles.modalText}>
                    <Text style={styles.modalLabel}>Minimum Hours: </Text>
                    {selectedListingDetails.minimumHours}
                  </Text>
                  <Text style={styles.modalText}>
                    <Text style={styles.modalLabel}>Total Amount: </Text>$
                    {(
                      parseFloat(selectedListingDetails.ratesPerHour) *
                      parseFloat(selectedListingDetails.minimumHours)
                    ).toFixed(2)}
                  </Text>
                  <Text style={styles.modalText}>
                    <Text style={styles.modalLabel}>Requested Date: </Text>
                    {selectedRequest.rentalPeriod || "N/A"}
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
                        // Directly approve using the rentalPeriod from the request
                        handleApproveRentalRequest(selectedRequest);
                      }}
                      title="Approve"
                      backgroundColor="#48bb78"
                      style={{ flex: 1, marginRight: 8 }}
                      textStyle={{ fontSize: 16 }}
                    />
                    <CustomButton
                      onPress={() => handleDenyRentalRequest(selectedRequest)}
                      title="Deny"
                      backgroundColor="#e53e3e"
                      style={{ flex: 1, marginLeft: 8 }}
                      textStyle={{ fontSize: 16 }}
                    />
                  </View>
                )}

                {selectedRequest.status === "approved" && (
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
              />
              <TouchableOpacity onPress={sendMessage} style={styles.sendButton}>
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
                  >
                    {/* Display rental details */}
                    <Text style={{ fontSize: 18, fontWeight: "bold" }}>
                      {item.listingDetails
                        ? `${item.listingDetails.aircraft}`
                        : "Listing details not available"}
                    </Text>
                    <Text>Renter: {item.renterName}</Text>
                    <Text>Total Cost: ${item.totalCost}</Text>
                    <Text>Rental Date: {item.rentalDate || "N/A"}</Text>
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
              placeholder="Aircraft (Year/Make/Model)"
              value={aircraftDetails.aircraft}
              onChangeText={(value) => handleInputChange("aircraft", value)}
              editable={isEditing}
            />
            <CustomTextInput
              placeholder="Tail Number"
              value={aircraftDetails.tailNumber}
              onChangeText={(value) => handleInputChange("tailNumber", value)}
              editable={isEditing}
            />
            <CustomTextInput
              placeholder="Engine"
              value={aircraftDetails.engine}
              onChangeText={(value) => handleInputChange("engine", value)}
              editable={isEditing}
            />
            <CustomTextInput
              placeholder="Total Time"
              value={aircraftDetails.totalTime}
              onChangeText={(value) => handleInputChange("totalTime", value)}
              keyboardType="numeric"
              editable={isEditing}
            />
          </Section>

          {/* Location Information Section */}
          <Section title="Location Information">
            <CustomTextInput
              placeholder="Location"
              value={aircraftDetails.location}
              onChangeText={(value) => handleInputChange("location", value)}
              editable={isEditing}
            />
            <CustomTextInput
              placeholder="Airport Identifier"
              value={aircraftDetails.airportIdentifier}
              onChangeText={(value) =>
                handleInputChange("airportIdentifier", value)
              }
              editable={isEditing}
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
                      >
                        <Text style={{ color: "white", fontSize: 10 }}>
                          Set Main
                        </Text>
                      </TouchableOpacity>
                      {/* Remove Image Button */}
                      <TouchableOpacity
                        onPress={() => removeImage(item)}
                        style={styles.removeImageButton}
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
                />
                <CustomButton
                  onPress={handleCloseAircraftModal}
                  title="Close"
                  backgroundColor="#e53e3e"
                />
              </>
            ) : (
              <CustomButton
                onPress={onEditAircraftDetails}
                title="Edit Aircraft"
                backgroundColor="#48bb78"
                style={{ marginBottom: 16 }}
              />
            )}
          </View>
        </ScrollView>
      </Modal>
      {/* ************* End of Aircraft Details Modal ************* */}

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
                  />
                </Section>

                <CustomButton
                  onPress={handleWithdraw}
                  title="Withdraw"
                  backgroundColor="#48bb78"
                  style={{ marginTop: 16 }}
                />
                <CustomButton
                  onPress={() => setDepositModalVisible(false)}
                  title="Cancel"
                  backgroundColor="#e53e3e"
                  style={{ marginTop: 8 }}
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

const styles = StyleSheet.create({
  // Reusable Styles
  input: {
    borderBottomWidth: 1,
    borderBottomColor: "#ccc",
    marginBottom: 12,
    paddingVertical: 8,
    color: "#000", // Ensure text color is visible
  },
  button: {
    paddingVertical: 12,
    borderRadius: 8,
    paddingHorizontal: 16,
    justifyContent: "center", // Ensure text is centered vertically
    alignItems: "center", // Ensure text is centered horizontally
  },
  buttonText: {
    color: "white",
    textAlign: "center",
    fontWeight: "bold",
  },
  calculatorResultContainer: {
    backgroundColor: "#edf2f7",
    padding: 16,
    borderRadius: 16,
  },
  calculatorTitle: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 8,
  },
  calculatorText: {
    fontSize: 16,
    marginBottom: 4,
  },
  aircraftCard: {
    width: 250,
    backgroundColor: "#edf2f7",
    borderRadius: 16,
    marginRight: 16,
    padding: 16,
    position: "relative",
  },
  // Updated Selection Button Styles
  selectionButton: {
    position: "absolute",
    top: 10,
    left: 10,
    width: 32, // Increased size for better visibility
    height: 32, // Increased size for better visibility
    borderRadius: 16, // Half of width and height to make it circular
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1,
  },
  selectionButtonUnselected: {
    borderColor: "#3182ce",
    backgroundColor: "transparent",
  },
  selectionButtonSelected: {
    borderColor: "#48bb78", // Changed border color when selected
    backgroundColor: "#48bb78", // Filled background when selected
  },
  aircraftCardImage: {
    width: "100%",
    height: 120,
    borderRadius: 8,
    marginBottom: 8,
  },
  aircraftCardInfo: {
    flex: 1,
  },
  aircraftCardTitle: {
    fontSize: 16,
    fontWeight: "bold",
    marginBottom: 4,
  },
  removeAircraftButton: {
    position: "absolute",
    top: 16,
    right: 16,
  },
  noImageContainer: {
    width: "100%",
    height: 120,
    borderRadius: 8,
    backgroundColor: "#cbd5e0",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  listingContainer: {
    backgroundColor: "#edf2f7",
    padding: 16,
    borderRadius: 16,
    marginBottom: 16,
  },
  listingImage: {
    width: 100,
    height: 100,
    margin: 8,
    borderRadius: 8,
  },
  rentalRequestContainer: {
    backgroundColor: "#edf2f7",
    padding: 16,
    borderRadius: 16,
    marginBottom: 16,
  },
  activeRentalContainer: {
    backgroundColor: "#edf2f7",
    padding: 16,
    borderRadius: 16,
    marginBottom: 16,
    position: "relative",
  },
  rentalHistoryContainer: {
    backgroundColor: "#edf2f7",
    padding: 16,
    borderRadius: 16,
    marginBottom: 16,
  },
  rentalHistoryTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#2d3748",
  },
  rentalHistoryText: {
    color: "#4a5568",
  },
  ratingContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 16,
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
  messageModalContainer: {
    width: "90%",
    height: "80%",
    backgroundColor: "white",
    borderRadius: 24,
    padding: 24,
    position: "relative",
    maxHeight: "80%",
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
    color: "#000", // Ensure text color is visible
  },
  sendButton: {
    backgroundColor: "#3182ce",
    padding: 12,
    borderRadius: 24,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center", // Center the modal vertically
    alignItems: "center", // Center the modal horizontally
  },
  modalContainer: {
    width: "90%",
    backgroundColor: "white",
    borderRadius: 24,
    padding: 24,
    position: "relative",
    maxHeight: "80%",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
    position: "relative",
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "bold",
    textAlign: "center",
  },
  closeModalButton: {
    position: "absolute",
    right: 0,
  },
  setMainImageButton: {
    position: "absolute",
    bottom: 4,
    left: 4,
    backgroundColor: "#3182ce",
    paddingVertical: 2,
    paddingHorizontal: 4,
    borderRadius: 4,
  },
  imagePreviewContainer: {
    position: "relative",
    alignItems: "center",
    marginRight: 8,
  },
  imagePreview: {
    width: 100,
    height: 100,
    borderRadius: 8,
  },
  mainImageDisplay: {
    width: 200,
    height: 200,
    borderRadius: 8,
    marginTop: 8,
  },
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
  notificationBadge: {
    position: "absolute",
    top: -5,
    right: -5,
    backgroundColor: "red",
    borderRadius: 10,
    width: 20,
    height: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  fundsButtonContainer: {
    alignItems: "center", // Center horizontally
    marginVertical: 16, // Add some vertical spacing
  },
  fundsButtonStyle: {
    width: 200, // Adjust the width as needed
    paddingVertical: 12,
    borderRadius: 24,
  },
  fundsButtonTextStyle: {
    color: "white",
    fontWeight: "bold",
    marginLeft: 8,
  },
  pickerContainer: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
    marginTop: 8,
  },
  picker: {
    height: 50,
    width: "100%",
  },
  depositModalContainer: {
    width: "90%",
    maxHeight: "90%", // Allow the modal to expand up to 90% of the screen height
    backgroundColor: "white",
    borderRadius: 24,
    padding: 24,
  },
  modalText: {
    fontSize: 16,
    color: "#2d3748",
    marginBottom: 8,
  },
  modalLabel: {
    fontWeight: "bold",
  },
  modalButtonsContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 16,
  },

  // NEW: Add Aircraft Button Style
  addAircraftButton: {
    alignItems: "center",
    justifyContent: "center",
    marginTop: 16,
  },
});

export default OwnerProfile;
