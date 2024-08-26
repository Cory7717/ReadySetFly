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
import { db } from "../../firebaseConfig";
import PropellerImage from "../../Assets/images/wingtip_clouds.jpg";
import { Formik } from "formik";
import { Calendar } from "react-native-calendars";
import * as ImagePicker from "expo-image-picker";
import * as DocumentPicker from "expo-document-picker";
import { getStorage, ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { collection, addDoc } from "firebase/firestore";
import { FontAwesome } from "@expo/vector-icons";

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
    // Fetch data functions...

    if (ownerId) {
      // Fetch profile data, orders, rental history, and user listings...
    }
  }, [ownerId, currentOrders.length, userListings.length]);

  const handleInputChange = (name, value) => {
    setProfileData((prev) => ({ ...prev, [name]: value }));
  };

  const pickImage = async () => {
    // Image picker logic...
  };

  const pickDocument = async () => {
    // Document picker logic...
  };

  const pickInsuranceDocument = async () => {
    // Insurance document picker logic...
  };

  const onDayPress = (day) => {
    // Handle day press logic for calendar...
  };

  const onSubmitMethod = async (values) => {
    setLoading(true);
    // Submit method logic...
  };

  const handleEditListing = (listing) => {
    Alert.alert("Edit functionality is not yet implemented.");
  };

  const handleDeleteListing = async (listingId) => {
    // Handle delete listing logic...
  };

  const completeRentalTransaction = async (listing, renterDetails) => {
    // Complete rental transaction logic...
  };

  const handleRating = async (orderId, rating) => {
    // Handle rating logic...
  };

  return (
    <SafeAreaView className="flex-1 bg-white">
      {/* Header with Background Image */}
      <ImageBackground
        source={PropellerImage} // Use the imported image as background
        style={{
          height: 187.5,
          justifyContent: "flex-start",
          paddingTop: 10,
          paddingHorizontal: 10,
        }}
        imageStyle={{ resizeMode: "cover" }}
      >
        <View className="flex-row justify-between items-center">
          <View>
            <Text className="text-sm text-white">Good Morning,</Text>
            <Text className="text-lg font-bold text-white">{user?.fullName}</Text>
          </View>

          {/* Submit Your Listing Button Positioned at Top Right */}
          <TouchableOpacity
            onPress={() => setFormVisible(true)} // Open the submit your listing modal
            style={{
              padding: 10,
              borderRadius: 25,
              backgroundColor: 'rgba(255, 255, 255, 0.7)',
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.8,
              shadowRadius: 2,
              elevation: 5,
            }}
          >
            <Text className="text-gray-900 font-bold">Submit Your Listing</Text>
          </TouchableOpacity>
        </View>
      </ImageBackground>

      <ScrollView contentContainerStyle={{ padding: 16 }}>
        {/* Listings Section */}
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

        {/* Current Rental Orders Section */}
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

        {/* Rental History Section */}
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
      </ScrollView>

      {/* Submit Your Listing Modal */}
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
    </SafeAreaView>
  );
};

export default OwnerProfile;
