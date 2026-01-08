import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Trophy, Medal, Crown, Search, Filter, Loader2 } from "lucide-react";
import { Navbar } from "@/components/Navbar";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

interface LeaderboardEntry {
  id: string;
  score: number;
  machine_name: string;
  location_name: string | null;
  created_at: string;
  username: string;
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

const getAvatar = (username: string) => {
  const avatars = ["🎯", "🎮", "🎪", "🎨", "🎭", "🎲", "🎳", "🎰"];
  const index = username.charCodeAt(0) % avatars.length;
  return avatars[index];
};

const Leaderboard = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchLeaderboard();
  }, []);

  const fetchLeaderboard = async () => {
    try {
      const { data: scores, error } = await supabase
        .from("scores")
        .select(`
          id,
          score,
          machine_name,
          location_name,
          created_at,
          user_id
        `)
        .order("score", { ascending: false })
        .limit(50);

      if (error) throw error;

      if (scores && scores.length > 0) {
        // Fetch profiles for all users
        const userIds = [...new Set(scores.map(s => s.user_id))];
        const { data: profiles } = await supabase
          .from("profiles")
          .select("user_id, username")
          .in("user_id", userIds);

        const profileMap = new Map(profiles?.map(p => [p.user_id, p.username]) || []);

        const entriesWithUsernames = scores.map(score => ({
          id: score.id,
          score: score.score,
          machine_name: score.machine_name,
          location_name: score.location_name,
          created_at: score.created_at,
          username: profileMap.get(score.user_id) || "Anonymous",
        }));

        setEntries(entriesWithUsernames);
      }
    } catch (error) {
      console.error("Error fetching leaderboard:", error);
    } finally {
      setLoading(false);
    }
  };

  const filteredScores = entries.filter(
    (entry) =>
      entry.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
      entry.machine_name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="flex items-center justify-center min-h-[80vh]">
          <Loader2 className="animate-spin text-primary" size={32} />
        </div>
      </div>
    );
  }

  const topThree = filteredScores.slice(0, 3);

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <div className="container mx-auto px-4 pt-24 pb-24">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-10"
        >
          <div className="inline-flex items-center gap-3 mb-4">
            <Trophy className="text-primary" size={28} />
            <h1 className="text-2xl md:text-3xl font-bold text-foreground">Leaderboard</h1>
          </div>
          <p className="text-muted-foreground">
            Global rankings of the greatest achievements
          </p>
        </motion.div>

        {/* Search & Filters */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="flex flex-col sm:flex-row gap-4 mb-8 max-w-2xl mx-auto"
        >
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
            <Input
              placeholder="Search player or machine..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          <Button variant="outline" className="gap-2">
            <Filter size={16} />
            Filters
          </Button>
        </motion.div>

        {entries.length === 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-20"
          >
            <Trophy className="mx-auto mb-4 text-muted-foreground" size={64} />
            <h2 className="text-xl font-semibold text-foreground mb-2">No scores yet</h2>
            <p className="text-muted-foreground">Be the first to submit a score!</p>
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
                      <div className={`mb-2 ${isFirst ? "text-5xl" : "text-4xl"}`}>
                        {getAvatar(entry.username)}
                      </div>
                      <div className="flex justify-center mb-2">
                        {getRankDisplay(orderIndex === 0 ? 1 : orderIndex === 1 ? 2 : 3)}
                      </div>
                      <p className="font-semibold text-foreground truncate">
                        {entry.username}
                      </p>
                      <p className="text-lg font-bold text-primary mt-1">
                        {entry.score.toLocaleString()}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1 truncate">
                        {entry.machine_name}
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
                <h2 className="font-semibold text-foreground">All Rankings</h2>
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
                    <div className="w-10 flex justify-center">
                      {getRankDisplay(index + 1)}
                    </div>
                    <div className="text-2xl">{getAvatar(entry.username)}</div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-foreground truncate">
                        {entry.username}
                      </p>
                      <p className="text-sm text-muted-foreground truncate">
                        {entry.machine_name} {entry.location_name && `• ${entry.location_name}`}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-primary">
                        {entry.score.toLocaleString()}
                      </p>
                    </div>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          </>
        )}
      </div>

      <div className="h-20 md:h-0" />
    </div>
  );
};

export default Leaderboard;
