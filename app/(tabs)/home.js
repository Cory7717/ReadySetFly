import React, { useEffect, useState } from "react";
import {
  Text,
  View,
  TextInput,
  TouchableOpacity,
  FlatList,
  Modal,
  ImageBackground,
  ScrollView,
  Image,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useUser } from "@clerk/clerk-expo";
import { db } from "../../firebaseConfig";
import { collection, onSnapshot, query, orderBy, where, addDoc, updateDoc, doc } from "firebase/firestore";
import { Ionicons } from "@expo/vector-icons";
import wingtipClouds from "../../Assets/images/wingtip_clouds.jpg";
import * as ImagePicker from "expo-image-picker";
import * as DocumentPicker from 'expo-document-picker';
import { Formik } from "formik";
import { StripeProvider, useStripe } from '@stripe/stripe-react-native';

const Home = ({ route, navigation }) => {
  const { user } = useUser();
  const stripe = useStripe();
  const [listings, setListings] = useState([]);
  const [filteredListings, setFilteredListings] = useState([]); // Initialize filteredListings
  const [selectedCategory, setSelectedCategory] = useState("");
  const [selectedListing, setSelectedListing] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [mapModalVisible, setMapModalVisible] = useState(false);
  const [filterModalVisible, setFilterModalVisible] = useState(false);
  const [addListingModalVisible, setAddListingModalVisible] = useState(false);
  const [paymentModalVisible, setPaymentModalVisible] = useState(false);
  const [mapRegion, setMapRegion] = useState({
    latitude: 37.78825,
    longitude: -122.4324,
    latitudeDelta: 0.0922,
    longitudeDelta: 0.0421,
  });
  const [filter, setFilter] = useState({
    make: "",
    location: "",
  });
  const [images, setImages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [rentalHours, setRentalHours] = useState(1);
  const [totalCost, setTotalCost] = useState({
    rentalCost: "0.00",
    bookingFee: "0.00",
    transactionFee: "0.00",
    salesTax: "0.00",
    total: "0.00",
  });

  const [recentAnnualPdf, setRecentAnnualPdf] = useState(null);
  const [insurancePdf, setInsurancePdf] = useState(null);

  const categories = [
    "Single Engine Piston",
    "Twin Engine Piston",
    "Turbo Prop",
    "Helicopter",
    "Jet",
  ];

  useEffect(() => {
    const unsubscribe = subscribeToListings();
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (selectedListing && rentalHours > 0) {
      calculateTotalCost(rentalHours);
    }
  }, [selectedListing, rentalHours]);

  const subscribeToListings = () => {
    const listingsRef = collection(db, "airplanes");

    let q = query(listingsRef, orderBy("createdAt", "desc"));

    if (filter.make) {
      q = query(q, where("airplaneModel", "==", filter.make.toLowerCase()));
    }

    if (filter.location) {
      q = query(q, where("location", "==", filter.location.toLowerCase()));
    }

    return onSnapshot(q, (snapshot) => {
      const listingsData = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setListings(listingsData);
      setFilteredListings(listingsData); // Initialize filteredListings with the fetched data
    });
  };

  const calculateTotalCost = (hours) => {
    if (!selectedListing) return;

    const pricePerHour = parseFloat(selectedListing.ratesPerHour);
    const rentalCost = pricePerHour * hours;
    const bookingFee = rentalCost * 0.06;
    const transactionFee = rentalCost * 0.03;
    const salesTax = rentalCost * 0.0825;
    const total = rentalCost + bookingFee + transactionFee + salesTax;

    setTotalCost({
      rentalCost: rentalCost.toFixed(2),
      bookingFee: bookingFee.toFixed(2),
      transactionFee: transactionFee.toFixed(2),
      salesTax: salesTax.toFixed(2),
      total: total.toFixed(2),
    });
  };

  const applyFilter = () => {
    const lowerCaseMake = filter.make.toLowerCase();
    const lowerCaseLocation = filter.location.toLowerCase();

    const filteredData = listings.filter(
      (listing) =>
        listing.airplaneModel.toLowerCase().includes(lowerCaseMake) &&
        (listing.location?.toLowerCase().includes(lowerCaseLocation))
    );

    setFilteredListings(filteredData);
    setFilterModalVisible(false);
  };

  const handleListingPress = (listing) => {
    setSelectedListing(listing);
    setModalVisible(true);
  };

  const handleCompleteRental = () => {
    setModalVisible(false);
    setPaymentModalVisible(true);
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

  const pickDocument = async (setDocument) => {
    const result = await DocumentPicker.getDocumentAsync({
      type: "application/pdf",
    });

    if (result.type === "success") {
      setDocument(result.uri);
    }
  };

  const handleAddListing = async (values) => {
    setLoading(true);
    try {
      const uploadedImages = [];
      for (const image of images) {
        uploadedImages.push(image);
      }

      const newListing = {
        ...values,
        ownerId: user.id,
        images: uploadedImages,
        recentAnnualPdf,
        insurancePdf,
        createdAt: new Date(),
      };

      await addDoc(collection(db, "airplanes"), newListing);

      Alert.alert("Success", "Your listing has been submitted.");
      setAddListingModalVisible(false);

      if (navigation && typeof navigation.navigate === 'function') {
        navigation.navigate("UserProfile");
      } else {
        console.error("Navigation is undefined or not a function");
      }
    } catch (error) {
      console.error("Error submitting listing: ", error);
      Alert.alert("Error", "There was an error submitting your listing.");
    } finally {
      setLoading(false);
    }
  };

  const sendRentalRequestNotification = async () => {
    if (!selectedListing || !user) return;

    try {
      await addDoc(collection(db, "notifications"), {
        ownerId: selectedListing.ownerId,
        message: `You have a new rental request for ${selectedListing.airplaneModel}. Please review the request.`,
        confirmed: false,
        renter: {
          renterId: user.id,
          renterName: user.fullName,
          rentalHours,
          totalCost: totalCost.total,
        },
        createdAt: new Date(),
      });

      Alert.alert("Rental Request Sent", "Your rental request has been sent to the owner for review.");
    } catch (error) {
      console.error("Error sending notification: ", error);
      Alert.alert("Error", "There was an error sending your rental request.");
    } finally {
      setPaymentModalVisible(false);
    }
  };

  const confirmRentalRequest = async (notificationId) => {
    try {
      const notificationRef = doc(db, "notifications", notificationId);
      await updateDoc(notificationRef, { confirmed: true });

      const paymentIntent = await stripe.paymentRequestWithPaymentIntent({
        amount: parseInt(totalCost.total * 100),
        currency: 'usd',
        paymentMethodTypes: ['card'],
        confirm: true,
      });

      if (paymentIntent.status === 'succeeded') {
        Alert.alert("Payment Successful", "The rental request has been confirmed and payment processed.");
      } else {
        Alert.alert("Payment Failed", "The payment could not be completed. Please try again.");
      }
    } catch (error) {
      console.error("Error confirming rental request: ", error);
      Alert.alert("Error", "There was an error confirming the rental request.");
    }
  };

  const renderCategoryItem = ({ item }) => (
    <TouchableOpacity
      key={item}
      onPress={() => setSelectedCategory(item)}
      className={`p-2 ${selectedCategory === item ? "bg-gray-500" : "bg-gray-200"} rounded-md mr-2`}
    >
      <Text className="text-sm font-bold">{item}</Text>
    </TouchableOpacity>
  );

  const renderListingItem = ({ item }) => (
    <View style={{ marginBottom: 10 }} key={item.id}>
      <TouchableOpacity
        onPress={() => handleListingPress(item)}
        className="flex-row justify-between items-center p-4 bg-gray-200 rounded-md"
      >
        <View className="flex-1">
          <Text className="text-lg font-bold">{item.airplaneModel}</Text>
          <Text>${item.ratesPerHour} per hour</Text>
          <Text numberOfLines={4}>{item.description}</Text>
        </View>
        {item.images && item.images[0] && (
          <Image
            source={{ uri: item.images[0] }}
            className="w-24 h-24 ml-3 rounded-lg"
          />
        )}
      </TouchableOpacity>
    </View>
  );

  return (
    <SafeAreaView className="flex-1 bg-white">
      <ImageBackground
        source={wingtipClouds}
        className="h-56"
        resizeMode="cover"
      >
        <View className="flex-row justify-between items-center p-4">
          <View>
            <Text className="text-sm text-white">Good Morning</Text>
            <Text className="text-lg font-bold text-white">
              {user?.fullName}
            </Text>
          </View>
          <TouchableOpacity
            onPress={() => setAddListingModalVisible(true)}
            className="bg-white bg-opacity-50 rounded-full px-4 py-2"
          >
            <Text className="text-gray-900">List Your Aircraft</Text>
          </TouchableOpacity>
        </View>
      </ImageBackground>

      <ScrollView contentContainerStyle={{ padding: 16 }}>
        <View className="flex-row justify-between mb-4">
          <Text className="text-lg text-gray-800">
            Filter by location or Aircraft Make
          </Text>
          <TouchableOpacity
            onPress={() => setFilterModalVisible(true)}
            className="bg-gray-200 p-2 rounded-full"
          >
            <Ionicons name="filter" size={24} color="gray" />
          </TouchableOpacity>
        </View>

        <FlatList
          data={categories}
          renderItem={renderCategoryItem}
          horizontal
          keyExtractor={(item) => item}
          showsHorizontalScrollIndicator={false}
          className="mb-4"
        />

        <Text className="text-2xl font-bold mb-4 text-gray-900 text-center">
          Available Listings
        </Text>

        {filteredListings.length > 0 ? (
          filteredListings.map((item) => renderListingItem({ item }))
        ) : (
          <Text className="text-center text-gray-700">No listings available</Text>
        )}
      </ScrollView>

      {/* Filter Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={filterModalVisible}
        onRequestClose={() => setFilterModalVisible(false)}
      >
        <View className="flex-1 justify-center items-center bg-black bg-opacity-50">
          <View className="bg-white rounded-3xl p-6 w-11/12 max-w-lg">
            <Text className="text-2xl font-bold mb-4 text-center">
              Filter Listings
            </Text>
            <TextInput
              placeholder="Aircraft Make"
              onChangeText={(value) => setFilter({ ...filter, make: value })}
              value={filter.make}
              className="border-b border-gray-300 mb-4 p-2"
            />
            <TextInput
              placeholder="Location (City, State or Airport Identifier)"
              onChangeText={(value) =>
                setFilter({ ...filter, location: value })
              }
              value={filter.location}
              className="border-b border-gray-300 mb-4 p-2"
            />
            <View className="flex-row justify-between">
              <TouchableOpacity
                onPress={() => setFilterModalVisible(false)}
                className="bg-gray-300 p-3 rounded-lg"
              >
                <Text className="text-center text-gray-700">Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={applyFilter}
                className="bg-blue-500 p-3 rounded-lg"
              >
                <Text className="text-center text-white">Apply Filters</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Add Listing Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={addListingModalVisible}
        onRequestClose={() => setAddListingModalVisible(false)}
      >
        <View className="flex-1 justify-center items-center bg-black bg-opacity-50">
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : "height"}
            className="flex-1 justify-center items-center w-full"
          >
            <ScrollView className="w-full max-w-lg">
              <View className="bg-white rounded-3xl p-6 w-full shadow-xl">
                <Text className="text-2xl font-bold mb-6 text-center text-gray-900">
                  List Your Aircraft
                </Text>

                <Formik
                  initialValues={{
                    airplaneModel: "",
                    description: "",
                    location: "",
                    ratesPerHour: "",
                    email: "",
                  }}
                  onSubmit={handleAddListing}
                >
                  {({
                    handleChange,
                    handleBlur,
                    handleSubmit,
                    values,
                  }) => (
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
                        onChangeText={handleChange("ratesPerHour")}
                        onBlur={handleBlur("ratesPerHour")}
                        value={values.ratesPerHour}
                        keyboardType="numeric"
                        className="border-b border-gray-300 mb-4 p-2 text-gray-900"
                      />
                      <TextInput
                        placeholder="Email (Required)"
                        onChangeText={handleChange("email")}
                        onBlur={handleBlur("email")}
                        value={values.email}
                        keyboardType="email-address"
                        className="border-b border-gray-300 mb-4 p-2 text-gray-900"
                        required
                      />

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
                        Upload Recent Annual Inspection PDF
                      </Text>
                      <TouchableOpacity
                        onPress={() => pickDocument(setRecentAnnualPdf)}
                        className="bg-gray-100 py-2 px-4 rounded-full mb-4"
                      >
                        <Text className="text-center text-gray-800">
                          {recentAnnualPdf ? "PDF Uploaded" : "Upload PDF"}
                        </Text>
                      </TouchableOpacity>

                      <Text className="mb-2 mt-4 text-gray-900 font-bold">
                        Upload Proof of Insurance PDF
                      </Text>
                      <TouchableOpacity
                        onPress={() => pickDocument(setInsurancePdf)}
                        className="bg-gray-100 py-2 px-4 rounded-full mb-4"
                      >
                        <Text className="text-center text-gray-800">
                          {insurancePdf ? "PDF Uploaded" : "Upload PDF"}
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
                  onPress={() => setAddListingModalVisible(false)}
                  className="mt-4 py-2 rounded-full bg-gray-200"
                >
                  <Text className="text-center text-gray-800">Cancel</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      {/* Listing Details Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <View className="flex-1 justify-center items-center bg-black bg-opacity-50">
          <View className="bg-white rounded-3xl p-6 w-11/12">
            {selectedListing && (
              <>
                <Text className="text-xl font-bold mb-4">
                  {selectedListing.airplaneModel}
                </Text>
                <Image
                  source={{ uri: selectedListing.images[0] }}
                  className="w-full h-64 rounded-lg mb-4"
                />
                <ScrollView className="h-64">
                  <Text className="text-lg mb-2">
                    Price: ${selectedListing.ratesPerHour} per hour
                  </Text>
                  <Text className="text-lg mb-2">
                    Description: {selectedListing.description}
                  </Text>
                  <Text className="text-lg mb-2">
                    Location: {selectedListing.location}
                  </Text>
                </ScrollView>
                <View className="flex-row justify-between mt-4">
                  <TouchableOpacity
                    onPress={handleCompleteRental}
                    className="bg-green-500 p-3 rounded-lg"
                  >
                    <Text className="text-white text-center">Rent Now</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => setModalVisible(false)}
                    className="bg-gray-300 p-3 rounded-lg"
                  >
                    <Text className="text-gray-800 text-center">Close</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>

      {/* Rental Request Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={paymentModalVisible}
        onRequestClose={() => setPaymentModalVisible(false)}
      >
        <View className="flex-1 justify-center items-center bg-black bg-opacity-50">
          <View className="bg-white rounded-3xl p-6 w-11/12">
            <Text className="text-xl font-bold mb-4">Complete Your Rental Request</Text>
            {selectedListing && totalCost && (
              <>
                <Text className="text-lg mb-2">
                  Aircraft: {selectedListing.airplaneModel}
                </Text>
                <TextInput
                  placeholder="Number of Hours"
                  value={rentalHours.toString()}
                  onChangeText={(value) => setRentalHours(Number(value))}
                  keyboardType="numeric"
                  className="border-b border-gray-300 mb-4 p-2"
                />
                <Text className="text-lg mb-2">
                  Rate per Hour: ${selectedListing.ratesPerHour}
                </Text>
                <Text className="text-lg mb-2">
                  Rental Cost: ${totalCost.rentalCost}
                </Text>
                <Text className="text-lg mb-2">
                  6% Booking Fee: ${totalCost.bookingFee}
                </Text>
                <Text className="text-lg mb-2">
                  3% Credit Card Processing Fee: ${totalCost.transactionFee}
                </Text>
                <Text className="text-lg mb-2">
                  8.25% Sales Tax: ${totalCost.salesTax}
                </Text>
                <Text className="text-lg font-bold mb-4">
                  Total Cost: ${totalCost.total}
                </Text>
                <TouchableOpacity
                  onPress={sendRentalRequestNotification}
                  className="bg-blue-500 p-3 rounded-lg mt-4"
                >
                  <Text className="text-white text-center">Submit Rental Request</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => setPaymentModalVisible(false)}
                  className="bg-gray-300 p-3 rounded-lg mt-4"
                >
                  <Text className="text-gray-800 text-center">Cancel</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

export default Home;
