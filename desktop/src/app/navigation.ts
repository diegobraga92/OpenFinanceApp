import type { LucideIcon } from 'lucide-react';
import {
  LayoutDashboard,
  ArrowLeftRight,
  Wallet,
  Target,
  TrendingUp,
  BookOpen,
  FileSearch,
  ReceiptText,
  Tags,
  History,
  CreditCard,
  Bell,
  Inbox,
  Server,
} from 'lucide-react';
import type { TranslationKey } from '@shared/i18n';

/**
 * Navigation model for the desktop app shell. Groups are organized by user task
 * (daily money, planning, cards, tools, administration) instead of mirroring the
 * backend modules, and the sidebar renders them in that order.
 */
export interface NavItem {
  key: string;
  labelKey: TranslationKey;
  icon: LucideIcon;
  route: string;
  /** Only meaningful on Android (hidden on desktop). */
  androidOnly?: boolean;
}

/** Daily money surface. */
export const PRIMARY_NAV: NavItem[] = [
  { key: 'dashboard', labelKey: 'nav.dashboard', icon: LayoutDashboard, route: '/dashboard' },
  { key: 'transactions', labelKey: 'nav.transactions', icon: ArrowLeftRight, route: '/transactions' },
  { key: 'accounts', labelKey: 'nav.accounts', icon: Wallet, route: '/accounts' },
];

/** Planning & insight. */
export const PLANNING_NAV: NavItem[] = [
  { key: 'budgets', labelKey: 'nav.budgets', icon: Target, route: '/budgets' },
  { key: 'reports', labelKey: 'nav.reports', icon: TrendingUp, route: '/reports' },
];

/** Cards & installment plans. */
export const CARDS_NAV: NavItem[] = [
  { key: 'creditCards', labelKey: 'nav.creditCards', icon: CreditCard, route: '/credit-cards' },
];

/** Power tools. */
export const TOOLS_NAV: NavItem[] = [
  { key: 'ledger', labelKey: 'nav.ledger', icon: BookOpen, route: '/ledger' },
  { key: 'reconciliation', labelKey: 'nav.reconciliation', icon: FileSearch, route: '/reconciliation' },
  { key: 'receipts', labelKey: 'nav.receipts', icon: ReceiptText, route: '/receipts' },
];

/** Administration & settings. */
export const SYSTEM_NAV: NavItem[] = [
  { key: 'categories', labelKey: 'nav.categories', icon: Tags, route: '/categories' },
  { key: 'audit', labelKey: 'nav.audit', icon: History, route: '/audit' },
  {
    key: 'notifications',
    labelKey: 'nav.notifications',
    icon: Bell,
    route: '/notifications',
    androidOnly: true,
  },
  {
    key: 'pendingReview',
    labelKey: 'nav.reviewCaptures',
    icon: Inbox,
    route: '/pending-review',
    androidOnly: true,
  },
  { key: 'server', labelKey: 'nav.server', icon: Server, route: '/server' },
];
