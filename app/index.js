import React, { useEffect, useState } from 'react';
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer } from '@react-navigation/native';
import { StripeProvider } from '@stripe/stripe-react-native';
import { Stack } from 'expo-router';
import { View, Text, Image, ScrollView, TouchableOpacity, StyleSheet, Modal, TextInput, KeyboardAvoidingView, Platform } from 'react-native';
import { Picker } from '@react-native-picker/picker'; // Import Picker for dropdowns
import { onAuthStateChanged, updateProfile } from 'firebase/auth';
import { auth, db } from '../firebaseConfig';
import { doc, setDoc } from 'firebase/firestore';
import CustomButton from '../components/CustomButton';
import { images } from '../constants';
import { router } from 'expo-router';

// Function to retrieve Stripe Publishable Key
const getStripePublishableKey = () => {
  const stripePublishableKey = process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY;
  if (!stripePublishableKey) {
    throw new Error('Missing Stripe Publishable Key. Please set EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY in your .env');
  }
  return stripePublishableKey;
};

const App = () => {
  const [user, setUser] = useState(null);
  const [isModalVisible, setModalVisible] = useState(false);
  const [profileData, setProfileData] = useState({
    firstName: '',
    lastName: '',
    role: '',
    location: '',
    aircraftType: '',
    medicalStatus: '',
    insuranceStatus: '',
    annualDate: ''
  });

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
    });

    return () => unsubscribe(); // Cleanup the listener on unmount
  }, []);

  const handleSaveProfile = async () => {
    if (user) {
      const userDoc = doc(db, 'users', user.uid);
      try {
        const { role } = profileData;
        if (!['renter', 'owner', 'both'].includes(role.toLowerCase())) {
          throw new Error("Invalid role selected. Please choose 'Renter', 'Owner', or 'Both'.");
        }

        await setDoc(userDoc, {
          ...profileData,
          role: role.toLowerCase()
        });

        await updateProfile(user, {
          displayName: `${profileData.firstName} ${profileData.lastName}`
        });

        setModalVisible(false);

        // Navigate to the correct screen based on the selected role and pass profile data
        if (role.toLowerCase() === 'owner') {
          router.push({
            pathname: '/owner',
            params: { profileData }
          });
        } else if (role.toLowerCase() === 'renter') {
          router.push({
            pathname: '/renter',
            params: { profileData }
          });
        } else if (role.toLowerCase() === 'both') {
          router.push({
            pathname: '/classifieds',
            params: { profileData }
          });
        }

      } catch (error) {
        console.error("Error saving profile data: ", error);
      }
    }
  };

  const handleViewContent = () => {
    router.push('/home');
  };

  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <ScrollView contentContainerStyle={styles.scrollContainer} showsVerticalScrollIndicator={false}>
        <View style={styles.logoContainer}>
          <Image source={images.logo} style={styles.logo} />
        </View>

        {user ? (
          <>
            <Text style={styles.greetingText}>Hello, {user.displayName || 'User'}</Text>
            <View style={styles.viewContentButtonContainer}>
              <CustomButton
                title="View Content"
                handlePress={handleViewContent}
                containerStyles={styles.viewContentButton}
              />
              <CustomButton
                title="Complete Profile"
                handlePress={() => setModalVisible(true)}
                containerStyles={styles.viewContentButton}
              />
            </View>
          </>
        ) : (
          <View style={styles.signInContainer}>
            <TouchableOpacity
              onPress={() => router.push('/sign-in')}
              style={styles.signInButton}
            >
              <Text style={styles.signInButtonText}>Sign In or Create Account</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Profile Modal */}
        <Modal visible={isModalVisible} transparent={true} animationType="slide">
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.keyboardAvoidingView}
          >
            <View style={styles.modalContainer}>
              <View style={styles.modalContent}>
                <ScrollView contentContainerStyle={styles.modalScroll} showsVerticalScrollIndicator={false}>
                  <Text style={styles.modalTitle}>Complete Your Profile</Text>

                  <TextInput
                    placeholder="First Name"
                    placeholderTextColor="#888"
                    style={styles.input}
                    value={profileData.firstName}
                    onChangeText={(text) => setProfileData({ ...profileData, firstName: text })}
                  />
                  <TextInput
                    placeholder="Last Name"
                    placeholderTextColor="#888"
                    style={styles.input}
                    value={profileData.lastName}
                    onChangeText={(text) => setProfileData({ ...profileData, lastName: text })}
                  />

                  {/* Role Picker */}
                  <View style={styles.pickerContainer}>
                    <Picker
                      selectedValue={profileData.role}
                      style={styles.picker}
                      onValueChange={(itemValue) =>
                        setProfileData({ ...profileData, role: itemValue })
                      }>
                      <Picker.Item label="Select Role" value="" />
                      <Picker.Item label="Renter" value="renter" />
                      <Picker.Item label="Owner" value="owner" />
                      <Picker.Item label="Both" value="both" />
                    </Picker>
                  </View>

                  {/* Combined City and State */}
                  <TextInput
                    placeholder="City, State"
                    placeholderTextColor="#888"
                    style={styles.input}
                    value={profileData.location}
                    onChangeText={(text) => setProfileData({ ...profileData, location: text })}
                  />

                  {/* Year/Make/Model */}
                  <TextInput
                    placeholder="Year/Make/Model"
                    placeholderTextColor="#888"
                    style={styles.input}
                    value={profileData.aircraftType}
                    onChangeText={(text) => setProfileData({ ...profileData, aircraftType: text })}
                  />

                  {/* Medical Current Picker */}
                  <View style={styles.pickerContainer}>
                    <Picker
                      selectedValue={profileData.medicalStatus}
                      style={styles.picker}
                      onValueChange={(itemValue) =>
                        setProfileData({ ...profileData, medicalStatus: itemValue })}
                      >
                      <Picker.Item label="Is Medical Current?" value="" />
                      <Picker.Item label="Yes" value="yes" />
                      <Picker.Item label="No" value="no" />
                    </Picker>
                  </View>

                  {/* Insurance Picker */}
                  <View style={styles.pickerContainer}>
                    <Picker
                      selectedValue={profileData.insuranceStatus}
                      style={styles.picker}
                      onValueChange={(itemValue) =>
                        setProfileData({ ...profileData, insuranceStatus: itemValue })}
                      >
                      <Picker.Item label="Is Insurance Current?" value="" />
                      <Picker.Item label="Yes" value="yes" />
                      <Picker.Item label="No" value="no" />
                    </Picker>
                  </View>

                  <TextInput
                    placeholder="Date of Last Annual"
                    placeholderTextColor="#888"
                    style={styles.input}
                    value={profileData.annualDate}
                    onChangeText={(text) => setProfileData({ ...profileData, annualDate: text })}
                  />

                  <CustomButton title="Save Profile" handlePress={handleSaveProfile} containerStyles={styles.saveButton} />
                  <CustomButton title="Close" handlePress={() => setModalVisible(false)} containerStyles={styles.closeButton} />
                </ScrollView>
              </View>
            </View>
          </KeyboardAvoidingView>
        </Modal>
      </ScrollView>
    </SafeAreaProvider>
  );
};

