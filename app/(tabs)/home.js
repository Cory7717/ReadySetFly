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
import { collection, onSnapshot, query, orderBy, where, addDoc } from "firebase/firestore";
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

  const handleRentalRequestSubmit = async (rentalDetails) => {
    try {
      const messageData = {
        senderId: user.id,
        senderName: user.fullName,
        message: `
          Rental Request from ${user.fullName}:
          Aircraft: ${rentalDetails.airplaneModel}
          Rental Period: ${rentalDetails.rentalPeriod}
          Total Cost: $${rentalDetails.totalCost}
          Contact: ${user.email}
        `,
        createdAt: new Date(),
      };

      await addDoc(collection(db, "owners", rentalDetails.ownerId, "messages"), messageData);

      Alert.alert("Request Sent", "Your rental request has been sent to the owner.");
    } catch (error) {
      console.error("Error sending rental request: ", error);
      Alert.alert("Error", "Failed to send rental request to the owner.");
    }
  };

  const handleCompleteRental = async () => {
    const rentalDetails = {
      airplaneModel: selectedListing.airplaneModel,
      rentalPeriod: `2024-09-01 to 2024-09-07`, // Replace with actual data
      totalCost: totalCost.total,
      ownerId: selectedListing.ownerId,
    };

    await handleRentalRequestSubmit(rentalDetails);

    setModalVisible(false);
    setPaymentModalVisible(true);
  };

  const onSubmitListing = async (values) => {
    setLoading(true);
    try {
      const uploadedImages = [];
      for (const image of images) {
        const downloadURL = await uploadFile(image, "airplaneImages");
        uploadedImages.push(downloadURL);
      }

      const annualProofURL = recentAnnualPdf
        ? await uploadFile(recentAnnualPdf, "documents")
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
      };

      await addDoc(collection(db, "airplanes"), newListing);
      Alert.alert("Success", "Your listing has been submitted.");
      setAddListingModalVisible(false);
    } catch (error) {
      console.error("Error submitting listing: ", error);
      Alert.alert("Error", `There was an error submitting your listing: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

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
          renderItem={({ item }) => (
            <TouchableOpacity
              key={item}
              onPress={() => setSelectedCategory(item)}
              className={`p-2 ${selectedCategory === item ? "bg-gray-500" : "bg-gray-200"} rounded-md mr-2`}
            >
              <Text className="text-sm font-bold">{item}</Text>
            </TouchableOpacity>
          )}
          horizontal
          keyExtractor={(item) => item}
          showsHorizontalScrollIndicator={false}
          className="mb-4"
        />

        <Text className="text-2xl font-bold mb-4 text-gray-900 text-center">
          Available Listings
        </Text>

        {listings.length > 0 ? (
          listings.map((item) => (
            <View style={{ marginBottom: 10 }} key={item.id}>
              <TouchableOpacity
                onPress={() => {
                  setSelectedListing(item);
                  setModalVisible(true);
                }}
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
          ))
        ) : (
          <Text className="text-center text-gray-700">No listings available</Text>
        )}
      </ScrollView>

      {/* Listing Details Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <View className="flex-1 justify-center items-center bg-black bg-opacity-50">
          <View className="bg-white rounded-lg p-6">
            <Text className="text-2xl font-bold mb-4">{selectedListing?.airplaneModel}</Text>
            <Text className="mb-2">${selectedListing?.ratesPerHour} per hour</Text>
            <Text className="mb-4">{selectedListing?.description}</Text>

            <View className="flex-row items-center justify-between">
              <Text className="font-bold text-lg">Rental Hours</Text>
              <TextInput
                value={String(rentalHours)}
                onChangeText={(text) => setRentalHours(Number(text))}
                keyboardType="numeric"
                className="border border-gray-300 p-2 rounded-md"
              />
            </View>

            <View className="mt-4">
              <Text className="font-bold">Total Cost</Text>
              <Text>Rental Cost: ${totalCost.rentalCost}</Text>
              <Text>Booking Fee: ${totalCost.bookingFee}</Text>
              <Text>Transaction Fee: ${totalCost.transactionFee}</Text>
              <Text>Sales Tax: ${totalCost.salesTax}</Text>
              <Text className="font-bold">Total: ${totalCost.total}</Text>
            </View>

            <TouchableOpacity
              onPress={handleCompleteRental}
              className="bg-blue-500 p-4 rounded-lg mt-4"
            >
              <Text className="text-white text-center font-bold">
                Complete Your Rental Request
              </Text>
            </TouchableOpacity>
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

                <Formik
                  initialValues={{
                    airplaneModel: "",
                    description: "",
                    location: "",
                    ratesPerHour: "",
                    minimumHours: "",
                  }}
                  onSubmit={onSubmitListing}
                >
                  {({ handleChange, handleBlur, handleSubmit, values }) => (
                    <>
                      <TextInput
                        placeholder="Aircraft Make/Model"
                        onChangeText={handleChange("airplaneModel")}
                        onBlur={handleBlur("airplaneModel")}
                        value={values.airplaneModel}
                        style={{ borderBottomWidth: 1, borderBottomColor: "#cbd5e0", marginBottom: 16, padding: 8, color: "#2d3748" }}
                      />
                      <TextInput
                        placeholder="Description"
                        onChangeText={handleChange("description")}
                        onBlur={handleBlur("description")}
                        value={values.description}
                        multiline
                        style={{ borderBottomWidth: 1, borderBottomColor: "#cbd5e0", marginBottom: 16, padding: 8, color: "#2d3748" }}
                      />
                      <TextInput
                        placeholder="Location (City, State)"
                        onChangeText={handleChange("location")}
                        onBlur={handleBlur("location")}
                        value={values.location}
                        style={{ borderBottomWidth: 1, borderBottomColor: "#cbd5e0", marginBottom: 16, padding: 8, color: "#2d3748" }}
                      />
                      <TextInput
                        placeholder="Rates Per Hour ($)"
                        onChangeText={handleChange("ratesPerHour")}
                        onBlur={handleBlur("ratesPerHour")}
                        value={values.ratesPerHour}
                        keyboardType="default"
                        style={{ borderBottomWidth: 1, borderBottomColor: "#cbd5e0", marginBottom: 16, padding: 8, color: "#2d3748" }}
                      />
                      <TextInput
                        placeholder="Minimum Hour Requirement"
                        onChangeText={handleChange("minimumHours")}
                        onBlur={handleBlur("minimumHours")}
                        value={values.minimumHours}
                        keyboardType="numeric"
                        style={{ borderBottomWidth: 1, borderBottomColor: "#cbd5e0", marginBottom: 16, padding: 8, color: "#2d3748" }}
                      />

                      <TouchableOpacity
                        onPress={handleSubmit}
                        style={{ backgroundColor: "#e53e3e", paddingVertical: 16, paddingHorizontal: 24, borderRadius: 50 }}
                      >
                        <Text style={{ color: "white", textAlign: "center", fontWeight: "bold" }}>
                          Submit Listing
                        </Text>
                      </TouchableOpacity>
                    </>
                  )}
                </Formik>

                <TouchableOpacity
                  onPress={() => setAddListingModalVisible(false)}
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
    </SafeAreaView>
  );
};

export default Home;
