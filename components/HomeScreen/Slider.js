import { View, Text, FlatList, Image, StyleSheet } from 'react-native';
import React from 'react';

export default function Slider({ sliderList }) {
  return (
    <View style={styles.container}>
      <FlatList
        data={sliderList}
        horizontal
        showsHorizontalScrollIndicator={false}
        renderItem={({ item }) => (
          <View style={styles.imageContainer}>
            <Image 
              source={{ uri: item?.image }} 
              style={styles.image} 
            />
          </View>
        )}
        keyExtractor={(item, index) => index.toString()}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: 20,
  },
  imageContainer: {
    marginRight: 12,
  },
  image: {
    height: 160,
    width: 330,
    borderRadius: 8,
    resizeMode: 'cover',
  },
});
