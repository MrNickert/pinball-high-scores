import { motion } from "framer-motion";
import { User, Trophy, Target, Calendar, Settings, LogOut } from "lucide-react";
import { Navbar } from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";

const mockStats = [
  { label: "Total Scores", value: "47", icon: Target },
  { label: "Best Rank", value: "#3", icon: Trophy },
  { label: "Machines Played", value: "12", icon: Target },
  { label: "Member Since", value: "2024", icon: Calendar },
];

const mockRecentScores = [
  { machine: "Medieval Madness", score: 8765400, rank: 5, date: "2 days ago" },
  { machine: "Attack From Mars", score: 6543200, rank: 12, date: "1 week ago" },
  { machine: "The Addams Family", score: 5432100, rank: 8, date: "2 weeks ago" },
];

const Profile = () => {
  const isLoggedIn = false; // TODO: Replace with actual auth state

  if (!isLoggedIn) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="container mx-auto px-4 pt-24 pb-24 flex items-center justify-center min-h-[80vh]">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center bg-card rounded-2xl p-10 max-w-md border border-border shadow-sm"
          >
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
              <User className="text-primary" size={32} />
            </div>
            <h1 className="text-xl font-bold text-foreground mb-2">
              Sign in required
            </h1>
            <p className="text-muted-foreground mb-6">
              Create an account or sign in to view your profile and track your scores.
            </p>
            <Link to="/auth">
              <Button variant="gradient" size="lg">
                Sign In
              </Button>
            </Link>
          </motion.div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <div className="container mx-auto px-4 pt-24 pb-24 max-w-4xl">
        {/* Profile Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-card rounded-2xl p-6 mb-6 border border-border shadow-sm"
        >
          <div className="flex flex-col sm:flex-row items-center gap-6">
            <motion.div
              whileHover={{ scale: 1.05 }}
              className="w-20 h-20 rounded-full bg-gradient-to-br from-primary to-purple-500 flex items-center justify-center text-4xl"
            >
              🧙‍♂️
            </motion.div>
            <div className="text-center sm:text-left flex-1">
              <h1 className="text-xl font-bold text-foreground mb-1">
                PinballWizard
              </h1>
              <p className="text-muted-foreground text-sm">wizard@example.com</p>
              <div className="flex items-center gap-2 mt-2 justify-center sm:justify-start">
                <span className="px-3 py-1 bg-accent/10 text-accent text-xs font-medium rounded-full">
                  Pro Player
                </span>
                <span className="px-3 py-1 bg-primary/10 text-primary text-xs font-medium rounded-full">
                  Top 10
                </span>
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="icon">
                <Settings size={18} />
              </Button>
              <Button variant="ghost" size="icon">
                <LogOut size={18} />
              </Button>
            </div>
          </div>
        </motion.div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          {mockStats.map((stat, index) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              className="bg-card rounded-xl p-4 text-center border border-border shadow-sm"
            >
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center mx-auto mb-2">
                <stat.icon className="text-primary" size={20} />
              </div>
              <p className="text-2xl font-bold text-foreground">{stat.value}</p>
              <p className="text-xs text-muted-foreground mt-1">{stat.label}</p>
            </motion.div>
          ))}
        </div>

        {/* Recent Scores */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="bg-card rounded-2xl overflow-hidden border border-border shadow-sm"
        >
          <div className="p-4 border-b border-border flex items-center justify-between">
            <h2 className="font-semibold text-foreground">Recent Scores</h2>
            <Button variant="ghost" size="sm">View All</Button>
          </div>
          <div className="divide-y divide-border">
            {mockRecentScores.map((score, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.1 * index }}
                className="flex items-center gap-4 p-4"
              >
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Trophy className="text-primary" size={18} />
                </div>
                <div className="flex-1">
                  <p className="font-medium text-foreground">{score.machine}</p>
                  <p className="text-sm text-muted-foreground">{score.date}</p>
                </div>
                <div className="text-right">
                  <p className="font-bold text-primary">
                    {score.score.toLocaleString()}
                  </p>
                  <p className="text-xs text-muted-foreground">Rank #{score.rank}</p>
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

export default Profile;
