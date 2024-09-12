import React, { useState, useEffect } from 'react';
import { 
  SafeAreaView, 
  View, 
  Image, 
  Text, 
  TextInput, 
  TouchableOpacity, 
  Alert, 
  FlatList, 
  Modal,
  ActivityIndicator, 
  ScrollView,
  Animated,
  RefreshControl
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons, FontAwesome, Feather } from '@expo/vector-icons';
import { styled } from 'nativewind';
import { useUser } from '@clerk/clerk-expo';
import { collection, addDoc, orderBy, deleteDoc, doc, limit, startAfter, getDocs, query } from 'firebase/firestore';
import { db } from '../../firebaseConfig';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import FullScreenRental from '../../components/FullScreenRental';
import FullScreenPost from '../../components/FullScreenPost';

// Styled components with modern design and 3D shadow
const Container = styled(SafeAreaView, 'flex-1 bg-gray-100');
const Header = styled(View, 'p-4 bg-white flex-row items-center justify-between border-b border-gray-200');
const ProfileImage = styled(Image, 'w-12 h-12 rounded-full');
const PostContainer = styled(View, 'p-4 bg-white mb-4 rounded-lg shadow-lg border border-gray-300 shadow-lg shadow-gray-500');
const PostImage = styled(Image, 'w-full h-64 rounded-lg object-cover mb-4');
const PostActions = styled(View, 'flex-row justify-between mt-2');
const ActionButton = styled(TouchableOpacity, 'flex-row items-center');
const ActionText = styled(Text, 'ml-1 text-gray-600');
const UserName = styled(Text, 'text-lg font-bold text-gray-900');

// Stack Navigator
const Stack = createStackNavigator();

// Post card component
const Post = ({ post, onDelete, onViewPost, onLike, onShare }) => {
  const { user } = useUser();

  return (
    <TouchableOpacity onPress={() => onViewPost(post)}>
      <PostContainer>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
          <ProfileImage source={{ uri: post?.profileImage || 'default_profile_image_url' }} />
          <View style={{ marginLeft: 10 }}>
            <UserName>{post?.userName || 'Unknown User'}</UserName>
            <Text>{post?.createdAt ? new Date(post.createdAt.toDate()).toLocaleDateString() : 'Unknown Date'}</Text>
          </View>
          {(user?.id === post?.userId) && (
            <TouchableOpacity onPress={() => onDelete(post.id)} style={{ marginLeft: 'auto' }}>
              <Feather name="trash" size={24} color="red" />
            </TouchableOpacity>
          )}
        </View>
        <Text style={{ marginBottom: 10 }}>{post?.content || ''}</Text>
        {/* Ensure that the image URI is valid before rendering the image */}
        {post?.image && typeof post.image === 'string' && <PostImage source={{ uri: post.image }} />}
        <PostActions>
          <ActionButton onPress={() => onLike(post)}>
            <FontAwesome name="thumbs-up" size={20} color="gray" />
            <ActionText>Like</ActionText>
          </ActionButton>
          <ActionButton onPress={() => onShare(post)}>
            <Ionicons name="share-social-outline" size={24} color="black" />
            <ActionText>Share</ActionText>
          </ActionButton>
        </PostActions>
      </PostContainer>
    </TouchableOpacity>
  );
};

