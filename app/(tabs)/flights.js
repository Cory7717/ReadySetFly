import React, { useState, useEffect } from 'react';
import { SafeAreaView, ScrollView, View, Image, Text, TextInput, TouchableOpacity, Alert, FlatList, Linking, RefreshControl } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons, FontAwesome } from '@expo/vector-icons';
import { styled } from 'nativewind';
import { useUser } from '@clerk/clerk-expo';
import { collection, addDoc, onSnapshot, query, orderBy } from 'firebase/firestore';
import { db } from '../../firebaseConfig';
import { Text as RNText } from 'react-native';
import { useNavigation } from '@react-navigation/native';

// Styled components
const Container = styled(SafeAreaView, 'flex-1 bg-gray-100');
const Header = styled(View, 'p-4 bg-white flex-row items-center');
const ProfileImage = styled(Image, 'w-12 h-12 rounded-full');
const WelcomeText = styled(View, 'pl-3 pb-5');
const WelcomeMessage = styled(Text, 'text-base');
const UserName = styled(Text, 'text-xl font-bold');
const PostButton = styled(TouchableOpacity, 'p-4 bg-blue-500 rounded-lg absolute bottom-4 left-4 right-4 flex-row items-center justify-center');
const PostButtonText = styled(Text, 'text-white text-xl text-center ml-2');
const PostContainer = styled(View, 'p-4 bg-white mb-2 rounded-lg shadow');
const PostImage = styled(Image, 'w-full h-64 rounded-lg');
const PostActions = styled(View, 'flex-row items-center justify-between mt-2');
const ActionButton = styled(TouchableOpacity, 'flex-row items-center');
const ActionText = styled(Text, 'ml-1 text-gray-600');

