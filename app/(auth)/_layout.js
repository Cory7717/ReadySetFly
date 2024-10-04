import React from 'react';
import { View, Text, Image, ScrollView, StatusBar } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, Redirect } from 'expo-router';
import { ClerkProvider } from '@clerk/clerk-expo';
import { useAuth } from '@clerk/clerk-expo';

const AuthLayout = () => {
  const { isSignedIn, isSignedUp } = useAuth();

  if (isSignedIn, isSignedUp) {
    return <Redirect href="app(tabs)/home.js" />;
  }

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
