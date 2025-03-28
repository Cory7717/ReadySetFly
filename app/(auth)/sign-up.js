// SignUp.js

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
import {
  getAuth,
  createUserWithEmailAndPassword,
  sendEmailVerification,
  signInWithEmailAndPassword,
  updateProfile, // Added updateProfile import to update Firebase user displayName
} from "firebase/auth";
import { getFirestore, doc, setDoc } from "firebase/firestore";
import { app } from "../../firebaseConfig"; // Adjust the path to your firebaseConfig.js
import RNPickerSelect from "react-native-picker-select";
import { useNavigation } from "@react-navigation/native";
import { images } from "../../constants";
import { MaterialIcons } from "@expo/vector-icons";

const SignUp = () => {
  const navigation = useNavigation();

  // State variables for form data and modal visibility
  const [emailAddress, setEmailAddress] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [termsVisible, setTermsVisible] = useState(false);
  const [profileVisible, setProfileVisible] = useState(false);
  const [profileData, setProfileData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phoneNumber: "",
    profileType: "renter", // Default to "renter"
  });
  const [loading, setLoading] = useState(false);

  const auth = getAuth(app); // Initialize Firebase Auth
  const db = getFirestore(app); // Initialize Firestore

  // Handle profile input changes
  const handleProfileChange = (field, value) => {
    setProfileData((prevState) => ({
      ...prevState,
      [field]: value,
    }));
  };

  // Handle sign-up button press: validate input and open Terms modal
  const onSignUpPress = useCallback(() => {
    if (!emailAddress.trim() || !password.trim() || !confirmPassword.trim()) {
      Alert.alert("Validation Error", "Please fill out all fields.");
      return;
    }
    if (password !== confirmPassword) {
      Alert.alert("Password Mismatch", "The passwords do not match. Please try again.");
      return;
    }
    // Open the Terms modal (account creation is deferred)
    setTermsVisible(true);
  }, [emailAddress, password, confirmPassword]);

  // When the user accepts the terms, open the Profile modal
  const onAcceptTerms = useCallback(() => {
    setTermsVisible(false);
    // Pre-populate the email field in the profile modal with the sign-up email
    setProfileData((prevState) => ({
      ...prevState,
      email: emailAddress,
    }));
    setProfileVisible(true);
  }, [emailAddress]);

  // Handle profile submission:
  // Create the new user account and save profile data to Firestore
  const onProfileSubmit = async () => {
    if (!profileData.email.trim()) {
      Alert.alert("Validation Error", "Please provide your email address.");
      return;
    }
    setLoading(true);
    try {
      // Create the new user with Firebase Authentication using the email from profile modal
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        profileData.email,
        password
      );
      const user = userCredential.user;

      // Update the Firebase user's displayName using firstName and lastName
      await updateProfile(user, {
        displayName: `${profileData.firstName} ${profileData.lastName}`,
      });

      // Save profile data to Firestore, including a fullName field for consistency
      await setDoc(doc(db, "users", user.uid), {
        email: profileData.email,
        firstName: profileData.firstName,
        lastName: profileData.lastName,
        fullName: `${profileData.firstName} ${profileData.lastName}`,
        phoneNumber: profileData.phoneNumber,
        profileType: profileData.profileType,
        createdAt: new Date(),
      });

      // Hide the profile modal
      setProfileVisible(false);

      // Redirect to the home screen
      navigation.navigate("(tabs)");
    } catch (error) {
      console.error("Error creating account or saving profile data:", error);
      Alert.alert("Error", "Failed to create account. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // Toggle password visibility
  const togglePasswordVisibility = () => {
    setPasswordVisible(!passwordVisible);
  };

  const renderForm = () => (
    <>
      <TextInput
        autoCapitalize="none"
        value={emailAddress}
        placeholder="Email"
        placeholderTextColor="#888"
        onChangeText={setEmailAddress}
        style={{
          borderWidth: 1,
          borderColor: "#ccc",
          borderRadius: 8,
          padding: 12,
          marginBottom: 16,
        }}
      />
      <View style={{ position: "relative", marginBottom: 16 }}>
        <TextInput
          value={password}
          placeholder="Password"
          placeholderTextColor="#888"
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
          style={{ position: "absolute", right: 10, top: 12 }}
        >
          <MaterialIcons
            name={passwordVisible ? "visibility" : "visibility-off"}
            size={24}
            color="#555"
          />
        </TouchableOpacity>
      </View>
      <View style={{ position: "relative", marginBottom: 16 }}>
        <TextInput
          value={confirmPassword}
          placeholder="Confirm Password"
          placeholderTextColor="#888"
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
          style={{ position: "absolute", right: 10, top: 12 }}
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

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "white", padding: 16 }}>
      <StatusBar barStyle="dark-content" />
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <Image
          source={images.logo}
          resizeMode="contain"
          style={{ width: 240, height: 160, marginBottom: 24 }}
        />
        <Text style={{ fontSize: 24, fontWeight: "bold", marginBottom: 16 }}>
          Sign up for Ready, Set, Fly!
        </Text>
        <View style={{ width: "75%", maxWidth: 400, gap: 16 }}>{renderForm()}</View>
        <View
          style={{
            flexDirection: "row",
            justifyContent: "center",
            alignItems: "center",
            marginTop: 16,
          }}
        >
          <Text style={{ fontSize: 18, color: "#4b5563" }}>
            Already have an account?
          </Text>
          <TouchableOpacity onPress={() => navigation.navigate("sign-in")}>
            <Text
              style={{
                fontSize: 18,
                color: "#3b82f6",
                marginLeft: 8,
                fontWeight: "600",
              }}
            >
              Sign in
            </Text>
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
      marginVertical: 8,
    }}
    disabled={loading}
  >
    <Text style={{ color: "white", textAlign: "center", fontSize: 18, fontWeight: "600" }}>
      {loading ? "Please wait..." : text}
    </Text>
  </TouchableOpacity>
);

