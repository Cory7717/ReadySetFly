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
    router.replace('/');
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

                5. Ready Set Fly as a Third-Party Platform

                Ready Set Fly is a third-party platform that connects aircraft owners with pilots for the purpose of conducting rental transactions. While Ready Set Fly facilitates these connections, it is the responsibility of both the aircraft owner ("Owner") and the renter ("Renter") to verify all documents provided during the transaction. This includes ensuring that the Renter holds all necessary certifications, licenses, and meets all legal requirements to operate the aircraft.

                6. Verification of Documentation

                Owners and Renters are solely responsible for verifying the authenticity and validity of any documentation provided during the rental process. Ready Set Fly does not verify any documents provided by users and is not responsible for any failure by users to conduct proper verification. Ready Set Fly is not liable for any issues, damages, or losses that arise due to the failure of either party to verify documentation.

                7. Payments and Transactions

                - Stripe Payments: All payments made through the App are processed by Stripe, Inc. By making a payment, you agree to Stripe's terms and conditions. Ready Set Fly does not store your payment information.
                - Refunds: All sales and transactions are final, except as required by law. Please contact our support team at [support email] if you believe you are entitled to a refund.

                8. Privacy Policy

                Your use of the App is also governed by our Privacy Policy, which explains how we collect, use, and protect your personal information. By using the App, you agree to the terms of the Privacy Policy.

                9. Data Security

                Ready Set Fly implements reasonable security measures to protect your personal information. However, no system is completely secure, and we cannot guarantee the absolute security of your data. You acknowledge and agree that you use the App at your own risk.

                10. Intellectual Property

                All content and materials available on the App, including but not limited to text, graphics, logos, and software, are the property of Ready Set Fly or its licensors and are protected by intellectual property laws. You may not use, reproduce, or distribute any such content without our express written permission.

                11. Termination

                We reserve the right to suspend or terminate your account and access to the App at our sole discretion, without notice, for conduct that we believe violates these Terms or is harmful to other users, us, or third parties.

                12. Limitation of Liability

                To the fullest extent permitted by law, Ready Set Fly and its affiliates, officers, directors, employees, and agents shall not be liable for any indirect, incidental, special, consequential, or punitive damages, or any loss of profits or revenues, whether incurred directly or indirectly, or any loss of data, use, goodwill, or other intangible losses, resulting from (i) your access to or use of or inability to access or use the App; (ii) any conduct or content of any third party on the App; (iii) any content obtained from the App; (iv) unauthorized access, use, or alteration of your transmissions or content; or (v) failure to verify documentation provided by other users.

                13. Governing Law and Dispute Resolution

                These Terms shall be governed by and construed in accordance with the laws of the State of Texas, without regard to its conflict of laws principles. Any disputes arising out of or in connection with these Terms shall be resolved exclusively in the state or federal courts located in [City], Texas. You agree to submit to the jurisdiction of these courts.

                14. Changes to the Terms

                We reserve the right to update or modify these Terms at any time. If we make material changes, we will notify you through the App or by other means before the changes take effect. Your continued use of the App after the effective date of any changes constitutes your acceptance of the revised Terms.

                15. Contact Us

                If you have any questions about these Terms, please contact us at:

                Ready Set Fly
                [Address]
                [City, State, Zip Code]
                [Email Address]
                [Phone Number]
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
