import React from 'react';
import { ActivityIndicator, Text, TouchableOpacity, StyleSheet } from 'react-native';

const CustomButton = ({ title, handlePress, containerStyles, textStyles, isLoading }) => {
  return (
    <TouchableOpacity
      onPress={handlePress}
      activeOpacity={0.5}
      style={[styles.buttonContainer, containerStyles, isLoading && styles.disabled]}
      disabled={isLoading}
    >
      <Text style={[styles.buttonText, textStyles]}>{title}</Text>
      {isLoading && <ActivityIndicator animating={isLoading} color="#fff" size="small" style={styles.indicator} />}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  buttonContainer: {
    borderRadius: 20, // rounded-2xl
    minHeight: 36,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonText: {
    color: '#007bff', // Change this to the color you want for your text
    fontFamily: 'Rubik-Regular', // Make sure this font is loaded in your app
    fontSize: 18, // text-lg
  },
  disabled: {
    opacity: 0.5,
  },
  indicator: {
    marginLeft: 8, // ml-2
  },
});

export default CustomButton;
