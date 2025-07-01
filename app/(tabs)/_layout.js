import { StatusBar } from "expo-status-bar";
import { View, Text, Image } from "react-native";
import React from "react";
import { Tabs } from "expo-router";
import { NativeWindStyleSheet } from "nativewind";
import { images } from "../../constants";
import CustomButton from "../../components/CustomButton";
import {
  Ionicons,
  FontAwesome5,
  Feather,
  AntDesign,
  FontAwesome,
  Octicons,
  FontAwesome6,
} from "@expo/vector-icons";
import { createStackNavigator } from "@react-navigation/stack";

const Stack = createStackNavigator();

NativeWindStyleSheet.setOutput({
  default: "native",
});

<View className="flex items-center justify-center gap-2">
  <Image source={images.logo} />
</View>;

const TabIcon = ({ icon, color, focused, name }) => {
  return (
    <View className="flex items-center justify-center gap-2">
      <Image
        name={name}
        resizeMode="contain"
        tintColor={color}
        className="w-6 h-6"
      />
      <Text
        className={`${focused ? "font-rubikbold" : "font-rubikbold"} text-xs `}
        style={{ color: color }}
      >
        {name}
      </Text>
    </View>
  );
};

const TabsLayout = () => {
  return (
    <>
      <Tabs
        screenOptions={{
          tabBarShowLabel: true,
          tabBarActiveTintColor: "#404040", // Darker color for active tab
          tabBarInactiveTintColor: "#808080", // Darker gray for better legibility
          tabBarStyle: {
            paddingBottom: "auto",
            backgroundColor: "#fff",
            borderTopColor: "#b3dbff",
            borderStyle: "solid",
            height: 56,
          },
        }}
      >
        <Tabs.Screen
          name="classifieds"
          options={{
            title: "Marketplace",
            headerShown: false,
            tabBarIcon: ({ color }) => (
              <FontAwesome6 name="shop" size={24} color={color} />
            ),
          }}
        />
        {/* <Tabs.Screen
          name="flights"
          options={{
            title: "Social",
            headerShown: false,
            tabBarIcon: ({ color }) => (
              <Ionicons name="people-outline" size={32} color={color} />
            ),
          }}
        /> */}
        <Tabs.Screen
          name="home"
          options={{
            title: "Rentals",
            headerShown: false,
            headerTitle: "Listings",
            headerStyle: {
              backgroundColor: "#f2f2f2",
            },
            tabBarIcon: ({ color }) => (
              <Ionicons name="airplane-outline" size={32} color={color} />
            ),
          }}
        />

        <Tabs.Screen
          name="owner"
          options={{
            title: "Owner",
            headerShown: false,
            tabBarIcon: ({ color }) => (
              <Ionicons name="person-circle-outline" size={32} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="renter"
          options={{
            title: "Renter",
            headerShown: false,
            tabBarIcon: ({ color }) => (
              <Ionicons name="person-outline" size={32} color={color} />
            ),
          }}
        />
      </Tabs>
    </>
  );
};

export default TabsLayout;
