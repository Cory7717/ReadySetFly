// home.js

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
import { Picker } from "@react-native-picker/picker"; // Ensure Picker is imported
import { CardField } from "@stripe/stripe-react-native"; // Ensure Stripe is set up

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

  // **Notification Listener References**
  const notificationListener = useRef();
  const responseListener = useRef();

  /**
   * **New Functionality: Register for Push Notifications and Update Firestore**
   *
   * This function handles:
   * 1. Registering the device for push notifications.
   * 2. Retrieving the Expo Push Notification Token (FCM Token).
   * 3. Saving/updating the token in Firebase Firestore under the renter's document.
   */
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
          // Adjust the Firestore path as per your data structure
          const renterRef = doc(db, "users", user.uid, "renters", user.uid);
          await setDoc(renterRef, { fcmToken: token }, { merge: true });
          console.log("FCM Token saved to Firestore");
        } catch (error) {
          console.error("Error saving FCM token to Firestore:", error);
        }
      }

      // For Android, set notification channel
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

  /**
   * **Handle Incoming Notifications and Responses**
   *
   * This effect sets up listeners for incoming notifications and user interactions with notifications.
   */
  useEffect(() => {
    if (!user) return;

    // Listener for incoming notifications
    notificationListener.current =
      Notifications.addNotificationReceivedListener((notification) => {
        console.log("Notification Received:", notification);
        // You can handle the notification here if needed
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
      if (notificationListener.current) {
        Notifications.removeNotificationSubscription(
          notificationListener.current
        );
      }
      if (responseListener.current) {
        Notifications.removeNotificationSubscription(
          responseListener.current
        );
      }
    };
  }, [listings, recommendedListings, user]);

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

  /**
   * Helper function to parse the combined 'aircraftModel' field.
   * Supports formats like "Year Make Model" and "Year/Make/Model".
   * Returns an object with year, make, and airplaneModel.
   */
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
      const validRecommended = recommendedData.filter((listing) => listing.ownerId);
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

  /**
   * **Updated Function: Handle Sending a Rental Request to the Owner**
   *
   * This function now adds rental requests directly to the centralized 'rentalRequests' collection.
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

    // Declare rentalRequestData
    let rentalRequestData = {};

    try {
      // Assign 'Unknown Model' if airplaneModel is undefined
      const airplaneModel =
        selectedListing.airplaneModel || "Unknown Model";
      if (airplaneModel === "Unknown Model") {
        console.warn(
          `Listing ID: ${selectedListing.id} is missing airplaneModel. Assigning 'Unknown Model'.`
        );
      }

      rentalRequestData = {
        renterId: user.uid,
        renterName: fullName, // Correctly set renterName
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

      // **New: Add to Centralized 'rentalRequests' Collection**
      const rentalRequestsRef = collection(db, "rentalRequests");
      const rentalRequestDoc = await addDoc(rentalRequestsRef, rentalRequestData);
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
    const airplaneModelDisplay = item.airplaneModel || "Unknown Model";
    const makeDisplay = item.make || "Unknown Make";
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
                  ${parseFloat(item.costPerHour).toFixed(2)}/hour
                </Text>
              </View>
            </ImageBackground>
          ) : (
            <View
              style={[
                styles.listingImage,
                { justifyContent: "center", alignItems: "center" },
              ]}
            >
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
   * **New Functionality: Handle Rental Requests from Centralized Collection**
   *
   * This function can be used to fetch and display rental requests if needed.
   * Currently, 'home.js' primarily handles sending rental requests.
   * Ensure that any rental request handling aligns with the centralized structure.
   */

  // ... (Other existing functions)

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
                <Text
                  style={styles.modalRate}
                  accessibilityLabel="Rate per hour"
                >
                  ${parseFloat(selectedListing.costPerHour).toFixed(2)} per hour
                </Text>
                <Text style={styles.modalLocation} accessibilityLabel="Location">
                  Location: {selectedListing.location}
                </Text>

                <Text
                  style={styles.modalDescription}
                  accessibilityLabel="Description"
                >
                  {selectedListing.description}
                </Text>

                {/* Display Owner ID Check */}
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

// Styles
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
    backgroundColor: "rgba(0,0,0,0.3)",
    padding: 16,
    borderRadius: 8,
  },
  welcomeText: {
    fontSize: 16,
    color: "#FFFFFF",
  },
  userName: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#FFFFFF",
  },
  recommendedListingsContainer: {
    paddingHorizontal: 16,
    paddingTop: 24,
  },
  listingContainer: {
    flex: 1,
    margin: 8,
    maxWidth: (SCREEN_WIDTH - 48) / 2, // Adjusted for padding and margins
  },
  listingCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 10,
    overflow: "hidden",
    elevation: 3, // For Android shadow
    shadowColor: "#000", // For iOS shadow
    shadowOffset: { width: 0, height: 2 }, // For iOS shadow
    shadowOpacity: 0.1, // For iOS shadow
    shadowRadius: 4, // For iOS shadow
  },
  listingHeader: {
    padding: 8,
  },
  listingTitle: {
    fontSize: 16,
    fontWeight: "bold",
  },
  listingImage: {
    width: "100%",
    height: 120,
    justifyContent: "flex-end",
  },
  listingImageOverlay: {
    backgroundColor: "rgba(0,0,0,0.5)",
    padding: 4,
  },
  listingLocation: {
    color: "#FFFFFF",
    fontSize: 12,
  },
  listingRate: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "bold",
  },
  listingDescriptionContainer: {
    padding: 8,
  },
  listingDescription: {
    fontSize: 14,
    color: "#4A5568",
  },
  filterHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  filterText: {
    fontSize: 16,
    fontWeight: "bold",
  },
  filterButton: {
    padding: 8,
  },
  availableListingsTitle: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 16,
  },
  emptyListText: {
    textAlign: "center",
    color: "#718096",
    marginTop: 16,
  },
  scrollToTopButton: {
    position: "absolute",
    bottom: 32,
    right: 32,
    backgroundColor: "#1E90FF",
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: "center",
    alignItems: "center",
    elevation: 5,
  },
  modalSafeArea: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  modalContainer: {
    flex: 1,
    padding: 16,
  },
  modalCloseButton: {
    alignSelf: "flex-end",
  },
  modalImageContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
  },
  modalImage: {
    width: SCREEN_WIDTH - 64,
    height: 200,
    borderRadius: 10,
  },
  modalArrowButtonLeft: {
    marginRight: 8,
  },
  modalArrowButtonRight: {
    marginLeft: 8,
  },
  modalContent: {
    paddingVertical: 16,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: "bold",
    marginBottom: 8,
  },
  modalRate: {
    fontSize: 18,
    color: "#1E90FF",
    marginBottom: 8,
  },
  modalLocation: {
    fontSize: 16,
    marginBottom: 8,
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
  },
  buttonText: {
    color: "#FFFFFF",
    fontWeight: "bold",
  },
  inputGroup: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 16,
    marginBottom: 4,
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
    fontWeight: "bold",
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
    fontWeight: "bold",
    marginBottom: 8,
  },
  totalCostValue: {
    fontSize: 20,
    fontWeight: "bold",
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
    fontWeight: "bold",
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
    fontWeight: "bold",
  },
  filterModalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  filterModalContent: {
    width: "90%",
    backgroundColor: "#FFFFFF",
    borderRadius: 8,
    padding: 16,
  },
  filterModalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  filterModalTitle: {
    fontSize: 20,
    fontWeight: "bold",
  },
  filterTextInput: {
    borderWidth: 1,
    borderColor: "#A0AEC0",
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: "#2D3748",
    marginBottom: 16,
  },
  orText: {
    textAlign: "center",
    marginVertical: 8,
    color: "#718096",
  },
  filterButtonsContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  clearFilterButton: {
    backgroundColor: "#E53E3E",
    padding: 12,
    borderRadius: 8,
    flex: 1,
    marginRight: 8,
    alignItems: "center",
  },
  applyFilterButton: {
    backgroundColor: "#1E90FF",
    padding: 12,
    borderRadius: 8,
    flex: 1,
    marginLeft: 8,
    alignItems: "center",
  },
  filterButtonText: {
    color: "#FFFFFF",
    fontWeight: "bold",
    fontSize: 16,
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
