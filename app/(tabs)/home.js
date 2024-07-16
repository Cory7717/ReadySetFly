import {
  ScrollView,
  Text,
  View,
  Image,
  TextInput,
  TouchableOpacity,
  Button,
} from "react-native";
import React from "react";
import { SafeAreaView } from "react-native-safe-area-context";
import * as ImagePicker from "expo-image-picker";
import { useState } from "react";
import TwinEngineProp from "../../components/TwinEngineProp";
import SingleEngineProp from "../../components/SingleEngineProp";
import SingleEnginePiston from "../../components/SingleEnginePiston";
import TwinEnginePiston from "../../components/TwinEnginePiston";
import PistonHelicopter from "../../components/PistonHelicopter";
import { createMaterialTopTabNavigator } from "@react-navigation/material-top-tabs";

const Tab = createMaterialTopTabNavigator();

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

  return (
    <>
      <SafeAreaView className="flex-1 bg-white">
        <ScrollView contentContainerStyle={{ padding: 20 }}>
          <View className="pb-7">
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

          <Text className="text-2xl font-bold mb-4 text-decoration-line: underline text-center">
            List your aircraft
          </Text>
          <TextInput
            className=" p-2 mb-4"
            placeholder="Title"
            value={title}
            onChangeText={setTitle}
          />
          <TextInput
            className="p-2 mb-4"
            placeholder="Cost per hour"
            value={price}
            onChangeText={setPrice}
          />
          <TextInput
            className=" p-2 mb-4"
            placeholder="Description"
            value={description}
            onChangeText={setDescription}
          />
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

export default Home;
