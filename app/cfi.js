import { StyleSheet, Text, View, ScrollView } from "react-native";
import React from "react";
import { Stack, Tabs } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import MapView  from 'react-native-maps'

const CFI = () => {
  const INITIAL_REGION = {
    latitude: 30.2666666,
    longitude: -97.733330,
    latitudeDelta: 1,
    longitudeDelta: 1
  }
  return (
    <SafeAreaView className="h-full bg-white sand">
      <ScrollView contentContainerStyle={{ height: "100%" }}>
        <View className="flex-1 items-center justify-center bg-white">
          <Text className="font-rubikblack text-center text-2xl text-teal-400 px-8">
            Certified Flight Instructors
          </Text>
        </View>
        <View className="flex-1 items-center bg-white">
          <Text className="flex-1 font-rubikregular text-black justify-center text-center text-xl px-8">
            Click below to register for an account as a Certified Flight
            Instructor
          </Text>
        </View>
        <View className="flex-1 ">
      <MapView 
      initialRegion={INITIAL_REGION}
      className="flex-1 " />
    </View>
      </ScrollView>
    </SafeAreaView>
  );
};

export default CFI;
