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

// Start of OwnerProfile Component
const OwnerProfile = ({ ownerId }) => {
  const { user } = useUser();
  const stripe = useStripe();
  const navigation = useNavigation();
  const resolvedOwnerId = ownerId || user?.id;

  // State variables for profile and aircraft details
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

  const [initialAircraftDetails, setInitialAircraftDetails] = useState(null); // Added for cancel functionality
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
  const [rentalRequestModalVisible, setRentalRequestModalVisible] = useState(false);
  const [messageInput, setMessageInput] = useState("");
  const [messageModalVisible, setMessageModalVisible] = useState(false);
  const [messages, setMessages] = useState([]);

  useEffect(() => {
    // Load rental history and messages
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
        where("ownerId", "==", resolvedOwnerId)
      );
      const unsubscribeMessages = onSnapshot(messagesQuery, (snapshot) => {
        setMessages(
          snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }))
        );
      });

      return () => {
        unsubscribeRentalHistory();
        unsubscribeMessages();
      };
    }
  }, [resolvedOwnerId]);

  useEffect(() => {
    // Load saved data on component mount
    const fetchData = async () => {
      if (resolvedOwnerId) {
        const docRef = doc(db, "aircraftDetails", resolvedOwnerId);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = docSnap.data();
          setAircraftDetails(data.aircraftDetails);
          setInitialAircraftDetails(data.aircraftDetails); // Store the initial details
          setCostData(data.costData);
          setCostSaved(true);
          setAircraftSaved(true);
        }
      }
    };
    fetchData();
  }, [resolvedOwnerId]);

  // Save cost data to Firebase
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

    // Save the cost data to Firebase
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

  const onDayPress = (day) => {
    const selected = !selectedDates[day.dateString];
    setSelectedDates({
      ...selectedDates,
      [day.dateString]: selected
        ? { selected: true, marked: true, dotColor: "red" }
        : undefined,
    });
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

    // Save the aircraft details to Firebase
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
      setAircraftDetails(initialAircraftDetails); // Revert to the initial state
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

      await addDoc(collection(db, "airplanes"), newListing);

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

  // Update for handling unlisting and ensuring removal from Home screen
  const handleListForRentToggle = async (listing, additional = false) => {
    if (!listing?.id) {
      Alert.alert("Error", "Listing ID is missing.");
      return;
    }
  
    if (isListedForRent) {
      try {
        const listingDocRef = doc(db, "airplanes", listing.id);
        await deleteDoc(listingDocRef);  // Ensure this is the right collection and document ID
  
        if (additional) {
          setAdditionalAircrafts(
            additionalAircrafts.filter((aircraft) => aircraft.id !== listing.id)
          );
        } else {
          setUserListings(
            userListings.filter((aircraft) => aircraft.id !== listing.id)
          );
        }

        // Notify Home screen to remove listing
        navigation.navigate('Home', { updatedListings: userListings.filter((aircraft) => aircraft.id !== listing.id) });
  
        setIsListedForRent(false);
        Alert.alert("Success", "Your aircraft has been removed from the listings.");
      } catch (error) {
        console.error("Error removing listing: ", error);
        Alert.alert("Error", "There was an error removing your listing. Please check your network or try again.");
      }
    } else {
      onSubmitMethod(listing, additional);
    }
  };

  const handleApproveRentalRequest = async (request) => {
    try {
      if (!resolvedOwnerId) {
        Alert.alert("Error", "Owner ID is undefined.");
        return;
      }

      const notificationRef = doc(
        db,
        "owners",
        resolvedOwnerId,
        "rentalRequests",
        request.id
      );
      await updateDoc(notificationRef, { status: "approved" });

      const paymentIntent = await stripe.paymentRequestWithPaymentIntent({
        amount: parseInt(request.totalCost * 100),
        currency: "usd",
        paymentMethodTypes: ["card"],
        confirm: true,
      });

      if (paymentIntent?.status === "succeeded") {
        await addDoc(collection(db, "messages"), {
          ownerId: resolvedOwnerId,
          renterId: request.renterId,
          senderName: user.fullName || "Owner",
          text: "Your rental request has been approved. Please proceed with the payment.",
          createdAt: new Date(),
        });

        setMessages((prev) => [
          ...prev,
          {
            ownerId: resolvedOwnerId,
            senderName: user.fullName || "Owner",
            text: "Your rental request has been approved. Please proceed with the payment.",
            createdAt: new Date(),
          },
        ]);

        Alert.alert(
          "Payment Successful",
          "The rental request has been approved and payment processed. Chat is now open."
        );

        setMessageModalVisible(true);
      } else {
        Alert.alert(
          "Payment Failed",
          "The payment could not be completed. Please try again."
        );
      }

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

      const notificationRef = doc(
        db,
        "owners",
        resolvedOwnerId,
        "rentalRequests",
        request.id
      );
      await updateDoc(notificationRef, { status: "denied" });

      Alert.alert("Request Denied", "The rental request has been denied.");
      setRentalRequestModalVisible(false);
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
      ownerId: resolvedOwnerId,
      senderId: user.id,
      senderName: user.fullName || "Anonymous",
      text: messageInput,
      createdAt: new Date(),
    };

    try {
      await addDoc(collection(db, "messages"), messageData);
      setMessageInput("");
      setMessages([...messages, messageData]);
    } catch (error) {
      console.error("Error sending message: ", error);
      Alert.alert("Error", "Failed to send message.");
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
              <Text
                style={{ fontSize: 18, fontWeight: "bold", color: "white" }}
              >
                {user?.fullName || "User"}
              </Text>
            </View>
          </View>
        </ImageBackground>

        {/* Cost of Ownership Calculator Card */}
        <View style={{ paddingHorizontal: 16, marginTop: 16 }}>
          <Text
            style={{
              fontSize: 18,
              fontWeight: "bold",
              marginBottom: 8,
              color: "#2d3748",
            }}
          >
            Cost of Ownership Calculator
          </Text>
          <View
            style={{
              backgroundColor: "#edf2f7",
              borderRadius: 12,
              padding: 16,
            }}
          >
            {costSaved ? (
              <View>
                <Text
                  style={{ fontSize: 16, fontWeight: "bold", color: "#2d3748" }}
                >
                  Total Cost Per Hour of Ownership: ${costData.costPerHour}
                </Text>
                <TouchableOpacity
                  onPress={onEditCostData}
                  style={{
                    backgroundColor: "#3182ce",
                    paddingVertical: 12,
                    paddingHorizontal: 24,
                    borderRadius: 50,
                    marginTop: 16,
                  }}
                >
                  <Text
                    style={{
                      color: "white",
                      textAlign: "center",
                      fontWeight: "bold",
                    }}
                  >
                    Edit Cost Data
                  </Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View>
                <TextInput
                  placeholder="Purchase Price"
                  onChangeText={(value) =>
                    handleInputChange("purchasePrice", value)
                  }
                  value={costData.purchasePrice}
                  keyboardType="numeric"
                  style={{
                    borderBottomWidth: 1,
                    borderBottomColor: "#cbd5e0",
                    marginBottom: 16,
                    padding: 8,
                    color: "#2d3748",
                  }}
                />
                <TextInput
                  placeholder="Loan Amount"
                  onChangeText={(value) =>
                    handleInputChange("loanAmount", value)
                  }
                  value={costData.loanAmount}
                  keyboardType="numeric"
                  style={{
                    borderBottomWidth: 1,
                    borderBottomColor: "#cbd5e0",
                    marginBottom: 16,
                    padding: 8,
                    color: "#2d3748",
                  }}
                />
                <TextInput
                  placeholder="Interest Rate (%)"
                  onChangeText={(value) =>
                    handleInputChange("interestRate", value)
                  }
                  value={costData.interestRate}
                  keyboardType="numeric"
                  style={{
                    borderBottomWidth: 1,
                    borderBottomColor: "#cbd5e0",
                    marginBottom: 16,
                    padding: 8,
                    color: "#2d3748",
                  }}
                />
                <TextInput
                  placeholder="Loan Term (Years)"
                  onChangeText={(value) => handleInputChange("loanTerm", value)}
                  value={costData.loanTerm}
                  keyboardType="numeric"
                  style={{
                    borderBottomWidth: 1,
                    borderBottomColor: "#cbd5e0",
                    marginBottom: 16,
                    padding: 8,
                    color: "#2d3748",
                  }}
                />
                <TextInput
                  placeholder="Estimated Annual Cost"
                  onChangeText={(value) =>
                    handleInputChange("estimatedAnnualCost", value)
                  }
                  value={costData.estimatedAnnualCost}
                  keyboardType="numeric"
                  style={{
                    borderBottomWidth: 1,
                    borderBottomColor: "#cbd5e0",
                    marginBottom: 16,
                    padding: 8,
                    color: "#2d3748",
                  }}
                />
                <TextInput
                  placeholder="Insurance Cost"
                  onChangeText={(value) =>
                    handleInputChange("insuranceCost", value)
                  }
                  value={costData.insuranceCost}
                  keyboardType="numeric"
                  style={{
                    borderBottomWidth: 1,
                    borderBottomColor: "#cbd5e0",
                    marginBottom: 16,
                    padding: 8,
                    color: "#2d3748",
                  }}
                />
                <TextInput
                  placeholder="Hanger Cost"
                  onChangeText={(value) =>
                    handleInputChange("hangerCost", value)
                  }
                  value={costData.hangerCost}
                  keyboardType="numeric"
                  style={{
                    borderBottomWidth: 1,
                    borderBottomColor: "#cbd5e0",
                    marginBottom: 16,
                    padding: 8,
                    color: "#2d3748",
                  }}
                />
                <TextInput
                  placeholder="Fuel Cost Per Hour"
                  onChangeText={(value) =>
                    handleInputChange("fuelCostPerHour", value)
                  }
                  value={costData.fuelCostPerHour}
                  keyboardType="numeric"
                  style={{
                    borderBottomWidth: 1,
                    borderBottomColor: "#cbd5e0",
                    marginBottom: 16,
                    padding: 8,
                    color: "#2d3748",
                  }}
                />
                <TextInput
                  placeholder="Maintenance Reserve"
                  onChangeText={(value) =>
                    handleInputChange("maintenanceReserve", value)
                  }
                  value={costData.maintenanceReserve}
                  keyboardType="numeric"
                  style={{
                    borderBottomWidth: 1,
                    borderBottomColor: "#cbd5e0",
                    marginBottom: 16,
                    padding: 8,
                    color: "#2d3748",
                  }}
                />
                <TextInput
                  placeholder="Flight Hours Per Year"
                  onChangeText={(value) =>
                    handleInputChange("flightHoursPerYear", value)
                  }
                  value={costData.flightHoursPerYear}
                  keyboardType="numeric"
                  style={{
                    borderBottomWidth: 1,
                    borderBottomColor: "#cbd5e0",
                    marginBottom: 16,
                    padding: 8,
                    color: "#2d3748",
                  }}
                />

                {loading ? (
                  <ActivityIndicator size="large" color="#FF5A5F" />
                ) : (
                  <TouchableOpacity
                    onPress={saveCostData}
                    style={{
                      backgroundColor: "#e53e3e",
                      paddingVertical: 16,
                      paddingHorizontal: 24,
                      borderRadius: 50,
                      marginTop: 16,
                    }}
                  >
                    <Text
                      style={{
                        color: "white",
                        textAlign: "center",
                        fontWeight: "bold",
                      }}
                    >
                      Calculate Cost Per Hour
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            )}
          </View>
        </View>

        {/* Payment and Earnings Card */}
        <View style={{ paddingHorizontal: 16, paddingBottom: 16 }}>
          <Text
            style={{
              fontSize: 20,
              fontWeight: "bold",
              marginBottom: 8,
              color: "#2d3748",
            }}
          >
            Payment and Earnings
          </Text>
          <View
            style={{
              backgroundColor: "#f7fafc",
              borderRadius: 12,
              padding: 16,
            }}
          >
            <Text
              style={{
                fontSize: 16,
                fontWeight: "bold",
                marginBottom: 4,
                color: "#4a5568",
              }}
            >
              Actual Revenue
            </Text>
            <Text style={{ fontSize: 14, color: "#4a5568" }}>
              Total Earnings: ${calculateActualRevenue()}
            </Text>
          </View>

          {/* Editable Aircraft Details Card */}
          <View style={{ marginTop: 16 }}>
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <Text
                style={{
                  fontSize: 18,
                  fontWeight: "bold",
                  marginBottom: 8,
                  color: "#2d3748",
                }}
              >
                Aircraft Details
              </Text>
              {aircraftSaved && (
                <TouchableOpacity
                  onPress={handleListForRentToggle}
                  style={{
                    backgroundColor: isListedForRent ? "#e53e3e" : "#48bb78",
                    paddingVertical: 8,
                    paddingHorizontal: 16,
                    borderRadius: 50,
                  }}
                >
                  <Text style={{ color: "white", fontWeight: "bold" }}>
                    {isListedForRent ? "Unlist" : "List for Rent"}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
            <View
              style={{
                backgroundColor: "#edf2f7",
                borderRadius: 12,
                padding: 16,
              }}
            >
              {aircraftSaved ? (
                <View>
                  <Text
                    style={{
                      fontSize: 16,
                      fontWeight: "bold",
                      color: "#2d3748",
                    }}
                  >
                    {`${aircraftDetails.year} ${aircraftDetails.make} ${aircraftDetails.model}`}
                  </Text>
                  <Text style={{ fontSize: 14, color: "#4a5568" }}>
                    Engine: {aircraftDetails.engine}
                  </Text>
                  <Text style={{ fontSize: 14, color: "#4a5568" }}>
                    Description: {aircraftDetails.description}
                  </Text>
                  <Text style={{ fontSize: 14, color: "#4a5568" }}>
                    Total Time: {aircraftDetails.totalTime} hrs
                  </Text>
                  <Text style={{ fontSize: 14, color: "#4a5568" }}>
                    Location: {aircraftDetails.location}
                  </Text>
                  <Text style={{ fontSize: 14, color: "#4a5568" }}>
                    Airport Identifier: {aircraftDetails.airportIdentifier}
                  </Text>
                  <Text style={{ fontSize: 14, color: "#4a5568" }}>
                    Cost Per Hour: ${aircraftDetails.costPerHour}
                  </Text>
                  <FlatList
                    data={images}
                    horizontal
                    renderItem={({ item, index }) => (
                      <Image
                        key={index}
                        source={{ uri: item }}
                        style={{
                          width: 96,
                          height: 96,
                          marginRight: 8,
                          borderRadius: 8,
                        }}
                      />
                    )}
                    keyExtractor={(item, index) => index.toString()}
                    style={{ marginTop: 16 }}
                  />
                  <TouchableOpacity
                    onPress={onEditAircraftDetails}
                    style={{
                      backgroundColor: "#3182ce",
                      paddingVertical: 12,
                      paddingHorizontal: 24,
                      borderRadius: 50,
                      marginTop: 16,
                    }}
                  >
                    <Text
                      style={{
                        color: "white",
                        textAlign: "center",
                        fontWeight: "bold",
                      }}
                    >
                      Edit Aircraft Details
                    </Text>
                  </TouchableOpacity>
                  {/* Add Additional Aircraft Button */}
                  <TouchableOpacity
                    onPress={() => {
                      setAircraftSaved(false);
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
                      });
                      setImages([]);
                    }}
                    style={{
                      backgroundColor: "#48bb78",
                      paddingVertical: 12,
                      paddingHorizontal: 24,
                      borderRadius: 50,
                      marginTop: 16,
                    }}
                  >
                    <Text
                      style={{
                        color: "white",
                        textAlign: "center",
                        fontWeight: "bold",
                      }}
                    >
                      Add Additional Aircraft
                    </Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <View>
                  {/* Picker for Year */}
                  <Text
                    style={{ fontSize: 14, color: "#4a5568", marginBottom: 8 }}
                  >
                    Year:
                  </Text>
                  <Picker
                    selectedValue={aircraftDetails.year}
                    onValueChange={(itemValue) =>
                      handleInputChange("year", itemValue)
                    }
                    style={{
                      borderBottomWidth: 1,
                      borderBottomColor: "#cbd5e0",
                      marginBottom: 8,
                      color: "#2d3748",
                    }}
                  >
                    {[...Array(75)].map((_, index) => {
                      const year = new Date().getFullYear() - index;
                      return (
                        <Picker.Item
                          key={year}
                          label={`${year}`}
                          value={`${year}`}
                        />
                      );
                    })}
                  </Picker>

                  <TextInput
                    placeholder="Make"
                    onChangeText={(value) => handleInputChange("make", value)}
                    value={aircraftDetails.make}
                    style={{
                      borderBottomWidth: 1,
                      borderBottomColor: "#cbd5e0",
                      marginBottom: 8,
                      padding: 8,
                      color: "#2d3748",
                    }}
                  />
                  <TextInput
                    placeholder="Model"
                    onChangeText={(value) => handleInputChange("model", value)}
                    value={aircraftDetails.model}
                    style={{
                      borderBottomWidth: 1,
                      borderBottomColor: "#cbd5e0",
                      marginBottom: 8,
                      padding: 8,
                      color: "#2d3748",
                    }}
                  />
                  <TextInput
                    placeholder="Engine"
                    onChangeText={(value) => handleInputChange("engine", value)}
                    value={aircraftDetails.engine}
                    style={{
                      borderBottomWidth: 1,
                      borderBottomColor: "#cbd5e0",
                      marginBottom: 8,
                      padding: 8,
                      color: "#2d3748",
                    }}
                  />
                  {/* New Description Field */}
                  <TextInput
                    placeholder="Description"
                    onChangeText={(value) =>
                      handleInputChange("description", value)
                    }
                    value={aircraftDetails.description}
                    multiline
                    numberOfLines={4}
                    style={{
                      borderBottomWidth: 1,
                      borderBottomColor: "#cbd5e0",
                      marginBottom: 8,
                      padding: 8,
                      color: "#2d3748",
                    }}
                  />
                  <TextInput
                    placeholder="Total Time on Frame"
                    onChangeText={(value) =>
                      handleInputChange("totalTime", value)
                    }
                    value={aircraftDetails.totalTime}
                    keyboardType="numeric"
                    style={{
                      borderBottomWidth: 1,
                      borderBottomColor: "#cbd5e0",
                      marginBottom: 8,
                      padding: 8,
                      color: "#2d3748",
                    }}
                  />
                  <TextInput
                    placeholder="Location (City, State, Zipcode)"
                    onChangeText={(value) =>
                      handleInputChange("location", value)
                    }
                    value={aircraftDetails.location}
                    style={{
                      borderBottomWidth: 1,
                      borderBottomColor: "#cbd5e0",
                      marginBottom: 8,
                      padding: 8,
                      color: "#2d3748",
                    }}
                  />
                  <TextInput
                    placeholder="Airport Identifier"
                    onChangeText={(value) =>
                      handleInputChange("airportIdentifier", value)
                    }
                    value={aircraftDetails.airportIdentifier}
                    style={{
                      borderBottomWidth: 1,
                      borderBottomColor: "#cbd5e0",
                      marginBottom: 8,
                      padding: 8,
                      color: "#2d3748",
                    }}
                  />
                  <TextInput
                    placeholder="Cost Per Hour"
                    onChangeText={(value) =>
                      handleInputChange("costPerHour", value)
                    }
                    value={aircraftDetails.costPerHour}
                    keyboardType="numeric"
                    style={{
                      borderBottomWidth: 1,
                      borderBottomColor: "#cbd5e0",
                      marginBottom: 8,
                      padding: 8,
                      color: "#2d3748",
                    }}
                  />
                  <FlatList
                    data={images}
                    horizontal
                    renderItem={({ item, index }) => (
                      <Image
                        source={{ uri: item }}
                        style={{
                          width: 96,
                          height: 96,
                          marginRight: 8,
                          borderRadius: 8,
                        }}
                      />
                    )}
                    keyExtractor={(item, index) => index.toString()}
                    style={{ marginTop: 16 }}
                  />
                  <TouchableOpacity
                    onPress={pickImage}
                    style={{
                      backgroundColor: "#edf2f7",
                      paddingVertical: 12,
                      paddingHorizontal: 16,
                      borderRadius: 50,
                      marginTop: 8,
                      marginBottom: 16,
                    }}
                  >
                    <Text style={{ color: "#2d3748", textAlign: "center" }}>
                      {images.length >= 7 ? "Maximum 7 Images" : "Add Image"}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={onSaveAircraftDetails}
                    style={{
                      backgroundColor: "#48bb78",
                      paddingVertical: 12,
                      paddingHorizontal: 24,
                      borderRadius: 50,
                      marginTop: 16,
                    }}
                  >
                    <Text
                      style={{
                        color: "white",
                        textAlign: "center",
                        fontWeight: "bold",
                      }}
                    >
                      Save Aircraft Details
                    </Text>
                  </TouchableOpacity>

                  {/* Cancel button for reverting changes */}
                  <TouchableOpacity
                    onPress={onCancelAircraftEdit}
                    style={{
                      backgroundColor: "#e53e3e",
                      paddingVertical: 12,
                      paddingHorizontal: 24,
                      borderRadius: 50,
                      marginTop: 16,
                    }}
                  >
                    <Text
                      style={{
                        color: "white",
                        textAlign: "center",
                        fontWeight: "bold",
                      }}
                    >
                      Cancel Changes
                    </Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          </View>
        </View>

        {/* Current Listings Section */}
        <View style={{ marginTop: 32 }}>
          <Text
            style={{
              fontSize: 24,
              fontWeight: "bold",
              marginBottom: 16,
              color: "#2d3748",
              textAlign: "center",
            }}
          >
            Your Current Listings
          </Text>
          {userListings.length > 0 ? (
            userListings.map((listing, index) => (
              <View
                key={index}
                style={{
                  backgroundColor: "#edf2f7",
                  padding: 16,
                  borderRadius: 16,
                  marginBottom: 16,
                }}
              >
                <Text
                  style={{ fontSize: 18, fontWeight: "bold", color: "#2d3748" }}
                >
                  {listing.airplaneModel}
                </Text>
                {listing.boosted && (
                  <Text style={{ color: "#d69e2e", fontWeight: "bold" }}>
                    Sponsored Listing
                  </Text>
                )}
                <Text style={{ color: "#4a5568" }}>{listing.description}</Text>
                <Text style={{ color: "#4a5568" }}>{listing.location}</Text>
                <Text style={{ color: "#e53e3e", fontWeight: "bold" }}>
                  ${listing.ratesPerHour} per hour
                </Text>
                <TouchableOpacity
                  onPress={() => handleListForRentToggle(listing)}
                  style={{
                    backgroundColor: isListedForRent ? "#e53e3e" : "#48bb78",
                    paddingVertical: 8,
                    paddingHorizontal: 16,
                    borderRadius: 50,
                    marginTop: 16,
                  }}
                >
                  <Text style={{ color: "white", fontWeight: "bold" }}>
                    {isListedForRent ? "Unlist" : "List for Rent"}
                  </Text>
                </TouchableOpacity>
              </View>
            ))
          ) : (
            <Text style={{ color: "#4a5568", textAlign: "center" }}>
              No listings available.
            </Text>
          )}
        </View>

        {/* Additional Aircrafts Section */}
        <View style={{ marginTop: 32 }}>
          <Text
            style={{
              fontSize: 24,
              fontWeight: "bold",
              marginBottom: 16,
              color: "#2d3748",
              textAlign: "center",
            }}
          >
            Additional Aircraft Listings
          </Text>
          {additionalAircrafts.length > 0 ? (
            additionalAircrafts.map((aircraft, index) => (
              <View
                key={index}
                style={{
                  backgroundColor: "#edf2f7",
                  padding: 16,
                  borderRadius: 16,
                  marginBottom: 16,
                }}
              >
                <Text
                  style={{ fontSize: 18, fontWeight: "bold", color: "#2d3748" }}
                >
                  {aircraft.airplaneModel}
                </Text>
                {aircraft.boosted && (
                  <Text style={{ color: "#d69e2e", fontWeight: "bold" }}>
                    Sponsored Listing
                  </Text>
                )}
                <Text style={{ color: "#4a5568" }}>{aircraft.description}</Text>
                <Text style={{ color: "#4a5568" }}>{aircraft.location}</Text>
                <Text style={{ color: "#e53e3e", fontWeight: "bold" }}>
                  ${aircraft.ratesPerHour} per hour
                </Text>
                <TouchableOpacity
                  onPress={() => handleListForRentToggle(aircraft, true)}
                  style={{
                    backgroundColor: isListedForRent ? "#e53e3e" : "#48bb78",
                    paddingVertical: 8,
                    paddingHorizontal: 16,
                    borderRadius: 50,
                    marginTop: 16,
                  }}
                >
                  <Text style={{ color: "white", fontWeight: "bold" }}>
                    {isListedForRent ? "Unlist" : "List for Rent"}
                  </Text>
                </TouchableOpacity>
              </View>
            ))
          ) : (
            <Text style={{ color: "#4a5568", textAlign: "center" }}>
              No additional aircraft listings available.
            </Text>
          )}
        </View>

        {/* Rental History Section */}
        <View style={{ marginTop: 32 }}>
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
                <Text
                  style={{ fontSize: 18, fontWeight: "bold", color: "#2d3748" }}
                >
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
                    setMessageModalVisible(true);
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

      {/* Rental Request Modal */}
      <Modal
        visible={rentalRequestModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setRentalRequestModalVisible(false)}
      >
        <View
          style={{
            flex: 1,
            justifyContent: "center",
            alignItems: "center",
            backgroundColor: "rgba(0, 0, 0, 0.5)",
          }}
        >
          <View
            style={{
              backgroundColor: "white",
              borderRadius: 24,
              padding: 24,
              width: "100%",
              maxWidth: 320,
              shadowColor: "#000",
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.2,
              shadowRadius: 8,
            }}
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
                  Renter Rating: {selectedRequest.renterRating || "N/A"}
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
                </TouchableOpacity>
              ))
            ) : (
              <Text style={{ color: "#4a5568", textAlign: "center" }}>
                No rental requests available.
              </Text>
            )}
            <TouchableOpacity
              onPress={() => setRentalRequestModalVisible(false)}
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
                Cancel
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

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
            justifyContent: "center",
            alignItems: "center",
            backgroundColor: "rgba(0, 0, 0, 0.5)",
          }}
        >
          <View
            style={{
              backgroundColor: "white",
              borderRadius: 24,
              padding: 24,
              width: "100%",
              maxWidth: 320,
              shadowColor: "#000",
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.2,
              shadowRadius: 8,
            }}
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
              Messages with Renter
            </Text>
            <ScrollView
              contentContainerStyle={{ paddingBottom: 16 }}
              style={{ maxHeight: 400 }}
            >
              {messages.map((message) => (
                <View key={message.id} style={{ marginBottom: 12 }}>
                  <Text style={{ fontWeight: "bold", color: "#2d3748" }}>
                    {message.senderName}
                  </Text>
                  <Text style={{ color: "#4a5568" }}>{message.text}</Text>
                </View>
              ))}
            </ScrollView>
            <TextInput
              placeholder="Type a message..."
              value={messageInput}
              onChangeText={(text) => setMessageInput(text)}
              style={{
                borderColor: "#cbd5e0",
                borderWidth: 1,
                borderRadius: 50,
                padding: 12,
                marginBottom: 12,
                color: "#2d3748",
              }}
            />
            <TouchableOpacity
              onPress={sendMessage}
              style={{
                backgroundColor: "#3182ce",
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
                Send Message
              </Text>
            </TouchableOpacity>
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
          </View>
        </View>
      </Modal>

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
        onPress={() => setMessageModalVisible(true)}
      >
        <Ionicons name="chatbubble-ellipses" size={32} color="white" />
      </TouchableOpacity>
    </View>
  );
};

export default OwnerProfile;
