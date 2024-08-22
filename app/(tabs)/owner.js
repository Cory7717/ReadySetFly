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
import { db } from "../../firebaseConfig";  // Ensure this is correctly imported
import wingtipClouds from "../../Assets/images/wingtip_clouds.jpg";  // Import background image

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
    minimumHours: "",  // Added for minimum hour requirement
    boostListing: false, // Added for boosting the listing
  });
  const [images, setImages] = useState([]);
  const [pdfDocuments, setPdfDocuments] = useState([]);
  const [insuranceDocuments, setInsuranceDocuments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedDates, setSelectedDates] = useState({});
  const [formVisible, setFormVisible] = useState(false);
  const [calendarVisible, setCalendarVisible] = useState(false);  // Added calendarVisible state
  const [currentOrders, setCurrentOrders] = useState([]);
  const [rentalHistory, setRentalHistory] = useState([]);
  const [userListings, setUserListings] = useState([]);  // State to hold user's listings
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
  }, [ownerId, currentOrders.length, userListings.length]); // Added userListings.length to the dependency array

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
      delete newDates[dateString]; // deselect the date
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
        ratesPerHour: values.ratesPerHour.replace(/^\$/, ""),  // Remove any leading dollar signs
        userEmail: user.primaryEmailAddress.emailAddress,
        images: imageUrls,
        documents: documentUrls,
        insuranceDocuments: insuranceDocumentUrls,
        availableDates: Object.keys(selectedDates),
        boostListing: profileData.boostListing,  // Include the boost listing option
        minimumHours: values.minimumHours, // Added minimum hours to the listing
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
    // Logic to edit the listing
    // You can repurpose the submit form for editing by populating it with the selected listing's details
    Alert.alert("Edit functionality is not yet implemented.");
  };

  const handleDeleteListing = async (listingId) => {
    try {
      await deleteDoc(doc(db, "airplanes", listingId));
      Alert.alert("Listing Deleted", "Your listing has been deleted.");
      setUserListings(userListings.filter((listing) => listing.id !== listingId)); // Remove the listing from the local state
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

  return (
    <ImageBackground
      source={wingtipClouds}
      className="flex-1"
      resizeMode="cover"
    >
      <SafeView className="flex-1 mt-5">
        <ScrollContainer contentContainerStyle={{ padding: 16 }}>
          {/* User Header */}
          <View className="flex items-center mb-4">
            <Image
              source={{ uri: user?.profileImageUrl || user?.imageUrl }}
              className="w-16 h-16 rounded-full"
            />
            <Text className="text-xl font-bold mt-2 text-white">{user?.fullName}</Text>
          </View>

          {/* Toggle Form Button */}
          <TouchableOpacity
            onPress={() => setFormVisible(!formVisible)}
            className="bg-blue-500 p-2 rounded-lg mb-4"
          >
            <Text className="text-white text-center">
              {formVisible ? "Hide Form" : "Submit Your Listing"}
            </Text>
          </TouchableOpacity>

          {/* Form View */}
          {formVisible && (
            <KeyboardAvoidingView
              behavior={Platform.OS === "ios" ? "padding" : "height"}
              className="flex-1 justify-center items-center"
            >
              <View className="bg-white rounded-lg p-6 w-full max-w-lg shadow-lg">
                <Text className="text-2xl font-bold mb-4 text-center">
                  Submit Your Listing
                </Text>

                {/* Calendar Toggle Button */}
                <TouchableOpacity
                  onPress={() => setCalendarVisible(!calendarVisible)}
                  className="bg-gray-300 p-2 rounded-lg mb-4"
                >
                  <Text className="text-center text-black">
                    {calendarVisible ? "Hide Calendar" : "Show Calendar"}
                  </Text>
                </TouchableOpacity>

                {/* Calendar View */}
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
                    minimumHours: "", // Added for minimum hour requirement
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
                          return <Picker.Item label={year.toString()} value={year.toString()} key={index} />;
                        })}
                      </Picker>

                      <TextInput
                        placeholder="Aircraft Make/Model"
                        onChangeText={handleChange("airplaneModel")}
                        onBlur={handleBlur("airplaneModel")}
                        value={values.airplaneModel}
                        className="border-b border-gray-300 mb-4 p-2"
                      />
                      <TextInput
                        placeholder="Description"
                        onChangeText={handleChange("description")}
                        onBlur={handleBlur("description")}
                        value={values.description}
                        multiline
                        numberOfLines={4}
                        className="border-b border-gray-300 mb-4 p-2"
                      />
                      <TextInput
                        placeholder="Location (City, State)"
                        onChangeText={handleChange("location")}
                        onBlur={handleBlur("location")}
                        value={values.location}
                        className="border-b border-gray-300 mb-4 p-2"
                      />
                      <TextInput
                        placeholder="Rates Per Hour ($)"
                        onChangeText={(text) => handleInputChange('ratesPerHour', text)}
                        onBlur={handleBlur("ratesPerHour")}
                        value={profileData.ratesPerHour}  // Use profileData to ensure the correct value is displayed
                        keyboardType="default"  // Allow dollar sign and punctuation
                        className="border-b border-gray-300 mb-4 p-2"
                      />

                      {/* Minimum Hours Requirement */}
                      <TextInput
                        placeholder="Minimum Hour Requirement"
                        onChangeText={handleChange("minimumHours")}
                        onBlur={handleBlur("minimumHours")}
                        value={values.minimumHours}
                        keyboardType="numeric"
                        className="border-b border-gray-300 mb-4 p-2"
                      />

                      {/* Boost Listing Option */}
                      <TouchableOpacity
                        onPress={() => handleInputChange('boostListing', !profileData.boostListing)}
                        className="flex-row items-center bg-yellow-400 p-2 rounded-lg mb-4"
                      >
                        <FontAwesome name="dollar" size={24} color="black" />
                        <Text className="ml-2">
                          {profileData.boostListing ? "Boost Selected ($50)" : "Boost Your Listing ($50)"}
                        </Text>
                      </TouchableOpacity>

                      <Text className="mb-2 mt-4">Upload Images</Text>
                      <FlatList
                        data={images}
                        horizontal
                        renderItem={({ item, index }) => (
                          <Image
                            key={index}
                            source={{ uri: item }}
                            className="w-20 h-20 mr-2 rounded-lg"
                          />
                        )}
                        keyExtractor={(item, index) => index.toString()}
                      />
                      <TouchableOpacity
                        onPress={pickImage}
                        className="bg-gray-300 p-2 rounded-lg mt-2 mb-4"
                      >
                        <Text className="text-center text-black">
                          {images.length >= 7 ? "Maximum 7 Images" : "Add Image"}
                        </Text>
                      </TouchableOpacity>

                      {/* Upload PDF Documents - Proof of Current Annual */}
                      <TouchableOpacity
                        onPress={pickDocument}
                        className="bg-gray-300 p-2 rounded-lg mt-2 mb-4"
                      >
                        <Text className="text-center text-black">
                          Upload PDF Document (Proof of Current Annual)
                        </Text>
                      </TouchableOpacity>

                      {/* Upload PDF Documents - Proof of Insurance */}
                      <TouchableOpacity
                        onPress={pickInsuranceDocument}
                        className="bg-gray-300 p-2 rounded-lg mt-2 mb-4"
                      >
                        <Text className="text-center text-black">
                          Upload PDF Document (Proof of Insurance)
                        </Text>
                      </TouchableOpacity>

                      {loading ? (
                        <ActivityIndicator size="large" color="#0000ff" />
                      ) : (
                        <TouchableOpacity
                          onPress={handleSubmit}
                          className="bg-blue-500 p-2 rounded-lg"
                        >
                          <Text className="text-white text-center">Submit Listing</Text>
                        </TouchableOpacity>
                      )}
                    </>
                  )}
                </Formik>
              </View>
            </KeyboardAvoidingView>
          )}

          {/* User's Listings */}
          <View className="mt-4">
            <Text className="text-2xl font-bold mb-2 text-white">Your Listings</Text>
            {userListings.length > 0 ? (
              userListings.map((listing) => (
                <View key={listing.id} className="bg-gray-100 p-4 rounded-lg mb-2">
                  <Text className="font-bold">{listing.airplaneModel}</Text>
                  <Text>{listing.description}</Text>
                  <Text>{listing.location}</Text>
                  <Text>{listing.ratesPerHour}</Text>
                  <View className="flex-row justify-between mt-4">
                    <TouchableOpacity
                      onPress={() => handleEditListing(listing)}
                      className="bg-green-500 p-2 rounded-lg"
                    >
                      <Text className="text-white text-center">Edit</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => handleDeleteListing(listing.id)}
                      className="bg-red-500 p-2 rounded-lg"
                    >
                      <Text className="text-white text-center">Delete</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))
            ) : (
              <Text className="text-white">No listings available.</Text>
            )}
          </View>

          {/* Current Rental Orders */}
          <View className="mt-4">
            <Text className="text-2xl font-bold mb-2 text-white">Current Rental Orders</Text>
            {currentOrders.length > 0 ? (
              currentOrders.map((order) => (
                <View key={order.id} className="bg-gray-100 p-4 rounded-lg mb-2">
                  <Text className="font-bold">{order.airplaneModel}</Text>
                  <Text>{order.rentalPeriod}</Text>
                  <Text>{order.renterName}</Text>
                </View>
              ))
            ) : (
              <Text className="text-white">No current orders.</Text>
            )}
          </View>

          {/* Rental History */}
          <View className="mt-4">
            <Text className="text-2xl font-bold mb-2 text-white">Rental History</Text>
            {rentalHistory.length > 0 ? (
              rentalHistory.map((order) => (
                <View key={order.id} className="bg-gray-100 p-4 rounded-lg mb-2">
                  <Text className="font-bold">{order.airplaneModel}</Text>
                  <Text>{order.rentalPeriod}</Text>
                  <Text>{order.renterName}</Text>
                </View>
              ))
            ) : (
              <Text className="text-white">No rental history.</Text>
            )}
          </View>
        </ScrollContainer>
      </SafeView>
    </ImageBackground>
  );
};

export default OwnerProfile;
