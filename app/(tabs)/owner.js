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
import { Picker } from "@react-native-picker/picker";

const OwnerProfile = ({ ownerId }) => {
  const [airplaneName, setAirplaneName] = useState("");
  const [airplaneModel, setAirplaneModel] = useState("");
  const [availability, setAvailability] = useState("");
  const [location, setLocation] = useState("");
  const [airplaneYear, setAirplaneYear] = useState("");
  const [description, setDescription] = useState("");
  const [profileImage, setProfileImage] = useState(null);
  const [aircraftImages, setAircraftImages] = useState([]); // To hold up to 7 images
  const [bankDetailsVisible, setBankDetailsVisible] = useState(false); // To toggle banking details section
  const [bankAccountName, setBankAccountName] = useState("");
  const [bankAccountNumber, setBankAccountNumber] = useState("");
  const [bankRoutingNumber, setBankRoutingNumber] = useState("");
  const { user } = useUser();

  // Function to handle image picking
  const pickImages = async () => {
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      quality: 1,
    });

    if (!result.canceled) {
      const selectedImages = result.assets.slice(0, 7).map((asset) => asset.uri);
      setAircraftImages((prevImages) => [...prevImages, ...selectedImages]);
    }
  };

  const handleUpload = async () => {
    if (
      !airplaneName ||
      !airplaneModel ||
      !availability ||
      !location ||
      !airplaneYear ||
      !description
    ) {
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
        location,
        airplaneYear,
        description,
        profileImage,
        aircraftImages, // Store selected images
        bankAccountName,
        bankAccountNumber,
        bankRoutingNumber,
        isBookable: true,
      });
      Alert.alert("Profile and airplane listing updated successfully!");
    } catch (error) {
      console.error("Error uploading profile and airplane listing:", error);
    }
  };

  return (
    <SafeAreaView className="bg-white flex-1">
      <ScrollView className="p-4">
        <View className="flex-row items-center gap-3 mb-6 mt-5">
          <TouchableOpacity onPress={() => pickImages()}>
            <Image
              source={profileImage ? { uri: profileImage } : { uri: user?.imageUrl }}
              className="rounded-full w-16 h-16"
              resizeMode="cover"
            />
          </TouchableOpacity>
          <View>
            <Text className="text-sm text-gray-600">Welcome</Text>
            <Text className="text-lg font-semibold">{user?.fullName}</Text>
          </View>
        </View>

        <Text className="text-3xl font-bold text-center text-gray-800 mb-8">
          Owner Profile
        </Text>

        {/* Add Image Picker */}
        <TouchableOpacity onPress={pickImages} className="p-4 bg-gray-200 rounded-lg mb-4">
          <Text className="text-center text-gray-600">Pick up to 7 Aircraft Images</Text>
        </TouchableOpacity>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {aircraftImages.map((uri, index) => (
            <Image
              key={index}
              source={{ uri }}
              className="w-32 h-32 mr-2 rounded-lg"
              resizeMode="cover"
            />
          ))}
        </ScrollView>

        <View className="space-y-4">
          <TextInput
            placeholder="Name"
            value={user?.fullName}
            className="border border-gray-300 rounded-lg p-3"
            editable={false}
          />
          <TextInput
            placeholder="Location (City, State, Country)"
            value={location}
            onChangeText={setLocation}
            className="border border-gray-300 rounded-lg p-3"
          />

          <View className="border rounded-lg p-1">
            <Picker
              selectedValue={airplaneYear}
              onValueChange={(itemValue) => setAirplaneYear(itemValue)}
            >
              <Picker.Item label="Select Airplane Year" value="" />
              {[...Array(50).keys()].map((_, index) => {
                const year = new Date().getFullYear() - index;
                return <Picker.Item label={year.toString()} value={year.toString()} key={index} />;
              })}
            </Picker>
          </View>

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
          <TextInput
            placeholder="Airplane Description"
            value={description}
            onChangeText={setDescription}
            multiline
            className="border border-gray-300 rounded-lg p-3"
          />

          <TouchableOpacity
            onPress={() => setBankDetailsVisible(!bankDetailsVisible)}
            className="p-4 bg-gray-200 rounded-lg mt-4"
          >
            <Text className="text-center text-gray-600">
              {bankDetailsVisible ? "Hide" : "Show"} Banking Details
            </Text>
          </TouchableOpacity>

          {bankDetailsVisible && (
            <View className="space-y-4">
              <TextInput
                placeholder="Bank Account Name"
                value={bankAccountName}
                onChangeText={setBankAccountName}
                className="border border-gray-300 rounded-lg p-3"
              />
              <TextInput
                placeholder="Bank Account Number"
                value={bankAccountNumber}
                onChangeText={setBankAccountNumber}
                keyboardType="numeric"
                className="border border-gray-300 rounded-lg p-3"
              />
              <TextInput
                placeholder="Bank Routing Number"
                value={bankRoutingNumber}
                onChangeText={setBankRoutingNumber}
                keyboardType="numeric"
                className="border border-gray-300 rounded-lg p-3"
              />
            </View>
          )}

          <TouchableOpacity
            onPress={handleUpload}
            className="p-4 bg-blue-600 rounded-full mt-6"
          >
            <Text className="text-white text-center text-lg font-semibold">
              Update Profile and List Aircraft
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

export default OwnerProfile;
