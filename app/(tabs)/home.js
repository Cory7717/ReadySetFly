import {
  ScrollView,
  Text,
  View,
  Image,
  ImageBackground,
  FlatList,
  TextInput,
  TouchableOpacity,
  Button,
} from "react-native";
import React from "react";
import { Stack, Tabs } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import ExploreHeader from "../../constants/ExploreHeader";
import Listings from "../../constants/listings";
import * as ImagePicker from "expo-image-picker";
import { useState } from "react";
import { createStackNavigator } from "@react-navigation/stack";
import { NavigationContainer } from "@react-navigation/native";
import { StackScreen } from '@react-navigation/stack';

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
  // function StackScreen() {
  //   return (
  //     <Stack.Navigator>
  //       <Stack.Screen
  //         name="Home"
  //         component={HomeScreen}
  //         options={{
  //           title: 'My home',
  //           headerStyle: {
              
  //             backgroundColor: '#f4511e',
  //           },
  //           headerTintColor: '#fff',
  //           headerTitleStyle: {
  //             fontWeight: 'bold',
  //             fontFamily: 'rubikregular'
  //           },
  //         }}
  //       />
  //     </Stack.Navigator>
  //   );
  // }

  return (
    <>
      <SafeAreaView className="flex-1 bg-white">
        <ScrollView contentContainerStyle={{ padding: 20 }}>
       
          <Text className="text-2xl font-bold mb-4 text-decoration-line: underline text-center">List your aircraft</Text>
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
            <Text className="text-xl font-bold mb-4 text-decoration-line: underline text-center">Listings</Text>
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
