import {
  ScrollView,
  Text,
  View,
  Image,
  ImageBackground,
  FlatList,
} from "react-native";
import React from "react";
import { Stack, Tabs } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import ExploreHeader from "../../constants/ExploreHeader";
import Listings from "../../constants/listings";

const Home = () => {
  return (
    <>
      <SafeAreaView className="h-full bg-white sand">
        <ScrollView contentContainerStyle={{ height: "100%" }}>
          <View className="flex-1 items-center text-center justify-center bg-white"></View>
          <View className="flex-1 items-center justify-normal bg-white">
            <Text className="font-rubikblack text-4xl text-teal-400">
              Home Screen!
            </Text>
          </View>
        </ScrollView>
      </SafeAreaView>
    </>
  );
};

export default Home;