// Utility function to parse hashtags, mentions, and links
const parseContent = (text, onHashtagPress, onMentionPress) => {
  const regex = /(#[\w-]+|@[\w-]+|https?:\/\/[\w-./?=&]+)/g;
  const parts = text.split(regex);

  return parts.map((part, index) => {
    if (part.startsWith('#')) {
      return (
        <RNText key={index} style={{ color: 'blue' }} onPress={() => onHashtagPress(part)}>
          {part}
        </RNText>
      );
    }
    if (part.startsWith('@')) {
      return (
        <RNText key={index} style={{ color: 'green' }} onPress={() => onMentionPress(part)}>
          {part}
        </RNText>
      );
    }
    if (part.startsWith('http://') || part.startsWith('https://')) {
      return (
        <RNText key={index} style={{ color: 'blue' }} onPress={() => Linking.openURL(part)}>
          {part}
        </RNText>
      );
    }
    return <RNText key={index}>{part}</RNText>;
  });
};

// Autocomplete Component
const Autocomplete = ({ data, onSelect }) => {
  return (
    <FlatList
      data={data}
      keyExtractor={(item) => item}
      renderItem={({ item }) => (
        <TouchableOpacity onPress={() => onSelect(item)} style={{ padding: 10 }}>
          <Text>{item}</Text>
        </TouchableOpacity>
      )}
    />
  );
};

// CreateNewPost Component
const CreateNewPost = ({ onSubmit, onCancel }) => {
  const [content, setContent] = useState('');
  const [image, setImage] = useState(null);
  const [autocompleteData, setAutocompleteData] = useState([]);
  const [showAutocomplete, setShowAutocomplete] = useState(false);
  const { user } = useUser();

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

  const handleContentChange = (text) => {
    setContent(text);

    const lastChar = text.slice(-1);
    if (lastChar === '@') {
      setShowAutocomplete(true);
    } else {
      setShowAutocomplete(false);
    }

    if (showAutocomplete) {
      const query = text.split('@').pop();
      if (query.length > 0) {
        // Simulate fetching user list
        const users = ['JohnDoe', 'JaneSmith', 'User123'];
        const filteredUsers = users.filter((user) =>
          user.toLowerCase().includes(query.toLowerCase())
        );
        setAutocompleteData(filteredUsers);
      }
    }
  };

  const handleSelectUser = (username) => {
    const words = content.split(' ');
    words.pop();
    setContent([...words, `@${username}`].join(' ') + ' ');
    setShowAutocomplete(false);
  };

  const handleSubmit = async () => {
    if (content.trim() || image) {
      const newPost = {
        content,
        image,
        userName: user.fullName,
        profileImage: user.imageUrl,
        createdAt: new Date(),
      };
      try {
        await addDoc(collection(db, 'posts'), newPost);
        onSubmit(newPost);
        setContent('');
        setImage(null);
      } catch (error) {
        Alert.alert('Error', 'Could not submit post.');
      }
    } else {
      Alert.alert('Error', 'Please enter some text or upload an image.');
    }
  };

  return (
    <View className='pt-1'>
      <View className='pt-1 flex-row items-center'>
        <ProfileImage source={{ uri: user?.imageUrl }} />
        <WelcomeText>
          <Text className='font-rubikregular'>Posting as</Text>
          <UserName>{user?.fullName}</UserName>
        </WelcomeText>
      </View>
      <PostContainer>
        <TextInput
          placeholder="What's on your mind?"
          value={content}
          onChangeText={handleContentChange}
          multiline
          style={{ marginBottom: 10, maxHeight: 100 }}
        />
        {showAutocomplete && (
          <Autocomplete data={autocompleteData} onSelect={handleSelectUser} />
        )}
        <TouchableOpacity onPress={pickImage} className="p-2 bg-gray-200 rounded mb-4">
          <Text className="text-center text-gray-700">Upload Image</Text>
        </TouchableOpacity>
        {image && <PostImage source={{ uri: image }} />}
        <PostButton onPress={handleSubmit}>
          <Ionicons name="send" size={24} color="white" />
          <PostButtonText>Post</PostButtonText>
        </PostButton>
        <TouchableOpacity onPress={onCancel} style={{ marginTop: 10 }}>
          <Text style={{ color: 'red', textAlign: 'center' }}>Cancel</Text>
        </TouchableOpacity>
      </PostContainer>
    </View>
  );
};

// Post Component
const Post = ({ post }) => {
  const navigation = useNavigation();

  const onHashtagPress = (hashtag) => {
    Alert.alert('Hashtag Pressed', `You pressed ${hashtag}`);
  };

  const onMentionPress = (mention) => {
    Alert.alert('Mention Pressed', `You pressed ${mention}`);
  };

  return (
    <PostContainer>
      <View className="flex-row items-center mb-2">
        <ProfileImage source={{ uri: post.profileImage }} />
        <Text className="ml-2 text-lg font-bold">{post.userName}</Text>
      </View>
      {post.image && <PostImage source={{ uri: post.image }} />}
      <Text className="mt-2">{parseContent(post.content, onHashtagPress, onMentionPress)}</Text>
      <PostActions>
        <ActionButton>
          <FontAwesome name="thumbs-up" size={20} color="gray" />
          <ActionText>Like</ActionText>
        </ActionButton>
        <ActionButton>
          <FontAwesome name="comment" size={20} color="gray" />
          <ActionText>Comment</ActionText>
        </ActionButton>
        <ActionButton>
          <Ionicons name="share-social-outline" size={20} color="gray" />
          <ActionText>Share</ActionText>
        </ActionButton>
      </PostActions>
    </PostContainer>
  );
};

// Main Screen Component
const SocialMediaScreen = () => {
  const [posts, setPosts] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    const q = query(collection(db, 'posts'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const newPosts = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setPosts(newPosts);
    });

    return () => unsubscribe();
  }, []);

  const addPost = (newPost) => {
    setPosts((prevPosts) => [newPost, ...prevPosts]);
    setShowForm(false);
  };

  const cancelPost = () => {
    setShowForm(false);
  };

  const onRefresh = async () => {
    setRefreshing(true);
    const q = query(collection(db, 'posts'), orderBy('createdAt', 'desc'));
    const snapshot = await getDocs(q);
    const refreshedPosts = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));
    setPosts(refreshedPosts);
    setRefreshing(false);
  };

  return (
    <Container>
      <Header>
        <View className='pt-5'>
          <Text className='font-rubikbold justify-center'>
            Aviation News Feed
          </Text>
        </View>
      </Header>
      <ScrollView
        contentContainerStyle={{ paddingBottom: 80 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {posts.map((post, index) => (
          <Post key={index} post={post} />
        ))}
      </ScrollView>
      <PostButton onPress={() => setShowForm(!showForm)}>
        <Ionicons name="chevron-down-circle-outline" size={28} color="white" />
        <PostButtonText>{showForm ? 'Cancel' : 'Create Post'}</PostButtonText>
      </PostButton>
      {showForm && <CreateNewPost onSubmit={addPost} onCancel={cancelPost} />}
    </Container>
  );
};

export default SocialMediaScreen;
