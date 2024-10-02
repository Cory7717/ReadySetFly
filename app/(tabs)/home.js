import React, { useEffect, useState, useRef } from "react";
import {
  Text,
  View,
  TextInput,
  TouchableOpacity,
  Modal,
  ImageBackground,
  Image,
  Alert,
  SafeAreaView,
  Animated,
  FlatList,
  ScrollView,
} from "react-native";
import { useUser, useAuth } from "@clerk/clerk-expo";
import { db } from "../../firebaseConfig";
import {
  collection,
  onSnapshot,
  query,
  orderBy,
  where,
  addDoc,
  deleteDoc,
  doc,
} from "firebase/firestore";
import { Ionicons } from "@expo/vector-icons";
import wingtipClouds from "../../Assets/images/wingtip_clouds.jpg";
import { useStripe } from "@stripe/stripe-react-native";
import { Calendar } from "react-native-calendars";

const Home = ({ route, navigation }) => {
  const { user } = useUser();
  const { signOut } = useAuth();
  const stripe = useStripe();
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
  const [rentalDate, setRentalDate] = useState(null); // State for the selected rental date
  const [calendarModalVisible, setCalendarModalVisible] = useState(false); // State for calendar modal visibility
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

  const scrollY = useRef(new Animated.Value(0)).current;

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

  useEffect(() => {
    if (route?.params?.newListing) {
      setListings((prevListings) => [route.params.newListing, ...prevListings]);
    }

    if (route?.params?.unlistedId) {
      setListings((prevListings) =>
        prevListings.filter((listing) => listing.id !== route.params.unlistedId)
      );
    }
  }, [route?.params?.newListing, route?.params?.unlistedId]);

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

        listingsData.forEach((listing) => {
          if (!Array.isArray(listing.images)) {
            listing.images = [listing.images]; // Convert to array if it's not
          }
        });

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

    if (!rentalDate) {
      Alert.alert("Error", "Please select a rental date.");
      return;
    }

    const rentalCost = parseFloat(selectedListing.ratesPerHour) * rentalHours;
    const bookingFee = rentalCost * 0.06;
    const transactionFee = rentalCost * 0.03;
    const salesTax = rentalCost * 0.0825;
    const totalCostValue = rentalCost + bookingFee + transactionFee + salesTax;

    try {
      const rentalRequestData = {
        renterId: user.id,
        renterName: user.fullName,
        ownerId: selectedListing.ownerId,
        airplaneModel: selectedListing.airplaneModel,
        rentalPeriod: rentalDate, // Include selected rental date
        totalCost: totalCostValue.toFixed(2),
        contact: user.email || "noemail@example.com",
        createdAt: new Date(),
        status: "pending",
      };

      // Correct the path to add the rental request to the owner's rentalRequests subcollection
      const rentalRequestRef = await addDoc(
        collection(db, "owners", selectedListing.ownerId, "rentalRequests"),
        rentalRequestData
      );

      // Create initial message in messages subcollection under the rental request
      await addDoc(
        collection(db, "owners", selectedListing.ownerId, "rentalRequests", rentalRequestRef.id, "messages"),
        {
          senderId: user.id,
          senderName: user.fullName,
          text: `Hi, I would like to rent your ${selectedListing.airplaneModel} on ${rentalDate}.`,
          createdAt: new Date(),
        }
      );

      Alert.alert(
        "Request Sent",
        "Your rental request has been sent to the owner. You will be notified once the owner reviews the request."
      );
      setFullScreenModalVisible(false);
    } catch (error) {
      console.error("Error sending rental request: ", error);
      Alert.alert("Error", "Failed to send rental request to the owner.");
    }
  };

  const handleDateSelection = (day) => {
    setRentalDate(day.dateString);
    setCalendarModalVisible(false);
  };

  const handleDeleteListing = async (listingId) => {
    try {
      await deleteDoc(doc(db, "airplanes", listingId));
      setListings((prevListings) =>
        prevListings.filter((listing) => listing.id !== listingId)
      );
      Alert.alert("Deleted", "The listing has been deleted.");
    } catch (error) {
      console.error("Error deleting listing: ", error);
      Alert.alert("Error", "Failed to delete the listing.");
    }
  };

  const handleEditListing = async (listingId) => {
    Alert.alert("Edit Listing", `This would edit the listing with ID ${listingId}`);
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

  const headerHeight = scrollY.interpolate({
    inputRange: [0, 150],
    outputRange: [200, 70],
    extrapolate: "clamp",
  });

  const headerFontSize = scrollY.interpolate({
    inputRange: [0, 150],
    outputRange: [24, 16],
    extrapolate: "clamp",
  });

  const headerPaddingTop = scrollY.interpolate({
    inputRange: [0, 150],
    outputRange: [40, 10],
    extrapolate: "clamp",
  });

  const handleLogout = () => {
    Alert.alert(
      "Confirm Logout",
      "Are you sure you want to log out?",
      [
        {
          text: "Cancel",
          style: "cancel",
        },
        {
          text: "Logout",
          onPress: async () => {
            await signOut();
            navigation.replace("SignIn");
          },
        },
      ],
      { cancelable: false }
    );
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "white" }}>
      <Animated.View
        style={{
          height: headerHeight,
          overflow: "hidden",
        }}
      >
        <ImageBackground
          source={wingtipClouds}
          style={{
            flex: 1,
            justifyContent: "flex-end",
          }}
          resizeMode="cover"
        >
          <Animated.View
            style={{
              paddingHorizontal: 16,
              paddingTop: headerPaddingTop,
              paddingBottom: 20,
              flexDirection: "row",
              justifyContent: "space-between",
            }}
          >
            <View>
              <Animated.Text
                style={{
                  fontSize: headerFontSize,
                  color: "white",
                  fontWeight: "bold",
                }}
              >
                Good Morning
              </Animated.Text>
              <Animated.Text
                style={{
                  fontSize: Animated.add(headerFontSize, 6),
                  color: "white",
                  fontWeight: "bold",
                }}
              >
                {user?.fullName}
              </Animated.Text>
            </View>
            <TouchableOpacity onPress={handleLogout}>
              <Ionicons name="log-out-outline" size={28} color="white" />
            </TouchableOpacity>
          </Animated.View>
        </ImageBackground>
      </Animated.View>

      <Animated.ScrollView
        contentContainerStyle={{ padding: 16 }}
        scrollEventThrottle={16}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: false }
        )}
      >
        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            marginBottom: 16,
          }}
        >
          <Text style={{ fontSize: 18, color: "#4A4A4A" }}>
            Filter by location or Aircraft Make
          </Text>
          <TouchableOpacity
            onPress={() =>
              Alert.alert("Filter Modal", "This will open the filter modal")
            }
            style={{ backgroundColor: "#E2E2E2", padding: 8, borderRadius: 50 }}
          >
            <Ionicons name="filter" size={24} color="gray" />
          </TouchableOpacity>
        </View>

        <FlatList
          data={categories}
          renderItem={({ item }) => (
            <TouchableOpacity
              onPress={() => setSelectedCategory(item)}
              style={{
                padding: 8,
                backgroundColor:
                  selectedCategory === item ? "#808080" : "#E2E2E2",
                borderRadius: 8,
                marginRight: 8,
              }}
            >
              <Text style={{ fontSize: 14, fontWeight: "bold" }}>{item}</Text>
            </TouchableOpacity>
          )}
          horizontal
          keyExtractor={(item) => item}
          showsHorizontalScrollIndicator={false}
          style={{ marginBottom: 16 }}
        />
        <Text
          style={{
            fontSize: 24,
            fontWeight: "bold",
            marginBottom: 16,
            textAlign: "center",
            color: "#2d3748",
          }}
        >
          Available Listings
        </Text>

        {listings.length > 0 ? (
          listings.map((item) => (
            <View style={{ marginBottom: 20 }} key={item.id}>
              <TouchableOpacity
                onPress={() => {
                  setSelectedListing(item);
                  setImageIndex(0);
                  setFullScreenModalVisible(true);
                }}
                style={{
                  borderRadius: 10,
                  overflow: "hidden",
                  backgroundColor: "white",
                  shadowColor: "#000",
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: 0.2,
                  shadowRadius: 2,
                }}
              >
                {item.images && item.images.length > 0 && (
                  <ImageBackground
                    source={{ uri: item.images[0] }}
                    style={{ height: 200, justifyContent: "space-between" }}
                    imageStyle={{ borderRadius: 10 }}
                  >
                    <View
                      style={{
                        flexDirection: "row",
                        justifyContent: "space-between",
                        padding: 8,
                      }}
                    >
                      <Text
                        style={{
                          backgroundColor: "#000000a0",
                          color: "white",
                          padding: 4,
                          borderRadius: 5,
                        }}
                      >
                        {item.location}
                      </Text>
                      <Text
                        style={{
                          backgroundColor: "#000000a0",
                          color: "white",
                          padding: 4,
                          borderRadius: 5,
                        }}
                      >
                        ${item.ratesPerHour}/hour
                      </Text>
                    </View>
                  </ImageBackground>
                )}
                <View style={{ padding: 10 }}>
                  <Text
                    style={{
                      fontSize: 18,
                      fontWeight: "bold",
                      color: "#2d3748",
                    }}
                  >
                    {item.airplaneModel}
                  </Text>
                  <Text
                    numberOfLines={2}
                    style={{
                      color: "#4a5568",
                    }}
                  >
                    {item.description}
                  </Text>
                </View>
              </TouchableOpacity>
              {item.ownerId === user.id && (
                <View
                  style={{
                    flexDirection: "row",
                    justifyContent: "flex-end",
                    marginTop: 8,
                  }}
                >
                  <TouchableOpacity
                    onPress={() => handleEditListing(item.id)}
                    style={{
                      backgroundColor: "#1E90FF",
                      padding: 8,
                      borderRadius: 8,
                      marginRight: 8,
                    }}
                  >
                    <Text style={{ color: "white" }}>Edit</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => handleDeleteListing(item.id)}
                    style={{
                      backgroundColor: "#FF6347",
                      padding: 8,
                      borderRadius: 8,
                    }}
                  >
                    <Text style={{ color: "white" }}>Delete</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          ))
        ) : (
          <Text style={{ textAlign: "center", color: "#4a5568" }}>
            No listings available
          </Text>
        )}
      </Animated.ScrollView>

      <Modal
        animationType="slide"
        transparent={false}
        visible={fullScreenModalVisible}
        onRequestClose={() => setFullScreenModalVisible(false)}
      >
        <SafeAreaView style={{ flex: 1, backgroundColor: "white" }}>
          {selectedListing && selectedListing.images && (
            <View style={{ padding: 16, flex: 1 }}>
              <TouchableOpacity
                onPress={() => setFullScreenModalVisible(false)}
              >
                <Ionicons name="close" size={30} color="black" />
              </TouchableOpacity>
              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: 16,
                }}
              >
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
              <ScrollView style={{ flex: 1 }}>
                <Text
                  style={{
                    fontSize: 28,
                    fontWeight: "bold",
                    marginBottom: 16,
                    textAlign: "center",
                    color: "#2d3748",
                  }}
                >
                  {selectedListing.airplaneModel}
                </Text>
                <Text
                  style={{
                    fontSize: 22,
                    marginBottom: 16,
                    textAlign: "center",
                    color: "#2d3748",
                  }}
                >
                  ${selectedListing.ratesPerHour} per hour
                </Text>
                <Text
                  style={{
                    marginBottom: 16,
                    textAlign: "center",
                    color: "#4a5568",
                  }}
                >
                  {selectedListing.description}
                </Text>

                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-between",
                    marginBottom: 16,
                  }}
                >
                  <Text style={{ fontWeight: "bold", fontSize: 18 }}>
                    Rental Hours
                  </Text>
                  <TextInput
                    value={String(rentalHours)}
                    onChangeText={(text) => setRentalHours(Number(text))}
                    keyboardType="numeric"
                    style={{
                      borderColor: "#CBD5E0",
                      borderWidth: 1,
                      padding: 8,
                      borderRadius: 8,
                      width: 80,
                      textAlign: "center",
                    }}
                  />
                </View>

                {/* Calendar Button */}
                <TouchableOpacity
                  onPress={() => setCalendarModalVisible(true)}
                  style={{
                    backgroundColor: "#1E90FF",
                    padding: 12,
                    borderRadius: 8,
                    marginBottom: 16,
                  }}
                >
                  <Text
                    style={{
                      color: "white",
                      textAlign: "center",
                      fontWeight: "bold",
                    }}
                  >
                    Select Rental Date
                  </Text>
                </TouchableOpacity>

                {rentalDate && (
                  <Text style={{ marginBottom: 16, textAlign: "center" }}>
                    Selected Rental Date: {rentalDate}
                  </Text>
                )}

                <View style={{ marginBottom: 16 }}>
                  <Text style={{ fontWeight: "bold" }}>Total Cost</Text>
                  <Text>Rental Cost: ${totalCost.rentalCost}</Text>
                  <Text>Booking Fee: ${totalCost.bookingFee}</Text>
                  <Text>Transaction Fee: ${totalCost.transactionFee}</Text>
                  <Text>Sales Tax: ${totalCost.salesTax}</Text>
                  <Text style={{ fontWeight: "bold" }}>
                    Total: ${totalCost.total}
                  </Text>
                </View>

                <TouchableOpacity
                  onPress={handleSendRentalRequest}
                  style={{
                    backgroundColor: "#1E90FF",
                    padding: 16,
                    borderRadius: 8,
                    marginTop: 16,
                  }}
                >
                  <Text
                    style={{
                      color: "white",
                      textAlign: "center",
                      fontWeight: "bold",
                    }}
                  >
                    Send Rental Request
                  </Text>
                </TouchableOpacity>
              </ScrollView>
            </View>
          )}
        </SafeAreaView>
      </Modal>

      {/* Calendar Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={calendarModalVisible}
        onRequestClose={() => setCalendarModalVisible(false)}
      >
        <View style={{ flex: 1, backgroundColor: "white" }}>
          <Calendar
            onDayPress={handleDateSelection}
            markedDates={
              rentalDate ? { [rentalDate]: { selected: true, marked: true, dotColor: "red" } } : {}
            }
          />
          <TouchableOpacity
            onPress={() => setCalendarModalVisible(false)}
            style={{
              backgroundColor: "#1E90FF",
              padding: 16,
              borderRadius: 8,
              margin: 16,
            }}
          >
            <Text style={{ color: "white", textAlign: "center", fontWeight: "bold" }}>
              Close Calendar
            </Text>
          </TouchableOpacity>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

export default Home;
