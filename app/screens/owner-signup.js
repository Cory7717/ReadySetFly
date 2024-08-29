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
import { useSignUp } from "@clerk/clerk-expo";
import { useRouter } from "expo-router";

const OwnerSignup = () => {
  const { signUp, setActive, isLoaded } = useSignUp();
  const router = useRouter();

  const [emailAddress, setEmailAddress] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [pendingVerification, setPendingVerification] = useState(false);
  const [profile, setProfile] = useState({ firstName: "", lastName: "" });
  const [step, setStep] = useState(1);

  const onCreateProfilePress = async () => {
    if (step === 1 && profile.firstName && profile.lastName) {
      setStep(2); // Move to the phone number verification step
    }
  };

  const onVerifyPhonePress = async () => {
    if (step === 2 && phoneNumber) {
      await signUp.preparePhoneNumberVerification({ strategy: "sms_code" });
      setPendingVerification(true);
      setStep(3); // Move to the email verification step
    }
  };

  const onVerifyEmailPress = async () => {
    if (step === 3 && emailAddress) {
      await signUp.prepareEmailAddressVerification({ strategy: "email_code" });
      setPendingVerification(true);
    }
  };

  const onPressVerify = async () => {
    try {
      const completeSignUp = await signUp.attemptPhoneNumberVerification({
        code: verificationCode,
      });

      if (completeSignUp.status === "complete") {
        await setActive({ session: completeSignUp.createdSessionId });
        router.replace("/home"); // Navigate to the owner's home page after verification
      } else {
        console.error(JSON.stringify(completeSignUp, null, 2));
      }
    } catch (err) {
      console.error(JSON.stringify(err, null, 2));
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
