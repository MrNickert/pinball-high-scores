import { motion } from "framer-motion";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

type ValidationStatus = "ai_validated" | "score_only" | "not_validated" | null | undefined;

interface ValidationBadgeProps {
  status: ValidationStatus;
  size?: "sm" | "md" | "lg";
  showLabel?: boolean;
}

const validationConfig = {
  ai_validated: {
    emoji: "✅",
    label: "AI Verified",
    description: "Machine & score verified by AI",
    bgClass: "bg-emerald-500/15",
    textClass: "text-emerald-600 dark:text-emerald-400",
    borderClass: "border-emerald-500/30",
    glowClass: "shadow-emerald-500/20",
  },
  score_only: {
    emoji: "🎯",
    label: "Score Verified",
    description: "Score verified, machine pending",
    bgClass: "bg-amber-500/15",
    textClass: "text-amber-600 dark:text-amber-400",
    borderClass: "border-amber-500/30",
    glowClass: "shadow-amber-500/20",
  },
  not_validated: {
    emoji: "👀",
    label: "Pending Review",
    description: "Awaiting community verification",
    bgClass: "bg-muted",
    textClass: "text-muted-foreground",
    borderClass: "border-border",
    glowClass: "",
  },
};

export const ValidationBadge = ({ status, size = "md", showLabel = false }: ValidationBadgeProps) => {
  // Don't render anything for null/undefined status (old scores without validation)
  if (!status) return null;

  const config = validationConfig[status];
  if (!config) return null;

  const sizeClasses = {
    sm: "text-xs px-1.5 py-0.5 gap-1",
    md: "text-sm px-2 py-1 gap-1.5",
    lg: "text-base px-3 py-1.5 gap-2",
  };

  const emojiSizes = {
    sm: "text-xs",
    md: "text-sm",
    lg: "text-base",
  };

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <motion.span
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            whileHover={{ scale: 1.05 }}
            className={`
              inline-flex items-center rounded-full border font-medium cursor-default
              ${sizeClasses[size]}
              ${config.bgClass}
              ${config.textClass}
              ${config.borderClass}
              ${config.glowClass ? `shadow-sm ${config.glowClass}` : ""}
            `}
          >
            <span className={emojiSizes[size]}>{config.emoji}</span>
            {showLabel && <span>{config.label}</span>}
          </motion.span>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-[200px]">
          <p className="font-medium">{config.label}</p>
          <p className="text-xs text-muted-foreground">{config.description}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

// Compact inline version for lists
export const ValidationIndicator = ({ status }: { status: ValidationStatus }) => {
  if (!status) return null;

  const indicators = {
    ai_validated: { emoji: "✅", title: "AI Verified" },
    score_only: { emoji: "🎯", title: "Score Verified" },
    not_validated: { emoji: "👀", title: "Pending Review" },
  };

  const indicator = indicators[status];
  if (!indicator) return null;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="cursor-default ml-1" title={indicator.title}>
            {indicator.emoji}
          </span>
        </TooltipTrigger>
        <TooltipContent side="top">
          <p>{indicator.title}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};
