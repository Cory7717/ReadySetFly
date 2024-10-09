import React, { useEffect, useState } from 'react';
import { View, Text, Image, ScrollView, StatusBar } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, Redirect } from 'expo-router';
import auth from '@react-native-firebase/auth';

const AuthLayout = () => {
  const [user, setUser] = useState(null);
  const [initializing, setInitializing] = useState(true);

  // Handle user state changes
  useEffect(() => {
    const subscriber = auth().onAuthStateChanged((firebaseUser) => {
      setUser(firebaseUser);
      if (initializing) setInitializing(false);
    });

    // Cleanup subscription on unmount
    return subscriber;
  }, [initializing]);

  // Show a loading state while waiting for Firebase auth to initialize
  if (initializing) return null;

  // If the user is signed in, redirect to home screen
  if (user) {
    return <Redirect href="app(tabs)/home.js" />;
  }

  // If the user is not signed in, show the auth screens
  return (
    <>
      <Stack>
        <Stack.Screen
          name="sign-in"
          options={{
            headerShown: false,
          }}
        />
        <Stack.Screen
          name="sign-up"
          options={{
            headerShown: false,
          }}
        />
      </Stack>
      {/* Setting the StatusBar for both iOS and Android */}
      <StatusBar barStyle="dark-content" backgroundColor="white" />
    </>
  );
};

export default AuthLayout;
