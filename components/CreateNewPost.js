import React, { useState, useEffect, useRef } from 'react';
import { View, TextInput, Button, Image, TouchableOpacity, Text, Animated } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { styled } from 'nativewind';
import { Ionicons, FontAwesome6 } from '@expo/vector-icons';

const Container = styled(View, 'p-4 bg-white rounded-lg shadow-md mb-4');
const Input = styled(TextInput, 'border border-gray-300 p-2 rounded-lg mb-4');
const UploadButton = styled(TouchableOpacity, 'flex flex-row items-center justify-center bg-blue-500 p-2 rounded-lg mb-4');
const UploadButtonText = styled(Text, 'text-white text-center ml-2');
const SubmitButton = styled(Button, 'bg-blue-500 p-2 rounded-lg');
const ShowFormButton = styled(TouchableOpacity, 'bg-green-500 p-2 rounded-lg mt-4');

const CreateNewPost = ({ onSubmit }) => {
  const [content, setContent] = useState('');
  const [image, setImage] = useState(null);
  const [tags, setTags] = useState('');
  const [showForm, setShowForm] = useState(false);

  const buttonSize = useRef(new Animated.Value(150)).current; // Initial size of button
  const scrollY = useRef(new Animated.Value(0)).current; // Corrected initialization

  useEffect(() => {
    Animated.timing(buttonSize, {
      toValue: showForm ? 200 : 150, // Expand when showing form, shrink otherwise
      duration: 300, // Duration of the animation
      useNativeDriver: false, // Not using native driver since we're animating width and height
    }).start();
  }, [showForm]);

  useEffect(() => {
    (async () => {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        alert('Permission to access location was denied');
        return;
      }

      let location = await Location.getCurrentPositionAsync({});
      // Assuming you need to use the location
    })();
  }, []);

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 1,
    });

    if (!result.canceled) {
      setImage(result.assets[0].uri);
    }
  };

  const handleSubmit = () => {
    const tagsArray = (tags || '').split(',').map(tag => tag.trim());

    const newPost = {
      userName: 'Current User',
      profileImage: 'https://example.com/current-user-profile.jpg', // Replace with actual profile image URL
      time: 'Just now',
      content,
      image,
      tags: tagsArray,
      likes: 0,
      comments: 0,
    };

    onSubmit(newPost);
    setContent('');
    setImage(null);
    setTags('');
    setShowForm(false); // Hide the form after submission
  };

  return (
    <Container>
      <Animated.View style={{ width: buttonSize, height: buttonSize }}>
        {showForm ? (
          <View>
            <Input
              placeholder="What's on your mind?"
              value={content}
              onChangeText={setContent}
              multiline
            />
            {/* <Input
              placeholder="Tag users (comma separated)"
              value={tags}
              onChangeText={setTags}
            /> */}
            <View className='flex-1'>
              <UploadButton onPress={pickImage}>
                <Ionicons name="camera-outline" size={36} color="green" />
                {/* <FontAwesome6 name="user-tag" size={24} color="green" /> */}
                <UploadButtonText>Upload Image</UploadButtonText>
              </UploadButton>
            </View>
            {image && <Image source={{ uri: image }} style={{ width: '100%', height: 200, marginBottom: 10 }} />}
            
          </View>
        ) : (
          <ShowFormButton onPress={() => setShowForm(true)}>
            <Text style={{ color: 'green', textAlign: 'center' }}>Create New Post</Text>
          </ShowFormButton>
        )}
      </Animated.View>
    </Container>
  );
};

export default CreateNewPost;
