import { useState } from "react";
import { motion } from "framer-motion";
import { Trophy, Medal, Crown, Search, Filter } from "lucide-react";
import { Navbar } from "@/components/Navbar";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

const mockLeaderboard = [
  { rank: 1, username: "PinballWizard", score: 12847500, machine: "Medieval Madness", location: "Flynn's Arcade, LA", avatar: "🧙‍♂️" },
  { rank: 2, username: "FlipperMaster", score: 11234000, machine: "The Addams Family", location: "Pinball Pete's, Detroit", avatar: "👨‍🎤" },
  { rank: 3, username: "SilverBallQueen", score: 10892300, machine: "Attack From Mars", location: "Ground Kontrol, Portland", avatar: "👸" },
  { rank: 4, username: "TiltWarrior", score: 9876500, machine: "Twilight Zone", location: "Barcade, Brooklyn", avatar: "⚔️" },
  { rank: 5, username: "BumperKing", score: 8765400, machine: "Theatre of Magic", location: "Logan Arcade, Chicago", avatar: "👑" },
  { rank: 6, username: "MultiballMike", score: 7654300, machine: "Monster Bash", location: "Cidercade, Dallas", avatar: "🎱" },
  { rank: 7, username: "ComboBreaker", score: 6543200, machine: "Indiana Jones", location: "Orbit Room, SF", avatar: "💥" },
  { rank: 8, username: "NeonNinja", score: 5432100, machine: "Creature from the Black Lagoon", location: "Up-Down, KC", avatar: "🥷" },
];

const getRankIcon = (rank: number) => {
  switch (rank) {
    case 1:
      return <Crown className="text-accent" size={24} />;
    case 2:
      return <Medal className="text-muted-foreground" size={22} />;
    case 3:
      return <Medal className="text-amber-700" size={22} />;
    default:
      return <span className="text-muted-foreground font-arcade text-sm">#{rank}</span>;
  }
};

const Leaderboard = () => {
  const [searchTerm, setSearchTerm] = useState("");

  const filteredScores = mockLeaderboard.filter(
    (entry) =>
      entry.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
      entry.machine.toLowerCase().includes(searchTerm.toLowerCase())
  );

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
            <Trophy className="text-accent" size={32} />
            <h1 className="font-arcade text-2xl text-foreground">LEADERBOARD</h1>
          </div>
          <p className="text-muted-foreground">
            Global rankings of the greatest pinball achievements
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
              className="pl-10 bg-input border-border"
            />
          </div>
          <Button variant="outline" className="gap-2">
            <Filter size={16} />
            Filters
          </Button>
        </motion.div>

        {/* Top 3 Podium */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2 }}
          className="grid grid-cols-3 gap-4 mb-10 max-w-3xl mx-auto"
        >
          {[1, 0, 2].map((orderIndex) => {
            const entry = mockLeaderboard[orderIndex];
            const isFirst = orderIndex === 0;
            return (
              <motion.div
                key={entry.rank}
                whileHover={{ y: -5 }}
                className={`glass-card rounded-xl p-4 text-center ${
                  isFirst ? "neon-border order-2" : "order-" + (orderIndex === 1 ? "1" : "3")
                }`}
              >
                <div className={`mb-2 ${isFirst ? "text-5xl" : "text-4xl"}`}>
                  {entry.avatar}
                </div>
                {getRankIcon(entry.rank)}
                <p className="font-semibold text-foreground mt-2 truncate">
                  {entry.username}
                </p>
                <p className="font-arcade text-xs text-primary mt-1">
                  {entry.score.toLocaleString()}
                </p>
                <p className="text-xs text-muted-foreground mt-1 truncate">
                  {entry.machine}
                </p>
              </motion.div>
            );
          })}
        </motion.div>

        {/* Full Leaderboard */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="glass-card rounded-2xl overflow-hidden max-w-4xl mx-auto"
        >
          <div className="p-4 border-b border-border">
            <h2 className="font-semibold text-foreground">All Rankings</h2>
          </div>
          <div className="divide-y divide-border">
            {filteredScores.map((entry, index) => (
              <motion.div
                key={entry.rank}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.05 * index }}
                whileHover={{ backgroundColor: "hsl(var(--muted) / 0.3)" }}
                className="flex items-center gap-4 p-4 transition-colors"
              >
                <div className="w-10 flex justify-center">
                  {getRankIcon(entry.rank)}
                </div>
                <div className="text-2xl">{entry.avatar}</div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-foreground truncate">
                    {entry.username}
                  </p>
                  <p className="text-sm text-muted-foreground truncate">
                    {entry.machine} • {entry.location}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-arcade text-sm text-primary">
                    {entry.score.toLocaleString()}
                  </p>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>

      <div className="h-20 md:h-0" />
    </div>
  );
};

export default Leaderboard;
