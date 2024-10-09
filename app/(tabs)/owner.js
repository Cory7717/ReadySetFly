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
  StyleSheet,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { db, storage, auth } from "../../firebaseConfig"; // Import Firebase Auth
import * as ImagePicker from "expo-image-picker";
import * as DocumentPicker from "expo-document-picker";
import {
  collection,
  addDoc,
  onSnapshot,
  updateDoc,
  deleteDoc,
  doc,
  getDoc,
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
  const [fullScreenModalVisible, setFullScreenModalVisible] = useState(false);
  const [aircraftModalVisible, setAircraftModalVisible] = useState(false);
  const [rentalDate, setRentalDate] = useState(null);

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
          const requestsWithNames = await Promise.all(
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

              return {
                id: docSnap.id,
                ...requestData,
                renterName,
              };
            })
          );

          setRentalRequests(requestsWithNames);
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

  const onDayPress = (day) => {
    const selected = !selectedDates[day.dateString];
    setRentalDate(day.dateString);
    setSelectedDates({
      [day.dateString]: selected
        ? { selected: true, marked: true, dotColor: "red" }
        : undefined,
    });
    setCalendarVisible(false);
  };

  const uploadFile = async (uri, folder) => {
    try {
      console.log("Fetching file from URI:", uri);
      const response = await fetch(uri);
      console.log("Converting file to blob...");
      const blob = await response.blob();
      const filename = uri.substring(uri.lastIndexOf("/") + 1);
      console.log("Generated filename:", filename);

      const storageRef = ref(storage, `${folder}/${resolvedOwnerId}/${filename}`);
      console.log("Uploading file to Firebase Storage path:", storageRef.fullPath);

      await uploadBytes(storageRef, blob);
      console.log("File uploaded successfully!");

      const downloadURL = await getDownloadURL(storageRef);
      console.log("Download URL:", downloadURL);

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
      Alert.alert(
        "Changes Canceled",
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
      setAircraftModalVisible(false);
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
    if (isListedForRent) {
      if (!listing?.id) {
        Alert.alert("Error", "Listing ID is missing.");
        return;
      }
      // Proceed to unlist the aircraft
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
      // Proceed to list the aircraft
      await onSubmitMethod(listing, additional);
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
        rentalDate: rentalDate,
      });

      await addDoc(collection(db, "renters", request.renterId, "notifications"), {
        type: "rentalApproved",
        message:
          "Your rental request has been approved. Please complete the payment.",
        listingId: request.listingId,
        ownerId: resolvedOwnerId,
        rentalDate: rentalDate,
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
    // Add any data refreshing logic here
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
      senderId: user.uid, // Use Firebase user UID
      senderName: user.displayName || "Owner", // Use Firebase displayName
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
        if (chatDoc.exists()) { // Corrected this line
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
            // Show summary card
            <View style={{ backgroundColor: "#edf2f7", padding: 16, borderRadius: 16 }}>
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
                <Text style={{ color: "white", textAlign: "center", fontWeight: "bold" }}>
                  Edit Cost Data
                </Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              {/* Loan Details Section */}
              <View style={{ marginBottom: 16 }}>
                <Text style={{ fontSize: 20, fontWeight: 'bold', marginBottom: 8 }}>Loan Details</Text>
                <TextInput
                  placeholder="Purchase Price"
                  value={costData.purchasePrice}
                  onChangeText={(value) => handleInputChange('purchasePrice', value)}
                  keyboardType="numeric"
                  style={styles.input}
                />
                <TextInput
                  placeholder="Loan Amount"
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
                {/* Display calculated Mortgage Expense */}
                <Text style={{ marginTop: 8 }}>Mortgage Expense: ${costData.mortgageExpense}</Text>
              </View>

              {/* Annual Costs Section */}
              <View style={{ marginBottom: 16 }}>
                <Text style={{ fontSize: 20, fontWeight: 'bold', marginBottom: 8 }}>Annual Costs</Text>
                <TextInput
                  placeholder="Estimated Annual Cost"
                  value={costData.estimatedAnnualCost}
                  onChangeText={(value) => handleInputChange('estimatedAnnualCost', value)}
                  keyboardType="numeric"
                  style={styles.input}
                />
                <TextInput
                  placeholder="Insurance Cost"
                  value={costData.insuranceCost}
                  onChangeText={(value) => handleInputChange('insuranceCost', value)}
                  keyboardType="numeric"
                  style={styles.input}
                />
                <TextInput
                  placeholder="Hangar Cost"
                  value={costData.hangerCost}
                  onChangeText={(value) => handleInputChange('hangerCost', value)}
                  keyboardType="numeric"
                  style={styles.input}
                />
                <TextInput
                  placeholder="Maintenance Reserve"
                  value={costData.maintenanceReserve}
                  onChangeText={(value) => handleInputChange('maintenanceReserve', value)}
                  keyboardType="numeric"
                  style={styles.input}
                />
              </View>

              {/* Operational Costs Section */}
              <View style={{ marginBottom: 16 }}>
                <Text style={{ fontSize: 20, fontWeight: 'bold', marginBottom: 8 }}>Operational Costs</Text>
                <TextInput
                  placeholder="Fuel Cost Per Hour"
                  value={costData.fuelCostPerHour}
                  onChangeText={(value) => handleInputChange('fuelCostPerHour', value)}
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

              {/* Save Button */}
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
              style={{
                backgroundColor: "#edf2f7",
                padding: 16,
                borderRadius: 16,
                marginBottom: 16,
              }}
            >
              <Text style={{ fontSize: 20, fontWeight: 'bold', marginBottom: 8 }}>
                {aircraftDetails.year} {aircraftDetails.make} {aircraftDetails.model}
              </Text>
              <Text style={{ marginBottom: 8 }}>
                Engine: {aircraftDetails.engine}
              </Text>
              <Text style={{ marginBottom: 8 }}>
                Total Time: {aircraftDetails.totalTime} hours
              </Text>
              <Text style={{ marginBottom: 8 }}>
                Location: {aircraftDetails.location} ({aircraftDetails.airportIdentifier})
              </Text>
              <Text style={{ marginBottom: 8 }}>
                Cost Per Hour: ${aircraftDetails.costPerHour}
              </Text>
              <Text style={{ marginBottom: 8 }}>
                Description: {aircraftDetails.description}
              </Text>
              {images.length > 0 && (
                <FlatList
                  data={images}
                  horizontal
                  keyExtractor={(item, index) => index.toString()}
                  renderItem={({ item }) => (
                    <Image
                      source={{ uri: item }}
                      style={{ width: 100, height: 100, margin: 8 }}
                    />
                  )}
                />
              )}
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 16 }}>
                <TouchableOpacity
                  onPress={() => handleListForRentToggle(aircraftDetails)}
                  style={{
                    backgroundColor: isListedForRent ? "#e53e3e" : "#48bb78",
                    paddingVertical: 12,
                    borderRadius: 8,
                    flex: 1,
                    marginRight: 8,
                  }}
                >
                  <Text style={{ color: "white", textAlign: "center", fontWeight: "bold" }}>
                    {isListedForRent ? "Unlist" : "List"}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => setAircraftModalVisible(true)}
                  style={{
                    backgroundColor: "#3182ce",
                    paddingVertical: 12,
                    borderRadius: 8,
                    flex: 1,
                    marginLeft: 8,
                  }}
                >
                  <Text style={{ color: "white", textAlign: "center", fontWeight: "bold" }}>
                    Edit
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <TouchableOpacity
              onPress={() => setAircraftModalVisible(true)}
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
                Add Aircraft Details
              </Text>
            </TouchableOpacity>
          )}
        </View>

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
                    keyExtractor={(item, index) => index.toString()}
                    renderItem={({ item }) => (
                      <Image
                        source={{ uri: item }}
                        style={{ width: 100, height: 100, margin: 8 }}
                      />
                    )}
                  />
                )}
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

            {/* Chat Thread Content */}
            <FlatList
              data={messages}
              keyExtractor={(item, index) => index.toString()}
              renderItem={({ item }) => (
                <View
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
              )}
            />

            {/* Message Input */}
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

      {/* Full-Screen Listing Modal */}
      <Modal
        visible={fullScreenModalVisible}
        animationType="slide"
        onRequestClose={() => setFullScreenModalVisible(false)}
      >
        <ScrollView contentContainerStyle={{ padding: 16 }}>
          <Text style={{ fontSize: 24, fontWeight: "bold", marginBottom: 16 }}>
            Create New Listing
          </Text>
          {/* Form Fields for New Listing */}
          {/* Include all form fields similar to aircraftDetails and profileData */}
          {Object.keys(profileData).map((key) => (
            <TextInput
              key={key}
              placeholder={key.replace(/([A-Z])/g, " $1")}
              value={profileData[key]}
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
              keyExtractor={(item, index) => index.toString()}
              renderItem={({ item }) => (
                <Image
                  source={{ uri: item }}
                  style={{ width: 100, height: 100, margin: 8 }}
                />
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

      {/* Aircraft Details Modal */}
      <Modal
        visible={aircraftModalVisible}
        animationType="slide"
        onRequestClose={() => setAircraftModalVisible(false)}
      >
        <ScrollView contentContainerStyle={{ padding: 16 }}>
          <Text style={{ fontSize: 24, fontWeight: "bold", marginBottom: 16 }}>
            Aircraft Details
          </Text>

          {/* General Information Section */}
          <View style={{ marginBottom: 16 }}>
            <Text style={{ fontSize: 20, fontWeight: 'bold', marginBottom: 8 }}>General Information</Text>
            <TextInput
              placeholder="Year"
              value={aircraftDetails.year}
              onChangeText={(value) => handleInputChange('year', value)}
              keyboardType="numeric"
              style={styles.input}
            />
            <TextInput
              placeholder="Make"
              value={aircraftDetails.make}
              onChangeText={(value) => handleInputChange('make', value)}
              style={styles.input}
            />
            <TextInput
              placeholder="Model"
              value={aircraftDetails.model}
              onChangeText={(value) => handleInputChange('model', value)}
              style={styles.input}
            />
            <TextInput
              placeholder="Engine"
              value={aircraftDetails.engine}
              onChangeText={(value) => handleInputChange('engine', value)}
              style={styles.input}
            />
            <TextInput
              placeholder="Total Time"
              value={aircraftDetails.totalTime}
              onChangeText={(value) => handleInputChange('totalTime', value)}
              keyboardType="numeric"
              style={styles.input}
            />
          </View>

          {/* Location Information Section */}
          <View style={{ marginBottom: 16 }}>
            <Text style={{ fontSize: 20, fontWeight: 'bold', marginBottom: 8 }}>Location Information</Text>
            <TextInput
              placeholder="Location"
              value={aircraftDetails.location}
              onChangeText={(value) => handleInputChange('location', value)}
              style={styles.input}
            />
            <TextInput
              placeholder="Airport Identifier"
              value={aircraftDetails.airportIdentifier}
              onChangeText={(value) => handleInputChange('airportIdentifier', value)}
              style={styles.input}
            />
          </View>

          {/* Cost Information Section */}
          <View style={{ marginBottom: 16 }}>
            <Text style={{ fontSize: 20, fontWeight: 'bold', marginBottom: 8 }}>Cost Information</Text>
            <TextInput
              placeholder="Cost Per Hour"
              value={aircraftDetails.costPerHour}
              onChangeText={(value) => handleInputChange('costPerHour', value)}
              keyboardType="numeric"
              style={styles.input}
            />
          </View>

          {/* Description */}
          <View style={{ marginBottom: 16 }}>
            <Text style={{ fontSize: 20, fontWeight: 'bold', marginBottom: 8 }}>Description</Text>
            <TextInput
              placeholder="Description"
              value={aircraftDetails.description}
              onChangeText={(value) => handleInputChange('description', value)}
              style={[styles.input, { height: 100 }]}
              multiline={true}
            />
          </View>

          {/* Image Picker */}
          <TouchableOpacity
            onPress={pickImage}
            style={{
              backgroundColor: "#3182ce",
              paddingVertical: 12,
              borderRadius: 8,
              marginTop: 16,
            }}
          >
            <Text style={{ color: "white", textAlign: "center", fontWeight: "bold" }}>
              Upload Images
            </Text>
          </TouchableOpacity>

          {images.length > 0 && (
            <FlatList
              data={images}
              horizontal
              keyExtractor={(item, index) => index.toString()}
              renderItem={({ item }) => (
                <Image
                  source={{ uri: item }}
                  style={{ width: 100, height: 100, margin: 8 }}
                />
              )}
            />
          )}

          {/* Save and List for Rent Buttons */}
          <TouchableOpacity
            onPress={onSaveAircraftDetails}
            style={{
              backgroundColor: "#3182ce",
              paddingVertical: 12,
              borderRadius: 8,
              marginBottom: 16,
              marginTop: 16,
            }}
          >
            <Text style={{ color: "white", textAlign: "center", fontWeight: "bold" }}>
              Save Aircraft Details
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => onSubmitMethod({}, false)}
            style={{
              backgroundColor: "#48bb78",
              paddingVertical: 12,
              borderRadius: 8,
            }}
          >
            <Text style={{ color: "white", textAlign: "center", fontWeight: "bold" }}>
              List for Rent
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setAircraftModalVisible(false)}
            style={{
              backgroundColor: "#e53e3e",
              paddingVertical: 12,
              borderRadius: 8,
              marginTop: 16,
            }}
          >
            <Text style={{ color: "white", textAlign: "center", fontWeight: "bold" }}>
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

const styles = StyleSheet.create({
  input: {
    borderBottomWidth: 1,
    borderBottomColor: "#ccc",
    marginBottom: 12,
    paddingVertical: 8,
  },
});

export default OwnerProfile;
