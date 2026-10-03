import { useEffect, useRef, useState, type PropsWithChildren } from "react";
import { MobileDeviceProvider, useMobileDevice } from "./Device";
import { KeyboardDock, KeyboardProvider, useKeyboard } from "./Keyboard";
import { PhoneFrame, ScreenPortalProvider } from "./PhoneFrame";
import { HomeIndicator, StatusBar } from "./components";

export function MobileRuntime({ children }: PropsWithChildren) {
  const [preview, setPreview] = useState(() => shouldUsePreviewShell());

  useEffect(() => {
    setPreview(shouldUsePreviewShell());
  }, []);

  return (
    <MobileDeviceProvider>
      {preview ? (
        <PhoneFrame>
          <KeyboardProvider>
            <KeyboardPreview />
            <StatusBar />
            <MobileAppViewport>{children}</MobileAppViewport>
            <HomeIndicator />
            <KeyboardDock />
          </KeyboardProvider>
        </PhoneFrame>
      ) : (
        <NativeMobileRuntime>{children}</NativeMobileRuntime>
      )}
    </MobileDeviceProvider>
  );
}

function shouldUsePreviewShell() {
  if (typeof window === "undefined") return true;
  const params = new URLSearchParams(window.location.search);
  if (params.get("preview") === "1") return true;
  if (params.get("app") === "1") return false;
  if (window.matchMedia?.("(display-mode: standalone)").matches) return false;

  // Desktop workbench and its touch emulation keep the device picker. A real
  // iPhone/iPad/Android user agent goes straight to the real app shell.
  // iPadOS can report a Mac user agent, so its touch-point signal is included.
  const mobileUserAgent = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  const ipadDesktopUserAgent = navigator.maxTouchPoints > 1 && /Macintosh/i.test(navigator.userAgent);
  return !(mobileUserAgent || ipadDesktopUserAgent);
}

function NativeMobileRuntime({ children }: PropsWithChildren) {
  const screenRef = useRef<HTMLDivElement | null>(null);

  return (
    <ScreenPortalProvider screenRef={screenRef}>
      <KeyboardProvider native>
        <div className="native-runtime" data-testid="native-runtime">
          <div ref={screenRef} className="native-app-screen" data-phone-screen>
            <MobileAppViewport>{children}</MobileAppViewport>
          </div>
        </div>
      </KeyboardProvider>
    </ScreenPortalProvider>
  );
}

function MobileAppViewport({ children }: PropsWithChildren) {
  const { device } = useMobileDevice();
  const keyboard = useKeyboard();

  return (
    <div
      className="mobile-app-viewport"
      data-keyboard-visible={keyboard.visible ? "true" : "false"}
      data-platform={device.platform}
      data-testid="mobile-app-viewport"
    >
      {children}
    </div>
  );
}

function KeyboardPreview() {
  const keyboard = useKeyboard();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("keyboard") === "1") {
      keyboard.show();
    }
  }, [keyboard]);

  return null;
}
