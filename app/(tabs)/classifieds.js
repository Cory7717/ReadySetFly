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
} from "react-native";
import { useUser } from "@clerk/clerk-expo";
import { db, storage } from "../../firebaseConfig";
import {
  collection,
  getDocs,
  orderBy,
  addDoc,
  query,
  where,
  updateDoc,
  doc,
  deleteDoc,
} from "firebase/firestore";
import * as Location from "expo-location";
import { Ionicons } from "@expo/vector-icons";
import wingtipClouds from "../../Assets/images/wingtip_clouds.jpg";
import * as ImagePicker from "expo-image-picker";
import { Formik } from "formik";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { useStripe } from "@stripe/stripe-react-native";
import { API_URL } from "@env";

const Classifieds = () => {
  const { user } = useUser();
  const { initPaymentSheet, presentPaymentSheet } = useStripe();
  const [listings, setListings] = useState([]);
  const [filteredListings, setFilteredListings] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState("");
  const [modalVisible, setModalVisible] = useState(false);
  const [filterModalVisible, setFilterModalVisible] = useState(false);
  const [detailsModalVisible, setDetailsModalVisible] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [paymentModalVisible, setPaymentModalVisible] = useState(false);
  const [paymentScreenVisible, setPaymentScreenVisible] = useState(false); // To manage the visibility of the Payment Screen
  const [images, setImages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedPricing, setSelectedPricing] = useState("Basic");
  const [totalCost, setTotalCost] = useState(0);
  const [listingDetails, setListingDetails] = useState({});
  const [selectedListing, setSelectedListing] = useState(null);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [location, setLocation] = useState(null);

  const categories = ["Aircraft for Sale", "Aviation Jobs", "Flight Schools"];

  const defaultPricingPackages = {
    Basic: 25,
    Featured: 70,
    Enhanced: 150,
  };

  const [pricingPackages, setPricingPackages] = useState(defaultPricingPackages);

  const scrollY = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    (async () => {
      try {
        // Request foreground location permission
        let { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          // Permission not granted, show an alert
          Alert.alert(
            'Location Permission Denied',
            'Please enable location services in your device settings.'
          );
          return;
        }

        // Check if location services are enabled
        let locationServicesEnabled = await Location.hasServicesEnabledAsync();
        if (!locationServicesEnabled) {
          // Location services are not enabled, show an alert
          Alert.alert(
            'Location Services Disabled',
            'Please enable location services to use this feature.'
          );
          return;
        }

        // Fetch current location
        let currentLocation = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.High,
        });
        setLocation(currentLocation);
      } catch (error) {
        console.error('Error fetching location:', error);
        Alert.alert(
          'Error Fetching Location',
          'Could not retrieve your current location. Please try again later.'
        );
      }

      getLatestItemList();
    })();
  }, [user]);

  useEffect(() => {
    if (selectedCategory === "Aviation Jobs") {
      setPricingPackages({
        Basic: 15, // $15/week for Aviation Jobs
      });
      setSelectedPricing("Basic");
    } else if (selectedCategory === "Flight Schools") {
      setPricingPackages({
        Basic: 250, // $250/month for Flight Schools
      });
      setSelectedPricing("Basic");
    } else {
      setPricingPackages(defaultPricingPackages); // Reset to default pricing options for other categories
      setSelectedPricing("Basic");
    }
  }, [selectedCategory]);

  const autoDeleteExpiredListings = async () => {
    const q = query(collection(db, "UserPost"));
    const querySnapshot = await getDocs(q);

    const currentTime = new Date();

    querySnapshot.forEach(async (document) => {
      const listing = document.data();
      const createdAt = listing.createdAt ? listing.createdAt.toDate() : null;

      if (createdAt) {
        const expiryDate = new Date(createdAt);
        expiryDate.setDate(
          expiryDate.getDate() + (listing.pricingPackageDuration || 0) + 3
        );

        if (currentTime > expiryDate) {
          await deleteDoc(document.ref);
        }
      }
    });

    getLatestItemList();
  };

  const getLatestItemList = async () => {
    try {
      let q = query(collection(db, "UserPost"), orderBy("createdAt", "desc"));

      if (selectedCategory) {
        q = query(
          collection(db, "UserPost"),
          where("category", "==", selectedCategory),
          orderBy("createdAt", "desc")
        );
      }

      const querySnapShot = await getDocs(q);
      const listingsData = [];
      querySnapShot.forEach((doc) => {
        listingsData.push({ id: doc.id, ...doc.data() });
      });

      setListings(listingsData);
      setFilteredListings(listingsData);
    } catch (error) {
      console.error("Error fetching listings: ", error);
      Alert.alert("Error", "Failed to load listings. Please try again later.");
    }
  };

  useEffect(() => {
    getLatestItemList();
  }, [selectedCategory]);

  const pickImage = async () => {
    let maxImages =
      selectedPricing === "Basic" ? 7 : selectedPricing === "Featured" ? 12 : 16;
    if (images.length >= maxImages) {
      Alert.alert(`You can only upload up to ${maxImages} images.`);

      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true, // Allow multiple selection
      allowsEditing: false, // Disable allowsEditing to avoid warning
      aspect: [4, 4],
      quality: 1,
    });

    if (!result.canceled) {
      let selectedImages;
      if (result.selected) {
        // Handle case for multiple image selection
        selectedImages = result.selected.map((asset) => asset.uri);
      } else {
        // Handle case for single image selection
        selectedImages = [result.uri];
      }
      setImages([...images, ...selectedImages]);
    }
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

  const getDistanceFromLatLonInMiles = (lat1, lon1, lat2, lon2) => {
    const R = 3958.8;
    const dLat = deg2rad(lat2 - lat1);
    const dLon = deg2rad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c;
    return distance;
  };

  const deg2rad = (deg) => {
    return deg * (Math.PI / 180);
  };

  const fetchPaymentSheetParams = async () => {
    // Add this line to log the API_URL
    console.log("API_URL:", API_URL);
  
    const response = await fetch(`${API_URL}/payment-sheet`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ amount: totalCost * 100 }),
    });
  
    const { paymentIntent, ephemeralKey, customer } = await response.json();
  
    return {
      paymentIntent,
      ephemeralKey,
      customer,
    };
  };
  

  const initializePaymentSheet = async () => {
    try {
      const { paymentIntent, ephemeralKey, customer } =
        await fetchPaymentSheetParams();

      const { error } = await initPaymentSheet({
        merchantDisplayName: "Ready Set Fly",
        customerId: customer,
        customerEphemeralKeySecret: ephemeralKey,
        paymentIntentClientSecret: paymentIntent,
        allowsDelayedPaymentMethods: true,
        defaultBillingDetails: {
          name: user.fullName || "Guest",
        },
      });

      if (!error) {
        return true;
      } else {
        console.error("Payment Sheet initialization error:", error); // Log error
        Alert.alert("Error", "Failed to initialize payment sheet");
        return false;
      }
    } catch (error) {
      console.error("Error initializing payment sheet:", error); // Log error
      return false;
    }
  };

  const openPaymentModal = () => {
    setPaymentModalVisible(true);
  };

  const onSubmitMethod = async (values) => {
    setLoading(true);
    const selectedPackagePrice = pricingPackages[selectedPricing];
    const totalWithTax = (selectedPackagePrice * 1.0825).toFixed(2);
    setTotalCost(totalWithTax);
    setListingDetails(values);

    // Open the payment modal instead of navigating to another screen
    setPaymentModalVisible(true);
    setLoading(false);
  };

  const handleSubmitPayment = async () => {
    const isInitialized = await initializePaymentSheet();
    if (isInitialized) {
      setPaymentModalVisible(false); // Close the payment modal before showing the Stripe screen
      const { error } = await presentPaymentSheet();

      if (error) {
        Alert.alert("Payment Failed", error.message);
      } else {
        handleCompletePayment();
      }
    }
  };

  const handleCompletePayment = async () => {
    try {
      setLoading(true);

      const uploadedImages = await Promise.all(
        images.map(async (imageUri) => {
          try {
            const response = await fetch(imageUri);
            const blob = await response.blob();
            const storageRef = ref(
              storage,
              `classifiedImages/${new Date().getTime()}_${user.id}`
            );
            const snapshot = await uploadBytes(storageRef, blob);
            return await getDownloadURL(snapshot.ref);
          } catch (error) {
            if (__DEV__) {
              console.error("Error uploading image: ", error);
              Alert.alert(
                "Development Mode",
                "Error uploading image. This will render in development mode, but you must fix this error before deploying."
              );
              return imageUri;
            } else {
              throw error;
            }
          }
        })
      );

      const newListing = {
        ...listingDetails,
        category: selectedCategory,
        images: uploadedImages,
        userEmail: user.primaryEmailAddress.emailAddress,
        contactEmail: listingDetails.email,
        contactPhone: listingDetails.phone,
        createdAt: new Date(),
        pricingPackage: selectedPricing,
        pricingPackageDuration:
          selectedPricing === "Basic"
            ? 7
            : selectedPricing === "Featured"
            ? 14
            : 30,
        totalCost,
      };

      await addDoc(collection(db, "UserPost"), newListing);

      Alert.alert(
        "Payment Completed",
        "Your listing has been successfully submitted!"
      );
      setPaymentScreenVisible(false); // Close the Stripe payment modal
      setModalVisible(false);
      getLatestItemList();
    } catch (error) {
      console.error("Error completing payment: ", error);
      Alert.alert("Error", "Failed to complete payment and submit listing.");
    } finally {
      setLoading(false);
    }
  };

  const handleListingPress = (listing) => {
    setSelectedListing(listing);
    setCurrentImageIndex(0);
    setDetailsModalVisible(true);
  };

  const handleEditListing = (listing) => {
    setSelectedListing(listing);
    setEditModalVisible(true);
  };

  const handleDeleteListing = async (listingId) => {
    try {
      await deleteDoc(doc(db, "UserPost", listingId));
      Alert.alert("Listing Deleted", "Your listing has been deleted.");
      getLatestItemList();
    } catch (error) {
      console.error("Error deleting listing: ", error);
      Alert.alert("Error", "Failed to delete the listing.");
    }
  };

  const renderCategoryItem = ({ item }) => (
    <TouchableOpacity
      key={item}
      onPress={() => setSelectedCategory(item)}
      style={{
        padding: 8,
        backgroundColor: selectedCategory === item ? "#a0aec0" : "#e2e8f0",
        borderRadius: 8,
        marginRight: 8,
      }}
    >
      <Text style={{ fontSize: 14, fontWeight: "bold" }}>{item}</Text>
    </TouchableOpacity>
  );

  const renderListingItem = ({ item }) => (
    <TouchableOpacity
      onPress={() => handleListingPress(item)}
      style={{
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        padding: 16,
        backgroundColor: "#e2e8f0",
        borderRadius: 8,
        marginBottom: 8,
      }}
    >
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 18, fontWeight: "bold" }}>{item.title}</Text>
        <Text>${item.price}</Text>
        <Text numberOfLines={4}>{item.description}</Text>
      </View>
      {item.images && item.images[0] && (
        <Image
          source={{ uri: item.images[0] }}
          style={{
            width: 96,
            height: 96,
            marginLeft: 12,
            borderRadius: 8,
          }}
        />
      )}
    </TouchableOpacity>
  );

  const goToNextImage = () => {
    if (
      selectedListing?.images &&
      currentImageIndex < selectedListing.images.length - 1
    ) {
      setCurrentImageIndex(currentImageIndex + 1);
    }
  };

  const goToPreviousImage = () => {
    if (currentImageIndex > 0) {
      setCurrentImageIndex(currentImageIndex - 1);
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
            }}
          >
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
            onPress={() => setFilterModalVisible(true)}
            style={{ backgroundColor: "#E2E2E2", padding: 8, borderRadius: 50 }}
          >
            <Ionicons name="filter" size={24} color="gray" />
          </TouchableOpacity>
        </View>

        <FlatList
          data={categories}
          renderItem={renderCategoryItem}
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
          Aircraft Marketplace
        </Text>

        <TouchableOpacity
          onPress={() => setModalVisible(true)}
          style={{
            backgroundColor: "#f56565",
            borderRadius: 50,
            paddingVertical: 12,
            marginBottom: 24,
          }}
        >
          <Text
            style={{
              color: "white",
              textAlign: "center",
              fontWeight: "bold",
            }}
          >
            Add Listing
          </Text>
        </TouchableOpacity>

        {filteredListings.length > 0 ? (
          filteredListings.map((item) => (
            <View style={{ marginBottom: 20 }} key={item.id}>
              <TouchableOpacity
                onPress={() => {
                  setSelectedListing(item);
                  setCurrentImageIndex(0);
                  setDetailsModalVisible(true);
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
                <ImageBackground
                  source={{ uri: item.images && item.images[0] }}
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
                      {item.city}, {item.state}
                    </Text>
                    <Text
                      style={{
                        backgroundColor: "#000000a0",
                        color: "white",
                        padding: 4,
                        borderRadius: 5,
                      }}
                    >
                      ${item.price}
                    </Text>
                  </View>
                </ImageBackground>
                <View style={{ padding: 10 }}>
                  <Text
                    style={{
                      fontSize: 18,
                      fontWeight: "bold",
                      color: "#2d3748",
                    }}
                  >
                    {item.title}
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
              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "flex-end",
                  marginTop: 8,
                }}
              >
                <TouchableOpacity
                  onPress={() => handleEditListing(item)}
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
            </View>
          ))
        ) : (
          <Text style={{ textAlign: "center", color: "#4a5568" }}>
            No listings available
          </Text>
        )}
      </Animated.ScrollView>

      {/* Full Screen Modal for Listing Details */}
      <Modal
        visible={detailsModalVisible}
        transparent={true}
        onRequestClose={() => setDetailsModalVisible(false)}
        animationType="slide"
      >
        <View style={{ flex: 1, backgroundColor: "rgba(0, 0, 0, 0.9)" }}>
          <SafeAreaView style={{ flex: 1 }}>
            <View
              style={{ flex: 1, justifyContent: "center", alignItems: "center" }}
            >
              {selectedListing?.images && (
                <View style={{ width: "90%", height: "70%" }}>
                  <Image
                    source={{ uri: selectedListing.images[currentImageIndex] }}
                    style={{
                      width: "100%",
                      height: "100%",
                      resizeMode: "contain",
                      marginBottom: 20,
                    }}
                  />
                  <View
                    style={{
                      flexDirection: "row",
                      justifyContent: "space-between",
                      marginTop: 20,
                    }}
                  >
                    <TouchableOpacity onPress={goToPreviousImage}>
                      <Ionicons name="arrow-back" size={36} color="white" />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={goToNextImage}>
                      <Ionicons name="arrow-forward" size={36} color="white" />
                    </TouchableOpacity>
                  </View>
                </View>
              )}
              <Text
                style={{
                  color: "white",
                  fontSize: 24,
                  fontWeight: "bold",
                  marginTop: 20,
                }}
              >
                {selectedListing?.title}
              </Text>
              <Text style={{ color: "white", fontSize: 18, marginTop: 10 }}>
                ${selectedListing?.price}
              </Text>
              <Text style={{ color: "white", fontSize: 16, marginTop: 10 }}>
                {selectedListing?.description}
              </Text>
              <TouchableOpacity
                style={{
                  marginTop: 30,
                  backgroundColor: "#f56565",
                  padding: 10,
                  borderRadius: 10,
                }}
                onPress={() => setDetailsModalVisible(false)}
              >
                <Text style={{ color: "white", fontSize: 16 }}>Close</Text>
              </TouchableOpacity>
            </View>
          </SafeAreaView>
        </View>
      </Modal>

      {/* Filter by Location Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={filterModalVisible}
        onRequestClose={() => setFilterModalVisible(false)}
      >
        <View
          style={{
            flex: 1,
            justifyContent: "center",
            alignItems: "center",
            backgroundColor: "rgba(0, 0, 0, 0.5)",
          }}
        >
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : "height"}
            style={{
              flex: 1,
              justifyContent: "center",
              alignItems: "center",
              width: "100%",
            }}
          >
            <ScrollView
              contentContainerStyle={{
                flexGrow: 1,
                justifyContent: "center",
                alignItems: "center",
              }}
              style={{ width: "100%", maxWidth: 320 }}
              nestedScrollEnabled={true}
            >
              <View
                style={{
                  backgroundColor: "white",
                  borderRadius: 24,
                  padding: 24,
                  width: "100%",
                  shadowColor: "#000",
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: 0.2,
                  shadowRadius: 8,
                }}
              >
                <Text
                  style={{
                    fontSize: 24,
                    fontWeight: "bold",
                    marginBottom: 24,
                    textAlign: "center",
                    color: "#2d3748",
                  }}
                >
                  Filter Listings
                </Text>

                <TouchableOpacity
                  onPress={() => filterListingsByDistance(100)}
                  style={{
                    backgroundColor: "#f56565",
                    paddingVertical: 12,
                    borderRadius: 50,
                    marginBottom: 12,
                  }}
                >
                  <Text
                    style={{
                      color: "white",
                      textAlign: "center",
                      fontWeight: "bold",
                    }}
                  >
                    View Listings Within 100 Miles
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => setFilteredListings(listings)}
                  style={{
                    backgroundColor: "#f56565",
                    paddingVertical: 12,
                    borderRadius: 50,
                    marginBottom: 12,
                  }}
                >
                  <Text
                    style={{
                      color: "white",
                      textAlign: "center",
                      fontWeight: "bold",
                    }}
                  >
                    View All Listings
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => setFilterModalVisible(false)}
                  style={{
                    marginTop: 16,
                    paddingVertical: 8,
                    borderRadius: 50,
                    backgroundColor: "#e2e8f0",
                  }}
                >
                  <Text style={{ textAlign: "center", color: "#2d3748" }}>
                    Cancel
                  </Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      {/* Submit Listing Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <View
          style={{
            flex: 1,
            justifyContent: "center",
            alignItems: "center",
            backgroundColor: "rgba(0, 0, 0, 0.5)",
          }}
        >
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : "height"}
            style={{
              flex: 1,
              justifyContent: "center",
              alignItems: "center",
              width: "100%",
            }}
          >
            <ScrollView
              contentContainerStyle={{
                flexGrow: 1,
                justifyContent: "center",
                alignItems: "center",
              }}
              style={{ width: "100%", maxWidth: 320 }}
              nestedScrollEnabled={true}
            >
              <View
                style={{
                  backgroundColor: "white",
                  borderRadius: 24,
                  padding: 24,
                  width: "100%",
                  shadowColor: "#000",
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: 0.2,
                  shadowRadius: 8,
                }}
              >
                <Text
                  style={{
                    fontSize: 24,
                    fontWeight: "bold",
                    marginBottom: 24,
                    textAlign: "center",
                    color: "#2d3748",
                  }}
                >
                  Submit Your Listing
                </Text>

                <Text
                  style={{
                    marginBottom: 8,
                    color: "#2d3748",
                    fontWeight: "bold",
                  }}
                >
                  Select Pricing Package
                </Text>
                <View
                  style={{
                    flexDirection: "row",
                    justifyContent: "space-between",
                    marginBottom: 16,
                  }}
                >
                  {Object.keys(pricingPackages).map((key) => (
                    <TouchableOpacity
                      key={key}
                      onPress={() => setSelectedPricing(key)}
                      style={{
                        padding: 8,
                        borderWidth: 1,
                        borderRadius: 8,
                        borderColor:
                          selectedPricing === key ? "#3182ce" : "#cbd5e0",
                      }}
                    >
                      <Text style={{ textAlign: "center" }}>{key}</Text>
                      <Text style={{ textAlign: "center" }}>
                        ${pricingPackages[key]}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <FlatList
                  data={categories}
                  renderItem={renderCategoryItem}
                  horizontal
                  keyExtractor={(item) => item}
                  showsHorizontalScrollIndicator={false}
                  style={{ marginBottom: 16 }}
                />

                <Formik
                  initialValues={{
                    title: "",
                    price: "",
                    description: "",
                    city: "",
                    state: "",
                    email: "",
                    phone: "",
                    companyName: "",
                    jobTitle: "",
                    jobDescription: "",
                    category: selectedCategory || "Single Engine Piston",
                    images: [],
                    flightSchoolName: "",
                    flightSchoolDetails: "",
                  }}
                  onSubmit={onSubmitMethod}
                >
                  {({
                    handleChange,
                    handleBlur,
                    handleSubmit,
                    values,
                  }) => (
                    <>
                      {selectedCategory === "Aviation Jobs" ? (
                        <>
                          <TextInput
                            placeholder="Company Name"
                            onChangeText={handleChange("companyName")}
                            onBlur={handleBlur("companyName")}
                            value={values.companyName}
                            style={{
                              borderBottomWidth: 1,
                              borderBottomColor: "#cbd5e0",
                              marginBottom: 16,
                              padding: 8,
                              color: "#2d3748",
                            }}
                          />
                          <TextInput
                            placeholder="Job Title"
                            onChangeText={handleChange("jobTitle")}
                            onBlur={handleBlur("jobTitle")}
                            value={values.jobTitle}
                            style={{
                              borderBottomWidth: 1,
                              borderBottomColor: "#cbd5e0",
                              marginBottom: 16,
                              padding: 8,
                              color: "#2d3748",
                            }}
                          />
                          <TextInput
                            placeholder="Job Description"
                            onChangeText={handleChange("jobDescription")}
                            onBlur={handleBlur("jobDescription")}
                            value={values.jobDescription}
                            multiline
                            numberOfLines={4}
                            style={{
                              borderBottomWidth: 1,
                              borderBottomColor: "#cbd5e0",
                              marginBottom: 16,
                              padding: 8,
                              color: "#2d3748",
                            }}
                          />
                        </>
                      ) : selectedCategory === "Flight Schools" ? (
                        <>
                          <TextInput
                            placeholder="Flight School Name"
                            onChangeText={handleChange("flightSchoolName")}
                            onBlur={handleBlur("flightSchoolName")}
                            value={values.flightSchoolName}
                            style={{
                              borderBottomWidth: 1,
                              borderBottomColor: "#cbd5e0",
                              marginBottom: 16,
                              padding: 8,
                              color: "#2d3748",
                            }}
                          />
                          <TextInput
                            placeholder="Flight School Details"
                            onChangeText={handleChange("flightSchoolDetails")}
                            onBlur={handleBlur("flightSchoolDetails")}
                            value={values.flightSchoolDetails}
                            multiline
                            numberOfLines={4}
                            style={{
                              borderBottomWidth: 1,
                              borderBottomColor: "#cbd5e0",
                              marginBottom: 16,
                              padding: 8,
                              color: "#2d3748",
                            }}
                          />
                        </>
                      ) : (
                        <>
                          <TextInput
                            placeholder="Aircraft Year/Make/Model"
                            onChangeText={handleChange("title")}
                            onBlur={handleBlur("title")}
                            value={values.title}
                            style={{
                              borderBottomWidth: 1,
                              borderBottomColor: "#cbd5e0",
                              marginBottom: 16,
                              padding: 8,
                              color: "#2d3748",
                            }}
                          />
                          <TextInput
                            placeholder="Price"
                            onChangeText={handleChange("price")}
                            onBlur={handleBlur("price")}
                            value={values.price}
                            keyboardType="default"
                            style={{
                              borderBottomWidth: 1,
                              borderBottomColor: "#cbd5e0",
                              marginBottom: 16,
                              padding: 8,
                              color: "#2d3748",
                            }}
                          />
                          <TextInput
                            placeholder="Description"
                            onChangeText={handleChange("description")}
                            onBlur={handleBlur("description")}
                            value={values.description}
                            multiline
                            numberOfLines={4}
                            style={{
                              borderBottomWidth: 1,
                              borderBottomColor: "#cbd5e0",
                              marginBottom: 16,
                              padding: 8,
                              color: "#2d3748",
                            }}
                          />
                        </>
                      )}

                      <TextInput
                        placeholder="City"
                        onChangeText={handleChange("city")}
                        onBlur={handleBlur("city")}
                        value={values.city}
                        style={{
                          borderBottomWidth: 1,
                          borderBottomColor: "#cbd5e0",
                          marginBottom: 16,
                          padding: 8,
                          color: "#2d3748",
                        }}
                      />
                      <TextInput
                        placeholder="State"
                        onChangeText={handleChange("state")}
                        onBlur={handleBlur("state")}
                        value={values.state}
                        style={{
                          borderBottomWidth: 1,
                          borderBottomColor: "#cbd5e0",
                          marginBottom: 16,
                          padding: 8,
                          color: "#2d3748",
                        }}
                      />
                      <TextInput
                        placeholder="Contact Email (Required)"
                        onChangeText={handleChange("email")}
                        onBlur={handleBlur("email")}
                        value={values.email}
                        keyboardType="email-address"
                        style={{
                          borderBottomWidth: 1,
                          borderBottomColor: "#cbd5e0",
                          marginBottom: 16,
                          padding: 8,
                          color: "#2d3748",
                        }}
                      />
                      <TextInput
                        placeholder="Phone Number (Optional)"
                        onChangeText={handleChange("phone")}
                        onBlur={handleBlur("phone")}
                        value={values.phone}
                        keyboardType="phone-pad"
                        style={{
                          borderBottomWidth: 1,
                          borderBottomColor: "#cbd5e0",
                          marginBottom: 16,
                          padding: 8,
                          color: "#2d3748",
                        }}
                      />

                      {selectedCategory !== "Aviation Jobs" && (
                        <>
                          <Text
                            style={{
                              marginBottom: 8,
                              marginTop: 16,
                              color: "#2d3748",
                              fontWeight: "bold",
                            }}
                          >
                            Upload Images
                          </Text>
                          <FlatList
                            data={images}
                            horizontal
                            renderItem={({ item, index }) => (
                              <Image
                                key={index}
                                source={{ uri: item }}
                                style={{
                                  width: 96,
                                  height: 96,
                                  marginRight: 8,
                                  borderRadius: 8,
                                }}
                              />
                            )}
                            keyExtractor={(item, index) => index.toString()}
                            nestedScrollEnabled={true}
                          />
                          <TouchableOpacity
                            onPress={pickImage}
                            style={{
                              backgroundColor: "#edf2f7",
                              paddingVertical: 8,
                              paddingHorizontal: 16,
                              borderRadius: 50,
                              marginTop: 8,
                              marginBottom: 16,
                            }}
                          >
                            <Text
                              style={{ textAlign: "center", color: "#2d3748" }}
                            >
                              {images.length >=
                              (selectedPricing === "Basic"
                                ? 7
                                : selectedPricing === "Featured"
                                ? 12
                                : 16)
                                ? `Maximum ${
                                    selectedPricing === "Basic"
                                      ? 7
                                      : selectedPricing === "Featured"
                                      ? 12
                                      : 16
                                  } Images`
                                : "Add Image"}
                            </Text>
                          </TouchableOpacity>
                        </>
                      )}

                      {loading ? (
                        <ActivityIndicator size="large" color="#FF5A5F" />
                      ) : (
                        <TouchableOpacity
                          onPress={handleSubmit}
                          style={{
                            backgroundColor: "#f56565",
                            paddingVertical: 12,
                            borderRadius: 50,
                          }}
                        >
                          <Text
                            style={{
                              color: "white",
                              textAlign: "center",
                              fontWeight: "bold",
                            }}
                          >
                            Submit Listing
                          </Text>
                        </TouchableOpacity>
                      )}
                    </>
                  )}
                </Formik>

                <TouchableOpacity
                  onPress={() => setModalVisible(false)}
                  style={{
                    marginTop: 16,
                    paddingVertical: 8,
                    borderRadius: 50,
                    backgroundColor: "#e2e8f0",
                  }}
                >
                  <Text style={{ textAlign: "center", color: "#2d3748" }}>
                    Cancel
                  </Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      {/* Payment Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={paymentModalVisible}
        onRequestClose={() => setPaymentModalVisible(false)}
      >
        <View
          style={{
            flex: 1,
            justifyContent: "center",
            alignItems: "center",
            backgroundColor: "rgba(0, 0, 0, 0.5)",
          }}
        >
          <View
            style={{
              backgroundColor: "white",
              borderRadius: 24,
              padding: 24,
              width: "90%",
              shadowColor: "#000",
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.2,
              shadowRadius: 8,
            }}
          >
            <Text
              style={{
                fontSize: 24,
                fontWeight: "bold",
                marginBottom: 16,
                textAlign: "center",
                color: "#2d3748",
              }}
            >
              Complete Payment
            </Text>

            <Text style={{ fontSize: 18, color: "#4A4A4A", marginBottom: 12 }}>
              Total Cost: ${totalCost}
            </Text>

            <TouchableOpacity
              onPress={handleSubmitPayment}
              style={{
                backgroundColor: "#f56565",
                paddingVertical: 12,
                borderRadius: 50,
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
                Proceed to Pay
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setPaymentModalVisible(false)}
              style={{
                backgroundColor: "#e2e8f0",
                paddingVertical: 12,
                borderRadius: 50,
                marginTop: 16,
              }}
            >
              <Text
                style={{
                  textAlign: "center",
                  fontWeight: "bold",
                  color: "#2d3748",
                }}
              >
                Cancel
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

export default Classifieds;
