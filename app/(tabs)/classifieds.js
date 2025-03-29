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
const renderListingDetails = (item) => {
  if (item.category === "Aviation Jobs") {
    return (
      <View style={{ padding: 10, borderRadius: 10, backgroundColor: COLORS.white, marginBottom: 20 }}>
        <Text style={{ fontSize: 18, fontWeight: "bold", color: COLORS.black, marginBottom: 5 }}>
          {item.jobTitle || "No Job Title"}
        </Text>
        <Text style={{ fontSize: 16, color: COLORS.secondary, marginBottom: 5 }}>
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
      <View style={{ padding: 10, borderRadius: 10, backgroundColor: COLORS.white, marginBottom: 10 }}>
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
      <View style={{ padding: 10, borderRadius: 10, backgroundColor: "transparent", marginBottom: 10 }}>
        <Text style={{ fontSize: 18, fontWeight: "bold", color: COLORS.white, marginBottom: 5 }}>
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
  } else if (item.category === "Charter Services") {
    const details = item.charterServiceDetails || {};
    return (
      <View style={{ padding: 10, borderRadius: 10, backgroundColor: COLORS.white, marginBottom: 10 }}>
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
      <View style={{ padding: 10, borderRadius: 10, backgroundColor: COLORS.white, marginBottom: 10 }}>
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
      Animated.spring(pinchScale, { toValue: 1, useNativeDriver: true }).start();
    }
  };

  return (
    <Modal animationType="fade" transparent={true} visible={visible} onRequestClose={onRequestClose}>
      <View style={styles.zoomModalContainer}>
        <TouchableOpacity
          onPress={onRequestClose}
          style={styles.zoomCloseButton}
          accessibilityLabel="Close zoomed image"
          accessibilityRole="button"
        >
          <Ionicons name="close" size={30} color={COLORS.white} />
        </TouchableOpacity>
        <PinchGestureHandler onGestureEvent={onPinchGestureEvent} onHandlerStateChange={onPinchHandlerStateChange}>
          <Animated.View style={[styles.zoomScrollView, { transform: [{ scale: pinchScale }] }]}>
            {imageUri && (
              <Image source={{ uri: imageUri }} style={styles.zoomImage} resizeMode="contain" />
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
const renderListingImages = (item, isMainCard = false, imagePressHandler) => {
  return (
    <View style={{ position: "relative" }}>
      <FlatList
        data={item.images || []}
        horizontal
        showsHorizontalScrollIndicator={false}
        keyExtractor={(imageUri, index) => `${item.id}-${index}`}
        onMomentumScrollEnd={(event) => {
          const itemWidth = SCREEN_WIDTH - 32 + 10;
          const index = Math.round(event.nativeEvent.contentOffset.x / itemWidth);
        }}
        renderItem={({ item: imageUri }) =>
          isMainCard ? (
            <Image
              source={{ uri: imageUri }}
              style={{
                width: SCREEN_WIDTH - 32,
                height: 200,
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
                  height: 200,
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
            {item.salePrice != null ? Number(item.salePrice).toLocaleString() : "N/A"}
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
  const [viewListingsModalVisible, setViewListingsModalVisible] = useState(false);
  const [userListings, setUserListings] = useState([]);

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
          Alert.alert("Error fetching location", "Ensure location services are enabled.");
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
  useEffect(() => {
    if (user) {
      const collectionName = "listings";
      const q = selectedCategory
        ? query(
            collection(db, collectionName),
            where("category", "==", selectedCategory),
            orderBy("createdAt", "desc")
          )
        : query(collection(db, collectionName), orderBy("createdAt", "desc"));
      const unsubscribe = onSnapshot(
        q,
        (querySnapshot) => {
          const listingsData = [];
          querySnapshot.forEach((doc) => {
            listingsData.push({ id: doc.id, ...doc.data() });
          });
          setListings(listingsData);
        },
        (error) => {
          console.error("Error fetching listings:", error);
          Alert.alert("Error", "Failed to fetch listings.");
        }
      );
      return () => unsubscribe();
    } else {
      setListings([]);
      setFilteredListings([]);
    }
  }, [selectedCategory, user]);

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
  useEffect(() => {
    let updated = [...listings];
    if (filter.location) {
      updated = updated.filter((listing) => {
        let locField = "";
        switch (selectedCategory) {
          case "Aircraft for Sale":
          case "Aviation Jobs":
          case "Flight Schools":
            locField = listing.city || "";
            break;
          default:
            locField = listing.city || "";
        }
        return locField.toLowerCase().includes(filter.location);
      });
    }
    if (selectedCategory === "Aircraft for Sale" && filter.make) {
      updated = updated.filter((listing) => {
        let makeField = listing.title || "";
        return makeField.toLowerCase().includes(filter.make);
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
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permissionResult.granted) {
      Alert.alert("Permission Required", "Permission to access the camera roll is required!");
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
          const imageName = `${new Date().getTime()}-${Math.floor(Math.random() * 1000)}.jpg`;
          const storageReference = storageRef(storage, `listingImages/${imageName}`);
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
          backgroundColor: remainingUploads > 0 ? COLORS.primary : COLORS.lightGray,
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
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permissionResult.granted) {
      Alert.alert("Permission Required", "Permission to access the camera roll is required!");
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
        const imageName = `profile-${new Date().getTime()}-${Math.floor(Math.random() * 1000)}.jpg`;
        const storageReference = storageRef(storage, `profileImages/${imageName}`);
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
      Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) * Math.sin(dLon / 2) ** 2;
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
        const distance = getDistanceFromLatLonInMiles(userLat, userLng, lat, lng);
        return distance <= radiusMiles;
      }
      return false;
    });
    setFilteredListings(filtered);
  };

  const handleListingPress = (listing) => {
    closeAllModals();
    setSelectedListing(listing);
    if (listing.category === "Aviation Jobs") setJobDetailsModalVisible(true);
    else setDetailsModalVisible(true);
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
      const subject = encodeURIComponent(`Inquiry about ${selectedListing.title || "Your Listing"}`);
      const mailUrl = `mailto:${contactEmail}?subject=${subject}`;
      Linking.openURL(mailUrl).catch((error) => {
        console.error("Error opening mail app:", error);
        Alert.alert("Error", "Unable to open mail app.");
      });
    } else {
      Alert.alert("Error", "Contact email not available.");
    }
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
                    Alert.alert("Listing Deleted", "Your listing has been deleted successfully.");
                  } else {
                    response.text().then((text) => {
                      try {
                        const data = JSON.parse(text);
                        Alert.alert("Error", data.error || "Failed to delete listing.");
                      } catch (err) {
                        console.error("Error parsing deleteListing error data:", err);
                        Alert.alert("Error", "Failed to delete listing. " + text);
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
      location: location ? { lat: location.coords.latitude, lng: location.coords.longitude } : {},
    };

    listingDetails.selectedPricing = selectedPricing || "Basic";

    if (listingDetails.category === "Flight Instructors") {
      listingDetails.profileImage = profileImage;
      delete listingDetails.salePrice;
    }

    if (listingDetails.category === "Flight Schools") {
      const { flightSchoolEmail, flightSchoolName, flightSchoolLocation, flightSchoolPhone, flightSchoolDescription } = listingDetails;
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
      const { charterServiceEmail, charterServiceName, charterServiceLocation, charterServicePhone, charterServiceDescription, charterServiceAreas } = listingDetails;
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

    if (editingListing) {
      console.log("Updating listing with payload:", { listingId: editingListing.id, listingDetails });
      getFirebaseIdToken().then((token) => {
        fetch(`${API_URL}/updateListing`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ listingId: editingListing.id, listingDetails }),
        })
          .then((response) => {
            if (response.ok) {
              Alert.alert("Listing Updated", "Your listing has been updated successfully.");
              closeAllModals();
              setEditingListing(null);
              setImages([]);
            } else {
              response.text().then((text) => {
                try {
                  const data = JSON.parse(text);
                  Alert.alert("Error", data.error || "Failed to update listing.");
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
              Alert.alert("Listing Created", "Your listing has been posted for free for 7 days!");
              closeAllModals();
              setEditingListing(null);
              setImages([]);
            } else {
              response.text().then((text) => {
                try {
                  const data = JSON.parse(text);
                  Alert.alert("Error", data.error || "Failed to create listing.");
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
      console.log("Navigating to classifiedsPaymentScreen with payload:", { listingDetails, selectedCategory, selectedPricing });
      navigation.navigate("classifiedsPaymentScreen", { listingDetails, selectedCategory, selectedPricing });
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
      Animated.spring(scaleValue, { toValue: 1, friction: 5, useNativeDriver: true }).start();
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
      <SafeAreaView style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: COLORS.white }}>
        <ActivityIndicator size="large" color={COLORS.primary} accessibilityLabel="Loading indicator" />
        <Text style={{ marginTop: 10, color: COLORS.black }}>Loading...</Text>
      </SafeAreaView>
    );
  }
  if (!user) {
    return (
      <SafeAreaView style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: COLORS.white, padding: 16 }}>
        <Text style={{ fontSize: 18, color: COLORS.black, marginBottom: 20, textAlign: "center" }}>
          You need to be signed in to view classifieds. Please sign in or create an account.
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
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], {
          useNativeDriver: false,
        })}
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
            style={{ width: SCREEN_WIDTH, height: "100%", justifyContent: "flex-start" }}
            resizeMode="cover"
          >
            <Animated.View style={{ paddingHorizontal: 16, paddingTop: headerPaddingTop, paddingBottom: 20 }}>
              <Animated.Text style={{ color: COLORS.white, fontWeight: "bold", fontSize: headerFontSize }} accessibilityLabel="Greeting Text">
                Welcome
              </Animated.Text>
              <Animated.Text style={{ color: COLORS.white, fontWeight: "bold", fontSize: headerFontSize }} accessibilityLabel="User Name">
                {user.displayName}
              </Animated.Text>
            </Animated.View>
          </ImageBackground>
        </Animated.View>

        {/* New "View your listings" button */}
        <View style={{ flexDirection: "row", justifyContent: "center", marginBottom: 8 }}>
          <TouchableOpacity
            onPress={() => setViewListingsModalVisible(true)}
            style={{ flexDirection: "row", alignItems: "center" }}
            accessibilityLabel="View your listings"
            accessibilityRole="button"
          >
            <Ionicons name="list" size={24} color={COLORS.primary} style={{ marginRight: 8 }} />
            <Text style={{ fontSize: 16, color: COLORS.primary, textDecorationLine: "underline" }}>
              View your listings
            </Text>
          </TouchableOpacity>
        </View>

        <Text style={{ fontSize: 28, fontWeight: "bold", marginBottom: 16, textAlign: "center", color: COLORS.black }}>
          Aviation Marketplace
        </Text>

        <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 16 }}>
          <Text style={{ fontSize: 18, color: COLORS.secondary }}>
            Filter by Location
            {selectedCategory === "Aircraft for Sale" ? " or Aircraft Make" : ""}
          </Text>
          <TouchableOpacity
            onPress={() => {
              closeAllModals();
              setFilterModalVisible(true);
            }}
            style={{ backgroundColor: COLORS.lightGray, padding: 8, borderRadius: 50 }}
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
            "Charter Services"
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
                backgroundColor: selectedCategory === item ? COLORS.primary : COLORS.lightGray,
              }}
              accessibilityLabel={`Select category ${item}`}
              accessibilityRole="button"
            >
              <Text style={{ fontSize: 14, fontWeight: "bold", color: selectedCategory === item ? COLORS.white : COLORS.black }}>
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
          style={{ backgroundColor: COLORS.primary, padding: 12, borderRadius: 8, marginBottom: 16, alignItems: "center" }}
          accessibilityLabel="Add a Listing"
          accessibilityRole="button"
        >
          <Text style={{ color: COLORS.white, fontSize: 16, fontWeight: "bold" }}>
            Add a Listing
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => setBrokerModalVisible(true)}
          style={{ marginBottom: 16, flexDirection: "row", alignItems: "center", justifyContent: "center" }}
          accessibilityLabel="Information about Broker Services"
          accessibilityRole="button"
        >
          <Ionicons name="mail-outline" size={20} color={COLORS.primary} style={{ marginRight: 8 }} />
          <Text style={{ color: COLORS.primary, textDecorationLine: "underline", fontSize: 16 }}>
            Information about Broker Services
          </Text>
        </TouchableOpacity>

        {filteredListings.length > 0 ? (
          filteredListings.map((item, index) => (
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
                }}
              >
                {(item.packageType === "Featured" || item.packageType === "Enhanced") && (
                  <View style={styles.featuredTag}>
                    <Text style={styles.featuredTagText}>
                      {item.packageType} Listing
                    </Text>
                  </View>
                )}

                <TouchableOpacity
                  onPress={() => handleListingPress(item)}
                  style={{ flex: 1, padding: 10 }}
                  accessibilityLabel={`View details of listing ${
                    item.category === "Flight Instructors" ? `${item.firstName} ${item.lastName}` : item.title || "Listing"
                  }`}
                  accessibilityRole="button"
                >
                  {item.category === "Flight Instructors" ? (
                    <View style={{ flexDirection: "row", alignItems: "center" }}>
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
                        <Text style={{ fontSize: 18, fontWeight: "bold", color: COLORS.black }}>
                          {item.firstName} {item.lastName}
                        </Text>
                        <Text style={{ fontSize: 14, color: COLORS.gray }}>
                          CFI #{item.certifications || "N/A"}
                        </Text>
                        {item.serviceLocationsList &&
                          item.serviceLocationsList.length > 0 && (
                            <View style={{ marginTop: 5 }}>
                              <Text style={{ fontSize: 14, color: COLORS.gray }}>
                                {item.serviceLocationsList.join(", ")}
                              </Text>
                            </View>
                          )}
                      </View>
                    </View>
                  ) : (
                    <>
                      {item.images && item.images.length > 0 ? (
                        renderListingImages(item, true, null)
                      ) : (
                        <Text style={{ textAlign: "center", color: COLORS.gray, marginTop: 10, padding: 10 }}>
                          No Images Available
                        </Text>
                      )}
                      {item.title ? (
                        <Text style={{ fontSize: 18, fontWeight: "bold", color: COLORS.black, marginTop: 10 }}>
                          {item.title}
                        </Text>
                      ) : null}
                      {renderListingDetails(item)}
                    </>
                  )}
                </TouchableOpacity>

                {renderEditAndDeleteButtons(item)}
              </View>
              {(index + 1) % 17 === 0 && (
                <View>
                  <Text style={{ textAlign: "center", color: COLORS.gray }}>
                    Google Ad Placeholder
                  </Text>
                </View>
              )}
            </React.Fragment>
          ))
        ) : (
          <Text style={{ textAlign: "center", color: COLORS.gray }}>
            No listings available
          </Text>
        )}
      </Animated.ScrollView>

      {showUpButton && (
        <TouchableOpacity
          onPress={() => scrollViewRef.current?.scrollTo({ y: 0, animated: true })}
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
              Our Aircraft Broker Services connect buyers and sellers with trusted aviation professionals who specialize in aircraft acquisitions and sales. Whether you're looking to purchase, sell, or trade an aircraft, our experienced brokers provide personalized guidance, market analysis, and negotiation support to ensure a seamless and secure transaction from start to finish.
            </Text>
            <TouchableOpacity
              onPress={() => {
                setBrokerModalVisible(false);
                const subject = encodeURIComponent("Information About Broker Services");
                const mailtoUrl = `mailto:coryarmer@gmail.com?subject=${subject}`;
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
              style={{ position: "absolute", top: 10, right: 10 }}
              onPress={() => setJobDetailsModalVisible(false)}
              accessibilityLabel="Close Job Details Modal"
              accessibilityRole="button"
            >
              <Ionicons name="close" size={30} color={COLORS.white} />
            </TouchableOpacity>
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
                <Ionicons name="location-outline" size={20} color={COLORS.white} />
                <Text
                  style={{
                    fontSize: 16,
                    color: COLORS.white,
                    marginLeft: 5,
                  }}
                >
                  {selectedListing?.city || "No City"}, {selectedListing?.state || "No State"}
                </Text>
              </View>
            </View>
            <Text style={{ fontSize: 16, color: COLORS.white, marginBottom: 20 }}>
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
              <Text style={{ color: COLORS.white, fontSize: 16 }}>Apply Now</Text>
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
                selectedListing?.category === "Charter Services") &&
                selectedListing?.images &&
                selectedListing.images.length > 0 && (
                  <View style={{ marginBottom: 16 }}>
                    {renderListingImages(selectedListing, false, handleImagePress)}
                    {renderPaginationDots()}
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
                  ? selectedListing?.flightSchoolDetails?.flightSchoolName || "No Flight School Name"
                  : selectedListing?.category === "Flight Instructors"
                  ? `${selectedListing?.firstName} ${selectedListing?.lastName}`
                  : selectedListing?.category === "Charter Services"
                  ? selectedListing?.charterServiceDetails?.charterServiceName || "No Charter Service Name"
                  : selectedListing?.flightSchoolName || selectedListing?.title || "No Title"}
              </Text>
              {selectedListing?.category === "Flight Instructors" ? (
                renderListingDetails(selectedListing)
              ) : selectedListing?.category === "Flight Schools" ? (
                <>
                  <View style={styles.centeredRow}>
                    <Ionicons name="location-outline" size={20} color={COLORS.white} />
                    <Text
                      style={{
                        fontSize: 16,
                        color: COLORS.white,
                        marginLeft: 5,
                      }}
                    >
                      {selectedListing?.flightSchoolDetails?.flightSchoolLocation || "No Location Provided"}
                    </Text>
                  </View>
                  <Text style={{ color: COLORS.white, fontSize: 16, marginTop: 10 }}>
                    Email: {selectedListing?.flightSchoolDetails?.flightSchoolEmail || "N/A"}
                  </Text>
                  <Text style={{ color: COLORS.white, fontSize: 16, marginTop: 5 }}>
                    Phone: {formatPhoneNumber(selectedListing?.flightSchoolDetails?.flightSchoolPhone)}
                  </Text>
                </>
              ) : selectedListing?.category === "Charter Services" ? (
                <>
                  <View style={styles.centeredRow}>
                    <Ionicons name="location-outline" size={20} color={COLORS.white} />
                    <Text
                      style={{
                        fontSize: 16,
                        color: COLORS.white,
                        marginLeft: 5,
                      }}
                    >
                      {selectedListing?.charterServiceDetails?.charterServiceLocation || "No Location Provided"}
                    </Text>
                  </View>
                  <Text style={{ color: COLORS.white, fontSize: 16, marginTop: 10 }}>
                    Email: {selectedListing?.charterServiceDetails?.charterServiceEmail || "N/A"}
                  </Text>
                  <Text style={{ color: COLORS.white, fontSize: 16, marginTop: 5 }}>
                    Phone: {formatPhoneNumber(selectedListing?.charterServiceDetails?.charterServicePhone)}
                  </Text>
                  {selectedListing?.charterServiceDetails?.charterServiceAreas && (
                    <Text style={{ color: COLORS.white, fontSize: 16, marginTop: 5 }}>
                      Service Areas: {selectedListing?.charterServiceDetails?.charterServiceAreas}
                    </Text>
                  )}
                  <Text style={{ color: COLORS.white, fontSize: 16, marginTop: 5 }}>
                    {selectedListing?.charterServiceDetails?.charterServiceDescription || "No Description Provided"}
                  </Text>
                </>
              ) : (
                <>
                  <View style={styles.centeredRow}>
                    <Ionicons name="location-outline" size={20} color={COLORS.white} />
                    <Text style={{ fontSize: 16, color: COLORS.white, marginLeft: 5 }}>
                      {selectedListing?.city || "No City"}, {selectedListing?.state || "No State"}
                    </Text>
                  </View>
                  <Text style={{ color: COLORS.white, fontSize: 16, marginTop: 10 }}>
                    Email: {selectedListing?.email || "N/A"}
                  </Text>
                  <Text style={{ color: COLORS.white, fontSize: 16, marginTop: 5 }}>
                    Phone: {formatPhoneNumber(selectedListing?.phone)}
                  </Text>
                  <Text style={{ color: COLORS.white, fontSize: 16, marginTop: 5 }}>
                    Tail Number: {selectedListing?.tailNumber || "N/A"}
                  </Text>
                  <Text style={{ color: COLORS.white, fontSize: 16, marginTop: 5 }}>
                    Price: ${selectedListing?.salePrice != null ? Number(selectedListing.salePrice).toLocaleString() : "N/A"}
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
                      ? selectedListing?.flightSchoolDetails?.flightSchoolDescription || "No Description Provided"
                      : selectedListing?.flightSchoolDescription || selectedListing?.description || "No Description"}
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

      {/* Submit Your Listing Modal */}
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
                      editingListing && editingListing.category === "Flight Instructors"
                        ? editingListing.firstName || ""
                        : "",
                    lastName:
                      editingListing && editingListing.category === "Flight Instructors"
                        ? editingListing.lastName || ""
                        : "",
                    certifications:
                      editingListing && editingListing.category === "Flight Instructors"
                        ? editingListing.certifications || ""
                        : "",
                    flightHours:
                      editingListing?.category === "Flight Instructors" &&
                      editingListing?.flightHours != null
                        ? String(editingListing?.flightHours)
                        : "",
                    fiEmail:
                      editingListing && editingListing.category === "Flight Instructors"
                        ? editingListing.email || ""
                        : "",
                    fiPhone:
                      editingListing && editingListing.category === "Flight Instructors"
                        ? editingListing.phone || ""
                        : "",
                    fiDescription:
                      editingListing && editingListing.category === "Flight Instructors"
                        ? editingListing.description || ""
                        : "",
                    serviceLocationsList:
                      editingListing && editingListing.category === "Flight Instructors"
                        ? editingListing.serviceLocationsList || []
                        : [],
                    newServiceLocation: "",
                    hourlyRate:
                      editingListing?.category === "Flight Instructors" &&
                      editingListing?.hourlyRate != null
                        ? String(editingListing?.hourlyRate)
                        : "",
                    aircraftProvided:
                      editingListing && editingListing.category === "Flight Instructors"
                        ? editingListing.aircraftProvided || false
                        : false,
                    profileImage:
                      editingListing && editingListing.category === "Flight Instructors"
                        ? editingListing.profileImage || ""
                        : "",
                    // Aviation Mechanic
                    amFirstName:
                      editingListing && editingListing.category === "Aviation Mechanic"
                        ? editingListing.firstName || ""
                        : "",
                    amLastName:
                      editingListing && editingListing.category === "Aviation Mechanic"
                        ? editingListing.lastName || ""
                        : "",
                    amCertifications:
                      editingListing && editingListing.category === "Aviation Mechanic"
                        ? editingListing.certifications || ""
                        : "",
                    amEmail:
                      editingListing && editingListing.category === "Aviation Mechanic"
                        ? editingListing.email || ""
                        : "",
                    amPhone:
                      editingListing && editingListing.category === "Aviation Mechanic"
                        ? editingListing.phone || ""
                        : "",
                    amDescription:
                      editingListing && editingListing.category === "Aviation Mechanic"
                        ? editingListing.description || ""
                        : "",
                    amServiceLocations:
                      editingListing && editingListing.category === "Aviation Mechanic"
                        ? editingListing.serviceLocations || ""
                        : "",
                    // Flight Schools
                    flightSchoolName:
                      editingListing && editingListing.category === "Flight Schools"
                        ? editingListing.flightSchoolDetails?.flightSchoolName || ""
                        : "",
                    flightSchoolLocation:
                      editingListing && editingListing.category === "Flight Schools"
                        ? editingListing.flightSchoolDetails?.flightSchoolLocation || ""
                        : "",
                    flightSchoolEmail:
                      editingListing && editingListing.category === "Flight Schools"
                        ? editingListing.flightSchoolDetails?.flightSchoolEmail || ""
                        : "",
                    flightSchoolPhone:
                      editingListing && editingListing.category === "Flight Schools"
                        ? editingListing.flightSchoolDetails?.flightSchoolPhone || ""
                        : "",
                    flightSchoolDescription:
                      editingListing && editingListing.category === "Flight Schools"
                        ? editingListing.flightSchoolDetails?.flightSchoolDescription || ""
                        : "",
                    // Aviation Jobs
                    companyName:
                      editingListing && editingListing.category === "Aviation Jobs"
                        ? editingListing.companyName || ""
                        : "",
                    jobTitle:
                      editingListing && editingListing.category === "Aviation Jobs"
                        ? editingListing.jobTitle || ""
                        : "",
                    salary:
                      editingListing && editingListing.category === "Aviation Jobs"
                        ? editingListing.salary || ""
                        : "",
                    jobDescription:
                      editingListing && editingListing.category === "Aviation Jobs"
                        ? editingListing.jobDescription || ""
                        : "",
                    email:
                      editingListing && editingListing.category === "Aviation Jobs"
                        ? editingListing.email || ""
                        : "",
                    phone:
                      editingListing && editingListing.category === "Aviation Jobs"
                        ? editingListing.phone || ""
                        : "",
                    // Aircraft for Sale
                    title:
                      editingListing && editingListing.category === "Aircraft for Sale"
                        ? editingListing.title || ""
                        : "",
                    tailNumber:
                      editingListing && editingListing.category === "Aircraft for Sale"
                        ? editingListing.tailNumber || ""
                        : "",
                    salePrice:
                      editingListing?.category === "Aircraft for Sale" &&
                      editingListing?.salePrice != null
                        ? String(editingListing?.salePrice)
                        : "",
                    description:
                      editingListing && editingListing.category === "Aircraft for Sale"
                        ? editingListing.description || ""
                        : "",
                    city:
                      editingListing && editingListing.category === "Aircraft for Sale"
                        ? editingListing.city || ""
                        : "",
                    state:
                      editingListing && editingListing.category === "Aircraft for Sale"
                        ? editingListing.state || ""
                        : "",
                    email:
                      editingListing && editingListing.category === "Aircraft for Sale"
                        ? editingListing.email || ""
                        : "",
                    phone:
                      editingListing && editingListing.category === "Aircraft for Sale"
                        ? editingListing.phone || ""
                        : "",
                    // Charter Services fields
                    charterServiceName:
                      editingListing && editingListing.category === "Charter Services"
                        ? editingListing.charterServiceDetails?.charterServiceName || ""
                        : "",
                    charterServiceLocation:
                      editingListing && editingListing.category === "Charter Services"
                        ? editingListing.charterServiceDetails?.charterServiceLocation || ""
                        : "",
                    charterServiceEmail:
                      editingListing && editingListing.category === "Charter Services"
                        ? editingListing.charterServiceDetails?.charterServiceEmail || ""
                        : "",
                    charterServicePhone:
                      editingListing && editingListing.category === "Charter Services"
                        ? editingListing.charterServiceDetails?.charterServicePhone || ""
                        : "",
                    charterServiceDescription:
                      editingListing && editingListing.category === "Charter Services"
                        ? editingListing.charterServiceDetails?.charterServiceDescription || ""
                        : "",
                    charterServiceAreas:
                      editingListing && editingListing.category === "Charter Services"
                        ? editingListing.charterServiceDetails?.charterServiceAreas || ""
                        : "",
                    selectedPricing: selectedPricing || "Basic",
                    packageCost: selectedPricing ? pricingPackages[selectedPricing] || 0 : 0,
                    category: editingListing ? editingListing.category || selectedCategory : selectedCategory,
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
                        errors.certifications = "CFI Certification Number is required.";
                      if (!values.fiEmail) {
                        errors.fiEmail = "Contact email is required.";
                      } else if (!/\S+@\S+\.\S+/.test(values.fiEmail)) {
                        errors.fiEmail = "Invalid email address.";
                      }
                      if (!values.fiDescription)
                        errors.fiDescription = "Description is required.";
                      if (!values.serviceLocationsList || values.serviceLocationsList.length === 0) {
                        errors.serviceLocationsList = "At least one service location is required.";
                      }
                      if (!values.hourlyRate)
                        errors.hourlyRate = "Hourly rate is required.";
                      else if (isNaN(Number(values.hourlyRate))) {
                        errors.hourlyRate = "Hourly rate must be a valid number.";
                      }
                    } else if (category === "Aviation Mechanic") {
                      if (!values.amFirstName)
                        errors.amFirstName = "First name is required.";
                      if (!values.amLastName)
                        errors.amLastName = "Last name is required.";
                      if (!values.amCertifications)
                        errors.amCertifications = "Certifications are required.";
                      if (!values.amEmail) {
                        errors.amEmail = "Contact email is required.";
                      } else if (!/\S+@\S+\.\S+/.test(values.amEmail)) {
                        errors.amEmail = "Invalid email address.";
                      }
                      if (!values.amDescription)
                        errors.amDescription = "Description is required.";
                      if (!values.amServiceLocations)
                        errors.amServiceLocations = "Service locations are required.";
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
                        errors.flightSchoolName = "Flight School Name is required.";
                      if (!values.flightSchoolLocation)
                        errors.flightSchoolLocation = "Flight School Location is required.";
                      if (!values.flightSchoolEmail) {
                        errors.flightSchoolEmail = "Contact email is required.";
                      } else if (!/\S+@\S+\.\S+/.test(values.flightSchoolEmail)) {
                        errors.flightSchoolEmail = "Invalid email address.";
                      }
                      if (!values.flightSchoolDescription)
                        errors.flightSchoolDescription = "Description is required.";
                    } else if (category === "Charter Services") {
                      if (!values.charterServiceName)
                        errors.charterServiceName = "Charter Service Name is required.";
                      if (!values.charterServiceLocation)
                        errors.charterServiceLocation = "Charter Service Location is required.";
                      if (!values.charterServiceEmail) {
                        errors.charterServiceEmail = "Contact email is required.";
                      } else if (!/\S+@\S+\.\S+/.test(values.charterServiceEmail)) {
                        errors.charterServiceEmail = "Invalid email address.";
                      }
                    } else {
                      if (!values.title) errors.title = "Title is required.";
                      if (!values.description) errors.description = "Description is required.";
                      if (!values.salePrice) errors.salePrice = "Sale Price is required.";
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
                  {({ handleChange, handleBlur, handleSubmit, values, errors, touched, setFieldValue }) => (
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
                                {values.serviceLocationsList && values.serviceLocationsList.length > 0 ? (
                                  values.serviceLocationsList.map((loc, index) => (
                                    <View
                                      key={index}
                                      style={{
                                        flexDirection: "row",
                                        alignItems: "center",
                                        marginBottom: 8,
                                      }}
                                    >
                                      <Text style={{ flex: 1, color: COLORS.black }}>
                                        {loc}
                                      </Text>
                                      <TouchableOpacity
                                        onPress={() => arrayHelpers.remove(index)}
                                        accessibilityLabel={`Remove service location ${loc}`}
                                        accessibilityRole="button"
                                      >
                                        <Ionicons name="close-circle" size={24} color={COLORS.red} />
                                      </TouchableOpacity>
                                    </View>
                                  ))
                                ) : (
                                  <Text style={{ color: COLORS.gray, marginBottom: 8 }}>
                                    No service locations added.
                                  </Text>
                                )}
                                <View style={{ flexDirection: "row", alignItems: "center" }}>
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
                                    onChangeText={handleChange("newServiceLocation")}
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
                                        arrayHelpers.push(values.newServiceLocation.trim());
                                        setFieldValue("newServiceLocation", "");
                                      }
                                    }}
                                    style={{ marginLeft: 8 }}
                                    accessibilityLabel="Add Service Location"
                                    accessibilityRole="button"
                                  >
                                    <Ionicons name="add-circle-outline" size={24} color={COLORS.primary} />
                                  </TouchableOpacity>
                                </View>
                                {touched.serviceLocationsList && errors.serviceLocationsList && (
                                  <Text style={{ color: "red", marginBottom: 8 }}>
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
                            <Text style={{ flex: 1, color: COLORS.black, fontSize: 16 }}>
                              Aircraft provided by CFI
                            </Text>
                            <Switch
                              value={values.aircraftProvided}
                              onValueChange={(value) => setFieldValue("aircraftProvided", value)}
                              thumbColor={COLORS.primary}
                              trackColor={{ false: COLORS.lightGray, true: COLORS.primary }}
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
                                <Ionicons name="close-circle" size={24} color={COLORS.red} />
                              </TouchableOpacity>
                            </View>
                          ) : null}
                          <TouchableOpacity
                            onPress={() => pickProfileImage(setFieldValue)}
                            style={{
                              backgroundColor: values.profileImage ? COLORS.lightGray : COLORS.primary,
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
                                color: values.profileImage ? COLORS.black : COLORS.white,
                              }}
                            >
                              {values.profileImage ? "Profile Image Uploaded" : "Add Profile Image"}
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
                          {touched.amCertifications && errors.amCertifications && (
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
                          {touched.amServiceLocations && errors.amServiceLocations && (
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
                          {touched.flightSchoolName && errors.flightSchoolName && (
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
                          {touched.flightSchoolLocation && errors.flightSchoolLocation && (
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
                          {touched.flightSchoolEmail && errors.flightSchoolEmail && (
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
                            onChangeText={handleChange("flightSchoolDescription")}
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
                          {touched.flightSchoolDescription && errors.flightSchoolDescription && (
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
                          {touched.charterServiceName && errors.charterServiceName && (
                            <Text style={{ color: "red", marginBottom: 8 }}>
                              {errors.charterServiceName}
                            </Text>
                          )}
                          <TextInput
                            placeholder="Charter Service Location"
                            placeholderTextColor={COLORS.gray}
                            onChangeText={handleChange("charterServiceLocation")}
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
                          {touched.charterServiceLocation && errors.charterServiceLocation && (
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
                          {touched.charterServiceEmail && errors.charterServiceEmail && (
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
                            onChangeText={handleChange("charterServiceDescription")}
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
                          {touched.charterServiceDescription && errors.charterServiceDescription && (
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
                        <View style={{ flexDirection: "row", justifyContent: "space-around" }}>
                          {Object.keys(pricingPackages).map((packageType) => (
                            <View key={packageType} style={{ alignItems: "center", width: "30%" }}>
                              <TouchableOpacity
                                onPress={() =>
                                  setPricingModalVisible((prev) => ({ ...prev, [packageType]: true }))
                                }
                                style={{ marginBottom: 4 }}
                                accessibilityLabel={`View details for ${packageType} package`}
                                accessibilityRole="button"
                              >
                                <Ionicons
                                  name="information-circle-outline"
                                  size={24}
                                  color={selectedPricing === packageType ? COLORS.primary : COLORS.black}
                                />
                              </TouchableOpacity>
                              <TouchableOpacity
                                onPress={() => {
                                  setSelectedPricing(packageType);
                                  setFieldValue("selectedPricing", packageType);
                                  setFieldValue("packageCost", pricingPackages[packageType]);
                                }}
                                style={{
                                  padding: 10,
                                  borderRadius: 8,
                                  backgroundColor: selectedPricing === packageType ? COLORS.primary : COLORS.lightGray,
                                  alignItems: "center",
                                }}
                                accessibilityLabel={`Select ${packageType} package`}
                                accessibilityRole="button"
                              >
                                <Text
                                  style={{
                                    color: selectedPricing === packageType ? COLORS.white : COLORS.black,
                                    fontWeight: "bold",
                                  }}
                                >
                                  {packageType}
                                </Text>
                                {((packageType === "Basic" && (values.category === "Aircraft for Sale" || values.category === "Flight Schools")) ||
                                  (packageType === "Flight Instructors" && values.category === "Flight Instructors") ||
                                  (packageType === "Aviation Mechanic" && values.category === "Aviation Mechanic") ||
                                  (packageType === "Charter Services" && values.category === "Charter Services")) ? (
                                  <Text
                                    style={{ color: selectedPricing === packageType ? COLORS.white : COLORS.black }}
                                  >
                                    <Text style={{ textDecorationLine: "line-through" }}>
                                      ${pricingPackages[packageType]}
                                    </Text>{" "}
                                    Free for 7 days
                                  </Text>
                                ) : (
                                  <Text
                                    style={{ color: selectedPricing === packageType ? COLORS.white : COLORS.black }}
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
                          accessibilityLabel={editingListing ? "Save" : "Proceed to pay"}
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
                        <Text style={{ textAlign: "center", color: COLORS.black }}>
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
              <Text style={{ textAlign: "center" }}>No preview data available.</Text>
            )}
          </ScrollView>
        </SafeAreaView>
      </Modal>

      <FullScreenImageModal
        visible={fullScreenModalVisible}
        onRequestClose={() => setFullScreenModalVisible(false)}
        imageUri={zoomImageUri}
      />

      {/* Filter Modal: Added back to allow filtering by location or aircraft make/type */}
      <Modal
        visible={filterModalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setFilterModalVisible(false)}
      >
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "rgba(0,0,0,0.5)" }}>
          <View style={{ width: "80%", backgroundColor: COLORS.white, borderRadius: 10, padding: 20 }}>
            <Text style={{ fontSize: 20, fontWeight: "bold", marginBottom: 10 }}>Filter Listings</Text>
            <TextInput
              placeholder="Enter City or State"
              placeholderTextColor={COLORS.gray}
              value={cityState}
              onChangeText={setCityState}
              style={{ borderBottomWidth: 1, borderBottomColor: COLORS.lightGray, marginBottom: 20, padding: 8, color: COLORS.black }}
              accessibilityLabel="City or State Filter Input"
            />
            {selectedCategory === "Aircraft for Sale" && (
              <TextInput
                placeholder="Enter Aircraft Make/Model"
                placeholderTextColor={COLORS.gray}
                value={makeModel}
                onChangeText={setMakeModel}
                style={{ borderBottomWidth: 1, borderBottomColor: COLORS.lightGray, marginBottom: 20, padding: 8, color: COLORS.black }}
                accessibilityLabel="Aircraft Make/Model Filter Input"
              />
            )}
            <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
              <TouchableOpacity onPress={clearFilter} style={{ padding: 10, backgroundColor: COLORS.red, borderRadius: 8 }}>
                <Text style={{ color: COLORS.white }}>Clear</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={applyFilter} style={{ padding: 10, backgroundColor: COLORS.primary, borderRadius: 8 }}>
                <Text style={{ color: COLORS.white }}>Apply Filter</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
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
                renderItem={({ item }) => (
                  <View
                    style={{
                      borderWidth: 1,
                      borderColor: COLORS.lightGray,
                      borderRadius: 8,
                      padding: 8,
                      marginBottom: 8,
                    }}
                  >
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
                    <View
                      style={{
                        flexDirection: "row",
                        justifyContent: "space-around",
                        marginTop: 8,
                      }}
                    >
                      <TouchableOpacity
                        onPress={() => {
                          handleEditListing(item);
                          setViewListingsModalVisible(false);
                        }}
                        style={{
                          backgroundColor: COLORS.primary,
                          padding: 8,
                          borderRadius: 8,
                        }}
                        accessibilityLabel="Edit Listing"
                        accessibilityRole="button"
                      >
                        <Text style={{ color: COLORS.white }}>Edit</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => {
                          handleDeleteListing(item.id);
                          setViewListingsModalVisible(false);
                        }}
                        style={{
                          backgroundColor: COLORS.red,
                          padding: 8,
                          borderRadius: 8,
                        }}
                        accessibilityLabel="Delete Listing"
                        accessibilityRole="button"
                      >
                        <Text style={{ color: COLORS.white }}>Delete</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                )}
              />
            ) : (
              <Text style={{ textAlign: "center", color: COLORS.gray }}>
                You haven't posted any listings yet.
              </Text>
            )}
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
              setPricingModalVisible((prev) => ({ ...prev, [packageType]: false }))
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
              <View style={{ width: "80%", backgroundColor: "#fff", borderRadius: 10, padding: 20 }}>
                <TouchableOpacity
                  onPress={() =>
                    setPricingModalVisible((prev) => ({ ...prev, [packageType]: false }))
                  }
                  style={{ position: "absolute", top: 10, right: 10 }}
                  accessibilityLabel={`Close ${packageType} info modal`}
                  accessibilityRole="button"
                >
                  <Ionicons name="close" size={24} color="#000" />
                </TouchableOpacity>
                <Text style={{ fontWeight: "bold", fontSize: 18, marginBottom: 10 }}>
                  {packageType} Package Details
                </Text>
                {packageType === "Basic" && (
                  <Text style={{ marginBottom: 10 }}>
                    The Basic package includes a standard listing with a set number of images. Great option for those wanting an affordable way to reach buyers.
                  </Text>
                )}
                {packageType === "Featured" && (
                  <Text style={{ marginBottom: 10 }}>
                    The Featured package provides increased visibility, highlighting your listing among others and allowing for more images.
                  </Text>
                )}
                {packageType === "Enhanced" && (
                  <Text style={{ marginBottom: 10 }}>
                    The Enhanced package grants maximum exposure on the marketplace and includes the highest image limit and premier placement.
                  </Text>
                )}
                {packageType === "Flight Instructors" && (
                  <Text style={{ marginBottom: 10 }}>
                    A specialized listing package tailored for Flight Instructors to showcase ratings, experience, and service locations.
                  </Text>
                )}
                {packageType === "Aviation Mechanic" && (
                  <Text style={{ marginBottom: 10 }}>
                    A specialized listing package for Aviation Mechanics to advertise certifications, locations, and specialized services.
                  </Text>
                )}
                {packageType === "Charter Services" && (
                  <Text style={{ marginBottom: 10 }}>
                    A premier listing option specifically designed for Charter Services to highlight unique routes, services, and fleet capabilities.
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
  <NavigationContainer independent={true}>
    <Stack.Navigator initialRouteName="Classifieds">
      <Stack.Screen name="Classifieds" component={Classifieds} options={{ headerShown: false }} />
      <Stack.Screen name="classifiedsPaymentScreen" component={classifiedsPaymentScreen} options={{ headerShown: false }} />
    </Stack.Navigator>
  </NavigationContainer>
);

export default AppNavigator;

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
});
