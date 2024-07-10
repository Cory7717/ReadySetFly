import { StatusBar } from "expo-status-bar";
import { Text, View, Image, ScrollView } from "react-native";
import { router, Link, Redirect } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { NativeWindStyleSheet } from "nativewind";
import "react-native-url-polyfill/auto";
import { sendEmail } from "react-native-email";
import { useFonts } from "expo-font";
import { images } from '../constants';
import CustomButton from "../components/CustomButton";
import { useGlobalContext } from "../context/GlobalProvider";

{
  /* const sendCodeEmail = () => {
  const to = ['coryarmer@gmail.com'];
  sendEmail(to, {
    subject: 'Your Code',
    body: 'Here is your code: 123456',
  }).catch(console.error);
}; */
}

NativeWindStyleSheet.setOutput({
  default: "native",
});
{
  /* Index screen will be the initial login/sign up with Google or create account*/
}
const App = () => {
  const { isLoading, isLoggedIn } = useGlobalContext;
  if (!isLoading && isLoggedIn) return <Redirect href="/home" />;
  return (
    <SafeAreaView className="bg-white">
      {/* <images source={image.logo} */}
      <ScrollView contentContainerStyle={{ height: "100%" }}>
        <View className="w-full justify-center items-center min-h-[85px] px-4">
          
        </View>
        {/* Add another image below logo for better asthetics */}

        {/* The className is adjusting the w & h but not rendering the image */}

        <View className="relative mt-5">
        <Image
            source={images.logo}
            resizeMode="contain"
            className="w-[200px] h-[200px]"
          />

          <Text className="font-rubikextrabold text-5xl text-center color-emerald-700">
            Ready, Set, Fly!
          </Text>
        </View>
        <View className="relative py-10">
          <Text className="font-rubikblack text-2xl text-center color-teal-400 py-5">
            What's your heading today?
          </Text>
        </View>
        <CustomButton
          title="Sign in/up for an account "
          handlePress={() => router.push("/sign-in")}
          containerStyles="mx-10 mt-10 bg-black"
        />
        <CustomButton
          title="Click here to view content "
          handlePress={() => router.push("/home")}
          containerStyles="mx-10 mt-10 bg-black"
        />
      </ScrollView>
      <StatusBar backgroundColor="white" />
    </SafeAreaView>
  );
};

export default App;
