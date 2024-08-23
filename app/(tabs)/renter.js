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
  Alert,
} from 'react-native';
import { getFirestore, collection, query, where, getDocs, updateDoc, doc } from 'firebase/firestore';
import { Formik } from 'formik';
import { Picker } from '@react-native-picker/picker';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { useUser } from '@clerk/clerk-expo';
import { Ionicons } from '@expo/vector-icons';
import { FontAwesome } from '@expo/vector-icons';
import { styled } from 'nativewind';

const BookingCalendar = ({ airplaneId, userId }) => {
  const { user } = useUser();
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
  const [refreshing, setRefreshing] = useState(false);
  const [completedRentals, setCompletedRentals] = useState([]);
  const [ratings, setRatings] = useState({});

  useEffect(() => {
    fetchCompletedRentals();
  }, []);

  const fetchCompletedRentals = async () => {
    const db = getFirestore();
    const rentalsRef = collection(db, 'orders');
    const q = query(rentalsRef, where('ownerId', '==', userId), where('status', '==', 'completed'));

    try {
      const querySnapshot = await getDocs(q);
      const rentals = [];
      querySnapshot.forEach((doc) => {
        rentals.push({ id: doc.id, ...doc.data() });
      });
      setCompletedRentals(rentals);
    } catch (error) {
      console.error('Error fetching completed rentals:', error);
    }
  };

  const handleRating = async (rentalId, rating) => {
    const db = getFirestore();
    try {
      const rentalDocRef = doc(db, 'orders', rentalId);
      await updateDoc(rentalDocRef, { rating });
      setRatings((prevRatings) => ({ ...prevRatings, [rentalId]: rating }));
      Alert.alert("Rating Submitted", "Thank you for your feedback!");
    } catch (error) {
      console.error("Error submitting rating:", error);
      Alert.alert("Error", "Failed to submit rating.");
    }
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
    fetchCompletedRentals();
    setRefreshing(false);
  };

  return (
    <SafeAreaView className="flex-1 bg-white">
      <ScrollView
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        contentContainerStyle={{ paddingBottom: 16 }}
      >
        {/* Header */}
        <View className="flex-row p-4 items-center bg-gray-100">
          <Image
            source={{ uri: user?.imageUrl }}
            className="w-12 h-12 rounded-full mr-3"
          />
          <View>
            <Text className="text-sm text-gray-600">Welcome</Text>
            <Text className="text-lg font-bold text-gray-800">{user?.fullName}</Text>
          </View>
          <TouchableOpacity onPress={() => setProfileModalVisible(true)} className="ml-auto">
            <Ionicons name="settings-outline" size={28} color="black" />
          </TouchableOpacity>
        </View>

        {/* Section Title */}
        <View className="px-4 py-3 bg-gray-100">
          <Text className="text-2xl font-bold text-gray-800">Manage Your Rentals</Text>
          <Text className="text-md text-gray-600">Update your profile, view rental details, and manage bookings.</Text>
        </View>

        {/* Completed Rentals */}
        <View className="px-4 py-3">
          <Text className="text-xl font-bold mb-4 text-gray-800">Completed Rentals</Text>
          {completedRentals.length > 0 ? (
            completedRentals.map((rental) => (
              <View key={rental.id} className="bg-white shadow-md p-4 rounded-lg mb-4">
                <Text className="font-bold text-gray-800">{rental.renterName}</Text>
                <Text className="text-gray-600">{rental.rentalPeriod}</Text>
                <View className="flex-row items-center mt-2">
                  <Text className="text-gray-800">Rate this renter:</Text>
                  <View className="flex-row ml-4">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <TouchableOpacity
                        key={star}
                        onPress={() => handleRating(rental.id, star)}
                      >
                        <FontAwesome
                          name={star <= (ratings[rental.id] || 0) ? "star" : "star-o"}
                          size={24}
                          color="gold"
                        />
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              </View>
            ))
          ) : (
            <Text className="text-center text-gray-600">No completed rentals available.</Text>
          )}
        </View>

        {/* Profile Information */}
        {profileSaved ? (
          <View className="px-4 py-3 bg-white shadow-md rounded-lg">
            <Text className="text-xl font-bold mb-2 text-gray-800">Profile Information</Text>
            <View className="flex-row mb-2">
              <Text className="font-bold flex-1 text-gray-800">Name:</Text>
              <Text className="flex-2 text-gray-600">{profileData.name}</Text>
            </View>
            <View className="flex-row mb-2">
              <Text className="font-bold flex-1 text-gray-800">Aircraft Type:</Text>
              <Text className="flex-2 text-gray-600">{profileData.aircraftType}</Text>
            </View>
            <View className="flex-row mb-2">
              <Text className="font-bold flex-1 text-gray-800">Certifications:</Text>
              <Text className="flex-2 text-gray-600">{profileData.certifications}</Text>
            </View>
            <View className="flex-row mb-2">
              <Text className="font-bold flex-1 text-gray-800">Contact:</Text>
              <Text className="flex-2 text-gray-600">{profileData.contact}</Text>
            </View>
            <View className="flex-row mb-2">
              <Text className="font-bold flex-1 text-gray-800">Location:</Text>
              <Text className="flex-2 text-gray-600">{profileData.address}</Text>
            </View>
            <View className="flex-row mb-2">
              <Text className="font-bold flex-1 text-gray-800">Category:</Text>
              <Text className="flex-2 text-gray-600">
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
              <Text className="flex-2 mb-2 text-gray-600">
                Log Books Uploaded: {profileData.logBooks.split('/').pop()}
              </Text>
            )}
            {profileData.medical && (
              <Text className="flex-2 text-gray-600">
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
          <View className="px-4 py-3 bg-white shadow-md rounded-lg">
            <Text className="text-xl font-bold mb-2 text-gray-800">No Profile Information Available</Text>
          </View>
        )}
      </ScrollView>

      {/* Profile Modal */}
      <Modal visible={profileModalVisible} animationType="slide">
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          className="flex-1 bg-gray-100"
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
                      <Text className="text-xl font-bold mb-4 text-gray-800">Edit Profile</Text>
                      <TextInput
                        placeholder="Name"
                        onChangeText={handleChange("name")}
                        onBlur={handleBlur("name")}
                        value={values.name}
                        className="border border-gray-300 rounded-lg p-2 mb-4 bg-white"
                      />
                      <TextInput
                        placeholder="Aircraft Type"
                        onChangeText={handleChange("aircraftType")}
                        onBlur={handleBlur("aircraftType")}
                        value={values.aircraftType}
                        className="border border-gray-300 rounded-lg p-2 mb-4 bg-white"
                      />
                      <TextInput
                        placeholder="Certifications"
                        onChangeText={handleChange("certifications")}
                        onBlur={handleBlur("certifications")}
                        value={values.certifications}
                        className="border border-gray-300 rounded-lg p-2 mb-4 bg-white"
                      />
                      <TextInput
                        placeholder="Contact"
                        onChangeText={handleChange("contact")}
                        onBlur={handleBlur("contact")}
                        value={values.contact}
                        className="border border-gray-300 rounded-lg p-2 mb-4 bg-white"
                      />
                      <TextInput
                        placeholder="Location"
                        onChangeText={handleChange("address")}
                        onBlur={handleBlur("address")}
                        value={values.address}
                        className="border border-gray-300 rounded-lg p-2 mb-4 bg-white"
                      />
                      <Text className="font-bold mb-2 text-gray-800">Category</Text>
                      <Picker
                        selectedValue={values.category}
                        onValueChange={handleChange("category")}
                        className="border border-gray-300 rounded-lg mb-4 bg-white"
                      >
                        <Picker.Item label="Single Engine Prop" value="single_engine" />
                        <Picker.Item label="Twin Engine Prop" value="twin_engine" />
                        <Picker.Item label="Turbo Prop" value="turbo_prop" />
                        <Picker.Item label="Helicopter" value="helicopter" />
                        <Picker.Item label="Jet" value="jet" />
                      </Picker>
                      <TouchableOpacity
                        onPress={() => pickDocument("logBooks")}
                        className="border border-gray-300 rounded-lg p-2 mb-4 bg-white"
                      >
                        <Text className="text-gray-800">
                          {values.logBooks ? "Change Log Books" : "Upload Recent Logbook Page"}
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => pickDocument("medical")}
                        className="border border-gray-300 rounded-lg p-2 mb-4 bg-white"
                      >
                        <Text className="text-gray-800">
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
