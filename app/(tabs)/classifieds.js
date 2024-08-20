import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  TextInput,
  ScrollView,
  TouchableOpacity,
  Image,
  Alert,
  SafeAreaView,
  Modal,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { getFirestore, collection, getDocs, orderBy, addDoc } from "firebase/firestore";
import { app } from "../../firebaseConfig";
import { Formik } from "formik";
import { Picker } from "@react-native-picker/picker";
import * as ImagePicker from "expo-image-picker";
import { getDownloadURL, getStorage, ref, uploadBytes } from "firebase/storage";
import { useNavigation } from "@react-navigation/native";
import { useUser } from "@clerk/clerk-expo";
import { Ionicons } from "@expo/vector-icons";
import LatestItemList from "../../components/HomeScreen/LatestItemList";
import { StatusBar } from "expo-status-bar";

const Classifieds = () => {
  const [images, setImages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [sliderList, setSliderList] = useState([]);
  const [categoryList, setCategoryList] = useState([]);
  const [latestItemList, setLatestItemList] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedPricing, setSelectedPricing] = useState("Basic");

  const db = getFirestore(app);
  const storage = getStorage();
  const { user } = useUser();
  const navigation = useNavigation();

  useEffect(() => {
    getCategoryList();
    getLatestItemList();
  }, []);

  const getCategoryList = async () => {
    const categories = [
      "Single Engine Piston",
      "Twin Engine Piston",
      "Turbo Prop",
      "Helicopter",
      "Jet",
    ];
    setCategoryList(categories);
  };

  const getLatestItemList = async () => {
    const querySnapshot = await getDocs(collection(db, "UserPost"), orderBy("createdAt", "desc"));
    setLatestItemList(querySnapshot.docs.map((doc) => doc.data()));
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
    const pricingPackages = {
      Basic: 25,
      Featured: 70,
      Enhanced: 150,
    };

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

  const filterListings = () => {
    return latestItemList.filter((item) => {
      const location = item.location || "";
      const category = item.category || "";

      const matchesLocation = location.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesCategory = selectedCategory ? category === selectedCategory : true;

      return matchesLocation && matchesCategory;
    });
  };

  return (
    <SafeAreaView>
      <ScrollView>
        <View className="pt-2 px-2 bg-white">
          {/* Header */}
          <View className="flex-row gap-2 ml-2 mt-5 items-center">
            <Image source={{ uri: user?.imageUrl }} className="rounded-full w-12 h-12" />
            <View>
              <Text className="text-lg">Welcome</Text>
              <Text className="text-xl font-bold">{user?.fullName}</Text>
            </View>
          </View>

          {/* Search Bar */}
          <View className="flex-row items-center bg-white mt-2 rounded-full border border-blue-500 px-4 py-2 self-center mr-3">
            <Ionicons name="search" size={24} color="gray" />
            <TextInput
              placeholder="Search by city, state"
              className="flex-1 ml-3"
              onChangeText={(value) => setSearchTerm(value)}
              value={searchTerm}
            />
          </View>

          {/* Category Slider */}
          <ScrollView horizontal className="mt-4" showsHorizontalScrollIndicator={false}>
            {categoryList.map((category, index) => (
              <TouchableOpacity
                key={index}
                onPress={() => setSelectedCategory(category)}
                style={{
                  padding: 10,
                  backgroundColor: selectedCategory === category ? "#007bff" : "lightgray",
                  borderRadius: 8,
                  marginHorizontal: 5,
                }}
              >
                <Text style={{ color: selectedCategory === category ? "white" : "black" }}>
                  {category}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* Aircraft Listings */}
          <Text className="font-bold text-2xl text-center mb-5 pt-5">
            Aircraft Marketplace
          </Text>

          {/* Add Listing Button */}
          <TouchableOpacity
            onPress={() => setModalVisible(true)}
            className="bg-blue-500 rounded-lg p-3 mb-5"
          >
            <Text className="text-white text-lg text-center">Add Listing</Text>
          </TouchableOpacity>

          {/* Aircraft Listings */}
          <LatestItemList
            latestItemList={filterListings()}
            onPress={(item) =>
              navigation.navigate("HomeScreenDetails", {
                item,
              })
            }
          />

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
              style={{ flex: 1 }}
            >
              <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: "center" }}>
                <View className="flex-1 justify-center items-center bg-black bg-opacity-50">
                  <View className="bg-white rounded-lg p-5 w-11/12">
                    <Text className="text-lg font-bold mb-4 text-center">Submit Your Listing</Text>

                    <Formik
                      initialValues={{
                        title: "",
                        desc: "",
                        category: "",
                        location: "",
                        price: "",
                        images: [],
                        userName: "",
                        userEmail: "",
                        userImage: "",
                        pricingOption: selectedPricing,
                      }}
                      onSubmit={(value) => onSubmitMethod(value)}
                      validate={(values) => {
                        const errors = {};
                        if (!values.title) {
                          Alert.alert("You must fill in the title");
                          errors.title = "You must fill in the Title";
                        }
                        return errors;
                      }}
                    >
                      {({
                        handleChange,
                        handleBlur,
                        handleSubmit,
                        values,
                        setFieldValue,
                        errors,
                      }) => (
                        <View>
                          {/* Form Inputs */}
                          <TextInput
                            className="border rounded-lg p-3 mt-2 mb-1 text-lg"
                            placeholder="Title"
                            value={values?.title}
                            onChangeText={handleChange("title")}
                          />
                          <TextInput
                            className="border rounded-lg p-3 mt-2 mb-1 text-lg"
                            placeholder="Description, Avionics, TTOF, etc.."
                            value={values?.desc}
                            onChangeText={handleChange("desc")}
                            multiline
                          />
                          <TextInput
                            className="border rounded-lg p-3 mt-2 mb-1 text-lg"
                            placeholder="Location"
                            value={values?.location}
                            onChangeText={handleChange("location")}
                          />
                          <TextInput
                            className="border rounded-lg p-3 mt-2 mb-1 text-lg"
                            placeholder="Price"
                            value={values?.price}
                            onChangeText={handleChange("price")}
                            keyboardType="numeric"
                          />

                          {/* Category Picker */}
                          <View className="border rounded-lg p-2 mt-2 mb-1">
                            <Picker
                              selectedValue={values?.category}
                              onValueChange={(value) => setFieldValue("category", value)}
                            >
                              <Picker.Item label="Select Category" value="" />
                              {categoryList.map((category, index) => (
                                <Picker.Item label={category} value={category} key={index} />
                              ))}
                            </Picker>
                          </View>

                          {/* Pricing Picker */}
                          <View className="border rounded-lg p-2 mt-2 mb-1">
                            <Picker
                              selectedValue={selectedPricing}
                              onValueChange={(value) => setSelectedPricing(value)}
                            >
                              <Picker.Item label="Basic - $25" value="Basic" />
                              <Picker.Item label="Featured - $70" value="Featured" />
                              <Picker.Item label="Enhanced - $150" value="Enhanced" />
                            </Picker>
                          </View>

                          {/* Image Upload */}
                          <View className="border rounded-lg p-2 mt-2 mb-1">
                            <TouchableOpacity
                              onPress={pickImage}
                              className="bg-blue-500 rounded-lg p-3 mb-5"
                            >
                              <Text className="text-white text-lg text-center">
                                Add Images ({images.length}/7)
                              </Text>
                            </TouchableOpacity>
                          </View>

                          {/* Submit Button */}
                          <TouchableOpacity
                            onPress={handleSubmit}
                            className="bg-blue-500 rounded-lg p-3 mb-5"
                            disabled={loading}
                          >
                            {loading ? (
                              <ActivityIndicator color="#fff" />
                            ) : (
                              <Text className="text-white text-lg text-center">Submit</Text>
                            )}
                          </TouchableOpacity>
                        </View>
                      )}
                    </Formik>
                    <TouchableOpacity
                      className="bg-gray-500 rounded-lg p-3"
                      onPress={() => setModalVisible(!modalVisible)}
                    >
                      <Text className="text-white text-lg text-center">Cancel</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </ScrollView>
            </KeyboardAvoidingView>
          </Modal>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

export default Classifieds;
