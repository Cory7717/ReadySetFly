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
import React, { useEffect } from "react";
import { SafeAreaView } from "react-native-safe-area-context";
import * as ImagePicker from "expo-image-picker";
import { useState } from "react";
import TwinEngineProp from "../../components/TwinEngineProp";
import SingleEngineProp from "../../components/SingleEngineProp";
import SingleEnginePiston from "../../components/SingleEnginePiston";
import TwinEnginePiston from "../../components/TwinEnginePiston";
import PistonHelicopter from "../../components/PistonHelicopter";
import { createMaterialTopTabNavigator } from "@react-navigation/material-top-tabs";
import { Formik } from "formik";
import { Picker, PickerItem } from "@react-native-picker/picker";

const ImagePickerExample = () => {
  const [image, setImage] = useState(null);}

const Tab = createMaterialTopTabNavigator();



// 1:52:00 into video for search bar and slider
const Home = () => {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [listings, setListings] = useState([]);
  const [photo, setPhoto] = useState(null);
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

  // const [categoryList, setCategoryList] =useState([]);
  // useEffect(()=>{
  //   getCategoryList();
  // }, [])

  // const getCategoryList=async()=>{
  //   const querySnapshot=await getDocs(collection(db, 'Category'));
  //   querySnapshot.forEach((doc)=>{
  //     setCategoryList(categoryList=>[...categoryList. doc.data()])
  //   })
  // }

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
    // No permissions request is necessary for launching the image library
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.All,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 1,
    });

    console.log(result);

    if (!result.canceled) {
      setImage(result.assets[0].uri);
    }
  };

  return (
    <>
      <SafeAreaView className="flex-1 bg-white">
        <ScrollView contentContainerStyle={{ padding: 20 }}>
          <View className="pb-2 border-b-2">
            <Text className="text-black text-center font-rubikbold text-xl">
              Search listings by type
            </Text>
            <Tab.Navigator
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
              <Tab.Screen
                name="Piston Helicopter"
                component={PistonHelicopter}
              />
            </Tab.Navigator>
          </View>

    

          <View>
            <Text className="text-2xl px-8 mt-5 text-decoration-line: underline text-center font-rubikbold">
              List your aircraft
            </Text>
          </View>
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
              className=" p-2 mb-4 border text-start "
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
