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
import { getFirestore, collection, query, where, getDocs, addDoc, updateDoc, doc } from 'firebase/firestore';
import { Formik } from 'formik';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { useUser } from '@clerk/clerk-expo';
import { Ionicons, FontAwesome } from '@expo/vector-icons';
import wingtipClouds from '../../Assets/images/wingtip_clouds.jpg';

const BookingCalendar = ({ airplaneId, ownerId }) => {
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
    insurance: null,
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
    const q = query(rentalsRef, where('ownerId', '==', ownerId), where('status', '==', 'completed'));

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

  const handleSendMessageToOwner = async (rentalDetails) => {
    const db = getFirestore();
    try {
      const message = `
        Renter Name: ${user.fullName}
        Contact: ${profileData.contact || 'N/A'}
        Aircraft: ${rentalDetails.airplaneModel}
        Rental Period: ${rentalDetails.rentalPeriod}
        Total Cost: $${rentalDetails.totalCost}
      `;

      await addDoc(collection(db, 'owners', ownerId, 'messages'), {
        senderId: user.id,
        senderName: user.fullName,
        message,
        createdAt: new Date(),
      });

      Alert.alert('Message Sent', 'Your rental request has been sent to the owner.');
    } catch (error) {
      console.error('Error sending message:', error);
      Alert.alert('Error', 'Failed to send message to the owner.');
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchCompletedRentals();
    setRefreshing(false);
  };

  return (
    <View style={{ flex: 1, backgroundColor: 'white' }}>
      <SafeAreaView style={{ backgroundColor: 'white' }}>
        <StatusBar barStyle="light-content" />
      </SafeAreaView>

      <ScrollView
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        contentContainerStyle={{ paddingBottom: 16 }}
      >
        <ImageBackground
          source={wingtipClouds}
          style={{
            height: 224,
            paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
          }}
          resizeMode="cover"
        >
          <SafeAreaView style={{ flex: 1 }}>
            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
                paddingHorizontal: 16,
                paddingTop: 8, // Add some padding at the top
              }}
            >
              <View>
                <Text style={{ fontSize: 14, color: 'white' }}>Welcome,</Text>
                <Text style={{ fontSize: 18, fontWeight: 'bold', color: 'white' }}>
                  {user?.fullName}
                </Text>
              </View>

              <TouchableOpacity
                onPress={() => setProfileModalVisible(true)}
                style={{
                  backgroundColor: 'white',
                  opacity: 0.5,
                  borderRadius: 50,
                  padding: 8,
                }}
              >
                <Ionicons name="settings-outline" size={28} color="black" />
              </TouchableOpacity>
            </View>
          </SafeAreaView>
        </ImageBackground>

        <View style={{ paddingHorizontal: 16, paddingVertical: 12 }}>
          <Text style={{ fontSize: 24, fontWeight: 'bold', color: '#2d3748' }}>Manage Your Rentals</Text>
          <Text style={{ fontSize: 14, color: '#718096' }}>
            Update your profile, view rental details, and manage bookings.
          </Text>
        </View>

        <View style={{ paddingHorizontal: 16, paddingVertical: 12 }}>
          <Text style={{ fontSize: 20, fontWeight: 'bold', color: '#2d3748', marginBottom: 16 }}>
            Completed Rentals
          </Text>
          {completedRentals.length > 0 ? (
            completedRentals.map((rental) => (
              <View
                key={rental.id}
                style={{
                  backgroundColor: '#edf2f7',
                  padding: 16,
                  borderRadius: 16,
                  marginBottom: 16,
                }}
              >
                <Text style={{ fontWeight: 'bold', color: '#2d3748' }}>{rental.renterName}</Text>
                <Text style={{ color: '#4a5568' }}>{rental.rentalPeriod}</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8 }}>
                  <Text style={{ color: '#2d3748' }}>Rate this renter:</Text>
                  <View style={{ flexDirection: 'row', marginLeft: 16 }}>
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
            <Text style={{ textAlign: 'center', color: '#718096' }}>
              No completed rentals available.
            </Text>
          )}
        </View>

        {profileSaved ? (
          <View
            style={{
              paddingHorizontal: 16,
              paddingVertical: 12,
              backgroundColor: 'white',
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 1 },
              shadowOpacity: 0.22,
              shadowRadius: 2.22,
              elevation: 3,
              borderRadius: 24,
              marginBottom: 16,
            }}
          >
            <Text style={{ fontSize: 20, fontWeight: 'bold', color: '#2d3748', marginBottom: 8 }}>
              Profile Information
            </Text>
            <View style={{ flexDirection: 'row', marginBottom: 8 }}>
              <Text style={{ fontWeight: 'bold', color: '#2d3748', flex: 1 }}>Name:</Text>
              <Text style={{ color: '#718096', flex: 2 }}>{profileData.name}</Text>
            </View>
            <View style={{ flexDirection: 'row', marginBottom: 8 }}>
              <Text style={{ fontWeight: 'bold', color: '#2d3748', flex: 1 }}>Aircraft Type:</Text>
              <Text style={{ color: '#718096', flex: 2 }}>{profileData.aircraftType}</Text>
            </View>
            <View style={{ flexDirection: 'row', marginBottom: 8 }}>
              <Text style={{ fontWeight: 'bold', color: '#2d3748', flex: 1 }}>Certifications:</Text>
              <Text style={{ color: '#718096', flex: 2 }}>{profileData.certifications}</Text>
            </View>
            <View style={{ flexDirection: 'row', marginBottom: 8 }}>
              <Text style={{ fontWeight: 'bold', color: '#2d3748', flex: 1 }}>Contact:</Text>
              <Text style={{ color: '#718096', flex: 2 }}>{profileData.contact}</Text>
            </View>
            <View style={{ flexDirection: 'row', marginBottom: 8 }}>
              <Text style={{ fontWeight: 'bold', color: '#2d3748', flex: 1 }}>Location:</Text>
              <Text style={{ color: '#718096', flex: 2 }}>{profileData.address}</Text>
            </View>
            {profileData.logBooks && (
              <Text style={{ color: '#718096', marginBottom: 8 }}>
                Log Books Uploaded: {profileData.logBooks.split('/').pop()}
              </Text>
            )}
            {profileData.medical && (
              <Text style={{ color: '#718096', marginBottom: 8 }}>
                Medical Uploaded: {profileData.medical.split('/').pop()}
              </Text>
            )}
            {profileData.insurance && (
              <Text style={{ color: '#718096', marginBottom: 8 }}>
                Insurance Uploaded: {profileData.insurance.split('/').pop()}
              </Text>
            )}
            {profileData.image && (
              <Image
                source={{ uri: profileData.image }}
                style={{ width: 144, height: 144, borderRadius: 8, marginTop: 8 }}
              />
            )}
          </View>
        ) : (
          <View
            style={{
              paddingHorizontal: 16,
              paddingVertical: 12,
              backgroundColor: 'white',
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 1 },
              shadowOpacity: 0.22,
              shadowRadius: 2.22,
              elevation: 3,
              borderRadius: 24,
              marginBottom: 16,
            }}
          >
            <Text style={{ fontSize: 20, fontWeight: 'bold', color: '#2d3748', marginBottom: 8 }}>
              No Profile Information Available
            </Text>
          </View>
        )}
      </ScrollView>

      <Modal visible={profileModalVisible} animationType="slide">
        <SafeAreaView style={{ flex: 1, backgroundColor: '#f7fafc' }}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}
          >
            <ScrollView
              contentContainerStyle={{
                flexGrow: 1,
                justifyContent: 'center',
                alignItems: 'center',
              }}
              style={{ width: '100%', maxWidth: 320 }}
            >
              <View
                style={{
                  backgroundColor: 'white',
                  borderRadius: 24,
                  padding: 24,
                  width: '100%',
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: 0.2,
                  shadowRadius: 8,
                }}
              >
                <Text style={{ fontSize: 24, fontWeight: 'bold', marginBottom: 24, textAlign: 'center', color: '#2d3748' }}>
                  Edit Profile
                </Text>
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
                        style={{ borderBottomWidth: 1, borderBottomColor: '#cbd5e0', marginBottom: 16, padding: 8, color: '#2d3748' }}
                      />
                      <TextInput
                        placeholder="Aircraft Type"
                        onChangeText={handleChange('aircraftType')}
                        onBlur={handleBlur('aircraftType')}
                        value={values.aircraftType}
                        style={{ borderBottomWidth: 1, borderBottomColor: '#cbd5e0', marginBottom: 16, padding: 8, color: '#2d3748' }}
                      />
                      <TextInput
                        placeholder="Certifications"
                        onChangeText={handleChange('certifications')}
                        onBlur={handleBlur('certifications')}
                        value={values.certifications}
                        style={{ borderBottomWidth: 1, borderBottomColor: '#cbd5e0', marginBottom: 16, padding: 8, color: '#2d3748' }}
                      />
                      <TextInput
                        placeholder="Contact"
                        onChangeText={handleChange('contact')}
                        onBlur={handleBlur('contact')}
                        value={values.contact}
                        style={{ borderBottomWidth: 1, borderBottomColor: '#cbd5e0', marginBottom: 16, padding: 8, color: '#2d3748' }}
                      />
                      <TextInput
                        placeholder="Location"
                        onChangeText={handleChange('address')}
                        onBlur={handleBlur('address')}
                        value={values.address}
                        style={{ borderBottomWidth: 1, borderBottomColor: '#cbd5e0', marginBottom: 16, padding: 8, color: '#2d3748' }}
                      />
                      <TouchableOpacity
                        onPress={() => pickDocument('logBooks')}
                        style={{ borderBottomWidth: 1, borderBottomColor: '#cbd5e0', padding: 8, backgroundColor: 'white', borderRadius: 8, marginBottom: 16 }}
                      >
                        <Text style={{ color: '#2d3748' }}>
                          {values.logBooks ? `Logbook Uploaded: ${values.logBooks.split('/').pop()}` : 'Upload Recent Logbook Page'}
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => pickDocument('medical')}
                        style={{ borderBottomWidth: 1, borderBottomColor: '#cbd5e0', padding: 8, backgroundColor: 'white', borderRadius: 8, marginBottom: 16 }}
                      >
                        <Text style={{ color: '#2d3748' }}>
                          {values.medical ? `Medical Uploaded: ${values.medical.split('/').pop()}` : 'Upload Medical'}
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => pickDocument('insurance')}
                        style={{ borderBottomWidth: 1, borderBottomColor: '#cbd5e0', padding: 8, backgroundColor: 'white', borderRadius: 8, marginBottom: 16 }}
                      >
                        <Text style={{ color: '#2d3748' }}>
                          {values.insurance ? `Insurance Uploaded: ${values.insurance.split('/').pop()}` : 'Upload Proof of Insurance'}
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={handleSubmit}
                        style={{ backgroundColor: '#3182ce', paddingVertical: 16, paddingHorizontal: 24, borderRadius: 50, marginBottom: 16 }}
                      >
                        <Text style={{ color: 'white', textAlign: 'center', fontWeight: 'bold' }}>
                          Save Profile
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => setProfileModalVisible(false)}
                        style={{ backgroundColor: '#718096', paddingVertical: 16, paddingHorizontal: 24, borderRadius: 50 }}
                      >
                        <Text style={{ color: 'white', textAlign: 'center', fontWeight: 'bold' }}>
                          Cancel
                        </Text>
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
