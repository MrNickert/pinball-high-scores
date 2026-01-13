import { useState, useEffect } from "react";
import { useSearchParams, Link, useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import { Trophy, Medal, Crown, Search, Loader2, ChevronDown, Filter, Eye, EyeOff } from "lucide-react";
import { Navbar } from "@/components/Navbar";
import { PageLayout } from "@/components/PageLayout";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { ValidationBadge, ValidationIndicator } from "@/components/ValidationBadge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useTranslation } from "react-i18next";
import { useToast } from "@/hooks/use-toast";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface LeaderboardEntry {
  id: string;
  score: number;
  machine_name: string;
  location_name: string | null;
  created_at: string;
  user_id: string;
  username: string;
  avatar_url: string | null;
  validation_status: "accepted" | "pending" | "declined" | null;
}

const getRankDisplay = (rank: number) => {
  switch (rank) {
    case 1:
      return <Crown className="text-amber-500" size={20} />;
    case 2:
      return <Medal className="text-zinc-400" size={18} />;
    case 3:
      return <Medal className="text-amber-700" size={18} />;
    default:
      return <span className="text-muted-foreground text-sm font-medium">#{rank}</span>;
  }
};

const getInitials = (username: string) => {
  return username.slice(0, 2).toUpperCase();
};

const Leaderboard = () => {
  const { t } = useTranslation();
  const { toast } = useToast();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const machineFromUrl = searchParams.get("machine");

  const [searchTerm, setSearchTerm] = useState("");
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [machines, setMachines] = useState<string[]>([]);
  const [selectedMachine, setSelectedMachine] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [loadingScores, setLoadingScores] = useState(false);

  // Validation filters - only accepted shown by default
  const [showAccepted, setShowAccepted] = useState(true);
  const [showPending, setShowPending] = useState(false);
  const [showDeclined, setShowDeclined] = useState(false);

  // Show toast from score submission redirect
  useEffect(() => {
    const state = location.state as { scoreSubmitted?: { title: string; description: string } } | null;
    if (state?.scoreSubmitted) {
      toast({
        title: state.scoreSubmitted.title,
        description: state.scoreSubmitted.description,
      });
      // Clear the state so it doesn't show again on refresh
      window.history.replaceState({}, document.title);
    }
  }, [location.state, toast]);

  useEffect(() => {
    fetchMachines();
  }, []);

  useEffect(() => {
    if (selectedMachine) {
      fetchScoresForMachine(selectedMachine);
    }
  }, [selectedMachine]);

  const fetchMachines = async () => {
    try {
      const { data, error } = await supabase.from("scores").select("machine_name").order("machine_name");

      if (error) throw error;

      // Get unique machine names
      const uniqueMachines = [...new Set(data?.map((d) => d.machine_name) || [])];
      setMachines(uniqueMachines);

      // Select machine from URL param if available, otherwise first machine
      if (machineFromUrl && uniqueMachines.includes(machineFromUrl)) {
        setSelectedMachine(machineFromUrl);
      } else if (uniqueMachines.length > 0) {
        setSelectedMachine(uniqueMachines[0]);
      }
    } catch (error) {
      console.error("Error fetching machines:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchScoresForMachine = async (machineName: string) => {
    setLoadingScores(true);
    try {
      const { data: scores, error } = await supabase
        .from("scores")
        .select(
          `
          id,
          score,
          machine_name,
          location_name,
          created_at,
          user_id,
          validation_status
        `,
        )
        .eq("machine_name", machineName)
        .order("score", { ascending: false })
        .limit(50);

      if (error) throw error;

      if (scores && scores.length > 0) {
        const userIds = [...new Set(scores.map((s) => s.user_id))];
        const { data: profiles } = await supabase
          .from("public_profiles")
          .select("user_id, username, avatar_url")
          .in("user_id", userIds);

        const profileMap = new Map(
          profiles?.map((p) => [p.user_id, { username: p.username, avatar_url: p.avatar_url }]) || [],
        );

        const entriesWithUsernames = scores.map((score) => {
          const profile = profileMap.get(score.user_id);
          return {
            id: score.id,
            score: score.score,
            machine_name: score.machine_name,
            location_name: score.location_name,
            created_at: score.created_at,
            user_id: score.user_id,
            username: profile?.username || "Anonymous",
            avatar_url: profile?.avatar_url || null,
            validation_status: score.validation_status as LeaderboardEntry["validation_status"],
          };
        });

        setEntries(entriesWithUsernames);
      } else {
        setEntries([]);
      }
    } catch (error) {
      console.error("Error fetching scores:", error);
    } finally {
      setLoadingScores(false);
    }
  };

  // Filter entries based on validation status toggles
  const filteredByValidation = entries.filter((entry) => {
    if (entry.validation_status === "accepted" && showAccepted) return true;
    if (entry.validation_status === "pending" && showPending) return true;
    if (entry.validation_status === "declined" && showDeclined) return true;
    return false;
  });

  // Then filter by search term
  const filteredScores = filteredByValidation.filter(
    (entry) =>
      entry.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (entry.location_name?.toLowerCase().includes(searchTerm.toLowerCase()) ?? false),
  );

  const activeFilterCount = [showAccepted, showPending, showDeclined].filter(Boolean).length;

  if (loading) {
    return (
      <PageLayout>
        <Navbar />
        <div className="flex items-center justify-center min-h-[80vh]">
          <Loader2 className="animate-spin text-primary" size={32} />
        </div>
      </PageLayout>
    );
  }

  const topThree = filteredScores.slice(0, 3);

  return (
    <PageLayout>
      <Navbar />

      <div className="container mx-auto px-4 pt-24 pb-24">
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-8">
          <div className="inline-flex items-center gap-3 mb-4">
            <Trophy className="text-primary" size={28} />
            <h1 className="text-2xl md:text-3xl font-bold text-foreground">{t("leaderboard.title")}</h1>
          </div>
          <p className="text-muted-foreground">{t("leaderboard.selectMachine")}</p>
        </motion.div>

        {/* Machine Selector */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="max-w-md mx-auto mb-8"
        >
          <Select value={selectedMachine} onValueChange={setSelectedMachine}>
            <SelectTrigger className="w-full h-12 text-base">
              <SelectValue placeholder={t("leaderboard.selectPlaceholder")} />
            </SelectTrigger>
            <SelectContent>
              {machines.map((machine) => (
                <SelectItem key={machine} value={machine}>
                  🎰 {machine}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </motion.div>

        {/* Search & Filters */}
        {selectedMachine && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="flex flex-col sm:flex-row gap-4 mb-8 max-w-2xl mx-auto"
          >
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
              <Input
                placeholder={t("leaderboard.searchPlaceholder")}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="gap-2">
                  <Filter size={16} />
                  {t("common.validation")}
                  {activeFilterCount > 0 && (
                    <span className="ml-1 px-1.5 py-0.5 text-xs bg-primary/20 text-primary rounded-full">
                      {activeFilterCount}
                    </span>
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuCheckboxItem checked={showAccepted} onCheckedChange={setShowAccepted}>
                  ✅ {t("leaderboard.accepted")}
                </DropdownMenuCheckboxItem>
                <DropdownMenuCheckboxItem checked={showPending} onCheckedChange={setShowPending}>
                  👀 {t("leaderboard.pending")}
                </DropdownMenuCheckboxItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </motion.div>
        )}

        {machines.length === 0 ? (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-20">
            <Trophy className="mx-auto mb-4 text-muted-foreground" size={64} />
            <h2 className="text-xl font-semibold text-foreground mb-2">{t("leaderboard.noScoresYet")}</h2>
            <p className="text-muted-foreground">{t("leaderboard.beFirst")}</p>
          </motion.div>
        ) : loadingScores ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="animate-spin text-primary" size={32} />
          </div>
        ) : filteredScores.length === 0 ? (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-20">
            <Eye className="mx-auto mb-4 text-muted-foreground" size={48} />
            <h2 className="text-lg font-semibold text-foreground mb-2">{t("leaderboard.noVerifiedScores")}</h2>
            <p className="text-muted-foreground mb-4">{t("leaderboard.adjustFilters")}</p>
            <Button
              variant="outline"
              onClick={() => {
                setShowAccepted(true);
                setShowPending(true);
                setShowDeclined(true);
              }}
            >
              {t("leaderboard.showAllScores")}
            </Button>
          </motion.div>
        ) : (
          <>
            {/* Top 3 Podium */}
            {topThree.length >= 3 && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.2 }}
                className="grid grid-cols-3 gap-4 mb-10 max-w-3xl mx-auto"
              >
                {[1, 0, 2].map((orderIndex) => {
                  const entry = topThree[orderIndex];
                  if (!entry) return null;
                  const isFirst = orderIndex === 0;
                  return (
                    <motion.div
                      key={entry.id}
                      whileHover={{ y: -5 }}
                      className={`bg-card rounded-2xl p-4 text-center border border-border shadow-sm ${
                        isFirst ? "ring-2 ring-primary/20 order-2" : "order-" + (orderIndex === 1 ? "1" : "3")
                      }`}
                    >
                      <div
                        className={`mb-2 ${isFirst ? "w-16 h-16" : "w-14 h-14"} mx-auto rounded-full overflow-hidden bg-muted flex items-center justify-center`}
                      >
                        {entry.avatar_url ? (
                          <img src={entry.avatar_url} alt={entry.username} className="w-full h-full object-cover" />
                        ) : (
                          <span className={`font-semibold text-muted-foreground ${isFirst ? "text-xl" : "text-lg"}`}>
                            {getInitials(entry.username)}
                          </span>
                        )}
                      </div>
                      <div className="flex justify-center mb-2">
                        {getRankDisplay(orderIndex === 0 ? 1 : orderIndex === 1 ? 2 : 3)}
                      </div>
                      <Link to={`/profile/${entry.user_id}`} className="font-semibold text-foreground truncate hover:text-primary transition-colors">{entry.username}</Link>
                      <div className="flex items-center justify-center gap-1 mt-1">
                        <p className="text-lg font-bold text-primary">{entry.score.toLocaleString()}</p>
                        <ValidationIndicator status={entry.validation_status} />
                      </div>
                      <p className="text-xs text-muted-foreground mt-1 truncate">
                        {entry.location_name || t("leaderboard.unknownLocation")}
                      </p>
                    </motion.div>
                  );
                })}
              </motion.div>
            )}

            {/* Full Leaderboard */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3 }}
              className="bg-card rounded-2xl overflow-hidden border border-border shadow-sm max-w-4xl mx-auto"
            >
              <div className="p-4 border-b border-border">
                <h2 className="font-semibold text-foreground">{selectedMachine} {t("leaderboard.rankings")}</h2>
              </div>
              <div className="divide-y divide-border">
                {filteredScores.map((entry, index) => (
                  <motion.div
                    key={entry.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.05 * Math.min(index, 10) }}
                    className="flex items-center gap-4 p-4 hover:bg-muted/50 transition-colors"
                  >
                    <div className="w-10 h-10 flex justify-center">{getRankDisplay(index + 1)}</div>
                    <div className="w-10 h-10 rounded-full overflow-hidden bg-muted flex items-center justify-center flex-shrink-0">
                      {entry.avatar_url ? (
                        <img src={entry.avatar_url} alt={entry.username} className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-sm font-semibold text-muted-foreground">
                          {getInitials(entry.username)}
                        </span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <Link to={`/profile/${entry.user_id}`} className="font-medium text-foreground truncate hover:text-primary transition-colors">{entry.username}</Link>
                      <p className="text-sm text-muted-foreground truncate">
                        {entry.location_name || t("leaderboard.unknownLocation")}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <ValidationBadge status={entry.validation_status} size="sm" />
                      <p className="font-bold text-primary">{entry.score.toLocaleString()}</p>
                    </div>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          </>
        )}
      </div>

      <div className="h-20 md:h-0" />
    </PageLayout>
  );
};

export default Leaderboard;
