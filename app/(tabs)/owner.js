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
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useUser } from "@clerk/clerk-expo";
import { getFirestore, collection, addDoc, getDoc, doc, getDocs, query, where, updateDoc, deleteDoc } from "firebase/firestore";
import * as ImagePicker from "expo-image-picker";
import * as DocumentPicker from "expo-document-picker";
import { Picker } from "@react-native-picker/picker";
import { styled } from "nativewind";
import { Formik } from "formik";
import { getDownloadURL, getStorage, ref, uploadBytes } from "firebase/storage";
import { Calendar } from "react-native-calendars";
import { FontAwesome } from "@expo/vector-icons";
import { db } from "../../firebaseConfig";
import wingtipClouds from "../../Assets/images/wingtip_clouds.jpg";

const SafeView = styled(SafeAreaView);
const ScrollContainer = styled(ScrollView);
const WrapperView = styled(View);
const TouchableButton = styled(TouchableOpacity);
const StyledText = styled(Text);
const StyledImage = styled(Image);
const StyledTextInput = styled(TextInput);

const OwnerProfile = ({ ownerId }) => {
  const [profileData, setProfileData] = useState({
    airplaneName: "",
    airplaneModel: "",
    location: "",
    airplaneYear: "",
    description: "",
    profileImage: null,
    aircraftImages: [],
    ratesPerHour: "",
    minimumHours: "",
    boostListing: false,
  });
  const [images, setImages] = useState([]);
  const [pdfDocuments, setPdfDocuments] = useState([]);
  const [insuranceDocuments, setInsuranceDocuments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedDates, setSelectedDates] = useState({});
  const [formVisible, setFormVisible] = useState(false);
  const [calendarVisible, setCalendarVisible] = useState(false);
  const [currentOrders, setCurrentOrders] = useState([]);
  const [rentalHistory, setRentalHistory] = useState([]);
  const [userListings, setUserListings] = useState([]);
  const [ratings, setRatings] = useState({});
  const { user } = useUser();
  const storage = getStorage();

  useEffect(() => {
    const fetchProfileData = async () => {
      const ownerDocRef = doc(db, "owners", ownerId);
      const ownerDoc = await getDoc(ownerDocRef);

      if (ownerDoc.exists()) {
        setProfileData({ ...profileData, ...ownerDoc.data() });
      }
    };

    const fetchOrders = async () => {
      const ordersRef = collection(db, "orders");
      const q = query(ordersRef, where("ownerId", "==", ownerId), where("status", "==", "active"));
      const querySnapshot = await getDocs(q);
      const activeOrders = [];
      querySnapshot.forEach((doc) => {
        activeOrders.push({ id: doc.id, ...doc.data() });
      });
      setCurrentOrders(activeOrders);
    };

    const fetchRentalHistory = async () => {
      const historyRef = collection(db, "orders");
      const q = query(historyRef, where("ownerId", "==", ownerId), where("status", "==", "completed"));
      const querySnapshot = await getDocs(q);
      const history = [];
      querySnapshot.forEach((doc) => {
        history.push({ id: doc.id, ...doc.data() });
      });
      setRentalHistory(history);
    };

    const fetchUserListings = async () => {
      const listingsRef = collection(db, "airplanes");
      const q = query(listingsRef, where("userEmail", "==", user.primaryEmailAddress.emailAddress));
      const querySnapshot = await getDocs(q);
      const listings = [];
      querySnapshot.forEach((doc) => {
        listings.push({ id: doc.id, ...doc.data() });
      });
      setUserListings(listings);
    };

    if (ownerId) {
      fetchProfileData();
      fetchOrders();
      fetchRentalHistory();
      fetchUserListings();
    }
  }, [ownerId, currentOrders.length, userListings.length]);

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
      setPdfDocuments([...pdfDocuments, result.uri]);
    }
  };

  const pickInsuranceDocument = async () => {
    const result = await DocumentPicker.getDocumentAsync({
      type: "application/pdf",
    });

    if (result.type === "success") {
      setInsuranceDocuments([...insuranceDocuments, result.uri]);
    }
  };

  const onDayPress = (day) => {
    const { dateString } = day;
    const newDates = { ...selectedDates };
    if (newDates[dateString]) {
      delete newDates[dateString];
    } else {
      newDates[dateString] = { selected: true, marked: true };
    }
    setSelectedDates(newDates);
  };

  const onSubmitMethod = async (values) => {
    setLoading(true);

    try {
      const imageUrls = [];
      for (const img of images) {
        const resp = await fetch(img);
        const blob = await resp.blob();
        const storageRef = ref(storage, `airplane_listings/${Date.now()}_${img}`);
        await uploadBytes(storageRef, blob);
        const downloadUrl = await getDownloadURL(storageRef);
        imageUrls.push(downloadUrl);
      }

      const documentUrls = [];
      for (const docUri of pdfDocuments) {
        const resp = await fetch(docUri);
        const blob = await resp.blob();
        const storageRef = ref(storage, `airplane_documents/${Date.now()}_${docUri.split('/').pop()}`);
        await uploadBytes(storageRef, blob);
        const downloadUrl = await getDownloadURL(storageRef);
        documentUrls.push(downloadUrl);
      }

      const insuranceDocumentUrls = [];
      for (const insDocUri of insuranceDocuments) {
        const resp = await fetch(insDocUri);
        const blob = await resp.blob();
        const storageRef = ref(storage, `airplane_documents/${Date.now()}_${insDocUri.split('/').pop()}`);
        await uploadBytes(storageRef, blob);
        const downloadUrl = await getDownloadURL(storageRef);
        insuranceDocumentUrls.push(downloadUrl);
      }

      const newListing = {
        ...values,
        ratesPerHour: values.ratesPerHour.replace(/^\$/, ""),
        userEmail: user.primaryEmailAddress.emailAddress,
        images: imageUrls,
        documents: documentUrls,
        insuranceDocuments: insuranceDocumentUrls,
        availableDates: Object.keys(selectedDates),
        boostListing: profileData.boostListing,
        minimumHours: values.minimumHours,
      };

      await addDoc(collection(db, "airplanes"), newListing);
      setLoading(false);
      Alert.alert("Success", "Aircraft listing created successfully!");
    } catch (error) {
      console.error("Error creating listing: ", error);
      Alert.alert("Error", "Failed to create listing.");
      setLoading(false);
    }
  };

  const handleEditListing = (listing) => {
    Alert.alert("Edit functionality is not yet implemented.");
  };

  const handleDeleteListing = async (listingId) => {
    try {
      await deleteDoc(doc(db, "airplanes", listingId));
      Alert.alert("Listing Deleted", "Your listing has been deleted.");
      setUserListings(userListings.filter((listing) => listing.id !== listingId));
    } catch (error) {
      console.error("Error deleting listing: ", error);
      Alert.alert("Error", "Failed to delete listing.");
    }
  };

  const completeRentalTransaction = async (listing, renterDetails) => {
    try {
      const rentalOrder = {
        ownerId: listing.ownerId,
        airplaneModel: listing.airplaneModel,
        rentalPeriod: renterDetails.rentalPeriod,
        renterName: renterDetails.name,
        status: "active",
        createdAt: new Date(),
      };

      await addDoc(collection(db, "orders"), rentalOrder);
      Alert.alert("Success", "Rental transaction completed successfully!");
    } catch (error) {
      console.error("Error completing transaction: ", error);
      Alert.alert("Error", "Failed to complete the transaction.");
    }
  };

  const handleRating = async (orderId, rating) => {
    try {
      const orderDocRef = doc(db, "orders", orderId);
      await updateDoc(orderDocRef, { rating });
      setRatings((prevRatings) => ({ ...prevRatings, [orderId]: rating }));
      Alert.alert("Rating Submitted", "Thank you for your feedback!");
    } catch (error) {
      console.error("Error submitting rating: ", error);
      Alert.alert("Error", "Failed to submit rating.");
    }
  };

  return (
    <SafeView className="flex-1 bg-white">
      <ScrollContainer contentContainerStyle={{ padding: 16 }}>
        <View className="flex items-center mb-6">
          <Image
            source={{ uri: user?.profileImageUrl || user?.imageUrl }}
            className="w-20 h-20 rounded-full"
          />
          <Text className="text-2xl font-bold mt-2 text-gray-900">{user?.fullName}</Text>
        </View>

        <TouchableOpacity
          onPress={() => setFormVisible(!formVisible)}
          className="bg-red-500 py-3 px-6 rounded-full mb-4"
        >
          <Text className="text-white text-center font-bold">
            {formVisible ? "Hide Form" : "Submit Your Listing"}
          </Text>
        </TouchableOpacity>

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
                      style={{ marginBottom: 10 }}
                    />
                  )}

                  <Formik
                    initialValues={{
                      airplaneYear: "",
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
                        <Picker
                          selectedValue={values.airplaneYear}
                          onValueChange={handleChange("airplaneYear")}
                          className="border-b border-gray-300 mb-4 p-2"
                        >
                          <Picker.Item label="Select Airplane Year" value="" />
                          {[...Array(75).keys()].map((_, index) => {
                            const year = new Date().getFullYear() - index;
                            return (
                              <Picker.Item
                                label={year.toString()}
                                value={year.toString()}
                                key={index}
                              />
                            );
                          })}
                        </Picker>

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
                          numberOfLines={4}
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
                          onChangeText={(text) => handleInputChange("ratesPerHour", text)}
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
                            handleInputChange("boostListing", !profileData.boostListing)
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

                        <Text className="mb-2 mt-4 text-gray-900 font-bold">Upload Images</Text>
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
                            {images.length >= 7 ? "Maximum 7 Images" : "Add Image"}
                          </Text>
                        </TouchableOpacity>

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

        <View className="mt-8">
          <Text className="text-2xl font-bold mb-4 text-gray-900">Your Listings</Text>
          {userListings.length > 0 ? (
            userListings.map((listing) => (
              <View key={listing.id} className="bg-gray-100 p-4 rounded-2xl mb-4">
                <Text className="font-bold text-lg text-gray-900">{listing.airplaneModel}</Text>
                <Text className="text-gray-700">{listing.description}</Text>
                <Text className="text-gray-700">{listing.location}</Text>
                <Text className="text-red-500 font-bold">{listing.ratesPerHour}</Text>
                <View className="flex-row justify-between mt-4">
                  <TouchableOpacity
                    onPress={() => handleEditListing(listing)}
                    className="bg-green-500 py-2 px-4 rounded-full"
                  >
                    <Text className="text-white text-center">Edit</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => handleDeleteListing(listing.id)}
                    className="bg-red-500 py-2 px-4 rounded-full"
                  >
                    <Text className="text-white text-center">Delete</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))
          ) : (
            <Text className="text-gray-700">No listings available.</Text>
          )}
        </View>

        <View className="mt-8">
          <Text className="text-2xl font-bold mb-4 text-gray-900">Current Rental Orders</Text>
          {currentOrders.length > 0 ? (
            currentOrders.map((order) => (
              <View key={order.id} className="bg-gray-100 p-4 rounded-2xl mb-4">
                <Text className="font-bold text-lg text-gray-900">{order.airplaneModel}</Text>
                <Text className="text-gray-700">{order.rentalPeriod}</Text>
                <Text className="text-gray-700">{order.renterName}</Text>
              </View>
            ))
          ) : (
            <Text className="text-gray-700">No current orders.</Text>
          )}
        </View>

        <View className="mt-8">
          <Text className="text-2xl font-bold mb-4 text-gray-900">Rental History</Text>
          {rentalHistory.length > 0 ? (
            rentalHistory.map((order) => (
              <View key={order.id} className="bg-gray-100 p-4 rounded-2xl mb-4">
                <Text className="font-bold text-lg text-gray-900">{order.airplaneModel}</Text>
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
                          name={star <= (ratings[order.id] || 0) ? "star" : "star-o"}
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
            <Text className="text-gray-700">No rental history.</Text>
          )}
        </View>
      </ScrollContainer>
    </SafeView>
  );
};

export default OwnerProfile;
