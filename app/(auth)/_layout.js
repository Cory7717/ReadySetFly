import React, { useEffect, useState } from 'react';
import { StatusBar } from 'react-native';
import { Stack, Redirect } from 'expo-router';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import { app } from '../../firebaseConfig'; // Adjust the path to your firebaseConfig

const AuthLayout = () => {
  const [user, setUser] = useState(null);
  const [initializing, setInitializing] = useState(true);

  const auth = getAuth(app); // Initialize Auth

  // Handle user state changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      if (initializing) setInitializing(false);
    });

    // Cleanup subscription on unmount
    return unsubscribe;
  }, [auth, initializing]);

  // Show a loading state while waiting for Firebase auth to initialize
  if (initializing) return null;

  // If the user is signed in, redirect to home screen
  if (user) {
    return <Redirect href="/home" />;
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
