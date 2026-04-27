'use client';

import * as React from 'react';
import { AlertCircle, CheckCircle, XCircle } from 'lucide-react';

interface AlertProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'success' | 'error' | 'warning';
}

const styles = {
  default: { bg: '#eff6ff', border: '#bfdbfe', icon: '#2563eb' },
  success: { bg: '#f0fdf4', border: '#bbf7d0', icon: '#16a34a' },
  error: { bg: '#fef2f2', border: '#fecaca', icon: '#dc2626' },
  warning: { bg: '#fffbeb', border: '#fde68a', icon: '#d97706' },
};

const icons = {
  default: AlertCircle,
  success: CheckCircle,
  error: XCircle,
  warning: AlertCircle,
};

function Alert({ variant = 'default', className, children, ...props }: AlertProps) {
  const s = styles[variant];
  const Icon = icons[variant];
  return (
    <div
      className={`w-full rounded-lg p-4 ${className || ''}`}
      style={{ backgroundColor: s.bg, border: `1px solid ${s.border}` }}
      {...props}
    >
      <div className="flex items-start gap-3">
        <Icon className="h-4 w-4 mt-0.5 shrink-0" style={{ color: s.icon }} />
        <div className="flex-1 text-sm text-gray-700">{children}</div>
      </div>
    </div>
  );
}

function AlertDescription({ children, className }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={className}>{children}</div>;
}

export { Alert, AlertDescription };
