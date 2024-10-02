import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  Image,
  TextInput,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  Modal,
  ScrollView,
  Alert,
} from "react-native";
import { useSignUp } from "@clerk/clerk-expo";
import { useRouter } from "expo-router";
import RNPickerSelect from 'react-native-picker-select';
import { images } from "../../constants";

const SignUp = () => {
  const { signUp, setActive, isLoaded } = useSignUp();
  const router = useRouter();

  // State variables for form data and visibility
  const [emailAddress, setEmailAddress] = useState("");
  const [password, setPassword] = useState("");
  const [pendingVerification, setPendingVerification] = useState(false);
  const [code, setCode] = useState("");
  const [termsVisible, setTermsVisible] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [profileVisible, setProfileVisible] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [location, setLocation] = useState("");
  const [profileType, setProfileType] = useState("renter"); // Default to "renter"
  const [canResendVerification, setCanResendVerification] = useState(false);

  // Handle sign-up process
  const onSignUpPress = useCallback(async () => {
    // Check if Clerk is loaded properly
    if (!isLoaded) {
      Alert.alert("Sign Up Error", "The sign-up process is not ready. Please try again later.");
      return;
    }

    try {
      console.log("Attempting to sign up with:", { emailAddress, password });

      const signUpAttempt = await signUp.create({
        emailAddress,
        password,
      });

      if (signUpAttempt) {
        // Show Terms of Service modal if sign-up is successful
        setTermsVisible(true);
      }
    } catch (err) {
      console.error("Sign Up Error:", err);
      Alert.alert("Sign Up Error", "There was an error during sign up. Please check your email and password.");
    }
  }, [isLoaded, emailAddress, password, signUp]);

  // Handle terms acceptance and prepare verification
  const onAcceptTerms = useCallback(async () => {
    setAcceptedTerms(true);
    setTermsVisible(false);
    setPendingVerification(true);

    try {
      console.log("Preparing email verification...");
      await signUp.prepareEmailAddressVerification({ strategy: 'email_code' });

      // Start the timeout for enabling the resend button
      setTimeout(() => setCanResendVerification(true), 30000); // Enable after 30 seconds
    } catch (err) {
      console.error("Email Verification Preparation Error:", err);
      Alert.alert("Verification Error", "There was an error preparing the email verification.");
    }
  }, [signUp]);

  // Handle email verification
  const onPressVerify = useCallback(async () => {
    // Check if Clerk is loaded properly
    if (!isLoaded) {
      Alert.alert("Verification Error", "The verification process is not ready. Please try again later.");
      return;
    }

    try {
      console.log("Verifying code:", code);
      const completeSignUp = await signUp.attemptEmailAddressVerification({
        code,
      });

      if (completeSignUp.status === 'complete') {
        await setActive({ session: completeSignUp.createdSessionId });
        console.log("Email verification complete");
        setProfileVisible(true); // Show profile modal after verification
      } else {
        console.error("Verification Error:", completeSignUp);
        Alert.alert("Verification Error", "Verification failed. Please check your code and try again.");
      }
    } catch (err) {
      console.error("Verification Error:", err);
      Alert.alert("Verification Error", "There was an error during verification. Please try again.");
    }
  }, [isLoaded, code, signUp, setActive]);

  // Resend verification email
  const onResendVerification = useCallback(async () => {
    try {
      console.log("Resending verification email...");
      await signUp.prepareEmailAddressVerification({ strategy: 'email_code' });
      Alert.alert("Verification Sent", "A new verification email has been sent.");
      
      // Disable the resend button again for 30 seconds
      setCanResendVerification(false);
      setTimeout(() => setCanResendVerification(true), 30000);
    } catch (err) {
      console.error("Resend Verification Error:", err);
      Alert.alert("Resend Error", "There was an error resending the verification email.");
    }
  }, [signUp]);

  // Handle profile submission and route user to the main content (same as SignIn)
  const onProfileSubmit = () => {
    console.log({
      firstName,
      lastName,
      location,
      profileType,
    });

    setProfileVisible(false);
    
    // Route to the main content as done in the SignIn component
    setTimeout(() => {
      router.replace('/'); // Ensures the user is routed to the main content as intended
    }, 100);
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
              {canResendVerification && (
                <TouchableOpacity
                  onPress={onResendVerification}
                  style={{
                    marginTop: 16,
                  }}
                >
                  <Text style={{ color: '#3b82f6', textAlign: 'center', fontSize: 16 }}>
                    Resend Verification Email
                  </Text>
                </TouchableOpacity>
              )}
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
          <View style={{ backgroundColor: 'white', padding: 16, borderRadius: 8, width: '90%', maxHeight: '80%' }}>
            <ScrollView contentContainerStyle={{ padding: 8 }}>
              <Text style={{ fontSize: 18, fontWeight: 'bold', marginBottom: 16 }}>
                Terms of Service
              </Text>
              <Text style={{ marginBottom: 16 }}>
              Welcome to Ready, Set, Fly! (“Company”, “we”, “our”, or “us”). By accessing or using our mobile application (the “App”), website, or any services provided by Ready, Set, Fly! (collectively, the “Services”), you agree to comply with and be bound by the following Terms of Service. If you do not agree to these terms, please do not use our Services.

1. Acceptance of Terms
By accessing or using the App, you agree to these Terms of Service and our Privacy Policy, which is incorporated herein by reference. If you do not agree to all of the terms and conditions, you may not access or use the Services.

2. Description of Services
Ready, Set, Fly! is a platform that connects aircraft owners with renters. Our Services facilitate the listing and rental of aircraft for short or long-term periods, including social and marketplace features to help users interact, make bookings, and communicate effectively.

3. User Responsibilities
All users are required to conduct thorough due diligence before engaging in any rental transaction, including but not limited to:

Insurance Verification: It is the renter's responsibility to verify that the aircraft being rented has proper insurance coverage. The renter should confirm that the insurance covers any potential incidents that may occur during the rental period.
Maintenance Logs and Airworthiness: Users must verify all maintenance logs, inspection records, and confirm the airworthiness of the aircraft. This includes ensuring that all mandatory checks and repairs have been conducted as required by applicable regulations.
Pilot Credentials: Renters must verify the pilot's medical certificate, license, and any other necessary qualifications to operate the aircraft safely and legally.
Pre-Flight and Post-Flight Checklists: Renters and owners must conduct comprehensive pre-flight and post-flight checklists before and after each rental transaction. This includes verifying fuel levels, equipment functionality, and the overall safety and readiness of the aircraft.
Compliance with Regulations: All users are expected to comply with local, state, federal, and aviation regulatory requirements in their jurisdiction, including any requirements from the Federal Aviation Administration (FAA) or other governing bodies.
Ready, Set, Fly! does not assume responsibility for verifying the condition, legality, or compliance of any aircraft or user and is not liable for any failure by a user to adhere to these responsibilities.

4. Booking and Payments
All bookings and rental transactions facilitated through our App are subject to the following conditions:

Payments are processed securely through Stripe.
Owners are responsible for listing accurate information about their aircraft, including availability, rental rates, and any additional fees.
Renters must ensure that they understand all rental terms, including payment conditions, cancellation policies, and any additional fees imposed by the owner.
5. Liability and Disclaimer
Ready, Set, Fly! acts as an intermediary platform to connect aircraft owners and renters. We are not a party to any rental agreement, and we are not responsible for any damages, injuries, losses, or disputes that arise out of any transaction facilitated through our Services.

Users understand and acknowledge that:

Ready, Set, Fly! does not verify the condition, airworthiness, or safety of any listed aircraft. It is the sole responsibility of the renter and owner to perform necessary inspections and due diligence before each flight.
Ready, Set, Fly! does not guarantee the accuracy or completeness of any information provided by users or third parties on the App.
All transactions, agreements, and communications are solely between the aircraft owner and renter.
BY USING OUR SERVICES, YOU AGREE TO INDEMNIFY AND HOLD READY, SET, FLY! HARMLESS FROM ANY CLAIMS, DAMAGES, LOSSES, OR LEGAL PROCEEDINGS ARISING OUT OF OR IN CONNECTION WITH YOUR USE OF THE SERVICES, INCLUDING ANY RENTAL TRANSACTION OR AVIATION ACTIVITIES.

6. Dispute Resolution
In the event of any dispute arising between users (aircraft owners and renters), Ready, Set, Fly! encourages direct communication between the parties to resolve the issue. If a resolution cannot be achieved, Ready, Set, Fly! reserves the right to take appropriate action, including suspending accounts or restricting access to Services.

7. Account Registration and Security
To use certain features of the App, users must create an account and provide accurate and complete information. Users are responsible for maintaining the security of their account credentials and for all activities that occur under their account.

8. Content and Conduct
All users agree to abide by our community guidelines and policies. Users must not post any false, misleading, offensive, illegal, or infringing content on the App. Ready, Set, Fly! reserves the right to remove any content or suspend any account that violates these Terms.

9. Modifications to the Services
Ready, Set, Fly! reserves the right to modify, suspend, or discontinue any part of the Services at any time without prior notice.

10. Termination
We reserve the right to terminate or suspend any user’s access to the App and Services without notice for conduct that we believe violates these Terms, disrupts the Services, or is harmful to other users.

11. Changes to Terms of Service
We may update these Terms of Service from time to time. We will notify users of any significant changes by posting the updated terms on the App. Your continued use of the Services after such changes will constitute your acceptance of the new terms.

12. Governing Law and Jurisdiction
These Terms and any disputes arising out of or related to the Services will be governed by the laws of [State/Country], without regard to its conflict of law principles. Any legal actions or proceedings arising under these Terms will be brought exclusively in the courts located in [City, State].

13. Contact Information
If you have any questions about these Terms of Service, please contact us at:
Email: info@readysetfly.us
Address: Austin Ready, Set, Fly, LLC, Austin, TX
              </Text>
              <TouchableOpacity
                onPress={onAcceptTerms}
                style={{
                  backgroundColor: '#10b981',
                  borderRadius: 8,
                  padding: 12,
                }}
              >
                <Text style={{ color: 'white', textAlign: 'center', fontSize: 18, fontWeight: '600' }}>
                  Accept Terms
                </Text>
              </TouchableOpacity>
            </ScrollView>
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
                placeholder="City and State"
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
              <RNPickerSelect
                onValueChange={(value) => setProfileType(value)}
                items={[
                  { label: 'Looking to Rent an Aircraft', value: 'renter' },
                  { label: 'Owner Looking to List an Aircraft', value: 'owner' }
                ]}
                value={profileType}
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
                onPress={onProfileSubmit}
                style={{
                  backgroundColor: '#10b981',
                  borderRadius: 8,
                  padding: 12,
                  marginBottom: 8,
                }}
              >
                <Text style={{ color: 'white', textAlign: 'center', fontSize: 18, fontWeight: '600' }}>
                  Save Profile
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
