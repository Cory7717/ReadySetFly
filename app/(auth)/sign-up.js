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
import RNPickerSelect from "react-native-picker-select";
import { useNavigation } from "@react-navigation/native";
import { images } from "../../constants";
import { MaterialIcons } from "@expo/vector-icons";

const SignUp = () => {
  const { signUp, setActive, isLoaded } = useSignUp();
  const navigation = useNavigation();

  // State variables for form data and visibility
  const [emailAddress, setEmailAddress] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [pendingVerification, setPendingVerification] = useState(false);
  const [code, setCode] = useState("");
  const [termsVisible, setTermsVisible] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [profileVisible, setProfileVisible] = useState(false);
  const [profileData, setProfileData] = useState({
    firstName: "",
    lastName: "",
    location: "",
    profileType: "renter", // Default to "renter"
  });
  const [canResendVerification, setCanResendVerification] = useState(false);
  const [loading, setLoading] = useState(false);

  // Handle form input changes
  const handleProfileChange = (field, value) => {
    setProfileData((prevState) => ({
      ...prevState,
      [field]: value,
    }));
  };

  // Handle sign-up process
  const onSignUpPress = useCallback(async () => {
    if (!isLoaded) {
      Alert.alert("Sign Up Error", "The sign-up process is not ready. Please try again later.");
      return;
    }

    if (!emailAddress.trim() || !password.trim() || !confirmPassword.trim()) {
      Alert.alert("Validation Error", "Please fill out all fields.");
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert("Password Mismatch", "The passwords do not match. Please try again.");
      return;
    }

    setLoading(true);
    try {
      console.log("Attempting to sign up with:", { emailAddress, password });
      const signUpAttempt = await signUp.create({ emailAddress, password });

      if (signUpAttempt) {
        setTermsVisible(true); // Show Terms of Service modal if sign-up is successful
      }
    } catch (err) {
      console.error("Sign Up Error:", err);
      Alert.alert("Sign Up Error", "There was an error during sign up. Please check your email and password.");
    } finally {
      setLoading(false);
    }
  }, [isLoaded, emailAddress, password, confirmPassword, signUp]);

  // Handle terms acceptance and prepare verification
  const onAcceptTerms = useCallback(async () => {
    setAcceptedTerms(true);
    setTermsVisible(false);
    setPendingVerification(true);

    try {
      console.log("Preparing email verification...");
      await signUp.prepareEmailAddressVerification({ strategy: "email_code" });
      setTimeout(() => setCanResendVerification(true), 30000); // Enable after 30 seconds
    } catch (err) {
      console.error("Email Verification Preparation Error:", err);
      Alert.alert("Verification Error", "There was an error preparing the email verification.");
    }
  }, [signUp]);

  // Handle email verification
  const onPressVerify = useCallback(async () => {
    if (!isLoaded) {
      Alert.alert("Verification Error", "The verification process is not ready. Please try again later.");
      return;
    }

    setLoading(true);
    try {
      console.log("Verifying code:", code);
      const completeSignUp = await signUp.attemptEmailAddressVerification({ code });

      if (completeSignUp.status === "complete") {
        await setActive({ session: completeSignUp.createdSessionId });
        console.log("Email verification complete");

        // Show profile modal for user to complete their profile
        setProfileVisible(true);
      } else {
        console.error("Verification Error:", completeSignUp);
        Alert.alert("Verification Error", "Verification failed. Please check your code and try again.");
      }
    } catch (err) {
      console.error("Verification Error:", err);
      Alert.alert("Verification Error", "There was an error during verification. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [isLoaded, code, signUp, setActive]);

  // Function to resend verification email
  const onResendVerification = useCallback(async () => {
    if (!isLoaded) {
      Alert.alert("Resend Error", "The resend process is not ready. Please try again later.");
      return;
    }

    try {
      console.log("Resending verification email...");
      await signUp.prepareEmailAddressVerification({ strategy: "email_code" });
      setCanResendVerification(false); // Disable button until timeout
      setTimeout(() => setCanResendVerification(true), 30000); // Re-enable after 30 seconds
    } catch (err) {
      console.error("Resend Verification Error:", err);
      Alert.alert("Resend Error", "There was an error resending the verification email.");
    }
  }, [isLoaded, signUp]);

  // Handle profile submission
  const onProfileSubmit = () => {
    console.log(profileData);

    // Hide the profile modal
    setProfileVisible(false);

    // Redirect to the home screen
    navigation.navigate("(tabs)");
  };

  // Toggle password visibility
  const togglePasswordVisibility = () => {
    setPasswordVisible(!passwordVisible);
  };

  const renderForm = () => {
    if (pendingVerification) {
      return (
        <>
          <TextInput
            value={code}
            placeholder="Verification Code"
            onChangeText={setCode}
            style={{
              borderWidth: 1,
              borderColor: "#ccc",
              borderRadius: 8,
              padding: 12,
              marginBottom: 16,
            }}
          />
          <CustomButton
            onPress={onPressVerify}
            text="Verify Email"
            loading={loading}
            backgroundColor="#10b981"
          />
          {canResendVerification && (
            <TouchableOpacity onPress={onResendVerification} style={{ marginTop: 16 }}>
              <Text style={{ color: "#3b82f6", textAlign: "center", fontSize: 16 }}>
                Resend Verification Email
              </Text>
            </TouchableOpacity>
          )}
        </>
      );
    }

    return (
      <>
        <TextInput
          autoCapitalize="none"
          value={emailAddress}
          placeholder="Email"
          onChangeText={setEmailAddress}
          style={{
            borderWidth: 1,
            borderColor: "#ccc",
            borderRadius: 8,
            padding: 12,
            marginBottom: 16,
          }}
        />
        <View style={{ position: 'relative', marginBottom: 16 }}>
          <TextInput
            value={password}
            placeholder="Password"
            secureTextEntry={!passwordVisible}
            onChangeText={setPassword}
            style={{
              borderWidth: 1,
              borderColor: "#ccc",
              borderRadius: 8,
              padding: 12,
              paddingRight: 40, // Space for eye icon
            }}
          />
          <TouchableOpacity
            onPress={togglePasswordVisibility}
            style={{ position: 'absolute', right: 10, top: 12 }}
          >
            <MaterialIcons
              name={passwordVisible ? "visibility" : "visibility-off"}
              size={24}
              color="#555"
            />
          </TouchableOpacity>
        </View>
        <View style={{ position: 'relative', marginBottom: 16 }}>
          <TextInput
            value={confirmPassword}
            placeholder="Confirm Password"
            secureTextEntry={!passwordVisible}
            onChangeText={setConfirmPassword}
            style={{
              borderWidth: 1,
              borderColor: "#ccc",
              borderRadius: 8,
              padding: 12,
              paddingRight: 40, // Space for eye icon
            }}
          />
          <TouchableOpacity
            onPress={togglePasswordVisibility}
            style={{ position: 'absolute', right: 10, top: 12 }}
          >
            <MaterialIcons
              name={passwordVisible ? "visibility" : "visibility-off"}
              size={24}
              color="#555"
            />
          </TouchableOpacity>
        </View>
        <CustomButton onPress={onSignUpPress} text="Sign Up" loading={loading} />
      </>
    );
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "white", padding: 16 }}>
      <StatusBar barStyle="dark-content" />
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <Image source={images.logo} resizeMode="contain" style={{ width: 240, height: 160, marginBottom: 24 }} />
        <Text style={{ fontSize: 24, fontWeight: "bold", marginBottom: 16 }}>Sign up for Ready, Set, Fly!</Text>
        <View style={{ width: "75%", maxWidth: 400, gap: 16 }}>{renderForm()}</View>
        <View style={{ flexDirection: "row", justifyContent: "center", alignItems: "center", marginTop: 16 }}>
          <Text style={{ fontSize: 18, color: "#4b5563" }}>Already have an account?</Text>
          <TouchableOpacity onPress={() => navigation.navigate("sign-in")}>
            <Text style={{ fontSize: 18, color: "#3b82f6", marginLeft: 8, fontWeight: "600" }}>Sign in</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Terms of Service Modal */}
      <TermsOfServiceModal visible={termsVisible} onAccept={onAcceptTerms} />

      {/* Profile Information Modal */}
      <ProfileModal
        visible={profileVisible}
        profileData={profileData}
        onProfileChange={handleProfileChange}
        onSave={onProfileSubmit}
      />
    </SafeAreaView>
  );
};

// Reusable button component
const CustomButton = ({ onPress, text, loading, backgroundColor = "#3b82f6" }) => (
  <TouchableOpacity
    onPress={onPress}
    style={{
      backgroundColor: loading ? "#ccc" : backgroundColor,
      borderRadius: 8,
      padding: 12,
    }}
    disabled={loading}
  >
    <Text style={{ color: "white", textAlign: "center", fontSize: 18, fontWeight: "600" }}>
      {loading ? "Please wait..." : text}
    </Text>
  </TouchableOpacity>
);

// Terms of Service Modal
const TermsOfServiceModal = ({ visible, onAccept }) => (
  <Modal visible={visible} animationType="slide" transparent={true} onRequestClose={() => setTermsVisible(false)}>
    <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "rgba(0,0,0,0.5)" }}>
      <View style={{ backgroundColor: "white", padding: 16, borderRadius: 8, width: "90%", maxHeight: "80%" }}>
        <ScrollView contentContainerStyle={{ padding: 8 }}>
          <Text style={{ fontSize: 18, fontWeight: "bold", marginBottom: 16 }}>Terms of Service</Text>
          <Text style={{ marginBottom: 16 }}>
            {/* Full Terms of Service text */}
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
            {/* Continue with the full terms as provided previously */}
          </Text>
          <CustomButton onPress={onAccept} text="Accept Terms" backgroundColor="#10b981" />
        </ScrollView>
      </View>
    </View>
  </Modal>
);

