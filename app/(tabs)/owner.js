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
  FlatList,
  ImageBackground,
  Modal,
  StatusBar,
  RefreshControl,
  Platform,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useUser } from "@clerk/clerk-expo";
import { db, storage } from "../../firebaseConfig";
import * as ImagePicker from "expo-image-picker";
import * as DocumentPicker from "expo-document-picker";
import {
  collection,
  addDoc,
  onSnapshot,
  updateDoc,
  deleteDoc,
  doc,
  query,
  where,
  getDoc,
  setDoc,
} from "firebase/firestore";
import { FontAwesome, Ionicons } from "@expo/vector-icons";
import wingtipClouds from "../../Assets/images/wingtip_clouds.jpg";
import { useStripe } from "@stripe/stripe-react-native";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { Picker } from "@react-native-picker/picker";
import { Calendar } from "react-native-calendars";

const OwnerProfile = ({ ownerId }) => {
  const { user } = useUser();
  const stripe = useStripe();
  const navigation = useNavigation();
  const resolvedOwnerId = ownerId || user?.id;

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
    year: "2020",
    make: "",
    model: "",
    engine: "",
    description: "",
    totalTime: "",
    costPerHour: "",
    location: "",
    airportIdentifier: "",
  });

  const [initialAircraftDetails, setInitialAircraftDetails] = useState(null);
  const [additionalAircrafts, setAdditionalAircrafts] = useState([]);
  const [costData, setCostData] = useState({
    purchasePrice: "",
    loanAmount: "",
    interestRate: "",
    loanTerm: "",
    estimatedAnnualCost: "",
    insuranceCost: "",
    hangerCost: "",
    fuelCostPerHour: "",
    maintenanceReserve: "",
    mortgageExpense: "",
    flightHoursPerYear: "",
    costPerHour: "",
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
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [messageInput, setMessageInput] = useState("");
  const [messageModalVisible, setMessageModalVisible] = useState(false);
  const [messages, setMessages] = useState([]);
  const [chatThreads, setChatThreads] = useState([]);
  const [selectedChatThreadId, setSelectedChatThreadId] = useState(null);

  // State for rental date
  const [rentalDate, setRentalDate] = useState(null);

  useEffect(() => {
    if (resolvedOwnerId) {
      const rentalHistoryQuery = query(
        collection(db, "rentalHistory"),
        where("ownerId", "==", resolvedOwnerId)
      );
      const unsubscribeRentalHistory = onSnapshot(
        rentalHistoryQuery,
        (snapshot) => {
          setRentalHistory(
            snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }))
          );
        }
      );

      const messagesQuery = query(
        collection(db, "messages"),
        where("participants", "array-contains", resolvedOwnerId)
      );
      const unsubscribeMessages = onSnapshot(messagesQuery, (snapshot) => {
        setChatThreads(
          snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }))
        );
      });

      // Corrected code to fetch rental requests from the owner's subcollection
      const rentalRequestsQuery = collection(
        db,
        "owners",
        resolvedOwnerId,
        "rentalRequests"
      );
      const unsubscribeRentalRequests = onSnapshot(
        rentalRequestsQuery,
        (snapshot) => {
          setRentalRequests(
            snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }))
          );
        }
      );

      const userListingsQuery = query(
        collection(db, "airplanes"),
        where("ownerId", "==", resolvedOwnerId)
      );
      const unsubscribeUserListings = onSnapshot(userListingsQuery, (snapshot) => {
        setUserListings(
          snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }))
        );
      });

      return () => {
        unsubscribeRentalHistory();
        unsubscribeMessages();
        unsubscribeRentalRequests();
        unsubscribeUserListings();
      };
    }
  }, [resolvedOwnerId]);

  useEffect(() => {
    const fetchData = async () => {
      if (resolvedOwnerId) {
        const docRef = doc(db, "aircraftDetails", resolvedOwnerId);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = docSnap.data();
          setAircraftDetails(data.aircraftDetails);
          setInitialAircraftDetails(data.aircraftDetails);
          setCostData(data.costData);
          setCostSaved(true);
          setAircraftSaved(true);
        }
      }
    };
    fetchData();
  }, [resolvedOwnerId]);

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
      estimatedAnnualCost,
      insuranceCost,
      hangerCost,
      fuelCostPerHour,
      maintenanceReserve,
      flightHoursPerYear,
    } = costData;

    const monthlyInterestRate = parseFloat(interestRate) / 100 / 12;
    const numberOfPayments = parseFloat(loanTerm) * 12;
    const mortgageExpense = loanAmount
      ? (
          (parseFloat(loanAmount) * monthlyInterestRate) / 
          (1 - Math.pow(1 + monthlyInterestRate, -numberOfPayments))
        ).toFixed(2)
      : 0;

    const totalCost =
      parseFloat(estimatedAnnualCost || 0) +
      parseFloat(insuranceCost || 0) +
      parseFloat(hangerCost || 0) +
      parseFloat(fuelCostPerHour || 0) * parseFloat(flightHoursPerYear || 1) +
      parseFloat(maintenanceReserve || 0) +
      parseFloat(mortgageExpense || 0);

    const costPerHour = (
      totalCost / parseFloat(flightHoursPerYear || 1)
    ).toFixed(2);

    setCostData((prev) => ({
      ...prev,
      costPerHour,
      mortgageExpense: mortgageExpense,
    }));
    setCostSaved(true);
    setLoading(false);

    await setDoc(doc(db, "aircraftDetails", resolvedOwnerId), {
      costData,
      aircraftDetails,
    });

    Alert.alert("Success", `Estimated cost per hour: $${costPerHour}`);
  };

  const handleInputChange = (name, value) => {
    setCostData((prev) => ({ ...prev, [name]: value }));
    if (name === "ratesPerHour") {
      setProfileData((prev) => ({ ...prev, ratesPerHour: value }));
    } else if (name in aircraftDetails) {
      setAircraftDetails((prev) => ({ ...prev, [name]: value }));
    }
  };

  const pickImage = async () => {
    if (images.length >= 7) {
      Alert.alert("You can only upload up to 7 images.");
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

  const pickDocument = async () => {
    const result = await DocumentPicker.getDocumentAsync({
      type: "application/pdf",
    });

    if (result.type === "success") {
      setCurrentAnnualPdf(result.uri);
    }
  };

  const pickInsuranceDocument = async () => {
    const result = await DocumentPicker.getDocumentAsync({
      type: "application/pdf",
    });

    if (result.type === "success") {
      setInsurancePdf(result.uri);
    }
  };

  // Update onDayPress to handle date selection for rental requests
  const onDayPress = (day) => {
    const selected = !selectedDates[day.dateString];
    setRentalDate(day.dateString); // Set rental date to the selected date
    setSelectedDates({
      ...selectedDates,
      [day.dateString]: selected
        ? { selected: true, marked: true, dotColor: "red" }
        : undefined,
    });
    setCalendarVisible(false); // Close calendar after date selection
  };

  const uploadFile = async (uri, folder) => {
    try {
      const response = await fetch(uri);
      const blob = await response.blob();
      const filename = uri.substring(uri.lastIndexOf("/") + 1);
      const storageRef = ref(storage, `${folder}/${user.id}/${filename}`);
      await uploadBytes(storageRef, blob);
      return await getDownloadURL(storageRef);
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
    Alert.alert("Aircraft Details Saved", "Your aircraft details have been saved.");

    await setDoc(doc(db, "aircraftDetails", resolvedOwnerId), {
      costData,
      aircraftDetails,
    });
  };

  const onEditAircraftDetails = () => {
    setAircraftSaved(false);
  };

  const onCancelAircraftEdit = () => {
    if (initialAircraftDetails) {
      setAircraftDetails(initialAircraftDetails);
      setAircraftSaved(true);
      Alert.alert("Changes Canceled", "Aircraft details reverted to the original state.");
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

      const newListing = sanitizeData({
        airplaneModel: aircraftDetails.model || "",
        description: profileData.description || "",
        location: aircraftDetails.location || "",
        airportIdentifier: aircraftDetails.airportIdentifier || "",
        ratesPerHour: aircraftDetails.costPerHour || "0",
        minimumHours: profileData.minimumHours || "1",
        images: uploadedImages.length > 0 ? uploadedImages : [],
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
        setAdditionalAircrafts([...additionalAircrafts, newListing]);
      } else {
        setUserListings([...userListings, newListing]);
      }

      Alert.alert("Success", "Your listing has been submitted.");
      setFormVisible(false);
      setIsListedForRent(true);
    } catch (error) {
      console.error("Error submitting listing: ", error);
      if (error.message.includes("Network request failed")) {
        Alert.alert(
          "Network Error",
          "There was an error submitting your listing due to network issues. Please check your internet connection and try again."
        );
      } else {
        Alert.alert(
          "Error",
          `There was an error submitting your listing: ${error.message}`
        );
      }
    } finally {
      setLoading(false);
    }
  };

  const handleListForRentToggle = async (listing, additional = false) => {
    if (!listing?.id) {
      Alert.alert("Error", "Listing ID is missing.");
      return;
    }

    if (isListedForRent) {
      try {
        const listingDocRef = doc(db, "airplanes", listing.id);
        await deleteDoc(listingDocRef);

        if (additional) {
          setAdditionalAircrafts(
            additionalAircrafts.filter((aircraft) => aircraft.id !== listing.id)
          );
        } else {
          setUserListings(
            userListings.filter((aircraft) => aircraft.id !== listing.id)
          );
        }

        navigation.navigate("Home", {
          updatedListings: userListings.filter(
            (aircraft) => aircraft.id !== listing.id
          ),
          unlistedId: listing.id,
        });

        setIsListedForRent(false);
        Alert.alert("Success", "Your aircraft has been removed from the listings.");
      } catch (error) {
        console.error("Error removing listing: ", error);
        Alert.alert(
          "Error",
          "There was an error removing your listing. Please check your network or try again."
        );
      }
    } else {
      onSubmitMethod(listing, additional);
    }
  };

  const handleApproveRentalRequest = async (request) => {
    try {
      if (!request.renterId || !request.listingId || !rentalDate) {
        console.error("Invalid request data: ", request);
        Alert.alert("Error", "Request data is invalid or rental date is missing.");
        return;
      }

      const notificationRef = doc(
        db,
        "owners",
        resolvedOwnerId,
        "rentalRequests",
        request.id
      );
      await updateDoc(notificationRef, {
        status: "approved",
        rentalDate: rentalDate, // Include rental date
      });

      await addDoc(collection(db, "renters", request.renterId, "notifications"), {
        type: "rentalApproved",
        message: "Your rental request has been approved. Please complete the payment.",
        listingId: request.listingId,
        ownerId: resolvedOwnerId,
        rentalDate: rentalDate, // Include rental date
        createdAt: new Date(),
      });

      const chatThread = {
        participants: [resolvedOwnerId, request.renterId],
        messages: [],
      };
      const chatDocRef = await addDoc(collection(db, "messages"), chatThread);
      chatThread.id = chatDocRef.id;
      setChatThreads([...chatThreads, chatThread]);

      Alert.alert(
        "Request Approved",
        `The rental request for ${rentalDate} has been approved.`
      );
      setMessageModalVisible(false);
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
      setMessageModalVisible(false);
    } catch (error) {
      console.error("Error denying rental request: ", error);
      Alert.alert("Error", "There was an error denying the rental request.");
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
      senderId: user.id,
      senderName: user.fullName || "Owner",
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
      console.error("Error sending message: ", error);
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
      console.error("Error opening message modal: ", error);
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
                {user?.fullName || "User"}
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
            // Show summary card
            <View
              style={{ backgroundColor: "#edf2f7", padding: 16, borderRadius: 16 }}
            >
              <Text style={{ fontSize: 18, fontWeight: "bold", marginBottom: 8 }}>
                Estimated Cost per Hour: ${costData.costPerHour}
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
                <Text
                  style={{ color: "white", textAlign: "center", fontWeight: "bold" }}
                >
                  Edit Cost Data
                </Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              {/* Form Fields for Cost Data */}
              {Object.keys(costData).map((key) => (
                <TextInput
                  key={key}
                  placeholder={key.replace(/([A-Z])/g, " $1")}
                  value={costData[key]}
                  onChangeText={(value) => handleInputChange(key, value)}
                  keyboardType="numeric"
                  style={{
                    borderBottomWidth: 1,
                    borderBottomColor: "#ccc",
                    marginBottom: 12,
                    paddingVertical: 8,
                  }}
                />
              ))}
              <TouchableOpacity
                onPress={saveCostData}
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
                  Save Cost Data
                </Text>
              </TouchableOpacity>
            </>
          )}
        </View>

        {/* Aircraft Details */}
        <View style={{ padding: 16 }}>
          <Text style={{ fontSize: 24, fontWeight: "bold", marginBottom: 16 }}>
            Aircraft Details
          </Text>
          {aircraftSaved ? (
            // Show summary card
            <View
              style={{ backgroundColor: "#edf2f7", padding: 16, borderRadius: 16 }}
            >
              {Object.keys(aircraftDetails).map((key) => (
                <Text key={key} style={{ marginBottom: 8 }}>
                  {key.replace(/([A-Z])/g, " $1")}: {aircraftDetails[key]}
                </Text>
              ))}
              <TouchableOpacity
                onPress={onEditAircraftDetails}
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
                  Edit Aircraft Details
                </Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              {/* Form Fields for Aircraft Details */}
              {Object.keys(aircraftDetails).map((key) => (
                <TextInput
                  key={key}
                  placeholder={key.replace(/([A-Z])/g, " $1")}
                  value={aircraftDetails[key]}
                  onChangeText={(value) => handleInputChange(key, value)}
                  style={{
                    borderBottomWidth: 1,
                    borderBottomColor: "#ccc",
                    marginBottom: 12,
                    paddingVertical: 8,
                  }}
                />
              ))}
              <TouchableOpacity
                onPress={onSaveAircraftDetails}
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
                  Save Aircraft Details
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={onCancelAircraftEdit}
                style={{
                  backgroundColor: "#e53e3e",
                  paddingVertical: 12,
                  borderRadius: 8,
                  marginBottom: 16,
                }}
              >
                <Text
                  style={{ color: "white", textAlign: "center", fontWeight: "bold" }}
                >
                  Cancel
                </Text>
              </TouchableOpacity>
            </>
          )}
        </View>

        {/* Current Listings */}
        <View style={{ padding: 16 }}>
          <Text
            style={{ fontSize: 24, fontWeight: "bold", marginBottom: 16 }}
          >
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
                <TouchableOpacity
                  onPress={() => handleListForRentToggle(listing)}
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

        {/* Create New Listing */}
        <View style={{ padding: 16 }}>
          <TouchableOpacity
            onPress={() => setFormVisible(true)}
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

        {/* Rental History Section */}
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
                key={index}
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

      {/* Messaging Modal */}
      <Modal
        visible={messageModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setMessageModalVisible(false)}
      >
        <View
          style={{
            flex: 1,
            backgroundColor: "rgba(0, 0, 0, 0.5)",
          }}
        >
          <View
            style={{
              flex: 1,
              marginTop: 50,
              marginHorizontal: 16,
              backgroundColor: "white",
              borderRadius: 24,
              padding: 24,
              shadowColor: "#000",
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.2,
              shadowRadius: 8,
            }}
          >
            {/* Close Button */}
            <TouchableOpacity
              onPress={() => setMessageModalVisible(false)}
              style={{
                position: "absolute",
                top: 16,
                right: 16,
                zIndex: 1,
              }}
            >
              <Ionicons name="close-circle" size={32} color="#2d3748" />
            </TouchableOpacity>

            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingTop: 40 }}
            >
              <Text
                style={{
                  fontSize: 24,
                  fontWeight: "bold",
                  marginBottom: 24,
                  textAlign: "center",
                  color: "#2d3748",
                }}
              >
                Rental Requests
              </Text>
              {selectedRequest ? (
                <>
                  <Text style={{ fontSize: 18, marginBottom: 8 }}>
                    Renter: {selectedRequest.renterName}
                  </Text>
                  <Text style={{ fontSize: 18, marginBottom: 8 }}>
                    Aircraft: {selectedRequest.airplaneModel}
                  </Text>
                  <Text style={{ fontSize: 18, marginBottom: 8 }}>
                    Total Cost: ${selectedRequest.totalCost}
                  </Text>
                  <Text style={{ fontSize: 18, marginBottom: 8 }}>
                    Rental Date: {selectedRequest.rentalPeriod || "Not Specified"}
                  </Text>
                  <View
                    style={{
                      flexDirection: "row",
                      justifyContent: "space-between",
                      marginTop: 16,
                    }}
                  >
                    <TouchableOpacity
                      onPress={() => handleApproveRentalRequest(selectedRequest)}
                      style={{
                        backgroundColor: "#48bb78",
                        paddingVertical: 12,
                        paddingHorizontal: 24,
                        borderRadius: 50,
                      }}
                    >
                      <Text
                        style={{
                          color: "white",
                          textAlign: "center",
                          fontWeight: "bold",
                        }}
                      >
                        Approve
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => handleDenyRentalRequest(selectedRequest)}
                      style={{
                        backgroundColor: "#e53e3e",
                        paddingVertical: 12,
                        paddingHorizontal: 24,
                        borderRadius: 50,
                      }}
                    >
                      <Text
                        style={{
                          color: "white",
                          textAlign: "center",
                          fontWeight: "bold",
                        }}
                      >
                        Deny
                      </Text>
                    </TouchableOpacity>
                  </View>
                  <TouchableOpacity
                    onPress={() => setSelectedRequest(null)}
                    style={{
                      marginTop: 16,
                      paddingVertical: 12,
                      borderRadius: 50,
                      backgroundColor: "#e2e8f0",
                    }}
                  >
                    <Text
                      style={{
                        color: "#2d3748",
                        textAlign: "center",
                        fontWeight: "bold",
                      }}
                    >
                      Back to List
                    </Text>
                  </TouchableOpacity>
                </>
              ) : rentalRequests.length > 0 ? (
                rentalRequests.map((request) => (
                  <TouchableOpacity
                    key={request.id}
                    onPress={() => setSelectedRequest(request)}
                    style={{
                      marginBottom: 16,
                      backgroundColor: "#edf2f7",
                      padding: 16,
                      borderRadius: 8,
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 18,
                        fontWeight: "bold",
                        color: "#2d3748",
                      }}
                    >
                      Renter: {request.renterName}
                    </Text>
                    <Text style={{ color: "#4a5568" }}>
                      {request.airplaneModel}
                    </Text>
                    <Text style={{ color: "#e53e3e", fontWeight: "bold" }}>
                      ${request.totalCost}
                    </Text>
                    <Text style={{ color: "#4a5568" }}>
                      Date: {request.rentalPeriod || "Not Specified"}
                    </Text>
                  </TouchableOpacity>
                ))
              ) : (
                <Text style={{ color: "#4a5568", textAlign: "center" }}>
                  No rental requests available.
                </Text>
              )}
              <TouchableOpacity
                onPress={() => setMessageModalVisible(false)}
                style={{
                  marginTop: 24,
                  paddingVertical: 12,
                  borderRadius: 50,
                  backgroundColor: "#e2e8f0",
                }}
              >
                <Text
                  style={{
                    color: "#2d3748",
                    textAlign: "center",
                    fontWeight: "bold",
                  }}
                >
                  Close
                </Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Create New Listing Modal */}
      <Modal
        visible={formVisible}
        animationType="slide"
        onRequestClose={() => setFormVisible(false)}
      >
        <ScrollView contentContainerStyle={{ padding: 16 }}>
          <Text
            style={{ fontSize: 24, fontWeight: "bold", marginBottom: 16 }}
          >
            Create New Listing
          </Text>
          {/* Form Fields for New Listing */}
          {/* ... Include form fields similar to aircraftDetails and profileData */}
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
            onPress={() => setFormVisible(false)}
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
              Cancel
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </Modal>

      {/* Calendar Modal */}
      <Modal
        visible={calendarVisible}
        animationType="slide"
        onRequestClose={() => setCalendarVisible(false)}
      >
        <View style={{ flex: 1 }}>
          <Calendar onDayPress={onDayPress} markedDates={selectedDates} />
          <TouchableOpacity
            onPress={() => setCalendarVisible(false)}
            style={{
              backgroundColor: "#3182ce",
              paddingVertical: 12,
              borderRadius: 8,
              margin: 16,
            }}
          >
            <Text
              style={{ color: "white", textAlign: "center", fontWeight: "bold" }}
            >
              Close Calendar
            </Text>
          </TouchableOpacity>
        </View>
      </Modal>

      {/* Blue Chat Bubble Icon */}
      <TouchableOpacity
        style={{
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
        }}
        onPress={() => openMessageModal()}
      >
        <Ionicons name="chatbubble-ellipses" size={32} color="white" />
        {rentalRequests.length > 0 && (
          <View
            style={{
              position: "absolute",
              top: -5,
              right: -5,
              backgroundColor: "red",
              borderRadius: 10,
              width: 20,
              height: 20,
              justifyContent: "center",
              alignItems: "center",
            }}
          >
            <Text style={{ color: "white", fontSize: 12 }}>
              {rentalRequests.length}
            </Text>
          </View>
        )}
      </TouchableOpacity>
    </View>
  );
};

export default OwnerProfile;
