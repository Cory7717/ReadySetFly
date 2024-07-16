import { View, Text, ScrollView, Dimensions, Alert, Image } from "react-native";
import { useState } from "react";
import { Link, router } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { images } from "../../constants";
import FormField from "../../components/FormField";
import CustomButton from "../../components/CustomButton";
import { StatusBar } from "expo-status-bar";
import { useGlobalContext } from "../../context/GlobalProvider";
import { signIn } from "../../lib/appwrite";
import { getCurrentUser } from "../../lib/appwrite";
import { IonIcons } from "@expo/vector-icons";
import { FontAwesome5 } from "@expo/vector-icons";

const SignIn = () => {
  const { setUser, setIsLogged } = useGlobalContext();
  const [isSubmitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    email: "",
    password: "",
  });

  const submit = async () => {
    if (form.email === "" || form.password === "") {
      Alert.alert("Error", "Please fill in all required forms");
    }

    setSubmitting(true);

    try {
      await signIn(form.email, form.password);
      const result = await getCurrentUser();
      setUser(result);
      setIsLogged(true);

      Alert.alert("Success", "User signed in successfully");
      router.replace("/home");
    } catch (error) {
      Alert.alert("Error", error.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView className="bg-white h-full">
      <ScrollView>
        <View className="w-full justify-center items-center px-4 ">
          <Image
            source={images.logo}
            resizeMode="contain"
            className="w-[200px] h-[200px]"
          />
        </View>
        <View className=" mt-24 justify-center items-center">
          <Text className="text-2xl font-rubikblack justify-center items-center">
            Login into Ready, Set, Fly!
          </Text>
          <FormField
            title="Email"
            value={form.email}
            handleChangeText={(e) => setForm({ ...form, email: e })}
            otherStyles="mt-7 mx-5 bg-white"
            keyboardType="email-address"
          />
          <FormField
            title="Password"
            value={form.password}
            handleChangeText={(e) => setForm({ ...form, password: e })}
            otherStyles="mt-7 mx-5 bg-white"
          />
          <CustomButton
            title="Sign-In"
            handlePress={submit}
            containerStyles="mt-5 bg-black"
          />
          <View className="justify-center pt-5 flex-row gap-2">
            <Text className="text-lg font-rubikregular text-#404040">
              Don't have an account?
            </Text>
            <Link
              href="/sign-up"
              className="text-lg font-rubikbold text-emerald-700">
              Sign Up
            </Link>
          </View>
        </View>
      </ScrollView>
      <StatusBar backgroundColor="teal" />
    </SafeAreaView>
  );
};

export default SignIn;
