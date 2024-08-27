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
  ImageBackground,
  StatusBar,
} from 'react-native';
import { getFirestore, collection, query, where, getDocs, updateDoc, doc } from 'firebase/firestore';
import { Formik } from 'formik';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { useUser } from '@clerk/clerk-expo';
import { Ionicons } from '@expo/vector-icons';
import { FontAwesome } from '@expo/vector-icons';
import PropellerImage from '../../Assets/images/propeller-image.jpg';
import wingtipClouds from "../../Assets/images/wingtip_clouds.jpg"; // Import background image

const BookingCalendar = ({ airplaneId, userId }) => {
  const { user } = useUser();
  const [profileModalVisible, setProfileModalVisible] = useState(false);
  const [profileSaved, setProfileSaved] = useState(false);
  const [profileData, setProfileData] = useState({
    name: '',
    aircraftType: '',
    certifications: '',
    contact: '',
    address: '',
    logBooks: null,
    medical: null,
    insurance: null, // New field for insurance
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
      Alert.alert('Rating Submitted', 'Thank you for your feedback!');
    } catch (error) {
      console.error('Error submitting rating:', error);
      Alert.alert('Error', 'Failed to submit rating.');
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
    <View className="flex-1 bg-white">
      {/* Ensure StatusBar is correctly managed */}
      <SafeAreaView className="bg-white">
        <StatusBar barStyle="light-content" />
      </SafeAreaView>

      <ScrollView
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        contentContainerStyle={{ paddingBottom: 16 }}
      >
        {/* Header with Background Image */}
        <ImageBackground
          source={wingtipClouds}
          className="h-56"
          resizeMode="cover"
          style={{ paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0 }}
        >
          <View className="flex-row justify-between items-center p-1">
            <View>
              <Text className="text-sm text-white">Welcome,</Text>
              <Text className="text-lg font-bold text-white">{user?.fullName}</Text>
            </View>

            <TouchableOpacity
              onPress={() => setProfileModalVisible(true)}
              className="bg-white bg-opacity-50 rounded-full p-3"
            >
              <Ionicons name="settings-outline" size={28} color="black" />
            </TouchableOpacity>
          </View>
        </ImageBackground>

        {/* Section Title */}
        <View className="px-4 py-3">
          <Text className="text-2xl font-bold text-gray-900">Manage Your Rentals</Text>
          <Text className="text-md text-gray-600">Update your profile, view rental details, and manage bookings.</Text>
        </View>

        {/* Completed Rentals */}
        <View className="px-4 py-3">
          <Text className="text-xl font-bold mb-4 text-gray-900">Completed Rentals</Text>
          {completedRentals.length > 0 ? (
            completedRentals.map((rental) => (
              <View key={rental.id} className="bg-gray-100 p-4 rounded-2xl mb-4">
                <Text className="font-bold text-gray-900">{rental.renterName}</Text>
                <Text className="text-gray-700">{rental.rentalPeriod}</Text>
                <View className="flex-row items-center mt-2">
                  <Text className="text-gray-800">Rate this renter:</Text>
                  <View className="flex-row ml-4">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <TouchableOpacity
                        key={star}
                        onPress={() => handleRating(rental.id, star)}
                      >
                        <FontAwesome
                          name={star <= (ratings[rental.id] || 0) ? 'star' : 'star-o'}
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
          <View className="px-4 py-3 bg-white shadow-md rounded-3xl">
            <Text className="text-xl font-bold mb-2 text-gray-900">Profile Information</Text>
            <View className="flex-row mb-2">
              <Text className="font-bold flex-1 text-gray-900">Name:</Text>
              <Text className="flex-2 text-gray-600">{profileData.name}</Text>
            </View>
            <View className="flex-row mb-2">
              <Text className="font-bold flex-1 text-gray-900">Aircraft Type:</Text>
              <Text className="flex-2 text-gray-600">{profileData.aircraftType}</Text>
            </View>
            <View className="flex-row mb-2">
              <Text className="font-bold flex-1 text-gray-900">Certifications:</Text>
              <Text className="flex-2 text-gray-600">{profileData.certifications}</Text>
            </View>
            <View className="flex-row mb-2">
              <Text className="font-bold flex-1 text-gray-900">Contact:</Text>
              <Text className="flex-2 text-gray-600">{profileData.contact}</Text>
            </View>
            <View className="flex-row mb-2">
              <Text className="font-bold flex-1 text-gray-900">Location:</Text>
              <Text className="flex-2 text-gray-600">{profileData.address}</Text>
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
            {profileData.insurance && (
              <Text className="flex-2 text-gray-600">
                Insurance Uploaded: {profileData.insurance.split('/').pop()}
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
          <View className="px-4 py-3 bg-white shadow-md rounded-3xl">
            <Text className="text-xl font-bold mb-2 text-gray-900">No Profile Information Available</Text>
          </View>
        )}
      </ScrollView>

      {/* Profile Modal */}
      <Modal visible={profileModalVisible} animationType="slide">
        <SafeAreaView className="flex-1 bg-gray-100">
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            className="flex-1 justify-center items-center bg-black bg-opacity-50"
          >
            <ScrollView className="w-full max-w-lg">
              <View className="bg-white rounded-3xl p-6 w-full shadow-xl">
                <Text className="text-2xl font-bold mb-6 text-center text-gray-900">Edit Profile</Text>
                <Formik
                  initialValues={profileData}
                  onSubmit={handleProfileSubmit}
                >
                  {({ handleChange, handleBlur, handleSubmit, values }) => (
                    <>
                      <TextInput
                        placeholder="Name"
                        onChangeText={handleChange('name')}
                        onBlur={handleBlur('name')}
                        value={values.name}
                        className="border-b border-gray-300 mb-4 p-2 text-gray-900"
                      />
                      <TextInput
                        placeholder="Aircraft Type"
                        onChangeText={handleChange('aircraftType')}
                        onBlur={handleBlur('aircraftType')}
                        value={values.aircraftType}
                        className="border-b border-gray-300 mb-4 p-2 text-gray-900"
                      />
                      <TextInput
                        placeholder="Certifications"
                        onChangeText={handleChange('certifications')}
                        onBlur={handleBlur('certifications')}
                        value={values.certifications}
                        className="border-b border-gray-300 mb-4 p-2 text-gray-900"
                      />
                      <TextInput
                        placeholder="Contact"
                        onChangeText={handleChange('contact')}
                        onBlur={handleBlur('contact')}
                        value={values.contact}
                        className="border-b border-gray-300 mb-4 p-2 text-gray-900"
                      />
                      <TextInput
                        placeholder="Location"
                        onChangeText={handleChange('address')}
                        onBlur={handleBlur('address')}
                        value={values.address}
                        className="border-b border-gray-300 mb-4 p-2 text-gray-900"
                      />
                      <TouchableOpacity
                        onPress={() => pickDocument('logBooks')}
                        className="border-b border-gray-300 rounded-lg p-2 mb-4 bg-white"
                      >
                        <Text className="text-gray-800">
                          {values.logBooks ? `Logbook Uploaded: ${values.logBooks.split('/').pop()}` : 'Upload Recent Logbook Page'}
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => pickDocument('medical')}
                        className="border-b border-gray-300 rounded-lg p-2 mb-4 bg-white"
                      >
                        <Text className="text-gray-800">
                          {values.medical ? `Medical Uploaded: ${values.medical.split('/').pop()}` : 'Upload Medical'}
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => pickDocument('insurance')}
                        className="border-b border-gray-300 rounded-lg p-2 mb-4 bg-white"
                      >
                        <Text className="text-gray-800">
                          {values.insurance ? `Insurance Uploaded: ${values.insurance.split('/').pop()}` : 'Upload Proof of Insurance'}
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={handleSubmit}
                        className="bg-blue-500 py-3 px-6 rounded-full mb-4"
                      >
                        <Text className="text-white text-center">Save Profile</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => setProfileModalVisible(false)}
                        className="bg-gray-500 py-3 px-6 rounded-full"
                      >
                        <Text className="text-white text-center">Cancel</Text>
                      </TouchableOpacity>
                    </>
                  )}
                </Formik>
              </View>
            </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>
    </View>
  );
};

export default BookingCalendar;
