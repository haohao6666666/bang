export type MobileDeviceGeometry = {
  device: {
    width: number;
    height: number;
  };
  screen: {
    x: number;
    y: number;
    width: number;
    height: number;
    radius: number;
  };
  safeArea: {
    top: number;
    bottom: number;
  };
  keyboard: {
    height: number;
  };
};

export const iphoneGeometry = {
  // CSS-space coordinates for the 3x iPhone assets. Keep source PNG dimensions
  // divisible by 3 so the rendered phone frame lands on whole CSS pixels.
  device: {
    width: 511,
    height: 968,
  },
  screen: {
    x: 59,
    y: 58,
    width: 393,
    height: 852,
    radius: 42,
  },
  safeArea: {
    top: 54,
    bottom: 34,
  },
  keyboard: {
    height: 338,
  },
} as const satisfies MobileDeviceGeometry;

export type IPhoneGeometry = typeof iphoneGeometry;
