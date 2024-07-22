import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  Image,
  TextInput,
  Button,
  TouchableOpacity,
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
import { Feather } from "@expo/vector-icons";

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
        <View className="flex-row p-5 items-center gap-1">
          <TouchableOpacity>
            <Image
              source={require("../Assets/images/icononly_nobuffer.png")}
              className="w-12 h-12 rounded-full"
            />
          </TouchableOpacity>
          <View>
            <Text className="text-[14px] font-rubikblack ml-5 ">
              Search for flight instructors
              {/* <HeaderCFI ></HeaderCFI> */}
            </Text>
            <Text className="text-xl, font-rubikblack ml-5">in your area!</Text>
          </View>
        </View>
        <TouchableOpacity>
          <View className="flex-row  gap-1 bg-gray-50 rounded-full p-2 ml-5 mr-5 border-gray-300 border-[1px]">
            <Feather name="search" size={24} color="grey" className='justify-center' />
            <TextInput 
              className=" text-[20px]" 
              placeholder="Search"
              onChangeText={(value)=>console.log(value)}  
              />
          </View>
        </TouchableOpacity>
        <View className="flex-1 rounded-full pt-5 ">
          <MapView resizeMode='contain' initialRegion={INITIAL_REGION} className="flex-1 mb-10 " />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

export default CFI;
