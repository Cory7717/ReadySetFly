import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  Image,
  TextInput,
  Button,
} from "react-native";
import React from "react";
import { Stack, Tabs } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import MapView from "react-native-maps";
import { styled } from "nativewind";
import { SearchBar } from "react-native-screens";
import { HeaderCFI } from "../components";
import { user } from "../constants/images";
import images from "../Assets/images/icononly_nobuffer.png";

const CFI = () => {
  const INITIAL_REGION = {
    latitude: 30.2666666,
    longitude: -97.73333,
    latitudeDelta: 1,
    longitudeDelta: 1,
  };
  const StyledView = styled(View);
  const StyledText = styled(Text);
  const StyledTextInput = styled(TextInput);
  const StyledButton = styled(Button);

  const ProfileScreen = () => {
    const [name, setName] = useState("");
    const [bio, setBio] = useState("");

    const handleSaveProfile = () => {
      // Add my logic here for save profile
      console.log("Profile saved:", { name, bio });
    };
  };

  return (
    <SafeAreaView className="h-full bg-white sand">
      <ScrollView contentContainerStyle={{ height: "100%" }}>
        <View className="flex-row p-5">
          <Image
            source={require("../Assets/images/icononly_nobuffer.png")}
            className="w-12 h-12 rounded-full"
          />
          <Text className="text-l font-rubikblack ml-5 ">
            Certified Flight Instructors
            {/* <HeaderCFI ></HeaderCFI> */}
          </Text>
          <Text className= 'text-l, font-rubikblack ml-5'>
              Create your profile today
          </Text>
        </View>

        <View className="flex-1 items-center justify-center bg-white"></View>

        <View className="flex-1 items-center bg-white">
          <Text className="flex-1 font-rubikregular text-black justify-center text-center text-xl px-8">
            Click below to register for an account as a Certified Flight
            Instructor
          </Text>
        </View>
        <View className="flex-1 ">
          <MapView initialRegion={INITIAL_REGION} className="flex-1 " />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

export default CFI;
