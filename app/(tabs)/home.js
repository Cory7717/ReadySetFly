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
  Platform,
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
  setDoc,
} from "firebase/firestore";
import { Ionicons } from "@expo/vector-icons";
import wingtipClouds from "../../Assets/images/wingtip_clouds.jpg";
import { Calendar } from "react-native-calendars";
import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import Constants from "expo-constants";
import { Picker } from "@react-native-picker/picker";
import { CardField } from "@stripe/stripe-react-native";
import { LinearGradient } from 'expo-linear-gradient';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

const Home = ({ route, navigation }) => {
  const [user, setUser] = useState(null);
  const [listings, setListings] = useState([]);
  const [recommendedListings, setRecommendedListings] = useState([]);
  const [selectedListing, setSelectedListing] = useState(null);
  const [imageIndex, setImageIndex] = useState(0);
  const [fullScreenModalVisible, setFullScreenModalVisible] = useState(false);
  const [zoomModalVisible, setZoomModalVisible] = useState(false);
  const [zoomImageUri, setZoomImageUri] = useState(null);
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

  // Notification Listener References
  const notificationListener = useRef();
  const responseListener = useRef();

  // Register for Push Notifications and Update Firestore
  useEffect(() => {
    const registerForPushNotificationsAsync = async () => {
      let token;
      if (Device.isDevice) {
        const { status: existingStatus } =
          await Notifications.getPermissionsAsync();
        let finalStatus = existingStatus;
        if (existingStatus !== "granted") {
          const { status } = await Notifications.requestPermissionsAsync();
          finalStatus = status;
        }
        if (finalStatus !== "granted") {
          Alert.alert(
            "Permission required",
            "Failed to get push token for notifications!"
          );
          return;
        }
        token = (await Notifications.getExpoPushTokenAsync()).data;
        console.log("Expo Push Token:", token);
      } else {
        Alert.alert(
          "Error",
          "Must use a physical device for Push Notifications"
        );
      }

      if (token && user) {
        try {
          const renterRef = doc(db, "users", user.uid, "renters", user.uid);
          await setDoc(renterRef, { fcmToken: token }, { merge: true });
          console.log("FCM Token saved to Firestore");
        } catch (error) {
          console.error("Error saving FCM token to Firestore:", error);
        }
      }

      if (Platform.OS === "android") {
        Notifications.setNotificationChannelAsync("default", {
          name: "default",
          importance: Notifications.AndroidImportance.MAX,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: "#FF231F7C",
        });
      }
    };

    if (user) {
      registerForPushNotificationsAsync();
    }
  }, [user]);

  // Handle Incoming Notifications and Responses
  useEffect(() => {
    if (!user) return;

    // Listener for incoming notifications
    notificationListener.current =
      Notifications.addNotificationReceivedListener((notification) => {
        console.log("Notification Received:", notification);
        // Handle the notification here if needed
      });

    // Listener for user interacting with a notification
    responseListener.current =
      Notifications.addNotificationResponseReceivedListener((response) => {
        console.log("Notification Response:", response);
        const data = response.notification.request.content.data;
        console.log("Notification Data:", data);

        if (data && data.listingId) {
          // Find the listing by ID from 'listings' or 'recommendedListings'
          const listing =
            listings.find((item) => item.id === data.listingId) ||
            recommendedListings.find((item) => item.id === data.listingId);

          if (listing) {
            if (!listing.ownerId) {
              Alert.alert(
                "Error",
                "The listing associated with this notification does not have a valid owner."
              );
              console.warn(
                `Listing with ID ${data.listingId} is missing 'ownerId'.`
              );
              return;
            }
            setSelectedListing(listing);
            console.log("Listing set from notification:", listing);
            setImageIndex(0);
            setFullScreenModalVisible(true);
            setFullName(user?.displayName || fullName || "Anonymous");
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
      if (notificationListener.current) {
        Notifications.removeNotificationSubscription(
          notificationListener.current
        );
      }
      if (responseListener.current) {
        Notifications.removeNotificationSubscription(responseListener.current);
      }
    };
  }, [listings, recommendedListings, user]);

  // Auth State Change Listener
  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (firebaseUser) => {
      if (firebaseUser) {
        setUser(firebaseUser);
        setFullName(firebaseUser.displayName || fullName || "Anonymous");
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
      setListings((prevListings) => [
        route.params.newListing,
        ...prevListings,
      ]);
    }

    if (route?.params?.unlistedId) {
      setListings((prevListings) =>
        prevListings.filter((listing) => listing.id !== route.params.unlistedId)
      );
    }
  }, [route?.params?.newListing, route?.params?.unlistedId]);

  // Helper function to parse the combined 'aircraftModel' field
  const parseAircraft = (aircraftModel) => {
    if (!aircraftModel || typeof aircraftModel !== "string") {
      return {
        year: "Unknown Year",
        make: "Unknown Make",
        airplaneModel: "Unknown Model",
      };
    }

    // Replace slashes with spaces to standardize the format
    const normalizedModel = aircraftModel.replace(/\//g, " ");

    // Regular expression to match "Year Make Model"
    const regex = /^(\d{4})\s+(\w+)\s+(.+)$/;
    const match = normalizedModel.trim().match(regex);

    if (match) {
      return {
        year: match[1],
        make: match[2],
        airplaneModel: match[3],
      };
    }

    console.warn(`Unable to parse aircraftModel field: "${aircraftModel}"`);
    return {
      year: "Unknown Year",
      make: "Unknown Make",
      airplaneModel: "Unknown Model",
    };
  };

  // Subscribe to Firestore listings
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
            const parsedAircraft = parseAircraft(data.aircraftModel);
            const { year, make, airplaneModel } = parsedAircraft;

            return {
              id: doc.id,
              year: year || "Unknown Year",
              make: make || "Unknown Make",
              airplaneModel: airplaneModel || "Unknown Model",
              ownerId: data.ownerId || null,
              costPerHour: data.costPerHour || "0.00",
              location: data.location || "Unknown Location",
              description: data.description || "No description available.",
              images: Array.isArray(data.images) ? data.images : [data.images],
              createdAt: data.createdAt || serverTimestamp(),
            };
          })
          // Filter out listings without a valid ownerId
          .filter((listing) => listing.ownerId);

        // Log detailed information about each listing
        listingsData.forEach((listing) => {
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
          Alert.alert(
            "Error",
            "An unexpected error occurred while fetching listings."
          );
        }
      }
    );
  };

  // Fetch Recommended Listings from Firestore
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
        const parsedAircraft = parseAircraft(data.aircraftModel);
        const { year, make, airplaneModel } = parsedAircraft;

        return {
          id: doc.id,
          year: year || "Unknown Year",
          make: make || "Unknown Make",
          airplaneModel: airplaneModel || "Unknown Model",
          ownerId: data.ownerId || null,
          costPerHour: data.costPerHour || "0.00",
          location: data.location || "Unknown Location",
          description: data.description || "No description available.",
          images: Array.isArray(data.images) ? data.images : [data.images],
          createdAt: data.createdAt || serverTimestamp(),
        };
      });

      // Filter out listings without a valid ownerId
      const validRecommended = recommendedData.filter(
        (listing) => listing.ownerId
      );
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

  // Calculate the total cost based on rental hours
  const calculateTotalCost = (hours) => {
    if (!selectedListing) return;

    const pricePerHour = parseFloat(selectedListing.costPerHour);
    if (isNaN(pricePerHour)) {
      Alert.alert(
        "Pricing Error",
        "Invalid rate per hour for the selected listing."
      );
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

  // Handle Sending a Rental Request to the Owner
  const handleSendRentalRequest = async () => {
    console.log("Attempting to send rental request.");
    console.log("Selected Listing:", selectedListing);
    console.log("Selected Listing ID:", selectedListing?.id);

    if (!selectedListing) {
      Alert.alert("Selection Error", "No listing selected.");
      return;
    }

    if (!selectedListing.id) {
      Alert.alert(
        "Error",
        "Listing ID is missing. Please select a valid listing."
      );
      return;
    }

    if (!selectedListing.ownerId) {
      Alert.alert(
        "Listing Error",
        "The selected listing does not have a valid owner. Please select a different listing."
      );
      console.error(
        `Selected listing ID: ${selectedListing.id} is missing 'ownerId'.`
      );
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
      Alert.alert(
        "Input Required",
        "Please enter a valid number of flight hours."
      );
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

    const rentalCost = parseFloat(selectedListing.costPerHour) * rentalHours;
    if (isNaN(rentalCost) || rentalCost <= 0) {
      Alert.alert("Pricing Error", "Invalid rental cost calculated.");
      return;
    }

    // Calculate owner's payout (rental cost minus 6% commission)
    const ownerPayout = rentalCost * 0.94;

    // Prepare rentalRequestData
    let rentalRequestData = {};

    try {
      const renterFullName = fullName.trim() || user?.displayName || "Anonymous";

      rentalRequestData = {
        renterId: user.uid,
        renterName: renterFullName,
        ownerId: selectedListing.ownerId,
        listingId: selectedListing.id,
        rentalHours: rentalHours,
        baseCost: rentalCost.toFixed(2),
        commission: (rentalCost * 0.06).toFixed(2),
        totalCost: (rentalCost - rentalCost * 0.06).toFixed(2),
        rentalDate: rentalDate,
        status: "pending",
        createdAt: serverTimestamp(),
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

      // Add to Centralized 'rentalRequests' Collection
      const rentalRequestsRef = collection(db, "rentalRequests");
      const rentalRequestDoc = await addDoc(
        rentalRequestsRef,
        rentalRequestData
      );
      const rentalRequestId = rentalRequestDoc.id;

      // Optionally, update the document with its own ID
      await setDoc(rentalRequestDoc, { id: rentalRequestId }, { merge: true });

      console.log(
        `Created rental request ${rentalRequestId} for listing ${selectedListing.id} with ownerId ${selectedListing.ownerId}`
      );
      Alert.alert(
        "Success",
        "Rental request created successfully. You will be notified once the owner reviews your request."
      );

      // Close the modal and reset form fields
      setFullScreenModalVisible(false);
      setFullName(user?.displayName || fullName || "Anonymous");
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
      Alert.alert(
        "Error",
        error.message || "Failed to send rental request to the owner."
      );
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
    // Implement navigation or modal for editing the listing
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
    outputRange: [220, 0],
    extrapolate: "clamp",
  });

  const headerOpacity = scrollY.interpolate({
    inputRange: [0, 150],
    outputRange: [1, 0],
    extrapolate: "clamp",
  });

  // Render Pagination Dots
  const renderPaginationDots = () => {
    if (!selectedListing || !selectedListing.images) return null;
    return (
      <View style={styles.paginationDotsContainer}>
        {selectedListing.images.map((_, index) => (
          <View
            key={index}
            style={[
              styles.paginationDot,
              index === imageIndex ? styles.activeDot : styles.inactiveDot,
            ]}
          />
        ))}
      </View>
    );
  };

  // Handle image press to open zoom modal
  const handleImagePress = (uri) => {
    setZoomImageUri(uri);
    setZoomModalVisible(true);
  };

  // ------------------------------------------------------------------------------
  //  UPDATED RENDER ITEM: Redesigned Listing Cards (while still side-by-side)
  // ------------------------------------------------------------------------------
  const renderItem = ({ item }) => {
    const airplaneModelDisplay = item.airplaneModel || "Unknown Model";
    const makeDisplay = item.make || "Unknown Make";
    const yearDisplay = item.year || "Unknown Year";

    return (
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
          setImageIndex(0);
          setFullScreenModalVisible(true);
          setFullName(user?.displayName || fullName || "Anonymous");
          setCityStateCombined("");
          setHasMedicalCertificate(false);
          setHasRentersInsurance(false);
          setFlightHours("");
        }}
        style={styles.newListingCardWrapper}
        accessibilityLabel={`Select listing: ${yearDisplay} ${makeDisplay} ${airplaneModelDisplay}`}
        accessibilityRole="button"
      >
        {/* Image Section */}
        <View style={styles.newListingImageContainer}>
          {item.images && item.images.length > 0 ? (
            <ImageBackground
              source={{ uri: item.images[0] }}
              style={styles.newListingImageBackground}
              imageStyle={{ borderTopLeftRadius: 12, borderTopRightRadius: 12 }}
            >
              {/* Gradient Overlay for location and rate */}
              <LinearGradient
                colors={["transparent", "rgba(0,0,0,0.7)"]}
                style={styles.newListingOverlay}
              >
                <Text style={styles.newListingLocation}>{item.location}</Text>
                <Text style={styles.newListingRate}>
                  ${parseFloat(item.costPerHour).toFixed(2)}/hr
                </Text>
              </LinearGradient>
            </ImageBackground>
          ) : (
            <View style={styles.noImageContainer}>
              <Ionicons name="image" size={50} color="#A0AEC0" />
              <Text style={styles.noImageText}>No Image</Text>
            </View>
          )}
        </View>

        {/* Info Section */}
        <View style={styles.newListingInfoContainer}>
          <Text style={styles.newListingTitle} numberOfLines={1}>
            {`${yearDisplay} ${makeDisplay}`}
          </Text>
          <Text style={styles.newListingModel} numberOfLines={1}>
            {airplaneModelDisplay}
          </Text>
          <Text style={styles.newListingDescription} numberOfLines={1}>
            {(() => {
              const words = item.description.split(" ");
              return words.slice(0, 5).join(" ") + (words.length > 5 ? "..." : "");
            })()}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  // Redesigned Filter Header with added Available Aircraft Rentals text
  const renderListHeader = () => (
    <>
      <Text style={styles.availableAircraftHeader}>Available Aircraft Rentals</Text>
      <View style={styles.filterHeader}>
        <Text style={styles.filterTitle}>Filter Listings</Text>
        <TouchableOpacity
          onPress={() => setFilterModalVisible(true)}
          style={styles.filterButton}
          accessibilityLabel="Open filter options"
          accessibilityRole="button"
        >
          <Ionicons name="filter" size={24} color="#1E90FF" />
        </TouchableOpacity>
      </View>
    </>
  );

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
      <View style={styles.recommendedListingsContainer}>
        <Text style={styles.sectionTitle}>Recommended for You</Text>
        {isRecommendedLoading ? (
          <ActivityIndicator size="large" color="#1E90FF" />
        ) : recommendedListings.length > 0 ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {recommendedListings.map((listing) => (
              <TouchableOpacity
                key={listing.id}
                style={styles.recommendedCard}
                onPress={() => {
                  if (!listing.ownerId) {
                    Alert.alert(
                      "Listing Unavailable",
                      "This recommended listing does not have a valid owner and cannot be rented."
                    );
                    return;
                  }
                  setSelectedListing(listing);
                  setImageIndex(0);
                  setFullScreenModalVisible(true);
                  setZoomImageUri(null);
                  setZoomModalVisible(false);
                  setFullName(user?.displayName || fullName || "Anonymous");
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
                    style={styles.recommendedImage}
                    resizeMode="cover"
                  />
                ) : (
                  <View style={styles.noImageContainer}>
                    <Ionicons name="image" size={50} color="#FFFFFF" />
                    <Text style={styles.noImageText}>No Image</Text>
                  </View>
                )}
                <Text style={styles.recommendedTitle}>
                  {`${listing.year} ${listing.make} ${listing.airplaneModel}`}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        ) : (
          <Text style={styles.emptyListText}>
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
        contentContainerStyle={{ paddingTop: 180 }}
        ListHeaderComponent={renderListHeader}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <Text style={styles.emptyListText}>No listings available</Text>
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

              <Animated.ScrollView
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                onScroll={Animated.event(
                  [{ nativeEvent: { contentOffset: { x: scrollY } } }],
                  {
                    useNativeDriver: false,
                    listener: (event) => {
                      const offsetX = event.nativeEvent.contentOffset.x;
                      const index = Math.round(offsetX / SCREEN_WIDTH);
                      setImageIndex(index);
                    },
                  }
                )}
                scrollEventThrottle={16}
                style={styles.carouselScrollView}
              >
                {selectedListing.images.map((image, index) => (
                  <TouchableOpacity
                    key={index}
                    activeOpacity={0.9}
                    onPress={() => handleImagePress(image)}
                  >
                    <View style={styles.carouselImageContainer}>
                      <Image
                        source={{ uri: image }}
                        style={styles.modalImage}
                        resizeMode="contain"
                      />
                      <LinearGradient
                        colors={["transparent", "rgba(0,0,0,0.7)"]}
                        style={styles.gradientOverlay}
                      />
                      <View style={styles.imageInfoContainer}>
                        <Text style={styles.imageTitle}>
                          {`${selectedListing.year} ${selectedListing.make} ${selectedListing.airplaneModel}`}
                        </Text>
                        <Text style={styles.imageRate}>
                          ${parseFloat(selectedListing.costPerHour).toFixed(2)}/hour
                        </Text>
                        <Text style={styles.imageLocation}>
                          Location: {selectedListing.location}
                        </Text>
                      </View>
                    </View>
                  </TouchableOpacity>
                ))}
              </Animated.ScrollView>

              {renderPaginationDots()}

              <ScrollView
                contentContainerStyle={styles.modalContent}
                showsVerticalScrollIndicator={false}
              >
                <Text
                  style={styles.modalTitle}
                  accessibilityLabel="Listing title"
                >
                  {`${selectedListing.year} ${selectedListing.make} ${selectedListing.airplaneModel}`}
                </Text>
                <Text
                  style={styles.modalRate}
                  accessibilityLabel="Rate per hour"
                >
                  ${parseFloat(selectedListing.costPerHour).toFixed(2)} per hour
                </Text>
                <Text
                  style={styles.modalLocation}
                  accessibilityLabel="Location"
                >
                  Location: {selectedListing.location}
                </Text>

                <Text
                  style={styles.modalDescription}
                  accessibilityLabel="Description"
                >
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

                <TouchableOpacity
                  onPress={() => handleDeleteListing(selectedListing.id)}
                  style={styles.modalDeleteButton}
                  accessibilityLabel="Developer delete listing"
                  accessibilityRole="button"
                >
                  <Text style={styles.buttonText}>Developer Delete</Text>
                </TouchableOpacity>

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
                        Alert.alert(
                          "Invalid Input",
                          "Please enter a valid number of rental hours."
                        );
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
                  <Text
                    style={styles.selectedDateText}
                    accessibilityLabel="Selected rental date"
                  >
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

      {/* Zoom Image Modal */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={zoomModalVisible}
        onRequestClose={() => setZoomModalVisible(false)}
      >
        <View style={styles.zoomModalContainer}>
          <TouchableOpacity
            onPress={() => setZoomModalVisible(false)}
            style={styles.zoomCloseButton}
            accessibilityLabel="Close zoomed image"
            accessibilityRole="button"
          >
            <Ionicons name="close" size={30} color="white" />
          </TouchableOpacity>
          <ScrollView
            contentContainerStyle={styles.zoomScrollView}
            maximumZoomScale={3}
            minimumZoomScale={1}
            showsVerticalScrollIndicator={false}
            showsHorizontalScrollIndicator={false}
            centerContent={true}
          >
            {zoomImageUri && (
              <Image
                source={{ uri: zoomImageUri }}
                style={styles.zoomImage}
                resizeMode="contain"
              />
            )}
          </ScrollView>
        </View>
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
          activeOpacity={1}
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

            <Text style={styles.filterLabel}>Location</Text>
            <View style={styles.pickerContainer}>
              <Picker
                selectedValue={cityState}
                onValueChange={(itemValue) => setCityState(itemValue)}
                style={styles.picker}
                accessibilityLabel="Filter by location"
              >
                <Picker.Item label="All Locations" value="" />
                <Picker.Item label="New York, NY" value="new york, ny" />
                <Picker.Item label="Los Angeles, CA" value="los angeles, ca" />
                <Picker.Item label="Chicago, IL" value="chicago, il" />
              </Picker>
            </View>

            <View style={styles.orSeparator}>
              <View style={styles.line} />
              <Text style={styles.orText}>OR</Text>
              <View style={styles.line} />
            </View>

            <Text style={styles.filterLabel}>Aircraft Make</Text>
            <View style={styles.pickerContainer}>
              <Picker
                selectedValue={makeModel}
                onValueChange={(itemValue) => setMakeModel(itemValue)}
                style={styles.picker}
                accessibilityLabel="Filter by aircraft make"
              >
                <Picker.Item label="All Makes" value="" />
                <Picker.Item label="Cessna" value="cessna" />
                <Picker.Item label="Boeing" value="boeing" />
                <Picker.Item label="Airbus" value="airbus" />
              </Picker>
            </View>

            <View style={styles.filterActions}>
              <TouchableOpacity
                onPress={clearFilter}
                style={styles.clearFilterButton}
                accessibilityLabel="Clear filters"
                accessibilityRole="button"
              >
                <Text style={styles.filterActionText}>Clear</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={applyFilter}
                style={styles.applyFilterButton}
                accessibilityLabel="Apply filters"
                accessibilityRole="button"
              >
                <Text style={styles.filterActionText}>Apply</Text>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      </Modal>

      {isLoading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#1E90FF" />
        </View>
      )}
    </SafeAreaView>
  );
};

// -------------------------------------------------------------------------------------------------
//  UPDATED/NEW STYLES FOR THE LISTING CARDS (plus existing styles remain unchanged below).
// -------------------------------------------------------------------------------------------------
const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#F7FAFC",
  },
  header: {
    position: "absolute",
    top: 0,
    width: "100%",
    zIndex: 1,
  },
  headerImage: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  headerContent: {
    backgroundColor: "rgba(0,0,0,0.6)",
    padding: 20,
    borderRadius: 12,
  },
  welcomeText: {
    fontSize: 18,
    color: "#FFFFFF",
  },
  userName: {
    fontSize: 28,
    fontWeight: "700",
    color: "#FFFFFF",
    marginTop: 4,
  },
  recommendedListingsContainer: {
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "700",
    marginBottom: 16,
    color: "#2D3748",
  },
  recommendedCard: {
    width: 200,
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    marginRight: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 4,
    overflow: "hidden",
  },
  recommendedImage: {
    width: "100%",
    height: 120,
  },
  noImageContainer: {
    width: "100%",
    height: 100,
    backgroundColor: "#A0AEC0",
    justifyContent: "center",
    alignItems: "center",
  },
  noImageText: {
    color: "#FFFFFF",
    marginTop: 8,
    fontSize: 14,
  },
  recommendedTitle: {
    padding: 12,
    fontSize: 16,
    fontWeight: "600",
    color: "#2D3748",
  },
  // --- BEGIN NEW LISTING CARD STYLES ---
  newListingCardWrapper: {
    flex: 1,
    margin: 6,
    maxWidth: (SCREEN_WIDTH - 24) / 2, // increased width and reduced margin for a wider, more compact card
    backgroundColor: "#fff",
    borderRadius: 12,
    overflow: "hidden",
    elevation: 5,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  newListingImageContainer: {
    width: "100%",
    height: 100, // reduced height for a more compact image
    backgroundColor: "#E2E8F0",
  },
  newListingImageBackground: {
    width: "100%",
    height: "100%",
    justifyContent: "flex-end",
  },
  newListingOverlay: {
    padding: 6,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
  },
  newListingLocation: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "600",
    maxWidth: "60%",
  },
  newListingRate: {
    color: "#FFD700",
    fontSize: 12,
    fontWeight: "700",
  },
  newListingInfoContainer: {
    padding: 10,
  },
  newListingTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#2D3748",
  },
  newListingModel: {
    marginTop: 2,
    fontSize: 13,
    fontWeight: "600",
    color: "#4A5568",
  },
  newListingDescription: {
    fontSize: 12,
    color: "#4A5568",
    marginVertical: 6,
  },
  // --- END NEW LISTING CARD STYLES ---
  filterHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  filterTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#2D3748",
  },
  filterButton: {
    padding: 8,
  },
  availableListingsTitle: {
    fontSize: 20,
    fontWeight: "700",
    paddingHorizontal: 16,
    marginBottom: 16,
    color: "#2D3748",
  },
  // New style for the added header text
  availableAircraftHeader: {
    fontSize: 28,
    fontWeight: "700",
    textAlign: "center",
    color: "#2D3748",
    marginVertical: 16,
  },
  columnWrapper: {
    justifyContent: "space-between",
    paddingHorizontal: 16,
  },
  emptyListText: {
    textAlign: "center",
    color: "#718096",
    marginTop: 16,
    fontSize: 16,
  },
  scrollToTopButton: {
    position: "absolute",
    bottom: 32,
    right: 32,
    backgroundColor: "#1E90FF",
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: "center",
    alignItems: "center",
    elevation: 5,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  modalSafeArea: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  modalContainer: {
    flex: 1,
    padding: 16,
    position: "relative",
  },
  modalCloseButton: {
    alignSelf: "flex-end",
    marginBottom: 10,
  },
  carouselScrollView: {
    height: 250,
    borderRadius: 12,
    overflow: "hidden",
    marginBottom: 8,
  },
  carouselImageContainer: {
    width: SCREEN_WIDTH - 32,
    height: 250,
    marginRight: 16,
    borderRadius: 12,
    overflow: "hidden",
  },
  modalImage: {
    width: "100%",
    height: "100%",
    borderRadius: 12,
  },
  gradientOverlay: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: "40%",
  },
  imageInfoContainer: {
    position: "absolute",
    bottom: 16,
    left: 16,
  },
  imageTitle: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 4,
  },
  imageRate: {
    color: "#FFFFFF",
    fontSize: 16,
    marginBottom: 2,
  },
  imageLocation: {
    color: "#FFFFFF",
    fontSize: 14,
  },
  paginationDotsContainer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginTop: 8,
  },
  paginationDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginHorizontal: 4,
  },
  activeDot: {
    backgroundColor: "#1E90FF",
  },
  inactiveDot: {
    backgroundColor: "#A0AEC0",
  },
  modalContent: {
    paddingVertical: 16,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: "700",
    marginBottom: 8,
    color: "#2D3748",
  },
  modalRate: {
    fontSize: 18,
    color: "#1E90FF",
    marginBottom: 8,
  },
  modalLocation: {
    fontSize: 16,
    marginBottom: 8,
    color: "#4A5568",
  },
  modalDescription: {
    fontSize: 16,
    color: "#4A5568",
    marginBottom: 16,
  },
  modalOwnerActions: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  modalEditButton: {
    backgroundColor: "#48BB78",
    padding: 12,
    borderRadius: 8,
    flex: 1,
    marginRight: 8,
    alignItems: "center",
  },
  modalDeleteButton: {
    backgroundColor: "#E53E3E",
    padding: 12,
    borderRadius: 8,
    flex: 1,
    marginLeft: 8,
    alignItems: "center",
    marginBottom: 16,
  },
  buttonText: {
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: 16,
  },
  inputGroup: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 16,
    marginBottom: 4,
    color: "#2D3748",
  },
  textInput: {
    borderWidth: 1,
    borderColor: "#A0AEC0",
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: "#2D3748",
  },
  textInputSmall: {
    borderWidth: 1,
    borderColor: "#A0AEC0",
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: "#2D3748",
    width: "100%",
  },
  toggleGroup: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  calendarButton: {
    backgroundColor: "#1E90FF",
    padding: 12,
    borderRadius: 8,
    alignItems: "center",
    marginBottom: 8,
  },
  calendarButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
  },
  selectedDateText: {
    fontSize: 16,
    textAlign: "center",
    marginBottom: 16,
    color: "#4A5568",
  },
  totalCostContainer: {
    backgroundColor: "#EDF2F7",
    padding: 16,
    borderRadius: 8,
    marginBottom: 16,
  },
  totalCostTitle: {
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 8,
    color: "#2D3748",
  },
  totalCostValue: {
    fontSize: 20,
    fontWeight: "700",
    marginTop: 8,
    color: "#2F855A",
  },
  sendRequestButton: {
    backgroundColor: "#3182CE",
    padding: 16,
    borderRadius: 8,
    alignItems: "center",
    marginBottom: 16,
  },
  sendRequestButtonText: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "700",
  },
  calendarModalContainer: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  calendarContent: {
    width: "90%",
    backgroundColor: "#FFFFFF",
    borderRadius: 8,
    padding: 16,
  },
  closeCalendarButton: {
    marginTop: 16,
    alignItems: "center",
  },
  closeCalendarButtonText: {
    color: "#1E90FF",
    fontSize: 16,
    fontWeight: "700",
  },
  filterModalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  filterModalContent: {
    backgroundColor: "#FFFFFF",
    padding: 20,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: SCREEN_HEIGHT * 0.6,
  },
  filterModalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  filterModalTitle: {
    fontSize: 22,
    fontWeight: "700",
    color: "#2D3748",
  },
  filterLabel: {
    fontSize: 16,
    fontWeight: "600",
    color: "#2D3748",
    marginBottom: 8,
  },
  pickerContainer: {
    borderWidth: 1,
    borderColor: "#CBD5E0",
    borderRadius: 8,
    marginBottom: 16,
    overflow: "hidden",
  },
  picker: {
    height: 50,
    width: "100%",
    color: "#2D3748",
  },
  orSeparator: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 10,
  },
  line: {
    flex: 1,
    height: 1,
    backgroundColor: "#CBD5E0",
  },
  orText: {
    marginHorizontal: 10,
    fontSize: 16,
    color: "#718096",
  },
  filterActions: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 10,
  },
  clearFilterButton: {
    backgroundColor: "#E53E3E",
    padding: 14,
    borderRadius: 8,
    flex: 1,
    marginRight: 10,
    alignItems: "center",
  },
  applyFilterButton: {
    backgroundColor: "#1E90FF",
    padding: 14,
    borderRadius: 8,
    flex: 1,
    marginLeft: 10,
    alignItems: "center",
  },
  filterActionText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
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
  zoomModalContainer: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.9)",
    justifyContent: "center",
    alignItems: "center",
  },
  zoomCloseButton: {
    position: "absolute",
    top: 40,
    right: 20,
    zIndex: 1,
  },
  zoomScrollView: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
    justifyContent: "center",
    alignItems: "center",
  },
  zoomImage: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
  },
});

export default Home;
