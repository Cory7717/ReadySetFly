import React, { useState } from "react";
import {
  View,
  TextInput,
  Alert,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  Image,
  Text,
} from "react-native";
import { getFirestore, collection, addDoc } from "firebase/firestore";
import * as ImagePicker from "expo-image-picker";
import { useUser } from "@clerk/clerk-expo";
import Slider from "../../components/Slider";

const pickImage = async (setImage) => {
  let result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    allowsEditing: true,
    aspect: [4, 3],
    quality: 1,
  });

  if (!result.canceled) {
    setImage(result.assets[0].uri);
  }
};

const AirplaneUploadForm = ({ ownerId }) => {
  const [airplaneName, setAirplaneName] = useState("");
  const [airplaneModel, setAirplaneModel] = useState("");
  const [availability, setAvailability] = useState("");
  const [image, setImage] = useState(null);
  const { user } = useUser();

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
    <SafeAreaView className="bg-white flex-1">
      <ScrollView className="p-4">
        <View className="flex-row items-center gap-3 mb-6 mt-5">
          <Image
            source={{ uri: user?.imageUrl }}
            className="rounded-full w-12 h-12"
          />
          <View>
            <Text className="text-sm text-gray-600">Welcome</Text>
            <Text className="text-lg font-semibold">{user?.fullName}</Text>
          </View>
        </View>

        <Text className="text-3xl font-bold text-center text-gray-800 mb-8">
          Owner Dashboard
        </Text>

        <View className="items-center mb-8">
          <TouchableOpacity onPress={() => pickImage(setImage)}>
            <Image
              source={
                image
                  ? { uri: image }
                  : require("../../Assets/images/Placeholder_view_vector.png")
              }
              className="w-40 h-40 rounded-lg mb-4"
              resizeMode="cover"
            />
          </TouchableOpacity>
          <Text className="text-sm text-gray-500">Tap to choose a photo</Text>
        </View>

        <View className="space-y-4">
          <TextInput
            placeholder="Airplane Name"
            value={airplaneName}
            onChangeText={setAirplaneName}
            className="border border-gray-300 rounded-lg p-3"
          />
          <TextInput
            placeholder="Airplane Model"
            value={airplaneModel}
            onChangeText={setAirplaneModel}
            className="border border-gray-300 rounded-lg p-3"
          />
          <TextInput
            placeholder="Availability"
            value={availability}
            onChangeText={setAvailability}
            className="border border-gray-300 rounded-lg p-3"
          />
          <TouchableOpacity
            onPress={handleUpload}
            className="p-4 bg-blue-600 rounded-full mt-6"
          >
            <Text className="text-white text-center text-lg font-semibold">
              List your Aircraft
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

export default AirplaneUploadForm;
