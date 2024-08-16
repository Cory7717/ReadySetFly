import React, { useEffect, useState } from "react";
import {
  ScrollView,
  Text,
  View,
  Image,
  TextInput,
  TouchableOpacity,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as ImagePicker from "expo-image-picker";
import { db } from "../../firebaseConfig";
import { collection, getDocs, orderBy } from "firebase/firestore";
import { Picker } from "@react-native-picker/picker";
import Slider from "../../components/HomeScreen/Slider.js";
import { useUser } from "@clerk/clerk-expo";
import Categories from "../../components/Categories";
import LatestItemList from "../../components/LatestItemList";
import { useNavigation, navigation, navigate } from "@react-navigation/native";
import FullScreenRental from "../../components/FullScreenRental";


// Inside your Home component, where you're navigating to FullScreenRental
// navigation.navigate("FullScreenRental", { listing });

const Home = () => {
  const { user } = useUser();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [listings, setListings] = useState([]);
  const [photo, setPhoto] = useState(null);
  const [sliderList, setSliderList] = useState([]);
  const [categoryList, setCategoryList] = useState([]);
  const [image, setImage] = useState(null);
  const [latestItemList, setLatestItemList] = useState([]);
  const [showListings, setShowListings] = useState(false);
  const [showAircraftSection, setShowAircraftSection] = useState(true);
  const navigation = useNavigation();

  useEffect(() => {
    getCategoryList();
    getSliders();
    getLatestItemList();
  }, []);

  const handleAddListing = () => {
    if (title && description && photo) {
      const newListing = { title, description, price, photo };
      setListings([...listings, newListing]);
      setTitle("");
      setPrice("");
      setDescription("");
      setPhoto(null);
    }
  };

  const handleChoosePhoto = async () => {
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 1,
    });

    if (!result.canceled) {
      setPhoto(result.assets[0].uri);
    }
  };

  const pickImage = async () => {
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.All,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 1,
    });

    if (!result.canceled) {
      setImage(result.assets[0].uri);
    }
  };

  const getSliders = async () => {
    setSliderList([]);
    const querySnapshot = await getDocs(collection(db, "Sliders"));
    querySnapshot.forEach((doc) => {
      setSliderList((sliderList) => [...sliderList, doc.data()]);
    });
  };

  const getCategoryList = async () => {
    setCategoryList([]);
    const querySnapshot = await getDocs(collection(db, "Category"));
    querySnapshot.forEach((doc) => {
      setCategoryList((categoryList) => [...categoryList, doc.data()]);
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

  return (
    <SafeAreaView className="flex-1 bg-white">
      <ScrollView>
        <View className="flex-row items-center gap-4 px-4 py-3">
          <Image
            source={{ uri: user?.imageUrl }}
            className="rounded-full w-12 h-12"
          />
          <View>
            <Text className="text-lg">Welcome</Text>
            <Text className="text-xl font-bold">{user?.fullName}</Text>
          </View>
        </View>

        <Slider />

        <Categories />

        <TouchableOpacity
          onPress={() => setShowAircraftSection(!showAircraftSection)}
          className="mx-4 mt-5 p-3 bg-blue-600 rounded-lg"
        >
          <Text className="text-white text-center font-bold">
            {showAircraftSection ? "Hide" : "Show"} Aircraft Section
          </Text>
        </TouchableOpacity>

        {showAircraftSection && (
          <>
            <Text className="text-2xl px-8 mt-5 underline text-center font-bold">
              List your aircraft
            </Text>

            <TouchableOpacity onPress={pickImage}>
              <View className="items-center">
                <Image
                  source={require("../../Assets/images/Placeholder_view_vector.png")}
                  style={{
                    width: 150,
                    height: 150,
                    borderRadius: 15,
                    marginBottom: 15,
                    marginTop: 15,
                  }}
                />
              </View>
            </TouchableOpacity>

            <View className="border mb-5">
              <Picker>
                <Picker.Item label="Single Engine Prop" value={"Dropdown"} />
                <Picker.Item label="Twin Engine Prop" value={"Dropdown"} />
                <Picker.Item label="Turbo Prop" value={"Dropdown"} />
                <Picker.Item label="Helicopter" value={"Dropdown"} />
                <Picker.Item label="Jet" value={"Dropdown"} />
              </Picker>
            </View>

            <View className="px-4">
              <TextInput
                className="border p-2 mb-4 rounded-lg"
                placeholder="Title"
                value={title}
                onChangeText={setTitle}
              />
              <TextInput
                className="border p-2 mb-4 rounded-lg"
                placeholder="Cost per hour"
                value={price}
                keyboardType="numeric"
                onChangeText={setPrice}
              />
              <TextInput
                className="border p-2 mb-4 rounded-lg"
                placeholder="Description"
                value={description}
                multiline
                onChangeText={setDescription}
              />
            </View>

            <TouchableOpacity onPress={handleChoosePhoto} className="mb-4">
              <View className="p-4 bg-gray-200 rounded-lg">
                <Text className="text-center text-blue-600 font-bold">
                  Choose Photo
                </Text>
              </View>
            </TouchableOpacity>

            {photo && (
              <Image
                source={{ uri: photo }}
                style={{ width: 100, height: 100, marginBottom: 20 }}
              />
            )}

            <TouchableOpacity
              onPress={handleAddListing}
              className="p-4 bg-blue-600 rounded-lg mx-4 mb-5"
            >
              <Text className="text-white text-center font-bold">
                Add Listing
              </Text>
            </TouchableOpacity>
          </>
        )}

        {/* Button to toggle the visibility of the listings */}
        <TouchableOpacity
          onPress={() => setShowListings(!showListings)}
          className="p-4 bg-gray-600 rounded-lg mx-4"
        >
          <Text className="text-white text-center font-bold">
            {showListings ? "Hide Listings" : "Show Listings"}
          </Text>
        </TouchableOpacity>

        {/* Conditional rendering of the listings */}
        {showListings && (
          <View className="mt-8">
            <Text className="text-xl font-bold mb-4 underline text-center">
              Listings
            </Text>
            {listings.map((listing, index) => (
              <TouchableOpacity
                key={index}
                onPress={() =>
                  navigation.navigate("FullScreenRental", { listing })
                }
              >
                <View className="p-4 mb-4 border rounded-lg">
                  <Text className="text-lg font-bold">{listing.title}</Text>
                  <Text>{listing.price}</Text>
                  <Text>{listing.description}</Text>
                  {listing.photo && (
                    <Image
                      source={{ uri: listing.photo }}
                      style={{ width: 100, height: 100, marginTop: 10 }}
                    />
                  )}
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* <LatestItemList
          latestItemList={latestItemList}
          heading={"Latest Items"}
        /> */}
      </ScrollView>
    </SafeAreaView>
  );
};

export default Home;
