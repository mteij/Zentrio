import { useSignal, useComputed } from "@preact/signals";
import { useEffect } from "preact/hooks";
import { UAParser } from "npm:ua-parser-js";

export interface DeviceContext {
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
  deviceType: 'mobile' | 'tablet' | 'desktop';
  screenSize: 'sm' | 'md' | 'lg' | 'xl';
}

export function useDeviceContext() {
  const deviceInfo = useSignal<DeviceContext>({
    isMobile: false,
    isTablet: false,
    isDesktop: true,
    deviceType: 'desktop',
    screenSize: 'lg'
  });

  useEffect(() => {
    if (typeof window !== "undefined" && globalThis.navigator) {
      const parser = new UAParser();
      const device = parser.getDevice();
      const deviceType = device.type;
      
      // Determine device type based on UAParser
      const isMobile = deviceType === "mobile";
      const isTablet = deviceType === "tablet";
      const isDesktop = !isMobile && !isTablet;
      
      // Determine screen size based on viewport width
      const getScreenSize = (): 'sm' | 'md' | 'lg' | 'xl' => {
        const width = window.innerWidth;
        if (width < 640) return 'sm';
        if (width < 768) return 'md';
        if (width < 1024) return 'lg';
        return 'xl';
      };

      deviceInfo.value = {
        isMobile,
        isTablet,
        isDesktop,
        deviceType: isMobile ? 'mobile' : isTablet ? 'tablet' : 'desktop',
        screenSize: getScreenSize()
      };

      // Listen for resize events to update screen size
      const handleResize = () => {
        deviceInfo.value = {
          ...deviceInfo.value,
          screenSize: getScreenSize()
        };
      };

      window.addEventListener('resize', handleResize);
      return () => window.removeEventListener('resize', handleResize);
    }
  }, []);

  return deviceInfo;
}

// Computed values for common use cases
export function useResponsiveValues(deviceContext: DeviceContext) {
  return useComputed(() => ({
    // Profile card dimensions
    cardWidth: deviceContext.isMobile ? 'auto' : '220px',
    avatarSize: deviceContext.isMobile ? '80px' : '120px',
    
    // Grid configuration
    gridColumns: deviceContext.isMobile 
      ? 'repeat(auto-fill, minmax(80px, 1fr))'
      : 'repeat(auto-fill, minmax(220px, 1fr))',
    
    // Spacing
    gap: deviceContext.isMobile ? '1rem' : '2rem',
    padding: deviceContext.isMobile ? '1rem' : '2rem',
    
    // Typography
    titleSize: deviceContext.isMobile ? 'text-2xl' : 'text-4xl',
    nameSize: deviceContext.isMobile ? 'text-sm' : 'text-lg',
    
    // Layout behavior
    showBottomBar: deviceContext.isMobile,
    showHoverEdit: !deviceContext.isMobile,
    useEditMode: deviceContext.isMobile
  }));
}