import React, { useEffect, useState } from "react";
import { StatusBar } from "expo-status-bar";
import {
  Alert,
  View,
  Text,
  Image,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Linking as RNLinking,
} from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { NavigationContainer } from "@react-navigation/native";
import { StripeProvider } from "@stripe/stripe-react-native";
import { Stack } from "expo-router";
import { Picker } from "@react-native-picker/picker"; // Import Picker for dropdowns
import {
  onAuthStateChanged,
  updateProfile,
  signOut,
  sendPasswordResetEmail,
} from "firebase/auth";
import { auth, db } from "../firebaseConfig";
import { doc, setDoc } from "firebase/firestore";
import CustomButton from "../components/CustomButton";
// IMPORTANT: Use the new transparent logo image (ensure your images constants exports logoTransparent)
import { images } from "../constants";
import { router } from "expo-router";

// Function to retrieve Stripe Publishable Key
const getStripePublishableKey = () => {
  const stripePublishableKey = process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY;
  if (!stripePublishableKey) {
    throw new Error(
      "Missing Stripe Publishable Key. Please set EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY in your .env"
    );
  }
  return stripePublishableKey;
};

const App = () => {
  const [user, setUser] = useState(null);
  const [isModalVisible, setModalVisible] = useState(false);
  const [forgotPasswordEmail, setForgotPasswordEmail] = useState("");
  const [profileData, setProfileData] = useState({
    firstName: "",
    lastName: "",
    role: "",
    location: "",
    aircraftType: "",
    medicalStatus: "",
    insuranceStatus: "",
    annualDate: "",
  });

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
    });
    return () => unsubscribe(); // Cleanup the listener on unmount
  }, []);

  const handleSaveProfile = async () => {
    if (user) {
      const userDoc = doc(db, "users", user.uid);
      try {
        const { role } = profileData;
        if (!["renter", "owner", "both"].includes(role.toLowerCase())) {
          throw new Error(
            "Invalid role selected. Please choose 'Renter', 'Owner', or 'Both'."
          );
        }
        await setDoc(userDoc, {
          ...profileData,
          role: role.toLowerCase(),
        });
        await updateProfile(user, {
          displayName: `${profileData.firstName} ${profileData.lastName}`,
        });
        setModalVisible(false);
        // Navigate to the correct screen based on the selected role and pass profile data
        if (role.toLowerCase() === "owner") {
          router.push({
            pathname: "/owner",
            params: { profileData },
          });
        } else if (role.toLowerCase() === "renter") {
          router.push({
            pathname: "/renter",
            params: { profileData },
          });
        } else if (role.toLowerCase() === "both") {
          router.push({
            pathname: "/classifieds",
            params: { profileData },
          });
        }
      } catch (error) {
        console.error("Error saving profile data: ", error);
      }
    }
  };

  const handleViewContent = () => {
    router.push("/home");
  };

  const handleNeedHelp = () => {
    const email = "coryarmer@gmail.com";
    const subject = "Support - Ready, Set, Fly!";
    const url = `mailto:${email}?subject=${encodeURIComponent(subject)}`;
    RNLinking.openURL(url).catch((err) =>
      console.error("Failed to open email client", err)
    );
  };

  // Attach the forgot password handler correctly
  const handleForgotPassword = (email) => {
    sendPasswordResetEmail(auth, email)
      .then(() => {
        console.log("Password reset email sent!");
        Alert.alert(
          "Password Reset",
          "Password reset email sent! Please check your inbox.",
          [{ text: "OK" }]
        );
      })
      .catch((error) => {
        console.error("Error sending password reset email: ", error);
      });
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      router.push("/sign-in");
    } catch (error) {
      console.error("Error signing out: ", error);
    }
  };

  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <ScrollView
        contentContainerStyle={styles.scrollContainer}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero Section */}
        <View style={styles.heroContainer}>
          <Text style={styles.heroTitle}>A New Aircraft Marketplace</Text>
          <Text style={styles.heroSubtitle}>
            Your gateway to the skies. Discover top-rated aircraft rentals,
            connect with trusted owners, and experience the new way to rent
            aircraft. Plus, for owners—let your aircraft pay for itself by
            tapping into a dynamic rental marketplace.
          </Text>
        </View>

        {user ? (
          <View style={styles.contentWrapper}>
            <View style={styles.logoContainer}>
              <Image source={images.logo2} style={styles.logo} />
            </View>
            <View style={styles.viewContentButtonContainer}>
              <CustomButton
                title="Explore Ready, Set, Fly!"
                handlePress={handleViewContent}
                containerStyles={styles.viewContentButton}
                textStyles={styles.buttonText}
              />
              <View style={styles.buttonSpacer} />
              {/* Additional buttons can be added here */}
            </View>
            <View style={styles.helpLogoutContainer}>
              <TouchableOpacity onPress={handleNeedHelp}>
                <Text style={styles.helpText}>Need Help?</Text>
              </TouchableOpacity>
              <Text style={styles.separator}> | </Text>
              <TouchableOpacity onPress={handleLogout}>
                <Text style={styles.logoutText}>Log out</Text>
              </TouchableOpacity>
            </View>
            {/* Terms & Privacy Links */}
            <View style={styles.linkContainer}>
              <TouchableOpacity
                onPress={() =>
                  RNLinking.openURL("https://readysetfly.us/terms")
                }
              >
                <Text style={styles.linkText}>Terms of Service</Text>
              </TouchableOpacity>
              <Text style={styles.separator}> | </Text>
              <TouchableOpacity
                onPress={() =>
                  RNLinking.openURL("https://readysetfly.us/privacy")
                }
              >
                <Text style={styles.linkText}>Privacy Policy</Text>
              </TouchableOpacity>
            </View>

            {/* Footer */}
            <View style={styles.footer}>
              <Text style={styles.footerText}>
                © 2025 Austin Ready Set Fly, LLC
              </Text>
            </View>
          </View>
        ) : (
          <View style={styles.signInContainer}>
            <TouchableOpacity
              onPress={() => router.push("/sign-in")}
              style={styles.signInButton}
            >
              <Text style={styles.signInButtonText}>
                Sign In or Create Account
              </Text>
            </TouchableOpacity>
            {/* Forgot Password Section */}
            <TextInput
              placeholder="Enter your email for password reset"
              placeholderTextColor="#888"
              style={styles.input}
              value={forgotPasswordEmail}
              onChangeText={setForgotPasswordEmail}
            />
            <CustomButton
              title="Forgot Password"
              handlePress={() => handleForgotPassword(forgotPasswordEmail)}
              containerStyles={styles.saveButton}
              textStyles={styles.buttonText}
            />
            {/* Footer for non-logged in state */}
            <View style={styles.footer}>
              <Text style={styles.footerText}>
                © 2025 Austin Ready Set Fly, LLC
              </Text>
            </View>
          </View>
        )}

        {/* Profile Modal */}
        <Modal
          visible={isModalVisible}
          transparent={true}
          animationType="slide"
        >
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : "height"}
            style={styles.keyboardAvoidingView}
          >
            <View style={styles.modalContainer}>
              <View style={styles.modalContent}>
                <ScrollView
                  contentContainerStyle={styles.modalScroll}
                  showsVerticalScrollIndicator={false}
                >
                  <Text style={styles.modalTitle}>Complete Your Profile</Text>
                  <TextInput
                    placeholder="First Name"
                    placeholderTextColor="#888"
                    style={styles.input}
                    value={profileData.firstName}
                    onChangeText={(text) =>
                      setProfileData({ ...profileData, firstName: text })
                    }
                  />
                  <TextInput
                    placeholder="Last Name"
                    placeholderTextColor="#888"
                    style={styles.input}
                    value={profileData.lastName}
                    onChangeText={(text) =>
                      setProfileData({ ...profileData, lastName: text })
                    }
                  />
                  {/* Role Picker */}
                  <View style={styles.pickerContainer}>
                    <Picker
                      selectedValue={profileData.role}
                      style={styles.picker}
                      onValueChange={(itemValue) =>
                        setProfileData({ ...profileData, role: itemValue })
                      }
                    >
                      <Picker.Item label="Select Role" value="" />
                      <Picker.Item label="Renter" value="renter" />
                      <Picker.Item label="Owner" value="owner" />
                      <Picker.Item label="Both" value="both" />
                    </Picker>
                  </View>
                  {/* Combined City and State */}
                  <TextInput
                    placeholder="City, State"
                    placeholderTextColor="#888"
                    style={styles.input}
                    value={profileData.location}
                    onChangeText={(text) =>
                      setProfileData({ ...profileData, location: text })
                    }
                  />
                  {/* Year/Make/Model */}
                  <TextInput
                    placeholder="Year/Make/Model"
                    placeholderTextColor="#888"
                    style={styles.input}
                    value={profileData.aircraftType}
                    onChangeText={(text) =>
                      setProfileData({ ...profileData, aircraftType: text })
                    }
                  />
                  {/* Medical Current Picker */}
                  <View style={styles.pickerContainer}>
                    <Picker
                      selectedValue={profileData.medicalStatus}
                      style={styles.picker}
                      onValueChange={(itemValue) =>
                        setProfileData({
                          ...profileData,
                          medicalStatus: itemValue,
                        })
                      }
                    >
                      <Picker.Item label="Is Medical Current?" value="" />
                      <Picker.Item label="Yes" value="yes" />
                      <Picker.Item label="No" value="no" />
                    </Picker>
                  </View>
                  {/* Insurance Picker */}
                  <View style={styles.pickerContainer}>
                    <Picker
                      selectedValue={profileData.insuranceStatus}
                      style={styles.picker}
                      onValueChange={(itemValue) =>
                        setProfileData({
                          ...profileData,
                          insuranceStatus: itemValue,
                        })
                      }
                    >
                      <Picker.Item label="Is Insurance Current?" value="" />
                      <Picker.Item label="Yes" value="yes" />
                      <Picker.Item label="No" value="no" />
                    </Picker>
                  </View>
                  <TextInput
                    placeholder="Date of Last Annual"
                    placeholderTextColor="#888"
                    style={styles.input}
                    value={profileData.annualDate}
                    onChangeText={(text) =>
                      setProfileData({ ...profileData, annualDate: text })
                    }
                  />
                  <CustomButton
                    title="Save Profile"
                    handlePress={handleSaveProfile}
                    containerStyles={styles.saveButton}
                    textStyles={styles.buttonText}
                  />
                  <CustomButton
                    title="Close"
                    handlePress={() => setModalVisible(false)}
                    containerStyles={styles.closeButton}
                    textStyles={styles.buttonText}
                  />
                </ScrollView>
              </View>
            </View>
          </KeyboardAvoidingView>
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
            {/* <Stack.Screen name="flights" options={{ headerShown: false }} /> */}
            <Stack.Screen name="classifieds" options={{ headerShown: false }} />
            <Stack.Screen name="home" options={{ headerShown: false }} />
            <Stack.Screen
              name="OwnerProfile"
              options={{ headerShown: false }}
            />
            <Stack.Screen name="renter" options={{ headerShown: false }} />
            <Stack.Screen
              name="PaymentScreen"
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="CheckoutScreen"
              options={{ headerShown: false }}
            />
          </Stack>
        </NavigationContainer>
      </SafeAreaProvider>
    </StripeProvider>
  );
};

