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
} from "react-native";
import React, { useEffect, useState } from "react";
import { getFirestore, collection, getDocs, addDoc, orderBy } from "firebase/firestore";
import { app } from "../../firebaseConfig";
import { Formik } from "formik";
import { Picker } from "@react-native-picker/picker";
import * as ImagePicker from "expo-image-picker";
import { getDownloadURL, getStorage, ref, uploadBytes } from "firebase/storage";
import { useNavigation } from "@react-navigation/native";
import Slider from "../../components/HomeScreen/Slider.js";
import { Ionicons } from "@expo/vector-icons";
import { useUser } from "@clerk/clerk-expo";
import LatestItemList from "../../components/HomeScreen/LatestItemList";
import bgImage from "../../Assets/images/rsf_backgroundImage.png";
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
    setCategoryList([]);
    const querySnapshot = await getDocs(collection(db, "Category"));
    querySnapshot.forEach((doc) => {
      setCategoryList((prevList) => [...prevList, doc.data()]);
    });
  };

  const getSliders = async () => {
    setSliderList([]);
    const querySnapshot = await getDocs(collection(db, "Sliders"));
    querySnapshot.forEach((doc) => {
      setSliderList((prevList) => [...prevList, doc.data()]);
    });
  };

  const getLatestItemList = async () => {
    setLatestItemList([]);
    const querySnapShot = await getDocs(
      collection(db, "UserPost"),
      orderBy("createdAt", "desc")
    );
    querySnapShot.forEach((doc) => {
      setLatestItemList((latestItemList) => [...latestItemList, doc.data()]);
    });
  };

  const pickImage = async () => {
    if (images.length >= 7) {
      Alert.alert("You can only upload up to 7 images.");
      return;
    }

    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.All,
      allowsEditing: true,
      aspect: [4, 4],
      quality: 1,
    });

    if (!result.canceled) {
      setImages([...images, result.assets[0].uri]);
    }
  };

  const onSubmitMethod = async (value) => {
    setLoading(true);
    const imageUrls = [];

    for (let i = 0; i < images.length; i++) {
      const resp = await fetch(images[i]);
      const blob = await resp.blob();
      const storageRef = ref(storage, "airplane_listings/" + Date.now() + "_" + i + ".jpg");

      await uploadBytes(storageRef, blob);
      const downloadUrl = await getDownloadURL(storageRef);
      imageUrls.push(downloadUrl);
    }

    value.images = imageUrls;
    value.userName = user.fullName;
    value.userEmail = user.primaryEmailAddress.emailAddress;
    value.userImage = user.imageUrl;

    try {
      const docRef = await addDoc(collection(db, "UserPost"), value);
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
          <View className="flex-end gap-2 pt-5 ml-2">
            <Image
              source={{ uri: user?.imageUrl }}
              className="rounded-full w-12 h-12"
            />
            <View>
              <Text className="text-lg">Welcome</Text>
              <Text className="text-xl font-bold">{user?.fullName}</Text>

              <View className="flex-row items-center bg-white mt-2 rounded-full border border-blue-500 px-4 py-2 w-full self-center mr-3">
                <Ionicons name="search" size={24} color="gray" />
                <TextInput
                  placeholder="Search"
                  className="flex-1 ml-3"
                  onChangeText={(value) => setSearchTerm(value)}
                  value={searchTerm}
                />
              </View>
            </View>
          </View>

          <Text className="font-bold text-2xl text-center mb-5 pt-5">
            Aircraft Marketplace
          </Text>

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
                      textWrap={true}
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
                      placeholder="Location"
                      value={values?.location}
                      onChangeText={handleChange("location")}
                    />
                    <TextInput
                      className="border rounded-lg p-3 mt-2 mb-1 text-lg"
                      placeholder="User Name"
                      value={values?.userName}
                      onChangeText={handleChange("userName")}
                    />
                    <TextInput
                      className="border rounded-lg p-3 mt-2 mb-1 text-lg"
                      placeholder="Email"
                      value={values?.userEmail}
                      onChangeText={handleChange("userEmail")}
                    />
                    <View className="border rounded-lg mt-2">
                      <Picker
                        selectedValue={values?.category}
                        onValueChange={(itemValue) =>
                          setFieldValue("category", itemValue)
                        }
                      >
                        {categoryList &&
                          categoryList.map((item, index) => (
                            <Picker.Item
                              key={index}
                              label={item?.name}
                              value={item?.name}
                            />
                          ))}
                      </Picker>
                    </View>
                    <TouchableOpacity
                      onPress={handleSubmit}
                      className="p-3 bg-black rounded-full mt-5 items-center"
                    >
                      {loading ? (
                        <ActivityIndicator color="#fff" />
                      ) : (
                        <Text className="text-white text-xl font-bold">
                          Submit
                        </Text>
                      )}
                    </TouchableOpacity>
                  </View>
                )}
              </Formik>
            </View>
          )}

          {/* The below section should be able to press the listing which opens the listing on a full page that shows detailed listing info */}

          <View className='text-[24px] text-xl font-rubikbold items-center text-center'>
            <LatestItemList
              latestItemList={filterListings()}
              heading={"Current Listings"}
              font='rubikbold'
            />
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

export default Classifieds;
