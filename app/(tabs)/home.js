import React, { useEffect, useState } from "react";
import {
  Text,
  View,
  TextInput,
  TouchableOpacity,
  FlatList,
  Modal,
  ImageBackground,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useUser } from "@clerk/clerk-expo";
import { db } from "../../firebaseConfig";
import { collection, onSnapshot, query, orderBy } from "firebase/firestore";
import MapView, { Marker } from 'react-native-maps';
import * as Location from 'expo-location';
import PropellerImage from "../../Assets/images/propeller-image.jpg"; // Import your image

const Home = () => {
  const { user } = useUser();
  const [searchQuery, setSearchQuery] = useState("");
  const [listings, setListings] = useState([]);
  const [filteredListings, setFilteredListings] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState("");
  const [selectedListing, setSelectedListing] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [mapModalVisible, setMapModalVisible] = useState(false);
  const [mapRegion, setMapRegion] = useState({
    latitude: 37.78825,
    longitude: -122.4324,
    latitudeDelta: 0.0922,
    longitudeDelta: 0.0421,
  });

  // Define the categories array
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

  const subscribeToListings = () => {
    const listingsRef = collection(db, "airplanes");
    const q = query(listingsRef, orderBy("createdAt", "desc"));

    return onSnapshot(q, (snapshot) => {
      const listingsData = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setListings(listingsData);
      setFilteredListings(listingsData);
    });
  };

  const handleSearch = async () => {
    const lowerCaseQuery = searchQuery.toLowerCase();
    const filteredData = listings.filter((listing) => {
      const location = listing.location ? listing.location.toLowerCase() : "";
      return location.includes(lowerCaseQuery);
    });
    setFilteredListings(filteredData);

    // Geocode the city/state input to get coordinates
    try {
      const geocodedLocation = await geocodeLocation(searchQuery);
      if (geocodedLocation) {
        setMapRegion({
          latitude: geocodedLocation.latitude,
          longitude: geocodedLocation.longitude,
          latitudeDelta: 0.0922,
          longitudeDelta: 0.0421,
        });
      } else {
        Alert.alert("Location not found", "Please enter a valid city or state.");
      }
    } catch (error) {
      Alert.alert("Error", "Failed to find location.");
    }
  };

  const geocodeLocation = async (locationName) => {
    try {
      let geocodedLocations = await Location.geocodeAsync(locationName);
      if (geocodedLocations.length > 0) {
        return geocodedLocations[0];
      }
      return null;
    } catch (error) {
      console.error("Geocoding error: ", error);
      return null;
    }
  };

  const handleListingPress = (listing) => {
    setSelectedListing(listing);
    setModalVisible(true);
  };

  const renderCategoryItem = ({ item }) => (
    <TouchableOpacity
      key={item}
      onPress={() => setSelectedCategory(item)}
      className={`p-1.5 rounded-lg mr-2 ${
        selectedCategory === item ? "bg-[#007AFF]" : "bg-[#F2F2F2]"
      }`}
      style={{ height: 24 }}  // This is 50% of the previous height (48)
    >
      <Text className={`text-xs font-bold ${selectedCategory === item ? "text-white" : "text-gray-700"}`}>
        {item}
      </Text>
    </TouchableOpacity>
  );

  const renderListingItem = ({ item }) => (
    <TouchableOpacity
      onPress={() => handleListingPress(item)}
      className="flex-row justify-between items-center p-4 bg-[#F9F9F9] rounded-lg mb-3 shadow-md"
    >
      <View className="flex-1 mr-3">
        <Text className="text-lg font-bold text-gray-800">{item.airplaneModel}</Text>
        <Text className="text-[#FF3B30]">${item.ratesPerHour} per hour</Text>
        <Text className="text-gray-600">{item.description}</Text>
      </View>
      <View className="flex-row items-center">
        {item.images && item.images[0] && (
          <Image source={{ uri: item.images[0] }} className="w-20 h-20 rounded-lg mr-2" />
        )}
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView className="flex-1 bg-[#fff]">
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

          {/* Search Button Positioned at Top Right */}
          <TouchableOpacity
            onPress={() => setMapModalVisible(true)} // Open the map modal
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
            <Text className="text-gray-900 font-bold">Search by City, State</Text>
          </TouchableOpacity>
        </View>
      </ImageBackground>

      {/* Categories Slider */}
      <FlatList
        data={categories}
        renderItem={renderCategoryItem}
        horizontal
        keyExtractor={(item) => item}
        showsHorizontalScrollIndicator={false}
        className="p-2"  // Reduced the height
      />

      {/* Listings Section Moved Up */}
      <View className="p-4">
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

      {/* Map Modal */}
      <Modal
        animationType="slide"
        transparent={false}
        visible={mapModalVisible}
        onRequestClose={() => setMapModalVisible(false)}
      >
        <View className="flex-1">
          {/* Search Bar on Top */}
          <View className="p-4 bg-white">
            <TextInput
              placeholder="Search by city, state"
              value={searchQuery}
              onChangeText={setSearchQuery}
              className="bg-gray-200 rounded-lg p-3 mb-4 shadow-sm"
            />
            <TouchableOpacity onPress={handleSearch} className="bg-[#007AFF] p-3 rounded-lg items-center shadow-sm">
              <Text className="text-white font-bold">Search</Text>
            </TouchableOpacity>
          </View>

          {/* Map View */}
          <MapView
            style={{ flex: 1 }}
            region={mapRegion}
          >
            {/* Example Marker */}
            <Marker
              coordinate={{ latitude: mapRegion.latitude, longitude: mapRegion.longitude }}
              title={"Example Location"}
              description={"This is an example marker."}
            />
          </MapView>

          {/* Close Button */}
          <TouchableOpacity
            onPress={() => setMapModalVisible(false)}
            className="p-4 bg-[#007AFF] items-center"
          >
            <Text className="text-white font-bold">Close</Text>
          </TouchableOpacity>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

export default Home;
