import React, { useState, useEffect } from "react";
import {
  TextInput,
  Image,
  View,
  Text,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  Modal,
  Alert,
} from "react-native";
import { Calendar } from "react-native-calendars";
import {
  getFirestore,
  collection,
  query,
  where,
  getDocs,
} from "firebase/firestore";
import { createMaterialTopTabNavigator } from "@react-navigation/material-top-tabs";
import { Formik } from "formik";
import { Picker } from "@react-native-picker/picker";
import * as ImagePicker from "expo-image-picker";
import { useUser } from "@clerk/clerk-expo";
import Slider from "../../components/Slider";
import { Ionicons } from "@expo/vector-icons";

const Tab = createMaterialTopTabNavigator();

const BookingCalendar = ({ airplaneId, userId }) => {
  const { user } = useUser();
  const [bookings, setBookings] = useState({});
  const [selectedDate, setSelectedDate] = useState("");
  const [selectedDates, setSelectedDates] = useState({});
  const [modalVisible, setModalVisible] = useState(false);
  const [profileModalVisible, setProfileModalVisible] = useState(false);
  const [profileSaved, setProfileSaved] = useState(false);
  const [profileData, setProfileData] = useState({
    name: "",
    certifications: "",
    contact: "",
    address: "",
    category: "",
  });

  useEffect(() => {
    const fetchBookings = async () => {
      if (!airplaneId) {
        console.error("airplaneId is undefined");
        return;
      }

      const db = getFirestore();
      const bookingsCollection = collection(db, "bookings");
      const q = query(bookingsCollection, where("airplaneId", "==", airplaneId));

      try {
        const querySnapshot = await getDocs(q);
        let bookingsData = {};
        querySnapshot.forEach((doc) => {
          const { startDate, endDate } = doc.data();
          bookingsData[startDate] = { marked: true, dotColor: "red" };
          bookingsData[endDate] = { marked: true, dotColor: "red" };
        });
        setBookings(bookingsData);
      } catch (error) {
        console.error("Error fetching bookings:", error);
      }
    };

    fetchBookings();
  }, [airplaneId]);

  const handleDayPress = (day) => {
    setSelectedDate(day.dateString);
  };

  const pickImage = async () => {
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.All,
      allowsEditing: true,
      aspect: [4, 4],
      quality: 1,
    });

    if (!result.canceled) {
      setProfileData({ ...profileData, image: result.assets[0].uri });
    }
  };

  const handleProfileSubmit = (values) => {
    setProfileData(values);
    setProfileSaved(true);
    setProfileModalVisible(false);
  };

  return (
    <SafeAreaView className="h-full bg-white mt-7">
      <ScrollView>
        {/* Header with Welcome and Settings Button */}
        <View className="flex-row justify-between items-center px-4 py-3">
          <View className="flex-row items-center">
            <Image
              source={{ uri: user?.imageUrl }}
              className="rounded-full w-12 h-12"
            />
            <View className="ml-2">
              <Text className="text-[16px]">Welcome</Text>
              <Text className="text-[20px] font-bold">{user?.fullName}</Text>
            </View>
          </View>
          <TouchableOpacity onPress={() => setProfileModalVisible(true)}>
            <Ionicons name="settings-outline" size={28} color="black" />
          </TouchableOpacity>
        </View>

        <Slider />

        <View className="flex-1 bg-white">
          <Text className="font-rubikblack text-4xl text-gray-800 px-8">
            Renter Dashboard
          </Text>
        </View>

        {/* Profile Section */}
        {profileSaved ? (
          <View className="px-8 py-4 bg-white">
            <Text className="text-xl font-bold mb-2">Profile Information</Text>
            <View className="flex-row mb-2">
              <Text className="font-bold flex-1">Name:</Text>
              <Text className="flex-2">{profileData.name}</Text>
            </View>
            <View className="flex-row mb-2">
              <Text className="font-bold flex-1">Certifications:</Text>
              <Text className="flex-2">{profileData.certifications}</Text>
            </View>
            <View className="flex-row mb-2">
              <Text className="font-bold flex-1">Contact:</Text>
              <Text className="flex-2">{profileData.contact}</Text>
            </View>
            <View className="flex-row mb-2">
              <Text className="font-bold flex-1">Location:</Text>
              <Text className="flex-2">{profileData.address}</Text>
            </View>
            <View className="flex-row mb-2">
              <Text className="font-bold flex-1">Category:</Text>
              <Text className="flex-2">
                {profileData.category === "single_engine"
                  ? "Single Engine Prop"
                  : profileData.category === "twin_engine"
                  ? "Twin Engine Prop"
                  : profileData.category === "turbo_prop"
                  ? "Turbo Prop"
                  : profileData.category === "helicopter"
                  ? "Helicopter"
                  : "Jet"}
              </Text>
            </View>
            {profileData.image && (
              <Image
                source={{ uri: profileData.image }}
                className="w-36 h-36 rounded-lg mt-2"
              />
            )}
          </View>
        ) : (
          <View className="px-8 py-4">
            <Text className="text-xl font-bold mb-2">
              No Profile Information Available
            </Text>
          </View>
        )}

        <TouchableOpacity onPress={pickImage}>
          <View className="pl-8">
            <Image
              source={require("../../Assets/images/Placeholder_view_vector.png")}
              className="w-36 h-36 rounded-lg mt-4"
            />
          </View>
        </TouchableOpacity>

        <View className="p-4">
          <TextInput
            className="border border-gray-300 rounded-lg p-2 mb-4"
            placeholder="Select booking dates"
            value={Object.keys(selectedDates).join(", ")}
            onFocus={() => setModalVisible(true)}
          />
          <Modal
            visible={modalVisible}
            transparent={true}
            animationType="slide"
          >
            <View className="flex-1 justify-center bg-black bg-opacity-50 p-5">
              <Calendar
                onDayPress={handleDayPress}
                markedDates={selectedDates}
              />
              <TouchableOpacity
                onPress={() => setModalVisible(false)}
                className="bg-white p-3 mt-3 rounded-lg"
              >
                <Text className="text-center text-blue-500 font-bold">
                  Close
                </Text>
              </TouchableOpacity>
            </View>
          </Modal>
        </View>
      </ScrollView>

      {/* Profile Modal */}
      <Modal
        visible={profileModalVisible}
        transparent={true}
        animationType="slide"
      >
        <View className="flex-1 justify-center bg-black bg-opacity-50 p-5">
          <Formik initialValues={profileData} onSubmit={handleProfileSubmit}>
            {({ handleChange, handleSubmit, values }) => (
              <View className="bg-white p-5 rounded-lg">
                <Text className="text-xl font-bold mb-4">Edit Profile</Text>
                <TextInput
                  className="border border-gray-300 rounded-lg p-2 mb-4"
                  placeholder="Name"
                  value={values.name}
                  onChangeText={handleChange("name")}
                />
                <TextInput
                  className="border border-gray-300 rounded-lg p-2 mb-4"
                  placeholder="Certifications"
                  value={values.certifications}
                  onChangeText={handleChange("certifications")}
                />
                <TextInput
                  className="border border-gray-300 rounded-lg p-2 mb-4"
                  placeholder="Contact"
                  value={values.contact}
                  onChangeText={handleChange("contact")}
                />
                <TextInput
                  className="border border-gray-300 rounded-lg p-2 mb-4"
                  placeholder="Location"
                  value={values.address}
                  onChangeText={handleChange("address")}
                />
                <Picker
                  selectedValue={values.category}
                  onValueChange={handleChange("category")}
                  className="border border-gray-300 rounded-lg mb-4"
                >
                  <Picker.Item label="Single Engine Prop" value="single_engine" />
                  <Picker.Item label="Twin Engine Prop" value="twin_engine" />
                  <Picker.Item label="Turbo Prop" value="turbo_prop" />
                  <Picker.Item label="Helicopter" value="helicopter" />
                  <Picker.Item label="Jet" value="jet" />
                </Picker>
                <TouchableOpacity
                  onPress={handleSubmit}
                  className="bg-blue-500 p-4 rounded-lg mt-2"
                >
                  <Text className="text-center text-white font-bold">
                    Save Profile
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </Formik>
          <TouchableOpacity
            onPress={() => setProfileModalVisible(false)}
            className="bg-white p-3 mt-3 rounded-lg"
          >
            <Text className="text-center text-blue-500 font-bold">Close</Text>
          </TouchableOpacity>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

export default BookingCalendar;
