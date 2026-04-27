'use client';

import Link from 'next/link';
import { Heart } from 'lucide-react';

export default function Footer() {
  return (
    <footer className="border-t py-6 px-4">
      <div className="container flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span>Made with</span>
          <Heart className="w-4 h-4 text-red-500 fill-current" />
          <span>using Next.js & Claude</span>
        </div>
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <Link href="/settings" className="hover:text-foreground transition-colors">
            设置
          </Link>
          <Link href="/library" className="hover:text-foreground transition-colors">
            学习库
          </Link>
        </div>
      </div>
    </footer>
  );
}