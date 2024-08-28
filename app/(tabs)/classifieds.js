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
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
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

    querySnapshot.forEach(async (doc) => {
      const listing = doc.data();
      const createdAt = listing.createdAt ? listing.createdAt.toDate() : null;

      if (createdAt) {
        const expiryDate = new Date(createdAt);
        expiryDate.setDate(
          expiryDate.getDate() + (listing.pricingPackageDuration || 0) + 3
        );

        if (currentTime > expiryDate) {
          await deleteDoc(doc.ref);
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
      mediaTypes: ImagePicker.MediaTypeOptions.All,
      allowsEditing: true,
      aspect: [4, 4],
      quality: 1,
    });

    if (!result.canceled) {
      setImages([...images, result.assets[0].uri]);
    }
  };

  const onSubmitMethod = (values) => {
    setLoading(false);
    const selectedPackagePrice = pricingPackages[selectedPricing];
    const totalWithTax = (selectedPackagePrice * 1.0825).toFixed(2);
    setTotalCost(totalWithTax);
    setListingDetails(values);
    setPaymentModalVisible(true);
  };

  const handleCompletePayment = async () => {
    try {
      setLoading(true);

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
      recipients: ["coryarmer@gmail.com"],
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
      className={`p-2 ${
        selectedCategory === item ? "bg-gray-500" : "bg-gray-200"
      } rounded-md mr-2`}
    >
      <Text className="text-sm font-bold">{item}</Text>
    </TouchableOpacity>
  );

  const renderListingItem = ({ item }) => (
    <TouchableOpacity
      onPress={() => handleListingPress(item)}
      className="flex-row justify-between items-center p-4 bg-gray-200 rounded-md mb-2"
    >
      <View className="flex-1">
        <Text className="text-lg font-bold">{item.title}</Text>
        <Text>${item.price} per hour</Text>
        <Text numberOfLines={4}>{item.description}</Text>
      </View>
      {item.images && item.images[0] && (
        <Image
          source={{ uri: item.images[0] }}
          className="w-24 h-24 ml-3 rounded-lg"
        />
      )}
    </TouchableOpacity>
  );

  return (
    <SafeAreaView className="flex-1 bg-white">
      <ImageBackground
        source={wingtipClouds}
        className="h-56"
        resizeMode="cover"
      >
        <View className="flex-row justify-between items-center p-4">
          <View>
            <Text className="text-sm text-white">Welcome</Text>
            <Text className="text-lg font-bold text-white">
              {user?.fullName}
            </Text>
          </View>
          <TouchableOpacity
            onPress={() => setContactModalVisible(true)}
            className="bg-white bg-opacity-50 rounded-full px-4 py-2"
          >
            <Text className="text-gray-900">Contact Broker</Text>
          </TouchableOpacity>
        </View>
      </ImageBackground>

      <View className="flex-1 p-4">
        {/* Filter Button */}
        <View className="flex-row justify-between mb-4">
          <Text className="text-lg text-gray-800">
            Filter by location or Aircraft Make
          </Text>
          <TouchableOpacity
            onPress={() => setFilterModalVisible(true)}
            className="bg-gray-200 p-2 rounded-full"
          >
            <Ionicons name="filter" size={24} color="gray" />
          </TouchableOpacity>
        </View>

        {/* Categories Slider */}
        <FlatList
          data={categories}
          renderItem={renderCategoryItem}
          horizontal
          keyExtractor={(item) => item}
          showsHorizontalScrollIndicator={false}
          className="mb-4"
          nestedScrollEnabled={true}
        />

        <Text className="text-2xl font-bold mb-4 text-gray-900 text-center">
          Aircraft Marketplace
        </Text>

        <TouchableOpacity
          onPress={() => setModalVisible(true)}
          className="bg-red-500 rounded-full py-3 mb-6"
        >
          <Text className="text-white text-center font-bold">Add Listing</Text>
        </TouchableOpacity>

        {filteredListings.length > 0 ? (
          <FlatList
            data={filteredListings}
            renderItem={renderListingItem}
            keyExtractor={(item, index) => index.toString()}
            nestedScrollEnabled={true}
          />
        ) : (
          <Text className="text-center text-gray-700">No listings available</Text>
        )}
      </View>

      {/* Filter Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={filterModalVisible}
        onRequestClose={() => setFilterModalVisible(false)}
      >
        <View className="flex-1 justify-center items-center bg-black bg-opacity-50">
          <View className="bg-white rounded-3xl p-6 w-11/12 max-w-lg">
            <Text className="text-2xl font-bold mb-4 text-center">
              Filter Listings
            </Text>
            <TextInput
              placeholder="Aircraft Make"
              onChangeText={(value) => setFilter({ ...filter, make: value })}
              value={filter.make}
              className="border-b border-gray-300 mb-4 p-2"
            />
            <TextInput
              placeholder="Location (City, State or Airport Identifier)"
              onChangeText={(value) =>
                setFilter({ ...filter, location: value })
              }
              value={filter.location}
              className="border-b border-gray-300 mb-4 p-2"
            />
            <View className="flex-row justify-between">
              <TouchableOpacity
                onPress={() => setFilterModalVisible(false)}
                className="bg-gray-300 p-3 rounded-lg"
              >
                <Text className="text-center text-gray-700">Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={applyFilter}
                className="bg-blue-500 p-3 rounded-lg"
              >
                <Text className="text-center text-white">Apply Filters</Text>
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
        <View className="flex-1 justify-center items-center bg-black bg-opacity-50">
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : "height"}
            className="flex-1 justify-center items-center w-full"
          >
            <ScrollView className="w-full max-w-lg" nestedScrollEnabled={true}>
              <View className="bg-white rounded-3xl p-6 w-full shadow-xl">
                <Text className="text-2xl font-bold mb-6 text-center text-gray-900">
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
                        className="border-b border-gray-300 mb-4 p-2 text-gray-900"
                      />
                      <TextInput
                        placeholder="Price"
                        onChangeText={handleChange("price")}
                        onBlur={handleBlur("price")}
                        value={values.price}
                        keyboardType="default"
                        className="border-b border-gray-300 mb-4 p-2 text-gray-900"
                      />
                      <TextInput
                        placeholder="Description"
                        onChangeText={handleChange("description")}
                        onBlur={handleBlur("description")}
                        value={values.description}
                        multiline
                        numberOfLines={4}
                        className="border-b border-gray-300 mb-4 p-2 text-gray-900"
                      />
                      <TextInput
                        placeholder="City"
                        onChangeText={handleChange("city")}
                        onBlur={handleBlur("city")}
                        value={values.city}
                        className="border-b border-gray-300 mb-4 p-2 text-gray-900"
                      />
                      <TextInput
                        placeholder="State"
                        onChangeText={handleChange("state")}
                        onBlur={handleBlur("state")}
                        value={values.state}
                        className="border-b border-gray-300 mb-4 p-2 text-gray-900"
                      />
                      <TextInput
                        placeholder="Contact Email (Required)"
                        onChangeText={handleChange("email")}
                        onBlur={handleBlur("email")}
                        value={values.email}
                        keyboardType="email-address"
                        className="border-b border-gray-300 mb-4 p-2 text-gray-900"
                      />
                      <TextInput
                        placeholder="Phone Number (Optional)"
                        onChangeText={handleChange("phone")}
                        onBlur={handleBlur("phone")}
                        value={values.phone}
                        keyboardType="phone-pad"
                        className="border-b border-gray-300 mb-4 p-2 text-gray-900"
                      />

                      <Text className="mb-2">Category</Text>
                      <FlatList
                        data={categories}
                        renderItem={renderCategoryItem}
                        horizontal
                        keyExtractor={(item) => item}
                        showsHorizontalScrollIndicator={false}
                        className="mb-4"
                        nestedScrollEnabled={true}
                      />

                      <Text className="mb-2 mt-4 text-gray-900 font-bold">
                        Upload Images
                      </Text>
                      <FlatList
                        data={images}
                        horizontal
                        renderItem={({ item, index }) => (
                          <Image
                            key={index}
                            source={{ uri: item }}
                            className="w-24 h-24 mr-2 rounded-lg"
                          />
                        )}
                        keyExtractor={(item, index) => index.toString()}
                        nestedScrollEnabled={true}
                      />
                      <TouchableOpacity
                        onPress={pickImage}
                        className="bg-gray-100 py-2 px-4 rounded-full mt-2 mb-4"
                      >
                        <Text className="text-center text-gray-800">
                          {images.length >= 7
                            ? "Maximum 7 Images"
                            : "Add Image"}
                        </Text>
                      </TouchableOpacity>

                      <Text className="mb-2 text-gray-900 font-bold">
                        Select Pricing Package
                      </Text>
                      <View className="flex-row justify-between mb-4">
                        {Object.keys(pricingPackages).map((key) => (
                          <TouchableOpacity
                            key={key}
                            onPress={() => setSelectedPricing(key)}
                            className={`p-2 border rounded-lg ${
                              selectedPricing === key
                                ? "border-blue-500"
                                : "border-gray-300"
                            }`}
                          >
                            <Text className="text-center">{key}</Text>
                            <Text className="text-center">
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
                          className="bg-red-500 py-3 px-6 rounded-full"
                        >
                          <Text className="text-white text-center font-bold">
                            Submit Listing
                          </Text>
                        </TouchableOpacity>
                      )}
                    </>
                  )}
                </Formik>

                <TouchableOpacity
                  onPress={() => setModalVisible(false)}
                  className="mt-4 py-2 rounded-full bg-gray-200"
                >
                  <Text className="text-center text-gray-800">Cancel</Text>
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
        <View className="flex-1 justify-center items-center bg-black bg-opacity-50">
          <View className="bg-white rounded-3xl p-6 w-11/12">
            <View className="flex-row justify-between">
              <TouchableOpacity
                onPress={() =>
                  setCurrentImageIndex(
                    (currentImageIndex - 1 + selectedListing.images.length) %
                      selectedListing.images.length
                  )
                }
                className="p-2"
              >
                <Ionicons name="arrow-back-circle" size={32} color="gray" />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() =>
                  setCurrentImageIndex(
                    (currentImageIndex + 1) % selectedListing.images.length
                  )
                }
                className="p-2"
              >
                <Ionicons name="arrow-forward-circle" size={32} color="gray" />
              </TouchableOpacity>
            </View>
            {selectedListing && (
              <>
                <Text className="text-xl font-bold mb-4">
                  {selectedListing.title}
                </Text>
                <Image
                  source={{ uri: selectedListing.images[currentImageIndex] }}
                  className="w-full h-64 rounded-lg mb-4"
                />
                <ScrollView className="h-64">
                  <Text className="text-lg mb-2">
                    Price: ${selectedListing.price}
                  </Text>
                  <Text className="text-lg mb-2">
                    Description: {selectedListing.description}
                  </Text>
                  <Text className="text-lg mb-2">
                    Location: {selectedListing.city}, {selectedListing.state}
                  </Text>
                </ScrollView>
                <View className="flex-row justify-between mt-4">
                  <TouchableOpacity
                    onPress={handleEditListing}
                    className="bg-green-500 p-3 rounded-lg"
                  >
                    <Text className="text-white text-center">Edit</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={handleDeleteListing}
                    className="bg-red-500 p-3 rounded-lg"
                  >
                    <Text className="text-white text-center">Delete</Text>
                  </TouchableOpacity>
                </View>
                <TouchableOpacity
                  onPress={() => setDetailsModalVisible(false)}
                  className="mt-4"
                >
                  <Text className="text-center text-gray-500">Close</Text>
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
          className="flex-1 justify-center items-center"
        >
          <ScrollView
            contentContainerStyle={{
              flexGrow: 1,
              justifyContent: "center",
              alignItems: "center",
            }}
            className="w-11/12"
            nestedScrollEnabled={true}
          >
            <View className="bg-white rounded-lg p-6 w-full max-w-lg shadow-lg">
              <Text className="text-2xl font-bold mb-4 text-center">
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
                      className="border-b border-gray-300 mb-4 p-2"
                    />
                    <TextInput
                      placeholder="Email"
                      onChangeText={handleChange("email")}
                      onBlur={handleBlur("email")}
                      value={values.email}
                      keyboardType="email-address"
                      className="border-b border-gray-300 mb-4 p-2"
                    />
                    <TextInput
                      placeholder="Phone Number"
                      onChangeText={handleChange("phone")}
                      onBlur={handleBlur("phone")}
                      value={values.phone}
                      keyboardType="phone-pad"
                      className="border-b border-gray-300 mb-4 p-2"
                    />
                    <TextInput
                      placeholder="Brief Description of Aircraft"
                      onChangeText={handleChange("description")}
                      onBlur={handleBlur("description")}
                      value={values.description}
                      multiline
                      numberOfLines={3}
                      className="border-b border-gray-300 mb-4 p-2"
                    />
                    <TextInput
                      placeholder="Location (Home Airport)"
                      onChangeText={handleChange("location")}
                      onBlur={handleBlur("location")}
                      value={values.location}
                      className="border-b border-gray-300 mb-4 p-2"
                    />

                    {loading ? (
                      <ActivityIndicator size="large" color="#0000ff" />
                    ) : (
                      <TouchableOpacity
                        onPress={handleSubmit}
                        className="bg-blue-500 p-2 rounded-lg"
                      >
                        <Text className="text-white text-center">Submit</Text>
                      </TouchableOpacity>
                    )}

                    <TouchableOpacity
                      onPress={() => setContactModalVisible(false)}
                      className="mt-4"
                    >
                      <Text className="text-center text-gray-500">Cancel</Text>
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
          className="flex-1 justify-center items-center"
        >
          <ScrollView
            contentContainerStyle={{
              flexGrow: 1,
              justifyContent: "center",
              alignItems: "center",
            }}
            className="w-11/12"
            nestedScrollEnabled={true}
          >
            <View className="bg-white rounded-lg p-6 w-full max-w-lg shadow-lg">
              <Text className="text-2xl font-bold mb-4 text-center">
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
                      className="border-b border-gray-300 mb-4 p-2"
                    />
                    <TextInput
                      placeholder="Price"
                      onChangeText={handleChange("price")}
                      onBlur={handleBlur("price")}
                      value={values.price}
                      keyboardType="default"
                      className="border-b border-gray-300 mb-4 p-2"
                    />
                    <TextInput
                      placeholder="Description"
                      onChangeText={handleChange("description")}
                      onBlur={handleBlur("description")}
                      value={values.description}
                      multiline
                      className="border-b border-gray-300 mb-4 p-2"
                    />
                    <TextInput
                      placeholder="City"
                      onChangeText={handleChange("city")}
                      onBlur={handleBlur("city")}
                      value={values.city}
                      className="border-b border-gray-300 mb-4 p-2"
                    />
                    <TextInput
                      placeholder="State"
                      onChangeText={handleChange("state")}
                      onBlur={handleBlur("state")}
                      value={values.state}
                      className="border-b border-gray-300 mb-4 p-2"
                    />
                    <TextInput
                      placeholder="Contact Email (Required)"
                      onChangeText={handleChange("email")}
                      onBlur={handleBlur("email")}
                      value={values.email}
                      keyboardType="email-address"
                      className="border-b border-gray-300 mb-4 p-2"
                    />
                    <TextInput
                      placeholder="Phone Number (Optional)"
                      onChangeText={handleChange("phone")}
                      onBlur={handleBlur("phone")}
                      value={values.phone}
                      keyboardType="phone-pad"
                      className="border-b border-gray-300 mb-4 p-2"
                    />

                    <Text className="mb-2">Category</Text>
                    <FlatList
                      data={categories}
                      renderItem={renderCategoryItem}
                      horizontal
                      keyExtractor={(item) => item}
                      showsHorizontalScrollIndicator={false}
                      nestedScrollEnabled={true}
                    />

                    <Text className="mb-2 mt-4">Upload Images</Text>
                    <FlatList
                      data={images}
                      horizontal
                      renderItem={({ item, index }) => (
                        <Image
                          key={index}
                          source={{ uri: item }}
                          className="w-20 h-20 mr-2 rounded-lg"
                        />
                      )}
                      keyExtractor={(item, index) => index.toString()}
                      nestedScrollEnabled={true}
                    />
                    <TouchableOpacity
                      onPress={pickImage}
                      className="bg-gray-300 p-2 rounded-lg mt-2 mb-4"
                    >
                      <Text className="text-center text-black">
                        {images.length >= 7 ? "Maximum 7 Images" : "Add Image"}
                      </Text>
                    </TouchableOpacity>

                    {loading ? (
                      <ActivityIndicator size="large" color="#0000ff" />
                    ) : (
                      <TouchableOpacity
                        onPress={handleSubmit}
                        className="bg-blue-500 p-2 rounded-lg"
                      >
                        <Text className="text-white text-center">
                          Save Changes
                        </Text>
                      </TouchableOpacity>
                    )}

                    <TouchableOpacity
                      onPress={() => setEditModalVisible(false)}
                      className="mt-4"
                    >
                      <Text className="text-center text-gray-500">Cancel</Text>
                    </TouchableOpacity>
                  </>
                )}
              </Formik>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
};

export default Classifieds;
