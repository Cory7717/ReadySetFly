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
  SafeAreaView,
} from "react-native";
import { useUser } from "@clerk/clerk-expo";
import { db } from "../../firebaseConfig";
import {
  collection,
  onSnapshot,
  query,
  orderBy,
  where,
  addDoc,
} from "firebase/firestore";
import { Ionicons } from "@expo/vector-icons";
import wingtipClouds from "../../Assets/images/wingtip_clouds.jpg";

const Home = ({ route, navigation }) => {
  const { user } = useUser();
  const [listings, setListings] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState("");
  const [selectedListing, setSelectedListing] = useState(null);
  const [imageIndex, setImageIndex] = useState(0);
  const [fullScreenModalVisible, setFullScreenModalVisible] = useState(false);
  const [filter, setFilter] = useState({
    make: "",
    location: "",
  });
  const [rentalHours, setRentalHours] = useState(1);
  const [totalCost, setTotalCost] = useState({
    rentalCost: "0.00",
    bookingFee: "0.00",
    transactionFee: "0.00",
    salesTax: "0.00",
    total: "0.00",
  });

  const categories = [
    "Single Engine Piston",
    "Twin Engine Piston",
    "Turbo Prop",
    "Helicopter",
    "Jet",
  ];

  useEffect(() => {
    if (!user) {
      Alert.alert("Error", "User is not authenticated.");
      return;
    }
    const unsubscribe = subscribeToListings();
    return () => unsubscribe();
  }, [user]);

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

    return onSnapshot(
      q,
      (snapshot) => {
        const listingsData = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        setListings(listingsData);
      },
      (error) => {
        console.error("Error fetching listings: ", error);
        if (error.code === "permission-denied") {
          Alert.alert(
            "Permission Denied",
            "You do not have permission to access these listings."
          );
        }
      }
    );
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

  const handleSendRentalRequest = async () => {
    if (!selectedListing) return;

    const rentalCost = parseFloat(selectedListing.ratesPerHour) * rentalHours;
    const ownerCost = rentalCost - rentalCost * 0.06;

    const messageData = {
        senderId: user.id,
        senderName: user.fullName,
        airplaneModel: selectedListing.airplaneModel,
        rentalPeriod: `2024-09-01 to 2024-09-07`, // Replace with actual data
        totalCost: ownerCost.toFixed(2),
        contact: user.email || "noemail@example.com",  // Fallback to a default value
        createdAt: new Date(),
    };

    try {
        await addDoc(
            collection(db, "owners", selectedListing.ownerId, "rentalRequests"),
            messageData
        );
        Alert.alert(
            "Request Sent",
            "Your rental request has been sent to the owner."
        );
        setFullScreenModalVisible(false);
    } catch (error) {
        console.error("Error sending rental request: ", error);
        if (error.code === "permission-denied") {
            Alert.alert(
                "Permission Denied",
                "You do not have permission to send this request."
            );
        } else {
            Alert.alert("Error", "Failed to send rental request to the owner.");
        }
    }
};


  const handleNextImage = () => {
    if (selectedListing && imageIndex < selectedListing.images.length - 1) {
      setImageIndex(imageIndex + 1);
    }
  };

  const handlePreviousImage = () => {
    if (selectedListing && imageIndex > 0) {
      setImageIndex(imageIndex - 1);
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
            <Text className="text-sm text-white pt-5">Good Morning</Text>
            <Text className="text-lg font-bold text-white">
              {user?.fullName}
            </Text>
          </View>
        </View>
      </ImageBackground>

      <ScrollView contentContainerStyle={{ padding: 16 }}>
        <View className="flex-row justify-between mb-4">
          <Text className="text-lg text-gray-800">
            Filter by location or Aircraft Make
          </Text>
          <TouchableOpacity
            onPress={() =>
              Alert.alert("Filter Modal", "This will open the filter modal")
            }
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
              className={`p-2 ${
                selectedCategory === item ? "bg-gray-500" : "bg-gray-200"
              } rounded-md mr-2`}
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
                  setImageIndex(0);
                  setFullScreenModalVisible(true);
                }}
                className="flex-row justify-between items-center p-4 bg-gray-200 rounded-md"
              >
                <View className="flex-1">
                  <Text className="text-lg font-bold">
                    {item.airplaneModel}
                  </Text>
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
          <Text className="text-center text-gray-700">
            No listings available
          </Text>
        )}
      </ScrollView>

      {/* Full Screen Listing Details Modal */}
      <Modal
        animationType="slide"
        transparent={false}
        visible={fullScreenModalVisible}
        onRequestClose={() => setFullScreenModalVisible(false)}
      >
        <SafeAreaView className="flex-1 bg-white">
          {selectedListing && (
            <View className="p-4 flex-1">
              <TouchableOpacity
                onPress={() => setFullScreenModalVisible(false)}
              >
                <Ionicons name="close" size={30} color="black" />
              </TouchableOpacity>
              <View className="flex-row justify-between items-center mb-4">
                <TouchableOpacity onPress={handlePreviousImage}>
                  <Ionicons name="arrow-back" size={30} color="black" />
                </TouchableOpacity>
                <Image
                  source={{ uri: selectedListing.images[imageIndex] }}
                  style={{
                    width: 300,
                    height: 200,
                    alignSelf: "center",
                    borderRadius: 10,
                  }}
                  resizeMode="cover"
                />
                <TouchableOpacity onPress={handleNextImage}>
                  <Ionicons name="arrow-forward" size={30} color="black" />
                </TouchableOpacity>
              </View>
              <ScrollView className="flex-1">
                <Text className="text-3xl font-bold mb-4 text-center">
                  {selectedListing.airplaneModel}
                </Text>
                <Text className="text-xl mb-2 text-center">
                  ${selectedListing.ratesPerHour} per hour
                </Text>
                <Text className="mb-4 text-center">
                  {selectedListing.description}
                </Text>

                <View className="flex-row items-center justify-between mb-4">
                  <Text className="font-bold text-lg">Rental Hours</Text>
                  <TextInput
                    value={String(rentalHours)}
                    onChangeText={(text) => setRentalHours(Number(text))}
                    keyboardType="numeric"
                    className="border border-gray-300 p-2 rounded-md w-24 text-center"
                  />
                </View>

                <View className="mb-4">
                  <Text className="font-bold">Total Cost</Text>
                  <Text>Rental Cost: ${totalCost.rentalCost}</Text>
                  <Text>Booking Fee: ${totalCost.bookingFee}</Text>
                  <Text>Transaction Fee: ${totalCost.transactionFee}</Text>
                  <Text>Sales Tax: ${totalCost.salesTax}</Text>
                  <Text className="font-bold">Total: ${totalCost.total}</Text>
                </View>

                <TouchableOpacity
                  onPress={handleSendRentalRequest}
                  className="bg-blue-500 p-4 rounded-lg mt-4"
                >
                  <Text className="text-white text-center font-bold">
                    Send Rental Request
                  </Text>
                </TouchableOpacity>
              </ScrollView>
            </View>
          )}
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
};

export default Home;
