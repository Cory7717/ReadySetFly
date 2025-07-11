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
  KeyboardAvoidingView,
  ActivityIndicator,
  Platform,
  Dimensions,
  Linking,
  StyleSheet,
  Switch,
} from "react-native";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import { createStackNavigator } from "@react-navigation/stack";
import { NavigationContainer, useNavigation } from "@react-navigation/native";
import { db, storage } from "../../firebaseConfig";
import {
  collection,
  onSnapshot,
  orderBy,
  query,
  where,
  limit,
  startAfter,
  getDocs,
  doc,
  updateDoc,
  increment,
} from "firebase/firestore";
import * as Location from "expo-location";
import { Ionicons } from "@expo/vector-icons";
import wingtipClouds from "../../Assets/images/wingtip_clouds.jpg";
import * as ImagePicker from "expo-image-picker";
import { Formik, FieldArray } from "formik";
import {
  getDownloadURL,
  ref as storageRef,
  uploadBytes,
} from "firebase/storage";
import classifiedsPaymentScreen from "../payment/classifiedsPaymentScreen";
import { PinchGestureHandler, State } from "react-native-gesture-handler";

// make FlatList animatable
const AnimatedFlatList = Animated.createAnimatedComponent(FlatList);

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

const COLORS = {
  primary: "#1D4ED8",
  secondary: "#6B7280",
  background: "#F3F4F6",
  white: "#FFFFFF",
  black: "#000000",
  gray: "#9CA3AF",
  lightGray: "#D1D5DB",
  red: "#EF4444",
  green: "#10B981",
};

const Stack = createStackNavigator();
const API_URL =
  "https://us-central1-ready-set-fly-71506.cloudfunctions.net/api";

/** Helper function: Formats a phone number to (XXX)XXX-XXXX if exactly 10 digits */
const formatPhoneNumber = (phone) => {
  if (!phone) return "N/A";
  const cleaned = ("" + phone).replace(/\D/g, "");
  if (cleaned.length === 10) {
    const part1 = cleaned.slice(0, 3);
    const part2 = cleaned.slice(3, 6);
    const part3 = cleaned.slice(6);
    return `(${part1})${part2}-${part3}`;
  }
  return phone;
};

/** Helper function: Returns maximum images allowed based on category and pricing */
const getMaxImages = (selectedCategory, selectedPricing) => {
  if (selectedCategory === "Aviation Jobs") return 3;
  if (selectedCategory === "Flight Schools") return 5;
  if (selectedCategory === "Aircraft for Sale") {
    if (selectedPricing === "Basic") return 7;
    if (selectedPricing === "Featured") return 14;
    return 20;
  }
  if (selectedCategory === "Charter Services") return 10;
  return 1;
};

/** Helper function: Renders full listing details UI based on category */
/** Helper function: Renders full listing details UI based on category */
const renderListingDetails = (item) => {
  if (item.category === "Aviation Jobs") {
    return (
      <View
        style={{
          padding: 10,
          borderRadius: 10,
          backgroundColor: COLORS.white,
          marginBottom: 20,
        }}
      >
        <Text
          style={{
            fontSize: 18,
            fontWeight: "bold",
            color: COLORS.black,
            marginBottom: 5,
          }}
        >
          {item.jobTitle || "No Job Title"}
        </Text>
        <Text
          style={{ fontSize: 16, color: COLORS.secondary, marginBottom: 5 }}
        >
          {item.companyName || "No Company Name"}
        </Text>
        <Text style={{ fontSize: 14, color: COLORS.gray }}>
          {item.city || "No City"}, {item.state || "No State"}
        </Text>
      </View>
    );
  } else if (item.category === "Flight Schools") {
    const details = item.flightSchoolDetails || {};
    return (
      <View
        style={{
          padding: 10,
          borderRadius: 10,
          backgroundColor: COLORS.white,
          marginBottom: 10,
        }}
      >
        <Text style={{ fontSize: 18, fontWeight: "bold", color: COLORS.black }}>
          {details.flightSchoolName || "No Flight School Name"}
        </Text>
        <Text style={{ fontSize: 16, color: COLORS.gray, marginVertical: 5 }}>
          {details.flightSchoolLocation || "No Location Provided"}
        </Text>
        <Text style={{ fontSize: 14, color: COLORS.gray }}>
          {details.flightSchoolDescription || "No Description Provided"}
        </Text>
      </View>
    );
  } else if (item.category === "Flight Instructors") {
    return (
      <View
        style={{
          padding: 10,
          borderRadius: 10,
          backgroundColor: "transparent",
          marginBottom: 10,
        }}
      >
        <Text
          style={{
            fontSize: 18,
            fontWeight: "bold",
            color: COLORS.white,
            marginBottom: 5,
          }}
        >
          {item.firstName} {item.lastName}
        </Text>
        <Text style={{ fontSize: 16, color: COLORS.white, marginBottom: 5 }}>
          CFI Certification Number: {item.certifications || "N/A"}
        </Text>
        <Text style={{ fontSize: 16, color: COLORS.white, marginBottom: 5 }}>
          Flight Hours: {item.flightHours ? item.flightHours : "N/A"}
        </Text>
        <Text style={{ fontSize: 16, color: COLORS.white, marginBottom: 5 }}>
          Hourly Rate: ${item.hourlyRate != null ? item.hourlyRate : "N/A"}
        </Text>
        <Text style={{ fontSize: 16, color: COLORS.white, marginBottom: 5 }}>
          Aircraft Provided: {item.aircraftProvided ? "Yes" : "No"}
        </Text>
        <Text style={{ fontSize: 16, color: COLORS.white, marginBottom: 5 }}>
          Contact Email: {item.fiEmail || "N/A"}
        </Text>
        <Text style={{ fontSize: 16, color: COLORS.white, marginBottom: 5 }}>
          Phone: {item.fiPhone ? formatPhoneNumber(item.fiPhone) : "N/A"}
        </Text>
        <Text style={{ fontSize: 14, color: COLORS.gray }}>
          {item.fiDescription || ""}
        </Text>
        {item.serviceLocationsList && item.serviceLocationsList.length > 0 && (
          <View style={{ marginTop: 8 }}>
            <Text style={{ fontSize: 16, color: COLORS.white }}>
              Service Locations:
            </Text>
            {item.serviceLocationsList.map((loc, index) => (
              <Text key={index} style={{ fontSize: 14, color: COLORS.gray }}>
                {loc}
              </Text>
            ))}
          </View>
        )}
      </View>
    );
  } else if (item.category === "Aviation Mechanic") {
    return (
      <View
        style={{
          padding: 10,
          borderRadius: 10,
          backgroundColor: COLORS.white,
          marginBottom: 10,
        }}
      >
        <Text style={{ fontSize: 18, fontWeight: "bold", color: COLORS.black }}>
          {item.amFirstName} {item.amLastName}
        </Text>
        <Text style={{ fontSize: 16, color: COLORS.gray, marginVertical: 5 }}>
          Certifications: {item.amCertifications || "N/A"}
        </Text>
        <Text style={{ fontSize: 16, color: COLORS.gray, marginVertical: 5 }}>
          Email: {item.amEmail || "N/A"}
        </Text>
        <Text style={{ fontSize: 16, color: COLORS.gray, marginVertical: 5 }}>
          Phone: {item.amPhone ? formatPhoneNumber(item.amPhone) : "N/A"}
        </Text>
        <Text style={{ fontSize: 14, color: COLORS.gray, marginBottom: 5 }}>
          {item.amDescription || "No description provided."}
        </Text>
        <Text style={{ fontSize: 14, color: COLORS.gray }}>
          Service Locations: {item.amServiceLocations || "N/A"}
        </Text>
      </View>
    );
  } else if (item.category === "Charter Services") {
    const details = item.charterServiceDetails || {};
    return (
      <View
        style={{
          padding: 10,
          borderRadius: 10,
          backgroundColor: COLORS.white,
          marginBottom: 10,
        }}
      >
        <Text style={{ fontSize: 18, fontWeight: "bold", color: COLORS.black }}>
          {details.charterServiceName || "No Charter Service Name"}
        </Text>
        <Text style={{ fontSize: 16, color: COLORS.gray, marginVertical: 5 }}>
          {details.charterServiceLocation || "No Location Provided"}
        </Text>
        {details.charterServiceAreas && (
          <Text style={{ fontSize: 14, color: COLORS.gray, marginBottom: 5 }}>
            Service Areas: {details.charterServiceAreas}
          </Text>
        )}
        <Text style={{ fontSize: 14, color: COLORS.gray }}>
          {details.charterServiceDescription || "No Description Provided"}
        </Text>
      </View>
    );
  } else {
    return (
      <View
        style={{
          padding: 10,
          borderRadius: 10,
          backgroundColor: COLORS.white,
          marginBottom: 10,
        }}
      >
        <Text style={{ fontSize: 16, color: COLORS.black, marginBottom: 5 }}>
          Airport Identifier: {item.airportIdentifier || "N/A"}
        </Text>
        <Text style={{ fontSize: 16, color: COLORS.black, marginBottom: 5 }}>
          Tail Number: {item.tailNumber || "N/A"}
        </Text>
        <Text style={{ fontSize: 16, color: COLORS.black, marginBottom: 5 }}>
          Email: {item.email || "N/A"}
        </Text>
        <Text style={{ fontSize: 16, color: COLORS.black, marginBottom: 5 }}>
          Phone: {formatPhoneNumber(item.phone)}
        </Text>
      </View>
    );
  }
};

// New helper for Aviation Jobs images – modeled after the Aircraft for Sale version:
const renderJobListingImages = (item, imagePressHandler) => {
  const imageHeight = 180; // Specific height for Aviation Jobs images
  return (
    <FlatList
      data={item.images || []}
      horizontal
      pagingEnabled // Enables full-page swipes
      bounces={false} // Disable overscroll bounce
      showsHorizontalScrollIndicator={false}
      keyExtractor={(uri, index) => `${item.id}-${index}`}
      renderItem={({ item: uri }) => (
        <TouchableOpacity onPress={() => imagePressHandler(uri)}>
          <Image
            source={{ uri }}
            style={{
              width: SCREEN_WIDTH - 32,
              height: imageHeight,
              borderRadius: 10,
              marginRight: 10,
            }}
            resizeMode="contain"
          />
        </TouchableOpacity>
      )}
    />
  );
};

/** New helper: Renders an abbreviated version for Flight Instructors on the main card */
const renderListingDetailsAbbreviated = (item) => {
  if (item.category === "Flight Instructors") {
    return (
      <View style={{ paddingVertical: 5 }}>
        <Text style={{ fontSize: 14, color: COLORS.gray }}>
          CFI #{item.certifications || "N/A"} – Tap for details
        </Text>
      </View>
    );
  }
  return renderListingDetails(item);
};

/** FullScreenImageModal Component */
const FullScreenImageModal = ({ visible, onRequestClose, imageUri }) => {
  const pinchScale = useRef(new Animated.Value(1)).current;
  const onPinchGestureEvent = Animated.event(
    [{ nativeEvent: { scale: pinchScale } }],
    { useNativeDriver: true }
  );
  const onPinchHandlerStateChange = (event) => {
    if (event.nativeEvent.state === State.END) {
      Animated.spring(pinchScale, {
        toValue: 1,
        useNativeDriver: true,
      }).start();
    }
  };

  return (
    <Modal
      animationType="fade"
      transparent={true}
      visible={visible}
      onRequestClose={onRequestClose}
    >
      <View style={styles.zoomModalContainer}>
        <TouchableOpacity
          onPress={onRequestClose}
          style={styles.zoomCloseButton}
          accessibilityLabel="Close zoomed image"
          accessibilityRole="button"
        >
          <Ionicons name="close" size={30} color={COLORS.white} />
        </TouchableOpacity>
        <PinchGestureHandler
          onGestureEvent={onPinchGestureEvent}
          onHandlerStateChange={onPinchHandlerStateChange}
        >
          <Animated.View
            style={[
              styles.zoomScrollView,
              { transform: [{ scale: pinchScale }] },
            ]}
          >
            {imageUri && (
              <Image
                source={{ uri: imageUri }}
                style={styles.zoomImage}
                resizeMode="contain"
              />
            )}
          </Animated.View>
        </PinchGestureHandler>
      </View>
    </Modal>
  );
};

/**
 * renderListingImages: Renders listing images.
 */
const renderListingImages = (
  item,
  isMainCard = false,
  imagePressHandler,
  onScrollEnd
) => {
  // Adjust height: reduce for Aviation Jobs
  const imageHeight = item.category === "Aviation Jobs" ? 180 : 200;
  // Calculate full item width including marginRight (10)
  const itemWidth = SCREEN_WIDTH - 32 + 10;
  return (
    <View style={{ position: "relative" }}>
      <FlatList
        data={item.images || []}
        horizontal
        // Remove pagingEnabled
        decelerationRate="fast"
        snapToInterval={itemWidth} // Ensure each snap matches the image item width
        snapToAlignment="start"
        disableIntervalMomentum={true}
        bounces={false} // Disable bounce to prevent slight extra scrolling
        showsHorizontalScrollIndicator={false}
        keyExtractor={(imageUri, index) => `${item.id}-${index}`}
        onMomentumScrollEnd={(event) => {
          const index = Math.round(
            event.nativeEvent.contentOffset.x / itemWidth
          );
          if (typeof onScrollEnd === "function") {
            onScrollEnd(index);
          }
        }}
        renderItem={({ item: imageUri }) =>
          isMainCard ? (
            <Image
              source={{ uri: imageUri }}
              style={{
                width: SCREEN_WIDTH - 32,
                height: imageHeight,
                borderRadius: 10,
                marginBottom: 10,
                marginRight: 10,
              }}
            />
          ) : (
            <TouchableOpacity onPress={() => imagePressHandler(imageUri)}>
              <Image
                source={{ uri: imageUri }}
                style={{
                  width: SCREEN_WIDTH - 32,
                  height: imageHeight,
                  borderRadius: 10,
                  marginBottom: 10,
                  marginRight: 10,
                }}
              />
            </TouchableOpacity>
          )
        }
      />
      {item.category === "Aircraft for Sale" && (
        <View style={styles.priceLocationOverlay}>
          <Text style={styles.priceText}>
            Price: $
            {item.salePrice != null
              ? Number(item.salePrice).toLocaleString()
              : "N/A"}
          </Text>
          <View style={styles.locationContainer}>
            <Ionicons name="location-outline" size={20} color={COLORS.white} />
            <Text style={styles.locationText}>
              {item.city ? item.city : "N/A"}, {item.state ? item.state : "N/A"}
            </Text>
          </View>
        </View>
      )}
    </View>
  );
};

