import React, { useState, useEffect } from 'react';
import {
  TextInput,
  Image,
  View,
  Text,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  Modal,
  RefreshControl,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Calendar } from 'react-native-calendars';
import { getFirestore, collection, query, where, getDocs } from 'firebase/firestore';
import { Formik } from 'formik';
import { Picker } from '@react-native-picker/picker';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { useUser } from '@clerk/clerk-expo';
import Slider from '../../components/Slider';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import ConfirmationScreen from '../../components/ConfirmationScreen';

const BookingCalendar = ({ airplaneId, userId }) => {
  const { user } = useUser();
  const navigation = useNavigation();
  const [bookings, setBookings] = useState({});
  const [selectedDate, setSelectedDate] = useState("");
  const [modalVisible, setModalVisible] = useState(false);
  const [profileModalVisible, setProfileModalVisible] = useState(false);
  const [profileSaved, setProfileSaved] = useState(false);
  const [profileData, setProfileData] = useState({
    name: "",
    aircraftType: "",
    certifications: "",
    contact: "",
    address: "",
    category: "",
    cardNumber: "",
    cardExpiry: "",
    cardCVV: "",
    logBooks: null,
    medical: null,
  });
  const [availableRentals, setAvailableRentals] = useState([]);
  const [refreshing, setRefreshing] = useState(false);

  const fetchBookings = async () => {
    if (!airplaneId) return;

    const db = getFirestore();
    const bookingsCollection = collection(db, 'bookings');
    const q = query(bookingsCollection, where('airplaneId', '==', airplaneId));

    try {
      const querySnapshot = await getDocs(q);
      let bookingsData = {};
      querySnapshot.forEach((doc) => {
        const { startDate, endDate } = doc.data();
        bookingsData[startDate] = { marked: true, dotColor: 'red' };
        bookingsData[endDate] = { marked: true, dotColor: 'red' };
      });
      setBookings(bookingsData);
    } catch (error) {
      console.error('Error fetching bookings:', error);
    }
  };

  useEffect(() => {
    fetchBookings();
  }, [airplaneId]);

  const handleDayPress = (day) => {
    setSelectedDate(day.dateString);
    setModalVisible(false);
    fetchAvailableRentals(day.dateString);
  };

  const fetchAvailableRentals = async (date) => {
    const rentals = [
      { name: "Rental 1", description: "Description of Rental 1" },
      { name: "Rental 2", description: "Description of Rental 2" },
    ];

    setAvailableRentals(rentals);

    navigation.navigate('ConfirmationScreen', {
      selectedDate: date,
      availableRentals: rentals,
    });
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

  const pickDocument = async (field) => {
    let result = await DocumentPicker.getDocumentAsync({
      type: ['application/pdf', 'image/*'],
    });

    if (result.type !== 'cancel') {
      setProfileData({ ...profileData, [field]: result.uri });
    }
  };

  const handleProfileSubmit = (values) => {
    setProfileData(values);
    setProfileSaved(true);
    setProfileModalVisible(false);
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchBookings().then(() => {
      setRefreshing(false);
    });
  };

  return (
    <SafeAreaView className="h-full bg-white mt-7">
      <ScrollView
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
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

        {profileSaved ? (
          <View className="px-8 py-4 bg-white">
            <Text className="text-xl font-bold mb-2">Profile Information</Text>
            <View className="flex-row mb-2">
              <Text className="font-bold flex-1">Name:</Text>
              <Text className="flex-2">{profileData.name}</Text>
            </View>
            <View className="flex-row mb-2">
              <Text className="font-bold flex-1">Aircraft Type:</Text>
              <Text className="flex-2">{profileData.aircraftType}</Text>
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
            {profileData.logBooks && (
              <Text className="flex-2 mb-2">
                Log Books Uploaded: {profileData.logBooks.split('/').pop()}
              </Text>
            )}
            {profileData.medical && (
              <Text className="flex-2">
                Medical Uploaded: {profileData.medical.split('/').pop()}
              </Text>
            )}
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
          <TouchableOpacity onPress={() => setModalVisible(true)}>
            <View className="border border-gray-300 rounded-lg p-2 mb-4 bg-white">
              <Text className="text-gray-600">
                {selectedDate ? selectedDate : "Select booking date"}
              </Text>
            </View>
          </TouchableOpacity>

          <Modal
            visible={modalVisible}
            transparent={true}
            animationType="slide"
          >
            <View className="flex-1 justify-center bg-black bg-opacity-50 p-5">
              <Calendar
                onDayPress={handleDayPress}
                markedDates={bookings}
                theme={{
                  selectedDayBackgroundColor: '#007aff',
                  todayTextColor: '#007aff',
                  arrowColor: '#007aff',
                }}
              />
              <TouchableOpacity
                onPress={() => setModalVisible(false)}
                className="mt-4 p-2 bg-white rounded-lg"
              >
                <Text className="text-center">Close</Text>
              </TouchableOpacity>
            </View>
          </Modal>
        </View>
      </ScrollView>

      <Modal visible={profileModalVisible} animationType="slide">
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={{ flex: 1 }}
        >
          <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
            <SafeAreaView>
              <View className="p-4">
                <Formik
                  initialValues={profileData}
                  onSubmit={handleProfileSubmit}
                >
                  {({ handleChange, handleBlur, handleSubmit, values }) => (
                    <View>
                      <Text className="text-xl font-bold mb-4">
                        Edit Profile
                      </Text>
                      <TextInput
                        placeholder="Name"
                        onChangeText={handleChange("name")}
                        onBlur={handleBlur("name")}
                        value={values.name}
                        className="border border-gray-300 rounded-lg p-2 mb-4"
                      />
                      <TextInput
                        placeholder="Aircraft Type"
                        onChangeText={handleChange("aircraftType")}
                        onBlur={handleBlur("aircraftType")}
                        value={values.aircraftType}
                        className="border border-gray-300 rounded-lg p-2 mb-4"
                      />
                      <TextInput
                        placeholder="Certifications"
                        onChangeText={handleChange("certifications")}
                        onBlur={handleBlur("certifications")}
                        value={values.certifications}
                        className="border border-gray-300 rounded-lg p-2 mb-4"
                      />
                      <TextInput
                        placeholder="Contact"
                        onChangeText={handleChange("contact")}
                        onBlur={handleBlur("contact")}
                        value={values.contact}
                        className="border border-gray-300 rounded-lg p-2 mb-4"
                      />
                      <TextInput
                        placeholder="Location"
                        onChangeText={handleChange("address")}
                        onBlur={handleBlur("address")}
                        value={values.address}
                        className="border border-gray-300 rounded-lg p-2 mb-4"
                      />
                      <Text className="font-bold mb-2">Category</Text>
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
                        onPress={() => pickDocument("logBooks")}
                        className="border border-gray-300 rounded-lg p-2 mb-4"
                      >
                        <Text>
                          {values.logBooks ? "Change Log Books" : "Upload Log Books"}
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => pickDocument("medical")}
                        className="border border-gray-300 rounded-lg p-2 mb-4"
                      >
                        <Text>
                          {values.medical ? "Change Medical" : "Upload Medical"}
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={handleSubmit}
                        className="bg-blue-500 rounded-lg p-2 mb-4"
                      >
                        <Text className="text-white text-center">Save Profile</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => setProfileModalVisible(false)}
                        className="bg-gray-500 rounded-lg p-2"
                      >
                        <Text className="text-white text-center">Cancel</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </Formik>
              </View>
            </SafeAreaView>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
};

export default BookingCalendar;
