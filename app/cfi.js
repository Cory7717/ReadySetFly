import React, { useState } from "react";
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  Image,
  TextInput,
  TouchableOpacity,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import MapView, { Marker } from "react-native-maps";
import { Feather } from "@expo/vector-icons";

const CFI = () => {
  const INITIAL_REGION = {
    latitude: 30.2666666,
    longitude: -97.73333,
    latitudeDelta: 1,
    longitudeDelta: 1,
  };

  const [searchQuery, setSearchQuery] = useState("");

  // Dummy flight schools data (for demonstration purposes)
  const flightSchools = [
    { id: 1, name: "Austin Flight School", latitude: 30.2672, longitude: -97.7431 },
    { id: 2, name: "Houston Aviation Academy", latitude: 29.7604, longitude: -95.3698 },
    { id: 3, name: "Dallas Flying Academy", latitude: 32.7767, longitude: -96.7970 },
  ];

  const filteredSchools = flightSchools.filter((school) =>
    school.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        <View style={styles.header}>
          <TouchableOpacity>
            <Image
              source={require("../Assets/images/icononly_nobuffer.png")}
              style={styles.logo}
            />
          </TouchableOpacity>
          <View>
            <Text style={styles.titleSmall}>Search for flight instructors</Text>
            <Text style={styles.titleLarge}>in your area!</Text>
          </View>
        </View>

        <TouchableOpacity>
          <View style={styles.searchContainer}>
            <Feather name="search" size={24} color="grey" style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search"
              value={searchQuery}
              onChangeText={(value) => setSearchQuery(value)}
            />
          </View>
        </TouchableOpacity>

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
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'white',
  },
  scrollContainer: {
    flexGrow: 1,
  },
  header: {
    flexDirection: 'row',
    padding: 20,
    alignItems: 'center',
  },
  logo: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  titleSmall: {
    fontSize: 14,
    fontFamily: 'Rubik-Black',
    marginLeft: 20,
  },
  titleLarge: {
    fontSize: 20,
    fontFamily: 'Rubik-Black',
    marginLeft: 20,
  },
  searchContainer: {
    flexDirection: 'row',
    backgroundColor: '#f0f0f0',
    borderRadius: 25,
    padding: 10,
    marginHorizontal: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ccc',
  },
  searchIcon: {
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 18,
  },
  mapContainer: {
    flex: 1,
    paddingTop: 20,
  },
  map: {
    flex: 1,
    height: 400,
  },
});

export default CFI;
