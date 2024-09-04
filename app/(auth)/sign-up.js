import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  Image,
  TextInput,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  Platform,
  Modal,
  ScrollView,
} from "react-native";
import { useSignUp } from "@clerk/clerk-expo";
import { useRouter } from "expo-router";
import RNPickerSelect from 'react-native-picker-select';
import { images } from "../../constants";

const SignUp = () => {
  const { signUp, setActive, isLoaded } = useSignUp();
  const router = useRouter();

  const [emailAddress, setEmailAddress] = useState("");
  const [password, setPassword] = useState("");
  const [userType, setUserType] = useState("renter");
  const [pendingVerification, setPendingVerification] = useState(false);
  const [code, setCode] = useState("");
  const [termsVisible, setTermsVisible] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [profileVisible, setProfileVisible] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [birthday, setBirthday] = useState("");
  const [location, setLocation] = useState("");

  const onSignUpPress = useCallback(async () => {
    if (!isLoaded) {
      return;
    }

    try {
      await signUp.create({
        emailAddress,
        password,
        publicMetadata: { userType },
      });

      // Show Terms of Service modal
      setTermsVisible(true);
    } catch (err) {
      console.error(JSON.stringify(err, null, 2));
    }
  }, [isLoaded, emailAddress, password, userType]);

  const onAcceptTerms = () => {
    setAcceptedTerms(true);
    setTermsVisible(false);
    setPendingVerification(true);

    signUp.prepareEmailAddressVerification({ strategy: 'email_code' });
  };

  const onPressVerify = useCallback(async () => {
    if (!isLoaded) {
      return;
    }

    try {
      const completeSignUp = await signUp.attemptEmailAddressVerification({
        code,
      });

      if (completeSignUp.status === 'complete') {
        await setActive({ session: completeSignUp.createdSessionId });
        setProfileVisible(true); // Show profile modal after verification
      } else {
        console.error(JSON.stringify(completeSignUp, null, 2));
      }
    } catch (err) {
      console.error(JSON.stringify(err, null, 2));
    }
  }, [isLoaded, code]);

  const onProfileSubmit = () => {
    // Handle profile information submission
    console.log({
      firstName,
      lastName,
      birthday,
      emailAddress,
      location,
    });

    setProfileVisible(false);
    router.replace('/tabs/home');  // Updated to navigate to /tabs/home
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: 'white', padding: 16 }}>
      <StatusBar barStyle="dark-content" />
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <Image
          source={images.logo}
          resizeMode="contain"
          style={{ width: 240, height: 160, marginBottom: 24 }}
        />
        <Text style={{ fontSize: 24, fontWeight: 'bold', marginBottom: 16 }}>
          Sign up for Ready, Set, Fly!
        </Text>
        <View style={{ width: '75%', maxWidth: 400, gap: 16 }}>
          {!pendingVerification ? (
            <>
              <TextInput
                autoCapitalize="none"
                value={emailAddress}
                placeholder="Email"
                onChangeText={setEmailAddress}
                style={{
                  borderWidth: 1,
                  borderColor: '#ccc',
                  borderRadius: 8,
                  padding: 12,
                  marginBottom: 16,
                }}
              />
              <TextInput
                value={password}
                placeholder="Password"
                secureTextEntry
                onChangeText={setPassword}
                style={{
                  borderWidth: 1,
                  borderColor: '#ccc',
                  borderRadius: 8,
                  padding: 12,
                  marginBottom: 16,
                }}
              />
              <RNPickerSelect
                onValueChange={(value) => setUserType(value)}
                items={[
                  { label: 'Renter', value: 'renter' },
                  { label: 'Owner', value: 'owner' }
                ]}
                value={userType}
                style={{
                  inputIOS: {
                    borderWidth: 1,
                    borderColor: '#ccc',
                    borderRadius: 8,
                    padding: 12,
                    marginBottom: 16,
                  },
                  inputAndroid: {
                    borderWidth: 1,
                    borderColor: '#ccc',
                    borderRadius: 8,
                    padding: 12,
                    marginBottom: 16,
                  }
                }}
              />
              <TouchableOpacity
                onPress={onSignUpPress}
                style={{
                  backgroundColor: '#3b82f6',
                  borderRadius: 8,
                  padding: 12,
                }}
              >
                <Text style={{ color: 'white', textAlign: 'center', fontSize: 18, fontWeight: '600' }}>
                  Sign Up
                </Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <TextInput
                value={code}
                placeholder="Verification Code"
                onChangeText={setCode}
                style={{
                  borderWidth: 1,
                  borderColor: '#ccc',
                  borderRadius: 8,
                  padding: 12,
                  marginBottom: 16,
                }}
              />
              <TouchableOpacity
                onPress={onPressVerify}
                style={{
                  backgroundColor: '#10b981',
                  borderRadius: 8,
                  padding: 12,
                }}
              >
                <Text style={{ color: 'white', textAlign: 'center', fontSize: 18, fontWeight: '600' }}>
                  Verify Email
                </Text>
              </TouchableOpacity>
            </>
          )}
          <View style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginTop: 16 }}>
            <Text style={{ fontSize: 18, color: '#4b5563' }}>
              Already have an account?
            </Text>
            <TouchableOpacity onPress={() => router.push("/sign-in")}>
              <Text style={{ fontSize: 18, color: '#3b82f6', marginLeft: 8, fontWeight: '600' }}>
                Sign in
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* Terms of Service Modal */}
      <Modal
        visible={termsVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setTermsVisible(false)}
      >
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <View style={{ backgroundColor: 'white', borderRadius: 8, padding: 16, width: '90%', maxHeight: '80%' }}>
            <ScrollView contentContainerStyle={{ padding: 8 }}>
              <Text style={{ fontSize: 18, fontWeight: 'bold', marginBottom: 16 }}>
                Terms of Service
              </Text>
              <Text style={{ marginBottom: 16 }}>
                {/* Insert the full text of your Terms of Service here */}
                Welcome to Ready Set Fly ("App"). By using our App, you agree to comply with and be bound by these Terms of Service ("Terms"). If you do not agree with these Terms, you should not use the App.

                1. Introduction

                Welcome to Ready Set Fly ("App"). By using our App, you agree to comply with and be bound by these Terms of Service ("Terms"). If you do not agree with these Terms, you should not use the App.

                2. Eligibility

                To use this App, you must be at least 18 years old or have reached the age of majority in your jurisdiction. By using the App, you represent and warrant that you meet these requirements.

                3. Account Registration

                To access certain features of the App, you may be required to create an account. You agree to provide accurate and complete information during registration and to keep this information updated. You are responsible for maintaining the confidentiality of your account credentials and for all activities that occur under your account.

                4. User Responsibilities

                - Compliance with Laws: You agree to use the App in compliance with all applicable local, state, and federal laws and regulations, including those related to data privacy and security.
                - Prohibited Activities: You agree not to engage in any activity that could harm the App, its users, or third parties. This includes, but is not limited to, hacking, spamming, distributing malware, or posting illegal content.
                - User Content: You are solely responsible for the content you upload or post through the App. You grant Ready Set Fly a non-exclusive, royalty-free, worldwide license to use, modify, and display such content as necessary to provide the App's services.

                {/* Add the remaining Terms of Service */}
              </Text>
            </ScrollView>
            <TouchableOpacity
              onPress={onAcceptTerms}
              style={{
                backgroundColor: '#10b981',
                borderRadius: 8,
                padding: 12,
                marginBottom: 8,
              }}
            >
              <Text style={{ color: 'white', textAlign: 'center', fontSize: 18, fontWeight: '600' }}>
                I Accept
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setTermsVisible(false)}
              style={{
                backgroundColor: '#f56565',
                borderRadius: 8,
                padding: 12,
              }}
            >
              <Text style={{ color: 'white', textAlign: 'center', fontSize: 18, fontWeight: '600' }}>
                Cancel
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Profile Information Modal */}
      <Modal
        visible={profileVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setProfileVisible(false)}
      >
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <View style={{ backgroundColor: 'white', borderRadius: 8, padding: 16, width: '90%', maxHeight: '80%' }}>
            <ScrollView contentContainerStyle={{ padding: 8 }}>
              <Text style={{ fontSize: 18, fontWeight: 'bold', marginBottom: 16 }}>
                Complete Your Profile
              </Text>
              <TextInput
                placeholder="First Name"
                value={firstName}
                onChangeText={setFirstName}
                style={{
                  borderWidth: 1,
                  borderColor: '#ccc',
                  borderRadius: 8,
                  padding: 12,
                  marginBottom: 16,
                }}
              />
              <TextInput
                placeholder="Last Name"
                value={lastName}
                onChangeText={setLastName}
                style={{
                  borderWidth: 1,
                  borderColor: '#ccc',
                  borderRadius: 8,
                  padding: 12,
                  marginBottom: 16,
                }}
              />
              <TextInput
                placeholder="Birthday (YYYY-MM-DD)"
                value={birthday}
                onChangeText={setBirthday}
                style={{
                  borderWidth: 1,
                  borderColor: '#ccc',
                  borderRadius: 8,
                  padding: 12,
                  marginBottom: 16,
                }}
              />
              <TextInput
                placeholder="Location"
                value={location}
                onChangeText={setLocation}
                style={{
                  borderWidth: 1,
                  borderColor: '#ccc',
                  borderRadius: 8,
                  padding: 12,
                  marginBottom: 16,
                }}
              />
              <TouchableOpacity
                onPress={onProfileSubmit}
                style={{
                  backgroundColor: '#10b981',
                  borderRadius: 8,
                  padding: 12,
                  marginBottom: 8,
                }}
              >
                <Text style={{ color: 'white', textAlign: 'center', fontSize: 18, fontWeight: '600' }}>
                  Submit
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setProfileVisible(false)}
                style={{
                  backgroundColor: '#f56565',
                  borderRadius: 8,
                  padding: 12,
                }}
              >
                <Text style={{ color: 'white', textAlign: 'center', fontSize: 18, fontWeight: '600' }}>
                  Cancel
                </Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

export default SignUp;
