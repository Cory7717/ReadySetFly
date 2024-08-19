import React, { useState, useEffect } from "react";
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
import { getFirestore, collection, addDoc, doc, getDoc } from "firebase/firestore"; // Add getDoc
import * as ImagePicker from "expo-image-picker";
import { useUser } from "@clerk/clerk-expo";
import { Picker } from "@react-native-picker/picker";
import { Ionicons } from "@expo/vector-icons";
import DatePicker from "react-native-modern-datepicker"; // Import the date picker
import { styled } from 'nativewind'; // Import NativeWind's styled utility

// Styled components with NativeWind
const SafeView = styled(SafeAreaView);
const ScrollContainer = styled(ScrollView);
const WrapperView = styled(View);
const TouchableButton = styled(TouchableOpacity);
const StyledText = styled(Text);
const StyledImage = styled(Image);
const StyledTextInput = styled(TextInput);
const StyledModal = styled(Modal);

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
  const [cumulativeEarnings, setCumulativeEarnings] = useState(0); // New state for cumulative earnings
  const { user } = useUser();

  useEffect(() => {
    const fetchCumulativeEarnings = async () => {
      const db = getFirestore();
      const ownerDocRef = doc(db, "owners", ownerId);
      const ownerDoc = await getDoc(ownerDocRef);

      if (ownerDoc.exists()) {
        const data = ownerDoc.data();
        setCumulativeEarnings(data.cumulativeEarnings || 0); // Assuming cumulativeEarnings is stored in the owner's document
      }
    };

    if (ownerId) {
      fetchCumulativeEarnings();
    }
  }, [ownerId]);

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
    <SafeView className="bg-white flex-1">
      <ScrollContainer contentContainerStyle={{ padding: 16 }}>
        <WrapperView className="flex-row items-center justify-between mb-6 mt-5">
          <WrapperView className="flex-row items-center">
            <TouchableButton onPress={() => pickImages()}>
              <StyledImage
                source={profileImage ? { uri: profileImage } : { uri: user?.imageUrl }}
                className="rounded-full w-16 h-16"
                resizeMode="cover"
              />
            </TouchableButton>
            <StyledText className="text-xl font-semibold text-gray-800 ml-4">
              Welcome, {user?.fullName || "User"}!
            </StyledText>
          </WrapperView>
          <TouchableButton onPress={() => setBankDetailsVisible(true)}>
            <Ionicons name="settings-outline" size={24} color="gray" />
          </TouchableButton>
        </WrapperView>

        <TouchableButton onPress={pickImages} className="p-4 bg-gray-200 rounded-md mb-4">
          <StyledText className="text-center text-gray-600">
            Pick up to 7 Aircraft Images
          </StyledText>
        </TouchableButton>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {aircraftImages.map((uri, index) => (
            <StyledImage
              key={index}
              source={{ uri }}
              className="w-32 h-32 mr-2 rounded-md"
              resizeMode="cover"
            />
          ))}
        </ScrollView>

        <WrapperView className="space-y-4">
          <StyledTextInput
            placeholder="Name"
            value={user?.fullName}
            className="border-gray-300 border rounded-md p-3"
            editable={false}
          />
          <StyledTextInput
            placeholder="Location (City, State, Country)"
            value={location}
            onChangeText={setLocation}
            className="border-gray-300 border rounded-md p-3"
          />

          <WrapperView className="border-gray-300 border rounded-md p-1">
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
          </WrapperView>

          <StyledTextInput
            placeholder="Airplane Model"
            value={airplaneModel}
            onChangeText={setAirplaneModel}
            className="border-gray-300 border rounded-md p-3"
          />

          {/* Availability Section */}
          <TouchableButton
            onPress={() => setAvailabilityModalVisible(true)}
            className="p-4 bg-gray-200 rounded-md"
          >
            <StyledText className="text-center text-gray-600">Set Availability</StyledText>
          </TouchableButton>

          <StyledTextInput
            placeholder="Airplane Description"
            value={description}
            onChangeText={setDescription}
            multiline
            className="border-gray-300 border rounded-md p-3"
          />

          {/* Is your annual current dropdown */}
          <WrapperView className="border-gray-300 border rounded-md p-1">
            <Picker
              selectedValue={isAnnualCurrent}
              onValueChange={(itemValue) => setIsAnnualCurrent(itemValue)}
            >
              <Picker.Item label="Is your annual current?" value="" />
              <Picker.Item label="Yes" value="Yes" />
              <Picker.Item label="No" value="No" />
            </Picker>
          </WrapperView>

          <TouchableButton
            onPress={handleUpload}
            className="p-4 bg-blue-600 rounded-full mt-6"
          >
            <StyledText className="text-white text-center text-lg font-semibold">
              Update Profile and List Aircraft
            </StyledText>
          </TouchableButton>
        </WrapperView>
      </ScrollContainer>

      {/* Modal for Availability Selection */}
      <StyledModal visible={availabilityModalVisible} animationType="slide">
        <SafeView className="bg-white flex-1 p-4">
          <TouchableButton onPress={() => setAvailabilityModalVisible(false)} className="p-2 mb-4">
            <Ionicons name="close-outline" size={24} color="gray" />
          </TouchableButton>
          <StyledText className="text-xl font-semibold text-gray-800 mb-4">Select Availability Dates</StyledText>

          <DatePicker
            mode="calendar"
            selected={currentDate} // Use the currentDate string here
            onDateChange={(date) => setCurrentDate(date)} // Update the currentDate state
          />

          <TouchableButton
            onPress={() => {
              if (currentDate && !selectedDates.includes(currentDate)) {
                setSelectedDates([...selectedDates, currentDate]);
              }
              setAvailabilityModalVisible(false);
            }}
            className="p-4 bg-blue-600 rounded-full mt-6"
          >
            <StyledText className="text-white text-center text-lg font-semibold">
              Save and Close
            </StyledText>
          </TouchableButton>
        </SafeView>
      </StyledModal>

      {/* Modal for Bank Details */}
      <StyledModal visible={bankDetailsVisible} animationType="slide">
        <SafeView className="bg-white flex-1 p-4">
          <TouchableButton onPress={() => setBankDetailsVisible(false)} className="p-2 mb-4">
            <Ionicons name="close-outline" size={24} color="gray" />
          </TouchableButton>
          <StyledText className="text-xl font-semibold text-gray-800 mb-4">Banking Details</StyledText>

          <StyledTextInput
            placeholder="Bank Account Name"
            value={bankAccountName}
            onChangeText={setBankAccountName}
            className="border-gray-300 border rounded-md p-3 mb-4"
          />
          <StyledTextInput
            placeholder="Bank Account Number"
            value={bankAccountNumber}
            onChangeText={setBankAccountNumber}
            keyboardType="numeric"
            className="border-gray-300 border rounded-md p-3 mb-4"
          />
          <StyledTextInput
            placeholder="Bank Routing Number"
            value={bankRoutingNumber}
            onChangeText={setBankRoutingNumber}
            keyboardType="numeric"
            className="border-gray-300 border rounded-md p-3 mb-4"
          />

          {/* Display Cumulative Earnings */}
          <StyledText className="text-lg font-semibold text-gray-800 mb-4">
            Cumulative Earnings: ${cumulativeEarnings.toFixed(2)}
          </StyledText>

          <TouchableButton
            onPress={() => setBankDetailsVisible(false)}
            className="p-4 bg-blue-600 rounded-full mt-6"
          >
            <StyledText className="text-white text-center text-lg font-semibold">
              Save and Close
            </StyledText>
          </TouchableButton>
        </SafeView>
      </StyledModal>
    </SafeView>
  );
};

export default OwnerProfile;
