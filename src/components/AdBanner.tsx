import { useEffect, useRef } from "react";

declare global {
  interface Window {
    adsbygoogle: any[];
  }
}

interface AdBannerProps {
  slot?: string;
  format?: "auto" | "horizontal" | "vertical" | "rectangle";
  className?: string;
}

export const AdBanner = ({ 
  slot = "auto", 
  format = "auto",
  className = "" 
}: AdBannerProps) => {
  const adRef = useRef<HTMLModElement>(null);
  const isAdLoaded = useRef(false);

  useEffect(() => {
    // Only load ads once per component instance
    if (isAdLoaded.current) return;
    
    try {
      if (typeof window !== "undefined" && adRef.current) {
        // Push ad to the queue
        (window.adsbygoogle = window.adsbygoogle || []).push({});
        isAdLoaded.current = true;
      }
    } catch (error) {
      console.error("AdSense error:", error);
    }
  }, []);

  return (
    <div className={`ad-container my-4 ${className}`}>
      <ins
        ref={adRef}
        className="adsbygoogle"
        style={{ display: "block" }}
        data-ad-client="ca-pub-8526236528445843"
        data-ad-slot={slot}
        data-ad-format={format}
        data-full-width-responsive="true"
      />
    </div>
  );
};

// Helper component to render items with ads interspersed
interface ListWithAdsProps<T> {
  items: T[];
  renderItem: (item: T, index: number) => React.ReactNode;
  adInterval?: number;
  adSlot?: string;
}

export function ListWithAds<T>({ 
  items, 
  renderItem, 
  adInterval = 15,
  adSlot = "auto"
}: ListWithAdsProps<T>) {
  const elements: React.ReactNode[] = [];
  
  items.forEach((item, index) => {
    elements.push(renderItem(item, index));
    
    // Insert ad after every `adInterval` items (but not after the last item)
    if ((index + 1) % adInterval === 0 && index < items.length - 1) {
      elements.push(
        <AdBanner 
          key={`ad-${index}`} 
          slot={adSlot}
          format="horizontal"
          className="mx-4"
        />
      );
    }
  });
  
  return <>{elements}</>;
}
