import React from "react";
import {
  View,
  Text,
  Image,
  TextInput,
  TouchableOpacity,
  SafeAreaView,
  
} from "react-native";
import { useSignUp } from "@clerk/clerk-expo";
import { useRouter } from "expo-router";
import { images } from "../../constants";
import { StatusBar } from "expo-status-bar";
import { Picker } from "@react-native-picker/picker";

const SignUp = () => {
  const { signUp, setActive, isLoaded } = useSignUp();
  const router = useRouter();

  const [emailAddress, setEmailAddress] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [userType, setUserType] = React.useState("renter");
  const [pendingVerification, setPendingVerification] = React.useState(false);
  const [code, setCode] = React.useState("");

  const onSignUpPress = React.useCallback(async () => {
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
  }, [isLoaded, emailAddress, password, userType]);

  const onPressVerify = React.useCallback(async () => {
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
  }, [isLoaded, code]);

  return (
    <SafeAreaView className="flex-1 bg-white p-4">
      <StatusBar barStyle="dark-content" />
      <View className="flex-1 justify-center items-center">
        <Image
          source={images.logo}
          resizeMode="contain"
          className="w-60 h-80 mb-6"
        />
        <Text className="text-2xl font-bold mb-4">
          Sign up for Ready, Set, Fly!
        </Text>
        <View className="w-3/4 max-w-md space-y-4">
          {!pendingVerification ? (
            <>
            <View className='gap-4'>
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
              </View>
              <Picker
                selectedValue={userType}
                onValueChange={(itemValue) => setUserType(itemValue)}
                className="border border-gray-300 rounded-lg p-3"
              >
                <Picker.Item label="Renter" value="renter" />
                <Picker.Item label="Owner" value="owner" />
              </Picker>
              <TouchableOpacity
                onPress={onSignUpPress}
                className="bg-blue-500 rounded-lg p-3"
              >
                <Text className="text-white text-center text-lg font-semibold">
                  Sign Up
                </Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <TextInput
                value={code}
                placeholder="Verification Code"
                onChangeText={setCode}
                className="border border-gray-300 rounded-lg p-3"
              />
              <TouchableOpacity
                onPress={onPressVerify}
                className="bg-green-500 rounded-lg p-3"
              >
                <Text className="text-white text-center text-lg font-semibold">
                  Verify Email
                </Text>
              </TouchableOpacity>
            </>
          )}
          <View className="flex-row justify-center items-center">
            <Text className="text-lg text-gray-600">
              Already have an account?
            </Text>
            <TouchableOpacity onPress={() => router.push("/sign-in")}>
              <Text className="text-lg text-blue-600 ml-2 font-semibold">
                Sign in
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
};

export default SignUp;
