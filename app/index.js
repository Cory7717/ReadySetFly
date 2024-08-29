import React from 'react';
import { StatusBar } from "expo-status-bar";
import {
  Text,
  View,
  Image,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
} from "react-native";
import { Redirect } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { SignedIn, SignedOut, useUser } from '@clerk/clerk-expo';
import { useGlobalContext } from "../context/GlobalProvider";
import CustomButton from "../components/CustomButton";
import { images } from "../constants";
import { router } from 'expo-router';

const App = () => {
  const { user } = useUser();
  const { isLoading, isLoggedIn } = useGlobalContext();

  if (!isLoading && isLoggedIn) return <Redirect href="/home" />;

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        <View style={styles.logoContainer}>
          <Image source={images.logo} style={styles.logo} />
        </View>

        <SignedIn>
          <Text style={styles.greetingText}>Hello, {user?.firstName} {user?.lastName}</Text>
        </SignedIn>

        <SignedOut>
          <View style={styles.signInContainer}>
            <TouchableOpacity
              onPress={() => router.push('/sign-in')}
              style={styles.signInButton}
            >
              <Text style={styles.signInButtonText}>Sign In or Create Account</Text>
            </TouchableOpacity>
          </View>
        </SignedOut>

        <View style={styles.viewContentButtonContainer}>
          <CustomButton
            title="View Content"
            handlePress={() => router.push("/home")}
            containerStyles={styles.viewContentButton}
          />
        </View>

        <TouchableOpacity onPress={() => router.push("/cfi")} style={styles.createCFIButtonContainer}>
          <View style={styles.createCFIButton}>
            <Text style={styles.createCFIButtonText}>Create CFI Profile</Text>
          </View>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'white',
  },
  scrollContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 40,
  },
  logo: {
    width: 200,
    height: 200,
  },
  greetingText: {
    fontSize: 18,
    textAlign: 'center',
    marginBottom: 20,
  },
  signInContainer: {
    marginBottom: 20,
  },
  signInButton: {
    backgroundColor: '#007bff',
    paddingVertical: 15,
    borderRadius: 8,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 2,
  },
  signInButtonText: {
    color: 'white',
    fontSize: 18,
    textAlign: 'center',
  },
  viewContentButtonContainer: {
    marginBottom: 20,
  },
  viewContentButton: {
    backgroundColor: 'black',
    paddingVertical: 15,
    borderRadius: 8,
  },
  createCFIButtonContainer: {
    marginTop: 20,
  },
  createCFIButton: {
    backgroundColor: '#1E90FF',
    paddingVertical: 15,
    borderRadius: 25,
    alignItems: 'center',
  },
  createCFIButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: '600',
  },
});

export default App;
