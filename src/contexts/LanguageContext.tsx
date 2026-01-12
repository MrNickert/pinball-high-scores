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
  const [language, setLanguageState] = useState<Language>((i18n.language as Language) || "en");
  const [useMetric, setUseMetricState] = useState(true);

  // Load preferences from database when user is authenticated
  useEffect(() => {
    const loadPreferences = async () => {
      if (user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("language, use_metric")
          .eq("user_id", user.id)
          .maybeSingle();

        if (profile) {
          const lang = (profile.language as Language) || "en";
          setLanguageState(lang);
          i18n.changeLanguage(lang);
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