// Terms of Service Modal with enhanced styling
const TermsOfServiceModal = ({ visible, onAccept }) => (
  <Modal visible={visible} animationType="slide" transparent={true} onRequestClose={() => {}}>
    <View
      style={{
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        backgroundColor: "rgba(0,0,0,0.5)",
      }}
    >
      <View
        style={{
          backgroundColor: "white",
          padding: 20,
          borderRadius: 10,
          width: "90%",
          maxHeight: "80%",
        }}
      >
        <ScrollView contentContainerStyle={{ paddingVertical: 20 }}>
          <Text
            style={{
              fontSize: 22,
              fontWeight: "bold",
              marginBottom: 20,
              textAlign: "center",
            }}
          >
            Terms of Service
          </Text>
          <Text
            style={{
              fontSize: 16,
              lineHeight: 24,
              color: "#333",
              marginBottom: 20,
            }}
          >
            Welcome to Ready, Set, Fly!
            {"\n\n"}
            These Terms of Use ("Terms") govern your access to and use of the Ready, Set, Fly! mobile application ("App") and any related services (collectively, the "Services") provided by Austin Ready Set Fly, LLC. ("Company," "we," "us," or "our"). By accessing or using our Services, you agree to be bound by these Terms. If you do not agree to these Terms, please do not use our Services.
            {"\n\n"}
            <Text style={{ fontWeight: "bold" }}>Eligibility</Text>
            {"\n"}1.1 You must be at least 18 years old to use our Services. By using the Services, you represent and warrant that you are of legal age to form a binding contract and meet all eligibility requirements.
            {"\n"}1.2 The Services are intended for users who can legally operate an aircraft and who possess all necessary licenses, certifications, and insurance. By using the Services, you represent and warrant that you meet these qualifications.
            {"\n\n"}
            <Text style={{ fontWeight: "bold" }}>Account Registration</Text>
            {"\n"}2.1 To access certain features of the App, you may be required to create an account. When you create an account, you agree to provide accurate, current, and complete information and to update this information as necessary.
            {"\n"}2.2 You are responsible for maintaining the confidentiality of your account credentials and for all activities that occur under your account. You agree to notify us immediately of any unauthorized use of your account.
            {"\n\n"}
            <Text style={{ fontWeight: "bold" }}>Use of Services</Text>
            {"\n"}3.1 Aircraft Listings: Aircraft owners ("Owners") may create listings to make their aircraft available for rent. Owners are solely responsible for the accuracy, content, and legality of their listings.
            {"\n"}3.2 Renters: Users who wish to rent an aircraft ("Renters") may browse available listings and make rental bookings through the App. Renters are responsible for complying with all terms and conditions set forth by the Owner.
            {"\n"}3.3 Bookings: When a Renter books an aircraft, a contract is formed directly between the Renter and the Owner. We are not a party to this contract and do not guarantee the quality, safety, or legality of the aircraft or the services provided by the Owner.
            {"\n"}3.4 FAA Safety and Insurance Obligations:
            {"\n"}- FAA Safety Regulations: It is the sole responsibility of both Owners and Renters to comply with all applicable Federal Aviation Administration (FAA) safety regulations during each rental transaction.
            {"\n"}- Insurance Responsibilities: All users are responsible for maintaining the required insurance coverage as mandated by applicable law and for any additional insurance obligations that may be agreed upon by the parties involved in a rental transaction.
            {"\n\n"}
            <Text style={{ fontWeight: "bold" }}>Fees and Payments</Text>
            {"\n"}4.1 Service Fees: We may charge service fees for the use of the App, including fees for processing payments. These fees will be disclosed to you before you complete a transaction.
            {"\n"}4.2 Payment Processing: Payments between Renters and Owners may be processed through third-party payment providers. By using the Services, you agree to comply with the terms and conditions of the payment provider.
            {"\n"}4.3 Cancellations and Refunds: Cancellation and refund policies may vary depending on the terms set by the Owner. It is your responsibility to review these terms before making a booking. We are not responsible for any cancellations or refunds.
            {"\n\n"}
            <Text style={{ fontWeight: "bold" }}>User Conduct</Text>
            {"\n"}5.1 You agree not to use the Services for any unlawful or prohibited purpose. You agree not to:
            {"\n"}- Violate any applicable laws or regulations.
            {"\n"}- Post or transmit any false, misleading, or defamatory content.
            {"\n"}- Infringe on the rights of others, including intellectual property rights.
            {"\n"}- Engage in any conduct that is harmful, fraudulent, or deceptive.
            {"\n"}5.2 We reserve the right to suspend or terminate your account if you violate these Terms or engage in any prohibited conduct.
            {"\n\n"}
            <Text style={{ fontWeight: "bold" }}>Intellectual Property</Text>
            {"\n"}6.1 All content and materials available on the App, including text, graphics, logos, and software, are the property of the Company or its licensors and are protected by copyright, trademark, and other intellectual property laws.
            {"\n"}6.2 You are granted a limited, non-exclusive, non-transferable, and revocable license to access and use the App for your personal, non-commercial use. You may not reproduce, distribute, modify, or create derivative works from any content or materials on the App without our prior written consent.
            {"\n\n"}
            <Text style={{ fontWeight: "bold" }}>Disclaimers</Text>
            {"\n"}7.1 No Warranty: The Services are provided on an "as-is" and "as-available" basis. We make no warranties or representations about the accuracy, reliability, completeness, or timeliness of the Services. We do not warrant that the Services will be uninterrupted, error-free, or secure.
            {"\n"}7.2 Limitation of Liability: To the fullest extent permitted by law, we shall not be liable for any direct, indirect, incidental, special, or consequential damages arising out of or in connection with your use of the Services, including any damages resulting from the use or inability to use the App, or any content or materials obtained through the App.
            {"\n\n"}
            <Text style={{ fontWeight: "bold" }}>Indemnification</Text>
            {"\n"}You agree to indemnify, defend, and hold harmless the Company, its officers, directors, employees, and agents from and against any claims, liabilities, damages, losses, and expenses, including reasonable attorneys' fees, arising out of or in any way connected with your access to or use of the Services, your violation of these Terms, or your infringement of any rights of another.
            {"\n\n"}
            <Text style={{ fontWeight: "bold" }}>Termination</Text>
            {"\n"}We reserve the right to terminate or suspend your account and access to the Services at any time, with or without cause, and with or without notice.
            {"\n\n"}
            <Text style={{ fontWeight: "bold" }}>Governing Law</Text>
            {"\n"}These Terms shall be governed by and construed in accordance with the laws of the State of [State], without regard to its conflict of law principles. Any disputes arising out of or in connection with these Terms shall be resolved in the state or federal courts located in [County, State].
            {"\n\n"}
            <Text style={{ fontWeight: "bold" }}>Changes to the Terms</Text>
            {"\n"}We may update these Terms from time to time. If we make material changes, we will notify you by posting the updated Terms on the App and updating the "Effective Date" at the top of the Terms. Your continued use of the Services after any such changes constitutes your acceptance of the new Terms.
          </Text>
          <CustomButton onPress={onAccept} text="Accept Terms" backgroundColor="#10b981" />
        </ScrollView>
      </View>
    </View>
  </Modal>
);

