import React, { Component, ErrorInfo, ReactNode } from 'react';
import { StyleSheet, TouchableOpacity, ScrollView, Platform, View as RNView } from 'react-native';
import { Text, View } from './Themed';
import Theme from '../constants/Theme';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  public render() {
    if (this.state.hasError) {
      return (
        <View style={styles.container}>
          <RNView style={styles.errorCard}>
            <Text style={styles.emoji}>⚠️</Text>
            <Text style={styles.title}>Oops! Something went wrong.</Text>
            <Text style={styles.subtitle}>
              An unexpected application error occurred. You can reset the screen state using the button below.
            </Text>

            <ScrollView style={styles.logContainer} contentContainerStyle={styles.logContent}>
              <Text style={styles.errorLog}>{this.state.error?.toString()}</Text>
              {this.state.error?.stack && (
                <Text style={[styles.errorLog, { marginTop: Theme.spacing.xs }]}>
                  {this.state.error.stack}
                </Text>
              )}
            </ScrollView>

            <TouchableOpacity
              activeOpacity={0.85}
              style={styles.resetButton}
              onPress={this.handleReset}
            >
              <Text style={styles.resetButtonText}>Reset Screen State</Text>
            </TouchableOpacity>
          </RNView>
        </View>
      );
    }

    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Theme.spacing.xl,
    backgroundColor: '#FAFAFA',
  },
  errorCard: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: Theme.borderRadius.lg,
    padding: Theme.spacing.xl,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 3,
  },
  emoji: {
    fontSize: 48,
    marginBottom: Theme.spacing.md,
  },
  title: {
    fontSize: Theme.typography.fontSize.lg,
    fontWeight: Theme.typography.fontWeight.bold,
    marginBottom: Theme.spacing.sm,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: Theme.typography.fontSize.sm,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: Theme.typography.lineHeight.sm,
    marginBottom: Theme.spacing.lg,
  },
  logContainer: {
    maxHeight: 160,
    width: '100%',
    backgroundColor: '#F3F4F6',
    borderRadius: Theme.borderRadius.sm,
    padding: Theme.spacing.md,
    marginBottom: Theme.spacing.xl,
  },
  logContent: {
    paddingBottom: Theme.spacing.xs,
  },
  errorLog: {
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontSize: Theme.typography.fontSize.xs - 2,
    color: '#EF4444',
  },
  resetButton: {
    backgroundColor: '#E65100', // Saffron primary
    borderRadius: Theme.borderRadius.md,
    paddingVertical: Theme.spacing.md,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  resetButtonText: {
    color: '#FFFFFF',
    fontSize: Theme.typography.fontSize.sm,
    fontWeight: Theme.typography.fontWeight.semibold,
  },
});
