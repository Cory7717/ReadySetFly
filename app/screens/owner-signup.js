import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  StyleSheet,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { getAuth, signInWithPhoneNumber, RecaptchaVerifier } from "firebase/auth";

const OwnerSignup = () => {
  const navigation = useNavigation();
  const auth = getAuth();
  
  const [emailAddress, setEmailAddress] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [pendingVerification, setPendingVerification] = useState(false);
  const [profile, setProfile] = useState({ firstName: "", lastName: "" });
  const [step, setStep] = useState(1);
  const [confirmationResult, setConfirmationResult] = useState(null); // For Firebase phone verification

  // Set up reCAPTCHA verifier
  const setUpRecaptcha = () => {
    window.recaptchaVerifier = new RecaptchaVerifier(
      "recaptcha-container",
      {
        size: "invisible",
        callback: (response) => {
          console.log("reCAPTCHA solved!");
        },
      },
      auth
    );
  };

  const onCreateProfilePress = () => {
    if (step === 1 && profile.firstName && profile.lastName) {
      setStep(2); // Move to the phone number verification step
    }
  };

  const onVerifyPhonePress = async () => {
    if (step === 2 && phoneNumber) {
      try {
        setUpRecaptcha();
        const appVerifier = window.recaptchaVerifier;
        const confirmation = await signInWithPhoneNumber(auth, phoneNumber, appVerifier);
        setConfirmationResult(confirmation);
        setPendingVerification(true);
        setStep(3); // Move to the email verification step
      } catch (error) {
        console.error("Phone verification error:", error.message);
      }
    }
  };

  const onVerifyEmailPress = async () => {
    if (step === 3 && emailAddress) {
      try {
        // Optionally, send a verification email if email verification is required.
        // You can do this using Firebase's email authentication methods.
        // Currently, Firebase handles email verification separately.

        setPendingVerification(true);
      } catch (error) {
        console.error("Email verification error:", error.message);
      }
    }
  };

  const onPressVerify = async () => {
    try {
      if (confirmationResult) {
        // Complete phone number verification
        const result = await confirmationResult.confirm(verificationCode);
        if (result.user) {
          // After successful verification, navigate to the owner's home page
          navigation.replace("/home");
        }
      }
    } catch (err) {
      console.error("Verification error:", err.message);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.innerContainer}>
        <Text style={styles.title}>Owner Account Verification</Text>

        {step === 1 && (
          <>
            <TextInput
              placeholder="First Name"
              value={profile.firstName}
              onChangeText={(text) =>
                setProfile({ ...profile, firstName: text })
              }
              style={styles.input}
            />
            <TextInput
              placeholder="Last Name"
              value={profile.lastName}
              onChangeText={(text) => setProfile({ ...profile, lastName: text })}
              style={styles.input}
            />
            <TouchableOpacity
              onPress={onCreateProfilePress}
              style={styles.button}
            >
              <Text style={styles.buttonText}>Create Profile</Text>
            </TouchableOpacity>
          </>
        )}

        {step === 2 && (
          <>
            <TextInput
              placeholder="Phone Number"
              value={phoneNumber}
              onChangeText={setPhoneNumber}
              style={styles.input}
            />
            <TouchableOpacity
              onPress={onVerifyPhonePress}
              style={styles.button}
            >
              <Text style={styles.buttonText}>Verify Phone Number</Text>
            </TouchableOpacity>
            <View id="recaptcha-container" />
          </>
        )}

        {step === 3 && (
          <>
            <TextInput
              placeholder="Email Address"
              value={emailAddress}
              onChangeText={setEmailAddress}
              style={styles.input}
            />
            <TouchableOpacity
              onPress={onVerifyEmailPress}
              style={styles.button}
            >
              <Text style={styles.buttonText}>Verify Email Address</Text>
            </TouchableOpacity>
          </>
        )}

        {pendingVerification && (
          <>
            <TextInput
              placeholder="Verification Code"
              value={verificationCode}
              onChangeText={setVerificationCode}
              style={styles.input}
            />
            <TouchableOpacity
              onPress={onPressVerify}
              style={[styles.button, { backgroundColor: '#10B981' }]}
            >
              <Text style={styles.buttonText}>Complete Verification</Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'white',
    padding: 16,
  },
  innerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 24,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    width: '100%',
    maxWidth: 400,
  },
  button: {
    backgroundColor: '#3b82f6',
    borderRadius: 8,
    padding: 12,
    width: '100%',
    maxWidth: 400,
  },
  buttonText: {
    color: 'white',
    textAlign: 'center',
    fontSize: 18,
    fontWeight: '600',
  },
});

export default OwnerSignup;
