import * as React from 'react';
import { TextInput, Button, View, StyleSheet, Alert } from 'react-native';
import { getAuth, createUserWithEmailAndPassword, sendEmailVerification, onAuthStateChanged } from 'firebase/auth';
import { useNavigation } from '@react-navigation/native';

export default function RenterSignUp() {
  const [emailAddress, setEmailAddress] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [pendingVerification, setPendingVerification] = React.useState(false);
  const auth = getAuth();
  const navigation = useNavigation();

  const onSignUpPress = async () => {
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, emailAddress, password);
      const user = userCredential.user;

      if (user) {
        // Send email verification
        await sendEmailVerification(user);
        setPendingVerification(true);
        Alert.alert("Success", "Verification email sent! Please check your email.");
      }
    } catch (error) {
      console.error("Error during sign-up:", error);
      Alert.alert("Error", error.message);
    }
  };

  React.useEffect(() => {
    // Listen for changes in auth state (e.g., when email is verified)
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user && user.emailVerified) {
        // If the email is verified, navigate to the home page
        navigation.replace('/');
      }
    });

    return () => unsubscribe(); // Clean up the listener on unmount
  }, []);

  return (
    <View style={styles.container}>
      {!pendingVerification ? (
        <>
          <TextInput
            autoCapitalize="none"
            value={emailAddress}
            placeholder="Email..."
            placeholderTextColor="#888"
            onChangeText={setEmailAddress}
            style={styles.input}
          />
          <TextInput
            value={password}
            placeholder="Password..."
            placeholderTextColor="#888"
            secureTextEntry={true}
            onChangeText={setPassword}
            style={styles.input}
          />
          <Button title="Sign Up" onPress={onSignUpPress} />
        </>
      ) : (
        <>
          <Text style={styles.message}>Please check your email to verify your account.</Text>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    padding: 20,
    backgroundColor: 'white',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    padding: 12,
    marginBottom: 10,
  },
  message: {
    fontSize: 16,
    textAlign: 'center',
    color: 'green',
  },
});
