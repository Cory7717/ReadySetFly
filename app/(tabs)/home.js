
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
import { onAuthStateChanged } from "firebase/auth";
import { db, auth } from "../../firebaseConfig";
import {
  collection,
  onSnapshot,
  query,
  orderBy,
  where,
  deleteDoc,
  doc,
  addDoc, // Imported addDoc for Firestore write operations
} from "firebase/firestore";
import { Ionicons } from "@expo/vector-icons";
import wingtipClouds from "../../Assets/images/wingtip_clouds.jpg";
import { Calendar } from "react-native-calendars";

const Home = ({ route, navigation }) => {
  const [user, setUser] = useState(null); // State to store Firebase user
  const [listings, setListings] = useState([]);
  const [selectedListing, setSelectedListing] = useState(null);
  const [imageIndex, setImageIndex] = useState(0);
  const [fullScreenModalVisible, setFullScreenModalVisible] = useState(false);
  const [filter, setFilter] = useState({
    make: "",
    location: "",
  });
  const [rentalHours, setRentalHours] = useState(1);
  const [rentalDate, setRentalDate] = useState(null);
  const [calendarModalVisible, setCalendarModalVisible] = useState(false);
  const [totalCost, setTotalCost] = useState({
    rentalCost: "0.00",
    bookingFee: "0.00",
    transactionFee: "0.00",
    salesTax: "0.00",
    total: "0.00",
  });
  const [showScrollToTop, setShowScrollToTop] = useState(false);
  const scrollY = useRef(new Animated.Value(0)).current;
  const scrollViewRef = useRef(null);
  const [filterModalVisible, setFilterModalVisible] = useState(false);
  const [cityState, setCityState] = useState("");
  const [makeModel, setMakeModel] = useState("");

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      if (firebaseUser) {
        setUser(firebaseUser);
      } else {
        Alert.alert("Error", "User is not authenticated.");
        navigation.replace("SignIn");
      }
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) return;
    const unsubscribe = subscribeToListings();
    return () => unsubscribe();
  }, [user, filter]);

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

    if (filter.location) {
      q = query(q, where("location", "==", filter.location.toLowerCase()));
    }

    if (filter.make) {
      q = query(q, where("airplaneModel", "==", filter.make.toLowerCase()));
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
        renterId: user.uid,
        renterName: user.displayName || "Anonymous",
        ownerId: selectedListing.ownerId,
        airplaneModel: selectedListing.airplaneModel,
        rentalPeriod: rentalDate,
        totalCost: totalCostValue.toFixed(2),
        contact: user.email || "noemail@example.com",
        createdAt: new Date(),
        status: "pending",
        listingId: selectedListing.id,
      };

      // Write the rental request to Firestore
      const rentalRequestsRef = collection(
        db,
        "owners",
        selectedListing.ownerId,
        "rentalRequests"
      );
      await addDoc(rentalRequestsRef, rentalRequestData);

      setFullScreenModalVisible(false);
      Alert.alert(
        "Request Sent",
        "Your rental request has been sent to the owner. You will be notified once the owner reviews the request."
      );
    } catch (error) {
      console.error("Error sending rental request:", {
        errorMessage: error.message,
        errorCode: error.code,
        rentalRequestData,
      });
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
    Alert.alert(
      "Edit Listing",
      `This would edit the listing with ID ${listingId}`
    );
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

  const handleScroll = (event) => {
    const offsetY = event.nativeEvent.contentOffset.y;
    setShowScrollToTop(offsetY > 200);
  };

  const handleScrollToTop = () => {
    scrollViewRef.current?.scrollToOffset({ animated: true, offset: 0 });
  };

  const clearFilter = () => {
    setFilter({ location: "", make: "" });
    setCityState("");
    setMakeModel("");
  };

  const applyFilter = () => {
    setFilter({
      location: cityState.toLowerCase(),
      make: makeModel.toLowerCase(),
    });
    setFilterModalVisible(false);
  };

  const headerHeight = scrollY.interpolate({
    inputRange: [0, 150],
    outputRange: [200, 0],
    extrapolate: "clamp",
  });

  const headerOpacity = scrollY.interpolate({
    inputRange: [0, 150],
    outputRange: [1, 0],
    extrapolate: "clamp",
  });

  const renderItem = ({ item }) => {
    const abbreviateText = (text, maxLength) => {
      if (text.length > maxLength) {
        return `${text.slice(0, maxLength - 3)}...`;
      }
      return text;
    };

    return (
      <View style={{ flex: 1, margin: 5 }}>
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
            flex: 1,
          }}
        >
          <View style={{ padding: 10, alignItems: "center" }}>
            <Text
              style={{
                fontSize: 18,
                fontWeight: "bold",
                color: "#2d3748",
              }}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.5}
            >
              {abbreviateText(
                `${item.year} ${item.make} ${item.airplaneModel}`,
                25
              )}
            </Text>
          </View>
          {item.images && item.images.length > 0 && (
            <ImageBackground
              source={{ uri: item.images[0] }}
              style={{ height: 150, justifyContent: "space-between" }}
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
              numberOfLines={2}
              style={{
                color: "#4a5568",
              }}
            >
              {item.description}
            </Text>
          </View>
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "white" }}>
      <Animated.View
        style={{
          height: headerHeight,
          opacity: headerOpacity,
          overflow: "hidden",
        }}
      >
        <ImageBackground
          source={wingtipClouds}
          style={{
            flex: 1,
            justifyContent: "flex-start",
          }}
          resizeMode="cover"
        >
          <Animated.View
            style={{
              paddingHorizontal: 16,
              paddingTop: 30, // Ensure sufficient padding from the top
              paddingBottom: 10, // Reduce padding to keep it close to the top
              flexDirection: "row",
              alignItems: "flex-start", // Align items to the start (top left)
            }}
          >
            <View style={{ marginTop: 10 }}>
              <Animated.Text
                style={{
                  fontSize: 24,
                  color: "white",
                  fontWeight: "bold",
                }}
              >
                Welcome
              </Animated.Text>
              <Animated.Text
                style={{
                  fontSize: 28,
                  color: "white",
                  fontWeight: "bold",
                }}
              >
                {user?.displayName || "User"}
              </Animated.Text>
            </View>
          </Animated.View>
        </ImageBackground>
      </Animated.View>

      <FlatList
        data={listings}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        numColumns={2}
        columnWrapperStyle={{ justifyContent: "space-between" }}
        ListHeaderComponent={
          <>
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                marginBottom: 16,
                paddingTop: 10, // Added padding to separate from header
              }}
            >
              <Text style={{ fontSize: 18, color: "#4A4A4A" }}>
                Filter by location or Aircraft Make
              </Text>
              <TouchableOpacity
                onPress={() => setFilterModalVisible(true)}
                style={{
                  backgroundColor: "#E2E2E2",
                  padding: 8,
                  borderRadius: 50,
                }}
              >
                <Ionicons name="filter" size={24} color="gray" />
              </TouchableOpacity>
            </View>

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
          </>
        }
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <Text style={{ textAlign: "center", color: "#4a5568" }}>
            No listings available
          </Text>
        }
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: false, listener: handleScroll }
        )}
        ref={scrollViewRef}
      />

      {showScrollToTop && (
        <TouchableOpacity
          style={{
            position: "absolute",
            right: 20,
            bottom: 40,
            backgroundColor: "#1E90FF",
            padding: 10,
            borderRadius: 50,
            elevation: 5,
          }}
          onPress={handleScrollToTop}
        >
          <Ionicons name="arrow-up" size={24} color="white" />
        </TouchableOpacity>
      )}

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
              <ScrollView showsVerticalScrollIndicator={false}>
                <Text
                  style={{
                    fontSize: 28,
                    fontWeight: "bold",
                    marginBottom: 16,
                    textAlign: "center",
                    color: "#2d3748",
                  }}
                >
                  {`${selectedListing.year} ${selectedListing.make} ${selectedListing.airplaneModel}`}
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
                    textAlign: "center",
                    color: "#4a5568",
                    marginBottom: 16,
                  }}
                >
                  Location: {selectedListing.location}
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

                {selectedListing.ownerId === user.uid && (
                  <View
                    style={{
                      flexDirection: "row",
                      justifyContent: "center",
                      marginVertical: 16,
                    }}
                  >
                    <TouchableOpacity
                      onPress={() => handleEditListing(selectedListing.id)}
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
                      onPress={() => handleDeleteListing(selectedListing.id)}
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
              rentalDate
                ? {
                    [rentalDate]: {
                      selected: true,
                      marked: true,
                      dotColor: "red",
                    },
                  }
                : {}
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
            <Text
              style={{
                color: "white",
                textAlign: "center",
                fontWeight: "bold",
              }}
            >
              Close Calendar
            </Text>
          </TouchableOpacity>
        </View>
      </Modal>

      <Modal
        animationType="slide"
        transparent={true}
        visible={filterModalVisible}
        onRequestClose={() => setFilterModalVisible(false)}
      >
        <TouchableOpacity
          style={{
            flex: 1,
            justifyContent: "flex-end",
            backgroundColor: "rgba(0, 0, 0, 0.5)",
          }}
          onPressOut={() => setFilterModalVisible(false)}
        >
          <View
            style={{
              backgroundColor: "white",
              borderTopLeftRadius: 20,
              borderTopRightRadius: 20,
              padding: 20,
              height: "50%",
            }}
          >
            <View
              style={{ flexDirection: "row", justifyContent: "space-between" }}
            >
              <Text
                style={{ fontSize: 18, fontWeight: "bold", marginBottom: 10 }}
              >
                Filter Listings
              </Text>
              <TouchableOpacity onPress={() => setFilterModalVisible(false)}>
                <Ionicons name="close" size={24} color="black" />
              </TouchableOpacity>
            </View>

            <TextInput
              placeholder="Enter City, State"
              value={cityState}
              onChangeText={setCityState}
              style={{
                borderColor: "#CBD5E0",
                borderWidth: 1,
                padding: 10,
                borderRadius: 8,
                marginBottom: 10,
              }}
            />
            <Text style={{ textAlign: "center", marginBottom: 10 }}>OR</Text>
            <TextInput
              placeholder="Enter Make and Model"
              value={makeModel}
              onChangeText={setMakeModel}
              style={{
                borderColor: "#CBD5E0",
                borderWidth: 1,
                padding: 10,
                borderRadius: 8,
                marginBottom: 10,
              }}
            />
            <View
              style={{ flexDirection: "row", justifyContent: "space-between" }}
            >
              <TouchableOpacity
                onPress={clearFilter}
                style={{
                  backgroundColor: "#FF6347",
                  padding: 10,
                  borderRadius: 8,
                  flex: 1,
                  marginRight: 10,
                }}
              >
                <Text
                  style={{
                    color: "white",
                    textAlign: "center",
                    fontWeight: "bold",
                  }}
                >
                  Clear Filter
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={applyFilter}
                style={{
                  backgroundColor: "#1E90FF",
                  padding: 10,
                  borderRadius: 8,
                  flex: 1,
                }}
              >
                <Text
                  style={{
                    color: "white",
                    textAlign: "center",
                    fontWeight: "bold",
                  }}
                >
                  Apply Filter
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
};

export default Home;
