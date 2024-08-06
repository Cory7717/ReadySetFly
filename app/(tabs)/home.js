import React, { useEffect, useState } from "react";
import {
  ScrollView,
  Text,
  View,
  Image,
  TextInput,
  TouchableOpacity,
  Button,
  StyleSheet,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as ImagePicker from "expo-image-picker";
import { db } from "../../firebaseConfig";
import { collection, getDocs } from "firebase/firestore"; // Ensure this import is correct
import { Picker } from "@react-native-picker/picker";
import Slider from "../../components/HomeScreen/Slider.js";
import { createMaterialTopTabNavigator } from "@react-navigation/material-top-tabs";
import Header from "../../components/HomeScreen/Header.js";
import TwinEngineProp from "../../components/TwinEngineProp";
import SingleEngineProp from "../../components/SingleEngineProp";
import SingleEnginePiston from "../../components/SingleEnginePiston";
import TwinEnginePiston from "../../components/TwinEnginePiston";
import PistonHelicopter from "../../components/PistonHelicopter";
// import Categories from "../../components/Categories";
// import LatestItemList from "../../components/LatestItemList";

// import { useUser } from "@clerk/clerk-expo";

const Tab = createMaterialTopTabNavigator();

const Home = () => {
  // const {user}=useUser();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [listings, setListings] = useState([]);
  const [photo, setPhoto] = useState(null);
  const [sliderList, setSliderList] = useState([]);
  const [categoryList, setCategoryList] = useState([]);
  const [image, setImage] = useState(null);
  // const [latestItemList, setLatestItemList] = useState([]);

  useEffect(() => {
    getCategoryList();
    getSliders();
    // getLatestItemList();
  }, []);

  const handleAddListing = () => {
    if (title && description) {
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
      setPhoto(result.uri);
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
      // doc.data() is never undefined for query doc snapshots
      setSliderList((sliderList) => [...sliderList, doc.data()]);
    });
  };

  const getCategoryList = async () => {
    setCategoryList([]);
    const querySnapshot = await getDocs(collection(db, "Category"));
    querySnapshot.forEach((doc) => {
      console.log("Docs:", doc.data());
      setCategoryList((categoryList) => [...categoryList, doc.data()]);
    })
  }

  // const getLatestItemList = async () => {
  //   setLatestItemList([]);
  //   const querySnapShot = await getDocs(
  //     collection(db, "UserPost"),
  //     orderBy("createdAt", "desc")
  //   );
  //   querySnapShot.forEach((doc) => {
  //     console.log("Docs", doc.data());
  //     setLatestItemList((latestItemList) => [...latestItemList, doc.data()]);
  //   });
  // };


  return (
    <>
      <SafeAreaView className="flex-1 bg-white">
        <ScrollView>
          <View className="pb-2 border-b-2">
            <Text className="text-black text-center font-rubikbold text-xl">
              Search listings by type
            </Text>
          </View>
          <View>
            {/* <Tab.Navigator
            screenOptions={{
              tabBarIndicatorStyle: "",
              tabBarScrollEnabled: true,
              textBarShowLabel: true,
              tabBarStyle: {
                backgroundColor: "#fff",
              },
            }}
          >
            <Tab.Screen
              name="Single Engine Prop"
              component={SingleEngineProp}
              options={{}}
            />
            <Tab.Screen name="Twin Engine Prop" component={TwinEngineProp} />
            <Tab.Screen
              name="Single Engine Piston"
              component={SingleEnginePiston}
            />
            <Tab.Screen
              name="Twin Engine Piston"
              component={TwinEnginePiston}
            />
            <Tab.Screen name="Piston Helicopter" component={PistonHelicopter} />
          </Tab.Navigator> */}

            <Text className="text-2xl px-8 mt-5 text-decoration-line: underline text-center font-rubikbold">
              List your aircraft
            </Text>
          </View>
          <Header />
          {/* Slider  */}
          <Slider sliderList={sliderList} />
          {/* Category List  */}
          {/* <Categories categoryList={categoryList} /> */}
          {/* Latest Item List   */}
          {/* <LatestItemList
            latestItemList={latestItemList}
            heading={"Latest Items"}
          /> */}
          <TouchableOpacity onPress={pickImage}>
            <View className="items-center">
              <Image
                source={require("../../Assets/images/Placeholder_view_vector.png")}
                style={{
                  width: 150,
                  height: 150,
                  borderRadius: 15,
                  paddingBottom: 10,
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
          <View className="align-text-top">
            <TextInput
              className=" p-2 mb-4 border"
              placeholder="Title"
              value={title}
              onChangeText={setTitle}
            />
            <TextInput
              className="p-2 mb-4 border"
              placeholder="Cost per hour"
              value={price}
              keyboardType="numeric"
              onChangeText={setPrice}
            />
            <TextInput
              className=" p-2 mb-4 border "
              placeholder="Description"
              value={description}
              numberOfLines={5}
              onChangeText={setDescription}
            />
          </View>
          <TouchableOpacity onPress={handleChoosePhoto} className="mb-4">
            <View className=" p-4">
              <Text className="text-center">Choose Photo</Text>
            </View>
          </TouchableOpacity>
          {photo && (
            <Image
              source={{ uri: photo }}
              style={{ width: 100, height: 100, marginBottom: 20 }}
            />
          )}
          <Button title="Add Listing" onPress={handleAddListing} />
          <View className="mt-8">
            <Text className="text-xl font-bold mb-4 text-decoration-line: underline text-center">
              Listings
            </Text>
            {listings.map((listing, index) => (
              <View key={index} className=" p-4 mb-4">
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
            ))}
          </View>
        </ScrollView>
      </SafeAreaView>
    </>
  );
};

const styles = StyleSheet.create({
  input: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 10,
    paddingHorizontal: 17,
    fontSize: 17,
    marginBottom: 5,
    marginTop: 10,
    textAlignVertical: "top",
    justifyContent: "space-evenly",
    flexDirection: "row",
    flex: 1,
    flexWrap: "wrap",
  },
});

export default Home;
