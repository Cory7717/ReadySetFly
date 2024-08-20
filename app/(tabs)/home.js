import React, { useEffect, useState } from "react";
import {
  ScrollView,
  Text,
  View,
  Image,
  TextInput,
  TouchableOpacity,
  FlatList,
  ImageBackground,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useUser } from "@clerk/clerk-expo";
import { db } from "../../firebaseConfig";
import { collection, getDocs, orderBy } from "firebase/firestore";
import { useNavigation } from "@react-navigation/native";
import wingtipClouds from "../../Assets/images/wingtip_clouds.jpg"; // Ensure correct path

const Home = () => {
  const { user } = useUser();
  const [searchQuery, setSearchQuery] = useState("");
  const [listings, setListings] = useState([]);
  const [filteredListings, setFilteredListings] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState("");
  const categories = [
    "Single Engine Piston",
    "Twin Engine Piston",
    "Turbo Prop",
    "Helicopter",
    "Jet",
  ];
  const navigation = useNavigation();

  useEffect(() => {
    getLatestItemList();
  }, []);

  const getLatestItemList = async () => {
    const querySnapShot = await getDocs(
      collection(db, "UserPost"),
      orderBy("createdAt", "desc")
    );
    const listingsData = [];
    querySnapShot.forEach((doc) => {
      listingsData.push(doc.data());
    });
    setListings(listingsData);
    setFilteredListings(listingsData); // Set the filtered listings to show all initially
  };

  const handleSearch = () => {
    const lowerCaseQuery = searchQuery.toLowerCase();
    const filteredData = listings.filter((listing) => {
      const city = listing.city ? listing.city.toLowerCase() : "";
      const state = listing.state ? listing.state.toLowerCase() : "";
      return city.includes(lowerCaseQuery) || state.includes(lowerCaseQuery);
    });
    setFilteredListings(filteredData);
  };

  const renderCategoryItem = ({ item }) => (
    <TouchableOpacity
      key={item}
      onPress={() => setSelectedCategory(item)}
      style={{
        padding: 10,
        backgroundColor: selectedCategory === item ? "gray" : "#f0f0f0",
        borderRadius: 8,
        marginRight: 10,
      }}
    >
      <Text style={{ fontSize: 14, fontWeight: "bold" }}>{item}</Text>
    </TouchableOpacity>
  );

  const renderListingItem = ({ item }) => (
    <TouchableOpacity
      onPress={() => navigation.navigate("FullScreenRental", { listing: item })}
      style={{
        padding: 10,
        backgroundColor: "#f0f0f0",
        borderRadius: 8,
        marginBottom: 10,
      }}
    >
      <Text style={{ fontSize: 16, fontWeight: "bold" }}>{item.title}</Text>
      <Text>${item.price} per hour</Text>
      <Text>{item.description}</Text>
      {item.photo && (
        <Image
          source={{ uri: item.photo }}
          style={{ width: 100, height: 100, marginTop: 10 }}
        />
      )}
    </TouchableOpacity>
  );

  return (
    <ImageBackground
      source={wingtipClouds}
      style={{ flex: 1 }}
      resizeMode="cover"
    >
      <SafeAreaView style={{ flex: 1 }}>
        <ScrollView>
          {/* Header */}
          <View style={{ flexDirection: "row", padding: 16, alignItems: "center" }}>
            <Image
              source={{ uri: user?.imageUrl }}
              style={{ width: 40, height: 40, borderRadius: 20, marginRight: 12 }}
            />
            <View>
              <Text style={{ fontSize: 16, color: "white" }}>Welcome</Text>
              <Text style={{ fontSize: 18, fontWeight: "bold", color: "white" }}>
                {user?.fullName}
              </Text>
            </View>
          </View>

          {/* Search Bar */}
          <View style={{ padding: 16 }}>
            <TextInput
              placeholder="Search by city, state"
              value={searchQuery}
              onChangeText={setSearchQuery}
              style={{
                backgroundColor: "#f0f0f0",
                borderRadius: 8,
                padding: 12,
                marginBottom: 16,
              }}
            />
            <TouchableOpacity
              onPress={handleSearch}
              style={{
                backgroundColor: "#007bff",
                padding: 12,
                borderRadius: 8,
                alignItems: "center",
              }}
            >
              <Text style={{ color: "white", fontWeight: "bold" }}>Search</Text>
            </TouchableOpacity>
          </View>

          {/* Categories Slider */}
          <View style={{ padding: 16 }}>
            <FlatList
              data={categories}
              renderItem={renderCategoryItem}
              horizontal
              keyExtractor={(item) => item}
              showsHorizontalScrollIndicator={false}
            />
          </View>

          {/* Listings */}
          <View style={{ padding: 16 }}>
            <Text
              style={{
                fontSize: 18,
                fontWeight: "bold",
                marginBottom: 10,
                color: "white",
              }}
            >
              Available Listings
            </Text>
            {filteredListings.length > 0 ? (
              <FlatList
                data={filteredListings}
                renderItem={renderListingItem}
                keyExtractor={(item, index) => index.toString()}
              />
            ) : (
              <Text style={{ color: "white" }}>No listings available</Text>
            )}
          </View>
        </ScrollView>
      </SafeAreaView>
    </ImageBackground>
  );
};

export default Home;
