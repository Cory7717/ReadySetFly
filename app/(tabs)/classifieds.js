import React, { useEffect, useState } from "react";
import {
  ScrollView,
  Text,
  View,
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
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useUser } from "@clerk/clerk-expo";
import { db } from "../../firebaseConfig";
import { collection, getDocs, orderBy, addDoc, query, where } from "firebase/firestore";
import { useNavigation } from "@react-navigation/native";
import wingtipClouds from "../../Assets/images/wingtip_clouds.jpg";
import { Formik } from "formik";
import * as ImagePicker from "expo-image-picker";
import { getDownloadURL, getStorage, ref, uploadBytes } from "firebase/storage";
import { Ionicons } from "@expo/vector-icons";

const Classifieds = () => {
  const { user } = useUser();
  const [searchQuery, setSearchQuery] = useState("");
  const [listings, setListings] = useState([]);
  const [filteredListings, setFilteredListings] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState("");
  const [modalVisible, setModalVisible] = useState(false);
  const [images, setImages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedPricing, setSelectedPricing] = useState("Basic");

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

  const navigation = useNavigation();
  const storage = getStorage();

  useEffect(() => {
    if (user) {
      getLatestItemList();
    }
  }, [user]);

  const getLatestItemList = async () => {
    const q = query(
      collection(db, "UserPost"),
      where("userEmail", "==", user.primaryEmailAddress.emailAddress),
      orderBy("createdAt", "desc")
    );
    const querySnapShot = await getDocs(q);
    const listingsData = [];
    querySnapShot.forEach((doc) => {
      listingsData.push(doc.data());
    });
    setListings(listingsData);
    setFilteredListings(listingsData); // Set the filtered listings to show all initially
  };

  const handleSearch = () => {
    const lowerCaseQuery = searchQuery.toLowerCase();
    const filteredData = listings.filter(
      (listing) =>
        listing.city.toLowerCase().includes(lowerCaseQuery) ||
        listing.state.toLowerCase().includes(lowerCaseQuery)
    );
    setFilteredListings(filteredData);
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

  const processPayment = async (amount) => {
    return new Promise((resolve) => setTimeout(() => resolve(true), 2000));
  };

  const onSubmitMethod = async (values) => {
    setLoading(true);

    const success = await processPayment(pricingPackages[selectedPricing]);

    if (!success) {
      Alert.alert("Payment failed. Please try again.");
      setLoading(false);
      return;
    }

    const imageUrls = [];
    for (let i = 0; i < images.length; i++) {
      const resp = await fetch(images[i]);
      const blob = await resp.blob();
      const storageRef = ref(storage, "airplane_listings/" + Date.now() + "_" + i + ".jpg");

      await uploadBytes(storageRef, blob);
      const downloadUrl = await getDownloadURL(storageRef);
      imageUrls.push(downloadUrl);
    }

    values.images = imageUrls;
    values.userName = user.fullName;
    values.userEmail = user.primaryEmailAddress.emailAddress;
    values.userImage = user.imageUrl;
    values.pricingOption = selectedPricing;

    try {
      const docRef = await addDoc(collection(db, "UserPost"), values);
      if (docRef.id) {
        setLoading(false);
        Alert.alert("Your post was successfully added!");
        setModalVisible(false);
        getLatestItemList();
      }
    } catch (error) {
      setLoading(false);
      Alert.alert("There was an error uploading your post.");
    }
  };

  const renderCategoryItem = ({ item }) => (
    <TouchableOpacity
      key={item}
      onPress={() => setSelectedCategory(item)}
      className={`p-2 ${selectedCategory === item ? "bg-gray-500" : "bg-gray-200"} rounded-md mr-2`}
    >
      <Text className="text-sm font-bold">{item}</Text>
    </TouchableOpacity>
  );

  const renderListingItem = ({ item }) => (
    <TouchableOpacity
      onPress={() => navigation.navigate("FullScreenRental", { listing: item })}
      className="p-4 bg-gray-200 rounded-md mb-2"
    >
      <Text className="text-lg font-bold">{item.title}</Text>
      <Text>${item.price} per hour</Text>
      <Text>{item.description}</Text>
      {item.photo && (
        <Image
          source={{ uri: item.photo }}
          className="w-24 h-24 mt-2"
        />
      )}
    </TouchableOpacity>
  );

  return (
    <ImageBackground
      source={wingtipClouds}
      className="flex-1"
      resizeMode="cover"
    >
      <SafeAreaView className="flex-1">
        <ScrollView>
          {/* Header */}
          <View className="flex-row p-4 items-center">
            <Image
              source={{ uri: user?.imageUrl }}
              className="w-10 h-10 rounded-full mr-3"
            />
            <View>
              <Text className="text-base text-white">Welcome</Text>
              <Text className="text-xl font-bold text-white">
                {user?.fullName}
              </Text>
            </View>
          </View>

          {/* Search Bar */}
          <View className="p-4">
            <View className="flex-row items-center bg-white rounded-full border border-blue-500 px-4 py-2 self-center mr-3">
              <Ionicons name="search" size={24} color="gray" />
              <TextInput
                placeholder="Search by city, state"
                className="flex-1 ml-3"
                onChangeText={(value) => setSearchQuery(value)}
                value={searchQuery}
              />
            </View>
          </View>

          {/* Categories Slider */}
          <View className="p-4">
            <FlatList
              data={categories}
              renderItem={renderCategoryItem}
              horizontal
              keyExtractor={(item) => item}
              showsHorizontalScrollIndicator={false}
            />
          </View>

          {/* Aircraft Listings */}
          <View className="p-4">
            <Text className="text-2xl font-bold mb-2 text-white text-center">
              Aircraft Marketplace
            </Text>

            <TouchableOpacity
              onPress={() => setModalVisible(true)}
              className="bg-blue-500 rounded-lg p-3 mb-5"
            >
              <Text className="text-white text-lg text-center">Add Listing</Text>
            </TouchableOpacity>

            {/* Listings */}
            {filteredListings.length > 0 ? (
              <FlatList
                data={filteredListings}
                renderItem={renderListingItem}
                keyExtractor={(item, index) => index.toString()}
              />
            ) : (
              <Text className="text-white">No listings available</Text>
            )}
          </View>

          {/* Submit Listing Modal */}
          <Modal
            animationType="slide"
            transparent={true}
            visible={modalVisible}
            onRequestClose={() => {
              setModalVisible(!modalVisible);
            }}
          >
            <KeyboardAvoidingView
              behavior={Platform.OS === "ios" ? "padding" : "height"}
              className="flex-1 justify-center items-center"
            >
              <ScrollView
                contentContainerStyle={{ flexGrow: 1, justifyContent: "center", alignItems: "center" }}
                className="w-11/12"
              >
                <View className="bg-white rounded-lg p-6 w-full max-w-lg shadow-lg">
                  <Text className="text-2xl font-bold mb-4">Submit Your Listing</Text>
                  
                  <Formik
                    initialValues={{
                      title: "",
                      description: "",
                      price: "",
                      city: "",
                      state: "",
                    }}
                    onSubmit={onSubmitMethod}
                  >
                    {({ handleChange, handleBlur, handleSubmit, values }) => (
                      <View>
                        <TextInput
                          placeholder="Year/Make/Model of Aircraft"
                          onChangeText={handleChange("title")}
                          onBlur={handleBlur("title")}
                          value={values.title}
                          className="border-b border-gray-300 mb-4 p-2"
                        />
                        <TextInput
                          placeholder="Description"
                          onChangeText={handleChange("description")}
                          onBlur={handleBlur("description")}
                          value={values.description}
                          multiline
                          className="border-b border-gray-300 mb-4 p-2 h-24"
                        />
                        <TextInput
                          placeholder="Price"
                          onChangeText={handleChange("price")}
                          onBlur={handleBlur("price")}
                          value={values.price}
                          keyboardType="numeric"
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

                        <View className="flex-row items-center mb-4">
                          <TouchableOpacity
                            onPress={pickImage}
                            className="bg-blue-500 rounded-lg py-2 px-4 mr-3"
                          >
                            <Text className="text-white font-semibold">Upload Images</Text>
                          </TouchableOpacity>
                          <Text>{images.length} images selected</Text>
                        </View>

                        <View className="flex-row justify-between mb-4">
                          {["Basic", "Featured", "Enhanced"].map((option) => (
                            <TouchableOpacity
                              key={option}
                              onPress={() => setSelectedPricing(option)}
                              className={`flex-1 p-3 ${selectedPricing === option ? "bg-blue-500" : "bg-gray-200"} rounded-md mx-1`}
                            >
                              <Text className={`text-center ${selectedPricing === option ? "text-white" : "text-gray-800"}`}>
                                {option} (${pricingPackages[option]})
                              </Text>
                            </TouchableOpacity>
                          ))}
                        </View>

                        <TouchableOpacity
                          onPress={handleSubmit}
                          className="bg-blue-500 rounded-lg py-3 mb-3"
                        >
                          {loading ? (
                            <ActivityIndicator color="#fff" />
                          ) : (
                            <Text className="text-white text-center font-semibold">Submit</Text>
                          )}
                        </TouchableOpacity>

                        <TouchableOpacity
                          onPress={() => setModalVisible(false)}
                          className="bg-red-500 rounded-lg py-3"
                        >
                          <Text className="text-white text-center font-semibold">Cancel</Text>
                        </TouchableOpacity>
                      </View>
                    )}
                  </Formik>
                </View>
              </ScrollView>
            </KeyboardAvoidingView>
          </Modal>
        </ScrollView>
      </SafeAreaView>
    </ImageBackground>
  );
};

export default Classifieds;
