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
  Modal,
} from "react-native";
import { getFirestore, collection, addDoc } from "firebase/firestore";
import * as ImagePicker from "expo-image-picker";
import { useUser } from "@clerk/clerk-expo";
import { Picker } from "@react-native-picker/picker";
import { Ionicons } from "@expo/vector-icons";
import DatePicker from "react-native-modern-datepicker"; // Import the date picker

const OwnerProfile = ({ ownerId }) => {
  const [airplaneName, setAirplaneName] = useState("");
  const [airplaneModel, setAirplaneModel] = useState("");
  const [availability, setAvailability] = useState("");
  const [location, setLocation] = useState("");
  const [airplaneYear, setAirplaneYear] = useState("");
  const [description, setDescription] = useState("");
  const [isAnnualCurrent, setIsAnnualCurrent] = useState(""); // New state for annual current dropdown
  const [profileImage, setProfileImage] = useState(null);
  const [aircraftImages, setAircraftImages] = useState([]);
  const [bankDetailsVisible, setBankDetailsVisible] = useState(false);
  const [availabilityModalVisible, setAvailabilityModalVisible] = useState(false);
  const [selectedDates, setSelectedDates] = useState([]); // To hold selected dates for availability
  const [currentDate, setCurrentDate] = useState(""); // To track the currently selected date
  const [bankAccountName, setBankAccountName] = useState(""); // Added state
  const [bankAccountNumber, setBankAccountNumber] = useState(""); // Added state
  const [bankRoutingNumber, setBankRoutingNumber] = useState(""); // Added state
  const { user } = useUser();

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
      !description ||
      !isAnnualCurrent // Ensure the new field is filled
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
        availability: selectedDates, // Store selected dates
        location,
        airplaneYear,
        description,
        isAnnualCurrent, // Included in upload
        profileImage,
        aircraftImages,
        bankAccountName, // Included in upload
        bankAccountNumber, // Included in upload
        bankRoutingNumber, // Included in upload
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
        <View className="flex-row items-center justify-between mb-6 mt-5">
          <View className="flex-row items-center">
            <TouchableOpacity onPress={() => pickImages()}>
              <Image
                source={profileImage ? { uri: profileImage } : { uri: user?.imageUrl }}
                className="rounded-full w-16 h-16"
                resizeMode="cover"
              />
            </TouchableOpacity>
            <Text className="text-xl font-semibold text-gray-800 ml-4">
              Welcome, {user?.fullName || "User"}!
            </Text>
          </View>
          <TouchableOpacity onPress={() => setBankDetailsVisible(true)}>
            <Ionicons name="settings-outline" size={24} color="gray" />
          </TouchableOpacity>
        </View>

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
              {[...Array(75).keys()].map((_, index) => {
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

          {/* Availability Section */}
          <TouchableOpacity
            onPress={() => setAvailabilityModalVisible(true)}
            className="p-4 bg-gray-200 rounded-lg"
          >
            <Text className="text-center text-gray-600">Set Availability</Text>
          </TouchableOpacity>

          <TextInput
            placeholder="Airplane Description"
            value={description}
            onChangeText={setDescription}
            multiline
            className="border border-gray-300 rounded-lg p-3"
          />

          {/* Is your annual current dropdown */}
          <View className="border rounded-lg p-1">
            <Picker
              selectedValue={isAnnualCurrent}
              onValueChange={(itemValue) => setIsAnnualCurrent(itemValue)}
            >
              <Picker.Item label="Is your annual current?" value="" />
              <Picker.Item label="Yes" value="Yes" />
              <Picker.Item label="No" value="No" />
            </Picker>
          </View>

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

      {/* Modal for Availability Selection */}
      <Modal visible={availabilityModalVisible} animationType="slide">
        <SafeAreaView className="bg-white flex-1 p-4">
          <TouchableOpacity onPress={() => setAvailabilityModalVisible(false)} className="p-2 mb-4">
            <Ionicons name="close-outline" size={24} color="gray" />
          </TouchableOpacity>
          <Text className="text-xl font-semibold text-gray-800 mb-4">Select Availability Dates</Text>

          <DatePicker
            mode="calendar"
            selected={currentDate} // Use the currentDate string here
            onDateChange={(date) => setCurrentDate(date)} // Update the currentDate state
          />

          <TouchableOpacity
            onPress={() => {
              if (currentDate && !selectedDates.includes(currentDate)) {
                setSelectedDates([...selectedDates, currentDate]);
              }
              setAvailabilityModalVisible(false);
            }}
            className="p-4 bg-blue-600 rounded-full mt-6"
          >
            <Text className="text-white text-center text-lg font-semibold">
              Save and Close
            </Text>
          </TouchableOpacity>
        </SafeAreaView>
      </Modal>

      {/* Modal for Bank Details */}
      <Modal visible={bankDetailsVisible} animationType="slide">
        <SafeAreaView className="bg-white flex-1 p-4">
          <TouchableOpacity onPress={() => setBankDetailsVisible(false)} className="p-2 mb-4">
            <Ionicons name="close-outline" size={24} color="gray" />
          </TouchableOpacity>
          <Text className="text-xl font-semibold text-gray-800 mb-4">Banking Details</Text>

          <TextInput
            placeholder="Bank Account Name"
            value={bankAccountName}
            onChangeText={setBankAccountName}
            className="border border-gray-300 rounded-lg p-3 mb-4"
          />
          <TextInput
            placeholder="Bank Account Number"
            value={bankAccountNumber}
            onChangeText={setBankAccountNumber}
            keyboardType="numeric"
            className="border border-gray-300 rounded-lg p-3 mb-4"
          />
          <TextInput
            placeholder="Bank Routing Number"
            value={bankRoutingNumber}
            onChangeText={setBankRoutingNumber}
            keyboardType="numeric"
            className="border border-gray-300 rounded-lg p-3 mb-4"
          />

          <TouchableOpacity
            onPress={() => setBankDetailsVisible(false)}
            className="p-4 bg-blue-600 rounded-full mt-6"
          >
            <Text className="text-white text-center text-lg font-semibold">
              Save and Close
            </Text>
          </TouchableOpacity>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
};

export default OwnerProfile;
