import React from "react";
import { View, TextInput, Button, StyleSheet } from "react-native";
import { Formik } from "formik";
import { useNavigation } from "@react-navigation/native";

const RenterProfile = () => {
  const navigation = useNavigation();

  return (
    <Formik
      initialValues={{
        name: "",
        certifications: "",
        contact: "",
        address: "",
        price: "",
        image: "",
      }}
      onSubmit={(values) => {
        // Handle profile update logic here
        // For example, navigate to a different screen after updating the profile
        navigation.navigate("SomeOtherScreen");  // Replace with your target screen
      }}
    >
      {({ handleChange, handleBlur, handleSubmit, values }) => (
        <View style={styles.container}>
          <TextInput
            style={styles.input}
            placeholder="Name"
            placeholderTextColor="#888"
            onChangeText={handleChange("name")}
            onBlur={handleBlur("name")}
            value={values.name}
          />
          <TextInput
            style={styles.input}
            placeholder="Certifications"
            placeholderTextColor="#888"
            onChangeText={handleChange("certifications")}
            onBlur={handleBlur("certifications")}
            value={values.certifications}
          />
          <TextInput
            style={styles.input}
            placeholder="Contact"
            placeholderTextColor="#888"
            onChangeText={handleChange("contact")}
            onBlur={handleBlur("contact")}
            value={values.contact}
          />
          <TextInput
            style={styles.input}
            placeholder="Address"
            placeholderTextColor="#888"
            onChangeText={handleChange("address")}
            onBlur={handleBlur("address")}
            value={values.address}
          />
          <Button onPress={handleSubmit} title="Update Profile" />
        </View>
      )}
    </Formik>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 20,
  },
  input: {
    height: 40,
    margin: 12,
    borderWidth: 1,
    padding: 10,
  },
});

export default RenterProfile;
