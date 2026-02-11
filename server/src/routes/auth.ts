import { Router, Request, Response } from "express";
import crypto from "crypto";
import path from "path";
import fs from "fs";

const router = Router();

// Simple file-based user storage (for production, use a real database)
const DATA_DIR = path.resolve(process.cwd(), "data");
const USERS_FILE = path.join(DATA_DIR, "users.json");

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// JWT secret (in production, use environment variable)
const JWT_SECRET = process.env.JWT_SECRET || "property-witch-secret-key-change-in-production";

// User types
interface User {
  id: string;
  email: string;
  passwordHash: string;
  name: string;
  createdAt: string;
  subscription: {
    plan: "free" | "starter" | "pro" | "enterprise";
    status: "active" | "cancelled" | "expired";
    expiresAt: string | null;
    stripeCustomerId?: string;
    stripeSubscriptionId?: string;
  };
  searchesThisMonth: number;
  lastSearchReset: string;
}

interface UsersDB {
  users: User[];
}

// Anonymous IP tracking for search limits
const IP_TRACKING_FILE = path.join(DATA_DIR, "ip-tracking.json");
const ANONYMOUS_SEARCH_LIMIT = 5;

interface IPTrackingEntry {
  ip: string;
  fingerprint?: string; // Browser fingerprint for additional validation
  searchCount: number;
  firstSearchAt: string;
  lastSearchAt: string;
  blocked: boolean;
}

interface IPTrackingDB {
  entries: IPTrackingEntry[];
}

// Load IP tracking data
const loadIPTracking = (): IPTrackingDB => {
  try {
    if (fs.existsSync(IP_TRACKING_FILE)) {
      return JSON.parse(fs.readFileSync(IP_TRACKING_FILE, "utf-8"));
    }
  } catch (error) {
    console.error("Error loading IP tracking:", error);
  }
  return { entries: [] };
};

// Save IP tracking data
const saveIPTracking = (db: IPTrackingDB): void => {
  fs.writeFileSync(IP_TRACKING_FILE, JSON.stringify(db, null, 2));
};

// Get client IP from request (handles proxies)
export const getClientIP = (req: Request): string => {
  // Check various headers that might contain the real IP
  const forwardedFor = req.headers["x-forwarded-for"];
  if (forwardedFor) {
    // x-forwarded-for can contain multiple IPs, take the first one (original client)
    const ips = (Array.isArray(forwardedFor) ? forwardedFor[0] : forwardedFor).split(",");
    return ips[0].trim();
  }
  
  const realIP = req.headers["x-real-ip"];
  if (realIP) {
    return Array.isArray(realIP) ? realIP[0] : realIP;
  }
  
  // Fallback to connection remote address
  return req.socket?.remoteAddress || req.ip || "unknown";
};

// Check and increment anonymous search count
export const checkAnonymousSearchLimit = (req: Request, fingerprint?: string): {
  allowed: boolean;
  remaining: number;
  total: number;
  message?: string;
} => {
  const ip = getClientIP(req);
  const db = loadIPTracking();
  
  let entry = db.entries.find(e => e.ip === ip);
  
  if (!entry) {
    // New IP, create entry
    entry = {
      ip,
      fingerprint,
      searchCount: 0,
      firstSearchAt: new Date().toISOString(),
      lastSearchAt: new Date().toISOString(),
      blocked: false,
    };
    db.entries.push(entry);
  }
  
  // Update fingerprint if provided and different
  if (fingerprint && entry.fingerprint !== fingerprint) {
    entry.fingerprint = fingerprint;
  }
  
  // Check if blocked
  if (entry.blocked) {
    return {
      allowed: false,
      remaining: 0,
      total: ANONYMOUS_SEARCH_LIMIT,
      message: "This IP has been blocked. Please sign up for an account.",
    };
  }
  
  // Check limit
  if (entry.searchCount >= ANONYMOUS_SEARCH_LIMIT) {
    return {
      allowed: false,
      remaining: 0,
      total: ANONYMOUS_SEARCH_LIMIT,
      message: "Free search limit reached. Please sign up for an account to continue.",
    };
  }
  
  // Increment count
  entry.searchCount++;
  entry.lastSearchAt = new Date().toISOString();
  saveIPTracking(db);
  
  return {
    allowed: true,
    remaining: ANONYMOUS_SEARCH_LIMIT - entry.searchCount,
    total: ANONYMOUS_SEARCH_LIMIT,
  };
};

