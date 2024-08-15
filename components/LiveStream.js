import React, { useState, useEffect } from 'react';
import { View, Text, Button, SafeAreaView, StyleSheet } from 'react-native';
import RtcEngine from 'react-native-agora';
import { useNavigation } from '@react-navigation/native';

const APP_ID = 'YOUR_AGORA_APP_ID'; // Replace with your Agora App ID
const CHANNEL_NAME = 'test-channel'; // You can use dynamic channel names

const LiveStreamScreen = () => {
  const [engine, setEngine] = useState(null);
  const [joined, setJoined] = useState(false);
  const navigation = useNavigation();

  useEffect(() => {
    const initAgora = async () => {
      const rtcEngine = await RtcEngine.create(APP_ID);
      setEngine(rtcEngine);

      rtcEngine.addListener('Warning', (warn) => console.log('Warning:', warn));
      rtcEngine.addListener('Error', (err) => console.log('Error:', err));
      rtcEngine.addListener('UserJoined', (uid, elapsed) => console.log('User Joined:', uid));
      rtcEngine.addListener('UserOffline', (uid, reason) => console.log('User Offline:', uid));

      await rtcEngine.initialize({ appId: APP_ID });
    };

    initAgora();

    return () => {
      if (engine) {
        engine.destroy();
      }
    };
  }, []);

  const startLiveStream = async () => {
    if (engine) {
      await engine.joinChannel(null, CHANNEL_NAME, null, 0);
      await engine.startPreview();
      setJoined(true);
    }
  };

  const stopLiveStream = async () => {
    if (engine) {
      await engine.leaveChannel();
      setJoined(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>Live Streaming</Text>
      <Button title={joined ? "Stop Streaming" : "Start Streaming"} onPress={joined ? stopLiveStream : startLiveStream} />
      <Button title="Go Back" onPress={() => navigation.goBack()} />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    marginBottom: 20,
  },
});

export default LiveStreamScreen;
