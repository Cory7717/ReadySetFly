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
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { db, storage, auth } from "../../firebaseConfig"; // Import Firebase Auth
import * as ImagePicker from "expo-image-picker";
import {
  collection,
  addDoc,
  onSnapshot,
  updateDoc,
  deleteDoc,
  doc,
  getDoc,
  getDocs, // Imported getDocs for querying Firestore
  setDoc,
} from "firebase/firestore";
import { FontAwesome, Ionicons } from "@expo/vector-icons";
import wingtipClouds from "../../Assets/images/wingtip_clouds.jpg";
import { useStripe } from "@stripe/stripe-react-native";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { Calendar } from "react-native-calendars";

const OwnerProfile = ({ ownerId }) => {
  const navigation = useNavigation();
  const user = auth.currentUser; // Get current Firebase user
  const stripe = useStripe();
  const resolvedOwnerId = ownerId || user?.uid; // Resolve ownerId or default to Firebase user ID

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
    year: "",
    make: "",
    model: "",
    engine: "",
    description: "",
    totalTime: "",
    costPerHour: "",
    location: "",
    airportIdentifier: "",
    mainImage: "", // New field for main image
    images: [], // Ensure images are part of aircraftDetails
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
  const [selectedDates, setSelectedDates] = useState({});
  const [formVisible, setFormVisible] = useState(false);
  const [calendarVisible, setCalendarVisible] = useState(false);
  const [userListings, setUserListings] = useState([]);
  const [rentalHistory, setRentalHistory] = useState([]);
  const [ratings, setRatings] = useState({});
  const [availableBalance, setAvailableBalance] = useState(5000);
  const [transferModalVisible, setTransferModalVisible] = useState(false);
  const [achModalVisible, setAchModalVisible] = useState(false);
  const [debitModalVisible, setDebitModalVisible] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [rentalRequests, setRentalRequests] = useState([]);
  const [activeRentals, setActiveRentals] = useState([]); // New State Variable for Active Rentals
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [messageInput, setMessageInput] = useState("");
  const [messageModalVisible, setMessageModalVisible] = useState(false);
  const [messages, setMessages] = useState([]);
  const [chatThreads, setChatThreads] = useState([]);
  const [selectedChatThreadId, setSelectedChatThreadId] = useState(null);
  const [fullScreenModalVisible, setFullScreenModalVisible] = useState(false);
  const [aircraftModalVisible, setAircraftModalVisible] = useState(false);
  const [selectedAircraft, setSelectedAircraft] = useState(null); // New state for selected aircraft
  const [isEditing, setIsEditing] = useState(false); // New state for edit mode
  const [rentalDate, setRentalDate] = useState(null);
  const [selectedAircraftIds, setSelectedAircraftIds] = useState([]); // Track selected aircraft for listing

  // New State Variables for Rental Request Modal
  const [rentalRequestModalVisible, setRentalRequestModalVisible] = useState(false);
  const [selectedListingDetails, setSelectedListingDetails] = useState(null);

  // Fetch stored data on mount
  useEffect(() => {
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
            setAircraftDetails(data.aircraftDetails);
            setInitialAircraftDetails(data.aircraftDetails);
            setAircraftSaved(true);
            setAllAircrafts([data.aircraftDetails]); // Initialize with initial aircraft
          }

          if (data.additionalAircrafts && Array.isArray(data.additionalAircrafts)) {
            setAllAircrafts((prev) => [...prev, ...data.additionalAircrafts]);
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

  // Fetch rental requests with renter details and chat thread data
  useEffect(() => {
    if (resolvedOwnerId) {
      const rentalRequestsQuery = collection(
        db,
        "owners",
        resolvedOwnerId,
        "rentalRequests"
      );

      const unsubscribeRentalRequests = onSnapshot(
        rentalRequestsQuery,
        async (snapshot) => {
          const requestsWithNamesAndListings = await Promise.all(
            snapshot.docs.map(async (docSnap) => {
              const requestData = docSnap.data();

              let renterName = "Anonymous";
              if (requestData.renterId) {
                try {
                  const renterDocRef = doc(db, "renters", requestData.renterId);
                  const renterDoc = await getDoc(renterDocRef);
                  if (renterDoc.exists()) {
                    renterName = renterDoc.data().fullName || "Anonymous";
                  }
                } catch (error) {
                  console.error("Error fetching renter's name:", error);
                }
              }

              const listingDetails = await fetchListingDetails(requestData.listingId);

              return {
                id: docSnap.id,
                ...requestData,
                renterName,
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
    if (
      !purchasePrice ||
      !loanAmount ||
      !interestRate ||
      !loanTerm ||
      !depreciationRate ||
      !usefulLife ||
      !estimatedAnnualCost ||
      !insuranceCost ||
      !hangarCost ||
      !annualRegistrationFees ||
      !maintenanceReserve ||
      !oilCostPerHour ||
      !routineMaintenancePerHour ||
      !tiresPerHour ||
      !otherConsumablesPerHour ||
      !fuelCostPerHour ||
      !flightHoursPerYear
    ) {
      Alert.alert("Error", "Please fill in all fields for accurate calculation.");
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
      (parseFloat(purchasePrice) * parseFloat(depreciationRate)) / 100
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
      mortgageExpense: mortgageExpense,
      depreciationExpense: depreciationExpense,
    }));
    setCostSaved(true);
    setLoading(false);

    try {
      await setDoc(doc(db, "aircraftDetails", resolvedOwnerId), {
        costData,
        aircraftDetails: initialAircraftDetails, // Save only initial aircraft here
        additionalAircrafts: allAircrafts.filter(
          (aircraft) => aircraft.id !== initialAircraftDetails?.id
        ), // Save additional aircraft separately
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
  };

  const pickImage = async () => {
    if (images.length >= 7) {
      Alert.alert("Limit Reached", "You can only upload up to 7 images.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 1,
    });

    if (!result.canceled) {
      setImages([...images, result.assets[0].uri]);
    }
  };

  const removeImage = (uri) => {
    setImages(images.filter((image) => image !== uri));
  };

  const onDayPress = (day) => {
    const selected = !selectedDates[day.dateString];
    setRentalDate(day.dateString);
    setSelectedDates({
      [day.dateString]: selected
        ? { selected: true, marked: true, dotColor: "red" }
        : undefined,
    });

    // If a request is selected, handle approval with the selected date
    if (selectedRequest) {
      handleApproveRentalRequest(selectedRequest, day.dateString);
      setSelectedRequest(null); // Reset after approval
    }

    setCalendarVisible(false);
  };

  const uploadFile = async (uri, folder) => {
    try {
      const response = await fetch(uri);
      const blob = await response.blob();
      const filename = uri.substring(uri.lastIndexOf("/") + 1);

      const storageRef = ref(storage, `${folder}/${resolvedOwnerId}/${filename}`);

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
    if (!aircraftDetails.location || aircraftDetails.location.trim() === "") {
      Alert.alert("Error", "Location is required.");
      return;
    }
  
    setAircraftSaved(true);
    Alert.alert("Success", "Your aircraft details have been saved.");
  
    try {
      let updatedAircrafts = [...allAircrafts];
  
      // Sanitize aircraftDetails before saving
      const sanitizedAircraftDetails = sanitizeData(aircraftDetails);
  
      if (initialAircraftDetails) {
        // Update existing initial aircraft
        updatedAircrafts = updatedAircrafts.map((aircraft) =>
          aircraft.id === initialAircraftDetails.id
            ? { ...sanitizedAircraftDetails, id: aircraft.id }
            : aircraft
        );
      } else {
        // Add new initial aircraft
        const newInitialAircraft = { ...sanitizedAircraftDetails, id: "initial" };
        updatedAircrafts = [newInitialAircraft, ...updatedAircrafts];
        setInitialAircraftDetails(newInitialAircraft);
      }
  
      setAllAircrafts(updatedAircrafts);
  
      await setDoc(doc(db, "aircraftDetails", resolvedOwnerId), {
        costData,
        aircraftDetails: initialAircraftDetails
          ? updatedAircrafts.find((a) => a.id === initialAircraftDetails.id)
          : updatedAircrafts[0],
        additionalAircrafts: updatedAircrafts.filter(
          (aircraft) => aircraft.id !== "initial"
        ),
      });
    } catch (error) {
      console.error("Error saving aircraft details:", error);
      Alert.alert("Error", "Failed to save aircraft details.");
    }
  };
  

  const onEditAircraftDetails = () => {
    setIsEditing(true);
  };

  const onCancelAircraftEdit = () => {
    if (initialAircraftDetails) {
      setAircraftDetails(initialAircraftDetails);
      setImages(initialAircraftDetails.images || []);
      setAircraftSaved(true);
      setIsEditing(false);
      Alert.alert(
        "Canceled",
        "Aircraft details reverted to the original state."
      );
    }
  };

  const onEditCostData = () => {
    setCostSaved(false);
  };

  const onSubmitMethod = async (values, additional = false) => {
    if (!aircraftDetails.location || aircraftDetails.location.trim() === "") {
      Alert.alert("Error", "Location is required.");
      return;
    }

    if (!aircraftDetails.model || aircraftDetails.model.trim() === "") {
      Alert.alert("Error", "Aircraft model is required.");
      return;
    }

    if (!aircraftDetails.costPerHour || isNaN(aircraftDetails.costPerHour)) {
      Alert.alert("Error", "Valid cost per hour is required.");
      return;
    }

    setLoading(true);
    try {
      // Upload images to Firebase Storage and get download URLs
      const uploadedImages = [];
      for (const image of images) {
        const downloadURL = await uploadFile(image, "airplaneImages");
        uploadedImages.push(downloadURL);
      }

      const annualProofURL = currentAnnualPdf
        ? await uploadFile(currentAnnualPdf, "documents")
        : "";
      const insuranceProofURL = insurancePdf
        ? await uploadFile(insurancePdf, "documents")
        : "";

      // Prepare new listing data
      const newListing = sanitizeData({
        year: aircraftDetails.year || "",
        make: aircraftDetails.make || "",
        airplaneModel: aircraftDetails.model || "",
        description: profileData.description || "",
        location: aircraftDetails.location || "",
        airportIdentifier: aircraftDetails.airportIdentifier || "",
        ratesPerHour: aircraftDetails.costPerHour || "0",
        minimumHours: profileData.minimumHours || "1",
        images: uploadedImages.length > 0 ? uploadedImages : [],
        mainImage: uploadedImages.length > 0 ? uploadedImages[0] : "", // Set the first image as main image by default
        currentAnnualPdf: annualProofURL || "",
        insurancePdf: insuranceProofURL || "",
        ownerId: resolvedOwnerId,
        createdAt: new Date(),
        boosted: profileData.boostListing || false,
        boostedListing: profileData.boostListing ? true : false,
      });

      const docRef = await addDoc(collection(db, "airplanes"), newListing);
      newListing.id = docRef.id;

      if (additional) {
        setAllAircrafts([...allAircrafts, newListing]);
      } else {
        setUserListings([...userListings, newListing]);
        setAllAircrafts([...allAircrafts, newListing]);
      }

      Alert.alert("Success", "Your listing has been submitted.");
      setFullScreenModalVisible(false);
      setIsListedForRent(true);
    } catch (error) {
      console.error("Error submitting listing: ", error);
      Alert.alert("Error", `There was an error submitting your listing: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

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

      // List each selected aircraft
      for (const aircraft of selectedAircrafts) {
        await onSubmitMethod(aircraft, true);
      }

      // Reset selection after listing
      setSelectedAircraftIds([]);
      Alert.alert("Success", "Selected aircraft have been listed for rent.");
    } catch (error) {
      console.error("Error listing aircraft: ", error);
      Alert.alert("Error", "There was an error listing the selected aircraft.");
    } finally {
      setLoading(false);
    }
  };

  // Updated handleApproveRentalRequest to accept rentalDate
  const handleApproveRentalRequest = async (request, rentalDate) => {
    try {
      if (!request.renterId || !request.listingId || !rentalDate) {
        console.error("Invalid request data: ", request);
        Alert.alert("Error", "Request data is invalid or rental date is missing.");
        return;
      }

      // Update the rental request status
      const notificationRef = doc(
        db,
        "owners",
        resolvedOwnerId,
        "rentalRequests",
        request.id
      );
      await updateDoc(notificationRef, {
        status: "approved",
        rentalDate: rentalDate,
      });

      // Notify the renter
      await addDoc(collection(db, "renters", request.renterId, "notifications"), {
        type: "rentalApproved",
        message:
          "Your rental request has been approved. Please complete the payment.",
        listingId: request.listingId,
        ownerId: resolvedOwnerId,
        rentalDate: rentalDate,
        createdAt: new Date(),
      });

      // Create a chat thread if not exists
      const chatThreadsQuery = collection(db, "messages");
      const querySnapshot = await getDocs(chatThreadsQuery);
      let existingChatThread = null;

      querySnapshot.forEach((docSnap) => {
        const chatData = docSnap.data();
        if (
          chatData.participants?.includes(resolvedOwnerId) &&
          chatData.participants?.includes(request.renterId)
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
          createdAt: new Date(),
        };
        const chatDocRef = await addDoc(collection(db, "messages"), chatThread);
        chatThread.id = chatDocRef.id;
        setChatThreads([...chatThreads, chatThread]);
        chatThreadId = chatDocRef.id;
      }

      Alert.alert(
        "Request Approved",
        `The rental request for ${rentalDate} has been approved.`
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

      const notificationRef = doc(
        db,
        "owners",
        resolvedOwnerId,
        "rentalRequests",
        request.id
      );
      await updateDoc(notificationRef, { status: "denied" });

      await addDoc(collection(db, "renters", request.renterId, "notifications"), {
        type: "rentalDenied",
        message: "Your rental request has been denied by the owner.",
        listingId: request.listingId,
        ownerId: resolvedOwnerId,
        createdAt: new Date(),
      });

      Alert.alert("Request Denied", "The rental request has been denied.");
      setRentalRequestModalVisible(false);
    } catch (error) {
      console.error("Error denying rental request: ", error);
      Alert.alert("Error", "There was an error denying the rental request.");
    }
  };

  const fetchListingDetails = async (listingId) => {
    try {
      const listingDocRef = doc(db, "airplanes", listingId);
      const listingDoc = await getDoc(listingDocRef);
      if (listingDoc.exists()) {
        return listingDoc.data();
      } else {
        return null;
      }
    } catch (error) {
      console.error("Error fetching listing details:", error);
      return null;
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
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
        } else {
          setMessages([]);
        }
      } else {
        setMessages([]);
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
  const selectMainImage = (imageUrl) => {
    if (selectedAircraft) {
      const updatedAircrafts = allAircrafts.map((aircraft) =>
        aircraft.id === selectedAircraft.id
          ? { ...aircraft, mainImage: imageUrl }
          : aircraft
      );
      setAllAircrafts(updatedAircrafts);
      setSelectedAircraft((prev) => ({ ...prev, mainImage: imageUrl }));
      setIsEditing(false);
      Alert.alert("Main Image Selected", "The main image has been updated.");
    }
  };

  // Function to toggle selection of an aircraft
  const toggleSelectAircraft = (aircraftId) => {
    if (selectedAircraftIds.includes(aircraftId)) {
      setSelectedAircraftIds(selectedAircraftIds.filter(id => id !== aircraftId));
    } else {
      setSelectedAircraftIds([...selectedAircraftIds, aircraftId]);
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
          </View>
        </ImageBackground>

        {/* Cost of Ownership Calculator */}
        <View style={{ padding: 16 }}>
          <Text style={{ fontSize: 24, fontWeight: "bold", marginBottom: 16 }}>
            Cost of Ownership Calculator
          </Text>
          {costSaved ? (
            <View style={{ backgroundColor: "#edf2f7", padding: 16, borderRadius: 16 }}>
              <Text style={{ fontSize: 18, fontWeight: "bold", marginBottom: 8 }}>
                Estimated Cost per Hour: ${costData.costPerHour}
              </Text>
              <Text style={{ fontSize: 16, marginBottom: 4 }}>
                Total Fixed Costs per Year: ${(
                  parseFloat(costData.mortgageExpense) * 12 +
                  parseFloat(costData.depreciationExpense) +
                  parseFloat(costData.insuranceCost) +
                  parseFloat(costData.hangarCost) +
                  parseFloat(costData.maintenanceReserve) +
                  parseFloat(costData.annualRegistrationFees)
                ).toFixed(2)}
              </Text>
              <Text style={{ fontSize: 16, marginBottom: 4 }}>
                Total Variable Costs per Year: ${(
                  (parseFloat(costData.fuelCostPerHour) +
                    parseFloat(costData.oilCostPerHour) +
                    parseFloat(costData.routineMaintenancePerHour) +
                    parseFloat(costData.tiresPerHour) +
                    parseFloat(costData.otherConsumablesPerHour)) *
                  parseFloat(costData.flightHoursPerYear)
                ).toFixed(2)}
              </Text>
              <TouchableOpacity
                onPress={onEditCostData}
                style={{
                  backgroundColor: "#3182ce",
                  paddingVertical: 12,
                  borderRadius: 8,
                  marginTop: 16,
                }}
              >
                <Text style={{ color: "white", textAlign: "center", fontWeight: "bold" }}>
                  Edit Cost Data
                </Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View>
              <View style={{ marginBottom: 16 }}>
                <Text style={{ fontSize: 20, fontWeight: 'bold', marginBottom: 8 }}>Loan Details</Text>
                <TextInput
                  placeholder="Purchase Price ($)"
                  value={costData.purchasePrice}
                  onChangeText={(value) => handleInputChange('purchasePrice', value)}
                  keyboardType="numeric"
                  style={styles.input}
                />
                <TextInput
                  placeholder="Loan Amount ($)"
                  value={costData.loanAmount}
                  onChangeText={(value) => handleInputChange('loanAmount', value)}
                  keyboardType="numeric"
                  style={styles.input}
                />
                <TextInput
                  placeholder="Interest Rate (%)"
                  value={costData.interestRate}
                  onChangeText={(value) => handleInputChange('interestRate', value)}
                  keyboardType="numeric"
                  style={styles.input}
                />
                <TextInput
                  placeholder="Loan Term (years)"
                  value={costData.loanTerm}
                  onChangeText={(value) => handleInputChange('loanTerm', value)}
                  keyboardType="numeric"
                  style={styles.input}
                />
                <TextInput
                  placeholder="Depreciation Rate (%)"
                  value={costData.depreciationRate}
                  onChangeText={(value) => handleInputChange('depreciationRate', value)}
                  keyboardType="numeric"
                  style={styles.input}
                />
                <TextInput
                  placeholder="Useful Life (years)"
                  value={costData.usefulLife}
                  onChangeText={(value) => handleInputChange('usefulLife', value)}
                  keyboardType="numeric"
                  style={styles.input}
                />
                <Text style={{ marginTop: 8 }}>Mortgage Expense: ${costData.mortgageExpense}</Text>
                <Text style={{ marginTop: 4 }}>Depreciation Expense: ${costData.depreciationExpense}</Text>
              </View>

              <View style={{ marginBottom: 16 }}>
                <Text style={{ fontSize: 20, fontWeight: 'bold', marginBottom: 8 }}>Annual Costs</Text>
                <TextInput
                  placeholder="Estimated Annual Cost ($)"
                  value={costData.estimatedAnnualCost}
                  onChangeText={(value) => handleInputChange('estimatedAnnualCost', value)}
                  keyboardType="numeric"
                  style={styles.input}
                />
                <TextInput
                  placeholder="Insurance Cost ($)"
                  value={costData.insuranceCost}
                  onChangeText={(value) => handleInputChange('insuranceCost', value)}
                  keyboardType="numeric"
                  style={styles.input}
                />
                <TextInput
                  placeholder="Hangar Cost ($)"
                  value={costData.hangarCost}
                  onChangeText={(value) => handleInputChange('hangarCost', value)}
                  keyboardType="numeric"
                  style={styles.input}
                />
                <TextInput
                  placeholder="Annual Registration & Fees ($)"
                  value={costData.annualRegistrationFees}
                  onChangeText={(value) => handleInputChange('annualRegistrationFees', value)}
                  keyboardType="numeric"
                  style={styles.input}
                />
                <TextInput
                  placeholder="Maintenance Reserve ($)"
                  value={costData.maintenanceReserve}
                  onChangeText={(value) => handleInputChange('maintenanceReserve', value)}
                  keyboardType="numeric"
                  style={styles.input}
                />
              </View>

              <View style={{ marginBottom: 16 }}>
                <Text style={{ fontSize: 20, fontWeight: 'bold', marginBottom: 8 }}>Operational Costs</Text>
                <TextInput
                  placeholder="Fuel Cost Per Hour ($)"
                  value={costData.fuelCostPerHour}
                  onChangeText={(value) => handleInputChange('fuelCostPerHour', value)}
                  keyboardType="numeric"
                  style={styles.input}
                />
                <TextInput
                  placeholder="Oil Cost Per Hour ($)"
                  value={costData.oilCostPerHour}
                  onChangeText={(value) => handleInputChange('oilCostPerHour', value)}
                  keyboardType="numeric"
                  style={styles.input}
                />
                <TextInput
                  placeholder="Routine Maintenance Per Hour ($)"
                  value={costData.routineMaintenancePerHour}
                  onChangeText={(value) => handleInputChange('routineMaintenancePerHour', value)}
                  keyboardType="numeric"
                  style={styles.input}
                />
                <TextInput
                  placeholder="Tires Per Hour ($)"
                  value={costData.tiresPerHour}
                  onChangeText={(value) => handleInputChange('tiresPerHour', value)}
                  keyboardType="numeric"
                  style={styles.input}
                />
                <TextInput
                  placeholder="Other Consumables Per Hour ($)"
                  value={costData.otherConsumablesPerHour}
                  onChangeText={(value) => handleInputChange('otherConsumablesPerHour', value)}
                  keyboardType="numeric"
                  style={styles.input}
                />
                <TextInput
                  placeholder="Flight Hours Per Year"
                  value={costData.flightHoursPerYear}
                  onChangeText={(value) => handleInputChange('flightHoursPerYear', value)}
                  keyboardType="numeric"
                  style={styles.input}
                />
              </View>

              <TouchableOpacity
                onPress={saveCostData}
                style={{
                  backgroundColor: "#3182ce",
                  paddingVertical: 12,
                  borderRadius: 8,
                  marginBottom: 16,
                }}
              >
                <Text style={{ color: "white", textAlign: "center", fontWeight: "bold" }}>
                  Save Cost Data
                </Text>
              </TouchableOpacity>
              {loading && (
                <ActivityIndicator size="large" color="#3182ce" style={{ marginTop: 16 }} />
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
          <TouchableOpacity
            onPress={() => {
              setSelectedAircraft(null);
              setIsEditing(true);
              setAircraftDetails({
                year: "",
                make: "",
                model: "",
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
            style={{
              backgroundColor: "#3182ce",
              paddingVertical: 12,
              borderRadius: 8,
              marginBottom: 16,
            }}
          >
            <Text
              style={{ color: "white", textAlign: "center", fontWeight: "bold" }}
            >
              Add Aircraft
            </Text>
          </TouchableOpacity>

          {/* List of All Aircraft with Selection */}
          {allAircrafts.length > 0 ? (
            allAircrafts.map((item) => (
              <View key={item.id} style={{ flexDirection: "row", alignItems: "center", marginBottom: 12 }}>
                {/* Selection Circle */}
                <TouchableOpacity
                  onPress={() => toggleSelectAircraft(item.id)}
                  style={styles.selectionCircle}
                >
                  {selectedAircraftIds.includes(item.id) && (
                    <View style={styles.selectedCircle} />
                  )}
                </TouchableOpacity>

                {/* Aircraft Details */}
                <TouchableOpacity
                  onPress={() => {
                    setSelectedAircraft(item);
                    setIsEditing(false);
                    setAircraftDetails(item);
                    setImages(item.images || []);
                    setAircraftModalVisible(true);
                  }}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    backgroundColor: "#edf2f7",
                    padding: 16,
                    borderRadius: 16,
                    flex: 1,
                  }}
                >
                  {/* Main Image */}
                  {item.mainImage ? (
                    <Image
                      source={{ uri: item.mainImage }}
                      style={{ width: 80, height: 80, borderRadius: 8, marginRight: 12 }}
                    />
                  ) : (
                    <View
                      style={{
                        width: 80,
                        height: 80,
                        borderRadius: 8,
                        backgroundColor: "#cbd5e0",
                        alignItems: "center",
                        justifyContent: "center",
                        marginRight: 12,
                      }}
                    >
                      <Text style={{ color: "#a0aec0" }}>No Image</Text>
                    </View>
                  )}

                  {/* Aircraft Info */}
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 16, fontWeight: "bold" }}>
                      {item.year} {item.make} {item.model}
                    </Text>
                    <Text>Engine: {item.engine}</Text>
                    <Text>Total Time: {item.totalTime} hours</Text>
                    <Text>Location: {item.location} ({item.airportIdentifier})</Text>
                    <Text>Cost Per Hour: ${item.costPerHour}</Text>
                  </View>
                </TouchableOpacity>
              </View>
            ))
          ) : (
            <Text>No aircraft added yet.</Text>
          )}

          {/* List Selected Aircraft Button */}
          <TouchableOpacity
            onPress={handleListForRentToggle}
            style={{
              backgroundColor: "#48bb78",
              paddingVertical: 12,
              borderRadius: 8,
              marginTop: 16,
              marginBottom: 16,
            }}
          >
            <Text style={{ color: "white", textAlign: "center", fontWeight: "bold" }}>
              List Selected Aircraft
            </Text>
          </TouchableOpacity>
        </View>
        {/* ************* End of Updated Section: Your Aircraft ************* */}

        {/* Current Listings */}
        <View style={{ padding: 16 }}>
          <Text style={{ fontSize: 24, fontWeight: "bold", marginBottom: 16 }}>
            Current Listings
          </Text>
          {userListings.length > 0 ? (
            userListings.map((listing) => (
              <View
                key={listing.id}
                style={{
                  backgroundColor: "#edf2f7",
                  padding: 16,
                  borderRadius: 16,
                  marginBottom: 16,
                }}
              >
                <Text style={{ fontSize: 18, fontWeight: "bold" }}>
                  {listing.airplaneModel}
                </Text>
                <Text>{listing.description}</Text>
                <Text>Rate per Hour: ${listing.ratesPerHour}</Text>
                {listing.images.length > 0 && (
                  <FlatList
                    data={listing.images}
                    horizontal
                    keyExtractor={(item) => item} // Use image URI as key
                    renderItem={({ item }) => (
                      <Image
                        source={{ uri: item }}
                        style={{ width: 100, height: 100, margin: 8 }}
                      />
                    )}
                  />
                )}
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
                              await deleteDoc(doc(db, "airplanes", listing.id));
                              setUserListings(userListings.filter(l => l.id !== listing.id));
                              setAllAircrafts(allAircrafts.filter(a => a.id !== listing.id));
                              Alert.alert("Removed", "The listing has been removed.");
                            } catch (error) {
                              console.error("Error removing listing:", error);
                              Alert.alert("Error", "Failed to remove the listing.");
                            }
                          } 
                        },
                      ]
                    );
                  }}
                  style={{
                    backgroundColor: "#e53e3e",
                    paddingVertical: 12,
                    borderRadius: 8,
                    marginTop: 16,
                  }}
                >
                  <Text
                    style={{ color: "white", textAlign: "center", fontWeight: "bold" }}
                  >
                    Remove Listing
                  </Text>
                </TouchableOpacity>
              </View>
            ))
          ) : (
            <Text>No current listings.</Text>
          )}
        </View>

        {/* Create New Listing Button */}
        <View style={{ padding: 16 }}>
          <TouchableOpacity
            onPress={() => setFullScreenModalVisible(true)}
            style={{
              backgroundColor: "#3182ce",
              paddingVertical: 12,
              borderRadius: 8,
            }}
          >
            <Text
              style={{ color: "white", textAlign: "center", fontWeight: "bold" }}
            >
              Create New Listing
            </Text>
          </TouchableOpacity>
        </View>

        {/* ************* New Section: Incoming Rental Requests ************* */}
        <View style={{ padding: 16 }}>
          <Text style={{ fontSize: 24, fontWeight: "bold", marginBottom: 16 }}>
            Incoming Rental Requests
          </Text>
          {rentalRequests.length > 0 ? (
            rentalRequests.map((item) => (
              <TouchableOpacity
                key={item.id}
                onPress={async () => {
                  setSelectedRequest(item);
                  const listing = await fetchListingDetails(item.listingId);
                  setSelectedListingDetails(listing);
                  setRentalRequestModalVisible(true);
                }}
                style={{
                  backgroundColor: "#edf2f7",
                  padding: 16,
                  borderRadius: 16,
                  marginBottom: 16,
                }}
              >
                <Text style={{ fontSize: 18, fontWeight: "bold" }}>
                  Renter: {item.renterName}
                </Text>
                {/* Display Year, Make, Model */}
                <Text>
                  Listing: {item.listingDetails ? `${item.listingDetails.year} ${item.listingDetails.make} ${item.listingDetails.model}` : "Listing details not available"}
                </Text>
                <Text>Total Cost: ${item.totalCost}</Text>
                <Text>Requested Date: {item.rentalPeriod || "N/A"}</Text>
                <Text>Status: {item.status}</Text>
              </TouchableOpacity>
            ))
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
            activeRentals.map((item) => (
              <TouchableOpacity
                key={item.id}
                onPress={() => {
                  setSelectedRequest(item);
                  setSelectedListingDetails(item.listingDetails);
                  setRentalRequestModalVisible(true); // Reuse the same modal for Active Rentals
                }}
                style={{
                  backgroundColor: "#edf2f7",
                  padding: 16,
                  borderRadius: 16,
                  marginBottom: 16,
                }}
              >
                <Text style={{ fontSize: 18, fontWeight: "bold" }}>
                  {item.listingDetails ? `${item.listingDetails.year} ${item.listingDetails.make} ${item.listingDetails.model}` : "Listing details not available"}
                </Text>
                <Text>Renter: {item.renterName}</Text>
                <Text>Total Cost: ${item.totalCost}</Text>
                <Text>Rental Date: {item.rentalDate || "N/A"}</Text>
                <Text>Status: {item.status}</Text>
              </TouchableOpacity>
            ))
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
            rentalHistory.map((order, index) => (
              <View
                key={order.id || index} // Preferably use order.id if available
                style={{
                  backgroundColor: "#edf2f7",
                  padding: 16,
                  borderRadius: 16,
                  marginBottom: 16,
                }}
              >
                <Text style={{ fontSize: 18, fontWeight: "bold", color: "#2d3748" }}>
                  {order.airplaneModel}
                </Text>
                <Text style={{ color: "#4a5568" }}>{order.rentalPeriod}</Text>
                <Text style={{ color: "#4a5568" }}>{order.renterName}</Text>
                <View
                  style={{
                    flexDirection: "row",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginTop: 16,
                  }}
                >
                  <Text style={{ color: "#2d3748" }}>Rate this renter:</Text>
                  <View style={{ flexDirection: "row" }}>
                    {[1, 2, 3, 4, 5].map((star) => (
                      <TouchableOpacity
                        key={star}
                        onPress={() => handleRating(order.id, star)}
                      >
                        <FontAwesome
                          name={star <= (ratings[order.id] || 0) ? "star" : "star-o"}
                          size={24}
                          color="gold"
                        />
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
                <TouchableOpacity
                  onPress={() => {
                    setSelectedRequest(order);
                    openMessageModal(order.chatThreadId);
                  }}
                  style={{
                    marginTop: 16,
                    backgroundColor: "#3182ce",
                    padding: 12,
                    borderRadius: 8,
                  }}
                >
                  <Text
                    style={{
                      color: "white",
                      textAlign: "center",
                      fontWeight: "bold",
                    }}
                  >
                    Message Renter
                  </Text>
                </TouchableOpacity>
              </View>
            ))
          ) : (
            <Text style={{ color: "#4a5568", textAlign: "center" }}>
              No rental history.
            </Text>
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
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            {selectedRequest && selectedListingDetails ? (
              <>
                <Text style={styles.modalTitle}>Rental Request Details</Text>
                <Text style={styles.modalText}>
                  <Text style={styles.modalLabel}>Renter Name: </Text>
                  {selectedRequest.renterName}
                </Text>
                {/* Display Year, Make, Model in Modal */}
                <Text style={styles.modalText}>
                  <Text style={styles.modalLabel}>Listing: </Text>
                  {selectedListingDetails ? `${selectedListingDetails.year} ${selectedListingDetails.make} ${selectedListingDetails.model}` : "Listing details not available"}
                </Text>
                <Text style={styles.modalText}>
                  <Text style={styles.modalLabel}>Rate per Hour: </Text>${selectedListingDetails.ratesPerHour}
                </Text>
                <Text style={styles.modalText}>
                  <Text style={styles.modalLabel}>Minimum Hours: </Text>{selectedListingDetails.minimumHours}
                </Text>
                <Text style={styles.modalText}>
                  <Text style={styles.modalLabel}>Total Amount: </Text>${(
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

                {selectedRequest.status === "pending" && (
                  <>
                    <View style={styles.modalButtonsContainer}>
                      <TouchableOpacity
                        onPress={() => {
                          setRentalRequestModalVisible(false);
                          setSelectedRequest(selectedRequest);
                          setCalendarVisible(true); // Open calendar to select rental date
                        }}
                        style={styles.approveButton}
                      >
                        <Text style={styles.buttonText}>Approve</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => handleDenyRentalRequest(selectedRequest)}
                        style={styles.denyButton}
                      >
                        <Text style={styles.buttonText}>Deny</Text>
                      </TouchableOpacity>
                    </View>
                  </>
                )}

                {/* If the rental is approved (Active Rental), show relevant actions */}
                {selectedRequest.status === "approved" && (
                  <>
                    <View style={styles.modalButtonsContainer}>
                      <TouchableOpacity
                        onPress={() => {
                          // Implement any actions for active rentals if needed
                          Alert.alert("Info", "Active rentals details can be managed here.");
                        }}
                        style={styles.approveButton}
                      >
                        <Text style={styles.buttonText}>Manage Rental</Text>
                      </TouchableOpacity>
                    </View>
                  </>
                )}

                <TouchableOpacity
                  onPress={() => setRentalRequestModalVisible(false)}
                  style={styles.closeModalButton}
                >
                  <Ionicons name="close" size={24} color="#2d3748" />
                </TouchableOpacity>
              </>
            ) : (
              <ActivityIndicator size="large" color="#3182ce" />
            )}
          </View>
        </View>
      </Modal>

      {/* Rental Request Approval Calendar Modal */}
      <Modal
        visible={calendarVisible}
        animationType="slide"
        onRequestClose={() => {
          setCalendarVisible(false);
          setSelectedRequest(null);
        }}
      >
        <View style={{ flex: 1, padding: 16 }}>
          <Calendar onDayPress={onDayPress} markedDates={selectedDates} />
          <TouchableOpacity
            onPress={() => {
              setCalendarVisible(false);
              setSelectedRequest(null);
            }}
            style={styles.cancelButton}
          >
            <Text
              style={{ color: "white", textAlign: "center", fontWeight: "bold" }}
            >
              Cancel
            </Text>
          </TouchableOpacity>
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
              messages.map((item, index) => (
                <View
                  key={index.toString()} // Use index if no unique identifier
                  style={{
                    padding: 8,
                    backgroundColor: item.senderId === user.uid ? "#e2e8f0" : "#bee3f8",
                    alignSelf: item.senderId === user.uid ? "flex-end" : "flex-start",
                    borderRadius: 8,
                    marginVertical: 4,
                  }}
                >
                  <Text style={{ fontWeight: "bold" }}>{item.senderName}:</Text>
                  <Text>{item.text}</Text>
                  <Text style={{ fontSize: 10, color: "#4a5568", marginTop: 4 }}>
                    {item.createdAt.toDate().toLocaleString()}
                  </Text>
                </View>
              ))
            ) : (
              <Text>No messages yet.</Text>
            )}

            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                borderTopWidth: 1,
                borderTopColor: "#e2e8f0",
                paddingTop: 8,
              }}
            >
              <TextInput
                placeholder="Type your message..."
                value={messageInput}
                onChangeText={(text) => setMessageInput(text)}
                style={{
                  flex: 1,
                  borderColor: "#e2e8f0",
                  borderWidth: 1,
                  borderRadius: 24,
                  padding: 8,
                  marginRight: 8,
                }}
              />
              <TouchableOpacity
                onPress={sendMessage}
                style={{
                  backgroundColor: "#3182ce",
                  padding: 12,
                  borderRadius: 24,
                }}
              >
                <Ionicons name="send" size={24} color="white" />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Create New Listing Modal */}
      <Modal
        visible={fullScreenModalVisible}
        animationType="slide"
        onRequestClose={() => setFullScreenModalVisible(false)}
      >
        <ScrollView contentContainerStyle={{ padding: 16 }}>
          <Text style={{ fontSize: 24, fontWeight: "bold", marginBottom: 16 }}>
            Create New Listing
          </Text>
          {Object.keys(profileData).map((key) => (
            <TextInput
              key={key}
              placeholder={key.replace(/([A-Z])/g, " $1")}
              value={profileData[key]}
              onChangeText={(value) => handleInputChange(key, value)}
              style={styles.input}
            />
          ))}

          <TouchableOpacity
            onPress={pickImage}
            style={{
              backgroundColor: "#3182ce",
              paddingVertical: 12,
              borderRadius: 8,
              marginTop: 16,
            }}
          >
            <Text
              style={{ color: "white", textAlign: "center", fontWeight: "bold" }}
            >
              Upload Image
            </Text>
          </TouchableOpacity>

          {images.length > 0 && (
            <FlatList
              data={images}
              horizontal
              keyExtractor={(item) => item} // Use image URI as key
              renderItem={({ item }) => (
                <View style={{ position: "relative", marginRight: 8 }}>
                  <Image
                    source={{ uri: item }}
                    style={{ width: 100, height: 100, borderRadius: 8 }}
                  />
                  <TouchableOpacity
                    onPress={() => removeImage(item)}
                    style={styles.removeImageButton}
                  >
                    <Ionicons name="close-circle" size={24} color="red" />
                  </TouchableOpacity>
                </View>
              )}
            />
          )}

          <TouchableOpacity
            onPress={() => onSubmitMethod({}, false)}
            style={{
              backgroundColor: "#3182ce",
              paddingVertical: 12,
              borderRadius: 8,
              marginTop: 16,
            }}
          >
            <Text
              style={{ color: "white", textAlign: "center", fontWeight: "bold" }}
            >
              Submit Listing
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setFullScreenModalVisible(false)}
            style={styles.cancelButton}
          >
            <Text
              style={{ color: "white", textAlign: "center", fontWeight: "bold" }}
            >
              Cancel
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </Modal>

      {/* Aircraft Details Modal */}
      <Modal
        visible={aircraftModalVisible}
        animationType="slide"
        onRequestClose={() => setAircraftModalVisible(false)}
      >
        <ScrollView contentContainerStyle={{ padding: 16 }}>
          <Text style={{ fontSize: 24, fontWeight: "bold", marginBottom: 16 }}>
            {isEditing ? "Edit Aircraft Details" : "Aircraft Details"}
          </Text>

          <View style={{ marginBottom: 16 }}>
            <Text style={{ fontSize: 20, fontWeight: 'bold', marginBottom: 8 }}>General Information</Text>
            <TextInput
              placeholder="Year"
              value={aircraftDetails.year}
              onChangeText={(value) => handleInputChange('year', value)}
              keyboardType="numeric"
              style={styles.input}
              editable={isEditing}
            />
            <TextInput
              placeholder="Make"
              value={aircraftDetails.make}
              onChangeText={(value) => handleInputChange('make', value)}
              style={styles.input}
              editable={isEditing}
            />
            <TextInput
              placeholder="Model"
              value={aircraftDetails.model}
              onChangeText={(value) => handleInputChange('model', value)}
              style={styles.input}
              editable={isEditing}
            />
            <TextInput
              placeholder="Engine"
              value={aircraftDetails.engine}
              onChangeText={(value) => handleInputChange('engine', value)}
              style={styles.input}
              editable={isEditing}
            />
            <TextInput
              placeholder="Total Time"
              value={aircraftDetails.totalTime}
              onChangeText={(value) => handleInputChange('totalTime', value)}
              keyboardType="numeric"
              style={styles.input}
              editable={isEditing}
            />
          </View>

          <View style={{ marginBottom: 16 }}>
            <Text style={{ fontSize: 20, fontWeight: 'bold', marginBottom: 8 }}>Location Information</Text>
            <TextInput
              placeholder="Location"
              value={aircraftDetails.location}
              onChangeText={(value) => handleInputChange('location', value)}
              style={styles.input}
              editable={isEditing}
            />
            <TextInput
              placeholder="Airport Identifier"
              value={aircraftDetails.airportIdentifier}
              onChangeText={(value) => handleInputChange('airportIdentifier', value)}
              style={styles.input}
              editable={isEditing}
            />
          </View>

          <View style={{ marginBottom: 16 }}>
            <Text style={{ fontSize: 20, fontWeight: 'bold', marginBottom: 8 }}>Cost Information</Text>
            <TextInput
              placeholder="Cost Per Hour ($)"
              value={aircraftDetails.costPerHour}
              onChangeText={(value) => handleInputChange('costPerHour', value)}
              keyboardType="numeric"
              style={styles.input}
              editable={isEditing}
            />
          </View>

          <View style={{ marginBottom: 16 }}>
            <Text style={{ fontSize: 20, fontWeight: 'bold', marginBottom: 8 }}>Description</Text>
            <TextInput
              placeholder="Description"
              value={aircraftDetails.description}
              onChangeText={(value) => handleInputChange('description', value)}
              style={[styles.input, { height: 100 }]}
              multiline={true}
              editable={isEditing}
            />
          </View>

          {/* Images Section */}
          <View style={{ marginBottom: 16 }}>
            <Text style={{ fontSize: 20, fontWeight: 'bold', marginBottom: 8 }}>Images</Text>
            <FlatList
              data={images}
              horizontal
              keyExtractor={(item, index) => `${item}_${index}`}
              renderItem={({ item }) => (
                <View style={{ position: "relative", alignItems: "center", marginRight: 8 }}>
                  <Image
                    source={{ uri: item }}
                    style={{ width: 100, height: 100, borderRadius: 8 }}
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
                          paddingVertical: 2,
                          paddingHorizontal: 4,
                          borderRadius: 4,
                        }}
                      >
                        <Text style={{ color: "white", fontSize: 10 }}>Set Main</Text>
                      </TouchableOpacity>
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
          </View>

          {isEditing && (
            <>
              <TouchableOpacity
                onPress={pickImage}
                style={{
                  backgroundColor: "#3182ce",
                  paddingVertical: 12,
                  borderRadius: 8,
                  marginTop: 16,
                }}
              >
                <Text
                  style={{ color: "white", textAlign: "center", fontWeight: "bold" }}
                >
                  Upload Images
                </Text>
              </TouchableOpacity>
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
              <Text style={{ fontSize: 16, fontWeight: "bold" }}>Main Image:</Text>
              <Image
                source={{ uri: selectedAircraft.mainImage }}
                style={{ width: 200, height: 200, borderRadius: 8, marginTop: 8 }}
              />
            </View>
          )}

          {/* Buttons */}
          <View style={{ marginTop: 24 }}>
            {isEditing ? (
              <>
                <TouchableOpacity
                  onPress={onSaveAircraftDetails}
                  style={styles.saveButton}
                >
                  <Text style={{ color: "white", textAlign: "center", fontWeight: "bold" }}>
                    Save Aircraft Details
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={onCancelAircraftEdit}
                  style={styles.cancelButton}
                >
                  <Text style={{ color: "white", textAlign: "center", fontWeight: "bold" }}>
                    Cancel
                  </Text>
                </TouchableOpacity>
              </>
            ) : (
              <TouchableOpacity
                onPress={onEditAircraftDetails}
                style={{
                  backgroundColor: "#48bb78",
                  paddingVertical: 12,
                  borderRadius: 8,
                  marginBottom: 16,
                }}
              >
                <Text style={{ color: "white", textAlign: "center", fontWeight: "bold" }}>
                  Edit Aircraft
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </ScrollView>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  input: {
    borderBottomWidth: 1,
    borderBottomColor: "#ccc",
    marginBottom: 12,
    paddingVertical: 8,
  },
  uploadButton: {
    backgroundColor: "#3182ce",
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 16,
  },
  saveButton: {
    backgroundColor: "#3182ce",
    paddingVertical: 12,
    borderRadius: 8,
    marginBottom: 16,
    marginTop: 16,
  },
  listForRentButton: {
    backgroundColor: "#48bb78",
    paddingVertical: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  cancelButton: {
    backgroundColor: "#e53e3e",
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 16,
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
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalContainer: {
    width: "90%",
    backgroundColor: "white",
    borderRadius: 24,
    padding: 24,
    position: "relative",
    maxHeight: "80%",
  },
  messageModalContainer: {
    flex: 1,
    marginTop: 10,
    marginHorizontal: 16,
    backgroundColor: "white",
    borderRadius: 24,
    padding: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 16,
    textAlign: "center",
  },
  modalText: {
    fontSize: 16,
    marginBottom: 8,
  },
  modalLabel: {
    fontWeight: "bold",
  },
  modalButtonsContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 24,
  },
  approveButton: {
    backgroundColor: "#48bb78",
    paddingVertical: 12,
    borderRadius: 8,
    flex: 1,
    marginRight: 8,
  },
  denyButton: {
    backgroundColor: "#e53e3e",
    paddingVertical: 12,
    borderRadius: 8,
    flex: 1,
    marginLeft: 8,
  },
  buttonText: {
    color: "white",
    textAlign: "center",
    fontWeight: "bold",
  },
  closeModalButton: {
    position: "absolute",
    top: 16,
    right: 16,
    zIndex: 1,
  },
  selectionCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: "#3182ce",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 8,
  },
  selectedCircle: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: "#3182ce",
  },
  removeImageButton: {
    position: "absolute",
    top: -10,
    right: -10,
  },
});

export default OwnerProfile;
