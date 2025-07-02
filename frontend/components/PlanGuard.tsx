import React from 'react';
import { useAuth } from '../services/AuthContext';

type Plan = 'free' | 'basic' | 'pro' | 'enterprise';

interface PlanGuardProps {
    children: React.ReactNode;
    allowedPlans: Array<Plan>;
    fallback: React.ReactNode;
}

export const PlanGuard: React.FC<PlanGuardProps> = ({ children, allowedPlans, fallback }) => {
    const { profile, isLoggedIn } = useAuth();

    if (!isLoggedIn) {
        // This should ideally be handled by a higher-level check,
        // but as a failsafe, we show the fallback.
        return <>{fallback}</>;
    }
    
    // Default to 'free' if profile is loading or plan is missing
    const userPlan = profile?.plan || 'free';
    const hasAccess = allowedPlans.includes(userPlan);

    if (hasAccess) {
        return <>{children}</>;
    }

    return <>{fallback}</>;
};
