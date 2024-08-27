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

  const getUserLocation = async () => {
    try {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert("Permission denied", "Permission to access location was denied");
        return;
      }

      let location = await Location.getCurrentPositionAsync({});
      const { latitude, longitude } = location.coords;
      const [address] = await Location.reverseGeocodeAsync({ latitude, longitude });

      if (address) {
        const city = address.city;
        const state = address.region;
        const geocodedLocation = await geocodeLocation(`${city}, ${state}`);
        if (geocodedLocation) {
          setMapRegion({
            latitude: geocodedLocation.latitude,
            longitude: geocodedLocation.longitude,
            latitudeDelta: 0.0922,
            longitudeDelta: 0.0421,
          });
        }
      }
    } catch (error) {
      Alert.alert("Error", "Failed to get user location.");
      console.error(error);
    }
  };

  useEffect(() => {
    if (mapModalVisible) {
      getUserLocation();
    }
  }, [mapModalVisible]);

  const renderCategoryItem = ({ item }) => (
    <TouchableOpacity
      key={item}
      onPress={() => setSelectedCategory(item)}
      style={{
        padding: 6,
        borderRadius: 10,
        marginRight: 8,
        backgroundColor: selectedCategory === item ? "#007AFF" : "#F2F2F2",
        height: 24,
      }}
    >
      <Text style={{
        fontSize: 12,
        fontWeight: 'bold',
        color: selectedCategory === item ? "white" : "gray",
      }}>
        {item}
      </Text>
    </TouchableOpacity>
  );

  const renderListingItem = ({ item }) => (
    <TouchableOpacity
      onPress={() => handleListingPress(item)}
      style={{
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        padding: 16,
        backgroundColor: "#F9F9F9",
        borderRadius: 10,
        marginBottom: 12,
        shadowOpacity: 0.1,
        shadowRadius: 4,
        shadowOffset: { width: 0, height: 2 },
        elevation: 2,
      }}
    >
      <View style={{ flex: 1, marginRight: 12 }}>
        <Text style={{ fontSize: 18, fontWeight: 'bold', color: "#333" }}>
          {item.airplaneModel}
        </Text>
        <Text style={{ color: "#FF3B30", marginBottom: 4 }}>
          ${item.ratesPerHour} per hour
        </Text>
        <Text style={{ color: "#666" }}>{item.description}</Text>
      </View>
      <View style={{ flexDirection: "row", alignItems: "center" }}>
        {item.images && item.images[0] && (
          <Image source={{ uri: item.images[0] }} style={{ width: 80, height: 80, borderRadius: 10 }} />
        )}
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#fff" }}>
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
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <View>
            <Text style={{ fontSize: 14, color: "white" }}>Good Morning,</Text>
            <Text style={{ fontSize: 18, fontWeight: "bold", color: "white" }}>{user?.fullName}</Text>
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
            <Text style={{ color: "#333", fontWeight: "bold" }}>Search by City, State</Text>
          </TouchableOpacity>
        </View>
      </ImageBackground>

      {/* Scrollable Area for Sliders and Listings */}
      <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
        {/* Categories Slider */}
        <View style={{ maxHeight: 60 }}>
          <FlatList
            data={categories}
            renderItem={renderCategoryItem}
            horizontal
            keyExtractor={(item) => item}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ padding: 8 }}
          />
        </View>

        {/* Listings Section */}
        <View style={{ padding: 16 }}>
          <Text style={{ fontSize: 18, fontWeight: "bold", marginBottom: 8, color: "#333" }}>Available Listings</Text>
          {filteredListings.length > 0 ? (
            <FlatList
              data={filteredListings}
              renderItem={renderListingItem}
              keyExtractor={(item) => item.id}
            />
          ) : (
            <Text style={{ textAlign: "center", color: "gray", marginTop: 16 }}>No listings available</Text>
          )}
        </View>
      </ScrollView>

      {/* Map Modal */}
      <Modal
        animationType="slide"
        transparent={false}
        visible={mapModalVisible}
        onRequestClose={() => setMapModalVisible(false)}
      >
        <SafeAreaView style={{ flex: 1, backgroundColor: "#fff" }}>
          <ImageBackground
            source={PropellerImage} // Reuse background image for consistency
            style={{
              height: 187.5,
              justifyContent: "flex-start",
              paddingTop: 10,
              paddingHorizontal: 10,
            }}
            imageStyle={{ resizeMode: "cover" }}
          >
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <View>
                <Text style={{ fontSize: 14, color: "white" }}>Map View</Text>
              </View>

              {/* Close Button Positioned at Top Right */}
              <TouchableOpacity
                onPress={() => setMapModalVisible(false)}
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
                <Text style={{ color: "#333", fontWeight: "bold" }}>Close</Text>
              </TouchableOpacity>
            </View>
          </ImageBackground>

          {/* Search Bar */}
          <View style={{ padding: 16, backgroundColor: "#fff" }}>
            <TextInput
              placeholder="Search by city, state"
              value={searchQuery}
              onChangeText={setSearchQuery}
              style={{
                backgroundColor: "#e0e0e0",
                borderRadius: 10,
                padding: 12,
                marginBottom: 16,
                shadowOpacity: 0.1,
                shadowRadius: 4,
                shadowOffset: { width: 0, height: 2 },
                elevation: 2,
              }}
            />
            <TouchableOpacity onPress={handleSearch} style={{ backgroundColor: "#007AFF", padding: 12, borderRadius: 10, alignItems: "center", shadowOpacity: 0.1, shadowRadius: 4, shadowOffset: { width: 0, height: 2 }, elevation: 2 }}>
              <Text style={{ color: "white", fontWeight: "bold" }}>Search</Text>
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
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
};

export default Home;
