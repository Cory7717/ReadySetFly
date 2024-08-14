import React from "react";
import {
  View,
  Text,
  ScrollView,
  Dimensions,
  Alert,
  Image,
  Button,
  TextInput,
  TouchableOpacity,
} from "react-native";
import { useState } from "react";
import { Link, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { images } from "../../constants";
import FormField from "../../components/FormField";
import CustomButton from "../../components/CustomButton";
import { StatusBar } from "expo-status-bar";
import { IonIcons } from "@expo/vector-icons";
import { FontAwesome5 } from "@expo/vector-icons";
import { Fontisto } from "@expo/vector-icons";
import { useSignIn, signIn, submit } from "@clerk/clerk-expo";

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
        // See https://clerk.com/docs/custom-flows/error-handling
        // for more info on error handling
        console.error(JSON.stringify(signInAttempt, null, 2));
      }
    } catch (err) {
      console.error(JSON.stringify(err, null, 2));
    }
  }, [isLoaded, emailAddress, password]);

  return (
    <SafeAreaView className="bg-white flex-1">
      <View className="w-full justify-center items-center ">
        <Image
          source={images.logo}
          resizeMode="contain"
          className="w-[300px] h-[300px]"
        />
      </View>
      <View className=" mt-5 justify-center items-center">
        <Text className="text-2xl font-rubikblack justify-center items-center">
          Login into Ready, Set, Fly!
        </Text>
        <View className="gap-2 p-5">
          <View className="border px-2">
            <TextInput
              autoCapitalize="none"
              value={emailAddress}
              placeholder="Email..."
              onChangeText={(emailAddress) => setEmailAddress(emailAddress)}
            />
          </View>
          <View className="border px-2">
            <TextInput
              value={password}
              placeholder="Password..."
              secureTextEntry={true}
              onChangeText={(password) => setPassword(password)}
            />
          </View>
          <View className="pt-5">
            <Button title="Sign In" onPress={onSignInPress} />
          </View>
          <View className="justify-center pt-5 flex-row gap-2">
            <Text className="text-lg font-rubikregular text-#404040">
              Don't have an account?
            </Text>
            <Link
              href="/sign-up"
              className="text-lg font-rubikbold text-emerald-700"
            >
              <Text>Sign up</Text>
            </Link>
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
};

export default SignIn;
