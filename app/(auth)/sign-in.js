import React from "react";
import {
  View,
  Text,
  Image,
  TextInput,
  TouchableOpacity,
  SafeAreaView
} from "react-native";
import { useSignIn } from "@clerk/clerk-expo";
import { useRouter } from "expo-router";
import { images } from "../../constants";
import { StatusBar } from "expo-status-bar";

const SignIn = () => {
  const { signIn, setActive, isLoaded } = useSignIn();
  const router = useRouter();

  const [emailAddress, setEmailAddress] = React.useState("");
  const [password, setPassword] = React.useState("");

  const onSignInPress = React.useCallback(async () => {
    if (!isLoaded) {
      return;
    }

    try {
      const signInAttempt = await signIn.create({
        identifier: emailAddress,
        password,
      });

      if (signInAttempt.status === "complete") {
        await setActive({ session: signInAttempt.createdSessionId });
        router.replace("/");
      } else {
        console.error(JSON.stringify(signInAttempt, null, 2));
      }
    } catch (err) {
      console.error(JSON.stringify(err, null, 2));
    }
  }, [isLoaded, emailAddress, password]);

  return (
    <SafeAreaView className="flex-1 bg-white p-4">
      <StatusBar barStyle="dark-content" />
      <View className="flex-1 justify-center items-center">
        <Image
          source={images.logo}
          resizeMode="contain"
          className="w-80 h-80 mb-6"
        />
        <Text className="text-2xl font-bold mb-4">
          Login to Ready, Set, Fly!
        </Text>
        <View className="w-3/4 max-w-md space-y-4">
          <TextInput
            autoCapitalize="none"
            value={emailAddress}
            placeholder="Email"
            onChangeText={setEmailAddress}
            className="border border-gray-300 rounded-lg p-3"
          />
          <TextInput
            value={password}
            placeholder="Password"
            secureTextEntry
            onChangeText={setPassword}
            className="border border-gray-300 rounded-lg p-3"
          />
          <TouchableOpacity
            onPress={onSignInPress}
            className="bg-blue-500 rounded-lg p-3"
          >
            <Text className="text-white text-center text-lg font-semibold">
              Sign In
            </Text>
          </TouchableOpacity>
          <View className="flex-row justify-center items-center">
            <Text className="text-lg text-gray-600">
              Don't have an account?
            </Text>
            <TouchableOpacity onPress={() => router.push("/sign-up")}>
              <Text className="text-lg text-blue-600 ml-2 font-semibold">
                Sign up
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
};

export default SignIn;