// Get anonymous search status without incrementing
export const getAnonymousSearchStatus = (req: Request): {
  remaining: number;
  total: number;
  used: number;
} => {
  const ip = getClientIP(req);
  const db = loadIPTracking();
  
  const entry = db.entries.find(e => e.ip === ip);
  const used = entry?.searchCount || 0;
  
  return {
    remaining: Math.max(0, ANONYMOUS_SEARCH_LIMIT - used),
    total: ANONYMOUS_SEARCH_LIMIT,
    used,
  };
};

// Load users from file
const loadUsers = (): UsersDB => {
  try {
    if (fs.existsSync(USERS_FILE)) {
      return JSON.parse(fs.readFileSync(USERS_FILE, "utf-8"));
    }
  } catch (error) {
    console.error("Error loading users:", error);
  }
  return { users: [] };
};

// Save users to file
const saveUsers = (db: UsersDB): void => {
  fs.writeFileSync(USERS_FILE, JSON.stringify(db, null, 2));
};

// Hash password
const hashPassword = (password: string): string => {
  return crypto.createHash("sha256").update(password + JWT_SECRET).digest("hex");
};

// Generate JWT token
const generateToken = (user: User): string => {
  const payload = {
    id: user.id,
    email: user.email,
    name: user.name,
    subscription: user.subscription,
    iat: Date.now(),
    exp: Date.now() + 7 * 24 * 60 * 60 * 1000, // 7 days
  };
  const base64Payload = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = crypto
    .createHmac("sha256", JWT_SECRET)
    .update(base64Payload)
    .digest("base64url");
  return `${base64Payload}.${signature}`;
};

// Verify JWT token
const verifyToken = (token: string): { valid: boolean; payload?: any } => {
  try {
    const [payloadB64, signature] = token.split(".");
    const expectedSignature = crypto
      .createHmac("sha256", JWT_SECRET)
      .update(payloadB64)
      .digest("base64url");
    
    if (signature !== expectedSignature) {
      return { valid: false };
    }
    
    const payload = JSON.parse(Buffer.from(payloadB64, "base64url").toString());
    
    if (payload.exp < Date.now()) {
      return { valid: false };
    }
    
    return { valid: true, payload };
  } catch {
    return { valid: false };
  }
};

// Subscription plans configuration
const SUBSCRIPTION_PLANS = {
  free: {
    name: "Free",
    price: 0,
    priceId: null,
    features: [
      "5 property searches per month",
      "Basic AI assistance",
      "Save up to 10 properties",
    ],
    searchLimit: 5,
    savedPropertiesLimit: 10,
  },
  starter: {
    name: "Starter",
    price: 9.99,
    priceId: process.env.STRIPE_STARTER_PRICE_ID || "price_starter",
    features: [
      "50 property searches per month",
      "Enhanced AI assistance",
      "Save up to 100 properties",
      "Email notifications",
      "PDF reports",
    ],
    searchLimit: 50,
    savedPropertiesLimit: 100,
  },
  pro: {
    name: "Professional",
    price: 24.99,
    priceId: process.env.STRIPE_PRO_PRICE_ID || "price_pro",
    features: [
      "Unlimited property searches",
      "Priority AI assistance",
      "Unlimited saved properties",
      "Real-time alerts",
      "Advanced analytics",
      "API access",
    ],
    searchLimit: -1, // unlimited
    savedPropertiesLimit: -1,
  },
  enterprise: {
    name: "Enterprise",
    price: 99.99,
    priceId: process.env.STRIPE_ENTERPRISE_PRICE_ID || "price_enterprise",
    features: [
      "Everything in Professional",
      "White-label options",
      "Dedicated support",
      "Custom integrations",
      "Team accounts",
      "SLA guarantee",
    ],
    searchLimit: -1,
    savedPropertiesLimit: -1,
  },
};

