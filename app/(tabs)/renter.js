import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  Image,
  TextInput,
  Button,
} from "react-native";
import React from "react";
import { useEffect, useState } from "react";
import { Stack, Tabs } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { createMaterialTopTabNavigator } from "@react-navigation/material-top-tabs";
import { Formik } from "formik";
import { Picker, PickerItem } from "@react-native-picker/picker";
import * as ImagePicker from "expo-image-picker";
import UpcomingBookings from "../../components/UpcomingBookings";
import RenterProfile from "../../components/RenterProfile";
import { tw } from "nativewind";

const Tab = createMaterialTopTabNavigator();

const handleChoosePhoto = async () => {
  let result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    allowsEditing: true,
    aspect: [4, 3],
    quality: 1,
  });

  if (!result.canceled) {
    setPhoto(result.uri);
  }
};

const pickImage = async () => {
  // No permissions request is necessary for launching the image library
  let result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.All,
    allowsEditing: true,
    aspect: [4, 3],
    quality: 1,
  });

  console.log(result);

  if (!result.canceled) {
    setImage(result.assets[0].uri);
  }
};

const Create = () => {
  const onSubmitValue = (value) => {
    value.image=image;
    console.log(value)
  }
  const [image, setImage] = useState(null);

  // const handleSetImage = () => {
  //   setImage("path_to_new_image");
  // };
  return (
    <SafeAreaView className="h-full bg-white sand">
      <ScrollView>
        <View className="pb-2 border-b-2">
          <Tab.Navigator
            screenOptions={{
              tabBarIndicatorStyle: "",
              tabBarScrollEnabled: true,
              textBarShowLabel: true,
              tabBarStyle: {
                backgroundColor: "#fff",
                alignItems: "center",
              },
            }}
          >
            <Tab.Screen
              name="Upcoming Bookings"
              component={UpcomingBookings}
              options={{}}
            />
            <Tab.Screen name="Profile" component={RenterProfile} />
          </Tab.Navigator>
        </View>
        <TouchableOpacity onPress={pickImage}>
          <View className="items-center">
            <Image
              className="align-center, content-center"
              source={require("../../Assets/images/Placeholder_view_vector.png")}
              style={{
                width: 150,
                height: 150,
                borderRadius: 15,
                paddingBottom: 10,
                marginBottom: 15,
                marginTop: 15,
              }}
            />
          </View>
        </TouchableOpacity>
        <View className="flex-1 items-center justify-center bg-white">
          <Text className="font-rubikblack text-4xl text-center text-#404040 px-8">
            Renter Dashboard
          </Text>
        </View>
        <View className="pt-5">
          <Text className="font-rubikbold text-xl text-center text-decoration-line mb-2">
            Create your profile!
          </Text>
          <Formik
            initialValues={{
              name: "",
              certifications: "",
              contact: "",
              address: "",
              price: "",
              image: "",
            }}
            onSubmit={value=> onSubmitValue(value)}
          >
            {({
              handleChange,
              handleBlur,
              handleSubmit,
              values,
              handleAddListing,
            }) => (
              <View>
                <TextInput
                  style={styles.input}
                  placeholder="Name"
                  value={values?.name}
                  onChangeText={handleChange("name")}
                />
                <TextInput
                  style={styles.input}
                  placeholder="Certifications"
                  value={values?.certifications}
                  // This will need to be changed to wrap text inside of description box
                  // className='text-wrap'
                  numberOfLines={5}
                  onChangeText={handleChange("desc")}
                />
                <TextInput
                  style={styles.input}
                  placeholder="Contact"
                  value={values?.contact}
                  onChangeText={handleChange("contact")}
                />
                <TextInput
                  style={styles.input}
                  placeholder="Location"
                  value={values?.address}
                  onChangeText={handleChange("location")}
                />
                <Picker
                  selectedValue={values?.category}
                  onValueChange={handleChange("Category")}
                  className="border-spacing-2"
                >
                  <Picker.Item label="Single Engine Prop" value={"Dropdown"} />
                  {/* {categoryList&&categoryList.map(()=>(
                    
                   ))} */}
                  <Picker.Item key={""} label="Turbo Prop" value={"Dropdown"} />
                  <Picker.Item label="Twin Engine Prop" value={"Dropdown"} />
                  <Picker.Item label="Turbo Prop" value={"Dropdown"} />
                  <Picker.Item label="Helicopter" value={"Dropdown"} />
                  <Picker.Item label="Jet" value={"Dropdown"} />
                </Picker>
                <Button
                  onPress={handleAddListing}
                  className="mt-7"
                  title="submit"
                />
              </View>
            )}
          </Formik>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  input: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 10,
    paddingHorizontal: 17,
    fontSize: 17,
    marginBottom: 5,
    marginTop: 10,
    textAlignVertical: "top",
    justifyContent: "space-evenly",
    flexDirection: "row",
    flex: 1,
    flexWrap: "wrap",
  },
});

export default Create;
