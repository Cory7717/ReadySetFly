import * as React from 'react';
import { TextInput, Button, View, TouchableOpacity, Text, Picker } from 'react-native';
import { useSignUp } from '@clerk/clerk-expo';
import { useRouter } from 'expo-router';

export default function RenterSignUp() {
  const { isLoaded, signUp, setActive } = useSignUp();
  const router = useRouter();

  const [emailAddress, setEmailAddress] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [pendingVerification, setPendingVerification] = React.useState(false);
  const [code, setCode] = React.useState('');
  const [userType, setUserType] = React.useState('renter');

  const onSignUpPress = async () => {
    if (!isLoaded) {
      return;
    }

    try {
      await signUp.create({
        emailAddress,
        password,
        publicMetadata: { userType }, // Storing user type in metadata
      });

      await signUp.prepareEmailAddressVerification({ strategy: 'email_code' });

      setPendingVerification(true);
    } catch (err) {
      console.error(JSON.stringify(err, null, 2));
    }
  };

  const onPressVerify = async () => {
    if (!isLoaded) {
      return;
    }

    try {
      const completeSignUp = await signUp.attemptEmailAddressVerification({
        code,
      });

      if (completeSignUp.status === 'complete') {
        await setActive({ session: completeSignUp.createdSessionId });
        router.replace('/');
      } else {
        console.error(JSON.stringify(completeSignUp, null, 2));
      }
    } catch (err) {
      console.error(JSON.stringify(err, null, 2));
    }
  };

  return (
    <View style={{ padding: 20 }}>
      {!pendingVerification && (
        <>
          <TextInput
            autoCapitalize="none"
            value={emailAddress}
            placeholder="Email..."
            onChangeText={(email) => setEmailAddress(email)}
            style={{ borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 10, marginBottom: 10 }}
          />
          <TextInput
            value={password}
            placeholder="Password..."
            secureTextEntry={true}
            onChangeText={(password) => setPassword(password)}
            style={{ borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 10, marginBottom: 10 }}
          />

          <Picker
            selectedValue={userType}
            onValueChange={(itemValue) => setUserType(itemValue)}
            style={{ borderWidth: 1, borderColor: '#ccc', borderRadius: 8, marginBottom: 20 }}
          >
            <Picker.Item label="Renter" value="renter" />
            <Picker.Item label="Owner" value="owner" />
          </Picker>

          <TouchableOpacity 
            onPress={onSignUpPress} 
            style={{ backgroundColor: '#007bff', padding: 15, borderRadius: 8, alignItems: 'center', marginBottom: 20 }}
          >
            <Text style={{ color: '#fff', fontSize: 16 }}>Sign Up</Text>
          </TouchableOpacity>
        </>
      )}
      {pendingVerification && (
        <>
          <TextInput 
            value={code} 
            placeholder="Verification Code..." 
            onChangeText={(code) => setCode(code)} 
            style={{ borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 10, marginBottom: 20 }}
          />
          <TouchableOpacity 
            onPress={onPressVerify} 
            style={{ backgroundColor: '#28a745', padding: 15, borderRadius: 8, alignItems: 'center' }}
          >
            <Text style={{ color: '#fff', fontSize: 16 }}>Verify Email</Text>
          </TouchableOpacity>
        </>
      )}
    </View>
  );
}
