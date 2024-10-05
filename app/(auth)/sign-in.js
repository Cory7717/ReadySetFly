import React, { useState } from "react";
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
} from "react-native";
import { useSignIn, useClerk } from "@clerk/clerk-expo"; // Import useClerk
import { useNavigation } from "@react-navigation/native";
import { images } from "../../constants";

const SignIn = () => {
  const { signIn, setActive, isLoaded } = useSignIn();
  const clerk = useClerk(); // Get Clerk client
  const navigation = useNavigation();

  const [emailAddress, setEmailAddress] = useState("");
  const [password, setPassword] = useState("");
  const [forgotPasswordModalVisible, setForgotPasswordModalVisible] = useState(false);
  const [recoveryEmail, setRecoveryEmail] = useState("");
  const [isSendingReset, setIsSendingReset] = useState(false);
  const [resetMessage, setResetMessage] = useState("");

  const onSignInPress = React.useCallback(async () => {
    if (!isLoaded) return;

    try {
      const signInAttempt = await signIn.create({
        identifier: emailAddress,
        password,
      });

      if (signInAttempt.status === "complete") {
        await setActive({ session: signInAttempt.createdSessionId });
        navigation.navigate("(tabs)"); // Navigate to the main tabs screen
      } else {
        console.error(JSON.stringify(signInAttempt, null, 2));
      }
    } catch (err) {
      console.error(JSON.stringify(err, null, 2));
    }
  }, [isLoaded, emailAddress, password, navigation]);

  const onForgotPasswordPress = () => {
    setForgotPasswordModalVisible(true);
  };

  const handlePasswordReset = async () => {
    setIsSendingReset(true);
    setResetMessage("");

    try {
      // Use Clerk client to send reset password email
      await clerk.sendPasswordResetEmail({
        emailAddress: recoveryEmail,
      });
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
        <Image
          source={images.logo}
          resizeMode="contain"
          style={styles.logo}
        />
        <Text style={styles.title}>
          Login to Ready, Set, Fly!
        </Text>
        <View style={styles.inputContainer}>
          <TextInput
            autoCapitalize="none"
            value={emailAddress}
            placeholder="Email"
            onChangeText={setEmailAddress}
            style={styles.input}
          />
          <TextInput
            value={password}
            placeholder="Password"
            secureTextEntry
            onChangeText={setPassword}
            style={styles.input}
          />
          <TouchableOpacity
            onPress={onSignInPress}
            style={styles.signInButton}
          >
            <Text style={styles.signInButtonText}>
              Sign In
            </Text>
          </TouchableOpacity>
          {/* Forgot password link */}
          <TouchableOpacity
            onPress={onForgotPasswordPress}
            style={styles.forgotPasswordButton}
          >
            <Text style={styles.forgotPasswordText}>
              Forgot password?
            </Text>
          </TouchableOpacity>
          <View style={styles.footer}>
            <Text style={styles.footerText}>
              Don't have an account?
            </Text>
            <TouchableOpacity onPress={() => navigation.navigate("sign-up")}>
              <Text style={styles.signUpText}>
                Sign up
              </Text>
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
