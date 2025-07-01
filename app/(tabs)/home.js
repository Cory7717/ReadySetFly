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
  getDoc, // Added getDoc import to fetch user role
} from "firebase/firestore";
import { Ionicons } from "@expo/vector-icons";
import wingtipClouds from "../../Assets/images/wingtip_clouds.jpg";
import { Calendar } from "react-native-calendars";
import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import Constants from "expo-constants";
import { CardField } from "@stripe/stripe-react-native";
import { LinearGradient } from "expo-linear-gradient";
import * as ImagePicker from "expo-image-picker";

// ── report post setup ──────────────────────────────────────────────
const API_URL = "https://us-central1-ready-set-fly-71506.cloudfunctions.net/api";

const handleReportListing = (listing) => {
  Alert.alert(
    "Report listing",
    "Flag this listing as spam or fraudulent? A moderator will be notified and reports are sent to support@readysetfly.us.",
    [
      { text: "Cancel", style: "cancel" },
      {
        text: "Report",
        style: "destructive",
        onPress: async () => {
          try {
            const token = await auth.currentUser.getIdToken(true);
            const res = await fetch(`${API_URL}/reportListing`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`,
              },
              body: JSON.stringify({ listingId: listing.id }),
            });
            if (!res.ok) throw new Error("Report failed");

            const { reportCount, suspended } = await res.json();

            if (suspended) {
              Alert.alert(
                "Listing Suspended",
                "This listing has reached 5 reports and has been auto-suspended pending review."
              );
            } else {
              Alert.alert("Thank you", "The listing was reported.");
            }
          } catch (err) {
            console.error("Reporting failed:", err);
            Alert.alert("Error", "Could not send report.");
          }
        },
      },
    ]
  );
};
// ───────────────────────────────────────────────────────────────────

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

const Home = ({ route, navigation }) => {
  const [user, setUser] = useState(null);
  const [userRole, setUserRole] = useState(""); // New state for account type: "Owner", "Renter", or "Both"
  const [listings, setListings] = useState([]);
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

  // Notification Listener References
  const notificationListener = useRef();
  const responseListener = useRef();

  // NEW: State for the uploaded image in the header
  const [uploadedImage, setUploadedImage] = useState(null);

  // NEW: State to hold favorite listings (storing listing IDs)
  const [favorites, setFavorites] = useState([]);

  // NEW: Function to handle image upload using Expo ImagePicker
  const handleUploadImage = async () => {
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permissionResult.granted) {
      Alert.alert("Permission required", "Permission to access the camera roll is required!");
      return;
    }
    const pickerResult = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 1,
    });
    if (!pickerResult.cancelled) {
      setUploadedImage(pickerResult.uri);
    }
  };

  // NEW: Function to handle favoriting a listing
  const handleFavorite = async (listing) => {
    if (!user) return;
    if (listing.ownerId === user.uid) {
      Alert.alert("Action Not Allowed", "You cannot favorite your own listing.");
      return;
    }
    if (favorites.includes(listing.id)) {
      Alert.alert("Already Favorited", "This listing is already in your favorites.");
      return;
    }
    try {
      // Save the listing to the user's favorites subcollection in Firestore
      await addDoc(collection(db, "users", user.uid, "favorites"), listing);
      // No need to manually update state—subscription will update favorites.
      Alert.alert("Favorite Added", "Listing has been added to your favorites.");
    } catch (error) {
      console.error("Error favoriting listing:", error);
      Alert.alert("Error", "Failed to add listing to favorites.");
    }
  };

  // NEW: Subscribe to the user's favorites so that the heart icon stays filled
  useEffect(() => {
    if (!user) return;
    const favRef = collection(db, "users", user.uid, "favorites");
    const unsubscribeFav = onSnapshot(favRef, (snapshot) => {
      const favIDs = snapshot.docs.map((docSnap) => docSnap.data().id);
      setFavorites(favIDs);
    }, (error) => {
      console.error("Error subscribing to favorites:", error);
    });
    return () => unsubscribeFav();
  }, [user]);

  // Register for Push Notifications and Update Firestore
  useEffect(() => {
    const registerForPushNotificationsAsync = async () => {
      let token;
      if (Device.isDevice) {
        const { status: existingStatus } = await Notifications.getPermissionsAsync();
        let finalStatus = existingStatus;
        if (existingStatus !== "granted") {
          const { status } = await Notifications.requestPermissionsAsync();
          finalStatus = status;
        }
        if (finalStatus !== "granted") {
          Alert.alert("Permission required", "Failed to get push token for notifications!");
          return;
        }
        token = (await Notifications.getExpoPushTokenAsync()).data;
        console.log("Expo Push Token:", token);
      } else {
        Alert.alert("Error", "Must use a physical device for Push Notifications");
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
    notificationListener.current = Notifications.addNotificationReceivedListener(
      (notification) => {
        console.log("Notification Received:", notification);
      }
    );

    // Listener for user interacting with a notification
    responseListener.current = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        console.log("Notification Response:", response);
        const data = response.notification.request.content.data;
        console.log("Notification Data:", data);

        if (data && data.listingId) {
          const listing = listings.find((item) => item.id === data.listingId);
          if (listing) {
            if (!listing.ownerId) {
              Alert.alert(
                "Error",
                "The listing associated with this notification does not have a valid owner."
              );
              console.warn(`Listing with ID ${data.listingId} is missing 'ownerId'.`);
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
      }
    );

    return () => {
      if (notificationListener.current) {
        Notifications.removeNotificationSubscription(notificationListener.current);
      }
      if (responseListener.current) {
        Notifications.removeNotificationSubscription(responseListener.current);
      }
    };
  }, [listings, user]);

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

  // Fetch user role from Firestore (updated to read "profileType")
  useEffect(() => {
    if (user) {
      const userDocRef = doc(db, "users", user.uid);
      getDoc(userDocRef)
        .then((docSnapshot) => {
          if (docSnapshot.exists()) {
            setUserRole(docSnapshot.data().profileType);
          }
        })
        .catch((error) => {
          console.error("Error fetching user role:", error);
        });
    }
  }, [user]);

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

  // Helper function to parse the combined 'aircraftModel' field
  const parseAircraft = (aircraftModel) => {
    if (!aircraftModel || typeof aircraftModel !== "string") {
      return {
        year: "Unknown Year",
        make: "Unknown Make",
        airplaneModel: "Unknown Model",
      };
    }
    const normalizedModel = aircraftModel.replace(/\//g, " ");
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

  // Subscribe to Firestore listings and then filter client-side based on location and make/model
  const subscribeToListings = () => {
    const listingsRef = collection(db, "airplanes");
    const q = query(listingsRef, where("isListed", "==", true), orderBy("createdAt", "desc"));
    return onSnapshot(
      q,
      (snapshot) => {
        let listingsData = snapshot.docs
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
          .filter((listing) => listing.ownerId);
  
        if (filter.location) {
          listingsData = listingsData.filter((listing) =>
            listing.location.toLowerCase().includes(filter.location)
          );
        }
        if (filter.make) {
          listingsData = listingsData.filter(
            (listing) =>
              listing.make.toLowerCase().includes(filter.make) ||
              listing.airplaneModel.toLowerCase().includes(filter.make)
          );
        }
  
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
  

  // Calculate the total cost based on rental hours
  const calculateTotalCost = (hours) => {
    if (!selectedListing) return;
    const pricePerHour = parseFloat(selectedListing.costPerHour);
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

  // Handle Sending a Rental Request to the Owner
  const handleSendRentalRequest = async () => {
    console.log("Attempting to send rental request.");
    console.log("Selected Listing:", selectedListing);
    console.log("Selected Listing ID:", selectedListing?.id);

    // Restrict rental requests to users with role "Renter" or "Both"
    if (
      !(
        userRole &&
        (userRole.trim().toLowerCase() === "renter" ||
          userRole.trim().toLowerCase() === "both")
      )
    ) {
      Alert.alert("Access Denied", "Only renters can send rental requests.");
      return;
    }

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
      console.error(
        `Selected listing ID: ${selectedListing.id} is missing 'ownerId'.`
      );
      return;
    }
    if (!rentalDate) {
      Alert.alert("Input Required", "Please select a rental date.");
      return;
    }
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
    const rentalCost = parseFloat(selectedListing.costPerHour) * rentalHours;
    if (isNaN(rentalCost) || rentalCost <= 0) {
      Alert.alert("Pricing Error", "Invalid rental cost calculated.");
      return;
    }
    const ownerPayout = rentalCost * 0.94;
    let rentalRequestData = {};
    try {
      const renterFullName = fullName.trim();

      // Update the renter's document in Firestore with both full name and current location
      await setDoc(
        doc(db, "renters", user.uid),
        {
          fullName: renterFullName,
          currentLocation: cityStateCombined
        },
        { merge: true }
      );

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
      console.log("Rental Request Data:", rentalRequestData);
      if (!rentalRequestData.listingId) {
        throw new Error("Listing ID is missing in the rental request data.");
      }
      const rentalRequestsRef = collection(db, "rentalRequests");
      const rentalRequestDoc = await addDoc(rentalRequestsRef, rentalRequestData);
      const rentalRequestId = rentalRequestDoc.id;
      await setDoc(rentalRequestDoc, { id: rentalRequestId }, { merge: true });
      console.log(
        `Created rental request ${rentalRequestId} for listing ${selectedListing.id} with ownerId ${selectedListing.ownerId}`
      );
      Alert.alert(
        "Success",
        "Rental request created successfully. You will be notified once the owner reviews your request."
      );
      setFullScreenModalVisible(false);
      setFullName(fullName.trim());
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

  // Updated headerHeight interpolation: Reduced by 25% from 180 to 135
  const headerHeight = scrollY.interpolate({
    inputRange: [0, 150],
    outputRange: [135, 0],
    extrapolate: "clamp",
  });

  const headerOpacity = scrollY.interpolate({
    inputRange: [0, 150],
    outputRange: [1, 0],
    extrapolate: "clamp",
  });

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

  const handleImagePress = (uri) => {
    setZoomImageUri(uri);
    setZoomModalVisible(true);
  };

  // NEW: Use a separate animated value for the modal carousel
  const modalScrollX = useRef(new Animated.Value(0)).current;

  const renderItem = ({ item }) => {
    const airplaneModelDisplay = item.airplaneModel || "Unknown Model";
    const makeDisplay = item.make || "Unknown Make";
    const yearDisplay = item.year || "Unknown Year";
  
    return (
      <View style={{ flex: 1, alignItems: "center", marginVertical: 8 }}>
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
          <View style={styles.newListingImageContainer}>
            {item.images && item.images.length > 0 ? (
              <ImageBackground
                source={{ uri: item.images[0] }}
                style={styles.newListingImageBackground}
                imageStyle={{ borderTopLeftRadius: 12, borderTopRightRadius: 12 }}
              >
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
  
          <View style={styles.newListingInfoContainer}>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
              <Text style={styles.newListingTitle} numberOfLines={1}>
                {`${yearDisplay} ${makeDisplay}`}
              </Text>
              <TouchableOpacity onPress={() => handleFavorite(item)} accessibilityLabel="Favorite listing">
                <Ionicons
                  name={favorites.includes(item.id) ? "heart" : "heart-outline"}
                  size={24}
                  color="#FF0000"
                />
              </TouchableOpacity>
            </View>
  
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
  
        {/* centered flag button below the card */}
        {user && item.ownerId !== user.uid && (
          <TouchableOpacity
            onPress={() => handleReportListing(item)}
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              marginTop: 6,
            }}
            accessibilityLabel="Report listing"
            accessibilityRole="button"
          >
            <Text style={{ color: "#EF4444", fontSize: 12, marginRight: 4 }}>
              Report the post above
            </Text>
            <Ionicons name="flag-outline" size={16} color="#EF4444" />
          </TouchableOpacity>
        )}
      </View>
    );
  };  

  const renderListHeader = () => (
    <>
      <Text style={styles.availableAircraftHeader}>Aircraft Rental Marketplace</Text>
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
          {/* Header content removed for Home.js; saved for later use in owner.js and renter.js */}
        </ImageBackground>
      </Animated.View>

      {/* Main container without additional top border radii */}
      <View style={styles.mainContainer}>
        <FlatList
          data={listings}
          renderItem={renderItem}
          keyExtractor={(item) => item.id}
          numColumns={2}
          columnWrapperStyle={styles.columnWrapper}
          contentContainerStyle={{ paddingTop: 135 }}
          ListHeaderComponent={renderListHeader}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={<Text style={styles.emptyListText}>No listings available</Text>}
          onScroll={Animated.event(
            [{ nativeEvent: { contentOffset: { y: scrollY } } }],
            { useNativeDriver: false, listener: handleScroll }
          )}
          ref={scrollViewRef}
        />
      </View>
        {showScrollToTop && (
        <TouchableOpacity
          style={[styles.scrollToTopButton, { width: 48, height: 48, borderRadius: 24 }]}
          onPress={handleScrollToTop}
          accessibilityLabel="Scroll to top"
          accessibilityRole="button"
        >
          <Ionicons name="arrow-up" size={20} color="white" />
        </TouchableOpacity>
      )}

      {/* Full Screen Listing Modal */}
      <Modal
  animationType="slide"
  transparent={true}
  visible={fullScreenModalVisible}
  onRequestClose={() => setFullScreenModalVisible(false)}
>
  <SafeAreaView style={styles.modalSafeArea}>
    {selectedListing && selectedListing.images && (
      <ScrollView contentContainerStyle={styles.modalContentContainer} showsVerticalScrollIndicator={false}>
        <TouchableOpacity
          onPress={() => setFullScreenModalVisible(false)}
          style={styles.modalCloseButton}
          accessibilityLabel="Close modal"
          accessibilityRole="button"
        >
          <Ionicons name="close" size={30} color="#FFFFFF" />
        </TouchableOpacity>
        
        {/* Carousel Section */}
        <View style={styles.carouselWrapper}>
          <Animated.ScrollView
            horizontal
            pagingEnabled
            snapToInterval={SCREEN_WIDTH}
            decelerationRate="fast"
            showsHorizontalScrollIndicator={false}
            onScroll={Animated.event(
              [{ nativeEvent: { contentOffset: { x: modalScrollX } } }],
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
              <View key={index} style={{ width: SCREEN_WIDTH, justifyContent: "center", alignItems: "center" }}>
                <TouchableOpacity activeOpacity={0.9} onPress={() => handleImagePress(image)}>
                  <View style={styles.carouselImageContainer}>
                    <Image source={{ uri: image }} style={styles.modalImage} resizeMode="cover" />
                    <LinearGradient colors={["transparent", "rgba(0,0,0,0.7)"]} style={styles.gradientOverlay} />
                  </View>
                </TouchableOpacity>
              </View>
            ))}
          </Animated.ScrollView>
          {renderPaginationDots()}
        </View>
        
        {/* Text Content Section */}
        <View style={styles.modalTextContent}>
          <Text style={styles.modalTitle}>
            {`${selectedListing.year} ${selectedListing.make} ${selectedListing.airplaneModel}`}
          </Text>
          <Text style={styles.modalRate}>
            ${parseFloat(selectedListing.costPerHour).toFixed(2)} per hour
          </Text>
          <Text style={styles.modalLocation}>Location: {selectedListing.location}</Text>
          <Text style={styles.modalDescription}>{selectedListing.description}</Text>
          {selectedListing.ownerId === user.uid && (userRole === "Owner" || userRole === "Both") && (
            <View style={styles.modalOwnerActions}>
              {/* Owner actions can remain here */}
            </View>
          )}
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Full Name</Text>
            <TextInput
              value={fullName}
              onChangeText={setFullName}
              placeholder="Enter your full name"
              placeholderTextColor="#FFFFFF"
              style={[styles.textInput, { color: "#FFFFFF" }]}
              accessibilityLabel="Full name input"
            />
          </View>
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Current City & State</Text>
            <TextInput
              value={cityStateCombined}
              onChangeText={setCityStateCombined}
              placeholder="e.g., New York, NY"
              placeholderTextColor="#FFFFFF"
              style={[styles.textInput, { color: "#FFFFFF" }]}
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
              placeholderTextColor="#FFFFFF"
              keyboardType="numeric"
              style={[styles.textInputSmall, { color: "#FFFFFF" }]}
              accessibilityLabel="Flight hours input"
            />
          </View>
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Rental Hours</Text>
            <TextInput
              value={String(rentalHours)}
              placeholderTextColor="#FFFFFF"
              onChangeText={(text) => {
                const num = Number(text);
                if (!isNaN(num) && num >= 0) {
                  setRentalHours(num);
                } else {
                  Alert.alert("Invalid Input", "Please enter a valid number of rental hours.");
                }
              }}
              keyboardType="numeric"
              style={[styles.textInputSmall, { color: "#FFFFFF" }]}
              accessibilityLabel="Rental hours input"
            />
          </View>
          <TouchableOpacity
            onPress={() => setCalendarModalVisible(true)}
            style={styles.calendarButton}
            accessibilityLabel="Select rental date"
            accessibilityRole="button"
          >
            <Text style={styles.calendarButtonText}>Select Rental Date</Text>
          </TouchableOpacity>
          {rentalDate && (
            <Text style={styles.selectedDateText}>Selected Rental Date: {rentalDate}</Text>
          )}
          <View style={styles.totalCostContainer}>
            <Text style={styles.totalCostTitle}>Total Cost</Text>
            <Text>Rental Cost: ${totalCost.rentalCost}</Text>
            <Text>Booking Fee: ${totalCost.bookingFee}</Text>
            <Text>Transaction Fee: ${totalCost.transactionFee}</Text>
            <Text>Sales Tax: ${totalCost.salesTax}</Text>
            <Text style={styles.totalCostValue}>Total: ${totalCost.total}</Text>
          </View>
          <TouchableOpacity
            onPress={handleSendRentalRequest}
            style={styles.sendRequestButton}
            accessibilityLabel="Send rental request"
            accessibilityRole="button"
          >
            <Text style={styles.sendRequestButtonText}>Send Rental Request</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
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
            <Ionicons name="close" size={30} color="#FFFFFF" />
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
              <Image source={{ uri: zoomImageUri }} style={styles.zoomImage} resizeMode="contain" />
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
                      [rentalDate]: { selected: true, marked: true, dotColor: "red" },
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
              <Text style={styles.closeCalendarButtonText}>Close Calendar</Text>
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
            <View style={styles.inputGroup}>
              <TextInput
                value={cityState}
                onChangeText={setCityState}
                placeholder="Enter city, state e.g., Austin, TX"
                placeholderTextColor="#718096"
                style={styles.textInput}
                accessibilityLabel="Enter location"
              />
            </View>
            <View style={styles.orSeparator}>
              <View style={styles.line} />
              <Text style={styles.orText}>OR</Text>
              <View style={styles.line} />
            </View>
            <Text style={styles.filterLabel}>Aircraft Make & Model</Text>
            <View style={styles.inputGroup}>
              <TextInput
                value={makeModel}
                onChangeText={setMakeModel}
                placeholder="Enter aircraft make/model"
                placeholderTextColor="#718096"
                style={styles.textInput}
                accessibilityLabel="Enter aircraft make and model"
              />
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

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#F7FAFC",
  },
  // HEADER STYLES - the header now has bottom left/right curves
  header: {
    position: "absolute",
    top: 0,
    width: "100%",
    zIndex: 1,
    // borderBottomLeftRadius: 20,
    // borderBottomRightRadius: 20,
    overflow: "hidden",
  },
  headerImage: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  headerContentRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
  },
  welcomeText: {
    fontSize: 18,
    color: "#FFFFFF",
  },
  userName: {
    fontWeight: "700",
    color: "#FFFFFF",
    marginTop: 4,
  },
  imageUploadContainer: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "#FFFFFF",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 16,
    overflow: "hidden",
  },
  uploadedImage: {
    width: 60,
    height: 60,
    borderRadius: 30,
  },
  // Main container below header without border radii
  mainContainer: {
    flex: 1,
    backgroundColor: "#F7FAFC",
  },
  newListingCardWrapper: {
    flex: 1,
    margin: 6,
    maxWidth: (SCREEN_WIDTH - 24) / 2,
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
    height: 100,
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
  // Full screen modal styles
  modalSafeArea: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.9)",
  },
  // New vertical container wrapping modal content (carousel + text)
  modalContentContainer: {
    padding: 16,
  },
  modalContainer: {
    flex: 1,
    position: "relative",
  },
  modalCloseButton: {
    alignSelf: "flex-end",
    marginBottom: 10,
  },
  // Carousel wrapper for spacing below the carousel
  carouselWrapper: {
    marginBottom: 16,
  },
  // Updated carousel scroll view now spans the full screen width and increased height
  carouselScrollView: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT * 0.25,  // Increased height to cover more of the modal
    borderRadius: 12,
    overflow: "hidden",
    marginBottom: 8,
  },
  // Updated carousel image container to use the full width
  carouselImageContainer: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT * 0.25,
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
  // Container for text content below the carousel
  modalTextContent: {
    paddingVertical: 16,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: "700",
    marginBottom: 8,
    color: "#FFFFFF",
  },
  modalRate: {
    fontSize: 18,
    color: "#FFFFFF",
    marginBottom: 8,
  },
  modalLocation: {
    fontSize: 16,
    marginBottom: 8,
    color: "#FFFFFF",
  },
  modalDescription: {
    fontSize: 16,
    color: "#FFFFFF",
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
    color: "#FFFFFF",
  },
  textInput: {
    borderWidth: 1,
    borderColor: "#A0AEC0",
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: "#000",
  },
  textInputSmall: {
    borderWidth: 1,
    borderColor: "#A0AEC0",
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: "#FFFFFF",
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
  // New styles for pagination dots
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
    backgroundColor: "#FFFFFF",
  },
  inactiveDot: {
    backgroundColor: "#888",
  },
  reportButton: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 4,
    justifyContent: "flex-end",
  },
  reportButtonText: {
    color: "#EF4444",
    fontSize: 16,
    marginRight: 4,
  },  
});
export default Home;

