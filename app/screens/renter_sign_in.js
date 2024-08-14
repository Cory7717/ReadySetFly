import {
  View,
  Text,
  Image,
  SafeAreaView,
  TextInput,
  Button,
} from "react-native";
import { Link, useRouter } from "expo-router";
import React from "react";
import { images } from "../../constants";
import { useSignIn } from "@clerk/clerk-expo";

const RenterSignIn = () => {
  const { signIn, setActive, isLoaded } = useSignIn();
  const router = useRouter();

  const [emailAddress, setEmailAddress] = React.useState("");
  const [password, setPassword] = React.useState("");

  const onSignInPress = React.useCallback(async () => {
    if (!isLoaded) {
      return;
    }

    try {
      const trimmedEmail = emailAddress.trim();
      const signInAttempt = await signIn.create({
        identifier: trimmedEmail,
        password,
      });
      // const signInAttempt = await signIn.create({
      //   identifier: emailAddress,
      //   password,
      // });

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
    <SafeAreaView style={{ flex: 1, backgroundColor: "white" }}>
      <View style={{ flex: 1, paddingTop: 10 }}>
        <View style={{ alignItems: "center", backgroundColor: "white" }}>
          <Image
            source={images.logo}
            resizeMode="contain"
            style={{ width: 300, height: 300 }}
          />
          
          <View style={{ borderWidth: 1, width: "100%", height: 40, marginBottom: 10 }}>
            <TextInput
              autoCapitalize="none"
              value={emailAddress}
              placeholder="Email..."
              onChangeText={(emailAddress) => setEmailAddress(emailAddress)}
              style={{ flex: 1, paddingHorizontal: 8 }}
            />
          </View>
          <View style={{ borderWidth: 1, width: "100%", height: 40, marginBottom: 10 }}>
            <TextInput
              value={password}
              placeholder="Password..."
              secureTextEntry={true}
              onChangeText={(password) => setPassword(password)}
              style={{ flex: 1, paddingHorizontal: 8 }}
            />
          </View>
          <Button title="Sign In" onPress={onSignInPress} style={{}} />
        </View>

        <View style={{ justifyContent: "center", paddingTop: 5, flexDirection: "row", gap: 2 }}>
          <Text style={{ fontSize: 16, color: "#404040", fontFamily: "Rubik-Regular" }}>
            Don't have an account?
          </Text>
          <Link
            href="/sign-up"
            style={{ fontSize: 16, color: "emerald-700", fontFamily: "Rubik-Bold" }}
          >
            Sign Up
          </Link>
        </View>
      </View>
    </SafeAreaView>
  );
};

export default RenterSignIn;
