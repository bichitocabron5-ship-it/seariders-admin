import { SessionOptions } from "iron-session";

export type AppSession = {
  userId?: string;
  username?: string;
  role?: string;
  availableRoles?: string[];
  shift?: "MORNING" | "AFTERNOON";
  shiftSessionId?: string;
  isLoggedIn?: boolean;
  pendingLogin?: {
    userId: string;
    username: string;
    shift: "MORNING" | "AFTERNOON";
    roles: string[];
  };
};

export const sessionOptions: SessionOptions = {
  password: process.env.SESSION_PASSWORD as string,
  cookieName: "seariders_session",
  cookieOptions: {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
  },
};
