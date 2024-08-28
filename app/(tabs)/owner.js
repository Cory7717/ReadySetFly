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
  doc,
  setDoc,
  onSnapshot,
  updateDoc,
} from "firebase/firestore";
import { FontAwesome, Ionicons } from "@expo/vector-icons";
import wingtipClouds from "../../Assets/images/wingtip_clouds.jpg";
import { useStripe } from '@stripe/stripe-react-native';

const OwnerProfile = ({ ownerId, navigation }) => {
  const [profileData, setProfileData] = useState({
    airplaneModel: "",
    description: "",
    location: "",
    ratesPerHour: "",
    minimumHours: "",
    boostListing: false,
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
  const [messages, setMessages] = useState([]);
  const [messageModalVisible, setMessageModalVisible] = useState(false);
  const [newMessage, setNewMessage] = useState("");
  const [rentalRequests, setRentalRequests] = useState([]);
  const [rentalRequestModalVisible, setRentalRequestModalVisible] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const { user } = useUser();
  const storage = getStorage();
  const stripe = useStripe();

  useEffect(() => {
    if (ownerId) {
      const messagesRef = collection(db, "owners", ownerId, "messages");
      const unsubscribeMessages = onSnapshot(messagesRef, (snapshot) => {
        const messagesData = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        setMessages(messagesData);
      });

      const rentalRequestsRef = collection(db, "owners", ownerId, "rentalRequests");
      const unsubscribeRequests = onSnapshot(rentalRequestsRef, (snapshot) => {
        const requestsData = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        setRentalRequests(requestsData);
      });

      return () => {
        unsubscribeMessages();
        unsubscribeRequests();
      };
    }
  }, [ownerId]);

  const handleInputChange = (name, value) => {
    setProfileData((prev) => ({ ...prev, [name]: value }));
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
      setImages([...images, result.uri]);
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
    const response = await fetch(uri);
    const blob = await response.blob();
    const filename = uri.substring(uri.lastIndexOf("/") + 1);
    const storageRef = ref(storage, `${folder}/${filename}`);
    await uploadBytes(storageRef, blob);
    return await getDownloadURL(storageRef);
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
        : null;
      const insuranceProofURL = insurancePdf
        ? await uploadFile(insurancePdf, "documents")
        : null;

      const newListing = {
        ...values,
        images: uploadedImages,
        currentAnnualPdf: annualProofURL,
        insurancePdf: insuranceProofURL,
        ownerId: user.id,
        createdAt: new Date(),
        boosted: profileData.boostListing,
      };

      await addDoc(collection(db, "airplanes"), newListing);

      // Posting the listing directly to the Home screen
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
      Alert.alert(
        "Error",
        `There was an error submitting your listing: ${error.message}`
      );
    } finally {
      setLoading(false);
    }
  };

  const handleSendMessage = async () => {
    if (newMessage.trim() === "") {
      Alert.alert("Message is empty", "Please enter a message to send.");
      return;
    }

    try {
      const messageData = {
        senderId: user.id,
        senderName: user.fullName,
        message: newMessage,
        createdAt: new Date(),
      };

      await addDoc(collection(db, "owners", ownerId, "messages"), messageData);

      setNewMessage("");
      setMessageModalVisible(false);
      Alert.alert("Message Sent", "Your message has been sent to the owner.");
    } catch (error) {
      console.error("Error sending message: ", error);
      Alert.alert(
        "Error",
        `There was an error sending your message: ${error.message}`
      );
    }
  };

  const handleApproveRentalRequest = async (request) => {
    try {
      const notificationRef = doc(db, "owners", ownerId, "rentalRequests", request.id);
      await updateDoc(notificationRef, { status: "approved" });

      // Process payment using Stripe
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

  return (
    <View className="flex-1 bg-white">
      <SafeAreaView className="bg-white">
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
          className="h-56"
          resizeMode="cover"
          style={{
            paddingTop: Platform.OS === "android" ? StatusBar.currentHeight : 0,
          }}
        >
          <View className="flex-row justify-between items-center p-4">
            <View>
              <Text className="text-sm text-white">Good Morning</Text>
              <Text className="text-lg font-bold text-white">
                {user?.fullName}
              </Text>
            </View>

            <TouchableOpacity
              onPress={() => setFormVisible(true)}
              className="bg-white bg-opacity-50 rounded-full px-4 py-2"
            >
              <Text className="text-gray-900 font-bold">
                Submit Your Listing
              </Text>
            </TouchableOpacity>
          </View>
        </ImageBackground>

        <View className="mt-8">
          <Text className="text-2xl font-bold mb-4 text-gray-900 text-center">
            Your Current Listings
          </Text>
          {userListings.length > 0 ? (
            userListings.map((listing) => (
              <View
                key={listing.id}
                className="bg-gray-100 p-4 rounded-2xl mb-4"
              >
                <Text className="font-bold text-lg text-gray-900">
                  {listing.airplaneModel}
                </Text>
                {listing.boosted && (
                  <Text className="text-yellow-600 font-bold">Sponsored Listing</Text>
                )}
                <Text className="text-gray-700">{listing.description}</Text>
                <Text className="text-gray-700">{listing.location}</Text>
                <Text className="text-red-500 font-bold">
                  ${listing.ratesPerHour} per hour
                </Text>
              </View>
            ))
          ) : (
            <Text className="text-gray-700 text-center">
              No listings available.
            </Text>
          )}
        </View>

        <View className="mt-8">
          <Text className="text-2xl font-bold mb-4 text-gray-900 text-center">
            Rental History
          </Text>
          {rentalHistory.length > 0 ? (
            rentalHistory.map((order) => (
              <View key={order.id} className="bg-gray-100 p-4 rounded-2xl mb-4">
                <Text className="font-bold text-lg text-gray-900">
                  {order.airplaneModel}
                </Text>
                <Text className="text-gray-700">{order.rentalPeriod}</Text>
                <Text className="text-gray-700">{order.renterName}</Text>
                <View className="flex-row justify-between items-center mt-4">
                  <Text className="text-gray-800">Rate this renter:</Text>
                  <View className="flex-row">
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
            <Text className="text-gray-700 text-center">
              No rental history.
            </Text>
          )}
        </View>
      </ScrollView>

      <View className="absolute bottom-10 left-0 right-0 items-center">
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
          <Text className="text-gray-900 font-bold">
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
        <View className="flex-1 justify-center items-center bg-black bg-opacity-50">
          <View className="bg-white rounded-3xl p-6 w-full max-w-lg shadow-xl">
            <Text className="text-2xl font-bold mb-6 text-center text-gray-900">
              Transfer Funds
            </Text>
            <TouchableOpacity
              onPress={() => setAchModalVisible(true)}
              className="bg-white bg-opacity-50 rounded-full px-4 py-2 mb-4 shadow-md"
            >
              <Text className="text-gray-900 font-bold">Transfer via ACH</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setDebitModalVisible(true)}
              className="bg-white bg-opacity-50 rounded-full px-4 py-2 mb-4 shadow-md"
            >
              <Text className="text-gray-900 font-bold">
                Transfer to Debit Card
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setTransferModalVisible(false)}
              className="bg-gray-200 py-2 rounded-full mt-4"
            >
              <Text className="text-center text-gray-800">Cancel</Text>
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
        <View className="flex-1 justify-center items-center bg-black bg-opacity-50">
          <View className="bg-white rounded-3xl p-6 w-full max-w-lg shadow-xl">
            <Text className="text-2xl font-bold mb-6 text-center text-gray-900">
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
                    value={values.bankAccountNumber}
                    className="border-b border-gray-300 mb-4 p-2 text-gray-900"
                    keyboardType="numeric"
                  />
                  <TextInput
                    placeholder="Bank Routing Number"
                    onChangeText={handleChange("bankRoutingNumber")}
                    onBlur={handleBlur("bankRoutingNumber")}
                    value={values.bankRoutingNumber}
                    className="border-b border-gray-300 mb-4 p-2 text-gray-900"
                    keyboardType="numeric"
                  />
                  <TouchableOpacity
                    onPress={handleSubmit}
                    className="bg-white bg-opacity-50 rounded-full px-4 py-2 mb-4 shadow-md"
                  >
                    <Text className="text-gray-900 font-bold text-center">
                      Submit
                    </Text>
                  </TouchableOpacity>
                </>
              )}
            </Formik>
            <TouchableOpacity
              onPress={() => setAchModalVisible(false)}
              className="bg-gray-200 py-2 rounded-full mt-4"
            >
              <Text className="text-center text-gray-800">Cancel</Text>
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
        <View className="flex-1 justify-center items-center bg-black bg-opacity-50">
          <View className="bg-white rounded-3xl p-6 w-full max-w-lg shadow-xl">
            <Text className="text-2xl font-bold mb-6 text-center text-gray-900">
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
                    value={values.cardNumber}
                    className="border-b border-gray-300 mb-4 p-2 text-gray-900"
                    keyboardType="numeric"
                  />
                  <TextInput
                    placeholder="Expiry Date (MM/YY)"
                    onChangeText={handleChange("cardExpiry")}
                    onBlur={handleBlur("cardExpiry")}
                    value={values.cardExpiry}
                    className="border-b border-gray-300 mb-4 p-2 text-gray-900"
                    keyboardType="numeric"
                  />
                  <TextInput
                    placeholder="CVC"
                    onChangeText={handleChange("cardCVC")}
                    onBlur={handleBlur("cardCVC")}
                    value={values.cardCVC}
                    className="border-b border-gray-300 mb-4 p-2 text-gray-900"
                    keyboardType="numeric"
                  />
                  <TouchableOpacity
                    onPress={handleSubmit}
                    className="bg-white bg-opacity-50 rounded-full px-4 py-2 mb-4 shadow-md"
                  >
                    <Text className="text-gray-900 font-bold text-center">
                      Submit
                    </Text>
                  </TouchableOpacity>
                </>
              )}
            </Formik>
            <TouchableOpacity
              onPress={() => setDebitModalVisible(false)}
              className="bg-gray-200 py-2 rounded-full mt-4"
            >
              <Text className="text-center text-gray-800">Cancel</Text>
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
        <View className="flex-1 justify-center items-center bg-black bg-opacity-50">
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : "height"}
            className="flex-1 justify-center items-center w-full"
          >
            <ScrollView className="w-full max-w-lg">
              <View className="bg-white rounded-3xl p-6 w-full shadow-xl">
                <Text className="text-2xl font-bold mb-6 text-center text-gray-900">
                  Submit Your Listing
                </Text>

                <TouchableOpacity
                  onPress={() => setCalendarVisible(!calendarVisible)}
                  className="bg-gray-100 py-2 px-4 rounded-full mb-6"
                >
                  <Text className="text-center text-gray-800">
                    {calendarVisible ? "Hide Calendar" : "Show Calendar"}
                  </Text>
                </TouchableOpacity>

                {calendarVisible && (
                  <Calendar
                    onDayPress={onDayPress}
                    markedDates={selectedDates}
                    markingType={"multi-dot"}
                    className="mb-4"
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
                        value={values.airplaneModel}
                        className="border-b border-gray-300 mb-4 p-2 text-gray-900"
                      />
                      <TextInput
                        placeholder="Description"
                        onChangeText={handleChange("description")}
                        onBlur={handleBlur("description")}
                        value={values.description}
                        multiline
                        className="border-b border-gray-300 mb-4 p-2 text-gray-900"
                      />
                      <TextInput
                        placeholder="Location (City, State)"
                        onChangeText={handleChange("location")}
                        onBlur={handleBlur("location")}
                        value={values.location}
                        className="border-b border-gray-300 mb-4 p-2 text-gray-900"
                      />
                      <TextInput
                        placeholder="Rates Per Hour ($)"
                        onChangeText={(text) =>
                          handleInputChange("ratesPerHour", text)
                        }
                        onBlur={handleBlur("ratesPerHour")}
                        value={profileData.ratesPerHour}
                        keyboardType="default"
                        className="border-b border-gray-300 mb-4 p-2 text-gray-900"
                      />
                      <TextInput
                        placeholder="Minimum Hour Requirement"
                        onChangeText={handleChange("minimumHours")}
                        onBlur={handleBlur("minimumHours")}
                        value={values.minimumHours}
                        keyboardType="numeric"
                        className="border-b border-gray-300 mb-4 p-2 text-gray-900"
                      />

                      <TouchableOpacity
                        onPress={() =>
                          handleInputChange(
                            "boostListing",
                            !profileData.boostListing
                          )
                        }
                        className="flex-row items-center bg-yellow-400 py-2 px-4 rounded-full mb-4"
                      >
                        <FontAwesome name="dollar" size={24} color="black" />
                        <Text className="ml-2 text-gray-800">
                          {profileData.boostListing
                            ? "Boost Selected ($50)"
                            : "Boost Your Listing ($50)"}
                        </Text>
                      </TouchableOpacity>

                      <Text className="mb-2 mt-4 text-gray-900 font-bold">
                        Upload Images
                      </Text>
                      <FlatList
                        data={images}
                        horizontal
                        renderItem={({ item, index }) => (
                          <Image
                            key={index}
                            source={{ uri: item }}
                            className="w-24 h-24 mr-2 rounded-lg"
                          />
                        )}
                        keyExtractor={(item, index) => index.toString()}
                      />
                      <TouchableOpacity
                        onPress={pickImage}
                        className="bg-gray-100 py-2 px-4 rounded-full mt-2 mb-4"
                      >
                        <Text className="text-center text-gray-800">
                          {images.length >= 7
                            ? "Maximum 7 Images"
                            : "Add Image"}
                        </Text>
                      </TouchableOpacity>

                      <Text className="mb-2 mt-4 text-gray-900 font-bold">
                        Uploaded PDF Documents
                      </Text>
                      {currentAnnualPdf && (
                        <Text className="text-gray-700">
                          Proof of Current Annual:{" "}
                          {currentAnnualPdf.split("/").pop()}
                        </Text>
                      )}
                      {insurancePdf && (
                        <Text className="text-gray-700">
                          Proof of Insurance: {insurancePdf.split("/").pop()}
                        </Text>
                      )}

                      <TouchableOpacity
                        onPress={pickDocument}
                        className="bg-gray-100 py-2 px-4 rounded-full mt-2 mb-4"
                      >
                        <Text className="text-center text-gray-800">
                          Upload PDF Document (Proof of Current Annual)
                        </Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        onPress={pickInsuranceDocument}
                        className="bg-gray-100 py-2 px-4 rounded-full mt-2 mb-4"
                      >
                        <Text className="text-center text-gray-800">
                          Upload PDF Document (Proof of Insurance)
                        </Text>
                      </TouchableOpacity>

                      {loading ? (
                        <ActivityIndicator size="large" color="#FF5A5F" />
                      ) : (
                        <TouchableOpacity
                          onPress={handleSubmit}
                          className="bg-red-500 py-3 px-6 rounded-full"
                        >
                          <Text className="text-white text-center font-bold">
                            Submit Listing
                          </Text>
                        </TouchableOpacity>
                      )}
                    </>
                  )}
                </Formik>

                <TouchableOpacity
                  onPress={() => setFormVisible(false)}
                  className="mt-4 py-2 rounded-full bg-gray-200"
                >
                  <Text className="text-center text-gray-800">Cancel</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      {/* Message Modal */}
      <Modal
        visible={messageModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setMessageModalVisible(false)}
      >
        <View className="flex-1 justify-center items-center bg-black bg-opacity-50">
          <View className="bg-white rounded-3xl p-6 w-full max-w-lg shadow-xl">
            <Text className="text-2xl font-bold mb-6 text-center text-gray-900">
              Send a Message to the Owner
            </Text>
            <TextInput
              placeholder="Type your message here"
              value={newMessage}
              onChangeText={(text) => setNewMessage(text)}
              multiline
              className="border-b border-gray-300 mb-4 p-2 text-gray-900"
            />
            <TouchableOpacity
              onPress={handleSendMessage}
              className="bg-blue-500 py-3 px-6 rounded-full"
            >
              <Text className="text-white text-center font-bold">
                Send Message
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setMessageModalVisible(false)}
              className="bg-gray-200 py-2 rounded-full mt-4"
            >
              <Text className="text-center text-gray-800">Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Rental Request Modal */}
      <Modal
        visible={rentalRequestModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setRentalRequestModalVisible(false)}
      >
        <View className="flex-1 justify-center items-center bg-black bg-opacity-50">
          <View className="bg-white rounded-3xl p-6 w-full max-w-lg shadow-xl">
            <Text className="text-2xl font-bold mb-6 text-center text-gray-900">
              Rental Request
            </Text>
            {selectedRequest && (
              <>
                <Text className="text-lg mb-2">
                  Renter: {selectedRequest.renterName}
                </Text>
                <Text className="text-lg mb-2">
                  Aircraft: {selectedRequest.airplaneModel}
                </Text>
                <Text className="text-lg mb-2">
                  Total Cost: ${selectedRequest.totalCost}
                </Text>
                <View className="flex-row justify-between mt-4">
                  <TouchableOpacity
                    onPress={() => handleApproveRentalRequest(selectedRequest)}
                    className="bg-green-500 p-3 rounded-lg"
                  >
                    <Text className="text-white text-center">Approve</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => handleDenyRentalRequest(selectedRequest)}
                    className="bg-red-500 p-3 rounded-lg"
                  >
                    <Text className="text-white text-center">Deny</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
            <TouchableOpacity
              onPress={() => setRentalRequestModalVisible(false)}
              className="bg-gray-200 py-2 rounded-full mt-4"
            >
              <Text className="text-center text-gray-800">Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
};

export default OwnerProfile;
