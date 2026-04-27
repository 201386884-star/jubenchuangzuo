'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Film, Settings, Library, Home, FolderOpen, Eraser } from 'lucide-react';

const navItems = [
  { href: '/', label: '首页', icon: Home },
  { href: '/scripts', label: '我的剧本', icon: FolderOpen },
  { href: '/deai', label: '剧本润色', icon: Eraser },
  { href: '/library', label: '学习库', icon: Library },
  { href: '/settings', label: '设置', icon: Settings },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside
      style={{ width: 224 }}
      className="fixed left-0 top-0 bottom-0 z-40 flex flex-col bg-[#1a1a2e]"
    >
      {/* Logo */}
      <div className="flex items-center gap-3 px-5 h-16 shrink-0" style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: 'linear-gradient(135deg, #8b5cf6, #7c3aed)' }}>
          <Film className="w-4 h-4 text-white" />
        </div>
        <span className="font-bold text-white text-sm">词元剧本</span>
      </div>

      {/* Nav */}
      <nav className="flex-1 py-4 px-3 space-y-0.5">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = item.href === '/'
            ? pathname === '/'
            : pathname === item.href || pathname.startsWith(item.href + '/');
          return (
            <Link
              key={item.href}
              href={item.href}
              style={{
                backgroundColor: isActive ? 'rgba(139, 92, 246, 0.2)' : 'transparent',
                color: isActive ? '#ffffff' : '#9ca3af',
              }}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all hover:bg-white/5 hover:text-white no-underline"
            >
              <Icon className="w-4 h-4 shrink-0" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
