import * as React from 'react';
import { TextInput, View, TouchableOpacity, Text, StyleSheet, Picker, Alert } from 'react-native';
import { getAuth, createUserWithEmailAndPassword, sendEmailVerification, onAuthStateChanged } from 'firebase/auth';
import { useNavigation } from '@react-navigation/native';

export default function RenterSignUp() {
  const auth = getAuth();
  const navigation = useNavigation();

  const [emailAddress, setEmailAddress] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [pendingVerification, setPendingVerification] = React.useState(false);
  const [code, setCode] = React.useState(''); // Not needed for Firebase email verification
  const [userType, setUserType] = React.useState('renter');

  const onSignUpPress = async () => {
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, emailAddress, password);

      if (userCredential.user) {
        // Store userType in the user's profile metadata (if needed).
        // Sending email verification
        await sendEmailVerification(userCredential.user);
        setPendingVerification(true);

        Alert.alert('Verification Email Sent', 'Please check your email to verify your account.');
      }
    } catch (err) {
      console.error(err.message);
      Alert.alert('Error', err.message);
    }
  };

  React.useEffect(() => {
    // Firebase listener for authentication state changes
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user && user.emailVerified) {
        // Once the email is verified, navigate to the home page
        navigation.replace('/');
      }
    });

    return () => unsubscribe();
  }, []);

  return (
    <View style={styles.container}>
      {!pendingVerification && (
        <>
          <TextInput
            autoCapitalize="none"
            value={emailAddress}
            placeholder="Email..."
            onChangeText={(email) => setEmailAddress(email)}
            style={styles.input}
          />
          <TextInput
            value={password}
            placeholder="Password..."
            secureTextEntry={true}
            onChangeText={(password) => setPassword(password)}
            style={styles.input}
          />

          <Picker
            selectedValue={userType}
            onValueChange={(itemValue) => setUserType(itemValue)}
            style={styles.picker}
          >
            <Picker.Item label="Renter" value="renter" />
            <Picker.Item label="Owner" value="owner" />
          </Picker>

          <TouchableOpacity 
            onPress={onSignUpPress} 
            style={styles.signUpButton}
          >
            <Text style={styles.buttonText}>Sign Up</Text>
          </TouchableOpacity>
        </>
      )}
      {pendingVerification && (
        <>
          <Text>Please check your email and verify your account to proceed.</Text>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
    flex: 1,
    justifyContent: 'center',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    padding: 10,
    marginBottom: 10,
  },
  picker: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    marginBottom: 20,
  },
  signUpButton: {
    backgroundColor: '#007bff',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 20,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
  },
});
