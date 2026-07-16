'use client';

import React from 'react';
import {
  Add, Archive, ArrowRight2, Calendar, Category, Chart2, CloseCircle, DocumentText,
  Edit2, Eye, HambergerMenu, LogoutCurve, Moon, People, Printer, ScanBarcode, Sun1,
  TickCircle, Buildings2, AddSquare, User,
} from 'iconsax-react';

export type IconProps = { className?: string; size?: number };

/** Wrap an iconsax glyph so it takes className (colour via currentColor) + size. */
const mk =
  (C: React.ComponentType<Record<string, unknown>>, variant: string = 'Linear') =>
  function Icon({ className, size = 20 }: IconProps) {
    return <C size={size} color="currentColor" variant={variant} className={className} />;
  };

export const Ico = {
  dashboard: mk(Category),
  chart: mk(Chart2),
  filePlus: mk(AddSquare),
  files: mk(DocumentText),
  building: mk(Buildings2),
  users: mk(People),
  calendar: mk(Calendar),
  pen: mk(Edit2),
  check: mk(TickCircle),
  archive: mk(Archive),
  user: mk(User),
  logout: mk(LogoutCurve),
  menu: mk(HambergerMenu),
  close: mk(CloseCircle),
  sun: mk(Sun1),
  moon: mk(Moon),
  qr: mk(ScanBarcode),
  eye: mk(Eye),
  print: mk(Printer),
  chevron: mk(ArrowRight2),
  add: mk(Add),
};

/** Registry for nav items — referenced by string key so server components can pass nav data. */
export const NAV_ICONS: Record<string, React.ComponentType<IconProps>> = {
  dashboard: Ico.dashboard,
  chart: Ico.chart,
  'file-plus': Ico.filePlus,
  files: Ico.files,
  building: Ico.building,
  users: Ico.users,
  calendar: Ico.calendar,
  pen: Ico.pen,
  check: Ico.check,
  archive: Ico.archive,
  user: Ico.user,
};
