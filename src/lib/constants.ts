// Color palette
export const COLORS = {
  // Primary
  primary: '#1E3A5F',
  primaryLight: '#2E5077',
  primaryDark: '#0F1F33',

  // Secondary
  secondary: '#FF6B35',
  secondaryLight: '#FF8A5C',
  secondaryDark: '#CC4E1F',

  // Status
  success: '#2E7D32',
  successLight: '#4CAF50',
  warning: '#F57C00',
  warningLight: '#FFB74D',
  error: '#C62828',
  errorLight: '#EF5350',
  info: '#1565C0',
  infoLight: '#42A5F5',

  // Neutrals
  white: '#FFFFFF',
  black: '#000000',
  gray50: '#FAFAFA',
  gray100: '#F5F5F5',
  gray200: '#EEEEEE',
  gray300: '#E0E0E0',
  gray400: '#BDBDBD',
  gray500: '#9E9E9E',
  gray600: '#757575',
  gray700: '#616161',
  gray800: '#424242',
  gray900: '#212121',

  // Text
  textPrimary: '#212121',
  textSecondary: '#757575',
  textDisabled: '#BDBDBD',

  // Background
  background: '#F5F5F5',
  surface: '#FFFFFF',
  surfaceVariant: '#FAFAFA',
};

// Spacing scale
export const SPACING = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

// Font sizes
export const FONT_SIZE = {
  xs: 12,
  sm: 14,
  md: 16,
  lg: 18,
  xl: 20,
  xxl: 24,
  xxxl: 32,
};

// Font weights
export const FONT_WEIGHT = {
  normal: '400' as const,
  medium: '500' as const,
  semibold: '600' as const,
  bold: '700' as const,
};

// Border radius
export const RADIUS = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  full: 9999,
};

// Shadows
export const SHADOWS = {
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 4,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 8,
  },
};

// Inspection statuses
export const INSPECTION_STATUS = {
  draft: { label: 'Not Started', color: COLORS.gray600, bgColor: COLORS.gray100 },
  scheduled: { label: 'Not Started', color: COLORS.info, bgColor: '#E3F2FD' },
  in_progress: { label: 'In Progress', color: COLORS.warning, bgColor: '#FFF3E0' },
  completed: { label: 'Finished', color: COLORS.success, bgColor: '#E8F5E9' },
  cancelled: { label: 'Cancelled', color: COLORS.error, bgColor: '#FFEBEE' },
} as const;
