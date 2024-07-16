import { StatusBar } from "expo-status-bar";
import { View, Text, Image } from "react-native";
import React from "react";
import { Tabs, Redirect } from "expo-router";
import { NativeWindStyleSheet } from "nativewind";
import { images } from "../../constants";
import CustomButton from "../../components/CustomButton";
import {
  Ionicons,
  MaterialCommunityIcons,
  FontAwesome5,
  Feather,
  AntDesign,
  FontAwesome,
} from "@expo/vector-icons";

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
        name={name}
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
          tabBarActiveTintColor: "#404040",
          tabBarInactiveTintColor: "#e6e6e6",
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
          name="home"
          options={{
            title: "Home",
            headerShown: false,
            headerTitle: "Listings",
            headerStyle: {
              backgroundColor: "#f2f2f2",
            },
            tabBarIcon: ({ name, icon, color, focused, size }) => (
              <AntDesign name="home" size={32} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="owner"
          options={{
            title: "Owner",
            headerShown: false,
            tabBarIcon: ({ name, icon, color, focused }) => (
              <FontAwesome name="sign-in" size={32} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="renter"
          options={{
            title: "Renter",
            headerShown: false,
            tabBarIcon: ({ name, icon, color, focused }) => (
              <Ionicons name="person-outline" size={32} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="flights"
          options={{
            title: "Search Airplanes",
            headerShown: false,
            tabBarIcon: ({ name, icon, color, focused }) => (
              <MaterialCommunityIcons
                name="airplane-takeoff"
                size={32}
                color={color}
              />
            ),
          }}
        />
        <Tabs.Screen
          name="inbox"
          options={{
            title: "Inbox",
            headerShown: false,
            tabBarIcon: ({ name, icon, color, focused }) => (
              <AntDesign name="message1" size={32} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="classifieds"
          options={{
            title: "Classifieds",
            headerShown: false,
            tabBarIcon: ({ name, icon, color, focused }) => (
              <Ionicons name="list-outline" size={32} color={color} />
            ),
          }}
        />
      </Tabs>
    </>
  );
};

export default TabsLayout;