// Profile Information Modal
const ProfileModal = ({ visible, profileData, onProfileChange, onSave }) => (
  <Modal visible={visible} animationType="slide" transparent={true} onRequestClose={() => setProfileVisible(false)}>
    <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "rgba(0,0,0,0.5)" }}>
      <View style={{ backgroundColor: "white", borderRadius: 8, padding: 16, width: "90%", maxHeight: "80%" }}>
        <ScrollView contentContainerStyle={{ padding: 8 }}>
          <Text style={{ fontSize: 18, fontWeight: "bold", marginBottom: 16 }}>Complete Your Profile</Text>
          <TextInput
            placeholder="First Name"
            value={profileData.firstName}
            onChangeText={(value) => onProfileChange("firstName", value)}
            style={{
              borderWidth: 1,
              borderColor: "#ccc",
              borderRadius: 8,
              padding: 12,
              marginBottom: 16,
            }}
          />
          <TextInput
            placeholder="Last Name"
            value={profileData.lastName}
            onChangeText={(value) => onProfileChange("lastName", value)}
            style={{
              borderWidth: 1,
              borderColor: "#ccc",
              borderRadius: 8,
              padding: 12,
              marginBottom: 16,
            }}
          />
          <TextInput
            placeholder="City and State"
            value={profileData.location}
            onChangeText={(value) => onProfileChange("location", value)}
            style={{
              borderWidth: 1,
              borderColor: "#ccc",
              borderRadius: 8,
              padding: 12,
              marginBottom: 16,
            }}
          />
          <RNPickerSelect
            onValueChange={(value) => onProfileChange("profileType", value)}
            items={[
              { label: "Looking to Rent an Aircraft", value: "renter" },
              { label: "Owner Looking to List an Aircraft", value: "owner" },
            ]}
            value={profileData.profileType}
            style={{
              inputIOS: {
                borderWidth: 1,
                borderColor: "#ccc",
                borderRadius: 8,
                padding: 12,
                marginBottom: 16,
              },
              inputAndroid: {
                borderWidth: 1,
                borderColor: "#ccc",
                borderRadius: 8,
                padding: 12,
                marginBottom: 16,
              },
            }}
          />
          <CustomButton onPress={onSave} text="Save Profile" backgroundColor="#10b981" />
        </ScrollView>
      </View>
    </View>
  </Modal>
);

export default SignUp;
