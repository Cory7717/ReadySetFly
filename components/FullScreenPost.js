import React from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';

const FullScreenPost = ({ route }) => {
  const { post } = route.params; // Get the post data from route params
  const navigation = useNavigation();

  const handleBackPress = () => {
    navigation.goBack();
  };

  return (
    <View style={styles.container}>
      <View style={styles.contentContainer}>
        <Text style={styles.userName}>{post.userName}</Text>
        {post.image && <Image source={{ uri: post.image }} style={styles.postImage} />}
        <Text style={styles.contentText}>{post.content}</Text>
        <TouchableOpacity style={styles.backButton} onPress={handleBackPress}>
          <Text style={styles.backButtonText}>Back</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'white',
    paddingTop: 20,
  },
  contentContainer: {
    padding: 16,
  },
  userName: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  postImage: {
    width: '100%',
    height: 256,
    borderRadius: 12,
    marginTop: 16,
  },
  contentText: {
    marginTop: 16,
    fontSize: 16,
  },
  backButton: {
    padding: 16,
    backgroundColor: '#E5E7EB',
    borderRadius: 9999,
    marginTop: 16,
    alignSelf: 'flex-start',
  },
  backButtonText: {
    color: 'black',
    fontSize: 16,
  },
});

export default FullScreenPost;
