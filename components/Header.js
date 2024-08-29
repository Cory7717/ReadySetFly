// App.js
import React from 'react';
import { View, Text, Image, TextInput, StyleSheet } from 'react-native';
import { useUser } from '@clerk/clerk-expo';
import { Ionicons } from '@expo/vector-icons';

const Header = () => {
  const { user } = useUser();
  console.log(user);
  return (
    <View style={styles.headerContainer}>
      <Image 
        source={{ uri: user?.imageUrl }} 
        style={styles.profileImage} 
      />
      <View>
        <Text style={styles.welcomeText}>Welcome</Text>
        <Text style={styles.nameText}>{user?.fullName}</Text>
      </View>
      {/* Search bar */}
      <View style={styles.searchContainer}>
        <Ionicons name="search" size={24} color="gray" />
        <TextInput
          placeholder='Search'
          style={styles.searchInput}
          onChangeText={(value) => console.log(value)}
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  headerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 20,
    paddingHorizontal: 16,
  },
  profileImage: {
    width: 48,
    height: 48,
    borderRadius: 24,
    marginRight: 16,
  },
  welcomeText: {
    fontSize: 16,
    color: '#000',
  },
  nameText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#000',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EBF8FF',
    padding: 10,
    marginTop: 20,
    borderRadius: 50,
    borderColor: '#63B3ED',
    borderWidth: 1,
    flex: 1,
    marginLeft: 16,
  },
  searchInput: {
    marginLeft: 10,
    fontSize: 18,
    color: '#000',
    flex: 1,
  },
});

export default Header;
