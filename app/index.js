import React from 'react';
import { StatusBar } from "expo-status-bar";
import {
  Text,
  View,
  Image,
  ScrollView,
  TouchableOpacity,
} from "react-native";
import { Redirect, router } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { SignedIn, SignedOut, useUser } from '@clerk/clerk-expo';
import { useGlobalContext } from "../context/GlobalProvider";
import CustomButton from "../components/CustomButton";
import { images } from "../constants";

const App = () => {
  const { user } = useUser();
  const { isLoading, isLoggedIn } = useGlobalContext();

  if (!isLoading && isLoggedIn) return <Redirect href="/home" />;

  return (
    <SafeAreaView className="flex-1 bg-white">
      <StatusBar style="dark" />
      <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: "center", paddingHorizontal: 20 }}>
        <View className="items-center mb-10">
          <Image source={images.logo} className="w-[200px] h-[200px]" />
        </View>

        <SignedIn>
          <Text className="text-lg text-center mb-5">Hello, {user?.emailAddresses[0].emailAddress}</Text>
        </SignedIn>
        
        <SignedOut>
          <View className="mb-8">
            <TouchableOpacity 
              onPress={() => router.push('/sign-in')} 
              className="bg-blue-500 py-4 rounded-lg mb-4 shadow-lg"
            >
              <Text className="text-center text-white text-lg">Sign In or Create Account</Text>
            </TouchableOpacity>
            {/* <TouchableOpacity 
              onPress={() => router.push('/sign-up')} 
              className="bg-green-500 py-4 rounded-lg shadow-lg"
            >
              <Text className="text-center text-white text-lg">Sign Up</Text>
            </TouchableOpacity> */}
          </View>
        </SignedOut>

        {/* <CustomButton
          title="Renter - Sign In/Up"
          handlePress={() => router.push("/renter_sign_in")}
          containerStyles="bg-black py-4 rounded-lg mb-4"
        />
        <CustomButton
          title="Owner - Sign In/Up"
          handlePress={() => router.push("/owner_sign_in")}
          containerStyles="bg-black py-4 rounded-lg mb-4"
        /> */}
        <CustomButton
          title="View Content"
          handlePress={() => router.push("/home")}
          containerStyles="bg-black py-4 rounded-lg"
        />

        <TouchableOpacity onPress={() => router.push("/cfi")} className="mt-8">
          <View className="bg-blue-400 py-4 rounded-full items-center">
            <Text className="text-white text-lg font-semibold">Create CFI Profile</Text>
          </View>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
};

export default App;
