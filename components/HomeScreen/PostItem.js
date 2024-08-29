import { View, Text, TouchableOpacity, Image, StyleSheet } from 'react-native';
import React from 'react';
import { useNavigation } from '@react-navigation/native';

export default function PostItem({ item }) {
  const navigation = useNavigation();

  return (
    <TouchableOpacity
      style={styles.container}
      onPress={() => navigation.push('product-detail', { product: item })}
    >
      <Image source={{ uri: item.image }} style={styles.image} />
      <View style={styles.textContainer}>
        <Text style={styles.title}>{item.title}</Text>
        <Text style={styles.price}>$ {item.price}</Text>
        <Text style={styles.category}>{item.category}</Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    margin: 8,
    padding: 8,
    borderRadius: 8,
    borderColor: '#94a3b8', // Equivalent to slate-200
    borderWidth: 1,
    backgroundColor: '#ffffff',
  },
  image: {
    width: '100%',
    height: 140,
    borderRadius: 8,
  },
  textContainer: {
    marginTop: 8,
  },
  title: {
    fontSize: 15,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  price: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#3b82f6', // Equivalent to blue-500
  },
  category: {
    fontSize: 10,
    color: '#3b82f6', // Equivalent to blue-500
    backgroundColor: '#bfdbfe', // Equivalent to blue-200
    marginTop: 4,
    paddingVertical: 2,
    textAlign: 'center',
    borderRadius: 16,
    paddingHorizontal: 4,
    alignSelf: 'flex-start',
  },
});
