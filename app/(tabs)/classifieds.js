import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  TextInput,
  ScrollView,
  TouchableOpacity,
  Image,
  ToastAndroid,
  ActivityIndicator,
  Alert,
  SafeAreaView,
  Modal,
} from "react-native";
import { getFirestore, collection, getDocs, addDoc, orderBy } from "firebase/firestore";
import { app } from "../../firebaseConfig";
import { Formik } from "formik";
import { Picker } from "@react-native-picker/picker";
import * as ImagePicker from "expo-image-picker";
import { getDownloadURL, getStorage, ref, uploadBytes } from "firebase/storage";
import { useNavigation } from "@react-navigation/native";
import { useUser } from "@clerk/clerk-expo";
import Slider from "../../components/HomeScreen/Slider.js";
import { Ionicons } from "@expo/vector-icons";
import LatestItemList from "../../components/HomeScreen/LatestItemList";
import { StatusBar } from "expo-status-bar";

const Classifieds = () => {
  const [images, setImages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [sliderList, setSliderList] = useState([]);
  const [categoryList, setCategoryList] = useState([]);
  const [showForm, setShowForm] = useState(false);
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
    getSliders();
    getLatestItemList();
  }, []);

  const getCategoryList = async () => {
    const querySnapshot = await getDocs(collection(db, "Category"));
    setCategoryList(querySnapshot.docs.map((doc) => doc.data()));
  };

  const getSliders = async () => {
    const querySnapshot = await getDocs(collection(db, "Sliders"));
    setSliderList(querySnapshot.docs.map((doc) => doc.data()));
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
    // Here you would implement payment processing using a service like Stripe.
    // For the sake of this example, we'll just simulate successful payment.
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
      }
    } catch (error) {
      setLoading(false);
      Alert.alert("There was an error uploading your post.");
    }
  };

  const filterListings = () => {
    return latestItemList.filter(item => {
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
          <View className="flex-row gap-2 ml-2 mt-5 items-center">
            <Image
              source={{ uri: user?.imageUrl }}
              className="rounded-full w-12 h-12"
            />
            <View>
              <Text className="text-lg">Welcome</Text>
              <Text className="text-xl font-bold">{user?.fullName}</Text>
            </View>
          </View>

          <View className="flex-row items-center bg-white mt-2 rounded-full border border-blue-500 px-4 py-2 self-center mr-3">
            <Ionicons name="search" size={24} color="gray" />
            <TextInput
              placeholder="Search"
              className="flex-1 ml-3"
              onChangeText={(value) => setSearchTerm(value)}
              value={searchTerm}
            />
          </View>

          <Text className="font-bold text-2xl text-center mb-5 pt-5">
            Aircraft Marketplace
          </Text>

          <TouchableOpacity
            onPress={() => setModalVisible(true)}
            className="bg-blue-500 p-2 rounded-lg mb-5 items-center self-center"
          >
            <Text className="text-white font-bold">Pricing</Text>
          </TouchableOpacity>

          <TouchableOpacity
            className="bg-blue-500 p-3 rounded-lg mb-3 items-center"
            onPress={() => setShowForm(!showForm)}
          >
            <Text className="text-white text-lg font-bold">
              {showForm ? "Show Listings" : "List your Aircraft for sale!"}
            </Text>
          </TouchableOpacity>

          {showForm && (
            <View>
              <Text className="text-lg text-gray-600 mb-5">
                List your aircraft
              </Text>
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
                    ToastAndroid.show(
                      "You must fill in the title",
                      ToastAndroid.CENTER
                    );
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
                    <View className="flex-row gap-2">
                      <ScrollView horizontal>
                        {images.map((image, index) => (
                          <Image
                            key={index}
                            source={{ uri: image }}
                            className="w-24 h-24 rounded-lg mr-2"
                          />
                        ))}
                        <TouchableOpacity onPress={pickImage}>
                          <Image
                            source={require("../../Assets/images/Placeholder_view_vector.png")}
                            className="w-24 h-24 rounded-lg"
                          />
                        </TouchableOpacity>
                      </ScrollView>
                    </View>
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
                      placeholder="Price"
                      value={values?.price}
                      keyboardType="numbers-and-punctuation"
                      onChangeText={handleChange("price")}
                    />
                    <TextInput
                      className="border rounded-lg p-3 mt-2 mb-1 text-lg"
                      placeholder="City, State, Country"
                      value={values?.location}
                      onChangeText={handleChange("location")}
                    />
                    <View className="border rounded-lg p-1 mt-2 mb-1">
                      <Picker
                        selectedValue={selectedCategory}
                        onValueChange={(itemValue) => {
                          setSelectedCategory(itemValue);
                          setFieldValue("category", itemValue);
                        }}
                      >
                        <Picker.Item label="Select Category" value="" />
                        {categoryList.map((category, index) => (
                          <Picker.Item
                            label={category.name}
                            value={category.name}
                            key={index}
                          />
                        ))}
                      </Picker>
                    </View>
                    <TouchableOpacity
                      className="bg-blue-500 p-3 rounded-lg mb-3 mt-3 items-center"
                      onPress={handleSubmit}
                      disabled={loading}
                    >
                      {loading ? (
                        <ActivityIndicator color="#fff" />
                      ) : (
                        <Text className="text-white text-lg font-bold">
                          {selectedPricing === "Basic"
                            ? "Submit for $25"
                            : selectedPricing === "Featured"
                            ? "Submit for $70"
                            : "Submit for $150"}
                        </Text>
                      )}
                    </TouchableOpacity>
                  </View>
                )}
              </Formik>
            </View>
          )}

          {!showForm && (
            <LatestItemList
              latestItemList={filterListings()}
              onPress={(item) =>
                navigation.navigate("HomeScreenDetails", {
                  item,
                })
              }
            />
          )}
        </View>
      </ScrollView>

      <Modal visible={modalVisible} animationType="slide" transparent={true}>
        <View className="flex-1 justify-center items-center bg-black bg-opacity-50">
          <View className="bg-white p-5 rounded-lg w-5/6">
            <Text className="text-xl font-bold mb-5 text-center">
              Select a Pricing Option
            </Text>
            {[
              { label: "Basic - $25", value: "Basic" },
              { label: "Featured - $70", value: "Featured" },
              { label: "Enhanced - $150", value: "Enhanced" },
            ].map((option, index) => (
              <TouchableOpacity
                key={index}
                className={`p-3 rounded-lg mb-2 ${
                  selectedPricing === option.value
                    ? "bg-blue-500"
                    : "bg-gray-200"
                }`}
                onPress={() => setSelectedPricing(option.value)}
              >
                <Text
                  className={`text-lg font-bold text-center ${
                    selectedPricing === option.value
                      ? "text-white"
                      : "text-gray-800"
                  }`}
                >
                  {option.label}
                </Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity
              className="bg-red-500 p-3 rounded-lg items-center mt-3"
              onPress={() => setModalVisible(false)}
            >
              <Text className="text-white text-lg font-bold">Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <StatusBar style="auto" />
    </SafeAreaView>
  );
};

export default Classifieds;