// Register new user
router.post("/register", async (req: Request, res: Response) => {
  try {
    const { email, password, name } = req.body;
    
    if (!email || !password || !name) {
      return res.status(400).json({ error: "Email, password, and name are required" });
    }
    
    if (password.length < 8) {
      return res.status(400).json({ error: "Password must be at least 8 characters" });
    }
    
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: "Invalid email format" });
    }
    
    const db = loadUsers();
    
    // Check if user already exists
    if (db.users.find((u) => u.email.toLowerCase() === email.toLowerCase())) {
      return res.status(409).json({ error: "Email already registered" });
    }
    
    const now = new Date().toISOString();
    const newUser: User = {
      id: crypto.randomUUID(),
      email: email.toLowerCase(),
      passwordHash: hashPassword(password),
      name,
      createdAt: now,
      subscription: {
        plan: "free",
        status: "active",
        expiresAt: null,
      },
      searchesThisMonth: 0,
      lastSearchReset: now,
    };
    
    db.users.push(newUser);
    saveUsers(db);
    
    const token = generateToken(newUser);
    
    res.status(201).json({
      message: "Registration successful",
      token,
      user: {
        id: newUser.id,
        email: newUser.email,
        name: newUser.name,
        subscription: newUser.subscription,
      },
    });
  } catch (error) {
    console.error("Registration error:", error);
    res.status(500).json({ error: "Registration failed" });
  }
});

// Login
router.post("/login", async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required" });
    }
    
    const db = loadUsers();
    const user = db.users.find((u) => u.email.toLowerCase() === email.toLowerCase());
    
    if (!user || user.passwordHash !== hashPassword(password)) {
      return res.status(401).json({ error: "Invalid email or password" });
    }
    
    const token = generateToken(user);
    
    res.json({
      message: "Login successful",
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        subscription: user.subscription,
        searchesThisMonth: user.searchesThisMonth,
      },
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ error: "Login failed" });
  }
});

// Verify token and get user info
router.get("/me", async (req: Request, res: Response) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) {
      return res.status(401).json({ error: "No token provided" });
    }
    
    const token = authHeader.substring(7);
    const { valid, payload } = verifyToken(token);
    
    if (!valid) {
      return res.status(401).json({ error: "Invalid or expired token" });
    }
    
    const db = loadUsers();
    const user = db.users.find((u) => u.id === payload.id);
    
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }
    
    // Check if we need to reset monthly searches
    const now = new Date();
    const lastReset = new Date(user.lastSearchReset);
    if (now.getMonth() !== lastReset.getMonth() || now.getFullYear() !== lastReset.getFullYear()) {
      user.searchesThisMonth = 0;
      user.lastSearchReset = now.toISOString();
      saveUsers(db);
    }
    
    res.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        subscription: user.subscription,
        searchesThisMonth: user.searchesThisMonth,
        createdAt: user.createdAt,
      },
    });
  } catch (error) {
    console.error("Auth check error:", error);
    res.status(500).json({ error: "Authentication check failed" });
  }
});

// Get subscription plans
router.get("/plans", (_req: Request, res: Response) => {
  res.json({ plans: SUBSCRIPTION_PLANS });
});

