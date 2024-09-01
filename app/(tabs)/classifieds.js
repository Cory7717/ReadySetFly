import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  Image,
  TextInput,
  TouchableOpacity,
  FlatList,
  ImageBackground,
  Modal,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ScrollView,
  StatusBar,
} from "react-native";
import { useUser } from "@clerk/clerk-expo";
import { db } from "../../firebaseConfig";
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
import { Formik } from "formik";
import * as ImagePicker from "expo-image-picker";
import { Ionicons } from "@expo/vector-icons";
import wingtipClouds from "../../Assets/images/wingtip_clouds.jpg";
import * as MailComposer from "expo-mail-composer";

const Classifieds = () => {
  const { user } = useUser();
  const [listings, setListings] = useState([]);
  const [filteredListings, setFilteredListings] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState("");
  const [modalVisible, setModalVisible] = useState(false);
  const [filterModalVisible, setFilterModalVisible] = useState(false);
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

  const [filter, setFilter] = useState({
    make: "",
    location: "",
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

  const applyFilter = () => {
    const lowerCaseMake = filter.make.toLowerCase();
    const lowerCaseLocation = filter.location.toLowerCase();

    const filteredData = listings.filter(
      (listing) =>
        listing.title.toLowerCase().includes(lowerCaseMake) &&
        (listing.city.toLowerCase().includes(lowerCaseLocation) ||
          listing.state.toLowerCase().includes(lowerCaseLocation))
    );

    setFilteredListings(filteredData);
    setFilterModalVisible(false);
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
      const newListing = {
        ...listingDetails,
        price: listingDetails.price,
        category: selectedCategory,
        images,
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
      setPaymentModalVisible(false);
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

  const handleSaveEdit = async (values) => {
    try {
      setLoading(true);

      const updatedListing = {
        ...values,
        images,
      };

      await updateDoc(doc(db, "UserPost", selectedListing.id), updatedListing);
      Alert.alert(
        "Listing Updated",
        "Your listing has been successfully updated."
      );
      setEditModalVisible(false);
      getLatestItemList();
    } catch (error) {
      console.error("Error updating listing: ", error);
      Alert.alert("Error", "Failed to update listing.");
    } finally {
      setLoading(false);
    }
  };

  const sendEmail = async (values) => {
    const { name, email, phone, description, location } = values;

    const emailOptions = {
      recipients: ["broker@example.com"],
      subject: "Contact Broker Form Submission",
      body: `Name: ${name}\nEmail: ${email}\nPhone: ${phone}\nDescription: ${description}\nLocation: ${location}`,
    };

    try {
      await MailComposer.composeAsync(emailOptions);
      Alert.alert("Message Sent", "Your message has been sent successfully.");
      setContactModalVisible(false);
    } catch (error) {
      console.error("Error sending email:", error);
      Alert.alert("Error", "Failed to send your message.");
    }
  };

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

  return (
    <View style={{ flex: 1, backgroundColor: "white" }}>
      <StatusBar
        barStyle="light-content"
        translucent={true}
        backgroundColor="transparent"
      />
      <ScrollView contentContainerStyle={{ paddingBottom: 16 }}>
        <ImageBackground
          source={wingtipClouds}
          style={{ height: 224 }}
          resizeMode="cover"
        >
          <View style={{ flex: 1, justifyContent: "center", padding: 16 }}>
            <Text style={{ fontSize: 14, color: "white" }}>Welcome</Text>
            <Text
              style={{
                fontSize: 18,
                fontWeight: "bold",
                color: "white",
                marginTop: 4,
              }}
            >
              {user?.fullName}
            </Text>
            <TouchableOpacity
              onPress={() => setContactModalVisible(true)}
              style={{
                backgroundColor: "white",
                opacity: 0.5,
                borderRadius: 50,
                paddingVertical: 8,
                paddingHorizontal: 16,
                marginTop: 8,
              }}
            >
              <Text style={{ color: "#2d3748", fontWeight: "bold" }}>
                Contact Broker
              </Text>
            </TouchableOpacity>
          </View>
        </ImageBackground>

        <View style={{ padding: 16 }}>
          {/* Filter Button */}
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              marginBottom: 16,
            }}
          >
            <Text style={{ fontSize: 18, color: "#2d3748" }}>
              Filter by location or Aircraft Make
            </Text>
            <TouchableOpacity
              onPress={() => setFilterModalVisible(true)}
              style={{
                backgroundColor: "#e2e8f0",
                padding: 8,
                borderRadius: 50,
              }}
            >
              <Ionicons name="filter" size={24} color="#4a5568" />
            </TouchableOpacity>
          </View>

          {/* Categories Slider */}
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
              color: "#2d3748",
              textAlign: "center",
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
            <FlatList
              data={filteredListings}
              renderItem={renderListingItem}
              keyExtractor={(item, index) => index.toString()}
              nestedScrollEnabled={true}
            />
          ) : (
            <Text style={{ textAlign: "center", color: "#4a5568" }}>
              No listings available
            </Text>
          )}
        </View>
      </ScrollView>

      {/* Filter Modal */}
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
          <View
            style={{
              backgroundColor: "white",
              borderRadius: 24,
              padding: 24,
              width: "90%",
              maxWidth: 320,
            }}
          >
            <Text
              style={{
                fontSize: 24,
                fontWeight: "bold",
                marginBottom: 16,
                textAlign: "center",
              }}
            >
              Filter Listings
            </Text>
            <TextInput
              placeholder="Aircraft Make"
              onChangeText={(value) => setFilter({ ...filter, make: value })}
              value={filter.make}
              style={{
                borderBottomWidth: 1,
                borderBottomColor: "#cbd5e0",
                marginBottom: 16,
                padding: 8,
              }}
            />
            <TextInput
              placeholder="Location (City, State or Airport Identifier)"
              onChangeText={(value) =>
                setFilter({ ...filter, location: value })
              }
              value={filter.location}
              style={{
                borderBottomWidth: 1,
                borderBottomColor: "#cbd5e0",
                marginBottom: 16,
                padding: 8,
              }}
            />
            <View
              style={{ flexDirection: "row", justifyContent: "space-between" }}
            >
              <TouchableOpacity
                onPress={() => setFilterModalVisible(false)}
                style={{
                  backgroundColor: "#e2e8f0",
                  padding: 12,
                  borderRadius: 8,
                }}
              >
                <Text style={{ textAlign: "center", color: "#4a5568" }}>
                  Cancel
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={applyFilter}
                style={{
                  backgroundColor: "#3182ce",
                  padding: 12,
                  borderRadius: 8,
                }}
              >
                <Text style={{ textAlign: "center", color: "white" }}>
                  Apply Filters
                </Text>
              </TouchableOpacity>
            </View>
          </View>
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
                  <Text
                    style={{ textAlign: "center", color: "#2d3748" }}
                  >
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
                  <Text
                    style={{ textAlign: "center", color: "#a0aec0" }}
                  >
                    Close
                  </Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </Modal>

      {/* Contact Broker Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={contactModalVisible}
        onRequestClose={() => setContactModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={{ flex: 1, justifyContent: "center", alignItems: "center" }}
        >
          <ScrollView
            contentContainerStyle={{
              flexGrow: 1,
              justifyContent: "center",
              alignItems: "center",
            }}
            style={{ width: "90%" }}
            nestedScrollEnabled={true}
          >
            <View
              style={{
                backgroundColor: "white",
                borderRadius: 16,
                padding: 24,
                width: "100%",
                maxWidth: 320,
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
                }}
              >
                Contact Broker
              </Text>

              <Formik
                initialValues={{
                  name: "",
                  email: "",
                  phone: "",
                  description: "",
                  location: "",
                }}
                onSubmit={sendEmail}
              >
                {({
                  handleChange,
                  handleBlur,
                  handleSubmit,
                  values,
                }) => (
                  <>
                    <TextInput
                      placeholder="Name"
                      onChangeText={handleChange("name")}
                      onBlur={handleBlur("name")}
                      value={values.name}
                      style={{
                        borderBottomWidth: 1,
                        borderBottomColor: "#cbd5e0",
                        marginBottom: 16,
                        padding: 8,
                      }}
                    />
                    <TextInput
                      placeholder="Email"
                      onChangeText={handleChange("email")}
                      onBlur={handleBlur("email")}
                      value={values.email}
                      keyboardType="email-address"
                      style={{
                        borderBottomWidth: 1,
                        borderBottomColor: "#cbd5e0",
                        marginBottom: 16,
                        padding: 8,
                      }}
                    />
                    <TextInput
                      placeholder="Phone Number"
                      onChangeText={handleChange("phone")}
                      onBlur={handleBlur("phone")}
                      value={values.phone}
                      keyboardType="phone-pad"
                      style={{
                        borderBottomWidth: 1,
                        borderBottomColor: "#cbd5e0",
                        marginBottom: 16,
                        padding: 8,
                      }}
                    />
                    <TextInput
                      placeholder="Brief Description of Aircraft"
                      onChangeText={handleChange("description")}
                      onBlur={handleBlur("description")}
                      value={values.description}
                      multiline
                      numberOfLines={3}
                      style={{
                        borderBottomWidth: 1,
                        borderBottomColor: "#cbd5e0",
                        marginBottom: 16,
                        padding: 8,
                      }}
                    />
                    <TextInput
                      placeholder="Location (Home Airport)"
                      onChangeText={handleChange("location")}
                      onBlur={handleBlur("location")}
                      value={values.location}
                      style={{
                        borderBottomWidth: 1,
                        borderBottomColor: "#cbd5e0",
                        marginBottom: 16,
                        padding: 8,
                      }}
                    />

                    {loading ? (
                      <ActivityIndicator size="large" color="#0000ff" />
                    ) : (
                      <TouchableOpacity
                        onPress={handleSubmit}
                        style={{
                          backgroundColor: "#3182ce",
                          padding: 12,
                          borderRadius: 8,
                        }}
                      >
                        <Text style={{ color: "white", textAlign: "center" }}>
                          Submit
                        </Text>
                      </TouchableOpacity>
                    )}

                    <TouchableOpacity
                      onPress={() => setContactModalVisible(false)}
                      style={{ marginTop: 16 }}
                    >
                      <Text
                        style={{ textAlign: "center", color: "#a0aec0" }}
                      >
                        Cancel
                      </Text>
                    </TouchableOpacity>
                  </>
                )}
              </Formik>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>

      {/* Edit Listing Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={editModalVisible}
        onRequestClose={() => setEditModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={{ flex: 1, justifyContent: "center", alignItems: "center" }}
        >
          <ScrollView
            contentContainerStyle={{
              flexGrow: 1,
              justifyContent: "center",
              alignItems: "center",
            }}
            style={{ width: "90%" }}
            nestedScrollEnabled={true}
          >
            <View
              style={{
                backgroundColor: "white",
                borderRadius: 16,
                padding: 24,
                width: "100%",
                maxWidth: 320,
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
                }}
              >
                Edit Your Listing
              </Text>

              <Formik
                initialValues={{
                  title: selectedListing?.title || "",
                  price: selectedListing?.price || "",
                  description: selectedListing?.description || "",
                  city: selectedListing?.city || "",
                  state: selectedListing?.state || "",
                  email: selectedListing?.email || "",
                  phone: selectedListing?.phone || "",
                  category:
                    selectedListing?.category || "Single Engine Piston",
                  images: selectedListing?.images || [],
                }}
                onSubmit={handleSaveEdit}
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
                      }}
                    />
                    <TextInput
                      placeholder="Description"
                      onChangeText={handleChange("description")}
                      onBlur={handleBlur("description")}
                      value={values.description}
                      multiline
                      style={{
                        borderBottomWidth: 1,
                        borderBottomColor: "#cbd5e0",
                        marginBottom: 16,
                        padding: 8,
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
                      }}
                    />

                    <Text style={{ marginBottom: 8 }}>Category</Text>
                    <FlatList
                      data={categories}
                      renderItem={renderCategoryItem}
                      horizontal
                      keyExtractor={(item) => item}
                      showsHorizontalScrollIndicator={false}
                      nestedScrollEnabled={true}
                    />

                    <Text
                      style={{ marginBottom: 8, marginTop: 16 }}
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
                            width: 80,
                            height: 80,
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
                        backgroundColor: "#e2e8f0",
                        padding: 8,
                        borderRadius: 8,
                        marginTop: 8,
                        marginBottom: 16,
                      }}
                    >
                      <Text style={{ textAlign: "center", color: "#2d3748" }}>
                        {images.length >= 7 ? "Maximum 7 Images" : "Add Image"}
                      </Text>
                    </TouchableOpacity>

                    {loading ? (
                      <ActivityIndicator size="large" color="#0000ff" />
                    ) : (
                      <TouchableOpacity
                        onPress={handleSubmit}
                        style={{
                          backgroundColor: "#3182ce",
                          padding: 12,
                          borderRadius: 8,
                        }}
                      >
                        <Text style={{ color: "white", textAlign: "center" }}>
                          Save Changes
                        </Text>
                      </TouchableOpacity>
                    )}

                    <TouchableOpacity
                      onPress={() => setEditModalVisible(false)}
                      style={{ marginTop: 16 }}
                    >
                      <Text
                        style={{ textAlign: "center", color: "#a0aec0" }}
                      >
                        Cancel
                      </Text>
                    </TouchableOpacity>
                  </>
                )}
              </Formik>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
};

export default Classifieds;
