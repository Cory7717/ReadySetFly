import React, { useEffect, useState } from "react";
import {
  Text,
  View,
  Image,
  TextInput,
  TouchableOpacity,
  FlatList,
  Modal,
  ScrollView,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useUser } from "@clerk/clerk-expo";
import { db } from "../../firebaseConfig";
import { collection, getDocs, query, orderBy, limit } from "firebase/firestore";
import { AntDesign, MaterialIcons } from "@expo/vector-icons";
import { styled } from "nativewind"; // Import NativeWind

const Home = () => {
  const { user } = useUser();
  const [searchQuery, setSearchQuery] = useState("");
  const [listings, setListings] = useState([]);
  const [filteredListings, setFilteredListings] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState("");
  const [showFilters, setShowFilters] = useState(true);
  const [selectedListing, setSelectedListing] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [purchaseModalVisible, setPurchaseModalVisible] = useState(false);
  const [totalHours, setTotalHours] = useState("");
  const [priceBreakdown, setPriceBreakdown] = useState({
    totalCost: 0,
    bookingFee: 0,
    salesTax: 0,
    processingFee: 0,
    grandTotal: 0,
  });
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  const categories = [
    "Single Engine Piston",
    "Twin Engine Piston",
    "Turbo Prop",
    "Helicopter",
    "Jet",
  ];

  useEffect(() => {
    getLatestItemList();
  }, []);

  const getLatestItemList = async () => {
    try {
      const listingsRef = collection(db, "airplanes");
      const q = query(listingsRef, orderBy("createdAt", "desc"), limit(10));
      const querySnapShot = await getDocs(q);

      const listingsData = [];
      querySnapShot.forEach((doc) => {
        listingsData.push({ id: doc.id, ...doc.data() });
      });
      setListings(listingsData);
      setFilteredListings(listingsData);
    } catch (error) {
      console.error("Error fetching listings:", error);
      Alert.alert("Error", "Failed to load listings.");
    }
  };

  const handleSearch = () => {
    const lowerCaseQuery = searchQuery.toLowerCase();
    const filteredData = listings.filter((listing) => {
      const location = listing.location ? listing.location.toLowerCase() : "";
      return location.includes(lowerCaseQuery);
    });
    setFilteredListings(filteredData);
  };

  const handleListingPress = (listing) => {
    setSelectedListing(listing);
    setCurrentImageIndex(0);
    setModalVisible(true);
  };

  const handlePurchase = () => {
    setModalVisible(false);
    setPurchaseModalVisible(true);
  };

  const handleCompletePurchase = () => {
    Alert.alert("Purchase Completed", "Thank you for your purchase!");
    setPurchaseModalVisible(false);
  };

  const calculateTotalCost = (hours) => {
    if (selectedListing && hours) {
      const ratePerHour = parseFloat(selectedListing.ratesPerHour);
      const totalHoursCost = ratePerHour * parseFloat(hours);
      const bookingFee = totalHoursCost * 0.06;
      const processingFee = totalHoursCost * 0.03;
      const salesTax = totalHoursCost * 0.0825;
      const grandTotal = totalHoursCost + bookingFee + processingFee + salesTax;

      setPriceBreakdown({
        totalCost: totalHoursCost.toFixed(2),
        bookingFee: bookingFee.toFixed(2),
        processingFee: processingFee.toFixed(2),
        salesTax: salesTax.toFixed(2),
        grandTotal: grandTotal.toFixed(2),
      });
    } else {
      setPriceBreakdown({
        totalCost: 0,
        bookingFee: 0,
        processingFee: 0,
        salesTax: 0,
        grandTotal: 0,
      });
    }
  };

  const handleNextImage = () => {
    if (selectedListing && currentImageIndex < selectedListing.images.length - 1) {
      setCurrentImageIndex(currentImageIndex + 1);
    }
  };

  const handlePreviousImage = () => {
    if (currentImageIndex > 0) {
      setCurrentImageIndex(currentImageIndex - 1);
    }
  };

  const renderCategoryItem = ({ item }) => (
    <TouchableOpacity
      key={item}
      onPress={() => setSelectedCategory(item)}
      className={`p-2 rounded-lg mr-2 ${
        selectedCategory === item ? "bg-red-500" : "bg-gray-200"
      }`}
    >
      <Text className="text-sm font-bold text-gray-700">{item}</Text>
    </TouchableOpacity>
  );

  const renderListingItem = ({ item }) => (
    <TouchableOpacity
      onPress={() => handleListingPress(item)}
      className="flex-row justify-between items-center p-4 bg-white rounded-lg mb-3 shadow-sm"
    >
      <View className="flex-1 mr-3">
        <Text className="text-lg font-bold text-gray-800">{item.airplaneModel}</Text>
        <Text className="text-red-500">${item.ratesPerHour} per hour</Text>
        <Text className="text-gray-600">{item.description}</Text>
      </View>
      {item.images && item.images[0] && (
        <Image source={{ uri: item.images[0] }} className="w-20 h-20 rounded-lg" />
      )}
    </TouchableOpacity>
  );

  return (
    <SafeAreaView className="flex-1 bg-white">
      {/* Header */}
      <View className="flex-row p-4 items-center">
        <Image
          source={{ uri: user?.imageUrl }}
          className="w-10 h-10 rounded-full mr-3"
        />
        <View>
          <Text className="text-sm text-gray-500">Welcome</Text>
          <Text className="text-lg font-bold text-gray-800">{user?.fullName}</Text>
        </View>
      </View>

      {/* Toggle Button */}
      <TouchableOpacity
        onPress={() => setShowFilters(!showFilters)}
        className="self-center mb-4 bg-white w-1/2 p-2 rounded-full items-center shadow-sm"
      >
        <AntDesign name={showFilters ? "up" : "down"} size={24} color="gray" />
      </TouchableOpacity>

      {showFilters && (
        <>
          {/* Search Bar */}
          <View className="p-4">
            <TextInput
              placeholder="Search by city, state"
              value={searchQuery}
              onChangeText={setSearchQuery}
              className="bg-gray-200 rounded-lg p-3 mb-4"
            />
            <TouchableOpacity onPress={handleSearch} className="bg-red-500 p-3 rounded-lg items-center">
              <Text className="text-white font-bold">Search</Text>
            </TouchableOpacity>
          </View>

          {/* Categories Slider */}
          <FlatList
            data={categories}
            renderItem={renderCategoryItem}
            horizontal
            keyExtractor={(item) => item}
            showsHorizontalScrollIndicator={false}
            className="p-4"
          />
        </>
      )}

      {/* Listings */}
      <View className="flex-1 p-4">
        <Text className="text-lg font-bold mb-2 text-gray-800">Available Listings</Text>
        {filteredListings.length > 0 ? (
          <FlatList
            data={filteredListings}
            renderItem={renderListingItem}
            keyExtractor={(item) => item.id}
          />
        ) : (
          <Text className="text-center text-gray-500 mt-4">No listings available</Text>
        )}
      </View>

      {/* Listing Detail Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <View className="flex-1 justify-center items-center bg-black bg-opacity-50">
          <View className="bg-white rounded-lg p-6 w-11/12 shadow-lg">
            {selectedListing && (
              <ScrollView>
                <Text className="text-xl font-bold mb-4 text-center text-gray-800">
                  {selectedListing.airplaneModel}
                </Text>

                <View className="relative w-full h-64 mb-4">
                  <Image
                    source={{ uri: selectedListing.images[currentImageIndex] }}
                    className="w-full h-full rounded-lg"
                    resizeMode="cover"
                  />
                  {currentImageIndex > 0 && (
                    <TouchableOpacity
                      onPress={handlePreviousImage}
                      className="absolute left-0 top-1/2 -mt-6 bg-black bg-opacity-50 p-2 rounded-full"
                    >
                      <AntDesign name="left" size={24} color="white" />
                    </TouchableOpacity>
                  )}
                  {currentImageIndex < selectedListing.images.length - 1 && (
                    <TouchableOpacity
                      onPress={handleNextImage}
                      className="absolute right-0 top-1/2 -mt-6 bg-black bg-opacity-50 p-2 rounded-full"
                    >
                      <AntDesign name="right" size={24} color="white" />
                    </TouchableOpacity>
                  )}
                </View>

                <Text className="text-lg text-gray-800 mb-2">Location: {selectedListing.location}</Text>
                <Text className="text-lg text-gray-800 mb-2">
                  Rate: ${selectedListing.ratesPerHour} per hour
                </Text>
                <Text className="text-lg text-gray-600 mb-4">{selectedListing.description}</Text>

                <TouchableOpacity onPress={handlePurchase} className="bg-red-500 p-3 rounded-lg">
                  <Text className="text-white text-center font-bold">Purchase</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => setModalVisible(false)}
                  className="mt-4 p-2 rounded-lg bg-gray-200"
                >
                  <Text className="text-center text-gray-600">Close</Text>
                </TouchableOpacity>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      {/* Purchase Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={purchaseModalVisible}
        onRequestClose={() => setPurchaseModalVisible(false)}
      >
        <View className="flex-1 justify-center items-center bg-black bg-opacity-50">
          <View className="bg-white rounded-lg p-6 w-11/12 shadow-lg">
            <ScrollView showsHorizontalScrollIndicator={false}>
              <Text className="text-xl font-bold mb-4 text-center text-gray-800">
                Complete Your Purchase
              </Text>

              <TextInput
                placeholder="Total Estimated Hours"
                keyboardType="numeric"
                value={totalHours}
                onChangeText={(text) => {
                  setTotalHours(text);
                  calculateTotalCost(text);
                }}
                className="bg-gray-200 rounded-lg p-3 mb-4"
              />

              <Text className="text-lg font-bold mb-2 text-gray-800">Price Breakdown:</Text>
              <Text className="text-gray-600 mb-2">
                Price per hour: ${selectedListing?.ratesPerHour}
              </Text>
              <Text className="text-gray-600 mb-2">Total estimated hours: {totalHours}</Text>
              <Text className="text-gray-600 mb-2">
                3% Credit Card Processing Fee: ${priceBreakdown.processingFee}
              </Text>
              <Text className="text-gray-600 mb-2">6% Booking Fee: ${priceBreakdown.bookingFee}</Text>
              <Text className="text-gray-600 mb-2">8.25% Sales Tax: ${priceBreakdown.salesTax}</Text>
              <Text className="text-lg font-bold mb-4 text-red-500">
                Grand Total: ${priceBreakdown.grandTotal}
              </Text>

              <TextInput
                placeholder="Dates Required (e.g., 2024-08-25)"
                className="bg-gray-200 rounded-lg p-3 mb-4"
              />
              <Text className="text-lg font-bold mb-2 text-gray-800">Renter Details</Text>
              <Text className="text-gray-600 mb-2">Name: {user.fullName}</Text>
              <Text className="text-gray-600 mb-4">Email: {user.primaryEmailAddress.emailAddress}</Text>

              <Text className="text-lg font-bold mb-2 text-gray-800">Payment Information</Text>
              <TextInput
                placeholder="Credit Card Number"
                keyboardType="numeric"
                className="bg-gray-200 rounded-lg p-3 mb-4"
              />
              <TextInput
                placeholder="Expiration Date (MM/YY)"
                keyboardType="numeric"
                className="bg-gray-200 rounded-lg p-3 mb-4"
              />
              <TextInput
                placeholder="CVV"
                keyboardType="numeric"
                className="bg-gray-200 rounded-lg p-3 mb-4"
              />
              <TextInput
                placeholder="Billing Zip Code"
                keyboardType="numeric"
                className="bg-gray-200 rounded-lg p-3 mb-4"
              />

              <TouchableOpacity onPress={handleCompletePurchase} className="bg-red-500 p-3 rounded-lg">
                <Text className="text-white text-center font-bold">Complete Purchase</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setPurchaseModalVisible(false)}
                className="mt-4 p-2 rounded-lg bg-gray-200"
              >
                <Text className="text-center text-gray-600">Cancel</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

export default Home;
