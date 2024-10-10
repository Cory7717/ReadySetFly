import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  Image,
  TextInput,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Modal,
  ActivityIndicator,
  Alert,
} from "react-native";
import { getAuth, signInWithEmailAndPassword, GoogleAuthProvider, signInWithCredential } from "firebase/auth"; // Import Firebase Auth methods
import { useNavigation } from "@react-navigation/native";
import { images } from "../../constants";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Google from 'expo-auth-session/providers/google'; // Import Google Auth Session
import firebase from '@react-native-firebase/app'; // Import firebase app
import auth from '@react-native-firebase/auth'; // Import firebase auth

const SignIn = () => {
  const navigation = useNavigation();
  const auth = getAuth(); // Firebase Auth instance

  const [emailAddress, setEmailAddress] = useState("");
  const [password, setPassword] = useState("");
  const [forgotPasswordModalVisible, setForgotPasswordModalVisible] = useState(false);
  const [recoveryEmail, setRecoveryEmail] = useState("");
  const [isSendingReset, setIsSendingReset] = useState(false);
  const [resetMessage, setResetMessage] = useState("");

  // Google sign-in setup
  const [request, response, promptAsync] = Google.useIdTokenAuthRequest({
    clientId: '64600529166-fir2apdksujl8noihmff9n06seoql865.apps.googleusercontent.com', // Replace with your actual Google client ID
  });

  // Handle Google sign-in response
  useEffect(() => {
    if (response?.type === 'success') {
      const { id_token } = response.params;
      const credential = GoogleAuthProvider.credential(id_token);
      signInWithCredential(auth, credential)
        .then(() => {
          console.log("Signed in with Google!");
          navigation.navigate("(tabs)"); // Navigate to main tabs after login
        })
        .catch((error) => {
          console.error("Google sign-in error: ", error);
          Alert.alert("Error", "Google sign-in failed. Please try again.");
        });
    }
  }, [response]);

  // Failed Attempts State
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [isLockedOut, setIsLockedOut] = useState(false);
  const [lockoutEndTime, setLockoutEndTime] = useState(null);
  const [lockoutRemainingTime, setLockoutRemainingTime] = useState("");

  // Constants
  const MAX_FAILED_ATTEMPTS = 4;
  const LOCKOUT_DURATION = 20 * 60 * 1000; // 20 minutes in milliseconds

  // Load lockout data on mount
  useEffect(() => {
    const loadLockoutData = async () => {
      try {
        const attempts = await AsyncStorage.getItem("failedAttempts");
        const lockoutTime = await AsyncStorage.getItem("lockoutEndTime");

        if (attempts !== null) {
          setFailedAttempts(parseInt(attempts, 10));
        }

        if (lockoutTime !== null) {
          const endTime = new Date(parseInt(lockoutTime, 10));
          const now = new Date();

          if (now < endTime) {
            setIsLockedOut(true);
            setLockoutEndTime(endTime);
            updateLockoutRemainingTime(endTime);
            startLockoutTimer(endTime);
          } else {
            // Lockout period has passed
            await AsyncStorage.removeItem("lockoutEndTime");
            await AsyncStorage.setItem("failedAttempts", "0");
            setFailedAttempts(0);
            setIsLockedOut(false);
          }
        }
      } catch (error) {
        console.error("Error loading lockout data:", error);
      }
    };

    loadLockoutData();
  }, []);

  const onSignInPress = React.useCallback(async () => {
    if (isLockedOut) {
      Alert.alert(
        "Account Locked",
        `Too many failed attempts. Please try again in ${lockoutRemainingTime}.`
      );
      return;
    }

    try {
      const userCredential = await signInWithEmailAndPassword(auth, emailAddress, password);
      const user = userCredential.user;

      const idToken = await user.getIdToken(/* forceRefresh */ true);
      console.log("Firebase ID Token:", idToken);

      navigation.navigate("(tabs)");

      setFailedAttempts(0);
      await AsyncStorage.setItem("failedAttempts", "0");

    } catch (err) {
      handleFailedAttempt();
      console.error(err);
    }
  }, [
    emailAddress,
    password,
    navigation,
    isLockedOut,
    lockoutRemainingTime,
  ]);

  const handleFailedAttempt = async () => {
    const newFailedAttempts = failedAttempts + 1;
    setFailedAttempts(newFailedAttempts);
    await AsyncStorage.setItem("failedAttempts", newFailedAttempts.toString());

    if (newFailedAttempts >= MAX_FAILED_ATTEMPTS) {
      const endTime = new Date(new Date().getTime() + LOCKOUT_DURATION);
      setIsLockedOut(true);
      setLockoutEndTime(endTime);
      setLockoutRemainingTime("20m 0s");
      await AsyncStorage.setItem("lockoutEndTime", endTime.getTime().toString());

      Alert.alert(
        "Account Locked",
        "You have been locked out due to multiple failed sign-in attempts. Please try again after 20 minutes."
      );

      startLockoutTimer(endTime);
    } else {
      Alert.alert(
        "Sign In Failed",
        `Invalid credentials. You have ${MAX_FAILED_ATTEMPTS - newFailedAttempts} attempt(s) left before lockout.`
      );
    }
  };

  const onForgotPasswordPress = () => {
    setForgotPasswordModalVisible(true);
  };

  const handlePasswordReset = async () => {
    setIsSendingReset(true);
    setResetMessage("");

    try {
      await auth.sendPasswordResetEmail(recoveryEmail);
      setResetMessage("Reset email sent successfully! Please check your inbox.");
    } catch (err) {
      setResetMessage("Failed to send reset email. Please try again.");
      console.error(err);
    } finally {
      setIsSendingReset(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.content}>
        <Image source={images.logo} resizeMode="contain" style={styles.logo} />
        <Text style={styles.title}>Login to Ready, Set, Fly!</Text>
        <View style={styles.inputContainer}>
          <TextInput
            autoCapitalize="none"
            value={emailAddress}
            placeholder="Email"
            onChangeText={setEmailAddress}
            style={styles.input}
            keyboardType="email-address"
            editable={!isLockedOut}
          />
          <TextInput
            value={password}
            placeholder="Password"
            secureTextEntry
            onChangeText={setPassword}
            style={styles.input}
            editable={!isLockedOut}
          />
          <TouchableOpacity
            onPress={onSignInPress}
            style={[
              styles.signInButton,
              isLockedOut && styles.disabledButton,
            ]}
            disabled={isLockedOut}
          >
            {isLockedOut ? (
              <Text style={styles.signInButtonText}>
                Locked ({lockoutRemainingTime})
              </Text>
            ) : (
              <Text style={styles.signInButtonText}>Sign In</Text>
            )}
          </TouchableOpacity>

          {/* Google sign-in button */}
          <TouchableOpacity
            onPress={() => promptAsync()}
            style={styles.googleButton}
            disabled={!request}
          >
            <Text style={styles.googleButtonText}>Log in with Google</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={onForgotPasswordPress}
            style={styles.forgotPasswordButton}
            disabled={isLockedOut}
          >
            <Text style={styles.forgotPasswordText}>Forgot password?</Text>
          </TouchableOpacity>
          <View style={styles.footer}>
            <Text style={styles.footerText}>Don't have an account?</Text>
            <TouchableOpacity onPress={() => navigation.navigate("sign-up")}>
              <Text style={styles.signUpText}>Sign up</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* Forgot Password Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={forgotPasswordModalVisible}
        onRequestClose={() => setForgotPasswordModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Forgot Password?</Text>
            <TextInput
              autoCapitalize="none"
              value={recoveryEmail}
              placeholder="Enter your email"
              onChangeText={setRecoveryEmail}
              style={styles.input}
              keyboardType="email-address"
            />
            {isSendingReset ? (
              <ActivityIndicator size="large" color="#3b82f6" />
            ) : (
              <TouchableOpacity
                style={styles.sendButton}
                onPress={handlePasswordReset}
              >
                <Text style={styles.sendButtonText}>Send Reset Link</Text>
              </TouchableOpacity>
            )}
            {resetMessage !== "" && (
              <Text style={styles.resetMessage}>{resetMessage}</Text>
            )}
            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => setForgotPasswordModalVisible(false)}
            >
              <Text style={styles.closeButtonText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'white',
    padding: 16,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logo: {
    width: 280,
    height: 240,
    marginBottom: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  inputContainer: {
    width: '75%',
    maxWidth: 400,
    gap: 16,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  signInButton: {
    backgroundColor: '#3b82f6',
    borderRadius: 8,
    padding: 12,
  },
  googleButton: {
    backgroundColor: '#db4437',
    borderRadius: 8,
    padding: 12,
    marginTop: 16,
  },
  googleButtonText: {
    color: 'white',
    textAlign: 'center',
    fontSize: 18,
    fontWeight: '600',
  },
  disabledButton: {
    backgroundColor: '#a5b4fc',
  },
  signInButtonText: {
    color: 'white',
    textAlign: 'center',
    fontSize: 18,
    fontWeight: '600',
  },
  forgotPasswordButton: {
    marginTop: 16,
  },
  forgotPasswordText: {
    fontSize: 16,
    color: '#3b82f6',
    textAlign: 'center',
    fontWeight: '600',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 16,
  },
  footerText: {
    fontSize: 18,
    color: '#4b5563',
  },
  signUpText: {
    fontSize: 18,
    color: '#3b82f6',
    marginLeft: 8,
    fontWeight: '600',
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContent: {
    width: '90%',
    padding: 25,
    backgroundColor: 'white',
    borderRadius: 8,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 20,
  },
  sendButton: {
    backgroundColor: '#3b82f6',
    borderRadius: 8,
    padding: 12,
    marginTop: 20,
    width: '80%',
    alignItems: 'center',
  },
  sendButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  closeButton: {
    marginTop: 20,
  },
  closeButtonText: {
    color: 'red',
    fontSize: 16,
  },
  resetMessage: {
    marginTop: 20,
    fontSize: 16,
    color: 'green',
    textAlign: 'center',
  },
});

export default SignIn;
