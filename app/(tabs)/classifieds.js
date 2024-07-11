import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TextInput,
  Button,
} from "react-native";
import React from "react";
import { Stack, Tabs } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
// import CustomButton from "../components/CustomButton";
import { useGlobalContext } from "../../context/GlobalProvider";
import { useState } from "react";

const Classifieds = () => {
  const { isLoading, isLoggedIn } = useGlobalContext;

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [listings, setListings] = useState([]);

  const handleAddListing = () => {
    if (title && description) {
      const newListing = { title, description };
      setListings([...listings, newListing]);
      setTitle("");
      setDescription("");
    }
  };

  if (!isLoading && isLoggedIn) return <Redirect href="/home" />;
  return (
    <SafeAreaView className="flex-1 bg-white">
      <ScrollView contentContainerStyle={{ padding: 20 }}>
        <Text className="font-rubikblack text-3xl text-teal-400 px-8">Aircraft Trader</Text>
        <TextInput
          className="border-bottom-1 p-2 mb-4"
          placeholder="Title"
          value={title}
          onChangeText={setTitle}
        />
        <TextInput
          className="border-bottom-1 p-2 mb-4"
          placeholder="Description"
          value={description}
          onChangeText={setDescription}
        />
        <Button title="Add Listing" onPress={handleAddListing} />
        <View className="mt-8">
          <Text className="text-xl font-bold mb-4">Listings</Text>
          {listings.map((listing, index) => (
            <View key={index} className="border p-4 mb-4">
              <Text className="text-lg font-bold">{listing.title}</Text>
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
