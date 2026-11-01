import {
  Award,
  BarChart3,
  Calendar,
  Check,
  Clock,
  Gift,
  Heart,
  Info,
  Mail,
  MapPin,
  Package,
  Phone,
  Shield,
  Star,
  Truck,
  Users,
  Wallet,
  Zap,
  type LucideIcon,
} from 'lucide-react';
import type { WidgetIcon } from '@/lib/page-builder';

/* The icons a widget may show, by the names stored in a page's JSON. */
export const WIDGET_ICON_COMPONENTS: Record<WidgetIcon, LucideIcon> = {
  check: Check,
  star: Star,
  heart: Heart,
  phone: Phone,
  mail: Mail,
  'map-pin': MapPin,
  clock: Clock,
  calendar: Calendar,
  truck: Truck,
  package: Package,
  shield: Shield,
  zap: Zap,
  users: Users,
  wallet: Wallet,
  chart: BarChart3,
  gift: Gift,
  award: Award,
  info: Info,
};

/** An unknown name from stored JSON falls back to a plain check mark. */
export function widgetIcon(name: string | undefined): LucideIcon {
  return WIDGET_ICON_COMPONENTS[name as WidgetIcon] ?? Check;
}
