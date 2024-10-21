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
} from "firebase/auth";
import { getFirestore, doc, setDoc } from "firebase/firestore";
import { app } from "../../firebaseConfig"; // Adjust the path to your firebaseConfig.js
import RNPickerSelect from "react-native-picker-select";
import { useNavigation } from "@react-navigation/native";
import { images } from "../../constants";
import { MaterialIcons } from "@expo/vector-icons";

const SignUp = () => {
  const navigation = useNavigation();

  // State variables for form data and visibility
  const [emailAddress, setEmailAddress] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [termsVisible, setTermsVisible] = useState(false);
  const [profileVisible, setProfileVisible] = useState(false);
  const [profileData, setProfileData] = useState({
    firstName: "",
    lastName: "",
    location: "",
    profileType: "renter", // Default to "renter"
  });
  const [loading, setLoading] = useState(false);

  const auth = getAuth(app); // Initialize Firebase Auth
  const db = getFirestore(app); // Initialize Firestore

  // Handle form input changes
  const handleProfileChange = (field, value) => {
    setProfileData((prevState) => ({
      ...prevState,
      [field]: value,
    }));
  };

  // Handle sign-up process with Firebase
  const onSignUpPress = useCallback(async () => {
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
      // Create a new user with Firebase Authentication
      await createUserWithEmailAndPassword(auth, emailAddress, password);
      const user = auth.currentUser;

      // Send email verification
      if (user) {
        await sendEmailVerification(user);
        setTermsVisible(true); // Show Terms of Service modal if sign-up is successful
      }
    } catch (err) {
      console.error("Sign Up Error:", err);
      Alert.alert(
        "Sign Up Error",
        "There was an error during sign up. Please check your email and password."
      );
    } finally {
      setLoading(false);
    }
  }, [auth, emailAddress, password, confirmPassword]);

  // Handle terms acceptance
  const onAcceptTerms = useCallback(() => {
    setTermsVisible(false);

    // Email verification is already sent during sign-up
    setProfileVisible(true); // Show profile modal for user to complete their profile
  }, []);

  // Handle profile submission
  const onProfileSubmit = async () => {
    const user = auth.currentUser;
    if (user) {
      try {
        // Save profile data to Firestore
        await setDoc(doc(db, "users", user.uid), {
          email: user.email,
          firstName: profileData.firstName,
          lastName: profileData.lastName,
          location: profileData.location,
          profileType: profileData.profileType,
          createdAt: new Date(),
        });

        // Hide the profile modal
        setProfileVisible(false);

        // Redirect to the home screen
        navigation.navigate("(tabs)");
      } catch (error) {
        console.error("Error saving profile data:", error);
        Alert.alert("Error", "Failed to save profile data. Please try again.");
      }
    } else {
      Alert.alert("Error", "No authenticated user found.");
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
          <Text style={{ fontSize: 18, color: "#4b5563" }}>Already have an account?</Text>
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
    }}
    disabled={loading}
  >
    <Text
      style={{ color: "white", textAlign: "center", fontSize: 18, fontWeight: "600" }}
    >
      {loading ? "Please wait..." : text}
    </Text>
  </TouchableOpacity>
);

// Terms of Service Modal
const TermsOfServiceModal = ({ visible, onAccept }) => (
  <Modal
    visible={visible}
    animationType="slide"
    transparent={true}
    onRequestClose={() => {}}
  >
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
          padding: 16,
          borderRadius: 8,
          width: "90%",
          maxHeight: "80%",
        }}
      >
        <ScrollView contentContainerStyle={{ padding: 8 }}>
          <Text style={{ fontSize: 18, fontWeight: "bold", marginBottom: 16 }}>
            Terms of Service
          </Text>
          <Text style={{ marginBottom: 16 }}>
            {/* Terms of service content goes here */}
          </Text>
          <CustomButton onPress={onAccept} text="Accept Terms" backgroundColor="#10b981" />
        </ScrollView>
      </View>
    </View>
  </Modal>
);

// Profile Information Modal
const ProfileModal = ({ visible, profileData, onProfileChange, onSave }) => (
  <Modal
    visible={visible}
    animationType="slide"
    transparent={true}
    onRequestClose={() => {}}
  >
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
            placeholder="City and State"
            placeholderTextColor="#888"
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
