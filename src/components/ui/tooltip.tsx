import React from 'react';
import * as TooltipPrimitive from '@radix-ui/react-tooltip';

export const TooltipProvider = TooltipPrimitive.Provider;
export const Tooltip = TooltipPrimitive.Root;
export const TooltipTrigger = TooltipPrimitive.Trigger;

export const TooltipContent = React.forwardRef<
  React.ElementRef<typeof TooltipPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Content>
>(({ className = '', sideOffset = 6, children, ...props }, ref) => (
  <TooltipPrimitive.Portal>
    <TooltipPrimitive.Content
      ref={ref}
      sideOffset={sideOffset}
      className={`z-50 overflow-hidden rounded-xl border border-[#2a3a52] bg-[#151d2e] px-3 py-2 text-xs text-[#e2e8f0] shadow-2xl animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 ${className}`}
      {...props}
    >
      {children}
      <TooltipPrimitive.Arrow className="fill-[#151d2e] stroke-[#2a3a52]" />
    </TooltipPrimitive.Content>
  </TooltipPrimitive.Portal>
));
TooltipContent.displayName = TooltipPrimitive.Content.displayName;

interface MetricTooltipProps {
  title: string;
  value: React.ReactNode;
  subtitle?: string;
  children: React.ReactNode;
  side?: 'top' | 'bottom' | 'left' | 'right';
}

export const MetricTooltip: React.FC<MetricTooltipProps> = ({
  title,
  value,
  subtitle,
  children,
  side = 'bottom',
}) => {
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent side={side} className="text-left">
        <div className="font-semibold text-white text-xs">{title}</div>
        <div className="font-mono text-emerald-400 font-bold text-xs mt-0.5">{value}</div>
        {subtitle && <div className="text-[10px] text-[#8892a4] mt-0.5">{subtitle}</div>}
      </TooltipContent>
    </Tooltip>
  );
};
