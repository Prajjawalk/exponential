import React from 'react';
import Link from 'next/link';

interface GetStartedButtonProps {
  className?: string;
  showArrow?: boolean;
  href?: string;
  size?: 'default' | 'small';
}

export function GetStartedButton({ 
  className = '', 
  showArrow = true, 
  href = "/use-the-force",
  size = 'default'
}: GetStartedButtonProps) {
  // Calculate padding and text size based on the size prop
  const sizeClasses = size === 'small' 
    ? 'px-5 py-2 text-sm' 
    : 'px-6 py-3 text-base';
  
  return (
    <Link 
      href={href} 
      className={`${sizeClasses} font-semibold rounded-md flex items-center gap-2 transition-all hover:shadow-lg hover:shadow-purple-500/20 text-white ${className}`}
      style={{ 
        background: 'linear-gradient(90deg, #8B5CF6 0%, #3B82F6 100%)'
      }}
    >
      Get Started {showArrow && <span className="ml-1">→</span>}
    </Link>
  );
}