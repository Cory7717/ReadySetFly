import React, { useState, useEffect } from "react";
import {
  View,
  TextInput,
  Alert,
  ScrollView,
  TouchableOpacity,
  Image,
  Text,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  FlatList,
  ImageBackground,
  Modal,
  StatusBar,
  RefreshControl,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useUser } from "@clerk/clerk-expo";
import { db } from "../../firebaseConfig";
import { Formik } from "formik";
import { Calendar } from "react-native-calendars";
import * as ImagePicker from "expo-image-picker";
import * as DocumentPicker from "expo-document-picker";
import { getStorage, ref, uploadBytes, getDownloadURL } from "firebase/storage";
import {
  collection,
  addDoc,
  onSnapshot,
  updateDoc,
  doc,
} from "firebase/firestore";
import { FontAwesome, Ionicons } from "@expo/vector-icons";
import wingtipClouds from "../../Assets/images/wingtip_clouds.jpg";
import { useStripe } from "@stripe/stripe-react-native";

const OwnerProfile = ({ ownerId, navigation }) => {
  const [profileData, setProfileData] = useState({
    airplaneModel: "",
    description: "",
    location: "",
    ratesPerHour: "",
    minimumHours: "",
    boostListing: false,
    boostedListing: false,
  });
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
  const [rentalRequestModalVisible, setRentalRequestModalVisible] = useState(false);
  const { user } = useUser();
  const storage = getStorage();
  const stripe = useStripe();

  useEffect(() => {
    if (ownerId) {
      const rentalRequestsRef = collection(db, "owners", ownerId, "rentalRequests");
      const unsubscribeRequests = onSnapshot(rentalRequestsRef, (snapshot) => {
        const requestsData = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        setRentalRequests(requestsData);
      });

      return () => {
        unsubscribeRequests();
      };
    } else {
      console.error("Error: ownerId is undefined.");
      Alert.alert("Error", "Owner ID is undefined.");
    }
  }, [ownerId]);

  const handleInputChange = (name, value) => {
    setProfileData((prev) => ({ ...prev, [name]: value || "" }));
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
      } else if (typeof data[key] === 'boolean') {
        sanitizedData[key] = data[key];
      } else {
        sanitizedData[key] = "";
      }
    }
    return sanitizedData;
  };

  const onSubmitMethod = async (values) => {
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
        airplaneModel: values.airplaneModel || "", 
        description: values.description || "",
        location: values.location || "",
        ratesPerHour: profileData.ratesPerHour || "0", 
        minimumHours: values.minimumHours || "1",
        images: uploadedImages.length > 0 ? uploadedImages : [], 
        currentAnnualPdf: annualProofURL || "",
        insurancePdf: insuranceProofURL || "",
        ownerId: user.id,
        createdAt: new Date(),
        boosted: profileData.boostListing || false,
        boostedListing: profileData.boostListing ? true : false, 
      });

      await addDoc(collection(db, "airplanes"), newListing);

      navigation.navigate("Home", { newListing });

      const updatedListings = [
        ...userListings,
        { ...newListing, id: Math.random().toString() },
      ];
      setUserListings(updatedListings);

      Alert.alert("Success", "Your listing has been submitted.");
      setFormVisible(false);
    } catch (error) {
      console.error("Error submitting listing: ", error);

      if (error.message.includes('Network request failed')) {
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

  const handleApproveRentalRequest = async (request) => {
    try {
      if (!ownerId) {
        Alert.alert("Error", "Owner ID is undefined.");
        return;
      }

      const notificationRef = doc(db, "owners", ownerId, "rentalRequests", request.id);
      await updateDoc(notificationRef, { status: "approved" });

      const paymentIntent = await stripe.paymentRequestWithPaymentIntent({
        amount: parseInt(request.totalCost * 100), // Amount in cents
        currency: 'usd',
        paymentMethodTypes: ['card'],
        confirm: true,
      });

      if (paymentIntent.status === 'succeeded') {
        Alert.alert("Payment Successful", "The rental request has been approved and payment processed.");
      } else {
        Alert.alert("Payment Failed", "The payment could not be completed. Please try again.");
      }

      setRentalRequestModalVisible(false);
    } catch (error) {
      console.error("Error approving rental request: ", error);
      Alert.alert("Error", "There was an error approving the rental request.");
    }
  };

  const handleDenyRentalRequest = async (request) => {
    try {
      if (!ownerId) {
        Alert.alert("Error", "Owner ID is undefined.");
        return;
      }

      const notificationRef = doc(db, "owners", ownerId, "rentalRequests", request.id);
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
    // Fetch the latest data...
    setRefreshing(false);
  };

  const handleSendRentalRequest = async (selectedListing, rentalHours) => {
    if (!selectedListing) return;

    const rentalCost = parseFloat(selectedListing.ratesPerHour) * rentalHours;
    const ownerCost = rentalCost - rentalCost * 0.06;

    const messageData = {
      senderId: user.id,
      senderName: user.fullName || "Anonymous",
      airplaneModel: selectedListing.airplaneModel,
      rentalPeriod: `2024-09-01 to 2024-09-07`, // Replace with actual data
      totalCost: ownerCost.toFixed(2),
      contact: user?.email || "noemail@example.com",
      createdAt: new Date(),
      status: "pending",
      renterName: user.fullName || "Anonymous",
    };

    try {
      await addDoc(collection(db, "owners", selectedListing.ownerId, "rentalRequests"), messageData);
      Alert.alert("Request Sent", "Your rental request has been sent to the owner.");
    } catch (error) {
      console.error("Error sending rental request: ", error);
      Alert.alert("Error", "Failed to send rental request to the owner.");
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: "white" }}>
      <SafeAreaView style={{ backgroundColor: "white" }}>
        <StatusBar barStyle="light-content" />
      </SafeAreaView>

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
              padding: 16,
            }}
          >
            <View>
              <Text style={{ fontSize: 14, color: "white", marginTop: 1 }}>Good Morning</Text>
              <Text style={{ fontSize: 18, fontWeight: "bold", color: "white" }}>
                {user?.fullName || "User"}
              </Text>
            </View>

            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <TouchableOpacity
                onPress={() => setFormVisible(true)}
                style={{
                  backgroundColor: "white",
                  opacity: 0.5,
                  borderRadius: 50,
                  paddingVertical: 8,
                  paddingHorizontal: 16,
                }}
              >
                <Text style={{ color: "#2d3748", fontWeight: "bold" }}>
                  Submit Your Listing
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </ImageBackground>

        {/* Pressable Area for Viewing Rental Requests */}
        <TouchableOpacity
          onPress={() => setRentalRequestModalVisible(true)}
          style={{
            marginVertical: 20,
            paddingVertical: 15,
            paddingHorizontal: 20,
            backgroundColor: "#2d3748",
            borderRadius: 8,
            alignItems: "center",
            flexDirection: "row",
            justifyContent: "center",
            marginHorizontal: 16,
          }}
        >
          <Text style={{ color: "white", fontWeight: "bold" }}>View Rental Requests</Text>
          {rentalRequests.length > 0 && (
            <View
              style={{
                backgroundColor: "#e53e3e",
                borderRadius: 50,
                marginLeft: 10,
                paddingHorizontal: 8,
                paddingVertical: 4,
              }}
            >
              <Text style={{ color: "white", fontWeight: "bold" }}>
                {rentalRequests.length}
              </Text>
            </View>
          )}
        </TouchableOpacity>

        <View style={{ marginTop: 32 }}>
          <Text style={{ fontSize: 24, fontWeight: "bold", marginBottom: 16, color: "#2d3748", textAlign: "center" }}>
            Your Current Listings
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
                <Text style={{ fontSize: 18, fontWeight: "bold", color: "#2d3748" }}>
                  {listing.airplaneModel}
                </Text>
                {listing.boosted && (
                  <Text style={{ color: "#d69e2e", fontWeight: "bold" }}>Sponsored Listing</Text>
                )}
                <Text style={{ color: "#4a5568" }}>{listing.description}</Text>
                <Text style={{ color: "#4a5568" }}>{listing.location}</Text>
                <Text style={{ color: "#e53e3e", fontWeight: "bold" }}>
                  ${listing.ratesPerHour} per hour
                </Text>
              </View>
            ))
          ) : (
            <Text style={{ color: "#4a5568", textAlign: "center" }}>
              No listings available.
            </Text>
          )}
        </View>

        <View style={{ marginTop: 32 }}>
          <Text style={{ fontSize: 24, fontWeight: "bold", marginBottom: 16, color: "#2d3748", textAlign: "center" }}>
            Rental History
          </Text>
          {rentalHistory.length > 0 ? (
            rentalHistory.map((order) => (
              <View key={order.id} style={{ backgroundColor: "#edf2f7", padding: 16, borderRadius: 16, marginBottom: 16 }}>
                <Text style={{ fontSize: 18, fontWeight: "bold", color: "#2d3748" }}>
                  {order.airplaneModel}
                </Text>
                <Text style={{ color: "#4a5568" }}>{order.rentalPeriod}</Text>
                <Text style={{ color: "#4a5568" }}>{order.renterName}</Text>
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 16 }}>
                  <Text style={{ color: "#2d3748" }}>Rate this renter:</Text>
                  <View style={{ flexDirection: "row" }}>
                    {[1, 2, 3, 4, 5].map((star) => (
                      <TouchableOpacity
                        key={star}
                        onPress={() => handleRating(order.id, star)}
                      >
                        <FontAwesome
                          name={
                            star <= (ratings[order.id] || 0) ? "star" : "star-o"
                          }
                          size={24}
                          color="gold"
                        />
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              </View>
            ))
          ) : (
            <Text style={{ color: "#4a5568", textAlign: "center" }}>
              No rental history.
            </Text>
          )}
        </View>
      </ScrollView>

      <View style={{ position: "absolute", bottom: 40, left: 0, right: 0, alignItems: "center" }}>
        <TouchableOpacity
          onPress={() => setTransferModalVisible(true)}
          style={{
            padding: 10,
            borderRadius: 25,
            backgroundColor: "rgba(255, 255, 255, 0.7)",
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.8,
            shadowRadius: 2,
            elevation: 5,
          }}
        >
          <Text style={{ color: "#2d3748", fontWeight: "bold" }}>
            Available Balance: ${availableBalance}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Transfer Modal */}
      <Modal
        visible={transferModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setTransferModalVisible(false)}
      >
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "rgba(0, 0, 0, 0.5)" }}>
          <View style={{ backgroundColor: "white", borderRadius: 24, padding: 24, width: "100%", maxWidth: 320, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 8 }}>
            <Text style={{ fontSize: 24, fontWeight: "bold", marginBottom: 24, textAlign: "center", color: "#2d3748" }}>
              Transfer Funds
            </Text>
            <TouchableOpacity
              onPress={() => setAchModalVisible(true)}
              style={{ backgroundColor: "rgba(255, 255, 255, 0.5)", borderRadius: 50, paddingVertical: 12, marginBottom: 16, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 8 }}
            >
              <Text style={{ color: "#2d3748", fontWeight: "bold", textAlign: "center" }}>
                Transfer via ACH
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setDebitModalVisible(true)}
              style={{ backgroundColor: "rgba(255, 255, 255, 0.5)", borderRadius: 50, paddingVertical: 12, marginBottom: 16, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 8 }}
            >
              <Text style={{ color: "#2d3748", fontWeight: "bold", textAlign: "center" }}>
                Transfer to Debit Card
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setTransferModalVisible(false)}
              style={{ backgroundColor: "#e2e8f0", paddingVertical: 12, borderRadius: 50, marginTop: 16 }}
            >
              <Text style={{ color: "#2d3748", fontWeight: "bold", textAlign: "center" }}>
                Cancel
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ACH Modal */}
      <Modal
        visible={achModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setAchModalVisible(false)}
      >
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "rgba(0, 0, 0, 0.5)" }}>
          <View style={{ backgroundColor: "white", borderRadius: 24, padding: 24, width: "100%", maxWidth: 320, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 8 }}>
            <Text style={{ fontSize: 24, fontWeight: "bold", marginBottom: 24, textAlign: "center", color: "#2d3748" }}>
              Enter Bank Details
            </Text>
            <Formik
              initialValues={{
                bankAccountNumber: "",
                bankRoutingNumber: "",
              }}
              onSubmit={(values) => {
                handleTransferFunds("ACH");
              }}
            >
              {({ handleChange, handleBlur, handleSubmit, values }) => (
                <>
                  <TextInput
                    placeholder="Bank Account Number"
                    onChangeText={handleChange("bankAccountNumber")}
                    onBlur={handleBlur("bankAccountNumber")}
                    value={values.bankAccountNumber || ""}
                    style={{ borderBottomWidth: 1, borderBottomColor: "#cbd5e0", marginBottom: 16, padding: 8, color: "#2d3748" }}
                    keyboardType="numeric"
                  />
                  <TextInput
                    placeholder="Bank Routing Number"
                    onChangeText={handleChange("bankRoutingNumber")}
                    onBlur={handleBlur("bankRoutingNumber")}
                    value={values.bankRoutingNumber || ""}
                    style={{ borderBottomWidth: 1, borderBottomColor: "#cbd5e0", marginBottom: 16, padding: 8, color: "#2d3748" }}
                    keyboardType="numeric"
                  />
                  <TouchableOpacity
                    onPress={handleSubmit}
                    style={{ backgroundColor: "rgba(255, 255, 255, 0.5)", borderRadius: 50, paddingVertical: 12, marginBottom: 16, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 8 }}
                  >
                    <Text style={{ color: "#2d3748", fontWeight: "bold", textAlign: "center" }}>
                      Submit
                    </Text>
                  </TouchableOpacity>
                </>
              )}
            </Formik>
            <TouchableOpacity
              onPress={() => setAchModalVisible(false)}
              style={{ backgroundColor: "#e2e8f0", paddingVertical: 12, borderRadius: 50, marginTop: 16 }}
            >
              <Text style={{ color: "#2d3748", fontWeight: "bold", textAlign: "center" }}>
                Cancel
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Debit Card Modal */}
      <Modal
        visible={debitModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setDebitModalVisible(false)}
      >
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "rgba(0, 0, 0, 0.5)" }}>
          <View style={{ backgroundColor: "white", borderRadius: 24, padding: 24, width: "100%", maxWidth: 320, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 8 }}>
            <Text style={{ fontSize: 24, fontWeight: "bold", marginBottom: 24, textAlign: "center", color: "#2d3748" }}>
              Enter Debit Card Details
            </Text>
            <Formik
              initialValues={{
                cardNumber: "",
                cardExpiry: "",
                cardCVC: "",
              }}
              onSubmit={(values) => {
                handleTransferFunds("Debit Card");
              }}
            >
              {({ handleChange, handleBlur, handleSubmit, values }) => (
                <>
                  <TextInput
                    placeholder="Card Number"
                    onChangeText={handleChange("cardNumber")}
                    onBlur={handleBlur("cardNumber")}
                    value={values.cardNumber || ""}
                    style={{ borderBottomWidth: 1, borderBottomColor: "#cbd5e0", marginBottom: 16, padding: 8, color: "#2d3748" }}
                    keyboardType="numeric"
                  />
                  <TextInput
                    placeholder="Expiry Date (MM/YY)"
                    onChangeText={handleChange("cardExpiry")}
                    onBlur={handleBlur("cardExpiry")}
                    value={values.cardExpiry || ""}
                    style={{ borderBottomWidth: 1, borderBottomColor: "#cbd5e0", marginBottom: 16, padding: 8, color: "#2d3748" }}
                    keyboardType="numeric"
                  />
                  <TextInput
                    placeholder="CVC"
                    onChangeText={handleChange("cardCVC")}
                    onBlur={handleBlur("cardCVC")}
                    value={values.cardCVC || ""}
                    style={{ borderBottomWidth: 1, borderBottomColor: "#cbd5e0", marginBottom: 16, padding: 8, color: "#2d3748" }}
                    keyboardType="numeric"
                  />
                  <TouchableOpacity
                    onPress={handleSubmit}
                    style={{ backgroundColor: "rgba(255, 255, 255, 0.5)", borderRadius: 50, paddingVertical: 12, marginBottom: 16, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 8 }}
                  >
                    <Text style={{ color: "#2d3748", fontWeight: "bold", textAlign: "center" }}>
                      Submit
                    </Text>
                  </TouchableOpacity>
                </>
              )}
            </Formik>
            <TouchableOpacity
              onPress={() => setDebitModalVisible(false)}
              style={{ backgroundColor: "#e2e8f0", paddingVertical: 12, borderRadius: 50, marginTop: 16 }}
            >
              <Text style={{ color: "#2d3748", fontWeight: "bold", textAlign: "center" }}>
                Cancel
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Form Modal */}
      <Modal
        visible={formVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setFormVisible(false)}
      >
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "rgba(0, 0, 0, 0.5)" }}>
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : "height"}
            style={{ flex: 1, justifyContent: "center", alignItems: "center", width: "100%" }}
          >
            <ScrollView
              contentContainerStyle={{
                flexGrow: 1,
                justifyContent: "center",
                alignItems: "center",
              }}
              style={{ width: "100%", maxWidth: 320 }}
            >
              <View style={{ backgroundColor: "white", borderRadius: 24, padding: 24, width: "100%", shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 8 }}>
                <Text style={{ fontSize: 24, fontWeight: "bold", marginBottom: 24, textAlign: "center", color: "#2d3748" }}>
                  Submit Your Listing
                </Text>

                <TouchableOpacity
                  onPress={() => setCalendarVisible(!calendarVisible)}
                  style={{ backgroundColor: "#edf2f7", paddingVertical: 12, paddingHorizontal: 16, borderRadius: 50, marginBottom: 24 }}
                >
                  <Text style={{ color: "#2d3748", textAlign: "center" }}>
                    {calendarVisible ? "Hide Calendar" : "Show Calendar"}
                  </Text>
                </TouchableOpacity>

                {calendarVisible && (
                  <Calendar
                    onDayPress={onDayPress}
                    markedDates={selectedDates}
                    markingType={"multi-dot"}
                    style={{ marginBottom: 24 }}
                  />
                )}

                <Formik
                  initialValues={{
                    airplaneModel: "",
                    description: "",
                    location: "",
                    ratesPerHour: "",
                    minimumHours: "",
                  }}
                  onSubmit={onSubmitMethod}
                >
                  {({ handleChange, handleBlur, handleSubmit, values }) => (
                    <>
                      <TextInput
                        placeholder="Aircraft Make/Model"
                        onChangeText={handleChange("airplaneModel")}
                        onBlur={handleBlur("airplaneModel")}
                        value={values.airplaneModel || ""}
                        style={{ borderBottomWidth: 1, borderBottomColor: "#cbd5e0", marginBottom: 16, padding: 8, color: "#2d3748" }}
                      />
                      <TextInput
                        placeholder="Description"
                        onChangeText={handleChange("description")}
                        onBlur={handleBlur("description")}
                        value={values.description || ""}
                        multiline
                        style={{ borderBottomWidth: 1, borderBottomColor: "#cbd5e0", marginBottom: 16, padding: 8, color: "#2d3748" }}
                      />
                      <TextInput
                        placeholder="Location (City, State)"
                        onChangeText={handleChange("location")}
                        onBlur={handleBlur("location")}
                        value={values.location || ""}
                        style={{ borderBottomWidth: 1, borderBottomColor: "#cbd5e0", marginBottom: 16, padding: 8, color: "#2d3748" }}
                      />
                      <TextInput
                        placeholder="Rates Per Hour ($)"
                        onChangeText={(text) =>
                          handleInputChange("ratesPerHour", text)
                        }
                        onBlur={handleBlur("ratesPerHour")}
                        value={profileData.ratesPerHour || ""}
                        keyboardType="default"
                        style={{ borderBottomWidth: 1, borderBottomColor: "#cbd5e0", marginBottom: 16, padding: 8, color: "#2d3748" }}
                      />
                      <TextInput
                        placeholder="Minimum Hour Requirement"
                        onChangeText={handleChange("minimumHours")}
                        onBlur={handleBlur("minimumHours")}
                        value={values.minimumHours || ""}
                        keyboardType="numeric"
                        style={{ borderBottomWidth: 1, borderBottomColor: "#cbd5e0", marginBottom: 16, padding: 8, color: "#2d3748" }}
                      />

                      <TouchableOpacity
                        onPress={() =>
                          handleInputChange(
                            "boostListing",
                            !profileData.boostListing
                          )
                        }
                        style={{ flexDirection: "row", alignItems: "center", backgroundColor: "#d69e2e", paddingVertical: 12, paddingHorizontal: 16, borderRadius: 50, marginBottom: 16 }}
                      >
                        <FontAwesome name="dollar" size={24} color="black" />
                        <Text style={{ marginLeft: 8, color: "#2d3748" }}>
                          {profileData.boostListing
                            ? "Boost Selected ($50)"
                            : "Boost Your Listing ($50)"}
                        </Text>
                      </TouchableOpacity>

                      <Text style={{ marginBottom: 8, marginTop: 24, color: "#2d3748", fontWeight: "bold" }}>
                        Upload Images
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
                        style={{ marginBottom: 16 }}
                      />
                      <TouchableOpacity
                        onPress={pickImage}
                        style={{ backgroundColor: "#edf2f7", paddingVertical: 12, paddingHorizontal: 16, borderRadius: 50, marginTop: 8, marginBottom: 16 }}
                      >
                        <Text style={{ color: "#2d3748", textAlign: "center" }}>
                          {images.length >= 7
                            ? "Maximum 7 Images"
                            : "Add Image"}
                        </Text>
                      </TouchableOpacity>

                      <Text style={{ marginBottom: 8, marginTop: 24, color: "#2d3748", fontWeight: "bold" }}>
                        Uploaded PDF Documents
                      </Text>
                      {currentAnnualPdf && (
                        <Text style={{ color: "#4a5568" }}>
                          Proof of Current Annual:{" "}
                          {currentAnnualPdf.split("/").pop()}
                        </Text>
                      )}
                      {insurancePdf && (
                        <Text style={{ color: "#4a5568" }}>
                          Proof of Insurance: {insurancePdf.split("/").pop()}
                        </Text>
                      )}

                      <TouchableOpacity
                        onPress={pickDocument}
                        style={{ backgroundColor: "#edf2f7", paddingVertical: 12, paddingHorizontal: 16, borderRadius: 50, marginTop: 8, marginBottom: 16 }}
                      >
                        <Text style={{ color: "#2d3748", textAlign: "center" }}>
                          Upload PDF Document (Proof of Current Annual)
                        </Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        onPress={pickInsuranceDocument}
                        style={{ backgroundColor: "#edf2f7", paddingVertical: 12, paddingHorizontal: 16, borderRadius: 50, marginTop: 8, marginBottom: 16 }}
                      >
                        <Text style={{ color: "#2d3748", textAlign: "center" }}>
                          Upload PDF Document (Proof of Insurance)
                        </Text>
                      </TouchableOpacity>

                      {loading ? (
                        <ActivityIndicator size="large" color="#FF5A5F" />
                      ) : (
                        <TouchableOpacity
                          onPress={handleSubmit}
                          style={{ backgroundColor: "#e53e3e", paddingVertical: 16, paddingHorizontal: 24, borderRadius: 50 }}
                        >
                          <Text style={{ color: "white", textAlign: "center", fontWeight: "bold" }}>
                            Submit Listing
                          </Text>
                        </TouchableOpacity>
                      )}
                    </>
                  )}
                </Formik>

                <TouchableOpacity
                  onPress={() => setFormVisible(false)}
                  style={{ marginTop: 24, paddingVertical: 12, borderRadius: 50, backgroundColor: "#e2e8f0" }}
                >
                  <Text style={{ color: "#2d3748", textAlign: "center", fontWeight: "bold" }}>
                    Cancel
                  </Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      {/* Rental Request Modal */}
      <Modal
        visible={rentalRequestModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setRentalRequestModalVisible(false)}
      >
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "rgba(0, 0, 0, 0.5)" }}>
          <View style={{ backgroundColor: "white", borderRadius: 24, padding: 24, width: "100%", maxWidth: 320, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 8 }}>
            <Text style={{ fontSize: 24, fontWeight: "bold", marginBottom: 24, textAlign: "center", color: "#2d3748" }}>
              Rental Request
            </Text>
            {rentalRequests.length > 0 ? (
              rentalRequests.map((request) => (
                <View key={request.id} style={{ marginBottom: 16 }}>
                  <Text style={{ fontSize: 18, marginBottom: 8 }}>
                    Renter: {request.renterName}
                  </Text>
                  <Text style={{ fontSize: 18, marginBottom: 8 }}>
                    Aircraft: {request.airplaneModel}
                  </Text>
                  <Text style={{ fontSize: 18, marginBottom: 8 }}>
                    Total Cost: ${request.totalCost}
                  </Text>
                  <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 16 }}>
                    <TouchableOpacity
                      onPress={() => handleApproveRentalRequest(request)}
                      style={{ backgroundColor: "#48bb78", paddingVertical: 12, paddingHorizontal: 24, borderRadius: 50 }}
                    >
                      <Text style={{ color: "white", textAlign: "center", fontWeight: "bold" }}>Approve</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => handleDenyRentalRequest(request)}
                      style={{ backgroundColor: "#e53e3e", paddingVertical: 12, paddingHorizontal: 24, borderRadius: 50 }}
                    >
                      <Text style={{ color: "white", textAlign: "center", fontWeight: "bold" }}>Deny</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))
            ) : (
              <Text style={{ color: "#4a5568", textAlign: "center" }}>
                No rental requests available.
              </Text>
            )}
            <TouchableOpacity
              onPress={() => setRentalRequestModalVisible(false)}
              style={{ marginTop: 24, paddingVertical: 12, borderRadius: 50, backgroundColor: "#e2e8f0" }}
            >
              <Text style={{ color: "#2d3748", textAlign: "center", fontWeight: "bold" }}>
                Cancel
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
};

export default OwnerProfile;
