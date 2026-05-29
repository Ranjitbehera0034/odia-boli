import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Alert,
  View as RNView,
  Keyboard,
} from 'react-native';
import { Text, View } from '../components/Themed';
import { useThemeColor } from '../hooks/useThemeColor';
import Theme from '../constants/Theme';
import { useUserStore } from '../stores/useUserStore';
import { chatWithAi, ChatMessage } from '../services/gemini';
import * as Speech from 'expo-speech';
import {
  ExpoSpeechRecognitionModule,
  useSpeechRecognitionEvent,
} from 'expo-speech-recognition';

interface Message {
  id: string;
  role: 'user' | 'model';
  text: string;
  timestamp: number;
}

export default function AiChatScreen() {
  const userStore = useUserStore();
  
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'init',
      role: 'model',
      text: "Hello! I am your AI English tutor. Let's practice speaking in English! How are you doing today?",
      timestamp: Date.now(),
    },
  ]);
  const [inputText, setInputText] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSpeechEnabled, setIsSpeechEnabled] = useState(true);
  const [recognizing, setRecognizing] = useState(false);
  
  // Track statistics for the session
  const [turnsCount, setTurnsCount] = useState(0);
  const [xpEarned, setXpEarned] = useState(0);

  const flatListRef = useRef<FlatList>(null);

  const cardCol = useThemeColor({}, 'card');
  const borderCol = useThemeColor({}, 'border');
  const tintCol = useThemeColor({}, 'tint');
  const textCol = useThemeColor({}, 'text');
  const textMutedCol = useThemeColor({}, 'textMuted');
  const backgroundCol = useThemeColor({}, 'background');

  // Speech Recognition Listeners
  useSpeechRecognitionEvent('start', () => {
    setRecognizing(true);
  });

  useSpeechRecognitionEvent('end', () => {
    setRecognizing(false);
  });

  useSpeechRecognitionEvent('result', (event) => {
    const resultText = event.results[0]?.transcript || '';
    setInputText(resultText);
  });

  useSpeechRecognitionEvent('error', (event) => {
    console.error('Speech recognition error:', event.error, event.message);
    setRecognizing(false);
    if (event.error !== 'aborted' && event.error !== 'no-speech') {
      Alert.alert('Speech Error 🎙️', event.message || 'Error occurred during speech recognition.');
    }
  });

  // Speak initial message on mount
  useEffect(() => {
    const timer = setTimeout(() => {
      if (isSpeechEnabled) {
        Speech.speak(messages[0].text, { language: 'en-US', rate: 0.95 });
      }
    }, 600);

    return () => {
      clearTimeout(timer);
      Speech.stop();
      ExpoSpeechRecognitionModule.abort();
    };
  }, []);

  // Scroll to bottom when keyboard opens or message list changes
  useEffect(() => {
    const showSubscription = Keyboard.addListener('keyboardDidShow', () => {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    });

    return () => {
      showSubscription.remove();
    };
  }, []);

  const handleToggleVoiceMode = async () => {
    try {
      if (recognizing) {
        ExpoSpeechRecognitionModule.stop();
        return;
      }

      // Check / request permissions
      const permission = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
      if (!permission.granted) {
        Alert.alert(
          'Microphone Permission Required 🎙️',
          'Please grant microphone and speech recognition permissions in settings to use the voice feature.'
        );
        return;
      }

      // Stop active TTS
      Speech.stop();

      // Start recognition
      setInputText('');
      ExpoSpeechRecognitionModule.start({
        lang: 'en-US',
        interimResults: true,
        continuous: false,
      });
    } catch (err) {
      console.error('Failed to toggle voice mode:', err);
    }
  };

  const handleSendMessage = async () => {
    const trimmedInput = inputText.trim();
    if (!trimmedInput || isGenerating) return;

    // Stop speech and speech recognition
    Speech.stop();
    if (recognizing) {
      ExpoSpeechRecognitionModule.stop();
    }

    const userMessage: Message = {
      id: Math.random().toString(36).substring(2, 9),
      role: 'user',
      text: trimmedInput,
      timestamp: Date.now(),
    };

    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);
    setInputText('');
    setIsGenerating(true);

    setTimeout(() => {
      flatListRef.current?.scrollToEnd({ animated: true });
    }, 100);

    try {
      // Map to service ChatMessage structure
      const apiHistory: ChatMessage[] = updatedMessages.map((m) => ({
        role: m.role,
        text: m.text,
      }));

      // Get response from Gemini
      const tutorReply = await chatWithAi(apiHistory);

      const aiMessage: Message = {
        id: Math.random().toString(36).substring(2, 9),
        role: 'model',
        text: tutorReply,
        timestamp: Date.now(),
      };

      setMessages((prev) => [...prev, aiMessage]);
      setIsGenerating(false);

      // Increment turns and award XP
      const nextTurns = turnsCount + 1;
      const earnedXpAmount = 3;
      setTurnsCount(nextTurns);
      setXpEarned((prev) => prev + earnedXpAmount);

      await userStore.addXp(earnedXpAmount, 'AI Tutor Turn');

      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);

      // Auto TTS response if enabled
      if (isSpeechEnabled) {
        Speech.speak(tutorReply, { language: 'en-US', rate: 0.95 });
      }
    } catch (err: any) {
      console.error(err);
      setIsGenerating(false);
      Alert.alert('AI Tutor Offline ⚠️', err.message || 'Failed to connect to the AI tutor.');
    }
  };

  const handleSpeakText = (text: string) => {
    Speech.stop();
    Speech.speak(text, { language: 'en-US', rate: 0.95 });
  };

  const renderMessageBubble = ({ item }: { item: Message }) => {
    const isUser = item.role === 'user';
    return (
      <RNView
        style={[
          styles.messageContainer,
          isUser ? styles.userAlign : styles.aiAlign,
        ]}
      >
        {!isUser && (
          <RNView style={[styles.avatarBadge, { backgroundColor: tintCol + '15' }]}>
            <Text style={styles.avatarEmoji}>🤖</Text>
          </RNView>
        )}
        <RNView
          style={[
            styles.bubble,
            isUser
              ? [styles.userBubble, { backgroundColor: tintCol }]
              : [styles.aiBubble, { backgroundColor: cardCol, borderColor: borderCol }],
          ]}
        >
          <Text
            style={[
              styles.messageText,
              isUser ? { color: '#FFFFFF' } : { color: textCol },
            ]}
          >
            {item.text}
          </Text>
          {!isUser && (
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => handleSpeakText(item.text)}
              style={styles.speakBubbleButton}
            >
              <Text style={{ fontSize: 13 }}>🔊 Replay Voice</Text>
            </TouchableOpacity>
          )}
        </RNView>
      </RNView>
    );
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: backgroundCol }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      {/* Top Session Progress Bar */}
      <RNView style={[styles.sessionHeader, { borderColor: borderCol, backgroundColor: cardCol }]}>
        <RNView style={styles.sessionHeaderItem}>
          <Text style={[styles.sessionLabel, { color: textMutedCol }]}>Turns Completed</Text>
          <Text style={styles.sessionValue}>💬 {turnsCount}</Text>
        </RNView>
        
        <RNView style={[styles.dividerVertical, { backgroundColor: borderCol }]} />

        <RNView style={styles.sessionHeaderItem}>
          <Text style={[styles.sessionLabel, { color: textMutedCol }]}>XP Accumulated</Text>
          <Text style={[styles.sessionValue, { color: tintCol }]}>⚡ +{xpEarned} XP</Text>
        </RNView>

        <RNView style={[styles.dividerVertical, { backgroundColor: borderCol }]} />

        <TouchableOpacity
          activeOpacity={0.7}
          onPress={() => {
            const nextState = !isSpeechEnabled;
            setIsSpeechEnabled(nextState);
            if (!nextState) Speech.stop();
          }}
          style={styles.speechToggle}
        >
          <Text style={styles.toggleText}>{isSpeechEnabled ? '🔊 Auto TTS On' : '🔇 TTS Muted'}</Text>
        </TouchableOpacity>
      </RNView>

      {/* Message list */}
      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={(item) => item.id}
        renderItem={renderMessageBubble}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListFooterComponent={() =>
          isGenerating ? (
            <RNView style={styles.typingContainer}>
              <RNView style={[styles.avatarBadge, { backgroundColor: tintCol + '15' }]}>
                <Text style={styles.avatarEmoji}>🤖</Text>
              </RNView>
              <RNView style={[styles.aiBubble, styles.typingBubble, { backgroundColor: cardCol, borderColor: borderCol }]}>
                <ActivityIndicator size="small" color={tintCol} style={styles.typingIndicator} />
                <Text style={[styles.messageText, { color: textMutedCol, fontStyle: 'italic', marginLeft: Theme.spacing.xs }]}>
                  AI Tutor is typing...
                </Text>
              </RNView>
            </RNView>
          ) : null
        }
      />

      {/* Input Bar */}
      <RNView style={[styles.inputContainer, { borderColor: borderCol, backgroundColor: cardCol }]}>
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={handleToggleVoiceMode}
          style={[
            styles.micButton,
            { backgroundColor: recognizing ? '#EF4444' : tintCol + '15' }
          ]}
        >
          <Text style={[styles.micIcon, { color: recognizing ? '#FFFFFF' : tintCol }]}>
            {recognizing ? '🟥' : '🎙️'}
          </Text>
        </TouchableOpacity>

        <TextInput
          value={inputText}
          onChangeText={setInputText}
          placeholder={recognizing ? "Listening..." : "Reply in English..."}
          placeholderTextColor="#9CA3AF"
          multiline
          maxLength={500}
          style={[
            styles.textInput,
            { color: textCol, borderColor: borderCol, backgroundColor: backgroundCol }
          ]}
        />

        <TouchableOpacity
          activeOpacity={0.8}
          onPress={handleSendMessage}
          disabled={!inputText.trim() || isGenerating}
          style={[
            styles.sendButton,
            {
              backgroundColor: inputText.trim() && !isGenerating ? tintCol : borderCol,
              opacity: inputText.trim() && !isGenerating ? 1 : 0.6
            }
          ]}
        >
          <Text style={styles.sendIcon}>➔</Text>
        </TouchableOpacity>
      </RNView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  sessionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Theme.spacing.md,
    paddingHorizontal: Theme.spacing.lg,
    borderBottomWidth: 1,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
  },
  sessionHeaderItem: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  sessionLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  sessionValue: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  dividerVertical: {
    width: 1,
    height: 24,
    marginHorizontal: Theme.spacing.xs,
  },
  speechToggle: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: Theme.borderRadius.md,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  toggleText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#4B5563',
  },
  listContent: {
    padding: Theme.spacing.lg,
    paddingBottom: Theme.spacing.xl,
  },
  messageContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginVertical: Theme.spacing.sm,
    backgroundColor: 'transparent',
    maxWidth: '85%',
  },
  userAlign: {
    alignSelf: 'flex-end',
  },
  aiAlign: {
    alignSelf: 'flex-start',
  },
  avatarBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Theme.spacing.sm,
    marginTop: 2,
  },
  avatarEmoji: {
    fontSize: 16,
  },
  bubble: {
    padding: Theme.spacing.md,
    borderRadius: Theme.borderRadius.lg,
  },
  userBubble: {
    borderTopRightRadius: 2,
  },
  aiBubble: {
    borderTopLeftRadius: 2,
    borderWidth: 1,
  },
  messageText: {
    fontSize: Theme.typography.fontSize.sm + 1,
    lineHeight: Theme.typography.lineHeight.sm + 2,
  },
  speakBubbleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: Theme.spacing.sm,
    paddingTop: Theme.spacing.xs,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E5E7EB',
  },
  typingContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginVertical: Theme.spacing.sm,
    backgroundColor: 'transparent',
  },
  typingBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    borderTopLeftRadius: 2,
    paddingVertical: Theme.spacing.sm,
    paddingHorizontal: Theme.spacing.md,
  },
  typingIndicator: {
    transform: [{ scale: 0.8 }],
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Theme.spacing.md,
    borderTopWidth: 1,
  },
  micButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Theme.spacing.sm,
  },
  micIcon: {
    fontSize: 20,
  },
  textInput: {
    flex: 1,
    borderWidth: 1,
    borderRadius: Theme.borderRadius.xl,
    paddingHorizontal: Theme.spacing.lg,
    paddingTop: Platform.OS === 'ios' ? 10 : 8,
    paddingBottom: Platform.OS === 'ios' ? 10 : 8,
    fontSize: Theme.typography.fontSize.sm,
    maxHeight: 100,
    textAlignVertical: 'center',
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: Theme.spacing.sm,
  },
  sendIcon: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
