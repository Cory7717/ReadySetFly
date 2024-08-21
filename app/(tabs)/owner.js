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
import { getFirestore, collection, addDoc, doc, getDoc } from "firebase/firestore";
import * as ImagePicker from "expo-image-picker";
import { useUser } from "@clerk/clerk-expo";
import { Picker } from "@react-native-picker/picker";
import { Ionicons } from "@expo/vector-icons";
import DatePicker from "react-native-modern-datepicker";
import { styled } from 'nativewind';
import FontAwesome6 from '@expo/vector-icons/FontAwesome6';

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
  const [location, setLocation] = useState("");
  const [airplaneYear, setAirplaneYear] = useState("");
  const [description, setDescription] = useState("");
  const [isAnnualCurrent, setIsAnnualCurrent] = useState(""); 
  const [profileImage, setProfileImage] = useState(null);
  const [aircraftImages, setAircraftImages] = useState([]);
  const [bankDetailsVisible, setBankDetailsVisible] = useState(false);
  const [availabilityModalVisible, setAvailabilityModalVisible] = useState(false);
  const [selectedDates, setSelectedDates] = useState([]);
  const [currentDate, setCurrentDate] = useState(""); 
  const [bankAccountName, setBankAccountName] = useState("");
  const [bankAccountNumber, setBankAccountNumber] = useState("");
  const [bankRoutingNumber, setBankRoutingNumber] = useState("");
  const [cumulativeEarnings, setCumulativeEarnings] = useState(0);
  const [minRequiredHours, setMinRequiredHours] = useState("");
  const { user } = useUser();

  useEffect(() => {
    const fetchCumulativeEarnings = async () => {
      const db = getFirestore();
      const ownerDocRef = doc(db, "owners", ownerId);
      const ownerDoc = await getDoc(ownerDocRef);

      if (ownerDoc.exists()) {
        const data = ownerDoc.data();
        setCumulativeEarnings(data.cumulativeEarnings || 0);
      }
    };

    if (ownerId) {
      fetchCumulativeEarnings();
    }
  }, [ownerId]);

  const pickImages = async () => {
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 1,
    });

    if (!result.canceled) {
      const selectedImages = result.assets.slice(0, 7).map((asset) => asset.uri);
      setAircraftImages((prevImages) => [...prevImages, ...selectedImages]);
    }
  };

  const handleUpload = async () => {
    console.log('airplaneName:', airplaneName);
    console.log('airplaneModel:', airplaneModel);
    console.log('location:', location);
    console.log('airplaneYear:', airplaneYear);
    console.log('description:', description);
    console.log('isAnnualCurrent:', isAnnualCurrent);
    console.log('minRequiredHours:', minRequiredHours);
    console.log('selectedDates:', selectedDates);

    if (
      !airplaneName ||
      !airplaneModel ||
      !location ||
      !airplaneYear ||
      !description ||
      !isAnnualCurrent ||
      !minRequiredHours ||
      selectedDates.length === 0
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
        availability: selectedDates,
        location,
        airplaneYear,
        description,
        isAnnualCurrent,
        minRequiredHours,
        profileImage,
        aircraftImages,
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
            <FontAwesome6 name="comment-dollar" size={32} color="gray" />
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

          <StyledTextInput
            placeholder="Minimum Required Hours"
            value={minRequiredHours}
            onChangeText={setMinRequiredHours}
            keyboardType="numeric"
            className="border-gray-300 border rounded-md p-3"
          />

          <TouchableButton
            onPress={handleUpload}
            className="p-4 bg-blue-600 rounded-md"
          >
            <StyledText className="text-center text-white">Update Profile and Airplane Listing</StyledText>
          </TouchableButton>
        </WrapperView>

        <StyledModal visible={availabilityModalVisible} animationType="slide">
          <WrapperView className="flex-1 justify-center items-center bg-white">
            <StyledText className="text-xl mb-6">Select Availability Dates</StyledText>
            <DatePicker
              mode="calendar"
              selected={currentDate}
              onDateChange={(date) => setCurrentDate(date)}
              options={{
                backgroundColor: '#ffffff',
                textHeaderColor: '#000000',
                textDefaultColor: '#000000',
                selectedTextColor: '#ffffff',
                mainColor: '#1E90FF',
                textSecondaryColor: '#D3D3D3',
                borderColor: 'rgba(122, 146, 165, 0.1)',
              }}
              current={currentDate}
            />

            <TouchableButton
              onPress={() => {
                if (currentDate) {
                  setSelectedDates((prevDates) => [...prevDates, currentDate]);
                  setCurrentDate("");
                }
                setAvailabilityModalVisible(false);
              }}
              className="p-4 bg-blue-600 rounded-md mt-4"
            >
              <StyledText className="text-center text-white">Save Availability</StyledText>
            </TouchableButton>

            <TouchableButton
              onPress={() => setAvailabilityModalVisible(false)}
              className="p-4 bg-red-600 rounded-md mt-4"
            >
              <StyledText className="text-center text-white">Cancel</StyledText>
            </TouchableButton>
          </WrapperView>
        </StyledModal>

        <StyledModal visible={bankDetailsVisible} animationType="slide">
          <WrapperView className="flex-1 justify-center items-center bg-white">
            <StyledText className="text-xl mb-6">Enter Bank Details</StyledText>
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
            <TouchableButton
              onPress={() => setBankDetailsVisible(false)}
              className="p-4 bg-blue-600 rounded-md"
            >
              <StyledText className="text-center text-white">Save Bank Details</StyledText>
            </TouchableButton>
          </WrapperView>
        </StyledModal>
      </ScrollContainer>
    </SafeView>
  );
};

export default OwnerProfile;
