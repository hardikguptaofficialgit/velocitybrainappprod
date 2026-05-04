import React from 'react';
import { Arrow, ECommerce, Files, Finance, Health, Interfaces, Misc, Objects } from 'doodle-icons';

const doodleIcon = (Component, defaultSize = 20) => {
  const WrappedIcon = ({ size = defaultSize, width, height, color, fill, className, style, ...props }) => (
    <Component
      width={width || size}
      height={height || size}
      fill={fill || color || 'currentColor'}
      className={className}
      style={style}
      {...props}
    />
  );

  WrappedIcon.displayName = Component.displayName || Component.name || 'DoodleIcon';
  return WrappedIcon;
};

const strokeIcon = (paths, defaultSize = 20, viewBox = '0 0 24 24') => {
  const WrappedIcon = ({ size = defaultSize, width, height, color, className, style, strokeWidth = 2, ...props }) => (
    <svg
      viewBox={viewBox}
      width={width || size}
      height={height || size}
      fill="none"
      stroke={color || 'currentColor'}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      style={style}
      {...props}
    >
      {paths}
    </svg>
  );

  WrappedIcon.displayName = 'StrokeIcon';
  return WrappedIcon;
};

export const ArrowRight = doodleIcon(Arrow.ArrowRight);
export const ArrowLeft = doodleIcon(Arrow.ArrowLeft);
export const Zap = doodleIcon(Interfaces.Zap, 16);
export const Terminal = doodleIcon(Files.FileCode, 24);
export const Play = doodleIcon(Interfaces.Play);
export const Shield = doodleIcon(Interfaces.Shield, 24);
export const Activity = doodleIcon(Health.HeartBeat, 24);
export const Cpu = doodleIcon(Misc.Chip, 24);
export const Database = doodleIcon(Interfaces.Server, 24);

export const Github = ({ size = 20, width, height, color, className, style, ...props }) => (
  <svg
    viewBox="0 0 24 24"
    width={width || size}
    height={height || size}
    fill={color || 'currentColor'}
    className={className}
    style={style}
    aria-hidden="true"
    {...props}
  >
    <path d="M12 2C6.48 2 2 6.58 2 12.22c0 4.5 2.87 8.32 6.84 9.67.5.1.66-.22.66-.49 0-.24-.01-1.04-.01-1.89-2.78.62-3.37-1.21-3.37-1.21-.45-1.18-1.11-1.49-1.11-1.49-.91-.64.07-.63.07-.63 1 .07 1.53 1.05 1.53 1.05.9 1.57 2.35 1.12 2.92.85.09-.67.35-1.12.64-1.37-2.22-.26-4.55-1.14-4.55-5.06 0-1.12.39-2.03 1.03-2.75-.1-.26-.45-1.31.1-2.73 0 0 .84-.28 2.75 1.05A9.3 9.3 0 0 1 12 6.83c.85 0 1.71.12 2.51.36 1.91-1.33 2.75-1.05 2.75-1.05.55 1.42.2 2.47.1 2.73.64.72 1.03 1.63 1.03 2.75 0 3.93-2.33 4.79-4.56 5.05.36.32.68.94.68 1.9 0 1.37-.01 2.47-.01 2.8 0 .27.17.59.67.49A10.23 10.23 0 0 0 22 12.22C22 6.58 17.52 2 12 2Z" />
  </svg>
);

export const Google = (props) => (
  <img
    src="https://svgl.app/library/google.svg"
    alt="Google"
    width={props.width || 20}
    height={props.height || 20}
    style={{ objectFit: 'contain', ...props.style }}
    {...props}
  />
);

export const Mail = doodleIcon(Interfaces.Mail);
export const Eye = doodleIcon(Interfaces.Unhide);
export const EyeOff = doodleIcon(Interfaces.Hide);
export const BookOpen = doodleIcon(Interfaces.Bookmark, 32);
export const Search = doodleIcon(Interfaces.Search);
export const ChevronDown = doodleIcon(Arrow.ChevronsDown);
export const User = doodleIcon(Interfaces.User);
export const Bell = doodleIcon(Interfaces.Bell);
export const Globe = doodleIcon(Interfaces.Globe);
export const Plus = strokeIcon(<path d="M12 5v14M5 12h14" />);
export const X = doodleIcon(Interfaces.Cross);
export const CheckCircle = strokeIcon(
  <>
    <circle cx="12" cy="12" r="9" />
    <path d="M8.5 12.5l2.3 2.3 4.7-5.3" />
  </>,
  20
);

export const IArrow = ({ size = 18, ...props }) => <ArrowRight size={size} {...props} />;
export const ITerm = ({ size = 18, ...props }) => <Terminal size={size} {...props} />;

export const Trash2 = doodleIcon(Interfaces.Delete);
export const TrendingUp = doodleIcon(Finance.TrendUp, 24);
export const Clock = doodleIcon(Interfaces.Clock, 24);
export const AlertTriangle = doodleIcon(Interfaces.Caution, 24);
export const FileText = doodleIcon(Files.FileText, 32);
export const ChevronRight = doodleIcon(Arrow.ChevronsRight);
export const CreditCard = doodleIcon(ECommerce.Card, 24);
export const Check = doodleIcon(Interfaces.Tick);
export const Copy = doodleIcon(Interfaces.Copy);
export const BarChart3 = doodleIcon(Interfaces.Analytics, 24);
export const Settings = doodleIcon(Interfaces.Setting, 24);
export const LogOut = doodleIcon(Interfaces.Logout, 24);
export const Menu = doodleIcon(Interfaces.Menu, 24);
export const XCircle = strokeIcon(
  <>
    <circle cx="12" cy="12" r="9" />
    <path d="M9 9l6 6M15 9l-6 6" />
  </>,
  24
);
export const Loader = ({ className, ...props }) => <RefreshCw className={className} {...props} />;
export const RefreshCw = doodleIcon(Interfaces.Sync);
export const Crown = doodleIcon(Objects.Crown);

export const DoodleSearch = Search;
export const DoodleSettings = Settings;
export const DoodleArrowRight = ArrowRight;
export const DoodleArrowDown = ChevronDown;
export const DoodleMenu = Menu;
export const DoodleHome = doodleIcon(Interfaces.Home);
export const DoodleUser = User;

export const ChatCenteredText = doodleIcon(Interfaces.Message, 24);
export const Code = doodleIcon(Files.FileCode, 24);
export const Gear = Settings;
export const Key = doodleIcon(Interfaces.Key, 24);
export const Lightning = doodleIcon(Interfaces.Zap, 24);
export const List = doodleIcon(Interfaces.List, 24);
export const Package = doodleIcon(ECommerce.Box, 24);
export const Pulse = doodleIcon(Health.HeartBeat, 24);
export const Star = doodleIcon(Interfaces.Star, 24);
export const ShieldCheck = doodleIcon(Interfaces.Shield2, 24);
export const TerminalWindow = doodleIcon(Files.FileCode, 24);