// Profile Information Modal
const ProfileModal = ({ visible, profileData, onProfileChange, onSave }) => (
  <Modal visible={visible} animationType="slide" transparent={true} onRequestClose={() => {}}>
    <View
      style={{
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        backgroundColor: "rgba(0,0,0,0.5)",
      }}
    >
      <View
        style={{
          backgroundColor: "white",
          borderRadius: 8,
          padding: 16,
          width: "90%",
          maxHeight: "80%",
        }}
      >
        <ScrollView contentContainerStyle={{ padding: 8 }}>
          <Text style={{ fontSize: 18, fontWeight: "bold", marginBottom: 16 }}>
            Complete Your Profile
          </Text>
          <TextInput
            placeholder="First Name"
            placeholderTextColor="#888"
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
            placeholderTextColor="#888"
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
            placeholder="Email Address"
            placeholderTextColor="#888"
            value={profileData.email}
            onChangeText={(value) => onProfileChange("email", value)}
            style={{
              borderWidth: 1,
              borderColor: "#ccc",
              borderRadius: 8,
              padding: 12,
              marginBottom: 16,
            }}
          />
          <TextInput
            placeholder="Phone Number (optional)"
            placeholderTextColor="#888"
            value={profileData.phoneNumber}
            onChangeText={(value) => onProfileChange("phoneNumber", value)}
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
              { label: "Renter", value: "renter" },
              { label: "Other", value: "other" },
              { label: "Both", value: "both" },
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