const Classifieds = () => {
  const auth = getAuth();
  const navigation = useNavigation();
  const [user, setUser] = useState(null);
  const [loadingAuth, setLoadingAuth] = useState(true);
  const [listings, setListings] = useState([]);
  const [filteredListings, setFilteredListings] = useState([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [filterModalVisible, setFilterModalVisible] = useState(false);
  const [detailsModalVisible, setDetailsModalVisible] = useState(false);
  const [jobDetailsModalVisible, setJobDetailsModalVisible] = useState(false);
  const [images, setImages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedPricing, setSelectedPricing] = useState("Basic");
  const [selectedListing, setSelectedListing] = useState(null);
  const [editingListing, setEditingListing] = useState(null);
  const [imageIndex, setImageIndex] = useState(0);
  const [fullScreenModalVisible, setFullScreenModalVisible] = useState(false);
  const [zoomImageUri, setZoomImageUri] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState("Aircraft for Sale");
  const [location, setLocation] = useState(null);
  const [locationLoading, setLocationLoading] = useState(true);
  const scaleValue = useRef(new Animated.Value(0)).current;
  const scrollY = useRef(new Animated.Value(0)).current;
  const scrollX = useRef(new Animated.Value(0)).current;
  const scrollViewRef = useRef(null);
  const [showUpButton, setShowUpButton] = useState(false);
  const [supportModalVisible, setSupportModalVisible] = useState(false);

  // Pagination & refresh
  const [pageSize] = useState(20);
  const [lastVisible, setLastVisible] = useState(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  // New state for preview listing modal
  const [previewModalVisible, setPreviewModalVisible] = useState(false);
  const [previewData, setPreviewData] = useState(null);

  // New filter state and text inputs for filtering
  const [filter, setFilter] = useState({ location: "", make: "" });
  const [cityState, setCityState] = useState("");
  const [makeModel, setMakeModel] = useState("");

  // Pricing packages state (restored)
  const [pricingPackages, setPricingPackages] = useState({
    Basic: 25,
    Featured: 70,
    Enhanced: 150,
  });
  const [pricingModalVisible, setPricingModalVisible] = useState({
    Basic: false,
    Featured: false,
    Enhanced: false,
    "Flight Instructors": false,
    "Aviation Mechanic": false,
    "Charter Services": false,
  });

  // NEW: State for Broker Services Modal
  const [brokerModalVisible, setBrokerModalVisible] = useState(false);

  // NEW: State for Flight Instructor Profile Image
  const [profileImage, setProfileImage] = useState("");

  // NEW: State for "View your listings" modal and user listings
  const [viewListingsModalVisible, setViewListingsModalVisible] =
    useState(false);
  const [userListings, setUserListings] = useState([]);
  // const isBlocked = item.expired || item.status === "trial_expired";

  const extendListing = async (listingId, paymentMethodId) => {
    const token = await getFirebaseIdToken();
    try {
      const res = await fetch(`${API_URL}/continueListing`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        // replace `/* your PM */` with the variable that actually holds your Stripe PM ID:
        body: JSON.stringify({ listingId, paymentMethodId }),
      });
      if (!res.ok) throw new Error("Payment failed");
      Alert.alert("Success", "Your listing has been extended 30 days.");
    } catch (err) {
      Alert.alert("Error", err.message);
    }
  };

  // Helper function to close all modals
  const closeAllModals = () => {
    setFilterModalVisible(false);
    setJobDetailsModalVisible(false);
    setDetailsModalVisible(false);
    setModalVisible(false);
    setFullScreenModalVisible(false);
    setPricingModalVisible({
      Basic: false,
      Featured: false,
      Enhanced: false,
      "Flight Instructors": false,
      "Aviation Mechanic": false,
      "Charter Services": false,
    });
  };

  // -----------------------
  // Category-specific Pricing Setup
  // -----------------------
  useEffect(() => {
    if (selectedCategory === "Aviation Jobs") {
      setPricingPackages({ Basic: 15 });
      setSelectedPricing("Basic");
    } else if (selectedCategory === "Flight Schools") {
      setPricingPackages({ Basic: 250 });
      setSelectedPricing("Basic");
    } else if (selectedCategory === "Flight Instructors") {
      setPricingPackages({ "Flight Instructors": 30 });
      setSelectedPricing("Flight Instructors");
    } else if (selectedCategory === "Aviation Mechanic") {
      setPricingPackages({ "Aviation Mechanic": 30 });
      setSelectedPricing("Aviation Mechanic");
    } else if (selectedCategory === "Charter Services") {
      setPricingPackages({ "Charter Services": 500 });
      setSelectedPricing("Charter Services");
    } else {
      setPricingPackages({ Basic: 25, Featured: 70, Enhanced: 150 });
      setSelectedPricing("Basic");
    }
  }, [selectedCategory]);

  // -----------------------
  // Authentication & Location
  // -----------------------
  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoadingAuth(false);
    });
    return () => unsubscribeAuth();
  }, [auth]);

  useEffect(() => {
    if (user) {
      const fetchLocation = async () => {
        try {
          let { status } = await Location.requestForegroundPermissionsAsync();
          if (status !== "granted") {
            Alert.alert("Permission denied", "Location access is required.");
            setLocation(null);
            setLocationLoading(false);
            return;
          }
          let currentLocation = await Location.getCurrentPositionAsync({});
          setLocation(currentLocation);
        } catch (error) {
          console.error("Error fetching location: ", error);
          Alert.alert(
            "Error fetching location",
            "Ensure location services are enabled."
          );
          setLocation(null);
        } finally {
          setLocationLoading(false);
        }
      };
      fetchLocation();
    } else {
      setLocation(null);
      setLocationLoading(false);
    }
  }, [user]);

  // -----------------------
  // Firestore Listings Subscription (for main feed)
  // -----------------------
  // useEffect(() => {
  //   if (user) {
  //     const collectionName = "listings";
  //     const q = selectedCategory
  //       ? query(
  //           collection(db, collectionName),
  //           where("category", "==", selectedCategory),
  //           orderBy("createdAt", "desc")
  //         )
  //       : query(collection(db, collectionName), orderBy("createdAt", "desc"));
  //     const unsubscribe = onSnapshot(
  //       q,
  //       (querySnapshot) => {
  //         const listingsData = [];
  //         querySnapshot.forEach((doc) => {
  //           listingsData.push({ id: doc.id, ...doc.data() });
  //         });
  //         setListings(listingsData);
  //       },
  //       (error) => {
  //         console.error("Error fetching listings:", error);
  //         Alert.alert("Error", "Failed to fetch listings.");
  //       }
  //     );
  //     return () => unsubscribe();
  //   } else {
  //     setListings([]);
  //     setFilteredListings([]);
  //   }
  // }, [selectedCategory, user]);

  useEffect(() => {
    if (user) {
      fetchPage(true); // initial load or category change
    } else {
      setListings([]);
      setFilteredListings([]);
    }
  }, [selectedCategory, user]);

  const fetchPage = async (refresh = false) => {
    if (refresh) {
      setIsRefreshing(true);
      setLastVisible(null);
    } else {
      setIsLoadingMore(true);
    }

    // build base query
    let q = query(
      collection(db, "listings"),
      where("category", "==", selectedCategory),
      orderBy("createdAt", "desc"),
      limit(pageSize)
    );

    //The code below will replace the q = query line above once I get everything working.

    // let q = query(
    //   collection(db, "listings"),
    //   where("category", "==", selectedCategory),
    //   where("status", "in", ["active","trial"]),      // ← new
    //   orderBy("createdAt", "desc"),
    //   limit(pageSize)
    // );

    if (!refresh && lastVisible) {
      q = query(q, startAfter(lastVisible));
    }

    try {
      const snap = await getDocs(q);
      const docs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setLastVisible(snap.docs[snap.docs.length - 1] || null);

      if (refresh) setListings(docs);
      else setListings((prev) => [...prev, ...docs]);
    } catch (err) {
      console.error(err);
      Alert.alert("Error fetching listings");
    } finally {
      setIsRefreshing(false);
      setIsLoadingMore(false);
    }
  };

  // -----------------------
  // Subscribe to Current User's Listings (for "View your listings" modal)
  // -----------------------
  useEffect(() => {
    if (user) {
      const q = query(
        collection(db, "listings"),
        where("ownerId", "==", user.uid),
        orderBy("createdAt", "desc")
      );
      const unsubscribe = onSnapshot(
        q,
        (querySnapshot) => {
          const listingsData = [];
          querySnapshot.forEach((doc) => {
            listingsData.push({ id: doc.id, ...doc.data() });
          });
          setUserListings(listingsData);
        },
        (error) => {
          console.error("Error fetching user listings:", error);
        }
      );
      return () => unsubscribe();
    }
  }, [user]);

  // -----------------------
  // Client-side Filtering
  // -----------------------
  // -----------------------
  // Client‑side Filtering
  // -----------------------
  useEffect(() => {
    let updated = [...listings];

    // always filter by location if provided
    if (filter.location) {
      updated = updated.filter((listing) =>
        (listing.city || "").toLowerCase().includes(filter.location)
      );
    }

    // Aircraft for Sale: filter by title
    if (selectedCategory === "Aircraft for Sale" && filter.make) {
      updated = updated.filter((listing) =>
        (listing.title || "").toLowerCase().includes(filter.make)
      );
    }

    // Aviation Jobs: filter by jobTitle OR companyName
    if (selectedCategory === "Aviation Jobs" && filter.make) {
      updated = updated.filter((listing) => {
        const term = filter.make;
        return (
          (listing.jobTitle || "").toLowerCase().includes(term) ||
          (listing.companyName || "").toLowerCase().includes(term)
        );
      });
    }
    if (selectedCategory === "Aviation Mechanic" && filter.make) {
      updated = updated.filter((listing) => {
        const term = filter.make;
        return (
          (listing.amDescription || "").toLowerCase().includes(term) ||
          (listing.amCertifications || "").toLowerCase().includes(term) ||
          (listing.amServiceLocations || "").toLowerCase().includes(term)
        );
      });
    }
    if (selectedCategory === "Charter Services" && filter.make) {
      const term = filter.make;
      updated = updated.filter((listing) => {
        const details = listing.charterServiceDetails || {};
        return (
          (details.charterServiceName || "").toLowerCase().includes(term) ||
          (details.charterServiceDescription || "")
            .toLowerCase()
            .includes(term) ||
          (details.charterServiceAreas || "").toLowerCase().includes(term)
        );
      });
    }

    setFilteredListings(updated);
  }, [filter, listings, selectedCategory]);

  // -----------------------
  // Scroll Listener for Up Button
  // -----------------------
  useEffect(() => {
    const listener = scrollY.addListener(({ value }) => {
      setShowUpButton(value > 200);
    });
    return () => scrollY.removeListener(listener);
  }, [scrollY]);

  // -----------------------
  // Image Picker & Upload for listing images
  // -----------------------
  const pickImage = async () => {
    const maxImages = getMaxImages(selectedCategory, selectedPricing);
    if (images.length >= maxImages) {
      Alert.alert(`You can only upload up to ${maxImages} images.`);
      return;
    }
    const permissionResult =
      await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permissionResult.granted) {
      Alert.alert(
        "Permission Required",
        "Permission to access the camera roll is required!"
      );
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      selectionLimit: maxImages - images.length,
      quality: 1,
    });
    if (!result.canceled && result.assets && result.assets.length > 0) {
      const uploadedImageUrls = [];
      for (const asset of result.assets) {
        const uri = asset.uri;
        try {
          const response = await fetch(uri);
          const blob = await response.blob();
          const imageName = `${new Date().getTime()}-${Math.floor(
            Math.random() * 1000
          )}.jpg`;
          const storageReference = storageRef(
            storage,
            `listingImages/${imageName}`
          );
          await uploadBytes(storageReference, blob);
          const downloadUrl = await getDownloadURL(storageReference);
          uploadedImageUrls.push(downloadUrl);
        } catch (error) {
          console.error("Error uploading image:", error);
          Alert.alert("Upload Error", "Failed to upload image.");
        }
      }
      setImages([...images, ...uploadedImageUrls].slice(0, maxImages));
    }
  };

  const renderImageUploadButton = () => {
    const maxImages = getMaxImages(selectedCategory, selectedPricing);
    const remainingUploads = maxImages - images.length;
    return (
      <TouchableOpacity
        onPress={pickImage}
        disabled={images.length >= maxImages}
        style={{
          backgroundColor:
            remainingUploads > 0 ? COLORS.primary : COLORS.lightGray,
          paddingVertical: 10,
          paddingHorizontal: 16,
          borderRadius: 8,
          marginTop: 8,
          marginBottom: 16,
        }}
        accessibilityLabel="Upload Images"
        accessibilityRole="button"
      >
        <Text style={{ textAlign: "center", color: COLORS.white }}>
          {images.length >= maxImages
            ? `Maximum ${maxImages} Images Reached`
            : `Add Image (${remainingUploads} remaining)`}
        </Text>
      </TouchableOpacity>
    );
  };

  // -----------------------
  // Profile Image Picker & Upload for Flight Instructors
  // -----------------------
  const pickProfileImage = async (setFieldValue) => {
    const permissionResult =
      await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permissionResult.granted) {
      Alert.alert(
        "Permission Required",
        "Permission to access the camera roll is required!"
      );
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 1,
    });
    if (!result.canceled && result.assets && result.assets.length > 0) {
      const asset = result.assets[0];
      const uri = asset.uri;
      try {
        const response = await fetch(uri);
        const blob = await response.blob();
        const imageName = `profile-${new Date().getTime()}-${Math.floor(
          Math.random() * 1000
        )}.jpg`;
        const storageReference = storageRef(
          storage,
          `profileImages/${imageName}`
        );
        await uploadBytes(storageReference, blob);
        const downloadUrl = await getDownloadURL(storageReference);
        setProfileImage(downloadUrl);
        setFieldValue("profileImage", downloadUrl);
      } catch (error) {
        console.error("Error uploading profile image:", error);
        Alert.alert("Upload Error", "Failed to upload profile image.");
      }
    }
  };

  const deg2rad = (deg) => deg * (Math.PI / 180);
  const getDistanceFromLatLonInMiles = (lat1, lon1, lat2, lng2) => {
    const R = 3958.8;
    const dLat = deg2rad(lat2 - lat1);
    const dLon = deg2rad(lng2 - lon1);
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(deg2rad(lat1)) *
        Math.cos(deg2rad(lat2)) *
        Math.sin(dLon / 2) ** 2;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  const filterListingsByDistance = (radiusMiles) => {
    if (!location) {
      Alert.alert("Error", "Location is not available.");
      return;
    }
    const { latitude: userLat, longitude: userLng } = location.coords;
    const filtered = listings.filter((listing) => {
      if (listing.location && listing.location.lat && listing.location.lng) {
        const { lat, lng } = listing.location;
        const distance = getDistanceFromLatLonInMiles(
          userLat,
          userLng,
          lat,
          lng
        );
        return distance <= radiusMiles;
      }
      return false;
    });
    setFilteredListings(filtered);
  };

  const handleListingPress = async (listing) => {
    closeAllModals();

    // 1) increment Firestore
    try {
      const listingRef = doc(db, "listings", listing.id);
      await updateDoc(listingRef, { views: increment(1) });
    } catch (error) {
      console.error("Error incrementing view count:", error);
    }

    // 2) bump local so UI updates immediately
    setSelectedListing({
      ...listing,
      views: (listing.views || 0) + 1,
    });

    // 3) open the right modal
    if (listing.category === "Aviation Jobs") {
      setJobDetailsModalVisible(true);
    } else {
      setDetailsModalVisible(true);
    }
  };

  const handleEditListing = (listing) => {
    closeAllModals();
    setEditingListing(listing);
    setImages(listing.images || []);
    setSelectedCategory(listing.category);
    if (listing.category === "Flight Instructors") {
      setProfileImage(listing.profileImage || "");
    } else {
      setProfileImage("");
    }
    const currentPricing =
      listing.packageType && pricingPackages[listing.packageType]
        ? listing.packageType
        : "Basic";
    setSelectedPricing(currentPricing);
    setModalVisible(true);
  };

  const getFirebaseIdToken = async () => {
    try {
      const token = await user.getIdToken(true);
      return token;
    } catch (error) {
      console.error("Error fetching Firebase ID token:", error);
      Alert.alert("Authentication Error", "Failed to authenticate user.");
      return "";
    }
  };

  const handleAskQuestion = () => {
    if (!selectedListing) {
      Alert.alert("Error", "No listing selected.");
      return;
    }
    const contactEmail = selectedListing.email;
    if (contactEmail) {
      const subject = encodeURIComponent(
        `Inquiry about ${selectedListing.title || "Your Listing"}`
      );
      const mailUrl = `mailto:${contactEmail}?subject=${subject}`;
      Linking.openURL(mailUrl).catch((error) => {
        console.error("Error opening mail app:", error);
        Alert.alert("Error", "Unable to open mail app.");
      });
    } else {
      Alert.alert("Error", "Contact email not available.");
    }
  };

  // Drop-in replacement for handleReportListing in classifieds.js
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
            const token = await getFirebaseIdToken();
            const res = await fetch(`${API_URL}/reportListing`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`,
              },
              body: JSON.stringify({
                listingId: listing.id,
                reason: "Spam",    // ← required field
                comments: ""       // ← optional
              }),
            });
            if (!res.ok) throw new Error("Report failed");
            const { reportCount, suspended } = await res.json();
            setListings((prev) =>
              prev.map((l) =>
                l.id === listing.id
                  ? { ...l, reportCount, status: suspended ? "suspended" : l.status }
                  : l
              )
            );
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

  // Updated: Removed the old handleContactUs – now the "Information about Broker Services" button will open the broker modal.
  const handleDeleteListing = (listingId) => {
    Alert.alert(
      "Confirm Deletion",
      "Are you sure you want to delete this listing?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => {
            getFirebaseIdToken().then((token) => {
              fetch(`${API_URL}/deleteListing`, {
                method: "DELETE",
                headers: {
                  "Content-Type": "application/json",
                  Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({ listingId }),
              })
                .then((response) => {
                  if (response.ok) {
                    Alert.alert(
                      "Listing Deleted",
                      "Your listing has been deleted successfully."
                    );
                  } else {
                    response.text().then((text) => {
                      try {
                        const data = JSON.parse(text);
                        Alert.alert(
                          "Error",
                          data.error || "Failed to delete listing."
                        );
                      } catch (err) {
                        console.error(
                          "Error parsing deleteListing error data:",
                          err
                        );
                        Alert.alert(
                          "Error",
                          "Failed to delete listing. " + text
                        );
                      }
                    });
                  }
                })
                .catch((error) => {
                  console.error("Error deleting listing:", error);
                  Alert.alert("Error", "Failed to delete listing.");
                });
            });
          },
        },
      ]
    );
  };

  // TEMPORARILY bypass payment for new listings (all categories)
  const onSubmitMethod = (values) => {
    const listingDetails = {
      ...values,
      images,
      location: location
        ? { lat: location.coords.latitude, lng: location.coords.longitude }
        : {},
      city: values.city, // <-- Include city
      state: values.state, // <-- Include state
    };

    listingDetails.selectedPricing = selectedPricing || "Basic";

    // ...after you build `listingDetails` but before fetch:
    if (!editingListing) {
      listingDetails.views = 0;
    }

    if (listingDetails.category === "Flight Instructors") {
      listingDetails.profileImage = profileImage;
      delete listingDetails.salePrice;
    }

    if (listingDetails.category === "Flight Schools") {
      const {
        flightSchoolEmail,
        flightSchoolName,
        flightSchoolLocation,
        flightSchoolPhone,
        flightSchoolDescription,
      } = listingDetails;
      listingDetails.flightSchoolDetails = {
        flightSchoolEmail,
        ...(flightSchoolName ? { flightSchoolName } : {}),
        ...(flightSchoolLocation ? { flightSchoolLocation } : {}),
        ...(flightSchoolPhone ? { flightSchoolPhone } : {}),
        ...(flightSchoolDescription ? { flightSchoolDescription } : {}),
      };
      delete listingDetails.flightSchoolName;
      delete listingDetails.flightSchoolLocation;
      delete listingDetails.flightSchoolEmail;
      delete listingDetails.flightSchoolPhone;
      delete listingDetails.flightSchoolDescription;
      delete listingDetails.salePrice;
    }

    if (listingDetails.category === "Charter Services") {
      const {
        charterServiceEmail,
        charterServiceName,
        charterServiceLocation,
        charterServicePhone,
        charterServiceDescription,
        charterServiceAreas,
      } = listingDetails;
      listingDetails.charterServiceDetails = {
        charterServiceEmail,
        charterServiceName,
        charterServiceLocation,
        charterServicePhone,
        charterServiceDescription,
        charterServiceAreas,
      };
      delete listingDetails.charterServiceName;
      delete listingDetails.charterServiceLocation;
      delete listingDetails.charterServiceEmail;
      delete listingDetails.charterServicePhone;
      delete listingDetails.charterServiceDescription;
      delete listingDetails.charterServiceAreas;
      delete listingDetails.salePrice;
    }

    // NEW: Force free listing for Aviation Jobs
    if (listingDetails.category === "Aviation Jobs") {
      // Mark as free listing (for the first 7 days)
      // RIGHT: explicitly tag this listing as free
      listingDetails.freeListing = true;
      delete listingDetails.salePrice;
    }

    if (editingListing) {
      console.log("Updating listing with payload:", {
        listingId: editingListing.id,
        listingDetails,
      });
      getFirebaseIdToken().then((token) => {
        fetch(`${API_URL}/updateListing`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            listingId: editingListing.id,
            listingDetails,
          }),
        })
          .then((response) => {
            if (response.ok) {
              Alert.alert(
                "Listing Updated",
                "Your listing has been updated successfully."
              );
              closeAllModals();
              setEditingListing(null);
              setImages([]);
            } else {
              response.text().then((text) => {
                try {
                  const data = JSON.parse(text);
                  Alert.alert(
                    "Error",
                    data.error || "Failed to update listing."
                  );
                } catch (err) {
                  console.error("Error parsing updateListing error data:", err);
                  Alert.alert("Error", "Failed to update listing. " + text);
                }
              });
            }
          })
          .catch((error) => {
            console.error("Error updating listing:", error);
            Alert.alert("Error", "Failed to update listing.");
          });
      });
    } else if (true /* TEMPORARY_BYPASS_PAYMENT */) {
      console.log("Posting listing automatically for free...");
      getFirebaseIdToken().then((token) => {
        fetch(`${API_URL}/createListing`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ listingDetails }),
        })
          .then((response) => {
            if (response.ok) {
              Alert.alert(
                "Listing Created",
                "Your listing has been posted for free for 7 days!"
              );
              closeAllModals();
              setEditingListing(null);
              setImages([]);
            } else {
              response.text().then((text) => {
                try {
                  const data = JSON.parse(text);
                  Alert.alert(
                    "Error",
                    data.error || "Failed to create listing."
                  );
                } catch (err) {
                  console.error("Error parsing createListing error data:", err);
                  Alert.alert("Error", "Failed to create listing. " + text);
                }
              });
            }
          })
          .catch((error) => {
            console.error("Error creating listing:", error);
            Alert.alert("Error", "Failed to create listing.");
          });
      });
    } else {
      console.log("Navigating to classifiedsPaymentScreen with payload:", {
        listingDetails,
        selectedCategory,
        selectedPricing,
      });
      navigation.navigate("classifiedsPaymentScreen", {
        listingDetails,
        selectedCategory,
        selectedPricing,
      });
    }
  };

  useEffect(() => {
    const unsubscribe = navigation.addListener("focus", () => {
      closeAllModals();
      setEditingListing(null);
      setImages([]);
    });
    return unsubscribe;
  }, [navigation]);

  const handleImagePress = (uri) => {
    closeAllModals();
    setZoomImageUri(uri);
    setFullScreenModalVisible(true);
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
  const headerOpacity = scrollY.interpolate({
    inputRange: [0, 100],
    outputRange: [1, 0],
    extrapolate: "clamp",
  });

  useEffect(() => {
    if (modalVisible) {
      Animated.spring(scaleValue, {
        toValue: 1,
        friction: 5,
        useNativeDriver: true,
      }).start();
    } else {
      scaleValue.setValue(0);
    }
  }, [modalVisible]);

  const clearFilter = () => {
    setCityState("");
    setMakeModel("");
    setFilter({ location: "", make: "" });
  };

  const applyFilter = () => {
    setFilter({
      location: cityState.toLowerCase(),
      make: makeModel.toLowerCase(),
    });
    setFilterModalVisible(false);
  };

  if (loadingAuth || locationLoading) {
    return (
      <SafeAreaView
        style={{
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
          backgroundColor: COLORS.white,
        }}
      >
        <ActivityIndicator
          size="large"
          color={COLORS.primary}
          accessibilityLabel="Loading indicator"
        />
        <Text style={{ marginTop: 10, color: COLORS.black }}>Loading...</Text>
      </SafeAreaView>
    );
  }
  if (!user) {
    return (
      <SafeAreaView
        style={{
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
          backgroundColor: COLORS.white,
          padding: 16,
        }}
      >
        <Text
          style={{
            fontSize: 18,
            color: COLORS.black,
            marginBottom: 20,
            textAlign: "center",
          }}
        >
          You need to be signed in to view classifieds. Please sign in or create
          an account.
        </Text>
      </SafeAreaView>
    );
  }

  const renderEditAndDeleteButtons = (listing) => {
    if (user && listing?.ownerId === user.uid) {
      return (
        <View style={styles.editDeleteContainer}>
          <TouchableOpacity
            style={styles.editButton}
            onPress={() => handleEditListing(listing)}
            accessibilityLabel="Edit Listing"
            accessibilityRole="button"
          >
            <Ionicons name="create-outline" size={20} color={COLORS.white} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.deleteButton}
            onPress={() => handleDeleteListing(listing.id)}
            accessibilityLabel="Delete Listing"
            accessibilityRole="button"
          >
            <Ionicons name="trash-outline" size={20} color={COLORS.white} />
          </TouchableOpacity>
        </View>
      );
    }
    return null;
  };

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

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: COLORS.white }}>
      <Animated.ScrollView
        ref={scrollViewRef}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 16 }}
        scrollEventThrottle={16}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          {
            useNativeDriver: false,
          }
        )}
      >
        <Animated.View
          style={{
            width: SCREEN_WIDTH,
            marginHorizontal: -16,
            overflow: "hidden",
            height: headerHeight,
            opacity: headerOpacity,
            marginBottom: 16,
          }}
        >
          <ImageBackground
            source={wingtipClouds}
            style={{
              width: SCREEN_WIDTH,
              height: "100%",
              justifyContent: "flex-start",
            }}
            resizeMode="cover"
          >
            <Animated.View
              style={{
                paddingHorizontal: 16,
                paddingTop: headerPaddingTop,
                paddingBottom: 20,
              }}
            >
              <Animated.Text
                style={{
                  color: COLORS.white,
                  fontWeight: "bold",
                  fontSize: headerFontSize,
                }}
                accessibilityLabel="Greeting Text"
              >
                Welcome
              </Animated.Text>
              <Animated.Text
                style={{
                  color: COLORS.white,
                  fontWeight: "bold",
                  fontSize: headerFontSize,
                }}
                accessibilityLabel="User Name"
              >
                {user.displayName}
              </Animated.Text>
            </Animated.View>
          </ImageBackground>
        </Animated.View>

        {/* Help & View Listings Row */}
<View
  style={{
    flexDirection: "row",
    justifyContent: "flex-start", // align both buttons on the left
    alignItems: "center",
    marginBottom: 8,
    paddingLeft: 12,               // pull Contact Support in a bit
    paddingRight: 16,              // keep a little right padding
  }}
>
  {/* Contact Support */}
  <TouchableOpacity
    onPress={() => setSupportModalVisible(true)}
    style={{
      flexDirection: "row",
      alignItems: "center",
      marginRight: 32,            // space before "View your listings"
    }}
    accessibilityLabel="Contact Support"
    accessibilityRole="button"
  >
    <Ionicons
      name="help-circle-outline"
      size={24}
      color={COLORS.primary}
    />
    <Text
      style={{
        marginLeft: 6,
        fontSize: 16,
        color: COLORS.primary,
        textDecorationLine: "underline",
      }}
    >
      Contact Support
    </Text>
  </TouchableOpacity>

  {/* View Your Listings */}
  <TouchableOpacity
    onPress={() => setViewListingsModalVisible(true)}
    style={{
      flexDirection: "row",
      alignItems: "center",
    }}
    accessibilityLabel="View your listings"
    accessibilityRole="button"
  >
    <Ionicons
      name="list"
      size={24}
      color={COLORS.primary}
      style={{ marginRight: 8 }}
    />
    <Text
      style={{
        fontSize: 16,
        color: COLORS.primary,
        textDecorationLine: "underline",
      }}
    >
      View your listings
    </Text>
  </TouchableOpacity>
</View>

        <Text
          style={{
            fontSize: 28,
            fontWeight: "bold",
            marginBottom: 16,
            textAlign: "center",
            color: COLORS.black,
          }}
        >
          Aviation Marketplace
        </Text>

        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            marginBottom: 16,
          }}
        >
          <Text style={{ fontSize: 18, color: COLORS.secondary }}>
            Select category to filter listings
          </Text>
          <TouchableOpacity
            onPress={() => {
              closeAllModals();
              setFilterModalVisible(true);
            }}
            style={{
              backgroundColor: COLORS.lightGray,
              padding: 8,
              borderRadius: 50,
            }}
            accessibilityLabel="Open Filter Modal"
            accessibilityRole="button"
          >
            <Ionicons name="filter" size={24} color="gray" />
          </TouchableOpacity>
        </View>

        <FlatList
          data={[
            "Aircraft for Sale",
            "Aviation Jobs",
            "Flight Schools",
            "Flight Instructors",
            "Aviation Mechanic",
            "Charter Services",
          ]}
          renderItem={({ item }) => (
            <TouchableOpacity
              key={item}
              onPress={() => {
                closeAllModals();
                setSelectedCategory(item);
                clearFilter();
              }}
              style={{
                padding: 8,
                borderRadius: 8,
                marginRight: 8,
                backgroundColor:
                  selectedCategory === item ? COLORS.primary : COLORS.lightGray,
              }}
              accessibilityLabel={`Select category ${item}`}
              accessibilityRole="button"
            >
              <Text
                style={{
                  fontSize: 14,
                  fontWeight: "bold",
                  color:
                    selectedCategory === item ? COLORS.white : COLORS.black,
                }}
              >
                {item}
              </Text>
            </TouchableOpacity>
          )}
          horizontal
          keyExtractor={(item) => item}
          showsHorizontalScrollIndicator={false}
          style={{ marginBottom: 16 }}
        />

        <TouchableOpacity
          onPress={() => {
            closeAllModals();
            setModalVisible(true);
            setEditingListing(null);
            setImages([]);
            setProfileImage("");
          }}
          style={{
            backgroundColor: COLORS.primary,
            padding: 12,
            borderRadius: 8,
            marginBottom: 16,
            alignItems: "center",
          }}
          accessibilityLabel="Add a Listing"
          accessibilityRole="button"
        >
          <Text
            style={{ color: COLORS.white, fontSize: 16, fontWeight: "bold" }}
          >
            Add a Listing
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => setBrokerModalVisible(true)}
          style={{
            marginBottom: 16,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
          }}
          accessibilityLabel="Information about Broker Services"
          accessibilityRole="button"
        >
          <Ionicons
            name="mail-outline"
            size={20}
            color={COLORS.primary}
            style={{ marginRight: 8 }}
          />
          <Text
            style={{
              color: COLORS.primary,
              textDecorationLine: "underline",
              fontSize: 16,
            }}
          >
            Information about Broker Services
          </Text>
        </TouchableOpacity>

        {filteredListings.length > 0 ? (
          filteredListings.map((item, index) => {
            const isBlocked = item.expired || item.status === "trial_expired";

            return (
              <React.Fragment key={item.id}>
                <View
                  style={{
                    borderRadius: 10,
                    overflow: "hidden",
                    backgroundColor: COLORS.white,
                    marginBottom: 20,
                    shadowColor: COLORS.black,
                    shadowOffset: { width: 0, height: 2 },
                    shadowOpacity: 0.2,
                    shadowRadius: 2,
                    elevation: 3,
                    opacity: isBlocked ? 0.5 : 1, // half-fade if blocked
                  }}
                >
                  {(item.packageType === "Featured" ||
                    item.packageType === "Enhanced") && (
                    <View style={styles.featuredTag}>
                      <Text style={styles.featuredTagText}>
                        {item.packageType} Listing
                      </Text>
                    </View>
                  )}

                  <TouchableOpacity
                    onPress={() =>
                      isBlocked ? null : handleListingPress(item)
                    }
                    disabled={isBlocked}
                    style={{ flex: 1, padding: 10 }}
                    accessibilityLabel={`View details of listing ${
                      item.category === "Flight Instructors"
                        ? `${item.firstName} ${item.lastName}`
                        : item.title || "Listing"
                    }`}
                    accessibilityRole="button"
                  >
                    {item.category === "Flight Instructors" ? (
                      <View
                        style={{ flexDirection: "row", alignItems: "center" }}
                      >
                        {item.profileImage && (
                          <Image
                            source={{ uri: item.profileImage }}
                            style={{
                              width: 50,
                              height: 50,
                              borderRadius: 25,
                              marginRight: 10,
                            }}
                          />
                        )}
                        <View>
                          <Text
                            style={{
                              fontSize: 18,
                              fontWeight: "bold",
                              color: COLORS.black,
                            }}
                          >
                            {item.firstName} {item.lastName}
                          </Text>
                          <Text style={{ fontSize: 14, color: COLORS.gray }}>
                            CFI #{item.certifications || "N/A"}
                          </Text>
                          {item.serviceLocationsList?.length > 0 && (
                            <View style={{ marginTop: 5 }}>
                              <Text
                                style={{ fontSize: 14, color: COLORS.gray }}
                              >
                                {item.serviceLocationsList.join(", ")}
                              </Text>
                            </View>
                          )}
                          {/* NEW: show views */}
                          <Text
                            style={{
                              fontSize: 12,
                              color: COLORS.gray,
                              marginTop: 4,
                            }}
                          >
                            Views: {item.views || 0}
                          </Text>
                        </View>
                      </View>
                    ) : (
                      <>
                        {item.images?.length > 0 ? (
                          renderListingImages(item, true, null)
                        ) : (
                          <Text
                            style={{
                              textAlign: "center",
                              color: COLORS.gray,
                              marginTop: 10,
                              padding: 10,
                            }}
                          >
                            No Images Available
                          </Text>
                        )}
                        {item.title && (
                          <>
                            <Text
                              style={{
                                fontSize: 18,
                                fontWeight: "bold",
                                color: COLORS.black,
                                marginTop: 10,
                              }}
                            >
                              {item.title}
                            </Text>
                            {/* NEW: show views */}
                            <Text
                              style={{
                                fontSize: 12,
                                color: COLORS.gray,
                                marginTop: 4,
                              }}
                            >
                              Views: {item.views || 0}
                            </Text>
                          </>
                        )}
                        {renderListingDetails(item)}
                      </>
                    )}
                  </TouchableOpacity>

                  <View style={styles.editDeleteContainer}>
                    {user && item.ownerId !== user.uid && (
                      <TouchableOpacity
                        onPress={() => handleReportListing(item)}
                        style={{
                          alignSelf: "flex-end",
                          marginTop: 1,
                          flexDirection: "row",
                          alignItems: "center",
                        }}
                        accessibilityLabel="Report listing"
                        accessibilityRole="button"
                      >
                        <Text
                          style={{
                            color: COLORS.red,
                            fontSize: 14,
                            marginRight: 6,
                          }}
                        >
                          Report Post
                        </Text>
                        <Ionicons
                          name="flag-outline"
                          size={20}
                          color={COLORS.red}
                        />
                      </TouchableOpacity>
                    )}
                    {renderEditAndDeleteButtons(item)}
                  </View>
                </View>

                {(index + 1) % 17 === 0 && (
                  <View>
                    <Text style={{ textAlign: "center", color: COLORS.gray }}>
                      Google Ad Placeholder
                    </Text>
                  </View>
                )}
              </React.Fragment>
            );
          })
        ) : (
          <Text style={{ textAlign: "center", color: COLORS.gray }}>
            No listings available
          </Text>
        )}
      </Animated.ScrollView>

      {showUpButton && (
        <TouchableOpacity
          onPress={() =>
            scrollViewRef.current?.scrollTo({ y: 0, animated: true })
          }
          style={styles.upButton}
          accessibilityLabel="Scroll to top"
          accessibilityRole="button"
        >
          <Ionicons name="arrow-up" size={24} color={COLORS.white} />
        </TouchableOpacity>
      )}

      {/* Broker Services Modal */}
      <Modal
        visible={brokerModalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setBrokerModalVisible(false)}
      >
        <View style={{ flex: 1, backgroundColor: COLORS.white }}>
          <ScrollView
            contentContainerStyle={{
              flexGrow: 1,
              justifyContent: "center",
              alignItems: "center",
              padding: 20,
            }}
          >
            <Text
              style={{
                fontSize: 22,
                fontWeight: "bold",
                marginBottom: 20,
                textAlign: "center",
              }}
            >
              Aircraft Broker Services
            </Text>
            <Text
              style={{
                fontSize: 16,
                textAlign: "center",
                marginBottom: 30,
              }}
            >
              Our Aircraft Broker Services connect buyers and sellers with
              trusted aviation professionals who specialize in aircraft
              acquisitions and sales. Whether you're looking to purchase, sell,
              or trade an aircraft, our experienced brokers provide personalized
              guidance, market analysis, and negotiation support to ensure a
              seamless and secure transaction from start to finish.
            </Text>
            <TouchableOpacity
              onPress={() => {
                setBrokerModalVisible(false);
                const subject = encodeURIComponent(
                  "Information About Broker Services"
                );
                const mailtoUrl = `mailto:sales@readysetfly.us?subject=${subject}`;
                Linking.openURL(mailtoUrl).catch((error) => {
                  console.error("Error opening mail app:", error);
                  Alert.alert("Error", "Unable to open mail app.");
                });
              }}
              style={{
                flexDirection: "row",
                backgroundColor: COLORS.primary,
                padding: 12,
                borderRadius: 10,
                alignItems: "center",
                marginBottom: 20,
              }}
              accessibilityLabel="Email for Broker Services"
              accessibilityRole="button"
            >
              <Ionicons
                name="mail-outline"
                size={20}
                color={COLORS.white}
                style={{ marginRight: 8 }}
              />
              <Text style={{ color: COLORS.white, fontSize: 16 }}>
                Email for Broker Services
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setBrokerModalVisible(false)}
              style={{
                backgroundColor: COLORS.lightGray,
                padding: 12,
                borderRadius: 10,
                alignItems: "center",
              }}
              accessibilityLabel="Close Broker Services Modal"
              accessibilityRole="button"
            >
              <Text style={{ color: COLORS.black, fontSize: 16 }}>Close</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </Modal>

      {/* Updated Aviation Jobs Modal */}
      <Modal
        visible={jobDetailsModalVisible}
        transparent={true}
        onRequestClose={() => setJobDetailsModalVisible(false)}
        animationType="slide"
      >
        <View
          style={{
            flex: 1,
            backgroundColor: "rgba(0,0,0,0.9)",
            justifyContent: "center",
            alignItems: "center",
          }}
        >
          <SafeAreaView
            style={{
              width: "90%",
              backgroundColor: "rgba(0,0,0,0.9)",
              borderRadius: 8,
              padding: 20,
            }}
          >
            <TouchableOpacity
              style={{
                position: "absolute",
                top: 10,
                right: 10,
                zIndex: 999, // Ensure the close button stays on top
              }}
              onPress={() => setJobDetailsModalVisible(false)}
              accessibilityLabel="Close Job Details Modal"
              accessibilityRole="button"
            >
              <Ionicons name="close" size={30} color={COLORS.white} />
            </TouchableOpacity>

            {selectedListing?.images && selectedListing.images.length > 0 && (
              <View style={{ marginBottom: 16 }}>
                {renderJobListingImages(selectedListing, handleImagePress)}
                {selectedListing.images.length > 1 && renderPaginationDots()}
              </View>
            )}

            <Text
              style={{
                fontSize: 24,
                fontWeight: "bold",
                color: COLORS.white,
                marginBottom: 10,
              }}
            >
              {selectedListing?.jobTitle || "No Job Title"}
            </Text>
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 5,
              }}
            >
              <Text style={{ fontSize: 18, color: COLORS.white }}>
                {selectedListing?.companyName || "No Company Name"}
              </Text>
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <Ionicons
                  name="location-outline"
                  size={20}
                  color={COLORS.white}
                />
                <Text
                  style={{
                    fontSize: 16,
                    color: COLORS.white,
                    marginLeft: 5,
                  }}
                >
                  {selectedListing?.city || "No City"},{" "}
                  {selectedListing?.state || "No State"}
                </Text>
              </View>
            </View>
            <Text
              style={{
                fontSize: 16,
                color: COLORS.white,
                marginBottom: 20,
              }}
            >
              {selectedListing?.jobDescription || "No Description Provided"}
            </Text>
            <TouchableOpacity
              style={{
                backgroundColor: COLORS.primary,
                padding: 10,
                borderRadius: 10,
                alignItems: "center",
                marginTop: 20,
              }}
              onPress={handleAskQuestion}
              accessibilityLabel="Apply for Job"
              accessibilityRole="button"
            >
              <Text style={{ color: COLORS.white, fontSize: 16 }}>
                Apply Now
              </Text>
            </TouchableOpacity>
            {renderEditAndDeleteButtons(selectedListing)}
          </SafeAreaView>
        </View>
      </Modal>

      <Modal
        visible={detailsModalVisible}
        transparent={true}
        onRequestClose={() => setDetailsModalVisible(false)}
        animationType="slide"
      >
        <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.9)" }}>
          <SafeAreaView style={{ flex: 1 }}>
            <ScrollView contentContainerStyle={{ padding: 16 }}>
              <TouchableOpacity
                style={{ alignSelf: "flex-end", marginBottom: 10 }}
                onPress={() => setDetailsModalVisible(false)}
                accessibilityLabel="Close Details Modal"
                accessibilityRole="button"
              >
                <Ionicons name="close" size={30} color={COLORS.white} />
              </TouchableOpacity>
              {selectedListing?.category === "Flight Instructors" &&
                selectedListing?.profileImage && (
                  <Image
                    source={{ uri: selectedListing.profileImage }}
                    style={{
                      width: 100,
                      height: 100,
                      borderRadius: 50,
                      alignSelf: "center",
                      marginBottom: 16,
                    }}
                  />
                )}
              {(selectedListing?.category === "Aircraft for Sale" ||
                selectedListing?.category === "Charter Services" ||
                selectedListing?.category === "Flight Schools" ||
                selectedListing?.category === "Aviation Jobs") &&
                selectedListing?.images &&
                selectedListing.images.length > 0 && (
                  <View style={{ marginBottom: 16 }}>
                    {renderListingImages(
                      selectedListing,
                      false,
                      handleImagePress,
                      setImageIndex
                    )}
                    {selectedListing.images.length > 1 &&
                      renderPaginationDots()}
                  </View>
                )}

              <Text
                style={{
                  color: COLORS.white,
                  fontSize: 24,
                  fontWeight: "bold",
                  marginTop: 20,
                  textAlign: "center",
                }}
              >
                {selectedListing?.category === "Flight Schools"
                  ? selectedListing?.flightSchoolDetails?.flightSchoolName ||
                    "No Flight School Name"
                  : selectedListing?.category === "Flight Instructors"
                  ? `${selectedListing?.firstName} ${selectedListing?.lastName}`
                  : selectedListing?.category === "Charter Services"
                  ? selectedListing?.charterServiceDetails
                      ?.charterServiceName || "No Charter Service Name"
                  : selectedListing?.flightSchoolName ||
                    selectedListing?.title ||
                    "No Title"}
              </Text>
              {selectedListing?.category === "Flight Instructors" ? (
                renderListingDetails(selectedListing)
              ) : selectedListing?.category === "Flight Schools" ? (
                <>
                  <View style={styles.centeredRow}>
                    <Ionicons
                      name="location-outline"
                      size={20}
                      color={COLORS.white}
                    />
                    <Text
                      style={{
                        fontSize: 16,
                        color: COLORS.white,
                        marginLeft: 5,
                      }}
                    >
                      {selectedListing?.flightSchoolDetails
                        ?.flightSchoolLocation || "No Location Provided"}
                    </Text>
                  </View>
                  <Text
                    style={{ color: COLORS.white, fontSize: 16, marginTop: 10 }}
                  >
                    Email:{" "}
                    {selectedListing?.flightSchoolDetails?.flightSchoolEmail ||
                      "N/A"}
                  </Text>
                  <Text
                    style={{ color: COLORS.white, fontSize: 16, marginTop: 5 }}
                  >
                    Phone:{" "}
                    {formatPhoneNumber(
                      selectedListing?.flightSchoolDetails?.flightSchoolPhone
                    )}
                  </Text>
                </>
              ) : selectedListing?.category === "Charter Services" ? (
                <>
                  <View style={styles.centeredRow}>
                    <Ionicons
                      name="location-outline"
                      size={20}
                      color={COLORS.white}
                    />
                    <Text
                      style={{
                        fontSize: 16,
                        color: COLORS.white,
                        marginLeft: 5,
                      }}
                    >
                      {selectedListing?.charterServiceDetails
                        ?.charterServiceLocation || "No Location Provided"}
                    </Text>
                  </View>
                  <Text
                    style={{ color: COLORS.white, fontSize: 16, marginTop: 10 }}
                  >
                    Email:{" "}
                    {selectedListing?.charterServiceDetails
                      ?.charterServiceEmail || "N/A"}
                  </Text>
                  <Text
                    style={{ color: COLORS.white, fontSize: 16, marginTop: 5 }}
                  >
                    Phone:{" "}
                    {formatPhoneNumber(
                      selectedListing?.charterServiceDetails
                        ?.charterServicePhone
                    )}
                  </Text>
                  {selectedListing?.charterServiceDetails
                    ?.charterServiceAreas && (
                    <Text
                      style={{
                        color: COLORS.white,
                        fontSize: 16,
                        marginTop: 5,
                      }}
                    >
                      Service Areas:{" "}
                      {
                        selectedListing?.charterServiceDetails
                          ?.charterServiceAreas
                      }
                    </Text>
                  )}
                  <Text
                    style={{ color: COLORS.white, fontSize: 16, marginTop: 5 }}
                  >
                    {selectedListing?.charterServiceDetails
                      ?.charterServiceDescription || "No Description Provided"}
                  </Text>
                </>
              ) : (
                <>
                  <View style={styles.centeredRow}>
                    <Ionicons
                      name="location-outline"
                      size={20}
                      color={COLORS.white}
                    />
                    <Text
                      style={{
                        fontSize: 16,
                        color: COLORS.white,
                        marginLeft: 5,
                      }}
                    >
                      {selectedListing?.city || "No City"},{" "}
                      {selectedListing?.state || "No State"}
                    </Text>
                  </View>
                  <Text
                    style={{ color: COLORS.white, fontSize: 16, marginTop: 10 }}
                  >
                    Email: {selectedListing?.email || "N/A"}
                  </Text>
                  <Text
                    style={{ color: COLORS.white, fontSize: 16, marginTop: 5 }}
                  >
                    Phone: {formatPhoneNumber(selectedListing?.phone)}
                  </Text>
                  <Text
                    style={{ color: COLORS.white, fontSize: 16, marginTop: 5 }}
                  >
                    Tail Number: {selectedListing?.tailNumber || "N/A"}
                  </Text>
                  <Text
                    style={{ color: COLORS.white, fontSize: 16, marginTop: 5 }}
                  >
                    Price: $
                    {selectedListing?.salePrice != null
                      ? Number(selectedListing.salePrice).toLocaleString()
                      : "N/A"}
                  </Text>
                </>
              )}
              {selectedListing?.category !== "Flight Instructors" &&
                selectedListing?.category !== "Charter Services" && (
                  <Text
                    style={{
                      color: COLORS.white,
                      fontSize: 18,
                      marginTop: 20,
                      textAlign: "left",
                      paddingHorizontal: 20,
                    }}
                  >
                    {selectedListing?.category === "Flight Schools"
                      ? selectedListing?.flightSchoolDetails
                          ?.flightSchoolDescription || "No Description Provided"
                      : selectedListing?.flightSchoolDescription ||
                        selectedListing?.description ||
                        "No Description"}
                  </Text>
                )}
              <TouchableOpacity
                style={{
                  marginTop: 20,
                  backgroundColor: COLORS.primary,
                  padding: 10,
                  borderRadius: 10,
                  alignItems: "center",
                }}
                onPress={handleAskQuestion}
                accessibilityLabel="Ask a question"
                accessibilityRole="button"
              >
                <Text style={{ color: COLORS.white, fontSize: 16 }}>
                  Ask a question
                </Text>
              </TouchableOpacity>
              {renderEditAndDeleteButtons(selectedListing)}
            </ScrollView>
          </SafeAreaView>
        </View>
      </Modal>
      {/* Submit Your Listing Modal (continued) */}
      <Modal
        animationType="none"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => {
          closeAllModals();
          setEditingListing(null);
          setImages([]);
        }}
      >
        <View
          style={{
            flex: 1,
            justifyContent: "center",
            alignItems: "center",
            backgroundColor: "rgba(0,0,0,0.5)",
          }}
        >
          <Animated.View
            style={{
              width: "90%",
              maxHeight: "90%",
              backgroundColor: COLORS.white,
              borderRadius: 24,
              padding: 0,
              shadowColor: COLORS.black,
              shadowOffset: { width: 0, height: 5 },
              shadowOpacity: 0.3,
              shadowRadius: 10,
              elevation: 10,
              transform: [{ scale: scaleValue }],
            }}
          >
            <ScrollView
              contentContainerStyle={{ padding: 24 }}
              style={{ width: "100%" }}
              nestedScrollEnabled={true}
            >
              <View style={{ width: "100%" }}>
                <Text
                  style={{
                    fontSize: 24,
                    fontWeight: "bold",
                    marginBottom: 24,
                    textAlign: "center",
                    color: COLORS.black,
                  }}
                  accessibilityLabel="Listing Modal Title"
                >
                  {editingListing ? "Edit Your Listing" : "Submit Your Listing"}
                </Text>
                <Formik
                  initialValues={{
                    // Flight Instructors
                    firstName:
                      editingListing &&
                      editingListing.category === "Flight Instructors"
                        ? editingListing.firstName || ""
                        : "",
                    lastName:
                      editingListing &&
                      editingListing.category === "Flight Instructors"
                        ? editingListing.lastName || ""
                        : "",
                    certifications:
                      editingListing &&
                      editingListing.category === "Flight Instructors"
                        ? editingListing.certifications || ""
                        : "",
                    flightHours:
                      editingListing?.category === "Flight Instructors" &&
                      editingListing?.flightHours != null
                        ? String(editingListing?.flightHours)
                        : "",
                    fiEmail:
                      editingListing &&
                      editingListing.category === "Flight Instructors"
                        ? editingListing.email || ""
                        : "",
                    fiPhone:
                      editingListing &&
                      editingListing.category === "Flight Instructors"
                        ? editingListing.phone || ""
                        : "",
                    fiDescription:
                      editingListing &&
                      editingListing.category === "Flight Instructors"
                        ? editingListing.description || ""
                        : "",
                    serviceLocationsList:
                      editingListing &&
                      editingListing.category === "Flight Instructors"
                        ? editingListing.serviceLocationsList || []
                        : [],
                    newServiceLocation: "",
                    hourlyRate:
                      editingListing?.category === "Flight Instructors" &&
                      editingListing?.hourlyRate != null
                        ? String(editingListing?.hourlyRate)
                        : "",
                    aircraftProvided:
                      editingListing &&
                      editingListing.category === "Flight Instructors"
                        ? editingListing.aircraftProvided || false
                        : false,
                    profileImage:
                      editingListing &&
                      editingListing.category === "Flight Instructors"
                        ? editingListing.profileImage || ""
                        : "",
                    // Aviation Mechanic
                    amFirstName:
                      editingListing &&
                      editingListing.category === "Aviation Mechanic"
                        ? editingListing.firstName || ""
                        : "",
                    amLastName:
                      editingListing &&
                      editingListing.category === "Aviation Mechanic"
                        ? editingListing.lastName || ""
                        : "",
                    amCertifications:
                      editingListing &&
                      editingListing.category === "Aviation Mechanic"
                        ? editingListing.certifications || ""
                        : "",
                    amEmail:
                      editingListing &&
                      editingListing.category === "Aviation Mechanic"
                        ? editingListing.email || ""
                        : "",
                    amPhone:
                      editingListing &&
                      editingListing.category === "Aviation Mechanic"
                        ? editingListing.phone || ""
                        : "",
                    amDescription:
                      editingListing &&
                      editingListing.category === "Aviation Mechanic"
                        ? editingListing.description || ""
                        : "",
                    amServiceLocations:
                      editingListing &&
                      editingListing.category === "Aviation Mechanic"
                        ? editingListing.serviceLocations || ""
                        : "",
                    // Flight Schools
                    flightSchoolName:
                      editingListing &&
                      editingListing.category === "Flight Schools"
                        ? editingListing.flightSchoolDetails
                            ?.flightSchoolName || ""
                        : "",
                    flightSchoolLocation:
                      editingListing &&
                      editingListing.category === "Flight Schools"
                        ? editingListing.flightSchoolDetails
                            ?.flightSchoolLocation || ""
                        : "",
                    flightSchoolEmail:
                      editingListing &&
                      editingListing.category === "Flight Schools"
                        ? editingListing.flightSchoolDetails
                            ?.flightSchoolEmail || ""
                        : "",
                    flightSchoolPhone:
                      editingListing &&
                      editingListing.category === "Flight Schools"
                        ? editingListing.flightSchoolDetails
                            ?.flightSchoolPhone || ""
                        : "",
                    flightSchoolDescription:
                      editingListing &&
                      editingListing.category === "Flight Schools"
                        ? editingListing.flightSchoolDetails
                            ?.flightSchoolDescription || ""
                        : "",
                    // Aviation Jobs
                    companyName:
                      editingListing &&
                      editingListing.category === "Aviation Jobs"
                        ? editingListing.companyName || ""
                        : "",
                    jobTitle:
                      editingListing &&
                      editingListing.category === "Aviation Jobs"
                        ? editingListing.jobTitle || ""
                        : "",
                    city:
                      editingListing &&
                      editingListing.category === "Aviation Jobs"
                        ? editingListing.city || ""
                        : "",
                    state:
                      editingListing &&
                      editingListing.category === "Aviation Jobs"
                        ? editingListing.state || ""
                        : "",

                    salary:
                      editingListing &&
                      editingListing.category === "Aviation Jobs"
                        ? editingListing.salary || ""
                        : "",
                    jobDescription:
                      editingListing &&
                      editingListing.category === "Aviation Jobs"
                        ? editingListing.jobDescription || ""
                        : "",
                    email:
                      editingListing &&
                      editingListing.category === "Aviation Jobs"
                        ? editingListing.email || ""
                        : "",
                    phone:
                      editingListing &&
                      editingListing.category === "Aviation Jobs"
                        ? editingListing.phone || ""
                        : "",
                    // Aircraft for Sale
                    title:
                      editingListing &&
                      editingListing.category === "Aircraft for Sale"
                        ? editingListing.title || ""
                        : "",
                    tailNumber:
                      editingListing &&
                      editingListing.category === "Aircraft for Sale"
                        ? editingListing.tailNumber || ""
                        : "",
                    salePrice:
                      editingListing?.category === "Aircraft for Sale" &&
                      editingListing?.salePrice != null
                        ? String(editingListing?.salePrice)
                        : "",
                    description:
                      editingListing &&
                      editingListing.category === "Aircraft for Sale"
                        ? editingListing.description || ""
                        : "",
                    city:
                      editingListing &&
                      editingListing.category === "Aircraft for Sale"
                        ? editingListing.city || ""
                        : "",
                    state:
                      editingListing &&
                      editingListing.category === "Aircraft for Sale"
                        ? editingListing.state || ""
                        : "",
                    email:
                      editingListing &&
                      editingListing.category === "Aircraft for Sale"
                        ? editingListing.email || ""
                        : "",
                    phone:
                      editingListing &&
                      editingListing.category === "Aircraft for Sale"
                        ? editingListing.phone || ""
                        : "",
                    // Charter Services fields
                    charterServiceName:
                      editingListing &&
                      editingListing.category === "Charter Services"
                        ? editingListing.charterServiceDetails
                            ?.charterServiceName || ""
                        : "",
                    charterServiceLocation:
                      editingListing &&
                      editingListing.category === "Charter Services"
                        ? editingListing.charterServiceDetails
                            ?.charterServiceLocation || ""
                        : "",
                    charterServiceEmail:
                      editingListing &&
                      editingListing.category === "Charter Services"
                        ? editingListing.charterServiceDetails
                            ?.charterServiceEmail || ""
                        : "",
                    charterServicePhone:
                      editingListing &&
                      editingListing.category === "Charter Services"
                        ? editingListing.charterServiceDetails
                            ?.charterServicePhone || ""
                        : "",
                    charterServiceDescription:
                      editingListing &&
                      editingListing.category === "Charter Services"
                        ? editingListing.charterServiceDetails
                            ?.charterServiceDescription || ""
                        : "",
                    charterServiceAreas:
                      editingListing &&
                      editingListing.category === "Charter Services"
                        ? editingListing.charterServiceDetails
                            ?.charterServiceAreas || ""
                        : "",
                    selectedPricing: selectedPricing || "Basic",
                    packageCost: selectedPricing
                      ? pricingPackages[selectedPricing] || 0
                      : 0,
                    category: editingListing
                      ? editingListing.category || selectedCategory
                      : selectedCategory,
                  }}
                  enableReinitialize={true}
                  validate={(values) => {
                    const errors = {};
                    const { category } = values;
                    if (category === "Flight Instructors") {
                      if (!values.firstName)
                        errors.firstName = "First name is required.";
                      if (!values.lastName)
                        errors.lastName = "Last name is required.";
                      if (!values.certifications)
                        errors.certifications =
                          "CFI Certification Number is required.";
                      if (!values.fiEmail) {
                        errors.fiEmail = "Contact email is required.";
                      } else if (!/\S+@\S+\.\S+/.test(values.fiEmail)) {
                        errors.fiEmail = "Invalid email address.";
                      }
                      if (!values.fiDescription)
                        errors.fiDescription = "Description is required.";
                      if (
                        !values.serviceLocationsList ||
                        values.serviceLocationsList.length === 0
                      ) {
                        errors.serviceLocationsList =
                          "At least one service location is required.";
                      }
                      if (!values.hourlyRate)
                        errors.hourlyRate = "Hourly rate is required.";
                      else if (isNaN(Number(values.hourlyRate))) {
                        errors.hourlyRate =
                          "Hourly rate must be a valid number.";
                      }
                    } else if (category === "Aviation Mechanic") {
                      if (!values.amFirstName)
                        errors.amFirstName = "First name is required.";
                      if (!values.amLastName)
                        errors.amLastName = "Last name is required.";
                      if (!values.amCertifications)
                        errors.amCertifications =
                          "Certifications are required.";
                      if (!values.amEmail) {
                        errors.amEmail = "Contact email is required.";
                      } else if (!/\S+@\S+\.\S+/.test(values.amEmail)) {
                        errors.amEmail = "Invalid email address.";
                      }
                      if (!values.amDescription)
                        errors.amDescription = "Description is required.";
                      if (!values.amServiceLocations)
                        errors.amServiceLocations =
                          "Service locations are required.";
                    } else if (category === "Aviation Jobs") {
                      if (!values.companyName)
                        errors.companyName = "Company Name is required.";
                      if (!values.jobTitle)
                        errors.jobTitle = "Job Title is required.";
                      if (!values.jobDescription)
                        errors.jobDescription = "Job Description is required.";
                      if (!values.email) {
                        errors.email = "Contact email is required.";
                      } else if (!/\S+@\S+\.\S+/.test(values.email)) {
                        errors.email = "Invalid email address.";
                      }
                    } else if (category === "Flight Schools") {
                      if (!values.flightSchoolName)
                        errors.flightSchoolName =
                          "Flight School Name is required.";
                      if (!values.flightSchoolLocation)
                        errors.flightSchoolLocation =
                          "Flight School Location is required.";
                      if (!values.flightSchoolEmail) {
                        errors.flightSchoolEmail = "Contact email is required.";
                      } else if (
                        !/\S+@\S+\.\S+/.test(values.flightSchoolEmail)
                      ) {
                        errors.flightSchoolEmail = "Invalid email address.";
                      }
                      if (!values.flightSchoolDescription)
                        errors.flightSchoolDescription =
                          "Description is required.";
                    } else if (category === "Charter Services") {
                      if (!values.charterServiceName)
                        errors.charterServiceName =
                          "Charter Service Name is required.";
                      if (!values.charterServiceLocation)
                        errors.charterServiceLocation =
                          "Charter Service Location is required.";
                      if (!values.charterServiceEmail) {
                        errors.charterServiceEmail =
                          "Contact email is required.";
                      } else if (
                        !/\S+@\S+\.\S+/.test(values.charterServiceEmail)
                      ) {
                        errors.charterServiceEmail = "Invalid email address.";
                      }
                    } else {
                      if (!values.title) errors.title = "Title is required.";
                      if (!values.description)
                        errors.description = "Description is required.";
                      if (!values.salePrice)
                        errors.salePrice = "Sale Price is required.";
                      if (!values.email) {
                        errors.email = "Contact email is required.";
                      } else if (!/\S+@\S+\.\S+/.test(values.email)) {
                        errors.email = "Invalid email address.";
                      }
                    }
                    return errors;
                  }}
                  onSubmit={onSubmitMethod}
                >
                  {({
                    handleChange,
                    handleBlur,
                    handleSubmit,
                    values,
                    errors,
                    touched,
                    setFieldValue,
                  }) => (
                    <>
                      {values.category === "Flight Instructors" ? (
                        <>
                          {/* Flight Instructors Fields */}
                          <TextInput
                            placeholder="First Name"
                            placeholderTextColor={COLORS.gray}
                            onChangeText={handleChange("firstName")}
                            onBlur={handleBlur("firstName")}
                            value={values.firstName}
                            style={{
                              borderBottomWidth: 1,
                              borderBottomColor: COLORS.lightGray,
                              marginBottom: 16,
                              padding: 8,
                              color: COLORS.black,
                            }}
                            accessibilityLabel="First Name Input"
                          />
                          {touched.firstName && errors.firstName && (
                            <Text style={{ color: "red", marginBottom: 8 }}>
                              {errors.firstName}
                            </Text>
                          )}
                          <TextInput
                            placeholder="Last Name"
                            placeholderTextColor={COLORS.gray}
                            onChangeText={handleChange("lastName")}
                            onBlur={handleBlur("lastName")}
                            value={values.lastName}
                            style={{
                              borderBottomWidth: 1,
                              borderBottomColor: COLORS.lightGray,
                              marginBottom: 16,
                              padding: 8,
                              color: COLORS.black,
                            }}
                            accessibilityLabel="Last Name Input"
                          />
                          {touched.lastName && errors.lastName && (
                            <Text style={{ color: "red", marginBottom: 8 }}>
                              {errors.lastName}
                            </Text>
                          )}
                          <TextInput
                            placeholder="CFI Certification Number"
                            placeholderTextColor={COLORS.gray}
                            onChangeText={handleChange("certifications")}
                            onBlur={handleBlur("certifications")}
                            value={values.certifications}
                            style={{
                              borderBottomWidth: 1,
                              borderBottomColor: COLORS.lightGray,
                              marginBottom: 16,
                              padding: 8,
                              color: COLORS.black,
                            }}
                            accessibilityLabel="CFI Certification Number Input"
                          />
                          {touched.certifications && errors.certifications && (
                            <Text style={{ color: "red", marginBottom: 8 }}>
                              {errors.certifications}
                            </Text>
                          )}
                          <TextInput
                            placeholder="Current Flight Hours"
                            placeholderTextColor={COLORS.gray}
                            onChangeText={handleChange("flightHours")}
                            onBlur={handleBlur("flightHours")}
                            value={values.flightHours}
                            keyboardType="numeric"
                            style={{
                              borderBottomWidth: 1,
                              borderBottomColor: COLORS.lightGray,
                              marginBottom: 16,
                              padding: 8,
                              color: COLORS.black,
                            }}
                            accessibilityLabel="Current Flight Hours Input"
                          />
                          <TextInput
                            placeholder="Contact Email"
                            placeholderTextColor={COLORS.gray}
                            onChangeText={handleChange("fiEmail")}
                            onBlur={handleBlur("fiEmail")}
                            value={values.fiEmail}
                            keyboardType="email-address"
                            style={{
                              borderBottomWidth: 1,
                              borderBottomColor: COLORS.lightGray,
                              marginBottom: 16,
                              padding: 8,
                              color: COLORS.black,
                            }}
                            accessibilityLabel="Contact Email Input"
                          />
                          {touched.fiEmail && errors.fiEmail && (
                            <Text style={{ color: "red", marginBottom: 8 }}>
                              {errors.fiEmail}
                            </Text>
                          )}
                          <TextInput
                            placeholder="Phone Number (Optional)"
                            placeholderTextColor={COLORS.gray}
                            onChangeText={handleChange("fiPhone")}
                            onBlur={handleBlur("fiPhone")}
                            value={values.fiPhone}
                            keyboardType="phone-pad"
                            style={{
                              borderBottomWidth: 1,
                              borderBottomColor: COLORS.lightGray,
                              marginBottom: 16,
                              padding: 8,
                              color: COLORS.black,
                            }}
                            accessibilityLabel="Phone Number Input"
                          />
                          <TextInput
                            placeholder="Description (include all type ratings, certifications, hours in each type, etc...)"
                            placeholderTextColor={COLORS.gray}
                            onChangeText={handleChange("fiDescription")}
                            onBlur={handleBlur("fiDescription")}
                            value={values.fiDescription}
                            multiline
                            numberOfLines={10}
                            maxLength={3000}
                            style={{
                              borderBottomWidth: 1,
                              borderBottomColor: COLORS.lightGray,
                              marginBottom: 16,
                              padding: 8,
                              color: COLORS.black,
                              textAlignVertical: "top",
                            }}
                            accessibilityLabel="Description Input"
                          />
                          {touched.fiDescription && errors.fiDescription && (
                            <Text style={{ color: "red", marginBottom: 8 }}>
                              {errors.fiDescription}
                            </Text>
                          )}
                          <FieldArray
                            name="serviceLocationsList"
                            render={(arrayHelpers) => (
                              <View style={{ marginBottom: 16 }}>
                                {values.serviceLocationsList &&
                                values.serviceLocationsList.length > 0 ? (
                                  values.serviceLocationsList.map(
                                    (loc, index) => (
                                      <View
                                        key={index}
                                        style={{
                                          flexDirection: "row",
                                          alignItems: "center",
                                          marginBottom: 8,
                                        }}
                                      >
                                        <Text
                                          style={{
                                            flex: 1,
                                            color: COLORS.black,
                                          }}
                                        >
                                          {loc}
                                        </Text>
                                        <TouchableOpacity
                                          onPress={() =>
                                            arrayHelpers.remove(index)
                                          }
                                          accessibilityLabel={`Remove service location ${loc}`}
                                          accessibilityRole="button"
                                        >
                                          <Ionicons
                                            name="close-circle"
                                            size={24}
                                            color={COLORS.red}
                                          />
                                        </TouchableOpacity>
                                      </View>
                                    )
                                  )
                                ) : (
                                  <Text
                                    style={{
                                      color: COLORS.gray,
                                      marginBottom: 8,
                                    }}
                                  >
                                    No service locations added.
                                  </Text>
                                )}
                                <View
                                  style={{
                                    flexDirection: "row",
                                    alignItems: "center",
                                  }}
                                >
                                  <TextInput
                                    placeholder="Add service location (City, State)"
                                    placeholderTextColor={COLORS.gray}
                                    style={{
                                      flex: 1,
                                      borderBottomWidth: 1,
                                      borderBottomColor: COLORS.lightGray,
                                      padding: 8,
                                      color: COLORS.black,
                                    }}
                                    onChangeText={handleChange(
                                      "newServiceLocation"
                                    )}
                                    onBlur={handleBlur("newServiceLocation")}
                                    value={values.newServiceLocation}
                                    accessibilityLabel="New Service Location Input"
                                  />
                                  <TouchableOpacity
                                    onPress={() => {
                                      if (
                                        values.newServiceLocation &&
                                        values.newServiceLocation.trim() !== ""
                                      ) {
                                        arrayHelpers.push(
                                          values.newServiceLocation.trim()
                                        );
                                        setFieldValue("newServiceLocation", "");
                                      }
                                    }}
                                    style={{ marginLeft: 8 }}
                                    accessibilityLabel="Add Service Location"
                                    accessibilityRole="button"
                                  >
                                    <Ionicons
                                      name="add-circle-outline"
                                      size={24}
                                      color={COLORS.primary}
                                    />
                                  </TouchableOpacity>
                                </View>
                                {touched.serviceLocationsList &&
                                  errors.serviceLocationsList && (
                                    <Text
                                      style={{ color: "red", marginBottom: 8 }}
                                    >
                                      {errors.serviceLocationsList}
                                    </Text>
                                  )}
                              </View>
                            )}
                          />
                          <TextInput
                            placeholder="Hourly Rate"
                            placeholderTextColor={COLORS.gray}
                            onChangeText={handleChange("hourlyRate")}
                            onBlur={handleBlur("hourlyRate")}
                            value={values.hourlyRate}
                            keyboardType="numeric"
                            style={{
                              borderBottomWidth: 1,
                              borderBottomColor: COLORS.lightGray,
                              marginBottom: 16,
                              padding: 8,
                              color: COLORS.black,
                            }}
                            accessibilityLabel="Hourly Rate Input"
                          />
                          {touched.hourlyRate && errors.hourlyRate && (
                            <Text style={{ color: "red", marginBottom: 8 }}>
                              {errors.hourlyRate}
                            </Text>
                          )}
                          <View
                            style={{
                              flexDirection: "row",
                              alignItems: "center",
                              marginBottom: 16,
                            }}
                          >
                            <Text
                              style={{
                                flex: 1,
                                color: COLORS.black,
                                fontSize: 16,
                              }}
                            >
                              Aircraft provided by CFI
                            </Text>
                            <Switch
                              value={values.aircraftProvided}
                              onValueChange={(value) =>
                                setFieldValue("aircraftProvided", value)
                              }
                              thumbColor={COLORS.primary}
                              trackColor={{
                                false: COLORS.lightGray,
                                true: COLORS.primary,
                              }}
                            />
                          </View>
                          <Text
                            style={{
                              marginBottom: 8,
                              color: COLORS.black,
                              fontWeight: "bold",
                              textAlign: "center",
                            }}
                            accessibilityLabel="Upload Profile Image Label"
                          >
                            Upload Profile Image
                          </Text>
                          {values.profileImage ? (
                            <View
                              style={{
                                flexDirection: "row",
                                alignItems: "center",
                                justifyContent: "center",
                                marginBottom: 16,
                              }}
                            >
                              <Image
                                source={{ uri: values.profileImage }}
                                style={{
                                  width: 100,
                                  height: 100,
                                  borderRadius: 50,
                                  marginRight: 10,
                                }}
                                accessibilityLabel="Uploaded Profile Image"
                              />
                              <TouchableOpacity
                                onPress={() => {
                                  setFieldValue("profileImage", "");
                                  setProfileImage("");
                                }}
                                accessibilityLabel="Remove Profile Image"
                                accessibilityRole="button"
                              >
                                <Ionicons
                                  name="close-circle"
                                  size={24}
                                  color={COLORS.red}
                                />
                              </TouchableOpacity>
                            </View>
                          ) : null}
                          <TouchableOpacity
                            onPress={() => pickProfileImage(setFieldValue)}
                            style={{
                              backgroundColor: values.profileImage
                                ? COLORS.lightGray
                                : COLORS.primary,
                              paddingVertical: 10,
                              paddingHorizontal: 16,
                              borderRadius: 8,
                              marginBottom: 16,
                            }}
                            accessibilityLabel="Upload Profile Image Button"
                            accessibilityRole="button"
                          >
                            <Text
                              style={{
                                textAlign: "center",
                                color: values.profileImage
                                  ? COLORS.black
                                  : COLORS.white,
                              }}
                            >
                              {values.profileImage
                                ? "Profile Image Uploaded"
                                : "Add Profile Image"}
                            </Text>
                          </TouchableOpacity>
                        </>
                      ) : values.category === "Aviation Mechanic" ? (
                        <>
                          {/* Aviation Mechanic Fields */}
                          <TextInput
                            placeholder="First Name"
                            placeholderTextColor={COLORS.gray}
                            onChangeText={handleChange("amFirstName")}
                            onBlur={handleBlur("amFirstName")}
                            value={values.amFirstName}
                            style={{
                              borderBottomWidth: 1,
                              borderBottomColor: COLORS.lightGray,
                              marginBottom: 16,
                              padding: 8,
                              color: COLORS.black,
                            }}
                            accessibilityLabel="First Name Input"
                          />
                          {touched.amFirstName && errors.amFirstName && (
                            <Text style={{ color: "red", marginBottom: 8 }}>
                              {errors.amFirstName}
                            </Text>
                          )}
                          <TextInput
                            placeholder="Last Name"
                            placeholderTextColor={COLORS.gray}
                            onChangeText={handleChange("amLastName")}
                            onBlur={handleBlur("amLastName")}
                            value={values.amLastName}
                            style={{
                              borderBottomWidth: 1,
                              borderBottomColor: COLORS.lightGray,
                              marginBottom: 16,
                              padding: 8,
                              color: COLORS.black,
                            }}
                            accessibilityLabel="Last Name Input"
                          />
                          {touched.amLastName && errors.amLastName && (
                            <Text style={{ color: "red", marginBottom: 8 }}>
                              {errors.amLastName}
                            </Text>
                          )}
                          <TextInput
                            placeholder="Certifications"
                            placeholderTextColor={COLORS.gray}
                            onChangeText={handleChange("amCertifications")}
                            onBlur={handleBlur("amCertifications")}
                            value={values.amCertifications}
                            style={{
                              borderBottomWidth: 1,
                              borderBottomColor: COLORS.lightGray,
                              marginBottom: 16,
                              padding: 8,
                              color: COLORS.black,
                            }}
                            accessibilityLabel="Certifications Input"
                          />
                          {touched.amCertifications &&
                            errors.amCertifications && (
                              <Text style={{ color: "red", marginBottom: 8 }}>
                                {errors.amCertifications}
                              </Text>
                            )}
                          <TextInput
                            placeholder="Contact Email"
                            placeholderTextColor={COLORS.gray}
                            onChangeText={handleChange("amEmail")}
                            onBlur={handleBlur("amEmail")}
                            value={values.amEmail}
                            keyboardType="email-address"
                            style={{
                              borderBottomWidth: 1,
                              borderBottomColor: COLORS.lightGray,
                              marginBottom: 16,
                              padding: 8,
                              color: COLORS.black,
                            }}
                            accessibilityLabel="Contact Email Input"
                          />
                          {touched.amEmail && errors.amEmail && (
                            <Text style={{ color: "red", marginBottom: 8 }}>
                              {errors.amEmail}
                            </Text>
                          )}
                          <TextInput
                            placeholder="Phone Number (Optional)"
                            placeholderTextColor={COLORS.gray}
                            onChangeText={handleChange("amPhone")}
                            onBlur={handleBlur("amPhone")}
                            value={values.amPhone}
                            keyboardType="phone-pad"
                            style={{
                              borderBottomWidth: 1,
                              borderBottomColor: COLORS.lightGray,
                              marginBottom: 16,
                              padding: 8,
                              color: COLORS.black,
                            }}
                            accessibilityLabel="Phone Number Input"
                          />
                          <TextInput
                            placeholder="Description"
                            placeholderTextColor={COLORS.gray}
                            onChangeText={handleChange("amDescription")}
                            onBlur={handleBlur("amDescription")}
                            value={values.amDescription}
                            multiline
                            numberOfLines={10}
                            maxLength={3000}
                            style={{
                              borderBottomWidth: 1,
                              borderBottomColor: COLORS.lightGray,
                              marginBottom: 16,
                              padding: 8,
                              color: COLORS.black,
                              textAlignVertical: "top",
                            }}
                            accessibilityLabel="Description Input"
                          />
                          {touched.amDescription && errors.amDescription && (
                            <Text style={{ color: "red", marginBottom: 8 }}>
                              {errors.amDescription}
                            </Text>
                          )}
                          <TextInput
                            placeholder="Service Locations (local airports or city)"
                            placeholderTextColor={COLORS.gray}
                            onChangeText={handleChange("amServiceLocations")}
                            onBlur={handleBlur("amServiceLocations")}
                            value={values.amServiceLocations}
                            style={{
                              borderBottomWidth: 1,
                              borderBottomColor: COLORS.lightGray,
                              marginBottom: 16,
                              padding: 8,
                              color: COLORS.black,
                            }}
                            accessibilityLabel="Service Locations Input"
                          />
                          {touched.amServiceLocations &&
                            errors.amServiceLocations && (
                              <Text style={{ color: "red", marginBottom: 8 }}>
                                {errors.amServiceLocations}
                              </Text>
                            )}
                        </>
                      ) : values.category === "Aviation Jobs" ? (
                        <>
                          {/* Aviation Jobs Fields */}
                          <TextInput
                            placeholder="Company Name"
                            placeholderTextColor={COLORS.gray}
                            onChangeText={handleChange("companyName")}
                            onBlur={handleBlur("companyName")}
                            value={values.companyName}
                            style={{
                              borderBottomWidth: 1,
                              borderBottomColor: COLORS.lightGray,
                              marginBottom: 16,
                              padding: 8,
                              color: COLORS.black,
                            }}
                            accessibilityLabel="Company Name Input"
                          />
                          {touched.companyName && errors.companyName && (
                            <Text style={{ color: "red", marginBottom: 8 }}>
                              {errors.companyName}
                            </Text>
                          )}
                          <TextInput
                            placeholder="City"
                            placeholderTextColor={COLORS.gray}
                            onChangeText={handleChange("city")}
                            onBlur={handleBlur("city")}
                            value={values.city}
                            style={{
                              borderBottomWidth: 1,
                              borderBottomColor: COLORS.lightGray,
                              marginBottom: 16,
                              padding: 8,
                              color: COLORS.black,
                            }}
                            accessibilityLabel="City Input"
                          />
                          <TextInput
                            placeholder="State"
                            placeholderTextColor={COLORS.gray}
                            onChangeText={handleChange("state")}
                            onBlur={handleBlur("state")}
                            value={values.state}
                            style={{
                              borderBottomWidth: 1,
                              borderBottomColor: COLORS.lightGray,
                              marginBottom: 16,
                              padding: 8,
                              color: COLORS.black,
                            }}
                            accessibilityLabel="State Input"
                          />
                          <TextInput
                            placeholder="Job Title"
                            placeholderTextColor={COLORS.gray}
                            onChangeText={handleChange("jobTitle")}
                            onBlur={handleBlur("jobTitle")}
                            value={values.jobTitle}
                            style={{
                              borderBottomWidth: 1,
                              borderBottomColor: COLORS.lightGray,
                              marginBottom: 16,
                              padding: 8,
                              color: COLORS.black,
                            }}
                            accessibilityLabel="Job Title Input"
                          />
                          {touched.jobTitle && errors.jobTitle && (
                            <Text style={{ color: "red", marginBottom: 8 }}>
                              {errors.jobTitle}
                            </Text>
                          )}
                          <TextInput
                            placeholder="Salary (Optional)"
                            placeholderTextColor={COLORS.gray}
                            onChangeText={handleChange("salary")}
                            onBlur={handleBlur("salary")}
                            value={values.salary}
                            keyboardType="numeric"
                            style={{
                              borderBottomWidth: 1,
                              borderBottomColor: COLORS.lightGray,
                              marginBottom: 16,
                              padding: 8,
                              color: COLORS.black,
                            }}
                            accessibilityLabel="Salary Input"
                          />
                          <TextInput
                            placeholder="Job Description"
                            placeholderTextColor={COLORS.gray}
                            onChangeText={handleChange("jobDescription")}
                            onBlur={handleBlur("jobDescription")}
                            value={values.jobDescription}
                            multiline
                            numberOfLines={4}
                            maxLength={3000}
                            style={{
                              borderBottomWidth: 1,
                              borderBottomColor: COLORS.lightGray,
                              marginBottom: 16,
                              padding: 8,
                              color: COLORS.black,
                              textAlignVertical: "top",
                            }}
                            accessibilityLabel="Job Description Input"
                          />
                          {touched.jobDescription && errors.jobDescription && (
                            <Text style={{ color: "red", marginBottom: 8 }}>
                              {errors.jobDescription}
                            </Text>
                          )}
                          <TextInput
                            placeholder="Contact Email"
                            placeholderTextColor={COLORS.gray}
                            onChangeText={handleChange("email")}
                            onBlur={handleBlur("email")}
                            value={values.email}
                            keyboardType="email-address"
                            style={{
                              borderBottomWidth: 1,
                              borderBottomColor: COLORS.lightGray,
                              marginBottom: 16,
                              padding: 8,
                              color: COLORS.black,
                            }}
                            accessibilityLabel="Contact Email Input"
                          />
                          {touched.email && errors.email && (
                            <Text style={{ color: "red", marginBottom: 8 }}>
                              {errors.email}
                            </Text>
                          )}
                          <TextInput
                            placeholder="Phone Number (Optional)"
                            placeholderTextColor={COLORS.gray}
                            onChangeText={handleChange("phone")}
                            onBlur={handleBlur("phone")}
                            value={values.phone}
                            keyboardType="phone-pad"
                            style={{
                              borderBottomWidth: 1,
                              borderBottomColor: COLORS.lightGray,
                              marginBottom: 16,
                              padding: 8,
                              color: COLORS.black,
                            }}
                            accessibilityLabel="Phone Number Input"
                          />
                          {/* NEW: Image Upload for Aviation Jobs */}
                          <View style={{ marginBottom: 16 }}>
                            {images.length > 0 && (
                              <ScrollView
                                horizontal
                                showsHorizontalScrollIndicator={false}
                                style={{ marginVertical: 8 }}
                              >
                                {images.map((img, index) => (
                                  <Image
                                    key={index}
                                    source={{ uri: img }}
                                    style={{
                                      width: 100,
                                      height: 100,
                                      borderRadius: 8,
                                      marginRight: 8,
                                    }}
                                  />
                                ))}
                              </ScrollView>
                            )}
                            {renderImageUploadButton()}
                          </View>
                        </>
                      ) : values.category === "Flight Schools" ? (
                        <>
                          {/* Flight Schools Specific Fields */}
                          <TextInput
                            placeholder="Flight School Name"
                            placeholderTextColor={COLORS.gray}
                            onChangeText={handleChange("flightSchoolName")}
                            onBlur={handleBlur("flightSchoolName")}
                            value={values.flightSchoolName}
                            style={{
                              borderBottomWidth: 1,
                              borderBottomColor: COLORS.lightGray,
                              marginBottom: 16,
                              padding: 8,
                              color: COLORS.black,
                            }}
                            accessibilityLabel="Flight School Name Input"
                          />
                          {touched.flightSchoolName &&
                            errors.flightSchoolName && (
                              <Text style={{ color: "red", marginBottom: 8 }}>
                                {errors.flightSchoolName}
                              </Text>
                            )}
                          <TextInput
                            placeholder="Flight School Location"
                            placeholderTextColor={COLORS.gray}
                            onChangeText={handleChange("flightSchoolLocation")}
                            onBlur={handleBlur("flightSchoolLocation")}
                            value={values.flightSchoolLocation}
                            style={{
                              borderBottomWidth: 1,
                              borderBottomColor: COLORS.lightGray,
                              marginBottom: 16,
                              padding: 8,
                              color: COLORS.black,
                            }}
                            accessibilityLabel="Flight School Location Input"
                          />
                          {touched.flightSchoolLocation &&
                            errors.flightSchoolLocation && (
                              <Text style={{ color: "red", marginBottom: 8 }}>
                                {errors.flightSchoolLocation}
                              </Text>
                            )}
                          <TextInput
                            placeholder="Contact Email"
                            placeholderTextColor={COLORS.gray}
                            onChangeText={handleChange("flightSchoolEmail")}
                            onBlur={handleBlur("flightSchoolEmail")}
                            value={values.flightSchoolEmail}
                            keyboardType="email-address"
                            style={{
                              borderBottomWidth: 1,
                              borderBottomColor: COLORS.lightGray,
                              marginBottom: 16,
                              padding: 8,
                              color: COLORS.black,
                            }}
                            accessibilityLabel="Flight School Contact Email Input"
                          />
                          {touched.flightSchoolEmail &&
                            errors.flightSchoolEmail && (
                              <Text style={{ color: "red", marginBottom: 8 }}>
                                {errors.flightSchoolEmail}
                              </Text>
                            )}
                          <TextInput
                            placeholder="Phone Number (Optional)"
                            placeholderTextColor={COLORS.gray}
                            onChangeText={handleChange("flightSchoolPhone")}
                            onBlur={handleBlur("flightSchoolPhone")}
                            value={values.flightSchoolPhone}
                            keyboardType="phone-pad"
                            style={{
                              borderBottomWidth: 1,
                              borderBottomColor: COLORS.lightGray,
                              marginBottom: 16,
                              padding: 8,
                              color: COLORS.black,
                            }}
                            accessibilityLabel="Flight School Phone Number Input"
                          />
                          <TextInput
                            placeholder="Flight School Description"
                            placeholderTextColor={COLORS.gray}
                            onChangeText={handleChange(
                              "flightSchoolDescription"
                            )}
                            onBlur={handleBlur("flightSchoolDescription")}
                            value={values.flightSchoolDescription}
                            multiline
                            numberOfLines={4}
                            maxLength={3000}
                            style={{
                              borderBottomWidth: 1,
                              borderBottomColor: COLORS.lightGray,
                              marginBottom: 16,
                              padding: 8,
                              color: COLORS.black,
                              textAlignVertical: "top",
                            }}
                            accessibilityLabel="Flight School Description Input"
                          />
                          {touched.flightSchoolDescription &&
                            errors.flightSchoolDescription && (
                              <Text style={{ color: "red", marginBottom: 8 }}>
                                {errors.flightSchoolDescription}
                              </Text>
                            )}
                          {/* NEW: Image Upload for Flight Schools */}
                          <View style={{ marginBottom: 16 }}>
                            {images.length > 0 && (
                              <ScrollView
                                horizontal
                                showsHorizontalScrollIndicator={false}
                                style={{ marginVertical: 8 }}
                              >
                                {images.map((img, index) => (
                                  <Image
                                    key={index}
                                    source={{ uri: img }}
                                    style={{
                                      width: 100,
                                      height: 100,
                                      borderRadius: 8,
                                      marginRight: 8,
                                    }}
                                  />
                                ))}
                              </ScrollView>
                            )}
                            {renderImageUploadButton()}
                          </View>
                        </>
                      ) : values.category === "Charter Services" ? (
                        <>
                          {/* Charter Services Fields */}
                          <TextInput
                            placeholder="Charter Service Name"
                            placeholderTextColor={COLORS.gray}
                            onChangeText={handleChange("charterServiceName")}
                            onBlur={handleBlur("charterServiceName")}
                            value={values.charterServiceName}
                            style={{
                              borderBottomWidth: 1,
                              borderBottomColor: COLORS.lightGray,
                              marginBottom: 16,
                              padding: 8,
                              color: COLORS.black,
                            }}
                            accessibilityLabel="Charter Service Name Input"
                          />
                          {touched.charterServiceName &&
                            errors.charterServiceName && (
                              <Text style={{ color: "red", marginBottom: 8 }}>
                                {errors.charterServiceName}
                              </Text>
                            )}
                          <TextInput
                            placeholder="Charter Service Location"
                            placeholderTextColor={COLORS.gray}
                            onChangeText={handleChange(
                              "charterServiceLocation"
                            )}
                            onBlur={handleBlur("charterServiceLocation")}
                            value={values.charterServiceLocation}
                            style={{
                              borderBottomWidth: 1,
                              borderBottomColor: COLORS.lightGray,
                              marginBottom: 16,
                              padding: 8,
                              color: COLORS.black,
                            }}
                            accessibilityLabel="Charter Service Location Input"
                          />
                          {touched.charterServiceLocation &&
                            errors.charterServiceLocation && (
                              <Text style={{ color: "red", marginBottom: 8 }}>
                                {errors.charterServiceLocation}
                              </Text>
                            )}
                          <TextInput
                            placeholder="Charter Service Email"
                            placeholderTextColor={COLORS.gray}
                            onChangeText={handleChange("charterServiceEmail")}
                            onBlur={handleBlur("charterServiceEmail")}
                            value={values.charterServiceEmail}
                            keyboardType="email-address"
                            style={{
                              borderBottomWidth: 1,
                              borderBottomColor: COLORS.lightGray,
                              marginBottom: 16,
                              padding: 8,
                              color: COLORS.black,
                            }}
                            accessibilityLabel="Charter Service Email Input"
                          />
                          {touched.charterServiceEmail &&
                            errors.charterServiceEmail && (
                              <Text style={{ color: "red", marginBottom: 8 }}>
                                {errors.charterServiceEmail}
                              </Text>
                            )}
                          <TextInput
                            placeholder="Charter Service Phone (Optional)"
                            placeholderTextColor={COLORS.gray}
                            onChangeText={handleChange("charterServicePhone")}
                            onBlur={handleBlur("charterServicePhone")}
                            value={values.charterServicePhone}
                            keyboardType="phone-pad"
                            style={{
                              borderBottomWidth: 1,
                              borderBottomColor: COLORS.lightGray,
                              marginBottom: 16,
                              padding: 8,
                              color: COLORS.black,
                            }}
                            accessibilityLabel="Charter Service Phone Input"
                          />
                          <TextInput
                            placeholder="Charter Service Description"
                            placeholderTextColor={COLORS.gray}
                            onChangeText={handleChange(
                              "charterServiceDescription"
                            )}
                            onBlur={handleBlur("charterServiceDescription")}
                            value={values.charterServiceDescription}
                            multiline
                            numberOfLines={4}
                            maxLength={3000}
                            style={{
                              borderBottomWidth: 1,
                              borderBottomColor: COLORS.lightGray,
                              marginBottom: 16,
                              padding: 8,
                              color: COLORS.black,
                              textAlignVertical: "top",
                            }}
                            accessibilityLabel="Charter Service Description Input"
                          />
                          {touched.charterServiceDescription &&
                            errors.charterServiceDescription && (
                              <Text style={{ color: "red", marginBottom: 8 }}>
                                {errors.charterServiceDescription}
                              </Text>
                            )}
                          <TextInput
                            placeholder="Charter Service Areas (e.g. Regions or States)"
                            placeholderTextColor={COLORS.gray}
                            onChangeText={handleChange("charterServiceAreas")}
                            onBlur={handleBlur("charterServiceAreas")}
                            value={values.charterServiceAreas}
                            style={{
                              borderBottomWidth: 1,
                              borderBottomColor: COLORS.lightGray,
                              marginBottom: 16,
                              padding: 8,
                              color: COLORS.black,
                            }}
                            accessibilityLabel="Charter Service Areas Input"
                          />
                          <View style={{ marginBottom: 16 }}>
                            {images.length > 0 && (
                              <ScrollView
                                horizontal
                                showsHorizontalScrollIndicator={false}
                                style={{ marginVertical: 8 }}
                              >
                                {images.map((img, index) => (
                                  <Image
                                    key={index}
                                    source={{ uri: img }}
                                    style={{
                                      width: 100,
                                      height: 100,
                                      borderRadius: 8,
                                      marginRight: 8,
                                    }}
                                  />
                                ))}
                              </ScrollView>
                            )}
                            {renderImageUploadButton()}
                          </View>
                        </>
                      ) : (
                        <>
                          {/* Aircraft for Sale Fields */}
                          <TextInput
                            placeholder="Aircraft Year/Make/Model"
                            placeholderTextColor={COLORS.gray}
                            onChangeText={handleChange("title")}
                            onBlur={handleBlur("title")}
                            value={values.title}
                            style={{
                              borderBottomWidth: 1,
                              borderBottomColor: COLORS.lightGray,
                              marginBottom: 16,
                              padding: 8,
                              color: COLORS.black,
                            }}
                            accessibilityLabel="Aircraft Year/Make/Model Input"
                          />
                          {touched.title && errors.title && (
                            <Text style={{ color: "red", marginBottom: 8 }}>
                              {errors.title}
                            </Text>
                          )}
                          <TextInput
                            placeholder="Aircraft Tail Number"
                            placeholderTextColor={COLORS.gray}
                            onChangeText={handleChange("tailNumber")}
                            onBlur={handleBlur("tailNumber")}
                            value={values.tailNumber}
                            style={{
                              borderBottomWidth: 1,
                              borderBottomColor: COLORS.lightGray,
                              marginBottom: 16,
                              padding: 8,
                              color: COLORS.black,
                            }}
                            accessibilityLabel="Aircraft Tail Number Input"
                          />
                          {touched.tailNumber && errors.tailNumber && (
                            <Text style={{ color: "red", marginBottom: 8 }}>
                              {errors.tailNumber}
                            </Text>
                          )}
                          <TextInput
                            placeholder="Sale Price"
                            placeholderTextColor={COLORS.gray}
                            onChangeText={handleChange("salePrice")}
                            onBlur={handleBlur("salePrice")}
                            value={values.salePrice}
                            keyboardType="numeric"
                            style={{
                              borderBottomWidth: 1,
                              borderBottomColor: COLORS.lightGray,
                              marginBottom: 16,
                              padding: 8,
                              color: COLORS.black,
                            }}
                            accessibilityLabel="Sale Price Input"
                          />
                          {touched.salePrice && errors.salePrice && (
                            <Text style={{ color: "red", marginBottom: 8 }}>
                              {errors.salePrice}
                            </Text>
                          )}
                          <TextInput
                            placeholder="Airport Identifier"
                            placeholderTextColor={COLORS.gray}
                            onChangeText={handleChange("airportIdentifier")}
                            onBlur={handleBlur("airportIdentifier")}
                            value={values.airportIdentifier}
                            style={{
                              borderBottomWidth: 1,
                              borderBottomColor: COLORS.lightGray,
                              marginBottom: 16,
                              padding: 8,
                              color: COLORS.black,
                            }}
                            accessibilityLabel="Airport Identifier Input"
                          />
                          <TextInput
                            placeholder="City"
                            placeholderTextColor={COLORS.gray}
                            onChangeText={handleChange("city")}
                            onBlur={handleBlur("city")}
                            value={values.city}
                            style={{
                              borderBottomWidth: 1,
                              borderBottomColor: COLORS.lightGray,
                              marginBottom: 16,
                              padding: 8,
                              color: COLORS.black,
                            }}
                            accessibilityLabel="City Input"
                          />
                          <TextInput
                            placeholder="State"
                            placeholderTextColor={COLORS.gray}
                            onChangeText={handleChange("state")}
                            onBlur={handleBlur("state")}
                            value={values.state}
                            style={{
                              borderBottomWidth: 1,
                              borderBottomColor: COLORS.lightGray,
                              marginBottom: 16,
                              padding: 8,
                              color: COLORS.black,
                            }}
                            accessibilityLabel="State Input"
                          />
                          <TextInput
                            placeholder="Description"
                            placeholderTextColor={COLORS.gray}
                            onChangeText={handleChange("description")}
                            onBlur={handleBlur("description")}
                            value={values.description}
                            multiline
                            numberOfLines={4}
                            maxLength={3000}
                            style={{
                              borderBottomWidth: 1,
                              borderBottomColor: COLORS.lightGray,
                              marginBottom: 16,
                              padding: 8,
                              color: COLORS.black,
                              textAlignVertical: "top",
                            }}
                            accessibilityLabel="Description Input"
                          />
                          {touched.description && errors.description && (
                            <Text style={{ color: "red", marginBottom: 8 }}>
                              {errors.description}
                            </Text>
                          )}
                          <TextInput
                            placeholder="Contact Email"
                            placeholderTextColor={COLORS.gray}
                            onChangeText={handleChange("email")}
                            onBlur={handleBlur("email")}
                            value={values.email}
                            keyboardType="email-address"
                            style={{
                              borderBottomWidth: 1,
                              borderBottomColor: COLORS.lightGray,
                              marginBottom: 16,
                              padding: 8,
                              color: COLORS.black,
                            }}
                            accessibilityLabel="Contact Email Input"
                          />
                          {touched.email && errors.email && (
                            <Text style={{ color: "red", marginBottom: 8 }}>
                              {errors.email}
                            </Text>
                          )}
                          <TextInput
                            placeholder="Phone Number (Optional)"
                            placeholderTextColor={COLORS.gray}
                            onChangeText={handleChange("phone")}
                            onBlur={handleBlur("phone")}
                            value={values.phone}
                            keyboardType="phone-pad"
                            style={{
                              borderBottomWidth: 1,
                              borderBottomColor: COLORS.lightGray,
                              marginBottom: 16,
                              padding: 8,
                              color: COLORS.black,
                            }}
                            accessibilityLabel="Phone Number Input"
                          />
                          {/* NEW: Image Upload for Aircraft for Sale */}
                          <View style={{ marginBottom: 16 }}>
                            {images.length > 0 && (
                              <ScrollView
                                horizontal
                                showsHorizontalScrollIndicator={false}
                                style={{ marginVertical: 8 }}
                              >
                                {images.map((img, index) => (
                                  <Image
                                    key={index}
                                    source={{ uri: img }}
                                    style={{
                                      width: 100,
                                      height: 100,
                                      borderRadius: 8,
                                      marginRight: 8,
                                    }}
                                  />
                                ))}
                              </ScrollView>
                            )}
                            {renderImageUploadButton()}
                          </View>
                        </>
                      )}
                      <TextInput
                        value={values.selectedPricing}
                        editable={false}
                        style={{ display: "none" }}
                      />
                      <View style={{ marginVertical: 16 }}>
                        <Text
                          style={{
                            fontSize: 18,
                            fontWeight: "bold",
                            marginBottom: 8,
                          }}
                        >
                          Select Pricing Package
                        </Text>
                        <View
                          style={{
                            flexDirection: "row",
                            justifyContent: "space-around",
                          }}
                        >
                          {Object.keys(pricingPackages).map((packageType) => (
                            <View
                              key={packageType}
                              style={{ alignItems: "center", width: "30%" }}
                            >
                              <TouchableOpacity
                                onPress={() =>
                                  setPricingModalVisible((prev) => ({
                                    ...prev,
                                    [packageType]: true,
                                  }))
                                }
                                style={{ marginBottom: 4 }}
                                accessibilityLabel={`View details for ${packageType} package`}
                                accessibilityRole="button"
                              >
                                <Ionicons
                                  name="information-circle-outline"
                                  size={24}
                                  color={
                                    selectedPricing === packageType
                                      ? COLORS.primary
                                      : COLORS.black
                                  }
                                />
                              </TouchableOpacity>
                              <TouchableOpacity
                                onPress={() => {
                                  setSelectedPricing(packageType);
                                  setFieldValue("selectedPricing", packageType);
                                  setFieldValue(
                                    "packageCost",
                                    pricingPackages[packageType]
                                  );
                                }}
                                style={{
                                  padding: 10,
                                  borderRadius: 8,
                                  backgroundColor:
                                    selectedPricing === packageType
                                      ? COLORS.primary
                                      : COLORS.lightGray,
                                  alignItems: "center",
                                }}
                                accessibilityLabel={`Select ${packageType} package`}
                                accessibilityRole="button"
                              >
                                <Text
                                  style={{
                                    color:
                                      selectedPricing === packageType
                                        ? COLORS.white
                                        : COLORS.black,
                                    fontWeight: "bold",
                                  }}
                                >
                                  {packageType}
                                </Text>
                                {(packageType === "Basic" &&
                                  (values.category === "Aircraft for Sale" ||
                                    values.category === "Flight Schools")) ||
                                (packageType === "Flight Instructors" &&
                                  values.category === "Flight Instructors") ||
                                (packageType === "Aviation Mechanic" &&
                                  values.category === "Aviation Mechanic") ||
                                (packageType === "Charter Services" &&
                                  values.category === "Charter Services") ? (
                                  <Text
                                    style={{
                                      color:
                                        selectedPricing === packageType
                                          ? COLORS.white
                                          : COLORS.black,
                                    }}
                                  >
                                    <Text
                                      style={{
                                        textDecorationLine: "line-through",
                                      }}
                                    >
                                      ${pricingPackages[packageType]}
                                    </Text>{" "}
                                    Free for 7 days
                                  </Text>
                                ) : (
                                  <Text
                                    style={{
                                      color:
                                        selectedPricing === packageType
                                          ? COLORS.white
                                          : COLORS.black,
                                    }}
                                  >
                                    ${pricingPackages[packageType]}
                                  </Text>
                                )}
                              </TouchableOpacity>
                            </View>
                          ))}
                        </View>
                      </View>

                      <TouchableOpacity
                        onPress={() => {
                          setPreviewData(values);
                          setPreviewModalVisible(true);
                        }}
                        style={{
                          backgroundColor: COLORS.secondary,
                          paddingVertical: 12,
                          borderRadius: 50,
                          marginBottom: 16,
                        }}
                        accessibilityLabel="Preview Listing"
                        accessibilityRole="button"
                      >
                        <Text
                          style={{
                            color: COLORS.white,
                            textAlign: "center",
                            fontWeight: "bold",
                          }}
                        >
                          Preview Listing
                        </Text>
                      </TouchableOpacity>

                      {loading ? (
                        <ActivityIndicator
                          size="large"
                          color={COLORS.red}
                          accessibilityLabel="Submitting Listing"
                        />
                      ) : (
                        <TouchableOpacity
                          onPress={handleSubmit}
                          style={{
                            backgroundColor: COLORS.red,
                            paddingVertical: 12,
                            borderRadius: 50,
                          }}
                          accessibilityLabel={
                            editingListing ? "Save" : "Proceed to pay"
                          }
                          accessibilityRole="button"
                        >
                          <Text
                            style={{
                              color: COLORS.white,
                              textAlign: "center",
                              fontWeight: "bold",
                            }}
                          >
                            {editingListing ? "Save" : "Proceed to pay"}
                          </Text>
                        </TouchableOpacity>
                      )}

                      <TouchableOpacity
                        onPress={() => {
                          closeAllModals();
                          setEditingListing(null);
                          setImages([]);
                        }}
                        style={{
                          marginTop: 16,
                          paddingVertical: 8,
                          borderRadius: 50,
                          backgroundColor: COLORS.lightGray,
                        }}
                        accessibilityLabel="Cancel Submit Listing Modal"
                        accessibilityRole="button"
                      >
                        <Text
                          style={{ textAlign: "center", color: COLORS.black }}
                        >
                          Cancel
                        </Text>
                      </TouchableOpacity>
                    </>
                  )}
                </Formik>
              </View>
            </ScrollView>
          </Animated.View>
        </View>
      </Modal>

      <Modal
        animationType="slide"
        transparent={true}
        visible={previewModalVisible}
        onRequestClose={() => setPreviewModalVisible(false)}
      >
        <SafeAreaView style={{ flex: 1, backgroundColor: COLORS.white }}>
          <ScrollView contentContainerStyle={{ padding: 20 }}>
            <TouchableOpacity
              onPress={() => setPreviewModalVisible(false)}
              style={{ position: "absolute", top: 10, right: 10, zIndex: 10 }}
              accessibilityLabel="Close Preview Listing"
              accessibilityRole="button"
            >
              <Ionicons name="close" size={30} color={COLORS.black} />
            </TouchableOpacity>
            {previewData ? (
              <>
                <Text
                  style={{
                    fontSize: 24,
                    fontWeight: "bold",
                    textAlign: "center",
                    marginBottom: 10,
                  }}
                >
                  Listing Preview
                </Text>
                {renderListingDetails(previewData)}
              </>
            ) : (
              <Text style={{ textAlign: "center" }}>
                No preview data available.
              </Text>
            )}
          </ScrollView>
        </SafeAreaView>
      </Modal>

      <FullScreenImageModal
        visible={fullScreenModalVisible}
        onRequestClose={() => setFullScreenModalVisible(false)}
        imageUri={zoomImageUri}
      />

      {/* Filter Modal: replaced to match home.js exactly */}
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

            {selectedCategory !== "Flight Schools" &&
              selectedCategory !== "Flight Instructors" && (
                <>
                  <View style={styles.orSeparator}>
                    <View style={styles.line} />
                    <Text style={styles.orText}>OR</Text>
                    <View style={styles.line} />
                  </View>

                  <Text style={styles.filterLabel}>
                    {selectedCategory === "Aircraft for Sale"
                      ? "Aircraft Make & Model"
                      : selectedCategory === "Aviation Jobs"
                      ? "Job Title or Company"
                      : "Keyword"}
                  </Text>
                  <View style={styles.inputGroup}>
                    <TextInput
                      value={makeModel}
                      onChangeText={setMakeModel}
                      placeholder={
                        selectedCategory === "Aircraft for Sale"
                          ? "Enter aircraft make/model"
                          : selectedCategory === "Aviation Jobs"
                          ? "Enter job title or company"
                          : "Enter keyword"
                      }
                      placeholderTextColor="#718096"
                      style={styles.textInput}
                      accessibilityLabel={
                        selectedCategory === "Aviation Jobs"
                          ? "Enter job title or company"
                          : "Enter keyword"
                      }
                    />
                  </View>
                </>
              )}

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

      {/* New Modal: "View your listings" */}
      <Modal
        visible={viewListingsModalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setViewListingsModalVisible(false)}
      >
        <View
          style={{
            flex: 1,
            justifyContent: "center",
            alignItems: "center",
            backgroundColor: "rgba(0,0,0,0.5)",
          }}
        >
          <View
            style={{
              width: "90%",
              maxHeight: "80%",
              backgroundColor: COLORS.white,
              borderRadius: 24,
              padding: 16,
            }}
          >
            <TouchableOpacity
              onPress={() => setViewListingsModalVisible(false)}
              style={{ alignSelf: "flex-end" }}
              accessibilityLabel="Close your listings modal"
              accessibilityRole="button"
            >
              <Ionicons name="close" size={30} color={COLORS.black} />
            </TouchableOpacity>
            <Text
              style={{
                fontSize: 24,
                fontWeight: "bold",
                marginBottom: 16,
                textAlign: "center",
                color: COLORS.black,
              }}
            >
              Your Listings
            </Text>
            {userListings.length > 0 ? (
              <FlatList
                data={userListings}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => {
                  // For flight instructors, use profileImage; otherwise, use first image in images array
                  const mainImage =
                    item.category === "Flight Instructors"
                      ? item.profileImage
                      : item.images && item.images.length > 0
                      ? item.images[0]
                      : null;
                  return (
                    <View
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        borderWidth: 1,
                        borderColor: COLORS.lightGray,
                        borderRadius: 8,
                        padding: 8,
                        marginBottom: 8,
                      }}
                    >
                      {/* Wrap image and text in a touchable so tapping opens the listing */}
                      <TouchableOpacity
                        onPress={() => {
                          handleListingPress(item);
                          setViewListingsModalVisible(false);
                        }}
                        style={{
                          flexDirection: "row",
                          flex: 1,
                          alignItems: "center",
                        }}
                      >
                        {mainImage ? (
                          <Image
                            source={{ uri: mainImage }}
                            style={{ width: 80, height: 80, borderRadius: 8 }}
                          />
                        ) : (
                          <View
                            style={{
                              width: 80,
                              height: 80,
                              backgroundColor: COLORS.lightGray,
                              borderRadius: 8,
                              justifyContent: "center",
                              alignItems: "center",
                            }}
                          >
                            <Text style={{ color: COLORS.gray, fontSize: 12 }}>
                              No Image
                            </Text>
                          </View>
                        )}

                        <View style={{ flex: 1, marginLeft: 8 }}>
                          <Text
                            style={{
                              fontSize: 16,
                              fontWeight: "bold",
                              color: COLORS.black,
                            }}
                          >
                            {item.title || item.jobTitle || "Listing"}
                          </Text>
                          <Text style={{ fontSize: 14, color: COLORS.gray }}>
                            {item.category}
                          </Text>
                        </View>
                      </TouchableOpacity>

                      {/* Edit and Delete Icon buttons */}
                      <View
                        style={{ flexDirection: "row", alignItems: "center" }}
                      >
                        <TouchableOpacity
                          onPress={() => {
                            handleEditListing(item);
                            setViewListingsModalVisible(false);
                          }}
                          style={{ marginRight: 8 }}
                          accessibilityLabel="Edit Listing"
                          accessibilityRole="button"
                        >
                          <Ionicons
                            name="create-outline"
                            size={24}
                            color={COLORS.primary}
                          />
                        </TouchableOpacity>
                        <TouchableOpacity
                          onPress={() => {
                            handleDeleteListing(item.id);
                            setViewListingsModalVisible(false);
                          }}
                          accessibilityLabel="Delete Listing"
                          accessibilityRole="button"
                        >
                          <Ionicons
                            name="trash-outline"
                            size={24}
                            color={COLORS.red}
                          />
                        </TouchableOpacity>
                      </View>
                    </View>
                  );
                }}
              />
            ) : (
              <Text style={{ textAlign: "center", color: COLORS.gray }}>
                You haven't posted any listings yet.
              </Text>
            )}
          </View>
        </View>
      </Modal>

      {/* Help & Support Modal */}
      <Modal
        visible={supportModalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setSupportModalVisible(false)}
      >
        <View
          style={{
            flex: 1,
            justifyContent: "center",
            alignItems: "center",
            backgroundColor: "rgba(0,0,0,0.5)",
          }}
        >
          <View
            style={{
              width: "80%",
              backgroundColor: COLORS.white,
              borderRadius: 16,
              padding: 20,
            }}
          >
            <TouchableOpacity
              onPress={() => setSupportModalVisible(false)}
              style={{ alignSelf: "flex-end" }}
              accessibilityLabel="Close support modal"
              accessibilityRole="button"
            >
              <Ionicons name="close" size={24} color={COLORS.black} />
            </TouchableOpacity>

            <Text
              style={{ fontSize: 20, fontWeight: "bold", marginBottom: 12 }}
            >
              Help & Support
            </Text>
            <Text style={{ fontSize: 16, marginBottom: 24 }}>
              Have questions or need assistance? Email our support team at:
            </Text>
            <TouchableOpacity
              onPress={() => Linking.openURL("mailto:support@readysetfly.us")}
              accessibilityLabel="Email support"
              accessibilityRole="button"
            >
              <Text
                style={{
                  color: COLORS.primary,
                  fontSize: 16,
                  textDecorationLine: "underline",
                }}
              >
                support@readysetfly.us
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Info modals for the pricing packages */}
      {Object.keys(pricingModalVisible).map((packageType) => {
        const isVisible = pricingModalVisible[packageType];
        return (
          <Modal
            key={packageType}
            visible={isVisible}
            onRequestClose={() =>
              setPricingModalVisible((prev) => ({
                ...prev,
                [packageType]: false,
              }))
            }
            transparent={true}
            animationType="slide"
          >
            <View
              style={{
                flex: 1,
                justifyContent: "center",
                alignItems: "center",
                backgroundColor: "rgba(0,0,0,0.5)",
              }}
            >
              <View
                style={{
                  width: "80%",
                  backgroundColor: "#fff",
                  borderRadius: 10,
                  padding: 20,
                }}
              >
                <TouchableOpacity
                  onPress={() =>
                    setPricingModalVisible((prev) => ({
                      ...prev,
                      [packageType]: false,
                    }))
                  }
                  style={{ position: "absolute", top: 10, right: 10 }}
                  accessibilityLabel={`Close ${packageType} info modal`}
                  accessibilityRole="button"
                >
                  <Ionicons name="close" size={24} color="#000" />
                </TouchableOpacity>
                <Text
                  style={{ fontWeight: "bold", fontSize: 18, marginBottom: 10 }}
                >
                  {packageType} Package Details
                </Text>
                {packageType === "Basic" && (
                  <Text style={{ marginBottom: 10 }}>
                    The Basic package includes a standard listing with a set
                    number of images. Great option for those wanting an
                    affordable way to reach buyers.
                  </Text>
                )}
                {packageType === "Featured" && (
                  <Text style={{ marginBottom: 10 }}>
                    The Featured package provides increased visibility,
                    highlighting your listing among others and allowing for more
                    images.
                  </Text>
                )}
                {packageType === "Enhanced" && (
                  <Text style={{ marginBottom: 10 }}>
                    The Enhanced package grants maximum exposure on the
                    marketplace and includes the highest image limit and premier
                    placement.
                  </Text>
                )}
                {packageType === "Flight Instructors" && (
                  <Text style={{ marginBottom: 10 }}>
                    A specialized listing package tailored for Flight
                    Instructors to showcase ratings, experience, and service
                    locations.
                  </Text>
                )}
                {packageType === "Aviation Mechanic" && (
                  <Text style={{ marginBottom: 10 }}>
                    A specialized listing package for Aviation Mechanics to
                    advertise certifications, locations, and specialized
                    services.
                  </Text>
                )}
                {packageType === "Charter Services" && (
                  <Text style={{ marginBottom: 10 }}>
                    A premier listing option specifically designed for Charter
                    Services to highlight unique routes, services, and fleet
                    capabilities.
                  </Text>
                )}
              </View>
            </View>
          </Modal>
        );
      })}
    </SafeAreaView>
  );
};

const AppNavigator = () => (
  <Stack.Navigator initialRouteName="Classifieds">
    <Stack.Screen
      name="Classifieds"
      component={Classifieds}
      options={{ headerShown: false }}
    />
    <Stack.Screen
      name="classifiedsPaymentScreen"
      component={classifiedsPaymentScreen}
      options={{ headerShown: false }}
    />
  </Stack.Navigator>
);

export default AppNavigator;

/** Final styles, including those for the updated Filter Modal **/
const styles = StyleSheet.create({
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
    backgroundColor: COLORS.primary,
  },
  inactiveDot: {
    backgroundColor: COLORS.lightGray,
  },
  zoomModalContainer: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.9)",
    justifyContent: "center",
    alignItems: "center",
  },
  zoomCloseButton: {
    position: "absolute",
    top: Platform.OS === "ios" ? 60 : 30,
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
  row: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 5,
  },
  rowBetween: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 5,
  },
  priceLocationOverlay: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "space-between",
    padding: 10,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
  },
  priceText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "bold",
  },
  locationContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  locationText: {
    color: "#FFFFFF",
    fontSize: 16,
    marginLeft: 5,
  },
  centeredRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginTop: 10,
  },
  editDeleteContainer: {
    flexDirection: "row",
    justifyContent: "flex-end",
    padding: 10,
  },
  editButton: {
    backgroundColor: COLORS.primary,
    padding: 8,
    borderRadius: 20,
    marginRight: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  deleteButton: {
    backgroundColor: COLORS.red,
    padding: 8,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  upButton: {
    position: "absolute",
    bottom: 30,
    right: 20,
    backgroundColor: COLORS.primary,
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: COLORS.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 5,
    zIndex: 1000,
  },
  featuredTag: {
    position: "absolute",
    top: 10,
    right: 10,
    backgroundColor: COLORS.primary,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    zIndex: 10,
  },
  featuredTagText: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "bold",
  },

  /* Filter Modal styles matching home.js */
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
  inputGroup: {
    marginBottom: 16,
  },
  textInput: {
    borderWidth: 1,
    borderColor: "#A0AEC0",
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: "#000",
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
  reportButton: {
    backgroundColor: COLORS.lightGray,
    padding: 8,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 4,
  },
});