const Index = () => {
  const stripePublishableKey = getStripePublishableKey();

  return (
    <StripeProvider publishableKey={stripePublishableKey}>
      <SafeAreaProvider>
        <NavigationContainer>
          <Stack>
            <Stack.Screen name="index" options={{ headerShown: false }} />
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen name="(auth)" options={{ headerShown: false }} />
            {/* <Stack.Screen name="flights" options={{ headerShown: false }} /> */}
            <Stack.Screen name="classifieds" options={{ headerShown: false }} />
            <Stack.Screen name="home" options={{ headerShown: false }} />
            <Stack.Screen name="OwnerProfile" options={{ headerShown: false }} />
            <Stack.Screen name="renter" options={{ headerShown: false }} />
            <Stack.Screen name="PaymentScreen" options={{ headerShown: false }} />
            <Stack.Screen name="CheckoutScreen" options={{ headerShown: false }} />
          </Stack>
        </NavigationContainer>
      </SafeAreaProvider>
    </StripeProvider>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'white',
  },
  scrollContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 40,
  },
  logo: {
    width: 200,
    height: 200,
  },
  greetingText: {
    fontSize: 18,
    textAlign: 'center',
    marginBottom: 20,
  },
  signInContainer: {
    marginBottom: 20,
  },
  signInButton: {
    backgroundColor: '#007bff',
    paddingVertical: 15,
    borderRadius: 8,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 2,
  },
  signInButtonText: {
    color: 'white',
    fontSize: 18,
    textAlign: 'center',
  },
  viewContentButtonContainer: {
    marginBottom: 20,
  },
  viewContentButton: {
    backgroundColor: 'black',
    paddingVertical: 15,
    borderRadius: 8,
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalContent: {
    width: '90%',
    backgroundColor: 'white',
    padding: 20,
    borderRadius: 15,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
    color: '#333',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    padding: 15,
    borderRadius: 10,
    marginBottom: 15,
    color: '#000',
    fontSize: 16,
    backgroundColor: '#f7f7f7',
  },
  pickerContainer: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 10,
    marginBottom: 15,
    backgroundColor: '#f7f7f7',
  },
  picker: {
    height: 50,
    width: '100%',
  },
  saveButton: {
    backgroundColor: '#28a745',
    paddingVertical: 15,
    borderRadius: 10,
    marginBottom: 10,
  },
  closeButton: {
    backgroundColor: '#dc3545',
    paddingVertical: 15,
    borderRadius: 10,
  },
  keyboardAvoidingView: {
    flex: 1,
  },
  modalScroll: {
    flexGrow: 1,
    paddingBottom: 20,
  },
});

export default App;
