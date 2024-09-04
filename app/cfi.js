import React, { useState } from "react";
import {
  StyleSheet,
  Text,
  View,
  Image,
  TextInput,
  TouchableOpacity,
  FlatList,
  Modal,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { FontAwesome } from "@expo/vector-icons"; // For star ratings
import MapView, { Marker } from "react-native-maps";

// Dummy function to calculate distance (replace with real implementation if necessary)
const calculateDistance = (lat1, lon1, lat2, lon2) => {
  const toRadians = (degrees) => (degrees * Math.PI) / 180;
  const R = 6371; // Radius of the Earth in km
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c * 0.621371; // Convert to miles
  return distance;
};

const FlightSchoolSearch = () => {
  const INITIAL_REGION = {
    latitude: 30.2666666,
    longitude: -97.73333,
    latitudeDelta: 1,
    longitudeDelta: 1,
  };

  const [searchQuery, setSearchQuery] = useState("");
  const [modalVisible, setModalVisible] = useState(false);
  const [newSchool, setNewSchool] = useState({
    name: "",
    location: "",
    contact: "",
    rating: "",
    latitude: "",
    longitude: "",
  });
  const [flightSchools, setFlightSchools] = useState([
    {
      id: 1,
      name: "Austin Flight School",
      location: "Austin, TX",
      latitude: 30.2672,
      longitude: -97.7431,
      contact: "123-456-7890",
      rating: 4.5,
    },
    {
      id: 2,
      name: "Houston Aviation Academy",
      location: "Houston, TX",
      latitude: 29.7604,
      longitude: -95.3698,
      contact: "987-654-3210",
      rating: 4.7,
    },
    {
      id: 3,
      name: "Dallas Flying Academy",
      location: "Dallas, TX",
      latitude: 32.7767,
      longitude: -96.7970,
      contact: "555-555-5555",
      rating: 4.2,
    },
  ]);

  const userLocation = { latitude: 30.2672, longitude: -97.7431 }; // Example coordinates for Austin, TX

  const filteredSchools = flightSchools.filter((school) => {
    const distance = calculateDistance(
      userLocation.latitude,
      userLocation.longitude,
      school.latitude,
      school.longitude
    );
    return distance <= 50 && school.location.toLowerCase().includes(searchQuery.toLowerCase());
  });

  const handleListYourSchool = () => {
    if (
      !newSchool.name ||
      !newSchool.location ||
      !newSchool.contact ||
      !newSchool.rating ||
      !newSchool.latitude ||
      !newSchool.longitude
    ) {
      Alert.alert("Error", "Please fill in all fields.");
      return;
    }

    const newSchoolListing = {
      id: flightSchools.length + 1,
      name: newSchool.name,
      location: newSchool.location,
      contact: newSchool.contact,
      rating: parseFloat(newSchool.rating),
      latitude: parseFloat(newSchool.latitude),
      longitude: parseFloat(newSchool.longitude),
    };

    // Add the new school to the list of flight schools
    setFlightSchools((prevSchools) => [...prevSchools, newSchoolListing]);

    Alert.alert(
      "Listing Submitted",
      `Your flight school "${newSchool.name}" has been listed for $125/month.`
    );
    setModalVisible(false);

    // Reset form after submission
    setNewSchool({
      name: "",
      location: "",
      contact: "",
      rating: "",
      latitude: "",
      longitude: "",
    });
  };

  const renderSchoolCard = ({ item }) => (
    <View style={styles.schoolCard}>
      <View style={styles.schoolInfo}>
        <Text style={styles.schoolName}>{item.name}</Text>
        <Text style={styles.schoolLocation}>{item.location}</Text>
        <Text style={styles.schoolContact}>Contact: {item.contact}</Text>
        <View style={styles.ratingContainer}>
          <Text style={styles.ratingText}>{item.rating.toFixed(1)}</Text>
          <FontAwesome name="star" size={16} color="#FFD700" />
        </View>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <FlatList
        data={filteredSchools}
        renderItem={renderSchoolCard}
        keyExtractor={(item) => item.id.toString()}
        ListHeaderComponent={
          <>
            <View style={styles.header}>
              <TouchableOpacity>
                <Image
                  source={require("../Assets/images/icononly_nobuffer.png")}
                  style={styles.logo}
                />
              </TouchableOpacity>
              <View>
                <Text style={styles.titleSmall}>Search for Flight Schools</Text>
                <Text style={styles.titleLarge}>Find the best near you!</Text>
              </View>
              <TouchableOpacity
                style={styles.listButton}
                onPress={() => setModalVisible(true)}
              >
                <Text style={styles.listButtonText}>List Your School</Text>
              </TouchableOpacity>
            </View>

            {/* Search Bar */}
            <TouchableOpacity>
              <View style={styles.searchContainer}>
                <Feather name="search" size={24} color="grey" style={styles.searchIcon} />
                <TextInput
                  style={styles.searchInput}
                  placeholder="Enter city, state"
                  value={searchQuery}
                  onChangeText={(value) => setSearchQuery(value)}
                />
              </View>
            </TouchableOpacity>

            <Text style={styles.sectionTitle}>Flight Schools</Text>
          </>
        }
        style={styles.list}
      />

      {/* Map */}
      <View style={styles.mapContainer}>
        <MapView initialRegion={INITIAL_REGION} style={styles.map}>
          {filteredSchools.map((school) => (
            <Marker
              key={school.id}
              coordinate={{ latitude: school.latitude, longitude: school.longitude }}
              title={school.name}
            />
          ))}
        </MapView>
      </View>

      {/* Modal for Adding Flight School */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>List Your Flight School</Text>

            <TextInput
              style={styles.modalInput}
              placeholder="School Name"
              value={newSchool.name}
              onChangeText={(text) => setNewSchool({ ...newSchool, name: text })}
            />
            <TextInput
              style={styles.modalInput}
              placeholder="Location (City, State)"
              value={newSchool.location}
              onChangeText={(text) => setNewSchool({ ...newSchool, location: text })}
            />
            <TextInput
              style={styles.modalInput}
              placeholder="Contact Information"
              value={newSchool.contact}
              onChangeText={(text) => setNewSchool({ ...newSchool, contact: text })}
            />
            <TextInput
              style={styles.modalInput}
              placeholder="Google Star Rating"
              value={newSchool.rating}
              onChangeText={(text) => setNewSchool({ ...newSchool, rating: text })}
              keyboardType="numeric"
            />
            <TextInput
              style={styles.modalInput}
              placeholder="Latitude"
              value={newSchool.latitude}
              onChangeText={(text) => setNewSchool({ ...newSchool, latitude: text })}
              keyboardType="numeric"
            />
            <TextInput
              style={styles.modalInput}
              placeholder="Longitude"
              value={newSchool.longitude}
              onChangeText={(text) => setNewSchool({ ...newSchool, longitude: text })}
              keyboardType="numeric"
            />

            <TouchableOpacity
              style={styles.modalButton}
              onPress={handleListYourSchool}
            >
              <Text style={styles.modalButtonText}>Submit ($125/month)</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.modalCancelButton}
              onPress={() => setModalVisible(false)}
            >
              <Text style={styles.modalCancelButtonText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "white",
  },
  header: {
    flexDirection: "row",
    padding: 20,
    alignItems: "center",
  },
  logo: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  titleSmall: {
    fontSize: 14,
    fontFamily: "Rubik-Black",
    marginLeft: 20,
    color: "#333",
  },
  titleLarge: {
    fontSize: 20,
    fontFamily: "Rubik-Black",
    marginLeft: 20,
    color: "#333",
  },
  listButton: {
    marginLeft: "auto",
    backgroundColor: "#3182CE",
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 25,
  },
  listButtonText: {
    color: "white",
    fontSize: 14,
    fontWeight: "bold",
  },
  searchContainer: {
    flexDirection: "row",
    backgroundColor: "#f0f0f0",
    borderRadius: 25,
    padding: 10,
    marginHorizontal: 20,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#ccc",
    marginBottom: 20,
  },
  searchIcon: {
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 18,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#333",
    paddingHorizontal: 20,
    marginBottom: 10,
  },
  list: {
    marginBottom: 20,
  },
  schoolCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 20,
    marginBottom: 16,
    borderColor: "#ddd",
    borderWidth: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  schoolInfo: {
    flexDirection: "column",
  },
  schoolName: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#333",
  },
  schoolLocation: {
    fontSize: 14,
    color: "#777",
    marginTop: 4,
  },
  schoolContact: {
    fontSize: 14,
    color: "#777",
    marginTop: 4,
  },
  ratingContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 6,
  },
  ratingText: {
    fontSize: 14,
    marginRight: 4,
    color: "#333",
  },
  mapContainer: {
    flex: 1,
    padding: 20,
  },
  map: {
    flex: 1,
    height: 300,
  },
  modalContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.5)",
  },
  modalContent: {
    backgroundColor: "white",
    padding: 20,
    borderRadius: 10,
    width: "80%",
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 16,
    textAlign: "center",
  },
  modalInput: {
    borderColor: "#ccc",
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
    marginBottom: 10,
    fontSize: 16,
  },
  modalButton: {
    backgroundColor: "#3182CE",
    padding: 15,
    borderRadius: 10,
    alignItems: "center",
  },
  modalButtonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "bold",
  },
  modalCancelButton: {
    marginTop: 10,
    alignItems: "center",
  },
  modalCancelButtonText: {
    color: "#555",
    fontSize: 16,
  },
});

export default FlightSchoolSearch;
