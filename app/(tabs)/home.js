import React, { useEffect, useState } from "react";
import {
  Text,
  View,
  Image,
  TextInput,
  TouchableOpacity,
  FlatList,
  ImageBackground,
  Modal,
  ScrollView,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useUser } from "@clerk/clerk-expo";
import { db } from "../../firebaseConfig";
import { collection, getDocs, query, where } from "firebase/firestore";
import wingtipClouds from "../../Assets/images/wingtip_clouds.jpg"; // Ensure correct path
import { AntDesign } from "@expo/vector-icons"; // Import AntDesign for the chevrons

const Home = () => {
  const { user } = useUser();
  const [searchQuery, setSearchQuery] = useState("");
  const [listings, setListings] = useState([]);
  const [filteredListings, setFilteredListings] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState("");
  const [showFilters, setShowFilters] = useState(true); // State to toggle filters
  const [selectedListing, setSelectedListing] = useState(null); // State for selected listing
  const [modalVisible, setModalVisible] = useState(false); // State to control listing modal visibility
  const [purchaseModalVisible, setPurchaseModalVisible] = useState(false); // State to control purchase modal visibility
  const [totalHours, setTotalHours] = useState(""); // State for total hours
  const [priceBreakdown, setPriceBreakdown] = useState({
    totalCost: 0,
    bookingFee: 0,
    salesTax: 0,
    processingFee: 0,
    grandTotal: 0,
  }); // State for price breakdown
  const [currentImageIndex, setCurrentImageIndex] = useState(0); // State to track current image index

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
    const listingsRef = collection(db, "airplanes");
    const q = query(listingsRef, where("userEmail", "==", user.primaryEmailAddress.emailAddress));
    const querySnapShot = await getDocs(q);

    const listingsData = [];
    querySnapShot.forEach((doc) => {
      listingsData.push({ id: doc.id, ...doc.data() });
    });
    setListings(listingsData);
    setFilteredListings(listingsData); // Set the filtered listings to show all initially
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
    setCurrentImageIndex(0); // Reset image index when a new listing is selected
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
      const bookingFee = totalHoursCost * 0.06; // 6% booking fee
      const processingFee = totalHoursCost * 0.03; // 3% credit card processing fee
      const salesTax = totalHoursCost * 0.0825; // 8.25% sales tax
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
      className={`p-2 ${selectedCategory === item ? "bg-gray-500" : "bg-gray-200"} rounded-lg mr-2`}
    >
      <Text className="text-sm font-bold">{item}</Text>
    </TouchableOpacity>
  );

  const renderListingItem = ({ item }) => (
    <TouchableOpacity
      onPress={() => handleListingPress(item)}
      className="flex-row justify-between items-center p-3 bg-gray-200 rounded-lg mb-3"
    >
      <View className="flex-1">
        <Text className="text-lg font-bold">{item.airplaneModel}</Text>
        <Text>${item.ratesPerHour} per hour</Text>
        <Text>{item.description}</Text>
      </View>
      {item.images && item.images[0] && (
        <Image
          source={{ uri: item.images[0] }}
          className="w-24 h-24 ml-3 rounded-lg"
        />
      )}
    </TouchableOpacity>
  );

  return (
    <ImageBackground
      source={wingtipClouds}
      className="flex-1"
      resizeMode="cover"
    >
      <SafeAreaView className="flex-1">
        {/* Header */}
        <View className="flex-row p-4 items-center">
          <Image
            source={{ uri: user?.imageUrl }}
            className="w-10 h-10 rounded-full mr-3"
          />
          <View>
            <Text className="text-base text-white">Welcome</Text>
            <Text className="text-lg font-bold text-white">
              {user?.fullName}
            </Text>
          </View>
        </View>

        {/* Toggle Button */}
        <TouchableOpacity
          onPress={() => setShowFilters(!showFilters)}
          className="self-center mb-4 bg-white w-1/2 p-2 rounded-full items-center"
        >
          <AntDesign 
            name={showFilters ? "up" : "down"} 
            size={36} 
            color="gray" 
          />
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
              <TouchableOpacity
                onPress={handleSearch}
                className="bg-blue-500 p-3 rounded-lg items-center"
              >
                <Text className="text-white font-bold">Search</Text>
              </TouchableOpacity>
            </View>

            {/* Categories Slider */}
            <View className="p-4">
              <FlatList
                data={categories}
                renderItem={renderCategoryItem}
                horizontal
                keyExtractor={(item) => item}  // Using item (category name) as the key
                showsHorizontalScrollIndicator={false}
              />
            </View>
          </>
        )}

        {/* Listings */}
        <View className="flex-1 p-4">
          <Text className="text-lg font-bold mb-2 text-white">
            Available Listings
          </Text>
          {filteredListings.length > 0 ? (
            <FlatList
              data={filteredListings}
              renderItem={renderListingItem}
              keyExtractor={(item) => item.id}  // Using the unique id as the key
            />
          ) : (
            <Text className="text-white">No listings available</Text>
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
            <View className="bg-white rounded-lg p-6 w-11/12">
              {selectedListing && (
                <ScrollView>
                  <Text className="text-xl font-bold mb-4">
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

                  <Text className="text-lg mb-2">
                    Location: {selectedListing.location}
                  </Text>
                  <Text className="text-lg mb-2">
                    Rate: ${selectedListing.ratesPerHour} per hour
                  </Text>
                  <Text className="text-lg mb-4">{selectedListing.description}</Text>

                  <TouchableOpacity
                    onPress={handlePurchase}
                    className="bg-blue-500 p-3 rounded-lg"
                  >
                    <Text className="text-white text-center">Purchase</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => setModalVisible(false)}
                    className="mt-4"
                  >
                    <Text className="text-center text-gray-500">Close</Text>
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
            <View className="bg-white rounded-lg p-6 w-11/12">
              <ScrollView showsHorizontalScrollIndicator={false}>
                <Text className="text-xl font-bold mb-4">Complete Your Purchase</Text>

                <TextInput
                  placeholder="Total Estimated Hours"
                  keyboardType="numeric"
                  value={totalHours}
                  onChangeText={(text) => {
                    setTotalHours(text);
                    calculateTotalCost(text);
                  }}
                  className="border-b border-gray-300 mb-4 p-2"
                />

                <Text className="text-lg font-bold mb-2">Price Breakdown:</Text>
                <Text className="mb-2">Price per hour: ${selectedListing?.ratesPerHour}</Text>
                <Text className="mb-2">Total estimated hours: {totalHours}</Text>
                <Text className="mb-2">3% Credit Card Processing Fee: ${priceBreakdown.processingFee}</Text>
                <Text className="mb-2">6% Booking Fee: ${priceBreakdown.bookingFee}</Text>
                <Text className="mb-2">8.25% Sales Tax: ${priceBreakdown.salesTax}</Text>
                <Text className="text-lg font-bold mb-4">Grand Total: ${priceBreakdown.grandTotal}</Text>

                <TextInput
                  placeholder="Dates Required (e.g., 2024-08-25)"
                  className="border-b border-gray-300 mb-4 p-2"
                />
                <Text className="text-lg font-bold mb-2">Renter Details</Text>
                <Text className="mb-2">Name: {user.fullName}</Text>
                <Text className="mb-4">Email: {user.primaryEmailAddress.emailAddress}</Text>

                <Text className="text-lg font-bold mb-2">Payment Information</Text>
                <TextInput
                  placeholder="Credit Card Number"
                  keyboardType="numeric"
                  className="border-b border-gray-300 mb-4 p-2"
                />
                <TextInput
                  placeholder="Expiration Date (MM/YY)"
                  keyboardType="numeric"
                  className="border-b border-gray-300 mb-4 p-2"
                />
                <TextInput
                  placeholder="CVV"
                  keyboardType="numeric"
                  className="border-b border-gray-300 mb-4 p-2"
                />
                <TextInput
                  placeholder="Billing Zip Code"
                  keyboardType="numeric"
                  className="border-b border-gray-300 mb-4 p-2"
                />

                <TouchableOpacity
                  onPress={handleCompletePurchase}
                  className="bg-blue-500 p-3 rounded-lg"
                >
                  <Text className="text-white text-center">Complete Purchase</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => setPurchaseModalVisible(false)}
                  className="mt-4"
                >
                  <Text className="text-center text-gray-500">Cancel</Text>
                </TouchableOpacity>
              </ScrollView>
            </View>
          </View>
        </Modal>
      </SafeAreaView>
    </ImageBackground>
  );
};

export default Home;
