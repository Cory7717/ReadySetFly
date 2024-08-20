import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  SafeAreaView,
} from "react-native";
import { StatusBar } from "expo-status-bar";
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
    <SafeAreaView className="flex-1 bg-white p-4">
      <StatusBar barStyle="dark-content" />
      <View className="flex-1 justify-center items-center">
        <Text className="text-2xl font-bold mb-6">
          Owner Account Verification
        </Text>

        {step === 1 && (
          <>
            <TextInput
              placeholder="First Name"
              value={profile.firstName}
              onChangeText={(text) =>
                setProfile({ ...profile, firstName: text })
              }
              className="border border-gray-300 rounded-lg p-3 mb-4"
            />
            <TextInput
              placeholder="Last Name"
              value={profile.lastName}
              onChangeText={(text) => setProfile({ ...profile, lastName: text })}
              className="border border-gray-300 rounded-lg p-3 mb-4"
            />
            <TouchableOpacity
              onPress={onCreateProfilePress}
              className="bg-blue-500 rounded-lg p-3"
            >
              <Text className="text-white text-center text-lg font-semibold">
                Create Profile
              </Text>
            </TouchableOpacity>
          </>
        )}

        {step === 2 && (
          <>
            <TextInput
              placeholder="Phone Number"
              value={phoneNumber}
              onChangeText={setPhoneNumber}
              className="border border-gray-300 rounded-lg p-3 mb-4"
            />
            <TouchableOpacity
              onPress={onVerifyPhonePress}
              className="bg-blue-500 rounded-lg p-3"
            >
              <Text className="text-white text-center text-lg font-semibold">
                Verify Phone Number
              </Text>
            </TouchableOpacity>
          </>
        )}

        {step === 3 && (
          <>
            <TextInput
              placeholder="Email Address"
              value={emailAddress}
              onChangeText={setEmailAddress}
              className="border border-gray-300 rounded-lg p-3 mb-4"
            />
            <TouchableOpacity
              onPress={onVerifyEmailPress}
              className="bg-blue-500 rounded-lg p-3"
            >
              <Text className="text-white text-center text-lg font-semibold">
                Verify Email Address
              </Text>
            </TouchableOpacity>
          </>
        )}

        {pendingVerification && (
          <>
            <TextInput
              placeholder="Verification Code"
              value={verificationCode}
              onChangeText={setVerificationCode}
              className="border border-gray-300 rounded-lg p-3 mb-4"
            />
            <TouchableOpacity
              onPress={onPressVerify}
              className="bg-green-500 rounded-lg p-3"
            >
              <Text className="text-white text-center text-lg font-semibold">
                Complete Verification
              </Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    </SafeAreaView>
  );
};

export default OwnerSignup;
