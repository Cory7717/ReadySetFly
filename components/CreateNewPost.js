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

const MinimizeButton = () => {
  const [isMinimized, setIsMinimized] = useState(false);
  const buttonScale = useRef(new Animated.Value(1)).current; // Initial scale
}

const handlePressIn = (onPress) => {
  Animated.timing(buttonScale, {
    toValue: 0.5, // Scale down to 50% of original size
    duration: 200, // Duration of the animation
    useNativeDriver: true, // Use native driver for better performance
  }).start();
  setIsMinimized(true);
};

const handlePressOut = () => {
  Animated.timing(buttonScale, {
    toValue: 1, // Scale back to original size
    duration: 200, // Duration of the animation
    useNativeDriver: true, // Use native driver for better performance
  }).start();
  setIsMinimized(false);
};


const CreateNewPost = ({ onSubmit }) => {
  const [content, setContent] = useState('');
  const [image, setImage] = useState(null);
  // const [location, setLocation] = useState(null);
  const [tags, setTags] = useState('');
  const [showForm, setShowForm] = useState(false);
  

  

  // const buttonSize = useRef(new Animated.Value(150)).current; // Initial size of button

  // const scrollY = useRef(new.target.Value(0)).current;
  // const handleScroll = Animated.event(
  //   [{ nativeEvent: { contentOffset: { y: scrollY } } }],
  //   { useNativeDriver: false }
  // );

  

  // The animated effect is not showing the new post form correctly

  // useEffect(() => {
  //   Animated.timing(buttonSize, {
  //     toValue: showForm ? 200 : 50, // Expand when showing form, shrink otherwise
  //     duration: 300, // Duration of the animation
  //     useNativeDriver: false, // Not using native driver since we're animating width and height
  //   }).start();
  // }, [showForm]);

  // useEffect(() => {
  //   (async () => {
  //     let { status } = await Location.requestForegroundPermissionsAsync();
  //     if (status !== 'granted') {
  //       alert('Permission to access location was denied');
  //       return;
  //     }

  //     let location = await Location.getCurrentPositionAsync({});
  //     setLocation(location);
  //   })();
  // }, []);

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
    // Ensure tags is always a string
    const tagsString = tags || '';
    // Ensure split results in an array
    const tagsArray = Array.isArray(tagsString.split(',')) ? tagsString.split(',') : [];

    const newPost = {
      userName: 'Current User',
      profileImage: 'https://example.com/current-user-profile.jpg', // Replace with actual profile image URL
      time: 'Just now',
      content,
      image,
      // location: { coords: { latitude: 37.7749, longitude: -122.4194 } }, // Example location
      tags: tagsArray.map(tag => tag.trim()), // Convert tags string to an array
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
      {showForm ? (
        <View>
          <Input
            placeholder="What's on your mind?"
            value={content}
            onChangeText={setContent}
            multiline
          />
          <Input
            placeholder="Tag users (comma separated)"
            value={tags}
            onChangeText={setTags}
          />
          <View>
          <UploadButton  onPress={pickImage}>
            <Ionicons name="camera-outline" size={36} color="green" />
            <FontAwesome6 name="user-tag" size={24} color="green" />
            {/* <UploadButtonText>Upload Image</UploadButtonText> */}
          </UploadButton>
          </View>
          {image && <Image source={{ uri: image }} style={{ width: '100%', height: 200, marginBottom: 10 }} />}
          {/* <Text>Location: {location ? `${location.coords.latitude}, ${location.coords.longitude}` : 'Fetching location...'}</Text> */}
          <SubmitButton title="Post" onPress={handleSubmit} />
        </View>
      ) : (
        

        <ShowFormButton onPress={() => setShowForm(true)}>
          <Text style={{ color: 'green', textAlign: 'center' }}>Create New Post</Text>
        </ShowFormButton>
       
      )}
    </Container>
    
  );
};

export default CreateNewPost;
