import { View, Text, Image, SafeAreaView} from "react-native";
import { Link } from "expo-router";
import React from "react";
import RenterSignin from "../../components/RenterSignin";
import { images } from "../../constants";

const renter_sign_in = () => {
  return (
    <SafeAreaView className="flex-1 bg-white">
      <View className="flex-1 pt-10 h-10">
        <View className="items-center bg-white">
          <Image
            source={images.logo}
            resizeMode="contain"
            className="w-[300px] h-[300px]"
          />
         
        <RenterSignin></RenterSignin>
        </View>
        {/* <View className="justify-center pt-5 flex-row gap-2">
            <Text className="text-lg font-rubikregular text-#404040">
              Don't have an account?
            </Text>
            <Link
              href="/sign-up"
              className="text-lg font-rubikbold text-emerald-700">
              Sign Up
            </Link>
          </View> */}
      </View>
    </SafeAreaView>
  );
};

export default renter_sign_in;
