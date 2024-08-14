import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Button,
  ScrollView,
  TouchableOpacity,
  Image,
  ToastAndroid,
  KeyboardAvoidingView,
  ActivityIndicator,
  Alert,
  Modal,
} from "react-native";
import React, { useEffect, useState } from "react";
import { getFirestore, collection, getDocs, addDoc } from "firebase/firestore";
import { app } from "../../firebaseConfig";
import { Formik } from "formik";
import { Picker, PickerItem } from "@react-native-picker/picker";
import { SafeAreaView } from "react-native-safe-area-context";
import * as ImagePicker from "expo-image-picker";
import { getDownloadURL, getStorage, ref, uploadBytes } from "firebase/storage";
import { useNavigation } from "@react-navigation/native";
import Slider from "../../components/HomeScreen/Slider.js";
import { Header, HeaderCFI } from "../../components";
import * as AuthSession from "expo-auth-session";
// import { ClerkProvider } from "@clerk/clerk-expo";
import { useUser } from "@clerk/clerk-expo";
import { Ionicons } from "@expo/vector-icons";

const Classifieds = () => {
  const [image, setImage] = useState(null);
  const db = getFirestore(app);
  const [loading, setLoading] = useState(false);
  const storage = getStorage();
  const [sliderList, setSliderList] = useState([]);
  const { user } = useUser();
  const navigation = useNavigation();
  const [categoryList, setCategoryList] = useState([]);

  useEffect(() => {
    getCategoryList();
    getSliders();
  }, []);

  const getCategoryList = async () => {
    setCategoryList([]);
    const querySnapshot = await getDocs(collection(db, "Category"));
    querySnapshot.forEach((doc) => {
      //   console.log("Docs:", doc.data());
      setCategoryList((categoryList) => [...categoryList, doc.data()]);
    });
  };

  const handleAddListing = () => {
    if (title && description) {
      const newListing = { title, description, price, photo };
      setListings([...listings, newListing]);
      setTitle("");
      setPrice("");
      setDescription("");
      setPhoto(null);
    }
  };

  const getSliders = async () => {
    setSliderList([]);
    const querySnapshot = await getDocs(collection(db, "Sliders"));
    querySnapshot.forEach((doc) => {
      // doc.data() is never undefined for query doc snapshots
      setSliderList((sliderList) => [...sliderList, doc.data()]);
    });
  };

  const pickImage = async () => {
    // No permissions request is necessary for launching the image library
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.All,
      allowsEditing: true,
      aspect: [4, 4],
      quality: 1,
      allowMultipleSelection: true,
    });

    console.log(result);

    if (!result.canceled) {
      setImage(result.assets[0].uri);
    }
  };

  const onSubmitMethod = async (value) => {
    setLoading(true);
    const resp = await fetch(image);
    const blob = await resp.blob();
    const storageRef = ref(storage, "airplane_listings/" + Date.now() + ".jpg");

    uploadBytes(storageRef, blob)
      .then((snapshot) => {
        console.log("You Uploaded an Image");
      })
      .then((resp) => {
        getDownloadURL(storageRef).then(async (downloadUrl) => {
          console.log(downloadUrl);
          value.image = downloadUrl;
          value.userName = user.fullName;
          value.userEmail = user.primaryEmailAddress.emailAddress;
          value.userImage = user.imageUrl;

          // Add userPost code below to upload doc info for post
          const docRef = await addDoc(collection(db, "UserPost"), value);
          if (docRef.id) {
            setLoading(false);
            Alert.alert("Your post was successfully added!");
          }
        });
      });
  };

  return (
    <SafeAreaView className='bg-white'>
   
      <ScrollView>
        <View className="pt-2 pl-5 pr-5 bg-white">
        <View className="flex-row gap-2">
          <Image
            source={{ uri: user?.imageUrl }}
            className="rounded-full w-12 h-12"
          />
          <View className='pb-5'>
            <Text className="text-[16px]">Welcome</Text>
            <Text className="text-[20px] font-bold">{user?.fullName}</Text>
          
          <View
            className="p-[9px] px-5 pb- flex-row 
          bg-white mt-2 rounded-full 
        border-[1px] border-blue-300"
          >
            <Ionicons name="search" size={24} color="gray" />
            <TextInput
              placeholder="Search"
              // className="ml-2 text-[18px]"
              onChangeText={(value) => console.log(value)}
            />
          </View>
          </View>
          <Slider />
        </View>
          <Text className="font-rubikbold text-2xl">Aircraft Marketplace</Text>
          <Text className="font-rubikregular text-[20px] text-gray-500 mb-5">
            List your aircraft
          </Text>
          <Formik
            initialValues={{
              title: "",
              desc: "",
              category: "",
              location: "",
              price: "",
              image: "",
              userName: "",
              userEmail: "",
              userImage: "",
            }}
            onSubmit={(value) => onSubmitMethod(value)}
            validate={(values) => {
              const errors = {};
              if (!values.title) {
                ToastAndroid.show(
                  "You must fill in the title",
                  ToastAndroid.CENTER
                );
                errors.name = "You must fill in the Title";
              }
              return errors;
            }}
          >
            {({
              handleChange,
              handleBlur,
              handleSubmit,
              values,
              setFieldValue,
              errors,
            }) => (
              <View>
                <View className="flex-row gap-2" horizontal={true}>
                  <Slider sliderList={sliderList}>
                    <TouchableOpacity
                      onPress={pickImage}
                      allowMultipleSelection
                    >
                      {image ? (
                        <Image
                          source={{ uri: image }}
                          style={{ width: 100, height: 100, borderRadius: 15 }}
                        />
                      ) : (
                        <Image
                          source={require("../../Assets/images/Placeholder_view_vector.png")}
                          style={{ width: 150, height: 150, borderRadius: 15 }}
                        />
                      )}
                      {/* <View className="pb-3"></View> */}
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={pickImage}
                      allowMultipleSelection
                    >
                      {image ? (
                        <Image
                          source={{ uri: image }}
                          style={{ width: 100, height: 100, borderRadius: 15 }}
                        />
                      ) : (
                        <Image
                          source={require("../../Assets/images/Placeholder_view_vector.png")}
                          style={{ width: 150, height: 150, borderRadius: 15 }}
                        />
                      )}
                      {/* <View className="pb-3"></View> */}
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={pickImage}
                      allowMultipleSelection
                    >
                      {image ? (
                        <Image
                          source={{ uri: image }}
                          style={{ width: 100, height: 100, borderRadius: 15 }}
                        />
                      ) : (
                        <Image
                          source={require("../../Assets/images/Placeholder_view_vector.png")}
                          style={{ width: 150, height: 150, borderRadius: 15 }}
                        />
                      )}
                      {/* <View className="pb-3"></View> */}
                    </TouchableOpacity>
                  </Slider>
                  <TouchableOpacity onPress={pickImage} allowMultipleSelection>
                    {image ? (
                      <Image
                        source={{ uri: image }}
                        style={{ width: 100, height: 100, borderRadius: 15 }}
                      />
                    ) : (
                      <Image
                        source={require("../../Assets/images/Placeholder_view_vector.png")}
                        style={{ width: 150, height: 150, borderRadius: 15 }}
                      />
                    )}
                    {/* <View className="pb-3"></View> */}
                  </TouchableOpacity>
                </View>
                <TextInput
                  style={styles.input}
                  placeholder="Title"
                  value={values?.title}
                  onChangeText={handleChange("title")}
                />
                <TextInput
                  style={styles.input}
                  placeholder="Description, Avionics, TTOF, etc.."
                  value={values?.desc}
                  onChangeText={handleChange("desc")}
                  numberOfLines={10}
                  textWrap={true}
                />
                <TextInput
                  style={styles.input}
                  placeholder="Price"
                  value={values?.price}
                  keyboardType="numbers-and-punctuation"
                  onChangeText={handleChange("price")}
                />
                <TextInput
                  style={styles.input}
                  placeholder="Location"
                  value={values?.location}
                  onChangeText={handleChange("location")}
                />
                <TextInput
                  style={styles.input}
                  placeholder="User Name"
                  value={values?.userName}
                  onChangeText={handleChange("userName")}
                />
                <TextInput
                  style={styles.input}
                  placeholder="Email"
                  value={values?.userEmail}
                  onChangeText={handleChange("userEmail")}
                />
                <View
                  style={{
                    borderWidth: 1,
                    borderRadius: 15,
                    marginTop: 10,
                  }}
                >
                  <Picker
                    selectedValue={values?.category}
                    className="border "
                    onValueChange={(itemValue) =>
                      setFieldValue("category", itemValue)
                    }
                  >
                    {categoryList &&
                      categoryList.map((item, index) => (
                        <Picker.Item
                          key={index}
                          label={item?.name}
                          value={item?.name}
                        />
                      ))}
                  </Picker>
                </View>
                <TouchableOpacity
                  onPress={handleSubmit}
                  className="p-2 bg-black rounded-full mt-5"
                >
                  {loading ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text className="color-white text-center text-[20px] font-rubikbold">
                      Submit
                    </Text>
                  )}
                </TouchableOpacity>
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
    marginTop: 10,
    marginBottom: 5,
    paddingHorizontal: 17,
    fontSize: 18,
    textAlignVertical: "top",
  },
});

export default Classifieds;
