import { SessionOptions } from "iron-session";

export type AppSession = {
  userId?: string;
  username?: string;
  role?: string;
  shift?: "MORNING" | "AFTERNOON";   // ✅ esto
  shiftSessionId?: string;
  isLoggedIn?: boolean;
};

export const sessionOptions: SessionOptions = {
  password: process.env.SESSION_PASSWORD as string,
  cookieName: "seariders_session",
  cookieOptions: {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
  },
};