// CreateNewPost component with slide-up modal and modern border
const CreateNewPost = ({ onSubmit, onCancel, isVisible }) => {
  const [content, setContent] = useState('');
  const [image, setImage] = useState(null);
  const { user } = useUser();
  const slideAnim = useState(new Animated.Value(600))[0];

  useEffect(() => {
    if (isVisible) {
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(slideAnim, {
        toValue: 600,
        duration: 300,
        useNativeDriver: true,
      }).start();
    }
  }, [isVisible]);

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

  const handleSubmit = async () => {
    if (content.trim() || image) {
      const newPost = {
        content,
        image: image || null,
        userName: user.fullName,
        profileImage: user.imageUrl,
        createdAt: new Date(),
        userId: user.id,
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
    <Modal transparent visible={isVisible} animationType="none">
      <Animated.View
        style={{
          transform: [{ translateY: slideAnim }],
          position: 'absolute',
          bottom: 0,
          width: '100%',
          backgroundColor: 'white',
          borderTopLeftRadius: 20,
          borderTopRightRadius: 20,
          padding: 20,
          borderWidth: 1,
          borderColor: '#E2E8F0',
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.8,
          shadowRadius: 2,
          elevation: 5,
        }}
      >
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <TouchableOpacity onPress={onCancel}>
            <Feather name="x-circle" size={32} color="gray" />
          </TouchableOpacity>
          <TouchableOpacity onPress={handleSubmit} style={{ padding: 10, backgroundColor: '#007bff', borderRadius: 50, flexDirection: 'row', alignItems: 'center' }}>
            <Text style={{ color: 'white', fontWeight: 'bold' }}>Post</Text>
            <Ionicons name="send" size={26} color="white" />
          </TouchableOpacity>
        </View>
        <TextInput
          placeholder="What's on your mind?"
          value={content}
          onChangeText={setContent}
          multiline
          style={{ marginBottom: 10, padding: 10, backgroundColor: '#f0f0f0', borderRadius: 5 }}
        />
        <TouchableOpacity onPress={pickImage} style={{ padding: 10, backgroundColor: '#E2E8F0', borderRadius: 5 }}>
          <Text style={{ textAlign: 'center', color: '#4A5568' }}>Upload Image</Text>
        </TouchableOpacity>
        {image && <PostImage source={{ uri: image }} />}
      </Animated.View>
    </Modal>
  );
};

// FullScreen Post modal
const FullScreenPostModal = ({ post, visible, onClose, onLike, onShare }) => {
  const [comment, setComment] = useState('');
  const [comments, setComments] = useState([]);
  const { user } = useUser(); // To fetch user id

  const handleAddComment = () => {
    if (comment.trim()) {
      const newComment = {
        userId: user.id,  // Add the user id to the comment
        text: comment,
      };
      setComments([...comments, newComment]);
      setComment('');
    }
  };

  return (
    <Modal visible={visible} transparent={false}>
      <ScrollView style={{ flex: 1, padding: 16 }}>
        <TouchableOpacity onPress={onClose}>
          <Ionicons name="close" size={30} color="black" />
        </TouchableOpacity>
        <View style={{ alignItems: 'center', marginBottom: 16 }}>
          <ProfileImage source={{ uri: post?.profileImage }} />
          <Text style={{ fontWeight: 'bold', fontSize: 18, marginTop: 8 }}>{post?.userName}</Text>
        </View>
        <Text style={{ fontSize: 16, marginBottom: 16 }}>{post?.content}</Text>
        {post?.image && <Image source={{ uri: post?.image }} style={{ width: '100%', height: 400, borderRadius: 10 }} resizeMode="cover" />}
        <PostActions>
          <ActionButton onPress={() => onLike(post)} style={{ flex: 1, justifyContent: 'center' }}>
            <FontAwesome name="thumbs-up" size={20} color="gray" />
            <ActionText>Like</ActionText>
          </ActionButton>
          <ActionButton onPress={() => onShare(post)} style={{ flex: 1, justifyContent: 'center' }}>
            <Ionicons name="share-social-outline" size={24} color="black" />
            <ActionText>Share</ActionText>
          </ActionButton>
        </PostActions>

        {/* Comment Section */}
        <View style={{ marginTop: 20 }}>
          <Text style={{ fontWeight: 'bold', marginBottom: 10 }}>Comments:</Text>
          {comments.map((cmt, index) => (
            <View key={index} style={{ paddingVertical: 4, borderBottomColor: '#ccc', borderBottomWidth: 1 }}>
              <Text>{cmt.userId}</Text>
              <Text>{cmt.text}</Text>
            </View>
          ))}
          <View style={{ flexDirection: 'row', marginTop: 10 }}>
            <TextInput
              placeholder="Add a comment"
              value={comment}
              onChangeText={setComment}
              style={{ flex: 1, padding: 10, backgroundColor: '#f0f0f0', borderRadius: 5 }}
            />
            <TouchableOpacity onPress={handleAddComment} style={{ marginLeft: 10, paddingHorizontal: 15, paddingVertical: 10, backgroundColor: '#007bff', borderRadius: 5 }}>
              <Text style={{ color: 'white' }}>Post</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </Modal>
  );
};

// Main Feed Component
const MainFeed = () => {
  const [posts, setPosts] = useState([]);
  const [lastVisible, setLastVisible] = useState(null);
  const [loading, setLoading] = useState(false);
  const [isCreatingPost, setIsCreatingPost] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedPost, setSelectedPost] = useState(null);
  const [isPostModalVisible, setPostModalVisible] = useState(false);

  const PAGE_SIZE = 10;

  useEffect(() => {
    fetchPosts();
  }, []);

  const fetchPosts = async (loadMore = false) => {
    setLoading(true);
    let postsRef = collection(db, 'posts');
    let q = query(postsRef, orderBy('createdAt', 'desc'), limit(PAGE_SIZE));
    if (loadMore && lastVisible) {
      q = query(postsRef, orderBy('createdAt', 'desc'), startAfter(lastVisible), limit(PAGE_SIZE));
    }
    const snapshot = await getDocs(q);
    if (!snapshot.empty) {
      const newPosts = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      setPosts((prevPosts) => (loadMore ? [...prevPosts, ...newPosts] : newPosts));
      setLastVisible(snapshot.docs[snapshot.docs.length - 1]);
    }
    setLoading(false);
  };

  const handleLoadMore = () => {
    if (!loading) {
      fetchPosts(true);
    }
  };

  const handleViewPost = (post) => {
    setSelectedPost(post);
    setPostModalVisible(true);
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchPosts().then(() => setRefreshing(false));
  };

  const handleLike = (post) => {
    Alert.alert('Liked!', `You liked ${post.userName}'s post.`);
  };

  const handleShare = (post) => {
    Alert.alert('Share', `Sharing ${post.userName}'s post.`);
  };

  return (
    <Container>
      <Header>
        <Ionicons name="airplane-outline" size={24} color="black" />
        <Text style={{ textAlign: 'center', fontSize: 20, fontWeight: 'bold', flex: 1 }}>Aviation News and Events</Text>
      </Header>
      <FlatList
        data={posts}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <Post 
            key={item.id} 
            post={item} 
            onDelete={(id) => setPosts((prev) => prev.filter((p) => p.id !== id))} 
            onViewPost={handleViewPost}
            onLike={handleLike}
            onShare={handleShare}
          />
        )}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.5}
        ListFooterComponent={loading && <ActivityIndicator size="large" color="#0000ff" />}
      />
      <CreateNewPost isVisible={isCreatingPost} onSubmit={(newPost) => setPosts([newPost, ...posts])} onCancel={() => setIsCreatingPost(false)} />
      {!isCreatingPost && (
        <View style={{ position: 'absolute', bottom: 20, left: 0, right: 0, alignItems: 'center' }}>
          <TouchableOpacity 
            onPress={() => setIsCreatingPost(true)} 
            style={{ 
              backgroundColor: '#007bff', 
              padding: 16, 
              borderRadius: 50, 
              flexDirection: 'row', 
              justifyContent: 'center', 
              alignItems: 'center', 
              width: '90%', 
              shadowColor: '#000', 
              shadowOffset: { width: 0, height: 2 }, 
              shadowOpacity: 0.8, 
              shadowRadius: 2, 
              elevation: 5 
            }}>
            <Ionicons name="create" size={24} color="white" />
            <Text style={{ color: 'white', fontSize: 16, fontWeight: '600', marginLeft: 8 }}>Create Post</Text>
          </TouchableOpacity>
        </View>
      )}
      <FullScreenPostModal 
        post={selectedPost} 
        visible={isPostModalVisible} 
        onClose={() => setPostModalVisible(false)} 
        onLike={handleLike}
        onShare={handleShare}
      />
    </Container>
  );
};

// Root App Component
export default function App() {
  return (
    <NavigationContainer independent={true}>
      <Stack.Navigator initialRouteName="MainFeed">
        <Stack.Screen name="MainFeed" component={MainFeed} options={{ headerShown: false }} />
        <Stack.Screen name="FullScreenPost" component={FullScreenPost} options={{ headerShown: false }} />
        <Stack.Screen name="FullScreenRental" component={FullScreenRental} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
