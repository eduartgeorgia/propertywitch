import { useState } from "react";

const API_BASE_URL = import.meta.env.VITE_API_URL || "";

export interface User {
  id: string;
  email: string;
  name: string;
  subscription: {
    plan: "free" | "starter" | "pro" | "enterprise";
    status: "active" | "cancelled" | "expired";
    expiresAt: string | null;
  };
  searchesThisMonth?: number;
  createdAt?: string;
}

export interface SubscriptionPlan {
  name: string;
  price: number;
  priceId: string | null;
  features: string[];
  searchLimit: number;
  savedPropertiesLimit: number;
}

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAuthSuccess: (user: User, token: string) => void;
  initialMode?: "login" | "register";
}

export const AuthModal = ({ isOpen, onClose, onAuthSuccess, initialMode = "login" }: AuthModalProps) => {
  const [mode, setMode] = useState<"login" | "register">(initialMode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const endpoint = mode === "login" ? "/api/auth/login" : "/api/auth/register";
      const body = mode === "login" 
        ? { email, password }
        : { email, password, name };

      const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Authentication failed");
      }

      // Store token in localStorage
      localStorage.setItem("auth_token", data.token);
      
      onAuthSuccess(data.user, data.token);
      onClose();
      
      // Reset form
      setEmail("");
      setPassword("");
      setName("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="auth-modal-overlay" onClick={onClose}>
      <div className="auth-modal" onClick={(e) => e.stopPropagation()}>
        <button className="auth-modal-close" onClick={onClose}>×</button>
        
        <div className="auth-modal-header">
          <h2>{mode === "login" ? "Welcome Back" : "Create Account"}</h2>
          <p>
            {mode === "login" 
              ? "Sign in to access your saved properties and premium features"
              : "Join Property Witch to unlock powerful real estate tools"
            }
          </p>
        </div>

        <form onSubmit={handleSubmit} className="auth-form">
          {mode === "register" && (
            <div className="form-group">
              <label htmlFor="name">Full Name</label>
              <input
                type="text"
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your name"
                required
                autoComplete="name"
              />
            </div>
          )}

          <div className="form-group">
            <label htmlFor="email">Email Address</label>
            <input
              type="email"
              id="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
              autoComplete="email"
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input
              type="password"
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={mode === "register" ? "At least 8 characters" : "Your password"}
              required
              minLength={8}
              autoComplete={mode === "login" ? "current-password" : "new-password"}
            />
          </div>

          {error && <div className="auth-error">{error}</div>}

          <button type="submit" className="auth-submit-btn" disabled={loading}>
            {loading 
              ? "Please wait..." 
              : mode === "login" ? "Sign In" : "Create Account"
            }
          </button>
        </form>

        <div className="auth-mode-switch">
          {mode === "login" ? (
            <p>
              Don't have an account?{" "}
              <button onClick={() => { setMode("register"); setError(""); }}>
                Sign up
              </button>
            </p>
          ) : (
            <p>
              Already have an account?{" "}
              <button onClick={() => { setMode("login"); setError(""); }}>
                Sign in
              </button>
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

interface SubscriptionModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: User | null;
  token: string | null;
  onSubscriptionUpdate: (user: User, token: string) => void;
}

export const SubscriptionModal = ({ 
  isOpen, 
  onClose, 
  user, 
  token,
  onSubscriptionUpdate 
}: SubscriptionModalProps) => {
  const [plans, setPlans] = useState<Record<string, SubscriptionPlan> | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState("");

  // Fetch plans when modal opens
  useState(() => {
    if (isOpen && !plans) {
      fetch(`${API_BASE_URL}/api/auth/plans`)
        .then(res => res.json())
        .then(data => setPlans(data.plans))
        .catch(err => console.error("Failed to load plans:", err));
    }
  });

  const handleSubscribe = async (planId: string) => {
    if (!token) {
      setError("Please sign in first");
      return;
    }

    setProcessing(true);
    setError("");

    try {
      // For demo purposes, we'll simulate payment
      // In production, integrate with Stripe Checkout
      const response = await fetch(`${API_BASE_URL}/api/auth/subscribe`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
        },
        body: JSON.stringify({ 
          plan: planId,
          paymentMethodId: planId !== "free" ? "demo_payment_method" : undefined,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Subscription failed");
      }

      // Update stored token
      localStorage.setItem("auth_token", data.token);
      
      onSubscriptionUpdate(
        { ...user!, subscription: data.subscription },
        data.token
      );
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Subscription failed");
    } finally {
      setProcessing(false);
    }
  };

  if (!isOpen) return null;

  const defaultPlans: Record<string, SubscriptionPlan> = {
    free: {
      name: "Free",
      price: 0,
      priceId: null,
      features: ["5 property searches per month", "Basic AI assistance", "Save up to 10 properties"],
      searchLimit: 5,
      savedPropertiesLimit: 10,
    },
    starter: {
      name: "Starter",
      price: 9.99,
      priceId: "price_starter",
      features: ["50 property searches per month", "Enhanced AI assistance", "Save up to 100 properties", "Email notifications", "PDF reports"],
      searchLimit: 50,
      savedPropertiesLimit: 100,
    },
    pro: {
      name: "Professional",
      price: 24.99,
      priceId: "price_pro",
      features: ["Unlimited property searches", "Priority AI assistance", "Unlimited saved properties", "Real-time alerts", "Advanced analytics", "API access"],
      searchLimit: -1,
      savedPropertiesLimit: -1,
    },
    enterprise: {
      name: "Enterprise",
      price: 99.99,
      priceId: "price_enterprise",
      features: ["Everything in Professional", "White-label options", "Dedicated support", "Custom integrations", "Team accounts", "SLA guarantee"],
      searchLimit: -1,
      savedPropertiesLimit: -1,
    },
  };

  const displayPlans = plans || defaultPlans;

  return (
    <div className="subscription-modal-overlay" onClick={onClose}>
      <div className="subscription-modal" onClick={(e) => e.stopPropagation()}>
        <button className="auth-modal-close" onClick={onClose}>×</button>
        
        <div className="subscription-header">
          <h2>🏰 Upgrade Your Property Search</h2>
          <p>Choose the plan that fits your needs</p>
          {user && (
            <div className="current-plan-badge">
              Current Plan: <strong>{displayPlans[user.subscription.plan]?.name || "Free"}</strong>
            </div>
          )}
        </div>

        {error && <div className="auth-error">{error}</div>}

        <div className="plans-grid">
          {Object.entries(displayPlans).map(([planId, plan]) => {
            const isCurrentPlan = user?.subscription.plan === planId;
            const isPopular = planId === "pro";

            return (
              <div 
                key={planId} 
                className={`plan-card ${isCurrentPlan ? "current" : ""} ${isPopular ? "popular" : ""} ${selectedPlan === planId ? "selected" : ""}`}
                onClick={() => !isCurrentPlan && setSelectedPlan(planId)}
              >
                {isPopular && <div className="popular-badge">Most Popular</div>}
                {isCurrentPlan && <div className="current-badge">Current Plan</div>}
                
                <h3>{plan.name}</h3>
                <div className="plan-price">
                  {plan.price === 0 ? (
                    <span className="price-free">Free</span>
                  ) : (
                    <>
                      <span className="price-currency">€</span>
                      <span className="price-amount">{plan.price.toFixed(2)}</span>
                      <span className="price-period">/month</span>
                    </>
                  )}
                </div>

                <ul className="plan-features">
                  {plan.features.map((feature, i) => (
                    <li key={i}>
                      <span className="feature-check">✓</span>
                      {feature}
                    </li>
                  ))}
                </ul>

                <button 
                  className={`plan-btn ${isCurrentPlan ? "current" : ""}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleSubscribe(planId);
                  }}
                  disabled={isCurrentPlan || processing}
                >
                  {processing && selectedPlan === planId 
                    ? "Processing..." 
                    : isCurrentPlan 
                      ? "Current Plan" 
                      : plan.price === 0 
                        ? "Downgrade to Free"
                        : "Subscribe"
                  }
                </button>
              </div>
            );
          })}
        </div>

        <div className="subscription-footer">
          <p>🔒 Secure payment powered by Stripe • Cancel anytime</p>
        </div>
      </div>
    </div>
  );
};

interface UserMenuProps {
  user: User | null;
  onLogout: () => void;
  onOpenSubscription: () => void;
  onOpenAuth: () => void;
}

export const UserMenu = ({ user, onLogout, onOpenSubscription, onOpenAuth }: UserMenuProps) => {
  const [isOpen, setIsOpen] = useState(false);

  if (!user) {
    return (
      <div className="user-auth-buttons">
        <button className="auth-btn login" onClick={() => onOpenAuth()}>
          Sign In
        </button>
        <button className="auth-btn register" onClick={() => onOpenAuth()}>
          Get Started
        </button>
      </div>
    );
  }

  const planColors = {
    free: "#6c6b63",
    starter: "#3b82f6",
    pro: "#8b5cf6",
    enterprise: "#f59e0b",
  };

  return (
    <div className="user-menu">
      <button className="user-menu-trigger" onClick={() => setIsOpen(!isOpen)}>
        <div className="user-avatar">
          {user.name.charAt(0).toUpperCase()}
        </div>
        <span className="user-name">{user.name}</span>
        <span 
          className="user-plan-badge" 
          style={{ backgroundColor: planColors[user.subscription.plan] }}
        >
          {user.subscription.plan.toUpperCase()}
        </span>
      </button>

      {isOpen && (
        <div className="user-dropdown">
          <div className="user-dropdown-header">
            <div className="user-email">{user.email}</div>
            {user.searchesThisMonth !== undefined && user.subscription.plan !== "pro" && user.subscription.plan !== "enterprise" && (
              <div className="searches-count">
                Searches this month: {user.searchesThisMonth}
              </div>
            )}
          </div>
          
          <div className="user-dropdown-actions">
            <button onClick={() => { onOpenSubscription(); setIsOpen(false); }}>
              ⭐ Manage Subscription
            </button>
            <button onClick={() => { onLogout(); setIsOpen(false); }}>
              🚪 Sign Out
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
