const saffronLight = '#E65100'; // Rich Odia saffron / orange
const saffronDark = '#FF9800'; // Bright saffron for dark mode readability

export const Theme = {
  colors: {
    light: {
      text: '#1F2937',        // Slate 800
      textMuted: '#6B7280',   // Slate 500
      background: '#FAFAFA',  // Clean light background
      card: '#FFFFFF',
      primary: saffronLight,
      tint: saffronLight,
      icon: '#9CA3AF',
      tabIconDefault: '#9CA3AF',
      tabIconSelected: saffronLight,
      border: '#E5E7EB',
      notification: '#EF4444',
    },
    dark: {
      text: '#F9FAFB',        // Off-white
      textMuted: '#9CA3AF',   // Muted gray
      background: '#0F172A',  // Slate 900
      card: '#1E293B',        // Slate 800
      primary: saffronDark,
      tint: saffronDark,
      icon: '#6B7280',
      tabIconDefault: '#4B5563',
      tabIconSelected: saffronDark,
      border: '#334155',      // Slate 700
      notification: '#F87171',
    },
  },
  spacing: {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 24,
    xxl: 32,
    xxxl: 48,
  },
  borderRadius: {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 24,
    round: 9999,
  },
  typography: {
    fontSize: {
      xs: 12,
      sm: 14,
      md: 16,
      lg: 18,
      xl: 20,
      xxl: 24,
      xxxl: 32,
    },
    fontWeight: {
      regular: '400',
      medium: '500',
      semibold: '600',
      bold: '700',
      heavy: '800',
    } as const,
    lineHeight: {
      xs: 16,
      sm: 20,
      md: 24,
      lg: 28,
      xl: 32,
      xxl: 38,
      xxxl: 48,
    },
  },
};

export default Theme;
