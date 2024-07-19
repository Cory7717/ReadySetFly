import { StyleSheet, Text, View, ScrollView, TouchableOpacity, Image } from "react-native";
import React from "react";
import { Stack, Tabs } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { createMaterialTopTabNavigator } from "@react-navigation/material-top-tabs";
import BookingCalendar from "../../components/BookingCalendar";
import OwnerProfile from "../../components/OwnerProfile";
import { Formik } from "formik";
import { Picker, PickerItem } from "@react-native-picker/picker";
import * as ImagePicker from "expo-image-picker";





const Tab = createMaterialTopTabNavigator();
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



const Create = () => {
  return (
    <SafeAreaView className="h-full bg-white sand">
      <ScrollView>
        <View className="pb-2 border-b-2">
          <Tab.Navigator
            screenOptions={{
              tabBarIndicatorStyle: "",
              tabBarScrollEnabled: true,
              textBarShowLabel: true,
              tabBarStyle: {
                backgroundColor: "#fff",
                alignItems: 'center'
              },
            }}
          >
            <Tab.Screen
              name="Booking Calendar"
              component={BookingCalendar}
              options={{}}
            />
            <Tab.Screen name="Profile" component={OwnerProfile} />
          </Tab.Navigator>
        </View>
        <TouchableOpacity onPress={pickImage}>
            <View className="items-center">
              <Image className="align-center, content-center"
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
        <View className="flex-1 items-center justify-center bg-white">
          <Text className="font-rubikblack text-4xl text-center text-#404040 px-8">
            Owner Dashboard
          </Text>
        </View>
        <View className="flex-1 items-center bg-white">
          <Text className="flex-1 font-rubikregular text-regular text-#404040 justify-center text-center px-8">
            This screen is a temporary placeholder
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

export default Create;
