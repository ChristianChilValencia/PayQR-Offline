import React from "react";
import { ColorValue, Platform } from "react-native";
import QrCode from "lucide-react-native/icons/qr-code";
import Smartphone from "lucide-react-native/icons/smartphone";
import Settings from "lucide-react-native/icons/settings";
import Camera from "lucide-react-native/icons/camera";
import Copy from "lucide-react-native/icons/copy";
import ExternalLink from "lucide-react-native/icons/external-link";
import Share2 from "lucide-react-native/icons/share-2";
import Download from "lucide-react-native/icons/download";
import ImagePlus from "lucide-react-native/icons/image-plus";
import RotateCcw from "lucide-react-native/icons/rotate-ccw";
import X from "lucide-react-native/icons/x";
import Check from "lucide-react-native/icons/check";
import ArrowLeft from "lucide-react-native/icons/arrow-left";
import Link from "lucide-react-native/icons/link";
import Save from "lucide-react-native/icons/save";
import Trash2 from "lucide-react-native/icons/trash";
import Wallet from "lucide-react-native/icons/wallet";
import ChevronLeft from "lucide-react-native/icons/chevron-left";
import ChevronRight from "lucide-react-native/icons/chevron-right";
import Pencil from "lucide-react-native/icons/pencil";
import Plus from "lucide-react-native/icons/plus";
import Minus from "lucide-react-native/icons/minus";
import Hash from "lucide-react-native/icons/hash";
import Archive from "lucide-react-native/icons/archive";
import Upload from "lucide-react-native/icons/upload";
import ShieldCheck from "lucide-react-native/icons/shield-check";

const icons = {
  backup: Archive,
  upload: Upload,
  shield: ShieldCheck,
  previous: ChevronLeft,
  next: ChevronRight,
  pay: Wallet,
  edit: Pencil,
  qr: QrCode,
  phone: Smartphone,
  number: Hash,
  settings: Settings,
  camera: Camera,
  copy: Copy,
  open: ExternalLink,
  share: Share2,
  download: Download,
  import: ImagePlus,
  reset: RotateCcw,
  close: X,
  check: Check,
  back: ArrowLeft,
  link: Link,
  save: Save,
  trash: Trash2,
  plus: Plus,
  minus: Minus,
} as const;
export type IconName = keyof typeof icons;
export function AppIcon({
  name,
  size = 22,
  color = "#11274a",
}: {
  name: IconName;
  size?: number;
  color?: ColorValue;
}) {
  const Icon = icons[name];
  return (
    <Icon
      size={size}
      color={color}
      strokeWidth={2}
      {...(Platform.OS === "web"
        ? { "aria-hidden": true }
        : { accessible: false })}
    />
  );
}
