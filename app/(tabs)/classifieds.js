import {
  StyleSheet,
  Text,
  Image,
  View,
  ScrollView,
  TextInput,
  Button,
  TouchableOpacity,
  HorizontalScroll,
} from "react-native";
import React from "react";
import { Stack, Tabs } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
// import CustomButton from "../components/CustomButton";
import { useGlobalContext } from "../../context/GlobalProvider";
import { useState } from "react";
import { launchImageLibrary } from "react-native-image-picker";
import { createMaterialTopTabNavigator } from "@react-navigation/material-top-tabs";
import TwinEngineProp from "../../components/TwinEngineProp";
import SingleEngineProp from "../../components/SingleEngineProp";
import SingleEnginePiston from "../../components/SingleEnginePiston";
import TwinEnginePiston from "../../components/TwinEnginePiston";
import PistonHelicopter from "../../components/PistonHelicopter";
import { FontAwesome5 } from "@expo/vector-icons";

const Tab = createMaterialTopTabNavigator();

const Classifieds = () => {
  const { isLoading, isLoggedIn } = useGlobalContext;

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [listings, setListings] = useState([]);
  const [location, SetUserLocation] = useState("");
  const [price, setPrice] = useState("");
  const [photo, setPhoto] = useState(null);
  const [contact, setContact] = useState("");

  const handleAddListing = () => {
    if (title && description) {
      const newListing = {
        title,
        description,
        location,
        price,
        photo,
        contact,
      };
      setListings([...listings, newListing]);
      setTitle("");
      setPrice("");
      setContact("");
      setDescription("");
      SetUserLocation("");
      setPhoto(null);
    }
  };

  const Tab = createMaterialTopTabNavigator();

  const handleChoosePhoto = () => {
    launchImageLibrary({}, (response) => {
      if (response.assets && response.assets.length > 0) {
        setPhoto(response.assets[0].uri);
      }
    });
  };

  if (!isLoading && isLoggedIn) return <Redirect href="/home" />;
  return (
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
              options={{
               
              }}
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
          </Tab.Navigator>
        </View>

        <Text className="font-rubikregular text-center text-2xl text-#606060 px-8 mt-10 text-decoration-line: underline font-bold">
          Aircraft Marketplace
        </Text>
        <TextInput
          className="border-bottom-1 p-2 mb-4 font-bold"
          placeholder="Title"
          value={title}
          onChangeText={setTitle}
        />
        <TextInput
          className="border-bottom-1 p-2 mb-4 font-bold"
          placeholder="Price"
          value={price}
          onChangeText={setPrice}
        />
        <TextInput
          className="border-bottom-1 p-2 mb-4 font-bold"
          placeholder="Location"
          value={location}
          onChangeText={SetUserLocation}
        />
        <TextInput
          className="border-bottom-1 p-2 mb-4 font-bold"
          placeholder="Contact"
          value={contact}
          onChangeText={setContact}
        />
        <TextInput
          className="border-bottom-1 p-2 mb-4 font-bold"
          placeholder="Description"
          value={description}
          onChangeText={setDescription}
        />

        <TouchableOpacity onPress={handleChoosePhoto} className="mb-4">
          <View className="border p-4 rounded-xl">
            <Text className="text-center">Upload Photos</Text>
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
            <View key={index} className="border p-4 mb-4">
              <Text className="text-lg font-bold">{listing.title}</Text>
              <Text>{listing.price}</Text>
              <Text>{listing.contact}</Text>
              <Text>{listing.location}</Text>
              <Text>{listing.description}</Text>
            </View>
          ))}
        </View>

        {/* <CustomButton
          title="Click here to view content "
          handlePress={() => router.push("/home")}
          containerStyles="w-full mt-10 bg-black"
        /> */}
      </ScrollView>
    </SafeAreaView>
  );
};

export default Classifieds;
