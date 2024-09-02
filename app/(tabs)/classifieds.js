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
  StatusBar,
  Platform,
  KeyboardAvoidingView,
  ActivityIndicator,
} from "react-native";
import { useUser } from "@clerk/clerk-expo";
import { db, storage } from "../../firebaseConfig"; // Ensure you import storage for Firebase Storage
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
import { Ionicons } from "@expo/vector-icons";
import wingtipClouds from "../../Assets/images/wingtip_clouds.jpg";
import * as ImagePicker from "expo-image-picker";
import { Formik } from "formik";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage"; // Firebase storage functions

const Classifieds = () => {
  const { user } = useUser();
  const [listings, setListings] = useState([]);
  const [filteredListings, setFilteredListings] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState("");
  const [modalVisible, setModalVisible] = useState(false);
  const [paymentModalVisible, setPaymentModalVisible] = useState(false);
  const [detailsModalVisible, setDetailsModalVisible] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [contactModalVisible, setContactModalVisible] = useState(false);
  const [images, setImages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedPricing, setSelectedPricing] = useState("Basic");
  const [totalCost, setTotalCost] = useState(0);
  const [listingDetails, setListingDetails] = useState({});
  const [selectedListing, setSelectedListing] = useState(null);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [rentalHours, setRentalHours] = useState(1);
  const [costDetails, setCostDetails] = useState({
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

  const pricingPackages = {
    Basic: 25,
    Featured: 70,
    Enhanced: 150,
  };

  const scrollY = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (user) {
      getLatestItemList();
      autoDeleteExpiredListings();
    }
  }, [user]);

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
      const q = query(
        collection(db, "UserPost"),
        where("userEmail", "==", user.primaryEmailAddress.emailAddress),
        orderBy("createdAt", "desc")
      );
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

  const pickImage = async () => {
    if (images.length >= 7) {
      Alert.alert("You can only upload up to 7 images.");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 4],
      quality: 1,
    });

    if (!result.canceled) {
      setImages([...images, result.uri]);
    }
  };

  const onSubmitMethod = (values) => {
    setLoading(true);
    const selectedPackagePrice = pricingPackages[selectedPricing];
    const totalWithTax = (selectedPackagePrice * 1.0825).toFixed(2);
    setTotalCost(totalWithTax);
    setListingDetails(values);
    setPaymentModalVisible(true);
  };

  const handleCompletePayment = async () => {
    try {
      setLoading(true); // Start loading spinner

      // Upload images first and get their URLs
      const uploadedImages = await Promise.all(
        images.map(async (imageUri) => {
          try {
            const response = await fetch(imageUri);
            const blob = await response.blob();
            const storageRef = ref(storage, `aircraftImages/${new Date().getTime()}_${user.id}`);
            const snapshot = await uploadBytes(storageRef, blob);
            return await getDownloadURL(snapshot.ref);
          } catch (error) {
            if (__DEV__) {
              // If in development mode, log the error and return the local URI
              console.error("Error uploading image: ", error);
              Alert.alert(
                "Development Mode",
                "Error uploading image. This will render in development mode, but you must fix this error before deploying."
              );
              return imageUri;
            } else {
              throw error; // In production, propagate the error
            }
          }
        })
      );

      // Prepare the listing with the uploaded image URLs
      const newListing = {
        ...listingDetails,
        price: listingDetails.price,
        category: selectedCategory,
        images: uploadedImages, // Set the uploaded image URLs
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

      // Save the listing in Firestore
      await addDoc(collection(db, "UserPost"), newListing);

      Alert.alert(
        "Payment Completed",
        "Your listing has been successfully submitted!"
      );
      setPaymentModalVisible(false);
      setModalVisible(false);
      getLatestItemList();
    } catch (error) {
      console.error("Error completing payment: ", error);
      Alert.alert("Error", "Failed to complete payment and submit listing.");
    } finally {
      setLoading(false); // Stop loading spinner
    }
  };

  const handleListingPress = (listing) => {
    setSelectedListing(listing);
    setCurrentImageIndex(0);
    setDetailsModalVisible(true);
  };

  const handleEditListing = () => {
    setEditModalVisible(true);
    setDetailsModalVisible(false);
  };

  const handleDeleteListing = async () => {
    try {
      await deleteDoc(doc(db, "UserPost", selectedListing.id));
      Alert.alert("Listing Deleted", "Your listing has been deleted.");
      setDetailsModalVisible(false);
      getLatestItemList();
    } catch (error) {
      console.error("Error deleting listing: ", error);
      Alert.alert("Error", "Failed to delete listing.");
    }
  };

  const calculateTotalCost = (hours) => {
    if (!selectedListing) return;

    const pricePerHour = parseFloat(selectedListing.price);
    const rentalCost = pricePerHour * hours;
    const bookingFee = rentalCost * 0.06;
    const transactionFee = rentalCost * 0.03;
    const salesTax = rentalCost * 0.0825;
    const total = rentalCost + bookingFee + transactionFee + salesTax;

    setCostDetails({
      rentalCost: rentalCost.toFixed(2),
      bookingFee: bookingFee.toFixed(2),
      transactionFee: transactionFee.toFixed(2),
      salesTax: salesTax.toFixed(2),
      total: total.toFixed(2),
    });
  };

  useEffect(() => {
    if (selectedListing && rentalHours > 0) {
      calculateTotalCost(rentalHours);
    }
  }, [selectedListing, rentalHours]);

  const renderCategoryItem = ({ item }) => (
    <TouchableOpacity
      key={item}
      onPress={() => setSelectedCategory(item)}
      style={{
        padding: 8,
        backgroundColor:
          selectedCategory === item ? "#a0aec0" : "#e2e8f0",
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
        <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 16 }}>
          <Text style={{ fontSize: 18, color: "#4A4A4A" }}>
            Filter by location or Aircraft Make
          </Text>
          <TouchableOpacity
            onPress={() => setModalVisible(true)}
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
            style={{ color: "white", textAlign: "center", fontWeight: "bold" }}
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
              <View style={{ flexDirection: "row", justifyContent: "flex-end", marginTop: 8 }}>
                <TouchableOpacity
                  onPress={handleEditListing}
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
                  onPress={handleDeleteListing}
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

                <Formik
                  initialValues={{
                    title: "",
                    price: "",
                    description: "",
                    city: "",
                    state: "",
                    email: "",
                    phone: "",
                    category: selectedCategory || "Single Engine Piston",
                    images: [],
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

                      <Text
                        style={{
                          marginBottom: 8,
                          color: "#2d3748",
                          fontWeight: "bold",
                        }}
                      >
                        Category
                      </Text>
                      <FlatList
                        data={categories}
                        renderItem={renderCategoryItem}
                        horizontal
                        keyExtractor={(item) => item}
                        showsHorizontalScrollIndicator={false}
                        style={{ marginBottom: 16 }}
                        nestedScrollEnabled={true}
                      />

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
                          {images.length >= 7
                            ? "Maximum 7 Images"
                            : "Add Image"}
                        </Text>
                      </TouchableOpacity>

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
                                selectedPricing === key
                                  ? "#3182ce"
                                  : "#cbd5e0",
                            }}
                          >
                            <Text style={{ textAlign: "center" }}>{key}</Text>
                            <Text style={{ textAlign: "center" }}>
                              ${pricingPackages[key]}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>

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

      {/* Listing Details Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={detailsModalVisible}
        onRequestClose={() => setDetailsModalVisible(false)}
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
            }}
          >
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
              }}
            >
              <TouchableOpacity
                onPress={() =>
                  setCurrentImageIndex(
                    (currentImageIndex - 1 + selectedListing.images.length) %
                      selectedListing.images.length
                  )
                }
                style={{ padding: 8 }}
              >
                <Ionicons name="arrow-back-circle" size={32} color="#4a5568" />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() =>
                  setCurrentImageIndex(
                    (currentImageIndex + 1) % selectedListing.images.length
                  )
                }
                style={{ padding: 8 }}
              >
                <Ionicons
                  name="arrow-forward-circle"
                  size={32}
                  color="#4a5568"
                />
              </TouchableOpacity>
            </View>
            {selectedListing && (
              <>
                <Text
                  style={{
                    fontSize: 20,
                    fontWeight: "bold",
                    marginBottom: 16,
                  }}
                >
                  {selectedListing.title}
                </Text>
                <Image
                  source={{ uri: selectedListing.images[currentImageIndex] }}
                  style={{
                    width: "100%",
                    height: 256,
                    borderRadius: 8,
                    marginBottom: 16,
                  }}
                />
                <ScrollView style={{ height: 256 }}>
                  <Text style={{ fontSize: 18, marginBottom: 8 }}>
                    Price: ${selectedListing.price}
                  </Text>
                  <Text style={{ fontSize: 18, marginBottom: 8 }}>
                    Description: {selectedListing.description}
                  </Text>
                  <Text style={{ fontSize: 18, marginBottom: 8 }}>
                    Location: {selectedListing.city}, {selectedListing.state}
                  </Text>
                </ScrollView>
                <View
                  style={{
                    flexDirection: "row",
                    justifyContent: "space-between",
                    marginTop: 16,
                  }}
                >
                  <TouchableOpacity
                    onPress={handleEditListing}
                    style={{
                      backgroundColor: "#48bb78",
                      padding: 12,
                      borderRadius: 8,
                    }}
                  >
                    <Text style={{ color: "white", textAlign: "center" }}>
                      Edit
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={handleDeleteListing}
                    style={{
                      backgroundColor: "#f56565",
                      padding: 12,
                      borderRadius: 8,
                    }}
                  >
                    <Text style={{ color: "white", textAlign: "center" }}>
                      Delete
                    </Text>
                  </TouchableOpacity>
                </View>
                <TouchableOpacity
                  onPress={() => setDetailsModalVisible(false)}
                  style={{ marginTop: 16 }}
                >
                  <Text style={{ textAlign: "center", color: "#a0aec0" }}>
                    Close
                  </Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

export default Classifieds;
