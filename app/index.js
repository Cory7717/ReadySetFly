import { StatusBar } from "expo-status-bar";
import { Text, View, Image, ScrollView, ImageBackground } from "react-native";
import { router, Link, Redirect } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { NativeWindStyleSheet } from "nativewind";
import "react-native-url-polyfill/auto";
import { sendEmail } from "react-native-email";
import { useFonts } from "expo-font";
import { images } from "../constants";
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
      {/* <ImageBackground source={images.background} className="bg-opacity-75"/> */}
      <ScrollView contentContainerStyle={{ height: "100%" }}>
        <View className="w-full min-h-[85px] px-12 py-10">
          <Image source={images.logo} className="w-[300px] h-[300px]" />
        </View>

        <View className="relative py-5">
          <Text className="font-rubikregular text-2xl text-center color-teal-400 py-5">
            Where's your next destination?
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
        <CustomButton
          title="Learn to Fly "
          handlePress={() => router.push("/cfi")}
          containerStyles="mx-10 mt-10 bg-black"
        />
      </ScrollView>
      <StatusBar backgroundColor="white" />
    </SafeAreaView>
  );
};

export default App;
