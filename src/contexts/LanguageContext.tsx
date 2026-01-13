import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./AuthContext";

type Language = "en" | "nl";

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => Promise<void>;
  useMetric: boolean;
  setUseMetric: (metric: boolean) => Promise<void>;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error("useLanguage must be used within a LanguageProvider");
  }
  return context;
};

export const LanguageProvider = ({ children }: { children: ReactNode }) => {
  const { i18n } = useTranslation();
  const { user } = useAuth();
  
  // Get initial language from i18n (which uses browser detection) or localStorage
  const getInitialLanguage = (): Language => {
    const storedLang = localStorage.getItem("i18nextLng");
    if (storedLang === "nl" || storedLang === "en") {
      return storedLang;
    }
    const browserLang = i18n.language?.substring(0, 2);
    if (browserLang === "nl") return "nl";
    return "en";
  };
  
  const [language, setLanguageState] = useState<Language>(getInitialLanguage());
  const [useMetric, setUseMetricState] = useState(true);

  // Load preferences from database when user is authenticated
  useEffect(() => {
    const loadPreferences = async () => {
      if (user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("language, use_metric, onboarding_completed")
          .eq("user_id", user.id)
          .maybeSingle();

        if (profile) {
          // Only use database language if user has completed onboarding
          // Otherwise, keep the browser/localStorage detected language
          if (profile.onboarding_completed) {
            const lang = (profile.language as Language) || "en";
            setLanguageState(lang);
            i18n.changeLanguage(lang);
          }
          setUseMetricState(profile.use_metric ?? true);
        }
      }
    };

    loadPreferences();
  }, [user, i18n]);

  const setLanguage = async (lang: Language) => {
    setLanguageState(lang);
    i18n.changeLanguage(lang);
    localStorage.setItem("i18nextLng", lang);

    if (user) {
      await supabase
        .from("profiles")
        .update({ language: lang, updated_at: new Date().toISOString() })
        .eq("user_id", user.id);
    }
  };

  const setUseMetric = async (metric: boolean) => {
    setUseMetricState(metric);

    if (user) {
      await supabase
        .from("profiles")
        .update({ use_metric: metric, updated_at: new Date().toISOString() })
        .eq("user_id", user.id);
    }
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, useMetric, setUseMetric }}>
      {children}
    </LanguageContext.Provider>
  );
};