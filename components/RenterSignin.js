import { useSignIn } from "@clerk/clerk-expo";
import { Link, useRouter } from "expo-router";
import {
  Text,
  TextInput,
  Button,
  View,
  Image,
  SafeAreaView,
  ScrollView,
} from "react-native";
import React from "react";
import { images } from "../constants";
import FormField from "./FormField";
import CustomButton from "./CustomButton";

export default function Page() {
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
    <SafeAreaView>
    {/* <View>
      <TextInput
        autoCapitalize="none"
        value={emailAddress}
        placeholder="Email..."
        placeholderTextColor="#888"
        onChangeText={(emailAddress)=> setEmailAddress(emailAddress)}
      />
      <TextInput
        value={password}
        placeholder="Password..."
        placeholderTextColor="#888"
        secureTextEntry={true}
        onChangeText={(password)=> setPassword(password)}
      />
      </View> */}
      <Button title="Sign In" onPress={onSignInPress} />

{/*       
      <View className="justify-center flex-row">
            <Text className="text-lg font-rubikregular text-#404040">
              Don't have a Renter account?
            </Text>
            <Link
              href="/screens/renter_sign_up"
              className="text-lg font-rubikbold text-emerald-700">
              Sign Up
            </Link>
          </View> */}
    </SafeAreaView>
  );
}
