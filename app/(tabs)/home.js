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
  Switch,
  StyleSheet,
  Dimensions,
  ActivityIndicator,
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
  addDoc,
  serverTimestamp,
  getDocs,
  limit,
} from "firebase/firestore";
import { Ionicons } from "@expo/vector-icons";
import wingtipClouds from "../../Assets/images/wingtip_clouds.jpg";
import { Calendar } from "react-native-calendars";
// **Added Imports for Notifications**
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';

const { width: SCREEN_WIDTH } = Dimensions.get("window");

const Home = ({ route, navigation }) => {
  const [user, setUser] = useState(null);
  const [listings, setListings] = useState([]);
  const [recommendedListings, setRecommendedListings] = useState([]);
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

  // New State Variables for Additional Fields
  const [fullName, setFullName] = useState("");
  const [cityStateCombined, setCityStateCombined] = useState("");
  const [hasMedicalCertificate, setHasMedicalCertificate] = useState(false);
  const [hasRentersInsurance, setHasRentersInsurance] = useState(false);
  const [flightHours, setFlightHours] = useState("");

  // Loading Indicator State
  const [isLoading, setIsLoading] = useState(false);

  // State for Recommended Listings Loading
  const [isRecommendedLoading, setIsRecommendedLoading] = useState(false);

  // **Notification Listener Reference**
  const notificationListener = useRef();
  const responseListener = useRef();

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (firebaseUser) => {
      if (firebaseUser) {
        setUser(firebaseUser);
      } else {
        Alert.alert("Authentication Error", "User is not authenticated.");
        navigation.replace("SignIn");
      }
    });
    return () => unsubscribeAuth();
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

  /**
   * Helper function to parse the combined 'aircraft' field.
   * Assumes format: "Year Make Model" (e.g., "2020 Cessna 172")
   * Returns an object with year, make, and airplaneModel.
   */
  const parseAircraft = (aircraft) => {
    if (!aircraft || typeof aircraft !== "string") {
      return {
        year: "Unknown Year",
        make: "Unknown Make",
        airplaneModel: "Unknown Model",
      };
    }

    // Regular expression to match "Year Make Model"
    const regex = /^(\d{4})\s+(\w+)\s+(.+)$/;
    const match = aircraft.trim().match(regex);

    if (match) {
      return {
        year: match[1],
        make: match[2],
        airplaneModel: match[3],
      };
    }

    console.warn(`Unable to parse aircraft field: "${aircraft}"`);
    return {
      year: "Unknown Year",
      make: "Unknown Make",
      airplaneModel: "Unknown Model",
    };
  };

  /**
   * Subscribe to Firestore listings with appropriate filtering and data mapping.
   */
  const subscribeToListings = () => {
    const listingsRef = collection(db, "airplanes");
    let q = query(listingsRef, orderBy("createdAt", "desc"));

    if (filter.location) {
      q = query(q, where("location", "==", filter.location.toLowerCase()));
    }

    if (filter.make) {
      q = query(q, where("make", "==", filter.make.toLowerCase()));
    }

    return onSnapshot(
      q,
      (snapshot) => {
        const listingsData = snapshot.docs
          .map((doc) => {
            const data = doc.data();
            let { year, make, airplaneModel } = data;

            // Check if separate fields are missing and attempt to parse from 'aircraft' field
            if (!year || !make || !airplaneModel) {
              const parsed = parseAircraft(data.aircraft);
              if (!year) year = parsed.year;
              if (!make) make = parsed.make;
              if (!airplaneModel) airplaneModel = parsed.airplaneModel;
            }

            return {
              id: doc.id,
              year: year || "Unknown Year",
              make: make || "Unknown Make",
              airplaneModel: airplaneModel || "Unknown Model",
              ownerId: data.ownerId || null,
              ratesPerHour: data.ratesPerHour || "0.00",
              location: data.location || "Unknown Location",
              description: data.description || "No description available.",
              images: data.images || [],
              createdAt: data.createdAt || serverTimestamp(),
            };
          })
          // Filter out listings without a valid ownerId
          .filter((listing) => {
            if (!listing.ownerId) {
              return false;
            }
            return true;
          });

        // Log detailed information about each listing
        listingsData.forEach((listing) => {
          if (!Array.isArray(listing.images)) {
            listing.images = [listing.images];
          }
          console.log(
            `Listing ID: ${listing.id}, Year: ${listing.year}, Make: ${listing.make}, Model: ${listing.airplaneModel}, Owner ID: ${listing.ownerId}`
          );
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
        } else {
          Alert.alert("Error", "An unexpected error occurred while fetching listings.");
        }
      }
    );
  };

  /**
   * Fetch Recommended Listings from Firestore
   */
  const fetchRecommendedListings = async () => {
    setIsRecommendedLoading(true);
    try {
      const recommendedRef = collection(db, "airplanes");
      const recommendedQuery = query(
        recommendedRef,
        where("isRecommended", "==", true),
        limit(10)
      );
      const snapshot = await getDocs(recommendedQuery);
      const recommendedData = snapshot.docs.map((doc) => {
        const data = doc.data();
        let { year, make, airplaneModel } = data;

        // Parse aircraft field if necessary
        if (!year || !make || !airplaneModel) {
          const parsed = parseAircraft(data.aircraft);
          if (!year) year = parsed.year;
          if (!make) make = parsed.make;
          if (!airplaneModel) airplaneModel = parsed.airplaneModel;
        }

        return {
          id: doc.id,
          year: year || "Unknown Year",
          make: make || "Unknown Make",
          airplaneModel: airplaneModel || "Unknown Model",
          ownerId: data.ownerId || null,
          ratesPerHour: data.ratesPerHour || "0.00",
          location: data.location || "Unknown Location",
          description: data.description || "No description available.",
          images: data.images || [],
          createdAt: data.createdAt || serverTimestamp(),
        };
      });

      // Filter out listings without a valid ownerId
      const validRecommended = recommendedData.filter((listing) => {
        if (!listing.ownerId) {
          return false;
        }
        return true;
      });

      setRecommendedListings(validRecommended);
      console.log(`Fetched ${validRecommended.length} recommended listings.`);
    } catch (error) {
      console.error("Error fetching recommended listings: ", error);
      Alert.alert("Error", "Failed to fetch recommended listings.");
    } finally {
      setIsRecommendedLoading(false);
    }
  };

  useEffect(() => {
    fetchRecommendedListings();
  }, [filter]);

  /**
   * Calculate the total cost based on rental hours.
   */
  const calculateTotalCost = (hours) => {
    if (!selectedListing) return;

    const pricePerHour = parseFloat(selectedListing.ratesPerHour);
    if (isNaN(pricePerHour)) {
      Alert.alert("Pricing Error", "Invalid rate per hour for the selected listing.");
      return;
    }

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

  /**
   * Handle sending a rental request to the owner.
   */
  const handleSendRentalRequest = async () => {
    console.log("Attempting to send rental request.");
    console.log("Selected Listing:", selectedListing);
    console.log("Selected Listing ID:", selectedListing?.id);

    if (!selectedListing) {
      Alert.alert("Selection Error", "No listing selected.");
      return;
    }

    if (!selectedListing.id) {
      Alert.alert("Error", "Listing ID is missing. Please select a valid listing.");
      return;
    }

    if (!selectedListing.ownerId) {
      Alert.alert(
        "Listing Error",
        "The selected listing does not have a valid owner. Please select a different listing."
      );
      console.error(`Selected listing ID: ${selectedListing.id} is missing 'ownerId'.`);
      return;
    }

    if (!rentalDate) {
      Alert.alert("Input Required", "Please select a rental date.");
      return;
    }

    // Validation for New Fields
    if (!fullName.trim()) {
      Alert.alert("Input Required", "Please enter your full name.");
      return;
    }

    if (!cityStateCombined.trim()) {
      Alert.alert("Input Required", "Please enter your current city and state.");
      return;
    }

    if (!flightHours || isNaN(flightHours) || Number(flightHours) < 0) {
      Alert.alert("Input Required", "Please enter a valid number of flight hours.");
      return;
    }

    if (!hasMedicalCertificate) {
      Alert.alert(
        "Confirmation Required",
        "You must confirm that you have a current medical certificate."
      );
      return;
    }

    if (!hasRentersInsurance) {
      Alert.alert(
        "Confirmation Required",
        "You must confirm that you have current renter's insurance."
      );
      return;
    }

    const rentalCost = parseFloat(selectedListing.ratesPerHour) * rentalHours;
    if (isNaN(rentalCost) || rentalCost <= 0) {
      Alert.alert("Pricing Error", "Invalid rental cost calculated.");
      return;
    }

    // Calculate owner's payout (rental cost minus 6% commission)
    const ownerPayout = rentalCost * 0.94;

    // Declare rentalRequestData
    let rentalRequestData = {};

    try {
      // Assign 'Unknown Model' if airplaneModel is undefined
      const airplaneModel = selectedListing.airplaneModel || "Unknown Model";
      if (airplaneModel === "Unknown Model") {
        console.warn(
          `Listing ID: ${selectedListing.id} is missing airplaneModel. Assigning 'Unknown Model'.`
        );
      }

      rentalRequestData = {
        renterId: user.uid,
        renterName: fullName,
        ownerId: selectedListing.ownerId,
        make: selectedListing.make || "Unknown Make",
        airplaneModel: airplaneModel,
        rentalDate: rentalDate,
        rentalHours: rentalHours,
        rentalCost: rentalCost.toFixed(2),
        ownerPayout: ownerPayout.toFixed(2),
        contact: user.email || "noemail@example.com",
        createdAt: serverTimestamp(),
        status: "pending",
        listingId: selectedListing.id,
        currentLocation: cityStateCombined,
        hasMedicalCertificate: hasMedicalCertificate,
        hasRentersInsurance: hasRentersInsurance,
        flightHours: Number(flightHours),
      };

      // Log the rentalRequestData before sending
      console.log("Rental Request Data:", rentalRequestData);

      // Ensure that listingId is present
      if (!rentalRequestData.listingId) {
        throw new Error("Listing ID is missing in the rental request data.");
      }

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

      // Optional: Reset form fields after sending the request
      setFullName("");
      setCityStateCombined("");
      setHasMedicalCertificate(false);
      setHasRentersInsurance(false);
      setFlightHours("");
      setRentalHours(1);
      setRentalDate(null);
      setTotalCost({
        rentalCost: "0.00",
        bookingFee: "0.00",
        transactionFee: "0.00",
        salesTax: "0.00",
        total: "0.00",
      });
    } catch (error) {
      console.error("Error sending rental request:", {
        errorMessage: error.message,
        errorCode: error.code,
        rentalRequestData,
      });
      Alert.alert("Error", error.message || "Failed to send rental request to the owner.");
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
    // Implement navigation or modal for editing the listing
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

  /**
   * Render each listing item.
   * Utilizes year, make, and airplaneModel fields for display.
   */
  const renderItem = ({ item }) => {
    // Ensure correct field access with fallback values
    const airplaneModelDisplay = item.airplaneModel || item.model || "Unknown Model";
    const makeDisplay = item.make || item.manufacturer || "Unknown Make";
    const yearDisplay = item.year || "Unknown Year";

    return (
      <View style={styles.listingContainer}>
        <TouchableOpacity
          onPress={() => {
            if (!item.ownerId) {
              Alert.alert(
                "Listing Unavailable",
                "This listing does not have a valid owner and cannot be rented."
              );
              return;
            }
            setSelectedListing(item);
            console.log("Selected Listing:", item);
            setImageIndex(0);
            setFullScreenModalVisible(true);
            setFullName(user?.displayName || "");
            setCityStateCombined("");
            setHasMedicalCertificate(false);
            setHasRentersInsurance(false);
            setFlightHours("");
          }}
          style={styles.listingCard}
          accessibilityLabel={`Select listing: ${yearDisplay} ${makeDisplay} ${airplaneModelDisplay}`}
          accessibilityRole="button"
        >
          <View style={styles.listingHeader}>
            <Text style={styles.listingTitle} numberOfLines={1}>
              {`${yearDisplay} ${makeDisplay} ${airplaneModelDisplay}`}
            </Text>
          </View>
          {item.images && item.images.length > 0 ? (
            <ImageBackground
              source={{ uri: item.images[0] }}
              style={styles.listingImage}
              imageStyle={{ borderRadius: 10 }}
            >
              <View style={styles.listingImageOverlay}>
                <Text style={styles.listingLocation}>{item.location}</Text>
                <Text style={styles.listingRate}>
                  ${item.ratesPerHour}/hour
                </Text>
              </View>
            </ImageBackground>
          ) : (
            <View style={[styles.listingImage, { justifyContent: "center", alignItems: "center" }]}>
              <Ionicons name="image" size={50} color="#A0AEC0" />
              <Text style={{ color: "#A0AEC0" }}>No Image Available</Text>
            </View>
          )}
          <View style={styles.listingDescriptionContainer}>
            <Text numberOfLines={2} style={styles.listingDescription}>
              {item.description}
            </Text>
          </View>
        </TouchableOpacity>
      </View>
    );
  };

  /**
   * Handle incoming notifications and set selectedListing accordingly.
   */
  useEffect(() => {
    // **Register for Push Notifications**
    const registerForPushNotificationsAsync = async () => {
      if (Device.isDevice) {
        const { status: existingStatus } = await Notifications.getPermissionsAsync();
        let finalStatus = existingStatus;
        if (existingStatus !== 'granted') {
          const { status } = await Notifications.requestPermissionsAsync();
          finalStatus = status;
        }
        if (finalStatus !== 'granted') {
          Alert.alert('Permission required', 'Failed to get push token for notifications!');
          return;
        }
      } else {
        Alert.alert('Error', 'Must use physical device for Push Notifications');
      }
    };

    registerForPushNotificationsAsync();

    // **Listener for Notification Responses**
    responseListener.current = Notifications.addNotificationResponseReceivedListener(response => {
      const data = response.notification.request.content.data;
      console.log("Notification Data:", data);

      if (data && data.listingId) {
        // Find the listing by ID from 'listings' or 'recommendedListings'
        const listing = listings.find(item => item.id === data.listingId) ||
                        recommendedListings.find(item => item.id === data.listingId);
        
        if (listing) {
          if (!listing.ownerId) {
            Alert.alert("Error", "The listing associated with this notification does not have a valid owner.");
            console.warn(`Listing with ID ${data.listingId} is missing 'ownerId'.`);
            return;
          }
          setSelectedListing(listing);
          console.log("Listing set from notification:", listing);
          setImageIndex(0);
          setFullScreenModalVisible(true);
          setFullName(user?.displayName || "");
          setCityStateCombined("");
          setHasMedicalCertificate(false);
          setHasRentersInsurance(false);
          setFlightHours("");
        } else {
          console.warn(`Listing with ID ${data.listingId} not found.`);
          Alert.alert("Error", "Listing not found.");
        }
      } else {
        console.warn("Notification does not contain listingId.");
        Alert.alert("Error", "Invalid notification data.");
      }
    });

    return () => {
      if (responseListener.current) {
        Notifications.removeNotificationSubscription(responseListener.current);
      }
    };
  }, [listings, recommendedListings, user]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <Animated.View
        style={[
          styles.header,
          {
            height: headerHeight,
            opacity: headerOpacity,
          },
        ]}
      >
        <ImageBackground
          source={wingtipClouds}
          style={styles.headerImage}
          resizeMode="cover"
        >
          <View style={styles.headerContent}>
            <View>
              <Text style={styles.welcomeText}>Welcome</Text>
              <Text style={styles.userName}>
                {user?.displayName || "User"}
              </Text>
            </View>
          </View>
        </ImageBackground>
      </Animated.View>

      {/* Recommended for You Section */}
      <View style={{ paddingHorizontal: 16, paddingTop: 24 }}>
        <Text style={{ fontSize: 18, fontWeight: "bold", marginBottom: 16 }}>
          Recommended for you
        </Text>
        {isRecommendedLoading ? (
          <ActivityIndicator size="large" color="#1E90FF" />
        ) : recommendedListings.length > 0 ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {recommendedListings.map((listing) => (
              <TouchableOpacity
                key={listing.id}
                style={{ marginRight: 16 }}
                onPress={() => {
                  if (!listing.ownerId) {
                    Alert.alert(
                      "Listing Unavailable",
                      "This recommended listing does not have a valid owner and cannot be rented."
                    );
                    return;
                  }
                  setSelectedListing(listing);
                  console.log("Selected Recommended Listing:", listing);
                  setImageIndex(0);
                  setFullScreenModalVisible(true);
                  setFullName(user?.displayName || "");
                  setCityStateCombined("");
                  setHasMedicalCertificate(false);
                  setHasRentersInsurance(false);
                  setFlightHours("");
                }}
                accessibilityLabel={`Select recommended aircraft: ${listing.year} ${listing.make} ${listing.airplaneModel}`}
                accessibilityRole="button"
              >
                {listing.images && listing.images.length > 0 ? (
                  <Image
                    source={{ uri: listing.images[0] }}
                    style={{ width: 200, height: 120, borderRadius: 8 }}
                    resizeMode="cover"
                  />
                ) : (
                  <View
                    style={{
                      width: 200,
                      height: 120,
                      borderRadius: 8,
                      backgroundColor: "#A0AEC0",
                      justifyContent: "center",
                      alignItems: "center",
                    }}
                  >
                    <Ionicons name="image" size={50} color="#FFFFFF" />
                    <Text style={{ color: "#FFFFFF" }}>No Image</Text>
                  </View>
                )}
                <Text style={{ marginTop: 8, fontWeight: "bold" }}>
                  {`${listing.year} ${listing.make} ${listing.airplaneModel}`}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        ) : (
          <Text style={{ textAlign: "center", color: "#718096" }}>
            No recommended listings available.
          </Text>
        )}
      </View>

      <FlatList
        data={listings}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        numColumns={2}
        columnWrapperStyle={styles.columnWrapper}
        ListHeaderComponent={
          <>
            <View style={styles.filterHeader}>
              <Text style={styles.filterText}>
                Filter by location or Aircraft Make
              </Text>
              <TouchableOpacity
                onPress={() => setFilterModalVisible(true)}
                style={styles.filterButton}
                accessibilityLabel="Open filter options"
                accessibilityRole="button"
              >
                <Ionicons name="filter" size={24} color="gray" />
              </TouchableOpacity>
            </View>

            <Text style={styles.availableListingsTitle}>
              Available Listings
            </Text>
          </>
        }
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <Text style={styles.emptyListText}>
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
          style={styles.scrollToTopButton}
          onPress={handleScrollToTop}
          accessibilityLabel="Scroll to top"
          accessibilityRole="button"
        >
          <Ionicons name="arrow-up" size={24} color="white" />
        </TouchableOpacity>
      )}

      {/* Full Screen Modal */}
      <Modal
        animationType="slide"
        transparent={false}
        visible={fullScreenModalVisible}
        onRequestClose={() => setFullScreenModalVisible(false)}
      >
        <SafeAreaView style={styles.modalSafeArea}>
          {selectedListing && selectedListing.images && (
            <View style={styles.modalContainer}>
              <TouchableOpacity
                onPress={() => setFullScreenModalVisible(false)}
                style={styles.modalCloseButton}
                accessibilityLabel="Close modal"
                accessibilityRole="button"
              >
                <Ionicons name="close" size={30} color="black" />
              </TouchableOpacity>
              <View style={styles.modalImageContainer}>
                <TouchableOpacity
                  onPress={handlePreviousImage}
                  style={styles.modalArrowButtonLeft}
                  accessibilityLabel="Previous image"
                  accessibilityRole="button"
                >
                  <Ionicons name="arrow-back" size={30} color="#1E90FF" />
                </TouchableOpacity>
                {selectedListing.images.length > 0 ? (
                  <Image
                    source={{ uri: selectedListing.images[imageIndex] }}
                    style={styles.modalImage}
                    resizeMode="cover"
                  />
                ) : (
                  <View
                    style={[
                      styles.modalImage,
                      { justifyContent: "center", alignItems: "center" },
                    ]}
                  >
                    <Ionicons name="image" size={50} color="#A0AEC0" />
                    <Text style={{ color: "#A0AEC0" }}>No Image Available</Text>
                  </View>
                )}
                <TouchableOpacity
                  onPress={handleNextImage}
                  style={styles.modalArrowButtonRight}
                  accessibilityLabel="Next image"
                  accessibilityRole="button"
                >
                  <Ionicons name="arrow-forward" size={30} color="#1E90FF" />
                </TouchableOpacity>
              </View>
              <ScrollView contentContainerStyle={styles.modalContent}>
                <Text
                  style={styles.modalTitle}
                  accessibilityLabel="Listing title"
                >
                  {`${selectedListing.year} ${selectedListing.make} ${selectedListing.airplaneModel}`}
                </Text>
                <Text style={styles.modalRate} accessibilityLabel="Rate per hour">
                  ${selectedListing.ratesPerHour} per hour
                </Text>
                <Text style={styles.modalLocation} accessibilityLabel="Location">
                  Location: {selectedListing.location}
                </Text>

                <Text style={styles.modalDescription} accessibilityLabel="Description">
                  {selectedListing.description}
                </Text>

                {selectedListing.ownerId === user.uid && (
                  <View style={styles.modalOwnerActions}>
                    <TouchableOpacity
                      onPress={() => handleEditListing(selectedListing.id)}
                      style={styles.modalEditButton}
                      accessibilityLabel="Edit listing"
                      accessibilityRole="button"
                    >
                      <Text style={styles.buttonText}>Edit</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => handleDeleteListing(selectedListing.id)}
                      style={styles.modalDeleteButton}
                      accessibilityLabel="Delete listing"
                      accessibilityRole="button"
                    >
                      <Text style={styles.buttonText}>Delete</Text>
                    </TouchableOpacity>
                  </View>
                )}

                {/* Developer Delete Button */}
                <TouchableOpacity
                  onPress={() => handleDeleteListing(selectedListing.id)}
                  style={styles.modalDeleteButton}
                  accessibilityLabel="Developer delete listing"
                  accessibilityRole="button"
                >
                  <Text style={styles.buttonText}>Developer Delete</Text>
                </TouchableOpacity>

                {/* Full Name Input */}
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Full Name</Text>
                  <TextInput
                    value={fullName}
                    onChangeText={setFullName}
                    placeholder="Enter your full name"
                    placeholderTextColor="#888"
                    style={styles.textInput}
                    accessibilityLabel="Full name input"
                  />
                </View>

                {/* Combined City and State Input */}
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Current City & State</Text>
                  <TextInput
                    value={cityStateCombined}
                    onChangeText={setCityStateCombined}
                    placeholder="e.g., New York, NY"
                    placeholderTextColor="#888"
                    style={styles.textInput}
                    accessibilityLabel="Current city and state input"
                  />
                </View>

                {/* Medical Certificate Toggle */}
                <View style={styles.toggleGroup}>
                  <Text style={styles.inputLabel}>
                    Do you have a current medical certificate?
                  </Text>
                  <Switch
                    value={hasMedicalCertificate}
                    onValueChange={setHasMedicalCertificate}
                    accessibilityLabel="Medical certificate toggle"
                  />
                </View>

                {/* Renters Insurance Toggle */}
                <View style={styles.toggleGroup}>
                  <Text style={styles.inputLabel}>
                    Do you have current renter's insurance?
                  </Text>
                  <Switch
                    value={hasRentersInsurance}
                    onValueChange={setHasRentersInsurance}
                    accessibilityLabel="Renters insurance toggle"
                  />
                </View>

                {/* Flight Hours Input */}
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Flight Hours</Text>
                  <TextInput
                    value={flightHours}
                    onChangeText={setFlightHours}
                    placeholder="Enter hours"
                    placeholderTextColor="#888"
                    keyboardType="numeric"
                    style={styles.textInputSmall}
                    accessibilityLabel="Flight hours input"
                  />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Rental Hours</Text>
                  <TextInput
                    value={String(rentalHours)}
                    placeholderTextColor="#888"
                    onChangeText={(text) => {
                      const num = Number(text);
                      if (!isNaN(num) && num >= 0) {
                        setRentalHours(num);
                      } else {
                        Alert.alert("Invalid Input", "Please enter a valid number of rental hours.");
                      }
                    }}
                    keyboardType="numeric"
                    style={styles.textInputSmall}
                    accessibilityLabel="Rental hours input"
                  />
                </View>

                <TouchableOpacity
                  onPress={() => setCalendarModalVisible(true)}
                  style={styles.calendarButton}
                  accessibilityLabel="Select rental date"
                  accessibilityRole="button"
                >
                  <Text style={styles.calendarButtonText}>
                    Select Rental Date
                  </Text>
                </TouchableOpacity>

                {rentalDate && (
                  <Text style={styles.selectedDateText} accessibilityLabel="Selected rental date">
                    Selected Rental Date: {rentalDate}
                  </Text>
                )}

                <View style={styles.totalCostContainer}>
                  <Text style={styles.totalCostTitle}>Total Cost</Text>
                  <Text>Rental Cost: ${totalCost.rentalCost}</Text>
                  <Text>Booking Fee: ${totalCost.bookingFee}</Text>
                  <Text>Transaction Fee: ${totalCost.transactionFee}</Text>
                  <Text>Sales Tax: ${totalCost.salesTax}</Text>
                  <Text style={styles.totalCostValue}>
                    Total: ${totalCost.total}
                  </Text>
                </View>

                <TouchableOpacity
                  onPress={handleSendRentalRequest}
                  style={styles.sendRequestButton}
                  accessibilityLabel="Send rental request"
                  accessibilityRole="button"
                >
                  <Text style={styles.sendRequestButtonText}>
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
        <View style={styles.calendarModalContainer}>
          <View style={styles.calendarContent}>
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
              style={styles.closeCalendarButton}
              accessibilityLabel="Close calendar"
              accessibilityRole="button"
            >
              <Text style={styles.closeCalendarButtonText}>
                Close Calendar
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Filter Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={filterModalVisible}
        onRequestClose={() => setFilterModalVisible(false)}
      >
        <TouchableOpacity
          style={styles.filterModalOverlay}
          onPressOut={() => setFilterModalVisible(false)}
          accessibilityLabel="Close filter modal"
          accessibilityRole="button"
        >
          <View style={styles.filterModalContent}>
            <View style={styles.filterModalHeader}>
              <Text style={styles.filterModalTitle}>Filter Listings</Text>
              <TouchableOpacity onPress={() => setFilterModalVisible(false)}>
                <Ionicons name="close" size={24} color="black" />
              </TouchableOpacity>
            </View>

            <TextInput
              placeholder="Enter City, State"
              placeholderTextColor="#888"
              value={cityState}
              onChangeText={setCityState}
              style={styles.filterTextInput}
              accessibilityLabel="Filter by city and state"
            />
            <Text style={styles.orText}>OR</Text>
            <TextInput
              placeholder="Enter Make and Model"
              placeholderTextColor="#888"
              value={makeModel}
              onChangeText={setMakeModel}
              style={styles.filterTextInput}
              accessibilityLabel="Filter by make and model"
            />
            <View style={styles.filterButtonsContainer}>
              <TouchableOpacity
                onPress={clearFilter}
                style={styles.clearFilterButton}
                accessibilityLabel="Clear filters"
                accessibilityRole="button"
              >
                <Text style={styles.filterButtonText}>Clear Filter</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={applyFilter}
                style={styles.applyFilterButton}
                accessibilityLabel="Apply filters"
                accessibilityRole="button"
              >
                <Text style={styles.filterButtonText}>Apply Filter</Text>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Loading Indicator */}
      {isLoading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#1E90FF" />
        </View>
      )}
    </SafeAreaView>
  );
};

// **Stylesheet for Clean and Modern Design**
const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  header: {
    overflow: "hidden",
  },
  headerImage: {
    flex: 1,
    justifyContent: "flex-start",
  },
  headerContent: {
    paddingHorizontal: 16,
    paddingTop: 30,
    paddingBottom: 10,
    flexDirection: "row",
    alignItems: "flex-start",
  },
  welcomeText: {
    fontSize: 24,
    color: "#FFFFFF",
    fontWeight: "bold",
  },
  userName: {
    fontSize: 28,
    color: "#FFFFFF",
    fontWeight: "bold",
  },
  columnWrapper: {
    justifyContent: "space-between",
    paddingHorizontal: 10,
  },
  filterHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 16,
    paddingTop: 10,
    paddingHorizontal: 10,
  },
  filterText: {
    fontSize: 18,
    color: "#4A4A4A",
  },
  filterButton: {
    backgroundColor: "#E2E2E2",
    padding: 8,
    borderRadius: 50,
  },
  availableListingsTitle: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 16,
    textAlign: "center",
    color: "#2d3748",
  },
  emptyListText: {
    textAlign: "center",
    color: "#4a5568",
    marginTop: 20,
  },
  listingContainer: {
    flex: 1,
    margin: 5,
  },
  listingCard: {
    borderRadius: 10,
    overflow: "hidden",
    backgroundColor: "#FFFFFF",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    flex: 1,
  },
  listingHeader: {
    padding: 10,
    alignItems: "center",
  },
  listingTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#2d3748",
  },
  listingImage: {
    height: 150,
    justifyContent: "flex-end", // Align overlay to the bottom
  },
  listingImageOverlay: {
    flexDirection: "row",
    justifyContent: "space-between",
    padding: 8,
    backgroundColor: "rgba(0,0,0,0.3)", // Semi-transparent overlay
    borderBottomLeftRadius: 10,
    borderBottomRightRadius: 10,
  },
  listingLocation: {
    color: "white",
    padding: 4,
    borderRadius: 5,
  },
  listingRate: {
    color: "white",
    padding: 4,
    borderRadius: 5,
  },
  listingDescriptionContainer: {
    padding: 10,
  },
  listingDescription: {
    color: "#4a5568",
  },
  scrollToTopButton: {
    position: "absolute",
    right: 20,
    bottom: 40,
    backgroundColor: "#1E90FF",
    padding: 10,
    borderRadius: 50,
    elevation: 5,
  },
  modalSafeArea: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  modalContainer: {
    padding: 16,
    flex: 1,
  },
  modalCloseButton: {
    alignSelf: "flex-end",
  },
  modalImageContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  modalArrowButtonLeft: {
    padding: 10,
  },
  modalArrowButtonRight: {
    padding: 10,
  },
  modalImage: {
    width: SCREEN_WIDTH * 0.7, // 70% of screen width
    height: SCREEN_WIDTH * 0.45, // Maintain aspect ratio
    borderRadius: 10,
  },
  modalContent: {
    paddingBottom: 20,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 8,
    textAlign: "center",
    color: "#2d3748",
  },
  modalRate: {
    fontSize: 20,
    marginBottom: 8,
    textAlign: "center",
    color: "#2d3748",
  },
  modalLocation: {
    textAlign: "center",
    color: "#4a5568",
    marginBottom: 8,
  },
  modalDescription: {
    marginBottom: 16,
    textAlign: "center",
    color: "#4a5568",
  },
  modalOwnerActions: {
    flexDirection: "row",
    justifyContent: "center",
    marginVertical: 16,
  },
  modalEditButton: {
    backgroundColor: "#1E90FF",
    padding: 10,
    borderRadius: 8,
    marginRight: 8,
    width: 120,
    alignItems: "center",
  },
  modalDeleteButton: {
    backgroundColor: "#FF6347",
    padding: 10,
    borderRadius: 8,
    width: 120,
    alignItems: "center",
  },
  buttonText: {
    color: "#FFFFFF",
    fontWeight: "bold",
  },
  inputGroup: {
    marginBottom: 16,
    width: "100%", // Ensure inputs take full width
  },
  inputLabel: {
    fontWeight: "bold",
    fontSize: 16, // Reduced font size for better fit
    marginBottom: 8,
  },
  textInput: {
    borderColor: "#CBD5E0",
    borderWidth: 1,
    padding: 12,
    borderRadius: 8,
    width: "100%",
    textAlign: "center",
    backgroundColor: "#F7FAFC",
  },
  textInputSmall: {
    borderColor: "#CBD5E0",
    borderWidth: 1,
    padding: 12,
    borderRadius: 8,
    width: 100, // Increased width for better input
    textAlign: "center",
    backgroundColor: "#F7FAFC",
  },
  toggleGroup: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
    width: "100%", // Ensure toggles take full width
  },
  calendarButton: {
    backgroundColor: "#1E90FF",
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    width: "100%",
  },
  calendarButtonText: {
    color: "#FFFFFF",
    textAlign: "center",
    fontWeight: "bold",
  },
  selectedDateText: {
    marginBottom: 16,
    textAlign: "center",
    fontSize: 16,
    color: "#2d3748",
  },
  totalCostContainer: {
    marginBottom: 16,
  },
  totalCostTitle: {
    fontWeight: "bold",
    fontSize: 18,
    marginBottom: 8,
  },
  totalCostValue: {
    fontWeight: "bold",
    fontSize: 16,
  },
  sendRequestButton: {
    backgroundColor: "#1E90FF",
    padding: 16,
    borderRadius: 8,
    marginTop: 16,
    width: "100%",
  },
  sendRequestButtonText: {
    color: "#FFFFFF",
    textAlign: "center",
    fontWeight: "bold",
  },
  calendarModalContainer: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  calendarContent: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 20,
    width: "90%",
    alignItems: "center",
  },
  closeCalendarButton: {
    backgroundColor: "#1E90FF",
    padding: 12,
    borderRadius: 8,
    marginTop: 16,
    width: "100%",
  },
  closeCalendarButtonText: {
    color: "#FFFFFF",
    textAlign: "center",
    fontWeight: "bold",
  },
  filterModalOverlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0, 0, 0, 0.5)",
  },
  filterModalContent: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    height: "50%",
  },
  filterModalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  filterModalTitle: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 10,
  },
  filterTextInput: {
    borderColor: "#CBD5E0",
    borderWidth: 1,
    padding: 10,
    borderRadius: 8,
    marginBottom: 10,
    backgroundColor: "#F7FAFC",
    width: "100%",
  },
  orText: {
    textAlign: "center",
    marginBottom: 10,
    fontSize: 16,
    color: "#4A4A4A",
  },
  filterButtonsContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  clearFilterButton: {
    backgroundColor: "#FF6347",
    padding: 10,
    borderRadius: 8,
    flex: 1,
    marginRight: 10,
    alignItems: "center",
  },
  applyFilterButton: {
    backgroundColor: "#1E90FF",
    padding: 10,
    borderRadius: 8,
    flex: 1,
    alignItems: "center",
  },
  filterButtonText: {
    color: "#FFFFFF",
    textAlign: "center",
    fontWeight: "bold",
  },
  loadingOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(255,255,255,0.7)",
    justifyContent: "center",
    alignItems: "center",
  },
});

export default Home;
