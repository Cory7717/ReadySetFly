import React, { useState } from "react";
import {
  View,
  TextInput,
  Button,
  Alert,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  Image,
  Text,
} from "react-native";
import { getFirestore, collection, addDoc } from "firebase/firestore";
import { createMaterialTopTabNavigator } from "@react-navigation/material-top-tabs";
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

const AirplaneUploadForm = ({ ownerId }) => {
  const [airplaneName, setAirplaneName] = useState("");
  const [airplaneModel, setAirplaneModel] = useState("");
  const [availability, setAvailability] = useState("");

  const handleUpload = async () => {
    if (!airplaneName || !airplaneModel || !availability) {
      Alert.alert("Please fill out all fields.");
      return;
    }

    const db = getFirestore();
    try {
      await addDoc(collection(db, "airplanes"), {
        ownerId,
        airplaneName,
        airplaneModel,
        availability,
        isBookable: true,
      });
      Alert.alert("Airplane listing uploaded!");
    } catch (error) {
      console.error("Error uploading airplane listing:", error);
    }
  };

  return (
    <SafeAreaView className="bg-white pt-10">
      <ScrollView className="bg-white">
        <View className="flex-1 items-center justify-center bg-white">
          <Text className="font-rubikblack text-4xl text-center text-#404040 px-8">
            Owner Dashboard
          </Text>
          <TouchableOpacity onPress={pickImage}>
            <View className="items-center">
              <Image
                className="align-center, content-center"
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
        </View>
        <View className="pt-10 gap-5">
          <TextInput
            placeholder="Airplane Name"
            value={airplaneName}
            onChangeText={setAirplaneName}
          />
          <TextInput
            placeholder="Airplane Model"
            value={airplaneModel}
            onChangeText={setAirplaneModel}
          />
          <TextInput
            placeholder="Availability"
            value={availability}
            onChangeText={setAvailability}
          />

          <TouchableOpacity
            onPress={handleUpload}
            className="p-2 bg-black rounded-full mt-5"
          >
            <Text className="color-white text-center text-[18px] font-rubikbold">
              Upload your Aircraft
            </Text>
          </TouchableOpacity>
          {/* <Button title="Upload Airplane Listing" onPress={handleUpload}/> */}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

export default AirplaneUploadForm;