// Update subscription (simplified - in production, use Stripe webhooks)
router.post("/subscribe", async (req: Request, res: Response) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) {
      return res.status(401).json({ error: "No token provided" });
    }
    
    const token = authHeader.substring(7);
    const { valid, payload } = verifyToken(token);
    
    if (!valid) {
      return res.status(401).json({ error: "Invalid or expired token" });
    }
    
    const { plan, paymentMethodId } = req.body;
    
    if (!plan || !["free", "starter", "pro", "enterprise"].includes(plan)) {
      return res.status(400).json({ error: "Invalid plan" });
    }
    
    const db = loadUsers();
    const userIndex = db.users.findIndex((u) => u.id === payload.id);
    
    if (userIndex === -1) {
      return res.status(404).json({ error: "User not found" });
    }
    
    // In production, this would:
    // 1. Create/update Stripe subscription
    // 2. Handle payment processing
    // 3. Set up webhook for subscription updates
    
    const expiresAt = plan === "free" 
      ? null 
      : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(); // 30 days
    
    db.users[userIndex].subscription = {
      plan: plan as User["subscription"]["plan"],
      status: "active",
      expiresAt,
      stripeCustomerId: paymentMethodId ? `cus_demo_${payload.id}` : undefined,
      stripeSubscriptionId: paymentMethodId ? `sub_demo_${Date.now()}` : undefined,
    };
    
    saveUsers(db);
    
    // Generate new token with updated subscription
    const newToken = generateToken(db.users[userIndex]);
    
    res.json({
      message: "Subscription updated successfully",
      token: newToken,
      subscription: db.users[userIndex].subscription,
    });
  } catch (error) {
    console.error("Subscription error:", error);
    res.status(500).json({ error: "Subscription update failed" });
  }
});

// Cancel subscription
router.post("/cancel-subscription", async (req: Request, res: Response) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) {
      return res.status(401).json({ error: "No token provided" });
    }
    
    const token = authHeader.substring(7);
    const { valid, payload } = verifyToken(token);
    
    if (!valid) {
      return res.status(401).json({ error: "Invalid or expired token" });
    }
    
    const db = loadUsers();
    const userIndex = db.users.findIndex((u) => u.id === payload.id);
    
    if (userIndex === -1) {
      return res.status(404).json({ error: "User not found" });
    }
    
    db.users[userIndex].subscription.status = "cancelled";
    saveUsers(db);
    
    res.json({
      message: "Subscription cancelled. You'll retain access until the end of your billing period.",
      subscription: db.users[userIndex].subscription,
    });
  } catch (error) {
    console.error("Cancel subscription error:", error);
    res.status(500).json({ error: "Failed to cancel subscription" });
  }
});

// Get anonymous search status (for non-logged-in users)
router.get("/anonymous-status", (req: Request, res: Response) => {
  try {
    const status = getAnonymousSearchStatus(req);
    const ip = getClientIP(req);
    
    res.json({
      ...status,
      ip: ip.substring(0, 8) + "...", // Partial IP for debugging
      limitPerPeriod: ANONYMOUS_SEARCH_LIMIT,
    });
  } catch (error) {
    console.error("Anonymous status error:", error);
    res.status(500).json({ error: "Failed to get status" });
  }
});
// Increment search count (called by search route)
export const incrementSearchCount = (userId: string): { allowed: boolean; remaining: number } => {
  const db = loadUsers();
  const user = db.users.find((u) => u.id === userId);
  
  if (!user) {
    return { allowed: false, remaining: 0 };
  }
  
  const plan = SUBSCRIPTION_PLANS[user.subscription.plan];
  
  // Unlimited searches
  if (plan.searchLimit === -1) {
    return { allowed: true, remaining: -1 };
  }
  
  // Check if limit reached
  if (user.searchesThisMonth >= plan.searchLimit) {
    return { allowed: false, remaining: 0 };
  }
  
  // Increment and save
  user.searchesThisMonth++;
  saveUsers(db);
  
  return { 
    allowed: true, 
    remaining: plan.searchLimit - user.searchesThisMonth 
  };
};

// Middleware to verify auth token
export const authMiddleware = (req: Request, res: Response, next: Function) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader?.startsWith("Bearer ")) {
    // Allow unauthenticated access with limited features
    (req as any).user = null;
    return next();
  }
  
  const token = authHeader.substring(7);
  const { valid, payload } = verifyToken(token);
  
  if (!valid) {
    (req as any).user = null;
    return next();
  }
  
  const db = loadUsers();
  const user = db.users.find((u) => u.id === payload.id);
  (req as any).user = user || null;
  next();
};

export default router;
