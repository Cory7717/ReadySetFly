import React, { useEffect, useState } from 'react';
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer } from '@react-navigation/native';
import { StripeProvider } from '@stripe/stripe-react-native';
import { Stack } from 'expo-router';
import { View, Text, Image, ScrollView, TouchableOpacity, StyleSheet, Modal, TextInput } from 'react-native';
import { onAuthStateChanged, updateProfile } from 'firebase/auth';
import { auth, db } from '../firebaseConfig'; // Add Firestore database
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
    city: '',
    state: '',
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
        // Save profile data to Firestore
        await setDoc(userDoc, profileData);
        
        // Update user's displayName in Firebase Auth
        await updateProfile(user, {
          displayName: `${profileData.firstName} ${profileData.lastName}`
        });

        // Close modal and navigate to the home page
        setModalVisible(false);
        router.push('/home');
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
      <ScrollView contentContainerStyle={styles.scrollContainer}>
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
          <View style={styles.modalContainer}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Complete Your Profile</Text>

              <TextInput
                placeholder="First Name"
                style={styles.input}
                value={profileData.firstName}
                onChangeText={(text) => setProfileData({ ...profileData, firstName: text })}
              />
              <TextInput
                placeholder="Last Name"
                style={styles.input}
                value={profileData.lastName}
                onChangeText={(text) => setProfileData({ ...profileData, lastName: text })}
              />
              <TextInput
                placeholder="Role (Renter/Owner/Both)"
                style={styles.input}
                value={profileData.role}
                onChangeText={(text) => setProfileData({ ...profileData, role: text })}
              />
              <TextInput
                placeholder="City"
                style={styles.input}
                value={profileData.city}
                onChangeText={(text) => setProfileData({ ...profileData, city: text })}
              />
              <TextInput
                placeholder="State"
                style={styles.input}
                value={profileData.state}
                onChangeText={(text) => setProfileData({ ...profileData, state: text })}
              />
              <TextInput
                placeholder="Type of Aircraft"
                style={styles.input}
                value={profileData.aircraftType}
                onChangeText={(text) => setProfileData({ ...profileData, aircraftType: text })}
              />
              <TextInput
                placeholder="Current Medical"
                style={styles.input}
                value={profileData.medicalStatus}
                onChangeText={(text) => setProfileData({ ...profileData, medicalStatus: text })}
              />
              <TextInput
                placeholder="Insurance Current (Yes/No)"
                style={styles.input}
                value={profileData.insuranceStatus}
                onChangeText={(text) => setProfileData({ ...profileData, insuranceStatus: text })}
              />
              <TextInput
                placeholder="Date of Last Annual"
                style={styles.input}
                value={profileData.annualDate}
                onChangeText={(text) => setProfileData({ ...profileData, annualDate: text })}
              />

              <CustomButton title="Save Profile" handlePress={handleSaveProfile} containerStyles={styles.saveButton} />
              <CustomButton title="Close" handlePress={() => setModalVisible(false)} containerStyles={styles.closeButton} />
            </View>
          </View>
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
            <Stack.Screen name="flights" options={{ headerShown: false }} />
            <Stack.Screen name="classifieds" options={{ headerShown: false }} />
            <Stack.Screen name="home" options={{ headerShown: false }} />
            <Stack.Screen name="OwnerProfile" options={{ headerShown: false }} />
            <Stack.Screen name="renter" options={{ headerShown: false }} />
            <Stack.Screen name="PaymentScreen" options={{ headerShown: false }} />
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
    borderRadius: 10,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    padding: 10,
    borderRadius: 5,
    marginBottom: 10,
  },
  saveButton: {
    backgroundColor: '#28a745',
    paddingVertical: 15,
    borderRadius: 8,
    marginBottom: 10,
  },
  closeButton: {
    backgroundColor: '#dc3545',
    paddingVertical: 15,
    borderRadius: 8,
  }
});

export default App;