/**
 * Color Scheme (Metallic Silver Look):
 * - Primary buttons: Medium silver (#C0C0C0)
 * - Button text: Dark gray (#1E1E1E)
 * - Secondary/Close button: Slightly darker silver (#707070)
 */
const styles = StyleSheet.create({
  scrollContainer: {
    flexGrow: 1,
    justifyContent: "flex-start",
    paddingHorizontal: 20,
    paddingTop: 40, // Reduced top padding to bring content closer to the top
  },
  contentWrapper: {
    flex: 1,
    justifyContent: "space-between",
  },
  // Hero Section
  heroContainer: {
    marginBottom: 40,
    alignItems: "center",
    paddingHorizontal: 10,
  },
  heroTitle: {
    fontSize: 36,
    fontWeight: "bold",
    color: "#C0C0C0",
    textAlign: "center",
    marginBottom: 10,
  },
  heroSubtitle: {
    fontSize: 18,
    color: "#1E1E1E",
    textAlign: "center",
    paddingHorizontal: 20,
  },
  logoContainer: {
    alignItems: "center",
    marginBottom: 20,
  },
  logo: {
    width: 300,
    height: 300,
    borderRadius: 20,
    marginTop: -50,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 10,
  },
  helpLogoutContainer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginTop: 5,
    marginBottom: 10,
  },
  helpText: {
    fontSize: 16,
    color: "#007bff",
    marginHorizontal: 5,
  },
  separator: {
    fontSize: 16,
    color: "#000",
  },
  logoutText: {
    fontSize: 16,
    color: "#007bff",
    marginHorizontal: 5,
  },
  signInContainer: {
    marginBottom: 20,
  },
  // Buttons
  signInButton: {
    backgroundColor: "#C0C0C0",
    paddingVertical: 15,
    borderRadius: 8,
    marginBottom: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 2,
  },
  signInButtonText: {
    color: "#1E1E1E",
    fontSize: 18,
    textAlign: "center",
  },
  viewContentButtonContainer: {
    marginBottom: 10,
  },
  viewContentButton: {
    backgroundColor: "#C0C0C0",
    paddingVertical: 15,
    borderRadius: 8,
  },
  buttonText: {
    color: "#1E1E1E",
    fontSize: 16,
    textAlign: "center",
  },
  buttonSpacer: {
    height: 10,
  },
  modalContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  modalContent: {
    width: "90%",
    backgroundColor: "white",
    padding: 20,
    borderRadius: 15,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: "bold",
    marginBottom: 20,
    textAlign: "center",
    color: "#333",
  },
  input: {
    borderWidth: 1,
    borderColor: "#ddd",
    padding: 15,
    borderRadius: 10,
    marginBottom: 15,
    color: "#000",
    fontSize: 16,
    backgroundColor: "#f7f7f7",
  },
  pickerContainer: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 10,
    marginBottom: 15,
    backgroundColor: "#f7f7f7",
  },
  picker: {
    height: 50,
    width: "100%",
  },
  saveButton: {
    backgroundColor: "#C0C0C0",
    paddingVertical: 15,
    borderRadius: 10,
    marginBottom: 10,
  },
  closeButton: {
    backgroundColor: "#707070",
    paddingVertical: 15,
    borderRadius: 10,
  },
  keyboardAvoidingView: {
    flex: 1,
  },
  modalScroll: {
    flexGrow: 1,
    paddingBottom: 20,
  },
  footer: {
    alignItems: "center",
    marginBottom: 20,
  },
  footerText: {
    fontSize: 12,
    color: "#1E1E1E",
  },
  linkContainer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 10, // space between links and footer
  },
  linkText: {
    fontSize: 16,
    color: "#007bff", // match your existing link coloring
    marginHorizontal: 5,
  },
});

export default App;
