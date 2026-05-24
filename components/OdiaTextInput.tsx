import React from 'react';
import {
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Clipboard,
  TextInputProps,
  View as RNView,
} from 'react-native';
import { Text } from './Themed';
import { useThemeColor } from '../hooks/useThemeColor';
import Theme from '../constants/Theme';

interface OdiaTextInputProps extends TextInputProps {
  value: string;
  onChangeText: (text: string) => void;
  showCharacterCount?: boolean;
  showClearButton?: boolean;
  showPasteButton?: boolean;
  maxCharacters?: number;
}

export function OdiaTextInput({
  value,
  onChangeText,
  showCharacterCount = true,
  showClearButton = true,
  showPasteButton = true,
  maxCharacters,
  style,
  placeholder = 'Enter Odia text here...',
  ...restProps
}: OdiaTextInputProps) {
  const cardCol = useThemeColor({}, 'card');
  const borderCol = useThemeColor({}, 'border');
  const tintCol = useThemeColor({}, 'tint');
  const textCol = useThemeColor({}, 'text');

  const handleClear = () => {
    onChangeText('');
  };

  const handlePaste = async () => {
    const text = await Clipboard.getString();
    if (text) {
      const newText = maxCharacters ? (value + text).slice(0, maxCharacters) : value + text;
      onChangeText(newText);
    }
  };

  const handleChangeText = (text: string) => {
    if (maxCharacters && text.length > maxCharacters) {
      onChangeText(text.slice(0, maxCharacters));
    } else {
      onChangeText(text);
    }
  };

  return (
    <RNView style={styles.container}>
      <RNView style={[styles.inputWrapper, { backgroundColor: cardCol, borderColor: borderCol }]}>
        <TextInput
          multiline
          placeholder={placeholder}
          placeholderTextColor="#9CA3AF"
          value={value}
          onChangeText={handleChangeText}
          style={[styles.textInput, { color: textCol }, style]}
          {...restProps}
        />

        <RNView style={styles.actionRow}>
          {showPasteButton && (
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={handlePaste}
              style={[styles.actionButton, { borderColor: borderCol }]}
            >
              <Text style={[styles.actionButtonText, { color: tintCol }]}>📋 Paste</Text>
            </TouchableOpacity>
          )}

          {showClearButton && value.length > 0 && (
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={handleClear}
              style={[styles.actionButton, { borderColor: borderCol }]}
            >
              <Text style={styles.clearText}>✕ Clear</Text>
            </TouchableOpacity>
          )}
        </RNView>
      </RNView>

      {showCharacterCount && (
        <RNView style={styles.infoRow}>
          <Text style={styles.countText}>
            {value.length}
            {maxCharacters ? ` / ${maxCharacters}` : ''} chars
          </Text>
        </RNView>
      )}
    </RNView>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: Theme.spacing.lg,
  },
  inputWrapper: {
    borderWidth: 1,
    borderRadius: Theme.borderRadius.lg,
    padding: Theme.spacing.md,
    minHeight: 140,
    justifyContent: 'space-between',
  },
  textInput: {
    fontSize: Theme.typography.fontSize.md,
    lineHeight: Theme.typography.lineHeight.md,
    textAlignVertical: 'top',
    paddingBottom: Theme.spacing.md,
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    borderTopWidth: 0.5,
    borderTopColor: '#E5E7EB',
    paddingTop: Theme.spacing.sm,
    marginTop: Theme.spacing.xs,
  },
  actionButton: {
    borderWidth: 1,
    borderRadius: Theme.borderRadius.xs + 2,
    paddingHorizontal: Theme.spacing.md,
    paddingVertical: Theme.spacing.xs - 2,
    marginLeft: Theme.spacing.sm,
    backgroundColor: 'transparent',
  },
  actionButtonText: {
    fontSize: Theme.typography.fontSize.xs,
    fontWeight: Theme.typography.fontWeight.semibold,
  },
  clearText: {
    fontSize: Theme.typography.fontSize.xs,
    fontWeight: Theme.typography.fontWeight.semibold,
    color: '#EF4444',
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: Theme.spacing.xs,
    paddingHorizontal: Theme.spacing.xs,
  },
  countText: {
    fontSize: Theme.typography.fontSize.xs,
    color: '#6B7280',
  },
});
